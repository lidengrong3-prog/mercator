// === Round 2: AI Diagnosis Card ===
(function(){
  var el=$('#ov-ai-diagnosis');
  if(!el)return;
  var api=window.JAY_MARKET_SCOPE_API;
  var markets=api&&api.getActiveMarketNames?api.getActiveMarketNames():['美国'];
  var platforms=api&&api.getActivePlatformNames?api.getActivePlatformNames():['Amazon','TikTok Shop','AliExpress','eBay'];
  el.innerHTML='<h4>✨ '+markets.join('、')+'市场综合诊断 <span class="pro-badge">PRO</span></h4><ul><li><b>当前范围：</b>'+markets.join('、')+'市场，接入 '+platforms.join('、')+'</li><li>🔥 <b>重点方向：</b>先用已核验政策、平台规则和用户导入商品数据做判断</li><li>⚠️ <b>数据边界：</b>未接入实时经营数据的商品、店铺和类目不生成虚构结论</li></ul>';
})();


// ========== ALERTS CENTER ==========
// Dynamic alerts auto-generated from policies and rules data (JAY观海 AI)
var dynamicAlerts = [];
var dynamicAlertsLoaded = false;

function syncPlatformScopeUi(){
  var api=window.JAY_MARKET_SCOPE_API;
  if(!api||!api.getActivePlatforms)return;
  var platforms=api.getActivePlatforms();
  var names=platforms.map(function(p){return p.name||p.key;});
  var marketNames=api.getActiveMarketNames?api.getActiveMarketNames():[];
  var page=document.getElementById('platforms');
  if(!page)return;
  var header=page.querySelector('.page-header h2'); if(header)header.textContent=marketNames.join('、')+'市场 · 平台档案';
  var linkage=page.querySelector('.platform-linkage'); if(linkage)linkage.textContent='当前市场：'+marketNames.join('、');
  var note=page.querySelector('.platform-source-note'); if(note)note.textContent='平台范围来自统一市场配置；规则数量由当前市场已验证规则记录实时计算。';
  var grid=page.querySelector('.platform-grid'); if(!grid)return;
  var empty=grid.querySelector('.platform-scope-empty');
  if(!empty){
    empty=document.createElement('div');
    empty.className='platform-scope-empty';
    empty.setAttribute('role','status');
    grid.appendChild(empty);
  }
  empty.textContent=marketNames.length?'当前'+marketNames.join('、')+'市场暂无已配置平台':'当前市场暂无已配置平台';
  empty.style.display=platforms.length?'none':'';
  var existing={}; grid.querySelectorAll('.platform-card[data-platform]').forEach(function(card){ existing[card.dataset.platform]=card; });
  grid.querySelectorAll('.platform-card[data-platform]').forEach(function(card){ card.style.display=names.indexOf(card.dataset.platform)>=0?'':'none'; });
  platforms.forEach(function(platform){
    var name=platform.name||platform.key;
    if(existing[name]){
      var region=existing[name].querySelector('.platform-region'); if(region)region.textContent=(platform.marketName||marketNames[0]||'当前')+'站';
      var desc=existing[name].querySelector('.platform-desc'); if(desc)desc.textContent='平台经营指标未接入可信数据源，当前仅展示已验证的'+(platform.marketName||marketNames[0]||'当前')+'规则记录。';
      return;
    }
    var card=document.createElement('article'); card.className='platform-card'; card.dataset.platform=name; card.tabIndex=0; card.setAttribute('role','button'); card.setAttribute('aria-label','查看 '+name+' 平台规则');
    var shortName=name.replace(/[^A-Za-z0-9]/g,'').slice(0,2).toUpperCase()||name.slice(0,1);
    card.innerHTML='<div class="platform-header"><div class="platform-logo">'+escapeHtml(shortName)+'</div><div><div class="platform-name">'+escapeHtml(name)+'</div><div class="platform-region">'+escapeHtml((platform.marketName||marketNames[0]||'当前')+'站')+'</div></div></div><div class="platform-rule-status" data-platform-status="'+escapeHtml(name)+'"><span>已验证规则</span><b>正在读取...</b></div><p class="platform-desc">平台经营指标未接入可信数据源，当前仅展示已验证规则记录。</p><span class="platform-open-rules">查看平台规则 →</span>';
    var open=function(){ if(typeof jayOpenRulesFilter==='function')jayOpenRulesFilter({platform:name,market:platform.marketCode||((api.getPrimaryMarketCode&&api.getPrimaryMarketCode())||'')}); else if(typeof switchPage==='function')switchPage('rules'); };
    card.addEventListener('click',function(e){if(e.target.closest('a,button,input,select,textarea'))return;open();});
    card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    grid.appendChild(card);
  });
  if(typeof renderPlatformProfileStatus==='function')renderPlatformProfileStatus();
}

