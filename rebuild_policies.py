#!/usr/bin/env python3
"""Rebuild policies (政策动态) page with full functionality."""

data = open('index.html','rb').read()

# ============================================================
# 1. CSS
# ============================================================
css_new = r"""
/* === Policies Center === */
.pl-top-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px}
.pl-top-bar h2{margin:0;font-size:1.3rem;color:var(--ink)}
.pl-search-box{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pl-search-box input{padding:6px 12px;border:1px solid #d5d0c5;border-radius:6px;font-size:.85rem;width:200px;background:#fff}
.pl-ai-panel{background:linear-gradient(135deg,#fdf2f0,#f6f4ef);border:1px solid #d5d0c5;border-radius:10px;padding:16px 20px;margin-bottom:18px}
.pl-ai-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.pl-ai-tab{padding:5px 14px;border-radius:20px;font-size:.78rem;cursor:pointer;border:1px solid #d5d0c5;background:#fff;color:var(--ink);transition:all .2s}
.pl-ai-tab.active{background:#c0392b;color:#fff;border-color:#c0392b}
.pl-ai-content{font-size:.85rem;line-height:1.6;color:var(--ink)}
.pl-ai-content .ai-item{padding:8px 0;border-bottom:1px solid #e8e4da}
.pl-ai-content .ai-item:last-child{border:none}
.pl-ai-content .ai-tag-red{color:#c0392b;font-weight:600}
.pl-ai-content .ai-tag-green{color:var(--green);font-weight:600}
.pl-ai-content .ai-btn{display:inline-block;margin-left:10px;font-size:.75rem;color:var(--green);cursor:pointer;text-decoration:underline}
.pl-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.pl-stat-card{background:#fff;border:1px solid #e0ddd4;border-radius:10px;padding:14px 16px;text-align:center}
.pl-stat-card .pl-stat-val{font-size:1.5rem;font-weight:700;color:var(--ink)}
.pl-stat-card .pl-stat-label{font-size:.75rem;color:#888;margin-top:4px}
.pl-stat-card .pl-stat-sub{font-size:.7rem;color:#c0392b;margin-top:2px}
.pl-filter-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding:10px 14px;background:#f6f4ef;border-radius:8px}
.pl-filter-bar select,.pl-filter-bar input{padding:5px 10px;border:1px solid #d5d0c5;border-radius:6px;font-size:.8rem;background:#fff}
.pl-filter-bar .pl-filter-label{font-size:.75rem;color:#888;margin-right:2px}
.pl-batch-bar{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.pl-batch-bar button{padding:5px 14px;border-radius:6px;font-size:.78rem;cursor:pointer;border:1px solid #d5d0c5;background:#fff;color:var(--ink)}
.pl-batch-bar button:hover{background:var(--green);color:#fff;border-color:var(--green)}
.pl-batch-bar .pl-selected-count{font-size:.78rem;color:#888}
.pl-list{display:flex;flex-direction:column;gap:12px;margin-bottom:18px}
.pl-card{position:relative;background:#fff;border:1px solid #e0ddd4;border-radius:10px;padding:16px 16px 16px 24px;display:flex;gap:14px;transition:box-shadow .2s}
.pl-card:hover{box-shadow:0 3px 12px rgba(0,0,0,.06)}
.pl-card .pl-risk-bar{position:absolute;left:0;top:0;bottom:0;width:5px;border-radius:10px 0 0 10px}
.pl-card .pl-risk-bar.level-major{background:#c0392b}
.pl-card .pl-risk-bar.level-medium{background:#e8b73d}
.pl-card .pl-risk-bar.level-normal{background:#bbb}
.pl-card .pl-card-body{flex:1;min-width:0}
.pl-card .pl-card-body h3{margin:0 0 6px;font-size:.95rem;color:var(--ink)}
.pl-card .pl-meta{font-size:.78rem;color:#888;margin-bottom:6px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.pl-card .pl-meta .pl-country-tag{background:#e8e4da;padding:2px 8px;border-radius:4px;font-weight:600;color:var(--ink)}
.pl-card .pl-meta .pl-status-active{color:var(--green);font-weight:600}
.pl-card .pl-meta .pl-status-pending{color:#e8b73d;font-weight:600}
.pl-card .pl-meta .pl-countdown{color:#c0392b;font-weight:600;font-size:.75rem}
.pl-card .pl-summary{font-size:.83rem;color:#555;line-height:1.5;margin-bottom:8px}
.pl-card .pl-tags-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.pl-card .pl-type-tag{font-size:.7rem;padding:2px 8px;border-radius:4px;background:#e8e4da;color:#666}
.pl-card .pl-impact-tag{font-size:.7rem;padding:2px 8px;border-radius:4px}
.pl-card .pl-impact-tag.impact-negative{background:#fde8e2;color:#c0392b}
.pl-card .pl-impact-tag.impact-positive{background:#e6f3ef;color:#2d5f50}
.pl-card .pl-impact-tag.impact-neutral{background:#f0f0f0;color:#888}
.pl-card .pl-card-right{display:flex;flex-direction:column;gap:6px;align-items:flex-end;min-width:120px}
.pl-card .pl-card-right .pl-level-badge{font-size:.75rem;padding:3px 10px;border-radius:5px;font-weight:600}
.pl-card .pl-card-right .pl-level-badge.badge-major{background:#c0392b;color:#fff}
.pl-card .pl-card-right .pl-level-badge.badge-medium{background:#e8b73d;color:#fff}
.pl-card .pl-card-right .pl-level-badge.badge-normal{background:#ddd;color:#666}
.pl-card .pl-card-ops{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.pl-card .pl-card-ops button{padding:4px 10px;border-radius:5px;font-size:.72rem;cursor:pointer;border:1px solid #d5d0c5;background:#fff;color:var(--ink)}
.pl-card .pl-card-ops button:hover{background:var(--green);color:#fff;border-color:var(--green)}
.pl-card .pl-card-ops button.btn-ai{border-color:var(--green);color:var(--green)}
.pl-card .pl-card-ops button.btn-ai:hover{background:var(--green);color:#fff}
.pl-card .pl-card-check{position:absolute;top:8px;right:8px;width:18px;height:18px;cursor:pointer}
.pl-pagination{display:flex;justify-content:center;align-items:center;gap:6px;margin:16px 0}
.pl-pagination button{padding:4px 12px;border:1px solid #d5d0c5;border-radius:5px;background:#fff;cursor:pointer;font-size:.8rem}
.pl-pagination button.active{background:var(--green);color:#fff;border-color:var(--green)}
.pl-pagination button:disabled{opacity:.4;cursor:default}
.pl-empty{text-align:center;padding:40px;color:#888;font-size:.9rem}
.pl-empty button{margin-top:12px;padding:8px 20px;border-radius:6px;border:1px solid var(--green);color:var(--green);background:#fff;cursor:pointer;font-size:.85rem}
.pl-detail-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:2000;display:none;justify-content:center;align-items:flex-start;padding:30px 20px;overflow-y:auto}
.pl-detail-overlay.show{display:flex}
.pl-detail-modal{background:#fff;border-radius:14px;width:100%;max-width:860px;padding:28px 32px;position:relative;box-shadow:0 8px 40px rgba(0,0,0,.15)}
.pl-detail-close{position:absolute;top:14px;right:18px;font-size:1.3rem;cursor:pointer;color:#888;background:none;border:none}
.pl-detail-modal h2{margin:0 0 6px;font-size:1.2rem;color:var(--ink)}
.pl-detail-modal .pl-detail-sub{font-size:.82rem;color:#888;margin-bottom:18px}
.pl-detail-section{margin-bottom:20px}
.pl-detail-section h4{font-size:.9rem;color:var(--ink);margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #c0392b}
.pl-detail-section .pl-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pl-detail-section .pl-detail-item{font-size:.82rem;color:#555;line-height:1.5}
.pl-detail-section .pl-detail-item b{color:var(--ink)}
.pl-detail-section table{width:100%;border-collapse:collapse;font-size:.8rem}
.pl-detail-section th{text-align:left;padding:6px 8px;background:#f6f4ef;border-bottom:1px solid #e0ddd4;font-weight:600}
.pl-detail-section td{padding:6px 8px;border-bottom:1px solid #eee}
.pl-ai-compliance{background:#fdf6f5;border:1px solid #e8c5c0;border-radius:8px;padding:14px 18px;margin-top:10px;font-size:.83rem;line-height:1.7;color:var(--ink)}
.pl-ai-compliance h5{margin:0 0 8px;color:#c0392b;font-size:.88rem}
@media(max-width:1000px){.pl-stats-row{grid-template-columns:1fr 1fr}.pl-card{flex-direction:column}.pl-card .pl-card-right{flex-direction:row;align-items:center;min-width:auto}.pl-detail-section .pl-detail-grid{grid-template-columns:1fr}}
@media(max-width:700px){.pl-stats-row{grid-template-columns:1fr}.pl-filter-bar{flex-direction:column}.pl-top-bar{flex-direction:column}}
"""

