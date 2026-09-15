#!/usr/bin/env python3
"""Resumable historical policy/rule backfill.

The command is deliberately independent from the daily collector.  A
backfill writes operational state to ``history_backfill_*`` tables and sends
only validated, source-attributed rows to the permanent history layer.  It
never replaces the public JSON datasets and it never retries completed
batches.

Examples:
  python scripts/backfill_history.py --source federal-register \
      --from 2020-01-01 --to 2020-12-31 --dry-run
  python scripts/backfill_history.py --source cpsc \
      --from 2020-01-01 --to 2020-12-31
  python scripts/backfill_history.py --source platform-rules \
      --platform amazon --from 2020-01-01 --to 2026-09-18
  python scripts/backfill_history.py --job-id <uuid> --resume
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA_DIR = ROOT / "data"
RULES_PATH = DATA_DIR / "rules.json"
FR_API = "https://www.federalregister.gov/api/v1/documents.json"
CPSC_API = "https://www.saferproducts.gov/RestWebServices/Recall"
UA = "JAY-Guanhai historical backfill/1.0"

sys.path.insert(0, str(HERE))
from source_governance import (  # noqa: E402
    SourceGovernanceError,
    assert_source_collectable,
    canonical_source_key,
    source_metadata,
)
from sync_to_supabase import (  # noqa: E402
    build_history_rows,
    history_uuid,
)


def parse_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    raw = str(value or "").strip()
    if len(raw) >= 10:
        raw = raw[:10]
    try:
        return date.fromisoformat(raw)
    except ValueError as error:
        raise ValueError(f"invalid date: {value!r}; expected YYYY-MM-DD") from error


def iso_date(value: date | str | None) -> str | None:
    if value is None or value == "":
        return None
    return parse_date(value).isoformat()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_windows(start: date | str, end: date | str, cadence: str = "month") -> list[tuple[date, date]]:
    """Split an inclusive date range into deterministic windows."""
    first, last = parse_date(start), parse_date(end)
    if last < first:
        raise ValueError("to date must not be earlier than from date")
    if cadence == "year":
        windows = []
        cursor = first
        while cursor <= last:
            boundary = date(cursor.year, 12, 31)
            window_end = min(boundary, last)
            windows.append((cursor, window_end))
            cursor = window_end + timedelta(days=1)
        return windows
    if cadence != "month":
        raise ValueError("cadence must be month or year")
    windows = []
    cursor = first
    while cursor <= last:
        boundary = date(cursor.year, cursor.month, monthrange(cursor.year, cursor.month)[1])
        window_end = min(boundary, last)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


def _json_request(
    url: str,
    params: dict[str, Any],
    *,
    timeout: int = 60,
    opener: Callable[..., Any] | None = None,
) -> Any:
    query = urllib.parse.urlencode(params, doseq=True)
    request = urllib.request.Request(
        f"{url}?{query}" if query else url,
        headers={"User-Agent": UA, "Accept": "application/json", "Accept-Encoding": "identity"},
    )
    open_fn = opener or urllib.request.urlopen
    with open_fn(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def federal_register_params(window: tuple[date, date], page: int = 1, per_page: int = 100) -> dict[str, Any]:
    start, end = window
    return {
        "filter[publication_date][gte]": start.isoformat(),
        "filter[publication_date][lte]": end.isoformat(),
        "page": page,
        "per_page": per_page,
        "order": "oldest",
        "fields[]": [
            "title", "abstract", "publication_date", "agencies", "html_url",
            "document_number", "topics", "type",
        ],
    }


def fetch_federal_register(
    window: tuple[date, date],
    *,
    page: int = 1,
    per_page: int = 100,
    transport: Callable[[str, dict[str, Any]], Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    params = federal_register_params(window, page, per_page)
    response = transport(FR_API, params) if transport else _json_request(FR_API, params)
    if not isinstance(response, dict) or not isinstance(response.get("results"), list):
        raise ValueError("Federal Register response has no results array")
    results = [item for item in response["results"] if isinstance(item, dict)]
    next_url = response.get("next_page_url")
    total_pages = response.get("total_pages")
    next_page = response.get("next_page")
    if next_page is None and next_url:
        next_page = page + 1
    cursor = {
        "page": int(next_page) if next_page is not None else None,
        "next_page_url": next_url,
        "total_pages": int(total_pages) if str(total_pages or "").isdigit() else None,
        "total_entries": response.get("total_entries"),
    }
    return results, cursor


def cpsc_params(window: tuple[date, date]) -> dict[str, Any]:
    start, end = window
    return {"format": "json", "RecallDateStart": start.isoformat(), "RecallDateEnd": end.isoformat()}


def fetch_cpsc(
    window: tuple[date, date],
    *,
    transport: Callable[[str, dict[str, Any]], Any] | None = None,
) -> list[dict[str, Any]]:
    response = transport(CPSC_API, cpsc_params(window)) if transport else _json_request(CPSC_API, cpsc_params(window))
    if isinstance(response, list):
        return [item for item in response if isinstance(item, dict)]
    if isinstance(response, dict):
        for key in ("results", "data", "recalls"):
            if isinstance(response.get(key), list):
                return [item for item in response[key] if isinstance(item, dict)]
        return [response]
    raise ValueError("CPSC response must be an object or array")


def _first(item: dict[str, Any], *names: str) -> Any:
    for name in names:
        value = item.get(name)
        if value is not None and str(value).strip():
            return value
    return None


def _date_value(item: dict[str, Any], *names: str) -> str | None:
    value = _first(item, *names)
    if not value:
        return None
    try:
        return parse_date(str(value)).isoformat()
    except ValueError:
        return None


def _digest(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def normalize_federal_record(item: dict[str, Any], collected_at: str | None = None) -> dict[str, Any]:
    document_number = str(_first(item, "document_number", "documentNumber") or "").strip()
    if not document_number:
        raise ValueError("Federal Register record has no document_number")
    published = _date_value(item, "publication_date", "publicationDate")
    agencies = item.get("agencies") if isinstance(item.get("agencies"), list) else []
    agency_names = [str(row.get("name") or row).strip() for row in agencies if row]
    payload = dict(item)
    payload.update({
        "title": str(item.get("title") or document_number).strip(),
        "summary": str(item.get("abstract") or item.get("summary") or "").strip(),
        "document_number": document_number,
        "publication_date": published,
        "agency": agency_names[0] if agency_names else None,
        "collected_at": collected_at or utc_now().isoformat(),
    })
    return {
        "source_key": "federal-register",
        "domain": "policy",
        "source_record_id": document_number,
        "source_url": item.get("html_url") or item.get("url") or FR_API,
        "source_kind": "official",
        "source_type": "government",
        "source_category": "official_policy",
        "verification_status": "verified",
        "publication_status": "eligible",
        "market_codes": ["US"],
        "platform_keys": [],
        "category_codes": [],
        "jurisdiction_codes": ["US"],
        "published_at": published,
        "effective_from": published,
        "collected_at": payload["collected_at"],
        "allowed_display_fields": ["title", "summary", "source", "source_url", "published_at", "effective_from"],
        "allowed_export_fields": ["title", "summary", "source_url", "published_at", "effective_from"],
        "evidence_hash": _digest(payload),
        "payload": payload,
    }


def normalize_cpsc_record(item: dict[str, Any], collected_at: str | None = None) -> dict[str, Any]:
    recall_id = str(_first(item, "RecallNumber", "recall_number", "RecallID", "recall_id") or "").strip()
    if not recall_id:
        raise ValueError("CPSC record has no stable RecallNumber")
    recall_date = _date_value(item, "RecallDate", "recall_date", "date", "published_date")
    payload = dict(item)
    payload.update({
        "title": str(_first(item, "Title", "title", "recall_title") or recall_id).strip(),
        "summary": str(_first(item, "Description", "description", "recall_description", "summary") or "").strip(),
        "recall_number": recall_id,
        "recall_date": recall_date,
        "revision_key": recall_id,
        "collected_at": collected_at or utc_now().isoformat(),
    })
    return {
        "source_key": "cpsc",
        "domain": "alert",
        "source_record_id": recall_id,
        "source_url": _first(item, "URL", "url", "RecallURL") or CPSC_API,
        "source_kind": "official",
        "source_type": "regulator",
        "source_category": "official_policy",
        "verification_status": "verified",
        "publication_status": "eligible",
        "market_codes": ["US"],
        "platform_keys": [],
        "category_codes": [],
        "jurisdiction_codes": ["US"],
        "published_at": recall_date,
        "effective_from": recall_date,
        "collected_at": payload["collected_at"],
        "allowed_display_fields": ["title", "summary", "source", "source_url", "published_at"],
        "allowed_export_fields": ["title", "summary", "source_url", "published_at"],
        "evidence_hash": _digest(payload),
        "payload": payload,
    }


def _platform_name(value: Any) -> str:
    normalized = str(value or "").strip().casefold().replace("_", "-")
    if normalized in {"amazon", "amazon-us", "amazon.com"}:
        return "amazon"
    if normalized in {"tiktok shop", "tiktok-shop", "tiktokshop"}:
        return "tiktok-shop"
    return normalized


def load_platform_rule_catalog(path: Path = RULES_PATH, platform: str | None = None) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload.get("items", []) if isinstance(payload, dict) else []
    wanted = _platform_name(platform) if platform else None
    records = []
    for item in items:
        if not isinstance(item, dict):
            continue
        item_platform = _platform_name(item.get("platform") or item.get("platform_key"))
        if wanted and item_platform != wanted:
            continue
        records.append(item)
    return records


def normalize_platform_rule(item: dict[str, Any], collected_at: str | None = None) -> dict[str, Any]:
    platform = _platform_name(item.get("platform") or item.get("platform_key"))
    source_id = str(_first(item, "rule_key", "source_record_id", "id") or "").strip()
    source_url = str(item.get("source_url") or "").strip()
    if not source_id:
        if not source_url:
            raise ValueError("platform rule needs rule_key, source_record_id, id or source_url")
        source_id = "url-" + hashlib.sha256(source_url.encode()).hexdigest()[:24]
    published = _date_value(item, "published_at", "publishedAt", "effective_date", "effective_from")
    effective = _date_value(item, "effective_date", "effective_from", "published_at")
    payload = dict(item)
    payload.update({
        "title": str(item.get("title") or source_id).strip(),
        "summary": str(item.get("summary") or item.get("detail") or "").strip(),
        "platform_key": platform,
        "rule_key": source_id,
        "published_at": published,
        "effective_from": effective,
        "identity_quality": "strong" if _first(item, "rule_key", "source_record_id", "id") else "weak",
        "collected_at": collected_at or utc_now().isoformat(),
    })
    return {
        "source_key": "platform-official",
        "domain": "rule",
        "source_record_id": source_id,
        "source_url": source_url or ("https://sellercentral.amazon.com/" if platform == "amazon" else "https://seller.tiktokshopglobalselling.com/"),
        "source_kind": "official",
        "source_type": "platform",
        "source_category": "platform_announcement",
        "verification_status": "verified" if item.get("verification_status") in {None, "verified"} else str(item.get("verification_status")),
        "publication_status": "eligible" if item.get("verification_status") in {None, "verified"} else "quarantined",
        "market_codes": [str(item.get("market") or "US").upper()],
        "platform_keys": [platform] if platform else [],
        "category_codes": [str(item.get("category"))] if item.get("category") else [],
        "jurisdiction_codes": [str(item.get("market") or "US").upper()],
        "published_at": published,
        "effective_from": effective,
        "effective_to": _date_value(item, "effective_to", "effectiveTo"),
        "collected_at": payload["collected_at"],
        "allowed_display_fields": ["title", "summary", "source", "source_url", "published_at", "effective_from"],
        "allowed_export_fields": ["title", "summary", "source_url", "published_at", "effective_from"],
        "evidence_hash": str(item.get("evidence_hash") or _digest(payload)).lower(),
        "payload": payload,
    }


def _record_date(record: dict[str, Any]) -> date | None:
    for field in ("effective_from", "published_at"):
        if record.get(field):
            try:
                return parse_date(record[field])
            except ValueError:
                return None
    return None


def validate_batch_records(records: Iterable[dict[str, Any]], window: tuple[date, date]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    accepted, rejected = [], []
    start, end = window
    for record in records:
        try:
            if not record.get("source_record_id"):
                raise ValueError("missing stable source_record_id")
            if len(str(record.get("evidence_hash") or "")) != 64:
                raise ValueError("invalid evidence_hash")
            observed_values = []
            for field in ("effective_from", "published_at"):
                if record.get(field):
                    observed_values.append(parse_date(record[field]))
            if not observed_values:
                raise ValueError("missing valid publication/effective date")
            outside = [value for value in observed_values if not (start <= value <= end)]
            if outside:
                raise ValueError(f"record date {outside[0]} outside requested window")
            accepted.append(record)
        except (TypeError, ValueError) as error:
            rejected.append({"source_record_id": record.get("source_record_id"), "reason": str(error)})
    return accepted, rejected


def merge_missing_ranges(ranges: Iterable[dict[str, Any]], new_range: tuple[date, date]) -> list[dict[str, str]]:
    values = []
    for row in ranges:
        try:
            values.append((parse_date(row["from"]), parse_date(row["to"])))
        except (KeyError, TypeError, ValueError):
            continue
    values.append(new_range)
    values.sort()
    merged: list[list[date]] = []
    for start, end in values:
        if not merged or start > merged[-1][1] + timedelta(days=1):
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return [{"from": start.isoformat(), "to": end.isoformat()} for start, end in merged]


def subtract_range(ranges: Iterable[dict[str, Any]], covered: tuple[date, date]) -> list[dict[str, str]]:
    """Remove a successful inclusive window from previously missing ranges."""
    covered_start, covered_end = covered
    remaining: list[dict[str, str]] = []
    for row in ranges:
        try:
            start, end = parse_date(row["from"]), parse_date(row["to"])
        except (KeyError, TypeError, ValueError):
            continue
        if covered_end < start or covered_start > end:
            remaining.append({"from": start.isoformat(), "to": end.isoformat()})
            continue
        if start < covered_start:
            remaining.append({"from": start.isoformat(), "to": (covered_start - timedelta(days=1)).isoformat()})
        if end > covered_end:
            remaining.append({"from": (covered_end + timedelta(days=1)).isoformat(), "to": end.isoformat()})
    return remaining


class SupabaseStore:
    """Small REST client kept here so dry-run and unit tests need no SDK."""

    def __init__(self, url: str | None = None, key: str | None = None):
        self.url = (url or os.environ.get("SUPABASE_URL", "")).rstrip("/")
        self.key = key or os.environ.get("SUPABASE_SERVICE_KEY", "")
        if not self.url or not self.key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required for a real backfill")

    def request(self, method: str, table: str, *, query: dict[str, str] | None = None, data: Any = None, prefer: str | None = None) -> Any:
        params = urllib.parse.urlencode(query or {})
        url = f"{self.url}/rest/v1/{table}" + (f"?{params}" if params else "")
        headers = {
            "apikey": self.key, "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json", "Prefer": prefer or "return=minimal",
        }
        body = json.dumps(data, ensure_ascii=False).encode() if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                raw = response.read()
                if not raw:
                    return None
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"Supabase {method} {table} HTTP {error.code}: {detail}") from error

    def find_one(self, table: str, query: dict[str, str]) -> dict[str, Any] | None:
        rows = self.request("GET", table, query={**query, "limit": "1"}) or []
        return rows[0] if isinstance(rows, list) and rows else None

    def list_rows(self, table: str, query: dict[str, str]) -> list[dict[str, Any]]:
        rows = self.request("GET", table, query=query) or []
        return rows if isinstance(rows, list) else []

    def insert(self, table: str, rows: list[dict[str, Any]], conflict: str = "id") -> int:
        if not rows:
            return 0
        self.request("POST", table, query={"on_conflict": conflict}, data=rows,
                     prefer="return=minimal,resolution=ignore-duplicates")
        return len(rows)

    def upsert(self, table: str, rows: list[dict[str, Any]], conflict: str = "id") -> int:
        if not rows:
            return 0
        self.request("POST", table, query={"on_conflict": conflict}, data=rows,
                     prefer="return=minimal,resolution=merge-duplicates")
        return len(rows)

    def patch(self, table: str, row_id: str, values: dict[str, Any]) -> None:
        self.request("PATCH", table, query={"id": f"eq.{row_id}"}, data=values)


class BackfillRunner:
    def __init__(self, source: str, start: date | str, end: date | str, *, platform: str | None = None,
                 batch_size: int = 100, cadence: str = "month", dry_run: bool = False,
                 transport: Callable[[str, dict[str, Any]], Any] | None = None,
                 store: SupabaseStore | None = None, job_id: str | None = None):
        self.source = canonical_source_key(source)
        self.domain = "rule" if self.source == "platform-official" else ("alert" if self.source == "cpsc" else "policy")
        self.start, self.end = parse_date(start), parse_date(end)
        self.platform = _platform_name(platform) if platform else None
        self.batch_size = max(int(batch_size), 1)
        self.cadence = cadence
        self.dry_run = dry_run
        self.transport = transport
        self.store = store
        self.job_id = job_id
        self.windows = build_windows(self.start, self.end, cadence)

    def _job_key(self) -> str:
        suffix = f":{self.platform}" if self.platform else ""
        return f"{self.source}:{self.domain}:{self.start.isoformat()}:{self.end.isoformat()}{suffix}"

    def _collection_run(self) -> dict[str, Any]:
        now = utc_now().isoformat()
        return {
            "run_id": f"backfill-{uuid.uuid4()}", "started_at": now, "completed_at": now,
            "scope": {"market_codes": ["US"], "platform_keys": [self.platform] if self.platform else []},
            "sources": [{"key": self.source, "source_key": self.source, "domain": self.domain,
                         "status": "succeeded", "started_at": now, "completed_at": now}],
        }

    def plan(self) -> list[dict[str, Any]]:
        return [{"batch_key": f"{self.source}:{start}:{end}:page-1", "source_key": self.source,
                 "domain": self.domain, "window_from": start.isoformat(), "window_to": end.isoformat(),
                 "page_number": 1} for start, end in self.windows]

    def _ensure_source(self) -> None:
        try:
            assert_source_collectable(self.source)
        except SourceGovernanceError as error:
            raise RuntimeError(str(error)) from error

    def run(self) -> dict[str, Any]:
        self._ensure_source()
        if self.dry_run:
            result = {"source_key": self.source, "domain": self.domain, "requested_from": self.start.isoformat(),
                      "requested_to": self.end.isoformat(), "batches": self.plan(), "dry_run": True}
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return result
        if self.store is None:
            self.store = SupabaseStore()
        job = self._load_or_create_job()
        existing_batches = self.store.list_rows("history_backfill_batches", {"job_id": f"eq.{job['id']}"})
        summary = {"job_id": job["id"],
                   "completed_batches": sum(row.get("status") == "succeeded" for row in existing_batches),
                   "failed_batches": sum(row.get("status") == "failed" for row in existing_batches),
                   "records_accepted": sum(int(row.get("records_accepted") or 0) for row in existing_batches)}
        self.store.patch("history_backfill_jobs", job["id"], {"status": "running", "started_at": job.get("started_at") or utc_now().isoformat()})
        for start, end in self.windows:
            if self.source == "federal-register":
                self._run_federal_window(job, start, end, summary)
            elif self.source == "cpsc":
                self._run_cpsc_window(job, start, end, summary)
            else:
                self._run_platform_window(job, start, end, summary)
        final_batches = self.store.list_rows("history_backfill_batches", {"job_id": f"eq.{job['id']}"})
        summary["completed_batches"] = sum(row.get("status") == "succeeded" for row in final_batches)
        summary["failed_batches"] = sum(row.get("status") == "failed" for row in final_batches)
        summary["records_accepted"] = sum(int(row.get("records_accepted") or 0) for row in final_batches)
        status = "failed" if summary["failed_batches"] and not summary["completed_batches"] else ("partial" if summary["failed_batches"] else "completed")
        self.store.patch("history_backfill_jobs", job["id"], {"status": status, "completed_batches": summary["completed_batches"],
            "failed_batches": summary["failed_batches"], "completed_at": utc_now().isoformat(), "updated_at": utc_now().isoformat()})
        return {**summary, "job_id": job["id"], "status": status}

    def _load_or_create_job(self) -> dict[str, Any]:
        assert self.store is not None
        job = self.store.find_one("history_backfill_jobs", {"id": f"eq.{self.job_id}"}) if self.job_id else self.store.find_one("history_backfill_jobs", {"job_key": f"eq.{self._job_key()}"})
        if job:
            return job
        row = {"id": str(uuid.uuid4()), "job_key": self._job_key(), "source_key": self.source, "domain": self.domain,
               "status": "pending", "requested_from": self.start.isoformat(), "requested_to": self.end.isoformat(),
               "batch_size": self.batch_size, "total_batches": len(self.windows), "metadata": {"platform": self.platform, "cadence": self.cadence}}
        result = self.store.request("POST", "history_backfill_jobs", data=[row], prefer="return=representation") or [row]
        return result[0] if isinstance(result, list) else row

    def _batch(self, job: dict[str, Any], start: date, end: date, page: int, cursor: dict[str, Any] | None = None) -> dict[str, Any]:
        assert self.store is not None
        token = json.dumps(cursor or {}, sort_keys=True, separators=(",", ":"))
        batch_key = f"{self.source}:{start}:{end}:page-{page}:{hashlib.sha1(token.encode()).hexdigest()[:10]}"
        existing = self.store.find_one("history_backfill_batches", {"job_id": f"eq.{job['id']}", "batch_key": f"eq.{batch_key}"})
        if existing and existing.get("status") == "succeeded":
            return existing
        checkpoint = self.store.find_one("history_backfill_checkpoints", {
            "job_id": f"eq.{job['id']}", "checkpoint_key": f"eq.{batch_key}"
        })
        if checkpoint and isinstance(checkpoint.get("cursor"), dict):
            cursor = checkpoint["cursor"]
            page = int(checkpoint.get("page") or page)
        row = {"id": (existing or {}).get("id", str(uuid.uuid4())), "job_id": job["id"], "batch_key": batch_key,
               "source_key": self.source, "domain": self.domain, "window_from": start.isoformat(), "window_to": end.isoformat(),
               "cursor_before": cursor or {}, "page_number": page, "status": "running", "started_at": utc_now().isoformat()}
        if existing:
            self.store.patch("history_backfill_batches", existing["id"], row)
            row.update(existing)
            row["status"] = "running"
        else:
            created = self.store.request("POST", "history_backfill_batches", data=[row], prefer="return=representation") or [row]
            row = created[0] if isinstance(created, list) else row
        return row

    def _finish_batch(self, batch: dict[str, Any], *, accepted: int, rejected: list[dict[str, Any]], published: int,
                      cursor_after: dict[str, Any] | None = None, error: str | None = None) -> None:
        assert self.store is not None
        status = "failed" if error else "succeeded"
        values = {"status": status, "records_seen": accepted + len(rejected), "records_accepted": accepted,
                  "records_rejected": len(rejected), "records_published": published, "cursor_after": cursor_after or {},
                  "validation_summary": {"rejected": rejected[:50]}, "error": error,
                  "completed_at": utc_now().isoformat(), "updated_at": utc_now().isoformat()}
        self.store.patch("history_backfill_batches", batch["id"], values)

    def _save_checkpoint(self, job: dict[str, Any], batch: dict[str, Any], cursor: dict[str, Any] | None,
                         page: int, last_record_id: str | None = None) -> None:
        assert self.store is not None
        checkpoint_key = str(batch.get("batch_key") or f"page-{page}")
        self.store.upsert("history_backfill_checkpoints", [{
            "id": history_uuid("backfill-checkpoint", job["id"], checkpoint_key),
            "job_id": job["id"], "batch_id": batch["id"], "source_key": self.source,
            "checkpoint_key": checkpoint_key, "cursor": cursor or {}, "page": max(int(page), 1),
            "last_record_id": last_record_id, "request_count": 1,
            "metadata": {"window_from": batch.get("window_from"), "window_to": batch.get("window_to")},
            "checkpoint_at": utc_now().isoformat(),
        }], "id")

    def _persist(self, job: dict[str, Any], batch: dict[str, Any], raw_records: list[dict[str, Any]], app_rows: list[dict[str, Any]], window: tuple[date, date], summary: dict[str, Any], cursor_after: dict[str, Any] | None = None, rejected: list[dict[str, Any]] | None = None) -> None:
        assert self.store is not None
        quality = {"collection_run": self._collection_run()}
        history = build_history_rows(quality, raw_records, app_rows)
        # Entity rows are mutable projections; evidence, versions and formal
        # publications are append-only and use insert-ignore for retries.
        for table in ("source_fetch_runs", "raw_source_records"):
            self.store.insert(table, history[table], "run_id,collector_key" if table == "source_fetch_runs" else "source_key,source_record_id,evidence_hash")
        for table in ("policy_documents", "platform_rules", "product_entities", "shop_entities", "content_entities"):
            self.store.upsert(table, history[table])
        for table in ("policy_versions", "platform_rule_versions", "product_snapshots", "shop_snapshots", "content_snapshots", "formal_publications"):
            self.store.insert(table, history[table])
        self._save_checkpoint(job, batch, cursor_after, int(batch.get("page_number") or 1),
                              raw_records[-1].get("source_record_id") if raw_records else None)
        self._update_coverage(job, window, len(raw_records), cursor_after)
        self._finish_batch(batch, accepted=len(raw_records), rejected=rejected or [], published=len(history["formal_publications"]), cursor_after=cursor_after)
        summary["completed_batches"] += 1
        summary["records_accepted"] += len(raw_records)

    def _update_coverage(self, job: dict[str, Any], window: tuple[date, date], records: int, cursor: dict[str, Any] | None) -> None:
        assert self.store is not None
        key = history_uuid("source-coverage", self.source, self.domain, self.platform or "")
        existing = self.store.find_one("history_source_coverage", {"id": f"eq.{key}"}) or {}
        missing = subtract_range(existing.get("missing_ranges") or [], window)
        values = {"id": key, "source_key": self.source, "domain": self.domain,
                  "market_code": "US", "platform_key": self.platform, "covered_from": min(parse_date(existing["covered_from"]) if existing.get("covered_from") else window[0], window[0]).isoformat(),
                  "covered_to": max(parse_date(existing["covered_to"]) if existing.get("covered_to") else window[1], window[1]).isoformat(),
                  "last_successful_batch_at": utc_now().isoformat(), "records_count": int(existing.get("records_count") or 0) + records,
                  "source_cursor": cursor or {}, "coverage_status": "complete" if not missing else "partial", "missing_ranges": missing, "updated_at": utc_now().isoformat()}
        self.store.upsert("history_source_coverage", [values])
        job_missing = subtract_range(job.get("missing_ranges") or [], window)
        self.store.patch("history_backfill_jobs", job["id"], {"missing_ranges": job_missing, "updated_at": utc_now().isoformat()})

    def _mark_missing(self, window: tuple[date, date], reason: str) -> None:
        assert self.store is not None
        key = history_uuid("source-coverage", self.source, self.domain, self.platform or "")
        existing = self.store.find_one("history_source_coverage", {"id": f"eq.{key}"}) or {}
        missing = merge_missing_ranges(existing.get("missing_ranges") or [], window)
        self.store.upsert("history_source_coverage", [{"id": key, "source_key": self.source, "domain": self.domain,
            "market_code": "US", "platform_key": self.platform, "covered_from": existing.get("covered_from"),
            "covered_to": existing.get("covered_to"), "records_count": int(existing.get("records_count") or 0),
            "source_cursor": existing.get("source_cursor") or {}, "coverage_status": "partial", "missing_ranges": missing,
            "metadata": {**(existing.get("metadata") or {}), "last_missing_reason": reason}, "updated_at": utc_now().isoformat()}])

    def _failed(self, job: dict[str, Any], start: date, end: date, page: int, error: Exception, summary: dict[str, Any], cursor: dict[str, Any] | None = None) -> None:
        assert self.store is not None
        batch = self._batch(job, start, end, page, cursor)
        self._finish_batch(batch, accepted=0, rejected=[], published=0, error=str(error), cursor_after=cursor)
        self._save_checkpoint(job, batch, cursor, page, None)
        summary["failed_batches"] += 1
        coverage_key = history_uuid("source-coverage", self.source, self.domain, self.platform or "")
        existing = self.store.find_one("history_source_coverage", {"id": f"eq.{coverage_key}"}) or {}
        missing = merge_missing_ranges(existing.get("missing_ranges") or [], (start, end))
        self.store.upsert("history_source_coverage", [{"id": coverage_key, "source_key": self.source, "domain": self.domain,
            "market_code": "US", "platform_key": self.platform, "coverage_status": "partial", "missing_ranges": missing,
            "metadata": {"last_error": str(error)}, "updated_at": utc_now().isoformat()}])
        job_missing = merge_missing_ranges(job.get("missing_ranges") or [], (start, end))
        self.store.patch("history_backfill_jobs", job["id"], {"missing_ranges": job_missing, "last_error": str(error), "updated_at": utc_now().isoformat()})

    def _run_federal_window(self, job: dict[str, Any], start: date, end: date, summary: dict[str, Any]) -> None:
        page = 1
        while True:
            try:
                batch = self._batch(job, start, end, page, {"page": page})
                if batch.get("status") == "succeeded":
                    prior_cursor = batch.get("cursor_after") if isinstance(batch.get("cursor_after"), dict) else {}
                    next_page = prior_cursor.get("page")
                    if not next_page or (prior_cursor.get("total_pages") and page >= int(prior_cursor["total_pages"])):
                        break
                    page = int(next_page)
                    continue
                rows, cursor = fetch_federal_register((start, end), page=page, per_page=self.batch_size, transport=self.transport)
                normalized = [normalize_federal_record(row) for row in rows]
                accepted, rejected = validate_batch_records(normalized, (start, end))
                if rejected and not accepted:
                    raise ValueError(f"all records rejected: {rejected[:3]}")
                self._persist(job, batch, accepted, [{"source_key": self.source, "source_record_id": row["source_record_id"], "evidence_hash": row["evidence_hash"], "domain": "policy", "record_key": row["source_record_id"], "market_code": "US", "jurisdiction_code": "US"} for row in accepted], (start, end), summary, cursor, rejected)
                if not cursor.get("page") or (cursor.get("total_pages") and page >= cursor["total_pages"]):
                    break
                page = int(cursor["page"])
            except Exception as error:  # one page failure does not poison other windows
                self._failed(job, start, end, page, error, summary, {"page": page})
                break

    def _run_cpsc_window(self, job: dict[str, Any], start: date, end: date, summary: dict[str, Any]) -> None:
        try:
            raw = [normalize_cpsc_record(row) for row in fetch_cpsc((start, end), transport=self.transport)]
            for offset in range(0, len(raw) or 1, self.batch_size):
                page = offset // self.batch_size + 1
                batch = self._batch(job, start, end, page, {"offset": offset})
                if batch.get("status") == "succeeded":
                    continue
                rows = raw[offset:offset + self.batch_size]
                apps = [{"source_key": self.source, "source_record_id": row["source_record_id"],
                         "evidence_hash": row["evidence_hash"], "domain": "alert",
                         "record_key": row["source_record_id"], "market_code": "US",
                         "jurisdiction_code": "US"} for row in rows]
                self._persist(job, batch, rows, apps, (start, end), summary, {"offset": offset + self.batch_size})
        except Exception as error:
            self._failed(job, start, end, 1, error, summary, {"offset": 0})

    def _run_platform_window(self, job: dict[str, Any], start: date, end: date, summary: dict[str, Any]) -> None:
        try:
            catalog = load_platform_rule_catalog(platform=self.platform)
            normalized = [normalize_platform_rule(item) for item in catalog]
            normalized = [row for row in normalized if _record_date(row) and start <= _record_date(row) <= end]
            if not normalized:
                batch = self._batch(job, start, end, 1, {"offset": 0})
                if batch.get("status") != "succeeded":
                    self._finish_batch(batch, accepted=0, rejected=[], published=0, cursor_after={"offset": 0})
                    self._save_checkpoint(job, batch, {"offset": 0}, 1, None)
                    self._mark_missing((start, end), "official rule directory has no version in requested window")
                return
            for offset in range(0, len(normalized) or 1, self.batch_size):
                page = offset // self.batch_size + 1
                batch = self._batch(job, start, end, page, {"offset": offset})
                if batch.get("status") == "succeeded":
                    continue
                rows = normalized[offset:offset + self.batch_size]
                apps = [{"source_key": self.source, "source_record_id": row["source_record_id"], "evidence_hash": row["evidence_hash"], "domain": "rule", "record_key": row["source_record_id"], "market_code": row["market_codes"][0], "platform_key": row["platform_keys"][0], "category_code": row["category_codes"][0] if row["category_codes"] else None, "jurisdiction_code": row["jurisdiction_codes"][0]} for row in rows]
                self._persist(job, batch, rows, apps, (start, end), summary, {"offset": offset + self.batch_size})
        except Exception as error:
            self._failed(job, start, end, 1, error, summary, {"offset": 0})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="可恢复的政策和平台规则历史回填")
    parser.add_argument("--source", choices=["federal-register", "cpsc", "platform-rules"])
    parser.add_argument("--from", dest="requested_from")
    parser.add_argument("--to", dest="requested_to")
    parser.add_argument("--platform", choices=["amazon", "tiktok-shop"])
    parser.add_argument("--job-id")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--cadence", choices=["month", "year"], default="month")
    args = parser.parse_args(argv)
    if args.resume and not args.job_id:
        parser.error("--resume requires --job-id")
    if not args.job_id and (not args.source or not args.requested_from or not args.requested_to):
        parser.error("new backfill requires --source, --from and --to")
    if args.job_id and not args.source:
        if args.dry_run:
            raise SystemExit("resume dry-run requires --source, --from and --to")
        try:
            existing_store = SupabaseStore()
            existing_job = existing_store.find_one("history_backfill_jobs", {"id": f"eq.{args.job_id}"})
        except RuntimeError as error:
            raise SystemExit(str(error)) from error
        if not existing_job:
            raise SystemExit(f"backfill job not found: {args.job_id}")
        args.source = existing_job["source_key"]
        args.requested_from = existing_job["requested_from"]
        args.requested_to = existing_job["requested_to"]
        metadata = existing_job.get("metadata") if isinstance(existing_job.get("metadata"), dict) else {}
        args.platform = args.platform or metadata.get("platform")
    runner = BackfillRunner(args.source, args.requested_from, args.requested_to, platform=args.platform,
                            batch_size=args.batch_size, cadence=args.cadence, dry_run=args.dry_run, job_id=args.job_id)
    try:
        runner.run()
    except (RuntimeError, ValueError, SourceGovernanceError) as error:
        print(f"[BACKFILL] FAILED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
