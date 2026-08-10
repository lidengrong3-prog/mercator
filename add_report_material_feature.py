#!/usr/bin/env python3
"""
Add 'Add to Report Material' feature across all pages + enhance Report Center.
"""

import re
import json

with open('index.html', 'r', encoding='utf-8') as f:
    data = f.read()

original_len = len(data)
print(f'Original size: {original_len}')

# ========== 1. Add global material pool JS code before switchPage function ==========
material_pool_js = """
// ===== Report Material Pool (Global) =====
const RP_POOL_KEY = 'mercator_report_pool';
function rpGetPool() {
  try { return JSON.parse(localStorage.getItem(RP_POOL_KEY) || '[]'); }
  catch(e) { return []; }
}
function rpSavePool(pool) {
  localStorage.setItem(RP_POOL_KEY, JSON.stringify(pool));
  rpUpdatePoolUI();
}
function rpAddMaterial(type, title, source, summary) {
  var pool = rpGetPool();
  var id = Date.now() + '_' + Math.random().toString(36).substr(2,5);
  pool.push({id:id, type:type, title:title, source:source, summary:summary, addedAt:new Date().toISOString()});
  rpSavePool(pool);
  toast('已加入报告素材 (' + pool.length + ')');
}
function rpRemoveMaterial(id) {
  var pool = rpGetPool().filter(function(m){return m.id!==id});
  rpSavePool(pool);
}
function rpUpdatePoolUI() {
  var pool = rpGetPool();
  var countEl = document.querySelector('.rp-stat-card .rp-stat-num');
  if (countEl && countEl.parentElement.querySelector('.rp-stat-label').textContent.includes('素材池')) {
    countEl.textContent = pool.length;
  }
  var selectedEl = document.querySelectorAll('.rp-stat-num')[1];
  if (selectedEl) selectedEl.textContent = pool.length;
  // Render pool items
  var poolContainer = document.getElementById('rp-material-pool');
  if (!poolContainer) return;
  if (pool.length === 0) {
    poolContainer.innerHTML = '<div class="rp-empty-state"><span class="rp-empty-icon">✦</span><p>暂无素材</p><small>在各页面点击"加入报告素材"按钮，数据将自动汇入素材池</small></div>';
    return;
  }
  var html = '<div class="rp-pool-list">';
  pool.forEach(function(m) {
    var typeColors = {country:'var(--green)',platform:'var(--orange)',product:'#6366f1',shop:'#8b5cf6',policy:'#ef4444',rule:'#f59e0b',content:'#ec4899',alert:'#64748b'};
    var typeLabels = {country:'国家市场',platform:'平台档案',product:'爆款商品',shop:'店铺',policy:'政策',rule:'规则',content:'内容',alert:'预警'};
    var color = typeColors[m.type] || 'var(--muted)';
    var label = typeLabels[m.type] || m.type;
    var date = new Date(m.addedAt);
    var dateStr = date.getMonth()+1 + '/' + date.getDate() + ' ' + date.getHours() + ':' + String(date.getMinutes()).padStart(2,'0');
    html += '<div class="rp-pool-item" data-id="' + m.id + '">';
    html += '<div class="rp-pool-type" style="background:' + color + '">' + label + '</div>';
    html += '<div class="rp-pool-info"><strong>' + m.title + '</strong><span>' + m.source + '</span></div>';
    html += '<div class="rp-pool-meta"><small>' + dateStr + '</small>';
    html += '<button class="rp-pool-remove" onclick="rpRemoveMaterial(\\'' + m.id + '\\');rpRenderPool()">×</button></div>';
    html += '</div>';
  });
  html += '</div>';
  poolContainer.innerHTML = html;
}
function rpRenderPool() { rpUpdatePoolUI(); }
function rpGenerateReport(tpl) {
  var pool = rpGetPool();
  var names = {'market-research':'全球市场调研报告','competitor-analysis':'竞品分析报告','market-entry':'市场进入方案','product-selection':'选品策略报告','compliance-risk':'合规风险评估报告'};
  var area = document.getElementById('rp-preview-area');
  if (!area) return;
  area.innerHTML = '<div class="rp-generating"><div class="rp-gen-spinner"></div><p>正在生成 ' + names[tpl] + ' ...</p><small>正在整合素材池 ' + pool.length + ' 条数据</small></div>';
  setTimeout(function() {
    var reportHTML = '<div class="rp-report-preview"><h3>' + names[tpl] + '</h3>';
    reportHTML += '<p class="rp-report-meta">生成时间: ' + new Date().toLocaleString('zh-CN') + ' | 素材来源: ' + pool.length + ' 条</p>';
    reportHTML += '<div class="rp-report-section"><h4>一、素材概览</h4>';
    var typeCount = {};
    pool.forEach(function(m){ typeCount[m.type] = (typeCount[m.type]||0)+1; });
    reportHTML += '<ul>';
    Object.keys(typeCount).forEach(function(t){
      var labels = {country:'国家市场',platform:'平台档案',product:'爆款商品',shop:'店铺',policy:'政策',rule:'规则',content:'内容',alert:'预警'};
      reportHTML += '<li>' + (labels[t]||t) + ': ' + typeCount[t] + ' 条</li>';
    });
    reportHTML += '</ul></div>';
    reportHTML += '<div class="rp-report-section"><h4>二、AI 智能分析</h4>';
    reportHTML += '<p>基于 ' + pool.length + ' 条素材数据，系统已自动完成以下分析：</p>';
    reportHTML += '<ul><li>市场机会识别与优先级排序</li><li>竞争格局与差异化建议</li><li>合规风险点提示</li><li>运营策略与资源投入建议</li></ul></div>';
    reportHTML += '<div class="rp-report-section"><h4>三、执行建议</h4>';
    reportHTML += '<p>根据素材池数据，建议优先关注以下方向：</p><ol>';
    pool.slice(0,5).forEach(function(m,i){ reportHTML += '<li>' + m.title + ' - ' + m.summary + '</li>'; });
    reportHTML += '</ol></div></div>';
    area.innerHTML = reportHTML;
    toast('报告生成完成');
  }, 2000);
}
function rpExportReport(format) {
  var pool = rpGetPool();
  if (pool.length === 0) { toast('素材池为空，请先添加素材'); return; }
  toast('正在导出 ' + format + ' 报告...');
  // Simulate export
  setTimeout(function() {
    var content = '# Mercator 市场调研报告\\n\\n';
    content += '生成时间: ' + new Date().toLocaleString('zh-CN') + '\\n\\n';
    content += '## 素材清单 (' + pool.length + '条)\\n\\n';
    pool.forEach(function(m, i) {
      content += (i+1) + '. [' + m.type + '] ' + m.title + '\\n';
      content += '   来源: ' + m.source + '\\n';
      content += '   摘要: ' + m.summary + '\\n\\n';
    });
    var blob = new Blob([content], {type: 'text/markdown'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Mercator_Report_' + Date.now() + '.md';
    a.click();
    URL.revokeObjectURL(url);
    toast('报告已导出');
  }, 1000);
}
// Initialize pool UI on page load
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(rpUpdatePoolUI, 100);
});
"""

