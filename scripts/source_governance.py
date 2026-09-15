#!/usr/bin/env python3
"""Local source-governance contract used by every production collector.

The database migration is the authoritative service-side ledger.  Collectors
also need a small offline copy because they run before a sync request exists.
The optional SOURCE_GOVERNANCE_FILE / SOURCE_GOVERNANCE_JSON overrides let an
operations job refresh that copy without putting credentials or raw responses
in the repository.
"""

from __future__ import annotations

import copy
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class SourceGovernanceError(RuntimeError):
    """Raised when a collector references an unknown or stopped source."""

    def __init__(self, source_key: str, reason: str):
        self.source_key = source_key
        self.reason = reason
        super().__init__(f"source {source_key!r} is not collectable: {reason}")


SOURCE_CATEGORIES = {
    "official_policy",
    "official_statistics",
    "platform_announcement",
    "industry_media",
    "third_party_provider",
    "user_upload",
    "derived",
    "internal",
    "demo",
}


def _policy(
    *,
    license_class: str,
    access_class: str,
    redistribution_allowed: bool,
    retention_days: int,
    authorization_status: str,
    commercial_use_allowed: bool,
    permitted_uses: list[str],
    allowed_display_fields: list[str],
    allowed_storage_fields: list[str],
    allowed_export_fields: list[str],
    authorization_secret_name: str | None = None,
    provider_terms_url: str | None = None,
    api_pricing: dict[str, Any] | None = None,
    rate_limit_requests: int | None = None,
    rate_limit_window_seconds: int | None = None,
    requires_attribution: bool = False,
    attribution_text: str | None = None,
    authorization_expires_at: str | None = None,
) -> dict[str, Any]:
    return {
        "license_class": license_class,
        "access_class": access_class,
        "redistribution_allowed": redistribution_allowed,
        "retention_days": retention_days,
        "authorization_status": authorization_status,
        "authorization_started_at": None,
        "authorization_expires_at": authorization_expires_at,
        "commercial_use_allowed": commercial_use_allowed,
        "api_pricing": api_pricing or {"model": "public", "currency": "USD", "amount": 0},
        "rate_limit_requests": rate_limit_requests,
        "rate_limit_window_seconds": rate_limit_window_seconds,
        "allowed_display_fields": allowed_display_fields,
        "allowed_storage_fields": allowed_storage_fields,
        "allowed_export_fields": allowed_export_fields,
        "requires_attribution": requires_attribution,
        "attribution_text": attribution_text,
        "authorization_secret_name": authorization_secret_name,
        "provider_terms_url": provider_terms_url,
        "permitted_uses": permitted_uses,
        "notes": None,
        "reviewer": None,
        "reviewed_at": None,
    }


PUBLIC_FIELDS = ["title", "summary", "source", "source_url", "published_at", "effective_from"]
RAW_FIELDS = PUBLIC_FIELDS + ["payload", "evidence_hash", "collected_at", "retrieved_at"]


def _source(
    name: str,
    category: str,
    source_kind: str,
    source_type: str,
    base_url: str | None,
    subject_name: str,
    authority_level: str,
    trust_level: str,
    update_frequency: str,
    policy: dict[str, Any],
    *,
    market_codes: list[str] | None = None,
    platform_keys: list[str] | None = None,
    category_codes: list[str] | None = None,
    verification_policy: str = "manual_review",
    status: str = "active",
    collection_enabled: bool = True,
) -> dict[str, Any]:
    return {
        "name": name,
        "source_category": category,
        "source_kind": source_kind,
        "source_type": source_type,
        "base_url": base_url,
        "subject_name": subject_name,
        "authority_level": authority_level,
        "trust_level": trust_level,
        "update_frequency": update_frequency,
        "market_codes": market_codes or [],
        "platform_keys": platform_keys or [],
        "category_codes": category_codes or [],
        "verification_policy": verification_policy,
        "status": status,
        "collection_enabled": collection_enabled,
        "last_reviewed_at": None,
        "next_review_at": None,
        "deactivated_at": None,
        "deactivation_reason": None,
        "metadata": {"governance_version": 1},
        "access_policy": policy,
    }


_OFFICIAL_POLICY = _policy(
    license_class="official_public", access_class="public_summary", redistribution_allowed=True,
    retention_days=730, authorization_status="not_required", commercial_use_allowed=True,
    permitted_uses=["audit", "analysis", "public_summary"], allowed_display_fields=PUBLIC_FIELDS,
    allowed_storage_fields=RAW_FIELDS, allowed_export_fields=PUBLIC_FIELDS,
)