function generateDynamicAlerts(){
  dynamicAlerts = [];
  // --- from policies: impact_level === 'high' ---
  // Keep alerts on the policy page's formal data boundary: verified official
  // records whose subjects are relevant to the active markets.
  var pItems = typeof plGetVerifiedPolicies === 'function'
    ? plGetVerifiedPolicies(true)
    : [];
  var api=window.JAY_MARKET_SCOPE_API;
  var regionLabelMap = {};
  (api&&api.getConfig&&api.getConfig().markets||[]).forEach(function(m){ regionLabelMap[m.code]=m.name||m.label||m.code; });
  pItems.forEach(function(p, idx){
    var changeType=p.change_type||p.changeType;
    var impact=p.impact_level||p.impactLevel;
    // High-impact policies remain visible as risk alerts. Lower-impact
    // records only become alerts when the source explicitly identifies a
    // change and supplies a severity; the browser never invents one.
    if(impact !== 'high' && (!changeType || ['medium','low'].indexOf(impact)<0)) return;
    var regionCode=api&&api.normalizeMarketCode?api.normalizeMarketCode(p.region||p.market):String(p.region||p.market||'');
    var region = regionLabelMap[regionCode] || p.region || p.market || '待补充市场';
    var title = typeof plDisplayTitle==='function' ? plDisplayTitle(p) : (p.title_zh||p.title||'未命名政策');
    var summary = typeof plDisplaySummary==='function' ? plDisplaySummary(p) : (p.summary_zh||p.summary||'详见来源链接');
    var changeSummary=p.change_summary||p.changeSummary;
    if(changeSummary && !summary) summary=changeSummary;
    dynamicAlerts.push({
      id: 'dyn-p-' + (p.id || idx) + (changeType ? '-' + changeType : ''),
      type: 'policy',
      level: impact==='medium'?'mid':(impact||'high'),
      title: changeType ? '政策变更：'+title : title,
      country: region,
      platform: '-',
      detail: summary,
      date: p.published_at || p.effective_date || '',
      read: false,
      source: p.source || '官方政策源',
      refId: p.id,
      category: p.category || 'regulation',
      categoryCodes: p.category_codes || p.categoryCodes || [],
      changeType: changeType || null
    });
  });

  // Tax and market-access records stay in independent domains. A record only
  // becomes a change alert when the source explicitly supplies change_type
  // and impact_level; the browser never invents a severity from a tax rate or
  // requirement description.
  ['tax','access'].forEach(function(domain){
    var records=typeof plGetVerifiedDomainRecords==='function'?plGetVerifiedDomainRecords(domain):[];
    records.forEach(function(record,idx){
      var changeType=record.change_type||record.changeType;
      var impact=record.impact_level||record.impactLevel;
      if(!changeType||['high','medium','low'].indexOf(impact)<0)return;
      var marketCode=api&&api.normalizeMarketCode?api.normalizeMarketCode(record.market||record.region||record.market_code):String(record.market||record.region||record.market_code||'');
      var title=typeof plDisplayTitle==='function'?plDisplayTitle(record):(record.title_zh||record.title||'未命名变更');
      var detail=typeof plDisplaySummary==='function'?plDisplaySummary(record):(record.summary_zh||record.change_summary||record.summary||'详见来源记录');
      dynamicAlerts.push({
        id:'dyn-'+domain+'-'+(record.id||idx)+'-'+changeType,
        type:domain, level:impact==='medium'?'mid':impact,
        title:(domain==='tax'?'税收变更：':'准入变更：')+title,
        country:regionLabelMap[marketCode]||marketCode||'待补充市场',
        platform:record.platform||'-', detail:detail,
        date:record.effective_from||record.effective_date||record.published_at||'',
        read:false, source:record.source||'可追溯法规来源', refId:record.id,
        category:domain, categoryCodes:record.category_codes||record.categoryCodes||[], changeType:changeType
      });
    });
  });

  // --- from rules: impact_level === 'high' ---
  // rlGetJsonItems already limits rules to explicit active-market records and
  // configured platforms; Global and unsupported-platform rules stay out.
  var rItems = typeof rlGetJsonItems === 'function' ? rlGetJsonItems() : [];
  rItems.forEach(function(r, idx){
    if(r.impact_level !== 'high') return;
    var platform = r.platform || '多平台';
    var marketCode=api&&api.normalizeMarketCode?api.normalizeMarketCode(r.market||r.region):String(r.market||r.region||'');
    var market = regionLabelMap[marketCode] || r.market || r.region || '待补充市场';
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
      date: r.effective_date || r.published_at || '',
      read: false,
      source: r.source || (r.platform ? r.platform + ' 官方公告' : '平台官方公告'),
      refId: r.id,
      category: r.category || 'regulation',
      categoryCodes: r.category_codes || r.categoryCodes || []
    });
  });

  // Sort by date desc
  dynamicAlerts.sort(function(a,b){
    return (b.date||'').localeCompare(a.date||'');
  });
  dynamicAlertsLoaded = true;
}

var alDynReadMap = {};
var alertsDataLoaded = false;
var alertsDataLoading = false;
var alertsDataState = 'loading';

function alertIsInConfiguredScope(item){
  var api=window.JAY_MARKET_SCOPE_API;
  if(!api) return false;
  var market=Array.isArray(item) ? item[4] : item && (item.country || item.region || item.market || item.market_code || item.marketCode);
  var code=api.normalizeMarketCode?api.normalizeMarketCode(market):String(market||'').toUpperCase();
  var active=api.getActiveMarkets?api.getActiveMarkets().map(function(m){return m.code;}):[];
  if(active.indexOf(code)<0) return false;
  var platform=Array.isArray(item) ? item[5] : item && (item.platform || item.platform_key || item.platformKey);
  if(!platform || platform==='-' || !api.getPlatform)return true;
  // Alert feeds often use an agency or source name in the platform column.
  // Only enforce the platform relationship when the value is a known catalog
  // platform; unknown source labels must not make a valid market alert vanish.
  var known=api.getPlatform(platform);
  return !known || !api.isAllowedPlatform || api.isAllowedPlatform(platform);
}

