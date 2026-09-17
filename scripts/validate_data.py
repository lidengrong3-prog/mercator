#!/usr/bin/env python3
"""Validate publishable market data and emit a machine-readable quality report."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable
from urllib.parse import urlparse


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
DEFAULT_REPORT = os.path.join(DATA_DIR, "quality_report.json")
SCOPE_MANIFEST = os.path.join(DATA_DIR, "market_scope.json")
PROVENANCE_SCHEMA = os.path.join(DATA_DIR, "provenance_schema.json")
COLLECTION_RUN = os.path.join(DATA_DIR, "collection_run.json")
UTC = timezone.utc

# Data provenance is deliberately kept small and explicit.  These values are
# shared with the browser data layer and the Supabase applicability table.
SOURCE_KINDS = ("official", "traceable", "uploaded", "derived", "demo")
VERIFICATION_STATUSES = ("verified", "uploaded", "pending", "rejected")
SOURCE_TYPES = (
    "government",
    "regulator",
    "platform",
    "official_feed",
    "industry_association",
    "licensed_provider",
    "user_upload",
    "derived",
    "demo",
    "unknown",
)
PROVENANCE_REQUIRED_DOMAINS = {"policy", "tax", "access", "rule", "alert", "cpsc"}
OFFICIAL_HOST_SUFFIXES = (".gov", ".mil", ".gov.cn", ".europa.eu")
OFFICIAL_HOSTS = {
    "gov",
    "mil",
    "federalregister.gov",
    "ustr.gov",
    "cpsc.gov",
    "saferproducts.gov",
    "sellercentral.amazon.com",
    "seller.tiktokshopglobalselling.com",
    "sellercenter.lazada.sg",
    "seller.shopee.sg",
}
ADVISORY_HOSTS = {"cifnews.com", "www.cifnews.com", "amz123.com", "www.amz123.com"}

ZH_RE = re.compile(r"[\u3400-\u9fff]")
TAX_TYPES = {"customs_duty", "vat", "sales_tax", "marketplace_collection", "import_fee"}
ACCESS_REQUIREMENT_TYPES = {
    "certification", "labeling", "packaging", "registration",
    "intellectual_property", "import_requirement",
}


def contains_chinese(value: Any) -> bool:
    return bool(ZH_RE.search(str(value or "")))


def regulatory_source_hash(item: dict[str, Any]) -> str:
    payload = json.dumps(
        {"title": item.get("title") or "", "summary": item.get("summary") or ""},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def has_current_chinese_display(item: dict[str, Any]) -> bool:
    translation = item.get("translation") if isinstance(item.get("translation"), dict) else {}
    return (
        contains_chinese(item.get("title_zh"))
        and (not item.get("summary") or contains_chinese(item.get("summary_zh")))
        and translation.get("status") in {"source_zh", "translated", "reviewed"}
        and translation.get("source_hash") == regulatory_source_hash(item)
    )


def load_scope_manifest() -> dict[str, Any]:
    """Load the publish-time scope manifest, with a conservative US fallback."""
    fallback = {
        "default_market_codes": ["US"],
        "markets": [{"code": "US", "key": "us", "name": "美国", "aliases": ["美国", "US"]}],
        "platforms": [
            {"key": "amazon", "name": "Amazon", "aliases": ["amazon"]},
            {"key": "tiktok-shop", "name": "TikTok Shop", "aliases": ["tiktok shop"]},
            {"key": "aliexpress", "name": "AliExpress", "aliases": ["aliexpress", "速卖通"]},
            {"key": "ebay", "name": "eBay", "aliases": ["ebay"]},
        ],
    }
    try:
        with open(SCOPE_MANIFEST, "r", encoding="utf-8") as handle:
            loaded = json.load(handle)
        if isinstance(loaded, dict) and isinstance(loaded.get("markets"), list) and isinstance(loaded.get("platforms"), list):
            return loaded
    except (OSError, json.JSONDecodeError):
        pass
    return fallback


SCOPE_MANIFEST_DATA = load_scope_manifest()
SCOPE_MARKET_CODES = {
    str(item.get("code", "")).strip().upper()
    for item in SCOPE_MANIFEST_DATA.get("markets", [])
    if isinstance(item, dict) and str(item.get("code", "")).strip()
}
SCOPE_MARKET_KEYS = {
    str(item.get("key", "")).strip().casefold()
    for item in SCOPE_MANIFEST_DATA.get("markets", [])
    if isinstance(item, dict) and str(item.get("key", "")).strip()
}
SCOPE_MARKET_NAMES = {
    str(value).strip().casefold()
    for item in SCOPE_MANIFEST_DATA.get("markets", [])
    if isinstance(item, dict)
    for value in [item.get("name"), item.get("label"), *(item.get("aliases") or [])]
    if str(value or "").strip()
}
SCOPE_MARKET_ALIASES = {
    str(value).strip().casefold(): str(item.get("code", "")).strip().upper()
    for item in SCOPE_MANIFEST_DATA.get("markets", [])
    if isinstance(item, dict) and str(item.get("code", "")).strip()
    for value in [item.get("code"), item.get("key"), item.get("name"), item.get("label"), *(item.get("aliases") or [])]
    if str(value or "").strip()
}
SCOPE_PLATFORM_NAMES = {
    str(item.get("name", "")).strip()
    for item in SCOPE_MANIFEST_DATA.get("platforms", [])
    if isinstance(item, dict) and str(item.get("name", "")).strip()
}
SCOPE_PLATFORM_ALIASES = {
    str(value).strip().casefold(): str(item.get("name") or item.get("key") or "").strip()
    for item in SCOPE_MANIFEST_DATA.get("platforms", [])
    if isinstance(item, dict) and str(item.get("key") or "").strip()
    for value in [item.get("key"), item.get("name"), *(item.get("aliases") or [])]
    if str(value or "").strip()
}
SCOPE_PLATFORMS = SCOPE_PLATFORM_NAMES or {"Amazon", "TikTok Shop", "AliExpress", "eBay"}
# The manifest can describe markets that are available for a future user
# selection.  Validation totals, however, must remain aligned with the
# publish-time default scope until an operator explicitly selects another
# market.  Keep the complete catalog above for normalization and use these
# derived values for "current scope" counters.
DEFAULT_SCOPE_MARKET_CODES = {
    str(code).strip().upper()
    for code in (SCOPE_MANIFEST_DATA.get("default_market_codes") or ["US"])
    if str(code).strip()
}
DEFAULT_SCOPE_MARKET_NAMES = {
    str(value).strip().casefold()
    for item in SCOPE_MANIFEST_DATA.get("markets", [])
    if isinstance(item, dict) and str(item.get("code", "")).strip().upper() in DEFAULT_SCOPE_MARKET_CODES
    for value in [item.get("code"), item.get("key"), item.get("name"), item.get("label"), *(item.get("aliases") or [])]
    if str(value or "").strip()
}
DEFAULT_SCOPE_PLATFORM_KEYS = {
    str(item.get("platform_key") or item.get("platformKey") or "").strip().casefold()
    for item in (SCOPE_MANIFEST_DATA.get("market_platforms") or SCOPE_MANIFEST_DATA.get("marketPlatforms") or [])
    if isinstance(item, dict)
    and str(item.get("market_code") or item.get("marketCode") or "").strip().upper() in DEFAULT_SCOPE_MARKET_CODES
    and str(item.get("platform_key") or item.get("platformKey") or "").strip()
    and str(item.get("status") or "active").strip().casefold() == "active"
    and str(item.get("data_status") or item.get("dataStatus") or "").strip().casefold() == "configured"
}
DEFAULT_SCOPE_PLATFORMS = {
    str(item.get("name", "")).strip()
    for item in SCOPE_MANIFEST_DATA.get("platforms", [])
    if isinstance(item, dict)
    and str(item.get("key", "")).strip().casefold() in DEFAULT_SCOPE_PLATFORM_KEYS
    and str(item.get("name", "")).strip()
} or {"Amazon", "TikTok Shop", "AliExpress", "eBay"}
DEFAULT_SCOPE_CATEGORY_CODES = {
    str(code).strip().casefold()
    for market in SCOPE_MANIFEST_DATA.get("markets", [])
    if isinstance(market, dict)
    and str(market.get("code") or "").strip().upper() in DEFAULT_SCOPE_MARKET_CODES
    for code in (market.get("category_keys") or market.get("categoryKeys") or [])
    if str(code or "").strip()
}
SCOPE_CATEGORY_CODES = {
    str(row.get("code") or "").strip().casefold()
    for row in SCOPE_MANIFEST_DATA.get("categories", [])
    if isinstance(row, dict)
    and str(row.get("code") or "").strip()
    and str(row.get("status") or "active").strip().casefold() == "active"
}
DEFAULT_SCOPE_CATEGORY_CODES &= SCOPE_CATEGORY_CODES
# Backward-compatible names for existing collectors and tests.
SCOPE_COUNTRY_CODE = next(iter(sorted(DEFAULT_SCOPE_MARKET_CODES)), "US")
SCOPE_COUNTRY_KEY = next(iter(sorted(DEFAULT_SCOPE_MARKET_NAMES)), "us")
SCOPE_COUNTRY_NAMES = {SCOPE_COUNTRY_CODE, *(name for name in DEFAULT_SCOPE_MARKET_NAMES if name)}


def is_scope_market(value: Any) -> bool:
    raw = str(value or "").strip()
    return bool(raw) and (raw.upper() in SCOPE_MARKET_CODES or raw.casefold() in SCOPE_MARKET_NAMES or raw.casefold() in SCOPE_MARKET_KEYS)


def is_current_scope_market(value: Any) -> bool:
    """Match only the markets in the manifest's default/publish-time scope."""
    raw = str(value or "").strip()
    return bool(raw) and (raw.upper() in DEFAULT_SCOPE_MARKET_CODES or raw.casefold() in DEFAULT_SCOPE_MARKET_NAMES)
# CPSC publishes on business days and its public API is commonly unavailable
# over weekends. Keep a strict three-day ceiling without fabricating freshness.
CPSC_MAX_AGE_HOURS = 72


DATASET_LABELS = {
    "quality_report": "数据质量报告",
    "market_scope": "公开市场范围",
    "collection_run": "采集运行状态",
    "policies": "政策动态",
    "taxes": "税收与关税",
    "access_requirements": "市场准入",
    "rules": "平台规则",
    "alerts": "风险预警",
    "countries": "国家市场",
    "platforms": "平台档案",
    "us_market": "美国品类情报",
    "macro": "美国宏观指标",
    "cpsc": "CPSC 产品召回",
    "industry_advisories": "行业资讯",
}

PUBLIC_PROJECTION_FILES = {
    "market_scope": "market_scope.json",
    "countries": "countries.json",
    "platforms": "platforms.json",
    "policies": "policies.json",
    "rules": "rules.json",
    "alerts": "alerts.json",
    "taxes": "taxes.json",
    "access_requirements": "access_requirements.json",
    "industry_advisories": "industry_advisories.json",
    "macro": os.path.join("us_market", "macro_indicators.json"),
}


@dataclass
class DatasetResult:
    key: str
    path: str
    records: int = 0
    scoped_records: int = 0
    formal_records: int = 0
    demo_records: int = 0
    unverified_records: int = 0
    missing_source_records: int = 0
    excluded_records: int = 0
    exclusion_reasons: dict[str, int] = field(default_factory=dict)
    updated_at: str | None = None
    freshness_hours: float | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    connected: bool | None = None

    @property
    def status(self) -> str:
        if self.errors:
            if all("超过新鲜度阈值" in error for error in self.errors):
                return "stale"
            return "failed"
        if self.connected is False:
            return "not_connected"
        if any("超过新鲜度阈值" in warning for warning in self.warnings):
            return "stale"
        if self.warnings:
            return "degraded"
        return "healthy"

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": DATASET_LABELS[self.key],
            "status": self.status,
            "path": self.path.replace("\\", "/"),
            "records": self.records,
            "raw_records": self.records,
            "scoped_records": self.scoped_records,
            "formal_records": self.formal_records,
            "demo_records": self.demo_records,
            "unverified_records": self.unverified_records,
            "missing_source_records": self.missing_source_records,
            "excluded_records": self.excluded_records,
            "exclusion_reasons": self.exclusion_reasons,
            "updated_at": self.updated_at,
            "freshness_hours": self.freshness_hours,
            "connected": self.connected,
            "errors": self.errors,
            "warnings": self.warnings,
            "metrics": self.metrics,
        }


