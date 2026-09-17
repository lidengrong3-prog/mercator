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

try:
    from market_scope import configured_catalog, load_market_scope
except ModuleNotFoundError:  # Imported as scripts.production_release_check in tests/tools.
    from scripts.market_scope import configured_catalog, load_market_scope


class ReleaseCheckError(RuntimeError):
    pass


PUBLIC_PAGE_DATA_PATHS = (
    "data/access_requirements.json",
    "data/alerts.json",
    "data/countries.json",
    "data/market_scope.json",
    "data/platforms.json",
    "data/policies.json",
    "data/quality_report.json",
    "data/rules.json",
    "data/taxes.json",
    "data/industry_advisories.json",
    "data/us_market/macro_indicators.json",
)

PRIVATE_PAGE_DATA_PATHS = (
    "data/_cfd_part1.json",
    "data/_ext_part1.json",
    "data/alerts_detailed.json",
    "data/macro_raw.json",
    "data/policies_baseline.json",
    "data/quarantine_future_records.json",
    "data/rules_baseline.json",
    "data/_sync_logs/sync_20260819_092403.json",
    "data/us_market/cpsc_recalls.json",
    "data/us_market/index.json",
) + tuple(
    f"data/us_market/{code}.json"
    for code in configured_catalog(load_market_scope(), market_codes=["US"])["category_keys"]
)


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


def required_bool(name: str) -> bool:
    value = required(name).lower()
    if value not in {"true", "false"}:
        raise ReleaseCheckError(f"{name} must be true or false")
    return value == "true"


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


def validate_report_content_gate(acceptance: dict) -> str:
    gate = acceptance.get("report_content_gate") or {}
    mode = gate.get("mode")
    exception_checks = acceptance.get("production_exceptions") or {}
    if mode == "formal":
        if gate.get("formal_save") is not True or gate.get("formal_exports") is not True:
            raise ReleaseCheckError("formal report acceptance omitted successful save/export evidence")
        duplicate_exports = exception_checks.get("duplicate_exports") or {}
        for export_format in ("pdf", "docx"):
            evidence = duplicate_exports.get(export_format) or {}
            if evidence.get("row_count") != 1 or evidence.get("duplicate_response") is not True or not evidence.get("id"):
                raise ReleaseCheckError(f"duplicate {export_format} export did not collapse to one job")
        return "formal"
    if mode == "blocked":
        if gate.get("formal_save") is not False or gate.get("formal_exports") is not False:
            raise ReleaseCheckError("blocked report acceptance did not keep formal output disabled")
        rejection = gate.get("save_rejection") or {}
        if rejection.get("status") != 409 or rejection.get("error") != "REPORT_SERVER_VALIDATION_FAILED":
            raise ReleaseCheckError("incomplete report was not rejected by the server validation gate")
        reason_codes = set(rejection.get("reason_codes") or gate.get("reason_codes") or [])
        if not reason_codes.intersection({"QUALITY_REQUIRED_DATA_MISSING", "QUALITY_PLATFORM_RULE_COVERAGE_MISSING"}):
            raise ReleaseCheckError("blocked report acceptance omitted the missing-content reason")
        blocked_exports = exception_checks.get("blocked_exports") or gate.get("blocked_exports") or {}
        for export_format in ("pdf", "docx"):
            evidence = blocked_exports.get(export_format) or {}
            if evidence.get("status") != 409 or evidence.get("error") != "REPORT_NOT_SAVED":
                raise ReleaseCheckError(f"incomplete {export_format} export was not blocked")
        return "blocked"
    raise ReleaseCheckError("authenticated acceptance omitted the report content gate mode")


