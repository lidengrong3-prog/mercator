// === 页面切换 ===

function rpAddCurrentToPool() {
  var activePage = document.querySelector('.page.active');
  if (!activePage) { toast('请先选择数据'); return; }
  var pageId = activePage.id;
  var type = '', title = '', source = '', summary = '';

  if (pageId === 'overview') {
    type = 'alert'; title = '首页总览数据'; source = '全局概览';
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

function rpGenerateReport(tpl){
  var names={'market-research':'全球市场调研报告','competitor-analysis':'竞品分析报告','market-entry':'市场进入方案','product-selection':'选品策略报告','compliance-risk':'合规风险评估报告'};
  var area=$('#rp-preview-area');
  area.innerHTML='<div class="rp-generating"><div class="rp-gen-spinner"></div><p>正在生成 '+names[tpl]+' ...</p><small>正在整合素材池数据，请稍候</small></div>';
  setTimeout(function(){
    var pool=rpGetPool().filter(function(m){return m.selected});
    if(pool.length===0) pool=rpGetPool();
    var now=new Date();
    var ds=(now.getMonth()+1)+'/'+now.getDate()+' '+now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
    var report={name:names[tpl],tpl:tpl,date:now.toISOString(),time:ds,items:pool.slice()};
    rpV2SaveReport(report.name, pool.length, report);
    var html='<div class="rp-gen-done"><span class="rp-done-icon">✔</span><p>'+names[tpl]+' 已生成</p><small>共纳入 '+pool.length+' 条素材 · '+ds+'</small></div>';
    html+='<div style="margin-top:14px;border:1px solid var(--line);border-radius:8px;padding:14px;max-height:320px;overflow:auto">';
    html+='<h4 style="margin:0 0 8px">'+names[tpl]+' · 内容摘要</h4>';
    if(pool.length===0){ html+='<p style="color:var(--muted);font-size:13px">素材池暂无可纳入的内容，可先在各国/平台/政策页点击「加入报告素材」。</p>'; }
    else {
      var byType={};
      pool.forEach(function(m){ (byType[m.type]=byType[m.type]||[]).push(m); });
      Object.keys(byType).forEach(function(t){
        html+='<div style="margin:8px 0"><b style="font-size:13px">'+t+'（'+byType[t].length+'）</b><ul style="margin:4px 0 4px 18px;font-size:12.5px;color:#445">';
        byType[t].forEach(function(m){ html+='<li>'+escInline(m.title||m.text||m.q||'(未命名)')+(m.source?' <span style="color:#98a">· '+escInline(m.source)+'</span>':'')+'</li>'; });
        html+='</ul></div>';
      });
    }
    html+='</div>';
    html+='<div style="margin-top:12px"><button class="pr-primary-btn" onclick="rpExportAll()">导出此报告</button></div>';
    area.innerHTML=html;
    try{rpV2LoadRecent();}catch(e){}
    toast('报告生成完成（'+pool.length+' 条素材）');
  }, 1200);
}
function rpExportAll(){jayExportReport();}

// ===== Report Material Pool (Global) =====

// ===== 报告生成中心 v2 - 完整重建 =====
const RP_POOL_KEY = 'jay_report_pool';
const RP_REPORTS_KEY = 'jay_reports_v2';

// --- Pool Management ---
function rpGetPool(){return Array.isArray(jayReportPoolCache)?jayReportPoolCache.slice():[]}
function rpSavePool(pool){
  if(!jayCanUseUserDb()){toast('登录后可保存并跨设备同步报告素材');return false}
  jayReportPoolCache=Array.isArray(pool)?pool.slice():[];
  jayScheduleReportPoolSync(jayReportPoolCache);
  rpV2RefreshPoolUI();
  return true;
}
function rpAddMaterial(type,title,source,summary){
  if(!jayCanUseUserDb()){toast('只读演示不保存素材，请登录后使用');return}
  var pool=rpGetPool();
  var id=Date.now()+'_'+Math.random().toString(36).substr(2,5);
  pool.push({id:id,type:type,title:title,source:source,summary:summary,addedAt:new Date().toISOString(),selected:true});
  rpSavePool(pool);toast('已加入报告素材池（报告生成中心可查看 · 共 '+pool.length+' 条）')
}
function rpRemoveMaterial(id){rpSavePool(rpGetPool().filter(function(m){return m.id!==id}))}
function rpV2SelectAll(){var pool=rpGetPool();pool.forEach(function(m){m.selected=true});rpSavePool(pool)}
function rpV2DeselectAll(){var pool=rpGetPool();pool.forEach(function(m){m.selected=false});rpSavePool(pool)}
function rpV2ToggleSelect(id){var pool=rpGetPool();pool.forEach(function(m){if(m.id===id)m.selected=!m.selected});rpSavePool(pool)}
function rpV2ClearPool(){if(!confirm('确定清空全部素材？此操作不可恢复。'))return;rpSavePool([]);toast('素材池已清空')}

// --- Pool UI ---
var rpV2Filter='all';
document.addEventListener('DOMContentLoaded',function(){
  setTimeout(function(){
    var defaultTpl=document.querySelector('.rp-v2-tpl-card[data-tpl="product-research"]');
    if(defaultTpl&&!rpV2SelectedTpl)rpV2SelectTpl(defaultTpl);
    rpV2RefreshPoolUI();
    // Pool filter tags
    document.querySelectorAll('#rp-v2-pool-filter .rp-v2-pool-tag').forEach(function(tag){
      tag.addEventListener('click',function(){
        document.querySelectorAll('#rp-v2-pool-filter .rp-v2-pool-tag').forEach(function(t){t.classList.remove('active')});
        this.classList.add('active');
        rpV2Filter=this.dataset.filter;
        rpV2RefreshPoolUI();
      });
    });
    rpV2LoadRecent();
  },100);
});

function rpV2RefreshPoolUI(){
  var pool=rpGetPool();
  var body=document.getElementById('rp-v2-pool-body');
  if(!body)return;
  // Update stats
  var totalEl=document.getElementById('rp-stat-total');
  var selEl=document.getElementById('rp-stat-selected');
  var countEl=document.getElementById('rp-pool-count');
  var selectedCount=pool.filter(function(m){return m.selected}).length;
  if(totalEl)totalEl.textContent=pool.length;
  if(selEl)selEl.textContent=selectedCount;
  if(countEl)countEl.textContent='('+pool.length+')';
  // Hero 日期印章（报告生成当天）
  var dEl=document.getElementById('rp-hero-date');
  if(dEl){var nd=new Date();var mm=('0'+(nd.getMonth()+1)).slice(-2);var dd=('0'+nd.getDate()).slice(-2);dEl.textContent=mm+'.'+dd;}
  // Config step count
  var cfgCount=document.getElementById('rp-v2-cfg-count');
  if(cfgCount)cfgCount.textContent=selectedCount;
  if(pool.length===0){
    body.innerHTML='<div class="rp-v2-pool-empty"><span class="rp-v2-pool-empty-icon">✦</span><p>暂无素材</p><small>在各页面点击"加入报告素材"按钮<br>数据将自动汇入素材库</small></div>';
    return;
  }
  // Filter
  var filtered=rpV2Filter==='all'?pool:pool.filter(function(m){return m.type===rpV2Filter});
  // Group by type
  var groups={};
  var typeLabels={product:'商品素材',shop:'店铺素材',custom:'其他素材',macro:'宏观数据',country:'国家宏观',platform:'平台档案',policy:'政策动态',rule:'平台规则',alert:'预警数据'};
  var typeColors={product:'#6366f1',shop:'#8b5cf6',custom:'#64748b',macro:'#0891b2',country:'var(--green)',platform:'var(--orange)',policy:'#ef4444',rule:'#f59e0b',alert:'#64748b'};
  filtered.forEach(function(m){if(!groups[m.type])groups[m.type]=[];groups[m.type].push(m)});
  var html='';
  Object.keys(groups).forEach(function(type){
    var items=groups[type];
    html+='<div class="rp-v2-pool-group">';
    html+='<div class="rp-v2-pool-group-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">';
    html+='<span style="color:'+(typeColors[type]||'#64748b')+'">●</span> '+escapeHtml(typeLabels[type]||type);
    html+=' <span class="rp-v2-pool-gcount">('+items.length+')</span></div>';
    html+='<div>';
    items.forEach(function(m){
      var date=new Date(m.addedAt);
      var dateStr=(date.getMonth()+1)+'/'+date.getDate();
      html+='<div class="rp-v2-pool-item'+(m.selected?' selected':'')+'" data-id="'+escInline(m.id)+'">';
      html+='<input type="checkbox" '+((m.selected)?'checked':'')+' onchange="rpV2ToggleSelect(\''+escInline(m.id)+'\')">';
      html+='<div class="rp-v2-pool-item-body">';
      html+='<p class="rp-v2-pool-item-title">'+escapeHtml(m.title)+'</p>';
      html+='<div class="rp-v2-pool-item-meta">';
      html+='<span class="rp-v2-pool-item-type" style="background:'+(typeColors[m.type]||'var(--muted)')+'">'+escapeHtml(typeLabels[m.type]||m.type)+'</span>';
      html+='<span>'+escapeHtml(m.source)+'</span><span>'+dateStr+'</span></div></div>';
      html+='<button class="rp-v2-pool-item-remove" onclick="event.stopPropagation();rpRemoveMaterial(\''+escInline(m.id)+'\')" title="移除">×</button>';
      html+='</div>';
    });
    html+='</div></div>';
  });
  body.innerHTML=html;
}
function rpRenderPool(){rpV2RefreshPoolUI()}

// --- Step Navigation ---
var rpV2CurrentStep=1;
var rpV2SelectedTpl=null;
var rpV2Config={period:'7d',focus:'data',audience:'boss',format:'full'};
var rpV2TplNames={'product-research':'单品赛道选品调研报告','competitor-analysis':'竞品对标分析报告','market-entry':'单国出海市场可行性报告','content-marketing':'内容营销投放分析报告','custom':'自定义模板'};

function rpV2SelectTpl(el){
  document.querySelectorAll('.rp-v2-tpl-card').forEach(function(c){c.classList.remove('selected')});
  el.classList.add('selected');
  rpV2SelectedTpl=el.dataset.tpl;
  var nameEl=document.getElementById('rp-v2-tpl-name');
  if(nameEl)nameEl.textContent=rpV2TplNames[rpV2SelectedTpl]||rpV2SelectedTpl;
  var cfgTpl=document.getElementById('rp-v2-cfg-tpl');
  if(cfgTpl)cfgTpl.textContent=rpV2TplNames[rpV2SelectedTpl]||'-';
  document.getElementById('rp-v2-next-btn').disabled=false;
}
function rpV2Toggle(el){
  var cfg=el.dataset.cfg;
  var val=el.dataset.val;
  rpV2Config[cfg]=val;
  el.parentElement.querySelectorAll('.rp-v2-toggle').forEach(function(t){t.classList.remove('active')});
  el.classList.add('active');
}
function rpV2GoStep(step){
  rpV2CurrentStep=step;
  ['rp-panel-step1','rp-panel-step2','rp-panel-step3'].forEach(function(id,i){
    document.getElementById(id).style.display=(i+1===step)?'block':'none';
  });
  ['rp-step-1','rp-step-2','rp-step-3'].forEach(function(id,i){
    var el=document.getElementById(id);
    el.classList.remove('active','done');
    if(i+1===step)el.classList.add('active');
    else if(i+1<step)el.classList.add('done');
  });
  if(step===2){
    var pool=rpGetPool();
    var sel=pool.filter(function(m){return m.selected});
    document.getElementById('rp-v2-cfg-count').textContent=sel.length;
    rpV2LoadTpls();
  }
}

// --- Report Generation (Simulated AI) ---
var rpGenInterval=null;  // P3-4: 模块级变量，防止重复点击创建多个定时器
function rpV2SetToolbarBusy(busy){
  var tb=document.querySelector('.rp-v2-preview-toolbar-right');
  if(!tb)return;
  tb.querySelectorAll('button').forEach(function(b){ b.disabled=busy; });
}
function rpV2Generate(){
  if(rpGenInterval){ return; }  // 防重入
  var topicEl = document.getElementById('rp-v2-topic');
  var topic = topicEl ? topicEl.value.trim() : '';
  var pool = rpGetPool().filter(function(m){ return m.selected; });
  if(!topic && pool.length === 0){ toast('请填写行业/产品，或至少勾选 1 条素材'); return; }
  if(!AI_ENGINE.hasKey()){ toast('请先登录后使用 AI 报告服务'); return; }
  rpV2SetToolbarBusy(true);
  rpV2GoStep(3);
  var body = document.getElementById('rp-v2-preview-body');
  body.classList.remove('rp-empty-preview');
  var title = topic ? ('《' + topic + '》市场调研报告') : (rpV2TplNames[rpV2SelectedTpl] || '市场调研报告');
  document.getElementById('rp-v2-preview-title').textContent = title;
  body.innerHTML = '<div class="rp-v2-generating"><div style="font-size:32px;color:var(--green)">✦</div><h3 style="margin:12px 0 4px;font-weight:bold;font-size:16px">AI 正在生成报告</h3><p style="font-size:12px;color:var(--muted)">基于输入与 ' + pool.length + ' 条素材智能分析中...</p></div>';
  rpGenInterval = true;
  var periodLabel = {'7d':'近7天','1m':'近1个月','3m':'近3个月','6m':'近3-6个月'}[rpV2Config.period] || '近7天';
  var focusLabel = {'data':'数据量化导向','strategy':'运营策略导向','balance':'均衡'}[rpV2Config.focus] || '数据量化';
  var audienceLabel = {'boss':'决策层','ops':'运营团队','client':'外部客户'}[rpV2Config.audience] || '决策层';
  var formatLabel = {'full':'完整报告','exec':'执行摘要','slides':'演示文稿大纲'}[rpV2Config.format] || '完整报告';
  var matText = pool.map(function(m){ return '- ' + (m.title || '') + '（' + (m.type || '') + '）：' + (m.summary || m.source || ''); }).join('\n');
  var customEl = document.getElementById('rp-v2-custom-prompt');
  var customText = customEl ? customEl.value.trim() : '';
  var system = [
    '你是资深跨境电商市场研究分析师与报告结构专家，输出结构化、数据驱动、可落地的市场调研报告（简体中文，Markdown）。',
    '参考标杆：《纸尿裤全域跨境电商市场调研报告》骨架为：执行摘要 + 市场优先级总览（排序表）→ 宏观市场环境（分区域：规模/渗透率/政策认证/关税）→ 竞品调研 → 消费者需求与痛点 → 渠道平台调研 → 产品适配性分析 → 风险与建议。你的报告须达到同等的综合性、专业度与“数据可核验”标准。',
    '【结构强制】严格按用户给出的章节顺序生成，使用 ## 二级标题分章、### 三级标题分节。',
    '【图表强制】在“市场规模 / 品牌份额 / 渗透率增速 / 市场优先级 / 渠道分布”等章节必须用 chart 代码块（格式见用户提示中的【图表格式】）输出可视化，每个图表必须基于真实数据字段，禁止编造数字。',
    '【数据纪律】具体数字必须标注来源；不同机构口径用对照表呈现；估算值必须标注“约/估算，仅供参考”，不得伪装成权威精确值；无数据处写“待补充”而非编造。',
    '【格式】关键数据用表格；核心结论用引用块（行首 “ > ”，✅ 标机会/建议，⚠ 标风险/注意）；不要用代码块包裹整篇报告。',
    '【当前日期】' + jayNowHuman() + '。请基于截至该日期的最新公开信息生成，优先引用 2026 年市场与政策数据；引用历史数据须明确标注年份，不得混淆时效。'
  ].join('\n');
  var user = '请为以下对象生成一份市场调研报告。\n';
  user += '【当前日期】' + jayNowHuman() + '（' + jayNowDate() + '），请确保报告内容反映该日期前后的最新情况。\n';
  user += '【调研对象】' + (topic ? topic : '（见素材）') + '\n';
  if(rpV2Answers){
    user += '【用户背景画像】\n';
    user += '- 品类/产品：' + rpV2Answers.category + '\n';
    user += '- 目标市场：' + rpV2Answers.market + '\n';
    user += '- 单件成本：' + rpV2Answers.cost + '\n';
    user += '- 月出海预算：' + rpV2Answers.budget + '\n';
    user += '- 出海经验：' + rpV2Answers.exp + '\n';
    user += '- 风险偏好：' + rpV2Answers.risk + '\n';
    user += '- 最关心：' + rpV2Answers.care + '\n';
    if(rpV2Answers.concern) user += '- 主要顾虑：' + rpV2Answers.concern + '\n';
    user += '请结合上述背景，在报告开头用 > ✅ 引用块直接给出「能不能做 / 卖给谁 / 定多少价 / 避什么坑」的结论，并优先回应用户最关心的事项（' + rpV2Answers.care + '）。\n';
  }
  user += '【数据周期】' + periodLabel + ' 【输出侧重】' + focusLabel + ' 【受众】' + audienceLabel + ' 【格式】' + formatLabel + '\n';
  if(matText) user += '【已选素材】\n' + matText + '\n';
  // RAG 本地知识库增强：依据调研对象检索系统内置数据作为上下文，提高数字可核验度
  try {
    var ragTopic = (topic ? topic + ' ' : '') + (rpV2Answers ? (rpV2Answers.category||'') + ' ' + (rpV2Answers.market||'') : '');
    var rag = jayRagContextBlock(ragTopic, 10);
    if(rag.text) user += '【JAY观海知识库上下文（系统内置数据，优先据此引用并标注来源类型）】\n' + rag.text + '\n';
  } catch(e){}
  user += '【报告结构要求】\n';
  user += '## 一、执行摘要（3-5 条要点，用 > ✅ 引用块呈现核心结论与机会）\n';
  user += '## 二、市场优先级总览（横向条形图 + 表格：优先级｜市场｜预估毛利率｜推荐理由｜首选渠道｜建议进入时间）\n';
  user += '## 三、宏观市场环境（分区域表格：市场规模 | 渗透率 | 政策认证 | 关税；并用柱状图展示区域市场规模）\n';
  user += '## 四、竞品调研（表格：玩家 | 定位 | 份额估算 | 核心优势 | 来源；饼图展示品牌份额）\n';
  user += '## 五、消费者需求与痛点（> ⚠ 列风险/痛点，> ✅ 列机会）\n';
  user += '## 六、渠道平台调研（表格：平台 | 适合品类 | 费用 | 入驻要求；环图展示渠道 GMV 分布）\n';
  user += '## 七、产品适配性分析（功能 / 认证 / 价格带与目标的匹配）\n';
  user += '## 八、风险与建议（政策、平台规则、知识产权；> ⚠ 风险 + > ✅ 应对建议）\n';
  user += '【图表格式】请使用 fenced 代码块（以 ```chart 开头、独立成段）输出图表，放在对应章节正文之后：\n';
  user += '```chart\n';
  user += '{"type":"bar|hbar|pie|line","title":"图表标题","labels":["标签1","标签2"],"values":[数值1,数值2],"series":[{"name":"序列名","values":[...]}],"source":"来源说明","note":"估算值，仅供参考"}\n';
  user += '```\n';
  user += '示例（市场优先级，放在第二章后）：\n';
  user += '```chart\n';
  user += '{"type":"hbar","title":"市场优先级排序（综合得分）","labels":["越南","泰国","马来","印尼"],"values":[88,82,76,70],"source":"来源：JAY观海综合测算，2026"}\n';
  user += '```\n';
  if(audienceLabel==='决策层'){ user += '【受众适配】结论先行、精简，突出市场规模与机会。\n'; }
  else if(audienceLabel==='运营团队'){ user += '【受众适配】突出可拆解动作清单与时间线。\n'; }
  else if(audienceLabel==='外部客户'){ user += '【受众适配】专业详实、数据充分、措辞严谨。\n'; }
  if(formatLabel==='执行摘要'){ user += '【格式适配】只输出精简版：执行摘要 + 机会/风险引用块 + 一张核心数据表。\n'; }
  else if(formatLabel==='演示文稿大纲'){ user += '【格式适配】输出幻灯片大纲：每页一个 ## 标题 + 3-5 条要点。\n'; }
  if(customText) user += '\n【特别要求】' + customText;
  callAI(system, user, { temperature: 0.6, max_tokens: 5000, search: true })
    .then(function(report){
      rpLastReportText = report;
      rpLastReportTitle = title;
      body.innerHTML = '<div class="rp-v2-rpt">' + rpRenderReportWithCharts(report) + '</div>';
      rpV2SaveReport(title, pool.length);
      toast('报告生成完成！');
    })
    .catch(function(e){
      if(e.message === 'AUTH_REQUIRED'){
        body.innerHTML = '<div class="rp-v2-rpt"><p style="color:#ef4444">请登录后使用 AI 报告服务。</p></div>';
        toast('请先登录');
      } else {
        body.innerHTML = '<div class="rp-v2-rpt"><p style="color:#ef4444">生成失败：' + escapeHtml(e.message) + '</p></div>';
        toast('报告生成失败');
      }
    })
    .finally(function(){ rpGenInterval = false; rpV2SetToolbarBusy(false); });
}

/* ===== Phase0 B1: 报告生成前个性化问卷 ===== */
var rpV2Answers = null;
function rpV2Questionnaire(){
  var tEl = document.getElementById('rp-v2-topic');
  var t = tEl ? tEl.value.trim() : '';
  var cEl = document.getElementById('rp-q-category');
  if(cEl) cEl.value = t || '';
  if(rpV2Answers){ rpV2Generate(); return; }   // 本次会话已填过，直接生成
  var m = document.getElementById('rp-questionnaire');
  if(m) m.classList.add('show');
}
function rpV2CloseQuestionnaire(){
  var m = document.getElementById('rp-questionnaire');
  if(m) m.classList.remove('show');
}
function rpV2ApplyQuestionnaire(skip){
  var g = function(id){ var e = document.getElementById(id); return e ? e.value : ''; };
  if(skip){
    rpV2Answers = { category: g('rp-q-category').trim() || '未填写', market:'未定', cost:'未定', budget:'未定', exp:'未定', risk:'均衡', care:'能不能卖', concern:'' };
  } else {
    rpV2Answers = {
      category: g('rp-q-category').trim() || '未填写',
      market: g('rp-q-market'), cost: g('rp-q-cost'), budget: g('rp-q-budget'),
      exp: g('rp-q-exp'), risk: g('rp-q-risk'), care: g('rp-q-care'),
      concern: g('rp-q-concern').trim()
    };
  }
  rpV2CloseQuestionnaire();
  rpV2Generate();
}


function rpV2RenderReport(pool,tplName){
  var body=document.getElementById('rp-v2-preview-body');
  var typeLabels={product:'商品',shop:'店铺',content:'内容',country:'国家',platform:'平台',policy:'政策',rule:'规则',alert:'预警'};
  var typeCount={};
  pool.forEach(function(m){typeCount[m.type]=(typeCount[m.type]||0)+1});
  var now=new Date();
  var dateStr=now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
  var periodLabel={'7d':'近7天','1m':'近1个月','3m':'近3个月','6m':'近3-6个月'}[rpV2Config.period]||'近7天';
  var focusLabel={'data':'数据量化导向','strategy':'运营策略导向','balance':'均衡'}[rpV2Config.focus]||'数据量化';
  var audienceLabel={'boss':'决策层','ops':'运营团队','client':'外部客户'}[rpV2Config.audience]||'决策层';
  var customPrompt=document.getElementById('rp-v2-custom-prompt');
  var customText=customPrompt?customPrompt.value:'';
  var h='<div class="rp-v2-rpt">';
  h+='<h2>'+tplName+'</h2>';
  h+='<div class="rp-v2-rpt-meta">生成时间: '+now.toLocaleString('zh-CN')+' | 数据周期: '+periodLabel+' | 素材来源: '+pool.length+'条 | 输出侧重: '+focusLabel+' | 受众: '+audienceLabel+'</div>';
  // Section 1: Executive Summary
  h+='<div class="rp-v2-rpt-section"><h3>一、执行摘要</h3>';
  h+='<p>本报告基于 JAY观海 全球电商情报系统 '+pool.length+' 条实时监测数据，覆盖 '+Object.keys(typeCount).length+' 个数据维度，分析周期为 '+periodLabel+'。核心发现如下：</p>';
  h+='<div class="rp-v2-rpt-highlight"><strong>关键发现：</strong>';
  var productCount=typeCount['product']||0;
  var shopCount=typeCount['shop']||0;
  var countryCount=typeCount['country']||0;
  var contentCount=typeCount['content']||0;
  var policyCount=typeCount['policy']||0;
  if(productCount>0)h+=' 共监测 '+productCount+' 个热门/竞品商品数据点；';
  if(shopCount>0)h+=' 追踪 '+shopCount+' 家竞品店铺经营动态；';
  if(countryCount>0)h+=' 覆盖 '+countryCount+' 个国家/市场宏观数据；';
  if(contentCount>0)h+=' 分析 '+contentCount+' 条热门内容/达人投放数据；';
  if(policyCount>0)h+=' 收录 '+policyCount+' 条政策/合规变动信息；';
  h+='</div>';
  if(customText){h+='<div class="rp-v2-rpt-highlight"><strong>定制分析重点：</strong>'+customText+'</div>';}
  h+='</div>';
  // Section 2: Material Overview
  h+='<div class="rp-v2-rpt-section"><h3>二、数据素材全景</h3>';
  h+='<table><tr><th>数据类型</th><th>素材数量</th><th>占比</th><th>核心关注点</th></tr>';
  var focusMap={product:'爆款趋势、价格带、增速类目',shop:'GMV、品类布局、评分、增长',content:'转化率、播放量、达人成本',country:'GDP、人口红利、消费渗透率',platform:'平台GMV、流量成本、规则',policy:'关税、合规、监管变动',rule:'平台规则调整、处罚案例',alert:'风险预警、异常波动'};
  Object.keys(typeCount).forEach(function(t){
    var pct=(typeCount[t]/pool.length*100).toFixed(1);
    h+='<tr><td><strong>'+(typeLabels[t]||t)+'</strong></td><td>'+typeCount[t]+' 条</td><td>'+pct+'%</td><td style="font-size:11px;color:var(--muted)">'+(focusMap[t]||'-')+'</td></tr>';
  });
  h+='</table></div>';
  // Section 3: Detailed Analysis (template-specific)
  h+='<div class="rp-v2-rpt-section"><h3>三、深度分析</h3>';
  if(rpV2SelectedTpl==='product-research'||rpV2SelectedTpl==='custom'){
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.1 市场容量与增长趋势</h4>';
    h+='<p>根据素材池中的商品和国家数据，目标市场呈现以下特征：</p>';
    h+='<ul><li>整体品类处于成长期向成熟期过渡阶段，头部竞品增速趋于稳定</li>';
    h+='<li>中腰部卖家通过差异化定位实现快速突围，细分赛道仍有结构性机会</li>';
    h+='<li>内容电商渠道增速显著高于传统货架电商，短视频/直播引流效率提升 40-60%</li></ul>';
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.2 竞争格局分析</h4>';
    if(shopCount>0){
      h+='<p>追踪到的 '+shopCount+' 家竞品店铺呈现明显分化：</p>';
      h+='<table><tr><th>维度</th><th>头部玩家</th><th>中腰部卖家</th><th>新入局者</th></tr>';
      h+='<tr><td>GMV 占比</td><td>55-65%</td><td>25-35%</td><td>&lt;10%</td></tr>';
      h+='<tr><td>平均增速</td><td>8-15%</td><td>25-45%</td><td>50-100%+</td></tr>';
      h+='<tr><td>核心策略</td><td>品牌化+供应链</td><td>差异化+内容</td><td>低价引流</td></tr></table>';
    }else{
      h+='<p>当前素材中店铺数据较少，建议补充竞品店铺追踪数据以获得更精准分析。</p>';
    }
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.3 价格带与利润空间</h4>';
    h+='<div class="rp-v2-rpt-chart-placeholder">📊 价格带分布图（基于素材数据自动绘制）</div>';
  }
  if(rpV2SelectedTpl==='competitor-analysis'){
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.1 竞品店铺全景</h4>';
    h+='<p>基于 '+shopCount+' 家追踪店铺数据，竞品格局分析如下：</p>';
    h+='<table><tr><th>竞争层级</th><th>店铺特征</th><th>GMV 区间</th><th>核心壁垒</th></tr>';
    h+='<tr><td>T1 头部</td><td>品牌旗舰/大卖</td><td>$100万+/月</td><td>品牌+供应链+流量</td></tr>';
    h+='<tr><td>T2 腰部</td><td>垂类专精卖家</td><td>$10-100万/月</td><td>品类深度+复购</td></tr>';
    h+='<tr><td>T3 长尾</td><td>铺货/跟卖型</td><td>&lt;$10万/月</td><td>价格+上新速度</td></tr></table>';
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.2 流量结构拆解</h4>';
    h+='<ul><li>搜索流量占比：35-45%（受平台搜索算法调整影响）</li>';
    h+='<li>内容引流占比：25-35%（短视频+直播持续增长）</li>';
    h+='<li>活动流量占比：15-20%（大促期间峰值可达 50%+）</li>';
    h+='<li>私域流量占比：5-10%（粉丝复购+社群运营）</li></ul>';
  }
  if(rpV2SelectedTpl==='market-entry'){
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.1 目标市场宏观评估</h4>';
    if(countryCount>0){
      h+='<p>基于 '+countryCount+' 个国家/市场的宏观经济数据：</p>';
    }
    h+='<table><tr><th>评估维度</th><th>权重</th><th>评估标准</th></tr>';
    h+='<tr><td>GDP 增速</td><td>20%</td><td>&gt;5% 高增长 / 3-5% 稳健 / &lt;3% 成熟</td></tr>';
    h+='<tr><td>电商渗透率</td><td>20%</td><td>&gt;30% 成熟 / 15-30% 成长 / &lt;15% 早期</td></tr>';
    h+='<tr><td>人口红利</td><td>15%</td><td>中位年龄 &lt;30 为高红利</td></tr>';
    h+='<tr><td>政策友好度</td><td>20%</td><td>关税、外资限制、平台准入门槛</td></tr>';
    h+='<tr><td>物流基建</td><td>15%</td><td>海外仓覆盖、配送时效、COD 支持</td></tr>';
    h+='<tr><td>竞争强度</td><td>10%</td><td>头部集中度、价格战烈度</td></tr></table>';
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.2 平台选择建议</h4>';
    h+='<div class="rp-v2-rpt-success"><strong>推荐策略：</strong>新市场建议采用"1+1"双平台策略，1 个货架电商（如 Shopee/Amazon）+ 1 个内容电商（如 TikTok Shop），降低单平台风险。</div>';
  }
  if(rpV2SelectedTpl==='content-marketing'){
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.1 内容生态概览</h4>';
    if(contentCount>0){
      h+='<p>基于 '+contentCount+' 条热门内容数据分析：</p>';
    }
    h+='<table><tr><th>内容类型</th><th>平均播放/阅读</th><th>转化率</th><th>达人成本</th></tr>';
    h+='<tr><td>短视频种草</td><td>5-50万</td><td>1.5-3.5%</td><td>$50-500/条</td></tr>';
    h+='<tr><td>直播带货</td><td>场观 1000-5万</td><td>3-8%</td><td>$100-2000/场</td></tr>';
    h+='<tr><td>图文笔记</td><td>5000-10万</td><td>0.5-2%</td><td>$20-200/篇</td></tr>';
    h+='<tr><td>品牌挑战赛</td><td>100万+</td><td>0.3-1%</td><td>$5000+/活动</td></tr></table>';
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.2 达人分层投放策略</h4>';
    h+='<div class="rp-v2-rpt-success"><strong>黄金比例建议：</strong>头部达人(5%) 引爆声量 + 腰部达人(25%) 持续种草 + 素人/KOC(70%) 口碑铺量</div>';
  }
  h+='</div>';
  // Section 4: 风险与合规
  h+='<div class="rp-v2-rpt-section"><h3>四、风险与合规提示</h3>';
  if(policyCount>0){
    h+='<div class="rp-v2-rpt-risk"><strong>⚠ 政策风险关注：</strong>素材中包含 '+policyCount+' 条政策变动数据，建议重点关注以下方面：</div>';
  }else{
    h+='<div class="rp-v2-rpt-risk"><strong>⚠ 通用风险提示：</strong></div>';
  }
  h+='<ul><li><strong>关税政策：</strong>关注目标市场进口关税调整，部分品类可能面临加征风险</li>';
  h+='<li><strong>平台合规：</strong>各平台规则频繁调整，需持续监控违规处罚案例</li>';
  h+='<li><strong>知识产权：</strong>避免侵权风险，做好商标注册和产品合规认证</li>';
  h+='<li><strong>数据隐私：</strong>不同市场数据保护法规差异大，需本地化合规处理</li></ul>';
  h+='</div>';
  // Section 5: Action Plan
  h+='<div class="rp-v2-rpt-section"><h3>五、落地行动建议</h3>';
  h+='<div class="rp-v2-rpt-success"><strong>优先级排序（基于素材数据智能评估）：</strong></div>';
  h+='<ol><li><strong>短期（1-2周）：</strong>锁定 Top 3 潜力品类，完成竞品调研和供应链初步对接</li>';
  h+='<li><strong>中期（1-3月）：</strong>选定目标市场+平台组合，完成店铺开设和首批上架</li>';
  h+='<li><strong>长期（3-6月）：</strong>建立内容矩阵+达人合作体系，形成稳定出单模型</li>';
  h+='<li><strong>持续监控：</strong>每周更新素材池数据，动态调整策略方向</li></ol>';
  h+='</div>';
  // Section 6: Data Sources
  h+='<div class="rp-v2-rpt-section"><h3>六、数据来源声明</h3>';
  h+='<p>本报告数据全部来源于 JAY观海 全球电商情报系统实时监测，包含：</p>';
  h+='<ul><li>系统自动采集的 '+pool.length+' 条多平台数据素材</li>';
  h+='<li>各国官方宏观经济统计数据</li>';
  h+='<li>平台公开数据和第三方分析机构报告</li></ul>';
  h+='<p style="font-size:11px;color:var(--muted);margin-top:8px">数据截止时间：'+dateStr+' | 报告由 AI 智能生成，关键决策请结合人工判断</p>';
  h+='</div>';
  h+='</div>';
  body.innerHTML=h;
  // Save to recent reports
  rpV2SaveReport(tplName,pool.length);
  toast('报告生成完成！');
}


// Module 2: 基于调研报告生成可落地电商执行计划
var rpPlanBusy = false;
async function rpV2GeneratePlan(){
  if(!rpLastReportText){ toast('请先生成市场调研报告'); return; }
  if(rpPlanBusy){ return; }
  if(!AI_ENGINE.hasKey()){ toast('请先登录后使用 AI 报告服务'); return; }
  rpPlanBusy = true;
  showAIModal('电商执行计划', '<div class="rp-v2-generating"><div style="font-size:28px;color:var(--green)">⚡</div><h3 style="margin:12px 0 4px;font-weight:bold;font-size:16px">AI 正在制定执行计划</h3><p style="font-size:12px;color:var(--muted)">基于已生成的调研报告...</p></div>');
  try {
    var system = [
      '你是资深跨境电商运营顾问。基于给定的市场调研报告，输出可落地的电商执行计划，使用简体中文。',
      '结构要求（Markdown）：',
      '1) 按模块分章：## 一、选品与SKU规划；## 二、定价策略；## 三、渠道布局；## 四、营销推广与预算ROI；## 五、供应链与运营关键节点。',
      '2) 用一张总表汇总落地动作：| 阶段 | 关键动作 | 负责角色 | 时间线 | 依据(报告数据点) |。',
      '3) 用 > ✅ 标注关键里程碑，> ⚠ 标注执行风险。',
      '4) 每项动作尽量可拆解、可追踪；明确预算与预期ROI。',
      '【当前日期】' + jayNowHuman() + '。请基于截至该日期的最新市场与政策环境制定计划，引用最新数据与政策。'
    ].join('\n');
    var user = '【当前日期】' + jayNowHuman() + '（' + jayNowDate() + '）。\n以下是市场调研报告内容：\n\n' + rpLastReportText + '\n\n请基于以上报告，生成可落地的电商执行计划（任务清单格式，尽量可拆解、可追踪）。';
    var plan = await callAI(system, user, { temperature: 0.6, max_tokens: 3000, search: true });
    var b = document.getElementById('rp-ai-modal-body');
    if(b) b.innerHTML = '<div class="rp-v2-rpt">' + renderMarkdownSafe(plan) + '</div>';
    toast('执行计划已生成');
  } catch(e){
    var b = document.getElementById('rp-ai-modal-body');
    if(b) b.innerHTML = '<p style="color:#ef4444">生成失败：' + (e.message === 'AUTH_REQUIRED' ? '请先登录' : escapeHtml(e.message)) + '</p>';
    if(e.message !== 'AUTH_REQUIRED') toast('执行计划生成失败');
  } finally {
    rpPlanBusy = false;
  }
}

// --- Report History ---
function rpV2SaveReport(name,materialCount,details){
  if(!jayCanUseUserDb()){toast('登录后可保存报告历史');return false}
  details=details||{};
  var reports=rpV2GetReports();
  reports.unshift({
    id:Date.now()+'_'+Math.random().toString(36).substr(2,6),
    name:name,
    materials:materialCount,
    date:details.date||new Date().toISOString(),
    tpl:details.tpl||rpV2SelectedTpl||'custom',
    text:details.text||rpLastReportText||'',
    items:details.items||rpGetPool().filter(function(item){return item.selected})
  });
  if(reports.length>20)reports=reports.slice(0,20);
  jayReportsCache=reports;
  try{localStorage.setItem(jayPendingKey(RP_REPORTS_KEY),JSON.stringify(reports));}catch(e){}
  jayDbUpsert('generated_reports',reports.map(jayReportToRow),'user_id,client_id').then(function(){
    try{localStorage.removeItem(jayPendingKey(RP_REPORTS_KEY));localStorage.removeItem(RP_REPORTS_KEY);}catch(e){}
  }).catch(function(error){
    console.warn('[JAY观海] report history sync failed:',error);
    toast('报告已暂存在本机，云端同步失败：'+jayDbErrorText(error));
  });
  var statEl=document.getElementById('rp-stat-reports');
  if(statEl)statEl.textContent=reports.length;
  rpV2LoadRecent();
  return true;
}
function rpV2GetReports(){return Array.isArray(jayReportsCache)?jayReportsCache.slice():[]}
function rpV2LoadRecent(){
  var list=document.getElementById('rp-v2-recent-list');
  if(!list)return;
  var reports=rpV2GetReports();
  var statEl=document.getElementById('rp-stat-reports');
  if(statEl)statEl.textContent=reports.length;
  if(reports.length===0){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font:12px \'Noto Sans SC\'">暂无历史报告</div>';return}
  var h='';
  reports.forEach(function(r,i){
    var d=new Date(r.date);
    var ds=(d.getMonth()+1)+'/'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
    h+='<div class="rp-v2-recent-item" onclick="rpV2OpenReport('+i+')">';
    h+='<div class="rp-v2-recent-icon">◈</div>';
    h+='<div class="rp-v2-recent-info"><strong>'+escapeHtml(r.name)+'</strong><small>'+ds+' · '+r.materials+'条素材</small></div></div>';
  });
  list.innerHTML=h;
}
function rpV2OpenReport(index){
  var report=rpV2GetReports()[index];
  if(!report)return;
  if(!report.text){toast('该历史记录没有可恢复的正文');return}
  rpLastReportText=report.text;
  rpLastReportTitle=report.name;
  rpV2GoStep(3);
  var title=document.getElementById('rp-v2-preview-title');if(title)title.textContent=report.name;
  var body=document.getElementById('rp-v2-preview-body');
  if(body){body.classList.remove('rp-empty-preview');body.innerHTML='<div class="rp-v2-rpt">'+rpRenderReportWithCharts(report.text)+'</div>';}
}

// --- AI Tools ---
function rpV2AiTool(type){
  var pool = rpGetPool().filter(function(m){ return m.selected; });
  if(pool.length === 0){ toast('请先勾选素材'); return; }
  var resultEl = document.getElementById('rp-ai-' + type + '-result');
  if(!resultEl) return;
  if(!AI_ENGINE.hasKey()){ resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:#ef4444">请登录后使用 AI 分析服务</p></div>'; return; }
  resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:var(--muted);text-align:center;padding:10px">AI 分析中...</p></div>';
  var titles = pool.map(function(m){ return (m.title || '') + '（' + (m.type || '') + '）：' + (m.summary || m.source || ''); }).join('\n');
  var sys, usr;
  if(type === 'summary'){ sys = '你是跨境电商分析助手，请基于素材提炼核心结论。中文，要点式。'; usr = '素材：\n' + titles + '\n\n请提炼 3-5 条核心发现与数据洞察。'; }
  else if(type === 'risk'){ sys = '你是跨境电商合规风险专家。中文，分高/中/低风险提示并给建议。'; usr = '素材：\n' + titles + '\n\n请扫描政策/赛道/平台违规风险，给出风险等级与应对建议。'; }
  else { sys = '你是选品顾问。中文，给出 3-5 个潜力品类及理由。'; usr = '素材：\n' + titles + '\n\n请推荐潜力品类方向及入选理由。'; }
  var dateNote = '\n【当前日期】' + jayNowHuman() + '，请基于最新公开信息分析。';
  sys += dateNote; usr += dateNote;
  callAI(sys, usr, { temperature: 0.5, max_tokens: 1400, search: true })
    .then(function(out){ resultEl.innerHTML = '<div class="rp-v2-ai-result">' + renderMarkdownSafe(out) + '</div>'; toast('AI 分析完成'); })
    .catch(function(e){ resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:#ef4444">分析失败：' + (e.message === 'AUTH_REQUIRED' ? '请先登录' : escapeHtml(e.message)) + '</p></div>'; });
}


// --- Export ---
function rpV2Export(format){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('请先生成报告');return}
  if(format==='pdf'){ rpV2ExportPdfWithLogo(); return; }
  toast('正在导出 '+format.toUpperCase()+' ...');
  // Build markdown from preview
  var content='# '+document.getElementById('rp-v2-preview-title').textContent+'\n\n';
  content+='> 生成时间: '+new Date().toLocaleString('zh-CN')+'\n\n';
  body.querySelectorAll('h3').forEach(function(h3){content+='\n## '+h3.textContent+'\n'});
  body.querySelectorAll('h4').forEach(function(h4){content+='\n### '+h4.textContent+'\n'});
  body.querySelectorAll('p').forEach(function(p){if(p.textContent.trim())content+=p.textContent+'\n\n'});
  body.querySelectorAll('li').forEach(function(li){content+='- '+li.textContent+'\n'});
  body.querySelectorAll('table').forEach(function(table){
    var rows=table.querySelectorAll('tr');
    rows.forEach(function(row,i){
      var cells=row.querySelectorAll('th,td');
      var line='| ';
      cells.forEach(function(c){line+=c.textContent+' | '});
      content+=line+'\n';
      if(i===0){content+=line.replace(/[^|]/g,'-')+'\n'}
    });
    content+='\n';
  });
  setTimeout(function(){
    var ext='.md';
    var blob=new Blob([content],{type:'text/markdown'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download='JAY观海_Report_'+Date.now()+ext;a.click();
    URL.revokeObjectURL(url);
    toast('报告已导出');
  },800);
}
// ===== B3 带品牌 Logo 一键导出 PDF =====
// 登录用户优先走 report-export Edge Function；服务端未配置时明确降级为本地打印。
async function rpV2ExportPdfWithLogo(){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('请先生成报告');return}
  var title=document.getElementById('rp-v2-preview-title').textContent;
  var reportText=rpLastReportText||body.innerText||'';
  if(typeof jayGenerateReportPdf==='function' && jayCanUseUserDb && jayCanUseUserDb()){
    toast('正在生成服务端 PDF…');
    try{
      var result=await jayGenerateReportPdf(title,reportText,null);
      if(result&&result.file_url){
        var link=document.createElement('a');link.href=result.file_url;link.target='_blank';link.rel='noopener';link.click();
        toast('PDF 已生成，下载链接 1 小时内有效');
        return;
      }
      throw new Error('REPORT_FILE_URL_MISSING');
    }catch(error){
      console.warn('[JAY观海] server PDF export failed:',error);
      toast('服务端 PDF 暂不可用，已切换为本地 PDF 导出');
    }
  }else if(!jayIsDemo){
    toast('请登录后使用服务端 PDF；当前改用本地 PDF 导出');
  }
  var printWin=window.open('','_blank');
  if(!printWin){ toast('请允许弹出窗口以导出 PDF'); return; }
  var html='<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>'+title+'</title><style>'
    +'@page{margin:16mm} body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#1f2d3d;line-height:1.7}'
    +'.rp-logo{display:flex;align-items:center;gap:10px;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:18px}'
    +'.rp-logo .mark{font:800 34px "Playfair Display",serif;color:#1e3a5f}'
    +'.rp-logo .name{font:700 18px "PingFang SC",sans-serif;color:#1e3a5f}'
    +'.rp-logo .tag{margin-left:auto;font-size:11px;color:#888}'
    +'h1{font-size:20px;margin:0 0 14px} h2{font-size:16px;color:#1e3a5f;margin:20px 0 8px;border-left:4px solid #3b7ab8;padding-left:8px}'
    +'h3{font-size:14px;margin:14px 0 6px} p,li{font-size:13px} table{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0}'
    +'th,td{border:1px solid #ddd;padding:6px 8px;text-align:left} th{background:#eff6ff} blockquote{border-left:3px solid #3b7ab8;margin:8px 0;padding:4px 12px;background:#f5f9ff;color:#1e3a5f}'
    +'.rp-foot{margin-top:24px;border-top:1px solid #eee;padding-top:10px;font-size:11px;color:#999}'
    +'</style></head><body>'
    +'<div class="rp-logo"><span class="mark">J</span><span class="name">JAY观海</span><span class="tag">跨境市场情报系统 · 演示报告</span></div>'
    +'<h1>'+title+'</h1>'
    + body.innerHTML
    +'<div class="rp-foot">本报告由 JAY观海 演示环境生成，数据均为示意性参考，不构成投资或合规依据。生成时间：'+new Date().toLocaleString('zh-CN')+'</div>'
    +'</body></html>';
  printWin.document.open(); printWin.document.write(html); printWin.document.close();
  setTimeout(function(){ try{ printWin.print(); }catch(e){} }, 450);
  toast('已打开本地 PDF 预览，请在打印对话框中选择「另存为 PDF」');
}
async function rpV2SaveDraft(){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('暂无内容可保存');return}
  if(!jayCanUseUserDb()){toast('只读演示不保存草稿，请登录后使用');return}
  var ok=await jaySaveWorkspaceAsset('report_draft',{title:rpLastReportTitle||'报告草稿',text:rpLastReportText||body.innerText,saved_at:new Date().toISOString()});
  toast(ok?'草稿已同步到个人空间':'草稿云端同步失败，已暂存等待重试');
}
function rpV2CopyReport(){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body)return;
  var text=body.innerText;
  if(navigator.clipboard){navigator.clipboard.writeText(text).then(function(){toast('已复制到剪贴板')})}
  else{toast('复制失败，请手动选择复制')}
}
// Legacy compat
function rpUpdatePoolUI(){rpV2RefreshPoolUI()}

// ========== A3 数据底座 ==========
var DS_DOMAINS=[
  {key:'macro',    icon:'🌍', name:'宏观国家数据', count:'40 国',  src:'World Bank / 各国统计局（公开口径）'},
  {key:'platform', icon:'🛒', name:'平台档案',     count:'66 平台', src:'各平台公开招商与类目资料'},
  {key:'policy',   icon:'📋', name:'政策动态',     count:'71 项',  src:'各国官方公报 / 贸易主管部门'},
  {key:'rule',     icon:'⚡', name:'平台规则',     count:'135 条', src:'平台规则中心公开条款'},
  {key:'alert',    icon:'🔔', name:'预警中心',     count:'39 条',  src:'公开舆情 / 政策监测抽样'},
  {key:'content',  icon:'🎬', name:'热门内容',     count:'32 条',  src:'社媒公开内容抽样'}
];
function dsIsReal(key){ try{ return localStorage.getItem('jay_ds_real_'+key)==='1'; }catch(e){ return false; } }
function dsRender(){
    return; // disabled v4 2026-08-21

  var grid=document.getElementById('ds-grid'); if(!grid)return;
  grid.innerHTML=DS_DOMAINS.map(function(d){
    var real=dsIsReal(d.key);
    var cfg=dsGetCfg(d.key);
    return '<div class="ds-card">'+
      '<span class="ds-status '+(real?'real':'demo')+'" id="ds-status-'+d.key+'">'+(real?'✓ 真实来源（已配置）':'演示数据')+'</span>'+
      '<h3>'+d.icon+' '+d.name+'</h3>'+
      '<div class="ds-meta">数据规模：<b>'+d.count+'</b></div>'+
      '<div class="ds-meta">来源类型：<b>'+(cfg.src||d.src)+'</b></div>'+
      '<div class="ds-meta">最近更新：<b>数据截至 2026-07</b></div>'+
      '<div class="ds-toggle-row">'+
        '<button class="ds-btn" onclick="dsToggleCfg(\''+d.key+'\')">⚙ 接入真实源</button>'+
        '<label style="font-size:12px;color:#bcd4e8;display:flex;gap:6px;align-items:center;cursor:pointer">'+
          '<input type="checkbox" '+(real?'checked':'')+' onchange="dsToggleReal(\''+d.key+'\')"> 启用真实来源</label>'+
      '</div>'+
      '<div class="ds-cfg" id="ds-cfg-'+d.key+'">'+
        '<label>数据源类型</label><select id="ds-type-'+d.key+'"><option value="官方API">官方 API</option><option value="第三方">第三方数据商</option><option value="CSV导入">CSV / 文件导入</option></select>'+
        '<label>接口地址 / 说明</label><input id="ds-url-'+d.key+'" placeholder="https://... 或来源说明">'+
        '<label>更新频率</label><select id="ds-freq-'+d.key+'"><option>实时</option><option>5 分钟</option><option>15 分钟</option><option>1 小时</option><option>每日</option></select>'+
        '<div style="margin-top:10px;display:flex;gap:8px"><button class="ds-btn" onclick="dsSaveCfg(\''+d.key+'\')">保存配置</button></div>'+
        '<p style="font-size:11px;color:#7d93ab;margin:8px 0 0">这里只记录来源说明；连接凭据必须由管理员配置到服务端环境变量。</p>'+
      '</div>'+
    '</div>';
  }).join('');
  // restore cfg inputs
  DS_DOMAINS.forEach(function(d){ var c=dsGetCfg(d.key);
    if(c){ var t=document.getElementById('ds-type-'+d.key); if(t)t.value=c.type||'';
      var u=document.getElementById('ds-url-'+d.key); if(u)u.value=c.url||'';
      var f=document.getElementById('ds-freq-'+d.key); if(f)f.value=c.freq||''; } });
}
function dsGetCfg(key){ try{ return JSON.parse(localStorage.getItem('jay_ds_cfg_'+key)||'null'); }catch(e){ return null; } }
function dsSaveCfg(key){ var c={type:(document.getElementById('ds-type-'+key)||{}).value,url:(document.getElementById('ds-url-'+key)||{}).value,freq:(document.getElementById('ds-freq-'+key)||{}).value};
  try{ localStorage.setItem('jay_ds_cfg_'+key,JSON.stringify(c)); }catch(e){}
  toast('已保存「'+(DS_DOMAINS.filter(function(d){return d.key===key})[0]||{}).name+'」数据源配置（本地演示）'); }
function dsToggleCfg(key){ var el=document.getElementById('ds-cfg-'+key); if(el)el.classList.toggle('show'); }
function dsToggleReal(key){ var real=dsIsReal(key); try{ localStorage.setItem('jay_ds_real_'+key, real?'0':'1'); }catch(e){}
  var st=document.getElementById('ds-status-'+key); if(st){ st.className='ds-status '+(!real?'real':'demo'); st.textContent=(!real?'✓ 真实来源（已配置）':'演示数据'); }
  toast((!real?'已切换为真实来源（演示）':'已恢复为演示数据')+'：'+(DS_DOMAINS.filter(function(d){return d.key===key})[0]||{}).name); }
function dsResetAll(){ DS_DOMAINS.forEach(function(d){ try{ localStorage.setItem('jay_ds_real_'+d.key,'0'); }catch(e){} }); dsRender(); toast('已恢复全部为演示数据'); }


function switchPage(name,opts){ if(!(opts&&opts.fromHash)){ try{ if(location.hash!=='#'+name) history.pushState(null,'','#'+name); }catch(e){} }$$('.page').forEach(p=>p.classList.toggle('active',p.id===name));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===name));var titles={overview:'决策工作台',watchlist:'我的重点看板',products:'产品全域雷达',countries:'国家市场档案',shops:'店铺追踪',alerts:'预警中心',report:'报告生成中心',settings:'设置与权限',platforms:'电商平台档案',policies:'政策动态',rules:'平台规则变动',content:'热门内容追踪',myfit:'我的产品适配',pricing:'套餐与账单',tools:'操盘手工具箱',data:'数据底座',privacy:'隐私政策',terms:'服务条款',admin:'管理与运维后台'};var JAY_BC={overview:'工作台 / 决策总览',watchlist:'工作台 / 我的看板',products:'市场情报 / 类目机会',countries:'市场情报 / 国家市场',shops:'经营决策 / 店铺追踪',alerts:'工作台 / 预警中心',report:'经营决策 / AI 报告',settings:'系统 / 设置与权限',platforms:'市场情报 / 平台情报',policies:'市场情报 / 政策动态',rules:'市场情报 / 平台规则',content:'系统 / 资源中心',myfit:'经营决策 / 产品适配',pricing:'系统 / 套餐与账单',tools:'经营决策 / 利润工具',data:'系统 / 数据底座',privacy:'法律 / 隐私政策',terms:'法律 / 服务条款',admin:'系统 / 管理与运维后台'};$('#page-title').textContent=titles[name]||name;$('#breadcrumb').textContent=JAY_BC[name]||name;if(name==='alerts')renderAlerts();if(name==='settings'){stInit();aiInitKeyUI();}if(name==='pricing'&&typeof jayRenderPricingTier==='function'){jayRenderPricingTier();}if(name==='admin'&&typeof adminLoad==='function'){adminLoad();}if(name==='report'){rpV2RefreshPoolUI();rpV2LoadRecent();}
if(name==='myfit'){ if(typeof mfInitMarketSelect==='function') mfInitMarketSelect(); }
if(name==='tools'){ if(typeof toolsCalcProfit==='function'){ toolsCalcProfit(); toolsCalcScore(); toolsCalcStock(); } }
if(name==='data'){ if(typeof dsRender==='function') dsRender(); }
if(name==='pricing'){ if(typeof jayRenderPricingTier==='function') jayRenderPricingTier(); }
if(name==='settings'){ if(typeof stInitAccount==='function') stInitAccount(); }
if(name==='platforms'){ var prg=jayCountryRegion(JAY_CTX.country||''); var pf=$('#plat-region-filter'); if(pf&&prg) pf.value=prg; renderPlatforms(); }
if(name==='policies'){ var rgName=jayCountryRegion(JAY_CTX.country||''); var rgCode=rgName?plRegionCodeByName[rgName]:null; if(rgCode){ var plf=$('#pl-f-region'); if(plf) plf.value=rgCode; } renderPoliciesPage(); }
if(name==='rules'){ if(JAY_CTX.platform){ var pl=$('#rl-platform'); if(pl) pl.value=JAY_CTX.platform; } else { var rm=jayCountryMarket(JAY_CTX.country||''); var ml=$('#rl-market'); if(ml&&rm) ml.value=rm; } renderRulesPage(); }
if(name==='products'){ if(JAY_CTX.country||JAY_CTX.platform){ var cf=$('#pr-f-country'); if(cf&&JAY_CTX.country) cf.value=JAY_CTX.country; var pf=$('#pr-f-platform'); if(pf&&JAY_CTX.platform) pf.value=JAY_CTX.platform; var sf=$('#pr-f-signal'); if(sf) sf.value='all'; if(typeof prApplyFilters==='function') prApplyFilters(); } }
JAY_CTX.country=null; JAY_CTX.platform=null;
if (typeof trackActivity === 'function' && name !== 'overview') {
  var actMap = { countries: 'view_country', platforms: 'view_platform', policies: 'view_policy', rules: 'view_rule', report: 'export_report' };
  var actType = actMap[name] || 'search';
  trackActivity(actType, name, name, { source: 'navigation' });
}
window.scrollTo({top:0,behavior:'smooth'})}$$('[data-page]').forEach(e=>e.addEventListener('click',e=>{e.preventDefault();switchPage(e.currentTarget.dataset.page)}));

$('#export').onclick=()=>toast('报告正在生成，稍后将下载 Excel 文件。');// read-all button replaced by alerts center redesign/* bell handled by jayToggleBell */

// === AI Engine (server-side proxy) ===
var AI_ENGINE = {
  provider: 'server-proxy',
  endpoint: JAY_SUPABASE_URL + '/functions/v1/ai-proxy',
  hasKey: function(){ return !!(supabaseClient && jayUser && !jayIsDemo); }
};
var rpLastReportText = '';
var rpLastReportTitle = '';
// 跨模块联动上下文：在任一模块点击国家/平台后跳转目标页，自动预筛选对应内容
var JAY_CTX = { country: null, platform: null };
window.__CP_JAY_CTX = JAY_CTX;
function jayCountryRegion(name){
  var m = {
    '印度尼西亚':'东南亚','越南':'东南亚','泰国':'东南亚','马来西亚':'东南亚','菲律宾':'东南亚','新加坡':'东南亚','柬埔寨':'东南亚','缅甸':'东南亚','老挝':'东南亚',
    '美国':'北美','加拿大':'北美','墨西哥':'拉美',
    '英国':'欧洲','德国':'欧洲','法国':'欧洲','意大利':'欧洲','西班牙':'欧洲','荷兰':'欧洲','波兰':'欧洲',
    '沙特':'中东','阿联酋':'中东','土耳其':'中东','以色列':'中东','埃及':'中东',
    '巴西':'拉美','阿根廷':'拉美','智利':'拉美','哥伦比亚':'拉美',
    '印度':'南亚','巴基斯坦':'南亚','孟加拉':'南亚',
    '尼日利亚':'非洲','南非':'非洲','肯尼亚':'非洲',
    '日本':'日韩','韩国':'日韩','澳大利亚':'澳洲','新西兰':'澳洲'
  };
  return m[name] || null;
}
function jayCountryMarket(name){
  var rg = jayCountryRegion(name);
  var map = {'东南亚':'SEA','北美':'US','欧洲':'EU','中东':'MEA','拉美':'LATAM','南亚':'SAS','非洲':'AFR','日韩':'EA','澳洲':'OCE','独联体':'CIS','中国':'CN'};
  return map[rg] || null;
}
// 当前日期助手：让 AI 报告基于最新时效，避免停在旧年份（如 2024）
function jayNowDate(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function jayNowHuman(){ var d=new Date(); return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日'; }

// Generic AI call. Third-party credentials remain inside the Edge Function.
async function callAI(systemPrompt, userPrompt, opts){
  opts = opts || {};
  if(!AI_ENGINE.hasKey()){ throw new Error('AUTH_REQUIRED'); }
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult && sessionResult.data && sessionResult.data.session;
  if(!session){ throw new Error('AUTH_REQUIRED'); }
  var url = AI_ENGINE.endpoint;
  function buildBody(withSearch){
    var b = {
      messages: [
        { role: 'system', content: systemPrompt || '你是跨境电商市场情报分析专家。' },
        { role: 'user', content: userPrompt }
      ],
      temperature: (opts.temperature != null) ? opts.temperature : 0.7,
      max_tokens: opts.max_tokens || 2000,
      stream: false
    };
    if(withSearch){
      // 尝试两种 DeepSeek 联网检索写法，兼容不同版本
      b.web_search = { type: 'enabled' };
      b.plugins = ['web_search'];
    }
    return b;
  }
  function buildHeaders(withSearch){
    return {
      'Content-Type': 'application/json',
      'apikey': JAY_ANON_KEY,
      'Authorization': 'Bearer ' + session.access_token
    };
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, opts.timeout || 60000);
  async function attempt(withSearch){
    return await fetch(url, {
      method: 'POST',
      headers: buildHeaders(withSearch),
      body: JSON.stringify(buildBody(withSearch)),
      signal: ctrl.signal
    });
  }
  try {
    var resp = await attempt(!!opts.search);
    if(!resp.ok && opts.search){
      var probe = ''; try { probe = (await resp.text()).slice(0, 300); } catch(e){}
      // 若联网检索不被支持（400/403/插件相关报错），自动降级为无检索模式
      if(resp.status === 400 || resp.status === 403 || /plugin|web_search|search|unsupported|not support/i.test(probe)){
        resp = await attempt(false);
      } else {
        throw new Error('API_ERROR:' + resp.status + ' ' + probe);
      }
    }
    if(!resp.ok){
      var errTxt = ''; try { errTxt = (await resp.text()).slice(0, 200); } catch(e){}
      throw new Error('API_ERROR:' + resp.status + ' ' + errTxt);
    }
    var data = await resp.json();
    var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if(!content) throw new Error('EMPTY_RESPONSE');
    // strip markdown code fences if present
    content = content.replace(/^```(?:markdown)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// Safe markdown -> HTML (escape first, then limited formatting). Prevents XSS.
/* ===== 报告图表渲染器：解析 ```chart 代码块 → 内联 SVG（无外部依赖） ===== */
function jayChartColor(i){ var c=['#3b7ab8','#1e3a5f','#5fb0e8','#f4a259','#6cc49a','#e76f7a','#9b8bd6','#f2c14e']; return c[i % c.length]; }
function jayParseChart(str){
  try { return JSON.parse(str); } catch(e){}
  try { var s = str.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'); return JSON.parse(s); } catch(e){ return null; }
}
function jayChartBar(labels, values, series){
  var W=640, H=300, pl=52, pr=14, pt=18, pb=42, pw=W-pl-pr, ph=H-pt-pb;
  var all = values.slice();
  if(series) series.forEach(function(s){ all = all.concat(s.values); });
  var max = Math.max.apply(null, all.concat([1])) * 1.15;
  var grid='';
  for(var g=0; g<=4; g++){ var y=pt+ph-ph*g/4; grid+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#eef3f8" stroke-width="1"/><text x="'+(pl-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#9aa7b5">'+Math.round(max*g/4)+'</text>'; }
  var bw=pw/values.length*0.55, step=pw/values.length, bars='';
  for(var i=0;i<values.length;i++){ var v=values[i]||0, h=v/max*ph, x=pl+step*i+(step-bw)/2, y=pt+ph-h;
    bars+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="3" fill="#3b7ab8"/><text x="'+(x+bw/2)+'" y="'+(y-5)+'" text-anchor="middle" font-size="10" fill="#3b5066">'+v+'</text><text x="'+(pl+step*i+step/2)+'" y="'+(H-pb+16)+'" text-anchor="middle" font-size="10" fill="#6b7a89">'+escapeHtml(labels[i]||'')+'</text>'; }
  return '<svg viewBox="0 0 '+W+' '+H+'" class="jay-chart-svg" preserveAspectRatio="xMidYMid meet">'+grid+bars+'</svg>';
}
function jayChartHBar(labels, values){
  var W=640, H=Math.max(180, 30+values.length*42), pl=96, pr=48, pt=14, pb=14, pw=W-pl-pr;
  var max=Math.max.apply(null, values.concat([1]))*1.1, rowH=(H-pt-pb)/values.length, svg='';
  for(var i=0;i<values.length;i++){ var v=values[i]||0, bh=Math.min(22,rowH*0.6), y=pt+rowH*i+(rowH-bh)/2, w=v/max*pw;
    svg+='<text x="'+(pl-8)+'" y="'+(y+bh/2+4)+'" text-anchor="end" font-size="11" fill="#3b5066">'+escapeHtml(labels[i]||'')+'</text><rect x="'+pl+'" y="'+y+'" width="'+pw+'" height="'+bh+'" rx="4" fill="#eef3f8"/><rect x="'+pl+'" y="'+y+'" width="'+w+'" height="'+bh+'" rx="4" fill="#3b7ab8"/><text x="'+(pl+w+6)+'" y="'+(y+bh/2+4)+'" font-size="10" fill="#3b5066">'+v+'</text>'; }
  return '<svg viewBox="0 0 '+W+' '+H+'" class="jay-chart-svg" preserveAspectRatio="xMidYMid meet">'+svg+'</svg>';
}
function jayChartPie(labels, values){
  var cx=190, cy=150, r=108, total=values.reduce(function(a,b){ return a+(b||0); },0)||1, ang=-Math.PI/2, svg='';
  for(var i=0;i<values.length;i++){ var frac=(values[i]||0)/total, a2=ang+frac*Math.PI*2, large=frac>0.5?1:0;
    var x1=cx+r*Math.cos(ang), y1=cy+r*Math.sin(ang), x2=cx+r*Math.cos(a2), y2=cy+r*Math.sin(a2);
    svg+='<path d="M'+cx+' '+cy+' L'+x1.toFixed(1)+' '+y1.toFixed(1)+' A'+r+' '+r+' 0 '+large+' 1 '+x2.toFixed(1)+' '+y2.toFixed(1)+' Z" fill="'+jayChartColor(i)+'"/>';
    var mid=(ang+a2)/2, lx=cx+(r*0.62)*Math.cos(mid), ly=cy+(r*0.62)*Math.sin(mid);
    svg+='<text x="'+lx.toFixed(1)+'" y="'+(ly+4).toFixed(1)+'" text-anchor="middle" font-size="11" fill="#fff">'+Math.round(frac*100)+'%</text>';
    ang=a2;
  }
  var lx0=360, ly0=92;
  for(var j=0;j<labels.length;j++){ svg+='<rect x="'+lx0+'" y="'+ly0+'" width="12" height="12" rx="3" fill="'+jayChartColor(j)+'"/><text x="'+(lx0+18)+'" y="'+(ly0+11)+'" font-size="12" fill="#3b5066">'+escapeHtml(labels[j]||'')+' · '+Math.round((values[j]||0)/total*100)+'%</text>'; ly0+=26; }
  return '<svg viewBox="0 0 640 300" class="jay-chart-svg" preserveAspectRatio="xMidYMid meet">'+svg+'</svg>';
}
function jayChartLine(labels, values, series){
  var W=640, H=300, pl=52, pr=14, pt=18, pb=42, pw=W-pl-pr, ph=H-pt-pb;
  var all=[]; if(values&&values.length) all=all.concat(values); if(series) series.forEach(function(s){ all=all.concat(s.values); });
  var max=Math.max.apply(null, all.concat([1]))*1.15;
  var grid='';
  for(var g=0; g<=4; g++){ var y=pt+ph-ph*g/4; grid+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#eef3f8"/><text x="'+(pl-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#9aa7b5">'+Math.round(max*g/4)+'</text>'; }
  var step=labels.length>1?pw/(labels.length-1):pw;
  function px(i){ return pl+step*i; } function py(v){ return pt+ph-v/max*ph; }
  var dataset=series?series:[{name:'',values:values}], paths='', legend='';
  dataset.forEach(function(s, si){ var col=jayChartColor(si);
    paths+='<polyline points="'+s.values.map(function(v,i){ return px(i)+','+py(v); }).join(' ')+'" fill="none" stroke="'+col+'" stroke-width="2.5"/>';
    s.values.forEach(function(v,i){ paths+='<circle cx="'+px(i)+'" cy="'+py(v)+'" r="3" fill="'+col+'"/>'; });
    if(series) legend+='<span class="jay-chart-legend-item"><i style="background:'+col+'"></i>'+escapeHtml(s.name||('序列'+(si+1)))+'</span>';
  });
  var xl=''; labels.forEach(function(l,i){ xl+='<text x="'+px(i)+'" y="'+(H-pb+16)+'" text-anchor="middle" font-size="10" fill="#6b7a89">'+escapeHtml(l)+'</text>'; });
  var legendHtml=series?'<div class="jay-chart-legend jay-chart-legend-inline">'+legend+'</div>':'';
  return '<svg viewBox="0 0 '+W+' '+H+'" class="jay-chart-svg" preserveAspectRatio="xMidYMid meet">'+grid+paths+xl+'</svg>'+legendHtml;
}
function jayRenderChartSpec(spec){
  spec=spec||{}; var type=(spec.type||'bar').toLowerCase(), title=spec.title||'图表';
  var labels=Array.isArray(spec.labels)?spec.labels:[], values=Array.isArray(spec.values)?spec.values.map(Number):[], series=Array.isArray(spec.series)?spec.series:null;
  var svg;
  if(type==='pie') svg=jayChartPie(labels, values);
  else if(type==='hbar') svg=jayChartHBar(labels, values);
  else if(type==='line') svg=jayChartLine(labels, series, values);
  else svg=jayChartBar(labels, values, series);
  var cap='<div class="jay-chart-cap"><strong>'+escapeHtml(title)+'</strong>';
  if(spec.source) cap+='<span class="jay-chart-src">'+escapeHtml(spec.source)+'</span>';
  if(spec.note) cap+='<span class="jay-chart-note">'+escapeHtml(spec.note)+'</span>';
  cap+='</div>';
  return '<figure class="jay-chart">'+svg+cap+'</figure>';
}
function rpRenderReportWithCharts(md){
  if(md==null) return '';
  var re=/```chart\s*\n([\s\S]*?)```/g, out='', last=0, m;
  while((m=re.exec(md))){
    out+=renderMarkdownSafe(md.slice(last, m.index));
    var spec=jayParseChart(m[1]);
    out+= spec ? jayRenderChartSpec(spec) : '<pre class="rp-v2-rpt-code"><code>'+escapeHtml(m[1])+'</code></pre>';
    last=re.lastIndex;
  }
  out+=renderMarkdownSafe(md.slice(last));
  return out;
}
function renderMarkdownSafe(md){
  if(md == null) return '';
  var esc = escapeHtml(md);
  var lines = esc.split(/\r?\n/);
  var html = '';
  var i = 0;
  var inCode = false, codeBuf = [];
  function flushCode(){ if(codeBuf.length){ html += '<pre class="rp-v2-rpt-code"><code>' + codeBuf.join('\n') + '</code></pre>'; codeBuf = []; } }
  var listType = 0;
  function closeList(){ if(listType === 1){ html += '</ul>'; } else if(listType === 2){ html += '</ol>'; } listType = 0; }
  while(i < lines.length){
    var s = lines[i];
    if(/^\s*```/.test(s)){ if(inCode){ flushCode(); } else { closeList(); } inCode = !inCode; i++; continue; }
    if(inCode){ codeBuf.push(s); i++; continue; }
    if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(s)){ closeList(); html += '<hr>'; i++; continue; }
    var hm = s.match(/^(#{1,4})\s+(.*)$/);
    if(hm){ closeList(); var lvl = hm[1].length; var txt = inlineFmt(hm[2]); var tag = lvl >= 3 ? 'h4' : (lvl === 2 ? 'h3' : 'h2'); html += '<' + tag + '>' + txt + '</' + tag + '>'; i++; continue; }
    if(/^\s*&gt;\s?/.test(s)){
      closeList();
      var q = s.replace(/^\s*&gt;\s?/, '');
      var cls = 'rp-v2-rpt-highlight';
      if(/⚠|风险|注意|警告/.test(q)){ cls = 'rp-v2-rpt-risk'; }
      else if(/✅|机会|建议|结论|里程碑/.test(q)){ cls = 'rp-v2-rpt-success'; }
      html += '<div class="' + cls + '">' + inlineFmt(q) + '</div>';
      i++;
      continue;
    }
    if(/^\s*\|.*\|\s*$/.test(s) && i + 1 < lines.length && /^\s*\|?[\s:\|\-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') >= 0){
      closeList();
      var headers = s.trim().replace(/^\||\|$/g, '').split('|').map(function(c){ return c.trim(); });
      i += 2;
      var rows = [];
      while(i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])){
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(function(c){ return c.trim(); }));
        i++;
      }
      html += '<table class="rp-v2-rpt-table"><thead><tr>' + headers.map(function(h){ return '<th>' + inlineFmt(h) + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function(r){ html += '<tr>' + r.map(function(c){ return '<td>' + inlineFmt(c) + '</td>'; }).join('') + '</tr>'; });
      html += '</tbody></table>';
      continue;
    }
    var um = s.match(/^\s*[-*]\s+(.*)$/);
    if(um){ if(listType !== 1){ closeList(); html += '<ul>'; listType = 1; } html += '<li>' + inlineFmt(um[1]) + '</li>'; i++; continue; }
    var om = s.match(/^\s*\d+\.\s+(.*)$/);
    if(om){ if(listType !== 2){ closeList(); html += '<ol>'; listType = 2; } html += '<li>' + inlineFmt(om[1]) + '</li>'; i++; continue; }
    if(s.trim() === ''){ closeList(); i++; continue; }
    closeList();
    html += '<p>' + inlineFmt(s) + '</p>';
    i++;
  }
  closeList(); flushCode();
  return html;
}
function inlineFmt(t){
  return t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// Lightweight modal reusing existing .al-modal CSS
function showAIModal(title, bodyHtml){
  var existing = document.getElementById('rp-ai-modal'); if(existing) existing.remove();
  var overlay = document.createElement('div'); overlay.className = 'al-modal-overlay'; overlay.id = 'rp-ai-modal';
  var box = document.createElement('div'); box.className = 'al-modal'; box.style.maxWidth = '860px'; box.style.width = '92%';
  var head = document.createElement('div'); head.className = 'al-modal-head';
  var h3 = document.createElement('h3'); h3.textContent = title;
  var close = document.createElement('button'); close.className = 'al-modal-close'; close.textContent = '✕';
  close.onclick = function(){ overlay.remove(); };
  head.appendChild(h3); head.appendChild(close);
  var body = document.createElement('div'); body.className = 'al-modal-body'; body.id = 'rp-ai-modal-body';
  body.style.maxHeight = '70vh'; body.style.overflow = 'auto'; body.innerHTML = bodyHtml;
  box.appendChild(head); box.appendChild(body); overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function openSettingsAI(){ try { switchPage('settings'); } catch(e){} }
function aiInitKeyUI(){ return; }

var RP_TPL_KEY = 'jay_rp_tpls';
function rpV2GetTpls(){ return jayGetWorkspaceAsset('report_templates',{}); }
function rpV2LoadTpls(){
  var sel = document.getElementById('rp-v2-tpl-sel'); if(!sel) return;
  var tpls = rpV2GetTpls();
  sel.innerHTML = '<option value="">— 选择已保存模板 —</option>';
  Object.keys(tpls).forEach(function(k){
    var o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o);
  });
}
function rpV2ApplyTpl(){
  var sel = document.getElementById('rp-v2-tpl-sel'); if(!sel || !sel.value) return;
  var tpls = rpV2GetTpls();
  var v = tpls[sel.value]; if(v == null) return;
  var ta = document.getElementById('rp-v2-custom-prompt'); if(ta) ta.value = v;
  toast('已应用模板：' + sel.value);
}
async function rpV2SaveTpl(){
  var ta = document.getElementById('rp-v2-custom-prompt'); if(!ta) return;
  var v = ta.value.trim();
  if(!v){ stToast('请先在上方填写要保存的内容'); return; }
  if(!jayCanUseUserDb()){toast('只读演示不保存模板，请登录后使用');return}
  var name = window.prompt('模板名称：', '我的模板');
  if(!name) return;
  name = name.trim(); if(!name) return;
  var tpls = rpV2GetTpls(); tpls[name] = v;
  var ok=await jaySaveWorkspaceAsset('report_templates',tpls);
  rpV2LoadTpls();
  var sel = document.getElementById('rp-v2-tpl-sel'); if(sel) sel.value = name;
  stToast(ok?('模板已同步：'+name):'模板云端同步失败，已暂存等待重试');
}

// === Watchlist Redesign ===
var watchlistData = [];
var watchlistDbMap = {};
var mockWatchlistData = [{type:'track',flag:'\u{1F1EE}\u{1F1E9}',name:'\u5370\u5c3c\uff5c\u7f8e\u5986\u8d5b\u9053',platforms:'Shopee/TikTok Shop',status:'hot',statusText:'HOT \u9ad8\u589e\u957f',metrics:['7\u65e5GMV +42.8%','\u5e02\u573a\u89c4\u6a21 $650\u4ebf'],detail:'\u70ed\u95e8\u7ec6\u5206\uff1a\u5507\u91c9\u3001\u62a4\u80a4\u5957\u88c5 | \u7ade\u4e89\u5ea6\uff1a\u4e2d\u7b49',trend:[30,35,32,40,45,48,52],trendColor:'#2c5f8a',_dbId:null},{type:'shop',flag:'\u{1F3EA}',name:'GLOW LAB Official',platforms:'Shopee \u5370\u5c3c',status:'up',statusText:'\u{1F4C8} \u589e\u957f\u4e2d',metrics:['30\u5929GMV $128\u4e07','\u8ba2\u5355\u589e\u901f +18%'],detail:'\u8bc4\u52064.8 | \u7206\u6b3e\u657012',trend:[80,85,82,78,75,72,70],trendColor:'#3b7ab8',_dbId:null},{type:'track',flag:'\u{1F1FA}\u{1F1F8}',name:'\u7f8e\u56fd\uff5c\u5145\u7535\u914d\u4ef6',platforms:'Amazon/Temu',status:'monitor',statusText:'\u26a1 \u76d1\u63a7\u4e2d',metrics:['7\u65e5\u9500\u91cf +23.5%','\u5747\u4ef7 $15-35'],detail:'\u5229\u6da6\u7a7a\u95f4\uff1a\u4e2d\u9ad8 | \u8fd17\u65e5\u4e0a\u65b0 156\u4ef6',trend:[20,22,25,24,28,30,33],trendColor:'#2c5f8a',_dbId:null},{type:'shop',flag:'\u{1F3EA}',name:'TECHZONE Official',platforms:'Amazon \u7f8e\u56fd',status:'monitor',statusText:'\u26a1 \u76d1\u63a7\u4e2d',metrics:['30\u5929GMV $85\u4e07','\u8ba2\u5355\u589e\u901f +8%'],detail:'\u8bc4\u52064.6 | \u7206\u6b3e\u65708',trend:[50,52,51,53,55,54,56],trendColor:'#2c5f8a',_dbId:null},{type:'track',flag:'\u{1F1E7}\u{1F1F7}',name:'\u5df4\u897f\uff5c\u4e2a\u62a4\u7535\u5668',platforms:'Mercado Livre/Shopee',status:'hot',statusText:'HOT \u9ad8\u589e\u957f',metrics:['7\u65e5GMV +35.2%','\u5e02\u573a\u89c4\u6a21 $180\u4ebf'],detail:'\u70ed\u95e8\u7ec6\u5206\uff1a\u5439\u98ce\u673a\u3001\u8131\u6bdb\u4efb | \u7ade\u4e89\u5ea6\uff1a\u4f4e',trend:[15,18,22,25,28,33,38],trendColor:'#2c5f8a',_dbId:null}];

async function loadWatchlistFromDb() {
  var items = (typeof loadUserWatchlist === 'function') ? await loadUserWatchlist() : null;
  if (items && items.length > 0) {
    watchlistData = items.map(function(row) {
      var typeMap = { country: 'track', platform: 'track', category: 'track', product: 'product', policy: 'track' };
      var flagMap = { 'indonesia': '\u{1F1EE}\u{1F1E9}', 'usa': '\u{1F1FA}\u{1F1F8}', 'brazil': '\u{1F1E7}\u{1F1F7}', 'thailand': '\u{1F1F9}\u{1F1ED}', 'vietnam': '\u{1F1FB}\u{1F1F3}', 'mexico': '\u{1F1F2}\u{1F1FD}', 'philippines': '\u{1F1F5}\u{1F1ED}', 'malaysia': '\u{1F1F2}\u{1F1FE}', 'singapore': '\u{1F1F8}\u{1F1EC}', 'japan': '\u{1F1EF}\u{1F1F5}', 'korea': '\u{1F1F0}\u{1F1F7}', 'uk': '\u{1F1EC}\u{1F1E7}', 'germany': '\u{1F1E9}\u{1F1EA}', 'france': '\u{1F1EB}\u{1F1F7}', 'india': '\u{1F1EE}\u{1F1F3}', 'saudi_arabia': '\u{1F1F8}\u{1F1E6}', 'uae': '\u{1F1E6}\u{1F1EA}', 'egypt': '\u{1F1EA}\u{1F1EC}' };
      var flag = '\u{1F4CA}';
      var itemId = (row.item_id || '').toLowerCase();
      for (var k in flagMap) { if (itemId.indexOf(k) >= 0) { flag = flagMap[k]; break; } }
      var statusOptions = [{status:'hot',statusText:'HOT \u9ad8\u589e\u957f'},{status:'up',statusText:'\u{1F4C8} \u589e\u957f\u4e2d'},{status:'monitor',statusText:'\u26a1 \u76d1\u63a7\u4e2d'}];
      var so = statusOptions[Math.floor(Math.random() * statusOptions.length)];
      return {
        type: typeMap[row.item_type] || 'track',
        flag: flag,
        name: row.item_name || row.item_id,
        platforms: row.note || '\u5f85\u914d\u7f6e',
        status: so.status,
        statusText: so.statusText,
        metrics: ['\u5df2\u5173\u6ce8', '\u6570\u636e\u52a0\u8f7d\u4e2d...'],
        detail: '\u5173\u6ce8\u4e8e ' + new Date(row.created_at).toLocaleDateString('zh-CN'),
        trend: [20, 25, 22, 28, 30, 33, 35].map(function(v) { return v + Math.floor(Math.random() * 10); }),
        trendColor: '#2c5f8a',
        _dbId: row.id
      };
    });
    console.log('[JAY观海] Watchlist loaded from DB: ' + watchlistData.length + ' items');
  } else {
    watchlistData = mockWatchlistData.slice();
  }
  renderWatchCards('all');
}
const alertMessages=[{level:'high',text:'\u5370\u5c3c\u7f8e\u5986 7\u65e5GMV\u6da8\u5e45\u63d0\u5347\u81f342.8%\uff0c\u65b0\u589e23\u4e2a\u7206\u5355\u65b0\u54c1',icon:'\u{1F534}'},{level:'mid',text:'GLOW LAB\u5e97\u94fa\u8fd13\u65e5\u9500\u91cf\u4e0b\u6ed112%\uff0c\u5934\u90e8\u7ade\u54c1\u4e0a\u65b0\u5206\u6d41',icon:'\u{1F7E1}'},{level:'mid',text:'\u5317\u7f8e\u5145\u7535\u914d\u4ef6\u7c7b\u76ee\u65b0\u589e\u5173\u7a0e\u9884\u5ba1\u653f\u7b56',icon:'\u{1F7E0}'}];
const recommendTracks=[{flag:'\u{1F1FB}\u{1F1F3}',name:'\u8d8a\u5357\uff5c\u5bb6\u5c45\u751f\u6d3b',platforms:'Shopee/TikTok Shop',reason:'GDP\u589e\u901f6.5%\uff0c\u5bb6\u5c45\u54c1\u7c7b\u6e17\u900f\u7387\u5feb\u901f\u63d0\u5347'},{flag:'\u{1F1F2}\u{1F1FD}',name:'\u58a8\u897f\u54e5\uff5c3C\u914d\u4ef6',platforms:'Mercado Libre/Amazon',reason:'\u8fd1\u5cb8\u5916\u5305\u8d8b\u52bf\u5229\u597d\uff0c\u7f8e\u5ba2\u591a\u4efd\u989d\u9886\u5148'},{flag:'\u{1F1F9}\u{1F1ED}',name:'\u6cf0\u56fd\uff5c\u98df\u54c1\u996e\u6599',platforms:'Shopee/Lazada',reason:'\u5ba2\u5355\u4ef7\u7a33\u5b9a\uff0c\u590d\u8d2d\u7387\u9ad8\u4e8e\u5927\u76d8\u5747\u503c'}];

function buildMiniTrendSVG(data,color){
  var w=200,h=40,pad=4;
  var mn=Math.min.apply(null,data),mx=Math.max.apply(null,data);
  var range=mx-mn||1;
  var pts=data.map(function(v,i){return(pad+i*(w-2*pad)/6)+','+(h-pad-(v-mn)/range*(h-2*pad));});
  var gradId='tg_'+Math.random().toString(36).substr(2,6);
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><defs><linearGradient id="'+gradId+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity="0.2"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0.02"/></linearGradient></defs><polygon points="'+pts.join(' ')+' '+(w-pad)+','+h+' '+pad+','+h+'" fill="url(#'+gradId+')"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+pts[pts.length-1].split(',')[0]+'" cy="'+pts[pts.length-1].split(',')[1]+'" r="3" fill="'+color+'"/></svg>';
}

function renderWatchCards(filterType){
  var filtered=filterType==='all'?watchlistData:watchlistData.filter(function(d){return d.type===filterType;});
  var grid=document.getElementById('watch-grid');
  grid.innerHTML=filtered.map(function(d,idx){
    var trendDir=d.trend[d.trend.length-1]>=d.trend[0];
    var tc=trendDir?'#2c5f8a':'#3b7ab8';
    var svg=buildMiniTrendSVG(d.trend,tc);
    var viewLabel=d.type==='shop'?'\u67e5\u770b\u5e97\u94fa':'\u67e5\u770b\u699c\u5355';
    return '<article class="watch-card"><div class="wc-top"><span class="wc-flag">'+d.flag+'</span><span class="wc-name">'+d.name+'</span><span class="wc-platforms">'+d.platforms+'</span><span class="wc-status '+d.status+'">'+d.statusText+'</span></div><div class="wc-metrics"><div class="wc-metric"><b>'+d.metrics[0]+'</b></div><div class="wc-metric"><b>'+d.metrics[1]+'</b></div></div><p class="wc-detail">'+d.detail+'</p><div class="wc-trend">'+svg+'</div><div class="wc-actions"><button class="wc-action-btn ai" onclick="toast(\'AI\u8bca\u65ad\u62a5\u544a\u751f\u6210\u4e2d...\u4e13\u4e1a\u7248\u53ef\u67e5\u770b\u5b8c\u6574\u5206\u6790\')">\u2728 AI\u8bca\u65ad</button><button class="wc-action-btn" onclick="toast(\'\\u6b63\u5728\\u52a0\\u8f7d\\u8be6\\u7ec6\\u6570\\u636e...\')">'+viewLabel+'</button><button class="wc-action-btn" onclick="toast(\'\\u5df2\\u8bbe\\u7f6e\\u6b64\\u9879\\u76d1\\u63a7\\u63d0\\u9192\')">\u8bbe\u7f6e\u63d0\u9192</button><button class="wc-action-btn remove" onclick=\"removeWatchItem(this,"+idx+")\">\u53d6\u6d88\u5173\u6ce8</button></div></article>';
  }).join('');
}

function renderAlertBanner(){
  var banner=document.getElementById('wl-alert-banner');
  if(alertMessages.length===0){
    banner.innerHTML='<div class="wl-alert-none">\u2705 \u5f53\u524d\u6240\u6709\u76d1\u63a7\u8d5b\u9053\u3001\u5e97\u94fa\u8fd0\u884c\u5e73\u7a33\uff0c\u6682\u65e0\u5e02\u573a\u5f02\u52a8</div>';
    return;
  }
  banner.innerHTML='<div class="wl-alert-title">\u26a0\ufe0f \u5f02\u52a8\u63d0\u9192\uff08'+alertMessages.length+'\u6761\uff09<span class="wl-alert-count">'+alertMessages.length+'</span></div>'+alertMessages.map(function(a){
    return '<div class="wl-alert-item '+a.level+'"><span>'+a.icon+'</span><p>'+a.text+'</p><button class="wl-ai-btn" onclick="toast(\'\u5b8c\u6574\u98ce\u9669\u5206\u6790\u5df2\u751f\u6210\u3002PRO\u7248\u67e5\u770b\u5e94\u5bf9\u65b9\u6848\')">\u2728 AI\u89e3\u8bfb</button></div>';
  }).join('');
}

function renderRecommendTracks(){
  var container=document.getElementById('wl-rec-cards');
  container.innerHTML=recommendTracks.map(function(t){
    return '<div class="wl-rec-card"><span style="font-size:22px">'+t.flag+'</span><div class="wl-rec-info"><h5>'+t.name+'</h5><p>'+t.platforms+' \u00b7 '+t.reason+'</p></div><button class="wl-rec-add" onclick="addFromSearch(this, &#39;"+t.flag+"&#39; &#39;"+t.name+"&#39;,&#39;track&#39;)>\u6dfb\u52a0</button></div>';
  }).join('');
}

watchlistData = mockWatchlistData.slice();
renderWatchCards('all');
renderAlertBanner();
renderRecommendTracks();

// Tab switching
document.getElementById('wl-tabs').onclick=function(e){
  var btn=e.target.closest('.wl-tab');
  if(!btn)return;
  document.querySelectorAll('.wl-tab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderWatchCards(btn.dataset.type);
};

// Time filter
document.getElementById('wl-time-filter').onclick=function(e){
  var btn=e.target.closest('.wl-time-btn');
  if(!btn)return;
  document.querySelectorAll('.wl-time-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  toast('\u5df2\u5207\u6362\u4e3a'+btn.textContent+'\u6570\u636e');
  // Simulate data change by re-rendering with slight modification
  watchlistData.forEach(function(d){
    d.trend=d.trend.map(function(v){return Math.max(5,v+Math.floor(Math.random()*10-5));});
  });
  var activeTab=document.querySelector('.wl-tab.active');
  renderWatchCards(activeTab?activeTab.dataset.type:'all');
};

// Add watch modal
document.getElementById('add-watch').onclick=function(){showAddWatchModal();};
document.getElementById('wl-new-group').onclick=function(){showProModal();};

// === Add Watch Modal ===
function showAddWatchModal(){
  var existing=document.getElementById('wl-modal-overlay');
  if(existing)existing.remove();
  var div=document.createElement('div');
  div.id='wl-modal-overlay';
  div.className='wl-modal-overlay show';
  div.innerHTML='<div class="wl-modal"><div class="wl-modal-head"><h3>\u6dfb\u52a0\u5173\u6ce8\u9879</h3><button class="wl-modal-close" onclick="closeAddWatchModal()">\u2715</button></div><div class="wl-modal-tabs"><button class="wl-modal-tab active" data-mtab="search">\u624b\u52a8\u641c\u7d22</button><button class="wl-modal-tab" data-mtab="ai">\u2728 AI\u63a8\u8350</button><button class="wl-modal-tab" data-mtab="template">\u884c\u4e1a\u6a21\u677f</button></div><div class="wl-modal-body" id="wl-modal-content"></div><div class="wl-modal-foot"><button onclick="closeAddWatchModal()">\u6682\u4e0d\u6dfb\u52a0</button></div></div>';
  document.body.appendChild(div);
  div.onclick=function(e){if(e.target===div)closeAddWatchModal();};
  renderModalTab('search');
  div.querySelectorAll('.wl-modal-tab').forEach(function(tab){
    tab.onclick=function(){
      div.querySelectorAll('.wl-modal-tab').forEach(function(t){t.classList.remove('active');});
      tab.classList.add('active');
      renderModalTab(tab.dataset.mtab);
    };
  });
}
function closeAddWatchModal(){var m=document.getElementById('wl-modal-overlay');if(m)m.remove();}

function renderModalTab(tab){
  var body=document.getElementById('wl-modal-content');
  if(tab==='search'){
    body.innerHTML='<div class="wl-search-row"><input type="text" id="wl-search-input" placeholder="\u641c\u7d22\u56fd\u5bb6\u3001\u8d5b\u9053\u3001\u5e97\u94fa\u6216\u5355\u54c1..."><button onclick="doModalSearch()">\u641c\u7d22</button></div><div id="wl-search-results"><p style="font-size:11px;color:#999;text-align:center;padding:20px 0">\u8f93\u5165\u5173\u952e\u8bcd\u641c\u7d22\u53ef\u76d1\u63a7\u7684\u8d5b\u9053\u3001\u5e97\u94fa\u6216\u5355\u54c1</p></div>';
  }else if(tab==='ai'){
    body.innerHTML='<p style="font-size:12px;color:#4a6a8a;margin:0 0 14px">\u2728 \u57fa\u4e8e\u4f60\u5df2\u5173\u6ce8\u7684\u54c1\u7c7b\uff0c\u4ee5\u4e0b\u540c\u8d5b\u9053\u6f5c\u529b\u5e02\u573a\u503c\u5f97\u5173\u6ce8\uff1a</p>'+recommendTracks.map(function(t){
      return '<div class="wl-rec-item"><div class="wl-rec-item-info"><h5>'+t.flag+' '+t.name+'</h5><p>'+t.platforms+'</p></div><button onclick="addFromSearch(this, &#39;"+t.flag+"&#39; &#39;"+t.name+"&#39;,&#39;track&#39;)>\u4e00\u952e\u6dfb\u52a0</button></div>';
    }).join('');
  }else if(tab==='template'){
    body.innerHTML='<div class="wl-template-card"><h5>\u{1F30F} \u4e1c\u5357\u4e9a\u7f8e\u5986\u5356\u5bb6\u770b\u677f</h5><p>\u5305\u542b\u5370\u5c3c\u3001\u6cf0\u56fd\u3001\u8d8a\u5357\u7f8e\u5986\u8d5b\u9053\u76d1\u63a7 + 5\u5bb6\u5934\u90e8\u7ade\u5e97\u8ffd\u8e2a</p><button onclick="addTemplateToWatchlist(this)">\u4e00\u952e\u6dfb\u52a0</button></div><div class="wl-template-card"><h5>\u{1F1FA}\u{1F1F8} \u6b27\u7f8e3C\u8d27\u67b6\u7535\u5546\u770b\u677f</h5><p>\u5305\u542b\u7f8e\u56fd\u3001\u52a0\u62ff\u5927 3C\u914d\u4ef6\u8d5b\u9053 + Amazon/Temu\u5e73\u53f0\u6570\u636e</p><button onclick="addTemplateToWatchlist(this)">\u4e00\u952e\u6dfb\u52a0</button></div><div class="wl-template-card"><h5>\u{1F4F1} TikTok\u672c\u571f\u5e97\u7efc\u5408\u76d1\u63a7\u6a21\u677f</h5><p>\u8986\u76d6\u5370\u5c3c\u3001\u6cf0\u56fd\u3001\u9a6c\u6765\u897f\u4e9a TikTok Shop\u672c\u571f\u5e97\u6570\u636e</p><button onclick="addTemplateToWatchlist(this)">\u4e00\u952e\u6dfb\u52a0</button></div>';
  }
}

function doModalSearch(){
  var q=document.getElementById('wl-search-input').value.trim();
  var results=document.getElementById('wl-search-results');
  if(!q){results.innerHTML='<p style="font-size:11px;color:#999;text-align:center;padding:20px 0">\u8bf7\u8f93\u5165\u641c\u7d22\u5173\u952e\u8bcd</p>';return;}
  var mockResults=[
    {name:'\u{1F1F5}\u{1F1ED} \u83f2\u5f8b\u5bbe\uff5c\u7f8e\u5986\u4e2a\u62a4',sub:'Shopee/Lazada \u00b7 \u5e02\u573a\u89c4\u6a21$120\u4ebf',type:'track'},
    {name:'\u{1F1F2}\u{1F1FE} \u9a6c\u6765\u897f\u4e9a\uff5c\u98df\u54c1\u996e\u6599',sub:'Shopee/Lazada \u00b7 \u5ba2\u5355\u4ef7\u7a33\u5b9a',type:'track'},
    {name:'\u{1F3EA} ANKER Official',sub:'Amazon \u7f8e\u56fd \u00b7 30\u5929GMV $320\u4e07',type:'shop'},
    {name:'\u{1F4E6} \u5145\u7535\u5b9d\u54c1\u7c7b',sub:'Amazon/Temu \u00b7 \u5747\u4ef7$12-25',type:'product'}
  ];
  results.innerHTML=mockResults.map(function(r){
    return '<div class="wl-search-result"><div><b>'+r.name+'</b><small>'+r.sub+'</small></div><button class="wl-rec-add" onclick="addFromSearch(this, &#39;"+r.name.replace(/&#39;/g,"&#39;")+"&#39;,&#39;"+r.type+"&#39;)>\u6dfb\u52a0</button></div>';
  }).join('');
}

// PRO Modal
// ========== I1 订阅与账单 ==========
var JAY_TIER_LABELS = { free: '免费版', pro: 'Pro 专业版', enterprise: '企业版' };
async function jayUpgrade(tier){
  if(jayIsDemo){toast('只读演示不会更改会员或创建订单，请登录后查看订阅状态');return}
  if(!jayCanUseUserDb()){toast('请先登录后管理订阅');return}
  if(tier==='free'){toast('取消或降级需在账单门户完成；当前支付门户尚未配置');return}
  if(tier==='enterprise'){openEntModal();return}
  try{
    toast('正在创建安全支付会话…');
    var result=await jayCreateBillingCheckout(tier);
    if(result&&result.url){location.href=result.url;return}
    throw new Error('CHECKOUT_URL_MISSING');
  }catch(error){
    if(error.message==='BILLING_NOT_CONFIGURED')toast('支付服务尚未配置，本次未创建订单或扣款');
    else toast('无法创建支付会话：'+(error.message||'请稍后重试'));
  }
}
// ===== E2 企服对接入口（留资 CTA，闭合 B2B2G 最后一跳）=====
function openEntModal(){
  var m=document.getElementById('ent-modal-overlay');
  if(m){ m.style.display='flex';
    var c=document.getElementById('ent-company'); if(c&&jayProfile) c.value=jayProfile.company||'';
    var n=document.getElementById('ent-name'); if(n&&jayProfile) n.value=jayProfile.display_name||'';
  }
}
function closeEntModal(){ var m=document.getElementById('ent-modal-overlay'); if(m)m.style.display='none'; }
async function submitEntLead(){
  if(!jayCanUseUserDb()){toast('请先登录后提交企业服务需求');return}
  var company=(document.getElementById('ent-company')||{}).value||'';
  var name=(document.getElementById('ent-name')||{}).value||'';
  var contact=(document.getElementById('ent-contact')||{}).value||'';
  var need=(document.getElementById('ent-need')||{}).value||'';
  if(!contact){ toast('请填写联系方式，便于顾问回访'); return; }
  try{
    await jayDbInsert('sales_leads',{user_id:jayUser.id,company:company.trim(),contact_name:name.trim(),contact:contact.trim(),need:need.trim(),status:'submitted'});
    closeEntModal();
    toast('需求已提交，服务团队可在后台跟进');
  }catch(error){
    console.warn('[JAY观海] sales lead submit failed:',error);
    toast('需求提交失败：'+jayDbErrorText(error));
  }
}
async function stSendTestPush(){
  if(!jayCanUseUserDb()){toast('请登录后创建测试通知');return}
  try{
    if(typeof jayCreateNotification==='function') await jayCreateNotification('JAY观海测试通知','这是一条站内测试通知。邮件、企业微信和飞书投递服务尚未启用，本次不会发送到外部渠道。','test','info');
    toast('站内测试通知已创建；外部渠道尚未发送');
  }catch(error){
    toast('测试通知创建失败：'+jayDbErrorText(error));
  }
}
// ===== D2 预警分类与精准订阅（偏好持久化）=====
async function stSaveSubPref(){
  if(!jayCanUseUserDb()){toast('只读演示不保存偏好，请登录后设置');return}
  var subs=[];
  document.querySelectorAll('#st-tab-alerts .st-alert-check input[data-sub]').forEach(function(c){ if(c.checked) subs.push(c.getAttribute('data-sub')); });
  var notification=Object.assign({},jayPreferenceCache.notification_prefs||{},{subscriptions:subs});
  var saved=await saveUserPreferences({notification_prefs:notification});
  toast(saved?('订阅偏好已同步：'+(subs.length?subs.join(' / '):'无')):'保存失败，请检查网络后重试');
}
function stLoadSubPref(){
  var notification=jayPreferenceCache.notification_prefs||{};
  var subs=Array.isArray(notification.subscriptions)?notification.subscriptions:null;
  if(!subs) return;
  document.querySelectorAll('#st-tab-alerts .st-alert-check input[data-sub]').forEach(function(c){ c.checked = subs.indexOf(c.getAttribute('data-sub'))>=0; });
}
async function jayRenderPricingTier(){
  var el = document.getElementById('prc-current-tier');
  if(!el) return;
  if(jayIsDemo){el.innerHTML='当前状态：<b>只读演示</b> · <span style="color:var(--muted)">不会创建订单或改变会员</span>';return}
  if(!jayCanUseUserDb()){el.innerHTML='请登录后查看真实订阅状态';return}
  el.textContent='正在读取订阅状态…';
  var sub=typeof jayLoadSubscription==='function'?await jayLoadSubscription():null;
  var tier=(sub&&sub.plan)||(jayProfile&&jayProfile.tier)||'free';
  var statusLabels={trialing:'试用中',active:'有效',past_due:'付款异常',cancelled:'已取消',expired:'已过期'};
  if(!sub){el.innerHTML='当前会员：<b>'+(JAY_TIER_LABELS[tier]||tier)+'</b> · <span style="color:#b9792f">订阅记录暂不可用</span>';return}
  var end=sub.current_period_end?(' · 到期 '+new Date(sub.current_period_end).toLocaleDateString('zh-CN')):'';
  el.innerHTML='当前会员：<b>'+(JAY_TIER_LABELS[tier]||tier)+'</b> · '+(statusLabels[sub.status]||sub.status)+end+' · <span style="color:var(--muted)">渠道 '+(sub.provider||'internal')+'</span>';
}

function showProModal(){
  var existing=document.getElementById('pro-modal-overlay');
  if(existing)return;
  var div=document.createElement('div');
  div.id='pro-modal-overlay';
  div.className='pro-modal-overlay show';
  div.innerHTML='<div class="pro-modal"><h3>升级专业版</h3><p>专业版包含 AI 深度报告、完整预警和批量决策能力。只有支付服务配置完成并由支付回调确认后，会员状态才会改变。</p><div class="pro-modal-btns"><button class="pro-btn" onclick="closeProModal();switchPage(\'pricing\')">查看套餐与账单</button><button class="pro-dismiss" onclick="closeProModal()">稍后再说</button></div></div>';
  document.body.appendChild(div);
  div.onclick=function(e){if(e.target===div)closeProModal();};
}
function closeProModal(){var m=document.getElementById('pro-modal-overlay');if(m)m.remove();}

// ========== F 操盘手工具箱 ==========
function toolsCalcProfit(){
  var g=function(id){var v=parseFloat(document.getElementById(id).value);return isNaN(v)?0:v;};
  var cost=g('pf-cost'),ship=g('pf-ship'),price=g('pf-price'),comm=g('pf-comm'),tar=g('pf-tariff');
  var cif=cost+ship;
  var duty=cif*tar/100;
  var commission=price*comm/100;
  var total=cif+duty+commission;
  var net=price-total;
  var rate=price>0?net/price*100:0;
  var bep=total;
  var ok=net>=0;
  var el=document.getElementById('pf-res');
  if(!el)return;
  el.innerHTML='<div class="row"><span>关税</span><b>¥'+duty.toFixed(1)+'</b></div>'+
    '<div class="row"><span>平台佣金</span><b>¥'+commission.toFixed(1)+'</b></div>'+
    '<div class="row"><span>单件总成本</span><b>¥'+total.toFixed(1)+'</b></div>'+
    '<div class="row hl"><span>单件净利润</span><b class="'+(ok?'pos':'neg')+'">¥'+net.toFixed(1)+'</b></div>'+
    '<div class="row"><span>净利润率</span><b class="'+(ok?'pos':'neg')+'">'+rate.toFixed(1)+'%</b></div>'+
    '<div class="row"><span>盈亏平衡售价</span><b>¥'+bep.toFixed(1)+'</b></div>'+
    '<span class="tools-badge '+(ok?'good':'bad')+'">'+(ok?'✓ 盈利':'✗ 亏损，建议提价或降本')+'</span>';
}
function toolsCalcScore(){
  var market=document.getElementById('sc-market').value;
  var margin=parseFloat(document.getElementById('sc-margin').value)||0;
  var weight=parseFloat(document.getElementById('sc-weight').value)||0;
  var sensitive=document.getElementById('sc-sensitive').value==='1';
  var capMap={'东南亚':16,'北美':20,'欧洲':17,'中东':14,'拉美':12};
  var compMap={'东南亚':15,'北美':11,'欧洲':13,'中东':16,'拉美':17};
  var riskMap={'东南亚':16,'北美':13,'欧洲':10,'中东':15,'拉美':12};
  var dims={
    '市场容量':capMap[market]||14,
    '竞争强度':compMap[market]||14,
    '毛利空间':Math.max(4,Math.min(20,margin/5)),
    '物流友好':Math.max(4,Math.min(20,20-weight*6)),
    '政策风险':Math.max(4,(riskMap[market]||14)-(sensitive?6:0))
  };
  var total=0,bars='';
  for(var k in dims){var v=dims[k];total+=v;bars+='<div class="tools-dim"><span>'+k+'</span><span>'+v.toFixed(0)+'/20</span></div><div class="tools-bar"><i style="width:'+(v/20*100)+'%"></i></div>';}
  var grade=total>=80?'good':(total>=60?'warn':'bad');
  var glabel=total>=80?'优质选品':(total>=60?'普通选品':'谨慎选品');
  var el=document.getElementById('sc-res');
  if(!el)return;
  el.innerHTML=bars+'<div class="row hl"><span>综合评分</span><b>'+total.toFixed(0)+'/100</b></div>'+
    '<span class="tools-badge '+grade+'">'+glabel+'</span>';
}
function toolsCalcStock(){
  var g=function(id){var v=parseFloat(document.getElementById(id).value);return isNaN(v)?0:v;};
  var daily=g('st-daily'),keep=g('st-keep'),logi=g('st-logi'),safe=g('st-safe'),cost=g('st-cost');
  var qty=Math.ceil(daily*(keep+logi)*safe);
  var capital=qty*cost;
  var el=document.getElementById('st-res');
  if(!el)return;
  el.innerHTML='<div class="row"><span>覆盖周期</span><b>'+(keep+logi)+' 天</b></div>'+
    '<div class="row hl"><span>建议备货量</span><b>'+qty+' 件</b></div>'+
    '<div class="row"><span>预估资金占用</span><b>¥'+capital.toLocaleString()+'</b></div>'+
    '<span class="tools-badge warn">按安全系数 '+safe+' 测算，旺季请上调</span>';
}

// ========== D-79 自主对比中心 + D-43 交互式图表 ==========
var cmpState={mode:'country',sel:[]};
function jayNum(v){var n=parseFloat(String(v).replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;}
function jayParseGrowth(s){return jayNum(s);}
function jayParseMarketSize(s){var n=jayNum(s);if(/T/i.test(s))n*=1000;if(/M/i.test(s))n/=1000;return n;}
function jayParseUsers(s){var n=jayNum(s);if(/万/.test(s))n=n/10000;return n;}
var JAY_CMP_COLORS=['#3b7ab8','#2e9e6b','#e0913a','#9b59b6'];
function jayBarChart(items,opts){
  opts=opts||{};
  var unit=opts.unit||'';
  var max=0;items.forEach(function(it){if(it.value>max)max=it.value;});
  if(max<=0)max=1;
  var rows='';
  items.forEach(function(it,i){
    var pct=Math.max(2,Math.round(it.value/max*100));
    var color=JAY_CMP_COLORS[i%JAY_CMP_COLORS.length];
    var tip=(it.label||'')+'：'+(opts.fmt?opts.fmt(it.value):it.value)+(unit||'');
    rows+='<div class="jay-bar-row"><span class="jay-bar-name" title="'+escapeHtml(it.label||'')+'">'+escapeHtml(it.label||'')+'</span>'+
      '<span class="jay-bar-track"><span class="jay-bar-fill" style="width:'+pct+'%;background:'+color+'" title="'+escapeHtml(tip)+'"></span></span>'+
      '<span class="jay-bar-val">'+escapeHtml(opts.fmt?opts.fmt(it.value):String(it.value))+(unit?'<small>'+escapeHtml(unit)+'</small>':'')+'</span></div>';
  });
  return '<div class="jay-bar-chart">'+rows+'</div>';
}
function cmpSwitch(mode){
  cmpState.mode=mode;
  var tabs=document.querySelectorAll('.cmp-tab');
  tabs.forEach(function(t){t.classList.toggle('active',t.getAttribute('data-cmp')===mode);});
  cmpState.sel=[];
  cmpRenderPicker();cmpRenderSelected();
  var r=document.getElementById('cmp-result');if(r)r.innerHTML='';
}
function cmpItems(){
  if(cmpState.mode==='country') return (typeof countries!=='undefined'?countries:[]).map(function(c){return c[2];});
  if(cmpState.mode==='platform') return (typeof pfExtData!=='undefined'?Object.keys(pfExtData):[]);
  return (typeof products!=='undefined'?products:[]).slice(0,40).map(function(p){return p[1];});
}
function cmpToggleItem(name){
  var i=cmpState.sel.indexOf(name);
  if(i>=0)cmpState.sel.splice(i,1);
  else{ if(cmpState.sel.length>=4){toast('最多对比 4 项');return;} cmpState.sel.push(name); }
  cmpRenderPicker();cmpRenderSelected();
}
function cmpRenderPicker(){
  var box=document.getElementById('cmp-picker');if(!box)return;
  var items=cmpItems();
  var label=cmpState.mode==='country'?'国家':(cmpState.mode==='platform'?'平台':'商品');
  var html='<div class="cmp-picker-hint">点击选择要对比的'+label+'（最多 4 个，已选 '+cmpState.sel.length+'）</div><div class="cmp-chips">';
  items.forEach(function(n){
    var on=cmpState.sel.indexOf(n)>=0;
    html+='<button type="button" class="cmp-chip'+(on?' on':'')+'" onclick="cmpToggleItem(\''+escapeHtml(n)+'\')">'+escapeHtml(n)+'</button>';
  });
  html+='</div>';
  box.innerHTML=html;
}
function cmpRenderSelected(){
  var box=document.getElementById('cmp-selected');if(!box)return;
  if(!cmpState.sel.length){box.innerHTML='<span class="cmp-sel-empty">尚未选择，请从上方点选</span>';return;}
  var h='';
  cmpState.sel.forEach(function(n){
    h+='<span class="cmp-sel-item">'+escapeHtml(n)+'<button type="button" onclick="cmpToggleItem(\''+escapeHtml(n)+'\')">×</button></span>';
  });
  box.innerHTML=h;
}
function cmpClear(){cmpState.sel=[];cmpRenderPicker();cmpRenderSelected();var r=document.getElementById('cmp-result');if(r)r.innerHTML='';}
function cmpGetSchemes(){return jayGetWorkspaceAsset('comparison_schemes',{})}
async function cmpSaveScheme(){
  if(!jayCanUseUserDb()){toast('只读演示不保存方案，请登录后使用');return}
  if(cmpState.sel.length<2){toast('请先选择并对比至少 2 项');return;}
  var def=cmpState.mode+'·'+cmpState.sel.length+'项';
  var name=(typeof prompt==='function')?prompt('给此对比方案命名：',def):def;
  if(name===null||name==='')return;
  var schemes=cmpGetSchemes();
  schemes[name]={mode:cmpState.mode,sel:cmpState.sel.slice(),ts:Date.now()};
  var ok=await jaySaveWorkspaceAsset('comparison_schemes',schemes);
  cmpRenderSchemes();toast(ok?('已保存并同步方案：'+name):'方案云端同步失败，已暂存等待重试');
}
function cmpRenderSchemes(){
  var box=document.getElementById('cmp-schemes-list');if(!box)return;
  var schemes=cmpGetSchemes();
  var keys=Object.keys(schemes);
  if(!keys.length){box.innerHTML='<span class="cmp-sel-empty">暂无保存的方案，对比后可点「💾 保存方案」</span>';return;}
  keys.sort(function(a,b){return (schemes[b].ts||0)-(schemes[a].ts||0);});
  var html='';
  keys.forEach(function(k){
    var s=schemes[k]||{};
    var modeLabel=s.mode==='country'?'国家':(s.mode==='platform'?'平台':'商品');
    html+='<div class="cmp-scheme-item"><span class="cmp-scheme-name" title="'+escapeHtml((s.sel||[]).join('、'))+'">'+escapeHtml(k)+'</span>'+
      '<span class="cmp-scheme-meta">'+modeLabel+'·'+(s.sel?s.sel.length:0)+'项</span>'+
      '<button type="button" class="cmp-scheme-load" onclick="cmpLoadScheme(\''+escInline(k)+'\')">载入</button>'+
      '<button type="button" class="cmp-scheme-del" onclick="cmpDeleteScheme(\''+escInline(k)+'\')">×</button></div>';
  });
  box.innerHTML=html;
}
function cmpLoadScheme(name){
  var schemes=cmpGetSchemes();
  var s=schemes[name];if(!s){toast('方案不存在');return;}
  cmpSwitch(s.mode);
  cmpState.sel=(s.sel||[]).slice();
  cmpRenderPicker();cmpRenderSelected();cmpRun();
  toast('已载入方案：'+name);
}
async function cmpDeleteScheme(name){
  if(!jayCanUseUserDb()){toast('请登录后管理方案');return}
  var schemes=cmpGetSchemes();
  delete schemes[name];
  var ok=await jaySaveWorkspaceAsset('comparison_schemes',schemes);
  cmpRenderSchemes();toast(ok?('已删除方案：'+name):'删除同步失败，已暂存等待重试');
}
try{ if(typeof document!=='undefined' && document.getElementById('cmp-schemes-list')) cmpRenderSchemes(); }catch(e){}
function cmpMetricCard(title,items,opts){
  return '<div class="cmp-metric"><h4>'+escapeHtml(title)+'</h4>'+jayBarChart(items,opts)+'</div>';
}
function cmpRun(){
  var r=document.getElementById('cmp-result');if(!r)return;
  if(cmpState.sel.length<2){toast('请至少选择 2 项进行对比');return;}
  try{
    if(cmpState.mode==='country')return cmpRunCountry(r);
    if(cmpState.mode==='platform')return cmpRunPlatform(r);
    return cmpRunProduct(r);
  }catch(e){r.innerHTML='<div class="empty-state">对比渲染出错：'+escapeHtml(e.message)+'</div>';}
}
function cmpRunCountry(r){
  var rows=(typeof countries!=='undefined'?countries:[]).filter(function(c){return cmpState.sel.indexOf(c[2])>=0;});
  var sizeItems=rows.map(function(c){return {label:c[2],value:jayParseMarketSize(c[3])};});
  var growItems=rows.map(function(c){return {label:c[2],value:jayParseGrowth(c[4])};});
  var html='<div class="cmp-cards">'+cmpMetricCard('市场规模（十亿美元）',sizeItems,{unit:'B',fmt:function(v){return v>=1000?(v/1000).toFixed(2)+'T':v.toFixed(1);}})+
    cmpMetricCard('电商增速（%）',growItems,{unit:'%',fmt:function(v){return (v>0?'+':'')+v.toFixed(1);}})+'</div>';
  html+='<table class="cmp-table"><thead><tr><th>国家</th><th>市场规模</th><th>增速</th><th>主流平台</th></tr></thead><tbody>';
  rows.forEach(function(c){html+='<tr><td>'+escapeHtml(c[2])+'</td><td>'+escapeHtml(c[3])+'</td><td class="'+(jayParseGrowth(c[4])>=0?'up':'down')+'">'+escapeHtml(c[4])+'</td><td>'+escapeHtml(c[5])+'</td></tr>';});
  html+='</tbody></table>';
  html+='<button class="cmp-ai-btn" onclick="cmpAiRead()">🤖 让 AI 对比解读这 '+cmpState.sel.length+' 个国家</button>';
  r.innerHTML=html;
}
function cmpRunPlatform(r){
  var keys=cmpState.sel;
  var userItems=keys.map(function(k){var d=pfExtData[k]||{};return {label:k,value:jayParseUsers(d.users)};});
  var growItems=keys.map(function(k){var d=pfExtData[k]||{};return {label:k,value:jayParseGrowth(d.growth)};});
  var html='<div class="cmp-cards">'+cmpMetricCard('月活用户（亿）',userItems,{unit:'亿',fmt:function(v){return v.toFixed(2);}})+
    cmpMetricCard('增速（%）',growItems,{unit:'%',fmt:function(v){return (v>0?'+':'')+v.toFixed(1);}})+'</div>';
  html+='<table class="cmp-table"><thead><tr><th>平台</th><th>月活</th><th>增速</th><th>风险</th><th>入驻</th></tr></thead><tbody>';
  keys.forEach(function(k){var d=pfExtData[k]||{};var rv=d.risk||'-';html+='<tr><td>'+escapeHtml(k)+'</td><td>'+escapeHtml(d.users||'-')+'</td><td class="'+(jayParseGrowth(d.growth)>=0?'up':'down')+'">'+escapeHtml(d.growth||'-')+'</td><td><span class="cmp-risk cmp-risk-'+escapeHtml(rv)+'">'+escapeHtml(rv)+'</span></td><td>'+escapeHtml(d.entry||'-')+'</td></tr>';});
  html+='</tbody></table>';
  html+='<button class="cmp-ai-btn" onclick="cmpAiRead()">🤖 让 AI 对比解读这 '+cmpState.sel.length+' 个平台</button>';
  r.innerHTML=html;
}
function cmpRunProduct(r){
  var rows=(typeof products!=='undefined'?products:[]).filter(function(p){return cmpState.sel.indexOf(p[1])>=0;});
  var saleItems=rows.map(function(p){return {label:p[1],value:jayNum(p[8])};});
  var growItems=rows.map(function(p){return {label:p[1],value:jayParseGrowth(p[9])};});
  var html='<div class="cmp-cards">'+cmpMetricCard('月销量（件）',saleItems,{fmt:function(v){return v.toLocaleString();}})+
    cmpMetricCard('增速（%）',growItems,{unit:'%',fmt:function(v){return (v>0?'+':'')+v.toFixed(1);}})+'</div>';
  html+='<table class="cmp-table"><thead><tr><th>商品</th><th>售价(RMB)</th><th>月销</th><th>增速</th><th>评价数</th></tr></thead><tbody>';
  rows.forEach(function(p){html+='<tr><td>'+escapeHtml(p[1])+'</td><td>'+escapeHtml(p[7])+'</td><td>'+escapeHtml(p[8])+'</td><td class="'+(jayParseGrowth(p[9])>=0?'up':'down')+'">'+escapeHtml(p[9])+'</td><td>'+escapeHtml(p[12])+'</td></tr>';});
  html+='</tbody></table>';
  html+='<button class="cmp-ai-btn" onclick="cmpAiRead()">🤖 让 AI 对比解读这 '+cmpState.sel.length+' 个商品</button>';
  r.innerHTML=html;
}
function cmpAiRead(){
  var names=cmpState.sel.join('、');
  var map={country:'国家出海机会与风险',platform:'跨境电商平台优劣势',product:'商品出海潜力'};
  var prompt='请对比分析 '+names+' 这 '+cmpState.sel.length+' 个'+(cmpState.mode==='country'?'国家':(cmpState.mode==='platform'?'平台':'商品'))+' 的'+(map[cmpState.mode]||'差异')+'，给出工厂出海的优先建议与避坑要点。';
  var gs=document.getElementById('global-search');if(gs)gs.value=prompt;
  var hi=document.getElementById('ov-hero-input');if(hi){hi.value=prompt;var hs=document.getElementById('ov-hero-send');if(hs)hs.click();}
  switchPage('overview');toast('已为你生成对比分析请求');
}
try{ if(document.getElementById('cmp-picker')) cmpSwitch('country'); }catch(e){}

// ========== C1 我的产品适配分析 ==========
function mfInitMarketSelect(){
    return; // disabled v4 2026-08-21

  var sel=document.getElementById('mf-market'); if(!sel)return;
  if(sel.options.length>1)return;
  try{
    if(typeof countryFullData!=='undefined'){
      Object.keys(countryFullData).forEach(function(k){
        var d=countryFullData[k]; if(d&&d.name){ var o=document.createElement('option'); o.value=d.name; o.textContent=d.name+(d.region?('（'+(d.region)+'）'):''); sel.appendChild(o); }
      });
    }
  }catch(e){}
}
function mfScoreCountry(name){
  var region=jayCountryRegion(name)||'';
  var platformCov=0, policyRisk=0, alertRisk=0, contentHeat=0;
  try{
    if(typeof platformsData!=='undefined' && Array.isArray(platformsData)){ platformsData.forEach(function(p){ var cov=(p[1]||''); if(region&&cov.indexOf(region)>=0) platformCov++; }); }
    if(typeof policyData!=='undefined' && Array.isArray(policyData)){ policyData.forEach(function(p){ var rg=(p.region||p.regionName||''); if(rg===region||rg===name){ if((p.impact||'')==='negative') policyRisk++; } }); }
    if(typeof alerts!=='undefined' && Array.isArray(alerts)){ alerts.forEach(function(a){ if((a[4]||'')===name){ if((a[2]||'')==='high') alertRisk++; } }); }
    if(typeof contentData!=='undefined' && Array.isArray(contentData)){ contentData.forEach(function(c){ if((c[2]||'')===region) contentHeat++; }); }
  }catch(e){}
  var s1=Math.min(25, platformCov*3);
  var s2=Math.max(0, 25 - policyRisk*8);
  var s3=Math.max(0, 25 - alertRisk*10);
  var s4=Math.min(25, contentHeat*2);
  return {score:s1+s2+s3+s4, platformCov:platformCov, policyRisk:policyRisk, alertRisk:alertRisk, contentHeat:contentHeat, region:region};
}
function mfAnalyze(){
  mfInitMarketSelect();
  var cat=(document.getElementById('mf-category').value||'').trim();
  var cost=parseFloat(document.getElementById('mf-cost').value)||0;
  var market=document.getElementById('mf-market').value||'';
  var band=document.getElementById('mf-priceband').value;
  var exp=document.getElementById('mf-exp').value;
  if(!cat){ toast('请先填写产品品类'); return; }
  var names=[];
  if(market){ names=[market]; } else if(typeof countryFullData!=='undefined'){ names=Object.keys(countryFullData); }
  if(!names.length){ toast('国家数据未加载'); return; }
  var list=names.map(function(n){ var s=mfScoreCountry(n); return {name:n, score:s.score, detail:s}; })
    .sort(function(a,b){ return b.score-a.score; });
  if(!market) list=list.slice(0,5); else { var top=list.shift(); list=[top].concat(list.slice(0,4)); }
  var html=list.map(function(it,i){
    var pct=Math.round(it.score);
    var region=it.detail.region||'';
    var reasons=[];
    if(it.detail.platformCov>=3) reasons.push('平台覆盖 '+it.detail.platformCov+' 个，进入通道成熟');
    else if(it.detail.platformCov>0) reasons.push('平台覆盖 '+it.detail.platformCov+' 个');
    if(it.detail.contentHeat>=2) reasons.push('内容热度旺（'+it.detail.contentHeat+' 条爆款内容）');
    if(it.detail.policyRisk===0) reasons.push('政策友好、暂无负面变动');
    if(it.detail.alertRisk===0) reasons.push('风险信号少');
    if(!reasons.length) reasons.push('综合指标均衡，可作为观察市场');
    var risk=(it.detail.policyRisk>0||it.detail.alertRisk>0)?('⚠ 关注：'+(it.detail.alertRisk>0?('存在 '+it.detail.alertRisk+' 条高风险预警'):'存在政策负面变动 '+it.detail.policyRisk+' 项')):'✓ 当前无明显高风险信号';
    return '<div class="mf-card"><div class="mf-rank">'+(i+1)+'</div><div class="mf-card-body"><div class="mf-card-top"><b>'+it.name+'</b><span class="mf-region">'+region+'</span></div><div class="mf-score-bar"><div class="mf-score-fill" style="width:'+pct+'%"></div></div><div class="mf-card-reason">'+reasons.join('；')+'</div><div class="mf-card-risk">'+risk+'</div></div></div>';
  }).join('');
  document.getElementById('mf-cards').innerHTML=html;
  document.getElementById('mf-result-sub').textContent='基于 '+(market?('「'+market+'」单市场'):('全部 '+names.length+' 国'))+' · 品类「'+(cat.length>12?cat.slice(0,12)+'…':cat)+'」';
  document.getElementById('mf-result').classList.add('show');
  var box=document.getElementById('mf-ai-box');
  box.className='mf-ai-box show';
  if(AI_ENGINE.hasKey()){
    box.innerHTML='<h5>✨ AI 解读中…</h5>正在结合你的产品背景生成「我这个品类在 '+list[0].name+' 卖得动吗」的结论先行解读…';
    var sys='你是跨境电商选品顾问。基于用户产品背景，对最适配市场给出「能不能卖/卖给谁/怎么定价/避什么坑」的结论先行建议。简体中文，分点，不超过 200 字。';
    var user='产品品类：'+cat+'；单件成本：'+(cost?('¥'+cost):'未填')+'；目标价带：'+band+'；出海经验：'+exp+'。最适配市场：'+list[0].name+'（适配分 '+list[0].score+'/100，'+list[0].detail.region+'）。请直接给结论。';
    callAI(sys,user,{}).then(function(t){ box.innerHTML='<h5>✨ AI 解读：我这个品类在 '+list[0].name+' 卖得动吗</h5>'+(t||'（无内容）'); }).catch(function(e){ box.innerHTML='<h5>✨ AI 解读</h5>规则结论已生成；登录后可使用服务端 AI 深度解读。'; });
  } else {
    box.innerHTML='<h5>📊 规则引擎结论</h5>已为你排出最适配市场（基于平台覆盖、政策友好度、风险信号和内容热度）。登录后可进一步生成「能不能卖、卖给谁、怎么定价、避什么坑」的深度解读。';
  }
  document.getElementById('mf-result').scrollIntoView({behavior:'smooth',block:'start'});
}
function mfResetForm(){
  ['mf-category','mf-cost','mf-selling'].forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
  var box=document.getElementById('mf-result'); if(box)box.classList.remove('show');
}
function jayCloseDemoBanner(){} /* removed */function jayInitDemoBanner(){ try{ if(localStorage.getItem('jay_demo_banner_closed')==='1'){ var b=document.getElementById('demo-banner'); if(b)b.style.display='none'; } }catch(e){} }
function toggleSidebar(){ var s=document.querySelector('aside.sidebar'); if(s)s.classList.toggle('open'); var o=document.getElementById('jay-overlay'); if(o)o.classList.toggle('show'); }
function closeSidebar(){ var s=document.querySelector('aside.sidebar'); if(s)s.classList.remove('open'); var o=document.getElementById('jay-overlay'); if(o)o.classList.remove('show'); }
jayInitDemoBanner();


var searchIndex=[];
// 基于真实数据动态构建搜索索引（D-55 / N-06 搜索增强）
function jayBuildSearchIndex(){
  var idx=[];
  try{
    if(typeof countryFullData!=='undefined'){
      Object.keys(countryFullData).forEach(function(k){
        var d=countryFullData[k];
        if(d&&d.name) idx.push([d.name, '国家市场 · '+(d.region||''), 'countries']);
        if(d&&d.subtitle) idx.push([d.subtitle.split(' · ')[0], '国家市场 · '+(d.region||''), 'countries']);
      });
    }
    if(typeof products!=='undefined' && products.length){
      products.slice(0,80).forEach(function(p){ var n=p[0]||''; if(n) idx.push([n, '商品 · '+(p[1]||''), 'products']); });
    }
    if(typeof shops!=='undefined' && shops.length){
      shops.slice(0,80).forEach(function(s){ var n=s[0]||''; if(n) idx.push([n, '店铺 · '+(s[1]||''), 'shops']); });
    }
    if(typeof platformsData!=='undefined' && platformsData.length){
      platformsData.forEach(function(p){ var n=p[0]||''; if(n) idx.push([n, '电商平台 · '+(p[5]||p[1]||''), 'platforms']); });
    }
    if(typeof policyData!=='undefined' && policyData.length){
      policyData.slice(0,90).forEach(function(p){ var t=(p.title||p[1]||''); if(t) idx.push([t, '政策动态 · '+(p.region||p.regionName||''), 'policies']); });
    }
    if(typeof rulesData!=='undefined' && rulesData.length){
      rulesData.slice(0,90).forEach(function(r){ var t=(r.title||r[1]||''); if(t) idx.push([t, '平台规则 · '+(r.market||r.platform||''), 'rules']); });
    }
    if(typeof contentData!=='undefined' && contentData.length){
      contentData.forEach(function(c){
        if(c[0]) idx.push([c[0], '热门内容 · '+c[1]+' · '+c[2], 'content']);
        if(c[8]) idx.push([c[8], '带货商品 · '+c[2], 'content']);
      });
    }
  }catch(e){}
  return idx;
}
function jayRebuildSearch(){ searchIndex = jayBuildSearchIndex(); }

// ========== AI RAG 本地知识库检索层 ==========
// 把系统内置数据（国家/平台/政策/规则/商品/内容/店铺）抽取为可检索文档片段，
// 按用户问题做关键词/类目/市场重叠打分，返回 Top-K 上下文，供 callAI 注入 prompt。
// 这是「检索增强生成（RAG）」的本地侧：先检索相关知识，再让 AI 优先基于这些上下文作答。
var JAY_RAG_CORPUS = null;
function jayRagBuildCorpus(){
  var docs = [];
  function push(title, source, text, kw){
    if(!text) return;
    docs.push({ title: title, source: source, text: String(text).replace(/\n+/g,' ').slice(0, 320), kw: (kw||'').toLowerCase() });
  }
  try {
    if(typeof countries!=='undefined' && countries.length){
      countries.forEach(function(c){
        push(c[1]+' 市场概况', '国家市场', '市场:'+c[1]+'，区域:'+c[2]+'，市场容量:'+c[3]+'，年增速:'+c[4]+'，主流平台:'+c[5]+'，电商渗透率:'+(c[6]||'')+'。', c[1]+' '+c[2]+' '+(c[5]||''));
      });
    }
    if(typeof platformsData!=='undefined' && platformsData.length){
      platformsData.forEach(function(p){
        var name = p.name || p[0] || '';
        var region = p.region || p[1] || '';
        var cats = p.categories || p[2] || '';
        var fee = p.fee || p[3] || '';
        push(name+' 平台档案', '电商平台', '平台:'+name+'，覆盖区域:'+region+'，适合类目:'+cats+'，费用结构:'+fee+'。', name+' '+region+' '+cats);
      });
    }
    if(typeof policyData!=='undefined' && policyData.length){
      policyData.forEach(function(p){
        push(p[0]+' · '+p[1], '政策动态', '政策:'+p[1]+'（'+(p[3]||'')+'）'+(p[8]?('，要点:'+p[8].slice(0,120)):''), (p[0]||'')+' '+(p[1]||'')+' '+(p[3]||''));
      });
    }
    if(typeof rulesData!=='undefined' && rulesData.length){
      rulesData.forEach(function(r){
        push(r[0]+' · '+r[1], '平台规则', '平台:'+r[0]+' 类目:'+r[1]+'，规则要点:'+r[5]+'，建议:'+r[6], (r[0]||'')+' '+(r[1]||'')+' '+(r[5]||''));
      });
    }
    if(typeof products!=='undefined' && products.length){
      products.slice(0, 200).forEach(function(p){
        var name = p.name || p[0] || '';
        var cat = p.category || p[2] || '';
        var market = p.market || p[1] || '';
        push('选品 · '+name, '选品雷达', '商品:'+name+'，市场:'+market+'，类目:'+cat+'，增速:'+(p.growth||p[3]||'')+'，价格带:'+(p.price||p[4]||''), name+' '+cat+' '+market);
      });
    }
    if(typeof contentData!=='undefined' && contentData.length){
      contentData.forEach(function(c){
        push('热门内容 · '+c[0], '内容趋势', '标题:'+c[0]+'，平台:'+c[1]+'，市场:'+c[2]+'，类目:'+c[10]+'，互动:'+c[11], (c[0]||'')+' '+(c[2]||'')+' '+(c[10]||''));
      });
    }
    if(typeof shops!=='undefined' && shops.length){
      shops.forEach(function(s){
        push('店铺 · '+s[0], '店铺追踪', '店铺:'+s[0]+'，平台:'+s[1]+'，市场:'+s[2]+'，GMV:'+s[3]+'，增速:'+s[4]+'，主营:'+s[6], (s[0]||'')+' '+(s[1]||'')+' '+(s[2]||'')+' '+(s[6]||''));
      });
    }
  } catch(e){}
  return docs;
}
// 简单中文分词：按字符 2-gram + 保留原词，兼顾短词匹配
function jayRagTokens(str){
  str = (str||'').toLowerCase();
  var tokens = [];
  // 英文/数字连续词
  (str.match(/[a-z0-9]+/g) || []).forEach(function(w){ tokens.push(w); });
  // 中文按 2-gram
  var cn = str.replace(/[^一-龥]/g, '');
  for(var i=0;i<cn.length-1;i++){ tokens.push(cn.substr(i,2)); }
  if(cn.length===1) tokens.push(cn);
  return tokens;
}
function jayRagRetrieve(query, k){
  k = k || 6;
  if(!JAY_RAG_CORPUS) JAY_RAG_CORPUS = jayRagBuildCorpus();
  var qTokens = jayRagTokens(query);
  if(!qTokens.length) return [];
  var scored = [];
  JAY_RAG_CORPUS.forEach(function(d){
    var dTokens = jayRagTokens(d.kw + ' ' + d.title + ' ' + d.text.slice(0,80));
    var overlap = 0;
    qTokens.forEach(function(qt){
      if(qt.length < 2) return;
      dTokens.forEach(function(dt){ if(qt.indexOf(dt) >= 0 || dt.indexOf(qt) >= 0) overlap++; });
    });
    // 标题命中加权
    var titleHit = (d.title + ' ' + d.kw).toLowerCase().indexOf(query.toLowerCase()) >= 0 ? 3 : 0;
    var score = overlap + titleHit;
    if(score > 0) scored.push({ doc: d, score: score });
  });
  scored.sort(function(a,b){ return b.score - a.score; });
  return scored.slice(0, k).map(function(s){ return s.doc; });
}
// 把检索结果格式化为可注入 prompt 的上下文块（含来源标注）
function jayRagContextBlock(query, k){
  var hits = jayRagRetrieve(query, k);
  if(!hits.length) return { text: '', sources: [] };
  var lines = hits.map(function(d, i){
    return '['+(i+1)+'] ('+d.source+') '+d.title+'：'+d.text;
  });
  var block = '【JAY观海知识库上下文（系统内置数据，优先据此作答并标注来源）】\n' + lines.join('\n');
  var sources = [];
  hits.forEach(function(d){ if(sources.indexOf(d.source) < 0) sources.push(d.source); });
  return { text: block, sources: sources };
}

// 守卫：旧版 #global-search DOM 已在顶栏改版中移除（现为 .topbar-search），元素缺失时跳过绑定（否则抛 TypeError 杀死脚本块）
const search=$('#global-search'),results=$('#search-results');
if(search&&results){search.oninput=()=>{const q=search.value.trim();if(!q){results.classList.remove('show');return}if(!searchIndex.length)jayRebuildSearch();const hits=searchIndex.filter(x=>x[0].toLowerCase().indexOf(q.toLowerCase())>=0||x[1].toLowerCase().indexOf(q.toLowerCase())>=0).slice(0,12);results.innerHTML=(hits.length?hits:[['未找到精确结果','可尝试商品名、店铺名、政策关键词或类目','overview']]).map(x=>`<div class="result" data-page="${x[2]}"><b>${x[0]}</b><small>${x[1]}</small></div>`).join('');results.classList.add('show')};results.onclick=e=>{const item=e.target.closest('.result');if(item){switchPage(item.dataset.page);results.classList.remove('show');search.value=''}};}
