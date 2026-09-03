// ========== CONTENT PAGE - FULL REBUILD ==========
var ctSelected = new Set();
var ctActiveAI = 'convert';
var ctActiveMain = 'all';
var ctFavFolders = [];
var ctFavItems = {};

var ctAiConvert = [];
var ctAiTrend = [];
var ctAiRisk = [];
var ctLiveData = [];

function ctRecordMeta(record) {
  if(!record || typeof record !== 'object') return {};
  return Object.assign({}, record._provenance||record.provenance||record._sourceMeta||record.meta||{}, record);
}
function ctIsValidatedContent(record) {
  if(!Array.isArray(record)) return false;
  var meta=ctRecordMeta(record);
  var sourceKind=String(meta.source_kind||meta.sourceKind||meta.provenance||'').toLowerCase();
  var status=String(meta.verification_status||meta.verificationStatus||meta.verification||'').toLowerCase();
  var evidence=meta.source_url||meta.sourceUrl||meta.source_record_id||meta.sourceRecordId||meta.source_file||meta.sourceFile||record[15]||'';
  if(sourceKind==='demo'||sourceKind==='mock'||sourceKind==='演示') return false;
  if(['verified','uploaded'].indexOf(status)<0) return false;
  if(!evidence) return false;
  var api=window.JAY_MARKET_SCOPE_API;
  if(!api) return true;
  var marketCode=api.normalizeMarketCode?api.normalizeMarketCode(record[2]):record[2];
  var context=api.getActiveContext?api.getActiveContext():{marketCodes:[],categoryCodes:[]};
  if(context.marketCodes&&context.marketCodes.length&&context.marketCodes.indexOf(marketCode)<0)return false;
  if(api.isAllowedPlatform&& !api.isAllowedPlatform(record[1],marketCode))return false;
  if(context.categoryCodes&&context.categoryCodes.length&&api.normalizeCategoryCode){
    if(context.categoryCodes.indexOf(api.normalizeCategoryCode(record[10]))<0)return false;
  }
  return true;
}
function ctScopedData(){return Array.isArray(contentData)?contentData.filter(ctIsValidatedContent):[];}
function ctMetric(value){return value===undefined||value===null||String(value).trim()===''?'未提供':String(value);}
function ctHasNumericMetric(record,index){return record&&String(record[index]===undefined?'':record[index]).trim()!==''&&Number.isFinite(Number(String(record[index]).replace(/[%万,]/g,'')));}
function ctContentSnapshot(record){
  var meta=ctRecordMeta(record);
  return {row:Array.prototype.slice.call(record||[]),raw:meta.raw||meta.raw_record||null,provenance:{
    source_kind:meta.source_kind||meta.sourceKind||'',source_type:meta.source_type||meta.sourceType||'',
    source_url:meta.source_url||meta.sourceUrl||'',source_record_id:meta.source_record_id||meta.sourceRecordId||'',
    verification_status:meta.verification_status||meta.verificationStatus||'',collected_at:meta.collected_at||meta.collectedAt||null
  },source:meta.source_url||meta.source_file||meta.sourceFile||'',market:record&&record[2]||'',platform:record&&record[1]||'',category:record&&record[10]||''};
}
function ctRawField(raw, aliases){
  for(var i=0;i<aliases.length;i++){
    if(raw[aliases[i]]!==undefined&&raw[aliases[i]]!==null&&String(raw[aliases[i]]).trim()!=='')return raw[aliases[i]];
  }
  return '';
}
function ctSetContentRecords(records){
  var next=(Array.isArray(records)?records:[]).map(function(raw){
    var record;
    if(Array.isArray(raw))record=raw.slice();
    else if(raw&&typeof raw==='object')record=[
      ctRawField(raw,['标题','title','name']),ctRawField(raw,['平台','platform','channel']),
      ctRawField(raw,['市场','国家/市场','market','country','region']),ctRawField(raw,['类型','内容类型','type','content_type']),
      ctRawField(raw,['点赞','点赞量','likes','likes_wan']),ctRawField(raw,['播放','播放量','plays','views','views_wan']),
      ctRawField(raw,['日期','发布时间','date','published_at','publishedAt']),ctRawField(raw,['创作者','达人','creator','author']),
      ctRawField(raw,['带货商品','商品','product','product_name']),ctRawField(raw,['转化率','conversion_rate','conversion','conv_rate']),
      ctRawField(raw,['类目','品类','category']),ctRawField(raw,['脚本类型','script_type','script']),
      ctRawField(raw,['达人粉丝','粉丝数','followers','followers_wan']),ctRawField(raw,['关联店铺','店铺','shop','store']),
      ctRawField(raw,['信号','signal','trend'])
    ];
    else return null;
    Object.keys(raw||{}).forEach(function(key){if(!/^\d+$/.test(key))record[key]=raw[key];});
    return record;
  }).filter(Boolean);
  contentData.splice(0,contentData.length);
  contentData.push.apply(contentData,next);
  ctSelected.clear();
  ctRenderAI();
  ctApplyFilters();
  ctRenderCreator();
  ctRenderLive();
  if(typeof jayRebuildSearch==='function')jayRebuildSearch();
  return next.length;
}
window.jaySetContentRecords=ctSetContentRecords;

function ctSwitchAI(tab) {
  ctActiveAI = tab;
  document.querySelectorAll('.ct-ai-tab').forEach(function(b){b.classList.toggle('active', b.dataset.aitab===tab)});
  ctRenderAI();
}

function ctRenderAI() {
  var list = ctActiveAI === 'convert' ? ctAiConvert : ctActiveAI === 'trend' ? ctAiTrend : ctAiRisk;
  var el = document.getElementById('ct-ai-content');
  if(!el) return;
  if(!ctScopedData().length||!list.length){
    el.innerHTML='<div class="empty-state"><p>暂无已接入的内容洞察数据</p><small>未通过来源校验的内容不会展示。</small></div>';
    return;
  }
  var borderColor = ctActiveAI === 'risk' ? '#e53935' : ctActiveAI === 'trend' ? '#4a90d9' : 'var(--green)';
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';
  list.forEach(function(item) {
    html += '<div style="border:1px solid ' + borderColor + ';border-radius:8px;padding:14px;background:var(--paper)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">';
    html += '<strong style="font-size:14px;color:var(--ink)">' + item.title + '</strong>';
    html += '<span style="font-size:11px;color:var(--muted);white-space:nowrap;margin-left:8px">' + item.time + '</span>';
    html += '</div>';
    html += '<p style="font-size:12px;color:#555;line-height:1.6;margin:0 0 10px">' + item.desc + '</p>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button class="ct-ai-src" data-idx="' + item.idx + '" style="font-size:11px;padding:3px 8px;border:1px solid ' + borderColor + ';color:' + borderColor + ';border-radius:4px;background:transparent;cursor:pointer">溯源定位</button>';
    html += '<button class="ct-ai-report" data-title="' + encodeURIComponent(item.title) + '" data-desc="' + encodeURIComponent(item.desc) + '" style="font-size:11px;padding:3px 8px;border:1px solid var(--orange);color:var(--orange);border-radius:4px;background:transparent;cursor:pointer">+ 加入素材</button>';
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;

  el.querySelectorAll('.ct-ai-src').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      if(idx >= 0 && idx < contentData.length) ctShowDetail(idx);
    });
  });
  el.querySelectorAll('.ct-ai-report').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var title = decodeURIComponent(this.dataset.title);
      var desc = decodeURIComponent(this.dataset.desc);
      rpAddMaterial('custom',title,'内容 AI 洞察',desc);
    });
  });
}

// ========== FILTERS ==========
function ctInitFilters() {
  return;
}

function ctGetCreatorTier(followers) {
  var f = parseFloat(followers) || 0;
  if(f >= 100) return '头部KOL';
  if(f >= 30) return '中腰部达人';
  return '素人铺量';
}

