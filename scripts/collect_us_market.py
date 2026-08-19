#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
collect_us_market.py — 美国市场「全品类」单点情报采集器（参数化 · 真实源）

覆盖用户指定的 5 大板块 × 8 个品类：
  1. country    美国 <品类> 宏观全景（真实参考 + 实时关税）
  2. platforms  电商平台档案（7 平台 × 品类适配）
  3. rules      平台 / 监管合规红线（真实法规）
  4. policies   实时 Federal Register <品类> 公文（API 实时抓取）
  5. alerts     预警中心（FR 实时 + 关税专项）

品类（每品类一份报告 / 一份数据）：
  消费电子 / 服饰 / 家居厨具 / 美妆个护 / 玩具 / 运动户外 / 汽配 / 保健品

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
  python scripts/collect_us_market.py                # 采集全部 8 品类
  python scripts/collect_us_market.py --category electronics   # 单品类
  python scripts/collect_us_market.py --no-network   # 仅用本地参考库重建
  python scripts/collect_us_market.py --validate     # 离线校验输出结构
"""

import json
import os
import sys
import glob
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data", "us_market")
INDEX_FILE = os.path.join(DATA_DIR, "index.json")

FR_API = "https://www.federalregister.gov/api/v1/documents.json"
AS_OF = datetime.now(timezone.utc).strftime("%Y-%m-%d")
UA = {"User-Agent": "Mozilla/5.0 (Mercator US-Market Collector; +https://github.com/lidengrong3-prog/mercator)"}

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
# 共享：7 大平台档案（基础真实费率；hotCats 按品类覆盖）
# ---------------------------------------------------------------------------
PLATFORMS_BASE = [
    {
        "name": "Amazon（美国）", "type": "货架电商", "market": "美国",
        "commission": "多数品类佣金 8%–20%（如消费电子 8%、服饰 17%、家居 15%、美妆 8%–15%、玩具 15%、运动 15%、汽配 12%–15%、保健品 15%）；专业计划 $39.99/月 + FBA 仓储配送费",
        "feeDesc": "最大流量与信任背书；FBA 本土履约；Brand Registry 防跟卖",
        "entry": "跨境可入驻；部分类目需审核/资质（如保健品、美妆、汽配）",
        "strength": "最大流量与信任背书，高客单承接力强",
        "risk": "佣金高、价格战、账号合规风险",
        "source": "Amazon Seller Central 销售费用(2026)",
        "source_url": "https://sell.amazon.com/pricing",
        "as_of": AS_OF,
    },
    {
        "name": "TikTok Shop（美国）", "type": "内容电商", "market": "美国",
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
        "name": "Walmart Marketplace", "type": "货架电商", "market": "美国",
        "commission": "佣金 6%–15%（按品类），WFS 仓储费 $0.75/立方英尺/月，无月费/入驻费",
        "feeDesc": "WFS 本土仓 + 跨境；47 个履约中心，88% 美国人口两日达",
        "entry": "跨境店可入驻，审核较严",
        "strength": "高信任、低佣金、本土履约",
        "risk": "流量弱于 Amazon、品类受限",
        "source": "Walmart Marketplace 费用说明",
        "source_url": "https://marketplace.walmart.com/",
        "as_of": AS_OF,
    },
    {
        "name": "eBay", "type": "货架/拍卖", "market": "美国",
        "commission": "成交费约 13%（按品类），店铺订阅另计；无月费基础店",
        "feeDesc": "开放入驻门槛低；二手/长尾天然场",
        "entry": "开放入驻，门槛低",
        "strength": "二手/收藏/长尾流量，国际站点可触达",
        "risk": "假货争议、价格透明压利润",
        "source": "eBay 费用说明（参考）",
        "source_url": "https://www.ebay.com/sellercenter",
        "as_of": AS_OF,
    },
    {
        "name": "Etsy", "type": "手作/设计师", "market": "美国",
        "commission": "上架费 $0.20/件 + 交易费 6.5% + 支付处理费 6.5%（按国别）",
        "feeDesc": "无月费；手作/复古/定制定位",
        "entry": "开放入驻",
        "strength": "设计师/手工溢价高、客群精准",
        "risk": "流量小于综合平台、仿品管控",
        "source": "Etsy Seller Handbook（参考）",
        "source_url": "https://www.etsy.com/seller-handbook",
        "as_of": AS_OF,
    },
    {
        "name": "Shopify（独立站 DTC）", "type": "独立站", "market": "美国",
        "commission": "无平台佣金；订阅 $39–$399/月 + 支付费率 ~2.9%+$0.30",
        "feeDesc": "品牌自主、数据自有；需自引流量",
        "entry": "自助建站",
        "strength": "品牌资产沉淀、毛利高",
        "risk": "获客成本高、运营重",
        "source": "Shopify 定价（参考）",
        "source_url": "https://www.shopify.com/pricing",
        "as_of": AS_OF,
    },
    {
        "name": "Temu / SHEIN", "type": "低价全托管", "market": "美国",
        "commission": "全托管/半托管模式，平台定价，卖家挣供货价",
        "feeDesc": "极致低价流量，卖家利润薄；关税敏感",
        "entry": "供货商入驻（全托管）",
        "strength": "海量低价流量",
        "risk": "利润极低、品牌稀释、关税敏感",
        "source": "平台公开模式（参考）",
        "source_url": "https://www.temu.com/",
        "as_of": AS_OF,
    },
]

# ---------------------------------------------------------------------------
# 品类配置（真实数据锚点 + 合规 + FR 检索词）
# ---------------------------------------------------------------------------
CATEGORIES = {
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
            "品牌：Amazon Brand Registry + Shopify DTC 双轨",
        ],
        "findings": [
            "美国是全球最大单一电商市场（2026E ≈ $1.6 万亿），消费电子高频高复购，是工厂出海首选试水品类。",
            "含射频产品须 FCC 认证、含锂电池须 UN38.3/UL，是两大硬性合规门槛，决定能否清关与上线。",
            "对华 Section 301 附加关税覆盖大量电子 HTS 编码，精确税率须逐票用 USTR 检索或 CBP 裁定确认。",
            "Amazon 承接高客单 + TikTok Shop 内容种草为双引擎；本土仓履约与品牌化是利润关键。",
            "工厂推荐路径：TikTok Shop 试水爆款 → Amazon FBA + 独立站双轨 → 品牌 DTC 沉淀资产。",
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
            "Walmart Marketplace": ["家电配件", "电脑外设", "智能家居"],
            "eBay": ["二手电子", "收藏机型", "配件长尾"],
            "Etsy": ["手工电子饰品", "定制外壳"],
            "Shopify（独立站 DTC）": ["品牌官网", "订阅制配件"],
            "Temu / SHEIN": ["低价配件", "合金/塑料外壳"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中（类目审核）", "中", "FBA + Brand Registry，重 UL/电池合规"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（内容红线）", "内容种草验证爆款，控退货率"],
            ["Walmart", "本土履约卖家", "中高", "低", "WFS 降低履约成本，高信任"],
            ["eBay", "二手 / 长尾", "低", "中", "二手+收藏款流量"],
            ["Etsy", "设计师/手工", "低", "低", "手工溢价，客群精准"],
            ["Shopify", "品牌 DTC", "自助", "中（获客）", "沉淀品牌资产与复购"],
            ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量需谨慎，防品牌稀释"],
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
            "工厂：Amazon + 独立站，柔性供应链为王",
            "品牌：DTC + 社媒种草，重尺码/材质真实",
        ],
        "findings": [
            "美国服饰为万亿级成熟市场（2026E ≈ $3,730 亿），线上占比 ≈ 31% 且持续提升。",
            "FTC 纺织/羊毛标示 + 原产地是硬性合规；童装须 CPSIA 第三方检测与 CPC 证书。",
            "对华 Section 301 覆盖服饰鞋包（HTS 61/62/64），精确税率须逐票确认。",
            "TikTok Shop 内容电商为年轻客群新增量；柔性供应链+小单快反是工厂核心优势。",
            "工厂推荐路径：TikTok 快反试水 → Amazon + 独立站 → 品牌 DTC 沉淀。",
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
            "Walmart Marketplace": ["家庭装", "基础款", "童装"],
            "eBay": ["二手/古着", "收藏款", "长尾尺码"],
            "Etsy": ["手作服饰", "定制刺绣", "复古"],
            "Shopify（独立站 DTC）": ["品牌官网", "会员复购", "定制"],
            "Temu / SHEIN": ["低价快时尚", "合金/合成"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中", "中", "FBA + 类目审核，重尺码/材质真实"],
            ["TikTok Shop（美国）", "工厂快反试水", "中（本地主体）", "高（内容红线）", "小单快反验证爆款"],
            ["Walmart", "本土履约卖家", "中高", "低", "高信任基础款"],
            ["eBay", "二手 / 古着", "低", "中", "古着+长尾流量"],
            ["Etsy", "设计师/手作", "低", "低", "手工溢价，客群精准"],
            ["Shopify", "品牌 DTC", "自助", "中（获客）", "沉淀品牌与复购"],
            ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量需谨慎"],
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
            "品牌：DTC 重设计感与食品接触合规",
        ],
        "findings": [
            "家居厨具为 Amazon 高客单主力类目，厨房小电+锅具是爆款集中地。",
            "食品接触部件须 FDA 合规（铅迁移/氟聚合物），是核心门槛与差异化护城河。",
            "小电须 UL/ETL 认证，儿童家具须 ASTM + STURDY 防倾倒法。",
            "PFAS 多州限制与 Prop 65 警示需提前规避。",
            "重货履约成本高，海外仓为必选项；工厂路径：Amazon 爆款 → 海外仓高客单 → DTC。",
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
            "Walmart Marketplace": ["家庭装", "基础家具", "厨具"],
            "eBay": ["二手家具", "收藏餐具", "长尾"],
            "Etsy": ["手作家居", "定制餐具", "复古"],
            "Shopify（独立站 DTC）": ["品牌官网", "设计款", "定制"],
            "Temu / SHEIN": ["低价厨具", "合金/塑料"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中", "中", "FBA + 海外仓，重 UL/FDA 认证"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（内容红线）", "厨房小电内容种草"],
            ["Walmart", "本土履约卖家", "中高", "低", "高信任基础款"],
            ["eBay", "二手 / 长尾", "低", "中", "二手家具+长尾"],
            ["Etsy", "设计师/手作", "低", "低", "手工溢价"],
            ["Shopify", "品牌 DTC", "自助", "中（获客）", "设计款沉淀"],
            ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量谨慎"],
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
            "工厂：Amazon + 独立站，重 MoCRA 备案",
            "品牌：DTC + 成分叙事，重真实功效",
        ],
        "findings": [
            "美妆个护高毛利、强内容驱动（线上 ≈ 60%，TikTok 占比最高品类之一）。",
            "MoCRA 现代化法规强制工厂注册+产品备案+不良事件报告，是硬门槛也是信任背书。",
            "色素须 FDA 批号，功效/成分宣称须有 substantiation，FTC 严打虚假宣传。",
            "成分党与国货成分出海是增量；工厂路径：TikTok 爆款 → Amazon+独立站 → DTC。",
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
            "Walmart Marketplace": ["家庭个护", "基础护肤", "洗护"],
            "eBay": ["收藏香水", "二手", "长尾"],
            "Etsy": ["手工皂", "天然护肤", "定制"],
            "Shopify（独立站 DTC）": ["品牌官网", "订阅制", "定制"],
            "Temu / SHEIN": ["低价彩妆", "合金/塑料包装"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中（类目审核）", "中", "FBA + Brand Registry，重 MoCRA"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（功效红线）", "成分种草验证爆款"],
            ["Walmart", "本土履约卖家", "中高", "低", "高信任基础个护"],
            ["eBay", "二手 / 收藏", "低", "中", "收藏香水+长尾"],
            ["Etsy", "手工/天然", "低", "低", "手工溢价"],
            ["Shopify", "品牌 DTC", "自助", "中（获客）", "订阅制沉淀"],
            ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量谨慎"],
        ],
    },

    "toys": {
        "name": "玩具乐器", "name_en": "Toys & Games", "icon": "🧸",
        "subtitle": "United States · 强季节 + 严安全合规",
        "fr_terms": ["toy", "children product", "children's product", "plaything", "CPSC toy"],
        "fr_strong": ["toy", "children", "plaything", "crib", "baby", "cpsc", "ASTM F963"],
        "market": {
            "size_2026": "玩具 US$ 387 亿 (2026E)；玩具游戏合计 ≈ $820.9 亿",
            "cagr": "玩具 CAGR 3.8% (2026-2031)",
            "note": "Q4  holiday 占全年约 1/3；安全合规门槛全品类最高之一",
            "source": "Morgan Reed / Grand View, 2026",
            "source_url": "https://www.grandviewresearch.com/industry-analysis/toys-market",
            "as_of": "2026-08",
        },
        "segments": [
            {"name": "益智教育", "note": "STEM/积木，家长偏好高"},
            {"name": "娃娃玩偶", "note": "IP 授权集中，TikTok 爆款"},
            {"name": "户外/运动玩具", "note": "季节性+庭院场景"},
            {"name": "婴幼儿玩具", "note": "CPSIA 合规最严，安全门槛高"},
        ],
        "regulators": ["CPSC", "ASTM F963", "CPSIA"],
        "rules": [
            {"platform": "CPSC", "title": "玩具安全委员会标准 (ASTM F963)",
             "detail": "玩具须符合 ASTM F963 机械/物理/燃烧/化学要求；CPSC 强制执行，违规可召回。",
             "severity": "high", "source": "CPSC", "source_url": "https://www.cpsc.gov/", "as_of": AS_OF},
            {"platform": "CPSIA", "title": "铅/邻苯 + 第三方检测 + CPC",
             "detail": "儿童玩具铅 ≤100ppm、邻苯二甲酸盐受限；须第三方检测并出具儿童产品证书 (CPC)，随货提供。",
             "severity": "high", "source": "CPSC CPSIA", "source_url": "https://www.cpsc.gov/Business--Manufacturing/Business-Education/CPSA-Compliance-Guide-for-Manufacturers-Importers", "as_of": AS_OF},
            {"platform": "Amazon", "title": "玩具类目资质",
             "detail": "玩具为受限类目，需 CPC + 检测报告；部分 IP 玩偶需授权。",
             "severity": "medium", "source": "Amazon Seller Central", "source_url": "https://sell.amazon.com/pricing", "as_of": AS_OF},
            {"platform": "TikTok Shop（美国）", "title": "内容合规红线（2026 更新）",
             "detail": "90 天内累计违规可撤销权限；禁虚假安全宣称；须真实演示。",
             "severity": "high", "source": "TikTok Shop 卖家中心", "source_url": "https://seller-us.tiktok.com/university/essay?knowledge_id=3106489578538795", "as_of": AS_OF},
        ],
        "opportunity": "玩具市场强季节（Q4 占全年约 1/3）、复购+礼品属性强；STEM/益智与家长偏好品类溢价高。合规完备即可进入 Amazon 高信任渠道。",
        "risks": [
            "⚠️ ASTM F963 全项安全 + CPSIA 铅/邻苯 + 第三方 CPC 为强制",
            "⚠️ 婴幼儿玩具安全门槛全品类最高",
            "⚠️ IP 玩偶须授权，侵权风险高",
            "⚠️ 对华 Section 301 覆盖玩具（HTS 9503），须确认税率",
        ],
        "advice": [
            "新手：STEM/益智 Amazon 试水",
            "工厂：Amazon + 海外仓，重 CPC 合规",
            "品牌：DTC + IP 合规授权",
        ],
        "findings": [
            "玩具市场强季节（Q4 占全年约 1/3）、礼品属性强，STEM/益智溢价高。",
            "ASTM F963 + CPSIA 铅/邻苯 + 第三方 CPC 证书为强制，安全门槛全品类最高之一。",
            "IP 玩偶须授权，侵权风险高，建议走自有设计。",
            "对华 Section 301 覆盖玩具（HTS 9503），税率须逐票确认。",
            "工厂路径：STEM 试水 → Amazon+海外仓 → DTC 自有设计。",
        ],
        "tariff_alert": {
            "level": "medium",
            "title": "对华 Section 301 附加关税覆盖玩具税则（HTS 9503）",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "HTS 9503(玩具/游戏/模型) 受 Section 301 约束；2026 强迫劳动提案对部分经济体加征附加税。精确税率须用 USTR 检索或 CBP 裁定确认。",
            "date": AS_OF, "source": "USTR Section 301", "url": "https://ustr.gov/node/9608", "as_of": AS_OF,
        },
        "platform_hotcats": {
            "Amazon（美国）": ["益智STEM", "娃娃", "户外玩具", "婴幼儿"],
            "TikTok Shop（美国）": ["爆款玩具", "解压", "IP 周边", "节日礼"],
            "Walmart Marketplace": ["家庭玩具", "基础款", "学前教育"],
            "eBay": ["收藏玩具", "二手", "长尾"],
            "Etsy": ["手工玩具", "定制", "木制"],
            "Shopify（独立站 DTC）": ["品牌官网", "订阅盒", "定制"],
            "Temu / SHEIN": ["低价玩具", "合金/塑料"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中（类目审核）", "中", "FBA + CPC 合规"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（内容红线）", "爆款种草"],
            ["Walmart", "本土履约卖家", "中高", "低", "高信任家庭款"],
            ["eBay", "二手 / 收藏", "低", "中", "收藏+长尾"],
            ["Etsy", "手工/木制", "低", "低", "手工溢价"],
            ["Shopify", "品牌 DTC", "自助", "中（获客）", "订阅盒沉淀"],
            ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量谨慎"],
        ],
    },

    "sports": {
        "name": "运动户外", "name_en": "Sports & Outdoor", "icon": "⛺",
        "subtitle": "United States · 健康生活方式驱动高增长",
        "fr_terms": ["sporting good", "bicycle", "helmet", "athletic equipment", "outdoor gear"],
        "fr_strong": ["sporting", "bicycle", "helmet", "athletic", "outdoor", "fitness", "recreation", "exercise"],
        "market": {
            "size_2026": "运动用品 US$ 339 亿 (2026E)；户外装备全球 ≈ $652.8 亿",
            "cagr": "运动用品 CAGR 6% (2026-2031)",
            "note": "健身/露营/骑行热驱动；运动器材美国 ≈ $294 亿",
            "source": "Mordor / Grand View, 2026",
            "source_url": "https://www.mordorintelligence.com/industry-reports/sports-equipment-market",
            "as_of": "2026-08",
        },
        "segments": [
            {"name": "健身器材", "note": "居家健身+瑜伽，复购配件强"},
            {"name": "户外露营", "note": "帐篷/睡袋，疫情后持续热"},
            {"name": "骑行运动", "note": "自行车/头盔，CPSC 认证"},
            {"name": "球类与水上", "note": "季节性强，赛事驱动"},
        ],
        "regulators": ["CPSC", "ASTM"],
        "rules": [
            {"platform": "CPSC", "title": "自行车/头盔安全标准",
             "detail": "自行车须符合 CPSC 16 CFR Part 1512；自行车头盔须符合 Part 1203 冲击标准；违规可召回。",
             "severity": "high", "source": "CPSC", "source_url": "https://www.cpsc.gov/", "as_of": AS_OF},
            {"platform": "ASTM", "title": "运动器材安全 (ASTM F963 等)",
             "detail": "健身/游乐器材须符合相应 ASTM 安全标准（机械/稳定/锐边）；儿童运动器材并入 CPSIA。",
             "severity": "medium", "source": "ASTM International", "source_url": "https://www.astm.org/", "as_of": AS_OF},
            {"platform": "Amazon", "title": "运动类目资质",
             "detail": "健身/骑行类部分需安全认证与合规声明；建议 Brand Registry。",
             "severity": "medium", "source": "Amazon Seller Central", "source_url": "https://sell.amazon.com/pricing", "as_of": AS_OF},
            {"platform": "TikTok Shop（美国）", "title": "内容合规红线（2026 更新）",
             "detail": "90 天内累计违规可撤销权限；须真实演示、明示价格。",
             "severity": "high", "source": "TikTok Shop 卖家中心", "source_url": "https://seller-us.tiktok.com/university/essay?knowledge_id=3106489578538795", "as_of": AS_OF},
        ],
        "opportunity": "健康生活方式驱动运动户外高增长（CAGR 6%）；健身/露营/骑行持续热。DTC + 内容种草（户外场景）转化强，本土仓解决大件履约。",
        "risks": [
            "⚠️ 自行车/头盔须 CPSC 强制安全标准",
            "⚠️ 健身器材须 ASTM 稳定/锐边合规",
            "⚠️ 大件履约成本高，海外仓为必选",
            "⚠️ 对华 Section 301 覆盖运动器材（HTS 9506/8712），须确认税率",
        ],
        "advice": [
            "新手：健身配件 TikTok 试水",
            "工厂：Amazon + 海外仓，重认证",
            "品牌：DTC + 户外内容种草",
        ],
        "findings": [
            "运动户外受健康生活方式驱动高增长（CAGR ≈ 6%），健身/露营/骑行持续热。",
            "自行车/头盔须 CPSC 强制安全标准，健身器材须 ASTM 合规。",
            "大件履约成本高，海外仓为必选。",
            "对华 Section 301 覆盖运动器材（HTS 9506/8712），税率须逐票确认。",
            "工厂路径：健身配件试水 → Amazon+海外仓 → DTC 户外内容种草。",
        ],
        "tariff_alert": {
            "level": "medium",
            "title": "对华 Section 301 附加关税覆盖运动器材税则",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "HTS 9506(运动器材)/8712(自行车) 等受 Section 301 约束；2026 强迫劳动提案对部分经济体加征附加税。精确税率须用 USTR 检索或 CBP 裁定确认。",
            "date": AS_OF, "source": "USTR Section 301", "url": "https://ustr.gov/node/9608", "as_of": AS_OF,
        },
        "platform_hotcats": {
            "Amazon（美国）": ["健身器材", "露营", "骑行", "瑜伽"],
            "TikTok Shop（美国）": ["健身配件", "露营好物", "运动服", "水具"],
            "Walmart Marketplace": ["家庭健身", "基础户外", "球类"],
            "eBay": ["二手器材", "收藏", "长尾"],
            "Etsy": ["手工运动饰品", "定制"],
            "Shopify（独立站 DTC）": ["品牌官网", "订阅", "定制"],
            "Temu / SHEIN": ["低价配件", "合金/塑料"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中", "中", "FBA + 海外仓，重认证"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（内容红线）", "户外场景种草"],
            ["Walmart", "本土履约卖家", "中高", "低", "高信任基础款"],
            ["eBay", "二手 / 长尾", "低", "中", "二手+长尾"],
            ["Etsy", "设计师/手工", "低", "低", "手工溢价"],
            ["Shopify", "品牌 DTC", "自助", "中（获客）", "户外内容沉淀"],
            ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量谨慎"],
        ],
    },

    "auto": {
        "name": "汽车配件", "name_en": "Automotive Aftermarket", "icon": "🔧",
        "subtitle": "United States · 庞大保有量驱动的刚需后市场",
        "fr_terms": ["motor vehicle", "automotive part", "auto part", "emission standard", "NHTSA"],
        "fr_strong": ["motor vehicle", "automotive", "auto part", "emission", "nhtsa", "tire", "headlamp", "epa", "vehicle"],
        "market": {
            "size_2026": "US$ 2,387.5 亿 (2026E)",
            "cagr": "CAGR 4.12% (2026-2031)",
            "note": "另口径 ≈ $2,495.5 亿 (Precedence)；含替换件/养护/电子",
            "source": "Mordor / Precedence, 2026",
            "source_url": "https://www.mordorintelligence.com/industry-reports/automotive-aftermarket-market",
            "as_of": "2026-08",
        },
        "segments": [
            {"name": "替换件", "note": "滤清/刹车/电池，高频刚需"},
            {"name": "养护品", "note": "机油/添加剂，复购强"},
            {"name": "电子改装", "note": "车灯/雷达，FCC/合规严"},
            {"name": "轮胎轮毂", "note": "DOT 认证，重货履约"},
        ],
        "regulators": ["EPA", "CARB", "NHTSA", "Right-to-Repair"],
        "rules": [
            {"platform": "NHTSA / DOT", "title": "安全件与轮胎标准 (FMVSS)",
             "detail": "刹车/车灯/轮胎等安全件须符合联邦机动车安全标准 (FMVSS)；轮胎须 DOT 认证与统一轮胎质量分级 (UTQG)。",
             "severity": "high", "source": "NHTSA", "source_url": "https://www.nhtsa.gov/", "as_of": AS_OF},
            {"platform": "EPA / CARB", "title": "排放与改装合规",
             "detail": "影响排放的改装件（排气/ECU）须 EPA/CARB 豁免；加州 CARB 标准更严，违规可重罚。",
             "severity": "high", "source": "EPA / CARB", "source_url": "https://ww2.arb.ca.gov/", "as_of": AS_OF},
            {"platform": "FCC", "title": "车载电子射频认证",
             "detail": "车灯/雷达/蓝牙配件含射频须 FCC 认证；改装件须避免干扰。",
             "severity": "medium", "source": "FCC", "source_url": "https://www.fcc.gov/", "as_of": AS_OF},
            {"platform": "Amazon / eBay", "title": "汽配类目资质",
             "detail": "汽配为专业类目，需 fitment 数据（适配车型）与合规声明；eBay 汽配天然场。",
             "severity": "medium", "source": "Amazon / eBay", "source_url": "https://sell.amazon.com/pricing", "as_of": AS_OF},
        ],
        "opportunity": "美国汽车保有量全球前列，后市场为刚需高频；替换件/养护品复购强，eBay 汽配天然场。Fitment 数据+合规完备是核心壁垒。",
        "risks": [
            "⚠️ 安全件须 FMVSS，轮胎须 DOT/UTQG 认证",
            "⚠️ 排气/ECU 改装受 EPA/CARB 排放约束",
            "⚠️ 车载电子含射频须 FCC 认证",
            "⚠️ 重货履约成本高；对华 Section 301 覆盖汽配（HTS 8708），须确认税率",
        ],
        "advice": [
            "新手：eBay 汽配长尾试水",
            "工厂：Amazon + 海外仓，重 fitment 数据",
            "品牌：DTC + 车型适配工具",
        ],
        "findings": [
            "美国汽车后市场庞大刚需（2026E ≈ $2,387 亿），替换件/养护品高频复购。",
            "安全件须 FMVSS，轮胎须 DOT/UTQG，排放改装受 EPA/CARB 约束。",
            "车载电子含射频须 FCC 认证；eBay 汽配为天然场。",
            "重货履约成本高，fitment 适配数据+合规是核心壁垒。",
            "工厂路径：eBay 长尾 → Amazon+海外仓 → DTC 车型适配。",
        ],
        "tariff_alert": {
            "level": "medium",
            "title": "对华 Section 301 附加关税覆盖汽车配件税则（HTS 8708）",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "HTS 8708(机动车辆零件/附件) 广泛受 Section 301 约束；2026 强迫劳动提案对部分经济体加征附加税。精确税率须用 USTR 检索或 CBP 裁定确认。",
            "date": AS_OF, "source": "USTR Section 301", "url": "https://ustr.gov/node/9608", "as_of": AS_OF,
        },
        "platform_hotcats": {
            "Amazon（美国）": ["替换件", "养护品", "电子改装", "轮胎轮毂"],
            "TikTok Shop（美国）": ["车载好物", "清洁护理", "小配件"],
            "Walmart Marketplace": ["基础养护", "替换件"],
            "eBay": ["汽配长尾", "二手件", "收藏"],
            "Etsy": ["手工车饰", "定制"],
            "Shopify（独立站 DTC）": ["品牌官网", "车型适配", "定制"],
            "Temu / SHEIN": ["低价小配件", "合金/塑料"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中", "中", "FBA + fitment 数据，重认证"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（内容红线）", "车载好物种草"],
            ["Walmart", "本土履约卖家", "中高", "低", "高信任基础养护"],
            ["eBay", "汽配长尾", "低", "中", "天然汽配场+车型适配"],
            ["Etsy", "手工/定制", "低", "低", "手工车饰溢价"],
            ["Shopify", "品牌 DTC", "自助", "中（获客）", "车型适配工具沉淀"],
            ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量谨慎"],
        ],
    },

    "supplements": {
        "name": "保健品", "name_en": "Dietary Supplements", "icon": "💊",
        "subtitle": "United States · 高增速 + 严 FDA/cGMP 监管",
        "fr_terms": ["dietary supplement", "nutrient", "vitamin", "FDA supplement", "botanical"],
        "fr_strong": ["dietary supplement", "nutrient", "vitamin", "fda", "botanical", "amino", "probiotic", "mineral"],
        "market": {
            "size_2026": "US$ 773.7 亿 (2026E)",
            "cagr": "CAGR 7.9% (2026-2031)",
            "note": "广义营养健康（含 OTC）≈ $8,540 亿；膳食补充剂为最高增速品类之一",
            "source": "Polaris / 行业研究, 2026",
            "source_url": "https://www.polarismarketresearch.com/industry-analysis/dietary-supplements-market",
            "as_of": "2026-08",
        },
        "segments": [
            {"name": "维生素矿物质", "note": "最大基础细分，复购强"},
            {"name": "蛋白/运动营养", "note": "健身人群驱动，TikTok 热"},
            {"name": "草本植物", "note": "植物提取，NDI 合规关键"},
            {"name": "益生菌/功能", "note": "肠道/睡眠，高溢价"},
        ],
        "regulators": ["FDA (DSHEA/cGMP/NDI)", "FTC"],
        "rules": [
            {"platform": "FDA", "title": "DSHEA / cGMP / NDI 备案",
             "detail": "膳食补充剂受 DSHEA 监管，须符合 cGMP (21 CFR Part 111)；新 dietary ingredient (NDI) 须上市前 75 天备案；结构/功能宣称须有 substantiation 且不宣称治病。",
             "severity": "high", "source": "FDA", "source_url": "https://www.fda.gov/food/dietary-supplements", "as_of": AS_OF},
            {"platform": "FTC", "title": "功效宣称合规",
             "detail": "「抗衰老/治愈/减重」等健康宣称须有可靠科学证据；禁止疾病治疗宣称，网红须披露。",
             "severity": "high", "source": "FTC", "source_url": "https://www.ftc.gov/business-guidance/industry/health-care", "as_of": AS_OF},
            {"platform": "Amazon", "title": "保健品类目资质",
             "detail": "保健品为受限类目，需 cGMP/检测报告与合规声明；建议 Brand Registry。",
             "severity": "medium", "source": "Amazon Seller Central", "source_url": "https://sell.amazon.com/pricing", "as_of": AS_OF},
            {"platform": "TikTok Shop（美国）", "title": "内容合规红线（2026 更新）",
             "detail": "90 天内累计违规可撤销权限；禁医疗/疾病治疗宣称、禁减肥夸大；须真实演示。",
             "severity": "high", "source": "TikTok Shop 卖家中心", "source_url": "https://seller-us.tiktok.com/university/essay?knowledge_id=3106489578538795", "as_of": AS_OF},
        ],
        "opportunity": "保健品为高增速品类（CAGR ≈ 7.9%），维生素/蛋白/草本复购强。TikTok 内容种草驱动增量，cGMP+NDI 合规完备是壁垒也是信任。",
        "risks": [
            "⚠️ cGMP 强制 + NDI 上市前 75 天备案",
            "⚠️ 结构/功能宣称须 substantiation，禁疾病治疗宣称",
            "⚠️ FTC 严打功效/减重虚假宣传",
            "⚠️ 对华 Section 301 多不直接覆盖，但包材/设备受约束",
        ],
        "advice": [
            "新手：维生素/蛋白 TikTok 试水",
            "工厂：Amazon + 独立站，重 cGMP/NDI",
            "品牌：DTC + 科学叙事，重真实功效",
        ],
        "findings": [
            "保健品为高增速品类（CAGR ≈ 7.9%），维生素/蛋白/草本复购强。",
            "cGMP 强制 + NDI 上市前 75 天备案，结构/功能宣称须 substantiation。",
            "FTC 严打疾病治疗/减重虚假宣传；TikTok 内容红线严格。",
            "对华 Section 301 多不直接覆盖成品，但包材/设备受约束。",
            "工厂路径：TikTok 爆款 → Amazon+独立站 → DTC 科学叙事。",
        ],
        "tariff_alert": {
            "level": "low",
            "title": "保健品成品多为零关税，包材/设备受 Section 301 约束",
            "market": "美国", "platform": "USTR / CBP",
            "detail": "HTS 2106(营养制剂) 多为零基础关税，但胶囊/瓶体包材与生产设备受 Section 301 附加税约束。出口须以 USTR 检索确认具体编码税率。",
            "date": AS_OF, "source": "USTR Section 301", "url": "https://ustr.gov/node/9608", "as_of": AS_OF,
        },
        "platform_hotcats": {
            "Amazon（美国）": ["维生素", "蛋白", "草本", "益生菌"],
            "TikTok Shop（美国）": ["蛋白", " gummies", "草本", "睡眠"],
            "Walmart Marketplace": ["家庭基础", "维生素", "蛋白"],
            "eBay": ["收藏/长尾", "二手"],
            "Etsy": ["手工草本", "天然", "定制"],
            "Shopify（独立站 DTC）": ["品牌官网", "订阅制", "定制"],
            "Temu / SHEIN": ["低价软糖", "基础维生素"],
        },
        "matrix": [
            ["Amazon（美国）", "工厂 / 品牌出海", "中（类目审核）", "中", "FBA + cGMP/NDI 合规"],
            ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（功效红线）", "成分种草验证爆款"],
            ["Walmart", "本土履约卖家", "中高", "低", "高信任基础款"],
            ["eBay", "二手 / 长尾", "低", "中", "长尾+收藏"],
            ["Etsy", "手工/天然", "低", "低", "手工溢价"],
            ["Shopify", "品牌 DTC", "自助", "中（获客）", "订阅制沉淀"],
            ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量谨慎"],
        ],
    },
}

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

def fetch_fr_policies(cat_key, limit=24):
    cfg = CATEGORIES[cat_key]
    strong = cfg["fr_strong"]
    policies, alerts = [], []
    seen = set()
    for term in cfg["fr_terms"]:
        data = http_get_json(FR_API, params={
            "conditions[term]": term,
            "per_page": 15,
            "order": "newest",
            "fields[]": ["title", "abstract", "publication_date", "agencies",
                         "html_url", "document_number", "topics", "type"],
        })
        if not data or "results" not in data:
            continue
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
                    "live": True,
                })
        if len(policies) >= limit:
            break
    policies.sort(key=lambda x: x.get("date", ""), reverse=True)
    alerts.sort(key=lambda x: x.get("date", ""), reverse=True)
    return policies[:limit], alerts[:18]


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
    for p in PLATFORMS_BASE:
        pp = dict(p)
        pp["hotCats"] = hot.get(p["name"], [])
        out.append(pp)
    return out


def build_rules(cat_key):
    return CATEGORIES[cat_key]["rules"]


# ---------------------------------------------------------------------------
# 主流程（单品类）
# ---------------------------------------------------------------------------
def collect_category(cat_key, no_network=False):
    cfg = CATEGORIES[cat_key]
    print("[US-Market:%s] 构建国家板块 / 平台档案 / 规则（真实参考库）…" % cat_key)
    country = build_country(cat_key)
    platforms = build_platforms(cat_key)
    rules = build_rules(cat_key)

    policies, alerts = [], []
    if not no_network:
        print("[US-Market:%s] 实时拉取 Federal Register %s 公文…" % (cat_key, cfg["name"]))
        policies, alerts = fetch_fr_policies(cat_key)
        print("[US-Market:%s]   政策 %d 条 / 预警 %d 条（实时）" % (cat_key, len(policies), len(alerts)))

    # 关税专项预警（静态真实提示，非伪造）
    ta = dict(cfg["tariff_alert"])
    ta["live"] = False
    alerts = [ta] + alerts

    # 若实时为空（网络失败），尝试沿用旧文件中的 live 条目
    if not policies or len(alerts) <= 1:
        old = load_old(cat_key)
        if old:
            if not policies:
                policies = old.get("policies", [])
                print("[US-Market:%s]   使用本地缓存 policies (%d)" % (cat_key, len(policies)))
            if len(alerts) <= 1:
                alerts = old.get("alerts", [])
                print("[US-Market:%s]   使用本地缓存 alerts (%d)" % (cat_key, len(alerts)))

    out = {
        "meta": {
            "market": "美国%s (US %s)" % (cfg["name"], cfg["name_en"]),
            "cat_key": cat_key,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "as_of": AS_OF,
            "live_source": "Federal Register API (https://www.federalregister.gov/api/v1)",
            "sections": ["country", "platforms", "rules", "policies", "alerts"],
            "counts": {
                "country": 1, "platforms": len(platforms), "rules": len(rules),
                "policies": len(policies), "alerts": len(alerts),
            },
        },
        "country": country,
        "findings": cfg["findings"],
        "platforms": platforms,
        "matrix": cfg["matrix"],
        "rules": rules,
        "policies": policies,
        "alerts": alerts,
    }
    return out


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

    index = {"generated_at": datetime.now(timezone.utc).isoformat(), "as_of": AS_OF,
             "categories": []}
    for k in keys:
        out = collect_category(k, no_network=args.no_network)
        validate(out)
        with open(out_file(k), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        print("[US-Market] 已写入 %s" % out_file(k))
        cfg = CATEGORIES[k]
        index["categories"].append({
            "key": k, "name": cfg["name"], "name_en": cfg["name_en"],
            "icon": cfg["icon"], "file": "%s.json" % k,
            "market_size": cfg["market"]["size_2026"],
            "cagr": cfg["market"]["cagr"],
            "policy_count": out["meta"]["counts"]["policies"],
            "alert_count": out["meta"]["counts"]["alerts"],
            "report": "reports/us_market/%s_report.pdf" % k,
        })

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print("[US-Market] 已写入索引 %s（%d 品类）" % (INDEX_FILE, len(index["categories"])))


if __name__ == "__main__":
    main()
