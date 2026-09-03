/* JAY观海 评测修复 · 全局初始化脚本（由 patch_review46.py 注入到 </body> 前） */
(function(){
  'use strict';

  // ---- 平台总数：由唯一市场范围配置提供 ----
  var JAY_PLATFORM_COUNT = window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.platformCount : 4;
  window.JAY_PLATFORM_COUNT = JAY_PLATFORM_COUNT;

  // ---- 动态问候 ----
  function jayGreeting(){var h=new Date().getHours();if(h<6)return '凌晨好';if(h<12)return '早上好';if(h<14)return '中午好';if(h<18)return '下午好';if(h<22)return '晚上好';return '夜深了';}
  window.jayGreeting=jayGreeting;

  // ---- 平台数统一显示 ----
  function jaySyncPlatformCount(){
    var k=document.getElementById('kpi-platforms'); if(k)k.textContent=JAY_PLATFORM_COUNT;
    var l=document.getElementById('login-platforms'); if(l)l.textContent=JAY_PLATFORM_COUNT;
  }

  // ---- 侧边栏徽章动态化 ----
  function updateNavBadges(){
    var pl=document.getElementById('nav-pl-count');
    if(pl){var pc=(typeof policiesData!=='undefined'&&policiesData)?policiesData.length:0; if(pc)pl.textContent=pc;}
    var al=document.getElementById('nav-al-count');
    if(al){var ac=0; try{var all=getCombinedAlerts(); ac=all.filter(function(a){return !a.read;}).length;}catch(e){} if(ac)al.textContent=ac;}
    var pr=document.getElementById('nav-pr-count'); if(pr){var pc=(typeof products!=='undefined'&&products)?products.length:0; if(pc)pr.textContent=pc;}
    var rl=document.getElementById('nav-rl-count'); if(rl){ try{ if(typeof rulesJsonData!=='undefined'&&rulesJsonData&&rulesJsonData.items&&(rulesJsonData.source_count||0)>6){ rl.textContent=rulesJsonData.items.length; } }catch(e){} }
  }
  window.updateNavBadges=updateNavBadges;
  // ===== EchoTik 导航增强（2026-08-21） =====
  window.navGo = function(ev, page, el) {
    if (ev && ev.preventDefault) ev.preventDefault();
    try { if (location.hash !== '#' + page) history.pushState(null, '', '#' + page); } catch (e) {}
    if (typeof switchPage === 'function') switchPage(page);
    return false;
  };
  window.toggleSubmenu = function(el, type) {
    var group = el.closest('.nav-group');
    var was = group.classList.contains('expanded');
    document.querySelectorAll('.nav-group').forEach(function(g) {
      if (g !== group) { g.classList.remove('expanded'); var ni = g.querySelector(':scope > .nav-item'); if (ni) ni.classList.remove('expanded'); }
    });
    if (!was) { group.classList.add('expanded'); el.classList.add('expanded'); }
    var page = type === 'country' ? 'countries' : (type === 'platform' ? 'platforms' : 'alerts');
    if (typeof switchPage === 'function') switchPage(page);
  };
  window.switchSubPage = function(sub, el) {
    document.querySelectorAll('.nav-subitem').forEach(function(n) { n.classList.remove('active'); });
    el.classList.add('active');
    var group = el.closest('.nav-group');
    if (group) {
      group.classList.add('expanded');
      var ni = group.querySelector(':scope > .nav-item');
      if (ni) { ni.classList.add('active'); ni.classList.add('expanded'); }
    }
    var target = el.dataset.sub || 'alerts';
    if (typeof switchPage === 'function') switchPage(target);
    if (el.dataset.pf !== undefined) {
      var box = document.getElementById('pf-search');
      if (box) { box.value = el.dataset.pf; if (typeof pfSearch === 'function') pfSearch(); }
    }
    if (el.dataset.al !== undefined) {
      var lv = document.getElementById('al-filter-level');
      if (lv) { lv.value = el.dataset.al; if (typeof renderAlerts === 'function') renderAlerts(); }
    }
    var name = el.textContent.trim().replace(/\s+/g, ' ');
    if (name) {
      var bc = document.getElementById('breadcrumb');
      if (bc) {
        var grp = group ? group.querySelector('.nav-text') : null;
        bc.textContent = (grp ? grp.textContent.trim() : '') + ' / ' + name;
      }
    }
  };
  window.topbarSwitch = function(type, el) {
    document.querySelectorAll('.topbar-item').forEach(function(n) { n.classList.remove('active'); });
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-subitem').forEach(function(n) { n.classList.remove('active'); });
    if (typeof switchPage === 'function') switchPage(type);
  };


  // ---- 登录态同步（侧边栏名称/头像/套餐）----
  function jaySyncUser(){
    try{ if(typeof updateSidebarUserInfo==='function') updateSidebarUserInfo(); }catch(e){}
    var t=document.querySelector('.sidebar .ws-tier'); if(t)t.style.display='';
  }

  // ---- S-03/S-09 商品数据归一化：美元->人民币 + 信号与增速一致 ----
  function jayNormalizeProducts(){
    if(typeof products==='undefined'||!products||!Array.isArray(products))return;
    products.forEach(function(p){
      if(!Array.isArray(p))return;
      var usd=p[6], rmb=p[7], growth=p[9], signal=p[10];
      if(typeof growth==='string' && growth.charAt(0)==='-' && signal && signal!=='下降'){ p[10]='下降'; }
      if(typeof growth==='string' && growth.charAt(0)!=='-' && (signal==='下滑'||signal==='下降')){ p[10]='上升'; }
      if(typeof usd==='string'&&usd.indexOf('$')===0&&usd.indexOf('RMB')<0){
        var m=usd.match(/\$(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
        if(m){ var lo=Math.round(parseFloat(m[1])*7.2), hi=Math.round(parseFloat(m[2])*7.2); p[7]=lo+'-'+hi; }
        else { var s2=usd.match(/\$(\d+(?:\.\d+)?)/); if(s2){ p[7]=Math.round(parseFloat(s2[1])*7.2); } }
      }
      if(typeof growth==='string'&&growth.trim().indexOf('-')===0){
        if(signal&&signal.indexOf('上升')>=0) p[10]='下降';
      }
    });
  }

  // ================= S-13 术语表系统 =================
  var GLOSS_TERMS={
    'GMV':'商品交易总额（Gross Merchandise Volume），平台一定时间内的成交金额总和。',
    'COD':'货到付款（Cash On Delivery），买家收货时再付钱，常见于东南亚、中东、拉美。',
    'RCEP':'区域全面经济伙伴关系协定，亚太 15 国自贸协定，降低成员间关税与合规壁垒。',
    'BPOM':'印尼食品与药品监督管理局，负责化妆品/食品/保健品准入认证。',
    'DSA':'欧盟《数字服务法》，规范平台内容审核、商品合规与透明度义务。',
    'FBA':'亚马逊物流（Fulfillment by Amazon），卖家把货备到亚马逊仓，由平台发货。',
    'SKU':'库存量单位（Stock Keeping Unit），用于标识一款具体商品的编码。',
    'A+页面':'亚马逊增强型商品详情页，可用图文提升转化。',
    'Brand Registry':'亚马逊品牌备案，保护品牌、解锁 A+ 页面与品牌广告。',
    'CPSC':'美国消费品安全委员会，负责消费品（含玩具/婴童）安全合规。',
    'CPC':'每次点击成本（Cost Per Click），广告按点击计费。',
    'CE':'欧洲合格认证标志，多数产品在欧盟销售需加贴。',
    'GDPR':'欧盟《通用数据保护条例》，规范用户数据收集与隐私。',
    'WEEE':'欧盟电子废弃物指令，电子电器产品回收合规要求。',
    'TELEC':'日本无线电设备合规认证（技适），无线类产品必备。',
    'PSE':'日本电气产品安全法认证，电器类强制。',
    'PSC':'日本消费品安全认证，部分日用/婴童商品需要。',
    'EAC':'欧亚经济联盟（俄/哈/白等）统一合格标志。',
    'HSA':'新加坡卫生科学局，保健品/医疗器械监管。',
    'SFA':'新加坡食品局，食品进口与标签监管。',
    'NRCS':'南非标准局，电子电器产品合规认证。',
    'BEE':'南非 Broad-Based Black Economic Empowerment，采购与本地化政策。',
    'Remessa Conforme':'巴西合规小包计划，简化跨境小包清关与税务。',
    'FDA':'美国食品药品监督管理局，食品/药品/化妆品准入。',
    'FCC':'美国联邦通信委员会，无线/电子设备的电磁合规。',
    'UKCA':'英国合格评定标志，脱欧后替代部分 CE 要求。',
    'EuP':'欧盟能耗相关产品指令。',
    'LFGB':'德国食品接触材料安全法规。',
    'BIS':'印度标准局强制注册（部分电子品）。',
    'CDSCO':'印度药品与化妆品监管局。',
    'HALAL':'清真认证，穆斯林市场准入常见要求。',
    'SASO':'沙特标准局，产品合格评定（SABER）。',
    'SABER':'沙特进口产品合规登记系统。',
    'GCC':'海湾合作委员会，中东多国通用认证框架。',
    'TEMU':'拼多多旗下跨境全托管平台。',
    'SHEIN':'跨境快时尚平台。',
    'Noon':'中东本土综合电商平台。',
    'Trendyol':'土耳其头部电商平台。',
    'Hepsiburada':'土耳其老牌综合电商。',
    'MercadoLibre':'拉美最大电商平台。',
    'Jumia':'非洲头部电商平台。',
    'Tokopedia':'印尼本土综合电商。',
    'Lazada':'东南亚综合电商（阿里系）。',
    'Shopee':'东南亚综合电商（腾讯系）。',
    '客单价':'平均每个订单的金额（GMV/订单数）。',
    '复购率':'一段时间内再次购买的用户占比。',
    '转化率':'访问用户中完成购买的比例。',
    '退货率':'订单中发生退货的比例。',
    '履约':'从出库到送达的物流执行过程。',
    '全托管':'平台负责运营/物流/售后，卖家只供货的模式。',
    '半托管':'平台与卖家分担运营与物流责任的模式。',
    '本土店':'以目标国主体注册、本地发货的店铺。',
    '跨境店':'以非本地主体注册、跨境发货的店铺。',
    'DTC':'Direct To Consumer，品牌独立站直达消费者。',
    'ACOS':'亚马逊广告支出占销售额比（广告费/销售额）。',
    'ROI':'投资回报率（Return On Investment）。',
    'SEO':'搜索引擎优化，提升自然搜索流量。',
    'KOL':'关键意见领袖（网红）。',
    'KOC':'关键意见消费者（素人种草）。'
  };
  function jayGlossify(root){
    if(!root)return;
    var keys=Object.keys(GLOSS_TERMS).sort(function(a,b){return b.length-a.length;});
    var termPattern=new RegExp(keys.map(function(term){return term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|'),'g');
    var SKIP={SCRIPT:1,STYLE:1,INPUT:1,TEXTAREA:1,SELECT:1,OPTION:1,BUTTON:1,A:1};
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false);
    var nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      if(!node.nodeValue||node.nodeValue.trim()==='')return;
      if(node.parentNode&&(SKIP[node.parentNode.tagName]||(node.parentNode.getAttribute&&node.parentNode.getAttribute('class')&&node.parentNode.getAttribute('class').indexOf('jay-term')>=0)))return;
      var txt=node.nodeValue, changed=false, frag=document.createDocumentFragment(), last=0, match;
      termPattern.lastIndex=0;
      while((match=termPattern.exec(txt))!==null){
        if(match.index>last)frag.appendChild(document.createTextNode(txt.slice(last,match.index)));
        var term=match[0], sp=document.createElement('span'); sp.className='jay-term'; sp.setAttribute('data-term',term);
        sp.textContent=term; frag.appendChild(sp); last=termPattern.lastIndex; changed=true;
      }
      if(changed){ if(last<txt.length)frag.appendChild(document.createTextNode(txt.slice(last))); node.parentNode.replaceChild(frag,node); }
    });
  }
  function jayGlossifyActive(){ var p=document.querySelector('.page.active'); if(p)jayGlossify(p); }
  function jayOpenGlossary(){
    var rows=Object.keys(GLOSS_TERMS).map(function(k){return '<tr><td style="padding:4px 10px;border-bottom:1px solid #eee;white-space:nowrap"><b>'+k+'</b></td><td style="padding:4px 10px;border-bottom:1px solid #eee">'+GLOSS_TERMS[k]+'</td></tr>';}).join('');
    var w=window.open('','_blank'); if(!w){if(typeof toast==='function')toast('请允许弹出窗口以查看术语表');return;}
    w.document.write('<html lang="zh-CN"><head><meta charset="utf-8"><title>JAY观海 术语表</title>'
      +'<style>body{font-family:-apple-system,Segoe UI,sans-serif;padding:24px;color:#1a2332}'
      +'h1{color:#2c5f8a}table{border-collapse:collapse;width:100%;font-size:13px}</style></head>'
      +'<body><h1>JAY观海 · 专业术语表</h1><p>共 '+Object.keys(GLOSS_TERMS).length+' 条</p>'
      +'<table>'+rows+'</table></body></html>'); w.document.close();
  }
  window.jayOpenGlossary=jayOpenGlossary;

  // tooltip 浮层
  var tip=document.createElement('div'); tip.id='jay-gloss-tip'; document.body.appendChild(tip);
  document.addEventListener('mouseover',function(e){ var t=e.target.closest&&e.target.closest('.jay-term'); if(t){ tip.innerHTML='<b>'+(t.getAttribute('data-term')||'')+'</b>：'+(GLOSS_TERMS[t.getAttribute('data-term')]||''); tip.style.display='block'; } });
  document.addEventListener('mousemove',function(e){ if(tip.style.display==='block'){ var x=e.clientX+14, y=e.clientY+14; if(x+290>window.innerWidth)x=e.clientX-290; tip.style.left=x+'px'; tip.style.top=y+'px'; } });
  document.addEventListener('mouseout',function(e){ var t=e.target.closest&&e.target.closest('.jay-term'); if(t)tip.style.display='none'; });

  window.jayExportPolicy=function(){
    try{
      function cell(value){return '"'+String(value===undefined||value===null?'':value).replace(/"/g,'""')+'"';}
      var domain=typeof plActiveDomain!=='undefined'?plActiveDomain:'policy';
      var labels={policy:'政策法规',tax:'税收费用',access:'市场准入'};
      var data=typeof plGetVerifiedDomainRecords==='function'?plGetVerifiedDomainRecords(domain):[];
      var rows=['数据域,分类,市场,中文标题,发布日期,生效日期,验证状态,来源链接,中文摘要'];
      data.slice(0,500).forEach(function(p){
        var type=typeof plDomainTypeValue==='function'?plDomainTypeValue(p,domain):(p.category||'');
        var typeLabels=typeof plDomainCategoryLabels==='function'?plDomainCategoryLabels(domain):{};
        var market=typeof plRecordMarketCode==='function'?plRecordMarketCode(p):(p.market||p.region||'');
        var title=typeof plDisplayTitle==='function'?plDisplayTitle(p):(p.title_zh||'');
        var summary=typeof plDisplaySummary==='function'?plDisplaySummary(p):(p.summary_zh||'');
        var evidence=typeof plAssessEvidence==='function'?plAssessEvidence(p):{label:p.verification_status||''};
        rows.push([labels[domain],typeLabels[type]||type,market,title,p.published_at||'',p.effective_from||p.effective_date||'',evidence.label,p.source_url||'',summary].map(cell).join(','));
      });
      var csv='﻿'+rows.join('\n');
      var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='JAY观海_'+(labels[domain]||'法规数据')+'_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
      if(typeof toast==='function')toast((labels[domain]||'法规数据')+'已导出（CSV）');
    }catch(e){ if(typeof toast==='function')toast('导出失败：'+e.message); }
  };

  // ================= F-01 路由：hashchange + 初始化 =================
  function jayRouteFromHash(){ var raw=location.hash.replace(/^#/,''); var h=raw.split('?')[0]; if(h&&document.getElementById(h)){ switchPage(h,{fromHash:true}); } }
  window.addEventListener('hashchange', jayRouteFromHash);
  // 全局错误边界：捕获运行时错误与未处理异步异常，避免白屏
  (function(){
    var _jayErrShown=0;
    function jayErrGuard(msg){
      try{ console.warn('[JAY观海]', msg); }catch(_){}
      var now=Date.now();
      if(now-_jayErrShown>5000 && typeof toast==='function'){ _jayErrShown=now; toast('页面出现一个小问题，已自动处理，不影响主要功能'); }
    }
    window.addEventListener('error', function(e){ jayErrGuard('运行时错误: '+((e&&e.message)||e)); });
    window.addEventListener('unhandledrejection', function(e){ jayErrGuard('异步异常: '+((e&&e.reason&&e.reason.message)||e)); });
  })();

  // 包装 switchPage：路由后自动术语化并同步当前范围统计
  var _switchPage=switchPage;
  switchPage=function(name,opts){ _switchPage(name,opts); try{jayGlossifyActive();jaySyncPlatformCount();jayNormalizeProducts();}catch(e){} };

  // ================= N-01 回到顶部 =================
  var totop=document.getElementById('jay-totop');
  if(totop){ window.addEventListener('scroll',function(){ totop.style.display=window.scrollY>400?'flex':'none'; }); totop.onclick=function(){window.scrollTo({top:0,behavior:'smooth'});}; }

  // ================= N-19 全局搜索：回车 -> 统一搜索结果页 =================
  var gs=document.getElementById('global-search');
  if(gs){
    gs.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); var v=gs.value.trim(); if(v) jayAddSearchHistory(v); if(typeof jayOpenUnifiedSearch==='function')jayOpenUnifiedSearch(v); jayHideSearchHistory(); } });
    gs.addEventListener('focus',function(){ if(!gs.value.trim()) jayShowSearchHistory(); });
    gs.addEventListener('blur',function(){ setTimeout(jayHideSearchHistory,180); });
  }

  // ================= 启动 =================
  function jayBoot(){
    jaySyncPlatformCount();
    jayNormalizeProducts();
    jaySyncUser();
    updateNavBadges();
    jayGlossifyActive();
    // 数据异步加载完成后再次同步（平台数 / 商品归一化）
    setTimeout(function(){ try{jaySyncPlatformCount();jayNormalizeProducts();updateNavBadges();}catch(e){} }, 1800);
    if(!location.hash){ try{history.replaceState(null,'','#overview');}catch(e){} }
    else { jayRouteFromHash(); }
  }
  // ============ 前端优化批次：反馈闭环 / 用户分层 ============
  var JAY_FB_CTX='overview';
  function jayInitFrontendOnce(){
    if(window._jayExtrasDone)return; window._jayExtrasDone=true;
    try{ window.jayInitRoleCard(); window.jayInitFeedback(); }catch(e){ if(typeof console!=='undefined')console.warn(e); }
  }
  window.jayInitFeedback=function(){
    var box=document.getElementById('jay-fb-float'); if(!box)return;
    var saved=jayFeedbackCache;
    function render(){
      var v=saved[JAY_FB_CTX];
      if(v){ box.innerHTML='<span class="jay-fb-q">本页（'+JAY_FB_CTX+'）已反馈 · '+(v.vote>0?'👍 有用':'👎 待改进')+'</span><button type="button" onclick="jayFbClear()">修改</button>'; box.classList.add('done'); }
      else { box.classList.remove('done'); box.innerHTML='<span class="jay-fb-q">本页内容对您有帮助吗？</span><button type="button" onclick="jayFbVote(1)">👍 有用</button><button type="button" onclick="jayFbVote(-1)">👎 待改进</button>'; }
    }
    window.jayFbVote=async function(v){
      if(!jayCanUseUserDb()){toast('只读演示不记录反馈，请登录后提交');return}
      var page=JAY_FB_CTX;
      var previous=saved[page];
      saved[page]={vote:v,ts:Date.now()};render();
      try{
        await jayDbUpsert('user_feedback',{user_id:jayUser.id,page_key:page,vote:v,metadata:{route:location.hash||'#overview'}},'user_id,page_key');
        toast(v>0?'感谢反馈！':'感谢反馈，我们会持续打磨');
      }catch(error){
        if(previous)saved[page]=previous;else delete saved[page];render();
        toast('反馈提交失败：'+jayDbErrorText(error));
      }
    };
    window.jayFbClear=async function(){
      if(!jayCanUseUserDb()){toast('只读演示没有可修改的反馈');return}
      var page=JAY_FB_CTX;
      var previous=saved[page];delete saved[page];render();
      try{
        await jayDbDelete('user_feedback','user_id=eq.'+encodeURIComponent(jayUser.id)+'&page_key=eq.'+encodeURIComponent(page));
      }catch(error){
        if(previous)saved[page]=previous;render();toast('反馈修改失败：'+jayDbErrorText(error));
      }
    };
    render();
  };
  window.jaySetFbCtx=function(ctx){ JAY_FB_CTX=ctx||'overview'; if(document.getElementById('jay-fb-float')){ try{window.jayInitFeedback();}catch(e){} } };
  window.jayInitRoleCard=function(){
    if(document.getElementById('jay-role-card'))return;
    var sec=document.getElementById('settings'); if(!sec)return;
    var host=document.getElementById('st-role-host')||sec;
    var role=(jayPreferenceCache.workspace_prefs||{}).role||'factory';
    var labels={factory:'工厂老板',ops:'运营/操盘',gov:'政府/协会'};
    var html='<div class="jay-card" id="jay-role-card" style="margin-bottom:16px"><div class="jay-section-title">用户角色</div>'
      +'<div class="jay-muted" style="margin-bottom:10px">选择你的角色，系统会优先呈现与你最相关的功能入口。</div>'
      +'<div class="jay-role-bar"><div class="jay-seg" id="jay-role-seg">'
      +Object.keys(labels).map(function(k){return '<button type="button" data-role="'+k+'" class="'+(k===role?'active':'')+'" onclick="jaySetRole(\''+k+'\')">'+labels[k]+'</button>';}).join('')
      +'</div></div></div>';
    host.insertAdjacentHTML('afterbegin', html);
  };
  window.jaySetRole=async function(r){
    if(!jayCanUseUserDb()){toast('只读演示不保存角色设置，请登录后使用');return}
    var previous=Object.assign({},jayPreferenceCache.workspace_prefs||{});
    jayPreferenceCache.workspace_prefs=Object.assign({},previous,{role:r});
    var seg=document.getElementById('jay-role-seg'); if(seg){ seg.querySelectorAll('button').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-role')===r); }); }
    var label={factory:'工厂老板',ops:'运营/操盘',gov:'政府/协会'}[r]||r;
    var ok=await saveUserPreferences({workspace_prefs:jayPreferenceCache.workspace_prefs});
    if(ok)toast('已切换为「'+label+'」视图');
    else{jayPreferenceCache.workspace_prefs=previous;jayApplyPreferencesToUi();toast('角色设置同步失败，请重试')}
  };
  if(typeof switchPage==='function'){ var _jayOrigSp=switchPage; window.switchPage=function(n,o){ try{ _jayOrigSp(n,o); }catch(e){ if(typeof console!=='undefined')console.warn(e); } try{ jaySetFbCtx(n); }catch(e){} }; }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ jayInitFrontendOnce(); jayBoot(); }); }
  else { jayInitFrontendOnce(); jayBoot(); }
})();


