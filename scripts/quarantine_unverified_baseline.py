#!/usr/bin/env python3
"""Remove unverified demonstration baselines from publishable data."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

from validate_data import parse_datetime, valid_http_url


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")


def load(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save(path, data):
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def is_unverified(item):
    source_url = item.get("source_url") or item.get("url")
    return (
        not valid_http_url(source_url)
        or item.get("source_verified") is False
        or item.get("data_quality") == "demonstration"
    )


def migrate(kind):
    baseline_path = os.path.join(DATA_DIR, f"{kind}_baseline.json")
    data_path = os.path.join(DATA_DIR, f"{kind}.json")
    baseline = load(baseline_path)
    current = load(data_path)
    baseline_items = baseline.get("items", [])
    quarantined = [item for item in baseline_items if is_unverified(item)]
    quarantined_ids = {item.get("id") for item in quarantined if item.get("id")}
    quarantined_titles = {str(item.get("title", "")).strip().casefold() for item in quarantined}
    baseline["items"] = [item for item in baseline_items if item not in quarantined]
    current["items"] = [
        item for item in current.get("items", [])
        if item.get("id") not in quarantined_ids
        and str(item.get("title", "")).strip().casefold() not in quarantined_titles
    ]
    baseline["note"] = "Only source-verified baseline records are publishable. Unverified legacy samples are archived outside the live dataset."
    save(baseline_path, baseline)
    save(data_path, current)
    print(
        f"[QUARANTINE] {kind}: archived={len(quarantined)} "
        f"live={len(current['items'])} baseline={len(baseline['items'])}"
    )
    return quarantined


def main():
    parser = argparse.ArgumentParser(description="Quarantine unverified baseline records")
    parser.add_argument("--now", help="ISO audit timestamp")
    args = parser.parse_args()
    now = parse_datetime(args.now) if args.now else datetime.now(timezone.utc)
    if now is None:
        parser.error("--now must be a valid ISO timestamp")
    records = {kind: migrate(kind) for kind in ("policies", "rules")}
    output = os.path.join(DATA_DIR, "quarantine_unverified_baseline.json")
    save(output, {
        "reason": "Records were demonstration baselines without a verifiable original source URL and are excluded from live decisions.",
        "audited_at": now.isoformat(),
        "records": records,
    })
    print(f"[QUARANTINE] report={os.path.relpath(output, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
