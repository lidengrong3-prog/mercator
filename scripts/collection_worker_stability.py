#!/usr/bin/env python3
"""Validate the evidence required before retiring the legacy collector."""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Mapping

try:
    from collection_worker import SupabaseClient, SupabaseRequestError, WorkerConfigurationError
except ModuleNotFoundError:  # Support importing as ``scripts.collection_worker_stability`` in tests.
    from .collection_worker import SupabaseClient, SupabaseRequestError, WorkerConfigurationError


DEFAULT_REQUIRED_HOURS = 24 * 7
DEFAULT_WINDOW_HOURS = DEFAULT_REQUIRED_HOURS + 1
DEFAULT_MAX_GAP_SECONDS = 300


def _count(mapping: Mapping[str, Any] | None, key: str) -> int:
    if not isinstance(mapping, Mapping):
        return 0
    try:
        return max(0, int(mapping.get(key) or 0))
    except (TypeError, ValueError):
        return 0


def evaluate_stability(
    evidence: Mapping[str, Any],
    health: Mapping[str, Any],
    *,
    window_hours: int = DEFAULT_WINDOW_HOURS,
    required_hours: int = DEFAULT_REQUIRED_HOURS,
    max_gap_seconds: int = DEFAULT_MAX_GAP_SECONDS,
) -> dict[str, Any]:
    required_coverage = max(1, int(required_hours)) * 3600
    dead_letters = _count(evidence.get("task_status_counts"), "dead_letter")
    current_dead_letters = _count(health, "dead_letter")
    checks = {
        "coverage_seconds": float(evidence.get("coverage_seconds") or 0) >= required_coverage,
        "single_boot": _count(evidence, "boot_count") == 1,
        "heartbeat_gap_within_limit": float(evidence.get("max_gap_seconds") or 0) <= max_gap_seconds,
        "duplicate_requests": _count(evidence, "duplicate_request_count") == 0,
        "duplicate_attempts": _count(evidence, "duplicate_attempt_count") == 0,
        "no_dead_letter": dead_letters == 0 and current_dead_letters == 0,
        "worker_currently_healthy": _count(health, "active_workers") > 0,
    }
    return {
        "status": "passed" if all(checks.values()) else "blocked",
        "window_hours": int(window_hours),
        "required_hours": int(required_hours),
        "required_coverage_seconds": required_coverage,
        "max_gap_limit_seconds": max_gap_seconds,
        "checks": checks,
        "evidence": dict(evidence),
        "health": {
            "active_workers": health.get("active_workers", 0),
            "dead_letter": health.get("dead_letter", 0),
            "queued": health.get("queued", 0),
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check seven-day Worker stability before legacy removal")
    parser.add_argument("--worker-id", default=os.environ.get("COLLECTION_WORKER_ID"))
    parser.add_argument("--window-hours", type=int, default=DEFAULT_WINDOW_HOURS)
    parser.add_argument("--required-hours", type=int, default=DEFAULT_REQUIRED_HOURS)
    parser.add_argument(
        "--max-gap-seconds",
        type=int,
        default=int(os.environ.get("COLLECTION_WORKER_MAX_HEARTBEAT_GAP_SECONDS", DEFAULT_MAX_GAP_SECONDS)),
    )
    parser.add_argument("--output", default="collection-worker-stability.json")
    args = parser.parse_args(argv)
    if args.required_hours < DEFAULT_REQUIRED_HOURS:
        parser.error("--required-hours must cover at least seven days")
    if args.window_hours <= args.required_hours:
        parser.error("--window-hours must exceed --required-hours so boundary heartbeats can prove coverage")
    if args.max_gap_seconds < 1:
        parser.error("--max-gap-seconds must be positive")
    try:
        client = SupabaseClient()
        evidence = client.runtime_evidence(args.worker_id, args.window_hours)
        health = client.health_check()
        result = evaluate_stability(
            evidence,
            health,
            window_hours=args.window_hours,
            required_hours=args.required_hours,
            max_gap_seconds=args.max_gap_seconds,
        )
    except (SupabaseRequestError, WorkerConfigurationError, OSError, ValueError) as error:
        result = {"status": "blocked", "error": str(error)}
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") == "passed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
