"""Verify that the deployed frontend and Supabase release are coherent."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


class ReleaseCheckError(RuntimeError):
    pass


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ReleaseCheckError(f"missing required environment variable: {name}")
    return value


def request(method: str, url: str, *, headers: dict[str, str] | None = None, body=None):
    payload = None if body is None else json.dumps(body).encode("utf-8")
    final_headers = dict(headers or {})
    if payload is not None:
        final_headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, data=payload, headers=final_headers, method=method),
            timeout=30,
        ) as response:
            raw = response.read()
            return response.status, raw, response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.read(), error.headers


def parse_json(raw: bytes, description: str):
    try:
        return json.loads(raw)
    except Exception as error:
        raise ReleaseCheckError(f"{description} did not return JSON: {error}") from error


def production_origin(site_url: str) -> str:
    parsed = urlparse(site_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ReleaseCheckError("PRODUCTION_SITE_URL must be an https URL")
    return f"https://{parsed.netloc}"


def validate_webhook_probe(status: int, raw: bytes, billing_enabled: bool) -> str:
    payload = parse_json(raw, "billing webhook signature probe")
    error = payload.get("error") if isinstance(payload, dict) else None
    if status == 400 and error == "INVALID_STRIPE_SIGNATURE":
        return "signature_verified"
    if not billing_enabled and status == 503 and error == "BILLING_WEBHOOK_NOT_CONFIGURED":
        return "disabled_fail_closed"
    expected = "400 INVALID_STRIPE_SIGNATURE" if billing_enabled else (
        "400 INVALID_STRIPE_SIGNATURE or 503 BILLING_WEBHOOK_NOT_CONFIGURED"
    )
    raise ReleaseCheckError(
        f"billing webhook probe expected {expected}, got HTTP {status} {error or 'UNKNOWN_ERROR'}"
    )


def main() -> int:
    site = required("PRODUCTION_SITE_URL").rstrip("/") + "/"
    supabase = required("SUPABASE_URL").rstrip("/")
    anon_key = required("SUPABASE_ANON_KEY")
    expected_sha = required("EXPECTED_RELEASE_SHA")
    expected_migration = required("EXPECTED_MIGRATION_HEAD")
    acceptance_file = Path(required("ACCEPTANCE_RESULT_FILE"))
    test_email = required("PROD_TEST_USER_A_EMAIL")
    test_password = required("PROD_TEST_USER_A_PASSWORD")

    expected_origin = production_origin(site)
    acceptance = parse_json(acceptance_file.read_bytes(), "authenticated acceptance result")
    if acceptance.get("status") != "passed":
        raise ReleaseCheckError("authenticated acceptance did not pass")
    if acceptance.get("release_sha") != expected_sha:
        raise ReleaseCheckError("backend acceptance result does not match the triggering commit")
    checks = acceptance.get("checks") or {}
    for key in ("database", "storage_bucket", "storage_policy", "edge_functions"):
        if not checks.get(key):
            raise ReleaseCheckError(f"authenticated acceptance did not verify {key}")

    status, raw, _ = request("GET", site + "release.json")
    if status != 200:
        raise ReleaseCheckError(f"release manifest unavailable: HTTP {status}")
    manifest = parse_json(raw, "release manifest")
    if manifest.get("release_sha") != expected_sha:
        raise ReleaseCheckError(
            f"frontend release {manifest.get('release_sha')} does not match {expected_sha}"
        )
    if manifest.get("migration_head") != expected_migration:
        raise ReleaseCheckError("frontend migration head does not match the checked-out source")
    if manifest.get("production_origin") != expected_origin:
        raise ReleaseCheckError("frontend production origin does not match the configured site")

    status, raw, _ = request("GET", site)
    if status != 200 or "JAY" not in raw.decode("utf-8", "replace"):
        raise ReleaseCheckError(f"production frontend is unavailable: HTTP {status}")

    status, raw, _ = request("GET", site + "assets/js/catalog.js")
    catalog = raw.decode("utf-8", "replace")
    match = re.search(r"JAY_SUPABASE_URL\s*=\s*['\"]([^'\"]+)['\"]", catalog)
    if status != 200 or not match or match.group(1).rstrip("/") != supabase:
        actual = match.group(1) if match else "missing"
        raise ReleaseCheckError(f"frontend Supabase URL {actual} does not match {supabase}")

    status, raw, _ = request(
        "POST",
        f"{supabase}/auth/v1/token?grant_type=password",
        headers={"apikey": anon_key},
        body={"email": test_email, "password": test_password},
    )
    session = parse_json(raw, "production smoke login")
    access_token = session.get("access_token") if isinstance(session, dict) else None
    if status != 200 or not access_token:
        raise ReleaseCheckError(f"production smoke login failed: HTTP {status}")

    headers = {"apikey": anon_key, "Authorization": f"Bearer {access_token}"}
    database_probes = (
        ("market_catalog", "code"),
        ("market_data_applicability", "id"),
    )
    for table, primary_key in database_probes:
        status, _, _ = request(
            "GET",
            f"{supabase}/rest/v1/{table}?select={primary_key}&limit=1",
            headers=headers,
        )
        if status != 200:
            raise ReleaseCheckError(f"database table {table} is not readable: HTTP {status}")

    # A missing function route returns 404. The deployed functions may return
    # 405 (method guard) or 401/403 before a real authenticated call.
    for function_name in (
        "ai-proxy", "report-export", "report-docx", "billing-checkout",
        "billing-status", "billing-portal", "billing-webhook", "admin-summary",
    ):
        status, _, response_headers = request("GET", f"{supabase}/functions/v1/{function_name}", headers=headers)
        if status == 404 or status >= 500:
            raise ReleaseCheckError(f"Edge Function {function_name} is unavailable: HTTP {status}")
        function_release = response_headers.get("X-JAY-Release", "")
        if function_release != expected_sha:
            raise ReleaseCheckError(
                f"Edge Function {function_name} release {function_release or 'missing'} does not match {expected_sha}"
            )

    status, _, _ = request(
        "POST", f"{supabase}/functions/v1/ai-proxy",
        headers={"apikey": anon_key},
        body={"messages": [{"role": "user", "content": "auth probe"}]},
    )
    if status != 401:
        raise ReleaseCheckError(f"AI function unauthenticated probe expected 401, got {status}")

    status, _, _ = request(
        "POST", f"{supabase}/functions/v1/ai-proxy",
        headers={**headers, "Origin": "https://not-allowed.invalid"},
        body={"messages": [{"role": "user", "content": "origin probe"}]},
    )
    if status != 403:
        raise ReleaseCheckError(f"AI function forbidden-origin probe expected 403, got {status}")

    status, raw, _ = request(
        "POST", f"{supabase}/functions/v1/billing-status",
        headers={**headers, "Origin": expected_origin}, body={},
    )
    billing_status = parse_json(raw, "billing status probe")
    if status != 200 or "billing_enabled" not in billing_status or not billing_status.get("entitlement"):
        raise ReleaseCheckError(f"billing status probe failed: HTTP {status}")
    billing_enabled = billing_status.get("billing_enabled") is True

    status, raw, _ = request(
        "POST", f"{supabase}/functions/v1/billing-webhook",
        headers={"apikey": anon_key, "Stripe-Signature": "t=0,v1=invalid"}, body={},
    )
    webhook_guard = validate_webhook_probe(status, raw, billing_enabled)

    print(json.dumps({
        "status": "passed",
        "release_sha": expected_sha,
        "migration_head": expected_migration,
        "production_origin": expected_origin,
        "database": True,
        "storage": True,
        "edge_functions": True,
        "auth_error_contracts": True,
        "billing_status": "enabled" if billing_enabled else "disabled",
        "webhook_signature_guard": webhook_guard,
        "frontend": True,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ReleaseCheckError, OSError, json.JSONDecodeError) as error:
        print(f"[PRODUCTION RELEASE CHECK] FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
