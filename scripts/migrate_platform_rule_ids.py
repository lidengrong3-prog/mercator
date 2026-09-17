#!/usr/bin/env python3
"""Migrate cached platform rules from internal hashes to official source IDs."""

import argparse
import json
import os
from datetime import datetime, timezone

import collect_data


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_RULES_PATH = os.path.join(ROOT, "data", "rules.json")


def migrate_payload(payload, *, now=None):
    now = now or datetime.now(timezone.utc)
    migrated = dict(payload or {})
    items = []
    changed_ids = 0
    for item in migrated.get("items", []):
        if not isinstance(item, dict):
            continue
        old_source_id = str(item.get("source_record_id") or "")
        normalized = collect_data.normalize_platform_rule(item)
        if normalized.get("source_record_id") != old_source_id:
            changed_ids += 1
            normalized.pop("evidence_hash", None)
        normalized = collect_data.annotate_provenance(normalized)
        items.append(normalized)

    platform_keys = list((migrated.get("platform_coverage") or {}).keys())
    if not platform_keys:
        platform_keys = ["amazon", "tiktok-shop", "aliexpress", "ebay"]
    coverage = collect_data.build_platform_rule_coverage(
        items, platform_keys, market_codes=["US"], now=now
    )
    migrated["items"] = items
    migrated["source_count"] = len({item.get("platform_key") for item in items if item.get("platform_key")})
    migrated["platform_coverage"] = coverage
    migrated["platform_status"] = coverage
    migrated["versioning"] = dict(collect_data.PLATFORM_RULE_VERSIONING)
    migrated["source_identity_migration"] = {
        "version": 1,
        "migrated_at": now.isoformat(),
        "records_updated": changed_ids,
        "fallback_policy": "internal rule_key only; never source_record_id",
    }
    return migrated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", default=DEFAULT_RULES_PATH)
    args = parser.parse_args()
    with open(args.path, encoding="utf-8") as handle:
        payload = json.load(handle)
    migrated = migrate_payload(payload)
    with open(args.path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(migrated, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(
        f"Migrated {migrated['source_identity_migration']['records_updated']} source IDs; "
        f"{len(migrated['items'])} current rules retained."
    )


if __name__ == "__main__":
    main()
