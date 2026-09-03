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
from datetime import datetime, timezone

from validate_data import (
    DEFAULT_REPORT,
    SOURCE_TYPES,
    infer_source_kind,
    infer_verification_status,
    effective_source_type,
    normalize_source_type,
    record_quality,
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
    kind = infer_source_kind(record)
    source_type = normalize_source_type(record.get("source_type"))
    url = source_url_for(record).lower()
    source_text = f"{record.get('source', '')} {record.get('platform', '')}".lower()
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
    if source_type == "user_upload" or kind == "uploaded":
        return "user-upload"
    if kind == "demo":
        return "demo"
    if source_type == "platform" or record.get("platform"):
        return "platform-official"
    if kind == "derived":
        return "derived"
    return "traceable-feed"


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
    """Return a public copy with explicit advisory provenance metadata."""
    if key != "policies" or not isinstance(data, dict) or not isinstance(data.get("items"), list):
        return data
    payload = dict(data)
    payload["items"] = []
    for item in data["items"]:
        if not isinstance(item, dict):
            payload["items"].append(item)
            continue
        copy = dict(item)
        if is_industry_advisory(copy):
            copy["source_kind"] = "traceable"
            copy["source_type"] = "licensed_provider"
            copy["source_class"] = "industry_advisory"
            copy["verification_status"] = "pending"
            copy["verified_at"] = None
            copy["verification_notes"] = "第三方行业资讯：仅作可追溯参考，未完成官方记录级核验。"
            detected = list(dict.fromkeys(explicit_industry_market_codes(copy) + infer_industry_market_codes(copy)))
            if detected:
                copy["market_codes"] = detected
                copy["market_scope_status"] = "identified"
            else:
                copy["market_scope_status"] = "unscoped"
        payload["items"].append(copy)
    return payload


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
    rows = [
        {"source_key": "federal-register", "name": "US Federal Register", "source_kind": "official", "source_type": "government", "base_url": "https://www.federalregister.gov/", "verification_policy": "automatic", "status": "active"},
        {"source_key": "ustr", "name": "US Trade Representative", "source_kind": "official", "source_type": "government", "base_url": "https://ustr.gov/", "verification_policy": "automatic", "status": "active"},
        {"source_key": "cpsc", "name": "US Consumer Product Safety Commission", "source_kind": "official", "source_type": "regulator", "base_url": "https://www.cpsc.gov/", "verification_policy": "automatic", "status": "active"},
        {"source_key": "platform-official", "name": "Platform official announcements", "source_kind": "traceable", "source_type": "platform", "base_url": None, "verification_policy": "manual_review", "status": "active"},
        {"source_key": "traceable-feed", "name": "Traceable licensed or industry feed", "source_kind": "traceable", "source_type": "licensed_provider", "base_url": None, "verification_policy": "manual_review", "status": "active"},
        {"source_key": "user-upload", "name": "人工上传数据", "source_kind": "uploaded", "source_type": "user_upload", "base_url": None, "verification_policy": "upload_review", "status": "active"},
        {"source_key": "derived", "name": "由正式记录派生的数据", "source_kind": "derived", "source_type": "derived", "base_url": None, "verification_policy": "automatic", "status": "active"},
        {"source_key": "demo", "name": "演示数据（不可发布）", "source_kind": "demo", "source_type": "demo", "base_url": None, "verification_policy": "blocked", "status": "inactive"},
    ]
    used = {source_key_for_record(row) for _, _, row, _ in iter_provenance_records(only)}
    return [row for row in rows if row["source_key"] in used or row["source_key"] in {"federal-register", "user-upload"}]


def build_raw_record_rows(quality_report=None, only="all"):
    """Build the auditable raw-record projection for Supabase."""
    rows = []
    for dataset_key, domain, item, index in iter_provenance_records(only):
        industry_advisory = is_industry_advisory(item)
        source_kind = "traceable" if industry_advisory else (infer_source_kind(item) or "traceable")
        # Legacy third-party articles may satisfy the compatibility URL/date
        # inference, but that must not become an automatic verification event.
        verification_status = "pending" if industry_advisory else (infer_verification_status(item, source_kind) or "pending")
        source_type = "licensed_provider" if industry_advisory else effective_source_type(item, source_kind)
        source_record_id = source_record_id_for(item) or str(item.get("id") or f"{dataset_key}-{index}")
        payload = dict(item)
        evidence_hash = str(item.get("evidence_hash") or hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest())
        market_codes = set(record_scope_codes(item))
        if industry_advisory:
            detected_codes = explicit_industry_market_codes(item) + infer_industry_market_codes(item)
            if detected_codes:
                market_codes = set(detected_codes)
        rows.append({
            "source_key": source_key_for_record(item),
            "domain": domain,
            "source_record_id": source_record_id,
            "normalized_record_key": str(item.get("id") or source_record_id),
            "market_codes": sorted(market_codes),
            "platform_keys": item.get("platform_keys") or item.get("platformKeys") or [],
            "category_codes": item.get("category_codes") or item.get("categoryCodes") or [],
            "jurisdiction_codes": item.get("jurisdiction_codes") or item.get("jurisdictionCodes") or [],
            "source_kind": source_kind,
            "source_type": source_type,
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
            "status": "active" if verification_status != "rejected" else "rejected",
        })
    return rows


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


def build_applicability_rows(quality_report=None, only="all"):
    """Build only formal, current-scope normalized rows for public reads."""
    markets, platforms, categories, jurisdictions, market_platforms = _scope_catalog()
    rows = []
    for dataset_key, domain, item, index in iter_provenance_records(only):
        # Industry articles are intentionally retained in raw_data_records,
        # but never promoted to the formal market applicability projection.
        if is_industry_advisory(item):
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
        source_record_id = source_record_id_for(item) or str(item.get('id') or f'{dataset_key}-{index}')
        evidence_hash = str(item.get('evidence_hash') or hashlib.sha256(json.dumps(item, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest())
        for market_code in market_codes:
            platform_keys = declared_platform_keys
            allowed_platforms = market_platforms.get(market_code)
            if allowed_platforms and platform_keys:
                platform_keys = [key for key in platform_keys if key in allowed_platforms]
            platform_keys = platform_keys or [None]
            jurisdiction_codes = _jurisdiction_codes(item, market_code, markets, jurisdictions) or [None]
            for platform in platform_keys:
                for category in category_codes:
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
                            'change_type': item.get('change_type') or item.get('changeType') or None,
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
                            'source_key': source_key_for_record(item),
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


def supabase_request(url, key, method="GET", data=None, timeout=30):
    """Make a Supabase REST API request."""
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=merge-duplicates",
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
        raw_rows = build_raw_record_rows(quality_report, args.only)
        print(f"  data_source_registry: {len(registry_rows)} rows ready")
        print(f"  raw_data_records: {len(raw_rows)} rows ready")
        if not args.dry_run:
            registry_count = supabase_upsert(supa_url, supa_key, "data_source_registry", registry_rows, conflict_key="source_key")
            summary["results"]["data_source_registry"] = registry_count
            if registry_count != len(registry_rows):
                failures.append(f"data_source_registry: expected {len(registry_rows)}, synced {registry_count}")
            raw_count = supabase_upsert(supa_url, supa_key, "raw_data_records", raw_rows, conflict_key="source_key,source_record_id,evidence_hash")
            summary["results"]["raw_data_records"] = raw_count
            if raw_count != len(raw_rows):
                failures.append(f"raw_data_records: expected {len(raw_rows)}, synced {raw_count}")
            applicability_rows = build_applicability_rows(quality_report, args.only)
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
            applicability_rows = build_applicability_rows(quality_report, args.only)
            print(f"  market_data_applicability: {len(applicability_rows)} formal rows ready")

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
    
    # Summary
    print(f"\n[SYNC] {'='*50}")
    print(f"[SYNC] Sync complete!")
    for table, count in summary["results"].items():
        print(f"  {table}: {count} rows")
    
    # Save sync log
    log_dir = os.path.join(DATA_DIR, "_sync_logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"sync_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json")
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"[SYNC] Log: {log_file}")
    if failures:
        print("[SYNC] ERROR: incomplete Supabase sync")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
