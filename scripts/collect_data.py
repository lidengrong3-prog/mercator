#!/usr/bin/env python3
"""
Mercator Data Collector
Collects trade policies and platform rules from multiple sources.
Runs via GitHub Actions every 4 hours.
"""

import json
import os
import re
import sys
import hashlib
import traceback
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from html import unescape
from html.parser import HTMLParser

# ---- Config ----
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
BJT = timezone(timedelta(hours=8))
NOW = datetime.now(BJT)
NOW_ISO = NOW.isoformat()
NOW_DATE = NOW.strftime('%Y-%m-%d')

def gen_id(prefix, title):
    h = hashlib.md5(title.encode()).hexdigest()[:8]
    return f"{prefix}{NOW.strftime('%Y%m%d')}-{h}"


SOURCE_KINDS = ('official', 'traceable', 'uploaded', 'derived', 'demo')
VERIFICATION_STATUSES = ('verified', 'uploaded', 'pending', 'rejected')
PLATFORM_SOURCE_HOSTS = {
    'sellercentral.amazon.com',
    'seller.tiktokshopglobalselling.com',
    'seller.shein.com',
    'seller.temu.com',
    'sellercenter.lazada.sg',
    'seller.shopee.sg',
}

# Third-party industry articles are useful leads, but their market scope must
# be explicit before they are shown in a market-specific view.  A global
# article with no identifiable target market remains in the raw feed only.
INDUSTRY_MARKET_PATTERNS = {
    'US': re.compile(
        r'美国|美区|美国站|白宫|联邦|美海关|美税|美国市场|'
        r'\b(?:american|united\s+states|u\.s\.?|us\s+(?:tariff|customs|market))\b',
        re.IGNORECASE,
    ),
    'EU': re.compile(
        r'欧盟|欧洲|法国|德国|意大利|西班牙|英国|'
        r'\b(?:eu|europe|france|germany|italy|spain|uk)\b',
        re.IGNORECASE,
    ),
    'CA': re.compile(r'加拿大|\bcanada\b', re.IGNORECASE),
    'JP': re.compile(r'日本|日区|\bjapan\b', re.IGNORECASE),
    'KR': re.compile(r'韩国|韩区|\bkorea\b', re.IGNORECASE),
    'SEA': re.compile(
        r'东南亚|新加坡|马来西亚|印度尼西亚|印尼|泰国|越南|'
        r'\b(?:sea|singapore|malaysia|indonesia|thailand|vietnam)\b',
        re.IGNORECASE,
    ),
}

INDUSTRY_REGION_PATTERNS = {
    'EU': re.compile(r'欧盟|欧洲|\b(?:eu|europe)\b', re.IGNORECASE),
    'SEA': re.compile(
        r'东南亚|\b(?:sea|southeast\s+asia)\b', re.IGNORECASE,
    ),
}


def _industry_market_alias_pattern(values):
    """Build a boundary-aware matcher for a market's configured aliases."""
    parts = []
    for value in values:
        raw = str(value or '').strip()
        if not raw:
            continue
        escaped = re.escape(raw)
        if re.search(r'[\u3400-\u9fff]', raw):
            parts.append(escaped)
        elif re.fullmatch(r'[A-Za-z]{2}', raw):
            # ISO codes such as ID/DE are meaningful only as explicit uppercase
            # tokens. Do not infer a market from URL parameters like affiliate_id.
            parts.append(rf'(?<![A-Za-z0-9_])(?-i:{escaped.upper()})(?![A-Za-z0-9_])')
        else:
            parts.append(rf'(?<![A-Za-z0-9]){escaped}(?![A-Za-z0-9])')
    return re.compile('|'.join(parts), re.IGNORECASE) if parts else None


def _industry_market_catalog():
    """Read configured market aliases without making the feed depend on them."""
    path = os.path.join(DATA_DIR, 'market_scope.json')
    try:
        with open(path, encoding='utf-8') as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []
    return [item for item in data.get('markets', []) if isinstance(item, dict) and item.get('code')]


def _normalize_industry_market_value(value):
    raw = str(value or '').strip()
    if not raw:
        return ''
    for market in _industry_market_catalog():
        aliases = [
            market.get('code'), market.get('key'), market.get('name'),
            market.get('label'), *(market.get('aliases') or []),
        ]
        if any(str(alias or '').strip().casefold() == raw.casefold() for alias in aliases):
            return str(market.get('code')).strip().upper()
    return raw.upper()


def _source_host(url):
    match = re.match(r'^https?://([^/]+)', str(url or '').strip(), re.I)
    return (match.group(1) if match else '').split(':', 1)[0].lower().rstrip('.')


def _source_record_id(item):
    url = str(item.get('source_url') or item.get('url') or '').strip()
    title = str(item.get('title') or item.get('name') or item.get('id') or '').strip()
    return hashlib.sha256(f'{url}|{title}'.encode('utf-8')).hexdigest()[:24]


def annotate_provenance(item, *, default_source_kind=None, default_source_type=None):
    """Attach the provenance envelope to every newly collected record.

    A collector may fetch a page successfully without proving that the page
    is the authoritative record.  Such entries intentionally remain pending;
    the publication gate can show them in the raw feed without publishing
    them to formal statistics.
    """
    record = dict(item or {})
    url = str(record.get('source_url') or record.get('url') or '').strip()
    host = _source_host(url)
    source_kind = str(record.get('source_kind') or default_source_kind or '').strip().lower()
    source_type = str(record.get('source_type') or default_source_type or '').strip().lower()
    if not source_kind:
        source_kind = 'official' if host.endswith(('.gov', '.gov.cn', '.mil', '.europa.eu')) else 'traceable'
    if source_kind not in SOURCE_KINDS:
        source_kind = 'traceable'
    if not source_type:
        if host in PLATFORM_SOURCE_HOSTS:
            source_type = 'platform'
        elif host.endswith(('.gov', '.gov.cn', '.mil', '.europa.eu')):
            source_type = 'government'
        else:
            source_type = 'licensed_provider' if url else 'unknown'
    if source_type not in {'government', 'regulator', 'platform', 'official_feed', 'industry_association', 'licensed_provider', 'user_upload', 'derived', 'demo', 'unknown'}:
        source_type = 'unknown'

    existing_status = str(record.get('verification_status') or '').strip().lower()
    has_specific_url = bool(re.match(r'^https?://[^/]+/.+', url, re.I))
    if existing_status in VERIFICATION_STATUSES:
        verification_status = existing_status
    elif source_kind == 'demo' or record.get('data_quality') in ('demo', 'demonstration', 'mock', '演示'):
        source_kind = 'demo'
        source_type = 'demo'
        verification_status = 'pending'
    elif source_kind == 'uploaded':
        verification_status = 'uploaded'
    elif source_kind == 'official' and has_specific_url:
        verification_status = 'verified'
    else:
        verification_status = 'pending'

    record['source_kind'] = source_kind
    record['source_type'] = source_type
    if url and not record.get('source_url'):
        record['source_url'] = url
    record['source_record_id'] = str(record.get('source_record_id') or _source_record_id(record))
    record['verification_status'] = verification_status
    record['collected_at'] = record.get('collected_at') or NOW_ISO
    record['retrieved_at'] = record.get('retrieved_at') or record['collected_at']
    if record.get('effective_date') and not record.get('effective_from'):
        record['effective_from'] = record['effective_date']
    if verification_status == 'verified':
        record['verified_at'] = record.get('verified_at') or NOW_ISO
        record['verification_notes'] = record.get('verification_notes') or '由采集器来源规则初步核验；正式使用前仍应复核原文。'
    else:
        record['verification_notes'] = record.get('verification_notes') or '来源已抓取但尚未完成记录级核验，暂不进入正式统计。'
    evidence_payload = json.dumps({
        'title': record.get('title'),
        'source_url': url,
        'source_record_id': record['source_record_id'],
        'published_at': record.get('published_at'),
        'effective_from': record.get('effective_from'),
    }, ensure_ascii=False, sort_keys=True)
    record['evidence_hash'] = str(record.get('evidence_hash') or hashlib.sha256(evidence_payload.encode('utf-8')).hexdigest())
    return record


def infer_industry_market_codes(*values):
    """Return only markets explicitly mentioned by an industry article."""
    text = '\n'.join(str(value or '') for value in values)
    codes = []
    configured_codes = set()
    for market in _industry_market_catalog():
        code = str(market.get('code') or '').strip().upper()
        if not code:
            continue
        configured_codes.add(code)
        aliases = [
            market.get('code'), market.get('key'), market.get('name'),
            market.get('label'), *(market.get('aliases') or []),
        ]
        matcher = _industry_market_alias_pattern(aliases)
        region_code = str(market.get('region_code') or market.get('regionCode') or '').strip().upper()
        region_name = market.get('region_name') or market.get('regionName')
        region_matcher = INDUSTRY_REGION_PATTERNS.get(region_code)
        if (matcher and matcher.search(text)) or (
            region_matcher and region_matcher.search(text)
        ):
            codes.append(code)

    # Keep compatibility with a market manifest that has not yet been
    # expanded. Unknown aggregate codes are never emitted when a concrete
    # market catalog is available, so a future DE/FR market can be selected
    # independently instead of receiving an opaque EU record.
    for code, pattern in INDUSTRY_MARKET_PATTERNS.items():
        if (not configured_codes or code in configured_codes) and pattern.search(text):
            if code not in codes:
                codes.append(code)
    return codes