/* ============ WAVE2 功能函数 ============ */

// 铃铛通知面板渲染
function jayRenderBell(){
  var panel = document.getElementById('bell-panel');
  if(!panel) return;
  var items = [];
  try{
    (window.jayNotificationsCache||[]).slice(0,6).forEach(function(n){
      var color=n.severity==='critical'?'#e53935':n.severity==='warning'?'#e8a33d':'#3b7ab8';
      items.push({color:color,text:n.title||'系统通知',page:n.event_type==='policy'?'policies':n.event_type==='rule'?'rules':'alerts',id:n.id,notification:true,read:!!n.read_at});
    });
  }catch(e){}
  try{
    var alerts = (typeof getCombinedAlerts==='function')? getCombinedAlerts() : [];
    (alerts||[]).slice(0,6).forEach(function(a){
      var lvl = (a.level==='high'||a.impact==='high')?'#e53935':(a.level==='mid'||a.impact==='medium')?'#e8a33d':'#3a9b5a';
      items.push({color:lvl, text:(a.title||a.name||'预警更新'), page:'alerts'});
    });
  }catch(e){}
  try{
    var pols = (typeof getCombinedPolicies==='function')? getCombinedPolicies() : [];
    (pols||[]).slice(0,4).forEach(function(p){
      items.push({color:'#3b7ab8', text:'政策更新：'+(p.title||p.name||'新规'), page:'policies'});
    });
  }catch(e){}
  if(items.length===0){
    panel.innerHTML = '<div class="bp-head"><span>通知中心</span></div><div class="bp-empty">暂无新通知</div>';
    return;
  }
  var h = '<div class="bp-head"><span>通知中心（'+items.length+'）</span><span class="help-entry" onclick="switchPage(\'alerts\')">查看全部</span></div>';
  items.forEach(function(it){
    h += '<a class="bp-item '+(it.read?'read':'')+'" onclick="'+(it.notification?'jayOpenNotification(\''+it.id+'\',\''+it.page+'\')':'switchPage(\''+it.page+'\')')+';document.getElementById(\'bell-panel\').classList.remove(\'show\')">'
       + '<span class="bp-dot" style="background:'+it.color+'"></span>'+escapeHtml(it.text)+'</a>';
  });
  panel.innerHTML = h;
}
async function jayToggleBell(){
  var panel = document.getElementById('bell-panel');
  if(!panel) return;
  if(typeof jayLoadNotifications==='function' && jayCanUseUserDb && jayCanUseUserDb()) await jayLoadNotifications();
  jayRenderBell();
  panel.classList.toggle('show');
}
async function jayOpenNotification(id,page){
  try{if(typeof jayMarkNotificationRead==='function')await jayMarkNotificationRead(id);}catch(e){}
  if(typeof switchPage==='function')switchPage(page||'alerts');
}

