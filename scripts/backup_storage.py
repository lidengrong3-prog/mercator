#!/usr/bin/env python3
"""Create a complete private archive of Supabase Storage objects."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


BACKUP_ARTIFACT_KINDS = ("encrypted_backup", "storage_backup")
DEFAULT_PAGE_SIZE = 1000
DOWNLOAD_CHUNK_SIZE = 1024 * 1024


def request(
    url: str,
    key: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict | None = None,
    retries: int = 3,
) -> bytes:
    final = {"apikey": key, "Authorization": f"Bearer {key}", **(headers or {})}
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, data=body, headers=final, method=method),
                timeout=180,
            ) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            retryable = error.code == 429 or error.code >= 500
            if not retryable or attempt + 1 >= retries:
                detail = error.read().decode("utf-8", errors="replace")[:240]
                raise RuntimeError(f"STORAGE_API_HTTP_{error.code}: {detail}") from None
        except (OSError, TimeoutError) as error:
            if attempt + 1 >= retries:
                raise RuntimeError("STORAGE_API_UNAVAILABLE") from error
        time.sleep(2 ** attempt)
    raise RuntimeError("STORAGE_API_UNAVAILABLE")


def list_objects(
    base: str,
    key: str,
    bucket: str,
    prefix: str = "",
    *,
    page_size: int = DEFAULT_PAGE_SIZE,
    visited: set[str] | None = None,
    stats: dict | None = None,
) -> list[str]:
    visited = visited if visited is not None else set()
    stats = stats if stats is not None else {"pages": 0}
    if prefix in visited:
        return []
    visited.add(prefix)
    names: list[str] = []
    offset = 0
    while True:
        body = json.dumps({
            "prefix": prefix,
            "limit": page_size,
            "offset": offset,
            "sortBy": {"column": "name", "order": "asc"},
        }).encode()
        raw = request(
            f"{base.rstrip('/')}/storage/v1/object/list/{urllib.parse.quote(bucket, safe='')}",
            key,
            method="POST",
            body=body,
            headers={"Content-Type": "application/json"},
        )
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError("STORAGE_LIST_INVALID_JSON") from error
        if not isinstance(value, list):
            raise RuntimeError("STORAGE_LIST_INVALID_RESPONSE")
        stats["pages"] = int(stats.get("pages", 0)) + 1
        for item in value:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "")
            if not name:
                continue
            full = f"{prefix}{name}"
            if item.get("id") or item.get("metadata") is not None:
                names.append(full)
            else:
                names.extend(list_objects(
                    base,
                    key,
                    bucket,
                    f"{full.rstrip('/')}/",
                    page_size=page_size,
                    visited=visited,
                    stats=stats,
                ))
        if len(value) < page_size:
            break
        offset += len(value)
    return sorted(set(names))


def excluded_backup_paths(base: str, key: str, *, page_size: int = DEFAULT_PAGE_SIZE) -> dict[str, set[str]]:
    excluded: dict[str, set[str]] = {}
    offset = 0
    while True:
        query = urllib.parse.urlencode({
            "artifact_kind": f"in.({','.join(BACKUP_ARTIFACT_KINDS)})",
            "select": "bucket_id,object_path",
            "order": "created_at.asc",
            "limit": str(page_size),
            "offset": str(offset),
        })
        raw = request(f"{base.rstrip('/')}/rest/v1/private_data_artifacts?{query}", key)
        try:
            rows = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError("BACKUP_EXCLUSION_REGISTRY_INVALID") from error
        if not isinstance(rows, list):
            raise RuntimeError("BACKUP_EXCLUSION_REGISTRY_INVALID")
        for row in rows:
            if not isinstance(row, dict):
                continue
            bucket = str(row.get("bucket_id") or "")
            path = str(row.get("object_path") or "")
            if bucket and path:
                excluded.setdefault(bucket, set()).add(path)
        if len(rows) < page_size:
            break
        offset += len(rows)
    return excluded


def safe_destination(bucket_root: Path, object_name: str) -> Path:
    posix = PurePosixPath(object_name)
    if posix.is_absolute() or any(part in {"", ".", ".."} for part in posix.parts):
        raise RuntimeError("STORAGE_OBJECT_PATH_INVALID")
    destination = bucket_root.joinpath(*posix.parts).resolve()
    root = bucket_root.resolve()
    if destination != root and root not in destination.parents:
        raise RuntimeError("STORAGE_OBJECT_PATH_INVALID")
    return destination


def download_object(base: str, key: str, bucket: str, name: str, destination: Path, max_bytes: int) -> tuple[int, str]:
    url = (
        f"{base.rstrip('/')}/storage/v1/object/{urllib.parse.quote(bucket, safe='')}"
        f"/{urllib.parse.quote(name, safe='/')}"
    )
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    part = destination.with_name(destination.name + ".part")
    destination.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        size = 0
        digest = hashlib.sha256()
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers=headers, method="GET"),
                timeout=180,
            ) as response, part.open("wb") as output:
                while True:
                    chunk = response.read(DOWNLOAD_CHUNK_SIZE)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > max_bytes:
                        raise RuntimeError("STORAGE_BACKUP_MAX_BYTES_EXCEEDED")
                    digest.update(chunk)
                    output.write(chunk)
            part.replace(destination)
            return size, digest.hexdigest()
        except RuntimeError:
            part.unlink(missing_ok=True)
            raise
        except urllib.error.HTTPError as error:
            part.unlink(missing_ok=True)
            if error.code != 429 and error.code < 500:
                raise RuntimeError(f"STORAGE_OBJECT_HTTP_{error.code}") from None
            if attempt == 2:
                raise RuntimeError(f"STORAGE_OBJECT_HTTP_{error.code}") from None
        except (OSError, TimeoutError) as error:
            part.unlink(missing_ok=True)
            if attempt == 2:
                raise RuntimeError("STORAGE_OBJECT_DOWNLOAD_FAILED") from error
        time.sleep(2 ** attempt)
    raise RuntimeError("STORAGE_OBJECT_DOWNLOAD_FAILED")


def write_summary(path: Path | None, summary: dict) -> None:
    if path:
        path.write_text(json.dumps(summary, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--summary-output")
    parser.add_argument("--buckets", default=os.environ.get("STORAGE_BACKUP_BUCKETS", "private-raw-data,reports"))
    args = parser.parse_args(argv)
    output_path = Path(args.output).resolve()
    summary_path = Path(args.summary_output).resolve() if args.summary_output else None
    started = datetime.now(timezone.utc)
    summary: dict = {
        "status": "failed",
        "backup_type": "storage",
        "started_at": started.isoformat(),
        "buckets": {},
        "total_objects": 0,
        "total_bytes": 0,
        "excluded_backup_objects": 0,
    }
    try:
        base = os.environ["SUPABASE_URL"].strip()
        key = os.environ["SUPABASE_SERVICE_KEY"].strip()
        max_bytes = int(os.environ.get("STORAGE_BACKUP_MAX_BYTES", "500000000"))
        page_size = int(os.environ.get("STORAGE_BACKUP_PAGE_SIZE", str(DEFAULT_PAGE_SIZE)))
        if not base or not key or max_bytes < 1 or not 1 <= page_size <= 1000:
            raise RuntimeError("STORAGE_BACKUP_CONFIG_INVALID")
        buckets = [part.strip() for part in args.buckets.split(",") if part.strip()]
        if not buckets:
            raise RuntimeError("STORAGE_BACKUP_BUCKETS_EMPTY")
        excluded = excluded_backup_paths(base, key, page_size=page_size)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="jay-storage-backup-") as temp:
            root = Path(temp)
            manifest: dict = {
                "schema_version": "2026-09-17",
                "created_at": started.isoformat(),
                "buckets": {},
                "total_bytes": 0,
                "total_objects": 0,
            }
            for bucket in buckets:
                bucket_root = root / bucket
                bucket_root.mkdir(parents=True, exist_ok=True)
                listing_stats = {"pages": 0}
                names = list_objects(base, key, bucket, page_size=page_size, stats=listing_stats)
                excluded_names = excluded.get(bucket, set())
                selected = [name for name in names if name not in excluded_names]
                entries = []
                bucket_bytes = 0
                for name in selected:
                    remaining = max_bytes - int(manifest["total_bytes"])
                    if remaining < 1:
                        raise RuntimeError("STORAGE_BACKUP_MAX_BYTES_EXCEEDED")
                    destination = safe_destination(bucket_root, name)
                    size, digest = download_object(base, key, bucket, name, destination, remaining)
                    entries.append({"path": name, "size_bytes": size, "sha256": digest})
                    bucket_bytes += size
                    manifest["total_bytes"] += size
                    manifest["total_objects"] += 1
                excluded_count = sum(1 for name in names if name in excluded_names)
                manifest["buckets"][bucket] = {
                    "objects": len(entries),
                    "bytes": bucket_bytes,
                    "excluded_backup_objects": excluded_count,
                    "entries": entries,
                }
                summary["buckets"][bucket] = {
                    "objects": len(entries),
                    "bytes": bucket_bytes,
                    "excluded_backup_objects": excluded_count,
                    "list_pages": listing_stats["pages"],
                }
                summary["excluded_backup_objects"] += excluded_count
            (root / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            with tarfile.open(output_path, "w:gz") as archive:
                for child in sorted(root.iterdir(), key=lambda path: path.name):
                    archive.add(child, arcname=child.name)
            summary["total_bytes"] = int(manifest["total_bytes"])
            summary["total_objects"] = int(manifest["total_objects"])
        archive_digest = hashlib.sha256()
        with output_path.open("rb") as archive_file:
            for chunk in iter(lambda: archive_file.read(DOWNLOAD_CHUNK_SIZE), b""):
                archive_digest.update(chunk)
        summary["archive_size_bytes"] = output_path.stat().st_size
        summary["archive_sha256"] = archive_digest.hexdigest()
        summary["status"] = "created"
    except Exception as error:  # noqa: BLE001 - always emit a safe diagnostic summary.
        output_path.unlink(missing_ok=True)
        summary["error_code"] = str(error).split(":", 1)[0][:120] or "STORAGE_BACKUP_FAILED"
    finally:
        summary["completed_at"] = datetime.now(timezone.utc).isoformat()
        write_summary(summary_path, summary)
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if summary["status"] == "created" else 1


if __name__ == "__main__":
    raise SystemExit(main())