SOURCE_REGISTRY: dict[str, dict[str, Any]] = {
    "federal-register": _source(
        "US Federal Register", "official_policy", "official", "government",
        "https://www.federalregister.gov/", "United States Federal Register", "federal", "high", "4h",
        {**_OFFICIAL_POLICY, "provider_terms_url": "https://www.federalregister.gov/policy"},
        market_codes=["US"], verification_policy="automatic",
    ),
    "ustr": _source(
        "US Trade Representative", "official_policy", "official", "government", "https://ustr.gov/",
        "Office of the United States Trade Representative", "federal", "high", "4h",
        {**_OFFICIAL_POLICY, "provider_terms_url": "https://ustr.gov/about-us/policy-offices/press-office/website-policies"},
        market_codes=["US"], verification_policy="automatic",
    ),
    "cpsc": _source(
        "US Consumer Product Safety Commission", "official_policy", "official", "regulator",
        "https://www.cpsc.gov/", "US Consumer Product Safety Commission", "federal", "high", "4h",
        {**_OFFICIAL_POLICY, "provider_terms_url": "https://www.cpsc.gov/About-CPSC/Policies-Statements-and-Directives"},
        market_codes=["US"], verification_policy="automatic",
    ),
    "fred": _source(
        "Federal Reserve Economic Data", "official_statistics", "official", "official_feed",
        "https://fred.stlouisfed.org/", "Federal Reserve Bank of St. Louis", "federal", "high", "1d",
        {**_OFFICIAL_POLICY, "authorization_secret_name": "FRED_API_KEY", "provider_terms_url": "https://fred.stlouisfed.org/legal/"},
        market_codes=["US"], verification_policy="automatic",
    ),
    "bls": _source(
        "US Bureau of Labor Statistics", "official_statistics", "official", "government", "https://www.bls.gov/",
        "US Bureau of Labor Statistics", "federal", "high", "1d",
        {**_OFFICIAL_POLICY, "provider_terms_url": "https://www.bls.gov/bls/linksite.htm"},
        market_codes=["US"], verification_policy="automatic",
    ),
    "macro-official": _source(
        "FRED / BLS macro indicators", "official_statistics", "official", "official_feed", None,
        "US official statistical feeds", "federal", "high", "1d", _OFFICIAL_POLICY,
        market_codes=["US"], verification_policy="automatic",
    ),
    "platform-official": _source(
        "Platform official announcements", "platform_announcement", "traceable", "platform", None,
        "Marketplace and social-commerce operators", "platform", "high", "4h", {
            **_OFFICIAL_POLICY, "rate_limit_requests": 120, "rate_limit_window_seconds": 60,
        },
        platform_keys=["amazon", "tiktok-shop", "aliexpress", "ebay"], verification_policy="manual_review",
    ),
    "official-source": _source(
        "Other verified official sources", "official_policy", "official", "government", None,
        "Verified government or regulator source", "government", "medium", "weekly", _OFFICIAL_POLICY,
        verification_policy="automatic",
    ),
    "traceable-feed": _source(
        "Traceable industry media feed", "industry_media", "traceable", "industry_association", None,
        "Industry media and associations", "industry", "medium", "daily",
        _policy(
            license_class="restricted", access_class="service_private", redistribution_allowed=False,
            retention_days=180, authorization_status="pending", commercial_use_allowed=False,
            permitted_uses=["audit", "analysis"], allowed_display_fields=PUBLIC_FIELDS,
            allowed_storage_fields=RAW_FIELDS, allowed_export_fields=[], requires_attribution=True,
        ), verification_policy="manual_review",
    ),
    "tikhub": _source(
        "TikHub API", "third_party_provider", "traceable", "licensed_provider", "https://tikhub.io/",
        "TikHub third-party data service", "commercial_provider", "medium", "on_demand",
        _policy(
            license_class="commercial", access_class="service_private", redistribution_allowed=False,
            retention_days=30, authorization_status="pending", commercial_use_allowed=False,
            permitted_uses=["internal_search", "workspace_analysis"], allowed_display_fields=["id", "title", "summary", "metrics_summary"],
            allowed_storage_fields=["id", "title", "payload", "source_url", "collected_at", "evidence_hash"],
            allowed_export_fields=[], authorization_secret_name="TIKHUB_API_KEY",
            provider_terms_url="https://tikhub.io/zh/terms", api_pricing={"model": "provider_plan", "currency": "USD"},
            rate_limit_requests=60, rate_limit_window_seconds=60,
        ),
        market_codes=["US"], platform_keys=["tiktok-shop"], category_codes=[
            "beauty", "skincare", "makeup", "haircare", "womens-fashion",
            "mens-fashion", "shoes", "jewelry", "home-decor", "kitchen",
            "electronics", "phone-accessories", "pet-supplies", "toys", "fitness",
            "outdoor", "baby-products", "health", "automotive", "luggage",
        ],
        verification_policy="manual_review",
    ),
    "user-upload": _source(
        "人工上传数据", "user_upload", "uploaded", "user_upload", None, "Workspace member",
        "workspace", "medium", "on_demand",
        _policy(
            license_class="user_owned", access_class="workspace_private", redistribution_allowed=False,
            retention_days=365, authorization_status="confirmed", commercial_use_allowed=False,
            permitted_uses=["workspace_analysis"], allowed_display_fields=PUBLIC_FIELDS,
            allowed_storage_fields=RAW_FIELDS, allowed_export_fields=PUBLIC_FIELDS,
        ), verification_policy="upload_review",
    ),
    "derived": _source(
        "由正式记录派生的数据", "derived", "derived", "derived", None, "JAY观海 data pipeline",
        "internal", "medium", "per_run",
        _policy(
            license_class="internal", access_class="service_private", redistribution_allowed=False,
            retention_days=365, authorization_status="not_required", commercial_use_allowed=False,
            permitted_uses=["analysis"], allowed_display_fields=[], allowed_storage_fields=RAW_FIELDS,
            allowed_export_fields=[],
        ), verification_policy="automatic",
    ),
    "demo": _source(
        "演示数据（不可发布）", "demo", "demo", "demo", None, "Development fixture",
        "internal", "low", "never",
        _policy(
            license_class="restricted", access_class="blocked", redistribution_allowed=False,
            retention_days=30, authorization_status="revoked", commercial_use_allowed=False,
            permitted_uses=[], allowed_display_fields=[], allowed_storage_fields=[], allowed_export_fields=[],
        ), verification_policy="blocked", status="inactive", collection_enabled=False,
    ),
    "internal-system": _source(
        "JAY观海内部运行数据", "internal", "derived", "derived", None, "JAY观海 service",
        "internal", "high", "per_run",
        _policy(
            license_class="internal", access_class="service_private", redistribution_allowed=False,
            retention_days=90, authorization_status="not_required", commercial_use_allowed=False,
            permitted_uses=["operations", "audit", "recovery"], allowed_display_fields=[],
            allowed_storage_fields=RAW_FIELDS, allowed_export_fields=[],
        ), verification_policy="blocked",
    ),
}


