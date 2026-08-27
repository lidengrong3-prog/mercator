#!/usr/bin/env python3
"""
sync_to_supabase.py — 数据同步到 Supabase

将仓库中的 JSON 数据文件同步到 Supabase 数据库，
使前端可以从 Supabase 读取实时数据（替代静态 JSON）。

支持增量同步：基于 updated_at 时间戳，只上传有变化的数据。

数据源:
  - data/countries.json → countries 表
  - data/policies.json → market_data(key='policies')
  - data/rules.json → market_data(key='rules')
  - data/alerts.json → market_data(key='alerts')
  - data/platforms.json → market_data(key='platforms')
  - data/countries.json → market_data(key='countries')
  - data/us_market/*.json remains a local/PDF dataset; it is not sent to a
    table that is absent from the production schema.

环境变量:
  SUPABASE_URL: Supabase 项目 URL
  SUPABASE_SERVICE_KEY: Supabase service_role key (需要写入权限)
  SUPABASE_SYNC_LEGACY_TABLES: set to 1 only for an explicitly provisioned
    legacy schema; defaults to the public market_data bundle only.

用法:
  python scripts/sync_to_supabase.py
  python scripts/sync_to_supabase.py --dry-run
  python scripts/sync_to_supabase.py --only us_market
"""

import json
import os
import sys
import urllib.request
import urllib.parse
import urllib.error
import ssl
import hashlib
from datetime import datetime, timezone

from validate_data import DEFAULT_REPORT, validate_all, write_report

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")
US_MARKET_DIR = os.path.join(DATA_DIR, "us_market")

try:
    SSL_CTX = ssl.create_default_context()
except Exception:
    SSL_CTX = None


def get_config():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        return None, None
    return url, key


def legacy_tables_enabled():
    """Return whether the optional legacy table fan-out was explicitly enabled."""
    return os.environ.get("SUPABASE_SYNC_LEGACY_TABLES", "").strip().lower() in {
        "1", "true", "yes", "on"
    }


def supabase_request(url, key, method="GET", data=None, timeout=30):
    """Make a Supabase REST API request."""
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=merge-duplicates",
    }
    
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        kwargs = {"timeout": timeout}
        if SSL_CTX:
            kwargs["context"] = SSL_CTX
        with urllib.request.urlopen(req, **kwargs) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")[:500]
        print(f"  [ERROR] HTTP {e.code}: {error_body}")
        return None
    except Exception as e:
        print(f"  [ERROR] Request failed: {e}")
        return None


def supabase_upsert(supa_url, key, table, rows, conflict_key="id"):
    """Upsert rows into a Supabase table."""
    if not rows:
        return 0
    
    url = f"{supa_url}/rest/v1/{table}"
    status = supabase_request(url, key, method="POST", data=rows)
    
    if status and status in (200, 201):
        return len(rows)
    else:
        print(f"  [WARN] Upsert to {table} returned status {status}")
        # Try batch upsert in smaller chunks
        if len(rows) > 10:
            chunk_size = 10
            total = 0
            for i in range(0, len(rows), chunk_size):
                chunk = rows[i:i+chunk_size]
                s = supabase_request(url, key, method="POST", data=chunk)
                if s and s in (200, 201):
                    total += len(chunk)
            return total
        return 0


