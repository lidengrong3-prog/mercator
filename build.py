import re

# Read the original file
with open('/app/data/所有对话/主对话/mercator_rework/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ==========================================
# 1. NEW CSS to add before </style>
# ==========================================
new_css = """
/* === Overview Rework: Block 1 - Welcome & CTA === */
.ov-welcome{display:flex;justify-content:space-between;align-items:stretch;gap:20px;background:linear-gradient(135deg,#1c2b29 0%,#2c4a44 60%,#3c6c62 100%);border-radius:8px;padding:28px 32px;margin-bottom:22px;color:#fff;position:relative;overflow:hidden}
.ov-welcome::after{content:'M';position:absolute;right:-30px;bottom:-50px;font:220px 'Playfair Display';opacity:.05;color:#fff;pointer-events:none}
.ov-welcome-left{flex:1.2;display:flex;flex-direction:column;justify-content:center}
.ov-welcome-left .ov-greeting{font:27px 'Playfair Display';margin-bottom:6px;letter-spacing:-.3px}
.ov-welcome-left .ov-greeting span{color:#f3a173}
.ov-welcome-left .ov-value{font-size:12.5px;color:#b3c6bd;line-height:1.7;max-width:480px}
.ov-welcome-right{display:flex;gap:10px;align-items:center;flex-wrap:wrap;position:relative;z-index:1}
.ov-cta{border:0;border-radius:5px;padding:10px 16px;font-family:inherit;font-size:12px;cursor:pointer;transition:.2s;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.ov-cta-primary{background:#df6f3d;color:#fff}
.ov-cta-primary:hover{background:#c75f30}
.ov-cta-outline{background:transparent;color:#eef2eb;border:1px solid rgba(255,255,255,.25)}
.ov-cta-outline:hover{background:rgba(255,255,255,.1)}

/* === Overview Rework: Block 2 - Data Dashboard === */
.ov-dashboard{margin-bottom:22px}
.ov-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:18px}
.ov-metric-card{background:#fff;border:1px solid var(--line);border-radius:6px;padding:20px;display:flex;align-items:center;gap:18px;transition:.2s}
.ov-metric-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(28,43,41,.08)}
.ov-ring{position:relative;width:64px;height:64px;flex-shrink:0}
.ov-ring svg{transform:rotate(-90deg)}
.ov-ring .ring-bg{fill:none;stroke:#eef2eb;stroke-width:6}
.ov-ring .ring-fg{fill:none;stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset .8s ease}
.ov-ring .ring-label{position:absolute;inset:0;display:grid;place-items:center;font:bold 14px 'DM Mono';color:var(--ink)}
.ov-metric-info h3{font-size:13px;margin:0 0 3px;color:var(--ink)}
.ov-metric-info .ov-metric-val{font:bold 24px 'Playfair Display';color:var(--ink);letter-spacing:-.5px}
.ov-metric-info .ov-metric-sub{font:10px 'DM Mono';color:var(--muted);margin-top:2px}
.ov-trend-card{background:#fff;border:1px solid var(--line);border-radius:6px;padding:22px 26px}
.ov-trend-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.ov-trend-header h3{font-size:14px;margin:0}
.ov-trend-header .ov-trend-badge{font:10px 'DM Mono';background:#eaf2ed;color:#39735c;padding:3px 8px;border-radius:10px}
.ov-trend-svg{width:100%;height:100px}
.ov-trend-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.ov-trend-foot small{font:10px 'DM Mono';color:var(--muted)}
.ov-data-source{text-align:right;font:10px 'DM Mono';color:#a0aba6;margin-top:8px}

/* === Overview Rework: Block 3 - Market Opportunities === */
.ov-opportunities{background:linear-gradient(135deg,#1c2b29 0%,#2c4a44 40%,#3c6c62 100%);border-radius:8px;padding:26px 30px;margin-bottom:22px;color:#fff;position:relative;overflow:hidden}
.ov-opportunities::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(223,111,61,.12),transparent 70%);pointer-events:none}
.ov-opp-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.ov-opp-head h2{font:20px 'Playfair Display';margin:0;color:#fff}
.ov-opp-head .eyebrow{color:#7a9a8e}
.ov-opp-tabs{display:flex;gap:0;margin-bottom:18px;border-bottom:1px solid rgba(255,255,255,.12)}
.ov-opp-tab{background:none;border:0;color:#8aaa9e;padding:10px 18px 12px;font-family:inherit;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;transition:.2s}
.ov-opp-tab:hover{color:#dce4db}
.ov-opp-tab.active{color:#f3a173;border-bottom-color:#f3a173;font-weight:600}
.ov-opp-content{min-height:140px}
.ov-opp-title{font:22px 'Playfair Display';margin-bottom:14px;color:#fff}
.ov-opp-title em{font-style:normal;color:#f3a173}
.ov-opp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.ov-opp-stat{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:14px 16px;text-align:center}
.ov-opp-stat .stat-icon{font-size:20px;margin-bottom:6px}
.ov-opp-stat .stat-val{display:block;font:bold 18px 'DM Mono';color:#fff;margin-bottom:2px}
.ov-opp-stat .stat-label{font-size:10px;color:#8aaa9e}
.ov-opp-actions{display:flex;gap:12px;margin-top:6px}
.ov-opp-btn{border:0;border-radius:4px;padding:9px 18px;font-family:inherit;font-size:12px;cursor:pointer;transition:.2s}
.ov-opp-btn-primary{background:#df6f3d;color:#fff}
.ov-opp-btn-primary:hover{background:#c75f30}
.ov-opp-btn-ghost{background:transparent;color:#b3c6bd;border:1px solid rgba(255,255,255,.2)}
.ov-opp-btn-ghost:hover{background:rgba(255,255,255,.08)}

/* === Overview Rework: Block 4 - Country Overview === */
.ov-countries{margin-bottom:22px}
.ov-country-filters{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
.ov-region-btn{border:1px solid var(--line);background:#fff;border-radius:20px;padding:6px 16px;font-family:inherit;font-size:11px;cursor:pointer;color:var(--muted);transition:.2s}
.ov-region-btn:hover{border-color:#aebbb3;color:var(--ink)}
.ov-region-btn.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.ov-country-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}
.ov-ccard{background:#fff;border:1px solid var(--line);border-radius:6px;padding:18px;transition:.2s;position:relative;overflow:hidden}
.ov-ccard:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(28,43,41,.08)}
.ov-ccard.hot-card{border-color:#4d946e;border-width:2px}
.ov-ccard.risk-card{border-color:#dc7140;border-left:3px solid #dc7140}
.ov-ccard-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.ov-ccard-top .flag{font-size:24px}
.ov-ccard-top h3{font-size:15px;margin:0 0 2px}
.ov-ccard-top .ov-heat{font:9px 'DM Mono';padding:2px 7px;border-radius:10px;font-weight:600}
.ov-heat.hot{background:#eaf2ed;color:#39735c}
.ov-heat.risk{background:#fce8e0;color:#b95532}
.ov-heat.stable{background:#f4f2ed;color:#8a8578}
.ov-ccard-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:12px 0;padding:10px 0;border-top:1px solid #eee;border-bottom:1px solid #eee}
.ov-ccard-metrics div{text-align:center}
.ov-ccard-metrics span{display:block;font:9px 'DM Mono';color:var(--muted);margin-bottom:2px}
.ov-ccard-metrics b{font:11px 'DM Mono';color:var(--ink)}
.ov-ccard-metrics .growth b{color:#478067}
.ov-ccard-cats{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0}
.ov-ccard-cats span{background:#f4f2ed;color:#6b7b73;font:9px 'DM Mono';padding:2px 6px;border-radius:3px}
.ov-ccard-policy{font:10px 'DM Mono';color:#9aa29e;margin:6px 0 10px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ov-ccard-btn{border:0;background:none;color:var(--green);font:11px 'Noto Sans SC';cursor:pointer;padding:0;font-weight:600}
.ov-ccard-btn:hover{color:#2c5249}

/* === Overview Rework: Block 5 - Trust Footer === */
.ov-trust{background:#fff;border:1px solid var(--line);border-radius:6px;padding:26px 30px;display:grid;grid-template-columns:1fr 1.3fr .7fr;gap:28px;align-items:start}
.ov-trust-col h4{font-size:13px;margin:0 0 10px;color:var(--ink)}
.ov-trust-col p{font-size:11.5px;color:#65726d;margin:4px 0;line-height:1.6}
.ov-trust-col .trust-icon{font-size:16px;margin-right:6px;vertical-align:middle}
.ov-trust-col ul{margin:0;padding:0 0 0 0;list-style:none}
.ov-trust-col li{font-size:11.5px;color:#52605b;line-height:1.8;padding-left:16px;position:relative}
.ov-trust-col li::before{content:'✓';position:absolute;left:0;color:var(--green);font-weight:700;font-size:11px}
.ov-trust-cta{display:flex;align-items:center;justify-content:center;height:100%}
.ov-trust-cta button{background:var(--ink);color:#fff;border:0;border-radius:5px;padding:12px 20px;font-family:inherit;font-size:12px;cursor:pointer;transition:.2s;white-space:nowrap}
.ov-trust-cta button:hover{background:#31423e}

/* === Overview Responsive === */
@media(max-width:1000px){
  .ov-welcome{flex-direction:column}
  .ov-metrics{grid-template-columns:repeat(2,1fr)}
  .ov-opp-stats{grid-template-columns:repeat(2,1fr)}
  .ov-country-grid{grid-template-columns:repeat(2,1fr)}
  .ov-trust{grid-template-columns:1fr}
}
@media(max-width:700px){
  .ov-metrics{grid-template-columns:1fr}
  .ov-opp-stats{grid-template-columns:1fr 1fr}
  .ov-country-grid{grid-template-columns:1fr}
  .ov-welcome-right{flex-direction:column}
  .ov-opp-tabs{overflow-x:auto;flex-wrap:nowrap}
  .ov-opp-tab{white-space:nowrap;font-size:11px;padding:8px 12px}
}
"""

# Insert new CSS before </style>
content = content.replace('</style>', new_css + '</style>')

# ==========================================
# 2. NEW Overview HTML
# ==========================================
new_overview_html = """<section id="overview" class="page active">
      <!-- Block 1: Welcome + CTA -->
      <div class="ov-welcome">
        <div class="ov-welcome-left">
          <div class="ov-greeting">早上好，<span>陆安然</span></div>
          <p class="ov-value">一站式全球多平台电商情报工具，覆盖 26 国 41 个货架/内容电商平台，微观爆款 + 国家宏观市场一体化查询。从选品到合规，全链路数据驱动决策。</p>
        </div>
        <div class="ov-welcome-right">
          <button class="ov-cta ov-cta-outline" id="ov-search-btn">⌕ 全局搜索</button>
          <button class="ov-cta ov-cta-primary" id="ov-trial-btn">免费试用 / 功能演示</button>
          <button class="ov-cta ov-cta-outline" id="ov-sales-btn">联系销售定制方案</button>
          <button class="ov-cta ov-cta-outline" id="ov-export-btn">↓ 导出报告</button>
        </div>
      </div>

      <!-- Block 2: Data Dashboard -->
      <div class="ov-dashboard">
        <div class="ov-metrics" id="ov-metrics"></div>
        <div class="ov-trend-card">
          <div class="ov-trend-header">
            <h3>全球爆款数据增量趋势</h3>
            <span class="ov-trend-badge">近 30 日</span>
          </div>
          <svg class="ov-trend-svg" id="ov-trend-svg" viewBox="0 0 800 100" preserveAspectRatio="none"></svg>
          <div class="ov-trend-foot">
            <small>日均新增 8 万条商品数据</small>
            <small>起点 220 万 → 终点 299 万</small>
          </div>
        </div>
        <div class="ov-data-source">数据来源：第三方官方 API + 各国统计局公开数据 · 合规采集</div>
      </div>

      <!-- Block 3: Today Market Opportunities -->
      <div class="ov-opportunities">
        <div class="ov-opp-head">
          <div>
            <p class="eyebrow">MARKET OPPORTUNITIES</p>
            <h2>今日市场机会</h2>
          </div>
        </div>
        <div class="ov-opp-tabs" id="ov-opp-tabs">
          <button class="ov-opp-tab active" data-tab="0">今日增长赛道</button>
          <button class="ov-opp-tab" data-tab="1">高潜力新市场</button>
          <button class="ov-opp-tab" data-tab="2">政策利好国家</button>
          <button class="ov-opp-tab" data-tab="3">风险预警市场</button>
        </div>
        <div class="ov-opp-content" id="ov-opp-content"></div>
      </div>

      <!-- Block 4: Country Overview with Filters -->
      <div class="ov-countries">
        <div class="section-heading">
          <div>
            <p class="eyebrow">COUNTRY MARKET OVERVIEW</p>
            <h2>重点国家市场总览</h2>
          </div>
          <button class="text-button" data-page="countries">所有国家 →</button>
        </div>
        <div class="ov-country-filters" id="ov-country-filters"></div>
        <div class="ov-country-grid" id="ov-country-grid"></div>
      </div>

      <!-- Block 5: Trust Footer -->
      <div class="ov-trust">
        <div class="ov-trust-col">
          <h4><span class="trust-icon">🛡</span>信任背书</h4>
          <p><span class="trust-icon">🏢</span>已服务 <b>120+</b> 跨境工厂与代运营团队</p>
          <p><span class="trust-icon">🌍</span>覆盖全球 <b>26 国 41 个</b>主流电商平台</p>
          <p><span class="trust-icon">📊</span>累计处理 <b>299 万+</b> 条商品实时数据</p>
        </div>
        <div class="ov-trust-col">
          <h4>核心差异化优势</h4>
          <ul>
            <li>不止 TikTok Shop：货架 + 内容全平台聚合</li>
            <li>独家国家宏观数据库：人口 / 经济 / 关税 / 政策一体化查询</li>
            <li>小时级爆款实时监测 + 政策异动预警</li>
            <li>跨市场品类热度对比，一站式发现增长机会</li>
          </ul>
        </div>
        <div class="ov-trust-col ov-trust-cta">
          <button id="ov-plan-btn">查看套餐与权益对比 →</button>
        </div>
      </div>
    </section>"""

# Replace the overview section
# Find the start and end of the overview section
overview_start = content.find('<section id="overview" class="page active">')
overview_end = content.find('<section id="products"', overview_start)
content = content[:overview_start] + new_overview_html + '\n\n    ' + content[overview_end:]

# ==========================================
# 3. NEW JS: Replace old overview rendering with new logic
# ==========================================

# Remove the old country-grid rendering line
old_country_render = "$('#country-grid').innerHTML=countries.map((c,i)=>`<article class=\"country-card\" data-page=\"countries\"><div class=\"country-top\"><span class=\"flag\">${c[0]}</span><span class=\"tag ${i===1?'hot':'watch'}\">${i===1?'HOT':'追踪中'}</span></div><h3>${c[1]}</h3><p>${c[2]}</p><div class=\"country-row\"><span>线上零售规模<br><b>${c[3]}</b></span><span class=\"growth\">30日增长<br><b>${c[4]}</b></span></div><p style=\"margin-top:11px\">${c[5]}</p></article>`).join('');"
content = content.replace(old_country_render, '// [Overview rework: country grid moved to new renderer below]')

# Remove the old alert-list rendering (keep alertMarkup function and alerts-full)
old_alert_overview = "$('#alert-list').innerHTML=alertMarkup();"
content = content.replace(old_alert_overview, '// [Overview rework: alert-list removed, alerts-full kept]')

# Add new overview JS before the page switch function
new_overview_js = """
// === Overview Rework: New Rendering Logic ===

// -- Block 1 CTA handlers --
$('#ov-search-btn').onclick=function(){var s=$('#global-search');if(s){s.focus();s.scrollIntoView({behavior:'smooth',block:'center'})}};
$('#ov-trial-btn').onclick=function(){toast('已提交试用申请，我们将在 24 小时内联系您')};
$('#ov-sales-btn').onclick=function(){toast('已记录您的需求，销售团队将尽快与您联系')};
$('#ov-export-btn').onclick=function(){toast('PRO 版功能：一键生成定制化市场分析报告')};
$('#ov-plan-btn').onclick=function(){toast('即将跳转至套餐页面…')};

// -- Block 2: Metric cards with ring charts --
(function(){
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
})();

// -- Block 2: SVG trend line --
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
})();

// -- Block 3: Tabbed opportunities --
var ovOppData=[
  {
    title:'东南亚美妆品类 7 日 GMV 增幅 <em>+42.8%</em>',
    stats:[
      {icon:'🏪',val:'8 个',label:'涉及平台'},
      {icon:'🔥',val:'3 个',label:'爆发单品'},
      {icon:'📦',val:'5 个',label:'头部带货店铺'},
      {icon:'📋',val:'利好',label:'本土关税政策'}
    ]
  },
  {
    title:'非洲 & 拉美市场电商增速领跑 <em>+25%~42%</em>',
    stats:[
      {icon:'🌍',val:'6 国',label:'高增长市场'},
      {icon:'📈',val:'+45%',label:'尼日利亚 GMV 增速'},
      {icon:'🏪',val:'12 个',label:'活跃店铺'},
      {icon:'💡',val:'蓝海',label:'市场竞争度'}
    ]
  },
  {
    title:'越南/菲律宾 GDP 增速领先 <em>5.8%~6.5%</em>',
    stats:[
      {icon:'📋',val:'5 项',label:'利好政策'},
      {icon:'🇻🇳',val:'6.5%',label:'越南 GDP 增速'},
      {icon:'🇵🇭',val:'5.8%',label:'菲律宾 GDP 增速'},
      {icon:'💰',val:'10%',label:'越南 VAT 税率'}
    ]
  },
  {
    title:'美国对华关税升至 145% · <em>全品类影响</em>',
    stats:[
      {icon:'⚠️',val:'12 项',label:'高风险政策'},
      {icon:'🇺🇸',val:'145%',label:'对华关税税率'},
      {icon:'🇮🇩',val:'取消',label:'印尼免税门槛'},
      {icon:'🇮🇳',val:'收紧',label:'印度 FDI 限制'}
    ]
  }
];
function renderOvOpp(idx){
  var d=ovOppData[idx];
  var html='<div class="ov-opp-title">'+d.title+'</div>';
  html+='<div class="ov-opp-stats">';
  d.stats.forEach(function(s){html+='<div class="ov-opp-stat"><div class="stat-icon">'+s.icon+'</div><span class="stat-val">'+s.val+'</span><span class="stat-label">'+s.label+'</span></div>'});
  html+='</div>';
  html+='<div class="ov-opp-actions"><button class="ov-opp-btn ov-opp-btn-primary" id="ov-opp-action1">查看完整品类数据 →</button><button class="ov-opp-btn ov-opp-btn-ghost" id="ov-opp-action2">下载市场机会报告</button></div>';
  $('#ov-opp-content').innerHTML=html;
  $('#ov-opp-action1').onclick=function(){toast('正在跳转至爆款雷达…');setTimeout(function(){switchPage('products')},800)};
  $('#ov-opp-action2').onclick=function(){toast('PRO 版功能：一键下载定制化市场分析报告')};
}
renderOvOpp(0);
$('#ov-opp-tabs').onclick=function(e){
  var tab=e.target.closest('.ov-opp-tab');
  if(!tab)return;
  $$('.ov-opp-tab').forEach(function(t){t.classList.remove('active')});
  tab.classList.add('active');
  renderOvOpp(parseInt(tab.dataset.tab));
};

// -- Block 4: Country overview with region filters --
var ovRegionMap={
  '东南亚':['印度尼西亚','越南','泰国','马来西亚','菲律宾','新加坡'],
  '欧美':['加拿大','法国','意大利','西班牙','荷兰','澳大利亚','美国','英国','德国'],
  '日韩':['日本','韩国'],
  '中东':['沙特阿拉伯','阿联酋'],
  '拉美':['巴西','墨西哥'],
  '非洲':['尼日利亚','南非','埃及'],
  '南亚':['印度']
};
var ovRegions=['全部','东南亚','欧美','日韩','中东','拉美','非洲','南亚'];

// Country name to macroData short name mapping
var ovCountryMacroMap={'印度尼西亚':'印尼','美国':'美国','越南':'越南','泰国':'泰国','马来西亚':'马来西亚','菲律宾':'菲律宾','沙特阿拉伯':'沙特','阿联酋':'阿联酋','巴西':'巴西','墨西哥':'墨西哥','日本':'日本','韩国':'韩国','德国':'德国','英国':'英国','法国':'法国','印度':'印度','尼日利亚':'尼日利亚','埃及':'埃及','南非':'南非','加拿大':'加拿大','意大利':'意大利','西班牙':'西班牙','荷兰':'荷兰','澳大利亚':'澳大利亚','俄罗斯':'俄罗斯','新加坡':'新加坡'};

// Categories per country from products data
var ovCountryCats={};
products.forEach(function(p){
  var region=p[2];
  var cats=ovCountryCats[region]||(ovCountryCats[region]=[]);
  if(cats.indexOf(p[4])===-1&&cats.length<5)cats.push(p[4]);
});

// Assign categories to countries by their primary platform region
var ovCountrySpecificCats={
  '印度尼西亚':['美妆个护','服饰鞋包','家居日用'],
  '越南':['3C数码','美妆个护','家居家电'],
  '泰国':['美妆个护','服饰鞋包','食品饮料'],
  '马来西亚':['美妆个护','家居日用','3C数码'],
  '菲律宾':['美妆个护','服饰鞋包','母婴用品'],
  '新加坡':['3C数码','美妆个护','家居家电'],
  '美国':['家居家装','美妆个护','3C数码'],
  '英国':['家居家装','美妆个护','运动户外'],
  '德国':['消费电子','家用电器','时尚服饰'],
  '法国':['消费电子','美妆个护','时尚服饰'],
  '加拿大':['日用百货','电子产品','家居'],
  '意大利':['消费电子','家居家电','美妆个护'],
  '西班牙':['消费电子','家居家电','美妆个护'],
  '荷兰':['消费电子','家居家电','美妆个护'],
  '澳大利亚':['家居家电','运动户外','3C数码'],
  '日本':['家居家装','美妆个护','3C数码'],
  '韩国':['美妆个护','服饰鞋包','家居家电'],
  '沙特阿拉伯':['美妆个护','3C数码','汽车配件'],
  '阿联酋':['美妆个护','3C数码','时尚服饰'],
  '巴西':['3C数码','家居家电','美妆个护'],
  '墨西哥':['3C数码','家居家电','时尚服饰'],
  '印度':['3C数码','服饰鞋包','家居家电'],
  '尼日利亚':['电子产品','时尚服饰','美妆个护'],
  '南非':['电子产品','家居园艺','运动户外'],
  '埃及':['电子产品','时尚服饰','美妆个护'],
  '俄罗斯':['时尚服饰','家居用品','美妆个护']
};

// Get GDP/CPI for a country from macroData
function getMacroForCountry(name){
  var short=ovCountryMacroMap[name];
  if(!short)return{gdp:'—',cpi:'—'};
  var gdp='—',cpi='—';
  macroData.forEach(function(m){
    if(m[0]===short){
      if(m[1]==='GDP增速(%)')gdp=m[2]+'%';
      if(m[1]==='CPI通胀率(%)')cpi=m[2]+'%';
    }
  });
  return{gdp:gdp,cpi:cpi};
}

// Get latest policy for a country from policyData
function getPolicyForCountry(name){
  var short=ovCountryMacroMap[name];
  if(!short)return '';
  var found='';
  policyData.forEach(function(p){
    if(p[1]===short&&!found)found=p[0];
  });
  return found;
}

// Check if country has negative policies
function hasRiskPolicy(name){
  var short=ovCountryMacroMap[name];
  if(!short)return false;
  var risk=false;
  policyData.forEach(function(p){
    if(p[1]===short&&p[3]==='重大')risk=true;
  });
  return risk;
}

function getGrowthNum(growthStr){
  var n=parseFloat(growthStr.replace(/[+%]/g,''));
  return isNaN(n)?0:n;
}

// Render region filter buttons
$('#ov-country-filters').innerHTML=ovRegions.map(function(r,i){
  return '<button class="ov-region-btn'+(i===0?' active':'')+'" data-region="'+r+'">'+r+'</button>';
}).join('');

function renderOvCountries(region){
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
}
renderOvCountries('全部');
$('#ov-country-filters').onclick=function(e){
  var btn=e.target.closest('.ov-region-btn');
  if(!btn)return;
  $$('.ov-region-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  renderOvCountries(btn.dataset.region);
};

"""

# Insert the new overview JS before the page switch function
page_switch_marker = "// === 页面切换 ==="
content = content.replace(page_switch_marker, new_overview_js + page_switch_marker)

# Write the new file
with open('/app/data/所有对话/主对话/mercator_rework/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("File written successfully")
print("File size:", len(content), "chars")