function ctApplyFilters() {
  if(!document.getElementById('ct-f-platform') || !document.getElementById('ct-f-market') || !document.getElementById('ct-f-type') || !document.getElementById('ct-f-cat') || !document.getElementById('ct-f-tier') || !document.getElementById('ct-f-signal') || !document.getElementById('ct-f-period') || !document.getElementById('ct-f-keyword') || !document.getElementById('ct-f-sort')) return;
  var plat = document.getElementById('ct-f-platform').value;
  var market = document.getElementById('ct-f-market').value;
  var type = document.getElementById('ct-f-type').value;
  var cat = document.getElementById('ct-f-cat').value;
  var tier = document.getElementById('ct-f-tier').value;
  var signal = document.getElementById('ct-f-signal').value;
  var period = document.getElementById('ct-f-period').value;
  var kw = document.getElementById('ct-f-keyword').value.trim().toLowerCase();
  var sort = document.getElementById('ct-f-sort').value;

  var scopedData=ctScopedData();
  var filtered = scopedData.map(function(c){return {c:c,idx:contentData.indexOf(c)};}).filter(function(o) {
    var c = o.c;
    if(plat && c[1] !== plat) return false;
    if(market && c[2] !== market) return false;
    if(type && c[3] !== type) return false;
    if(cat && c[10] !== cat) return false;
    if(tier && ctGetCreatorTier(c[12]) !== tier) return false;
    if(signal && c[14] !== signal) return false;
    if(kw && c[0].toLowerCase().indexOf(kw)<0 && c[7].toLowerCase().indexOf(kw)<0 && c[8].toLowerCase().indexOf(kw)<0) return false;
    if(period) {
      var daysAgo = Math.floor((Date.now() - new Date(c[6]).getTime()) / 86400000);
      if(period==='today' && daysAgo > 1) return false;
      if(period==='7d' && daysAgo > 7) return false;
      if(period==='30d' && daysAgo > 30) return false;
    }
    return true;
  });

  filtered.sort(function(a,b) {
    var ca=a.c, cb=b.c;
    switch(sort) {
      case 'plays_asc': return parseFloat(ca[5])-parseFloat(cb[5]);
      case 'plays_desc': return parseFloat(cb[5])-parseFloat(ca[5]);
      case 'likes_desc': return parseFloat(cb[4])-parseFloat(ca[4]);
      case 'conv_desc': return parseFloat(cb[9])-parseFloat(ca[9]);
      default: return parseFloat(cb[5])-parseFloat(ca[5]);
    }
  });

  ctRenderCards(filtered);
  document.getElementById('ct-count').textContent = '(' + filtered.length + '/' + scopedData.length + ')';
}

function ctSignalCls(s) {
  if(s==='爆发') return 'hot';
  if(s==='衰退') return 'alert-tag-ct';
  return 'watch';
}

// S-07 标题兜底：缺标题时用带货商品+类型生成可读标题
function ctTitle(c) {
  if(c[0] && String(c[0]).trim()) return c[0];
  return (c[8] ? c[8] : '未命名爆款') + (c[3] ? ' · ' + c[3] : '');
}

// N-05 缩略图：视频封面式占位（渐变 + 装饰圆 + 播放按钮 + 角标）
function ctThumbHtml(c, idx) {
  // 渐变色板（每张卡不同，但更柔和的视频封面感）
  var palette = [
    ['#4f7ec9', '#7c5fb8', '#b07ec5'],   // 紫蓝
    ['#2e8b6a', '#3aab84', '#7dd3a0'],   // 翡翠
    ['#c95a3f', '#e08850', '#f0b66e'],   // 暖橙
    ['#6a4dbf', '#9265d8', '#c08ee8'],   // 紫罗兰
    ['#c9365a', '#e3627a', '#f594a6'],   // 玫红
    ['#1f7793', '#2fa2c2', '#5dc8e0'],   // 海洋
    ['#d4901f', '#e8b04c', '#f3cc75'],   // 黄金
    ['#3d5a8a', '#5d7ab0', '#8aa3d4']    // 暮蓝
  ];
  var colors = palette[((idx || 0) % palette.length)];
  var grad = 'linear-gradient(135deg,' + colors[0] + ' 0%,' + colors[1] + ' 55%,' + colors[2] + ' 100%)';

  var isLive = c[3] === '直播';
  var typeLabel = isLive ? 'LIVE' : (c[3] || '视频');
  var platform = c[6] || '';
  // 截平台短名（如 "TikTok · 欧美" → "TikTok"）
  var platShort = platform.split('·')[0].split('|')[0].trim() || 'JAY';

  var duration = '未提供';

  // 互动数（万）
  var likesW = parseFloat(c[4]) || 0;
  var engage = String(c[4]===undefined?'':c[4]).trim()==='' ? '未提供' : (likesW >= 1000 ? (likesW/10000).toFixed(1) + 'w' : (likesW >= 1 ? likesW + 'w' : Math.round(likesW*10)/10 + 'w'));

  return '<div class="ct-thumb" style="--ct-grad:' + grad + '">' +
    '<div class="ct-thumb-bg"></div>' +
    '<div class="ct-thumb-deco"></div>' +
    '<div class="ct-thumb-deco2"></div>' +
    '<span class="ct-thumb-type ' + (isLive ? 'is-live' : '') + '">' +
      (isLive ? '<span class="dot"></span>LIVE' : '<span class="dot" style="background:rgba(255,255,255,.7)"></span>' + escapeHtml(typeLabel)) +
    '</span>' +
    '<span class="ct-thumb-engage">' +
      '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.35-9.5-9.5C.5 7 4 3 8 3c2 0 3.5 1 4 2 1-1 2-2 4-2 4 0 7.5 4 5.5 8.5C19 16.65 12 21 12 21z"/></svg>' +
      escapeHtml(engage) +
    '</span>' +
    '<div class="ct-thumb-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>' +
    '<span class="ct-thumb-platform">' + escapeHtml(platShort) + '</span>' +
    '<span class="ct-thumb-duration">' + duration + '</span>' +
    '</div>';
}

function ctRenderCards(list) {
  var grid = document.getElementById('ct-card-grid');
  if(!grid) return;
  grid.innerHTML = list.map(function(o) {
    var c = o.c; var idx = o.idx;
    var checked = ctSelected.has(idx) ? 'checked' : '';
    var likes = parseFloat(c[4])||0;
    var plays = parseFloat(c[5])||0;
    var tier = ctHasNumericMetric(c,12) ? ctGetCreatorTier(c[12]) : '未提供';
    var tierColor = tier==='头部KOL' ? 'var(--orange)' : tier==='中腰部达人' ? 'var(--green)' : 'var(--muted)';
    return '<article class="ct-card-new">' +
      '<div class="ct-card-check"><input type="checkbox" class="ct-cb" data-idx="' + idx + '" ' + checked + ' onchange="ctToggleOne(' + idx + ',this.checked)"></div>' +
      ctThumbHtml(c, idx) +
      '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">' +
        '<span class="tag ' + (c[3]==='直播'?'hot':c[3]==='短视频'?'watch':'') + '" style="font-size:10px">' + c[3] + '</span>' +
        '<span class="tag ' + ctSignalCls(c[14]) + '" style="font-size:10px">' + c[14] + '</span>' +
        '<span style="font-size:10px;padding:1px 6px;border:1px solid ' + tierColor + ';color:' + tierColor + ';border-radius:3px">' + tier + '</span>' +
      '</div>' +
      '<h3 class="ct-card-title" data-idx="' + idx + '" style="cursor:pointer">' + escapeHtml(ctTitle(c)) + '</h3>' +
      '<p class="ct-meta">' + c[1] + ' · ' + c[2] + ' · ' + jayFmtTime(c[6]) + '</p>' +
      '<p class="ct-meta">创作者: ' + c[7] + ' <span style="color:var(--muted);font-size:11px">(' + c[12] + '粉)</span></p>' +
      '<p class="ct-meta">脚本: ' + c[11] + ' | 类目: ' + c[10] + '</p>' +
      '<p class="ct-product">带货: ' + c[8] + '</p>' +
      '<p class="ct-meta" style="font-size:11px">关联店铺: <span class="ct-shop-link" data-shop="' + c[13] + '" style="color:var(--green);cursor:pointer">' + c[13] + '</span></p>' +
      '<div class="ct-stats">' +
        '<span>点赞 <b>' + ctMetric(c[4]) + (ctMetric(c[4])==='未提供'?'':'万') + '</b></span>' +
        '<span>播放 <b>' + ctMetric(c[5]) + (ctMetric(c[5])==='未提供'?'':'万') + '</b></span>' +
        '<span>转化率 <b>' + ctMetric(c[9]) + (ctMetric(c[9])==='未提供'?'':'%') + '</b></span>' +
      '</div>' +
      '<div class="ct-card-actions">' +
        '<button class="ct-act-report" data-idx="' + idx + '" title="加入报告素材">📋</button>' +
        '<button class="ct-act-fav" data-idx="' + idx + '" title="收藏">⭐</button>' +
        '<button class="ct-act-copy" data-idx="' + idx + '" title="复制标题">📎</button>' +
      '</div>' +
    '</article>';
  }).join('') || '<p style="color:#888;padding:20px">暂无已验证内容数据</p>';

  // Event listeners
  grid.querySelectorAll('.ct-card-title').forEach(function(el) {
    el.addEventListener('click', function(){ ctShowDetail(parseInt(this.dataset.idx)); });
  });
  grid.querySelectorAll('.ct-shop-link').forEach(function(el) {
    el.addEventListener('click', function(){ switchPage('shops'); });
  });
  grid.querySelectorAll('.ct-act-report').forEach(function(el) {
    el.addEventListener('click', function(){ ctAddToReport(parseInt(this.dataset.idx)); });
  });
  grid.querySelectorAll('.ct-act-fav').forEach(function(el) {
    el.addEventListener('click', function(){ ctAddToFav(parseInt(this.dataset.idx)); });
  });
  grid.querySelectorAll('.ct-act-copy').forEach(function(el) {
    el.addEventListener('click', function(){
      var c = contentData[parseInt(this.dataset.idx)];
      if(navigator.clipboard) { navigator.clipboard.writeText(c[0]); toast('已复制: ' + c[0].substring(0,20)); }
      else { toast('复制功能不可用'); }
    });
  });
  grid.querySelectorAll('.ct-cb').forEach(function(el) {
    el.addEventListener('change', function(){ ctToggleOne(parseInt(this.dataset.idx), this.checked); });
  });
}