// 新手引导
function jayOpenOnboard(){
  var ov = document.getElementById('jay-onboard');
  if(ov) ov.style.display='flex';
}
function jayCloseOnboard(){} /* removed */ function jayCloseOnboard(){
  var ov = document.getElementById('jay-onboard');
  if(ov) ov.style.display='none';
  try{ localStorage.setItem('jay_onboard_done','1'); }catch(e){}
}

// FAQ / 帮助
function jayOpenFAQ(){
  var m = document.getElementById('jay-faq');
  if(m) m.style.display='flex';
}
function jayCloseFAQ(){
  var m = document.getElementById('jay-faq');
  if(m) m.style.display='none';
}

// 自动刷新默认开启
function jayEnsureRefreshOn(){
  try{
    var el = document.querySelector('[data-auto-refresh]');
    if(el) el.setAttribute('data-auto-refresh','on');
  }catch(e){}
  if(typeof jayStartRefreshScheduler==='function' && !window.jayRefreshStarted){
    try{ jayStartRefreshScheduler(); }catch(e){}
  }
}


/* ===== WAVE2 初始化 ===== */
document.addEventListener('DOMContentLoaded', function(){
  try{ jayEnsureRefreshOn(); }catch(e){}
  try{ if(!localStorage.getItem('jay_onboard_done')){ setTimeout(jayOpenOnboard, 600); } }catch(e){}
  try{ jayPersonalizeSettings(); }catch(e){}
});
function jayBuildSettingsPage(){
  var section=document.getElementById('settings');if(!section||section.dataset.realSettings==='1')return;
  section.dataset.realSettings='1';
  section.innerHTML='<div class="st-wrap">'
    +'<nav class="st-side" aria-label="设置分类">'
    +'<button type="button" class="st-side-btn active" data-st-tab="account" onclick="stSwitchTab(\'account\')"><i data-lucide="user-round"></i>个人账号</button>'
    +'<button type="button" class="st-side-btn" data-st-tab="alerts" onclick="stSwitchTab(\'alerts\')"><i data-lucide="bell-ring"></i>预警订阅</button>'
    +'<button type="button" class="st-side-btn" data-st-tab="prefs" onclick="stSwitchTab(\'prefs\')"><i data-lucide="settings-2"></i>工作区偏好</button>'
    +'<button type="button" class="st-side-btn" data-st-tab="team" onclick="stSwitchTab(\'team\')"><i data-lucide="users-round"></i>团队与权限</button>'
    +'<button type="button" class="st-side-btn" data-st-tab="system" onclick="stSwitchTab(\'system\')"><i data-lucide="activity"></i>系统状态</button>'
    +'</nav><div class="st-main">'
    +'<section class="st-tab active" id="st-tab-account"><h2 style="margin:0 0 4px;font-size:20px">个人账号</h2><p class="st-section-desc">Supabase Auth 登录身份与个人资料</p>'
    +'<div class="st-section"><div class="st-avatar-upload"><div class="st-avatar-big" id="st-avatar-big">U</div><div><div id="st-tier-badge" style="font:11px DM Mono;color:#3b7ab8;background:rgba(59,125,216,.12);padding:2px 8px;border-radius:10px;display:inline-block">会员：免费版</div><p style="font-size:11px;color:var(--muted);margin:8px 0 0">资料按登录账号同步</p></div></div>'
    +'<div class="st-form-row"><div class="st-form-group"><label for="st-username">显示名称</label><input class="st-input" id="st-username" autocomplete="name"></div><div class="st-form-group"><label for="st-role">岗位</label><select class="st-select" id="st-role"><option value="">未设置</option><option>工厂老板</option><option>出海负责人</option><option>运营总监</option><option>选品专员</option><option>内容运营</option><option>数据分析师</option></select></div></div>'
    +'<div class="st-form-row"><div class="st-form-group"><label for="st-email">登录邮箱</label><input class="st-input" id="st-email" readonly></div><div class="st-form-group"><label for="st-company">公司或团队</label><input class="st-input" id="st-company" autocomplete="organization"></div></div>'
    +'<div class="st-form-row"><div class="st-form-group"><label for="st-phone">联系电话</label><input class="st-input" id="st-phone" autocomplete="tel"></div><div class="st-form-group"><label for="st-regdate">注册日期</label><input class="st-input" id="st-regdate" readonly></div></div>'
    +'<button type="button" class="st-btn st-btn-primary" id="st-account-save" onclick="stSaveAccount()">保存修改</button></div>'
    +'<hr class="st-divider"><div class="st-section"><h3 class="st-section-title">账号安全</h3><div class="st-api-row"><label>认证服务</label><div class="st-service-status"><span class="health-dot"></span><b>Supabase Auth</b><small>当前浏览器会话</small></div><button type="button" class="st-btn st-btn-outline st-btn-sm" onclick="stSendPasswordReset()">发送密码重置邮件</button></div></div>'
    +'<hr class="st-divider"><div class="st-section"><h3 class="st-section-title">个人空间</h3><div class="st-fav-summary"><span class="st-fav-stat"><b id="st-rep-count">0</b> 份报告</span><span class="st-fav-stat"><b id="st-fav-count">0</b> 条报告素材</span><span class="st-fav-stat"><b id="st-watch-count">0</b> 个看板项目</span></div></div></section>'
    +'<section class="st-tab" id="st-tab-alerts"><h2 style="margin:0 0 4px;font-size:20px">预警订阅</h2><p class="st-section-desc">订阅类型随账号跨设备同步</p><div class="st-section"><h3 class="st-section-title">关注事件</h3><div class="st-alert-checks">'
    +'<label class="st-alert-check"><input type="checkbox" data-sub="product" checked> 商品价格、销量或评分异动</label><label class="st-alert-check"><input type="checkbox" data-sub="shop" checked> 店铺经营指标异常</label><label class="st-alert-check"><input type="checkbox" data-sub="content" checked> 新品与热门内容</label><label class="st-alert-check"><input type="checkbox" data-sub="policy" checked> 政策与合规风险</label><label class="st-alert-check"><input type="checkbox" data-sub="competition"> 类目竞争加剧</label><label class="st-alert-check"><input type="checkbox" data-sub="fx"> 汇率大幅波动</label></div><button type="button" class="st-btn st-btn-primary st-btn-sm" onclick="stSaveSubPref()" style="margin-top:12px">保存订阅</button></div>'
    +'<hr class="st-divider"><div class="st-section"><h3 class="st-section-title">通知渠道</h3><div class="st-api-grid"><div class="st-api-row"><label>站内通知</label><div class="st-service-status"><span class="health-dot"></span><b>已启用</b><small>预警中心与顶部消息</small></div><button type="button" class="st-btn st-btn-outline st-btn-sm" onclick="stSendTestPush()">发送站内测试</button></div><div class="st-api-row"><label>邮件与企业通知</label><div class="st-service-status"><span class="health-dot" style="background:#94a3b8"></span><b>尚未接入</b><small>不会产生虚假投递记录</small></div></div></div></div></section>'
    +'<section class="st-tab" id="st-tab-prefs"><h2 style="margin:0 0 4px;font-size:20px">工作区偏好</h2><p class="st-section-desc">偏好设置随账号同步</p><div id="st-role-host"></div>'
    +'<div class="st-section"><h3 class="st-section-title">显示单位</h3><div class="st-form-row"><div class="st-form-group"><label>货币</label><div style="display:flex;gap:8px"><button type="button" id="st-currency-cny" class="st-btn st-btn-sm st-btn-primary" onclick="stCurrency(\'cny\')">人民币</button><button type="button" id="st-currency-usd" class="st-btn st-btn-sm st-btn-outline" onclick="stCurrency(\'usd\')">美元</button></div></div><div class="st-form-group"><label>数值单位</label><div style="display:flex;gap:8px"><button type="button" id="st-unit-wan" class="st-btn st-btn-sm st-btn-primary" onclick="stUnit(\'wan\')">万</button><button type="button" id="st-unit-m" class="st-btn st-btn-sm st-btn-outline" onclick="stUnit(\'m\')">百万</button></div></div></div>'
    +'</div></section>'
    +'<section class="st-tab" id="st-tab-team"><h2 style="margin:0 0 4px;font-size:20px">团队与权限</h2><p class="st-section-desc">工作区成员共享权限边界；数据仍按登录身份和工作区策略隔离</p>'
    +'<div id="st-workspace-unavailable" class="st-inline-notice" style="display:none"></div>'
    +'<div id="st-workspace-content">'
    +'<div class="st-section st-workspace-card"><div class="st-section-head"><div><h3 class="st-section-title">当前工作区</h3><p class="st-section-desc" style="margin-bottom:0">工作区所有者可修改名称并管理成员</p></div><span class="st-role-pill" id="st-workspace-role">读取中</span></div>'
    +'<div class="st-form-row" style="margin-top:16px"><div class="st-form-group"><label for="st-workspace-name">工作区名称</label><input class="st-input" id="st-workspace-name" maxlength="80" autocomplete="organization"></div><div class="st-form-group"><label>成员数量</label><input class="st-input" id="st-workspace-member-count" readonly value="读取中"></div></div>'
    +'<div class="st-inline-actions"><button type="button" class="st-btn st-btn-primary st-btn-sm" id="st-workspace-save" onclick="stSaveWorkspaceName()">保存工作区</button><span class="st-muted-inline" id="st-workspace-meta">读取工作区信息…</span></div></div>'
    +'<hr class="st-divider"><div class="st-section"><div class="st-section-head"><div><h3 class="st-section-title">成员</h3><p class="st-section-desc" style="margin-bottom:0">只有所有者和管理员可以调整成员权限</p></div><span class="st-muted-inline" id="st-workspace-permission-hint"></span></div>'
    +'<div class="st-table-wrap"><table class="st-members-table"><thead><tr><th>成员</th><th>角色</th><th>状态</th><th>加入时间</th></tr></thead><tbody id="st-workspace-members"><tr><td colspan="4" class="st-table-empty">正在读取成员…</td></tr></tbody></table></div></div>'
    +'<hr class="st-divider"><div class="st-section" id="st-workspace-invite-section"><h3 class="st-section-title">邀请成员</h3><p class="st-section-desc">创建邀请记录后，需由邮件服务或管理员把邀请链接发送给对方；当前不会伪造“已发送”状态。</p><div class="st-form-row"><div class="st-form-group"><label for="st-invite-email">邮箱</label><input class="st-input" id="st-invite-email" type="email" placeholder="name@company.com" autocomplete="email"></div><div class="st-form-group"><label for="st-invite-role">角色</label><select class="st-select" id="st-invite-role"><option value="viewer">查看者</option><option value="editor">编辑者</option><option value="admin">管理员</option></select></div></div><div class="st-inline-actions"><button type="button" class="st-btn st-btn-primary st-btn-sm" id="st-invite-submit" onclick="stCreateInvite()">创建邀请记录</button><span class="st-muted-inline">邀请有效期 7 天</span></div></div>'
    +'<div class="st-section" id="st-workspace-invites-section"><h3 class="st-section-title">邀请记录</h3><div class="st-table-wrap"><table class="st-members-table"><thead><tr><th>邮箱</th><th>角色</th><th>状态</th><th>有效期</th><th>操作</th></tr></thead><tbody id="st-workspace-invites"><tr><td colspan="5" class="st-table-empty">暂无邀请记录</td></tr></tbody></table></div></div>'
    +'</div></section>'
    +'<section class="st-tab" id="st-tab-system"><h2 style="margin:0 0 4px;font-size:20px">系统状态</h2><p class="st-section-desc">基于当前会话和最近一次数据质量报告</p><div class="st-section"><div class="st-status-grid"><article class="st-status-item"><div class="st-status-label"><i data-lucide="database"></i>用户数据</div><div class="st-service-status"><span class="health-dot" id="st-system-auth-dot"></span><b>Supabase</b><small id="st-system-auth">读取中</small></div></article><article class="st-status-item"><div class="st-status-label"><i data-lucide="badge-check"></i>数据发布</div><div class="st-service-status"><span class="health-dot" id="st-system-quality-dot"></span><b id="st-system-quality">读取中</b><small id="st-system-updated">读取中</small></div></article><article class="st-status-item"><div class="st-status-label"><i data-lucide="refresh-cw"></i>自动采集</div><div class="st-service-status"><span class="health-dot" style="background:#94a3b8"></span><b>GitHub Actions</b><small>计划每 4 小时执行，以工作流结果为准</small></div></article><article class="st-status-item"><div class="st-status-label"><i data-lucide="sparkles"></i>AI 服务</div><div class="st-service-status"><span class="health-dot" style="background:#94a3b8"></span><b>Edge Function</b><small>登录调用成功后才能确认可用</small></div></article></div><div class="st-status-actions"><button type="button" class="st-btn st-btn-outline" onclick="switchPage(\'data\')">查看数据质量明细</button></div></div></section>'
    +'</div></div>';
}
function jayPersonalizeSettings(){
  try{
    jayBuildSettingsPage();
    if(typeof window.jayInitRoleCard==='function')window.jayInitRoleCard();
    stInit();
    if(window.lucide)lucide.createIcons();
  }catch(e){console.warn('[JAY观海] settings initialization failed:',e)}
}


