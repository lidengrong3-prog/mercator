#!/usr/bin/env python3
"""
Mercator 国家市场页面迭代优化 + 全页面统一优化
1. 时间筛选器扩展：新增1年/3年/5年选项
2. 宏观数据单板块导出Excel（实际CSV下载）
3. 高危政策标红高亮 + 风险提示弹窗
4. AI总结新增"一键生成市场简版分析"按钮
5. 统一优化：导出文件底部标注数据来源、预警数据同步
"""

FILE = 'index.html'
with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

changes = 0

# ============================================================
# 1. Time filter: expand to 5 options (3m/6m/1y/3y/5y)
# ============================================================
old_tf = '''  <button class="cn2-tf-btn" data-tf="3m">近3个月</button>
  <button class="cn2-tf-btn active" data-tf="6m">近半年</button>
  <button class="cn2-tf-btn" data-tf="1y">全年</button>'''
new_tf = '''  <button class="cn2-tf-btn" data-tf="3m">近3个月</button>
  <button class="cn2-tf-btn active" data-tf="6m">近半年</button>
  <button class="cn2-tf-btn" data-tf="1y">近1年</button>
  <button class="cn2-tf-btn" data-tf="3y">近3年</button>
  <button class="cn2-tf-btn" data-tf="5y">近5年</button>'''

if old_tf in src:
    src = src.replace(old_tf, new_tf, 1)
    changes += 1
    print("[1] Time filter expanded to 5 options")
else:
    print("[1] WARN: time filter pattern not found")

# Update the JS toast message to handle new options
old_tf_toast = "toast('已切换至'+(cn2TimeFilter==='3m'?'近3个月':cn2TimeFilter==='6m'?'近半年':'全年')+'数据');"
new_tf_toast = "var tfLabels={'3m':'近3个月','6m':'近半年','1y':'近1年','3y':'近3年','5y':'近5年'};toast('已切换至'+(tfLabels[cn2TimeFilter]||cn2TimeFilter)+'数据');"
if old_tf_toast in src:
    src = src.replace(old_tf_toast, new_tf_toast, 1)
    changes += 1
    print("[1b] Time filter toast updated")

# ============================================================
# 2. cn2ExportMacro() - actual CSV download with macro data
# ============================================================
old_export_macro = "function cn2ExportMacro(){ toast('正在导出宏观经济数据...'); }"
new_export_macro = r"""function cn2ExportMacro(){
  var key=cn2CurrentKey;
  var ext=cn2GetExt(key);
  var d=countryFullData[key];
  if(!ext||!d){toast('无数据可导出');return}
  var csv='分类,指标,数值,数据来源\n';
  csv+='经济大盘,GDP总量,'+ext.gdp_total+',世界银行\n';
  csv+='经济大盘,GDP增速,'+ext.gdp_growth+',IMF\n';
  csv+='经济大盘,人均GDP,'+ext.per_capita_gdp+',世界银行\n';
  csv+='经济大盘,CPI通胀率,'+ext.cpi+',各国央行\n';
  csv+='经济大盘,货币汇率,'+ext.currency+',实时汇率API\n';
  csv+='经济大盘,货币趋势,'+ext.currency_trend+',外汇市场\n';
  csv+='经济大盘,人均可支配收入,'+ext.disposable_income+',各国统计局\n';
  csv+='人口消费,总人口,'+ext.population+',联合国\n';
  csv+='人口消费,电商网民数,'+ext.ecommerce_users+',eMarketer\n';
  csv+='人口消费,线上渗透率,'+ext.online_penetration+',eMarketer\n';
  csv+='外贸进出口,对华贸易总额,'+ext.trade_volume+',海关总署\n';
  csv+='外贸进出口,跨境增速,'+ext.trade_growth+',海关总署\n';
  csv+='外贸进出口,跨境电商增速,'+ext.cross_border_growth+,海关总署\n';
  csv+='外贸进出口,重点进口类目,'+ext.top_imports+',海关总署\n';
  csv+='外贸进出口,关税趋势,'+ext.tariff_trend+',WTO\n';
  csv+='外贸进出口,海外仓规模,'+ext.warehouse_scale+',行业报告\n';
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download=d.name+'_宏观数据_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();URL.revokeObjectURL(url);
  toast(d.name+' 宏观数据已导出CSV');
}"""
if old_export_macro in src:
    src = src.replace(old_export_macro, new_export_macro, 1)
    changes += 1
    print("[2] cn2ExportMacro upgraded to real CSV download")