function replaceScopedAlertData(rows){
  alertsFull.length = 0;
  (Array.isArray(rows) ? rows : []).filter(alertIsInConfiguredScope).forEach(function(row){
    if(Array.isArray(row)){
      var normalized = row.slice();
      if(normalized[2] === 'medium') normalized[2] = 'mid';
      alertsFull.push(normalized);
      return;
    }
    if(row && typeof row==='object'){
      var objectRecord=Object.assign({},row);
      if(objectRecord.level==='medium')objectRecord.level='mid';
      alertsFull.push(objectRecord);
    }
  });
}

function alertRecordForProvenance(item){
  if(Array.isArray(item)){
    var metadata=item[9]&&typeof item[9]==='object'?item[9]:{};
    return Object.assign({},metadata,{
      id:item[0], title:item[3], market:item[4], platform:item[5], detail:item[6],
      published_at:item[7], collected_at:item[7], source:item[5]||'official_feed',
      source:metadata.source||item[5]||'', source_record_id:metadata.source_record_id||'',
    });
  }
  return item && typeof item==='object' ? item : {};
}

function alertIsFormalRecord(item){
  // Retired sample cards used short IDs such as a1/a13 and had no source
  // record. They must never become formal merely because the legacy payload
  // happens to match the old nine-column array shape.
  if(Array.isArray(item)&&(!item[9]||typeof item[9]!=='object'||!item[9].source||!item[9].source_record_id||item[9].display_locale!=='zh-CN'))return false;
  var api=window.JAY_MARKET_SCOPE_API;
  var record=alertRecordForProvenance(item);
  return !api || typeof api.isFormalRecord!=='function'
    ? true
    : api.isFormalRecord(record,{domain:'alert'});
}

