"""Compensating cleanup for production acceptance runs.

This command is safe to run repeatedly. It is used by CI ``always()`` steps
and by operators after a cancelled or timed-out browser run.
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
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
    if args.mark:
        result["status"] = call_rpc("mark_production_acceptance_run", {
            "p_acceptance_run_id": run_id,
            "p_status": args.mark,
            "p_result_summary": None,
            "p_error_summary": {"terminal_status": args.mark} if args.mark in ("failed", "timed_out") else None,
        })
    if run_id and not args.mark_only:
        result["run"] = call_rpc("cleanup_production_acceptance_run", {"p_acceptance_run_id": run_id})
    if args.expired:
        result["expired"] = call_rpc("cleanup_expired_production_acceptance_runs", {"p_retention": f"{max(1, args.retention_days)} days"})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
