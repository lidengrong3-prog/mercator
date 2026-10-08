"""Verify that the deployed frontend and Supabase release are coherent."""

from __future__ import annotations

import hashlib
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

BLS_NONFARM_SERIES_ID = "CES0000000001"
BLS_NONFARM_RECORD_KEY = f"BLS_{BLS_NONFARM_SERIES_ID}"
BLS_NONFARM_NAME = "美国非农就业人数：全部雇员（季调）"
BLS_NONFARM_UNIT = "千人"
BLS_FORBIDDEN_LABELS = ("美国非农" + "平均" + "时薪", "非农" + "平均" + "时薪", "平均" + "时薪")


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
        raise ReleaseCheckError("R11 requires a real saved report and PDF/DOCX exports; blocked drafts cannot pass")
    raise ReleaseCheckError("browser acceptance omitted the formal report content gate mode")


def validate_two_account_browser_closure(browser_acceptance: dict) -> dict:
    execution = browser_acceptance.get("execution") or {}
    if (execution.get("mode") != "production"
            or execution.get("evidence_source") != "live_browser"
            or execution.get("mock_used") is not False
            or execution.get("release_fallback_used") is not False):
        raise ReleaseCheckError("browser acceptance is not live production-only evidence")
    accounts = browser_acceptance.get("accounts") or {}
    if set(accounts) != {"a", "b"}:
        raise ReleaseCheckError("browser acceptance did not return both isolated accounts")
    required_true = (
        "login", "workspace_selected", "upload_persisted", "report_saved",
        "pdf_exported", "docx_exported", "logout_relogin",
        "report_recovered_after_relogin", "upload_recovered_after_relogin",
        "ai_logs_present",
    )
    required_ids = ("user_id", "workspace_id", "upload_id", "report_id", "report_run_id")
    for label, evidence in accounts.items():
        for key in required_true:
            if evidence.get(key) is not True:
                raise ReleaseCheckError(f"browser account {label} omitted {key}")
        for key in required_ids:
            if not evidence.get(key):
                raise ReleaseCheckError(f"browser account {label} omitted {key}")
        exports = evidence.get("exports") or {}
        if not exports.get("pdf") or not exports.get("docx"):
            raise ReleaseCheckError(f"browser account {label} omitted real export IDs")
    if accounts["a"]["user_id"] == accounts["b"]["user_id"]:
        raise ReleaseCheckError("browser acceptance accounts resolve to the same user")
    if accounts["a"]["workspace_id"] == accounts["b"]["workspace_id"]:
        raise ReleaseCheckError("browser acceptance accounts resolve to the same workspace")
    isolation = browser_acceptance.get("isolation") or {}
    for key in ("workspace", "uploads", "reports", "exports", "ai_logs"):
        if isolation.get(key) is not True:
            raise ReleaseCheckError(f"browser acceptance did not prove cross-account {key} isolation")
    return {"accounts": accounts, "isolation": isolation, "execution": execution}


def validate_dual_release_evidence(evidence: dict, expected_sha: str, expected_migration: str) -> dict:
    if evidence.get("status") != "passed":
        raise ReleaseCheckError("EdgeOne/GitHub Pages live consistency did not pass")
    if evidence.get("release_sha") != expected_sha or evidence.get("migration_head") != expected_migration:
        raise ReleaseCheckError("dual-release evidence does not match the triggering release")
    if (evidence.get("evidence_source") != "live_http"
            or evidence.get("mock_used") is not False
            or evidence.get("fallback_used") is not False
            or evidence.get("differences") != []):
        raise ReleaseCheckError("dual-release evidence used fallback/mock data or retained differences")
    surfaces = evidence.get("surfaces") or {}
    if set(surfaces) != {"edgeone", "github_pages"}:
        raise ReleaseCheckError("dual-release evidence omitted a production surface")
    for name, surface in surfaces.items():
        if (surface.get("status") != "passed"
                or surface.get("release_sha") != expected_sha
                or surface.get("migration_head") != expected_migration
                or not surface.get("index_sha256")
                or not surface.get("asset_manifest_sha256")):
            raise ReleaseCheckError(f"dual-release evidence is incomplete for {name}")
    if surfaces["github_pages"].get("direct_origin") is not True:
        raise ReleaseCheckError("GitHub Pages evidence did not bypass EdgeOne")
    for field in ("index_sha256", "asset_manifest_sha256"):
        if surfaces["edgeone"].get(field) != surfaces["github_pages"].get(field):
            raise ReleaseCheckError(f"EdgeOne and GitHub Pages differ for {field}")
    rules = evidence.get("edgeone_rules") or {}
    if (rules.get("authority") != "repository-build-artifact"
            or rules.get("manual_overrides_allowed") is not False):
        raise ReleaseCheckError("EdgeOne rules are not governed by the repository artifact")
    return evidence


