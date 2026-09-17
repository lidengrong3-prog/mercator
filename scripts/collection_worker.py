#!/usr/bin/env python3
"""独立采集 Worker。

Worker 只执行本仓库登记的采集器，任务参数会被转换为固定的命令行参数，
不会执行数据库中任意的 shell 命令。任务状态、租约、预算和来源熔断均由
``20260920000000_collection_worker.sql`` 中的 RPC 负责。

常用命令：
  python scripts/collection_worker.py --once
  python scripts/collection_worker.py --max-tasks 10 --poll-seconds 15
  python scripts/collection_worker.py --health-check
"""

from __future__ import annotations

import argparse
import json
import os
import random
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LEASE_SECONDS = 900
DEFAULT_POLL_SECONDS = 30
MAX_DIAGNOSTIC_LENGTH = 1200


class WorkerConfigurationError(RuntimeError):
    """Worker 环境或任务配置无效。"""


class SupabaseRequestError(RuntimeError):
    """Supabase REST/RPC 请求失败。"""

    def __init__(self, method: str, path: str, status: int, detail: str):
        self.method = method
        self.path = path
        self.status = status
        super().__init__(f"Supabase {method} {path} HTTP {status}: {detail[:500]}")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat()


def _positive_int(value: Any, default: int, *, minimum: int = 0, maximum: int | None = None) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default
    result = max(result, minimum)
    if maximum is not None:
        result = min(result, maximum)
    return result


def _safe_text(value: Any, *, limit: int = MAX_DIAGNOSTIC_LENGTH) -> str:
    """截断并尽量移除环境变量中的密钥，避免把原始响应写入日志。"""
    text = str(value or "").strip()
    for name in ("SUPABASE_SERVICE_KEY", "SUPABASE_ANON_KEY", "TIKHUB_API_KEY", "FRED_API_KEY", "CENSUS_API_KEY"):
        secret = os.environ.get(name, "").strip()
        if secret:
            text = text.replace(secret, "[REDACTED]")
    return text[-limit:]


