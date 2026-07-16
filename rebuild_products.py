#!/usr/bin/env python3
"""Rebuild products page into 产品全域雷达"""

fp = '/app/data/所有对话/主对话/mercator_rework/index.html'
with open(fp, 'r', encoding='utf-8') as f:
    html = f.read()

# ============================================================
# 1. SIDEBAR: rename
# ============================================================
html = html.replace('爆款雷达 <b>44</b>', '产品全域雷达 <b>44</b>')

# ============================================================
# 2. SWITCHPAGE titles
# ============================================================
html = html.replace("products:'跨平台爆款雷达'", "products:'产品全域雷达'")

# ============================================================
# 3. CSS
# ============================================================
new_css = """
/* === Product Radar Rebuild === */
.pr-ai-tabs{display:flex;gap:0;margin-bottom:16px;background:#f0eee9;border-radius:8px;padding:3px;width:fit-content}
.pr-ai-tab{padding:8px 20px;border:none;background:none;font:12px 'Noto Sans SC';color:var(--muted);cursor:pointer;border-radius:6px;transition:.15s}
.pr-ai-tab.active{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.pr-ai-item{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f0efeb;font-size:12px;line-height:1.7}
.pr-ai-item:last-child{border-bottom:none}
.pr-ai-item span.pr-ai-text{flex:1}
.pr-ai-jump{font:10px 'DM Mono';color:var(--green);cursor:pointer;white-space:nowrap;padding:2px 8px;border:1px solid var(--green);border-radius:3px;background:none}
.pr-ai-jump:hover{background:var(--green);color:#fff}
.pr-ai-add{font-size:14px;cursor:pointer;color:var(--orange);background:none;border:none;padding:2px 4px}
.pr-ai-add:hover{transform:scale(1.2)}
.pr-tabbar{display:flex;gap:0;border-bottom:2px solid var(--line);margin-bottom:20px}
.pr-tab{padding:12px 22px;border:none;background:none;font:13px 'Noto Sans SC';color:#76837e;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:.15s}
.pr-tab.active{color:var(--ink);font-weight:600;border-bottom-color:var(--orange)}
.pr-tab:hover{color:var(--ink)}
.pr-filter-advanced{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;padding:16px;background:#f9f8f5;border-radius:8px;border:1px solid #ebe9e4}
.pr-filter-group label{display:block;font:600 10px 'DM Mono';color:#87928d;letter-spacing:.5px;margin-bottom:6px;text-transform:uppercase}
.pr-filter-group input,.pr-filter-group select{width:100%;border:1px solid var(--line);padding:7px 10px;border-radius:4px;font:12px 'Noto Sans SC';background:#fff}
.pr-filter-group .pr-range-row{display:flex;gap:6px;align-items:center}
.pr-filter-group .pr-range-row input{width:45%}
.pr-filter-group .pr-range-row span{color:var(--muted);font-size:11px}
.pr-filter-actions{display:flex;gap:8px;align-items:end;margin-top:8px;grid-column:1/-1}
.pr-save-tpl{font:11px 'Noto Sans SC';color:var(--green);background:none;border:1px solid var(--green);padding:5px 14px;border-radius:4px;cursor:pointer}
.pr-tpl-list{display:flex;gap:6px;flex-wrap:wrap;grid-column:1/-1;margin-top:4px}
.pr-tpl-chip{font:10px 'DM Mono';padding:4px 10px;background:#e8f0eb;color:var(--green);border-radius:12px;cursor:pointer;display:flex;align-items:center;gap:4px}
.pr-tpl-chip .tpl-del{font-size:12px;color:#999;cursor:pointer}
.pr-tpl-chip .tpl-del:hover{color:#e53}
.pr-batch-bar{display:none;align-items:center;gap:12px;padding:10px 16px;background:var(--ink);color:#fff;border-radius:6px;margin-bottom:12px;font-size:12px}
.pr-batch-bar.show{display:flex}
.pr-batch-bar button{background:rgba(255,255,255,.15);border:none;color:#fff;padding:5px 12px;border-radius:4px;font:11px 'Noto Sans SC';cursor:pointer}
.pr-batch-bar button:hover{background:rgba(255,255,255,.25)}
.pr-batch-count{font:600 13px 'DM Mono';color:var(--orange)}
.pr-export-group{display:flex;gap:6px;margin-left:auto}
.pr-export-btn{font:11px 'Noto Sans SC';padding:6px 14px;border-radius:4px;cursor:pointer;border:1px solid}
.pr-export-btn.excel{background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7}
.pr-export-btn.pdf{background:#fff3e0;color:#e65100;border-color:#ffcc80}
.pr-table-wrap table{width:100%;border-collapse:collapse}
.pr-table-wrap th{position:sticky;top:0;background:#faf9f6;z-index:1}
.pr-table-wrap td{vertical-align:middle}
.pr-chk{width:16px;height:16px;accent-color:var(--green);cursor:pointer}
.pr-shop-link{color:var(--green);cursor:pointer;font-size:11px;text-decoration:underline;text-underline-offset:2px}
.pr-shop-link:hover{color:var(--orange)}
.pr-dual-price{line-height:1.5}
.pr-dual-price .pr-local{font-weight:600;font-size:12px}
.pr-dual-price .pr-rmb{font:10px 'DM Mono';color:var(--muted)}
.pr-signal{display:inline-flex;align-items:center;gap:4px}
.pr-signal-dot{width:6px;height:6px;border-radius:50%}
.pr-signal-dot.burst{background:#df6f3d}
.pr-signal-dot.rise{background:#3c6c62}
.pr-signal-dot.stable{background:#999}
.pr-signal-dot.decline{background:#e53935}
.pr-time-col{font:10px 'DM Mono';color:#a0aba6;white-space:nowrap}
.pr-modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;justify-content:center;align-items:center}
.pr-modal-bg.open{display:flex}
.pr-modal{background:#fff;border-radius:10px;width:680px;max-height:85vh;overflow-y:auto;padding:28px 30px;position:relative}
.pr-modal-close{position:absolute;top:14px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:#999}
.pr-modal-close:hover{color:#333}
.pr-modal h3{font:18px 'Playfair Display';margin:0 0 4px}
.pr-modal .pr-m-sub{font:11px 'DM Mono';color:var(--muted);margin-bottom:20px}
.pr-m-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.pr-m-stat{background:#f9f8f5;padding:14px;border-radius:6px;text-align:center}
.pr-m-stat b{display:block;font:20px 'Playfair Display';color:var(--ink)}
.pr-m-stat span{font:10px 'DM Mono';color:var(--muted)}
.pr-m-chart{height:100px;background:#f9f8f5;border-radius:6px;margin-bottom:16px;display:flex;align-items:end;padding:10px 16px;gap:3px}
.pr-m-chart i{flex:1;background:var(--green);border-radius:2px 2px 0 0;min-width:4px}
.pr-m-section{margin-bottom:16px}
.pr-m-section h4{font-size:13px;margin:0 0 8px;color:var(--ink)}
.pr-m-section p{font-size:12px;color:#65726d;line-height:1.7;margin:0}
.pr-m-tags{display:flex;gap:6px;flex-wrap:wrap}
.pr-m-tag{font:10px 'DM Mono';padding:3px 8px;border-radius:10px;background:#f0eee9;color:var(--muted)}
.pr-m-tag.warn{background:#fff3e0;color:#e65100}
.pr-m-tag.ok{background:#e8f5e9;color:#2e7d32}
.pr-shop-input-row{display:flex;gap:10px;margin-bottom:16px;align-items:center}
.pr-shop-input-row select{flex:1;border:1px solid var(--line);padding:8px 12px;border-radius:4px;font:12px 'Noto Sans SC'}
.pr-shop-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.pr-shop-stat{background:#f9f8f5;padding:12px;border-radius:6px;text-align:center}
.pr-shop-stat b{font:18px 'Playfair Display';display:block}
.pr-shop-stat span{font:10px 'DM Mono';color:var(--muted)}
@media(max-width:1000px){.pr-filter-advanced{grid-template-columns:repeat(2,1fr)}.pr-m-stats{grid-template-columns:repeat(2,1fr)}.pr-modal{width:95%;padding:20px}}
@media(max-width:700px){.pr-filter-advanced{grid-template-columns:1fr}.pr-tabbar{overflow-x:auto}.pr-tab{white-space:nowrap;padding:10px 14px;font-size:12px}}
"""

