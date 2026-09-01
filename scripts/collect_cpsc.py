#!/usr/bin/env python3
"""
collect_cpsc.py — CPSC 产品召回数据采集器

从美国消费品安全委员会 (CPSC) 获取产品召回数据，
筛选中国 origin 产品，输出到 data/us_market/cpsc_recalls.json。

数据源: CPSC / SaferProducts Recall API
  https://www.saferproducts.gov/RestWebServices/Recall

用法:
  python scripts/collect_cpsc.py                    # 采集最近召回
  python scripts/collect_cpsc.py --days 30          # 最近30天
  python scripts/collect_cpsc.py --output path.json # 指定输出路径
"""

import json
import os
import sys
import urllib.request
import urllib.parse
import urllib.error
import ssl
import hashlib
from datetime import datetime, timezone, timedelta

from collect_data import annotate_provenance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data", "us_market")
DEFAULT_OUTPUT = os.path.join(DATA_DIR, "cpsc_recalls.json")

# CPSC 官方公开 API。旧的 cpsc.gov/cpscrecall/reportapi 已返回 404。
CPSC_API = "https://www.saferproducts.gov/RestWebServices/Recall"
UA = "Mozilla/5.0 (Mercator Bot; +https://github.com/lidengrong3-prog/mercator)"

# 中国相关关键词（筛选中国 origin 产品召回）
CHINA_KEYWORDS = [
    "china", "chinese", "prc", "made in china",
    "shenzhen", "guangdong", "zhejiang", "jiangsu", "fujian",
    "shanghai", "beijing", "dongguan", "yiwu", "ningbo",
]

# 品类映射: CPSC 产品描述 -> Mercator 品类
CATEGORY_MAP = {
    "electronics": ["electronic", "battery", "charger", "cable", "phone", "laptop",
                    "tablet", "speaker", "headphone", "earbud", "camera", "led",
                    "light", "usb", "power", "adapter", "plug", "switch", "sensor"],
    "apparel": ["cloth", "shirt", "pant", "dress", "jacket", "shoe", "boot",
                "sandal", "hat", "scarf", "glove", "textile", "fabric", "garment",
                "children", "kids", "sleepwear"],
    "home": ["furniture", "kitchen", "cook", "pan", "pot", "knife", "cutting",
             "container", "plate", "bowl", "cup", "glass", "curtain", "rug",
             "carpet", "bedding", "pillow", "blanket", "towel", "candle"],
    "beauty": ["cosmetic", "makeup", "lip", "skin", "cream", "lotion", "shampoo",
               "soap", "beauty", "nail", "hair", "perfume"],
    "toys": ["toy", "play", "doll", "game", "puzzle", "stuffed", "plush",
             "lego", "block", "ball", "ride", "scooter", "tricycle"],
    "sports": ["sport", "fitness", "exercise", "bike", "bicycle", "helmet",
               "yoga", "gym", "weight", "tent", "camping"],
    "auto": ["auto", "car", "vehicle", "tire", "seat", "brake", "motor",
             "engine", "light bar", "headlight", "bumper"],
    "health": ["supplement", "vitamin", "health", "medical", "drug", "pill",
               "tablet", "capsule", "device", "thermo", "mask", "sanitizer"],
}

# SSL context (some environments have cert issues)
try:
    SSL_CTX = ssl.create_default_context()
except Exception:
    SSL_CTX = None


def http_get_json(url, timeout=30):
    """HTTP GET returning parsed JSON, or None on failure."""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json",
        "Accept-Encoding": "identity",
        "Connection": "close",
    })
    for attempt in range(1, 3):
        try:
            kwargs = {"timeout": timeout}
            if SSL_CTX:
                kwargs["context"] = SSL_CTX
            with urllib.request.urlopen(req, **kwargs) as resp:
                # SaferProducts occasionally advertises an incorrect content
                # length. Sized reads avoid urllib's all-at-once IncompleteRead.
                chunks = []
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    chunks.append(chunk)
                return json.loads(b"".join(chunks).decode("utf-8"))
        except Exception as e:
            print(f"  [WARN] HTTP GET attempt {attempt}/2 failed: {url} -> {e}")
    return None


