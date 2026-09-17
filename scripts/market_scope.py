"""Shared market/platform scope resolution for collectors and workers.

The public market catalog is the source of truth for which countries are
上线.  A scope is executable only when both the market and its market-platform
relation are active and marked ``configured``.  Other active scopes are
returned as blocked metadata so operators can see what still needs an
adapter/authorization without the collector making an unsafe request.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Mapping, Sequence


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SCOPE_PATH = ROOT / "data" / "market_scope.json"
SUPPORTED_PLATFORMS = ("tiktok-shop",)


def _configured_platform_relations(manifest: Mapping[str, Any], market_codes: Sequence[str] | None = None) -> set[str]:
    """Return platform keys explicitly configured for the selected markets."""
    selected = {str(value).strip().upper() for value in (market_codes or []) if str(value).strip()}
    configured = set()
    for relation in manifest.get("market_platforms", []) or manifest.get("marketPlatforms", []) or []:
        if not isinstance(relation, Mapping):
            continue
        market = str(relation.get("market_code") or relation.get("marketCode") or "").strip().upper()
        platform = str(relation.get("platform_key") or relation.get("platformKey") or "").strip().lower()
        if (
            market and platform
            and (not selected or market in selected)
            and str(relation.get("status") or "active").strip().lower() == "active"
            and str(relation.get("data_status") or relation.get("dataStatus") or "").strip().lower() == "configured"
        ):
            configured.add(platform)
    return configured


def configured_catalog(manifest: Mapping[str, Any] | None = None, *, market_codes: Sequence[str] | None = None) -> dict[str, Any]:
    """Resolve the canonical configured market, platform and category codes."""
    data = manifest or load_market_scope()
    selected = {str(value).strip().upper() for value in (market_codes or []) if str(value).strip()}
    markets = [
        market for market in data.get("markets", []) or []
        if isinstance(market, Mapping)
        and str(market.get("code") or "").strip().upper()
        and str(market.get("status") or "active").strip().lower() == "active"
        and str(market.get("data_status") or "").strip().lower() == "configured"
        and (not selected or str(market.get("code") or "").strip().upper() in selected)
    ]
    market_codes_out = sorted({str(market.get("code")).strip().upper() for market in markets})
    platform_keys = sorted(_configured_platform_relations(data, market_codes_out))
    category_keys = []
    category_rows = {
        str(category.get("code") or "").strip().lower(): category
        for category in data.get("categories", []) or []
        if isinstance(category, Mapping) and str(category.get("code") or "").strip()
    }
    for market in markets:
        for value in market.get("category_keys") or market.get("categoryKeys") or []:
            key = str(value).strip().lower()
            row = category_rows.get(key)
            if key and row and str(row.get("status") or "active").strip().lower() == "active" and key not in category_keys:
                category_keys.append(key)
    return {
        "market_codes": market_codes_out,
        "platform_keys": platform_keys,
        "category_keys": category_keys,
        "config_version": str(data.get("config_version") or ""),
    }


def platform_alias_map(manifest: Mapping[str, Any] | None = None) -> dict[str, str]:
    """Map platform keys, names and aliases to canonical platform keys."""
    data = manifest or load_market_scope()
    aliases: dict[str, str] = {}
    for row in data.get("platforms", []) or []:
        if not isinstance(row, Mapping):
            continue
        key = str(row.get("key") or "").strip().lower()
        if not key:
            continue
        for value in [key, row.get("name"), *(row.get("aliases") or [])]:
            if str(value or "").strip():
                aliases[str(value).strip().lower()] = key
    return aliases


def category_alias_map(manifest: Mapping[str, Any] | None = None) -> dict[str, str]:
    """Map active category codes, names and aliases to canonical codes."""
    data = manifest or load_market_scope()
    aliases: dict[str, str] = {}
    for row in data.get("categories", []) or []:
        if not isinstance(row, Mapping):
            continue
        key = str(row.get("code") or "").strip().lower()
        if not key or str(row.get("status") or "active").strip().lower() != "active":
            continue
        for value in [key, row.get("name"), *(row.get("aliases") or [])]:
            if str(value or "").strip():
                aliases[str(value).strip().lower()] = key
    return aliases


def normalize_category_code(
    value: Any,
    manifest: Mapping[str, Any] | None = None,
    *,
    market_codes: Sequence[str] | None = None,
    fallback: str = "generic",
) -> str:
    """Return a configured category code, failing closed to a catalog fallback."""
    data = manifest or load_market_scope()
    allowed = configured_catalog(data, market_codes=market_codes).get("category_keys", [])
    aliases = category_alias_map(data)
    raw = str(value or "").strip().lower()
    canonical = aliases.get(raw, raw)
    if canonical in allowed:
        return canonical
    if fallback in allowed:
        return fallback
    return str(allowed[0]) if allowed else ""


def category_name_map(manifest: Mapping[str, Any] | None = None) -> dict[str, str]:
    """Return display names for active canonical category codes."""
    data = manifest or load_market_scope()
    return {
        str(row.get("code") or "").strip().lower(): str(row.get("name") or row.get("code") or "").strip()
        for row in data.get("categories", []) or []
        if isinstance(row, Mapping)
        and str(row.get("code") or "").strip()
        and str(row.get("status") or "active").strip().lower() == "active"
    }


def load_market_scope(path: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    manifest_path = Path(path or os.environ.get("MARKET_SCOPE_PATH", DEFAULT_SCOPE_PATH))
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ValueError(f"market scope manifest unavailable: {manifest_path}") from error
    if not isinstance(payload, dict):
        raise ValueError("market scope manifest must be a JSON object")
    return payload


def _active_markets(manifest: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    result: dict[str, Mapping[str, Any]] = {}
    for market in manifest.get("markets", []) or []:
        if not isinstance(market, Mapping):
            continue
        code = str(market.get("code") or "").strip().upper()
        if code and str(market.get("status") or "").strip().lower() == "active":
            result[code] = market
    return result


def resolve_market_scopes(
    manifest: Mapping[str, Any] | None = None,
    *,
    market_codes: Sequence[str] | None = None,
    platform_keys: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """Return active launch scopes with an explicit execution status.

    ``configured`` means the relation is ready for a collector.  A market
    with no relation is still represented as ``schema_only`` so coverage
    reports can distinguish no adapter from a successful empty response.
    """
    data = manifest or load_market_scope()
    markets = _active_markets(data)
    requested_markets = {str(value).strip().upper() for value in (market_codes or []) if str(value).strip()}
    requested_platforms = {str(value).strip().lower() for value in (platform_keys or []) if str(value).strip()}
    # A launch platform may exist in the catalog while this provider has no
    # adapter for it. Never let a task pin (for example) Amazon and send an
    # Amazon request to the TikHub TikTok Shop endpoint.
    allowed_platforms = (requested_platforms & set(SUPPORTED_PLATFORMS)) if requested_platforms else set(SUPPORTED_PLATFORMS)
    relationships = data.get("market_platforms", []) or []
    by_pair: dict[tuple[str, str], Mapping[str, Any]] = {}
    for relation in relationships:
        if not isinstance(relation, Mapping):
            continue
        market = str(relation.get("market_code") or relation.get("marketCode") or "").strip().upper()
        platform = str(relation.get("platform_key") or relation.get("platformKey") or "").strip().lower()
        if market and platform:
            by_pair[(market, platform)] = relation

    scopes: list[dict[str, Any]] = []
    for market_code, market in markets.items():
        if requested_markets and market_code not in requested_markets:
            continue
        market_platforms = [
            str(value).strip().lower() for value in (market.get("platform_keys") or []) if str(value).strip()
        ]
        candidates = sorted((set(market_platforms) | {platform for (code, platform) in by_pair if code == market_code}) & allowed_platforms)
        for platform_key in candidates:
            relation = by_pair.get((market_code, platform_key), {})
            market_status = str(market.get("data_status") or "schema_only").strip().lower()
            relation_status = str(relation.get("status") or "active").strip().lower()
            data_status = str(relation.get("data_status") or market_status or "schema_only").strip().lower()
            executable = relation_status == "active" and market_status == "configured" and data_status == "configured"
            scopes.append({
                "market_code": market_code,
                "platform_key": platform_key,
                "market_name": market.get("name") or market.get("label") or market_code,
                "market_status": relation_status if relation_status != "active" else str(market.get("status") or "active"),
                "data_status": data_status,
                "scope_status": "configured" if executable else "schema_only",
                "executable": executable,
                "reason": "" if executable else "market/platform adapter is not configured",
            })
    if requested_markets and not scopes:
        for market_code in sorted(requested_markets):
            scopes.append({
                "market_code": market_code, "platform_key": sorted(allowed_platforms)[0] if allowed_platforms else "tiktok-shop",
                "market_name": market_code, "market_status": "unknown", "data_status": "schema_only",
                "scope_status": "schema_only", "executable": False,
                "reason": "market is not active in market_scope.json",
            })
    return scopes


def configured_market_scopes(manifest: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
    return [scope for scope in resolve_market_scopes(manifest) if scope["executable"]]
