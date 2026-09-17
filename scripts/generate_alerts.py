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

from market_scope import category_name_map, load_market_scope, normalize_category_code

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")
US_MARKET_DIR = os.path.join(DATA_DIR, "us_market")
ALERTS_FILE = os.path.join(DATA_DIR, "alerts.json")

BJT = timezone(timedelta(hours=8))
NOW = datetime.now(BJT)
TODAY = NOW.strftime("%Y-%m-%d")
GENERATOR_VERSION = "2026.09.08.1"
ALERT_SCHEMA_VERSION = "2.1"
MARKET_SCOPE = load_market_scope()
CATEGORY_NAMES = category_name_map(MARKET_SCOPE)


def canonical_category(value):
    return normalize_category_code(value, MARKET_SCOPE, market_codes=["US"])


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


def _canonical_hash(value):
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _dataset_snapshot(data, dataset_path, records):
    meta = data.get("meta", {}) if isinstance(data, dict) else {}
    snapshot_at = str(
        meta.get("generated_at")
        or meta.get("updated_at")
        or meta.get("collected_at")
        or ""
    ).strip()
    if not snapshot_at:
        snapshot_at = max(
            (str(row.get("collected_at") or row.get("retrieved_at") or "").strip()
             for row in records if isinstance(row, dict)),
            default="",
        )
    return {
        "input_dataset": dataset_path,
        "dataset_snapshot_id": _canonical_hash(data),
        "dataset_snapshot_at": snapshot_at,
        "dataset_record_count": len(records),
    }


def _lineage_fields(snapshot, source_records, window_start, window_end, input_count, lineage_type):
    evidence = [
        {
            "source_record_id": str(row.get("source_record_id") or row.get("id") or "").strip(),
            "evidence_hash": str(row.get("evidence_hash") or "").strip(),
        }
        for row in source_records
        if isinstance(row, dict)
    ]
    fields = {
        **snapshot,
        "lineage_type": lineage_type,
        "window_start": window_start,
        "window_end": window_end,
        "input_record_count": input_count,
        "matched_record_count": len(evidence),
        "source_record_ids": [row["source_record_id"] for row in evidence],
        "upstream_evidence_hashes": [row["evidence_hash"] for row in evidence],
        "source_record_evidence": evidence,
    }
    if lineage_type == "aggregate":
        fields["aggregate_count"] = len(evidence)
    return fields


def _alert_lineage_complete(meta):
    required = (
        "lineage_type", "input_dataset", "dataset_snapshot_id", "dataset_snapshot_at",
        "dataset_record_count", "window_start", "window_end", "input_record_count",
        "matched_record_count", "source_record_ids", "upstream_evidence_hashes",
        "source_record_evidence",
    )
    if any(meta.get(field) in (None, "") for field in required):
        return False
    if meta.get("lineage_type") not in {"record", "aggregate"}:
        return False
    if not re.fullmatch(r"[0-9a-fA-F]{64}", str(meta.get("dataset_snapshot_id") or "")):
        return False
    counts = [meta.get("dataset_record_count"), meta.get("input_record_count"), meta.get("matched_record_count")]
    if any(isinstance(value, bool) or not isinstance(value, int) or value < 1 for value in counts):
        return False
    dataset_count, input_count, matched_count = counts
    if not dataset_count >= input_count >= matched_count:
        return False
    record_ids = meta.get("source_record_ids")
    hashes = meta.get("upstream_evidence_hashes")
    evidence = meta.get("source_record_evidence")
    if not isinstance(record_ids, list) or not isinstance(hashes, list) or not isinstance(evidence, list):
        return False
    if len(record_ids) != matched_count or len(hashes) != matched_count or len(evidence) != matched_count:
        return False
    if len(set(record_ids)) != len(record_ids) or any(not str(value).strip() for value in record_ids):
        return False
    if any(not re.fullmatch(r"[0-9a-fA-F]{64}", str(value or "")) for value in hashes):
        return False
    expected_evidence = [
        {"source_record_id": str(record_id), "evidence_hash": str(evidence_hash)}
        for record_id, evidence_hash in zip(record_ids, hashes)
    ]
    if evidence != expected_evidence:
        return False
    if meta.get("lineage_type") == "record":
        return matched_count == 1 and str(meta.get("source_record_id")) == str(record_ids[0])
    aggregate_count = meta.get("aggregate_count")
    return isinstance(aggregate_count, int) and not isinstance(aggregate_count, bool) and aggregate_count == matched_count