function ctToggleOne(idx, checked) {
  if(checked) ctSelected.add(idx); else ctSelected.delete(idx);
  ctUpdateBatch();
}
function ctClearSelection() {
  ctSelected.clear();
  document.querySelectorAll('.ct-cb').forEach(function(cb){cb.checked=false;});
  ctUpdateBatch();
}
function ctUpdateBatch() {
  var bar = document.getElementById('ct-batch-bar');
  bar.style.display = ctSelected.size > 0 ? 'flex' : 'none';
  document.getElementById('ct-batch-count').textContent = '已选 ' + ctSelected.size + ' 条';
}

// ========== CONTENT DETAIL MODAL ==========
function ctShowDetail(idx) {
  var c = contentData[idx]; if(!c) return;
  if(!ctIsValidatedContent(c)){toast('该内容尚未通过来源核验');return;}
  document.getElementById('ct-modal-title').textContent = ctTitle(c);
  var body = document.getElementById('ct-modal-body');
  var likes = ctMetric(c[4]);
  var plays = ctMetric(c[5]);

  var html = '';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';

  // Block 1: Script breakdown
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px">🎬 内容脚本拆解</h4>';
  html += '<div style="font-size:12px;line-height:1.8">';
  html += '<div><strong>脚本类型:</strong> ' + c[11] + '</div>';
  html += '<div><strong>内容类型:</strong> ' + c[3] + '</div>';
  html += '<div><strong>带货类目:</strong> ' + c[10] + '</div>';
  html += '<div><strong>达人层级:</strong> ' + (ctHasNumericMetric(c,12)?ctGetCreatorTier(c[12]):'未提供') + '</div>';
  html += '<div><strong>热门关键词:</strong> ' + c[0].split(' ').slice(0,3).join(' / ') + '</div>';
  html += '<div><strong>推荐BGM:</strong> 未提供</div>';
  html += '<div><strong>封面风格:</strong> 未提供</div>';
  html += '</div></div>';

  // Block 2: source fields
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px">📈 数据时间序列</h4>';
  html += '<p style="font-size:12px;color:var(--muted);line-height:1.7">未提供可验证的时间序列字段。当前记录：播放 ' + plays + (plays==='未提供'?'':'万') + ' · 点赞 ' + likes + (likes==='未提供'?'':'万') + ' · 转化 ' + ctMetric(c[9]) + (ctMetric(c[9])==='未提供'?'':'%') + '。</p></div>';

  // Block 3: Similar content
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px">🔗 同款内容聚合</h4>';
  var similarItems = ctScopedData().filter(function(x){ return x !== c && x[10] === c[10]; }).slice(0,4);
  if(similarItems.length === 0) {
    html += '<p style="font-size:12px;color:var(--muted)">暂无同类目同款内容</p>';
  } else {
    similarItems.forEach(function(s) {
      html += '<div style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px">';
      html += '<span>' + s[0].substring(0,25) + '...</span>';
      html += '<span style="float:right;color:var(--green)">' + ctMetric(s[5]) + (ctMetric(s[5])==='未提供'?'':'万') + '播放</span>';
      html += '</div>';
    });
  }
  html += '</div>';

  // Block 4: Actions
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px">⚡ 快捷操作</h4>';
  html += '<div style="display:flex;flex-direction:column;gap:8px">';
  html += '<button onclick="ctCloseModal();switchPage(\'products\');setTimeout(function(){var kw=document.getElementById(\'sh-f-keyword\');if(kw){kw.value=\'' + c[8].substring(0,10) + '\';} if(typeof shApplyFilters===\'function\')shApplyFilters();},200)" style="padding:6px 12px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer;font-size:12px;text-align:left">🔗 跳转产品雷达查看带货商品</button>';
  html += '<button onclick="ctCloseModal();switchPage(\'shops\')" style="padding:6px 12px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer;font-size:12px;text-align:left">🏪 跳转店铺追踪 (' + c[13] + ')</button>';
  html += '<button onclick="ctCloseModal();switchPage(\'alerts\')" style="padding:6px 12px;border:1px solid #e53935;color:#e53935;border-radius:4px;background:transparent;cursor:pointer;font-size:12px;text-align:left">🔔 设置达人/商品异动预警</button>';
  html += '<button onclick="ctCloseModal();switchPage(\'countries\')" style="padding:6px 12px;border:1px solid var(--muted);color:var(--muted);border-radius:4px;background:transparent;cursor:pointer;font-size:12px;text-align:left">🌍 查看' + c[2] + '内容电商行情</button>';
  html += '</div></div>';

  html += '</div>';

  // Bottom actions
  html += '<div style="display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #eee">';
  html += '<button onclick="ctAddToReport(' + idx + ')" style="padding:6px 14px;border:1px solid var(--orange);color:var(--orange);border-radius:6px;background:transparent;cursor:pointer;font-size:12px">+ 加入报告素材</button>';
  html += '<button onclick="ctAddToFav(' + idx + ')" style="padding:6px 14px;border:1px solid var(--green);color:var(--green);border-radius:6px;background:transparent;cursor:pointer;font-size:12px">⭐ 加入收藏夹</button>';
  html += '</div>';

  body.innerHTML = html;
  document.getElementById('ct-modal-overlay').classList.add('show');
}
function ctCloseModal() { document.getElementById('ct-modal-overlay').classList.remove('show'); }

function ctAddToReport(idx) {
  var c = contentData[idx];
  if(!ctIsValidatedContent(c)){toast('未核验的内容不能加入报告');return;}
  rpAddMaterial('custom',c[0],c[1]+' · '+c[2],c[3]+' 播放'+ctMetric(c[5])+' 转化'+ctMetric(c[9])+' 达人'+ctMetric(c[7]),{snapshot:ctContentSnapshot(c),snapshot_type:'content'});
}
function ctBatchAddReport() {
  if(!jayCanUseUserDb()){toast('只读演示不保存素材，请登录后使用');return}
  var pool = rpGetPool();
  var added=0;
  ctSelected.forEach(function(idx) {
    var c = contentData[idx];
    if(!ctIsValidatedContent(c))return;
    var now=new Date().toISOString();
    pool.push({id:Date.now()+'_'+idx,type:'custom',title:c[0],source:c[1]+' · '+c[2],summary:'播放'+ctMetric(c[5])+' 转化'+ctMetric(c[9])+'%',addedAt:now,selected:true,source_kind:'derived',source_type:'derived',source_record_id:String(idx),verification_status:'verified',verification_notes:'由已核验内容记录生成',snapshot_type:'content',snapshot_data:ctContentSnapshot(c),snapshot_source:ctContentSnapshot(c).source,snapshot_at:now,snapshot_market:c[2],snapshot_platform:c[1],snapshot_category:c[10]});
    added++;
  });
  rpSavePool(pool);
  toast('已批量加入 ' + added + ' 条内容到报告素材');
  ctClearSelection();
}

// ========== MAIN TAB SWITCHING ==========
function ctSwitchMain(tab) {
  ctActiveMain = tab;
  document.querySelectorAll('.ct-main-tab').forEach(function(b){b.classList.toggle('active', b.dataset.mtab===tab)});
  document.getElementById('ct-tab-all').style.display = tab==='all' ? 'block' : 'none';
  document.getElementById('ct-tab-creator').style.display = tab==='creator' ? 'block' : 'none';
  document.getElementById('ct-tab-live').style.display = tab==='live' ? 'block' : 'none';
  document.getElementById('ct-tab-similar').style.display = tab==='similar' ? 'block' : 'none';
  var titles = {all:'全域热门内容', creator:'达人榜单库', live:'直播专场追踪', similar:'同款内容素材库'};
  document.getElementById('ct-main-title').innerHTML = (titles[tab]||'') + ' <span id="ct-count" style="font-size:14px;color:var(--muted)"></span>';
  if(tab==='creator') ctRenderCreator();
  if(tab==='live') ctRenderLive();
  if(tab==='all') ctApplyFilters();
}

