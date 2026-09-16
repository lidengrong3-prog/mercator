"""Run the authenticated production report workflow against Supabase.

This check requires two dedicated test accounts. It is deliberately skipped
nowhere: missing credentials are a failed production gate, not a passing test.
"""

from __future__ import annotations

import atexit
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
import os
from pathlib import Path
import sys
import time
from datetime import datetime
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
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
SITE_URL = os.environ.get("PRODUCTION_SITE_URL", "").strip().rstrip("/")
ACTIVE_ACCEPTANCE_RUN_ID = ""
ACCEPTANCE_FINAL_STATE: dict = {}


def _acceptance_payload(body):
    """Attach the run marker without ever storing report text in the ledger."""
    if not ACTIVE_ACCEPTANCE_RUN_ID or not isinstance(body, dict):
        return body
    result = dict(body)
    result.setdefault("acceptance_run_id", ACTIVE_ACCEPTANCE_RUN_ID)
    return result


def request(method: str, url: str, *, token: str | None = None, body=None, headers=None, timeout=90):
    final_headers = dict(headers or {})
    if SUPABASE_URL and url.startswith(SUPABASE_URL) and "apikey" not in final_headers:
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
    status, value, _ = rest("POST", table, token, query=query, body=_acceptance_payload(body), prefer="resolution=merge-duplicates,return=representation")
    expect(status in (200, 201) and isinstance(value, list) and value, f"upsert {table} failed: {status} {value}")
    return value[0]


def ensure_export_entitlement(workspace_id: str, actor_id: str) -> dict:
    """Give a dedicated acceptance workspace an audited non-Stripe Pro plan."""
    status, value, _ = request(
        "POST",
        f"{SUPABASE_URL}/rest/v1/rpc/configure_workspace_manual_subscription",
        token=SERVICE_KEY,
        body={
            "p_workspace_id": workspace_id,
            "p_plan": "pro",
            "p_seat_limit": 5,
            "p_actor_id": actor_id,
            "p_reason": "production acceptance export and collaboration validation",
            "p_overrides": {"monthly_report_limit": 100, "monthly_export_limit": 100},
        },
        headers={"apikey": SERVICE_KEY, "Prefer": "return=representation"},
    )
    expect(status == 200 and isinstance(value, dict) and value.get("plan") == "pro",
           f"ensure workspace export entitlement failed: {status} {value}")
    return value


def function(name: str, token: str | None, body: dict, *, headers=None, timeout=120):
    final_headers = {"X-Request-Id": str(body.get("request_id", ""))}
    final_headers.update(headers or {})
    return request(
        "POST",
        f"{SUPABASE_URL}/functions/v1/{name}",
        token=token,
        body=_acceptance_payload(body),
        headers=final_headers,
        timeout=timeout,
    )


def service_rpc(name: str, body: dict) -> dict:
    status, value, _ = request(
        "POST",
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        token=SERVICE_KEY,
        body=body,
        headers={"apikey": SERVICE_KEY},
        timeout=60,
    )
    expect(status == 200 and isinstance(value, dict), f"service RPC {name} failed: {status} {value}")
    return value


def start_acceptance_run(acceptance_run_id: str, user_a: str, user_b: str) -> dict:
    return service_rpc("start_production_acceptance_run", {
        "p_acceptance_run_id": acceptance_run_id,
        "p_api_owner_id": user_a,
        "p_browser_owner_id": user_b,
        "p_release_sha": os.environ.get("RELEASE_SHA", ""),
    })


def mark_acceptance_run(status: str, result_summary=None, error_summary=None) -> dict:
    return service_rpc("mark_production_acceptance_run", {
        "p_acceptance_run_id": ACTIVE_ACCEPTANCE_RUN_ID,
        "p_status": status,
        "p_result_summary": result_summary or {},
        "p_error_summary": error_summary or {},
    })


def cleanup_acceptance_run(acceptance_run_id: str) -> dict:
    paths = service_select_rows("report_exports", {
        "select": "file_path",
        "acceptance_run_id": f"eq.{acceptance_run_id}",
        "file_path": "not.is.null",
        "limit": "5000",
    })
    marker = f"/acceptance/{urllib.parse.quote(acceptance_run_id, safe='')}/"
    storage_paths = sorted({
        str(row.get("file_path") or "").strip()
        for row in paths
        if marker in str(row.get("file_path") or "")
        and "://" not in str(row.get("file_path") or "")
    })
    if storage_paths:
        status, value, _ = request(
            "DELETE",
            f"{SUPABASE_URL}/storage/v1/object/reports",
            token=SERVICE_KEY,
            body={"prefixes": storage_paths},
            headers={"apikey": SERVICE_KEY},
        )
        expect(status in (200, 204), f"acceptance Storage cleanup failed: {status} {value}")
    result = service_rpc("cleanup_production_acceptance_run", {
        "p_acceptance_run_id": acceptance_run_id,
    })
    expect(result.get("status") in ("cleaned", "not_found"), f"acceptance cleanup failed: {result}")
    return {**result, "storage_objects": len(storage_paths)}


