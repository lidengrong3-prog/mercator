#!/usr/bin/env python3
"""
Mercator Data Collector
Collects trade policies and platform rules from multiple sources.
Runs via GitHub Actions every 4 hours.
"""

import json
import os
import uuid
import re
import sys
import hashlib
import subprocess
import traceback
import time
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit, urljoin
from html import unescape
from html.parser import HTMLParser

from source_governance import (
    SourceGovernanceError,
    assert_source_collectable,
    canonical_source_key,
)
from collection_telemetry import merge_collection_report

# ---- Config ----
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
BJT = timezone(timedelta(hours=8))
NOW = datetime.now(BJT)
NOW_ISO = NOW.isoformat()
NOW_DATE = NOW.strftime('%Y-%m-%d')
COLLECTION_STARTED_AT = None
COLLECTION_RUN_ID = None
COLLECTION_SCOPE = {}
COLLECTION_SOURCES = {}

def gen_id(prefix, title):
    h = hashlib.md5(title.encode()).hexdigest()[:8]
    return f"{prefix}{NOW.strftime('%Y%m%d')}-{h}"


def build_query_url(base_url, params):
    """Build a URL with UTF-8 encoded query values and repeated keys."""
    parts = urlsplit(str(base_url or '').strip())
    if parts.scheme not in {'http', 'https'} or not parts.netloc:
        raise ValueError('base_url must be an absolute HTTP(S) URL')
    existing = parse_qsl(parts.query, keep_blank_values=True)
    additions = list(params.items()) if isinstance(params, dict) else list(params or [])
    query = urlencode(existing + additions, doseq=True)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def _load_market_scope_manifest():
    path = os.path.join(DATA_DIR, 'market_scope.json')
    try:
        with open(path, encoding='utf-8') as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def configured_collection_scope(manifest=None):
    """Return only active markets with a configured data connection."""
    manifest = manifest if isinstance(manifest, dict) else _load_market_scope_manifest()
    markets = [
        item for item in manifest.get('markets', [])
        if isinstance(item, dict)
        and str(item.get('status') or 'active').strip().lower() == 'active'
        and str(item.get('data_status') or '').strip().lower() == 'configured'
        and str(item.get('code') or '').strip()
    ]
    market_codes = {str(item.get('code')).strip().upper() for item in markets}
    platform_map = {
        str(item.get('key') or '').strip().casefold(): item
        for item in manifest.get('platforms', [])
        if isinstance(item, dict) and str(item.get('key') or '').strip()
    }
    market_platforms = [
        item for item in manifest.get('market_platforms', [])
        if isinstance(item, dict)
        and str(item.get('market_code') or '').strip().upper() in market_codes
        and str(item.get('status') or 'active').strip().lower() == 'active'
        and str(item.get('data_status') or '').strip().lower() == 'configured'
    ]
    platform_keys = list(dict.fromkeys(
        str(item.get('platform_key') or '').strip().casefold()
        for item in market_platforms
        if str(item.get('platform_key') or '').strip().casefold() in platform_map
    ))
    return {
        'config_version': str(manifest.get('config_version') or ''),
        'market_codes': sorted(market_codes),
        'platform_keys': platform_keys,
        'platform_names': [
            str(platform_map[key].get('name') or key).strip()
            for key in platform_keys
        ],
    }


def reset_collection_telemetry(scope=None):
    global COLLECTION_STARTED_AT, COLLECTION_RUN_ID, COLLECTION_SCOPE, COLLECTION_SOURCES
    COLLECTION_STARTED_AT = datetime.now(timezone.utc)
    COLLECTION_RUN_ID = str(os.environ.get('COLLECTION_RUN_ID') or uuid.uuid4())
    COLLECTION_SCOPE = dict(scope or {})
    COLLECTION_SOURCES = {}


def register_collection_source(
    key, label, domain, *, core=False, market_codes=None, platform_keys=None
):
    source = COLLECTION_SOURCES.setdefault(str(key), {
        'key': str(key),
        'source_key': canonical_source_key(key),
        'label': str(label),
        'domain': str(domain),
        'core': bool(core),
        'market_codes': list(dict.fromkeys(market_codes or [])),
        'platform_keys': list(dict.fromkeys(platform_keys or [])),
        'collector_status': 'pending',
        'request_count': 0,
        'successful_requests': 0,
        'failed_requests': 0,
        'request_duration_ms': 0,
        'duration_ms': 0,
        'records_collected': 0,
        'records_in_scope': 0,
        'errors': [],
    })
    source['core'] = source['core'] or bool(core)
    source['market_codes'] = list(dict.fromkeys(source['market_codes'] + list(market_codes or [])))
    source['platform_keys'] = list(dict.fromkeys(source['platform_keys'] + list(platform_keys or [])))
    return source


def _record_http_result(source, *, success, duration_ms, error=None):
    source['request_count'] += 1
    source['request_duration_ms'] += max(int(duration_ms), 0)
    counter = 'successful_requests' if success else 'failed_requests'
    source[counter] += 1
    if error:
        message = re.sub(r'\s+', ' ', str(error)).strip()[:300]
        if message and message not in source['errors']:
            source['errors'].append(message)


def _source_status(source):
    if source.get('collector_status') == 'failed':
        return 'failed'
    if source.get('request_count', 0) and not source.get('successful_requests', 0):
        return 'failed'
    if source.get('failed_requests', 0):
        return 'degraded'
    if source.get('collector_status') == 'degraded':
        return 'degraded'
    if source.get('collector_status') == 'skipped':
        return 'skipped'
    return 'succeeded'