def validate_multi_ai_acceptance(acceptance: dict) -> dict:
    evidence = acceptance.get("multi_ai_acceptance") or {}
    if evidence.get("status") != "passed":
        raise ReleaseCheckError("multi-AI live acceptance did not pass")
    if evidence.get("primary_provider") != "coze":
        raise ReleaseCheckError("multi-AI live acceptance primary provider must be Coze")
    if evidence.get("fallback_provider") != "deepseek":
        raise ReleaseCheckError("multi-AI live acceptance fallback provider must be DeepSeek")
    if evidence.get("primary_provider") == evidence.get("fallback_provider"):
        raise ReleaseCheckError("multi-AI live acceptance requires distinct primary and fallback providers")
    for key in ("primary_real_call", "fallback_real_call", "primary_fault_injected",
                "fallback_used", "request_id_consistent", "quota_settled_once", "quota_replay_blocked"):
        if evidence.get(key) is not True:
            raise ReleaseCheckError(f"multi-AI live acceptance omitted {key} evidence")
    if evidence.get("attempt_count") != 2:
        raise ReleaseCheckError("multi-AI live acceptance did not record exactly two provider attempts")
    attempts = evidence.get("attempts") or []
    if len(attempts) != 2:
        raise ReleaseCheckError("multi-AI live acceptance attempt evidence is incomplete")
    primary, fallback = attempts
    if (primary.get("provider") != evidence.get("primary_provider")
            or primary.get("status") != "failed"
            or primary.get("error_code") != "AI_PROVIDER_UNAVAILABLE"):
        raise ReleaseCheckError("multi-AI live acceptance primary failure evidence is invalid")
    if (fallback.get("provider") != evidence.get("fallback_provider")
            or fallback.get("status") != "completed"
            or fallback.get("http_status") != 200):
        raise ReleaseCheckError("multi-AI live acceptance fallback success evidence is invalid")
    for attempt in attempts:
        fingerprint = str(attempt.get("config_fingerprint") or "")
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", fingerprint):
            raise ReleaseCheckError("multi-AI live acceptance contains an invalid provider configuration fingerprint")
        if not attempt.get("model"):
            raise ReleaseCheckError("multi-AI live acceptance attempt omitted the model")
    if not evidence.get("primary_request_id") or not evidence.get("fallback_request_id"):
        raise ReleaseCheckError("multi-AI live acceptance omitted request IDs")
    expected_routes = {
        "market_qa": "coze",
        "report": "coze",
        "course_qa": "coze",
        "general_chat": "deepseek",
    }
    if evidence.get("task_routes") != expected_routes:
        raise ReleaseCheckError("multi-AI live acceptance did not prove all task routes")
    probes = evidence.get("coze_bot_probes") or {}
    if any(probes.get(task) is not True for task in ("market_qa", "report", "course_qa")):
        raise ReleaseCheckError("multi-AI live acceptance did not call every Coze Bot")
    return evidence


def validate_bls_release_record(online_record: dict, expected_record: dict) -> dict:
    if not isinstance(online_record, dict) or not isinstance(expected_record, dict):
        raise ReleaseCheckError("BLS nonfarm release record is missing")
    required = {
        "series_id": BLS_NONFARM_SERIES_ID,
        "name": BLS_NONFARM_NAME,
        "unit": BLS_NONFARM_UNIT,
    }
    for field, expected in required.items():
        if str(online_record.get(field) or "") != expected:
            raise ReleaseCheckError(f"online BLS {field} is incorrect")
    for field in ("official_name", "value", "date", "source", "source_url", "metadata_url", "evidence_hash"):
        if str(online_record.get(field) or "") != str(expected_record.get(field) or ""):
            raise ReleaseCheckError(f"online BLS {field} does not match the release artifact")
    if not re.fullmatch(r"[0-9a-f]{64}", str(online_record.get("evidence_hash") or "")):
        raise ReleaseCheckError("online BLS evidence hash is invalid")
    serialized = json.dumps(online_record, ensure_ascii=False)
    if any(label in serialized for label in BLS_FORBIDDEN_LABELS):
        raise ReleaseCheckError("online BLS record contains a legacy hourly-earnings label")
    return online_record


