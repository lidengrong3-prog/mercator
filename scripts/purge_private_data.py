#!/usr/bin/env python3
"""Apply retention deadlines to private Storage objects and service-only rows."""

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


SSL_CONTEXT = ssl.create_default_context()


def request(url, key, *, method="GET", body=None, headers=None):
    final_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        **(headers or {}),
    }
    req = urllib.request.Request(url, data=body, headers=final_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120, context=SSL_CONTEXT) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"retention request failed: HTTP {error.code}: {detail}") from error


def purge(supabase_url, service_key, *, now=None):
    base = supabase_url.rstrip("/")
    now = now or datetime.now(timezone.utc)
    cutoff = urllib.parse.quote(now.isoformat(), safe="")
    status, artifacts = request(
        f"{base}/rest/v1/private_data_artifacts?select=id,bucket_id,object_path&retention_until=lt.{cutoff}",
        service_key,
    )
    if status != 200 or not isinstance(artifacts, list):
        raise RuntimeError("cannot list expired private artifacts")

    deleted_objects = 0
    failures = []
    for artifact in artifacts:
        object_url = (
            f"{base}/storage/v1/object/{urllib.parse.quote(artifact['bucket_id'], safe='')}"
            f"/{urllib.parse.quote(artifact['object_path'], safe='/')}"
        )
        try:
            request(object_url, service_key, method="DELETE")
            artifact_id = urllib.parse.quote(str(artifact["id"]), safe="")
            request(
                f"{base}/rest/v1/private_data_artifacts?id=eq.{artifact_id}",
                service_key,
                method="DELETE",
                headers={"Prefer": "return=minimal"},
            )
            deleted_objects += 1
        except Exception as error:
            failures.append({"artifact_id": artifact.get("id"), "error": str(error)[:240]})

    raw_status, _ = request(
        f"{base}/rest/v1/raw_data_records?retention_until=lt.{cutoff}",
        service_key,
        method="DELETE",
        headers={"Prefer": "return=minimal"},
    )
    sync_cutoff = urllib.parse.quote((now - timedelta(days=90)).isoformat(), safe="")
    sync_status, _ = request(
        f"{base}/rest/v1/private_sync_runs?completed_at=lt.{sync_cutoff}",
        service_key,
        method="DELETE",
        headers={"Prefer": "return=minimal"},
    )
    return {
        "status": "failed" if failures else "succeeded",
        "completed_at": now.isoformat(),
        "expired_artifacts_found": len(artifacts),
        "storage_objects_deleted": deleted_objects,
        "artifact_delete_failures": failures,
        "expired_raw_records_delete_status": raw_status,
        "expired_sync_runs_delete_status": sync_status,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="private-data-retention-summary.json")
    args = parser.parse_args()
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not supabase_url or not service_key:
        print("SUPABASE_URL and SUPABASE_SERVICE_KEY are required", file=sys.stderr)
        return 2
    result = purge(supabase_url, service_key)
    Path(args.output).write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(result, ensure_ascii=False))
    return 1 if result["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