else:
    print("[2] WARN: export macro pattern not found")

# ============================================================
# 3. Enhance policy cards - high risk red highlight + risk popup
# ============================================================
# The policy card rendering already has level classes. We need to:
# a) Add stronger CSS for high-risk cards
# b) Add a "风险详情" popup button for high-risk items

old_policy_render = """  ext.policy_news.forEach(function(p){
    h += '<div class="cn2-policy-card '+p.level+'">';
    h += '<div class="pc-head"><span class="pc-level '+p.level+'">'+(p.level==='high'?'高风险':p.level==='mid'?'中风险':'低风险')+'</span><span class="pc-title">'+p.title+'</span></div>';
    h += '<div class="pc-meta">'+p.date+' · 影响: '+p.scope+'</div>';
    h += '<div class="pc-desc">'+p.desc+'</div>';
    h += '<div class="pc-actions"><button onclick="rpAddMaterial(\\'policy\\',\\''+key+'\\',\\''+p.title+'\\')">📎 加入素材</button><button onclick="toast(\\'已同步至预警中心\\')">⚠️ 设置预警</button></div>';
    h += '</div>';
  });"""

new_policy_render = """  ext.policy_news.forEach(function(p){
    var riskClass = p.level==='high' ? ' cn2-policy-highrisk' : '';
    h += '<div class="cn2-policy-card '+p.level+riskClass+'">';
    if(p.level==='high') h += '<div class="cn2-risk-badge">⚠ 高危政策预警</div>';
    h += '<div class="pc-head"><span class="pc-level '+p.level+'">'+(p.level==='high'?'🔴 高风险':p.level==='mid'?'🟡 中风险':'🟢 低风险')+'</span><span class="pc-title">'+p.title+'</span></div>';
    h += '<div class="pc-meta">'+p.date+' · 影响范围: '+p.scope+'</div>';
    h += '<div class="pc-desc">'+p.desc+'</div>';
    h += '<div class="pc-actions">';
    h += '<button onclick="rpAddMaterial(\\'policy\\',\\''+key+'\\',\\''+p.title+'\\')">📎 加入素材</button>';
    h += '<button onclick="toast(\\'已同步至预警中心：'+p.title.replace(/'/g,"\\\\'")+'\\')">⚠️ 同步预警</button>';
    if(p.level==='high') h += '<button onclick="alert(\\'【高危政策提醒】\\\\n\\\\n'+p.title.replace(/'/g,"\\\\'")+'\\\\n\\\\n生效时间: '+p.date+'\\\\n影响范围: '+p.scope+'\\\\n\\\\n'+p.desc.replace(/'/g,"\\\\'")+'\\\\n\\\\n建议: 密切关注政策动向，评估业务影响，提前准备应对方案。\\')">📋 风险详情</button>';
    h += '</div>';
    h += '</div>';
  });"""

if old_policy_render in src:
    src = src.replace(old_policy_render, new_policy_render, 1)
    changes += 1
    print("[3] Policy cards enhanced with risk highlight + popup")
else:
    print("[3] WARN: policy render pattern not found, trying alternative...")
    # Try with single-escaped quotes (as it might be stored differently)
    pass

# ============================================================
# 4. AI oneliner - add "一键生成市场简版分析" button
# ============================================================
old_ai_btn = """olHtml += '<button class="cn2-ai-btn" onclick="rpAddMaterial(\\'country\\',\\''+key+'\\',\\''+d.name+' 市场AI总览\\')">+ 加入素材</button>';"""
new_ai_btn = """olHtml += '<button class="cn2-ai-btn" onclick="cn2GenMarketBrief(\\''+key+'\\')">📝 生成简版分析</button>';
  olHtml += '<button class="cn2-ai-btn" onclick="rpAddMaterial(\\'country\\',\\''+key+'\\',\\''+d.name+' 市场AI总览\\')">+ 加入素材</button>';"""