async function loadAlertsData(){
  if(alertsDataLoading || alertsDataLoaded || typeof jayFetchMarketData !== 'function') return;
  alertsDataLoading = true;
  alertsDataState = 'loading';
  var url = (document.querySelector('base') ? document.querySelector('base').href : location.pathname.replace(/[^/]*$/,'')) + 'data/alerts.json';
  try {
    var data = await jayFetchMarketData('alerts', url);
    var rows = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
    replaceScopedAlertData(rows);
    alertsDataLoaded = true;
    alertsDataState = 'ready';
    if(typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
    if(typeof renderAlerts === 'function') renderAlerts();
  } catch(e) {
    alertsDataState = 'error';
    console.warn('[JAY观海] Alerts data unavailable; keeping the configured empty state:', e);
  } finally {
    alertsDataLoading = false;
    if(typeof renderDecisionOverview==='function')renderDecisionOverview();
  }
}

// Merge scoped source records and generated records for rendering.
function getCombinedAlerts(){
  function normalizedType(value){
    var type=String(value||'policy').toLowerCase();
    if(type==='rule'||type==='rules')return 'platform';
    if(type==='macro'||type==='country')return 'market';
    if(type==='tariff')return 'tax';
    return type;
  }
  // Convert array-format alertsFull entries to objects for unified handling.
  var base = alertsFull.filter(alertIsInConfiguredScope).filter(alertIsFormalRecord).map(function(a){
    if(!Array.isArray(a)){
      return {
        id:a.id, type:normalizedType(a.type), level:a.level, title:a.title,
        country:a.country||a.market||a.region||a.market_code||a.marketCode,
        marketCode:a.market_code||a.marketCode||'', platform:a.platform||a.platform_key||a.platformKey||'-',
        detail:a.detail||a.summary_zh||a.summary||'', date:a.date||a.published_at||a.effective_date||'',
        read:!!a.read, source:a.source||a.source_name||'来源待补充', sourceUrl:a.source_url||a.url||'',
        categoryCodes:a.category_codes||a.categoryCodes||[], dynamic:false
      };
    }
    var metadata=a[9]&&typeof a[9]==='object'?a[9]:{};
    return {
      id: a[0], type: normalizedType(a[1]), level: a[2], title: a[3],
      country: a[4], platform: a[5], detail: a[6],
      date: a[7], read: a[8],
      source: metadata.source||'公开数据源', sourceUrl:metadata.source_url||'',
      categoryCodes:metadata.category_codes||[], dynamic:false
    };
  });
  // Apply read-state map to dynamic alerts
  var dyn = dynamicAlerts.filter(alertIsInConfiguredScope).map(function(a){
    return {
      id: a.id, type: normalizedType(a.type), level: a.level, title: a.title,
      country: a.country, platform: a.platform, detail: a.detail,
      date: a.date,
      read: !!alDynReadMap[a.id],
      source: a.source || '来源待补充', sourceUrl:a.sourceUrl||'',
      categoryCodes:a.categoryCodes||[], dynamic:true
    };
  });
  // Filter out dynamic alerts that duplicate base ones (by title similarity)
  function titleKey(value){
    return String(value||'').replace(/^(?:政策更新|政策变更|税收变更|准入变更)[：:]\s*/,'').replace(/\s+/g,' ').trim().toLowerCase();
  }
  var baseTitles = {};
  base.forEach(function(a){ baseTitles[titleKey(a.title)] = true; });
  dyn = dyn.filter(function(a){ return !baseTitles[titleKey(a.title)]; });
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
  if(typeof renderDecisionOverview==='function')renderDecisionOverview();
}

var alCurrentTab='all';
var alCurrentPage=1;
var alPerPage=10;
var alSelected=new Set();
var alTypeIcons={shop:'🏪',cat:'📈',policy:'📜',tax:'💰',access:'🛂',market:'📊',platform:'🔧'};
var alTypeLabels={shop:'店铺异动',cat:'类目变化',policy:'政策动态',tax:'税收费用',access:'市场准入',market:'市场变化',platform:'平台规则'};
var alLevelLabels={high:'高风险',mid:'中风险',low:'普通'};
var alTypeTargets={shop:'products',cat:'products',policy:'policies',tax:'policies',access:'policies',market:'countries',platform:'rules'};
var alFilterStorageKey='jay_alert_filters_v2';

// Initial alerts render will be triggered by switchPage

function renderAlerts(){
  var filtered=getFilteredAlerts();
  var pages=Math.max(1,Math.ceil(filtered.length/alPerPage));
  if(alCurrentPage>pages) alCurrentPage=pages;
  renderAlSummary(filtered);
  renderAlTabs();
  renderAlBatch();
  renderAlList(filtered);
  renderAlPagination(filtered);
  updateAlBadge(filtered);
}

function getFilteredAlerts(){
  var typeNode=document.getElementById('al-filter-type');
  var levelNode=document.getElementById('al-filter-level');
  var timeNode=document.getElementById('al-filter-time');
  var searchNode=document.getElementById('al-search-input');
  var typeF=typeNode?typeNode.value:'all';
  var levelF=levelNode?levelNode.value:'all';
  var timeF=timeNode?timeNode.value:'all';
  var searchQ=String(searchNode&&searchNode.value||'').trim().toLowerCase();
  var custom=alCustomRangeValues();
  var api=window.JAY_MARKET_SCOPE_API;
  var context=api&&api.getActiveContext?api.getActiveContext():{categoryCodes:[]};
  var activeCategories=context.categoryCodes||[];
  var tabType=alCurrentTab;
  var all = getCombinedAlerts();
  return all.filter(function(a){
    if(tabType!=='all'&&a.type!==tabType)return false;
    if(typeF!=='all'&&a.type!==typeF)return false;
    if(levelF!=='all'&&a.level!==levelF)return false;
    var fields=[a.title,a.country,a.platform,a.detail,a.source].map(function(value){return String(value||'').toLowerCase();});
    if(searchQ&&!fields.some(function(value){return value.indexOf(searchQ)>=0;}))return false;
    if(!alMatchesTimeFilter(a.date,timeF,undefined,custom.start,custom.end))return false;
    var recordCategories=Array.isArray(a.categoryCodes)?a.categoryCodes:[];
    if(activeCategories.length&&recordCategories.length){
      var normalized=recordCategories.map(function(code){return api&&api.normalizeCategoryCode?api.normalizeCategoryCode(code):String(code);});
      if(!normalized.some(function(code){return activeCategories.indexOf(code)>=0;}))return false;
    }
    return true;
  });
}

function jayOpenAlertsFilter(filters){
  filters=filters||{};
  alCurrentTab=filters.type&&filters.type!=='all'?filters.type:'all';
  var type=document.getElementById('al-filter-type');if(type)type.value=filters.type||'all';
  var level=document.getElementById('al-filter-level');if(level)level.value=filters.level||'all';
  var time=document.getElementById('al-filter-time');if(time)time.value=filters.time||'all';
  var search=document.getElementById('al-search-input');if(search)search.value=filters.search||'';
  var start=document.getElementById('al-date-start');if(start)start.value=filters.start||'';
  var end=document.getElementById('al-date-end');if(end)end.value=filters.end||'';
  alSyncCustomRangeUi();
  alPersistFilters();
  alCurrentPage=1;
  if(typeof switchPage==='function')switchPage('alerts');
  else renderAlerts();
}
window.jayOpenAlertsFilter=jayOpenAlertsFilter;

function alLocalDay(value){
  if(value instanceof Date){
    if(isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(),value.getMonth(),value.getDate());
  }
  var raw=String(value||'').trim();
  var dateOnly=raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  var parsed=dateOnly
    ? new Date(Number(dateOnly[1]),Number(dateOnly[2])-1,Number(dateOnly[3]))
    : new Date(raw);
  if(isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(),parsed.getMonth(),parsed.getDate());
}

function alCalendarDayDiff(value,nowValue){
  var alertDay=alLocalDay(value);
  var currentDay=alLocalDay(nowValue instanceof Date ? nowValue : new Date());
  if(!alertDay||!currentDay) return null;
  var alertUtc=Date.UTC(alertDay.getFullYear(),alertDay.getMonth(),alertDay.getDate());
  var currentUtc=Date.UTC(currentDay.getFullYear(),currentDay.getMonth(),currentDay.getDate());
  return Math.round((currentUtc-alertUtc)/86400000);
}

function alIsoLocalDay(value){
  var day=alLocalDay(value);
  if(!day)return '';
  return day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
}

function alCustomRangeValues(){
  var start=document.getElementById('al-date-start');
  var end=document.getElementById('al-date-end');
  return {start:start?start.value:'',end:end?end.value:''};
}

function alValidateCustomRange(){
  var time=document.getElementById('al-filter-time');
  var error=document.getElementById('al-date-error');
  if(!time||time.value!=='custom'){
    if(error)error.textContent='';
    return true;
  }
  var values=alCustomRangeValues();
  var start=alLocalDay(values.start),end=alLocalDay(values.end),today=alLocalDay(new Date());
  var message='';
  if(!start||!end)message='请选择完整的开始和结束日期';
  else if(start>end)message='开始日期不能晚于结束日期';
  else if(start>today||end>today)message='自定义范围不能晚于今天';
  if(error)error.textContent=message;
  return !message;
}

function alSyncCustomRangeUi(){
  var time=document.getElementById('al-filter-time');
  var range=document.getElementById('al-custom-range');
  if(!time||!range)return;
  range.hidden=time.value!=='custom';
  var today=alIsoLocalDay(new Date());
  ['al-date-start','al-date-end'].forEach(function(id){var input=document.getElementById(id);if(input)input.max=today;});
  alValidateCustomRange();
}

function alPersistFilters(){
  var type=document.getElementById('al-filter-type');
  var level=document.getElementById('al-filter-level');
  var time=document.getElementById('al-filter-time');
  var search=document.getElementById('al-search-input');
  var custom=alCustomRangeValues();
  try{localStorage.setItem(alFilterStorageKey,JSON.stringify({
    type:type?type.value:'all',level:level?level.value:'all',time:time?time.value:'all',
    search:search?search.value:'',start:custom.start,end:custom.end,tab:alCurrentTab
  }));}catch(e){}
}

function alRestoreFilters(){
  var state={};
  try{state=JSON.parse(localStorage.getItem(alFilterStorageKey)||'{}')||{};}catch(e){state={};}
  var assign=function(id,value){var node=document.getElementById(id);if(node&&value!==undefined&&Array.from(node.options||[]).some(function(option){return option.value===value;}))node.value=value;};
  assign('al-filter-type',state.type||'all');assign('al-filter-level',state.level||'all');assign('al-filter-time',state.time||'all');
  var search=document.getElementById('al-search-input');if(search)search.value=state.search||'';
  var start=document.getElementById('al-date-start');if(start)start.value=state.start||'';
  var end=document.getElementById('al-date-end');if(end)end.value=state.end||'';
  alCurrentTab=state.tab&&['all','policy','tax','access','market','platform'].indexOf(state.tab)>=0?state.tab:'all';
  alSyncCustomRangeUi();
}

function alCustomRangeChange(){
  alCurrentPage=1;
  alValidateCustomRange();
  alPersistFilters();
  renderAlerts();
}

function alMatchesTimeFilter(value,timeFilter,nowValue){
  if(timeFilter==='all') return true;
  if(timeFilter==='custom'){
    var start=alLocalDay(arguments.length>3?arguments[3]:'');
    var end=alLocalDay(arguments.length>4?arguments[4]:'');
    var alertDay=alLocalDay(value);
    var currentDay=alLocalDay(nowValue instanceof Date?nowValue:new Date());
    if(!start||!end||!alertDay||!currentDay||start>end||start>currentDay||end>currentDay)return false;
    return alertDay>=start&&alertDay<=end;
  }
  var maxAge={today:0,'3d':2,'7d':6}[timeFilter];
  if(maxAge===undefined) return true;
  var diff=alCalendarDayDiff(value,nowValue);
  return diff!==null&&diff>=0&&diff<=maxAge;
}

function renderAlSummary(filtered){
  var all = Array.isArray(filtered)?filtered:getFilteredAlerts();
  var total=all.length;
  var high=all.filter(function(a){return a.level==='high'}).length;
  var latestDate=all.reduce(function(max,a){return a.date&&a.date>max?a.date:max;},'');
  var today=latestDate?all.filter(function(a){return a.date===latestDate}).length:0;
  var done=all.filter(function(a){return a.read}).length;
  var scopedDynamic = all.filter(function(a){return a.dynamic;});
  var dynCount = scopedDynamic.length;
  var el=document.getElementById('al-summary');
  el.innerHTML='<div class="al-summary-card sc-total"><div class="al-sc-label">筛选结果</div><div class="al-sc-val">'+total+'</div><div class="al-sc-sub">与当前列表一致</div></div>'
    +'<div class="al-summary-card sc-high"><div class="al-sc-label">高风险紧急</div><div class="al-sc-val">'+high+'</div><div class="al-sc-sub">需立即处理</div></div>'
    +'<div class="al-summary-card sc-today"><div class="al-sc-label">最新批次</div><div class="al-sc-val">'+today+'</div><div class="al-sc-sub">'+(latestDate||'暂无数据')+'</div></div>'
    +'<div class="al-summary-card sc-done"><div class="al-sc-label">已处理归档</div><div class="al-sc-val">'+done+'</div><div class="al-sc-sub">累计已处理</div></div>';
  // Add dynamic alert count banner
  var bannerHtml = '<div class="al-dyn-banner">'
    + '<span class="al-dyn-icon">↗</span>'
    + '<div class="al-dyn-text">'
    + '<b>范围联动预警</b>：基于当前市场政策与平台规则自动生成 <span class="al-dyn-count">' + dynCount + '</span> 条预警'
    + '（政策 ' + scopedDynamic.filter(function(a){return a.type==='policy'}).length + ' · 税收 ' + scopedDynamic.filter(function(a){return a.type==='tax'}).length + ' · 准入 ' + scopedDynamic.filter(function(a){return a.type==='access'}).length + ' · 平台规则 ' + scopedDynamic.filter(function(a){return a.type==='platform'}).length + '）'
    + '</div></div>';
  el.innerHTML = bannerHtml + el.innerHTML;
}

function renderAlTabs(){
  var tabs=[{k:'all',l:'全部'},{k:'policy',l:'政策'},{k:'tax',l:'税收'},{k:'access',l:'准入'},{k:'market',l:'市场'},{k:'platform',l:'平台规则'}];
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
      var customInvalid=document.getElementById('al-filter-time').value==='custom'&&!alValidateCustomRange();
      el.innerHTML='<div class="al-empty"><div class="al-empty-icon">🔍</div><h3>'+(customInvalid?'日期范围不完整':'未找到匹配的预警')+'</h3><p>'+(customInvalid?'请填写有效的开始和结束日期':'当前范围内没有符合这些条件的真实预警记录')+'</p></div>';
    }else if(alertsDataState==='error'){
      el.innerHTML='<div class="al-empty"><div class="al-empty-icon">!</div><h3>预警数据读取失败</h3><p>当前没有可展示的动态记录，请稍后刷新数据源</p></div>';
    }else{
      el.innerHTML='<div class="al-empty"><div class="al-empty-icon">○</div><h3>当前范围暂无预警</h3><p>尚未接入符合来源与验证要求的预警记录；不会使用其他市场或示例数据补位</p></div>';
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
    html+='<div class="al-card '+readCls+'" id="al-card-'+escapeHtml(id)+'">';
    html+='<div class="al-card-check"><input type="checkbox" '+checked+' onchange="alToggleSelect(\''+escInline(id)+'\',this.checked)"></div>';
    html+='<div class="al-card-icon type-'+type+'">'+icon+'</div>';
    html+='<div class="al-card-body">';
    html+='<div class="al-card-title">'+escapeHtml(title)+'</div>';
    html+='<div class="al-card-meta">';
    html+='<span class="meta-tag '+level+'">'+levelLabel+'</span>';
    html+='<span>'+typeLabel+'</span>';
    if(country&&country!=='-')html+='<span>📍 '+escapeHtml(country)+'</span>';
    if(platform&&platform!=='-')html+='<span>🛒 '+escapeHtml(platform)+'</span>';
    if(a.source)html+='<span>来源：'+escapeHtml(a.source)+'</span>';
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
  return escapeHtml(String(d||'')).replace(/(\+\d+\.?\d*%)/g,'<span class="val-up">$1</span>')
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

function alSwitchTab(tab){alCurrentTab=tab;alCurrentPage=1;alSelected.clear();alPersistFilters();renderAlerts();}
function alFilterChange(){alCurrentPage=1;alSyncCustomRangeUi();alPersistFilters();renderAlerts();}
function alSearch(){alCurrentPage=1;alPersistFilters();renderAlerts(); var al=document.getElementById('al-list'); if(al){ try{ jayHighlightMatches(al, ($('#al-search-input')||{}).value); }catch(e){} } }
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
    if(Array.isArray(alertsFull[i])&&alertsFull[i][0]===id){alertsFull[i][8]=true;break;}
    if(alertsFull[i]&&typeof alertsFull[i]==='object'&&alertsFull[i].id===id){alertsFull[i].read=true;break;}
  }
  alDynReadMap[id] = true;
  alSelected.delete(id);
  toast('已归档该预警');
  renderAlerts();
}
function alMarkAllRead(){
  var ids=new Set(getFilteredAlerts().map(function(a){return a.id;}));
  alertsFull.forEach(function(a){
    if(Array.isArray(a)&&ids.has(a[0]))a[8]=true;
    else if(a&&typeof a==='object'&&ids.has(a.id))a.read=true;
  });
  dynamicAlerts.forEach(function(a){if(ids.has(a.id))alDynReadMap[a.id]=true;});
  toast('已将当前筛选结果标为已读');
  renderAlerts();
}
function alBatchArchive(){
  alSelected.forEach(function(id){
    for(var i=0;i<alertsFull.length;i++){
      if(Array.isArray(alertsFull[i])&&alertsFull[i][0]===id){alertsFull[i][8]=true;break;}
      if(alertsFull[i]&&typeof alertsFull[i]==='object'&&alertsFull[i].id===id){alertsFull[i].read=true;break;}
    }
    alDynReadMap[id] = true;
  });
  var n=alSelected.size;
  alSelected.clear();
  toast('已批量归档 '+n+' 条预警');
  renderAlerts();
}
function alViewDetail(id){
  var all = getCombinedAlerts();
  var a = all.find(function(x){return x.id===id});
  if(!a)return;
  if(a.type==='shop'||a.type==='cat')switchPage('products');
  else if(a.type==='tax'&&typeof jayOpenPolicyFilter==='function')jayOpenPolicyFilter({domain:'tax'});
  else if(a.type==='access'&&typeof jayOpenPolicyFilter==='function')jayOpenPolicyFilter({domain:'access'});
  else if(a.type==='policy'&&typeof jayOpenPolicyFilter==='function')jayOpenPolicyFilter({domain:'policy'});
  else if(a.type==='market')switchPage('countries');
  else if(a.type==='platform'&&typeof jayOpenRulesFilter==='function')jayOpenRulesFilter({platform:a.platform||'all'});
  else switchPage('overview');
  toast('已跳转到'+alTypeLabels[a.type]+'板块');
}

