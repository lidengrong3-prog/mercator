// jsdom verification of third-round fixes (v2)
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('D:/AI工具/mercator-main/web/index.html','utf8');
const errs=[];
const dom = new JSDOM(html,{ runScripts:'dangerously', resources:'usable', pretendToBeVisual:true, url:'http://localhost/' });
const { window } = dom;
window.addEventListener('error', e=> errs.push(String(e.error||e.message)));
const W=process.stdout.write.bind(process.stdout);
console.error=()=>{};

setTimeout(()=>{
  const $ = s => window.document.querySelector(s);
  const out=[];
  const ok=(k,v)=>out.push((v?'PASS':'FAIL')+' '+k);

  // R3-01 data-level conversion
  let P=[]; try{ P=window.products||[]; }catch(e){}
  let ph=''; try{ ph=P[1]?P[1][7]:''; }catch(e){}
  ok('R3-01 Poolhacker p[7]=252-288 (got '+ph+')', ph==='252-288');
  let allConv=true; P.forEach(function(p,i){ if(p&&typeof p[6]==='string'&&p[6].indexOf('$')===0&&p[6].indexOf('RMB')<0){ if(!/^\d+-\d+$/.test(p[7])||p[7]===p[6].replace('$','')) allConv=false; }});
  ok('R3-01 所有$商品p[7]已换算', allConv && P.length>0);

  // R3-01 render-level
  try{ if(window.switchPage) window.switchPage('products'); }catch(e){}
  try{ var btn=$('#pr-apply-filter'); if(btn) btn.click(); }catch(e){}
  let tbl=''; try{ tbl=$('#pr-table-body')?$('#pr-table-body').innerHTML:''; }catch(e){}
  ok('R3-01 表格含¥252-288 (tbl len='+tbl.length+')', tbl.indexOf('252-288')>=0);
  ok('R3-01 表格无¥35-40残留', tbl.indexOf('¥35-40')<0);

  // R3-02 retail
  let og=''; try{ if(window.renderOvCountries) window.renderOvCountries('全部','全部'); }catch(e){}
  try{ og=$('#ov-country-grid')?$('#ov-country-grid').innerHTML:''; }catch(e){}
  ok('R3-02 美国=1.10T', og.indexOf('US$ 1.10T')>=0);
  ok('R3-02 无12.00T', og.indexOf('US$ 12.00T')<0);

  // R3-04 GDP/CPI
  let ca={}; try{ ca=window.getMacroForCountry?window.getMacroForCountry('加拿大'):{gdp:'—'}; }catch(e){}
  ok('R3-04 加拿大GDP='+ca.gdp, ca.gdp && ca.gdp!=='—');
  let it={}; try{ it=window.getMacroForCountry?window.getMacroForCountry('意大利'):{cpi:'—'}; }catch(e){}
  ok('R3-04 意大利CPI='+it.cpi, it.cpi && it.cpi!=='—');

  // NEW-R3-01
  let prc=''; try{ prc=$('#nav-pr-count')?$('#nav-pr-count').textContent:''; }catch(e){}
  ok('NEW-R3-01 nav-pr-count='+prc+' (products='+P.length+')', prc===String(P.length));
  let pc=''; try{ pc=$('#pr-count')?$('#pr-count').textContent:''; }catch(e){}
  ok('NEW-R3-01 pr-count含/总数 ('+pc+')', pc.indexOf('/ '+P.length)>=0);

  // NEW-R3-09
  let rlc=''; try{ rlc=$('#nav-rl-count')?$('#nav-rl-count').textContent:''; }catch(e){}
  ok('NEW-R3-09 nav-rl-count=135 (got '+rlc+')', rlc==='135');

  // NEW-R3-05
  let ng=''; try{ let e=window.pfExtData&&window.pfExtData['Namshi']; ng=e?e.growth:''; }catch(e){}
  ok('NEW-R3-05 Namshi growth='+ng, !!ng);

  // NEW-R3-06
  let p301=''; try{ window.policyData.forEach(p=>{ if(p[0].indexOf('301')>=0) p301=p[8]; }); }catch(e){}
  ok('NEW-R3-06 301含2026年', p301.indexOf('2026年')>=0 && p301.indexOf('2025年')<0);

  // NEW-R3-04
  let sm=''; try{ let rj=window.rulesJsonData||window.defaultRulesData; if(rj&&rj.items&&rj.items[0]) sm=rj.items[0].summary; }catch(e){}
  ok('NEW-R3-04 规则摘要具体', !!sm && sm.indexOf('建议卖家关注')<0 && sm.indexOf('调整')>=0);

  // R3-03
  let idP=''; try{ let e=window.cn2CountryExt&&window.cn2CountryExt['id']; if(e){ e.policy_news.forEach(p=>{ if(p.title.indexOf('印尼语')>=0) idP=p.date; }); } }catch(e){}
  ok('R3-03 印尼标签日期='+idP, idP==='2026-01生效');

  W(out.join('\n')+'\n');
  W('JS_ERRORS: '+JSON.stringify(errs.slice(0,8))+'\n');
  process.exit(0);
}, 1800);