def refresh_industry_market_scope(record):
    """Re-evaluate scope after article text or translation has been filled."""
    explicit = record.get('market_codes') or record.get('marketCodes') or []
    if not isinstance(explicit, list):
        explicit = [explicit]
    explicit = [
        _normalize_industry_market_value(value) for value in explicit
        if str(value or '').strip() and str(value).strip().upper() not in {'GLOBAL', 'GLOBAL_MARKET', 'ALL'}
    ]
    catalog = _industry_market_catalog()
    expanded = []
    for code in explicit:
        if code in INDUSTRY_REGION_PATTERNS:
            expanded.extend(
                str(market.get('code')).strip().upper()
                for market in catalog
                if str(market.get('region_code') or market.get('regionCode') or '').strip().upper() == code
            )
    explicit = list(dict.fromkeys(explicit + expanded))
    inferred = infer_industry_market_codes(
        record.get('title'), record.get('summary'),
        record.get('title_zh'), record.get('summary_zh'),
    )
    record['market_codes'] = list(dict.fromkeys(explicit + inferred))
    record['market_scope_status'] = 'identified' if record['market_codes'] else 'unscoped'
    return record


def annotate_industry_advisory(item):
    """Attach a non-official, traceable provenance envelope to industry news."""
    record = annotate_provenance(
        item,
        default_source_kind='traceable',
        default_source_type='licensed_provider',
    )
    # A fetched article is not an official verification event.  Keep it
    # pending so the formal publication gate cannot count it as policy.
    record['verification_status'] = 'pending'
    record['source_class'] = 'industry_advisory'
    refresh_industry_market_scope(record)
    record['verification_notes'] = (
        '第三方行业资讯：保留原文链接、发布日期和采集时间，仅作可追溯参考；'
        '未完成官方记录级核验，不进入正式政策统计。'
    )
    return record

# ---- HTTP helpers ----
def fetch_json(url, headers=None):
    """Fetch URL and parse JSON response."""
    hdrs = {'User-Agent': 'MercatorBot/1.0 (GitHub Actions)'}
    if headers:
        hdrs.update(headers)
    req = Request(url, headers=hdrs)
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"  [WARN] fetch_json failed for {url}: {e}")
        return None

def fetch_html(url, headers=None):
    """Fetch URL and return HTML text."""
    hdrs = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
    if headers:
        hdrs.update(headers)
    req = Request(url, headers=hdrs)
    try:
        with urlopen(req, timeout=30) as resp:
            data = resp.read()
            # Try utf-8 first, then fall back
            for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
                try:
                    return data.decode(enc)
                except UnicodeDecodeError:
                    continue
                except LookupError:
                    continue
            return data.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  [WARN] fetch_html failed for {url}: {e}")
        return None


def _clean_link_text(value):
    """Reduce an HTML anchor body to a readable title for feed records."""
    text = re.sub(r'<[^>]+>', ' ', str(value or ''))
    return re.sub(r'\s+', ' ', unescape(text)).strip()

# ---- Source: Federal Register API (US Trade Policies) ----
def collect_federal_register():
    """Collect US trade-related regulations from Federal Register API."""
    print("[1/6] Collecting Federal Register (US trade regulations)...")
    items = []
    
    # Search for trade-related documents
    agencies = [
        'trade-representative-office',
        'commerce-department',
        'customs-and-border-protection'
    ]
    
    for agency in agencies:
        url = (
            f"https://www.federalregister.gov/api/v1/documents.json?"
            f"filter[conditions][agencies][]={agency}"
            f"&filter[conditions][type]=RULE"
            f"&per_page=10&order=newest&fields[]=title&fields[]=abstract"
            f"&fields[]=publication_date&fields[]=html_url&fields[]=type"
        )
        data = fetch_json(url)
        if not data or 'results' not in data:
            continue
            
        for doc in data['results']:
            title = doc.get('title', '').strip()
            abstract = doc.get('abstract', '') or ''
            # Clean HTML tags from abstract
            abstract = re.sub(r'<[^>]+>', '', abstract).strip()
            if not title:
                continue
                
            pub_date = doc.get('publication_date', NOW_DATE)
            html_url = doc.get('html_url', '')
            
            # Determine impact level based on keywords
            impact = 'medium'
            high_kw = ['tariff', 'duty', 'sanction', 'embargo', 'quota', 'trade remedy', 'anti-dumping', 'countervailing']
            if any(kw in title.lower() for kw in high_kw):
                impact = 'high'
            
            # Determine category
            category = 'regulation'
            if any(kw in title.lower() for kw in ['tariff', 'duty', 'rate']):
                category = 'tariff'
            elif any(kw in title.lower() for kw in ['sanction', 'embargo', 'restricted']):
                category = 'sanction'
            
            items.append({
                'id': gen_id('p', title),
                'title': title,
                'summary': abstract[:300] if abstract else 'See source for details.',
                'source': f"Federal Register ({agency.replace('-', ' ').title()})",
                'source_url': html_url,
                'region': 'US',
                'category': category,
                'impact_level': impact,
                'published_at': pub_date,
                'collected_at': NOW_ISO
            })
    
    print(f"  Found {len(items)} items from Federal Register")
    return items

# ---- Source: USTR Press Releases ----
def collect_ustr():
    """Collect USTR press releases and fact sheets."""
    print("[2/6] Collecting USTR press releases...")
    items = []
    
    html = fetch_html('https://ustr.gov/news-events/press-releases')
    if not html:
        html = fetch_html('https://ustr.gov/news-events')
    if not html:
        # Fallback: use Federal Register with USTR-specific filter
        print("  [INFO] USTR site unreachable, skipping (covered by Federal Register)")
        return items
    
    # Parse press release links
    pattern = r'<a[^>]+href="(/news-events/press-releases/[^"]+)"[^>]*>([^<]+)</a>'
    matches = re.findall(pattern, html)
    if not matches:
        pattern = r'<a[^>]+href="(/[^"]*press[^"]+)"[^>]*>([^<]{10,})</a>'
        matches = re.findall(pattern, html)
    
    seen_titles = set()
    for url_path, title in matches:
        title = title.strip()
        if not title or title in seen_titles or len(title) < 10:
            continue
        seen_titles.add(title)
        
        full_url = f"https://ustr.gov{url_path}"
        impact = 'high' if any(kw in title.lower() for kw in ['tariff', 'sanction', 'trade', 'agreement', 'investigation']) else 'medium'
        
        items.append({
            'id': gen_id('p', title),
            'title': title,
            'summary': '',  # Will be filled by detail fetch if needed
            'source': 'USTR',
            'source_url': full_url,
            'region': 'US',
            'category': 'tariff' if 'tariff' in title.lower() else 'regulation',
            'impact_level': impact,
            'published_at': NOW_DATE,
            'collected_at': NOW_ISO
        })
        
        if len(items) >= 10:
            break
    
    print(f"  Found {len(items)} items from USTR")
    return items

# ---- Source: TikTok Shop Policy Center ----
def collect_tiktok_shop(include_status=False):
    """Collect TikTok Shop policy updates."""
    print("[3/6] Collecting TikTok Shop policy updates...")
    items = []
    source_checked = False
    
    # TikTok Shop seller academy policy page
    urls = [
        'https://seller.tiktokshopglobalselling.com/university/new-policies?identity=1&module_id=latest_policies',
    ]
    
    for url in urls:
        html = fetch_html(url)
        if not html:
            continue
        source_checked = True
        
        # Try to find policy update entries
        # Look for text patterns like policy titles
        patterns = [
            r'(?:规则速递|政策更新|Policy Update|New Polic)[^<]{5,200}',
            r'<h[23][^>]*>([^<]{10,100})</h[23]>',
            r'"title":"([^"]{10,100})"',
        ]
        
        for pat in patterns:
            matches = re.findall(pat, html)
            for m in matches:
                title = m.strip() if isinstance(m, str) else m
                if len(title) < 10 or title in [x.get('title','') for x in items]:
                    continue
                items.append({
                    'id': gen_id('r', title),
                    'title': title,
                    'summary': '',
                    'platform': 'TikTok Shop',
                    'market': 'SEA/US',
                    'category': 'policy',
                    'impact_level': 'medium',
                    'effective_date': NOW_DATE,
                    'source_url': 'https://seller.tiktokshopglobalselling.com/',
                    'published_at': NOW_DATE,
                    'collected_at': NOW_ISO
                })
        
        if items:
            break
    
    print(f"  Found {len(items)} items from TikTok Shop")
    return (items, source_checked) if include_status else items

