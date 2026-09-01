// ========== JAY观海 SaaS Auth Module ==========
// (moved to top)
// (moved to top)
// === JAY观海 Supabase Data Layer ===
// JAY_API_URL / JAY_ANON_KEY 已在顶部初始化（修复 var 提升导致的 undefined 问题）

// 数据新鲜度追踪 + AI 实时补数（用户架构：Supabase 优先，AI 联网检索写回）
var JAY_DATA_META = {};          // { key: { updated_at, source } }
var JAY_QUALITY_REPORT = null;
var JAY_STALE_DAYS = 1;
var JAY_CORE_KEYS = ['policies', 'rules', 'alerts', 'countries', 'platforms'];
var JAY_QUALITY_LABELS = { healthy:'数据实时', degraded:'部分降级', stale:'数据过期', failed:'校验失败', pending:'读取中' };
function jayQualityStatus(report){
  if(!report) return 'pending';
  if(!report.generated_at) return 'failed';
  var status = report.status || 'failed';
  var generated = new Date(report.generated_at).getTime();
  if(isFinite(generated) && Date.now() - generated > 12 * 3600000 && status !== 'failed') return 'stale';
  return status;
}
function jayQualityDate(value){
  var d = new Date(value || '');
  if(!isFinite(d.getTime())) return '暂无时间';
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function jayRenderQualityReport(){
  var report = JAY_QUALITY_REPORT;
  if(!report) return;
  var status = jayQualityStatus(report);
  var summary = report.summary || {};
  var datasets = report.datasets || {};
  var keys = Object.keys(datasets);
  var publishableCount = keys.filter(function(key){ return ['failed','stale'].indexOf(datasets[key].status) < 0; }).length;
  var setText = function(id, value){ var node=document.getElementById(id); if(node) node.textContent=String(value); };
  setText('dq-datasets', summary.datasets == null ? keys.length : summary.datasets);
  setText('dq-healthy', publishableCount);
  setText('dq-raw-records', summary.raw_records == null ? '--' : summary.raw_records);
  setText('dq-scoped-records', summary.scoped_records == null ? '--' : summary.scoped_records);
  setText('dq-formal-records', summary.formal_records == null ? '--' : summary.formal_records);
  setText('dq-excluded-records', summary.excluded_records == null ? '--' : summary.excluded_records);
  setText('dq-errors', summary.errors || 0);
  setText('dq-warnings', summary.warnings || 0);
  var scopeMeta = report.scope || {};
  if(scopeMeta.config_version){
    var scopeNote = document.getElementById('dq-scope-note');
    if(scopeNote) scopeNote.textContent = '配置 v' + scopeMeta.config_version + ' · 当前市场与已配置平台';
  }
  setText('data-quality-generated', '最近校验：' + jayQualityDate(report.generated_at) + ' · 发布闸门：' + (report.publishable ? '已通过' : '已阻断'));

  var badge = document.getElementById('data-quality-badge');
  if(badge){
    badge.className = 'data-quality-badge ' + status;
    badge.innerHTML = '<span></span>' + (JAY_QUALITY_LABELS[status] || '未知状态');
  }
  var rows = document.getElementById('data-quality-rows');
  if(rows){
    if(!keys.length){ rows.innerHTML='<tr><td colspan="8" class="data-quality-empty">质量报告中没有数据集。</td></tr>'; }
    else rows.innerHTML = keys.map(function(key){
      var item=datasets[key]||{};
      var state=item.status||'failed';
      var notes=(item.errors||[]).concat(item.warnings||[]);
      var stamp=item.updated_at ? jayQualityDate(item.updated_at) : ((item.metrics||{}).catalog_type==='reference' ? '静态参考库' : '暂无时间');
      return '<tr><td><span class="data-quality-name">'+escapeHtml(item.label||key)+'</span></td>'+
        '<td><span class="data-quality-state '+escapeHtml(state)+'">'+escapeHtml(JAY_QUALITY_LABELS[state]||state)+'</span></td>'+
        '<td>'+escapeHtml(String(item.raw_records==null?(item.records==null?'--':item.records):item.raw_records))+'</td>'+
        '<td>'+escapeHtml(String(item.scoped_records==null?'--':item.scoped_records))+'</td>'+
        '<td>'+escapeHtml(String(item.formal_records==null?'--':item.formal_records))+'</td>'+
        '<td>'+escapeHtml(String(item.excluded_records==null?'--':item.excluded_records))+'</td>'+
        '<td>'+escapeHtml(stamp)+'</td>'+
        '<td>'+escapeHtml(notes[0]||'结构、来源与时效校验通过')+'</td></tr>';
    }).join('');
  }
  var issueBand=document.getElementById('data-quality-issues');
  var issueList=document.getElementById('data-quality-issue-list');
  var issues=[];
  keys.forEach(function(key){
    var item=datasets[key]||{};
    (item.errors||[]).concat(item.warnings||[]).forEach(function(message){ issues.push((item.label||key)+'：'+message); });
  });
  if(issueBand){ issueBand.className='data-issue-band '+(issues.length?status:'healthy'); }
  if(issueList){
    issueList.innerHTML = issues.length ? issues.slice(0,8).map(function(message){return '<li>'+escapeHtml(message)+'</li>';}).join('') : '<li>所有数据集均通过结构、唯一性、来源与时效校验。</li>';
  }
}
async function jayLoadQualityReport(){
  function localTry(){ return fetch('data/quality_report.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}); }
  function supaTry(){
    if(!(JAY_SUPABASE_URL && JAY_SUPABASE_URL !== 'YOUR_SUPABASE_URL')) return Promise.resolve(null);
    return fetch(JAY_API_URL + '/market_data?key=eq.quality_report&select=data', {
      headers:{'apikey':JAY_ANON_KEY,'Authorization':'Bearer '+JAY_ANON_KEY}
    }).then(function(r){return r.ok?r.json():null;}).then(function(rows){return rows&&rows[0]&&rows[0].data?rows[0].data:null;}).catch(function(){return null;});
  }
  function applyReport(report){
    JAY_QUALITY_REPORT=report;
    jayRenderQualityReport();
    jayUpdateDataStamp();
    if(typeof renderOverviewDecisionState==='function')renderOverviewDecisionState();
    if(typeof stInitSystemStatus==='function')stInitSystemStatus();
  }
  var localReport=await localTry();
  var localValid=!!(localReport&&localReport.generated_at);
  if(localValid)applyReport(localReport);
  var remoteReport=await supaTry();
  var remoteValid=!!(remoteReport&&remoteReport.generated_at);
  if(remoteValid&&(!localValid||new Date(remoteReport.generated_at)>new Date(localReport.generated_at)))applyReport(remoteReport);
  if(!localValid&&!remoteValid)applyReport({schema_version:1,generated_at:null,status:'failed',publishable:false,summary:{datasets:0,errors:1,warnings:0},datasets:{}});
}
function jayIsStale(key){
  var m = JAY_DATA_META[key];
  if(!m || !m.updated_at) return true;
  var days = (Date.now() - new Date(m.updated_at).getTime()) / 86400000;
  return days > JAY_STALE_DAYS;
}
function jayFreshestStamp(){
  var freshest = null;
  JAY_CORE_KEYS.forEach(function(k){ var m = JAY_DATA_META[k]; if(m && m.updated_at){ if(!freshest || new Date(m.updated_at) > new Date(freshest)) freshest = m.updated_at; } });
  if(!freshest) return '本地数据';
  var d = new Date(freshest);
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}
async function jayRefreshViaAI(key, label){
  if(!AI_ENGINE.hasKey()){ toast('请先登录后使用 AI 简报服务'); return null; }
  var catLabel = label || key;
  var scopeMarkets=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveMarketNames?window.JAY_MARKET_SCOPE_API.getActiveMarketNames():['当前'];
  var scopePlatforms=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActivePlatformNames?window.JAY_MARKET_SCOPE_API.getActivePlatformNames():[];
  var scopeLabel=scopeMarkets.join('、')+'市场';
  var sys = '你是跨境电商情报分析师，基于联网检索整理最新动态。输出简体中文 Markdown：每条用 "## 市场/平台｜要点" 开头，正文含「影响」与「来源」（如可知网址）。最多 12 条，只分析'+scopeLabel+'及已配置平台 '+scopePlatforms.join('、')+'，聚焦最新政策、规则、平台变动与风险预警。禁止输出其他国家、区域或平台，禁止补造事实。';
  var user = '【当前日期】' + jayNowHuman() + '。请联网检索并整理「' + catLabel + '」截至今日的最新'+scopeLabel+'动态；平台仅限 '+scopePlatforms.join('、')+'。';
  toast('正在联网检索最新' + catLabel + '数据...');
  try {
    var brief = await callAI(sys, user, { temperature: 0.4, max_tokens: 2600, search: true });
    var ts = new Date().toISOString();
    try { localStorage.setItem('jay_ai_brief_' + key, JSON.stringify({ text: brief, ts: ts })); } catch(e){}
    toast(catLabel + ' AI 简报已生成');
    return brief;
  } catch(e){
    toast('实时刷新失败：' + (e.message === 'AUTH_REQUIRED' ? '请先登录' : e.message));
    return null;
  }
}
async function jayRefreshAll(){
  for(var i=0;i<JAY_CORE_KEYS.length;i++){
    await jayRefreshViaAI(JAY_CORE_KEYS[i], JAY_CORE_KEYS[i]);
  }
  jayRenderBriefCard();
}
function jayUpdateDataStamp(){
  var el = document.getElementById('jay-data-stamp');
  var hint = document.getElementById('jay-stale-hint');
  var metas = JAY_CORE_KEYS.map(function(k){ return JAY_DATA_META[k]; }).filter(Boolean);
  var supabaseCount = metas.filter(function(m){ return m.source === 'supabase'; }).length;
  var hasFallback = metas.some(function(m){ return m.source === 'local'; });
  var shellStatus = document.getElementById('shell-data-status');
  var freshness = document.querySelector('.freshness-pill');
  if(JAY_QUALITY_REPORT){
    var qualityStatus=jayQualityStatus(JAY_QUALITY_REPORT);
    var qualityLabel=JAY_QUALITY_LABELS[qualityStatus]||'状态未知';
    var qualityStamp=jayQualityDate(JAY_QUALITY_REPORT.generated_at).slice(0,10);
    if(el) el.textContent=qualityLabel+' · '+qualityStamp;
    if(hint){
      hint.style.display=qualityStatus==='healthy'?'none':'';
      var hintText=document.getElementById('jay-stale-text');
      var hints={degraded:'部分数据缺少来源或处于降级状态，请先核对质量报告。',stale:'质量报告或核心数据已过期，请先核对更新时间。',failed:'最近一次数据质量校验未通过，自动发布已阻断。'};
      if(hintText) hintText.textContent=hints[qualityStatus]||'部分数据需要核对质量报告。';
    }
    [shellStatus,freshness].forEach(function(node){
      if(!node) return;
      ['ready','fallback','healthy','degraded','stale','failed'].forEach(function(cls){node.classList.remove(cls);});
      node.classList.add(qualityStatus);
    });
    if(shellStatus){var qualityText=shellStatus.querySelector('span:last-child');if(qualityText)qualityText.textContent=qualityLabel+' · '+qualityStamp;}
    return;
  }
  if(el) el.textContent = '数据更新于 ' + jayFreshestStamp();
  if(hint){ var anyStale = JAY_CORE_KEYS.some(jayIsStale); hint.style.display = anyStale ? '' : 'none'; }
  var statusText = supabaseCount ? ('Supabase · ' + jayFreshestStamp()) : (hasFallback ? ('JSON 兜底 · ' + jayFreshestStamp()) : '正在连接数据源');
  [shellStatus, freshness].forEach(function(node){
    if(!node) return;
    node.classList.toggle('ready', supabaseCount > 0);
    node.classList.toggle('fallback', !supabaseCount && hasFallback);
  });
  if(shellStatus){ var txt = shellStatus.querySelector('span:last-child'); if(txt) txt.textContent = statusText; }
}
function jayRenderBriefCard(){
  var best=null, bestTs=0;
  JAY_CORE_KEYS.forEach(function(k){
    try {
      var raw = localStorage.getItem('jay_ai_brief_' + k);
      if(raw){ var o = JSON.parse(raw); if(o.ts && new Date(o.ts).getTime() > bestTs){ bestTs = new Date(o.ts).getTime(); best = o; } }
    } catch(e){}
  });
  var body = document.getElementById('ov-brief-body');
  if(!body) return;
  if(!best){ var marketText=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveMarketNames?window.JAY_MARKET_SCOPE_API.getActiveMarketNames().join('、'):'当前'; body.innerHTML = '<p style="color:var(--muted);font-size:12px">暂无实时简报。点击「刷新实时数据」，AI 将联网检索并生成最新'+marketText+'市场动态。</p>'; return; }
  var d = new Date(best.ts);
  var label = d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
  body.innerHTML = '<div class="rp-v2-rpt" style="box-shadow:none;padding:0">' + renderMarkdownSafe(best.text) + '</div><div style="font-size:11px;color:var(--muted);margin-top:8px">生成时间：'+label+'</div>';
}

// 初始化总览页数据印章与 AI 实时情报卡（依赖 JAY_DATA_META / JAY_CORE_KEYS，必须在数据层定义后调用）
jayUpdateDataStamp(); jayRenderBriefCard(); jayLoadQualityReport();

function jayMarketDataContractValid(key,data){
  if(!data)return false;
  if(key==='policies'){
    var contract=data.language_contract;
    if(!contract||contract.target_language!=='zh-CN'||!Array.isArray(data.items))return false;
    return data.items.every(function(item){
      if(!item||typeof item!=='object')return false;
      var translation=item.translation;
      return /[\u3400-\u9fff]/.test(String(item.title_zh||''))
        && translation&&['source_zh','translated','reviewed'].indexOf(translation.status)>=0;
    });
  }
  if(key==='taxes')return data.domain==='tax'&&Array.isArray(data.items);
  if(key==='access_requirements')return data.domain==='access'&&Array.isArray(data.items);
  if(key==='alerts')return Array.isArray(data)&&data.every(function(row){
    return Array.isArray(row)&&row.length>9&&row[9]&&typeof row[9]==='object'
      &&row[9].source&&row[9].source_record_id&&['verified','uploaded'].indexOf(row[9].verification_status)>=0
      &&row[9].display_locale==='zh-CN';
  });
  return true;
}

async function jayFetchMarketData(key, fallbackUrl) {
  function localTry() {
    return fetch(fallbackUrl).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
  }
  function supaTry() {
    if (!(JAY_SUPABASE_URL && JAY_SUPABASE_URL !== 'YOUR_SUPABASE_URL')) return Promise.resolve(null);
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 4000);
    return fetch(JAY_API_URL + '/market_data?key=eq.' + encodeURIComponent(key) + '&select=data,meta', {
      headers: { 'apikey': JAY_ANON_KEY, 'Authorization': 'Bearer ' + JAY_ANON_KEY },
      signal: ctrl.signal
    }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(rows){
        clearTimeout(timer);
        if (rows && rows.length > 0 && rows[0].data && jayMarketDataContractValid(key,rows[0].data)){
          var mt = (rows[0].meta && typeof rows[0].meta === 'object' && rows[0].meta.updated_at) ? rows[0].meta.updated_at : new Date().toISOString();
          JAY_DATA_META[key] = { updated_at: mt, source: 'supabase' };
          return rows[0].data;
        }
        return null;
      }).catch(function(){ clearTimeout(timer); return null; });
  }
  // 用户架构：优先读 Supabase 最新数据；本地 JSON 兜底
  var supaP = supaTry();
  var localP = localTry();
  var supaData = await supaP;
  if (supaData) { if(!JAY_DATA_META[key]) JAY_DATA_META[key] = { updated_at: new Date().toISOString(), source: 'supabase' }; jayUpdateDataStamp(); return supaData; }
  var localData = await localP;
  if (localData) {
    var localStamp = localData && !Array.isArray(localData) ? (localData.updated_at || null) : null;
    JAY_DATA_META[key] = { updated_at: localStamp, source: 'local' };
    jayUpdateDataStamp();
    return localData;
  }
  return null;
}

var jayUser = null;
var jayProfile = null;
var supabaseClient = null;
var jayIsDemo = false;
var authMode = 'login';
var jayReportPoolCache = [];
var jayReportsCache = [];
var jayReportExportsCache = [];
var jayPreferenceCache = { notification_prefs: {}, ui_prefs: {}, workspace_prefs: {} };
var jayWorkspaceContext = {
  available: false,
  loading: false,
  workspace: null,
  membership: null,
  members: [],
  invites: [],
  error: null
};
var jayNotificationsCache = [];
var jaySubscriptionCache = null;
var jayFeedbackCache = {};
var jayWorkspaceAssetSaveQueues = {};
var jayWorkspaceAssetSaveVersions = {};
var jayWorkspaceHydration = null;
var jayHydratedUserId = null;
var jayReportPoolSyncTimer = null;

function jayResetUserWorkspace(previousUserId) {
  if (jayReportPoolSyncTimer) clearTimeout(jayReportPoolSyncTimer);
  jayReportPoolSyncTimer = null;
  jayReportPoolCache = [];
  jayReportsCache = [];
  jayReportExportsCache = [];
  jayPreferenceCache = { notification_prefs: {}, ui_prefs: {}, workspace_prefs: {} };
  jayWorkspaceContext = { available: false, loading: false, workspace: null, membership: null, members: [], invites: [], error: null };
  jayNotificationsCache = [];
  jaySubscriptionCache = null;
  jayFeedbackCache = {};
  jayWorkspaceAssetCache = {};
  jayWorkspaceAssetSaveQueues = {};
  jayWorkspaceAssetSaveVersions = {};
  jayWorkspaceHydration = null;
  jayHydratedUserId = null;
  try {
    if (previousUserId && typeof prPurgeImportedDataForUser === 'function') prPurgeImportedDataForUser(previousUserId);
    else if (typeof prResetImportedDataForAuthChange === 'function') prResetImportedDataForAuthChange();
  } catch (e) {}
}

function initJayAuth() {
  if (typeof supabase !== 'undefined' && JAY_SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = supabase.createClient(JAY_SUPABASE_URL, JAY_SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    // 认证状态监听：自动续期 token / 处理登出，避免被静默踢回登录页
    supabaseClient.auth.onAuthStateChange(function(event, session) {
      if (event === 'SIGNED_IN' && session) {
        if (jayUser && jayUser.id && jayUser.id !== session.user.id) jayResetUserWorkspace(jayUser.id);
        jayIsDemo = false;
        jayUser = session.user;
        loadJayProfile().then(onAuthSuccess);
      } else if (event === 'SIGNED_OUT') {
        var signedOutUserId = jayUser && jayUser.id;
        jayUser = null; jayProfile = null; jayResetUserWorkspace(signedOutUserId); showLoginScreen();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        jayUser = session.user; // token 已自动刷新，无需额外操作
      } else if (event === 'USER_UPDATED') {
        loadJayProfile();
      }
      // INITIAL_SESSION 交给 checkJaySession() 处理，此处不干预
    });
    checkJaySession();
  } else {
    showLoginScreen();
    var err = document.getElementById('auth-error');
    if (err) { err.textContent = '认证服务暂不可用，请稍后重试。'; err.classList.add('show'); }
  }
}

function initDemoAuth() {
  jayResetUserWorkspace();
  jayIsDemo = true;
  jayUser = { email: 'demo@jayguanhai.com', id: 'demo-public' };
  jayProfile = { display_name: '体验用户', email: jayUser.email, tier: 'free', company: '', demo: true };
  onAuthSuccess();
  toast('已进入只读演示，登录后可同步看板和报告');
}

async function checkJaySession() {
  if (!supabaseClient) return;
  var r = await supabaseClient.auth.getSession();
  if (r.data.session) {
    jayIsDemo = false;
    jayUser = r.data.session.user;
    await loadJayProfile();
    onAuthSuccess();
  } else if (!jayIsDemo) {
    showLoginScreen();
  }
}

async function loadJayProfile() {
  if (!supabaseClient || !jayUser) return;
  try {
    var r = await supabaseClient.from('profiles').select('*').eq('id', jayUser.id).single();
    if (r.error) throw r.error;
    jayProfile = r.data || { display_name: jayUser.email.split('@')[0], email: jayUser.email, tier: 'free', company: '' };
  } catch(e) {
    console.warn('[JAY观海] Failed to load profile, using default:', e.message || e);
    jayProfile = { display_name: jayUser.email.split('@')[0], email: jayUser.email, tier: 'free', company: '' };
  }
}

function switchAuthTab(mode) {
  authMode = mode;
  var tabs = document.querySelectorAll('.auth-tabs button');
  tabs.forEach(function(t,i){ t.classList.toggle('active', (i===0 && mode==='login') || (i===1 && mode==='register')); });
  document.getElementById('field-name').classList.toggle('show', mode==='register');
  document.getElementById('field-company').classList.toggle('show', mode==='register');
  var activeMarketText=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getActiveMarketNames?window.JAY_MARKET_SCOPE_API.getActiveMarketNames().join('、'):'市场';
  document.getElementById('auth-title').textContent = mode==='login' ? '进入'+activeMarketText+'情报台' : '创建免费账号';
  document.getElementById('auth-submit-btn').textContent = mode==='login' ? '登录 →' : '注册 →';
  document.getElementById('auth-reset-link').style.display = mode==='login' ? '' : 'none';
  document.getElementById('auth-error').classList.remove('show');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var btn = document.getElementById('auth-submit-btn');
  var errEl = document.getElementById('auth-error');
  errEl.classList.remove('show');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    if (authMode === 'login') {
      var r = await doLogin(email, password);
      if (!r.success) { errEl.textContent = r.error; errEl.classList.add('show'); }
    } else {
      var name = document.getElementById('auth-display-name').value.trim();
      var company = document.getElementById('auth-company').value.trim();
      var r = await doRegister(email, password, name, company);
      if (!r.success) { errEl.textContent = r.error; errEl.classList.add('show'); }
      else if (r.needsEmailConfirm) { errEl.textContent = '注册成功！请查收验证邮件后登录。'; errEl.style.color='#27ae60'; errEl.classList.add('show'); }
    }
  } catch(err) {
    errEl.textContent = '网络错误，请重试';
    errEl.classList.add('show');
  }
  btn.classList.remove('loading');
  btn.disabled = false;
}

async function doLogin(email, password) {
  if (!supabaseClient) {
    return { success: false, error: '认证服务暂不可用，请稍后重试' };
  }
  var r = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
  if (r.error) return { success: false, error: translateAuthErr(r.error.message) };
  jayIsDemo = false;
  jayUser = r.data.user;
  await loadJayProfile();
  supabaseClient.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', jayUser.id).then().catch(function(e){ console.warn('[JAY观海] update last_login failed:', e.message); });
  onAuthSuccess();
  return { success: true };
}

async function doRegister(email, password, name, company) {
  if (!supabaseClient) {
    return { success: false, error: '认证服务暂不可用，请稍后重试' };
  }
  var r = await supabaseClient.auth.signUp({ email: email, password: password, options: { data: { display_name: name || email.split('@')[0], company: company } } });
  if (r.error) return { success: false, error: translateAuthErr(r.error.message) };
  if (company && r.data.user) await supabaseClient.from('profiles').update({ company: company, display_name: name || email.split('@')[0] }).eq('id', r.data.user.id);
  if (r.data.session) { jayIsDemo = false; jayUser = r.data.user; await loadJayProfile(); onAuthSuccess(); }
  else return { success: true, needsEmailConfirm: true };
  return { success: true };
}

async function jayLogout() {
  var signedOutUserId = jayUser && !jayIsDemo ? jayUser.id : null;
  if (supabaseClient && !jayIsDemo) await supabaseClient.auth.signOut();
  jayIsDemo = false;
  jayUser = null; jayProfile = null;
  jayResetUserWorkspace(signedOutUserId);
  showLoginScreen();
  toast('已安全登出');
}

async function handlePasswordReset(e) {
  e.preventDefault();
  var email = document.getElementById('auth-email').value.trim();
  if (!email) { toast('请先输入邮箱地址'); return; }
  if (!supabaseClient) { toast('演示模式暂不支持密码重置'); return; }
  var r = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  toast(r.error ? '发送失败：' + translateAuthErr(r.error.message) : '重置链接已发送到 ' + email);
}

function translateAuthErr(m) {
  if (m.includes('Invalid login')) return '邮箱或密码错误';
  if (m.includes('Email not confirmed')) return '请先验证邮箱';
  if (m.includes('already registered')) return '该邮箱已注册，请直接登录';
  if (m.includes('at least')) return '密码至少需要6个字符';
  if (m.includes('Too many')) return '请求太频繁，请稍后再试';
  return m;
}

function onAuthSuccess() {
  var ls = document.getElementById('login-screen') || document.getElementById('loginPage');
  if (ls) ls.style.display = 'none';
  var app = document.getElementById('mainApp');
  if (app) app.classList.add('active');
  updateSidebarUserInfo();
  var name = jayProfile ? (jayProfile.display_name || jayProfile.email.split('@')[0]) : '用户';
  if (!localStorage.getItem('jay_welcomed_' + (jayUser ? jayUser.id : ''))) {
    toast('欢迎加入 JAY观海，' + name + '！');
    localStorage.setItem('jay_welcomed_' + (jayUser ? jayUser.id : 'demo'), '1');
  }
  // Load user watchlist from Supabase
  if (!jayIsDemo && typeof loadWatchlistFromDb === 'function') {
    loadWatchlistFromDb();
  }
  if (!jayIsDemo && typeof jayLoadShopsFromCloud === 'function') jayLoadShopsFromCloud();
  if (!jayIsDemo && typeof jayHydrateUserWorkspace === 'function') jayHydrateUserWorkspace();
  if (!jayIsDemo && typeof jayLoadWorkspaceContext === 'function') jayLoadWorkspaceContext();
  if (!jayIsDemo && typeof jayLoadNotifications === 'function') jayLoadNotifications().then(function(){ if(typeof updateAlBadge==='function') updateAlBadge(); });
  if (!jayIsDemo && typeof jayLoadSubscription === 'function') jayLoadSubscription().then(function(){ if(typeof jayRenderPricingTier==='function') jayRenderPricingTier(); });
  if (typeof prReloadImportedDataForCurrentUser === 'function') prReloadImportedDataForCurrentUser();
  if (typeof updateAlBadge === 'function') updateAlBadge();
  if (typeof stInitAccount === 'function') stInitAccount();
}

// ========== JAY观海 User Service ==========

var JAY_USER_TABLES = {
  user_watchlist: true,
  user_activity: true,
  generated_reports: true,
  user_preferences: true,
  report_materials: true,
  user_feedback: true,
  saved_workspace_items: true,
  sales_leads: true,
  workspaces: true,
  workspace_members: true,
  workspace_invites: true,
  notification_events: true,
  report_exports: true,
  report_runs: true,
  ai_request_logs: true,
  user_subscriptions: true
};

function jayCanUseUserDb() {
  return !!(supabaseClient && jayUser && !jayIsDemo);
}

function jayWorkspaceRole() {
  return jayWorkspaceContext.membership ? jayWorkspaceContext.membership.role : '';
}

function jayWorkspaceCanManage() {
  return jayCanUseUserDb() && ['owner', 'admin'].indexOf(jayWorkspaceRole()) >= 0;
}

function jayWorkspaceRoleLabel(role) {
  return ({ owner: '所有者', admin: '管理员', editor: '编辑者', viewer: '查看者' })[role] || role || '未设置';
}

function jayWorkspaceStatusLabel(status) {
  return ({ active: '已加入', suspended: '已停用', pending: '待处理', accepted: '已接受', expired: '已过期', revoked: '已撤回' })[status] || status || '未知';
}

async function jayLoadWorkspaceContext() {
  if (!jayCanUseUserDb()) {
    jayWorkspaceContext = { available: false, loading: false, workspace: null, membership: null, members: [], invites: [], error: null };
    return jayWorkspaceContext;
  }
  jayWorkspaceContext.loading = true;
  jayWorkspaceContext.error = null;
  try {
    var memberships = await jayDbGet('workspace_members', 'select=workspace_id,role,status,joined_at&user_id=eq.' + encodeURIComponent(jayUser.id) + '&status=eq.active&order=joined_at.asc&limit=1');
    var membership = memberships && memberships[0];
    if (!membership) throw new Error('WORKSPACE_NOT_FOUND');
    var workspaceRows = await jayDbGet('workspaces', 'select=id,name,owner_id,created_at,updated_at&id=eq.' + encodeURIComponent(membership.workspace_id) + '&limit=1');
    var workspace = workspaceRows && workspaceRows[0];
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
    var members = await jayDbGet('workspace_members', 'select=id,user_id,role,status,joined_at,updated_at,profiles:user_id(id,email,display_name,company)&workspace_id=eq.' + encodeURIComponent(workspace.id) + '&order=joined_at.asc');
    var invites = [];
    if (jayWorkspaceCanManage() || membership.role === 'owner' || membership.role === 'admin') {
      invites = await jayDbGet('workspace_invites', 'select=id,email,role,status,expires_at,created_at,invited_by&workspace_id=eq.' + encodeURIComponent(workspace.id) + '&order=created_at.desc&limit=50');
    } else {
      invites = await jayDbGet('workspace_invites', 'select=id,email,role,status,expires_at,created_at,invited_by&workspace_id=eq.' + encodeURIComponent(workspace.id) + '&email=eq.' + encodeURIComponent(jayUser.email.toLowerCase()) + '&order=created_at.desc&limit=20');
    }
    jayWorkspaceContext = { available: true, loading: false, workspace: workspace, membership: membership, members: members || [], invites: invites || [], error: null };
  } catch (error) {
    jayWorkspaceContext = { available: false, loading: false, workspace: null, membership: null, members: [], invites: [], error: error };
    console.warn('[JAY观海] workspace context unavailable:', error);
  }
  return jayWorkspaceContext;
}

async function jayCreateWorkspaceInvite(email, role) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  if (!jayWorkspaceContext.workspace || !jayWorkspaceCanManage()) throw new Error('WORKSPACE_FORBIDDEN');
  var normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('INVITE_EMAIL_INVALID');
  var allowedRoles = ['admin', 'editor', 'viewer'];
  var normalizedRole = allowedRoles.indexOf(role) >= 0 ? role : 'viewer';
  var rows = await jayDbInsert('workspace_invites', {
    workspace_id: jayWorkspaceContext.workspace.id,
    email: normalizedEmail,
    role: normalizedRole,
    invited_by: jayUser.id,
    status: 'pending'
  });
  await jayLoadWorkspaceContext();
  return rows && rows[0] ? rows[0] : null;
}

async function jayRevokeWorkspaceInvite(inviteId) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  if (!jayWorkspaceContext.workspace || !jayWorkspaceCanManage()) throw new Error('WORKSPACE_FORBIDDEN');
  await jayDbPatch('workspace_invites', 'id=eq.' + encodeURIComponent(inviteId) + '&workspace_id=eq.' + encodeURIComponent(jayWorkspaceContext.workspace.id), { status: 'revoked' });
  await jayLoadWorkspaceContext();
  return true;
}

