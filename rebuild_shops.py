#!/usr/bin/env python3
"""Rebuild shops page into comprehensive shop tracker with AI insights, filters, detail modal, batch ops, export."""
import re

fp = '/app/data/所有对话/主对话/mercator_rework/index.html'
with open(fp, 'r', encoding='utf-8') as f:
    html = f.read()

# ============================================================
# 1. Replace the shops section HTML (line ~1341)
# ============================================================
old_section_pat = re.compile(
    r'<section id="shops" class="page">.*?</section>',
    re.DOTALL
)

new_section = r'''<section id="shops" class="page">

<!-- AI Insights -->
<div id="ai-shops"></div>
<div class="ai-insight-panel" style="margin:0 0 18px">
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <button class="sh-ai-tab active" data-aitab="benchmark" onclick="shSwitchAI('benchmark')">标杆店铺参考</button>
    <button class="sh-ai-tab" data-aitab="risk" onclick="shSwitchAI('risk')">风险异动提醒</button>
  </div>
  <div id="sh-ai-content"></div>
</div>

<!-- Group Tabs -->
<div class="sh-group-tabs" id="sh-group-tabs">
  <button class="sh-grp active" data-grp="all">全部店铺</button>
</div>
<button class="sh-add-grp" onclick="shNewGroup()" title="新建分组">+ 新建分组</button>

<!-- Filter Bar -->
<div class="sh-filter-bar" id="sh-filter-bar">
  <select id="sh-f-region"><option value="">全部市场</option></select>
  <select id="sh-f-platform"><option value="">全部平台</option></select>
  <select id="sh-f-cat"><option value="">全部类目</option></select>
  <select id="sh-f-status"><option value="">全部状态</option><option value="正常">正常</option><option value="关注">关注</option><option value="风险">风险</option></select>
  <select id="sh-f-gmv">
    <option value="">全部GMV</option>
    <option value="0-100">$0-100万</option>
    <option value="100-300">$100-300万</option>
    <option value="300-500">$300-500万</option>
    <option value="500+">$500万+</option>
  </select>
  <select id="sh-f-tag"><option value="">全部标签</option></select>
  <input type="text" id="sh-f-keyword" placeholder="搜索店铺名/类目..." style="min-width:160px">
  <select id="sh-f-sort">
    <option value="gmv_desc">GMV 降序</option>
    <option value="gmv_asc">GMV 升序</option>
    <option value="growth_desc">增速 降序</option>
    <option value="growth_asc">增速 升序</option>
    <option value="products_desc">商品数 降序</option>
  </select>
  <button onclick="shSaveTpl()" title="保存筛选模板">💾 保存模板</button>
  <select id="sh-tpl-select" onchange="shLoadTpl(this.value)"><option value="">加载模板...</option></select>
</div>

<!-- Action Bar -->
<div class="sh-action-bar">
  <div style="display:flex;align-items:center;gap:10px">
    <p class="eyebrow" style="margin:0">SHOP TRACKER</p>
    <h2 style="margin:0">已监控店铺 <span id="sh-count" style="font-size:14px;color:var(--muted)"></span></h2>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <button class="export" onclick="shOpenAddModal()">+ 添加店铺</button>
    <button class="export" onclick="shExportExcel()" title="导出Excel">📊 Excel</button>
    <button class="export" onclick="shExportPDF()" title="导出PDF片段">📄 PDF</button>
  </div>
</div>

<!-- Batch Bar -->
<div class="sh-batch-bar" id="sh-batch-bar" style="display:none">
  <span id="sh-batch-count">已选 0 家</span>
  <button onclick="shBatchAddReport()">加入报告素材</button>
  <button onclick="shBatchSetAlert()">设置预警</button>
  <button onclick="shBatchRemove()">移除监控</button>
  <button onclick="shClearSelection()">取消选择</button>
</div>

<!-- Table -->
<article class="panel table-panel">
<table>
<thead><tr>
  <th style="width:36px"><input type="checkbox" id="sh-select-all" onchange="shToggleAll(this.checked)"></th>
  <th>店铺</th>
  <th>平台</th>
  <th>市场</th>
  <th>主营类目</th>
  <th>月GMV</th>
  <th>30天波动</th>
  <th>在售商品</th>
  <th>增速</th>
  <th>粉丝数</th>
  <th>标签</th>
  <th>状态</th>
  <th>更新时间</th>
</tr></thead>
<tbody id="shop-table"></tbody>
</table>
</article>

<!-- Shop Detail Modal -->
<div class="sh-modal-overlay" id="sh-modal-overlay" onclick="if(event.target===this)shCloseModal()">
  <div class="sh-modal" id="sh-modal">
    <div class="sh-modal-head">
      <h3 id="sh-modal-title"></h3>
      <button onclick="shCloseModal()">✕</button>
    </div>
    <div class="sh-modal-body" id="sh-modal-body"></div>
  </div>
</div>

<!-- Add Shop Modal -->
<div class="sh-modal-overlay" id="sh-add-overlay" onclick="if(event.target===this)shCloseAddModal()">
  <div class="sh-modal" style="max-width:520px">
    <div class="sh-modal-head">
      <h3>添加店铺</h3>
      <button onclick="shCloseAddModal()">✕</button>
    </div>
    <div class="sh-modal-body" style="padding:20px">
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="sh-add-tab active" data-addtab="single" onclick="shSwitchAddTab('single')">单个添加</button>
        <button class="sh-add-tab" data-addtab="batch" onclick="shSwitchAddTab('batch')">批量导入</button>
        <button class="sh-add-tab" data-addtab="link" onclick="shSwitchAddTab('link')">从商品雷达添加</button>
      </div>
      <div id="sh-add-single">
        <label>店铺名称</label><input type="text" id="sh-add-name" placeholder="例: GLOW LAB Official" style="width:100%;margin-bottom:8px">
        <label>平台</label><input type="text" id="sh-add-platform" placeholder="例: TikTok Shop" style="width:100%;margin-bottom:8px">
        <label>市场</label><input type="text" id="sh-add-market" placeholder="例: 东南亚" style="width:100%;margin-bottom:8px">
        <label>主营类目</label><input type="text" id="sh-add-cat" placeholder="例: 美妆个护" style="width:100%;margin-bottom:8px">
        <label>标签（逗号分隔）</label><input type="text" id="sh-add-tags" placeholder="例: 对标头部,美妆" style="width:100%;margin-bottom:12px">
        <button class="export" onclick="shDoAddSingle()" style="width:100%">确认添加</button>
      </div>
      <div id="sh-add-batch" style="display:none">
        <label>批量粘贴店铺链接/名称（每行一个）</label>
        <textarea id="sh-add-batch-text" rows="8" style="width:100%;margin-bottom:12px" placeholder="每行一个店铺名或链接..."></textarea>
        <button class="export" onclick="shDoAddBatch()" style="width:100%">批量导入</button>
      </div>
      <div id="sh-add-link" style="display:none">
        <p style="color:var(--muted);font-size:13px;margin-bottom:10px">在「产品全域雷达」中点击商品所属店铺名即可自动添加到监控列表。</p>
        <button class="export" onclick="shCloseAddModal();switchPage('products')" style="width:100%">前往产品全域雷达</button>
      </div>
    </div>
  </div>
</div>

</section>'''