# ---- Source: Amazon Seller Central News ----
def collect_amazon(include_status=False):
    """Collect Amazon Seller Central announcements."""
    print("[4/6] Collecting Amazon Seller Central announcements...")
    items = []
    
    html = fetch_html('https://sellercentral.amazon.com/news')
    if not html:
        html = fetch_html('https://sellercentral.amazon.com/gp/help/news')
    if not html:
        print("  [WARN] Could not fetch Amazon Seller Central news")
        return (items, False) if include_status else items
    
    # Find announcement titles
    patterns = [
        r'<h[23][^>]*>([^<]{15,120})</h[23]>',
        r'"headline":"([^"]{15,120})"',
        r'<a[^>]+href="[^"]*news[^"]*"[^>]*>([^<]{15,120})</a>',
    ]
    
    seen = set()
    for pat in patterns:
        matches = re.findall(pat, html)
        for m in matches:
            title = m.strip()
            if title in seen or len(title) < 15:
                continue
            seen.add(title)
            
            # Filter for relevant content
            skip_kw = ['cookie', 'javascript', 'sign in', 'log in']
            if any(kw in title.lower() for kw in skip_kw):
                continue
            
            impact = 'high' if any(kw in title.lower() for kw in ['fee', 'policy', 'requirement', 'mandatory', 'change', 'update', 'new']) else 'medium'
            
            items.append({
                'id': gen_id('r', title),
                'title': title,
                'summary': '',
                'platform': 'Amazon',
                'market': 'US',
                'category': 'policy',
                'impact_level': impact,
                'effective_date': NOW_DATE,
                'source_url': 'https://sellercentral.amazon.com/',
                'published_at': NOW_DATE,
                'collected_at': NOW_ISO
            })
            
            if len(items) >= 15:
                break
        if len(items) >= 15:
            break
    
    print(f"  Found {len(items)} items from Amazon")
    return (items, True) if include_status else items

# ---- Source: Chinese Cross-border E-commerce News ----
def collect_cn_news():
    """Collect from Chinese cross-border e-commerce news aggregators."""
    print("[5/6] Collecting Chinese cross-border news (cifnews/amz123)...")
    items = []
    
    # 雨果网 - cross-border e-commerce news
    html = fetch_html('https://www.cifnews.com/')
    if html:
        # Find article links with titles
        pattern = r'<a[^>]+href="(https?://[^"]*cifnews[^"]*)"[^>]*>([^<]{10,100})</a>'
        matches = re.findall(pattern, html)
        seen = set()
        for url, title in matches:
            title = title.strip()
            if title in seen or len(title) < 10:
                continue
            # Filter for policy/rule related content
            policy_kw = ['政策', '新规', '规则', '关税', '合规', '监管', '禁止', '调整', '变更', '实施', '生效']
            if not any(kw in title for kw in policy_kw):
                continue
            seen.add(title)
            items.append(annotate_industry_advisory({
                'id': gen_id('p', title),
                'title': title,
                'summary': '',
                'source': '雨果网',
                'source_url': url,
                'region': 'Global',
                'category': 'regulation',
                'impact_level': 'medium',
                'published_at': NOW_DATE,
                'collected_at': NOW_ISO,
            }))
            if len(items) >= 8:
                break
    
    # AMZ123
    html2 = fetch_html('https://www.amz123.com/')
    if html2:
        pattern = r'<a[^>]+href="((?:https?://(?:www\.)?amz123\.com)?/t/[^"]+)"[^>]*>(.*?)</a>'
        matches = re.findall(pattern, html2, flags=re.IGNORECASE | re.DOTALL)
        seen2 = set()
        for path, raw_title in matches:
            title = _clean_link_text(raw_title)
            if len(title) < 10:
                # The current homepage often puts the visible title in a
                # data attribute while the anchor body starts with an image.
                anchor = re.search(
                    r'<a[^>]+href="' + re.escape(path) + r'"[^>]*>(.*?)</a>',
                    html2, flags=re.IGNORECASE | re.DOTALL,
                )
                attr = re.search(r'data-sdk-resource-id="([^"]+)"', anchor.group(0) if anchor else '')
                title = _clean_link_text(attr.group(1) if attr else '')
            if title in seen2 or len(title) < 10:
                continue
            policy_kw = ['政策', '新规', '规则', '关税', '合规', '调整', '变更', '费用', 'FBA', '物流']
            if not any(kw in title for kw in policy_kw):
                continue
            seen2.add(title)
            items.append(annotate_industry_advisory({
                'id': gen_id('p', title),
                'title': title,
                'summary': '',
                'source': 'AMZ123',
                'source_url': path if path.startswith('http') else f'https://www.amz123.com{path}',
                'region': 'Global',
                'category': 'regulation',
                'impact_level': 'medium',
                'published_at': NOW_DATE,
                'collected_at': NOW_ISO,
            }))
            if len(items) >= 15:
                break
    
    print(f"  Found {len(items)} items from CN news sources")
    return items

# ---- Source: China MOFCOM ----
def collect_mofcom():
    """Collect China Ministry of Commerce trade policy updates."""
    print("[6/7] Collecting China MOFCOM...")
    items = []
    
    # MOFCOM policy release page
    urls = [
        'http://www.mofcom.gov.cn/article/aecc/agreement/',
        'http://www.mofcom.gov.cn/article/zcfb/',
    ]
    
    for url in urls:
        html = fetch_html(url)
        if not html:
            continue
        
        # Find article links
        pattern = r'<a[^>]+href="([^"]+)"[^>]*>([^<]{10,100})</a>'
        matches = re.findall(pattern, html)
        seen = set()
        for link, title in matches:
            title = title.strip()
            if title in seen or len(title) < 10:
                continue
            # Filter for trade-related content
            trade_kw = ['贸易', '出口', '进口', '关税', '合作', '协定', '跨境', '电商', 'WTO', 'RCEP']
            if not any(kw in title for kw in trade_kw):
                continue
            seen.add(title)
            
            full_url = link if link.startswith('http') else f"http://www.mofcom.gov.cn{link}"
            items.append({
                'id': gen_id('p', title),
                'title': title,
                'summary': '',
                'source': '中国商务部',
                'source_url': full_url,
                'region': 'CN',
                'category': 'trade_agreement' if any(kw in title for kw in ['协定', '合作', 'RCEP']) else 'regulation',
                'impact_level': 'medium',
                'published_at': NOW_DATE,
                'collected_at': NOW_ISO
            })
            if len(items) >= 8:
                break
        if items:
            break
    
    print(f"  Found {len(items)} items from MOFCOM")
    return items

# ---- Source: EU Trade ----
def collect_eu_trade():
    """Collect EU trade policy updates."""
    print("[6/6] Collecting EU trade policy updates...")
    items = []
    
    url = "https://policy.trade.ec.europa.eu/news_en"
    html = fetch_html(url)
    if not html:
        url = "https://trade.ec.europa.eu/news_en"
        html = fetch_html(url)
    if not html:
        print("  [WARN] Could not fetch EU trade page")
        return items
    
    # Find news items
    patterns = [
        r'<a[^>]+href="([^"]*)"[^>]*class="[^"]*news[^"]*"[^>]*>([^<]{10,150})</a>',
        r'<h[23][^>]*>\s*<a[^>]+href="([^"]*)"[^>]*>([^<]{10,150})</a>',
    ]
    
    seen = set()
    for pat in patterns:
        matches = re.findall(pat, html)
        for url_path, title in matches:
            title = title.strip()
            if title in seen or len(title) < 10:
                continue
            seen.add(title)
            
            full_url = url_path if url_path.startswith('http') else f"https://policy.trade.ec.europa.eu{url_path}"
            items.append({
                'id': gen_id('p', title),
                'title': title,
                'summary': '',
                'source': 'EU Trade',
                'source_url': full_url,
                'region': 'EU',
                'category': 'regulation',
                'impact_level': 'medium',
                'published_at': NOW_DATE,
                'collected_at': NOW_ISO
            })
            if len(items) >= 8:
                break
        if len(items) >= 8:
            break
    
    print(f"  Found {len(items)} items from EU Trade")
    return items

