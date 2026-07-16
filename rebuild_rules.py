#!/usr/bin/env python3
"""Rebuild rules page: 双Tab(规则变动+营销活动) + AI洞察 + 多维筛选 + 统计卡片 + 详情弹窗 + 批量操作 + 分页"""
import re

with open('index.html','rb') as f:
    data=f.read()

# ═══════════════════════════════════════════════════════════════════════════════
# 1. CSS
# ═══════════════════════════════════════════════════════════════════════════════
css="""
/* ═══ Rules Page v2 ═══ */
.rl-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.rl-stat-card{background:var(--paper);border:1px solid #e0ddd5;border-radius:10px;padding:14px;text-align:center}
.rl-stat-card .val{font-size:28px;font-weight:700;color:var(--ink)}
.rl-stat-card .lbl{font-size:12px;color:#888;margin-top:4px}
.rl-stat-card .sub{font-size:11px;color:var(--green);margin-top:2px}
.rl-tabs{display:flex;gap:0;margin:16px 0 0;border-bottom:2px solid #e0ddd5}
.rl-tab{padding:10px 24px;cursor:pointer;font-size:14px;font-weight:600;color:#888;border-bottom:3px solid transparent;margin-bottom:-2px;transition:.2s}
.rl-tab.active{color:var(--ink);border-bottom-color:var(--orange)}
.rl-tab:hover{color:var(--ink)}
.rl-tab-panel{display:none}
.rl-tab-panel.active{display:block}
.rl-rule-card,.rl-act-card{background:#fff;border:1px solid #e8e5dd;border-radius:10px;padding:14px 16px;margin-bottom:10px;display:grid;grid-template-columns:4px 1fr auto;gap:0 14px;align-items:start;cursor:pointer;transition:.15s}
.rl-rule-card:hover,.rl-act-card:hover{border-color:var(--orange);box-shadow:0 2px 8px rgba(0,0,0,.06)}
.rl-risk-bar{border-radius:3px;min-height:100%;width:4px}
.rl-risk-high{background:#e74c3c}
.rl-risk-mid{background:#f39c12}
.rl-risk-low{background:#27ae60}
.rl-card-body h4{margin:0 0 4px;font-size:14px;color:var(--ink)}
.rl-card-meta{font-size:12px;color:#888;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.rl-card-meta .tag{display:inline-block;padding:1px 8px;border-radius:4px;font-size:11px;font-weight:500}
.rl-type-commission{background:#fff3e6;color:#e67e22}
.rl-type-logistics{background:#e8f4fd;color:#2980b9}
.rl-type-penalty{background:#fde8e8;color:#c0392b}
.rl-type-restriction{background:#f0f0f0;color:#666}
.rl-type-other{background:#e8f8f0;color:#27ae60}
.rl-card-summary{font-size:13px;color:#555;margin-top:6px;line-height:1.5}
.rl-card-actions{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.rl-card-actions button{padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;font-size:12px;cursor:pointer;white-space:nowrap}
.rl-card-actions button:hover{border-color:var(--orange);color:var(--orange)}
.rl-card-actions .btn-primary{background:var(--orange);color:#fff;border-color:var(--orange)}
.rl-countdown{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.rl-countdown-urgent{background:#fde8e8;color:#c0392b}
.rl-countdown-warn{background:#fff3e6;color:#e67e22}
.rl-countdown-ok{background:#e8f8f0;color:#27ae60}
.rl-countdown-done{background:#f0f0f0;color:#999}
.rl-act-type{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.rl-act-promo{background:#e8f0ff;color:#3366cc}
.rl-act-recruit{background:#f0e8ff;color:#7c3aed}
.rl-act-challenge{background:#ffe8f0;color:#db2777}
.rl-act-subsidy{background:#e8ffe8;color:#16a34a}
.rl-act-traffic{background:#fff8e6;color:#ca8a04}
.rl-act-commission-free{background:#e8f8f0;color:#059669}
.rl-batch-bar{display:flex;gap:8px;align-items:center;margin:10px 0;flex-wrap:wrap}
.rl-batch-bar button{padding:5px 14px;border-radius:6px;border:1px solid #ddd;background:#fff;font-size:12px;cursor:pointer}
.rl-batch-bar button:hover{border-color:var(--orange);color:var(--orange)}
.rl-batch-bar .selected-count{font-size:12px;color:var(--orange);font-weight:600}
.rl-pagination{display:flex;gap:6px;justify-content:center;margin:16px 0 8px}
.rl-pagination button{padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;font-size:13px;cursor:pointer}
.rl-pagination button.active{background:var(--orange);color:#fff;border-color:var(--orange)}
.rl-detail-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center}
.rl-detail-modal{background:#fff;border-radius:14px;width:90%;max-width:780px;max-height:85vh;overflow-y:auto;padding:28px;position:relative}
.rl-detail-modal .close-btn{position:absolute;top:14px;right:18px;font-size:22px;cursor:pointer;color:#999;background:none;border:none}
.rl-detail-modal h2{margin:0 0 16px;font-size:20px;color:var(--ink);padding-right:30px}
.rl-detail-section{margin-bottom:18px}
.rl-detail-section h3{font-size:15px;color:var(--ink);margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid #eee}
.rl-detail-section p,.rl-detail-section li{font-size:13px;color:#555;line-height:1.7}
.rl-detail-section .info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.rl-detail-section .info-item{background:var(--paper);border-radius:8px;padding:10px 12px}
.rl-detail-section .info-item .lbl{font-size:11px;color:#999}
.rl-detail-section .info-item .val{font-size:14px;font-weight:600;color:var(--ink);margin-top:2px}
.rl-detail-section .cost-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
.rl-detail-section .cost-table th{background:var(--paper);padding:8px;text-align:left;font-weight:600;border-bottom:2px solid #ddd}
.rl-detail-section .cost-table td{padding:8px;border-bottom:1px solid #eee}
.rl-act-benefit{background:#e8f8f0;border-left:3px solid var(--green);padding:10px 14px;border-radius:0 8px 8px 0;margin:8px 0;font-size:13px;color:#1a6b3a}
.rl-act-risk-warn{background:#fff8e6;border-left:3px solid #ca8a04;padding:10px 14px;border-radius:0 8px 8px 0;margin:8px 0;font-size:13px;color:#8a6d00}
@media(max-width:1000px){.rl-stats-grid{grid-template-columns:repeat(2,1fr)}.rl-detail-section .info-grid{grid-template-columns:1fr}}
@media(max-width:700px){.rl-rule-card,.rl-act-card{grid-template-columns:4px 1fr;}.rl-card-actions{flex-direction:row;margin-top:8px;grid-column:1/-1}}
"""
data=data.replace(b'</style>',css.encode()+b'\n</style>',1)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Extension data + activities data (after rulesData array)
# ═══════════════════════════════════════════════════════════════════════════════
ext_data=r"""
// Rules page extended data
const rlExtData={
'TikTok Shop东南亚_佣金调整':{level:'high',effectiveDate:'2026-01-01',costImpact:'每单增加约$0.15-0.30',affectedShops:'全部跨境店',platforms:['TikTok Shop'],detail:'佣金从1%上调至2.5%，同时收取交易手续费0.5%。以客单价$10的商品计算，每单成本增加约$0.20。建议同步调整定价策略，或优化SKU组合提升客单价来消化成本。'},
'TikTok Shop东南亚_物流新规':{level:'high',effectiveDate:'2026-03-01',costImpact:'物流成本上升10-20%',affectedShops:'全部卖家',platforms:['TikTok Shop'],detail:'强制使用TikTok Shipping，72小时内必须发出揽收扫描。不合规将扣分处理。建议对比平台物流和第三方物流价格，部分SKU可考虑海外仓备货缩短发货时效。'},
'Shopee东南亚_佣金调整':{level:'mid',effectiveDate:'2026-02-15',costImpact:'美妆品类每单增加$0.15-0.45',affectedShops:'美妆品类卖家',platforms:['Shopee'],detail:'美妆品类佣金从3%调至4.5%，涨幅50%。低毛利产品可能亏损，建议优化SKU结构，减少客单价低于$5的低毛利商品，聚焦中高客单价套装组合。'},
'Shopee东南亚_类目限制':{level:'high',effectiveDate:'2026-04-01',costImpact:'认证费用约$500-2000',affectedShops:'3C数码卖家',platforms:['Shopee'],detail:'电子产品需提交SIR（Supplier Import Registration）证书。无证商品将被下架，建议提前1-2个月办理认证，认证费用约$500-2000不等。'},
'Lazada东南亚_扣分政策':{level:'high',effectiveDate:'2026-01-15',costImpact:'扣分达到12分店铺冻结',affectedShops:'全部卖家',platforms:['Lazada'],detail:'虚假发货扣分从3分调至6分，累计12分店铺冻结7天。务必确保真实物流单号，发货后立即更新物流信息。建议使用平台推荐的物流服务商。'},
'TikTok Shop印尼_类目限制':{level:'high',effectiveDate:'2026-02-01',costImpact:'BPOM认证$1000-3000+本地工厂合作',affectedShops:'食品饮料卖家',platforms:['TikTok Shop'],detail:'要求BPOM注册证和本地生产许可。跨境食品基本无法合规，建议寻找本地代工厂合作，或使用本土店模式由本地合伙人持证经营。'},
'Noon中东_佣金调整':{level:'mid',effectiveDate:'2026-01-01',costImpact:'每单增加$1-3',affectedShops:'美妆品类卖家',platforms:['Noon'],detail:'美妆品类佣金上调至15%，为中东平台最高水平。建议提升客单价至$30+，搭配赠品策略提升感知价值。'},
'TikTok Shop沙特_物流新规':{level:'mid',effectiveDate:'2026-03-15',costImpact:'COD回款周期变化',affectedShops:'全部卖家',platforms:['TikTok Shop'],detail:'强制使用平台指定物流，COD必须对接平台回款系统。回款周期约7-15天，需做好现金流规划。'},
'Noon中东_类目限制':{level:'high',effectiveDate:'2026-05-01',costImpact:'SFDA+GCC认证$2000-5000',affectedShops:'母婴用品卖家',platforms:['Noon'],detail:'需提交SFDA（沙特食品药品管理局）注册和GCC认证。母婴产品准入门槛高，建议提前3个月准备认证材料。'},
'Amazon北美_佣金调整':{level:'mid',effectiveDate:'2026-02-01',costImpact:'服装每单增加$0.50-1.50',affectedShops:'服装品类卖家',platforms:['Amazon'],detail:'服装品类佣金从15%调至17%。FBA费用同步上调，建议优化包装尺寸减少仓储费，提高动销率。'},
'Temu北美_其他':{level:'mid',effectiveDate:'2026-04-01',costImpact:'尾程物流$3-8/单',affectedShops:'半托管卖家',platforms:['Temu'],detail:'半托管模式升级，卖家需承担尾程物流费用。以平均$5/单计算，低客单价商品利润将被严重压缩。建议聚焦$20+客单价商品。'},
'SHEIN北美_扣分政策':{level:'high',effectiveDate:'2026-01-01',costImpact:'质量不达标直接下架',affectedShops:'全部卖家',platforms:['SHEIN'],detail:'质量投诉率超3%触发下架处罚。SHEIN对质量管控极严，建议加强出货前质检，退货率控制在5%以内。'},
'Amazon北美_物流新规':{level:'mid',effectiveDate:'2026-06-01',costImpact:'大件商品FBA费用增加$2-5',affectedShops:'家居大件卖家',platforms:['Amazon'],detail:'大件商品FBA费用上调$2-5/件。可考虑FBM自发货或第三方海外仓，对比成本差异。'},
'Amazon欧洲_其他':{level:'high',effectiveDate:'2026-01-01',costImpact:'欧盟授权代表年费€500-2000',affectedShops:'全部欧洲站卖家',platforms:['Amazon'],detail:'GPSR新规要求所有产品提供欧盟授权代表信息。无欧代信息商品将无法在欧洲站销售，需尽快注册。'},
'TikTok Shop英国_佣金调整':{level:'mid',effectiveDate:'2026-03-01',costImpact:'每单增加$0.25-0.50',affectedShops:'美妆品类卖家',platforms:['TikTok Shop'],detail:'佣金从5%上调至7.5%，涨幅50%。英国站美妆竞争已激烈，需评估利润率是否支撑。'},
'MercadoLibre拉美_佣金调整':{level:'mid',effectiveDate:'2026-02-01',costImpact:'每单增加$0.30-0.80',affectedShops:'3C品类卖家',platforms:['MercadoLibre'],detail:'电子产品佣金从11%调至13.5%。拉美市场物流成本高，建议提升配件搭售率拉高客单价。'},
'Shopee巴西_物流新规':{level:'mid',effectiveDate:'2026-04-15',costImpact:'物流费率变化',affectedShops:'全部卖家',platforms:['Shopee'],detail:'强制使用MercadoEnvios物流系统。需对接平台物流API，建议提前测试系统兼容性。'},
'Amazon印度_类目限制':{level:'high',effectiveDate:'2026-01-01',costImpact:'FSSAI许可$200-500',affectedShops:'食品饮料卖家',platforms:['Amazon'],detail:'FSSAI食品许可要求提高，审核周期延长至4-6周。确保食品资质完备，提前申请。'},
'Jumia非洲_佣金调整':{level:'low',effectiveDate:'2026-03-01',costImpact:'每单增加$0.10-0.30',affectedShops:'全部卖家',platforms:['Jumia'],detail:'平台佣金统一上调1.5个百分点。非洲市场体量较小，佣金涨幅绝对值有限。'},
'TikTok Shop东南亚_扣分政策':{level:'high',effectiveDate:'2026-05-01',costImpact:'违规成本翻倍',affectedShops:'美妆品类卖家',platforms:['TikTok Shop'],detail:'虚假宣传扣分从3分翻倍至6分。美妆类目为高投诉率品类，务必确保产品描述真实、不夸大功效。'},
'Shopee东南亚_其他':{level:'mid',effectiveDate:'2026-06-01',costImpact:'满减成本由卖家承担',affectedShops:'全部卖家',platforms:['Shopee'],detail:'大促期间强制参加平台满减活动，折扣成本由卖家承担。提前规划促销预算，计算好满减后的利润空间。'},
'Lazada东南亚_物流新规':{level:'mid',effectiveDate:'2026-07-01',costImpact:'质检增加1-3天备货时间',affectedShops:'跨境卖家',platforms:['Lazada'],detail:'跨境商品需通过LGS仓质检。备货时需预留质检时间，避免因质检不合格被退回。'},
'TikTok Shop中东_其他':{level:'mid',effectiveDate:'2026-06-15',costImpact:'翻译费用约$50-200/SKU',affectedShops:'全部卖家',platforms:['TikTok Shop'],detail:'阿拉伯语产品描述强制要求。建议批量翻译，单SKU翻译成本约$50-200。'},
'Amazon北美_其他_2':{level:'mid',effectiveDate:'2026-05-15',costImpact:'商标注册$250-1000',affectedShops:'无品牌卖家',platforms:['Amazon'],detail:'品牌注册要求提高，需美国商标或EUIPO。无商标卖家将无法使用品牌功能，建议提前注册商标。'},
'Noon中东_物流新规':{level:'mid',effectiveDate:'2026-07-01',costImpact:'库存压力增大',affectedShops:'电子产品卖家',platforms:['Noon'],detail:'48小时发货时效从全品类扩展到电子产品。需确保本地仓库存充足，建议提前备货。'}
};

// Activities data (new!)
const activitiesData=[
['TikTok Shop东南亚','月度大促','2026-07-07','2026-07-15','2026-07-20','东南亚','全品类','免佣金3天+广告返现20%+首页流量坑位','店铺评分≥4.3','全部','美妆、3C、家居','7','TikTok Shop'],
['Shopee东南亚','月度大促','2026-07-01','2026-07-10','2026-07-18','东南亚','全品类','运费补贴50%+满减券平台承担60%','店铺评分≥4.0','全部','美妆、服饰、家居','已截止','Shopee'],
['Lazada东南亚','新品招商补贴','2026-06-20','2026-07-05','2026-07-31','东南亚','新品','新品流量扶持30天+广告金$50','上架30天内新品','跨境店可参与','3C、家居、母婴','已截止','Lazada'],
['TikTok Shop东南亚','直播挑战赛','2026-07-10','2026-07-20','2026-07-25','东南亚','直播','流量券奖励TOP50+达人免费对接','日均直播≥2小时','全部','美妆、食品、服饰','10','TikTok Shop'],
['Noon中东','Ramadan预热大促','2026-07-15','2026-07-25','2026-08-15','中东','全品类','免佣金7天+首页Banner+运费补贴','店铺评分≥3.8','本土店优先','美妆、3C、家居','10','Noon'],
['Amazon北美','Prime Day','2026-06-15','2026-07-01','2026-07-12','北美','全品类','Lightning Deal流量+Prime专属折扣','FBA库存充足','全部','3C、家居、运动','已截止','Amazon'],
['Temu北美','新卖家扶持计划','2026-07-01','2026-07-31','2026-08-31','北美','新卖家','前3个月免佣金+广告金$200+流量倾斜','新注册店铺','半托管模式','全品类','16','Temu'],
['SHEIN北美','夏日清仓大促','2026-07-08','2026-07-15','2026-07-22','北美','服饰','首页流量扶持+免退货服务','库存深度≥500件','全部','服饰、配饰','已截止','SHEIN'],
['Shopee巴西','7.7大促','2026-07-01','2026-07-07','2026-07-09','拉美','全品类','免运费活动+平台补贴券','店铺评分≥4.0','全部','美妆、3C、服饰','已截止','Shopee'],
['MercadoLibre拉美','年中大促','2026-07-12','2026-07-20','2026-07-25','拉美','全品类','广告返现15%+MercadoEnvios运费折扣','店铺评级绿标','全部','3C、家居、运动','5','MercadoLibre'],
['TikTok Shop中东','夏日美妆节','2026-07-14','2026-07-22','2026-07-28','中东','美妆','流量扶持+达人带货免费对接+免佣金2天','美妆类目+评分≥4.0','全部','美妆、个护、香水','9','TikTok Shop'],
['Lazada东南亚','8.8大促预热','2026-07-20','2026-08-01','2026-08-08','东南亚','全品类','早期报名享额外流量+广告金$100','店铺评分≥4.2','全部','全品类','17','Lazada'],
['Amazon欧洲','Back to School','2026-07-25','2026-08-05','2026-08-15','欧洲','文具/3C','Lightning Deal+FBA仓储费减免','FBA库存≥100件','全部','文具、3C、运动','21','Amazon'],
['TikTok Shop东南亚','短视频带货挑战赛','2026-07-16','2026-07-25','2026-07-30','东南亚','短视频','播放量奖励+商品卡流量加权','粉丝≥1000','全部','美妆、食品、家居','11','TikTok Shop'],
['Noon中东',' electronics mega sale','2026-07-18','2026-07-28','2026-08-02','中东','3C数码','免佣金5天+首页推荐+运费全免','电子产品+评分≥3.5','全部','手机配件、智能设备','13','Noon']
];

// Activities extended data
const actExtData=[
{hotLevel:'high',lastGMV:'$2.3M',avgROI:'4.2x',riskWarn:'价格内卷严重，建议差异化选品',benefit:'TikTok Shop年度最大规模月度大促，免佣+返现+流量三重补贴叠加'},
{hotLevel:'high',lastGMV:'$5.8M',avgROI:'3.8x',riskWarn:'满减成本较高，需精算利润',benefit:'Shopee年度常规大促，流量峰值最高，全品类参与'},
{hotLevel:'mid',lastGMV:'$450K',avgROI:'2.5x',riskWarn:'新品需有一定评价基础才能起量',benefit:'新品专属流量池，30天扶持期，广告金可直接抵扣'},
{hotLevel:'mid',lastGMV:'$180K',avgROI:'5.1x',riskWarn:'需保证直播时长和质量',benefit:'直播赛道流量红利期，TOP50可获持续流量奖励'},
{hotLevel:'high',lastGMV:'$3.2M',avgROI:'3.5x',riskWarn:'本土店优先，跨境店流量较少',benefit:'中东最大电商节点，Noon全年最大促销季'},
{hotLevel:'high',lastGMV:'$12.5M',avgROI:'4.8x',riskWarn:'已截止，可复盘为明年备货',benefit:'Amazon年度最大促销，Prime会员专属流量'},
{hotLevel:'mid',lastGMV:'$680K',avgROI:'3.2x',riskWarn:'半托管物流时效需保障',benefit:'新卖家专属，3个月免佣期+广告金，适合测品'},
{hotLevel:'mid',lastGMV:'$890K',avgROI:'2.8x',riskWarn:'库存深度要求高，清仓折扣大',benefit:'SHEIN夏季清仓，服饰类目流量集中'},
{hotLevel:'mid',lastGMV:'$420K',avgROI:'2.2x',riskWarn:'已截止',benefit:'巴西市场7.7大促，拉美电商节点'},
{hotLevel:'mid',lastGMV:'$560K',avgROI:'3.0x',riskWarn:'需绿标店铺，新卖家无法参与',benefit:'拉美最大平台年中促，广告返现力度大'},
{hotLevel:'high',lastGMV:'$1.5M',avgROI:'4.5x',riskWarn:'美妆类目竞争激烈，需差异化内容',benefit:'中东美妆专项活动，达人免费对接+流量扶持'},
{hotLevel:'high',lastGMV:'$2.8M',avgROI:'3.6x',riskWarn:'报名截止后不可修改SKU',benefit:'Lazada年度第二大促，早期报名额外流量奖励'},
{hotLevel:'mid',lastGMV:'$1.8M',avgROI:'3.4x',riskWarn:'FBA仓储费减免有名额限制',benefit:'欧洲返校季，文具/3C类目年度高峰'},
{hotLevel:'mid',lastGMV:'$320K',avgROI:'5.5x',riskWarn:'需有粉丝基础，内容质量要求高',benefit:'短视频带货挑战赛，ROI最高的活动类型'},
{hotLevel:'mid',lastGMV:'$780K',avgROI:'3.1x',riskWarn:'电子产品售后要求高',benefit:'Noon电子品类专项大促，运费全免吸引买家'}
];
"""

