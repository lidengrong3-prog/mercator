#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_us_jewelry_report.py — 美国珠宝全渠道市场调研报告 (PDF) 生成器

读取 data/us_jewelry.json（由 collect_us_jewelry.py 产出），
生成对标《美国珠宝全渠道市场调研报告》的综合 PDF。

板块映射（用户指定的 5 大板块 → 报告章节）：
  国家市场板块内容 -> 第一部分 宏观全景
  电商平台档案     -> 第二部分 渠道拆解
  平台规则         -> 第三部分 规则与合规
  政策动态         -> 第四部分 政策动态（实时 Federal Register）
  预警中心         -> 第五部分 预警中心
  数据来源清单     -> 第六部分（真实准确性的根基）

运行：
  python scripts/gen_us_jewelry_report.py
依赖：reportlab（pip install reportlab）
"""

import json
import os
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, HRFlowable)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data", "us_jewelry.json")
OUT_DIR = os.path.join(ROOT, "reports")
OUT = os.path.join(OUT_DIR, "us_jewelry_market_report.pdf")

# 注册中文字体（reportlab 内置 CID 字体，免外部 TTF）
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
FONT = "STSong-Light"

NAVY = colors.HexColor("#1e3a5f")
SEA = colors.HexColor("#2b7bba")
LIGHT = colors.HexColor("#eaf3fa")
GREY = colors.HexColor("#666666")
HIGH = colors.HexColor("#c0392b")
MID = colors.HexColor("#e67e22")
LOW = colors.HexColor("#27ae60")


def load():
    with open(DATA, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 样式
# ---------------------------------------------------------------------------
def styles():
    ss = getSampleStyleSheet()
    s = {}
    s["title"] = ParagraphStyle("title", parent=ss["Title"], fontName=FONT,
                                fontSize=26, textColor=NAVY, leading=32, alignment=TA_CENTER)
    s["subtitle"] = ParagraphStyle("subtitle", parent=ss["Normal"], fontName=FONT,
                                   fontSize=13, textColor=SEA, alignment=TA_CENTER, spaceAfter=6)
    s["h1"] = ParagraphStyle("h1", parent=ss["Heading1"], fontName=FONT, fontSize=17,
                             textColor=NAVY, spaceBefore=14, spaceAfter=8)
    s["h2"] = ParagraphStyle("h2", parent=ss["Heading2"], fontName=FONT, fontSize=13,
                             textColor=SEA, spaceBefore=10, spaceAfter=5)
    s["body"] = ParagraphStyle("body", parent=ss["Normal"], fontName=FONT, fontSize=10.5,
                               leading=16, spaceAfter=5)
    s["small"] = ParagraphStyle("small", parent=ss["Normal"], fontName=FONT, fontSize=8.5,
                                leading=12, textColor=GREY)
    s["cell"] = ParagraphStyle("cell", parent=ss["Normal"], fontName=FONT, fontSize=9, leading=13)
    s["cellb"] = ParagraphStyle("cellb", parent=ss["Normal"], fontName=FONT, fontSize=9,
                                leading=13, textColor=colors.white)
    s["th"] = ParagraphStyle("th", parent=ss["Normal"], fontName=FONT, fontSize=9.5,
                             leading=13, textColor=colors.white)
    return s


def P(text, st):
    return Paragraph(str(text).replace("\n", "<br/>"), st)


def header_row(cells, st):
    return [Paragraph(c, st["th"]) for c in cells]


def std_table(data, col_widths, st, header_bg=NAVY):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bcd2e0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def build(d, st):
    flow = []

    # ---------- 封面 ----------
    flow.append(Spacer(1, 40 * mm))
    flow.append(P("美国珠宝全渠道市场调研报告", st["title"]))
    flow.append(Spacer(1, 6 * mm))
    flow.append(P("US Jewelry Omni-channel Market Intelligence Report", st["subtitle"]))
    flow.append(Spacer(1, 4 * mm))
    meta = d.get("meta", {})
    flow.append(P("数据自动更新版 · 单点市场深度情报", st["subtitle"]))
    flow.append(Spacer(1, 10 * mm))
    flow.append(HRFlowable(width="60%", color=SEA, thickness=1.2))
    flow.append(Spacer(1, 6 * mm))
    gen = meta.get("generated_at", "")[:19].replace("T", " ")
    asof = meta.get("as_of", "")
    cnt = meta.get("counts", {})
    info = [
        ["生成时间", gen],
        ["数据截止 (as_of)", asof],
        ["实时数据源", "Federal Register API（每 4 小时自动更新）"],
        ["覆盖板块", "国家宏观 / 平台档案 / 平台规则 / 政策动态 / 预警中心"],
        ["数据条数", "平台 %d · 规则 %d · 政策 %d · 预警 %d" % (
            cnt.get("platforms", 0), cnt.get("rules", 0),
            cnt.get("policies", 0), cnt.get("alerts", 0))],
    ]
    t = Table([[P(k, st["cell"]), P(v, st["cell"])] for k, v in info],
              colWidths=[40 * mm, 110 * mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), FONT), ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bcd2e0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    flow.append(t)
    flow.append(Spacer(1, 10 * mm))
    flow.append(P("说明：政策动态与预警中心由 Federal Register 官方 API 实时抓取，"
                  "每 4 小时自动刷新；市场规模、平台费率、合规规则为权威公开源引用的真实参考值"
                  "（Statista / USTR / Amazon Seller Central / FTC / CBP），均标注来源与截止日期。", st["small"]))
    flow.append(PageBreak())

    # ---------- 执行摘要 ----------
    flow.append(P("执行摘要", st["h1"]))
    c = d.get("country", {})
    flow.append(P("美国为全球第三大珠宝消费市场，成熟度高、客单价高，品牌化与差异化（培育钻石、"
                  "设计师款、DTC）是核心路径；TikTok Shop 等内容电商成为年轻客群新增量渠道。"
                  "对华 Section 301 附加关税覆盖珠宝核心税则（7113/7116/7117），是出海最大政策变量。", st["body"]))
    flow.append(P("本报告围绕用户指定的 5 大板块——国家市场板块内容、电商平台档案、平台规则、"
                  "政策动态、预警中心——进行单点（美国·珠宝）全量情报采集，数据真实、来源可溯、"
                  "且纳入 4 小时自动更新流水线。", st["body"]))
    flow.append(Spacer(1, 3 * mm))

    # 核心发现（高亮框）
    flow.append(P("核心发现（Key Findings）", st["h2"]))
    findings = [
        "美国是全球第三大珠宝消费市场，客单高、履约成熟；品牌化与差异化（培育钻 / 设计师款 / DTC）是核心路径。",
        "对华 Section 301 附加关税覆盖珠宝核心税则 7113 / 7116 / 7117，是出海最大政策变量，须逐票确认精确税率。",
        "TikTok Shop 内容电商成为年轻客群（银饰 / 时尚款）新增量渠道，但内容合规红线严格（90 天累计违规可撤销权限）。",
        "FTC Jewelry Guides 严管贵金属标示与培育钻披露，加州 Prop 65 管铅镉限量，违规可罚款或下架。",
        "工厂出海推荐路径：TikTok Shop 试水验证爆款 → Amazon FBA + 独立站双轨 → 品牌 DTC 沉淀资产。",
    ]
    box = Table([[P("• " + f, st["cell"])] for f in findings], colWidths=[170 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.6, SEA),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("FONTNAME", (0, 0), (-1, -1), FONT),
    ]))
    flow.append(box)
    flow.append(Spacer(1, 3 * mm))

    # ---------- 第一部分 宏观全景 ----------
    flow.append(P("第一部分　美国珠宝行业宏观全景", st["h1"]))
    flow.append(P("1.1 市场规模与增长趋势", st["h2"]))
    macro = c.get("macro", [])
    rows = [header_row(["指标", "数值", "趋势/说明", "来源"], st)]
    for row in macro:
        rows.append([P(row[0], st["cell"]), P(row[1], st["cell"]),
                     P(row[2], st["cell"]), P(row[3], st["cell"])])
    flow.append(std_table(rows, [38 * mm, 32 * mm, 50 * mm, 40 * mm], st))
    flow.append(Spacer(1, 3 * mm))

    flow.append(P("1.2 消费人群与产品赛道", st["h2"]))
    for sgm in c.get("segments", []):
        flow.append(P("• <b>%s</b>：%s" % (sgm.get("name", ""), sgm.get("note", "")), st["body"]))
    flow.append(Spacer(1, 2 * mm))
    flow.append(P("1.3 机会与进入建议", st["h2"]))
    flow.append(P("<b>核心机会：</b>" + c.get("opportunity", ""), st["body"]))
    flow.append(P("<b>分层建议：</b>", st["body"]))
    for a in c.get("advice", []):
        flow.append(P("• " + a, st["body"]))
    flow.append(P("1.4 关键风险", st["h2"]))
    for r in c.get("risks", []):
        flow.append(P("• " + r, st["body"]))
    flow.append(PageBreak())

    # ---------- 第二部分 渠道拆解 ----------
    flow.append(P("第二部分　电商渠道深度拆解与横向对比", st["h1"]))
    flow.append(P("2.1 各平台档案", st["h2"]))
    for p in d.get("platforms", []):
        flow.append(P("<b>%s</b>　<span color='#2b7bba'>[%s · %s]</span>" % (
            p.get("name", ""), p.get("type", ""), p.get("market", "")), st["body"]))
        flow.append(P("佣金/费用：%s" % p.get("commission", ""), st["cell"]))
        flow.append(P("费用说明：%s" % p.get("feeDesc", ""), st["cell"]))
        flow.append(P("入驻：%s ｜ 热销：%s" % (p.get("entry", ""), "、".join(p.get("hotCats", []))), st["cell"]))
        flow.append(P("优势：%s ｜ 风险：%s" % (p.get("strength", ""), p.get("risk", "")), st["cell"]))
        flow.append(P("来源：%s（%s，as_of %s）" % (p.get("source", ""), p.get("source_url", ""), p.get("as_of", "")), st["small"]))
        flow.append(Spacer(1, 2 * mm))
    flow.append(P("2.2 五大渠道横向对比总表", st["h2"]))
    rows = [header_row(["平台", "类型", "佣金/费用要点", "入驻难度", "适合品类"], st)]
    for p in d.get("platforms", []):
        rows.append([P(p.get("name", ""), st["cell"]), P(p.get("type", ""), st["cell"]),
                     P(p.get("commission", ""), st["cell"]), P(p.get("entry", ""), st["cell"]),
                     P("、".join(p.get("hotCats", [])[:3]), st["cell"])])
    flow.append(std_table(rows, [32 * mm, 16 * mm, 52 * mm, 30 * mm, 30 * mm], st))
    flow.append(Spacer(1, 3 * mm))

    flow.append(P("2.3 工厂出海平台适配矩阵", st["h2"]))
    flow.append(P("针对产业带工厂老板视角，按「最适合的卖家类型 / 入驻难度 / 风险等级 / 行动建议」横向对比：", st["body"]))
    matrix = [
        ["Amazon（美国）", "工厂 / 品牌出海", "中（类目审核）", "中", "FBA + Brand Registry，重合规与Listing"],
        ["TikTok Shop（美国）", "工厂爆款试水", "中（本地主体）", "高（内容红线）", "内容种草验证爆款，控退货率"],
        ["Walmart", "本土履约卖家", "中高", "低", "WFS 降低履约成本，高信任"],
        ["eBay", "二手 / 古董珠宝", "低", "中", "长尾 + 收藏款流量"],
        ["Etsy", "手作 / 设计师", "低", "低", "手工溢价，客群精准"],
        ["Shopify", "品牌 DTC", "自助", "中（获客）", "沉淀品牌资产与复购"],
        ["Temu / SHEIN", "低价供货商", "低（全托管）", "高（利润薄）", "走量需谨慎，防品牌稀释"],
    ]
    mrows = [header_row(["平台", "最适合", "入驻难度", "风险", "行动建议"], st)]
    for r in matrix:
        mrows.append([P(r[0], st["cell"]), P(r[1], st["cell"]), P(r[2], st["cell"]),
                      P(r[3], st["cell"]), P(r[4], st["cell"])])
    flow.append(std_table(mrows, [34 * mm, 28 * mm, 28 * mm, 22 * mm, 58 * mm], st))
    flow.append(PageBreak())

    # ---------- 第三部分 规则与合规 ----------
    flow.append(P("第三部分　平台规则与合规要求", st["h1"]))
    flow.append(P("以下为各平台与美方监管机构对珠宝品类的真实合规红线，违规可致下架、罚款或撤销资质。", st["body"]))
    rows = [header_row(["适用方", "规则/法规", "要点", "等级", "来源"], st)]
    for r in d.get("rules", []):
        sev = r.get("severity", "low")
        col = {"high": HIGH, "medium": MID, "low": LOW}.get(sev, GREY)
        rows.append([P(r.get("platform", ""), st["cell"]), P(r.get("title", ""), st["cell"]),
                     P(r.get("detail", ""), st["cell"]),
                     P("<font color='%s'><b>%s</b></font>" % (col.hexval(), sev.upper()), st["cell"]),
                     P(r.get("source", ""), st["cell"])])
    flow.append(std_table(rows, [26 * mm, 34 * mm, 56 * mm, 16 * mm, 28 * mm], st))
    flow.append(PageBreak())

    # ---------- 第四部分 政策动态 ----------
    flow.append(P("第四部分　政策动态（实时 · Federal Register）", st["h1"]))
    flow.append(P("本节由 Federal Register 官方 API 实时抓取，每次运行刷新；标记为 live 的条目为"
                  "自动采集，其余为权威来源引用的当下政策。", st["body"]))
    rows = [header_row(["日期", "政策/公文", "机构", "摘要", "来源"], st)]
    for p in d.get("policies", []):
        tag = " 🔴实时" if p.get("live") else ""
        rows.append([P(p.get("date", ""), st["cell"]),
                     P(p.get("title", "") + tag, st["cell"]),
                     P(p.get("agency", ""), st["cell"]),
                     P(p.get("summary", ""), st["cell"]),
                     P(p.get("source", ""), st["cell"])])
    flow.append(std_table(rows, [20 * mm, 40 * mm, 24 * mm, 56 * mm, 20 * mm], st))
    flow.append(PageBreak())

    # ---------- 第五部分 预警中心 ----------
    flow.append(P("第五部分　预警中心", st["h1"]))
    rows = [header_row(["等级", "预警", "市场/方", "详情", "日期"], st)]
    for a in d.get("alerts", []):
        sev = a.get("level", "low")
        col = {"high": HIGH, "medium": MID, "low": LOW}.get(sev, GREY)
        rows.append([P("<font color='%s'><b>%s</b></font>" % (col.hexval(), sev.upper()), st["cell"]),
                     P(a.get("title", ""), st["cell"]),
                     P(a.get("market", "") + "/" + a.get("platform", ""), st["cell"]),
                     P(a.get("detail", ""), st["cell"]),
                     P(a.get("date", ""), st["cell"])])
    flow.append(std_table(rows, [16 * mm, 40 * mm, 24 * mm, 60 * mm, 20 * mm], st))
    flow.append(PageBreak())

    # ---------- 第六部分 数据来源清单 ----------
    flow.append(P("第六部分　数据来源清单（真实性溯源）", st["h1"]))
    flow.append(P("报告所有数据均来自以下权威公开源。政策/预警为实时 API 抓取；市场/平台/规则为"
                  "引用参考值，标注来源链接与截止日期，可随时复核。", st["body"]))
    srcs = set()
    for sec in ["country", "platforms", "rules", "policies", "alerts"]:
        for it in (d.get(sec) if isinstance(d.get(sec), list) else [d.get(sec)]):
            if isinstance(it, dict) and it.get("source"):
                srcs.add((it.get("source", ""), it.get("source_url", ""), it.get("as_of", "")))
    rows = [header_row(["来源", "链接", "截止"], st)]
    for s, u, a in sorted(srcs):
        rows.append([P(s, st["cell"]), P(u or "—", st["cell"]), P(a or "—", st["cell"])])
    flow.append(std_table(rows, [55 * mm, 75 * mm, 30 * mm], st))
    flow.append(Spacer(1, 4 * mm))
    flow.append(P("实时 API：%s" % meta.get("live_source", ""), st["small"]))
    flow.append(P("生成工具：JAY观海 跨境市场情报系统 · scripts/collect_us_jewelry.py + gen_us_jewelry_report.py", st["small"]))

    return flow


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.setFillColor(GREY)
    canvas.drawString(20 * mm, 12 * mm, "美国珠宝全渠道市场调研报告 · 数据自动更新版")
    canvas.drawRightString(190 * mm, 12 * mm, "第 %d 页" % doc.page)
    canvas.restoreState()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    d = load()
    st = styles()
    doc = SimpleDocTemplate(OUT, pagesize=A4,
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            title="美国珠宝全渠道市场调研报告", author="JAY观海")
    doc.build(build(d, st), onFirstPage=footer, onLaterPages=footer)
    size = os.path.getsize(OUT)
    print("[report] 已生成 %s (%d KB)" % (OUT, size // 1024))


if __name__ == "__main__":
    main()
