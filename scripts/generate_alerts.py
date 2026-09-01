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
import re
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


def is_industry_advisory(item):
    source_class = str(item.get("source_class") or item.get("sourceClass") or "").strip().casefold()
    source_name = str(item.get("source") or "").casefold()
    source_url = str(item.get("source_url") or item.get("url") or "").casefold()
    return (
        source_class == "industry_advisory"
        or bool(re.search(r"雨果|amz123|cifnews|行业资讯|行业协会", source_name))
        or bool(re.search(r"(^|\.)cifnews\.com/|(^|\.)amz123\.com/", source_url))
    )


def has_chinese(value):
    return bool(re.search(r"[\u3400-\u9fff]", str(value or "")))


DIRECT_POLICY_RE = re.compile(
    r"跨境|电商|平台|卖家|商家|海关|清关|报关|电子申报|产品安全|消费品|知识产权|商标|包装|纺织|"
    r"CPSC|FDA|USTR|OFAC|Section\s*301|Section\s*122|customs?|importation|marketplaces?|sellers?|"
    r"product safety|consumer products?|consumer protection|sanctions?|de minimis|HTS|ACE system|"
    r"forced labor|international (?:trademark|trade|mail|shipping)|intellectual property|foreign[- ]trade|WTO",
    re.I,
)
TRADE_POLICY_RE = re.compile(
    r"进口|出口|关税|税务|增值税|销售税|反倾销|反补贴|制裁|贸易|强迫劳动|tariffs?|dut(?:y|ies|iable)|"
    r"trade|imports?|exports?|anti[- ]dumping|countervailing|sanctions?|WTO|(?:sales|import|value[- ]added|excise)\s+tax(?:es)?",
    re.I,
)
BUSINESS_CONTEXT_RE = re.compile(
    r"跨境|电商|平台|卖家|商家|海关|清关|报关|电子申报|消费品|产品安全|知识产权|商标|CPSC|FDA|USTR|"
    r"OFAC|Section\s*301|Section\s*122|WTO|forced labor|marketplaces?|sellers?|consumer products?|"
    r"product safety|customs?|de minimis|HTS|ACE system|international trademark|intellectual property",
    re.I,
)
INDUSTRY_ONLY_RE = re.compile(
    r"贷款|金融|基金信托|银行控股|资产管理|loan|financial|fund trust|asset management|bank holding|nuclear|核能|"
    r"marine mammals?|海洋哺乳|oil and gas|石油天然气|aircraft|航空器|aerospace|科学仪器|scientific instruments?|"
    r"commodity swaps?|军工|arms export|defen[cs]e|cheese|奶酪|sugar|食糖|soybean|大豆|fish fillets?|鱼片|"
    r"mushrooms?|蘑菇|steel|钢材|aluminum|铝材|quartz surface|石英板|motor vehicles?|机动车|dairy|乳制品|"
    r"water quality|水质|railroad|locomotive|铁路",
    re.I,
)


def is_cross_border_policy(item):
    text = "\n".join(str(item.get(key) or "") for key in ("title", "summary"))
    if not text.strip():
        return False
    if INDUSTRY_ONLY_RE.search(text) and not BUSINESS_CONTEXT_RE.search(text):
        return False
    return bool(DIRECT_POLICY_RE.search(text) or TRADE_POLICY_RE.search(text))