async function jayUpdateWorkspaceMember(memberId, role, status) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  if (!jayWorkspaceContext.workspace || !jayWorkspaceCanManage()) throw new Error('WORKSPACE_FORBIDDEN');
  var allowedRoles = ['admin', 'editor', 'viewer'];
  var allowedStatus = ['active', 'suspended'];
  var payload = {};
  if (allowedRoles.indexOf(role) >= 0) payload.role = role;
  if (allowedStatus.indexOf(status) >= 0) payload.status = status;
  if (!Object.keys(payload).length) throw new Error('MEMBER_UPDATE_INVALID');
  await jayDbPatch('workspace_members', 'id=eq.' + encodeURIComponent(memberId) + '&workspace_id=eq.' + encodeURIComponent(jayWorkspaceContext.workspace.id), payload);
  await jayLoadWorkspaceContext();
  return true;
}

async function jayRemoveWorkspaceMember(memberId) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  if (!jayWorkspaceContext.workspace || !jayWorkspaceCanManage()) throw new Error('WORKSPACE_FORBIDDEN');
  await jayDbDelete('workspace_members', 'id=eq.' + encodeURIComponent(memberId) + '&workspace_id=eq.' + encodeURIComponent(jayWorkspaceContext.workspace.id));
  await jayLoadWorkspaceContext();
  return true;
}

