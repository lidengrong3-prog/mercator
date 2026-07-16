#!/usr/bin/env python3
"""
Rebuild countries page: full macro economic + e-commerce market intelligence
"""
import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ============================================================
# 1. ADD NEW CSS BEFORE </style>
# ============================================================
new_css = """
/* === Countries Page v2 - Full Rebuild === */
.cn2-top-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px;padding:16px 20px;background:var(--card);border:1px solid var(--border);border-radius:12px}
.cn2-search-wrap{position:relative;flex:0 0 260px}
.cn2-search-wrap input{width:100%;padding:9px 14px 9px 36px;border:1px solid var(--border);border-radius:8px;background:var(--paper);font-size:13px;color:var(--ink)}
.cn2-search-wrap::before{content:'🔍';position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px}
.cn2-search-dd{position:absolute;top:100%;left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:0 0 8px 8px;max-height:280px;overflow-y:auto;z-index:200;display:none;box-shadow:0 6px 16px rgba(0,0,0,.08)}
.cn2-search-dd.open{display:block}
.cn2-search-dd .cn2-dd-item{padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)}
.cn2-search-dd .cn2-dd-item:hover{background:var(--paper)}
.cn2-quick-tags{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.cn2-quick-tags .cn2-qtag{padding:5px 12px;border:1px solid var(--border);border-radius:16px;font-size:11px;cursor:pointer;background:transparent;color:var(--ink);transition:all .2s;white-space:nowrap}
.cn2-quick-tags .cn2-qtag:hover,.cn2-quick-tags .cn2-qtag.active{background:var(--green);color:#fff;border-color:var(--green)}
.cn2-ai-oneliner{flex:1 1 100%;padding:12px 16px;background:linear-gradient(135deg,rgba(60,108,98,.06),rgba(223,111,61,.04));border-radius:8px;font-size:13px;color:var(--ink);line-height:1.6;display:flex;align-items:flex-start;gap:10px}
.cn2-ai-oneliner .cn2-ai-icon{font-size:18px;flex-shrink:0;margin-top:2px}
.cn2-ai-oneliner .cn2-ai-text{flex:1}
.cn2-ai-oneliner .cn2-ai-btn{padding:4px 12px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0;align-self:center}
.cn2-actions{display:flex;gap:8px;flex-shrink:0}
.cn2-actions button{padding:7px 14px;border:1px solid var(--border);border-radius:6px;background:transparent;font-size:12px;cursor:pointer;color:var(--ink)}
.cn2-actions button:hover{background:var(--green);color:#fff;border-color:var(--green)}
.cn2-time-filter{display:flex;gap:6px;align-items:center;margin-bottom:14px;padding:10px 16px;background:var(--card);border:1px solid var(--border);border-radius:8px}
.cn2-time-filter label{font-size:11px;color:var(--muted);margin-right:4px}
.cn2-time-filter .cn2-tf-btn{padding:4px 12px;border:1px solid var(--border);border-radius:14px;font-size:11px;cursor:pointer;background:transparent;color:var(--ink)}
.cn2-time-filter .cn2-tf-btn.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.cn2-module{margin-bottom:22px}
.cn2-module-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--border)}
.cn2-module-head h3{font-size:15px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:8px}
.cn2-module-head .cn2-m-badge{font-size:10px;padding:2px 8px;border-radius:10px;background:var(--green);color:#fff}
.cn2-module-head .cn2-m-actions{display:flex;gap:6px}
.cn2-module-head .cn2-m-actions button{padding:4px 10px;border:1px solid var(--border);border-radius:4px;background:transparent;font-size:11px;cursor:pointer;color:var(--muted)}
.cn2-module-head .cn2-m-actions button:hover{color:var(--green);border-color:var(--green)}
.cn2-macro-tabs{display:flex;gap:6px;margin-bottom:14px}
.cn2-macro-tabs .cn2-mt-btn{padding:6px 16px;border:1px solid var(--border);border-radius:6px;font-size:12px;cursor:pointer;background:transparent;color:var(--ink);transition:all .2s}
.cn2-macro-tabs .cn2-mt-btn.active{background:var(--green);color:#fff;border-color:var(--green)}
.cn2-macro-panel{display:none}
.cn2-macro-panel.active{display:block}
.cn2-metric-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.cn2-metric-card{padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;position:relative}
.cn2-metric-card .mc-icon{font-size:20px;margin-bottom:6px}
.cn2-metric-card .mc-label{font-size:11px;color:var(--muted);margin-bottom:4px}
.cn2-metric-card .mc-value{font-size:18px;font-weight:700;color:var(--ink);margin-bottom:2px}
.cn2-metric-card .mc-trend{font-size:11px;font-weight:600}
.cn2-metric-card .mc-trend.up{color:var(--green)}
.cn2-metric-card .mc-trend.down{color:#c0392b}
.cn2-metric-card .mc-trend.stable{color:var(--muted)}
.cn2-metric-card .mc-note{font-size:10px;color:var(--muted);margin-top:4px}
.cn2-metric-card .mc-spark{position:absolute;right:10px;top:10px;opacity:.15}
.cn2-policy-list{display:flex;flex-direction:column;gap:10px}
.cn2-policy-card{padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;border-left:3px solid var(--green)}
.cn2-policy-card.high{border-left-color:#c0392b}
.cn2-policy-card.mid{border-left-color:#c8a84e}
.cn2-policy-card.low{border-left-color:var(--green)}
.cn2-policy-card .pc-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.cn2-policy-card .pc-level{font-size:10px;padding:2px 6px;border-radius:3px;color:#fff}
.cn2-policy-card .pc-level.high{background:#c0392b}
.cn2-policy-card .pc-level.mid{background:#c8a84e}
.cn2-policy-card .pc-level.low{background:var(--green)}
.cn2-policy-card .pc-title{font-size:13px;font-weight:600;color:var(--ink);flex:1}
.cn2-policy-card .pc-meta{font-size:11px;color:var(--muted);margin-bottom:6px}
.cn2-policy-card .pc-desc{font-size:12px;color:#555;line-height:1.5}
.cn2-policy-card .pc-actions{display:flex;gap:6px;margin-top:8px}
.cn2-policy-card .pc-actions button{padding:3px 8px;border:1px solid var(--border);border-radius:3px;background:transparent;font-size:10px;cursor:pointer}
.cn2-plat-compare{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.cn2-plat-card-v2{padding:16px;background:var(--card);border:1px solid var(--border);border-radius:10px;transition:all .2s}
.cn2-plat-card-v2:hover{border-color:var(--green);box-shadow:0 2px 8px rgba(60,108,98,.1)}
.cn2-plat-card-v2 .pv-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.cn2-plat-card-v2 .pv-emoji{font-size:22px}
.cn2-plat-card-v2 .pv-name{font-size:14px;font-weight:700;color:var(--ink);flex:1}
.cn2-plat-card-v2 .pv-share{font-size:12px;font-weight:700;color:var(--green)}
.cn2-plat-card-v2 .pv-metrics{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
.cn2-plat-card-v2 .pv-m-item{padding:6px;background:var(--paper);border-radius:6px;text-align:center}
.cn2-plat-card-v2 .pv-m-label{font-size:9px;color:var(--muted)}
.cn2-plat-card-v2 .pv-m-value{font-size:12px;font-weight:600;color:var(--ink)}
.cn2-plat-card-v2 .pv-tags{display:flex;gap:4px;flex-wrap:wrap}
.cn2-plat-card-v2 .pv-tag{font-size:10px;padding:2px 6px;border-radius:3px;background:var(--paper);color:var(--muted)}
.cn2-ecom-compare{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.cn2-ecom-box{padding:16px;background:var(--card);border:1px solid var(--border);border-radius:10px}
.cn2-ecom-box h4{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.cn2-ecom-box .eb-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px}
.cn2-ecom-box .eb-row:last-child{border:none}
.cn2-ecom-box .eb-label{color:var(--muted)}
.cn2-ecom-box .eb-value{font-weight:600;color:var(--ink)}
.cn2-cat-top10{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.cn2-cat-item-v2{padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center;cursor:pointer;transition:all .2s}
.cn2-cat-item-v2:hover{border-color:var(--green);transform:translateY(-2px)}
.cn2-cat-item-v2 .ci-name{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:4px}
.cn2-cat-item-v2 .ci-growth{font-size:14px;font-weight:700;color:var(--green)}
.cn2-cat-item-v2 .ci-note{font-size:10px;color:var(--muted)}
.cn2-link-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.cn2-link-card{padding:16px;background:var(--card);border:1px solid var(--border);border-radius:10px;cursor:pointer;text-align:center;transition:all .2s}
.cn2-link-card:hover{border-color:var(--green);transform:translateY(-2px);box-shadow:0 4px 12px rgba(60,108,98,.08)}
.cn2-link-card .lc-icon{font-size:28px;margin-bottom:8px}
.cn2-link-card .lc-title{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px}
.cn2-link-card .lc-desc{font-size:11px;color:var(--muted)}
.cn2-link-card .lc-count{font-size:18px;font-weight:700;color:var(--green);margin-top:6px}
.cn2-layout{display:grid;grid-template-columns:1fr 320px;gap:18px}
.cn2-main{min-width:0}
.cn2-aside{position:sticky;top:80px;max-height:calc(100vh - 100px);overflow-y:auto}
.cn2-aside::-webkit-scrollbar{width:3px}
.cn2-aside::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
@media(max-width:1000px){.cn2-layout{grid-template-columns:1fr}.cn2-aside{position:static;max-height:none}.cn2-link-cards{grid-template-columns:1fr 1fr}.cn2-ecom-compare{grid-template-columns:1fr}}
@media(max-width:700px){.cn2-top-bar{flex-direction:column}.cn2-search-wrap{flex:1 1 100%;width:100%}.cn2-metric-grid{grid-template-columns:1fr 1fr}.cn2-plat-compare{grid-template-columns:1fr}.cn2-link-cards{grid-template-columns:1fr}}
"""