def is_china_related(text):
    """Check if recall text mentions China or Chinese origin."""
    if not text:
        return False
    text_lower = text.lower()
    return any(kw in text_lower for kw in CHINA_KEYWORDS)


def normalize_url(value):
    """Repair the single-slash URL occasionally returned by the API."""
    if not isinstance(value, str):
        return ""
    value = value.strip()
    if value.startswith("https:/") and not value.startswith("https://"):
        return "https://" + value[len("https:/"):].lstrip("/")
    if value.startswith("http:/") and not value.startswith("http://"):
        return "http://" + value[len("http:/"):].lstrip("/")
    return value


def categorize_recall(title, description=""):
    """Map recall to a Mercator category based on keywords."""
    combined = (title + " " + description).lower()
    scores = {}
    for cat, keywords in CATEGORY_MAP.items():
        score = sum(1 for kw in keywords if kw in combined)
        if score > 0:
            scores[cat] = score
    if scores:
        return max(scores, key=scores.get)
    return "other"


def gen_recall_id(recall):
    """Generate a stable ID for a recall."""
    key = (
        recall.get("RecallNumber", "")
        or recall.get("recall_number", "")
        or str(recall.get("RecallID", ""))
        or recall.get("Title", "")
        or recall.get("title", "")
    )
    h = hashlib.md5(key.encode()).hexdigest()[:8]
    return f"cpsc-{h}"


def fetch_cpsc_recalls(days=120):
    """
    Fetch recent recalls from CPSC.
    
    CPSC Recall API endpoint:
    GET https://www.saferproducts.gov/RestWebServices/Recall
    Returns JSON array of recall objects.
    
    Each recall typically has:
    - recall_number: unique identifier
    - title: recall title
    - description: detailed description
    - date: recall date
    - url: link to full recall notice
    - products: list of affected products
    """
    print("[CPSC] Fetching recall data from CPSC API...")
    start_date = (datetime.now(timezone.utc) - timedelta(days=max(days, 1))).strftime("%Y-%m-%d")
    query = urllib.parse.urlencode({"format": "json", "RecallDateStart": start_date})
    data = http_get_json(f"{CPSC_API}?{query}", timeout=60)
    if data is None:
        print("[CPSC] Official API request failed.")
        return []
    
    # Normalize: API might return dict with 'results' key or direct array
    if isinstance(data, dict):
        if "results" in data:
            recalls = data["results"]
        elif "data" in data:
            recalls = data["data"]
        else:
            recalls = [data]
    elif isinstance(data, list):
        recalls = data
    else:
        print(f"[CPSC] Unexpected response type: {type(data)}")
        return []
    
    print(f"[CPSC] Raw recalls: {len(recalls)}")
    return recalls


def process_recalls(recalls, days=120):
    """Process raw recalls into structured format."""
    results = {
        "meta": {
            "source": "CPSC / SaferProducts Recall API",
            "source_url": CPSC_API,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "query_start": (datetime.now(timezone.utc) - timedelta(days=max(days, 1))).strftime("%Y-%m-%d"),
            "total_recalls": len(recalls),
        },
        "recalls": [],
        "china_related": [],
        "by_category": {},
    }
    
    for recall in recalls:
        if not isinstance(recall, dict):
            continue
        
        title = recall.get("Title", "") or recall.get("title", "") or recall.get("recall_title", "")
        desc = recall.get("Description", "") or recall.get("description", "") or recall.get("recall_description", "") or recall.get("summary", "")
        date_str = recall.get("RecallDate", "") or recall.get("date", "") or recall.get("recall_date", "") or recall.get("published_date", "")
        url = normalize_url(recall.get("URL", "") or recall.get("url", "") or recall.get("recall_url", "") or recall.get("link", ""))
        recall_number = recall.get("RecallNumber", "") or recall.get("recall_number", "") or recall.get("id", "")
        
        if not title:
            continue
        
        # Parse date
        parsed_date = date_str[:10] if date_str else ""
        
        products = [
            product.get("Name", "")
            for product in recall.get("Products", [])
            if isinstance(product, dict) and product.get("Name")
        ]
        countries = [
            country.get("Country", "")
            for country in recall.get("ManufacturerCountries", [])
            if isinstance(country, dict) and country.get("Country")
        ]
        hazards = [
            hazard.get("Name", "")
            for hazard in recall.get("Hazards", [])
            if isinstance(hazard, dict) and hazard.get("Name")
        ]
        searchable = " ".join([title, desc] + products + countries + hazards)
        category = categorize_recall(title, " ".join([desc] + products + hazards))
        china_related = any("china" in country.lower() for country in countries) or is_china_related(searchable)
        
        # Build recall entry
        entry = annotate_provenance({
            "id": gen_recall_id(recall),
            "recall_number": recall_number,
            "title": title,
            "description": desc[:500] if desc else "",
            "date": parsed_date,
            "url": url,
            "category": category,
            "china_related": china_related,
            "source": "CPSC",
            "manufacturer_countries": countries,
            "products": products,
            "hazards": hazards,
        }, default_source_kind="official", default_source_type="regulator")
        
        results["recalls"].append(entry)
        
        if entry["china_related"]:
            results["china_related"].append(entry)
        
        # Group by category
        if category not in results["by_category"]:
            results["by_category"][category] = []
        results["by_category"][category].append(entry)
    
    results["meta"]["china_related_count"] = len(results["china_related"])
    results["meta"]["categories_count"] = len(results["by_category"])
    
    return results