# Insert before switchPage function
sp_pos = data.find('function switchPage(name)')
data = data[:sp_pos] + material_pool_js + '\n' + data[sp_pos:]
print(f'After material pool JS: {len(data)}')

# ========== 2. Add CSS for material pool items ==========
css_addition = """
.rp-pool-list{display:grid;gap:8px;max-height:400px;overflow-y:auto}
.rp-pool-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:6px;transition:.15s}
.rp-pool-item:hover{border-color:var(--green);background:#f8faf8}
.rp-pool-type{padding:3px 8px;border-radius:4px;font-size:10px;color:#fff;font-weight:600;white-space:nowrap}
.rp-pool-info{flex:1;min-width:0}
.rp-pool-info strong{display:block;font-size:12px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rp-pool-info span{font:10px 'DM Mono';color:var(--muted)}
.rp-pool-meta{display:flex;align-items:center;gap:8px}
.rp-pool-meta small{font:10px 'DM Mono';color:#a0aba6}
.rp-pool-remove{background:none;border:0;color:var(--muted);font-size:18px;cursor:pointer;padding:0 4px;line-height:1}
.rp-pool-remove:hover{color:var(--orange)}
.rp-report-preview{padding:20px}
.rp-report-preview h3{font-size:16px;margin:0 0 8px;color:var(--ink)}
.rp-report-meta{font:11px 'DM Mono';color:var(--muted);margin-bottom:16px}
.rp-report-section{margin-bottom:16px;padding:12px;background:#f8faf8;border-radius:6px}
.rp-report-section h4{font-size:13px;margin:0 0 8px;color:var(--green)}
.rp-report-section p,.rp-report-section li{font-size:12px;line-height:1.6;color:var(--ink);margin:4px 0}
.rp-report-section ul,.rp-report-section ol{margin:8px 0;padding-left:20px}
.add-to-report-btn{border:1px solid var(--green);background:#fff;color:var(--green);padding:6px 12px;border-radius:4px;font-size:11px;cursor:pointer;transition:.15s;white-space:nowrap}
.add-to-report-btn:hover{background:var(--green);color:#fff}
"""
style_close = data.find('</style>')
data = data[:style_close] + css_addition + data[style_close:]
print(f'After CSS: {len(data)}')

# ========== 3. Add "加入报告素材" buttons to each page header-tools ==========
# Find all header-tools divs and add button

# For overview page
ov_header = data.find('<section id="overview"')
if ov_header > 0:
    # Find the main header-tools (it's shared, so we add a dynamic button)
    pass

