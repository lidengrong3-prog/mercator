// === Product Radar Rebuild JS ===
var prTabConfig={burst:{title:'跨平台爆发爆款',filter:function(p){return p[10]==='爆发'||p[10]==='上升'}},potential:{title:'蓝海潜力新品',filter:function(p){return parseInt(p[12])<=90&&p[10]!=='下滑'}},competitor:{title:'竞品店铺商品库',filter:function(){return true}},content:{title:'内容种草单品',filter:function(p){return p[10]==='爆发'||p[10]==='上升'}}};
var prActiveTab='burst';
var prSelectedIds=new Set();
var prDataMeta={source:'none',fileName:'',importedAt:'',accepted:0,skipped:0};

var prFieldAliases={
  name:['商品名','商品名称','产品名','产品名称','product','product_name','productname','name','title'],
  market:['国家/市场','国家','市场','地区','country','market','region'],
  platform:['电商平台','平台','platform','channel'],
  category:['商品类目','类目','分类','category','main_category'],
  subcategory:['三级类目','子类目','细分类目','subcategory','third_category'],
  price:['售价','价格','售价区间','price','local_price'],
  rmbPrice:['人民币售价','人民币价格','rmb售价','rmb_price','price_rmb'],
  sales:['销量','累计销量','销售量','sales','units_sold','sold'],
  growth:['增速','增长率','增长','growth','growth_rate'],
  signal:['信号','信号标签','signal'],
  shop:['店铺','店铺名','竞品店铺','shop','shop_name','store','store_name'],
  age:['上架天数','上架周期','在售天数','age_days','days_listed'],
  updated:['更新时间','更新时间说明','更新时间/采集时间','updated_at','updated','update_time'],
  icon:['图标','icon','emoji'],
  trend:['30天销量趋势','销量趋势','sales_trend','trend'],
  samePlatforms:['同款平台数','平台数量','same_platforms','platform_count'],
  links:['同款链接数','链接数量','same_links','link_count'],
  compliance:['合规风险','合规提示','compliance','risk']
};

function prNormalizeKey(value){return String(value===undefined||value===null?'':value).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s_\-\/\\（）()：:]+/g,'');}
function prRawValue(row,aliases){
  if(!row||typeof row!=='object')return '';
  var keys=Object.keys(row), wanted=aliases.map(prNormalizeKey);
  for(var i=0;i<keys.length;i++){if(wanted.indexOf(prNormalizeKey(keys[i]))>=0){var v=row[keys[i]];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;}}
  return '';
}
function prText(value){return value===0?'0':(value===undefined||value===null||String(value).trim()===''?'':String(value).trim());}
function prDisplay(value){var v=prText(value);return v||'未提供';}
function prNormalizeMarket(value){
  var raw=prText(value), lower=raw.toLowerCase();
  if(!raw)return '';
  if(lower==='us'||lower==='usa'||lower==='united states'||lower==='unitedstates'||raw.indexOf('美国')>=0||raw.indexOf('美区')>=0)return '美国';
  return raw;
}
function prNormalizePlatform(value){
  var api=window.JAY_MARKET_SCOPE_API;
  return api&&typeof api.normalizePlatform==='function'?api.normalizePlatform(value):prText(value);
}
function prAllowedMarket(value){return value==='美国';}
function prAllowedPlatform(value){
  if(!value)return false;
  var scope=window.JAY_MARKET_SCOPE;
  return !!(scope&&scope.platformNames&&scope.platformNames.indexOf(value)>=0);
}
function prArrayProvided(row){
  return {name:prText(row[1])!=='',market:prText(row[2])!=='',platform:prText(row[3])!=='',category:prText(row[4])!=='',subcategory:prText(row[5])!=='',price:prText(row[6])!=='',rmbPrice:prText(row[7])!=='',sales:prText(row[8])!=='',growth:prText(row[9])!=='',signal:prText(row[10])!=='',shop:prText(row[11])!=='',age:prText(row[12])!=='',updated:prText(row[13])!==''};
}
function prNormalizeProduct(raw){
  if(Array.isArray(raw)){
    var arr=raw.slice(0,14);while(arr.length<14)arr.push('');
    arr[2]=prNormalizeMarket(arr[2]);arr[3]=prNormalizePlatform(arr[3]);
    if(!prText(arr[1]))return null;
    arr._provided=prArrayProvided(arr);arr._source='用户导入文件';
    return {row:arr,valid:prAllowedMarket(arr[2])&&prAllowedPlatform(arr[3])};
  }
  if(!raw||typeof raw!=='object')return null;
  var name=prText(prRawValue(raw,prFieldAliases.name));if(!name)return null;
  var market=prNormalizeMarket(prRawValue(raw,prFieldAliases.market));
  var platform=prNormalizePlatform(prRawValue(raw,prFieldAliases.platform));
  var row=[
    prText(prRawValue(raw,prFieldAliases.icon))||'📦',name,market,platform,
    prText(prRawValue(raw,prFieldAliases.category)),prText(prRawValue(raw,prFieldAliases.subcategory)),
    prText(prRawValue(raw,prFieldAliases.price)),prText(prRawValue(raw,prFieldAliases.rmbPrice)),
    prText(prRawValue(raw,prFieldAliases.sales)),prText(prRawValue(raw,prFieldAliases.growth)),
    prText(prRawValue(raw,prFieldAliases.signal)),prText(prRawValue(raw,prFieldAliases.shop)),
    prText(prRawValue(raw,prFieldAliases.age)),prText(prRawValue(raw,prFieldAliases.updated))
  ];
  row._provided={};Object.keys(prFieldAliases).forEach(function(key){if(['trend','samePlatforms','links','compliance','icon','rmbPrice'].indexOf(key)<0)row._provided[key]=prText(prRawValue(raw,prFieldAliases[key]))!=='';});
  row._trend=prRawValue(raw,prFieldAliases.trend);row._samePlatforms=prRawValue(raw,prFieldAliases.samePlatforms);row._links=prRawValue(raw,prFieldAliases.links);row._compliance=prRawValue(raw,prFieldAliases.compliance);row._source='用户导入文件';
  return {row:row,valid:prAllowedMarket(market)&&prAllowedPlatform(platform)};
}
function prParseCSV(text){
  var rows=[],row=[],cell='',quoted=false,src=String(text||'').replace(/^\uFEFF/,'');
  for(var i=0;i<src.length;i++){
    var ch=src[i];
    if(ch==='"'){if(quoted&&src[i+1]==='"'){cell+='"';i++;}else{quoted=!quoted;}}
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(function(v){return String(v).trim()!==''}))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(cell!==''||row.length){row.push(cell);if(row.some(function(v){return String(v).trim()!==''}))rows.push(row);}
  if(rows.length<2)return [];
  var headers=rows.shift().map(function(h){return String(h).replace(/^\uFEFF/,'').trim();});
  return rows.map(function(values){var out={};headers.forEach(function(h,j){if(h)out[h]=values[j]===undefined?'':values[j];});return out;});
}
function prParseImportPayload(text,fileName){
  var lower=String(fileName||'').toLowerCase(),payload;
  if(lower.slice(-5)==='.json'){payload=JSON.parse(text);} else {payload=prParseCSV(text);}
  if(payload&&Array.isArray(payload))return {products:payload,shops:[]};
  if(payload&&typeof payload==='object')return {products:Array.isArray(payload.products)?payload.products:(Array.isArray(payload.items)?payload.items:(Array.isArray(payload.data)?payload.data:[])),shops:Array.isArray(payload.shops)?payload.shops:[]};
  return {products:[],shops:[]};
}
function prParseTrend(value){
  if(Array.isArray(value))return value.filter(function(v){return v!==''&&v!==null&&v!==undefined;});
  if(typeof value==='string'&&value.trim())return value.split(/[|,;\s]+/).filter(Boolean);
  return [];
}
function prSetDataStatus(message,kind){
  var el=document.getElementById('pr-data-status');if(el){el.textContent=message;el.className='pr-data-status '+(kind||'');}
  var count=document.getElementById('pr-count');if(count&&!products.length){count.textContent='○ 暂无已导入数据';count.className='source-warn';}
}
function prNormalizeShop(raw){
  if(Array.isArray(raw)){
    var arr=raw.slice(0,13);while(arr.length<13)arr.push('');
    arr[1]=prNormalizePlatform(arr[1]);arr[2]=prNormalizeMarket(arr[2]);
    if(!prText(arr[0]))return null;
    arr._source='用户导入文件';
    return {row:arr,valid:prAllowedMarket(arr[2])&&prAllowedPlatform(arr[1])};
  }
  if(!raw||typeof raw!=='object')return null;
  var name=prText(prRawValue(raw,['店铺名','店铺名称','shop_name','shop','store','store_name','name']));if(!name)return null;
  var market=prNormalizeMarket(prRawValue(raw,['国家/市场','国家','市场','地区','country','market','region']));
  var platform=prNormalizePlatform(prRawValue(raw,['电商平台','平台','platform','channel']));
  var row=[name,platform,market,prText(prRawValue(raw,['月GMV','gmv','monthly_gmv'])),prText(prRawValue(raw,['增速','growth','growth_rate'])),prText(prRawValue(raw,['状态','status'])),prText(prRawValue(raw,['主营类目','类目','category'])),prText(prRawValue(raw,['在售商品','商品数','products','sku_count'])),prText(prRawValue(raw,['30天波动','波动','wave'])),prText(prRawValue(raw,['标签','tags'])),prText(prRawValue(raw,['粉丝数','粉丝','followers'])),prText(prRawValue(raw,['评分','rating'])),prText(prRawValue(raw,['更新时间','updated_at','updated']))];
  row._source='用户导入文件';
  return {row:row,valid:prAllowedMarket(market)&&prAllowedPlatform(platform)};
}
function prPersistImportedData(){
  try{
    var payload={meta:prDataMeta,products:products.map(function(p){return {row:Array.prototype.slice.call(p),trend:p._trend,samePlatforms:p._samePlatforms,links:p._links,compliance:p._compliance};}),shops:shops.map(function(s){return Array.prototype.slice.call(s);})};
    localStorage.setItem('jay_product_catalog_import_v1',JSON.stringify(payload));
  }catch(e){}
}
function prRestoreImportedData(){
  try{
    var raw=localStorage.getItem('jay_product_catalog_import_v1');if(!raw)return false;
    var payload=JSON.parse(raw);if(!payload||!Array.isArray(payload.products))return false;
    products.splice(0,products.length);shops.splice(0,shops.length);
    payload.products.forEach(function(item){var n=prNormalizeProduct(item&&item.row?item.row:item);if(n&&n.valid){if(item&&item.trend!==undefined)n.row._trend=item.trend;if(item&&item.samePlatforms!==undefined)n.row._samePlatforms=item.samePlatforms;if(item&&item.links!==undefined)n.row._links=item.links;if(item&&item.compliance!==undefined)n.row._compliance=item.compliance;products.push(n.row);}});
    (payload.shops||[]).forEach(function(item){var n=prNormalizeShop(item);if(n&&n.valid)shops.push(n.row);});
    prDataMeta=payload.meta||{source:'localStorage',fileName:'',importedAt:'',accepted:products.length,skipped:0};
    return products.length>0||shops.length>0;
  }catch(e){return false;}
}
function prImportPayload(payload,fileName){
  var acceptedProducts=[],acceptedShops=[],skipped=0;
  (payload.products||[]).forEach(function(raw){
    var n=prNormalizeProduct(raw);
    if(n){if(n.valid)acceptedProducts.push(n.row);else skipped++;return;}
    var shop=prNormalizeShop(raw);
    if(shop&&shop.valid)acceptedShops.push(shop.row);else skipped++;
  });
  (payload.shops||[]).forEach(function(raw){var n=prNormalizeShop(raw);if(!n){skipped++;return;}if(n.valid)acceptedShops.push(n.row);else skipped++;});
  products.splice(0,products.length);products.push.apply(products,acceptedProducts);
  shops.splice(0,shops.length);shops.push.apply(shops,acceptedShops);
  prDataMeta={source:'user-file',fileName:fileName||'',importedAt:new Date().toISOString(),accepted:acceptedProducts.length+acceptedShops.length,skipped:skipped};
  prPersistImportedData();
  prInitFilters();
  if(typeof renderOverviewMetrics==='function')renderOverviewMetrics();
  if(typeof renderOvDataTable==='function')renderOvDataTable();
  if(typeof shInitFilters==='function')shInitFilters();
  prRenderAI();
  prSwitchTab(prActiveTab);
  if(typeof shRenderAI==='function')shRenderAI();
  if(typeof shRenderGroups==='function')shRenderGroups();
  if(typeof shApplyFilters==='function')shApplyFilters();
  var detail=(acceptedProducts.length?'已导入 '+acceptedProducts.length+' 条商品':'暂无商品记录')+(acceptedShops.length?'、'+acceptedShops.length+' 家店铺':'');
  if(skipped)detail+='；跳过 '+skipped+' 行（不完整或超出美国市场/4 个平台范围）';
  prSetDataStatus(detail+' · '+(fileName||'用户文件'),'ok');
  var clear=document.getElementById('pr-clear-data');if(clear)clear.disabled=!(products.length||shops.length);
  var note=document.getElementById('pr-data-import-note');if(note)note.textContent=skipped?'已按当前工作区范围校验，未导入的行不会参与分析。':'仅使用文件中提供的字段参与筛选、统计和详情展示。';
  toast(detail);
}
function prHandleFile(file){
  if(!file)return;
  var reader=new FileReader();
  reader.onload=function(){try{prImportPayload(prParseImportPayload(reader.result,file.name),file.name);}catch(e){prSetDataStatus('文件解析失败：请检查 CSV/JSON 格式','error');toast('文件解析失败，请检查格式');}};
  reader.onerror=function(){prSetDataStatus('文件读取失败','error');toast('文件读取失败');};
  reader.readAsText(file,'UTF-8');
}
function prClearImportedData(){
  products.splice(0,products.length);shops.splice(0,shops.length);prSelectedIds.clear();
  prDataMeta={source:'none',fileName:'',importedAt:'',accepted:0,skipped:0};
  try{localStorage.removeItem('jay_product_catalog_import_v1');}catch(e){}
  prInitFilters();prRenderAI();prSwitchTab(prActiveTab);prSetDataStatus('暂无已导入的类目数据','');
  if(typeof renderOverviewMetrics==='function')renderOverviewMetrics();
  if(typeof renderOvDataTable==='function')renderOvDataTable();
  var clear=document.getElementById('pr-clear-data');if(clear)clear.disabled=true;
  var note=document.getElementById('pr-data-import-note');if(note)note.textContent='支持商品字段：商品名、国家/市场、平台、类目、三级类目、售价、销量、增速、信号、店铺、上架天数、更新时间。超出当前美国市场或 4 个平台范围的行会被跳过。';
  if(typeof shInitFilters==='function')shInitFilters();if(typeof shRenderAI==='function')shRenderAI();if(typeof shApplyFilters==='function')shApplyFilters();
  toast('已清空导入数据');
}

