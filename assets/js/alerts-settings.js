// === AI 智能洞察卡片 ===
const aiInsights={
  products:[
    '美妆个护品类在TikTok Shop持续爆发，建议加大该品类选品投入，重点关注Medicube等高增速品牌',
    '欧美市场家居品类增长强劲（Ninja CREAMi +173.6%），建议关注季节性产品窗口',
    '宠物用品在多个市场呈现爆发态势，建议作为新拓品方向重点布局',
    '东南亚防晒品类进入旺季周期，Shopee数据显示增速22%+，建议提前备货'
  ],
  countries:[
    '东南亚市场整体增速领先（印尼+15%、越南+18%、菲律宾+20%），建议优先分配资源',
    '中东市场（沙特+18%、阿联酋+15%）客单价高且竞争相对缓和，适合品牌化打法',
    '非洲和拉美市场增速快但基础设施薄弱，建议采用轻资产模式试水',
    '欧美成熟市场竞争激烈，需差异化选品+内容营销组合拳'
  ],
  shops:[
    'Medicube Official月GMV达$1,630万，增速52%，建议研究其TikTok Shop运营策略作为标杆',
    '高增速店铺（BIBIDO +454%、Rejuran +600%）均来自美妆个护品类，验证了该赛道的爆发力',
    '多个"关注"状态店铺增速异常，建议密切监控是否可持续'
  ],
  platforms:[
    'TikTok Shop在欧美市场GMV突破200亿美元，2026年欧洲扩站至14国，建议优先布局',
    'Ozon（俄罗斯）GMV增长45%且跨境销售目标翻倍，是进入俄语市场的核心渠道',
    'Shopee在东南亚仍保持30%增长，佣金率较低（1-5.5%），利润率优势明显'
  ],
  macro:[
    '印度GDP增速6.8%领跑全球，但CPI 4.8%通胀偏高，建议关注消费升级机会同时注意成本波动',
    '越南GDP 6.5%且通胀温和（3.8%），电商环境健康度在东南亚市场中最优',
    '尼日利亚通胀33.7%极高，汇率风险大，建议谨慎控制库存和应收账款周期'
  ],
  policies:[
    '美国对华关税升至145%，直接影响全品类成本结构，建议评估FBM/海外仓替代方案',
    '印尼取消150美元免税门槛+SNI认证扩展至35类，合规成本显著上升，建议提前办理认证',
    '欧盟GPSR和DSA同步执行，所有出口欧洲产品需配备欧盟境内负责人，建议尽快注册'
  ],
  rules:[
    'TikTok Shop东南亚佣金从1%上调至2.5%+0.5%交易费，建议重新核算该渠道利润模型',
    'Amazon北美大件FBA费用上调$2-5/件，大件商品卖家应评估FBM或第三方仓替代方案',
    '多平台加强扣分/下架处罚力度，建议建立内部合规SOP，重点管控虚假发货和宣传话术'
  ],
  content:[
    '短视频仍是转化率最高的内容形式，TikTok短视频平均转化率6-12%，建议加大短视频素材投入',
    '商品测评类内容播放量虽低于短视频但转化率稳定（5-8%），适合高客单产品种草',
    '欧美市场"使用前后对比"类内容爆发力强（BriteWite美白粉3200万播放），适合功效型产品',
    '中东市场奢侈开箱视频转化率达9.2%，高客单品牌可利用KOL开箱策略'
  ]
};

function renderAIInsight(pageId){
  const container=$('#ai-'+pageId);
  if(!container||!aiInsights[pageId])return;
  const items=aiInsights[pageId];
  container.innerHTML=`<div class="ai-insight">
    <div class="ai-insight-head">
      <span class="ai-icon">✨</span>
      <h4>AI 智能洞察</h4>
      <small>基于当前数据生成的行动建议</small>
    </div>
    <ul>${items.map(item=>`<li>${item}</li>`).join('')}</ul>
  </div>`;
}

// 渲染所有页面的AI洞察
['products','countries','shops','platforms','policies','rules','content','report'].forEach(renderAIInsight);

// === Round 2: AI Diagnosis Card ===
(function(){
  var el=$('#ov-ai-diagnosis');
  if(!el)return;
  el.innerHTML='<h4>✨ AI 全球市场综合诊断 <span class="pro-badge">PRO</span></h4><ul><li>🌍 <b>推荐拓国：</b>越南（GDP 6.5%，电商增速 34.8%）</li><li>🔥 <b>潜力赛道：</b>美妆个护（TikTok Shop GMV 增速 52%）</li><li>⚠️ <b>市场风险：</b>美国对华关税 145%，全品类成本承压</li></ul>';
})();


// ========== ALERTS CENTER ==========
// Dynamic alerts auto-generated from policies and rules data (JAY观海 AI)
var dynamicAlerts = [];
var dynamicAlertsLoaded = false;

function generateDynamicAlerts(){
  dynamicAlerts = [];
  // --- from policies: impact_level === 'high' ---
  var pItems = policiesJsonData ? policiesJsonData.items : defaultPoliciesData.items;
  var regionLabelMap = {US:'美国',EU:'欧盟',SEA:'东南亚',CN:'中国',UK:'英国',JP:'日本',KR:'韩国',Global:'全球',JP:'日本',IN:'印度',BR:'巴西',MX:'墨西哥'};
  pItems.forEach(function(p, idx){
    if(p.impact_level !== 'high') return;
    var region = regionLabelMap[p.region] || p.region || '全球';
    var title = p.title || '未命名政策';
    var summary = p.summary || '详见来源链接';
    dynamicAlerts.push({
      id: 'dyn-p-' + (p.id || idx),
      type: 'policy',
      level: 'high',
      title: title,
      country: region,
      platform: '-',
      detail: summary,
      date: p.published_at || p.effective_date || '2026-07-13',
      read: false,
      source: 'JAY观海 AI 自动生成',
      refId: p.id,
      category: p.category || 'regulation'
    });
  });

  // --- from rules: impact_level === 'high' ---
  var rItems = rulesJsonData ? rulesJsonData.items : defaultRulesData.items;
  rItems.forEach(function(r, idx){
    if(r.impact_level !== 'high') return;
    var platform = r.platform || '多平台';
    var market = regionLabelMap[r.market] || r.market || '全球';
    var title = r.title || '未命名规则';
    var summary = r.summary || '详见平台公告';
    dynamicAlerts.push({
      id: 'dyn-r-' + (r.id || idx),
      type: 'platform',
      level: 'high',
      title: title,
      country: market,
      platform: platform,
      detail: summary,
      date: r.effective_date || r.published_at || '2026-07-13',
      read: false,
      source: 'JAY观海 AI 自动生成',
      refId: r.id,
      category: r.category || 'regulation'
    });
  });

  // --- from countryFullData: high impact policies ---
  if(typeof countryFullData !== 'undefined'){
    var cKeys = Object.keys(countryFullData);
    cKeys.forEach(function(ck){
      var cd = countryFullData[ck];
      if(!cd || !cd.comp || !cd.comp.policies) return;
      cd.comp.policies.forEach(function(cp, ci){
        if(cp[0] !== 'high') return;
        var title = '['+cd.name+'] '+cp[1];
        dynamicAlerts.push({
          id: 'country-p-' + ck + '-' + ci,
          type: 'country',
          level: 'high',
          title: title,
          country: cd.name,
          platform: cp[4] || '全平台',
          detail: cp[5] || '',
          date: (cp[2]||'').replace(/[^0-9\-\/]/g,'').trim() || '2026-01-01',
          read: false,
          source: 'country_data',
          refId: 'country-' + ck + '-policy-' + ci,
          category: 'regulation'
        });
      });
    });
  }

  // Sort by date desc
  dynamicAlerts.sort(function(a,b){
    return (b.date||'').localeCompare(a.date||'');
  });
  dynamicAlertsLoaded = true;
}

