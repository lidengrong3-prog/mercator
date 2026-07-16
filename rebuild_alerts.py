#!/usr/bin/env python3
"""Rebuild the Mercator Alerts Center page with full functionality."""

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# ============================================================
# 1. CSS - Insert before </style> at L583 (index 582)
# ============================================================
alerts_css = """
/* ========== ALERTS CENTER ========== */
.al-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px}
.al-title-group{display:flex;align-items:center;gap:12px}
.al-title-group h2{font-size:20px;font-weight:700;color:var(--ink);margin:0}
.al-title-group .al-badge{background:#dc7140;color:#fff;font:bold 11px 'DM Mono';padding:2px 8px;border-radius:10px}
.al-search{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:6px;padding:6px 12px;min-width:220px}
.al-search input{border:0;outline:0;font:13px 'Noto Sans SC';background:transparent;flex:1;color:var(--ink)}
.al-search input::placeholder{color:#aaa}
.al-toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.al-filter-select{font:12px 'Noto Sans SC';padding:6px 10px;border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink);cursor:pointer}
.al-filter-select:focus{outline:none;border-color:var(--orange)}
.al-btn{font:12px 'Noto Sans SC';padding:6px 14px;border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink);cursor:pointer;transition:.2s}
.al-btn:hover{border-color:var(--orange);color:var(--orange)}
.al-btn-primary{background:var(--orange);color:#fff;border-color:var(--orange)}
.al-btn-primary:hover{background:#c85e2e;border-color:#c85e2e;color:#fff}
.al-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.al-summary-card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px;position:relative;overflow:hidden}
.al-summary-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.al-summary-card.sc-total::before{background:var(--ink)}
.al-summary-card.sc-high::before{background:#dc7140}
.al-summary-card.sc-today::before{background:var(--orange)}
.al-summary-card.sc-done::before{background:var(--green)}
.al-sc-label{font-size:11px;color:var(--muted);margin-bottom:4px}
.al-sc-val{font:bold 28px 'DM Mono';color:var(--ink);line-height:1}
.al-sc-sub{font-size:10px;color:var(--muted);margin-top:6px}
.al-tabs{display:flex;gap:0;border-bottom:1px solid var(--line);margin-bottom:0}
.al-tab{background:none;border:0;padding:10px 18px;font:12px 'Noto Sans SC';color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:.2s;white-space:nowrap}
.al-tab:hover{color:var(--ink)}
.al-tab.active{color:var(--orange);border-bottom-color:var(--orange);font-weight:600}
.al-tab .tab-count{display:inline-block;background:#eee;padding:1px 6px;border-radius:8px;font-size:10px;margin-left:4px;font-family:'DM Mono'}
.al-tab.active .tab-count{background:rgba(223,111,61,.12);color:var(--orange)}
.al-batch{display:flex;gap:8px;padding:10px 0;border-bottom:1px solid #f0efeb;align-items:center}
.al-batch-info{font-size:11px;color:var(--muted);margin-left:auto}
.al-list{padding:0}
.al-card{display:flex;gap:14px;padding:14px 16px;border-bottom:1px solid #f0efeb;position:relative;transition:background .2s;cursor:default}
.al-card:hover{background:#faf9f5}
.al-card.unread{background:#fff}
.al-card.unread::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;background:var(--orange);border-radius:2px}
.al-card.read{opacity:.6}
.al-card.read:hover{opacity:.85}
.al-card-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.al-card-icon.type-shop{background:rgba(223,111,61,.1)}
.al-card-icon.type-cat{background:rgba(60,108,98,.1)}
.al-card-icon.type-policy{background:rgba(220,113,64,.1)}
.al-card-icon.type-macro{background:rgba(100,140,180,.1)}
.al-card-icon.type-platform{background:rgba(140,120,180,.1)}
.al-card-body{flex:1;min-width:0}
.al-card-title{font:600 13px 'Noto Sans SC';color:var(--ink);margin-bottom:3px;line-height:1.4}
.al-card-meta{font-size:11px;color:var(--muted);display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.al-card-meta .meta-tag{padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500}
.al-card-meta .meta-tag.high{background:rgba(220,113,64,.12);color:#dc7140}
.al-card-meta .meta-tag.mid{background:rgba(195,145,66,.12);color:#c39142}
.al-card-meta .meta-tag.low{background:rgba(113,131,126,.1);color:#71807c}
.al-card-detail{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5}
.al-card-detail .val-up{color:#3c6c62;font-weight:600}
.al-card-detail .val-down{color:#dc7140;font-weight:600}
.al-card-actions{display:flex;gap:6px;flex-shrink:0;align-items:flex-start;padding-top:2px}
.al-card-actions button{font:11px 'Noto Sans SC';padding:4px 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);cursor:pointer;transition:.2s;white-space:nowrap}
.al-card-actions button:hover{border-color:var(--orange);color:var(--orange)}
.al-card-actions .al-ai-btn{background:rgba(74,144,217,.08);color:#4a90d9;border-color:transparent}
.al-card-actions .al-ai-btn:hover{background:rgba(74,144,217,.15)}
.al-card-check{display:flex;align-items:center;padding-top:4px}
.al-card-check input[type=checkbox]{width:14px;height:14px;accent-color:var(--orange);cursor:pointer}
.al-pagination{display:flex;justify-content:space-between;align-items:center;padding:14px 0;font-size:12px;color:var(--muted)}
.al-pagination .al-page-btns{display:flex;gap:4px}
.al-pagination .al-page-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:4px;background:#fff;font:12px 'DM Mono';cursor:pointer;color:var(--ink)}
.al-pagination .al-page-btn:hover{border-color:var(--orange);color:var(--orange)}
.al-pagination .al-page-btn.active{background:var(--orange);color:#fff;border-color:var(--orange)}
.al-empty{text-align:center;padding:60px 20px;color:var(--muted)}
.al-empty-icon{font-size:48px;margin-bottom:12px}
.al-empty h3{font-size:15px;color:var(--ink);margin-bottom:6px}
.al-empty p{font-size:12px;margin-bottom:16px}
/* Alert Settings Modal */
.al-modal-overlay{position:fixed;inset:0;background:rgba(28,43,41,.5);z-index:200;display:none;align-items:center;justify-content:center;animation:wlFadeIn .25s ease}
.al-modal-overlay.show{display:flex}
.al-modal{background:#fff;width:520px;max-width:92vw;border-radius:10px;overflow:hidden;box-shadow:0 20px 60px rgba(28,43,41,.25);animation:wlSlideUp .3s ease}
.al-modal-head{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--line)}
.al-modal-head h3{font-size:15px;margin:0}
.al-modal-close{border:0;background:none;font-size:18px;color:var(--muted);cursor:pointer}
.al-modal-body{padding:22px}
.al-setting-group{margin-bottom:18px}
.al-setting-group h4{font-size:12px;color:var(--muted);margin:0 0 10px;text-transform:uppercase;letter-spacing:.5px}
.al-setting-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f4f0}
.al-setting-item:last-child{border-bottom:0}
.al-setting-label{font-size:13px;color:var(--ink)}
.al-toggle{position:relative;width:36px;height:20px;background:#ddd;border-radius:10px;cursor:pointer;transition:.3s}
.al-toggle.on{background:var(--green)}
.al-toggle::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.3s}
.al-toggle.on::after{left:18px}
.al-threshold-input{width:80px;padding:4px 8px;border:1px solid var(--line);border-radius:4px;font:12px 'DM Mono';text-align:center}
@media(max-width:1000px){.al-summary{grid-template-columns:repeat(2,1fr)}.al-card{flex-wrap:wrap}.al-card-actions{width:100%;justify-content:flex-end}}
@media(max-width:700px){.al-summary{grid-template-columns:1fr 1fr}.al-header{flex-direction:column;align-items:flex-start}.al-toolbar{flex-direction:column}.al-tabs{overflow-x:auto}}
"""