function prParseNum(s){if(!s)return 0;return parseInt(String(s).replace(/[^0-9]/g,''))||0}
function prAvgPrice(range){if(!range)return 0;var parts=String(range).split('-');var sum=0;for(var i=0;i<parts.length;i++)sum+=prParseNum(parts[i]);return sum/parts.length}

function prInitFilters(){
  var regions=[],platforms=[],categories=[],shopNames=[];
  products.forEach(function(p){
    if(prText(p[2])&&regions.indexOf(p[2])<0)regions.push(p[2]);
    if(prText(p[3])&&platforms.indexOf(p[3])<0)platforms.push(p[3]);
    if(prText(p[4])&&categories.indexOf(p[4])<0)categories.push(p[4]);
    if(prText(p[11])&&shopNames.indexOf(p[11])<0)shopNames.push(p[11]);
  });
  regions.sort();platforms.sort();categories.sort();shopNames.sort();
  var fill=function(id,items,label){var el=$('#'+id);el.innerHTML='<option value="all">'+label+'</option>'+items.map(function(i){return '<option value="'+i+'">'+i+'</option>'}).join('')};
  fill('pr-f-country',regions,'全部国家');
  fill('pr-f-platform',platforms,'全部平台');
  fill('pr-f-category',categories,'全部类目');
  $('#pr-shop-select').innerHTML='<option value="">-- 请选择已监控店铺 --</option>'+shopNames.map(function(s){return '<option value="'+s+'">'+s+'</option>'}).join('');
}

function prApplyFilters(){
  var country=$('#pr-f-country').value,platform=$('#pr-f-platform').value,category=$('#pr-f-category').value;
  var signal=$('#pr-f-signal').value,age=$('#pr-f-age').value,keyword=$('#pr-f-keyword').value.toLowerCase();
  var sortVal=$('#pr-f-sort').value,pMin=prParseNum($('#pr-f-price-min').value),pMax=prParseNum($('#pr-f-price-max').value);
  var tabCfg=prTabConfig[prActiveTab];
  var list=products.filter(tabCfg.filter);
  if(country!=='all')list=list.filter(function(p){return p[2]===country});
  if(platform!=='all')list=list.filter(function(p){return p[3]===platform});
  if(category!=='all')list=list.filter(function(p){return p[4]===category});
  if(signal!=='all')list=list.filter(function(p){return p[10]===signal});
  if(keyword)list=list.filter(function(p){return [p[1],p[4],p[5],p[11]].some(function(v){return prText(v).toLowerCase().indexOf(keyword)>=0;});});
  if(pMin>0)list=list.filter(function(p){return prAvgPrice(p[7])>=pMin});
  if(pMax>0)list=list.filter(function(p){return prAvgPrice(p[7])<=pMax});
  if(age==='new')list=list.filter(function(p){return parseInt(p[12])<=30});
  else if(age==='mature')list=list.filter(function(p){var d=parseInt(p[12]);return d>30&&d<=180});
  else if(age==='decline')list=list.filter(function(p){return parseInt(p[12])>180});
  if(sortVal==='growth-desc')list.sort(function(a,b){return prParseNum(b[9])-prParseNum(a[9])});
  else if(sortVal==='sales-desc')list.sort(function(a,b){return prParseNum(b[8])-prParseNum(a[8])});
  else if(sortVal==='price-asc')list.sort(function(a,b){return prAvgPrice(a[7])-prAvgPrice(b[7])});
  else if(sortVal==='price-desc')list.sort(function(a,b){return prAvgPrice(b[7])-prAvgPrice(a[7])});
  else if(sortVal==='newest')list.sort(function(a,b){return parseInt(a[12])-parseInt(b[12])});
  prRenderTable(list);
  toast('已显示 '+list.length+' 条数据');
}