async function jayUpdateWorkspaceName(name) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  if (!jayWorkspaceContext.workspace || !jayWorkspaceCanManage()) throw new Error('WORKSPACE_FORBIDDEN');
  var normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('WORKSPACE_NAME_INVALID');
  var rows = await jayDbPatch('workspaces', 'id=eq.' + encodeURIComponent(jayWorkspaceContext.workspace.id), { name: normalizedName });
  jayWorkspaceContext.workspace.name = rows && rows[0] ? rows[0].name : normalizedName;
  return jayWorkspaceContext.workspace;
}

async function jayAcceptWorkspaceInvite(inviteId) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  if (!session || !session.access_token) throw new Error('AUTH_REQUIRED');
  var response = await fetch(JAY_API_URL + '/rpc/accept_workspace_invite', {
    method: 'POST',
    headers: { 'apikey': JAY_ANON_KEY, 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_invite_id: inviteId })
  });
  var body = await response.text();
  var parsed = body ? JSON.parse(body) : null;
  if (!response.ok) throw new Error((parsed && (parsed.message || parsed.hint)) || ('HTTP ' + response.status));
  await jayLoadWorkspaceContext();
  return parsed;
}

async function jayLoadNotifications() {
  if (!jayCanUseUserDb()) { jayNotificationsCache = []; return []; }
  try {
    var rows = await jayDbGet('notification_events', 'select=id,event_type,severity,title,body,read_at,created_at,payload&user_id=eq.' + encodeURIComponent(jayUser.id) + '&order=created_at.desc&limit=20');
    jayNotificationsCache = rows || [];
  } catch (error) {
    jayNotificationsCache = [];
    console.warn('[JAY观海] notifications unavailable:', error);
  }
  return jayNotificationsCache;
}