marker=b"const contentData=["
data=data.replace(marker,ext_data.encode('utf-8')+b'\n'+marker,1)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. HTML replacement
# ═══════════════════════════════════════════════════════════════════════════════
new_html=r"""<section id="rules" class="page">
      <div id="ai-rules"></div>
      <div class="filter-row" style="flex-wrap:wrap;gap:8px">
        <select id="rl-platform"><option value="all">全部平台</option></select>
        <select id="rl-type"><option value="all">全部类型</option></select>
        <select id="rl-region"><option value="all">全部区域</option></select>
        <select id="rl-category"><option value="all">全部类目</option></select>
        <select id="rl-act-type"><option value="all">全部活动类型</option></select>
        <button class="filter-button" id="apply-rl">应用筛选</button>
        <button class="filter-button" id="reset-rl" style="background:#999">重置</button>
        <span id="rl-count" style="margin-left:auto;font-size:13px;color:#888"></span>
      </div>
      <div class="rl-batch-bar">
        <label style="font-size:13px;display:flex;align-items:center;gap:4px"><input type="checkbox" id="rl-select-all"> 全选</label>
        <button onclick="rlBatchAlert()">批量开启预警</button>
        <button onclick="rlBatchWatch()">批量加入看板</button>
        <button onclick="rlExport()">导出报表</button>
        <span class="selected-count" id="rl-selected-count"></span>
      </div>
      <div class="rl-stats-grid" id="rl-stats-grid"></div>
      <div class="rl-tabs">
        <div class="rl-tab active" data-tab="rules" onclick="switchRlTab('rules')">平台规则变动</div>
        <div class="rl-tab" data-tab="activities" onclick="switchRlTab('activities')">平台营销活动</div>
      </div>
      <div class="rl-tab-panel active" id="rl-panel-rules">
        <div id="rl-rules-list"></div>
        <div class="rl-pagination" id="rl-rules-pagination"></div>
      </div>
      <div class="rl-tab-panel" id="rl-panel-activities">
        <div id="rl-activities-list"></div>
        <div class="rl-pagination" id="rl-act-pagination"></div>
      </div>
    </section>"""