def run_collection_source(
    key, label, domain, collector, *, core=False, market_codes=None,
    platform_keys=None, assign_scope=True
):
    """Run one logical source and retain its outcome even after a failure."""
    source = register_collection_source(
        key, label, domain, core=core,
        market_codes=market_codes, platform_keys=platform_keys,
    )
    try:
        source['source_key'] = assert_source_collectable(key)
    except SourceGovernanceError as error:
        source['collector_status'] = 'skipped'
        source['errors'].append(str(error))
        print(f"  [SKIP] {label}: {error}")
        return []
    started = time.perf_counter()
    try:
        result = collector()
        items = result[0] if isinstance(result, tuple) else result
        items = items if isinstance(items, list) else []
        if source.get('collector_status') == 'pending':
            source['collector_status'] = 'succeeded'
    except Exception as error:
        source['collector_status'] = 'failed'
        message = re.sub(r'\s+', ' ', str(error)).strip()[:300]
        if message and message not in source['errors']:
            source['errors'].append(message)
        print(f"  [ERROR] {label}: {error}")
        traceback.print_exc()
        items = []
    source['duration_ms'] = max(int((time.perf_counter() - started) * 1000), 0)
    source['records_collected'] = len(items)
    source['records_in_scope'] = len(items)
    if assign_scope:
        for item in items:
            if not isinstance(item, dict):
                continue
            if market_codes:
                item['market_codes'] = list(market_codes)
            if len(market_codes or []) == 1:
                item['market'] = list(market_codes)[0]
            if platform_keys:
                item['platform_keys'] = list(platform_keys)
            if len(platform_keys or []) == 1:
                item['platform_key'] = list(platform_keys)[0]
    return items


def set_collection_scope_count(key, count):
    if key in COLLECTION_SOURCES:
        COLLECTION_SOURCES[key]['records_in_scope'] = max(int(count), 0)


def collection_source_checked(key):
    source = COLLECTION_SOURCES.get(key)
    return bool(source) and _source_status(source) in {'succeeded', 'degraded'}


def build_collection_report():
    completed_at = datetime.now(timezone.utc)
    sources = []
    for source in COLLECTION_SOURCES.values():
        row = dict(source)
        row['status'] = _source_status(source)
        row['duration_ms'] = max(row['duration_ms'], row['request_duration_ms'])
        row.pop('collector_status', None)
        sources.append(row)
    core_failures = [
        row['key'] for row in sources
        if row['core'] and row['status'] in {'failed', 'skipped'}
    ]
    failed_sources = [row['key'] for row in sources if row['status'] == 'failed']
    degraded_sources = [row['key'] for row in sources if row['status'] == 'degraded']
    return {
        # v2 is the full-pipeline contract. The US category, CPSC and
        # FRED/BLS collectors append their source rows after this process.
        # Starting at v2 prevents a partially executed workflow from being
        # accepted as a legacy, complete collection run.
        'schema_version': 2,
        'run_id': COLLECTION_RUN_ID or str(uuid.uuid4()),
        'started_at': (COLLECTION_STARTED_AT or completed_at).isoformat(),
        'completed_at': completed_at.isoformat(),
        'duration_ms': max(int((completed_at - (COLLECTION_STARTED_AT or completed_at)).total_seconds() * 1000), 0),
        'status': 'failed' if core_failures else ('degraded' if failed_sources or degraded_sources else 'healthy'),
        'scope': dict(COLLECTION_SCOPE),
        'legacy_global_writes': False,
        'sources': sources,
        'summary': {
            'sources': len(sources),
            'succeeded': sum(row['status'] == 'succeeded' for row in sources),
            'degraded': len(degraded_sources),
            'failed': len(failed_sources),
            'core_failures': core_failures,
            'records_collected': sum(row['records_collected'] for row in sources),
            'records_in_scope': sum(row['records_in_scope'] for row in sources),
        },
    }


def write_collection_report(path=None):
    path = path or os.path.join(DATA_DIR, 'collection_run.json')
    report = build_collection_report()
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    report = merge_collection_report(report, path=path)
    print(
        f"[Collection Report] status={report['status']} "
        f"sources={report['summary']['sources']} core_failures={len(report['summary']['core_failures'])}"
    )
    return report


SOURCE_KINDS = ('official', 'traceable', 'uploaded', 'derived', 'demo')
VERIFICATION_STATUSES = ('verified', 'uploaded', 'pending', 'rejected')
PLATFORM_SOURCE_HOSTS = {
    'sellercentral.amazon.com',
    'seller.tiktokshopglobalselling.com',
    'sell.aliexpress.com',
    'rulechannel.aliexpress.com',
    'www.aliexpress.com',
    'www.ebay.com',
    'pages.ebay.com',
    'seller.shein.com',
    'seller.temu.com',
    'sellercenter.lazada.sg',
    'seller.shopee.sg',
}

# These dimensions are deliberately explicit.  A missing value means that the
# source did not state the dimension; the collector must never infer a fee or
# penalty from a generic headline.
RULE_DIMENSIONS = ('fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty')
RULE_DIMENSION_LABELS = {
    'fee': '费用', 'commission': '佣金', 'deposit': '保证金',
    'fulfillment': '履约', 'prohibited': '禁售', 'settlement': '结算',
    'penalty': '处罚',
}
RULE_DIMENSION_ALIASES = {
    'fee': ('fee', 'fees', 'fee_desc', 'fee_description', '费用', '费用说明'),
    'commission': ('commission', 'commission_rate', 'commission_fee', 'commission_description', '佣金', '佣金说明'),
    'deposit': ('deposit', 'deposit_amount', 'security_deposit', 'margin', '保证金', '保证金金额'),
    'fulfillment': ('fulfillment', 'fulfillment_mode', 'shipping', 'logistics', '履约', '履约方式'),
    'prohibited': ('prohibited', 'prohibited_items', 'prohibited_goods', 'restricted', '禁售', '禁售商品', '限制销售'),
    'settlement': ('settlement', 'settlement_cycle', 'payout', 'payout_schedule', 'payment', '结算', '结算周期'),
    'penalty': ('penalty', 'penalties', 'penalty_rules', 'penalty_description', 'violation_penalty', '处罚', '处罚规则', '扣分'),
}