def validate_browser_report_content_gate(browser_acceptance: dict) -> str:
    gate = browser_acceptance.get("report_content_gate") or {}
    exports = browser_acceptance.get("exports") or {}
    mode = gate.get("mode")
    if mode == "formal":
        if gate.get("formal_save") is not True or gate.get("formal_exports") is not True:
            raise ReleaseCheckError("browser formal report acceptance omitted save/export evidence")
        if not exports.get("pdf") or not exports.get("docx"):
            raise ReleaseCheckError("browser formal report acceptance omitted PDF/DOCX jobs")
        return "formal"
    if mode == "blocked":
        if gate.get("formal_save") is not False or gate.get("formal_exports") is not False:
            raise ReleaseCheckError("browser blocked report acceptance enabled formal output")
        if gate.get("browser_formal_requests") != 0 or exports:
            raise ReleaseCheckError("browser sent a formal export request for an incomplete report")
        reason_codes = set(gate.get("reason_codes") or [])
        if not reason_codes.intersection({"QUALITY_REQUIRED_DATA_MISSING", "QUALITY_PLATFORM_RULE_COVERAGE_MISSING"}):
            raise ReleaseCheckError("browser blocked report acceptance omitted the missing-content reason")
        return "blocked"
    raise ReleaseCheckError("browser acceptance omitted the report content gate mode")


