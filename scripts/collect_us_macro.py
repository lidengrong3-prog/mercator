#!/usr/bin/env python3
"""
collect_us_macro.py — 美国宏观经济数据实时采集器

从 FRED (Federal Reserve Economic Data) 和 US Census Bureau
采集关键宏观经济指标，替代之前的硬编码数据。

数据源:
  - FRED API: https://api.stlouisfed.org/fred/series/observations
  - US Census Bureau: https://api.census.gov/data
  - BLS (Bureau of Labor Statistics): 无需 key

用法:
  python scripts/collect_us_macro.py
  python scripts/collect_us_macro.py --fred-key YOUR_KEY
  python scripts/collect_us_macro.py --output data/us_market/macro.json

环境变量:
  FRED_API_KEY: FRED API 密钥 (可选，无 key 时仍可用部分接口)
  CENSUS_API_KEY: Census API 密钥 (可选)
"""

import json
import csv
import html
import io
import os
import re
import time
import sys
import urllib.request
import urllib.parse
import urllib.error
import ssl
from datetime import datetime, timezone, timedelta

from collect_data import annotate_provenance
from bls_series import BLS_METADATA_PAGE_BASE, BLS_SERIES, bls_evidence_hash
from collection_telemetry import append_collection_source
from source_governance import SourceGovernanceError, assert_source_collectable

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data", "us_market")
DEFAULT_OUTPUT = os.path.join(DATA_DIR, "macro_indicators.json")
US_COUNTRY_FILE = os.path.join(ROOT, "data", "countries.json")

FRED_API_BASE = "https://api.stlouisfed.org/fred/series/observations"
FRED_CSV_BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv"
CENSUS_API_BASE = "https://api.census.gov/data"
BLS_API_BASE = "https://api.bls.gov/publicAPI/v2/timeseries/data"

UA = "Mozilla/5.0 (Mercator Bot; +https://github.com/lidengrong3-prog/mercator)"

# FRED 系列 ID 及说明
FRED_SERIES = {
    # 电商市场规模
    "ECOMSA": {"name": "电商零售额", "unit": "百万美元", "seasonal": "SA"},
    "ECOMPCTSA": {"name": "电商占零售总额比例", "unit": "%", "seasonal": "SA"},
    # 消费 & 零售
    "RSAFS": {"name": "零售和食品服务销售", "unit": "百万美元", "seasonal": "SA"},
    "UMCSENT": {"name": "密歇根消费者信心指数", "unit": "指数", "seasonal": ""},
    "DSPIC96": {"name": "实际可支配个人收入", "unit": "十亿美元（2017年不变价）", "seasonal": "SAAR"},
    "PCEC96": {"name": "实际个人消费支出", "unit": "十亿美元（2017年不变价）", "seasonal": "SAAR"},
    "DEXCHUS": {"name": "美元兑人民币汇率", "unit": "人民币/美元", "seasonal": "NSA"},
    # 就业
    "UNRATE": {"name": "失业率", "unit": "%", "seasonal": "SA"},
    "PAYEMS": {"name": "非农就业人数", "unit": "千人", "seasonal": "SA"},
    "ICSA": {"name": "初次申请失业金人数", "unit": "人", "seasonal": "NSA"},
    # 通胀
    "CPIAUCSL": {"name": "CPI (全部商品)", "unit": "指数(1982-84=100)", "seasonal": "SA"},
    "CPILFESL": {"name": "核心 CPI (剔除食品能源)", "unit": "指数", "seasonal": "SA"},
    "PCEPI": {"name": "PCE 价格指数", "unit": "指数", "seasonal": "SA"},
    # 利率 & 货币
    "FEDFUNDS": {"name": "联邦基金有效利率", "unit": "%", "seasonal": ""},
    "DGS10": {"name": "10年期国债收益率", "unit": "%", "seasonal": ""},
    "DGS2": {"name": "2年期国债收益率", "unit": "%", "seasonal": ""},
    "T10Y2Y": {"name": "10Y-2Y 利差", "unit": "%", "seasonal": ""},
    # 房地产
    "HOUST": {"name": "新屋开工", "unit": "千套", "seasonal": "SAAR"},
    "CSUSHPINSA": {"name": "S&P/Case-Shiller 房价指数", "unit": "指数", "seasonal": "NSA"},
    "MORTGAGE30US": {"name": "30年期固定抵押贷款利率", "unit": "%", "seasonal": ""},
    # GDP & 产出
    "GDP": {"name": "GDP (季度)", "unit": "十亿美元", "seasonal": "SAAR"},
    "INDPRO": {"name": "工业生产指数", "unit": "指数(2017=100)", "seasonal": "SA"},
    # 贸易
    "BOPGSTB": {"name": "商品贸易差额", "unit": "百万美元", "seasonal": "SA"},
    # 电商相关
    "MRTSSM448USS": {"name": "服装及配饰门店零售", "unit": "百万美元", "seasonal": "SA"},
    "MRTSSM443USS": {"name": "电子产品和家电门店零售", "unit": "百万美元", "seasonal": "SA"},
    "MRTSSM442USS": {"name": "家具和家居用品门店零售", "unit": "百万美元", "seasonal": "SA"},
}