def _rule_value_text(value):
    """Flatten a source field for storage without changing its meaning."""
    if value is None:
        return ''
    if isinstance(value, (list, tuple)):
        return '、'.join(part for part in (_rule_value_text(v) for v in value) if part)
    if isinstance(value, dict):
        for key in ('value', 'text', 'label', 'description'):
            if value.get(key) is not None:
                return _rule_value_text(value[key])
        return ''
    return str(value).strip()


def _canonical_rule_url(value):
    """Return a stable HTTPS rule URL without query/session parameters."""
    try:
        parsed = urlsplit(unescape(str(value or '').strip()))
    except ValueError:
        return ''
    if parsed.scheme.lower() != 'https' or not parsed.netloc or not parsed.path.strip('/'):
        return ''
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip('/'), '', ''))


def _rule_dimension_value(item, dimension):
    """Read one of the seven dimensions from common source payload shapes."""
    item = item if isinstance(item, dict) else {}
    bags = [item.get('rule_fields'), item.get('ruleFields'), item.get('fields'), item]
    aliases = {str(alias).replace('-', '').replace('_', '').replace(' ', '').lower()
               for alias in RULE_DIMENSION_ALIASES[dimension]}
    for bag in bags:
        if not isinstance(bag, dict):
            continue
        for key, value in bag.items():
            normalized = str(key).replace('-', '').replace('_', '').replace(' ', '').lower()
            if normalized in aliases:
                text = _rule_value_text(value)
                if text:
                    return text
    return ''


def _rule_topic(item):
    """Return the dimension explicitly represented by a rule record."""
    item = item if isinstance(item, dict) else {}
    explicit = str(item.get('topic') or item.get('rule_topic') or '').strip().lower()
    if explicit in RULE_DIMENSIONS:
        return explicit
    category = str(item.get('category') or '').strip().lower()
    aliases = {
        'fee': 'fee', 'fees': 'fee', 'commission': 'commission', '佣金': 'commission',
        'deposit': 'deposit', 'fulfillment': 'fulfillment', 'logistics': 'fulfillment',
        'prohibited': 'prohibited', 'ban': 'prohibited', 'settlement': 'settlement',
        'penalty': 'penalty', 'compliance': 'prohibited',
    }
    if category in aliases:
        return aliases[category]
    for dimension in RULE_DIMENSIONS:
        if _rule_dimension_value(item, dimension):
            return dimension
    text = f"{item.get('title') or ''}\n{item.get('summary') or ''}".lower()
    keyword_map = {
        'commission': ('佣金', 'commission'), 'fee': ('费用', '费率', 'fee', 'pricing'),
        'deposit': ('保证金', 'deposit', 'security deposit'),
        'fulfillment': ('履约', '物流', '配送', 'fulfillment', 'shipping'),
        'prohibited': ('禁售', '限制销售', 'restricted', 'prohibited'),
        'settlement': ('结算', '回款', 'payout', 'settlement'),
        'penalty': ('处罚', '扣分', 'penalty', 'violation'),
    }
    for dimension, words in keyword_map.items():
        if any(word in text for word in words):
            return dimension
    return 'other'


def _rule_identity(item):
    """Stable identity used to match revisions across URL/title changes."""
    item = item if isinstance(item, dict) else {}
    platform = str(item.get('platform_key') or item.get('platform') or '').strip().casefold()
    market = str(item.get('market_code') or item.get('market') or item.get('region') or '').strip().upper()
    explicit = str(item.get('rule_key') or item.get('rule_id') or '').strip()
    if explicit:
        return (platform, market, explicit)
    # A source page is more stable than its display title.  Seller centers
    # routinely revise headlines while keeping the same canonical rule URL.
    canonical_url = _canonical_rule_url(item.get('source_url') or item.get('url'))
    if canonical_url:
        digest = hashlib.sha256(f'{platform}|{market}|{canonical_url}'.encode('utf-8')).hexdigest()[:24]
        return (platform, market, digest)
    source_id = str(item.get('source_record_id') or '').strip()
    if source_id:
        return (platform, market, source_id)
    title = str(item.get('title') or item.get('name') or '').strip().casefold()
    digest = hashlib.sha256(f'{platform}|{market}|{title}'.encode('utf-8')).hexdigest()[:24]
    return (platform, market, digest)


def compare_rule_versions(previous, current):
    """Compare two normalized rules and return changed fields plus a summary."""
    previous = previous if isinstance(previous, dict) else {}
    current = current if isinstance(current, dict) else {}
    fields = ('title', 'summary', *RULE_DIMENSIONS, 'published_at', 'effective_from', 'effective_to')
    changed = []
    for field in fields:
        old = _rule_value_text(previous.get(field) or (previous.get('rule_dimensions') or {}).get(field))
        new = _rule_value_text(current.get(field) or (current.get('rule_dimensions') or {}).get(field))
        if old != new:
            changed.append(field)
    labels = [RULE_DIMENSION_LABELS.get(field, field) for field in changed]
    summary = '规则字段变化：' + '、'.join(labels) if labels else '未检测到规则字段变化'
    return {'changed_fields': changed, 'change_summary': summary}


