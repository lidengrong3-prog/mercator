// === Countries Page v2 - Full Rebuild ===
// === Dynamic Country Data Loading ===
var countryDataLoaded = false;
var countryDataSource = {};
var countryDataLoading = false;
function jayApplyCountryDataScope(){
  var api=window.JAY_MARKET_SCOPE_API;
  var activeCodes=api&&api.getActiveMarkets ? api.getActiveMarkets().map(function(m){return m.code;}) : ['US'];
  var scoped={};
  Object.keys(countryDataSource||{}).forEach(function(key){
    var code=api&&api.normalizeMarketCode?api.normalizeMarketCode(key):String(key||'').toUpperCase();
    var market=api&&api.getMarket?api.getMarket(code):null;
    var status=market&&market.dataStatus;
    // A raw country payload is retained for later verification, but only
    // explicitly verified or user-uploaded market records enter formal pages.
    if(activeCodes.indexOf(code)>=0 && (!status || status==='verified' || status==='uploaded'))scoped[key]=countryDataSource[key];
  });
  countryFullData=scoped;
  window.countryFullData=countryFullData;
  countryDataLoaded=Object.keys(scoped).length>0;
}
async function loadCountryData(){
  // This module is loaded before auth-data.js, which owns the shared data
  // loader. Retry after the remaining defer scripts have initialized it.
  if(countryDataLoading)return;
  if(typeof jayFetchMarketData!=='function'){
    setTimeout(loadCountryData,0);
    return;
  }
  countryDataLoading = true;
  try {
    var data = await jayFetchMarketData('countries', './data/countries.json');
    if(!data) throw new Error('Failed to load country data');
    if(data && typeof data === 'object' && Object.keys(data).length > 0){
      // Keep the raw keyed source in memory, then expose only configured
      // markets to pages and search. Future markets can be registered without
      // changing this loader or copying US records into their scope.
      var cleaned = {};
      for(var k in data){
        if(!Object.prototype.hasOwnProperty.call(data,k) || !data[k] || typeof data[k] !== 'object') continue;
        // Keep any directory key that can later be resolved by the shared
        // market catalog; do not assume every future jurisdiction is ISO-2.
        var market = window.JAY_MARKET_SCOPE_API && window.JAY_MARKET_SCOPE_API.getMarket
          ? window.JAY_MARKET_SCOPE_API.getMarket(k) : null;
        if(market || data[k].flag) cleaned[String(k).toLowerCase()] = data[k];
      }
      countryDataSource = cleaned;
      jayApplyCountryDataScope();
      console.log('Country data loaded from countries.json');
      // Refresh alerts linkage
      if(typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
      // Rebuild real-data search index once country data is in
      if(typeof jayRebuildSearch === 'function') jayRebuildSearch();
    } else {
      throw new Error('Empty data');
    }
  } catch(e){
    countryFullData = {};
    countryDataSource = {};
    countryDataLoaded = false;
    console.error('Failed to load countries.json; country records remain empty:', e);
  } finally {
    countryDataLoading = false;
  }
}
loadCountryData();

var countryCommerceCache = {};
var countryCommerceStateByCode = {};
var countryCommerceRequestId = 0;

var jayCommerceSlotDefinitions = {
  ecommerce_sales:{label:'电商零售总额',purpose:'判断线上市场容量'},
  ecommerce_penetration:{label:'电商渗透率',purpose:'判断线上消费成熟度'},
  retail_sales:{label:'社会零售规模',purpose:'判断整体商品消费基础'},
  online_shoppers:{label:'线上消费者规模',purpose:'判断可触达买家数量'},
  disposable_income:{label:'实际可支配收入',purpose:'判断消费者购买力'},
  consumer_confidence:{label:'消费者信心',purpose:'判断短期消费意愿'},
  consumer_spending:{label:'实际消费支出',purpose:'判断商品需求变化'},
  inflation:{label:'消费价格水平',purpose:'判断价格敏感度与提价空间'},
  exchange_rate:{label:'目标市场汇率',purpose:'判断定价与回款风险'},
  cross_border_imports:{label:'跨境进口规模',purpose:'判断海外商品接受度'},
  logistics_cost:{label:'跨境物流成本',purpose:'判断履约成本压力'},
};

function jayCountryCommerceSource(market){
  market=market||{};
  var metadata=market.metadata&&typeof market.metadata==='object'?market.metadata:{};
  var sources=market.dataSources||market.data_sources||metadata.dataSources||metadata.data_sources||{};
  var source=sources&&sources.macro;
  if(typeof source==='string')return {localPath:source};
  return source&&typeof source==='object'?source:null;
}

function jayCountryCommerceUrl(source){
  if(!source)return '';
  var raw=String(source.localPath||source.local_path||source.url||'').trim();
  if(!raw)return '';
  try{
    var resolved=new URL(raw,document.baseURI);
    return resolved.protocol==='http:'||resolved.protocol==='https:'?resolved.href:'';
  }catch(e){return '';}
}

function jayValidCommerceSourceUrl(value){
  return !!(typeof jaySafeHttpsUrl==='function'&&jaySafeHttpsUrl(value));
}

function jayValidCommerceDate(value){
  var raw=String(value||'').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw)&&!isNaN(new Date(raw+'T00:00:00Z').getTime());
}

function jayCommerceRows(payload,market,sourceConfig){
  var api=window.JAY_MARKET_SCOPE_API;
  var indicators=payload&&payload.indicators;
  var meta=payload&&payload.meta&&typeof payload.meta==='object'?payload.meta:{};
  var entries=[];
  if(Array.isArray(indicators)){
    entries=indicators.map(function(item,index){return [item&&item.code||item&&item.id||String(index+1),item];});
  }else if(indicators&&typeof indicators==='object'){
    entries=Object.keys(indicators).map(function(key){return [key,indicators[key]];});
  }
  return entries.map(function(entry){
    var item=entry[1];
    if(!item||typeof item!=='object'||!String(item.name||'').trim())return null;
    var date=String(item.date||item.published_at||'').trim();
    var sourceUrl=String(item.source_url||item.sourceUrl||'').trim();
    if(!jayValidCommerceDate(date)||!jayValidCommerceSourceUrl(sourceUrl))return null;
    var record=Object.assign({},item,{
      record_key:String(entry[0]),
      market_code:market.code,
      source_kind:item.source_kind||item.sourceKind||sourceConfig.source_kind||sourceConfig.sourceKind,
      source_type:item.source_type||item.sourceType||sourceConfig.source_type||sourceConfig.sourceType||'official_feed',
      source_url:sourceUrl,
      collected_at:item.collected_at||item.collectedAt||meta.generated_at||null,
      published_at:item.published_at||item.publishedAt||date,
    });
    var normalized=api&&api.normalizeDataRecord?api.normalizeDataRecord(record,'market'):record;
    var quality=api&&api.getRecordQuality?api.getRecordQuality(normalized,{domain:'market'}):{formal:true};
    if(!quality.formal)return null;
    return {
      code:String(entry[0]),
      name:String(item.name),
      value:item.value,
      unit:String(item.unit||''),
      date:date,
      source:String(item.source||'原始来源'),
      sourceUrl:sourceUrl,
      verificationStatus:normalized.verification_status||'verified',
    };
  }).filter(Boolean);
}

function jayFormatCommerceValue(value){
  var raw=String(value===undefined||value===null?'':value).trim();
  if(!raw)return '-';
  var number=Number(raw);
  if(!isFinite(number))return raw;
  return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:3}).format(number);
}

function jayFormatCommerceTimestamp(value){
  var date=new Date(value||'');
  if(isNaN(date.getTime()))return '';
  return date.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
}

function jayRefreshCommerceIcons(){
  if(window.lucide&&typeof window.lucide.createIcons==='function')window.lucide.createIcons();
}

function jayCommerceProfile(sourceConfig){
  sourceConfig=sourceConfig||{};
  var profile=sourceConfig.commerceProfile||sourceConfig.commerce_profile||{};
  return {
    indicatorMap:profile.indicatorMap||profile.indicator_map||{},
    categoryIndicatorMap:profile.categoryIndicatorMap||profile.category_indicator_map||{},
    backgroundCodes:profile.backgroundCodes||profile.background_codes||[],
  };
}

function jayCommerceRowMap(rows){
  var result={};
  (rows||[]).forEach(function(row){result[row.code]=row;});
  return result;
}