# ---- Article Extraction ----
class ArticleTextExtractor(HTMLParser):
    """Extract plain text from HTML, skipping script/style/nav elements."""
    SKIP_TAGS = {'script', 'style', 'noscript', 'nav', 'header', 'footer',
                 'aside', 'form', 'svg', 'button'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text_parts = []
        self.skip_depth = 0
        self.current_tag = ''

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
        self.current_tag = tag

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self.skip_depth > 0:
            self.skip_depth -= 1
        # Add a space after block-level tags
        if self.skip_depth == 0 and tag in ('p', 'br', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article'):
            self.text_parts.append(' ')

    def handle_data(self, data):
        if self.skip_depth == 0:
            self.text_parts.append(data)

    def get_text(self):
        text = ''.join(self.text_parts)
        # Collapse whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text


def _extract_by_selector(html, selector_pattern):
    """Try to extract content matching a CSS class/id/element selector pattern using regex.

    selector_pattern is a compiled regex that matches the opening tag.
    Returns raw HTML string of the first match, or None.
    """
    # Find the matching opening tag and then parse to find closing tag
    m = selector_pattern.search(html)
    if not m:
        return None
    start = m.start()
    # Determine tag name
    tag_match = re.match(r'<\s*([a-zA-Z0-9]+)', m.group(0))
    if not tag_match:
        return None
    tag_name = tag_match.group(1).lower()

    # Walk forward, tracking nesting
    depth = 1
    pos = m.end()
    pattern = re.compile(rf'<\s*(/)?\s*{re.escape(tag_name)}\b[^>]*>', re.IGNORECASE)
    while depth > 0 and pos < len(html):
        next_match = pattern.search(html, pos)
        if not next_match:
            break
        if next_match.group(1):  # closing tag
            depth -= 1
            if depth == 0:
                return html[start:next_match.end()]
        else:  # opening tag
            depth += 1
        pos = next_match.end()
    return None


def extract_article_summary(url):
    """Fetch an article page and extract a 500-char text summary from its main content area.

    Returns summary string on success, or empty string on any failure.
    """
    if not url:
        return ''
    html = fetch_html(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    })
    if not html:
        return ''

    # Selectors to try, in priority order
    selectors = [
        re.compile(r'<article\b[^>]*>', re.IGNORECASE),
        re.compile(r'<main\b[^>]*>', re.IGNORECASE),
        re.compile(r'<div\b[^>]*class="[^"]*article-content[^"]*"[^>]*>', re.IGNORECASE),
        re.compile(r'<div\b[^>]*class="[^"]*post-content[^"]*"[^>]*>', re.IGNORECASE),
        re.compile(r'<div\b[^>]*class="[^"]*entry-content[^"]*"[^>]*>', re.IGNORECASE),
        re.compile(r'<div\b[^>]*id="article-content"[^>]*>', re.IGNORECASE),
        re.compile(r'<div\b[^>]*id="post-content"[^>]*>', re.IGNORECASE),
        re.compile(r'<div\b[^>]*class="[^"]*content[^"]*article[^"]*"[^>]*>', re.IGNORECASE),
        re.compile(r'<div\b[^>]*class="[^"]*article__content[^"]*"[^>]*>', re.IGNORECASE),
        re.compile(r'<div\b[^>]*class="[^"]*rich_media_content[^"]*"[^>]*>', re.IGNORECASE),
    ]

    extracted_html = None
    for sel in selectors:
        result = _extract_by_selector(html, sel)
        if result and len(result) > 200:
            extracted_html = result
            break

    if not extracted_html:
        # Fallback: try <body>
        body_m = re.search(r'<body\b[^>]*>(.*?)</body>', html, re.IGNORECASE | re.DOTALL)
        if body_m:
            extracted_html = body_m.group(1)
        else:
            extracted_html = html

    # Extract text
    parser = ArticleTextExtractor()
    try:
        parser.feed(extracted_html)
    except Exception:
        return ''
    text = parser.get_text()

    # Trim to 500 chars
    if len(text) > 500:
        text = text[:500] + '...'
    return text.strip()


# ---- AI Summarization ----
def ai_summarize(title, raw_text, item_type):
    """Use an OpenAI-compatible API to generate a 200-char Chinese summary.

    Requires AI_API_KEY and AI_API_URL env vars. Returns None if not configured
    or if the call fails.
    """
    api_key = os.environ.get('AI_API_KEY', '').strip()
    api_url = os.environ.get('AI_API_URL', '').strip()
    if not api_key or not api_url:
        return None

    if not raw_text or not raw_text.strip():
        return None

    type_label = '政策' if item_type == 'policy' else ('平台规则' if item_type == 'rule' else '资讯')
    prompt = (
        f"请根据以下{type_label}标题和正文内容，生成一条200字以内的中文摘要，"
        f"重点分析其对跨境电商卖家的业务影响与风险点，语言简洁专业。\n\n"
        f"标题：{title}\n\n"
        f"正文片段：\n{raw_text[:2000]}\n"
    )

    payload = json.dumps({
        'model': os.environ.get('AI_MODEL', 'gpt-3.5-turbo'),
        'messages': [
            {'role': 'system', 'content': '你是跨境电商行业分析师，擅长提炼政策与平台规则对卖家的影响。'},
            {'role': 'user', 'content': prompt}
        ],
        'max_tokens': 400,
        'temperature': 0.3
    }).encode('utf-8')

    req = Request(
        api_url,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'User-Agent': 'MercatorBot/1.0 (GitHub Actions)'
        },
        method='POST'
    )

    try:
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
        content = result['choices'][0]['message']['content'].strip()
        # Limit to ~200 Chinese chars
        if len(content) > 220:
            content = content[:200] + '...'
        return content
    except Exception as e:
        print(f"  [WARN] AI summarization failed: {e}")
        return None


# ---- Baseline Protection ----
# 人工整理的基线数据（data/{kind}_baseline.json）永远与采集结果做并集，
# 且在裁剪 cap 时受保护，不会被后续自动采集的新条目挤掉。
def load_baseline_items(kind):
    """读取人工基线条目；不存在则返回空列表（不影响正常采集）。"""
    path = os.path.join(DATA_DIR, f'{kind}_baseline.json')
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            d = json.load(f)
        items = d.get('items', []) if isinstance(d, dict) else d
        return items if isinstance(items, list) else []
    except (json.JSONDecodeError, OSError) as e:
        print(f"  [WARN] 基线文件 {path} 读取失败，跳过基线保护: {e}")
        return []


def _title_keys(title):
    """统一的标题去重键（全称 + 前 20 字模糊键）。"""
    t = (title or '').strip().lower()
    keys = {t} if t else set()
    if len(t) > 20:
        keys.add(t[:20])
    return keys


ITEM_CAP = 400  # 单个数据文件的自动采集条目上限（人工基线不占用该额度）