def normalize_platform_rule(item, *, platform_key=None, market_code=None):
    """Normalize a platform rule into the permanent-history contract."""
    record = dict(item or {})
    platform_key = str(platform_key or record.get('platform_key') or record.get('platform') or '').strip().casefold()
    market_code = str(market_code or record.get('market_code') or record.get('market') or record.get('region') or '').strip().upper()
    if platform_key:
        record['platform_key'] = platform_key
    if market_code:
        record['market'] = market_code
        record['market_code'] = market_code
    record.setdefault('source_kind', 'official')
    record.setdefault('source_type', 'platform')
    record.setdefault('source', record.get('platform') or platform_key or '平台官方规则')
    record['topic'] = _rule_topic(record)
    dimensions = {}
    for dimension in RULE_DIMENSIONS:
        value = _rule_dimension_value(record, dimension)
        if value:
            record[dimension] = value
            dimensions[dimension] = value
    record['rule_dimensions'] = dimensions
    stable_key = str(record.get('rule_key') or record.get('rule_id') or '').strip()
    if not stable_key:
        canonical_url = _canonical_rule_url(record.get('source_url') or record.get('url'))
        if canonical_url:
            stable_key = hashlib.sha256(f'{platform_key}|{market_code}|{canonical_url}'.encode('utf-8')).hexdigest()[:24]
    if not stable_key:
        title = str(record.get('title') or record.get('name') or '').strip()
        stable_key = hashlib.sha256(f'{platform_key}|{market_code}|{title}'.encode('utf-8')).hexdigest()[:24]
    record['rule_key'] = stable_key
    record['id'] = str(record.get('id') or gen_id('r', f'{platform_key}|{market_code}|{stable_key}'))
    record['source_record_id'] = str(record.get('source_record_id') or stable_key)
    record.setdefault('rule_version', record.get('version') or '1')
    record.setdefault('effective_from', record.get('effective_date') or record.get('published_at'))
    record.setdefault('collected_at', NOW_ISO)
    source_url = str(record.get('source_url') or '').strip()
    try:
        source_path = urlsplit(source_url).path.strip('/')
    except ValueError:
        source_path = ''
    if not source_path:
        # A platform homepage is not a record-level citation.  Downgrade old
        # catalog rows instead of allowing them to masquerade as formal data.
        record['verification_status'] = 'pending'
        record['verified_at'] = None
    elif not record.get('verification_status'):
        record['verification_status'] = 'verified'
    if record.get('verified_at') is None and record.get('source_url'):
        if source_path:
            record['verified_at'] = record['collected_at']
    record.setdefault('changed_fields', [])
    record.setdefault('change_summary', '首次采集版本')
    return record


def _is_formal_platform_rule(item):
    item = item if isinstance(item, dict) else {}
    url = str(item.get('source_url') or '').strip()
    return (
        bool(re.match(r'^https://[^/]+/.+', url, re.I))
        and str(item.get('verification_status') or '').lower() == 'verified'
        and bool(item.get('verified_at'))
    )


def build_platform_rule_coverage(items, platform_keys, *, market_codes=None, now=None, stale_days=45):
    """Compute honest platform status from formal records, never from catalog rows."""
    now = now or datetime.now(timezone.utc)
    result = {}
    for key in list(dict.fromkeys(str(value).strip().casefold() for value in (platform_keys or []) if str(value).strip())):
        records = [normalize_platform_rule(row) for row in (items or [])
                   if str((row or {}).get('platform_key') or (row or {}).get('platform') or '').strip().casefold() == key
                   and (not market_codes or str((row or {}).get('market_code') or (row or {}).get('market') or (row or {}).get('region') or '').strip().upper() in {str(code).upper() for code in market_codes})]
        formal = [row for row in records if _is_formal_platform_rule(row)]
        topic_set = set()
        for row in formal:
            topic = str(row.get('topic') or '').strip()
            if topic in RULE_DIMENSIONS:
                topic_set.add(topic)
            topic_set.update(
                key for key in (row.get('rule_dimensions') or {}) if key in RULE_DIMENSIONS
            )
        topics = sorted(topic_set)
        latest = max((str(row.get('verified_at') or '') for row in formal), default=None)
        fresh = False
        if latest:
            try:
                stamp = datetime.fromisoformat(latest.replace('Z', '+00:00'))
                if stamp.tzinfo is None:
                    stamp = stamp.replace(tzinfo=timezone.utc)
                fresh = (now - stamp).days <= stale_days
            except ValueError:
                fresh = False
        if not formal:
            status, label, reason = 'not_connected', '未接入', '暂无通过核验的正式规则记录'
        elif len(topics) < len(RULE_DIMENSIONS) or not fresh:
            status, label = 'partial', '部分接入'
            missing = [RULE_DIMENSION_LABELS[name] for name in RULE_DIMENSIONS if name not in topics]
            reason = ('缺少主题：' + '、'.join(missing)) if missing else '最近核验时间已过期'
        else:
            status, label, reason = 'connected', '已接入', '七类规则主题均有近期核验记录'
        result[key] = {
            'platform_key': key, 'status': status, 'label': label,
            'rule_count': len(formal), 'topics': topics,
            'missing_topics': [name for name in RULE_DIMENSIONS if name not in topics],
            'last_verified_at': latest, 'reason': reason,
        }
    return result

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
    data = _load_market_scope_manifest()
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
def fetch_json(
    url, headers=None, *, source_key=None, source_label=None, domain='supporting',
    core=False, market_codes=None, platform_keys=None, track=True
):
    """Fetch URL and parse JSON response."""
    hdrs = {'User-Agent': 'MercatorBot/1.0 (GitHub Actions)'}
    if headers:
        hdrs.update(headers)
    host = _source_host(url) or 'unknown-source'
    source = None
    if track:
        source = register_collection_source(
            source_key or host.replace('.', '_'), source_label or host, domain,
            core=core, market_codes=market_codes, platform_keys=platform_keys,
        )
    if source_key:
        try:
            governed_key = assert_source_collectable(source_key)
            if source:
                source['source_key'] = governed_key
        except SourceGovernanceError as error:
            if source:
                source['collector_status'] = 'skipped'
                source['errors'].append(str(error))
            print(f"  [SKIP] fetch_json blocked before request: {error}")
            return None
    started = time.perf_counter()
    try:
        req = Request(url, headers=hdrs)
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
        if source:
            _record_http_result(
                source, success=True,
                duration_ms=(time.perf_counter() - started) * 1000,
            )
        return result
    except Exception as e:
        if source:
            _record_http_result(
                source, success=False,
                duration_ms=(time.perf_counter() - started) * 1000,
                error=e,
            )
        print(f"  [WARN] fetch_json failed for {url}: {e}")
        return None