# Insert CSS before </style>
style_end = html.rfind('</style>')
if style_end == -1:
    raise ValueError("Cannot find </style>")
html = html[:style_end] + new_css + '\n' + html[style_end:]

# ============================================================
# 2. REPLACE COUNTRIES SECTION HTML
# ============================================================
old_section_start = html.find('<section id="countries" class="page">')
old_section_end = html.find('<section id="shops" class="page">')
if old_section_start == -1 or old_section_end == -1:
    raise ValueError("Cannot find countries section boundaries")

new_section = """<section id="countries" class="page">
<!-- Top Bar: Search + Quick Tags + AI Summary -->
<div class="cn2-top-bar">
  <div class="cn2-search-wrap">
    <input id="cn2-search" placeholder="搜索国家/地区..." autocomplete="off">
    <div class="cn2-search-dd" id="cn2-search-dd"></div>
  </div>
  <div class="cn2-quick-tags" id="cn2-quick-tags"></div>
  <div class="cn2-actions">
    <button onclick="cn2AddMaterial()">📎 加入素材</button>
    <button onclick="cn2ExportPDF()">📄 导出PDF</button>
    <button onclick="cn2ExportExcel()">📊 导出Excel</button>
  </div>
  <div class="cn2-ai-oneliner" id="cn2-ai-oneliner"></div>
</div>

<!-- Time Filter -->
<div class="cn2-time-filter">
  <label>📅 数据周期</label>
  <button class="cn2-tf-btn" data-tf="3m">近3个月</button>
  <button class="cn2-tf-btn active" data-tf="6m">近半年</button>
  <button class="cn2-tf-btn" data-tf="1y">全年</button>
  <span style="flex:1"></span>
  <span style="font-size:10px;color:var(--muted)" id="cn2-update-time"></span>
</div>

<!-- Main Layout -->
<div class="cn2-layout">
  <div class="cn2-main" id="cn2-main"></div>
  <aside class="cn2-aside" id="cn2-aside"></aside>
</div>
</section>

"""

html = html[:old_section_start] + new_section + html[old_section_end:]

# ============================================================
# 3. REPLACE renderCountry FUNCTION
# ============================================================
# Find the old function block: from "function renderCountry(key){" to the search dropdown listener
old_fn_start = html.find('function renderCountry(key){')
# Find the end - look for the search dropdown listener end
old_fn_end = html.find("// === 新增页面：渲染函数 ===")
if old_fn_start == -1 or old_fn_end == -1:
    raise ValueError("Cannot find renderCountry function boundaries, fn_start={}, fn_end={}".format(old_fn_start, old_fn_end))

