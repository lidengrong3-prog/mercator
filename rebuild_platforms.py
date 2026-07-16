#!/usr/bin/env python3
"""Rebuild platforms (电商平台档案) page with full functionality."""

data = open('index.html','rb').read()

# ============================================================
# 1. CSS - insert before </style>
# ============================================================
css_new = r"""
/* === Platforms Center === */
.pf-top-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px}
.pf-top-bar h2{margin:0;font-size:1.3rem;color:var(--ink)}
.pf-search-box{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pf-search-box input{padding:6px 12px;border:1px solid #d5d0c5;border-radius:6px;font-size:.85rem;width:200px;background:#fff}
.pf-ai-panel{background:linear-gradient(135deg,#eef6f3,#f6f4ef);border:1px solid #d5d0c5;border-radius:10px;padding:16px 20px;margin-bottom:18px}
.pf-ai-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.pf-ai-tab{padding:5px 14px;border-radius:20px;font-size:.78rem;cursor:pointer;border:1px solid #d5d0c5;background:#fff;color:var(--ink);transition:all .2s}
.pf-ai-tab.active{background:var(--green);color:#fff;border-color:var(--green)}
.pf-ai-content{font-size:.85rem;line-height:1.6;color:var(--ink)}
.pf-ai-content .ai-item{padding:8px 0;border-bottom:1px solid #e8e4da}
.pf-ai-content .ai-item:last-child{border:none}
.pf-ai-content .ai-btn{display:inline-block;margin-left:10px;font-size:.75rem;color:var(--green);cursor:pointer;text-decoration:underline}
.pf-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.pf-stat-card{background:#fff;border:1px solid #e0ddd4;border-radius:10px;padding:14px 16px;text-align:center}
.pf-stat-card .pf-stat-val{font-size:1.5rem;font-weight:700;color:var(--ink)}
.pf-stat-card .pf-stat-label{font-size:.75rem;color:#888;margin-top:4px}
.pf-stat-card .pf-stat-sub{font-size:.7rem;color:var(--green);margin-top:2px}
.pf-filter-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding:10px 14px;background:#f6f4ef;border-radius:8px}
.pf-filter-bar select,.pf-filter-bar input{padding:5px 10px;border:1px solid #d5d0c5;border-radius:6px;font-size:.8rem;background:#fff}
.pf-filter-bar .pf-filter-label{font-size:.75rem;color:#888;margin-right:2px}
.pf-batch-bar{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.pf-batch-bar button{padding:5px 14px;border-radius:6px;font-size:.78rem;cursor:pointer;border:1px solid #d5d0c5;background:#fff;color:var(--ink)}
.pf-batch-bar button:hover{background:var(--green);color:#fff;border-color:var(--green)}
.pf-batch-bar .pf-selected-count{font-size:.78rem;color:#888}
.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin-bottom:18px}
.pf-card{position:relative;background:#fff;border:1px solid #e0ddd4;border-radius:10px;padding:16px;cursor:pointer;transition:box-shadow .2s,transform .15s}
.pf-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);transform:translateY(-2px)}
.pf-card.type-content{background:linear-gradient(135deg,#f0f7fb,#fff)}
.pf-card.type-shelf{background:linear-gradient(135deg,#faf8f2,#fff)}
.pf-card .pf-risk-bar{position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:10px 0 0 10px}
.pf-card .pf-risk-bar.risk-high{background:#e05a3a}
.pf-card .pf-risk-bar.risk-mid{background:#e8b73d}
.pf-card .pf-risk-bar.risk-low{background:var(--green)}
.pf-card .pf-card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.pf-card .pf-card-head h3{margin:0;font-size:.95rem;color:var(--ink)}
.pf-card .pf-card-badge{font-size:.68rem;padding:2px 8px;border-radius:10px;background:#e8e4da;color:#666}
.pf-card .pf-card-badge.badge-content{background:#d3e8f5;color:#2a6496}
.pf-card .pf-card-meta{font-size:.78rem;color:#888;margin-bottom:6px}
.pf-card .pf-card-cats{font-size:.78rem;color:var(--ink);margin-bottom:8px;line-height:1.4}
.pf-card .pf-card-cats .cat-hot{color:#e05a3a;font-weight:600}
.pf-card .pf-card-cats .cat-blue{color:var(--green);font-weight:600}
.pf-card .pf-card-data{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
.pf-card .pf-data-item{font-size:.75rem;color:#666}
.pf-card .pf-data-item b{display:block;font-size:.9rem;color:var(--ink)}
.pf-card .pf-data-item .val-up{color:var(--green)}
.pf-card .pf-data-item .val-down{color:#e05a3a}
.pf-card .pf-card-ops{display:flex;gap:6px;flex-wrap:wrap}
.pf-card .pf-card-ops button{padding:4px 10px;border-radius:5px;font-size:.72rem;cursor:pointer;border:1px solid #d5d0c5;background:#fff;color:var(--ink)}
.pf-card .pf-card-ops button:hover{background:var(--green);color:#fff;border-color:var(--green)}
.pf-card .pf-card-ops button.btn-ai{border-color:var(--green);color:var(--green)}
.pf-card .pf-card-ops button.btn-ai:hover{background:var(--green);color:#fff}
.pf-card .pf-card-check{position:absolute;top:8px;right:8px;width:18px;height:18px;cursor:pointer}
.pf-pagination{display:flex;justify-content:center;align-items:center;gap:6px;margin:16px 0}
.pf-pagination button{padding:4px 12px;border:1px solid #d5d0c5;border-radius:5px;background:#fff;cursor:pointer;font-size:.8rem}
.pf-pagination button.active{background:var(--green);color:#fff;border-color:var(--green)}
.pf-pagination button:disabled{opacity:.4;cursor:default}
.pf-empty{text-align:center;padding:40px;color:#888;font-size:.9rem}
.pf-empty button{margin-top:12px;padding:8px 20px;border-radius:6px;border:1px solid var(--green);color:var(--green);background:#fff;cursor:pointer;font-size:.85rem}
.pf-detail-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:2000;display:none;justify-content:center;align-items:flex-start;padding:30px 20px;overflow-y:auto}
.pf-detail-overlay.show{display:flex}
.pf-detail-modal{background:#fff;border-radius:14px;width:100%;max-width:860px;padding:28px 32px;position:relative;box-shadow:0 8px 40px rgba(0,0,0,.15)}
.pf-detail-close{position:absolute;top:14px;right:18px;font-size:1.3rem;cursor:pointer;color:#888;background:none;border:none}
.pf-detail-modal h2{margin:0 0 6px;font-size:1.2rem;color:var(--ink)}
.pf-detail-modal .pf-detail-sub{font-size:.82rem;color:#888;margin-bottom:18px}
.pf-detail-section{margin-bottom:20px}
.pf-detail-section h4{font-size:.9rem;color:var(--ink);margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid var(--green)}
.pf-detail-section .pf-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pf-detail-section .pf-detail-item{font-size:.82rem;color:#555;line-height:1.5}
.pf-detail-section .pf-detail-item b{color:var(--ink)}
.pf-detail-section .pf-risk-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.72rem;margin:2px}
.pf-detail-section .pf-risk-tag.tag-high{background:#fde8e2;color:#c0392b}
.pf-detail-section .pf-risk-tag.tag-mid{background:#fef6e0;color:#8a6d00}
.pf-detail-section .pf-risk-tag.tag-low{background:#e6f3ef;color:#2d5f50}
.pf-detail-section table{width:100%;border-collapse:collapse;font-size:.8rem}
.pf-detail-section th{text-align:left;padding:6px 8px;background:#f6f4ef;border-bottom:1px solid #e0ddd4;font-weight:600}
.pf-detail-section td{padding:6px 8px;border-bottom:1px solid #eee}
.pf-ai-diagnosis{background:#f0f7f4;border:1px solid #c8ddd5;border-radius:8px;padding:14px 18px;margin-top:10px;font-size:.83rem;line-height:1.7;color:var(--ink)}
.pf-ai-diagnosis h5{margin:0 0 8px;color:var(--green);font-size:.88rem}
.pf-mini-chart{display:flex;align-items:flex-end;gap:4px;height:50px;margin-top:8px}
.pf-mini-chart .bar{flex:1;background:var(--green);border-radius:3px 3px 0 0;min-width:20px;position:relative;transition:height .3s}
.pf-mini-chart .bar span{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:.65rem;color:#888;white-space:nowrap}
@media(max-width:1000px){.pf-stats-row{grid-template-columns:1fr 1fr}.pf-grid{grid-template-columns:1fr 1fr}.pf-detail-section .pf-detail-grid{grid-template-columns:1fr}}
@media(max-width:700px){.pf-stats-row{grid-template-columns:1fr}.pf-grid{grid-template-columns:1fr}.pf-filter-bar{flex-direction:column}.pf-top-bar{flex-direction:column}}
"""

