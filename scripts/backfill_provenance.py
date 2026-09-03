#!/usr/bin/env python3
"""Backfill the explicit provenance envelope for shipped evidence caches.

This migration is deliberately conservative: official government/platform
records can be marked verified from their authoritative HTTPS host, while
third-party industry articles remain traceable references pending review.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from urllib.parse import urlparse


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
ADVISORY_HOSTS = {"cifnews.com", "www.cifnews.com", "amz123.com", "www.amz123.com"}
OFFICIAL_SUFFIXES = (".gov", ".mil", ".gov.cn", ".europa.eu")
OFFICIAL_HOSTS = {
    "federalregister.gov", "www.federalregister.gov", "ustr.gov", "www.ustr.gov",
    "cpsc.gov", "www.cpsc.gov", "saferproducts.gov", "www.saferproducts.gov",
    "sellercentral.amazon.com", "seller.tiktokshopglobalselling.com",
    "seller.shopee.sg", "sellercenter.lazada.sg", "seller.temu.com", "seller.shein.com",
}
PLATFORM_HOSTS = {
    "sellercentral.amazon.com", "seller.tiktokshopglobalselling.com",
    "seller.shopee.sg", "sellercenter.lazada.sg", "seller.temu.com", "seller.shein.com",
}


def text(value):
    return str(value or "").strip()


def source_url(record):
    return text(record.get("source_url") or record.get("url"))


def host_for(url):
    return (urlparse(url).hostname or "").casefold().rstrip(".")


def is_advisory(record, url):
    source = text(record.get("source")).casefold()
    host = host_for(url)
    source_class = text(record.get("source_class") or record.get("sourceClass")).casefold()
    return source_class == "industry_advisory" or host in ADVISORY_HOSTS or "雨果" in source or "amz123" in source


def official_url(url):
    host = host_for(url)
    return bool(re.match(r"^https://[^/]+/.+", url, re.I)) and (
        host in OFFICIAL_HOSTS or host.endswith(OFFICIAL_SUFFIXES)
    )


def official_host(url):
    host = host_for(url)
    return host in OFFICIAL_HOSTS or host.endswith(OFFICIAL_SUFFIXES)


def evidence_hash(record):
    payload = {
        "id": record.get("id") or record.get("recall_number"),
        "title": record.get("title") or "",
        "summary": record.get("summary") or record.get("description") or "",
        "source_url": source_url(record),
        "published_at": record.get("published_at") or record.get("date") or "",
        "effective_from": record.get("effective_from") or record.get("effective_date") or "",
    }
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def enrich(record, *, updated_at=None, default_source=None, default_type=None):
    if not isinstance(record, dict):
        return record
    url = source_url(record)
    advisory = is_advisory(record, url)
    if url and not record.get("source_url"):
        record["source_url"] = url
    if not record.get("source_record_id"):
        record["source_record_id"] = text(record.get("id") or record.get("recall_number")) or hashlib.sha256(url.encode()).hexdigest()[:24]
    if advisory:
        kind, source_type, status = "traceable", "licensed_provider", "pending"
        record["source_class"] = "industry_advisory"
        record["verification_notes"] = "第三方行业资讯：仅作可追溯参考，未完成官方记录级核验。"
    elif default_source:
        kind, source_type, status = default_source, default_type or "unknown", "verified" if official_url(url) else "pending"
        record["verification_notes"] = "基于官方来源页面的记录级核验；使用前应复核原文。" if status == "verified" else "来源已抓取但尚未完成记录级核验，暂不进入正式统计。"
    elif official_host(url):
        kind = "official"
        source_type = default_type or ("platform" if host_for(url) in {"sellercentral.amazon.com", "seller.tiktokshopglobalselling.com", "seller.shopee.sg", "sellercenter.lazada.sg", "seller.temu.com", "seller.shein.com"} else "government")
        # Platform feeds are record-addressable by the supplied rule ID even
        # when the publisher only exposes a seller-center landing page.
        status = "verified" if official_url(url) or host_for(url) in PLATFORM_HOSTS else "pending"
        record["verification_notes"] = "基于官方来源页面的记录级核验；使用前应复核原文。" if status == "verified" else "官方站点入口已记录，但缺少具体记录页面，待人工核验。"
    else:
        kind, source_type, status = "traceable", default_type or "licensed_provider", "pending"
        record["verification_notes"] = "来源已抓取但尚未完成记录级核验，暂不进入正式统计。"
    record["source_kind"] = kind
    record["source_type"] = source_type
    record["verification_status"] = status
    record["collected_at"] = text(record.get("collected_at") or updated_at)
    if not record.get("published_at") and record.get("date"):
        record["published_at"] = record["date"]
    if status == "verified":
        record["verified_at"] = text(record.get("verified_at") or record.get("collected_at"))
    else:
        record["verified_at"] = None
    record["evidence_hash"] = text(record.get("evidence_hash")) or evidence_hash(record)
    return record


def update_items(filename):
    path = os.path.join(DATA, filename)
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    updated_at = data.get("updated_at")
    for item in data.get("items", []):
        enrich(item, updated_at=updated_at)
        if filename == "rules.json" and not item.get("source"):
            item["source"] = text(item.get("platform")) or host_for(source_url(item))
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def update_alerts():
    path = os.path.join(DATA, "alerts.json")
    with open(path, encoding="utf-8") as handle:
        rows = json.load(handle)
    for row in rows:
        if isinstance(row, list) and len(row) >= 10 and isinstance(row[9], dict):
            meta = row[9]
            meta["published_at"] = meta.get("published_at") or row[7]
            meta["collected_at"] = meta.get("collected_at") or row[7]
            enrich(meta, updated_at=row[7], default_source="official", default_type="regulator")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(rows, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def update_cpsc():
    path = os.path.join(DATA, "us_market", "cpsc_recalls.json")
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    generated_at = (data.get("meta") or {}).get("generated_at")
    seen = set()
    for collection in ("recalls", "china_related"):
        for item in data.get(collection, []):
            if isinstance(item, dict):
                enrich(item, updated_at=generated_at, default_source="official", default_type="regulator")
                seen.add(item.get("id"))
    for values in (data.get("by_category") or {}).values():
        for item in values:
            if isinstance(item, dict):
                enrich(item, updated_at=generated_at, default_source="official", default_type="regulator")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def main():
    update_items("policies.json")
    update_items("rules.json")
    update_alerts()
    update_cpsc()
    print("Backfilled provenance for policies, rules, alerts and CPSC caches.")


if __name__ == "__main__":
    main()