html = old_section_pat.sub(new_section, html)
print("1. Section replaced")

# ============================================================
# 2. Expand shops data array from 6 to 12 fields
# Old: [name, platform, market, gmv, growth, risk_status]
# New: [name, platform, market, gmv, growth, risk_status, category, products_count, gmv_30d, tags, followers, rating, update_time]
# ============================================================

# Build new shops data
new_shops_data = """const shops=[
['Somethingspeaking','TikTok Shop','东南亚','US$ 280万','+15.0%','正常','美妆个护',156,'+8.2%','对标头部',42500,'4.8','2h'],
['Eiger Official','Shopee','东南亚','US$ 180万','+8.0%','正常','户外运动',230,'+3.5%','头部对标',88000,'4.7','4h'],
['MS Glow','TikTok Shop','东南亚','US$ 350万','+22.0%','正常','美妆个护',189,'+12.1%','对标头部',156000,'4.6','1h'],
['Xiaomi Official','Lazada','东南亚','US$ 420万','+12.0%','正常','3C数码',520,'+5.8%','头部对标',320000,'4.9','3h'],
['Mamaway','Shopee','东南亚','US$ 95万','+6.0%','关注','母婴用品',98,'-2.3%','潜在对手',35000,'4.5','6h'],
['Kopi Kenangan','Tokopedia','东南亚','US$ 120万','+18.0%','正常','食品饮料',45,'+9.0%','潜在对手',72000,'4.7','5h'],
['GlamAR Beauty','Noon','中东','US$ 85万','+25.0%','正常','美妆个护',112,'+15.3%','低价竞品',28000,'4.6','3h'],
['Carrefour UAE','Noon','中东','US$ 200万','+10.0%','正常','日用百货',1200,'+4.2%','头部对标',95000,'4.5','8h'],
['AutoPro Accessories','TikTok Shop','中东','US$ 65万','+45.0%','关注','汽车配件',78,'+28.5%','潜在对手',18000,'4.3','2h'],
['Govee US','Amazon','欧美','US$ 580万','+18.0%','正常','家居家装',340,'+7.6%','对标头部',210000,'4.7','1h'],
['CIDER','SHEIN','欧美','US$ 320万','+12.0%','正常','时尚服饰',680,'+6.1%','低价竞品',185000,'4.4','4h'],
['EcoFlow','Amazon','欧美','US$ 420万','+22.0%','正常','3C数码',86,'+11.2%','对标头部',145000,'4.8','2h'],
['Bissell','Amazon','欧美','US$ 280万','+8.0%','正常','家居家电',195,'+2.1%','头部对标',120000,'4.6','6h'],
['BARBERX','TikTok Shop','欧美','US$ 150万','+35.0%','关注','美妆个护',67,'+22.0%','潜在对手',56000,'4.5','3h'],
['Beauty Store BR','Shopee','拉美','US$ 95万','+15.0%','正常','美妆个护',210,'+8.7%','低价竞品',42000,'4.4','5h'],
['TechZone MX','MercadoLibre','拉美','US$ 180万','+10.0%','正常','3C数码',340,'+5.2%','潜在对手',65000,'4.6','7h'],
['Moda Latina','Shopee','拉美','US$ 75万','+8.0%','关注','时尚服饰',450,'-1.8%','低价竞品',28000,'4.2','4h'],
['COSME Kitchen','TikTok Shop','日韩','US$ 220万','+20.0%','正常','美妆个护',175,'+10.5%','对标头部',98000,'4.8','2h'],
['Kitchen Korea','TikTok Shop','日韩','US$ 120万','+30.0%','关注','家居厨房',230,'+18.3%','潜在对手',52000,'4.6','3h'],
['Hair Pin Studio','TikTok Shop','日韩','US$ 85万','+15.0%','正常','饰品配件',320,'+7.8%','低价竞品',38000,'4.5','5h'],
['MensStyle India','Amazon','南亚','US$ 65万','+8.0%','正常','时尚服饰',280,'+3.2%','潜在对手',22000,'4.3','8h'],
['FastCharge Tech','Amazon','南亚','US$ 95万','+15.0%','关注','3C数码',150,'+9.6%','低价竞品',35000,'4.4','6h'],
['AfroHair Queen','AliExpress','非洲','US$ 55万','+18.0%','正常','美妆个护',190,'+10.2%','潜在对手',28000,'4.5','4h'],
['SolarTech Africa','AliExpress','非洲','US$ 40万','+42.0%','关注','家居家电',65,'+25.8%','潜在对手',12000,'4.2','3h'],
['Pet Paradise','TikTok Shop','东南亚','US$ 48万','+55.0%','关注','宠物用品',120,'+32.1%','潜在对手',25000,'4.6','1h'],
['Medicube Official','TikTok Shop','欧美','US$ 1,630万','+52.0%','关注','美妆个护',95,'+35.6%','对标头部',580000,'4.9','1h'],
['Dazzle Me Official','Shopee','东南亚','US$ 120万','+18.5%','关注','美妆个护',145,'+11.2%','低价竞品',68000,'4.5','2h'],
['Rejuran Official MY','Shopee','东南亚','US$ 85万','+600.0%','关注','美妆个护',38,'+45.2%','对标头部',42000,'4.7','1h'],
['Poolhacker','TikTok Shop','欧美','US$ 14万','+120.0%','关注','户外运动',22,'+88.5%','潜在对手',8500,'4.3','2h'],
['BIBIGO(菲律宾)','Shopee','东南亚','US$ 35万','+454.0%','关注','食品饮料',56,'+38.0%','潜在对手',18000,'4.6','3h'],
['medicube Official','TikTok Shop','欧美','US$ 487万','+21.1%','正常','美妆个护',95,'+12.8%','对标头部',320000,'4.8','1h'],
['DealsForYouDays(SEESE品牌店)','TikTok Shop','欧美','US$ 507万','+100.0%','正常','家居日用',210,'+52.3%','对标头部',195000,'4.7','2h'],
['Dazzle Me Official','Shopee','东南亚','US$ 85万','+8.0%','正常','美妆个护',145,'+4.1%','低价竞品',68000,'4.5','6h'],
['Toplux Nutrition Official','TikTok Shop','欧美','US$ 291万','-7.5%','正常','保健品',78,'-3.2%','潜在对手',85000,'4.6','4h']
];"""

