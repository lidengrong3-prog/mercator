#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
collect_us_market.py — 美国市场「全品类」单点情报采集器（参数化 · 真实源）

覆盖 ``market_scope.json`` 为美国配置的 5 大板块 × N 个品类：
  1. country    美国 <品类> 宏观全景（真实参考 + 实时关税）
  2. platforms  电商平台档案（目录配置平台 × 品类适配）
  3. rules      平台 / 监管合规红线（真实法规）
  4. policies   实时 Federal Register <品类> 公文（API 实时抓取）
  5. alerts     预警中心（FR 实时 + 关税专项）

品类由 ``data/market_scope.json`` 统一定义，每品类一份报告 / 一份数据。

输出：
  data/us_market/<cat>.json   每品类一份（含 5 大板块）
  data/us_market/index.json   品类索引（前端/调度用）

设计原则：
  - 仅用标准库（urllib），可在 GitHub Actions (ubuntu-latest, py3.11) 直接运行。
  - policies / alerts 为「实时真源」：每次运行重新拉取 Federal Register API，
    纳入 4 小时定时任务后即「每 4 小时自动更新 + 真实准确」。
  - country / platforms / rules 为「真实参考库」：数值来自权威公开源，均带
    source + source_url + as_of，随官方更新人工修订，非凭空生成。
  - 网络失败时回退到已有 data/us_market/<cat>.json，保证流水线不中断。

用法：
  python scripts/collect_us_market.py                # 采集目录内全部品类
  python scripts/collect_us_market.py --category electronics   # 单品类
  python scripts/collect_us_market.py --no-network   # 仅用本地参考库重建
  python scripts/collect_us_market.py --validate     # 离线校验输出结构