def validate_bls_acceptance(acceptance: dict, expected_record: dict) -> dict:
    if not isinstance(expected_record, dict):
        raise ReleaseCheckError("release BLS nonfarm record is missing")
    ai = acceptance.get("bls_ai_acceptance") or {}
    report = acceptance.get("bls_report_acceptance") or {}
    if ai.get("status") != "passed" or report.get("status") != "passed":
        raise ReleaseCheckError("R02 BLS AI/report acceptance did not pass")
    if ai.get("series_id") != BLS_NONFARM_SERIES_ID or report.get("series_id") != BLS_NONFARM_SERIES_ID:
        raise ReleaseCheckError("R02 BLS acceptance used the wrong series")
    for field in ("value", "unit", "date"):
        if str(ai.get(field) or "") != str(expected_record.get(field) or ""):
            raise ReleaseCheckError(f"R02 BLS AI acceptance has the wrong {field}")
    if int(ai.get("citation_count") or 0) < 1:
        raise ReleaseCheckError("R02 BLS AI acceptance omitted the formal citation")
    exports = report.get("exports") or {}
    for export_format in ("pdf", "docx"):
        evidence = exports.get(export_format) or {}
        if evidence.get("status") != "passed" or evidence.get("format") != export_format:
            raise ReleaseCheckError(f"R02 BLS {export_format} content acceptance did not pass")
    return {"ai": ai, "report": report}


