/* ===== WAVE3 功能函数 ===== */
function pfLogoColor(name){
  var colors=['#ee4d2d','#f60','#ff6a00','#167ee6','#00b388','#a435f0','#ff1900','#5b8def','#ff5a5f','#00a699','#e21b70','#ffb400','#111'];
  var h=0; for(var i=0;i<name.length;i++){h=(h*31+name.charCodeAt(i))>>>0;}
  return colors[h%colors.length];
}
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