new_fn = r"""
// === Countries Page v2 - Full Rebuild ===
var cn2CurrentKey = 'id';
var cn2MacroTab = 0; // 0=GDP, 1=population, 2=trade, 3=policy
var cn2TimeFilter = '6m';

// Enhanced country data extensions
var cn2CountryExt = {
  id: {
    gdp_total: 'US$ 1.32万亿', gdp_growth: '+5.1%', per_capita_gdp: 'US$ 4,580', cpi: '+2.8%',
    currency: '16,260 IDR/USD', currency_trend: 'stable', disposable_income: 'US$ 4,580',
    population: '2.78亿', ecommerce_users: '1.72亿', online_penetration: '62%',
    trade_volume: 'US$ 5,810亿', trade_growth: '+8.2%', cross_border_growth: '+22%',
    top_imports: '机械电子/化工/消费品', tariff_trend: '下调中', warehouse_scale: '320万㎡',
    ai_summary: '印尼2026美妆增速32%，TikTok Shop流量成本持续走低，进口关税下调5%，RCEP加持下跨境贸易便利度大幅提升。核心打法：跨境店+TikTok内容营销+Shopee货架双轨并行，目标15-35岁穆斯林女性群体。',
    top_shops_count: 34, hot_products_count: 156, trending_content_count: 89,
    content_vs_shelf: {content_conv: '8.2%', shelf_conv: '3.5%', live_avg_view: '12,500', short_video_avg_play: '285K', creator_avg_cost: '$180', search_traffic_share: '38%'},
    top_categories_growth: [['美妆个护','+42.8%'],['穆斯林时尚','+28%'],['平价消费电子','+35%'],['母婴用品','+22%'],['食品饮料','+18%'],['家居日用','+15%'],['小家电','+20%'],['宠物用品','+25%'],['健康保健','+16%'],['运动户外','+12%']],
    policy_news: [
      {level:'high',title:'进口商品印尼语标签强制要求',date:'2025-01生效',scope:'全品类',desc:'所有进口商品必须有印尼语标签，否则海关扣押'},
      {level:'high',title:'化妆品BPOM认证强制监管',date:'持续执行',scope:'美妆个护',desc:'认证周期3-6个月，未认证产品下架风险极高'},
      {level:'mid',title:'电商最低价格监管政策',date:'2024-12更新',scope:'全品类',desc:'低于成本价销售将被处罚'},
      {level:'low',title:'跨境电商税收新规讨论中',date:'2025-Q2',scope:'跨境商品',desc:'可能取消低价商品免税额度'}
    ]
  },
  us: {
    gdp_total: 'US$ 28.78万亿', gdp_growth: '+2.4%', per_capita_gdp: 'US$ 52,800', cpi: '+3.2%',
    currency: '1.00 USD', currency_trend: 'stable', disposable_income: 'US$ 52,800',
    population: '3.41亿', ecommerce_users: '2.91亿', online_penetration: '85%',
    trade_volume: 'US$ 5.4万亿', trade_growth: '+3.1%', cross_border_growth: '+12%',
    top_imports: '消费电子/机械/医药', tariff_trend: '对华加征', warehouse_scale: '1200万㎡',
    ai_summary: '美国2026远程办公品类持续增长18%，天然有机健康品需求强劲+22%，DTC品牌独立站机会大。注意对华关税145%全品类承压，建议走Temu/TikTok Shop跨境或Amazon FBA品牌化路线，核心25-45岁高消费力人群。',
    top_shops_count: 28, hot_products_count: 134, trending_content_count: 67,
    content_vs_shelf: {content_conv: '5.8%', shelf_conv: '4.2%', live_avg_view: '8,200', short_video_avg_play: '520K', creator_avg_cost: '$450', search_traffic_share: '52%'},
    top_categories_growth: [['家居生活','+18%'],['健康个护','+22%'],['宠物用品','+25%'],['户外装备','+15%'],['消费电子','+12%'],['美妆护肤','+20%'],['运动健身','+16%'],['母婴精品','+14%'],['办公用品','+10%'],['汽车配件','+11%']],
    policy_news: [
      {level:'high',title:'对华关税145%全品类',date:'持续执行',scope:'全品类',desc:'所有中国原产商品加征145%关税，成本大幅上升'},
      {level:'high',title:'消费品安全合规(CPSC)',date:'持续执行',scope:'玩具/电子',desc:'需CPC认证+第三方检测'},
      {level:'mid',title:'各州销售税规则',date:'持续更新',scope:'全品类',desc:'各州税率不同，平台代扣为主'},
      {level:'low',title:'产品责任保险建议',date:'建议',scope:'全品类',desc:'美国诉讼风险高，建议购买保险'}
    ]
  },
  jp: {
    gdp_total: 'US$ 4.23万亿', gdp_growth: '+1.2%', per_capita_gdp: 'US$ 33,800', cpi: '+2.8%',
    currency: '157 JPY/USD', currency_trend: 'down', disposable_income: 'US$ 33,800',
    population: '1.23亿', ecommerce_users: '1.05亿', online_penetration: '85%',
    trade_volume: 'US$ 1.58万亿', trade_growth: '+2.5%', cross_border_growth: '+8%',
    top_imports: '能源/食品/电子', tariff_trend: '稳定', warehouse_scale: '580万㎡',
    ai_summary: '日本市场高度成熟，老龄化社会保健品需求+18%，精致包装小规格产品受欢迎。PSE认证+药机法门槛高但利润空间大，精品路线+极致用户体验是关键。Amazon日本+乐天双平台布局。',
    top_shops_count: 22, hot_products_count: 98, trending_content_count: 45,
    content_vs_shelf: {content_conv: '4.5%', shelf_conv: '5.1%', live_avg_view: '6,800', short_video_avg_play: '380K', creator_avg_cost: '$380', search_traffic_share: '48%'},
    top_categories_growth: [['美妆护肤','+12%'],['健康食品','+18%'],['宠物用品','+15%'],['智能家居','+20%'],['家居收纳','+10%'],['服装配饰','+8%'],['文具','+6%'],['母婴精品','+14%'],['户外','+11%'],['二手奢侈品','+22%']],
    policy_news: [
      {level:'high',title:'PSE/PSC电气安全认证',date:'持续执行',scope:'电子产品',desc:'无认证产品禁止销售，处罚严厉'},
      {level:'high',title:'药机法化妆品宣传限制',date:'持续执行',scope:'美妆',desc:'不得夸大功效，需日文全成分标注'},
      {level:'mid',title:'食品进口检验检疫',date:'持续执行',scope:'食品',desc:'检查项目多，周期1-2周'},
      {level:'low',title:'包装品质标准',date:'行业惯例',scope:'全品类',desc:'日本消费者包装要求极高'}
    ]
  },
  br: {
    gdp_total: 'US$ 2.17万亿', gdp_growth: '+3.0%', per_capita_gdp: 'US$ 8,920', cpi: '+4.2%',
    currency: '5.07 BRL/USD', currency_trend: 'volatile', disposable_income: 'US$ 8,920',
    population: '2.16亿', ecommerce_users: '1.46亿', online_penetration: '68%',
    trade_volume: 'US$ 5,890亿', trade_growth: '+5.8%', cross_border_growth: '+28%',
    top_imports: '电子/化工/机械', tariff_trend: 'Remessa Conforme新规', warehouse_scale: '180万㎡',
    ai_summary: '拉美最大电商市场，社交电商+分期付款是核心打法。个护电器+35%需求旺盛，巴西风格色彩鲜艳产品热销。Remessa Conforme新规50$以下征20%税，建议走Mercado Livre本土店+海外仓模式。',
    top_shops_count: 18, hot_products_count: 76, trending_content_count: 52,
    content_vs_shelf: {content_conv: '9.5%', shelf_conv: '3.8%', live_avg_view: '15,200', short_video_avg_play: '420K', creator_avg_cost: '$120', search_traffic_share: '32%'},
    top_categories_growth: [['个护电器','+35%'],['时尚配饰','+28%'],['3C配件','+22%'],['运动户外','+20%'],['美妆护肤','+30%'],['家居日用','+16%'],['食品饮料','+14%'],['宠物用品','+18%'],['母婴','+15%'],['汽车配件','+12%']],
    policy_news: [
      {level:'high',title:'Remessa Conforme税务新规',date:'2024-08',scope:'全品类',desc:'50美元以下征20%进口税'},
      {level:'high',title:'ANVISA药品保健品审批',date:'持续执行',scope:'药品保健品',desc:'审批周期长，未批准禁售'},
      {level:'mid',title:'清关流程复杂',date:'持续',scope:'全品类',desc:'清关时效7-30天'},
      {level:'low',title:'消费者权益保护(CDC)',date:'持续',scope:'全品类',desc:'15天无理由退货'}
    ]
  },
  sa: {
    gdp_total: 'US$ 1.11万亿', gdp_growth: '+3.8%', per_capita_gdp: 'US$ 32,500', cpi: '+2.1%',
    currency: '3.75 SAR/USD', currency_trend: 'fixed', disposable_income: 'US$ 32,500',
    population: '3,640万', ecommerce_users: '2,810万', online_penetration: '77%',
    trade_volume: 'US$ 4,580亿', trade_growth: '+6.5%', cross_border_growth: '+32%',
    top_imports: '机械/食品/消费品', tariff_trend: 'VAT 15%', warehouse_scale: '95万㎡',
    ai_summary: '中东高消费力市场，人均GDP超3万美元。美妆香水+38%全球领先，年轻人口占比高+Snapchat/TikTok社交种草转化率高。Vision 2030推动数字化，SABER认证门槛高但利润空间大。',
    top_shops_count: 15, hot_products_count: 62, trending_content_count: 38,
    content_vs_shelf: {content_conv: '7.8%', shelf_conv: '4.0%', live_avg_view: '9,500', short_video_avg_play: '350K', creator_avg_cost: '$280', search_traffic_share: '42%'},
    top_categories_growth: [['美妆香水','+38%'],['时尚服饰','+25%'],['电子产品','+20%'],['游戏配件','+30%'],['家居用品','+18%'],['食品','+12%'],['母婴','+22%'],['奢侈品','+35%'],['运动','+16%'],['汽车配件','+14%']],
    policy_news: [
      {level:'high',title:'SABER产品认证强制',date:'持续执行',scope:'全品类',desc:'无SABER证书产品无法清关'},
      {level:'high',title:'VAT 15%增值税',date:'持续',scope:'全品类',desc:'进口商品+本土销售均征收'},
      {level:'mid',title:'文化内容审查',date:'持续',scope:'服装/媒体',desc:'需符合伊斯兰文化规范'},
      {level:'low',title:'Halal认证建议',date:'建议',scope:'食品/化妆品',desc:'清真认证提升市场接受度'}
    ]
  },
  th: {
    gdp_total: 'US$ 5,149亿', gdp_growth: '+3.2%', per_capita_gdp: 'US$ 7,640', cpi: '+1.5%',
    currency: '36.2 THB/USD', currency_trend: 'stable', disposable_income: 'US$ 7,640',
    population: '7,180万', ecommerce_users: '5,280万', online_penetration: '74%',
    trade_volume: 'US$ 5,680亿', trade_growth: '+4.2%', cross_border_growth: '+18%',
    top_imports: '电子/机械/消费品', tariff_trend: '数字服务税4%', warehouse_scale: '210万㎡',
    ai_summary: '东南亚旅游消费大国，直播带货渗透率全东南亚最高。美妆护肤+30%，泰国美妆品牌国际化趋势。TikTok Shop直播转化率领先，FDA审批对食品药品要求严格，泼水节/水灯节是重要营销节点。',
    top_shops_count: 20, hot_products_count: 85, trending_content_count: 56,
    content_vs_shelf: {content_conv: '10.2%', shelf_conv: '3.2%', live_avg_view: '18,500', short_video_avg_play: '310K', creator_avg_cost: '$150', search_traffic_share: '35%'},
    top_categories_growth: [['美妆护肤','+30%'],['食品饮料','+20%'],['健康养生','+25%'],['旅游用品','+18%'],['家居日用','+14%'],['电子配件','+12%'],['服装','+16%'],['母婴','+15%'],['宠物','+20%'],['汽车用品','+10%']],
    policy_news: [
      {level:'mid',title:'数字服务税4%',date:'2024',scope:'全品类',desc:'跨境电商收入征收4%增值税'},
      {level:'mid',title:'FDA食品药品审批',date:'持续执行',scope:'食品保健品',desc:'审批周期2-4周'},
      {level:'low',title:'电子烟严禁进口',date:'持续',scope:'电子烟',desc:'持有/销售均违法'},
      {level:'low',title:'化妆品FDA注册',date:'持续执行',scope:'美妆',desc:'需泰语标签+成分申报'}
    ]
  },
  my: {
    gdp_total: 'US$ 4,308亿', gdp_growth: '+4.5%', per_capita_gdp: 'US$ 12,380', cpi: '+1.8%',
    currency: '4.72 MYR/USD', currency_trend: 'stable', disposable_income: 'US$ 12,380',
    population: '3,430万', ecommerce_users: '2,680万', online_penetration: '78%',
    trade_volume: 'US$ 4,820亿', trade_growth: '+5.5%', cross_border_growth: '+20%',
    top_imports: '电子/机械/化工', tariff_trend: 'RCEP优惠', warehouse_scale: '150万㎡',
    ai_summary: '多元文化市场，马来/华人/印度三大族群消费偏好各异。清真产品+28%全球清真经济中心，数字基建完善+RCEP贸易便利。多语言运营是关键，Shopee+Lazada双平台+TikTok内容营销。',
    top_shops_count: 16, hot_products_count: 72, trending_content_count: 41,
    content_vs_shelf: {content_conv: '6.5%', shelf_conv: '3.8%', live_avg_view: '8,800', short_video_avg_play: '240K', creator_avg_cost: '$160', search_traffic_share: '40%'},
    top_categories_growth: [['清真产品','+28%'],['电子数码','+22%'],['家居园艺','+18%'],['母婴用品','+20%'],['美妆护肤','+24%'],['食品','+15%'],['日用品','+12%'],['服装','+16%'],['健康保健','+18%'],['汽车配件','+10%']],
    policy_news: [
      {level:'mid',title:'数字服务税新规',date:'2024',scope:'全品类',desc:'外国数字服务提供商征税'},
      {level:'mid',title:'清真认证要求',date:'建议',scope:'食品化妆品',desc:'JAKIM认证权威性最高'},
      {level:'low',title:'多语言标签要求',date:'建议',scope:'全品类',desc:'建议马来语+英语双语'},
      {level:'low',title:'进口关税差异化',date:'持续',scope:'全品类',desc:'RCEP成员国优惠税率'}
    ]
  },
  vn: {
    gdp_total: 'US$ 4,300亿', gdp_growth: '+6.5%', per_capita_gdp: 'US$ 4,280', cpi: '+3.5%',
    currency: '25,200 VND/USD', currency_trend: 'stable', disposable_income: 'US$ 4,280',
    population: '9,880万', ecommerce_users: '6,820万', online_penetration: '69%',
    trade_volume: 'US$ 7,320亿', trade_growth: '+10.2%', cross_border_growth: '+26%',
    top_imports: '电子/机械/原料', tariff_trend: '制造业优惠', warehouse_scale: '160万㎡',
    ai_summary: '东南亚GDP增速6.5%领跑，年轻人口+移动互联网推动电商快速增长。家居生活+32%，韩流日系风格影响大。Facebook社群+TikTok+Shopee三渠道并行，COD占比42%需注意回款风险。',
    top_shops_count: 19, hot_products_count: 88, trending_content_count: 48,
    content_vs_shelf: {content_conv: '7.2%', shelf_conv: '3.0%', live_avg_view: '11,200', short_video_avg_play: '290K', creator_avg_cost: '$100', search_traffic_share: '30%'},
    top_categories_growth: [['家居生活','+32%'],['时尚服饰','+28%'],['小家电','+25%'],['美妆个护','+30%'],['食品','+16%'],['日用品','+12%'],['电子配件','+18%'],['母婴','+20%'],['运动户外','+15%'],['汽车配件','+14%']],
    policy_news: [
      {level:'mid',title:'本土电商保护政策',date:'2025讨论',scope:'全品类',desc:'可能限制外资电商平台'},
      {level:'mid',title:'物流基础设施限制',date:'持续',scope:'全品类',desc:'最后一公里配送时效不稳定'},
      {level:'low',title:'价格竞争激烈',date:'行业',scope:'全品类',desc:'利润空间被压缩'},
      {level:'low',title:'外汇管制',date:'持续',scope:'跨境',desc:'利润汇出需合规申报'}
    ]
  }
};

function cn2GetExt(key){ return cn2CountryExt[key] || cn2CountryExt['id']; }
function cn2GetTrendClass(t){ if(!t) return 'stable'; if(t.indexOf('+')>=0||t==='↑'||t==='利好') return 'up'; if(t.indexOf('-')>=0||t==='↓'||t==='收紧') return 'down'; return 'stable'; }

function cn2Render(key){
  cn2CurrentKey = key;
  var d = countryFullData[key];
  var ext = cn2GetExt(key);
  if(!d) return;

  // 1. Quick tags
  var tagHtml = '';
  var allKeys = Object.keys(countryFullData);
  var hotKeys = ['id','us','sa','th','jp','br','my','vn'];
  hotKeys.forEach(function(k){
    var cd = countryFullData[k];
    if(cd) tagHtml += '<button class="cn2-qtag'+(k===key?' active':'')+'" data-key="'+k+'">'+cd.flag+' '+cd.name+'</button>';
  });
  document.getElementById('cn2-quick-tags').innerHTML = tagHtml;

  // Quick tag click
  document.querySelectorAll('#cn2-quick-tags .cn2-qtag').forEach(function(btn){
    btn.onclick = function(){ cn2Render(this.dataset.key); };
  });

  // 2. AI One-liner
  var olHtml = '<span class="cn2-ai-icon">🧠</span>';
  olHtml += '<span class="cn2-ai-text"><b>'+d.flag+' '+d.name+'</b> — '+ext.ai_summary+'</span>';
  olHtml += '<button class="cn2-ai-btn" onclick="addReportMaterial(\'country\',\''+key+'\',\''+d.name+' 市场AI总览\')">+ 加入素材</button>';
  document.getElementById('cn2-ai-oneliner').innerHTML = olHtml;

  // 3. Update time
  document.getElementById('cn2-update-time').textContent = '数据更新于 '+new Date().toLocaleDateString('zh-CN')+' | 来源: 海关总署/世界银行/各平台官方';

  // === MAIN CONTENT ===
  var h = '';

  // Module 1: Macro Economic Data (4 tabs)
  h += '<div class="cn2-module">';
  h += '<div class="cn2-module-head"><h3>📊 宏观经济基础数据 <span class="cn2-m-badge">2026实时</span></h3>';
  h += '<div class="cn2-m-actions"><button onclick="cn2ExportMacro()">📥 导出板块</button><button onclick="addReportMaterial(\'macro\',\''+key+'\',\''+d.name+' 宏观数据\')">📎 加入素材</button></div>';
  h += '</div>';
  // Macro tabs
  var macroTabs = ['💰 经济大盘','👥 人口消费','📦 外贸进出口','📋 本土政策'];
  h += '<div class="cn2-macro-tabs">';
  macroTabs.forEach(function(t,i){
    h += '<button class="cn2-mt-btn'+(cn2MacroTab===i?' active':'')+'" data-mtab="'+i+'">'+t+'</button>';
  });
  h += '</div>';

  // Tab 0: GDP/Economy
  h += '<div class="cn2-macro-panel'+(cn2MacroTab===0?' active':'')+'">';
  h += '<div class="cn2-metric-grid">';
  var ecoMetrics = [
    {icon:'🏛️',label:'GDP总量',value:ext.gdp_total,trend:d.macro[1][2],note:'年度经济增速 '+ext.gdp_growth},
    {icon:'💵',label:'人均GDP',value:ext.per_capita_gdp,trend:d.macro[3][2],note:'居民购买力指标'},
    {icon:'📈',label:'经济增速',value:ext.gdp_growth,trend:parseFloat(ext.gdp_growth)>3?'up':'stable',note:d.name+'年度GDP增长率'},
    {icon:'📊',label:'通胀率(CPI)',value:ext.cpi,trend:parseFloat(ext.cpi)>3?'down':'stable',note:'物价水平变动指标'},
    {icon:'💱',label:'货币汇率',value:ext.currency,trend:ext.currency_trend==='stable'?'stable':(ext.currency_trend==='down'?'down':'stable'),note:'本币兑美元汇率'},
    {icon:'💰',label:'人均可支配收入',value:ext.disposable_income,trend:d.macro[3][2],note:d.macro[3][3]}
  ];
  ecoMetrics.forEach(function(m){
    h += '<div class="cn2-metric-card"><div class="mc-icon">'+m.icon+'</div><div class="mc-label">'+m.label+'</div><div class="mc-value">'+m.value+'</div><div class="mc-trend '+cn2GetTrendClass(m.trend)+'">'+m.trend+'</div><div class="mc-note">'+m.note+'</div></div>';
  });
  h += '</div></div>';

  // Tab 1: Population & Consumer
  h += '<div class="cn2-macro-panel'+(cn2MacroTab===1?' active':'')+'">';
  h += '<div class="cn2-metric-grid">';
  var demoMetrics = [
    {icon:'👨‍👩‍👧‍👦',label:'总人口',value:ext.population,trend:d.macro[0][2],note:d.macro[0][3]},
    {icon:'🌐',label:'电商网民数',value:ext.ecommerce_users,trend:'↑',note:'线上购物活跃用户'},
    {icon:'📱',label:'线上渗透率',value:ext.online_penetration,trend:'↑',note:'互联网购物渗透比例'},
    {icon:'🎯',label:'主流消费年龄',value:d.demo.ai_age.split('，')[0],trend:'→',note:d.demo.ai_age},
    {icon:'♀️',label:'女性消费偏好',value:d.demo.f_pref.substring(0,12)+'...',trend:'→',note:d.demo.f_pref},
    {icon:'♂️',label:'男性消费偏好',value:d.demo.m_pref.substring(0,12)+'...',trend:'→',note:d.demo.m_pref}
  ];
  demoMetrics.forEach(function(m){
    h += '<div class="cn2-metric-card"><div class="mc-icon">'+m.icon+'</div><div class="mc-label">'+m.label+'</div><div class="mc-value">'+m.value+'</div><div class="mc-trend '+cn2GetTrendClass(m.trend)+'">'+m.trend+'</div><div class="mc-note">'+m.note+'</div></div>';
  });
  h += '</div>';
  // Age distribution
  h += '<div style="margin-top:16px"><h4 style="font-size:13px;margin-bottom:10px;color:var(--ink)">📊 年龄分层消费画像</h4>';
  d.demo.age.forEach(function(a){
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:60px;font-size:11px;color:var(--muted)">'+a[0]+'</span><div style="flex:1;height:18px;background:var(--paper);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+a[1]+'%;background:'+(a[1]>=28?'var(--green)':'#7a9a8e')+';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;color:#fff;font-weight:600">'+a[1]+'%</div></div><span style="width:120px;font-size:10px;color:var(--muted)">'+a[2]+'</span></div>';
  });
  h += '</div>';
  // Income distribution
  h += '<div style="margin-top:16px"><h4 style="font-size:13px;margin-bottom:10px;color:var(--ink)">💰 收入分层 & 消费定位</h4>';
  d.demo.income.forEach(function(inc){
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:80px;font-size:11px;color:var(--muted)">'+inc[0]+'</span><div style="flex:1;height:18px;background:var(--paper);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+inc[1]+'%;background:'+inc[3]+';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;color:#fff;font-weight:600">'+inc[1]+'%</div></div><span style="width:120px;font-size:10px;color:var(--muted)">'+inc[2]+'</span></div>';
  });
  h += '</div></div>';

  // Tab 2: Trade
  h += '<div class="cn2-macro-panel'+(cn2MacroTab===2?' active':'')+'">';
  h += '<div class="cn2-metric-grid">';
  var tradeMetrics = [
    {icon:'🚢',label:'对华进出口总额',value:ext.trade_volume,trend:d.macro[5][2],note:d.macro[5][3]},
    {icon:'📈',label:'跨境电商增速',value:ext.cross_border_growth,trend:'up',note:'年度跨境电商增长'},
    {icon:'📦',label:'重点进口类目',value:ext.top_imports,trend:'→',note:'主要进口商品类别'},
    {icon:'🏷️',label:'关税政策',value:ext.tariff_trend,trend:ext.tariff_trend.indexOf('下调')>=0?'up':(ext.tariff_trend.indexOf('加征')>=0?'down':'stable'),note:'当前关税走向'},
    {icon:'🏭',label:'海外仓规模',value:ext.warehouse_scale,trend:'↑',note:'当地仓储基建面积'},
    {icon:'🌍',label:'外贸环境',value:d.macro[5][1],trend:d.macro[5][2],note:d.macro[5][3]}
  ];
  tradeMetrics.forEach(function(m){
    h += '<div class="cn2-metric-card"><div class="mc-icon">'+m.icon+'</div><div class="mc-label">'+m.label+'</div><div class="mc-value">'+m.value+'</div><div class="mc-trend '+cn2GetTrendClass(m.trend)+'">'+m.trend+'</div><div class="mc-note">'+m.note+'</div></div>';
  });
  h += '</div></div>';

  // Tab 3: Policy
  h += '<div class="cn2-macro-panel'+(cn2MacroTab===3?' active':'')+'">';
  h += '<div class="cn2-policy-list">';
  ext.policy_news.forEach(function(p){
    h += '<div class="cn2-policy-card '+p.level+'">';
    h += '<div class="pc-head"><span class="pc-level '+p.level+'">'+(p.level==='high'?'高风险':p.level==='mid'?'中风险':'低风险')+'</span><span class="pc-title">'+p.title+'</span></div>';
    h += '<div class="pc-meta">'+p.date+' · 影响: '+p.scope+'</div>';
    h += '<div class="pc-desc">'+p.desc+'</div>';
    h += '<div class="pc-actions"><button onclick="addReportMaterial(\'policy\',\''+key+'\',\''+p.title+'\')">📎 加入素材</button><button onclick="toast(\'已同步至预警中心\')">⚠️ 设置预警</button></div>';
    h += '</div>';
  });
  h += '</div></div>';

  h += '</div>'; // end Module 1

  // Module 2: Full Platform E-commerce Data
  h += '<div class="cn2-module">';
  h += '<div class="cn2-module-head"><h3>🛒 该国全平台电商行情 <span class="cn2-m-badge">'+d.plats.length+'大平台</span></h3>';
  h += '<div class="cn2-m-actions"><button onclick="cn2ExportPlats()">📥 导出板块</button></div></div>';

  // Content vs Shelf comparison
  h += '<div class="cn2-ecom-compare">';
  h += '<div class="cn2-ecom-box"><h4>📱 内容电商数据</h4>';
  h += '<div class="eb-row"><span class="eb-label">短视频转化率</span><span class="eb-value">'+ext.content_vs_shelf.content_conv+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">直播平均场观</span><span class="eb-value">'+ext.content_vs_shelf.live_avg_view+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">达人投放均价</span><span class="eb-value">'+ext.content_vs_shelf.creator_avg_cost+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">短视频平均播放</span><span class="eb-value">'+ext.content_vs_shelf.short_video_avg_play+'</span></div>';
  h += '</div>';
  h += '<div class="cn2-ecom-box"><h4>🔍 货架电商数据</h4>';
  h += '<div class="eb-row"><span class="eb-label">搜索转化率</span><span class="eb-value">'+ext.content_vs_shelf.shelf_conv+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">搜索流量占比</span><span class="eb-value">'+ext.content_vs_shelf.search_traffic_share+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">客单价趋势</span><span class="eb-value">'+d.demo.price_trend+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">COD比例</span><span class="eb-value">'+d.demo.cod+'%</span></div>';
  h += '</div></div>';

  // Platform cards
  h += '<div class="cn2-plat-compare">';
  var platColors2 = ['#df6f3d','#3c6c62','#4a90d9','#c8a84e','#e8879a'];
  d.plats.forEach(function(p, i){
    h += '<div class="cn2-plat-card-v2">';
    h += '<div class="pv-head"><span class="pv-emoji">'+p[1]+'</span><span class="pv-name">'+p[0]+'</span><span class="pv-share">'+p[2]+'%</span></div>';
    h += '<div class="pv-metrics">';
    h += '<div class="pv-m-item"><div class="pv-m-label">模式</div><div class="pv-m-value">'+p[3]+'</div></div>';
    h += '<div class="pv-m-item"><div class="pv-m-label">入驻</div><div class="pv-m-value">'+p[4]+'</div></div>';
    h += '<div class="pv-m-item"><div class="pv-m-label">佣金</div><div class="pv-m-value">'+p[5]+'</div></div>';
    h += '<div class="pv-m-item"><div class="pv-m-label">热度</div><div class="pv-m-value">'+p[7]+'</div></div>';
    h += '</div>';
    h += '<div class="pv-tags"><span class="pv-tag">'+p[6]+'</span></div>';
    h += '</div>';
  });
  h += '</div>';

  // Top 10 Growth Categories
  h += '<div style="margin-top:18px"><h4 style="font-size:13px;margin-bottom:10px;color:var(--ink)">🏆 增速TOP10类目</h4>';
  h += '<div class="cn2-cat-top10">';
  ext.top_categories_growth.forEach(function(c){
    h += '<div class="cn2-cat-item-v2" onclick="switchPage(\'products\');toast(\'跳转产品雷达筛选: '+c[0]+'\')"><div class="ci-name">'+c[0]+'</div><div class="ci-growth">'+c[1]+'</div></div>';
  });
  h += '</div></div>';

  // Blue ocean / Stable / Risk categories
  h += '<div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">';
  h += '<div style="padding:14px;background:rgba(60,108,98,.05);border:1px solid rgba(60,108,98,.2);border-radius:10px"><h4 style="font-size:12px;color:var(--green);margin-bottom:8px">🌊 蓝海低竞争类目</h4>';
  d.cat.blue.forEach(function(c){ h += '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">'+c[0]+' <span style="color:var(--green);font-weight:600;font-size:11px">'+c[1]+'</span></div>'; });
  h += '</div>';
  h += '<div style="padding:14px;background:rgba(200,168,78,.05);border:1px solid rgba(200,168,78,.2);border-radius:10px"><h4 style="font-size:12px;color:#c8a84e;margin-bottom:8px">📦 稳定大盘类目</h4>';
  d.cat.stable.forEach(function(c){ h += '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">'+c+'</div>'; });
  h += '</div>';
  h += '<div style="padding:14px;background:rgba(192,57,43,.05);border:1px solid rgba(192,57,43,.2);border-radius:10px"><h4 style="font-size:12px;color:#c0392b;margin-bottom:8px">⚠️ 高风险/禁售类目</h4>';
  d.cat.risk.forEach(function(c){ h += '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">'+c[0]+' <span style="color:#c0392b;font-size:10px">'+c[1]+'</span></div>'; });
  h += '</div></div>';

  h += '</div>'; // end Module 2

  // Module 3: Cross-page Quick Links
  h += '<div class="cn2-module">';
  h += '<div class="cn2-module-head"><h3>🔗 联动数据快捷入口</h3></div>';
  h += '<div class="cn2-link-cards">';
  h += '<div class="cn2-link-card" onclick="switchPage(\'products\')"><div class="lc-icon">🔥</div><div class="lc-title">该国爆款商品</div><div class="lc-desc">跳转产品全域雷达，自动筛选'+d.name+'全部商品</div><div class="lc-count">'+ext.hot_products_count+'</div></div>';
  h += '<div class="cn2-link-card" onclick="switchPage(\'shops\')"><div class="lc-icon">🏪</div><div class="lc-title">该国竞店清单</div><div class="lc-desc">跳转店铺追踪，仅展示'+d.name+'已监控店铺</div><div class="lc-count">'+ext.top_shops_count+'</div></div>';
  h += '<div class="cn2-link-card" onclick="switchPage(\'content\')"><div class="lc-icon">🎬</div><div class="lc-title">该国热门种草内容</div><div class="lc-desc">跳转热门内容追踪，筛选本土短视频/直播素材</div><div class="lc-count">'+ext.trending_content_count+'</div></div>';
  h += '</div></div>';

  // Module 4: Consumer behavior summary
  h += '<div class="cn2-module">';
  h += '<div class="cn2-module-head"><h3>🛍️ 消费行为画像</h3></div>';
  h += '<div class="cn2-ecom-compare">';
  h += '<div class="cn2-ecom-box"><h4>🏪 货架消费特征</h4><p style="font-size:12px;color:#555;line-height:1.6">'+d.demo.shelf+'</p></div>';
  h += '<div class="cn2-ecom-box"><h4>📱 内容消费特征</h4><p style="font-size:12px;color:#555;line-height:1.6">'+d.demo.content+'</p></div>';
  h += '</div>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">';
  h += '<div style="flex:1;min-width:150px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:11px;color:var(--muted)">主流支付方式</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:4px">'+d.demo.payment+'</div></div>';
  h += '<div style="flex:1;min-width:150px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:11px;color:var(--muted)">COD货到付款</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:4px">'+d.demo.cod+'%</div></div>';
  h += '<div style="flex:1;min-width:150px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:11px;color:var(--muted)">购物高峰时段</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:4px">'+d.demo.peak+'</div></div>';
  h += '<div style="flex:1;min-width:150px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:11px;color:var(--muted)">年度营销节点</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:4px">'+d.demo.fest+'</div></div>';
  h += '</div></div>';

  document.getElementById('cn2-main').innerHTML = h;

  // === SIDEBAR ===
  var sh = '';
  // Compliance section
  sh += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px">';
  sh += '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">⚖️ 合规预警</h4>';
  sh += '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;color:#fff;background:'+(d.comp.cls==='strict'?'#c0392b':d.comp.cls==='medium'?'#c8a84e':'var(--green)')+'">合规难度: '+d.comp.level+'</span>';
  sh += '<div style="margin-top:10px">';
  d.comp.policies.forEach(function(p){
    sh += '<div style="padding:8px 0;border-bottom:1px solid var(--border)">';
    sh += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:6px;height:6px;border-radius:50%;background:'+(p[0]==='high'?'#c0392b':p[0]==='mid'?'#c8a84e':'var(--green)')+'"></span><span style="font-size:12px;font-weight:600;color:var(--ink)">'+p[1]+'</span></div>';
    sh += '<div style="font-size:10px;color:var(--muted)">'+p[2]+' · '+p[3]+' · '+p[4]+'</div>';
    sh += '<div style="font-size:11px;color:#555;margin-top:4px;line-height:1.4">'+p[5]+'</div>';
    sh += '</div>';
  });
  sh += '</div>';
  sh += '<button style="width:100%;padding:8px;border:1px solid var(--green);color:var(--green);border-radius:6px;background:transparent;font-size:12px;cursor:pointer;margin-top:10px" onclick="switchPage(\'policies\')">查看政策动态全景 →</button>';
  sh += '</div>';

  // Price bands section
  sh += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px">';
  sh += '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">💰 价格带 & 渠道策略</h4>';
  d.demo.price.forEach(function(p){
    sh += '<div style="padding:8px;background:var(--paper);border-radius:6px;margin-bottom:6px"><div style="font-size:12px;font-weight:600;color:var(--ink)">'+p[0]+'</div><div style="font-size:10px;color:var(--muted)">'+p[1]+' · '+p[2]+'</div><div style="font-size:11px;color:#555;margin-top:2px">'+p[3]+'</div></div>';
  });
  sh += '</div>';

  // Religion & culture section
  sh += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px">';
  sh += '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">🕌 宗教 & 文化禁忌</h4>';
  d.demo.religion.forEach(function(r){
    sh += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><div style="flex:1;height:6px;background:var(--paper);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+r[1]+'%;background:var(--green);border-radius:3px"></div></div><span style="font-size:10px;color:var(--muted);width:80px">'+r[0]+' '+r[1]+'%</span></div>';
  });
  sh += '<div style="margin-top:8px;padding:8px;background:rgba(192,57,43,.05);border-radius:6px">';
  sh += '<div style="font-size:11px;font-weight:600;color:#c0392b;margin-bottom:4px">⚠️ 营销禁忌</div>';
  d.demo.risk.forEach(function(r){ sh += '<div style="font-size:10px;color:#555;padding:2px 0">• '+r+'</div>'; });
  sh += '</div>';
  sh += '<div style="margin-top:6px;padding:8px;background:rgba(60,108,98,.05);border-radius:6px">';
  sh += '<div style="font-size:11px;font-weight:600;color:var(--green);margin-bottom:4px">✅ 文化机会</div>';
  d.demo.opp.forEach(function(o){ sh += '<div style="font-size:10px;color:#555;padding:2px 0">• '+o+'</div>'; });
  sh += '</div></div>';

  // AI entry advice
  sh += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px">';
  sh += '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">🎯 AI 入场策略建议</h4>';
  d.ai.advice.forEach(function(a){
    var idx = a.indexOf('：');
    sh += '<div style="padding:8px;background:var(--paper);border-radius:6px;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:var(--green)">'+a.substring(0,idx)+'</span><span style="font-size:11px;color:#555">'+a.substring(idx)+'</span></div>';
  });
  sh += '</div>';

  document.getElementById('cn2-aside').innerHTML = sh;

  // Bind macro tab events
  document.querySelectorAll('.cn2-mt-btn').forEach(function(btn){
    btn.onclick = function(){
      cn2MacroTab = parseInt(this.dataset.mtab);
      cn2Render(cn2CurrentKey);
    };
  });
}

// Time filter
document.querySelectorAll('.cn2-tf-btn').forEach(function(btn){
  btn.onclick = function(){
    document.querySelectorAll('.cn2-tf-btn').forEach(function(b){b.classList.remove('active')});
    this.classList.add('active');
    cn2TimeFilter = this.dataset.tf;
    cn2Render(cn2CurrentKey);
    toast('已切换至'+(cn2TimeFilter==='3m'?'近3个月':cn2TimeFilter==='6m'?'近半年':'全年')+'数据');
  };
});

// Search
(function(){
  var searchInput = document.getElementById('cn2-search');
  var dd = document.getElementById('cn2-search-dd');
  if(!searchInput || !dd) return;
  searchInput.addEventListener('input', function(){
    var q = this.value.toLowerCase();
    if(!q){ dd.classList.remove('open'); return; }
    var keys = Object.keys(countryFullData);
    var html = '';
    keys.forEach(function(k){
      var d = countryFullData[k];
      if(d && (d.name.toLowerCase().indexOf(q)>=0 || d.subtitle.toLowerCase().indexOf(q)>=0 || d.region.toLowerCase().indexOf(q)>=0)){
        html += '<div class="cn2-dd-item" data-key="'+k+'">'+d.flag+' '+d.name+' <span style="font-size:10px;color:var(--muted)">('+d.region+')</span></div>';
      }
    });
    dd.innerHTML = html || '<div style="padding:10px;font-size:12px;color:var(--muted)">未找到匹配国家</div>';
    dd.classList.add('open');
  });
  dd.addEventListener('click', function(e){
    var item = e.target.closest('.cn2-dd-item');
    if(item){ cn2Render(item.dataset.key); searchInput.value=''; dd.classList.remove('open'); }
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.cn2-search-wrap')){ dd.classList.remove('open'); }});
})();

// Export functions
function cn2ExportPDF(){ toast('正在生成'+countryFullData[cn2CurrentKey].name+'完整市场PDF报告...'); setTimeout(function(){ toast('PDF报告已生成，可下载'); }, 1500); }
function cn2ExportExcel(){ toast('正在导出'+countryFullData[cn2CurrentKey].name+'市场数据Excel...'); setTimeout(function(){ toast('Excel已导出'); }, 1000); }
function cn2ExportMacro(){ toast('正在导出宏观经济数据...'); }
function cn2ExportPlats(){ toast('正在导出平台数据...'); }
function cn2AddMaterial(){ addReportMaterial('country', cn2CurrentKey, countryFullData[cn2CurrentKey].name+' 完整市场档案'); toast('已加入报告素材'); }

// Initial render
cn2Render('id');
// Remove old renderCountry default call
// renderCountry('id'); -- disabled

"""

html = html[:old_fn_start] + new_fn + '\n' + html[old_fn_end:]

# ============================================================
# 4. UPDATE switchPage titles for countries
# ============================================================
html = html.replace(
    "countries:'国家市场档案'",
    "countries:'国家市场档案'"
)

# ============================================================
# 5. UPDATE the overview page country card click to use cn2Render
# ============================================================
# The overview page has a button that switches to countries page
# We need to make sure clicking country cards still works

# ============================================================
# 6. WRITE OUTPUT
# ============================================================
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done! File size:", len(html))
print("CSS added, section replaced, renderCountry replaced with cn2Render")
