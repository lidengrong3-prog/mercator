#!/usr/bin/env python3
"""Round 2 optimization for Mercator overview page."""
import re

with open('/app/data/所有对话/主对话/mercator_rework/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ============================================================
# 1. CSS ADDITIONS - Insert before </style>
# ============================================================
new_css = """
/* === Round 2: Metric card description === */
.ov-metric-desc{font:10px 'DM Mono';color:var(--muted);margin-top:6px;line-height:1.5}

/* === Round 2: Trend chart controls === */
.ov-trend-controls{display:flex;gap:8px;align-items:center}
.ov-trend-ai-btn{border:1px solid #d4e4f7;background:#f0f7ff;color:#4a90d9;border-radius:4px;padding:4px 10px;font:11px 'Noto Sans SC';cursor:pointer;transition:.2s}
.ov-trend-ai-btn:hover{background:#e0efff}
.ov-trend-range{display:flex;gap:0}
.ov-trend-range button{border:1px solid var(--line);background:#fff;padding:4px 10px;font:10px 'DM Mono';cursor:pointer;color:var(--muted);transition:.15s}
.ov-trend-range button:first-child{border-radius:4px 0 0 4px}
.ov-trend-range button:last-child{border-radius:0 4px 4px 0}
.ov-trend-range button.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.ov-trend-conclusion{font:11px 'Noto Sans SC';color:#52605b;margin-top:8px;padding:8px 12px;background:#f8faf8;border-radius:4px;border-left:3px solid #4d946e}

/* === Round 2: Tab badges === */
.ov-opp-tab-badge{display:inline-block;background:rgba(255,255,255,.15);color:#f3a173;font:bold 9px 'DM Mono';padding:1px 5px;border-radius:8px;margin-left:4px;vertical-align:middle}
.ov-opp-tab.risk-tab{color:#ff6b6b;font-weight:700}
.ov-opp-tab.risk-tab.active{color:#ff6b6b;border-bottom-color:#ff6b6b}

/* === Round 2: Opportunity card action buttons === */
.ov-opp-card-actions{display:flex;gap:10px;margin-top:16px;align-items:center}
.ov-opp-card-btn{border:0;background:rgba(255,255,255,.1);color:#dce4db;border-radius:4px;padding:8px 16px;font-family:inherit;font-size:11px;cursor:pointer;transition:.2s}
.ov-opp-card-btn:hover{background:rgba(255,255,255,.18)}
.ov-opp-subscribe-btn{border:1px solid rgba(255,255,255,.2);background:transparent;color:#8aaa9e;border-radius:4px;padding:6px 14px;font-family:inherit;font-size:10px;cursor:pointer;transition:.2s;margin-top:12px}
.ov-opp-subscribe-btn:hover{background:rgba(255,255,255,.08);color:#dce4db}

/* === Round 2: Country card AI tooltip === */
.ov-ccard-ai-icon{position:absolute;top:10px;right:10px;font-size:14px;cursor:pointer;opacity:.6;transition:.2s}
.ov-ccard-ai-icon:hover{opacity:1;transform:scale(1.15)}
.ov-ai-tooltip{position:absolute;top:32px;right:10px;width:220px;background:#f0f7ff;border:1px solid #d4e4f7;border-left:3px solid #4a90d9;border-radius:4px;padding:10px 12px;font-size:11px;color:#3a6b9f;line-height:1.6;z-index:50;box-shadow:0 4px 12px rgba(74,144,217,.12);pointer-events:none}

/* === Round 2: Country tag filters === */
.ov-tag-filters{display:flex;gap:6px;margin-bottom:14px}
.ov-tag-btn{border:1px solid var(--line);background:#fff;border-radius:14px;padding:4px 12px;font-family:inherit;font-size:10px;cursor:pointer;color:var(--muted);transition:.2s}
.ov-tag-btn:hover{border-color:#aebbb3;color:var(--ink)}
.ov-tag-btn.active{background:var(--green);color:#fff;border-color:var(--green)}

/* === Round 2: AI Diagnosis card === */
.ov-ai-diagnosis{background:linear-gradient(135deg,#f0f7ff 0%,#e8f4ff 100%);border:1px solid #d4e4f7;border-left:4px solid #4a90d9;border-radius:6px;padding:20px 24px;margin-bottom:18px;position:relative}
.ov-ai-diagnosis h4{margin:0 0 12px;font-size:14px;color:#2c5f9e;display:flex;align-items:center;gap:8px}
.ov-ai-diagnosis h4 .pro-badge{font:9px 'DM Mono';background:#c8a84e;color:#fff;padding:2px 6px;border-radius:3px}
.ov-ai-diagnosis ul{margin:0;padding:0 0 0 0;list-style:none}
.ov-ai-diagnosis li{font-size:12px;line-height:2;color:#3a6b9f;padding-left:4px}

/* === Round 2: AI Advisor floating button & dialog === */
.ai-advisor-btn{position:fixed;right:82px;bottom:24px;width:48px;height:48px;border-radius:50%;background:#4a90d9;color:#fff;border:2px solid #d4e4f7;cursor:pointer;z-index:100;display:grid;place-items:center;font-size:20px;box-shadow:0 4px 16px rgba(74,144,217,.35);transition:all .25s}
.ai-advisor-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(74,144,217,.45)}
.ai-advisor-dialog{position:fixed;right:82px;bottom:84px;width:320px;background:#fff;border:1px solid #d4e4f7;border-radius:8px;z-index:101;box-shadow:0 12px 40px rgba(74,144,217,.2);display:none;overflow:hidden}
.ai-advisor-dialog.open{display:block}
.ai-advisor-dialog .adv-header{background:linear-gradient(135deg,#4a90d9,#3a7bc8);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center}
.ai-advisor-dialog .adv-header h4{margin:0;font-size:13px;display:flex;align-items:center;gap:6px}
.ai-advisor-dialog .adv-header small{cursor:pointer;font-size:16px;opacity:.8}
.ai-advisor-dialog .adv-body{padding:16px 18px}
.ai-advisor-dialog .adv-q{display:block;width:100%;text-align:left;border:1px solid #d4e4f7;background:#f0f7ff;color:#3a6b9f;border-radius:6px;padding:10px 14px;font-family:inherit;font-size:12px;cursor:pointer;margin-bottom:8px;transition:.15s}
.ai-advisor-dialog .adv-q:hover{background:#e0efff}
.ai-advisor-dialog .adv-footer{font:10px 'DM Mono';color:#9aa29e;text-align:center;padding:8px 18px 14px;border-top:1px solid #eee}

/* === Round 2: Export Modal === */
.export-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:none;align-items:center;justify-content:center}
.export-modal-overlay.open{display:flex}
.export-modal{background:#fff;border-radius:8px;padding:32px 36px;width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.export-modal h3{font-size:18px;margin:0 0 8px;color:var(--ink)}
.export-modal p{font-size:13px;color:#65726d;margin:0 0 24px;line-height:1.6}
.export-modal .modal-btns{display:flex;gap:12px;justify-content:center}
.export-modal .modal-btn{border:0;border-radius:5px;padding:10px 24px;font-family:inherit;font-size:13px;cursor:pointer;transition:.2s}
.export-modal .modal-btn-primary{background:var(--orange);color:#fff}
.export-modal .modal-btn-primary:hover{background:#c75f30}
.export-modal .modal-btn-ghost{background:#f4f2ed;color:var(--muted)}
.export-modal .modal-btn-ghost:hover{background:#eae8e3}

/* === Round 2: Ticker tabs === */
.ticker-tabs{display:flex;gap:0;padding:0 18px;border-bottom:1px solid #3c5550}
.ticker-tab{background:none;border:0;color:#7a9088;font:10px 'Noto Sans SC';padding:8px 12px;cursor:pointer;border-bottom:2px solid transparent;transition:.15s}
.ticker-tab.active{color:#f3a173;border-bottom-color:#f3a173}
.ticker-pro-hint{font:9px 'DM Mono';color:#5a706a;padding:8px 18px;text-align:center;border-top:1px solid #3c5550}

/* === Round 2: Risk highlight === */
.risk-highlight{color:#dc7140!important;font-weight:700}

/* === Round 2: Trust footer enhancements === */
.ov-trust-cta button{background:var(--orange)!important;color:#fff!important;padding:14px 28px!important;font-size:14px!important}
.ov-trust-cta button:hover{background:#c75f30!important}
.ov-trust-source{font:10px 'DM Mono';color:#a0aba6;margin-top:12px;text-align:center;grid-column:1/-1}

/* === Round 2: Pulse animation for numbers === */
@keyframes numPulse{0%,100%{opacity:1}50%{opacity:.7}}
.ov-metric-val{animation:numPulse 2s ease-in-out infinite}

/* === Round 2: Card hover enhanced === */
.ov-metric-card:hover,.ov-ccard:hover,.platform-card:hover,.ct-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(28,43,41,.1)}

/* === Round 2: Ticker badge === */
.ticker-badge{position:absolute;top:-4px;right:-4px;background:#dc7140;color:#fff;font:bold 9px 'DM Mono';min-width:16px;height:16px;display:grid;place-items:center;border-radius:8px;padding:0 4px}
"""

html = html.replace('</style>', new_css + '\n</style>')

# ============================================================
# 2. HTML MODIFICATIONS
# ============================================================

# 2a. Reorder welcome buttons: 全局搜索 → 导出报告 → 免费试用(orange) → 联系销售
old_welcome_right = '''<div class="ov-welcome-right">
          <button class="ov-cta ov-cta-outline" id="ov-search-btn">⌕ 全局搜索</button>
          <button class="ov-cta ov-cta-primary" id="ov-trial-btn">免费试用 / 功能演示</button>
          <button class="ov-cta ov-cta-outline" id="ov-sales-btn">联系销售定制方案</button>
          <button class="ov-cta ov-cta-outline" id="ov-export-btn">↓ 导出报告</button>
        </div>'''

new_welcome_right = '''<div class="ov-welcome-right">
          <button class="ov-cta ov-cta-outline" id="ov-search-btn">⌕ 全局搜索</button>
          <button class="ov-cta ov-cta-outline" id="ov-export-btn">↓ 导出报告</button>
          <button class="ov-cta ov-cta-primary" id="ov-trial-btn" style="background:var(--orange);color:#fff;font-weight:600">★ 免费试用 / 功能演示</button>
          <button class="ov-cta ov-cta-outline" id="ov-sales-btn">联系销售定制方案</button>
        </div>'''
html = html.replace(old_welcome_right, new_welcome_right)

# 2b. Enhance trend card header with AI button and range toggle
old_trend_header = '''<div class="ov-trend-header">
            <h3>全球爆款数据增量趋势</h3>
            <span class="ov-trend-badge">近 30 日</span>
          </div>'''
new_trend_header = '''<div class="ov-trend-header">
            <h3>全球爆款数据增量趋势</h3>
            <div class="ov-trend-controls">
              <button class="ov-trend-ai-btn" id="ov-trend-ai-btn">✨ AI 解读</button>
              <div class="ov-trend-range" id="ov-trend-range">
                <button data-days="7">7日</button>
                <button data-days="30" class="active">30日</button>
                <button data-days="90">90日</button>
              </div>
              <span class="ov-trend-badge" id="ov-trend-badge">近 30 日</span>
            </div>
          </div>'''
html = html.replace(old_trend_header, new_trend_header)

# 2c. Add trend conclusion below trend foot
old_trend_foot_end = '''<div class="ov-trend-foot">
            <small>日均新增 8 万条商品数据</small>
            <small>起点 220 万 → 终点 299 万</small>
          </div>'''
new_trend_foot = '''<div class="ov-trend-foot">
            <small>日均新增 8 万条商品数据</small>
            <small id="ov-trend-range-label">起点 220 万 → 终点 299 万</small>
          </div>
          <div class="ov-trend-conclusion" id="ov-trend-conclusion">📊 近 30 日全球美妆、家居类目商品数据增量涨幅最高</div>'''
html = html.replace(old_trend_foot_end, new_trend_foot)

# 2d. Add AI diagnosis card after ov-metrics div
old_metrics_line = '<div class="ov-metrics" id="ov-metrics"></div>'
new_metrics_line = '''<div class="ov-metrics" id="ov-metrics"></div>
        <div class="ov-ai-diagnosis" id="ov-ai-diagnosis"></div>'''
html = html.replace(old_metrics_line, new_metrics_line)

# 2e. Add AI advisor button and dialog before ticker button
old_ticker_btn = '<button class="live-ticker-btn" id="ticker-btn"'
new_floating = '''<button class="ai-advisor-btn" id="ai-advisor-btn" title="AI 智能顾问">🤖</button>
  <div class="ai-advisor-dialog" id="ai-advisor-dialog">
    <div class="adv-header"><h4>🤖 Mercator AI 智能顾问</h4><small id="ai-adv-close">✕</small></div>
    <div class="adv-body">
      <button class="adv-q" data-q="countries">🌍 哪些国家值得进入？</button>
      <button class="adv-q" data-q="beauty">💄 美妆品类怎么布局？</button>
      <button class="adv-q" data-q="policy">📋 最新政策有哪些？</button>
    </div>
    <div class="adv-footer">深度分析功能需升级 PRO 套餐</div>
  </div>
  <button class="live-ticker-btn" id="ticker-btn"'''
html = html.replace(old_ticker_btn, new_floating)

# 2f. Add export modal before toast div
old_toast = '<div class="toast" id="toast">'
new_modal = '''<div class="export-modal-overlay" id="export-modal-overlay">
    <div class="export-modal">
      <h3>🔒 解锁完整市场报告</h3>
      <p>升级专业版即可一键生成定制化市场分析报告，涵盖国家宏观数据、品类趋势、政策解读与 AI 智能建议。</p>
      <div class="modal-btns">
        <button class="modal-btn modal-btn-primary" id="export-modal-upgrade">了解详情</button>
        <button class="modal-btn modal-btn-ghost" id="export-modal-close">暂不需要</button>
      </div>
    </div>
  </div>
  <div class="toast" id="toast">'''
html = html.replace(old_toast, new_modal)

# 2g. Enhance trust footer with data source
old_trust_end = '''<div class="ov-trust-col ov-trust-cta">
          <button id="ov-plan-btn">查看套餐与权益对比 →</button>
        </div>
      </div>'''
new_trust_end = '''<div class="ov-trust-col ov-trust-cta">
          <button id="ov-plan-btn">查看套餐与权益对比 →</button>
        </div>
        <div class="ov-trust-source">数据来源：各国统计局、电商官方 API、海关公开资讯 · 合规采集</div>
      </div>'''
html = html.replace(old_trust_end, new_trust_end)

# 2h. Add ticker tabs in ticker panel
old_ticker_header_end = '''<div class="ticker-list" id="ticker-list"></div>'''
new_ticker_tabs_html = '''<div class="ticker-tabs" id="ticker-tabs">
      <button class="ticker-tab active" data-ttab="all">全部</button>
      <button class="ticker-tab" data-ttab="platform">平台新规</button>
      <button class="ticker-tab" data-ttab="policy">各国外贸政策</button>
      <button class="ticker-tab" data-ttab="category">品类热点</button>
    </div>
    <div class="ticker-list" id="ticker-list"></div>
    <div class="ticker-pro-hint">PRO 查看完整原文 + AI 风险解读</div>'''
html = html.replace(old_ticker_header_end, new_ticker_tabs_html)

# 2i. Add second row filter for countries (tag filters)
old_country_filters = '''<div class="ov-country-filters" id="ov-country-filters"></div>
        <div class="ov-country-grid" id="ov-country-grid"></div>'''
new_country_filters = '''<div class="ov-country-filters" id="ov-country-filters"></div>
        <div class="ov-tag-filters" id="ov-tag-filters"></div>
        <div class="ov-country-grid" id="ov-country-grid"></div>'''
html = html.replace(old_country_filters, new_country_filters)

# ============================================================
# 3. JAVASCRIPT MODIFICATIONS
# ============================================================

# 3a. Replace the ovExportBtn handler and add export modal logic
old_export_handler = "$('#ov-export-btn').onclick=function(){toast('PRO 版功能：一键生成定制化市场分析报告')};"
new_export_handler = "$('#ov-export-btn').onclick=function(){$('#export-modal-overlay').classList.add('open')};$('#export-modal-close').onclick=function(){$('#export-modal-overlay').classList.remove('open')};$('#export-modal-upgrade').onclick=function(){$('#export-modal-overlay').classList.remove('open');toast('即将跳转至套餐页面…')};$('#export-modal-overlay').onclick=function(e){if(e.target===this)this.classList.remove('open')};"
html = html.replace(old_export_handler, new_export_handler)

# 3b. Replace metric cards rendering to include descriptions
old_metric_render = '''(function(){
  var metrics=[
    {label:'监测覆盖国家',val:'26',sub:'目标 40+ 国',pct:65,color:'#3c6c62'},
    {label:'接入电商平台',val:'41',sub:'货架 + 内容电商',pct:82,color:'#df6f3d'},
    {label:'有效商品数据',val:'299万+',sub:'日新增 8 万条',pct:75,color:'#4d946e'},
    {label:'政策 & 风险资讯',val:'2400+',sub:'每日实时更新',pct:90,color:'#c39142'}
  ];
  var circ=2*Math.PI*26;
  $('#ov-metrics').innerHTML=metrics.map(function(m){
    var offset=circ-(circ*m.pct/100);
    return '<div class="ov-metric-card"><div class="ov-ring"><svg viewBox="0 0 64 64"><circle class="ring-bg" cx="32" cy="32" r="26"/><circle class="ring-fg" cx="32" cy="32" r="26" stroke="'+m.color+'" stroke-dasharray="'+circ+'" stroke-dashoffset="'+offset+'"/></svg><span class="ring-label">'+m.pct+'%</span></div><div class="ov-metric-info"><h3>'+m.label+'</h3><div class="ov-metric-val">'+m.val+'</div><div class="ov-metric-sub">'+m.sub+'</div></div></div>';
  }).join('');
})();'''

new_metric_render = '''(function(){
  var metrics=[
    {label:'监测覆盖国家',val:'26',sub:'目标 40+ 国',pct:65,color:'#3c6c62',desc:'目标拓展 40 个全球国家'},
    {label:'接入电商平台',val:'41',sub:'货架 + 内容电商',pct:82,color:'#df6f3d',desc:'覆盖货架 + 内容全电商渠道'},
    {label:'有效商品数据',val:'299万+',sub:'日新增 8 万条',pct:75,color:'#4d946e',desc:'日新增 8 万条爆款数据'},
    {label:'政策 & 风险资讯',val:'2400+',sub:'每日实时更新',pct:90,color:'#c39142',desc:'每日实时更新各国新规'}
  ];
  var circ=2*Math.PI*26;
  $('#ov-metrics').innerHTML=metrics.map(function(m){
    var offset=circ-(circ*m.pct/100);
    return '<div class="ov-metric-card"><div class="ov-ring"><svg viewBox="0 0 64 64"><circle class="ring-bg" cx="32" cy="32" r="26"/><circle class="ring-fg" cx="32" cy="32" r="26" stroke="'+m.color+'" stroke-dasharray="'+circ+'" stroke-dashoffset="'+offset+'"/></svg><span class="ring-label">'+m.pct+'%</span></div><div class="ov-metric-info"><h3>'+m.label+'</h3><div class="ov-metric-val">'+m.val+'</div><div class="ov-metric-sub">'+m.sub+'</div><div class="ov-metric-desc">'+m.desc+'</div></div></div>';
  }).join('');
})();'''
html = html.replace(old_metric_render, new_metric_render)

# 3c. Replace trend SVG rendering with switchable version + AI button handler
old_trend_svg = '''// -- Block 2: SVG trend line --
(function(){
  var svg=$('#ov-trend-svg');
  var pts=[];
  var base=220,vals=[220,225,228,224,230,236,233,240,245,242,248,253,250,256,260,258,264,268,265,272,276,274,280,284,282,288,291,289,295,299];
  var w=800,h=100,pad=10;
  for(var i=0;i<vals.length;i++){
    var x=pad+i*(w-2*pad)/(vals.length-1);
    var y=h-pad-(vals[i]-210)/(310-210)*(h-2*pad);
    pts.push(x.toFixed(1)+','+y.toFixed(1));
  }
  var area=pts.join(' ')+' '+(w-pad)+','+(h-pad)+' '+pad+','+(h-pad);
  svg.innerHTML='<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3c6c62" stop-opacity="0.3"/><stop offset="100%" stop-color="#3c6c62" stop-opacity="0.02"/></linearGradient></defs><polygon points="'+area+'" fill="url(#trendGrad)"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="#3c6c62" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+pad+'" cy="'+(h-pad-(vals[0]-210)/(310-210)*(h-2*pad)).toFixed(1)+'" r="4" fill="#3c6c62"/><circle cx="'+(w-pad)+'" cy="'+(h-pad-(vals[vals.length-1]-210)/(310-210)*(h-2*pad)).toFixed(1)+'" r="4" fill="#df6f3d"/><text x="'+(pad+6)+'" y="'+(h-pad-(vals[0]-210)/(310-210)*(h-2*pad)-8).toFixed(1)+'" font-size="11" fill="#3c6c62" font-family="DM Mono">220万</text><text x="'+(w-pad-40)+'" y="'+(h-pad-(vals[vals.length-1]-210)/(310-210)*(h-2*pad)-8).toFixed(1)+'" font-size="11" fill="#df6f3d" font-family="DM Mono">299万</text>';
})();'''

new_trend_svg = '''// -- Block 2: SVG trend line (switchable) --
var ovTrendData={
  7:[289,295,299,291,288,295,299],
  30:[220,225,228,224,230,236,233,240,245,242,248,253,250,256,260,258,264,268,265,272,276,274,280,284,282,288,291,289,295,299],
  90:[180,185,188,192,190,195,198,196,200,205,202,208,212,210,215,218,216,220,225,228,224,230,236,233,240,245,242,248,253,250,256,260,258,264,268,265,272,276,274,280,284,282,288,291,289,295,299,285,278,272,268,275,280,276,282,288,285,290,294,291,296,299,288,282,278,285,290,286,292,296,293,298,295,299,288,280,275,282,288,284,290,295,292,298,299]
};
var ovTrendLabels={7:'近 7 日',30:'近 30 日',90:'近 90 日'};
var ovTrendConclusions={7:'近 7 日数据增量平稳，美妆类目持续领跑',30:'近 30 日全球美妆、家居类目商品数据增量涨幅最高',90:'近 90 日整体增幅超 66%，家居与美妆品类贡献最大增量'};
function renderTrendSVG(days){
  var svg=$('#ov-trend-svg');var vals=ovTrendData[days];
  var pts=[];var w=800,h=100,pad=10;
  var minV=Math.min.apply(null,vals)-10,maxV=Math.max.apply(null,vals)+10;
  for(var i=0;i<vals.length;i++){var x=pad+i*(w-2*pad)/(vals.length-1);var y=h-pad-(vals[i]-minV)/(maxV-minV)*(h-2*pad);pts.push(x.toFixed(1)+','+y.toFixed(1));}
  var area=pts.join(' ')+' '+(w-pad)+','+(h-pad)+' '+pad+','+(h-pad);
  var startV=vals[0],endV=vals[vals.length-1];
  svg.innerHTML='<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3c6c62" stop-opacity="0.3"/><stop offset="100%" stop-color="#3c6c62" stop-opacity="0.02"/></linearGradient></defs><polygon points="'+area+'" fill="url(#trendGrad)"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="#3c6c62" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+pad+'" cy="'+(h-pad-(vals[0]-minV)/(maxV-minV)*(h-2*pad)).toFixed(1)+'" r="4" fill="#3c6c62"/><circle cx="'+(w-pad)+'" cy="'+(h-pad-(vals[vals.length-1]-minV)/(maxV-minV)*(h-2*pad)).toFixed(1)+'" r="4" fill="#df6f3d"/><text x="'+(pad+6)+'" y="'+(h-pad-(vals[0]-minV)/(maxV-minV)*(h-2*pad)-8).toFixed(1)+'" font-size="11" fill="#3c6c62" font-family="DM Mono">'+startV+'万</text><text x="'+(w-pad-40)+'" y="'+(h-pad-(vals[vals.length-1]-minV)/(maxV-minV)*(h-2*pad)-8).toFixed(1)+'" font-size="11" fill="#df6f3d" font-family="DM Mono">'+endV+'万</text>';
  var badge=$('#ov-trend-badge');if(badge)badge.textContent=ovTrendLabels[days];
  var label=$('#ov-trend-range-label');if(label)label.textContent='起点 '+startV+' 万 → 终点 '+endV+' 万';
  var conclusion=$('#ov-trend-conclusion');if(conclusion)conclusion.textContent='📊 '+ovTrendConclusions[days];
}
renderTrendSVG(30);
$('#ov-trend-range').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;$$('.ov-trend-range button').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');renderTrendSVG(parseInt(btn.dataset.days));};
$('#ov-trend-ai-btn').onclick=function(){toast('AI 趋势分析：近 30 日全球美妆、家居类目数据增量涨幅最高，建议重点关注东南亚和欧美市场')};'''
html = html.replace(old_trend_svg, new_trend_svg)

# 3d. Replace opportunity tabs HTML with badges + risk tab styling
old_opp_tabs = '''<div class="ov-opp-tabs" id="ov-opp-tabs">
          <button class="ov-opp-tab active" data-tab="0">今日增长赛道</button>
          <button class="ov-opp-tab" data-tab="1">高潜力新市场</button>
          <button class="ov-opp-tab" data-tab="2">政策利好国家</button>
          <button class="ov-opp-tab" data-tab="3">风险预警市场</button>
        </div>'''
new_opp_tabs = '''<div class="ov-opp-tabs" id="ov-opp-tabs">
          <button class="ov-opp-tab active" data-tab="0">今日增长赛道 <span class="ov-opp-tab-badge">8</span></button>
          <button class="ov-opp-tab" data-tab="1">高潜力新市场 <span class="ov-opp-tab-badge">5</span></button>
          <button class="ov-opp-tab" data-tab="2">政策利好国家 <span class="ov-opp-tab-badge">6</span></button>
          <button class="ov-opp-tab risk-tab" data-tab="3">风险预警市场 <span class="ov-opp-tab-badge">12</span></button>
        </div>'''
html = html.replace(old_opp_tabs, new_opp_tabs)

# 3e. Replace renderOvOpp function with enhanced version (action buttons + subscribe)
old_render_opp = '''function renderOvOpp(idx){
  var d=ovOppData[idx];
  var html='<div class="ov-opp-title">'+d.title+'</div>';
  html+='<div class="ov-opp-stats">';
  d.stats.forEach(function(s){html+='<div class="ov-opp-stat"><div class="stat-icon">'+s.icon+'</div><span class="stat-val">'+s.val+'</span><span class="stat-label">'+s.label+'</span></div>'});
  html+='</div>';
  html+='<div class="ov-opp-actions"><button class="ov-opp-btn ov-opp-btn-primary" id="ov-opp-action1">查看完整品类数据 →</button><button class="ov-opp-btn ov-opp-btn-ghost" id="ov-opp-action2">下载市场机会报告</button></div>';
  $('#ov-opp-content').innerHTML=html;
  $('#ov-opp-action1').onclick=function(){toast('正在跳转至爆款雷达…');setTimeout(function(){switchPage('products')},800)};
  $('#ov-opp-action2').onclick=function(){toast('PRO 版功能：一键下载定制化市场分析报告')};
}'''

new_render_opp = '''var ovOppActions=[
  {btn:'查看爆款榜单 →',page:'products'},
  {btn:'进入国家档案 →',page:'countries'},
  {btn:'查看完整政策 →',page:'policies'},
  {btn:'查看政策 AI 解读 →',page:'policies'}
];
function renderOvOpp(idx){
  var d=ovOppData[idx];
  var isRisk=idx===3;
  var html='<div class="ov-opp-title">'+(isRisk?'<span class="risk-highlight">':'')+d.title+(isRisk?'</span>':'')+'</div>';
  html+='<div class="ov-opp-stats">';
  d.stats.forEach(function(s){
    var valHtml=s.val;
    if(isRisk&&(s.val.includes('145')||s.val.includes('12'))){valHtml='<span class="risk-highlight">'+s.val+'</span>';}
    html+='<div class="ov-opp-stat"><div class="stat-icon">'+s.icon+'</div><span class="stat-val">'+valHtml+'</span><span class="stat-label">'+s.label+'</span></div>';
  });
  html+='</div>';
  var act=ovOppActions[idx];
  html+='<div class="ov-opp-card-actions"><button class="ov-opp-btn ov-opp-btn-primary" id="ov-opp-action1">'+act.btn+'</button><button class="ov-opp-btn ov-opp-btn-ghost" id="ov-opp-action2">下载市场机会报告</button></div>';
  html+='<button class="ov-opp-subscribe-btn" id="ov-opp-subscribe">🔔 订阅该赛道提醒</button>';
  $('#ov-opp-content').innerHTML=html;
  $('#ov-opp-action1').onclick=function(){toast('正在跳转…');setTimeout(function(){switchPage(act.page)},600)};
  $('#ov-opp-action2').onclick=function(){toast('PRO 版功能：一键下载定制化市场分析报告')};
  $('#ov-opp-subscribe').onclick=function(){toast('已开启赛道提醒，市场异动将第一时间通知您')};
}'''
html = html.replace(old_render_opp, new_render_opp)

# 3f. Replace country rendering with AI tooltip + hot categories + policy tips + tag filters
old_render_countries = '''function renderOvCountries(region){
  var filtered=countries;
  if(region!=='全部'){
    var names=ovRegionMap[region]||[];
    filtered=countries.filter(function(c){return names.indexOf(c[1])!==-1});
  }
  $('#ov-country-grid').innerHTML=filtered.map(function(c){
    var name=c[1],flag=c[0],retail=c[3],growth=c[4],platform=c[5];
    var gNum=getGrowthNum(growth);
    var isHot=gNum>=15;
    var isRisk=hasRiskPolicy(name);
    var cardClass=isHot?'hot-card':(isRisk?'risk-card':'');
    var heatLabel=isHot?'HOT 高增长':(isRisk?'风险预警':'稳定市场');
    var heatClass=isHot?'hot':(isRisk?'risk':'stable');
    var macro=getMacroForCountry(name);
    var cats=ovCountrySpecificCats[name]||['综合品类'];
    var policy=getPolicyForCountry(name);
    var html='<article class="ov-ccard '+cardClass+'">';
    html+='<div class="ov-ccard-top"><span class="flag">'+flag+'</span><div><h3>'+name+'</h3></div><span class="ov-heat '+heatClass+'">'+heatLabel+'</span></div>';
    html+='<div class="ov-ccard-metrics"><div><span>线上零售规模</span><b>'+retail+'</b></div><div><span>GDP 增速</span><b'+(macro.gdp!=='—'?' style="color:#478067"':'')+'>'+macro.gdp+'</b></div><div><span>CPI 通胀</span><b>'+macro.cpi+'</b></div></div>';
    html+='<div class="ov-ccard-cats">'+cats.slice(0,3).map(function(ct){return '<span>'+ct+'</span>'}).join('')+'</div>';
    if(policy)html+='<div class="ov-ccard-policy">📋 '+policy+'</div>';
    html+='<button class="ov-ccard-btn" data-page="countries">进入国家全景库 →</button>';
    html+='</article>';
    return html;
  }).join('');
  // Bind country card click
  $$('#ov-country-grid .ov-ccard-btn').forEach(function(btn){
    btn.onclick=function(e){e.stopPropagation();switchPage('countries')};
  });
  $$('#ov-country-grid .ov-ccard').forEach(function(card){
    card.onclick=function(){switchPage('countries')};
    card.style.cursor='pointer';
  });
}'''

new_render_countries = '''var ovAiTips={'印度尼西亚':'政策利好美妆品类，建议优先布局本土店模式','越南':'GDP增速6.5%领跑东南亚，电商渗透率快速提升中','泰国':'竞争趋于饱和，建议聚焦小众品类差异化','马来西亚':'数字服务税新规需关注，合规成本上升','菲律宾':'增速20%但基础设施薄弱，轻资产试水为宜','新加坡':'成熟市场客单高，适合品牌化打法','美国':'对华关税145%全品类承压，建议海外仓+差异化','日本':'消费饱和但跨境电商接受度高，适合精品路线','韩国':'内容电商渗透率高，短视频带货效果好','沙特阿拉伯':'VAT 15%+SABER认证门槛高，但客单价优秀','阿联酋':'5%低增值税+自由贸易区优势，中东首选落地','巴西':'Remessa Conforme新规50$以下征20%税，成本上升','墨西哥':'近岸外包趋势利好，美客多份额领先','印度':'GDP 6.8%高增但FDI限制严格，需走平台模式','尼日利亚':'通胀33.7%汇率风险大，谨慎控制库存','南非':'基础设施非洲领先，适合试水非消品类'};
var ovTagMap={'高增长':function(c){return getGrowthNum(c[4])>=15},'政策风险':function(c){return hasRiskPolicy(c[1])},'稳定市场':function(c){return getGrowthNum(c[4])<15&&!hasRiskPolicy(c[1])}};
var ovCurrentTag='全部';
$('#ov-tag-filters').innerHTML=['全部','高增长','政策风险','稳定市场'].map(function(t,i){return '<button class="ov-tag-btn'+(i===0?' active':'')+'" data-tag="'+t+'">'+t+'</button>'}).join('');
function renderOvCountries(region,tag){
  var filtered=countries;
  if(region!=='全部'){var names=ovRegionMap[region]||[];filtered=countries.filter(function(c){return names.indexOf(c[1])!==-1});}
  if(tag&&tag!=='全部'&&ovTagMap[tag]){filtered=filtered.filter(ovTagMap[tag]);}
  $('#ov-country-grid').innerHTML=filtered.map(function(c){
    var name=c[1],flag=c[0],retail=c[3],growth=c[4],platform=c[5];
    var gNum=getGrowthNum(growth);
    var isHot=gNum>=15;
    var isRisk=hasRiskPolicy(name);
    var cardClass=isHot?'hot-card':(isRisk?'risk-card':'');
    var heatLabel=isHot?'HOT 高增长':(isRisk?'风险预警':'稳定市场');
    var heatClass=isHot?'hot':(isRisk?'risk':'stable');
    var macro=getMacroForCountry(name);
    var cats=ovCountrySpecificCats[name]||['综合品类'];
    var policy=getPolicyForCountry(name);
    var aiTip=ovAiTips[name]||'';
    var html='<article class="ov-ccard '+cardClass+'">';
    if(aiTip)html+='<span class="ov-ccard-ai-icon" data-tip="'+aiTip.replace(/"/g,'&quot;')+'">✨</span>';
    html+='<div class="ov-ccard-top"><span class="flag">'+flag+'</span><div><h3>'+name+'</h3></div><span class="ov-heat '+heatClass+'">'+heatLabel+'</span></div>';
    html+='<div class="ov-ccard-metrics"><div><span>线上零售规模</span><b>'+retail+'</b></div><div><span>GDP 增速</span><b'+(macro.gdp!=='—'?' style="color:#478067"':'')+'>'+macro.gdp+'</b></div><div><span>CPI 通胀</span><b>'+macro.cpi+'</b></div></div>';
    html+='<div class="ov-ccard-cats">'+cats.slice(0,3).map(function(ct){return '<span>'+ct+'</span>'}).join('')+'</div>';
    if(policy)html+='<div class="ov-ccard-policy">📋 '+policy+'</div>';
    html+='<button class="ov-ccard-btn" data-page="countries">进入国家全景库 →</button>';
    html+='</article>';
    return html;
  }).join('');
  $$('#ov-country-grid .ov-ccard-btn').forEach(function(btn){btn.onclick=function(e){e.stopPropagation();switchPage('countries')};});
  $$('#ov-country-grid .ov-ccard').forEach(function(card){
    card.onclick=function(){switchPage('countries')};card.style.cursor='pointer';
  });
  $$('#ov-country-grid .ov-ccard-ai-icon').forEach(function(icon){
    icon.onmouseenter=function(e){
      e.stopPropagation();
      var tip=this.getAttribute('data-tip');
      var old=this.parentNode.querySelector('.ov-ai-tooltip');if(old)old.remove();
      var div=document.createElement('div');div.className='ov-ai-tooltip';div.innerHTML='✨ <b>AI 建议</b><br>'+tip;
      this.parentNode.appendChild(div);
    };
    icon.onmouseleave=function(e){var t=this.parentNode.querySelector('.ov-ai-tooltip');if(t)t.remove();};
    icon.onclick=function(e){e.stopPropagation();};
  });
}
renderOvCountries('全部','全部');
$('#ov-tag-filters').onclick=function(e){var btn=e.target.closest('.ov-tag-btn');if(!btn)return;$$('.ov-tag-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');ovCurrentTag=btn.dataset.tag;var activeRegion=$('.ov-region-btn.active');renderOvCountries(activeRegion?activeRegion.dataset.region:'全部',ovCurrentTag);};'''
html = html.replace(old_render_countries, new_render_countries)

# Update the region filter handler to also pass tag
old_region_handler = '''$('#ov-country-filters').onclick=function(e){
  var btn=e.target.closest('.ov-region-btn');
  if(!btn)return;
  $$('.ov-region-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  renderOvCountries(btn.dataset.region);
};'''
new_region_handler = '''$('#ov-country-filters').onclick=function(e){
  var btn=e.target.closest('.ov-region-btn');
  if(!btn)return;
  $$('.ov-region-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  renderOvCountries(btn.dataset.region,ovCurrentTag);
};'''
html = html.replace(old_region_handler, new_region_handler)

# 3g. Add AI diagnosis card rendering + AI advisor + ticker tabs after the AI insight rendering
# Find the end of the script to add new code
old_script_end = """// 渲染所有页面的AI洞察
['products','countries','shops','platforms','macro','policies','rules','content'].forEach(renderAIInsight);

</script>"""

new_script_end = """// 渲染所有页面的AI洞察
['products','countries','shops','platforms','macro','policies','rules','content'].forEach(renderAIInsight);

// === Round 2: AI Diagnosis Card ===
(function(){
  var el=$('#ov-ai-diagnosis');
  if(!el)return;
  el.innerHTML='<h4>✨ AI 全球市场综合诊断 <span class="pro-badge">PRO</span></h4><ul><li>🌍 <b>推荐拓国：</b>越南（GDP 6.5%，电商增速 34.8%）</li><li>🔥 <b>潜力赛道：</b>美妆个护（TikTok Shop GMV 增速 52%）</li><li>⚠️ <b>市场风险：</b>美国对华关税 145%，全品类成本承压</li></ul>';
})();

// === Round 2: AI Advisor Dialog ===
(function(){
  var btn=$('#ai-advisor-btn'),dialog=$('#ai-advisor-dialog'),close=$('#ai-adv-close');
  btn.onclick=function(){dialog.classList.toggle('open')};
  close.onclick=function(){dialog.classList.remove('open')};
  dialog.querySelectorAll('.adv-q').forEach(function(q){
    q.onclick=function(){toast('PRO 版功能：AI 智能顾问为您提供个性化市场洞察');dialog.classList.remove('open')};
  });
  document.addEventListener('click',function(e){
    if(!dialog.contains(e.target)&&e.target!==btn){dialog.classList.remove('open')}
  });
})();

// === Round 2: Ticker Tabs ===
(function(){
  var tabsEl=$('#ticker-tabs');
  if(!tabsEl)return;
  tabsEl.onclick=function(e){
    var tab=e.target.closest('.ticker-tab');
    if(!tab)return;
    tabsEl.querySelectorAll('.ticker-tab').forEach(function(t){t.classList.remove('active')});
    tab.classList.add('active');
    var filter=tab.dataset.ttab;
    var items=document.querySelectorAll('.ticker-item');
    items.forEach(function(item){
      var tags=item.querySelector('.t-tags');
      var tagText=tags?tags.textContent:'';
      var show=true;
      if(filter==='platform')show=tagText.includes('Shopee')||tagText.includes('TikTok')||tagText.includes('Amazon')||tagText.includes('Lazada')||tagText.includes('Noon')||tagText.includes('Temu')||tagText.includes('SHEIN')||tagText.includes('AliExpress');
      else if(filter==='policy')show=!tagText.includes('Shopee')&&!tagText.includes('TikTok')&&!tagText.includes('Amazon')&&!tagText.includes('Lazada')||tagText.includes('政策');
      else if(filter==='category')show=tagText.includes('美妆')||tagText.includes('家居')||tagText.includes('3C')||tagText.includes('服饰');
      item.style.display=show?'':'none';
    });
  };
})();

// === Round 2: Ticker badge count ===
(function(){
  var btn=document.getElementById('ticker-btn');
  if(btn&&!btn.querySelector('.ticker-badge')){
    var badge=document.createElement('span');badge.className='ticker-badge';badge.textContent=alerts.length;
    btn.style.position='fixed';badge.setAttribute('id','ticker-badge-count');
    btn.appendChild(badge);
  }
})();

</script>"""
html = html.replace(old_script_end, new_script_end)

# Write the result
with open('/app/data/所有对话/主对话/mercator_rework/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Round 2 modifications applied successfully!")
print(f"File size: {len(html)} bytes")
