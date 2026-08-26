// ========== CONTENT PAGE - FULL REBUILD ==========
var ctSelected = new Set();
var ctActiveAI = 'convert';
var ctActiveMain = 'all';
var ctFavFolders = [];
var ctFavItems = {};

// AI Insight data
var ctAiConvert = [
  {title:'中东开箱直播转化率高达15%', desc:'TikTok中东站开箱视频品类平均转化率15%，远超短视频均值6.8%。@LuxuryDubai 香水开箱单条120万赞/1800万播放。推荐打法：阿拉伯语+奢华场景+产品特写+限时折扣引导。', source:'内容详情', time:'今日', idx:5},
  {title:'欧美"前后对比"脚本爆量', desc:'TikTok欧美站"前后对比"类脚本转化率均值12.3%，LED灯带改造视频280万赞/3500万播放。美妆、家居品类最适合此脚本，3秒hook+15秒过程+5秒效果展示为标准结构。', source:'内容详情', time:'今日', idx:9},
  {title:'东南亚美妆短视频+直播组合拳', desc:'Shopee Video + TikTok双渠道投放，美妆品类转化率均值8.5%。@KBeauty_ID 定妆喷雾横评视频12.3%转化率，直播+短视频组合ROI高于纯直播2.1倍。', source:'内容详情', time:'7日', idx:27},
  {title:'日韩"挑战类"内容长尾效应强', desc:'@BeautyJP "7天美白挑战"170万赞/2500万播放，此类内容30天持续引流，适合面膜、美容仪等需使用周期验证的产品。', source:'内容详情', time:'30日', idx:17}
];
var ctAiTrend = [
  {title:'热门BGM：TikTok全球 "Espresso Bomb" 挑战', desc:'Sabrina Carpenter新歌Espresso引发全球变装/产品展示挑战，美妆+时尚品类参与量+340%。建议立即用此BGM制作产品展示短视频。', source:'趋势分析', time:'今日', idx:0},
  {title:'脚本趋势："3秒法则"开头成标配', desc:'2026年7月全球爆款视频90%采用3秒hook开头：产品特写+反常识文案+悬念提问。慢开头视频完播率下降62%。', source:'趋势分析', time:'7日', idx:0},
  {title:'封面构图趋势：分屏对比+大字标题', desc:'爆款视频封面85%采用左右分屏对比或产品居中+3行大字标题。纯色背景+产品特写点击率最高。', source:'趋势分析', time:'7日', idx:0},
  {title:'本土化选题：斋月/开斋节内容提前30天布局', desc:'中东市场斋月相关种草内容需提前30天发布，提前15天流量下降50%。当前距下个斋月还有8个月，可开始素材储备。', source:'趋势分析', time:'30日', idx:0}
];
var ctAiRisk = [
  {title:'TikTok欧美站"伪科学护肤"内容限流', desc:'近期TikTok欧美站对未经证实的护肤功效宣称（如"7天美白""永久脱毛"）实施限流，相关视频曝光量下降40-60%。建议规避绝对化用语，改用"使用记录""个人体验"表述。', source:'预警中心', time:'今日', idx:0},
  {title:'Shopee东南亚直播违规话术高发', desc:'Shopee Video东南亚站近7天下架违规直播间23个，主要原因：虚假折扣宣称（标原价虚假）、引导站外交易、未标注广告性质。建议直播话术严格审核。', source:'预警中心', time:'7日', idx:0},
  {title:'Instagram Reels 带货内容算法调整', desc:'Instagram近期降低Reels中直接展示价格/促销信息的内容推荐权重，软性种草内容获得更高推荐。建议调整Instagram内容策略，减少硬广感。', source:'预警中心', time:'7日', idx:0}
];

// Live data
var ctLiveData = [
  {title:'GLOW LAB 东南亚美妆直播专场', creator:'@BeautyVibe_TH', platform:'TikTok', market:'东南亚', peakViewers:'12,500', totalViews:'85,000', gmv:'US$ 4.2万', products:'美白身体乳/防晒霜/面膜', style:'教学+试用+限时秒杀', duration:'3小时', date:'2026-07-15'},
  {title:'Medicube 美区年中大促直播', creator:'@BeautyGuru_Maya', platform:'TikTok', market:'欧美', peakViewers:'28,000', totalViews:'156,000', gmv:'US$ 18.5万', products:'胶原蛋白眼膜/EMS美容仪', style:'专业测评+科学背书+粉丝互动', duration:'4小时', date:'2026-07-14'},
  {title:'BigHome Brasil 巴西破纪录直播', creator:'@BigHomeBrasil', platform:'TikTok', market:'拉美', peakViewers:'45,000', totalViews:'320,000', gmv:'R$ 515K (US$ 100K+)', products:'家居家电全品类', style:'娱乐+抽奖+超低价秒杀', duration:'6小时', date:'2026-07-13'},
  {title:'SKIN1004 新加坡品牌周', creator:'@KBeauty_SG', platform:'Shopee Live', market:'东南亚', peakViewers:'8,200', totalViews:'52,000', gmv:'US$ 3.8万', products:'Centella系列全线', style:'品牌故事+成分科普+买赠', duration:'2.5小时', date:'2026-07-12'},
  {title:'Aecooly 印尼大促爆款直播', creator:'@GadgetID', platform:'Shopee Live', market:'东南亚', peakViewers:'15,000', totalViews:'98,000', gmv:'US$ 6.5万', products:'挂颈风扇/迷你空调', style:'场景演示+极端测试+限量折扣', duration:'3小时', date:'2026-07-11'}
];