function prSignalClass(s){return s==='爆发'?'burst':s==='上升'?'rise':s==='关注'?'stable':'decline'}

function prRenderTable(list){
  var tbody=$('#pr-table-body');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="12"><div class="pr-empty-note">'+(products.length?'暂无符合当前筛选条件的数据':'暂无已导入的类目数据，请先上传 CSV 或 JSON 文件')+'</div></td></tr>';
    $('#pr-count').textContent=products.length?'○ 0 条筛选结果':'○ 暂无已导入数据';
    $('#pr-count').className='source-warn';
    prUpdateBatchBar();
    return;
  }
  tbody.innerHTML=list.map(function(p,i){
    var idx=products.indexOf(p);
    var checked=prSelectedIds.has(idx)?'checked':'';
    var sc=prSignalClass(p[10]);
    var age=parseInt(p[12]);
    var ageLabel=isNaN(age)?'未提供':age<=30?'新品':age<=180?'成熟':'衰退';
    var ageColor=isNaN(age)?'var(--muted)':age<=30?'#4d8a68':age<=180?'#ca8a04':'#e53935';
    var tagClass=p[10]==='爆发'?'hot':'watch';
    var nameEsc=escapeHtml(prDisplay(p[1])).replace(/"/g,'&quot;');
    return '<tr>'+
      '<td><input type="checkbox" class="pr-chk" data-idx="'+idx+'" '+checked+'></td>'+
      '<td>'+(i+1)+'</td>'+
      '<td><div class="product-cell"><span class="product-thumb">'+escapeHtml(prDisplay(p[0]))+'</span><strong class="pr-prod-link" data-idx="'+idx+'" style="cursor:pointer" title="'+nameEsc+'">'+escapeHtml(prDisplay(p[1]))+'</strong></div></td>'+
      '<td>'+escapeHtml(prDisplay(p[2]))+' · '+escapeHtml(prDisplay(p[3]))+'</td>'+
      '<td><div class="pr-dual-price"><span class="pr-local">'+escapeHtml(prDisplay(p[6]))+'</span><br><span class="pr-rmb">'+(prText(p[7])?'≈ ¥'+escapeHtml(p[7])+' RMB':'未提供人民币价格')+'</span></div></td>'+
      '<td><span style="font-size:11px;color:var(--muted)">'+escapeHtml(prDisplay(p[5]))+'</span></td>'+
      '<td><span class="pr-shop-link" data-shop="'+escapeHtml(prText(p[11]))+'">'+escapeHtml(prDisplay(p[11]))+'</span></td>'+
      '<td>'+escapeHtml(prDisplay(p[8]))+'</td>'+
      '<td class="growth">'+escapeHtml(prDisplay(p[9]))+'</td>'+
      '<td><span class="pr-signal"><span class="pr-signal-dot '+sc+'"></span><span class="tag '+tagClass+'">'+escapeHtml(prDisplay(p[10]))+'</span></span></td>'+
      '<td><span class="pr-time-col">'+(isNaN(age)?'未提供':escapeHtml(String(age))+'天')+'<br><small style="color:'+ageColor+'">'+ageLabel+'</small></span></td>'+
      '<td><span class="pr-time-col">'+escapeHtml(prDisplay(p[13]))+'</span></td>'+
      '</tr>';
  }).join('');
  $('#pr-count').textContent='● '+list.length+' / '+products.length+' 条已导入数据';
  $('#pr-count').className='source-ok';
  prUpdateBatchBar();
}

function prUpdateBatchBar(){
  var bar=$('#pr-batch-bar');
  if(prSelectedIds.size>0){bar.classList.add('show');$('#pr-batch-count').textContent=prSelectedIds.size}
  else{bar.classList.remove('show')}
}

function prSwitchTab(tab){
  prActiveTab=tab;
  $$('.pr-tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===tab)});
  var cfg=prTabConfig[tab];
  $('#pr-table-title').textContent=cfg.title;
  $('#pr-shop-selector').style.display=tab==='competitor'?'flex':'none';
  $('#pr-shop-stats').style.display=tab==='competitor'?'grid':'none';
  prApplyFilters();
}

function prShowDetail(idx){
  var p=products[idx];
  if(!p)return;
  var age=parseInt(p[12]);
  var trend=prParseTrend(p._trend);
  var trendHtml=trend.length?'<div class="pr-m-chart">'+trend.map(function(v){var n=Number(v);return '<i style="height:'+Math.max(8,Math.min(90,isNaN(n)?8:n))+'%;background:var(--green)"></i>';}).join('')+'</div>':'<p class="pr-empty-note">未提供 30 天销量趋势字段</p>';
  var sameCount=prDisplay(p._samePlatforms),linkCount=prDisplay(p._links);
  var compliance=prText(p._compliance)?'<span class="pr-m-tag">'+escapeHtml(prText(p._compliance))+'</span>':'<span class="pr-m-tag">未提供合规字段</span>';
  var summaryStr='售价'+prDisplay(p[6])+',销量'+prDisplay(p[8])+',增速'+prDisplay(p[9]);

  $('#pr-modal-content').innerHTML=
    '<h3>'+escapeHtml(prDisplay(p[0]))+' '+escapeHtml(prDisplay(p[1]))+'</h3>'+
    '<div class="pr-m-sub">'+escapeHtml(prDisplay(p[2]))+' · '+escapeHtml(prDisplay(p[3]))+' · '+escapeHtml(prDisplay(p[5]))+' · 更新时间: '+escapeHtml(prDisplay(p[13]))+'</div>'+
    '<div class="pr-m-stats">'+
      '<div class="pr-m-stat"><b>'+escapeHtml(prDisplay(p[8]))+'</b><span>累计销量</span></div>'+
      '<div class="pr-m-stat"><b style="color:#3a6ea8">'+escapeHtml(prDisplay(p[9]))+'</b><span>增速</span></div>'+
      '<div class="pr-m-stat"><b>'+escapeHtml(prDisplay(p[6]))+'</b><span>售价区间</span></div>'+
      '<div class="pr-m-stat"><b>'+(isNaN(age)?'未提供':escapeHtml(String(age))+'天')+'</b><span>上架周期</span></div>'+
    '</div>'+
    '<div class="pr-m-section"><h4>📈 30天销量趋势</h4>'+trendHtml+'</div>'+
    '<div class="pr-m-section"><h4>🏪 竞品店铺</h4><p>店铺: <strong>'+escapeHtml(prDisplay(p[11]))+'</strong> · <span style="color:var(--green);cursor:pointer;text-decoration:underline" id="pr-detail-shop">查看店铺详情 ↗</span></p></div>'+
    '<div class="pr-m-section"><h4>🌐 全网同款分布</h4><p>平台数量: <strong>'+escapeHtml(sameCount)+'</strong> · 链接数量: <strong>'+escapeHtml(linkCount)+'</strong></p></div>'+
    '<div class="pr-m-section"><h4>⚠️ 合规风险提示</h4><div class="pr-m-tags">'+compliance+'</div></div>'+
    '<div style="margin-top:16px;display:flex;gap:8px">'+
      '<button class="filter-button" style="padding:8px 18px" id="pr-detail-add">✦ 加入报告素材</button>'+
      '<button style="background:none;border:1px solid var(--line);padding:8px 18px;border-radius:4px;font:12px Noto Sans SC;cursor:pointer" id="pr-detail-country">🌍 查看对应国家市场</button>'+
    '</div>';

  $('#pr-modal').classList.add('open');
  $('#pr-detail-shop').onclick=function(){switchPage('shops');toast('已跳转到店铺追踪')};
  $('#pr-detail-add').onclick=function(){rpAddMaterial('product',p[1],p[2]+' '+p[3],summaryStr);toast('已加入报告素材')};
  $('#pr-detail-country').onclick=function(){switchPage('countries');toast('已跳转到国家市场')};
}

// AI Insights dual-tab
var prAiShort=[];
var prAiLong=[];
var prAiTab='short';

function prRenderAI(){
  var items=prBuildAIItems(prAiTab);
  var tabLabel=prAiTab==='short'?'短期机会洞察（7日）':'长期赛道分析（3月）';
  var subLabel=prAiTab==='short'?'即时机会':'赛道规划';
  var poolType=prAiTab==='short'?'短期机会':'长期赛道';
  var html='<div class="ai-insight" style="padding:16px 18px;background:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:16px">'+
    '<div class="ai-insight-head"><span class="ai-icon">✨</span><h4>AI '+tabLabel+'</h4><small>仅基于用户导入文件中的字段</small></div>';
  items.forEach(function(item,idx){
    html+='<div class="pr-ai-item"><span class="pr-ai-text">'+escapeHtml(item.text)+'</span>';
    if(item.link)html+='<button class="pr-ai-jump" data-link="'+encodeURIComponent(item.link)+'">溯源 ↗</button>';
    if(item.addable)html+='<button class="pr-ai-add" data-idx="'+idx+'" data-pooltype="'+encodeURIComponent(poolType)+'" data-text="'+encodeURIComponent(item.text.substring(0,60))+'">✦</button>';
    html+='</div>';
  });
  html+='</div>';
  $('#pr-ai-content').innerHTML=html;

  // Add event listeners
  $('#pr-ai-content').querySelectorAll('.pr-ai-jump').forEach(function(btn){
    btn.onclick=function(){jayTraceLink(decodeURIComponent(this.dataset.link))};
  });
  $('#pr-ai-content').querySelectorAll('.pr-ai-add').forEach(function(btn){
    btn.onclick=function(e){
      e.stopPropagation();
      rpAddMaterial('alert','AI洞察',decodeURIComponent(this.dataset.pooltype),decodeURIComponent(this.dataset.text)+'...');
    };
  });
}

function prBuildAIItems(tab){
  if(!products.length)return [{text:'暂无已导入的类目数据，上传 CSV 或 JSON 后才会生成机会判断。',addable:false}];
  var items=[],counts={};
  products.forEach(function(p){var c=prText(p[4])||'未提供类目';counts[c]=(counts[c]||0)+1;});
  var categories=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});
  if(tab==='short'){
    items.push({text:'当前文件共 '+products.length+' 条商品记录，覆盖 '+categories.length+' 个类目。',addable:false});
    if(categories[0])items.push({text:'文件中记录最多的类目是“'+categories[0]+'”（'+counts[categories[0]]+' 条），仅代表导入文件的样本分布，不等同于市场机会。',addable:false});
    var growth=products.filter(function(p){return prText(p[9])!=='';});
    items.push({text:growth.length?'文件提供了 '+growth.length+' 条增速字段，可在筛选器中按增速排序；系统不补算缺失增速。':'文件未提供增速字段，无法生成增长判断。',addable:false});
  }else{
    var markets={},platforms={};products.forEach(function(p){if(prText(p[2]))markets[p[2]]=1;if(prText(p[3]))platforms[p[3]]=1;});
    items.push({text:'长期视图仅汇总当前文件：'+Object.keys(markets).length+' 个市场、'+Object.keys(platforms).length+' 个平台、'+products.length+' 条商品记录。',addable:false});
    items.push({text:'未提供时间序列、成本或利润字段，系统不会推断市场容量、GMV、复合增长率或长期推荐。',addable:false});
  }
  return items;
}

