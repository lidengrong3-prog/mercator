// 验证政策动态真实性校验系统（不 switchPage，直接检查初始化后 DOM）
const {JSDOM}=require('jsdom');
const fs=require('fs');
const html=fs.readFileSync('web/index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
const errs=[];
w.addEventListener('error',e=>{ const m=String(e.error||e.message||''); if(m.indexOf('fetch')<0&&m.indexOf('localStorage')<0&&m.indexOf('scrollTo')<0) errs.push(m); });
console.error=()=>{};

setTimeout(()=>{
  const $=s=>w.document.querySelector(s);
  const out=[];
  const log=(k,v)=>{ out.push(k+'='+(v!==undefined?v:'')); };

  // 1. 校验总览条
  let vBar=$('#pl-verify-bar');
  let vHtml=vBar?vBar.innerHTML:'';
  log('verify_bar_rendered', vHtml.length>50?1:0);
  log('verify_bar_has_title', vHtml.indexOf('政策真实性校验')>=0?1:0);
  log('verify_bar_has_pass', vHtml.indexOf('已核验')>=0?1:0);
  log('verify_bar_has_avg_cred', vHtml.indexOf('平均可信度')>=0?1:0);
  // 提取平均可信度数值
  let avgM=vHtml.match(/平均可信度 <b[^>]*>(\d+)<\/b>/);
  log('verify_bar_avg_cred_val', avgM?avgM[1]:'null');

  // 2. 政策卡片（初始化时已渲染到 #pl-list）
  let cards=w.document.querySelectorAll('.pl-card');
  log('policy_cards_count', cards.length);
  if(cards.length>0){
    let c0=cards[0].innerHTML;
    log('card_has_credibility', c0.indexOf('可信度')>=0?1:0);
    log('card_has_status', c0.indexOf('现行有效')>=0?1:0);
    log('card_has_legal_basis', c0.indexOf('⚖')>=0?1:0);
    log('card_has_effective_date', c0.indexOf('生效:')>=0?1:0);
    log('card_has_verify_badge', (c0.indexOf('已核验')>=0||c0.indexOf('项问题')>=0||c0.indexOf('待核')>=0)?1:0);
    log('card_has_source_count', c0.indexOf('源</span>')>=0?1:0);
    // 提取第一张卡片可信度
    let cm=c0.match(/可信度 (\d+)/);
    log('card0_cred_score', cm?cm[1]:'null');
    // 统计有来源链接的卡片数
    let withLink=0; cards.forEach(c=>{ if(c.innerHTML.indexOf('href=')>=0) withLink++; });
    log('cards_with_source_link', withLink);
    // 统计有法律依据标签的卡片数
    let withLb=0; cards.forEach(c=>{ if(c.innerHTML.indexOf('⚖')>=0) withLb++; });
    log('cards_with_legal_basis', withLb);
  }

  // 3. jayVerifyPolicies 函数存在且可调用
  log('jayVerifyPolicies_exists', typeof w.jayVerifyPolicies==='function'?1:0);

  log('JS_ERRORS', JSON.stringify(errs.slice(0,5)));

  out.forEach(l=>process.stdout.write(l+'\n'));
  process.exit(0);
},3000);