try:
    SSL_CTX = ssl.create_default_context()
except Exception:
    SSL_CTX = None


def http_get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        kwargs = {"timeout": timeout}
        if SSL_CTX:
            kwargs["context"] = SSL_CTX
        with urllib.request.urlopen(req, **kwargs) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [WARN] HTTP GET failed: {url} -> {e}")
        return None


def http_get_text(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        kwargs = {"timeout": timeout}
        if SSL_CTX:
            kwargs["context"] = SSL_CTX
        with urllib.request.urlopen(req, **kwargs) as resp:
            return resp.read().decode("utf-8-sig")
    except Exception as exc:
        print(f"  [WARN] HTTP GET failed: {url} -> {exc}")
        return None


def _normalized_bls_text(value):
    return " ".join(str(value or "").split()).casefold()


def _extract_bls_catalog_field(body, label):
    match = re.search(
        rf"<th[^>]*>\s*{re.escape(label)}:\s*</th>\s*<td[^>]*>(.*?)</td>",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return ""
    without_tags = re.sub(r"<[^>]+>", " ", match.group(1))
    return " ".join(html.unescape(without_tags).split())


def fetch_bls_series_metadata(series_ids=None):
    """Fetch authoritative catalog fields from each BLS official series page."""
    requested = set(series_ids or BLS_SERIES)
    metadata = {}
    for series_id in requested:
        configured = BLS_SERIES.get(series_id, {})
        url = f"{BLS_METADATA_PAGE_BASE}/{series_id}"
        body = http_get_text(url, timeout=30)
        if not body:
            continue
        official_id = _extract_bls_catalog_field(body, "Series Id")
        official_title = _extract_bls_catalog_field(body, "Series Title")
        if official_id != series_id or not official_title:
            continue
        metadata[series_id] = {
            "series_id": official_id,
            "series_title": official_title,
            "seasonal": "S" if re.search(r">\s*Seasonally Adjusted\s*<", body, re.IGNORECASE) else "U",
            "base_period": _extract_bls_catalog_field(body, "Base Period"),
            "data_type": _extract_bls_catalog_field(body, "Data Type"),
            "metadata_url": url,
            "survey": configured.get("survey", ""),
        }
    return metadata


def validate_bls_series_metadata(series_id, configured, official):
    """Reject a BLS series when its configured semantics differ from BLS metadata."""
    if not official:
        raise ValueError(f"BLS metadata missing for {series_id}")
    actual_title = official.get("series_title", "")
    expected_title = configured.get("official_name", "")
    if _normalized_bls_text(actual_title) != _normalized_bls_text(expected_title):
        raise ValueError(
            f"BLS title mismatch for {series_id}: expected {expected_title!r}, got {actual_title!r}"
        )
    actual_seasonal = str(official.get("seasonal") or "").strip().upper()
    expected_seasonal = str(configured.get("seasonal") or "").strip().upper()
    if expected_seasonal and actual_seasonal != expected_seasonal:
        raise ValueError(
            f"BLS seasonal mismatch for {series_id}: expected {expected_seasonal}, got {actual_seasonal}"
        )
    expected_base = str(configured.get("base_period") or "").strip()
    actual_base = str(official.get("base_period") or "").strip()
    if expected_base and actual_base != expected_base:
        raise ValueError(
            f"BLS base period mismatch for {series_id}: expected {expected_base!r}, got {actual_base!r}"
        )
    return actual_title


def fetch_fred(series_id, api_key="", limit=5):
    """Fetch latest observations from FRED."""
    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "sort_order": "desc",
        "limit": str(limit),
    }
    url = FRED_API_BASE + "?" + urllib.parse.urlencode(params)
    data = http_get_json(url, timeout=20)
    if data and "observations" in data:
        obs = data["observations"]
        # Filter out missing values
        valid = [o for o in obs if o.get("value", ".") != "."]
        if valid:
            latest = valid[0]
            return {
                "value": latest["value"],
                "date": latest["date"],
            }
    return None


def fetch_fred_csv(series_id):
    """Fetch the latest official FRED observation without requiring an API key."""
    url = FRED_CSV_BASE + "?" + urllib.parse.urlencode({"id": series_id})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        kwargs = {"timeout": 30}
        if SSL_CTX:
            kwargs["context"] = SSL_CTX
        with urllib.request.urlopen(req, **kwargs) as resp:
            body = resp.read().decode("utf-8")
        rows = list(csv.DictReader(io.StringIO(body)))
        for row in reversed(rows):
            value = str(row.get(series_id, "")).strip()
            date = str(row.get("observation_date", "")).strip()
            if value and value != "." and date:
                return {"value": value, "date": date}
    except Exception as exc:
        print(f"  [WARN] FRED CSV failed: {series_id} -> {exc}")
    return None


def fetch_bls(series_id, years=2):
    """Fetch from BLS public API (no key needed)."""
    url = BLS_API_BASE + "/" + series_id
    data = http_get_json(url, timeout=20)
    if data and data.get("status") == "REQUEST_SUCCEEDED":
        results = data.get("Results", {})
        series_list = results.get("series", [])
        if series_list and series_list[0].get("data"):
            latest = series_list[0]["data"][0]
            # BLS returns period as "M01", "M02" etc or "Q01" etc
            year = latest.get("year", "")
            period = str(latest.get("period", ""))
            value = latest.get("value", "")
            if value and value != "not available":
                if len(period) == 3 and period.startswith("M") and period[1:].isdigit() and 1 <= int(period[1:]) <= 12:
                    observation_date = f"{year}-{int(period[1:]):02d}-01"
                elif len(period) == 3 and period.startswith("Q") and period[1:].isdigit() and 1 <= int(period[1:]) <= 4:
                    observation_date = f"{year}-{(int(period[1:]) - 1) * 3 + 1:02d}-01"
                else:
                    observation_date = f"{year}-01-01"
                return {
                    "value": value,
                    "date": observation_date,
                }
    return None


def fetch_census_eccodes():
    """Try to fetch Census e-commerce data (annual, released with lag)."""
    # Census e-retail sales are in the Monthly Retail Trade Survey
    # This is hard to get via API without a key, so we use FRED as proxy
    pass


def collect_all(fred_key="", census_key=""):
    """Collect all macro indicators."""
    print("[MACRO] Collecting US macroeconomic indicators...")
    
    indicators = {}
    fetched = 0
    failed = 0
    fred_enabled = True
    bls_enabled = True
    bls_metadata = {}
    bls_metadata_verified_at = None
    try:
        assert_source_collectable("fred")
    except SourceGovernanceError as error:
        print(f"[MACRO] FRED collection skipped: {error}")
        fred_enabled = False
    try:
        assert_source_collectable("bls")
    except SourceGovernanceError as error:
        print(f"[MACRO] BLS collection skipped: {error}")
        bls_enabled = False
    if bls_enabled:
        try:
            bls_metadata = fetch_bls_series_metadata(BLS_SERIES)
            for series_id, configured in BLS_SERIES.items():
                validate_bls_series_metadata(series_id, configured, bls_metadata.get(series_id))
            bls_metadata_verified_at = datetime.now(timezone.utc).isoformat()
        except ValueError as error:
            print(f"[MACRO] BLS metadata validation failed: {error}")
            bls_enabled = False

    # FRED data
    for series_id, meta in FRED_SERIES.items():
        print(f"  FRED: {series_id} ({meta['name']})...", end=" ")
        
        result = None
        if fred_enabled:
            result = fetch_fred(series_id, api_key=fred_key) if fred_key else fetch_fred_csv(series_id)
        
        if result:
            indicators[series_id] = annotate_provenance({
                "name": meta["name"],
                "value": result["value"],
                "unit": meta["unit"],
                "date": result["date"],
                "source": "FRED",
                "source_url": f"https://fred.stlouisfed.org/series/{series_id}",
            }, default_source_kind="official", default_source_type="official_feed")
            fetched += 1
            print(f"✅ {result['value']} ({result['date']})")
        else:
            failed += 1
            print("⏭️ (no data)")
    
    # BLS data (no key needed)
    print("\n[MACRO] Fetching BLS data (no key required)...")
    for series_id, configured in BLS_SERIES.items():
        print(f"  BLS: {series_id} ({configured['name']})...", end=" ")
        result = fetch_bls(series_id) if bls_enabled else None
        if result:
            official = bls_metadata[series_id]
            official_name = validate_bls_series_metadata(series_id, configured, official)
            bls_key = f"BLS_{series_id}"
            bls_record = annotate_provenance({
                "series_id": series_id,
                "name": configured["name"],
                "official_name": official_name,
                "value": result["value"],
                "unit": configured["unit"],
                "date": result["date"],
                "description": configured["description"],
                "seasonal_adjustment": configured["seasonal_adjustment"],
                "frequency": configured["frequency"],
                "base_period": configured["base_period"] or None,
                "source": "BLS",
                "source_url": f"https://api.bls.gov/publicAPI/v2/timeseries/data/{series_id}",
                "metadata_url": official["metadata_url"],
                "metadata_verified_at": bls_metadata_verified_at,
                "source_record_id": series_id,
            }, default_source_kind="official", default_source_type="official_feed")
            bls_record["evidence_hash"] = bls_evidence_hash(bls_record)
            indicators[bls_key] = bls_record
            fetched += 1
            print(f"✅ {result['value']} ({result['date']})")
        else:
            failed += 1
            print("⏭️ (no data)")
    
    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "FRED / BLS / US Census",
            "total_indicators": len(indicators),
            "fetched": fetched,
            "failed": failed,
            "has_fred_key": bool(fred_key),
            "bls_metadata_verified": bool(bls_metadata_verified_at),
            "bls_metadata_verified_at": bls_metadata_verified_at,
        },
        "indicators": indicators,
    }