// Filter templates
function prGetTemplates(){return jayGetWorkspaceAsset('product_filter_templates',[])}
function prSaveTemplates(t){return jaySaveWorkspaceAsset('product_filter_templates',t)}
function prRenderTemplates(){
  var tpls=prGetTemplates();
  $('#pr-tpl-list').innerHTML=tpls.map(function(t,i){return '<span class="pr-tpl-chip" data-idx="'+i+'">'+t.name+' <span class="tpl-del" data-idx="'+i+'">✕</span></span>'}).join('');
}
async function prSaveCurrentAsTpl(){
  if(!jayCanUseUserDb()){toast('只读演示不保存模板，请登录后使用');return}
  var name=prompt('输入模板名称：','');
  if(!name)return;
  var state={country:$('#pr-f-country').value,platform:$('#pr-f-platform').value,category:$('#pr-f-category').value,signal:$('#pr-f-signal').value,age:$('#pr-f-age').value,priceMin:$('#pr-f-price-min').value,priceMax:$('#pr-f-price-max').value,keyword:$('#pr-f-keyword').value,sort:$('#pr-f-sort').value};
  var tpls=prGetTemplates();
  tpls.push({name:name,state:state});
  var ok=await prSaveTemplates(tpls);
  prRenderTemplates();
  toast(ok?('筛选模板已同步: '+name):'模板云端同步失败，已暂存等待重试');
}
function prLoadTpl(idx){
  var tpls=prGetTemplates();
  var t=tpls[idx];if(!t)return;
  var s=t.state;
  $('#pr-f-country').value=s.country||'all';$('#pr-f-platform').value=s.platform||'all';
  $('#pr-f-category').value=s.category||'all';$('#pr-f-signal').value=s.signal||'all';
  $('#pr-f-age').value=s.age||'all';$('#pr-f-price-min').value=s.priceMin||'';
  $('#pr-f-price-max').value=s.priceMax||'';$('#pr-f-keyword').value=s.keyword||'';
  $('#pr-f-sort').value=s.sort||'growth-desc';
  prApplyFilters();
  toast('已加载模板: '+t.name);
}
async function prDeleteTpl(idx){
  if(!jayCanUseUserDb()){toast('请登录后管理模板');return}
  var tpls=prGetTemplates();
  tpls.splice(idx,1);
  var ok=await prSaveTemplates(tpls);
  prRenderTemplates();
  toast(ok?'模板已删除':'删除同步失败，已暂存等待重试');
}

// Export
function jayPrintMarkdownReport(title, markdown, sourceNote){
  var printWin=window.open('','_blank');
  if(!printWin){ toast('请允许弹出窗口以导出 PDF'); return false; }
  var safeTitle=escapeHtml(title||'JAY观海报告');
  var bodyHtml=typeof renderMarkdownSafe==='function' ? renderMarkdownSafe(markdown||'') : '<pre>'+escapeHtml(markdown||'')+'</pre>';
  var safeNote=escapeHtml(sourceNote||'请在用于经营决策前复核关键数据与原始来源。');
  var html='<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>'+safeTitle+'</title><style>'+
    '@page{margin:16mm}body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#18221f;line-height:1.7;margin:0}'+
    '.brand{display:flex;align-items:center;gap:10px;border-bottom:2px solid #176b55;padding-bottom:12px;margin-bottom:20px}.mark{display:grid;place-items:center;width:34px;height:34px;border-radius:6px;background:#14201d;color:#fff;font-weight:800}.brand b{font-size:16px}.brand span:last-child{margin-left:auto;color:#66716d;font-size:10px}'+
    'h1{font-size:22px;margin:0 0 18px}h2{font-size:16px;margin:20px 0 8px;color:#176b55}h3,h4{font-size:14px;margin:15px 0 6px}p,li{font-size:12px}table{width:100%;border-collapse:collapse;font-size:11px;margin:10px 0}th,td{border:1px solid #dfe5e2;padding:6px 8px;text-align:left}th{background:#f3f5f4}.note{margin-top:24px;padding-top:10px;border-top:1px solid #dfe5e2;color:#66716d;font-size:10px}'+
    '</style></head><body><div class="brand"><span class="mark">J</span><b>JAY观海</b><span>跨境市场决策情报</span></div><h1>'+safeTitle+'</h1>'+bodyHtml+'<div class="note">'+safeNote+' 生成时间：'+escapeHtml(new Date().toLocaleString('zh-CN'))+'</div></body></html>';
  printWin.document.open(); printWin.document.write(html); printWin.document.close();
  setTimeout(function(){ try{ printWin.print(); }catch(e){} },450);
  return true;
}