async function jayLoadSubscription() {
  if (!jayCanUseUserDb()) { jaySubscriptionCache = null; return null; }
  try {
    var rows = await jayDbGet('user_subscriptions', 'select=id,plan,status,provider,current_period_start,current_period_end,cancel_at_period_end,updated_at&user_id=eq.' + encodeURIComponent(jayUser.id) + '&limit=1');
    jaySubscriptionCache = rows && rows[0] ? rows[0] : { plan: 'free', status: 'active', provider: 'internal' };
  } catch (error) {
    jaySubscriptionCache = null;
    console.warn('[JAY观海] subscription unavailable:', error);
  }
  return jaySubscriptionCache;
}

async function jayCreateNotification(title, body, eventType, severity, payload) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  var rows = await jayDbInsert('notification_events', {
    user_id: jayUser.id,
    workspace_id: jayWorkspaceContext.workspace ? jayWorkspaceContext.workspace.id : null,
    event_type: ['alert', 'policy', 'rule', 'system', 'test'].indexOf(eventType) >= 0 ? eventType : 'system',
    severity: ['info', 'warning', 'critical'].indexOf(severity) >= 0 ? severity : 'info',
    title: String(title || '系统通知').trim().slice(0, 160),
    body: String(body || '').trim().slice(0, 4000),
    payload: payload && typeof payload === 'object' ? payload : {}
  });
  await jayLoadNotifications();
  return rows && rows[0] ? rows[0] : null;
}

async function jayMarkNotificationRead(notificationId) {
  if (!jayCanUseUserDb()) return false;
  await jayDbPatch('notification_events', 'id=eq.' + encodeURIComponent(notificationId) + '&user_id=eq.' + encodeURIComponent(jayUser.id), { read_at: new Date().toISOString() });
  var item = jayNotificationsCache.find(function(entry){ return entry.id === notificationId; });
  if (item) item.read_at = new Date().toISOString();
  return true;
}