css_insert_point = data.find(b'</style>')
data = data[:css_insert_point] + css_new.encode('utf-8') + data[css_insert_point:]
print("CSS inserted")

# Recalculate positions after CSS insertion
css_len = len(css_new.encode('utf-8'))

# ============================================================
# 2. Extended data - insert after platformsData array
# ============================================================
ext_data = r"""
const pfExtData={
'Walmart Marketplace':{growth:'+12.3%',risk:'low',shipping:'WFS本土仓+跨境',entry:'跨境店可入驻',priceRange:'$15-80',hotCats:['家居家电','食品饮料'],blueCats:['健康食品','宠物用品'],founded:'1994',users:'1.5亿/月',payments:'信用卡/PayPal/Afterpay',events:'Black Friday, Cyber Monday, Summer Sale'},
'SOUQ / Amazon中东站':{growth:'+18.5%',risk:'low',shipping:'FBA本土仓',entry:'需本地资质',priceRange:'$20-150',hotCats:['电子产品','美妆个护'],blueCats:['智能家居','母婴'],founded:'2017(中东)',users:'5000万/月',payments:'COD/信用卡/Apple Pay',events:'White Friday, Ramadan Sale'},
'TikTok Shop东南亚':{growth:'+65.2%',risk:'mid',shipping:'跨境直邮+本土仓',entry:'跨境店可入驻',priceRange:'$3-30',hotCats:['美妆个护','服饰'],blueCats:['小家电','户外运动'],founded:'2021',users:'3.25亿/月',payments:'COD/电子钱包/信用卡',events:'9.9/11.11/12.12大促'},
'Shopee':{growth:'+22.1%',risk:'mid',shipping:'SLS物流+本土仓',entry:'跨境店可入驻',priceRange:'$3-40',hotCats:['服饰','美妆','3C配件'],blueCats:['家居收纳','宠物用品'],founded:'2015',users:'6.5亿/月',payments:'ShopeePay/COD/信用卡',events:'Shopee 9.9/11.11/12.12'},
'Lazada':{growth:'+15.8%',risk:'low',shipping:'LEL物流+海外仓',entry:'跨境店可入驻(阿里系)',priceRange:'$5-50',hotCats:['电子产品','家居','母婴'],blueCats:['健身器材','智能穿戴'],founded:'2012',users:'1.6亿/月',payments:'COD/Lazada Wallet/信用卡',events:'Lazada Birthday Sale, 11.11'},
'Tokopedia':{growth:'+20.3%',risk:'low',shipping:'本土仓为主',entry:'需本土公司',priceRange:'$5-60',hotCats:['电子产品','穆斯林服饰','家居'],blueCats:['健康保健','智能设备'],founded:'2009',users:'1.05亿/月',payments:'GoPay/银行转账/COD',events:'Harbolnas 12.12, Ramadan Sale'},
'Bukalapak':{growth:'-5.2%',risk:'mid',shipping:'本土仓',entry:'需本土公司',priceRange:'$3-30',hotCats:['日用品','食品','电子配件'],blueCats:['手工艺品','本地特产'],founded:'2010',users:'4000万/月',payments:'Bukapay/银行转账/COD',events:'12.12促销, 独立日大促'},
'Temu':{growth:'+183.5%',risk:'high',shipping:'全托管/半托管模式',entry:'跨境卖家申请',priceRange:'$1-25',hotCats:['家居小商品','服饰','工具'],blueCats:['户外用品','汽车配件'],founded:'2022',users:'1.2亿/月',payments:'信用卡/PayPal/Apple Pay',events:'Black Friday, New Year Sale'},
'SHEIN':{growth:'+42.6%',risk:'mid',shipping:'跨境直邮+海外仓',entry:'供应商/卖家入驻',priceRange:'$3-20',hotCats:['快时尚女装','配饰'],blueCats:['大码女装','家居装饰'],founded:'2008',users:'1.5亿/月',payments:'信用卡/PayPal/Afterpay',events:'SHEIN Sale, 黑五'},
'Mercado Libre':{growth:'+34.8%',risk:'low',shipping:'Mercado Envios物流',entry:'跨境店可入驻',priceRange:'$10-80',hotCats:['电子','家居','时尚'],blueCats:['汽摩配件','工具'],founded:'1999',users:'6500万/月',payments:'Mercado Pago/信用卡/COD',events:'Hot Sale, Cyber Monday拉美'},
'Noon':{growth:'+28.4%',risk:'low',shipping:'Noon Express本土仓',entry:'需本地TR号',priceRange:'$10-100',hotCats:['电子','美妆','家居'],blueCats:['香水','有机食品'],founded:'2017',users:'2000万/月',payments:'COD/信用卡/Noon Pay',events:'Yellow Friday, Ramadan'},
'Ozon':{growth:'+45.7%',risk:'mid',shipping:'FBO/FBS模式',entry:'中国企业可入驻',priceRange:'$5-60',hotCats:['电子','家居','服装'],blueCats:['中国3C','户外'],founded:'1998',users:'1.1亿/月',payments:'银行卡/Ozon Pay/COD',events:'Black Friday, New Year'},
'Wildberries':{growth:'+38.2%',risk:'mid',shipping:'FBO仓储模式',entry:'需俄罗斯公司',priceRange:'$5-50',hotCats:['服饰','鞋靴','美妆'],blueCats:['家居装饰','运动'],founded:'2004',users:'1.3亿/月',payments:'银行卡/WB Wallet/COD',events:'Black Friday, 新年促销'},
'Coupang':{growth:'+18.6%',risk:'low',shipping:'Rocket Delivery自建物流',entry:'需韩国公司/代理',priceRange:'$10-80',hotCats:['食品','日用','电子'],blueCats:['保健品','宠物'],founded:'2010',users:'3000万/月',payments:'信用卡/银行转账/Coupang Pay',events:'Black Friday, 年末大促'},
'Gmarket':{growth:'+8.3%',risk:'low',shipping:'韩国本土配送',entry:'需韩国公司',priceRange:'$15-100',hotCats:['电子产品','时尚','美妆'],blueCats:['设计师品牌','健康食品'],founded:'2000',users:'1800万/月',payments:'信用卡/银行转账/SmilePay',events:'Super Sale, 年中/年末大促'},
'Allegro':{growth:'+22.5%',risk:'low',shipping:'本土仓+Allegro物流',entry:'需欧盟公司',priceRange:'€5-80',hotCats:['电子','家居','母婴'],blueCats:['户外','汽车配件'],founded:'1999',users:'2200万/月',payments:'BLIK/银行转账/信用卡',events:'Black Friday, Smart Weekend'},
'eMAG':{growth:'+26.3%',risk:'low',shipping:'本土仓+eMAG Fulfillment',entry:'需罗马尼亚公司',priceRange:'€10-80',hotCats:['电子','家居','运动'],blueCats:['DIY工具','美妆'],founded:'2001',users:'1200万/月',payments:'银行转账/信用卡/COD',events:'eMAG Days, Black Friday'},
'Zalora':{growth:'+16.2%',risk:'low',shipping:'本土仓+跨境',entry:'品牌/经销商入驻',priceRange:'$10-60',hotCats:['时尚服饰','美妆','鞋靴'],blueCats:['运动休闲','设计师品牌'],founded:'2012',users:'1500万/月',payments:'COD/信用卡/Zalora Wallet',events:'ZALORA Sale, 年中大促'},
'Flipkart':{growth:'+25.4%',risk:'low',shipping:'Ekart物流+本土仓',entry:'需印度公司(GST)',priceRange:'₹200-5000',hotCats:['电子','服饰','家居'],blueCats:['食品杂货','健康'],founded:'2007',users:'2.5亿/月',payments:'PhonePe/UPI/COD/信用卡',events:'Big Billion Days, Diwali Sale'},
'Meesho':{growth:'+52.8%',risk:'mid',shipping:'卖家自发+第三方物流',entry:'印度本土卖家',priceRange:'₹100-1000',hotCats:['低价服饰','家居','配饰'],blueCats:['手工艺品','本地品牌'],founded:'2015',users:'1.2亿/月',payments:'UPI/COD/银行转账',events:'Meesho Sale, Festival Sale'},
'Jumia':{growth:'+19.6%',risk:'high',shipping:'Jumia物流+COD',entry:'非洲本地公司',priceRange:'$5-40',hotCats:['电子','时尚','家居'],blueCats:['太阳能产品','手机配件'],founded:'2012',users:'3000万/月',payments:'COD/信用卡/JumiaPay',events:'Black Friday, Ramadan Sale'},
'Kilimall':{growth:'+31.5%',risk:'mid',shipping:'东非本土仓',entry:'肯尼亚/乌干达本地',priceRange:'$3-30',hotCats:['手机配件','服饰','家居'],blueCats:['中国小商品','美妆'],founded:'2014',users:'800万/月',payments:'M-Pesa/COD/信用卡',events:'Black Friday, 周年庆典'},
'Amazon北美站':{growth:'+9.5%',risk:'low',shipping:'FBA+FBM',entry:'跨境店可入驻',priceRange:'$10-100',hotCats:['电子','家居','美妆'],blueCats:['宠物','户外','健康'],founded:'1994',users:'3.1亿/月',payments:'信用卡/Amazon Pay/Afterpay',events:'Prime Day, Black Friday, Cyber Monday'},
'Amazon欧洲站':{growth:'+7.8%',risk:'low',shipping:'FBA欧洲仓',entry:'需VAT/EORI号',priceRange:'€10-80',hotCats:['家居','电子','服饰'],blueCats:['有机食品','环保产品'],founded:'1998(英国)',users:'2.5亿/月',payments:'信用卡/银行转账/Amazon Pay',events:'Prime Day, Black Friday'},
'Amazon日本站':{growth:'+6.2%',risk:'low',shipping:'FBA日本仓',entry:'跨境可入驻(需日文)',priceRange:'¥1000-10000',hotCats:['电子','家居','动漫周边'],blueCats:['保健品','户外'],founded:'2000',users:'6500万/月',payments:'信用卡/便利店支付/Amazon Pay',events:'Prime Day, Black Friday, 年末'},
'Shopee巴西':{growth:'+58.3%',risk:'mid',shipping:'SLS+本土仓',entry:'跨境可入驻',priceRange:'R$20-100',hotCats:['电子','服饰','美妆'],blueCats:['家居','运动'],founded:'2019(巴西)',users:'3000万/月',payments:'PIX/Boleto/信用卡',events:'Black Friday, Shopee 11.11'},
'Kaspi.kz':{growth:'+42.1%',risk:'low',shipping:'本土配送',entry:'需哈萨克斯坦公司',priceRange:'$10-60',hotCats:['电子','家居','日用'],blueCats:['健身','宠物'],founded:'2002(电商2018)',users:'1300万/月',payments:'Kaspi Pay/银行卡',events:'Nauryz Sale, Black Friday'},
'Yandex Market':{growth:'+35.6%',risk:'mid',shipping:'Yandex Delivery',entry:'俄罗斯公司优先',priceRange:'$5-50',hotCats:['电子','家居','食品'],blueCats:['中国3C','运动'],founded:'2000',users:'4500万/月',payments:'Yandex Pay/银行卡/COD',events:'Black Friday, New Year Sale'},
'Trendyol':{growth:'+48.9%',risk:'low',shipping:'本土仓+Trendyol Express',entry:'需土耳其公司',priceRange:'$5-40',hotCats:['时尚','家居','美妆'],blueCats:['食品','电子产品'],founded:'2010',users:'3500万/月',payments:'信用卡/银行转账/COD',events:'Trendyol Sale, Black Friday'},
'Hepsiburada':{growth:'+22.7%',risk:'low',shipping:'本土仓+HepsiJet',entry:'需土耳其公司',priceRange:'$10-60',hotCats:['电子','家居','食品'],blueCats:['母婴','户外'],founded:'2000',users:'2000万/月',payments:'信用卡/银行转账/COD',events:'Black Friday, 年中大促'},
'Salla':{growth:'+62.4%',risk:'low',shipping:'商家自发+Salla Ship',entry:'沙特本地公司',priceRange:'$10-80',hotCats:['时尚','香水','电子'],blueCats:['有机食品','健康'],founded:'2015',users:'800万/月',payments:'Mada/Apple Pay/Tamara',events:'Saudi National Day, Ramadan'},
'MyNavi/日本内容电商':{growth:'+38.5%',risk:'low',shipping:'本土配送',entry:'需日本公司',priceRange:'¥2000-8000',hotCats:['美妆','时尚','食品'],blueCats:['健康保健','宠物'],founded:'2012',users:'1200万/月',payments:'信用卡/便利店支付/PayPay',events:'Super Sale, 年末'},
'Grabi/泰国内容电商':{growth:'+55.2%',risk:'mid',shipping:'泰国本土仓',entry:'泰国本地公司',priceRange:'฿100-1000',hotCats:['美妆','食品','时尚'],blueCats:['健康','家居'],founded:'2020',users:'500万/月',payments:'PromptPay/COD/信用卡',events:'Songkran Sale, 11.11'},
'Shopify独立站生态':{growth:'+25.3%',risk:'low',shipping:'商家自选3PL',entry:'无门槛(付费建站)',priceRange:'$10-200',hotCats:['DTC品牌','时尚','美妆'],blueCats:['订阅盒子','定制品'],founded:'2006',users:'N/A(独立站)',payments:'Shopify Payments/PayPal/Afterpay',events:'Shop Now, Black Friday'},
'MakeShop/日本':{growth:'+15.8%',risk:'low',shipping:'本土配送',entry:'日本公司',priceRange:'¥1500-6000',hotCats:['美妆','食品','家居'],blueCats:['宠物','健康'],founded:'2000',users:'600万/月',payments:'信用卡/便利店支付/银行转账',events:'年末大促, 夏季特卖'},
'BASE/日本':{growth:'+28.6%',risk:'low',shipping:'本土配送',entry:'日本个人/公司均可',priceRange:'¥1000-5000',hotCats:['手工艺品','设计师品牌','食品'],blueCats:['古着','独立品牌'],founded:'2012',users:'400万/月',payments:'信用卡/便利店支付/PayPay',events:'BASE Sale, 年末'},
'Storenvy':{growth:'+12.5%',risk:'low',shipping:'商家自发',entry:'全球卖家可入驻',priceRange:'$10-60',hotCats:['独立设计','手工艺品','复古'],blueCats:['Z世代潮牌','环保产品'],founded:'2010',users:'300万/月',payments:'信用卡/PayPal',events:'Holiday Market, Spring Sale'},
'BigCommerce':{growth:'+18.3%',risk:'low',shipping:'商家自选3PL',entry:'无门槛(SaaS建站)',priceRange:'$15-150',hotCats:['B2B','工业品','品牌DTC'],blueCats:['订阅服务','数字产品'],founded:'2009',users:'N/A(独立站)',payments:'Stripe/PayPal/Square',events:'根据商家自定义'},
'Faspify':{growth:'+120.5%',risk:'mid',shipping:'极简结算+3PL对接',entry:'无门槛(轻量建站)',priceRange:'$5-80',hotCats:['数字产品','订阅','小型DTC'],blueCats:['创作者经济','NFT衍生'],founded:'2022',users:'100万/月',payments:'信用卡/PayPal/Apple Pay',events:'平台促销期'},
'Socios Live/拉美社交电商':{growth:'+88.3%',risk:'high',shipping:'本土仓+社交分销',entry:'拉美本地公司',priceRange:'$5-30',hotCats:['美妆','服饰','食品'],blueCats:['健康','家居'],founded:'2021',users:'200万/月',payments:'PIX/梅卡多 Pago/COD',events:'社交裂变促销期'},
'Kwai Shop/拉美':{growth:'+125.6%',risk:'high',shipping:'跨境直邮+本土仓',entry:'跨境/本土均可',priceRange:'$3-25',hotCats:['美妆','时尚配饰','3C'],blueCats:['小家电','运动'],founded:'2022',users:'3500万/月',payments:'PIX/Boleto/COD/信用卡',events:'Kwai 大促, Carnival Sale'}
};
"""