var alDynReadMap = {};

// Merge hardcoded alertsFull + dynamic alerts into combined list for rendering
function getCombinedAlerts(){
  // Convert array-format alertsFull entries to objects for unified handling
  var base = alertsFull.map(function(a){
    return {
      id: a[0], type: a[1], level: a[2], title: a[3],
      country: a[4], platform: a[5], detail: a[6],
      date: a[7], read: a[8],
      source: '系统内置'
    };
  });
  // Apply read-state map to dynamic alerts
  var dyn = dynamicAlerts.map(function(a){
    return {
      id: a.id, type: a.type, level: a.level, title: a.title,
      country: a.country, platform: a.platform, detail: a.detail,
      date: a.date,
      read: !!alDynReadMap[a.id],
      source: a.source || 'JAY观海 AI 自动生成'
    };
  });
  // Filter out dynamic alerts that duplicate base ones (by title similarity)
  var baseTitles = {};
  base.forEach(function(a){ baseTitles[a.title] = true; });
  dyn = dyn.filter(function(a){ return !baseTitles[a.title]; });
  return base.concat(dyn);
}

// Trigger alert page refresh whenever policies/rules data loads
function refreshDynamicAlerts(){
  generateDynamicAlerts();
  // If alerts page is currently active, re-render
  var alertsPage = document.getElementById('alerts');
  if(alertsPage && alertsPage.classList.contains('active')){
    renderAlerts();
  }
  // Update sidebar badge
  updateAlBadge();
}

var alCurrentTab='all';
var alCurrentPage=1;
var alPerPage=10;
var alSelected=new Set();
var alTypeIcons={shop:'🏪',cat:'📈',policy:'📜',macro:'💹',platform:'🔧'};
var alTypeLabels={shop:'店铺异动',cat:'类目爆款',policy:'政策合规',macro:'宏观经济',platform:'平台规则'};
var alLevelLabels={high:'高风险',mid:'中风险',low:'普通'};
var alTypeTargets={shop:'products',cat:'products',policy:'policies',macro:'countries',platform:'rules'};

// Initial alerts render will be triggered by switchPage

function renderAlerts(){
    return; // disabled v4 2026-08-21

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
  var all = getCombinedAlerts();
  return all.filter(function(a){
    if(tabType!=='all'&&a.type!==tabType)return false;
    if(typeF!=='all'&&a.type!==typeF)return false;
    if(levelF!=='all'&&a.level!==levelF)return false;
    if(searchQ&&a.title.toLowerCase().indexOf(searchQ)<0&&(a.platform||'').toLowerCase().indexOf(searchQ)<0&&a.detail.toLowerCase().indexOf(searchQ)<0)return false;
    if(timeF!=='all'){
      var d=new Date(a.date);
      var diff=Math.floor((now-d)/(86400000));
      if(timeF==='today'&&diff>0)return false;
      if(timeF==='3d'&&diff>3)return false;
      if(timeF==='7d'&&diff>7)return false;
    }
    return true;
  });
}

function renderAlSummary(){
  var all = getCombinedAlerts();
  var total=all.filter(function(a){return!a.read}).length;
  var high=all.filter(function(a){return a.level==='high'&&!a.read}).length;
  var today=all.filter(function(a){return a.date==='2026-07-15'}).length;
  var done=all.filter(function(a){return a.read}).length;
  var dynCount = dynamicAlerts.length;
  var el=document.getElementById('al-summary');
  el.innerHTML='<div class="al-summary-card sc-total"><div class="al-sc-label">未读预警</div><div class="al-sc-val">'+total+'</div><div class="al-sc-sub">较昨日 +3</div></div>'
    +'<div class="al-summary-card sc-high"><div class="al-sc-label">高风险紧急</div><div class="al-sc-val">'+high+'</div><div class="al-sc-sub">需立即处理</div></div>'
    +'<div class="al-summary-card sc-today"><div class="al-sc-label">今日新增</div><div class="al-sc-val">'+today+'</div><div class="al-sc-sub">实时更新</div></div>'
    +'<div class="al-summary-card sc-done"><div class="al-sc-label">已处理归档</div><div class="al-sc-val">'+done+'</div><div class="al-sc-sub">累计已处理</div></div>';
  // Add dynamic alert count banner
  var bannerHtml = '<div class="al-dyn-banner">'
    + '<span class="al-dyn-icon">🤖</span>'
    + '<div class="al-dyn-text">'
    + '<b>JAY观海 AI 自动预警</b>：基于政策与规则数据自动生成 <span class="al-dyn-count">' + dynCount + '</span> 条预警'
    + '（政策变动 ' + dynamicAlerts.filter(function(a){return a.type==='policy'}).length + ' 条 · 平台规则 ' + dynamicAlerts.filter(function(a){return a.type==='platform'}).length + ' 条）'
    + '</div></div>';
  el.innerHTML = bannerHtml + el.innerHTML;
}