def main() -> int:
    site = required("PRODUCTION_SITE_URL").rstrip("/") + "/"
    supabase = required("SUPABASE_URL").rstrip("/")
    anon_key = required("SUPABASE_ANON_KEY")
    expected_sha = required("EXPECTED_RELEASE_SHA")
    expected_migration = required("EXPECTED_MIGRATION_HEAD")
    acceptance_file = Path(required("ACCEPTANCE_RESULT_FILE"))
    browser_acceptance_file = Path(required("BROWSER_ACCEPTANCE_RESULT_FILE"))
    dual_release_file = Path(required("DUAL_RELEASE_RESULT_FILE"))
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
        "provider_cancel_after_create": (504, "AI_PROVIDER_TIMEOUT"),
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
        if name == "provider_cancel_after_create" and (evidence.get("logged") is not True or evidence.get("remote_cancelled") is not True):
            raise ReleaseCheckError("production exception acceptance did not prove Coze cancellation")

    duplicate_generation = exception_checks.get("duplicate_generation") or {}
    if duplicate_generation.get("row_count") != 1 or not duplicate_generation.get("run_id"):
        raise ReleaseCheckError("duplicate report generation did not collapse to one run")
    report_content_gate = validate_report_content_gate(acceptance)
    multi_ai_acceptance = validate_multi_ai_acceptance(acceptance)
    release_macro_path = Path(os.environ.get("RELEASE_MACRO_PATH", "data/us_market/macro_indicators.json"))
    release_macro = parse_json(release_macro_path.read_bytes(), "release macro projection")
    expected_bls_record = (release_macro.get("indicators") or {}).get(BLS_NONFARM_RECORD_KEY)
    bls_acceptance = validate_bls_acceptance(acceptance, expected_bls_record)

    browser_acceptance = parse_json(browser_acceptance_file.read_bytes(), "browser exception acceptance result")
    if browser_acceptance.get("status") != "passed":
        raise ReleaseCheckError("browser exception acceptance did not pass")
    browser_report_content_gate = validate_browser_report_content_gate(browser_acceptance)
    two_account_browser = validate_two_account_browser_closure(browser_acceptance)
    dual_release = validate_dual_release_evidence(
        parse_json(dual_release_file.read_bytes(), "dual-release evidence"),
        expected_sha,
        expected_migration,
    )
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
    if manifest.get("schema_version") != 2 or manifest.get("frontend") != "github-pages+edgeone-pages":
        raise ReleaseCheckError("frontend release does not declare the R11 dual-publish contract")
    if manifest.get("release_integrity_path") != "release-integrity.json":
        raise ReleaseCheckError("frontend release integrity path is missing")

    status, raw, _ = request("GET", site + "public-data-manifest.json")
    if status != 200:
        raise ReleaseCheckError(f"public data manifest unavailable: HTTP {status}")
    public_data_manifest = parse_json(raw, "public data manifest")
    if public_data_manifest.get("policy") != "explicit-allowlist-formal-projection":
        raise ReleaseCheckError("frontend public data policy is missing or invalid")
    if set(public_data_manifest.get("data_files") or []) != set(PUBLIC_PAGE_DATA_PATHS):
        raise ReleaseCheckError("frontend public data allowlist does not match the release contract")
    online_public_data = {}
    for path in PUBLIC_PAGE_DATA_PATHS:
        status, raw, _ = request("GET", site + path)
        if status != 200:
            raise ReleaseCheckError(f"allowlisted frontend data is unavailable: {path} HTTP {status}")
        online_public_data[path] = parse_json(raw, f"allowlisted frontend data {path}")
    online_macro = online_public_data.get("data/us_market/macro_indicators.json") or {}
    online_bls_record = (online_macro.get("indicators") or {}).get(BLS_NONFARM_RECORD_KEY)
    validate_bls_release_record(online_bls_record, expected_bls_record)
    for path in PRIVATE_PAGE_DATA_PATHS:
        status, _, _ = request("GET", site + path)
        if status != 404:
            raise ReleaseCheckError(f"private data path is publicly reachable: {path} HTTP {status}")

    status, raw, _ = request("GET", site)
    if status != 200 or "JAY" not in raw.decode("utf-8", "replace"):
        raise ReleaseCheckError(f"production frontend is unavailable: HTTP {status}")

    status, raw, _ = request("GET", site + "asset-manifest.json")
    if status != 200:
        raise ReleaseCheckError(f"frontend asset manifest unavailable: HTTP {status}")
    asset_manifest = parse_json(raw, "frontend asset manifest")
    if hashlib.sha256(raw).hexdigest() != manifest.get("asset_manifest_sha256"):
        raise ReleaseCheckError("frontend asset manifest fingerprint does not match release.json")
    runtime_path = asset_manifest.get("assets/runtime-config.js")
    if not runtime_path:
        raise ReleaseCheckError("frontend runtime configuration asset is missing")

    # Hashed assets must be served as their declared type. A CDN fallback that
    # returns index.html for a missing JS/CSS path otherwise looks like a
    # successful HTTP probe while the browser silently fails to execute it.
    asset_types = {
        ".js": "javascript",
        ".css": "css",
    }
    for logical_path, hashed_path in sorted(asset_manifest.items()):
        suffix = Path(str(hashed_path)).suffix.lower()
        expected_kind = asset_types.get(suffix)
        if not expected_kind:
            continue
        status, raw, headers = request("GET", site + str(hashed_path))
        content_type = str(headers.get("Content-Type") or "").lower()
        expected_type = "javascript" if expected_kind == "javascript" else "text/css"
        # Some unit-test transports intentionally omit response headers; the
        # live HTTP probe must still enforce the type when headers are present.
        if status != 200 or (headers and expected_type not in content_type):
            raise ReleaseCheckError(
                f"frontend asset has the wrong response type: {logical_path} -> "
                f"HTTP {status} {content_type or 'missing content type'}"
            )
        try:
            decoded = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ReleaseCheckError(f"frontend asset is not UTF-8: {logical_path}") from error
        if "\ufffd" in decoded:
            raise ReleaseCheckError(f"frontend asset contains replacement characters: {logical_path}")

    status, raw, _ = request("GET", site + runtime_path)
    runtime_source = raw.decode("utf-8", "replace")
    match = re.search(r"window\.JAY_APP_CONFIG\s*=\s*Object\.freeze\((\{.*\})\);", runtime_source)
    if status != 200 or not match:
        raise ReleaseCheckError("frontend runtime configuration is unavailable or invalid")
    try:
        runtime_config = json.loads(match.group(1))
    except json.JSONDecodeError as error:
        raise ReleaseCheckError("frontend runtime configuration is not valid JSON") from error
    actual = str((runtime_config.get("supabase") or {}).get("url") or "").rstrip("/")
    if actual != supabase:
        raise ReleaseCheckError(f"frontend Supabase URL {actual or 'missing'} does not match {supabase}")
    if runtime_config.get("environment") != "production":
        raise ReleaseCheckError("frontend runtime environment is not production")

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
        "two_account_browser": two_account_browser,
        "dual_release": dual_release,
        "network_recovery": True,
        "billing_status": "enabled" if billing_enabled else "disabled",
        "notification_channels": "enabled" if notification_expected else "disabled",
        "history_search": True,
        "webhook_signature_guard": webhook_guard,
        "multi_ai_acceptance": multi_ai_acceptance,
        "bls_semantics": bls_acceptance,
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