def _source_provenance_complete(meta):
    if not isinstance(meta, dict):
        return False
    required = (
        "source", "source_url", "source_kind", "source_type", "source_record_id",
        "verification_status", "published_at", "collected_at", "verified_at",
        "verification_notes", "evidence_hash",
    )
    if any(meta.get(field) in (None, "") for field in required):
        return False
    if meta.get("verification_status") not in {"verified", "uploaded"}:
        return False
    if not re.match(r"^https://[^/]+/.+", str(meta.get("source_url", "")), re.I):
        return False
    if not re.fullmatch(r"[0-9a-fA-F]{64}", str(meta.get("evidence_hash"))):
        return False
    return True


def _alert_provenance_complete(meta):
    """Only retain alert rows whose evidence and derivation lineage are complete."""
    if not _source_provenance_complete(meta):
        return False
    return _alert_lineage_complete(meta)


def _alert_evidence_hash(alert, meta):
    payload = {
        "id": alert.get("id", ""),
        "title": alert.get("title", ""),
        "detail": alert.get("detail", ""),
        "date": alert.get("date", ""),
        "source": alert.get("source", ""),
        "source_url": meta.get("source_url", ""),
        "source_record_id": meta.get("source_record_id", ""),
        "source_record_ids": meta.get("source_record_ids", []),
        "upstream_evidence_hash": meta.get("upstream_evidence_hash", ""),
        "upstream_evidence_hashes": meta.get("upstream_evidence_hashes", []),
        "source_record_evidence": meta.get("source_record_evidence", []),
        "published_at": meta.get("published_at", ""),
        "lineage_type": meta.get("lineage_type", ""),
        "input_dataset": meta.get("input_dataset", ""),
        "dataset_snapshot_id": meta.get("dataset_snapshot_id", ""),
        "dataset_snapshot_at": meta.get("dataset_snapshot_at", ""),
        "dataset_record_count": meta.get("dataset_record_count"),
        "window_start": meta.get("window_start", ""),
        "window_end": meta.get("window_end", ""),
        "input_record_count": meta.get("input_record_count"),
        "matched_record_count": meta.get("matched_record_count"),
        "aggregate_count": meta.get("aggregate_count"),
    }
    return _canonical_hash(payload)


