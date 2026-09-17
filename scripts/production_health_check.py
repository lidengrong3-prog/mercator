"""Probe production availability independently and emit one structured result."""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable


EDGE_FUNCTIONS = (
    "ai-proxy",
    "report-save",
    "report-export",
    "report-docx",
    "workspace-invite",
    "billing-checkout",
    "billing-status",
    "billing-portal",
    "billing-webhook",
    "admin-summary",
    "data-subject-request",
    "security-gate",
    "history-search",
    "notification-dispatch",
)


class HealthCheckError(RuntimeError):
    def __init__(self, code: str, message: str, **details):
        super().__init__(message)
        self.code = code
        self.details = details


def env_value(name: str, *, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def require_env(name: str) -> str:
    value = env_value(name)
    if not value:
        raise HealthCheckError("CONFIG_MISSING", f"missing required environment variable: {name}")
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
            return response.status, response.read(), response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.read(), error.headers


def parse_json(raw: bytes, description: str):
    try:
        return json.loads(raw)
    except Exception as error:
        raise HealthCheckError("INVALID_JSON", f"{description} did not return JSON: {error}") from error


def site_url() -> str:
    return require_env("PRODUCTION_SITE_URL").rstrip("/") + "/"


def supabase_url() -> str:
    return require_env("SUPABASE_URL").rstrip("/")


def supabase_headers(*, service_role: bool = False) -> dict[str, str]:
    if service_role:
        key = require_env("SUPABASE_SERVICE_KEY")
    else:
        key = env_value("SUPABASE_ANON_KEY") or env_value("SUPABASE_SERVICE_KEY")
        if not key:
            raise HealthCheckError(
                "CONFIG_MISSING",
                "missing required environment variable: SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY",
            )
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def probe_frontend() -> dict:
    status, raw, _ = request("GET", site_url())
    if status != 200 or "JAY" not in raw.decode("utf-8", "replace"):
        raise HealthCheckError("FRONTEND_UNAVAILABLE", f"production frontend returned HTTP {status}", http_status=status)
    return {"http_status": status}


def probe_release_manifest() -> dict:
    status, raw, _ = request("GET", site_url() + "release.json")
    if status != 200:
        raise HealthCheckError("MANIFEST_UNAVAILABLE", f"release manifest returned HTTP {status}", http_status=status)
    manifest = parse_json(raw, "release manifest")
    actual_sha = str(manifest.get("release_sha") or "")
    if not actual_sha:
        raise HealthCheckError(
            "MANIFEST_INVALID",
            "release manifest is missing release_sha",
            http_status=status,
        )
    expected_sha = env_value("EXPECTED_RELEASE_SHA")
    if expected_sha and actual_sha != expected_sha:
        raise HealthCheckError(
            "RELEASE_SHA_MISMATCH",
            f"frontend release {actual_sha or 'missing'} does not match {expected_sha}",
            http_status=status,
            actual_release_sha=actual_sha,
            expected_release_sha=expected_sha,
        )
    return {
        "http_status": status,
        "release_sha": actual_sha,
        "migration_head": manifest.get("migration_head"),
        "generated_at": manifest.get("generated_at"),
    }


def deployed_release_sha() -> str:
    """Resolve the deployed frontend SHA without assuming the checkout is live."""
    explicit_sha = env_value("EXPECTED_RELEASE_SHA")
    if explicit_sha:
        return explicit_sha
    status, raw, _ = request("GET", site_url() + "release.json")
    if status != 200:
        return ""
    try:
        manifest = json.loads(raw)
    except Exception:
        return ""
    return str(manifest.get("release_sha") or "")


def probe_database() -> dict:
    base = supabase_url()
    headers = supabase_headers()
    probes = (("market_catalog", "code"), ("market_data_applicability", "id"))
    statuses = {}
    failures = []
    for table, primary_key in probes:
        try:
            status, _, _ = request(
                "GET",
                f"{base}/rest/v1/{table}?select={primary_key}&limit=1",
                headers=headers,
            )
            statuses[table] = {"status": "passed" if status == 200 else "failed", "http_status": status}
            if status != 200:
                failures.append(f"{table}=HTTP {status}")
        except Exception as error:
            statuses[table] = {"status": "failed", "error": str(error)}
            failures.append(f"{table}={type(error).__name__}")
    if failures:
        raise HealthCheckError(
            "DATABASE_UNAVAILABLE",
            "database probes failed: " + ", ".join(failures),
            tables=statuses,
        )
    return {"tables": statuses}


def probe_storage() -> dict:
    status, raw, _ = request(
        "GET",
        f"{supabase_url()}/storage/v1/bucket/reports",
        headers=supabase_headers(service_role=True),
    )
    if status != 200:
        raise HealthCheckError(
            "STORAGE_UNAVAILABLE",
            f"reports Storage bucket probe returned HTTP {status}",
            http_status=status,
        )
    bucket = parse_json(raw, "Storage bucket probe") if raw else {}
    if str(bucket.get("id") or bucket.get("name") or "") != "reports":
        raise HealthCheckError(
            "STORAGE_BUCKET_MISSING",
            "Storage API responded but the reports bucket was not returned",
            http_status=status,
        )
    return {"http_status": status, "bucket": "reports"}


def probe_capacity() -> dict:
    status, raw, _ = request(
        "POST",
        f"{supabase_url()}/rest/v1/rpc/collect_service_capacity",
        headers=supabase_headers(service_role=True),
        body={},
    )
    if status != 200:
        raise HealthCheckError("CAPACITY_UNAVAILABLE", f"capacity probe returned HTTP {status}", http_status=status)
    capacity = parse_json(raw, "capacity probe")
    if not isinstance(capacity, dict):
        raise HealthCheckError("CAPACITY_INVALID", "capacity probe did not return an object")
    return {"capacity": capacity}


def probe_edge_functions() -> dict:
    base = supabase_url()
    headers = supabase_headers()
    expected_sha = deployed_release_sha()
    functions = {}
    failures = []
    for function_name in EDGE_FUNCTIONS:
        try:
            status, _, response_headers = request(
                "GET", f"{base}/functions/v1/{function_name}", headers=headers
            )
            release = response_headers.get("X-JAY-Release", "")
            available = status != 404 and status < 500
            release_matches = not expected_sha or release == expected_sha
            functions[function_name] = {
                "status": "passed" if available and release_matches else "failed",
                "http_status": status,
                "release_sha": release or None,
                "release_matches": release_matches,
            }
            if not available:
                failures.append(f"{function_name}=HTTP {status}")
            elif not release_matches:
                failures.append(f"{function_name}=release {release or 'missing'}")
        except Exception as error:
            functions[function_name] = {
                "status": "failed",
                "error": str(error),
            }
            failures.append(f"{function_name}={type(error).__name__}")
    if failures:
        raise HealthCheckError(
            "EDGE_FUNCTIONS_UNAVAILABLE",
            "Edge Function probes failed: " + ", ".join(failures),
            functions=functions,
        )
    return {
        "expected_release_sha": expected_sha or None,
        "release_source": (
            "configured"
            if env_value("EXPECTED_RELEASE_SHA")
            else ("frontend_manifest" if expected_sha else "unavailable")
        ),
        "functions": functions,
    }


def probe_auth() -> dict:
    anon_key = require_env("SUPABASE_ANON_KEY")
    status, raw, _ = request(
        "POST",
        f"{supabase_url()}/auth/v1/token?grant_type=password",
        headers={"apikey": anon_key},
        body={
            "email": require_env("PROD_TEST_USER_A_EMAIL"),
            "password": require_env("PROD_TEST_USER_A_PASSWORD"),
        },
    )
    if status != 200:
        raise HealthCheckError("AUTH_UNAVAILABLE", f"production login returned HTTP {status}", http_status=status)
    session = parse_json(raw, "production health login")
    if not isinstance(session, dict) or not session.get("access_token"):
        raise HealthCheckError("AUTH_SESSION_MISSING", "production login did not return a session", http_status=status)
    return {"http_status": status}


def collect_health(probes: dict[str, Callable[[], dict]] | None = None) -> dict:
    active_probes = probes or {
        "frontend": probe_frontend,
        "release_manifest": probe_release_manifest,
        "database": probe_database,
        "storage": probe_storage,
        "capacity": probe_capacity,
        "edge_functions": probe_edge_functions,
        "auth": probe_auth,
    }
    components = {}
    started = time.perf_counter()
    for name, probe in active_probes.items():
        probe_started = time.perf_counter()
        try:
            details = dict(probe() or {})
            status = details.pop("status", "passed")
            components[name] = {"status": status, "duration_ms": round((time.perf_counter() - probe_started) * 1000), **details}
        except HealthCheckError as error:
            components[name] = {
                "status": "failed",
                "duration_ms": round((time.perf_counter() - probe_started) * 1000),
                "error_code": error.code,
                "error": str(error),
                **error.details,
            }
        except Exception as error:  # Keep every remaining availability probe running.
            components[name] = {
                "status": "failed",
                "duration_ms": round((time.perf_counter() - probe_started) * 1000),
                "error_code": "UNEXPECTED_ERROR",
                "error": str(error),
            }
    statuses = [component["status"] for component in components.values()]
    overall = "failed" if "failed" in statuses else ("degraded" if "degraded" in statuses else "passed")
    summary = {
        status: statuses.count(status)
        for status in ("passed", "degraded", "failed")
    }
    manifest_release_sha = (
        components.get("release_manifest", {}).get("release_sha")
        if components.get("release_manifest", {}).get("status") == "passed"
        else None
    )
    return {
        "kind": "production_availability",
        "status": overall,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "release_sha": manifest_release_sha or env_value("EXPECTED_RELEASE_SHA") or None,
        "duration_ms": round((time.perf_counter() - started) * 1000),
        "summary": summary,
        "failed_components": [
            name for name, component in components.items()
            if component["status"] == "failed"
        ],
        "components": components,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=env_value("PRODUCTION_HEALTH_OUTPUT", fallback="production-health-result.json"))
    args = parser.parse_args(argv)
    result = collect_health()
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    Path(args.output).write_text(rendered, encoding="utf-8")
    service_key = env_value("SUPABASE_SERVICE_KEY")
    if service_key:
        try:
            request(
                "POST",
                f"{supabase_url()}/rest/v1/service_health_snapshots",
                headers={**supabase_headers(service_role=True), "Content-Type": "application/json", "Prefer": "return=minimal"},
                body={"service": "production-availability", "status": result["status"], "checked_at": result["checked_at"], "release_sha": result.get("release_sha"), "metrics": result},
            )
        except Exception as error:
            print(f"[health] could not persist health snapshot: {error}", file=sys.stderr)
    print(rendered, end="")
    return 1 if result["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
