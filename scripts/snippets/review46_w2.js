/* ============ WAVE2 功能函数 ============ */

// 数字友好格式化：580000 -> 58万；12300 -> 1.2万
function jayFmtCount(n){
  n = parseFloat(String(n).replace(/[^0-9.]/g,''));
  if(!isFinite(n)) return '-';
  if(n >= 10000){
    var wan = n/10000;
    return (wan>=100? Math.round(wan) : (Math.round(wan*10)/10)) + '万';
  }
  return String(Math.round(n));
}

// 铃铛通知面板渲染
function jayRenderBell(){
  var panel = document.getElementById('bell-panel');
  if(!panel) return;
  var items = [];
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
      items.push({color:'#3b7dd8', text:'政策更新：'+(p.title||p.name||'新规'), page:'policies'});
    });
  }catch(e){}
  if(items.length===0){
    panel.innerHTML = '<div class="bp-head"><span>通知中心</span></div><div class="bp-empty">暂无新通知</div>';
    return;
  }
  var h = '<div class="bp-head"><span>通知中心（'+items.length+'）</span><span class="help-entry" onclick="switchPage(\'alerts\')">查看全部</span></div>';
  items.forEach(function(it){
    h += '<a class="bp-item" onclick="switchPage(\''+it.page+'\');document.getElementById(\'bell-panel\').classList.remove(\'show\')">'
       + '<span class="bp-dot" style="background:'+it.color+'"></span>'+it.text+'</a>';
  });
  panel.innerHTML = h;
}
function jayToggleBell(){
  var panel = document.getElementById('bell-panel');
  if(!panel) return;
  jayRenderBell();
  panel.classList.toggle('show');
}

// 新手引导
function jayOpenOnboard(){
  var ov = document.getElementById('jay-onboard');
  if(ov) ov.style.display='flex';
}
function jayCloseOnboard(){
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

// 溯源按钮路由：把"查看赛道分析"等空链接导向实际页面
function jayTraceLink(link){
  if(!link) return;
  var l = String(link);
  if(l.indexOf('赛道')>=0 || l.indexOf('分析')>=0){ switchPage('products'); return; }
  if(l.indexOf('Shopee')>=0||l.indexOf('TikTok')>=0||l.indexOf('Lazada')>=0||l.indexOf('Amazon')>=0||l.indexOf('Official')>=0){ switchPage('shops'); return; }
  toast('正在跳转到: '+l);
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