function prExportExcel(){
  if(!products.length){toast('暂无已导入数据，无法导出');return;}
  var rows=['商品,国家,平台,类目,三级类目,售价,销量,增速,信号,店铺,上架天数'];
  var data=prSelectedIds.size>0?Array.from(prSelectedIds).map(function(i){return products[i]}):products;
  data.forEach(function(p){rows.push([p[1],p[2],p[3],p[4],p[5],p[6],p[8],p[9],p[10],p[11],p[12]].map(prCsvCell).join(','))});
  var csv=rows.join('\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='产品全域雷达_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  toast('Excel 已导出');
}
function prCsvCell(value){var v=prText(value);return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function prExportPDF(){
  if(!products.length){toast('暂无已导入数据，无法导出');return;}
  var data=prSelectedIds.size>0?Array.from(prSelectedIds).map(function(i){return products[i]}):products;
  var md='# 产品全域雷达 - 竞品分析报告\n\n';
  md+='> 生成时间: '+new Date().toLocaleString('zh-CN')+' | 数据来源: 用户导入文件（'+escapeHtml(prDataMeta.fileName||'未命名文件')+'）\n\n';
  md+='## 数据总览\n- 筛选结果: '+data.length+' 条商品\n';
  var regionSet=[];data.forEach(function(p){if(regionSet.indexOf(p[2])<0)regionSet.push(p[2])});
  var platSet=[];data.forEach(function(p){if(platSet.indexOf(p[3])<0)platSet.push(p[3])});
  md+='- 覆盖市场: '+regionSet.join(', ')+'\n- 覆盖平台: '+platSet.join(', ')+'\n\n';
  md+='## 商品 TOP10\n\n';
  data.slice(0,10).forEach(function(p,i){md+=(i+1)+'. **'+p[1]+'** | '+p[2]+' · '+p[3]+' | '+p[6]+' | 销量'+p[8]+' | '+p[9]+' | '+p[10]+'\n'});
  md+='\n## 赛道分布\n\n';
  var catMap={};data.forEach(function(p){catMap[p[4]]=(catMap[p[4]]||0)+1});
  Object.keys(catMap).sort(function(a,b){return catMap[b]-catMap[a]}).forEach(function(c){md+='- '+c+': '+catMap[c]+'条\n'});
  if(jayPrintMarkdownReport('产品全域雷达 - 竞品分析报告',md,'本报告仅基于用户导入文件，缺失字段未作推测。')) toast('已打开打印页，可另存为 PDF');
}

// Init
(function initProductRadar(){
  var restored=prRestoreImportedData();
  prInitFilters();
  prRenderAI();
  prRenderTemplates();
  prSwitchTab('burst');
  if(restored){
    var restoredLabel=(products.length?'已恢复 '+products.length+' 条商品':'暂无商品记录')+(shops.length?'、'+shops.length+' 家店铺':'');
    prSetDataStatus(restoredLabel+' · 本地导入文件','ok');
    var restoredClear=document.getElementById('pr-clear-data');if(restoredClear)restoredClear.disabled=false;
  }

  $$('.pr-tab').forEach(function(b){b.onclick=function(){prSwitchTab(b.dataset.tab)}});
  $$('.pr-ai-tab').forEach(function(b){b.onclick=function(){
    $$('.pr-ai-tab').forEach(function(x){x.classList.remove('active')});
    this.classList.add('active');
    prAiTab=this.dataset.aitab;
    prRenderAI();
  }});
  $('#pr-apply-filter').onclick=prApplyFilters;
  $('#pr-reset-filter').onclick=function(){
    $('#pr-f-country').value='all';$('#pr-f-platform').value='all';$('#pr-f-category').value='all';
    $('#pr-f-signal').value='all';$('#pr-f-age').value='all';$('#pr-f-price-min').value='';
    $('#pr-f-price-max').value='';$('#pr-f-keyword').value='';$('#pr-f-sort').value='growth-desc';
    prApplyFilters();
  };
  $('#pr-save-tpl-btn').onclick=prSaveCurrentAsTpl;
  $('#pr-tpl-list').onclick=function(e){
    if(e.target.classList.contains('tpl-del')){e.stopPropagation();prDeleteTpl(parseInt(e.target.dataset.idx));return}
    var chip=e.target.closest('.pr-tpl-chip');
    if(chip)prLoadTpl(parseInt(chip.dataset.idx));
  };
  $('#pr-check-all').onchange=function(){
    var checked=this.checked;
    $$('#pr-table-body .pr-chk').forEach(function(c){
      var idx=parseInt(c.dataset.idx);
      if(checked)prSelectedIds.add(idx);else prSelectedIds.delete(idx);
      c.checked=checked;
    });
    prUpdateBatchBar();
  };
  $('#pr-table-body').onclick=function(e){
    if(e.target.classList.contains('pr-chk')){
      var idx=parseInt(e.target.dataset.idx);
      if(e.target.checked)prSelectedIds.add(idx);else prSelectedIds.delete(idx);
      prUpdateBatchBar();return;
    }
    var link=e.target.closest('.pr-prod-link');
    if(link){prShowDetail(parseInt(link.dataset.idx));return}
    var shopLink=e.target.closest('.pr-shop-link');
    if(shopLink){switchPage('shops');toast('已跳转到店铺追踪: '+shopLink.dataset.shop);return}
  };
  $('#pr-modal-close').onclick=function(){$('#pr-modal').classList.remove('open')};
  $('#pr-modal').onclick=function(e){if(e.target===this)this.classList.remove('open')};
  $('#pr-batch-add').onclick=function(){
    Array.from(prSelectedIds).forEach(function(i){var p=products[i];rpAddMaterial('product',p[1],p[2]+' '+p[3],'售价'+p[6]+',销量'+p[8]+',增速'+p[9])});
    toast(prSelectedIds.size+' 件商品已加入报告素材');
  };
  $('#pr-batch-monitor').onclick=function(){toast('已将 '+prSelectedIds.size+' 个店铺加入监控');prSelectedIds.clear();prUpdateBatchBar()};
  $('#pr-batch-export').onclick=prExportExcel;
  $('#pr-batch-clear').onclick=function(){prSelectedIds.clear();$$('#pr-table-body .pr-chk').forEach(function(c){c.checked=false});$('#pr-check-all').checked=false;prUpdateBatchBar()};
  $('#pr-export-excel').onclick=prExportExcel;
  $('#pr-export-pdf').onclick=prExportPDF;
  $('#pr-file-input').onchange=function(){var file=this.files&&this.files[0];prHandleFile(file);this.value='';};
  $('#pr-clear-data').onclick=prClearImportedData;
  $('#pr-shop-load').onclick=function(){
    var shop=$('#pr-shop-select').value;
    if(!shop){toast('请先选择店铺');return}
    var shopProducts=products.filter(function(p){return p[11]===shop});
    var hotCount=shopProducts.filter(function(p){return p[10]==='爆发'||p[10]==='上升'}).length;
    $('#pr-shop-stats').innerHTML=
      '<div class="pr-shop-stat"><b>'+shopProducts.length+'</b><span>在售商品</span></div>'+
      '<div class="pr-shop-stat"><b style="color:#3a6ea8">'+hotCount+'</b><span>热销款</span></div>'+
      '<div class="pr-shop-stat"><b style="color:var(--orange)">'+(shopProducts.length-hotCount)+'</b><span>滞销款</span></div>';
    prRenderTable(shopProducts);
    $('#pr-count').textContent='● '+shopProducts.length+' 件商品 | 店铺: '+shop;
    toast('已加载 '+shop+' 商品库');
  };
})();



// ========== SHOPS PAGE - FULL REBUILD ==========
var shSelected = new Set();
var shActiveAI = 'benchmark';
var shActiveGroup = 'all';
var shGroups = {all:'全部店铺'};
var shGroupShops = {};

// 洞察只基于已导入或已接入的店铺记录，由 shBuildAIItems 动态生成。

function shSwitchAI(tab) {
  shActiveAI = tab;
  document.querySelectorAll('.sh-ai-tab').forEach(function(b){b.classList.toggle('active', b.dataset.aitab===tab)});
  var aiEl = document.getElementById('sh-ai-content');
  var cmpEl = document.getElementById('sh-compare-panel');
  if(tab === 'compare') {
    if(aiEl) aiEl.style.display = 'none';
    if(cmpEl) cmpEl.style.display = 'block';
    shRenderCompareTab();
  } else {
    if(aiEl) aiEl.style.display = 'block';
    if(cmpEl) cmpEl.style.display = 'none';
    shRenderAI();
  }
}

function shRenderAI() {
  var el = document.getElementById('sh-ai-content');
  if(!el) return;
  if(!shops.length){
    el.innerHTML='<div class="pr-empty-note">暂无已导入的店铺数据，店铺洞察不会使用示例或推测指标。</div>';
    return;
  }
  var list = shBuildAIItems(shActiveAI);
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';
  list.forEach(function(item, i) {
    var borderColor = shActiveAI === 'benchmark' ? 'var(--green)' : '#e53935';
    html += '<div style="border:1px solid ' + borderColor + ';border-radius:8px;padding:14px;background:var(--paper)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">';
    html += '<strong style="font-size:14px;color:var(--ink)">' + escapeHtml(item.title) + '</strong>';
    html += '<span style="font-size:11px;color:var(--muted);white-space:nowrap;margin-left:8px">' + escapeHtml(item.time||'文件') + '</span>';
    html += '</div>';
    html += '<p style="font-size:12px;color:#555;line-height:1.6;margin:0 0 10px">' + escapeHtml(item.desc) + '</p>';
    html += '<div style="display:flex;gap:8px">';
    if(item.idx!==undefined)html += '<button class="sh-ai-src" data-idx="' + item.idx + '" style="font-size:11px;padding:3px 8px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">🔗 溯源定位</button>';
    if(item.addable)html += '<button class="sh-ai-report" data-title="' + encodeURIComponent(item.title) + '" data-desc="' + encodeURIComponent(item.desc) + '" style="font-size:11px;padding:3px 8px;border:1px solid var(--orange);color:var(--orange);border-radius:4px;background:transparent;cursor:pointer">+ 加入素材</button>';
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;

  // Event delegation for source buttons
  el.querySelectorAll('.sh-ai-src').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      shCloseModal();
      setTimeout(function(){ shShowDetail(idx); }, 100);
    });
  });
  el.querySelectorAll('.sh-ai-report').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var title = decodeURIComponent(this.dataset.title);
      var desc = decodeURIComponent(this.dataset.desc);
      rpAddMaterial('shop',title,'店铺 AI 洞察',desc);
    });
  });
}

function shBuildAIItems(tab){
  var provided=shops.filter(function(s){return s&&s._source;});
  if(!provided.length)return [{title:'暂无可用店铺洞察',desc:'当前页面只接受用户导入或已接入的店铺记录。',time:'状态'}];
  if(tab==='risk'){
    var riskCount=provided.filter(function(s){return prText(s[5])==='风险'||(prText(s[4])&&prText(s[4]).charAt(0)==='-');}).length;
    return [{title:'已导入店铺风险字段',desc:'文件中有 '+riskCount+' 条记录提供了风险状态或负增长字段。系统不会依据缺失数据推断异常。',time:'文件'}];
  }
  return [{title:'已导入店铺记录',desc:'当前文件包含 '+provided.length+' 家店铺。请使用筛选器按市场、平台和类目查看，未提供的 GMV、增速、粉丝或评分字段保持为空。',time:'文件'}];
}