css_insert_point = data.find(b'</style>')
data = data[:css_insert_point] + css_new.encode('utf-8') + data[css_insert_point:]
print("CSS inserted")

# ============================================================
# 2. Extended policy data - insert after policyData array
# ============================================================
ext_data = r"""
const plExtData=[
{type:'关税调整',status:'已生效',effectiveDate:'2025-01-01',impact:'negative',categories:'电子,纺织,日用品',platforms:'全平台',countdown:0,affectedShops:'跨境店',costImpact:'+25-145%关税',detail:'美国贸易代表办公室(USTR)宣布对华301关税大幅提升，覆盖电子、纺织、日用品等品类，部分商品加征25%附加税。跨境卖家需重新核算成本，考虑提价或转移供应链。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-07-01',impact:'negative',categories:'全品类',platforms:'TikTok Shop/Amazon',countdown:0,affectedShops:'跨境店+本土店',costImpact:'合规成本+$5,000-20,000',detail:'CPSC和USTR加强跨境电商商品安全审查，要求提供CPS认证、FDA注册等合规文件。卖家需提前准备产品检测报告和认证资质。'},
{type:'关税调整',status:'已生效',effectiveDate:'2025-04-01',impact:'negative',categories:'全品类',platforms:'TikTok Shop/Shopee/全平台',countdown:0,affectedShops:'跨境店',costImpact:'+10-20%税费',detail:'印尼财政部取消150美元以下进口商品免税政策，所有跨境电商商品均需缴纳进口税。直接冲击低价商品利润空间。'},
{type:'进口认证',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'家电,玩具,建材',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'认证费$3,000-10,000/SKU',detail:'BSN扩大SNI强制认证品类至35类，未获认证不得进口。卖家需提前6个月申请认证，预留充足时间。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'全品类',platforms:'TikTok Shop/Shopee/Tokopedia',countdown:0,affectedShops:'跨境店',costImpact:'资质审核+合规成本',detail:'印尼贸易部要求所有外国电商卖家必须注册本地PT公司，持有NITPPK许可证。未合规卖家将被封店。'},
{type:'进出口禁令',status:'已生效',effectiveDate:'2024-12-01',impact:'negative',categories:'美妆,食品,药品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'BPOM认证费+$2,000-8,000',detail:'BPOM加强进口化妆品和食品审查，要求全成分披露和本地测试报告。审批周期延长至3-6个月。'},
{type:'税务新规',status:'已生效',effectiveDate:'2025-04-01',impact:'negative',categories:'全品类',platforms:'TikTok Shop/全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'11% VAT',detail:'印尼对所有数字产品和服务征收11%增值税，跨境电商平台需代扣代缴。卖家需将税费计入定价。'},
{type:'进口认证',status:'已生效',effectiveDate:'2025-01-01',impact:'negative',categories:'食品,保健品,化妆品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'认证费$2,000-5,000',detail:'JAKIM更新清真认证标准，进口食品和化妆品必须持有有效清真证书。审批周期2-4个月。'},
{type:'电商合规',status:'已生效',effectiveDate:'2024-04-01',impact:'negative',categories:'服饰,美妆,电子',platforms:'TikTok Shop/Shopee/Lazada',countdown:0,affectedShops:'跨境店',costImpact:'需本土仓+本地公司',detail:'泰国要求跨境电商平台对进口商品承担连带责任，低价商品需缴纳7%增值税。跨境卖家需设立本地实体。'},
{type:'进出口禁令',status:'已生效',effectiveDate:'2024-05-01',impact:'negative',categories:'低于$3商品',platforms:'全平台',countdown:0,affectedShops:'跨境店',costImpact:'低价商品利润清零',detail:'东南亚多国禁止进口低价免税商品（低于$3），直接打击极低价跨境包裹模式。卖家需提价或转本土仓。'},
{type:'关税调整',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'电子,汽车,奢侈品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'+10-30%关税',detail:'越南调整进口关税结构，对电子产品和汽车零配件加征高额关税。同时更新海关估价方法。'},
{type:'电商合规',status:'已生效',effectiveDate:'2025-07-01',impact:'negative',categories:'服饰,美妆,电子',platforms:'Shopee/TikTok Shop',countdown:0,affectedShops:'跨境店',costImpact:'需本土公司注册',detail:'越南要求外国电商卖家必须在当地注册公司或通过本地代理运营，加强对外国卖家的监管。'},
{type:'进出口禁令',status:'已生效',effectiveDate:'2025-01-01',impact:'negative',categories:'电子废弃物,塑料制品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'合规成本+$1,000-3,000',detail:'越南环保部禁止进口电子废弃物和一次性塑料制品，加强进口商品环保合规审查。'},
{type:'电商合规',status:'已生效',effectiveDate:'2025-01-01',impact:'negative',categories:'全品类',platforms:'Amazon/Mercado Libre/Shopee',countdown:0,affectedShops:'跨境店+本土店',costImpact:'RFC税号+合规成本',detail:'墨西哥要求所有跨境电商卖家必须注册RFC税号，平台代扣16%IVA增值税。未注册卖家将被限制销售。'},
{type:'关税调整',status:'已生效',effectiveDate:'2025-01-01',impact:'negative',categories:'纺织,鞋类,玩具',platforms:'全平台',countdown:0,affectedShops:'跨境店',costImpact:'+16-35%关税',detail:'巴西对部分进口商品加征关税，纺织和鞋类产品关税高达35%。跨境卖家需评估成本承受能力。'},
{type:'进口认证',status:'已生效',effectiveDate:'2025-06-01',impact:'negative',categories:'电子,家电,医疗器械',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'认证费$5,000-15,000',detail:'沙特SASO加强进口产品安全认证，电子和家电产品需通过IECEE认证和能效标签。审批周期1-3个月。'},
{type:'进口认证',status:'已生效',effectiveDate:'2024-06-01',impact:'negative',categories:'食品,化妆品,药品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'认证费$3,000-8,000',detail:'沙特SFDA加强进口食品和化妆品审查，要求阿拉伯语标签和本地检测报告。审批周期3-6个月。'},
{type:'税务新规',status:'已生效',effectiveDate:'2025-01-01',impact:'negative',categories:'全品类',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'15%最低税',detail:'中东六国实施15%最低企业税率，跨境电商平台需按新标准缴税。卖家需重新规划税务结构。'},
{type:'关税调整',status:'已生效',effectiveDate:'2025-07-01',impact:'negative',categories:'纺织,皮革,化工',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'+10-25%关税',detail:'土耳其对进口纺织品加征额外关税，保护本土纺织产业。跨境卖家需考虑本土化生产或寻找替代市场。'},
{type:'电商合规',status:'已生效',effectiveDate:'2025-01-01',impact:'negative',categories:'全品类',platforms:'Trendyol/Hepsiburada/全平台',countdown:0,affectedShops:'跨境店',costImpact:'需土耳其公司',detail:'土耳其要求外国电商卖家必须通过本地公司运营，平台需代扣预提税。未合规卖家将被清退。'},
{type:'进口认证',status:'已生效',effectiveDate:'2025-04-01',impact:'negative',categories:'电子,玩具,建材',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'EAC认证费$2,000-6,000',detail:'俄罗斯/独联体扩大EAC强制认证品类，电子和玩具产品必须通过EAC认证方可进口。'},
{type:'关税调整',status:'已生效',effectiveDate:'2025-01-01',impact:'negative',categories:'奢侈品,电子,汽车',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'+5-15%关税',detail:'欧盟对部分进口商品调整关税结构，加强对低价包裹的关税征收。同时推进碳边境调节机制。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'全品类',platforms:'Amazon/eBay/全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'GPSR合规成本',detail:'欧盟通用产品安全法规(GPSR)生效，要求所有产品在欧盟境内有指定负责人。跨境卖家需指定欧盟授权代表。'},
{type:'进出口禁令',status:'征求意见稿',effectiveDate:'2026-10-01',impact:'negative',categories:'全品类',platforms:'全平台',countdown:78,affectedShops:'跨境店',costImpact:'低价商品受限',detail:'欧盟拟取消150欧元以下包裹免税政策，所有进口商品均需缴纳关税。预计10月生效，跨境低价模式将受重大冲击。'}
];
"""