# ============================================================
# 2. ALERTS DATA - Insert after L959 (index 959), before L960
# ============================================================
alerts_data = """
const alertsFull=[
// id,type,level,title,country,platform,detail,date,read
['a1','shop','high','TikTok Shop 印尼美妆店 GMV 7日暴跌 42%','印尼','TikTok Shop','GMV 从 Rp2.3亿 降至 Rp1.3亿，转化率从 4.2% 跌至 2.1%','2026-07-15',false],
['a2','shop','high','Shopee 巴西 3C 店铺因物流违规被扣 12 分','巴西','Shopee','累计扣分达限流阈值，7日内未申诉将降权','2026-07-15',false],
['a3','shop','mid','Lazada 泰国服装店差评率激增至 8.7%','泰国','Lazada','近7日差评 47 条，主要集中在尺码偏差和色差问题','2026-07-14',false],
['a4','shop','mid','TikTok Shop 美国家居店广告投放 ROI 跌至 1.2','美国','TikTok Shop','广告花费 $1,840 但 GMV 仅 $2,208，远低于盈亏线','2026-07-14',false],
['a5','shop','mid','Shopee 越南家居店 3 款主力品断货超 48 小时','越南','Shopee','断货导致店铺权重下降，自然流量减少 31%','2026-07-13',true],
['a6','shop','low','TikTok Shop 马来站宠物用品店上新 12 款同类竞品','马来西亚','TikTok Shop','同赛道新店铺密集入场，价格带下移 15%','2026-07-12',true],
['a7','cat','high','泰国美妆类目 7 日增速 +212%，新爆品涌现','泰国','TikTok Shop','防晒品类主导增长，3 款新品 7 日销量破 5 万','2026-07-15',false],
['a8','cat','high','印尼清真食品类目斋月前爆发 +186%','印尼','Shopee','预计持续至斋月结束，建议提前备货','2026-07-15',false],
['a9','cat','mid','日本 3C 配件类目价格战加剧，均价下跌 23%','日本','Amazon','Top20 产品中 14 款在 30 天内降价，利润空间压缩','2026-07-14',false],
['a10','cat','mid','巴西泳装类目季节性爆发 +154%','巴西','Shopee','世界杯季节效应，男士泳裤增速领先','2026-07-14',false],
['a11','cat','mid','美国智能家居类目 30 日增速 +89%','美国','TikTok Shop','智能灯具和安防摄像头主导增长','2026-07-13',true],
['a12','cat','low','越南母婴用品类目流量连续 14 天下滑','越南','Shopee','流量下降 18%，疑似受本土品牌促销冲击','2026-07-12',true],
['a13','policy','high','美国对华 301 关税提升至 145%，全品类影响','美国','-','7月15日起执行，覆盖所有中国原产地商品','2026-07-15',false],
['a14','policy','high','印尼取消进口商品免税门槛，全面征收进口税','印尼','-','所有跨境包裹均需缴纳关税+VAT，成本上升 20-30%','2026-07-15',false],
['a15','policy','high','越南跨境电商须缴纳与本土企业相同税率','越南','-','新税法要求外资电商企业税率从 5% 提升至 10%','2026-07-14',false],
['a16','policy','high','沙特 SABER 认证强制实施，未认证商品禁止清关','沙特','-','涉及电子电器、玩具、建材等 12 大品类','2026-07-13',false],
['a17','policy','high','巴西 Remessa Conforme 进口税计划正式执行','巴西','-','跨境包裹征收 20% 进口税 + 17% ICMS','2026-07-13',true],
['a18','policy','mid','德国数字服务法 DSA 全面执行','德国','-','平台需加强商品安全审核，违规商品 48h 内下架','2026-07-14',false],
['a19','policy','mid','印度 FDI 外资限制加强，电商平台合规要求升级','印度','-','外商独资电商平台需重新注册，库存模式受限','2026-07-13',true],
['a20','policy','mid','尼日利亚外汇管制收紧，进口付汇周期延长','尼日利亚','-','外汇审批从 5 个工作日延长至 15-20 个工作日','2026-07-13',true],
['a21','policy','mid','法国 GPSR 通用产品安全法规执行','法国','-','所有在法销售商品须有欧盟境内负责人','2026-07-12',true],
['a22','macro','high','土耳其里拉单日暴跌 5.2%，汇率风险极高','土耳其','-','美元/里拉突破 38.5，跨境电商定价需紧急调整','2026-07-15',false],
['a23','macro','mid','越南盾 6 个月内累计贬值 3.2%','越南','-','利润空间压缩，建议调整定价策略','2026-07-14',false],
['a24','macro','mid','印尼卢比兑美元跌破 16,500，进口成本上升','印尼','-','进口商品成本增加约 4%，影响 3C/美妆品类利润','2026-07-13',true],
['a25','macro','low','沙特里亚尔锚定美元，汇率稳定','沙特','-','汇率波动 <0.1%，对跨境电商影响极小','2026-07-12',true],
['a26','macro','low','巴西雷亚尔近 30 日升值 2.1%','巴西','-','有利于进口采购，但出口竞争力微降','2026-07-11',true],
['a27','platform','high','TikTok Shop 印尼佣金从 1% 上调至 5%','印尼','TikTok Shop','7月20日生效，美妆/食品类目额外加收 1%','2026-07-15',false],
['a28','platform','high','Shopee 美国站实施店铺分级新规','美国','Shopee','低于 3.5 星店铺将被限流，需关注服务质量','2026-07-14',false],
['a29','platform','mid','Lazada 泰国发货时效从 3 天缩至 2 天','泰国','Lazada','8月1日起执行，超时自动取消订单并扣分','2026-07-14',false],
['a30','platform','mid','TikTok Shop 马来西亚保证金上调至 RM5,000','马来西亚','TikTok Shop','新卖家入驻成本增加，现有卖家不受影响','2026-07-13',true],
['a31','platform','mid','Amazon 美国站广告竞价上涨 18%','美国','Amazon','Q3 旺季竞争加剧，CPC 均价从 $0.85 升至 $1.00','2026-07-13',true],
['a32','platform','low','Shopee 越南物流费率微调 +3%','越南','Shopee','影响范围：标准快递和經濟快递','2026-07-12',true],
['a33','platform','low','Lazada 菲律宾佣金从 2% 调至 2.5%','菲律宾','Lazada','7月25日生效，美妆类目维持 2% 不变','2026-07-11',true],
['a34','shop','high','菲律宾母婴店因发货超时被封店 7 天','菲律宾','Shopee','需提交申诉材料，预计 3 个工作日恢复','2026-07-14',false],
['a35','cat','high','美国运动户外类目世界杯前暴涨 +127%','美国','TikTok Shop','球迷围巾、便携音箱、投影仪增速领先','2026-07-14',false],
['a36','policy','mid','阿联酋 ESMA 标准升级，电子产品需重新认证','阿联酋','-','现有认证有效期延至 2026 年底，届时需更换','2026-07-12',true],
['a37','macro','mid','埃及镑官方汇率与黑市价差扩大至 40%','埃及','-','外汇结算风险增大，建议缩短回款周期','2026-07-12',true],
['a38','platform','mid','TikTok Shop 美国站商品审核周期延长至 72 小时','美国','TikTok Shop','因合规审查升级，新上架商品审核变慢','2026-07-12',true],
['a39','shop','mid','印尼美妆店铺差评激增导致转化率下跌 35%','印尼','TikTok Shop','主要投诉：产品与描述不符、包装破损','2026-07-13',true]
];
"""

