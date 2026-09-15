#!/usr/bin/env python3
"""Operate the fail-closed live acceptance gate for external notifications."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


CHANNELS = ("email", "wecom", "feishu")
REQUIRED = tuple(f"{channel}.{scenario}" for channel in CHANNELS for scenario in ("sent", "failed", "retry", "disabled")) + (
    "system.configuration", "system.deduplication", "system.workspace_isolation",
)


class AcceptanceError(RuntimeError):
    pass


def required_env(name: str, *fallbacks: str) -> str:
    for key in (name, *fallbacks):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    raise AcceptanceError(f"missing required environment variable: {name}")


def http(method: str, url: str, headers=None, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request_headers = dict(headers or {})
    if data is not None:
        request_headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, data=data, headers=request_headers, method=method), timeout=60
        ) as response:
            raw = response.read()
            return response.status, json.loads(raw or b"null")
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            value = json.loads(raw or b"null")
        except json.JSONDecodeError:
            value = {"error": raw.decode("utf-8", "replace")[:300]}
        return error.code, value


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class Client:
    def __init__(self):
        self.url = required_env("SUPABASE_URL").rstrip("/")
        self.service_key = required_env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")
        self.headers = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}"}

    def rpc(self, name: str, body: dict):
        status, value = http("POST", f"{self.url}/rest/v1/rpc/{name}", self.headers, body)
        if status != 200:
            raise AcceptanceError(f"{name} failed: HTTP {status} {value}")
        return value

    def rows(self, table: str, query: str):
        status, value = http("GET", f"{self.url}/rest/v1/{table}?{query}", self.headers)
        if status != 200 or not isinstance(value, list):
            raise AcceptanceError(f"{table} lookup failed: HTTP {status} {value}")
        return value

    def insert(self, table: str, body, *, query: str = ""):
        headers = {**self.headers, "Prefer": "resolution=ignore-duplicates,return=representation"}
        suffix = f"?{query}" if query else ""
        status, value = http("POST", f"{self.url}/rest/v1/{table}{suffix}", headers, body)
        if status not in (200, 201):
            raise AcceptanceError(f"{table} insert failed: HTTP {status} {value}")
        return value

    def function(self, body: dict, *, access_token: str | None = None):
        token = access_token or self.service_key
        headers = {"apikey": self.service_key, "Authorization": f"Bearer {token}"}
        return http("POST", f"{self.url}/functions/v1/notification-dispatch", headers, body)


def run_row(client: Client, run_id: str) -> dict:
    rows = client.rows(
        "notification_live_acceptance_runs",
        f"select=id,workspace_id,status,started_at,expires_at,completed_at&id=eq.{urllib.parse.quote(run_id)}&limit=1",
    )
    if not rows:
        raise AcceptanceError("notification acceptance run not found")
    return rows[0]


def readiness(client: Client, run_id: str) -> dict:
    result = client.rpc("notification_live_acceptance_readiness", {"p_run_id": run_id})
    if not isinstance(result, dict):
        raise AcceptanceError("notification readiness result is missing")
    checks = result.get("checks") if isinstance(result.get("checks"), dict) else {}
    result["missing"] = [name for name in REQUIRED if checks.get(name) is not True]
    return result


def record_system(client: Client, workspace_id: str, scenario: str, passed: bool, details: dict):
    return client.rpc("record_notification_live_acceptance_evidence", {
        "p_workspace_id": workspace_id, "p_channel": "system", "p_scenario": scenario,
        "p_passed": passed, "p_delivery_id": None, "p_provider_message_id": None,
        "p_details": details, "p_observed_at": datetime.now(timezone.utc).isoformat(),
    })


def configuration_details() -> dict:
    encryption_key = required_env("NOTIFICATION_CONFIG_ENCRYPTION_KEY")
    resend_key = required_env("RESEND_API_KEY")
    from_email = required_env("NOTIFICATION_FROM_EMAIL")
    if len(encryption_key) < 24 or "@" not in from_email:
        raise AcceptanceError("notification encryption key or sender address is invalid")
    invite_email = required_env("WORKSPACE_INVITE_FROM_EMAIL")
    return {
        "encryption_key_sha256": fingerprint(encryption_key),
        "resend_key_sha256": fingerprint(resend_key),
        "from_email_sha256": fingerprint(from_email.lower()),
        "separate_sender_confirmed": from_email.lower() != invite_email.lower(),
    }


def validate_configuration(client: Client, run_id: str) -> dict:
    rows = client.rows(
        "notification_live_acceptance_evidence",
        "select=details,observed_at"
        f"&run_id=eq.{urllib.parse.quote(run_id)}&channel=eq.system&scenario=eq.configuration"
        "&passed=eq.true&order=observed_at.desc&limit=1",
    )
    accepted = rows[0].get("details") if rows and isinstance(rows[0].get("details"), dict) else {}
    current = configuration_details()
    keys = ("encryption_key_sha256", "resend_key_sha256", "from_email_sha256")
    if not all(accepted.get(key) == current.get(key) for key in keys):
        raise AcceptanceError("current provider/sender/encryption configuration differs from accepted evidence")
    return {"configuration_matches": True, "separate_sender_confirmed": current["separate_sender_confirmed"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    start = sub.add_parser("start")
    start.add_argument("--workspace-id", required=True); start.add_argument("--actor-id", required=True)
    start.add_argument("--approval-reference", required=True)
    status = sub.add_parser("status"); status.add_argument("--run-id", required=True)
    probe = sub.add_parser("probe")
    probe.add_argument("--run-id", required=True); probe.add_argument("--user-id", required=True)
    probe.add_argument("--channel", choices=CHANNELS, required=True)
    probe.add_argument("--scenario", choices=("sent", "failure_retry", "disabled"), required=True)
    configuration = sub.add_parser("configuration"); configuration.add_argument("--run-id", required=True)
    dedup = sub.add_parser("deduplication")
    dedup.add_argument("--run-id", required=True); dedup.add_argument("--user-id", required=True)
    isolation = sub.add_parser("isolation")
    isolation.add_argument("--run-id", required=True); isolation.add_argument("--access-token", required=True)
    isolation.add_argument("--foreign-workspace-id", required=True)
    finalize = sub.add_parser("finalize")
    finalize.add_argument("--run-id", required=True); finalize.add_argument("--actor-id", required=True)
    finalize.add_argument("--approval-reference", required=True)
    validate = sub.add_parser("validate"); validate.add_argument("--run-id", required=True)
    args = parser.parse_args()
    client = Client()

    if args.command == "start":
        result = client.rpc("start_notification_live_acceptance_run", {
            "p_workspace_id": args.workspace_id, "p_started_by": args.actor_id,
            "p_approval_reference": args.approval_reference,
        })
    elif args.command == "status":
        result = readiness(client, args.run_id)
    elif args.command == "probe":
        run = run_row(client, args.run_id)
        status_code, result = client.function({
            "action": "acceptance_probe", "workspace_id": run["workspace_id"], "run_id": args.run_id,
            "user_id": args.user_id, "channel": args.channel, "scenario": args.scenario,
        })
        if status_code != 200 or result.get("status") != "passed":
            raise AcceptanceError(f"live provider probe failed: HTTP {status_code} {result}")
    elif args.command == "configuration":
        run = run_row(client, args.run_id)
        details = configuration_details()
        passed = details["separate_sender_confirmed"]
        record_system(client, run["workspace_id"], "configuration", passed, details)
        if not passed:
            raise AcceptanceError("NOTIFICATION_FROM_EMAIL must be independent from WORKSPACE_INVITE_FROM_EMAIL")
        result = {"status": "passed", "scenario": "configuration", "details": details}
    elif args.command == "deduplication":
        run = run_row(client, args.run_id)
        source_id = f"notification-acceptance-dedup:{args.run_id}"
        event = {
            "user_id": args.user_id, "workspace_id": run["workspace_id"], "event_type": "test",
            "severity": "info", "title": "Notification dedup acceptance", "body": "Acceptance metadata only.",
            "source_record_id": source_id, "payload": {"acceptance_run_id": args.run_id},
        }
        client.insert("notification_events", [event, event], query="on_conflict=user_id,workspace_id,event_type,source_record_id")
        rows = client.rows(
            "notification_events", "select=id&workspace_id=eq." + urllib.parse.quote(run["workspace_id"])
            + "&user_id=eq." + urllib.parse.quote(args.user_id) + "&source_record_id=eq." + urllib.parse.quote(source_id),
        )
        passed = len(rows) == 1
        record_system(client, run["workspace_id"], "deduplication", passed, {"matching_event_count": len(rows)})
        if not passed:
            raise AcceptanceError(f"deduplication created {len(rows)} matching events")
        result = {"status": "passed", "scenario": "deduplication", "matching_event_count": 1}
    elif args.command == "isolation":
        run = run_row(client, args.run_id)
        status_code, response = client.function({"action": "status", "workspace_id": args.foreign_workspace_id}, access_token=args.access_token)
        passed = status_code == 403 and response.get("error") == "WORKSPACE_FORBIDDEN"
        record_system(client, run["workspace_id"], "workspace_isolation", passed, {
            "foreign_workspace_status": status_code, "access_denied": passed,
        })
        if not passed:
            raise AcceptanceError(f"foreign workspace notification config was not denied: HTTP {status_code}")
        result = {"status": "passed", "scenario": "workspace_isolation", "foreign_workspace_status": status_code}
    elif args.command == "finalize":
        before = readiness(client, args.run_id)
        if before["missing"]:
            raise AcceptanceError("notification evidence is incomplete: " + ", ".join(before["missing"]))
        validate_configuration(client, args.run_id)
        result = client.rpc("finalize_notification_live_acceptance_run", {
            "p_run_id": args.run_id, "p_completed_by": args.actor_id,
            "p_approval_reference": args.approval_reference,
        })
    else:
        result = readiness(client, args.run_id)
        if result.get("status") != "passed" or result.get("ready") is not True or result["missing"]:
            raise AcceptanceError(f"NOTIFICATION_CHANNELS_ENABLED is blocked by live acceptance: {result}")
        result["configuration"] = validate_configuration(client, args.run_id)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AcceptanceError as error:
        print(f"[NOTIFICATION LIVE ACCEPTANCE] BLOCKED: {error}", file=sys.stderr)
        raise SystemExit(1)
