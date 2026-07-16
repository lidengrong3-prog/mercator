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
                except:
                    continue
            return data.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  [WARN] fetch_html failed for {url}: {e}")
        return None

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
def collect_tiktok_shop():
    """Collect TikTok Shop policy updates."""
    print("[3/6] Collecting TikTok Shop policy updates...")
    items = []
    
    # TikTok Shop seller academy policy page
    urls = [
        'https://seller.tiktokshopglobalselling.com/university/new-policies?identity=1&module_id=latest_policies',
    ]
    
    for url in urls:
        html = fetch_html(url)
        if not html:
            continue
        
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
    return items

# ---- Source: Amazon Seller Central News ----
def collect_amazon():
    """Collect Amazon Seller Central announcements."""
    print("[4/6] Collecting Amazon Seller Central announcements...")
    items = []
    
    html = fetch_html('https://sellercentral.amazon.com/news')
    if not html:
        html = fetch_html('https://sellercentral.amazon.com/gp/help/news')
    if not html:
        print("  [WARN] Could not fetch Amazon Seller Central news")
        return items
    
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
    return items

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
            items.append({
                'id': gen_id('p', title),
                'title': title,
                'summary': '',
                'source': '雨果网',
                'source_url': url,
                'region': 'Global',
                'category': 'regulation',
                'impact_level': 'medium',
                'published_at': NOW_DATE,
                'collected_at': NOW_ISO
            })
            if len(items) >= 8:
                break
    
    # AMZ123
    html2 = fetch_html('https://www.amz123.com/')
    if html2:
        pattern = r'<a[^>]+href="(/t/[^"]+)"[^>]*>([^<]{10,100})</a>'
        matches = re.findall(pattern, html2)
        seen2 = set()
        for path, title in matches:
            title = title.strip()
            if title in seen2 or len(title) < 10:
                continue
            policy_kw = ['政策', '新规', '规则', '关税', '合规', '调整', '变更', '费用', 'FBA', '物流']
            if not any(kw in title for kw in policy_kw):
                continue
            seen2.add(title)
            items.append({
                'id': gen_id('p', title),
                'title': title,
                'summary': '',
                'source': 'AMZ123',
                'source_url': f'https://www.amz123.com{path}',
                'region': 'Global',
                'category': 'regulation',
                'impact_level': 'medium',
                'published_at': NOW_DATE,
                'collected_at': NOW_ISO
            })
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


# ---- Merge & Deduplicate ----
def merge_data(existing_file, new_items, key_fields=['title']):
    """Merge new items with existing data, dedup by title similarity."""
    if os.path.exists(existing_file):
        with open(existing_file, 'r', encoding='utf-8') as f:
            existing = json.load(f)
    else:
        existing = {'updated_at': NOW_ISO, 'source_count': 0, 'items': []}
    
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
    
    # Keep only last 200 items to prevent file bloat
    existing['items'] = existing['items'][:200]
    existing['updated_at'] = NOW_ISO
    existing['source_count'] = 6  # We have 6 source groups
    
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


def _search_amz123(platform_name, aliases):
    """Search AMZ123 for platform news."""
    items = []
    for alias in aliases[:2]:
        url = f'https://www.amz123.com/search?q={alias}'
        html = fetch_html(url)
        if not html:
            continue
        # Find article titles
        patterns = [
            r'<a[^>]+href="(/[^"]+)"[^>]*>([^<]*' + re.escape(alias) + r'[^<]*)</a>',
            r'<h[234][^>]*>([^<]*' + re.escape(alias) + r'[^<]*)</h[234]>',
            r'"title":"([^"]*' + re.escape(alias) + r'[^"]*)"',
        ]
        seen = set()
        for pat in patterns:
            matches = re.findall(pat, html, re.IGNORECASE)
            for m in matches:
                title = m.strip() if isinstance(m, str) else str(m).strip()
                if len(title) < 8 or title in seen:
                    continue
                seen.add(title)
                items.append(title)
        if items:
            break
    return items


def _search_cifnews(platform_name, aliases):
    """Search 雨果网 for platform news."""
    items = []
    for alias in aliases[:2]:
        url = f'https://www.cifnews.com/search?keyword={alias}'
        html = fetch_html(url)
        if not html:
            continue
        patterns = [
            r'<a[^>]+href="(https?://[^"]*cifnews[^"]*)"[^>]*>([^<]*' + re.escape(alias) + r'[^<]*)</a>',
            r'"title":"([^"]*' + re.escape(alias) + r'[^"]*)"',
            r'<h[234][^>]*>\s*<a[^>]+>([^<]*' + re.escape(alias) + r'[^<]*)</a>',
        ]
        seen = set()
        for pat in patterns:
            matches = re.findall(pat, html, re.IGNORECASE)
            for m in matches:
                if isinstance(m, tuple):
                    title = m[1].strip() if len(m) > 1 else m[0].strip()
                else:
                    title = m.strip()
                if len(title) < 8 or title in seen:
                    continue
                seen.add(title)
                items.append(title)
        if items:
            break
    return items


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
    
    print(f"[Supabase Sync] Complete: {sync_count}/4 datasets synced")


# ---- Main ----
def main():
    print(f"=== Mercator Data Collector ===")
    print(f"Time: {NOW_ISO}")
    print(f"Data dir: {DATA_DIR}")
    print()
    
    # Collect from all sources
    all_policies = []
    all_rules = []
    
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
        # Separate CN news into policies vs rules based on content
        for item in cn_items:
            rule_kw = ['平台', '亚马逊', 'TikTok', 'Shopee', 'Temu', 'SHEIN', 'Lazada', '店铺', '卖家']
            if any(kw in item.get('title', '') for kw in rule_kw):
                item.pop('region', None)
                item.pop('source', None)
                item['platform'] = 'Multi'
                item['market'] = 'Global'
                item['id'] = gen_id('r', item['title'])
                all_rules.append(item)
            else:
                all_policies.append(item)
    except Exception as e:
        print(f"  [ERROR] CN News: {e}")
        traceback.print_exc()
    
    # Rule sources
    try:
        all_rules.extend(collect_tiktok_shop())
    except Exception as e:
        print(f"  [ERROR] TikTok Shop: {e}")
        traceback.print_exc()
    
    try:
        all_rules.extend(collect_amazon())
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
    
    print(f"\n--- Merge Results ---")
    
    # Merge with existing data
    policies_file = os.path.join(DATA_DIR, 'policies.json')
    rules_file = os.path.join(DATA_DIR, 'rules.json')
    
    policies_data, p_added = merge_data(policies_file, all_policies)
    rules_data, r_added = merge_data(rules_file, all_rules)
    
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
    
    # Sync data to Supabase
    try:
        sync_to_supabase(policies_data, rules_data)
    except Exception as e:
        print(f"  [ERROR] Supabase sync: {e}")
        traceback.print_exc()
    
    print(f"\n=== Collection complete ===")

if __name__ == '__main__':
    main()
