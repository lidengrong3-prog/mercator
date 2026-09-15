#!/usr/bin/env python3
"""Record production evidence and advance the public rollout one stage at a time."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class ReadinessError(RuntimeError):
    pass


def env(name: str, *fallbacks: str) -> str:
    for key in (name, *fallbacks):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    raise ReadinessError(f"missing required environment variable: {name}")


def request(method: str, url: str, headers=None, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    final_headers = dict(headers or {})
    if data is not None:
        final_headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=final_headers, method=method), timeout=45) as response:
            return response.status, json.loads(response.read() or b"null")
    except urllib.error.HTTPError as error:
        raw = error.read()
        try: value = json.loads(raw or b"null")
        except json.JSONDecodeError: value = {"error": raw.decode("utf-8", "replace")[:300]}
        return error.code, value


class Client:
    def __init__(self):
        self.url = env("SUPABASE_URL").rstrip("/")
        self.key = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")
        self.headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}"}

    def rpc(self, name: str, body: dict):
        status, value = request("POST", f"{self.url}/rest/v1/rpc/{name}", self.headers, body)
        if status != 200: raise ReadinessError(f"{name} failed: HTTP {status} {value}")
        return value

    def insert(self, table: str, body: dict):
        headers = {**self.headers, "Prefer": "return=representation"}
        status, value = request("POST", f"{self.url}/rest/v1/{table}", headers, body)
        if status not in (200, 201): raise ReadinessError(f"{table} insert failed: HTTP {status} {value}")
        return value


def load_json(path: str) -> tuple[dict, str]:
    raw = Path(path).read_bytes()
    try: value = json.loads(raw)
    except json.JSONDecodeError as error: raise ReadinessError(f"invalid JSON artifact: {error}") from error
    if not isinstance(value, dict): raise ReadinessError("artifact must contain one JSON object")
    embedded = value.pop("artifact_digest", None)
    digest = hashlib.sha256(json.dumps(value, separators=(",", ":")).encode("utf-8")).hexdigest()
    if embedded and embedded != digest: raise ReadinessError("artifact digest does not match content")
    value["artifact_digest"] = digest
    return value, digest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    start = sub.add_parser("start"); start.add_argument("--target-stage", choices=("invite_beta", "public_beta", "general"), required=True)
    start.add_argument("--actor-id", required=True); start.add_argument("--approval-reference", required=True)
    status = sub.add_parser("status"); status.add_argument("--run-id", required=True)
    record = sub.add_parser("record"); record.add_argument("--run-id", required=True); record.add_argument("--test-key", required=True)
    record.add_argument("--passed", choices=("true", "false"), required=True); record.add_argument("--source", choices=("automated", "operator"), required=True)
    record.add_argument("--artifact"); record.add_argument("--metrics-json", default="{}")
    load = sub.add_parser("load"); load.add_argument("--run-id", required=True); load.add_argument("--artifact", required=True)
    finalize = sub.add_parser("finalize"); finalize.add_argument("--run-id", required=True); finalize.add_argument("--actor-id", required=True); finalize.add_argument("--approval-reference", required=True)
    advance = sub.add_parser("advance"); advance.add_argument("--run-id", required=True); advance.add_argument("--actor-id", required=True); advance.add_argument("--approval-reference", required=True)
    advance.add_argument("--registration-limit", type=int); advance.add_argument("--daily-ai-token-limit", type=int, default=50000)
    validate = sub.add_parser("validate"); validate.add_argument("--run-id", required=True)
    args = parser.parse_args(); client = Client()

    if args.command == "start":
        result = client.rpc("start_production_readiness_run", {"p_target_stage": args.target_stage, "p_started_by": args.actor_id, "p_approval_reference": args.approval_reference})
    elif args.command == "status":
        result = client.rpc("production_readiness", {"p_run_id": args.run_id})
    elif args.command == "record":
        metrics = json.loads(args.metrics_json)
        digest = None
        if args.artifact:
            artifact, digest = load_json(args.artifact); metrics = {**metrics, "artifact": {key: value for key, value in artifact.items() if key not in ("statuses",)}}
        if args.source == "automated" and not digest: raise ReadinessError("automated evidence requires --artifact")
        result = client.rpc("record_production_readiness_evidence", {"p_run_id": args.run_id, "p_test_key": args.test_key, "p_passed": args.passed == "true", "p_evidence_source": args.source, "p_artifact_digest": digest, "p_metrics": metrics, "p_observed_at": None})
    elif args.command == "load":
        artifact, digest = load_json(args.artifact)
        if artifact.get("profile") not in ("read_100", "read_500", "read_1000"): raise ReadinessError("unsupported load profile")
        row = {key: artifact.get(key) for key in ("profile", "virtual_users", "duration_seconds", "total_requests", "failed_requests", "error_rate", "p50_ms", "p95_ms", "p99_ms", "search_p95_ms", "thresholds", "passed", "started_at", "completed_at")}
        row.update({"readiness_run_id": args.run_id, "artifact_digest": digest, "release_sha": os.environ.get("RELEASE_SHA")})
        client.insert("production_load_test_runs", row)
        client.rpc("record_production_readiness_evidence", {"p_run_id": args.run_id, "p_test_key": artifact["profile"], "p_passed": artifact.get("passed") is True, "p_evidence_source": "automated", "p_artifact_digest": digest, "p_metrics": {"virtual_users": artifact["virtual_users"], "total_requests": artifact["total_requests"], "error_rate": artifact["error_rate"], "p95_ms": artifact["p95_ms"], "search_p95_ms": artifact["search_p95_ms"]}, "p_observed_at": artifact["completed_at"]})
        result = {"status": "recorded", "profile": artifact["profile"], "passed": artifact["passed"], "artifact_digest": digest}
    elif args.command == "finalize":
        result = client.rpc("finalize_production_readiness_run", {"p_run_id": args.run_id, "p_completed_by": args.actor_id, "p_approval_reference": args.approval_reference})
    elif args.command == "advance":
        result = client.rpc("advance_production_rollout", {"p_run_id": args.run_id, "p_changed_by": args.actor_id, "p_approval_reference": args.approval_reference, "p_registration_limit": args.registration_limit, "p_daily_ai_token_limit": args.daily_ai_token_limit})
    else:
        result = client.rpc("production_readiness", {"p_run_id": args.run_id})
        if not isinstance(result, dict) or result.get("status") != "passed" or result.get("ready") is not True:
            raise ReadinessError(f"production rollout is blocked: {result}")
    print(json.dumps(result, ensure_ascii=False, indent=2)); return 0


if __name__ == "__main__":
    try: raise SystemExit(main())
    except (ReadinessError, json.JSONDecodeError) as error:
        print(f"[PRODUCTION READINESS] BLOCKED: {error}", file=sys.stderr); raise SystemExit(1)