def serialize_alert(alert):
    """Convert a generated alert into the legacy display row plus provenance."""
    if not isinstance(alert, dict):
        return None
    source_url = str(alert.get("url") or alert.get("source_url") or "").strip()
    source_record_id = str(
        alert.get("source_record_id") or alert.get("sourceRecordId") or ""
    ).strip()
    published_at = str(alert.get("published_at") or alert.get("date") or "").strip()
    collected_at = str(alert.get("collected_at") or "").strip()
    verified_at = str(alert.get("verified_at") or "").strip()
    requested_status = str(alert.get("verification_status") or "").strip().casefold()
    verification_status = requested_status if requested_status in {"verified", "uploaded", "pending", "rejected"} else "pending"
    # A derived alert is only formally verified when its source record carried
    # a complete verified envelope. Missing dates remain missing so the quality
    # gate excludes the row instead of inventing a collection timestamp.
    if not collected_at or not verified_at or verification_status != "verified":
        verification_status = "pending"
    source_record_ids = alert.get("source_record_ids", [])
    upstream_hashes = alert.get("upstream_evidence_hashes", [])
    if not source_record_ids and source_record_id:
        source_record_ids = [source_record_id]
    if not upstream_hashes and alert.get("upstream_evidence_hash"):
        upstream_hashes = [alert.get("upstream_evidence_hash")]
    source_record_evidence = alert.get("source_record_evidence", [])
    if not source_record_evidence and len(source_record_ids) == len(upstream_hashes):
        source_record_evidence = [
            {"source_record_id": str(record_id), "evidence_hash": str(evidence_hash)}
            for record_id, evidence_hash in zip(source_record_ids, upstream_hashes)
        ]
    meta = {
        "source": str(alert.get("source") or "").strip(),
        "source_url": source_url,
        "source_kind": "derived",
        "source_type": "derived",
        "source_record_id": source_record_id,
        "verification_status": verification_status,
        "published_at": published_at,
        "collected_at": collected_at,
        "verified_at": verified_at,
        "verification_notes": (
            "由已核验来源生成的动态预警；正文事实应回溯到 source_record_id。"
            if verification_status == "verified"
            else "预警来源记录的核验信息不完整，暂不进入正式统计。"
        ),
        "category_codes": alert.get("category_codes", []),
        "source_record_ids": source_record_ids,
        "upstream_evidence_hash": alert.get("upstream_evidence_hash", ""),
        "upstream_evidence_hashes": upstream_hashes,
        "source_record_evidence": source_record_evidence,
        "lineage_type": alert.get("lineage_type", "record"),
        "input_dataset": alert.get("input_dataset", ""),
        "dataset_snapshot_id": alert.get("dataset_snapshot_id", ""),
        "dataset_snapshot_at": alert.get("dataset_snapshot_at", ""),
        "dataset_record_count": alert.get("dataset_record_count"),
        "window_start": alert.get("window_start", ""),
        "window_end": alert.get("window_end", ""),
        "input_record_count": alert.get("input_record_count"),
        "matched_record_count": alert.get("matched_record_count"),
        "aggregate_count": alert.get("aggregate_count"),
        "schema_version": ALERT_SCHEMA_VERSION,
        "display_locale": "zh-CN",
        "generator_version": GENERATOR_VERSION,
    }
    meta["evidence_hash"] = _alert_evidence_hash(alert, meta)
    if not _alert_provenance_complete(meta):
        return None
    return [
        alert.get("id", ""), alert.get("type", "policy"), alert.get("level", "mid"),
        alert.get("title", ""), alert.get("market", alert.get("country", "")),
        alert.get("platform", ""), alert.get("detail", ""), alert.get("date", ""),
        alert.get("read", False), meta,
    ]


