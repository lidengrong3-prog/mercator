#!/usr/bin/env python3
"""Evaluate the durable 24-hour R10 Worker acceptance evidence."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Mapping

try:
    from collection_worker import SupabaseClient, SupabaseRequestError, WorkerConfigurationError
except ModuleNotFoundError:
    from .collection_worker import SupabaseClient, SupabaseRequestError, WorkerConfigurationError


DEFAULT_REQUIRED_HOURS = 24
DEFAULT_WINDOW_HOURS = 25
DEFAULT_MAX_GAP_SECONDS = 300


def _count(mapping: Mapping[str, Any] | None, key: str) -> int:
    if not isinstance(mapping, Mapping):
        return 0
    try:
        return max(0, int(mapping.get(key) or 0))
    except (TypeError, ValueError):
        return 0


def evaluate_r10_acceptance(
    evidence: Mapping[str, Any],
    health: Mapping[str, Any],
    *,
    required_hours: int = DEFAULT_REQUIRED_HOURS,
    max_gap_seconds: int = DEFAULT_MAX_GAP_SECONDS,
) -> dict[str, Any]:
    required_coverage = max(1, int(required_hours)) * 3600
    coverage = float(evidence.get("coverage_seconds") or 0)
    heartbeat_count = _count(evidence, "heartbeat_count")
    dead_letters = _count(evidence.get("task_status_counts"), "dead_letter")
    current_dead_letters = _count(health, "dead_letter")
    checks = {
        "protocol_v2_evidence_present": int(evidence.get("protocol_version") or 0) == 2 and heartbeat_count > 0,
        "coverage_seconds": coverage >= required_coverage,
        "heartbeat_gap_within_limit": float(evidence.get("max_gap_seconds") or 0) <= max_gap_seconds,
        "duplicate_requests": _count(evidence, "duplicate_request_count") == 0,
        "duplicate_attempts": _count(evidence, "duplicate_attempt_count") == 0,
        "no_unexplained_terminal_failure": dead_letters == 0 and current_dead_letters == 0,
        "r10_worker_currently_ready": _count(health, "r10_ready_workers") > 0,
    }
    if all(checks.values()):
        status = "passed"
    elif not checks["coverage_seconds"] and (
        heartbeat_count == 0 or _count(health, "active_workers") > 0
    ):
        status = "observing"
    else:
        status = "failed"
    return {
        "status": status,
        "required_hours": int(required_hours),
        "required_coverage_seconds": required_coverage,
        "max_gap_limit_seconds": int(max_gap_seconds),
        "checks": checks,
        "evidence": dict(evidence),
        "health": {
            "active_workers": health.get("active_workers", 0),
            "r10_ready_workers": health.get("r10_ready_workers", 0),
            "queued": health.get("queued", 0),
            "leased": health.get("leased", 0),
            "dead_letter": health.get("dead_letter", 0),
            "budget_blocked": health.get("budget_blocked", 0),
            "open_circuits": health.get("open_circuits", []),
            "half_open_circuits": health.get("half_open_circuits", []),
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Evaluate R10 Worker 24-hour production evidence")
    parser.add_argument("--worker-id", default=os.environ.get("COLLECTION_WORKER_ID"))
    parser.add_argument("--window-hours", type=int, default=DEFAULT_WINDOW_HOURS)
    parser.add_argument("--required-hours", type=int, default=DEFAULT_REQUIRED_HOURS)
    parser.add_argument(
        "--max-gap-seconds",
        type=int,
        default=int(os.environ.get("COLLECTION_WORKER_MAX_HEARTBEAT_GAP_SECONDS", DEFAULT_MAX_GAP_SECONDS)),
    )
    parser.add_argument("--require-passed", action="store_true")
    parser.add_argument("--output", default="collection-worker-r10-acceptance.json")
    args = parser.parse_args(argv)
    if args.required_hours < DEFAULT_REQUIRED_HOURS:
        parser.error("--required-hours must be at least 24")
    if args.window_hours <= args.required_hours:
        parser.error("--window-hours must exceed --required-hours")
    if args.max_gap_seconds < 1:
        parser.error("--max-gap-seconds must be positive")

    try:
        client = SupabaseClient()
        evidence = client.runtime_evidence(args.worker_id, args.window_hours)
        health = client.health_check()
        result = evaluate_r10_acceptance(
            evidence,
            health,
            required_hours=args.required_hours,
            max_gap_seconds=args.max_gap_seconds,
        )
    except (SupabaseRequestError, WorkerConfigurationError, OSError, ValueError) as error:
        result = {"status": "failed", "error": str(error)}

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result.get("status") == "failed" or (args.require_passed and result.get("status") != "passed"):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
