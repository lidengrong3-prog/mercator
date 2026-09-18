#!/usr/bin/env python3
"""Run one guarded collection-Worker cutover pilot.

This command is intentionally narrower than the normal scheduler: exactly one
allowlisted collector is enqueued, followed by the fixed publication task that
``enqueue`` adds for that batch. It is safe to rerun with the same run ID and
fails closed unless the production cutover flag and Worker heartbeat are both
healthy.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from collection_worker import SupabaseClient, SupabaseRequestError, WorkerConfigurationError
from enqueue_collection_tasks import TASK_SPECS, enqueue


PILOT_COLLECTORS = tuple(
    key for key in TASK_SPECS
    if key != "publish_formal"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _task(client: SupabaseClient, task_key: str) -> dict[str, Any] | None:
    rows = client.request(
        "GET",
        "rest/v1/collection_tasks",
        query={"task_key": f"eq.{task_key}", "select": "*", "limit": "1"},
    )
    if isinstance(rows, list) and rows and isinstance(rows[0], dict):
        return rows[0]
    return None


def _attempts(client: SupabaseClient, task_id: str) -> list[dict[str, Any]]:
    rows = client.request(
        "GET",
        "rest/v1/collection_task_attempts",
        query={
            "task_id": f"eq.{task_id}",
            "select": "request_id,attempt_number,status,worker_id,started_at,completed_at",
            "order": "attempt_number.asc",
            "limit": "100",
        },
    )
    return [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []


def _snapshot(client: SupabaseClient, task_keys: Sequence[str]) -> list[dict[str, Any]]:
    rows = []
    for task_key in task_keys:
        row = _task(client, task_key)
        if row is not None:
            rows.append(row)
    return rows


def _validate_attempts(client: SupabaseClient, rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    evidence: dict[str, Any] = {}
    for row in rows:
        task_id = str(row.get("id") or "")
        attempts = _attempts(client, task_id) if task_id else []
        request_ids = [str(item.get("request_id") or "") for item in attempts]
        attempt_keys = [
            f"{item.get('task_id', task_id)}:{item.get('attempt_number')}"
            for item in attempts
        ]
        if len(request_ids) != len(set(request_ids)):
            raise RuntimeError(f"duplicate request IDs for task {row.get('task_key')}")
        if len(attempt_keys) != len(set(attempt_keys)):
            raise RuntimeError(f"duplicate attempt numbers for task {row.get('task_key')}")
        successful = [item for item in attempts if item.get("status") == "succeeded"]
        if row.get("status") == "succeeded" and len(successful) != 1:
            raise RuntimeError(
                f"task {row.get('task_key')} has {len(successful)} succeeded attempts; expected exactly one"
            )
        evidence[str(row.get("task_key"))] = {
            "task_id": task_id,
            "attempt_count": len(attempts),
            "request_ids": request_ids,
            "statuses": [item.get("status") for item in attempts],
        }
    return evidence


def run_pilot(
    client: SupabaseClient,
    collector: str,
    *,
    parameters: Mapping[str, Any] | None = None,
    run_id: str,
    timeout_seconds: int = 1800,
    poll_seconds: int = 15,
) -> dict[str, Any]:
    started_at = _now()
    if collector not in PILOT_COLLECTORS:
        raise WorkerConfigurationError(f"pilot collector is not allowlisted: {collector}")
    if os.environ.get("COLLECTION_WORKER_CUTOVER", "").strip().lower() != "true":
        raise WorkerConfigurationError("COLLECTION_WORKER_CUTOVER must be true for the pilot")

    health = client.health_check()
    active_workers = int(health.get("active_workers") or 0)
    if active_workers < 1:
        raise RuntimeError("no active Worker heartbeat; pilot refuses to enqueue")

    rows = enqueue(client, [collector], parameters=dict(parameters or {}), run_id=run_id)
    task_keys = [str(row["task_key"]) for row in rows]
    if len(rows) != 2 or not any(row["collector_key"] == "publish_formal" for row in rows):
        raise RuntimeError("pilot batch must contain one collector and one publish_formal task")

    deadline = time.monotonic() + max(30, int(timeout_seconds))
    last_rows: list[dict[str, Any]] = []
    while True:
        last_rows = _snapshot(client, task_keys)
        if len(last_rows) != len(task_keys):
            if time.monotonic() >= deadline:
                raise TimeoutError(f"timed out waiting for pilot tasks to appear: {task_keys}")
        else:
            terminal = {str(row.get("status")) for row in last_rows}
            failed = [row for row in last_rows if row.get("status") in {"dead_letter", "cancelled"}]
            if failed:
                raise RuntimeError(json.dumps({"pilot_tasks_failed": failed}, ensure_ascii=False))
            if terminal == {"succeeded"}:
                break
        if time.monotonic() >= deadline:
            raise TimeoutError(json.dumps({"pilot_tasks": last_rows}, ensure_ascii=False))
        time.sleep(max(1, int(poll_seconds)))

    attempt_evidence = _validate_attempts(client, last_rows)
    final_health = client.health_check()
    if int(final_health.get("dead_letter") or 0) > 0:
        raise RuntimeError("dead-letter tasks exist after pilot completion")
    return {
        "status": "succeeded",
        "run_id": run_id,
        "collector": collector,
        "started_at": started_at,
        "completed_at": _now(),
        "active_workers_before": active_workers,
        "task_keys": task_keys,
        "tasks": [
            {
                "task_key": row.get("task_key"),
                "collector_key": row.get("collector_key"),
                "status": row.get("status"),
                "attempt_count": row.get("attempt_count"),
                "result_status": (row.get("result_summary") or {}).get("status"),
                "result_request_id": (row.get("result_summary") or {}).get("request_id"),
                "publication_blocked": (row.get("result_summary") or {}).get("publication_blocked"),
            }
            for row in last_rows
        ],
        "attempt_evidence": attempt_evidence,
        "health_after": final_health,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a guarded single-source collection Worker pilot")
    parser.add_argument("--collector", required=True, choices=PILOT_COLLECTORS)
    parser.add_argument("--parameters-json", default="{}")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    parser.add_argument("--poll-seconds", type=int, default=15)
    parser.add_argument("--output", default="collection-worker-pilot-result.json")
    args = parser.parse_args(argv)
    try:
        if os.environ.get("COLLECTION_WORKER_CUTOVER", "").strip().lower() != "true":
            raise WorkerConfigurationError("COLLECTION_WORKER_CUTOVER must be true for the pilot")
        parameters = json.loads(args.parameters_json)
        if not isinstance(parameters, dict):
            raise ValueError("--parameters-json must be an object")
        result = run_pilot(
            SupabaseClient(), args.collector, parameters=parameters, run_id=args.run_id,
            timeout_seconds=args.timeout_seconds, poll_seconds=args.poll_seconds,
        )
        with open(args.output, "w", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (SupabaseRequestError, WorkerConfigurationError, RuntimeError, TimeoutError, ValueError, TypeError) as error:
        print(f"[collection-worker-pilot] {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