function renderAlTabs(){
  var tabs=[{k:'all',l:'全部'},{k:'shop',l:'店铺追踪'},{k:'cat',l:'类目爆款'},{k:'policy',l:'政策合规'},{k:'macro',l:'宏观数据'},{k:'platform',l:'平台规则'}];
  var html='';
  var all = getCombinedAlerts();
  tabs.forEach(function(t){
    var cnt=t.k==='all'?all.length:all.filter(function(a){return a.type===t.k}).length;
    var cls=alCurrentTab===t.k?'al-tab active':'al-tab';
    html+='<button class="'+cls+'" onclick="alSwitchTab(\''+escInline(t.k)+'\')">'+ escapeHtml(t.l) +'<span class="tab-count">'+cnt+'</span></button>';
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
    var id=a.id,type=a.type,level=a.level,title=a.title,country=a.country,platform=a.platform,detail=a.detail,date=a.date,read=a.read;
    var icon=alTypeIcons[type]||'📋';
    var typeLabel=alTypeLabels[type]||type;
    var levelLabel=alLevelLabels[level]||level;
    var checked=alSelected.has(id)?'checked':'';
    var readCls=read?'read':'unread';
    var srcTag = a.source === 'JAY观海 AI 自动生成' ? '<span class="al-src-tag ai">🤖 JAY观海 AI 自动生成</span>' : '';
    html+='<div class="al-card '+readCls+'" id="al-card-'+id+'">';
    html+='<div class="al-card-check"><input type="checkbox" '+checked+' onchange="alToggleSelect(\''+id+'\',this.checked)"></div>';
    html+='<div class="al-card-icon type-'+type+'">'+icon+'</div>';
    html+='<div class="al-card-body">';
    html+='<div class="al-card-title">'+title+' '+srcTag+'</div>';
    html+='<div class="al-card-meta">';
    html+='<span class="meta-tag '+level+'">'+levelLabel+'</span>';
    html+='<span>'+typeLabel+'</span>';
    if(country&&country!=='-')html+='<span>📍 '+country+'</span>';
    if(platform&&platform!=='-')html+='<span>🛒 '+platform+'</span>';
    html+='<span>📅 '+jayFmtTime(date)+'</span>';
    html+='</div>';
    html+='<div class="al-card-detail">'+parseDetail(detail)+'</div>';
    html+='</div>';
    html+='<div class="al-card-actions">';
    html+='<button onclick="alViewDetail(\''+escInline(id)+'\')">查看详情</button>';
    html+='<button class="al-ai-btn" onclick="alAiAnalysis(\''+escInline(id)+'\')">AI 解读</button>';
    html+='<button onclick="alArchive(\''+escInline(id)+'\')">归档</button>';
    html+='</div>';
    html+='</div>';
  });
  el.innerHTML=html;
}