data=re.sub(rb'<section id="rules".*?</section>',new_html.encode('utf-8'),data,count=1,flags=re.DOTALL)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. JS replacement
# ═══════════════════════════════════════════════════════════════════════════════
new_js=r"""
// -- 平台规则 --
fillSelect('#rl-platform',[...new Set(rulesData.map(r=>r[0]))].filter(Boolean).sort());
fillSelect('#rl-type',[...new Set(rulesData.map(r=>r[1]))].filter(Boolean).sort());
fillSelect('#rl-region',[...new Set(rulesData.map(r=>r[4]))].filter(Boolean).sort());
fillSelect('#rl-category',[...new Set(rulesData.map(r=>r[2]))].filter(Boolean).sort());
fillSelect('#rl-act-type',['月度大促','新品招商补贴','直播挑战赛','短视频带货挑战赛','免佣金补贴','类目流量扶持'].sort());

let rlRulesPage=1,rlActPage=1;const RL_PAGE=8;
let rlChecked=new Set();

// Stats
function renderRlStats(){
  const pending=rulesData.filter(r=>{const ext=rlExtData[r[0]+'_'+r[1]];if(!ext)return false;return new Date(ext.effectiveDate)>new Date()}).length;
  const activeActs=activitiesData.filter(a=>parseInt(a[9])>0||a[9]==='7'||a[9]==='10').length;
  const highSubsidy=activitiesData.filter(a=>a[7].includes('免佣金')||a[7].includes('返现')).length;
  const up=rulesData.filter(r=>r[1]==='佣金调整'&&r[5].includes('上调')).length;
  const down=rulesData.filter(r=>r[1]==='佣金调整'&&!r[5].includes('上调')).length;
  $('#rl-stats-grid').innerHTML=[
    ['待执行规则',pending+'条','需提前准备','#e74c3c'],
    ['报名中活动',activeActs+'个','抓紧参与','#3366cc'],
    ['高补贴活动',highSubsidy+'个','重点关注','#16a34a'],
    ['佣金调整',up+'↑ '+down+'↓','近30天','#e67e22']
  ].map(s=>'<div class="rl-stat-card"><div class="val" style="color:'+s[3]+'">'+s[1]+'</div><div class="lbl">'+s[0]+'</div><div class="sub">'+s[2]+'</div></div>').join('');
}

// AI
function renderRlAi(){
  $('#ai-rules').innerHTML='<div class="ai-panel"><div class="ai-header"><div class="ai-tabs" id="rl-ai-tabs"><span class="ai-tab active" data-t="rule" onclick="switchRlAiTab(\'rule\')">规则变动洞察</span><span class="ai-tab" data-t="act" onclick="switchRlAiTab(\'act\')">平台活动洞察</span></div><button class="ai-regen" onclick="renderRlAi()">🔄 重新生成</button></div><div id="rl-ai-content"></div><small style="color:#999;font-size:11px">数据基于 2026 Q3 各平台官方公告</small></div>';
  switchRlAiTab('rule');
}
function switchRlAiTab(t){
  $$('#rl-ai-tabs .ai-tab').forEach(e=>e.classList.toggle('active',e.dataset.t===t));
  if(t==='rule'){
    $('#rl-ai-content').innerHTML='<ul>'
    +'<li>⚠️ <strong>TikTok Shop东南亚</strong>佣金从1%→2.5%，叠加0.5%手续费，每单成本增加约$0.20 <button class="ai-action" onclick="rlLocate(\'rule\',\'TikTok Shop东南亚\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">加入预警</button></li>'
    +'<li>🔴 <strong>印尼站</strong>食品类需BPOM认证，跨境食品基本无法合规，需转本土店模式 <button class="ai-action" onclick="rlLocate(\'rule\',\'TikTok Shop印尼\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">加入预警</button></li>'
    +'<li>⚠️ <strong>Amazon欧洲</strong>GPSR新规要求欧盟授权代表，无证商品将无法销售 <button class="ai-action" onclick="rlLocate(\'rule\',\'Amazon欧洲\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">加入预警</button></li>'
    +'<li>🟡 <strong>SHEIN北美</strong>质量投诉率超3%即下架，品控要求极严 <button class="ai-action" onclick="rlLocate(\'rule\',\'SHEIN北美\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">加入预警</button></li>'
    +'<li>✅ <strong>Jumia非洲</strong>佣金仅上调1.5个百分点，绝对值影响较小 <button class="ai-action" onclick="rlLocate(\'rule\',\'Jumia非洲\')">定位</button></li>'
    +'</ul>';
  } else {
    $('#rl-ai-content').innerHTML='<ul>'
    +'<li>🔥 <strong>TikTok Shop东南亚7.7大促</strong>免佣3天+广告返现20%，剩余7天报名 <button class="ai-action" onclick="rlLocate(\'act\',\'TikTok Shop东南亚\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">报名预警</button></li>'
    +'<li>🆕 <strong>Temu北美新卖家扶持</strong>前3月免佣+$200广告金，适合测品，剩余16天 <button class="ai-action" onclick="rlLocate(\'act\',\'Temu北美\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">报名预警</button></li>'
    +'<li>🔥 <strong>Noon中东Ramadan预热</strong>免佣7天+首页Banner，中东最大节点 <button class="ai-action" onclick="rlLocate(\'act\',\'Noon中东\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">报名预警</button></li>'
    +'<li>✅ <strong>Lazada 8.8预热</strong>早期报名额外流量+$100广告金，剩余17天 <button class="ai-action" onclick="rlLocate(\'act\',\'Lazada东南亚\')">定位</button></li>'
    +'<li>💡 <strong>TikTok短视频挑战赛</strong>ROI最高(5.5x)，需粉丝≥1000，剩余11天 <button class="ai-action" onclick="rlLocate(\'act\',\'TikTok Shop东南亚\')">定位</button></li>'
    +'</ul>';
  }
}
function rlLocate(type,name){
  if(type==='rule'){switchRlTab('rules');const idx=rulesData.findIndex(r=>r[0]===name);if(idx>=0){rlRulesPage=Math.floor(idx/RL_PAGE)+1;renderRlRules();setTimeout(()=>{const el=document.querySelector('.rl-rule-card[data-idx="'+idx+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},100)}}
  else{switchRlTab('activities');const idx=activitiesData.findIndex(a=>a[0]===name);if(idx>=0){rlActPage=Math.floor(idx/RL_PAGE)+1;renderRlActs();setTimeout(()=>{const el=document.querySelector('.rl-act-card[data-idx="'+idx+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},100)}}
}

// Tab switch
function switchRlTab(tab){
  $$('.rl-tab').forEach(e=>e.classList.toggle('active',e.dataset.tab===tab));
  $$('.rl-tab-panel').forEach(e=>e.classList.remove('active'));
  $('#rl-panel-'+tab).classList.add('active');
  if(tab==='rules')renderRlRules();else renderRlActs();
}

// Get countdown
function rlCountdown(dateStr){
  if(dateStr==='已截止')return '<span class="rl-countdown rl-countdown-done">已截止</span>';
  const d=parseInt(dateStr);
  if(d<=0)return '<span class="rl-countdown rl-countdown-done">已截止</span>';
  if(d<=3)return '<span class="rl-countdown rl-countdown-urgent">⏰ '+d+'天</span>';
  if(d<=7)return '<span class="rl-countdown rl-countdown-warn">'+d+'天</span>';
  return '<span class="rl-countdown rl-countdown-ok">'+d+'天</span>';
}

// Rule type class
function rlTypeClass(type){
  if(type.includes('佣金'))return 'rl-type-commission';
  if(type.includes('物流'))return 'rl-type-logistics';
  if(type.includes('扣分'))return 'rl-type-penalty';
  if(type.includes('类目')||type.includes('限制'))return 'rl-type-restriction';
  return 'rl-type-other';
}

// Act type class
function rlActTypeClass(type){
  if(type.includes('大促'))return 'rl-act-promo';
  if(type.includes('招商'))return 'rl-act-recruit';
  if(type.includes('挑战赛')&&type.includes('直播'))return 'rl-act-challenge';
  if(type.includes('短视频'))return 'rl-act-challenge';
  if(type.includes('补贴')||type.includes('扶持'))return 'rl-act-subsidy';
  if(type.includes('流量'))return 'rl-act-traffic';
  if(type.includes('免佣'))return 'rl-act-commission-free';
  return 'rl-act-promo';
}

// Rules list
function renderRlRules(){
  const filtered=getFilteredRules();
  const total=filtered.length;
  const pages=Math.max(1,Math.ceil(total/RL_PAGE));
  if(rlRulesPage>pages)rlRulesPage=pages;
  const start=(rlRulesPage-1)*RL_PAGE;
  const slice=filtered.slice(start,start+RL_PAGE);
  const list=$('#rl-rules-list');
  if(!slice.length){list.innerHTML='<div class="empty-state"><p>暂无匹配规则</p><button onclick="resetRlFilters()" class="btn-primary">清除筛选</button></div>';$('#rl-rules-pagination').innerHTML='';return}
  list.innerHTML=slice.map((r,si)=>{
    const globalIdx=rulesData.indexOf(r);
    const key=r[0]+'_'+r[1];
    const ext=rlExtData[key]||{level:'low',effectiveDate:r[3],costImpact:'-',affectedShops:'-',platforms:[],detail:r[5]};
    const days=Math.ceil((new Date(ext.effectiveDate)-new Date())/86400000);
    const isFuture=days>0;
    return '<div class="rl-rule-card" data-idx="'+globalIdx+'">'
    +'<div class="rl-risk-bar rl-risk-'+ext.level+'"></div>'
    +'<div class="rl-card-body">'
    +'<h4><input type="checkbox" class="rl-check" data-idx="'+globalIdx+'" '+((rlChecked.has(globalIdx))?'checked':'')+' onchange="rlToggleCheck('+globalIdx+')"> '+r[0]+' <span class="tag '+rlTypeClass(r[1])+'">'+r[1]+'</span></h4>'
    +'<div class="rl-card-meta"><span>📅 '+r[3]+'</span><span class="tag watch">'+r[4]+'</span><span>'+r[2]+'</span>'
    +(isFuture?'<span class="rl-countdown '+(days<=7?(days<=3?'rl-countdown-urgent':'rl-countdown-warn'):'rl-countdown-ok')+'">'+(isFuture?days+'天后生效':'已生效')+'</span>':'')
    +'</div>'
    +'<div class="rl-card-summary">'+r[5].substring(0,80)+(r[5].length>80?'…':'')+'</div>'
    +'</div>'
    +'<div class="rl-card-actions">'
    +'<button onclick="openRlRuleDetail('+globalIdx+')">查看详情</button>'
    +'<button onclick="toast(\'已添加预警\')">添加预警</button>'
    +'</div></div>';
  }).join('');
  // pagination
  let pHtml='';
  for(let i=1;i<=pages;i++)pHtml+='<button class="'+(i===rlRulesPage?'active':'')+'" onclick="rlRulesPage='+i+';renderRlRules()">'+i+'</button>';
  $('#rl-rules-pagination').innerHTML=pHtml;
  $('#rl-count').textContent='规则 '+rulesData.length+' 条 | 活动 '+activitiesData.length+' 条';
}

// Activities list
function renderRlActs(){
  const filtered=getFilteredActs();
  const total=filtered.length;
  const pages=Math.max(1,Math.ceil(total/RL_PAGE));
  if(rlActPage>pages)rlActPage=pages;
  const start=(rlActPage-1)*RL_PAGE;
  const slice=filtered.slice(start,start+RL_PAGE);
  const list=$('#rl-activities-list');
  if(!slice.length){list.innerHTML='<div class="empty-state"><p>暂无匹配活动</p><button onclick="resetRlFilters()" class="btn-primary">清除筛选</button></div>';$('#rl-act-pagination').innerHTML='';return}
  list.innerHTML=slice.map((a,si)=>{
    const globalIdx=activitiesData.indexOf(a);
    const ext=actExtData[globalIdx]||{hotLevel:'mid',lastGMV:'-',avgROI:'-',riskWarn:'',benefit:a[7]};
    return '<div class="rl-act-card" data-idx="'+globalIdx+'">'
    +'<div class="rl-risk-bar rl-risk-'+(ext.hotLevel==='high'?'high':ext.hotLevel==='mid'?'mid':'low')+'"></div>'
    +'<div class="rl-card-body">'
    +'<h4><input type="checkbox" class="rl-check" data-idx="a'+globalIdx+'" onchange="rlToggleCheck(\'a'+globalIdx+'\')"> '+a[0]+' · '+a[1]+' <span class="rl-act-type '+rlActTypeClass(a[1])+'">'+a[1]+'</span></h4>'
    +'<div class="rl-card-meta"><span>📅 '+a[3]+' ~ '+a[4]+'</span><span class="tag watch">'+a[5]+'</span><span>主推: '+a[10]+'</span>'+rlCountdown(a[9])+'</div>'
    +'<div class="rl-card-summary">'+a[7].substring(0,80)+(a[7].length>80?'…':'')+'</div>'
    +(ext.riskWarn?'<div class="rl-act-risk-warn">⚠️ '+ext.riskWarn+'</div>':'')
    +'</div>'
    +'<div class="rl-card-actions">'
    +'<button onclick="openRlActDetail('+globalIdx+')">活动详情</button>'
    +'<button onclick="toast(\'已添加报名预警\')">报名预警</button>'
    +'<button class="btn-primary" onclick="switchPage(\'products\');toast(\'已跳转爆款雷达\')">热销品</button>'
    +'</div></div>';
  }).join('');
  let pHtml='';
  for(let i=1;i<=pages;i++)pHtml+='<button class="'+(i===rlActPage?'active':'')+'" onclick="rlActPage='+i+';renderRlActs()">'+i+'</button>';
  $('#rl-act-pagination').innerHTML=pHtml;
}

// Filter logic
function getFilteredRules(){
  const p=$('#rl-platform').value,t=$('#rl-type').value,reg=$('#rl-region').value,cat=$('#rl-category').value;
  return rulesData.filter(r=>(p==='all'||r[0]===p)&&(t==='all'||r[1]===t)&&(reg==='all'||r[4]===reg)&&(cat==='all'||r[2]===cat));
}
function getFilteredActs(){
  const p=$('#rl-platform').value,at=$('#rl-act-type').value;
  return activitiesData.filter(a=>(p==='all'||a[0]===p)&&(at==='all'||a[1]===at));
}

// Main render
function renderRulesPage(){renderRlStats();renderRlAi();renderRlRules();}

// Checkboxes
function rlToggleCheck(idx){if(rlChecked.has(idx))rlChecked.delete(idx);else rlChecked.add(idx);updateRlSelectedCount()}
function updateRlSelectedCount(){const n=rlChecked.size;$('#rl-selected-count').textContent=n>0?n+' items selected':''}
$('#rl-select-all').onchange=function(){const checks=$$('.rl-check');if(this.checked)checks.forEach(c=>{const idx=c.dataset.idx;rlChecked.add(isNaN(idx)?idx:parseInt(idx));c.checked=true});else{rlChecked.clear();checks.forEach(c=>c.checked=false)}updateRlSelectedCount()};

// Batch ops
function rlBatchAlert(){if(!rlChecked.size){toast('请先选择条目');return}toast('已为'+rlChecked.size+'项开启预警')}
function rlBatchWatch(){if(!rlChecked.size){toast('请先选择条目');return}toast('已加入看板'+rlChecked.size+'项')}
function rlExport(){toast('报表导出中…')}

// Reset
function resetRlFilters(){
  ['#rl-platform','#rl-type','#rl-region','#rl-category','#rl-act-type'].forEach(s=>$(s).value='all');
  rlRulesPage=1;rlActPage=1;rlChecked.clear();
  renderRulesPage();renderRlActs();toast('筛选已重置');
}

// Detail - Rule
function openRlRuleDetail(idx){
  const r=rulesData[idx];
  const key=r[0]+'_'+r[1];
  const ext=rlExtData[key]||{level:'low',effectiveDate:r[3],costImpact:'-',affectedShops:'-',platforms:[],detail:r[5]};
  const overlay=document.createElement('div');
  overlay.className='rl-detail-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML='<div class="rl-detail-modal"><button class="close-btn" onclick="this.closest(\'.rl-detail-overlay\').remove()">×</button>'
  +'<h2>'+r[0]+' · '+r[1]+'</h2>'
  +'<div class="rl-detail-section"><h3>📋 基础信息</h3><div class="info-grid">'
  +'<div class="info-item"><div class="lbl">平台</div><div class="val">'+r[0]+'</div></div>'
  +'<div class="info-item"><div class="lbl">规则类型</div><div class="val"><span class="tag '+rlTypeClass(r[1])+'">'+r[1]+'</span></div></div>'
  +'<div class="info-item"><div class="lbl">生效日期</div><div class="val">'+ext.effectiveDate+'</div></div>'
  +'<div class="info-item"><div class="lbl">影响区域</div><div class="val">'+r[4]+'</div></div>'
  +'<div class="info-item"><div class="lbl">影响类目</div><div class="val">'+r[2]+'</div></div>'
  +'<div class="info-item"><div class="lbl">风险等级</div><div class="val" style="color:'+(ext.level==='high'?'#e74c3c':ext.level==='mid'?'#f39c12':'#27ae60')+'">'+(ext.level==='high'?'🔴 重大':ext.level==='mid'?'🟡 中等':'🟢 普通')+'</div></div>'
  +'</div></div>'
  +'<div class="rl-detail-section"><h3>📝 变更详情</h3><p>'+ext.detail+'</p></div>'
  +'<div class="rl-detail-section"><h3>💰 成本影响</h3><div class="info-grid">'
  +'<div class="info-item"><div class="lbl">成本变化</div><div class="val" style="color:#e74c3c">'+ext.costImpact+'</div></div>'
  +'<div class="info-item"><div class="lbl">受影响店铺</div><div class="val">'+ext.affectedShops+'</div></div>'
  +'</div></div>'
  +'<div class="rl-detail-section"><h3>✅ AI 应对建议</h3><p>'+r[6]+'</p></div>'
  +'<div class="rl-detail-section"><h3>🔗 关联联动</h3><p>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'alerts\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看预警中心</button>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'policies\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看政策动态</button>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'platforms\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看平台档案</button>'
  +'</p></div>'
  +'</div>';
  document.body.appendChild(overlay);
}

// Detail - Activity
function openRlActDetail(idx){
  const a=activitiesData[idx];
  const ext=actExtData[idx]||{hotLevel:'mid',lastGMV:'-',avgROI:'-',riskWarn:'',benefit:a[7]};
  const overlay=document.createElement('div');
  overlay.className='rl-detail-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML='<div class="rl-detail-modal"><button class="close-btn" onclick="this.closest(\'.rl-detail-overlay\').remove()">×</button>'
  +'<h2>'+a[0]+' · '+a[1]+'</h2>'
  +'<div class="rl-detail-section"><h3>📋 活动基础信息</h3><div class="info-grid">'
  +'<div class="info-item"><div class="lbl">平台</div><div class="val">'+a[0]+'</div></div>'
  +'<div class="info-item"><div class="lbl">活动类型</div><div class="val"><span class="rl-act-type '+rlActTypeClass(a[1])+'">'+a[1]+'</span></div></div>'
  +'<div class="info-item"><div class="lbl">报名时间</div><div class="val">'+a[2]+' ~ '+a[3]+'</div></div>'
  +'<div class="info-item"><div class="lbl">活动周期</div><div class="val">'+a[3]+' ~ '+a[4]+'</div></div>'
  +'<div class="info-item"><div class="lbl">覆盖区域</div><div class="val">'+a[5]+'</div></div>'
  +'<div class="info-item"><div class="lbl">报名倒计时</div><div class="val">'+rlCountdown(a[9])+'</div></div>'
  +'</div></div>'
  +'<div class="rl-detail-section"><h3>🎁 扶持政策</h3><div class="rl-act-benefit">'+a[7]+'</div></div>'
  +'<div class="rl-detail-section"><h3>📝 准入条件</h3><div class="info-grid">'
  +'<div class="info-item"><div class="lbl">店铺要求</div><div class="val">'+a[8]+'</div></div>'
  +'<div class="info-item"><div class="lbl">店铺类型</div><div class="val">'+a[9]+'（'+a[6]+'）</div></div>'
  +'<div class="info-item"><div class="lbl">主推类目</div><div class="val">'+a[10]+'</div></div>'
  +'<div class="info-item"><div class="lbl">热度</div><div class="val">'+(ext.hotLevel==='high'?'🔥 高':ext.hotLevel==='mid'?'⭐ 中':'📌 低')+'</div></div>'
  +'</div></div>'
  +'<div class="rl-detail-section"><h3>📊 历史数据参考</h3><table class="cost-table"><tr><th>指标</th><th>数据</th></tr>'
  +'<tr><td>往期GMV</td><td>'+ext.lastGMV+'</td></tr>'
  +'<tr><td>平均ROI</td><td>'+ext.avgROI+'</td></tr>'
  +'</table></div>'
  +(ext.riskWarn?'<div class="rl-detail-section"><h3>⚠️ 风险提示</h3><div class="rl-act-risk-warn">'+ext.riskWarn+'</div></div>':'')
  +'<div class="rl-detail-section"><h3>💡 AI 运营建议</h3><p>'
  +(ext.hotLevel==='high'?'高热度活动，建议重点参与。提前备货主推类目商品，预留广告投放预算。':'建议参与，关注准入条件和报名截止时间。')
  +' 结合爆款雷达查看活动热销商品数据，优化选品策略。</p></div>'
  +'<div class="rl-detail-section"><h3>🔗 关联联动</h3><p>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'products\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看爆款雷达</button>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'platforms\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">查看平台档案</button>'
  +'<button onclick="this.closest(\'.rl-detail-overlay\').remove();switchPage(\'alerts\')" style="margin:4px;padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">添加报名预警</button>'
  +'</p></div>'
  +'</div>';
  document.body.appendChild(overlay);
}

$('#apply-rl').onclick=()=>{rlRulesPage=1;rlActPage=1;renderRlRules();renderRlActs();const f=getFilteredRules().length+getFilteredActs().length;toast('已筛选 '+f+' 条结果')};
$('#reset-rl').onclick=()=>resetRlFilters();
renderRulesPage();

"""

old_start=data.find('// -- 平台规则 --'.encode('utf-8'))
old_end=data.find('// -- 热门内容 --'.encode('utf-8'))
if old_start<0 or old_end<0:
    raise Exception(f"Cannot find rules JS block markers: start={old_start}, end={old_end}")
data=data[:old_start]+new_js.encode('utf-8')+data[old_end:]

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Update switchPage
# ═══════════════════════════════════════════════════════════════════════════════
data=data.replace(
    b"if(name==='policies')renderPoliciesPage();",
    b"if(name==='policies')renderPoliciesPage();\n  if(name==='rules')renderRulesPage();"
)

with open('index.html','wb') as f:
    f.write(data)
print("Done. Size:",len(data))
