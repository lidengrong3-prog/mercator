#!/usr/bin/env python3
"""Turn health, cost, capacity and collection signals into auditable incidents."""

from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


def env(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def request(base: str, key: str, path: str, *, method: str = "GET", body=None):
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    payload = None if body is None else json.dumps(body, ensure_ascii=False).encode()
    if payload is not None:
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=minimal"
    req = urllib.request.Request(f"{base.rstrip('/')}/rest/v1/{path}", data=payload, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read()
    return json.loads(raw.decode()) if raw else []


def incident(base: str, key: str, service: str, severity: str, title: str, detail: str) -> None:
    try:
        request(base, key, "system_incidents", method="POST", body={"service": service, "severity": severity, "status": "open", "title": title[:160], "detail": detail[:1000]})
    except Exception as error:
        print(f"[alerts] incident write failed: {type(error).__name__}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--health", default="production-health-result.json")
    args = parser.parse_args()
    base = env("SUPABASE_URL")
    key = env("SUPABASE_SERVICE_KEY")
    health = json.loads(Path(args.health).read_text(encoding="utf-8")) if Path(args.health).exists() else {}
    alerts: list[dict] = []
    for name in health.get("failed_components", []):
        alerts.append({"code": f"health_{name}", "severity": "critical", "title": f"{name} health check failed", "detail": str((health.get("components") or {}).get(name, {}).get("error_code") or "component failed")})
    capacity = ((health.get("components") or {}).get("capacity") or {}).get("capacity") or {}
    limits = {"database": int(env("DATABASE_CAPACITY_BYTES", "0") or 0), "storage": int(env("STORAGE_CAPACITY_BYTES", "0") or 0)}
    for label, key_name in (("database", "database_bytes"), ("storage", "storage_bytes")):
        if limits[label] > 0 and int(capacity.get(key_name) or 0) / limits[label] >= 0.8:
            alerts.append({"code": f"{label}_capacity", "severity": "critical", "title": f"{label} capacity above 80 percent", "detail": f"usage_bytes={capacity.get(key_name)}"})
    if base and key:
        since = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        try:
            ai = request(base, key, f"ai_request_logs?created_at=gte.{urllib.parse.quote(since)}&select=status,estimated_cost_usd")
            if ai:
                failure_rate = sum(1 for row in ai if row.get("status") == "failed") / len(ai)
                if failure_rate >= 0.10:
                    alerts.append({"code": "ai_failure_rate", "severity": "warning", "title": "AI failure rate above 10 percent", "detail": f"requests={len(ai)}"})
        except Exception:
            pass
        try:
            day_start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
            daily = request(base, key, "ai_request_logs?created_at=gte." + urllib.parse.quote(day_start) + "&select=estimated_cost_usd")
            cost = sum(float(row.get("estimated_cost_usd") or 0) for row in daily)
            if cost >= float(env("AI_DAILY_COST_USD", "25") or 25):
                alerts.append({"code": "ai_cost_usd", "severity": "warning", "title": "daily AI cost threshold exceeded", "detail": f"requests={len(daily)}"})
        except Exception:
            pass
        try:
            sync = request(base, key, "private_sync_runs?created_at=gte." + urllib.parse.quote(since) + "&select=status")
            if sync and sum(1 for row in sync if row.get("status") in ("failed", "partial")) / len(sync) >= 0.20:
                alerts.append({"code": "collection_failure_rate", "severity": "warning", "title": "data collection failures above 20 percent", "detail": f"runs={len(sync)}"})
        except Exception:
            pass
        try:
            latest = request(base, key, "private_data_artifacts?artifact_kind=eq.encrypted_backup&order=captured_at.desc&select=captured_at&limit=1")
            if latest:
                backup_at = datetime.fromisoformat(str(latest[0].get("captured_at")).replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - backup_at > timedelta(hours=30):
                    alerts.append({"code": "backup_age_hours", "severity": "critical", "title": "encrypted backup is older than 30 hours", "detail": "latest backup age exceeded threshold"})
        except Exception:
            pass
        try:
            latest_drill = request(base, key, "backup_restore_drills?status=eq.passed&order=completed_at.desc&select=completed_at&limit=1")
            if not latest_drill:
                alerts.append({"code": "restore_drill_age_days", "severity": "critical", "title": "no successful restore drill recorded", "detail": "run the monthly isolated restore drill"})
            else:
                drill_at = datetime.fromisoformat(str(latest_drill[0].get("completed_at")).replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - drill_at > timedelta(days=35):
                    alerts.append({"code": "restore_drill_age_days", "severity": "critical", "title": "restore drill is older than 35 days", "detail": "run the monthly isolated restore drill"})
        except Exception:
            pass
        for item in alerts:
            incident(base, key, "operations", item["severity"], item["title"], item["detail"])
    summary = {"status": "alerted" if alerts else "clear", "alert_count": len(alerts), "alerts": [{"code": item["code"], "severity": item["severity"]} for item in alerts], "checked_at": datetime.now(timezone.utc).isoformat()}
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