SOURCE_KEY_ALIASES = {
    "official_policy": "official-source",
    "federal_register": "federal-register",
    "federal-register-api": "federal-register",
    "ustr": "ustr",
    "tiktok_shop_rules": "platform-official",
    "amazon_rules": "platform-official",
    "aliexpress_rules": "platform-official",
    "ebay_rules": "platform-official",
    "platform_rules": "platform-official",
    "platform-rules": "platform-official",
    "industry_advisories": "traceable-feed",
    "cifnews": "traceable-feed",
    "amz123": "traceable-feed",
    "fred_bls_macro": "macro-official",
    "cpsc_recalls": "cpsc",
    "us_market_categories": "federal-register",
    "market_scope": "internal-system",
}


def _merge_override(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if key == "access_policy" and isinstance(value, dict):
            merged[key].update(value)
        elif key == "metadata" and isinstance(value, dict):
            merged[key].update(value)
        else:
            merged[key] = value
    return merged


def load_source_registry() -> dict[str, dict[str, Any]]:
    registry = copy.deepcopy(SOURCE_REGISTRY)
    raw = os.environ.get("SOURCE_GOVERNANCE_JSON", "").strip()
    file_name = os.environ.get("SOURCE_GOVERNANCE_FILE", "").strip()
    if file_name:
        try:
            raw = Path(file_name).read_text(encoding="utf-8")
        except OSError:
            raw = ""
    if raw:
        try:
            payload = json.loads(raw)
            payload = payload.get("sources", payload) if isinstance(payload, dict) else payload
            if isinstance(payload, dict):
                for key, override in payload.items():
                    if key in registry and isinstance(override, dict):
                        registry[key] = _merge_override(registry[key], override)
        except (TypeError, ValueError, OSError):
            pass
    return registry


def canonical_source_key(source_key: str) -> str:
    raw = str(source_key or "").strip()
    return SOURCE_KEY_ALIASES.get(raw, raw)


def source_metadata(source_key: str, registry: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    key = canonical_source_key(source_key)
    registry = registry or load_source_registry()
    if key not in registry:
        raise SourceGovernanceError(key, "source is not registered")
    return registry[key]


def _now() -> datetime:
    value = os.environ.get("SOURCE_GOVERNANCE_NOW", "").strip()
    if value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _past(value: Any) -> bool:
    if not value:
        return False
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed <= _now()
    except ValueError:
        return True


def collectability_reason(source_key: str) -> str | None:
    meta = source_metadata(source_key)
    policy = meta.get("access_policy") or {}
    if meta.get("status") != "active":
        return f"status={meta.get('status')}"
    if meta.get("collection_enabled") is False:
        return "collection_enabled=false"
    if _past(meta.get("deactivated_at")):
        return "deactivated_at has passed"
    if _past(meta.get("next_review_at")):
        return "source review is overdue"
    if policy.get("authorization_status") in {"expired", "revoked"}:
        return f"authorization_status={policy.get('authorization_status')}"
    if _past(policy.get("authorization_expires_at")):
        return "authorization_expires_at has passed"
    return None


def source_is_collectable(source_key: str) -> bool:
    try:
        return collectability_reason(source_key) is None
    except SourceGovernanceError:
        return False


def assert_source_collectable(source_key: str) -> str:
    key = canonical_source_key(source_key)
    reason = collectability_reason(key)
    if reason:
        raise SourceGovernanceError(key, reason)
    return key


def source_is_publishable(source_key: str) -> bool:
    try:
        meta = source_metadata(source_key)
    except SourceGovernanceError:
        return False
    policy = meta.get("access_policy") or {}
    return source_is_collectable(source_key) and policy.get("authorization_status") in {"confirmed", "not_required"} \
        and bool(policy.get("commercial_use_allowed")) \
        and bool(policy.get("redistribution_allowed")) \
        and "public_summary" in (policy.get("permitted_uses") or []) \
        and bool(policy.get("allowed_display_fields"))


def classify_source_for_publication(source_key: str) -> dict[str, Any]:
    meta = source_metadata(source_key)
    policy = meta.get("access_policy") or {}
    return {
        "source_key": canonical_source_key(source_key),
        "source_category": meta.get("source_category", "derived"),
        "name": meta.get("name"),
        "publishable": source_is_publishable(source_key),
        "authorization_status": policy.get("authorization_status"),
        "access_class": policy.get("access_class"),
        "allowed_display_fields": list(policy.get("allowed_display_fields") or []),
        "allowed_export_fields": list(policy.get("allowed_export_fields") or []),
    }


def quarantine_unlicensed_record(record: dict[str, Any], source_key: str, reason: str | None = None) -> dict[str, Any]:
    copy_record = dict(record or {})
    meta = source_metadata(source_key)
    policy = meta.get("access_policy") or {}
    copy_record["source_key"] = canonical_source_key(source_key)
    copy_record["source_category"] = meta.get("source_category", "derived")
    copy_record["publication_status"] = "quarantined"
    copy_record["quarantine_reason"] = reason or (
        "source authorization is not confirmed or redistribution is not allowed"
    )
    copy_record["access_class"] = policy.get("access_class")
    copy_record["redistribution_allowed"] = bool(policy.get("redistribution_allowed"))
    return copy_record


def registry_rows() -> list[dict[str, Any]]:
    rows = []
    for key, meta in load_source_registry().items():
        row = {k: copy.deepcopy(v) for k, v in meta.items() if k != "access_policy"}
        row["source_key"] = key
        rows.append(row)
    return rows


def access_policy_rows(source_keys: list[str] | None = None) -> list[dict[str, Any]]:
    registry = load_source_registry()
    keys = source_keys or list(registry)
    rows = []
    for source_key in keys:
        key = canonical_source_key(source_key)
        if key not in registry:
            continue
        rows.append({"source_key": key, **copy.deepcopy(registry[key]["access_policy"])})
    return rows


if __name__ == "__main__":
    for row in registry_rows():
        print(row["source_key"], row["source_category"], row["status"])
