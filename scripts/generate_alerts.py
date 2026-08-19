#!/usr/bin/env python3
"""
generate_alerts.py — 动态预警生成器

基于已采集的数据（政策、召回、宏观指标变化）自动生成预警条目，
更新 data/alerts.json，供前端预警中心展示。

预警来源：
  1. CPSC 中国产品召回 → policy 类型预警
  2. 宏观指标异常变化 → macro 类型预警
  3. Federal Register 新政策 → policy 类型预警
  4. 关税变化追踪 → tariff 预警

用法:
  python scripts/generate_alerts.py
  python scripts/generate_alerts.py --max-alerts 50
"""

import json
import os
import hashlib
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")
US_MARKET_DIR = os.path.join(DATA_DIR, "us_market")
ALERTS_FILE = os.path.join(DATA_DIR, "alerts.json")

BJT = timezone(timedelta(hours=8))
NOW = datetime.now(BJT)
TODAY = NOW.strftime("%Y-%m-%d")


def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def gen_id(prefix, text):
    h = hashlib.md5(text.encode()).hexdigest()[:8]
    return f"{prefix}-{TODAY.replace('-','')}-{h}"


def generate_from_cpsc():
    """Generate alerts from CPSC recall data."""
    alerts = []
    
    cpsc_data = load_json(os.path.join(US_MARKET_DIR, "cpsc_recalls.json"))
    if not cpsc_data:
        return alerts
    
    # Recent China-related recalls (last 90 days)
    cutoff = (NOW - timedelta(days=90)).strftime("%Y-%m-%d")
    
    for recall in cpsc_data.get("china_related", []):
        date = recall.get("date", "")
        if date >= cutoff or not date:
            cat = recall.get("category", "other")
            category_names = {
                "electronics": "消费电子", "apparel": "服饰鞋包",
                "home": "家居厨具", "beauty": "美妆个护",
                "toys": "玩具", "sports": "运动户外",
                "auto": "汽配", "health": "保健品", "other": "其他",
            }
            cat_cn = category_names.get(cat, cat)
            
            alerts.append({
                "id": recall.get("id", gen_id("cpsc", recall.get("title", ""))),
                "type": "policy",
                "level": "high",
                "title": f"CPSC 召回: {recall.get('title', '中国产品')[:60]}",
                "market": "美国",
                "platform": "CPSC",
                "detail": f"美国 CPSC 发布产品召回，涉及中国产品。品类: {cat_cn}。{recall.get('description', '')[:200]}",
                "date": date or TODAY,
                "read": False,
                "source": "CPSC Recall API",
                "url": recall.get("url", "https://www.cpsc.gov/cpscrecall/reportapi"),
            })
    
    # Category summary alerts
    by_cat = cpsc_data.get("by_category", {})
    for cat, recalls in by_cat.items():
        china_count = sum(1 for r in recalls if r.get("china_related"))
        if china_count >= 3:
            category_names = {
                "electronics": "消费电子", "apparel": "服饰鞋包",
                "home": "家居厨具", "beauty": "美妆个护",
                "toys": "玩具", "sports": "运动户外",
                "auto": "汽配", "health": "保健品", "other": "其他",
            }
            cat_cn = category_names.get(cat, cat)
            alerts.append({
                "id": gen_id("cpsc-cat", f"{cat}-{TODAY}"),
                "type": "policy",
                "level": "high",
                "title": f"⚠️ {cat_cn}品类: 近90天{china_count}起中国产品召回",
                "market": "美国",
                "platform": "CPSC",
                "detail": f"过去90天内，{cat_cn}品类有{china_count}起涉及中国产品的召回记录。建议检查产品合规性，确保符合 CPSC 安全标准。",
                "date": TODAY,
                "read": False,
                "source": "CPSC 数据分析",
            })
    
    return alerts