"""

import copy
import json
import os
import sys
import glob
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone, timedelta

from collection_telemetry import append_collection_source
from market_scope import configured_catalog, load_market_scope, platform_alias_map
from source_governance import SourceGovernanceError, assert_source_collectable

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data", "us_market")
INDEX_FILE = os.path.join(DATA_DIR, "index.json")

FR_API = "https://www.federalregister.gov/api/v1/documents.json"
AS_OF = datetime.now(timezone.utc).strftime("%Y-%m-%d")
UA = {"User-Agent": "Mozilla/5.0 (Mercator US-Market Collector; +https://github.com/lidengrong3-prog/mercator)"}


def utc_now():
    return datetime.now(timezone.utc)


def iso_date(value):
    return str(value or "")[:10]


def _semantic_value(value):
    """Remove collection clocks while retaining the factual payload."""
    if isinstance(value, list):
        return [_semantic_value(item) for item in value]
    if not isinstance(value, dict):
        return value
    normalized = {}
    is_static_alert = value.get("live") is False
    for key, item in value.items():
        if key in {"generated_at", "as_of", "collected_at", "retrieved_at"}:
            continue
        if is_static_alert and key == "date":
            continue
        normalized[key] = _semantic_value(item)
    return normalized


def content_signature(payload):
    factual_sections = {
        key: payload.get(key)
        for key in ("country", "findings", "platforms", "matrix", "rules", "policies", "alerts")
    }
    return json.dumps(_semantic_value(factual_sections), ensure_ascii=False, sort_keys=True)

# ---------------------------------------------------------------------------
# 网络工具
# ---------------------------------------------------------------------------
def http_get_json(url, timeout=25, params=None):
    if params:
        url = url + "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as e:
        sys.stderr.write("[warn] FR fetch failed: %s\n" % e)
        return None

# ---------------------------------------------------------------------------
# 共享：美国宏观底座（真实参考，带来源）
# ---------------------------------------------------------------------------
US_MACRO = [
    ["美国零售电商规模(2026E)", "≈ US$ 1.6 万亿", "同比 +10.4%（2025 为 $1.23 万亿）", "eMarketer / US Census, 2026"],
    ["电商渗透率(Q1 2026)", "16.9%（季调）", "剔除汽车/汽油/餐饮后约 23.8%，历史第二高", "US Census Bureau, 2026-05"],
    ["线上购物人口", "≈ 2.95 亿（约 80% 成年人）", "增长来自存量用户钱包份额提升", "eMarketer, 2026"],
    ["Amazon 市占", "≈ 36%–40% 美国电商", "最大流量入口，品牌信任背书强", "Marketplace Pulse, 2025-2026"],
    ["对华关税环境", "收紧 + 复审", "Section 301 附加税覆盖多品类；强迫劳动禁令提案推进", "USTR Section 301, 2026"],
    ["内容电商增量", "TikTok Shop 高速扩张", "年轻客群 + 直播/短视频转化，跨境店可入驻", "TikTok Shop 美国, 2026"],
]

# ---------------------------------------------------------------------------
# 共享：当前 manifest 配置平台档案（hotCats 按品类覆盖）
# ---------------------------------------------------------------------------
PLATFORMS_BASE = [
    {
        "platform_key": "amazon", "name": "Amazon（美国）", "type": "货架电商", "market": "美国",
        "commission": "多数品类佣金 8%–20%（如消费电子 8%、服饰 17%、家居 15%、美妆 8%–15%；宠物食品和用品按当前类目费率核验）；专业计划 $39.99/月 + FBA 仓储配送费",
        "feeDesc": "最大流量与信任背书；FBA 本土履约；Brand Registry 防跟卖",
        "entry": "跨境可入驻；部分类目需审核/资质（如宠物食品、美妆）",
        "strength": "最大流量与信任背书，高客单承接力强",
        "risk": "佣金高、价格战、账号合规风险",
        "source": "Amazon Seller Central 销售费用(2026)",
        "source_url": "https://sell.amazon.com/pricing",
        "as_of": AS_OF,
    },
    {
        "platform_key": "tiktok-shop", "name": "TikTok Shop（美国）", "type": "内容电商", "market": "美国",
        "commission": "平台佣金约 6%–8%（按类目）+ 支付手续费；卖家中心 2026 更新内容合规红线",
        "feeDesc": "内容种草+直播转化；跨境店需本地主体/合规资质",
        "entry": "跨境店可入驻；需本地主体/合规资质",
        "strength": "内容种草+直播转化，年轻客群增量大",
        "risk": "内容合规严（90天违规窗口）、退货率、达人依赖",
        "source": "TikTok Shop 美国卖家中心(2026)",
        "source_url": "https://seller-us.tiktok.com/university/essay?knowledge_id=3106489578538795",
        "as_of": AS_OF,
    },
    {
        "platform_key": "aliexpress", "name": "AliExpress 速卖通", "type": "跨境电商", "market": "美国",
        "commission": "多数品类佣金约 5%–8% + 交易服务费，按类目和履约模式核验",
        "feeDesc": "跨境专供与 Choice 履约；适合价格敏感和长尾商品",
        "entry": "跨境卖家可按类目申请",
        "strength": "跨境供给和价格带覆盖广",
        "risk": "履约时效、平台规则和价格竞争压力",
        "source": "AliExpress 卖家中心",
        "source_url": "https://sell.aliexpress.com/",
        "as_of": AS_OF,
    },
    {
        "platform_key": "ebay", "name": "eBay", "type": "货架/拍卖", "market": "美国",
        "commission": "成交费约 13%（按品类），店铺订阅另计；无月费基础店",
        "feeDesc": "开放入驻门槛低；二手/长尾天然场",
        "entry": "开放入驻，门槛低",
        "strength": "二手/收藏/长尾流量，国际站点可触达",
        "risk": "假货争议、价格透明压利润",
        "source": "eBay 费用说明（参考）",
        "source_url": "https://www.ebay.com/sellercenter",
        "as_of": AS_OF,
    },
]

# ---------------------------------------------------------------------------
# 品类配置（真实数据锚点 + 合规 + FR 检索词）
# ---------------------------------------------------------------------------
_CATEGORY_REFERENCES = {
    "electronics": {
        "name": "消费电子", "name_en": "Consumer Electronics", "icon": "📱",
        "subtitle": "United States · 全球最大单一国家电商市场",
        "fr_terms": ["consumer electronics", "electronic product", "semiconductor", "lithium battery", "wireless device"],
        "fr_strong": ["electron", "semiconductor", "battery", "wireless", "radio", "digital device", "telecommunication", "fcc"],
        "market": {
            "size_2026": "US$ 2,616 亿 (2026E)",
            "cagr": "CAGR 4.8% (2026-2031)",
            "note": "含消费电子整机；若计及 IT/电信设备口径可达 ≈ $5,650 亿 (Ken Research)",
            "source": "marketdataforecast / kenresearch, 2026",
            "source_url": "https://www.marketdataforecast.com/market-reports/consumer-electronics-market",
            "as_of": "2026-08",
        },
        "segments": [
            {"name": "手机及配件", "note": "手机壳/充电/音频为高频出海爆款，价格敏感"},
            {"name": "智能穿戴", "note": "手表/手环/健康追踪，TikTok 内容种草强"},
            {"name": "电脑与外设", "note": "键盘/鼠标/显示器，Amazon 高客单主力"},
            {"name": "智能家居", "note": "摄像头/灯具/清洁机器人，FTC/UL 认证驱动"},
        ],
        "regulators": ["FCC", "CPSC", "EPA", "FTC"],
        "rules": [
            {"platform": "FCC（美国联邦通信委员会）", "title": "无线设备认证 (FCC Part 15/Part 18)",
             "detail": "含 Wi-Fi/蓝牙/射频的电子设备须通过 FCC 认证（SDOC 或 Certification），加贴 FCC 标识；违规产品可被海关扣留或下架。",
             "severity": "high", "source": "FCC", "source_url": "https://www.fcc.gov/engineering-technology/laboratory-division/general/equipment-authorization", "as_of": AS_OF},
            {"platform": "CPSC（美国消费品安全委员会）", "title": "锂电池与玩具安全 (16 CFR)",
             "detail": "含锂离子电池产品须符合 UN38.3 运输安全与 UL 标准；CPSC 对消费电子（尤其儿童向）可燃/过热风险有召回执法权。",
             "severity": "high", "source": "CPSC", "source_url": "https://www.cpsc.gov/", "as_of": AS_OF},
            {"platform": "EPA / 加州", "title": "能效与有害物质 (ENERGY STAR / 电池法)",
             "detail": "部分家电类电子需 ENERGY STAR；加州 SB 1215 等电池回收法要求标注与回收责任。",
             "severity": "medium", "source": "EPA / California", "source_url": "https://www.energystar.gov/", "as_of": AS_OF},
            {"platform": "Amazon", "title": "电子类目合规与 UL 认证",
             "detail": "充电/电池类商品需 UL 认证与电池声明；二手/改装机受限；建议 Brand Registry。",
             "severity": "medium", "source": "Amazon Seller Central", "source_url": "https://sell.amazon.com/pricing", "as_of": AS_OF},
            {"platform": "TikTok Shop（美国）", "title": "内容合规红线（2026 更新）",
             "detail": "90 天内累计违规可撤销电商权限；须真实演示、明示价格与赠品条件；禁医疗/侵权/虚假宣传。",
             "severity": "high", "source": "TikTok Shop 卖家中心", "source_url": "https://seller-us.tiktok.com/university/essay?knowledge_id=3106489578538795", "as_of": AS_OF},
        ],
        "opportunity": "美国是全球最大单一电商市场，消费电子高频高复购；Amazon 高客单承接 + TikTok Shop 内容种草为新增量。本土仓履约 + 品牌化（充电/音频/智能家居）是核心路径。",
        "risks": [
            "⚠️ 含射频设备须 FCC 认证，无认证货物可被海关扣留",
            "⚠️ 锂电池须 UN38.3 + UL，CPSC 召回风险高",
            "⚠️ 对华 Section 301 附加关税覆盖多类电子（HTS 8471/8517/8507 等），须逐票确认税率",
            "⚠️ 各州销售税复杂，平台通常代扣",
        ],
        "advice": [
            "新手：TikTok Shop 验证手机配件/音频爆款",
            "工厂：Amazon FBA + 海外仓，重 UL/电池合规",
            "品牌：Amazon Brand Registry + eBay 长尾分销双轨",
        ],
        "findings": [
            "美国是全球最大单一电商市场（2026E ≈ $1.6 万亿），消费电子高频高复购，是工厂出海首选试水品类。",
            "含射频产品须 FCC 认证、含锂电池须 UN38.3/UL，是两大硬性合规门槛，决定能否清关与上线。",
            "对华 Section 301 附加关税覆盖大量电子 HTS 编码，精确税率须逐票用 USTR 检索或 CBP 裁定确认。",
            "Amazon 承接高客单 + TikTok Shop 内容种草为双引擎；本土仓履约与品牌化是利润关键。",
            "工厂推荐路径：TikTok Shop 试水爆款 → Amazon FBA + eBay 长尾分销 → 品牌资产沉淀。",
        ],
        "tariff_alert": {
            "level": "high",
            "title": "对华 Section 301 附加关税覆盖多类电子税则（须逐票确认税率）",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "HTS 8471(计算机)/8517(通信设备)/8507(电池)/8528(显示器)/8543(电子装置) 等广泛受 Section 301 约束；2024 四年期复审已调整税率，2026 强迫劳动提案对部分经济体加征附加税。精确附加税率须用 USTR 产品检索或 CBP 裁定确认。",
            "date": AS_OF, "source": "USTR Section 301", "url": "https://ustr.gov/node/9608", "as_of": AS_OF,
        },
        "platform_hotcats": {
            "Amazon（美国）": ["手机配件", "智能穿戴", "电脑外设", "智能家居"],
            "TikTok Shop（美国）": ["蓝牙耳机", "手机壳", "智能手表", "充电配件"],
            "AliExpress 速卖通": ["手机配件", "充电配件", "电脑外设"],
            "eBay": ["二手电子", "收藏机型", "配件长尾"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中（类目审核）", "中", "FBA + Brand Registry，重 UL/电池合规"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（内容红线）", "内容种草验证爆款，控退货率"],
            ["AliExpress", "跨境长尾卖家", "低", "中", "价格敏感和长尾配件"],
            ["eBay", "二手 / 长尾", "低", "中", "二手+收藏款流量"],
        ],
    },

    "apparel": {
        "name": "服饰鞋包", "name_en": "Apparel & Footwear", "icon": "👕",
        "subtitle": "United States · 成熟高渗透的万亿级零售品类",
        "fr_terms": ["textile", "apparel", "garment", "clothing", "flammable fabric"],
        "fr_strong": ["textile", "apparel", "garment", "cloth", "flammable", "wool", "fiber", "footwear", "wear"],
        "market": {
            "size_2026": "US$ 3,730 亿 (2026E，服饰)",
            "cagr": "CAGR 1.83% (2026-2031)",
            "note": "女装 ≈ $1,960 亿 / 男装 ≈ $1,200 亿 / 童装 ≈ $570 亿；线上占比 ≈ 31%",
            "source": "Statista, 2026",
            "source_url": "https://www.statista.com/outlook/cmo/apparel/united-states",
            "as_of": "2026-08",
        },
        "segments": [
            {"name": "女装", "note": "最大细分，快时尚+独立设计并行"},
            {"name": "男装", "note": "基础款+运动休闲，复购稳"},
            {"name": "童装", "note": "CPSIA 合规严，安全门槛高"},
            {"name": "鞋包配饰", "note": "TikTok 爆款集中，季节性强"},
        ],
        "regulators": ["FTC", "CPSC", "California OEHHA (Prop65)", "CPSIA"],
        "rules": [
            {"platform": "FTC（美国联邦贸易委员会）", "title": "纺织纤维与原产地标示 (Textile Rule / Wool Act)",
             "detail": "服装须标示纤维成分（含量≥1% 须列明）、原产地与制造商/经销商身份；羊毛制品受 Wool Products Labeling Act 约束。违规可罚。",
             "severity": "high", "source": "FTC Textile & Wool Rules", "source_url": "https://www.ftc.gov/legal-library/browse/rules/textile-products-identification-act", "as_of": AS_OF},
            {"platform": "CPSC", "title": "可燃性标准 (16 CFR Part 1610)",
             "detail": "服装须符合纺织品可燃性标准（尤其儿童睡衣有更严 1615/1616）；不合规可被召回下架。",
             "severity": "high", "source": "CPSC", "source_url": "https://www.cpsc.gov/", "as_of": AS_OF},
            {"platform": "CPSIA", "title": "儿童产品铅/邻苯限制",
             "detail": "童装/童鞋属儿童产品，铅含量 ≤100ppm、邻苯二甲酸盐受限，须第三方检测+CPC 证书。",
             "severity": "high", "source": "CPSC CPSIA", "source_url": "https://www.cpsc.gov/Business--Manufacturing/Business-Education/CPSA-Compliance-Guide-for-Manufacturers-Importers", "as_of": AS_OF},
            {"platform": "加州 EPA", "title": "Proposition 65 警示",
             "detail": "含铅/甲醛等有害物质超阈值的服饰须加贴 Prop 65 警示，否则可遭诉讼。",
             "severity": "medium", "source": "California OEHHA", "source_url": "https://oehha.ca.gov/proposition-65", "as_of": AS_OF},
            {"platform": "TikTok Shop（美国）", "title": "内容合规红线（2026 更新）",
             "detail": "90 天内累计违规可撤销电商权限；须真实上身演示、明示价格；禁虚假尺码/材质宣传。",
             "severity": "high", "source": "TikTok Shop 卖家中心", "source_url": "https://seller-us.tiktok.com/university/essay?knowledge_id=3106489578538795", "as_of": AS_OF},
        ],
        "opportunity": "美国服饰线上占比 ≈ 31% 且持续提升，快时尚与独立设计并存；TikTok Shop 内容电商为年轻客群新增量。柔性供应链 + 小单快反是工厂核心优势。",
        "risks": [
            "⚠️ 纺织纤维/羊毛/原产地标示是 FTC 硬性要求，错标可罚",
            "⚠️ 服装可燃性标准（1610）+ 童装更严（1615/1616）",
            "⚠️ 童装须 CPSIA 第三方检测 + CPC 证书",
            "⚠️ 对华 Section 301 覆盖服饰鞋包（HTS 61/62/64），须逐票确认税率",
        ],
        "advice": [
            "新手：TikTok Shop 快时尚小单快反试水",
            "工厂：Amazon + AliExpress，柔性供应链为王",
            "品牌：Amazon + TikTok Shop 社媒种草，重尺码/材质真实",
        ],
        "findings": [
            "美国服饰为万亿级成熟市场（2026E ≈ $3,730 亿），线上占比 ≈ 31% 且持续提升。",
            "FTC 纺织/羊毛标示 + 原产地是硬性合规；童装须 CPSIA 第三方检测与 CPC 证书。",
            "对华 Section 301 覆盖服饰鞋包（HTS 61/62/64），精确税率须逐票确认。",
            "TikTok Shop 内容电商为年轻客群新增量；柔性供应链+小单快反是工厂核心优势。",
            "工厂推荐路径：TikTok Shop 快反试水 → Amazon 主销 + eBay 长尾分销。",
        ],
        "tariff_alert": {
            "level": "high",
            "title": "对华 Section 301 附加关税覆盖服饰鞋包税则（须逐票确认税率）",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "HTS 61(针织服装)/62(非针织服装)/64(鞋类) 等广泛受 Section 301 约束；2024 四年期复审已调整税率，2026 强迫劳动提案对部分经济体加征附加税。精确附加税率须用 USTR 产品检索或 CBP 裁定确认。",
            "date": AS_OF, "source": "USTR Section 301", "url": "https://ustr.gov/node/9608", "as_of": AS_OF,
        },
        "platform_hotcats": {
            "Amazon（美国）": ["女装", "男装基础款", "鞋包", "运动休闲"],
            "TikTok Shop（美国）": ["女装潮款", "配饰", "鞋包", "节日礼"],
            "AliExpress 速卖通": ["潮流配饰", "基础服饰", "鞋包"],
            "eBay": ["二手/古着", "收藏款", "长尾尺码"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中", "中", "FBA + 类目审核，重尺码/材质真实"],
            ["TikTok Shop（美国）", "工厂快反试水", "中（本地主体）", "高（内容红线）", "小单快反验证爆款"],
            ["AliExpress", "跨境长尾卖家", "低", "中", "价格敏感和多尺码长尾"],
            ["eBay", "二手 / 古着", "低", "中", "古着+长尾流量"],
        ],
    },

    "home": {
        "name": "家居厨具", "name_en": "Home & Kitchen", "icon": "🍳",
        "subtitle": "United States · 高客单耐用品 + 强复购耗材",
        "fr_terms": ["consumer product", "furniture", "kitchen appliance", "household goods", "cookware"],
        "fr_strong": ["furniture", "kitchen", "appliance", "household", "cookware", "tableware", "mattress", "consumer product", "durable"],
        "market": {
            "size_2026": "厨具 US$ 60.8 亿 (2026E)；家居耐用品 ≈ $418 亿",
            "cagr": "厨具 CAGR 2.26% (2026-2031)",
            "note": "厨房/卫浴改造市场 ≈ $2,280 亿 (NKBA)；家居为 Amazon 高客单主力类目",
            "source": "Statista / Circana / NKBA, 2026",
            "source_url": "https://www.statista.com/outlook/cmo/furniture-do-it-yourself/united-states",
            "as_of": "2026-08",
        },
        "segments": [
            {"name": "厨房小电", "note": "空气炸锅/咖啡机/料理机，Amazon 爆款集中"},
            {"name": "锅具餐具", "note": "不粘/不锈钢/陶瓷，FDA 食品接触合规"},
            {"name": "家具家纺", "note": "高客单重货，海外仓履约关键"},
            {"name": "收纳清洁", "note": "清洁机器人/收纳，复购稳"},
        ],
        "regulators": ["CPSC", "FDA (食品接触)", "EPA (PFAS)", "California OEHHA (Prop65)"],
        "rules": [
            {"platform": "FDA", "title": "食品接触材料合规 (FDA 21 CFR)",
             "detail": "锅具/餐具/小电接触食品的部件须符合 FDA 食品接触物质标准（如氟聚合物、不锈钢铅迁移限值）；不合规可被扣留。",
             "severity": "high", "source": "FDA", "source_url": "https://www.fda.gov/food/food-packaging-food-contact-substances-fcs", "as_of": AS_OF},
            {"platform": "CPSC", "title": "耐用婴幼儿/家具安全",
             "detail": "儿童家具须符合 ASTM 标准与防倾倒（如抽屉柜 STURDY 法）；小电须 UL 安全认证。",
             "severity": "high", "source": "CPSC", "source_url": "https://www.cpsc.gov/", "as_of": AS_OF},
            {"platform": "EPA / 州", "title": "PFAS 与化学品限制",
             "detail": "不粘涂层等含 PFAS 产品面临多州限制与标识要求；加州 65 提案管铅/镉。",
             "severity": "medium", "source": "EPA / California", "source_url": "https://www.epa.gov/pfas", "as_of": AS_OF},
            {"platform": "Amazon", "title": "家居类目审核与认证",
             "detail": "家具/小电需 UL/ETL 认证与合规声明；儿童家具额外要求。",
             "severity": "medium", "source": "Amazon Seller Central", "source_url": "https://sell.amazon.com/pricing", "as_of": AS_OF},
            {"platform": "TikTok Shop（美国）", "title": "内容合规红线（2026 更新）",
             "detail": "90 天内累计违规可撤销电商权限；须真实演示、明示价格与赠品条件。",
             "severity": "high", "source": "TikTok Shop 卖家中心", "source_url": "https://seller-us.tiktok.com/university/essay?knowledge_id=3106489578538795", "as_of": AS_OF},
        ],
        "opportunity": "家居厨具为 Amazon 高客单主力类目，厨房小电+锅具为爆款集中地；海外仓履约解决重货痛点。FDA 食品接触合规是核心门槛也是差异化护城河。",
        "risks": [
            "⚠️ 食品接触部件须 FDA 合规（铅迁移/氟聚合物）",
            "⚠️ 小电须 UL/ETL 安全认证，儿童家具须 ASTM + STURDY",
            "⚠️ PFAS 多州限制与 Prop 65 警示",
            "⚠️ 重货履约成本高，海外仓为必选项",
        ],
        "advice": [
            "新手：厨房小电/锅具 Amazon 爆款试水",
            "工厂：海外仓 + 家具家纺高客单",
            "品牌：Amazon 重设计感与食品接触合规",
        ],
        "findings": [
            "家居厨具为 Amazon 高客单主力类目，厨房小电+锅具是爆款集中地。",
            "食品接触部件须 FDA 合规（铅迁移/氟聚合物），是核心门槛与差异化护城河。",
            "小电须 UL/ETL 认证，儿童家具须 ASTM + STURDY 防倾倒法。",
            "PFAS 多州限制与 Prop 65 警示需提前规避。",
            "重货履约成本高，海外仓为必选项；工厂路径：TikTok Shop 试水 → Amazon 海外仓高客单。",
        ],
        "tariff_alert": {
            "level": "medium",
            "title": "对华 Section 301 附加关税覆盖家居厨具税则",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "HTS 94(家具)/7323-7324(餐厨金属制品)/8516(小电) 等受 Section 301 约束；2026 强迫劳动提案对部分经济体加征附加税。精确税率须用 USTR 检索或 CBP 裁定确认。",
            "date": AS_OF, "source": "USTR Section 301", "url": "https://ustr.gov/node/9608", "as_of": AS_OF,
        },
        "platform_hotcats": {
            "Amazon（美国）": ["厨房小电", "锅具餐具", "家具家纺", "收纳清洁"],
            "TikTok Shop（美国）": ["空气炸锅", "咖啡机", "收纳好物", "装饰"],
            "AliExpress 速卖通": ["厨房工具", "收纳", "家居小件"],
            "eBay": ["二手家具", "收藏餐具", "长尾"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中", "中", "FBA + 海外仓，重 UL/FDA 认证"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（内容红线）", "厨房小电内容种草"],
            ["AliExpress", "跨境长尾卖家", "低", "中", "家居小件和价格敏感商品"],
            ["eBay", "二手 / 长尾", "低", "中", "二手家具+长尾"],
        ],
    },

    "beauty": {
        "name": "美妆个护", "name_en": "Beauty & Personal Care", "icon": "💄",
        "subtitle": "United States · 高毛利 + 强内容驱动",
        "fr_terms": ["cosmetic", "personal care", "MoCRA", "skincare", "makeup"],
        "fr_strong": ["cosmetic", "personal care", "mocra", "skincare", "makeup", "fragrance", "sunscreen", "fda", "color additive"],
        "market": {
            "size_2026": "US$ 1,067.6 亿 (2026E)",
            "cagr": "CAGR 2.44% (2026-2031)",
            "note": "另口径 ≈ $1,367 亿 CAGR 3.87%；线上占比 ≈ 59.9%，内容电商占比最高品类之一",
            "source": "Statista / strategyh, 2026",
            "source_url": "https://www.statista.com/outlook/cmo/beauty-personal-care/united-states",
            "as_of": "2026-08",
        },
        "segments": [
            {"name": "护肤", "note": "最大细分，成分党+抗老驱动"},
            {"name": "彩妆", "note": "TikTok 爆款集中，季节性强"},
            {"name": "香水", "note": "高客单，品牌溢价强"},
            {"name": "个护", "note": "洗发/身体，复购稳"},
        ],
        "regulators": ["FDA (MoCRA)", "FTC"],
        "rules": [
            {"platform": "FDA", "title": "MoCRA 现代化化妆品法规",
             "detail": "2024 起 MoCRA 要求化妆品工厂注册、产品清单备案、不良事件报告、香精致敏原标注；色素须 FDA 批号（color additive approval）。违规可扣留/禁令。",
             "severity": "high", "source": "FDA MoCRA", "source_url": "https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra", "as_of": AS_OF},
            {"platform": "FTC", "title": "成分与功效宣称合规",
             "detail": "「天然/有机/临床验证」等宣称须有 substantiation；禁止误导性功效表述；网红合作须披露。",
             "severity": "high", "source": "FTC", "source_url": "https://www.ftc.gov/business-guidance/industry/cosmetics", "as_of": AS_OF},
            {"platform": "Amazon", "title": "美妆类目审核",
             "detail": "美妆为受限类目，需资质与成分合规；建议 Brand Registry 防跟卖。",
             "severity": "medium", "source": "Amazon Seller Central", "source_url": "https://sell.amazon.com/pricing", "as_of": AS_OF},
            {"platform": "TikTok Shop（美国）", "title": "内容合规红线（2026 更新）",
             "detail": "90 天内累计违规可撤销权限；禁医疗/减肥/功效夸大宣称；须真实演示。",
             "severity": "high", "source": "TikTok Shop 卖家中心", "source_url": "https://seller-us.tiktok.com/university/essay?knowledge_id=3106489578538795", "as_of": AS_OF},
        ],
        "opportunity": "美妆个护高毛利、强内容驱动（TikTok 占比最高品类之一，线上 ≈ 60%）；成分党与国货成分出海是增量。MoCRA 合规是门槛也是信任背书。",
        "risks": [
            "⚠️ MoCRA 工厂注册+产品备案+不良事件报告为强制要求",
            "⚠️ 色素须 FDA 批号，功效宣称须有 substantiation",
            "⚠️ FTC 严打功效/成分虚假宣传，网红须披露",
            "⚠️ 对华 Section 301 覆盖部分美妆设备/包装（HTS 3304/3401 多为零但设备受约束）",
        ],
        "advice": [
            "新手：TikTok Shop 成分爆款试水",
            "工厂：Amazon + AliExpress，重 MoCRA 备案",
            "品牌：TikTok Shop + Amazon 成分叙事，重真实功效",
        ],
        "findings": [
            "美妆个护高毛利、强内容驱动（线上 ≈ 60%，TikTok 占比最高品类之一）。",
            "MoCRA 现代化法规强制工厂注册+产品备案+不良事件报告，是硬门槛也是信任背书。",
            "色素须 FDA 批号，功效/成分宣称须有 substantiation，FTC 严打虚假宣传。",
            "成分党与国货成分出海是增量；工厂路径：TikTok Shop 爆款 → Amazon 主销 + eBay 长尾分销。",
        ],
        "tariff_alert": {
            "level": "low",
            "title": "美妆成品多为零关税，但设备/包材受 Section 301 约束",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "HTS 3304(化妆品)/3401(洗护) 多数基础关税为零，但灌装/生产设备及部分包材受 Section 301 附加税约束。出口须以 USTR 检索确认具体编码税率。",
            "date": AS_OF, "source": "USTR Section 301", "url": "https://ustr.gov/node/9608", "as_of": AS_OF,
        },
        "platform_hotcats": {
            "Amazon（美国）": ["护肤", "彩妆", "香水", "个护"],
            "TikTok Shop（美国）": ["护肤爆款", "彩妆", "美甲", "香水"],
            "AliExpress 速卖通": ["美甲", "美容工具", "个护配件"],
            "eBay": ["收藏香水", "二手", "长尾"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中（类目审核）", "中", "FBA + Brand Registry，重 MoCRA"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（功效红线）", "成分种草验证爆款"],
            ["AliExpress", "跨境长尾卖家", "低", "中", "美妆工具和个护配件"],
            ["eBay", "二手 / 收藏", "低", "中", "收藏香水+长尾"],
        ],
    },

}


# The manifest is the source of truth for what this collector may emit.  The
# Reference blocks above provide factual content only for categories that are
# still configured. The manifest, never this mapping, decides what is emitted.
_MARKET_SCOPE = load_market_scope()
_US_SCOPE = configured_catalog(_MARKET_SCOPE, market_codes=["US"])
_RETIRED_PLATFORM_TERMS = ("walmart", "etsy", "shopify", "temu", "shein")


def _contains_retired_platform(value):
    text = str(value or "").casefold()
    return any(term in text for term in _RETIRED_PLATFORM_TERMS)


def _scrub_retired_platforms(value):
    """Drop retired platform references from nested collector configuration."""
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if key == "platform_hotcats":
                item = {
                    name: cats for name, cats in (item.items() if isinstance(item, dict) else [])
                    if not _contains_retired_platform(name)
                }
            sanitized = _scrub_retired_platforms(item)
            if sanitized is not None:
                cleaned[key] = sanitized
        return cleaned
    if isinstance(value, list):
        cleaned = []
        for item in value:
            if isinstance(item, list) and any(_contains_retired_platform(part) for part in item):
                continue
            sanitized = _scrub_retired_platforms(item)
            if sanitized is not None:
                cleaned.append(sanitized)
        return cleaned
    if isinstance(value, str) and _contains_retired_platform(value):
        return None
    return value


def _minimal_category_config(row):
    key = str(row.get("code") or "generic").strip().lower()
    name = str(row.get("name") or key).strip()
    names = {
        "generic": ("通用品类", "General Merchandise", "📦", ["consumer product", "retail"], "覆盖美国市场的通用商品机会与合规要求"),
        "pet-food": ("宠物食品", "Pet Food", "🐾", ["pet food", "animal food", "pet nutrition"], "宠物食品消费稳定复购，配方、标签和进口合规决定上市速度"),
        "pet-supplies": ("宠物用品", "Pet Supplies", "🐕", ["pet supplies", "animal product", "pet safety"], "宠物用品覆盖用品、护理和出行场景，安全声明与材料合规是关键"),
    }
    default_name, name_en, icon, terms, opportunity = names.get(key, (name, key.replace("-", " ").title(), "📦", [key], f"{name}在美国市场的需求、平台和合规机会"))
    if name == key:
        name = default_name
    return {
        "name": name,
        "name_en": name_en,
        "icon": icon,
        "subtitle": f"United States · {name} market intelligence",
        "fr_terms": terms,
        "fr_strong": terms + ["import", "safety", "label"],
        "market": {
            "size_2026": "待正式来源核验",
            "cagr": "待正式来源核验",
            "note": opportunity,
            "source": "Federal Register / official market sources",
            "source_url": "https://www.federalregister.gov/",
            "as_of": AS_OF,
        },
        "segments": [{"name": name, "note": opportunity}],
        "regulators": ["FDA", "CPSC", "FTC"],
        "rules": [],
        "opportunity": opportunity,
        "risks": ["需以官方来源核验产品、标签和进口要求", "平台政策和州级要求可能变化"],
        "advice": ["先核验目标平台、市场和品类范围，再进行小批量验证"],
        "findings": [opportunity],
        "tariff_alert": {
            "level": "medium", "title": f"{name}进口与合规要求需按具体商品核验",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "具体税号、标签、认证和进口要求以官方当前规则和商品事实为准。",
            "date": AS_OF, "source": "USTR / CBP", "url": "https://ustr.gov/", "as_of": AS_OF,
        },
        "platform_hotcats": {},
        "matrix": [],
    }


def _manifest_category_configs():
    rows = {
        str(row.get("code") or "").strip().lower(): row
        for row in _MARKET_SCOPE.get("categories", []) or []
        if isinstance(row, dict) and str(row.get("code") or "").strip()
    }
    keys = _US_SCOPE.get("category_keys") or list(rows)
    result = {}
    for key in keys:
        row = rows.get(str(key).strip().lower(), {"code": key, "name": key})
        source = _CATEGORY_REFERENCES.get(str(key).strip().lower()) or _minimal_category_config(row)
        result[str(key).strip().lower()] = _scrub_retired_platforms(copy.deepcopy(source))
    return result


CATEGORIES = _manifest_category_configs()


def _configured_platform_keys():
    return [str(key).strip().lower() for key in (_US_SCOPE.get("platform_keys") or []) if str(key).strip()]


def _configured_platform_records():
    by_key = {str(row.get("platform_key") or "").strip().lower(): row for row in PLATFORMS_BASE}
    manifest_rows = {
        str(row.get("key") or "").strip().lower(): row
        for row in _MARKET_SCOPE.get("platforms", []) or []
        if isinstance(row, dict) and str(row.get("key") or "").strip()
    }
    records = []
    for key in _configured_platform_keys():
        row = copy.deepcopy(by_key.get(key) or {})
        catalog = manifest_rows.get(key, {})
        row.setdefault("platform_key", key)
        row.setdefault("name", catalog.get("name") or key)
        row.setdefault("type", catalog.get("kind") or "marketplace")
        row.setdefault("market", "美国")
        row.setdefault("commission", "按平台和品类当前费率核验")
        row.setdefault("feeDesc", "平台费用、履约和规则以官方卖家中心为准")
        row.setdefault("entry", "按平台当前入驻要求申请")
        row.setdefault("strength", "覆盖目标市场的跨境销售渠道")
        row.setdefault("risk", "平台规则、费用和履约要求会变化")
        row.setdefault("source", f"{row['name']} 官方卖家中心")
        row.setdefault("source_url", "https://www.google.com/search?q=" + urllib.parse.quote(row["name"] + " seller"))
        row.setdefault("as_of", AS_OF)
        records.append(row)
    return records

# ---------------------------------------------------------------------------
# 实时政策/预警（Federal Register 真实公文）
# ---------------------------------------------------------------------------
def is_relevant(doc, strong):
    blob = " ".join([
        doc.get("title", ""),
        doc.get("abstract", "") or "",
        " ".join(doc.get("topics", []) or []),
    ]).lower()
    if not any(k in blob for k in strong):
        return False
    # 排除与品类明显无关的（如珠宝/造币）以降噪；珠宝类不在本系统范畴
    if "jewel" in blob and "electronic" not in blob and "cosmetic" not in blob:
        if not any(k in blob for k in ["electronic", "semiconductor", "apparel", "textile", "toy", "automotive", "dietary", "cosmetic", "sport", "kitchen", "furniture"]):
            return False
    return True

def fetch_fr_policies(cat_key, limit=24, start_date=None, end_date=None, page=1, per_page=15):
    """Fetch Federal Register records for a category and optional date window."""
    cfg = CATEGORIES[cat_key]
    strong = cfg["fr_strong"]
    policies, alerts = [], []
    seen = set()
    attempted_at = utc_now().isoformat()
    request_count = 0
    successful_requests = 0
    failed_requests = 0
    try:
        assert_source_collectable("federal-register")
    except SourceGovernanceError as error:
        return policies, alerts, {
            "source": "federal_register",
            "status": "skipped",
            "attempted_at": attempted_at,
            "request_count": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "records_collected": 0,
            "errors": [str(error)],
        }
    for term in cfg["fr_terms"]:
        request_count += 1
        params = {
            "conditions[term]": term,
            "per_page": max(int(per_page), 1),
            "page": max(int(page), 1),
            "order": "oldest" if start_date else "newest",
            "fields[]": ["title", "abstract", "publication_date", "agencies",
                         "html_url", "document_number", "topics", "type"],
        }
        if start_date:
            params["filter[publication_date][gte]"] = str(start_date)[:10]
        if end_date:
            params["filter[publication_date][lte]"] = str(end_date)[:10]
        data = http_get_json(FR_API, params=params)
        if not isinstance(data, dict) or not isinstance(data.get("results"), list):
            failed_requests += 1
            continue
        successful_requests += 1
        for r in data["results"]:
            dn = r.get("document_number")
            if not dn or dn in seen:
                continue
            if not is_relevant(r, strong):
                continue
            seen.add(dn)
            ags = r.get("agencies") or []
            agency = ags[0].get("name", "") if ags else ""
            title = (r.get("title") or "").strip()
            abstract = (r.get("abstract") or "").strip()
            entry = {
                "title": title,
                "date": r.get("publication_date", "")[:10],
                "agency": agency,
                "summary": (abstract[:280] + "…") if len(abstract) > 280 else abstract,
                "url": r.get("html_url", ""),
                "source": "Federal Register (美国联邦公报)",
                "source_url": "https://www.federalregister.gov/",
                "as_of": AS_OF,
                "collected_at": attempted_at,
                "live": True,
            }
            policies.append(entry)
            # 重大贸易/安全行动 -> 预警中心
            if any(k in (title + abstract).lower() for k in
                   ["section 301", "tariff", "duty", "antidumping", "countervailing",
                    "import restriction", "recall", "safety", "ban", "proposed rule"]):
                if any(k in (title + abstract).lower() for k in
                       ["tariff", "duty", "antidumping", "section 301", "import restriction", "recall", "ban"]):
                    sev = "high"
                else:
                    sev = "medium"
                alerts.append({
                    "level": sev,
                    "title": title,
                    "market": "美国",
                    "platform": agency or "政府/监管",
                    "detail": (abstract[:200] + "…") if len(abstract) > 200 else abstract,
                    "date": r.get("publication_date", "")[:10],
                    "source": "Federal Register",
                    "url": r.get("html_url", ""),
                    "as_of": AS_OF,
                    "collected_at": attempted_at,
                    "live": True,
                })
        if len(policies) >= limit:
            break
    policies.sort(key=lambda x: x.get("date", ""), reverse=True)
    alerts.sort(key=lambda x: x.get("date", ""), reverse=True)
    if successful_requests == request_count:
        status = "succeeded"
    elif successful_requests:
        status = "degraded"
    else:
        status = "failed"
    telemetry = {
        "source": "federal_register",
        "status": status,
        "attempted_at": attempted_at,
        "request_count": request_count,
        "successful_requests": successful_requests,
        "failed_requests": failed_requests,
        "records_collected": len(policies) + len(alerts),
    }
    return policies[:limit], alerts[:18], telemetry


# ---------------------------------------------------------------------------
# 板块构建
# ---------------------------------------------------------------------------
def build_country(cat_key):
    cfg = CATEGORIES[cat_key]
    m = cfg["market"]
    macro = list(US_MACRO)
    market_row = [
        ["%s市场规模(2026E)" % cfg["name"], m["size_2026"], m["cagr"], m["source"]],
        ["%s市场说明" % cfg["name"], m["note"], "—", m["source"]],
    ]
    macro = market_row + macro
    return {
        "market": "美国%s" % cfg["name"],
        "cat_key": cat_key,
        "name_en": cfg["name_en"],
        "icon": cfg["icon"],
        "flag": "🇺🇸",
        "subtitle": cfg["subtitle"],
        "macro": macro,
        "segments": cfg["segments"],
        "opportunity": cfg["opportunity"],
        "risks": cfg["risks"],
        "advice": cfg["advice"],
        "source": "Statista / eMarketer / US Census / USTR / 行业研究综合",
        "source_url": "https://www.statista.com/outlook/cmo/accessories/watches-jewelry/jewelry/worldwide",
        "as_of": AS_OF,
    }


def build_platforms(cat_key):
    cfg = CATEGORIES[cat_key]
    hot = cfg.get("platform_hotcats", {})
    out = []
    for p in _configured_platform_records():
        pp = dict(p)
        pp["hotCats"] = hot.get(p["name"], hot.get(p.get("platform_key"), []))
        out.append(pp)
    return out


def build_rules(cat_key):
    return [
        rule for rule in CATEGORIES[cat_key]["rules"]
        if isinstance(rule, dict) and not _contains_retired_platform(rule.get("platform"))
    ]


def build_matrix(cat_key):
    """Keep only configured platform rows from the legacy comparison matrix."""
    rows = []
    configured = set(_configured_platform_keys())
    aliases = platform_alias_map(_MARKET_SCOPE)
    for row in CATEGORIES[cat_key].get("matrix", []):
        if not isinstance(row, list) or not row:
            continue
        label = str(row[0] or "").strip().lower()
        key = aliases.get(label)
        if key in configured or (not key and not _contains_retired_platform(label)):
            rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# 主流程（单品类）
# ---------------------------------------------------------------------------
def collect_category(cat_key, no_network=False):
    cfg = CATEGORIES[cat_key]
    run_at = utc_now().isoformat()
    old = load_old(cat_key)
    print("[US-Market:%s] 构建国家板块 / 平台档案 / 规则（真实参考库）…" % cat_key)
    country = build_country(cat_key)
    platforms = build_platforms(cat_key)
    rules = build_rules(cat_key)

    policies, live_alerts = [], []
    if not no_network:
        print("[US-Market:%s] 实时拉取 Federal Register %s 公文…" % (cat_key, cfg["name"]))
        policies, live_alerts, collection = fetch_fr_policies(cat_key)
        print("[US-Market:%s]   政策 %d 条 / 预警 %d 条（%s）" % (
            cat_key, len(policies), len(live_alerts), collection["status"]
        ))
    else:
        collection = {
            "source": "federal_register",
            "status": "skipped",
            "attempted_at": run_at,
            "request_count": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "records_collected": 0,
        }

    collection_status = collection["status"]
    old_meta = old.get("meta", {}) if isinstance(old, dict) else {}

    # A total outage must leave the cached factual payload and its original
    # timestamps untouched. Only the attempt status is allowed to advance.
    if collection_status in {"failed", "skipped"} and old:
        out = _scrub_retired_platforms(copy.deepcopy(old))
        out["platforms"] = build_platforms(cat_key)
        out["matrix"] = build_matrix(cat_key)
        out["rules"] = build_rules(cat_key)
        meta = out.setdefault("meta", {})
        meta.setdefault("content_updated_at", meta.get("generated_at"))
        meta["collection_status"] = collection_status
        meta["last_attempted_at"] = collection.get("attempted_at") or run_at
        meta["cache_used"] = True
        meta["cached_sections"] = ["policies", "alerts"]
        meta["collection"] = dict(collection, cache_used=True, cached_sections=["policies", "alerts"])
        print("[US-Market:%s]   全量沿用本地缓存；内容时间保持 %s" % (
            cat_key, meta.get("content_updated_at") or meta.get("generated_at") or "未知"
        ))
        return out

    # 关税专项预警（静态真实提示，非伪造）
    ta = dict(cfg["tariff_alert"])
    ta["live"] = False
    alerts = [ta] + live_alerts

    # A partial source response is incomplete. Keep missing live sections from
    # cache, but expose that fact so the quality gate cannot call it healthy.
    cached_sections = []
    if collection_status == "degraded" and old:
        if not policies:
            policies = copy.deepcopy(old.get("policies", []))
            cached_sections.append("policies")
            print("[US-Market:%s]   部分失败，沿用缓存 policies (%d)" % (cat_key, len(policies)))
        if not live_alerts:
            cached_live_alerts = [
                copy.deepcopy(item) for item in old.get("alerts", [])
                if isinstance(item, dict) and item.get("live") is True
            ]
            if cached_live_alerts:
                alerts = [ta] + cached_live_alerts
                cached_sections.append("alerts")
                print("[US-Market:%s]   部分失败，沿用缓存 live alerts (%d)" % (
                    cat_key, len(cached_live_alerts)
                ))

    candidate = {
        "meta": {
            "market": "美国%s (US %s)" % (cfg["name"], cfg["name_en"]),
            "cat_key": cat_key,
            "generated_at": run_at,
            "content_updated_at": run_at,
            "as_of": AS_OF,
            "live_source": "Federal Register API (https://www.federalregister.gov/api/v1)",
            "collection_status": collection_status,
            "last_attempted_at": collection.get("attempted_at") or run_at,
            "last_checked_at": run_at if collection_status == "succeeded" else old_meta.get("last_checked_at"),
            "cache_used": bool(cached_sections),
            "cached_sections": cached_sections,
            "collection": dict(collection, cache_used=bool(cached_sections), cached_sections=cached_sections),
            "sections": ["country", "platforms", "rules", "policies", "alerts"],
            "counts": {
                "country": 1, "platforms": len(platforms), "rules": len(rules),
                "policies": len(policies), "alerts": len(alerts),
            },
        },
        "country": country,
        "findings": cfg["findings"],
        "platforms": platforms,
        "matrix": build_matrix(cat_key),
        "rules": rules,
        "policies": policies,
        "alerts": alerts,
    }
    if old and content_signature(candidate) == content_signature(old):
        out = copy.deepcopy(old)
        meta = out.setdefault("meta", {})
        meta.setdefault("content_updated_at", meta.get("generated_at"))
        meta["collection_status"] = collection_status
        meta["last_attempted_at"] = collection.get("attempted_at") or run_at
        if collection_status == "succeeded":
            meta["last_checked_at"] = run_at
        meta["cache_used"] = bool(cached_sections)
        meta["cached_sections"] = cached_sections
        meta["collection"] = dict(collection, cache_used=bool(cached_sections), cached_sections=cached_sections)
        return out
    return candidate


def out_file(cat_key):
    return os.path.join(DATA_DIR, "%s.json" % cat_key)


def load_old(cat_key):
    try:
        with open(out_file(cat_key), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 校验
# ---------------------------------------------------------------------------
def validate(out):
    ok = True
    msgs = []
    for k in ["country", "platforms", "rules", "policies", "alerts"]:
        if k not in out:
            ok = False; msgs.append("缺失板块: %s" % k); continue
        v = out[k]
        n = len(v) if isinstance(v, list) else 1
        msgs.append("  %-10s %d 条" % (k, n))
        if isinstance(v, list):
            for i, it in enumerate(v):
                if isinstance(it, dict) and not it.get("source"):
                    ok = False; msgs.append("  ! %s[%d] 缺 source" % (k, i))
    print("[validate] 结构校验:")
    print("\n".join(msgs))
    return ok


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------
def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--category", help="仅采集指定品类 key（如 electronics）")
    p.add_argument("--no-network", action="store_true", help="仅用本地参考库重建")
    p.add_argument("--validate", action="store_true", help="离线校验输出结构")
    args = p.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)
    if args.category and args.category not in CATEGORIES:
        p.error("category must be one of: " + ", ".join(CATEGORIES))
    keys = [args.category] if args.category else list(CATEGORIES.keys())

    if args.validate:
        all_ok = True
        for k in keys:
            old = load_old(k)
            if old:
                ok = validate(old)
                all_ok = all_ok and ok
                print("[validate] %s: %s" % (k, "OK" if ok else "FAIL"))
            else:
                print("[validate] %s: 无数据文件" % k)
                all_ok = False
        sys.exit(0 if all_ok else 1)

    run_at = utc_now().isoformat()
    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            old_index = json.load(f)
    except (OSError, ValueError):
        old_index = {}
    index = {"generated_at": old_index.get("generated_at"), "as_of": old_index.get("as_of"),
             "last_attempted_at": run_at, "categories": []}
    category_statuses = []
    content_times = []
    for k in keys:
        out = collect_category(k, no_network=args.no_network)
        validate(out)
        with open(out_file(k), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        print("[US-Market] 已写入 %s" % out_file(k))
        cfg = CATEGORIES[k]
        meta = out.get("meta", {})
        category_statuses.append(meta.get("collection_status", "failed"))
        if meta.get("content_updated_at") or meta.get("generated_at"):
            content_times.append(meta.get("content_updated_at") or meta.get("generated_at"))
        index["categories"].append({
            "key": k, "name": cfg["name"], "name_en": cfg["name_en"],
            "icon": cfg["icon"], "file": "%s.json" % k,
            "market_size": cfg["market"]["size_2026"],
            "cagr": cfg["market"]["cagr"],
            "policy_count": out["meta"]["counts"]["policies"],
            "alert_count": out["meta"]["counts"]["alerts"],
            "collection_status": meta.get("collection_status", "failed"),
            "content_updated_at": meta.get("content_updated_at") or meta.get("generated_at"),
            "last_checked_at": meta.get("last_checked_at"),
            "cache_used": bool(meta.get("cache_used")),
        })

    category_requests = 0
    category_successes = 0
    category_failures = 0
    category_records = 0
    category_cached = []
    for k in keys:
        category = load_old(k) or {}
        meta = category.get("meta", {}) if isinstance(category, dict) else {}
        collection = meta.get("collection", {}) if isinstance(meta.get("collection"), dict) else {}
        category_requests += int(collection.get("request_count") or 0)
        category_successes += int(collection.get("successful_requests") or 0)
        category_failures += int(collection.get("failed_requests") or 0)
        counts = meta.get("counts", {}) if isinstance(meta.get("counts"), dict) else {}
        category_records += int(counts.get("policies") or 0) + int(counts.get("alerts") or 0)
        if meta.get("cache_used"):
            category_cached.append(k)
    if any(status == "failed" for status in category_statuses):
        index["collection_status"] = "failed"
    elif any(status in {"degraded", "skipped"} for status in category_statuses):
        index["collection_status"] = "degraded"
    else:
        index["collection_status"] = "succeeded"
    if content_times:
        index["generated_at"] = max(content_times)
        index["as_of"] = iso_date(index["generated_at"])
    if index["collection_status"] == "succeeded":
        index["last_checked_at"] = run_at
    elif old_index.get("last_checked_at"):
        index["last_checked_at"] = old_index["last_checked_at"]

    category_status = index["collection_status"]
    append_collection_source({
        "key": "us_market_categories",
        "label": "美国品类情报 Federal Register",
        "domain": "market_intelligence",
        "core": True,
        "status": "degraded" if category_status == "degraded" else ("failed" if category_status == "failed" else "succeeded"),
        "market_codes": _US_SCOPE.get("market_codes") or ["US"],
        "platform_keys": _configured_platform_keys(),
        "request_count": category_requests,
        "successful_requests": category_successes,
        "failed_requests": category_failures,
        "records_collected": category_records,
        "records_in_scope": category_records,
        "cache_used": bool(category_cached),
        "cached_sections": category_cached,
        "last_checked_at": index.get("last_checked_at"),
        "content_updated_at": index.get("generated_at"),
    })

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print("[US-Market] 已写入索引 %s（%d 品类）" % (INDEX_FILE, len(index["categories"])))


if __name__ == "__main__":
    main()