# Insert after platformsData array - find the ]];\n before macroData
pd_end = data.find(b"]];\nconst macroData=[")
if pd_end < 0:
    pd_end = data.find(b"]];\nconst macroData")
insert_pos = pd_end + 3  # after ]];
data = data[:insert_pos] + ext_data.encode('utf-8') + data[insert_pos:]
print("Extended data inserted")

# Recalculate all positions
ext_len = len(ext_data.encode('utf-8'))

# ============================================================
# 3. HTML - replace the platforms section
# ============================================================
html_old_start = data.find(b'<section id="platforms"')
html_old_end = data.find(b'</section>', html_old_start) + len(b'</section>')

html_new = """<section id="platforms" class="page">
      <div class="pf-top-bar">
        <div><p class="eyebrow">PLATFORM ARCHIVE</p><h2>全球电商平台档案</h2></div>
        <div class="pf-search-box">
          <input type="text" id="pf-search" placeholder="搜索平台名称...">
          <button class="filter-button" onclick="pfSearch()">搜索</button>
          <button class="filter-button" onclick="pfExportReport()" style="background:var(--green)">导出报告</button>
        </div>
      </div>
      <div class="pf-ai-panel" id="pf-ai-panel">
        <div class="pf-ai-tabs" id="pf-ai-tabs"></div>
        <div class="pf-ai-content" id="pf-ai-content"></div>
      </div>
      <div class="pf-stats-row" id="pf-stats-row"></div>
      <div class="pf-filter-bar" id="pf-filter-bar">
        <span class="pf-filter-label">区域</span>
        <select id="pf-f-region"><option value="all">全部区域</option></select>
        <span class="pf-filter-label">类型</span>
        <select id="pf-f-type"><option value="all">全部类型</option></select>
        <span class="pf-filter-label">电商模式</span>
        <select id="pf-f-model"><option value="all">全部模式</option><option value="content">内容电商</option><option value="shelf">货架电商</option><option value="independent">独立站</option></select>
        <span class="pf-filter-label">佣金</span>
        <select id="pf-f-fee"><option value="all">全部</option><option value="0-5">0-5%</option><option value="5-10">5-10%</option><option value="10+">10%+</option></select>
        <span class="pf-filter-label">风险</span>
        <select id="pf-f-risk"><option value="all">全部</option><option value="high">高风险</option><option value="mid">中风险</option><option value="low">低风险</option></select>
        <button class="filter-button" onclick="pfFilterChange()">筛选</button>
        <button class="filter-button" onclick="pfClearFilters()" style="background:#eee;color:#666">重置</button>
        <span id="pf-filter-count" style="font-size:.78rem;color:#888;margin-left:auto"></span>
      </div>
      <div class="pf-batch-bar" id="pf-batch-bar">
        <button onclick="pfBatchWatch()">加入看板监控</button>
        <button onclick="pfBatchAlert()">开启预警</button>
        <span class="pf-selected-count" id="pf-selected-count"></span>
      </div>
      <div class="pf-grid" id="pf-grid"></div>
      <div class="pf-pagination" id="pf-pagination"></div>
      <div class="pf-empty" id="pf-empty" style="display:none">
        <p>当前筛选条件下暂无匹配平台</p>
        <button onclick="pfClearFilters()">清除筛选条件</button>
      </div>
    </section>
    <div class="pf-detail-overlay" id="pf-detail-overlay" onclick="if(event.target===this)closePfDetail()">
      <div class="pf-detail-modal" id="pf-detail-modal"></div>
    </div>"""

