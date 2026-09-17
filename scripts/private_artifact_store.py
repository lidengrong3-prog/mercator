#!/usr/bin/env python3
"""Upload a private data artifact to Supabase Storage and register its metadata."""

import argparse
import hashlib
import json
import mimetypes
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


BUCKET = "private-raw-data"
ROOT = Path(__file__).resolve().parent.parent
SSL_CONTEXT = ssl.create_default_context()


def _safe_segment(value):
    text = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "").strip()).strip("-.")
    return text[:120] or "unknown"


def _request(url, key, *, method, body=None, headers=None, timeout=120):
    final_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        **(headers or {}),
    }
    request = urllib.request.Request(url, data=body, headers=final_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"private artifact request failed: HTTP {error.code}: {detail}") from error


def upload_private_bytes(
    supabase_url,
    service_key,
    content,
    *,
    run_id,
    source_key,
    artifact_kind,
    retention_days,
    original_name="artifact.bin",
    content_type=None,
    metadata=None,
    bucket=BUCKET,
):
    if not isinstance(content, (bytes, bytearray, memoryview)):
        raise TypeError("content must be bytes-like")
    content = bytes(content)
    digest = hashlib.sha256(content).hexdigest()
    now = datetime.now(timezone.utc)
    object_path = "/".join((
        _safe_segment(source_key or "internal-system"),
        now.strftime("%Y/%m/%d"),
        _safe_segment(run_id),
        f"{digest[:16]}-{_safe_segment(original_name)}",
    ))
    content_type = content_type or mimetypes.guess_type(str(original_name))[0] or "application/octet-stream"
    object_url = (
        f"{supabase_url.rstrip('/')}/storage/v1/object/{urllib.parse.quote(bucket, safe='')}"
        f"/{urllib.parse.quote(object_path, safe='/')}"
    )
    status, _ = _request(
        object_url,
        service_key,
        method="POST",
        body=content,
        headers={"Content-Type": content_type, "x-upsert": "true"},
    )
    if status not in (200, 201):
        raise RuntimeError(f"private artifact upload returned HTTP {status}")

    retention_until = now + timedelta(days=int(retention_days))
    row = {
        "run_id": str(run_id),
        "source_key": source_key or "internal-system",
        "artifact_kind": artifact_kind,
        "original_name": str(original_name),
        "bucket_id": bucket,
        "object_path": object_path,
        "sha256": digest,
        "byte_size": len(content),
        "content_type": content_type,
        "captured_at": now.isoformat(),
        "retention_until": retention_until.isoformat(),
        "metadata": dict(metadata or {}),
    }
    rest_url = (
        f"{supabase_url.rstrip('/')}/rest/v1/private_data_artifacts"
        "?on_conflict=bucket_id,object_path"
    )
    rest_body = json.dumps(row, ensure_ascii=False).encode("utf-8")
    status, _ = _request(
        rest_url,
        service_key,
        method="POST",
        body=rest_body,
        headers={
            "Content-Type": "application/json",
            "Prefer": "return=minimal,resolution=merge-duplicates",
        },
    )
    if status not in (200, 201):
        raise RuntimeError(f"private artifact registry returned HTTP {status}")
    return row


def upload_private_artifact(
    supabase_url,
    service_key,
    path,
    *,
    run_id,
    source_key,
    artifact_kind,
    retention_days,
    metadata=None,
    bucket=BUCKET,
):
    """Upload a local file without changing the metadata-only registry contract."""
    path = Path(path).resolve()
    return upload_private_bytes(
        supabase_url,
        service_key,
        path.read_bytes(),
        run_id=run_id,
        source_key=source_key,
        artifact_kind=artifact_kind,
        retention_days=retention_days,
        original_name=path.name,
        metadata=metadata,
        bucket=bucket,
    )


def public_upload_summary(row):
    return {
        "status": "uploaded",
        "run_id": row["run_id"],
        "artifact_kind": row["artifact_kind"],
        "bucket_id": row["bucket_id"],
        "object_path": row["object_path"],
        "sha256": row["sha256"],
        "byte_size": row["byte_size"],
        "retention_until": row["retention_until"],
    }


def register_completed_backup(supabase_url, service_key, row):
    artifact_kind = row.get("artifact_kind")
    if artifact_kind not in {"encrypted_backup", "storage_backup"}:
        return None
    location = f"{row['bucket_id']}/{row['object_path']}"
    query = urllib.parse.urlencode({
        "location": f"eq.{location}",
        "status": "eq.completed",
        "select": "id",
        "limit": "1",
    })
    status, body = _request(
        f"{supabase_url.rstrip('/')}/rest/v1/backup_runs?{query}",
        service_key,
        method="GET",
    )
    if status != 200:
        raise RuntimeError(f"backup run lookup returned HTTP {status}")
    existing = json.loads(body.decode("utf-8")) if body else []
    if isinstance(existing, list) and existing:
        return existing[0].get("id")
    payload = {
        "backup_type": "storage" if artifact_kind == "storage_backup" else "logical",
        "status": "completed",
        "location": location,
        "checksum": row["sha256"],
        "size_bytes": row["byte_size"],
        "started_at": row["captured_at"],
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    status, body = _request(
        f"{supabase_url.rstrip('/')}/rest/v1/backup_runs",
        service_key,
        method="POST",
        body=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Prefer": "return=representation"},
    )
    if status not in (200, 201):
        raise RuntimeError(f"backup run registration returned HTTP {status}")
    rows = json.loads(body.decode("utf-8")) if body else []
    return rows[0].get("id") if isinstance(rows, list) and rows else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--source-key", default="internal-system")
    parser.add_argument("--kind", required=True, choices=(
        "raw_response", "collection_log", "sync_log", "quarantine",
        "licensed_dataset", "internal_dataset", "encrypted_backup",
        "storage_backup",
    ))
    parser.add_argument("--retention-days", required=True, type=int)
    parser.add_argument("--summary-output")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not supabase_url or not service_key:
        print("SUPABASE_URL and SUPABASE_SERVICE_KEY are required", file=sys.stderr)
        return 2
    row = upload_private_artifact(
        supabase_url,
        service_key,
        ROOT / args.file,
        run_id=args.run_id,
        source_key=args.source_key,
        artifact_kind=args.kind,
        retention_days=args.retention_days,
    )
    summary = public_upload_summary(row)
    backup_run_id = register_completed_backup(supabase_url, service_key, row)
    if backup_run_id:
        summary["backup_run_id"] = backup_run_id
    if args.summary_output:
        Path(args.summary_output).write_text(
            json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