# ============================================================
# 3. HTML - Replace L729 (index 728)
# ============================================================
alerts_html = """    <section id="alerts" class="page">
      <div class="al-header">
        <div class="al-title-group">
          <h2>预警中心</h2>
          <span class="al-badge" id="al-unread-badge">14</span>
        </div>
        <div class="al-search">
          <span>🔍</span>
          <input type="text" id="al-search-input" placeholder="搜索预警内容..." oninput="alSearch()">
        </div>
      </div>
      <div class="al-toolbar">
        <select class="al-filter-select" id="al-filter-type" onchange="alFilterChange()">
          <option value="all">全部类型</option>
          <option value="shop">店铺异动</option>
          <option value="cat">类目爆款</option>
          <option value="policy">政策合规</option>
          <option value="macro">宏观经济</option>
          <option value="platform">平台规则</option>
        </select>
        <select class="al-filter-select" id="al-filter-level" onchange="alFilterChange()">
          <option value="all">全部等级</option>
          <option value="high">高风险</option>
          <option value="mid">中风险</option>
          <option value="low">普通资讯</option>
        </select>
        <select class="al-filter-select" id="al-filter-time" onchange="alFilterChange()">
          <option value="all">全部时间</option>
          <option value="today">今日</option>
          <option value="3d">近 3 天</option>
          <option value="7d">近 7 天</option>
        </select>
        <button class="al-btn" onclick="openAlertSettings()">⚙ 告警设置</button>
        <button class="al-btn" onclick="alExport()">导出报告</button>
        <button class="al-btn" onclick="alMarkAllRead()">全部标为已读</button>
      </div>
      <div class="al-summary" id="al-summary"></div>
      <div class="al-tabs" id="al-tabs"></div>
      <div class="al-batch" id="al-batch" style="display:none">
        <input type="checkbox" id="al-select-all" onchange="alToggleSelectAll(this.checked)">
        <label for="al-select-all" style="font-size:12px;color:var(--ink);cursor:pointer">全选</label>
        <button class="al-btn" onclick="alBatchArchive()" style="margin-left:8px">批量归档</button>
        <button class="al-btn" onclick="alBatchWatch()">加入看板</button>
        <span class="al-batch-info" id="al-batch-info">已选 0 项</span>
      </div>
      <div class="al-list" id="al-list"></div>
      <div class="al-pagination" id="al-pagination"></div>
    </section>
"""

