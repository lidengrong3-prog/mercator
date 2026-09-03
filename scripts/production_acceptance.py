"""Run the authenticated production report workflow against Supabase.

This check requires two dedicated test accounts. It is deliberately skipped
nowhere: missing credentials are a failed production gate, not a passing test.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class AcceptanceError(RuntimeError):
    pass


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise AcceptanceError(f"missing required environment variable: {name}")
    return value


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "").strip()
SITE_URL = os.environ.get("PRODUCTION_SITE_URL", "").strip().rstrip("/")


def request(method: str, url: str, *, token: str | None = None, body=None, headers=None, timeout=90):
    final_headers = dict(headers or {})
    if SUPABASE_URL and url.startswith(SUPABASE_URL):
        final_headers["apikey"] = ANON_KEY
    if token:
        final_headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        final_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=final_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            content_type = response.headers.get("content-type", "")
            value = json.loads(raw) if raw and "json" in content_type else raw
            return response.status, value, response.headers
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            value = json.loads(raw)
        except Exception:
            value = raw.decode("utf-8", "replace")
        return error.code, value, error.headers


def expect(condition: bool, message: str):
    if not condition:
        raise AcceptanceError(message)


def sign_in(email: str, password: str) -> dict:
    status, body, _ = request(
        "POST",
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        body={"email": email, "password": password},
    )
    expect(status == 200 and isinstance(body, dict) and body.get("access_token"), f"sign-in failed for {email}: {status} {body}")
    return body


def rest(method: str, table: str, token: str, *, query="", body=None, prefer="return=representation"):
    headers = {"Prefer": prefer}
    suffix = f"?{query}" if query else ""
    return request(method, f"{SUPABASE_URL}/rest/v1/{table}{suffix}", token=token, body=body, headers=headers)


def upsert(table: str, token: str, body: dict, conflict: str):
    query = urllib.parse.urlencode({"on_conflict": conflict})
    status, value, _ = rest("POST", table, token, query=query, body=body, prefer="resolution=merge-duplicates,return=representation")
    expect(status in (200, 201) and isinstance(value, list) and value, f"upsert {table} failed: {status} {value}")
    return value[0]


def function(name: str, token: str, body: dict):
    return request("POST", f"{SUPABASE_URL}/functions/v1/{name}", token=token, body=body, headers={"X-Request-Id": str(body.get("request_id", ""))}, timeout=120)


def reusable_export_key(token: str, report_id: str, export_format: str) -> str | None:
    query = urllib.parse.urlencode({
        "select": "id,idempotency_key,status,file_path",
        "report_id": f"eq.{report_id}",
        "format": f"eq.{export_format}",
        "status": "eq.completed",
        "idempotency_key": "not.is.null",
        "order": "created_at.desc",
        "limit": "1",
    })
    status, rows, _ = rest("GET", "report_exports", token, query=query)
    expect(status == 200 and isinstance(rows, list), f"cannot inspect reusable {export_format} export: {status} {rows}")
    if rows and rows[0].get("idempotency_key") and rows[0].get("file_path"):
        return str(rows[0]["idempotency_key"])
    return None


def main() -> int:
    required("SUPABASE_URL")
    required("SUPABASE_ANON_KEY")
    required("PRODUCTION_SITE_URL")
    email_a = required("PROD_TEST_USER_A_EMAIL")
    password_a = required("PROD_TEST_USER_A_PASSWORD")
    email_b = required("PROD_TEST_USER_B_EMAIL")
    password_b = required("PROD_TEST_USER_B_PASSWORD")
    expect(email_a.lower() != email_b.lower(), "production acceptance requires two different accounts")
    acceptance_run_id = os.environ.get("GITHUB_RUN_ID", "").strip() or f"local-{int(time.time())}-{uuid.uuid4().hex[:8]}"

    status, site_body, _ = request("GET", SITE_URL, headers={})
    expect(status == 200 and b"JAY" in site_body, f"production site is unavailable: {status}")

    session_a = sign_in(email_a, password_a)
    session_b = sign_in(email_b, password_b)
    token_a, token_b = session_a["access_token"], session_b["access_token"]
    user_a, user_b = session_a["user"]["id"], session_b["user"]["id"]
    expect(user_a != user_b, "test accounts resolved to the same user id")

    material = upsert("report_materials", token_a, {
        "user_id": user_a,
        "client_id": "production-acceptance-material",
        "material_type": "custom",
        "title": "生产验收素材",
        "source": "production-acceptance",
        "summary": "仅用于验证报告链路，不作为市场事实发布。",
        "selected": True,
        "metadata": {"verification_status": "uploaded", "test": True},
    }, "user_id,client_id")

    upload = upsert("saved_workspace_items", token_a, {
        "user_id": user_a,
        "item_type": "product_catalog_import",
        "client_id": "production-acceptance",
        "name": "production-acceptance",
        "content": {"meta": {"source": "acceptance"}, "products": [], "shops": []},
    }, "user_id,item_type,client_id")

    # Seed the second account with its own rows as well. Testing only
    # "B cannot read A" can miss a broken policy that leaks B data to A, so
    # the production gate exercises both directions explicitly.
    material_b = upsert("report_materials", token_b, {
        "user_id": user_b,
        "client_id": "production-acceptance-material-b",
        "material_type": "custom",
        "title": "生产验收B隔离素材",
        "source": "production-acceptance",
        "summary": "仅用于验证反向账号隔离。",
        "selected": True,
        "metadata": {"verification_status": "uploaded", "test": True},
    }, "user_id,client_id")
    upload_b = upsert("saved_workspace_items", token_b, {
        "user_id": user_b,
        "item_type": "product_catalog_import",
        "client_id": "production-acceptance-b",
        "name": "production-acceptance-b",
        "content": {"meta": {"source": "acceptance-b"}, "products": [], "shops": []},
    }, "user_id,item_type,client_id")
    report_b = upsert("generated_reports", token_b, {
        "user_id": user_b,
        "client_id": "production-acceptance-report-b",
        "report_type": "market",
        "title": "生产验收B隔离报告",
        "content": {"text": "仅用于验证反向账号隔离。", "test": True},
        "status": "completed",
        "generation_status": "completed",
        "save_status": "saved",
        "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "template_version": "acceptance-v1",
        "data_version": "production-acceptance",
        "quality_report_version": "production-acceptance",
        "scope_snapshot": {"marketCodes": ["US"]},
    }, "user_id,client_id")

    for table, row_id in (("report_materials", material["id"]), ("saved_workspace_items", upload["id"])):
        status, rows, _ = rest("GET", table, token_b, query=urllib.parse.urlencode({"select": "id", "id": f"eq.{row_id}"}))
        expect(status == 200 and rows == [], f"account B can read account A {table}")
    for table, row_id in (("report_materials", material_b["id"]), ("saved_workspace_items", upload_b["id"])):
        status, rows, _ = rest("GET", table, token_a, query=urllib.parse.urlencode({"select": "id", "id": f"eq.{row_id}"}))
        expect(status == 200 and rows == [], f"account A can read account B {table}")

    run_key = f"production-acceptance-report:{acceptance_run_id}"
    run = upsert("report_runs", token_a, {
        "user_id": user_a,
        "client_report_id": "production-acceptance-report",
        "idempotency_key": run_key,
        "purpose": "market-research",
        "status": "running",
        "market_codes": ["US"],
        "platform_keys": ["amazon-us"],
        "category_codes": ["acceptance"],
        "data_version": "production-acceptance",
        "section_count": 1,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "completed_at": None,
        "duration_ms": None,
        "error_code": None,
        "error_message": None,
    }, "user_id,idempotency_key")

    ai_request_id = f"production-acceptance:{int(time.time())}:{uuid.uuid4().hex[:8]}"
    started = time.monotonic()
    status, ai_body, _ = function("ai-proxy", token_a, {
        "request_id": ai_request_id,
        "operation": "production.acceptance",
        "report_run_id": run["id"],
        "client_report_id": "production-acceptance-report",
        "data_version": "production-acceptance",
        "messages": [
            {"role": "system", "content": "只返回简体中文，不得补造数字。"},
            {"role": "user", "content": "根据句子“生产验收素材已成功加入”写一句不超过20字的摘要。"},
        ],
        "temperature": 0,
        "max_tokens": 128,
        "stream": False,
    })
    expect(status == 200 and ai_body.get("choices"), f"AI generation failed: {status} {ai_body}")
    report_text = ai_body["choices"][0]["message"]["content"]

    report = upsert("generated_reports", token_a, {
        "user_id": user_a,
        "client_id": "production-acceptance-report",
        "report_type": "market",
        "title": "生产端到端验收报告",
        "content": {"text": report_text, "materials": [material], "market_codes": ["US"], "platform_keys": ["amazon-us"], "category_codes": ["acceptance"], "test": True},
        "status": "completed",
        "generation_status": "completed",
        "save_status": "saved",
        "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "template_version": "acceptance-v1",
        "data_version": "production-acceptance",
        "quality_report_version": "production-acceptance",
        "scope_snapshot": {"marketCodes": ["US"], "platformKeys": ["amazon-us"]},
        "report_run_id": run["id"],
    }, "user_id,client_id")

    rest("PATCH", "report_runs", token_a, query=urllib.parse.urlencode({"id": f"eq.{run['id']}", "user_id": f"eq.{user_a}"}), body={
        "status": "completed", "report_id": report["id"], "duration_ms": round((time.monotonic() - started) * 1000),
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    # A fresh session proves refresh/re-login recovery rather than memory reuse.
    fresh_a = sign_in(email_a, password_a)["access_token"]
    status, rows, _ = rest("GET", "generated_reports", fresh_a, query=urllib.parse.urlencode({"select": "id,client_id,title,save_status,content", "id": f"eq.{report['id']}"}))
    expect(status == 200 and len(rows) == 1 and rows[0]["save_status"] == "saved", "saved report did not recover after re-login")

    status, rows, _ = rest("GET", "generated_reports", token_b, query=urllib.parse.urlencode({"select": "id", "id": f"eq.{report['id']}"}))
    expect(status == 200 and rows == [], "account B can read account A report")
    status, rows, _ = rest("GET", "generated_reports", token_a, query=urllib.parse.urlencode({"select": "id", "id": f"eq.{report_b['id']}"}))
    expect(status == 200 and rows == [], "account A can read account B report")

    exported = {}
    for name, extension, signature in (("report-export", "pdf", b"%PDF"), ("report-docx", "docx", b"PK")):
        export_key = reusable_export_key(fresh_a, report["id"], extension) or f"production-acceptance:{acceptance_run_id}:{user_a}:{extension}"
        status, result, _ = function(name, fresh_a, {
            "title": "生产端到端验收报告", "text": report_text, "report_id": report["id"],
            "request_id": f"production-acceptance-{extension}",
            "idempotency_key": export_key,
        })
        expect(status in (200, 202), f"{extension} export failed: {status} {result}")
        expect(result.get("status") == "completed" and result.get("file_url"), f"{extension} export did not complete: {result}")
        file_status, file_body, _ = request("GET", result["file_url"], headers={})
        expect(file_status == 200 and file_body.startswith(signature), f"{extension} download is invalid")
        exported[extension] = result["id"]
        status, export_rows, _ = rest("GET", "report_exports", fresh_a, query=urllib.parse.urlencode({"select": "id,file_path", "id": f"eq.{result['id']}"}))
        expect(status == 200 and export_rows and export_rows[0].get("file_path"), f"{extension} export path is missing")
        encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in export_rows[0]["file_path"].split("/"))
        sign_status, _, _ = request("POST", f"{SUPABASE_URL}/storage/v1/object/sign/reports/{encoded_path}", token=token_b, body={"expiresIn": 60})
        expect(sign_status in (400, 401, 403, 404), f"account B can sign account A {extension} file: HTTP {sign_status}")

    # Generate one B-owned export so both report history and private Storage
    # paths are checked in the reverse direction too.
    b_export_key = reusable_export_key(token_b, report_b["id"], "pdf") or f"production-acceptance:{acceptance_run_id}:{user_b}:pdf"
    b_export_status, b_export, _ = function("report-export", token_b, {
        "title": "生产验收B隔离报告", "text": "仅用于验证反向账号隔离。", "report_id": report_b["id"],
        "request_id": "production-acceptance-b-pdf",
        "idempotency_key": b_export_key,
    })
    expect(b_export_status == 200 and b_export.get("status") == "completed" and b_export.get("file_url"), f"B PDF export failed: {b_export_status} {b_export}")
    status, b_export_rows, _ = rest("GET", "report_exports", token_b, query=urllib.parse.urlencode({"select": "id,file_path,report_id", "id": f"eq.{b_export['id']}"}))
    expect(status == 200 and b_export_rows and b_export_rows[0].get("file_path"), f"B PDF export path is missing: {status} {b_export_rows}")
    b_export_row = b_export_rows[0]
    status, rows, _ = rest("GET", "report_exports", token_a, query=urllib.parse.urlencode({"select": "id", "id": f"eq.{b_export_row['id']}"}))
    expect(status == 200 and rows == [], "account A can read account B export history")
    b_encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in b_export_row["file_path"].split("/"))
    sign_status, _, _ = request("POST", f"{SUPABASE_URL}/storage/v1/object/sign/reports/{b_encoded_path}", token=token_a, body={"expiresIn": 60})
    expect(sign_status in (400, 401, 403, 404), f"account A can sign account B PDF file: HTTP {sign_status}")

    status, rows, _ = rest("GET", "report_exports", token_b, query=urllib.parse.urlencode({"select": "id", "report_id": f"eq.{report['id']}"}))
    expect(status == 200 and rows == [], "account B can read account A export history")
    status, denied_export, _ = function("report-export", token_b, {
        "title": "越权测试", "text": "越权测试", "report_id": report["id"],
        "request_id": "production-acceptance-denied-export",
        "idempotency_key": f"production-acceptance:{acceptance_run_id}:{user_b}:denied",
    })
    expect(status == 404 and denied_export.get("error") == "REPORT_NOT_FOUND", f"account B can export account A report: {status} {denied_export}")
    status, denied_export, _ = function("report-export", token_a, {
        "title": "越权测试", "text": "越权测试", "report_id": report_b["id"],
        "request_id": "production-acceptance-denied-export-b",
        "idempotency_key": f"production-acceptance:{acceptance_run_id}:{user_a}:denied-b",
    })
    expect(status == 404 and denied_export.get("error") == "REPORT_NOT_FOUND", f"account A can export account B report: {status} {denied_export}")

    status, logs, _ = rest("GET", "ai_request_logs", fresh_a, query=urllib.parse.urlencode({"select": "request_id,status,model,total_tokens,duration_ms", "request_id": f"eq.{ai_request_id}"}))
    expect(status == 200 and logs and logs[0]["status"] == "completed", "AI observability record is missing")

    result = {
        "status": "passed", "site": SITE_URL, "user_isolation": True, "report_id": report["id"],
        "report_run_id": run["id"], "exports": exported, "reverse_export_id": b_export["id"], "ai_request_id": ai_request_id,
        "release_sha": os.environ.get("RELEASE_SHA", ""),
        "checks": {
            "database": True,
            "storage_bucket": True,
            "storage_policy": True,
            "edge_functions": ["ai-proxy", "report-export", "report-docx"],
        },
    }
    output_path = os.environ.get("PRODUCTION_ACCEPTANCE_OUTPUT", "").strip()
    if output_path:
        Path(output_path).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AcceptanceError as error:
        print(f"[PRODUCTION ACCEPTANCE] FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