def normalize_existing_alert(alert):
    """Validate an already serialized row without refreshing old timestamps."""
    if not isinstance(alert, list) or len(alert) < 10 or not isinstance(alert[9], dict):
        return None
    meta = dict(alert[9])
    if not _alert_provenance_complete(meta):
        return None
    if meta.get("schema_version") != ALERT_SCHEMA_VERSION or meta.get("display_locale") != "zh-CN":
        return None
    if meta.get("generator_version") != GENERATOR_VERSION:
        return None
    return alert


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
    cpsc_snapshot = _dataset_snapshot(
        cpsc_data,
        "data/us_market/cpsc_recalls.json",
        cpsc_data.get("china_related", []),
    )

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
        cat = canonical_category(recall.get("category"))
        cat_cn = CATEGORY_NAMES.get(cat, cat)
        lineage = _lineage_fields(
            cpsc_snapshot, [recall], cutoff, TODAY, len(recent_china), "record"
        )

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
            "source_record_id": recall.get("source_record_id") or recall.get("id"),
            "published_at": recall.get("published_at") or date,
            "collected_at": recall.get("collected_at"),
            "verified_at": recall.get("verified_at"),
            "verification_status": recall.get("verification_status"),
            "upstream_evidence_hash": recall.get("evidence_hash"),
            "category_codes": [cat],
            **lineage,
        })
    
    # Category summary alerts
    recent_by_cat = {}
    for recall in recent_china:
        recent_by_cat.setdefault(canonical_category(recall.get("category")), []).append(recall)
    for cat, recalls in recent_by_cat.items():
        china_count = len(recalls)
        if china_count >= 3:
            cat_cn = CATEGORY_NAMES.get(cat, cat)
            complete_records = [
                recall for recall in recalls
                if _source_provenance_complete({
                    "source": recall.get("source"),
                    "source_url": recall.get("source_url") or recall.get("url"),
                    "source_kind": recall.get("source_kind"),
                    "source_type": recall.get("source_type"),
                    "source_record_id": recall.get("source_record_id") or recall.get("id"),
                    "verification_status": recall.get("verification_status"),
                    "published_at": recall.get("published_at") or recall.get("date"),
                    "collected_at": recall.get("collected_at"),
                    "verified_at": recall.get("verified_at"),
                    "verification_notes": recall.get("verification_notes"),
                    "evidence_hash": recall.get("evidence_hash"),
                })
            ]
            aggregate_is_verified = len(complete_records) == len(recalls)
            lineage = _lineage_fields(
                cpsc_snapshot, recalls, cutoff, TODAY, len(recent_china), "aggregate"
            )
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
                "source_record_id": gen_id("cpsc-cat-source", f"{cat}-{TODAY}"),
                "published_at": max(
                    (recall.get("published_at") or recall.get("date") or "" for recall in recalls),
                    default="",
                ),
                "collected_at": max(
                    (recall.get("collected_at") or "" for recall in complete_records),
                    default="",
                ) if aggregate_is_verified else "",
                "verified_at": max(
                    (recall.get("verified_at") or "" for recall in complete_records),
                    default="",
                ) if aggregate_is_verified else "",
                "verification_status": "verified" if aggregate_is_verified else "pending",
                "category_codes": [cat],
                **lineage,
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
    policy_snapshot = _dataset_snapshot(policies_data, "data/policies.json", items)
    
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
            lineage = _lineage_fields(
                policy_snapshot, [item], cutoff, TODAY, len(items), "record"
            )
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
                "source_record_id": item.get("source_record_id") or item.get("id"),
                "published_at": item.get("published_at") or pub_date,
                "collected_at": item.get("collected_at"),
                "verified_at": item.get("verified_at"),
                "verification_status": item.get("verification_status"),
                "upstream_evidence_hash": item.get("evidence_hash"),
                "change_type": change_type,
                "category_codes": item.get("category_codes", item.get("categoryCodes", [])),
                **lineage,
            })
    
    return alerts


def merge_alerts(existing_alerts, new_alerts):
    """Merge alerts, preferring current records and stable-ID deduplication."""
    # The retired array payload had no provenance envelope and mixed old
    # category-file fallbacks into the formal feed. Only current, complete
    # serialized records may survive a later run. Do not refresh missing old
    # timestamps here: an old row must be re-collected or manually reviewed.
    existing_alerts = [
        normalized for alert in (existing_alerts or [])
        if (normalized := normalize_existing_alert(alert)) is not None
    ]
    def identity(alert):
        if isinstance(alert, dict):
            return str(alert.get("id") or "").strip(), str(alert.get("title") or "")[:30]
        if isinstance(alert, list):
            alert_id = str(alert[0] or "").strip() if alert else ""
            title = str(alert[3] or "")[:30] if len(alert) >= 4 else ""
            return alert_id, title
        return "", ""

    # Same-day category summaries deliberately retain a stable ID. If their
    # count changes during a later collection, the title changes as well, so
    # title-only deduplication would publish two rows with the same ID. Process
    # current records first so refreshed evidence replaces the retained row.
    merged = []
    seen_ids = set()
    seen_titles = set()
    added = 0
    for alert in list(new_alerts or []) + existing_alerts:
        alert_id, title_key = identity(alert)
        if (alert_id and alert_id in seen_ids) or (title_key and title_key in seen_titles):
            continue
        merged.append(alert)
        if alert_id:
            seen_ids.add(alert_id)
        if title_key:
            seen_titles.add(title_key)
        if isinstance(alert, dict):
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
            row = serialize_alert(a)
            if row:
                alerts_array.append(row)
        elif isinstance(a, list):
            existing_row = normalize_existing_alert(a)
            if existing_row:
                alerts_array.append(existing_row)

    dropped_incomplete = len(merged) - len(alerts_array)
    if dropped_incomplete:
        print(f"[ALERTS] Dropped {dropped_incomplete} alerts without complete provenance")
    
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
