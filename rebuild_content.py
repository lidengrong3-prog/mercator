#!/usr/bin/env python3
"""Rebuild content page: 4 tabs, AI insights, advanced filters, detail modal, creator leaderboard, live tracking, material library, favorites."""
import re

fp = '/app/data/所有对话/主对话/mercator_rework/index.html'
with open(fp, 'r', encoding='utf-8') as f:
    html = f.read()

# ============================================================
# 1. Replace the content section HTML
# ============================================================
old_section_pat = re.compile(r'<section id="content" class="page">.*?</section>', re.DOTALL)

new_section = r'''<section id="content" class="page">

<!-- AI Insights -->
<div id="ai-content"></div>
<div class="ct-ai-panel" style="margin:0 0 18px">
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
    <button class="ct-ai-tab active" data-aitab="convert" onclick="ctSwitchAI('convert')">内容转化机会</button>
    <button class="ct-ai-tab" data-aitab="trend" onclick="ctSwitchAI('trend')">内容创作风向</button>
    <button class="ct-ai-tab" data-aitab="risk" onclick="ctSwitchAI('risk')">风险限流提醒</button>
  </div>
  <div id="ct-ai-content"></div>
</div>

<!-- 4 Main Tabs -->
<div class="ct-main-tabs" id="ct-main-tabs">
  <button class="ct-main-tab active" data-mtab="all" onclick="ctSwitchMain('all')">全域热门内容</button>
  <button class="ct-main-tab" data-mtab="creator" onclick="ctSwitchMain('creator')">达人榜单库</button>
  <button class="ct-main-tab" data-mtab="live" onclick="ctSwitchMain('live')">直播专场追踪</button>
  <button class="ct-main-tab" data-mtab="similar" onclick="ctSwitchMain('similar')">同款内容素材库</button>
</div>

<!-- Filter Bar -->
<div class="ct-filter-bar" id="ct-filter-bar">
  <select id="ct-f-platform"><option value="">全部平台</option></select>
  <select id="ct-f-market"><option value="">全部市场</option></select>
  <select id="ct-f-type"><option value="">全部类型</option></select>
  <select id="ct-f-cat"><option value="">全部带货类目</option></select>
  <select id="ct-f-tier"><option value="">全部达人层级</option><option value="头部KOL">头部KOL</option><option value="中腰部达人">中腰部达人</option><option value="素人铺量">素人铺量</option></select>
  <select id="ct-f-signal"><option value="">全部信号</option><option value="爆发">爆发</option><option value="平稳">平稳</option><option value="衰退">衰退</option></select>
  <select id="ct-f-period"><option value="">全部周期</option><option value="today">今日热榜</option><option value="7d">7日爆款</option><option value="30d">30日长效</option></select>
  <input type="text" id="ct-f-keyword" placeholder="搜索标题/达人/商品..." style="min-width:160px">
  <select id="ct-f-sort">
    <option value="plays_desc">播放量 降序</option>
    <option value="plays_asc">播放量 升序</option>
    <option value="likes_desc">点赞 降序</option>
    <option value="conv_desc">转化率 降序</option>
  </select>
  <button onclick="ctSaveTpl()" title="保存筛选模板">💾 保存</button>
  <select id="ct-tpl-select" onchange="ctLoadTpl(this.value)"><option value="">加载模板...</option></select>
</div>

<!-- Action Bar -->
<div class="ct-action-bar">
  <div style="display:flex;align-items:center;gap:10px">
    <p class="eyebrow" style="margin:0">TRENDING CONTENT</p>
    <h2 style="margin:0" id="ct-main-title">全域热门内容 <span id="ct-count" style="font-size:14px;color:var(--muted)"></span></h2>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <button class="ct-fav-btn" onclick="ctToggleFavPanel()">📁 收藏夹</button>
    <button class="export" onclick="ctExportExcel()">📊 Excel</button>
    <button class="export" onclick="ctExportPDF()">📄 PDF</button>
  </div>
</div>

<!-- Favorites Panel -->
<div class="ct-fav-panel" id="ct-fav-panel" style="display:none">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <strong style="font-size:14px">我的素材收藏夹</strong>
    <button onclick="ctNewFavFolder()" style="font-size:11px;padding:4px 10px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">+ 新建文件夹</button>
  </div>
  <div class="ct-fav-folders" id="ct-fav-folders"></div>
  <div class="ct-fav-items" id="ct-fav-items"></div>
</div>

<!-- Batch Bar -->
<div class="ct-batch-bar" id="ct-batch-bar" style="display:none">
  <span id="ct-batch-count">已选 0 条</span>
  <button onclick="ctBatchAddReport()">加入报告素材</button>
  <button onclick="ctBatchAddFav()">加入收藏夹</button>
  <button onclick="ctClearSelection()">取消选择</button>
</div>

<!-- Main Content Area -->
<div id="ct-content-area">
  <!-- Tab 1: Content Cards Grid -->
  <div id="ct-tab-all">
    <div class="ct-card-grid" id="ct-card-grid"></div>
  </div>

  <!-- Tab 2: Creator Leaderboard -->
  <div id="ct-tab-creator" style="display:none">
    <div class="ct-creator-filters" style="display:flex;gap:8px;margin-bottom:14px">
      <select id="ct-cr-platform" onchange="ctRenderCreator()"><option value="">全部平台</option></select>
      <select id="ct-cr-market" onchange="ctRenderCreator()"><option value="">全部市场</option></select>
      <select id="ct-cr-cat" onchange="ctRenderCreator()"><option value="">全部品类</option></select>
    </div>
    <article class="panel table-panel">
    <table><thead><tr>
      <th>排名</th><th>达人账号</th><th>平台</th><th>市场</th><th>粉丝量</th><th>平均播放</th><th>带货品类</th><th>平均转化率</th><th>内容数</th><th>操作</th>
    </tr></thead><tbody id="ct-creator-table"></tbody></table>
    </article>
  </div>

  <!-- Tab 3: Live Tracking -->
  <div id="ct-tab-live" style="display:none">
    <div class="ct-live-grid" id="ct-live-grid"></div>
  </div>

  <!-- Tab 4: Similar Content Library -->
  <div id="ct-tab-similar" style="display:none">
    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
      <input type="text" id="ct-similar-input" placeholder="输入商品名称，搜索全网同款内容..." style="flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:6px;font-size:13px">
      <button onclick="ctSearchSimilar()" style="padding:10px 20px;background:var(--green);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🔍 搜索同款内容</button>
    </div>
    <div id="ct-similar-results"></div>
  </div>
</div>

<!-- Content Detail Modal -->
<div class="ct-modal-overlay" id="ct-modal-overlay" onclick="if(event.target===this)ctCloseModal()">
  <div class="ct-modal" id="ct-modal">
    <div class="ct-modal-head">
      <h3 id="ct-modal-title"></h3>
      <button onclick="ctCloseModal()">✕</button>
    </div>
    <div class="ct-modal-body" id="ct-modal-body"></div>
  </div>
</div>

</section>'''