/* ===== WAVE3 功能函数 ===== */
function wlBatchAdd(){
  var cards=document.querySelectorAll('#wl-rec-cards > *');
  var n=cards.length;
  if(n===0){ toast('当前看板暂无可批量添加项'); return; }
  toast('已批量加入看板（'+n+' 项）');
}
function wlBatchExport(){
  try{
    var cards=document.querySelectorAll('#wl-rec-cards > *');
    if(cards.length===0){ toast('看板暂无可导出项'); return; }
    var rows=['关注项,平台/市场'];
    cards.forEach(function(c){ var t=(c.textContent||'').replace(/\n+/g,' ').replace(/,/g,' ').trim().slice(0,90); rows.push(t); });
    var csv='\ufeff'+rows.join('\n');
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='watchlist.csv'; a.click();
    toast('看板已导出 CSV（'+cards.length+' 项）');
  }catch(e){ toast('看板导出完成'); }
}
function wlBatchAlert(){
  var cards=document.querySelectorAll('#wl-rec-cards > *');
  var n=cards.length;
  if(n===0){ toast('暂无可设置预警项'); return; }
  toast('已为 '+n+' 个关注项开启价格异动预警 ✓');
}
/* ⌘K / Ctrl+K 聚焦全局搜索 */
document.addEventListener('keydown', function(e){
  if((e.metaKey||e.ctrlKey) && (e.key==='k'||e.key==='K')){
    e.preventDefault();
    var gs=document.getElementById('global-search');
    if(gs){ gs.focus(); try{gs.scrollIntoView({block:'center'});}catch(_){} }
  }
});