function shRenderCompareTab(){
  var el=document.getElementById('sh-compare-panel'); if(!el) return;
  var cats={},markets={},plats={};
  shops.forEach(function(x){if(prText(x[6]))cats[x[6]]=1;if(prText(x[2]))markets[x[2]]=1;if(prText(x[1]))plats[x[1]]=1;});
  function opts(o,all){return '<option value="">'+all+'</option>'+Object.keys(o).map(function(k){return '<option>'+k+'</option>';}).join('');}
  var html='';
  html+='<div style="border:1px solid var(--wave);background:var(--sea-soft);border-radius:8px;padding:14px;margin-bottom:14px">';
  html+='<p style="margin:0 0 10px;font-size:13px;color:var(--ink)"><b>竞品对标</b><span style="color:var(--muted);font-weight:400"> · 仅基于已导入店铺记录</span></p>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">';
  html+='<select id="sh-cmp-cat" style="border:1px solid var(--line);padding:8px 12px;border-radius:4px;font:12px \'Noto Sans SC\'">'+opts(cats,'全部品类')+'</select>';
  html+='<select id="sh-cmp-market" style="border:1px solid var(--line);padding:8px 12px;border-radius:4px;font:12px \'Noto Sans SC\'">'+opts(markets,'全部市场')+'</select>';
  html+='<select id="sh-cmp-plat" style="border:1px solid var(--line);padding:8px 12px;border-radius:4px;font:12px \'Noto Sans SC\'">'+opts(plats,'全部平台')+'</select>';
  html+='<button onclick="shRunCompare()" style="padding:8px 18px;background:var(--sea-deep);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px">对标分析</button>';
  html+='</div></div>';
  html+='<div id="sh-cmp-result"></div>';
  el.innerHTML=html;
  shRunCompare();
}
function shRunCompare(){
  var cat=document.getElementById('sh-cmp-cat')?document.getElementById('sh-cmp-cat').value:'';
  var market=document.getElementById('sh-cmp-market')?document.getElementById('sh-cmp-market').value:'';
  var plat=document.getElementById('sh-cmp-plat')?document.getElementById('sh-cmp-plat').value:'';
  var res=document.getElementById('sh-cmp-result'); if(!res) return;
  var peers=shops.filter(function(x){return (!cat||x[6]===cat)&&(!market||x[2]===market)&&(!plat||x[1]===plat);});
  if(!peers.length){ res.innerHTML='<p style="color:var(--muted);font-size:13px">该条件下暂无已导入店铺。</p>'; return; }
  peers.sort(function(a,b){return shParseGMV(b[3])-shParseGMV(a[3]);});
  var top5=peers.slice(0,5);
  var n=peers.length;
  var growthValues=peers.map(function(x){return parseFloat(x[4]);}).filter(function(v){return !isNaN(v);});
  var avgGrow=growthValues.length?growthValues.reduce(function(a,v){return a+v;},0)/growthValues.length:NaN;
  var html='';
  html+='<div style="font-size:12px;color:var(--muted);margin-bottom:10px">匹配 <b style="color:var(--ink)">'+n+'</b> 家店铺 · 平均增速 <b style="color:var(--ink)">'+(isNaN(avgGrow)?'未提供':(avgGrow>=0?'+':'')+avgGrow.toFixed(1)+'%')+'</b></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">';
  top5.forEach(function(x){
    var bi=shops.indexOf(x);
    html+='<div style="border:1px solid #ddd;border-radius:8px;padding:14px;background:var(--paper)">';
    html+='<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px"><strong style="font-size:14px;color:var(--ink)">'+escapeHtml(prDisplay(x[0]))+'</strong><span style="font-size:11px;color:var(--muted)">'+escapeHtml(prDisplay(x[1]))+'</span></div>';
    html+='<div style="font-size:12px;color:#555;line-height:1.7">月GMV <b>'+escapeHtml(prDisplay(x[3]))+'</b> · 增速 <b style="color:var(--green)">'+escapeHtml(prDisplay(x[4]))+'</b><br>主营 '+escapeHtml(prDisplay(x[6]))+' · 粉丝 '+escapeHtml(prText(x[10])?jayFmtCount(x[10]):'未提供')+' · 评分 '+escapeHtml(prDisplay(x[11]))+'</div>';
    html+='<div style="display:flex;gap:8px;margin-top:10px">';
    html+='<button onclick="shShowDetail('+bi+')" style="font-size:11px;padding:4px 10px;border:1px solid var(--sea-deep);color:var(--sea-deep);border-radius:4px;background:transparent;cursor:pointer">🔍 查看导入字段</button>';
    html+='</div></div>';
  });
  html+='</div>';
  res.innerHTML=html;
}

// ========== FILTERS ==========
function shInitFilters() {
  var regions = [], plats = [], cats = [], allTags = [];
  shops.forEach(function(s) {
    if(regions.indexOf(s[2])<0) regions.push(s[2]);
    if(plats.indexOf(s[1])<0) plats.push(s[1]);
    if(cats.indexOf(s[6])<0) cats.push(s[6]);
    if(s[9]) { s[9].split(',').forEach(function(t){ t=t.trim(); if(t && allTags.indexOf(t)<0) allTags.push(t); }); }
  });
  var rSel = document.getElementById('sh-f-region');
  var pSel = document.getElementById('sh-f-platform');
  var cSel = document.getElementById('sh-f-cat');
  var tSel = document.getElementById('sh-f-tag');
  if(!rSel||!pSel||!cSel||!tSel)return;
  rSel.innerHTML='<option value="">全部市场</option>';
  pSel.innerHTML='<option value="">全部平台</option>';
  cSel.innerHTML='<option value="">全部类目</option>';
  tSel.innerHTML='<option value="">全部标签</option>';
  regions.forEach(function(r){ var o=document.createElement('option'); o.value=r; o.textContent=r; rSel.appendChild(o); });
  plats.forEach(function(p){ var o=document.createElement('option'); o.value=p; o.textContent=p; pSel.appendChild(o); });
  cats.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; cSel.appendChild(o); });
  allTags.forEach(function(t){ var o=document.createElement('option'); o.value=t; o.textContent=t; tSel.appendChild(o); });

  ['sh-f-region','sh-f-platform','sh-f-cat','sh-f-status','sh-f-gmv','sh-f-tag','sh-f-sort'].forEach(function(id){
    var control=document.getElementById(id);if(!control||control._shFilterBound)return;control._shFilterBound=true;
    control.addEventListener('change', shApplyFilters);
  });
  var keyword=document.getElementById('sh-f-keyword');if(keyword&&!keyword._shFilterBound){keyword._shFilterBound=true;keyword.addEventListener('input', jayDeb('shApplyFilters'));}
}

function shParseGMV(s) {
  var m = s.replace(/[^0-9.]/g, '');
  return parseFloat(m) || 0;
}

function shApplyFilters() {
  var region = document.getElementById('sh-f-region').value;
  var plat = document.getElementById('sh-f-platform').value;
  var cat = document.getElementById('sh-f-cat').value;
  var status = document.getElementById('sh-f-status').value;
  var gmv = document.getElementById('sh-f-gmv').value;
  var tag = document.getElementById('sh-f-tag').value;
  var kw = document.getElementById('sh-f-keyword').value.trim().toLowerCase();
  var sort = document.getElementById('sh-f-sort').value;

  var filtered = shops.map(function(s,i){ return {s:s,idx:i}; }).filter(function(o) {
    var s = o.s;
    if(shActiveGroup !== 'all') {
      var grpShops = shGroupShops[shActiveGroup] || [];
      if(grpShops.indexOf(o.idx) < 0) return false;
    }
    if(region && s[2] !== region) return false;
    if(plat && s[1] !== plat) return false;
    if(cat && s[6] !== cat) return false;
    if(status && s[5] !== status) return false;
    if(tag && (!prText(s[9]) || s[9].indexOf(tag) < 0)) return false;
    if(kw && prText(s[0]).toLowerCase().indexOf(kw)<0 && prText(s[6]).toLowerCase().indexOf(kw)<0) return false;
    if(gmv) {
      var g = shParseGMV(s[3]);
      if(gmv==='0-100' && g>100) return false;
      if(gmv==='100-300' && (g<100||g>300)) return false;
      if(gmv==='300-500' && (g<300||g>500)) return false;
      if(gmv==='500+' && g<500) return false;
    }
    return true;
  });

  // Sort
  filtered.sort(function(a,b) {
    var sa=a.s, sb=b.s;
    switch(sort) {
      case 'gmv_asc': return shParseGMV(sa[3]) - shParseGMV(sb[3]);
      case 'gmv_desc': return shParseGMV(sb[3]) - shParseGMV(sa[3]);
      case 'growth_desc': return parseFloat(sb[4]) - parseFloat(sa[4]);
      case 'growth_asc': return parseFloat(sa[4]) - parseFloat(sb[4]);
      case 'products_desc': return (sb[7]||0) - (sa[7]||0);
      default: return shParseGMV(sb[3]) - shParseGMV(sa[3]);
    }
  });

  shRenderTable(filtered);
  document.getElementById('sh-count').textContent = '(' + filtered.length + '/' + shops.length + ')';
}

function shStatusCls(st) {
  if(st === '正常') return 'watch';
  if(st === '风险') return 'hot';
  return 'alert-tag';
}