data = data[:html_old_start] + html_new.encode('utf-8') + data[html_old_end:]
print("HTML replaced")

# ============================================================
# 4. JS - replace old renderPlatforms block with full new logic
# ============================================================
# Find the old block: from "// -- 电商平台档案 --" to just before the next "// --"
# We need to recalculate positions since data has shifted
js_old_marker = b"fillSelect('#pf-region'"
js_old_start_pos = data.rfind(b'// --', 0, data.find(js_old_marker))
# Find end: the next section comment
js_old_end_pos = data.find(b'\n// --', data.find(js_old_marker) + 100)
if js_old_end_pos < 0:
    js_old_end_pos = data.find(b'\nfunction switchPage', data.find(js_old_marker))

# Build new JS block
js_new = r"""
// -- 电商平台档案 (Full Rebuild) --
// Populate enhanced filter selects
fillSelect('#pf-f-region',[...new Set(platformsData.map(p=>p[1])).sort());
fillSelect('#pf-f-type',[...new Set(platformsData.map(p=>p[6])).sort());

// State
let pfCurrentPage=1, pfPerPage=12, pfSelected=new Set(), pfAiTab=0;
const pfAiTabs=['全球平台增长总结','高潜力新平台推荐','高佣金/低利润风险提醒'];
const pfAiData=[
  ['Temu 全球 GMV 同比增长 +183.5%，成为增速最快平台，但面临欧盟 DSA 合规压力和美国关税政策不确定性。','TikTok Shop 东南亚 GMV 增速 +65.2%，内容电商模式持续爆发，建议重点关注美妆和小家电赛道。','Kwai Shop 拉美增速 +125.6%，短视频电商在巴西/墨西哥快速渗透，蓝海窗口期约 12-18 个月。'],
  ['Socios Live（拉美社交电商）增速 +88.3%，社交分销模式适合低客单价快消品，入驻门槛低。','Faspify 增速 +120.5%，极简结账适配数字产品和订阅模式，适合创作者经济卖家。','Kwai Shop 拉美月活 3500 万，内容电商+社交裂变，适合美妆/时尚/小家电品类先行试水。'],
  ['Walmart Marketplace 佣金 10%，WFS 仓储费附加，综合成本偏高但流量稳定。','TikTok Shop 佣金 5-8% 较低，但需投入短视频内容制作成本，实际运营成本不低。','SHEIN 供应商模式利润空间被压缩至 15-20%，适合有供应链优势的工厂型卖家。']
];

function pfGetExt(name){return pfExtData[name]||{growth:'N/A',risk:'low',shipping:'N/A',entry:'N/A',priceRange:'N/A',hotCats:[],blueCats:[],founded:'N/A',users:'N/A',payments:'N/A',events:'N/A'};}

function pfFormatGmv(gmv){const g=parseFloat(gmv)||0;return g>=100?g.toFixed(0)+'亿$':g.toFixed(1)+'亿$';}
function pfFormatMau(mau){const m=parseFloat(mau)||0;return m>=10000?(m/10000).toFixed(1)+'亿':m>=1000?(m/1000).toFixed(1)+'千万':m+'万';}

function pfGetFiltered(){
  const search=$('#pf-search').value.toLowerCase();
  const region=$('#pf-f-region').value, type=$('#pf-f-type').value;
  const model=$('#pf-f-model').value, fee=$('#pf-f-fee').value, risk=$('#pf-f-risk').value;
  return platformsData.filter(p=>{
    const ext=pfGetExt(p[0]);
    if(search && !p[0].toLowerCase().includes(search) && !p[2].toLowerCase().includes(search))return false;
    if(region!=='all' && !p[1].includes(region))return false;
    if(type!=='all' && p[6]!==type)return false;
    if(model==='content' && p[6]!=='内容电商')return false;
    if(model==='shelf' && p[6]!=='货架电商')return false;
    if(model==='independent' && !p[6].includes('独立站'))return false;
    const f=parseFloat(p[4])||0;
    if(fee==='0-5' && f>5)return false;
    if(fee==='5-10' && (f<5||f>10))return false;
    if(fee==='10+' && f<10)return false;
    if(risk!=='all' && ext.risk!==risk)return false;
    return true;
  });
}

function renderPfStats(){
  const total=platformsData.length;
  const content=platformsData.filter(p=>p[6]==='内容电商').length;
  const shelf=total-content;
  const totalGmv=platformsData.reduce((s,p)=>s+(parseFloat(p[3])||0),0);
  const highGrowth=platformsData.filter(p=>{const e=pfGetExt(p[0]);const g=parseFloat(e.growth)||0;return g>=30;}).length;
  const lowFee=platformsData.filter(p=>(parseFloat(p[4])||99)<6).length;
  $('#pf-stats-row').innerHTML=`
    <div class="pf-stat-card"><div class="pf-stat-val">${total}</div><div class="pf-stat-label">收录平台总量</div><div class="pf-stat-sub">内容电商 ${content} / 货架 ${shelf}</div></div>
    <div class="pf-stat-card"><div class="pf-stat-val">${totalGmv.toFixed(0)}亿$</div><div class="pf-stat-label">全球总 GMV</div><div class="pf-stat-sub">年度增速 +18.6%</div></div>
    <div class="pf-stat-card"><div class="pf-stat-val">${highGrowth}</div><div class="pf-stat-label">高增长平台</div><div class="pf-stat-sub">年增速 ≥30%</div></div>
    <div class="pf-stat-card"><div class="pf-stat-val">${lowFee}</div><div class="pf-stat-label">低佣金平台</div><div class="pf-stat-sub">平均佣金 < 6%</div></div>`;
}

function renderPfAi(){
  let tabsHtml=pfAiTabs.map((t,i)=>`<span class="pf-ai-tab${i===pfAiTab?' active':''}" onclick="pfSwitchAiTab(${i})">${t}</span>`).join('');
  tabsHtml+=`<span style="margin-left:auto;font-size:.72rem;color:#888;cursor:pointer" onclick="pfSwitchAiTab(${(pfAiTab+1)%3})">🔄 重新生成</span>`;
  $('#pf-ai-tabs').innerHTML=tabsHtml;
  const items=pfAiData[pfAiTab].map(item=>{
    const name=item.split(' ')[0];
    return `<div class="ai-item">${item}<span class="ai-btn" onclick="openPfDetailByName('${name}')">查看平台</span><span class="ai-btn" onclick="toast('已加入预警监控')">加入预警</span></div>`;
  }).join('');
  $('#pf-ai-content').innerHTML=items;
}
function pfSwitchAiTab(i){pfAiTab=i;renderPfAi();}

function renderPfGrid(){
  const filtered=pfGetFiltered();
  const total=filtered.length;
  const totalPages=Math.ceil(total/pfPerPage)||1;
  if(pfCurrentPage>totalPages)pfCurrentPage=totalPages;
  const start=(pfCurrentPage-1)*pfPerPage;
  const pageData=filtered.slice(start,start+pfPerPage);

  if(total===0){
    $('#pf-grid').innerHTML='';
    $('#pf-empty').style.display='block';
    $('#pf-pagination').innerHTML='';
    $('#pf-filter-count').textContent='0 个平台';
    return;
  }
  $('#pf-empty').style.display='none';
  $('#pf-filter-count').textContent=total+' 个平台';

  $('#pf-grid').innerHTML=pageData.map(p=>{
    const ext=pfGetExt(p[0]);
    const gmv=pfFormatGmv(p[3]);
    const mau=p[7]?pfFormatMau(p[7]):'N/A';
    const isContent=p[6]==='内容电商';
    const cardClass=isContent?'type-content':'type-shelf';
    const badgeClass=isContent?'badge-content':'';
    const riskClass='risk-'+(ext.risk||'low');
    const growthStr=ext.growth||'N/A';
    const growthNum=parseFloat(growthStr)||0;
    const growthColor=growthNum>=0?'val-up':'val-down';
    const growthArrow=growthNum>=0?'↑':'↓';
    const hotCatsHtml=(ext.hotCats||[]).slice(0,2).map(c=>`<span class="cat-hot">${c}</span>`).join(' ');
    const blueCatsHtml=(ext.blueCats||[]).slice(0,2).map(c=>`<span class="cat-blue">${c}</span>`).join(' ');
    const checked=pfSelected.has(p[0])?'checked':'';
    return `<div class="pf-card ${cardClass}">
      <div class="pf-risk-bar ${riskClass}"></div>
      <input type="checkbox" class="pf-card-check" ${checked} onclick="event.stopPropagation();pfToggleSelect('${p[0].replace(/'/g,"\\'")}')">
      <div class="pf-card-head"><h3>${p[0]}</h3><span class="pf-card-badge ${badgeClass}">${p[6]}</span></div>
      <div class="pf-card-meta">${p[1]} · 佣金 ${p[4]}% · ${ext.shipping||'N/A'}</div>
      <div class="pf-card-cats">🔥 ${hotCatsHtml} 💎 ${blueCatsHtml}</div>
      <div class="pf-card-data">
        <div class="pf-data-item">全球GMV<b>${gmv}</b></div>
        <div class="pf-data-item">月活用户<b>${mau}</b></div>
        <div class="pf-data-item">增速<b class="${growthColor}">${growthArrow} ${growthStr}</b></div>
        <div class="pf-data-item">客单价<b>${ext.priceRange||'N/A'}</b></div>
      </div>
      <div class="pf-card-ops">
        <button onclick="event.stopPropagation();openPfDetail('${p[0].replace(/'/g,"\\'")}')">查看详情</button>
        <button class="btn-ai" onclick="event.stopPropagation();pfAiDiagnosis('${p[0].replace(/'/g,"\\'")}')">AI 诊断</button>
        <button onclick="event.stopPropagation();pfAddWatch('${p[0].replace(/'/g,"\\'")}')">加入看板</button>
      </div>
    </div>`;
  }).join('');

  // Pagination
  let pagHtml=`<button ${pfCurrentPage<=1?'disabled':''} onclick="pfGoPage(${pfCurrentPage-1})">‹</button>`;
  for(let i=1;i<=totalPages;i++){
    if(totalPages>7 && i>2 && i<totalPages-1 && Math.abs(i-pfCurrentPage)>1){
      if(i===3||i===totalPages-2)pagHtml+=`<span>…</span>`;
      continue;
    }
    pagHtml+=`<button class="${i===pfCurrentPage?'active':''}" onclick="pfGoPage(${i})">${i}</button>`;
  }
  pagHtml+=`<button ${pfCurrentPage>=totalPages?'disabled':''} onclick="pfGoPage(${pfCurrentPage+1})">›</button>`;
  $('#pf-pagination').innerHTML=pagHtml;
}

function pfGoPage(n){pfCurrentPage=n;renderPfGrid();window.scrollTo({top:$('#pf-grid').offsetTop-100,behavior:'smooth'});}
function pfToggleSelect(name){if(pfSelected.has(name))pfSelected.delete(name);else pfSelected.add(name);$('#pf-selected-count').textContent=pfSelected.size?`已选 ${pfSelected.size} 个`:'';renderPfGrid();}
function pfSearch(){pfCurrentPage=1;renderPfGrid();}
function pfFilterChange(){pfCurrentPage=1;renderPfGrid();}
function pfClearFilters(){$('#pf-search').value='';$('#pf-f-region').value='all';$('#pf-f-type').value='all';$('#pf-f-model').value='all';$('#pf-f-fee').value='all';$('#pf-f-risk').value='all';pfCurrentPage=1;renderPfGrid();toast('筛选条件已重置');}
function pfExportReport(){toast('平台档案报告导出功能（企业版）');}
function pfBatchWatch(){if(!pfSelected.size){toast('请先选择平台');return;}toast(`已将 ${pfSelected.size} 个平台加入看板监控`);pfSelected.clear();$('#pf-selected-count').textContent='';renderPfGrid();}
function pfBatchAlert(){if(!pfSelected.size){toast('请先选择平台');return;}toast(`已为 ${pfSelected.size} 个平台开启预警监控`);pfSelected.clear();$('#pf-selected-count').textContent='';renderPfGrid();}
function pfAddWatch(name){toast(`${name} 已加入看板`);}

function openPfDetail(name){
  const p=platformsData.find(x=>x[0]===name);
  if(!p)return;
  const ext=pfGetExt(name);
  const gmv=pfFormatGmv(p[3]);
  const mau=p[7]?pfFormatMau(p[7]):'N/A';
  const growthStr=ext.growth||'N/A';
  const growthNum=parseFloat(growthStr)||0;
  const growthColor=growthNum>=0?'color:var(--green)':'color:#e05a3a';
  const riskLabel={high:'高风险',mid:'中风险',low:'低风险'}[ext.risk]||'普通';
  const riskTagClass={high:'tag-high',mid:'tag-mid',low:'tag-low'}[ext.risk]||'tag-low';

  let html=`<button class="pf-detail-close" onclick="closePfDetail()">✕</button>
    <h2>${name}</h2>
    <div class="pf-detail-sub">${p[1]} · ${p[6]} · <span class="pf-risk-tag ${riskTagClass}">${riskLabel}</span> · 数据基于 2026 Q2</div>

    <div class="pf-detail-section"><h4>📊 平台基础全景</h4>
      <div class="pf-detail-grid">
        <div class="pf-detail-item"><b>覆盖区域：</b>${p[1]}</div>
        <div class="pf-detail-item"><b>成立年份：</b>${ext.founded}</div>
        <div class="pf-detail-item"><b>月活用户：</b>${mau}</div>
        <div class="pf-detail-item"><b>全球 GMV：</b>${gmv} <span style="${growthColor}">(${growthStr})</span></div>
        <div class="pf-detail-item"><b>主流支付：</b>${ext.payments}</div>
        <div class="pf-detail-item"><b>大促节点：</b>${ext.events}</div>
        <div class="pf-detail-item"><b>发货模式：</b>${ext.shipping}</div>
        <div class="pf-detail-item"><b>入驻门槛：</b>${ext.entry}</div>
      </div>
    </div>

    <div class="pf-detail-section"><h4>🏷️ 类目深度数据</h4>
      <div class="pf-detail-grid">
        <div class="pf-detail-item"><b>核心类目：</b>${p[2]}</div>
        <div class="pf-detail-item"><b>平均佣金率：</b>${p[4]}%</div>
        <div class="pf-detail-item"><b>🔥 热门(红海)类目：</b>${(ext.hotCats||[]).join('、')||'N/A'}</div>
        <div class="pf-detail-item"><b>💎 蓝海增长类目：</b>${(ext.blueCats||[]).join('、')||'N/A'}</div>
      </div>
    </div>

    <div class="pf-detail-section"><h4>📋 入驻与运营规则</h4>
      <div class="pf-detail-item"><b>入驻要求：</b>${ext.entry}</div>
      <div class="pf-detail-item"><b>物流模式：</b>${ext.shipping}</div>
      <div class="pf-detail-item"><b>客单价区间：</b>${ext.priceRange}</div>
      <div class="pf-detail-item" style="margin-top:8px"><b>近期政策动态：</b><br>${p[8]?p[8].replace(/\n/g,'<br>'):'暂无更新'}</div>
    </div>

    <div class="pf-detail-section"><h4>💰 成本 & 利润参考</h4>
      <table><tr><th>费用项</th><th>参考值</th></tr>
      <tr><td>平台佣金</td><td>${p[4]}%（${p[5].substring(0,50)}...）</td></tr>
      <tr><td>客单价区间</td><td>${ext.priceRange}</td></tr>
      <tr><td>物流均价</td><td>因模式和目的地而异</td></tr>
      <tr><td>综合毛利率参考</td><td>15-35%（视品类）</td></tr>
      </table>
    </div>

    <div class="pf-detail-section"><h4>⚠️ 政策 & 风险提示</h4>
      <div style="margin-bottom:8px">
        <span class="pf-risk-tag ${riskTagClass}">${riskLabel}</span>
        ${ext.risk==='high'?'<span style="font-size:.8rem;color:#c0392b">该平台存在较高合规/竞争风险，建议充分评估后入场</span>':''}
        ${ext.risk==='mid'?'<span style="font-size:.8rem;color:#8a6d00">竞争较激烈或存在一定政策不确定性，需关注动态</span>':''}
        ${ext.risk==='low'?'<span style="font-size:.8rem;color:#2d5f50">运营环境相对稳定，适合中长期布局</span>':''}
      </div>
      <div class="pf-detail-item"><b>佣金政策：</b>${p[5].substring(0,100)}...</div>
    </div>

    <div class="pf-detail-section">
      <button class="filter-button" style="background:var(--green);margin-right:8px" onclick="pfAiDiagnosisDetail('${name.replace(/'/g,"\\'")}')">AI 深度诊断</button>
      <button class="filter-button" onclick="pfAddWatch('${name.replace(/'/g,"\\'")}')">加入看板监控</button>
      <div id="pf-ai-detail-result"></div>
    </div>`;

  $('#pf-detail-modal').innerHTML=html;
  $('#pf-detail-overlay').classList.add('show');
}
function closePfDetail(){$('#pf-detail-overlay').classList.remove('show');}
function openPfDetailByName(name){const p=platformsData.find(x=>x[0].toLowerCase().includes(name.toLowerCase()));if(p)openPfDetail(p[0]);else toast('未找到匹配平台');}

function pfAiDiagnosis(name){
  const p=platformsData.find(x=>x[0]===name);
  if(!p)return;
  const ext=pfGetExt(name);
  const analysis=`<div class="pf-ai-diagnosis"><h5>🤖 AI 平台诊断 - ${name}</h5>
    <b>入驻建议：</b>${ext.risk==='high'?'该平台风险较高，建议小规模测试后再决定是否大规模投入。':'平台环境较友好，建议优先布局。'}<br>
    <b>推荐类目：</b>${(ext.blueCats||[]).join('、')||p[2]}<br>
    <b>预算分配建议：</b>初期建议月投 $3,000-5,000，以 ${ext.blueCats?.[0]||'核心类目'} 为突破口<br>
    <b>风险提示：</b>${ext.risk==='high'?'合规风险+竞争双重压力，需密切关注政策变化':ext.risk==='mid'?'竞争中等，需在差异化选品和运营效率上建立优势':'环境稳定，适合长期深耕'}</div>`;
  // Show as a toast-like overlay
  const div=document.createElement('div');
  div.innerHTML=analysis;
  div.style.cssText='position:fixed;bottom:80px;right:20px;z-index:3000;max-width:400px;animation:fadeIn .3s';
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),8000);
}

function pfAiDiagnosisDetail(name){
  const p=platformsData.find(x=>x[0]===name);
  if(!p)return;
  const ext=pfGetExt(name);
  const gmv=pfFormatGmv(p[3]);
  $('#pf-ai-detail-result').innerHTML=`<div class="pf-ai-diagnosis"><h5>🤖 AI 深度诊断报告 - ${name}</h5>
    <b>一、市场定位：</b>${name} 是 ${p[1]} 地区${p[6]}平台，全球 GMV 达 ${gmv}，增速 ${ext.growth}。<br><br>
    <b>二、入驻策略：</b>${ext.entry}。建议以${(ext.blueCats||[])[0]||'核心类目'}为切入点，客单价定位 ${ext.priceRange} 区间。<br><br>
    <b>三、选品建议：</b>优先布局蓝海类目 ${(ext.blueCats||[]).join('、')}，规避红海类目 ${(ext.hotCats||[]).join('、')} 的价格战。<br><br>
    <b>四、预算分配：</b>平台佣金 ${p[4]}% + 物流 + 推广，建议综合毛利率目标 25-35%。初期月预算 $5,000-10,000。<br><br>
    <b>五、风险规避：</b>${ext.risk==='high'?'⚠️ 高风险平台，需特别关注合规要求和政策变动，建议预留 20% 风险准备金。':ext.risk==='mid'?'中等风险，关注竞争格局变化和政策更新，保持灵活调整。':'低风险，运营环境稳定，适合中长期战略布局。'}<br><br>
    <b>六、避坑方案：</b>注意 ${p[5].substring(0,60)}... 等费用结构，提前做好成本核算。</div>`;
}

function renderPlatforms(){
  renderPfStats();
  renderPfAi();
  renderPfGrid();
}
renderPlatforms();
"""