def recover_prior_acceptance_runs(current_run_id: str, owner_ids: tuple[str, str]) -> None:
    owner_set = set(owner_ids)
    rows = service_select_rows("production_acceptance_runs", {
        "select": "acceptance_run_id,status,api_owner_id,browser_owner_id",
        "status": "in.(running,cleaning,cleanup_failed)",
        "order": "started_at.asc",
        "limit": "100",
    })
    for row in rows:
        run_owners = {str(row.get("api_owner_id") or ""), str(row.get("browser_owner_id") or "")}
        if not owner_set.intersection(run_owners):
            continue
        run_id = str(row.get("acceptance_run_id") or "").strip()
        if run_id and run_id != current_run_id:
            cleanup_acceptance_run(run_id)


def cleanup_expired_acceptance_runs(retention_days: int = 7) -> dict:
    return service_rpc("cleanup_expired_production_acceptance_runs", {
        "p_retention": f"{max(1, int(retention_days))} days",
    })


def _finalize_acceptance_run() -> None:
    """Run on normal exit, exceptions and KeyboardInterrupt.

    A successful API job may defer cleanup until the browser job completes;
    failed and interrupted runs always attempt immediate compensation.
    """
    run_id = str(ACCEPTANCE_FINAL_STATE.get("acceptance_run_id") or "").strip()
    if not run_id:
        return
    status = str(ACCEPTANCE_FINAL_STATE.get("status") or "failed")
    try:
        mark_acceptance_run(
            status,
            ACCEPTANCE_FINAL_STATE.get("result_summary") or {},
            ACCEPTANCE_FINAL_STATE.get("error_summary") or {},
        )
    except Exception as error:
        ACCEPTANCE_FINAL_STATE["error_summary"] = {"code": "MARK_RUN_FAILED", "message": str(error)[:500]}
    if status == "passed" and os.environ.get("DEFER_ACCEPTANCE_CLEANUP", "") == "1":
        return
    try:
        cleanup_acceptance_run(run_id)
    except Exception as error:
        ACCEPTANCE_FINAL_STATE["cleanup_error"] = str(error)[:500]


def select_rows(table: str, token: str, query: dict) -> list[dict]:
    status, value, _ = rest("GET", table, token, query=urllib.parse.urlencode(query))
    expect(status == 200 and isinstance(value, list), f"cannot read {table}: {status} {value}")
    return value


def service_select_rows(table: str, query: dict) -> list[dict]:
    status, value, _ = request(
        "GET",
        f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(query)}",
        token=SERVICE_KEY,
        headers={"apikey": SERVICE_KEY},
    )
    expect(status == 200 and isinstance(value, list), f"service role cannot read {table}: {status} {value}")
    return value