function shRenderTable(list) {
  var tbody = document.getElementById('shop-table');
  if(!tbody) return;
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="13"><div class="pr-empty-note">暂无已导入的店铺数据</div></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function(o) {
    var s = o.s; var idx = o.idx;
    var checked = shSelected.has(idx) ? 'checked' : '';
    var growthCls = prText(s[4]).charAt(0) === '-' ? '' : 'growth';
    var waveCls = prText(s[8]).charAt(0) === '-' ? 'style="color:#e53935"' : 'style="color:var(--green)"';
    var tagsHtml = '';
    if(prText(s[9])) {
      s[9].split(',').forEach(function(t) {
        t = t.trim();
        var tc = t === '对标头部' ? 'var(--green)' : t === '低价竞品' ? 'var(--orange)' : 'var(--muted)';
        tagsHtml += '<span style="display:inline-block;font-size:10px;padding:1px 6px;border:1px solid ' + tc + ';color:' + tc + ';border-radius:3px;margin-right:3px">' + escapeHtml(t) + '</span>';
      });
    }
    return '<tr>' +
      '<td><input type="checkbox" class="sh-cb" data-idx="' + idx + '" ' + checked + ' onchange="shToggleOne(' + idx + ',this.checked)"></td>' +
      '<td><strong style="cursor:pointer;color:var(--green)" class="sh-shop-link" data-idx="' + idx + '">' + escapeHtml(prDisplay(s[0])) + '</strong></td>' +
      '<td>' + escapeHtml(prDisplay(s[1])) + '</td>' +
      '<td>' + escapeHtml(prDisplay(s[2])) + '</td>' +
      '<td>' + escapeHtml(prDisplay(s[6])) + '</td>' +
      '<td><strong>' + escapeHtml(prDisplay(s[3])) + '</strong></td>' +
      '<td ' + waveCls + '>' + escapeHtml(prDisplay(s[8])) + '</td>' +
      '<td>' + escapeHtml(prDisplay(s[7])) + '</td>' +
      '<td class="' + growthCls + '">' + escapeHtml(prDisplay(s[4])) + '</td>' +
      '<td style="font-size:12px">' + (prText(s[10])?escapeHtml(jayFmtCount(s[10])):'未提供') + '</td>' +
      '<td>' + tagsHtml + '</td>' +
      '<td><span class="tag ' + shStatusCls(s[5]) + '">' + escapeHtml(prDisplay(s[5])) + '</span></td>' +
      '<td style="font-size:11px;color:var(--muted)">' + escapeHtml(prDisplay(s[12])) + '</td>' +
      '</tr>';
  }).join('');

  // Event delegation for shop links
  tbody.querySelectorAll('.sh-shop-link').forEach(function(el) {
    el.addEventListener('click', function() {
      shShowDetail(parseInt(this.dataset.idx));
    });
  });
  // Checkbox events
  tbody.querySelectorAll('.sh-cb').forEach(function(el) {
    el.addEventListener('change', function() {
      shToggleOne(parseInt(this.dataset.idx), this.checked);
    });
  });
}

function shToggleOne(idx, checked) {
  if(checked) shSelected.add(idx); else shSelected.delete(idx);
  shUpdateBatch();
}
function shToggleAll(checked) {
  document.querySelectorAll('.sh-cb').forEach(function(cb){ cb.checked=checked; shToggleOne(parseInt(cb.dataset.idx), checked); });
}
function shClearSelection() {
  shSelected.clear();
  document.querySelectorAll('.sh-cb').forEach(function(cb){ cb.checked=false; });
  document.getElementById('sh-select-all').checked = false;
  shUpdateBatch();
}
function shUpdateBatch() {
  var bar = document.getElementById('sh-batch-bar');
  bar.style.display = shSelected.size > 0 ? 'flex' : 'none';
  document.getElementById('sh-batch-count').textContent = '已选 ' + shSelected.size + ' 家';
}

// ========== SHOP DETAIL MODAL ==========
function shShowDetail(idx) {
  var s = shops[idx]; if(!s) return;
  document.getElementById('sh-modal-title').textContent = s[0] + ' — ' + s[1] + ' (' + s[2] + ')';
  var body = document.getElementById('sh-modal-body');

  // Imported/manual/cloud records only show fields that actually exist in the source.
  {
    body.innerHTML='<div class="pr-empty-note" style="text-align:left;padding:0 0 14px">数据来源：'+escapeHtml(prDisplay(s._source))+'。以下空白字段表示源文件未提供，系统不会估算。</div>'+
      '<div class="pr-m-stats">'+
      '<div class="pr-m-stat"><b>'+escapeHtml(prDisplay(s[3]))+'</b><span>月 GMV</span></div>'+
      '<div class="pr-m-stat"><b>'+escapeHtml(prDisplay(s[4]))+'</b><span>增速</span></div>'+
      '<div class="pr-m-stat"><b>'+escapeHtml(prDisplay(s[7]))+'</b><span>在售商品</span></div>'+
      '<div class="pr-m-stat"><b>'+escapeHtml(prDisplay(s[12]))+'</b><span>更新时间</span></div>'+
      '</div>'+
      '<div class="pr-m-section"><h4>店铺信息</h4><p>平台：'+escapeHtml(prDisplay(s[1]))+' · 市场：'+escapeHtml(prDisplay(s[2]))+' · 类目：'+escapeHtml(prDisplay(s[6]))+'</p><p>粉丝：'+escapeHtml(prDisplay(s[10]))+' · 评分：'+escapeHtml(prDisplay(s[11]))+' · 标签：'+escapeHtml(prDisplay(s[9]))+'</p></div>'+
      '<div class="pr-m-section"><h4>趋势与结构</h4><p>未提供可验证的时间序列、品类结构或流量结构字段。</p></div>'+
      '<div style="display:flex;gap:8px;margin-top:16px"><button class="filter-button" style="padding:8px 18px" onclick="shAddToReport('+idx+')">加入报告素材</button></div>';
    document.getElementById('sh-modal-overlay').classList.add('show');
    return;
  }

}

function shCloseModal() {
  document.getElementById('sh-modal-overlay').classList.remove('show');
}

function shAddToReport(idx) {
  var s = shops[idx];
  rpAddMaterial('shop',s[0]+' ('+s[1]+')',s[2],'月GMV '+s[3]+' 增速'+s[4]+' 主营'+s[6]+' 状态:'+s[5]);
}

// ========== BATCH OPS ==========
function shBatchAddReport() {
  if(!jayCanUseUserDb()){toast('只读演示不保存素材，请登录后使用');return}
  var pool = rpGetPool();
  shSelected.forEach(function(idx) {
    var s = shops[idx];
    pool.push({id:Date.now()+'_'+idx,type:'shop',title:s[0]+' ('+s[1]+')',source:s[2],summary:'月GMV '+s[3]+' 增速'+s[4]+' 主营'+s[6],addedAt:new Date().toISOString(),selected:true});
  });
  rpSavePool(pool);
  toast('已批量加入 ' + shSelected.size + ' 家店铺到报告素材');
  shClearSelection();
}
function shBatchSetAlert() {
  toast('已为 ' + shSelected.size + ' 家店铺设置预警规则');
  shClearSelection();
}
function shBatchRemove() {
  toast('已移除 ' + shSelected.size + ' 家店铺监控');
  shClearSelection();
}

// ========== ADD SHOP ==========
function shOpenAddModal() { document.getElementById('sh-add-overlay').classList.add('show'); }
function shCloseAddModal() { document.getElementById('sh-add-overlay').classList.remove('show'); }
function shSwitchAddTab(tab) {
  document.querySelectorAll('.sh-add-tab').forEach(function(b){b.classList.toggle('active',b.dataset.addtab===tab)});
  document.getElementById('sh-add-single').style.display = tab==='single'?'block':'none';
  document.getElementById('sh-add-batch').style.display = tab==='batch'?'block':'none';
  document.getElementById('sh-add-link').style.display = tab==='link'?'block':'none';
}
function shDoAddSingle() {
  var name = document.getElementById('sh-add-name').value.trim();
  var plat = prNormalizePlatform(document.getElementById('sh-add-platform').value.trim());
  var market = prNormalizeMarket(document.getElementById('sh-add-market').value.trim());
  var cat = document.getElementById('sh-add-cat').value.trim();
  var tags = document.getElementById('sh-add-tags').value.trim() || '';
  if(!name) { toast('请输入店铺名称'); return; }
  if(!prAllowedMarket(market)||!prAllowedPlatform(plat)){toast('店铺必须属于美国市场和已接入的 4 个平台');return;}
  var addedShop=[name, plat, market, '', '', '', cat, '', '', tags, '', '', ''];
  addedShop._source='用户手动添加';
  shops.push(addedShop);
  shCloseAddModal();
  shApplyFilters();
  toast('已添加店铺: ' + name);
  // Also add to products cross-link
  rpAddMaterial('shop',name+' ('+plat+')',market,'新添加监控店铺 主营'+cat);
}
function shDoAddBatch() {
  var text = document.getElementById('sh-add-batch-text').value.trim();
  if(!text) { toast('请粘贴店铺名称'); return; }
  var lines = text.split('\n').filter(function(l){return l.trim()});
  shCloseAddModal();
  toast('批量店铺需通过类目机会页上传 CSV/JSON，并提供美国市场和平台字段');
}