html = old_section_pat.sub(new_section, html)
print("1. Section replaced")

# ============================================================
# 2. Expand contentData from 10 to 15 fields
# Old: [title, platform, market, type, likes, plays, date, creator, product, conv_rate]
# New: [title, platform, market, type, likes, plays, date, creator, product, conv_rate,
#       category, script_type, creator_followers, shop, signal]
# ============================================================
new_content_data = """const contentData=[
['这个身体乳让我白了一个度！','TikTok','东南亚','短视频','185','2800','2025-07-13','@BeautyVibe_TH','美白身体乳','8.5','美妆个护','前后对比','125万','GLOW LAB Official','爆发'],
['夏日防晒不踩雷 TOP5','TikTok','东南亚','商品测评','92','1500','2025-07-13','@SkincareGuru_ID','防晒喷雾套装','6.2','美妆个护','开箱测评','82万','Eiger Official','平稳'],
['10万印尼盾搞定全身穿搭','Shopee Video','东南亚','短视频','55','850','2025-07-13','@FashionHacks_PH','冰丝T恤+短裤套装','12','时尚服饰','场景使用','45万','Beauty Store BR','平稳'],
['蓝牙耳机横评 谁才是性价比之王','YouTube','东南亚','商品测评','18','320','2025-07-13','@TechReview_VN','无线蓝牙耳机','4.5','3C数码','开箱测评','28万','Xiaomi Official','衰退'],
['直播开箱宠物神器','TikTok','东南亚','直播','38','500','2025-07-13','@PetLover_MY','宠物自动喂食器','15','宠物用品','场景使用','65万','Pet Paradise','爆发'],
['迪拜贵妇同款香水开箱','TikTok','中东','开箱视频','120','1800','2025-07-13','@LuxuryDubai','香水套装礼盒','9.2','美妆个护','开箱测评','380万','GlamAR Beauty','爆发'],
['斋月穿搭灵感30套','Instagram','中东','短视频','68','950','2025-07-13','@ModestFashion_SA','阿拉伯连衣裙','5.8','时尚服饰','场景使用','210万','Carrefour UAE','平稳'],
['夏季车载好物推荐','TikTok','中东','短视频','150','2200','2025-07-13','@CarTips_AE','汽车遮阳帘','11','汽车配件','前后对比','95万','AutoPro Accessories','爆发'],
['智能手表深度测评','YouTube','中东','商品测评','25','480','2025-07-13','@GadgetReview_SA','智能手表','3.8','3C数码','开箱测评','52万','TechZone MX','衰退'],
['LED灯带改造出租屋','TikTok','欧美','短视频','280','3500','2025-07-13','@HomeMakeover_US','LED智能灯带','7.5','家居家装','前后对比','520万','Govee US','爆发'],
['瑜伽裤真的值这个价吗？','YouTube','欧美','商品测评','42','680','2025-07-13','@FitnessReview_UK','瑜伽裤套装','5.2','运动户外','开箱测评','38万','Bissell','平稳'],
['露营装备开箱 性价比爆表','TikTok','欧美','开箱视频','85','1200','2025-07-13','@OutdoorLife_US','露营折叠椅','6.8','运动户外','开箱测评','180万','Poolhacker','平稳'],
['男士理发器 在家也能剪出理发店效果','TikTok','欧美','短视频','135','2000','2025-07-13','@BarberLife_US','男士理发器','9.8','美妆个护','场景使用','290万','BARBERX','爆发'],
['我的宠物度过了最凉爽的夏天','Instagram','欧美','短视频','62','900','2025-07-13','@PetParent_UK','宠物冰垫','7.2','宠物用品','场景使用','75万','Pet Paradise','平稳'],
['假睫毛教程 新手也能学会','TikTok','拉美','短视频','110','1600','2025-07-13','@BeautyBR','假睫毛套装','12.5','美妆个护','剧情种草','160万','Beauty Store BR','爆发'],
['蓝牙音箱音质实测','YouTube','拉美','商品测评','22','380','2025-07-13','@TechReview_MX','蓝牙音箱','4','3C数码','开箱测评','32万','TechZone MX','衰退'],
['手机壳合集 每月换新不心疼','TikTok','拉美','短视频','48','750','2025-07-13','@PhoneStyle_BR','手机壳潮款','8.5','3C数码','场景使用','58万','Moda Latina','平稳'],
['7天美白挑战 面膜实测','TikTok','日韩','短视频','170','2500','2025-07-13','@BeautyJP','美白面膜','6.5','美妆个护','前后对比','420万','COSME Kitchen','爆发'],
['空气炸锅必买配件','Instagram','日韩','短视频','45','680','2025-07-13','@KitchenLife_KR','空气炸锅配件','9','家居厨房','场景使用','88万','Kitchen Korea','平稳'],
['韩系发饰 一秒变甜妹','TikTok','日韩','短视频','98','1500','2025-07-13','@HairStyle_KR','韩系发饰套装','7.8','饰品配件','场景使用','135万','Hair Pin Studio','平稳'],
['夏季男装穿搭指南','Instagram','南亚','短视频','28','420','2025-07-13','@MensStyle_IN','男士Polo衫','5.5','时尚服饰','场景使用','42万','MensStyle India','衰退'],
['手机快充头横评 10分钟充满','YouTube','南亚','商品测评','35','580','2025-07-13','@TechIndia','手机快充头','4.8','3C数码','开箱测评','55万','FastCharge Tech','平稳'],
['停电不愁 太阳能充电板实测','TikTok','非洲','短视频','22','350','2025-07-13','@TechNaija','太阳能充电板','10','家居家电','场景使用','28万','SolarTech Africa','爆发'],
['假发合集 每天不重样','TikTok','非洲','短视频','82','1200','2025-07-13','@HairQueen_NG','假发套装','8','美妆个护','场景使用','92万','AfroHair Queen','平稳'],
['直播间秒杀 50元好物合集','Shopee Video','东南亚','直播','18','280','2025-07-13','@LiveDeals_TH','多品类好物','18','日用百货','剧情种草','35万','Dazzle Me Official','平稳'],
['Medicube胶原蛋白眼膜7天使用对比','TikTok','欧美','商品测评','186','2850','2026-07-13','@BeautyGuru_Maya','Medicube胶原蛋白眼膜','8.5','美妆个护','前后对比','680万','Medicube Official','爆发'],
['Amazon Prime Day美妆必买清单2026','YouTube','欧美','短视频','92','1520','2026-07-12','@SkincareWithLisa','Tarte睫毛膏/Sol de Janeiro香水','5.2','美妆个护','场景使用','245万','medicube Official','爆发'],
['Shopee印尼平价定妆喷雾横评TOP5','Shopee Video','东南亚','商品测评','45','860','2026-07-11','@KBeauty_ID','Dazzle Me/Pramy/Sea Makeup定妆喷雾','12.3','美妆个护','开箱测评','78万','Dazzle Me Official','爆发'],
['Poolhacker泳池喷泉安装前后对比','TikTok','欧美','短视频','38','520','2026-07-10','@SummerVibes2026','Poolhacker泳池双头喷泉支架','6.8','运动户外','前后对比','15万','Poolhacker','爆发'],
['Gen Z大花朵胸针DIY穿搭教程','Instagram','欧美','短视频','52','340','2026-07-10','@FashionForward_Zoe','Tory Burch花朵背心/Aje花胸针','3.1','时尚服饰','剧情种草','92万','CIDER','平稳'],
['EMS美容仪30天挑战效果记录','TikTok','东南亚','商品测评','41','680','2026-07-09','@ThaiBeautyReview','ANLAN 8合1面部EMS美容仪','7.5','美妆个护','前后对比','56万','MS Glow','平稳'],
['Kendall Jenner同款Anua护肤开箱','Instagram','欧美','开箱视频','68','420','2026-07-11','@KstyleDaily','Anua精华液','4.8','美妆个护','开箱测评','185万','Toplux Nutrition Official','平稳']
];"""

