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

function ctSwitchAI(tab) {
  ctActiveAI = tab;
  document.querySelectorAll('.ct-ai-tab').forEach(function(b){b.classList.toggle('active', b.dataset.aitab===tab)});
  ctRenderAI();
}

function ctRenderAI() {
  var list = ctActiveAI === 'convert' ? ctAiConvert : ctActiveAI === 'trend' ? ctAiTrend : ctAiRisk;
  var el = document.getElementById('ct-ai-content');
  if(!el) return;
  if(!list.length){
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
  var plat = document.getElementById('ct-f-platform').value;
  var market = document.getElementById('ct-f-market').value;
  var type = document.getElementById('ct-f-type').value;
  var cat = document.getElementById('ct-f-cat').value;
  var tier = document.getElementById('ct-f-tier').value;
  var signal = document.getElementById('ct-f-signal').value;
  var period = document.getElementById('ct-f-period').value;
  var kw = document.getElementById('ct-f-keyword').value.trim().toLowerCase();
  var sort = document.getElementById('ct-f-sort').value;

  var filtered = contentData.map(function(c,i){return {c:c,idx:i};}).filter(function(o) {
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
  document.getElementById('ct-count').textContent = '(' + filtered.length + '/' + contentData.length + ')';
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
  var engage = likesW >= 1000 ? (likesW/10000).toFixed(1) + 'w' : (likesW >= 1 ? likesW + 'w' : Math.round(likesW*10)/10 + 'w');

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
    var tier = ctGetCreatorTier(c[12]);
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
        '<span>点赞 <b>' + likes + '万</b></span>' +
        '<span>播放 <b>' + plays + '万</b></span>' +
        '<span>转化率 <b>' + c[9] + '%</b></span>' +
      '</div>' +
      '<div class="ct-card-actions">' +
        '<button class="ct-act-report" data-idx="' + idx + '" title="加入报告素材">📋</button>' +
        '<button class="ct-act-fav" data-idx="' + idx + '" title="收藏">⭐</button>' +
        '<button class="ct-act-copy" data-idx="' + idx + '" title="复制标题">📎</button>' +
      '</div>' +
    '</article>';
  }).join('') || '<p style="color:#888;padding:20px">暂无匹配内容</p>';

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
  document.getElementById('ct-modal-title').textContent = ctTitle(c);
  var body = document.getElementById('ct-modal-body');
  var likes = parseFloat(c[4])||0;
  var plays = parseFloat(c[5])||0;

  var html = '';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';

  // Block 1: Script breakdown
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px">🎬 内容脚本拆解</h4>';
  html += '<div style="font-size:12px;line-height:1.8">';
  html += '<div><strong>脚本类型:</strong> ' + c[11] + '</div>';
  html += '<div><strong>内容类型:</strong> ' + c[3] + '</div>';
  html += '<div><strong>带货类目:</strong> ' + c[10] + '</div>';
  html += '<div><strong>达人层级:</strong> ' + ctGetCreatorTier(c[12]) + '</div>';
  html += '<div><strong>热门关键词:</strong> ' + c[0].split(' ').slice(0,3).join(' / ') + '</div>';
  html += '<div><strong>推荐BGM:</strong> 热门挑战曲/品类匹配曲</div>';
  html += '<div><strong>封面风格:</strong> 产品特写+大字标题+分屏对比</div>';
  html += '</div></div>';

  // Block 2: source fields
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px">📈 数据时间序列</h4>';
  html += '<p style="font-size:12px;color:var(--muted);line-height:1.7">未提供可验证的时间序列字段。当前记录：播放 ' + plays + '万 · 点赞 ' + likes + '万 · 转化 ' + c[9] + '%。</p></div>';

  // Block 3: Similar content
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px">🔗 同款内容聚合</h4>';
  var similarItems = contentData.filter(function(x,i){ return i !== idx && x[10] === c[10]; }).slice(0,4);
  if(similarItems.length === 0) {
    html += '<p style="font-size:12px;color:var(--muted)">暂无同类目同款内容</p>';
  } else {
    similarItems.forEach(function(s) {
      html += '<div style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px">';
      html += '<span>' + s[0].substring(0,25) + '...</span>';
      html += '<span style="float:right;color:var(--green)">' + s[5] + '万播放</span>';
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
  rpAddMaterial('custom',c[0],c[1]+' · '+c[2],c[3]+' 播放'+c[5]+'万 转化'+c[9]+'% 达人'+c[7]);
}
function ctBatchAddReport() {
  if(!jayCanUseUserDb()){toast('只读演示不保存素材，请登录后使用');return}
  var pool = rpGetPool();
  ctSelected.forEach(function(idx) {
    var c = contentData[idx];
    pool.push({id:Date.now()+'_'+idx,type:'custom',title:c[0],source:c[1]+' · '+c[2],summary:'播放'+c[5]+'万 转化'+c[9]+'%',addedAt:new Date().toISOString(),selected:true});
  });
  rpSavePool(pool);
  toast('已批量加入 ' + ctSelected.size + ' 条内容到报告素材');
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
  var plat = document.getElementById('ct-cr-platform').value;
  var market = document.getElementById('ct-cr-market').value;
  var cat = document.getElementById('ct-cr-cat').value;

  // Aggregate creator data
  var creators = {};
  contentData.forEach(function(c) {
    if(plat && c[1]!==plat) return;
    if(market && c[2]!==market) return;
    if(cat && c[10]!==cat) return;
    var key = c[7];
    if(!creators[key]) creators[key] = {name:key, platform:c[1], market:c[2], followers:parseFloat(c[12])||0, totalPlays:0, totalConv:0, count:0, cats:[], shop:c[13]};
    creators[key].totalPlays += parseFloat(c[5])||0;
    creators[key].totalConv += parseFloat(c[9])||0;
    creators[key].count++;
    if(creators[key].cats.indexOf(c[10])<0) creators[key].cats.push(c[10]);
  });

  var list = Object.values(creators).sort(function(a,b){ return b.followers - a.followers; });
  var tbody = document.getElementById('ct-creator-table');
  tbody.innerHTML = list.map(function(cr, i) {
    var avgPlays = (cr.totalPlays / cr.count).toFixed(0);
    var avgConv = (cr.totalConv / cr.count).toFixed(1);
    return '<tr>' +
      '<td><strong>' + (i+1) + '</strong></td>' +
      '<td>' + cr.name + '</td>' +
      '<td>' + cr.platform + '</td>' +
      '<td>' + cr.market + '</td>' +
      '<td><b>' + cr.followers + '万</b></td>' +
      '<td>' + avgPlays + '万</td>' +
      '<td>' + cr.cats.join('/') + '</td>' +
      '<td class="growth">' + avgConv + '%</td>' +
      '<td>' + cr.count + '</td>' +
      '<td><button onclick="toast(\'已添加监控: '+escInline(cr.name)+'\')" style="font-size:11px;padding:3px 8px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">+ 监控</button></td>' +
      '</tr>';
  }).join('');
}

// ========== LIVE TRACKING ==========
function ctRenderLive() {
  var grid = document.getElementById('ct-live-grid');
  if(!grid) return;
  if(!ctLiveData.length){
    grid.innerHTML='<div class="empty-state"><p>暂无已接入的直播追踪数据</p><small>未接入正式来源前保持空状态。</small></div>';
    return;
  }
  grid.innerHTML = ctLiveData.map(function(live) {
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
  var matches = contentData.filter(function(c){ return c[8].toLowerCase().indexOf(kw)>=0 || c[0].toLowerCase().indexOf(kw)>=0 || c[10].toLowerCase().indexOf(kw)>=0; });
  if(matches.length === 0) { results.innerHTML = '<p style="color:var(--muted)">未找到与 "' + kw + '" 相关的同款内容</p>'; return; }
  var html = '<p style="font-size:13px;margin-bottom:12px">找到 <b>' + matches.length + '</b> 条与 "' + kw + '" 相关的同款内容</p>';
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
  var header = '标题\t平台\t市场\t类型\t点赞(万)\t播放(万)\t日期\t创作者\t带货商品\t转化率\t类目\t脚本类型\t达人粉丝\t关联店铺\t信号';
  var rows = contentData.map(function(c){ return c.join('\t'); });
  var csv = '\uFEFF' + header + '\n' + rows.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'content_tracker_export.csv';
  a.click();
  toast('Excel导出完成');
}
function ctExportPDF() {
  var md = '# 热门内容竞品分析报告\n\n';
  md += '导出时间: ' + new Date().toLocaleString() + '\n\n';
  md += '## 内容概览\n\n';
  md += '- 追踪内容总数: ' + contentData.length + '\n';
  var plats = {};
  contentData.forEach(function(c){ plats[c[1]] = (plats[c[1]]||0)+1; });
  Object.keys(plats).forEach(function(p){ md += '- ' + p + ': ' + plats[p] + '条\n'; });
  md += '\n## 爆款内容TOP10\n\n';
  contentData.slice().sort(function(a,b){ return parseFloat(b[5])-parseFloat(a[5]); }).slice(0,10).forEach(function(c){
    md += '### ' + c[0] + '\n';
    md += '- 平台: ' + c[1] + ' | 市场: ' + c[2] + ' | 类型: ' + c[3] + '\n';
    md += '- 播放: ' + c[5] + '万 | 点赞: ' + c[4] + '万 | 转化率: ' + c[9] + '%\n';
    md += '- 达人: ' + c[7] + ' (' + c[12] + '粉) | 脚本: ' + c[11] + '\n';
    md += '- 带货: ' + c[8] + ' | 店铺: ' + c[13] + '\n\n';
  });
  if(jayPrintMarkdownReport('热门内容竞品分析报告',md,'内容与转化数据为公开样本和监测结果，请复核原始内容链接。')) toast('已打开打印页，可另存为 PDF');
}

// ========== INIT ==========
(function initContentPage() {
  if (!document.getElementById('ct-f-platform')) return;
  ctInitFilters();
  ctRenderAI();
  ctRenderTplSelect();
  ctApplyFilters();
})();



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
    resultEl.innerHTML='<div class="ovr-card"><div class="ovr-head"><span>🤖</span><h4>AI 正在分析「'+escapeHtml(q)+'」<small>结合美国市场 '+JAY_PLATFORM_COUNT+' 个平台数据</small></h4></div>'+
      '<div class="ovr-steps">'+
        '<div class="ovr-step" data-step="1"><span class="ovr-dot">1</span><div><b>关键词解析</b><small>理解你的品类与市场意图</small></div></div>'+
        '<div class="ovr-step" data-step="2"><span class="ovr-dot">2</span><div><b>匹配市场 / 政策 / 规则</b><small>交叉检索美国市场 + '+JAY_PLATFORM_COUNT+' 个平台</small></div></div>'+
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
  var exportClose = $('#export-modal-close');
  if(exportClose) exportClose.onclick=function(){$('#export-modal-overlay').classList.remove('open')};
  var exportUpgrade = $('#export-modal-upgrade');
  if(exportUpgrade) exportUpgrade.onclick=function(){$('#export-modal-overlay').classList.remove('open');toast('即将跳转至套餐页面…')};
  var exportOverlay = $('#export-modal-overlay');
  if(exportOverlay) exportOverlay.onclick=function(e){if(e.target===this)this.classList.remove('open')};
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
// -- Block 2: Plain KPI metric cards --
function renderOverviewMetrics(){
  var countryCount=window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.countryCount : 1;
  var platformCount=window.JAY_MARKET_SCOPE ? window.JAY_MARKET_SCOPE.platformCount : 4;
  var productCount=typeof products!=='undefined'&&Array.isArray(products)?products.length:0;
  var policyCount=typeof plGetJsonItems==='function'?plGetJsonItems().length:(typeof policyData!=='undefined'&&Array.isArray(policyData)?policyData.length:0);
  var ruleCount=typeof rlGetJsonItems==='function'?rlGetJsonItems().length:(typeof rulesData!=='undefined'&&Array.isArray(rulesData)?rulesData.length:0);
  var policyRuleCount=policyCount+ruleCount;
  var metrics=[
    {icon:'🌍',label:'监测覆盖国家',val:String(countryCount),sub:'当前国家档案',color:'#3b7ab8'},
    {icon:'▣',label:'接入电商平台',val:String(platformCount),sub:'当前平台档案',color:'#4d946e'},
    {icon:'📦',label:'有效商品样本',val:String(productCount),sub:'页面可核验记录',color:'#c39142',metricKey:'product-count'},
    {icon:'📋',label:'政策与规则',val:String(policyRuleCount),sub:'页面可核验记录',color:'#e65757',metricKey:'policy-rule-count'}
  ];
  var ovMetrics = $('#ov-metrics');
  if(ovMetrics) ovMetrics.innerHTML=metrics.map(function(m){
    var metricKey=m.metricKey||(m.label==='监测覆盖国家'?'country-count':(m.label==='接入电商平台'?'platform-count':''));
    return '<div class="ov-metric-card"'+(metricKey?' data-metric="'+metricKey+'"':'')+'><div class="ov-metric-icon" style="background:linear-gradient(135deg,'+m.color+'22,'+m.color+'0f)">'+m.icon+'</div><div class="ov-metric-info"><div class="ov-metric-val">'+m.val+'</div><h3>'+m.label+'</h3><div class="ov-metric-sub">'+m.sub+'</div></div></div>';
  }).join('');
  $$('#ov-metrics .ov-metric-card').forEach(function(card){
    card.style.cursor='pointer';
    card.onclick=function(){
      var route={
        'country-count':'countries',
        'platform-count':'platforms',
        'product-count':'products',
        'policy-rule-count':'policies'
      }[card.dataset.metric];
      if(route&&typeof switchPage==='function')switchPage(route);
    };
  });
}
renderOverviewMetrics();

// -- Block 2.1: 我的关注 —— 仅展示导入记录，不推导时间序列 --
function renderOvDataTable(){
  var box=$('#ov-data-table');
  if(!box) return;
  if(typeof products==='undefined'||!products.length){ box.innerHTML='<div style="padding:24px;color:var(--muted);font-size:12px">暂无产品数据</div>'; return; }
  var rows=products.map(function(p){
    var g=prParseNum(p[9]);            // 增速数值（带符号）
    var avgPrice=prAvgPrice(p[7]);      // 均价 RMB
    var sales=prParseNum(p[8]);         // 销量（去千分位）
    var gmv=avgPrice*sales;             // 估算成交金额
    var gmvTxt = gmv>=10000 ? '≈¥'+(gmv/10000).toFixed(1)+'万' : '≈¥'+gmv.toLocaleString('zh-CN');
    return { icon:p[0], name:p[1], market:p[2], platform:p[3], signal:p[10],
             sales:p[8], growth:p[9], up:g>=0, gmvTxt:gmvTxt, gnum:g, seed:p[1] };
  }).sort(function(a,b){ return b.gnum-a.gnum; }).slice(0,5);
  var header='<div class="ov-data-table-header"><div>商品信息</div><div>估算成交金额</div><div>销量</div><div>增长率</div><div>趋势</div><div>操作</div></div>';
  var html=header+rows.map(function(r){
    return '<div class="ov-data-table-row" data-m="'+escapeHtml(r.market)+'" data-p="'+escapeHtml(r.platform)+'">'+
      '<div class="ov-dt-product"><div class="ov-dt-img">'+r.icon+'</div><div class="ov-dt-info"><h4>'+escapeHtml(r.name)+'</h4><p>'+escapeHtml(r.platform)+' · '+escapeHtml(r.market)+'</p></div></div>'+
      '<div class="ov-dt-num">'+r.gmvTxt+'</div>'+
      '<div class="ov-dt-num">'+r.sales+'</div>'+
      '<div class="ov-dt-num '+(r.up?'ov-dt-up':'ov-dt-down')+'">'+(r.up?'↑':'↓')+r.growth+'</div>'+
      '<div class="ov-dt-unavailable">未提供</div>'+
      '<div class="ov-dt-action">查看</div></div>';
  }).join('');
  box.innerHTML=html;
  $$('#ov-data-table .ov-dt-action').forEach(function(b){
    b.onclick=function(){
      var row=b.closest('.ov-data-table-row');
      JAY_CTX.country=row.getAttribute('data-m');
      JAY_CTX.platform=row.getAttribute('data-p');
      switchPage('products');
    };
  });
}
renderOvDataTable();

// -- Block 4: Country overview constrained to the configured market scope --
var ovScope = window.JAY_MARKET_SCOPE || { country: {name:'美国', key:'us'}, countryCount:1 };
var ovScopeCountryName = ovScope.country && ovScope.country.name ? ovScope.country.name : '美国';
var ovScopeCountryNames = [ovScopeCountryName];
function renderOvCountries(){
  var grid=$('#ov-country-grid');
  if(!grid) return;
  var source=(typeof countries!=='undefined'&&Array.isArray(countries))?countries:[];
  var scoped=source.filter(function(c){return c&&ovScopeCountryNames.indexOf(c[1])!==-1;});
  if(!scoped.length){
    grid.innerHTML='<div class="empty-state"><p>暂无通过校验的美国市场档案</p></div>';
    return;
  }
  grid.innerHTML=scoped.map(function(c){
    var flag=escapeHtml(c[0]||'🇺🇸');
    var name=escapeHtml(c[1]||ovScopeCountryName);
    return '<article class="ov-ccard"><div class="ov-ccard-top"><span class="flag">'+flag+'</span><div><h3>'+name+'</h3><p class="ov-ccard-sub">当前范围 · US</p></div></div>'+
      '<div class="ov-ccard-metrics"><div><span>市场档案</span><b>已接入</b></div><div><span>宏观指标</span><b>待官方数据</b></div><div><span>政策联动</span><b>美国</b></div></div>'+
      '<div class="ov-ccard-actions"><button class="ov-ccard-btn" data-page="countries">进入美国市场档案 →</button><button class="ov-ccard-btn secondary" data-page="policies">查看美国政策 →</button></div></article>';
  }).join('');
  $$('#ov-country-grid .ov-ccard-btn').forEach(function(btn){btn.onclick=function(e){
    e.stopPropagation();
    if(btn.dataset.page==='policies'){
      if(typeof jayOpenPolicyFilter==='function') jayOpenPolicyFilter({region:'US',category:'all',impact:'all',scope:'cross-border'});
      else if(typeof switchPage==='function') switchPage('policies');
    } else if(typeof switchPage==='function') switchPage('countries');
  };});
  $$('#ov-country-grid .ov-ccard').forEach(function(card){card.onclick=function(){if(typeof switchPage==='function')switchPage('countries');};});
}
renderOvCountries();
} catch(e) { if(window.console)console.error('[JAY观海] overview initialization failed:', e); }