def load_json(path: str, result: DatasetResult) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        result.errors.append("文件不存在")
    except json.JSONDecodeError as exc:
        result.errors.append(f"JSON 解析失败：第 {exc.lineno} 行第 {exc.colno} 列")
    except OSError as exc:
        result.errors.append(f"文件读取失败：{exc}")
    return None


def parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        try:
            parsed = datetime.strptime(text, "%Y-%m-%d")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def valid_http_url(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value.strip())
    # Formal evidence links must be encrypted.  Plain HTTP is not accepted as
    # a publication source even when it has a valid host.
    return parsed.scheme == "https" and bool(parsed.netloc)


def is_aggregate_alert(item: dict[str, Any]) -> bool:
    if str(item.get("lineage_type") or "").strip().casefold() == "aggregate":
        return True
    if item.get("aggregate_count") not in (None, ""):
        return True
    display = "\n".join(str(item.get(key) or "") for key in ("title", "detail"))
    return bool(re.search(r"(?:近|过去|窗口|统计)[^\n]{0,40}\d+\s*(?:起|条|项|次)", display))


def alert_evidence_hash(item: dict[str, Any]) -> str:
    payload = {
        "id": item.get("id", ""),
        "title": item.get("title", ""),
        "detail": item.get("detail", ""),
        "date": item.get("date", ""),
        "source": item.get("source", ""),
        "source_url": item.get("source_url", ""),
        "source_record_id": item.get("source_record_id", ""),
        "source_record_ids": item.get("source_record_ids", []),
        "upstream_evidence_hash": item.get("upstream_evidence_hash", ""),
        "upstream_evidence_hashes": item.get("upstream_evidence_hashes", []),
        "source_record_evidence": item.get("source_record_evidence", []),
        "published_at": item.get("published_at", ""),
        "lineage_type": item.get("lineage_type", ""),
        "input_dataset": item.get("input_dataset", ""),
        "dataset_snapshot_id": item.get("dataset_snapshot_id", ""),
        "dataset_snapshot_at": item.get("dataset_snapshot_at", ""),
        "dataset_record_count": item.get("dataset_record_count"),
        "window_start": item.get("window_start", ""),
        "window_end": item.get("window_end", ""),
        "input_record_count": item.get("input_record_count"),
        "matched_record_count": item.get("matched_record_count"),
        "aggregate_count": item.get("aggregate_count"),
    }
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def alert_lineage_issues(item: dict[str, Any]) -> list[str]:
    required = (
        "lineage_type", "input_dataset", "dataset_snapshot_id", "dataset_snapshot_at",
        "dataset_record_count", "window_start", "window_end", "input_record_count",
        "matched_record_count", "source_record_ids", "upstream_evidence_hashes",
        "source_record_evidence",
    )
    issues = [field for field in required if item.get(field) in (None, "")]
    lineage_type = str(item.get("lineage_type") or "").strip().casefold()
    if lineage_type not in {"record", "aggregate"}:
        issues.append("lineage_type")
    if is_aggregate_alert(item) and lineage_type != "aggregate":
        issues.append("aggregate.lineage_type")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", str(item.get("dataset_snapshot_id") or "")):
        issues.append("dataset_snapshot_id")
    if not parse_datetime(item.get("dataset_snapshot_at")):
        issues.append("dataset_snapshot_at")
    window_start = parse_datetime(item.get("window_start"))
    window_end = parse_datetime(item.get("window_end"))
    if not window_start:
        issues.append("window_start")
    if not window_end:
        issues.append("window_end")
    if window_start and window_end and window_start > window_end:
        issues.append("window_range")
    counts = {
        key: item.get(key)
        for key in ("dataset_record_count", "input_record_count", "matched_record_count")
    }
    for key, value in counts.items():
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            issues.append(key)
    if all(isinstance(value, int) and not isinstance(value, bool) for value in counts.values()):
        if not counts["dataset_record_count"] >= counts["input_record_count"] >= counts["matched_record_count"]:
            issues.append("record_counts")
    record_ids = item.get("source_record_ids")
    hashes = item.get("upstream_evidence_hashes")
    evidence = item.get("source_record_evidence")
    matched_count = counts.get("matched_record_count")
    if not isinstance(record_ids, list) or not record_ids:
        issues.append("source_record_ids")
        record_ids = []
    if not isinstance(hashes, list) or not hashes:
        issues.append("upstream_evidence_hashes")
        hashes = []
    if not isinstance(evidence, list) or not evidence:
        issues.append("source_record_evidence")
        evidence = []
    if isinstance(matched_count, int) and not isinstance(matched_count, bool):
        if len(record_ids) != matched_count or len(hashes) != matched_count or len(evidence) != matched_count:
            issues.append("matched_record_count")
    normalized_ids = [str(value or "").strip() for value in record_ids]
    if any(not value for value in normalized_ids) or len(set(normalized_ids)) != len(normalized_ids):
        issues.append("source_record_ids")
    if any(not re.fullmatch(r"[0-9a-fA-F]{64}", str(value or "")) for value in hashes):
        issues.append("upstream_evidence_hashes")
    expected_evidence = [
        {"source_record_id": record_id, "evidence_hash": str(evidence_hash or "")}
        for record_id, evidence_hash in zip(normalized_ids, hashes)
    ]
    if evidence != expected_evidence:
        issues.append("source_record_evidence")
    if lineage_type == "record" and (
        matched_count != 1 or not normalized_ids or str(item.get("source_record_id") or "").strip() != normalized_ids[0]
    ):
        issues.append("record_lineage")
    if lineage_type == "aggregate":
        aggregate_count = item.get("aggregate_count")
        if isinstance(aggregate_count, bool) or not isinstance(aggregate_count, int) or aggregate_count != matched_count:
            issues.append("aggregate_count")
    if str(item.get("evidence_hash") or "").strip().casefold() != alert_evidence_hash(item):
        issues.append("evidence_hash_mismatch")
    return sorted(set(issues))


def is_industry_advisory(item: dict[str, Any]) -> bool:
    """Identify third-party industry articles that remain traceable only."""
    source_class = str(item.get("source_class") or item.get("sourceClass") or "").strip().casefold()
    source_name = str(item.get("source") or "").strip().casefold()
    url = source_url_for(item).casefold()
    host = (urlparse(url).hostname or "").casefold().rstrip(".")
    return (
        source_class == "industry_advisory"
        or host in ADVISORY_HOSTS
        or "雨果" in source_name
        or "amz123" in source_name
    )


def has_explicit_provenance(item: dict[str, Any]) -> bool:
    """Return whether a row carries the publish-time provenance envelope."""
    return isinstance(item, dict) and all(
        item.get(field) not in (None, "")
        for field in ("source_kind", "source_type", "source_record_id", "verification_status", "collected_at", "evidence_hash")
    )


def normalize_source_kind(value: Any) -> str:
    """Normalize source provenance labels from collectors and uploads."""
    raw = str(value or "").strip().casefold()
    aliases = {
        "official": "official",
        "官方": "official",
        "government": "official",
        "traceable": "traceable",
        "可追溯": "traceable",
        "platform": "traceable",
        "平台公告": "traceable",
        "uploaded": "uploaded",
        "upload": "uploaded",
        "人工上传": "uploaded",
        "derived": "derived",
        "计算": "derived",
        "派生": "derived",
        "demo": "demo",
        "mock": "demo",
        "演示": "demo",
        "示意": "demo",
    }
    return aliases.get(raw, raw if raw in SOURCE_KINDS else "")


def normalize_verification_status(value: Any, source_kind: str = "") -> str:
    """Normalize verification state without treating unknown values as valid."""
    raw = str(value or "").strip().casefold()
    aliases = {
        "verified": "verified",
        "verify": "verified",
        "pass": "verified",
        "通过": "verified",
        "已核验": "verified",
        "uploaded": "uploaded",
        "upload": "uploaded",
        "人工上传": "uploaded",
        "pending": "pending",
        "unverified": "pending",
        "待核验": "pending",
        "rejected": "rejected",
        "invalid": "rejected",
        "拒绝": "rejected",
    }
    if raw in aliases:
        return aliases[raw]
    if source_kind == "uploaded":
        return "uploaded"
    return ""


def normalize_source_type(value: Any) -> str:
    raw = str(value or "").strip().casefold().replace("-", "_").replace(" ", "_")
    aliases = {
        "official": "government",
        "gov": "government",
        "政府": "government",
        "监管机构": "regulator",
        "平台": "platform",
        "平台公告": "platform",
        "官方接口": "official_feed",
        "官方数据源": "official_feed",
        "人工上传": "user_upload",
        "上传": "user_upload",
        "派生": "derived",
        "计算": "derived",
        "演示": "demo",
    }
    normalized = aliases.get(raw, raw)
    return normalized if normalized in SOURCE_TYPES else ""


def source_url_for(item: dict[str, Any]) -> str:
    return str(item.get("source_url") or item.get("url") or "").strip()


def source_record_id_for(item: dict[str, Any]) -> str:
    value = item.get("source_record_id") or item.get("sourceRecordId")
    if value:
        return str(value).strip()
    # A source URL is a stable trace key even when a collector does not have a
    # publisher-assigned document number.
    url = source_url_for(item)
    return source_record_key(url) if valid_http_url(url) else ""


def is_official_source_url(value: Any) -> bool:
    if not valid_http_url(value):
        return False
    host = (urlparse(str(value).strip()).hostname or "").casefold().rstrip(".")
    return host in OFFICIAL_HOSTS or host.endswith(OFFICIAL_HOST_SUFFIXES)


def infer_source_kind(item: dict[str, Any]) -> str:
    # Advisory publishers are never promoted to official, even if a legacy
    # row contains an incorrect explicit label.
    if is_industry_advisory(item):
        return "traceable"
    explicit = normalize_source_kind(
        item.get("source_kind") or item.get("sourceKind") or item.get("provenance")
    )
    if explicit:
        return explicit
    quality = str(item.get("data_quality") or "").strip().casefold()
    if quality in {"demo", "demonstration", "mock", "演示", "示意"}:
        return "demo"
    if str(item.get("source_type") or "").strip().casefold() in {"user_upload", "uploaded"}:
        return "uploaded"
    url = source_url_for(item)
    if is_official_source_url(url):
        return "official"
    if valid_http_url(url) or source_record_id_for(item):
        return "traceable"
    return ""


def infer_verification_status(item: dict[str, Any], source_kind: str) -> str:
    if is_industry_advisory(item):
        return "pending"
    explicit = normalize_verification_status(
        item.get("verification_status")
        or item.get("verificationStatus")
        or item.get("verification"),
        source_kind,
    )
    if explicit:
        return explicit
    if item.get("source_verified") is False:
        return "pending"
    if source_kind == "demo":
        return "pending"
    # Legacy records predate the provenance envelope.  A valid URL plus both
    # collection and publication dates is treated as a compatibility hint;
    # the quality report still exposes how many records used this inference so
    # operators can migrate them to explicit fields.
    if source_kind in {"official", "traceable"} and valid_http_url(source_url_for(item)):
        if parse_datetime(item.get("collected_at")) and parse_datetime(item.get("published_at")):
            return "verified"
    if source_kind == "uploaded":
        return "uploaded"
    return "pending"


def effective_source_type(item: dict[str, Any], source_kind: str = "") -> str:
    """Return the contract source type, including a deterministic legacy hint."""
    if is_industry_advisory(item):
        return "licensed_provider"
    explicit = normalize_source_type(item.get("source_type") or item.get("sourceType"))
    if explicit:
        return explicit
    kind = source_kind or infer_source_kind(item)
    if kind == "official":
        source = f"{item.get('source', '')} {source_url_for(item)}".casefold()
        return "regulator" if "cpsc" in source or "consumer product safety" in source else "government"
    if kind == "traceable":
        return "platform" if item.get("platform") or item.get("platform_key") else (
            "licensed_provider" if valid_http_url(source_url_for(item)) else "unknown"
        )
    if kind == "uploaded":
        return "user_upload"
    if kind == "derived":
        return "derived"
    if kind == "demo":
        return "demo"
    return "unknown"