def main() -> int:
    site = required("PRODUCTION_SITE_URL").rstrip("/") + "/"
    supabase = required("SUPABASE_URL").rstrip("/")
    anon_key = required("SUPABASE_ANON_KEY")
    expected_sha = required("EXPECTED_RELEASE_SHA")
    expected_migration = required("EXPECTED_MIGRATION_HEAD")
    acceptance_file = Path(required("ACCEPTANCE_RESULT_FILE"))
    browser_acceptance_file = Path(required("BROWSER_ACCEPTANCE_RESULT_FILE"))
    test_email = required("PROD_TEST_USER_A_EMAIL")
    test_password = required("PROD_TEST_USER_A_PASSWORD")
    notification_expected = required_bool("NOTIFICATION_CHANNELS_ENABLED")

    expected_origin = production_origin(site)
    acceptance = parse_json(acceptance_file.read_bytes(), "authenticated acceptance result")
    if acceptance.get("status") != "passed":
        raise ReleaseCheckError("authenticated acceptance did not pass")
    if acceptance.get("release_sha") != expected_sha:
        raise ReleaseCheckError("backend acceptance result does not match the triggering commit")
    checks = acceptance.get("checks") or {}
    for key in ("database", "storage_bucket", "storage_policy", "edge_functions", "production_exceptions"):
        if not checks.get(key):
            raise ReleaseCheckError(f"authenticated acceptance did not verify {key}")

    exception_checks = acceptance.get("production_exceptions") or {}
    expected_exceptions = {
        "unauthorized": (401, None),
        "forbidden": (403, "ORIGIN_NOT_ALLOWED"),
        "rate_limit": (429, "AI_RATE_LIMITED"),
        "provider_timeout": (504, "AI_PROVIDER_TIMEOUT"),
        "quota": (402, "AI_QUOTA_EXCEEDED"),
    }
    for name, (expected_status, expected_error) in expected_exceptions.items():
        evidence = exception_checks.get(name) or {}
        if evidence.get("status") != expected_status:
            raise ReleaseCheckError(f"production exception acceptance did not verify {name}")
        if expected_error and evidence.get("error") != expected_error:
            raise ReleaseCheckError(f"production exception acceptance has the wrong {name} error code")
        if name in ("rate_limit", "provider_timeout", "quota") and evidence.get("logged") is not True:
            raise ReleaseCheckError(f"production exception acceptance did not log {name}")

    duplicate_generation = exception_checks.get("duplicate_generation") or {}
    if duplicate_generation.get("row_count") != 1 or not duplicate_generation.get("run_id"):
        raise ReleaseCheckError("duplicate report generation did not collapse to one run")
    report_content_gate = validate_report_content_gate(acceptance)

    browser_acceptance = parse_json(browser_acceptance_file.read_bytes(), "browser exception acceptance result")
    if browser_acceptance.get("status") != "passed":
        raise ReleaseCheckError("browser exception acceptance did not pass")
    browser_report_content_gate = validate_browser_report_content_gate(browser_acceptance)
    acceptance_run_id = acceptance.get("acceptance_run_id")
    browser_acceptance_run_id = browser_acceptance.get("acceptance_run_id")
    if not acceptance_run_id or acceptance_run_id != browser_acceptance_run_id:
        raise ReleaseCheckError("API and browser acceptance results do not share acceptance_run_id")
    network_recovery = browser_acceptance.get("network_recovery") or {}
    if (network_recovery.get("first_request") != "internetdisconnected"
            or network_recovery.get("attempts") != 2
            or network_recovery.get("recovered_with_production_response") is not True):
        raise ReleaseCheckError("production browser did not recover from the simulated disconnect")

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

    status, raw, _ = request("GET", site + "public-data-manifest.json")
    if status != 200:
        raise ReleaseCheckError(f"public data manifest unavailable: HTTP {status}")
    public_data_manifest = parse_json(raw, "public data manifest")
    if public_data_manifest.get("policy") != "explicit-allowlist-formal-projection":
        raise ReleaseCheckError("frontend public data policy is missing or invalid")
    if set(public_data_manifest.get("data_files") or []) != set(PUBLIC_PAGE_DATA_PATHS):
        raise ReleaseCheckError("frontend public data allowlist does not match the release contract")
    for path in PUBLIC_PAGE_DATA_PATHS:
        status, raw, _ = request("GET", site + path)
        if status != 200:
            raise ReleaseCheckError(f"allowlisted frontend data is unavailable: {path} HTTP {status}")
        parse_json(raw, f"allowlisted frontend data {path}")
    for path in PRIVATE_PAGE_DATA_PATHS:
        status, _, _ = request("GET", site + path)
        if status != 404:
            raise ReleaseCheckError(f"private data path is publicly reachable: {path} HTTP {status}")

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
        "ai-proxy", "report-save", "report-export", "report-docx", "billing-checkout",
        "billing-status", "billing-portal", "billing-webhook", "admin-summary",
        "notification-dispatch", "workspace-invite", "data-subject-request", "security-gate",
        "history-search",
    ):
        status, _, response_headers = request("GET", f"{supabase}/functions/v1/{function_name}", headers=headers)
        if status == 404 or status >= 500:
            raise ReleaseCheckError(f"Edge Function {function_name} is unavailable: HTTP {status}")
        function_release = response_headers.get("X-JAY-Release", "")
        if function_release != expected_sha:
            raise ReleaseCheckError(
                f"Edge Function {function_name} release {function_release or 'missing'} does not match {expected_sha}"
            )

    status, raw, _ = request(
        "POST", f"{supabase}/functions/v1/history-search",
        headers={**headers, "Origin": expected_origin},
        body={"query": "", "sort": "newest", "page_size": 1},
    )
    history_search = parse_json(raw, "history search probe")
    if (status != 200 or not isinstance(history_search.get("items"), list)
            or not isinstance(history_search.get("counts"), dict)
            or not isinstance(history_search.get("total"), int)):
        raise ReleaseCheckError(f"history search contract probe failed: HTTP {status}")

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
        "POST", f"{supabase}/functions/v1/notification-dispatch",
        headers={**headers, "Origin": expected_origin}, body={"action": "status"},
    )
    notification_status = parse_json(raw, "notification channel status probe")
    if status != 200 or notification_status.get("enabled") is not notification_expected:
        raise ReleaseCheckError(
            f"notification status expected enabled={notification_expected}, got HTTP {status} "
            f"enabled={notification_status.get('enabled')}"
        )
    channel_statuses = notification_status.get("channels") or {}
    if set(channel_statuses) != {"email", "wecom", "feishu"}:
        raise ReleaseCheckError("notification status did not return all supported channels")
    if any("secret_ciphertext" in value or "webhook_url" in value for value in channel_statuses.values()):
        raise ReleaseCheckError("notification status exposed a channel credential")
    if notification_expected and not all(value.get("available") is True for value in channel_statuses.values()):
        raise ReleaseCheckError("external notifications are enabled but a provider is unavailable")

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
        "production_exceptions": True,
        "report_content_gate": report_content_gate,
        "browser_report_content_gate": browser_report_content_gate,
        "network_recovery": True,
        "billing_status": "enabled" if billing_enabled else "disabled",
        "notification_channels": "enabled" if notification_expected else "disabled",
        "history_search": True,
        "webhook_signature_guard": webhook_guard,
        "public_data_isolated": True,
        "frontend": True,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ReleaseCheckError, OSError, json.JSONDecodeError) as error:
        print(f"[PRODUCTION RELEASE CHECK] FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