// ========== CREATOR LEADERBOARD ==========
function ctRenderCreator() {
  if(!document.getElementById('ct-cr-platform') || !document.getElementById('ct-cr-market') || !document.getElementById('ct-cr-cat')) return;
  var plat = document.getElementById('ct-cr-platform').value;
  var market = document.getElementById('ct-cr-market').value;
  var cat = document.getElementById('ct-cr-cat').value;

  // Aggregate creator data
  var creators = {};
  var scopedData=ctScopedData().filter(function(c){return ctHasNumericMetric(c,12)&&ctHasNumericMetric(c,5);});
  if(!scopedData.length){
    var empty=document.getElementById('ct-creator-table');
    if(empty)empty.innerHTML='<tr><td colspan="10"><div class="empty-state">暂无已验证的达人数据，接入正式来源后才会生成榜单。</div></td></tr>';
    return;
  }
  scopedData.forEach(function(c) {
    if(plat && c[1]!==plat) return;
    if(market && c[2]!==market) return;
    if(cat && c[10]!==cat) return;
    var key = c[7];
    if(!creators[key]) creators[key] = {name:key, platform:c[1], market:c[2], followers:parseFloat(c[12])||0, totalPlays:0, totalConv:0, convCount:0, count:0, cats:[], shop:c[13]};
    creators[key].totalPlays += parseFloat(c[5])||0;
    if(ctHasNumericMetric(c,9)){creators[key].totalConv += parseFloat(c[9]);creators[key].convCount++;}
    creators[key].count++;
    if(creators[key].cats.indexOf(c[10])<0) creators[key].cats.push(c[10]);
  });

  var list = Object.values(creators).sort(function(a,b){ return b.followers - a.followers; });
  var tbody = document.getElementById('ct-creator-table');
  tbody.innerHTML = list.map(function(cr, i) {
    var avgPlays = (cr.totalPlays / cr.count).toFixed(0);
    var avgConv = cr.convCount ? (cr.totalConv / cr.convCount).toFixed(1)+'%' : '未提供';
    return '<tr>' +
      '<td><strong>' + (i+1) + '</strong></td>' +
      '<td>' + cr.name + '</td>' +
      '<td>' + cr.platform + '</td>' +
      '<td>' + cr.market + '</td>' +
      '<td><b>' + cr.followers + '万</b></td>' +
      '<td>' + avgPlays + '万</td>' +
      '<td>' + cr.cats.join('/') + '</td>' +
      '<td class="growth">' + avgConv + '</td>' +
      '<td>' + cr.count + '</td>' +
      '<td><button onclick="toast(\'已添加监控: '+escInline(cr.name)+'\')" style="font-size:11px;padding:3px 8px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">+ 监控</button></td>' +
      '</tr>';
  }).join('');
}

// ========== LIVE TRACKING ==========
function ctRenderLive() {
  var grid = document.getElementById('ct-live-grid');
  if(!grid) return;
  var validLive=ctLiveData.filter(function(record){
    if(!record)return false;
    var meta=ctRecordMeta(record);
    var source=meta.source_url||meta.source_record_id||meta.source_file;
    return ['verified','uploaded'].indexOf(String(meta.verification_status||'').toLowerCase())>=0&&!!source;
  });
  if(!validLive.length){
    grid.innerHTML='<div class="empty-state"><p>暂无已接入的直播追踪数据</p><small>未接入正式来源前保持空状态。</small></div>';
    return;
  }
  grid.innerHTML = validLive.map(function(live) {
    return '<article class="ct-live-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">' +
        '<span class="tag hot" style="font-size:10px">LIVE</span>' +
        '<span style="font-size:11px;color:var(--muted)">' + jayFmtTime(live.date) + '</span>' +
      '</div>' +
      '<h3 style="font-size:14px;margin:0 0 6px">' + live.title + '</h3>' +
      '<p class="ct-meta">' + live.creator + ' · ' + live.platform + ' · ' + live.market + '</p>' +
      '<p class="ct-meta">时长: ' + live.duration + ' | 风格: ' + live.style + '</p>' +
      '<div class="ct-stats" style="margin-top:8px">' +
        '<span>峰值在线 <b>' + live.peakViewers + '</b></span>' +
        '<span>场观 <b>' + live.totalViews + '</b></span>' +
        '<span>GMV <b>' + live.gmv + '</b></span>' +
      '</div>' +
      '<p style="font-size:11px;color:var(--muted);margin:6px 0 0">带货: ' + live.products + '</p>' +
    '</article>';
  }).join('');
}

// ========== SIMILAR CONTENT SEARCH ==========
function ctSearchSimilar() {
  var kw = document.getElementById('ct-similar-input').value.trim().toLowerCase();
  var results = document.getElementById('ct-similar-results');
  if(!kw) { results.innerHTML = '<p style="color:var(--muted)">请输入商品名称</p>'; return; }
  var displayKw=escapeHtml(kw);
  var matches = ctScopedData().filter(function(c){ return String(c[8]||'').toLowerCase().indexOf(kw)>=0 || String(c[0]||'').toLowerCase().indexOf(kw)>=0 || String(c[10]||'').toLowerCase().indexOf(kw)>=0; });
  if(matches.length === 0) { results.innerHTML = '<p style="color:var(--muted)">未找到与 "' + displayKw + '" 相关的同款内容</p>'; return; }
  var html = '<p style="font-size:13px;margin-bottom:12px">找到 <b>' + matches.length + '</b> 条与 "' + displayKw + '" 相关的同款内容</p>';
  html += '<div class="ct-card-grid">';
  matches.forEach(function(c) {
    var idx = contentData.indexOf(c);
    html += '<article class="ct-card-new" style="cursor:pointer" onclick="ctShowDetail(' + idx + ')">' +
      ctThumbHtml(c, idx) +
      '<span class="tag ' + (c[3]==='直播'?'hot':'watch') + '" style="font-size:10px">' + c[3] + '</span>' +
      '<h3 style="font-size:13px;margin:6px 0">' + escapeHtml(ctTitle(c)) + '</h3>' +
      '<p class="ct-meta">' + c[7] + ' · ' + c[1] + ' · ' + jayFmtTime(c[6]) + '</p>' +
      '<div class="ct-stats"><span>播放 <b>' + c[5] + '万</b></span><span>转化 <b>' + c[9] + '%</b></span></div>' +
    '</article>';
  });
  html += '</div>';
  results.innerHTML = html;
}