def acceptance_fault_headers(user_id: str, scenario: str, request_id: str, issued_at: int | None = None) -> dict[str, str]:
    timestamp = int(time.time()) if issued_at is None else int(issued_at)
    message = f"v1\n{timestamp}\n{user_id}\n{scenario}\n{request_id}".encode("utf-8")
    signature = hmac.new(SERVICE_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return {
        "X-JAY-Acceptance-Scenario": scenario,
        "X-JAY-Acceptance": f"{timestamp}.{signature}",
    }


def expect_ai_failure_log(token: str, request_id: str, error_code: str) -> dict:
    rows = select_rows("ai_request_logs", token, {
        "select": "request_id,status,http_status,error_code,metadata",
        "request_id": f"eq.{request_id}",
        "limit": "1",
    })
    expect(rows and rows[0].get("status") == "failed", f"AI failure log is missing for {request_id}")
    expect(rows[0].get("error_code") == error_code, f"AI failure log has the wrong error code: {rows[0]}")
    return rows[0]


def current_quality_gate(token: str) -> dict:
    rows = select_rows("market_data", token, {"select": "data", "key": "eq.quality_report", "limit": "1"})
    expect(rows and isinstance(rows[0].get("data"), dict), "production quality report is unavailable")
    report = rows[0]["data"]
    generated_at = str(report.get("generated_at") or "")
    try:
        generated_epoch = datetime.fromisoformat(generated_at.replace("Z", "+00:00")).timestamp()
    except ValueError:
        generated_epoch = 0
    stale = not generated_epoch or time.time() - generated_epoch > 12 * 60 * 60
    blocked_datasets = [
        key for key, dataset in (report.get("datasets") or {}).items()
        if isinstance(dataset, dict) and str(dataset.get("status") or "").lower() in ("failed", "stale")
    ]
    status = str(report.get("status") or "pending").lower()
    publishable = report.get("publishable") is True
    expect(publishable and not stale and status not in ("failed", "stale", "not_connected", "pending") and not blocked_datasets,
           f"production quality gate is blocked: status={status} stale={stale} datasets={blocked_datasets}")
    snapshot = {
        "quality_report_version": f"{report.get('schema_version', 'unknown')}@{generated_at or 'missing'}",
        "schema_version": report.get("schema_version"),
        "data_contract_version": report.get("data_contract_version"),
        "generated_at": generated_at,
        "status": status,
        "effective_status": status,
        "publishable": True,
        "stale": False,
    }
    return {"ok": True, "status": status, "publishable": True, "stale": False, "reasons": [], "snapshot": snapshot}


def source_appendix_line(source: dict) -> str:
    line = f"- [{source['citation']}] {source.get('source') or '未命名来源'} · {source.get('date') or '日期未提供'} · {source.get('verificationStatus') or '待核验'}"
    if source.get("recordId"):
        line += f" · 原始记录：{source['recordId']}"
    if source.get("dataSnapshotAt"):
        line += f" · 数据快照：{source['dataSnapshotAt']}"
    if source.get("url"):
        line += f" · {source['url']}"
    if source.get("chapters"):
        line += " · 引用章节：" + "、".join(source["chapters"])
    return line


def build_server_validated_report_content(token: str, ai_text: str) -> dict:
    market_code, platform_key, category_code = "US", "amazon", "generic"
    templates = select_rows("report_template_catalog", token, {
        "select": "id,code,version,required_domains,status",
        "code": "eq.market-research", "status": "eq.active", "order": "version.desc", "limit": "1",
    })
    expect(templates, "active market-research report template is missing")
    template = templates[0]
    required_domains = [str(value).lower() for value in template.get("required_domains") or []]
    expect(required_domains, "market-research template has no required domains")
    evidence = select_rows("market_data_applicability", token, {
        "select": "domain,record_key,market_code,platform_key,category_code,source_record_id,source_url,verification_status,evidence_hash,payload,published_at,verified_at,status",
        "market_code": f"eq.{market_code}", "status": "eq.active",
        "verification_status": "in.(verified,uploaded)", "limit": "10000",
    })

    selected: dict[str, list[dict]] = {}
    for domain in required_domains:
        candidates = []
        for row in evidence:
            row_domain = str(row.get("domain") or "").lower()
            if row_domain != domain and not (domain == "platform" and row_domain == "rule"):
                continue
            if row.get("platform_key") and row.get("platform_key") != platform_key:
                continue
            if domain in ("platform", "rule") and row.get("platform_key") != platform_key:
                continue
            if row.get("category_code") and row.get("category_code") != category_code:
                continue
            record_id = str(row.get("source_record_id") or row.get("record_key") or "")
            verification = str(row.get("verification_status") or "").lower()
            source_url = str(row.get("source_url") or "")
            if not record_id or verification not in ("verified", "uploaded"):
                continue
            if verification != "uploaded" and not source_url.startswith("https://"):
                continue
            candidates.append(row)
        expect(candidates, f"production evidence is missing for {market_code}|{platform_key}|{category_code}|{domain}")
        candidates.sort(key=lambda row: (
            str(row.get("published_at") or row.get("verified_at") or ""),
            str(row.get("source_record_id") or row.get("record_key") or ""),
        ), reverse=True)
        # Acceptance proves every required domain is exportable; it must not
        # turn the entire production history into one oversized test report.
        selected[domain] = candidates[:3]

    unique_rows: list[dict] = []
    seen_ids: set[str] = set()
    for domain_rows in selected.values():
        for row in domain_rows:
            record_id = str(row.get("source_record_id") or row.get("record_key"))
            if record_id not in seen_ids:
                seen_ids.add(record_id)
                unique_rows.append(row)
    appendix = []
    for index, row in enumerate(unique_rows, 1):
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        appendix.append({
            "citation": f"S{index:03d}",
            "source": payload.get("source_name") or payload.get("source") or "生产正式数据源",
            "url": row.get("source_url") or "",
            "date": row.get("published_at") or row.get("verified_at") or "日期未提供",
            "verificationStatus": row.get("verification_status"),
            "recordId": row.get("source_record_id") or row.get("record_key"),
            "evidenceHash": row.get("evidence_hash") or "",
            "chapters": ["executive_summary"],
        })
    citations = " ".join(f"[{source['citation']}]" for source in appendix)
    safe_ai_text = " ".join(str(ai_text or "").split()).strip()
    section_text = (safe_ai_text + "\n\n" if safe_ai_text else "") + f"当前所选范围的必需数据域均有服务端可追溯记录。 {citations}"
    sections = [{"id": "executive_summary", "title": "执行摘要", "domain": "summary", "text": section_text}]
    pairs = [{"marketCode": market_code, "platformKey": platform_key}]
    cells = []
    for domain in required_domains:
        domain_rows = selected[domain]
        cells.append({
            "id": f"{market_code}|{platform_key}|{category_code}|{domain}",
            "marketCode": market_code, "platformKey": platform_key, "categoryCode": category_code,
            "domain": domain, "covered": True, "recordCount": len(domain_rows),
            "sourceRecordIds": list(dict.fromkeys(row.get("source_record_id") or row.get("record_key") for row in domain_rows)),
        })
    matrix = {
        "version": "1.0", "requiredDomains": required_domains,
        "dimensions": {"marketCodes": [market_code], "platformKeys": [platform_key], "categoryCodes": [category_code], "marketPlatformPairs": pairs},
        "cells": cells, "missingCells": [], "totalCells": len(cells), "coveredCells": len(cells), "coveragePercent": 100, "ok": True,
    }
    gate = current_quality_gate(token)
    content = {
        "publishable": True,
        "template": template["code"], "template_id": template["code"], "template_version": template["version"],
        "market_codes": [market_code], "platform_keys": [platform_key], "category_codes": [category_code],
        "scope_snapshot": {"marketCodes": [market_code], "platformKeys": [platform_key], "categoryCodes": [category_code]},
        "quality_gate": gate, "quality_snapshot": gate["snapshot"], "quality_report_version": gate["snapshot"]["quality_report_version"],
        "coverage_matrix": matrix, "source_appendix": appendix,
        "citation_audit": {"ok": True}, "reconciliation": {"ok": True}, "scope_check": {"ok": True},
        "model": {"sections": sections, "sourceAppendix": appendix, "coverageMatrix": matrix, "qualityGate": gate, "qualitySnapshot": gate["snapshot"]},
        "data_snapshot_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source_record_ids": [source["recordId"] for source in appendix],
    }
    body = "\n\n".join(f"## {section['title']}\n\n{section['text'].strip()}" for section in sections)
    appendix_text = "\n".join(source_appendix_line(source) for source in appendix)
    content["text"] = body + "\n\n## 来源与核验附录\n\n" + appendix_text
    return content


def owned_workspace(token: str, user_id: str) -> str:
    memberships = select_rows("workspace_members", token, {
        "select": "id,workspace_id,role,status", "user_id": f"eq.{user_id}",
        "role": "eq.owner", "status": "eq.active", "order": "joined_at.asc", "limit": "1",
    })
    expect(memberships and memberships[0].get("workspace_id"), f"owner workspace is missing for {user_id}")
    return str(memberships[0]["workspace_id"])


def save_formal_report(token: str, user_id: str, workspace_id: str, client_id: str, title: str, content: dict, report_run_id: str | None = None) -> dict:
    report = {
        "user_id": user_id,
        "workspace_id": workspace_id,
        "acceptance_run_id": ACTIVE_ACCEPTANCE_RUN_ID or None,
        "client_id": client_id,
        "report_type": "market",
        "title": title,
        "content": content,
        "status": "completed",
        "generation_status": "completed",
        "save_status": "saving",
        "template_version": str(content.get("template_version") or ""),
        "data_version": "production-acceptance",
        "quality_report_version": content.get("quality_report_version"),
        "data_snapshot_at": content.get("data_snapshot_at"),
        "scope_snapshot": content.get("scope_snapshot"),
        "report_run_id": report_run_id,
    }
    status, result, _ = function("report-save", token, {"report": report, "request_id": f"save:{client_id}"})
    expect(status == 200 and isinstance(result, dict) and isinstance(result.get("report"), dict), f"report-save failed: {status} {result}")
    saved = result["report"]
    expect(saved.get("save_status") == "saved" and saved.get("publication_status") == "formal", f"report-save returned a non-formal row: {saved}")
    expect(saved.get("server_validation_version") and saved.get("server_validated_at"), "report-save omitted server validation metadata")
    return saved


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
    global ACTIVE_ACCEPTANCE_RUN_ID
    required("SUPABASE_URL")
    required("SUPABASE_ANON_KEY")
    required("SUPABASE_SERVICE_KEY")
    required("PRODUCTION_SITE_URL")
    email_a = required("PROD_TEST_USER_A_EMAIL")
    password_a = required("PROD_TEST_USER_A_PASSWORD")
    email_b = required("PROD_TEST_USER_B_EMAIL")
    password_b = required("PROD_TEST_USER_B_PASSWORD")
    expect(email_a.lower() != email_b.lower(), "production acceptance requires two different accounts")
    acceptance_run_id = os.environ.get("ACCEPTANCE_RUN_ID", "").strip()
    if not acceptance_run_id:
        github_run = os.environ.get("GITHUB_RUN_ID", "").strip()
        github_attempt = os.environ.get("GITHUB_RUN_ATTEMPT", "1").strip() or "1"
        acceptance_run_id = f"{github_run}-{github_attempt}" if github_run else f"local-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    ACTIVE_ACCEPTANCE_RUN_ID = acceptance_run_id

    status, site_body, _ = request("GET", SITE_URL, headers={})
    expect(status == 200 and b"JAY" in site_body, f"production site is unavailable: {status}")

    session_a = sign_in(email_a, password_a)
    session_b = sign_in(email_b, password_b)
    token_a, token_b = session_a["access_token"], session_b["access_token"]
    user_a, user_b = session_a["user"]["id"], session_b["user"]["id"]
    expect(user_a != user_b, "test accounts resolved to the same user id")
    recover_prior_acceptance_runs(acceptance_run_id, (user_a, user_b))
    run_setup = start_acceptance_run(acceptance_run_id, user_a, user_b)
    workspace_a = str(run_setup.get("api_workspace_id") or "")
    workspace_b = str(run_setup.get("browser_workspace_id") or "")
    expect(workspace_a and workspace_b and workspace_a != workspace_b, "dedicated acceptance workspaces were not created")
    ACCEPTANCE_FINAL_STATE.update({
        "acceptance_run_id": acceptance_run_id,
        "status": "failed",
        "result_summary": {"api_workspace_id": workspace_a, "browser_workspace_id": workspace_b},
    })
    atexit.register(_finalize_acceptance_run)
    # Free plans intentionally cannot export formal PDF/DOCX. The two
    # dedicated CI accounts need a non-Stripe Pro entitlement to exercise the
    # complete export and collaboration path without enabling billing.
    ensure_export_entitlement(workspace_a, user_a)
    ensure_export_entitlement(workspace_b, user_b)

    # Recover from an interrupted previous acceptance run before checking the
    # initial isolation boundary. The owner can remove only a non-owner member.
    prior_memberships = select_rows("workspace_members", token_a, {
        "select": "id", "workspace_id": f"eq.{workspace_a}", "user_id": f"eq.{user_b}", "limit": "10",
    })
    for membership in prior_memberships:
        status, _, _ = rest("DELETE", "workspace_members", token_a, query=urllib.parse.urlencode({"id": f"eq.{membership['id']}"}), prefer="return=minimal")
        expect(status in (200, 204), f"cannot clear prior collaboration membership: HTTP {status}")

    material = upsert("report_materials", token_a, {
        "user_id": user_a,
        "workspace_id": workspace_a,
        "client_id": "production-acceptance-material",
        "material_type": "custom",
        "title": "生产验收素材",
        "source": "production-acceptance",
        "summary": "仅用于验证报告链路，不作为市场事实发布。",
        "selected": True,
        "metadata": {"verification_status": "uploaded", "test": True},
    }, "workspace_id,client_id")

    upload = upsert("saved_workspace_items", token_a, {
        "user_id": user_a,
        "workspace_id": workspace_a,
        "item_type": "product_catalog_import",
        "client_id": "production-acceptance",
        "name": "production-acceptance",
        "content": {"meta": {"source": "acceptance"}, "products": [], "shops": []},
    }, "workspace_id,item_type,client_id")

    # Seed the second account with its own rows as well. Testing only
    # "B cannot read A" can miss a broken policy that leaks B data to A, so
    # the production gate exercises both directions explicitly.
    material_b = upsert("report_materials", token_b, {
        "user_id": user_b,
        "workspace_id": workspace_b,
        "client_id": "production-acceptance-material-b",
        "material_type": "custom",
        "title": "生产验收B隔离素材",
        "source": "production-acceptance",
        "summary": "仅用于验证反向账号隔离。",
        "selected": True,
        "metadata": {"verification_status": "uploaded", "test": True},
    }, "workspace_id,client_id")
    upload_b = upsert("saved_workspace_items", token_b, {
        "user_id": user_b,
        "workspace_id": workspace_b,
        "item_type": "product_catalog_import",
        "client_id": "production-acceptance-b",
        "name": "production-acceptance-b",
        "content": {"meta": {"source": "acceptance-b"}, "products": [], "shops": []},
    }, "workspace_id,item_type,client_id")
    forged_client_id = f"production-acceptance-forged:{acceptance_run_id}"
    forged_status, forged_body, _ = rest("POST", "generated_reports", token_a, body={
        "user_id": user_a,
        "workspace_id": workspace_a,
        "client_id": forged_client_id,
        "report_type": "market",
        "title": "客户端伪造正式报告",
        "content": {"text": "不得保存", "publishable": True},
        "status": "completed",
        "generation_status": "completed",
        "save_status": "saved",
        "publication_status": "formal",
    })
    expect(forged_status in (401, 403), f"direct formal report write was not rejected: {forged_status} {forged_body}")
    forged_rows = select_rows("generated_reports", token_a, {"select": "id", "client_id": f"eq.{forged_client_id}"})
    expect(forged_rows == [], "direct formal report write created a row")

    draft_b = upsert("generated_reports", token_b, {
        "user_id": user_b,
        "workspace_id": workspace_b,
        "client_id": f"production-acceptance-draft-b:{acceptance_run_id}",
        "report_type": "market",
        "title": "生产验收B隔离草稿",
        "content": {"text": "仅用于验证反向账号隔离。", "publishable": False, "test": True},
        "status": "completed",
        "generation_status": "completed",
        "save_status": "pending",
        "scope_snapshot": {"marketCodes": ["US"]},
    }, "workspace_id,client_id")

    for table, row_id in (("report_materials", material["id"]), ("saved_workspace_items", upload["id"])):
        status, rows, _ = rest("GET", table, token_b, query=urllib.parse.urlencode({"select": "id", "id": f"eq.{row_id}"}))
        expect(status == 200 and rows == [], f"account B can read account A {table}")
    for table, row_id in (("report_materials", material_b["id"]), ("saved_workspace_items", upload_b["id"])):
        status, rows, _ = rest("GET", table, token_a, query=urllib.parse.urlencode({"select": "id", "id": f"eq.{row_id}"}))
        expect(status == 200 and rows == [], f"account A can read account B {table}")

    run_key = f"production-acceptance-report:{acceptance_run_id}"
    run_payload = {
        "user_id": user_a,
        "workspace_id": workspace_a,
        "client_report_id": "production-acceptance-report",
        "idempotency_key": run_key,
        "purpose": "market-research",
        "status": "running",
        "market_codes": ["US"],
        "platform_keys": ["amazon"],
        "category_codes": ["generic"],
        "data_version": "production-acceptance",
        "section_count": 1,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "completed_at": None,
        "duration_ms": None,
        "error_code": None,
        "error_message": None,
    }
    with ThreadPoolExecutor(max_workers=2) as executor:
        duplicate_runs = list(executor.map(
            lambda _: upsert("report_runs", token_a, run_payload, "workspace_id,idempotency_key"),
            range(2),
        ))
    duplicate_run_ids = {str(row.get("id") or "") for row in duplicate_runs}
    expect(len(duplicate_run_ids) == 1 and "" not in duplicate_run_ids,
           f"duplicate report generation created different runs: {duplicate_runs}")
    run_rows = select_rows("report_runs", token_a, {
        "select": "id,idempotency_key,status", "idempotency_key": f"eq.{run_key}", "limit": "10",
    })
    expect(len(run_rows) == 1, f"duplicate report generation created {len(run_rows)} run rows")
    run = duplicate_runs[0]

    ai_request_id = f"production-acceptance:{int(time.time())}:{uuid.uuid4().hex[:8]}"
    started = time.monotonic()
    status, ai_body, _ = function("ai-proxy", token_a, {
        "request_id": ai_request_id,
        "operation": "production.acceptance",
        "report_run_id": run["id"],
        "client_report_id": "production-acceptance-report",
        "data_version": "production-acceptance",
        "messages": [
            {"role": "system", "content": "只返回一句简体中文，不得补造或输出任何数字。"},
            {"role": "user", "content": "根据“生产验收素材已成功加入”写一句很短的摘要。"},
        ],
        "temperature": 0,
        "max_tokens": 128,
        "stream": False,
    })
    expect(status == 200 and ai_body.get("choices"), f"AI generation failed: {status} {ai_body}")
    report_text = ai_body["choices"][0]["message"]["content"]

    fault_body = {
        "workspace_id": workspace_a,
        "operation": "production.acceptance.failure",
        "messages": [{"role": "user", "content": "production acceptance probe"}],
        "temperature": 0,
        "max_tokens": 128,
        "stream": False,
    }
    unauthenticated_id = f"production-acceptance-unauthorized:{acceptance_run_id}"
    status, unauthorized, _ = function("ai-proxy", None, {
        **fault_body, "request_id": unauthenticated_id,
    })
    expect(status == 401, f"AI endpoint accepted an unauthenticated request: {status} {unauthorized}")

    forbidden_id = f"production-acceptance-forbidden:{acceptance_run_id}"
    status, forbidden, _ = function("ai-proxy", token_a, {
        **fault_body, "request_id": forbidden_id,
    }, headers={"Origin": "https://production-acceptance.invalid"})
    expect(status == 403 and forbidden.get("error") == "ORIGIN_NOT_ALLOWED",
           f"AI endpoint did not reject a forbidden origin: {status} {forbidden}")

    invalid_fault_id = f"production-acceptance-invalid-fault:{acceptance_run_id}"
    invalid_headers = acceptance_fault_headers(user_a, "quota", invalid_fault_id)
    proof = invalid_headers["X-JAY-Acceptance"]
    invalid_headers["X-JAY-Acceptance"] = proof[:-1] + ("0" if proof[-1] != "0" else "1")
    status, invalid_fault, _ = function("ai-proxy", token_a, {
        **fault_body, "request_id": invalid_fault_id,
    }, headers=invalid_headers)
    expect(status == 403 and invalid_fault.get("error") == "ACCEPTANCE_SIGNATURE_INVALID",
           f"AI endpoint accepted a forged fault request: {status} {invalid_fault}")

    exception_checks = {
        "unauthorized": {"status": 401},
        "forbidden": {"status": 403, "error": "ORIGIN_NOT_ALLOWED"},
    }
    for scenario, expected_status, expected_error in (
        ("quota", 402, "AI_QUOTA_EXCEEDED"),
        ("provider_timeout", 504, "AI_PROVIDER_TIMEOUT"),
        ("rate_limit", 429, "AI_RATE_LIMITED"),
    ):
        fault_request_id = f"production-acceptance-{scenario}:{acceptance_run_id}"
        status, fault_result, response_headers = function("ai-proxy", token_a, {
            **fault_body, "request_id": fault_request_id,
        }, headers=acceptance_fault_headers(user_a, scenario, fault_request_id), timeout=30)
        expect(status == expected_status and fault_result.get("error") == expected_error,
               f"AI {scenario} acceptance returned the wrong contract: {status} {fault_result}")
        failure_log = expect_ai_failure_log(token_a, fault_request_id, expected_error)
        expect((failure_log.get("metadata") or {}).get("acceptance_scenario") == scenario,
               f"AI {scenario} failure log omitted acceptance metadata: {failure_log}")
        if scenario == "rate_limit":
            expect(str(response_headers.get("Retry-After") or "") == "60",
                   f"AI rate limit response omitted Retry-After: {dict(response_headers)}")
        if scenario == "provider_timeout":
            reservations = service_select_rows("ai_token_reservations", {
                "select": "request_id,status,reserved_tokens,actual_tokens",
                "user_id": f"eq.{user_a}",
                "request_id": f"eq.{fault_request_id}",
                "limit": "1",
            })
            expect(reservations and reservations[0].get("status") == "released",
                   f"AI timeout did not release its quota reservation: {reservations}")
        exception_checks[scenario] = {
            "status": expected_status,
            "error": expected_error,
            "request_id": fault_request_id,
            "logged": True,
        }

    report_content = build_server_validated_report_content(token_a, report_text)
    report = save_formal_report(
        token_a, user_a, workspace_a, f"production-acceptance-report:{acceptance_run_id}",
        "生产端到端验收报告", report_content, run["id"],
    )
    report_b = save_formal_report(
        token_b, user_b, workspace_b, f"production-acceptance-report-b:{acceptance_run_id}",
        "生产验收B隔离报告", report_content,
    )

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
    duplicate_export_checks = {}
    for name, extension, signature in (("report-export", "pdf", b"%PDF"), ("report-docx", "docx", b"PK")):
        export_key = reusable_export_key(fresh_a, report["id"], extension) or f"production-acceptance:{acceptance_run_id}:{user_a}:{extension}"
        export_payload = {
            "title": "生产端到端验收报告", "text": report_text, "report_id": report["id"],
            "request_id": f"production-acceptance-{extension}",
            "idempotency_key": export_key,
        }
        with ThreadPoolExecutor(max_workers=2) as executor:
            export_responses = list(executor.map(
                lambda _: function(name, fresh_a, export_payload),
                range(2),
            ))
        expect(all(response[0] in (200, 202) for response in export_responses),
               f"duplicate {extension} export failed: {export_responses}")
        export_ids = {str(response[1].get("id") or "") for response in export_responses}
        expect(len(export_ids) == 1 and "" not in export_ids,
               f"duplicate {extension} export created different jobs: {export_responses}")
        completed = [response[1] for response in export_responses if response[1].get("status") == "completed" and response[1].get("file_url")]
        expect(completed, f"{extension} export did not complete: {export_responses}")
        result = completed[0]
        idempotent_rows = select_rows("report_exports", fresh_a, {
            "select": "id,idempotency_key,status,file_path",
            "idempotency_key": f"eq.{export_key}",
            "limit": "10",
        })
        expect(len(idempotent_rows) == 1 and str(idempotent_rows[0].get("id")) in export_ids,
               f"duplicate {extension} export persisted {len(idempotent_rows)} jobs")
        file_status, file_body, _ = request("GET", result["file_url"], headers={})
        expect(file_status == 200 and file_body.startswith(signature), f"{extension} download is invalid")
        exported[extension] = result["id"]
        duplicate_export_checks[extension] = {
            "id": result["id"],
            "row_count": len(idempotent_rows),
            "duplicate_response": any(response[1].get("duplicate") is True for response in export_responses),
        }
        expect(duplicate_export_checks[extension]["duplicate_response"],
               f"duplicate {extension} export was not identified as a duplicate")
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

    # Collaboration lifecycle: a real invitation email is sent, B joins A's
    # workspace as an editor, shared data becomes visible, viewer writes are
    # rejected, and removal restores the original workspace boundary.
    invite_status, invitation, _ = function("workspace-invite", token_a, {
        "workspace_id": workspace_a,
        "email": email_b,
        "role": "editor",
        "request_id": f"workspace-invite:{acceptance_run_id}",
    })
    if invite_status != 200 or invitation.get("invitation", {}).get("delivery_status") != "sent":
        invite_id = str(invitation.get("invite_id") or "")
        delivery_rows = service_select_rows("workspace_invites", {
            "select": "delivery_status,delivery_provider,delivery_error",
            "id": f"eq.{invite_id}", "limit": "1",
        }) if invite_id else []
        raise AcceptanceError(
            f"workspace invitation email was not confirmed: {invite_status} {invitation}; "
            f"delivery={delivery_rows[:1]}"
        )
    expect(invite_status == 200 and invitation.get("invitation", {}).get("delivery_status") == "sent",
           f"workspace invitation email was not confirmed: {invite_status} {invitation}")
    invite_id = invitation["invitation"]["id"]
    accept_status, accepted_workspace, _ = rest(
        "POST", "rpc/accept_workspace_invite", token_b,
        body={"p_invite_id": invite_id}, prefer="return=representation",
    )
    expect(accept_status == 200 and str(accepted_workspace).strip('"') == workspace_a,
           f"account B could not accept workspace invitation: {accept_status} {accepted_workspace}")

    shared_memberships = select_rows("workspace_members", token_a, {
        "select": "id,role,status", "workspace_id": f"eq.{workspace_a}",
        "user_id": f"eq.{user_b}", "limit": "1",
    })
    expect(shared_memberships and shared_memberships[0].get("role") == "editor", "account B did not join as editor")
    shared_membership_id = shared_memberships[0]["id"]
    expect(select_rows("generated_reports", token_b, {"select": "id", "id": f"eq.{report['id']}"}),
           "workspace editor cannot read the shared report")
    expect(select_rows("report_materials", token_b, {"select": "id", "id": f"eq.{material['id']}"}),
           "workspace editor cannot read shared report material")
    expect(select_rows("saved_workspace_items", token_b, {"select": "id", "id": f"eq.{upload['id']}"}),
           "workspace editor cannot read shared workspace assets")

    shared_watch = upsert("user_watchlist", token_b, {
        "user_id": user_b, "workspace_id": workspace_a, "item_type": "country",
        "item_id": f"collaboration:{acceptance_run_id}", "item_name": "团队协作验收", "note": "editor write",
    }, "workspace_id,item_type,item_id")
    expect(select_rows("user_watchlist", token_a, {"select": "id", "id": f"eq.{shared_watch['id']}"}),
           "workspace owner cannot read editor-created watchlist row")

    shared_export_key = f"production-acceptance:{acceptance_run_id}:{user_b}:shared-pdf"
    shared_export_status, shared_export, _ = function("report-export", token_b, {
        "report_id": report["id"], "request_id": "production-acceptance-shared-pdf",
        "idempotency_key": shared_export_key,
    })
    expect(shared_export_status == 200 and shared_export.get("status") == "completed" and shared_export.get("file_url"),
           f"workspace editor cannot export shared report: {shared_export_status} {shared_export}")

    viewer_status, viewer_rows, _ = rest(
        "PATCH", "workspace_members", token_a,
        query=urllib.parse.urlencode({"id": f"eq.{shared_membership_id}"}),
        body={"role": "viewer"}, prefer="return=representation",
    )
    expect(viewer_status == 200 and viewer_rows and viewer_rows[0].get("role") == "viewer",
           f"cannot change collaborator to viewer: {viewer_status} {viewer_rows}")
    viewer_write_status, _, _ = rest("POST", "user_watchlist", token_b, body={
        "user_id": user_b, "workspace_id": workspace_a, "item_type": "country",
        "item_id": f"viewer-denied:{acceptance_run_id}", "item_name": "不得写入",
    })
    expect(viewer_write_status in (401, 403), f"viewer write was not rejected: HTTP {viewer_write_status}")
    expect(select_rows("generated_reports", token_b, {"select": "id", "id": f"eq.{report['id']}"}),
           "viewer lost read access to shared report")

    remove_status, _, _ = rest(
        "DELETE", "workspace_members", token_a,
        query=urllib.parse.urlencode({"id": f"eq.{shared_membership_id}"}), prefer="return=minimal",
    )
    expect(remove_status in (200, 204), f"cannot remove workspace collaborator: HTTP {remove_status}")
    expect(select_rows("generated_reports", token_b, {"select": "id", "id": f"eq.{report['id']}"}) == [],
           "removed member can still read shared report")
    expect(select_rows("report_materials", token_b, {"select": "id", "id": f"eq.{material['id']}"}) == [],
           "removed member can still read shared material")
    expect(select_rows("generated_reports", token_b, {"select": "id", "id": f"eq.{report_b['id']}"}),
           "removing B from A workspace affected B's owner workspace")

    status, logs, _ = rest("GET", "ai_request_logs", fresh_a, query=urllib.parse.urlencode({"select": "request_id,status,model,total_tokens,duration_ms", "request_id": f"eq.{ai_request_id}"}))
    expect(status == 200 and logs and logs[0]["status"] == "completed", "AI observability record is missing")

    result = {
        "status": "passed", "acceptance_run_id": acceptance_run_id, "site": SITE_URL,
        "api_workspace_id": workspace_a, "browser_workspace_id": workspace_b,
        "user_isolation": True, "workspace_collaboration": True, "report_id": report["id"],
        "report_run_id": run["id"], "exports": exported, "invite_id": invite_id,
        "shared_export_id": shared_export["id"], "reverse_export_id": b_export["id"], "ai_request_id": ai_request_id,
        "production_exceptions": {
            **exception_checks,
            "duplicate_generation": {"run_id": run["id"], "row_count": len(run_rows)},
            "duplicate_exports": duplicate_export_checks,
        },
        "release_sha": os.environ.get("RELEASE_SHA", ""),
        "checks": {
            "database": True,
            "storage_bucket": True,
            "storage_policy": True,
            "production_exceptions": True,
            "edge_functions": ["ai-proxy", "report-save", "report-export", "report-docx", "workspace-invite"],
        },
    }
    ACCEPTANCE_FINAL_STATE["status"] = "passed"
    ACCEPTANCE_FINAL_STATE["result_summary"] = {
        "acceptance_run_id": acceptance_run_id,
        "api_workspace_id": workspace_a,
        "browser_workspace_id": workspace_b,
        "report_id": report["id"],
        "report_run_id": run["id"],
        "exports": exported,
        "invite_id": invite_id,
        "checks": result["checks"],
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
        ACCEPTANCE_FINAL_STATE["status"] = "failed"
        ACCEPTANCE_FINAL_STATE["error_summary"] = {"code": "ACCEPTANCE_FAILED", "message": str(error)[:500]}
        print(f"[PRODUCTION ACCEPTANCE] FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
