/* JAY观海 评测修复 · 全局初始化脚本（由 patch_review46.py 注入到 </body> 前） */
(function(){
  'use strict';

  // ---- 平台总数（单一数据源）----
  var JAY_PLATFORM_COUNT = (typeof platforms!=='undefined'&&platforms)?Object.keys(platforms).length:66;
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
  }
  window.updateNavBadges=updateNavBadges;

  // ---- 登录态同步（侧边栏名称/头像/套餐）----
  function jaySyncUser(){
    try{ if(typeof updateSidebarUserInfo==='function') updateSidebarUserInfo(); }catch(e){}
    var t=document.querySelector('.sidebar .ws-tier'); if(t)t.style.display='';
  }

  // ---- S-03/S-09 商品数据归一化：美元->人民币 + 信号与增速一致 ----
  function jayNormalizeProducts(){
    if(typeof products==='undefined'||!products)return;
    products.forEach(function(p){
      if(!Array.isArray(p))return;
      var usd=p[6], rmb=p[7], growth=p[9], signal=p[10];
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

  // ---- S-08 国家市场「查看相关规则变动」数量闭环 ----
  function jayFixRuleCount(){
    try{
      var cards=document.querySelectorAll('.cn2-link-card');
      var cnt=0; try{ cnt=getFilteredRules?getFilteredRules().length:0; }catch(e){}
      cards.forEach(function(c){ if(c.textContent.indexOf('规则变动')>=0){ var el=c.querySelector('.lc-count'); if(el)el.textContent=(cnt||0); } });
    }catch(e){}
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
    var SKIP={SCRIPT:1,STYLE:1,INPUT:1,TEXTAREA:1,SELECT:1,OPTION:1,BUTTON:1,A:1};
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false);
    var nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      if(!node.nodeValue||node.nodeValue.trim()==='')return;
      if(node.parentNode&&(SKIP[node.parentNode.tagName]||(node.parentNode.getAttribute&&node.parentNode.getAttribute('class')&&node.parentNode.getAttribute('class').indexOf('jay-term')>=0)))return;
      var txt=node.nodeValue, changed=false, frag=document.createDocumentFragment(), last=0;
      keys.forEach(function(term){
        var idx=txt.indexOf(term);
        if(idx>=0){
          if(idx>last)frag.appendChild(document.createTextNode(txt.slice(last,idx)));
          var sp=document.createElement('span'); sp.className='jay-term'; sp.setAttribute('data-term',term);
          sp.textContent=term; frag.appendChild(sp); last=idx+term.length; changed=true;
        }
      });
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

  // ================= F-02 真实导出实现 =================
  window.jayExportReport=function(){
    try{
      var pool=[];try{pool=JSON.parse(localStorage.getItem('jay_report_pool')||'[]');}catch(e){}
      var reps=[];try{reps=JSON.parse(localStorage.getItem('jay_reports_v2')||'[]');}catch(e){}
      var html='<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>JAY观海 报告</title>'
        +'<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:32px;color:#1a2332;max-width:900px;margin:auto}'
        +'h1{border-bottom:2px solid #3b7dd8;padding-bottom:8px}h2{margin-top:24px;color:#2c5f8a}'
        +'li{margin:4px 0}.meta{color:#888;font-size:12px}</style></head><body>'
        +'<h1>JAY观海 · 市场情报报告</h1><p class="meta">导出时间：'+new Date().toLocaleString('zh-CN')
        +' ｜ 数据来源：JAY观海 跨境市场情报系统</p>';
      html+='<h2>一、报告素材池（'+pool.length+' 条）</h2><ul>';
      if(pool.length){pool.forEach(function(it){html+='<li>'+(it.title||it.name||it.q||JSON.stringify(it).slice(0,60))+'</li>';});}
      else{html+='<li>暂无素材，可在各页面点击「加入报告素材」收集。</li>';}
      html+='</ul>';
      html+='<h2>二、已生成报告（'+reps.length+' 份）</h2><ul>';
      if(reps.length){reps.forEach(function(r){html+='<li>'+(r.name||r.title||'未命名报告')+' — '+(r.time||'')+'</li>';});}
      else{html+='<li>暂无已生成报告。</li>';}
      html+='</ul><p class="meta">本报告由 JAY观海 演示环境导出，数据仅供决策参考。</p></body></html>';
      var blob=new Blob([html],{type:'text/html;charset=utf-8'});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='JAY观海_报告_'+new Date().toISOString().slice(0,10)+'.html';a.click();
      if(typeof toast==='function')toast('报告已导出（HTML）');
    }catch(e){ if(typeof toast==='function')toast('导出失败：'+e.message); }
  };
  window.jayExportPolicy=function(){
    try{
      var rows=['政策类型,地区,标题,生效时间,影响范围,平台,摘要'];
      var data=(typeof policiesData!=='undefined'&&policiesData)?policiesData:[];
      data.slice(0,200).forEach(function(p){
        rows.push([p[0],p[1],p[2],p[3],p[4],p[5],(p[8]||'').replace(/,/g,'，').slice(0,120)].join(','));
      });
      var csv='﻿'+rows.join('\n');
      var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='JAY观海_政策动态_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
      if(typeof toast==='function')toast('政策动态已导出（CSV）');
    }catch(e){ if(typeof toast==='function')toast('导出失败：'+e.message); }
  };

  // ================= F-01 路由：hashchange + 初始化 =================
  function jayRouteFromHash(){ var h=location.hash.replace('#',''); if(h&&document.getElementById(h)){ switchPage(h,{fromHash:true}); } }
  window.addEventListener('hashchange', jayRouteFromHash);

  // 包装 switchPage：路由后自动术语化 + 规则数闭环
  var _switchPage=switchPage;
  switchPage=function(name,opts){ _switchPage(name,opts); try{jayGlossifyActive();jayFixRuleCount();}catch(e){} };

  // ================= N-01 回到顶部 =================
  var totop=document.getElementById('jay-totop');
  if(totop){ window.addEventListener('scroll',function(){ totop.style.display=window.scrollY>400?'flex':'none'; }); totop.onclick=function(){window.scrollTo({top:0,behavior:'smooth'});}; }

  // ================= N-19 全局搜索：回车 -> AI 跨页分析 =================
  var gs=document.getElementById('global-search');
  if(gs){ gs.addEventListener('keydown',function(e){ if(e.key==='Enter'){ var hi=document.getElementById('ov-hero-input'); if(hi){hi.value=gs.value; var hs=document.getElementById('ov-hero-send'); if(hs)hs.click(); switchPage('overview');} } }); }

  // ================= 启动 =================
  function jayBoot(){
    jaySyncPlatformCount();
    jayNormalizeProducts();
    jaySyncUser();
    updateNavBadges();
    jayGlossifyActive();
    jayFixRuleCount();
    if(!location.hash){ try{history.replaceState(null,'','#overview');}catch(e){} }
    else { jayRouteFromHash(); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',jayBoot); else jayBoot();
})();
