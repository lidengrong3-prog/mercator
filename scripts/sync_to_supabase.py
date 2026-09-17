#!/usr/bin/env python3
"""
sync_to_supabase.py — 数据同步到 Supabase

将仓库中的 JSON 数据文件同步到 Supabase 数据库，
使前端可以从 Supabase 读取实时数据（替代静态 JSON）。

支持增量同步：基于 updated_at 时间戳，只上传有变化的数据。

数据源:
  - data/market_scope.json → market/platform/jurisdiction/category/report-template catalog tables
  - data/countries.json → countries 表
  - data/policies.json → market_data(key='policies')
  - data/rules.json → market_data(key='rules')
  - data/alerts.json → market_data(key='alerts')
  - data/platforms.json → market_data(key='platforms')
  - data/countries.json → market_data(key='countries')
  - data/us_market/macro_indicators.json and cpsc_recalls.json → raw evidence
  - data/us_market/*.json remains a local/PDF dataset; it is not sent to a
    table that is absent from the production schema.

环境变量:
  SUPABASE_URL: Supabase 项目 URL
  SUPABASE_SERVICE_KEY: Supabase service_role key (需要写入权限)
  SUPABASE_SYNC_LEGACY_TABLES: set to 1 only for an explicitly provisioned
    legacy schema; defaults to the public market_data bundle only.

用法:
  python scripts/sync_to_supabase.py
  python scripts/sync_to_supabase.py --dry-run
  python scripts/sync_to_supabase.py --only us_market
"""

import json
import os
import re
import sys
import urllib.request
import urllib.parse
import urllib.error
import ssl
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from private_artifact_store import upload_private_artifact
from source_governance import (
    access_policy_rows,
    canonical_source_key,
    classify_source_for_publication,
    quarantine_unlicensed_record,
    registry_rows,
    source_is_publishable,
    source_metadata,
)

