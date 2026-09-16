// === 页面切换 ===

function jayConfiguredMarketCodes(){
  var scope=window.JAY_MARKET_SCOPE||{};
  return Array.isArray(scope.marketCodes)&&scope.marketCodes.length?scope.marketCodes.slice():['US'];
}
function jayConfiguredMarketNames(){
  var scope=window.JAY_MARKET_SCOPE||{};
  if(Array.isArray(scope.markets)&&scope.markets.length)return scope.markets.map(function(m){return m.name||m.label||m.code;});
  if(scope.country&&scope.country.name)return [scope.country.name];
  return ['美国'];
}
function jayConfiguredMarketName(){ return jayConfiguredMarketNames()[0]||'美国'; }
function jayConfiguredPlatformNames(){
  return window.JAY_MARKET_SCOPE && Array.isArray(window.JAY_MARKET_SCOPE.platformNames)
    ? window.JAY_MARKET_SCOPE.platformNames.slice() : ['Amazon','TikTok Shop','AliExpress','eBay'];
}
function jayConfiguredPlatformsText(){ return jayConfiguredPlatformNames().join('、'); }
function jayConfiguredScopeText(){ return jayConfiguredMarketNames().join('、') + '市场 · ' + jayConfiguredPlatformsText(); }
function jayConfiguredCategoryCodes(){
  var scope=window.JAY_MARKET_SCOPE||{};
  var values=Array.isArray(scope.selectedCategoryCodes)?scope.selectedCategoryCodes:(Array.isArray(scope.categoryCodes)?scope.categoryCodes:[]);
  if(!values.length && window.JAY_MARKET_SCOPE_API && window.JAY_MARKET_SCOPE_API.normalizeCategoryCodes && rpV2Answers && rpV2Answers.category){
    values=window.JAY_MARKET_SCOPE_API.normalizeCategoryCodes(rpV2Answers.category);
  }
  return values.slice();
}
function jayConfiguredCategoryNames(){
  var api=window.JAY_MARKET_SCOPE_API;
  var codes=jayConfiguredCategoryCodes();
  if(api && api.getCategoryProfile){
    return codes.map(function(code){var profile=api.getCategoryProfile(code);return profile?(profile.name||profile.code):code;});
  }
  return codes;
}
function jayConfiguredReportTemplate(){
  var api=window.JAY_MARKET_SCOPE_API;
  if(!api || !api.getReportTemplates) return null;
  var categories=jayConfiguredCategoryCodes();
  var candidates=api.getReportTemplates({categoryCodes:categories});
  var selected=rpV2SelectedTpl;
  return (selected && api.getReportTemplate && api.getReportTemplate(selected,{categoryCodes:categories}))
    || candidates.find(function(template){return template.code==='market-research';})
    || candidates[0] || null;
}
function jayConfiguredMarketCode(){
  var codes=jayConfiguredMarketCodes();
  return codes[0]||'US';
}
function jayConfiguredScopeInstruction(){
  return '只能分析'+jayConfiguredMarketNames().join('、')+'市场，平台只能包含 '+jayConfiguredPlatformsText()+'。';
}
function jayScopeHasRetiredText(value){
  var raw=String(value||'');
  // Future markets must not be rejected merely because their names appeared
  // in the old global demo data.
  jayConfiguredMarketNames().concat(jayConfiguredPlatformNames()).forEach(function(label){
    if(label) raw=raw.replace(new RegExp(String(label).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),'');
  });
  return /(全球|global|全域|跨区域|东南亚|北美|欧洲|中东|拉美|日韩|南亚|非洲|澳洲|独联体|印尼|印度尼西亚|越南|泰国|马来西亚|菲律宾|新加坡|日本|韩国|巴西|墨西哥|英国|法国|沙特|阿联酋|Shopee|Lazada|Temu|Walmart|SHEIN|Noon|Mercado ?Libre|Bukalapak)/i.test(raw);
}
function wlIsConfiguredScopeRow(row){
  row = row || {};
  var text = [row.item_id,row.item_name,row.note,row.market,row.region,row.platform,row.platforms].filter(Boolean).join(' ');
  if(jayScopeHasRetiredText(text)) return false;
  var type = String(row.item_type || row.type || '').toLowerCase();
  var lower = text.toLowerCase();
  var isConfiguredMarket = jayConfiguredMarketNames().some(function(name){ return text.toLowerCase().indexOf(String(name).toLowerCase()) >= 0; })
    || jayConfiguredMarketCodes().some(function(code){ return new RegExp('(^|[^a-z])'+String(code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z]|$)','i').test(text); });
  var allowedPlatforms = jayConfiguredPlatformNames();
  var hasAllowedPlatform = allowedPlatforms.some(function(name){ return lower.indexOf(name.toLowerCase()) >= 0; });
  if(type === 'country' && !isConfiguredMarket) return false;
  if(type === 'platform' && !hasAllowedPlatform) return false;
  return isConfiguredMarket || hasAllowedPlatform;
}
function rpMaterialInConfiguredScope(material){
  material = material || {};
  var text = [material.title,material.source,material.summary,material.text].filter(Boolean).join(' ');
  if(jayScopeHasRetiredText(text)) return false;
  var type = String(material.type || '').toLowerCase();
  if(type === 'country' && !jayConfiguredMarketNames().some(function(name){ return text.toLowerCase().indexOf(String(name).toLowerCase()) >= 0; })
    && !jayConfiguredMarketCodes().some(function(code){ return new RegExp('(^|[^a-z])'+String(code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z]|$)','i').test(text); })) return false;
  if(type === 'platform' && !jayConfiguredPlatformNames().some(function(name){ return text.toLowerCase().indexOf(name.toLowerCase()) >= 0; })) return false;
  return true;
}
function rpReportInConfiguredScope(report){
  report = report || {};
  var reportMarkets=report.market_codes||report.marketCodes||report.markets||report.market;
  if(reportMarkets){
    var allowed=jayConfiguredMarketCodes();
    var values=Array.isArray(reportMarkets)?reportMarkets:[reportMarkets];
    return values.some(function(value){ return allowed.indexOf(String(value).toUpperCase())>=0
      || jayConfiguredMarketNames().some(function(name){ return String(value).toLowerCase()===String(name).toLowerCase(); }); });
  }
  return !jayScopeHasRetiredText([report.name,report.text].filter(Boolean).join(' '));
}

function rpAddCurrentToPool() {
  var activePage = document.querySelector('.page.active');
  if (!activePage) { toast('请先选择数据'); return; }
  var pageId = activePage.id;
  var type = '', title = '', source = '', summary = '', options = {};

  if (pageId === 'overview') {
    type = 'alert'; title = jayConfiguredMarketName() + '市场总览数据'; source = jayConfiguredMarketName() + '市场概览';
    summary = '包含' + jayConfiguredScopeText() + '的机会评分、热点趋势、预警汇总等核心数据';
  } else if (pageId === 'watchlist') {
    type = 'alert'; title = '我的看板数据'; source = 'Watchlist';
    summary = '包含重点关注的店铺、商品、政策等看板数据';
  } else if (pageId === 'countries') {
    type = 'country'; title = jayConfiguredMarketName() + '市场档案'; source = jayConfiguredMarketName() + '市场档案';
    summary = '包含' + jayConfiguredMarketNames().join('、') + '市场规模、消费习惯、电商渗透率、政策环境等';
  } else if (pageId === 'platforms') {
    type = 'platform'; title = jayConfiguredMarketName() + '市场平台档案'; source = jayConfiguredMarketName() + '市场平台档案';
    summary = '仅包含 '+jayConfiguredPlatformsText()+' 的佣金政策、物流要求、流量分配、入驻条件';
  } else if (pageId === 'products') {
    var productRecords=typeof prScopedProducts==='function'?prScopedProducts():[];
    if(!productRecords.length){toast('当前范围暂无商品数据，不能加入报告素材');return;}
    type = 'product'; title = '爆款雷达数据'; source = 'Product Radar';
    summary = '包含跨平台热销商品、销量趋势、价格区间、竞品分析';
    options={snapshot:{records:productRecords.map(function(row){return typeof prProductSnapshot==='function'?prProductSnapshot(row):{row:Array.prototype.slice.call(row)};}),source:source,market:jayConfiguredMarketName()},snapshot_type:'product_collection',snapshot_market:jayConfiguredMarketName()};
  } else if (pageId === 'shops') {
    var shopRecords=typeof prScopedShops==='function'?prScopedShops():[];
    if(!shopRecords.length){toast('当前范围暂无店铺数据，不能加入报告素材');return;}
    type = 'shop'; title = '店铺追踪数据'; source = 'Shop Tracker';
    summary = '包含标杆店铺运营数据、上新频率、营销策略、用户评价';
    options={snapshot:{records:shopRecords.map(function(row){return typeof prShopSnapshot==='function'?prShopSnapshot(row):{row:Array.prototype.slice.call(row)};}),source:source,market:jayConfiguredMarketName()},snapshot_type:'shop_collection',snapshot_market:jayConfiguredMarketName()};
  } else if (pageId === 'content') {
    var contentRecords=typeof ctScopedData==='function'?ctScopedData():[];
    if(!contentRecords.length){toast('当前范围暂无已核验内容数据，不能加入报告素材');return;}
    type = 'content'; title = '热门内容数据'; source = 'Content Tracker';
    summary = '包含短视频/直播热门内容、爆款脚本、达人合作机会';
    options={snapshot:{records:contentRecords.map(function(row){return typeof ctContentSnapshot==='function'?ctContentSnapshot(row):{row:Array.prototype.slice.call(row)};}),source:source,market:jayConfiguredMarketName()},snapshot_type:'content_collection',snapshot_market:jayConfiguredMarketName()};
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
  rpAddMaterial(type, title, source, summary, options);
}

// ===== Report Material Pool (Configured US Scope) =====

// ===== 报告生成中心 v2 - 完整重建 =====
const RP_POOL_KEY = 'jay_report_pool';
const RP_REPORTS_KEY = 'jay_reports_v2';

function rpV2IsReadOnlyWorkspace() {
  return typeof jayCanUseUserDb === 'function' && jayCanUseUserDb()
    && typeof jayWorkspaceCanEdit === 'function'
    && typeof jayWorkspaceContext !== 'undefined'
    && jayWorkspaceContext && jayWorkspaceContext.available === true
    && !jayWorkspaceCanEdit();
}

// --- Pool Management ---
function rpGetPool(){
  var api=window.JAY_MARKET_SCOPE_API;
  return Array.isArray(jayReportPoolCache)?jayReportPoolCache.filter(function(material){
    if(!rpMaterialInConfiguredScope(material)) return false;
    // Report inputs must carry the same provenance envelope as page data.
    // Older saved materials without an envelope remain hidden until re-added.
    return !api || typeof api.isFormalRecord!=='function' || api.isFormalRecord(material,{requireScope:false,domain:'derived'});
  }):[];
}
function rpSavePool(pool){
  if(!jayCanUseUserDb()){toast('登录后可保存并跨设备同步报告素材');return false}
  if(rpV2IsReadOnlyWorkspace()){toast('当前工作区为只读权限');return false}
  jayReportPoolCache=Array.isArray(pool)?pool.slice():[];
  jayScheduleReportPoolSync(jayReportPoolCache);
  rpV2RefreshPoolUI();
  return true;
}
function rpAddMaterial(type,title,source,summary,options){
  options=options||{};
  if(!jayCanUseUserDb()){toast('只读演示不保存素材，请登录后使用');return}
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能读取工作区素材，不能添加素材');return}
  if(!rpMaterialInConfiguredScope({type:type,title:title,source:source,summary:summary})){
    toast('该素材不属于当前市场范围，未加入报告');
    return;
  }
  var pool=rpGetPool();
  var id=Date.now()+'_'+Math.random().toString(36).substr(2,5);
  var snapshot=options.snapshot_data||options.snapshot||null;
  var snapshotAt=options.snapshot_at||(snapshot&&snapshot.provenance&&(snapshot.provenance.snapshot_at||snapshot.provenance.collected_at))||new Date().toISOString();
  var provenance=snapshot&&snapshot.provenance&&typeof snapshot.provenance==='object'?snapshot.provenance:null;
  var sourceKind=provenance&&provenance.source_kind||'uploaded';
  var sourceType=provenance&&provenance.source_type||'user_upload';
  var sourceRecordId=provenance&&provenance.source_record_id||id;
  var verificationStatus=sourceKind==='official'||sourceKind==='traceable'?'verified':'uploaded';
  pool.push({id:id,type:type,title:title,source:source,summary:summary,addedAt:new Date().toISOString(),selected:true,
    source_kind:sourceKind,source_type:sourceType,source_record_id:sourceRecordId,verification_status:verificationStatus,
    source_category:provenance&&provenance.source_category||'',evidence_hash:provenance&&provenance.evidence_hash||'',
    history_url:provenance&&provenance.history_url||'',verification_notes:sourceKind==='uploaded'?'由当前账号保存的素材快照生成；不自动等同于官方核验来源':'来自已核验的系统历史投影',
    snapshot_type:options.snapshot_type||null,snapshot_data:snapshot,snapshot_source:options.snapshot_source||(snapshot&&snapshot.source)||source,
    snapshot_at:snapshotAt,snapshot_market:options.snapshot_market||(snapshot&&snapshot.market)||'',snapshot_platform:options.snapshot_platform||(snapshot&&snapshot.platform)||'',
    snapshot_category:options.snapshot_category||(snapshot&&snapshot.category)||''});
  if(rpSavePool(pool))toast('已加入报告素材池（报告生成中心可查看 · 共 '+pool.length+' 条）')
}
function rpRemoveMaterial(id){rpSavePool(rpGetPool().filter(function(m){return m.id!==id}))}
function rpV2SelectAll(){var pool=rpGetPool();pool.forEach(function(m){m.selected=true});rpSavePool(pool)}
function rpV2DeselectAll(){var pool=rpGetPool();pool.forEach(function(m){m.selected=false});rpSavePool(pool)}
function rpV2ToggleSelect(id){var pool=rpGetPool();pool.forEach(function(m){if(m.id===id)m.selected=!m.selected});rpSavePool(pool)}
function rpV2ClearPool(){if(!confirm('确定清空全部素材？此操作不可恢复。'))return;if(rpSavePool([]))toast('素材池已清空')}

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
      var sourceLabel=m.source_kind==='official'?'官方':m.source_kind==='traceable'?'第三方可追溯':m.source_kind==='uploaded'?'工作区上传':(m.source_kind||'未知来源');
      html+='<span class="rp-v2-pool-source">'+escapeHtml(sourceLabel)+'</span>';
      html+='<span>'+escapeHtml(m.source)+'</span>';
      if(m.snapshot_type)html+='<span>快照 '+escapeHtml(m.snapshot_source||m.source||'当前记录')+'</span>';
      html+='<span>'+escapeHtml(m.snapshot_at?jayFmtTime(m.snapshot_at):dateStr)+'</span></div></div>';
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
var rpV2RevisionBase=null;
var rpV2TplNames={'market-research':'市场调研报告','product-research':'单品赛道选品调研报告','competitor-analysis':'竞品对标分析报告','market-entry':'单国出海市场可行性报告','content-marketing':'内容营销投放分析报告','custom':'自定义模板'};

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
    var topicEl=document.getElementById('rp-v2-topic');
    var context=rpV2ReportContext(topicEl&&topicEl.value.trim());
    var plan=window.rpBuildReportPlan?window.rpBuildReportPlan(context,rpV2SelectedTpl,rpV2SelectedTpl):null;
    var facts=window.rpCollectReportFacts?window.rpCollectReportFacts(context,sel):{scope:context,records:{},sources:[]};
    var check=window.rpCheckReportData?window.rpCheckReportData(plan,facts):{ok:true,missing:[],warnings:[],recordCount:0};
    var financial=window.JAY_REPORT_ENGINE?window.JAY_REPORT_ENGINE.financialFromFacts(facts):null;
    rpV2RenderDataCheck(plan,check,financial);
    rpV2RenderQualityGate(typeof jayCurrentReportQualityGate==='function'?jayCurrentReportQualityGate():null);
  }
}

// --- Report Generation ---
var rpGenInterval=null;  // P3-4: 模块级变量，防止重复点击创建多个定时器
var rpLastReportModel = null;
var rpLastReportRecord = null;
var rpLastSaveState = 'none';
var rpSaveBusy = false;
var rpActiveReportRun = null;
var rpAIGatewayRequests = [];
var rpExportBusy = {pdf:false,docx:false,md:false};
var rpActiveCitationIndex = {};
function rpV2SetExportBusy(format,busy){
  rpExportBusy[format]=!!busy;
  document.querySelectorAll('.rp-v2-preview-toolbar-right button').forEach(function(button){
    var action=button.getAttribute('onclick')||'';
    if(action.indexOf("rpV2Export('"+format+"')")>=0)button.disabled=!!busy;
  });
}
function rpV2Fingerprint(value){
  var input=String(value||''),hash=2166136261;
  for(var i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function rpV2GenerationIdentity(context,topic,pool){
  var materialIds=(pool||[]).map(function(item){return item.id||item.source_record_id||item.title||'';}).sort();
  var bucket=Math.floor(Date.now()/60000);
  var raw=[jayUser&&jayUser.id||'anonymous',rpV2SelectedTpl||'market-research',(context.marketCodes||[]).join(','),(context.platformKeys||[]).join(','),(context.categoryCodes||[]).join(','),topic||'',materialIds.join(','),bucket].join('|');
  var digest=rpV2Fingerprint(raw);
  return {clientReportId:'report_'+digest,idempotencyKey:'report-generation:'+digest};
}
function rpV2SetSaveState(state, message){
  rpLastSaveState=state;
  var badge=document.getElementById('rp-v2-save-status');
  if(!badge)return;
  var labels={saving:'云端保存中',saved:'已保存到云端',failed:'仅本地暂存 · 云端保存失败',blocked:'未保存草稿 · 质量门禁阻断',pending:'等待云端保存'};
  badge.textContent=message||labels[state]||'';
  badge.className='rp-v2-save-status '+(state==='saved'?'is-saved':(state==='failed'?'is-failed':(state==='blocked'?'is-blocked':'is-saving')));
  if(state!=='failed')badge.removeAttribute('title');
}
function rpV2SaveErrorDetails(error){
  var details=error&&error.details&&typeof error.details==='object'?error.details:{};
  var validation=details.validation&&typeof details.validation==='object'?details.validation:{};
  var reasons=Array.isArray(validation.reasons)?validation.reasons.map(function(reason){return String(reason&&reason.code||'').trim();}).filter(Boolean):[];
  return {
    code:String(error&&error.code||details.error||'REPORT_SAVE_FAILED'),
    status:Number(error&&error.status||0),
    requestId:String(error&&error.requestId||details.request_id||''),
    reasonCodes:Array.from(new Set(reasons))
  };
}
function rpV2SetToolbarBusy(busy){
  var tb=document.querySelector('.rp-v2-preview-toolbar-right');
  if(!tb)return;
  tb.querySelectorAll('button').forEach(function(b){ b.disabled=busy; });
}
function rpV2RenderDataCheck(plan, check, financial){
  var el=document.getElementById('rp-v2-data-check'); if(!el)return;
  var missing=check&&Array.isArray(check.missing)?check.missing:[];
  var warnings=check&&Array.isArray(check.warnings)?check.warnings.slice():[];
  var matrix=check&&check.coverageMatrix;
  el.className='rp-v2-data-check '+(missing.length?'is-blocked':'is-ready');
  var coverage=matrix&&matrix.totalCells?('；范围覆盖 '+matrix.coveredCells+'/'+matrix.totalCells+' 格（'+matrix.coveragePercent+'%）'):'';
  var html='<strong>'+(missing.length?'生成前检查未通过':'生成前检查已通过')+'</strong><span>当前范围 '+(check.recordCount||0)+' 条可引用记录'+coverage+'</span>';
  if(financial&&financial.status==='incomplete')warnings.push({reason:'财务字段缺口：'+financial.missing.join('、')});
  if(missing.length){
    html+='<ul>'+missing.slice(0,12).map(function(item){return '<li>'+escapeHtml(item.label||item.domain)+'：'+escapeHtml(item.reason||'待补充')+'</li>';}).join('')+'</ul>';
    if(missing.length>12)html+='<span>另有 '+(missing.length-12)+' 个范围格待补充，请缩小市场、平台或品类范围后重试。</span>';
  }
  else if(warnings.length)html+='<ul>'+warnings.slice(0,4).map(function(item){return '<li>'+escapeHtml(item.label||item.domain||'提示')+'：'+escapeHtml(item.reason||'请复核')+'</li>';}).join('')+'</ul>';
  el.innerHTML=html;
}
function rpV2RenderQualityGate(gate){
  var el=document.getElementById('rp-v2-quality-gate');if(!el)return;
  gate=gate&&typeof gate==='object'?gate:{ok:false,status:'failed',reasons:[{message:'全局质量报告尚未加载'}],blockedDatasets:[],unavailableDatasets:[]};
  el.replaceChildren();
  el.className='rp-v2-quality-gate '+(gate.ok?'is-ready':'is-blocked');
  var heading=document.createElement('strong');
  heading.textContent=gate.ok?'全局质量门禁已通过':'全局质量门禁已阻断：仅可生成未保存草稿';
  el.appendChild(heading);
  var detail=document.createElement('span');
  var unavailable=(gate.unavailableDatasets||[]).map(function(item){return item.label||item.key;});
  detail.textContent=gate.ok
    ?('质量状态：'+String(gate.status||'unknown')+(unavailable.length?'；尚未接入：'+unavailable.join('、'):''))
    :'正式云端保存及 PDF/DOCX 导出不可用，请先刷新并通过数据质量校验。';
  el.appendChild(detail);
  if(!gate.ok){
    var messages=(gate.reasons||[]).map(function(item){return item.message||item.code;});
    (gate.blockedDatasets||[]).forEach(function(item){messages.push((item.label||item.key)+'：'+(item.status||'异常'));});
    unavailable.forEach(function(label){messages.push(label+'：尚未接入');});
    messages=messages.filter(function(value,index,rows){return value&&rows.indexOf(value)===index;}).slice(0,6);
    if(messages.length){var list=document.createElement('ul');messages.forEach(function(message){var item=document.createElement('li');item.textContent=message;list.appendChild(item);});el.appendChild(list);}
  }
}
function rpV2RenderContentQuality(assessment){
  var el=document.getElementById('rp-v2-content-quality');if(!el)return;
  el.replaceChildren();
  if(!assessment||typeof assessment!=='object'){el.style.display='none';return;}
  el.style.display='block';
  el.className='rp-v2-content-quality '+(assessment.ok?'is-ready':'is-blocked');
  var title=document.createElement('strong');
  title.textContent='内容质量评审：'+(assessment.ok?'通过':'需人工复核');
  el.appendChild(title);
  var dims=assessment.dimensions||{};
  var detail=document.createElement('span');
  detail.textContent='综合 '+(assessment.overall==null?'--':assessment.overall)+' 分 · 准确性 '+(dims.accuracy==null?'--':dims.accuracy)+' · 完整性 '+(dims.completeness==null?'--':dims.completeness)+' · 可执行性 '+(dims.executability==null?'--':dims.executability)+' · 来源覆盖 '+(dims.sourceCoverage==null?'--':dims.sourceCoverage)+'%';
  el.appendChild(detail);
  var reasons=Array.isArray(assessment.reasons)?assessment.reasons.filter(Boolean).slice(0,4):[];
  if(reasons.length){var list=document.createElement('ul');reasons.forEach(function(reason){var item=document.createElement('li');item.textContent=reason;list.appendChild(item);});el.appendChild(list);}
}
function rpV2ReportContext(topic){
  var active=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveContext?window.JAY_MARKET_SCOPE_API.getActiveContext():{};
  var categories=Array.isArray(active.categoryCodes)?active.categoryCodes.slice():[];
  var scopeApi=window.JAY_MARKET_SCOPE_API;
  if(rpV2Answers&&scopeApi&&scopeApi.normalizeCategoryCodes){
    var answeredCategories=scopeApi.normalizeCategoryCodes(rpV2Answers.category||'').filter(function(code){
      return !scopeApi.getCategoryProfile||!!scopeApi.getCategoryProfile(code);
    });
    if(answeredCategories.length)categories=answeredCategories;
  }
  return Object.assign({},active,{categoryCodes:categories,templateId:rpV2SelectedTpl||'market-research',purpose:rpV2SelectedTpl||'market-research',topic:topic||''});
}
async function rpV2Generate(){
  if(rpGenInterval || rpSaveBusy){if(rpSaveBusy)toast('上一份报告仍在保存中，请稍候');return;}
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能生成或保存报告');return;}
  var topicEl=document.getElementById('rp-v2-topic');
  var topic=topicEl?topicEl.value.trim():'';
  var pool=rpGetPool().filter(function(m){return m.selected;});
  if(!topic&&pool.length===0){toast('请填写行业/产品，或至少勾选 1 条素材');return;}
  var context=rpV2ReportContext(topic);
  var plan=window.rpBuildReportPlan?window.rpBuildReportPlan(context,rpV2SelectedTpl,rpV2SelectedTpl):null;
  var facts=window.rpCollectReportFacts?window.rpCollectReportFacts(context,pool):{scope:context,records:{},sources:[]};
  var check=window.rpCheckReportData?window.rpCheckReportData(plan,facts):{ok:true,missing:[],warnings:[]};
  var financial=window.JAY_REPORT_ENGINE?window.JAY_REPORT_ENGINE.financialFromFacts(facts):{status:'not_available'};
  var qualityGate=typeof jayCurrentReportQualityGate==='function'?jayCurrentReportQualityGate():null;
  rpV2RenderDataCheck(plan,check,financial);
  rpV2RenderQualityGate(qualityGate);
  rpV2RenderContentQuality(null);
  if(!check.ok){toast('报告缺少关键数据，已停止生成；请先补充数据');return;}
  if(!qualityGate||!qualityGate.ok)toast('全局数据质量未通过，本次只生成未保存草稿');
  if(!AI_ENGINE.hasKey()){toast('请先登录后使用 AI 报告服务');return;}
  rpGenInterval=true;
  var generationStartedAt=Date.now();
  var identity=rpV2GenerationIdentity(context,topic,pool);
  var quality=window.JAY_QUALITY_REPORT||{};
  try{
    rpAIGatewayRequests=[];
    rpActiveReportRun=await jayStartReportRun({
      clientReportId:identity.clientReportId,idempotencyKey:identity.idempotencyKey,
      purpose:rpV2SelectedTpl||'market-research',marketCodes:context.marketCodes||[],platformKeys:context.platformKeys||[],categoryCodes:context.categoryCodes||[],
      dataVersion:String(quality.data_contract_version||quality.generated_at||'local-unversioned'),
      workspaceId: typeof jayActiveWorkspaceId==='function' ? jayActiveWorkspaceId() : null,
      // The provider model is resolved by ai-proxy and written to the
      // observability rollup; do not record a misleading placeholder here.
      model:null,sectionCount:plan.sections.length,metadata:{topic:topic||'',template_id:rpV2SelectedTpl||'market-research'}
    });
    if(!rpActiveReportRun){throw new Error('REPORT_RUN_CREATE_FAILED');}
    if(rpActiveReportRun.duplicate){
      rpGenInterval=false;
      toast(rpActiveReportRun.status==='running'?'相同报告正在生成，请勿重复提交':'相同报告刚刚已经生成，请稍后再试');
      return;
    }
  }catch(runError){
    rpGenInterval=false;
    toast('无法创建报告运行记录：'+(window.jayServiceErrorText?window.jayServiceErrorText(runError):runError.message));
    return;
  }
  rpLastReportRecord=null; rpV2SetSaveState('pending','未保存');
  rpV2SetToolbarBusy(true);rpV2GoStep(3);
  var body=document.getElementById('rp-v2-preview-body');body.classList.remove('rp-empty-preview');
  var title=topic?('《'+topic+'》'+jayConfiguredMarketNames().join('、')+'市场调研报告'):(rpV2TplNames[rpV2SelectedTpl]||jayConfiguredMarketNames().join('、')+'市场调研报告');
  document.getElementById('rp-v2-preview-title').textContent=title;
  var status=document.getElementById('rp-v2-publish-status');if(status){status.className='rp-v2-publish-status';status.textContent='分章节生成中';}
  body.innerHTML='<div class="rp-v2-generating"><div style="font-size:32px;color:var(--green)">✦</div><h3 style="margin:12px 0 4px;font-weight:bold;font-size:16px">正在按章节生成报告</h3><p style="font-size:12px;color:var(--muted)">共 '+plan.sections.length+' 个章节，AI 只负责分析表达，数字由已核验数据提供...</p></div>';
  var customEl=document.getElementById('rp-v2-custom-prompt');var customText=customEl?customEl.value.trim():'';
  var results=[];
  function renderProgress(index){var p=body.querySelector('.rp-v2-generating p');if(p)p.textContent='正在生成第 '+(index+1)+'/'+plan.sections.length+' 章：'+plan.sections[index].title;}
  async function generateSection(section,prompts,requestOptions){
    var output=await callAI(prompts.system,prompts.user,requestOptions);
    rpAIGatewayRequests.push(requestOptions.requestId);
    var audit=window.JAY_REPORT_ENGINE.auditCitations([{id:section.id,text:output}],prompts.sourceAppendix||[]);
    var scopeAudit=window.JAY_REPORT_ENGINE.checkScope(output,facts.scope||context);
    if(audit.ok&&scopeAudit.ok)return output;
    var missing=(audit.missingNumericCitations||[]).slice(0,8).map(function(item){return '- '+String(item.text||'').slice(0,180);}).join('\n');
    var invalid=(audit.invalidCitations||[]).slice(0,8).map(function(item){return item.citation;}).join('、');
    var scopeViolations=(scopeAudit.violations||[]).join('、');
    var repairSystem=prompts.system+'\n上一次输出未通过发布审核。重新生成完整章节，不要解释修订过程。每一行只要包含阿拉伯数字就必须有准确的 [Sxxx]；表格增加“来源”列。没有准确来源的数字必须删除或改为“待补充”。不得出现未选择的市场或平台名称。';
    var repairUser=prompts.user+'\n发布审核失败，请重新生成本章。未引用数字所在行：\n'+(missing||'- 无')+'\n无效引用：'+(invalid||'无')+'\n范围外名称：'+(scopeViolations||'无');
    var retryOptions=Object.assign({},requestOptions,{
      operation:requestOptions.operation+'.citation-retry',
      requestId:requestOptions.requestId+':citation-retry'
    });
    var retryOutput=await callAI(repairSystem,repairUser,retryOptions);
    var repaired=window.JAY_REPORT_ENGINE.repairSectionCitations(retryOutput,prompts.citationFacts||[],prompts.sourceAppendix||[]);
    var sourced=window.JAY_REPORT_ENGINE.pruneUncitedNumericLines(repaired.text,prompts.sourceAppendix||[]);
    return window.JAY_REPORT_ENGINE.repairSectionScope(sourced.text,facts.scope||context).text;
  }
  function localSection(section){
    var scope=facts.scope||context;
    if(section.id==='methodology')return '本章使用当前工作区已选择的'+(scope.marketNames||[]).join('、')+'市场、'+(scope.platformNames||[]).join('、')+'平台和已核验来源记录。缺失数据保持“待补充”，不以其他市场或演示数据替代。生成日期：'+jayNowDate()+'。';
    if(section.id==='scope')return '适用市场：'+(scope.marketNames||[]).join('、')+'（'+(scope.marketCodes||[]).join('、')+'）；适用平台：'+(scope.platformNames||[]).join('、')+'；适用品类：'+(scope.categoryCodes||[]).join('、')+'。报告不覆盖未选择市场、平台、品类及范围外排名。';
    if(section.id==='sources')return '本报告的来源、日期、URL、验证等级和引用关系见文末“来源与核验附录”。';
    return '';
  }
  async function next(index){
    if(index>=plan.sections.length){
      var assembled=window.JAY_REPORT_ENGINE.assemble(plan,results,facts,check,financial,qualityGate);
      var version=window.rpCreateReportVersion?window.rpCreateReportVersion(assembled,rpV2RevisionBase,rpV2RevisionBase?'regenerate':'generate'):assembled;
      var snapshot=rpV2BuildReportSnapshot(version,facts,pool,context,qualityGate);
      version.snapshot=snapshot;
      version.dataSnapshotAt=snapshot.dataSnapshotAt;
      rpLastReportModel=version;rpLastReportText=version.text;rpLastReportTitle=title;
      rpV2RenderContentQuality(version.contentQuality);
       body.innerHTML='<div class="rp-v2-rpt">'+rpRenderReportWithCharts(version.text,version.sourceAppendix)+'</div>';
       var gatewayRows=rpAIGatewayRequests.map(function(id){return window.jayGetAIGateway?window.jayGetAIGateway(id):null;}).filter(Boolean);
       var gatewayProviders=[];var gatewayScopes=[];var gatewayFallback=false;
       gatewayRows.forEach(function(row){if(row.provider&&gatewayProviders.indexOf(row.provider)<0)gatewayProviders.push(row.provider);if(row.data_disclosure&&Array.isArray(row.data_disclosure.scope))row.data_disclosure.scope.forEach(function(scope){if(gatewayScopes.indexOf(scope)<0)gatewayScopes.push(scope);});if(row.fallback_used)gatewayFallback=true;});
       if(gatewayRows.length){
         var disclosure=document.createElement('div');disclosure.className='rp-ai-disclosure';
         disclosure.textContent='本报告 AI 处理供应商：'+gatewayProviders.join('、')+'；发送给第三方 AI 的数据范围：'+(gatewayScopes.join('、')||'正式历史投影、报告上下文')+(gatewayFallback?'；部分章节使用了备用供应商':'')+'。';
         body.appendChild(disclosure);
       }
      if(status){var blockedLabel=!qualityGate||!qualityGate.ok?'未发布草稿 · 数据质量阻断':(version.contentQuality&&!version.contentQuality.ok?'不可发布 · 内容质量需复核':(version.citationAudit&&!version.citationAudit.ok?'不可发布 · 正文引用核验未通过':'不可发布 · 请补充数据'));status.textContent=version.publishable?'可发布 · 完整性 '+version.completeness.overall+'%':blockedLabel;status.className='rp-v2-publish-status '+(version.publishable?'is-publishable':'is-blocked');}
      var reportRecord=await rpV2SaveReport(title,pool.length,{model:version,items:pool,tpl:rpV2SelectedTpl,text:version.text,parentId:rpV2RevisionBase&&rpV2RevisionBase.id||null,snapshot:snapshot,clientReportId:identity.clientReportId,reportRunId:rpActiveReportRun&&rpActiveReportRun.id});
      var savedReport=reportRecord&&reportRecord.cloudSaved?reportRecord:null;
      try{
        await jayFinishReportRun(rpActiveReportRun&&rpActiveReportRun.id,(version.publishable&&savedReport)?'completed':(version.publishable?'failed':'completed'),{
          durationMs:Date.now()-generationStartedAt,reportId:savedReport&&savedReport.dbId||null,model:rpActiveReportRun&&rpActiveReportRun.model||null,
          saveStatus:savedReport?'saved':(version.publishable?'failed':'blocked'),publicationStatus:savedReport&&version.publishable?'formal':'draft',
          errorCode:version.publishable&&!savedReport?'REPORT_SAVE_FAILED':null,errorMessage:version.publishable&&!savedReport?'Generated report could not be saved to Supabase':null,
          metadata:{topic:topic||'',template_id:rpV2SelectedTpl||'market-research',publishable:version.publishable===true,quality_status:qualityGate&&qualityGate.status||'unknown',quality_report_version:qualityGate&&qualityGate.snapshot&&qualityGate.snapshot.quality_report_version||'',completeness:version.completeness&&version.completeness.overall}
        });
      }catch(runFinishError){console.warn('[JAY观海] report run finalization failed:',runFinishError);}
      rpV2RevisionBase=null;
      toast(version.publishable?(savedReport?'报告已生成并保存到云端':'报告已生成，但云端保存失败'):(!qualityGate||!qualityGate.ok?'数据质量门禁未通过，报告已保留为未保存草稿':(version.citationAudit&&!version.citationAudit.ok?'报告正文引用核验未通过，已保留为未保存草稿':'报告已生成草稿，需补充数据后发布')));
      rpActiveReportRun=null;rpGenInterval=false;rpV2SetToolbarBusy(false);return;
    }
    renderProgress(index);
    var section=plan.sections[index];var local=localSection(section);
    if(local){results.push({id:section.id,title:section.title,domain:section.domain,text:local,claims:[]});await next(index+1);return;}
    var prompts=window.JAY_REPORT_ENGINE.buildSectionPrompt(plan,section,facts,financial,customText);
    var system=prompts.system+'\n当前日期：'+jayNowHuman()+'。输出简体中文 Markdown 章节正文，不要添加未给出的事实。';
    var user=prompts.user+'\n输出要求：只输出“'+section.title+'”本章正文；数字必须来自 facts 或 financial，无法确认就写“待补充”；不得写全球或未选择市场、平台；所有事实结论和关键数字必须保留 citationCatalog 中的 [Sxxx] 行内引用。';
    generateSection(section,{system:system,user:user,sourceAppendix:prompts.sourceAppendix,citationFacts:prompts.citationFacts},{temperature:0.35,max_tokens:2800,search:false,timeout:60000,entryPoint:'report.generation',operation:'report.section.'+section.id,requestId:(rpActiveReportRun&&rpActiveReportRun.id||identity.clientReportId)+':'+section.id,reportRunId:rpActiveReportRun&&rpActiveReportRun.id||null,clientReportId:identity.clientReportId,dataVersion:String(quality.data_contract_version||quality.generated_at||'local-unversioned')}).then(async function(output){
      results.push({id:section.id,title:section.title,domain:section.domain,text:output,claims:[]});await next(index+1);
    }).catch(async function(error){
       var aiFailure=window.jayAIErrorDetails?window.jayAIErrorDetails(error,requestOptions&&requestOptions.requestId):{code:error.code||'UNKNOWN_ERROR',text:error.message||'AI 请求失败',requestId:requestOptions&&requestOptions.requestId||'',provider:'未确定',retryable:true,suggestion:'请稍后重试'};
       body.innerHTML='<div class="rp-v2-rpt"><p style="color:#ef4444">第 '+(index+1)+' 章生成失败：'+escapeHtml(aiFailure.text)+'</p><dl class="rp-ai-error-meta"><dt>错误类型</dt><dd>'+escapeHtml(aiFailure.code)+'</dd><dt>请求编号</dt><dd>'+escapeHtml(aiFailure.requestId||'未生成')+'</dd><dt>供应商</dt><dd>'+escapeHtml(aiFailure.provider||'未确定')+'</dd></dl><p>'+escapeHtml(aiFailure.retryable?('建议：'+aiFailure.suggestion):'请按提示处理后再试')+'</p><p>已停止组装，未保存为正式报告。</p></div>';
      if(status){status.textContent='生成失败';status.className='rp-v2-publish-status is-blocked';}
      try{await jayFinishReportRun(rpActiveReportRun&&rpActiveReportRun.id,'failed',{durationMs:Date.now()-generationStartedAt,failedSection:section.id,errorCode:error.code||error.message,errorMessage:error.message,saveStatus:'failed',publicationStatus:'draft'});}catch(runError){console.warn('[JAY观海] report run failure logging failed:',runError);}
      rpActiveReportRun=null;rpGenInterval=false;rpV2SetToolbarBusy(false);toast('报告生成失败：'+(window.jayServiceErrorText?window.jayServiceErrorText(error):(error.message==='AUTH_REQUIRED'?'请先登录':String(error.message||'未知错误'))));
    });
  }
  await next(0);
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
    rpV2Answers = { category: g('rp-q-category').trim() || '未填写', market:jayConfiguredMarketName(), cost:'未定', budget:'未定', exp:'未定', risk:'均衡', care:'能不能卖', concern:'' };
  } else {
    rpV2Answers = {
      category: g('rp-q-category').trim() || '未填写',
      market: jayConfiguredMarketName(), cost: g('rp-q-cost'), budget: g('rp-q-budget'),
      exp: g('rp-q-exp'), risk: g('rp-q-risk'), care: g('rp-q-care'),
      concern: g('rp-q-concern').trim()
    };
  }
  rpV2CloseQuestionnaire();
  rpV2Generate();
}


// Module 2: 基于调研报告生成可落地电商执行计划
var rpPlanBusy = false;
async function rpV2GeneratePlan(){
  if(!rpLastReportText){ toast('请先生成市场调研报告'); return; }
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能生成执行计划');return;}
  if(rpPlanBusy){ return; }
  if(!AI_ENGINE.hasKey()){ toast('请先登录后使用 AI 报告服务'); return; }
  rpPlanBusy = true;
  showAIModal('电商执行计划', '<div class="rp-v2-generating"><div style="font-size:28px;color:var(--green)">⚡</div><h3 style="margin:12px 0 4px;font-weight:bold;font-size:16px">AI 正在制定执行计划</h3><p style="font-size:12px;color:var(--muted)">基于已生成的调研报告...</p></div>');
  try {
    var system = [
      '你是资深跨境电商运营顾问。基于给定的市场调研报告，输出可落地的电商执行计划，使用简体中文。',
      '【范围强制】'+jayConfiguredScopeInstruction()+'删除报告中可能残留的其他国家、区域或未接入平台内容。',
      '结构要求（Markdown）：',
      '1) 按模块分章：## 一、选品与SKU规划；## 二、定价策略；## 三、渠道布局；## 四、营销推广与预算ROI；## 五、供应链与运营关键节点。',
      '2) 用一张总表汇总落地动作：| 阶段 | 关键动作 | 负责角色 | 时间线 | 依据(报告数据点) |。',
      '3) 用 > ✅ 标注关键里程碑，> ⚠ 标注执行风险。',
      '4) 每项动作尽量可拆解、可追踪；明确预算与预期ROI。',
      '【当前日期】' + jayNowHuman() + '。请基于截至该日期的最新市场与政策环境制定计划，引用最新数据与政策。'
    ].join('\n');
    var user = '【当前日期】' + jayNowHuman() + '（' + jayNowDate() + '）。\n以下是市场调研报告内容：\n\n' + rpLastReportText + '\n\n请基于以上报告，生成可落地的电商执行计划（任务清单格式，尽量可拆解、可追踪）。';
    var plan = await callAI(system, user, { temperature: 0.6, max_tokens: 3000, search: true, entryPoint:'report.plan', operation:'report.plan', timeout:60000 });
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
function rpV2BuildReportSnapshot(model,facts,pool,context,qualityGate){
  var quality=window.JAY_QUALITY_REPORT||{};
  qualityGate=qualityGate||model&&model.qualityGate||(typeof jayCurrentReportQualityGate==='function'?jayCurrentReportQualityGate():null);
  var template=model&&model.template||jayConfiguredReportTemplate()||{};
  var appendix=model&&Array.isArray(model.sourceAppendix)?model.sourceAppendix:[];
  var materialSnapshotIds=(pool||[]).map(function(item){return item.source_record_id||item.id;}).filter(Boolean);
  var sourceRecordIds=appendix.map(function(item){return item.recordId||item.source_record_id||item.id;}).filter(Boolean);
  return {
    templateId:template.id||template.code||rpV2SelectedTpl||'custom',
    templateVersion:String(template.version||1),
    dataVersion:String(quality.data_contract_version||quality.generated_at||'local-unversioned'),
    qualityReportVersion:String(qualityGate&&qualityGate.snapshot&&qualityGate.snapshot.quality_report_version||quality.schema_version||quality.generated_at||'local-unversioned'),
    dataSnapshotAt:facts&&facts.collectedAt||new Date().toISOString(),
    materialSnapshotIds:Array.from(new Set(materialSnapshotIds)),
    sourceRecordIds:Array.from(new Set(sourceRecordIds)),
    scopeSnapshot:Object.assign({},context||facts&&facts.scope||{}, {capturedAt:new Date().toISOString()}),
    coverageMatrix:model&&model.coverageMatrix||null,
    qualityGate:qualityGate,
    qualitySnapshot:qualityGate&&qualityGate.snapshot||null
  };
}
async function rpV2SaveReport(name,materialCount,details){
  if(rpSaveBusy)return false;
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能保存报告');return false;}
  rpSaveBusy=true;
  details=details||{};
  var reports=Array.isArray(jayReportsCache)?jayReportsCache.slice():[];
  var scope=window.JAY_MARKET_SCOPE||{};
  var categoryCodes=Array.isArray(scope.categoryCodes)?scope.categoryCodes.slice():[];
  if(!categoryCodes.length && rpV2Answers && window.JAY_MARKET_SCOPE_API){
    categoryCodes=window.JAY_MARKET_SCOPE_API.normalizeCategoryCodes(rpV2Answers.category);
  }
  var reportId=details.clientReportId||Date.now()+'_'+Math.random().toString(36).substr(2,6);
  var previous=details.parentId?reports.find(function(item){return item.id===details.parentId}):null;
  var model=details.model||rpLastReportModel||{};
  var snapshot=details.snapshot||model.snapshot||rpV2BuildReportSnapshot(model,model.facts||null,details.items||[],rpV2ReportContext(''));
  var version=window.rpCreateReportVersion&&details.model===undefined?window.rpCreateReportVersion(model,previous,'generate'):model;
  if(version&&!version.seriesId)version.seriesId=previous&&previous.seriesId||reportId;
  var report={
    id:reportId, dbId:null, name:name, market:jayConfiguredMarketName(),
    market_codes:jayConfiguredMarketCodes(), platform_keys:Array.isArray(scope.platformKeys)?scope.platformKeys.slice():[], category_codes:categoryCodes,
    materials:materialCount, date:details.date||new Date().toISOString(), tpl:details.tpl||rpV2SelectedTpl||'custom',
    text:details.text||rpLastReportText||'', items:details.items||rpGetPool().filter(function(item){return item.selected}),
    engineVersion:version.engineVersion||'3.2', seriesId:version.seriesId||reportId, revision:Number(version.revision||version.version||1),
    parentId:version.parentId||details.parentId||null, model:version, completeness:version.completeness||null,
    publishable:version.publishable===true, sourceAppendix:version.sourceAppendix||[], citationAudit:version.citationAudit||null, reconciliation:version.reconciliation||null, scopeCheck:version.scopeCheck||null,
    coverageMatrix:snapshot.coverageMatrix||version.coverageMatrix||null,
    qualityGate:snapshot.qualityGate||version.qualityGate||null, qualitySnapshot:snapshot.qualitySnapshot||version.qualitySnapshot||null, publicationBlocks:version.publicationBlocks||[],
    generationStatus:'completed', saveStatus:'saving', cloudSaved:false, savedAt:null, reportRunId:details.reportRunId||null,
    workspaceId:typeof jayActiveWorkspaceId==='function'?jayActiveWorkspaceId():'', workspaceName:jayWorkspaceContext&&jayWorkspaceContext.workspace&&jayWorkspaceContext.workspace.name||'',
    createdBy:jayUser&&jayUser.id||'', createdByName:jayProfile&&(jayProfile.display_name||jayProfile.email)||'', creatorEmail:jayProfile&&jayProfile.email||'',
    templateVersion:snapshot.templateVersion, dataVersion:snapshot.dataVersion, qualityReportVersion:snapshot.qualityReportVersion,
    dataSnapshotAt:snapshot.dataSnapshotAt, materialSnapshotIds:snapshot.materialSnapshotIds, sourceRecordIds:snapshot.sourceRecordIds, scopeSnapshot:snapshot.scopeSnapshot
  };
  version.snapshot=snapshot;
  rpLastReportRecord=report;
  reports.unshift(report); if(reports.length>20)reports=reports.slice(0,20);
  jayReportsCache=reports;
  try{localStorage.setItem(jayPendingKey(RP_REPORTS_KEY),JSON.stringify(reports));}catch(e){}
  var statEl=document.getElementById('rp-stat-reports'); if(statEl)statEl.textContent=reports.length;
  window.rpLastSaveError=null;rpV2SetSaveState('saving'); rpV2LoadRecent();
  if(!report.publishable||typeof jayReportHasPublishableQuality!=='function'||!jayReportHasPublishableQuality(report)){
    report.saveStatus='blocked';report.cloudSaved=false;
    jayReportsCache=reports.map(function(item){return item.id===report.id?report:item;});
    try{localStorage.setItem(jayPendingKey(RP_REPORTS_KEY),JSON.stringify(jayReportsCache));}catch(e){}
    rpV2SetSaveState('blocked');rpV2LoadRecent();rpSaveBusy=false;return report;
  }
  if(!jayCanUseUserDb()){
    report.saveStatus='failed'; report.cloudSaved=false; rpV2SetSaveState('failed');
    toast('报告已生成，但未保存到云端：请登录后重试');
    rpV2LoadRecent(); rpSaveBusy=false; return false;
  }
  try {
    var saved=await jayPersistGeneratedReport(report);
    if(saved&&saved.id)report.dbId=saved.id;
    report.saveStatus='saved'; report.cloudSaved=true; report.savedAt=(saved&&saved.saved_at)||new Date().toISOString();
    window.rpLastSaveError=null;
    jayReportsCache=reports.map(function(item){return item.id===report.id?report:item;});
    try{localStorage.removeItem(jayPendingKey(RP_REPORTS_KEY));localStorage.removeItem(RP_REPORTS_KEY);}catch(e){}
    rpV2SetSaveState('saved'); rpV2LoadRecent();
    toast('报告已保存到云端'); rpSaveBusy=false;
    return report;
  } catch(error){
    report.saveStatus='failed'; report.cloudSaved=false;
    report.saveError=rpV2SaveErrorDetails(error);window.rpLastSaveError=report.saveError;
    jayReportsCache=reports.map(function(item){return item.id===report.id?report:item;});
    rpV2SetSaveState('failed'); rpV2LoadRecent();
    var saveBadge=document.getElementById('rp-v2-save-status');
    if(saveBadge)saveBadge.title='错误：'+report.saveError.code+(report.saveError.requestId?'；请求编号：'+report.saveError.requestId:'')+(report.saveError.reasonCodes.length?'；校验原因：'+report.saveError.reasonCodes.join('、'):'');
    console.warn('[JAY观海] report history sync failed:',error);
    toast('报告保存失败，仅暂存在本机：'+jayDbErrorText(error)+'（'+report.saveError.code+(report.saveError.requestId?'；请求编号 '+report.saveError.requestId:'')+'）'); rpSaveBusy=false;
    return false;
  }
}
function rpV2GetReports(){return Array.isArray(jayReportsCache)?jayReportsCache.filter(rpReportInConfiguredScope):[]}
function rpV2LoadRecent(){
  var list=document.getElementById('rp-v2-recent-list');
  if(!list)return;
  var reports=rpV2GetReports();
  var statEl=document.getElementById('rp-stat-reports');
  if(statEl)statEl.textContent=reports.length;
  if(reports.length===0){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font:12px \'Noto Sans SC\'">暂无历史报告</div>';return}
  var h='';
  var capabilities=typeof jayWorkspaceCapabilities==='function'?jayWorkspaceCapabilities():null;
  var canEdit=capabilities?capabilities.canEdit:(typeof jayWorkspaceCanEdit==='function'&&jayWorkspaceCanEdit());
  reports.forEach(function(r,i){
    var d=new Date(r.date);
    var ds=(d.getMonth()+1)+'/'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
    h+='<div class="rp-v2-recent-item" onclick="rpV2OpenReport('+i+')">';
    h+='<div class="rp-v2-recent-icon">◈</div>';
    var saveLabel=r.saveStatus==='saved'&&r.cloudSaved!==false?'已保存到云端':(r.saveStatus==='saving'?'云端保存中':(r.saveStatus==='blocked'?'未保存草稿':(r.saveStatus==='failed'?'仅本地暂存':'待云端保存')));
    var creator=r.createdByName||r.creatorEmail||(r.createdBy&&jayUser&&r.createdBy===jayUser.id?'当前用户':('成员 '+String(r.createdBy||'未知').slice(0,8)));
    if(r.createdBy&&jayUser&&r.createdBy===jayUser.id&&creator!=='当前用户')creator+='（我）';
    var workspace=r.workspaceName||(jayWorkspaceContext&&jayWorkspaceContext.workspace&&jayWorkspaceContext.workspace.name)||'当前工作区';
    var operations=canEdit?'查看、对比、重新生成、保存、导出':'查看、对比';
    h+='<div class="rp-v2-recent-info"><strong>'+escapeHtml(r.name)+'</strong><small>'+ds+' · v'+Number(r.revision||1)+' · '+(r.publishable===true?'可发布':'草稿')+' · '+saveLabel+'</small><small class="rp-v2-recent-meta">创建人：'+escapeHtml(creator)+' · 工作区：'+escapeHtml(workspace)+'</small><small class="rp-v2-recent-meta">可执行：'+escapeHtml(operations)+'</small></div>';
    if(canEdit)h+='<button type="button" class="rp-v2-recent-action" onclick="event.stopPropagation();rpV2RegenerateReport('+i+')" title="按当前数据重新生成">↻</button>';
    if(canEdit&&(r.saveStatus==='failed' || (r.cloudSaved===false&&r.saveStatus!=='blocked'))) h+='<button type="button" class="rp-v2-recent-action" onclick="event.stopPropagation();rpV2RetrySaveReport('+i+')" title="重试云端保存">☁</button>';
    h+='<button type="button" class="rp-v2-recent-action" onclick="event.stopPropagation();rpV2CompareReports('+i+')" title="与当前预览对比">⇄</button></div>';
  });
  list.innerHTML=h;
}
async function rpV2RetrySaveReport(index){
  var report=rpV2GetReports()[index];
  if(!report){toast('未找到待保存报告');return;}
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能保存报告');return;}
  if(typeof jayReportHasPublishableQuality!=='function'||!jayReportHasPublishableQuality(report)){toast('该报告的质量快照未通过，必须刷新数据后重新生成，不能直接转为正式报告');return;}
  var currentGate=typeof jayCurrentReportQualityGate==='function'?jayCurrentReportQualityGate():null;
  if(!currentGate||!currentGate.ok){rpV2RenderQualityGate(currentGate);toast('当前全局数据质量未通过，云端正式保存已阻断');return;}
  if(!jayCanUseUserDb()){toast('请登录后重试云端保存');return;}
  if(rpSaveBusy){toast('报告仍在保存中，请稍候');return;}
  rpSaveBusy=true;
  rpV2SetSaveState('saving'); report.saveStatus='saving'; report.cloudSaved=false; rpV2LoadRecent();
  try{
    var saved=await jayPersistGeneratedReport(report);
    report.dbId=saved&&saved.id||report.dbId||null; report.saveStatus='saved'; report.cloudSaved=true; report.savedAt=saved&&saved.saved_at||new Date().toISOString();
    jayReportsCache=Array.isArray(jayReportsCache)?jayReportsCache.map(function(item){return item.id===report.id?report:item;}):[report];
    try{localStorage.removeItem(jayPendingKey(RP_REPORTS_KEY));localStorage.removeItem(RP_REPORTS_KEY);}catch(e){}
    rpV2SetSaveState('saved');rpV2LoadRecent();toast('报告已保存到云端');rpSaveBusy=false;
  }catch(error){report.saveStatus='failed';rpV2SetSaveState('failed');rpV2LoadRecent();toast('报告保存失败：'+jayDbErrorText(error));rpSaveBusy=false;}
}
function rpV2OpenReport(index){
  var report=rpV2GetReports()[index];
  if(!report)return;
  if(!report.text){toast('该历史记录没有可恢复的正文');return}
  rpLastReportText=report.text;
  rpLastReportTitle=report.name;
  rpLastReportModel=report.model||null;
  rpV2RevisionBase=null;
  rpV2GoStep(3);
  var title=document.getElementById('rp-v2-preview-title');if(title)title.textContent=report.name;
  var body=document.getElementById('rp-v2-preview-body');
  if(body){body.classList.remove('rp-empty-preview');body.innerHTML='<div class="rp-v2-rpt">'+rpRenderReportWithCharts(report.text,report.sourceAppendix||(report.model&&report.model.sourceAppendix)||[])+'</div>';}
  var status=document.getElementById('rp-v2-publish-status');
  if(status){status.textContent=(report.publishable===true?'可发布':'未发布草稿')+' · v'+Number(report.revision||1);status.className='rp-v2-publish-status '+(report.publishable===true?'is-publishable':'is-blocked');}
  rpV2RenderQualityGate(report.qualityGate||null);
  rpV2RenderContentQuality(report.contentQuality||(report.model&&report.model.contentQuality)||null);
  rpLastReportRecord=report;
  rpV2SetSaveState(report.saveStatus||((report.cloudSaved===false)?'failed':'saved'));
  try { if(typeof jayLoadReportExports==='function') jayLoadReportExports(report.dbId||null); } catch(e) {}
}
function rpV2RegenerateReport(index){
  var report=rpV2GetReports()[index];if(!report)return;
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能重新生成报告');return;}
  rpV2RevisionBase=report;rpV2SelectedTpl=report.tpl||'market-research';
  var card=document.querySelector('.rp-v2-tpl-card[data-tpl="'+String(rpV2SelectedTpl).replace(/"/g,'')+'"]');if(card)rpV2SelectTpl(card);
  var topic=document.getElementById('rp-v2-topic');if(topic)topic.value=String(report.name||'').replace(/^《|》.*市场调研报告$/g,'');
  rpV2GoStep(2);toast('已载入 v'+Number(report.revision||1)+'，重新生成后将保留版本链');
}
function rpV2CompareReports(index){
  var report=rpV2GetReports()[index];if(!report)return;
  var current=rpLastReportModel;
  var body='<p>历史版本：v'+Number(report.revision||1)+' · '+escapeHtml(report.name||'')+'</p>';
  if(!current){body+='<p>当前没有另一份预览可对比，请先打开或生成一份报告。</p>';}else{
    var oldText=String(report.text||'');var newText=String(current.text||'');
    body+='<p>当前预览：v'+Number(current.revision||1)+' · 变更字数 '+Math.abs(newText.length-oldText.length)+'</p>';
    var oldSections=report.model&&Array.isArray(report.model.sections)?report.model.sections:[];
    var newSections=current.sections&&Array.isArray(current.sections)?current.sections:[];
    var changed=[];newSections.forEach(function(section){var previous=oldSections.find(function(item){return item.id===section.id;});if(!previous||String(previous.text||'')!==String(section.text||''))changed.push(section.title||section.id);});
    body+='<p style="color:var(--muted);font-size:12px">版本链：'+escapeHtml(String(report.seriesId||'未记录'))+' · 变化章节：'+escapeHtml(changed.length?changed.join('、'):'无')+'</p>';
  }
  showAIModal('报告版本对比',body);
}

// --- AI Tools ---
function rpV2AiTool(type){
  var pool = rpGetPool().filter(function(m){ return m.selected; });
  if(pool.length === 0){ toast('请先勾选素材'); return; }
  var resultEl = document.getElementById('rp-ai-' + type + '-result');
  if(!resultEl) return;
  if(rpV2IsReadOnlyWorkspace()){resultEl.innerHTML='<div class="rp-v2-ai-result"><p style="color:#ef4444">查看者只能读取共享内容，不能发起 AI 分析</p></div>';return;}
  if(!AI_ENGINE.hasKey()){ resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:#ef4444">请登录后使用 AI 分析服务</p></div>'; return; }
  resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:var(--muted);text-align:center;padding:10px">AI 分析中...</p></div>';
  var titles = pool.map(function(m){ return (m.title || '') + '（' + (m.type || '') + '）：' + (m.summary || m.source || ''); }).join('\n');
  var sys, usr;
  if(type === 'summary'){ sys = '你是跨境电商分析助手，请仅基于当前工作区范围及素材提炼核心结论。中文，要点式。'; usr = '素材：\n' + titles + '\n\n请提炼 3-5 条'+jayConfiguredMarketNames().join('、')+'市场核心发现与数据洞察，不得扩展到其他市场或平台。'; }
  else if(type === 'risk'){ sys = '你是跨境电商合规风险专家。仅分析当前工作区市场及已接入平台，中文，分高/中/低风险提示并给建议。'; usr = '素材：\n' + titles + '\n\n请扫描当前市场政策、赛道和平台违规风险，给出风险等级与应对建议。'; }
  else { sys = '你是跨境市场选品顾问。仅分析当前工作区市场及平台，中文，给出 3-5 个有素材依据的潜力品类及理由。'; usr = '素材：\n' + titles + '\n\n请推荐当前市场潜力品类方向及入选理由，不得编造数据。'; }
  var dateNote = '\n【当前日期】' + jayNowHuman() + '，请基于最新公开信息分析。';
  sys += dateNote; usr += dateNote;
  callAI(sys, usr, { temperature: 0.5, max_tokens: 1400, search: true, entryPoint:'report.comparison', operation:'report.comparison', timeout:60000 })
    .then(function(out){ resultEl.innerHTML = '<div class="rp-v2-ai-result">' + renderMarkdownSafe(out) + '</div>'; toast('AI 分析完成'); })
    .catch(function(e){ resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:#ef4444">分析失败：' + (e.message === 'AUTH_REQUIRED' ? '请先登录' : escapeHtml(e.message)) + '</p></div>'; });
}


// --- Export ---
function rpV2CurrentReport(){
  if(rpLastReportRecord)return rpLastReportRecord;
  var titleEl=document.getElementById('rp-v2-preview-title');
  var title=titleEl&&titleEl.textContent||rpLastReportTitle||'未命名报告';
  return {id:'preview_'+Date.now(),dbId:null,name:title,text:rpLastReportText||'',publishable:false,qualityGate:rpLastReportModel&&rpLastReportModel.qualityGate||null,qualitySnapshot:rpLastReportModel&&rpLastReportModel.qualitySnapshot||null,cloudSaved:false};
}
function rpV2MarkdownFromPreview(){
  var report=rpV2CurrentReport();
  if(report.text)return '# '+(report.name||'JAY观海市场决策报告')+'\n\n'+report.text;
  var body=document.getElementById('rp-v2-preview-body');
  var title=document.getElementById('rp-v2-preview-title');
  var content='# '+(title&&title.textContent||'JAY观海市场决策报告')+'\n\n> 生成时间: '+new Date().toLocaleString('zh-CN')+'\n\n';
  if(body){
    body.querySelectorAll('h2,h3').forEach(function(h){content+='\n## '+h.textContent+'\n';});
    body.querySelectorAll('h4').forEach(function(h){content+='\n### '+h.textContent+'\n';});
    body.querySelectorAll('p').forEach(function(p){if(p.textContent.trim())content+=p.textContent+'\n\n';});
    body.querySelectorAll('li').forEach(function(li){content+='- '+li.textContent+'\n';});
    body.querySelectorAll('table').forEach(function(table){table.querySelectorAll('tr').forEach(function(row,i){var cells=row.querySelectorAll('th,td');var line='| ';cells.forEach(function(c){line+=c.textContent.trim()+' | ';});content+=line+'\n';if(i===0)content+=line.replace(/[^|]/g,'-')+'\n';});content+='\n';});
  }
  return content;
}
function rpXmlEscape(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function rpDocxXml(title,text){
  var rows=String(text||'').replace(/\r/g,'').split('\n');
  var body='<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>'+rpXmlEscape(title)+'</w:t></w:r></w:p>';
  var inTable=false, tableRows=[];
  function flushTable(){if(!tableRows.length)return;body+='<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>';tableRows.forEach(function(cells){body+='<w:tr>'+cells.map(function(cell){return '<w:tc><w:p><w:r><w:t>'+rpXmlEscape(cell.trim())+'</w:t></w:r></w:p></w:tc>';}).join('')+'</w:tr>';});body+='</w:tbl>';tableRows=[];}
  rows.forEach(function(line){var trimmed=line.trim();if(/^\|.*\|$/.test(trimmed)){inTable=true;var cells=trimmed.replace(/^\||\|$/g,'').split('|');if(!cells.every(function(cell){return /^\s*:?-{2,}:?\s*$/.test(cell);}))tableRows.push(cells);return;}if(inTable){flushTable();inTable=false;}if(!trimmed){body+='<w:p/>';return;}var heading=trimmed.match(/^(#{1,3})\s+(.+)$/);if(heading){body+='<w:p><w:pPr><w:pStyle w:val="Heading'+Math.min(3,heading[1].length)+'"/></w:pPr><w:r><w:t>'+rpXmlEscape(heading[2])+'</w:t></w:r></w:p>';return;}body+='<w:p><w:r><w:t xml:space="preserve">'+rpXmlEscape(trimmed.replace(/^[-*]\s+/,''))+'</w:t></w:r></w:p>';});
  flushTable();
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>';
}
function rpZipBytes(value){return new TextEncoder().encode(value);}
function rpZipU16(value){return [value&255,(value>>>8)&255];}
function rpZipU32(value){return [value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255];}
function rpZipCrc(bytes){var table=rpZipCrc.table;if(!table){table=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}rpZipCrc.table=table;}var crc=0xffffffff;for(var i=0;i<bytes.length;i++)crc=table[(crc^bytes[i])&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function rpZipConcat(parts){var size=parts.reduce(function(n,p){return n+p.length;},0),out=new Uint8Array(size),at=0;parts.forEach(function(p){out.set(p,at);at+=p.length;});return out;}
function rpBuildDocxBlob(title,text){
  var files={
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/styles.xml':'<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style></w:styles>',
    'word/document.xml':rpDocxXml(title,text)
  };
  var local=[],central=[],offset=0,names=Object.keys(files);names.forEach(function(name){var nameBytes=rpZipBytes(name),data=rpZipBytes(files[name]),crc=rpZipCrc(data),header=new Uint8Array([0x50,0x4b,0x03,0x04].concat(rpZipU16(20),rpZipU16(0x0800),rpZipU16(0),rpZipU16(0),rpZipU32(crc),rpZipU32(data.length),rpZipU32(data.length),rpZipU16(nameBytes.length),rpZipU16(0)));local.push(rpZipConcat([header,nameBytes,data]));var ch=new Uint8Array([0x50,0x4b,0x01,0x02].concat(rpZipU16(20),rpZipU16(20),rpZipU16(0x0800),rpZipU16(0),rpZipU16(0),rpZipU32(crc),rpZipU32(data.length),rpZipU32(data.length),rpZipU16(nameBytes.length),rpZipU16(0),rpZipU16(0),rpZipU16(0),rpZipU16(0),rpZipU32(0),rpZipU32(offset)));central.push(rpZipConcat([ch,nameBytes]));offset+=local[local.length-1].length;});var centralBytes=rpZipConcat(central),end=new Uint8Array([0x50,0x4b,0x05,0x06].concat(rpZipU16(0),rpZipU16(0),rpZipU16(names.length),rpZipU16(names.length),rpZipU32(centralBytes.length),rpZipU32(offset),rpZipU16(0)));return new Blob([rpZipConcat(local.concat([centralBytes,end]))],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function rpV2Export(format,retryRow){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('请先生成报告');return}
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能导出报告');return;}
  if(rpExportBusy[format]){toast('相同格式正在导出，请勿重复提交');return;}
  if(format==='pdf'){ rpV2ExportPdfWithLogo(retryRow); return; }
  if(format==='docx'){ rpV2ExportDocx(retryRow); return; }
  rpV2SetExportBusy('md',true);
  var report=rpV2CurrentReport(),content=rpV2MarkdownFromPreview();
  toast('正在导出 Markdown…');
  try{var blob=new Blob([content],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='JAY观海_Report_'+Date.now()+'.md';a.click();URL.revokeObjectURL(url);if(typeof jayCreateReportExportEvent==='function')jayCreateReportExportEvent(report.dbId,'md','completed',{file_path:a.download,completed_at:new Date().toISOString(),parent_export_id:retryRow&&retryRow.id||null,attempt:retryRow?Number(retryRow.attempt||1)+1:1});toast('本地 Markdown 已导出，不属于云端正式 PDF/DOCX');}catch(error){if(typeof jayCreateReportExportEvent==='function')jayCreateReportExportEvent(report.dbId,'md','failed',{error_message:String(error.message||error),parent_export_id:retryRow&&retryRow.id||null,attempt:retryRow?Number(retryRow.attempt||1)+1:1});toast('Markdown 导出失败');}finally{rpV2SetExportBusy('md',false);}
}
// ===== B3 带品牌 Logo 一键导出 PDF =====
// 登录用户优先走 report-export Edge Function；服务端未配置时明确降级为本地打印。
async function rpV2ExportPdfWithLogo(retryRow){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('请先生成报告');return}
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能导出报告');return;}
  var title=document.getElementById('rp-v2-preview-title').textContent;
  var reportText=rpLastReportText||body.innerText||'';
  var report=rpV2CurrentReport();
  if(rpExportBusy.pdf){toast('PDF 正在导出，请勿重复提交');return;}
  rpV2SetExportBusy('pdf',true);
  if(typeof jayReportHasPublishableQuality!=='function'||!jayReportHasPublishableQuality(report)){rpV2RenderQualityGate(report.qualityGate||null);toast('该报告是质量门禁阻断的未保存草稿，不能创建正式 PDF');rpV2SetExportBusy('pdf',false);return;}
  var currentGate=typeof jayCurrentReportQualityGate==='function'?jayCurrentReportQualityGate():null;
  if(!currentGate||!currentGate.ok){rpV2RenderQualityGate(currentGate);toast('当前全局数据质量未通过，正式 PDF 导出已阻断');rpV2SetExportBusy('pdf',false);return;}
  if(typeof jayGenerateReportPdf==='function' && jayCanUseUserDb && jayCanUseUserDb()){
    if(!report.dbId||report.saveStatus!=='saved'||report.cloudSaved===false){toast('报告尚未完成云端保存，暂不能创建正式 PDF；请先完成云端保存');rpV2SetExportBusy('pdf',false);return;}
    toast('正在生成服务端 PDF…');
    try{
      var result=await jayGenerateReportPdf(title,reportText,report.dbId,retryRow?{parentExportId:retryRow.id,attempt:Number(retryRow.attempt||1)+1}:null);
      var fileUrl=result&&typeof jaySafeHttpsUrl==='function'?jaySafeHttpsUrl(result.file_url):'';
      if(fileUrl){
        var link=document.createElement('a');link.href=fileUrl;link.target='_blank';link.rel='noopener noreferrer';link.click();
        if(typeof jayLoadReportExports==='function')jayLoadReportExports(report.dbId);
        toast('PDF 已生成，下载链接 1 小时内有效');
        rpV2SetExportBusy('pdf',false);
        return;
      }
      if(result&&['queued','processing'].indexOf(result.status)>=0){toast('相同 PDF 已在生成中，请稍后查看导出历史');rpV2SetExportBusy('pdf',false);return;}
      throw new Error('REPORT_FILE_URL_MISSING');
    }catch(error){
      console.warn('[JAY观海] server PDF export failed:',error);
      if(typeof jayLoadReportExports==='function')jayLoadReportExports(report.dbId);
      toast('PDF 导出失败：'+(window.jayServiceErrorText?window.jayServiceErrorText(error):String(error.message||'服务端暂不可用'))+'；已切换为“本地临时导出”');
    }
  }else if(!jayIsDemo){
    toast('请登录后使用正式 PDF；当前仅提供“本地临时导出”');
  }
  var printWin=window.open('','_blank');
  if(!printWin){ toast('请允许弹出窗口以导出 PDF');rpV2SetExportBusy('pdf',false); return; }
  var safeTitle=escapeHtml(title);
  var html='<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>'+safeTitle+'</title><style>'
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
    +'<div class="rp-logo"><span class="mark">J</span><span class="name">JAY观海</span><span class="tag">跨境市场情报系统 · 本地临时导出 · 非云端正式文件</span></div>'
    +'<h1>'+safeTitle+'</h1>'
    + body.innerHTML
    +'<div class="rp-foot">本文件为服务端不可用时生成的本地临时导出，不代表云端正式报告或云端保存成功。报告内容来自当前工作区素材；使用前请复核原始来源。生成时间：'+new Date().toLocaleString('zh-CN')+'</div>'
    +'</body></html>';
  printWin.document.open(); printWin.document.write(html); printWin.document.close();
  setTimeout(function(){ try{ printWin.print(); }catch(e){} }, 450);
  toast('已打开“本地临时导出”预览，请在打印对话框中选择「另存为 PDF」');
  rpV2SetExportBusy('pdf',false);
}
async function rpV2ExportDocx(retryRow){
  var body=document.getElementById('rp-v2-preview-body');if(!body||body.classList.contains('rp-empty-preview')){toast('请先生成报告');return;}
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能导出报告');return;}
  var report=rpV2CurrentReport(),title=document.getElementById('rp-v2-preview-title').textContent,text=rpLastReportText||body.innerText||'';
  if(rpExportBusy.docx){toast('DOCX 正在导出，请勿重复提交');return;}
  rpV2SetExportBusy('docx',true);
  if(typeof jayReportHasPublishableQuality!=='function'||!jayReportHasPublishableQuality(report)){rpV2RenderQualityGate(report.qualityGate||null);toast('该报告是质量门禁阻断的未保存草稿，不能创建正式 DOCX');rpV2SetExportBusy('docx',false);return;}
  var currentGate=typeof jayCurrentReportQualityGate==='function'?jayCurrentReportQualityGate():null;
  if(!currentGate||!currentGate.ok){rpV2RenderQualityGate(currentGate);toast('当前全局数据质量未通过，正式 DOCX 导出已阻断');rpV2SetExportBusy('docx',false);return;}
  if(typeof jayGenerateReportDocx==='function' && jayCanUseUserDb && jayCanUseUserDb()){
    if(!report.dbId||report.saveStatus!=='saved'||report.cloudSaved===false){toast('报告尚未完成云端保存，暂不能创建正式 DOCX；请先完成云端保存');rpV2SetExportBusy('docx',false);return;}
    toast('正在生成 DOCX…');
    try{var result=await jayGenerateReportDocx(title,text,report.dbId,retryRow?{parentExportId:retryRow.id,attempt:Number(retryRow.attempt||1)+1}:null);var fileUrl=result&&typeof jaySafeHttpsUrl==='function'?jaySafeHttpsUrl(result.file_url):'';if(fileUrl){var link=document.createElement('a');link.href=fileUrl;link.target='_blank';link.rel='noopener noreferrer';link.click();if(typeof jayLoadReportExports==='function')jayLoadReportExports(report.dbId);toast('DOCX 已生成');rpV2SetExportBusy('docx',false);return;}if(result&&['queued','processing'].indexOf(result.status)>=0){toast('相同 DOCX 已在生成中，请稍后查看导出历史');rpV2SetExportBusy('docx',false);return;}throw new Error('REPORT_FILE_URL_MISSING');}
    catch(error){if(typeof jayLoadReportExports==='function')jayLoadReportExports(report.dbId);toast('DOCX 导出失败：'+(window.jayServiceErrorText?window.jayServiceErrorText(error):String(error.message||'服务端暂不可用'))+'；已切换为“本地临时导出”');}
  }
  try{var local=rpBuildDocxBlob(title,text),url=URL.createObjectURL(local),a=document.createElement('a');a.href=url;a.download='JAY观海_本地临时报告_'+Date.now()+'.docx';a.click();URL.revokeObjectURL(url);toast('本地临时 DOCX 已导出，不代表云端正式导出成功');}catch(error){toast('本地临时 DOCX 导出失败');}finally{rpV2SetExportBusy('docx',false);}
}
function rpV2RenderExportHistory(rows){
  var el=document.getElementById('rp-v2-export-history');if(!el)return;
  rows=Array.isArray(rows)?rows:[];
  if(!rows.length){el.innerHTML='<div class="rp-v2-history-empty">暂无导出记录</div>';return;}
  var labels={pdf:'PDF',docx:'DOCX',md:'Markdown'},states={queued:'排队中',processing:'处理中',completed:'成功',failed:'失败'};
  var canEdit=typeof jayWorkspaceCanEdit==='function'&&jayWorkspaceCanEdit();
  el.innerHTML=rows.slice(0,20).map(function(row){var date=row.created_at?new Date(row.created_at):null;var when=date&&isFinite(date.getTime())?date.toLocaleString('zh-CN'):'暂无时间';var localTemporary=String(row.file_path||'').indexOf('local-print://')===0||String(row.file_path||'').indexOf('JAY观海_Report_')===0;var status=localTemporary?'本地临时导出':(states[row.status]||row.status||'未知');var retry=canEdit&&row.status==='failed'&&row.report_id?'<button type="button" class="rp-v2-history-retry" data-export-id="'+escapeHtml(String(row.id||''))+'" title="重新导出">↻</button>':'';return '<div class="rp-v2-history-row"><div><strong>'+escapeHtml(labels[row.format]||row.format||'导出')+'</strong><small>'+escapeHtml(when)+' · '+escapeHtml(status)+(row.error_message?' · '+escapeHtml(row.error_message):'')+'</small></div>'+retry+'</div>';}).join('');
  el.querySelectorAll('.rp-v2-history-retry').forEach(function(button){
    button.addEventListener('click',function(){rpV2RetryExport(this.dataset.exportId||'');});
  });
}
async function rpV2RetryExport(exportId){
  var row=(window.jayReportExportsCache||[]).find(function(item){return item.id===exportId});if(!row){toast('未找到导出记录');return;}
  var report=(Array.isArray(jayReportsCache)?jayReportsCache:[]).find(function(item){return item.dbId===row.report_id;});if(!report){toast('未找到关联报告');return;}
  rpLastReportRecord=report; rpLastReportText=report.text||''; rpLastReportTitle=report.name||'';
  if(row.format==='pdf')return rpV2ExportPdfWithLogo(row);
  if(row.format==='docx')return rpV2ExportDocx(row);
  if(row.format==='md')return rpV2Export('md',row);
}
async function rpV2SaveDraft(){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('暂无内容可保存');return}
  if(!jayCanUseUserDb()){toast('只读演示不保存草稿，请登录后使用');return}
  if(rpV2IsReadOnlyWorkspace()){toast('查看者只能打开共享报告，不能保存草稿');return}
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

function switchPage(name,opts){ if(name!=='content'&&typeof resourceCenterClosePlayer==='function')resourceCenterClosePlayer();if(!(opts&&opts.fromHash)){ try{ if(location.hash!=='#'+name) history.pushState(null,'','#'+name); }catch(e){} }$$('.page').forEach(p=>p.classList.toggle('active',p.id===name));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===name));var titles={overview:'决策工作台',watchlist:'我的重点看板',products:'产品全域雷达',countries:'国家市场档案',shops:'店铺追踪',alerts:'预警中心',report:'报告生成中心',settings:'设置与权限',platforms:'电商平台档案',policies:'政策动态',rules:'平台规则变动',content:'资源中心',search:'统一搜索',myfit:'我的产品适配',pricing:'套餐与账单',tools:'操盘手工具箱',data:'数据底座',privacy:'隐私政策',terms:'服务条款',admin:'管理与运维后台'};var JAY_BC={overview:'工作台 / 决策总览',watchlist:'工作台 / 我的看板',products:'市场情报 / 类目机会',countries:'国家市场档案',shops:'经营决策 / 店铺追踪',alerts:'工作台 / 预警中心',report:'经营决策 / AI 报告',settings:'系统 / 设置与权限',platforms:'市场情报 / 平台情报',policies:'市场情报 / 政策动态',rules:'市场情报 / 平台规则',content:'系统 / 资源中心',search:'工作台 / 统一搜索',myfit:'经营决策 / 产品适配',pricing:'系统 / 套餐与账单',tools:'经营决策 / 利润工具',data:'系统 / 数据底座',privacy:'法律 / 隐私政策',terms:'服务条款',admin:'系统 / 管理与运维后台'};$('#page-title').textContent=titles[name]||name;$('#breadcrumb').textContent=JAY_BC[name]||name;if(name==='alerts')renderAlerts();if(name==='search'&&typeof jayRenderUnifiedSearch==='function')jayRenderUnifiedSearch();if(name==='settings'){stInit();aiInitKeyUI();}if(name==='pricing'&&typeof jayRenderPricingTier==='function'){jayRenderPricingTier();}if(name==='admin'&&typeof adminLoad==='function'){adminLoad();}if(name==='report'){rpV2RefreshPoolUI();rpV2LoadRecent();if(!jayIsDemo&&typeof jayHydrateUserWorkspace==='function')jayHydrateUserWorkspace(true).catch(function(error){console.warn('[JAY观海] report workspace refresh failed:',error);});}
if(name==='terms')$('#breadcrumb').textContent='法律 / 服务条款';
if(name==='content'&&typeof resourceCenterLoad==='function'){resourceCenterLoad();}
if(name==='myfit'){ /* legacy route retained; the page has no generated market-ranking data */ }
if(name==='tools'){ if(typeof toolsCalcProfit==='function'){ toolsCalcProfit(); toolsCalcScore(); toolsCalcStock(); } }
if(name==='pricing'){ if(typeof jayRenderPricingTier==='function') jayRenderPricingTier(); }
if(name==='settings'){ if(typeof stInitAccount==='function') stInitAccount(); }
if(name==='platforms'){ /* platform archive is constrained by the shared active scope */ }
if(name==='policies'){ var plf=$('#pl-f-region'); if(plf) plf.value=jayConfiguredMarketCode(); window.jayPolicyFilter={region:jayConfiguredMarketCode(),category:'all',impact:'all'}; renderPoliciesPage(); }
if(name==='rules'){
  var rulePlatform=$('#rl-platform');
  var requestedRulePlatform=JAY_CTX.platform||(JAY_CTX.ruleFilter&&JAY_CTX.ruleFilter.platform)||'all';
  var allowedRulePlatform='';
  if(requestedRulePlatform!=='all'&&window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.normalizePlatform){
    requestedRulePlatform=window.JAY_MARKET_SCOPE_API.normalizePlatform(requestedRulePlatform);
    if(!window.JAY_MARKET_SCOPE_API.isAllowedPlatform||window.JAY_MARKET_SCOPE_API.isAllowedPlatform(requestedRulePlatform,jayConfiguredMarketCode())){
      allowedRulePlatform=requestedRulePlatform;
    }
  }
  if(rulePlatform) rulePlatform.value=allowedRulePlatform||'all';
  var ruleMarket=$('#rl-market');
  if(ruleMarket) ruleMarket.value=jayConfiguredMarketCode();
  renderRulesPage();
}
if(name==='products'){ if(JAY_CTX.country||JAY_CTX.platform){ var cf=$('#pr-f-country'); if(cf&&JAY_CTX.country) cf.value=JAY_CTX.country; var pf=$('#pr-f-platform'); if(pf&&JAY_CTX.platform) pf.value=JAY_CTX.platform; var sf=$('#pr-f-signal'); if(sf) sf.value='all'; if(typeof prApplyFilters==='function') prApplyFilters(); } }
// Navigation keeps the selected configured market while clearing only the
// transient platform drill-down.
JAY_CTX.country = window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.country.name : jayConfiguredMarketName();
JAY_CTX.platform=null;
if (typeof trackActivity === 'function' && name !== 'overview') {
  var actMap = { countries: 'view_country', platforms: 'view_platform', policies: 'view_policy', rules: 'view_rule', report: 'export_report' };
  var actType = actMap[name] || 'search';
  trackActivity(actType, name, name, { source: 'navigation' });
}
window.scrollTo({top:0,behavior:'smooth'})}$$('[data-page]').forEach(e=>e.addEventListener('click',e=>{e.preventDefault();switchPage(e.currentTarget.dataset.page)}));

// === AI Engine (server-side proxy) ===
var AI_ENGINE = {
  provider: 'server-proxy',
  endpoint: JAY_SUPABASE_URL + '/functions/v1/ai-proxy',
  hasKey: function(){ return !!(supabaseClient && jayUser && !jayIsDemo); }
};
var rpLastReportText = '';
var rpLastReportTitle = '';
// 跨模块联动上下文：在任一模块点击国家/平台后跳转目标页，自动预筛选对应内容
var JAY_CTX = {
  country: window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.country.name : '美国',
  platform: null,
  policyFilter: { domain:'policy', region: jayConfiguredMarketCode(), category: 'all', impact: 'all', scope: 'cross-border' },
  ruleFilter: { platform: 'all', market: jayConfiguredMarketCode(), category: 'all', impact: 'all', actType: 'all' }
};
window.__CP_JAY_CTX = JAY_CTX;

if(window.addEventListener)window.addEventListener('jay:market-scope-change',function(){
  JAY_CTX.country=jayConfiguredMarketName();
  JAY_CTX.platform=null;
  JAY_CTX.policyFilter={domain:'policy',region:jayConfiguredMarketCode(),category:'all',impact:'all',scope:'cross-border'};
  JAY_CTX.ruleFilter={platform:'all',market:jayConfiguredMarketCode(),category:'all',impact:'all',actType:'all'};
  if(typeof renderWatchCards==='function')renderWatchCards('all');
  if(typeof toolsCalcScore==='function')toolsCalcScore();
});

// Cross-page navigation state. Every entry point writes the same filter
// context before routing so the destination list and its summary stay aligned.
function jayPolicyContext(filters){
  var base={domain:'policy',region:jayConfiguredMarketCode(),category:'all',impact:'all',scope:'cross-border'};
  JAY_CTX.policyFilter=Object.assign(base,filters||{});
  return JAY_CTX.policyFilter;
}
function jayRulesContext(filters){
  var base={platform:'all',market:jayConfiguredMarketCode(),category:'all',impact:'all',actType:'all'};
  JAY_CTX.ruleFilter=Object.assign(base,filters||{});
  return JAY_CTX.ruleFilter;
}
function jayOpenPolicyFilter(filters){
  jayPolicyContext(filters);
  JAY_CTX.platform=null;
  if(typeof switchPage==='function')switchPage('policies');
}
function jayOpenRulesFilter(filters){
  var next=Object.assign({},filters||{});
  if(next.platform && window.JAY_MARKET_SCOPE_API && window.JAY_MARKET_SCOPE_API.normalizePlatform){
    next.platform=window.JAY_MARKET_SCOPE_API.normalizePlatform(next.platform);
  }
  jayRulesContext(next);
  JAY_CTX.platform=JAY_CTX.ruleFilter.platform==='all'?null:JAY_CTX.ruleFilter.platform;
  if(typeof switchPage==='function')switchPage('rules');
}

// The legacy switchPage implementation renders pages correctly, but resets
// filter controls during navigation. Reapply the pending context immediately
// after it renders so cross-page links remain deterministic.
(function installCrossPageSwitch(){
  var baseSwitchPage=window.switchPage;
  if(!baseSwitchPage||baseSwitchPage.__jayCrossPageSwitch)return;
  function applyPolicyFilter(filter){
    filter=jayPolicyContext(filter);
    if(typeof plSwitchDomain==='function')plSwitchDomain(filter.domain||'policy');
    var region=document.getElementById('pl-f-region');
    var category=document.getElementById('pl-f-category');
    var impact=document.getElementById('pl-f-impact');
    var scope=document.getElementById('pl-f-scope');
    if(region)region.value=filter.region||jayConfiguredMarketCode();
    if(category)category.value=filter.category||'all';
    if(impact)impact.value=filter.impact||'all';
    if(scope){scope.value=filter.scope||'cross-border';scope.disabled=(filter.domain||'policy')!=='policy';}
    if(typeof plCrossBorderOnly!=='undefined')plCrossBorderOnly=(filter.scope||'cross-border')!=='all-us';
    window.jayPolicyFilter={region:filter.region||jayConfiguredMarketCode(),category:filter.category||'all',impact:filter.impact||'all'};
    if(typeof renderPoliciesPage==='function')renderPoliciesPage();
  }
  function applyRuleFilter(filter){
    filter=jayRulesContext(filter);
    var platform=document.getElementById('rl-platform');
    var market=document.getElementById('rl-market');
    var category=document.getElementById('rl-category');
    var impact=document.getElementById('rl-impact-level');
    var actType=document.getElementById('rl-act-type');
    if(platform)platform.value=filter.platform||'all';
    if(market)market.value=filter.market||jayConfiguredMarketCode();
    if(category)category.value=filter.category||'all';
    if(impact)impact.value=filter.impact||'all';
    if(actType)actType.value=filter.actType||'all';
    if(typeof renderRulesPage==='function')renderRulesPage();
  }
  var wrapped=function(name,opts){
    var ctx=window.__CP_JAY_CTX||JAY_CTX;
    var pendingPolicy=ctx.policyFilter?Object.assign({},ctx.policyFilter):null;
    var pendingRules=ctx.ruleFilter?Object.assign({},ctx.ruleFilter):null;
    if(name==='rules' && ctx.platform && (!pendingRules||pendingRules.platform==='all')){
      pendingRules=Object.assign({},pendingRules||{}, {platform:ctx.platform});
    }
    var result=baseSwitchPage.apply(this,arguments);
    if(name==='policies')applyPolicyFilter(pendingPolicy||{region:jayConfiguredMarketCode()});
    if(name==='rules')applyRuleFilter(pendingRules||{market:jayConfiguredMarketCode()});
    if(name==='overview' && typeof renderOverviewMetrics==='function')renderOverviewMetrics();
    return result;
  };
  wrapped.__jayCrossPageSwitch=true;
  window.switchPage=wrapped;

  document.querySelectorAll('#platforms .platform-card[data-platform]').forEach(function(card){
    var open=function(){jayOpenRulesFilter({platform:card.dataset.platform,market:jayConfiguredMarketCode()});};
    card.addEventListener('click',function(e){
      if(e.target.closest('a,button,input,select,textarea'))return;
      open();
    });
    card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    card.style.cursor='pointer';
  });
})();
// 当前日期助手：让 AI 报告基于最新时效，避免停在旧年份（如 2024）
function jayNowDate(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function jayNowHuman(){ var d=new Date(); return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日'; }

// Generic AI call. Third-party credentials remain inside the Edge Function.
async function callAI(systemPrompt, userPrompt, opts){
  opts = opts || {};
  if(!AI_ENGINE.hasKey()){ throw new Error('AUTH_REQUIRED'); }
  if(typeof jayFunctionRequest!=='function'){ throw new Error('AI_SERVICE_NOT_CONFIGURED'); }
  // The Edge Function caps requests at 3,000 output tokens. Keep the client
  // and server contract identical so a report cannot be silently truncated.
  var requestedTokens = Number(opts.max_tokens || 2000);
  var outputTokens = Math.max(128, Math.min(3000, isFinite(requestedTokens) ? requestedTokens : 2000));
  var requestId=String(opts.requestId||('ai_'+Date.now()+'_'+Math.random().toString(36).slice(2,10)));
  var entryPoint=String(opts.entryPoint||((opts.operation||'').indexOf('overview')===0?'overview.decision':((opts.operation||'').indexOf('report')===0?'report.generation':'ai.analysis')));
  var operationName=String(opts.operation||'analysis');
  var taskType=String(opts.taskType||((operationName.indexOf('report')===0||entryPoint.indexOf('report')===0)?'report':(operationName.indexOf('translation')===0?'translation':(operationName.indexOf('course')===0?'course_qa':(entryPoint.indexOf('code')===0?'code':'market_qa')))));
  var agentKey=String(opts.agentKey||((taskType==='report')?'report_generator':(taskType==='course_qa'?'course_assistant':(taskType==='translation'?'translator':(taskType==='code'?'code_maintainer':'market_analyst')))));
  var requestedTimeout=Number(opts.timeout);
  var totalTimeout=Math.max(1000,isFinite(requestedTimeout)?requestedTimeout:60000);
  var requestDeadline=Date.now()+totalTimeout;
  function buildBody(withSearch){
    var b = {
      messages: [
        { role: 'system', content: systemPrompt || '你是跨境电商市场情报分析专家。' },
        { role: 'user', content: userPrompt }
      ],
      temperature: (opts.temperature != null) ? opts.temperature : 0.7,
      max_tokens: outputTokens,
      stream: false,
      request_id: requestId,
       operation: operationName,
       entry_point: entryPoint,
       provider: opts.provider||'auto',
       task_type: taskType,
       agent_key: agentKey,
       fallback_providers: Array.isArray(opts.fallbackProviders)?opts.fallbackProviders.slice(0,4):undefined,
       workspace_id: opts.workspaceId || (typeof jayActiveWorkspaceId==='function' ? jayActiveWorkspaceId() : null),
       data_disclosure: {
         consent: opts.dataDisclosureConsent !== false,
         scope: Array.isArray(opts.dataDisclosureScope)?opts.dataDisclosureScope.slice(0,20):['formal_publications','request_context'],
       },
      context: opts.context && typeof opts.context==='object' ? opts.context : {},
      course_id: opts.context&&opts.context.course_id?opts.context.course_id:null,
      retrieval: {
        mode: opts.retrievalMode||'disabled',
        query: opts.retrievalQuery||userPrompt,
        allow_web_search: Boolean(withSearch)
      },
      report_run_id: opts.reportRunId||null,
      report_id: opts.reportId||null,
      client_report_id: opts.clientReportId||null,
      data_version: opts.dataVersion||null
    };
    if(withSearch){
      b.web_search = { type: 'enabled' };
      b.plugins = ['web_search'];
    }
    return b;
  }
  async function attempt(withSearch){
    var body=buildBody(withSearch);
    var remaining=requestDeadline-Date.now();
    if(remaining<1000){
      var timeoutError=new Error('REQUEST_TIMEOUT');
      timeoutError.code='REQUEST_TIMEOUT'; timeoutError.status=408; timeoutError.requestId=requestId;
      throw timeoutError;
    }
    return await jayFunctionRequest('ai-proxy',body,{
      timeout:remaining,
      requestId:requestId,
      retryOnNetwork:false
    });
  }
  try {
    var data;
    try{
      data=await attempt(Boolean(opts.search));
    }catch(firstError){
      var probe=JSON.stringify(firstError&&firstError.details||{});
      if(opts.search&&(firstError.status===400||firstError.status===422||(firstError.status===403&&/plugin|web_search|search|unsupported|not support/i.test(probe)))){
        data=await attempt(false);
      }else{
        throw firstError;
      }
    }
    var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if(!content && data && typeof data.content==='string') content=data.content;
    if(!content){
      var emptyError=new Error('AI_EMPTY_RESPONSE');
      emptyError.code='AI_EMPTY_RESPONSE'; emptyError.status=502; emptyError.requestId=requestId;
      throw emptyError;
    }
     window.JAY_AI_RETRIEVAL_BY_REQUEST=window.JAY_AI_RETRIEVAL_BY_REQUEST||{};
     window.JAY_AI_RETRIEVAL_BY_REQUEST[requestId]=data&&data.jay_retrieval&&typeof data.jay_retrieval==='object'?data.jay_retrieval:{mode:'formal_publications',source_ids:[],citations:[]};
     window.JAY_AI_GATEWAY_BY_REQUEST=window.JAY_AI_GATEWAY_BY_REQUEST||{};
     window.JAY_AI_GATEWAY_BY_REQUEST[requestId]=data&&data.jay_gateway&&typeof data.jay_gateway==='object'?data.jay_gateway:{request_id:requestId,provider:'未确定',agent_key:agentKey,data_disclosure:{scope:['formal_publications','request_context']}};
    var retrievalKeys=Object.keys(window.JAY_AI_RETRIEVAL_BY_REQUEST);
    if(retrievalKeys.length>40)delete window.JAY_AI_RETRIEVAL_BY_REQUEST[retrievalKeys[0]];
    // strip markdown code fences if present
    content = content.replace(/^```(?:markdown)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
    return content;
  } catch(error) {
    if(!error || typeof error!=='object') error=new Error(String(error||'AI_REQUEST_FAILED'));
    if(error&&error.name==='AbortError'){error.code='REQUEST_TIMEOUT';error.status=408;error.message='REQUEST_TIMEOUT';}
    error.requestId=error.requestId||requestId;
    error.provider=error.provider||(error.details&&error.details.provider)||((opts.provider&&opts.provider!=='auto')?opts.provider:'deepseek');
    error.suggestion=error.suggestion||(error.details&&error.details.suggestion)||null;
    if(window.jayServiceErrorText)error.message=window.jayServiceErrorText(error);
    throw error;
  }
}

window.jayGetAIRetrieval=function(requestId){
  var rows=window.JAY_AI_RETRIEVAL_BY_REQUEST||{};
  return rows[String(requestId||'')]||{mode:'formal_publications',source_ids:[],citations:[]};
};
window.jayGetAIGateway=function(requestId){
  var rows=window.JAY_AI_GATEWAY_BY_REQUEST||{};
  return rows[String(requestId||'')]||null;
};
// Shared UI metadata for overview/report failures. The request ID is stable
// across a search attempt and its no-search fallback, so support can locate
// one row in ai_request_logs.
window.jayAIErrorDetails = function(error, fallbackRequestId){
  error=error||{};
  var details=error.details||{};
  var nested=details.ai_error||{};
  var code=String(error.code||nested.code||details.error||error.message||'UNKNOWN_ERROR').split(':')[0];
  var text=window.jayServiceErrorText?window.jayServiceErrorText(error):String(error.message||code);
  return {
    code:code,
    text:text,
    requestId:error.requestId||details.request_id||nested.request_id||fallbackRequestId||'',
    provider:error.provider||details.provider||nested.provider||'未确定',
    retryable:error.retryable!=null?Boolean(error.retryable):(nested.retryable!=null?Boolean(nested.retryable):['AI_PROVIDER_TIMEOUT','AI_PROVIDER_UNREACHABLE','AI_PROVIDER_ERROR','AI_RATE_LIMITED','NETWORK_ERROR','EMPTY_RESPONSE','AI_EMPTY_RESPONSE'].indexOf(code)>=0),
    suggestion:error.suggestion||details.suggestion||nested.suggestion||(code==='AUTH_REQUIRED'?'请重新登录后重试':'请稍后重试')
  };
};

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
function rpV2SetCitationContext(appendix){
  rpActiveCitationIndex={};
  (Array.isArray(appendix)?appendix:[]).forEach(function(source){
    var citation=String(source&&source.citation||'');
    if(/^S\d{3}$/.test(citation))rpActiveCitationIndex[citation]=source;
  });
}
function rpV2OpenCitation(citation){
  citation=String(citation||'');
  var source=rpActiveCitationIndex[citation];
  if(!source){toast('未找到该引用对应的来源快照');return;}
  var safeUrl=typeof jaySafeHttpsUrl==='function'?jaySafeHttpsUrl(source.originalUrl||source.url):'';
  var rows=[
    ['引用编号','['+citation+']'],
    ['来源',source.source||'未命名来源'],
    ['原始记录 ID',source.recordId||'未提供'],
    ['数据快照 ID',source.snapshotId||source.recordId||'未提供'],
    ['数据快照',source.dataSnapshotAt||source.snapshotAt||'未提供'],
    ['发布日期',source.publishedAt||source.date||'未提供'],
    ['核验状态',source.verificationStatus||'待核验'],
    ['核验时间',source.verifiedAt||'未提供'],
    ['证据哈希',source.evidenceHash||'未提供']
  ];
  var html='<dl class="rp-citation-detail">'+rows.map(function(row){return '<div><dt>'+escapeHtml(row[0])+'</dt><dd>'+escapeHtml(row[1])+'</dd></div>';}).join('')+'</dl>';
  html+=safeUrl?'<a class="rp-citation-source-link" href="'+escapeHtml(safeUrl)+'" target="_blank" rel="noopener noreferrer">打开 HTTPS 原始来源</a>':'<p class="rp-citation-no-link">该记录没有可用的 HTTPS 原始链接，请按原始记录 ID 在数据快照中核验。</p>';
  showAIModal('来源追溯 '+citation,html);
}
document.addEventListener('click',function(event){
  var link=event.target&&event.target.closest?event.target.closest('[data-report-citation]'):null;
  if(!link)return;
  event.preventDefault();
  rpV2OpenCitation(link.getAttribute('data-report-citation'));
});
function rpRenderReportWithCharts(md,appendix){
  if(md==null) return '';
  if(appendix!==undefined)rpV2SetCitationContext(appendix);
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
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(S\d{3})\]/g,function(match,citation){
      if(!rpActiveCitationIndex[citation])return match;
      return '<a class="rp-report-citation" href="#report-source-'+citation+'" data-report-citation="'+citation+'" title="查看 '+citation+' 的来源与数据快照">['+citation+']</a>';
    });
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
async function loadWatchlistFromDb() {
  var items = (typeof loadUserWatchlist === 'function') ? await loadUserWatchlist() : null;
  if (items && items.length > 0) {
    watchlistData = items.filter(wlIsConfiguredScopeRow).map(function(row) {
      var typeMap = { country: 'track', platform: 'track', category: 'track', product: 'product', policy: 'track' };
      var flag = '\u{1F1FA}\u{1F1F8}';
      return {
        type: typeMap[row.item_type] || 'track',
        flag: flag,
        name: row.item_name || row.item_id,
        platforms: row.note || '\u5f85\u914d\u7f6e',
        status: 'monitor',
        statusText: '\u5df2\u5173\u6ce8',
        metrics: ['\u5df2\u5173\u6ce8', '\u6682\u65e0\u8d8b\u52bf\u6570\u636e'],
        detail: '\u5173\u6ce8\u4e8e ' + new Date(row.created_at).toLocaleDateString('zh-CN'),
        trend: [],
        _dbId: row.id
      };
    });
    console.log('[JAY观海] Watchlist loaded from DB: ' + watchlistData.length + ' items');
  } else {
    // The demo workspace has no persisted watchlist records.
    watchlistData = [];
  }
  renderWatchCards('all');
}
const alertMessages=[];
const recommendTracks=[];

function wlSafeText(value,fallback){
  if(value===undefined||value===null||value==='')return fallback||'';
  return String(value);
}
function wlTextElement(tag,className,value){
  var node=document.createElement(tag);
  if(className)node.className=className;
  node.textContent=wlSafeText(value);
  return node;
}
function buildMiniTrendElement(data,color){
  var values=(Array.isArray(data)?data:[]).map(Number).filter(function(value){return Number.isFinite(value);});
  if(values.length<2)return wlTextElement('div','wc-trend-empty','暂无趋势数据');
  var ns='http://www.w3.org/2000/svg',w=200,h=40,pad=4;
  var mn=Math.min.apply(null,values),mx=Math.max.apply(null,values);
  var range=mx-mn||1;
  var pts=values.map(function(value,index){
    return (pad+index*(w-2*pad)/(values.length-1))+','+(h-pad-(value-mn)/range*(h-2*pad));
  });
  var gradId='tg_'+Math.random().toString(36).substr(2,6);
  var svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 '+w+' '+h);
  svg.setAttribute('preserveAspectRatio','none');
  var defs=document.createElementNS(ns,'defs');
  var gradient=document.createElementNS(ns,'linearGradient');
  gradient.id=gradId;
  gradient.setAttribute('x1','0'); gradient.setAttribute('y1','0');
  gradient.setAttribute('x2','0'); gradient.setAttribute('y2','1');
  [['0%','0.2'],['100%','0.02']].forEach(function(config){
    var stop=document.createElementNS(ns,'stop');
    stop.setAttribute('offset',config[0]);
    stop.setAttribute('stop-color',color);
    stop.setAttribute('stop-opacity',config[1]);
    gradient.appendChild(stop);
  });
  defs.appendChild(gradient);
  var polygon=document.createElementNS(ns,'polygon');
  polygon.setAttribute('points',pts.join(' ')+' '+(w-pad)+','+h+' '+pad+','+h);
  polygon.setAttribute('fill','url(#'+gradId+')');
  var polyline=document.createElementNS(ns,'polyline');
  polyline.setAttribute('points',pts.join(' '));
  polyline.setAttribute('fill','none');
  polyline.setAttribute('stroke',color);
  polyline.setAttribute('stroke-width','2');
  polyline.setAttribute('stroke-linecap','round');
  polyline.setAttribute('stroke-linejoin','round');
  var circle=document.createElementNS(ns,'circle');
  var last=pts[pts.length-1].split(',');
  circle.setAttribute('cx',last[0]); circle.setAttribute('cy',last[1]);
  circle.setAttribute('r','3'); circle.setAttribute('fill',color);
  svg.append(defs,polygon,polyline,circle);
  return svg;
}
function wlActionButton(label,className,handler){
  var button=wlTextElement('button','wc-action-btn'+(className?' '+className:''),label);
  button.type='button';
  button.addEventListener('click',handler);
  return button;
}
function renderWatchCards(filterType){
  var filtered=filterType==='all'?watchlistData:watchlistData.filter(function(d){return d.type===filterType;});
  var grid=document.getElementById('watch-grid');
  if(!grid)return;
  if(!filtered.length){
    grid.replaceChildren(wlTextElement('div','wl-alert-none','暂无已保存的关注项。添加后才会显示监控卡片与趋势。'));
    return;
  }
  var fragment=document.createDocumentFragment();
  filtered.forEach(function(d){
    var sourceIndex=watchlistData.indexOf(d);
    var article=document.createElement('article'); article.className='watch-card';
    var top=document.createElement('div'); top.className='wc-top';
    var status=wlTextElement('span','wc-status monitor',d.statusText);
    top.append(
      wlTextElement('span','wc-flag',d.flag),
      wlTextElement('span','wc-name',d.name),
      wlTextElement('span','wc-platforms',d.platforms),
      status
    );
    var metrics=document.createElement('div'); metrics.className='wc-metrics';
    (Array.isArray(d.metrics)?d.metrics.slice(0,2):[]).forEach(function(metric){
      var item=document.createElement('div'); item.className='wc-metric';
      item.appendChild(wlTextElement('b','',metric)); metrics.appendChild(item);
    });
    var trend=document.createElement('div'); trend.className='wc-trend';
    trend.appendChild(buildMiniTrendElement(d.trend,'#2c5f8a'));
    var actions=document.createElement('div'); actions.className='wc-actions';
    actions.append(
      wlActionButton('✨ AI诊断','ai',function(){toast('AI诊断报告生成中...专业版可查看完整分析');}),
      wlActionButton(d.type==='shop'?'查看店铺':'查看榜单','',function(){toast('正在加载详细数据...');}),
      wlActionButton('设置提醒','',function(){toast('已设置此项监控提醒');}),
      wlActionButton('取消关注','remove',function(){removeWatchItem(this,sourceIndex);})
    );
    article.append(top,metrics,wlTextElement('p','wc-detail',d.detail),trend,actions);
    fragment.appendChild(article);
  });
  grid.replaceChildren(fragment);
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
  if(!recommendTracks.length){
    container.innerHTML='<div class="wl-alert-none">暂无经过验证的推荐关注项</div>';
    return;
  }
  container.innerHTML=recommendTracks.map(function(t){
    return '<div class="wl-rec-card"><span style="font-size:22px">'+t.flag+'</span><div class="wl-rec-info"><h5>'+t.name+'</h5><p>'+t.platforms+' \u00b7 '+t.reason+'</p></div><button class="wl-rec-add" onclick="addFromSearch(this, &#39;"+t.flag+"&#39; &#39;"+t.name+"&#39;,&#39;track&#39;)>\u6dfb\u52a0</button></div>';
  }).join('');
}

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
    body.innerHTML='<div class="wl-search-row"><input type="text" id="wl-search-input" placeholder="搜索当前市场、平台、店铺或单品..."><button onclick="doModalSearch()">搜索</button></div><div id="wl-search-results"><p style="font-size:11px;color:#999;text-align:center;padding:20px 0">输入关键词搜索当前市场中可监控的平台、店铺或单品</p></div>';
  }else if(tab==='ai'){
    body.innerHTML='<p style="font-size:12px;color:#4a6a8a;margin:0 0 14px">基于当前市场已验证记录生成推荐；当前暂无可用推荐数据。</p>'+recommendTracks.map(function(t){
      return '<div class="wl-rec-item"><div class="wl-rec-item-info"><h5>'+t.flag+' '+t.name+'</h5><p>'+t.platforms+'</p></div><button onclick="addFromSearch(this, &#39;"+t.flag+"&#39; &#39;"+t.name+"&#39;,&#39;track&#39;)>\u4e00\u952e\u6dfb\u52a0</button></div>';
    }).join('');
  }else if(tab==='template'){
    body.innerHTML='<div class="wl-alert-none">当前工作区没有已验证的看板模板。请先导入数据或手动添加当前市场的真实记录。</div>';
  }
}

function doModalSearch(){
  var q=document.getElementById('wl-search-input').value.trim();
  var results=document.getElementById('wl-search-results');
  function renderMessage(message){
    var empty=wlTextElement('p','',message);
    empty.style.fontSize='11px'; empty.style.color='#999'; empty.style.textAlign='center'; empty.style.padding='20px 0';
    results.replaceChildren(empty);
  }
  if(!q){renderMessage('\u8bf7\u8f93\u5165\u641c\u7d22\u5173\u952e\u8bcd');return;}
  var source=[];
  if(typeof watchlistData!=='undefined') source=source.concat(watchlistData.map(function(item){return {name:wlSafeText(item.name),sub:wlSafeText(item.platforms,'已保存记录'),type:item.type||'track'};}));
  if(typeof products!=='undefined') source=source.concat(products.map(function(item){return {name:wlSafeText(item[1]),sub:wlSafeText(item[3])+' · '+wlSafeText(item[2]),type:'product'};}));
  if(typeof shops!=='undefined') source=source.concat(shops.map(function(item){return {name:wlSafeText(item[0]),sub:wlSafeText(item[1])+' · '+wlSafeText(item[2]),type:'shop'};}));
  var scopeNames=window.JAY_MARKET_SCOPE?window.JAY_MARKET_SCOPE.platformNames:[];
  source=source.filter(function(item){var text=(item.name+' '+item.sub);return item.name&&text.toLowerCase().indexOf(q.toLowerCase())>=0&&(!scopeNames.length||scopeNames.some(function(name){return text.indexOf(name)>=0;})||jayConfiguredMarketNames().some(function(name){return text.indexOf(name)>=0;}));});
  if(!source.length){renderMessage('未找到已验证的'+jayConfiguredMarketNames().join('、')+'市场记录。请先导入商品/店铺数据或保存真实关注项。');return;}
  var fragment=document.createDocumentFragment();
  source.slice(0,20).forEach(function(record){
    var row=document.createElement('div'); row.className='wl-search-result';
    var copy=document.createElement('div');
    copy.append(wlTextElement('b','',record.name),wlTextElement('small','',record.sub));
    var add=wlTextElement('button','wl-rec-add','添加'); add.type='button';
    add.addEventListener('click',function(){addFromSearch(this,record.name,record.type);});
    row.append(copy,add); fragment.appendChild(row);
  });
  results.replaceChildren(fragment);
}

// PRO Modal
// ========== I1 订阅与账单 ==========
var JAY_TIER_LABELS = { free: '免费版', pro: 'Pro 专业版', enterprise: '企业版' };
async function jayUpgrade(tier){
  if(jayIsDemo){toast('只读演示不会更改会员或创建订单，请登录后查看订阅状态');return}
  if(!jayCanUseUserDb()){toast('请先登录后管理订阅');return}
  if(tier==='enterprise'){openEntModal();return}
  try{
    var billing=jayBillingStatusCache||(typeof jayLoadBillingStatus==='function'?await jayLoadBillingStatus():null);
    var checkoutEnabled=billing&&(billing.checkout_enabled===true||(billing.checkout_enabled==null&&billing.billing_enabled===true));
    if(!checkoutEnabled){toast('正式收费尚未启用，本次不会创建订单或扣款');return}
    if(tier==='free'){
      if(!billing.subscription||billing.subscription.provider!=='stripe'||!billing.subscription.provider_customer_id){toast('当前账号没有可管理的 Stripe 订阅');return}
      toast('正在打开安全账单门户…');
      var portal=await jayOpenBillingPortal();
      var portalUrl=portal&&typeof jaySafeHttpsUrl==='function'?jaySafeHttpsUrl(portal.url):'';
      if(portalUrl){location.href=portalUrl;return}
      throw new Error('BILLING_PORTAL_URL_MISSING');
    }
    var currentSub=billing.subscription||{};
    if(tier==='pro'&&currentSub.provider==='stripe'&&currentSub.provider_customer_id&&currentSub.provider_subscription_id&&['cancelled','expired'].indexOf(currentSub.status)<0){
      toast('当前订阅需要在账单门户中处理，正在打开…');
      var manage=await jayOpenBillingPortal();
      var manageUrl=manage&&typeof jaySafeHttpsUrl==='function'?jaySafeHttpsUrl(manage.url):'';
      if(manageUrl){location.href=manageUrl;return}
      throw new Error('BILLING_PORTAL_URL_MISSING');
    }
    toast('正在创建安全支付会话…');
    var result=await jayCreateBillingCheckout(tier);
    var checkoutUrl=result&&typeof jaySafeHttpsUrl==='function'?jaySafeHttpsUrl(result.url):'';
    if(checkoutUrl){location.href=checkoutUrl;return}
    throw new Error('CHECKOUT_URL_MISSING');
  }catch(error){
    toast('账单操作失败：'+(window.jayServiceErrorText?window.jayServiceErrorText(error):(error.message||'请稍后重试')));
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
    if(typeof jayCreateNotification==='function') await jayCreateNotification('JAY观海站内测试通知','这是一条站内测试通知。','test','info',{delivery_mode:'in_app_only'});
    toast('站内测试通知已创建');
  }catch(error){
    toast('测试通知创建失败：'+jayDbErrorText(error));
  }
}
// ===== D2 预警分类与精准订阅（偏好持久化）=====
function stNotificationPreferencesFromControls(){
  var subs=[];
  document.querySelectorAll('#st-tab-alerts .st-alert-check input[data-sub]').forEach(function(c){ if(c.checked) subs.push(c.getAttribute('data-sub')); });
  var api=window.JAY_MARKET_SCOPE_API;
  var context=api&&typeof api.getActiveContext==='function'?api.getActiveContext():{};
  return Object.assign({},jayPreferenceCache.notification_prefs||{}, {
    subscriptions:subs,
    subscriptions_configured:true,
    alert_scope:{
      market_codes:Array.isArray(context.marketCodes)?context.marketCodes.slice():[],
      platform_keys:Array.isArray(context.platformKeys)?context.platformKeys.slice():[],
      category_codes:Array.isArray(context.categoryCodes)?context.categoryCodes.slice():[],
      captured_at:new Date().toISOString()
    }
  });
}
async function stPersistNotificationPreferences(){
  if(!jayCanUseUserDb())return false;
  var notification=stNotificationPreferencesFromControls();
  var saved=await saveUserPreferences({notification_prefs:notification});
  return saved?notification:false;
}
async function stSaveSubPref(){
  if(!jayCanUseUserDb()){toast('只读演示不保存偏好，请登录后设置');return}
  var notification=await stPersistNotificationPreferences();
  var subs=notification&&Array.isArray(notification.subscriptions)?notification.subscriptions:[];
  var saved=!!notification;
  toast(saved?('订阅偏好已同步：'+(subs.length?subs.join(' / '):'无')):'保存失败，请检查网络后重试');
}
function stLoadSubPref(){
  var notification=jayPreferenceCache.notification_prefs||{};
  var subs=Array.isArray(notification.subscriptions)?notification.subscriptions:null;
  if(!subs) return;
  document.querySelectorAll('#st-tab-alerts .st-alert-check input[data-sub]').forEach(function(c){ c.checked = subs.indexOf(c.getAttribute('data-sub'))>=0; });
}
window.stPersistNotificationPreferences=stPersistNotificationPreferences;
async function jayRenderPricingTier(){
  var el = document.getElementById('prc-current-tier');
  var notice=document.getElementById('prc-billing-notice');
  var usageEl=document.getElementById('prc-usage-summary');
  var providerSyncEl=document.getElementById('prc-provider-sync');
  var upgradeButton=document.getElementById('prc-upgrade-pro');
  var manageButton=document.getElementById('prc-manage-billing');
  if(!el) return;
  if(upgradeButton)upgradeButton.disabled=true;
  if(manageButton)manageButton.disabled=true;
  if(usageEl)usageEl.textContent='';
  if(providerSyncEl)providerSyncEl.textContent='';
  function setNotice(text,state){if(!notice)return;notice.textContent=text;notice.className='prc-billing-notice '+(state||'');}
  if(jayIsDemo){el.textContent='当前状态：只读演示';setNotice('正式收费状态：未启用。只读演示不会创建订单、扣款或改变会员。','is-disabled');return}
  if(!jayCanUseUserDb()){el.textContent='请登录后查看真实订阅状态';setNotice('正式收费状态：未启用。登录并由服务端确认支付配置后才能进入结账。','is-disabled');return}
  el.textContent='正在读取订阅状态…';
  var billing=jayBillingStatusCache||(typeof jayLoadBillingStatus==='function'?await jayLoadBillingStatus():null);
  var sub=billing&&billing.subscription;
  var tier=(billing&&billing.effective_plan)||(jayProfile&&jayProfile.tier)||'free';
  var accessState=(billing&&billing.access_state)||(sub&&sub.status)||'active';
  var statusLabels={trialing:'试用中',active:'有效',past_due:'付款异常',cancelled:'已取消',expired:'已过期'};
  if(!billing||!sub){el.textContent='当前会员：'+(JAY_TIER_LABELS[tier]||tier)+' · 订阅记录暂不可用';setNotice('正式收费状态：未启用或暂不可确认。本次不会创建订单或扣款。','is-disabled');return}
  var end=sub.current_period_end?(' · 到期 '+new Date(sub.current_period_end).toLocaleDateString('zh-CN')):'';
  el.textContent='当前会员：'+(JAY_TIER_LABELS[tier]||tier)+' · '+(accessState==='refunded'?'已全额退款':(statusLabels[accessState]||accessState))+end+' · 渠道 '+(sub.provider||'internal');
  var entitlement=billing.entitlement||{},usage=billing.usage||{};
  if(usageEl){var reserved=Number(usage.ai_tokens_reserved||0);var activeSeats=Number(usage.active_seats||0);var pendingSeats=Number(usage.pending_seats||0);var seats=Number(usage.seats_in_use||activeSeats+pendingSeats);var seatLimit=Number(entitlement.seat_limit||sub.seat_limit||0);var seatText=seatLimit?'；席位 '+seats+' / '+seatLimit+(pendingSeats?'（含待接受邀请 '+pendingSeats+'）':''):'';usageEl.textContent='当前工作区本月用量：AI Token '+Number(usage.ai_tokens||0).toLocaleString('zh-CN')+' / '+Number(entitlement.monthly_ai_token_limit||0).toLocaleString('zh-CN')+(reserved?'（处理中预占 '+reserved.toLocaleString('zh-CN')+'）':'')+'；报告 '+Number(usage.reports||0)+' / '+Number(entitlement.monthly_report_limit||0)+'；导出 '+Number(usage.exports||0)+' / '+Number(entitlement.monthly_export_limit||0)+seatText;}
  var providerSync=billing.provider_consistency||{};
  if(providerSyncEl&&sub.provider==='stripe')providerSyncEl.textContent=providerSync.status==='consistent'?'Stripe 与系统订阅状态：一致（刚刚核验）':(providerSync.status==='mismatch'?'Stripe 与系统订阅状态：不一致，请暂停新操作并检查 webhook。':'Stripe 与系统订阅状态：暂未完成实时核验。');
  var checkoutEnabled=billing.checkout_enabled===true||(billing.checkout_enabled==null&&billing.billing_enabled===true);
  if(!checkoutEnabled){setNotice('正式收费状态：未启用。需完成 Stripe live 验收并通过发布闸门后才能创建订单。','is-disabled');return}
  if(upgradeButton)upgradeButton.disabled=tier==='pro'&&['active','trialing'].indexOf(sub.status)>=0;
  if(manageButton)manageButton.disabled=!(sub.provider==='stripe'&&sub.provider_customer_id);
  if(providerSync.status==='mismatch'){setNotice('Stripe 与系统状态不一致，已阻止新购买；可进入账单门户查看，并由管理员检查 webhook。','is-error');if(upgradeButton)upgradeButton.disabled=true;return}
  if(accessState==='refunded'){setNotice('全额退款已确认，Pro 权益已暂停并按免费套餐额度执行；退款记录仍可在 Stripe 门户查看。','is-warning');return}
  if(accessState==='past_due'){setNotice('最近一次付款失败或需要进一步操作。Pro 权益已暂停，请进入账单门户更新付款方式。','is-error');return}
  if(accessState==='expired'){setNotice('订阅已过期，当前按免费套餐额度执行。可更新付款方式后重新订阅。','is-error');return}
  if(accessState==='cancelled'){setNotice('订阅已取消，当前按免费套餐额度执行；账单历史仍可在 Stripe 门户查看。','is-warning');return}
  if(sub.refund_status==='partial'){setNotice('部分退款已同步，当前订阅仍有效；退款明细可在 Stripe 门户查看。','is-warning');return}
  if(sub.cancel_at_period_end){setNotice('订阅已安排在当前周期结束时取消，期间仍按当前有效套餐使用。','is-warning');return}
  var billingReturn='';try{billingReturn=new URLSearchParams(location.search).get('billing')||'';}catch(e){}
  if(billingReturn==='success'){setNotice('已从支付页面返回，系统正在等待 Stripe webhook 确认订阅；确认前不会提前开通权益。','is-warning');return}
  if(billingReturn==='cancelled'){setNotice('已取消本次结账，没有创建新的付费权益。','is-warning');return}
  if(billing.live_acceptance_mode===true){setNotice('公众收费仍关闭；当前专用工作区处于 Stripe live 验收通道，操作会产生真实交易。','is-warning');return}
  setNotice('正式收费状态：已启用。付款由 Stripe 托管，订阅权益只在签名 webhook 核验成功后更新。','');
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
  var market=document.getElementById('sc-market').value||jayConfiguredMarketCode();
  var margin=parseFloat(document.getElementById('sc-margin').value)||0;
  var weight=parseFloat(document.getElementById('sc-weight').value)||0;
  var sensitive=document.getElementById('sc-sensitive').value==='1';
  var api=window.JAY_MARKET_SCOPE_API;
  var basis=api&&api.getMarketScoreBasis?api.getMarketScoreBasis(market):null;
  var dims={
    '市场容量':basis&&basis.capacity!=null?basis.capacity:null,
    '竞争强度':basis&&basis.competition!=null?basis.competition:null,
    '毛利空间':Math.max(4,Math.min(20,margin/5)),
    '物流友好':Math.max(4,Math.min(20,20-weight*6)),
    '政策风险':basis&&basis.policyRisk!=null?Math.max(4,basis.policyRisk-(sensitive?6:0)):null
  };
  var total=0,available=0,bars='';
  for(var k in dims){
    var v=dims[k];
    if(v==null||!isFinite(v)){
      bars+='<div class="tools-dim"><span>'+k+'</span><span>暂无已验证数据</span></div><div class="tools-bar"><i style="width:0%"></i></div>';
      continue;
    }
    v=Math.max(0,Math.min(20,Number(v))); total+=v; available++;
    bars+='<div class="tools-dim"><span>'+k+'</span><span>'+v.toFixed(0)+'/20</span></div><div class="tools-bar"><i style="width:'+(v/20*100)+'%"></i></div>';
  }
  var complete=available===Object.keys(dims).length;
  var grade=complete?(total>=80?'good':(total>=60?'warn':'bad')):'warn';
  var glabel=complete?(total>=80?'优质选品':(total>=60?'普通选品':'谨慎选品')):'仅完成用户输入维度';
  var el=document.getElementById('sc-res');
  if(!el)return;
  var scoreText=complete?total.toFixed(0)+'/100':'暂无已验证评分数据';
  el.innerHTML=bars+'<div class="row hl"><span>综合评分</span><b>'+scoreText+'</b></div>'+
    '<div class="tools-score-note">已计算 '+available+'/'+Object.keys(dims).length+' 个维度；市场基准需通过来源核验后才纳入评分。</div>'+
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
  if(cmpState.mode==='platform') return (typeof platformsData!=='undefined'?platformsData.map(function(p){return p[0];}):[]);
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
    html+='<button type="button" class="cmp-chip'+(on?' on':'')+'" data-cmp-name="'+escapeHtml(String(n))+'">'+escapeHtml(n)+'</button>';
  });
  html+='</div>';
  box.innerHTML=html;
  box.querySelectorAll('.cmp-chip').forEach(function(button){
    button.addEventListener('click',function(){cmpToggleItem(this.dataset.cmpName||'');});
  });
}
function cmpRenderSelected(){
  var box=document.getElementById('cmp-selected');if(!box)return;
  if(!cmpState.sel.length){box.innerHTML='<span class="cmp-sel-empty">尚未选择，请从上方点选</span>';return;}
  var h='';
  cmpState.sel.forEach(function(n){
    h+='<span class="cmp-sel-item">'+escapeHtml(n)+'<button type="button" data-cmp-name="'+escapeHtml(String(n))+'">×</button></span>';
  });
  box.innerHTML=h;
  box.querySelectorAll('[data-cmp-name]').forEach(function(button){
    button.addEventListener('click',function(){cmpToggleItem(this.dataset.cmpName||'');});
  });
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
      '<button type="button" class="cmp-scheme-load" data-scheme-name="'+escapeHtml(k)+'">载入</button>'+
      '<button type="button" class="cmp-scheme-del" data-scheme-name="'+escapeHtml(k)+'">×</button></div>';
  });
  box.innerHTML=html;
  box.querySelectorAll('.cmp-scheme-load').forEach(function(button){button.addEventListener('click',function(){cmpLoadScheme(this.dataset.schemeName||'');});});
  box.querySelectorAll('.cmp-scheme-del').forEach(function(button){button.addEventListener('click',function(){cmpDeleteScheme(this.dataset.schemeName||'');});});
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
  var userItems=keys.map(function(k){var row=(typeof platformsData!=='undefined'?platformsData.find(function(p){return p[0]===k;}):null)||[];var d=pfExtData[k]||{};return {label:k,value:jayParseUsers(d.users||row[7])};});
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

function toggleSidebar(){ var s=document.querySelector('aside.sidebar'); if(s)s.classList.toggle('open'); var o=document.getElementById('jay-overlay'); if(o)o.classList.toggle('show'); }
function closeSidebar(){ var s=document.querySelector('aside.sidebar'); if(s)s.classList.remove('open'); var o=document.getElementById('jay-overlay'); if(o)o.classList.remove('show'); }