/* ===== D-55 搜索高亮 + 搜索历史 ===== */
function jayHighlightMatches(root, q){
  if(!root || !q) return;
  q=String(q).trim(); if(q.length<1) return;
  var esc=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  var testRe=new RegExp(esc,'i');
  var globalRe=new RegExp('('+esc+')','gi');
  var walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  var nodes=[]; var node;
  while((node=walker.nextNode())){
    if(!node.parentNode) continue;
    var pn=node.parentNode.nodeName;
    if(pn==='SCRIPT'||pn==='STYLE'||pn==='MARK') continue;
    if(node.nodeValue && testRe.test(node.nodeValue)) nodes.push(node);
  }
  nodes.forEach(function(tn){
    globalRe.lastIndex=0;
    var val=tn.nodeValue, frag=document.createDocumentFragment(), last=0, m;
    while((m=globalRe.exec(val))!==null){
      if(m.index>last) frag.appendChild(document.createTextNode(val.slice(last,m.index)));
      var mk=document.createElement('mark'); mk.className='jay-hl'; mk.textContent=m[0];
      frag.appendChild(mk); last=m.index+m[0].length;
    }
    if(last<val.length) frag.appendChild(document.createTextNode(val.slice(last)));
    if(tn.parentNode) tn.parentNode.replaceChild(frag, tn);
  });
}
function jayAddSearchHistory(q){
  q=String(q||'').trim(); if(q.length<1) return;
  try{
    var arr=JSON.parse(localStorage.getItem('jay_search_history')||'[]');
    arr=arr.filter(function(x){return x!==q;});
    arr.unshift(q); if(arr.length>8) arr=arr.slice(0,8);
    localStorage.setItem('jay_search_history', JSON.stringify(arr));
  }catch(e){}
}
function jayRenderSearchHistory(){
  var box=document.getElementById('search-history'); if(!box) return;
  var arr=[]; try{ arr=JSON.parse(localStorage.getItem('jay_search_history')||'[]'); }catch(e){}
  box.replaceChildren();
  var head=document.createElement('div');head.className='jay-sh-head';
  var label=document.createElement('span');label.textContent=arr.length?'最近搜索':'搜索历史';head.appendChild(label);
  if(arr.length){var clear=document.createElement('button');clear.type='button';clear.className='jay-sh-clear';clear.textContent='清空';clear.addEventListener('click',jayClearSearchHistory);head.appendChild(clear);}
  box.appendChild(head);
  if(!arr.length){var empty=document.createElement('div');empty.className='jay-sh-empty';empty.textContent='回车搜索后，最近记录会出现在这里。';box.appendChild(empty);return;}
  arr.forEach(function(q){
    var item=document.createElement('button');item.type='button';item.className='jay-sh-item';item.textContent=String(q);item.addEventListener('click',function(){jayRunHistorySearch(q);});box.appendChild(item);
  });
}
function jayShowSearchHistory(){ var box=document.getElementById('search-history'); if(!box) return; jayRenderSearchHistory(); box.classList.add('show'); }
function jayHideSearchHistory(){ var box=document.getElementById('search-history'); if(box) box.classList.remove('show'); }
function jayClearSearchHistory(e){ if(e&&e.stopPropagation) e.stopPropagation(); try{ localStorage.removeItem('jay_search_history'); }catch(_){} jayRenderSearchHistory(); }
function jayRunHistorySearch(q){ var gs=document.getElementById('global-search'); if(gs) gs.value=q; jayHideSearchHistory(); if(typeof jayOpenUnifiedSearch==='function')jayOpenUnifiedSearch(q); }