# Insert after policyData array - find ]];\n before the next const
pd_end_marker = data.find(b"]];\nconst ")
# Need to find the specific one after policyData
pd_start = data.find(b'const policyData=')
pd_end_marker = data.find(b"]];\n", pd_start)
insert_pos = pd_end_marker + 3
data = data[:insert_pos] + ext_data.encode('utf-8') + data[insert_pos:]
print("Extended data inserted")

# ============================================================
# 3. HTML - replace the policies section
# ============================================================
html_old_start = data.find(b'<section id="policies"')
html_old_end = data.find(b'</section>', html_old_start) + len(b'</section>')

html_new = """<section id="policies" class="page">
      <div class="pl-top-bar">
        <div><p class="eyebrow">POLICY TRACKER</p><h2>政策动态</h2></div>
        <div class="pl-search-box">
          <input type="text" id="pl-search" placeholder="搜索政策名称/国家...">
          <button class="filter-button" onclick="plSearch()">搜索</button>
          <button class="filter-button" onclick="plExportReport()" style="background:var(--green)">导出报告</button>
        </div>
      </div>
      <div class="pl-ai-panel" id="pl-ai-panel">
        <div class="pl-ai-tabs" id="pl-ai-tabs"></div>
        <div class="pl-ai-content" id="pl-ai-content"></div>
      </div>
      <div class="pl-stats-row" id="pl-stats-row"></div>
      <div class="pl-filter-bar" id="pl-filter-bar">
        <span class="pl-filter-label">国家</span>
        <select id="pl-f-country"><option value="all">全部国家</option></select>
        <span class="pl-filter-label">风险等级</span>
        <select id="pl-f-level"><option value="all">全部等级</option><option value="重大">重大</option><option value="中等">中等</option></select>
        <span class="pl-filter-label">政策类型</span>
        <select id="pl-f-type"><option value="all">全部类型</option><option value="关税调整">关税调整</option><option value="进口认证">进口认证</option><option value="电商合规">电商合规</option><option value="进出口禁令">进出口禁令</option><option value="税务新规">税务新规</option></select>
        <span class="pl-filter-label">生效状态</span>
        <select id="pl-f-status"><option value="all">全部状态</option><option value="已生效">已生效</option><option value="征求意见稿">征求意见稿</option></select>
        <span class="pl-filter-label">影响</span>
        <select id="pl-f-impact"><option value="all">全部影响</option><option value="negative">利空</option><option value="positive">利好</option></select>
        <button class="filter-button" onclick="plFilterChange()">筛选</button>
        <button class="filter-button" onclick="plClearFilters()" style="background:#eee;color:#666">重置</button>
        <span id="pl-filter-count" style="font-size:.78rem;color:#888;margin-left:auto"></span>
      </div>
      <div class="pl-batch-bar" id="pl-batch-bar">
        <button onclick="plBatchAlert()">批量开启预警</button>
        <button onclick="plBatchWatch()">加入看板监控</button>
        <button onclick="plBatchArchive()">批量归档</button>
        <span class="pl-selected-count" id="pl-selected-count"></span>
      </div>
      <div class="pl-list" id="pl-list"></div>
      <div class="pl-pagination" id="pl-pagination"></div>
      <div class="pl-empty" id="pl-empty" style="display:none">
        <p>当前筛选条件下暂无匹配政策</p>
        <button onclick="plClearFilters()">清除筛选条件</button>
      </div>
    </section>
    <div class="pl-detail-overlay" id="pl-detail-overlay" onclick="if(event.target===this)closePlDetail()">
      <div class="pl-detail-modal" id="pl-detail-modal"></div>
    </div>"""