# ============================================================
# 4. JS FUNCTIONS - Insert before </script> at L2144 (index 2143)
# ============================================================
alerts_js = """
// ========== ALERTS CENTER ==========
var alCurrentTab='all';
var alCurrentPage=1;
var alPerPage=10;
var alSelected=new Set();
var alTypeIcons={shop:'🏪',cat:'📈',policy:'📜',macro:'💹',platform:'🔧'};
var alTypeLabels={shop:'店铺异动',cat:'类目爆款',policy:'政策合规',macro:'宏观经济',platform:'平台规则'};
var alLevelLabels={high:'高风险',mid:'中风险',low:'普通'};
var alTypeTargets={shop:'products',cat:'products',policy:'policies',macro:'countries',platform:'rules'};

function renderAlerts(){
  var filtered=getFilteredAlerts();
  renderAlSummary();
  renderAlTabs();
  renderAlBatch();
  renderAlList(filtered);
  renderAlPagination(filtered);
  updateAlBadge();
}

function getFilteredAlerts(){
  var typeF=document.getElementById('al-filter-type').value;
  var levelF=document.getElementById('al-filter-level').value;
  var timeF=document.getElementById('al-filter-time').value;
  var searchQ=(document.getElementById('al-search-input').value||'').toLowerCase();
  var tabType=alCurrentTab;
  var now=new Date('2026-07-15');
  return alertsFull.filter(function(a){
    if(tabType!=='all'&&a[1]!==tabType)return false;
    if(typeF!=='all'&&a[1]!==typeF)return false;
    if(levelF!=='all'&&a[2]!==levelF)return false;
    if(searchQ&&a[3].toLowerCase().indexOf(searchQ)<0&&a[5].toLowerCase().indexOf(searchQ)<0&&a[6].toLowerCase().indexOf(searchQ)<0)return false;
    if(timeF!=='all'){
      var d=new Date(a[7]);
      var diff=Math.floor((now-d)/(86400000));
      if(timeF==='today'&&diff>0)return false;
      if(timeF==='3d'&&diff>3)return false;
      if(timeF==='7d'&&diff>7)return false;
    }
    return true;
  });
}

function renderAlSummary(){
  var total=alertsFull.filter(function(a){return!a[8]}).length;
  var high=alertsFull.filter(function(a){return a[2]==='high'&&!a[8]}).length;
  var today=alertsFull.filter(function(a){return a[7]==='2026-07-15'}).length;
  var done=alertsFull.filter(function(a){return a[8]}).length;
  var el=document.getElementById('al-summary');
  el.innerHTML='<div class="al-summary-card sc-total"><div class="al-sc-label">未读预警</div><div class="al-sc-val">'+total+'</div><div class="al-sc-sub">较昨日 +3</div></div>'
    +'<div class="al-summary-card sc-high"><div class="al-sc-label">高风险紧急</div><div class="al-sc-val">'+high+'</div><div class="al-sc-sub">需立即处理</div></div>'
    +'<div class="al-summary-card sc-today"><div class="al-sc-label">今日新增</div><div class="al-sc-val">'+today+'</div><div class="al-sc-sub">实时更新</div></div>'
    +'<div class="al-summary-card sc-done"><div class="al-sc-label">已处理归档</div><div class="al-sc-val">'+done+'</div><div class="al-sc-sub">累计已处理</div></div>';
}

function renderAlTabs(){
  var tabs=[{k:'all',l:'全部'},{k:'shop',l:'店铺追踪'},{k:'cat',l:'类目爆款'},{k:'policy',l:'政策合规'},{k:'macro',l:'宏观经济'},{k:'platform',l:'平台规则'}];
  var html='';
  tabs.forEach(function(t){
    var cnt=t.k==='all'?alertsFull.length:alertsFull.filter(function(a){return a[1]===t.k}).length;
    var cls=alCurrentTab===t.k?'al-tab active':'al-tab';
    html+='<button class="'+cls+'" onclick="alSwitchTab(\\''+t.k+'\\')">'+ t.l +'<span class="tab-count">'+cnt+'</span></button>';
  });
  document.getElementById('al-tabs').innerHTML=html;
}

function renderAlBatch(){
  var bar=document.getElementById('al-batch');
  bar.style.display=alSelected.size>0?'flex':'none';
  document.getElementById('al-batch-info').textContent='已选 '+alSelected.size+' 项';
}

function renderAlList(filtered){
  var el=document.getElementById('al-list');
  if(!filtered.length){
    var isFiltered=document.getElementById('al-filter-type').value!=='all'||document.getElementById('al-filter-level').value!=='all'||document.getElementById('al-filter-time').value!=='all'||document.getElementById('al-search-input').value;
    if(isFiltered){
      el.innerHTML='<div class="al-empty"><div class="al-empty-icon">🔍</div><h3>未找到匹配的预警</h3><p>请尝试调整筛选条件</p></div>';
    }else{
      el.innerHTML='<div class="al-empty"><div class="al-empty-icon">✅</div><h3>当前所有监控运行平稳</h3><p>暂无任何预警，所有店铺、类目、国家市场无异动风险</p><button class="al-btn al-btn-primary" onclick="openAlertSettings()">前往告警设置</button></div>';
    }
    return;
  }
  var start=(alCurrentPage-1)*alPerPage;
  var pageItems=filtered.slice(start,start+alPerPage);
  var html='';
  pageItems.forEach(function(a){
    var id=a[0],type=a[1],level=a[2],title=a[3],country=a[4],platform=a[5],detail=a[6],date=a[7],read=a[8];
    var icon=alTypeIcons[type]||'📋';
    var typeLabel=alTypeLabels[type]||type;
    var levelLabel=alLevelLabels[level]||level;
    var checked=alSelected.has(id)?'checked':'';
    var readCls=read?'read':'unread';
    html+='<div class="al-card '+readCls+'" id="al-card-'+id+'">';
    html+='<div class="al-card-check"><input type="checkbox" '+checked+' onchange="alToggleSelect(\\''+id+'\\',this.checked)"></div>';
    html+='<div class="al-card-icon type-'+type+'">'+icon+'</div>';
    html+='<div class="al-card-body">';
    html+='<div class="al-card-title">'+title+'</div>';
    html+='<div class="al-card-meta">';
    html+='<span class="meta-tag '+level+'">'+levelLabel+'</span>';
    html+='<span>'+typeLabel+'</span>';
    if(country!=='-')html+='<span>📍 '+country+'</span>';
    if(platform!=='-')html+='<span>🛒 '+platform+'</span>';
    html+='<span>📅 '+date+'</span>';
    html+='</div>';
    html+='<div class="al-card-detail">'+parseDetail(detail)+'</div>';
    html+='</div>';
    html+='<div class="al-card-actions">';
    html+='<button onclick="alViewDetail(\\''+id+'\\')">查看详情</button>';
    html+='<button class="al-ai-btn" onclick="alAiAnalysis(\\''+id+'\\')">AI 解读</button>';
    html+='<button onclick="alArchive(\\''+id+'\\')">归档</button>';
    html+='</div>';
    html+='</div>';
  });
  el.innerHTML=html;
}

function parseDetail(d){
  return d.replace(/(\\+\\d+\\.?\\d*%)/g,'<span class="val-up">$1</span>')
          .replace(/(-\\d+\\.?\\d*%)/g,'<span class="val-down">$1</span>')
          .replace(/(暴跌|下跌|下滑|贬值|收紧|限制|暴涨|激增至)/g,function(m){
            if(m==='暴跌'||m==='下跌'||m==='下滑'||m==='贬值')return '<span class="val-down">'+m+'</span>';
            return '<span class="val-up">'+m+'</span>';
          });
}

function renderAlPagination(filtered){
  var el=document.getElementById('al-pagination');
  var total=filtered.length;
  var pages=Math.ceil(total/alPerPage);
  if(pages<=1){el.innerHTML='';return;}
  var html='<span>共 '+total+' 条，第 '+alCurrentPage+'/'+pages+' 页</span><div class="al-page-btns">';
  for(var i=1;i<=pages;i++){
    var cls=i===alCurrentPage?'al-page-btn active':'al-page-btn';
    html+='<button class="'+cls+'" onclick="alGoPage('+i+')">'+i+'</button>';
  }
  html+='</div>';
  el.innerHTML=html;
}

function alSwitchTab(tab){alCurrentTab=tab;alCurrentPage=1;alSelected.clear();renderAlerts();}
function alFilterChange(){alCurrentPage=1;renderAlerts();}
function alSearch(){alCurrentPage=1;renderAlerts();}
function alGoPage(p){alCurrentPage=p;renderAlerts();window.scrollTo({top:document.getElementById('al-list').offsetTop-80,behavior:'smooth'});}

function alToggleSelect(id,checked){
  if(checked)alSelected.add(id);else alSelected.delete(id);
  renderAlBatch();
}
function alToggleSelectAll(checked){
  var filtered=getFilteredAlerts();
  var start=(alCurrentPage-1)*alPerPage;
  var pageItems=filtered.slice(start,start+alPerPage);
  pageItems.forEach(function(a){if(checked)alSelected.add(a[0]);else alSelected.delete(a[0]);});
  renderAlerts();
}

function alArchive(id){
  for(var i=0;i<alertsFull.length;i++){
    if(alertsFull[i][0]===id){alertsFull[i][8]=true;break;}
  }
  alSelected.delete(id);
  toast('已归档该预警');
  renderAlerts();
}
function alMarkAllRead(){
  alertsFull.forEach(function(a){a[8]=true;});
  toast('已全部标为已读');
  renderAlerts();
}
function alBatchArchive(){
  alSelected.forEach(function(id){
    for(var i=0;i<alertsFull.length;i++){if(alertsFull[i][0]===id){alertsFull[i][8]=true;break;}}
  });
  var n=alSelected.size;
  alSelected.clear();
  toast('已批量归档 '+n+' 条预警');
  renderAlerts();
}
function alBatchWatch(){
  var n=alSelected.size;
  alSelected.clear();
  toast('已将 '+n+' 条预警加入看板监控');
  renderAlerts();
}

function alViewDetail(id){
  var a=alertsFull.find(function(x){return x[0]===id});
  if(!a)return;
  var target=alTypeTargets[a[1]]||'overview';
  if(a[1]==='shop'||a[1]==='cat')switchPage('products');
  else if(a[1]==='policy')switchPage('policies');
  else if(a[1]==='macro')switchPage('countries');
  else if(a[1]==='platform')switchPage('rules');
  else switchPage('overview');
  toast('已跳转到'+alTypeLabels[a[1]]+'板块');
}

function alAiAnalysis(id){
  var a=alertsFull.find(function(x){return x[0]===id});
  if(!a)return;
  var analyses={
    shop:'AI 风险诊断：该店铺异动主要由运营指标下滑引起。建议：① 立即排查核心 SKU 的库存和评价状态；② 对比同期竞品数据确认是否为行业趋势；③ 调整广告投放策略，优先保 ROI。',
    cat:'AI 趋势分析：该类目出现显著增长信号。建议：① 评估自身供应链能否承接增量；② 锁定 Top10 爆品的核心卖点做差异化选品；③ 关注增速是否可持续，排除季节性脉冲。',
    policy:'AI 合规解读：该政策变动将直接影响跨境卖家的成本和合规要求。建议：① 立即评估受影响 SKU 清单；② 联系当地合规代理确认执行细节；③ 调整定价模型以覆盖新增成本。',
    macro:'AI 宏观研判：该经济指标变化可能影响跨境利润。建议：① 评估汇率波动对毛利的影响幅度；② 考虑调整结算货币或增加对冲工具；③ 监控趋势是否持续恶化。',
    platform:'AI 规则影响：平台规则调整将改变运营环境。建议：① 仔细阅读完整规则文本；② 评估对现有商品和店铺的具体影响；③ 在生效日期前完成合规调整。'
  };
  toast(analyses[a[1]]||'AI 分析功能需升级专业版');
}

function alExport(){toast('预警报告导出功能需升级专业版');}

function updateAlBadge(){
  var unread=alertsFull.filter(function(a){return!a[8]}).length;
  var badge=document.getElementById('al-unread-badge');
  if(badge){badge.textContent=unread;badge.style.display=unread>0?'inline-block':'none';}
  var navBadge=document.querySelector('a[data-page="alerts"] .danger');
  if(navBadge)navBadge.textContent=unread;
}

function openAlertSettings(){
  var overlay=document.createElement('div');
  overlay.className='al-modal-overlay show';
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  overlay.innerHTML='<div class="al-modal">'
    +'<div class="al-modal-head"><h3>⚙ 告警设置</h3><button class="al-modal-close" onclick="this.closest(\\'.al-modal-overlay\\').remove()">✕</button></div>'
    +'<div class="al-modal-body">'
    +'<div class="al-setting-group"><h4>预警类型开关</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">店铺异动预警</span><div class="al-toggle on" onclick="this.classList.toggle(\\'on\\')\"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">类目爆款异动</span><div class="al-toggle on" onclick="this.classList.toggle(\\'on\\')\"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">政策合规预警</span><div class="al-toggle on" onclick="this.classList.toggle(\\'on\\')\"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">宏观经济预警</span><div class="al-toggle on" onclick="this.classList.toggle(\\'on\\')\"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">平台规则变更</span><div class="al-toggle on" onclick="this.classList.toggle(\\'on\\')\"></div></div>'
    +'</div>'
    +'<div class="al-setting-group"><h4>推送方式</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">站内弹窗通知</span><div class="al-toggle on" onclick="this.classList.toggle(\\'on\\')\"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">右下角消息浮窗</span><div class="al-toggle on" onclick="this.classList.toggle(\\'on\\')\"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">同步到「我的看板」</span><div class="al-toggle" onclick="this.classList.toggle(\\'on\\')\"></div></div>'
    +'</div>'
    +'<div class="al-setting-group"><h4>自定义阈值（专业版）</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">GMV 波动触发阈值</span><input class="al-threshold-input" value="30%" disabled></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">差评率触发阈值</span><input class="al-threshold-input" value="5%" disabled></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">类目增速触发阈值</span><input class="al-threshold-input" value="50%" disabled></div>'
    +'</div>'
    +'</div></div>';
  document.body.appendChild(overlay);
}
"""