function jayCommerceMetricCard(slot,row,dataStatus){
  var definition=jayCommerceSlotDefinitions[slot]||{label:slot,purpose:'电商决策参考'};
  if(!row){
    var missingStatus=dataStatus==='error'?'error':'not-connected';
    var missingLabel=missingStatus==='error'?'数据源读取失败':'尚未接入';
    var missingDetail=missingStatus==='error'?'数据源读取失败，暂不提供该指标':'该市场尚未接入经过来源校验的数据';
    return '<article class="country-commerce-metric is-missing'+(missingStatus==='error'?' is-error':'')+'" data-slot="'+escapeHtml(slot)+'" data-data-status="'+missingStatus+'">'+
      '<div class="country-commerce-metric-top"><span>'+missingLabel+'</span><i data-lucide="circle-dashed"></i></div>'+
      '<h5>'+escapeHtml(definition.label)+'</h5><p>'+escapeHtml(definition.purpose)+'</p>'+
      '<strong>'+missingDetail+'</strong></article>';
  }
  return '<article class="country-commerce-metric has-data" data-slot="'+escapeHtml(slot)+'" data-data-status="ready">'+
    '<div class="country-commerce-metric-top"><span>'+escapeHtml(row.name)+'</span><time datetime="'+escapeHtml(row.date)+'">'+escapeHtml(row.date)+'</time></div>'+
    '<h5>'+escapeHtml(definition.label)+'</h5><p>'+escapeHtml(definition.purpose)+'</p>'+
    '<div class="country-commerce-value"><b>'+escapeHtml(jayFormatCommerceValue(row.value))+'</b><span>'+escapeHtml(row.unit)+'</span></div>'+
    '<a href="'+escapeHtml(row.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(row.source)+'<i data-lucide="external-link"></i></a></article>';
}

function jayCommerceCategoryCard(row){
  return '<article class="country-commerce-metric has-data" data-slot="'+escapeHtml(row.code)+'">'+
    '<div class="country-commerce-metric-top"><span>官方品类零售（线上线下）</span><time datetime="'+escapeHtml(row.date)+'">'+escapeHtml(row.date)+'</time></div>'+
    '<h5>'+escapeHtml(row.name)+'</h5><p>用于判断品类需求，不代表电商渠道销售额</p>'+
    '<div class="country-commerce-value"><b>'+escapeHtml(jayFormatCommerceValue(row.value))+'</b><span>'+escapeHtml(row.unit)+'</span></div>'+
    '<a href="'+escapeHtml(row.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(row.source)+'<i data-lucide="external-link"></i></a></article>';
}

function jayCommerceMetricSection(id,title,description,slots,indicatorMap,rowMap,dataStatus){
  return '<section class="country-commerce-section" data-commerce-section="'+escapeHtml(id)+'">'+
    '<div class="country-commerce-section-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div></div>'+
    '<div class="country-commerce-grid">'+slots.map(function(slot){return jayCommerceMetricCard(slot,rowMap[indicatorMap[slot]]||null,dataStatus);}).join('')+'</div></section>';
}

function jayCommerceCategorySection(api,profile,rowMap){
  var context=api&&api.getActiveContext?api.getActiveContext():{categoryCodes:[]};
  var code=context.categoryCodes&&context.categoryCodes.length===1?context.categoryCodes[0]:'';
  var category=code&&api&&api.getCategoryProfile?api.getCategoryProfile(code):null;
  var name=category&&(category.name||category.code)||'';
  var codes=code?(profile.categoryIndicatorMap[code]||[]):[];
  if(!Array.isArray(codes))codes=codes?[codes]:[];
  var matched=codes.map(function(item){return rowMap[item];}).filter(Boolean);
  var body='';
  if(!code){
    body='<div class="country-commerce-section-empty"><i data-lucide="list-filter"></i><div><strong>请选择具体品类</strong><p>选择服装、电子产品、美妆或宠物食品后，显示该品类的官方零售与需求指标。</p></div></div>';
  }else if(!matched.length){
    body='<div class="country-commerce-section-empty"><i data-lucide="database-zap"></i><div><strong>'+escapeHtml(name)+'暂无已验证品类数据</strong><p>不会使用通用零售数据替代该品类数据。</p></div></div>';
  }else{
    body='<div class="country-commerce-grid">'+matched.map(jayCommerceCategoryCard).join('')+'</div>';
  }
  return '<section class="country-commerce-section" data-commerce-section="category"><div class="country-commerce-section-head"><div><h4>当前品类表现'+(name?' · '+escapeHtml(name):'')+'</h4><p>只展示当前国家与所选品类直接对应的数据</p></div></div>'+body+'</section>';
}

function jayCommerceBackground(profile,rowMap){
  var rows=(profile.backgroundCodes||[]).map(function(code){return rowMap[code];}).filter(Boolean);
  if(!rows.length)return '';
  return '<details class="country-commerce-background"><summary><span><b>辅助经济背景</b><small>默认折叠，不进入电商核心指标统计</small></span><i data-lucide="chevron-down"></i></summary>'+
    '<div class="country-commerce-background-grid">'+rows.map(function(row){return '<div><span>'+escapeHtml(row.name)+'</span><b>'+escapeHtml(jayFormatCommerceValue(row.value))+' <small>'+escapeHtml(row.unit)+'</small></b><time>'+escapeHtml(row.date)+'</time></div>';}).join('')+'</div></details>';
}

function jayCommerceActionBand(market){
  var api=window.JAY_MARKET_SCOPE_API;
  var platforms=api&&api.getActivePlatforms?api.getActivePlatforms().map(function(item){return item.name||item.key;}):[];
  return '<section class="country-commerce-section country-commerce-links" data-commerce-section="channels"><div class="country-commerce-section-head"><div><h4>渠道、政策与风险入口</h4><p>'+
    escapeHtml(platforms.length?'当前接入平台：'+platforms.join('、'):'当前市场尚未配置平台')+'</p></div></div><div class="country-commerce-link-grid">'+
    '<button type="button" data-commerce-page="policies"><i data-lucide="landmark"></i><span><b>政策与税费</b><small>查看已验证政策及准入变化</small></span><i data-lucide="arrow-right"></i></button>'+
    '<button type="button" data-commerce-page="platforms"><i data-lucide="store"></i><span><b>平台与规则</b><small>查看当前市场可用平台</small></span><i data-lucide="arrow-right"></i></button>'+
    '<button type="button" data-commerce-page="alerts"><i data-lucide="triangle-alert"></i><span><b>风险预警</b><small>查看当前市场动态风险</small></span><i data-lucide="arrow-right"></i></button>'+
    '</div></section>';
}

function jayBindCommerceActions(){
  document.querySelectorAll('#country-commerce-content [data-commerce-page]').forEach(function(button){
    button.onclick=function(){
      var page=button.dataset.commercePage;
      if(page==='policies'&&typeof jayOpenPolicyFilter==='function')jayOpenPolicyFilter({category:'all',impact:'all',scope:'cross-border'});
      else if(typeof switchPage==='function')switchPage(page);
    };
  });
}

function jayRenderCountryCommerce(market,payload,rows,status,message){
  var panel=$('#country-commerce-status');
  var title=$('#country-commerce-title');
  var meta=$('#country-commerce-meta');
  var count=$('#country-commerce-count');
  var content=$('#country-commerce-content');
  if(!panel||!title||!meta||!count||!content)return;
  var api=window.JAY_MARKET_SCOPE_API;
  var marketName=market.name||market.label||market.code;
  var sourceConfig=jayCountryCommerceSource(market)||{};
  var profile=jayCommerceProfile(sourceConfig);
  var rowMap=jayCommerceRowMap(rows);
  var coreSlots=['ecommerce_sales','ecommerce_penetration','retail_sales','online_shoppers'];
  var demandSlots=['disposable_income','consumer_confidence','consumer_spending','inflation'];
  var operationSlots=['exchange_rate','cross_border_imports','logistics_cost'];
  var selectedCodes=[];
  coreSlots.concat(demandSlots,operationSlots).forEach(function(slot){var code=profile.indicatorMap[slot];if(code&&rowMap[code]&&selectedCodes.indexOf(code)<0)selectedCodes.push(code);});
  var context=api&&api.getActiveContext?api.getActiveContext():{categoryCodes:[]};
  if(context.categoryCodes&&context.categoryCodes.length===1){
    var categoryCodes=profile.categoryIndicatorMap[context.categoryCodes[0]]||[];
    if(!Array.isArray(categoryCodes))categoryCodes=[categoryCodes];
    categoryCodes.forEach(function(code){if(rowMap[code]&&selectedCodes.indexOf(code)<0)selectedCodes.push(code);});
  }
  var generated=jayFormatCommerceTimestamp(payload&&payload.meta&&payload.meta.generated_at);
  var normalizedStatus=status==='ready'&&selectedCodes.length?'ready':(status==='error'?'error':'not-connected');
  panel.className='country-commerce-panel '+(normalizedStatus==='error'?'is-error':normalizedStatus==='ready'?'has-data':'is-empty');
  panel.dataset.dataStatus=normalizedStatus;
  title.textContent=marketName+'电商市场环境';
  meta.textContent=(message?message+' · ':'')+(generated?'数据集更新于 '+generated+' · ':'')+'每项已接入指标均保留原始来源和数据日期';
  count.textContent=selectedCodes.length+' 项已接入';
  content.innerHTML=
    jayCommerceMetricSection('market-size','电商市场规模','判断线上市场容量、增长基础和成熟度',coreSlots,profile.indicatorMap,rowMap,normalizedStatus)+
    jayCommerceMetricSection('demand','消费需求与购买力','判断消费者是否愿意买、能否承担当前价格',demandSlots,profile.indicatorMap,rowMap,normalizedStatus)+
    jayCommerceCategorySection(api,profile,rowMap)+
    jayCommerceMetricSection('operations','跨境经营环境','判断定价、进口空间和履约成本',operationSlots,profile.indicatorMap,rowMap,normalizedStatus)+
    jayCommerceActionBand(market)+jayCommerceBackground(profile,rowMap);
  countryCommerceStateByCode[market.code]={status:normalizedStatus,count:selectedCodes.length,rows:rows.slice(),updatedAt:payload&&payload.meta&&payload.meta.generated_at||null};
  jayBindCommerceActions();
  jayRefreshCommerceIcons();
  if(typeof renderOvCountries==='function')renderOvCountries();
}

function jayRenderCountryCommerceLoading(market){
  var panel=$('#country-commerce-status');
  var title=$('#country-commerce-title');
  var meta=$('#country-commerce-meta');
  var count=$('#country-commerce-count');
  var content=$('#country-commerce-content');
  if(!panel||!title||!meta||!count||!content)return;
  var marketName=market.name||market.label||market.code;
  panel.className='country-commerce-panel is-loading';
  panel.dataset.dataStatus='loading';
  title.textContent='正在读取'+marketName+'电商市场环境';
  meta.textContent='仅展示与电商决策直接相关且通过来源校验的数据';
  count.textContent='加载中';
  content.innerHTML='<div class="country-commerce-empty"><i data-lucide="loader-circle"></i><strong>正在加载数据</strong></div>';
  countryCommerceStateByCode[market.code]={status:'loading',count:0,rows:[]};
  jayRefreshCommerceIcons();
}

async function loadCountryCommerceData(){
  var api=window.JAY_MARKET_SCOPE_API;
  var market=api&&api.getPrimaryMarket?api.getPrimaryMarket():null;
  if(!market)return;
  var requestId=++countryCommerceRequestId;
  var sourceConfig=jayCountryCommerceSource(market);
  var sourceUrl=jayCountryCommerceUrl(sourceConfig);
  if(!sourceUrl){
    jayRenderCountryCommerce(market,null,[],'not-connected','该市场尚未接入可追溯的电商环境数据源');
    return;
  }
  var cacheKey=market.code+'|'+sourceUrl;
  if(countryCommerceCache[cacheKey]){
    var cached=countryCommerceCache[cacheKey];
    jayRenderCountryCommerce(market,cached.payload,cached.rows,cached.rows.length?'ready':'not-connected',cached.rows.length?'':'该市场尚未接入可发布记录');
    return;
  }
  jayRenderCountryCommerceLoading(market);
  try{
    var response=await fetch(sourceUrl,{cache:'no-store'});
    if(!response.ok)throw new Error('commerce environment data '+response.status);
    var payload=await response.json();
    var rows=jayCommerceRows(payload,market,sourceConfig||{});
    if(requestId!==countryCommerceRequestId)return;
    countryCommerceCache[cacheKey]={payload:payload,rows:rows};
    jayRenderCountryCommerce(market,payload,rows,rows.length?'ready':'not-connected',rows.length?'':'该市场尚未接入可发布记录');
  }catch(e){
    if(requestId!==countryCommerceRequestId)return;
    console.error('Failed to load commerce environment data for '+market.code+':',e);
    jayRenderCountryCommerce(market,null,[],'error','数据源读取失败，未显示缓存估算或其他国家数据');
  }
}

window.jayGetCountryCommerceState=function(code){
  var api=window.JAY_MARKET_SCOPE_API;
  var normalized=api&&api.normalizeMarketCode?api.normalizeMarketCode(code):String(code||'').toUpperCase();
  return countryCommerceStateByCode[normalized]||{status:'idle',count:0,rows:[]};
};
window.loadCountryCommerceData=loadCountryCommerceData;
loadCountryCommerceData();

if(window.addEventListener) window.addEventListener('jay:market-scope-change', function(){
  jayApplyCountryDataScope();
  loadCountryCommerceData();
  if(typeof jayRebuildSearch==='function')jayRebuildSearch();
});

// Remove old renderCountry default call
// renderCountry('id'); -- disabled


// === 新增页面：渲染函数 ===
function fillSelect(id,items,labels){
  const sel=$(id); if(!sel) return;
  const first=sel.options[0];
  sel.innerHTML='';
  if(first) sel.appendChild(first);
  items.forEach(function(i){
    const o=document.createElement('option');
    o.value=i;
    o.textContent=labels && labels[i] ? labels[i] : i;
    sel.appendChild(o);
  });
}


// -- 平台档案 --
 // Platform cards live in index.html. Their verified rule counts are populated
 // after the scoped rules dataset finishes loading.
 function renderPlatformProfileStatus(){
   var cards=document.querySelectorAll('#platforms .platform-card[data-platform]');
   if(!cards.length) return;
   var items=typeof rlGetJsonItems==='function'?rlGetJsonItems():[];
   cards.forEach(function(card){
     var name=card.dataset.platform;
     var count=items.filter(function(item){return item.platform===name;}).length;
     var value=card.querySelector('[data-platform-status] b');
     if(value) value.textContent=count ? count+' 条' : '暂无已验证数据';
   });
 }
 window.renderPlatformProfileStatus=renderPlatformProfileStatus;
// -- 宏观经济 (disabled, merged into countries) --
// macroData array kept for future integration into countries page
// renderMacro, fillSelect, onclick removed - section no longer exists


// -- 政策动态 (Full Rebuild) -- JSON dynamic loading
var policiesJsonData = { updated_at:null, source_count:0, items:[] };
var taxesJsonData = { updated_at:null, source_count:0, items:[] };
var accessRequirementsJsonData = { updated_at:null, source_count:0, items:[] };
var plActiveDomain = 'policy';
var policiesDataLoading = false;
var policiesDataState = 'loading';

async function loadPoliciesData() {
  if (policiesDataLoading) return;
  // markets-policies.js is loaded before auth-data.js. Wait for the shared
  // data-layer helper so the policy page can use the shared Supabase/JSON path.
  if (typeof jayFetchMarketData !== 'function') {
    setTimeout(loadPoliciesData, 0);
    return;
  }
  policiesDataLoading = true;
  policiesDataState = 'loading';
  $('#pl-data-info').innerHTML = '<span style="color:#3366cc">⏳ 正在加载最新数据...</span>';
  try {
    const results = await Promise.all([
      jayFetchMarketData('policies', './data/policies.json'),
      jayFetchMarketData('taxes', './data/taxes.json'),
      jayFetchMarketData('access_requirements', './data/access_requirements.json')
    ]);
    const data=results[0], taxData=results[1], accessData=results[2];
    if (!data) throw new Error('Failed to load policies data');
    if (data && data.items && data.items.length > 0) {
      policiesJsonData = data;
      taxesJsonData = taxData && Array.isArray(taxData.items) ? taxData : {updated_at:null,source_count:0,items:[]};
      accessRequirementsJsonData = accessData && Array.isArray(accessData.items) ? accessData : {updated_at:null,source_count:0,items:[]};
      policiesDataState = 'ready';
      plInitFromJson();
      if(typeof renderOverviewMetrics==='function') renderOverviewMetrics();
      plRenderDataInfo();
      // Refresh alerts linkage
      if (typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
    } else {
      throw new Error('Empty data');
    }
  } catch (e) {
    console.error('Failed to load policies.json; policy records remain empty:', e);
    policiesJsonData = { updated_at:null, source_count:0, items:[] };
    taxesJsonData = { updated_at:null, source_count:0, items:[] };
    accessRequirementsJsonData = { updated_at:null, source_count:0, items:[] };
    policiesDataState = 'error';
    plInitFromJson();
    if(typeof renderOverviewMetrics==='function') renderOverviewMetrics();
    $('#pl-data-info').innerHTML = '数据加载失败，当前没有可发布的市场政策记录';
  }
  policiesDataLoading = false;
  if(typeof jayRebuildSearch==='function')jayRebuildSearch();
  if(typeof renderDecisionOverview==='function')renderDecisionOverview();
}

const plCategoryLabels = {
  tax_trade:'税收与关税', tariff:'关税调整', tax:'税务新规', certification:'进口认证', compliance:'电商合规',
  ban:'进出口禁令', regulation:'监管合规', product_safety:'产品安全', data_privacy:'数据隐私',
  intellectual_property:'知识产权', anti_dumping:'反倾销/反补贴', foreign_exchange:'外汇管制',
  customs:'清关报关', investment:'外资准入', trade_agreement:'贸易协定', subsidy:'补贴扶持',
  labor:'劳工环保', e_commerce:'数字经济', other:'其他'
};
const plTaxTypeLabels = {
  customs_duty:'关税', vat:'增值税', sales_tax:'销售税',
  marketplace_collection:'平台代扣税', import_fee:'进口费用'
};
const plAccessTypeLabels = {
  certification:'认证', labeling:'标签', packaging:'包装', registration:'注册',
  intellectual_property:'知识产权', import_requirement:'进口要求'
};
const plDomainLabels = {
  policy:{label:'政策法规',countLabel:'政策',empty:'当前市场暂无已验证且完成中文转换的政策记录'},
  tax:{label:'税收费用',countLabel:'税收记录',empty:'当前市场税收数据尚未接入'},
  access:{label:'市场准入',countLabel:'准入条件',empty:'当前市场准入条件尚未接入'}
};
const plRegionLabels = {
  US:'美国', EU:'欧洲', SEA:'东南亚', MEA:'中东', LATAM:'拉美', SAS:'南亚',
  AFR:'非洲', EA:'东亚（日韩）', OCE:'大洋洲', CIS:'独联体', Global:'全球'
};
const plRegionCodeByName = {
  '东南亚':'SEA','北美':'US','美国':'US','欧洲':'EU','中东':'MEA','拉美':'LATAM','南亚':'SAS',
  '非洲':'AFR','日韩':'EA','澳洲':'OCE','独联体':'CIS'
};
const plImpactLabels = {high:'高', medium:'中', low:'低'};
function plConfiguredMarketCodes(){
  var api=window.JAY_MARKET_SCOPE_API;
  return api&&typeof api.getActiveMarkets==='function' ? api.getActiveMarkets().map(function(m){return m.code;}) : ['US'];
}
function plConfiguredMarketNames(){
  var api=window.JAY_MARKET_SCOPE_API;
  return api&&typeof api.getActiveMarketNames==='function' ? api.getActiveMarketNames() : ['美国'];
}
function plMarketLabel(code){
  var api=window.JAY_MARKET_SCOPE_API;
  var market=api&&api.getMarket?api.getMarket(code):null;
  return market ? (market.name||market.label||code) : (plRegionLabels[code]||code);
}

function plDomainData(domain){
  if(domain==='tax')return taxesJsonData;
  if(domain==='access')return accessRequirementsJsonData;
  return policiesJsonData;
}
function plDomainCategoryLabels(domain){
  if(domain==='tax')return plTaxTypeLabels;
  if(domain==='access')return plAccessTypeLabels;
  return plCategoryLabels;
}
function plDomainTypeValue(item,domain){
  if(domain==='tax')return item&&(item.tax_type||item.taxType)||'';
  if(domain==='access')return item&&(item.requirement_type||item.requirementType)||'';
  return item&&item.category||'other';
}
function plRecordMarketCode(item){
  var api=window.JAY_MARKET_SCOPE_API;
  if(item&&item._display_market_code)return String(item._display_market_code).toUpperCase();
  var value=item&&(item.region||item.market||item.market_code||item.marketCode);
  return api&&api.normalizeMarketCode?api.normalizeMarketCode(value):String(value||'').toUpperCase();
}
function plContainsChinese(value){return /[\u3400-\u9fff]/.test(String(value||''));}
function plTranslationMeta(item){return item&&item.translation&&typeof item.translation==='object'?item.translation:{};}
function plHasChineseDisplay(item){
  var meta=plTranslationMeta(item);
  return plContainsChinese(item&&(item.title_zh||item.titleZh))
    && (!String(item&&item.summary||'').trim()||plContainsChinese(item&&(item.summary_zh||item.summaryZh)))
    && ['source_zh','translated','reviewed'].indexOf(meta.status)>=0;
}
function plDisplayTitle(item){return String(item&&(item.title_zh||item.titleZh)||'').trim()||'中文标题尚未接入';}
function plDisplaySummary(item){return String(item&&(item.summary_zh||item.summaryZh)||'').trim();}
function plTranslationLabel(item){
  var meta=plTranslationMeta(item);
  if(meta.status==='reviewed')return '中文人工复核';
  if(meta.status==='source_zh')return '中文原文';
  return '机器翻译';
}
function plRenderDataInfo(){
  var data=plDomainData(plActiveDomain);
  var meta=plDomainLabels[plActiveDomain];
  var stamp=data&&data.updated_at;
  var time=stamp&&!isNaN(new Date(stamp).getTime())?new Date(stamp).toLocaleString('zh-CN'):'尚未接入';
  var sources=Number(data&&data.source_count)||0;
  $('#pl-data-info').textContent=plConfiguredMarketNames().join('、')+'市场 · '+meta.label+' · 更新：'+time+' · 来源：'+sources+' 个';
}
function plRefreshCategoryOptions(){
  var labels=plDomainCategoryLabels(plActiveDomain);
  fillSelect('#pl-f-category',Object.keys(labels).sort(),labels);
  var category=$('#pl-f-category');if(category)category.value='all';
}
function plSwitchDomain(domain){
  if(!plDomainLabels[domain])return;
  plActiveDomain=domain;
  if(window.__CP_JAY_CTX&&window.__CP_JAY_CTX.policyFilter)window.__CP_JAY_CTX.policyFilter.domain=domain;
  plCurrentPage=1;plSelected.clear();
  $$('#policies .pl-domain-tab').forEach(function(tab){
    var active=tab.dataset.domain===domain;
    tab.classList.toggle('active',active);tab.setAttribute('aria-selected',active?'true':'false');
  });
  var scope=$('#pl-f-scope');
  if(scope){scope.value='cross-border';scope.disabled=domain!=='policy';}
  plPolicySourceMode='formal';
  plCrossBorderOnly=true;
  plRefreshCategoryOptions();
  plRenderDataInfo();
  renderPoliciesPage();
}

// Evidence is derived only from fields supplied by the collector. This keeps
// the UI honest: no synthetic source count, verification timestamp, or score
// is written into a policy record merely to make it look more trustworthy.
function plAssessEvidence(p){
  var url=String(p && p.source_url || '').trim();
  var collected=String(p && p.collected_at || '').trim();
  var published=String(p && p.published_at || '').trim();
  var parsedUrl=null;
  try{ parsedUrl=new URL(url); }catch(e){}
  var validUrl=!!parsedUrl && parsedUrl.protocol==='https:' && !!parsedUrl.hostname && !!jaySafeHttpsUrl(url);
  var sourcePath=parsedUrl ? String(parsedUrl.pathname||'').replace(/\/+$/,'') : '';
  var specificRecordUrl=validUrl && sourcePath.length>0;
  var validCollected=!!collected && !isNaN(new Date(collected).getTime());
  var validPublished=!!published && !isNaN(new Date(published).getTime());
  var host='';
  if(parsedUrl) host=parsedUrl.hostname.toLowerCase();
  // Suffix checks use the final hostname labels, so agency.gov.attacker.com
  // cannot impersonate a government source. Explicit source_kind metadata is
  // needed for official registries whose country domain is not listed here.
  var officialHost=/(^|\.)gov$|(^|\.)mil$|\.gov\.[a-z]{2}$|\.europa\.eu$/i.test(host);
  var api=window.JAY_MARKET_SCOPE_API;
  var normalized=api&&api.normalizeDataRecord?api.normalizeDataRecord(p,p&&p.domain||plActiveDomain):p||{};
  var sourceKind=String(normalized.source_kind||p&&p.source_kind||'').toLowerCase();
  var verificationStatus=String(normalized.verification_status||p&&p.verification_status||'').toLowerCase();
  var hasVerificationRecord=!!(p&&(p.verified_at||p.verifiedAt||p.verification_notes||p.verificationNotes));
  var officialVerified=(officialHost||sourceKind==='official')&&verificationStatus==='verified';
  var traceableVerified=sourceKind==='traceable'&&verificationStatus==='verified'&&hasVerificationRecord;
  var issues=[];
  if(!String(p && p.title || '').trim()) issues.push('缺少政策标题');
  if(!validUrl) issues.push('缺少有效原始来源链接');
  if(validUrl && !specificRecordUrl) issues.push('来源链接指向官网首页，无法定位具体政策记录');
  if(!validCollected) issues.push('缺少有效采集时间');
  if(!validPublished) issues.push('缺少有效发布日期');
  if(validUrl && !officialVerified && !traceableVerified) issues.push('来源未满足官方或已复核可追溯条件');
  var verified=!!String(p && p.title || '').trim()&&validUrl&&specificRecordUrl&&validCollected&&validPublished&&(officialVerified||traceableVerified);
  // Scores describe the evidence tier, not a guessed truth probability.
  var score=verified?(officialVerified?100:85):null;
  return {
    score:score,
    flag:verified?'pass':(issues.length>=2?'fail':'warn'),
    // This is a structural verification of the supplied record fields. It
    // does not claim that the browser has re-read the live source page.
    label:verified?(officialVerified?'已核验 · 官方来源':'已核验 · 可追溯来源'):'待核验 · 来源或记录不足',
    sourceTier:officialVerified?'official':(traceableVerified?'traceable':'pending'),
    basis:verified?(officialVerified?'官方记录链接及日期完整':'可追溯记录已完成来源复核'):'来源或验证字段不足',
    issues:issues
  };
}

function plSourceKey(p){
  return String(p && p.source_url || '').trim().replace(/[?#].*$/,'').replace(/\/+$/,'').toLowerCase();
}

function plAssessEvidenceForSet(p, items){
  var evidence=plAssessEvidence(p);
  var key=plSourceKey(p);
  if(key && Array.isArray(items) && items.filter(function(item){ return plSourceKey(item)===key; }).length>1){
    evidence.issues.push('来源链接与其他政策重复，无法确认对应记录');
    evidence.score=null;
    evidence.flag='warn';
    evidence.label='待核验 · 来源记录重复';
  }
  return evidence;
}

function plSourceLabel(p){
  var url=String(p && p.source_url || '');
  if(/(^|\/)federalregister\.gov\//i.test(url)) return 'Federal Register';
  return String(p && p.source || '官方来源');
}

// The source feed contains many US Federal Register notices unrelated to
// cross-border selling. Keep the default view focused on records that can
// affect import, export, customs, tariffs, product compliance, marketplaces,
// sellers, payments, or consumer-facing obligations. Explicit industry-only
// notices stay available through the broader "全部美国已核验政策" view.
var plCrossBorderOnly = true;
// Formal policy records and third-party industry intelligence use separate
// display modes. Industry records are useful context but never become formal
// policy statistics, reports, or automatic high-risk alerts.
var plPolicySourceMode = 'formal';
// Direct keywords identify an explicit cross-border, marketplace, product-safety,
// customs, sanctions, or intellectual-property subject. Generic words such as
// "compliance" and "certification" are intentionally excluded here: they only
// count when a product or trade context is present (see below).
var plCrossBorderDirectKeywords = /跨境|电商|平台|卖家|商家|海关|清关|报关|电子申报|产品安全|消费品|知识产权|商标|包装|纺织|CPSC|FDA|USTR|OFAC|Section\s*301|Section\s*122|\bcustoms?\b|\bimportation\b|\bmarketplaces?\b|\bsellers?\b|\bproduct safety\b|\bconsumer products?\b|\bconsumer protection\b|\bsanctions?\b|\bde minimis\b|\bHTS\b|\bACE system\b|\bforced labor\b|\binternational (?:trademark|trade|mail|shipping)\b|\bintellectual property\b|\btextiles?\b|\bpackaging\b|\bforeign[- ]trade\b|\bWTO\b/i;
var plCrossBorderTradeKeywords = /进口|出口|关税|税务|增值税|销售税|反倾销|反补贴|制裁|贸易|强迫劳动|tariffs?\b|dut(?:y|ies|iable)\b|\btrade\b|\bimports?\b|\bexports?\b|\banti[- ]dumping\b|\bcountervailing\b|\bsanctions?\b|\bWTO\b|\b(?:sales|import|value[- ]added|excise)\s+tax(?:es)?\b/i;
var plComplianceKeywords = /合规|认证|证书|compliance|certification|certificate|standards?|safety mark/i;
var plProductOrTradeContextKeywords = /产品|商品|消费品|进口|出口|设备|装置|食品|化妆品|药品|玩具|电子|电气|电池|包装|纺织|跨境|电商|平台|卖家|商家|海关|清关|报关|贸易|制裁|反倾销|反补贴|知识产权|商标|CPSC|FDA|USTR|OFAC|Section\s*301|Section\s*122|WTO|forced labor|marketplaces?|sellers?|consumer products?|products?|goods?|product safety|customs?|imports?|exports?|tariffs?|dut(?:y|ies|iable)|trade|de minimis|HTS|ACE system|foreign[- ]trade|\b(?:CE|UL|BIS|SABER|KC|PSQCA|SNI|TISI)\b/i;
// These contexts are strong enough to keep an otherwise industry-specific
// notice, for example a CPSC filing or a customs requirement for sellers.
// A bare import/duty/antidumping phrase is deliberately not enough: product-
// specific notices for steel, dairy, fish, aircraft, etc. remain industry-only.
var plBusinessCrossBorderContextKeywords = /跨境|电商|平台|卖家|商家|海关|清关|报关|电子申报|消费品|产品安全|知识产权|商标|CPSC|FDA|USTR|OFAC|Section\s*301|Section\s*122|WTO|forced labor|marketplaces?|sellers?|consumer products?|product safety|customs?|de minimis|HTS|ACE system|international trademark|intellectual property|\b(?:CE|UL|BIS|SABER|KC|PSQCA|SNI|TISI)\b/i;
var plIndustryOnlyKeywords = /贷款|金融|基金信托|银行控股|资产管理|loan|financial|fund trust|asset management|bank holding|nuclear|核能|核燃料|marine mammals?|海洋哺乳|oil and gas|石油天然气|aircraft|航空器|aerospace|航空航天|scientific instruments?|科学仪器|commodity swaps?|商品互换|political[- ]military|军工|arms export|defen[cs]e|cheese|奶酪|sugar|食糖|soybean|大豆|fish fillets?|鱼片|mushrooms?|蘑菇|steel|钢材|aluminum|铝材|quartz surface|石英板|motor vehicles?|机动车|dairy|乳制品|battery-powered equipment|电池设备|water quality|水质|hydro|FLSA|wage|labor|劳工|railroad|locomotive|铁路|engineers?/i;
function plAssessPolicyRelevance(p){
  var title=String(p && p.title || '').trim();
  var summary=String(p && p.summary || '').trim();
  var text=(title+'\n'+summary).trim();
  if(!text) return {flag:'unknown',label:'无法判断相关性'};
  // Some official notices use a generic title while the abstract contains
  // the actual import, marketplace, or product-safety obligation. Evaluate
  // both source fields so the default scope does not silently miss them.
  var direct=plCrossBorderDirectKeywords.test(text)
    || (plComplianceKeywords.test(text) && plProductOrTradeContextKeywords.test(text));
  var trade=plCrossBorderTradeKeywords.test(text);
  var industryOnly=plIndustryOnlyKeywords.test(text);
  if(industryOnly && !directContextForIndustry(text)) return {flag:'industry',label:'行业专项，默认不纳入'};
  if(direct) return {flag:'direct',label:'跨境经营直接相关'};
  if(trade) return {flag:'trade',label:'贸易与进口经营相关'};
  return {flag:'none',label:'与跨境经营关联不足'};
}
function directContextForIndustry(title){
  return plBusinessCrossBorderContextKeywords.test(title);
}
function plIsCrossBorderPolicy(p){
  var relevance=plAssessPolicyRelevance(p);
  if(p) p._relevance=relevance;
  return relevance.flag==='direct'||relevance.flag==='trade';
}

function plNormalizedSourceMeta(item){
  var api=window.JAY_MARKET_SCOPE_API;
  var normalized=api&&api.normalizeDataRecord?api.normalizeDataRecord(item,'policy'):item||{};
  var sourceKind=String(normalized.source_kind||item&&item.source_kind||'').toLowerCase();
  var sourceType=String(normalized.source_type||item&&item.source_type||'').toLowerCase();
  var sourceClass=String(item&& (item.source_class||item.sourceClass) || '').toLowerCase();
  var sourceName=String(item&&item.source||'').toLowerCase();
  var sourceUrl=String(item&&item.source_url||'').toLowerCase();
  var industry=sourceClass==='industry_advisory'
    || ['licensed_provider','industry_association'].indexOf(sourceType)>=0
    || /雨果|amz123|cifnews|行业资讯|行业协会/.test(sourceName)
    || /(^|\.)cifnews\.com\/|(^|\.)amz123\.com\//.test(sourceUrl);
  return {normalized:normalized,sourceKind:sourceKind,sourceType:sourceType,sourceClass:sourceClass,industry:industry};
}

function plIsIndustryAdvisory(item){
  return plNormalizedSourceMeta(item).industry;
}

function plIndustryAliasMatches(text,value){
  var raw=String(value||'').trim().toLowerCase();
  if(!raw)return false;
  if(/[\u3400-\u9fff]/.test(raw))return text.indexOf(raw)>=0;
  if(raw.length<2)return false;
  var escaped=raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(^|[^a-z0-9])'+escaped+'($|[^a-z0-9])','i').test(text);
}

function plIndustryMarketCodes(item){
  var text=(String(item&&item.title||'')+'\n'+String(item&&item.summary||'')+'\n'
    +String(item&&item.title_zh||item&&item.titleZh||'')+'\n'
    +String(item&&item.summary_zh||item&&item.summaryZh||'')).toLowerCase();
  var codes=[];
  // Explicit market scope always wins. Global/blank third-party articles are
  // admitted only when their title or summary identifies a target market.
  var api=window.JAY_MARKET_SCOPE_API;
  var config=api&&api.getConfig?api.getConfig():window.JAY_MARKET_CONFIG;
  var configuredMarkets=config&&Array.isArray(config.markets)?config.markets:[];
  var explicitValues=item&&(item.market_codes||item.marketCodes||item.markets);
  if(!Array.isArray(explicitValues))explicitValues=explicitValues?[explicitValues]:[];
  explicitValues.forEach(function(value){
    var code=api&&api.normalizeMarketCode?api.normalizeMarketCode(value):String(value||'').toUpperCase();
    if(code && code!=='GLOBAL' && code!=='GLOBAL_MARKET' && codes.indexOf(code)<0)codes.push(code);
    if((code==='EU'||code==='SEA')&&configuredMarkets.length){
      configuredMarkets.forEach(function(market){
        var regionCode=String(market&& (market.regionCode||market.region_code) || '').toUpperCase();
        var marketCode=String(market&&market.code||'').toUpperCase();
        if(regionCode===code&&marketCode&&codes.indexOf(marketCode)<0)codes.push(marketCode);
      });
    }
  });
  var legacyExplicit=plRecordMarketCode(item);
  if(legacyExplicit && legacyExplicit!=='GLOBAL' && legacyExplicit!=='GLOBAL_MARKET' && codes.indexOf(legacyExplicit)<0)codes.push(legacyExplicit);

  // Resolve configured market aliases before falling back to aggregate
  // regions. This keeps a future Germany or France market distinct from EU,
  // while still allowing an EU-wide article to reach every configured EU
  // market through its region code.
  configuredMarkets.forEach(function(market){
    var aliases=[market&&market.code,market&&market.key,market&&market.name,market&&market.label]
      .concat(Array.isArray(market&&market.aliases)?market.aliases:[]);
    var direct=aliases.some(function(alias){return plIndustryAliasMatches(text,alias);});
    var regionCode=String(market&& (market.regionCode||market.region_code) || '').toUpperCase();
    var regionPattern=regionCode==='EU'?/欧盟|欧洲|\beu\b|\beurope\b/i
      :regionCode==='SEA'?/东南亚|\bsea\b|\bsoutheast\s+asia\b/i:null;
    if((direct||regionPattern&&regionPattern.test(text))&&market&&market.code){
      var code=String(market.code).toUpperCase();
      if(codes.indexOf(code)<0)codes.push(code);
    }
  });

  if(/美国|美区|美国站|白宫|联邦|american|united states|u\.s\.?|us tariff|us customs/.test(text))codes.push('US');
  if(/欧盟|欧洲|法国|德国|意大利|西班牙|英国|eu\b|europe|france|germany|italy|spain|uk\b/.test(text))codes.push('EU');
  if(/加拿大|canada/.test(text))codes.push('CA');
  if(/日本|日区|japan/.test(text))codes.push('JP');
  if(/韩国|韩区|korea/.test(text))codes.push('KR');
  if(/东南亚|新加坡|马来西亚|印尼|泰国|越南|sea\b|singapore|malaysia|indonesia|thailand|vietnam/.test(text))codes.push('SEA');
  return codes.filter(function(code,index){return codes.indexOf(code)===index;});
}

function plAssessIndustryEvidence(item, items){
  var meta=plNormalizedSourceMeta(item);
  var url=String(item&&item.source_url||'').trim();
  var parsed=null;try{parsed=new URL(url);}catch(e){}
  var validUrl=!!parsed&&parsed.protocol==='https:'&&!!parsed.hostname&&!!jaySafeHttpsUrl(url);
  var specific=validUrl&&String(parsed.pathname||'').replace(/\/+$/,'').length>0;
  var collected=String(item&&item.collected_at||'').trim();
  var published=String(item&&item.published_at||'').trim();
  var validCollected=!!collected&&!isNaN(new Date(collected).getTime());
  var validPublished=!!published&&!isNaN(new Date(published).getTime());
  var issues=[];
  if(!validUrl)issues.push('缺少有效资讯来源链接');
  if(validUrl&&!specific)issues.push('来源链接无法定位具体资讯');
  if(!validCollected)issues.push('缺少有效采集时间');
  if(!validPublished)issues.push('缺少有效发布日期');
  if(!plHasChineseDisplay(item))issues.push('缺少中文展示字段');
  if(!meta.industry)issues.push('来源未标记为行业资讯');
  var pass=meta.industry&&validUrl&&specific&&validCollected&&validPublished&&plHasChineseDisplay(item);
  return {
    score:null,
    flag:pass?'advisory':'warn',
    label:pass?'可追溯参考 · 非官方核验':'待筛选 · 行业资讯字段不足',
    sourceTier:'traceable',
    basis:pass?'保留原始资讯链接、发布日期和采集时间；内容未等同官方结论':'行业资讯来源或记录字段不足',
    issues:issues
  };
}

function plGetIndustryPolicyRecords(){
  var items=(policiesJsonData&&policiesJsonData.items)||[];
  var active=plConfiguredMarketCodes();
  var result=[];
  items.forEach(function(item){
    var meta=plNormalizedSourceMeta(item);
    if(!plIsIndustryAdvisory(item))return;
    var codes=plIndustryMarketCodes(item);
    var matched=codes.filter(function(code){return active.indexOf(code)>=0;});
    if(!matched.length)return;
    var relevance=plAssessPolicyRelevance(item);
    if(relevance.flag!=='direct'&&relevance.flag!=='trade')return;
    var evidence=plAssessIndustryEvidence(item,items);
    if(evidence.flag!=='advisory')return;
    var copy=Object.assign({},item,{
      // Normalize legacy articles at the display boundary. They may predate
      // the provenance envelope and must never inherit a compatibility
      // "verified" status merely because a URL and dates exist.
      source_kind:'traceable', source_type:meta.sourceType||'licensed_provider',
      source_class:'industry_advisory', verification_status:'pending', verified_at:null,
      _advisory:true, _display_market_code:matched[0], _relevance:relevance,
      _evidence:evidence, credibility_score:null
    });
    result.push(copy);
  });
  return result;
}

window.plGetIndustryPolicyRecords=plGetIndustryPolicyRecords;

// —— 政策动态真实性校验引擎 ——
// 检测：status/expire_date 一致性、legal_basis 分类合法性、source_count、可信度阈值、来源链接缺失、时间线状态
function jayVerifyPolicies(items){
  if(!Array.isArray(items)) return {total:0,issues:0};
  var issues_total = 0, fail_cnt = 0, warn_cnt = 0;
  items.forEach(function(p){
    var evidence=plAssessEvidenceForSet(p, items);
    var issues=evidence.issues.slice();
    p._verifyIssues = issues;
    p._verifyFlag = evidence.flag;
    p._evidence = evidence;
    p.credibility_score = evidence.score;
    issues_total += issues.length;
    if(p._verifyFlag==='fail') fail_cnt++; else if(p._verifyFlag==='warn') warn_cnt++;
  });
  return {total: items.length, issues: issues_total, fail: fail_cnt, warn: warn_cnt};
}

function plInitFromJson() {
  const items = plGetJsonItems();
  jayVerifyPolicies(items);
  // The configured workspace has one market. Keep the region control useful
  // for context while preventing global regions from reappearing in the UI.
  var marketCodes=plConfiguredMarketCodes();
  var marketLabels=Object.assign({},plRegionLabels);
  marketCodes.forEach(function(code){marketLabels[code]=plMarketLabel(code);});
  fillSelect('#pl-f-region', marketCodes, marketLabels);
  var regionSelect=$('#pl-f-region');
  if(regionSelect && marketCodes.length===1)regionSelect.value=marketCodes[0]||'all';
  else if(regionSelect && marketCodes.length>1)regionSelect.value='all';
  plRefreshCategoryOptions();
  // Update nav badge
  const navBadge = document.querySelector('a[data-page="policies"] b');
  if (navBadge) navBadge.textContent = items.length;
  plCurrentPage = 1;
  renderPoliciesPage();
}

function plFilterVerifiedPolicies(items, crossBorderOnly) {
  var sourceItems=Array.isArray(items)?items:[];
  return sourceItems.filter(function(p){
    // Advisory articles are intentionally excluded from formal policy lists,
    // even if a legacy record happens to look verified by URL and dates.
    if(plIsIndustryAdvisory(p)) return false;
    var evidence=plAssessEvidenceForSet(p, sourceItems);
    p._verifyIssues=evidence.issues.slice();
    p._verifyFlag=evidence.flag;
    p._evidence=evidence;
    p.credibility_score=evidence.score;
    if(evidence.flag!=='pass') return false;
    if(!plHasChineseDisplay(p))return false;
    var relevance=plAssessPolicyRelevance(p);
    p._relevance=relevance;
    return !crossBorderOnly || relevance.flag==='direct'||relevance.flag==='trade';
  });
}

function plGetVerifiedUsPolicies(crossBorderOnly) {
  // Kept as a compatibility name for alert linkage; it now means all active markets.
  return plGetVerifiedPolicies(crossBorderOnly);
}

function plGetVerifiedPolicies(crossBorderOnly) {
  var items=(policiesJsonData && policiesJsonData.items) || [];
  var api=window.JAY_MARKET_SCOPE_API;
  var active=plConfiguredMarketCodes();
  var scopedItems=items.filter(function(p){
    var code=api&&api.normalizeMarketCode?api.normalizeMarketCode(p&&(p.region||p.market||p.market_code)):String(p&&(p.region||p.market||p.market_code)||'').toUpperCase();
    return active.indexOf(code)>=0;
  });
  // The shared provenance gate is the first boundary. The page-specific
  // evidence and relevance checks remain useful explanations, but they no
  // longer decide whether demo/pending records can enter formal lists.
  if(api && typeof api.filterFormalRecords==='function'){
    scopedItems=api.filterFormalRecords(scopedItems,{marketCodes:active},{domain:'policy'});
  }
  return plFilterVerifiedPolicies(scopedItems, crossBorderOnly);
}

function plGetJsonItems() {
  return plGetVerifiedPolicies(plCrossBorderOnly);
}

function plGetVerifiedDomainRecords(domain){
  if(domain==='policy')return plGetVerifiedPolicies(plCrossBorderOnly);
  var data=plDomainData(domain);
  var items=(data&&data.items)||[];
  var api=window.JAY_MARKET_SCOPE_API;
  var active=plConfiguredMarketCodes();
  var scoped=items.filter(function(item){return active.indexOf(plRecordMarketCode(item))>=0;});
  if(api&&typeof api.filterFormalRecords==='function'){
    scoped=api.filterFormalRecords(scoped,{marketCodes:active},{domain:domain});
  }
  return scoped.filter(function(item){
    var evidence=plAssessEvidenceForSet(item,scoped);
    item._verifyIssues=evidence.issues.slice();item._verifyFlag=evidence.flag;
    item._evidence=evidence;item.credibility_score=evidence.score;
    return evidence.flag==='pass'&&plHasChineseDisplay(item);
  });
}
function plGetActiveDomainItems(){
  if(plActiveDomain==='policy'&&plPolicySourceMode==='industry')return plGetIndustryPolicyRecords();
  return plGetVerifiedDomainRecords(plActiveDomain);
}
window.plGetVerifiedDomainRecords=plGetVerifiedDomainRecords;

// Populate the filter selects before the first asynchronous fetch.
var plInitialMarketCodes=plConfiguredMarketCodes();
var plInitialMarketLabels=Object.assign({},plRegionLabels);
plInitialMarketCodes.forEach(function(code){plInitialMarketLabels[code]=plMarketLabel(code);});
fillSelect('#pl-f-region', plInitialMarketCodes, plInitialMarketLabels);
if($('#pl-f-region')) $('#pl-f-region').value=plInitialMarketCodes.length>1?'all':(plInitialMarketCodes[0]||'all');
plRefreshCategoryOptions();

var plCurrentPage=1, plPerPage=10, plSelected=new Set(), plAiTab=0;
const plAiTabs=['最新市场政策','市场准入与认证','关税与税务','合规风险'];

function renderPlStats(){
  const items=plGetActiveDomainItems();
  const domainMeta=plDomainLabels[plActiveDomain];
  const total=items.length;
  const highCount=items.filter(p=>p.impact_level==='high').length;
  const regions=new Set(items.map(plRecordMarketCode).filter(Boolean));
  const categories=new Set(items.map(function(p){return plDomainTypeValue(p,plActiveDomain);}).filter(Boolean));
  $('#pl-stats-row').innerHTML=`
    <div class="pl-stat-card"><div class="pl-stat-val">${total}</div><div class="pl-stat-label">当前${plActiveDomain==='policy'&&plPolicySourceMode==='industry'?'行业资讯':domainMeta.countLabel}</div><div class="pl-stat-sub">${plActiveDomain==='policy'&&plPolicySourceMode==='industry'?'可追溯参考，不纳入正式政策统计':plActiveDomain==='policy'&&plCrossBorderOnly?'跨境经营相关':'当前市场已核验'}</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val" style="color:#e74c3c">${highCount}</div><div class="pl-stat-label">高影响记录</div><div class="pl-stat-sub">需要优先复核</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${regions.size}</div><div class="pl-stat-label">国家市场</div><div class="pl-stat-sub">当前范围</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${categories.size}</div><div class="pl-stat-label">数据分类</div><div class="pl-stat-sub">独立字段统计</div></div>`;
  const allScopedItems=plActiveDomain==='policy'&&plPolicySourceMode==='industry'
    ? plGetIndustryPolicyRecords()
    : ((plDomainData(plActiveDomain)||{}).items||[]).filter(function(p){return plConfiguredMarketCodes().indexOf(plRecordMarketCode(p))>=0;});
  const excludedN=plActiveDomain==='policy'&&plPolicySourceMode==='industry' ? 0 : allScopedItems.filter(function(p){ return plAssessEvidenceForSet(p, allScopedItems).flag!=='pass'; }).length;
  const relevanceExcludedN=plActiveDomain==='policy'?allScopedItems.filter(function(p){
    return plAssessEvidenceForSet(p, allScopedItems).flag==='pass' && !plIsCrossBorderPolicy(p);
  }).length:0;
  const translationExcludedN=allScopedItems.filter(function(p){return !plHasChineseDisplay(p);}).length;
  const officialN=items.filter(function(p){return (p._evidence||plAssessEvidence(p)).sourceTier==='official';}).length;
  const traceableN=items.filter(function(p){return (p._evidence||plAssessEvidence(p)).sourceTier==='traceable';}).length;
  const vBar=document.getElementById('pl-verify-bar');
  if(vBar){
    const qualityNotes=[];
    if(excludedN) qualityNotes.push('来源不足 '+excludedN);
    if(relevanceExcludedN) qualityNotes.push('相关性不足 '+relevanceExcludedN);
    if(translationExcludedN) qualityNotes.push('中文待转换 '+translationExcludedN);
    vBar.innerHTML=`<div class="pl-trust-summary">
      <strong>${plActiveDomain==='policy'&&plPolicySourceMode==='industry'?'行业资讯来源':'来源校验'}</strong><span class="${plActiveDomain==='policy'&&plPolicySourceMode==='industry'?'':'pass'}">${plActiveDomain==='policy'&&plPolicySourceMode==='industry'?'可追溯参考 '+items.length+' 条':'已核验 '+items.length+' 条'}</span>
      <span>官方 ${officialN} · 可追溯 ${traceableN}</span>
      ${qualityNotes.length?`<span title="${qualityNotes.join('、')} 条，未进入正式列表">排除：${qualityNotes.join('、')}</span>`:''}
      <small title="需具备具体官方或已复核可追溯记录、有效发布日期和采集时间；中文翻译不改变原始来源验证结果">依据：记录链接 + 验证状态 + 日期；中文为展示译文</small>
    </div>`;
  }
}

function renderPlAi(){
  let tabsHtml='';
  if(plActiveDomain==='policy'){
    tabsHtml=plAiTabs.map((t,i)=>`<span class="pl-ai-tab${i===plAiTab?' active':''}" onclick="plSwitchAiTab(${i})">${t}</span>`).join('');
    tabsHtml+=`<span style="margin-left:auto;font-size:.72rem;color:#888;cursor:pointer" onclick="plSwitchAiTab(${(plAiTab+1)%plAiTabs.length})">切换视图</span>`;
  }else{
    tabsHtml=`<span class="pl-ai-tab active">${plDomainLabels[plActiveDomain].label}重点记录</span>`;
  }
  $('#pl-ai-tabs').innerHTML=tabsHtml;
  var sourceItems=plGetActiveDomainItems().map(function(p,i){ return Object.assign({_idx:i},p); });
  var tabItems=sourceItems.filter(function(p){
    if(plActiveDomain!=='policy')return true;
    if(plAiTab===1) return ['certification','product_safety','compliance'].indexOf(p.category)>=0;
    if(plAiTab===2) return ['tariff','tax','foreign_exchange'].indexOf(p.category)>=0;
    if(plAiTab===3) return p.impact_level==='high';
    return true;
  });
  tabItems.sort(function(a,b){
    var impact=(b.impact_level==='high'?3:b.impact_level==='medium'?2:1)-(a.impact_level==='high'?3:a.impact_level==='medium'?2:1);
    if(impact) return impact;
    return String(b.published_at||'').localeCompare(String(a.published_at||''));
  });
  const items=tabItems.slice(0,4).map(function(p){
    var summary=plDisplaySummary(p).replace(/\s+/g,' ').slice(0,180);
    var source=p.source_url?(' · 来源：'+plSourceLabel(p)):'';
    return `<div class="ai-item"><span class="ai-tag-red">${escapeHtml(plMarketLabel(plRecordMarketCode(p)))}</span> ${escapeHtml(plDisplayTitle(p))}<br><span style="color:#566;">${escapeHtml(summary)}${escapeHtml(source)}</span><span class="ai-btn" onclick="plAiLocatePolicy(${p._idx})">定位记录</span><span class="ai-btn" onclick="toast('已添加预警')">添加预警</span></div>`;
  }).join('');
  $('#pl-ai-content').innerHTML=items || '<div class="ai-item">'+plDomainLabels[plActiveDomain].empty+'。</div>';
}
function plSwitchAiTab(i){plAiTab=i;renderPlAi();}
function plAiLocatePolicy(idx){toast('已定位到相关政策条目');}

function plGetFiltered(){
  const search=$('#pl-search').value.toLowerCase();
  const region=$('#pl-f-region').value;
  const category=$('#pl-f-category').value;
  const impact=$('#pl-f-impact').value;
  const items=plGetActiveDomainItems();
  return items.map((p,i)=>({...p,_idx:i})).filter(p=>{
    var searchable=(plDisplayTitle(p)+' '+plDisplaySummary(p)+' '+plMarketLabel(plRecordMarketCode(p))).toLowerCase();
    if(search && !searchable.includes(search))return false;
    if(region!=='all' && plRecordMarketCode(p)!==region)return false;
    var typeValue=plDomainTypeValue(p,plActiveDomain);
    if(category==='tax_trade' && plActiveDomain==='policy' && ['tariff','tax','foreign_exchange'].indexOf(typeValue)<0)return false;
    if(category!=='all' && category!=='tax_trade' && typeValue!==category)return false;
    if(impact!=='all' && p.impact_level!==impact)return false;
    return true;
  });
}

function renderPlList(){
  const filtered=plGetFiltered();
  const domainMeta=plDomainLabels[plActiveDomain];
  const categoryLabels=plDomainCategoryLabels(plActiveDomain);
  const total=filtered.length;
  const totalPages=Math.ceil(total/plPerPage)||1;
  if(plCurrentPage>totalPages)plCurrentPage=totalPages;
  const start=(plCurrentPage-1)*plPerPage;
  const pageData=filtered.slice(start,start+plPerPage);

  if(total===0){
    $('#pl-list').innerHTML='';
    $('#pl-empty').style.display='block';
    $('#pl-pagination').innerHTML='';
    $('#pl-filter-count').textContent='0 条'+domainMeta.countLabel;
    var emptyText=$('#pl-empty p');if(emptyText)emptyText.textContent=domainMeta.empty;
    return;
  }
  $('#pl-empty').style.display='none';
  $('#pl-filter-count').textContent=total+' 条'+domainMeta.countLabel;

  $('#pl-list').innerHTML=pageData.map(p=>{
    const levelClass=p.impact_level==='high'?'level-major':p.impact_level==='medium'?'level-medium':'level-normal';
    const badgeClass=p.impact_level==='high'?'badge-major':p.impact_level==='medium'?'badge-medium':'badge-normal';
    const impactColor=p.impact_level==='high'?'#e74c3c':p.impact_level==='medium'?'#f39c12':'#3498db';
    const impactLabel=plImpactLabels[p.impact_level]||'常规';
    const regionLabel=plMarketLabel(plRecordMarketCode(p));
    const typeValue=plDomainTypeValue(p,plActiveDomain);
    const catLabel=categoryLabels[typeValue]||typeValue||'未分类';
    const checked=plSelected.has(p._idx)?'checked':'';
    const safeSourceUrl=jaySafeHttpsUrl(p.source_url);
    const sourceLink=safeSourceUrl?`<a href="${escapeHtml(safeSourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#3366cc;text-decoration:none">${escapeHtml(plSourceLabel(p))}</a>`:`<span class="src-missing">待补充来源</span>`;
    const title=plDisplayTitle(p);
    const titleLink=safeSourceUrl?`<a href="${escapeHtml(safeSourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${escapeHtml(title)}</a>`:escapeHtml(title);
    const summary=plDisplaySummary(p);
    const pubDate=p.published_at||'';
    const evidence=p._evidence||plAssessEvidence(p);
    const relevance=plActiveDomain==='policy'?(p._relevance||plAssessPolicyRelevance(p)):{flag:'direct',label:'当前市场适用'};
    const relevanceLabel=relevance.flag==='direct'?'跨境直接相关':relevance.flag==='trade'?'贸易经营相关':relevance.label;
    const relevanceColor=(relevance.flag==='direct'||relevance.flag==='trade')?'#256d5a':'#7b6b35';
    const statusLabel=p.status_label||p.status||'';
    const statusColor=p.status==='active'?'#27ae60':p.status==='proposed'?'#3498db':p.status==='suspended'?'#f39c12':'#95a5a6';
    const lbLabel=p.legal_basis_label||'';
    const effDate=p.effective_from||p.effective_date||'';
    const expDate=p.effective_to||p.expire_date||'';
    const vFlag=evidence.flag||'warn';
    const vIssues=evidence.issues||[];
    const cardBorder=vFlag==='fail'?'box-shadow:0 0 0 2px #e74c3c inset':vFlag==='warn'?'box-shadow:0 0 0 2px #f39c12 inset':'';
    const vBadge=p._advisory?`<span class="pl-verify-badge advisory" title="${escapeHtml(evidence.label)}" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#eef5ff;color:#286090;margin-left:6px;vertical-align:middle">↗ 可追溯参考</span>`:vFlag==='pass'?`<span class="pl-verify-badge pass" title="${escapeHtml(evidence.label)}" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#eafaf1;color:#1e8449;margin-left:6px;vertical-align:middle">✓ 已核验</span>`:`<span class="pl-verify-badge warn" title="${escapeHtml(vIssues.join('；'))}" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#fef9e7;color:#b7950b;margin-left:6px;vertical-align:middle">⚠ 待核</span>`;
    return `<div class="pl-card" style="${cardBorder}">
      <div class="pl-risk-bar ${levelClass}"></div>
      <input type="checkbox" class="pl-card-check" ${checked} onclick="event.stopPropagation();plToggleSelect(${p._idx})">
      <div class="pl-card-body">
        <h3>${titleLink}${vBadge}</h3>
        <div class="pl-meta">
          <span class="pl-country-tag">${escapeHtml(regionLabel)}</span>
          <span>发布日期：${escapeHtml(pubDate?jayFmtTime(pubDate):'尚未接入')}</span>
          <span>${sourceLink}</span>
          <span class="pl-translation-badge">${escapeHtml(plTranslationLabel(p))}</span>
          ${p._advisory?'<span class="pl-source-advisory">第三方行业资讯</span>':''}
        </div>
        <div class="pl-tags-row">
          <span class="pl-relevance-tag" title="相关性判断：${escapeHtml(relevance.label)}" style="color:${relevanceColor};border:1px solid ${relevanceColor};background:${relevanceColor}15;padding:1px 8px;border-radius:10px;font-size:12px">${escapeHtml(relevanceLabel)}</span>
          <span class="pl-type-tag">${escapeHtml(catLabel)}</span>
          <span class="pl-impact-tag" style="color:${impactColor};border-color:${impactColor};background:${impactColor}15">${escapeHtml(impactLabel)}影响</span>
          ${statusLabel?`<span style="color:${statusColor};border:1px solid ${statusColor};background:${statusColor}15;padding:1px 8px;border-radius:10px;font-size:12px">${escapeHtml(statusLabel)}</span>`:''}
          ${lbLabel?`<span title="法律依据分类" style="color:#6c3483;border:1px solid #6c3483;background:#f5eef8;padding:1px 8px;border-radius:10px;font-size:12px">${escapeHtml(lbLabel)}</span>`:''}
        </div>
        ${(effDate||expDate)?`<div class="pl-verify-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;font-size:12px;color:#666">
           ${effDate?`<span>生效: <b style="color:#2c3e50">${escapeHtml(effDate)}</b></span>`:''}
           ${expDate?`<span>失效: <b style="color:#e74c3c">${escapeHtml(expDate)}</b></span>`:''}
        </div>`:''}
        ${summary?'<div class="pl-summary">'+escapeHtml(summary)+'</div>':''}
      </div>
      <div class="pl-card-right">
         <span class="pl-level-badge ${badgeClass}">${escapeHtml(impactLabel)}</span>
        <div class="pl-card-ops">
          <button onclick="event.stopPropagation();openPlDetail(${p._idx})">查看详情</button>
          <button onclick="event.stopPropagation();toast('已添加预警')">添加预警</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Pagination
  let pagHtml=`<button ${plCurrentPage<=1?'disabled':''} onclick="plGoPage(${plCurrentPage-1})">‹</button>`;
  for(let i=1;i<=totalPages;i++){
    if(totalPages>7 && i>2 && i<totalPages-1 && Math.abs(i-plCurrentPage)>1){
      if(i===3||i===totalPages-2)pagHtml+=`<span>…</span>`;
      continue;
    }
    pagHtml+=`<button class="${i===plCurrentPage?'active':''}" onclick="plGoPage(${i})">${i}</button>`;
  }
  pagHtml+=`<button ${plCurrentPage>=totalPages?'disabled':''} onclick="plGoPage(${plCurrentPage+1})">›</button>`;
  $('#pl-pagination').innerHTML=pagHtml;
}

function plGoPage(n){plCurrentPage=n;renderPlList();window.scrollTo({top:$('#pl-list').offsetTop-100,behavior:'smooth'});}
function plToggleSelect(idx){if(plSelected.has(idx))plSelected.delete(idx);else plSelected.add(idx);$('#pl-selected-count').textContent=plSelected.size?`已选 ${plSelected.size} 条`:'';renderPlList();}
function plSearch(){plCurrentPage=1;renderPlList(); var pl=document.getElementById('pl-list'); if(pl){ try{ jayHighlightMatches(pl, ($('#pl-search')||{}).value); }catch(e){} } }
function plFilterChange(){
  plCurrentPage=1;
  var region=$('#pl-f-region').value;
  var category=$('#pl-f-category').value;
  var impact=$('#pl-f-impact').value;
  window.jayPolicyFilter={region:region,category:category,impact:impact};
  if(window.__CP_JAY_CTX && typeof jayPolicyContext==='function'){
    jayPolicyContext({domain:plActiveDomain,region:region,category:category,impact:impact,scope:$('#pl-f-scope').value||'cross-border'});
  }
  plSyncToOtherBoards(region,category,impact);
  renderPlList();
}
function plScopeChange(value){
  plPolicySourceMode=value==='industry'?'industry':'formal';
  plCrossBorderOnly=value==='cross-border';
  if(window.__CP_JAY_CTX && typeof jayPolicyContext==='function')jayPolicyContext({domain:plActiveDomain,scope:value});
  plCurrentPage=1;
  renderPoliciesPage();
}
function plClearFilters(){
  $('#pl-search').value='';
  $('#pl-f-scope').value='cross-border';
  plPolicySourceMode='formal';
  plCrossBorderOnly=true;
  var configuredMarkets=plConfiguredMarketCodes();
  var defaultMarket=configuredMarkets.length>1?'all':(configuredMarkets[0]||'all');
  $('#pl-f-region').value=defaultMarket;
  $('#pl-f-category').value='all';
  $('#pl-f-impact').value='all';
  var filter={domain:plActiveDomain,region:defaultMarket,category:'all',impact:'all',scope:'cross-border'};
  window.jayPolicyFilter={region:defaultMarket,category:'all',impact:'all'};
  if(window.__CP_JAY_CTX && typeof jayPolicyContext==='function')jayPolicyContext(filter);
  plCurrentPage=1;
  renderPoliciesPage();
  toast('筛选条件已重置为当前市场'+plDomainLabels[plActiveDomain].label);
}

// 政策动态筛选器 ↔ 其他板块联动
function plSyncToOtherBoards(region,category,impact){
  // 1. 同步到平台规则页的市场/类别筛选
  var regionToMarket={'US':'US','EU':'EU','SEA':'SEA','MEA':'MEA','LATAM':'LATAM','SAS':'SAS','AFR':'AFR','EA':'EA','OCE':'OCE','CIS':'CIS','CN':'CN'};
  var market=null, rlCat=null;
  if(region!=='all'){
    market=regionToMarket[region];
    var rlMarket=$('#rl-market');
    if(rlMarket && market) rlMarket.value=market;
  }
  var catToRule={'tariff':'fee','tax':'fee','certification':'compliance','compliance':'compliance','ban':'penalty','regulation':'compliance','product_safety':'compliance','data_privacy':'compliance','intellectual_property':'compliance','anti_dumping':'penalty','foreign_exchange':'fee','customs':'fulfillment','investment':'compliance','trade_agreement':'compliance','subsidy':'fee','labor':'compliance','e_commerce':'compliance','other':'compliance'};
  if(category!=='all'){
    rlCat=catToRule[category];
    var rlCategory=$('#rl-category');
    if(rlCategory && rlCat) rlCategory.value=rlCat;
  }
  // 如果当前在平台规则页，立即重新渲染
  var rulesPage=document.getElementById('rules');
  if(rulesPage && rulesPage.classList.contains('active') && typeof renderRulesPage==='function'){
    renderRulesPage();
  }
  // 2. 刷新预警中心（政策数据变化会驱动预警）
  if(typeof refreshDynamicAlerts==='function') refreshDynamicAlerts();
}
function plExportReport(){jayExportPolicy();}
function plBatchAlert(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已为 ${plSelected.size} 条政策开启预警`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}
function plBatchWatch(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已将 ${plSelected.size} 条政策加入看板`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}
function plBatchArchive(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已归档 ${plSelected.size} 条政策`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}

function plDetailValue(value){
  if(Array.isArray(value))return value.map(plDetailValue).filter(Boolean).join('、');
  if(value&&typeof value==='object')return plDetailValue(value.value!==undefined?value.value:value.text);
  return String(value===undefined||value===null?'':value).trim();
}
function plDetailFacts(p,domain){
  var fields=domain==='tax'?[
    ['税种',plTaxTypeLabels[p.tax_type||p.taxType]],['税率/金额',p.rate||p.amount],
    ['计税依据',p.rate_basis||p.rateBasis],['起征点',p.threshold],['币种',p.currency],
    ['征收机构',p.tax_authority||p.taxAuthority],['代扣责任方',p.collection_responsibility||p.collectionResponsibility],
    ['原产地',p.origin_country||p.originCountry],['HS 编码',p.hs_code||p.hsCode],['贸易方式',p.trade_mode||p.tradeMode]
  ]:domain==='access'?[
    ['要求类型',plAccessTypeLabels[p.requirement_type||p.requirementType]],['主管机构',p.authority],
    ['适用品类',p.applies_to||p.appliesTo||p.category_codes],['认证标准',p.certification_standard||p.certificationStandard],
    ['标签要求',p.labeling_requirements||p.labelingRequirements],['包装要求',p.packaging_requirements||p.packagingRequirements],
    ['注册要求',p.registration_requirements||p.registrationRequirements],['所需文件',p.required_documents||p.requiredDocuments],
    ['知识产权要求',p.ip_requirements||p.ipRequirements],['进口要求',p.import_requirements||p.importRequirements]
  ]:[
    ['政策类别',plCategoryLabels[p.category]||p.category],['影响等级',plImpactLabels[p.impact_level]||'常规'],
    ['法律依据',p.legal_basis_label||p.legal_basis],['状态',p.status_label||p.status]
  ];
  return '<div class="pl-detail-grid">'+fields.map(function(field){
    return '<div class="pl-detail-item"><b>'+escapeHtml(field[0])+'：</b>'+escapeHtml(plDetailValue(field[1])||'尚未接入')+'</div>';
  }).join('')+'</div>';
}
function openPlDetail(idx){
  const items=plGetActiveDomainItems();
  const p=items[idx];
  if(!p)return;
  const evidence=p._evidence||plAssessEvidence(p);
  const title=plDisplayTitle(p),summary=plDisplaySummary(p);
  const regionLabel=plMarketLabel(plRecordMarketCode(p));
  const safeSourceUrl=jaySafeHttpsUrl(p.source_url);
  const sourceLink=safeSourceUrl?`<a href="${escapeHtml(safeSourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#3366cc">${escapeHtml(plSourceLabel(p))}</a>`:'尚未接入';
  const effectiveFrom=p.effective_from||p.effective_date||'';
  const effectiveTo=p.effective_to||p.expire_date||'';
  const originalTitle=String(p.title||'').trim();
  let html=`<button class="pl-detail-close" onclick="closePlDetail()">✕</button>
    <h2>${escapeHtml(title)}</h2>
    <div class="pl-detail-sub">${escapeHtml(regionLabel)} · ${escapeHtml(plDomainLabels[plActiveDomain].label)} · ${escapeHtml(plTranslationLabel(p))}</div>
    <div class="pl-detail-section"><h4>来源与核验</h4>
      <div class="pl-detail-grid">
        <div class="pl-detail-item"><b>来源：</b>${sourceLink}</div>
        <div class="pl-detail-item"><b>验证状态：</b>${escapeHtml(evidence.label)}</div>
        <div class="pl-detail-item"><b>发布日期：</b>${escapeHtml(p.published_at||'尚未接入')}</div>
        <div class="pl-detail-item"><b>采集日期：</b>${escapeHtml(p.collected_at?String(p.collected_at).substring(0,10):'尚未接入')}</div>
        <div class="pl-detail-item"><b>生效日期：</b>${escapeHtml(effectiveFrom||'尚未接入')}</div>
        <div class="pl-detail-item"><b>失效日期：</b>${escapeHtml(effectiveTo||'尚未接入')}</div>
      </div>
      <p class="pl-domain-empty-note">核验依据：${escapeHtml(evidence.basis)}。中文译文不改变原始来源的验证结论。</p>
    </div>
    <div class="pl-detail-section"><h4>${escapeHtml(plDomainLabels[plActiveDomain].label)}字段</h4>${plDetailFacts(p,plActiveDomain)}</div>
    <div class="pl-detail-section"><h4>中文内容</h4><div class="pl-detail-item" style="line-height:1.8">${escapeHtml(summary||'中文摘要尚未接入')}</div></div>
    ${originalTitle&&originalTitle!==title?`<details class="pl-detail-section"><summary>查看原文标题</summary><div class="pl-detail-item">${escapeHtml(originalTitle)}</div></details>`:''}
    <div class="pl-detail-section"><button class="filter-button" onclick="toast('已添加预警')">添加预警监控</button><button class="filter-button" onclick="toast('已加入看板')">加入看板</button></div>`;
  $('#pl-detail-modal').innerHTML=html;
  $('#pl-detail-overlay').classList.add('show');
}
function closePlDetail(){$('#pl-detail-overlay').classList.remove('show');}

function plToggleCompliance(){
  var box=document.getElementById('pl-compliance');
  if(!box)return;
  if(box.style.display==='block'){ box.style.display='none'; var l=document.getElementById('pl-list'); if(l)l.style.display=''; return; }
  plRenderCompliance();
  var l=document.getElementById('pl-list'); if(l)l.style.display='none';
}
function plRenderCompliance(){
  var region=(document.getElementById('pl-f-region')||{}).value||plConfiguredMarketCodes()[0]||'all';
  var box=document.getElementById('pl-compliance');
  if(!box)return;
  var items=plGetActiveDomainItems().filter(function(p){ return region==='all'||plRecordMarketCode(p)===region; });
  if(!items.length){ box.innerHTML='<div class="pl-empty"><p>'+escapeHtml(plDomainLabels[plActiveDomain].empty)+'</p></div>'; box.style.display='block'; return; }
  box.innerHTML='<h3 style="margin:6px 0 12px;font-size:16px">当前市场'+escapeHtml(plDomainLabels[plActiveDomain].label)+'清单</h3>'
    + items.slice(0,12).map(function(p){
        var lv=plImpactLabels[p.impact_level]||'常规';
        var desc=plDisplaySummary(p).replace(/\s+/g,' ').slice(0,160);
        var evidence=plAssessEvidence(p);
        return '<div class="pl-comp-card">'
          +'<div class="pl-comp-head"><b>'+escapeHtml(plDisplayTitle(p))+'</b><span class="pl-comp-lv pl-comp-lv-'+(p.impact_level==='high'?'high':(p.impact_level==='medium'?'mid':'low'))+'">'+lv+'影响</span></div>'
          +'<div class="pl-comp-grid">'
          +'<div><span>中文摘要</span><p>'+escapeHtml(desc||'尚未接入')+'</p></div>'
          +'<div><span>来源</span><p>'+escapeHtml(p.source||'未提供')+'</p></div>'
          +'<div><span>数据状态</span><p>'+escapeHtml(evidence.label)+'</p></div>'
          +'<div><span>数据分类</span><p>'+escapeHtml(plDomainCategoryLabels(plActiveDomain)[plDomainTypeValue(p,plActiveDomain)]||'未分类')+'</p></div>'
          +'</div></div>';
      }).join('')
    + '<p style="font-size:11px;color:#9aa29e;margin-top:10px">仅展示来源记录明确提供且通过发布闸门的字段。</p>';
  box.style.display='block';
}
function renderPoliciesPage(){
  var heading=$('#pl-page-heading');if(heading)heading.textContent='政策、税收和准入 · '+plDomainLabels[plActiveDomain].label;
  plRenderDataInfo();
  renderPlStats();
  renderPlAi();
  renderPlList();
}
// Load policies from JSON, then render
loadPoliciesData();


// -- 平台规则 --
// -- Rules page: JSON dynamic loading --
var rulesJsonData = { updated_at:null, source_count:0, items:[] };
var rulesDataLoading = false;

async function loadRulesData() {
  if (rulesDataLoading) return;
  // markets-policies.js is loaded before auth-data.js. Defer the first fetch
  // until the shared data-layer helper is available.
  if (typeof jayFetchMarketData !== 'function') {
    setTimeout(loadRulesData, 0);
    return;
  }
  rulesDataLoading = true;
  renderRlAiLoading();
  $('#rl-data-info').innerHTML = '<span style="color:#3366cc">⏳ 正在加载最新数据...</span>';
  try {
    const data = await jayFetchMarketData('rules', './data/rules.json');
    if (!data) throw new Error('Failed to load rules data');
    if (data && data.items && data.items.length > 0) {
      rulesJsonData = data;
      rlInitFromJson();
      const time = new Date(data.updated_at).toLocaleString('zh-CN');
      $('#rl-data-info').innerHTML = '📡 ' + (window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveMarketNames?window.JAY_MARKET_SCOPE_API.getActiveMarketNames().join('、'):'当前') + '市场规则更新时间: ' + time + ' | 原始数据来源: ' + (data.source_count || '?') + ' 个 | 当前展示已配置平台规则 | 支持版本与生效区间';
      // Refresh alerts linkage
      if (typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
    } else {
      throw new Error('Empty data');
    }
  } catch (e) {
    console.error('Failed to load rules.json; rule records remain empty:', e);
    rulesJsonData = { updated_at:null, source_count:0, items:[] };
    rlInitFromJson();
    $('#rl-data-info').innerHTML = '数据加载失败，当前没有可发布的平台规则记录';
  }
  rulesDataLoading = false;
  if(typeof jayRebuildSearch==='function')jayRebuildSearch();
}

function rlInitFromJson() {
  const items = rlGetJsonItems();
  var scopedPlatformNames = window.JAY_MARKET_SCOPE_API && window.JAY_MARKET_SCOPE_API.getActivePlatformNames
    ? window.JAY_MARKET_SCOPE_API.getActivePlatformNames() : ['Amazon','TikTok Shop','AliExpress','eBay'];
  var marketCodes=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveMarkets
    ? window.JAY_MARKET_SCOPE_API.getActiveMarkets().map(function(m){return m.code;}) : ['US'];
  var marketLabels={}; marketCodes.forEach(function(code){marketLabels[code]=rlMarketLabel(code);});
  fillSelect('#rl-platform', scopedPlatformNames);
  fillSelect('#rl-market', marketCodes, marketLabels);
  fillSelect('#rl-category', Object.keys(rlCategoryLabels).sort(), rlCategoryLabels);
  fillSelect('#rl-act-type', Object.keys(rlActTypeLabels).sort(), rlActTypeLabels);
  var marketSelect=$('#rl-market');
  if(marketSelect && marketCodes.indexOf(marketSelect.value)<0) marketSelect.value=marketCodes[0]||'all';
  rlRulesPage = 1;
  renderRulesPage();
  if(typeof renderOverviewMetrics==='function') renderOverviewMetrics();
  if(typeof renderPlatformProfileStatus==='function') renderPlatformProfileStatus();
}

function rlGetJsonItems() {
  var items = (rulesJsonData && rulesJsonData.items) || [];
  var scopeApi=window.JAY_MARKET_SCOPE_API;
  var scope=window.JAY_MARKET_SCOPE;
  var allowedPlatforms=scopeApi&&scopeApi.getActivePlatformNames ? scopeApi.getActivePlatformNames()
    : (scope && Array.isArray(scope.platformNames) ? scope.platformNames : ['Amazon','TikTok Shop','AliExpress','eBay']);
  var allowedMarkets=scopeApi&&scopeApi.getActiveMarkets ? scopeApi.getActiveMarkets().map(function(m){return m.code;}) : ['US'];
  var scopedItems=items.filter(function(r){
    if(!r) return false;
    var platform=scopeApi && scopeApi.normalizePlatform
      ? scopeApi.normalizePlatform(r.platform)
      : String(r.platform||'').trim();
    if(allowedPlatforms.indexOf(platform)<0) return false;
    var market=scopeApi&&scopeApi.normalizeMarketCode ? scopeApi.normalizeMarketCode(r.market||r.region||r.market_code) : String(r.market||r.region||r.market_code||'').toUpperCase();
    // Only explicit active-market rules enter the formal list. Global records
    // remain in the source JSON as background context and are never relabeled.
    return allowedMarkets.indexOf(market)>=0;
  });
  if(scopeApi && typeof scopeApi.filterFormalRecords==='function'){
    scopedItems=scopeApi.filterFormalRecords(scopedItems,{marketCodes:allowedMarkets,platformKeys:allowedPlatforms},{domain:'rule'});
  }
  return scopedItems.map(function(r){
    var copy=Object.assign({},r);
    var platform=scopeApi && scopeApi.normalizePlatform ? scopeApi.normalizePlatform(copy.platform) : copy.platform;
    copy.platform=platform;
    copy.market=scopeApi&&scopeApi.normalizeMarketCode ? scopeApi.normalizeMarketCode(copy.market||copy.region||copy.market_code) : copy.market;
    return copy;
  });
}

const rlCategoryLabels = {fee:'费用佣金', fulfillment:'物流履约', compliance:'合规要求', penalty:'处罚扣分', category:'类目管理', listing:'商品发布'};
const rlMarketLabels = {US:'美国', EU:'欧洲', SEA:'东南亚', MEA:'中东', LATAM:'拉美', SAS:'南亚', AFR:'非洲', EA:'东亚（日韩）', OCE:'大洋洲', CIS:'独联体', CN:'中国', SG:'新加坡', Global:'全球'};
function rlMarketLabel(code){
  var api=window.JAY_MARKET_SCOPE_API; var market=api&&api.getMarket?api.getMarket(code):null;
  return market ? (market.name||market.label||code) : (rlMarketLabels[code]||code);
}
const rlImpactLabels = {high:'高', medium:'中', low:'低'};
const rlActTypeLabels = {promo:'大促活动', recruit:'招商补贴', challenge:'内容挑战赛', traffic:'流量扶持', commission:'免佣/返现'};

// A rule record may provide these values directly or under rule_fields. The
// UI always renders all seven dimensions; missing values stay explicit rather
// than being inferred from a title or summary.
const rlRuleFieldDefinitions = [
  {key:'fee', label:'费用', aliases:['fee','fees','fee_desc','feeDesc','fee_description','费用','费用说明']},
  {key:'commission', label:'佣金', aliases:['commission','commission_rate','commissionRate','commission_fee','commission_description','佣金','佣金说明']},
  {key:'deposit', label:'保证金', aliases:['deposit','deposit_amount','security_deposit','securityDeposit','margin','保证金','保证金金额']},
  {key:'fulfillment', label:'履约', aliases:['fulfillment','fulfillment_mode','fulfillmentMode','shipping','logistics','物流','履约','履约方式']},
  {key:'prohibited', label:'禁售', aliases:['prohibited','prohibited_items','prohibitedItems','prohibited_goods','restricted','禁售','禁售商品','限制销售']},
  {key:'settlement', label:'结算', aliases:['settlement','settlement_cycle','settlementCycle','payout','payout_schedule','payment','结算','结算周期']},
  {key:'penalty', label:'处罚', aliases:['penalty','penalties','penalty_rules','penaltyRules','penalty_description','violation_penalty','处罚','处罚规则','扣分']},
];

function rlRuleValueText(value){
  if(value===undefined||value===null)return '';
  if(Array.isArray(value))return value.map(rlRuleValueText).filter(Boolean).join('、');
  if(typeof value==='object'){
    return rlRuleValueText(value.value!==undefined?value.value:(value.text!==undefined?value.text:(value.label!==undefined?value.label:'')));
  }
  return String(value).trim();
}

function rlRuleFieldValue(rule,definition){
  rule=rule||{};
  var bags=[rule.rule_fields,rule.ruleFields,rule.platform_rule_fields,rule.platformRuleFields,rule.fields,rule];
  var aliases=(definition.aliases||[]).map(function(alias){return String(alias).replace(/[\s_-]/g,'').toLowerCase();});
  for(var i=0;i<bags.length;i++){
    var bag=bags[i];
    if(!bag||typeof bag!=='object')continue;
    var keys=Object.keys(bag);
    for(var j=0;j<keys.length;j++){
      var key=String(keys[j]).replace(/[\s_-]/g,'').toLowerCase();
      if(aliases.indexOf(key)<0)continue;
      var text=rlRuleValueText(bag[key]);
      if(text)return text;
    }
  }
  return '';
}

function rlRuleFieldsHtml(rule){
  return '<div class="info-grid rl-rule-fields-grid">'+rlRuleFieldDefinitions.map(function(definition){
    var value=rlRuleFieldValue(rule,definition);
    return '<div class="info-item rl-rule-field'+(value?'':' is-missing')+'" data-rule-field="'+definition.key+'"><div class="lbl">'+definition.label+'</div><div class="val">'+escapeHtml(value||'尚未接入')+'</div></div>';
  }).join('')+'</div><p class="rl-rule-fields-note">字段只显示来源记录明确提供的内容；未提供的维度不会从其他平台或全球规则推断。</p>';
}

function rlRuleVersionLabel(rule){
  var value=rule&&(rule.rule_version||rule.ruleVersion||rule.version||rule.version_label||rule.versionLabel);
  return rlRuleValueText(value)||'版本号未提供';
}

function rlRuleIdentity(rule){
  rule=rule||{};
  return String(rule.rule_key||rule.ruleKey||rule.rule_id||rule.ruleId||rule.id||[rule.platform,rule.market,rule.title].join('|'));
}

function rlRuleHistoryRecords(rule){
  rule=rule||{};
  var embedded=rule.version_history||rule.versionHistory||rule.history;
  var records=Array.isArray(embedded)?embedded.slice():[];
  var catalog=rulesJsonData&&(rulesJsonData.versions||rulesJsonData.version_history||rulesJsonData.history);
  if(Array.isArray(catalog)){
    var identity=rlRuleIdentity(rule);
    records=records.concat(catalog.filter(function(item){
      if(!item||typeof item!=='object')return false;
      var sameIdentity=String(item.rule_key||item.ruleKey||item.rule_id||item.ruleId||'')===identity;
      var sameScope=String(item.platform||'')===String(rule.platform||'')&&String(item.market||'')===String(rule.market||'');
      var sameTitle=String(item.title||'')===String(rule.title||'');
      return sameIdentity||(!item.rule_key&&!item.ruleKey&&!item.rule_id&&!item.ruleId&&sameScope&&sameTitle);
    }));
  }
  var seen={};
  return records.filter(function(item){
    if(!item||typeof item!=='object')return false;
    var key=String(item.id||item.rule_version||item.version||item.effective_date||item.published_at||JSON.stringify(item));
    if(seen[key])return false;
    seen[key]=true;
    return true;
  }).sort(function(a,b){
    var ad=String(a.effective_date||a.effective_from||a.published_at||'');
    var bd=String(b.effective_date||b.effective_from||b.published_at||'');
    return bd.localeCompare(ad);
  });
}

function rlRuleVersionHistoryHtml(rule){
  var records=rlRuleHistoryRecords(rule);
  if(!records.length)return '<p class="rl-version-empty" data-version-status="not-connected">暂无已验证历史版本记录。当前记录版本：'+escapeHtml(rlRuleVersionLabel(rule))+'。</p>';
  return '<div class="rl-version-history" data-version-history="'+escapeHtml(rlRuleIdentity(rule))+'">'+records.map(function(item){
    var date=item.effective_date||item.effective_from||item.published_at||'日期未提供';
    var end=item.effective_to||item.effectiveTo||'';
    var label=rlRuleVersionLabel(item);
    var summary=rlRuleValueText(item.change_summary||item.changeSummary||item.summary||item.title)||'来源未提供变更说明';
    return '<div class="rl-version-row"><div><b>'+escapeHtml(label)+'</b><span>'+escapeHtml(String(date)+(end?' 至 '+end:''))+'</span></div><p>'+escapeHtml(summary)+'</p></div>';
  }).join('')+'</div>';
}

function renderRlAiLoading(){
  var el=$('#ai-rules');
  if(!el)return;
  var api=window.JAY_MARKET_SCOPE_API;
  var names=api&&api.getActiveMarketNames?api.getActiveMarketNames():[];
  var label=names.length?names.join('、')+'市场':'当前市场';
  el.innerHTML='<div class="ai-panel" data-ai-state="loading"><div class="ai-header"><div class="ai-tabs"><span class="ai-tab active">规则变动洞察</span></div></div><div class="ai-loading-state">正在读取'+escapeHtml(label)+'已验证的平台规则...</div></div>';
}

// Initialize filters while the verified JSON loads.
var rlPlatformNames = window.JAY_MARKET_SCOPE
  ? window.JAY_MARKET_SCOPE.platformNames.slice()
  : ['Amazon','TikTok Shop','AliExpress','eBay'];
fillSelect('#rl-platform', rlPlatformNames);
var rlInitialMarketCodes=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveMarkets
  ? window.JAY_MARKET_SCOPE_API.getActiveMarkets().map(function(m){return m.code;}) : ['US'];
var rlInitialMarketLabels={};rlInitialMarketCodes.forEach(function(code){rlInitialMarketLabels[code]=rlMarketLabel(code);});
fillSelect('#rl-market', rlInitialMarketCodes, rlInitialMarketLabels);
fillSelect('#rl-category', Object.keys(rlCategoryLabels).sort(), rlCategoryLabels);
fillSelect('#rl-act-type', Object.keys(rlActTypeLabels).sort(), rlActTypeLabels);

var rlRulesPage=1,rlActPage=1;const RL_PAGE=8;
let rlChecked=new Set();

// Stats
function renderRlStats(){
  const items=getFilteredRules();
  const acts=getFilteredActs();
  const highCount=items.filter(r=>r.impact_level==='high').length;
  const pendingCount=items.filter(r=>{const d=r.effective_date;return d&&new Date(d)>new Date()}).length;
  const activeActs=acts.filter(a=>parseInt(a[11])>0).length;
  const highSubsidy=acts.filter(a=>a[7].includes('免佣金')||a[7].includes('返现')).length;
  const platforms=new Set(items.map(r=>r.platform));
  $('#rl-stats-grid').innerHTML=[
    ['规则总数',items.length+'条','实时追踪','#3366cc'],
    ['高影响规则',highCount+'条','重点关注','#e74c3c'],
    ['待执行规则',pendingCount+'条','需提前准备','#e67e22'],
    ['覆盖平台',platforms.size+'个','多维度监控','#16a34a']
  ].map(s=>'<div class="rl-stat-card"><div class="val" style="color:'+s[3]+'">'+s[1]+'</div><div class="lbl">'+s[0]+'</div><div class="sub">'+s[2]+'</div></div>').join('');
}

// AI
function renderRlAi(){
  $('#ai-rules').innerHTML='<div class="ai-panel"><div class="ai-header"><div class="ai-tabs" id="rl-ai-tabs"><span class="ai-tab active" data-t="rule" onclick="switchRlAiTab(\'rule\')">规则变动洞察</span><span class="ai-tab" data-t="act" onclick="switchRlAiTab(\'act\')">平台活动洞察</span></div><button class="ai-regen" onclick="renderRlAi()">🔄 刷新</button></div><div id="rl-ai-content"></div><small style="color:#999;font-size:11px">内容仅来自当前范围规则记录</small></div>';
  switchRlAiTab('rule');
}
function switchRlAiTab(t){
  $$('#rl-ai-tabs .ai-tab').forEach(e=>e.classList.toggle('active',e.dataset.t===t));
  if(t==='rule'){
    const items=getFilteredRules();
    const highItems=items.filter(r=>r.impact_level==='high').slice(0,3);
    const aiHtml=highItems.length?highItems.map(r=>'<li>⚠️ <strong>'+escapeHtml(r.platform)+'</strong> '+escapeHtml((r.title||r.summary||'').substring(0,60))+' <button class="ai-action" onclick="rlLocate(\'rule\',\''+escInline(r.platform)+'\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">加入预警</button></li>').join(''):'<li>暂无高影响规则</li>';
    $('#rl-ai-content').innerHTML='<ul>'+aiHtml+'</ul>';
  } else {
    const acts=getFilteredActs().filter(a=>parseInt(a[11])>0).slice(0,5);
    const aiHtml=acts.length?acts.map((a,i)=>{
      const label=rlActTypeLabels[rlActTypeGroup(a[1])] || a[1];
      const countdown=rlCountdown(a[11]);
      return '<li>'+(i===0?'🔥':i===1?'🆕':'💡')+' <strong>'+escapeHtml(a[0])+'</strong> '+label+' — '+a[7].substring(0,45)+(a[7].length>45?'…':'')+' '+countdown+' <button class="ai-action" onclick="rlLocate(\'act\',\''+escInline(a[0])+'\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">报名预警</button></li>';
    }).join(''):'<li>暂无近期活动</li>';
    $('#rl-ai-content').innerHTML='<ul>'+aiHtml+'</ul>';
  }
}
function rlLocate(type,name){
  if(type==='rule'){switchRlTab('rules');const items=rlGetJsonItems();const idx=items.findIndex(r=>r.platform===name||r.title.includes(name));if(idx>=0){rlRulesPage=Math.floor(idx/RL_PAGE)+1;renderRlRules();setTimeout(()=>{const el=document.querySelector('.rl-rule-card[data-idx="'+idx+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},100)}}
  else{switchRlTab('activities');const idx=activitiesData.findIndex(a=>a[0]===name);if(idx>=0){rlActPage=Math.floor(idx/RL_PAGE)+1;renderRlActs();setTimeout(()=>{const el=document.querySelector('.rl-act-card[data-idx="'+idx+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},100)}}
}

// Tab switch
function switchRlTab(tab){
  $$('.rl-tab').forEach(e=>e.classList.toggle('active',e.dataset.tab===tab));
  $$('.rl-tab-panel').forEach(e=>e.classList.remove('active'));
  $('#rl-panel-'+tab).classList.add('active');
  if(tab==='rules')renderRlRules();else renderRlActs();
}

// Get countdown
function rlCountdown(dateStr){
  if(dateStr==='已截止')return '<span class="rl-countdown rl-countdown-done">已截止</span>';
  const d=parseInt(dateStr);
  if(d<=0)return '<span class="rl-countdown rl-countdown-done">已截止</span>';
  if(d<=3)return '<span class="rl-countdown rl-countdown-urgent">⏰ '+d+'天</span>';
  if(d<=7)return '<span class="rl-countdown rl-countdown-warn">'+d+'天</span>';
  return '<span class="rl-countdown rl-countdown-ok">'+d+'天</span>';
}

// Rule type class (by category code or Chinese label)
function rlTypeClass(type){
  if(!type) return 'rl-type-other';
  if(type==='fee' || type.includes('费用') || type.includes('佣金')) return 'rl-type-commission';
  if(type==='fulfillment' || type.includes('物流')) return 'rl-type-logistics';
  if(type==='penalty' || type.includes('处罚') || type.includes('扣分')) return 'rl-type-penalty';
  if(type==='category' || type.includes('类目')) return 'rl-type-restriction';
  if(type==='listing' || type.includes('商品') || type.includes('发布')) return 'rl-type-other';
  if(type==='compliance' || type.includes('合规')) return 'rl-type-other';
  return 'rl-type-other';
}

// Act type group: map detailed activity type to simplified category
function rlActTypeGroup(type){
  if(!type) return 'promo';
  if(type.includes('大促')) return 'promo';
  if(type.includes('招商') || type.includes('扶持') || type.includes('新卖家')) return 'recruit';
  if(type.includes('挑战赛')) return 'challenge';
  if(type.includes('流量')) return 'traffic';
  if(type.includes('免佣') || type.includes('返现') || type.includes('补贴')) return 'commission';
  return 'promo';
}

// Act type class
function rlActTypeClass(type){
  const g=rlActTypeGroup(type);
  if(g==='promo') return 'rl-act-promo';
  if(g==='recruit') return 'rl-act-recruit';
  if(g==='challenge') return 'rl-act-challenge';
  if(g==='traffic') return 'rl-act-traffic';
  if(g==='commission') return 'rl-act-commission-free';
  return 'rl-act-promo';
}

// Rules list
function renderRlRules(){
  const filtered=getFilteredRules();
  const total=filtered.length;
  const pages=Math.max(1,Math.ceil(total/RL_PAGE));
  if(rlRulesPage>pages)rlRulesPage=pages;
  const start=(rlRulesPage-1)*RL_PAGE;
  const slice=filtered.slice(start,start+RL_PAGE);
  const list=$('#rl-rules-list');
  if(!slice.length){list.innerHTML='<div class="empty-state"><p>暂无匹配规则</p><button onclick="resetRlFilters()" class="btn-primary">清除筛选</button></div>';$('#rl-rules-pagination').innerHTML='';return}
  list.innerHTML=slice.map((r,si)=>{
    const globalIdx=rlGetJsonItems().findIndex(item=>item.id===r.id);
    const riskLevel=r.impact_level==='high'?'high':r.impact_level==='medium'?'mid':'low';
    const impactColor=r.impact_level==='high'?'#e74c3c':r.impact_level==='medium'?'#f39c12':'#27ae60';
    const impactLabel=rlImpactLabels[r.impact_level]||r.impact_level;
    const catLabel=rlCategoryLabels[r.category]||r.category;
    const marketLabel=rlMarketLabel(r.market);
    const effDate=r.effective_date||r.published_at||'';
    const days=effDate?Math.ceil((new Date(effDate)-new Date())/86400000):0;
    const isFuture=days>0;
    const safeSourceUrl=jaySafeHttpsUrl(r.source_url);
    const titleLink=safeSourceUrl?`<a href="${escapeHtml(safeSourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${escapeHtml(r.title)}</a>`:escapeHtml(r.title);
    return '<div class="rl-rule-card" data-idx="'+globalIdx+'">'
    +'<div class="rl-risk-bar rl-risk-'+riskLevel+'"></div>'
    +'<div class="rl-card-body">'
    +'<h4><input type="checkbox" class="rl-check" data-idx="'+escapeHtml(String(r.id||''))+'" '+((rlChecked.has(r.id))?'checked':'')+' onchange="rlToggleCheck(\''+escInline(r.id||'')+'\')"> '+titleLink+' <span class="tag" style="color:'+impactColor+';border-color:'+impactColor+'">'+escapeHtml(catLabel)+'</span></h4>'
    +'<div class="rl-card-meta"><span>📅 '+escapeHtml(r.published_at||'')+'</span><span class="tag watch">'+escapeHtml(marketLabel)+'</span><span>'+escapeHtml(r.platform||'')+'</span>'
    +(isFuture?'<span class="rl-countdown '+(days<=7?(days<=3?'rl-countdown-urgent':'rl-countdown-warn'):'rl-countdown-ok')+'">'+days+'天后生效</span>':'<span class="rl-countdown rl-countdown-ok">已生效</span>')
    +'<span class="rl-rule-version" data-rule-version="'+escapeHtml(rlRuleVersionLabel(r))+'">版本：'+escapeHtml(rlRuleVersionLabel(r))+'</span>'
    +'</div>'
    +'<div class="rl-card-summary">'+escapeHtml((r.summary||'').substring(0,80))+((r.summary||'').length>80?'…':'')+'</div>'
    +'</div>'
    +'<div class="rl-card-actions">'
    +'<button onclick="openRlRuleDetail('+globalIdx+')">查看详情</button>'
    +'<button onclick="toast(\'已添加预警\')">添加预警</button>'
    +'</div></div>';
  }).join('');
  // pagination
  let pHtml='';
  for(let i=1;i<=pages;i++)pHtml+='<button class="'+(i===rlRulesPage?'active':'')+'" onclick="rlRulesPage='+i+';renderRlRules()">'+i+'</button>';
  $('#rl-rules-pagination').innerHTML=pHtml;
  $('#rl-count').textContent='规则 '+getFilteredRules().length+' 条 | 活动 '+getFilteredActs().length+' 条';
}

// Activities list
function renderRlActs(){
  const filtered=getFilteredActs();
  const total=filtered.length;
  const pages=Math.max(1,Math.ceil(total/RL_PAGE));
  if(rlActPage>pages)rlActPage=pages;
  const start=(rlActPage-1)*RL_PAGE;
  const slice=filtered.slice(start,start+RL_PAGE);
  const list=$('#rl-activities-list');
  if(!slice.length){list.innerHTML='<div class="empty-state"><p>暂无匹配活动</p><button onclick="resetRlFilters()" class="btn-primary">清除筛选</button></div>';$('#rl-act-pagination').innerHTML='';return}
  list.innerHTML=slice.map((a,si)=>{
    const globalIdx=activitiesData.indexOf(a);
    const ext=actExtData[globalIdx]||{hotLevel:'mid',lastGMV:'-',avgROI:'-',riskWarn:'',benefit:a[7]};
    return '<div class="rl-act-card" data-idx="'+globalIdx+'">'
    +'<div class="rl-risk-bar rl-risk-'+(ext.hotLevel==='high'?'high':ext.hotLevel==='mid'?'mid':'low')+'"></div>'
    +'<div class="rl-card-body">'
    +'<h4><input type="checkbox" class="rl-check" data-idx="a'+globalIdx+'" onchange="rlToggleCheck(\'a'+globalIdx+'\')"> '+a[0]+' · '+rlActTypeLabels[rlActTypeGroup(a[1])]+' <span class="rl-act-type '+rlActTypeClass(a[1])+'">'+rlActTypeLabels[rlActTypeGroup(a[1])]+'</span></h4>'
    +'<div class="rl-card-meta"><span>📅 '+a[3]+' ~ '+a[4]+'</span><span class="tag watch">'+a[5]+'</span><span>主推: '+a[10]+'</span>'+rlCountdown(a[11])+'</div>'
    +'<div class="rl-card-summary">'+a[7].substring(0,80)+(a[7].length>80?'…':'')+'</div>'
    +(ext.riskWarn?'<div class="rl-act-risk-warn">⚠️ '+ext.riskWarn+'</div>':'')
    +'</div>'
    +'<div class="rl-card-actions">'
    +'<button onclick="openRlActDetail('+globalIdx+')">活动详情</button>'
    +'<button onclick="toast(\'已添加报名预警\')">报名预警</button>'
    +'<button class="btn-primary" onclick="switchPage(\'products\');toast(\'已跳转爆款雷达\')">热销品</button>'
    +'</div></div>';
  }).join('');
  let pHtml='';
  for(let i=1;i<=pages;i++)pHtml+='<button class="'+(i===rlActPage?'active':'')+'" onclick="rlActPage='+i+';renderRlActs()">'+i+'</button>';
  $('#rl-act-pagination').innerHTML=pHtml;
}

// Filter logic
function getFilteredRules(){
  const p=$('#rl-platform').value,m=$('#rl-market').value,cat=$('#rl-category').value,impact=$('#rl-impact-level').value;
  const items=rlGetJsonItems();
  var api=window.JAY_MARKET_SCOPE_API;
  return items.filter(r=>(p==='all'||r.platform===p)&&(m==='all'||(api&&api.normalizeMarketCode?api.normalizeMarketCode(r.market) : r.market)===m)&&(cat==='all'||r.category===cat)&&(impact==='all'||r.impact_level===impact));
}
function getFilteredActs(){
  const p=$('#rl-platform').value,at=$('#rl-act-type').value,m=$('#rl-market').value;
  const marketName = m==='all' ? null : rlMarketLabel(m);
  const market=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getMarket?window.JAY_MARKET_SCOPE_API.getMarket(m):null;
  const marketRegion=market ? (market.regionName||market.name||market.label) : marketName;
  var allowedPlatforms = window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.platformNames : ['Amazon','TikTok Shop','AliExpress','eBay'];
  return activitiesData.filter(a=>{
    // activitiesData stores a display label such as "Amazon北美" in a[0]
    // and the canonical platform in a[12]; prefer the latter for filtering.
    const activityPlatform=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.normalizePlatform
      ? window.JAY_MARKET_SCOPE_API.normalizePlatform(a[12] || a[0]) : (a[12] || a[0]);
    const matchPlatform = p==='all' || activityPlatform===p;
    const matchType = at==='all' || rlActTypeGroup(a[1])===at;
    const matchMarket = !marketName || a[5]===marketName || a[5]===marketRegion || a[5]===m;
    return allowedPlatforms.indexOf(activityPlatform)>=0 && matchPlatform && matchType && matchMarket;
  });
}

// Main render
function renderRulesPage(){
renderRlStats();renderRlAi();renderRlRules();renderRlActs();}

// Checkboxes
function rlToggleCheck(idx){if(rlChecked.has(idx))rlChecked.delete(idx);else rlChecked.add(idx);updateRlSelectedCount()}
function updateRlSelectedCount(){const n=rlChecked.size;$('#rl-selected-count').textContent=n>0?n+' items selected':''}
$('#rl-select-all').onchange=function(){const checks=$$('.rl-check');if(this.checked)checks.forEach(c=>{const idx=c.dataset.idx;rlChecked.add(isNaN(idx)?idx:parseInt(idx));c.checked=true});else{rlChecked.clear();checks.forEach(c=>c.checked=false)}updateRlSelectedCount()};

// Batch ops
function rlBatchAlert(){if(!rlChecked.size){toast('请先选择条目');return}toast('已为'+rlChecked.size+'项开启预警')}
function rlBatchWatch(){if(!rlChecked.size){toast('请先选择条目');return}toast('已加入看板'+rlChecked.size+'项')}
function rlExport(){toast('报表导出中…')}

// Reset
function resetRlFilters(){
  ['#rl-platform','#rl-market','#rl-category','#rl-impact-level','#rl-act-type'].forEach(s=>$(s).value='all');
  var marketSelect=$('#rl-market');
  var defaultMarket=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveMarkets?window.JAY_MARKET_SCOPE_API.getActiveMarkets()[0]:null;
  if(marketSelect) marketSelect.value=defaultMarket?defaultMarket.code:'all';
  rlRulesPage=1;rlActPage=1;rlChecked.clear();
  if(window.__CP_JAY_CTX && typeof jayRulesContext==='function')jayRulesContext({platform:'all',market:defaultMarket?defaultMarket.code:'all',category:'all',impact:'all',actType:'all'});
  renderRulesPage();renderRlActs();renderRlStats();renderRlAi();toast('筛选已重置');
}

// Detail - Rule
function openRlRuleDetail(idx){
  const items=rlGetJsonItems();
  const r=items[idx];
  if(!r)return;
  const riskLevel=r.impact_level==='high'?'high':r.impact_level==='medium'?'mid':'low';
  const impactColor=r.impact_level==='high'?'#e74c3c':r.impact_level==='medium'?'#f39c12':'#27ae60';
  const impactLabel=rlImpactLabels[r.impact_level]||r.impact_level;
  const catLabel=rlCategoryLabels[r.category]||r.category;
  const marketLabel=rlMarketLabel(r.market);
  const safeSourceUrl=jaySafeHttpsUrl(r.source_url);
  const sourceLink=safeSourceUrl?`<a href="${escapeHtml(safeSourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#3366cc">查看原始来源</a>`:`<span class="src-missing">⚠️ 待补充来源</span>`;
  const effectiveTo=r.effective_to||r.effectiveTo||'';
  const versionLabel=rlRuleVersionLabel(r);
  const overlay=document.createElement('div');
  overlay.className='rl-detail-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML='<div class="rl-detail-modal"><button class="close-btn" onclick="this.closest(\'.rl-detail-overlay\').remove()">×</button>'
  +'<h2>'+escapeHtml(r.title||'')+'</h2>'
   +'<div class="rl-detail-section"><h3>📋 基础信息</h3><div class="info-grid">'
   +'<div class="info-item"><div class="lbl">平台</div><div class="val">'+escapeHtml(r.platform||'')+'</div></div>'
   +'<div class="info-item"><div class="lbl">规则类别</div><div class="val"><span class="tag" style="color:'+impactColor+'">'+escapeHtml(catLabel)+'</span></div></div>'
    +'<div class="info-item"><div class="lbl">生效日期</div><div class="val">'+escapeHtml(r.effective_date||r.published_at||'N/A')+'</div></div>'
   +'<div class="info-item"><div class="lbl">规则版本</div><div class="val" data-rule-version="'+escapeHtml(versionLabel)+'">'+escapeHtml(versionLabel)+'</div></div>'
   +'<div class="info-item"><div class="lbl">结束日期</div><div class="val">'+escapeHtml(effectiveTo||'尚未接入')+'</div></div>'
    +'<div class="info-item"><div class="lbl">影响市场</div><div class="val">'+escapeHtml(marketLabel)+'</div></div>'
  +'<div class="info-item"><div class="lbl">影响等级</div><div class="val" style="color:'+impactColor+'">'+(r.impact_level==='high'?'🔴 高':r.impact_level==='medium'?'🟡 中':'🔵 低')+'</div></div>'
  +'<div class="info-item"><div class="lbl">来源链接</div><div class="val">'+sourceLink+'</div></div>'
   +'</div></div>'
   +'<div class="rl-detail-section"><h3>📌 平台规则字段</h3>'+rlRuleFieldsHtml(r)+'</div>'
    +'<div class="rl-detail-section"><h3>📝 规则详情</h3><p>'+escapeHtml(r.summary||r.title||'暂无详细摘要')+'</p></div>'
   +'<div class="rl-detail-section"><h3>🕘 版本与历史变化</h3>'+rlRuleVersionHistoryHtml(r)+'</div>'
  +'<div class="rl-detail-section"><h3>✅ 后续动作</h3><p>请根据原始来源、发布日期和生效日期复核该规则，再制定平台合规动作。</p></div>'
  +'<div class="rl-detail-section"><h3>🔗 关联联动</h3><p>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'alerts\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看预警中心</button>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'policies\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看政策动态</button>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'platforms\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看平台档案</button>'
  +'</p></div>'
  +'</div>';
  document.body.appendChild(overlay);
}

// Detail - Activity
function openRlActDetail(idx){
  const a=activitiesData[idx];
  const ext=actExtData[idx]||{hotLevel:'mid',lastGMV:'-',avgROI:'-',riskWarn:'',benefit:a[7]};
  const overlay=document.createElement('div');
  overlay.className='rl-detail-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML='<div class="rl-detail-modal"><button class="close-btn" onclick="this.closest(\'.rl-detail-overlay\').remove()">×</button>'
  +'<h2>'+a[0]+' · '+a[1]+'</h2>'
  +'<div class="rl-detail-section"><h3>📋 活动基础信息</h3><div class="info-grid">'
  +'<div class="info-item"><div class="lbl">平台</div><div class="val">'+a[0]+'</div></div>'
  +'<div class="info-item"><div class="lbl">活动类型</div><div class="val"><span class="rl-act-type '+rlActTypeClass(a[1])+'">'+rlActTypeLabels[rlActTypeGroup(a[1])]+'</span></div></div>'
  +'<div class="info-item"><div class="lbl">报名时间</div><div class="val">'+a[2]+' ~ '+a[3]+'</div></div>'
  +'<div class="info-item"><div class="lbl">活动周期</div><div class="val">'+a[3]+' ~ '+a[4]+'</div></div>'
  +'<div class="info-item"><div class="lbl">覆盖区域</div><div class="val">'+a[5]+'</div></div>'
  +'<div class="info-item"><div class="lbl">报名倒计时</div><div class="val">'+rlCountdown(a[11])+'</div></div>'
  +'</div></div>'
  +'<div class="rl-detail-section"><h3>🎁 扶持政策</h3><div class="rl-act-benefit">'+a[7]+'</div></div>'
  +'<div class="rl-detail-section"><h3>📝 准入条件</h3><div class="info-grid">'
  +'<div class="info-item"><div class="lbl">店铺要求</div><div class="val">'+a[8]+'</div></div>'
  +'<div class="info-item"><div class="lbl">店铺类型</div><div class="val">'+a[9]+'（'+a[6]+'）</div></div>'
  +'<div class="info-item"><div class="lbl">主推类目</div><div class="val">'+a[10]+'</div></div>'
  +'<div class="info-item"><div class="lbl">热度</div><div class="val">'+(ext.hotLevel==='high'?'🔥 高':ext.hotLevel==='mid'?'⭐ 中':'📌 低')+'</div></div>'
  +'</div></div>'
  +'<div class="rl-detail-section"><h3>📊 历史数据参考</h3><table class="cost-table"><tr><th>指标</th><th>数据</th></tr>'
  +'<tr><td>往期GMV</td><td>'+ext.lastGMV+'</td></tr>'
  +'<tr><td>平均ROI</td><td>'+ext.avgROI+'</td></tr>'
  +'</table></div>'
  +(ext.riskWarn?'<div class="rl-detail-section"><h3>⚠️ 风险提示</h3><div class="rl-act-risk-warn">'+ext.riskWarn+'</div></div>':'')
  +'<div class="rl-detail-section"><h3>💡 AI 运营建议</h3><p>'
  +(ext.hotLevel==='high'?'高热度活动，建议重点参与。提前备货主推类目商品，预留广告投放预算。':'建议参与，关注准入条件和报名截止时间。')
  +' 结合爆款雷达查看活动热销商品数据，优化选品策略。</p></div>'
  +'<div class="rl-detail-section"><h3>🔗 关联联动</h3><p>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'products\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看爆款雷达</button>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'platforms\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看平台档案</button>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'alerts\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">添加报名预警</button>'
  +'</p></div>'
  +'</div>';
  document.body.appendChild(overlay);
}

$('#apply-rl').onclick=()=>{rlRulesPage=1;rlActPage=1;renderRulesPage();renderRlActs();renderRlStats();renderRlAi();if(window.__CP_JAY_CTX&&typeof jayRulesContext==='function')jayRulesContext({platform:$('#rl-platform').value,market:$('#rl-market').value,category:$('#rl-category').value,impact:$('#rl-impact-level').value,actType:$('#rl-act-type').value});rlSyncToOtherBoards();const f=getFilteredRules().length+getFilteredActs().length;toast('已筛选 '+f+' 条结果')};
$('#reset-rl').onclick=()=>{resetRlFilters();rlSyncToOtherBoards();};

// 平台规则筛选器 ↔ 其他板块联动
function rlSyncToOtherBoards(){
  var m=$('#rl-market').value, c=$('#rl-category').value;
  if(window.__CP_JAY_CTX && typeof jayRulesContext==='function')jayRulesContext({platform:$('#rl-platform').value,market:m,category:c,impact:$('#rl-impact-level').value,actType:$('#rl-act-type').value});
  // 同步到政策动态页
  if(m!=='all'){
    var plRegion=$('#pl-f-region');
    if(plRegion) plRegion.value=m;
  }
  if(c!=='all'){
    var ruleToPolicy={'fee':'tariff','fulfillment':'customs','compliance':'compliance','penalty':'ban','category':'certification','listing':'regulation'};
    var plCat=$('#pl-f-category');
    if(plCat && ruleToPolicy[c]) plCat.value=ruleToPolicy[c];
  }
  // 如果当前在政策页，立即重新渲染
  var policyPage=document.getElementById('policies');
  if(policyPage && policyPage.classList.contains('active') && typeof renderPoliciesPage==='function'){
    renderPoliciesPage();
  }
  // 刷新预警中心
  if(typeof refreshDynamicAlerts==='function') refreshDynamicAlerts();
}

function jayRefreshPolicyRuleScope(){
  if(typeof plInitFromJson==='function')plInitFromJson();
  if(typeof rlInitFromJson==='function')rlInitFromJson();
  if(typeof refreshDynamicAlerts==='function')refreshDynamicAlerts();
}
if(window.addEventListener)window.addEventListener('jay:market-scope-change',jayRefreshPolicyRuleScope);
// Load rules from JSON, then render
loadRulesData();

// -- 热门内容 --
