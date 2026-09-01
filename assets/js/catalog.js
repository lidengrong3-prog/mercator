var jayWorkspaceAssetCache = {};

function jayGetWorkspaceAsset(type, fallback) {
  if (!jayWorkspaceAssetCache) jayWorkspaceAssetCache = {};
  return Object.prototype.hasOwnProperty.call(jayWorkspaceAssetCache, type)
    ? jayWorkspaceAssetCache[type]
    : fallback;
}

function jayFmtTime(input) {
  if(!input) return '';
  var d = new Date(input);
  if(isNaN(d.getTime())) return String(input);
  var diff = (Date.now() - d.getTime()) / 1000;
  if(diff < 0) diff = 0;
  if(diff < 60) return '刚刚';
  if(diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if(diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if(diff < 86400 * 30) return Math.floor(diff / 86400) + '天前';
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + month + '-' + day;
}

function toast(message) {
  var element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  setTimeout(function(){ element.classList.remove('show'); }, 2400);
}

// Scope identity only. Market metrics are loaded from sourced country records;
// this list never invents macro values and is rebuilt when the active market
// changes.
let countries=[];
const alerts=[];
const alertsFull=[];
const products=[];
const shops=[];
let platformsData=[];
let pfExtData={};
let platformSourceData=[];

function jayMarketIdentityRecords(){
  var api=window.JAY_MARKET_SCOPE_API;
  var markets=api&&api.getActiveMarkets?api.getActiveMarkets():[];
  return markets.map(function(m){ return [(m.flag||'🌐'), m.name||m.label||m.code, m.name||m.label||m.code, '', '', '']; });
}
function jaySyncCountryIdentityRecords(){
  countries=jayMarketIdentityRecords();
  window.countries=countries;
  if(typeof renderOvCountries==='function')renderOvCountries();
}

function jayApplyPlatformDataScope(){
  var data=Array.isArray(platformSourceData)?platformSourceData:[];
  var api=window.JAY_MARKET_SCOPE_API;
  var scopedPlatformRecords=api&&api.filterPlatforms
    ? api.filterPlatforms(data,function(d){return d&&d.name;}) : data;
  platformsData=scopedPlatformRecords.map(function(d){
    var name=api&&api.normalizePlatform?api.normalizePlatform(d.name):d.name;
    return [name||'',d.region||'',d.categories||'',d.gmv||'',d.fee||'',d.feeDesc||'',d.type||'',d.mau||'',d.updates||''];
  });
  pfExtData={};
  scopedPlatformRecords.forEach(function(d){
    if(d.ext&&Object.keys(d.ext).length){
      var key=api&&api.normalizePlatform?api.normalizePlatform(d.name):d.name;
      pfExtData[key]=Object.assign({},pfExtData[key]||{},d.ext);
    }
  });
  if(typeof fillSelect==='function'){
    fillSelect('#pf-f-region',[...new Set(platformsData.map(function(p){return p[1];}))].sort());
    fillSelect('#pf-f-type',[...new Set(platformsData.map(function(p){return p[6];}))].sort());
  }
  if(typeof syncPlatformScopeUi==='function')syncPlatformScopeUi();
}

jaySyncCountryIdentityRecords();

// -- 动态加载平台数据 --
var JAY_SUPABASE_URL = 'https://ftlzofrnosgvdvwajhuz.supabase.co';
var JAY_SUPABASE_KEY = 'sb_publishable_y2zfDKmuW9Lj4gUqIYKpxw_COuX1JQQ';
// 提前初始化数据层基址，避免顶层 loadXxx() 调用时 JAY_API_URL 仍为 undefined（var 提升 bug 导致 Supabase 主路径失效，每次启动白费 4 次废请求）
var JAY_API_URL = JAY_SUPABASE_URL + '/rest/v1';
var JAY_ANON_KEY = JAY_SUPABASE_KEY;

function jayCatalogPayload(raw){
  raw=raw||{};
  return {
    markets:Array.isArray(raw.markets)?raw.markets.map(function(item){ var metadata=item.metadata&&typeof item.metadata==='object'?item.metadata:{}; return Object.assign({},item,{dataStatus:item.dataStatus||item.data_status,platformKeys:item.platformKeys||item.platform_keys||[],categoryKeys:item.categoryKeys||item.category_keys||[],jurisdictionCodes:item.jurisdictionCodes||item.jurisdiction_codes||[],regionCode:item.regionCode||item.region_code,regionName:item.regionName||item.region_name,dataSources:item.dataSources||item.data_sources||metadata.dataSources||metadata.data_sources||{}}); }):[],
    platforms:Array.isArray(raw.platforms)?raw.platforms.map(function(item){ return Object.assign({},item,{dataStatus:item.dataStatus||item.data_status}); }):[],
    marketPlatforms:Array.isArray(raw.marketPlatforms)?raw.marketPlatforms.map(function(item){ return Object.assign({},item,{marketCode:item.marketCode||item.market_code,platformKey:item.platformKey||item.platform_key,dataStatus:item.dataStatus||item.data_status}); }):(Array.isArray(raw.market_platforms)?raw.market_platforms:[]),
    jurisdictions:Array.isArray(raw.jurisdictions)?raw.jurisdictions.map(function(item){ return Object.assign({},item,{parentCode:item.parentCode||item.parent_code||null}); }):[],
    categories:Array.isArray(raw.categories)?raw.categories.map(function(item){ return Object.assign({},item,{dataStatus:item.dataStatus||item.data_status}); }):[],
    reportTemplates:Array.isArray(raw.reportTemplates)?raw.reportTemplates.map(function(item){ return Object.assign({},item,{categoryCodes:item.categoryCodes||item.category_codes||[],requiredDomains:item.requiredDomains||item.required_domains||[],dataStatus:item.dataStatus||item.data_status}); }):(Array.isArray(raw.report_templates)?raw.report_templates:[]),
  };
}

var localCatalogReady = (async function(){
  try {
    var base=document.querySelector('base')?document.querySelector('base').href:location.pathname.replace(/[^/]*$/,'');
    var response=await fetch(base+'data/market_scope.json',{cache:'no-store'});
    if(!response.ok)throw new Error('local catalog '+response.status);
    var payload=jayCatalogPayload(await response.json());
    if(payload.markets.length&&payload.platforms.length&&payload.marketPlatforms.length&&window.JAY_MARKET_SCOPE_API){
      window.JAY_MARKET_SCOPE_API.hydrateCatalog(payload);
      console.log('[JAY观海] Local market catalog loaded:',payload.markets.length,'markets');
    }
  } catch(e) {
    console.info('[JAY观海] Local market catalog unavailable; using embedded registry');
  }
}());

var marketCatalogLoading = false;
async function loadMarketCatalog(){
  if(marketCatalogLoading || !window.JAY_MARKET_SCOPE_API || !JAY_SUPABASE_URL) return;
  await localCatalogReady;
  marketCatalogLoading=true;
  var controller = new AbortController();
  var timeout = setTimeout(function(){ controller.abort(); }, 2800);
  function read(path){
    return fetch(JAY_API_URL+'/'+path, {headers:{apikey:JAY_ANON_KEY,Authorization:'Bearer '+JAY_ANON_KEY},signal:controller.signal})
      .then(function(response){ if(!response.ok) throw new Error('catalog '+response.status); return response.json(); });
  }
  try{
    var rows = await Promise.all([
      read('market_catalog?select=*'),
      read('platform_catalog?select=*'),
      read('market_platforms?select=*'),
      read('jurisdiction_catalog?select=*'),
      read('category_profiles?select=*'),
      read('report_template_catalog?select=*'),
    ]);
    if(rows.every(Array.isArray) && rows[0].length && rows[1].length && rows[2].length){
      window.JAY_MARKET_SCOPE_API.hydrateCatalog(jayCatalogPayload({
        markets: rows[0], platforms: rows[1], market_platforms: rows[2], jurisdictions: rows[3],
        categories: rows[4], report_templates: rows[5],
      }));
      console.log('[JAY观海] Market catalog loaded from Supabase:',rows[0].length,'markets');
    }
  }catch(e){
    // The catalog migration is optional during local development. The
    // immutable default registry remains the safe fallback when it is absent.
    console.info('[JAY观海] Market catalog unavailable; using local registry');
  }finally{
    clearTimeout(timeout);
    marketCatalogLoading=false;
  }
}

// Load the remote catalog as soon as the base registry exists. Data modules
// can render immediately from the local metadata and will be refreshed when
// the catalog arrives; switching markets later must not be the first trigger.
loadMarketCatalog();

var platformDataLoading=false;
async function loadPlatformData(){
  if(platformDataLoading)return;
  if(typeof jayFetchMarketData!=='function'){
    setTimeout(loadPlatformData,0);
    return;
  }
  platformDataLoading=true;
  try{
    const base=document.querySelector('base')?document.querySelector('base').href:location.pathname.replace(/[^/]*$/,'');
    const url=base+'data/platforms.json';
    const data=await jayFetchMarketData('platforms', url);
    if(!data)throw new Error('Failed to load platform data');
    if(!Array.isArray(data)||!data.length)throw new Error('Platform data is empty');
    platformSourceData=data.slice();
    jayApplyPlatformDataScope();
    console.log('[JAY观海] Platform data loaded dynamically:',platformsData.length,'scoped platforms');
  }catch(e){
    platformSourceData=[];
    platformsData=[];
    pfExtData={};
    console.error('[JAY观海] Platform data load failed; records remain empty:',e.message);
  }
  platformDataLoading=false;
}
loadPlatformData();

if(window.addEventListener) window.addEventListener('jay:market-scope-change', function(){
jaySyncCountryIdentityRecords();
loadMarketCatalog();
  jayApplyPlatformDataScope();
});

const macroData=[];
const policyData=[];
const plExtData=[];
const rulesData=[];
const rlExtData={};
const activitiesData=[];
const actExtData=[];
const contentData=[];

// === 安全工具函数（XSS 防护） ===
// 转义纯文本用于插入 innerHTML（防御 <script>、<img onerror> 等）
function escapeHtml(s){
  if(s===null||s===undefined)return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
// ============ 前端健壮性基础工具 ============
// 防抖：避免输入时高频重渲染
function jayDebounce(fn,wait){
  var t;
  return function(){
    var ctx=this, args=arguments;
    if(t)clearTimeout(t);
    t=setTimeout(function(){ fn.apply(ctx,args); }, wait||250);
  };
}
var _jayDebCache={};
function jayDeb(name){
  if(!_jayDebCache[name]){
    _jayDebCache[name]=jayDebounce(function(){ if(typeof window[name]==='function') window[name](); },250);
  }
  return _jayDebCache[name];
}
// 轻量 HTML 净化：仅允许基础内联标签，剥离 script/style/iframe/事件属性/javascript: 协议
function jaySanitize(html){
  if(typeof html!=='string')return '';
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\s*\1\s*>/gi,'')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi,'')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi,'$1="#"');
}
// 去重绑定：同一元素同类型事件只绑一次，防止重复绑定泄漏
var _jayBound={};
function jayOn(el,type,handler,key){
  if(!el||!el.addEventListener)return;
  var k=key||(type+'>'+(el.id||el.className||''));
  if(_jayBound[k])return;
  _jayBound[k]=true;
  el.addEventListener(type,handler);
}
// ============ 转义用于内联 onclick 属性的 JS 字符串字面量：先 JS 转义再 HTML 属性转义
// 防止动态数据（政策标题/店铺名/品类名）突破属性边界执行注入脚本
function escInline(s){
  if(s===null||s===undefined)return '';
  var js = String(s)
    .replace(/\\/g,'\\\\')
    .replace(/'/g,"\\'")
    .replace(/"/g,'\\"')
    .replace(/[\n\r\t]/g,' ');
  return escapeHtml(js);
}

// === 工具函数 ===
const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);

// Wave2/Wave3 所需函数前置定义（避免在 IIFE 后续渲染中引用未定义）
function jayFmtCount(n){
  n = parseFloat(String(n).replace(/[^0-9.]/g,''));
  if(!isFinite(n)) return '-';
  if(n >= 10000){
    var wan = n/10000;
    return (wan>=100? Math.round(wan) : (Math.round(wan*10)/10)) + '万';
  }
  return String(Math.round(n));
}
function pfLogoColor(name){
  var colors=['#ee4d2d','#f60','#ff6a00','#167ee6','#00b388','#a435f0','#ff1900','#5b8def','#ff5a5f','#00a699','#e21b70','#ffb400','#111'];
  var h=0; for(var i=0;i<name.length;i++){h=(h*31+name.charCodeAt(i))>>>0;}
  return colors[h%colors.length];
}
function jayTraceLink(link){
  if(!link) return;
  var l = String(link);
  if(l.indexOf('赛道')>=0 || l.indexOf('分析')>=0){ switchPage('products'); return; }
  if(l.indexOf('TikTok')>=0||l.indexOf('Amazon')>=0||l.indexOf('AliExpress')>=0||l.indexOf('eBay')>=0||l.indexOf('Official')>=0){ switchPage('shops'); return; }
  toast('正在跳转到: '+l);
}

// === 原有渲染 ===
// [Overview rework: country grid moved to new renderer below]
