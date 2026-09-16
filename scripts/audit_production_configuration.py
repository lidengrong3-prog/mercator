#!/usr/bin/env python3
"""Audit production origin, acceptance accounts, and disabled launch gates.

The generated artifact contains only booleans, status codes, and short hashes.
Passwords, access tokens, email addresses, and user IDs are never emitted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


class AuditError(RuntimeError):
    pass


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise AuditError(f"CONFIG_MISSING:{name}")
    return value


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


def safe_runtime_error(payload: dict) -> str:
    """Return only a bounded machine error code from an Edge response."""
    value = str(payload.get("error") or "UNKNOWN_ERROR")
    return value if re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", value) else "UNKNOWN_ERROR"


def production_origin(site_url: str) -> str:
    parsed = urllib.parse.urlsplit(site_url)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise AuditError("PRODUCTION_SITE_URL_INVALID")
    return f"https://{parsed.netloc}"


def request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: dict | None = None,
) -> tuple[int, bytes, object]:
    payload = None if body is None else json.dumps(body).encode("utf-8")
    final_headers = dict(headers or {})
    if payload is not None:
        final_headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, data=payload, headers=final_headers, method=method),
            timeout=30,
        ) as response:
            return response.status, response.read(), response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.read(), error.headers
    except urllib.error.URLError as error:
        raise AuditError("NETWORK_REQUEST_FAILED") from error


def json_body(raw: bytes, code: str) -> dict:
    try:
        value = json.loads(raw or b"{}")
    except json.JSONDecodeError as error:
        raise AuditError(code) from error
    if not isinstance(value, dict):
        raise AuditError(code)
    return value


def auth_headers(anon_key: str, access_token: str) -> dict[str, str]:
    return {"apikey": anon_key, "Authorization": f"Bearer {access_token}"}


def sign_in(supabase_url: str, anon_key: str, email: str, password: str) -> dict:
    status, raw, _ = request(
        "POST",
        f"{supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon_key},
        body={"email": email, "password": password},
    )
    if status != 200:
        raise AuditError(f"ACCEPTANCE_ACCOUNT_LOGIN_FAILED:HTTP_{status}")
    session = json_body(raw, "ACCEPTANCE_ACCOUNT_RESPONSE_INVALID")
    user = session.get("user") if isinstance(session.get("user"), dict) else {}
    if not session.get("access_token") or not user.get("id"):
        raise AuditError("ACCEPTANCE_ACCOUNT_SESSION_MISSING")
    if str(user.get("email") or "").lower() != email.lower():
        raise AuditError("ACCEPTANCE_ACCOUNT_EMAIL_MISMATCH")
    return session


def profile_exists(supabase_url: str, anon_key: str, session: dict) -> bool:
    user_id = str(session["user"]["id"])
    query = urllib.parse.urlencode({"id": f"eq.{user_id}", "select": "id", "limit": "1"})
    status, raw, _ = request(
        "GET",
        f"{supabase_url}/rest/v1/profiles?{query}",
        headers=auth_headers(anon_key, str(session["access_token"])),
    )
    if status != 200:
        raise AuditError(f"ACCEPTANCE_PROFILE_LOOKUP_FAILED:HTTP_{status}")
    try:
        rows = json.loads(raw or b"[]")
    except json.JSONDecodeError as error:
        raise AuditError("ACCEPTANCE_PROFILE_RESPONSE_INVALID") from error
    return isinstance(rows, list) and len(rows) == 1


def function_json(
    supabase_url: str,
    function_name: str,
    anon_key: str,
    access_token: str,
    origin: str,
    body: dict,
) -> tuple[int, dict]:
    status, raw, _ = request(
        "POST",
        f"{supabase_url}/functions/v1/{function_name}",
        headers={**auth_headers(anon_key, access_token), "Origin": origin},
        body=body,
    )
    return status, json_body(raw, f"{function_name.upper()}_RESPONSE_INVALID")


def audit(output: Path) -> int:
    result: dict = {
        "kind": "production_configuration_audit",
        "status": "failed",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "checks": {},
    }
    try:
        site_url = env("PRODUCTION_SITE_URL").rstrip("/") + "/"
        supabase_url = env("SUPABASE_URL").rstrip("/")
        anon_key = env("SUPABASE_ANON_KEY")
        allowed_origins = [part.strip() for part in env("ALLOWED_ORIGINS").split(",") if part.strip()]
        origin = production_origin(site_url)
        if allowed_origins != [origin]:
            raise AuditError("ALLOWED_ORIGINS_NOT_STRICT")
        for name in (
            "BILLING_ENABLED",
            "BILLING_LIVE_ACCEPTANCE_MODE",
            "NOTIFICATION_CHANNELS_ENABLED",
            "NOTIFICATION_LIVE_ACCEPTANCE_MODE",
        ):
            if env(name).lower() != "false":
                raise AuditError(f"LAUNCH_GATE_NOT_DISABLED:{name}")
        result["checks"]["launch_gates_declared_false"] = True
        result["checks"]["strict_production_origin"] = True
        result["production_origin"] = origin

        status, raw, _ = request("GET", site_url)
        if status != 200 or b"JAY" not in raw:
            raise AuditError(f"PRODUCTION_SITE_UNAVAILABLE:HTTP_{status}")
        result["checks"]["production_site"] = True

        status, raw, _ = request("GET", urllib.parse.urljoin(site_url, "release.json"))
        if status != 200:
            raise AuditError(f"RELEASE_MANIFEST_UNAVAILABLE:HTTP_{status}")
        release = json_body(raw, "RELEASE_MANIFEST_INVALID")
        if release.get("production_origin") != origin:
            raise AuditError("RELEASE_MANIFEST_ORIGIN_MISMATCH")
        result["checks"]["release_manifest_origin"] = True
        result["release"] = {
            "sha": str(release.get("release_sha") or "")[:12] or None,
            "migration_head": release.get("migration_head"),
        }

        email_a = env("PROD_TEST_USER_A_EMAIL")
        email_b = env("PROD_TEST_USER_B_EMAIL")
        if email_a.lower() == email_b.lower():
            raise AuditError("ACCEPTANCE_ACCOUNTS_NOT_DISTINCT")
        session_a = sign_in(supabase_url, anon_key, email_a, env("PROD_TEST_USER_A_PASSWORD"))
        session_b = sign_in(supabase_url, anon_key, email_b, env("PROD_TEST_USER_B_PASSWORD"))
        user_a = str(session_a["user"]["id"])
        user_b = str(session_b["user"]["id"])
        if user_a == user_b:
            raise AuditError("ACCEPTANCE_USER_IDS_NOT_DISTINCT")
        if not profile_exists(supabase_url, anon_key, session_a) or not profile_exists(supabase_url, anon_key, session_b):
            raise AuditError("ACCEPTANCE_PROFILE_MISSING")
        result["checks"]["acceptance_accounts_login"] = True
        result["checks"]["acceptance_accounts_distinct"] = True
        result["checks"]["acceptance_profiles_exist"] = True
        result["acceptance_accounts"] = [
            {
                "label": "A",
                "email_fingerprint": fingerprint(email_a.lower()),
                "user_fingerprint": fingerprint(user_a),
                "email_confirmed": bool(session_a["user"].get("email_confirmed_at")),
            },
            {
                "label": "B",
                "email_fingerprint": fingerprint(email_b.lower()),
                "user_fingerprint": fingerprint(user_b),
                "email_confirmed": bool(session_b["user"].get("email_confirmed_at")),
            },
        ]
        if not all(account["email_confirmed"] for account in result["acceptance_accounts"]):
            raise AuditError("ACCEPTANCE_EMAIL_NOT_CONFIRMED")

        function_url = f"{supabase_url}/functions/v1/history-search"
        preflight_headers = {**auth_headers(anon_key, str(session_a["access_token"])), "Origin": origin}
        status, _, headers = request("OPTIONS", function_url, headers=preflight_headers)
        if status != 204 or headers.get("Access-Control-Allow-Origin") != origin:
            raise AuditError(f"PRODUCTION_ORIGIN_PREFLIGHT_FAILED:HTTP_{status}")
        rejected_origin = "https://origin-audit.invalid"
        status, raw, _ = request(
            "OPTIONS",
            function_url,
            headers={**auth_headers(anon_key, str(session_a["access_token"])), "Origin": rejected_origin},
        )
        rejected = json_body(raw, "REJECTED_ORIGIN_RESPONSE_INVALID")
        if status != 403 or rejected.get("error") != "ORIGIN_NOT_ALLOWED":
            raise AuditError(f"UNTRUSTED_ORIGIN_NOT_REJECTED:HTTP_{status}")
        result["checks"]["allowed_origin_preflight"] = True
        result["checks"]["untrusted_origin_rejected"] = True

        status, billing = function_json(
            supabase_url,
            "billing-status",
            anon_key,
            str(session_a["access_token"]),
            origin,
            {},
        )
        if status != 200:
            result["runtime_error_code"] = safe_runtime_error(billing)
            raise AuditError(f"BILLING_STATUS_CHECK_FAILED:HTTP_{status}")
        if billing.get("billing_enabled") is not False or billing.get("live_acceptance_mode") is not False:
            raise AuditError("BILLING_GATE_NOT_DISABLED")
        result["checks"]["billing_disabled_runtime"] = True

        status, notification = function_json(
            supabase_url,
            "notification-dispatch",
            anon_key,
            str(session_a["access_token"]),
            origin,
            {"action": "status"},
        )
        if status != 200:
            result["runtime_error_code"] = safe_runtime_error(notification)
            raise AuditError(f"NOTIFICATION_STATUS_CHECK_FAILED:HTTP_{status}")
        if notification.get("enabled") is not False or notification.get("acceptance_mode") is not False:
            raise AuditError("NOTIFICATION_GATE_NOT_DISABLED")
        result["checks"]["notifications_disabled_runtime"] = True
        result["status"] = "passed"
    except AuditError as error:
        result["error_code"] = str(error).split(":", 1)[0]
        if ":HTTP_" in str(error):
            result["http_status"] = int(str(error).rsplit("_", 1)[-1])
    output.write_text(json.dumps(result, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=True))
    return 0 if result["status"] == "passed" else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="production-configuration-audit.json")
    args = parser.parse_args()
    return audit(Path(args.output))


if __name__ == "__main__":
    raise SystemExit(main())