class SupabaseClient:
    """极小的 service-role REST 客户端，便于离线单元测试替换。"""

    def __init__(
        self,
        url: str | None = None,
        service_key: str | None = None,
        *,
        opener: Callable[..., Any] | None = None,
        request_timeout: int = 30,
    ):
        self.url = (url or os.environ.get("SUPABASE_URL", "")).strip().rstrip("/")
        self.service_key = (service_key or os.environ.get("SUPABASE_SERVICE_KEY", "")).strip()
        self.opener = opener or urllib.request.urlopen
        self.request_timeout = max(int(request_timeout), 1)
        if not self.url or not self.service_key:
            raise WorkerConfigurationError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required")

    def request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        body: Any = None,
        prefer: str = "return=representation",
    ) -> Any:
        query_string = urllib.parse.urlencode(query or {}, doseq=True)
        url = f"{self.url}/{path.lstrip('/')}" + (f"?{query_string}" if query_string else "")
        payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Prefer": prefer,
        }
        request = urllib.request.Request(url, data=payload, headers=headers, method=method.upper())
        try:
            with self.opener(request, timeout=self.request_timeout) as response:
                raw = response.read()
                if not raw:
                    return None
                try:
                    return json.loads(raw.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    return raw.decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise SupabaseRequestError(method.upper(), path, error.code, detail) from error
        except urllib.error.URLError as error:
            raise SupabaseRequestError(method.upper(), path, 0, str(error.reason)) from error

    def rpc(self, name: str, payload: Mapping[str, Any] | None = None) -> Any:
        return self.request("POST", f"rest/v1/rpc/{name}", body=dict(payload or {}))

    def claim_task(self, worker_id: str, lease_seconds: int) -> dict[str, Any] | None:
        result = self.rpc("claim_collection_task", {
            "p_worker_id": worker_id,
            "p_lease_seconds": lease_seconds,
        })
        if isinstance(result, list):
            return result[0] if result and isinstance(result[0], dict) else None
        return result if isinstance(result, dict) else None

    def renew_lease(self, task_id: str, worker_id: str, lease_seconds: int) -> bool:
        result = self.rpc("renew_collection_task_lease", {
            "p_task_id": task_id,
            "p_worker_id": worker_id,
            "p_lease_seconds": lease_seconds,
        })
        if isinstance(result, list):
            result = result[0] if result else False
        if isinstance(result, dict):
            return bool(result.get("renew_collection_task_lease", result.get("renewed", True)))
        return bool(result)

    def complete_task(self, task_id: str, worker_id: str, result_summary: Mapping[str, Any]) -> Any:
        return self.rpc("complete_collection_task", {
            "p_task_id": task_id,
            "p_worker_id": worker_id,
            "p_result_summary": dict(result_summary),
        })

    def fail_task(
        self,
        task_id: str,
        worker_id: str,
        error_code: str,
        error_message: str,
        backoff_seconds: int,
        retryable: bool,
    ) -> Any:
        return self.rpc("fail_collection_task", {
            "p_task_id": task_id,
            "p_worker_id": worker_id,
            "p_error_code": error_code,
            "p_error_message": error_message,
            "p_backoff_seconds": backoff_seconds,
            "p_retryable": retryable,
        })

    def reserve_budget(
        self,
        source_key: str,
        request_id: str,
        request_count: int,
        estimated_cost_usd: float,
    ) -> dict[str, Any]:
        result = self.rpc("reserve_collection_budget", {
            "p_source_key": source_key,
            "p_request_id": request_id,
            "p_request_count": request_count,
            "p_estimated_cost_usd": estimated_cost_usd,
        })
        if isinstance(result, list):
            result = result[0] if result else {}
        return result if isinstance(result, dict) else {"allowed": bool(result)}

    def record_source_outcome(self, source_key: str, success: bool, error_code: str | None = None) -> dict[str, Any]:
        result = self.rpc("record_collection_source_outcome", {
            "p_source_key": source_key,
            "p_success": success,
            "p_error_code": error_code,
        })
        if isinstance(result, list):
            result = result[0] if result else {}
        return result if isinstance(result, dict) else {}

    def insert_attempt(self, row: Mapping[str, Any]) -> Any:
        return self.request(
            "POST",
            "rest/v1/collection_task_attempts",
            body=[dict(row)],
            prefer="return=minimal,resolution=ignore-duplicates",
        )

    def source_policy(self, source_key: str) -> dict[str, Any] | None:
        rows = self.request(
            "GET",
            "rest/v1/collection_source_policies",
            query={"source_key": f"eq.{source_key}", "select": "*", "limit": "1"},
        )
        if isinstance(rows, list) and rows and isinstance(rows[0], dict):
            return rows[0]
        return None

    def successful_attempt(self, task_id: str) -> dict[str, Any] | None:
        rows = self.request(
            "GET",
            "rest/v1/collection_task_attempts",
            query={
                "task_id": f"eq.{task_id}",
                "status": "eq.succeeded",
                "select": "request_id,attempt_number,diagnostics,completed_at",
                "order": "attempt_number.desc",
                "limit": "1",
            },
        )
        if isinstance(rows, list) and rows and isinstance(rows[0], dict):
            return rows[0]
        return None

    def health_check(self) -> dict[str, Any]:
        result = self.rpc("get_collection_worker_health", {})
        if isinstance(result, list):
            result = result[0] if result else {}
        return result if isinstance(result, dict) else {}

    def heartbeat_worker(
        self,
        worker_id: str,
        status: str,
        *,
        deployment_id: str | None = None,
        release_id: str | None = None,
        current_task_id: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        result = self.rpc("heartbeat_collection_worker", {
            "p_worker_id": worker_id,
            "p_status": status,
            "p_deployment_id": deployment_id,
            "p_release_id": release_id,
            "p_current_task_id": current_task_id,
            "p_metadata": dict(metadata or {}),
        })
        if isinstance(result, list):
            result = result[0] if result else {}
        return result if isinstance(result, dict) else {}

    def dispatch_due_monitoring_tasks(self, limit: int = 100) -> dict[str, Any]:
        """Atomically turn due workspace monitoring intents into queue tasks."""
        result = self.rpc("dispatch_due_monitoring_tasks", {"p_limit": max(1, min(int(limit), 500))})
        if isinstance(result, list):
            result = result[0] if result else {}
        return result if isinstance(result, dict) else {"enqueued": 0, "blocked": 0, "task_keys": []}

    def record_monitoring_task_result(
        self, monitoring_task_id: str, status: str, error: str | None = None
    ) -> Any:
        return self.rpc("record_monitoring_task_result", {
            "p_monitoring_task_id": monitoring_task_id,
            "p_status": status,
            "p_error": _safe_text(error),
            "p_collected_at": iso_now(),
        })


# 只有这些脚本可以由数据库任务触发。脚本路径固定为仓库内的文件。
COLLECTOR_SCRIPTS: dict[str, str] = {
    "collect_data": "collect_data.py",
    "collect_us_taxes": "collect_us_regulatory.py",
    "collect_us_access": "collect_us_regulatory.py",
    "collect_us_market": "collect_us_market.py",
    "collect_cpsc": "collect_cpsc.py",
    "collect_us_macro": "collect_us_macro.py",
    "backfill_history": "backfill_history.py",
    "publish_formal": "publish_collection.py",
    "tikhub_pilot": "collect_tikhub_pilot.py",
    "tikhub_monitor": "collect_tikhub_pilot.py",
    "tikhub_content": "collect_tikhub_pilot.py",
}


def _string_param(parameters: Mapping[str, Any], name: str, *, max_length: int = 200) -> str | None:
    value = parameters.get(name)
    if value is None:
        return None
    value = str(value).strip()
    if not value or len(value) > max_length or any(char in value for char in "\x00\r\n"):
        raise WorkerConfigurationError(f"invalid task parameter: {name}")
    return value


def _int_param(parameters: Mapping[str, Any], name: str, *, minimum: int = 1, maximum: int = 1000000) -> int | None:
    if name not in parameters or parameters[name] in (None, ""):
        return None
    try:
        value = int(parameters[name])
    except (TypeError, ValueError) as error:
        raise WorkerConfigurationError(f"invalid integer task parameter: {name}") from error
    if not minimum <= value <= maximum:
        raise WorkerConfigurationError(f"task parameter out of range: {name}")
    return value


def build_collector_command(task: Mapping[str, Any], *, python_executable: str | None = None) -> list[str]:
    """将任务转换为白名单命令，不接受任意 command/shell 字段。"""
    collector_key = str(task.get("collector_key") or "").strip()
    script_name = COLLECTOR_SCRIPTS.get(collector_key)
    if not script_name:
        raise WorkerConfigurationError(f"collector is not allowlisted: {collector_key or '<empty>'}")
    parameters = task.get("parameters") if isinstance(task.get("parameters"), dict) else {}
    command = [python_executable or sys.executable, str(ROOT / "scripts" / script_name)]

    if collector_key in {"collect_data", "collect_us_market"}:
        category = _string_param(parameters, "category", max_length=80)
        if category:
            command += ["--category", category]
        if bool(parameters.get("no_network", False)):
            command.append("--no-network")
    elif collector_key in {"collect_us_taxes", "collect_us_access"}:
        command += ["--domain", "tax" if collector_key == "collect_us_taxes" else "access"]
        timeout = _int_param(parameters, "timeout", minimum=5, maximum=120)
        if timeout is not None:
            command += ["--timeout", str(timeout)]
    elif collector_key == "collect_cpsc":
        days = _int_param(parameters, "days", minimum=1, maximum=3650)
        start_date = _string_param(parameters, "from", max_length=10)
        end_date = _string_param(parameters, "to", max_length=10)
        page = _int_param(parameters, "page", minimum=1, maximum=1000000)
        per_page = _int_param(parameters, "per-page", minimum=1, maximum=10000)
        if days is not None:
            command += ["--days", str(days)]
        if start_date:
            command += ["--from", start_date]
        if end_date:
            command += ["--to", end_date]
        if page is not None:
            command += ["--page", str(page)]
        if per_page is not None:
            command += ["--per-page", str(per_page)]
        if bool(parameters.get("no_merge", False)):
            command.append("--no-merge")
    elif collector_key == "collect_us_macro":
        if bool(parameters.get("update_countries", False)):
            command.append("--update-countries")
    elif collector_key == "backfill_history":
        source = _string_param(parameters, "source", max_length=80)
        start_date = _string_param(parameters, "from", max_length=10)
        end_date = _string_param(parameters, "to", max_length=10)
        platform = _string_param(parameters, "platform", max_length=80)
        batch_size = _int_param(parameters, "batch-size", minimum=1, maximum=10000)
        cadence = _string_param(parameters, "cadence", max_length=10)
        job_id = _string_param(parameters, "job-id", max_length=100)
        if source:
            command += ["--source", source]
        if start_date:
            command += ["--from", start_date]
        if end_date:
            command += ["--to", end_date]
        if platform:
            command += ["--platform", platform]
        if batch_size is not None:
            command += ["--batch-size", str(batch_size)]
        if cadence:
            command += ["--cadence", cadence]
        if job_id:
            command += ["--job-id", job_id]
        if bool(parameters.get("resume", False)):
            command.append("--resume")
        if bool(parameters.get("dry-run", False)):
            command.append("--dry-run")
    elif collector_key == "publish_formal":
        # 发布脚本内部固定执行 validate_data.py -> sync_to_supabase.py，
        # 不从任务参数读取命令或文件路径。
        pass
    elif collector_key in {"tikhub_pilot", "tikhub_monitor", "tikhub_content"}:
        run_date = _string_param(parameters, "run-date", max_length=10)
        keywords_json = _string_param(parameters, "keywords-json", max_length=5000)
        monitoring_keyword = _string_param(parameters, "keyword", max_length=120)
        market_code = _string_param(parameters, "market-code", max_length=16)
        platform_key = _string_param(parameters, "platform", max_length=80)
        monitoring_type = _string_param(parameters, "monitoring-type", max_length=20)
        monitoring_task_id = _string_param(parameters, "monitoring-task-id", max_length=80)
        target_external_id = _string_param(parameters, "target-external-id", max_length=240)
        target_entity_id = _string_param(parameters, "target-entity-id", max_length=80)
        fixture = _string_param(parameters, "fixture", max_length=240)
        if fixture:
            # Fixtures are for offline verification only; do not let a queued
            # task turn the Worker into an arbitrary file reader.
            fixture_path = Path(fixture)
            if fixture_path.is_absolute() or ".." in fixture_path.parts:
                raise WorkerConfigurationError("fixture must be a relative path without '..'")
            command += ["--fixture", fixture]
        if run_date:
            command += ["--run-date", run_date]
        if keywords_json:
            command += ["--keywords-json", keywords_json]
        elif collector_key == "tikhub_monitor" and monitoring_keyword:
            command += ["--keywords-json", json.dumps([monitoring_keyword], ensure_ascii=False)]
        if market_code:
            command += ["--market-code", market_code]
        if platform_key:
            command += ["--platform", platform_key]
        if collector_key == "tikhub_monitor":
            if monitoring_type:
                command += ["--monitoring-type", monitoring_type]
            if monitoring_task_id:
                command += ["--monitoring-task-id", monitoring_task_id]
            if target_external_id:
                command += ["--target-external-id", target_external_id]
            if target_entity_id:
                command += ["--target-entity-id", target_entity_id]
            command.append("--monitoring")
        elif collector_key == "tikhub_content":
            command.append("--content")
        if bool(parameters.get("dry-run", False)):
            command.append("--dry-run")
        if bool(parameters.get("report", False)):
            command.append("--report")
    return command


class CollectionWorker:
    def __init__(
        self,
        client: SupabaseClient,
        *,
        worker_id: str | None = None,
        lease_seconds: int = DEFAULT_LEASE_SECONDS,
        poll_seconds: int = DEFAULT_POLL_SECONDS,
        process_runner: Callable[..., Any] | None = None,
        sleep_fn: Callable[[float], None] | None = None,
        random_fn: Callable[[], float] | None = None,
        python_executable: str | None = None,
    ):
        self.client = client
        self.worker_id = (worker_id or os.environ.get("COLLECTION_WORKER_ID") or f"worker-{uuid.uuid4().hex[:12]}").strip()
        if not self.worker_id:
            raise WorkerConfigurationError("COLLECTION_WORKER_ID must not be empty")
        self.lease_seconds = _positive_int(lease_seconds, DEFAULT_LEASE_SECONDS, minimum=30, maximum=86400)
        self.poll_seconds = _positive_int(poll_seconds, DEFAULT_POLL_SECONDS, minimum=1, maximum=3600)
        self.process_runner = process_runner or subprocess.run
        self.sleep_fn = sleep_fn or time.sleep
        self.random_fn = random_fn or random.random
        self.python_executable = python_executable
        self.deployment_id = os.environ.get("COLLECTION_WORKER_DEPLOYMENT_ID", "").strip() or None
        self.release_id = os.environ.get("COLLECTION_WORKER_RELEASE_ID", "").strip() or None
        self.runtime_metadata = {
            "runtime": "collection_worker.py",
            "browser_rules": str(os.environ.get("ENABLE_BROWSER_PLATFORM_RULES", "")).strip().lower()
                in {"1", "true", "yes"},
        }

    def _heartbeat(self, status: str, current_task_id: str | None = None) -> dict[str, Any]:
        recorder = getattr(self.client, "heartbeat_worker", None)
        if not callable(recorder):
            return {}
        try:
            return recorder(
                self.worker_id,
                status,
                deployment_id=self.deployment_id,
                release_id=self.release_id,
                current_task_id=current_task_id,
                metadata=self.runtime_metadata,
            )
        except Exception as error:
            # A missing/stale heartbeat keeps the legacy schedule active. The
            # queue lease remains authoritative for an already claimed task.
            print(json.dumps({
                "event": "worker_heartbeat_failed",
                "status": status,
                "error": _safe_text(error),
            }, ensure_ascii=False), flush=True)
            return {}

    def _backoff(self, policy: Mapping[str, Any], attempt_number: int) -> int:
        base = _positive_int(policy.get("backoff_base_seconds"), 60, minimum=1, maximum=86400)
        maximum = _positive_int(policy.get("backoff_max_seconds"), 3600, minimum=base, maximum=604800)
        delay = min(maximum, base * (2 ** max(attempt_number - 1, 0)))
        # 小幅抖动避免多个 Worker 在同一秒同时重试；范围可在测试中注入。
        return min(maximum, max(1, int(delay * (0.9 + self.random_fn() * 0.2))))

    def _policy_cost(self, task: Mapping[str, Any], policy: Mapping[str, Any]) -> tuple[int, float]:
        parameters = task.get("parameters") if isinstance(task.get("parameters"), dict) else {}
        # Queue parameters are JSON and historically used both hyphenated
        # and underscored names. Accept the old spelling during rollout, but
        # emit/use the canonical underscored form everywhere new tasks are
        # created.
        request_count = _positive_int(
            parameters.get("request_count", parameters.get("request-count")),
            1, minimum=1, maximum=1000000,
        )
        raw_cost = parameters.get("estimated_cost_usd", parameters.get("estimated-cost-usd"))
        if raw_cost is None:
            metadata = policy.get("metadata") if isinstance(policy.get("metadata"), dict) else {}
            raw_cost = metadata.get("default_estimated_cost_usd", 0)
        try:
            cost = max(0.0, float(raw_cost or 0))
        except (TypeError, ValueError) as error:
            raise WorkerConfigurationError("estimated_cost_usd must be numeric") from error
        return request_count, cost

    def _attempt_row(
        self,
        task: Mapping[str, Any],
        *,
        attempt_number: int,
        request_id: str,
        status: str,
        started_at: str,
        error_code: str | None = None,
        error_message: str | None = None,
        exit_code: int | None = None,
        estimated_cost_usd: float = 0,
        diagnostics: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "task_id": str(task["id"]),
            "attempt_number": attempt_number,
            "worker_id": self.worker_id,
            "request_id": request_id,
            "status": status,
            "exit_code": exit_code,
            "error_code": error_code,
            "error_message": _safe_text(error_message),
            "estimated_cost_usd": estimated_cost_usd,
            "started_at": started_at,
            "completed_at": iso_now(),
            "diagnostics": dict(diagnostics or {}),
        }

    def _renew_loop(self, task_id: str, stop_event: threading.Event) -> None:
        # Runtime presence expires after two minutes. Keep both the task lease
        # and instance heartbeat fresh during long collectors and publication.
        interval = max(5.0, min(self.lease_seconds / 3.0, 60.0))
        while not stop_event.wait(interval):
            try:
                renewed = self.client.renew_lease(task_id, self.worker_id, self.lease_seconds)
                if not renewed:
                    print(json.dumps({"event": "lease_lost", "task_id": task_id}, ensure_ascii=False), flush=True)
                    return
                self._heartbeat("busy", task_id)
            except Exception as error:  # 下一次循环继续尝试，任务完成时仍由数据库校验所有权。
                print(json.dumps({"event": "lease_renew_failed", "task_id": task_id, "error": _safe_text(error)}, ensure_ascii=False), flush=True)

    def _run_process(self, command: Sequence[str], *, timeout_seconds: int, task_id: str) -> tuple[int | None, str, str, str | None]:
        env = os.environ.copy()
        env["COLLECTION_RUN_ID"] = f"{self.worker_id}-{task_id}"
        env["PYTHONUNBUFFERED"] = "1"
        started = time.monotonic()
        try:
            completed = self.process_runner(
                list(command),
                cwd=str(ROOT),
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )
            return (
                int(getattr(completed, "returncode", 0)),
                _safe_text(getattr(completed, "stdout", "")),
                _safe_text(getattr(completed, "stderr", "")),
                None,
            )
        except subprocess.TimeoutExpired as error:
            elapsed = round(time.monotonic() - started, 2)
            return None, _safe_text(getattr(error, "stdout", "")), _safe_text(getattr(error, "stderr", "")), f"timeout after {elapsed}s"
        except OSError as error:
            return None, "", _safe_text(error), "process execution failed"

    def process_task(self, task: Mapping[str, Any]) -> dict[str, Any]:
        task_id = str(task.get("id") or "").strip()
        source_key = str(task.get("source_key") or "").strip()
        if not task_id or not source_key:
            raise WorkerConfigurationError("claimed task must contain id and source_key")
        attempt_number = _positive_int(task.get("attempt_count"), 1, minimum=1, maximum=1000)
        request_id = f"collection:{task_id}:{attempt_number}"
        started_at = iso_now()
        policy = self.client.source_policy(source_key) or {}
        parameters = task.get("parameters") if isinstance(task.get("parameters"), dict) else {}
        monitoring_task_id = str(parameters.get("monitoring-task-id") or "").strip()

        def record_monitoring(status: str, error: str | None = None) -> None:
            if not monitoring_task_id:
                return
            recorder = getattr(self.client, "record_monitoring_task_result", None)
            if not callable(recorder):
                return
            try:
                recorder(monitoring_task_id, status, error)
            except Exception as record_error:
                print(json.dumps({"event": "monitoring_status_failed", "monitoring_task_id": monitoring_task_id,
                                  "error": _safe_text(record_error)}, ensure_ascii=False), flush=True)

        # 进程可能在写入成功 attempt 后、完成任务状态前重启。先补完成，
        # 避免再次调用外部 API 并产生重复写入。
        prior_success = getattr(self.client, "successful_attempt", None)
        if callable(prior_success):
            previous = prior_success(task_id)
            if previous:
                previous_request_id = str(previous.get("request_id") or request_id)
                self.client.complete_task(task_id, self.worker_id, {
                    "status": "succeeded", "request_id": previous_request_id,
                    "recovered_after_restart": True,
                })
                record_monitoring("succeeded")
                return {"task_id": task_id, "status": "succeeded",
                        "request_id": previous_request_id, "recovered_after_restart": True}
        request_count, estimated_cost = self._policy_cost(task, policy)

        try:
            budget = self.client.reserve_budget(source_key, request_id, request_count, estimated_cost)
        except Exception as error:
            error_code = "BUDGET_RESERVATION_FAILED"
            message = _safe_text(error)
            self.client.insert_attempt(self._attempt_row(task, attempt_number=attempt_number, request_id=request_id,
                                                         status="failed", started_at=started_at,
                                                         error_code=error_code, error_message=message,
                                                         estimated_cost_usd=estimated_cost))
            self.client.fail_task(task_id, self.worker_id, error_code, message, self._backoff(policy, attempt_number), True)
            record_monitoring("failed", message)
            return {"task_id": task_id, "status": "failed", "error_code": error_code}

        if not bool(budget.get("allowed")):
            reason = str(budget.get("reason") or "BUDGET_BLOCKED")
            self.client.insert_attempt(self._attempt_row(task, attempt_number=attempt_number, request_id=request_id,
                                                         status="budget_blocked", started_at=started_at,
                                                         error_code=reason, error_message=reason,
                                                         estimated_cost_usd=estimated_cost,
                                                         diagnostics={"budget": {"reason": reason}}))
            self.client.fail_task(task_id, self.worker_id, reason, "collection budget blocked", 0, False)
            record_monitoring("failed", reason)
            return {"task_id": task_id, "status": "dead_letter", "error_code": reason}

        try:
            command = build_collector_command(task, python_executable=self.python_executable)
            timeout_seconds = _positive_int(policy.get("timeout_seconds"), 300, minimum=10, maximum=86400)
        except WorkerConfigurationError as error:
            code = "COLLECTOR_NOT_ALLOWED" if "allowlisted" in str(error) else "INVALID_TASK_PARAMETERS"
            message = _safe_text(error)
            self.client.insert_attempt(self._attempt_row(task, attempt_number=attempt_number, request_id=request_id,
                                                         status="failed", started_at=started_at,
                                                         error_code=code, error_message=message,
                                                         estimated_cost_usd=estimated_cost))
            self.client.fail_task(task_id, self.worker_id, code, message, 0, False)
            record_monitoring("failed", message)
            return {"task_id": task_id, "status": "dead_letter", "error_code": code}

        stop_event = threading.Event()
        renew_thread = threading.Thread(target=self._renew_loop, args=(task_id, stop_event), daemon=True)
        renew_thread.start()
        try:
            exit_code, stdout, stderr, process_error = self._run_process(command, timeout_seconds=timeout_seconds, task_id=task_id)
        finally:
            stop_event.set()
            renew_thread.join(timeout=2)

        if exit_code == 0 and process_error is None:
            source_result = self.client.record_source_outcome(source_key, True, None)
            diagnostics = {"stdout_tail": stdout, "stderr_tail": stderr}
            self.client.insert_attempt(self._attempt_row(task, attempt_number=attempt_number, request_id=request_id,
                                                         status="succeeded", started_at=started_at, exit_code=0,
                                                         estimated_cost_usd=estimated_cost, diagnostics=diagnostics))
            summary = {"status": "succeeded", "request_id": request_id, "exit_code": 0,
                       "source_outcome": source_result, "diagnostics": diagnostics}
            self.client.complete_task(task_id, self.worker_id, summary)
            record_monitoring("succeeded")
            return {"task_id": task_id, "status": "succeeded", "request_id": request_id}

        timed_out = process_error is not None and process_error.startswith("timeout")
        error_code = "TIMEOUT" if timed_out else ("PROCESS_ERROR" if process_error else "EXIT_NONZERO")
        message = process_error or (stderr or stdout or f"collector exited with code {exit_code}")
        source_result = self.client.record_source_outcome(source_key, False, error_code)
        diagnostics = {"stdout_tail": stdout, "stderr_tail": stderr,
                       "source_outcome": source_result}
        self.client.insert_attempt(self._attempt_row(task, attempt_number=attempt_number, request_id=request_id,
                                                     status="timed_out" if timed_out else "failed",
                                                     started_at=started_at, error_code=error_code,
                                                     error_message=message, exit_code=exit_code,
                                                     estimated_cost_usd=estimated_cost, diagnostics=diagnostics))
        publication_blocked = bool(policy.get("blocks_publication_on_failure"))
        summary = {"status": "failed", "request_id": request_id, "error_code": error_code,
                   "publication_blocked": publication_blocked,
                   "source_key": source_key}
        backoff = self._backoff(policy, attempt_number)
        self.client.fail_task(task_id, self.worker_id, error_code, message, backoff, True)
        record_monitoring("failed", message)
        print(json.dumps({"event": "task_failed", "task_id": task_id, "source_key": source_key,
                          "error_code": error_code, "publication_blocked": publication_blocked}, ensure_ascii=False), flush=True)
        return summary

    def run_once(self, *, max_tasks: int = 1) -> list[dict[str, Any]]:
        results = []
        dispatcher = getattr(self.client, "dispatch_due_monitoring_tasks", None)
        if callable(dispatcher):
            try:
                dispatch_summary = dispatcher(max(1, min(max_tasks * 20, 500)))
                if dispatch_summary and (dispatch_summary.get("enqueued") or dispatch_summary.get("blocked")):
                    print(json.dumps({"event": "monitoring_dispatch", **dispatch_summary}, ensure_ascii=False), flush=True)
            except Exception as error:
                # A monitoring dispatch outage must not stop ordinary source
                # collection; the next poll retries the due intents.
                print(json.dumps({"event": "monitoring_dispatch_failed", "error": _safe_text(error)}, ensure_ascii=False), flush=True)
        for _ in range(max(_positive_int(max_tasks, 1, minimum=1, maximum=1000), 1)):
            task = self.client.claim_task(self.worker_id, self.lease_seconds)
            if not task:
                break
            try:
                self._heartbeat("busy", str(task.get("id") or "") or None)
                results.append(self.process_task(task))
            except Exception as error:
                # RPC/数据库错误不能伪造完成状态；保留异常并让租约过期后恢复。
                result = {"task_id": str(task.get("id") or ""), "status": "worker_error",
                          "error_code": "WORKER_ERROR", "error": _safe_text(error)}
                results.append(result)
                print(json.dumps(result, ensure_ascii=False), flush=True)
            finally:
                self._heartbeat("ready")
        return results

    def run_forever(self, *, max_tasks_per_poll: int = 1) -> None:
        self._heartbeat("starting")
        while True:
            self._heartbeat("ready")
            results = self.run_once(max_tasks=max_tasks_per_poll)
            if not results:
                self.sleep_fn(self.poll_seconds)

    def health_check(self) -> dict[str, Any]:
        return self.client.health_check()


def _build_client_from_env() -> SupabaseClient:
    return SupabaseClient()


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Mercator independent collection worker")
    parser.add_argument("--once", action="store_true", help="领取并执行一批任务后退出")
    parser.add_argument("--max-tasks", type=int, default=1, help="每次轮询最多执行任务数")
    parser.add_argument("--poll-seconds", type=int, default=int(os.environ.get("COLLECTION_WORKER_POLL_SECONDS", DEFAULT_POLL_SECONDS)))
    parser.add_argument("--worker-id", default=os.environ.get("COLLECTION_WORKER_ID"))
    parser.add_argument("--lease-seconds", type=int, default=int(os.environ.get("COLLECTION_WORKER_LEASE_SECONDS", DEFAULT_LEASE_SECONDS)))
    parser.add_argument("--health-check", action="store_true", help="只输出队列和预算健康摘要")
    args = parser.parse_args(argv)
    worker = None
    try:
        client = _build_client_from_env()
        worker = CollectionWorker(client, worker_id=args.worker_id, lease_seconds=args.lease_seconds,
                                   poll_seconds=args.poll_seconds)
        if args.health_check:
            print(json.dumps(worker.health_check(), ensure_ascii=False, indent=2))
            return 0
        if args.once:
            results = worker.run_once(max_tasks=args.max_tasks)
            print(json.dumps({"worker_id": worker.worker_id, "processed": len(results), "results": results}, ensure_ascii=False))
            return 0
        if hasattr(signal, "SIGTERM"):
            def stop_worker(_signum, _frame):
                raise KeyboardInterrupt

            signal.signal(signal.SIGTERM, stop_worker)
        worker.run_forever(max_tasks_per_poll=max(args.max_tasks, 1))
    except KeyboardInterrupt:
        return 130
    except (WorkerConfigurationError, SupabaseRequestError, ValueError) as error:
        print(f"[collection-worker] {_safe_text(error)}", file=sys.stderr)
        return 2
    finally:
        if worker is not None and not args.health_check:
            worker._heartbeat("stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
