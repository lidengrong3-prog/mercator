#!/usr/bin/env python3
"""Manage the fail-closed Stripe live billing acceptance gate."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


REQUIRED_SCENARIOS = (
    "purchase", "renewal", "payment_failed", "payment_recovered",
    "cancel_period_end", "cancel_immediate", "refund_partial", "refund_full",
    "webhook_replay", "state_consistency",
)


class AcceptanceError(RuntimeError):
    pass


def env(name: str, *fallbacks: str) -> str:
    for key in (name, *fallbacks):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    raise AcceptanceError(f"missing required environment variable: {name}")


def request(method: str, url: str, *, headers=None, body=None):
    payload = None
    final_headers = dict(headers or {})
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        final_headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, data=payload, headers=final_headers, method=method), timeout=30
        ) as response:
            raw = response.read()
            return response.status, json.loads(raw or b"null")
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            value = json.loads(raw or b"null")
        except json.JSONDecodeError:
            value = {"error": raw.decode("utf-8", "replace")[:500]}
        return error.code, value


class Client:
    def __init__(self):
        self.supabase = env("SUPABASE_URL").rstrip("/")
        self.service_key = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")
        self.stripe_key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }

    def rpc(self, function: str, body: dict):
        status, value = request(
            "POST", f"{self.supabase}/rest/v1/rpc/{function}", headers=self.headers, body=body
        )
        if status != 200:
            raise AcceptanceError(f"{function} failed: HTTP {status} {value}")
        return value

    def rows(self, table: str, query: str):
        status, value = request(
            "GET", f"{self.supabase}/rest/v1/{table}?{query}", headers=self.headers
        )
        if status != 200 or not isinstance(value, list):
            raise AcceptanceError(f"{table} lookup failed: HTTP {status} {value}")
        return value

    def stripe_get(self, path: str):
        if not self.stripe_key.startswith("sk_live_"):
            raise AcceptanceError("STRIPE_SECRET_KEY must be a live key")
        status, value = request(
            "GET", f"https://api.stripe.com/v1/{path.lstrip('/')}",
            headers={"Authorization": f"Bearer {self.stripe_key}"},
        )
        if status != 200:
            raise AcceptanceError(f"Stripe lookup failed: HTTP {status} {value}")
        return value


def normalize_status(value: str) -> str:
    if value in {"trialing", "active"}:
        return value
    if value in {"past_due", "unpaid", "incomplete", "paused"}:
        return "past_due"
    if value == "canceled":
        return "cancelled"
    return "expired"


def iso_seconds(value) -> str | None:
    try:
        seconds = int(value or 0)
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat().replace("+00:00", "Z") if seconds > 0 else None


def same_time(left, right) -> bool:
    if not left and not right:
        return True
    try:
        a = datetime.fromisoformat(str(left).replace("Z", "+00:00"))
        b = datetime.fromisoformat(str(right).replace("Z", "+00:00"))
        return abs((a - b).total_seconds()) <= 2
    except (TypeError, ValueError):
        return False


def future_time(value) -> bool:
    if not value:
        return True
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed > datetime.now(timezone.utc)
    except (TypeError, ValueError):
        return False


def run_row(client: Client, run_id: str) -> dict:
    rows = client.rows(
        "stripe_live_acceptance_runs",
        "select=id,workspace_id,status,started_at,expires_at,completed_at"
        f"&id=eq.{urllib.parse.quote(run_id)}&limit=1",
    )
    if not rows:
        raise AcceptanceError("acceptance run not found")
    return rows[0]


def reconcile(client: Client, run_id: str, *, confirm_page_portal: bool) -> dict:
    run = run_row(client, run_id)
    workspace_id = run["workspace_id"]
    rows = client.rows(
        "workspace_subscriptions",
        "select=workspace_id,plan,status,provider,provider_customer_id,provider_subscription_id,"
        "provider_price_id,current_period_end,cancel_at_period_end,entitlement_revoke_reason,updated_at"
        f"&workspace_id=eq.{urllib.parse.quote(workspace_id)}&limit=1",
    )
    if not rows or rows[0].get("provider") != "stripe":
        raise AcceptanceError("acceptance workspace has no Stripe subscription")
    database = rows[0]
    workspace_rows = client.rows(
        "workspaces",
        f"select=owner_id&id=eq.{urllib.parse.quote(workspace_id)}&limit=1",
    )
    if not workspace_rows or not workspace_rows[0].get("owner_id"):
        raise AcceptanceError("acceptance workspace owner is missing")
    effective_plan = client.rpc("effective_billing_plan", {
        "p_workspace_id": workspace_id,
        "p_user_id": workspace_rows[0]["owner_id"],
    })
    entitled = (
        database.get("status") in {"active", "trialing"}
        and not database.get("entitlement_revoke_reason")
        and future_time(database.get("current_period_end"))
    )
    expected_effective_plan = database.get("plan") if entitled else "free"
    subscription_id = str(database.get("provider_subscription_id") or "")
    customer_id = str(database.get("provider_customer_id") or "")
    stripe = client.stripe_get(f"subscriptions/{urllib.parse.quote(subscription_id)}")
    customer = client.stripe_get(f"customers/{urllib.parse.quote(customer_id)}")
    items = ((stripe.get("items") or {}).get("data") or [])
    first_item = items[0] if items else {}
    price = first_item.get("price") or {}
    provider_price_id = price if isinstance(price, str) else price.get("id")
    configured_price_id = env("STRIPE_PRICE_PRO_MONTHLY")
    checks = {
        "live_mode": stripe.get("livemode") is True and customer.get("livemode") is True,
        "subscription_id": stripe.get("id") == subscription_id,
        "customer_id": (stripe.get("customer") if isinstance(stripe.get("customer"), str) else (stripe.get("customer") or {}).get("id")) == customer_id,
        "price_id": provider_price_id == database.get("provider_price_id"),
        "configured_price_id": provider_price_id == configured_price_id,
        "status": normalize_status(str(stripe.get("status") or "")) == database.get("status"),
        "cancel_at_period_end": bool(stripe.get("cancel_at_period_end")) == bool(database.get("cancel_at_period_end")),
        "current_period_end": same_time(
            iso_seconds(stripe.get("current_period_end") or first_item.get("current_period_end")),
            database.get("current_period_end"),
        ),
        "effective_plan": effective_plan == expected_effective_plan,
        "page_confirmed": confirm_page_portal,
        "portal_confirmed": confirm_page_portal,
    }
    passed = all(checks.values())
    details = {
        "checks": checks,
        "subscription_status": database.get("status"),
        "effective_plan": effective_plan,
        "provider_price_id": provider_price_id,
        "effective_access_revoked": database.get("entitlement_revoke_reason") == "full_refund",
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }
    if confirm_page_portal:
        client.rpc("record_stripe_live_billing_evidence", {
            "p_workspace_id": workspace_id,
            "p_scenario": "state_consistency",
            "p_provider_event_id": None,
            "p_event_type": "operator.live_state_reconciliation",
            "p_provider_object_id": subscription_id,
            "p_observed_at": datetime.now(timezone.utc).isoformat(),
            "p_passed": passed,
            "p_details": details,
        })
    return {"passed": passed, "workspace_id": workspace_id, "checks": checks}


def readiness(client: Client, run_id: str) -> dict:
    result = client.rpc("stripe_live_billing_readiness", {"p_run_id": run_id})
    if not isinstance(result, dict):
        raise AcceptanceError("readiness result is missing")
    result["missing"] = [name for name in REQUIRED_SCENARIOS if not (result.get("scenarios") or {}).get(name)]
    return result


def validated_configuration(client: Client, run_id: str) -> dict:
    configured_price_id = env("STRIPE_PRICE_PRO_MONTHLY")
    rows = client.rows(
        "stripe_live_acceptance_evidence",
        "select=details,observed_at"
        f"&run_id=eq.{urllib.parse.quote(run_id)}&scenario=eq.state_consistency"
        "&passed=eq.true&order=observed_at.desc&limit=1",
    )
    details = rows[0].get("details") if rows else None
    accepted_price_id = details.get("provider_price_id") if isinstance(details, dict) else None
    if not accepted_price_id or accepted_price_id != configured_price_id:
        raise AcceptanceError(
            "configured Stripe price does not match the live state-consistency evidence"
        )
    return {"provider_price_id": accepted_price_id, "configuration_matches": True}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    start = sub.add_parser("start")
    start.add_argument("--workspace-id", required=True)
    start.add_argument("--actor-id", required=True)
    start.add_argument("--approval-reference", required=True)
    status = sub.add_parser("status")
    status.add_argument("--run-id", required=True)
    reconcile_parser = sub.add_parser("reconcile")
    reconcile_parser.add_argument("--run-id", required=True)
    reconcile_parser.add_argument("--confirm-page-portal", action="store_true")
    finalize = sub.add_parser("finalize")
    finalize.add_argument("--run-id", required=True)
    finalize.add_argument("--actor-id", required=True)
    finalize.add_argument("--approval-reference", required=True)
    finalize.add_argument("--confirm-page-portal", action="store_true", required=True)
    validate = sub.add_parser("validate")
    validate.add_argument("--run-id", required=True)
    args = parser.parse_args()
    client = Client()

    if args.command == "start":
        result = client.rpc("start_stripe_live_acceptance_run", {
            "p_workspace_id": args.workspace_id,
            "p_started_by": args.actor_id,
            "p_approval_reference": args.approval_reference,
        })
    elif args.command == "status":
        result = readiness(client, args.run_id)
    elif args.command == "reconcile":
        result = reconcile(client, args.run_id, confirm_page_portal=args.confirm_page_portal)
    elif args.command == "finalize":
        consistency = reconcile(client, args.run_id, confirm_page_portal=True)
        if not consistency["passed"]:
            raise AcceptanceError(f"Stripe/Supabase/page/portal consistency failed: {consistency['checks']}")
        before = readiness(client, args.run_id)
        if before["missing"]:
            raise AcceptanceError(f"live acceptance evidence is incomplete: {', '.join(before['missing'])}")
        result = client.rpc("finalize_stripe_live_acceptance_run", {
            "p_run_id": args.run_id,
            "p_completed_by": args.actor_id,
            "p_approval_reference": args.approval_reference,
        })
    else:
        result = readiness(client, args.run_id)
        if result.get("status") != "passed" or result.get("ready") is not True or result["missing"]:
            raise AcceptanceError(f"BILLING_ENABLED is blocked by live acceptance: {result}")
        result["configuration"] = validated_configuration(client, args.run_id)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AcceptanceError as error:
        print(f"[STRIPE LIVE ACCEPTANCE] BLOCKED: {error}", file=sys.stderr)
        raise SystemExit(1)