// ========== GROUPS ==========
function shRenderGroups() {
  var el = document.getElementById('sh-group-tabs');
  var html = '<button class="sh-grp ' + (shActiveGroup==='all'?'active':'') + '" data-grp="all" onclick="shSwitchGroup(\'all\')">全部店铺</button>';
  Object.keys(shGroups).forEach(function(k) {
    if(k === 'all') return;
    html += '<button class="sh-grp ' + (shActiveGroup===k?'active':'') + '" data-grp="' + escapeHtml(k) + '" onclick="shSwitchGroup(\'' + escInline(k) + '\')">' + escapeHtml(k) + ' <span style="font-size:10px;color:var(--muted)">(' + (shGroupShops[k]||[]).length + ')</span></button>';
  });
  el.innerHTML = html;
}
function shSwitchGroup(grp) {
  shActiveGroup = grp;
  shRenderGroups();
  shApplyFilters();
}
async function shNewGroup() {
  if(!jayCanUseUserDb()){toast('只读演示不保存分组，请登录后使用');return}
  var name = prompt('输入分组名称（如：东南亚美妆对标店铺）');
  if(!name) return;
  name=name.trim();if(!name)return;
  if(shGroups[name]){toast('分组名称已存在');return}
  shGroups[name] = name;
  shGroupShops[name] = [];
  var ok=await jaySaveWorkspaceAsset('shop_groups',{groups:shGroups,items:shGroupShops});
  shRenderGroups();
  toast(ok?('已创建并同步分组: '+name):'分组云端同步失败，已暂存等待重试');
}

// ========== TEMPLATES ==========
async function shSaveTpl() {
  if(!jayCanUseUserDb()){toast('只读演示不保存模板，请登录后使用');return}
  var state = {
    region: document.getElementById('sh-f-region').value,
    platform: document.getElementById('sh-f-platform').value,
    cat: document.getElementById('sh-f-cat').value,
    status: document.getElementById('sh-f-status').value,
    gmv: document.getElementById('sh-f-gmv').value,
    tag: document.getElementById('sh-f-tag').value,
    keyword: document.getElementById('sh-f-keyword').value,
    sort: document.getElementById('sh-f-sort').value
  };
  var tpls = jayGetWorkspaceAsset('shop_filter_templates',[]).slice();
  var name = prompt('模板名称', state.region + ' ' + state.platform + ' ' + state.cat);
  if(!name) return;
  state.name = name;
  tpls.push(state);
  var ok=await jaySaveWorkspaceAsset('shop_filter_templates',tpls);
  shRenderTplSelect();
  toast(ok?('模板已同步: '+name):'模板云端同步失败，已暂存等待重试');
}
function shRenderTplSelect() {
  var sel = document.getElementById('sh-tpl-select');
  if(!sel)return;
  var tpls = jayGetWorkspaceAsset('shop_filter_templates',[]);
  sel.innerHTML = '<option value="">加载模板...</option>' + tpls.map(function(t,i){ return '<option value="' + i + '">' + escapeHtml(t.name) + '</option>'; }).join('');
}
function shLoadTpl(idx) {
  if(idx === '') return;
  var tpls = jayGetWorkspaceAsset('shop_filter_templates',[]);
  var t = tpls[parseInt(idx)]; if(!t) return;
  document.getElementById('sh-f-region').value = t.region || '';
  document.getElementById('sh-f-platform').value = t.platform || '';
  document.getElementById('sh-f-cat').value = t.cat || '';
  document.getElementById('sh-f-status').value = t.status || '';
  document.getElementById('sh-f-gmv').value = t.gmv || '';
  document.getElementById('sh-f-tag').value = t.tag || '';
  document.getElementById('sh-f-keyword').value = t.keyword || '';
  document.getElementById('sh-f-sort').value = t.sort || 'gmv_desc';
  shApplyFilters();
  toast('已加载模板: ' + t.name);
}

// ========== EXPORT ==========
function shExportExcel() {
  if(!shops.length){toast('暂无已导入店铺数据，无法导出');return;}
  var header = '店铺名\t平台\t市场\t主营类目\t月GMV\t30天波动\t在售商品\t增速\t粉丝数\t标签\t状态\t更新时间';
  var rows = shops.map(function(s){ return s.join('\t'); });
  var csv = '\uFEFF' + header + '\n' + rows.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shop_tracker_export.csv';
  a.click();
  toast('Excel导出完成');
}
function shExportPDF() {
  if(!shops.length){toast('暂无已导入店铺数据，无法导出');return;}
  var md = '# 店铺追踪竞品分析报告\\n\\n';
  md += '导出时间: ' + new Date().toLocaleString() + '\\n\\n';
  md += '## 监控概览\\n\\n';
  md += '- 监控店铺总数: ' + shops.length + '\\n';
  var regions = {};
  shops.forEach(function(s){ regions[s[2]] = (regions[s[2]]||0)+1; });
  Object.keys(regions).forEach(function(r){ md += '- ' + r + ': ' + regions[r] + '家\\n'; });
  md += '\\n## 头部店铺分析\\n\\n';
  shops.filter(function(s){ return shParseGMV(s[3]) >= 300; }).sort(function(a,b){ return shParseGMV(b[3])-shParseGMV(a[3]); }).forEach(function(s){
    md += '### ' + s[0] + '\\n';
    md += '- 平台: ' + s[1] + ' | 市场: ' + s[2] + ' | 类目: ' + s[6] + '\\n';
    md += '- 月GMV: ' + s[3] + ' | 增速: ' + s[4] + ' | 30天波动: ' + s[8] + '\\n';
    md += '- 在售商品: ' + s[7] + ' | 粉丝: ' + s[10] + ' | 评分: ' + s[11] + '\\n';
    md += '- 状态: ' + s[5] + ' | 标签: ' + (s[9]||'无') + '\\n\\n';
  });
  if(jayPrintMarkdownReport('店铺追踪竞品分析报告',md.replace(/\\n/g, '\n'),'本报告仅基于用户导入或手动添加的数据，缺失字段未作推测。')) toast('已打开打印页，可另存为 PDF');
}

// ========== 店铺云端同步（device 维度 → Supabase monitored_shops） ==========
function jayDeviceId() {
  try {
    var d = localStorage.getItem('jay_device_id');
    if (!d) { d = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('jay_device_id', d); }
    return d;
  } catch (e) { return 'anon'; }
}
function jayShopRowId(s) {
  var base = (s[0] || '') + '|' + (s[1] || '') + '|' + (s[2] || '');
  var h = 0; for (var i = 0; i < base.length; i++) { h = (h * 31 + base.charCodeAt(i)) >>> 0; }
  var owner = jayUser && !jayIsDemo ? jayUser.id : jayDeviceId();
  return owner + ':' + h.toString(16);
}
function jayCollectShops() {
  // shops 是竞品店铺的主列表（分组 shGroupShops 仅存索引），故直接去重主列表即可
  var seen = {}, out = [];
  (shops || []).forEach(function(s){
    if (!s) return;
    var id = jayShopRowId(s);
    if (!seen[id]) { seen[id] = 1; out.push(s); }
  });
  return out;
}
async function jaySyncShopsToCloud() {
  try {
    if (typeof supabaseClient === 'undefined' || !supabaseClient || !jayUser || jayIsDemo) { toast('登录后可同步店铺到个人空间'); return; }
    var rows = jayCollectShops().map(function(s){
      return {
        id: jayShopRowId(s), user_id: jayUser.id, device_id: jayDeviceId(),
        shop_name: s[0] || '', platform: s[1] || '', market: s[2] || '',
        gmv: s[3] || '', growth: s[4] || '', status: s[5] || '',
        category: s[6] || '', tags: s[9] || '', source: 'app', updated_at: new Date().toISOString()
      };
    });
    if (!rows.length) { toast('暂无可同步店铺'); return; }
    var res = await supabaseClient.from('monitored_shops').upsert(rows, { onConflict: 'id' });
    if (res.error) { console.error('[shop sync]', res.error); toast('同步失败：' + (res.error.message || res.error.code)); return; }
    toast('已同步 ' + rows.length + ' 家店铺到云端 ☁');
  } catch (e) { console.error(e); toast('同步出错'); }
}
async function jayLoadShopsFromCloud() {
  try {
    if (typeof supabaseClient === 'undefined' || !supabaseClient || !jayUser || jayIsDemo) return;
    var res = await supabaseClient.from('monitored_shops').select('*').eq('user_id', jayUser.id);
    if (res.error || !res.data || !res.data.length) return;
    var local = {}; jayCollectShops().forEach(function(s){ local[jayShopRowId(s)] = 1; });
    var added = 0;
    res.data.forEach(function(r) {
      var id = r.id || (jayDeviceId() + ':' + (r.shop_name + '|' + r.platform + '|' + r.market));
      if (local[id]) return;
      var cloudShop=[r.shop_name || '', r.platform || '', r.market || '', r.gmv || '', r.growth || '', r.status || '', r.category || '', r.products || '', r.wave || '', r.tags || '', r.followers || '', r.rating || '', r.updated_at || ''];
      cloudShop._source='云端';
      shops.push(cloudShop);
      local[id] = 1; added++;
    });
    if (added) { shApplyFilters(); }
  } catch (e) { /* 静默：云端不可用时不影响本地使用 */ }
}

// ========== INIT ==========
(function initShopsPage() {
  shInitFilters();
  shRenderAI();
  shRenderGroups();
  shRenderTplSelect();
  shApplyFilters();
})();


let countryFullData={};
var currentCountry='us';
var aiTabIdx=0;
