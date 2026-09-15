#!/usr/bin/env python3
"""Validate that production collectors use the governed source ledger."""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

from source_governance import (
    SOURCE_CATEGORIES,
    canonical_source_key,
    load_source_registry,
    source_is_publishable,
)


ROOT = Path(__file__).resolve().parents[1]
COLLECTOR_FILES = sorted(ROOT.glob("scripts/collect*.py"))
SOURCE_KEY_RE = re.compile(r"[\"']?source_key[\"']?\s*[:=]\s*[\"']([^\"']+)[\"']")
TELEMETRY_KEY_RE = re.compile(r"append_collection_source\(\s*\{\s*[\"']key[\"']\s*:\s*[\"']([^\"']+)[\"']", re.S)
IGNORED_KEYS = {"unknown-source", "host", "partial", "failed", "official_policy"}


def referenced_source_keys() -> set[str]:
    keys: set[str] = set()
    for path in COLLECTOR_FILES:
        text = path.read_text(encoding="utf-8")
        values = SOURCE_KEY_RE.findall(text) + TELEMETRY_KEY_RE.findall(text)
        for value in values:
            if value not in IGNORED_KEYS:
                keys.add(canonical_source_key(value))
    return keys


def validate_source_registry() -> dict[str, object]:
    errors: list[str] = []
    registry = load_source_registry()
    registry_keys = set(registry)
    referenced = referenced_source_keys()
    missing = sorted(referenced - registry_keys)
    if missing:
        errors.extend(f"collector source is not registered: {key}" for key in missing)

    for key, row in registry.items():
        category = row.get("source_category")
        if category not in SOURCE_CATEGORIES:
            errors.append(f"{key}: invalid source_category={category!r}")
        if not row.get("subject_name"):
            errors.append(f"{key}: missing subject_name")
        if not row.get("trust_level"):
            errors.append(f"{key}: missing trust_level")
        policy = row.get("access_policy") or {}
        for field in ("retention_days", "authorization_status", "allowed_display_fields", "allowed_storage_fields", "allowed_export_fields"):
            if field not in policy:
                errors.append(f"{key}: access policy missing {field}")
        if row.get("source_category") == "third_party_provider" and not policy.get("api_pricing"):
            errors.append(f"{key}: third-party source missing api_pricing")
        if row.get("source_category") in {"third_party_provider", "platform_announcement"} and not policy.get("rate_limit_requests"):
            errors.append(f"{key}: paid/platform source missing rate limit")

    return {
        "ok": not errors,
        "collector_files": [path.as_posix() for path in COLLECTOR_FILES],
        "referenced_source_keys": sorted(referenced),
        "registered_source_keys": sorted(registry_keys),
        "missing_source_keys": missing,
        "publishable_source_keys": sorted(key for key in registry_keys if source_is_publishable(key)),
        "errors": errors,
    }


def _supabase_request(url: str, key: str, method: str = "GET", body: bytes | None = None):
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()
    return json.loads(payload.decode("utf-8")) if payload else None


def export_runtime_registry(path: Path) -> int:
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not base_url or not service_key:
        print("[SOURCE REGISTRY] SUPABASE_URL and SUPABASE_SERVICE_KEY are required for runtime export")
        return 2

    _supabase_request(
        f"{base_url}/rest/v1/rpc/refresh_source_registry_status",
        service_key,
        method="POST",
        body=b"{}",
    )
    registry_rows = _supabase_request(
        f"{base_url}/rest/v1/data_source_registry?select=*",
        service_key,
    ) or []
    policy_rows = _supabase_request(
        f"{base_url}/rest/v1/data_source_access_policies?select=*",
        service_key,
    ) or []
    policies = {
        str(row.get("source_key") or ""): row
        for row in policy_rows if isinstance(row, dict) and row.get("source_key")
    }
    registered_keys = {
        str(row.get("source_key") or "")
        for row in registry_rows if isinstance(row, dict) and row.get("source_key")
    }
    missing_policies = sorted(registered_keys - set(policies))
    if missing_policies:
        print(
            "[SOURCE REGISTRY] Runtime export refused; sources without access policy: "
            + ", ".join(missing_policies)
        )
        return 3
    sources = {}
    for row in registry_rows:
        if not isinstance(row, dict) or not row.get("source_key"):
            continue
        key = str(row["source_key"])
        sources[key] = {
            name: value for name, value in row.items()
            if name not in {"source_key", "created_at", "updated_at"}
        }
        if key in policies:
            sources[key]["access_policy"] = {
                name: value for name, value in policies[key].items()
                if name not in {"source_key", "created_at", "updated_at"}
            }
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"sources": sources}, ensure_ascii=False), encoding="utf-8")
    print(f"[SOURCE REGISTRY] Runtime ledger exported: {len(sources)} sources")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate or export the governed source ledger")
    parser.add_argument("--export-runtime", type=Path, help="Fetch the service-only runtime ledger to this temporary path")
    args = parser.parse_args()
    if args.export_runtime:
        return export_runtime_registry(args.export_runtime)
    report = validate_source_registry()
    if report["ok"]:
        print(
            "[SOURCE REGISTRY] OK: "
            f"{len(report['registered_source_keys'])} registered, "
            f"{len(report['referenced_source_keys'])} collector references, "
            f"{len(report['publishable_source_keys'])} publishable"
        )
        return 0
    print("[SOURCE REGISTRY] FAILED")
    for error in report["errors"]:
        print(f"  - {error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