old_content_pat = re.compile(r'const contentData=\[.*?\];', re.DOTALL)
html = old_content_pat.sub(new_content_data.strip(), html, count=1)
print("2. contentData expanded to 15 fields")

# ============================================================
# 3. Replace old renderContent + filter code with full new system
# ============================================================
old_render_block = """fillSelect('#ct-platform',[...new Set(contentData.map(c=>c[1]).filter(Boolean))].sort());
fillSelect('#ct-market',[...new Set(contentData.map(c=>c[2]).filter(Boolean))].sort());
fillSelect('#ct-type',[...new Set(contentData.map(c=>c[3]).filter(Boolean))].sort());
function renderContent(list){
  $('#content-grid').innerHTML=list.map(c=>{
    const likes=parseFloat(c[4])||0;const plays=parseFloat(c[5])||0;
    return '<article class="ct-card"><span class="tag '+(c[3]==='短视频'?'hot':'watch')+'">'+c[3]+'</span><h3>'+c[0]+'</h3><p class="ct-meta">'+c[1]+' · '+c[2]+' · '+c[6]+'</p><p class="ct-meta">创作者: '+c[7]+'</p><p class="ct-product">带货: '+c[8]+'</p><div class="ct-stats"><span>点赞 <b>'+likes+'万</b></span><span>播放 <b>'+plays+'万</b></span><span>转化率 <b>'+c[9]+'%</b></span></div></article>';
  }).join('')||'<p style="color:#888;padding:20px">暂无数据</p>';
  $('#ct-count').textContent='● '+list.length+' 条内容';
}
renderContent(contentData);
$('#apply-ct').onclick=()=>{
  const p=$('#ct-platform').value,m=$('#ct-market').value,t=$('#ct-type').value;
  const f=contentData.filter(c=>(p==='all'||c[1]===p)&&(m==='all'||c[2]===m)&&(t==='all'||c[3]===t));
  renderContent(f);toast('已显示 '+f.length+' 条内容');
};"""

