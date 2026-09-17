#!/usr/bin/env python3
"""Run the private TikHub market-scoped seven-day pilot.

The collector deliberately has a small, explicit surface:

* the API key is read only from ``TIKHUB_API_KEY``;
* product/shop pilots and content runs use separate HTTPS endpoint allowlists;
  only configured launch-market scopes are accepted;
* raw response bytes go to the private Storage bucket, while only normalized
  fields are written to the service-only history tables;
* every request is accounted for even when a provider request fails.

Endpoint paths are deployment configuration because TikHub products and paths
can change.  They are never accepted from a task as an arbitrary URL.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from private_artifact_store import upload_private_bytes
from market_scope import load_market_scope, normalize_category_code, resolve_market_scopes
from source_governance import SourceGovernanceError, assert_source_collectable


SOURCE_KEY = "tikhub"
SOURCE_KIND = "traceable"
SOURCE_TYPE = "licensed_provider"
SOURCE_CATEGORY = "third_party_provider"
PILOT_KEY = "tiktok-shop-us-pilot"  # legacy default; real runs derive this from scope
MARKET_CODE = "US"  # legacy compatibility for callers that omit an explicit scope
PLATFORM_KEY = "tiktok-shop"
PILOT_DAYS = 7
EXPECTED_KEYWORD_COUNT = 20
MAX_REQUESTS_PER_RUN = EXPECTED_KEYWORD_COUNT * 4
DEFAULT_COST_USD = 0.05
ALLOWED_ENDPOINTS = (
    "product_search", "product_detail", "seller_profile", "shop_analytics",
)
CONTENT_ENDPOINTS = (
    "video_search", "video_detail", "creator_profile", "video_product_relation",
)
MONITOR_ENDPOINTS = {
    "keyword": ALLOWED_ENDPOINTS,
    "product": ("product_search", "product_detail"),
    "shop": ("seller_profile", "shop_analytics"),
}
DEFAULT_KEYWORDS = (
    "beauty", "skincare", "makeup", "haircare", "womens-fashion",
    "mens-fashion", "shoes", "jewelry", "home-decor", "kitchen",
    "electronics", "phone-accessories", "pet-supplies", "toys", "fitness",
    "outdoor", "baby-products", "health", "automotive", "luggage",
)
STANDARD_PRODUCT_FIELDS = (
    "platform_product_id", "title", "source_url", "category_code", "price",
    "currency", "sales", "rating", "review_count", "inventory",
)
STANDARD_SHOP_FIELDS = (
    "platform_shop_id", "name", "source_url", "gmv", "followers",
    "product_count", "sales", "rating",
)
STANDARD_CONTENT_FIELDS = (
    "platform_content_id", "title", "content_type", "source_url", "creator_id",
    "creator_name", "product_id", "shop_id", "views", "likes", "comments",
    "shares", "conversions", "followers", "published_at", "engagement_rate",
)

ROOT = Path(__file__).resolve().parent.parent
MARKET_SCOPE = load_market_scope()
FIXTURE_ENDPOINT_URL = "https://api.tikhub.io/fixture"
urlopen = urllib.request.urlopen


class TikHubPilotError(RuntimeError):
    """A configuration, provider, or persistence error that is safe to show."""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat()


def _safe_text(value: Any, limit: int = 600) -> str:
    text = str(value or "").strip()
    for secret_name in ("TIKHUB_API_KEY", "TIKHUB_COOKIE_SECRET", "SUPABASE_SERVICE_KEY"):
        secret = os.environ.get(secret_name, "").strip()
        if secret:
            text = text.replace(secret, "[REDACTED]")
    return text[-limit:]


def _safe_segment(value: Any) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "").strip()).strip("-.")[:120] or "unknown"


def _json_hash(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def history_uuid(namespace: str, *parts: Any) -> str:
    """Match ``public.history_uuid`` used by the permanent history importer."""
    value = "|".join(str(part or "") for part in parts)
    digest = hashlib.md5(f"{namespace}:{value}".encode("utf-8")).hexdigest()
    return str(uuid.UUID(digest))


def _number(value: Any) -> int | float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    text = re.sub(r"[^0-9.\-]", "", text)
    try:
        number = float(text)
    except ValueError:
        return None
    return int(number) if number.is_integer() else number


def _first(record: Mapping[str, Any], names: Sequence[str]) -> Any:
    for name in names:
        value = record.get(name)
        if value is not None and str(value).strip():
            return value
    return None


def _date_value(value: str | None) -> str:
    if value:
        try:
            return date.fromisoformat(value[:10]).isoformat()
        except ValueError as error:
            raise TikHubPilotError("run date must be YYYY-MM-DD") from error
    return utc_now().date().isoformat()


def validate_keywords(keywords: Sequence[str] | None = None, *, require_twenty: bool = True) -> list[str]:
    values = list(DEFAULT_KEYWORDS if keywords is None else keywords)
    normalized = []
    for value in values:
        text = str(value or "").strip().casefold()
        if not text or len(text) > 80 or any(char in text for char in "\r\n"):
            raise TikHubPilotError("keywords must be non-empty single-line values")
        normalized.append(text)
    if len(normalized) != len(set(normalized)):
        raise TikHubPilotError("keywords must not contain duplicates")
    if require_twenty and len(normalized) != EXPECTED_KEYWORD_COUNT:
        raise TikHubPilotError(f"TikHub pilot requires exactly {EXPECTED_KEYWORD_COUNT} keywords")
    return normalized


def _endpoint_env_names(endpoint_key: str) -> tuple[str, ...]:
    suffix = endpoint_key.upper()
    return (
        f"TIKHUB_ENDPOINT_{suffix}",
        f"TIKHUB_{suffix}_URL",
        f"TIKHUB_ENDPOINT_{suffix}_URL",
    )


def resolve_endpoint(endpoint_key: str, *, fixture: bool = False) -> dict[str, Any]:
    if endpoint_key not in ALLOWED_ENDPOINTS + CONTENT_ENDPOINTS:
        raise TikHubPilotError(f"endpoint is not allowlisted: {endpoint_key}")
    raw_url = next((os.environ.get(name, "").strip() for name in _endpoint_env_names(endpoint_key)
                    if os.environ.get(name, "").strip()), "")
    if fixture and not raw_url:
        raw_url = f"{FIXTURE_ENDPOINT_URL}/{endpoint_key}"
    if not raw_url:
        raise TikHubPilotError(f"missing endpoint configuration: {endpoint_key}")
    parsed = urllib.parse.urlparse(raw_url)
    allowed_hosts = {
        value.strip().casefold()
        for value in os.environ.get("TIKHUB_ALLOWED_HOSTS", "api.tikhub.io,tikhub.io").split(",")
        if value.strip()
    }
    if parsed.scheme.casefold() != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise TikHubPilotError(f"endpoint must use HTTPS: {endpoint_key}")
    if parsed.query or parsed.fragment:
        raise TikHubPilotError(f"endpoint must not contain query credentials: {endpoint_key}")
    hostname = parsed.hostname.casefold()
    if hostname not in allowed_hosts and not fixture:
        raise TikHubPilotError(f"endpoint host is not allowlisted: {endpoint_key}")
    requires_cookie = os.environ.get(
        f"TIKHUB_ENDPOINT_{endpoint_key.upper()}_REQUIRES_COOKIE", "false"
    ).strip().casefold() == "true"
    production_allowed = os.environ.get(
        f"TIKHUB_ENDPOINT_{endpoint_key.upper()}_PRODUCTION_AUTOMATION_ALLOWED", "false"
    ).strip().casefold() == "true"
    auth_mode = os.environ.get(
        f"TIKHUB_ENDPOINT_{endpoint_key.upper()}_AUTH_MODE", "bearer"
    ).strip().casefold() or "bearer"
    if auth_mode not in {"bearer", "api_key"}:
        raise TikHubPilotError(f"unsupported TikHub auth mode: {endpoint_key}")
    if requires_cookie:
        allow_cookie = os.environ.get("TIKHUB_ALLOW_COOKIE_ENDPOINTS", "false").strip().casefold() == "true"
        if not production_allowed or not allow_cookie or not os.environ.get("TIKHUB_COOKIE_SECRET", "").strip():
            raise TikHubPilotError(
                f"cookie endpoint is blocked by default: {endpoint_key}; production opt-in, explicit cookie opt-in and secret required"
            )
    method = os.environ.get(f"TIKHUB_ENDPOINT_{endpoint_key.upper()}_METHOD", "GET").strip().upper() or "GET"
    if method not in {"GET", "POST"}:
        raise TikHubPilotError(f"unsupported TikHub HTTP method: {endpoint_key}")
    return {
        "endpoint_key": endpoint_key,
        "url": raw_url,
        "method": method,
        "requires_cookie": requires_cookie,
        "production_automation_allowed": production_allowed,
        "auth_mode": auth_mode,
    }


def _request_endpoint(
    endpoint: Mapping[str, Any],
    parameters: Mapping[str, Any],
    api_key: str,
    *,
    timeout: int,
    opener: Callable[..., Any] = urlopen,
) -> tuple[int, bytes]:
    method = str(endpoint.get("method") or "GET").upper()
    url = str(endpoint["url"])
    body = None
    if method == "GET":
        query = urllib.parse.urlencode(parameters, doseq=True)
        url = f"{url}{'&' if '?' in url else '?'}{query}" if query else url
    else:
        body = json.dumps(dict(parameters), ensure_ascii=False).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mercator-TikHub-Pilot/1.0",
        "Content-Type": "application/json",
    }
    if endpoint.get("auth_mode") == "api_key":
        headers["X-API-Key"] = api_key
    else:
        headers["Authorization"] = f"Bearer {api_key}"
    if endpoint.get("requires_cookie"):
        headers["Cookie"] = os.environ.get("TIKHUB_COOKIE_SECRET", "").strip()
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with opener(request, timeout=timeout) as response:
            return int(getattr(response, "status", 200)), response.read()
    except urllib.error.HTTPError as error:
        return int(error.code), error.read()
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise TikHubPilotError(f"provider request failed: {_safe_text(error)}") from error


def _records_from_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    if not payload:
        return []
    for key in ("items", "products", "shops", "sellers", "results", "data", "list", "result"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = _records_from_payload(value)
            if nested:
                return nested
    return [payload]


def _unwrap_record(record: Mapping[str, Any], endpoint_key: str) -> dict[str, Any]:
    if endpoint_key in CONTENT_ENDPOINTS:
        candidates = ("video", "content", "creator", "user", "item")
    else:
        candidates = ("product", "item") if endpoint_key.startswith("product") else ("shop", "seller", "store")
    for key in candidates:
        nested = record.get(key)
        if isinstance(nested, dict):
            merged = dict(record)
            merged.update(nested)
            return merged
    return dict(record)


def normalize_record(record: Mapping[str, Any], endpoint_key: str, keyword: str,
                     market_code: str = MARKET_CODE, platform_key: str = PLATFORM_KEY) -> dict[str, Any]:
    item = _unwrap_record(record, endpoint_key)
    is_product = endpoint_key in {"product_search", "product_detail"}
    is_content = endpoint_key in CONTENT_ENDPOINTS
    if is_product:
        stable = _first(item, ("product_id", "productId", "item_id", "itemId", "sku_id", "skuId", "id"))
        normalized = {
            "snapshot_type": "product",
            "platform": platform_key,
            "market": market_code,
            "platform_product_id": str(stable).strip() if stable is not None else None,
            "title": _first(item, ("title", "name", "product_name", "productName")),
            "source_url": _first(item, ("source_url", "product_url", "productUrl", "url", "link")),
            "category_code": normalize_category_code(
                _first(item, ("category_code", "category", "categoryName")) or keyword,
                MARKET_SCOPE,
                market_codes=[market_code],
            ),
            "price": _number(_first(item, ("price", "selling_price", "sellingPrice", "current_price", "sale_price"))),
            "currency": _first(item, ("currency", "currency_code", "currencyCode")),
            "sales": _number(_first(item, ("sales", "sold", "sold_count", "volume", "orders"))),
            "rating": _number(_first(item, ("rating", "score"))),
            "review_count": _number(_first(item, ("review_count", "reviewCount", "reviews"))),
            "inventory": _number(_first(item, ("inventory", "stock", "stock_count"))),
        }
        fields = STANDARD_PRODUCT_FIELDS
    elif is_content:
        stable = _first(item, ("content_id", "contentId", "video_id", "videoId", "aweme_id", "awemeId", "id"))
        normalized = {
            "snapshot_type": "content",
            "platform": platform_key,
            "market": market_code,
            "platform_content_id": str(stable).strip() if stable is not None else None,
            "title": _first(item, ("title", "description", "caption", "text")),
            "content_type": _first(item, ("content_type", "contentType", "type")) or "video",
            "category_code": normalize_category_code(
                _first(item, ("category_code", "category", "categoryName")) or keyword,
                MARKET_SCOPE,
                market_codes=[market_code],
            ),
            "source_url": _first(item, ("source_url", "video_url", "videoUrl", "share_url", "url", "link")),
            "creator_id": _first(item, ("creator_id", "creatorId", "author_id", "authorId", "user_id", "userId")),
            "creator_name": _first(item, ("creator_name", "creatorName", "author", "author_name", "nickname", "username")),
            "product_id": _first(item, ("product_id", "productId", "item_id", "itemId", "sku_id")),
            "shop_id": _first(item, ("shop_id", "shopId", "seller_id", "sellerId", "store_id")),
            "views": _number(_first(item, ("views", "view_count", "viewCount", "plays", "play_count"))),
            "likes": _number(_first(item, ("likes", "like_count", "likeCount"))),
            "comments": _number(_first(item, ("comments", "comment_count", "commentCount"))),
            "shares": _number(_first(item, ("shares", "share_count", "shareCount"))),
            "conversions": _number(_first(item, ("conversions", "orders", "order_count", "sales"))),
            "followers": _number(_first(item, ("followers", "fans", "follower_count"))),
            "published_at": _first(item, ("published_at", "publishedAt", "create_time", "createTime", "date")),
            "engagement_rate": _number(_first(item, ("engagement_rate", "engagementRate"))),
        }
        fields = STANDARD_CONTENT_FIELDS
    else:
        stable = _first(item, ("shop_id", "shopId", "seller_id", "sellerId", "store_id", "storeId", "id"))
        normalized = {
            "snapshot_type": "shop",
            "platform": platform_key,
            "market": market_code,
            "platform_shop_id": str(stable).strip() if stable is not None else None,
            "name": _first(item, ("name", "shop_name", "shopName", "seller_name", "sellerName", "store_name")),
            "source_url": _first(item, ("source_url", "shop_url", "shopUrl", "seller_url", "url", "link")),
            "gmv": _number(_first(item, ("gmv", "GMV", "gross_merchandise_value"))),
            "followers": _number(_first(item, ("followers", "fans", "follower_count"))),
            "product_count": _number(_first(item, ("product_count", "productCount", "products_count"))),
            "sales": _number(_first(item, ("sales", "sold", "volume", "orders"))),
            "rating": _number(_first(item, ("rating", "score"))),
        }
        fields = STANDARD_SHOP_FIELDS
    normalized["source_url"] = (
        str(normalized["source_url"]).strip() if normalized.get("source_url") else None
    )
    if normalized.get("source_url") and not str(normalized["source_url"]).startswith("https://"):
        normalized["source_url"] = None
    normalized["standard_fields"] = {field: normalized.get(field) for field in fields if normalized.get(field) is not None}
    return normalized


def _fixture_response(fixture: Mapping[str, Any], endpoint_key: str, keyword: str) -> Any:
    value = fixture.get(endpoint_key)
    if isinstance(value, dict) and keyword in value:
        return value[keyword]
    if isinstance(value, list):
        # A list is one response shared by every keyword.  Per-keyword
        # fixtures use an object keyed by the normalized keyword above.
        return value
    return value if value is not None else {}


class SupabaseWriter:
    """Minimal service-role REST writer used by the Worker process."""

    def __init__(self, url: str | None = None, key: str | None = None, *, opener: Callable[..., Any] = urlopen):
        self.url = (url or os.environ.get("SUPABASE_URL", "")).strip().rstrip("/")
        self.key = (key or os.environ.get("SUPABASE_SERVICE_KEY", "")).strip()
        self.opener = opener
        if not self.url or not self.key:
            raise TikHubPilotError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required for persistence")

    def request(self, method: str, path: str, *, body: Any = None, query: Mapping[str, Any] | None = None,
                prefer: str = "return=representation") -> Any:
        query_string = urllib.parse.urlencode(query or {}, doseq=True)
        url = f"{self.url}/{path.lstrip('/')}" + (f"?{query_string}" if query_string else "")
        payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(url, data=payload, method=method.upper(), headers={
            "apikey": self.key, "Authorization": f"Bearer {self.key}",
            "Accept": "application/json", "Content-Type": "application/json", "Prefer": prefer,
        })
        try:
            with self.opener(request, timeout=60) as response:
                raw = response.read()
                if not raw:
                    return None
                return json.loads(raw.decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, OSError, ValueError) as error:
            raise TikHubPilotError(f"Supabase persistence failed: {_safe_text(error)}") from error

    def upsert(self, table: str, rows: Sequence[Mapping[str, Any]], conflict: str) -> Any:
        if not rows:
            return []
        return self.request("POST", f"rest/v1/{table}", body=list(rows),
                            query={"on_conflict": conflict},
                            prefer="return=minimal,resolution=merge-duplicates")

    def insert(self, table: str, rows: Sequence[Mapping[str, Any]], conflict: str | None = None) -> Any:
        if not rows:
            return []
        query = {"on_conflict": conflict} if conflict else None
        return self.request("POST", f"rest/v1/{table}", body=list(rows), query=query,
                            prefer="return=minimal,resolution=ignore-duplicates")

    def update(self, table: str, filters: Mapping[str, str], row: Mapping[str, Any]) -> Any:
        return self.request("PATCH", f"rest/v1/{table}", body=dict(row), query=filters,
                            prefer="return=minimal")

    def find_artifact_id(self, bucket: str, object_path: str) -> str | None:
        rows = self.request("GET", f"rest/v1/private_data_artifacts", query={
            "bucket_id": f"eq.{bucket}", "object_path": f"eq.{object_path}", "select": "id", "limit": "1",
        })
        return rows[0].get("id") if isinstance(rows, list) and rows and isinstance(rows[0], dict) else None

    def select(self, table: str, query: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
        rows = self.request("GET", f"rest/v1/{table}", query=query or {})
        return rows if isinstance(rows, list) else []


def _endpoint_parameters(endpoint_key: str, keyword: str,
                         market_code: str = MARKET_CODE, platform_key: str = PLATFORM_KEY,
                         *, monitoring_type: str | None = None,
                         target_external_id: str | None = None,
                         target_entity_id: str | None = None) -> dict[str, str]:
    """Build the bounded provider request for a pilot or one monitor target."""
    params = {"keyword": keyword, "market": market_code, "platform": platform_key}
    target_id = target_external_id or target_entity_id
    if target_id:
        if endpoint_key.startswith("product") or monitoring_type == "product":
            params["product_id"] = target_id
        elif endpoint_key in {"seller_profile", "shop_analytics"} or monitoring_type == "shop":
            params["shop_id"] = target_id
        params["target_id"] = target_id
    if monitoring_type:
        params["monitoring_type"] = monitoring_type
    return params


def _standard_fields_snapshot() -> list[dict[str, Any]]:
    rows = []
    for endpoint_key in ALLOWED_ENDPOINTS + CONTENT_ENDPOINTS:
        fields = (STANDARD_PRODUCT_FIELDS if endpoint_key.startswith("product")
                  else STANDARD_CONTENT_FIELDS if endpoint_key in CONTENT_ENDPOINTS
                  else STANDARD_SHOP_FIELDS)
        for field in fields:
            rows.append({
                "endpoint_key": endpoint_key,
                "target_field": field,
                "commercial_authorized": False,
                "public_display_allowed": False,
            })
    return rows


def build_seven_day_report(runs: Sequence[Mapping[str, Any]], events: Sequence[Mapping[str, Any]],
                           *, period_from: str | None = None, period_to: str | None = None,
                           pilot_key: str = PILOT_KEY, market_code: str = MARKET_CODE,
                           platform_key: str = PLATFORM_KEY) -> dict[str, Any]:
    run_dates = sorted(str(row.get("run_date"))[:10] for row in runs if row.get("run_date"))
    start = period_from or (run_dates[0] if run_dates else utc_now().date().isoformat())
    end = period_to or (run_dates[-1] if run_dates else start)
    total_requests = sum(max(int(row.get("request_count") or 0), 0) for row in runs)
    successful = sum(max(int(row.get("successful_requests") or 0), 0) for row in runs)
    missing = sum(max(int(row.get("missing_count") or 0), 0) for row in runs)
    duplicates = sum(max(int(row.get("duplicate_count") or 0), 0) for row in runs)
    records = sum(max(int(row.get("records_collected") or 0), 0) for row in runs)
    total_cost = sum(float(row.get("estimated_cost_usd") or 0) for row in runs)
    product_trends = sum(max(int((row.get("report") or {}).get("product_trend_count") or 0), 0)
                         for row in runs if isinstance(row.get("report"), dict))
    shop_trends = sum(max(int((row.get("report") or {}).get("shop_trend_count") or 0), 0)
                      for row in runs if isinstance(row.get("report"), dict))
    content_trends = sum(max(int((row.get("report") or {}).get("content_trend_count") or 0), 0)
                         for row in runs if isinstance(row.get("report"), dict))
    denominator = max(total_requests, 1)
    parsed_days = []
    for value in sorted(set(run_dates)):
        try:
            parsed_days.append(date.fromisoformat(value))
        except ValueError:
            continue
    day_set = set(parsed_days)
    has_seven_consecutive_days = any(
        all((candidate + timedelta(days=offset)) in day_set for offset in range(PILOT_DAYS))
        for candidate in parsed_days
    )
    return {
        "pilot_key": pilot_key,
        "market_code": market_code,
        "platform_key": platform_key,
        "period_from": start,
        "period_to": end,
        "status": "complete" if has_seven_consecutive_days else "incomplete",
        "field_mapping_snapshot": _standard_fields_snapshot(),
        "missing_rate": round(missing / max(records + missing, 1), 6),
        "duplicate_rate": round(duplicates / max(records, 1), 6),
        "success_rate": round(successful / denominator, 6),
        "total_requests": total_requests,
        "total_cost_usd": round(total_cost, 6),
        "product_trend_count": product_trends,
        "shop_trend_count": shop_trends,
        "content_trend_count": content_trends,
        "coverage": {"run_days": sorted(set(run_dates)), "expected_days": PILOT_DAYS},
        "authorization_summary": {
            "source_kind": SOURCE_KIND, "source_category": SOURCE_CATEGORY,
            "commercial_authorized": False, "public_display_allowed": False,
        },
        "event_count": len(events),
    }


def generate_seven_day_report(writer: SupabaseWriter, *, period_from: str | None = None,
                              period_to: str | None = None,
                              pilot_key: str = PILOT_KEY,
                              market_code: str = MARKET_CODE,
                              platform_key: str = PLATFORM_KEY) -> dict[str, Any]:
    """Read private run ledgers, persist the current seven-day report, and return it."""
    query: dict[str, str] = {"pilot_key": f"eq.{pilot_key}", "select": "*", "order": "run_date.asc"}
    if period_from and period_to:
        query["and"] = f"(run_date.gte.{_date_value(period_from)},run_date.lte.{_date_value(period_to)})"
    elif period_from:
        query["run_date"] = f"gte.{_date_value(period_from)}"
    if period_to:
        if not period_from:
            query["run_date"] = f"lte.{_date_value(period_to)}"
    runs = writer.select("tikhub_pilot_runs", query)
    events = writer.select("tikhub_fetch_events", {
        "select": "pilot_run_id,endpoint_key,success,missing_count,duplicate_count,estimated_cost_usd",
    })
    report = build_seven_day_report(runs, events, period_from=period_from, period_to=period_to,
                                    pilot_key=pilot_key, market_code=market_code,
                                    platform_key=platform_key)
    writer.upsert("tikhub_pilot_reports", [report], "pilot_key,period_from,period_to")
    return report


def _raw_row(standard: Mapping[str, Any], *, source_record_id: str, response_hash: str,
             collected_at: str, raw_source_record_id: str, source_fetch_run_id: str,
             pilot_run_id: str, market_code: str = MARKET_CODE,
             platform_key: str = PLATFORM_KEY) -> dict[str, Any]:
    kind = str(standard.get("snapshot_type"))
    return {
        "id": raw_source_record_id,
        "source_fetch_run_id": source_fetch_run_id,
        "run_id": pilot_run_id,
        "source_key": SOURCE_KEY,
        "domain": kind,
        "source_record_id": source_record_id,
        "normalized_record_key": f"{kind}:{standard.get('platform_product_id') or standard.get('platform_shop_id') or source_record_id}",
        "source_url": standard.get("source_url"),
        "source_kind": SOURCE_KIND,
        "source_type": SOURCE_TYPE,
        "source_category": SOURCE_CATEGORY,
        "source_class": "third_party",
        "verification_status": "pending",
        "publication_status": "quarantined",
        "quarantine_reason": "TikHub commercial authorization and redistribution are not confirmed",
        "market_codes": [market_code], "platform_keys": [platform_key],
        "category_codes": [str(standard.get("category_code"))] if standard.get("category_code") else [],
        "jurisdiction_codes": [market_code],
        "collected_at": collected_at, "retrieved_at": collected_at,
        "first_seen_at": collected_at, "last_seen_at": collected_at,
        "evidence_hash": response_hash,
        # Standardized fields only; the raw response is private Storage data.
        "payload": dict(standard.get("standard_fields") or {}),
        "allowed_display_fields": [], "allowed_export_fields": [],
        "license_class": "commercial", "access_class": "service_private",
        "redistribution_allowed": False,
        "retention_until": (utc_now() + timedelta(days=30)).isoformat(),
        "status": "active",
    }


def _history_rows(standard: Mapping[str, Any], raw_id: str, evidence_hash: str, collected_at: str,
                  market_code: str = MARKET_CODE, platform_key: str = PLATFORM_KEY) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    kind = str(standard["snapshot_type"])
    stable_key = (standard.get("platform_product_id") or standard.get("platform_shop_id")
                  or standard.get("platform_content_id"))
    entity_id = history_uuid(f"{kind}-entity", SOURCE_KEY, platform_key, stable_key, market_code)
    snapshot_id = history_uuid(f"{kind}-snapshot", entity_id, collected_at, evidence_hash)
    if kind == "product":
        entity = {
            "id": entity_id, "source_key": SOURCE_KEY, "platform_key": platform_key,
            "platform_product_id": stable_key, "market_code": market_code,
            "category_code": standard.get("category_code"), "title": standard.get("title"),
            "source_url": standard.get("source_url"), "first_seen_at": collected_at,
            "last_seen_at": collected_at, "metadata": dict(standard.get("standard_fields") or {}),
        }
        snapshot = {
            "id": snapshot_id, "product_entity_id": entity_id, "raw_source_record_id": raw_id,
            "collected_at": collected_at, "first_seen_at": collected_at, "last_seen_at": collected_at,
            "published_at": None, "price": standard.get("price"), "currency": standard.get("currency"),
            "sales": standard.get("sales"), "rating": standard.get("rating"),
            "review_count": standard.get("review_count"), "inventory": standard.get("inventory"),
            "metrics": dict(standard.get("standard_fields") or {}), "evidence_hash": evidence_hash,
        }
    elif kind == "shop":
        entity = {
            "id": entity_id, "source_key": SOURCE_KEY, "platform_shop_id": stable_key,
            "platform_key": platform_key, "market_code": market_code,
            "category_code": None, "name": standard.get("name"),
            "source_url": standard.get("source_url"), "first_seen_at": collected_at,
            "last_seen_at": collected_at, "metadata": dict(standard.get("standard_fields") or {}),
        }
        snapshot = {
            "id": snapshot_id, "shop_entity_id": entity_id, "raw_source_record_id": raw_id,
            "collected_at": collected_at, "first_seen_at": collected_at, "last_seen_at": collected_at,
            "published_at": None, "gmv": standard.get("gmv"), "followers": standard.get("followers"),
            "product_count": standard.get("product_count"), "sales": standard.get("sales"),
            "rating": standard.get("rating"), "metrics": dict(standard.get("standard_fields") or {}),
            "evidence_hash": evidence_hash,
        }
    else:
        entity = {
            "id": entity_id, "source_key": SOURCE_KEY, "platform_content_id": stable_key,
            "platform_key": platform_key, "market_code": market_code,
            "category_code": standard.get("category_code"), "title": standard.get("title"),
            "source_url": standard.get("source_url"), "first_seen_at": collected_at,
            "last_seen_at": collected_at, "metadata": dict(standard.get("standard_fields") or {}),
        }
        snapshot = {
            "id": snapshot_id, "content_entity_id": entity_id, "raw_source_record_id": raw_id,
            "collected_at": collected_at, "first_seen_at": collected_at, "last_seen_at": collected_at,
            "published_at": standard.get("published_at"), "views": standard.get("views"),
            "likes": standard.get("likes"), "comments": standard.get("comments"),
            "shares": standard.get("shares"), "conversions": standard.get("conversions"),
            "engagement_rate": standard.get("engagement_rate"),
            "metrics": dict(standard.get("standard_fields") or {}), "evidence_hash": evidence_hash,
        }
    return entity, snapshot, {"snapshot_type": kind, "snapshot_id": snapshot_id}


def _collect_pilot_scope(
    *,
    run_date: str | None = None,
    keywords: Sequence[str] | None = None,
    fixture_path: str | None = None,
    dry_run: bool = False,
    writer: SupabaseWriter | None = None,
    opener: Callable[..., Any] = urlopen,
    timeout: int | None = None,
    market_code: str = MARKET_CODE,
    platform_key: str = PLATFORM_KEY,
    pilot_key: str | None = None,
    monitoring: bool = False,
    monitoring_type: str | None = None,
    monitoring_task_id: str | None = None,
    target_external_id: str | None = None,
    target_entity_id: str | None = None,
    content: bool = False,
) -> dict[str, Any]:
    """Run one pilot day for a single configured market/platform scope."""
    market_code = str(market_code or MARKET_CODE).strip().upper()
    platform_key = str(platform_key or PLATFORM_KEY).strip().lower()
    pilot_key = str(pilot_key or f"{platform_key}-{market_code.lower()}-pilot").strip()
    if content and not pilot_key.endswith("-content-pilot"):
        pilot_key = f"{pilot_key.removesuffix('-pilot')}-content-pilot"
    if not re.fullmatch(r"[A-Za-z0-9._:-]+", pilot_key):
        raise TikHubPilotError("invalid pilot key")
    if monitoring:
        monitoring_type = str(monitoring_type or "keyword").strip().lower()
        if monitoring_type not in {"keyword", "product", "shop"}:
            raise TikHubPilotError("monitoring type must be keyword, product or shop")
        if monitoring_type in {"product", "shop"} and not (target_external_id or target_entity_id):
            raise TikHubPilotError(f"{monitoring_type} monitoring requires a target ID")
        if not monitoring_task_id or not re.fullmatch(r"[A-Za-z0-9._:-]+", str(monitoring_task_id)):
            raise TikHubPilotError("monitoring task ID is required and must be safe")
        if monitoring_type in {"product", "shop"} and not keywords:
            keywords = [target_external_id or target_entity_id or ""]
    selected_keywords = validate_keywords(keywords, require_twenty=not monitoring)
    if monitoring and monitoring_type == "keyword" and len(selected_keywords) != 1:
        raise TikHubPilotError("keyword monitoring requires exactly one keyword")
    day = _date_value(run_date)
    fixture: dict[str, Any] | None = None
    if fixture_path:
        fixture = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
        if not isinstance(fixture, dict):
            raise TikHubPilotError("fixture must be a JSON object keyed by endpoint")
    if not fixture:
        try:
            assert_source_collectable(SOURCE_KEY)
        except SourceGovernanceError as error:
            raise TikHubPilotError(str(error)) from error
        api_key = os.environ.get("TIKHUB_API_KEY", "").strip()
        if not api_key:
            raise TikHubPilotError("TIKHUB_API_KEY is required and must be provided as a Worker Secret")
        if os.environ.get("TIKHUB_PILOT_ENABLED", "false").strip().casefold() != "true":
            raise TikHubPilotError("TikHub pilot is disabled; set TIKHUB_PILOT_ENABLED=true after endpoint and authorization review")
    else:
        api_key = os.environ.get("TIKHUB_API_KEY", "fixture-key")

    if content and monitoring:
        raise TikHubPilotError("content collection cannot be combined with workspace monitoring")
    endpoint_keys = (CONTENT_ENDPOINTS if content else
                     MONITOR_ENDPOINTS.get(monitoring_type, ALLOWED_ENDPOINTS) if monitoring else ALLOWED_ENDPOINTS)
    endpoints = {key: resolve_endpoint(key, fixture=bool(fixture)) for key in endpoint_keys}
    if not dry_run and writer is None:
        writer = SupabaseWriter()
    if not dry_run and writer is None:
        raise TikHubPilotError("a Supabase service writer is required")

    pilot_run_id = f"monitoring:{monitoring_task_id}:{day}" if monitoring else f"{pilot_key}:{day}"
    started_at = iso_now()
    collector_name = "tikhub_content" if content else "tikhub_pilot"
    fetch_run_id = history_uuid("source-fetch-run", pilot_run_id, collector_name)
    fetch_run = {
        "id": fetch_run_id, "run_id": pilot_run_id, "source_key": SOURCE_KEY,
        "collector_key": "tikhub_content" if content else "tikhub_pilot",
        "domain": "content" if content else "product", "status": "running",
        "scope": {"market_codes": [market_code], "platform_keys": [platform_key], "keyword_count": len(selected_keywords)},
        "started_at": started_at, "completed_at": started_at, "request_count": 0,
        "successful_requests": 0, "failed_requests": 0, "records_collected": 0,
        "records_in_scope": 0, "errors": [], "result": {},
    }
    if writer:
        writer.upsert("tikhub_pilot_runs", [{
            "pilot_key": pilot_key, "pilot_run_id": pilot_run_id, "run_date": day,
            "monitoring_task_id": monitoring_task_id if monitoring else None,
            "status": "running", "started_at": started_at, "keyword_count": len(selected_keywords),
        }], "pilot_key,run_date,monitoring_task_id" if monitoring else "pilot_key,run_date")

    events: list[dict[str, Any]] = []
    raw_rows: list[dict[str, Any]] = []
    product_entities: dict[str, dict[str, Any]] = {}
    shop_entities: dict[str, dict[str, Any]] = {}
    product_snapshots: dict[str, dict[str, Any]] = {}
    shop_snapshots: dict[str, dict[str, Any]] = {}
    content_entities: dict[str, dict[str, Any]] = {}
    content_snapshots: dict[str, dict[str, Any]] = {}
    seen_stable: Counter[str] = Counter()
    cost_per_request = max(float(os.environ.get("TIKHUB_DEFAULT_COST_USD", DEFAULT_COST_USD)), 0.0)
    request_timeout = int(timeout or os.environ.get("TIKHUB_REQUEST_TIMEOUT_SECONDS", "120"))
    request_count = 0
    success_count = 0
    missing_count = 0
    duplicate_count = 0

    request_limit = len(selected_keywords) * len(endpoint_keys)
    for keyword in selected_keywords:
        for endpoint_key in endpoint_keys:
            request_count += 1
            if request_count > request_limit:
                raise TikHubPilotError("TikHub request count exceeded the selected monitoring budget")
            endpoint = endpoints[endpoint_key]
            request_key = keyword or target_external_id or target_entity_id or ""
            parameters = _endpoint_parameters(
                endpoint_key, request_key, market_code, platform_key,
                monitoring_type=monitoring_type if monitoring else None,
                target_external_id=target_external_id if monitoring else None,
                target_entity_id=target_entity_id if monitoring else None,
            )
            parameters_hash = _json_hash(parameters)
            requested_at = iso_now()
            started = time.monotonic()
            response_status = 0
            response_body = b""
            error_code = None
            payload: Any = None
            records: list[dict[str, Any]] = []
            try:
                if fixture:
                    payload = _fixture_response(fixture, endpoint_key, keyword)
                    response_body = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
                    response_status = 200
                else:
                    response_status, response_body = _request_endpoint(
                        endpoint, parameters, api_key, timeout=request_timeout, opener=opener,
                    )
                    if response_status >= 200 and response_status < 300:
                        payload = json.loads(response_body.decode("utf-8"))
                    else:
                        error_code = f"HTTP_{response_status}"
            except (UnicodeDecodeError, json.JSONDecodeError):
                error_code = "INVALID_JSON"
            except TikHubPilotError as error:
                error_code = "NETWORK_ERROR"
                response_body = b""
                endpoint_error = _safe_text(error)
            else:
                endpoint_error = None
            response_hash = hashlib.sha256(response_body).hexdigest() if response_body else None
            artifact_id = None
            if response_body and writer and not dry_run:
                artifact = upload_private_bytes(
                    writer.url, writer.key, response_body,
                    run_id=pilot_run_id, source_key=SOURCE_KEY, artifact_kind="raw_response",
                    retention_days=30, original_name=f"{_safe_segment(endpoint_key)}-{_safe_segment(keyword)}.json",
                    content_type="application/json",
                    metadata={"endpoint_key": endpoint_key, "request_parameters_hash": parameters_hash,
                              "response_hash": response_hash, "response_status": response_status,
                              "pilot_run_id": pilot_run_id, "keyword_hash": _json_hash(keyword)},
                )
                artifact_id = writer.find_artifact_id(artifact["bucket_id"], artifact["object_path"])
            normalized = []
            event_missing = 0
            event_duplicates = 0
            if payload is not None and response_status >= 200 and response_status < 300:
                records = _records_from_payload(payload)
                for index, record in enumerate(records):
                    standard = normalize_record(record, endpoint_key, keyword, market_code, platform_key)
                    normalized.append(standard)
                    stable = (standard.get("platform_product_id") or standard.get("platform_shop_id")
                              or standard.get("platform_content_id"))
                    if not stable:
                        event_missing += 1
                        continue
                    stable_key = f"{standard['snapshot_type']}:{stable}"
                    seen_stable[stable_key] += 1
                    if seen_stable[stable_key] > 1:
                        event_duplicates += 1
                    source_record_id = f"{pilot_run_id}:{endpoint_key}:{keyword}:{index}:{stable}"
                    raw_id = history_uuid("raw-source-record", SOURCE_KEY, source_record_id, response_hash or _json_hash(standard))
                    raw_rows.append(_raw_row(standard, source_record_id=source_record_id,
                                             response_hash=response_hash or _json_hash(standard), collected_at=requested_at,
                                             raw_source_record_id=raw_id, source_fetch_run_id=fetch_run_id,
                                             pilot_run_id=pilot_run_id, market_code=market_code,
                                             platform_key=platform_key))
                    entity, snapshot, info = _history_rows(
                        standard, raw_id, response_hash or _json_hash(standard), requested_at,
                        market_code, platform_key
                    )
                    if info["snapshot_type"] == "product":
                        product_entities[entity["id"]] = entity
                        product_snapshots[snapshot["id"]] = snapshot
                    elif info["snapshot_type"] == "shop":
                        shop_entities[entity["id"]] = entity
                        shop_snapshots[snapshot["id"]] = snapshot
                    else:
                        content_entities[entity["id"]] = entity
                        content_snapshots[snapshot["id"]] = snapshot
                if not records:
                    error_code = error_code or "EMPTY_RESPONSE"
                if not error_code:
                    success_count += 1
            else:
                event_missing = 0
            missing_count += event_missing
            duplicate_count += event_duplicates
            if normalized:
                records_collected = len(normalized) - event_missing
            else:
                records_collected = 0
            if response_status >= 200 and response_status < 300 and payload is None:
                error_code = error_code or "EMPTY_RESPONSE"
            duration_ms = max(int((time.monotonic() - started) * 1000), 0)
            event = {
                "pilot_run_id": pilot_run_id, "endpoint_key": endpoint_key, "keyword": keyword,
                "endpoint_url": endpoint["url"], "request_parameters_hash": parameters_hash,
                "requested_at": requested_at, "completed_at": iso_now(), "response_status": response_status,
                "success": bool(response_status >= 200 and response_status < 300 and not error_code),
                "response_hash": response_hash, "raw_artifact_id": artifact_id,
                "item_count": len(records),
                "standard_record_count": len(normalized) - event_missing,
                "missing_count": event_missing, "duplicate_count": event_duplicates,
                "estimated_cost_usd": cost_per_request, "duration_ms": duration_ms,
                "error_code": error_code, "cookie_used": bool(endpoint.get("requires_cookie")),
            }
            events.append(event)

    failed_count = request_count - success_count
    status = "succeeded" if failed_count == 0 else ("degraded" if success_count else "failed")
    completed_at = iso_now()
    report = {
        "field_mapping_snapshot": _standard_fields_snapshot(),
        "missing_rate": round(missing_count / max(sum(event["standard_record_count"] + event["missing_count"] for event in events), 1), 6),
        "duplicate_rate": round(duplicate_count / max(sum(event["standard_record_count"] for event in events) + duplicate_count, 1), 6),
        "success_rate": round(success_count / max(request_count, 1), 6),
        "product_trend_count": len(product_snapshots), "shop_trend_count": len(shop_snapshots),
        "content_trend_count": len(content_snapshots),
        "authorization_summary": {"source_kind": SOURCE_KIND, "source_category": SOURCE_CATEGORY,
                                   "commercial_authorized": False, "public_display_allowed": False},
    }
    fetch_run.update({
        "status": status, "completed_at": completed_at, "request_count": request_count,
        "successful_requests": success_count, "failed_requests": failed_count,
        "records_collected": len(raw_rows), "records_in_scope": len(raw_rows),
        "errors": [event["error_code"] for event in events if event.get("error_code")], "result": report,
    })
    if writer and not dry_run:
        # source_fetch_runs is append-only in permanent history.  Insert the
        # completed ledger once, before raw rows reference its immutable ID.
        writer.insert("source_fetch_runs", [fetch_run], "run_id,collector_key")
        writer.insert("tikhub_fetch_events", events,
                      "pilot_run_id,endpoint_key,keyword,request_parameters_hash")
        writer.insert("raw_source_records", raw_rows, "source_key,source_record_id,evidence_hash")
        writer.upsert("product_entities", list(product_entities.values()), "source_key,platform_key,platform_product_id,market_code")
        writer.upsert("shop_entities", list(shop_entities.values()), "source_key,platform_key,platform_shop_id,market_code")
        writer.upsert("content_entities", list(content_entities.values()), "source_key,platform_key,platform_content_id,market_code")
        writer.insert("product_snapshots", list(product_snapshots.values()), "id")
        writer.insert("shop_snapshots", list(shop_snapshots.values()), "id")
        writer.insert("content_snapshots", list(content_snapshots.values()), "id")
        writer.update("tikhub_pilot_runs", {"pilot_run_id": f"eq.{pilot_run_id}"}, {
            "status": status, "completed_at": completed_at, "request_count": request_count,
            "successful_requests": success_count, "failed_requests": failed_count,
            "records_collected": len(raw_rows), "missing_count": missing_count,
            "duplicate_count": duplicate_count, "estimated_cost_usd": round(request_count * cost_per_request, 6),
            "report": report,
        })
    return {
        "pilot_key": pilot_key, "pilot_run_id": pilot_run_id, "run_date": day,
        "market_code": market_code, "platform_key": platform_key, "status": status,
        "monitoring": monitoring,
        "monitoring_task_id": monitoring_task_id if monitoring else None,
        "keyword_count": len(selected_keywords), "request_count": request_count,
        "successful_requests": success_count, "failed_requests": failed_count,
        "records_collected": len(raw_rows), "missing_count": missing_count,
        "duplicate_count": duplicate_count, "estimated_cost_usd": round(request_count * cost_per_request, 6),
        "report": report,
        "content_trend_count": len(content_snapshots),
    }


def _blocked_scope_result(scope: Mapping[str, Any], day: str) -> dict[str, Any]:
    """Return an auditable result for an active launch market without an adapter."""
    market_code = str(scope.get("market_code") or "").upper()
    platform_key = str(scope.get("platform_key") or PLATFORM_KEY).lower()
    pilot_key = f"{platform_key}-{market_code.lower()}-pilot"
    return {
        "pilot_key": pilot_key, "pilot_run_id": f"{pilot_key}:{day}", "run_date": day,
        "market_code": market_code, "platform_key": platform_key, "status": "blocked",
        "scope_status": scope.get("scope_status") or "schema_only", "data_status": scope.get("data_status") or "schema_only",
        "reason": scope.get("reason") or "market/platform adapter is not configured",
        "keyword_count": 0, "request_count": 0, "successful_requests": 0,
        "failed_requests": 0, "records_collected": 0, "missing_count": 0,
        "duplicate_count": 0, "estimated_cost_usd": 0,
        "report": {"coverage_status": "schema_only", "market_code": market_code,
                    "platform_key": platform_key, "public_display_allowed": False},
    }


def _persist_blocked_scope(writer: SupabaseWriter, result: Mapping[str, Any]) -> None:
    """Persist a zero-request coverage record for schema-only launch scopes."""
    writer.upsert("tikhub_pilot_runs", [{
        "pilot_key": result["pilot_key"], "pilot_run_id": result["pilot_run_id"],
        "run_date": result["run_date"], "status": "blocked", "started_at": iso_now(),
        "completed_at": iso_now(), "keyword_count": 0, "request_count": 0,
        "successful_requests": 0, "failed_requests": 0, "records_collected": 0,
        "missing_count": 0, "duplicate_count": 0, "estimated_cost_usd": 0,
        "report": result["report"],
    }], "pilot_key,run_date")


def collect_pilot(
    *,
    run_date: str | None = None,
    keywords: Sequence[str] | None = None,
    fixture_path: str | None = None,
    dry_run: bool = False,
    writer: SupabaseWriter | None = None,
    opener: Callable[..., Any] = urlopen,
    timeout: int | None = None,
    market_code: str | None = None,
    platform_key: str | None = None,
    monitoring: bool = False,
    monitoring_type: str | None = None,
    monitoring_task_id: str | None = None,
    target_external_id: str | None = None,
    target_entity_id: str | None = None,
    content: bool = False,
) -> dict[str, Any]:
    """Run the pilot for every executable launch-market scope.

    A task may pin one scope (used by the Worker); an unpinned invocation
    discovers all active, configured scopes from ``market_scope.json``.  A
    schema-only market produces a blocked coverage record and zero provider
    requests, making the absence visible without claiming collection.
    """
    day = _date_value(run_date)
    manifest = load_market_scope()
    requested_markets = [market_code] if market_code else None
    requested_platforms = [platform_key] if platform_key else None
    scopes = resolve_market_scopes(manifest, market_codes=requested_markets, platform_keys=requested_platforms)
    if not scopes:
        raise TikHubPilotError("no active launch market is registered for TikHub collection")
    if monitoring and (not market_code or not monitoring_task_id):
        raise TikHubPilotError("monitoring runs must pin one market and monitoring task ID")
    if content and monitoring:
        raise TikHubPilotError("content collection cannot be combined with workspace monitoring")
    if market_code or platform_key:
        scope = next((item for item in scopes if item["market_code"] == str(market_code or item["market_code"]).upper()
                      and item["platform_key"] == str(platform_key or item["platform_key"]).lower()), scopes[0])
        if not scope.get("executable"):
            result = _blocked_scope_result(scope, day)
            if writer and not dry_run:
                _persist_blocked_scope(writer, result)
            return result
        return _collect_pilot_scope(run_date=day, keywords=keywords, fixture_path=fixture_path,
                                    dry_run=dry_run, writer=writer, opener=opener, timeout=timeout,
                                    market_code=scope["market_code"], platform_key=scope["platform_key"],
                                    pilot_key=f"{scope['platform_key']}-{scope['market_code'].lower()}-pilot",
                                    monitoring=monitoring, monitoring_type=monitoring_type,
                                    monitoring_task_id=monitoring_task_id,
                                    target_external_id=target_external_id, target_entity_id=target_entity_id,
                                    content=content)

    results = []
    for scope in scopes:
        if not scope.get("executable"):
            result = _blocked_scope_result(scope, day)
            if writer and not dry_run:
                _persist_blocked_scope(writer, result)
            results.append(result)
            continue
        results.append(_collect_pilot_scope(run_date=day, keywords=keywords, fixture_path=fixture_path,
                                            dry_run=dry_run, writer=writer, opener=opener, timeout=timeout,
                                            market_code=scope["market_code"], platform_key=scope["platform_key"],
                                            pilot_key=f"{scope['platform_key']}-{scope['market_code'].lower()}-pilot",
                                            monitoring=monitoring, monitoring_type=monitoring_type,
                                            monitoring_task_id=monitoring_task_id,
                                            target_external_id=target_external_id, target_entity_id=target_entity_id,
                                            content=content))
    if len(results) == 1:
        return results[0]
    executable = [item for item in results if item["status"] != "blocked"]
    # Preserve the historical single-scope response shape when the launch
    # catalog currently has one executable market plus schema-only markets.
    # Coverage remains attached so callers can still render every market.
    if len(executable) == 1:
        primary = dict(executable[0])
        primary["scope_count"] = len(results)
        primary["scopes"] = results
        primary["coverage"] = {
            "configured": [item["market_code"] for item in executable],
            "schema_only": [item["market_code"] for item in results if item["status"] == "blocked"],
        }
        return primary
    return {
        "status": "succeeded" if executable and all(item["status"] == "succeeded" for item in executable) else
                  ("degraded" if executable else "blocked"),
        "scope_count": len(results), "scopes": results,
        "market_codes": [item["market_code"] for item in results],
        "platform_keys": [item["platform_key"] for item in results],
        "request_count": sum(item["request_count"] for item in results),
        "successful_requests": sum(item["successful_requests"] for item in results),
        "failed_requests": sum(item["failed_requests"] for item in results),
        "records_collected": sum(item["records_collected"] for item in results),
        "estimated_cost_usd": round(sum(item["estimated_cost_usd"] for item in results), 6),
        "coverage": {"configured": [item["market_code"] for item in executable],
                     "schema_only": [item["market_code"] for item in results if item["status"] == "blocked"]},
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the private TikHub launch-market pilot")
    parser.add_argument("--run-date", help="UTC pilot day YYYY-MM-DD")
    parser.add_argument("--keywords-json", help="exactly 20 keyword strings")
    parser.add_argument("--market-code", help="pin one active launch market, e.g. US or ID")
    parser.add_argument("--platform", dest="platform_key", help="pin one supported platform scope")
    parser.add_argument("--monitoring", action="store_true", help="run one workspace monitoring target")
    parser.add_argument("--monitoring-type", choices=("keyword", "product", "shop"))
    parser.add_argument("--monitoring-task-id")
    parser.add_argument("--target-external-id")
    parser.add_argument("--target-entity-id")
    parser.add_argument("--content", action="store_true", help="采集视频、达人、商品关联和互动指标快照")
    parser.add_argument("--fixture", help="offline JSON fixture; never used for production collection")
    parser.add_argument("--dry-run", action="store_true", help="validate and collect without persistence")
    parser.add_argument("--report", action="store_true", help="build and persist the private seven-day report")
    args = parser.parse_args(argv)
    try:
        keywords = json.loads(args.keywords_json) if args.keywords_json else None
        if keywords is not None and not isinstance(keywords, list):
            raise TikHubPilotError("--keywords-json must be a JSON array")
        if args.report:
            if args.dry_run or args.fixture or keywords:
                raise TikHubPilotError("--report cannot be combined with fixture, dry-run, or keywords")
            market = str(args.market_code or MARKET_CODE).strip().upper()
            platform = str(args.platform_key or PLATFORM_KEY).strip().lower()
            result = generate_seven_day_report(
                SupabaseWriter(), period_from=args.run_date,
                pilot_key=f"{platform}-{market.lower()}-pilot",
                market_code=market, platform_key=platform,
            )
        else:
            result = collect_pilot(run_date=args.run_date, keywords=keywords, fixture_path=args.fixture,
                                   dry_run=args.dry_run, market_code=args.market_code,
                                   platform_key=args.platform_key, monitoring=args.monitoring,
                                   monitoring_type=args.monitoring_type,
                                   monitoring_task_id=args.monitoring_task_id,
                                   target_external_id=args.target_external_id,
                                   target_entity_id=args.target_entity_id,
                                   content=args.content)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (TikHubPilotError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"[tikhub-pilot] {_safe_text(error)}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