# Actually, the header is shared across all pages. We need to add a context-aware button
# that changes based on current page. Let's modify the header-tools to include a dynamic button.

# Find header-tools div
header_tools = data.find('<div class="header-tools">')
if header_tools > 0:
    # Find the closing </div> of header-tools
    ht_end = data.find('</div>', header_tools)
    # Insert button before closing div
    button_html = '<button class="add-to-report-btn" id="add-to-report-btn" onclick="rpAddCurrentToPool()">✦ 加入报告素材</button>'
    data = data[:ht_end] + button_html + data[ht_end:]
    print(f'Added global button to header-tools')

# ========== 4. Add rpAddCurrentToPool function that detects current page ==========
add_current_fn = """
function rpAddCurrentToPool() {
  var activePage = document.querySelector('.page.active');
  if (!activePage) { toast('请先选择数据'); return; }
  var pageId = activePage.id;
  var type = '', title = '', source = '', summary = '';
  
  if (pageId === 'overview') {
    type = 'alert'; title = '首页总览数据'; source = 'Global Overview';
    summary = '包含全球市场机会评分、热点趋势、预警汇总等核心数据';
  } else if (pageId === 'watchlist') {
    type = 'alert'; title = '我的看板数据'; source = 'Watchlist';
    summary = '包含重点关注的店铺、商品、政策等看板数据';
  } else if (pageId === 'countries') {
    type = 'country'; title = '国家市场档案'; source = 'Country Archive';
    summary = '包含目标国家的市场规模、消费习惯、电商渗透率、政策环境等';
  } else if (pageId === 'platforms') {
    type = 'platform'; title = '电商平台档案'; source = 'Platform Archive';
    summary = '包含平台佣金政策、物流要求、流量分配、入驻条件等';
  } else if (pageId === 'products') {
    type = 'product'; title = '爆款雷达数据'; source = 'Product Radar';
    summary = '包含跨平台热销商品、销量趋势、价格区间、竞品分析';
  } else if (pageId === 'shops') {
    type = 'shop'; title = '店铺追踪数据'; source = 'Shop Tracker';
    summary = '包含标杆店铺运营数据、上新频率、营销策略、用户评价';
  } else if (pageId === 'content') {
    type = 'content'; title = '热门内容数据'; source = 'Content Tracker';
    summary = '包含短视频/直播热门内容、爆款脚本、达人合作机会';
  } else if (pageId === 'policies') {
    type = 'policy'; title = '政策动态数据'; source = 'Policy Tracker';
    summary = '包含最新政策法规、合规要求、关税调整、认证标准';
  } else if (pageId === 'rules') {
    type = 'rule'; title = '平台规则数据'; source = 'Platform Rules';
    summary = '包含平台佣金变动、物流新规、处罚规则、活动日历';
  } else if (pageId === 'alerts') {
    type = 'alert'; title = '预警中心数据'; source = 'Alert Center';
    summary = '包含全系统异动提醒、风险预警、倒计时提醒';
  } else {
    toast('当前页面不支持加入素材');
    return;
  }
  rpAddMaterial(type, title, source, summary);
}
"""

# Insert after rpUpdatePoolUI function
insert_pos = data.find('function rpGenerateReport(tpl)')
data = data[:insert_pos] + add_current_fn + '\n' + data[insert_pos:]
print(f'After addCurrentToPool: {len(data)}')

# ========== 5. Update report section HTML to use dynamic pool rendering ==========
# Find the empty state in report section and make it call rpRenderPool on page switch
old_switch_render = "if(name==='alerts')renderAlerts();"
new_switch_render = "if(name==='alerts')renderAlerts();if(name==='report')rpRenderPool();"
data = data.replace(old_switch_render, new_switch_render)
print(f'After switchPage update: {len(data)}')

# ========== 6. Update export buttons in report center ==========
old_export_word = '<button class="filter-button" onclick="rpExportAll()" style="background:var(--green)">\u5bfc\u51fa\u5168\u90e8\u62a5\u544a (Word)</button>'
new_export_word = '<button class="filter-button" onclick="rpExportReport(\'Word\')" style="background:var(--green)">\u5bfc\u51fa\u62a5\u544a (Markdown)</button>'
data = data.replace(old_export_word, new_export_word)

old_export_pdf = '<button class="filter-button" onclick="rpExportAll()" style="background:var(--orange)">\u5bfc\u51fa PDF</button>'
new_export_pdf = '<button class="filter-button" onclick="rpExportReport(\'PDF\')" style="background:var(--orange)">\u5bfc\u51fa PDF</button>'
data = data.replace(old_export_pdf, new_export_pdf)
print(f'After export buttons: {len(data)}')

# ========== Write output ==========
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(data)

print(f'\nFinal size: {len(data)} (delta: {len(data) - original_len:+d})')
print('Done!')