data = data[:js_old_start_pos] + js_new.encode('utf-8') + data[js_old_end_pos:]
print("JS replaced")

# ============================================================
# 5. Update switchPage to call renderPlatforms
# ============================================================
sp_marker = b"if(name==='alerts')renderAlerts();"
sp_pos = data.find(sp_marker)
if sp_pos >= 0:
    insert = sp_marker + b"\nif(name==='platforms')renderPlatforms();"
    data = data[:sp_pos] + insert + data[sp_pos+len(sp_marker):]
    print("switchPage updated")
else:
    print("WARNING: switchPage marker not found")

# ============================================================
# 6. Write and verify
# ============================================================
open('index.html','wb').write(data)
print(f"\nFinal file size: {len(data)} bytes")

# Quick JS syntax check - look for obvious issues
import re
# Check for unescaped newlines in template literals
js_start = data.find(b'<script>')
js_end = data.find(b'</script>')
js_content = data[js_start:js_end]
# Count braces
opens = js_content.count(b'{')
closes = js_content.count(b'}')
print(f"JS braces: {{ = {opens}, }} = {closes}, balanced = {opens==closes}")

# Check for literal newlines in onclick
bad_onclick = len(re.findall(b'onclick="[^"]*\n[^"]*"', data))
print(f"Broken onclick with literal newlines: {bad_onclick}")

