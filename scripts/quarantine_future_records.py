#!/usr/bin/env python3
"""Move impossible future-collected legacy records out of publishable datasets."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone

from validate_data import parse_datetime


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")


def quarantine_file(path: str, cutoff: datetime) -> list[dict]:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    items = data.get("items", [])
    kept: list[dict] = []
    quarantined: list[dict] = []
    for item in items:
        timestamps = (parse_datetime(item.get("collected_at")), parse_datetime(item.get("published_at")))
        if any(value and value > cutoff for value in timestamps):
            quarantined.append(item)
        else:
            kept.append(item)
    if quarantined:
        data["items"] = kept
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    return quarantined


def main() -> int:
    parser = argparse.ArgumentParser(description="Quarantine legacy records with impossible future timestamps")
    parser.add_argument("--now", help="ISO timestamp used as the audit time")
    args = parser.parse_args()
    now = parse_datetime(args.now) if args.now else datetime.now(timezone.utc)
    if now is None:
        parser.error("--now must be a valid ISO timestamp")
    cutoff = now + timedelta(days=1)

    quarantined: dict[str, list[dict]] = {}
    for filename in ("rules.json", "rules_baseline.json"):
        path = os.path.join(DATA_DIR, filename)
        rows = quarantine_file(path, cutoff)
        if rows:
            quarantined[filename] = rows
            print(f"[QUARANTINE] {filename}: moved {len(rows)} records")

    if quarantined:
        output = os.path.join(DATA_DIR, "quarantine_future_records.json")
        payload = {
            "reason": "Legacy records had collected_at or published_at later than the audit date and no verifiable publication trail.",
            "audited_at": now.isoformat(),
            "records": quarantined,
        }
        with open(output, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        print(f"[QUARANTINE] report={os.path.relpath(output, ROOT)}")
    else:
        print("[QUARANTINE] no future-dated records found")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