html = html.replace('</style>', new_css + '\n</style>', 1)

# ============================================================
# 4. REPLACE products section HTML
# ============================================================
start_idx = html.index('<section id="products" class="page">')
end_idx = html.index('</section>', start_idx) + len('</section>')

new_products_html = '''<section id="products" class="page">
<div id="pr-ai-tabs" class="pr-ai-tabs">
  <button class="pr-ai-tab active" data-aitab="short">短期机会（7日）</button>
  <button class="pr-ai-tab" data-aitab="long">长期赛道（3月）</button>
</div>
<div id="pr-ai-content"></div>

<div class="pr-tabbar" id="pr-main-tabs">
  <button class="pr-tab active" data-tab="burst">爆发爆款榜</button>
  <button class="pr-tab" data-tab="potential">潜力新品榜</button>
  <button class="pr-tab" data-tab="competitor">竞品店铺商品库</button>
  <button class="pr-tab" data-tab="content">内容种草单品</button>
</div>

<div class="pr-shop-input-row" id="pr-shop-selector" style="display:none">
  <span style="font-size:12px;color:var(--muted)">选择竞品店铺：</span>
  <select id="pr-shop-select"><option value="">-- 请选择已监控店铺 --</option></select>
  <button class="filter-button" id="pr-shop-load" style="padding:8px 18px">加载商品库</button>
</div>
<div class="pr-shop-stats" id="pr-shop-stats" style="display:none"></div>

<div class="pr-filter-advanced" id="pr-filters">
  <div class="pr-filter-group">
    <label>国家 / 地区</label>
    <select id="pr-f-country"><option value="all">全部国家</option></select>
  </div>
  <div class="pr-filter-group">
    <label>电商平台</label>
    <select id="pr-f-platform"><option value="all">全部平台</option></select>
  </div>
  <div class="pr-filter-group">
    <label>商品类目</label>
    <select id="pr-f-category"><option value="all">全部类目</option></select>
  </div>
  <div class="pr-filter-group">
    <label>信号标签</label>
    <select id="pr-f-signal">
      <option value="all">全部信号</option>
      <option value="爆发">爆发</option>
      <option value="上升">上升</option>
      <option value="关注">关注</option>
      <option value="下滑">下滑</option>
    </select>
  </div>
  <div class="pr-filter-group">
    <label>价格带（当地货币）</label>
    <div class="pr-range-row">
      <input type="number" id="pr-f-price-min" placeholder="最低">
      <span>—</span>
      <input type="number" id="pr-f-price-max" placeholder="最高">
    </div>
  </div>
  <div class="pr-filter-group">
    <label>上架周期</label>
    <select id="pr-f-age">
      <option value="all">全部</option>
      <option value="new">新品（0-30天）</option>
      <option value="mature">成熟品（30-180天）</option>
      <option value="decline">衰退品（180天+）</option>
    </select>
  </div>
  <div class="pr-filter-group">
    <label>关键词搜索</label>
    <input type="text" id="pr-f-keyword" placeholder="商品名/店铺名/类目">
  </div>
  <div class="pr-filter-group">
    <label>排序方式</label>
    <select id="pr-f-sort">
      <option value="growth-desc">增速降序</option>
      <option value="sales-desc">销量降序</option>
      <option value="price-asc">价格升序</option>
      <option value="price-desc">价格降序</option>
      <option value="newest">最新上架</option>
    </select>
  </div>
  <div class="pr-filter-actions">
    <button class="filter-button" id="pr-apply-filter" style="padding:8px 24px">应用筛选</button>
    <button class="pr-save-tpl" id="pr-save-tpl-btn">💾 保存筛选模板</button>
    <button style="background:none;border:none;color:var(--muted);font:11px 'Noto Sans SC';cursor:pointer" id="pr-reset-filter">重置</button>
  </div>
  <div class="pr-tpl-list" id="pr-tpl-list"></div>
</div>

<div class="pr-batch-bar" id="pr-batch-bar">
  <span>已选 <span class="pr-batch-count" id="pr-batch-count">0</span> 件商品</span>
  <button id="pr-batch-add">✦ 加入报告素材</button>
  <button id="pr-batch-monitor">📡 加入店铺监控</button>
  <button id="pr-batch-export">📋 导出数据</button>
  <button id="pr-batch-clear" style="margin-left:4px">取消选择</button>
  <div class="pr-export-group">
    <button class="pr-export-btn excel" id="pr-export-excel">📊 简易 Excel</button>
    <button class="pr-export-btn pdf" id="pr-export-pdf">📄 完整 PDF 片段</button>
  </div>
</div>

<article class="panel table-panel pr-table-wrap">
  <div class="panel-head">
    <div>
      <p class="eyebrow">PRODUCT RADAR · GLOBALPULSE DATA</p>
      <h2 id="pr-table-title">跨平台爆发爆款</h2>
    </div>
    <span class="source-ok" id="pr-count">● 44 条实时数据</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px"><input type="checkbox" class="pr-chk" id="pr-check-all"></th>
        <th>#</th>
        <th>商品</th>
        <th>市场 / 平台</th>
        <th>售价（双币种）</th>
        <th>三级类目</th>
        <th>竞品店铺</th>
        <th>销量</th>
        <th>增速</th>
        <th>信号</th>
        <th>上架天数</th>
        <th>更新时间</th>
      </tr>
    </thead>
    <tbody id="pr-table-body"></tbody>
  </table>
</article>

<div class="pr-modal-bg" id="pr-modal">
  <div class="pr-modal">
    <button class="pr-modal-close" id="pr-modal-close">✕</button>
    <div id="pr-modal-content"></div>
  </div>
</div>
</section>'''