def record_scope_codes(item: dict[str, Any]) -> set[str]:
    values = (
        item.get("market_codes")
        or item.get("marketCodes")
        or item.get("markets")
        or item.get("market_code")
        or item.get("marketCode")
        or item.get("market")
        or item.get("region")
        or item.get("country")
        or item.get("jurisdiction_code")
        or item.get("jurisdictionCode")
        or item.get("jurisdiction")
    )
    if not isinstance(values, (list, tuple, set)):
        values = [values]
    codes = set()
    for value in values:
        raw = str(value or "").strip()
        if not raw:
            continue
        codes.add(SCOPE_MARKET_ALIASES.get(raw.casefold(), raw.upper()))
    return codes


def is_scoped_record(item: dict[str, Any]) -> bool:
    return bool(record_scope_codes(item) & DEFAULT_SCOPE_MARKET_CODES)


def record_platform_names(item: dict[str, Any], *, include_display_field: bool = False) -> set[str]:
    values = item.get("platform_keys") or item.get("platformKeys") or item.get("platform_key") or item.get("platformKey")
    if not values and include_display_field:
        values = item.get("platform") or item.get("platforms")
    if not isinstance(values, (list, tuple, set)):
        values = [values]
    return {normalize_platform(value) for value in values if str(value or "").strip()}


def record_category_codes(item: dict[str, Any]) -> set[str]:
    values = item.get("category_codes") or item.get("categoryCodes") or item.get("category_code") or item.get("categoryCode")
    if not isinstance(values, (list, tuple, set)):
        values = [values]
    return {str(value).strip().casefold() for value in values if str(value or "").strip()}


def record_quality(
    item: dict[str, Any],
    *,
    require_scope: bool = True,
    domain: str | None = None,
    require_provenance: bool = False,
) -> dict[str, Any]:
    """Return formal-publication state and machine-readable exclusion reasons."""
    if not isinstance(item, dict):
        return {"formal": False, "source_kind": "", "verification_status": "pending", "reasons": ["malformed"]}
    source_kind = infer_source_kind(item)
    verification_status = infer_verification_status(item, source_kind)
    reasons: list[str] = []
    quality = str(item.get("data_quality") or "").strip().casefold()
    if source_kind == "demo" or quality in {"demo", "demonstration", "mock", "演示", "示意"}:
        reasons.append("demo")
    if is_industry_advisory(item):
        reasons.append("industry_advisory")
    if verification_status not in {"verified", "uploaded"}:
        reasons.append("unverified")
    if not source_kind:
        reasons.append("missing_source_kind")
    if source_kind in {"official", "traceable", "derived"} and not (
        valid_http_url(source_url_for(item)) or source_record_id_for(item)
    ):
        reasons.append("missing_source")
    if source_kind == "uploaded" and not (
        source_record_id_for(item)
        or item.get("source_file")
        or item.get("evidence_hash")
    ):
        reasons.append("missing_upload_reference")
    if require_scope and not is_scoped_record(item):
        reasons.append("out_of_scope")
    explicit_platforms = record_platform_names(item, include_display_field=domain == "rule")
    if explicit_platforms and not explicit_platforms <= DEFAULT_SCOPE_PLATFORMS:
        reasons.append("out_of_scope_platform")
    explicit_categories = record_category_codes(item)
    if explicit_categories and not explicit_categories <= DEFAULT_SCOPE_CATEGORY_CODES:
        reasons.append("out_of_scope_category")
    required_domain = require_provenance or domain in PROVENANCE_REQUIRED_DOMAINS
    missing_fields: list[str] = []
    if required_domain:
        required_fields = ("source_kind", "source_type", "source_record_id", "verification_status", "collected_at", "published_at", "evidence_hash")
        missing_fields.extend(field for field in required_fields if item.get(field) in (None, ""))
        if item.get("source_type") not in (None, "") and not normalize_source_type(item.get("source_type")):
            missing_fields.append("source_type")
        if source_kind in {"official", "traceable"} and not valid_http_url(item.get("source_url")):
            missing_fields.append("source_url")
        for date_field in ("collected_at", "published_at"):
            if item.get(date_field) not in (None, "") and not parse_datetime(item.get(date_field)):
                missing_fields.append(date_field)
        if verification_status in {"verified", "uploaded"} and not parse_datetime(item.get("verified_at")):
            missing_fields.append("verified_at")
        evidence_hash = str(item.get("evidence_hash") or "").strip()
        if evidence_hash and not re.fullmatch(r"[0-9a-fA-F]{64}", evidence_hash):
            missing_fields.append("evidence_hash")
        if missing_fields:
            reasons.append("missing_provenance_fields")
    if domain == "alert":
        lineage_issues = alert_lineage_issues(item)
        if lineage_issues:
            reasons.append("invalid_alert_lineage")
            missing_fields.extend(f"lineage.{field}" for field in lineage_issues)
            if "missing_provenance_fields" not in reasons:
                reasons.append("missing_provenance_fields")
    return {
        "formal": not reasons,
        "source_kind": source_kind,
        "verification_status": verification_status,
        "reasons": reasons,
        "missing_provenance_fields": sorted(set(missing_fields)),
        "legacy_inferred": not has_explicit_provenance(item),
    }


def apply_record_quality_metrics(
    result: "DatasetResult",
    rows: list[dict[str, Any]],
    *,
    domain: str,
    scoped_predicate=None,
) -> None:
    """Populate the common source/verification counters for a dataset."""
    scoped_predicate = scoped_predicate or is_scoped_record
    reasons: dict[str, int] = {}
    scoped_rows = [row for row in rows if scoped_predicate(row)]
    result.scoped_records = len(scoped_rows)
    formal = demos = unverified = missing_source = legacy = 0
    for row in rows:
        in_scope = bool(scoped_predicate(row))
        quality = record_quality(
            row,
            require_scope=True,
            domain=domain,
            require_provenance=domain in PROVENANCE_REQUIRED_DOMAINS,
        )
        if not in_scope and "out_of_scope" not in quality["reasons"]:
            quality["reasons"].append("out_of_scope")
        if quality["formal"] and in_scope:
            formal += 1
        if "demo" in quality["reasons"]:
            demos += 1
        if "unverified" in quality["reasons"]:
            unverified += 1
        if any(reason in quality["reasons"] for reason in ("missing_source", "missing_source_kind", "missing_upload_reference", "missing_provenance_fields")):
            missing_source += 1
        if quality.get("legacy_inferred"):
            legacy += 1
        for reason in quality["reasons"]:
            reasons[reason] = reasons.get(reason, 0) + 1
    result.formal_records = formal
    result.demo_records = demos
    result.unverified_records = unverified
    result.missing_source_records = missing_source
    result.excluded_records = max(result.records - formal, 0)
    result.exclusion_reasons = reasons
    result.metrics.update({
        "formal_records": formal,
        "demo_records": demos,
        "unverified_records": unverified,
        "missing_source_records": missing_source,
        "excluded_records": result.excluded_records,
        "exclusion_reasons": reasons,
        "legacy_inferred_records": legacy,
        "source_kind_counts": {
            kind: sum(infer_source_kind(row) == kind for row in rows)
            for kind in SOURCE_KINDS
        },
        "verification_status_counts": {
            status: sum(infer_verification_status(row, infer_source_kind(row)) == status for row in rows)
            for status in VERIFICATION_STATUSES
        },
        "source_type_counts": {
            source_type: sum(effective_source_type(row, infer_source_kind(row)) == source_type for row in rows)
            for source_type in SOURCE_TYPES
        },
        "official_or_traceable_records": sum(
            infer_source_kind(row) in {"official", "traceable"} for row in rows
        ),
        "provenance_complete_records": sum(
            not quality_missing
            for quality_missing in (
                record_quality(
                    row,
                    require_scope=False,
                    domain=domain,
                    require_provenance=domain in PROVENANCE_REQUIRED_DOMAINS,
                ).get("missing_provenance_fields", [])
                for row in rows
            )
        ),
    })
    if demos:
        result.warnings.append(f"存在 {demos} 条演示数据，未进入正式统计")
    if unverified:
        result.warnings.append(f"存在 {unverified} 条未核验数据，未进入正式统计")
    if missing_source:
        result.warnings.append(f"存在 {missing_source} 条来源信息不完整记录，未进入正式统计")
    missing_provenance = reasons.get("missing_provenance_fields", 0)
    if missing_provenance:
        result.warnings.append(f"存在 {missing_provenance} 条记录缺少完整 provenance 字段，未进入正式统计")
    advisory = reasons.get("industry_advisory", 0)
    if advisory:
        result.warnings.append(f"存在 {advisory} 条第三方行业资讯，仅作可追溯参考，不视为官方核验")
    if legacy:
        result.warnings.append(f"存在 {legacy} 条记录仍依赖兼容性来源推断，建议回填显式 provenance 字段")


def normalize_platform(value: Any) -> str:
    raw = str(value or "").strip()
    lower = raw.casefold()
    if lower in SCOPE_PLATFORM_ALIASES:
        return SCOPE_PLATFORM_ALIASES[lower]
    for alias, name in SCOPE_PLATFORM_ALIASES.items():
        if alias and alias in lower:
            return name
    return raw


def source_record_key(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    parsed = urlparse(text)
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme.casefold()}://{parsed.netloc.casefold()}{path}" if parsed.netloc else text.casefold()


def policy_has_verified_official_record(item: dict[str, Any]) -> bool:
    if not str(item.get("title") or "").strip():
        return False
    url = str(item.get("source_url") or "").strip()
    parsed = urlparse(url)
    host = (parsed.hostname or "").casefold()
    official = host.endswith(".gov") or host == "gov" or host.endswith(".mil") or host == "mil"
    specific_record = bool(parsed.path.rstrip("/"))
    return (
        valid_http_url(url)
        and official
        and specific_record
        and parse_datetime(item.get("collected_at")) is not None
        and parse_datetime(item.get("published_at")) is not None
    )


def count_scoped_items(key: str, rows: list[dict[str, Any]]) -> int:
    if key == "rules":
        return sum(
            is_current_scope_market(item.get("market") or item.get("region") or item.get("country"))
            and normalize_platform(item.get("platform")) in DEFAULT_SCOPE_PLATFORMS
            for item in rows
        )
    if key == "policies":
        return sum(
            is_current_scope_market(item.get("region") or item.get("market") or item.get("country"))
            for item in rows
        )
    return 0


def normalized_title(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().casefold())


def duplicate_count(values: Iterable[Any]) -> int:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        key = normalized_title(value)
        if not key:
            continue
        if key in seen:
            duplicates.add(key)
        seen.add(key)
    return len(duplicates)


def set_freshness(
    result: DatasetResult,
    value: Any,
    now: datetime,
    max_age_hours: int,
    *,
    required: bool = True,
) -> None:
    parsed = parse_datetime(value)
    if not parsed:
        if required:
            result.errors.append("缺少有效的更新时间")
        return
    result.updated_at = parsed.isoformat()
    age = (now - parsed).total_seconds() / 3600
    result.freshness_hours = round(age, 1)
    if age < -24:
        result.errors.append("更新时间异常：位于未来 24 小时之后")
    elif age > max_age_hours:
        result.errors.append(f"超过新鲜度阈值：{age:.1f} 小时 > {max_age_hours} 小时")