def generate_from_policies():
    """Generate alerts from recently collected policy data."""
    alerts = []
    
    policies_data = load_json(os.path.join(DATA_DIR, "policies.json"))
    if not policies_data:
        return alerts
    
    items = policies_data.get("items", [])
    cutoff = (NOW - timedelta(days=30)).strftime("%Y-%m-%d")
    
    us_keywords = ["united states", "us ", "american", "u.s.", "tariff", "section 301",
                   "china", "chinese", "import duty", "customs", "cbp", "ftc",
                   "cpsc", "fda", "fcc", "federal register"]
    
    for item in items:
        pub_date = item.get("published_at", "") or item.get("effective_date", "")
        if pub_date < cutoff:
            continue
        
        # Check if US-related
        text = json.dumps(item, ensure_ascii=False).lower()
        is_us = any(kw in text for kw in us_keywords)
        
        if is_us and item.get("impact_level") == "high":
            region = item.get("region", "US")
            if region not in ("US", "Global"):
                continue
            
            alerts.append({
                "id": gen_id("pol", item.get("title", "")[:30]),
                "type": "policy",
                "level": "high",
                "title": f"政策更新: {item.get('title', '新政策')[:60]}",
                "market": "美国",
                "platform": item.get("category", "政策"),
                "detail": item.get("summary", "")[:300],
                "date": pub_date[:10] if pub_date else TODAY,
                "read": False,
                "source": "Federal Register / 政策分析",
                "url": item.get("source_url", ""),
            })
    
    return alerts


def generate_from_us_market():
    """Generate alerts from us_market data files."""
    alerts = []
    
    if not os.path.exists(US_MARKET_DIR):
        return alerts
    
    category_names = {
        "electronics": "消费电子", "apparel": "服饰鞋包",
        "home_cooking": "家居厨具", "beauty": "美妆个护",
        "toys": "玩具", "sports": "运动户外",
        "auto_parts": "汽配", "health": "保健品", "pets": "宠物",
    }
    
    for fname in sorted(os.listdir(US_MARKET_DIR)):
        if not fname.endswith(".json") or fname in ("index.json", "cpsc_recalls.json", "macro_indicators.json"):
            continue
        
        cat_key = fname.replace(".json", "")
        data = load_json(os.path.join(US_MARKET_DIR, fname))
        if not data:
            continue
        
        # Check tariff alert
        tariff = data.get("country", {}).get("tariff_alert", {}) if data.get("country") else {}
        if tariff and tariff.get("level") == "high":
            cat_cn = category_names.get(cat_key, cat_key)
            alerts.append({
                "id": gen_id("tariff", cat_key),
                "type": "macro",
                "level": "high",
                "title": f"🔴 {cat_cn}关税预警: {tariff.get('title', '关税风险')[:50]}",
                "market": "美国",
                "platform": tariff.get("platform", "USTR/CBP"),
                "detail": tariff.get("detail", "")[:300],
                "date": tariff.get("date", tariff.get("as_of", TODAY)),
                "read": False,
                "source": tariff.get("source", "USTR"),
                "url": tariff.get("url", ""),
            })
        
        # Check for recent alerts in category data
        cat_alerts = data.get("alerts", [])
        for a in cat_alerts:
            if isinstance(a, dict) and a.get("live"):
                alerts.append({
                    "id": gen_id("usm", a.get("title", "")[:20]),
                    "type": a.get("type", "policy"),
                    "level": a.get("level", "mid"),
                    "title": a.get("title", "")[:60],
                    "market": "美国",
                    "platform": a.get("platform", ""),
                    "detail": a.get("detail", "")[:300],
                    "date": a.get("date", TODAY),
                    "read": False,
                    "source": a.get("source", "US Market Data"),
                })
    
    return alerts


def merge_alerts(existing_alerts, new_alerts):
    """Merge new alerts with existing, deduplicating by title similarity."""
    if not existing_alerts:
        return new_alerts
    
    existing_titles = set()
    merged = list(existing_alerts)
    
    for a in existing_alerts:
        if isinstance(a, dict):
            existing_titles.add(a.get("title", "")[:30])
        elif isinstance(a, list) and len(a) >= 4:
            existing_titles.add(str(a[3])[:30])
    
    added = 0
    for alert in new_alerts:
        title_key = alert.get("title", "")[:30]
        if title_key not in existing_titles:
            merged.append(alert)
            existing_titles.add(title_key)
            added += 1
    
    print(f"[ALERTS] Merged {added} new alerts (total: {len(merged)})")
    return merged