function parseDetail(d){
  return d.replace(/(\+\d+\.?\d*%)/g,'<span class="val-up">$1</span>')
          .replace(/(-\d+\.?\d*%)/g,'<span class="val-down">$1</span>')
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
function alSearch(){alCurrentPage=1;renderAlerts(); var al=document.getElementById('al-list'); if(al){ try{ jayHighlightMatches(al, ($('#al-search-input')||{}).value); }catch(e){} } }
function alGoPage(p){alCurrentPage=p;renderAlerts();window.scrollTo({top:document.getElementById('al-list').offsetTop-80,behavior:'smooth'});}

function alToggleSelect(id,checked){
  if(checked)alSelected.add(id);else alSelected.delete(id);
  renderAlBatch();
}
function alToggleSelectAll(checked){
  var filtered=getFilteredAlerts();
  var start=(alCurrentPage-1)*alPerPage;
  var pageItems=filtered.slice(start,start+alPerPage);
  pageItems.forEach(function(a){if(checked)alSelected.add(a.id);else alSelected.delete(a.id);});
  renderAlerts();
}

function alArchive(id){
  for(var i=0;i<alertsFull.length;i++){
    if(alertsFull[i][0]===id){alertsFull[i][8]=true;break;}
  }
  alDynReadMap[id] = true;
  alSelected.delete(id);
  toast('已归档该预警');
  renderAlerts();
}
function alMarkAllRead(){
  alertsFull.forEach(function(a){a[8]=true;});
  dynamicAlerts.forEach(function(a){ alDynReadMap[a.id] = true; });
  toast('已全部标为已读');
  renderAlerts();
}
function alBatchArchive(){
  alSelected.forEach(function(id){
    for(var i=0;i<alertsFull.length;i++){if(alertsFull[i][0]===id){alertsFull[i][8]=true;break;}}
    alDynReadMap[id] = true;
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
  var all = getCombinedAlerts();
  var a = all.find(function(x){return x.id===id});
  if(!a)return;
  if(a.type==='shop'||a.type==='cat')switchPage('products');
  else if(a.type==='policy')switchPage('policies');
  else if(a.type==='macro')switchPage('countries');
  else if(a.type==='platform')switchPage('rules');
  else switchPage('overview');
  toast('已跳转到'+alTypeLabels[a.type]+'板块');
}

function alAiAnalysis(id){
  var all = getCombinedAlerts();
  var a = all.find(function(x){return x.id===id});
  if(!a)return;
  var analyses={
    shop:'AI 风险诊断：该店铺异动主要由运营指标下滑引起。建议：① 立即排查核心 SKU 的库存和评价状态；② 对比同期竞品数据确认是否为行业趋势；③ 调整广告投放策略，优先保 ROI。',
    cat:'AI 趋势分析：该类目出现显著增长信号。建议：① 评估自身供应链能否承接增量；② 锁定 Top10 爆品的核心卖点做差异化选品；③ 关注增速是否可持续，排除季节性脉冲。',
    policy:'AI 合规解读：该政策变动将直接影响跨境卖家的成本和合规要求。建议：① 立即评估受影响 SKU 清单；② 联系当地合规代理确认执行细节；③ 调整定价模型以覆盖新增成本。',
    macro:'AI 宏观研判：该经济指标变化可能影响跨境利润。建议：① 评估汇率波动对毛利的影响幅度；② 考虑调整结算货币或增加对冲工具；③ 监控趋势是否持续恶化。',
    platform:'AI 规则影响：平台规则调整将改变运营环境。建议：① 仔细阅读完整规则文本；② 评估对现有商品和店铺的具体影响；③ 在生效日期前完成合规调整。'
  };
  toast(analyses[a.type]||'AI 分析功能需升级专业版');
}

function alExport(){toast('预警报告导出功能需升级专业版');}

function updateAlBadge(){
  if(typeof jayIsDemo!=='undefined' && jayIsDemo){
    var demoBadge=document.querySelector('.nav-item[data-page="alerts"] .nav-badge');
    if(demoBadge){demoBadge.textContent='';demoBadge.style.display='none';}
    var demoPanel=document.getElementById('al-unread-badge');
    if(demoPanel){demoPanel.textContent='';demoPanel.style.display='none';}
    return;
  }
  var all = getCombinedAlerts();
  var unread = all.filter(function(a){return!a.read}).length;
  var badge=document.getElementById('al-unread-badge');
  if(badge){badge.textContent=unread;badge.style.display=unread>0?'inline-block':'none';}
  var navBadge=document.querySelector('.nav-item[data-page="alerts"] .nav-badge');
  if(navBadge){navBadge.textContent=unread;navBadge.style.display=unread>0?'inline-block':'none';}
}

function openAlertSettings(){
  var overlay=document.createElement('div');
  overlay.className='al-modal-overlay show';
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  overlay.innerHTML='<div class="al-modal">'
    +'<div class="al-modal-head"><h3>⚙ 告警设置</h3><button class="al-modal-close" onclick="this.closest(\'.al-modal-overlay\').remove()">✕</button></div>'
    +'<div class="al-modal-body">'
    +'<div class="al-setting-group"><h4>预警类型开关</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">店铺异动预警</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">类目爆款异动</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">政策合规预警</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">宏观经济预警</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">平台规则变更</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'</div>'
    +'<div class="al-setting-group"><h4>推送方式</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">站内弹窗通知</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">右下角消息浮窗</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">同步到「我的看板」</span><div class="al-toggle" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'</div>'
    +'<div class="al-setting-group"><h4>自定义阈值（专业版）</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">GMV 波动触发阈值</span><input class="al-threshold-input" value="30%" disabled></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">差评率触发阈值</span><input class="al-threshold-input" value="5%" disabled></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">类目增速触发阈值</span><input class="al-threshold-input" value="50%" disabled></div>'
    +'</div>'
    +'</div></div>';
  document.body.appendChild(overlay);
}



// ===== 设置与权限页面 =====

function stInit(){
  stInitAccount();
  stLoadSubPref();
  stApplySettingsPrefs();
  stInitTeam();
  stInitSystemStatus();
}

function stSwitchTab(tab){
  document.querySelectorAll('.st-tab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.st-side-btn').forEach(function(b){b.classList.remove('active')});
  var el=document.getElementById('st-tab-'+tab);
  if(el)el.classList.add('active');
  var activeButton=document.querySelector('.st-side-btn[data-st-tab="'+tab+'"]');
  if(activeButton)activeButton.classList.add('active');
  if(tab==='account')stInitAccount();
  if(tab==='alerts')stLoadSubPref();
  if(tab==='prefs')stApplySettingsPrefs();
  if(tab==='team')stInitTeam();
  if(tab==='system')stInitSystemStatus();
}

async function stSaveAccount(){
  if(!jayCanUseUserDb()||!jayProfile){stToast('只读演示不保存资料，请登录后修改');return}
  var name = document.getElementById('st-username').value.trim();
  var company = document.getElementById('st-company').value.trim();
  var phone = document.getElementById('st-phone').value.trim();
  var jobTitle = document.getElementById('st-role').value;
  var button=document.getElementById('st-account-save');if(button){button.disabled=true;button.textContent='保存中...'}
  try{
    var result=await supabaseClient.from('profiles').update({display_name:name||jayProfile.display_name,company:company,phone:phone,job_title:jobTitle}).eq('id',jayUser.id).select('*').single();
    if(result.error)throw result.error;
    jayProfile=result.data;
    updateSidebarUserInfo();stInitAccount();stToast('账号资料已同步');
  }catch(error){
    console.warn('[JAY观海] profile update failed:',error);
    stToast('账号保存失败：'+(error.message||'请稍后重试'));
  }finally{if(button){button.disabled=false;button.textContent='保存修改'}}
}
function stInitAccount(){
  if(!jayProfile) return;
  var u = document.getElementById('st-username'); if(u) u.value = jayProfile.display_name || '';
  var em = document.getElementById('st-email'); if(em) em.value = jayProfile.email || '';
  var co = document.getElementById('st-company'); if(co) co.value = jayProfile.company || '';
  var ph = document.getElementById('st-phone'); if(ph) ph.value = jayProfile.phone || '';
  var ro = document.getElementById('st-role'); if(ro) ro.value=jayProfile.job_title||'';
  var rd = document.getElementById('st-regdate'); if(rd) rd.value = jayProfile.created_at ? new Date(jayProfile.created_at).toLocaleDateString('zh-CN') : (jayIsDemo?'只读演示':'-');
  var ab = document.getElementById('st-avatar-big'); if(ab) ab.textContent = (jayProfile.display_name||jayProfile.email||'U').charAt(0).toUpperCase();
  stRenderTierBadge();
}
function stRenderTierBadge(){
  var b = document.getElementById('st-tier-badge');
  if(!b || !jayProfile) return;
  var t = jayProfile.tier||'free';
  b.textContent = '会员：' + (JAY_TIER_LABELS[t]||t);
}
async function stSendPasswordReset(){
  if(!jayCanUseUserDb()){stToast('请登录后修改密码');return}
  var result=await supabaseClient.auth.resetPasswordForEmail(jayUser.email,{redirectTo:location.origin+location.pathname});
  stToast(result.error?('发送失败：'+translateAuthErr(result.error.message)):'密码重置邮件已发送');
}
async function stSaveWorkspacePref(key,value){
  if(!jayCanUseUserDb()){stToast('只读演示不保存偏好，请登录后设置');return false}
  var previous=Object.assign({},jayPreferenceCache.workspace_prefs||{});
  jayPreferenceCache.workspace_prefs=Object.assign({},previous);jayPreferenceCache.workspace_prefs[key]=value;
  var ok=await saveUserPreferences({workspace_prefs:jayPreferenceCache.workspace_prefs});
  if(!ok){jayPreferenceCache.workspace_prefs=previous;stApplySettingsPrefs();stToast('偏好同步失败，请重试');return false}
  return true;
}
async function stCurrency(c){
  if(!(await stSaveWorkspacePref('currency',c)))return;
  document.getElementById('st-currency-cny').className='st-btn st-btn-sm '+(c==='cny'?'st-btn-primary':'st-btn-outline');
  document.getElementById('st-currency-usd').className='st-btn st-btn-sm '+(c==='usd'?'st-btn-primary':'st-btn-outline');
  stToast('货币单位: '+(c==='cny'?'人民币':'美元'));
}
async function stUnit(u){
  if(!(await stSaveWorkspacePref('unit',u)))return;
  document.getElementById('st-unit-wan').className='st-btn st-btn-sm '+(u==='wan'?'st-btn-primary':'st-btn-outline');
  document.getElementById('st-unit-m').className='st-btn st-btn-sm '+(u==='m'?'st-btn-primary':'st-btn-outline');
  stToast('数值单位: '+(u==='wan'?'万':'百万'));
}
async function stToggleCnViewSetting(el){
  var enabled=!el.classList.contains('on');
  if(await stSaveWorkspacePref('cn_view',enabled)){el.classList.toggle('on',enabled);jayApplyPreferencesToUi();stToast('中国出海视角已'+(enabled?'启用':'关闭'))}
}
function stApplySettingsPrefs(){
  var workspace=jayPreferenceCache.workspace_prefs||{};
  var currency=workspace.currency||'cny';var unit=workspace.unit||'wan';
  var cny=document.getElementById('st-currency-cny');var usd=document.getElementById('st-currency-usd');
  if(cny)cny.className='st-btn st-btn-sm '+(currency==='cny'?'st-btn-primary':'st-btn-outline');
  if(usd)usd.className='st-btn st-btn-sm '+(currency==='usd'?'st-btn-primary':'st-btn-outline');
  var wan=document.getElementById('st-unit-wan');var mil=document.getElementById('st-unit-m');
  if(wan)wan.className='st-btn st-btn-sm '+(unit==='wan'?'st-btn-primary':'st-btn-outline');
  if(mil)mil.className='st-btn st-btn-sm '+(unit==='m'?'st-btn-primary':'st-btn-outline');
  var cn=document.getElementById('st-cn-view-toggle');if(cn)cn.classList.toggle('on',workspace.cn_view===true);
}
function stInitSystemStatus(){
  var auth=document.getElementById('st-system-auth');if(auth)auth.textContent=jayIsDemo?'只读演示':(jayUser?'已连接':'未登录');
  var authDot=document.getElementById('st-system-auth-dot');if(authDot)authDot.style.background=(!jayIsDemo&&jayUser)?'#27ae60':'#94a3b8';
  var quality=document.getElementById('st-system-quality');
  var status=typeof jayQualityStatus==='function'?jayQualityStatus(JAY_QUALITY_REPORT):'pending';
  if(quality)quality.textContent={healthy:'数据实时',degraded:'部分降级',stale:'数据过期',failed:'校验失败',pending:'读取中'}[status]||'读取中';
  var qualityDot=document.getElementById('st-system-quality-dot');if(qualityDot)qualityDot.style.background=status==='healthy'?'#27ae60':(status==='degraded'?'#e8a33d':(status==='pending'?'#94a3b8':'#e25555'));
  var updated=document.getElementById('st-system-updated');if(updated)updated.textContent=JAY_QUALITY_REPORT&&JAY_QUALITY_REPORT.generated_at?jayQualityDate(JAY_QUALITY_REPORT.generated_at):'尚未读取';
  var reports=document.getElementById('st-rep-count');if(reports)reports.textContent=rpV2GetReports().length;
  var materials=document.getElementById('st-fav-count');if(materials)materials.textContent=rpGetPool().length;
  var watched=document.getElementById('st-watch-count');if(watched)watched.textContent=(watchlistData||[]).length;
}

function stTeamEsc(value){
  var text=String(value==null?'':value);
  if(typeof escapeHtml==='function') return escapeHtml(text);
  return text.replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
}
function stTeamDate(value){
  if(!value)return '-';
  var d=new Date(value);return isFinite(d.getTime())?d.toLocaleDateString('zh-CN'): '-';
}
function stTeamError(error){
  var map={AUTH_REQUIRED:'请先登录后管理工作区',WORKSPACE_FORBIDDEN:'当前账号没有工作区管理权限',WORKSPACE_NOT_FOUND:'暂未找到工作区，请联系管理员',INVITE_EMAIL_INVALID:'请输入有效的邮箱地址',WORKSPACE_NAME_INVALID:'工作区名称不能为空'};
  return map[error&&error.message] || (error&&error.message) || '操作失败，请稍后重试';
}
function stRenderTeam(){
  var ctx=window.jayWorkspaceContext||jayWorkspaceContext||{};
  var unavailable=document.getElementById('st-workspace-unavailable');
  var content=document.getElementById('st-workspace-content');
  if(!content)return;
  if(!ctx.available){
    content.style.display='none';
    if(unavailable){unavailable.style.display='block';unavailable.textContent=ctx.loading?'正在读取工作区…':(jayIsDemo?'只读演示模式不加载团队数据，请登录后使用。':stTeamError(ctx.error));}
    return;
  }
  content.style.display='block';if(unavailable)unavailable.style.display='none';
  var ws=ctx.workspace||{};var role=ctx.membership&&ctx.membership.role||'';var manager=['owner','admin'].indexOf(role)>=0;
  var name=document.getElementById('st-workspace-name');if(name)name.value=ws.name||'';
  var count=document.getElementById('st-workspace-member-count');if(count)count.value=String((ctx.members||[]).length);
  var roleEl=document.getElementById('st-workspace-role');if(roleEl){roleEl.textContent=jayWorkspaceRoleLabel(role);roleEl.className='st-role-pill '+(role==='owner'?'owner':role==='admin'?'admin':'member');}
  var meta=document.getElementById('st-workspace-meta');if(meta)meta.textContent='创建于 '+stTeamDate(ws.created_at)+' · ID '+String(ws.id||'').slice(0,8);
  var hint=document.getElementById('st-workspace-permission-hint');if(hint)hint.textContent=manager?'你可以管理成员和邀请':'当前账号为只读成员';
  var save=document.getElementById('st-workspace-save');if(save)save.disabled=!manager;
  var inviteSection=document.getElementById('st-workspace-invite-section');if(inviteSection)inviteSection.style.display=manager?'':'none';
  var inviteHistory=document.getElementById('st-workspace-invites-section');if(inviteHistory)inviteHistory.style.display=manager?'':'none';
  var tbody=document.getElementById('st-workspace-members');
  if(tbody){
    if(!ctx.members||!ctx.members.length) tbody.innerHTML='<tr><td colspan="4" class="st-table-empty">暂无成员</td></tr>';
    else tbody.innerHTML=ctx.members.map(function(m){
      var p=m.profiles||{};var label=p.display_name||p.email||m.user_id||'未命名成员';
      var roleHtml=manager&&m.user_id!==jayUser.id?'<select class="st-member-select" onchange="stChangeMemberRole(\''+stTeamEsc(m.id)+'\',this.value)"><option value="admin" '+(m.role==='admin'?'selected':'')+'>管理员</option><option value="editor" '+(m.role==='editor'?'selected':'')+'>编辑者</option><option value="viewer" '+(m.role==='viewer'?'selected':'')+'>查看者</option></select>':'<span class="st-role-text">'+stTeamEsc(jayWorkspaceRoleLabel(m.role))+'</span>';
      var stateHtml=manager&&m.user_id!==jayUser.id?'<select class="st-member-select" onchange="stChangeMemberStatus(\''+stTeamEsc(m.id)+'\',this.value)"><option value="active" '+(m.status==='active'?'selected':'')+'>已加入</option><option value="suspended" '+(m.status==='suspended'?'selected':'')+'>已停用</option></select>':'<span class="st-status-text '+(m.status==='active'?'ok':'muted')+'">'+stTeamEsc(jayWorkspaceStatusLabel(m.status))+'</span>';
      return '<tr><td><div class="st-member-name">'+stTeamEsc(label)+'</div><small>'+stTeamEsc(p.email||m.user_id||'')+'</small></td><td>'+roleHtml+'</td><td>'+stateHtml+'</td><td>'+stTeamDate(m.joined_at)+'</td></tr>';
    }).join('');
  }
  var invites=document.getElementById('st-workspace-invites');
  if(invites){
    var rows=ctx.invites||[];
    invites.innerHTML=rows.length?rows.map(function(i){
      var action='-';
      if(i.status==='pending'&&manager)action='<button type="button" class="st-btn st-btn-outline st-btn-sm" onclick="stRevokeInvite(\''+stTeamEsc(i.id)+'\')">撤回</button>';
      else if(i.status==='pending'&&String(i.email||'').toLowerCase()===String(jayUser&&jayUser.email||'').toLowerCase())action='<button type="button" class="st-btn st-btn-primary st-btn-sm" onclick="stAcceptInvite(\''+stTeamEsc(i.id)+'\')">接受邀请</button>';
      return '<tr><td>'+stTeamEsc(i.email)+'</td><td>'+stTeamEsc(jayWorkspaceRoleLabel(i.role))+'</td><td><span class="st-status-text '+(i.status==='pending'?'pending':i.status==='accepted'?'ok':'muted')+'">'+stTeamEsc(jayWorkspaceStatusLabel(i.status))+'</span></td><td>'+stTeamDate(i.expires_at)+'</td><td>'+action+'</td></tr>';
    }).join(''):'<tr><td colspan="5" class="st-table-empty">暂无邀请记录</td></tr>';
  }
}
async function stInitTeam(){
  if(typeof jayLoadWorkspaceContext!=='function')return;
  stRenderTeam();
  try{await jayLoadWorkspaceContext();}catch(e){}
  stRenderTeam();
}
async function stSaveWorkspaceName(){
  var input=document.getElementById('st-workspace-name');if(!input)return;
  var button=document.getElementById('st-workspace-save');if(button){button.disabled=true;button.textContent='保存中…';}
  try{await jayUpdateWorkspaceName(input.value);stRenderTeam();stToast('工作区名称已更新');}
  catch(e){stToast(stTeamError(e));}
  finally{if(button){button.disabled=false;button.textContent='保存工作区';stRenderTeam();}}
}
async function stCreateInvite(){
  var email=document.getElementById('st-invite-email');var role=document.getElementById('st-invite-role');var button=document.getElementById('st-invite-submit');
  if(!email)return;if(button){button.disabled=true;button.textContent='创建中…';}
  try{await jayCreateWorkspaceInvite(email.value,role&&role.value);email.value='';stRenderTeam();stToast('邀请记录已创建；邮件尚未发送');}
  catch(e){stToast(stTeamError(e));}
  finally{if(button){button.disabled=false;button.textContent='创建邀请记录';}}
}
async function stRevokeInvite(id){
  if(!confirm('确定撤回这条邀请吗？'))return;
  try{await jayRevokeWorkspaceInvite(id);stRenderTeam();stToast('邀请已撤回');}catch(e){stToast(stTeamError(e));}
}
async function stAcceptInvite(id){
  try{await jayAcceptWorkspaceInvite(id);stRenderTeam();stToast('已加入工作区');}catch(e){stToast(stTeamError(e));}
}
async function stChangeMemberRole(id,role){
  try{await jayUpdateWorkspaceMember(id,role);stRenderTeam();stToast('成员角色已更新');}catch(e){stToast(stTeamError(e));stRenderTeam();}
}
async function stChangeMemberStatus(id,status){
  try{await jayUpdateWorkspaceMember(id,null,status);stRenderTeam();stToast('成员状态已更新');}catch(e){stToast(stTeamError(e));stRenderTeam();}
}
function adminSetText(id,value){var el=document.getElementById(id);if(el)el.textContent=value==null?'--':String(value)}
function adminRenderRows(rows,type){
  if(!rows||!rows.length)return '<div class="admin-empty">暂无记录</div>';
  return rows.map(function(row){
    if(type==='incident')return '<div class="admin-row"><strong>'+stTeamEsc(row.title||row.service||'系统事件')+'</strong><small>'+stTeamEsc((row.severity||'info')+' · '+(row.status||'-')+' · '+stTeamDate(row.started_at))+'</small></div>';
    return '<div class="admin-row"><strong>'+stTeamEsc((row.backup_type||'backup')+' · '+(row.status||'-'))+'</strong><small>'+stTeamEsc((row.location||'未记录位置')+' · '+stTeamDate(row.completed_at||row.started_at))+'</small></div>';
  }).join('');
}
async function adminLoad(){
  var note=document.getElementById('admin-access-note');var content=document.getElementById('admin-content');
  if(note){note.style.display='block';note.textContent='正在校验管理员权限…';}if(content)content.style.display='none';
  if(jayIsDemo){if(note)note.textContent='只读演示不加载管理数据。';return}
  try{
    var data=await jayLoadAdminSummary();var counts=data.counts||{};
    if(note)note.style.display='none';if(content)content.style.display='block';
    adminSetText('admin-users',counts.users);adminSetText('admin-subs',counts.subscriptions);adminSetText('admin-workspaces',counts.workspaces);adminSetText('admin-incidents-count',counts.open_incidents);adminSetText('admin-deliveries',counts.pending_deliveries);
    var incidents=document.getElementById('admin-incidents');if(incidents)incidents.innerHTML=adminRenderRows(data.incidents,'incident');
    var backups=document.getElementById('admin-backups');if(backups)backups.innerHTML=adminRenderRows(data.backups,'backup');
    var generated=document.getElementById('admin-generated');if(generated)generated.textContent='管理员角色：'+(data.role||'-')+' · 更新时间 '+(data.generated_at?new Date(data.generated_at).toLocaleString('zh-CN'):'-');
  }catch(error){
    if(note)note.textContent=error.message==='ADMIN_FORBIDDEN'?'当前账号不是平台管理员。':('管理后台不可用：'+(error.message||'请检查服务配置'));
  }
}
function stToast(msg){
  var t=document.querySelector('.toast');
  if(t){t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2500)}
}

/* ===================== JAY观海 · 板块定时刷新子系统 ===================== */
(function(){
  'use strict';
  var JAY_REFRESH_INTERVAL = 4*3600*1000;   // 与 GitHub Actions 的 4 小时数据周期一致
  var JAY_REFRESH_RETRIES  = 3;              // 单次抓取失败重试次数
  var JAY_BACKFILL_DELAY   = 5*60*1000;      // 抓取失败后 5 分钟内补齐

  // 五大板块独立配置
  var JAY_BOARD_DEFS = [
    { key:'countries', label:'国家市场',    stampId:'cn2-update-time' },
    { key:'platforms', label:'电商平台档案', stampId:'pf-data-info' },
    { key:'rules',     label:'平台规则',    stampId:'rl-data-info' },
    { key:'policies',  label:'政策动态',    stampId:'pl-data-info' },
    { key:'alerts',    label:'预警中心',    stampId:'al-data-info' }
  ];
  var JAY_REFRESH_STATE = {};
  JAY_BOARD_DEFS.forEach(function(d){ JAY_REFRESH_STATE[d.key] = { lastOk:null, lastRun:null, status:'pending', changed:0, source:'' }; });

  var jayRefreshStarted=false, JAY_REFRESH_TIMERS={}, JAY_BACKFILL_TIMERS={};
  var JAY_REFRESH_LOG = jayLoadRefreshLog();

  function jayLoadRefreshLog(){ try { return JSON.parse(localStorage.getItem('jay_refresh_log')||'[]'); } catch(e){ return []; } }
  function jaySaveRefreshLog(){ try { localStorage.setItem('jay_refresh_log', JSON.stringify(JAY_REFRESH_LOG.slice(-120))); } catch(e){} }
  function jayDataUrl(name){
    var base = document.querySelector('base') ? document.querySelector('base').href : location.pathname.replace(/[^/]*$/,'');
    return base + 'data/' + name;
  }
  function jayNowStr(){
    var d=new Date(); function p(n){ return String(n).padStart(2,'0'); }
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
  }
  // ---- 生产路径：用抓取到的数据替换内存并重渲染 ----
  function jayApplyBoard(key, data){
    try {
      if(key==='countries'){ countryFullData = data; if(typeof cn2CurrentKey!=='undefined' && countryFullData[cn2CurrentKey]) cn2Render(cn2CurrentKey); }
      else if(key==='platforms'){
        if(Array.isArray(data)){ platformsData=data.map(function(d){return [d.name||'',d.region||'',d.categories||'',d.gmv||'',d.fee||'',d.feeDesc||'',d.type||'',d.mau||'',d.updates||''];}); var _staticPfExt=pfExtData; pfExtData={}; Object.keys(_staticPfExt||{}).forEach(function(k){ pfExtData[k]=_staticPfExt[k]; }); data.forEach(function(d){ if(d.ext&&Object.keys(d.ext).length){ pfExtData[d.name]=Object.assign({}, pfExtData[d.name]||{}, d.ext); } }); fillSelect('#pf-f-region',[...new Set(platformsData.map(function(p){return p[1];}))].sort()); fillSelect('#pf-f-type',[...new Set(platformsData.map(function(p){return p[6];}))].sort()); }
        if(typeof renderPlatforms==='function') renderPlatforms();
      }
      else if(key==='rules'){ rulesJsonData=data; if(typeof rlInitFromJson==='function') rlInitFromJson(); }
      else if(key==='policies'){ policiesJsonData=data; if(typeof plInitFromJson==='function') plInitFromJson(); }
      else if(key==='alerts'){ if(Array.isArray(data)){ alertsFull.length=0; data.forEach(function(x){ alertsFull.push(x); }); } if(typeof refreshDynamicAlerts==='function') refreshDynamicAlerts(); if(typeof renderAlerts==='function') renderAlerts(); }
    } catch(e){ console.warn('[JAY观海] apply board failed for '+key+':', e); }
  }

  // 计算抓取数据与当前内存的差异条数（生产路径用）
  function jayDiffCount(key, fresh){
    try {
      if(key==='countries'){ var cur=countryFullData||{}; var n=0; for(var k in fresh){ if(JSON.stringify(cur[k])!==JSON.stringify(fresh[k])) n++; } return n; }
      if(key==='platforms'){ return (JSON.stringify(fresh)!==JSON.stringify(platformsData))?((fresh||[]).length||1):0; }
      if(key==='rules'){ var ci=(rulesJsonData&&rulesJsonData.items)||[]; var fi=(fresh&&fresh.items)||[]; return fi.length?(JSON.stringify(ci)!==JSON.stringify(fi)?fi.length:0):0; }
      if(key==='policies'){ var ci2=(policiesJsonData&&policiesJsonData.items)||[]; var fi2=(fresh&&fresh.items)||[]; return fi2.length?(JSON.stringify(ci2)!==JSON.stringify(fi2)?fi2.length:0):0; }
      if(key==='alerts'){ return (JSON.stringify(fresh)!==JSON.stringify(alertsFull))?(fresh||[]).length:0; }
    } catch(e){} return 0;
  }

  function jaySetStamp(def, txt){ var el=document.getElementById(def.stampId); if(el) el.innerHTML=txt; }
  function jayLog(entry){ entry.ts=jayNowStr(); JAY_REFRESH_LOG.push(entry); if(JAY_REFRESH_LOG.length>120) JAY_REFRESH_LOG=JAY_REFRESH_LOG.slice(-120); jaySaveRefreshLog(); jayRenderRefreshLog(); }

  // ---- 单次刷新（含重试） ----
  async function jayRefreshBoard(def){
    var st=JAY_REFRESH_STATE[def.key];
    st.lastRun=jayNowStr(); st.status='running';
    jaySetStamp(def, '⏳ 正在抓取 '+def.label+' 最新数据...');
    jayRenderRefreshStatus();

    var fetched=null, lastErr=null, ok=false, attempt=0;
    while(attempt<JAY_REFRESH_RETRIES && !ok){
      attempt++;
      try { fetched = await jayFetchMarketData(def.key, jayDataUrl(def.key+'.json')); ok=true; }
      catch(e){ lastErr=e; if(attempt<JAY_REFRESH_RETRIES) await sleep(1000*attempt); }
    }

    var changedCount=0;
    var source=(JAY_DATA_META[def.key]&&JAY_DATA_META[def.key].source)||'local';
    if(ok && fetched){
      changedCount = jayDiffCount(def.key, fetched);
      jayApplyBoard(def.key, fetched);
    } else {
      st.status='failed'; def.needsBackfill=true;
      jaySetStamp(def, '⚠️ '+def.label+' 抓取失败，下个周期补齐');
      jayLog({ key:def.key, label:def.label, status:'fail', changed:0, source:'', error:String((lastErr&&lastErr.message)||lastErr) });
      jayScheduleBackfill(def);
      jayRenderRefreshStatus();
      return;
    }

    st.lastOk=jayNowStr(); st.status='ok'; st.changed=changedCount; st.source=source;
    var srcTxt = source==='supabase' ? 'Supabase 实时库' : '仓库 JSON 兜底';
    jaySetStamp(def, '📡 数据读取于 '+jayNowStr()+' | 来源: '+srcTxt+' | 变更 '+changedCount+' 条');
    jayLog({ key:def.key, label:def.label, status:'ok', changed:changedCount, source:source });
    if(typeof jayUpdateDataStamp==='function') jayUpdateDataStamp();
    jayRenderRefreshStatus();
  }

  function jayScheduleBackfill(def){
    if(JAY_BACKFILL_TIMERS[def.key]) return;
    JAY_BACKFILL_TIMERS[def.key]=setTimeout(function(){
      delete JAY_BACKFILL_TIMERS[def.key];
      jayRefreshBoard(def); // 重试；成功则清除 needsBackfill，否则下个 2h 周期继续补齐
    }, JAY_BACKFILL_DELAY);
  }

  // ---- 调度器：每板块独立 2 小时间隔，错峰启动 ----
  function jayStartRefreshScheduler(){
    if(jayRefreshStarted) return; jayRefreshStarted=true;
    jayBuildRefreshUI();
    JAY_BOARD_DEFS.forEach(function(def, i){
      var firstDelay = 2500 + i*2200; // 2.5s~12.5s 错峰，避免同时请求
      setTimeout(function(){ jayRefreshBoard(def); }, firstDelay);
      JAY_REFRESH_TIMERS[def.key] = setInterval(function(){ jayRefreshBoard(def); }, JAY_REFRESH_INTERVAL);
    });
    setInterval(jayRenderRefreshStatus, 30000); // 状态/倒计时刷新
  }

  // ---- UI：侧边栏状态组件 + 平台/预警页时间戳 + 日志弹窗（全部动态注入，不改动原 HTML 结构） ----
  function jayBuildRefreshUI(){
    if(!document.getElementById('jay-refresh-style')){
      var s=document.createElement('style'); s.id='jay-refresh-style';
      s.textContent='.jay-refresh-widget{margin-top:auto;padding:10px 14px;border-top:1px solid rgba(255,255,255,.12);font-size:12px;color:#cfe3f5}.jay-refresh-widget .jrw-head{display:flex;justify-content:space-between;align-items:center;color:#fff;font-weight:600;margin-bottom:6px}.jay-refresh-widget .jrw-head button{background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px}.jay-refresh-widget .jrw-row{display:flex;align-items:center;gap:6px;padding:2px 0;color:#dce9f5}.jrw-dot{width:8px;height:8px;border-radius:50%;background:#8aa;flex:0 0 auto}.jrw-dot.ok{background:#39d98a}.jrw-dot.fail{background:#ff6b6b}.jrw-dot.run{background:#4a9eff;animation:jrwPulse 1s infinite}.jrw-dot.pend{background:#9aa}.jrw-name{flex:1}.jrw-last{color:#9fb6c9;font-size:11px}@keyframes jrwPulse{0%,100%{opacity:1}50%{opacity:.3}}.jrw-actions{margin-top:8px}.jrw-actions button{width:100%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:6px;padding:5px;cursor:pointer;font-size:12px}.jay-modal-overlay{position:fixed;inset:0;background:rgba(15,30,50,.55);display:flex;align-items:center;justify-content:center;z-index:9999}.jay-modal{background:#fff;border-radius:12px;width:min(680px,92vw);max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)}.jay-modal-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #eee;font-size:15px;color:#1e3a5f}.jay-modal-head button{background:none;border:none;font-size:18px;cursor:pointer;color:#888}.jay-modal-body{padding:8px 14px;overflow:auto}.jrw-log{width:100%;border-collapse:collapse;font-size:12px}.jrw-log th{text-align:left;padding:8px 6px;border-bottom:2px solid #e3eefb;color:#1e3a5f}.jrw-log td{padding:7px 6px;border-bottom:1px solid #f0f0f0;color:#334}.jrw-log tr.ok td:first-child{border-left:3px solid #39d98a;padding-left:6px}.jrw-log tr.fail td:first-child{border-left:3px solid #ff6b6b;padding-left:6px}.jrw-log .err{color:#d33;font-size:11px}';
      document.head.appendChild(s);
    }
    var sb=document.querySelector('.sidebar');
    if(sb && !document.getElementById('jay-refresh-widget')){
      var w=document.createElement('div'); w.id='jay-refresh-widget'; w.className='jay-refresh-widget';
      w.innerHTML='<div class="jrw-head"><span>🔄 数据定时刷新</span><button id="jay-refresh-log-btn">更新日志</button></div>'
        +'<div class="jrw-body" id="jay-refresh-status"></div>'
        +'<div class="jrw-actions"><button id="jay-refresh-now">立即刷新全部板块</button></div>';
      sb.appendChild(w);
      w.querySelector('#jay-refresh-log-btn').onclick=jayOpenRefreshLog;
      w.querySelector('#jay-refresh-now').onclick=function(){ JAY_BOARD_DEFS.forEach(function(d){ jayRefreshBoard(d); }); };
    }
    var pf=document.querySelector('#platforms .pf-top-bar'); if(pf && !document.getElementById('pf-data-info')){ var d1=document.createElement('div'); d1.className='pf-data-info'; d1.id='pf-data-info'; d1.style.cssText='font-size:.78rem;color:#888;padding:4px 0 8px'; pf.appendChild(d1); }
    var al=document.querySelector('#alerts .al-toolbar'); if(al && !document.getElementById('al-data-info')){ var d2=document.createElement('div'); d2.id='al-data-info'; d2.style.cssText='font-size:.78rem;color:#888;padding:4px 0 8px'; if(al.nextSibling) al.parentNode.insertBefore(d2, al.nextSibling); else al.parentNode.appendChild(d2); }
    if(!document.getElementById('jay-refresh-log-modal')){
      var m=document.createElement('div'); m.id='jay-refresh-log-modal'; m.className='jay-modal-overlay'; m.style.display='none';
      m.innerHTML='<div class="jay-modal"><div class="jay-modal-head"><b>数据更新日志</b><button id="jay-refresh-log-close">✕</button></div><div class="jay-modal-body" id="jay-refresh-log-body"></div></div>';
      document.body.appendChild(m);
      m.querySelector('#jay-refresh-log-close').onclick=function(){ m.style.display='none'; };
      m.onclick=function(e){ if(e.target===m) m.style.display='none'; };
    }
    jayRenderRefreshStatus(); jayRenderRefreshLog();
  }

  function jayRenderRefreshStatus(){
    var el=document.getElementById('jay-refresh-status'); if(!el) return;
    var html='';
    JAY_BOARD_DEFS.forEach(function(def){
      var st=JAY_REFRESH_STATE[def.key];
      var dot = st.status==='ok'?'jrw-dot ok': st.status==='failed'?'jrw-dot fail': st.status==='running'?'jrw-dot run':'jrw-dot pend';
      var last = st.lastOk? st.lastOk : '尚未刷新';
      html+='<div class="jrw-row"><span class="'+dot+'"></span><span class="jrw-name">'+def.label+'</span><span class="jrw-last">'+last+'</span></div>';
    });
    el.innerHTML=html;
  }
  function jayRenderRefreshLog(){
    var b=document.getElementById('jay-refresh-log-body'); if(!b) return;
    if(!JAY_REFRESH_LOG.length){ b.innerHTML='<p style="color:#888;font-size:12px;padding:12px">暂无更新记录。</p>'; return; }
    var html='<table class="jrw-log"><tr><th>板块</th><th>时间</th><th>状态</th><th>变更条数</th><th>来源</th></tr>';
    JAY_REFRESH_LOG.slice().reverse().forEach(function(e){
      var stc=e.status==='ok'?'ok':'fail';
      html+='<tr class="'+stc+'"><td>'+e.label+'</td><td>'+e.ts+'</td><td>'+(e.status==='ok'?'成功':'失败')+(e.error?'<br><span class="err">'+e.error+'</span>':'')+'</td><td>'+(e.changed!=null?e.changed:'-')+'</td><td>'+(e.source||'-')+'</td></tr>';
    });
    html+='</table>';
    b.innerHTML=html;
  }
  function jayOpenRefreshLog(){ var m=document.getElementById('jay-refresh-log-modal'); if(m){ jayRenderRefreshLog(); m.style.display='flex'; } }

  window.jayRefreshBoard=jayRefreshBoard; window.jayStartRefreshScheduler=jayStartRefreshScheduler;

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', jayStartRefreshScheduler); }
  else { jayStartRefreshScheduler(); }
})();