data = data[:html_old_start] + html_new.encode('utf-8') + data[html_old_end:]
print("HTML replaced")

# ============================================================
# 4. JS - replace old block
# ============================================================
js_marker = b"fillSelect('#pl-country'"
js_old_start_pos = data.rfind(b'// --', 0, data.find(js_marker))
js_old_end_pos = data.find(b'\n// --', data.find(js_marker) + 100)
if js_old_end_pos < 0:
    js_old_end_pos = data.find(b'\nfunction switchPage', data.find(js_marker))

js_new = r"""
// -- 政策动态 (Full Rebuild) --
// Populate filter selects
fillSelect('#pl-f-country',[...new Set(policyData.map(p=>p[1]))].sort());

let plCurrentPage=1, plPerPage=10, plSelected=new Set(), plAiTab=0;
const plAiTabs=['全球重大新政汇总','各国准入认证变动','关税调整清单','合规风险预警'];
const plAiData=[
  ['<span class="ai-tag-red">美国对华301关税提升至145%</span>，覆盖电子、纺织、日用品等品类，部分商品加征25%附加税，跨境卖家成本压力剧增。',
   '<span class="ai-tag-red">印尼取消150美元免税门槛</span>，所有跨境电商商品均需缴纳进口税，低价商品模式受到直接冲击。',
   '<span class="ai-tag-red">欧盟拟取消150欧元以下包裹免税政策</span>，预计2026年10月生效，跨境低价模式将受重大冲击。'],
  ['印尼SNI强制认证扩展至35类产品（家电、玩具、建材），<span class="ai-tag-red">未获认证不得进口</span>，卖家需提前6个月申请。',
   '沙特SASO/SFDA联合加强进口审查，<span class="ai-tag-red">电子需IECEE认证、食品需清真认证</span>，审批周期1-6个月。',
   '欧盟GPSR法规已生效，要求所有产品有<span class="ai-tag-red">欧盟境内指定负责人</span>，跨境卖家需指定授权代表。'],
  ['美国：对华关税145%，覆盖全品类，<span class="ai-tag-red">成本涨幅最大</span>。',
   '巴西：纺织品关税高达35%，<span class="ai-tag-red">南美市场门槛提高</span>。',
   '越南：电子产品加征10-30%关税，<span class="ai-tag-red">海关估价方法更新</span>。',
   '土耳其：纺织品额外关税+10-25%，<span class="ai-tag-red">保护本土产业</span>。'],
  ['<span class="ai-tag-red">高风险预警</span>：印尼要求外国电商卖家注册本地PT公司，违规将封店。',
   '<span class="ai-tag-red">高风险预警</span>：墨西哥要求RFC税号注册，平台代扣16%IVA增值税。',
   '<span class="ai-tag-red">高风险预警</span>：越南要求外国卖家设立本地公司或通过代理运营。',
   '<span class="ai-tag-green">利好提示</span>：部分国家推出电商扶持政策，建议关注东南亚本土化机遇。']
];

function plGetExt(idx){return plExtData[idx]||{type:'其他',status:'已确认',effectiveDate:'N/A',impact:'neutral',categories:'N/A',platforms:'N/A',countdown:0,affectedShops:'N/A',costImpact:'N/A',detail:'暂无详细信息'};}

function renderPlStats(){
  const total=policyData.length;
  const majorCount=policyData.filter(p=>p[3]==='重大').length;
  const pendingCount=plExtData.filter(e=>e.status==='征求意见稿').length;
  const tariffCountries=new Set();
  plExtData.forEach((e,i)=>{if(e.type==='关税调整')tariffCountries.add(policyData[i]?.[1]||'');});
  const certCount=plExtData.filter(e=>e.type==='进口认证').length;
  $('#pl-stats-row').innerHTML=`
    <div class="pl-stat-card"><div class="pl-stat-val">${majorCount}</div><div class="pl-stat-label">重大政策数量</div><div class="pl-stat-sub">高风险红线提醒</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${pendingCount}</div><div class="pl-stat-label">待生效/征求意见</div><div class="pl-stat-sub">预留筹备时间</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${tariffCountries.size}</div><div class="pl-stat-label">关税调整国家</div><div class="pl-stat-sub">本年度累计</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${certCount}</div><div class="pl-stat-label">强制认证新增</div><div class="pl-stat-sub">品类/认证更新</div></div>`;
}

function renderPlAi(){
  let tabsHtml=plAiTabs.map((t,i)=>`<span class="pl-ai-tab${i===plAiTab?' active':''}" onclick="plSwitchAiTab(${i})">${t}</span>`).join('');
  tabsHtml+=`<span style="margin-left:auto;font-size:.72rem;color:#888;cursor:pointer" onclick="plSwitchAiTab(${(plAiTab+1)%4})">🔄 重新生成</span>`;
  $('#pl-ai-tabs').innerHTML=tabsHtml;
  const items=plAiData[plAiTab].map((item,idx)=>{
    return `<div class="ai-item">${item}<span class="ai-btn" onclick="plAiLocatePolicy(${idx})">定位政策</span><span class="ai-btn" onclick="toast('已添加预警')">添加预警</span></div>`;
  }).join('');
  $('#pl-ai-content').innerHTML=items;
}
function plSwitchAiTab(i){plAiTab=i;renderPlAi();}
function plAiLocatePolicy(idx){toast('已定位到相关政策条目');}

function plGetFiltered(){
  const search=$('#pl-search').value.toLowerCase();
  const country=$('#pl-f-country').value, level=$('#pl-f-level').value;
  const type=$('#pl-f-type').value, status=$('#pl-f-status').value;
  const impact=$('#pl-f-impact').value;
  return policyData.map((p,i)=>({...p,_ext:plGetExt(i),_idx:i})).filter(p=>{
    const ext=p._ext;
    if(search && !p[0].toLowerCase().includes(search) && !p[1].toLowerCase().includes(search))return false;
    if(country!=='all' && p[1]!==country)return false;
    if(level!=='all' && p[3]!==level)return false;
    if(type!=='all' && ext.type!==type)return false;
    if(status!=='all' && ext.status!==status)return false;
    if(impact==='negative' && ext.impact!=='negative')return false;
    if(impact==='positive' && ext.impact!=='positive')return false;
    return true;
  });
}

function renderPlList(){
  const filtered=plGetFiltered();
  const total=filtered.length;
  const totalPages=Math.ceil(total/plPerPage)||1;
  if(plCurrentPage>totalPages)plCurrentPage=totalPages;
  const start=(plCurrentPage-1)*plPerPage;
  const pageData=filtered.slice(start,start+plPerPage);

  if(total===0){
    $('#pl-list').innerHTML='';
    $('#pl-empty').style.display='block';
    $('#pl-pagination').innerHTML='';
    $('#pl-filter-count').textContent='0 条政策';
    return;
  }
  $('#pl-empty').style.display='none';
  $('#pl-filter-count').textContent=total+' 条政策';

  $('#pl-list').innerHTML=pageData.map(p=>{
    const ext=p._ext;
    const levelClass=p[3]==='重大'?'level-major':p[3]==='中等'?'level-medium':'level-normal';
    const badgeClass=p[3]==='重大'?'badge-major':p[3]==='中等'?'badge-medium':'badge-normal';
    const impactClass=ext.impact==='negative'?'impact-negative':ext.impact==='positive'?'impact-positive':'impact-neutral';
    const impactLabel=ext.impact==='negative'?'利空':ext.impact==='positive'?'利好':'中性';
    const statusClass=ext.status==='已生效'?'pl-status-active':'pl-status-pending';
    const countdownHtml=ext.countdown>0?`<span class="pl-countdown">⏰ ${ext.countdown}天后生效</span>`:'';
    const checked=plSelected.has(p._idx)?'checked':'';
    const sourceClean=p[4].replace(/\[([^\]]+)\]\([^)]+\)/g,'$1');
    return `<div class="pl-card">
      <div class="pl-risk-bar ${levelClass}"></div>
      <input type="checkbox" class="pl-card-check" ${checked} onclick="event.stopPropagation();plToggleSelect(${p._idx})">
      <div class="pl-card-body">
        <h3>${p[0]}</h3>
        <div class="pl-meta">
          <span class="pl-country-tag">🏳 ${p[1]}</span>
          <span>📅 ${p[2]}</span>
          <span class="${statusClass}">${ext.status}</span>
          ${countdownHtml}
          <span>📎 ${sourceClean}</span>
        </div>
        <div class="pl-tags-row">
          <span class="pl-type-tag">${ext.type}</span>
          <span class="pl-impact-tag ${impactClass}">${impactLabel}</span>
          ${ext.categories!=='N/A'?`<span class="pl-type-tag">📦 ${ext.categories.substring(0,20)}${ext.categories.length>20?'...':''}</span>`:''}
          ${ext.platforms!=='N/A'?`<span class="pl-type-tag">🛒 ${ext.platforms.substring(0,20)}${ext.platforms.length>20?'...':''}</span>`:''}
        </div>
        <div class="pl-summary">${p[8]}</div>
      </div>
      <div class="pl-card-right">
        <span class="pl-level-badge ${badgeClass}">${p[3]}</span>
        <div class="pl-card-ops">
          <button onclick="event.stopPropagation();openPlDetail(${p._idx})">查看详情</button>
          <button class="btn-ai" onclick="event.stopPropagation();plAiCompliance(${p._idx})">AI 解读</button>
          <button onclick="event.stopPropagation();toast('已添加预警')">添加预警</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Pagination
  let pagHtml=`<button ${plCurrentPage<=1?'disabled':''} onclick="plGoPage(${plCurrentPage-1})">‹</button>`;
  for(let i=1;i<=totalPages;i++){
    if(totalPages>7 && i>2 && i<totalPages-1 && Math.abs(i-plCurrentPage)>1){
      if(i===3||i===totalPages-2)pagHtml+=`<span>…</span>`;
      continue;
    }
    pagHtml+=`<button class="${i===plCurrentPage?'active':''}" onclick="plGoPage(${i})">${i}</button>`;
  }
  pagHtml+=`<button ${plCurrentPage>=totalPages?'disabled':''} onclick="plGoPage(${plCurrentPage+1})">›</button>`;
  $('#pl-pagination').innerHTML=pagHtml;
}

function plGoPage(n){plCurrentPage=n;renderPlList();window.scrollTo({top:$('#pl-list').offsetTop-100,behavior:'smooth'});}
function plToggleSelect(idx){if(plSelected.has(idx))plSelected.delete(idx);else plSelected.add(idx);$('#pl-selected-count').textContent=plSelected.size?`已选 ${plSelected.size} 条`:'';renderPlList();}
function plSearch(){plCurrentPage=1;renderPlList();}
function plFilterChange(){plCurrentPage=1;renderPlList();}
function plClearFilters(){$('#pl-search').value='';$('#pl-f-country').value='all';$('#pl-f-level').value='all';$('#pl-f-type').value='all';$('#pl-f-status').value='all';$('#pl-f-impact').value='all';plCurrentPage=1;renderPlList();toast('筛选条件已重置');}
function plExportReport(){toast('政策动态报告导出功能（企业版）');}
function plBatchAlert(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已为 ${plSelected.size} 条政策开启预警`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}
function plBatchWatch(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已将 ${plSelected.size} 条政策加入看板`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}
function plBatchArchive(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已归档 ${plSelected.size} 条政策`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}

function openPlDetail(idx){
  const p=policyData[idx];
  if(!p)return;
  const ext=plGetExt(idx);
  const levelLabel=p[3];
  const countdownHtml=ext.countdown>0?`<span style="color:#c0392b;font-weight:600">⏰ 距生效还有 ${ext.countdown} 天</span>`:'<span style="color:var(--green)">已生效</span>';

  let html=`<button class="pl-detail-close" onclick="closePlDetail()">✕</button>
    <h2>${p[0]}</h2>
    <div class="pl-detail-sub">${p[1]} · ${levelLabel} · ${ext.type} · ${countdownHtml} · 数据基于 2026 Q2</div>

    <div class="pl-detail-section"><h4>📋 政策基础档案</h4>
      <div class="pl-detail-grid">
        <div class="pl-detail-item"><b>发布机构：</b>${p[4].replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')}</div>
        <div class="pl-detail-item"><b>发布日期：</b>${p[2]}</div>
        <div class="pl-detail-item"><b>生效日期：</b>${ext.effectiveDate}</div>
        <div class="pl-detail-item"><b>生效状态：</b>${ext.status}</div>
        <div class="pl-detail-item"><b>适用国家：</b>${p[1]}</div>
        <div class="pl-detail-item"><b>覆盖平台：</b>${ext.platforms}</div>
      </div>
    </div>

    <div class="pl-detail-section"><h4>📦 受影响范围</h4>
      <div class="pl-detail-grid">
        <div class="pl-detail-item"><b>受影响品类：</b>${ext.categories}</div>
        <div class="pl-detail-item"><b>受影响店铺：</b>${ext.affectedShops}</div>
        <div class="pl-detail-item"><b>成本影响：</b><span style="color:#c0392b;font-weight:600">${ext.costImpact}</span></div>
        <div class="pl-detail-item"><b>影响性质：</b>${ext.impact==='negative'?'<span style="color:#c0392b">利空</span>':ext.impact==='positive'?'<span style="color:var(--green)">利好</span>':'中性'}</div>
      </div>
    </div>

    <div class="pl-detail-section"><h4>📝 政策详细条文</h4>
      <div class="pl-detail-item" style="line-height:1.8">${p[8]}</div>
      <div class="pl-detail-item" style="margin-top:10px;line-height:1.8;color:#555">${ext.detail}</div>
    </div>

    <div class="pl-detail-section"><h4>⚠️ 合规落地操作指南</h4>
      <div class="pl-detail-item">
        <b>1. 需要办理的认证/资质：</b>${ext.categories!=='N/A'?ext.categories.split(',').map(c=>c.trim()).join('、'):'根据具体品类确定'}<br>
        <b>2. 预计合规成本：</b>${ext.costImpact}<br>
        <b>3. 审批周期：</b>通常1-6个月，建议提前准备<br>
        <b>4. 备货调整：</b>建议提前3-6个月备货，规避政策窗口期风险
      </div>
    </div>

    <div class="pl-detail-section"><h4>💰 经营风险测算</h4>
      <table><tr><th>费用项</th><th>调整前</th><th>调整后</th><th>影响</th></tr>
      <tr><td>关税/税费</td><td>基准</td><td>${ext.costImpact}</td><td style="color:#c0392b">成本上升</td></tr>
      <tr><td>合规成本</td><td>无</td><td>认证+资质费用</td><td style="color:#c0392b">新增支出</td></tr>
      <tr><td>利润影响</td><td>基准</td><td>预计压缩10-30%</td><td style="color:#c0392b">利润下降</td></tr>
      <tr><td>替代方案</td><td colspan="3">考虑海外仓布局/转移市场/调整品类结构</td></tr>
      </table>
    </div>

    <div class="pl-detail-section">
      <button class="filter-button" style="background:#c0392b;margin-right:8px" onclick="plAiComplianceDetail(${idx})">AI 合规深度解读</button>
      <button class="filter-button" onclick="toast('已添加预警')">添加预警监控</button>
      <button class="filter-button" onclick="toast('已加入看板')">加入看板</button>
      <div id="pl-ai-detail-result"></div>
    </div>`;

  $('#pl-detail-modal').innerHTML=html;
  $('#pl-detail-overlay').classList.add('show');
}
function closePlDetail(){$('#pl-detail-overlay').classList.remove('show');}

function plAiCompliance(idx){
  const p=policyData[idx];
  if(!p)return;
  const ext=plGetExt(idx);
  const analysis=`<div class="pl-ai-compliance"><h5>🤖 AI 合规解读 - ${p[0]}</h5>
    <b>政策影响：</b>${ext.impact==='negative'?'该政策对跨境卖家构成成本压力和合规挑战。':'该政策带来新的市场机遇或监管放宽。'}<br>
    <b>应对建议：</b>建议提前办理相关认证，预留${ext.costImpact}合规预算，调整定价策略。<br>
    <b>风险提示：</b>未合规可能导致商品被扣、店铺被封、罚款等风险。<br>
    <b>时间窗口：</b>${ext.countdown>0?`距生效还有${ext.countdown}天，建议立即启动合规准备。`:'政策已生效，需立即执行合规措施。'}</div>`;
  const div=document.createElement('div');
  div.innerHTML=analysis;
  div.style.cssText='position:fixed;bottom:80px;right:20px;z-index:3000;max-width:400px;animation:fadeIn .3s';
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),8000);
}

function plAiComplianceDetail(idx){
  const p=policyData[idx];
  if(!p)return;
  const ext=plGetExt(idx);
  $('#pl-ai-detail-result').innerHTML=`<div class="pl-ai-compliance"><h5>🤖 AI 深度合规报告 - ${p[0]}</h5>
    <b>一、政策背景：</b>${p[0]}由${p[1]}发布，${ext.type}类型政策，于${ext.effectiveDate}生效。<br><br>
    <b>二、核心影响：</b>${ext.detail}<br><br>
    <b>三、合规操作清单：</b><br>
    1. 办理${ext.categories!=='N/A'?ext.categories.split(',').slice(0,3).join('、'):'相关'}认证/资质<br>
    2. 预算${ext.costImpact}用于合规成本<br>
    3. 调整供应链/物流模式以适配新规<br>
    4. 更新产品标签/包装符合要求<br>
    5. 培训团队了解新政策要求<br><br>
    <b>四、风险规避方案：</b><br>
    - 短期：提前备货规避政策窗口期<br>
    - 中期：考虑海外仓/本土化生产<br>
    - 长期：评估替代市场或品类调整<br><br>
    <b>五、成本测算：</b>${ext.costImpact}，预计利润压缩10-30%，建议提价10-20%或优化供应链降低成本。</div>`;
}

function renderPoliciesPage(){
  renderPlStats();
  renderPlAi();
  renderPlList();
}
renderPoliciesPage();
"""

data = data[:js_old_start_pos] + js_new.encode('utf-8') + data[js_old_end_pos:]
print("JS replaced")

# ============================================================
# 5. Update switchPage
# ============================================================
sp_marker = b"if(name==='platforms')renderPlatforms();"
sp_pos = data.find(sp_marker)
if sp_pos >= 0:
    insert = sp_marker + b"\nif(name==='policies')renderPoliciesPage();"
    data = data[:sp_pos] + insert + data[sp_pos+len(sp_marker):]
    print("switchPage updated")
else:
    print("WARNING: switchPage marker not found")

# ============================================================
# 6. Write and verify
# ============================================================
open('index.html','wb').write(data)
print(f"\nFinal file size: {len(data)} bytes")

import re
js_start = data.find(b'<script>')
js_end = data.find(b'</script>')
js_content = data[js_start:js_end]
opens = js_content.count(b'{')
closes = js_content.count(b'}')
print(f"JS braces: {{ = {opens}, }} = {closes}, balanced = {opens==closes}")
broken = len(re.findall(b'onclick="[^"]*\n[^"]*"', data))
print(f"Broken onclick: {broken}")