new_functions = r"""
// ========== CONTENT PAGE - FULL REBUILD ==========
var ctSelected = new Set();
var ctActiveAI = 'convert';
var ctActiveMain = 'all';
var ctFavFolders = JSON.parse(localStorage.getItem('mercator_ct_fav_folders') || '["美妆短视频参考","中东直播脚本"]');
var ctFavItems = JSON.parse(localStorage.getItem('mercator_ct_fav_items') || '{}');

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
      var pool = JSON.parse(localStorage.getItem('mercator_report_pool') || '[]');
      pool.push({type:'content-insight', title:title, content:desc, ts:Date.now()});
      localStorage.setItem('mercator_report_pool', JSON.stringify(pool));
      toast('已加入报告素材: ' + title.substring(0,20));
    });
  });
}

// ========== FILTERS ==========
function ctInitFilters() {
  var plats=[], markets=[], types=[], cats=[];
  contentData.forEach(function(c) {
    if(plats.indexOf(c[1])<0) plats.push(c[1]);
    if(markets.indexOf(c[2])<0) markets.push(c[2]);
    if(types.indexOf(c[3])<0) types.push(c[3]);
    if(cats.indexOf(c[10])<0) cats.push(c[10]);
  });
  function fillOpts(sel, arr) { arr.forEach(function(v){ var o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); }); }
  fillOpts(document.getElementById('ct-f-platform'), plats);
  fillOpts(document.getElementById('ct-f-market'), markets);
  fillOpts(document.getElementById('ct-f-type'), types);
  fillOpts(document.getElementById('ct-f-cat'), cats);

  ['ct-f-platform','ct-f-market','ct-f-type','ct-f-cat','ct-f-tier','ct-f-signal','ct-f-period','ct-f-sort'].forEach(function(id){
    document.getElementById(id).addEventListener('change', ctApplyFilters);
  });
  document.getElementById('ct-f-keyword').addEventListener('input', ctApplyFilters);

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
      '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">' +
        '<span class="tag ' + (c[3]==='直播'?'hot':c[3]==='短视频'?'watch':'') + '" style="font-size:10px">' + c[3] + '</span>' +
        '<span class="tag ' + ctSignalCls(c[14]) + '" style="font-size:10px">' + c[14] + '</span>' +
        '<span style="font-size:10px;padding:1px 6px;border:1px solid ' + tierColor + ';color:' + tierColor + ';border-radius:3px">' + tier + '</span>' +
      '</div>' +
      '<h3 class="ct-card-title" data-idx="' + idx + '" style="cursor:pointer">' + c[0] + '</h3>' +
      '<p class="ct-meta">' + c[1] + ' · ' + c[2] + ' · ' + c[6] + '</p>' +
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
  document.getElementById('ct-modal-title').textContent = c[0];
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
  var pool = JSON.parse(localStorage.getItem('mercator_report_pool') || '[]');
  pool.push({type:'content', title:c[0], content:c[1]+' '+c[2]+' '+c[3]+' 播放'+c[5]+'万 转化'+c[9]+'% 达人'+c[7], ts:Date.now()});
  localStorage.setItem('mercator_report_pool', JSON.stringify(pool));
  toast('已加入报告素材: ' + c[0].substring(0,20));
}
function ctBatchAddReport() {
  var pool = JSON.parse(localStorage.getItem('mercator_report_pool') || '[]');
  ctSelected.forEach(function(idx) {
    var c = contentData[idx];
    pool.push({type:'content', title:c[0], content:c[1]+' '+c[2]+' 播放'+c[5]+'万 转化'+c[9]+'%', ts:Date.now()});
  });
  localStorage.setItem('mercator_report_pool', JSON.stringify(pool));
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
      '<td><button onclick="toast(\'已添加监控: ' + cr.name + '\')" style="font-size:11px;padding:3px 8px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">+ 监控</button></td>' +
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
        '<span style="font-size:11px;color:var(--muted)">' + live.date + '</span>' +
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
      '<span class="tag ' + (c[3]==='直播'?'hot':'watch') + '" style="font-size:10px">' + c[3] + '</span>' +
      '<h3 style="font-size:13px;margin:6px 0">' + c[0] + '</h3>' +
      '<p class="ct-meta">' + c[7] + ' · ' + c[1] + '</p>' +
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
    return '<button class="ct-fav-folder" data-folder="' + f + '" onclick="ctSelectFolder(\'' + f + '\')" style="padding:5px 14px;border:1px solid #ddd;border-radius:16px;background:transparent;cursor:pointer;font-size:12px;margin-right:6px;margin-bottom:4px">' + f + ' (' + items.length + ')</button>';
  }).join('');
  ctRenderFavItems();
}
function ctNewFavFolder() {
  var name = prompt('输入文件夹名称');
  if(!name) return;
  ctFavFolders.push(name);
  ctFavItems[name] = [];
  localStorage.setItem('mercator_ct_fav_folders', JSON.stringify(ctFavFolders));
  localStorage.setItem('mercator_ct_fav_items', JSON.stringify(ctFavItems));
  ctRenderFavFolders();
  toast('已创建文件夹: ' + name);
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
      '<button onclick="ctRemoveFav(\'' + ctActiveFolder + '\',' + i + ')" style="font-size:10px;color:#e53935;background:none;border:none;cursor:pointer">移除</button>' +
    '</div>';
  }).join('');
}
function ctAddToFav(idx) {
  var c = contentData[idx];
  if(ctFavFolders.length === 0) { toast('请先创建收藏夹文件夹'); return; }
  var folder = ctActiveFolder || ctFavFolders[0];
  if(!ctFavItems[folder]) ctFavItems[folder] = [];
  ctFavItems[folder].push({title:c[0], creator:c[7], platform:c[1], ts:Date.now()});
  localStorage.setItem('mercator_ct_fav_items', JSON.stringify(ctFavItems));
  toast('已收藏到: ' + folder);
  ctRenderFavFolders();
}
function ctRemoveFav(folder, idx) {
  ctFavItems[folder].splice(idx, 1);
  localStorage.setItem('mercator_ct_fav_items', JSON.stringify(ctFavItems));
  ctRenderFavFolders();
}
function ctBatchAddFav() {
  if(ctFavFolders.length === 0) { toast('请先创建收藏夹'); return; }
  var folder = ctActiveFolder || ctFavFolders[0];
  if(!ctFavItems[folder]) ctFavItems[folder] = [];
  ctSelected.forEach(function(idx) {
    var c = contentData[idx];
    ctFavItems[folder].push({title:c[0], creator:c[7], platform:c[1], ts:Date.now()});
  });
  localStorage.setItem('mercator_ct_fav_items', JSON.stringify(ctFavItems));
  toast('已收藏 ' + ctSelected.size + ' 条到: ' + folder);
  ctClearSelection();
  ctRenderFavFolders();
}

// ========== TEMPLATES ==========
function ctSaveTpl() {
  var state = {};
  ['ct-f-platform','ct-f-market','ct-f-type','ct-f-cat','ct-f-tier','ct-f-signal','ct-f-period','ct-f-sort'].forEach(function(id){
    state[id.replace('ct-f-','')] = document.getElementById(id).value;
  });
  state.keyword = document.getElementById('ct-f-keyword').value;
  var tpls = JSON.parse(localStorage.getItem('mercator_ct_tpl') || '[]');
  var name = prompt('模板名称', state.platform + ' ' + state.market + ' ' + state.type);
  if(!name) return;
  state.name = name;
  tpls.push(state);
  localStorage.setItem('mercator_ct_tpl', JSON.stringify(tpls));
  ctRenderTplSelect();
  toast('模板已保存: ' + name);
}
function ctRenderTplSelect() {
  var sel = document.getElementById('ct-tpl-select');
  var tpls = JSON.parse(localStorage.getItem('mercator_ct_tpl') || '[]');
  sel.innerHTML = '<option value="">加载模板...</option>' + tpls.map(function(t,i){ return '<option value="' + i + '">' + t.name + '</option>'; }).join('');
}
function ctLoadTpl(idx) {
  if(idx === '') return;
  var tpls = JSON.parse(localStorage.getItem('mercator_ct_tpl') || '[]');
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
  var blob = new Blob([md], {type:'text/markdown;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'content_analysis_report.md';
  a.click();
  toast('PDF报告片段导出完成');
}

// ========== INIT ==========
(function initContentPage() {
  ctInitFilters();
  ctRenderAI();
  ctRenderTplSelect();
  ctApplyFilters();
})();
"""