from validate_data import (
    DEFAULT_SCOPE_CATEGORY_CODES,
    DEFAULT_SCOPE_PLATFORMS,
    DEFAULT_REPORT,
    PROVENANCE_REQUIRED_DOMAINS,
    SOURCE_TYPES,
    infer_source_kind,
    infer_verification_status,
    effective_source_type,
    is_current_scope_market,
    normalize_source_type,
    normalize_platform,
    record_quality,
    record_category_codes,
    record_platform_names,
    record_scope_codes,
    source_record_id_for,
    source_url_for,
    validate_all,
    write_report,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")
US_MARKET_DIR = os.path.join(DATA_DIR, "us_market")
MARKET_SCOPE_PATH = os.path.join(DATA_DIR, "market_scope.json")
HISTORY_TABLES = (
    "source_fetch_runs", "raw_source_records", "policy_documents", "policy_versions",
    "platform_rules", "platform_rule_versions", "product_entities", "product_snapshots",
    "shop_entities", "shop_snapshots", "content_entities", "content_snapshots",
    "formal_publications",
)


PROVENANCE_DATASETS = {
    "policies": ("policies.json", "policy"),
    "taxes": ("taxes.json", "tax"),
    "access_requirements": ("access_requirements.json", "access"),
    "rules": ("rules.json", "rule"),
    "alerts": ("alerts.json", "alert"),
    "platforms": ("platforms.json", "platform"),
    "countries": ("countries.json", "market"),
    "macro": (os.path.join("us_market", "macro_indicators.json"), "market"),
    "cpsc": (os.path.join("us_market", "cpsc_recalls.json"), "alert"),
}

SOURCE_ACCESS_POLICIES = {
    "federal-register": {
        "license_class": "official_public", "access_class": "public_summary",
        "redistribution_allowed": True, "retention_days": 730,
        "authorization_secret_name": None,
        "provider_terms_url": "https://www.federalregister.gov/policy",
        "permitted_uses": ["audit", "analysis", "public_summary"],
    },
    "ustr": {
        "license_class": "official_public", "access_class": "public_summary",
        "redistribution_allowed": True, "retention_days": 730,
        "authorization_secret_name": None,
        "provider_terms_url": "https://ustr.gov/about-us/policy-offices/press-office/website-policies",
        "permitted_uses": ["audit", "analysis", "public_summary"],
    },
    "cpsc": {
        "license_class": "official_public", "access_class": "public_summary",
        "redistribution_allowed": True, "retention_days": 730,
        "authorization_secret_name": None,
        "provider_terms_url": "https://www.cpsc.gov/About-CPSC/Policies-Statements-and-Directives",
        "permitted_uses": ["audit", "analysis", "public_summary"],
    },
    "fred": {
        "license_class": "official_public", "access_class": "public_summary",
        "redistribution_allowed": True, "retention_days": 730,
        "authorization_secret_name": "FRED_API_KEY",
        "provider_terms_url": "https://fred.stlouisfed.org/legal/",
        "permitted_uses": ["audit", "analysis", "public_summary"],
    },
    "bls": {
        "license_class": "official_public", "access_class": "public_summary",
        "redistribution_allowed": True, "retention_days": 730,
        "authorization_secret_name": None,
        "provider_terms_url": "https://www.bls.gov/bls/linksite.htm",
        "permitted_uses": ["audit", "analysis", "public_summary"],
    },
    "platform-official": {
        "license_class": "official_public", "access_class": "public_summary",
        "redistribution_allowed": True, "retention_days": 365,
        "authorization_secret_name": None, "provider_terms_url": None,
        "permitted_uses": ["audit", "analysis", "public_summary"],
    },
    "official-source": {
        "license_class": "official_public", "access_class": "public_summary",
        "redistribution_allowed": True, "retention_days": 730,
        "authorization_secret_name": None, "provider_terms_url": None,
        "permitted_uses": ["audit", "analysis", "public_summary"],
    },
    "traceable-feed": {
        "license_class": "restricted", "access_class": "service_private",
        "redistribution_allowed": False, "retention_days": 180,
        "authorization_secret_name": None, "provider_terms_url": None,
        "permitted_uses": ["audit", "analysis"],
    },
    "user-upload": {
        "license_class": "user_owned", "access_class": "workspace_private",
        "redistribution_allowed": False, "retention_days": 365,
        "authorization_secret_name": None, "provider_terms_url": None,
        "permitted_uses": ["workspace_analysis"],
    },
    "derived": {
        "license_class": "internal", "access_class": "service_private",
        "redistribution_allowed": False, "retention_days": 365,
        "authorization_secret_name": None, "provider_terms_url": None,
        "permitted_uses": ["analysis"],
    },
    "demo": {
        "license_class": "restricted", "access_class": "blocked",
        "redistribution_allowed": False, "retention_days": 30,
        "authorization_secret_name": None, "provider_terms_url": None,
        "permitted_uses": [],
    },
    "tikhub": {
        "license_class": "commercial", "access_class": "service_private",
        "redistribution_allowed": False, "retention_days": 30,
        "authorization_secret_name": "TIKHUB_API_KEY",
        "provider_terms_url": "https://tikhub.io/zh/terms",
        "permitted_uses": ["internal_search", "workspace_analysis"],
    },
    "internal-system": {
        "license_class": "internal", "access_class": "service_private",
        "redistribution_allowed": False, "retention_days": 90,
        "authorization_secret_name": None, "provider_terms_url": None,
        "permitted_uses": ["operations", "audit", "recovery"],
    },
}

PRIVATE_ARTIFACT_SPECS = (
    # The Worker publishes these files before the repository projection step.
    # Keeping the complete copies in private Storage lets a replacement
    # container hydrate an empty persistent volume without using Git as a raw
    # data store.
    ("data/countries.json", "internal-system", "internal_dataset", 365),
    ("data/platforms.json", "internal-system", "internal_dataset", 365),
    ("data/policies.json", "internal-system", "internal_dataset", 365),
    ("data/rules.json", "internal-system", "internal_dataset", 365),
    ("data/us_market/macro_indicators.json", "internal-system", "internal_dataset", 365),
    ("data/collection_run.json", "internal-system", "collection_log", 90),
    ("data/alerts_detailed.json", "internal-system", "internal_dataset", 180),
    ("data/macro_raw.json", "internal-system", "raw_response", 180),
    ("data/_sync_logs/*.json", "internal-system", "sync_log", 90),
    ("data/private_repository_source/**/*", "internal-system", "internal_dataset", 180),
    ("data/us_market/cpsc_recalls.json", "cpsc", "raw_response", 730),
    ("data/us_market/index.json", "internal-system", "internal_dataset", 180),
    ("data/us_market/*.json", "internal-system", "internal_dataset", 180),
    ("data/providers/tikhub/**/*", "tikhub", "licensed_dataset", 30),
    ("data/private/tikhub/**/*", "tikhub", "licensed_dataset", 30),
)

INDUSTRY_MARKET_PATTERNS = {
    "US": re.compile(
        r"美国|美区|美国站|白宫|联邦|美海关|美税|美国市场|"
        r"\b(?:american|united\s+states|u\.s\.?|us\s+(?:tariff|customs|market))\b",
        re.IGNORECASE,
    ),
    "EU": re.compile(
        r"欧盟|欧洲|法国|德国|意大利|西班牙|英国|"
        r"\b(?:eu|europe|france|germany|italy|spain|uk)\b",
        re.IGNORECASE,
    ),
    "CA": re.compile(r"加拿大|\bcanada\b", re.IGNORECASE),
    "JP": re.compile(r"日本|日区|\bjapan\b", re.IGNORECASE),
    "KR": re.compile(r"韩国|韩区|\bkorea\b", re.IGNORECASE),
    "SEA": re.compile(
        r"东南亚|新加坡|马来西亚|印度尼西亚|印尼|泰国|越南|"
        r"\b(?:sea|singapore|malaysia|indonesia|thailand|vietnam)\b",
        re.IGNORECASE,
    ),
}

INDUSTRY_REGION_PATTERNS = {
    "EU": re.compile(r"欧盟|欧洲|\b(?:eu|europe)\b", re.IGNORECASE),
    "SEA": re.compile(r"东南亚|\b(?:sea|southeast\s+asia)\b", re.IGNORECASE),
}


def _industry_market_alias_pattern(values):
    """Build a boundary-aware matcher for configured market aliases."""
    parts = []
    for value in values:
        raw = str(value or "").strip()
        if not raw:
            continue
        escaped = re.escape(raw)
        if re.search(r"[\u3400-\u9fff]", raw):
            parts.append(escaped)
        else:
            parts.append(rf"(?<![A-Za-z0-9]){escaped}(?![A-Za-z0-9])")
    return re.compile("|".join(parts), re.IGNORECASE) if parts else None


def _industry_market_catalog():
    """Read market aliases from the shared scope manifest when available."""
    try:
        manifest = load_json(MARKET_SCOPE_PATH)
    except NameError:
        manifest = None
    if not isinstance(manifest, dict):
        return []
    return [item for item in manifest.get("markets", []) if isinstance(item, dict) and item.get("code")]


def source_key_for_record(record):
    """Resolve a raw record to a stable source registry key."""
    explicit_source_key = canonical_source_key(record.get("source_key"))
    if explicit_source_key:
        try:
            source_metadata(explicit_source_key)
            return explicit_source_key
        except Exception:
            # Unknown collector input is classified by the established source
            # rules below; it never gains publication rights from a free-form key.
            pass
    kind = infer_source_kind(record)
    source_type = normalize_source_type(record.get("source_type"))
    url = source_url_for(record).lower()
    source_text = f"{record.get('source', '')} {record.get('platform', '')}".lower()
    if "tikhub.io" in url or "tikhub" in source_text:
        return "tikhub"
    if is_industry_advisory(record):
        return "traceable-feed"
    if "federalregister.gov" in url:
        return "federal-register"
    if "ustr.gov" in url:
        return "ustr"
    if "cpsc.gov" in url or "saferproducts.gov" in url:
        return "cpsc"
    if "cpsc" in source_text or "consumer product safety" in source_text:
        return "cpsc"
    if "fred.stlouisfed.org" in url or re.search(r"\bfred\b", source_text):
        return "fred"
    if "bls.gov" in url or re.search(r"\bbls\b", source_text):
        return "bls"
    if source_type == "user_upload" or kind == "uploaded":
        return "user-upload"
    if kind == "demo":
        return "demo"
    if source_type == "platform" or record.get("platform"):
        return "platform-official"
    if kind == "official" and source_type in {"government", "regulator", "official_feed"}:
        return "official-source"
    if kind == "derived":
        return "derived"
    return "traceable-feed"


def source_access_policy(source_key):
    """Return the explicit license and retention policy for a source."""
    key = canonical_source_key(source_key)
    base = dict(SOURCE_ACCESS_POLICIES.get(key, SOURCE_ACCESS_POLICIES["traceable-feed"]))
    try:
        governed = source_metadata(key).get("access_policy") or {}
    except Exception:
        governed = {}
    # The governance ledger extends the original privacy policy with the
    # authorization, price, rate-limit and field allowlist contract.
    base.update(governed)
    return base


def redistribution_allowed_for_record(record):
    """Only explicitly redistributable sources may enter public projections."""
    source_key = source_key_for_record(record)
    return bool(source_is_publishable(source_key) and source_access_policy(source_key)["redistribution_allowed"])


def is_industry_advisory(record):
    """Identify third-party industry intelligence for projection guards."""
    source_class = str(record.get("source_class") or record.get("sourceClass") or "").strip().casefold()
    if source_class == "industry_advisory":
        return True
    source_name = str(record.get("source") or "").casefold()
    source_url = source_url_for(record).casefold()
    return bool(
        re.search(r"雨果|amz123|cifnews|行业资讯|行业协会", source_name)
        or re.search(r"(^|\.)cifnews\.com/|(^|\.)amz123\.com/", source_url)
    )


def infer_industry_market_codes(record):
    """Infer market codes only from explicit article text; never default them."""
    text = "\n".join(
        str(record.get(field) or "")
        for field in ("title", "summary", "title_zh", "summary_zh")
    )
    codes = []
    configured_codes = set()
    for market in _industry_market_catalog():
        code = str(market.get("code") or "").strip().upper()
        if not code:
            continue
        configured_codes.add(code)
        matcher = _industry_market_alias_pattern([
            market.get("code"), market.get("key"), market.get("name"),
            market.get("label"), *(market.get("aliases") or []),
        ])
        region_code = str(market.get("region_code") or market.get("regionCode") or "").strip().upper()
        region_matcher = INDUSTRY_REGION_PATTERNS.get(region_code)
        if (matcher and matcher.search(text)) or (region_matcher and region_matcher.search(text)):
            codes.append(code)

    # Preserve the original aggregate-market behavior only for codes that are
    # actually configured. This lets a future DE/FR market receive its own
    # article scope instead of being represented only as EU.
    for code, pattern in INDUSTRY_MARKET_PATTERNS.items():
        if (not configured_codes or code in configured_codes) and pattern.search(text):
            if code not in codes:
                codes.append(code)
    return codes


def explicit_industry_market_codes(record):
    """Return declared advisory scope, excluding global catch-all markers."""
    values = record.get("market_codes") or record.get("marketCodes") or []
    if not isinstance(values, list):
        values = [values]
    catalog = _industry_market_catalog()
    normalized = []
    for value in values:
        raw = str(value or "").strip()
        if not raw or raw.upper() in {"GLOBAL", "GLOBAL_MARKET", "ALL"}:
            continue
        code = raw.upper()
        for market in catalog:
            aliases = [
                market.get("code"), market.get("key"), market.get("name"),
                market.get("label"), *(market.get("aliases") or []),
            ]
            if any(str(alias or "").strip().casefold() == raw.casefold() for alias in aliases):
                code = str(market.get("code")).strip().upper()
                break
        if code not in normalized:
            normalized.append(code)
    expanded = []
    for code in normalized:
        if code in INDUSTRY_REGION_PATTERNS:
            expanded.extend(
                str(market.get("code")).strip().upper()
                for market in catalog
                if str(market.get("region_code") or market.get("regionCode") or "").strip().upper() == code
            )
    normalized.extend(code for code in expanded if code not in normalized)
    return normalized


def public_market_data_payload(key, data):
    """Build the current-scope formal payload exposed to anonymous clients."""
    def with_governed_source(record):
        copy_record = dict(record)
        source_key = source_key_for_record(record)
        lineage = classify_source_for_publication(source_key)
        copy_record["source_key"] = source_key
        copy_record["source_category"] = lineage["source_category"]
        copy_record["authorization_status"] = lineage["authorization_status"]
        copy_record["publication_status"] = "eligible"
        return copy_record

    item_domains = {
        "policies": "policy",
        "taxes": "tax",
        "access_requirements": "access",
        "rules": "rule",
    }
    if key == "industry_advisories":
        # Public industry references are a deliberately small editorial
        # projection, not raw provider responses and never formal evidence.
        if not isinstance(data, dict) or not isinstance(data.get("items"), list):
            return {"updated_at": None, "source_count": 0, "items": []}
        allowed_fields = {
            "id", "title", "summary", "title_zh", "summary_zh", "source",
            "source_url", "region", "market_codes", "category", "impact_level",
            "published_at", "collected_at", "source_kind", "source_type",
            "source_class", "verification_status", "verified_at", "translation",
        }
        items = []
        for item in data["items"]:
            if not isinstance(item, dict) or not is_industry_advisory(item):
                continue
            parsed = urllib.parse.urlsplit(str(item.get("source_url") or ""))
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                continue
            market_codes = explicit_industry_market_codes(item) or infer_industry_market_codes(item)
            public_market_codes = sorted({code for code in market_codes if is_current_scope_market(code)})
            if not public_market_codes:
                continue
            projected = {field: item.get(field) for field in allowed_fields if field in item}
            projected["market_codes"] = public_market_codes
            projected["source_kind"] = "traceable"
            projected["source_type"] = "licensed_provider"
            projected["source_class"] = "industry_advisory"
            projected["verification_status"] = "pending"
            projected["verified_at"] = None
            items.append(projected)
        return {
            "updated_at": data.get("updated_at"),
            "source_count": len({str(item.get("source") or "") for item in items if item.get("source")}),
            "items": items,
        }
    if key in item_domains:
        if not isinstance(data, dict) or not isinstance(data.get("items"), list):
            return data
        domain = item_domains[key]
        payload = dict(data)
        payload["items"] = [
            with_governed_source(item) for item in data["items"]
            if _is_public_formal_record(key, domain, item)
        ]
        payload["source_count"] = len({
            str(item.get("source") or item.get("platform") or source_url_for(item) or "").strip()
            for item in payload["items"]
            if str(item.get("source") or item.get("platform") or source_url_for(item) or "").strip()
        })
        return payload
    if key == "alerts" and isinstance(data, list):
        return [row for row in data if _is_public_alert(row)]
    if key == "countries" and isinstance(data, dict):
        return {
            name: value for name, value in data.items()
            if not name.startswith("_")
            and isinstance(value, dict)
            and (
                is_current_scope_market(name)
                or is_current_scope_market(value.get("code"))
                or is_current_scope_market(value.get("name"))
            )
        }
    if key == "platforms" and isinstance(data, list):
        profiles = {}
        exact_matches = set()
        for row in data:
            if not isinstance(row, dict):
                continue
            platform = normalize_platform(row.get("name"))
            if platform not in DEFAULT_SCOPE_PLATFORMS:
                continue
            exact = str(row.get("name") or "").strip().casefold() == platform.casefold()
            if platform not in profiles or (exact and platform not in exact_matches):
                profiles[platform] = row
            if exact:
                exact_matches.add(platform)
        return list(profiles.values())
    if key == "macro" and isinstance(data, dict) and isinstance(data.get("indicators"), dict):
        payload = dict(data)
        generated_at = data.get("meta", {}).get("generated_at") if isinstance(data.get("meta"), dict) else None
        payload["indicators"] = {
            indicator_key: with_governed_source(value)
            for indicator_key, value in data["indicators"].items()
            if _is_public_macro_indicator(indicator_key, value, generated_at)
        }
        if isinstance(payload.get("meta"), dict):
            payload["meta"] = dict(payload["meta"])
            payload["meta"]["total_indicators"] = len(payload["indicators"])
        return payload
    return data


def _is_public_formal_record(dataset_key, domain, item):
    if (
        not isinstance(item, dict)
        or is_industry_advisory(item)
        or not redistribution_allowed_for_record(item)
    ):
        return False
    market = item.get("region") or item.get("market") or item.get("country")
    if not is_current_scope_market(market):
        return False
    if dataset_key == "rules" and normalize_platform(item.get("platform")) not in DEFAULT_SCOPE_PLATFORMS:
        return False
    return record_quality(
        item,
        require_scope=True,
        domain=domain,
        require_provenance=domain in PROVENANCE_REQUIRED_DOMAINS,
    ).get("formal", False)


def _alert_record(row):
    if not isinstance(row, list) or len(row) < 10 or not isinstance(row[9], dict):
        return None
    record = dict(row[9])
    for field, index in (("id", 0), ("title", 3), ("market", 4), ("platform", 5), ("detail", 6), ("date", 7)):
        record.setdefault(field, row[index])
    return record


def _is_public_alert(row):
    record = _alert_record(row)
    return bool(
        record
        and redistribution_allowed_for_record(record)
        and is_current_scope_market(record.get("market"))
        and record_quality(
            record,
            require_scope=True,
            domain="alert",
            require_provenance=True,
        ).get("formal", False)
    )


def _is_public_macro_indicator(indicator_key, value, generated_at):
    if not isinstance(value, dict):
        return False
    record = dict(
        value,
        id=value.get("id") or indicator_key,
        market="US",
        source_type=value.get("source_type") or "official_feed",
        published_at=value.get("published_at") or value.get("date"),
        collected_at=value.get("collected_at") or generated_at,
    )
    return (
        redistribution_allowed_for_record(record)
        and record_quality(record, require_scope=True, domain="market").get("formal", False)
    )


def iter_provenance_records(only="all"):
    selected = set(PROVENANCE_DATASETS) if only == "all" else {only}
    for key, (filename, domain) in PROVENANCE_DATASETS.items():
        if key not in selected:
            continue
        data = load_json(os.path.join(DATA_DIR, filename))
        if data is None:
            continue
        if key in ("policies", "taxes", "access_requirements", "rules") and isinstance(data, dict):
            rows = data.get("items", [])
        elif key == "macro" and isinstance(data, dict):
            generated_at = data.get("meta", {}).get("generated_at")
            rows = [
                dict(value, id=value.get("id") or indicator_key, market="US",
                     source_type=value.get("source_type") or "official_feed",
                     published_at=value.get("published_at") or value.get("date"),
                     collected_at=value.get("collected_at") or generated_at)
                for indicator_key, value in data.get("indicators", {}).items()
                if isinstance(value, dict)
            ]
        elif key == "cpsc" and isinstance(data, dict):
            generated_at = data.get("meta", {}).get("generated_at")
            rows = [
                dict(value, market="US", source_type=value.get("source_type") or "official_feed",
                     published_at=value.get("published_at") or value.get("date"),
                     collected_at=value.get("collected_at") or generated_at)
                for value in data.get("recalls", [])
                if isinstance(value, dict)
            ]
        elif key == "countries" and isinstance(data, dict):
            rows = [dict(value, market=key.upper(), source_record_id=key) for key, value in data.items() if not key.startswith("_") and isinstance(value, dict)]
        else:
            rows = data if isinstance(data, list) else []
        for index, row in enumerate(rows):
            if isinstance(row, list) and len(row) >= 8:
                row = {
                    "id": row[0], "title": row[3], "market": row[4],
                    "platform": row[5], "detail": row[6], "published_at": row[7],
                    "collected_at": row[7], "source": row[5] or "official_feed",
                    "source_kind": "official" if str(row[4]).strip() in {"US", "美国"} else "traceable",
                    "source_type": "official_feed", "source_record_id": row[0],
                    "verification_status": "verified" if str(row[4]).strip() in {"US", "美国"} else "pending",
                }
            if isinstance(row, dict):
                yield key, domain, row, index


def build_source_registry_rows(only="all"):
    """Build idempotent source registry rows needed by raw records."""
    rows = registry_rows()
    used = {source_key_for_record(row) for _, _, row, _ in iter_provenance_records(only)}
    always_required = {"federal-register", "user-upload", "tikhub", "internal-system"}
    return [row for row in rows if row["source_key"] in used or row["source_key"] in always_required]


def build_source_policy_rows(registry_rows):
    """Build private authorization policies only for registered sources."""
    rows = []
    for registry in registry_rows:
        source_key = registry["source_key"]
        policy = source_access_policy(source_key)
        rows.append({"source_key": source_key, **policy})
    return rows


def history_uuid(namespace, *parts):
    """Return the same deterministic UUID produced by the SQL history_uuid()."""
    value = "|".join(str(part or "") for part in parts)
    digest = hashlib.md5(f"{namespace}:{value}".encode("utf-8")).hexdigest()
    return str(uuid.UUID(digest))


def collection_run_id(collection_run):
    """Use the collector's UUID, with a stable fallback for older ledgers."""
    if isinstance(collection_run, dict) and str(collection_run.get("run_id") or "").strip():
        return str(collection_run["run_id"]).strip()
    if not isinstance(collection_run, dict):
        collection_run = {}
    return history_uuid(
        "collection-run",
        collection_run.get("started_at") or collection_run.get("completed_at") or "unknown",
        json.dumps(collection_run.get("scope") or {}, ensure_ascii=False, sort_keys=True),
    )


def _timestamp(value, fallback=None):
    text = str(value or fallback or "").strip()
    if not text:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return text


def build_source_fetch_run_rows(collection_run, only="all"):
    """Flatten a collection ledger into one immutable row per source attempt."""
    if not isinstance(collection_run, dict):
        return []
    selected = None if only in ("all", "catalog") else only
    selected_aliases = {
        "macro": "fred_bls_macro", "cpsc": "cpsc_recalls",
        "us_market": "us_market_categories",
    }
    selected_key = selected_aliases.get(selected, selected)
    run_id = collection_run_id(collection_run)
    rows = []
    for source in collection_run.get("sources") or []:
        if not isinstance(source, dict) or not source.get("key"):
            continue
        key = str(source.get("key"))
        if selected_key and selected_key not in {key, canonical_source_key(key)}:
            continue
        source_key = canonical_source_key(source.get("source_key") or key)
        started = _timestamp(source.get("attempted_at") or collection_run.get("started_at"))
        completed = _timestamp(source.get("last_checked_at") or collection_run.get("completed_at"), started)
        status = str(source.get("status") or "skipped").lower()
        if status not in {"succeeded", "degraded", "failed", "skipped"}:
            status = "succeeded"
        rows.append({
            "id": history_uuid("source-fetch-run", run_id, key),
            "run_id": run_id,
            "source_key": source_key,
            "collector_key": key,
            "domain": str(source.get("domain") or "supporting"),
            "status": status,
            "scope": collection_run.get("scope") or {},
            "started_at": started,
            "completed_at": completed,
            "duration_ms": max(int(source.get("duration_ms") or 0), 0),
            "request_count": max(int(source.get("request_count") or 0), 0),
            "successful_requests": max(int(source.get("successful_requests") or 0), 0),
            "failed_requests": max(int(source.get("failed_requests") or 0), 0),
            "records_collected": max(int(source.get("records_collected") or 0), 0),
            "records_in_scope": max(int(source.get("records_in_scope") or 0), 0),
            "errors": source.get("errors") if isinstance(source.get("errors"), list) else [],
            "result": source,
        })
    return rows


def _stable_id_value(item, names):
    for name in names:
        value = item.get(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def _number(item, names):
    value = _stable_id_value(item, names)
    if value is None:
        return None
    try:
        return float(value) if "." in value else int(value)
    except (TypeError, ValueError):
        return None


def _rule_dimensions(item):
    aliases = {
        "fee": ("fee", "fee_desc", "feeDesc", "费用", "费用说明"),
        "commission": ("commission", "commission_rate", "commissionRate", "佣金", "佣金说明"),
        "deposit": ("deposit", "deposit_amount", "security_deposit", "securityDeposit", "保证金"),
        "fulfillment": ("fulfillment", "fulfillment_mode", "fulfillmentMode", "shipping", "logistics", "履约"),
        "prohibited": ("prohibited", "prohibited_items", "prohibitedItems", "restricted", "禁售"),
        "settlement": ("settlement", "settlement_cycle", "settlementCycle", "payout", "结算"),
        "penalty": ("penalty", "penalties", "penalty_rules", "penaltyRules", "处罚", "扣分"),
    }
    return {
        key: item[name]
        for key, names in aliases.items()
        for name in names
        if name in item and item[name] is not None
    }


def _public_payload(item, allowed):
    payload = item if isinstance(item, dict) else {}
    return {key: payload[key] for key in (allowed or []) if key in payload}


def _scope_rows_for_raw(raw, applicability_rows):
    matches = [
        row for row in applicability_rows
        if row.get("source_key") == raw.get("source_key")
        and row.get("source_record_id") == raw.get("source_record_id")
        and row.get("evidence_hash") == raw.get("evidence_hash")
    ]
    if matches:
        return matches
    item = raw.get("payload") if isinstance(raw.get("payload"), dict) else {}
    markets = raw.get("market_codes") or [None]
    platforms = raw.get("platform_keys") or [None]
    return [
        {
            "domain": raw.get("domain"), "market_code": market, "platform_key": platform,
            "category_code": None, "jurisdiction_code": None,
            "record_key": raw.get("source_record_id"),
        }
        for market in markets for platform in platforms
    ]


def _snapshot_descriptor(raw):
    item = raw.get("payload") if isinstance(raw.get("payload"), dict) else {}
    snapshot_type = str(
        item.get("snapshot_type") or item.get("snapshotType") or raw.get("domain") or ""
    ).casefold()
    kind = snapshot_type.split("_", 1)[0]
    if kind not in {"product", "shop", "content"}:
        return None
    platform = str(
        item.get("platform_key") or item.get("platform")
        or (raw.get("platform_keys") or [""])[0] or ""
    ).casefold()
    market = str(
        item.get("market_code") or item.get("market")
        or (raw.get("market_codes") or [""])[0] or ""
    ).upper()
    stable_names = {
        "product": ("platform_product_id", "product_id", "productId"),
        "shop": ("platform_shop_id", "shop_id", "shopId"),
        "content": ("platform_content_id", "content_id", "contentId"),
    }
    stable = _stable_id_value(item, stable_names[kind])
    if not stable:
        return None
    return {
        "kind": kind, "platform": platform, "market": market, "stable": stable,
        "category": item.get("category_code") or item.get("category"),
        "title": item.get("title") or item.get("name"),
    }


def _merge_entity(store, entity):
    existing = store.get(entity["id"])
    if not existing:
        store[entity["id"]] = entity
        return
    if str(entity.get("first_seen_at") or "") < str(existing.get("first_seen_at") or ""):
        existing["first_seen_at"] = entity["first_seen_at"]
    if str(entity.get("last_seen_at") or "") > str(existing.get("last_seen_at") or ""):
        existing["last_seen_at"] = entity["last_seen_at"]
    for key in ("title", "name", "source_url", "category_code"):
        if entity.get(key) and not existing.get(key):
            existing[key] = entity[key]


def build_history_rows(quality_report, raw_rows, applicability_rows, only="all"):
    """Build append-only evidence, version, snapshot and formal projection rows."""
    collection_run = quality_report.get("collection_run") if isinstance(quality_report, dict) else {}
    collection_run = collection_run if isinstance(collection_run, dict) else {}
    run_id = collection_run_id(collection_run)
    fetch_rows = build_source_fetch_run_rows(collection_run, only)
    fetch_by_source = {}
    for row in fetch_rows:
        fetch_by_source.setdefault(row["source_key"], row)

    canonical_raw = []
    for row in raw_rows or []:
        item = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        collected = _timestamp(row.get("collected_at"), collection_run.get("completed_at"))
        raw = dict(row)
        raw["id"] = history_uuid(
            "raw-source-record", row["source_key"], row["source_record_id"], row["evidence_hash"]
        )
        raw["source_fetch_run_id"] = (fetch_by_source.get(row["source_key"]) or {}).get("id")
        raw["run_id"] = run_id
        raw["collected_at"] = collected
        raw["first_seen_at"] = collected
        raw["last_seen_at"] = _timestamp(item.get("last_seen_at") or item.get("lastSeenAt"), collected)
        raw["allowed_display_fields"] = row.get("allowed_display_fields") or []
        raw["allowed_export_fields"] = row.get("allowed_export_fields") or []
        canonical_raw.append(raw)

    policy_documents = {}
    policy_versions = {}
    platform_rules = {}
    platform_versions = {}
    product_entities, product_snapshots = {}, {}
    shop_entities, shop_snapshots = {}, {}
    content_entities, content_snapshots = {}, {}
    formal_publications = {}
    version_ids = {}
    snapshot_ids = {}

    for raw in canonical_raw:
        item = raw.get("payload") if isinstance(raw.get("payload"), dict) else {}
        domain = raw.get("domain")
        collected = raw["collected_at"]
        if domain in {"policy", "tax", "access"}:
            doc_id = history_uuid("policy-document", raw["source_key"], domain, raw["source_record_id"])
            policy_documents[doc_id] = {
                "id": doc_id, "source_key": raw["source_key"],
                "policy_document_id": raw["source_record_id"], "domain": domain,
                "authority_document_number": item.get("document_number") or item.get("documentNumber"),
                "title": str(item.get("title") or raw["source_record_id"]),
                "source_url": raw.get("source_url"), "market_codes": raw.get("market_codes") or [],
                "jurisdiction_codes": raw.get("jurisdiction_codes") or [],
                "category_codes": raw.get("category_codes") or [],
                "first_seen_at": collected, "last_seen_at": raw.get("last_seen_at") or collected,
                "metadata": {"source_type": raw.get("source_type")},
            }
            version_id = history_uuid("policy-version", doc_id, raw["evidence_hash"])
            version_ids[(raw["source_key"], raw["source_record_id"], raw["evidence_hash"], None)] = version_id
            policy_versions[version_id] = {
                "id": version_id, "policy_document_id": doc_id,
                "raw_source_record_id": raw["id"],
                "version_label": item.get("version") or item.get("version_label"),
                "title": str(item.get("title") or raw["source_record_id"]),
                "summary": item.get("summary") or item.get("detail"),
                "published_at": raw.get("published_at"), "effective_from": raw.get("effective_from"),
                "effective_to": raw.get("effective_to"), "collected_at": collected,
                "evidence_hash": raw["evidence_hash"],
                "changed_fields": item.get("changed_fields") or [], "content": item,
            }

        if domain == "rule":
            for scope in _scope_rows_for_raw(raw, applicability_rows):
                platform_rule_id = str(item.get("rule_key") or raw["source_record_id"])
                scope_parts = (
                    scope.get("market_code"), scope.get("platform_key"),
                    scope.get("category_code"), scope.get("jurisdiction_code"),
                )
                entity_id = history_uuid(
                    "platform-rule", raw["source_key"], platform_rule_id, *scope_parts
                )
                platform_rules[entity_id] = {
                    "id": entity_id, "source_key": raw["source_key"],
                    "platform_rule_id": platform_rule_id,
                    "title": str(item.get("title") or raw["source_record_id"]),
                    "source_url": raw.get("source_url"), "market_code": scope_parts[0],
                    "platform_key": scope_parts[1], "category_code": scope_parts[2],
                    "jurisdiction_code": scope_parts[3], "first_seen_at": collected,
                    "last_seen_at": raw.get("last_seen_at") or collected,
                    "metadata": {"source_type": raw.get("source_type")},
                }
                version_id = history_uuid("platform-rule-version", entity_id, raw["evidence_hash"])
                version_ids[(raw["source_key"], raw["source_record_id"], raw["evidence_hash"], scope_parts)] = version_id
                platform_versions[version_id] = {
                    "id": version_id, "platform_rule_id": entity_id,
                    "raw_source_record_id": raw["id"],
                    "version_label": item.get("rule_version") or item.get("version"),
                    "title": str(item.get("title") or raw["source_record_id"]),
                    "summary": item.get("summary") or item.get("detail"),
                    "rule_dimensions": _rule_dimensions(item),
                    "published_at": raw.get("published_at"), "effective_from": raw.get("effective_from"),
                    "effective_to": raw.get("effective_to"), "collected_at": collected,
                    "evidence_hash": raw["evidence_hash"],
                    "changed_fields": item.get("changed_fields") or [], "content": item,
                }

        descriptor = _snapshot_descriptor(raw)
        if descriptor:
            kind, platform, market, stable = (
                descriptor["kind"], descriptor["platform"], descriptor["market"], descriptor["stable"]
            )
            entity_id = history_uuid(f"{kind}-entity", raw["source_key"], platform, stable, market)
            entity = {
                "id": entity_id, "source_key": raw["source_key"], "platform_key": platform,
                f"platform_{kind}_id": stable, "market_code": market,
                "category_code": descriptor["category"], "title": descriptor["title"],
                "source_url": raw.get("source_url"), "first_seen_at": collected,
                "last_seen_at": raw.get("last_seen_at") or collected, "metadata": item,
            }
            snapshot_id = history_uuid(f"{kind}-snapshot", entity_id, collected, raw["evidence_hash"])
            common = {
                "id": snapshot_id, f"{kind}_entity_id": entity_id,
                "raw_source_record_id": raw["id"], "collected_at": collected,
                "first_seen_at": collected, "last_seen_at": raw.get("last_seen_at") or collected,
                "published_at": raw.get("published_at"), "evidence_hash": raw["evidence_hash"],
            }
            if kind == "product":
                _merge_entity(product_entities, entity)
                product_snapshots[snapshot_id] = {
                    **common, "price": _number(item, ("price", "selling_price", "sellingPrice")),
                    "currency": item.get("currency"), "sales": _number(item, ("sales", "sold", "volume")),
                    "rating": _number(item, ("rating",)), "review_count": _number(item, ("review_count", "reviewCount", "reviews")),
                    "inventory": _number(item, ("inventory", "stock")), "metrics": item,
                }
            elif kind == "shop":
                _merge_entity(shop_entities, entity)
                shop_snapshots[snapshot_id] = {
                    **common, "gmv": _number(item, ("gmv", "GMV")),
                    "followers": _number(item, ("followers", "fans")),
                    "product_count": _number(item, ("product_count", "productCount")),
                    "sales": _number(item, ("sales", "sold", "volume")), "rating": _number(item, ("rating",)),
                    "metrics": item,
                }
            else:
                _merge_entity(content_entities, entity)
                content_snapshots[snapshot_id] = {
                    **common, "views": _number(item, ("views", "plays", "view_count")),
                    "likes": _number(item, ("likes",)), "comments": _number(item, ("comments",)),
                    "shares": _number(item, ("shares",)), "conversions": _number(item, ("conversions", "orders")),
                    "engagement_rate": _number(item, ("engagement_rate", "engagementRate")), "metrics": item,
                }
            snapshot_ids[(raw["id"], kind)] = snapshot_id

    raw_by_key = {
        (row["source_key"], row["source_record_id"], row["evidence_hash"]): row
        for row in canonical_raw
    }
    for app in applicability_rows or []:
        raw = raw_by_key.get((app.get("source_key"), app.get("source_record_id"), app.get("evidence_hash")))
        if not raw or raw.get("publication_status") != "eligible" or raw.get("verification_status") not in {"verified", "uploaded"}:
            continue
        scope_parts = (
            app.get("market_code"), app.get("platform_key"),
            app.get("category_code"), app.get("jurisdiction_code"),
        )
        publication_id = history_uuid(
            "formal-publication", raw["id"], app.get("record_key"), *scope_parts
        )
        pub_type = (
            "policy" if app.get("domain") in {"policy", "tax", "access"}
            else ("platform_rule" if app.get("domain") == "rule" else "market_record")
        )
        version_id = version_ids.get(
            (raw["source_key"], raw["source_record_id"], raw["evidence_hash"], scope_parts)
        ) or version_ids.get((raw["source_key"], raw["source_record_id"], raw["evidence_hash"], None))
        formal_publications[publication_id] = {
            "id": publication_id, "source_key": raw["source_key"],
            "raw_source_record_id": raw["id"],
            "policy_version_id": version_id if pub_type == "policy" else None,
            "platform_rule_version_id": version_id if pub_type == "platform_rule" else None,
            "publication_type": pub_type, "domain": app.get("domain"),
            "record_key": app.get("record_key") or raw["source_record_id"],
            "market_code": app.get("market_code"), "platform_key": app.get("platform_key"),
            "category_code": app.get("category_code"), "jurisdiction_code": app.get("jurisdiction_code"),
            "status": "active",
            "title": raw.get("payload", {}).get("title") or app.get("record_key"),
            "summary": raw.get("payload", {}).get("summary") or raw.get("payload", {}).get("detail"),
            "source_url": raw.get("source_url"), "published_at": raw.get("published_at"),
            "effective_from": raw.get("effective_from"), "effective_to": raw.get("effective_to"),
            "collected_at": raw["collected_at"], "first_seen_at": raw["collected_at"],
            "last_seen_at": raw.get("last_seen_at") or raw["collected_at"],
            "evidence_hash": raw["evidence_hash"],
            "public_payload": _public_payload(raw.get("payload"), raw.get("allowed_display_fields")),
        }
        app["formal_publication_id"] = publication_id

    return {
        "source_fetch_runs": fetch_rows, "raw_source_records": canonical_raw,
        "policy_documents": list(policy_documents.values()), "policy_versions": list(policy_versions.values()),
        "platform_rules": list(platform_rules.values()), "platform_rule_versions": list(platform_versions.values()),
        "product_entities": list(product_entities.values()), "product_snapshots": list(product_snapshots.values()),
        "shop_entities": list(shop_entities.values()), "shop_snapshots": list(shop_snapshots.values()),
        "content_entities": list(content_entities.values()), "content_snapshots": list(content_snapshots.values()),
        "formal_publications": list(formal_publications.values()),
    }


def build_raw_record_rows(quality_report=None, only="all"):
    """Build the auditable raw-record projection for Supabase."""
    rows = []
    _, platform_catalog, _, _, _ = _scope_catalog()
    for dataset_key, domain, item, index in iter_provenance_records(only):
        platform_names = record_platform_names(item, include_display_field=domain == "rule")
        category_codes = record_category_codes(item)
        if platform_names and not platform_names <= DEFAULT_SCOPE_PLATFORMS:
            continue
        if category_codes and not category_codes <= DEFAULT_SCOPE_CATEGORY_CODES:
            continue
        industry_advisory = is_industry_advisory(item)
        source_kind = "traceable" if industry_advisory else (infer_source_kind(item) or "traceable")
        # Legacy third-party articles may satisfy the compatibility URL/date
        # inference, but that must not become an automatic verification event.
        verification_status = "pending" if industry_advisory else (infer_verification_status(item, source_kind) or "pending")
        source_type = "licensed_provider" if industry_advisory else effective_source_type(item, source_kind)
        source_record_id = source_record_id_for(item) or str(item.get("id") or f"{dataset_key}-{index}")
        source_key = source_key_for_record(item)
        source_policy = source_access_policy(source_key)
        source_lineage = classify_source_for_publication(source_key)
        payload = dict(item)
        evidence_hash = str(item.get("evidence_hash") or hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()).lower()
        market_codes = set(record_scope_codes(item))
        if industry_advisory:
            detected_codes = explicit_industry_market_codes(item) + infer_industry_market_codes(item)
            if detected_codes:
                market_codes = set(detected_codes)
        raw_row = {
            "source_key": source_key,
            "domain": domain,
            "source_record_id": source_record_id,
            "normalized_record_key": str(item.get("id") or source_record_id),
            "market_codes": sorted(market_codes),
            "platform_keys": sorted(_platform_keys(item, platform_catalog)),
            "category_codes": sorted(category_codes),
            "jurisdiction_codes": item.get("jurisdiction_codes") or item.get("jurisdictionCodes") or [],
            "source_kind": source_kind,
            "source_type": source_type,
            "source_category": source_lineage["source_category"],
            "source_class": (
                "industry_advisory" if industry_advisory
                else str(item.get("source_class") or item.get("sourceClass") or "") or None
            ),
            "verification_status": verification_status,
            "source_url": source_url_for(item) or None,
            "collected_at": item.get("collected_at") or item.get("collectedAt") or None,
            "retrieved_at": item.get("retrieved_at") or item.get("retrievedAt") or None,
            "published_at": item.get("published_at") or item.get("publishedAt") or None,
            "effective_from": _date_value(item.get("effective_from") or item.get("effective_date") or item.get("effectiveDate")),
            "effective_to": _date_value(item.get("effective_to") or item.get("effectiveTo")),
            "verified_at": None if industry_advisory else (item.get("verified_at") or item.get("verifiedAt") or None),
            "verification_notes": (
                "第三方行业资讯：仅作可追溯参考，未完成官方记录级核验。"
                if industry_advisory else
                (item.get("verification_notes") or item.get("verificationNotes") or (
                "缺少记录级来源，保留在原始证据层，暂不进入正式统计。"
                if verification_status == "pending" else None
                ))
            ),
            "evidence_hash": evidence_hash,
            "payload": payload,
            "license_class": source_policy["license_class"],
            "access_class": source_policy["access_class"],
            "redistribution_allowed": source_policy["redistribution_allowed"],
            "publication_status": "eligible" if source_lineage["publishable"] else "quarantined",
            "quarantine_reason": None if source_lineage["publishable"] else (
                "来源授权或商业再分发权限未确认；仅保留在隔离证据层。"
            ),
            "allowed_display_fields": source_policy.get("allowed_display_fields") or [],
            "allowed_export_fields": source_policy.get("allowed_export_fields") or [],
            "retention_until": (
                datetime.now(timezone.utc).replace(microsecond=0)
                + timedelta(days=source_policy["retention_days"])
            ),
            "status": "active" if verification_status != "rejected" else "rejected",
        }
        if not source_lineage["publishable"]:
            raw_row = quarantine_unlicensed_record(raw_row, source_key, raw_row["quarantine_reason"])
        rows.append(raw_row)
        rows[-1]["retention_until"] = rows[-1]["retention_until"].isoformat()
    return rows


def iter_private_artifacts(root=ROOT):
    """Yield restricted collector artifacts without ever adding them to Git."""
    root_path = Path(root).resolve()
    seen = set()
    for pattern, source_key, artifact_kind, retention_days in PRIVATE_ARTIFACT_SPECS:
        for path in sorted(root_path.glob(pattern)):
            if not path.is_file():
                continue
            relative_path = path.resolve().relative_to(root_path).as_posix()
            if relative_path.startswith("data/us_market/") and path.suffix == ".json":
                special = {"macro_indicators", "cpsc_recalls", "index"}
                if path.stem not in special and path.stem not in DEFAULT_SCOPE_CATEGORY_CODES:
                    continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            yield {
                "path": resolved,
                "relative_path": relative_path,
                "source_key": source_key,
                "artifact_kind": artifact_kind,
                "retention_days": retention_days,
            }


def sync_private_artifacts(supa_url, supa_key, run_id, *, root=ROOT, dry_run=False):
    """Upload restricted local outputs to the service-only Storage bucket."""
    artifacts = list(iter_private_artifacts(root))
    if dry_run:
        return len(artifacts), []
    uploaded = []
    failures = []
    for artifact in artifacts:
        try:
            row = upload_private_artifact(
                supa_url,
                supa_key,
                artifact["path"],
                run_id=run_id,
                source_key=artifact["source_key"],
                artifact_kind=artifact["artifact_kind"],
                retention_days=artifact["retention_days"],
                metadata={"repository_relative_path": artifact["relative_path"]},
            )
            uploaded.append(row)
        except Exception as error:
            failures.append(f"{artifact['relative_path']}: {error}")
    return len(uploaded), failures


def _scope_catalog():
    manifest = load_json(MARKET_SCOPE_PATH)
    if not isinstance(manifest, dict):
        return {}, {}, {}, {}, {}
    markets = {
        str(row.get('code', '')).strip().upper(): row
        for row in manifest.get('markets', [])
        if isinstance(row, dict) and row.get('code')
    }
    platforms = {
        str(row.get('key', '')).strip(): row
        for row in manifest.get('platforms', [])
        if isinstance(row, dict) and row.get('key')
    }
    categories = {
        str(row.get('code', '')).strip(): row
        for row in manifest.get('categories', [])
        if isinstance(row, dict) and row.get('code')
    }
    jurisdictions = {
        str(row.get('code', '')).strip(): row
        for row in manifest.get('jurisdictions', [])
        if isinstance(row, dict) and row.get('code')
    }
    relations = {}
    for row in manifest.get('market_platforms', []) or manifest.get('marketPlatforms', []) or []:
        if not isinstance(row, dict):
            continue
        market_code = str(row.get('market_code') or row.get('marketCode') or '').strip().upper()
        platform_key = str(row.get('platform_key') or row.get('platformKey') or '').strip()
        if market_code and platform_key:
            relations.setdefault(market_code, set()).add(platform_key)
    return markets, platforms, categories, jurisdictions, relations


def _values(value):
    if value is None or value == '':
        return []
    if isinstance(value, (list, tuple, set)):
        return [item for item in value if item is not None and str(item).strip()]
    return [value]


def _alias_lookup(rows):
    lookup = {}
    for key, row in rows.items():
        lookup[str(key).casefold()] = key
        for alias in _values(row.get('aliases')):
            lookup[str(alias).strip().casefold()] = key
        for name_key in ('name', 'label'):
            if row.get(name_key):
                lookup[str(row[name_key]).strip().casefold()] = key
    return lookup


def _platform_keys(item, platforms):
    lookup = _alias_lookup(platforms)
    values = _values(item.get('platform_keys') or item.get('platformKeys'))
    values += _values(item.get('platform') or item.get('platforms'))
    keys = []
    for value in values:
        raw = str(value).strip().casefold()
        if raw in {'multi', 'global', 'all'}:
            continue
        key = lookup.get(raw)
        if key and key not in keys:
            keys.append(key)
    return keys


def _category_codes(item, categories):
    lookup = _alias_lookup(categories)
    values = _values(item.get('category_codes') or item.get('categoryCodes'))
    values += _values(item.get('category') or item.get('category_key'))
    codes = []
    for value in values:
        key = lookup.get(str(value).strip().casefold())
        if key and key not in codes:
            codes.append(key)
    return codes


def _market_codes(item, markets):
    # record_scope_codes already applies the shared manifest aliases.
    return [code for code in sorted(record_scope_codes(item)) if code in markets]


def _jurisdiction_codes(item, market_code, markets, jurisdictions):
    values = _values(item.get('jurisdiction_codes') or item.get('jurisdictionCodes'))
    values += _values(item.get('jurisdiction_code') or item.get('jurisdictionCode'))
    lookup = _alias_lookup(jurisdictions)
    codes = []
    for value in values:
        key = lookup.get(str(value).strip().casefold())
        if key and key not in codes:
            codes.append(key)
    if codes:
        return codes
    market = markets.get(market_code, {})
    fallback = [code for code in _values(market.get('jurisdiction_codes') or market.get('jurisdictionCodes')) if code in jurisdictions]
    return fallback or ([market_code] if market_code in jurisdictions else [])


def _date_value(value):
    text = str(value or '').strip()
    if not text:
        return None
    return text[:10] if len(text) >= 10 and text[4] == '-' and text[7] == '-' else text


def _rule_version(item):
    """Return an explicit platform rule version without deriving one from dates."""
    value = item.get('rule_version') or item.get('ruleVersion') or item.get('version') or item.get('version_label') or item.get('versionLabel')
    return str(value).strip() if value is not None and str(value).strip() else None


def _applicability_change_type(item):
    """Map collector comparison states to the formal projection vocabulary."""
    value = str(item.get('change_type') or item.get('changeType') or '').strip()
    aliases = {
        'initial_record': 'created',
        'source_snapshot_changed': 'updated',
        'unchanged': None,
    }
    value = aliases.get(value, value or None)
    allowed = {'created', 'updated', 'rate_change', 'requirement_change', 'suspended', 'expired'}
    return value if value in allowed else None


def build_applicability_rows(quality_report=None, only="all"):
    """Build only formal, current-scope normalized rows for public reads."""
    markets, platforms, categories, jurisdictions, market_platforms = _scope_catalog()
    rows = []
    for dataset_key, domain, item, index in iter_provenance_records(only):
        source_key = source_key_for_record(item)
        # Industry articles are intentionally retained in raw_data_records,
        # but never promoted to the formal market applicability projection.
        if is_industry_advisory(item) or not redistribution_allowed_for_record(item):
            continue
        quality = record_quality(item, require_scope=True)
        if not quality.get('formal'):
            continue
        market_codes = _market_codes(item, markets)
        if not market_codes:
            continue
        declared_platform_keys = _platform_keys(item, platforms)
        if domain == 'rule' and (
            _values(item.get('platform_keys') or item.get('platformKeys'))
            or _values(item.get('platform') or item.get('platforms'))
        ) and not declared_platform_keys:
            # A rule explicitly tied to an unregistered platform must not be
            # downgraded to a market-wide rule by the normalized projection.
            continue
        category_codes = _category_codes(item, categories) or [None]
        declared_category_values = (
            _values(item.get('category_codes') or item.get('categoryCodes'))
            + _values(item.get('category_code') or item.get('categoryCode'))
        )
        if declared_category_values and category_codes == [None]:
            continue
        source_record_id = source_record_id_for(item) or str(item.get('id') or f'{dataset_key}-{index}')
        evidence_hash = str(item.get('evidence_hash') or hashlib.sha256(json.dumps(item, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()).lower()
        source_lineage = classify_source_for_publication(source_key)
        for market_code in market_codes:
            allowed_categories = {
                str(value).strip()
                for value in (
                    markets.get(market_code, {}).get('category_keys')
                    or markets.get(market_code, {}).get('categoryKeys')
                    or []
                )
                if str(value).strip()
            }
            market_category_codes = [
                code for code in category_codes
                if code is None or not allowed_categories or code in allowed_categories
            ]
            if category_codes != [None] and not market_category_codes:
                continue
            platform_keys = declared_platform_keys
            allowed_platforms = market_platforms.get(market_code)
            if allowed_platforms and platform_keys:
                platform_keys = [key for key in platform_keys if key in allowed_platforms]
            platform_keys = platform_keys or [None]
            jurisdiction_codes = _jurisdiction_codes(item, market_code, markets, jurisdictions) or [None]
            for platform in platform_keys:
                for category in market_category_codes:
                    for jurisdiction_code in jurisdiction_codes:
                        record_version = _rule_version(item) if domain in ('policy', 'tax', 'access', 'rule') else None
                        stable_key = '|'.join([
                            domain, str(item.get('id') or source_record_id), market_code,
                            str(platform or ''), str(category or ''), str(jurisdiction_code or ''), str(record_version or ''),
                        ])
                        digest = hashlib.md5(stable_key.encode('utf-8')).hexdigest()
                        base_record_key = str(item.get('id') or source_record_id)
                        # Keep historical rule versions as separate applicability
                        # records while preserving the legacy key when no
                        # explicit version was supplied.
                        record_key = base_record_key + '@' + record_version if record_version else base_record_key
                        translation = item.get('translation') if isinstance(item.get('translation'), dict) else {}
                        rows.append({
                            'id': f'{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:32]}',
                            'domain': domain,
                            'record_key': record_key,
                            'record_version': record_version,
                            'change_type': _applicability_change_type(item),
                            'change_summary': item.get('change_summary') or item.get('changeSummary') or None,
                            'locale': 'zh-CN' if item.get('title_zh') or item.get('titleZh') else None,
                            'translation_status': translation.get('status') or None,
                            'market_code': market_code,
                            'platform_key': platform,
                            'category_code': category,
                            'jurisdiction_code': jurisdiction_code,
                            'status': 'active',
                            'verification_status': quality.get('verification_status'),
                            'source_kind': quality.get('source_kind'),
                            'source_key': source_key,
                            'source_category': source_lineage['source_category'],
                            'source_record_id': source_record_id,
                            'source_url': source_url_for(item) or None,
                            'source_type': effective_source_type(item, quality.get('source_kind')),
                            'source_class': (
                                'industry_advisory' if is_industry_advisory(item)
                                else str(item.get('source_class') or item.get('sourceClass') or '') or None
                            ),
                            'collected_at': item.get('collected_at') or item.get('collectedAt') or None,
                            'retrieved_at': item.get('retrieved_at') or item.get('retrievedAt') or None,
                            'published_at': item.get('published_at') or item.get('publishedAt') or None,
                            'effective_from': _date_value(item.get('effective_from') or item.get('effective_date') or item.get('effectiveDate')),
                            'effective_to': _date_value(item.get('effective_to') or item.get('effectiveTo')),
                            'verified_at': item.get('verified_at') or item.get('verifiedAt') or None,
                            'verification_notes': item.get('verification_notes') or item.get('verificationNotes') or None,
                            'evidence_hash': evidence_hash,
                            'payload': item,
                        })
    return rows

try:
    SSL_CTX = ssl.create_default_context()
except Exception:
    SSL_CTX = None


def get_config():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        return None, None
    return url, key


def legacy_tables_enabled():
    """Return whether the optional legacy table fan-out was explicitly enabled."""
    return os.environ.get("SUPABASE_SYNC_LEGACY_TABLES", "").strip().lower() in {
        "1", "true", "yes", "on"
    }


def supabase_request(url, key, method="GET", data=None, timeout=30, prefer=None):
    """Make a Supabase REST API request."""
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer or "return=minimal,resolution=merge-duplicates",
    }
    
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        kwargs = {"timeout": timeout}
        if SSL_CTX:
            kwargs["context"] = SSL_CTX
        with urllib.request.urlopen(req, **kwargs) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")[:500]
        print(f"  [ERROR] HTTP {e.code}: {error_body}")
        return None
    except Exception as e:
        print(f"  [ERROR] Request failed: {e}")
        return None


def supabase_upsert(supa_url, key, table, rows, conflict_key="id"):
    """Upsert rows into a Supabase table."""
    if not rows:
        return 0
    
    url = f"{supa_url}/rest/v1/{table}"
    if conflict_key:
        url += "?on_conflict=" + urllib.parse.quote(conflict_key, safe=",")
    status = supabase_request(url, key, method="POST", data=rows)
    
    if status and status in (200, 201):
        return len(rows)
    else:
        print(f"  [WARN] Upsert to {table} returned status {status}")
        # Try batch upsert in smaller chunks
        if len(rows) > 10:
            chunk_size = 10
            total = 0
            for i in range(0, len(rows), chunk_size):
                chunk = rows[i:i+chunk_size]
                s = supabase_request(url, key, method="POST", data=chunk)
                if s and s in (200, 201):
                    total += len(chunk)
            return total
        return 0


def supabase_insert_ignore(supa_url, key, table, rows, conflict_key=None):
    """Insert immutable history rows without turning a retry into an UPDATE."""
    if not rows:
        return 0
    url = f"{supa_url}/rest/v1/{table}"
    if conflict_key:
        url += "?on_conflict=" + urllib.parse.quote(conflict_key, safe=",")
    prefer = "return=minimal,resolution=ignore-duplicates"
    status = supabase_request(url, key, method="POST", data=rows, prefer=prefer)
    if status in (200, 201):
        return len(rows)
    if len(rows) > 10:
        total = 0
        for index in range(0, len(rows), 10):
            chunk = rows[index:index + 10]
            if supabase_request(url, key, method="POST", data=chunk, prefer=prefer) in (200, 201):
                total += len(chunk)
        return total
    return 0


def transform_policies(data):
    """Transform policies.json data for Supabase."""
    items = data.get("items", [])
    rows = []
    for item in items:
        row_id = item.get("id", hashlib.md5(item.get("title", "").encode()).hexdigest()[:12])
        rows.append({
            "id": f"pol-{row_id}",
            "category": item.get("category", ""),
            "title": item.get("title", ""),
            "region": item.get("region", ""),
            "summary": item.get("summary", ""),
            "impact_level": item.get("impact_level", "medium"),
            "source_url": item.get("source_url", ""),
            "published_at": item.get("published_at", ""),
            "effective_date": item.get("effective_date", ""),
            "raw_data": json.dumps(item, ensure_ascii=False),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return rows


def transform_rules(data):
    """Transform rules.json data for Supabase."""
    items = data.get("items", [])
    rows = []
    for item in items:
        row_id = item.get("id", hashlib.md5(item.get("title", "").encode()).hexdigest()[:12])
        rows.append({
            "id": f"rule-{row_id}",
            "title": item.get("title", ""),
            "market": item.get("market", ""),
            "platform": item.get("platform", ""),
            "detail": item.get("detail", ""),
            "severity": item.get("severity", "medium"),
            "source": item.get("source", ""),
            "source_url": item.get("source_url", ""),
            "raw_data": json.dumps(item, ensure_ascii=False),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return rows


def transform_alerts(data):
    """Transform alerts.json data for Supabase."""
    if isinstance(data, list):
        alerts = data
    else:
        alerts = data.get("alerts", data.get("items", []))
    rows = []
    for alert in alerts:
        if isinstance(alert, list) and len(alert) >= 8:
            # Array format from alertsFull: [id, type, level, title, country, platform, detail, date, read]
            row_id = alert[0]
            rows.append({
                "id": f"alert-{row_id}",
                "type": alert[1],
                "level": alert[2],
                "title": alert[3],
                "market": alert[4],
                "platform": alert[5],
                "detail": alert[6],
                "date": alert[7],
                "raw_data": json.dumps(alert, ensure_ascii=False),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        elif isinstance(alert, dict):
            row_id = alert.get("id", hashlib.md5(alert.get("title", "").encode()).hexdigest()[:12])
            rows.append({
                "id": f"alert-{row_id}",
                "type": alert.get("type", ""),
                "level": alert.get("level", ""),
                "title": alert.get("title", ""),
                "market": alert.get("market", alert.get("country", "")),
                "platform": alert.get("platform", ""),
                "detail": alert.get("detail", ""),
                "date": alert.get("date", ""),
                "raw_data": json.dumps(alert, ensure_ascii=False),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
    return rows


def transform_platforms(data):
    """Transform platforms.json data for Supabase."""
    if isinstance(data, list):
        platforms = data
    else:
        platforms = data.get("platforms", [])
    rows = []
    for p in platforms:
        row_id = hashlib.md5(p.get("name", "").encode()).hexdigest()[:12]
        rows.append({
            "id": f"plat-{row_id}",
            "name": p.get("name", ""),
            "type": p.get("type", ""),
            "market": p.get("market", ""),
            "commission": p.get("commission", ""),
            "feeDesc": p.get("feeDesc", ""),
            "raw_data": json.dumps(p, ensure_ascii=False),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return rows


def transform_us_market(filepath):
    """Transform a us_market/*.json file for Supabase."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return []
    
    cat_key = os.path.basename(filepath).replace(".json", "")
    rows = []
    
    # Store the entire category data as one row
    row_id = hashlib.md5(f"us_market_{cat_key}".encode()).hexdigest()[:12]
    rows.append({
        "id": f"usm-{row_id}",
        "category_key": cat_key,
        "market": data.get("meta", {}).get("market", ""),
        "data_json": json.dumps(data, ensure_ascii=False),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return rows


def load_json(path):
    """Load JSON file, return None on failure."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  [WARN] Cannot load {path}: {e}")
        return None


def build_market_data_rows(quality_report, only="all"):
    """Build the public KV rows consumed by the browser data layer."""
    specs = {
        "policies": "policies.json",
        "taxes": "taxes.json",
        "access_requirements": "access_requirements.json",
        "rules": "rules.json",
        "alerts": "alerts.json",
        "platforms": "platforms.json",
        "countries": "countries.json",
    }
    selected = set(specs) if only == "all" else {only}
    rows = []
    for key, filename in specs.items():
        if key not in selected:
            continue
        data = load_json(os.path.join(DATA_DIR, filename))
        if data is None:
            continue
        if key == "countries" and isinstance(data, dict):
            data = {name: value for name, value in data.items() if not name.startswith("_")}
        data = public_market_data_payload(key, data)
        quality = quality_report.get("datasets", {}).get(key, {})
        rows.append({
            "key": key,
            "data": data,
            "meta": {
                "source": filename,
                "updated_at": quality.get("updated_at"),
                "quality_status": quality.get("status", "unknown"),
                "record_count": quality.get("records", 0),
                "raw_records": quality.get("raw_records", quality.get("records", 0)),
                "scoped_records": quality.get("scoped_records", 0),
                "formal_records": quality.get("formal_records", 0),
                "excluded_records": quality.get("excluded_records", 0),
            },
        })
    if only == "all":
        rows.append({
            "key": "quality_report",
            "data": quality_report,
            "meta": {
                "source": "quality_report.json",
                "updated_at": quality_report.get("generated_at"),
                "quality_status": quality_report.get("status", "unknown"),
            },
        })
    return rows


def build_catalog_rows():
    """Transform the metadata-only local manifest for catalog table upserts."""
    manifest = load_json(MARKET_SCOPE_PATH)
    if not isinstance(manifest, dict):
        return {}
    markets = manifest.get("markets") if isinstance(manifest.get("markets"), list) else []
    platforms = manifest.get("platforms") if isinstance(manifest.get("platforms"), list) else []
    relations = manifest.get("market_platforms") or manifest.get("marketPlatforms") or []
    jurisdictions = manifest.get("jurisdictions") if isinstance(manifest.get("jurisdictions"), list) else []
    categories = manifest.get("categories") if isinstance(manifest.get("categories"), list) else []
    templates = manifest.get("report_templates") or manifest.get("reportTemplates") or []
    return {
        "market_catalog": [
            {
                "code": str(item.get("code", "")).upper(),
                "key": item.get("key") or str(item.get("code", "")).lower(),
                "name": item.get("name") or item.get("label") or item.get("code"),
                "label": item.get("label"),
                "flag": item.get("flag"),
                "region_code": item.get("region_code") or item.get("regionCode"),
                "region_name": item.get("region_name") or item.get("regionName"),
                "jurisdiction_codes": item.get("jurisdiction_codes") or item.get("jurisdictionCodes") or [],
                "platform_keys": item.get("platform_keys") or item.get("platformKeys") or [],
                "category_keys": item.get("category_keys") or item.get("categoryKeys") or [],
                "status": item.get("status", "active"),
                "data_status": item.get("data_status") or item.get("dataStatus") or "configured",
                "metadata": {
                    **(item.get("metadata") if isinstance(item.get("metadata"), dict) else {}),
                    **({"data_sources": item.get("data_sources") or item.get("dataSources")}
                       if item.get("data_sources") or item.get("dataSources") else {}),
                },
            }
            for item in markets if isinstance(item, dict) and item.get("code")
        ],
        "platform_catalog": [
            {
                "key": item.get("key"),
                "name": item.get("name") or item.get("key"),
                "kind": item.get("kind", "marketplace"),
                "aliases": item.get("aliases") or [],
                "status": item.get("status", "active"),
            }
            for item in platforms if isinstance(item, dict) and item.get("key")
        ],
        "market_platforms": [
            {
                "market_code": str(item.get("market_code") or item.get("marketCode") or "").upper(),
                "platform_key": item.get("platform_key") or item.get("platformKey"),
                "status": item.get("status", "active"),
                "data_status": item.get("data_status") or item.get("dataStatus") or "unknown",
                "label": item.get("label"),
            }
            for item in relations
            if isinstance(item, dict)
            and (item.get("market_code") or item.get("marketCode"))
            and (item.get("platform_key") or item.get("platformKey"))
        ],
        "jurisdiction_catalog": [
            {
                "code": item.get("code"), "name": item.get("name") or item.get("code"),
                "type": item.get("type", "country"), "parent_code": item.get("parent_code") or item.get("parentCode"),
                "status": item.get("status", "active"),
            }
            for item in jurisdictions if isinstance(item, dict) and item.get("code")
        ],
        "category_profiles": [
            {
                "code": item.get("code"), "name": item.get("name") or item.get("code"),
                "aliases": item.get("aliases") or [],
                "required_fields": item.get("required_fields") or item.get("requiredFields") or [],
                "report_modules": item.get("report_modules") or item.get("reportModules") or [],
                "status": item.get("status", "active"),
                "data_status": item.get("data_status") or item.get("dataStatus") or "schema_only",
            }
            for item in categories if isinstance(item, dict) and item.get("code")
        ],
        "report_template_catalog": [
            {
                "id": item.get("id") or item.get("code"), "code": item.get("code") or item.get("id"),
                "version": item.get("version", 1), "name": item.get("name") or item.get("code"),
                "market_codes": item.get("market_codes") or item.get("marketCodes") or [],
                "platform_keys": item.get("platform_keys") or item.get("platformKeys") or [],
                "category_codes": item.get("category_codes") or item.get("categoryCodes") or [],
                "required_domains": item.get("required_domains") or item.get("requiredDomains") or [],
                "modules": item.get("modules") or [], "status": item.get("status", "active"),
                "data_status": item.get("data_status") or item.get("dataStatus") or "schema_only",
            }
            for item in templates if isinstance(item, dict) and (item.get("id") or item.get("code"))
        ],
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Sync data to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually write to Supabase")
    parser.add_argument("--only", choices=["catalog", "policies", "taxes", "access_requirements", "rules", "alerts", "platforms", "countries", "macro", "cpsc", "us_market", "all"],
                        default="all", help="Only sync specific data type")
    args = parser.parse_args()

    # Re-run the gate here so a manual sync cannot bypass the workflow check.
    quality_report = validate_all()
    write_report(quality_report, DEFAULT_REPORT)
    if not quality_report.get("publishable"):
        print(f"[SYNC] ERROR: data quality gate is {quality_report.get('status')}; refusing to publish")
        return 3
    collection_run = quality_report.get("collection_run")
    if not isinstance(collection_run, dict):
        print("[SYNC] ERROR: collection run metadata is missing; refusing to publish")
        return 3
    if collection_run.get("missing_pipeline_sources") or collection_run.get("core_failures"):
        print("[SYNC] ERROR: collection pipeline is incomplete; refusing to publish")
        return 3
    
    supa_url, supa_key = get_config()
    
    if not supa_url or not supa_key:
        if args.dry_run:
            supa_url, supa_key = "https://dry-run.invalid", "dry-run"
        else:
            print("[SYNC] ERROR: SUPABASE_URL or SUPABASE_SERVICE_KEY not set")
            return 2
    
    if args.dry_run:
        print("[SYNC] DRY RUN MODE - no data will be written\n")
    
    summary = {
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": args.dry_run,
        "collection_run": collection_run,
        "quality_report_generated_at": quality_report.get("generated_at"),
        "results": {},
    }
    failures = []
    
    # The production frontend reads the public market_data KV bundle. Legacy
    # fan-out is opt-in because older projects use different column names and
    # do not necessarily provision every category table.
    legacy_sync = legacy_tables_enabled()
    if legacy_sync:
        print("[SYNC] Legacy table fan-out enabled by SUPABASE_SYNC_LEGACY_TABLES")
    else:
        print("[SYNC] Legacy table fan-out disabled; publishing market_data bundle only")

    # Applicability rows reference these catalogs through foreign keys, so a
    # full sync must publish every scope directory before factual records.
    if args.only in ("catalog", "all"):
        print("[SYNC] Processing market scope catalog...")
        catalog_rows = build_catalog_rows()
        for table, rows in catalog_rows.items():
            conflict_key = {
                "market_catalog": "code",
                "platform_catalog": "key",
                "market_platforms": "market_code,platform_key",
                "jurisdiction_catalog": "code",
                "category_profiles": "code",
                "report_template_catalog": "id",
            }[table]
            print(f"  {table}: {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, table, rows, conflict_key=conflict_key)
                summary["results"][table] = n
                if n != len(rows):
                    failures.append(f"{table}: expected {len(rows)}, synced {n}")

    # Raw provenance is written before the public KV bundle.  Pending and
    # rejected records remain auditable here but are filtered from formal
    # browser projections by RLS and the shared data layer.
    if args.only in ("all", "policies", "taxes", "access_requirements", "rules", "alerts", "platforms", "countries", "macro", "cpsc"):
        print("[SYNC] Processing source registry and raw evidence...")
        registry_rows = build_source_registry_rows(args.only)
        source_policy_rows = build_source_policy_rows(registry_rows)
        raw_rows = build_raw_record_rows(quality_report, args.only)
        applicability_rows = build_applicability_rows(quality_report, args.only)
        history_rows = build_history_rows(
            quality_report, raw_rows, applicability_rows, args.only
        )
        print(f"  data_source_registry: {len(registry_rows)} rows ready")
        print(f"  data_source_access_policies: {len(source_policy_rows)} rows ready")
        print(f"  raw_data_records: {len(raw_rows)} rows ready")
        for table in HISTORY_TABLES:
            print(f"  {table}: {len(history_rows.get(table, []))} rows ready")
        if not args.dry_run:
            registry_count = supabase_upsert(supa_url, supa_key, "data_source_registry", registry_rows, conflict_key="source_key")
            summary["results"]["data_source_registry"] = registry_count
            if registry_count != len(registry_rows):
                failures.append(f"data_source_registry: expected {len(registry_rows)}, synced {registry_count}")
            policy_count = supabase_upsert(
                supa_url,
                supa_key,
                "data_source_access_policies",
                source_policy_rows,
                conflict_key="source_key",
            )
            summary["results"]["data_source_access_policies"] = policy_count
            if policy_count != len(source_policy_rows):
                failures.append(
                    f"data_source_access_policies: expected {len(source_policy_rows)}, synced {policy_count}"
                )
            # The compatibility evidence table is now insert-only as well.
            raw_count = supabase_insert_ignore(
                supa_url, supa_key, "raw_data_records", raw_rows,
                conflict_key="source_key,source_record_id,evidence_hash",
            )
            summary["results"]["raw_data_records"] = raw_count
            if raw_count != len(raw_rows):
                failures.append(f"raw_data_records: expected {len(raw_rows)}, synced {raw_count}")
            for table in ("source_fetch_runs", "raw_source_records"):
                rows = history_rows[table]
                count = supabase_insert_ignore(
                    supa_url, supa_key, table, rows,
                    conflict_key="run_id,collector_key" if table == "source_fetch_runs" else "source_key,source_record_id,evidence_hash",
                )
                summary["results"][table] = count
                if count != len(rows):
                    failures.append(f"{table}: expected {len(rows)}, synced {count}")
            for table in ("policy_documents", "platform_rules", "product_entities", "shop_entities", "content_entities"):
                rows = history_rows[table]
                count = supabase_upsert(supa_url, supa_key, table, rows, conflict_key="id")
                summary["results"][table] = count
                if count != len(rows):
                    failures.append(f"{table}: expected {len(rows)}, synced {count}")
            for table in ("policy_versions", "platform_rule_versions", "product_snapshots", "shop_snapshots", "content_snapshots"):
                rows = history_rows[table]
                conflict = {
                    "policy_versions": "policy_document_id,evidence_hash",
                    "platform_rule_versions": "platform_rule_id,evidence_hash",
                    "product_snapshots": "id",
                    "shop_snapshots": "id",
                    "content_snapshots": "id",
                }[table]
                count = supabase_insert_ignore(supa_url, supa_key, table, rows, conflict_key=conflict)
                summary["results"][table] = count
                if count != len(rows):
                    failures.append(f"{table}: expected {len(rows)}, synced {count}")
            publication_rows = history_rows["formal_publications"]
            publication_count = supabase_insert_ignore(
                supa_url, supa_key, "formal_publications", publication_rows, conflict_key="id"
            )
            summary["results"]["formal_publications"] = publication_count
            if publication_count != len(publication_rows):
                failures.append(
                    f"formal_publications: expected {len(publication_rows)}, synced {publication_count}"
                )
            print(f"  market_data_applicability: {len(applicability_rows)} formal rows ready")
            applicability_count = supabase_upsert(
                supa_url,
                supa_key,
                "market_data_applicability",
                applicability_rows,
                conflict_key="id",
            )
            summary["results"]["market_data_applicability"] = applicability_count
            if applicability_count != len(applicability_rows):
                failures.append(
                    f"market_data_applicability: expected {len(applicability_rows)}, synced {applicability_count}"
                )
        else:
            print(f"  market_data_applicability: {len(applicability_rows)} formal rows ready")

    if args.only == "all":
        private_run_id = str(collection_run.get("run_id") or summary["synced_at"])
        print("[SYNC] Uploading restricted artifacts to private Storage...")
        private_count, private_failures = sync_private_artifacts(
            supa_url,
            supa_key,
            private_run_id,
            dry_run=args.dry_run,
        )
        summary["results"]["private_data_artifacts"] = private_count
        print(f"  private_data_artifacts: {private_count} object(s) ready")
        failures.extend(f"private artifact {failure}" for failure in private_failures)

    # Policies
    if legacy_sync and args.only in ("policies", "all"):
        print("[SYNC] Processing policies...")
        data = load_json(os.path.join(DATA_DIR, "policies.json"))
        if data:
            rows = transform_policies(data)
            print(f"  {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, "policies", rows)
                summary["results"]["policies"] = n
                print(f"  ✅ Synced {n} rows")
                if n != len(rows):
                    failures.append(f"policies: expected {len(rows)}, synced {n}")
    
    # Rules
    if legacy_sync and args.only in ("rules", "all"):
        print("[SYNC] Processing rules...")
        data = load_json(os.path.join(DATA_DIR, "rules.json"))
        if data:
            rows = transform_rules(data)
            print(f"  {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, "rules", rows)
                summary["results"]["rules"] = n
                print(f"  ✅ Synced {n} rows")
                if n != len(rows):
                    failures.append(f"rules: expected {len(rows)}, synced {n}")
    
    # Alerts
    if legacy_sync and args.only in ("alerts", "all"):
        print("[SYNC] Processing alerts...")
        data = load_json(os.path.join(DATA_DIR, "alerts.json"))
        if data:
            rows = transform_alerts(data)
            print(f"  {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, "alerts", rows)
                summary["results"]["alerts"] = n
                print(f"  ✅ Synced {n} rows")
                if n != len(rows):
                    failures.append(f"alerts: expected {len(rows)}, synced {n}")
    
    # Platforms
    if legacy_sync and args.only in ("platforms", "all"):
        print("[SYNC] Processing platforms...")
        data = load_json(os.path.join(DATA_DIR, "platforms.json"))
        if data:
            rows = transform_platforms(data)
            print(f"  {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, "platforms", rows)
                summary["results"]["platforms"] = n
                print(f"  ✅ Synced {n} rows")
                if n != len(rows):
                    failures.append(f"platforms: expected {len(rows)}, synced {n}")
    
    # US Market data
    if legacy_sync and args.only in ("us_market", "all"):
        print("[SYNC] Processing US market data...")
        if os.path.exists(US_MARKET_DIR):
            total = 0
            expected_total = 0
            for fname in sorted(os.listdir(US_MARKET_DIR)):
                if fname.endswith(".json") and fname != "index.json":
                    rows = transform_us_market(os.path.join(US_MARKET_DIR, fname))
                    expected_total += len(rows)
                    if not args.dry_run and rows:
                        n = supabase_upsert(supa_url, supa_key, "us_market_data", rows)
                        total += n
            summary["results"]["us_market_data"] = total
            print(f"  ✅ Synced {total} category rows")
            if not args.dry_run and total != expected_total:
                failures.append(f"us_market_data: expected {expected_total}, synced {total}")

    # Public KV bundle used by the static frontend (Supabase-first, JSON fallback).
    print("[SYNC] Processing public market_data bundle...")
    market_rows = build_market_data_rows(quality_report, args.only)
    print(f"  {len(market_rows)} rows ready")
    if not args.dry_run and market_rows:
        n = supabase_upsert(supa_url, supa_key, "market_data", market_rows, conflict_key="key")
        summary["results"]["market_data"] = n
        print(f"  ✅ Synced {n} rows")
        if n != len(market_rows):
            failures.append(f"market_data: expected {len(market_rows)}, synced {n}")
    
    if not args.dry_run:
        private_run_id = str(collection_run.get("run_id") or summary["synced_at"])
        sync_run_count = supabase_upsert(
            supa_url,
            supa_key,
            "private_sync_runs",
            [{
                "run_id": private_run_id,
                "status": "failed" if failures else "succeeded",
                "started_at": collection_run.get("started_at"),
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "summary": summary,
            }],
            conflict_key="run_id",
        )
        summary["results"]["private_sync_runs"] = sync_run_count
        if sync_run_count != 1:
            failures.append("private_sync_runs: expected 1, synced 0")

    # Summary
    print(f"\n[SYNC] {'='*50}")
    print(f"[SYNC] Sync complete!")
    for table, count in summary["results"].items():
        print(f"  {table}: {count} rows")
    
    print("[SYNC] Log: private_sync_runs (service-only)")
    if failures:
        print("[SYNC] ERROR: incomplete Supabase sync")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
