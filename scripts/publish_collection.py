#!/usr/bin/env python3
"""发布 Worker 已完成采集的正式投影。

这是 Worker 允许执行的固定后处理脚本：先运行统一数据质量闸门，再运行
Supabase 同步。脚本不接受任意命令或路径，两个子进程共享 Worker 的
``COLLECTION_RUN_ID``。
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def run(script: str, *args: str) -> int:
    completed = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / script), *args],
        cwd=str(ROOT),
        env=os.environ.copy(),
        check=False,
    )
    return int(completed.returncode)


def main() -> int:
    translation_provider = os.environ.get("REGULATORY_TRANSLATION_PROVIDER", "api").strip().lower()
    if translation_provider == "api":
        translation_args = ("--require-config",)
    elif translation_provider == "argos":
        translation_args = ("--provider", "argos")
    else:
        print(
            "[publish] REGULATORY_TRANSLATION_PROVIDER must be api or argos",
            file=sys.stderr,
        )
        return 2
    translation = run("translate_regulatory_data.py", *translation_args)
    if translation != 0:
        print(f"[publish] regulatory translation failed (exit={translation})", file=sys.stderr)
        return translation
    alerts = run("generate_alerts.py")
    if alerts != 0:
        print(f"[publish] alert generation failed (exit={alerts})", file=sys.stderr)
        return alerts
    validation = run("validate_data.py")
    if validation != 0:
        print(f"[publish] quality gate blocked publication (exit={validation})", file=sys.stderr)
        return validation
    sync = run("sync_to_supabase.py")
    if sync != 0:
        print(f"[publish] Supabase sync failed (exit={sync})", file=sys.stderr)
    return sync


if __name__ == "__main__":
    raise SystemExit(main())