# Replace old render block
html = html.replace(old_render_block, new_functions)
print("3. Content render + all functions replaced")

# ============================================================
# 4. Add CSS
# ============================================================
css_addition = """
/* ===== CONTENT PAGE STYLES ===== */
.ct-ai-panel { background:#f9f8f5; border:1px solid #e8e4dd; border-radius:8px; padding:16px; margin-bottom:18px }
.ct-ai-tab { padding:6px 16px; border:1px solid #ddd; border-radius:6px; background:transparent; cursor:pointer; font-size:13px; color:var(--ink); transition:all .2s }
.ct-ai-tab.active { background:var(--green); color:#fff; border-color:var(--green) }
.ct-main-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid var(--line) }
.ct-main-tab { padding:8px 18px; border:1px solid #ddd; border-radius:20px; background:transparent; cursor:pointer; font-size:13px; color:var(--ink); transition:all .2s }
.ct-main-tab.active { background:var(--ink); color:#fff; border-color:var(--ink) }
.ct-filter-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:14px; padding:12px; background:#f9f8f5; border-radius:8px; border:1px solid #e8e4dd }
.ct-filter-bar select, .ct-filter-bar input { padding:6px 10px; border:1px solid #ddd; border-radius:6px; font-size:12px; background:#fff }
.ct-action-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px }
.ct-batch-bar { display:flex; gap:8px; align-items:center; padding:10px 14px; background:#fff3e0; border:1px solid var(--orange); border-radius:8px; margin-bottom:12px }
.ct-batch-bar button { padding:4px 12px; border:1px solid var(--orange); color:var(--orange); border-radius:4px; background:transparent; cursor:pointer; font-size:12px }
.ct-batch-bar span { font-size:13px; font-weight:600; color:var(--orange); margin-right:8px }
.ct-card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px }
.ct-card-new { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; position:relative; transition:all .2s }
.ct-card-new:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,.08); border-color:#aebbb3 }
.ct-card-check { position:absolute; top:12px; right:12px }
.ct-card-title { font-size:14px; margin:0 0 6px; line-height:1.4; color:var(--ink) }
.ct-card-title:hover { color:var(--green) }
.ct-card-actions { display:flex; gap:6px; margin-top:10px; padding-top:8px; border-top:1px solid #f0efeb }
.ct-card-actions button { background:transparent; border:none; cursor:pointer; font-size:14px; padding:4px; border-radius:4px; transition:background .2s }
.ct-card-actions button:hover { background:#f0efeb }
.ct-fav-btn { padding:6px 14px; border:1px solid var(--green); color:var(--green); border-radius:6px; background:transparent; cursor:pointer; font-size:12px }
.ct-fav-panel { background:#f9f8f5; border:1px solid #e8e4dd; border-radius:8px; padding:16px; margin-bottom:14px }
.ct-live-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px }
.ct-live-card { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; transition:all .2s }
.ct-live-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,.08) }
.alert-tag-ct { display:inline-block; padding:2px 6px; border-radius:10px; font-size:10px; background:#f0efeb; color:var(--muted); border:1px solid #ddd }
.ct-modal-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:2000; justify-content:center; align-items:center }
.ct-modal-overlay.show { display:flex }
.ct-modal { background:#fff; border-radius:12px; max-width:800px; width:90%; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3) }
.ct-modal-head { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #eee }
.ct-modal-head h3 { margin:0; font-size:16px; color:var(--ink) }
.ct-modal-head button { background:transparent; border:none; font-size:18px; cursor:pointer; color:var(--muted) }
.ct-modal-body { padding:20px }
"""

html = html.replace('</style>', css_addition + '\n</style>', 1)
print("4. CSS added")

# ============================================================
# 5. Write output
# ============================================================
with open(fp, 'w', encoding='utf-8') as f:
    f.write(html)
print("Done! File size:", len(html), "bytes")