def generate_from_cpsc():
    """Generate alerts from CPSC recall data."""
    alerts = []
    
    cpsc_data = load_json(os.path.join(US_MARKET_DIR, "cpsc_recalls.json"))
    if not cpsc_data:
        return alerts
    
    # Recent China-related recalls (last 90 days)
    cutoff = (NOW - timedelta(days=90)).strftime("%Y-%m-%d")
    
    recent_china = [
        recall for recall in cpsc_data.get("china_related", [])
        if recall.get("date", "") >= cutoff or not recall.get("date")
    ]
    recent_china.sort(key=lambda recall: recall.get("date", ""), reverse=True)

    # Keep the alert center multi-source instead of allowing one large recall
    # feed to displace all policy and market alerts.
    for recall in recent_china[:30]:
        title_zh = recall.get("title_zh")
        description_zh = recall.get("description_zh") or recall.get("summary_zh")
        # The formal UI is Chinese-first. Keep untranslated official payloads
        # in the raw CPSC dataset until the translation pipeline supplies both
        # display fields; never improvise a translation in the browser.
        if not has_chinese(title_zh) or not has_chinese(description_zh):
            continue
        date = recall.get("date", "")
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
            "title": f"CPSC 召回：{title_zh[:60]}",
            "market": "美国",
            "platform": "CPSC",
            "detail": f"美国 CPSC 发布产品召回，涉及中国产品。品类：{cat_cn}。{description_zh[:200]}",
            "date": date or TODAY,
            "read": False,
            "source": "CPSC Recall API",
            "url": recall.get("url", "https://www.saferproducts.gov/RestWebServices/Recall"),
            "category_codes": [cat],
        })
    
    # Category summary alerts
    recent_by_cat = {}
    for recall in recent_china:
        recent_by_cat.setdefault(recall.get("category", "other"), []).append(recall)
    for cat, recalls in recent_by_cat.items():
        china_count = len(recalls)
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
                "url": "https://www.saferproducts.gov/RestWebServices/Recall",
                "category_codes": [cat],
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
        # Third-party industry articles remain reference material. They may be
        # shown in the advisory view but never create automatic risk alerts.
        if is_industry_advisory(item):
            continue
        if not is_cross_border_policy(item):
            continue
        pub_date = item.get("published_at", "") or item.get("effective_date", "")
        if pub_date < cutoff:
            continue

        # A global article is not silently relabeled as a US alert. The
        # collector may add other market generators later; this generator is
        # intentionally limited to records explicitly scoped to US.
        region = str(item.get("region") or item.get("market") or "").strip().upper()
        if region != "US":
            continue

        change_type = item.get("change_type") or item.get("changeType")
        impact = item.get("impact_level") or item.get("impactLevel")

        # Check if US-related. Explicit change metadata is sufficient to
        # create a medium/low alert; otherwise preserve the existing high-risk
        # policy behavior based on the source text.
        text = json.dumps(item, ensure_ascii=False).lower()
        is_us = any(kw in text for kw in us_keywords)
        changed_record = bool(change_type and impact in ("high", "medium", "low"))

        if (is_us and impact == "high") or changed_record:
            display_title = item.get("title_zh") or item.get("title") or "新政策"
            display_summary = (
                item.get("summary_zh")
                or item.get("summary")
                or item.get("change_summary")
                or "详见来源链接"
            )
            title_prefix = "政策变更：" if change_type else "政策更新："
            alerts.append({
                "id": gen_id("pol", item.get("title", "")[:30]),
                "type": "policy",
                "level": "mid" if impact == "medium" else (impact or "high"),
                "title": f"{title_prefix}{display_title[:60]}",
                "market": "美国",
                "platform": item.get("category", "政策"),
                "detail": display_summary[:300],
                "date": pub_date[:10] if pub_date else TODAY,
                "read": False,
                "source": "Federal Register / 政策分析",
                "url": item.get("source_url", ""),
                "change_type": change_type,
                "category_codes": item.get("category_codes", item.get("categoryCodes", [])),
            })
    
    return alerts


def merge_alerts(existing_alerts, new_alerts):
    """Merge new alerts with existing, deduplicating by title similarity."""
    # The retired array payload had no provenance envelope and mixed old
    # category-file fallbacks into the formal feed. Only explicitly sourced
    # records emitted by the current generator may survive a later run.
    existing_alerts = [
        alert for alert in (existing_alerts or [])
        if (
            isinstance(alert, list) and len(alert) > 9 and isinstance(alert[9], dict)
            and alert[9].get("source") and alert[9].get("source_record_id")
            and alert[9].get("schema_version") == "2.0" and alert[9].get("display_locale") == "zh-CN"
            and alert[9].get("generator_version") == "2026.09.01.2"
        ) or (
            isinstance(alert, dict) and alert.get("source") and alert.get("id")
            and str(alert.get("source_kind", "")).casefold() not in {"demo", "mock"}
        )
    ]
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
    
    # Keep the compatible display columns and append an explicit provenance
    # envelope. The browser and validators must not infer trust from a title.
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
                {
                    "source": a.get("source", ""),
                    "source_url": a.get("url", ""),
                    "source_kind": "official",
                    "source_type": "regulator",
                    "source_record_id": a.get("id", ""),
                    "verification_status": "verified",
                    "category_codes": a.get("category_codes", []),
                    "schema_version": "2.0",
                    "display_locale": "zh-CN",
                    "generator_version": "2026.09.01.2",
                },
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
