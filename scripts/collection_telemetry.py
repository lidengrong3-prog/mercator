"""Shared append-only telemetry for the scheduled data pipeline.

The collectors run as separate processes in GitHub Actions. This module lets
each process append its source outcome to the same collection ledger without
replacing the records written by the primary market collector.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PATH = os.path.join(ROOT, "data", "collection_run.json")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _read(path: str) -> dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict) and isinstance(payload.get("sources"), list):
            return payload
    except (OSError, ValueError, TypeError):
        pass
    now = utc_now().isoformat()
    return {
        "schema_version": 1,
        "started_at": now,
        "completed_at": now,
        "duration_ms": 0,
        "status": "degraded",
        "scope": {},
        "legacy_global_writes": False,
        "sources": [],
        "summary": {},
    }


def _status(successful: int, failed: int, explicit: str | None = None) -> str:
    if explicit in {"succeeded", "degraded", "failed", "skipped"}:
        return explicit
    if failed and successful:
        return "degraded"
    if failed:
        return "failed"
    return "succeeded"


def _positive_int(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return max(parsed, 0)


def append_collection_source(
    source: dict[str, Any],
    *,
    path: str | None = None,
    scope: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Upsert one source row and recalculate aggregate ledger totals."""
    path = path or DEFAULT_PATH
    payload = _read(path)
    payload["schema_version"] = max(_positive_int(payload.get("schema_version")), 2)
    if scope:
        current_scope = payload.get("scope") if isinstance(payload.get("scope"), dict) else {}
        for key, value in scope.items():
            if value is not None:
                current_scope[key] = value
        payload["scope"] = current_scope
    payload["legacy_global_writes"] = False

    key = str(source.get("key") or "").strip()
    if not key:
        raise ValueError("collection telemetry source key is required")
    normalized = {
        "key": key,
        "label": str(source.get("label") or key),
        "domain": str(source.get("domain") or "supporting"),
        "core": bool(source.get("core", False)),
        "market_codes": list(dict.fromkeys(str(value).strip().upper() for value in (source.get("market_codes") or []) if str(value).strip())),
        "platform_keys": list(dict.fromkeys(str(value).strip().casefold() for value in (source.get("platform_keys") or []) if str(value).strip())),
        "status": _status(
            _positive_int(source.get("successful_requests")),
            _positive_int(source.get("failed_requests")),
            str(source.get("status") or "").strip() or None,
        ),
        "duration_ms": _positive_int(source.get("duration_ms")),
        "request_count": _positive_int(source.get("request_count")),
        "successful_requests": _positive_int(source.get("successful_requests")),
        "failed_requests": _positive_int(source.get("failed_requests")),
        "records_collected": _positive_int(source.get("records_collected")),
        "records_in_scope": _positive_int(source.get("records_in_scope", source.get("records_collected"))),
    }
    for optional in ("cache_used", "cached_sections", "content_updated_at", "last_checked_at", "attempted_at", "errors"):
        if optional in source:
            normalized[optional] = source[optional]

    rows = [row for row in payload.get("sources", []) if isinstance(row, dict) and row.get("key") != key]
    rows.append(normalized)
    payload["sources"] = rows

    started = payload.get("started_at") or utc_now().isoformat()
    completed = utc_now()
    payload["completed_at"] = completed.isoformat()
    try:
        started_at = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        payload["duration_ms"] = max(int((completed - started_at.astimezone(timezone.utc)).total_seconds() * 1000), 0)
    except (TypeError, ValueError):
        payload["started_at"] = completed.isoformat()
        payload["duration_ms"] = 0

    core_failures = sorted(row["key"] for row in rows if row.get("core") is True and row.get("status") == "failed")
    failed_sources = sorted(row["key"] for row in rows if row.get("status") == "failed")
    degraded_sources = sorted(row["key"] for row in rows if row.get("status") == "degraded")
    payload["status"] = "failed" if core_failures else ("degraded" if failed_sources or degraded_sources else "healthy")
    payload["summary"] = {
        "sources": len(rows),
        "succeeded": sum(row.get("status") == "succeeded" for row in rows),
        "degraded": len(degraded_sources),
        "failed": len(failed_sources),
        "core_failures": core_failures,
        "records_collected": sum(_positive_int(row.get("records_collected")) for row in rows),
        "records_in_scope": sum(_positive_int(row.get("records_in_scope")) for row in rows),
    }
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return payload