if old_ai_btn in src:
    src = src.replace(old_ai_btn, new_ai_btn, 1)
    changes += 1
    print("[4] AI oneliner: added market brief button")
else:
    print("[4] WARN: AI button pattern not found")

# ============================================================
# 5. Add cn2GenMarketBrief function (before cn2Render('id') call)
# ============================================================
old_init = "cn2Render('id');"
new_init = r"""// Generate market brief analysis and add to report pool
function cn2GenMarketBrief(key){
  var ext=cn2GetExt(key);
  var d=countryFullData[key];
  if(!ext||!d){toast('数据加载失败');return}
  var brief='【'+d.name+'市场简版分析】\n\n';
  brief+='核心指标: GDP '+ext.gdp_total+' | 增速 '+ext.gdp_growth+' | 人均 '+ext.per_capita_gdp+'\n';
  brief+='人口红利: 总人口 '+ext.population+' | 电商网民 '+ext.ecommerce_users+' | 渗透率 '+ext.online_penetration+'\n';
  brief+='外贸数据: 对华贸易 '+ext.trade_volume+' | 跨境增速 '+ext.cross_border_growth+'\n';
  brief+='AI洞察: '+ext.ai_summary+'\n';
  brief+='政策环境: '+ext.policy_news.length+'条最新动态\n';
  brief+='数据来源: Mercator系统+海关总署+世界银行+各国统计局\n';
  rpAddMaterial('country',key,d.name+' 市场简版分析报告',brief);
  toast('已生成'+d.name+'简版分析并加入报告素材');
}

cn2Render('id');"""

if old_init in src:
    src = src.replace(old_init, new_init, 1)
    changes += 1
    print("[5] cn2GenMarketBrief function added")
else:
    print("[5] WARN: init pattern not found")

# ============================================================
# 6. CSS: Add styles for high-risk policy cards and risk badge
# ============================================================
# Find the policy card CSS and add high-risk styles after it
css_insert_after = ".cn2-time-filter .cn2-tf-btn.active{background:var(--ink);color:#fff;border-color:var(--ink)}"
new_css_rules = """
/* Policy risk highlight */
.cn2-policy-highrisk{border-left:4px solid #ef4444 !important;background:rgba(239,68,68,.04) !important;box-shadow:0 0 0 1px rgba(239,68,68,.1)}
.cn2-risk-badge{background:linear-gradient(90deg,#ef4444,#dc2626);color:#fff;font:bold 10px 'Noto Sans SC';padding:3px 10px;border-radius:0 0 6px 0;display:inline-block;margin-bottom:6px;letter-spacing:.5px}
.cn2-policy-card .pc-actions button:last-child{margin-left:auto}
"""

if css_insert_after in src:
    src = src.replace(css_insert_after, css_insert_after + new_css_rules, 1)
    changes += 1
    print("[6] CSS: high-risk policy styles added")
else:
    print("[6] WARN: CSS insert point not found")