# ============================================================
# NOW APPLY ALL CHANGES
# ============================================================

# Work with the full content as a string for precise insertion
content = ''.join(lines)

# Find insertion points by searching for unique markers

# 1. CSS: Insert before the @media(max-width:1000px) at L572
# Actually, let's insert right before </style>
style_close = '</style>'
style_idx = content.index(style_close)
content = content[:style_idx] + alerts_css + '\n' + content[style_idx:]

# 2. Data: Insert after the alerts array end "['#c39142','南非','进口关税调整与本地化要求','2026-07-13']];"
data_marker = "['#c39142','南非','进口关税调整与本地化要求','2026-07-13']];"
data_idx = content.index(data_marker)
data_end = data_idx + len(data_marker)
content = content[:data_end] + '\n' + alerts_data + content[data_end:]

# 3. HTML: Replace the alerts section
old_html = '    <section id="alerts" class="page"><div class="section-heading"><div><p class="eyebrow">NOTIFICATION CENTRE</p><h2>预警中心</h2></div><button class="export" id="read-all">全部标为已读</button></div><div class="alerts-full" id="alerts-full"></div></section>'
new_html = alerts_html.rstrip('\n')
content = content.replace(old_html, new_html)

# 4. JS: Insert before </script>
script_close = '</script>'
script_idx = content.index(script_close)
content = content[:script_idx] + alerts_js + '\n' + content[script_idx:]

# Fix the escaped quotes in JS (we used \\\" for Python string, but need \" in output)
# Actually, the JS strings use \\' which in Python string is just \\'. In the output file, we need \'
# Let me check: in the Python string, \\' becomes \' in the output. That's correct for JS inside HTML.

# Write output
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ Alerts center rebuilt. New file size: {len(content):,} bytes")
print(f"   - CSS: alerts styles added before </style>")
print(f"   - Data: {alerts_data.count(chr(10))} lines of alerts data")
print(f"   - HTML: Full alerts page structure")
print(f"   - JS: renderAlerts + filter/tab/pagination/settings functions")