function alAiAnalysis(id){
  var all = getCombinedAlerts();
  var a = all.find(function(x){return x.id===id});
  if(!a)return;
  var scopeName=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveMarketNames?window.JAY_MARKET_SCOPE_API.getActiveMarketNames().join('、'):'当前市场';
  var prompt='请基于这条'+scopeName+'市场预警的原始记录，给出不超过 120 字的影响、核验动作和下一步建议，并明确引用记录中的来源；禁止补造未提供的数字。\n标题：'+(a.title||'')+'\n类型：'+(a.type||'')+'\n平台：'+(a.platform||'')+'\n详情：'+(a.detail||'')+'\n来源：'+(a.source||'');
  if(typeof AI_ENGINE==='undefined'||!AI_ENGINE.hasKey()){ toast('当前没有可用的服务端 AI，暂不生成解读'); return; }
  toast('正在生成基于来源的 AI 解读…');
  callAI('你是跨境电商合规分析师。只根据给定预警记录作答，不得编造数字或来源。',prompt,{max_tokens:500,search:false})
    .then(function(text){ toast(text||'暂无可生成的解读'); })
    .catch(function(error){ toast(error&&error.message==='AUTH_REQUIRED'?'请登录后使用 AI 解读':'AI 解读暂不可用'); });
}

