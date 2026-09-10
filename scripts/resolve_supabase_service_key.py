#!/usr/bin/env python3
"""Extract a legacy service-role key from `supabase projects api-keys` JSON."""

from __future__ import annotations

import json
import sys


def find_service_key(payload: object) -> str:
    rows = payload if isinstance(payload, list) else payload.get("api_keys", []) if isinstance(payload, dict) else []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or row.get("type") or "").strip().lower()
        value = str(row.get("api_key") or row.get("key") or row.get("value") or "").strip()
        if name in {"service_role", "service-role", "secret"} and value:
            return value
    raise ValueError("Supabase API response did not contain a service-role key")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        sys.stdout.write(find_service_key(payload))
        return 0
    except (ValueError, json.JSONDecodeError) as error:
        print(f"[SUPABASE KEY] {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