function ctSwitchAI(tab) {
  ctActiveAI = tab;
  document.querySelectorAll('.ct-ai-tab').forEach(function(b){b.classList.toggle('active', b.dataset.aitab===tab)});
  ctRenderAI();
}

function ctRenderAI() {
  var list = ctActiveAI === 'convert' ? ctAiConvert : ctActiveAI === 'trend' ? ctAiTrend : ctAiRisk;
  var el = document.getElementById('ct-ai-content');
  if(!el) return;
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
    return; // disabled v4 2026-08-21

  var plats=[], markets=[], types=[], cats=[];
  contentData.forEach(function(c) {
    if(plats.indexOf(c[1])<0) plats.push(c[1]);
    if(markets.indexOf(c[2])<0) markets.push(c[2]);
    if(types.indexOf(c[3])<0) types.push(c[3]);
    if(cats.indexOf(c[10])<0) cats.push(c[10]);
  });
  function fillOpts(sel, arr) { if(!sel) return; arr.forEach(function(v){ var o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); }); }
  fillOpts(document.getElementById('ct-f-platform'), plats);
  fillOpts(document.getElementById('ct-f-market'), markets);
  fillOpts(document.getElementById('ct-f-type'), types);
  fillOpts(document.getElementById('ct-f-cat'), cats);

  ['ct-f-platform','ct-f-market','ct-f-type','ct-f-cat','ct-f-tier','ct-f-signal','ct-f-period','ct-f-sort'].forEach(function(id){
    document.getElementById(id).addEventListener('change', ctApplyFilters);
  });
  document.getElementById('ct-f-keyword').addEventListener('input', jayDeb('ctApplyFilters'));

  // Creator filters
  fillOpts(document.getElementById('ct-cr-platform'), plats);
  fillOpts(document.getElementById('ct-cr-market'), markets);
  var crCats = [];
  contentData.forEach(function(c){ if(crCats.indexOf(c[10])<0) crCats.push(c[10]); });
  fillOpts(document.getElementById('ct-cr-cat'), crCats);
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

  // 伪时长（基于 idx 生成）
  var secs = ((idx || 0) * 17 + 23) % 60;
  var mins = 1 + ((idx || 0) * 7) % 4;
  var duration = mins + ':' + String(secs).padStart(2, '0');

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

  // 7-day trend data
  var trendData = [];
  var basePlays = plays / 7;
  for(var i=0; i<7; i++) {
    trendData.push(Math.max(0, basePlays * (0.5 + Math.random())));
  }
  var maxTrend = Math.max.apply(null, trendData);

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

  // Block 2: 7-day trend
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px">📈 7天数据走势</h4>';
  html += '<div style="display:flex;align-items:end;gap:4px;height:80px">';
  trendData.forEach(function(v,i) {
    var h = Math.max(4, (v/maxTrend)*70);
    html += '<div style="flex:1;height:' + h + 'px;background:var(--green);border-radius:2px 2px 0 0" title="Day ' + (i+1) + ': ' + v.toFixed(0) + '万播放"></div>';
  });
  html += '</div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px"><span>7天前</span><span>今日</span></div>';
  html += '<div style="margin-top:8px;font-size:12px">';
  html += '播放 <b>' + plays + '万</b> | 点赞 <b>' + likes + '万</b> | 转化 <b>' + c[9] + '%</b>';
  html += '</div></div>';

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
    resultEl.innerHTML='<div class="ovr-card"><div class="ovr-head"><span>🤖</span><h4>AI 正在分析「'+escapeHtml(q)+'」<small>结合 26 国 '+JAY_PLATFORM_COUNT+' 平台数据</small></h4></div>'+
      '<div class="ovr-steps">'+
        '<div class="ovr-step" data-step="1"><span class="ovr-dot">1</span><div><b>关键词解析</b><small>理解你的品类与市场意图</small></div></div>'+
        '<div class="ovr-step" data-step="2"><span class="ovr-dot">2</span><div><b>匹配市场 / 政策 / 规则</b><small>交叉检索 26 国 + '+JAY_PLATFORM_COUNT+' 平台</small></div></div>'+
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

  function inferTags(q){
    var lower=q.toLowerCase(), tags=[];
    var regionMap={'东南亚':['越南','泰国','印尼','马来西亚','菲律宾','新加坡','东南亚'],'北美':['美国','加拿大','墨西哥','北美'],'欧洲':['欧洲','欧盟','英国','德国','法国','意大利','西班牙','荷兰'],'中东':['中东','沙特','阿联酋','迪拜','土耳其'],'拉美':['拉美','巴西','墨西哥','阿根廷','智利','哥伦比亚'],'南亚':['印度','巴基斯坦','孟加拉','南亚'],'非洲':['非洲','尼日利亚','南非','肯尼亚'],'日韩':['日本','韩国','日韩'],'澳洲':['澳大利亚','新西兰','澳洲']};
    Object.keys(regionMap).forEach(function(r){regionMap[r].forEach(function(w){if(lower.indexOf(w)!==-1 && tags.indexOf(r)===-1)tags.push(r);});});
    var catMap={'美妆个护':['美妆','护肤','化妆品','香水','身体乳','防晒','口红','面膜'],'3C数码':['3c','手机','耳机','蓝牙','智能手表','电子','数码'],'时尚服饰':['服装','服饰','衣服','穿搭','瑜伽裤','连衣裙'],'家居家装':['家居','家具','家装','灯','LED','收纳','厨具'],'珠宝饰品':['水晶','饰品','珠宝','首饰','项链','戒指','耳环'],'宠物用品':['宠物','狗粮','猫粮','喂食器'],'运动户外':['运动','户外','瑜伽','健身','露营'],'母婴用品':['母婴','婴儿','奶粉','纸尿裤','玩具'],'食品饮料':['食品','饮料','零食','咖啡','茶'],'汽车配件':['汽车','车载','车','配件']};
    Object.keys(catMap).forEach(function(c){catMap[c].forEach(function(w){if(lower.indexOf(w)!==-1 && tags.indexOf(c)===-1)tags.push(c);});});
    if(tags.length===0)tags.push('市场机会');
    return tags.slice(0,5);
  }

  function buildHeroResultCard(q, bodyHtml, isAI){
    var tags=inferTags(q);
    var tagHtml=tags.map(function(t){return '<span class="ovr-tag">'+escapeHtml(t)+'</span>';}).join('');
    var sourceBadge=isAI?'<small>由 DeepSeek AI 生成</small>':'<small>基于 JAY观海 内置数据规则生成</small>';
    return '<div class="ovr-card"><div class="ovr-head"><span>🤖</span><h4>分析结果：'+escapeHtml(q)+sourceBadge+'</h4></div>'+
           bodyHtml+
           '<div class="ovr-tags">'+tagHtml+'</div>'+
           '<div class="ovr-foot"><button class="primary" onclick="switchPage(\'platforms\')">查看平台详情</button><button onclick="switchPage(\'policies\')">查看政策动态</button><button onclick="switchPage(\'products\')">去选品雷达</button></div>'+
           '<div class="ovr-note">提示：结果基于当前系统数据与规则生成。登录账号后可调用服务端 AI 分析，并结合系统证据库给出来源提示。</div></div>';
  }

  function generateHeroResponseHTML(q){
    var lower=q.toLowerCase();
    var matchedCountries=[], matchedPlatforms=[], matchedPolicies=[], matchedRules=[];

    countries.forEach(function(c){
      if(lower.indexOf(c[1].toLowerCase())!==-1 || lower.indexOf(c[2].toLowerCase())!==-1)matchedCountries.push(c);
    });

    var knownPlatforms=['Amazon','Shopee','TikTok Shop','Lazada','Noon','Temu','SHEIN','AliExpress','MercadoLibre','Jumia','eBay','Tokopedia','Trendyol','Hepsiburada'];
    knownPlatforms.forEach(function(p){if(lower.indexOf(p.toLowerCase())!==-1)matchedPlatforms.push(p);});

    policyData.forEach(function(p){if(lower.indexOf(p[0].toLowerCase())!==-1 || lower.indexOf(p[1].toLowerCase())!==-1)matchedPolicies.push(p);});

    rulesData.forEach(function(r){if(lower.indexOf(r[0].toLowerCase())!==-1 || lower.indexOf(r[1].toLowerCase())!==-1 || lower.indexOf(r[2].toLowerCase())!==-1 || lower.indexOf(r[4].toLowerCase())!==-1)matchedRules.push(r);});

    var bodyHtml='';

    if(matchedCountries.length>0 || matchedPlatforms.length>0){
      bodyHtml+='<div class="ovr-section"><h5>🌍 市场机会判断</h5><ul>';
      matchedCountries.slice(0,3).forEach(function(c){
        var growth=parseFloat(c[4])||0;
        bodyHtml+='<li><b>'+c[1]+'</b>：市场容量约 '+c[3]+'，年增速 '+c[4]+'，主要平台为 '+c[5]+'。';
        if(growth>15)bodyHtml+='属于高增长市场，适合作为新市场切入点。';
        else if(growth>8)bodyHtml+='增长稳健，适合成熟品类稳步扩张。';
        else bodyHtml+='市场成熟但增速放缓，建议以品牌/差异化切入。';
        bodyHtml+='</li>';
      });
      matchedPlatforms.slice(0,3).forEach(function(p){
        bodyHtml+='<li><b>'+p+'</b>：可在「平台规则」与「电商平台档案」中查看其最新佣金、物流、类目限制政策。</li>';
      });
      bodyHtml+='</ul></div>';
    }else{
      var topGrowth=countries.slice().sort(function(a,b){return parseFloat(b[4])-parseFloat(a[4]);}).slice(0,3);
      bodyHtml+='<div class="ovr-section"><h5>🌍 当前未直接收录「'+escapeHtml(q)+'」的细分数据，可参考高潜力市场</h5><ul>';
      topGrowth.forEach(function(c){
        bodyHtml+='<li><b>'+c[1]+'</b>：市场容量 '+c[3]+'，增速 '+c[4]+'，主流平台 '+c[5]+'。适合对高增长市场敏感的品类。</li>';
      });
      bodyHtml+='</ul></div>';
    }

    if(matchedPolicies.length>0 || matchedRules.length>0){
      bodyHtml+='<div class="ovr-section"><h5>⚠️ 风险提醒</h5><ul>';
      matchedPolicies.slice(0,3).forEach(function(p){
        bodyHtml+='<li><b>'+p[1]+' · '+p[0]+'</b>（'+p[3]+'）：'+(p[8]?p[8].substring(0,80):'')+'…</li>';
      });
      matchedRules.slice(0,3).forEach(function(r){
        bodyHtml+='<li><b>'+r[0]+' · '+r[1]+'</b>：'+r[5]+'。建议：'+r[6]+'</li>';
      });
      bodyHtml+='</ul></div>';
    }else{
      bodyHtml+='<div class="ovr-section"><h5>⚠️ 近期值得关注的政策风向</h5><ul>';
      alerts.slice(0,3).forEach(function(a){
        bodyHtml+='<li><b>'+a[1]+'</b>：'+a[2]+'（'+a[3]+'）</li>';
      });
      bodyHtml+='</ul></div>';
    }

    bodyHtml+='<div class="ovr-section"><h5>💡 建议下一步</h5><ul>';
    if(matchedCountries.length===0)bodyHtml+='<li>把问题聚焦到具体国家或平台，例如「水晶饰品在东南亚有没有机会」或「Shopee 美妆类目入驻要求」，可获得更精准分析。</li>';
    bodyHtml+='<li>前往「国家市场」查看目标市场的 GDP、关税、物流等宏观数据。</li>';
    bodyHtml+='<li>前往「平台规则」确认佣金、物流、类目限制的最新变动。</li>';
    bodyHtml+='<li>在「选品雷达」中搜索相似品类，观察竞品定价与爆款特征。</li>';
    bodyHtml+='</ul></div>';

    return buildHeroResultCard(q, bodyHtml, false);
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
        var card = buildHeroResultCard(q, bodyHtml, true);
        if(rag.sources && rag.sources.length){
          card = card.replace('<div class="ovr-note">', '<div class="ovr-note">📚 检索来源：' + rag.sources.join(' · ') + '（演示检索，基于系统内置数据）。\n\n');
        }
        resultEl.innerHTML=card;
        finish();
        return;
      }catch(e){/* fall through to rule-based */}
    }
    // Rule-based fallback / demo mode
    await delay(320);
    setHeroStep(2);
    await delay(380);
    setHeroStep(3);
    resultEl.innerHTML=generateHeroResponseHTML(q);
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
  window.getMacroForCountry = getMacroForCountry;
  window.getPolicyForCountry = getPolicyForCountry;
  window.pfExtData = pfExtData;
  window.hasRiskPolicy = hasRiskPolicy;
})();