# Replace old shops array
old_shops_pat = re.compile(r'const shops=\[.*?\];', re.DOTALL)
html = old_shops_pat.sub(new_shops_data.strip(), html, count=1)
print("2. Shops data expanded to 13 fields")

# ============================================================
# 3. Replace the old shop table render (line ~2560)
# ============================================================
old_render = "$('#shop-table').innerHTML=shops.map(s=>`<tr><td><strong>${s[0]}</strong></td><td>${s[1]}</td><td>${s[2]}</td><td>${s[3]}</td><td class=\"${s[4][0]=='-'?'':'growth'}\">${s[4]}</td><td><span class=\"tag ${s[5]==='正常'?'watch':'hot'}\">${s[5]}</span></td></tr>`).join('');"

# This is the old render. We need to replace it and add all new functions after it.
# Let's find it and replace with a massive block of new code.

new_render_and_functions = r"""
// ========== SHOPS PAGE - FULL REBUILD ==========
var shSelected = new Set();
var shActiveAI = 'benchmark';
var shActiveGroup = 'all';
var shGroups = JSON.parse(localStorage.getItem('mercator_shop_groups') || '{"all":["全部店铺"]}');
var shGroupShops = JSON.parse(localStorage.getItem('mercator_shop_group_shops') || '{}');

// AI Insight data
var shAiBenchmark = [
  {title:'Medicube Official — 美区TikTok美妆标杆', desc:'月GMV US$1,630万，增速+52%，30天波动+35.6%，粉丝58万。核心打法：TikTok Made Me Buy It 常态化运营+达人矩阵+直播日播。品类集中在美容仪器+护肤品组合装，客单价$30-80。', source:'产品全域雷达', time:'今日', idx:25},
  {title:'DealsForYouDays — 欧美家居日用黑马', desc:'月GMV US$507万，增速+100%，30天波动+52.3%。SEESE品牌店运营模式：高频上新+低价引流+TikTok短视频种草。商品数210个，铺货速度全店TOP3。', source:'产品全域雷达', time:'今日', idx:31},
  {title:'Xiaomi Official — 东南亚3C绝对头部', desc:'月GMV US$420万，Lazada旗舰运营，520个在售SKU，粉丝32万。打法：性价比爆款矩阵+平台大促深度参与+本地化售后体系。', source:'店铺追踪', time:'7日', idx:3},
  {title:'Govee US — Amazon家居智能照明标杆', desc:'月GMV US$580万，340个SKU，粉丝21万。核心优势：Amazon Brand Registry+品牌搜索占比35%+A+页面转化率高于类目均值42%。', source:'店铺追踪', time:'7日', idx:9}
];
var shAiRisk = [
  {title:'Rejutan Official MY — 增速异常 +600%', desc:'单月GMV从$14万飙升至$85万，增速+600%远超类目均值。可能原因：大促活动/达人带货爆量/刷单嫌疑。建议持续监控7天确认趋势真实性。', source:'预警中心', time:'今日', idx:27},
  {title:'BIBIGO(菲律宾) — 增速异常 +454%', desc:'食品品类单月暴增，从$6.3万飙升至$35万。食品类在Shopee东南亚合规风险较高，需关注FDA认证+标签合规。', source:'预警中心', time:'今日', idx:29},
  {title:'Toplux Nutrition — GMV下滑 -7.5%', desc:'保健品品类连续3周下滑，30天波动-3.2%。可能原因：竞品低价冲击/平台政策调整/季节性因素。建议对标同品类头部店铺调整策略。', source:'预警中心', time:'7日', idx:33},
  {title:'Poolhacker — 增速+120%但基数极低', desc:'月GMV仅$14万，增速数据参考性有限。户外泳池用品季节性极强，Q4将进入淡季，不建议作为对标对象。', source:'预警中心', time:'7日', idx:28}
];

function shSwitchAI(tab) {
  shActiveAI = tab;
  document.querySelectorAll('.sh-ai-tab').forEach(function(b){b.classList.toggle('active', b.dataset.aitab===tab)});
  shRenderAI();
}

function shRenderAI() {
  var list = shActiveAI === 'benchmark' ? shAiBenchmark : shAiRisk;
  var el = document.getElementById('sh-ai-content');
  if(!el) return;
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';
  list.forEach(function(item, i) {
    var borderColor = shActiveAI === 'benchmark' ? 'var(--green)' : '#e53935';
    html += '<div style="border:1px solid ' + borderColor + ';border-radius:8px;padding:14px;background:var(--paper)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">';
    html += '<strong style="font-size:14px;color:var(--ink)">' + item.title + '</strong>';
    html += '<span style="font-size:11px;color:var(--muted);white-space:nowrap;margin-left:8px">' + item.time + '</span>';
    html += '</div>';
    html += '<p style="font-size:12px;color:#555;line-height:1.6;margin:0 0 10px">' + item.desc + '</p>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button class="sh-ai-src" data-idx="' + item.idx + '" style="font-size:11px;padding:3px 8px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">🔗 溯源定位</button>';
    html += '<button class="sh-ai-report" data-title="' + encodeURIComponent(item.title) + '" data-desc="' + encodeURIComponent(item.desc) + '" style="font-size:11px;padding:3px 8px;border:1px solid var(--orange);color:var(--orange);border-radius:4px;background:transparent;cursor:pointer">+ 加入素材</button>';
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;

  // Event delegation for source buttons
  el.querySelectorAll('.sh-ai-src').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      shCloseModal();
      setTimeout(function(){ shShowDetail(idx); }, 100);
    });
  });
  el.querySelectorAll('.sh-ai-report').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var title = decodeURIComponent(this.dataset.title);
      var desc = decodeURIComponent(this.dataset.desc);
      var pool = JSON.parse(localStorage.getItem('mercator_report_pool') || '[]');
      pool.push({type:'shop-insight', title:title, content:desc, ts:Date.now()});
      localStorage.setItem('mercator_report_pool', JSON.stringify(pool));
      toast('已加入报告素材: ' + title.substring(0,20));
    });
  });
}

// ========== FILTERS ==========
function shInitFilters() {
  var regions = [], plats = [], cats = [], allTags = [];
  shops.forEach(function(s) {
    if(regions.indexOf(s[2])<0) regions.push(s[2]);
    if(plats.indexOf(s[1])<0) plats.push(s[1]);
    if(cats.indexOf(s[6])<0) cats.push(s[6]);
    if(s[9]) { s[9].split(',').forEach(function(t){ t=t.trim(); if(t && allTags.indexOf(t)<0) allTags.push(t); }); }
  });
  var rSel = document.getElementById('sh-f-region');
  var pSel = document.getElementById('sh-f-platform');
  var cSel = document.getElementById('sh-f-cat');
  var tSel = document.getElementById('sh-f-tag');
  regions.forEach(function(r){ var o=document.createElement('option'); o.value=r; o.textContent=r; rSel.appendChild(o); });
  plats.forEach(function(p){ var o=document.createElement('option'); o.value=p; o.textContent=p; pSel.appendChild(o); });
  cats.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; cSel.appendChild(o); });
  allTags.forEach(function(t){ var o=document.createElement('option'); o.value=t; o.textContent=t; tSel.appendChild(o); });

  ['sh-f-region','sh-f-platform','sh-f-cat','sh-f-status','sh-f-gmv','sh-f-tag','sh-f-sort'].forEach(function(id){
    document.getElementById(id).addEventListener('change', shApplyFilters);
  });
  document.getElementById('sh-f-keyword').addEventListener('input', shApplyFilters);
}

function shParseGMV(s) {
  var m = s.replace(/[^0-9.]/g, '');
  return parseFloat(m) || 0;
}

function shApplyFilters() {
  var region = document.getElementById('sh-f-region').value;
  var plat = document.getElementById('sh-f-platform').value;
  var cat = document.getElementById('sh-f-cat').value;
  var status = document.getElementById('sh-f-status').value;
  var gmv = document.getElementById('sh-f-gmv').value;
  var tag = document.getElementById('sh-f-tag').value;
  var kw = document.getElementById('sh-f-keyword').value.trim().toLowerCase();
  var sort = document.getElementById('sh-f-sort').value;

  var filtered = shops.map(function(s,i){ return {s:s,idx:i}; }).filter(function(o) {
    var s = o.s;
    if(shActiveGroup !== 'all') {
      var grpShops = shGroupShops[shActiveGroup] || [];
      if(grpShops.indexOf(o.idx) < 0) return false;
    }
    if(region && s[2] !== region) return false;
    if(plat && s[1] !== plat) return false;
    if(cat && s[6] !== cat) return false;
    if(status && s[5] !== status) return false;
    if(tag && (!s[9] || s[9].indexOf(tag) < 0)) return false;
    if(kw && s[0].toLowerCase().indexOf(kw)<0 && s[6].toLowerCase().indexOf(kw)<0) return false;
    if(gmv) {
      var g = shParseGMV(s[3]);
      if(gmv==='0-100' && g>100) return false;
      if(gmv==='100-300' && (g<100||g>300)) return false;
      if(gmv==='300-500' && (g<300||g>500)) return false;
      if(gmv==='500+' && g<500) return false;
    }
    return true;
  });

  // Sort
  filtered.sort(function(a,b) {
    var sa=a.s, sb=b.s;
    switch(sort) {
      case 'gmv_asc': return shParseGMV(sa[3]) - shParseGMV(sb[3]);
      case 'gmv_desc': return shParseGMV(sb[3]) - shParseGMV(sa[3]);
      case 'growth_desc': return parseFloat(sb[4]) - parseFloat(sa[4]);
      case 'growth_asc': return parseFloat(sa[4]) - parseFloat(sb[4]);
      case 'products_desc': return (sb[7]||0) - (sa[7]||0);
      default: return shParseGMV(sb[3]) - shParseGMV(sa[3]);
    }
  });

  shRenderTable(filtered);
  document.getElementById('sh-count').textContent = '(' + filtered.length + '/' + shops.length + ')';
}

function shStatusCls(st) {
  if(st === '正常') return 'watch';
  if(st === '风险') return 'hot';
  return 'alert-tag';
}

function shRenderTable(list) {
  var tbody = document.getElementById('shop-table');
  if(!tbody) return;
  tbody.innerHTML = list.map(function(o) {
    var s = o.s; var idx = o.idx;
    var checked = shSelected.has(idx) ? 'checked' : '';
    var growthCls = s[4].charAt(0) === '-' ? '' : 'growth';
    var waveCls = s[8].charAt(0) === '-' ? 'style="color:#e53935"' : 'style="color:var(--green)"';
    var tagsHtml = '';
    if(s[9]) {
      s[9].split(',').forEach(function(t) {
        t = t.trim();
        var tc = t === '对标头部' ? 'var(--green)' : t === '低价竞品' ? 'var(--orange)' : 'var(--muted)';
        tagsHtml += '<span style="display:inline-block;font-size:10px;padding:1px 6px;border:1px solid ' + tc + ';color:' + tc + ';border-radius:3px;margin-right:3px">' + t + '</span>';
      });
    }
    return '<tr>' +
      '<td><input type="checkbox" class="sh-cb" data-idx="' + idx + '" ' + checked + ' onchange="shToggleOne(' + idx + ',this.checked)"></td>' +
      '<td><strong style="cursor:pointer;color:var(--green)" class="sh-shop-link" data-idx="' + idx + '">' + s[0] + '</strong></td>' +
      '<td>' + s[1] + '</td>' +
      '<td>' + s[2] + '</td>' +
      '<td>' + s[6] + '</td>' +
      '<td><strong>' + s[3] + '</strong></td>' +
      '<td ' + waveCls + '>' + s[8] + '</td>' +
      '<td>' + s[7] + '</td>' +
      '<td class="' + growthCls + '">' + s[4] + '</td>' +
      '<td style="font-size:12px">' + (s[10]||'-') + '</td>' +
      '<td>' + tagsHtml + '</td>' +
      '<td><span class="tag ' + shStatusCls(s[5]) + '">' + s[5] + '</span></td>' +
      '<td style="font-size:11px;color:var(--muted)">' + (s[12]||'') + '</td>' +
      '</tr>';
  }).join('');

  // Event delegation for shop links
  tbody.querySelectorAll('.sh-shop-link').forEach(function(el) {
    el.addEventListener('click', function() {
      shShowDetail(parseInt(this.dataset.idx));
    });
  });
  // Checkbox events
  tbody.querySelectorAll('.sh-cb').forEach(function(el) {
    el.addEventListener('change', function() {
      shToggleOne(parseInt(this.dataset.idx), this.checked);
    });
  });
}

function shToggleOne(idx, checked) {
  if(checked) shSelected.add(idx); else shSelected.delete(idx);
  shUpdateBatch();
}
function shToggleAll(checked) {
  document.querySelectorAll('.sh-cb').forEach(function(cb){ cb.checked=checked; shToggleOne(parseInt(cb.dataset.idx), checked); });
}
function shClearSelection() {
  shSelected.clear();
  document.querySelectorAll('.sh-cb').forEach(function(cb){ cb.checked=false; });
  document.getElementById('sh-select-all').checked = false;
  shUpdateBatch();
}
function shUpdateBatch() {
  var bar = document.getElementById('sh-batch-bar');
  bar.style.display = shSelected.size > 0 ? 'flex' : 'none';
  document.getElementById('sh-batch-count').textContent = '已选 ' + shSelected.size + ' 家';
}

// ========== SHOP DETAIL MODAL ==========
function shShowDetail(idx) {
  var s = shops[idx]; if(!s) return;
  document.getElementById('sh-modal-title').textContent = s[0] + ' — ' + s[1] + ' (' + s[2] + ')';
  var body = document.getElementById('sh-modal-body');

  // Generate 30-day trend data
  var baseGMV = shParseGMV(s[3]);
  var trendData = [];
  for(var i=0; i<30; i++) {
    var variance = (Math.random()-0.4) * baseGMV * 0.08;
    trendData.push(Math.max(0, baseGMV/30 + variance));
  }
  var maxTrend = Math.max.apply(null, trendData);
  var minTrend = Math.min.apply(null, trendData);

  // Generate category distribution
  var mainCat = s[6];
  var cats = [[mainCat, 45]];
  var remaining = 55;
  var otherCats = ['家居日用','3C数码','时尚服饰','食品','运动户外'];
  for(var i=0; i<3 && remaining>0; i++) {
    var pct = Math.min(remaining, Math.floor(Math.random()*20)+5);
    cats.push([otherCats[i], pct]);
    remaining -= pct;
  }
  if(remaining > 0) cats.push(['其他', remaining]);

  var catColors = ['var(--green)','var(--orange)','#4a90d9','#c8a84e','#999'];

  var html = '';
  // 4-block layout
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';

  // Block 1: Revenue trend
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">📈 30天GMV趋势</h4>';
  html += '<div style="display:flex;align-items:end;gap:2px;height:100px">';
  trendData.forEach(function(v,i) {
    var h = Math.max(4, (v/maxTrend)*90);
    var color = i >= 25 ? 'var(--green)' : '#ccc';
    html += '<div style="flex:1;height:' + h + 'px;background:' + color + ';border-radius:2px 2px 0 0" title="Day ' + (i+1) + ': $' + v.toFixed(1) + '万"></div>';
  });
  html += '</div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px">';
  html += '<span>30天前</span><span>今日</span></div>';
  html += '<div style="margin-top:8px;font-size:12px"><strong>' + s[3] + '</strong> / 30天波动 <span ' + (s[8].charAt(0)==='-'?'style="color:#e53935"':'style="color:var(--green)"') + '>' + s[8] + '</span></div>';
  html += '</div>';

  // Block 2: Category distribution
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">🏷️ 品类分布</h4>';
  cats.forEach(function(c, i) {
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
    html += '<div style="width:10px;height:10px;border-radius:2px;background:' + catColors[i] + '"></div>';
    html += '<span style="font-size:12px;flex:1">' + c[0] + '</span>';
    html += '<span style="font-size:12px;font-weight:600">' + c[1] + '%</span>';
    html += '</div>';
  });
  html += '</div>';

  // Block 3: Top products
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">🔥 店内爆款TOP5</h4>';
  var topProducts = ['爆款A - ' + mainCat, '爆款B - ' + mainCat, '新品C - 周边品类', '长款D - ' + mainCat, '引流款E - 低价品'];
  var topSales = [Math.floor(baseGMV*0.15), Math.floor(baseGMV*0.1), Math.floor(baseGMV*0.08), Math.floor(baseGMV*0.06), Math.floor(baseGMV*0.04)];
  topProducts.forEach(function(p,i) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f0f0f0">';
    html += '<span style="font-size:12px">' + (i+1) + '. ' + p + '</span>';
    html += '<span style="font-size:11px;color:var(--green)">$' + topSales[i] + '万</span>';
    html += '</div>';
  });
  html += '<button onclick="shCloseModal();switchPage(\'products\');setTimeout(function(){document.getElementById(\'sh-f-keyword\').value=\'' + s[0].substring(0,8) + '\';shApplyFilters();},200)" style="margin-top:8px;font-size:11px;padding:4px 10px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">🔗 跳转产品雷达查看全店商品</button>';
  html += '</div>';

  // Block 4: Risk records
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">⚠️ 经营风险记录</h4>';
  var risks = [];
  if(s[5] === '关注') risks.push({level:'mid', text:'增速异常波动，需持续监控', time:'今日'});
  if(parseFloat(s[4]) > 100) risks.push({level:'high', text:'增速超100%，存在刷单/异常流量嫌疑', time:'3日前'});
  if(s[8].charAt(0) === '-') risks.push({level:'mid', text:'30天GMV下滑，关注是否为季节性调整', time:'7日前'});
  if(risks.length === 0) risks.push({level:'low', text:'经营平稳，暂无异常记录', time:'持续'});
  risks.push({level:'info', text:'店铺评分 ' + s[11] + '，粉丝 ' + s[10], time:'实时'});
  risks.forEach(function(r) {
    var cls = r.level==='high' ? '#e53935' : r.level==='mid' ? 'var(--orange)' : r.level==='info' ? 'var(--green)' : 'var(--muted)';
    html += '<div style="display:flex;gap:8px;align-items:start;padding:4px 0;border-bottom:1px solid #f0f0f0">';
    html += '<span style="width:6px;height:6px;border-radius:50%;background:' + cls + ';margin-top:5px;flex-shrink:0"></span>';
    html += '<span style="font-size:12px;flex:1">' + r.text + '</span>';
    html += '<span style="font-size:10px;color:var(--muted)">' + r.time + '</span>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>';

  // Bottom actions
  html += '<div style="display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #eee">';
  html += '<button onclick="shAddToReport(' + idx + ')" style="padding:6px 14px;border:1px solid var(--orange);color:var(--orange);border-radius:6px;background:transparent;cursor:pointer;font-size:12px">+ 加入报告素材</button>';
  html += '<button onclick="shCloseModal();switchPage(\'countries\')" style="padding:6px 14px;border:1px solid var(--green);color:var(--green);border-radius:6px;background:transparent;cursor:pointer;font-size:12px">🌍 跳转国家市场</button>';
  html += '<button onclick="shCloseModal();switchPage(\'alerts\')" style="padding:6px 14px;border:1px solid #e53935;color:#e53935;border-radius:6px;background:transparent;cursor:pointer;font-size:12px">🔔 设置预警</button>';
  html += '</div>';

  body.innerHTML = html;
  document.getElementById('sh-modal-overlay').classList.add('show');
}

function shCloseModal() {
  document.getElementById('sh-modal-overlay').classList.remove('show');
}

function shAddToReport(idx) {
  var s = shops[idx];
  var pool = JSON.parse(localStorage.getItem('mercator_report_pool') || '[]');
  pool.push({type:'shop', title:s[0]+' ('+s[1]+')', content:'月GMV '+s[3]+' 增速'+s[4]+' 主营'+s[6]+' 状态:'+s[5], ts:Date.now()});
  localStorage.setItem('mercator_report_pool', JSON.stringify(pool));
  toast('已加入报告素材: ' + s[0]);
}

// ========== BATCH OPS ==========
function shBatchAddReport() {
  var pool = JSON.parse(localStorage.getItem('mercator_report_pool') || '[]');
  shSelected.forEach(function(idx) {
    var s = shops[idx];
    pool.push({type:'shop', title:s[0]+' ('+s[1]+')', content:'月GMV '+s[3]+' 增速'+s[4]+' 主营'+s[6], ts:Date.now()});
  });
  localStorage.setItem('mercator_report_pool', JSON.stringify(pool));
  toast('已批量加入 ' + shSelected.size + ' 家店铺到报告素材');
  shClearSelection();
}
function shBatchSetAlert() {
  toast('已为 ' + shSelected.size + ' 家店铺设置预警规则');
  shClearSelection();
}
function shBatchRemove() {
  toast('已移除 ' + shSelected.size + ' 家店铺监控');
  shClearSelection();
}

// ========== ADD SHOP ==========
function shOpenAddModal() { document.getElementById('sh-add-overlay').classList.add('show'); }
function shCloseAddModal() { document.getElementById('sh-add-overlay').classList.remove('show'); }
function shSwitchAddTab(tab) {
  document.querySelectorAll('.sh-add-tab').forEach(function(b){b.classList.toggle('active',b.dataset.addtab===tab)});
  document.getElementById('sh-add-single').style.display = tab==='single'?'block':'none';
  document.getElementById('sh-add-batch').style.display = tab==='batch'?'block':'none';
  document.getElementById('sh-add-link').style.display = tab==='link'?'block':'none';
}
function shDoAddSingle() {
  var name = document.getElementById('sh-add-name').value.trim();
  var plat = document.getElementById('sh-add-platform').value.trim() || '未知';
  var market = document.getElementById('sh-add-market').value.trim() || '未知';
  var cat = document.getElementById('sh-add-cat').value.trim() || '未分类';
  var tags = document.getElementById('sh-add-tags').value.trim() || '';
  if(!name) { toast('请输入店铺名称'); return; }
  shops.push([name, plat, market, 'US$ 0万', '+0%', '正常', cat, 0, '+0%', tags, '0', '0', '刚刚']);
  shCloseAddModal();
  shApplyFilters();
  toast('已添加店铺: ' + name);
  // Also add to products cross-link
  var pool = JSON.parse(localStorage.getItem('mercator_report_pool') || '[]');
  pool.push({type:'shop', title:name+' ('+plat+')', content:'新添加监控店铺 主营'+cat, ts:Date.now()});
  localStorage.setItem('mercator_report_pool', JSON.stringify(pool));
}
function shDoAddBatch() {
  var text = document.getElementById('sh-add-batch-text').value.trim();
  if(!text) { toast('请粘贴店铺名称'); return; }
  var lines = text.split('\n').filter(function(l){return l.trim()});
  var count = 0;
  lines.forEach(function(line) {
    var name = line.trim();
    if(name) {
      shops.push([name, '未知', '未知', 'US$ 0万', '+0%', '正常', '未分类', 0, '+0%', '', '0', '0', '刚刚']);
      count++;
    }
  });
  shCloseAddModal();
  shApplyFilters();
  toast('已批量导入 ' + count + ' 家店铺');
}

// ========== GROUPS ==========
function shRenderGroups() {
  var el = document.getElementById('sh-group-tabs');
  var html = '<button class="sh-grp ' + (shActiveGroup==='all'?'active':'') + '" data-grp="all" onclick="shSwitchGroup(\'all\')">全部店铺</button>';
  Object.keys(shGroups).forEach(function(k) {
    if(k === 'all') return;
    html += '<button class="sh-grp ' + (shActiveGroup===k?'active':'') + '" data-grp="' + k + '" onclick="shSwitchGroup(\'' + k + '\')">' + k + ' <span style="font-size:10px;color:var(--muted)">(' + (shGroupShops[k]||[]).length + ')</span></button>';
  });
  el.innerHTML = html;
}
function shSwitchGroup(grp) {
  shActiveGroup = grp;
  shRenderGroups();
  shApplyFilters();
}
function shNewGroup() {
  var name = prompt('输入分组名称（如：东南亚美妆对标店铺）');
  if(!name) return;
  shGroups[name] = name;
  shGroupShops[name] = [];
  localStorage.setItem('mercator_shop_groups', JSON.stringify(shGroups));
  localStorage.setItem('mercator_shop_group_shops', JSON.stringify(shGroupShops));
  shRenderGroups();
  toast('已创建分组: ' + name);
}

// ========== TEMPLATES ==========
function shSaveTpl() {
  var state = {
    region: document.getElementById('sh-f-region').value,
    platform: document.getElementById('sh-f-platform').value,
    cat: document.getElementById('sh-f-cat').value,
    status: document.getElementById('sh-f-status').value,
    gmv: document.getElementById('sh-f-gmv').value,
    tag: document.getElementById('sh-f-tag').value,
    keyword: document.getElementById('sh-f-keyword').value,
    sort: document.getElementById('sh-f-sort').value
  };
  var tpls = JSON.parse(localStorage.getItem('mercator_shop_tpl') || '[]');
  var name = prompt('模板名称', state.region + ' ' + state.platform + ' ' + state.cat);
  if(!name) return;
  state.name = name;
  tpls.push(state);
  localStorage.setItem('mercator_shop_tpl', JSON.stringify(tpls));
  shRenderTplSelect();
  toast('模板已保存: ' + name);
}
function shRenderTplSelect() {
  var sel = document.getElementById('sh-tpl-select');
  var tpls = JSON.parse(localStorage.getItem('mercator_shop_tpl') || '[]');
  sel.innerHTML = '<option value="">加载模板...</option>' + tpls.map(function(t,i){ return '<option value="' + i + '">' + t.name + '</option>'; }).join('');
}
function shLoadTpl(idx) {
  if(idx === '') return;
  var tpls = JSON.parse(localStorage.getItem('mercator_shop_tpl') || '[]');
  var t = tpls[parseInt(idx)]; if(!t) return;
  document.getElementById('sh-f-region').value = t.region || '';
  document.getElementById('sh-f-platform').value = t.platform || '';
  document.getElementById('sh-f-cat').value = t.cat || '';
  document.getElementById('sh-f-status').value = t.status || '';
  document.getElementById('sh-f-gmv').value = t.gmv || '';
  document.getElementById('sh-f-tag').value = t.tag || '';
  document.getElementById('sh-f-keyword').value = t.keyword || '';
  document.getElementById('sh-f-sort').value = t.sort || 'gmv_desc';
  shApplyFilters();
  toast('已加载模板: ' + t.name);
}

// ========== EXPORT ==========
function shExportExcel() {
  var header = '店铺名\t平台\t市场\t主营类目\t月GMV\t30天波动\t在售商品\t增速\t粉丝数\t标签\t状态\t更新时间';
  var rows = shops.map(function(s){ return s.join('\t'); });
  var csv = '\uFEFF' + header + '\n' + rows.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shop_tracker_export.csv';
  a.click();
  toast('Excel导出完成');
}
function shExportPDF() {
  var md = '# 店铺追踪竞品分析报告\\n\\n';
  md += '导出时间: ' + new Date().toLocaleString() + '\\n\\n';
  md += '## 监控概览\\n\\n';
  md += '- 监控店铺总数: ' + shops.length + '\\n';
  var regions = {};
  shops.forEach(function(s){ regions[s[2]] = (regions[s[2]]||0)+1; });
  Object.keys(regions).forEach(function(r){ md += '- ' + r + ': ' + regions[r] + '家\\n'; });
  md += '\\n## 头部店铺分析\\n\\n';
  shops.filter(function(s){ return shParseGMV(s[3]) >= 300; }).sort(function(a,b){ return shParseGMV(b[3])-shParseGMV(a[3]); }).forEach(function(s){
    md += '### ' + s[0] + '\\n';
    md += '- 平台: ' + s[1] + ' | 市场: ' + s[2] + ' | 类目: ' + s[6] + '\\n';
    md += '- 月GMV: ' + s[3] + ' | 增速: ' + s[4] + ' | 30天波动: ' + s[8] + '\\n';
    md += '- 在售商品: ' + s[7] + ' | 粉丝: ' + s[10] + ' | 评分: ' + s[11] + '\\n';
    md += '- 状态: ' + s[5] + ' | 标签: ' + (s[9]||'无') + '\\n\\n';
  });
  var blob = new Blob([md.replace(/\\n/g, '\n')], {type:'text/markdown;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shop_analysis_report.md';
  a.click();
  toast('PDF报告片段导出完成');
}

// ========== INIT ==========
(function initShopsPage() {
  shInitFilters();
  shRenderAI();
  shRenderGroups();
  shRenderTplSelect();
  shApplyFilters();
})();
"""