html = html[:start_idx] + new_products_html + html[end_idx:]

# ============================================================
# 5. Enrich products data - read old data, create new format
# ============================================================
old_data_start = html.index('const products=[\n')
old_data_end = html.index('];', old_data_start) + 2

# New enriched format: [emoji, name, region, platform, category, subcategory, price_display, price_num_range, sales, growth, signal, shop, listing_days, update_time]
enriched_products = r"""const products=[
['🏠','Ninja CREAMi XL Deluxe 11合1冰淇淋机','欧美','TikTok Shop','家居家装','冰淇淋机/制冷小家电','1699-1899RMB','1699-1899','2,920','+173.6%','爆发','HomeGadgets US','45','2h'],
['⚽','Poolhacker泳池双头喷泉支架','欧美','TikTok Shop','运动户外','泳池配件/户外装备','$35-40','35-40','140','+88.0%','爆发','PoolFun Store','22','2h'],
['💄','Tarte睫毛膏(Manaster Mascara)','欧美','Amazon','美妆个护','眼部化妆品/睫毛膏','$27-29','27-29','5,200','+71.0%','爆发','Tarte Cosmetics','90','4h'],
['📦','宠物冰垫','欧美','Amazon','宠物用品','宠物用品/夏季降温','59-129RMB','59-129','7,000','+65.0%','爆发','PetCool Life','18','2h'],
['📦','汽车遮阳帘','中东','Noon','汽车配件','车载配件/遮阳防晒','39-109RMB','39-109','6,000','+55.0%','爆发','AutoShield ME','35','6h'],
['💄','Native椰子香草洗发护发套装','欧美','Amazon','美妆个护','洗发护发/沐浴护体','$10-15','10-15','6,500','+55.0%','爆发','Native Organics','120','4h'],
['👗','防晒冰丝袖套(UPF50+)','东南亚','Shopee','服饰鞋包','防晒用品/户外配饰','9-22RMB','9-22','3,200','+50.0%','爆发','SunGuard ID','28','2h'],
['💄','Medicule胶原蛋白眼膜','欧美','TikTok Shop','美妆个护','面部护理/眼部护理','$25-37','25-37','8,500','+45.2%','爆发','Medicule Official','60','2h'],
['📱','太阳能充电板','非洲','AliExpress','3C数码','充电设备/户外电源','79-219RMB','79-219','2,000','+45.0%','爆发','SolarTech CN','50','8h'],
['📦','宠物自动喂食器','东南亚','TikTok Shop','宠物用品','宠物智能设备/喂食器','109-219RMB','109-219','3,000','+42.0%','爆发','PetSmart Asia','40','2h'],
['📱','智能手表','中东','TikTok Shop','3C数码','智能穿戴/手表','109-289RMB','109-289','4,000','+38.0%','爆发','WatchTech ME','75','4h'],
['💄','美白身体乳','东南亚','TikTok Shop','美妆个护','身体护理/美白产品','45-89RMB','45-89','12,000','+35.0%','爆发','GlowWhite TH','55','2h'],
['🏠','空气炸锅配件','日韩','Amazon','家居家装','厨房用品/小家电配件','39-89RMB','39-89','4,500','+35.0%','爆发','KitchenPro KR','30','6h'],
['💄','Sol de Janeiro Cheirosa 62香水','欧美','Amazon','美妆个护','香水香体/身体喷雾','$32-68','32-68','3,800','+35.0%','上升','Sol de Janeiro','200','4h'],
['💄','Mighty Patch 痘痘贴(36片装)','欧美','Amazon','美妆个护','面部护理/痘痘护理','89-149RMB','89-149','4,500','+35.0%','爆发','Mighty Patch US','150','4h'],
['💄','男士理发器','欧美','TikTok Shop','美妆个护','个人护理/电动理发','79-179RMB','79-179','5,500','+32.0%','爆发','BARBERX Official','85','2h'],
['💄','香水套装礼盒','中东','Noon','美妆个护','香水香体/礼盒套装','149-369RMB','149-369','3,500','+30.0%','爆发','Fragrance ME','95','6h'],
['👗','夏季冰丝T恤','东南亚','Shopee','服饰鞋包','男装/夏季T恤','15-39RMB','15-39','15,000','+28.0%','爆发','CoolWear ID','25','2h'],
['📱','便携式投影仪','欧美','Amazon','3C数码','影音设备/便携投影','369-879RMB','369-879','2,500','+28.0%','上升','ProjectorPlus','110','4h'],
['💄','COSRX Snail 96 Essence','欧美','Amazon','美妆个护','面部护理/精华液','89-149RMB','89-149','6,800','+28.0%','上升','COSRX Global','180','4h'],
['👗','阿拉伯风格连衣裙','中东','Noon','服饰鞋包','女装/连衣裙/民族风','109-259RMB','109-259','2,800','+25.0%','上升','Arabesque AE','65','6h'],
['💄','美白面膜','日韩','TikTok Shop','美妆个护','面部护理/面膜','59-109RMB','59-109','8,000','+25.0%','上升','K-Beauty Lab','100','4h'],
['💄','防晒喷雾SPF50','东南亚','Shopee','美妆个护','防晒用品/防晒喷雾','29-69RMB','29-69','8,500','+22.0%','上升','SunShield TH','45','2h'],
['💄','假睫毛套装','拉美','Shopee','美妆个护','眼部化妆品/假睫毛','25-59RMB','25-59','9,000','+22.0%','上升','LashPro BR','70','4h'],
['💄','ANLAN 8合1面部EMS美容仪','东南亚','Shopee','美妆个护','美容仪器/面部护理','$20-30','20-30','175','+22.0%','上升','ANLAN Beauty','20','2h'],
['🏠','Stanley Quencher保温吸管杯40oz','欧美','Amazon','家居家装','水壶杯具/保温杯','189-329RMB','189-329','5,200','+22.0%','上升','Stanley US','250','4h'],
['💄','medicule PDRN Pink Collagen Multi Balm','欧美','TikTok Shop','美妆个护','面部护理/多功能膏','119-149RMB','119-149','9,380','+21.1%','爆发','Medicule Official','35','2h'],
['🍜','即食燕窝','东南亚','Tokopedia','食品饮料','滋补品/燕窝','59-149RMB','59-149','5,000','+20.0%','上升','BirdNest ID','130','8h'],
['🏠','LED智能灯带','欧美','Amazon','家居家装','照明装饰/智能灯带','59-149RMB','59-149','8,000','+20.0%','上升','Govee US','200','4h'],
['👗','韩系发饰套装','日韩','TikTok Shop','服饰鞋包','配饰头饰/发饰','25-59RMB','25-59','6,000','+20.0%','上升','K-Hair KR','55','4h'],
['💄','假发套装','非洲','AliExpress','美妆个护','假发接发/发品','109-369RMB','109-369','3,500','+20.0%','上升','HairQueen CN','90','8h'],
['📱','无线蓝牙耳机','东南亚','TikTok Shop','3C数码','音频设备/蓝牙耳机','59-109RMB','59-109','6,000','+18.0%','上升','SoundBase VN','60','2h'],
['⚽','露营折叠椅','欧美','Temu','运动户外','户外家具/折叠椅','109-219RMB','109-219','4,000','+18.0%','上升','CampingPro','140','4h'],
['📱','手机快充头','南亚','Amazon','3C数码','充电配件/快充器','39-109RMB','39-109','7,500','+18.0%','上升','FastCharge IN','180','6h'],
['📱','蓝牙音箱','拉美','MercadoLibre','3C数码','音频设备/蓝牙音箱','79-179RMB','79-179','3,500','+16.0%','上升','AudioLat MX','100','8h'],
['🏠','便携榨汁杯','东南亚','Lazada','家居家装','厨房小电器/榨汁机','39-89RMB','39-89','4,500','+15.0%','上升','BlendGo PH','75','6h'],
['⚽','瑜伽裤套装','欧美','SHEIN','运动户外','运动服饰/瑜伽服','79-189RMB','79-189','10,000','+15.0%','上升','YogaFlex','160','4h'],
['💄','Dazzle Me定妆喷雾','东南亚','Shopee','美妆个护','化妆品/定妆喷雾','$3-8','3-8','12,000','+15.0%','上升','DazzleBeauty VN','200','2h'],
['🏠','陶瓷花盆Bat Trang装饰套装','东南亚','Shopee','家居家装','家居装饰/花盆花架','$5-10','5-10','44,000','+12.5%','上升','Ceramic VN','220','2h'],
['👗','男士Polo衫','南亚','Amazon','服饰鞋包','男装/休闲Polo衫','39-89RMB','39-89','5,000','+12.0%','关注','MenStyle IN','190','6h'],
['📱','手机壳潮款','拉美','Shopee','3C数码','手机配件/手机壳','15-39RMB','15-39','12,000','+10.0%','关注','CaseArt BR','250','4h'],
['🏠','SEESE Cordless Pressure Washer','欧美','TikTok Shop','家居家装','清洁工具/高压水枪','189-259RMB','189-259','3,480','+5.3%','爆发','SEESE US','42','2h'],
['📦','婴儿湿巾','东南亚','Shopee','母婴用品','母婴护理/婴儿湿巾','9-25RMB','9-25','20,000','+5.0%','关注','BabySoft ID','300','2h'],
['📦','Toplux Magnesium Complex 8','欧美','TikTok Shop','健康保健','保健品/矿物质补充','149-219RMB','149-219','3,320','-7.5%','上升','Toplux Health','365','4h']
];"""