try {
// -- Block 2: Plain KPI metric cards --
(function(){
  var countryCount=typeof countries!=='undefined'&&Array.isArray(countries)?countries.length:0;
  var platformCount=typeof platformsData!=='undefined'&&Array.isArray(platformsData)?platformsData.length:(typeof JAY_PLATFORM_COUNT!=='undefined'?JAY_PLATFORM_COUNT:0);
  var productCount=typeof products!=='undefined'&&Array.isArray(products)?products.length:0;
  var policyRuleCount=(typeof policyData!=='undefined'&&Array.isArray(policyData)?policyData.length:0)+(typeof rulesData!=='undefined'&&Array.isArray(rulesData)?rulesData.length:0);
  var metrics=[
    {icon:'🌍',label:'监测覆盖国家',val:String(countryCount),sub:'当前国家档案',color:'#3b7ab8'},
    {icon:'▣',label:'接入电商平台',val:String(platformCount),sub:'当前平台档案',color:'#4d946e'},
    {icon:'📦',label:'有效商品样本',val:String(productCount),sub:'页面可核验记录',color:'#c39142'},
    {icon:'📋',label:'政策与规则',val:String(policyRuleCount),sub:'页面可核验记录',color:'#e65757'}
  ];
  var ovMetrics = $('#ov-metrics');
  if(ovMetrics) ovMetrics.innerHTML=metrics.map(function(m){
    return '<div class="ov-metric-card"><div class="ov-metric-icon" style="background:linear-gradient(135deg,'+m.color+'22,'+m.color+'0f)">'+m.icon+'</div><div class="ov-metric-info"><div class="ov-metric-val">'+m.val+'</div><h3>'+m.label+'</h3><div class="ov-metric-sub">'+m.sub+'</div></div></div>';
  }).join('');
})();

// -- Block 2.1: 我的关注 —— 真实数据驱动（取自产品全域雷达 products 数据集，按增速 Top5）--
function jaySparkline(growthPct, seedStr){
  var up=growthPct>=0, w=64, h=24, pad=2, n=10;
  var seed=0; for(var i=0;i<seedStr.length;i++) seed=(seed*31+seedStr.charCodeAt(i))>>>0;
  function rnd(){ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }
  var start=100, end=100*(1+growthPct/100), vals=[];
  for(var i=0;i<n;i++){
    var t=i/(n-1), base=start+(end-start)*t;
    var wig=(rnd()-0.5)*Math.abs(growthPct)*0.15;
    vals.push(base+wig);
  }
  var minV=Math.min.apply(null,vals), maxV=Math.max.apply(null,vals);
  var pts=vals.map(function(v,i){var x=pad+i*(w-2*pad)/(n-1);var y=h-pad-(maxV===minV?0.5:(v-minV)/(maxV-minV))*(h-2*pad);return x.toFixed(1)+','+y.toFixed(1);}).join(' ');
  return '<svg class="ov-dt-spark" viewBox="0 0 '+w+' '+h+'"><polyline points="'+pts+'" fill="none" stroke="'+(up?'#e65757':'#478067')+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
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
    var spark=jaySparkline(r.gnum, r.seed);
    return '<div class="ov-data-table-row" data-m="'+escapeHtml(r.market)+'" data-p="'+escapeHtml(r.platform)+'">'+
      '<div class="ov-dt-product"><div class="ov-dt-img">'+r.icon+'</div><div class="ov-dt-info"><h4>'+escapeHtml(r.name)+'</h4><p>'+escapeHtml(r.platform)+' · '+escapeHtml(r.market)+'</p></div></div>'+
      '<div class="ov-dt-num">'+r.gmvTxt+'</div>'+
      '<div class="ov-dt-num">'+r.sales+'</div>'+
      '<div class="ov-dt-num '+(r.up?'ov-dt-up':'ov-dt-down')+'">'+(r.up?'↑':'↓')+r.growth+'</div>'+
      '<div>'+spark+'</div>'+
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

// -- Block 2: SVG trend line (switchable) --
var ovTrendData={
  7:[289,295,299,291,288,295,299],
  30:[220,225,228,224,230,236,233,240,245,242,248,253,250,256,260,258,264,268,265,272,276,274,280,284,282,288,291,289,295,299],
  90:[180,185,188,192,190,195,198,196,200,205,202,208,212,210,215,218,216,220,225,228,224,230,236,233,240,245,242,248,253,250,256,260,258,264,268,265,272,276,274,280,284,282,288,291,289,295,299,285,278,272,268,275,280,276,282,288,285,290,294,291,296,299,288,282,278,285,290,286,292,296,293,298,295,299,288,280,275,282,288,284,290,295,292,298,299]
};
var ovTrendLabels={7:'近 7 日',30:'近 30 日',90:'近 90 日'};
var ovTrendConclusions={7:'近 7 日数据增量平稳，美妆类目持续领跑',30:'近 30 日全球美妆、家居类目商品数据增量涨幅最高',90:'近 90 日整体增幅超 66%，家居与美妆品类贡献最大增量'};
function renderTrendSVG(days){
  var svg=$('#ov-trend-svg');if(!svg)return;
  var vals=ovTrendData[days];
  var pts=[];var w=800,h=100,pad=10;
  var minV=Math.min.apply(null,vals)-10,maxV=Math.max.apply(null,vals)+10;
  for(var i=0;i<vals.length;i++){var x=pad+i*(w-2*pad)/(vals.length-1);var y=h-pad-(vals[i]-minV)/(maxV-minV)*(h-2*pad);pts.push(x.toFixed(1)+','+y.toFixed(1));}
  var area=pts.join(' ')+' '+(w-pad)+','+(h-pad)+' '+pad+','+(h-pad);
  var startV=vals[0],endV=vals[vals.length-1];
  svg.innerHTML='<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2c5f8a" stop-opacity="0.3"/><stop offset="100%" stop-color="#2c5f8a" stop-opacity="0.02"/></linearGradient></defs><polygon points="'+area+'" fill="url(#trendGrad)"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="#2c5f8a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+pad+'" cy="'+(h-pad-(vals[0]-minV)/(maxV-minV)*(h-2*pad)).toFixed(1)+'" r="4" fill="#2c5f8a"/><circle cx="'+(w-pad)+'" cy="'+(h-pad-(vals[vals.length-1]-minV)/(maxV-minV)*(h-2*pad)).toFixed(1)+'" r="4" fill="#3b7ab8"/><text x="'+(pad+6)+'" y="'+(h-pad-(vals[0]-minV)/(maxV-minV)*(h-2*pad)-8).toFixed(1)+'" font-size="11" fill="#2c5f8a" font-family="DM Mono">'+startV+'万</text><text x="'+(w-pad-40)+'" y="'+(h-pad-(vals[vals.length-1]-minV)/(maxV-minV)*(h-2*pad)-8).toFixed(1)+'" font-size="11" fill="#3b7ab8" font-family="DM Mono">'+endV+'万</text>';
  var badge=$('#ov-trend-badge');if(badge)badge.textContent=ovTrendLabels[days];
  var label=$('#ov-trend-range-label');if(label)label.textContent='起点 '+startV+' 万 → 终点 '+endV+' 万';
  var conclusion=$('#ov-trend-conclusion');if(conclusion)conclusion.textContent='📊 '+ovTrendConclusions[days];
}
var ovTrendRange=$('#ov-trend-range');
if(ovTrendRange){
  renderTrendSVG(30);
  ovTrendRange.onclick=function(e){var btn=e.target.closest('button');if(!btn)return;$$('.ov-trend-range button').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');renderTrendSVG(parseInt(btn.dataset.days));};
}
var ovTrendAiBtn=$('#ov-trend-ai-btn');
if(ovTrendAiBtn)ovTrendAiBtn.onclick=function(){toast('AI 趋势分析：近 30 日全球美妆、家居类目数据增量涨幅最高，建议重点关注东南亚和欧美市场')};

// -- Block 3: Tabbed opportunities --
var ovOppData=[
  {
    title:'东南亚美妆品类 7 日 GMV 增幅 <em>+42.8%</em>',
    stats:[
      {icon:'🏪',val:'8 个',label:'涉及平台'},
      {icon:'🔥',val:'3 个',label:'爆发单品'},
      {icon:'📦',val:'5 个',label:'头部带货店铺'},
      {icon:'📋',val:'利好',label:'本土关税政策'}
    ]
  },
  {
    title:'非洲 & 拉美市场电商增速领跑 <em>+25%~42%</em>',
    stats:[
      {icon:'🌍',val:'6 国',label:'高增长市场'},
      {icon:'📈',val:'+45%',label:'尼日利亚 GMV 增速'},
      {icon:'🏪',val:'12 个',label:'活跃店铺'},
      {icon:'💡',val:'蓝海',label:'市场竞争度'}
    ]
  },
  {
    title:'越南/菲律宾 GDP 增速领先 <em>5.8%~6.5%</em>',
    stats:[
      {icon:'📋',val:'5 项',label:'利好政策'},
      {icon:'🇻🇳',val:'6.5%',label:'越南 GDP 增速'},
      {icon:'🇵🇭',val:'5.8%',label:'菲律宾 GDP 增速'},
      {icon:'💰',val:'10%',label:'越南 VAT 税率'}
    ]
  },
  {
    title:'美国对华关税升至 145% · <em>全品类影响</em>',
    stats:[
      {icon:'⚠️',val:'12 项',label:'高风险政策'},
      {icon:'🇺🇸',val:'145%',label:'对华关税税率'},
      {icon:'🇮🇩',val:'取消',label:'印尼免税门槛'},
      {icon:'🇮🇳',val:'收紧',label:'印度 FDI 限制'}
    ]
  }
];
var ovOppActions=[
  {btn:'查看爆款榜单 →',page:'products'},
  {btn:'进入国家档案 →',page:'countries'},
  {btn:'查看完整政策 →',page:'policies'},
  {btn:'查看政策 AI 解读 →',page:'policies'}
];
function renderOvOpp(idx){
  var content=$('#ov-opp-content');if(!content)return;
  var d=ovOppData[idx];
  var isRisk=idx===3;
  var html='<div class="ov-opp-title">'+(isRisk?'<span class="risk-highlight">':'')+d.title+(isRisk?'</span>':'')+'</div>';
  html+='<div class="ov-opp-stats">';
  d.stats.forEach(function(s){
    var valHtml=s.val;
    if(isRisk&&(s.val.includes('145')||s.val.includes('12'))){valHtml='<span class="risk-highlight">'+s.val+'</span>';}
    html+='<div class="ov-opp-stat"><div class="stat-icon">'+s.icon+'</div><span class="stat-val">'+valHtml+'</span><span class="stat-label">'+s.label+'</span></div>';
  });
  html+='</div>';
  var act=ovOppActions[idx];
  html+='<div class="ov-opp-card-actions"><button class="ov-opp-btn ov-opp-btn-primary" id="ov-opp-action1">'+act.btn+'</button><button class="ov-opp-btn ov-opp-btn-ghost" id="ov-opp-action2">下载市场机会报告</button></div>';
  html+='<button class="ov-opp-subscribe-btn" id="ov-opp-subscribe">🔔 订阅该赛道提醒</button>';
  content.innerHTML=html;
  $('#ov-opp-action1').onclick=function(){toast('正在跳转…');setTimeout(function(){switchPage(act.page)},600)};
  $('#ov-opp-action2').onclick=function(){toast('PRO 版功能：一键下载定制化市场分析报告')};
  $('#ov-opp-subscribe').onclick=function(){toast('已开启赛道提醒，市场异动将第一时间通知您')};
}
var ovOppTabs=$('#ov-opp-tabs');
if(ovOppTabs){
  renderOvOpp(0);
  ovOppTabs.onclick=function(e){
    var tab=e.target.closest('.ov-opp-tab');
    if(!tab)return;
    $$('.ov-opp-tab').forEach(function(t){t.classList.remove('active')});
    tab.classList.add('active');
    renderOvOpp(parseInt(tab.dataset.tab));
  };
}

// N-03/N-04 市场机会洞察 Tab 过滤
function ovInsightFilter(level){
  var grid=document.getElementById('ov-insights-grid');
  if(grid){
    grid.querySelectorAll('.ov-insight-card').forEach(function(card){
      var lv=card.dataset.level;
      var show = level==='all' || lv===level || (level==='immediate' && lv==='prep');
      card.style.display = show ? '' : 'none';
    });
  }
  var tabs=document.getElementById('ov-insight-tabs');
  if(tabs) tabs.querySelectorAll('.ov-insight-tab').forEach(function(t){
    t.classList.toggle('active', t.dataset.level===level);
  });
}

// -- Block 4: Country overview with region filters --
var ovRegionMap={
  '东南亚':['印度尼西亚','越南','泰国','马来西亚','菲律宾','新加坡'],
  '欧美':['加拿大','法国','意大利','西班牙','荷兰','澳大利亚','美国','英国','德国'],
  '日韩':['日本','韩国'],
  '中东':['沙特阿拉伯','阿联酋'],
  '拉美':['巴西','墨西哥'],
  '非洲':['尼日利亚','南非','埃及'],
  '南亚':['印度']
};
var ovRegions=['全部','东南亚','欧美','日韩','中东','拉美','非洲','南亚'];

// Country name to macroData short name mapping
var ovCountryMacroMap={'印度尼西亚':'印尼','美国':'美国','越南':'越南','泰国':'泰国','马来西亚':'马来西亚','菲律宾':'菲律宾','沙特阿拉伯':'沙特','阿联酋':'阿联酋','巴西':'巴西','墨西哥':'墨西哥','日本':'日本','韩国':'韩国','德国':'德国','英国':'英国','法国':'法国','印度':'印度','尼日利亚':'尼日利亚','埃及':'埃及','南非':'南非','加拿大':'加拿大','意大利':'意大利','西班牙':'西班牙','荷兰':'荷兰','澳大利亚':'澳大利亚','俄罗斯':'俄罗斯','新加坡':'新加坡'};

// Categories per country from products data
var ovCountryCats={};
products.forEach(function(p){
  var region=p[2];
  var cats=ovCountryCats[region]||(ovCountryCats[region]=[]);
  if(cats.indexOf(p[4])===-1&&cats.length<5)cats.push(p[4]);
});

// Assign categories to countries by their primary platform region
var ovCountrySpecificCats={
  '印度尼西亚':['美妆个护','服饰鞋包','家居日用'],
  '越南':['3C数码','美妆个护','家居家电'],
  '泰国':['美妆个护','服饰鞋包','食品饮料'],
  '马来西亚':['美妆个护','家居日用','3C数码'],
  '菲律宾':['美妆个护','服饰鞋包','母婴用品'],
  '新加坡':['3C数码','美妆个护','家居家电'],
  '美国':['家居家装','美妆个护','3C数码'],
  '英国':['家居家装','美妆个护','运动户外'],
  '德国':['消费电子','家用电器','时尚服饰'],
  '法国':['消费电子','美妆个护','时尚服饰'],
  '加拿大':['日用百货','电子产品','家居'],
  '意大利':['消费电子','家居家电','美妆个护'],
  '西班牙':['消费电子','家居家电','美妆个护'],
  '荷兰':['消费电子','家居家电','美妆个护'],
  '澳大利亚':['家居家电','运动户外','3C数码'],
  '日本':['家居家装','美妆个护','3C数码'],
  '韩国':['美妆个护','服饰鞋包','家居家电'],
  '沙特阿拉伯':['美妆个护','3C数码','汽车配件'],
  '阿联酋':['美妆个护','3C数码','时尚服饰'],
  '巴西':['3C数码','家居家电','美妆个护'],
  '墨西哥':['3C数码','家居家电','时尚服饰'],
  '印度':['3C数码','服饰鞋包','家居家电'],
  '尼日利亚':['电子产品','时尚服饰','美妆个护'],
  '南非':['电子产品','家居园艺','运动户外'],
  '埃及':['电子产品','时尚服饰','美妆个护'],
  '俄罗斯':['时尚服饰','家居用品','美妆个护']
};

// Get GDP/CPI for a country from macroData
function getMacroForCountry(name){
  var short=ovCountryMacroMap[name];
  if(!short)return{gdp:'—',cpi:'—'};
  var gdp='—',cpi='—';
  macroData.forEach(function(m){
    if(m[0]===short){
      if(m[1]==='GDP增速(%)')gdp=m[2]+'%';
      if(m[1]==='CPI通胀率(%)')cpi=m[2]+'%';
    }
  });
  return{gdp:gdp,cpi:cpi};
}

// Get latest policy for a country from policyData
function getPolicyForCountry(name){
  var short=ovCountryMacroMap[name];
  if(!short)return '';
  var found='';
  policyData.forEach(function(p){
    if(p[1]===short&&!found)found=p[0];
  });
  return found;
}

// Check if country has negative policies
function hasRiskPolicy(name){
  var short=ovCountryMacroMap[name];
  if(!short)return false;
  var risk=false;
  policyData.forEach(function(p){
    if(p[1]===short&&p[3]==='重大')risk=true;
  });
  return risk;
}

function getGrowthNum(growthStr){
  var n=parseFloat(growthStr.replace(/[+%]/g,''));
  return isNaN(n)?0:n;
}

// Render region filter buttons
$('#ov-country-filters').innerHTML=ovRegions.map(function(r,i){
  return '<button class="ov-region-btn'+(i===0?' active':'')+'" data-region="'+r+'">'+r+'</button>';
}).join('');

var ovAiTips={'印度尼西亚':'政策利好美妆品类，建议优先布局本土店模式','越南':'GDP增速6.5%领跑东南亚，电商渗透率快速提升中','泰国':'竞争趋于饱和，建议聚焦小众品类差异化','马来西亚':'数字服务税新规需关注，合规成本上升','菲律宾':'增速20%但基础设施薄弱，轻资产试水为宜','新加坡':'成熟市场客单高，适合品牌化打法','美国':'对华关税145%全品类承压，建议海外仓+差异化','日本':'消费饱和但跨境电商接受度高，适合精品路线','韩国':'内容电商渗透率高，短视频带货效果好','沙特阿拉伯':'VAT 15%+SABER认证门槛高，但客单价优秀','阿联酋':'5%低增值税+自由贸易区优势，中东首选落地','巴西':'Remessa Conforme新规50$以下征20%税，成本上升','墨西哥':'近岸外包趋势利好，美客多份额领先','印度':'GDP 6.8%高增但FDI限制严格，需走平台模式','尼日利亚':'通胀33.7%汇率风险大，谨慎控制库存','南非':'基础设施非洲领先，适合试水非消品类'};
var ovTagMap={'高增长':function(c){return getGrowthNum(c[4])>=15},'政策风险':function(c){return hasRiskPolicy(c[1])},'稳定市场':function(c){return getGrowthNum(c[4])<15&&!hasRiskPolicy(c[1])}};
var ovCurrentTag='全部';
$('#ov-tag-filters').innerHTML=['全部','高增长','政策风险','稳定市场'].map(function(t,i){return '<button class="ov-tag-btn'+(i===0?' active':'')+'" data-tag="'+t+'">'+t+'</button>'}).join('');
function renderOvCountries(region,tag){
  var filtered=countries;
  if(region!=='全部'){var names=ovRegionMap[region]||[];filtered=countries.filter(function(c){return names.indexOf(c[1])!==-1});}
  if(tag&&tag!=='全部'&&ovTagMap[tag]){filtered=filtered.filter(ovTagMap[tag]);}
  $('#ov-country-grid').innerHTML=filtered.map(function(c){
    var name=c[1],flag=c[0],retail=c[3],growth=c[4],platform=c[5];
    var gNum=getGrowthNum(growth);
    var isHot=gNum>=15;
    var isRisk=hasRiskPolicy(name);
    var cardClass=isHot?'hot-card':(isRisk?'risk-card':'');
    var heatLabel=isHot?'HOT 高增长':(isRisk?'风险预警':'稳定市场');
    var heatClass=isHot?'hot':(isRisk?'risk':'stable');
    var macro=getMacroForCountry(name);
    var cats=ovCountrySpecificCats[name]||['综合品类'];
    var policy=getPolicyForCountry(name);
    var aiTip=ovAiTips[name]||'';
    var html='<article class="ov-ccard '+cardClass+'">';
    if(aiTip)html+='<span class="ov-ccard-ai-icon" data-tip="'+aiTip.replace(/"/g,'&quot;')+'">✨</span>';
    html+='<div class="ov-ccard-top"><span class="flag">'+flag+'</span><div><h3>'+name+'</h3></div><span class="ov-heat '+heatClass+'">'+heatLabel+'</span></div>';
    html+='<div class="ov-ccard-metrics"><div><span>线上零售规模</span><b>'+retail+'</b></div><div><span>GDP 增速</span><b'+(macro.gdp!=='—'?' style="color:#3a6ea8"':'')+'>'+macro.gdp+'</b></div><div><span>CPI 通胀</span><b>'+macro.cpi+'</b></div></div>';
    html+='<div class="ov-ccard-cats">'+cats.slice(0,3).map(function(ct){return '<span>'+ct+'</span>'}).join('')+'</div>';
    if(policy)html+='<div class="ov-ccard-policy">📋 '+policy+'</div>';
    html+='<button class="ov-ccard-btn" data-page="countries">进入国家全景库 →</button>';
    html+='</article>';
    return html;
  }).join('');
  $$('#ov-country-grid .ov-ccard-btn').forEach(function(btn){btn.onclick=function(e){e.stopPropagation();switchPage('countries')};});
  $$('#ov-country-grid .ov-ccard').forEach(function(card){
    card.onclick=function(){switchPage('countries')};card.style.cursor='pointer';
  });
  $$('#ov-country-grid .ov-ccard-ai-icon').forEach(function(icon){
    icon.onmouseenter=function(e){
      e.stopPropagation();
      var tip=this.getAttribute('data-tip');
      var old=this.parentNode.querySelector('.ov-ai-tooltip');if(old)old.remove();
      var div=document.createElement('div');div.className='ov-ai-tooltip';div.innerHTML='✨ <b>AI 建议</b><br>'+tip;
      this.parentNode.appendChild(div);
    };
    icon.onmouseleave=function(e){var t=this.parentNode.querySelector('.ov-ai-tooltip');if(t)t.remove();};
    icon.onclick=function(e){e.stopPropagation();};
  });
}
renderOvCountries('全部','全部');
$('#ov-tag-filters').onclick=function(e){var btn=e.target.closest('.ov-tag-btn');if(!btn)return;$$('.ov-tag-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');ovCurrentTag=btn.dataset.tag;var activeRegion=$('.ov-region-btn.active');renderOvCountries(activeRegion?activeRegion.dataset.region:'全部',ovCurrentTag);};
renderOvCountries('全部');
$('#ov-country-filters').onclick=function(e){
  var btn=e.target.closest('.ov-region-btn');
  if(!btn)return;
  $$('.ov-region-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  renderOvCountries(btn.dataset.region,ovCurrentTag);
};
} catch(e) { if(window.console)console.error('[JAY观海] overview initialization failed:', e); }
