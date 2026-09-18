#!/usr/bin/env python3
"""Choose the scheduled collection path from a Worker health snapshot.

The scheduler must fail closed: an unreadable or stale health response routes
to the legacy collector instead of assuming that a replacement Worker exists.
The result is printed as sanitized JSON and, when running in GitHub Actions,
written to ``GITHUB_OUTPUT`` for the downstream job conditions.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Mapping


def _as_nonnegative_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def load_health(path: str | Path) -> tuple[dict[str, Any], str | None]:
    """Load a health response, returning a safe empty snapshot on failure."""

    try:
        with Path(path).open(encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, ValueError, TypeError) as error:
        return {}, f"health_read_failed:{type(error).__name__}"
    if not isinstance(value, dict):
        return {}, "health_payload_invalid"
    return value, None


def decide_route(
    health: Mapping[str, Any],
    *,
    cutover: bool,
    pilot_only: bool,
    event_name: str,
    health_error: str | None = None,
) -> dict[str, Any]:
    """Return the route and the evidence used to select it."""

    active_workers = _as_nonnegative_int(health.get("active_workers"))
    scheduled = event_name.strip().lower() == "schedule"
    worker_ready = health_error is None and active_workers is not None and active_workers > 0
    if worker_ready and cutover and not (pilot_only and scheduled):
        mode = "worker"
        reason = "cutover_enabled_and_worker_healthy"
    elif health_error is not None:
        mode = "legacy"
        reason = health_error
    elif not cutover:
        mode = "legacy"
        reason = "cutover_disabled"
    elif active_workers is None or active_workers <= 0:
        mode = "legacy"
        reason = "worker_unavailable"
    else:
        mode = "legacy"
        reason = "pilot_only_scheduled"
    return {
        "mode": mode,
        "worker_ready": worker_ready,
        "reason": reason,
        "cutover_requested": cutover,
        "pilot_only": pilot_only,
        "scheduled": scheduled,
        "active_workers": active_workers or 0,
        "queued": health.get("queued"),
        "dead_letter": health.get("dead_letter"),
        "health_error": health_error,
    }


def _write_github_output(result: Mapping[str, Any]) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT", "").strip()
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as handle:
        handle.write(f"worker_ready={'true' if result['worker_ready'] else 'false'}\n")
        handle.write(f"mode={result['mode']}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Route scheduled collection to Worker or legacy fallback")
    parser.add_argument("--health-file", required=True)
    parser.add_argument("--event-name", default=os.environ.get("EVENT_NAME", "schedule"))
    parser.add_argument("--cutover", default=os.environ.get("COLLECTION_WORKER_CUTOVER", "false"))
    parser.add_argument("--pilot-only", default=os.environ.get("COLLECTION_WORKER_PILOT_ONLY", "false"))
    parser.add_argument("--output", default="collection-routing-decision.json")
    args = parser.parse_args(argv)

    health, read_error = load_health(args.health_file)
    result = decide_route(
        health,
        cutover=str(args.cutover).strip().lower() == "true",
        pilot_only=str(args.pilot_only).strip().lower() == "true",
        event_name=args.event_name,
        health_error=read_error or ("health_response_error" if health.get("health_error") else None),
    )
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    _write_github_output(result)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