def fetch_html(
    url, headers=None, *, source_key=None, source_label=None, domain='supporting',
    core=False, market_codes=None, platform_keys=None, track=True
):
    """Fetch URL and return HTML text."""
    hdrs = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
    if headers:
        hdrs.update(headers)
    host = _source_host(url) or 'unknown-source'
    source = None
    if track:
        source = register_collection_source(
            source_key or host.replace('.', '_'), source_label or host, domain,
            core=core, market_codes=market_codes, platform_keys=platform_keys,
        )
    if source_key:
        try:
            governed_key = assert_source_collectable(source_key)
            if source:
                source['source_key'] = governed_key
        except SourceGovernanceError as error:
            if source:
                source['collector_status'] = 'skipped'
                source['errors'].append(str(error))
            print(f"  [SKIP] fetch_html blocked before request: {error}")
            return None
    started = time.perf_counter()
    try:
        req = Request(url, headers=hdrs)
        with urlopen(req, timeout=30) as resp:
            data = resp.read()
            # Try utf-8 first, then fall back
            for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
                try:
                    result = data.decode(enc)
                    if source:
                        _record_http_result(
                            source, success=True,
                            duration_ms=(time.perf_counter() - started) * 1000,
                        )
                    return result
                except UnicodeDecodeError:
                    continue
                except LookupError:
                    continue
            result = data.decode('utf-8', errors='replace')
            if source:
                _record_http_result(
                    source, success=True,
                    duration_ms=(time.perf_counter() - started) * 1000,
                )
            return result
    except Exception as e:
        if source:
            _record_http_result(
                source, success=False,
                duration_ms=(time.perf_counter() - started) * 1000,
                error=e,
            )
        print(f"  [WARN] fetch_html failed for {url}: {e}")
        return None


def _clean_link_text(value):
    """Reduce an HTML anchor body to a readable title for feed records."""
    text = re.sub(r'<[^>]+>', ' ', str(value or ''))
    return re.sub(r'\s+', ' ', unescape(text)).strip()

# ---- Source: Federal Register API (US Trade Policies) ----
def collect_federal_register(start_date=None, end_date=None, page=1, per_page=10):
    """Collect US trade-related regulations, optionally for a historical window.

    ``start_date``/``end_date`` are inclusive ISO dates.  The defaults retain
    the daily newest-page behaviour; backfill jobs pass a window and explicit
    page size so every request is reproducible.
    """
    print("[1/6] Collecting Federal Register (US trade regulations)...")
    items = []
    
    # Search for trade-related documents
    agencies = [
        'trade-representative-office',
        'commerce-department',
        'customs-and-border-protection'
    ]
    
    for agency in agencies:
        params = [
                ('filter[conditions][agencies][]', agency),
                ('filter[conditions][type]', 'RULE'),
                ('per_page', max(int(per_page), 1)),
                ('page', max(int(page), 1)),
                ('order', 'oldest' if start_date else 'newest'),
                ('fields[]', 'title'),
                ('fields[]', 'abstract'),
                ('fields[]', 'publication_date'),
                ('fields[]', 'html_url'),
                ('fields[]', 'document_number'),
                ('fields[]', 'type'),
            ]
        if start_date:
            params.append(('filter[publication_date][gte]', str(start_date)[:10]))
        if end_date:
            params.append(('filter[publication_date][lte]', str(end_date)[:10]))
        url = build_query_url(
            'https://www.federalregister.gov/api/v1/documents.json',
            params,
        )
        data = fetch_json(
            url,
            source_key='federal_register',
            source_label='US Federal Register',
            domain='policy',
            core=True,
            market_codes=['US'],
        )
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
                'id': gen_id('p', doc.get('document_number') or title),
                'source_record_id': doc.get('document_number') or gen_id('p', title),
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
    
    source_options = {
        'source_key': 'ustr',
        'source_label': 'US Trade Representative',
        'domain': 'policy',
        'core': False,
        'market_codes': ['US'],
    }
    html = fetch_html('https://ustr.gov/news-events/press-releases', **source_options)
    if not html:
        html = fetch_html('https://ustr.gov/news-events', **source_options)
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