html = html[:old_data_start] + enriched_products + html[old_data_end:]

# ============================================================
# 6. Replace renderProducts + filter logic with new JS
# ============================================================
old_render_start = html.index("function renderProducts(list=products)")
old_render_end_marker = "toast(`已显示 ${filtered.length} 条数据`)};"
old_filter_end = html.index(old_render_end_marker, old_render_start) + len(old_render_end_marker)

new_js = """
// === Product Radar Rebuild JS ===
var prTabConfig={burst:{title:'跨平台爆发爆款',filter:function(p){return p[10]==='爆发'||p[10]==='上升'}},potential:{title:'蓝海潜力新品',filter:function(p){return parseInt(p[12])<=90&&p[10]!=='下滑'}},competitor:{title:'竞品店铺商品库',filter:function(){return true}},content:{title:'内容种草单品',filter:function(p){return p[10]==='爆发'||p[10]==='上升'}}};
var prActiveTab='burst';
var prSelectedIds=new Set();

function prParseNum(s){if(!s)return 0;return parseInt(String(s).replace(/[^0-9]/g,''))||0}
function prAvgPrice(range){if(!range)return 0;var parts=String(range).split('-');var sum=0;for(var i=0;i<parts.length;i++)sum+=prParseNum(parts[i]);return sum/parts.length}

function prInitFilters(){
  var regions=[],platforms=[],categories=[],shopNames=[];
  products.forEach(function(p){
    if(regions.indexOf(p[2])<0)regions.push(p[2]);
    if(platforms.indexOf(p[3])<0)platforms.push(p[3]);
    if(categories.indexOf(p[4])<0)categories.push(p[4]);
    if(shopNames.indexOf(p[11])<0)shopNames.push(p[11]);
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
  if(keyword)list=list.filter(function(p){return p[1].toLowerCase().indexOf(keyword)>=0||p[4].toLowerCase().indexOf(keyword)>=0||p[5].toLowerCase().indexOf(keyword)>=0||p[11].toLowerCase().indexOf(keyword)>=0});
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
  if(!list.length){tbody.innerHTML='<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--muted)">暂无符合条件的数据</td></tr>';'pr-count';$('#pr-count').textContent='○ 0 条数据';return}
  tbody.innerHTML=list.map(function(p,i){
    var idx=products.indexOf(p);
    var checked=prSelectedIds.has(idx)?'checked':'';
    var sc=prSignalClass(p[10]);
    var age=parseInt(p[12]);
    var ageLabel=age<=30?'新品':age<=180?'成熟':'衰退';
    var ageColor=age<=30?'#4d8a68':age<=180?'#ca8a04':'#e53935';
    var tagClass=p[10]==='爆发'?'hot':'watch';
    var nameEsc=p[1].replace(/"/g,'&quot;');
    return '<tr>'+
      '<td><input type="checkbox" class="pr-chk" data-idx="'+idx+'" '+checked+'></td>'+
      '<td>'+(i+1)+'</td>'+
      '<td><div class="product-cell"><span class="product-thumb">'+p[0]+'</span><strong class="pr-prod-link" data-idx="'+idx+'" style="cursor:pointer" title="'+nameEsc+'">'+p[1]+'</strong></div></td>'+
      '<td>'+p[2]+' · '+p[3]+'</td>'+
      '<td><div class="pr-dual-price"><span class="pr-local">'+p[6]+'</span><br><span class="pr-rmb">≈ ¥'+p[7]+' RMB</span></div></td>'+
      '<td><span style="font-size:11px;color:var(--muted)">'+p[5]+'</span></td>'+
      '<td><span class="pr-shop-link" data-shop="'+p[11]+'">'+p[11]+'</span></td>'+
      '<td>'+p[8]+'</td>'+
      '<td class="growth">'+p[9]+'</td>'+
      '<td><span class="pr-signal"><span class="pr-signal-dot '+sc+'"></span><span class="tag '+tagClass+'">'+p[10]+'</span></span></td>'+
      '<td><span class="pr-time-col">'+p[12]+'天<br><small style="color:'+ageColor+'">'+ageLabel+'</small></span></td>'+
      '<td><span class="pr-time-col">'+p[13]+'前</span></td>'+
      '</tr>';
  }).join('');
  $('#pr-count').textContent='● '+list.length+' 条实时数据';
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
  var age=parseInt(p[12]);
  var growthVal=prParseNum(p[9]);
  var chartBars='';
  for(var i=0;i<30;i++){
    var factor=0.5+Math.random()*0.8+(i/30)*(growthVal>0?0.5:0.3);
    var h=Math.max(8,Math.min(90,Math.round(factor*50)));
    chartBars+='<i style="height:'+h+'%;background:'+(growthVal>0?'var(--green)':'#e57373')+'"></i>';
  }
  var compliance=p[2]==='欧美'?'<span class="pr-m-tag warn">⚠ GPSR合规提示</span><span class="pr-m-tag warn">⚠ REACH检测要求</span>':p[2]==='东南亚'?'<span class="pr-m-tag warn">⚠ SNI认证可能需要</span>':'<span class="pr-m-tag ok">✓ 合规风险低</span>';
  var sameCount=Math.floor(Math.random()*15)+3;
  var linkCount=Math.floor(Math.random()*50)+10;
  var titleEsc=p[1].replace(/'/g,"\\'");
  var summaryStr='售价'+p[6]+',销量'+p[8]+',增速'+p[9];

  $('#pr-modal-content').innerHTML=
    '<h3>'+p[0]+' '+p[1]+'</h3>'+
    '<div class="pr-m-sub">'+p[2]+' · '+p[3]+' · '+p[5]+' · 更新: '+p[13]+'前</div>'+
    '<div class="pr-m-stats">'+
      '<div class="pr-m-stat"><b>'+p[8]+'</b><span>累计销量</span></div>'+
      '<div class="pr-m-stat"><b style="color:#478067">'+p[9]+'</b><span>增速</span></div>'+
      '<div class="pr-m-stat"><b>'+p[6]+'</b><span>售价区间</span></div>'+
      '<div class="pr-m-stat"><b>'+age+'天</b><span>上架周期</span></div>'+
    '</div>'+
    '<div class="pr-m-section"><h4>📈 30天销量趋势</h4><div class="pr-m-chart">'+chartBars+'</div></div>'+
    '<div class="pr-m-section"><h4>🏪 竞品店铺</h4><p>店铺: <strong>'+p[11]+'</strong> · <span style="color:var(--green);cursor:pointer;text-decoration:underline" id="pr-detail-shop">查看店铺详情 ↗</span></p></div>'+
    '<div class="pr-m-section"><h4>🌐 全网同款分布</h4><p>检测到 <strong>'+sameCount+'</strong> 个平台 <strong>'+linkCount+'</strong> 个链接在售卖同款/类似款</p></div>'+
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
var prAiShort=[
  {text:'美妆个护在TikTok Shop近7日爆发，Medicule胶原蛋白眼膜增速+45.2%，建议立即布局该赛道',link:'Medicule Official'},
  {text:'东南亚防晒品类进入旺季，冰丝袖套、防晒喷雾均超+20%增速，建议提前备货',link:'SunGuard ID'},
  {text:'宠物用品赛道全球多市场同步爆发，宠物冰垫+65%、自动喂食器+42%，蓝海机会明确',link:'PetCool Life'},
  {text:'中东市场汽车配件突然起量，遮阳帘+55%、智能手表+38%，季节性窗口期',link:'AutoShield ME'}
];
var prAiLong=[
  {text:'美妆个护赛道3个月内多品牌连续爆发，容量超$2B/年，竞争度中等，适合工厂长期投入',link:'查看赛道分析'},
  {text:'宠物用品全球电商市场复合增长率16%+，当前竞争度低，是工厂拓品的黄金赛道',link:'查看赛道分析'},
  {text:'3C数码配件赛道价格战加剧，但户外电源、太阳能充电等细分品类仍有蓝海空间',link:'查看细分赛道'},
  {text:'家居家装赛道体量大但增速趋缓，建议聚焦智能化、便携化单品做差异化',link:'查看赛道趋势'}
];
var prAiTab='short';

function prRenderAI(){
  var items=prAiTab==='short'?prAiShort:prAiLong;
  var tabLabel=prAiTab==='short'?'短期机会洞察（7日）':'长期赛道分析（3月）';
  var subLabel=prAiTab==='short'?'即时机会':'赛道规划';
  var poolType=prAiTab==='short'?'短期机会':'长期赛道';
  $('#pr-ai-content').innerHTML='<div class="ai-insight" style="padding:16px 18px;background:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:16px">'+
    '<div class="ai-insight-head"><span class="ai-icon">✨</span><h4>AI '+tabLabel+'</h4><small>基于全平台数据的'+subLabel+'建议</small></div>'+
    items.map(function(item){
      var textEsc=item.text.replace(/'/g,"\\'");
      var linkEsc=item.link.replace(/'/g,"\\'");
      return '<div class="pr-ai-item"><span class="pr-ai-text">'+item.text+'</span>'+
        '<button class="pr-ai-jump" onclick="toast(\'正在跳转到: '+linkEsc+'\')">溯源 ↗</button>'+
        '<button class="pr-ai-add" onclick="rpAddMaterial(\'alert\',\'AI洞察\',\''+poolType+'\',\''+textEsc.substring(0,60)+'...\');event.stopPropagation()">✦</button>'+
      '</div>';
    }).join('')+'</div>';
}

// Filter templates
function prGetTemplates(){try{return JSON.parse(localStorage.getItem('mercator_filter_tpl')||'[]')}catch(e){return[]}}
function prSaveTemplates(t){localStorage.setItem('mercator_filter_tpl',JSON.stringify(t))}
function prRenderTemplates(){
  var tpls=prGetTemplates();
  $('#pr-tpl-list').innerHTML=tpls.map(function(t,i){return '<span class="pr-tpl-chip" data-idx="'+i+'">'+t.name+' <span class="tpl-del" data-idx="'+i+'">✕</span></span>'}).join('');
}
function prSaveCurrentAsTpl(){
  var name=prompt('输入模板名称：','');
  if(!name)return;
  var state={country:$('#pr-f-country').value,platform:$('#pr-f-platform').value,category:$('#pr-f-category').value,signal:$('#pr-f-signal').value,age:$('#pr-f-age').value,priceMin:$('#pr-f-price-min').value,priceMax:$('#pr-f-price-max').value,keyword:$('#pr-f-keyword').value,sort:$('#pr-f-sort').value};
  var tpls=prGetTemplates();
  tpls.push({name:name,state:state});
  prSaveTemplates(tpls);
  prRenderTemplates();
  toast('筛选模板已保存: '+name);
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
function prDeleteTpl(idx){
  var tpls=prGetTemplates();
  tpls.splice(idx,1);
  prSaveTemplates(tpls);
  prRenderTemplates();
  toast('模板已删除');
}

// Export
function prExportExcel(){
  var rows=['商品,国家,平台,类目,三级类目,售价,销量,增速,信号,店铺,上架天数'];
  var data=prSelectedIds.size>0?Array.from(prSelectedIds).map(function(i){return products[i]}):products;
  data.forEach(function(p){rows.push([p[1],p[2],p[3],p[4],p[5],p[6],p[8],p[9],p[10],p[11],p[12]].join(','))});
  var csv=rows.join('\\n');
  var blob=new Blob(['\\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='产品全域雷达_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  toast('Excel 已导出');
}
function prExportPDF(){
  var data=prSelectedIds.size>0?Array.from(prSelectedIds).map(function(i){return products[i]}):products;
  var md='# 产品全域雷达 - 竞品分析报告\\n\\n';
  md+='> 生成时间: '+new Date().toLocaleString('zh-CN')+' | 数据来源: GlobalPulse\\n\\n';
  md+='## 数据总览\\n- 筛选结果: '+data.length+' 条商品\\n';
  var regionSet=[];data.forEach(function(p){if(regionSet.indexOf(p[2])<0)regionSet.push(p[2])});
  var platSet=[];data.forEach(function(p){if(platSet.indexOf(p[3])<0)platSet.push(p[3])});
  md+='- 覆盖市场: '+regionSet.join(', ')+'\\n- 覆盖平台: '+platSet.join(', ')+'\\n\\n';
  md+='## 商品 TOP10\\n\\n';
  data.slice(0,10).forEach(function(p,i){md+=(i+1)+'. **'+p[1]+'** | '+p[2]+' · '+p[3]+' | '+p[6]+' | 销量'+p[8]+' | '+p[9]+' | '+p[10]+'\\n'});
  md+='\\n## 赛道分布\\n\\n';
  var catMap={};data.forEach(function(p){catMap[p[4]]=(catMap[p[4]]||0)+1});
  Object.keys(catMap).sort(function(a,b){return catMap[b]-catMap[a]}).forEach(function(c){md+='- '+c+': '+catMap[c]+'条\\n'});
  var blob=new Blob([md],{type:'text/markdown;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='产品雷达报告_'+new Date().toISOString().slice(0,10)+'.md';a.click();
  toast('PDF 片段已导出');
}

// Init
(function initProductRadar(){
  prInitFilters();
  prRenderAI();
  prRenderTemplates();
  prSwitchTab('burst');

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
  $('#pr-shop-load').onclick=function(){
    var shop=$('#pr-shop-select').value;
    if(!shop){toast('请先选择店铺');return}
    var shopProducts=products.filter(function(p){return p[11]===shop});
    var hotCount=shopProducts.filter(function(p){return p[10]==='爆发'||p[10]==='上升'}).length;
    $('#pr-shop-stats').innerHTML=
      '<div class="pr-shop-stat"><b>'+shopProducts.length+'</b><span>在售商品</span></div>'+
      '<div class="pr-shop-stat"><b style="color:#478067">'+hotCount+'</b><span>热销款</span></div>'+
      '<div class="pr-shop-stat"><b style="color:var(--orange)">'+(shopProducts.length-hotCount)+'</b><span>滞销款</span></div>';
    prRenderTable(shopProducts);
    $('#pr-count').textContent='● '+shopProducts.length+' 件商品 | 店铺: '+shop;
    toast('已加载 '+shop+' 商品库');
  };
})();
"""

html = html[:old_render_start] + new_js + html[old_filter_end:]

# ============================================================
# Write
# ============================================================
with open(fp, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Done. File size: {len(html)} chars")