# ---- Merge & Deduplicate ----
def merge_data(existing_file, new_items, key_fields=['title'], baseline_kind=None, cap=ITEM_CAP):
    """Merge new items with existing data, dedup by title similarity.

    baseline_kind: 'policies' / 'rules'。给定时，会把 data/{kind}_baseline.json
    的人工条目并入结果，并在裁剪时保护它们不被挤出。
    """
    if os.path.exists(existing_file):
        try:
            with open(existing_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            # 结构校验：损坏或非预期结构时重建
            if not isinstance(existing, dict) or 'items' not in existing:
                raise ValueError('unexpected structure')
        except (json.JSONDecodeError, ValueError, OSError) as e:
            backup = existing_file + '.corrupt.' + NOW.strftime('%Y%m%d%H%M%S')
            try:
                import shutil
                shutil.copy2(existing_file, backup)
                print(f"  [WARN] {existing_file} 损坏已备份至 {backup}，将重建: {e}")
            except Exception:
                print(f"  [WARN] {existing_file} 损坏且无法备份: {e}")
            existing = {'updated_at': NOW_ISO, 'source_count': 0, 'items': []}
    else:
        existing = {'updated_at': NOW_ISO, 'source_count': 0, 'items': []}
    
    # Normalize provenance before deduplication so new and persisted records
    # share the same evidence envelope.  Legacy records are left untouched;
    # the validator reports their compatibility inference separately.
    new_items = [annotate_provenance(item) for item in new_items if isinstance(item, dict)]

    existing_titles = set()
    for item in existing['items']:
        t = item.get('title', '').strip()
        existing_titles.add(t.lower())
        # Also add a hash of first 20 chars for fuzzy match
        if len(t) > 20:
            existing_titles.add(t[:20].lower())
    
    added = 0
    for item in new_items:
        t = item.get('title', '').strip().lower()
        if t in existing_titles or t[:20] in existing_titles:
            continue
        existing['items'].insert(0, item)
        existing_titles.add(t)
        if len(t) > 20:
            existing_titles.add(t[:20].lower())
        added += 1
    
    # ---- 人工基线并集（不存在基线文件时行为与以前完全一致）----
    baseline_titles = set()
    baseline_added = 0
    if baseline_kind:
        for b in load_baseline_items(baseline_kind):
            b = annotate_provenance(b, default_source_kind='demo', default_source_type='demo')
            bt = (b.get('title') or '').strip().lower()
            if not bt:
                continue
            baseline_titles |= _title_keys(bt)
            if bt in existing_titles or bt[:20] in existing_titles:
                continue
            existing['items'].append(b)  # 基线追加在尾部，保持采集新条目在前
            existing_titles |= _title_keys(bt)
            baseline_added += 1

    # Keep only last `cap` items to prevent file bloat —— 基线条目豁免裁剪
    items = existing['items']
    if len(items) > cap:
        protected, ordinary = [], []
        for it in items:
            t = (it.get('title') or '').strip().lower()
            (protected if (t in baseline_titles or t[:20] in baseline_titles) else ordinary).append(it)
        room = max(cap - len(protected), 0)
        existing['items'] = ordinary[:room] + protected
    # Only a successful source response may advance freshness. Re-merging the
    # baseline or surviving a total network outage must not look like new data.
    if new_items:
        existing['updated_at'] = NOW_ISO
        existing['source_count'] = len({
            item.get('source') or item.get('platform')
            for item in new_items
            if item.get('source') or item.get('platform')
        })
    if baseline_added:
        print(f"  [BASELINE] {baseline_kind}: 并入人工基线 {baseline_added} 条（受裁剪保护）")

    return existing, added

# ---- Platform Updates Collector ----

# Platform name aliases for news search
PLATFORM_ALIASES = {
    'Amazon': ['Amazon', '亚马逊'],
    'TikTok Shop': ['TikTok Shop', 'TikTok电商'],
    'Shopee': ['Shopee', '虾皮'],
    'Temu': ['Temu', '拼多多跨境'],
    'SHEIN Marketplace': ['SHEIN', '希音'],
    'AliExpress 速卖通': ['AliExpress', '速卖通'],
    'eBay': ['eBay'],
    'Lazada': ['Lazada', '来赞达'],
    'Tokopedia': ['Tokopedia'],
    'MercadoLibre 美客多': ['MercadoLibre', '美客多'],
    'Ozon': ['Ozon'],
    'Wildberries': ['Wildberries'],
    'Coupang': ['Coupang', '酷澎'],
    'Jumia': ['Jumia'],
    'Walmart Marketplace': ['Walmart Marketplace', '沃尔玛电商'],
    'Etsy': ['Etsy'],
    'Zalando': ['Zalando'],
    'Rakuten 乐天': ['Rakuten', '乐天'],
    'Mercari 煤炉': ['Mercari', '煤炉'],
    'Cdiscount': ['Cdiscount'],
    'ASOS': ['ASOS'],
    'Qoo10': ['Qoo10'],
    'Instagram Shop / Facebook Shop': ['Instagram Shop', 'Facebook Shop', 'Meta电商'],
    'YouTube Shopping': ['YouTube Shopping', 'YouTube购物'],
    'Pinterest Shop': ['Pinterest Shop'],
}

# Federal Register search terms per platform
PLATFORM_FR_TERMS = {
    'Amazon': 'amazon ecommerce',
    'TikTok Shop': 'tiktok shop social commerce',
    'Temu': 'temu ecommerce',
    'SHEIN Marketplace': 'shein fast fashion',
    'AliExpress 速卖通': 'aliexpress cross-border ecommerce',
    'Shopee': 'shopee ecommerce',
    'eBay': 'ebay marketplace',
    'Walmart Marketplace': 'walmart ecommerce',
    'Lazada': 'lazada alibaba ecommerce',
    'MercadoLibre 美客多': 'mercadolibre latin america ecommerce',
}


def _extract_title(m):
    """从正则匹配结果（str 或 tuple）中提取标题文本。"""
    if isinstance(m, tuple):
        for part in reversed(m):
            if isinstance(part, str) and part.strip():
                return part.strip()
        return ''
    return m.strip() if isinstance(m, str) else str(m).strip()


def _search_html_site(platform_name, aliases, url_fn, patterns_fn, max_alias=2):
    """通用站点搜索（修复 P2-5 重复代码）。

    遍历别名生成 URL，多正则提取标题并去重。
    url_fn(alias) 返回请求 URL；patterns_fn(alias) 返回该别名对应的正则列表。
    """
    items = []
    for alias in aliases[:max_alias]:
        url = url_fn(alias)
        html = fetch_html(url)
        if not html:
            continue
        patterns = patterns_fn(alias)
        seen = set()
        for pat in patterns:
            try:
                matches = re.findall(pat, html, re.IGNORECASE)
            except re.error:
                continue
            for m in matches:
                title = _extract_title(m)
                if len(title) < 8 or title in seen:
                    continue
                seen.add(title)
                items.append(title)
        if items:
            break
    return items


def _search_amz123(platform_name, aliases):
    """Search AMZ123 for platform news."""
    def url_fn(alias):
        return f'https://www.amz123.com/search?q={alias}'
    def patterns_fn(alias):
        esc = re.escape(alias)
        return [
            r'<a[^>]+href="(/[^"]+)"[^>]*>([^<]*' + esc + r'[^<]*)</a>',
            r'<h[234][^>]*>([^<]*' + esc + r'[^<]*)</h[234]>',
            r'"title":"([^"]*' + esc + r'[^"]*)"',
        ]
    return _search_html_site(platform_name, aliases, url_fn, patterns_fn)


def _search_cifnews(platform_name, aliases):
    """Search 雨果网 for platform news."""
    def url_fn(alias):
        return f'https://www.cifnews.com/search?keyword={alias}'
    def patterns_fn(alias):
        esc = re.escape(alias)
        return [
            r'<a[^>]+href="(https?://[^"]*cifnews[^"]*)"[^>]*>([^<]*' + esc + r'[^<]*)</a>',
            r'"title":"([^"]*' + esc + r'[^"]*)"',
            r'<h[234][^>]*>\s*<a[^>]+>([^<]*' + esc + r'[^<]*)</a>',
        ]
    return _search_html_site(platform_name, aliases, url_fn, patterns_fn)


def _search_federal_register(platform_name, term):
    """Search Federal Register for platform-related policy changes."""
    items = []
    url = (
        f"https://www.federalregister.gov/api/v1/documents.json?"
        f"filter[conditions][term]={term}"
        f"&per_page=5&order=newest"
        f"&fields[]=title&fields[]=abstract"
    )
    data = fetch_json(url)
    if data and 'results' in data:
        for doc in data['results']:
            title = doc.get('title', '').strip()
            if title and len(title) > 5:
                items.append(title)
    return items


def collect_platform_updates():
    """Collect latest updates for each platform and merge into data/platforms.json."""
    print("\n[Platform Updates] Collecting platform dynamics...")
    
    platforms_file = os.path.join(DATA_DIR, 'platforms.json')
    if not os.path.exists(platforms_file):
        print("  [WARN] data/platforms.json not found, skipping platform updates")
        return
    
    with open(platforms_file, 'r', encoding='utf-8') as f:
        platforms = json.load(f)
    
    print(f"  Loaded {len(platforms)} platforms")
    
    # Limit to 10 platforms per run to avoid timeout
    MAX_UPDATES_PER_RUN = 10
    updated_count = 0
    
    for platform in platforms:
        if updated_count >= MAX_UPDATES_PER_RUN:
            break
        
        pname = platform.get('name', '')
        if not pname:
            continue
        
        # Get aliases for search
        aliases = PLATFORM_ALIASES.get(pname, [pname])
        fr_term = PLATFORM_FR_TERMS.get(pname, pname.lower())
        
        new_titles = []
        
        # 1. Search AMZ123
        try:
            amz_titles = _search_amz123(pname, aliases)
            new_titles.extend(amz_titles[:3])
        except Exception as e:
            print(f"  [WARN] AMZ123 search failed for {pname}: {e}")
        
        # 2. Search 雨果网
        try:
            cif_titles = _search_cifnews(pname, aliases)
            new_titles.extend(cif_titles[:3])
        except Exception as e:
            print(f"  [WARN] cifnews search failed for {pname}: {e}")
        
        # 3. Federal Register (US platforms)
        if fr_term and pname in PLATFORM_FR_TERMS:
            try:
                fr_titles = _search_federal_register(pname, fr_term)
                new_titles.extend(fr_titles[:2])
            except Exception as e:
                print(f"  [WARN] Federal Register search failed for {pname}: {e}")
        
        if new_titles:
            # Deduplicate against existing updates
            existing_updates = platform.get('updates', '')
            existing_parts = [u.strip() for u in existing_updates.split(';') if u.strip()]
            
            added = 0
            for title in new_titles:
                # Skip if similar to existing
                title_clean = title.strip()
                if not title_clean or len(title_clean) < 8:
                    continue
                is_dup = False
                for ep in existing_parts:
                    # Simple overlap check
                    if any(w in ep for w in title_clean.split() if len(w) > 3):
                        is_dup = True
                        break
                if not is_dup:
                    existing_parts.append(title_clean[:100])
                    added += 1
            
            if added > 0:
                # Keep only latest 8 updates
                platform['updates'] = ';'.join(existing_parts[-8:])
                updated_count += 1
                print(f"  [{updated_count}/{MAX_UPDATES_PER_RUN}] {pname}: +{added} new updates")
    
    if updated_count > 0:
        # Add metadata
        with open(platforms_file, 'w', encoding='utf-8') as f:
            json.dump(platforms, f, ensure_ascii=False, indent=2)
        print(f"  Updated {updated_count} platforms in platforms.json")
    else:
        print("  No new platform updates found")


# ---- Country Profile Updates ----
COUNTRY_CONFIG = {
    # Southeast Asia
    'id': {'name': '印度尼西亚', 'en': 'Indonesia', 'search_terms': ['Indonesia', '印尼', '印尼电商']},
    'th': {'name': '泰国', 'en': 'Thailand', 'search_terms': ['Thailand', '泰国', '泰国电商']},
    'my': {'name': '马来西亚', 'en': 'Malaysia', 'search_terms': ['Malaysia', '马来西亚', '马来电商']},
    'vn': {'name': '越南', 'en': 'Vietnam', 'search_terms': ['Vietnam', '越南', '越南电商']},
    'ph': {'name': '菲律宾', 'en': 'Philippines', 'search_terms': ['Philippines', '菲律宾', '菲律宾电商']},
    'sg': {'name': '新加坡', 'en': 'Singapore', 'search_terms': ['Singapore', '新加坡', '新加坡电商']},
    # Americas
    'us': {'name': '美国', 'en': 'United States', 'search_terms': ['US tariff', 'China tariff', '美国关税', '美国电商']},
    'br': {'name': '巴西', 'en': 'Brazil', 'search_terms': ['Brazil', '巴西', '巴西电商', 'Remessa Conforme']},
    'ca': {'name': '加拿大', 'en': 'Canada', 'search_terms': ['Canada', '加拿大', '加拿大电商']},
    'mx': {'name': '墨西哥', 'en': 'Mexico', 'search_terms': ['Mexico', '墨西哥', '墨西哥电商']},
    'ar': {'name': '阿根廷', 'en': 'Argentina', 'search_terms': ['Argentina', '阿根廷', '阿根廷电商']},
    'co': {'name': '哥伦比亚', 'en': 'Colombia', 'search_terms': ['Colombia', '哥伦比亚', '哥伦比亚电商']},
    'cl': {'name': '智利', 'en': 'Chile', 'search_terms': ['Chile', '智利', '智利电商']},
    # Europe
    'gb': {'name': '英国', 'en': 'United Kingdom', 'search_terms': ['UK', '英国', '英国电商']},
    'de': {'name': '德国', 'en': 'Germany', 'search_terms': ['Germany', '德国', '德国电商']},
    'fr': {'name': '法国', 'en': 'France', 'search_terms': ['France', '法国', '法国电商']},
    'it': {'name': '意大利', 'en': 'Italy', 'search_terms': ['Italy', '意大利', '意大利电商']},
    'es': {'name': '西班牙', 'en': 'Spain', 'search_terms': ['Spain', '西班牙', '西班牙电商']},
    'nl': {'name': '荷兰', 'en': 'Netherlands', 'search_terms': ['Netherlands', '荷兰', '荷兰电商']},
    'pl': {'name': '波兰', 'en': 'Poland', 'search_terms': ['Poland', '波兰', '波兰电商']},
    'se': {'name': '瑞典', 'en': 'Sweden', 'search_terms': ['Sweden', '瑞典', '瑞典电商']},
    'be': {'name': '比利时', 'en': 'Belgium', 'search_terms': ['Belgium', '比利时', '比利时电商']},
    # Middle East & Africa
    'sa': {'name': '沙特阿拉伯', 'en': 'Saudi Arabia', 'search_terms': ['Saudi Arabia', '沙特', '中东电商']},
    'ae': {'name': '阿联酋', 'en': 'UAE', 'search_terms': ['UAE', '阿联酋', '迪拜电商']},
    'eg': {'name': '埃及', 'en': 'Egypt', 'search_terms': ['Egypt', '埃及', '埃及电商']},
    'tr': {'name': '土耳其', 'en': 'Turkey', 'search_terms': ['Turkey', '土耳其', '土耳其电商']},
    'il': {'name': '以色列', 'en': 'Israel', 'search_terms': ['Israel', '以色列', '以色列电商']},
    'ng': {'name': '尼日利亚', 'en': 'Nigeria', 'search_terms': ['Nigeria', '尼日利亚', '尼日利亚电商']},
    'za': {'name': '南非', 'en': 'South Africa', 'search_terms': ['South Africa', '南非', '南非电商']},
    'ke': {'name': '肯尼亚', 'en': 'Kenya', 'search_terms': ['Kenya', '肯尼亚', '肯尼亚电商']},
    'ma': {'name': '摩洛哥', 'en': 'Morocco', 'search_terms': ['Morocco', '摩洛哥', '摩洛哥电商']},
    # Asia Pacific
    'jp': {'name': '日本', 'en': 'Japan', 'search_terms': ['Japan', '日本', '日本电商']},
    'kr': {'name': '韩国', 'en': 'South Korea', 'search_terms': ['South Korea', '韩国', '韩国电商']},
    'au': {'name': '澳大利亚', 'en': 'Australia', 'search_terms': ['Australia', '澳大利亚', '澳洲电商']},
    'in': {'name': '印度', 'en': 'India', 'search_terms': ['India', '印度', '印度电商']},
    'pk': {'name': '巴基斯坦', 'en': 'Pakistan', 'search_terms': ['Pakistan', '巴基斯坦', '巴基斯坦电商']},
    # CIS
    'ru': {'name': '俄罗斯', 'en': 'Russia', 'search_terms': ['Russia', '俄罗斯', '俄罗斯电商']},
    'ua': {'name': '乌克兰', 'en': 'Ukraine', 'search_terms': ['Ukraine', '乌克兰', '乌克兰电商']},
    'kz': {'name': '哈萨克斯坦', 'en': 'Kazakhstan', 'search_terms': ['Kazakhstan', '哈萨克斯坦', '哈萨克电商']},
}

def _search_country_federal_register(country_key, country_en):
    """Search Federal Register for trade policies related to a specific country."""
    items = []
    # Build search terms for Federal Register
    terms = [country_en, f'{country_en} tariff', f'{country_en} trade']
    if country_key == 'us':
        terms = ['China tariff', 'China trade', 'Section 301', 'de minimis']
    
    for term in terms[:3]:
        url = (
            f"https://www.federalregister.gov/api/v1/documents.json?"
            f"conditions[term]={term}"
            f"&conditions[type]=RULE"
            f"&per_page=5&order=newest"
            f"&fields[]=title&fields[]=abstract&fields[]=publication_date&fields[]=html_url"
        )
        data = fetch_json(url)
        if not data or 'results' not in data:
            continue
        for doc in data['results']:
            title = doc.get('title', '').strip()
            abstract = doc.get('abstract', '') or ''
            abstract = re.sub(r'<[^>]+>', '', abstract).strip()
            pub_date = doc.get('publication_date', NOW_DATE)
            html_url = doc.get('html_url', '')
            if not title:
                continue
            # Check relevance - must mention country or trade keywords
            lower_title = title.lower()
            relevant = False
            if country_key == 'us':
                relevant = any(kw in lower_title for kw in ['china', 'tariff', 'duty', 'trade', 'import', 'export', 'sanction'])
            else:
                relevant = country_en.lower() in lower_title or any(
                    kw in lower_title for kw in ['tariff', 'trade', 'sanction', 'import', 'export']
                )
            if not relevant:
                continue
            
            # Determine impact level
            impact = 'mid'
            high_kw = ['tariff', 'duty', 'sanction', 'embargo', 'quota', 'ban', 'prohibit']
            if any(kw in lower_title for kw in high_kw):
                impact = 'high'
            
            items.append({
                'impact': impact,
                'title': title,
                'date': pub_date,
                'source': 'Federal Register',
                'source_url': html_url,
                'description': abstract[:200] if abstract else title,
            })
        if items:
            break
    return items


def _search_country_news(country_key, search_terms):
    """Search Chinese e-commerce news sites for country-related news."""
    items = []
    # Search AMZ123
    for term in search_terms[:2]:
        url = f'https://www.amz123.com/search?q={term}'
        html = fetch_html(url)
        if not html:
            continue
        patterns = [
            r'<a[^>]+href="(/[^"]+)"[^>]*>([^<]*' + re.escape(term) + r'[^<]*)</a>',
            r'"title":"([^"]*' + re.escape(term) + r'[^"]*)"',
            r'<h[234][^>]*>([^<]*' + re.escape(term) + r'[^<]*)</h[234]>',
        ]
        seen = set()
        for pat in patterns:
            matches = re.findall(pat, html, re.IGNORECASE)
            for m in matches:
                title = m.strip() if isinstance(m, str) else str(m).strip()
                if len(title) < 8 or title in seen:
                    continue
                seen.add(title)
                items.append({
                    'title': title[:100],
                    'source': 'AMZ123',
                })
        if items:
            break
    
    # Search 雨果网
    for term in search_terms[:2]:
        url = f'https://www.cifnews.com/search?keyword={term}'
        html = fetch_html(url)
        if not html:
            continue
        patterns = [
            r'"title":"([^"]*' + re.escape(term) + r'[^"]*)"',
            r'<a[^>]+href="(https?://[^"]*cifnews[^"]*)"[^>]*>([^<]*' + re.escape(term) + r'[^<]*)</a>',
            r'<h[234][^>]*>\s*<a[^>]+>([^<]*' + re.escape(term) + r'[^<]*)</a>',
        ]
        seen = set()
        for pat in patterns:
            matches = re.findall(pat, html, re.IGNORECASE)
            for m in matches:
                title = m.strip() if isinstance(m, str) else str(m).strip()
                if isinstance(title, str) and len(title) < 8:
                    continue
                if title in seen:
                    continue
                seen.add(title)
                items.append({
                    'title': title[:100],
                    'source': '雨果网',
                })
        if items:
            break
    
    return items


def collect_country_updates():
    """Collect latest trade policy updates for each country profile.
    Rotates through 4 countries per run to avoid timeout.
    Updates ai.risks and comp.policies in data/countries.json.
    """
    print("\n[Country Updates] Collecting country profile dynamics...")
    
    countries_file = os.path.join(DATA_DIR, 'countries.json')
    if not os.path.exists(countries_file):
        print("  [WARN] data/countries.json not found, skipping country updates")
        return
    
    with open(countries_file, 'r', encoding='utf-8') as f:
        countries = json.load(f)
    
    print(f"  Loaded {len(countries)} country profiles")
    
    # Rotate: update 8 countries per run based on date
    # With 39 countries and 4-hour intervals, all countries cycle in ~2 days
    all_keys = list(COUNTRY_CONFIG.keys())
    day_of_year = NOW.timetuple().tm_yday
    hour = NOW.hour
    start_idx = (day_of_year * 6 + hour // 4) % len(all_keys)
    # Pick 8 consecutive countries in rotation
    rotate_keys = []
    for i in range(8):
        rotate_keys.append(all_keys[(start_idx + i) % len(all_keys)])
    
    print(f"  Rotating: updating {rotate_keys}")
    
    updated_count = 0
    for country_key in rotate_keys:
        if country_key not in countries:
            continue
        
        config = COUNTRY_CONFIG[country_key]
        country_data = countries[country_key]
        print(f"\n  [{country_key}] {config['name']} ({config['en']})")
        
        has_update = False
        
        # 1. Search Federal Register for trade policies
        fr_items = []
        try:
            fr_items = _search_country_federal_register(country_key, config['en'])
            print(f"    Federal Register: {len(fr_items)} relevant items")
        except Exception as e:
            print(f"    [WARN] Federal Register search failed: {e}")
        
        # 2. Search Chinese e-commerce news
        news_items = []
        try:
            news_items = _search_country_news(country_key, config['search_terms'])
            print(f"    News sources: {len(news_items)} items")
        except Exception as e:
            print(f"    [WARN] News search failed: {e}")
        
        # Update ai.risks - add new risk warnings from Federal Register
        if fr_items:
            existing_risks = country_data.get('ai', {}).get('risks', [])
            for item in fr_items[:2]:  # Add at most 2 new risks
                risk_text = f"⚠️ {item['title'][:60]}（{item.get('source', '')} {item.get('date', '')}）"
                # Check if similar risk already exists
                is_dup = any(
                    item['title'][:20].lower() in r.lower()
                    for r in existing_risks
                )
                if not is_dup:
                    # Insert after existing warnings (keep max 5)
                    existing_risks.insert(0, risk_text)
                    has_update = True
                    print(f"    + Risk: {risk_text[:60]}...")
            # Keep max 5 risks
            country_data['ai']['risks'] = existing_risks[:5]
        
        # Update comp.policies - add high-impact policies from news
        if news_items:
            existing_policies = country_data.get('comp', {}).get('policies', [])
            for item in news_items[:2]:  # Add at most 2 new policy items
                policy_title = item['title'][:50]
                # Check if similar policy already exists
                is_dup = any(
                    policy_title[:15].lower() in p[1].lower() if len(p) > 1 else False
                    for p in existing_policies
                )
                if not is_dup:
                    # Determine impact level
                    impact = 'low'
                    high_kw = ['关税', '制裁', '禁止', '新规', '强制', 'ban', 'tariff', 'sanction']
                    mid_kw = ['监管', '合规', '认证', '税务', 'tax', 'regulation']
                    if any(kw in policy_title.lower() for kw in high_kw):
                        impact = 'high'
                    elif any(kw in policy_title.lower() for kw in mid_kw):
                        impact = 'mid'
                    
                    # Format: [level, policy_name, date, category, platform, description]
                    new_policy = [
                        impact,
                        policy_title,
                        NOW_DATE,
                        '全品类',
                        '全平台',
                        f"来源: {item.get('source', '网络')}"
                    ]
                    existing_policies.insert(0, new_policy)
                    has_update = True
                    print(f"    + Policy: {policy_title}")
            # Keep max 6 policies (high priority first)
            country_data['comp']['policies'] = existing_policies[:6]
        
        if has_update:
            updated_count += 1
    
    if updated_count > 0:
        # Add metadata
        countries['_metadata'] = {
            'last_updated': NOW_ISO,
            'updated_countries': rotate_keys,
        }
        with open(countries_file, 'w', encoding='utf-8') as f:
            json.dump(countries, f, ensure_ascii=False, indent=2)
        print(f"\n  Updated {updated_count} country profiles in countries.json")
    else:
        print("  No new country updates found")


# ---- Supabase Sync ----
def sync_to_supabase(policies_data, rules_data):
    """Sync collected data to Supabase PostgreSQL database.
    Uses service_role key from environment variables.
    Only syncs if SUPABASE_URL and SUPABASE_SERVICE_KEY are configured.
    """
    supabase_url = os.environ.get('SUPABASE_URL', '').strip()
    service_key = os.environ.get('SUPABASE_SERVICE_KEY', '').strip()
    
    if not supabase_url or not service_key:
        print("\n[Supabase Sync] Skipped - no credentials configured")
        print("  Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars to enable")
        return
    
    print("\n[Supabase Sync] Starting data sync...")
    api_url = f"{supabase_url}/rest/v1"
    headers = {
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=merge-duplicates'
    }
    
    sync_count = 0
    
    # 1. Sync policies
    try:
        payload = json.dumps({
            'key': 'policies',
            'data': policies_data,
            'meta': {
                'source': 'policies.json',
                'updated_at': policies_data.get('updated_at', NOW_ISO),
                'source_count': policies_data.get('source_count', 0),
                'item_count': len(policies_data.get('items', []))
            }
        }).encode('utf-8')
        req = Request(f"{api_url}/market_data", data=payload, headers=headers, method='POST')
        with urlopen(req, timeout=30) as resp:
            if resp.status in (200, 201):
                sync_count += 1
                print(f"  ✅ policies synced ({len(policies_data.get('items', []))} items)")
    except Exception as e:
        print(f"  ❌ policies sync failed: {e}")
    
    # 2. Sync rules
    try:
        payload = json.dumps({
            'key': 'rules',
            'data': rules_data,
            'meta': {
                'source': 'rules.json',
                'updated_at': rules_data.get('updated_at', NOW_ISO),
                'source_count': rules_data.get('source_count', 0),
                'item_count': len(rules_data.get('items', []))
            }
        }).encode('utf-8')
        req = Request(f"{api_url}/market_data", data=payload, headers=headers, method='POST')
        with urlopen(req, timeout=30) as resp:
            if resp.status in (200, 201):
                sync_count += 1
                print(f"  ✅ rules synced ({len(rules_data.get('items', []))} items)")
    except Exception as e:
        print(f"  ❌ rules sync failed: {e}")
    
    # 3. Sync countries (read from file)
    countries_file = os.path.join(DATA_DIR, 'countries.json')
    if os.path.exists(countries_file):
        try:
            with open(countries_file, 'r', encoding='utf-8') as f:
                countries = json.load(f)
            # Filter out metadata
            cleaned = {k: v for k, v in countries.items() if not k.startswith('_')}
            payload = json.dumps({
                'key': 'countries',
                'data': cleaned,
                'meta': {
                    'source': 'countries.json',
                    'country_count': len(cleaned),
                    'country_codes': list(cleaned.keys()),
                    'updated_at': NOW_ISO
                }
            }).encode('utf-8')
            req = Request(f"{api_url}/market_data", data=payload, headers=headers, method='POST')
            with urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    sync_count += 1
                    print(f"  ✅ countries synced ({len(cleaned)} profiles)")
        except Exception as e:
            print(f"  ❌ countries sync failed: {e}")
    
    # 4. Sync platforms (read from file)
    platforms_file = os.path.join(DATA_DIR, 'platforms.json')
    if os.path.exists(platforms_file):
        try:
            with open(platforms_file, 'r', encoding='utf-8') as f:
                platforms = json.load(f)
            if isinstance(platforms, list):
                regions = set(p.get('region', '') for p in platforms if p.get('region'))
                payload = json.dumps({
                    'key': 'platforms',
                    'data': platforms,
                    'meta': {
                        'source': 'platforms.json',
                        'platform_count': len(platforms),
                        'regions': sorted(regions),
                        'updated_at': NOW_ISO
                    }
                }).encode('utf-8')
                req = Request(f"{api_url}/market_data", data=payload, headers=headers, method='POST')
                with urlopen(req, timeout=30) as resp:
                    if resp.status in (200, 201):
                        sync_count += 1
                        print(f"  ✅ platforms synced ({len(platforms)} platforms)")
        except Exception as e:
            print(f"  ❌ platforms sync failed: {e}")
    
    # 5. Sync alerts (read from file)
    alerts_file = os.path.join(DATA_DIR, 'alerts.json')
    if os.path.exists(alerts_file):
        try:
            with open(alerts_file, 'r', encoding='utf-8') as f:
                alerts = json.load(f)
            if isinstance(alerts, list):
                payload = json.dumps({
                    'key': 'alerts',
                    'data': alerts,
                    'meta': {
                        'source': 'alerts.json',
                        'alert_count': len(alerts),
                        'updated_at': NOW_ISO
                    }
                }).encode('utf-8')
                req = Request(f"{api_url}/market_data", data=payload, headers=headers, method='POST')
                with urlopen(req, timeout=30) as resp:
                    if resp.status in (200, 201):
                        sync_count += 1
                        print(f"  ✅ alerts synced ({len(alerts)} alerts)")
        except Exception as e:
            print(f"  ❌ alerts sync failed: {e}")

    print(f"[Supabase Sync] Complete: {sync_count}/5 datasets synced")


def validate_local():
    """Offline validation of all 5 local data files (no network).
    Used by CI/operators to catch corrupt JSON before a sync run."""
    print("=== Validate local data files ===")
    specs = {
        'countries': ('countries.json', 'object'),
        'platforms': ('platforms.json', 'list'),
        'policies': ('policies.json', 'object'),
        'rules': ('rules.json', 'object'),
        'alerts': ('alerts.json', 'list'),
    }
    ok = True
    for key, (fn, exp) in specs.items():
        fp = os.path.join(DATA_DIR, fn)
        if not os.path.exists(fp):
            print(f"  ❌ {key}: missing {fn}")
            ok = False
            continue
        try:
            with open(fp, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if exp == 'list' and not isinstance(data, list):
                print(f"  ❌ {key}: expected list, got {type(data).__name__}")
                ok = False
                continue
            if exp == 'object' and not isinstance(data, dict):
                print(f"  ❌ {key}: expected object, got {type(data).__name__}")
                ok = False
                continue
            if key == 'policies':
                cnt = len(data.get('items', []))
            elif key == 'rules':
                cnt = len(data.get('items', []))
            else:
                cnt = len(data)
            print(f"  ✅ {key}: valid ({cnt} records)")
        except Exception as e:
            print(f"  ❌ {key}: parse error {e}")
            ok = False
    print("Validation", "PASSED ✅" if ok else "FAILED ❌")
    return ok


# ---- Main ----
def main():
    print(f"=== Mercator Data Collector ===")
    print(f"Time: {NOW_ISO}")
    print(f"Data dir: {DATA_DIR}")
    print()
    
    # Collect from all sources
    all_policies = []
    all_rules = []
    rule_source_checked = False
    
    # Policy sources
    try:
        all_policies.extend(collect_federal_register())
    except Exception as e:
        print(f"  [ERROR] Federal Register: {e}")
        traceback.print_exc()
    
    try:
        all_policies.extend(collect_ustr())
    except Exception as e:
        print(f"  [ERROR] USTR: {e}")
        traceback.print_exc()
    
    try:
        all_policies.extend(collect_eu_trade())
    except Exception as e:
        print(f"  [ERROR] EU Trade: {e}")
        traceback.print_exc()
    
    try:
        all_policies.extend(collect_mofcom())
    except Exception as e:
        print(f"  [ERROR] MOFCOM: {e}")
        traceback.print_exc()
    
    try:
        cn_items = collect_cn_news()
        # Keep third-party news in the advisory policy feed regardless of
        # whether an article mentions a platform. Platform-specific articles
        # are still not official platform rules and must not enter the formal
        # rules projection.
        for item in cn_items:
            all_policies.append(item)
    except Exception as e:
        print(f"  [ERROR] CN News: {e}")
        traceback.print_exc()
    
    # Rule sources
    try:
        items, checked = collect_tiktok_shop(include_status=True)
        all_rules.extend(items)
        rule_source_checked = rule_source_checked or checked
    except Exception as e:
        print(f"  [ERROR] TikTok Shop: {e}")
        traceback.print_exc()
    
    try:
        items, checked = collect_amazon(include_status=True)
        all_rules.extend(items)
        rule_source_checked = rule_source_checked or checked
    except Exception as e:
        print(f"  [ERROR] Amazon: {e}")
        traceback.print_exc()
    
    print(f"\n--- Article Extraction ---")
    
    # Extract article summaries for items with empty summary
    # Limit total to 30 articles to avoid GitHub Actions timeout
    all_items = all_policies + all_rules
    empty_summary_items = [item for item in all_items if not item.get('summary', '').strip() and item.get('source_url')]
    article_limit = min(30, len(empty_summary_items))
    ai_limit = 20
    ai_count = 0
    article_count = 0
    print(f"  Items with empty summary: {len(empty_summary_items)}")
    print(f"  Article extraction limit: {article_limit}")
    print(f"  AI summarization limit: {ai_limit}")
    
    for item in empty_summary_items[:article_limit]:
        url = item.get('source_url', '')
        if not url:
            continue
        print(f"  [{article_count+1}/{article_limit}] Extracting: {item['title'][:60]}...")
        raw_text = extract_article_summary(url)
        article_count += 1
        
        if not raw_text:
            print(f"    -> No content extracted")
            continue
        
        # Determine item type
        item_type = 'policy' if item in all_policies else 'rule'
        
        # Try AI summarization if configured and under limit
        if ai_count < ai_limit:
            ai_result = ai_summarize(item['title'], raw_text, item_type)
            if ai_result:
                item['summary'] = ai_result
                ai_count += 1
                print(f"    -> AI summary generated ({len(ai_result)} chars)")
                continue
        
        # Fallback: use extracted text
        item['summary'] = raw_text
        print(f"    -> Text-only summary ({len(raw_text)} chars)")
    
    print(f"  Article extraction complete: {article_count} attempted")
    print(f"  AI summaries generated: {ai_count}")

    # Some headlines are generic while the extracted body names the target
    # market. Refresh advisory scope after extraction before persisting it.
    for item in all_policies:
        if item.get('source_class') == 'industry_advisory':
            refresh_industry_market_scope(item)
    
    print(f"\n--- Merge Results ---")
    
    # Merge with existing data
    policies_file = os.path.join(DATA_DIR, 'policies.json')
    rules_file = os.path.join(DATA_DIR, 'rules.json')
    
    policies_data, p_added = merge_data(policies_file, all_policies, baseline_kind='policies')
    rules_data, r_added = merge_data(rules_file, all_rules, baseline_kind='rules')
    if rule_source_checked:
        rules_data['last_checked_at'] = NOW_ISO
    
    # Save
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(policies_file, 'w', encoding='utf-8') as f:
        json.dump(policies_data, f, ensure_ascii=False, indent=2)
    with open(rules_file, 'w', encoding='utf-8') as f:
        json.dump(rules_data, f, ensure_ascii=False, indent=2)
    
    print(f"Policies: {len(policies_data['items'])} total, +{p_added} new")
    print(f"Rules: {len(rules_data['items'])} total, +{r_added} new")
    
    # Update platform dynamics
    try:
        collect_platform_updates()
    except Exception as e:
        print(f"  [ERROR] Platform updates: {e}")
        traceback.print_exc()
    
    # Update country profiles
    try:
        collect_country_updates()
    except Exception as e:
        print(f"  [ERROR] Country updates: {e}")
        traceback.print_exc()
    
    print(f"\n=== Collection complete ===")
    print("Publish is deferred until scripts/validate_data.py passes.")
    return 0

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Mercator data collector / syncer')
    parser.add_argument('--sync-only', action='store_true',
                        help='只把现有本地 JSON 上传到 Supabase（不采集网络），用于快速补数/修复')
    parser.add_argument('--validate', action='store_true',
                        help='仅离线校验本地 5 个数据文件结构，不联网、不写库')
    parser.add_argument('--merge-baseline', action='store_true',
                        help='离线把 data/{policies,rules}_baseline.json 并入对应数据文件（不联网、不写库）')
    parser.add_argument('--make-baseline', metavar='KIND',
                        help='把当前 data/KIND.json 快照为人工基线 data/KIND_baseline.json（KIND=policies|rules）')
    args = parser.parse_args()

    if args.validate:
        sys.exit(0 if validate_local() else 1)

    if args.make_baseline:
        kind = args.make_baseline
        if kind not in ('policies', 'rules'):
            print(f"❌ KIND 必须是 policies 或 rules，收到: {kind}")
            sys.exit(1)
        src = os.path.join(DATA_DIR, f'{kind}.json')
        if not os.path.exists(src):
            print(f"❌ 找不到 {src}")
            sys.exit(1)
        with open(src, 'r', encoding='utf-8') as f:
            d = json.load(f)
        items = d.get('items', []) if isinstance(d, dict) else d
        dst = os.path.join(DATA_DIR, f'{kind}_baseline.json')
        with open(dst, 'w', encoding='utf-8') as f:
            json.dump({
                'note': '人工整理基线，采集器每次运行都会并入并保护其不被裁剪。新增/修订请直接编辑本文件。',
                'created_at': NOW_ISO,
                'items': items,
            }, f, ensure_ascii=False, indent=2)
        print(f"✅ 基线已生成: {dst}（{len(items)} 条）")
        sys.exit(0)

    if args.merge_baseline:
        rc = 0
        for kind in ('policies', 'rules'):
            path = os.path.join(DATA_DIR, f'{kind}.json')
            if not os.path.exists(path):
                print(f"  [SKIP] {path} 不存在")
                continue
            before = 0
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    before = len(json.load(f).get('items', []))
            except Exception:
                pass
            merged, _ = merge_data(path, [], baseline_kind=kind)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(merged, f, ensure_ascii=False, indent=2)
            print(f"✅ {kind}: {before} → {len(merged['items'])} 条")
        sys.exit(rc)

    if args.sync_only:
        import subprocess
        sync_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sync_to_supabase.py')
        print('[DEPRECATED] --sync-only now delegates to the gated centralized sync.')
        sys.exit(subprocess.call([sys.executable, sync_script]))

    sys.exit(main())