// ========== FAVORITES ==========
function ctToggleFavPanel() {
  var panel = document.getElementById('ct-fav-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  ctRenderFavFolders();
}
function ctRenderFavFolders() {
  var el = document.getElementById('ct-fav-folders');
  el.innerHTML = ctFavFolders.map(function(f, i) {
    var items = ctFavItems[f] || [];
    return '<button class="ct-fav-folder" data-folder="' + escapeHtml(f) + '" onclick="ctSelectFolder(\'' + escInline(f) + '\')" style="padding:5px 14px;border:1px solid #ddd;border-radius:16px;background:transparent;cursor:pointer;font-size:12px;margin-right:6px;margin-bottom:4px">' + escapeHtml(f) + ' (' + items.length + ')</button>';
  }).join('');
  ctRenderFavItems();
}
async function ctNewFavFolder() {
  if(!jayCanUseUserDb()){toast('只读演示不保存收藏夹，请登录后使用');return}
  var name = prompt('输入文件夹名称');
  if(!name) return;
  name=name.trim();if(!name)return;
  if(ctFavFolders.indexOf(name)>=0){toast('收藏夹名称已存在');return}
  ctFavFolders.push(name);
  ctFavItems[name] = [];
  var ok=await jaySaveWorkspaceAsset('content_collections',{folders:ctFavFolders,items:ctFavItems});
  ctRenderFavFolders();
  toast(ok?('已创建并同步收藏夹: '+name):'收藏夹云端同步失败，已暂存等待重试');
}
var ctActiveFolder = '';
function ctSelectFolder(name) {
  ctActiveFolder = name;
  ctRenderFavFolders();
  ctRenderFavItems();
}
function ctRenderFavItems() {
  var el = document.getElementById('ct-fav-items');
  if(!ctActiveFolder) { el.innerHTML = '<p style="color:var(--muted);font-size:12px">选择一个文件夹查看收藏内容</p>'; return; }
  var items = ctFavItems[ctActiveFolder] || [];
  if(items.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-size:12px">该文件夹暂无收藏，在内容卡片上点击⭐收藏</p>'; return; }
  el.innerHTML = items.map(function(item, i) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0">' +
      '<span style="font-size:12px">' + item.title + '</span>' +
      '<button onclick="ctRemoveFav(\'' + escInline(ctActiveFolder) + '\',' + i + ')" style="font-size:10px;color:#e53935;background:none;border:none;cursor:pointer">移除</button>' +
    '</div>';
  }).join('');
}
async function ctAddToFav(idx) {
  if(!jayCanUseUserDb()){toast('只读演示不保存收藏，请登录后使用');return}
  var c = contentData[idx];
  if(!ctIsValidatedContent(c)){toast('未核验的内容不能收藏');return}
  if(ctFavFolders.length === 0) { toast('请先创建收藏夹文件夹'); return; }
  var folder = ctActiveFolder || ctFavFolders[0];
  if(!ctFavItems[folder]) ctFavItems[folder] = [];
  ctFavItems[folder].push({title:ctTitle(c), creator:c[7], platform:c[1], ts:Date.now()});
  var ok=await jaySaveWorkspaceAsset('content_collections',{folders:ctFavFolders,items:ctFavItems});
  toast(ok?('已收藏并同步到: '+folder):'收藏云端同步失败，已暂存等待重试');
  ctRenderFavFolders();
}
async function ctRemoveFav(folder, idx) {
  if(!jayCanUseUserDb()){toast('请登录后管理收藏');return}
  ctFavItems[folder].splice(idx, 1);
  var ok=await jaySaveWorkspaceAsset('content_collections',{folders:ctFavFolders,items:ctFavItems});
  ctRenderFavFolders();
  if(!ok)toast('移除同步失败，已暂存等待重试');
}
async function ctBatchAddFav() {
  if(!jayCanUseUserDb()){toast('只读演示不保存收藏，请登录后使用');return}
  if(ctFavFolders.length === 0) { toast('请先创建收藏夹'); return; }
  var folder = ctActiveFolder || ctFavFolders[0];
  if(!ctFavItems[folder]) ctFavItems[folder] = [];
  ctSelected.forEach(function(idx) {
    var c = contentData[idx];
    if(!ctIsValidatedContent(c))return;
    ctFavItems[folder].push({title:ctTitle(c), creator:c[7], platform:c[1], ts:Date.now()});
  });
  var count=ctSelected.size;
  var ok=await jaySaveWorkspaceAsset('content_collections',{folders:ctFavFolders,items:ctFavItems});
  toast(ok?('已收藏 '+count+' 条并同步到: '+folder):'批量收藏同步失败，已暂存等待重试');
  ctClearSelection();
  ctRenderFavFolders();
}

// ========== TEMPLATES ==========
async function ctSaveTpl() {
  if(!jayCanUseUserDb()){toast('只读演示不保存模板，请登录后使用');return}
  var state = {};
  ['ct-f-platform','ct-f-market','ct-f-type','ct-f-cat','ct-f-tier','ct-f-signal','ct-f-period','ct-f-sort'].forEach(function(id){
    state[id.replace('ct-f-','')] = document.getElementById(id).value;
  });
  state.keyword = document.getElementById('ct-f-keyword').value;
  var tpls = jayGetWorkspaceAsset('content_filter_templates',[]).slice();
  var name = prompt('模板名称', state.platform + ' ' + state.market + ' ' + state.type);
  if(!name) return;
  state.name = name;
  tpls.push(state);
  var ok=await jaySaveWorkspaceAsset('content_filter_templates',tpls);
  ctRenderTplSelect();
  toast(ok?('模板已同步: '+name):'模板云端同步失败，已暂存等待重试');
}
function ctRenderTplSelect() {
  var sel = document.getElementById('ct-tpl-select');
  if(!sel)return;
  var tpls = jayGetWorkspaceAsset('content_filter_templates',[]);
  sel.innerHTML = '<option value="">加载模板...</option>' + tpls.map(function(t,i){ return '<option value="' + i + '">' + escapeHtml(t.name) + '</option>'; }).join('');
}
function ctLoadTpl(idx) {
  if(idx === '') return;
  var tpls = jayGetWorkspaceAsset('content_filter_templates',[]);
  var t = tpls[parseInt(idx)]; if(!t) return;
  ['platform','market','type','cat','tier','signal','period','sort'].forEach(function(k){
    var el = document.getElementById('ct-f-' + k);
    if(el) el.value = t[k] || '';
  });
  document.getElementById('ct-f-keyword').value = t.keyword || '';
  ctApplyFilters();
  toast('已加载模板: ' + t.name);
}

// ========== EXPORT ==========
function ctExportExcel() {
  var scopedData=ctScopedData();
  if(!scopedData.length){toast('暂无已验证内容数据，无法导出');return;}
  var header = '标题\t平台\t市场\t类型\t点赞(万)\t播放(万)\t日期\t创作者\t带货商品\t转化率\t类目\t脚本类型\t达人粉丝\t关联店铺\t信号';
  var rows = scopedData.map(function(c){ return c.join('\t'); });
  var csv = '\uFEFF' + header + '\n' + rows.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'content_tracker_export.csv';
  a.click();
  toast('Excel导出完成');
}
function ctExportPDF() {
  var scopedData=ctScopedData();
  if(!scopedData.length){toast('暂无已验证内容数据，无法导出');return;}
  var md = '# 热门内容竞品分析报告\n\n';
  md += '导出时间: ' + new Date().toLocaleString() + '\n\n';
  md += '## 内容概览\n\n';
  md += '- 追踪内容总数: ' + scopedData.length + '\n';
  var plats = {};
  scopedData.forEach(function(c){ plats[c[1]] = (plats[c[1]]||0)+1; });
  Object.keys(plats).forEach(function(p){ md += '- ' + p + ': ' + plats[p] + '条\n'; });
  md += '\n## 爆款内容TOP10\n\n';
  scopedData.slice().sort(function(a,b){ return parseFloat(b[5])-parseFloat(a[5]); }).slice(0,10).forEach(function(c){
    md += '### ' + c[0] + '\n';
    md += '- 平台: ' + c[1] + ' | 市场: ' + c[2] + ' | 类型: ' + c[3] + '\n';
    md += '- 播放: ' + c[5] + '万 | 点赞: ' + c[4] + '万 | 转化率: ' + c[9] + '%\n';
    md += '- 达人: ' + c[7] + ' (' + c[12] + '粉) | 脚本: ' + c[11] + '\n';
    md += '- 带货: ' + c[8] + ' | 店铺: ' + c[13] + '\n\n';
  });
  if(jayPrintMarkdownReport('热门内容竞品分析报告',md,'报告仅包含已核验内容记录，并保留来源和快照信息。')) toast('已打开打印页，可另存为 PDF');
}

// ========== INIT ==========
(function initContentPage() {
  if (!document.getElementById('ct-f-platform')) return;
  ctInitFilters();
  ctRenderAI();
  ctRenderTplSelect();
  ctApplyFilters();
})();

if(window.addEventListener) window.addEventListener('jay:market-scope-change', function(){
  ctSelected.clear();
  ctRenderAI();
  ctApplyFilters();
  ctRenderCreator();
  ctRenderLive();
});



// === Overview Rework: New Rendering Logic ===

// -- Block 1: AI Hero handlers --
(function(){
  var heroInput=$('#ov-hero-input');
  var heroSend=$('#ov-hero-send');
  var resultEl=$('#ov-hero-result');

  function escapeHtml(s){ return s.replace(/[&<"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c];}); }

  function simpleRenderMd(md){
    return escapeHtml(md).split(/\n\s*\n/).filter(function(s){return s.trim();}).map(function(s){return '<p>'+s.replace(/\n/g,'<br>')+'</p>';}).join('');
  }

  function showHeroLoading(q){
    if(!resultEl)return;
    var wrap=document.querySelector('.ov-hero-input-wrap');
    if(wrap)wrap.classList.add('busy');
    resultEl.style.display='';
    var scopeApi=window.JAY_MARKET_SCOPE_API;
    var scopeLabel=scopeApi&&scopeApi.getScopeLabel?scopeApi.getScopeLabel():'当前市场范围';
    resultEl.innerHTML='<div class="ovr-card"><div class="ovr-head"><span>🤖</span><h4>AI 正在分析「'+escapeHtml(q)+'」<small>结合'+escapeHtml(scopeLabel)+'数据</small></h4></div>'+
      '<div class="ovr-steps">'+
        '<div class="ovr-step" data-step="1"><span class="ovr-dot">1</span><div><b>关键词解析</b><small>理解你的品类与市场意图</small></div></div>'+
        '<div class="ovr-step" data-step="2"><span class="ovr-dot">2</span><div><b>匹配市场 / 政策 / 规则</b><small>交叉检索'+escapeHtml(scopeLabel)+'</small></div></div>'+
        '<div class="ovr-step" data-step="3"><span class="ovr-dot">3</span><div><b>生成结论</b><small>输出机会 / 风险 / 下一步</small></div></div>'+
      '</div>'+
      '<div class="ovr-progress-bar"><i></i></div></div>';
    setHeroStep(1);
  }

  function setHeroStep(step){
    if(!resultEl)return;
    var steps=resultEl.querySelectorAll('.ovr-step');
    steps.forEach(function(el){
      var idx=parseInt(el.getAttribute('data-step'),10);
      var dot=el.querySelector('.ovr-dot');
      el.classList.remove('active','done');
      if(idx<step){el.classList.add('done');if(dot)dot.textContent='✓';}
      else{el.classList.add(idx===step?'active':'');if(dot)dot.textContent=String(idx);}
    });
    var bar=resultEl.querySelector('.ovr-progress-bar i');
    if(bar)bar.style.width=(Math.min(step,3)/3*100)+'%';
  }

  function delay(ms){return new Promise(function(r){setTimeout(r,ms);});}

  function buildHeroResultCard(q, bodyHtml){
    return '<div class="ovr-card"><div class="ovr-head"><span>AI</span><h4>分析结果：'+escapeHtml(q)+'<small>基于当前工作区数据与联网检索</small></h4></div>'+
      bodyHtml+
      '<div class="ovr-foot"><button class="primary" onclick="switchPage(\'platforms\')">查看平台详情</button><button onclick="switchPage(\'policies\')">查看政策动态</button></div>'+
      '<div class="ovr-note">结论仅在服务端 AI 成功返回后展示；数据不足时不会使用内置规则补造结果。</div></div>';
  }
  async function renderHeroResponse(q){
    if(!resultEl)return;
    showHeroLoading(q);
    var s=$('#global-search');if(s)s.value=q;
    function finish(){ var wrap=document.querySelector('.ov-hero-input-wrap'); if(wrap)wrap.classList.remove('busy'); }
    if(typeof AI_ENGINE!=='undefined' && AI_ENGINE && AI_ENGINE.hasKey()){
      try{
        await delay(320);
        setHeroStep(2);
        var rag = jayRagContextBlock(q, 6);
        var systemPrompt='你是 JAY观海（跨境电商市场情报系统）的 AI 分析师。' + (rag.text ? '\n\n'+rag.text+'\n\n请优先基于上方【JAY观海知识库上下文】作答，引用数据时标注来源类型（如 国家市场/平台规则），不编造知识库之外的精确数字；若上下文不足可结合联网检索补充。' : '') + '\n对用户输入的品类或市场问题，给出简洁的市场机会、风险提醒和下一步建议。优先使用列表，控制在 300 字以内。';
        var answer=await callAI(systemPrompt, q, {max_tokens:800, timeout:20000, search:true});
        setHeroStep(3);
        var bodyHtml='<div class="ovr-section">'+simpleRenderMd(answer)+'</div>';
        var card = buildHeroResultCard(q, bodyHtml);
        if(rag.sources && rag.sources.length){
          card = card.replace('<div class="ovr-note">', '<div class="ovr-note">检索来源：' + rag.sources.join(' · ') + '。');
        }
        resultEl.innerHTML=card;
        finish();
        return;
      }catch(e){
        console.error('Overview AI analysis failed:', e);
      }
    }
    resultEl.innerHTML='<div class="ovr-card"><div class="ovr-head"><span>AI</span><h4>暂未生成分析</h4></div><div class="ovr-section"><p>当前没有可验证的分析结果。请登录并确认 AI 服务可用后重试。</p></div></div>';
    finish();
  }

  function heroSubmit(){
    var q=heroInput.value.trim();
    if(!q){toast('请输入你想问的问题');return;}
    toast('已收到：'+q+'，AI 正在分析市场机会与风险…');
    renderHeroResponse(q);
  }

  // 守卫：旧版 AI Hero DOM 已在改版中移除，元素缺失时跳过事件绑定（否则抛 TypeError 杀死脚本块）
  if(heroInput){ heroInput.onkeydown=function(e){if(e.key==='Enter')heroSubmit();}; }
  if(heroSend){ heroSend.onclick=heroSubmit; }
  var heroChips=$('#ov-hero-chips');
  if(heroChips){ heroChips.onclick=function(e){
    var btn=e.target.closest('button');if(!btn)return;
    heroInput.value=btn.dataset.q;heroSubmit();
  }; }

  // Sync AI input box width with the hero title, and keep it in sync on resize / navigation
  function syncHeroInputWidth(){
    var title=$('.ov-hero-title');
    var wrap=$('.ov-hero-input-wrap');
    if(!title||!wrap)return;
    if(window.innerWidth<=600){ wrap.style.width=''; return; }
    var w=title.offsetWidth;
    if(w>0) wrap.style.width=w+'px';
  }
  syncHeroInputWidth();
  window.addEventListener('resize', syncHeroInputWidth);
  var _origSwitchPage=window.switchPage;
  if(_origSwitchPage){
    window.switchPage=function(name){
      var r=_origSwitchPage.apply(this,arguments);
      if(name==='overview') setTimeout(syncHeroInputWidth, 50);
      return r;
    };
  }
})();


// -- Legacy CTA handlers (refresh / plan / export modal) --
(function(){
  var refreshBtn = $('#ov-refresh-btn');
  if(refreshBtn) refreshBtn.onclick=function(){ jayRefreshAll().then(jayRenderBriefCard); };
  var briefRefresh = $('#ov-brief-refresh');
  if(briefRefresh) briefRefresh.onclick=function(){ jayRefreshAll().then(jayRenderBriefCard); };
  var planBtn = $('#ov-plan-btn');
  if(planBtn) planBtn.onclick=function(){toast('即将跳转至套餐页面…')};
  $$('.ov-entry-card').forEach(function(c){ c.onclick=function(){ switchPage(c.dataset.go); }; });
  $$('.ov-opp-card').forEach(function(c){ c.onclick=function(){ var p=c.dataset.page; if(p)switchPage(p); }; });
  $$('.ov-insight-card').forEach(function(c){ c.onclick=function(){ switchPage('products'); }; });
  // Expose data/functions needed by the overview blocks outside IIFE
  window.countries = countries;
  window.products = products;
  window.macroData = macroData;
  window.policyData = policyData;
  window.pfExtData = pfExtData;
})();

try {
function ovScopeApi(){return window.JAY_MARKET_SCOPE_API;}
function ovActiveContext(){var api=ovScopeApi();return api&&api.getActiveContext?api.getActiveContext():{marketCodes:[],platformKeys:[],categoryCodes:[]};}
function ovScopedProducts(){
  var api=ovScopeApi();
  var source=typeof products!=='undefined'&&Array.isArray(products)?products:[];
  if(!api)return source.slice();
  return source.filter(function(item){return api.isAllowedMarket(item&&item[2])&&api.isAllowedPlatform(item&&item[3]);});
}
function ovPolicyRecords(){return typeof plGetVerifiedPolicies==='function'?plGetVerifiedPolicies(true):[];}
function ovAlertRecords(){return typeof getCombinedAlerts==='function'?getCombinedAlerts():[];}
function ovDataState(name){
  if(name==='policies')return typeof policiesDataState==='string'?policiesDataState:'loading';
  if(name==='alerts')return typeof alertsDataState==='string'?alertsDataState:'loading';
  return 'ready';
}
function ovMarketCode(value){var api=ovScopeApi();return api&&api.normalizeMarketCode?api.normalizeMarketCode(value):String(value||'').toUpperCase();}

function renderOverviewScopeControl(){
  var api=ovScopeApi();
  var toggle=$('#ov-market-scope-toggle');
  var menu=$('#ov-market-scope-menu');
  var options=$('#ov-market-scope-options');
  var selected=$('#ov-market-scope-selected');
  if(!api||!toggle||!menu||!options)return;
  var config=api.getConfig?api.getConfig():{markets:[]};
  var markets=(config.markets||[]).filter(function(m){return m&&m.status!=='inactive';});
  var activeCodes=(api.getActiveMarkets?api.getActiveMarkets():[]).map(function(m){return m.code;});
  var draftCodes=menu.hidden?null:Array.prototype.map.call(options.querySelectorAll('input:checked'),function(input){return input.value;});
  var checkedCodes=draftCodes===null?activeCodes:draftCodes;
  options.innerHTML=markets.map(function(m){
    var platformCount=api.getConfiguredMarketPlatforms?api.getConfiguredMarketPlatforms(m.code).length:0;
    return '<label><input type="checkbox" value="'+escapeHtml(m.code)+'" '+(checkedCodes.indexOf(m.code)>=0?'checked':'')+'><span class="flag">'+escapeHtml(m.flag||'🌐')+'</span><span><b>'+escapeHtml(m.name||m.label||m.code)+'</b><small>'+platformCount+' 个已配置平台</small></span></label>';
  }).join('');
  function updateSelected(){
    var count=options.querySelectorAll('input:checked').length;
    if(selected)selected.textContent='已选 '+count+' 个';
  }
  updateSelected();
  if(!options.__ovBound){options.__ovBound=true;options.addEventListener('change',updateSelected);}
  if(!toggle.__ovBound){
    toggle.__ovBound=true;
    toggle.addEventListener('click',function(e){e.stopPropagation();menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));});
  }
  var all=$('#ov-market-scope-all');
  if(all&&!all.__ovBound){all.__ovBound=true;all.addEventListener('click',function(){options.querySelectorAll('input').forEach(function(input){input.checked=true;});updateSelected();});}
  var apply=$('#ov-market-scope-apply');
  if(apply&&!apply.__ovBound){apply.__ovBound=true;apply.addEventListener('click',function(){
    var codes=Array.prototype.map.call(options.querySelectorAll('input:checked'),function(input){return input.value;});
    if(!codes.length){toast('至少保留一个市场');return;}
    api.setActiveMarkets(codes);menu.hidden=true;toggle.setAttribute('aria-expanded','false');
  });}
  if(!menu.__ovOutsideBound){
    menu.__ovOutsideBound=true;
    document.addEventListener('click',function(e){if(!menu.hidden&&!e.target.closest('.ov-market-scope-picker')){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}});
  }
}

function renderOverviewScopeSummary(){
  var box=$('#ov-scope-summary');if(!box)return;
  var api=ovScopeApi();
  var markets=api&&api.getActiveMarketNames?api.getActiveMarketNames():[];
  var platforms=api&&api.getActivePlatformNames?api.getActivePlatformNames():[];
  var context=ovActiveContext();
  var categories=(context.categoryCodes||[]).map(function(code){var profile=api&&api.getCategoryProfile?api.getCategoryProfile(code):null;return profile&&(profile.name||profile.code)||code;});
  var report=typeof JAY_QUALITY_REPORT!=='undefined'?JAY_QUALITY_REPORT:null;
  var qualityStatus=typeof jayQualityStatus==='function'?jayQualityStatus(report):(report&&report.status||'pending');
  var qualityLabels={healthy:'发布校验通过',degraded:'部分数据降级',not_connected:'关键数据尚未接入',stale:'数据已过期',failed:'发布校验阻断',pending:'正在读取质量状态'};
  box.innerHTML='<span><i data-lucide="globe-2"></i><b>'+escapeHtml(markets.join('、')||'未选择市场')+'</b></span>'+
    '<span><i data-lucide="store"></i><b>'+platforms.length+'</b> 个平台</span>'+
    '<span><i data-lucide="tags"></i>'+escapeHtml(categories.length?categories.join('、'):'全部品类')+'</span>'+
    '<button type="button" id="ov-scope-quality" class="is-'+escapeHtml(qualityStatus)+'"><i data-lucide="database"></i>'+escapeHtml(qualityLabels[qualityStatus]||'质量状态未知')+'</button>';
  var quality=$('#ov-scope-quality');if(quality)quality.onclick=function(){if(typeof switchPage==='function')switchPage('data');};
  if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();
}

// -- Block 2: current-scope KPI cards --
function renderOverviewMetrics(){
  var countryCount=window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.countryCount : 1;
  var platformCount=window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.platformCount : 4;
  var policyState=ovDataState('policies');
  var alertState=ovDataState('alerts');
  var policyCount=ovPolicyRecords().length;
  var alertCount=ovAlertRecords().length;
  var metrics=[
    {icon:'globe-2',label:'覆盖市场',val:String(countryCount),sub:'当前总览范围',metricKey:'country-count'},
    {icon:'store',label:'接入平台',val:String(platformCount),sub:'所选市场平台并集',metricKey:'platform-count'},
    {icon:'landmark',label:'相关政策',val:policyState==='ready'?String(policyCount):'—',sub:policyState==='error'?'数据读取失败':(policyState==='ready'?'跨境经营相关 · 已核验':'正在读取政策'),metricKey:'policy-count'},
    {icon:'triangle-alert',label:'风险预警',val:alertState==='ready'?String(alertCount):'—',sub:alertState==='error'?'数据读取失败':(alertState==='ready'?'当前范围正式记录':'正在读取预警'),metricKey:'alert-count'}
  ];
  var ovMetrics = $('#ov-metrics');
  if(ovMetrics) ovMetrics.innerHTML=metrics.map(function(m){
    return '<button type="button" class="ov-metric-card" data-metric="'+m.metricKey+'"><span class="ov-metric-icon"><i data-lucide="'+m.icon+'"></i></span><span class="ov-metric-info"><span class="ov-metric-val">'+m.val+'</span><h3>'+m.label+'</h3><span class="ov-metric-sub">'+m.sub+'</span></span><i class="ov-metric-open" data-lucide="arrow-up-right"></i></button>';
  }).join('');
  $$('#ov-metrics .ov-metric-card').forEach(function(card){
    card.onclick=function(){
      var metric=card.dataset.metric;
      if(metric==='country-count'&&typeof switchPage==='function')switchPage('countries');
      else if(metric==='platform-count'&&typeof switchPage==='function')switchPage('platforms');
      else if(metric==='policy-count'){
        var context=ovActiveContext();
        var region=(context.marketCodes||[]).length>1?'all':((context.marketCodes||[])[0]||'all');
        if(typeof jayOpenPolicyFilter==='function')jayOpenPolicyFilter({region:region,category:'all',impact:'all',scope:'cross-border'});
        else if(typeof switchPage==='function')switchPage('policies');
      }else if(metric==='alert-count'){
        if(typeof jayOpenAlertsFilter==='function')jayOpenAlertsFilter({type:'all',level:'all',time:'all',search:''});
        else if(typeof switchPage==='function')switchPage('alerts');
      }
    };
  });
  if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();
}

// -- Block 2.1: 我的关注 —— 仅展示导入记录，不推导时间序列 --
function renderOvDataTable(){
  var box=$('#ov-data-table');
  if(!box) return;
  var scopedProducts=ovScopedProducts();
  if(!scopedProducts.length){
    box.innerHTML='<div class="ov-product-empty"><i data-lucide="file-up"></i><div><strong>当前范围暂无用户导入商品</strong><p>总览不会展示示例榜单或自动生成商品机会。</p></div><button type="button" id="ov-product-upload">上传数据</button></div>';
    var upload=$('#ov-product-upload');if(upload)upload.onclick=function(){if(typeof switchPage==='function')switchPage('products');};
    if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();
    return;
  }
  var rows=scopedProducts.map(function(p){
    var provided=p._provided||{};
    var hasGrowth=provided.growth!==undefined?provided.growth:String(p[9]||'').trim()!=='';
    var hasPrice=provided.rmbPrice!==undefined?(provided.rmbPrice||provided.price):String(p[7]||'').trim()!=='';
    var hasSales=provided.sales!==undefined?provided.sales:String(p[8]||'').trim()!=='';
    var g=hasGrowth?parseFloat(String(p[9]).replace(/[^0-9+\-.]/g,'')):NaN;
    var avgPrice=hasPrice?prAvgPrice(p[7]):0;
    var sales=hasSales?prParseNum(p[8]):0;
    var canDerive=hasPrice&&hasSales&&avgPrice>0;
    var gmv=canDerive?avgPrice*sales:0;
    var gmvTxt = canDerive?(gmv>=10000 ? '≈¥'+(gmv/10000).toFixed(1)+'万' : '≈¥'+gmv.toLocaleString('zh-CN')):'无法计算';
    return { icon:p[0], name:p[1], market:p[2], platform:p[3], signal:p[10],
             sales:hasSales?p[8]:'未提供', growth:hasGrowth?p[9]:'未提供', up:isFinite(g)&&g>=0,
             hasGrowth:hasGrowth&&isFinite(g), gmvTxt:gmvTxt, gnum:isFinite(g)?g:-Infinity, seed:p[1] };
  }).sort(function(a,b){ return b.gnum-a.gnum; }).slice(0,5);
  var header='<div class="ov-data-table-header"><div>商品信息</div><div>推算成交金额</div><div>销量</div><div>增长率</div><div>趋势</div><div>操作</div></div>';
  var html=header+rows.map(function(r){
    return '<div class="ov-data-table-row" data-m="'+escapeHtml(r.market)+'" data-p="'+escapeHtml(r.platform)+'">'+
      '<div class="ov-dt-product"><div class="ov-dt-img">'+escapeHtml(r.icon||'📦')+'</div><div class="ov-dt-info"><h4>'+escapeHtml(r.name)+'</h4><p>'+escapeHtml(r.platform)+' · '+escapeHtml(r.market)+'</p></div></div>'+
      '<div class="ov-dt-num">'+r.gmvTxt+'</div>'+
      '<div class="ov-dt-num">'+escapeHtml(r.sales)+'</div>'+
      '<div class="ov-dt-num '+(r.hasGrowth?(r.up?'ov-dt-up':'ov-dt-down'):'')+'">'+(r.hasGrowth?(r.up?'↑':'↓'):'')+escapeHtml(r.growth)+'</div>'+
      '<div class="ov-dt-unavailable">未提供</div>'+
      '<button type="button" class="ov-dt-action">查看</button></div>';
  }).join('');
  box.innerHTML=html;
  $$('#ov-data-table .ov-dt-action').forEach(function(b){
    b.onclick=function(){
      var row=b.closest('.ov-data-table-row');
      var api=ovScopeApi();
      var market=row.getAttribute('data-m');
      var platform=row.getAttribute('data-p');
      if(api&&api.setActiveMarket)api.setActiveMarket(market);
      if(api&&api.setActivePlatforms)api.setActivePlatforms(platform);
      if(typeof JAY_CTX!=='undefined'){JAY_CTX.country=market;JAY_CTX.platform=platform;}
      if(typeof switchPage==='function')switchPage('products');
    };
  });
}

function renderOverviewDecisionState(){
  renderOverviewScopeSummary();
  var api=ovScopeApi();
  var marketNames=api&&api.getActiveMarketNames?api.getActiveMarketNames():[];
  var marketText=marketNames.join('、')||'当前';
  var title=$('#ov-workspace-title');if(title)title.textContent=marketNames.length>1?marketNames.length+' 个市场决策工作台':marketText+'市场决策工作台';
  var copy=$('#ov-workspace-copy');if(copy)copy.textContent='汇总'+marketText+'市场内已验证的市场、平台、政策和预警数据。';

  var alertButton=$('#ov-signal-alert');
  var alertLevel=$('#ov-signal-alert-level');
  var alertTitle=$('#ov-signal-market');
  var alertCopy=$('#ov-signal-alert-copy');
  var alertState=ovDataState('alerts');
  var alertRows=ovAlertRecords();
  var highCount=alertRows.filter(function(item){return item&&item.level==='high';}).length;
  if(alertState==='ready'){
    if(alertButton)alertButton.className='signal-item '+(highCount?'risk':'neutral');
    if(alertLevel)alertLevel.textContent=highCount?highCount+' 条高风险':'无高风险';
    if(alertTitle)alertTitle.textContent=highCount?marketText+'市场存在需优先处理的预警':marketText+'市场暂无高风险预警';
    if(alertCopy)alertCopy.textContent='当前范围共 '+alertRows.length+' 条正式预警记录';
  }else{
    if(alertButton)alertButton.className='signal-item neutral';
    if(alertLevel)alertLevel.textContent=alertState==='error'?'不可用':'读取中';
    if(alertTitle)alertTitle.textContent=alertState==='error'?'预警数据读取失败':'正在读取'+marketText+'市场预警';
    if(alertCopy)alertCopy.textContent='不使用未完成加载的暂存数量';
  }

  var productRows=ovScopedProducts();
  var productLevel=$('#ov-signal-product-level');
  var productTitle=$('#ov-signal-product-title');
  var productCopy=$('#ov-signal-product-copy');
  if(productRows.length){
    if(productLevel)productLevel.textContent=productRows.length+' 条记录';
    if(productTitle)productTitle.textContent='当前范围已有用户导入商品数据';
    if(productCopy)productCopy.textContent='仅根据文件提供字段形成观察结果';
  }else{
    if(productLevel)productLevel.textContent='待数据';
    if(productTitle)productTitle.textContent='当前范围尚未导入类目数据';
    if(productCopy)productCopy.textContent='上传文件后再形成商品观察结论';
  }

  var report=typeof JAY_QUALITY_REPORT!=='undefined'?JAY_QUALITY_REPORT:null;
  var reportLevel=$('#ov-signal-report-level');
  var reportTitle=$('#ov-signal-report-title');
  var reportCopy=$('#ov-signal-report-copy');
  if(!report){
    if(reportLevel)reportLevel.textContent='核验中';
    if(reportTitle)reportTitle.textContent='正在核对报告数据';
    if(reportCopy)reportCopy.textContent='生成前检查数据完整性与时效';
  }else if(report.publishable){
    if(reportLevel)reportLevel.textContent='可发布';
    if(reportTitle)reportTitle.textContent=marketText+'市场报告数据已通过校验';
    if(reportCopy)reportCopy.textContent='报告仍会标注缺失字段和原始来源';
  }else{
    var status=typeof jayQualityStatus==='function'?jayQualityStatus(report):(report.status||'failed');
    if(reportLevel)reportLevel.textContent=status==='stale'?'已过期':'受阻断';
    if(reportTitle)reportTitle.textContent='当前数据暂不适合直接定稿';
    if(reportCopy)reportCopy.textContent='可进入报告中心查看范围，定稿前需处理数据质量问题';
  }
}

function ovOpenMarketDestination(code,destination){
  var api=ovScopeApi();
  if(api&&api.setActiveMarket)api.setActiveMarket(code);
  if(destination==='policies'){
    if(typeof jayOpenPolicyFilter==='function')jayOpenPolicyFilter({domain:'policy',region:code,category:'all',impact:'all',scope:'cross-border'});
    else if(typeof switchPage==='function')switchPage('policies');
  }else if(destination==='rules'){
    if(typeof jayOpenRulesFilter==='function')jayOpenRulesFilter({market:code,platform:'all',category:'all',impact:'all',actType:'all'});
    else if(typeof switchPage==='function')switchPage('rules');
  }else if(destination==='tax'){
    if(typeof jayOpenPolicyFilter==='function')jayOpenPolicyFilter({domain:'tax',region:code,category:'all',impact:'all',scope:'cross-border'});
    else if(typeof switchPage==='function')switchPage('policies');
  }else if(destination==='access'){
    if(typeof jayOpenPolicyFilter==='function')jayOpenPolicyFilter({domain:'access',region:code,category:'all',impact:'all',scope:'cross-border'});
    else if(typeof switchPage==='function')switchPage('policies');
  }else if(typeof switchPage==='function')switchPage(destination||'countries');
}

// -- Block 4: Country overview constrained to the configured market scope --
function renderOvCountries(){
  var grid=$('#ov-country-grid');
  if(!grid) return;
  var api=window.JAY_MARKET_SCOPE_API;
  var activeMarkets=api&&api.getActiveMarkets?api.getActiveMarkets():[];
  var activeCodes=activeMarkets.map(function(m){return m.code;});
  var activeNames=activeMarkets.map(function(m){return m.name||m.label||m.code;});
  var source=(typeof countries!=='undefined'&&Array.isArray(countries))?countries:[];
  var scoped=source.filter(function(c){
    if(!c)return false;
    var value=c[1]||c.market||c.country;
    var code=api&&api.normalizeMarketCode?api.normalizeMarketCode(value):String(value||'').toUpperCase();
    return activeCodes.indexOf(code)>=0 || activeNames.indexOf(value)>=0;
  });
  if(!scoped.length){
    grid.innerHTML='<div class="empty-state"><p>暂无通过校验的当前市场档案</p></div>';
    return;
  }
  var policyRows=ovPolicyRecords();
  var alertRows=ovAlertRecords();
  var policyReady=ovDataState('policies')==='ready';
  var alertReady=ovDataState('alerts')==='ready';
  grid.innerHTML=scoped.map(function(c){
    var flag=escapeHtml(c[0]||'🌐');
    var name=escapeHtml(c[1]||activeNames[0]||'当前市场');
    var code=api&&api.normalizeMarketCode?api.normalizeMarketCode(c[1]):(activeCodes[0]||'');
    var commerceState=typeof window.jayGetCountryCommerceState==='function'?window.jayGetCountryCommerceState(code):{status:'idle',count:0};
    var commerceLabel=commerceState.status==='ready'?commerceState.count+' 项':(commerceState.status==='loading'?'加载中':(commerceState.status==='error'?'读取失败':'尚未接入'));
    var platformCount=api&&api.getMarketPlatforms?api.getMarketPlatforms(code).length:0;
    var policyCount=policyRows.filter(function(row){return ovMarketCode(row&&(row.region||row.market||row.market_code))===code;}).length;
    var alertCount=alertRows.filter(function(row){return ovMarketCode(row&&(row.country||row.region||row.market))===code;}).length;
    return '<article class="ov-ccard" data-market-code="'+escapeHtml(code)+'"><div class="ov-ccard-top"><span class="flag">'+flag+'</span><div><h3>'+name+'</h3><p class="ov-ccard-sub">当前范围 · '+escapeHtml(code)+'</p></div></div>'+
      '<div class="ov-ccard-metrics"><div><span>电商指标</span><b>'+escapeHtml(commerceLabel)+'</b></div><div><span>平台</span><b>'+platformCount+' 个</b></div><div><span>政策</span><b>'+(policyReady?policyCount:'—')+'</b></div><div><span>预警</span><b>'+(alertReady?alertCount:'—')+'</b></div></div>'+
      '<div class="ov-ccard-actions"><button class="ov-ccard-btn primary" data-destination="countries"><i data-lucide="globe-2"></i>市场档案</button><button class="ov-ccard-btn" data-destination="policies"><i data-lucide="landmark"></i>政策</button><button class="ov-ccard-btn" data-destination="rules"><i data-lucide="scroll-text"></i>规则</button><button class="ov-ccard-btn" data-destination="tax"><i data-lucide="receipt-text"></i>税收关税</button><button class="ov-ccard-btn" data-destination="access"><i data-lucide="badge-check"></i>市场准入</button><button class="ov-ccard-btn" data-destination="report"><i data-lucide="file-chart-column"></i>报告</button></div></article>';
  }).join('');
  $$('#ov-country-grid .ov-ccard-btn').forEach(function(btn){btn.onclick=function(e){
    e.stopPropagation();
    var card=btn.closest('.ov-ccard');
    var cardCode=card&&card.dataset.marketCode?card.dataset.marketCode:(activeCodes[0]||'');
    ovOpenMarketDestination(cardCode,btn.dataset.destination);
  };});
  $$('#ov-country-grid .ov-ccard').forEach(function(card){card.onclick=function(){
    if(api&&api.setActiveMarket)api.setActiveMarket(card.dataset.marketCode||'');
    if(typeof switchPage==='function')switchPage('countries');
  };});
  if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();
}
function renderDecisionOverview(){
  renderOverviewScopeControl();
  renderOverviewMetrics();
  renderOvDataTable();
  renderOvCountries();
  renderOverviewDecisionState();
}
window.renderOverviewMetrics=renderOverviewMetrics;
window.renderOvDataTable=renderOvDataTable;
window.renderOvCountries=renderOvCountries;
window.renderOverviewDecisionState=renderOverviewDecisionState;
window.renderDecisionOverview=renderDecisionOverview;
renderDecisionOverview();
if(window.addEventListener) window.addEventListener('jay:market-scope-change', renderDecisionOverview);
} catch(e) { if(window.console)console.error('[JAY观海] overview initialization failed:', e); }