def expire_old_alerts(alerts, max_age_days=90):
    """Mark alerts older than max_age_days as expired."""
    cutoff = (NOW - timedelta(days=max_age_days)).strftime("%Y-%m-%d")
    active = []
    expired = 0
    
    for a in alerts:
        date = ""
        if isinstance(a, dict):
            date = a.get("date", "")
        elif isinstance(a, list) and len(a) >= 8:
            date = str(a[7])
        
        if date and date < cutoff:
            expired += 1
            continue
        active.append(a)
    
    if expired:
        print(f"[ALERTS] Expired {expired} alerts older than {max_age_days} days")
    
    return active


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Dynamic Alert Generator")
    parser.add_argument("--max-alerts", type=int, default=100, help="Max total alerts to keep")
    parser.add_argument("--max-age-days", type=int, default=90, help="Expire alerts older than N days")
    args = parser.parse_args()
    
    print(f"[ALERTS] Generating dynamic alerts ({TODAY})...")
    
    # Collect from all sources
    all_new = []
    
    cpsc_alerts = generate_from_cpsc()
    print(f"  CPSC recalls: {len(cpsc_alerts)} alerts")
    all_new.extend(cpsc_alerts)
    
    policy_alerts = generate_from_policies()
    print(f"  Policy updates: {len(policy_alerts)} alerts")
    all_new.extend(policy_alerts)
    
    us_market_alerts = generate_from_us_market()
    print(f"  US market data: {len(us_market_alerts)} alerts")
    all_new.extend(us_market_alerts)
    
    # Load existing
    existing = load_json(ALERTS_FILE)
    if isinstance(existing, list):
        existing_list = existing
    elif isinstance(existing, dict):
        existing_list = existing.get("alerts", existing.get("items", []))
    else:
        existing_list = []
    
    # Merge
    merged = merge_alerts(existing_list, all_new)
    
    # Expire old
    merged = expire_old_alerts(merged, max_age_days=args.max_age_days)
    
    # Sort by date descending
    def get_date(a):
        if isinstance(a, dict):
            return a.get("date", "")
        elif isinstance(a, list) and len(a) >= 8:
            return str(a[7])
        return ""
    
    merged.sort(key=get_date, reverse=True)
    
    # Trim to max
    if len(merged) > args.max_alerts:
        merged = merged[:args.max_alerts]
    
    # Separate format: keep array format for compatibility with existing frontend
    # Frontend expects alertsFull as array of [id, type, level, title, country, platform, detail, date, read]
    alerts_array = []
    for a in merged:
        if isinstance(a, dict):
            alerts_array.append([
                a.get("id", ""),
                a.get("type", "policy"),
                a.get("level", "mid"),
                a.get("title", ""),
                a.get("market", a.get("country", "")),
                a.get("platform", ""),
                a.get("detail", ""),
                a.get("date", ""),
                a.get("read", False),
            ])
        elif isinstance(a, list):
            alerts_array.append(a)
    
    # Save
    save_json(ALERTS_FILE, alerts_array)
    
    # Also save detailed version for reference
    detail_file = os.path.join(DATA_DIR, "alerts_detailed.json")
    detail_data = {
        "meta": {
            "generated_at": NOW.isoformat(),
            "total": len(merged),
            "sources": {
                "cpsc": len(cpsc_alerts),
                "policies": len(policy_alerts),
                "us_market": len(us_market_alerts),
            },
        },
        "alerts": [a for a in merged if isinstance(a, dict)],
    }
    save_json(detail_file, detail_data)
    
    print(f"\n[ALERTS] ✅ Done! {len(merged)} active alerts")
    print(f"[ALERTS] Updated: {ALERTS_FILE}")
    print(f"[ALERTS] Detailed: {detail_file}")


if __name__ == "__main__":
    main()
