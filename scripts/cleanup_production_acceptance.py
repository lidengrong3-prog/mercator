"""Compensating cleanup for production acceptance runs.

This command is safe to run repeatedly. It is used by CI ``always()`` steps
and by operators after a cancelled or timed-out browser run.
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request


def call_rpc(name: str, body: dict) -> object:
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required")
    request = urllib.request.Request(
        f"{url}/rest/v1/rpc/{name}",
        data=json.dumps(body).encode("utf-8"),
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read() or b"null")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"cleanup RPC failed: HTTP {error.code} {detail}") from error


def service_rows(table: str, query: dict) -> list[dict]:
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    request = urllib.request.Request(
        f"{url}/rest/v1/{table}?{urllib.parse.urlencode(query)}",
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            value = json.loads(response.read() or b"[]")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"cleanup lookup failed: HTTP {error.code} {detail}") from error
    if not isinstance(value, list):
        raise RuntimeError("cleanup lookup returned an invalid response")
    return value


def delete_storage_paths(run_id: str) -> int:
    rows = service_rows("report_exports", {
        "select": "file_path",
        "acceptance_run_id": f"eq.{run_id}",
        "file_path": "not.is.null",
        "limit": "5000",
    })
    marker = f"/acceptance/{urllib.parse.quote(run_id, safe='')}/"
    paths = sorted({
        str(row.get("file_path") or "").strip()
        for row in rows
        if marker in str(row.get("file_path") or "")
        and "://" not in str(row.get("file_path") or "")
    })
    if not paths:
        return 0
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    request = urllib.request.Request(
        f"{url}/storage/v1/object/reports",
        data=json.dumps({"prefixes": paths}).encode("utf-8"),
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        },
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.status not in (200, 204):
                raise RuntimeError(f"Storage cleanup failed: HTTP {response.status}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"Storage cleanup failed: HTTP {error.code} {detail}") from error
    return len(paths)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=os.environ.get("ACCEPTANCE_RUN_ID", ""))
    parser.add_argument("--expired", action="store_true", help="also remove expired/orphaned runs")
    parser.add_argument("--retention-days", type=int, default=7)
    parser.add_argument("--mark", choices=("running", "passed", "failed", "timed_out"))
    parser.add_argument("--mark-only", action="store_true")
    args = parser.parse_args()
    run_id = str(args.run_id or "").strip()
    if not run_id and not args.expired:
        parser.error("--run-id or ACCEPTANCE_RUN_ID is required")
    result = {}
    existing = service_rows("production_acceptance_runs", {
        "select": "status",
        "acceptance_run_id": f"eq.{run_id}",
        "limit": "1",
    }) if run_id else []
    if run_id and not existing:
        result["run"] = {"acceptance_run_id": run_id, "status": "not_found", "duplicate": True}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if existing and existing[0].get("status") == "cleaned":
        result["run"] = {"acceptance_run_id": run_id, "status": "cleaned", "duplicate": True}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if args.mark:
        result["status"] = call_rpc("mark_production_acceptance_run", {
            "p_acceptance_run_id": run_id,
            "p_status": args.mark,
            "p_result_summary": None,
            "p_error_summary": {"terminal_status": args.mark} if args.mark in ("failed", "timed_out") else None,
        })
    if run_id and not args.mark_only:
        result["storage_objects"] = delete_storage_paths(run_id)
        result["run"] = call_rpc("cleanup_production_acceptance_run", {"p_acceptance_run_id": run_id})
        if not isinstance(result["run"], dict) or result["run"].get("status") not in ("cleaned", "not_found"):
            raise RuntimeError(f"cleanup did not finish: {result['run']}")
    if args.expired:
        result["expired"] = call_rpc("cleanup_expired_production_acceptance_runs", {"p_retention": f"{max(1, args.retention_days)} days"})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