def transform_policies(data):
    """Transform policies.json data for Supabase."""
    items = data.get("items", [])
    rows = []
    for item in items:
        row_id = item.get("id", hashlib.md5(item.get("title", "").encode()).hexdigest()[:12])
        rows.append({
            "id": f"pol-{row_id}",
            "category": item.get("category", ""),
            "title": item.get("title", ""),
            "region": item.get("region", ""),
            "summary": item.get("summary", ""),
            "impact_level": item.get("impact_level", "medium"),
            "source_url": item.get("source_url", ""),
            "published_at": item.get("published_at", ""),
            "effective_date": item.get("effective_date", ""),
            "raw_data": json.dumps(item, ensure_ascii=False),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return rows


def transform_rules(data):
    """Transform rules.json data for Supabase."""
    items = data.get("items", [])
    rows = []
    for item in items:
        row_id = item.get("id", hashlib.md5(item.get("title", "").encode()).hexdigest()[:12])
        rows.append({
            "id": f"rule-{row_id}",
            "title": item.get("title", ""),
            "market": item.get("market", ""),
            "platform": item.get("platform", ""),
            "detail": item.get("detail", ""),
            "severity": item.get("severity", "medium"),
            "source": item.get("source", ""),
            "source_url": item.get("source_url", ""),
            "raw_data": json.dumps(item, ensure_ascii=False),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return rows


def transform_alerts(data):
    """Transform alerts.json data for Supabase."""
    if isinstance(data, list):
        alerts = data
    else:
        alerts = data.get("alerts", data.get("items", []))
    rows = []
    for alert in alerts:
        if isinstance(alert, list) and len(alert) >= 8:
            # Array format from alertsFull: [id, type, level, title, country, platform, detail, date, read]
            row_id = alert[0]
            rows.append({
                "id": f"alert-{row_id}",
                "type": alert[1],
                "level": alert[2],
                "title": alert[3],
                "market": alert[4],
                "platform": alert[5],
                "detail": alert[6],
                "date": alert[7],
                "raw_data": json.dumps(alert, ensure_ascii=False),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        elif isinstance(alert, dict):
            row_id = alert.get("id", hashlib.md5(alert.get("title", "").encode()).hexdigest()[:12])
            rows.append({
                "id": f"alert-{row_id}",
                "type": alert.get("type", ""),
                "level": alert.get("level", ""),
                "title": alert.get("title", ""),
                "market": alert.get("market", alert.get("country", "")),
                "platform": alert.get("platform", ""),
                "detail": alert.get("detail", ""),
                "date": alert.get("date", ""),
                "raw_data": json.dumps(alert, ensure_ascii=False),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
    return rows


def transform_platforms(data):
    """Transform platforms.json data for Supabase."""
    if isinstance(data, list):
        platforms = data
    else:
        platforms = data.get("platforms", [])
    rows = []
    for p in platforms:
        row_id = hashlib.md5(p.get("name", "").encode()).hexdigest()[:12]
        rows.append({
            "id": f"plat-{row_id}",
            "name": p.get("name", ""),
            "type": p.get("type", ""),
            "market": p.get("market", ""),
            "commission": p.get("commission", ""),
            "feeDesc": p.get("feeDesc", ""),
            "raw_data": json.dumps(p, ensure_ascii=False),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return rows


def transform_us_market(filepath):
    """Transform a us_market/*.json file for Supabase."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return []
    
    cat_key = os.path.basename(filepath).replace(".json", "")
    rows = []
    
    # Store the entire category data as one row
    row_id = hashlib.md5(f"us_market_{cat_key}".encode()).hexdigest()[:12]
    rows.append({
        "id": f"usm-{row_id}",
        "category_key": cat_key,
        "market": data.get("meta", {}).get("market", ""),
        "data_json": json.dumps(data, ensure_ascii=False),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return rows


def load_json(path):
    """Load JSON file, return None on failure."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  [WARN] Cannot load {path}: {e}")
        return None


def build_market_data_rows(quality_report, only="all"):
    """Build the public KV rows consumed by the browser data layer."""
    specs = {
        "policies": "policies.json",
        "rules": "rules.json",
        "alerts": "alerts.json",
        "platforms": "platforms.json",
        "countries": "countries.json",
    }
    selected = set(specs) if only == "all" else {only}
    rows = []
    for key, filename in specs.items():
        if key not in selected:
            continue
        data = load_json(os.path.join(DATA_DIR, filename))
        if data is None:
            continue
        if key == "countries" and isinstance(data, dict):
            data = {name: value for name, value in data.items() if not name.startswith("_")}
        quality = quality_report.get("datasets", {}).get(key, {})
        rows.append({
            "key": key,
            "data": data,
            "meta": {
                "source": filename,
                "updated_at": quality.get("updated_at"),
                "quality_status": quality.get("status", "unknown"),
                "record_count": quality.get("records", 0),
            },
        })
    if only == "all":
        rows.append({
            "key": "quality_report",
            "data": quality_report,
            "meta": {
                "source": "quality_report.json",
                "updated_at": quality_report.get("generated_at"),
                "quality_status": quality_report.get("status", "unknown"),
            },
        })
    return rows


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Sync data to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually write to Supabase")
    parser.add_argument("--only", choices=["policies", "rules", "alerts", "platforms", "us_market", "all"],
                        default="all", help="Only sync specific data type")
    args = parser.parse_args()

    # Re-run the gate here so a manual sync cannot bypass the workflow check.
    quality_report = validate_all()
    write_report(quality_report, DEFAULT_REPORT)
    if not quality_report.get("publishable"):
        print(f"[SYNC] ERROR: data quality gate is {quality_report.get('status')}; refusing to publish")
        return 3
    
    supa_url, supa_key = get_config()
    
    if not supa_url or not supa_key:
        if args.dry_run:
            supa_url, supa_key = "https://dry-run.invalid", "dry-run"
        else:
            print("[SYNC] ERROR: SUPABASE_URL or SUPABASE_SERVICE_KEY not set")
            return 2
    
    if args.dry_run:
        print("[SYNC] DRY RUN MODE - no data will be written\n")
    
    summary = {
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": args.dry_run,
        "results": {},
    }
    failures = []
    
    # The production frontend reads the public market_data KV bundle. Legacy
    # fan-out is opt-in because older projects use different column names and
    # do not necessarily provision every category table.
    legacy_sync = legacy_tables_enabled()
    if legacy_sync:
        print("[SYNC] Legacy table fan-out enabled by SUPABASE_SYNC_LEGACY_TABLES")
    else:
        print("[SYNC] Legacy table fan-out disabled; publishing market_data bundle only")

    # Policies
    if legacy_sync and args.only in ("policies", "all"):
        print("[SYNC] Processing policies...")
        data = load_json(os.path.join(DATA_DIR, "policies.json"))
        if data:
            rows = transform_policies(data)
            print(f"  {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, "policies", rows)
                summary["results"]["policies"] = n
                print(f"  ✅ Synced {n} rows")
                if n != len(rows):
                    failures.append(f"policies: expected {len(rows)}, synced {n}")
    
    # Rules
    if legacy_sync and args.only in ("rules", "all"):
        print("[SYNC] Processing rules...")
        data = load_json(os.path.join(DATA_DIR, "rules.json"))
        if data:
            rows = transform_rules(data)
            print(f"  {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, "rules", rows)
                summary["results"]["rules"] = n
                print(f"  ✅ Synced {n} rows")
                if n != len(rows):
                    failures.append(f"rules: expected {len(rows)}, synced {n}")
    
    # Alerts
    if legacy_sync and args.only in ("alerts", "all"):
        print("[SYNC] Processing alerts...")
        data = load_json(os.path.join(DATA_DIR, "alerts.json"))
        if data:
            rows = transform_alerts(data)
            print(f"  {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, "alerts", rows)
                summary["results"]["alerts"] = n
                print(f"  ✅ Synced {n} rows")
                if n != len(rows):
                    failures.append(f"alerts: expected {len(rows)}, synced {n}")
    
    # Platforms
    if legacy_sync and args.only in ("platforms", "all"):
        print("[SYNC] Processing platforms...")
        data = load_json(os.path.join(DATA_DIR, "platforms.json"))
        if data:
            rows = transform_platforms(data)
            print(f"  {len(rows)} rows ready")
            if not args.dry_run and rows:
                n = supabase_upsert(supa_url, supa_key, "platforms", rows)
                summary["results"]["platforms"] = n
                print(f"  ✅ Synced {n} rows")
                if n != len(rows):
                    failures.append(f"platforms: expected {len(rows)}, synced {n}")
    
    # US Market data
    if legacy_sync and args.only in ("us_market", "all"):
        print("[SYNC] Processing US market data...")
        if os.path.exists(US_MARKET_DIR):
            total = 0
            expected_total = 0
            for fname in sorted(os.listdir(US_MARKET_DIR)):
                if fname.endswith(".json") and fname != "index.json":
                    rows = transform_us_market(os.path.join(US_MARKET_DIR, fname))
                    expected_total += len(rows)
                    if not args.dry_run and rows:
                        n = supabase_upsert(supa_url, supa_key, "us_market_data", rows)
                        total += n
            summary["results"]["us_market_data"] = total
            print(f"  ✅ Synced {total} category rows")
            if not args.dry_run and total != expected_total:
                failures.append(f"us_market_data: expected {expected_total}, synced {total}")

    # Public KV bundle used by the static frontend (Supabase-first, JSON fallback).
    print("[SYNC] Processing public market_data bundle...")
    market_rows = build_market_data_rows(quality_report, args.only)
    print(f"  {len(market_rows)} rows ready")
    if not args.dry_run and market_rows:
        n = supabase_upsert(supa_url, supa_key, "market_data", market_rows, conflict_key="key")
        summary["results"]["market_data"] = n
        print(f"  ✅ Synced {n} rows")
        if n != len(market_rows):
            failures.append(f"market_data: expected {len(market_rows)}, synced {n}")
    
    # Summary
    print(f"\n[SYNC] {'='*50}")
    print(f"[SYNC] Sync complete!")
    for table, count in summary["results"].items():
        print(f"  {table}: {count} rows")
    
    # Save sync log
    log_dir = os.path.join(DATA_DIR, "_sync_logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"sync_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json")
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"[SYNC] Log: {log_file}")
    if failures:
        print("[SYNC] ERROR: incomplete Supabase sync")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
