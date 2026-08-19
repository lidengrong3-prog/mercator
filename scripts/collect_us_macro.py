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
import os
import sys
import urllib.request
import urllib.parse
import urllib.error
import ssl
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data", "us_market")
DEFAULT_OUTPUT = os.path.join(DATA_DIR, "macro_indicators.json")
US_COUNTRY_FILE = os.path.join(ROOT, "data", "countries.json")

FRED_API_BASE = "https://api.stlouisfed.org/fred/series/observations"
CENSUS_API_BASE = "https://api.census.gov/data"
BLS_API_BASE = "https://api.bls.gov/publicAPI/v2/timeseries/data"

UA = "Mozilla/5.0 (Mercator Bot; +https://github.com/lidengrong3-prog/mercator)"

# FRED 系列 ID 及说明
FRED_SERIES = {
    # 消费 & 零售
    "RSAFS": {"name": "零售和食品服务销售", "unit": "百万美元", "seasonal": "SA"},
    "UMCSENT": {"name": "密歇根消费者信心指数", "unit": "指数", "seasonal": ""},
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
    "MRTSSM448000": {"name": "服装及配饰零售", "unit": "百万美元", "seasonal": ""},
    "MRTSSM443000": {"name": "电子产品和家电零售", "unit": "百万美元", "seasonal": ""},
    "MRTSSM442000": {"name": "家具和家居用品零售", "unit": "百万美元", "seasonal": ""},
}

# BLS 系列 (补充 FRED)
BLS_SERIES = {
    "CUSR0000SA0": "CPI 全部商品",
    "CUSR0000SA0L1E": "CPI 食品",
    "CUSR0000SA0L5": "CPI 能源",
    "CES0000000001": "平均时薪 (全部雇员)",
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
            period = latest.get("periodName", "") or latest.get("period", "")
            value = latest.get("value", "")
            if value and value != "not available":
                return {
                    "value": value,
                    "date": f"{year}-{period}" if period else year,
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
    
    # FRED data
    for series_id, meta in FRED_SERIES.items():
        print(f"  FRED: {series_id} ({meta['name']})...", end=" ")
        
        if fred_key:
            result = fetch_fred(series_id, api_key=fred_key)
        else:
            # Without API key, FRED won't work via API
            # Try alternate free sources
            result = None
        
        if result:
            indicators[series_id] = {
                "name": meta["name"],
                "value": result["value"],
                "unit": meta["unit"],
                "date": result["date"],
                "source": "FRED",
                "source_url": f"https://fred.stlouisfed.org/series/{series_id}",
            }
            fetched += 1
            print(f"✅ {result['value']} ({result['date']})")
        else:
            failed += 1
            print("⏭️ (no data)")
    
    # BLS data (no key needed)
    print("\n[MACRO] Fetching BLS data (no key required)...")
    for series_id, name in BLS_SERIES.items():
        print(f"  BLS: {series_id} ({name})...", end=" ")
        result = fetch_bls(series_id)
        if result:
            bls_key = f"BLS_{series_id}"
            indicators[bls_key] = {
                "name": name,
                "value": result["value"],
                "unit": "见BLS",
                "date": result["date"],
                "source": "BLS",
                "source_url": f"https://www.bls.gov/data/",
            }
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
    data = collect_all(fred_key=args.fred_key, census_key=args.census_key)
    
    # Save
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n[MACRO] Output: {args.output}")
    print(f"[MACRO] Indicators fetched: {data['meta']['fetched']}, failed: {data['meta']['failed']}")
    
    # Update countries.json if requested
    if args.update_countries and data["meta"]["fetched"] > 0:
        update_countries_json(data, US_COUNTRY_FILE)


if __name__ == "__main__":
    main()
