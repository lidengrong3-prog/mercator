#!/usr/bin/env python3
"""将采集任务安全地放入 Supabase 队列。

该脚本供 GitHub Actions 的紧急手动入口和运维人员使用。它只允许登记的
collector/source 组合，实际采集由独立 ``collection_worker.py`` 执行。
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Sequence

from collection_worker import SupabaseClient, SupabaseRequestError, WorkerConfigurationError
from market_scope import load_market_scope, resolve_market_scopes


TASK_SPECS: dict[str, dict[str, Any]] = {
    "collect_data": {
        "source_key": "federal-register", "collector_key": "collect_data", "domain": "policy",
        "market_codes": ["US"], "platform_keys": ["amazon", "tiktok-shop"], "priority": 900,
    },
    "collect_us_market": {
        "source_key": "federal-register", "collector_key": "collect_us_market", "domain": "market",
        "market_codes": ["US"], "platform_keys": ["amazon", "tiktok-shop"], "priority": 800,
    },
    "collect_cpsc": {
        "source_key": "cpsc", "collector_key": "collect_cpsc", "domain": "alert",
        "market_codes": ["US"], "platform_keys": [], "priority": 700,
    },
    "collect_us_macro": {
        "source_key": "macro-official", "collector_key": "collect_us_macro", "domain": "market",
        "market_codes": ["US"], "platform_keys": [], "priority": 600,
    },
    "backfill_history": {
        "source_key": "federal-register", "collector_key": "backfill_history", "domain": "policy",
        "market_codes": ["US"], "platform_keys": [], "priority": 500,
    },
    "publish_formal": {
        "source_key": "internal-system", "collector_key": "publish_formal", "domain": "platform",
        "market_codes": ["US"], "platform_keys": [], "priority": 100,
    },
    "tikhub_pilot": {
        "source_key": "tikhub", "collector_key": "tikhub_pilot", "domain": "product",
        "market_codes": ["US"], "platform_keys": ["tiktok-shop"], "priority": 650,
        "request_count": 80, "estimated_cost_usd": 4.0,
    },
    "tikhub_content": {
        "source_key": "tikhub", "collector_key": "tikhub_content", "domain": "content",
        "market_codes": ["US"], "platform_keys": ["tiktok-shop"], "priority": 640,
        "request_count": 80, "estimated_cost_usd": 4.0,
    },
}
DEFAULT_COLLECTORS = ("collect_data", "collect_us_market", "collect_cpsc", "collect_us_macro")


def enqueue(
    client: SupabaseClient,
    collectors: Sequence[str],
    *,
    parameters: dict[str, Any] | None = None,
    priority_offset: int = 0,
    run_id: str | None = None,
    dry_run: bool = False,
) -> list[dict[str, Any]]:
    run_id = run_id or f"manual-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    params = dict(parameters or {})
    rows = []
    for collector in collectors:
        key = str(collector).strip()
        if key not in TASK_SPECS:
            raise WorkerConfigurationError(f"collector is not allowed for enqueue: {key or '<empty>'}")
        spec = TASK_SPECS[key]
        scope_rows = [None]
        if key in {"tikhub_pilot", "tikhub_content"}:
            # Discover every active launch-market/platform relation.  Only
            # configured scopes become executable Worker tasks; schema-only
            # markets remain visible through the collector's coverage report.
            requested_markets = params.get("market_codes") if isinstance(params.get("market_codes"), list) else None
            requested_platforms = params.get("platform_keys") if isinstance(params.get("platform_keys"), list) else None
            scope_rows = [scope for scope in resolve_market_scopes(
                load_market_scope(), market_codes=requested_markets, platform_keys=requested_platforms
            ) if scope.get("executable")]
            if not scope_rows:
                raise WorkerConfigurationError("no configured launch market is available for TikHub")
        for scope in scope_rows:
            row_parameters = dict(params)
            row_market_codes = spec["market_codes"]
            row_platform_keys = spec["platform_keys"]
            suffix = key
            if scope:
                row_market_codes = [scope["market_code"]]
                row_platform_keys = [scope["platform_key"]]
                row_parameters["market-code"] = scope["market_code"]
                row_parameters["platform"] = scope["platform_key"]
                suffix = f"{key}:{scope['market_code'].lower()}:{scope['platform_key']}"
                # One day is exactly 20 keywords x 4 registered endpoints.
                row_parameters.setdefault("request_count", int(spec["request_count"]))
                row_parameters.setdefault("estimated_cost_usd", float(spec["estimated_cost_usd"]))
            row = {
                "task_key": f"{run_id}:{suffix}",
                "source_key": spec["source_key"],
                "collector_key": spec["collector_key"],
                "domain": spec["domain"],
                "market_codes": row_market_codes,
                "platform_keys": row_platform_keys,
                "parameters": row_parameters,
                "depends_on_task_keys": [],
                "priority": max(0, min(100000, int(spec["priority"]) + int(priority_offset))),
                "run_after": datetime.now(timezone.utc).isoformat(),
            }
            rows.append(row)
    # 发布任务依赖本批次所有采集任务，核心来源失败时它会一直停留在队列中。
    if "publish_formal" not in collectors:
        collector_rows = [row for row in rows if row["collector_key"] != "publish_formal"]
        if collector_rows:
            publish_markets = sorted({market for row in collector_rows for market in row.get("market_codes", [])})
            publish_platforms = sorted({platform for row in collector_rows for platform in row.get("platform_keys", [])})
            rows.append({
                "task_key": f"{run_id}:publish_formal",
                "source_key": TASK_SPECS["publish_formal"]["source_key"],
                "collector_key": "publish_formal",
                "domain": TASK_SPECS["publish_formal"]["domain"],
                "market_codes": publish_markets or TASK_SPECS["publish_formal"]["market_codes"],
                "platform_keys": publish_platforms, "parameters": {},
                "depends_on_task_keys": [row["task_key"] for row in collector_rows],
                "priority": TASK_SPECS["publish_formal"]["priority"],
                "run_after": datetime.now(timezone.utc).isoformat(),
            })
    if not dry_run and rows:
        client.request(
            "POST", "rest/v1/collection_tasks",
            body=rows,
            prefer="return=representation,resolution=ignore-duplicates",
        )
    return rows


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Enqueue allowlisted collection tasks")
    parser.add_argument("--collector", action="append", dest="collectors", help="采集器 key，可重复；默认全部")
    parser.add_argument("--parameters-json", default="{}", help="受支持采集参数 JSON 对象")
    parser.add_argument("--priority-offset", type=int, default=0)
    parser.add_argument("--run-id", help="幂等任务批次 ID")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    collectors = args.collectors or list(DEFAULT_COLLECTORS)
    try:
        parameters = json.loads(args.parameters_json)
        if not isinstance(parameters, dict):
            raise ValueError("--parameters-json must be an object")
        client = None if args.dry_run else SupabaseClient()
        rows = enqueue(client, collectors, parameters=parameters, priority_offset=args.priority_offset,
                       run_id=args.run_id, dry_run=args.dry_run)
        print(json.dumps({"dry_run": args.dry_run, "enqueued": len(rows),
                          "task_keys": [row["task_key"] for row in rows]}, ensure_ascii=False))
        return 0
    except (SupabaseRequestError, WorkerConfigurationError, ValueError, TypeError) as error:
        print(f"[enqueue] {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
