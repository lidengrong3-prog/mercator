// === Countries Page v2 - Full Rebuild ===
// === Dynamic Country Data Loading ===
var countryDataLoaded = false;
async function loadCountryData(){
  try {
    var data = await jayFetchMarketData('countries', './data/countries.json');
    if(!data) throw new Error('Failed to load country data');
    if(data && typeof data === 'object' && Object.keys(data).length > 0){
      // Filter out metadata keys (e.g. _metadata) - only keep 2-letter country codes
      var cleaned = {};
      for(var k in data){ if(k === 'us' && data[k] && data[k].flag) cleaned[k] = data[k]; }
      countryFullData = cleaned;
      countryDataLoaded = true;
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
    countryDataLoaded = false;
    console.error('Failed to load countries.json; country records remain empty:', e);
  }
}
loadCountryData();

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
var policiesDataLoading = false;

async function loadPoliciesData() {
  if (policiesDataLoading) return;
  // markets-policies.js is loaded before auth-data.js. Wait for the shared
  // data-layer helper so the policy page can use the shared Supabase/JSON path.
  if (typeof jayFetchMarketData !== 'function') {
    setTimeout(loadPoliciesData, 0);
    return;
  }
  policiesDataLoading = true;
  $('#pl-data-info').innerHTML = '<span style="color:#3366cc">⏳ 正在加载最新数据...</span>';
  try {
    const data = await jayFetchMarketData('policies', './data/policies.json');
    if (!data) throw new Error('Failed to load policies data');
    if (data && data.items && data.items.length > 0) {
      policiesJsonData = data;
      plInitFromJson();
      if(typeof renderOverviewMetrics==='function') renderOverviewMetrics();
      const time = new Date(data.updated_at).toLocaleString('zh-CN');
      $('#pl-data-info').innerHTML = '📡 美国市场政策更新时间: ' + time + ' | 当前展示美国政策 | 原始数据来源: ' + (data.source_count || '?') + ' 个';
      // Refresh alerts linkage
      if (typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
    } else {
      throw new Error('Empty data');
    }
  } catch (e) {
    console.error('Failed to load policies.json; policy records remain empty:', e);
    policiesJsonData = { updated_at:null, source_count:0, items:[] };
    plInitFromJson();
    if(typeof renderOverviewMetrics==='function') renderOverviewMetrics();
    $('#pl-data-info').innerHTML = '数据加载失败，当前没有可发布的美国政策记录';
  }
  policiesDataLoading = false;
}

const plCategoryLabels = {
  tariff:'关税调整', tax:'税务新规', certification:'进口认证', compliance:'电商合规',
  ban:'进出口禁令', regulation:'监管合规', product_safety:'产品安全', data_privacy:'数据隐私',
  intellectual_property:'知识产权', anti_dumping:'反倾销/反补贴', foreign_exchange:'外汇管制',
  customs:'清关报关', investment:'外资准入', trade_agreement:'贸易协定', subsidy:'补贴扶持',
  labor:'劳工环保', e_commerce:'数字经济', other:'其他'
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

// Evidence is derived only from fields supplied by the collector. This keeps
// the UI honest: no synthetic source count, verification timestamp, or score
// is written into a policy record merely to make it look more trustworthy.
function plAssessEvidence(p){
  var url=String(p && p.source_url || '').trim();
  var collected=String(p && p.collected_at || '').trim();
  var published=String(p && p.published_at || '').trim();
  var parsedUrl=null;
  try{ parsedUrl=new URL(url); }catch(e){}
  var validUrl=!!parsedUrl && (parsedUrl.protocol==='http:' || parsedUrl.protocol==='https:') && !!parsedUrl.hostname;
  var sourcePath=parsedUrl ? String(parsedUrl.pathname||'').replace(/\/+$/,'') : '';
  var specificRecordUrl=validUrl && sourcePath.length>0;
  var validCollected=!!collected && !isNaN(new Date(collected).getTime());
  var validPublished=!!published && !isNaN(new Date(published).getTime());
  var host='';
  if(parsedUrl) host=parsedUrl.hostname.toLowerCase();
  // Only an actual .gov/.mil suffix is official. A hostname such as
  // agency.gov.attacker.com must never pass because it merely contains
  // ".gov" in the middle.
  var official=/(^|\.)gov$|(^|\.)mil$/i.test(host);
  var issues=[];
  if(!String(p && p.title || '').trim()) issues.push('缺少政策标题');
  if(!validUrl) issues.push('缺少有效原始来源链接');
  if(validUrl && !specificRecordUrl) issues.push('来源链接指向官网首页，无法定位具体政策记录');
  if(!validCollected) issues.push('缺少有效采集时间');
  if(!validPublished) issues.push('缺少有效发布日期');
  if(validUrl && !official) issues.push('来源域名未列入官方来源');
  var verified=!!String(p && p.title || '').trim() && validUrl && specificRecordUrl && validCollected && validPublished && official;
  // A missing verification record is not a numeric confidence score. Showing
  // an arbitrary 40/100 makes an unverified policy look measured rather than
  // unknown, so only fully evidenced records receive a score.
  var score=verified ? 100 : null;
  return {
    score:score,
    flag:verified?'pass':(issues.length>=2?'fail':'warn'),
    // This is a structural verification of the supplied record fields. It
    // does not claim that the browser has re-read the live source page.
    label:verified?'已核验 · 官方记录字段完整':'待核验 · 来源或记录不足',
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
  if(!title) return {flag:'unknown',label:'无法判断相关性'};
  var direct=plCrossBorderDirectKeywords.test(title)
    || (plComplianceKeywords.test(title) && plProductOrTradeContextKeywords.test(title));
  var trade=plCrossBorderTradeKeywords.test(title);
  var industryOnly=plIndustryOnlyKeywords.test(title);
  if(industryOnly && !directContextForIndustry(title)) return {flag:'industry',label:'行业专项，默认不纳入'};
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
  fillSelect('#pl-f-region', ['US'], plRegionLabels);
  var regionSelect=$('#pl-f-region');
  if(regionSelect) regionSelect.value='US';
  fillSelect('#pl-f-category', Object.keys(plCategoryLabels).sort(), plCategoryLabels);
  // Update nav badge
  const navBadge = document.querySelector('a[data-page="policies"] b');
  if (navBadge) navBadge.textContent = items.length;
  plCurrentPage = 1;
  renderPoliciesPage();
}

function plFilterVerifiedPolicies(items, crossBorderOnly) {
  var sourceItems=Array.isArray(items)?items:[];
  return sourceItems.filter(function(p){
    if(plAssessEvidenceForSet(p, sourceItems).flag!=='pass') return false;
    var relevance=plAssessPolicyRelevance(p);
    p._relevance=relevance;
    return !crossBorderOnly || relevance.flag==='direct'||relevance.flag==='trade';
  });
}

function plGetVerifiedUsPolicies(crossBorderOnly) {
  var items=(policiesJsonData && policiesJsonData.items) || [];
  var isUs=window.JAY_MARKET_SCOPE_API && typeof window.JAY_MARKET_SCOPE_API.isUsPolicy==='function'
    ? window.JAY_MARKET_SCOPE_API.isUsPolicy
    : function(p){ return String(p && p.region || '').toUpperCase()==='US'; };
  return plFilterVerifiedPolicies(items.filter(isUs), crossBorderOnly);
}

function plGetJsonItems() {
  var items=(policiesJsonData && policiesJsonData.items) || [];
  var isUs=window.JAY_MARKET_SCOPE_API && typeof window.JAY_MARKET_SCOPE_API.isUsPolicy==='function'
    ? window.JAY_MARKET_SCOPE_API.isUsPolicy
    : function(p){ return String(p && p.region || '').toUpperCase()==='US'; };
  return plFilterVerifiedPolicies(items.filter(isUs), plCrossBorderOnly);
}

// Populate the filter selects before the first asynchronous fetch.
fillSelect('#pl-f-region', ['US'], plRegionLabels);
if($('#pl-f-region')) $('#pl-f-region').value='US';
fillSelect('#pl-f-category', Object.keys(plCategoryLabels).sort(), plCategoryLabels);

var plCurrentPage=1, plPerPage=10, plSelected=new Set(), plAiTab=0;
const plAiTabs=['美国最新政策','美国准入与认证','美国关税与税务','美国合规风险'];

function renderPlStats(){
  const items=plGetJsonItems();
  const total=items.length;
  const highCount=items.filter(p=>p.impact_level==='high').length;
  const medCount=items.filter(p=>p.impact_level==='medium').length;
  const regions=new Set(items.map(p=>p.region).filter(Boolean));
  const categories=new Set(items.map(p=>p.category).filter(Boolean));
  $('#pl-stats-row').innerHTML=`
    <div class="pl-stat-card"><div class="pl-stat-val">${total}</div><div class="pl-stat-label">当前政策</div><div class="pl-stat-sub">${plCrossBorderOnly?'跨境经营相关':'全部美国已核验'}</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val" style="color:#e74c3c">${highCount}</div><div class="pl-stat-label">高影响政策</div><div class="pl-stat-sub">高风险红线提醒</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${regions.size}</div><div class="pl-stat-label">国家市场</div><div class="pl-stat-sub">仅美国</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${categories.size}</div><div class="pl-stat-label">政策类别</div><div class="pl-stat-sub">分类统计</div></div>`;
  // —— 真实性校验总览 ——
  const passN=items.filter(p=>p._verifyFlag==='pass').length;
  const warnN=items.filter(p=>p._verifyFlag==='warn').length;
  const failN=items.filter(p=>p._verifyFlag==='fail').length;
  const allUsItems=((policiesJsonData && policiesJsonData.items) || []).filter(function(p){ return String(p && p.region || '').toUpperCase()==='US'; });
  const excludedN=allUsItems.filter(function(p){ return plAssessEvidenceForSet(p, allUsItems).flag!=='pass'; }).length;
  const relevanceExcludedN=allUsItems.filter(function(p){
    return plAssessEvidenceForSet(p, allUsItems).flag==='pass' && !plIsCrossBorderPolicy(p);
  }).length;
  const vBar=document.getElementById('pl-verify-bar');
  if(vBar){
    const qualityNotes=[];
    if(excludedN) qualityNotes.push('来源不足 '+excludedN);
    if(relevanceExcludedN) qualityNotes.push('相关性不足 '+relevanceExcludedN);
    vBar.innerHTML=`<div class="pl-trust-summary">
      <strong>来源校验</strong><span class="pass">已核验 ${passN} 条</span>
      ${qualityNotes.length?`<span title="${qualityNotes.join('、')} 条，未进入正式列表">排除：${qualityNotes.join('、')}</span>`:''}
      <small title="结构化核验条件：具体官方记录链接、有效发布日期、有效采集时间；官网首页或重复来源不计入已核验；不替代人工逐字复核">依据：具体官方记录 + 日期字段；首页/重复来源不计入</small>
    </div>`;
  }
}

function renderPlAi(){
  let tabsHtml=plAiTabs.map((t,i)=>`<span class="pl-ai-tab${i===plAiTab?' active':''}" onclick="plSwitchAiTab(${i})">${t}</span>`).join('');
  tabsHtml+=`<span style="margin-left:auto;font-size:.72rem;color:#888;cursor:pointer" onclick="plSwitchAiTab(${(plAiTab+1)%plAiTabs.length})">🔄 切换视图</span>`;
  $('#pl-ai-tabs').innerHTML=tabsHtml;
  var sourceItems=plGetJsonItems().map(function(p,i){ return Object.assign({_idx:i},p); });
  var tabItems=sourceItems.filter(function(p){
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
    var summary=String(p.summary||p.title||'').replace(/\s+/g,' ').slice(0,180);
    var source=p.source_url?(' · 来源：'+plSourceLabel(p)):'';
    return `<div class="ai-item"><span class="ai-tag-red">美国</span> ${escapeHtml(p.title||'未命名政策')}<br><span style="color:#566;">${escapeHtml(summary)}${escapeHtml(source)}</span><span class="ai-btn" onclick="plAiLocatePolicy(${p._idx})">定位政策</span><span class="ai-btn" onclick="toast('已添加预警')">添加预警</span></div>`;
  }).join('');
  $('#pl-ai-content').innerHTML=items || '<div class="ai-item">当前美国市场暂无匹配政策。</div>';
}
function plSwitchAiTab(i){plAiTab=i;renderPlAi();}
function plAiLocatePolicy(idx){toast('已定位到相关政策条目');}

function plGetFiltered(){
  const search=$('#pl-search').value.toLowerCase();
  const region=$('#pl-f-region').value;
  const category=$('#pl-f-category').value;
  const impact=$('#pl-f-impact').value;
  const items=plGetJsonItems();
  return items.map((p,i)=>({...p,_idx:i})).filter(p=>{
    if(search && !p.title.toLowerCase().includes(search) && !(plRegionLabels[p.region]||p.region).toLowerCase().includes(search))return false;
    if(region!=='all' && p.region!==region)return false;
    if(category!=='all' && p.category!==category)return false;
    if(impact!=='all' && p.impact_level!==impact)return false;
    return true;
  });
}

function renderPlList(){
  const filtered=plGetFiltered();
  const total=filtered.length;
  const totalPages=Math.ceil(total/plPerPage)||1;
  if(plCurrentPage>totalPages)plCurrentPage=totalPages;
  const start=(plCurrentPage-1)*plPerPage;
  const pageData=filtered.slice(start,start+plPerPage);

  if(total===0){
    $('#pl-list').innerHTML='';
    $('#pl-empty').style.display='block';
    $('#pl-pagination').innerHTML='';
    $('#pl-filter-count').textContent='0 条政策';
    return;
  }
  $('#pl-empty').style.display='none';
  $('#pl-filter-count').textContent=total+' 条政策';

  $('#pl-list').innerHTML=pageData.map(p=>{
    const levelClass=p.impact_level==='high'?'level-major':p.impact_level==='medium'?'level-medium':'level-normal';
    const badgeClass=p.impact_level==='high'?'badge-major':p.impact_level==='medium'?'badge-medium':'badge-normal';
    const impactColor=p.impact_level==='high'?'#e74c3c':p.impact_level==='medium'?'#f39c12':'#3498db';
    const impactLabel=plImpactLabels[p.impact_level]||p.impact_level;
    const regionLabel=plRegionLabels[p.region]||p.region;
    const catLabel=plCategoryLabels[p.category]||p.category;
    const checked=plSelected.has(p._idx)?'checked':'';
    const sourceLink=p.source_url?`<a href="${p.source_url}" target="_blank" rel="noopener noreferrer" style="color:#3366cc;text-decoration:none">📎 ${escapeHtml(plSourceLabel(p))}</a>`:`<span class="src-missing">⚠️ 待补充来源</span>`;
    const titleLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:inherit;text-decoration:none">${p.title}</a>`:p.title;
    const pubDate=p.published_at||'';
    // —— 简洁的真实性状态展示 ——
    const evidence=p._evidence||plAssessEvidence(p);
    const relevance=p._relevance||plAssessPolicyRelevance(p);
    const relevanceLabel=relevance.flag==='direct'?'跨境直接相关':relevance.flag==='trade'?'贸易经营相关':relevance.label;
    const relevanceColor=(relevance.flag==='direct'||relevance.flag==='trade')?'#256d5a':'#7b6b35';
    const statusLabel=p.status_label||p.status||'';
    const statusColor=p.status==='active'?'#27ae60':p.status==='proposed'?'#3498db':p.status==='suspended'?'#f39c12':'#95a5a6';
    const lbLabel=p.legal_basis_label||'';
    const effDate=p.effective_date||'';
    const expDate=p.expire_date||'';
    const vFlag=evidence.flag||'warn';
    const vIssues=evidence.issues||[];
    const cardBorder=vFlag==='fail'?'box-shadow:0 0 0 2px #e74c3c inset':vFlag==='warn'?'box-shadow:0 0 0 2px #f39c12 inset':'';
    const vBadge=vFlag==='pass'?`<span class="pl-verify-badge pass" title="${escapeHtml(evidence.label)}" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#eafaf1;color:#1e8449;margin-left:6px;vertical-align:middle">✓ 已核验</span>`:`<span class="pl-verify-badge warn" title="${escapeHtml(vIssues.join('；'))}" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#fef9e7;color:#b7950b;margin-left:6px;vertical-align:middle">⚠ 待核</span>`;
    return `<div class="pl-card" style="${cardBorder}">
      <div class="pl-risk-bar ${levelClass}"></div>
      <input type="checkbox" class="pl-card-check" ${checked} onclick="event.stopPropagation();plToggleSelect(${p._idx})">
      <div class="pl-card-body">
        <h3>${titleLink}${vBadge}</h3>
        <div class="pl-meta">
          <span class="pl-country-tag">🌍 ${regionLabel}</span>
          <span>📅 ${jayFmtTime(pubDate)}</span>
          <span>${sourceLink}</span>
          ${p.source_count?`<span title="数据源明确提供的来源数量">🔗 ${p.source_count}源</span>`:''}
        </div>
        <div class="pl-tags-row">
          <span class="pl-relevance-tag" title="相关性判断：${escapeHtml(relevance.label)}" style="color:${relevanceColor};border:1px solid ${relevanceColor};background:${relevanceColor}15;padding:1px 8px;border-radius:10px;font-size:12px">${relevanceLabel}</span>
          <span class="pl-type-tag">${catLabel}</span>
          <span class="pl-impact-tag" style="color:${impactColor};border-color:${impactColor};background:${impactColor}15">${impactLabel}影响</span>
          ${statusLabel?`<span style="color:${statusColor};border:1px solid ${statusColor};background:${statusColor}15;padding:1px 8px;border-radius:10px;font-size:12px">● ${statusLabel}</span>`:''}
          ${lbLabel?`<span title="法律依据分类" style="color:#6c3483;border:1px solid #6c3483;background:#f5eef8;padding:1px 8px;border-radius:10px;font-size:12px">⚖ ${lbLabel}</span>`:''}
        </div>
        ${(effDate||expDate)?`<div class="pl-verify-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;font-size:12px;color:#666">
          ${effDate?`<span>生效: <b style="color:#2c3e50">${effDate}</b></span>`:''}
          ${expDate?`<span>失效: <b style="color:#e74c3c">${expDate}</b></span>`:''}
        </div>`:''}
        ${p.summary?'<div class="pl-summary">'+p.summary+'</div>':''}
      </div>
      <div class="pl-card-right">
        <span class="pl-level-badge ${badgeClass}">${impactLabel}</span>
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
    jayPolicyContext({region:region,category:category,impact:impact,scope:$('#pl-f-scope').value||'cross-border'});
  }
  plSyncToOtherBoards(region,category,impact);
  renderPlList();
}
function plScopeChange(value){
  plCrossBorderOnly=value!=='all-us';
  if(window.__CP_JAY_CTX && typeof jayPolicyContext==='function')jayPolicyContext({scope:value});
  plCurrentPage=1;
  renderPoliciesPage();
}
function plClearFilters(){
  $('#pl-search').value='';
  $('#pl-f-scope').value='cross-border';
  plCrossBorderOnly=true;
  $('#pl-f-region').value='US';
  $('#pl-f-category').value='all';
  $('#pl-f-impact').value='all';
  var filter={region:'US',category:'all',impact:'all',scope:'cross-border'};
  window.jayPolicyFilter={region:'US',category:'all',impact:'all'};
  if(window.__CP_JAY_CTX && typeof jayPolicyContext==='function')jayPolicyContext(filter);
  plCurrentPage=1;
  renderPoliciesPage();
  toast('筛选条件已重置为美国跨境经营相关政策');
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

function openPlDetail(idx){
  const items=plGetJsonItems();
  const p=items[idx];
  if(!p)return;
  const impactColor=p.impact_level==='high'?'#e74c3c':p.impact_level==='medium'?'#f39c12':'#3498db';
  const impactLabel=plImpactLabels[p.impact_level]||p.impact_level;
  const regionLabel=plRegionLabels[p.region]||p.region;
  const catLabel=plCategoryLabels[p.category]||p.category;
  const sourceLink=p.source_url?`<a href="${p.source_url}" target="_blank" rel="noopener noreferrer" style="color:#3366cc">${escapeHtml(plSourceLabel(p))}</a>`:`<span class="src-missing">⚠️ 待补充来源</span>`;
  const titleLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:inherit;text-decoration:none">${p.title}</a>`:p.title;

  let html=`<button class="pl-detail-close" onclick="closePlDetail()">✕</button>
    <h2>${titleLink}</h2>
    <div class="pl-detail-sub">${regionLabel} · ${impactLabel}影响 · ${catLabel} · 发布于 ${p.published_at||'N/A'} · 采集于 ${p.collected_at?p.collected_at.substring(0,10):'N/A'}</div>

    <div class="pl-detail-section"><h4>📋 政策基础档案</h4>
      <div class="pl-detail-grid">
        <div class="pl-detail-item"><b>信息来源：</b>${sourceLink}</div>
        <div class="pl-detail-item"><b>发布日期：</b>${p.published_at||'N/A'}</div>
        <div class="pl-detail-item"><b>采集时间：</b>${p.collected_at?p.collected_at.substring(0,16).replace('T',' '):'N/A'}</div>
        <div class="pl-detail-item"><b>影响地区：</b>${regionLabel}</div>
        <div class="pl-detail-item"><b>政策类别：</b>${catLabel}</div>
        <div class="pl-detail-item"><b>影响等级：</b><span style="color:${impactColor};font-weight:600">${impactLabel}</span></div>
      </div>
    </div>

    <div class="pl-detail-section"><h4>📝 政策详情</h4>
      <div class="pl-detail-item" style="line-height:1.8">${p.summary||p.title||'暂无详细摘要'}</div>
    </div>

    <div class="pl-detail-section"><h4>⚠️ 合规落地建议</h4>
      <div class="pl-detail-item">
        <b>1. 关注要点：</b>该政策属于 ${catLabel} 类别，影响 ${regionLabel} 地区跨境业务<br>
        <b>2. 影响等级：</b><span style="color:${impactColor}">${impactLabel}</span> — ${p.impact_level==='high'?'建议立即评估业务影响并制定应对方案':'建议持续关注并及时调整合规策略'}<br>
        <b>3. 后续动作：</b>请根据原始来源、发布日期和生效日期复核业务影响，再制定合规动作
      </div>
    </div>

    <div class="pl-detail-section">
      <button class="filter-button" onclick="toast('已添加预警')">添加预警监控</button>
      <button class="filter-button" onclick="toast('已加入看板')">加入看板</button>
      <div id="pl-ai-detail-result"></div>
    </div>`;

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
  var region=(document.getElementById('pl-f-region')||{}).value||'US';
  var box=document.getElementById('pl-compliance');
  if(!box)return;
  var items=plGetJsonItems().filter(function(p){ return region==='all'||p.region===region; });
  if(!items.length){ box.innerHTML='<div class="pl-empty"><p>美国市场暂无政策数据</p></div>'; box.style.display='block'; return; }
  box.innerHTML='<h3 style="margin:6px 0 12px;font-size:16px">📋 美国市场合规清单</h3>'
    + items.slice(0,12).map(function(p){
        var lv=plImpactLabels[p.impact_level]||'常规';
        var desc=String(p.summary||p.title||'').replace(/\s+/g,' ').slice(0,160);
        var evidence=plAssessEvidence(p);
        return '<div class="pl-comp-card">'
          +'<div class="pl-comp-head"><b>'+escapeHtml(p.title||'未命名政策')+'</b><span class="pl-comp-lv pl-comp-lv-'+(p.impact_level==='high'?'high':(p.impact_level==='medium'?'mid':'low'))+'">'+lv+'影响</span></div>'
          +'<div class="pl-comp-grid">'
          +'<div><span>政策摘要</span><p>'+escapeHtml(desc)+'</p></div>'
          +'<div><span>来源</span><p>'+escapeHtml(p.source||'未提供')+'</p></div>'
          +'<div><span>数据状态</span><p>'+escapeHtml(evidence.label)+'</p></div>'
          +'<div><span>办理周期/费用</span><p>源数据未提供</p></div>'
          +'</div></div>';
      }).join('')
    + '<p style="font-size:11px;color:#9aa29e;margin-top:10px">* 仅展示采集数据中已有字段；办理周期和费用未由来源提供时不做推测。</p>';
  box.style.display='block';
}
function renderPoliciesPage(){
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
  $('#rl-data-info').innerHTML = '<span style="color:#3366cc">⏳ 正在加载最新数据...</span>';
  try {
    const data = await jayFetchMarketData('rules', './data/rules.json');
    if (!data) throw new Error('Failed to load rules data');
    if (data && data.items && data.items.length > 0) {
      rulesJsonData = data;
      rlInitFromJson();
      const time = new Date(data.updated_at).toLocaleString('zh-CN');
      $('#rl-data-info').innerHTML = '📡 美国市场规则更新时间: ' + time + ' | 原始数据来源: ' + (data.source_count || '?') + ' 个 | 当前仅展示已匹配的 4 个平台规则';
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
}

function rlInitFromJson() {
  const items = rlGetJsonItems();
  // The workspace scope is the single US market and four supported platforms.
  // Keep the filter options derived from that scope, not from the global catalog.
  var scopedPlatformNames = window.JAY_MARKET_SCOPE
    ? window.JAY_MARKET_SCOPE.platformNames.slice()
    : ['Amazon','TikTok Shop','AliExpress','eBay'];
  fillSelect('#rl-platform', scopedPlatformNames);
  fillSelect('#rl-market', ['US'], {US:'美国'});
  fillSelect('#rl-category', Object.keys(rlCategoryLabels).sort(), rlCategoryLabels);
  fillSelect('#rl-act-type', Object.keys(rlActTypeLabels).sort(), rlActTypeLabels);
  var marketSelect=$('#rl-market');
  if(marketSelect) marketSelect.value='US';
  rlRulesPage = 1;
  renderRulesPage();
  if(typeof renderOverviewMetrics==='function') renderOverviewMetrics();
  if(typeof renderPlatformProfileStatus==='function') renderPlatformProfileStatus();
}

function rlGetJsonItems() {
  var items = (rulesJsonData && rulesJsonData.items) || [];
  var scopeApi=window.JAY_MARKET_SCOPE_API;
  var scope=window.JAY_MARKET_SCOPE;
  var allowedPlatforms=scope && Array.isArray(scope.platformNames)
    ? scope.platformNames
    : ['Amazon','TikTok Shop','AliExpress','eBay'];
  return items.filter(function(r){
    if(!r) return false;
    var platform=scopeApi && scopeApi.normalizePlatform
      ? scopeApi.normalizePlatform(r.platform)
      : String(r.platform||'').trim();
    if(allowedPlatforms.indexOf(platform)<0) return false;
    var market=String(r.market||'').toUpperCase();
    // Only explicit US rules belong in the current workspace. Global articles
    // remain in the source JSON for future multi-market work, but are not
    // silently relabeled as US rules here.
    return market==='US';
  }).map(function(r){
    var copy=Object.assign({},r);
    var platform=scopeApi && scopeApi.normalizePlatform ? scopeApi.normalizePlatform(copy.platform) : copy.platform;
    copy.platform=platform;
    return copy;
  });
}

const rlCategoryLabels = {fee:'费用佣金', fulfillment:'物流履约', compliance:'合规要求', penalty:'处罚扣分', category:'类目管理', listing:'商品发布'};
const rlMarketLabels = {US:'美国', EU:'欧洲', SEA:'东南亚', MEA:'中东', LATAM:'拉美', SAS:'南亚', AFR:'非洲', EA:'东亚（日韩）', OCE:'大洋洲', CIS:'独联体', CN:'中国', SG:'新加坡', Global:'全球'};
const rlImpactLabels = {high:'高', medium:'中', low:'低'};
const rlActTypeLabels = {promo:'大促活动', recruit:'招商补贴', challenge:'内容挑战赛', traffic:'流量扶持', commission:'免佣/返现'};

// Initialize the fixed US workspace filters while the verified JSON loads.
var rlPlatformNames = window.JAY_MARKET_SCOPE
  ? window.JAY_MARKET_SCOPE.platformNames.slice()
  : ['Amazon','TikTok Shop','AliExpress','eBay'];
fillSelect('#rl-platform', rlPlatformNames);
fillSelect('#rl-market', ['US'], {US:'美国'});
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
  $('#ai-rules').innerHTML='<div class="ai-panel"><div class="ai-header"><div class="ai-tabs" id="rl-ai-tabs"><span class="ai-tab active" data-t="rule" onclick="switchRlAiTab(\'rule\')">规则变动洞察</span><span class="ai-tab" data-t="act" onclick="switchRlAiTab(\'act\')">平台活动洞察</span></div><button class="ai-regen" onclick="renderRlAi()">🔄 刷新</button></div><div id="rl-ai-content"></div><small style="color:#999;font-size:11px">内容仅来自当前美国规则记录</small></div>';
  switchRlAiTab('rule');
}
function switchRlAiTab(t){
  $$('#rl-ai-tabs .ai-tab').forEach(e=>e.classList.toggle('active',e.dataset.t===t));
  if(t==='rule'){
    const items=getFilteredRules();
    const highItems=items.filter(r=>r.impact_level==='high').slice(0,3);
    const aiHtml=highItems.length?highItems.map(r=>'<li>⚠️ <strong>'+escapeHtml(r.platform)+'</strong> '+(r.title||r.summary||'').substring(0,60)+' <button class="ai-action" onclick="rlLocate(\'rule\',\''+escInline(r.platform)+'\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">加入预警</button></li>').join(''):'<li>暂无高影响规则</li>';
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
    const globalIdx=rlGetJsonItems().indexOf(rlGetJsonItems().find(item=>item.id===r.id));
    const riskLevel=r.impact_level==='high'?'high':r.impact_level==='medium'?'mid':'low';
    const impactColor=r.impact_level==='high'?'#e74c3c':r.impact_level==='medium'?'#f39c12':'#27ae60';
    const impactLabel=rlImpactLabels[r.impact_level]||r.impact_level;
    const catLabel=rlCategoryLabels[r.category]||r.category;
    const marketLabel=rlMarketLabels[r.market]||r.market;
    const effDate=r.effective_date||r.published_at||'';
    const days=effDate?Math.ceil((new Date(effDate)-new Date())/86400000):0;
    const isFuture=days>0;
    const titleLink=r.source_url?`<a href="${r.source_url}" target="_blank" style="color:inherit;text-decoration:none">${r.title}</a>`:r.title;
    return '<div class="rl-rule-card" data-idx="'+globalIdx+'">'
    +'<div class="rl-risk-bar rl-risk-'+riskLevel+'"></div>'
    +'<div class="rl-card-body">'
    +'<h4><input type="checkbox" class="rl-check" data-idx="'+r.id+'" '+((rlChecked.has(r.id))?'checked':'')+' onchange="rlToggleCheck(\''+r.id+'\')"> '+titleLink+' <span class="tag" style="color:'+impactColor+';border-color:'+impactColor+'">'+catLabel+'</span></h4>'
    +'<div class="rl-card-meta"><span>📅 '+(r.published_at||'')+'</span><span class="tag watch">'+marketLabel+'</span><span>'+r.platform+'</span>'
    +(isFuture?'<span class="rl-countdown '+(days<=7?(days<=3?'rl-countdown-urgent':'rl-countdown-warn'):'rl-countdown-ok')+'">'+days+'天后生效</span>':'<span class="rl-countdown rl-countdown-ok">已生效</span>')
    +'</div>'
    +'<div class="rl-card-summary">'+(r.summary||'').substring(0,80)+((r.summary||'').length>80?'…':'')+'</div>'
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
  return items.filter(r=>(p==='all'||r.platform===p)&&(m==='all'||r.market===m)&&(cat==='all'||r.category===cat)&&(impact==='all'||r.impact_level===impact));
}
function getFilteredActs(){
  const p=$('#rl-platform').value,at=$('#rl-act-type').value,m=$('#rl-market').value;
  const marketName = m==='all' ? null : (m==='US' ? '北美' : (rlMarketLabels[m] || m));
  var allowedPlatforms = window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.platformNames : ['Amazon','TikTok Shop','AliExpress','eBay'];
  return activitiesData.filter(a=>{
    // activitiesData stores a display label such as "Amazon北美" in a[0]
    // and the canonical platform in a[12]; prefer the latter for filtering.
    const activityPlatform=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.normalizePlatform
      ? window.JAY_MARKET_SCOPE_API.normalizePlatform(a[12] || a[0]) : (a[12] || a[0]);
    const matchPlatform = p==='all' || activityPlatform===p;
    const matchType = at==='all' || rlActTypeGroup(a[1])===at;
    const matchMarket = !marketName || a[5]===marketName;
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
  if(marketSelect) marketSelect.value='US';
  rlRulesPage=1;rlActPage=1;rlChecked.clear();
  if(window.__CP_JAY_CTX && typeof jayRulesContext==='function')jayRulesContext({platform:'all',market:'US',category:'all',impact:'all',actType:'all'});
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
  const marketLabel=rlMarketLabels[r.market]||r.market;
  const sourceLink=r.source_url?`<a href="${r.source_url}" target="_blank" style="color:#3366cc">查看原始来源</a>`:`<span class="src-missing">⚠️ 待补充来源</span>`;
  const overlay=document.createElement('div');
  overlay.className='rl-detail-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML='<div class="rl-detail-modal"><button class="close-btn" onclick="this.closest(\'.rl-detail-overlay\').remove()">×</button>'
  +'<h2>'+r.title+'</h2>'
  +'<div class="rl-detail-section"><h3>📋 基础信息</h3><div class="info-grid">'
  +'<div class="info-item"><div class="lbl">平台</div><div class="val">'+r.platform+'</div></div>'
  +'<div class="info-item"><div class="lbl">规则类别</div><div class="val"><span class="tag" style="color:'+impactColor+'">'+catLabel+'</span></div></div>'
  +'<div class="info-item"><div class="lbl">生效日期</div><div class="val">'+(r.effective_date||r.published_at||'N/A')+'</div></div>'
  +'<div class="info-item"><div class="lbl">影响市场</div><div class="val">'+marketLabel+'</div></div>'
  +'<div class="info-item"><div class="lbl">影响等级</div><div class="val" style="color:'+impactColor+'">'+(r.impact_level==='high'?'🔴 高':r.impact_level==='medium'?'🟡 中':'🔵 低')+'</div></div>'
  +'<div class="info-item"><div class="lbl">来源链接</div><div class="val">'+sourceLink+'</div></div>'
  +'</div></div>'
  +'<div class="rl-detail-section"><h3>📝 规则详情</h3><p>'+(r.summary||r.title||'暂无详细摘要')+'</p></div>'
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
// Load rules from JSON, then render
loadRulesData();

// -- 热门内容 --