# Find and replace the old render line
html = html.replace(old_render, new_render_and_functions)
print("3. Shop render + all functions replaced")

# ============================================================
# 4. Add CSS for shops page
# ============================================================
css_addition = """
/* ===== SHOPS PAGE STYLES ===== */
.sh-ai-tab { padding:6px 16px; border:1px solid #ddd; border-radius:6px; background:transparent; cursor:pointer; font-size:13px; color:var(--ink); transition:all .2s }
.sh-ai-tab.active { background:var(--green); color:#fff; border-color:var(--green) }
.sh-group-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px }
.sh-grp { padding:5px 14px; border:1px solid #ddd; border-radius:16px; background:transparent; cursor:pointer; font-size:12px; color:var(--ink); transition:all .2s }
.sh-grp.active { background:var(--orange); color:#fff; border-color:var(--orange) }
.sh-add-grp { font-size:11px; color:var(--green); background:transparent; border:1px dashed var(--green); border-radius:16px; padding:3px 12px; cursor:pointer; margin-bottom:10px }
.sh-filter-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:14px; padding:12px; background:#f9f8f5; border-radius:8px; border:1px solid #e8e4dd }
.sh-filter-bar select, .sh-filter-bar input { padding:6px 10px; border:1px solid #ddd; border-radius:6px; font-size:12px; background:#fff }
.sh-action-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px }
.sh-batch-bar { display:flex; gap:8px; align-items:center; padding:10px 14px; background:#fff3e0; border:1px solid var(--orange); border-radius:8px; margin-bottom:12px }
.sh-batch-bar button { padding:4px 12px; border:1px solid var(--orange); color:var(--orange); border-radius:4px; background:transparent; cursor:pointer; font-size:12px }
.sh-batch-bar span { font-size:13px; font-weight:600; color:var(--orange); margin-right:8px }
.sh-modal-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:2000; justify-content:center; align-items:center }
.sh-modal-overlay.show { display:flex }
.sh-modal { background:#fff; border-radius:12px; max-width:800px; width:90%; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3) }
.sh-modal-head { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #eee }
.sh-modal-head h3 { margin:0; font-size:16px; color:var(--ink) }
.sh-modal-head button { background:transparent; border:none; font-size:18px; cursor:pointer; color:var(--muted) }
.sh-modal-body { padding:20px }
.sh-add-tab { padding:6px 14px; border:1px solid #ddd; border-radius:6px; background:transparent; cursor:pointer; font-size:12px; color:var(--ink) }
.sh-add-tab.active { background:var(--green); color:#fff; border-color:var(--green) }
.alert-tag { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; background:#fff3e0; color:var(--orange); border:1px solid var(--orange) }
"""

# Insert CSS before closing </style>
html = html.replace('</style>', css_addition + '\n</style>', 1)
print("4. CSS added")

# ============================================================
# 5. Write output
# ============================================================
with open(fp, 'w', encoding='utf-8') as f:
    f.write(html)
print("Done! File size:", len(html), "bytes")