def validate_items_dataset(
    key: str,
    path: str,
    now: datetime,
    *,
    minimum: int,
    max_age_hours: int,
    allow_empty: bool = False,
    require_chinese_display: bool = False,
    type_field: str | None = None,
    allowed_types: set[str] | None = None,
) -> DatasetResult:
    result = DatasetResult(key, os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        result.errors.append("根结构必须是包含 items 数组的对象")
        return result

    items = data["items"]
    result.records = len(items)
    if key in {"taxes", "access_requirements"}:
        result.connected = bool(items)
        if not items and allow_empty:
            result.warnings.append(
                f"{DATASET_LABELS[key]}数据集为空：尚未接入当前范围数据，相关结论仅可显示为待补充"
            )
            result.metrics["connection_status"] = "not_connected"
    if items or not allow_empty:
        freshness_value = data.get("last_checked_at") or data.get("updated_at")
        set_freshness(result, freshness_value, now, max_age_hours)
        result.metrics["freshness_basis"] = (
            "last_checked_at" if data.get("last_checked_at") else "updated_at"
        )
        if data.get("last_checked_at"):
            result.metrics["content_updated_at"] = data.get("updated_at")
    if len(items) < minimum:
        result.errors.append(f"记录数不足：{len(items)} < {minimum}")

    malformed = sum(not isinstance(item, dict) for item in items)
    rows = [item for item in items if isinstance(item, dict)]
    result.scoped_records = count_scoped_items(key, rows)
    apply_record_quality_metrics(
        result,
        rows,
        domain={"policies": "policy", "rules": "rule"}.get(key, key),
        scoped_predicate=lambda item: is_current_scope_market(
            item.get("region") or item.get("market") or item.get("country")
        ) and (
            key != "rules" or normalize_platform(item.get("platform")) in DEFAULT_SCOPE_PLATFORMS
        ),
    )
    missing_ids = sum(not str(item.get("id", "")).strip() for item in rows)
    missing_titles = sum(not str(item.get("title", "")).strip() for item in rows)
    duplicate_ids = duplicate_count(item.get("id") for item in rows)
    duplicate_titles = duplicate_count(item.get("title") for item in rows)
    missing_sources = sum(
        not str(item.get("source") or item.get("platform") or "").strip()
        for item in rows
    )
    missing_urls = sum(
        not valid_http_url(item.get("source_url") or item.get("url"))
        for item in rows
    )
    future_dates = 0
    for item in rows:
        # A future effective date is legitimate; collection/publication dates are not.
        for field_name in ("collected_at", "published_at"):
            parsed = parse_datetime(item.get(field_name))
            if parsed and parsed > now + timedelta(days=1):
                future_dates += 1
                break

    formal_scoped_rows = [
        item for item in rows
        if is_scoped_record(item) and record_quality(
            item,
            require_scope=True,
            domain={"policies": "policy", "rules": "rule"}.get(key, key),
            require_provenance=key in {"policies", "taxes", "access_requirements", "rules"},
        )["formal"]
    ]
    missing_chinese_display = sum(
        not has_current_chinese_display(item) for item in formal_scoped_rows
    ) if require_chinese_display else 0
    invalid_domain_types = sum(
        str(item.get(type_field) or "").strip() not in (allowed_types or set())
        for item in rows
    ) if type_field and allowed_types else 0

    result.metrics.update({
        "malformed_records": malformed,
        "missing_ids": missing_ids,
        "missing_titles": missing_titles,
        "duplicate_ids": duplicate_ids,
        "duplicate_titles": duplicate_titles,
        "missing_sources": missing_sources,
        "missing_or_invalid_urls": missing_urls,
        "future_dated_records": future_dates,
        "formal_records_missing_chinese": missing_chinese_display,
        "invalid_domain_types": invalid_domain_types,
        "source_url_coverage_pct": round((len(rows) - missing_urls) * 100 / len(rows), 1) if rows else 0,
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条非对象记录")
    if missing_ids:
        result.errors.append(f"存在 {missing_ids} 条空 ID")
    if missing_titles:
        result.errors.append(f"存在 {missing_titles} 条空标题")
    if duplicate_ids:
        result.errors.append(f"存在 {duplicate_ids} 组重复 ID")
    if duplicate_titles:
        result.warnings.append(f"存在 {duplicate_titles} 组重复标题")
    if missing_sources:
        result.errors.append(f"存在 {missing_sources} 条无来源名称记录")
    if missing_urls:
        result.warnings.append(f"存在 {missing_urls} 条缺少有效来源 URL 的记录")
    if future_dates:
        result.errors.append(f"存在 {future_dates} 条异常未来日期记录")
    if missing_chinese_display:
        result.errors.append(f"存在 {missing_chinese_display} 条正式记录缺少有效中文展示字段")
    if invalid_domain_types:
        result.errors.append(f"存在 {invalid_domain_types} 条无效的 {type_field}")
    return result


def validate_alerts(now: datetime) -> DatasetResult:
    path = os.path.join(DATA_DIR, "alerts.json")
    result = DatasetResult("alerts", os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, list):
        result.errors.append("根结构必须是数组")
        return result
    result.records = len(data)
    malformed = sum(not isinstance(row, list) or len(row) < 10 or not isinstance(row[9], dict) for row in data)
    valid_rows = [row for row in data if isinstance(row, list) and len(row) >= 10 and isinstance(row[9], dict)]
    alert_records = []
    for row in valid_rows:
        # Keep the record-level timestamps from the provenance envelope. The
        # display date is the alert's publication/event date, not a collection
        # timestamp; copying it here would make legacy rows appear freshly
        # collected and would hide incomplete provenance.
        record = dict(row[9])
        record.setdefault("id", row[0])
        record.setdefault("title", row[3])
        record.setdefault("market", row[4])
        record.setdefault("platform", row[5])
        record.setdefault("detail", row[6])
        record.setdefault("date", row[7])
        alert_records.append(record)
    apply_record_quality_metrics(
        result,
        alert_records,
        domain="alert",
        scoped_predicate=lambda item: is_current_scope_market(item.get("market")),
    )
    missing_ids = sum(not str(row[0]).strip() for row in valid_rows)
    missing_titles = sum(not str(row[3]).strip() for row in valid_rows)
    missing_chinese_display = sum(
        not contains_chinese(row[3]) or not contains_chinese(row[6])
        for row in valid_rows
    )
    duplicate_ids = duplicate_count(row[0] for row in valid_rows)
    future_dates = sum(
        bool((parsed := parse_datetime(row[7])) and parsed > now + timedelta(days=1))
        for row in valid_rows
    )
    invalid_lineage = [alert_lineage_issues(record) for record in alert_records]
    invalid_lineage_records = sum(bool(issues) for issues in invalid_lineage)
    invalid_aggregate_lineage = sum(
        bool(issues) and is_aggregate_alert(record)
        for record, issues in zip(alert_records, invalid_lineage)
    )
    detail_path = os.path.join(DATA_DIR, "alerts_detailed.json")
    detail_result = DatasetResult("alerts", os.path.relpath(detail_path, ROOT))
    detail = load_json(detail_path, detail_result)
    generated_at = detail.get("meta", {}).get("generated_at") if isinstance(detail, dict) else None
    set_freshness(result, generated_at, now, 36)
    result.metrics.update({
        "malformed_records": malformed,
        "missing_ids": missing_ids,
        "missing_titles": missing_titles,
        "missing_chinese_display": missing_chinese_display,
        "duplicate_ids": duplicate_ids,
        "future_dated_records": future_dates,
        "invalid_lineage_records": invalid_lineage_records,
        "invalid_aggregate_lineage_records": invalid_aggregate_lineage,
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条字段不足的预警")
    if missing_ids:
        result.errors.append(f"存在 {missing_ids} 条空 ID")
    if missing_titles:
        result.errors.append(f"存在 {missing_titles} 条空标题")
    if missing_chinese_display:
        result.errors.append(f"存在 {missing_chinese_display} 条预警缺少中文标题或摘要")
    if invalid_aggregate_lineage:
        result.errors.append(f"存在 {invalid_aggregate_lineage} 条数量型或聚合型预警缺少完整计算血缘")
    if duplicate_ids:
        result.errors.append(f"存在 {duplicate_ids} 组重复 ID")
    if future_dates:
        result.errors.append(f"存在 {future_dates} 条异常未来日期记录")
    return result


def validate_countries(now: datetime) -> DatasetResult:
    path = os.path.join(DATA_DIR, "countries.json")
    result = DatasetResult("countries", os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, dict):
        result.errors.append("根结构必须是对象")
        return result
    rows = {key: value for key, value in data.items() if not key.startswith("_")}
    result.records = len(rows)
    result.scoped_records = sum(
        1 for key, value in rows.items()
        if isinstance(value, dict) and (is_current_scope_market(key) or is_current_scope_market(value.get("code")) or is_current_scope_market(value.get("name")))
    )
    if len(rows) < 35:
        result.errors.append(f"国家档案数不足：{len(rows)} < 35")
    malformed = sum(not isinstance(value, dict) for value in rows.values())
    missing_names = sum(
        isinstance(value, dict) and not str(value.get("name", "")).strip()
        for value in rows.values()
    )
    duplicate_names = duplicate_count(
        value.get("name") for value in rows.values() if isinstance(value, dict)
    )
    set_freshness(result, data.get("_metadata", {}).get("last_updated"), now, 24 * 7)
    result.metrics.update({
        "malformed_records": malformed,
        "missing_names": missing_names,
        "duplicate_names": duplicate_names,
        "catalog_type": "reference",
    })
    # Catalog entries describe configured identities, not market facts.  They
    # are therefore counted as current-scope reference records and are not
    # forced through the evidence gate used by policies/rules/alerts.
    result.formal_records = result.scoped_records
    result.excluded_records = max(result.records - result.formal_records, 0)
    if malformed:
        result.errors.append(f"存在 {malformed} 个损坏的国家档案")
    if missing_names:
        result.errors.append(f"存在 {missing_names} 个空国家名称")
    if duplicate_names:
        result.errors.append(f"存在 {duplicate_names} 组重复国家名称")
    return result


def validate_platforms() -> DatasetResult:
    path = os.path.join(DATA_DIR, "platforms.json")
    result = DatasetResult("platforms", os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, list):
        result.errors.append("根结构必须是数组")
        return result
    result.records = len(data)
    if len(data) < 20:
        result.errors.append(f"平台档案数不足：{len(data)} < 20")
    malformed = sum(not isinstance(row, dict) for row in data)
    rows = [row for row in data if isinstance(row, dict)]
    result.scoped_records = len({
        normalize_platform(row.get("name"))
        for row in rows
        if normalize_platform(row.get("name")) in DEFAULT_SCOPE_PLATFORMS
    })
    missing_names = sum(not str(row.get("name", "")).strip() for row in rows)
    duplicate_names = duplicate_count(row.get("name") for row in rows)
    result.metrics.update({
        "malformed_records": malformed,
        "missing_names": missing_names,
        "duplicate_names": duplicate_names,
        "catalog_type": "reference",
    })
    result.formal_records = result.scoped_records
    result.excluded_records = max(result.records - result.formal_records, 0)
    if malformed:
        result.errors.append(f"存在 {malformed} 条非对象平台记录")
    if missing_names:
        result.errors.append(f"存在 {missing_names} 条空平台名称")
    if duplicate_names:
        result.errors.append(f"存在 {duplicate_names} 组重复平台名称")
    return result


def validate_us_market(now: datetime) -> DatasetResult:
    index_path = os.path.join(DATA_DIR, "us_market", "index.json")
    result = DatasetResult("us_market", os.path.relpath(index_path, ROOT))
    data = load_json(index_path, result)
    if data is None:
        return result
    categories = data.get("categories") if isinstance(data, dict) else None
    if not isinstance(categories, list):
        result.errors.append("索引必须包含 categories 数组")
        return result
    result.records = len(categories)
    result.scoped_records = result.records
    result.formal_records = result.records
    actual_category_keys = {
        str(row.get("key") or "").strip().casefold()
        for row in categories if isinstance(row, dict) and str(row.get("key") or "").strip()
    }
    if actual_category_keys != DEFAULT_SCOPE_CATEGORY_CODES:
        result.errors.append(
            "美国品类索引与范围目录不一致："
            f"actual={sorted(actual_category_keys)} expected={sorted(DEFAULT_SCOPE_CATEGORY_CODES)}"
        )
    duplicate_keys = duplicate_count(row.get("key") for row in categories if isinstance(row, dict))
    missing_files = 0
    invalid_sections = 0
    failed_categories = []
    degraded_categories = []
    skipped_categories = []
    succeeded_categories = []
    cached_categories = []
    missing_collection_status = []
    out_of_scope_platforms = []
    freshness_candidates = []
    for row in categories:
        if not isinstance(row, dict):
            invalid_sections += 1
            continue
        filename = row.get("file")
        category_path = os.path.join(DATA_DIR, "us_market", str(filename or ""))
        category_result = DatasetResult("us_market", os.path.relpath(category_path, ROOT))
        category = load_json(category_path, category_result)
        if category is None:
            missing_files += 1
            continue
        required = ("country", "platforms", "rules", "policies", "alerts")
        if not isinstance(category, dict) or any(key not in category for key in required):
            invalid_sections += 1
            continue
        platform_names = {
            normalize_platform(item.get("name") or item.get("platform"))
            for item in category.get("platforms", [])
            if isinstance(item, dict) and str(item.get("name") or item.get("platform") or "").strip()
        }
        matrix_names = {
            normalize_platform(item[0])
            for item in category.get("matrix", [])
            if isinstance(item, list) and item and str(item[0] or "").strip()
        }
        rule_platforms = {
            normalize_platform(item.get("platform"))
            for item in category.get("rules", [])
            if isinstance(item, dict) and str(item.get("platform") or "").strip()
            and normalize_platform(item.get("platform")) in SCOPE_PLATFORM_NAMES
        }
        invalid_platforms = sorted(
            (platform_names | matrix_names | rule_platforms) - DEFAULT_SCOPE_PLATFORMS
        )
        if invalid_platforms:
            out_of_scope_platforms.append({"category": str(row.get("key") or ""), "platforms": invalid_platforms})
        meta = category.get("meta") if isinstance(category.get("meta"), dict) else {}
        category_key = str(row.get("key") or filename or "unknown")
        collection_status = str(
            meta.get("collection_status") or row.get("collection_status") or ""
        ).strip()
        if collection_status == "failed":
            failed_categories.append(category_key)
        elif collection_status == "degraded":
            degraded_categories.append(category_key)
        elif collection_status == "skipped":
            skipped_categories.append(category_key)
        elif collection_status == "succeeded":
            succeeded_categories.append(category_key)
        elif collection_status != "succeeded":
            missing_collection_status.append(category_key)
        if meta.get("cache_used") or row.get("cache_used"):
            cached_categories.append(category_key)
        freshness_value = (
            meta.get("last_checked_at")
            or meta.get("content_updated_at")
            or meta.get("generated_at")
            or row.get("last_checked_at")
            or row.get("content_updated_at")
        )
        parsed_freshness = parse_datetime(freshness_value)
        if parsed_freshness:
            freshness_candidates.append(parsed_freshness)
    if freshness_candidates:
        # Every manifest category feed is required. The oldest category therefore
        # defines the freshness of the aggregate US-market dataset.
        set_freshness(result, min(freshness_candidates).isoformat(), now, 36)
        result.metrics["freshness_basis"] = "oldest_category_last_successful_check"
    else:
        set_freshness(result, data.get("last_checked_at") or data.get("generated_at"), now, 36)
        result.metrics["freshness_basis"] = (
            "index_last_checked_at" if data.get("last_checked_at") else "legacy_index_generated_at"
        )
    result.metrics.update({
        "duplicate_category_keys": duplicate_keys,
        "missing_category_files": missing_files,
        "invalid_category_files": invalid_sections,
        "collection_status_counts": {
            "succeeded": len(succeeded_categories),
            "degraded": len(degraded_categories),
            "failed": len(failed_categories),
            "skipped": len(skipped_categories),
            "unknown": len(missing_collection_status),
        },
        "cached_categories": sorted(cached_categories),
        "expected_category_keys": sorted(DEFAULT_SCOPE_CATEGORY_CODES),
        "actual_category_keys": sorted(actual_category_keys),
        "out_of_scope_platforms": out_of_scope_platforms,
    })
    if duplicate_keys:
        result.errors.append(f"存在 {duplicate_keys} 组重复品类 key")
    if missing_files:
        result.errors.append(f"缺少 {missing_files} 个品类文件")
    if invalid_sections:
        result.errors.append(f"存在 {invalid_sections} 个板块不完整的品类文件")
    if out_of_scope_platforms:
        result.errors.append("美国品类文件仍包含范围外平台")
    if failed_categories:
        result.errors.append(
            "美国品类核心来源全量采集失败：" + ", ".join(sorted(failed_categories))
        )
    if degraded_categories:
        result.warnings.append(
            "美国品类来源部分请求失败，数据降级：" + ", ".join(sorted(degraded_categories))
        )
    if skipped_categories:
        result.errors.append(
            "美国品类核心来源未执行，禁止发布离线重建结果："
            + ", ".join(sorted(skipped_categories))
        )
    if missing_collection_status:
        result.warnings.append(
            "美国品类仍使用旧版采集元数据，尚无本轮来源状态："
            + ", ".join(sorted(missing_collection_status))
        )
    return result


def validate_macro(now: datetime) -> DatasetResult:
    path = os.path.join(DATA_DIR, "us_market", "macro_indicators.json")
    result = DatasetResult("macro", os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    indicators = data.get("indicators") if isinstance(data, dict) else None
    if not isinstance(indicators, dict):
        result.errors.append("根结构必须包含 indicators 对象")
        return result
    result.records = len(indicators)
    result.scoped_records = result.records
    generated_at = data.get("meta", {}).get("generated_at")
    indicator_rows = [
        dict(
            row,
            market="US",
            source_type="official_feed",
            published_at=row.get("published_at") or row.get("date"),
            collected_at=row.get("collected_at") or generated_at,
        )
        for row in indicators.values()
        if isinstance(row, dict)
    ]
    apply_record_quality_metrics(result, indicator_rows, domain="market")
    set_freshness(result, data.get("meta", {}).get("generated_at"), now, 72)
    if len(indicators) < 10:
        result.errors.append(f"宏观指标数不足：{len(indicators)} < 10")
    missing_sources = sum(not str(row.get("source", "")).strip() for row in indicators.values() if isinstance(row, dict))
    invalid_urls = sum(not valid_http_url(row.get("source_url")) for row in indicators.values() if isinstance(row, dict))
    malformed = sum(not isinstance(row, dict) for row in indicators.values())
    result.metrics.update({
        "malformed_records": malformed,
        "missing_sources": missing_sources,
        "missing_or_invalid_urls": invalid_urls,
        "collector_fetched": data.get("meta", {}).get("fetched"),
        "collector_failed": data.get("meta", {}).get("failed"),
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条损坏的宏观指标")
    if missing_sources:
        result.errors.append(f"存在 {missing_sources} 条无来源名称指标")
    if invalid_urls:
        result.errors.append(f"存在 {invalid_urls} 条无有效来源 URL 指标")
    return result


def validate_cpsc(now: datetime) -> DatasetResult:
    path = os.path.join(DATA_DIR, "us_market", "cpsc_recalls.json")
    result = DatasetResult("cpsc", os.path.relpath(path, ROOT))
    if not os.path.exists(path):
        result.warnings.append("本轮无 CPSC 缓存，召回预警将以其他来源降级运行")
        return result
    data = load_json(path, result)
    if data is None:
        return result
    recalls = data.get("recalls") if isinstance(data, dict) else None
    if not isinstance(recalls, list):
        result.errors.append("根结构必须包含 recalls 数组")
        return result
    result.records = len(recalls)
    result.scoped_records = result.records
    generated_at = data.get("meta", {}).get("generated_at")
    recall_rows = [
        dict(
            row,
            market="US",
            source_url=row.get("url"),
            source_type="official_feed",
            published_at=row.get("published_at") or row.get("date"),
            collected_at=row.get("collected_at") or generated_at,
        )
        for row in recalls
        if isinstance(row, dict)
    ]
    apply_record_quality_metrics(result, recall_rows, domain="cpsc")
    set_freshness(
        result,
        data.get("meta", {}).get("generated_at"),
        now,
        CPSC_MAX_AGE_HOURS,
    )
    if len(recalls) < 1:
        result.errors.append("CPSC 召回缓存为空")
    rows = [row for row in recalls if isinstance(row, dict)]
    malformed = len(recalls) - len(rows)
    duplicate_ids = duplicate_count(row.get("id") for row in rows)
    missing_titles = sum(
        not str(row.get("title", "")).strip() for row in rows
    )
    missing_sources = sum(not str(row.get("source", "")).strip() for row in rows)
    invalid_urls = sum(not valid_http_url(row.get("url")) for row in rows)
    future_dates = sum(
        bool((parsed := parse_datetime(row.get("date"))) and parsed > now + timedelta(days=1))
        for row in rows
    )
    china_related = data.get("china_related", [])
    if not isinstance(china_related, list):
        result.errors.append("china_related 必须是数组")
        china_related = []
    result.metrics.update({
        "malformed_records": malformed,
        "duplicate_ids": duplicate_ids,
        "missing_titles": missing_titles,
        "missing_sources": missing_sources,
        "missing_or_invalid_urls": invalid_urls,
        "future_dated_records": future_dates,
        "china_related_records": len(china_related),
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条损坏的召回记录")
    if duplicate_ids:
        result.errors.append(f"存在 {duplicate_ids} 组重复召回 ID")
    if missing_titles:
        result.errors.append(f"存在 {missing_titles} 条空召回标题")
    if missing_sources:
        result.errors.append(f"存在 {missing_sources} 条无来源名称召回")
    if invalid_urls:
        result.errors.append(f"存在 {invalid_urls} 条无有效官方链接召回")
    if future_dates:
        result.errors.append(f"存在 {future_dates} 条异常未来日期召回")
    if not china_related:
        result.warnings.append("本轮没有识别到中国制造相关召回")
    return result


def validate_collection_run(
    now: datetime,
    path: str | None = None,
    manifest: dict[str, Any] | None = None,
) -> DatasetResult:
    """Validate source-level collector telemetry and its configured scope."""
    path = path or COLLECTION_RUN
    result = DatasetResult("collection_run", os.path.relpath(path, ROOT))
    manifest = manifest if isinstance(manifest, dict) else SCOPE_MANIFEST_DATA
    configured_markets = {
        str(row.get("code") or "").strip().upper()
        for row in manifest.get("markets", [])
        if isinstance(row, dict)
        and str(row.get("status") or "active").strip().casefold() == "active"
        and str(row.get("data_status") or "").strip().casefold() == "configured"
        and str(row.get("code") or "").strip()
    }
    if not os.path.exists(path):
        result.connected = False
        if configured_markets:
            result.errors.append(
                "缺少本轮结构化采集运行记录，禁止将未确认的数据发布到 Supabase"
            )
        else:
            result.warnings.append("尚无结构化采集运行记录；当前没有已配置市场")
        result.metrics["connection_status"] = "not_connected"
        result.metrics["configured_market_codes"] = sorted(configured_markets)
        return result
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, dict) or not isinstance(data.get("sources"), list):
        result.errors.append("根结构必须是包含 sources 数组的对象")
        return result

    result.connected = True
    sources = [row for row in data["sources"] if isinstance(row, dict)]
    result.records = len(data["sources"])
    result.scoped_records = len(sources)
    set_freshness(result, data.get("completed_at"), now, 12)

    configured_platforms = {
        str(row.get("platform_key") or "").strip().casefold()
        for row in manifest.get("market_platforms", [])
        if isinstance(row, dict)
        and str(row.get("market_code") or "").strip().upper() in configured_markets
        and str(row.get("status") or "active").strip().casefold() == "active"
        and str(row.get("data_status") or "").strip().casefold() == "configured"
        and str(row.get("platform_key") or "").strip()
    }
    active_category_codes = {
        str(row.get("code") or "").strip().casefold()
        for row in manifest.get("categories", [])
        if isinstance(row, dict)
        and str(row.get("code") or "").strip()
        and str(row.get("status") or "active").strip().casefold() == "active"
    }
    configured_categories = {
        str(category).strip().casefold()
        for row in manifest.get("markets", [])
        if isinstance(row, dict)
        and str(row.get("code") or "").strip().upper() in configured_markets
        for category in (row.get("category_keys") or row.get("categoryKeys") or [])
        if str(category or "").strip().casefold() in active_category_codes
    }
    scope = data.get("scope") if isinstance(data.get("scope"), dict) else {}
    actual_markets = {
        str(code).strip().upper() for code in scope.get("market_codes", [])
        if str(code or "").strip()
    }
    actual_platforms = {
        str(key).strip().casefold() for key in scope.get("platform_keys", [])
        if str(key or "").strip()
    }
    actual_categories = {
        str(key).strip().casefold() for key in scope.get("category_keys", [])
        if str(key or "").strip()
    }
    if actual_markets != configured_markets:
        result.errors.append(
            "采集市场范围与目录不一致："
            f"actual={sorted(actual_markets)} expected={sorted(configured_markets)}"
        )
    if actual_platforms != configured_platforms:
        result.errors.append(
            "采集平台范围与目录不一致："
            f"actual={sorted(actual_platforms)} expected={sorted(configured_platforms)}"
        )
    if actual_categories != configured_categories:
        result.errors.append(
            "采集品类范围与目录不一致："
            f"actual={sorted(actual_categories)} expected={sorted(configured_categories)}"
        )
    if data.get("legacy_global_writes") is not False:
        result.errors.append("采集运行未明确停用旧全球国家/平台回写")

    try:
        schema_version = int(data.get("schema_version") or 1)
    except (TypeError, ValueError):
        schema_version = 0
    result.metrics["ledger_schema_version"] = schema_version
    result.metrics["ledger_status"] = str(data.get("status") or "").strip().casefold()
    result.metrics["ledger_completed_at"] = data.get("completed_at")
    result.metrics["ledger_scope"] = {
        "market_codes": sorted(actual_markets),
        "platform_keys": sorted(actual_platforms),
        "category_keys": sorted(actual_categories),
    }
    if configured_markets and schema_version < 2:
        result.errors.append(
            "采集运行账本仍是旧版 schema_version，必须使用 v2 完整流水线格式"
        )
    if schema_version >= 2 and not data.get("started_at"):
        result.errors.append("v2 采集运行缺少 started_at")
    if schema_version >= 2 and not data.get("completed_at"):
        result.errors.append("v2 采集运行缺少 completed_at")

    required_fields = {
        "key", "label", "domain", "core", "status", "duration_ms",
        "request_count", "successful_requests", "failed_requests",
        "records_collected", "records_in_scope",
    }
    malformed = len(data["sources"]) - len(sources)
    missing_fields = 0
    invalid_statuses = 0
    invalid_metrics = 0
    duplicate_keys = duplicate_count(row.get("key") for row in sources)
    numeric_fields = {
        "duration_ms", "request_count", "successful_requests",
        "failed_requests", "records_collected", "records_in_scope",
    }
    for row in sources:
        if any(field not in row for field in required_fields):
            missing_fields += 1
        if str(row.get("status") or "") not in {"succeeded", "degraded", "failed", "skipped"}:
            invalid_statuses += 1
        if any(
            not isinstance(row.get(field), int)
            or isinstance(row.get(field), bool)
            or row.get(field) < 0
            for field in numeric_fields
            if field in row
        ):
            invalid_metrics += 1
    if malformed:
        result.errors.append(f"存在 {malformed} 条非对象来源记录")
    if missing_fields:
        result.errors.append(f"存在 {missing_fields} 条来源记录缺少运行字段")
    if invalid_statuses:
        result.errors.append(f"存在 {invalid_statuses} 条来源记录状态无效")
    if invalid_metrics:
        result.errors.append(f"存在 {invalid_metrics} 条来源记录计数或耗时无效")
    if duplicate_keys:
        result.errors.append(f"存在 {duplicate_keys} 组重复来源 key")
    inconsistent_requests = sum(
        int(row.get("request_count") or 0)
        != int(row.get("successful_requests") or 0) + int(row.get("failed_requests") or 0)
        for row in sources
        if all(isinstance(row.get(field), int) and not isinstance(row.get(field), bool)
               for field in ("request_count", "successful_requests", "failed_requests"))
    )
    if inconsistent_requests:
        result.errors.append(f"存在 {inconsistent_requests} 条来源请求计数不一致")

    source_by_key = {
        str(row.get("key") or "").strip(): row for row in sources
        if str(row.get("key") or "").strip()
    }
    expected_core = set()
    required_pipeline_sources = set()
    if "US" in configured_markets:
        expected_core.add("federal_register")
        if schema_version >= 2:
            required_pipeline_sources.update({
                "us_market_categories",
                "cpsc_recalls",
                "fred_bls_macro",
            })
    if "amazon" in configured_platforms:
        expected_core.add("amazon_rules")
    if "tiktok-shop" in configured_platforms:
        expected_core.add("tiktok_shop_rules")
    missing_pipeline_sources = sorted(required_pipeline_sources - set(source_by_key))
    if missing_pipeline_sources:
        result.errors.append(
            "缺少完整流水线来源运行记录：" + ", ".join(missing_pipeline_sources)
        )
    missing_core = sorted(expected_core - set(source_by_key))
    if missing_core:
        result.errors.append("缺少核心来源运行记录：" + ", ".join(missing_core))

    core_failures = sorted(
        key for key, row in source_by_key.items()
        if row.get("core") is True and row.get("status") in {"failed", "skipped"}
    )
    if core_failures:
        result.errors.append("核心来源采集失败：" + ", ".join(core_failures))
    degraded_sources = sorted(
        key for key, row in source_by_key.items()
        if row.get("status") == "degraded"
    )
    non_core_failures = sorted(
        key for key, row in source_by_key.items()
        if row.get("core") is not True and row.get("status") == "failed"
    )
    if degraded_sources:
        result.warnings.append("部分请求失败，来源降级：" + ", ".join(degraded_sources))
    if non_core_failures:
        result.warnings.append("非核心来源采集失败：" + ", ".join(non_core_failures))

    expected_ledger_status = (
        "failed" if core_failures
        else ("degraded" if any(row.get("status") in {"failed", "degraded"} for row in sources) else "healthy")
    )
    actual_ledger_status = str(data.get("status") or "").strip().casefold()
    if schema_version >= 2 and actual_ledger_status != expected_ledger_status:
        result.errors.append(
            "采集运行总状态与来源状态不一致："
            f"actual={actual_ledger_status or 'missing'} expected={expected_ledger_status}"
        )

    ledger_summary = data.get("summary")
    expected_summary = {
        "sources": len(sources),
        "succeeded": sum(row.get("status") == "succeeded" for row in sources),
        "degraded": sum(row.get("status") == "degraded" for row in sources),
        "failed": sum(row.get("status") == "failed" for row in sources),
        "core_failures": core_failures,
        "records_collected": sum(int(row.get("records_collected") or 0) for row in sources),
        "records_in_scope": sum(int(row.get("records_in_scope") or 0) for row in sources),
    }
    if schema_version >= 2 and not isinstance(ledger_summary, dict):
        result.errors.append("v2 采集运行缺少 summary 汇总")
    elif schema_version >= 2:
        summary_mismatches = [
            key for key, expected in expected_summary.items()
            if ledger_summary.get(key) != expected
        ]
        if summary_mismatches:
            result.errors.append(
                "采集运行 summary 与来源明细不一致：" + ", ".join(summary_mismatches)
            )
    unconnected_platforms = sorted({
        str(key).strip().casefold()
        for key in scope.get("unconnected_platform_keys", [])
        if str(key or "").strip()
    })
    if unconnected_platforms:
        result.warnings.append(
            "当前目录平台尚无自动采集器：" + ", ".join(unconnected_platforms)
        )

    result.metrics.update({
        "configured_market_codes": sorted(configured_markets),
        "configured_platform_keys": sorted(configured_platforms),
        "configured_category_keys": sorted(configured_categories),
        "source_status_counts": {
            status: sum(row.get("status") == status for row in sources)
            for status in ("succeeded", "degraded", "failed", "skipped")
        },
        "core_sources": sorted(
            key for key, row in source_by_key.items() if row.get("core") is True
        ),
        "core_failures": core_failures,
        "pipeline_sources": sorted(required_pipeline_sources & set(source_by_key)),
        "missing_pipeline_sources": missing_pipeline_sources,
        "unconnected_platform_keys": unconnected_platforms,
        "ledger_summary": expected_summary,
    })
    return result


def validate_all(now: datetime | None = None) -> dict[str, Any]:
    now = (now or datetime.now(UTC)).astimezone(UTC)
    results = [
        validate_collection_run(now),
        validate_items_dataset(
            "policies", os.path.join(DATA_DIR, "policies.json"), now,
            minimum=50, max_age_hours=36, require_chinese_display=True,
        ),
        validate_items_dataset(
            "taxes", os.path.join(DATA_DIR, "taxes.json"), now,
            minimum=1, max_age_hours=168, require_chinese_display=True,
            type_field="tax_type", allowed_types=TAX_TYPES,
        ),
        validate_items_dataset(
            "access_requirements", os.path.join(DATA_DIR, "access_requirements.json"), now,
            minimum=1, max_age_hours=168, require_chinese_display=True,
            type_field="requirement_type", allowed_types=ACCESS_REQUIREMENT_TYPES,
        ),
        validate_items_dataset("rules", os.path.join(DATA_DIR, "rules.json"), now, minimum=30, max_age_hours=36),
        validate_alerts(now),
        validate_countries(now),
        validate_platforms(),
        validate_us_market(now),
        validate_macro(now),
        validate_cpsc(now),
    ]
    errors = sum(len(result.errors) for result in results)
    non_stale_errors = sum(
        sum("超过新鲜度阈值" not in error for error in result.errors)
        for result in results
    )
    warnings = sum(len(result.warnings) for result in results)
    statuses = [result.status for result in results]
    collection_result = results[0]
    collection_metrics = collection_result.metrics
    collection_run = {
        "quality_status": collection_result.status,
        "ledger_schema_version": collection_metrics.get("ledger_schema_version"),
        "ledger_status": collection_metrics.get("ledger_status"),
        "completed_at": collection_metrics.get("ledger_completed_at"),
        "scope": collection_metrics.get("ledger_scope", {}),
        "source_count": collection_result.records,
        "pipeline_sources": collection_metrics.get("pipeline_sources", []),
        "missing_pipeline_sources": collection_metrics.get("missing_pipeline_sources", []),
        "core_failures": collection_metrics.get("core_failures", []),
    }
    if non_stale_errors:
        status = "failed"
    elif "stale" in statuses:
        status = "stale"
    elif warnings or "not_connected" in statuses:
        status = "degraded"
    else:
        status = "healthy"
    return {
        "schema_version": 1,
        "data_contract_version": "3.0",
        "provenance_fields": [
            "source_kind",
            "source_type",
            "source_url",
            "source_record_id",
            "collected_at",
            "retrieved_at",
            "published_at",
            "effective_from",
            "effective_to",
            "rule_key",
            "rule_version",
            "change_summary",
            "change_type",
            "title_zh",
            "summary_zh",
            "translation",
            "verified_at",
            "verification_status",
            "verification_notes",
            "evidence_hash",
        ],
        "scope": {
            "config_version": SCOPE_MANIFEST_DATA.get("config_version", "1"),
            "market_codes": sorted(DEFAULT_SCOPE_MARKET_CODES),
            "platform_names": sorted(DEFAULT_SCOPE_PLATFORMS),
            "category_codes": sorted(DEFAULT_SCOPE_CATEGORY_CODES),
            "configured_market_codes": sorted(SCOPE_MARKET_CODES),
            "configured_platform_names": sorted(SCOPE_PLATFORMS),
            "manifest": os.path.relpath(SCOPE_MANIFEST, ROOT).replace("\\", "/"),
        },
        "provenance_schema": os.path.relpath(PROVENANCE_SCHEMA, ROOT).replace("\\", "/"),
        "generated_at": now.isoformat(),
        "status": status,
        "publishable": errors == 0,
        "collection_run": collection_run,
        "summary": {
            "datasets": len(results),
            "raw_records": sum(result.records for result in results),
            "scoped_records": sum(result.scoped_records for result in results),
            "formal_records": sum(result.formal_records for result in results),
            "demo_records": sum(result.demo_records for result in results),
            "unverified_records": sum(result.unverified_records for result in results),
            "missing_source_records": sum(result.missing_source_records for result in results),
            "excluded_records": sum(result.excluded_records for result in results),
            "healthy": statuses.count("healthy"),
            "degraded": statuses.count("degraded"),
            "not_connected": statuses.count("not_connected"),
            "stale": statuses.count("stale"),
            "failed": statuses.count("failed"),
            "errors": errors,
            "warnings": warnings,
            "collection_run_status": collection_result.status,
            "collection_ledger_status": collection_metrics.get("ledger_status"),
            "collection_ledger_schema_version": collection_metrics.get("ledger_schema_version"),
            "collection_sources": collection_result.records,
            "pipeline_sources": collection_metrics.get("pipeline_sources", []),
            "missing_pipeline_sources": collection_metrics.get("missing_pipeline_sources", []),
            "collection_core_failures": collection_metrics.get("core_failures", []),
        },
        "datasets": {result.key: result.as_dict() for result in results},
    }


def _public_projection_report(
    results: list[DatasetResult],
    source_report: dict[str, Any] | None,
    now: datetime,
) -> dict[str, Any]:
    errors = sum(len(result.errors) for result in results)
    warnings = sum(len(result.warnings) for result in results)
    return {
        "schema_version": 1,
        "mode": "public_projection",
        "generated_at": now.isoformat(),
        "status": "failed" if errors else ("degraded" if warnings else "healthy"),
        "publishable": errors == 0,
        "source_quality_report": {
            "schema_version": source_report.get("schema_version") if isinstance(source_report, dict) else None,
            "data_contract_version": source_report.get("data_contract_version") if isinstance(source_report, dict) else None,
            "generated_at": source_report.get("generated_at") if isinstance(source_report, dict) else None,
            "status": source_report.get("status") if isinstance(source_report, dict) else None,
            "publishable": source_report.get("publishable") if isinstance(source_report, dict) else None,
        },
        "summary": {
            "datasets": len(results),
            "records": sum(result.records for result in results if result.key not in {"quality_report", "market_scope"}),
            "formal_records": sum(result.formal_records for result in results),
            "excluded_records": sum(result.excluded_records for result in results),
            "errors": errors,
            "warnings": warnings,
        },
        "datasets": {result.key: result.as_dict() for result in results},
    }


def _projection_market_aliases(manifest: dict[str, Any]) -> dict[str, str]:
    aliases: dict[str, str] = {}
    for market in manifest.get("markets", []):
        if not isinstance(market, dict):
            continue
        code = str(market.get("code") or "").strip().upper()
        if not code:
            continue
        for value in (
            market.get("code"), market.get("key"), market.get("name"), market.get("label"),
            *(market.get("aliases") or []),
        ):
            normalized = str(value or "").strip().casefold()
            if normalized:
                aliases[normalized] = code
    return aliases


def _projection_record_market_codes(
    item: dict[str, Any],
    aliases: dict[str, str],
) -> set[str]:
    values: list[Any] = []
    for field_name in (
        "market_codes", "marketCodes", "markets", "market_code", "marketCode",
        "market", "region", "country", "jurisdiction_code", "jurisdictionCode",
        "jurisdiction",
    ):
        value = item.get(field_name)
        if isinstance(value, (list, tuple, set)):
            values.extend(value)
        elif value not in (None, ""):
            values.append(value)
    return {
        aliases.get(str(value).strip().casefold(), str(value).strip().upper())
        for value in values
        if str(value or "").strip()
    }


def _expected_public_count(
    source_report: dict[str, Any],
    key: str,
    result: DatasetResult,
) -> int | None:
    dataset = source_report.get("datasets", {}).get(key)
    expected = dataset.get("formal_records") if isinstance(dataset, dict) else None
    if isinstance(expected, bool) or not isinstance(expected, int) or expected < 0:
        result.errors.append("质量报告缺少有效的 formal_records 契约")
        return None
    if result.records != expected:
        result.errors.append(
            f"公开记录数与质量报告不一致：actual={result.records} expected={expected}"
        )
    result.metrics["expected_formal_records"] = expected
    return expected


def validate_public_projection(
    now: datetime | None = None,
    *,
    data_dir: str | None = None,
    quality_report_path: str | None = None,
) -> dict[str, Any]:
    """Validate the checked-in public projection without private collector inputs."""
    now = (now or datetime.now(UTC)).astimezone(UTC)
    public_dir = os.path.abspath(data_dir or DATA_DIR)
    source_report_path = os.path.abspath(
        quality_report_path or os.path.join(public_dir, "quality_report.json")
    )
    results: list[DatasetResult] = []

    quality_result = DatasetResult(
        "quality_report", os.path.relpath(source_report_path, ROOT)
    )
    source_report = load_json(source_report_path, quality_result)
    results.append(quality_result)
    if not isinstance(source_report, dict):
        if source_report is not None:
            quality_result.errors.append("根结构必须是对象")
        return _public_projection_report(results, None, now)

    quality_result.records = 1
    quality_result.scoped_records = 1
    gate_status = str(source_report.get("status") or "").strip().casefold()
    summary = source_report.get("summary")
    datasets = source_report.get("datasets")
    if source_report.get("publishable") is not True:
        quality_result.errors.append("原始质量报告未通过发布闸门：publishable 必须为 true")
    if gate_status not in {"healthy", "degraded"}:
        quality_result.errors.append(
            f"原始质量报告状态不可发布：{gate_status or 'missing'}"
        )
    elif gate_status == "degraded":
        quality_result.warnings.append("原始质量报告处于 degraded 状态")
    if not isinstance(summary, dict) or summary.get("errors") != 0:
        quality_result.errors.append("原始质量报告 summary.errors 必须为 0")
    if not isinstance(datasets, dict):
        quality_result.errors.append("原始质量报告缺少 datasets 对象")
        datasets = {}
    dataset_error_count = sum(
        len(dataset.get("errors", []))
        for dataset in datasets.values()
        if isinstance(dataset, dict) and isinstance(dataset.get("errors", []), list)
    )
    if dataset_error_count:
        quality_result.errors.append(
            f"原始质量报告仍包含 {dataset_error_count} 个数据集错误"
        )
    if not parse_datetime(source_report.get("generated_at")):
        quality_result.errors.append("原始质量报告缺少有效 generated_at")
    quality_result.formal_records = 1 if not quality_result.errors else 0
    quality_result.excluded_records = 1 - quality_result.formal_records
    quality_result.metrics.update({
        "gate_status": gate_status or None,
        "reported_errors": summary.get("errors") if isinstance(summary, dict) else None,
        "dataset_errors": dataset_error_count,
    })

    manifest_path = os.path.join(public_dir, PUBLIC_PROJECTION_FILES["market_scope"])
    manifest_result = DatasetResult(
        "market_scope", os.path.relpath(manifest_path, ROOT)
    )
    manifest = load_json(manifest_path, manifest_result)
    results.append(manifest_result)
    if not isinstance(manifest, dict):
        if manifest is not None:
            manifest_result.errors.append("根结构必须是对象")
        return _public_projection_report(results, source_report, now)
    markets = manifest.get("markets")
    platforms = manifest.get("platforms")
    categories = manifest.get("categories")
    market_platforms = manifest.get("market_platforms") or manifest.get("marketPlatforms")
    if not all(isinstance(rows, list) for rows in (markets, platforms, categories, market_platforms)):
        manifest_result.errors.append("范围清单必须包含 markets、platforms、categories 和 market_platforms 数组")
        return _public_projection_report(results, source_report, now)

    allowed_market_codes = {
        str(code).strip().upper()
        for code in (manifest.get("default_market_codes") or [])
        if str(code or "").strip()
    }
    market_aliases = _projection_market_aliases(manifest)
    platform_names_by_key = {
        str(item.get("key") or "").strip().casefold(): str(item.get("name") or "").strip()
        for item in platforms
        if isinstance(item, dict) and str(item.get("key") or "").strip() and str(item.get("name") or "").strip()
    }
    configured_platform_keys = {
        str(item.get("platform_key") or item.get("platformKey") or "").strip().casefold()
        for item in market_platforms
        if isinstance(item, dict)
        and str(item.get("market_code") or item.get("marketCode") or "").strip().upper() in allowed_market_codes
        and str(item.get("data_status") or item.get("dataStatus") or "").strip().casefold() == "configured"
    }
    allowed_platform_names = {
        platform_names_by_key[key]
        for key in configured_platform_keys
        if key in platform_names_by_key
    }
    catalog_category_codes = {
        str(item.get("code") or "").strip().casefold()
        for item in categories
        if isinstance(item, dict)
        and str(item.get("code") or "").strip()
        and str(item.get("status") or "active").strip().casefold() == "active"
    }
    allowed_category_codes = {
        str(code).strip().casefold()
        for item in markets
        if isinstance(item, dict)
        and str(item.get("code") or "").strip().upper() in allowed_market_codes
        for code in (item.get("category_keys") or item.get("categoryKeys") or [])
        if str(code or "").strip().casefold() in catalog_category_codes
    }
    reported_scope = source_report.get("scope") if isinstance(source_report.get("scope"), dict) else {}
    reported_markets = {
        str(code).strip().upper()
        for code in (reported_scope.get("market_codes") or [])
        if str(code or "").strip()
    }
    reported_platforms = {
        str(name).strip()
        for name in (reported_scope.get("platform_names") or [])
        if str(name or "").strip()
    }
    reported_categories = {
        str(code).strip().casefold()
        for code in (reported_scope.get("category_codes") or [])
        if str(code or "").strip()
    }
    if not allowed_market_codes:
        manifest_result.errors.append("范围清单缺少 default_market_codes")
    if reported_markets != allowed_market_codes:
        manifest_result.errors.append("范围清单与质量报告的 market_codes 不一致")
    if reported_platforms != allowed_platform_names:
        manifest_result.errors.append("范围清单与质量报告的 platform_names 不一致")
    if reported_categories != allowed_category_codes:
        manifest_result.errors.append("范围清单与质量报告的 category_codes 不一致")
    manifest_result.records = len(allowed_market_codes) + len(allowed_platform_names) + len(allowed_category_codes)
    manifest_result.scoped_records = manifest_result.records
    manifest_result.formal_records = manifest_result.records if not manifest_result.errors else 0
    manifest_result.excluded_records = manifest_result.records - manifest_result.formal_records
    manifest_result.metrics.update({
        "market_codes": sorted(allowed_market_codes),
        "platform_names": sorted(allowed_platform_names),
        "category_codes": sorted(allowed_category_codes),
    })

    def result_for(key: str) -> tuple[DatasetResult, Any]:
        path = os.path.join(public_dir, PUBLIC_PROJECTION_FILES[key])
        result = DatasetResult(key, os.path.relpath(path, ROOT))
        data = load_json(path, result)
        results.append(result)
        return result, data

    countries_result, countries = result_for("countries")
    if isinstance(countries, dict):
        country_rows = {
            key: value for key, value in countries.items() if not str(key).startswith("_")
        }
        countries_result.records = len(country_rows)
        malformed = sum(not isinstance(value, dict) for value in country_rows.values())
        missing_names = sum(
            isinstance(value, dict) and not str(value.get("name") or "").strip()
            for value in country_rows.values()
        )
        out_of_scope = 0
        names: list[str] = []
        for key, value in country_rows.items():
            if not isinstance(value, dict):
                continue
            names.append(str(value.get("name") or "").strip())
            codes = _projection_record_market_codes(
                {"markets": [key, value.get("code"), value.get("name")]}, market_aliases
            )
            if not codes & allowed_market_codes:
                out_of_scope += 1
        duplicates = duplicate_count(names)
        countries_result.scoped_records = len(country_rows) - out_of_scope
        countries_result.formal_records = max(
            len(country_rows) - malformed - missing_names - out_of_scope, 0
        )
        countries_result.excluded_records = len(country_rows) - countries_result.formal_records
        countries_result.metrics.update({
            "malformed_records": malformed,
            "missing_names": missing_names,
            "duplicate_names": duplicates,
            "out_of_scope_records": out_of_scope,
        })
        if malformed:
            countries_result.errors.append(f"存在 {malformed} 个损坏的国家档案")
        if missing_names:
            countries_result.errors.append(f"存在 {missing_names} 个空国家名称")
        if duplicates:
            countries_result.errors.append(f"存在 {duplicates} 组重复国家名称")
        if out_of_scope:
            countries_result.errors.append(f"存在 {out_of_scope} 个范围外国家档案")
        _expected_public_count(source_report, "countries", countries_result)
    elif countries is not None:
        countries_result.errors.append("根结构必须是对象")

    platforms_result, public_platforms = result_for("platforms")
    if isinstance(public_platforms, list):
        platforms_result.records = len(public_platforms)
        rows = [row for row in public_platforms if isinstance(row, dict)]
        malformed = len(public_platforms) - len(rows)
        names = [normalize_platform(row.get("name")) for row in rows]
        missing_names = sum(not str(row.get("name") or "").strip() for row in rows)
        out_of_scope = sum(name not in allowed_platform_names for name in names)
        duplicates = duplicate_count(names)
        platforms_result.scoped_records = len(rows) - out_of_scope
        platforms_result.formal_records = max(
            len(rows) - missing_names - out_of_scope, 0
        )
        platforms_result.excluded_records = len(public_platforms) - platforms_result.formal_records
        platforms_result.metrics.update({
            "malformed_records": malformed,
            "missing_names": missing_names,
            "duplicate_names": duplicates,
            "out_of_scope_records": out_of_scope,
        })
        if malformed:
            platforms_result.errors.append(f"存在 {malformed} 条非对象平台记录")
        if missing_names:
            platforms_result.errors.append(f"存在 {missing_names} 条空平台名称")
        if duplicates:
            platforms_result.errors.append(f"存在 {duplicates} 组重复平台名称")
        if out_of_scope:
            platforms_result.errors.append(f"存在 {out_of_scope} 条范围外平台记录")
        _expected_public_count(source_report, "platforms", platforms_result)
    elif public_platforms is not None:
        platforms_result.errors.append("根结构必须是数组")

    item_domains = {
        "policies": "policy",
        "rules": "rule",
        "taxes": "tax",
        "access_requirements": "access",
    }
    for key, domain in item_domains.items():
        result, data = result_for(key)
        if not isinstance(data, dict) or not isinstance(data.get("items") if isinstance(data, dict) else None, list):
            if data is not None:
                result.errors.append("根结构必须是包含 items 数组的对象")
            continue
        items = data["items"]
        result.records = len(items)
        rows = [item for item in items if isinstance(item, dict)]
        malformed = len(items) - len(rows)
        missing_ids = sum(not str(item.get("id") or "").strip() for item in rows)
        missing_titles = sum(not str(item.get("title") or "").strip() for item in rows)
        duplicates = duplicate_count(item.get("id") for item in rows)
        invalid_urls = sum(not valid_http_url(item.get("source_url")) for item in rows)
        out_of_scope = sum(
            not (_projection_record_market_codes(item, market_aliases) & allowed_market_codes)
            or (
                key == "rules"
                and normalize_platform(item.get("platform")) not in allowed_platform_names
            )
            for item in rows
        )
        invalid_quality = 0
        for item in rows:
            quality = record_quality(
                item, require_scope=False, domain=domain, require_provenance=True
            )
            if not quality["formal"]:
                invalid_quality += 1
        result.scoped_records = len(rows) - out_of_scope
        result.formal_records = max(
            len(rows) - missing_ids - missing_titles - invalid_urls - out_of_scope - invalid_quality,
            0,
        )
        result.excluded_records = len(items) - result.formal_records
        result.metrics.update({
            "malformed_records": malformed,
            "missing_ids": missing_ids,
            "missing_titles": missing_titles,
            "duplicate_ids": duplicates,
            "missing_or_invalid_urls": invalid_urls,
            "out_of_scope_records": out_of_scope,
            "non_formal_records": invalid_quality,
        })
        if malformed:
            result.errors.append(f"存在 {malformed} 条非对象记录")
        if missing_ids:
            result.errors.append(f"存在 {missing_ids} 条空 ID")
        if missing_titles:
            result.errors.append(f"存在 {missing_titles} 条空标题")
        if duplicates:
            result.errors.append(f"存在 {duplicates} 组重复 ID")
        if invalid_urls:
            result.errors.append(f"存在 {invalid_urls} 条非 HTTPS 来源链接")
        if out_of_scope:
            result.errors.append(f"存在 {out_of_scope} 条范围外记录")
        if invalid_quality:
            result.errors.append(f"存在 {invalid_quality} 条非正式或 provenance 不完整记录")
        _expected_public_count(source_report, key, result)

    alerts_result, alerts = result_for("alerts")
    if isinstance(alerts, list):
        alerts_result.records = len(alerts)
        valid_rows = [
            row for row in alerts
            if isinstance(row, list) and len(row) >= 10 and isinstance(row[9], dict)
        ]
        malformed = len(alerts) - len(valid_rows)
        ids = [row[0] for row in valid_rows]
        missing_ids = sum(not str(value or "").strip() for value in ids)
        duplicates = duplicate_count(ids)
        out_of_scope = invalid_urls = invalid_quality = 0
        for row in valid_rows:
            item = dict(row[9])
            item.setdefault("id", row[0])
            item.setdefault("title", row[3])
            item.setdefault("market", row[4])
            item.setdefault("platform", row[5])
            item.setdefault("detail", row[6])
            item.setdefault("date", row[7])
            if not (_projection_record_market_codes(item, market_aliases) & allowed_market_codes):
                out_of_scope += 1
            if not valid_http_url(item.get("source_url")):
                invalid_urls += 1
            if not record_quality(
                item, require_scope=False, domain="alert", require_provenance=True
            )["formal"]:
                invalid_quality += 1
        alerts_result.scoped_records = len(valid_rows) - out_of_scope
        alerts_result.formal_records = max(
            len(valid_rows) - missing_ids - invalid_urls - out_of_scope - invalid_quality,
            0,
        )
        alerts_result.excluded_records = len(alerts) - alerts_result.formal_records
        alerts_result.metrics.update({
            "malformed_records": malformed,
            "missing_ids": missing_ids,
            "duplicate_ids": duplicates,
            "missing_or_invalid_urls": invalid_urls,
            "out_of_scope_records": out_of_scope,
            "non_formal_records": invalid_quality,
        })
        if malformed:
            alerts_result.errors.append(f"存在 {malformed} 条字段不足的预警")
        if missing_ids:
            alerts_result.errors.append(f"存在 {missing_ids} 条空 ID")
        if duplicates:
            alerts_result.errors.append(f"存在 {duplicates} 组重复 ID")
        if invalid_urls:
            alerts_result.errors.append(f"存在 {invalid_urls} 条非 HTTPS 来源链接")
        if out_of_scope:
            alerts_result.errors.append(f"存在 {out_of_scope} 条范围外记录")
        if invalid_quality:
            alerts_result.errors.append(f"存在 {invalid_quality} 条非正式或 provenance 不完整记录")
        _expected_public_count(source_report, "alerts", alerts_result)
    elif alerts is not None:
        alerts_result.errors.append("根结构必须是数组")

    macro_result, macro = result_for("macro")
    indicators = macro.get("indicators") if isinstance(macro, dict) else None
    if isinstance(indicators, dict):
        macro_result.records = len(indicators)
        rows = [(key, value) for key, value in indicators.items() if isinstance(value, dict)]
        malformed = len(indicators) - len(rows)
        missing_names = sum(not str(item.get("name") or "").strip() for _, item in rows)
        invalid_urls = sum(not valid_http_url(item.get("source_url")) for _, item in rows)
        invalid_quality = 0
        macro_market = next(iter(allowed_market_codes), "") if len(allowed_market_codes) == 1 else ""
        generated_at = macro.get("meta", {}).get("generated_at") if isinstance(macro.get("meta"), dict) else None
        for _, item in rows:
            normalized = dict(
                item,
                market=item.get("market") or macro_market,
                source_type=item.get("source_type") or "official_feed",
                published_at=item.get("published_at") or item.get("date"),
                collected_at=item.get("collected_at") or generated_at,
            )
            if not record_quality(
                normalized, require_scope=False, domain="market", require_provenance=True
            )["formal"]:
                invalid_quality += 1
        macro_result.scoped_records = len(rows)
        macro_result.formal_records = max(
            len(rows) - missing_names - invalid_urls - invalid_quality, 0
        )
        macro_result.excluded_records = len(indicators) - macro_result.formal_records
        macro_result.metrics.update({
            "malformed_records": malformed,
            "missing_names": missing_names,
            "missing_or_invalid_urls": invalid_urls,
            "non_formal_records": invalid_quality,
        })
        if malformed:
            macro_result.errors.append(f"存在 {malformed} 条损坏的宏观指标")
        if missing_names:
            macro_result.errors.append(f"存在 {missing_names} 条空指标名称")
        if invalid_urls:
            macro_result.errors.append(f"存在 {invalid_urls} 条非 HTTPS 来源链接")
        if invalid_quality:
            macro_result.errors.append(f"存在 {invalid_quality} 条非正式或 provenance 不完整记录")
        _expected_public_count(source_report, "macro", macro_result)
    elif macro is not None:
        macro_result.errors.append("根结构必须包含 indicators 对象")

    advisory_result, advisories = result_for("industry_advisories")
    advisory_items = advisories.get("items") if isinstance(advisories, dict) else None
    if isinstance(advisory_items, list):
        advisory_result.records = len(advisory_items)
        rows = [item for item in advisory_items if isinstance(item, dict)]
        malformed = len(advisory_items) - len(rows)
        missing_ids = sum(not str(item.get("id") or "").strip() for item in rows)
        duplicates = duplicate_count(item.get("id") for item in rows)
        invalid_urls = sum(not valid_http_url(item.get("source_url")) for item in rows)
        out_of_scope = sum(
            not (_projection_record_market_codes(item, market_aliases) & allowed_market_codes)
            for item in rows
        )
        invalid_contract = sum(
            not is_industry_advisory(item)
            or normalize_source_kind(item.get("source_kind")) != "traceable"
            or normalize_source_type(item.get("source_type")) != "licensed_provider"
            or normalize_verification_status(item.get("verification_status")) != "pending"
            for item in rows
        )
        advisory_result.scoped_records = len(rows) - out_of_scope
        advisory_result.formal_records = 0
        advisory_result.excluded_records = len(advisory_items)
        advisory_result.metrics.update({
            "malformed_records": malformed,
            "missing_ids": missing_ids,
            "duplicate_ids": duplicates,
            "missing_or_invalid_urls": invalid_urls,
            "out_of_scope_records": out_of_scope,
            "invalid_advisory_contract_records": invalid_contract,
            "formal_records": 0,
        })
        if malformed:
            advisory_result.errors.append(f"存在 {malformed} 条非对象行业资讯")
        if missing_ids:
            advisory_result.errors.append(f"存在 {missing_ids} 条空 ID")
        if duplicates:
            advisory_result.errors.append(f"存在 {duplicates} 组重复 ID")
        if invalid_urls:
            advisory_result.errors.append(f"存在 {invalid_urls} 条非 HTTPS 来源链接")
        if out_of_scope:
            advisory_result.errors.append(f"存在 {out_of_scope} 条范围外记录")
        if invalid_contract:
            advisory_result.errors.append(
                f"存在 {invalid_contract} 条行业资讯被错误标记为正式或官方数据"
            )
        reported_advisory = datasets.get("industry_advisories")
        if isinstance(reported_advisory, dict) and reported_advisory.get("formal_records") not in (None, 0):
            advisory_result.errors.append("行业资讯不能计入质量报告 formal_records")
    elif advisories is not None:
        advisory_result.errors.append("根结构必须是包含 items 数组的对象")

    return _public_projection_report(results, source_report, now)


def write_report(report: dict[str, Any], path: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Mercator market data before publishing")
    parser.add_argument(
        "--public-projection",
        action="store_true",
        help="Validate the checked-in public projection against its existing quality report",
    )
    parser.add_argument(
        "--report",
        default=None,
        help="Validation report output path (full validation defaults to data/quality_report.json)",
    )
    args = parser.parse_args()
    report_path = args.report
    if args.public_projection:
        report = validate_public_projection()
        if report_path:
            if os.path.abspath(report_path) == os.path.abspath(DEFAULT_REPORT):
                parser.error("public projection audit cannot overwrite data/quality_report.json")
            write_report(report, report_path)
    else:
        report = validate_all()
        report_path = report_path or DEFAULT_REPORT
        write_report(report, report_path)

    label = "PUBLIC PROJECTION" if args.public_projection else "QUALITY"
    print(f"[{label}] status={report['status']} publishable={report['publishable']}")
    for dataset in report["datasets"].values():
        print(
            f"  {dataset['key']:<12} {dataset['status']:<9} "
            f"records={dataset['records']:<4} errors={len(dataset['errors'])} warnings={len(dataset['warnings'])}"
        )
        for message in dataset["errors"]:
            print(f"    ERROR: {message}")
        for message in dataset["warnings"]:
            print(f"    WARN: {message}")
    if report_path:
        print(f"[{label}] report={os.path.relpath(report_path, ROOT)}")
    elif args.public_projection:
        print(f"[{label}] source_report={os.path.relpath(DEFAULT_REPORT, ROOT)} (read-only)")
    return 0 if report["publishable"] else 1


if __name__ == "__main__":
    sys.exit(main())