function alExport(){toast('预警报告导出功能需升级专业版');}

function updateAlBadge(filtered){
  var all = getCombinedAlerts();
  var unread = all.filter(function(a){return!a.read}).length;
  var resultCount=Array.isArray(filtered)?filtered.length:(document.getElementById('al-filter-type')?getFilteredAlerts().length:all.length);
  var badge=document.getElementById('al-unread-badge');
  if(badge){badge.textContent=resultCount;badge.style.display='inline-block';badge.title='当前筛选结果 '+resultCount+' 条';badge.setAttribute('aria-label','当前筛选结果 '+resultCount+' 条');}
  var navBadge=document.querySelector('.nav-item[data-page="alerts"] .nav-badge');
  if(navBadge){navBadge.textContent=unread;navBadge.style.display=unread>0?'inline-block':'none';}
}

// Hydrate the alert center from the scoped source as soon as the data layer is ready.
alRestoreFilters();
generateDynamicAlerts();
loadAlertsData();



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
function stApplySettingsPrefs(){
  var workspace=jayPreferenceCache.workspace_prefs||{};
  var currency=workspace.currency||'cny';var unit=workspace.unit||'wan';
  var cny=document.getElementById('st-currency-cny');var usd=document.getElementById('st-currency-usd');
  if(cny)cny.className='st-btn st-btn-sm '+(currency==='cny'?'st-btn-primary':'st-btn-outline');
  if(usd)usd.className='st-btn st-btn-sm '+(currency==='usd'?'st-btn-primary':'st-btn-outline');
  var wan=document.getElementById('st-unit-wan');var mil=document.getElementById('st-unit-m');
  if(wan)wan.className='st-btn st-btn-sm '+(unit==='wan'?'st-btn-primary':'st-btn-outline');
  if(mil)mil.className='st-btn st-btn-sm '+(unit==='m'?'st-btn-primary':'st-btn-outline');
}
function stInitSystemStatus(){
  var auth=document.getElementById('st-system-auth');if(auth)auth.textContent=jayIsDemo?'只读演示':(jayUser?'已连接':'未登录');
  var authDot=document.getElementById('st-system-auth-dot');if(authDot)authDot.style.background=(!jayIsDemo&&jayUser)?'#27ae60':'#94a3b8';
  var quality=document.getElementById('st-system-quality');
  var status=typeof jayQualityStatus==='function'?jayQualityStatus(JAY_QUALITY_REPORT):'pending';
  if(quality)quality.textContent={healthy:'数据实时',degraded:'部分降级',not_connected:'尚未接入',stale:'数据过期',failed:'校验失败',pending:'读取中'}[status]||'读取中';
  var qualityDot=document.getElementById('st-system-quality-dot');if(qualityDot)qualityDot.style.background=(status==='healthy'?'#27ae60':(['degraded','not_connected'].indexOf(status)>=0?'#e8a33d':(status==='pending'?'#94a3b8':'#e25555')));
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
    if(type==='report')return '<div class="admin-row"><strong>'+stTeamEsc((row.status||'-')+' · '+(row.purpose||'报告')+' · '+(row.report_id||row.client_report_id||'-'))+'</strong><small>'+stTeamEsc('用户 '+(row.user_id||'-')+' · 数据 '+(row.data_version||'-')+' · '+(row.duration_ms==null?'耗时待记录':Math.round(Number(row.duration_ms)/1000)+' 秒')+(row.error_code?' · '+row.error_code:'')+' · '+stTeamDate(row.started_at))+'</small></div>';
    if(type==='ai')return '<div class="admin-row"><strong>'+stTeamEsc((row.status||'-')+' · '+(row.operation||'AI 请求')+' · '+(row.model||'-'))+'</strong><small>'+stTeamEsc('用户 '+(row.user_id||'-')+' · '+Number(row.total_tokens||0)+' Token · $'+Number(row.estimated_cost_usd||0).toFixed(6)+' · '+Number(row.duration_ms||0)+' ms'+(row.error_code?' · '+row.error_code:'')+' · '+stTeamDate(row.created_at))+'</small></div>';
    return '<div class="admin-row"><strong>'+stTeamEsc((row.backup_type||'backup')+' · '+(row.status||'-'))+'</strong><small>'+stTeamEsc((row.location||'未记录位置')+' · '+stTeamDate(row.completed_at||row.started_at))+'</small></div>';
  }).join('');
}
async function adminLoad(){
  var note=document.getElementById('admin-access-note');var content=document.getElementById('admin-content');
  if(note){note.style.display='block';note.textContent='正在校验管理员权限…';}if(content)content.style.display='none';
  if(jayIsDemo){if(note)note.textContent='只读演示不加载管理数据。';return}
  try{
    var data=await jayLoadAdminSummary();var counts=data.counts||{},metrics=data.metrics||{};
    if(note)note.style.display='none';if(content)content.style.display='block';
    adminSetText('admin-users',counts.users);adminSetText('admin-subs',counts.subscriptions);adminSetText('admin-workspaces',counts.workspaces);adminSetText('admin-incidents-count',counts.open_incidents);adminSetText('admin-deliveries',counts.pending_deliveries);
    adminSetText('admin-report-failure',Math.round(Number(metrics.report_failure_rate||0)*100)+'%');adminSetText('admin-ai-tokens',Number(metrics.total_tokens||0).toLocaleString('zh-CN'));adminSetText('admin-ai-cost','$'+Number(metrics.estimated_ai_cost_usd||0).toFixed(4));adminSetText('admin-report-duration',Number(metrics.average_report_duration_ms||0)?Math.round(Number(metrics.average_report_duration_ms)/1000)+'秒':'--');adminSetText('admin-export-failures',metrics.failed_exports||0);
    var reportRuns=document.getElementById('admin-report-runs');if(reportRuns)reportRuns.innerHTML=adminRenderRows(data.report_runs,'report');
    var aiRequests=document.getElementById('admin-ai-requests');if(aiRequests)aiRequests.innerHTML=adminRenderRows(data.ai_requests,'ai');
    var incidents=document.getElementById('admin-incidents');if(incidents)incidents.innerHTML=adminRenderRows(data.incidents,'incident');
    var backups=document.getElementById('admin-backups');if(backups)backups.innerHTML=adminRenderRows(data.backups,'backup');
    var generated=document.getElementById('admin-generated');if(generated)generated.textContent='管理员角色：'+(data.role||'-')+' · 更新时间 '+(data.generated_at?new Date(data.generated_at).toLocaleString('zh-CN'):'-');
  }catch(error){
    if(note)note.textContent=window.jayServiceErrorText?window.jayServiceErrorText(error):(error.message==='ADMIN_FORBIDDEN'?'当前账号不是平台管理员。':('管理后台不可用：'+(error.message||'请检查服务配置')));
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
    { key:'countries', label:'国家市场',    stampId:null },
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
      if(key==='countries'){
        countryDataSource = data && typeof data==='object' ? data : {};
        if(typeof jayApplyCountryDataScope==='function')jayApplyCountryDataScope();
      }
      else if(key==='platforms'){
        if(Array.isArray(data)){ var scopedPlatformRecords=(window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.filterPlatforms)?window.JAY_MARKET_SCOPE_API.filterPlatforms(data,function(d){return d&&d.name;}):data; platformsData=scopedPlatformRecords.map(function(d){var name=(window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.normalizePlatform)?window.JAY_MARKET_SCOPE_API.normalizePlatform(d.name):d.name;return [name||'',d.region||'',d.categories||'',d.gmv||'',d.fee||'',d.feeDesc||'',d.type||'',d.mau||'',d.updates||''];}); var _staticPfExt=pfExtData; pfExtData={}; Object.keys(_staticPfExt||{}).forEach(function(k){ pfExtData[k]=_staticPfExt[k]; }); scopedPlatformRecords.forEach(function(d){ if(d.ext&&Object.keys(d.ext).length){ var key=(window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.normalizePlatform)?window.JAY_MARKET_SCOPE_API.normalizePlatform(d.name):d.name; pfExtData[key]=Object.assign({}, pfExtData[key]||{}, d.ext); } }); fillSelect('#pf-f-region',[...new Set(platformsData.map(function(p){return p[1];}))].sort()); fillSelect('#pf-f-type',[...new Set(platformsData.map(function(p){return p[6];}))].sort()); }
      }
      else if(key==='rules'){ rulesJsonData=data; if(typeof rlInitFromJson==='function') rlInitFromJson(); }
      else if(key==='policies'){ policiesJsonData=data; policiesDataState='ready'; if(typeof plInitFromJson==='function') plInitFromJson(); }
      else if(key==='alerts'){ replaceScopedAlertData(data); alertsDataLoaded=true; alertsDataState='ready'; if(typeof refreshDynamicAlerts==='function') refreshDynamicAlerts(); if(typeof renderAlerts==='function') renderAlerts(); }
      if(key==='platforms') syncPlatformScopeUi();
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

  function jaySetStamp(def, txt){ if(!def.stampId)return; var el=document.getElementById(def.stampId); if(el) el.innerHTML=txt; }
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

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', function(){ syncPlatformScopeUi(); jayStartRefreshScheduler(); }); }
  else { syncPlatformScopeUi(); jayStartRefreshScheduler(); }
})();

if(window.addEventListener) window.addEventListener('jay:market-scope-change', function(){
  syncPlatformScopeUi();
  if(typeof refreshDynamicAlerts==='function')refreshDynamicAlerts();
  if(typeof renderAlerts==='function')renderAlerts();
});