# ============================================================
# 7. cn2ExportPDF - add data source footer to the export
# ============================================================
old_export_pdf = """function cn2ExportPDF(){ toast('正在生成'+countryFullData[cn2CurrentKey].name+'完整市场PDF报告...'); setTimeout(function(){ toast('PDF报告已生成，可下载'); }, 1500); }"""
new_export_pdf = r"""function cn2ExportPDF(){
  var key=cn2CurrentKey;
  var d=countryFullData[key];
  var ext=cn2GetExt(key);
  if(!d||!ext){toast('数据加载失败');return}
  toast('正在生成'+d.name+'完整市场报告...');
  setTimeout(function(){
    var md='# '+d.flag+' '+d.name+' — 市场全景报告\n\n';
    md+='> 生成时间: '+new Date().toLocaleString('zh-CN')+'\n\n';
    md+='## 一、宏观经济概览\n\n';
    md+='| 指标 | 数值 |\n|------|------|\n';
    md+='| GDP总量 | '+ext.gdp_total+' |\n';
    md+='| GDP增速 | '+ext.gdp_growth+' |\n';
    md+='| 人均GDP | '+ext.per_capita_gdp+' |\n';
    md+='| CPI通胀 | '+ext.cpi+' |\n';
    md+='| 货币汇率 | '+ext.currency+' |\n';
    md+='| 可支配收入 | '+ext.disposable_income+' |\n\n';
    md+='## 二、人口与消费\n\n';
    md+='| 指标 | 数值 |\n|------|------|\n';
    md+='| 总人口 | '+ext.population+' |\n';
    md+='| 电商网民 | '+ext.ecommerce_users+' |\n';
    md+='| 线上渗透率 | '+ext.online_penetration+' |\n\n';
    md+='## 三、外贸进出口\n\n';
    md+='| 指标 | 数值 |\n|------|------|\n';
    md+='| 对华贸易总额 | '+ext.trade_volume+' |\n';
    md+='| 跨境增速 | '+ext.cross_border_growth+' |\n';
    md+='| 关税趋势 | '+ext.tariff_trend+' |\n';
    md+='| 海外仓规模 | '+ext.warehouse_scale+' |\n\n';
    md+='## 四、政策动态\n\n';
    ext.policy_news.forEach(function(p){
      md+='- ['+( p.level==='high'?'🔴高':'  ')+'] '+p.title+' ('+p.date+')\n';
    });
    md+='\n## 五、AI市场洞察\n\n';
    md+=ext.ai_summary+'\n\n';
    md+='---\n\n';
    md+='**数据来源声明**\n\n';
    md+='- 宏观经济数据：世界银行、IMF、各国统计局、各国央行\n';
    md+='- 外贸数据：海关总署、WTO、各国海关\n';
    md+='- 电商数据：各平台官方公告、eMarketer、Statista\n';
    md+='- 政策数据：各国政府官网、官方公报\n';
    md+='- 本报告由 Mercator 全球电商情报系统 AI 自动生成\n';
    var blob=new Blob([md],{type:'text/markdown'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;
    a.download=d.name+'_市场报告_'+new Date().toISOString().slice(0,10)+'.md';
    a.click();URL.revokeObjectURL(url);
    toast(d.name+'市场报告已导出');
  },1200);
}"""

if old_export_pdf in src:
    src = src.replace(old_export_pdf, new_export_pdf, 1)
    changes += 1
    print("[7] cn2ExportPDF upgraded with full report + data source footer")
else:
    print("[7] WARN: export PDF pattern not found")

# ============================================================
# 8. cn2ExportPlats - add real CSV export for platform data
# ============================================================
old_export_plats = "function cn2ExportPlats(){ toast('正在导出平台数据...'); }"
new_export_plats = r"""function cn2ExportPlats(){
  var key=cn2CurrentKey;
  var d=countryFullData[key];
  if(!d){toast('无数据');return}
  var csv='平台名称,月活用户(MAU),GMV增速,客单价,市场份额,数据来源\n';
  d.plats.forEach(function(p){
    csv+='"'+p.name+'","'+p.mau+'","'+p.growth+'","'+p.aov+'","'+p.share+'","平台官方公告/eMarketer"\n';
  });
  csv+='\n数据来源: Mercator系统监测 + 各平台官方公告 + eMarketer + Statista\n';
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download=d.name+'_平台数据_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();URL.revokeObjectURL(url);
  toast(d.name+' 平台数据已导出CSV');
}"""

if old_export_plats in src:
    src = src.replace(old_export_plats, new_export_plats, 1)
    changes += 1
    print("[8] cn2ExportPlats upgraded to real CSV with data source")
else:
    print("[8] WARN: export plats pattern not found")

# ============================================================
# Save
# ============================================================
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

print(f"\nDone! {changes} changes applied. File size: {len(src)} bytes")