def update_countries_json(macro_data, countries_file):
    """Update the US section of countries.json with live macro data."""
    try:
        with open(countries_file, "r", encoding="utf-8") as f:
            countries = json.load(f)
    except Exception as e:
        print(f"[MACRO] Cannot read countries.json: {e}")
        return False
    
    us = countries.get("us", {})
    if not us:
        print("[MACRO] No US entry in countries.json")
        return False
    
    indicators = macro_data.get("indicators", {})
    
    # Build a readable macro summary table
    macro_rows = []
    
    # Key indicators to highlight
    highlights = [
        ("UNRATE", "失业率"),
        ("FEDFUNDS", "联邦基金利率"),
        ("CPIAUCSL", "CPI"),
        ("UMCSENT", "消费者信心指数"),
        ("RSAFS", "零售销售"),
        ("DGS10", "10Y国债收益率"),
        ("HOUST", "新屋开工"),
        ("MORTGAGE30US", "30Y抵押贷款利率"),
    ]
    
    for series_id, label in highlights:
        ind = indicators.get(series_id)
        if ind:
            macro_rows.append([
                f"{label}({ind['date']})",
                f"{ind['value']} {ind['unit']}",
                f"来源: {ind['source']}",
                ind.get("source_url", ""),
            ])
    
    if macro_rows:
        # Preserve existing macro rows that are not from FRED
        existing = us.get("macro", [])
        non_fred = [r for r in existing if "FRED" not in str(r) and "BLS" not in str(r)]
        
        us["macro"] = macro_rows + non_fred
        us["macro_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        metadata = countries.setdefault("_metadata", {})
        metadata["last_updated"] = (
            macro_data.get("meta", {}).get("generated_at")
            or datetime.now(timezone.utc).isoformat()
        )
        updated_countries = list(metadata.get("updated_countries") or [])
        if "us" not in updated_countries:
            updated_countries.append("us")
        metadata["updated_countries"] = updated_countries
        
        with open(countries_file, "w", encoding="utf-8") as f:
            json.dump(countries, f, ensure_ascii=False, indent=2)
        
        print(f"\n[MACRO] ✅ Updated countries.json US macro section with {len(macro_rows)} indicators")
        return True
    
    return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="US Macro Data Collector")
    parser.add_argument("--fred-key", default=os.environ.get("FRED_API_KEY", ""),
                        help="FRED API key")
    parser.add_argument("--census-key", default=os.environ.get("CENSUS_API_KEY", ""),
                        help="Census API key")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output JSON path")
    parser.add_argument("--update-countries", action="store_true",
                        help="Also update countries.json US macro section")
    args = parser.parse_args()
    
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Collect
    started = time.perf_counter()
    data = collect_all(fred_key=args.fred_key, census_key=args.census_key)
    
    # Save
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n[MACRO] Output: {args.output}")
    print(f"[MACRO] Indicators fetched: {data['meta']['fetched']}, failed: {data['meta']['failed']}")
    expected_requests = len(FRED_SERIES) + len(BLS_SERIES)
    fetched = int(data["meta"].get("fetched") or 0)
    failed = int(data["meta"].get("failed") or 0)
    append_collection_source({
        "key": "fred_bls_macro", "label": "FRED / BLS 宏观指标", "domain": "market",
        "core": False,
        "status": "succeeded" if failed == 0 else ("degraded" if fetched else "failed"),
        "market_codes": ["US"], "request_count": expected_requests,
        "successful_requests": fetched, "failed_requests": failed,
        "records_collected": fetched, "records_in_scope": fetched,
        "duration_ms": int((time.perf_counter() - started) * 1000),
        "content_updated_at": data.get("meta", {}).get("generated_at"),
        "last_checked_at": data.get("meta", {}).get("generated_at") if failed == 0 else None,
    })
    
    # Update countries.json if requested
    if args.update_countries and data["meta"]["fetched"] > 0:
        update_countries_json(data, US_COUNTRY_FILE)


if __name__ == "__main__":
    main()