def load_existing(output_path):
    """Load existing recalls data."""
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def merge_recalls(old_data, new_data):
    """Merge new recalls with existing, deduplicating by ID."""
    if not old_data or not old_data.get("recalls"):
        return new_data
    
    # Upgrade retained records in place so future runs remove legacy
    # compatibility inference without changing the public recall shape.
    for recall in old_data.get("recalls", []):
        if isinstance(recall, dict):
            recall.update(annotate_provenance(
                recall,
                default_source_kind="official",
                default_source_type="regulator",
            ))
    for recall in old_data.get("china_related", []):
        if isinstance(recall, dict):
            recall.update(annotate_provenance(
                recall,
                default_source_kind="official",
                default_source_type="regulator",
            ))
    existing_ids = {r["id"] for r in old_data["recalls"]}
    added = 0
    for recall in new_data["recalls"]:
        if recall["id"] not in existing_ids:
            old_data["recalls"].append(recall)
            existing_ids.add(recall["id"])
            if recall["china_related"]:
                old_data["china_related"].append(recall)
            cat = recall["category"]
            if cat not in old_data["by_category"]:
                old_data["by_category"][cat] = []
            old_data["by_category"][cat].append(recall)
            added += 1
    
    old_data["meta"].update(new_data["meta"])
    old_data["meta"]["total_recalls"] = len(old_data["recalls"])
    old_data["meta"]["china_related_count"] = len(old_data["china_related"])
    
    print(f"[CPSC] Merged {added} new recalls (total: {len(old_data['recalls'])})")
    return old_data


def main():
    import argparse
    parser = argparse.ArgumentParser(description="CPSC Recall Data Collector")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output JSON path")
    parser.add_argument("--no-merge", action="store_true", help="Don't merge with existing data")
    parser.add_argument("--days", type=int, default=120, help="Recall lookback window in days")
    args = parser.parse_args()
    
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Fetch
    raw_recalls = fetch_cpsc_recalls(args.days)
    if not raw_recalls:
        print("[CPSC] No recalls fetched. Keeping existing data if available.")
        existing = load_existing(args.output)
        if existing:
            print(f"[CPSC] Existing data has {len(existing.get('recalls', []))} recalls.")
            return 0
        return 1
    
    # Process
    results = process_recalls(raw_recalls, args.days)
    
    # Merge with existing
    if not args.no_merge:
        existing = load_existing(args.output)
        if existing:
            results = merge_recalls(existing, results)
    
    # Save
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # Summary
    total = len(results["recalls"])
    china = len(results["china_related"])
    cats = len(results["by_category"])
    print(f"\n[CPSC] ✅ Done! Total: {total} recalls, China-related: {china}, Categories: {cats}")
    print(f"[CPSC] Output: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
