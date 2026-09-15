#!/usr/bin/env python3
"""Create a private encrypted-ready archive of Supabase Storage objects."""

from __future__ import annotations

import argparse
import json
import os
import tarfile
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path


def request(url: str, key: str, *, method: str = "GET", body: bytes | None = None, headers: dict | None = None) -> bytes:
    final = {"apikey": key, "Authorization": f"Bearer {key}", **(headers or {})}
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=final, method=method), timeout=180) as response:
        return response.read()


def list_objects(base: str, key: str, bucket: str, prefix: str = "") -> list[str]:
    body = json.dumps({"prefix": prefix, "limit": 1000, "offset": 0}).encode()
    value = json.loads(request(f"{base.rstrip('/')}/storage/v1/object/list/{urllib.parse.quote(bucket, safe='')}", key, method="POST", body=body, headers={"Content-Type": "application/json"}).decode())
    names: list[str] = []
    for item in value if isinstance(value, list) else []:
        name = str(item.get("name") or "")
        if not name:
            continue
        full = f"{prefix}{name}"
        if item.get("id"):
            names.append(full)
        else:
            names.extend(list_objects(base, key, bucket, f"{full}/"))
    return names


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--buckets", default=os.environ.get("STORAGE_BACKUP_BUCKETS", "private-raw-data,reports"))
    args = parser.parse_args()
    base = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    max_bytes = int(os.environ.get("STORAGE_BACKUP_MAX_BYTES", "500000000"))
    manifest: dict = {"schema_version": "2026-09-16", "buckets": {}, "total_bytes": 0}
    with tempfile.TemporaryDirectory(prefix="jay-storage-backup-") as temp:
        root = Path(temp)
        for bucket in [part.strip() for part in args.buckets.split(",") if part.strip()]:
            bucket_root = root / bucket
            bucket_root.mkdir(parents=True, exist_ok=True)
            names = list_objects(base, key, bucket)
            entries = []
            for name in names:
                payload = request(f"{base.rstrip('/')}/storage/v1/object/{urllib.parse.quote(bucket, safe='')}/{urllib.parse.quote(name, safe='/')}", key)
                if manifest["total_bytes"] + len(payload) > max_bytes:
                    raise RuntimeError("STORAGE_BACKUP_MAX_BYTES_EXCEEDED")
                destination = bucket_root / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(payload)
                entries.append({"path": name, "size_bytes": len(payload)})
                manifest["total_bytes"] += len(payload)
            manifest["buckets"][bucket] = {"objects": len(entries), "entries": entries}
        (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        with tarfile.open(args.output, "w:gz") as archive:
            for child in root.iterdir():
                archive.add(child, arcname=child.name)
    print(json.dumps({"status": "created", "buckets": {bucket: value["objects"] for bucket, value in manifest["buckets"].items()}, "total_bytes": manifest["total_bytes"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