# ---- Platform rule parsing helpers ----
def _extract_platform_rule_records(html, base_url, platform_key, platform_name, market='US'):
    """Parse links/JSON-LD from listing pages without relying on one DOM class."""
    if not html:
        return []
    records = []
    seen = set()
    base_host = (urlsplit(base_url).hostname or '').lower().rstrip('.')

    def add(title, source_url, summary='', published_at=None, rule_key=None):
        title = _clean_link_text(title)
        source_url = urljoin(base_url, unescape(str(source_url or '').strip()))
        parsed = urlsplit(source_url)
        if len(title) < 8 or parsed.scheme != 'https' or not parsed.netloc:
            return
        source_host = (parsed.hostname or '').lower().rstrip('.')
        if source_host != base_host and not source_host.endswith('.' + base_host):
            return
        # A homepage or a bare listing root cannot prove a particular rule.
        if not parsed.path.strip('/'):
            return
        if platform_key == 'ebay':
            # The public eBay selling page mixes rule articles with account,
            # shopping and global navigation. Only record-level seller help or
            # policy paths are eligible for the rule collection.
            path = parsed.path.rstrip('/').casefold()
            if not (
                re.match(r'^/help/selling/.+', path)
                or re.match(r'^/help/policies/member-behaviour-policies/.+', path)
            ):
                return
        key = (title.casefold(), source_url.rstrip('/').casefold())
        if key in seen:
            return
        title_lower = title.casefold()
        path_lower = parsed.path.casefold()
        if any(word in title_lower for word in (
            'cookie', 'sign in', 'log in', 'sign up', 'register', 'javascript', 'privacy',
            '账户', '注册', '登录', '创建您的亚马逊账户',
        )) or any(token in path_lower for token in ('/ap/register', '/ap/signin', '/login', '/register')):
            return
        seen.add(key)
        canonical_url = _canonical_rule_url(source_url)
        derived_key = hashlib.sha256(f'{platform_key}|{market}|{canonical_url or title}'.encode('utf-8')).hexdigest()[:24]
        record = {
            'id': gen_id('r', f'{platform_key}|{market}|{title}'),
            'rule_key': rule_key or derived_key,
            'title': title,
            'summary': _clean_link_text(summary),
            'platform': platform_name,
            'platform_key': platform_key,
            'market': market,
            'market_codes': [market],
            'category': 'policy',
            'impact_level': 'high' if re.search(r'fee|commission|penalty|prohibited|禁售|佣金|处罚|mandatory|必须', title, re.I) else 'medium',
            'effective_date': published_at or NOW_DATE,
            'published_at': published_at or NOW_DATE,
            'source_url': source_url,
            'source_kind': 'official',
            'source_type': 'platform',
            'verification_status': 'verified',
            'verified_at': NOW_ISO,
            'collected_at': NOW_ISO,
        }
        records.append(normalize_platform_rule(record, platform_key=platform_key, market_code=market))

    # Standard anchors, including links rendered by legacy and current pages.
    anchor_pattern = re.compile(r'<a\b([^>]*?href\s*=\s*["\']([^"\']+)["\'][^>]*)>(.*?)</a\s*>', re.I | re.S)
    for match in anchor_pattern.finditer(html):
        attrs, href, body = match.groups()
        heading = re.search(r'<h[1-6]\b[^>]*>(.*?)</h[1-6]\s*>', body, re.I | re.S)
        text = _clean_link_text(heading.group(1) if heading else body)
        date_match = re.search(r'(?:data-(?:date|published)|datetime)\s*=\s*["\']([^"\']+)', attrs, re.I)
        add(text, href, published_at=(date_match.group(1)[:10] if date_match else None))

    # JSON-LD is used by several seller centers after their client-side redesign.
    for block in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S):
        try:
            payload = json.loads(unescape(block).strip())
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        values = payload if isinstance(payload, list) else [payload]
        for value in values:
            if not isinstance(value, dict):
                continue
            add(value.get('headline') or value.get('name'), value.get('url') or base_url,
                value.get('description'), (value.get('datePublished') or value.get('dateModified') or '')[:10] or None,
                value.get('identifier') or value.get('sku'))

    # Some pages expose a JSON array but not JSON-LD. Keep this fallback narrow
    # so arbitrary navigation strings are not promoted to formal rules.
    for title, href, date in re.findall(
        r'["\'](?:title|headline)["\']\s*:\s*["\']([^"\']{8,160})["\'][\s\S]{0,300}?["\'](?:url|href|link)["\']\s*:\s*["\']([^"\']+)["\'][\s\S]{0,120}?(?:["\'](?:date|published_at)["\']\s*:\s*["\']([^"\']+))?',
        html, re.I,
    ):
        add(title, href, published_at=date[:10] if date else None)
    return records


def _browser_rendered_platform_rules(platform_key, listing_url):
    """Run the bounded browser fallback without persisting HTML or cookies."""
    if str(os.environ.get('ENABLE_BROWSER_PLATFORM_RULES', '')).strip().lower() not in {'1', 'true', 'yes'}:
        return []
    renderer = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'render_platform_rules.cjs')
    try:
        completed = subprocess.run(
            ['node', renderer, platform_key, listing_url],
            capture_output=True, text=True, encoding='utf-8', errors='replace',
            timeout=max(int(os.environ.get('PLATFORM_BROWSER_TIMEOUT_SECONDS', '90')), 30),
            check=False,
        )
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        print(f"  [WARN] browser-rendered {platform_key} collector unavailable: {error}")
        return []
    if completed.returncode != 0:
        detail = re.sub(r'\s+', ' ', completed.stderr or '').strip()[:300]
        print(f"  [WARN] browser-rendered {platform_key} collector failed: {detail or 'unknown error'}")
        return []
    try:
        payload = json.loads(completed.stdout)
    except (TypeError, ValueError, json.JSONDecodeError):
        print(f"  [WARN] browser-rendered {platform_key} collector returned invalid JSON")
        return []
    return payload if isinstance(payload, list) else []


def _mark_rule_collector_degraded(source_key, message):
    source = COLLECTION_SOURCES.get(source_key)
    if source is None:
        return
    source['collector_status'] = 'degraded'
    if message not in source['errors']:
        source['errors'].append(message)


# ---- Source: TikTok Shop Policy Center ----
def collect_tiktok_shop(include_status=False):
    """Collect TikTok Shop rules across current and legacy official entries."""
    print("[3/6] Collecting TikTok Shop policy updates...")
    items = []
    checked = False
    urls = [
        build_query_url('https://seller.tiktokshopglobalselling.com/university/new-policies',
                        {'identity': 1, 'module_id': 'latest_policies'}),
        'https://seller.tiktokshopglobalselling.com/university/policy',
        'https://seller.tiktokshopglobalselling.com/academy/policy',
    ]
    for url in urls:
        html = fetch_html(url, source_key='tiktok_shop_rules', source_label='TikTok Shop Seller Center',
                          domain='rule', core=True, market_codes=['US'], platform_keys=['tiktok-shop'])
        if not html:
            continue
        checked = True
        items.extend(_extract_platform_rule_records(html, url, 'tiktok-shop', 'TikTok Shop'))
        if len(items) >= 30:
            break
    if not items:
        rendered = _browser_rendered_platform_rules('tiktok-shop', urls[0])
        checked = checked or bool(rendered)
        items.extend(
            normalize_platform_rule(row, platform_key='tiktok-shop', market_code='US')
            for row in rendered if isinstance(row, dict)
        )
    # Deduplicate by stable rule key while retaining the first official URL.
    unique = {}
    for item in items:
        unique.setdefault(item['rule_key'], item)
    items = list(unique.values())[:30]
    if checked and not items:
        _mark_rule_collector_degraded(
            'tiktok_shop_rules',
            'official pages were reachable but no rule records were extracted; enable browser rendering or review the page contract',
        )
    print(f"  Found {len(items)} items from TikTok Shop")
    return (items, checked) if include_status else items