async function jayFunctionRequest(functionName, payload, options) {
  options = options || {};
  if (!jayCanUseUserDb()) {
    var authError = new Error('AUTH_REQUIRED');
    authError.code = 'AUTH_REQUIRED';
    authError.status = 401;
    throw authError;
  }
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  if (!session || !session.access_token) {
    var sessionError = new Error('AUTH_REQUIRED');
    sessionError.code = 'AUTH_REQUIRED';
    sessionError.status = 401;
    throw sessionError;
  }
  var controller = new AbortController();
  var timeoutMs = Math.max(1000, Number(options.timeout || 60000));
  var timer = setTimeout(function(){ controller.abort(); }, timeoutMs);
  var response;
  try {
    response = await fetch(JAY_SUPABASE_URL + '/functions/v1/' + functionName, {
      method: 'POST',
      headers: {
        'apikey': JAY_ANON_KEY,
        'Authorization': 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
        'X-Request-Id': options.requestId || ''
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
  } catch (networkError) {
    if (networkError && networkError.name === 'AbortError') {
      networkError.code = 'REQUEST_TIMEOUT';
      networkError.status = 408;
    } else {
      networkError.code = networkError.code || 'NETWORK_ERROR';
      networkError.status = 0;
    }
    throw networkError;
  } finally {
    clearTimeout(timer);
  }
  var raw = await response.text();
  var result = {};
  if (raw) {
    try { result = JSON.parse(raw); } catch (e) { result = { message: raw.slice(0, 300) }; }
  }
  if (!response.ok) {
    var error = new Error(result.error || result.message || ('HTTP ' + response.status));
    error.code = result.error || result.code || 'SERVICE_ERROR';
    error.status = response.status;
    error.details = result;
    var retryAfter = response.headers.get('retry-after');
    if (retryAfter) error.retryAfter = retryAfter;
    throw error;
  }
  return result;
}

function jayExportIdempotencyKey(reportId, format, exportOptions) {
  exportOptions = exportOptions || {};
  if (exportOptions.idempotencyKey) return String(exportOptions.idempotencyKey);
  var retry = exportOptions.parentExportId ? ':retry:' + String(exportOptions.parentExportId) + ':' + Number(exportOptions.attempt || 1) : ':current';
  return ['report-export', reportId || 'unsaved', format, retry].join(':');
}

async function jayGenerateReportPdf(title, text, reportId, exportOptions) {
  exportOptions = exportOptions || {};
  var requestId = exportOptions.requestId || ('pdf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10));
  return jayFunctionRequest('report-export', {
    title: title || 'JAY观海市场决策报告',
    text: text || '',
    report_id: reportId || null,
    parent_export_id: exportOptions.parentExportId || null,
    attempt: exportOptions.attempt || 1,
    request_id: requestId,
    idempotency_key: jayExportIdempotencyKey(reportId, 'pdf', exportOptions)
  }, { timeout: exportOptions.timeout || 60000, requestId: requestId });
}

// All server exports use the same authenticated contract. Keeping the format
// in this small adapter means the report page can render one export history
// regardless of whether the file was produced as PDF or DOCX.
async function jayGenerateReportDocx(title, text, reportId, exportOptions) {
  exportOptions = exportOptions || {};
  var requestId = exportOptions.requestId || ('docx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10));
  return jayFunctionRequest('report-docx', {
    title: title || 'JAY观海市场决策报告',
    text: text || '',
    report_id: reportId || null,
    parent_export_id: exportOptions.parentExportId || null,
    attempt: exportOptions.attempt || 1,
    request_id: requestId,
    idempotency_key: jayExportIdempotencyKey(reportId, 'docx', exportOptions)
  }, { timeout: exportOptions.timeout || 60000, requestId: requestId });
}

async function jayLoadReportExports(reportId) {
  if (!jayCanUseUserDb()) return [];
  var query = 'select=id,report_id,format,status,file_path,file_url,error_message,attempt,parent_export_id,request_id,idempotency_key,duration_ms,metadata,created_at,updated_at,started_at,completed_at&user_id=eq.' + encodeURIComponent(jayUser.id) + '&order=created_at.desc&limit=100';
  if (reportId) query += '&report_id=eq.' + encodeURIComponent(reportId);
  var rows = await jayDbGet('report_exports', query);
  jayReportExportsCache = Array.isArray(rows) ? rows : [];
  try { if (typeof rpV2RenderExportHistory === 'function') rpV2RenderExportHistory(jayReportExportsCache); } catch (e) {}
  return jayReportExportsCache;
}

async function jayCreateReportExportEvent(reportId, format, status, details) {
  if (!jayCanUseUserDb() || !reportId) return null;
  var payload = Object.assign({
    user_id: jayUser.id,
    report_id: reportId,
    format: ['pdf', 'docx', 'md'].indexOf(format) >= 0 ? format : 'md',
    status: ['queued', 'processing', 'completed', 'failed'].indexOf(status) >= 0 ? status : 'queued',
    attempt: 1
  }, details || {});
  try {
    var rows = await jayDbInsert('report_exports', payload);
    var row = rows && rows[0] ? rows[0] : null;
    if (row) {
      jayReportExportsCache.unshift(row);
      if (typeof rpV2RenderExportHistory === 'function') rpV2RenderExportHistory(jayReportExportsCache);
    }
    return row;
  } catch (error) {
    console.warn('[JAY观海] export history write failed:', error);
    return null;
  }
}

async function jayCreateBillingCheckout(plan) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  if (!session || !session.access_token) throw new Error('AUTH_REQUIRED');
  var response = await fetch(JAY_SUPABASE_URL + '/functions/v1/billing-checkout', {
    method: 'POST',
    headers: { 'apikey': JAY_ANON_KEY, 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: plan })
  });
  var raw = await response.text();
  var result = raw ? JSON.parse(raw) : {};
  if (!response.ok) {
    var error = new Error(result.error || ('HTTP ' + response.status));
    error.status = response.status;
    throw error;
  }
  return result;
}

async function jayLoadAdminSummary() {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  if (!session || !session.access_token) throw new Error('AUTH_REQUIRED');
  var response = await fetch(JAY_SUPABASE_URL + '/functions/v1/admin-summary', {
    method: 'POST',
    headers: { 'apikey': JAY_ANON_KEY, 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    body: '{}'
  });
  var raw = await response.text();
  var result = raw ? JSON.parse(raw) : {};
  if (!response.ok) {
    var error = new Error(result.error || ('HTTP ' + response.status));
    error.status = response.status;
    throw error;
  }
  return result;
}

async function jayUserHeaders(prefer) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  if (!session || !session.access_token) throw new Error('AUTH_REQUIRED');
  return {
    'apikey': JAY_ANON_KEY,
    'Authorization': 'Bearer ' + session.access_token,
    'Content-Type': 'application/json',
    'Prefer': prefer || 'return=representation'
  };
}

var JAY_SERVICE_ERROR_MESSAGES = {
  AUTH_REQUIRED: '登录状态已失效，请重新登录',
  ORIGIN_NOT_ALLOWED: '当前访问地址未获服务端授权，请联系管理员检查生产域名配置',
  ADMIN_FORBIDDEN: '当前账号没有管理员权限',
  WORKSPACE_FORBIDDEN: '当前账号没有执行此操作的权限',
  RATE_LIMITED: '请求过于频繁，请稍后重试',
  AI_RATE_LIMITED: 'AI 服务请求过于频繁，请稍后重试',
  QUOTA_EXCEEDED: '当前服务额度不足，请联系管理员补充额度',
  AI_QUOTA_EXCEEDED: 'AI 服务额度不足，请联系管理员补充额度',
  REQUEST_TIMEOUT: '请求超时，请检查网络后重试',
  AI_PROVIDER_TIMEOUT: 'AI 服务响应超时，请稍后重试',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
  AI_PROVIDER_UNREACHABLE: 'AI 服务暂时无法连接，请稍后重试',
  AI_SERVICE_NOT_CONFIGURED: 'AI 服务尚未完成生产配置',
  REPORT_SERVICE_NOT_CONFIGURED: '报告导出服务尚未完成生产配置',
  REPORT_NOT_FOUND: '未找到已保存的报告，无法创建导出文件',
  REPORT_EXPORT_IN_PROGRESS: '相同报告正在导出，请勿重复提交',
  REPORT_STORAGE_UPLOAD_FAILED: '报告文件保存失败，请稍后重试',
  REPORT_SIGNED_URL_FAILED: '报告下载链接创建失败，请稍后重试',
  SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后重试'
};

function jayErrorCode(error) {
  if (!error) return 'UNKNOWN_ERROR';
  return String(error.code || (error.details && (error.details.error || error.details.code)) || error.message || 'UNKNOWN_ERROR').split(':')[0];
}

function jayDbErrorText(error) {
  if (!error) return '未知错误';
  var code = jayErrorCode(error);
  if (JAY_SERVICE_ERROR_MESSAGES[code]) return JAY_SERVICE_ERROR_MESSAGES[code];
  if (error.status === 401) return JAY_SERVICE_ERROR_MESSAGES.AUTH_REQUIRED;
  if (error.status === 403) return '当前账号没有执行此操作的权限';
  if (error.status === 429) return JAY_SERVICE_ERROR_MESSAGES.RATE_LIMITED;
  if (error.status === 408 || error.status === 504 || (error && error.name === 'AbortError')) return JAY_SERVICE_ERROR_MESSAGES.REQUEST_TIMEOUT;
  if (error.status === 402) return JAY_SERVICE_ERROR_MESSAGES.QUOTA_EXCEEDED;
  if (error.status === 0) return JAY_SERVICE_ERROR_MESSAGES.NETWORK_ERROR;
  if (error.status >= 500) return JAY_SERVICE_ERROR_MESSAGES.SERVICE_UNAVAILABLE;
  return error.message || '数据保存失败，请稍后重试';
}

window.jayServiceErrorText = jayDbErrorText;

async function jayDbRequest(method, table, query, payload, prefer) {
  if (!JAY_USER_TABLES[table]) throw new Error('UNSUPPORTED_USER_TABLE');
  var headers = await jayUserHeaders(prefer);
  var url = JAY_API_URL + '/' + table + (query ? '?' + query : '');
  var response;
  try {
    response = await fetch(url, {
      method: method,
      headers: headers,
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
  } catch (networkError) {
    networkError.status = 0;
    throw networkError;
  }
  var responseText = await response.text();
  var result = null;
  if (responseText) {
    try { result = JSON.parse(responseText); } catch (e) { result = responseText; }
  }
  if (!response.ok) {
    var error = new Error((result && (result.message || result.hint)) || ('HTTP ' + response.status));
    error.status = response.status;
    error.code = result && result.code;
    error.details = result;
    throw error;
  }
  return result || [];
}

function jayDbGet(table, query) {
  return jayDbRequest('GET', table, query || 'select=*');
}

function jayDbInsert(table, payload) {
  return jayDbRequest('POST', table, '', payload, 'return=representation');
}

function jayDbUpsert(table, payload, conflict) {
  var query = conflict ? 'on_conflict=' + encodeURIComponent(conflict) : '';
  return jayDbRequest('POST', table, query, payload, 'resolution=merge-duplicates,return=representation');
}

function jayDbPatch(table, filter, payload) {
  return jayDbRequest('PATCH', table, filter, payload, 'return=representation');
}

function jayDbDelete(table, filter) {
  return jayDbRequest('DELETE', table, filter, undefined, 'return=representation');
}

async function jayStartReportRun(details) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  details = details || {};
  var key = String(details.idempotencyKey || '').trim();
  if (!key) throw new Error('REPORT_RUN_IDEMPOTENCY_REQUIRED');
  var payload = {
    user_id: jayUser.id,
    client_report_id: String(details.clientReportId || key).slice(0, 180),
    idempotency_key: key.slice(0, 240),
    purpose: String(details.purpose || 'market-research').slice(0, 80),
    status: 'running',
    market_codes: Array.isArray(details.marketCodes) ? details.marketCodes : [],
    platform_keys: Array.isArray(details.platformKeys) ? details.platformKeys : [],
    category_codes: Array.isArray(details.categoryCodes) ? details.categoryCodes : [],
    data_version: details.dataVersion || null,
    model: details.model || null,
    section_count: Math.max(0, Number(details.sectionCount || 0)),
    metadata: details.metadata && typeof details.metadata === 'object' ? details.metadata : {}
  };
  try {
    var rows = await jayDbInsert('report_runs', payload);
    var created = rows && rows[0] ? rows[0] : null;
    return created ? Object.assign({ duplicate: false }, created) : null;
  } catch (error) {
    if (error.code !== '23505' && error.status !== 409) throw error;
    var existing = await jayDbGet('report_runs', 'select=*&user_id=eq.' + encodeURIComponent(jayUser.id) + '&idempotency_key=eq.' + encodeURIComponent(payload.idempotency_key) + '&limit=1');
    return existing && existing[0] ? Object.assign({ duplicate: true }, existing[0]) : null;
  }
}

async function jayFinishReportRun(runId, status, details) {
  if (!jayCanUseUserDb() || !runId) return false;
  details = details || {};
  var allowedStatus = ['completed', 'failed', 'cancelled'];
  var finalStatus = allowedStatus.indexOf(status) >= 0 ? status : 'failed';
  var payload = {
    status: finalStatus,
    completed_at: new Date().toISOString(),
    duration_ms: Math.max(0, Number(details.durationMs || 0)),
    report_id: details.reportId || null,
    failed_section: details.failedSection || null,
    error_code: details.errorCode || null,
    error_message: details.errorMessage ? String(details.errorMessage).slice(0, 1000) : null
  };
  if (details.model) payload.model = details.model;
  if (details.metadata && typeof details.metadata === 'object') payload.metadata = details.metadata;
  var rows = await jayDbPatch('report_runs', 'id=eq.' + encodeURIComponent(runId) + '&user_id=eq.' + encodeURIComponent(jayUser.id), payload);
  return rows && rows[0] ? rows[0] : true;
}

async function jayLoadReportRunMetrics(reportId) {
  if (!jayCanUseUserDb()) return { runs: [], requests: [] };
  var runQuery = 'select=*&user_id=eq.' + encodeURIComponent(jayUser.id) + '&order=created_at.desc&limit=100';
  if (reportId) runQuery += '&report_id=eq.' + encodeURIComponent(reportId);
  var runs = await jayDbGet('report_runs', runQuery);
  var requestQuery = 'select=id,report_run_id,report_id,request_id,operation,status,provider,model,input_tokens,output_tokens,total_tokens,estimated_cost_usd,duration_ms,http_status,error_code,data_version,created_at&user_id=eq.' + encodeURIComponent(jayUser.id) + '&order=created_at.desc&limit=500';
  if (reportId) requestQuery += '&report_id=eq.' + encodeURIComponent(reportId);
  var requests = await jayDbGet('ai_request_logs', requestQuery);
  return { runs: runs || [], requests: requests || [] };
}

function jayReadLegacyJson(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}

function jayPendingKey(base) {
  return base + '_pending_' + (jayUser ? jayUser.id : 'anonymous');
}

function jayStableClientId(prefix, value) {
  var input;
  try { input = JSON.stringify(value); } catch (e) { input = String(value); }
  var hash = 2166136261;
  for (var i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return prefix + '_' + (hash >>> 0).toString(36);
}

function jayNormalizeMaterialType(type) {
  var allowed = ['country', 'platform', 'product', 'policy', 'rule', 'alert', 'macro', 'shop', 'custom'];
  return allowed.indexOf(type) >= 0 ? type : 'custom';
}

function jayMaterialFromRow(row) {
  var metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return Object.assign({
    id: row.client_id,
    type: row.material_type,
    title: row.title,
    source: row.source || '',
    summary: row.summary || '',
    addedAt: row.created_at,
    selected: row.selected !== false,
    snapshot_type: row.snapshot_type || null,
    snapshot_data: row.snapshot_data || null,
    snapshot_source: row.snapshot_source || '',
    snapshot_at: row.snapshot_at || null,
    snapshot_market: row.snapshot_market || '',
    snapshot_platform: row.snapshot_platform || '',
    snapshot_category: row.snapshot_category || ''
  }, metadata);
}

function jayMaterialToRow(item) {
  var metadata = Object.assign({}, item.metadata && typeof item.metadata === 'object' ? item.metadata : {});
  ['snapshot_type','snapshot_data','snapshot_source','snapshot_at','snapshot_market','snapshot_platform','snapshot_category',
    'source_kind','source_type','source_record_id','verification_status','verification_notes'].forEach(function(key){
    if (item[key] !== undefined && item[key] !== null) metadata[key] = item[key];
  });
  return {
    user_id: jayUser.id,
    client_id: String(item.id || jayStableClientId('material', item)),
    material_type: jayNormalizeMaterialType(item.type),
    title: String(item.title || item.text || item.q || '未命名素材'),
    source: item.source || '',
    summary: item.summary || '',
    selected: item.selected !== false,
    snapshot_type: item.snapshot_type || null,
    snapshot_data: item.snapshot_data || null,
    snapshot_source: item.snapshot_source || '',
    snapshot_at: item.snapshot_at || null,
    snapshot_market: item.snapshot_market || '',
    snapshot_platform: item.snapshot_platform || '',
    snapshot_category: item.snapshot_category || '',
    metadata: Object.assign({}, metadata, item.type && jayNormalizeMaterialType(item.type) !== item.type ? { original_type: item.type } : {}),
    created_at: item.addedAt || new Date().toISOString()
  };
}

async function jaySyncReportPoolNow(pool) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  var rows = (pool || []).map(jayMaterialToRow);
  if (rows.length) await jayDbUpsert('report_materials', rows, 'user_id,client_id');
  var cloudRows = await jayDbGet('report_materials', 'select=client_id&user_id=eq.' + encodeURIComponent(jayUser.id));
  var keep = {};
  rows.forEach(function(row){ keep[row.client_id] = true; });
  var stale = cloudRows.filter(function(row){ return !keep[row.client_id]; });
  await Promise.all(stale.map(function(row){
    return jayDbDelete('report_materials', 'user_id=eq.' + encodeURIComponent(jayUser.id) + '&client_id=eq.' + encodeURIComponent(row.client_id));
  }));
  try {
    localStorage.removeItem(jayPendingKey(RP_POOL_KEY));
    localStorage.removeItem(RP_POOL_KEY);
  } catch (e) {}
  return true;
}

function jayScheduleReportPoolSync(pool) {
  if (!jayCanUseUserDb()) return;
  try { localStorage.setItem(jayPendingKey(RP_POOL_KEY), JSON.stringify(pool)); } catch (e) {}
  if (jayReportPoolSyncTimer) clearTimeout(jayReportPoolSyncTimer);
  jayReportPoolSyncTimer = setTimeout(function(){
    jaySyncReportPoolNow(jayReportPoolCache.slice()).catch(function(error){
      console.warn('[JAY观海] report pool sync failed:', error);
      toast('素材已暂存在本机，云端同步失败：' + jayDbErrorText(error));
    });
  }, 350);
}

function jayReportType(template) {
  var map = {
    country: 'country',
    product: 'product',
    'product-research': 'product',
    market: 'market',
    'market-research': 'market',
    'market-entry': 'market',
    comparison: 'comparison',
    'competitor-analysis': 'comparison'
  };
  return map[template] || 'custom';
}

function jayReportFromRow(row) {
  var content = row.content && typeof row.content === 'object' ? row.content : {};
  var scopeApi = window.JAY_MARKET_SCOPE_API;
  var marketCodes = Array.isArray(content.market_codes) ? content.market_codes.slice()
    : (Array.isArray(content.marketCodes) ? content.marketCodes.slice() : (content.market ? [content.market] : []));
  var platformKeys = Array.isArray(content.platform_keys) ? content.platform_keys.slice()
    : (Array.isArray(content.platformKeys) ? content.platformKeys.slice() : []);
  var categoryCodes = Array.isArray(content.category_codes) ? content.category_codes.slice()
    : (Array.isArray(content.categoryCodes) ? content.categoryCodes.slice() : (content.category ? [content.category] : []));
  if (scopeApi) {
    marketCodes = marketCodes.map(scopeApi.normalizeMarketCode).filter(Boolean);
    platformKeys = platformKeys.map(scopeApi.normalizePlatformKey).filter(Boolean);
    categoryCodes = scopeApi.normalizeCategoryCodes ? scopeApi.normalizeCategoryCodes(categoryCodes) : categoryCodes.map(scopeApi.normalizeCategoryCode).filter(Boolean);
  }
  return {
    id: row.client_id || row.id,
    dbId: row.id,
    name: row.title,
    materials: content.material_count || (content.materials || []).length || 0,
    date: row.created_at,
    market: content.market || '',
    market_codes: marketCodes,
    platform_keys: platformKeys,
    category_codes: categoryCodes,
    template_id: content.template_id || content.template || row.report_type || 'custom',
    scope_version: content.scope_version || '',
    tpl: content.template || row.report_type,
    text: content.text || '',
    items: content.materials || [],
    engineVersion: content.engine_version || '',
    seriesId: content.series_id || '',
    revision: Number(content.revision || 1),
    parentId: content.parent_id || null,
    model: content.model || null,
    completeness: content.completeness || null,
    publishable: content.publishable !== false,
    sourceAppendix: content.source_appendix || [],
    reconciliation: content.reconciliation || null,
    scopeCheck: content.scope_check || null,
    generationStatus: row.generation_status || content.generation_status || row.status || 'completed',
    saveStatus: row.save_status || content.save_status || (row.status === 'failed' ? 'failed' : 'saved'),
    savedAt: row.saved_at || content.saved_at || null,
    templateVersion: row.template_version || content.template_version || '',
    dataVersion: row.data_version || content.data_version || '',
    qualityReportVersion: row.quality_report_version || content.quality_report_version || '',
    dataSnapshotAt: row.data_snapshot_at || content.data_snapshot_at || null,
    materialSnapshotIds: row.material_snapshot_ids || content.material_snapshot_ids || [],
    sourceRecordIds: row.source_record_ids || content.source_record_ids || [],
    scopeSnapshot: row.scope_snapshot || content.scope_snapshot || null,
    reportRunId: row.report_run_id || content.report_run_id || null,
    cloudSaved: (row.save_status || content.save_status || (row.status === 'failed' ? 'failed' : 'saved')) === 'saved'
  };
}

function jayReportToRow(report) {
  var scopeApi = window.JAY_MARKET_SCOPE_API;
  var active = scopeApi && typeof scopeApi.getActiveContext === 'function' ? scopeApi.getActiveContext() : {};
  var marketCodes = Array.isArray(report.market_codes) ? report.market_codes.slice()
    : (Array.isArray(report.marketCodes) ? report.marketCodes.slice() : (Array.isArray(report.markets) ? report.markets.slice() : []));
  if (!marketCodes.length && report.market) marketCodes = [report.market];
  if (!marketCodes.length) marketCodes = Array.isArray(active.marketCodes) ? active.marketCodes.slice() : ['US'];
  var platformKeys = Array.isArray(report.platform_keys) ? report.platform_keys.slice()
    : (Array.isArray(report.platformKeys) ? report.platformKeys.slice() : []);
  if (!platformKeys.length) platformKeys = Array.isArray(active.platformKeys) ? active.platformKeys.slice() : [];
  var categoryCodes = Array.isArray(report.category_codes) ? report.category_codes.slice()
    : (Array.isArray(report.categoryCodes) ? report.categoryCodes.slice() : (Array.isArray(report.categories) ? report.categories.slice() : []));
  if (!categoryCodes.length) categoryCodes = Array.isArray(active.categoryCodes) ? active.categoryCodes.slice() : [];
  if (scopeApi) {
    marketCodes = marketCodes.map(scopeApi.normalizeMarketCode).filter(Boolean);
    platformKeys = platformKeys.map(scopeApi.normalizePlatformKey).filter(Boolean);
    categoryCodes = scopeApi.normalizeCategoryCodes ? scopeApi.normalizeCategoryCodes(categoryCodes) : categoryCodes.map(scopeApi.normalizeCategoryCode).filter(Boolean);
  }
  var marketName = report.market || (scopeApi && scopeApi.getPrimaryMarketName ? scopeApi.getPrimaryMarketName() : '');
  return {
    user_id: jayUser.id,
    client_id: String(report.id || jayStableClientId('report', report)),
    report_type: jayReportType(report.tpl),
    title: report.name || '未命名报告',
    content: {
      text: report.text || '',
      materials: report.items || [],
      material_count: report.materials || (report.items || []).length || 0,
      template: report.tpl || 'custom',
      template_id: report.template_id || report.tpl || 'custom',
      market: marketName,
      market_codes: marketCodes,
      platform_keys: platformKeys,
      category_codes: categoryCodes,
      scope_version: scopeApi && scopeApi.configVersion ? scopeApi.configVersion : '',
      engine_version: report.engineVersion || (report.model && report.model.engineVersion) || '',
      series_id: report.seriesId || report.series_id || '',
      revision: Number(report.revision || report.version || 1),
      parent_id: report.parentId || report.parent_id || null,
      model: report.model || null,
      completeness: report.completeness || (report.model && report.model.completeness) || null,
      publishable: report.publishable !== false,
      source_appendix: report.sourceAppendix || (report.model && report.model.sourceAppendix) || [],
      reconciliation: report.reconciliation || (report.model && report.model.reconciliation) || null,
      scope_check: report.scopeCheck || (report.model && report.model.scopeCheck) || null,
      generation_status: report.generationStatus || 'completed',
      save_status: report.saveStatus || (report.cloudSaved ? 'saved' : 'pending'),
      saved_at: report.savedAt || null,
      template_version: String(report.templateVersion || (report.model && report.model.template && report.model.template.version) || ''),
      data_version: String(report.dataVersion || ''),
      quality_report_version: String(report.qualityReportVersion || ''),
      data_snapshot_at: report.dataSnapshotAt || (report.model && report.model.dataSnapshotAt) || null,
      material_snapshot_ids: Array.isArray(report.materialSnapshotIds) ? report.materialSnapshotIds : [],
      source_record_ids: Array.isArray(report.sourceRecordIds) ? report.sourceRecordIds : [],
      scope_snapshot: report.scopeSnapshot || (report.model && report.model.scopeSnapshot) || null,
      report_run_id: report.reportRunId || null
    },
    status: report.generationStatus || 'completed',
    generation_status: report.generationStatus || 'completed',
    save_status: report.saveStatus || (report.cloudSaved ? 'saved' : 'pending'),
    saved_at: report.savedAt || null,
    template_version: String(report.templateVersion || (report.model && report.model.template && report.model.template.version) || ''),
    data_version: String(report.dataVersion || ''),
    quality_report_version: String(report.qualityReportVersion || ''),
    data_snapshot_at: report.dataSnapshotAt || (report.model && report.model.dataSnapshotAt) || null,
    material_snapshot_ids: Array.isArray(report.materialSnapshotIds) ? report.materialSnapshotIds : [],
    source_record_ids: Array.isArray(report.sourceRecordIds) ? report.sourceRecordIds : [],
    scope_snapshot: report.scopeSnapshot || (report.model && report.model.scopeSnapshot) || {},
    report_run_id: report.reportRunId || null,
    created_at: report.date || new Date().toISOString()
  };
}

async function jayPersistGeneratedReport(report) {
  if (!jayCanUseUserDb()) throw new Error('AUTH_REQUIRED');
  var rowPayload = jayReportToRow(report);
  // The row is written only after the request has reached Supabase. Marking
  // it saved in the persisted payload keeps refresh/re-login semantics honest;
  // a rejected request never produces a saved row.
  rowPayload.save_status = 'saved';
  rowPayload.saved_at = new Date().toISOString();
  if (rowPayload.content && typeof rowPayload.content === 'object') {
    rowPayload.content.save_status = 'saved';
    rowPayload.content.saved_at = rowPayload.saved_at;
  }
  var rows = await jayDbUpsert('generated_reports', rowPayload, 'user_id,client_id');
  var row = rows && rows[0] ? rows[0] : null;
  if (row) {
    report.dbId = row.id || report.dbId || null;
    report.id = row.client_id || report.id;
    report.saveStatus = row.save_status || 'saved';
    report.savedAt = row.saved_at || new Date().toISOString();
    report.cloudSaved = true;
  }
  return row || true;
}

function jayApplyPreferencesToUi() {
  var notification = jayPreferenceCache.notification_prefs || {};
  var subscriptions = Array.isArray(notification.subscriptions) ? notification.subscriptions : null;
  if (subscriptions) {
    document.querySelectorAll('#st-tab-alerts .st-alert-check input[data-sub]').forEach(function(control){
      control.checked = subscriptions.indexOf(control.getAttribute('data-sub')) >= 0;
    });
  }
  var workspace = jayPreferenceCache.workspace_prefs || {};
  var role = workspace.role || 'factory';
  var roleSeg = document.getElementById('jay-role-seg');
  if (roleSeg) roleSeg.querySelectorAll('button').forEach(function(button){
    button.classList.toggle('active', button.getAttribute('data-role') === role);
  });
  if (typeof stApplySettingsPrefs === 'function') stApplySettingsPrefs();
}

async function jayLoadReportMaterials() {
  var pending = jayReadLegacyJson(jayPendingKey(RP_POOL_KEY), null);
  if (Array.isArray(pending)) {
    jayReportPoolCache = pending;
    await jaySyncReportPoolNow(jayReportPoolCache);
  } else {
    var rows = await jayDbGet('report_materials', 'select=*&user_id=eq.' + encodeURIComponent(jayUser.id) + '&order=created_at.asc');
    jayReportPoolCache = rows.map(jayMaterialFromRow);
    var legacy = jayReadLegacyJson(RP_POOL_KEY, null);
    if (Array.isArray(legacy) && legacy.length) {
      var known = {};
      jayReportPoolCache.forEach(function(item){ known[String(item.id)] = true; });
      legacy.forEach(function(item){
        if (!item.id) item.id = jayStableClientId('legacy_material', item);
        if (!known[String(item.id)]) jayReportPoolCache.push(item);
      });
      await jaySyncReportPoolNow(jayReportPoolCache);
    } else {
      try { localStorage.removeItem(RP_POOL_KEY); } catch (e) {}
    }
  }
  try { rpV2RefreshPoolUI(); } catch (e) {}
}

async function jayLoadGeneratedReports() {
  var pending = jayReadLegacyJson(jayPendingKey(RP_REPORTS_KEY), null);
  var legacy = pending === null ? jayReadLegacyJson(RP_REPORTS_KEY, null) : pending;
  var pendingRestoreFailed = false;
  if (Array.isArray(legacy) && legacy.length) {
    legacy.forEach(function(report){ if (!report.id) report.id = jayStableClientId('legacy_report', report); });
    try {
      var restored = await jayDbUpsert('generated_reports', legacy.map(jayReportToRow), 'user_id,client_id');
      // A pending local copy becomes cloud-saved only after the upsert returns.
      (restored || []).forEach(function(row){
        var local = jayReportsCache.find(function(item){ return item.id === row.client_id; });
        if(local){ local.dbId = row.id; local.saveStatus = row.save_status || 'saved'; local.cloudSaved = true; local.savedAt = row.saved_at || new Date().toISOString(); }
      });
    } catch (error) {
      // Keep the pending copy visible and explicitly unsaved. A transient
      // network failure must not make a report appear to have vanished.
      jayReportsCache = Array.isArray(legacy) ? legacy.map(function(item){ return Object.assign({}, item, { saveStatus: 'failed', cloudSaved: false }); }) : [];
      pendingRestoreFailed = true;
      try { rpV2LoadRecent(); } catch (e) {}
      console.warn('[JAY观海] pending report restore failed:', error);
    }
  }
  try {
    var rows = await jayDbGet('generated_reports', 'select=*&user_id=eq.' + encodeURIComponent(jayUser.id) + '&order=created_at.desc&limit=50');
    var cloudReports = rows.map(jayReportFromRow);
    if (pendingRestoreFailed && Array.isArray(legacy)) {
      var cloudIds = {}; cloudReports.forEach(function(item){ cloudIds[item.id] = true; });
      jayReportsCache = legacy.map(function(item){ return Object.assign({}, item, { saveStatus: 'failed', cloudSaved: false }); }).concat(cloudReports.filter(function(item){ return !cloudIds[item.id]; }));
    } else {
      jayReportsCache = cloudReports;
      try { localStorage.removeItem(jayPendingKey(RP_REPORTS_KEY)); localStorage.removeItem(RP_REPORTS_KEY); } catch (e) {}
    }
  } catch (error) {
    // Do not replace a usable local pending list with an empty state when the
    // session is valid but Supabase is temporarily unavailable.
    if (!Array.isArray(jayReportsCache) || !jayReportsCache.length) {
      jayReportsCache = Array.isArray(legacy) ? legacy.map(function(item){ return Object.assign({}, item, { saveStatus: 'failed', cloudSaved: false }); }) : [];
    }
    console.warn('[JAY观海] report history load failed:', error);
  }
  var stat = document.getElementById('rp-stat-reports');
  if (stat) stat.textContent = jayReportsCache.length;
  var settingsStat = document.getElementById('st-rep-count');
  if (settingsStat) settingsStat.textContent = jayReportsCache.length;
  try { rpV2LoadRecent(); } catch (e) {}
  try { await jayLoadReportExports(); } catch (e) { console.warn('[JAY观海] export history load failed:', e); }
}

async function jayLoadUserPreferences() {
  var rows = await jayDbGet('user_preferences', 'select=*&user_id=eq.' + encodeURIComponent(jayUser.id) + '&limit=1');
  var prefs = rows[0] || { user_id: jayUser.id, notification_prefs: {}, ui_prefs: {}, workspace_prefs: {} };
  var legacySubs = jayReadLegacyJson('jay_sub_pref', null);
  var legacyRole = localStorage.getItem('jay_role');
  var changed = !rows.length;
  prefs.notification_prefs = prefs.notification_prefs || {};
  prefs.ui_prefs = prefs.ui_prefs || {};
  prefs.workspace_prefs = prefs.workspace_prefs || {};
  if (Array.isArray(legacySubs)) { prefs.notification_prefs.subscriptions = legacySubs; changed = true; }
  if (legacyRole) { prefs.workspace_prefs.role = legacyRole; changed = true; }
  if (changed) {
    var saved = await jayDbUpsert('user_preferences', {
      user_id: jayUser.id,
      notification_prefs: prefs.notification_prefs,
      ui_prefs: prefs.ui_prefs,
      workspace_prefs: prefs.workspace_prefs
    }, 'user_id');
    if (saved && saved[0]) prefs = saved[0];
  }
  jayPreferenceCache = prefs;
  try {
    localStorage.removeItem('jay_sub_pref');
    localStorage.removeItem('jay_role');
    localStorage.removeItem('jay_cn_view');
  } catch (e) {}
  jayApplyPreferencesToUi();
}

async function jayLoadUserFeedback() {
  var rows = await jayDbGet('user_feedback', 'select=*&user_id=eq.' + encodeURIComponent(jayUser.id));
  jayFeedbackCache = {};
  rows.forEach(function(row){ jayFeedbackCache[row.page_key] = { vote: row.vote, ts: Date.parse(row.updated_at || row.created_at) }; });
  var legacy = jayReadLegacyJson('jay_feedback', null);
  if (legacy && typeof legacy === 'object') {
    var missing = Object.keys(legacy).filter(function(page){ return !jayFeedbackCache[page] && (legacy[page].vote === 1 || legacy[page].vote === -1); });
    if (missing.length) {
      await jayDbUpsert('user_feedback', missing.map(function(page){
        return { user_id: jayUser.id, page_key: page, vote: legacy[page].vote, metadata: { migrated_from: 'localStorage' } };
      }), 'user_id,page_key');
      missing.forEach(function(page){ jayFeedbackCache[page] = legacy[page]; });
    }
    localStorage.removeItem('jay_feedback');
  }
  if (typeof window.jayInitFeedback === 'function') window.jayInitFeedback();
}

var JAY_WORKSPACE_ASSET_TYPES = {
  comparison_schemes: 'object',
  product_filter_templates: 'array',
  shop_filter_templates: 'array',
  content_filter_templates: 'array',
  report_templates: 'object',
  shop_groups: 'shop_groups',
  content_collections: 'content_collections',
  report_draft: 'object',
  product_catalog_import: 'object'
};

function jayIsJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jayNormalizeWorkspaceAsset(type, content) {
  var shape = JAY_WORKSPACE_ASSET_TYPES[type];
  if (!shape) return undefined;
  var value;
  try { value = JSON.parse(JSON.stringify(content)); } catch (e) { return undefined; }
  if (shape === 'array' && !Array.isArray(value)) return undefined;
  if (shape === 'object' && !jayIsJsonObject(value)) return undefined;
  if (shape === 'shop_groups' && (!jayIsJsonObject(value) || !jayIsJsonObject(value.groups) || !jayIsJsonObject(value.items))) return undefined;
  if (shape === 'content_collections' && (!jayIsJsonObject(value) || !Array.isArray(value.folders) || !jayIsJsonObject(value.items))) return undefined;
  return value;
}

function jayWorkspaceAssetPendingKey() {
  return 'jay_workspace_assets_pending_' + (jayUser ? jayUser.id : 'anonymous');
}

async function jaySaveWorkspaceAsset(type, content) {
  if (!jayCanUseUserDb()) return false;
  var snapshot = jayNormalizeWorkspaceAsset(type, content);
  if (snapshot === undefined) {
    console.warn('[JAY观海] rejected invalid workspace asset:', type);
    return false;
  }
  var userId = jayUser.id;
  var pendingKey = jayWorkspaceAssetPendingKey();
  var version = (jayWorkspaceAssetSaveVersions[type] || 0) + 1;
  jayWorkspaceAssetSaveVersions[type] = version;
  jayWorkspaceAssetCache[type] = snapshot;
  var pending = jayReadLegacyJson(pendingKey, {});
  if (!jayIsJsonObject(pending)) pending = {};
  pending[type] = snapshot;
  try { localStorage.setItem(pendingKey, JSON.stringify(pending)); } catch (e) {}

  var previous = jayWorkspaceAssetSaveQueues[type] || Promise.resolve();
  var operation = previous.catch(function(){ return false; }).then(async function(){
    try {
      await jayDbUpsert('saved_workspace_items', {
        user_id: userId,
        item_type: type,
        client_id: 'default',
        name: type,
        content: snapshot
      }, 'user_id,item_type,client_id');
      if (jayWorkspaceAssetSaveVersions[type] === version) {
        var remaining = jayReadLegacyJson(pendingKey, {});
        if (!jayIsJsonObject(remaining)) remaining = {};
        delete remaining[type];
        try {
          if (Object.keys(remaining).length) localStorage.setItem(pendingKey, JSON.stringify(remaining));
          else localStorage.removeItem(pendingKey);
        } catch (e) {}
      }
      return true;
    } catch (error) {
      console.warn('[JAY观海] workspace asset sync failed:', type, error);
      return false;
    }
  });
  jayWorkspaceAssetSaveQueues[type] = operation;
  operation.then(function(){
    if (jayWorkspaceAssetSaveQueues[type] === operation) delete jayWorkspaceAssetSaveQueues[type];
  });
  return operation;
}

function jayApplyWorkspaceAssets() {
  var groups = jayGetWorkspaceAsset('shop_groups', null);
  if (groups) {
    shGroups = groups.groups || { all: '全部店铺' };
    shGroupShops = groups.items || {};
  }
  var collections = jayGetWorkspaceAsset('content_collections', null);
  if (collections) {
    ctFavFolders = Array.isArray(collections.folders) ? collections.folders : [];
    ctFavItems = collections.items || {};
  }
  var productImport = jayGetWorkspaceAsset('product_catalog_import', null);
  if (productImport && typeof prApplyImportedPayload === 'function') prApplyImportedPayload(productImport, { persist: false, source: 'cloud' });
  try { shRenderGroups(); } catch (e) {}
  try { shRenderTplSelect(); } catch (e) {}
  try { ctRenderTplSelect(); } catch (e) {}
  try { ctRenderFavFolders(); } catch (e) {}
  try { prRenderTemplates(); } catch (e) {}
  try { rpV2LoadTpls(); } catch (e) {}
  try { cmpRenderSchemes(); } catch (e) {}
  var favCount = document.getElementById('st-fav-count');
  if (favCount) {
    favCount.textContent = Object.keys(ctFavItems || {}).reduce(function(total, folder){
      return total + ((ctFavItems[folder] || []).length);
    }, 0);
  }
}

async function jayLoadWorkspaceAssets() {
  var rows = await jayDbGet('saved_workspace_items', 'select=*&user_id=eq.' + encodeURIComponent(jayUser.id));
  var merged = {};
  rows.forEach(function(row){
    var value = jayNormalizeWorkspaceAsset(row.item_type, row.content);
    if (value !== undefined) merged[row.item_type] = value;
    else console.warn('[JAY观海] ignored invalid workspace asset:', row.item_type);
  });
  var legacyKeys = [];
  function legacyJson(key) {
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (e) {}
    if (raw === null) return null;
    legacyKeys.push(key);
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  var legacyMap = {
    comparison_schemes: legacyJson('jay_cmp_schemes'),
    product_filter_templates: legacyJson('jay_filter_tpl'),
    shop_filter_templates: legacyJson('jay_shop_tpl'),
    content_filter_templates: legacyJson('jay_ct_tpl'),
    report_templates: legacyJson(RP_TPL_KEY)
  };
  var legacyGroups = legacyJson('jay_shop_groups');
  var legacyGroupItems = legacyJson('jay_shop_group_shops');
  if (legacyGroups || legacyGroupItems) legacyMap.shop_groups = { groups: legacyGroups || { all: '全部店铺' }, items: legacyGroupItems || {} };
  var legacyFolders = legacyJson('jay_ct_fav_folders');
  var legacyFavItems = legacyJson('jay_ct_fav_items');
  if (legacyFolders || legacyFavItems) legacyMap.content_collections = { folders: legacyFolders || [], items: legacyFavItems || {} };
  Object.keys(legacyMap).forEach(function(type){
    var value = jayNormalizeWorkspaceAsset(type, legacyMap[type]);
    if (!Object.prototype.hasOwnProperty.call(merged, type) && value !== undefined) merged[type] = value;
  });
  var pending = jayReadLegacyJson(jayWorkspaceAssetPendingKey(), {});
  if (!jayIsJsonObject(pending)) pending = {};
  var validPendingCount = 0;
  Object.keys(pending).forEach(function(type){
    var value = jayNormalizeWorkspaceAsset(type, pending[type]);
    if (value !== undefined) { merged[type] = value; validPendingCount += 1; }
  });
  var hasValidLegacy = Object.keys(legacyMap).some(function(type){ return jayNormalizeWorkspaceAsset(type, legacyMap[type]) !== undefined; });
  var needsSync = hasValidLegacy || validPendingCount > 0;
  if (needsSync) {
    var payload = Object.keys(merged).map(function(type){
      return { user_id: jayUser.id, item_type: type, client_id: 'default', name: type, content: merged[type] };
    });
    if (payload.length) await jayDbUpsert('saved_workspace_items', payload, 'user_id,item_type,client_id');
    try {
      legacyKeys.forEach(function(key){ localStorage.removeItem(key); });
      localStorage.removeItem(jayWorkspaceAssetPendingKey());
    } catch (e) {}
  }
  jayWorkspaceAssetCache = merged;
  jayApplyWorkspaceAssets();
}

async function jayHydrateUserWorkspace() {
  if (!jayCanUseUserDb()) return;
  if (jayHydratedUserId === jayUser.id && !jayWorkspaceHydration) return true;
  if (jayWorkspaceHydration) return jayWorkspaceHydration;
  jayWorkspaceHydration = Promise.allSettled([
    jayLoadReportMaterials(),
    jayLoadGeneratedReports(),
    jayLoadUserPreferences(),
    jayLoadUserFeedback(),
    jayLoadWorkspaceAssets()
  ]).then(function(results){
    var failed = results.filter(function(result){ return result.status === 'rejected'; });
    if (failed.length) {
      failed.forEach(function(result){ console.warn('[JAY观海] workspace hydration failed:', result.reason); });
      toast('部分个人数据同步失败，请刷新重试');
    }
    if (!failed.length) jayHydratedUserId = jayUser.id;
    return failed.length === 0;
  }).finally(function(){ jayWorkspaceHydration = null; });
  return jayWorkspaceHydration;
}

async function loadUserWatchlist() {
  if (!jayCanUseUserDb()) return null;
  try {
    var rows = await jayDbGet('user_watchlist', 'select=*&user_id=eq.' + encodeURIComponent(jayUser.id) + '&order=created_at.desc');
    console.log('[JAY观海] Loaded ' + rows.length + ' watchlist items from Supabase');
    return rows;
  } catch(e) {
    console.warn('[JAY观海] Failed to load watchlist:', e);
    return null;
  }
}

async function addToWatchlist(itemType, itemId, itemName, note) {
  if (!jayCanUseUserDb()) { toast('登录后可同步到个人看板'); return false; }
  if (typeof wlIsConfiguredScopeRow === 'function' && !wlIsConfiguredScopeRow({
    item_type: itemType, item_id: itemId, item_name: itemName, note: note
  })) {
    var scopeLabel=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getScopeLabel?window.JAY_MARKET_SCOPE_API.getScopeLabel():'当前市场与平台';
    toast('只能添加'+scopeLabel+'范围内的记录');
    return false;
  }
  try {
    await jayDbInsert('user_watchlist', {
      user_id: jayUser.id,
      item_type: itemType,
      item_id: itemId,
      item_name: itemName,
      note: note || ''
    });
    return true;
  } catch(e) {
    console.warn('[JAY观海] Add watchlist failed:', e);
    if (e.code === '23505') toast('该项已在你的看板中');
    else toast('加入看板失败：' + jayDbErrorText(e));
    return false;
  }
}

async function removeFromWatchlist(watchId) {
  if (!jayCanUseUserDb()) return false;
  try {
    await jayDbDelete('user_watchlist', 'user_id=eq.' + encodeURIComponent(jayUser.id) + '&id=eq.' + encodeURIComponent(watchId));
    return true;
  } catch(e) {
    console.warn('[JAY观海] Remove watchlist failed:', e);
    return false;
  }
}

async function trackActivity(activityType, itemId, itemName, metadata) {
  if (!jayCanUseUserDb()) return;
  try {
    await jayDbInsert('user_activity', {
      user_id: jayUser.id,
      activity_type: activityType,
      item_id: itemId || '',
      item_name: itemName || '',
      metadata: metadata || {}
    });
  } catch(e) { console.warn('[JAY观海] activity write failed:', e); }
}

async function saveUserPreferences(prefs) {
  if (!jayCanUseUserDb()) return false;
  try {
    var payload = Object.assign({ user_id: jayUser.id }, prefs || {});
    var saved = await jayDbUpsert('user_preferences', payload, 'user_id');
    if (saved && saved[0]) jayPreferenceCache = saved[0];
    else jayPreferenceCache = Object.assign({}, jayPreferenceCache, prefs || {});
    jayApplyPreferencesToUi();
    return true;
  } catch(e) {
    console.warn('[JAY观海] preference write failed:', e);
    return false;
  }
}

async function removeWatchItem(btn, idx) {
  var card = btn.closest('.watch-card');
  var item = watchlistData[idx];
  if (item && item._dbId) {
    var ok = await removeFromWatchlist(item._dbId);
    if (ok) {
      watchlistData.splice(idx, 1);
      card.remove();
      toast('\u5df2\u4ece\u770b\u677f\u79fb\u9664');
      var activeTab = document.querySelector('.wl-tab.active');
      renderWatchCards(activeTab ? activeTab.dataset.type : 'all');
    } else {
      toast('\u79fb\u9664\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
    }
  } else {
    card.remove();
    watchlistData.splice(idx, 1);
    toast('\u5df2\u4ece\u770b\u677f\u79fb\u9664');
  }
}

async function addFromSearch(btn, name, type) {
  var typeMap = { track: 'country', shop: 'product', product: 'product' };
  var dbType = typeMap[type] || 'country';
  var itemId = name.replace(/[\u{1F1EE}\u{1F1E9}\u{1F1FA}\u{1F1F8}\u{1F1E7}\u{1F1F7}\u{1F1F9}\u{1F1ED}\u{1F1FB}\u{1F1F3}\u{1F1F2}\u{1F1FD}\u{1F1F5}\u{1F1ED}\u{1F1F2}\u{1F1FE}\u{1F1F8}\u{1F1EC}\u{1F1EF}\u{1F1F5}\u{1F1F0}\u{1F1F7}\u{1F1EC}\u{1F1E7}\u{1F1E9}\u{1F1EA}\u{1F1EB}\u{1F1F7}\u{1F1EE}\u{1F1F3}\u{1F1F8}\u{1F1E6}\u{1F1E6}\u{1F1EA}\u{1F1EA}\u{1F1EC}\u{1F3EA}\u{1F4E6}]/g, '').trim();
  var scopeText=window.JAY_MARKET_SCOPE_API&&window.JAY_MARKET_SCOPE_API.getScopeLabel?window.JAY_MARKET_SCOPE_API.getScopeLabel():'当前市场与平台';
  var ok = await addToWatchlist(dbType, itemId, name, scopeText);
  if (ok) {
    btn.textContent = '\u2705 \u5df2\u6dfb\u52a0';
    btn.disabled = true;
    toast('\u5df2\u6dfb\u52a0\u5230\u770b\u677f');
    await loadWatchlistFromDb();
  } else if (supabaseClient && jayUser) {
    toast('\u6dfb\u52a0\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
  } else {
    btn.textContent = '\u2705';
    btn.disabled = true;
    toast('\u5df2\u6dfb\u52a0');
  }
}

async function addTemplateToWatchlist(btn) {
  var card = btn.closest('.wl-template-card');
  var title = card ? card.querySelector('h5').textContent : 'template';
  var ok = await addToWatchlist('category', title, title, '');
  if (ok) {
    btn.textContent = '\u2705 \u5df2\u6dfb\u52a0';
    btn.disabled = true;
    toast('\u6a21\u677f\u5df2\u4e00\u952e\u6dfb\u52a0\u5230\u770b\u677f');
    await loadWatchlistFromDb();
  } else if (supabaseClient && jayUser) {
    toast('\u6dfb\u52a0\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
  } else {
    btn.textContent = '\u2705 \u5df2\u6dfb\u52a0';
    btn.disabled = true;
    toast('\u6a21\u677f\u5df2\u4e00\u952e\u6dfb\u52a0');
  }
}

function showLoginScreen() {
  var ls = document.getElementById('login-screen') || document.getElementById('loginPage');
  if (ls) ls.style.display = 'grid';
  var app = document.getElementById('mainApp');
  if (app) app.classList.remove('active');
}

function updateSidebarUserInfo() {
  if (!jayProfile) return;
  var av = document.querySelector('.sidebar .avatar');
  if (av) {
    var name = jayProfile.display_name || jayProfile.email.split('@')[0];
    av.textContent = name.charAt(0).toUpperCase();
    av.title = name;
  }
  var tierLabels = { free: '免费版', pro: 'Pro', enterprise: '企业版' };
  var tier = jayProfile.tier || 'free';
  var wsName = document.querySelector('.sidebar .ws-name');
  if (wsName) wsName.textContent = jayProfile.display_name || jayProfile.email.split('@')[0];
  var wsTier = document.querySelector('.sidebar .ws-tier');
  if (wsTier) { wsTier.textContent = jayIsDemo ? '只读演示' : (tierLabels[tier] || tier); wsTier.style.display = ''; }
}

function checkAccess(feature) {
  if (!jayProfile) return false;
  var tier = jayProfile.tier;
  var map = { overview: true, country_basic: true, product_radar: true, policies: true, country_detail: tier!=='free', product_full: tier!=='free', rules: tier!=='free', reports: tier!=='free', alerts_full: tier!=='free', api_access: tier==='enterprise' };
  return map[feature] !== undefined ? map[feature] : (tier !== 'free');
}

function showUpgradePrompt(feature) {
  var names = { country_detail:'国家市场详情', product_full:'完整商品数据', rules:'平台规则库', reports:'报告生成中心', alerts_full:'完整预警中心', api_access:'API 数据接口' };
  var overlay = document.createElement('div');
  overlay.setAttribute('data-upgrade-modal', '1');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,35,50,.6);z-index:999;display:flex;align-items:center;justify-content:center';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:8px;padding:32px;max-width:400px;text-align:center';
  card.innerHTML = '<div style="font-size:32px;margin-bottom:16px">★</div>'
    + '<h3 style="margin:0 0 8px;font-size:18px">升级到 Pro 版</h3>'
    + '<p style="color:#6b7b8d;font-size:13px;line-height:1.6;margin:0 0 20px">' + (names[feature]||'该功能') + ' 为 Pro 版专属功能。<br>解锁全部高级功能，深度洞察当前市场。</p>'
    + '<button id="upgrade-ok" style="border:0;background:#3b7ab8;color:#fff;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:13px">了解 Pro 版 →</button>'
    + '<br><button id="upgrade-cancel" style="border:0;background:none;color:#6b7b8d;padding:8px;cursor:pointer;font-size:12px;margin-top:8px">稍后再说</button>';
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  card.querySelector('#upgrade-ok').onclick = function(){ overlay.remove(); };
  card.querySelector('#upgrade-cancel').onclick = function(){ overlay.remove(); };
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// Init auth on page load
document.addEventListener('DOMContentLoaded', function() { setTimeout(initJayAuth, 200); });

function toggleUserMenu() {
  var dd = document.getElementById('user-dropdown');
  if (dd) dd.style.display = window.getComputedStyle(dd).display === 'none' ? 'block' : 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  var ws = document.querySelector('.workspace');
  var dd = document.getElementById('user-dropdown');
  if (dd && ws && !ws.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});

// Update dropdown with user info when auth succeeds
var _origOnAuthSuccess = onAuthSuccess;
onAuthSuccess = function() {
  _origOnAuthSuccess();
  if (jayProfile) {
    var de = document.querySelector('.dropdown-email');
    if (de) de.textContent = jayProfile.email;
    var dt = document.querySelector('.dropdown-tier');
    var tierLabels = { free: '免费版', pro: 'Pro 专业版', enterprise: '企业版' };
    if (dt) dt.textContent = tierLabels[jayProfile.tier] || '免费版';
    if (jayIsDemo && dt) dt.textContent = '只读演示';
  }
};