# ---- Source: Amazon Seller Central News ----
def collect_amazon(include_status=False):
    """Collect Amazon announcements with endpoint and markup fallbacks."""
    print("[4/6] Collecting Amazon Seller Central announcements...")
    items = []
    checked = False
    options = {'source_key': 'amazon_rules', 'source_label': 'Amazon Seller Central', 'domain': 'rule',
               'core': True, 'market_codes': ['US'], 'platform_keys': ['amazon']}
    urls = [
        'https://sellercentral.amazon.com/gp/help/news',
        'https://sellercentral.amazon.com/help/hub/reference/G200164330',
    ]
    for url in urls:
        html = fetch_html(url, **options)
        if not html:
            continue
        checked = True
        items.extend(_extract_platform_rule_records(html, url, 'amazon', 'Amazon'))
        if len(items) >= 30:
            break
    unique = {}
    for item in items:
        unique.setdefault(item['rule_key'], item)
    items = list(unique.values())[:30]
    if checked and not items:
        _mark_rule_collector_degraded(
            'amazon_rules',
            'official help pages were reachable but exposed no public rule records; authenticated endpoint review is required',
        )
    print(f"  Found {len(items)} items from Amazon")
    return (items, checked) if include_status else items


def _collect_optional_platform_rules(platform_key, platform_name, source_key, urls):
    """Collect an optional platform only when operators explicitly enable it.

    AliExpress and eBay do not expose one stable, universally authorized US
    rules endpoint.  Keeping the collector disabled by default prevents a
    directory entry or guessed fee from being presented as official data.
    """
    if str(os.environ.get('ENABLE_OPTIONAL_PLATFORM_RULES', '')).strip().lower() not in {'1', 'true', 'yes'}:
        print(f"  [INFO] {platform_name} collector disabled pending endpoint authorization")
        source = COLLECTION_SOURCES.get(source_key)
        if source is not None:
            source['collector_status'] = 'skipped'
            reason = 'official endpoint authorization is not configured'
            if reason not in source['errors']:
                source['errors'].append(reason)
        return []
    items = []
    for url in urls:
        html = fetch_html(url, source_key=source_key, source_label=f'{platform_name} Official Rules',
                          domain='rule', core=False, market_codes=['US'], platform_keys=[platform_key])
        if not html:
            continue
        items.extend(_extract_platform_rule_records(html, url, platform_key, platform_name))
        if len(items) >= 30:
            break
    unique = {}
    for item in items:
        unique.setdefault(item['rule_key'], item)
    return list(unique.values())[:30]


def collect_aliexpress(include_status=False):
    items = _collect_optional_platform_rules(
        'aliexpress', 'AliExpress', 'aliexpress_rules',
        ['https://sell.aliexpress.com/soho/rules', 'https://rulechannel.aliexpress.com/'],
    )
    return (items, bool(items)) if include_status else items


def collect_ebay(include_status=False):
    items = _collect_optional_platform_rules(
        'ebay', 'eBay', 'ebay_rules',
        ['https://www.ebay.com/help/selling', 'https://pages.ebay.com/seller-center/'],
    )
    return (items, bool(items)) if include_status else items

# ---- Source: Chinese Cross-border E-commerce News ----
def collect_cn_news():
    """Collect from Chinese cross-border e-commerce news aggregators."""
    print("[5/6] Collecting Chinese cross-border news (cifnews/amz123)...")
    items = []
    
    # 雨果网 - cross-border e-commerce news
    html = fetch_html(
        'https://www.cifnews.com/',
        source_key='cifnews',
        source_label='雨果网',
        domain='industry_advisory',
        core=False,
        market_codes=COLLECTION_SCOPE.get('market_codes') or [],
    )
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
    html2 = fetch_html(
        'https://www.amz123.com/',
        source_key='amz123',
        source_label='AMZ123',
        domain='industry_advisory',
        core=False,
        market_codes=COLLECTION_SCOPE.get('market_codes') or [],
    )
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
    }, track=False)
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
    """Merge records while retaining append-only rule revisions.

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
    
    # Rules use a stable platform/market/rule key.  This prevents a title or
    # endpoint rename from creating a second current record and gives the
    # permanent-history sync a deterministic revision boundary.
    if baseline_kind == 'rules':
        existing['items'] = [
            annotate_provenance(normalize_platform_rule(item))
            for item in existing.get('items', []) if isinstance(item, dict)
        ]
        new_items = [
            annotate_provenance(normalize_platform_rule(item))
            for item in new_items if isinstance(item, dict)
        ]
        existing_by_identity = {_rule_identity(item): index for index, item in enumerate(existing['items'])}
        added = 0
        for item in new_items:
            identity = _rule_identity(item)
            old_index = existing_by_identity.get(identity)
            if old_index is None:
                existing['items'].insert(0, item)
                existing_by_identity = {_rule_identity(row): index for index, row in enumerate(existing['items'])}
                added += 1
                continue
            previous = existing['items'][old_index]
            diff = compare_rule_versions(previous, item)
            if not diff['changed_fields']:
                continue
            history = previous.get('version_history') if isinstance(previous.get('version_history'), list) else []
            # Keep history compact and immutable; the full evidence payload is
            # retained in the permanent-history tables, not duplicated here.
            previous_snapshot = {key: previous.get(key) for key in (
                'id', 'rule_key', 'rule_version', 'title', 'summary', 'rule_dimensions',
                'source_url', 'published_at', 'effective_from', 'effective_to',
                'collected_at', 'verified_at', 'changed_fields', 'change_summary'
            ) if previous.get(key) is not None}
            item['version_history'] = (history + [previous_snapshot])[-20:]
            try:
                prior_version = int(str(previous.get('rule_version') or '0').lstrip('vV'))
            except ValueError:
                prior_version = len(history)
            item['rule_version'] = str(max(prior_version + 1, 1))
            item['previous_version'] = previous.get('rule_version')
            item.update(diff)
            existing['items'][old_index] = item
            existing_by_identity = {_rule_identity(row): index for index, row in enumerate(existing['items'])}
        # Baselines are appended below and intentionally remain demo records.
    else:
        # Normalize provenance before deduplication.  Legacy policy records are
        # preserved; their compatibility status is evaluated by the validator.
        new_items = [annotate_provenance(item) for item in new_items if isinstance(item, dict)]

    existing_titles = set()
    for item in existing['items']:
        t = item.get('title', '').strip()
        existing_titles.add(t.lower())
        # Also add a hash of first 20 chars for fuzzy match
        if len(t) > 20:
            existing_titles.add(t[:20].lower())
    
    if baseline_kind != 'rules':
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

    manifest = _load_market_scope_manifest()
    scope = configured_collection_scope(manifest)
    implemented_platform_collectors = {
        'amazon': ('amazon_rules', 'Amazon Seller Central', collect_amazon),
        'tiktok-shop': ('tiktok_shop_rules', 'TikTok Shop Seller Center', collect_tiktok_shop),
        'aliexpress': ('aliexpress_rules', 'AliExpress Official Rules', collect_aliexpress),
        'ebay': ('ebay_rules', 'eBay Official Rules', collect_ebay),
    }
    scope['unconnected_platform_keys'] = [
        key for key in scope['platform_keys'] if key not in implemented_platform_collectors
    ]
    reset_collection_telemetry(scope)
    print(
        "Configured collection scope: "
        f"markets={scope['market_codes']} platforms={scope['platform_keys']}"
    )
    if not scope['market_codes']:
        source = register_collection_source(
            'market_scope', 'Market scope catalog', 'configuration', core=True
        )
        source['collector_status'] = 'failed'
        source['errors'].append('No active market has data_status=configured')
        write_collection_report()
        return 0

    all_policies = []
    all_rules = []

    if 'US' in scope['market_codes']:
        all_policies.extend(run_collection_source(
            'federal_register', 'US Federal Register', 'policy',
            collect_federal_register, core=True, market_codes=['US'],
        ))
        all_policies.extend(run_collection_source(
            'ustr', 'US Trade Representative', 'policy',
            collect_ustr, core=False, market_codes=['US'],
        ))

    advisory_items = run_collection_source(
        'industry_advisories', '雨果网 / AMZ123', 'industry_advisory',
        collect_cn_news, core=False, market_codes=scope['market_codes'],
        assign_scope=False,
    )
    scope_codes = set(scope['market_codes'])
    scoped_advisories = [
        item for item in advisory_items
        if isinstance(item, dict)
        and scope_codes.intersection(
            str(code).strip().upper() for code in (item.get('market_codes') or [])
        )
    ]
    set_collection_scope_count('industry_advisories', len(scoped_advisories))
    for source_key, source_name in (('cifnews', '雨果网'), ('amz123', 'AMZ123')):
        source = COLLECTION_SOURCES.get(source_key)
        if not source:
            continue
        source['records_collected'] = sum(
            isinstance(item, dict) and item.get('source') == source_name
            for item in advisory_items
        )
        source['records_in_scope'] = sum(
            isinstance(item, dict) and item.get('source') == source_name
            for item in scoped_advisories
        )
    all_policies.extend(scoped_advisories)

    rule_source_keys = []
    for platform_key in scope['platform_keys']:
        spec = implemented_platform_collectors.get(platform_key)
        if not spec:
            continue
        source_key, label, collector = spec
        rule_source_keys.append(source_key)
        market_codes = [
            code for code in scope['market_codes']
            if any(
                str(row.get('market_code') or '').strip().upper() == code
                and str(row.get('platform_key') or '').strip().casefold() == platform_key
                and str(row.get('data_status') or '').strip().lower() == 'configured'
                for row in manifest.get('market_platforms', [])
                if isinstance(row, dict)
            )
        ]
        all_rules.extend(run_collection_source(
            source_key, label, 'rule', collector,
            core=platform_key in {'amazon', 'tiktok-shop'},
            market_codes=market_codes, platform_keys=[platform_key],
        ))
    
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
    policy_source_keys = ['federal_register'] if 'US' in scope['market_codes'] else []
    if policy_source_keys and all(collection_source_checked(key) for key in policy_source_keys):
        policies_data['last_checked_at'] = NOW_ISO
    if rule_source_keys and all(collection_source_checked(key) for key in rule_source_keys):
        rules_data['last_checked_at'] = NOW_ISO
    policies_data['source_checks'] = {
        key: _source_status(COLLECTION_SOURCES[key])
        for key in ('federal_register', 'ustr', 'industry_advisories')
        if key in COLLECTION_SOURCES
    }
    rules_data['source_checks'] = {
        key: _source_status(COLLECTION_SOURCES[key])
        for key in rule_source_keys if key in COLLECTION_SOURCES
    }
    platform_coverage = build_platform_rule_coverage(
        rules_data.get('items', []), scope.get('platform_keys', []),
        market_codes=scope.get('market_codes', []), now=datetime.now(timezone.utc)
    )
    # Both names are kept for consumers introduced in different releases.
    # They are derived from formal records and never from market_scope.json.
    rules_data['platform_coverage'] = platform_coverage
    rules_data['platform_status'] = platform_coverage
    scope['platform_status'] = platform_coverage
    scope['unconnected_platform_keys'] = [
        key for key, status in platform_coverage.items() if status.get('status') == 'not_connected'
    ]
    
    # Save
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(policies_file, 'w', encoding='utf-8') as f:
        json.dump(policies_data, f, ensure_ascii=False, indent=2)
    with open(rules_file, 'w', encoding='utf-8') as f:
        json.dump(rules_data, f, ensure_ascii=False, indent=2)
    
    print(f"Policies: {len(policies_data['items'])} total, +{p_added} new")
    print(f"Rules: {len(rules_data['items'])} total, +{r_added} new")
    
    report = write_collection_report()
    if report['summary']['core_failures']:
        print(
            "  [ERROR] Core collection sources failed: "
            + ', '.join(report['summary']['core_failures'])
        )
    
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
