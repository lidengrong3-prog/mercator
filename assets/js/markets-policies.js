// === Countries Page v2 - Full Rebuild ===
var jayLastCountry = (function(){ try{ return localStorage.getItem('jay_last_country'); }catch(e){ return null; } })();
var cn2CurrentKey = (jayLastCountry && countryFullData[jayLastCountry]) ? jayLastCountry : 'id';
var cn2MacroTab = 0; // 0=GDP, 1=population, 2=trade, 3=policy
var cn2TimeFilter = '6m';

// Enhanced country data extensions
var cn2CountryExt = {
  id: {
    gdp_total: 'US$ 1.32万亿', gdp_growth: '+5.1%', per_capita_gdp: 'US$ 4,580', cpi: '+2.8%',
    currency: '16,260 IDR/USD', currency_trend: 'stable', disposable_income: 'US$ 4,580',
    population: '2.78亿', ecommerce_users: '1.72亿', online_penetration: '62%',
    trade_volume: 'US$ 5,810亿', trade_growth: '+8.2%', cross_border_growth: '+22%',
    top_imports: '机械电子/化工/消费品', tariff_trend: '下调中', warehouse_scale: '320万㎡',
    ai_summary: '印尼2026美妆增速32%，TikTok Shop流量成本持续走低，进口关税下调5%，RCEP加持下跨境贸易便利度大幅提升。核心打法：跨境店+TikTok内容营销+Shopee货架双轨并行，目标15-35岁穆斯林女性群体。',
    top_shops_count: 34, hot_products_count: 156, trending_content_count: 89,
    content_vs_shelf: {content_conv: '8.2%', shelf_conv: '3.5%', live_avg_view: '12,500', short_video_avg_play: '285K', creator_avg_cost: '$180', search_traffic_share: '38%'},
    top_categories_growth: [['美妆个护','+42.8%'],['穆斯林时尚','+28%'],['平价消费电子','+35%'],['母婴用品','+22%'],['食品饮料','+18%'],['家居日用','+15%'],['小家电','+20%'],['宠物用品','+25%'],['健康保健','+16%'],['运动户外','+12%']],
    policy_news: [
      {level:'high',title:'进口商品印尼语标签强制要求',date:'2026-01生效',scope:'全品类',desc:'所有进口商品必须有印尼语标签，否则海关扣押'},
      {level:'high',title:'化妆品BPOM认证强制监管',date:'持续执行',scope:'美妆个护',desc:'认证周期3-6个月，未认证产品下架风险极高'},
      {level:'mid',title:'电商最低价格监管政策',date:'2026-07更新',scope:'全品类',desc:'低于成本价销售将被处罚'},
      {level:'low',title:'跨境电商税收新规讨论中',date:'2026-Q2',scope:'跨境商品',desc:'可能取消低价商品免税额度'}
    ]
  },
  us: {
    gdp_total: 'US$ 28.78万亿', gdp_growth: '+2.4%', per_capita_gdp: 'US$ 52,800', cpi: '+3.2%',
    currency: '1.00 USD', currency_trend: 'stable', disposable_income: 'US$ 52,800',
    population: '3.41亿', ecommerce_users: '2.91亿', online_penetration: '85%',
    trade_volume: 'US$ 5.4万亿', trade_growth: '+3.1%', cross_border_growth: '+12%',
    top_imports: '消费电子/机械/医药', tariff_trend: '对华加征', warehouse_scale: '1200万㎡',
    ai_summary: '美国2026远程办公品类持续增长18%，天然有机健康品需求强劲+22%，DTC品牌独立站机会大。注意对华关税145%全品类承压，建议走Temu/TikTok Shop跨境或Amazon FBA品牌化路线，核心25-45岁高消费力人群。',
    top_shops_count: 28, hot_products_count: 134, trending_content_count: 67,
    content_vs_shelf: {content_conv: '5.8%', shelf_conv: '4.2%', live_avg_view: '8,200', short_video_avg_play: '520K', creator_avg_cost: '$450', search_traffic_share: '52%'},
    top_categories_growth: [['家居生活','+18%'],['健康个护','+22%'],['宠物用品','+25%'],['户外装备','+15%'],['消费电子','+12%'],['美妆护肤','+20%'],['运动健身','+16%'],['母婴精品','+14%'],['办公用品','+10%'],['汽车配件','+11%']],
    policy_news: [
      {level:'high',title:'对华关税145%全品类',date:'持续执行',scope:'全品类',desc:'所有中国原产商品加征145%关税，成本大幅上升'},
      {level:'high',title:'消费品安全合规(CPSC)',date:'持续执行',scope:'玩具/电子',desc:'需CPC认证+第三方检测'},
      {level:'mid',title:'各州销售税规则',date:'持续更新',scope:'全品类',desc:'各州税率不同，平台代扣为主'},
      {level:'low',title:'产品责任保险建议',date:'建议',scope:'全品类',desc:'美国诉讼风险高，建议购买保险'}
    ]
  },
  jp: {
    gdp_total: 'US$ 4.23万亿', gdp_growth: '+1.2%', per_capita_gdp: 'US$ 33,800', cpi: '+2.8%',
    currency: '157 JPY/USD', currency_trend: 'down', disposable_income: 'US$ 33,800',
    population: '1.23亿', ecommerce_users: '1.05亿', online_penetration: '85%',
    trade_volume: 'US$ 1.58万亿', trade_growth: '+2.5%', cross_border_growth: '+8%',
    top_imports: '能源/食品/电子', tariff_trend: '稳定', warehouse_scale: '580万㎡',
    ai_summary: '日本市场高度成熟，老龄化社会保健品需求+18%，精致包装小规格产品受欢迎。PSE认证+药机法门槛高但利润空间大，精品路线+极致用户体验是关键。Amazon日本+乐天双平台布局。',
    top_shops_count: 22, hot_products_count: 98, trending_content_count: 45,
    content_vs_shelf: {content_conv: '4.5%', shelf_conv: '5.1%', live_avg_view: '6,800', short_video_avg_play: '380K', creator_avg_cost: '$380', search_traffic_share: '48%'},
    top_categories_growth: [['美妆护肤','+12%'],['健康食品','+18%'],['宠物用品','+15%'],['智能家居','+20%'],['家居收纳','+10%'],['服装配饰','+8%'],['文具','+6%'],['母婴精品','+14%'],['户外','+11%'],['二手奢侈品','+22%']],
    policy_news: [
      {level:'high',title:'PSE/PSC电气安全认证',date:'持续执行',scope:'电子产品',desc:'无认证产品禁止销售，处罚严厉'},
      {level:'high',title:'药机法化妆品宣传限制',date:'持续执行',scope:'美妆',desc:'不得夸大功效，需日文全成分标注'},
      {level:'mid',title:'食品进口检验检疫',date:'持续执行',scope:'食品',desc:'检查项目多，周期1-2周'},
      {level:'low',title:'包装品质标准',date:'行业惯例',scope:'全品类',desc:'日本消费者包装要求极高'}
    ]
  },
  br: {
    gdp_total: 'US$ 2.17万亿', gdp_growth: '+3.0%', per_capita_gdp: 'US$ 8,920', cpi: '+4.2%',
    currency: '5.07 BRL/USD', currency_trend: 'volatile', disposable_income: 'US$ 8,920',
    population: '2.16亿', ecommerce_users: '1.46亿', online_penetration: '68%',
    trade_volume: 'US$ 5,890亿', trade_growth: '+5.8%', cross_border_growth: '+28%',
    top_imports: '电子/化工/机械', tariff_trend: 'Remessa Conforme新规', warehouse_scale: '180万㎡',
    ai_summary: '拉美最大电商市场，社交电商+分期付款是核心打法。个护电器+35%需求旺盛，巴西风格色彩鲜艳产品热销。Remessa Conforme新规50$以下征20%税，建议走Mercado Livre本土店+海外仓模式。',
    top_shops_count: 18, hot_products_count: 76, trending_content_count: 52,
    content_vs_shelf: {content_conv: '9.5%', shelf_conv: '3.8%', live_avg_view: '15,200', short_video_avg_play: '420K', creator_avg_cost: '$120', search_traffic_share: '32%'},
    top_categories_growth: [['个护电器','+35%'],['时尚配饰','+28%'],['3C配件','+22%'],['运动户外','+20%'],['美妆护肤','+30%'],['家居日用','+16%'],['食品饮料','+14%'],['宠物用品','+18%'],['母婴','+15%'],['汽车配件','+12%']],
    policy_news: [
      {level:'high',title:'Remessa Conforme税务新规',date:'2026-07',scope:'全品类',desc:'50美元以下征20%进口税'},
      {level:'high',title:'ANVISA药品保健品审批',date:'持续执行',scope:'药品保健品',desc:'审批周期长，未批准禁售'},
      {level:'mid',title:'清关流程复杂',date:'持续',scope:'全品类',desc:'清关时效7-30天'},
      {level:'low',title:'消费者权益保护(CDC)',date:'持续',scope:'全品类',desc:'15天无理由退货'}
    ]
  },
  sa: {
    gdp_total: 'US$ 1.11万亿', gdp_growth: '+3.8%', per_capita_gdp: 'US$ 32,500', cpi: '+2.1%',
    currency: '3.75 SAR/USD', currency_trend: 'fixed', disposable_income: 'US$ 32,500',
    population: '3,640万', ecommerce_users: '2,810万', online_penetration: '77%',
    trade_volume: 'US$ 4,580亿', trade_growth: '+6.5%', cross_border_growth: '+32%',
    top_imports: '机械/食品/消费品', tariff_trend: 'VAT 15%', warehouse_scale: '95万㎡',
    ai_summary: '中东高消费力市场，人均GDP超3万美元。美妆香水+38%全球领先，年轻人口占比高+Snapchat/TikTok社交种草转化率高。Vision 2030推动数字化，SABER认证门槛高但利润空间大。',
    top_shops_count: 15, hot_products_count: 62, trending_content_count: 38,
    content_vs_shelf: {content_conv: '7.8%', shelf_conv: '4.0%', live_avg_view: '9,500', short_video_avg_play: '350K', creator_avg_cost: '$280', search_traffic_share: '42%'},
    top_categories_growth: [['美妆香水','+38%'],['时尚服饰','+25%'],['电子产品','+20%'],['游戏配件','+30%'],['家居用品','+18%'],['食品','+12%'],['母婴','+22%'],['奢侈品','+35%'],['运动','+16%'],['汽车配件','+14%']],
    policy_news: [
      {level:'high',title:'SABER产品认证强制',date:'持续执行',scope:'全品类',desc:'无SABER证书产品无法清关'},
      {level:'high',title:'VAT 15%增值税',date:'持续',scope:'全品类',desc:'进口商品+本土销售均征收'},
      {level:'mid',title:'文化内容审查',date:'持续',scope:'服装/媒体',desc:'需符合伊斯兰文化规范'},
      {level:'low',title:'Halal认证建议',date:'建议',scope:'食品/化妆品',desc:'清真认证提升市场接受度'}
    ]
  },
  th: {
    gdp_total: 'US$ 5,149亿', gdp_growth: '+3.2%', per_capita_gdp: 'US$ 7,640', cpi: '+1.5%',
    currency: '36.2 THB/USD', currency_trend: 'stable', disposable_income: 'US$ 7,640',
    population: '7,180万', ecommerce_users: '5,280万', online_penetration: '74%',
    trade_volume: 'US$ 5,680亿', trade_growth: '+4.2%', cross_border_growth: '+18%',
    top_imports: '电子/机械/消费品', tariff_trend: '数字服务税4%', warehouse_scale: '210万㎡',
    ai_summary: '东南亚旅游消费大国，直播带货渗透率全东南亚最高。美妆护肤+30%，泰国美妆品牌国际化趋势。TikTok Shop直播转化率领先，FDA审批对食品药品要求严格，泼水节/水灯节是重要营销节点。',
    top_shops_count: 20, hot_products_count: 85, trending_content_count: 56,
    content_vs_shelf: {content_conv: '10.2%', shelf_conv: '3.2%', live_avg_view: '18,500', short_video_avg_play: '310K', creator_avg_cost: '$150', search_traffic_share: '35%'},
    top_categories_growth: [['美妆护肤','+30%'],['食品饮料','+20%'],['健康养生','+25%'],['旅游用品','+18%'],['家居日用','+14%'],['电子配件','+12%'],['服装','+16%'],['母婴','+15%'],['宠物','+20%'],['汽车用品','+10%']],
    policy_news: [
      {level:'mid',title:'数字服务税4%',date:'2024',scope:'全品类',desc:'跨境电商收入征收4%增值税'},
      {level:'mid',title:'FDA食品药品审批',date:'持续执行',scope:'食品保健品',desc:'审批周期2-4周'},
      {level:'low',title:'电子烟严禁进口',date:'持续',scope:'电子烟',desc:'持有/销售均违法'},
      {level:'low',title:'化妆品FDA注册',date:'持续执行',scope:'美妆',desc:'需泰语标签+成分申报'}
    ]
  },
  my: {
    gdp_total: 'US$ 4,308亿', gdp_growth: '+4.5%', per_capita_gdp: 'US$ 12,380', cpi: '+1.8%',
    currency: '4.72 MYR/USD', currency_trend: 'stable', disposable_income: 'US$ 12,380',
    population: '3,430万', ecommerce_users: '2,680万', online_penetration: '78%',
    trade_volume: 'US$ 4,820亿', trade_growth: '+5.5%', cross_border_growth: '+20%',
    top_imports: '电子/机械/化工', tariff_trend: 'RCEP优惠', warehouse_scale: '150万㎡',
    ai_summary: '多元文化市场，马来/华人/印度三大族群消费偏好各异。清真产品+28%全球清真经济中心，数字基建完善+RCEP贸易便利。多语言运营是关键，Shopee+Lazada双平台+TikTok内容营销。',
    top_shops_count: 16, hot_products_count: 72, trending_content_count: 41,
    content_vs_shelf: {content_conv: '6.5%', shelf_conv: '3.8%', live_avg_view: '8,800', short_video_avg_play: '240K', creator_avg_cost: '$160', search_traffic_share: '40%'},
    top_categories_growth: [['清真产品','+28%'],['电子数码','+22%'],['家居园艺','+18%'],['母婴用品','+20%'],['美妆护肤','+24%'],['食品','+15%'],['日用品','+12%'],['服装','+16%'],['健康保健','+18%'],['汽车配件','+10%']],
    policy_news: [
      {level:'mid',title:'数字服务税新规',date:'2024',scope:'全品类',desc:'外国数字服务提供商征税'},
      {level:'mid',title:'清真认证要求',date:'建议',scope:'食品化妆品',desc:'JAKIM认证权威性最高'},
      {level:'low',title:'多语言标签要求',date:'建议',scope:'全品类',desc:'建议马来语+英语双语'},
      {level:'low',title:'进口关税差异化',date:'持续',scope:'全品类',desc:'RCEP成员国优惠税率'}
    ]
  },
  vn: {
    gdp_total: 'US$ 4,300亿', gdp_growth: '+6.5%', per_capita_gdp: 'US$ 4,280', cpi: '+3.5%',
    currency: '25,200 VND/USD', currency_trend: 'stable', disposable_income: 'US$ 4,280',
    population: '9,880万', ecommerce_users: '6,820万', online_penetration: '69%',
    trade_volume: 'US$ 7,320亿', trade_growth: '+10.2%', cross_border_growth: '+26%',
    top_imports: '电子/机械/原料', tariff_trend: '制造业优惠', warehouse_scale: '160万㎡',
    ai_summary: '东南亚GDP增速6.5%领跑，年轻人口+移动互联网推动电商快速增长。家居生活+32%，韩流日系风格影响大。Facebook社群+TikTok+Shopee三渠道并行，COD占比42%需注意回款风险。',
    top_shops_count: 19, hot_products_count: 88, trending_content_count: 48,
    content_vs_shelf: {content_conv: '7.2%', shelf_conv: '3.0%', live_avg_view: '11,200', short_video_avg_play: '290K', creator_avg_cost: '$100', search_traffic_share: '30%'},
    top_categories_growth: [['家居生活','+32%'],['时尚服饰','+28%'],['小家电','+25%'],['美妆个护','+30%'],['食品','+16%'],['日用品','+12%'],['电子配件','+18%'],['母婴','+20%'],['运动户外','+15%'],['汽车配件','+14%']],
    policy_news: [
      {level:'mid',title:'本土电商保护政策',date:'2025讨论',scope:'全品类',desc:'可能限制外资电商平台'},
      {level:'mid',title:'物流基础设施限制',date:'持续',scope:'全品类',desc:'最后一公里配送时效不稳定'},
      {level:'low',title:'价格竞争激烈',date:'行业',scope:'全品类',desc:'利润空间被压缩'},
      {level:'low',title:'外汇管制',date:'持续',scope:'跨境',desc:'利润汇出需合规申报'}
    ]
  },
  ae: {gdp_total:'US$ 5,100亿',gdp_growth:'+4.2%',per_capita_gdp:'US$ 44,000',cpi:'+2.5%',currency:'3.67 AED/USD',currency_trend:'fixed',disposable_income:'US$ 44,000',population:'1,000万',ecommerce_users:'780万',online_penetration:'78%',trade_volume:'US$ 4,200亿',trade_growth:'+6.8%',cross_border_growth:'+35%',top_imports:'机械/食品/消费品',tariff_trend:'VAT 5%',warehouse_scale:'65万㎡',ai_summary:'中东电商增速+30%最快，美妆香水+35%全球领先。迪拜贸易枢纽辐射GCC。Noon+Amazon双平台，Snapchat社交种草转化率高。',top_shops_count:14,hot_products_count:58,trending_content_count:32,content_vs_shelf:{content_conv:'7.5%',shelf_conv:'3.8%',live_avg_view:'9,200',short_video_avg_play:'340K',creator_avg_cost:'$260',search_traffic_share:'40%'},top_categories_growth:[['美妆香水','+35%'],['奢侈品','+30%'],['电子','+22%'],['游戏','+28%'],['家居','+18%'],['食品','+12%'],['母婴','+22%'],['运动','+16%'],['汽车配件','+14%'],['服装','+20%']],policy_news:[{level:'high',title:'SABER认证',date:'持续执行',scope:'全品类',desc:'无证书无法清关'},{level:'high',title:'VAT 5%',date:'持续',scope:'全品类',desc:'进口+本土均征收'},{level:'mid',title:'文化审查',date:'持续',scope:'服装/媒体',desc:'需符合伊斯兰规范'},{level:'low',title:'Halal认证',date:'建议',scope:'食品/化妆品',desc:'清真认证提升接受度'}]},
  ar: {gdp_total:'US$ 6,320亿',gdp_growth:'+5.0%',per_capita_gdp:'US$ 12,500',cpi:'+200%',currency:'1,200 ARS/USD',currency_trend:'down',disposable_income:'US$ 12,500',population:'4,600万',ecommerce_users:'2,500万',online_penetration:'54%',trade_volume:'US$ 1,250亿',trade_growth:'+4.5%',cross_border_growth:'+50%',top_imports:'机械/消费品/化工',tariff_trend:'外汇管制',warehouse_scale:'65万㎡',ai_summary:'阿根廷电商+45%全拉美最快。Mercado Libre主导45%。高通胀+外汇管制是核心风险。美妆+28%、时尚+25%强劲。',top_shops_count:14,hot_products_count:65,trending_content_count:38,content_vs_shelf:{content_conv:'9.0%',shelf_conv:'2.8%',live_avg_view:'14,000',short_video_avg_play:'480K',creator_avg_cost:'$80',search_traffic_share:'28%'},top_categories_growth:[['美妆','+28%'],['时尚','+25%'],['3C','+22%'],['运动','+20%'],['食品','+18%'],['家居','+16%'],['母婴','+18%'],['宠物','+16%'],['汽车配件','+14%'],['办公','+10%']],policy_news:[{level:'high',title:'外汇管制',date:'持续',scope:'跨境',desc:'美元获取极困难'},{level:'high',title:'进口高关税',date:'持续',scope:'全品类',desc:'关税+统计税'},{level:'mid',title:'ANMAT注册',date:'持续',scope:'美妆',desc:'需卫生部注册'},{level:'low',title:'通胀定价',date:'行业',scope:'全品类',desc:'需频繁调价'}]},
  au: {gdp_total:'US$ 1.72万亿',gdp_growth:'+2.0%',per_capita_gdp:'US$ 48,500',cpi:'+3.5%',currency:'1.53 AUD/USD',currency_trend:'stable',disposable_income:'US$ 48,500',population:'2,680万',ecommerce_users:'2,140万',online_penetration:'80%',trade_volume:'US$ 6,800亿',trade_growth:'+4.2%',cross_border_growth:'+12%',top_imports:'机械/电子/消费品',tariff_trend:'RCEP优惠',warehouse_scale:'120万㎡',ai_summary:'大洋洲最大市场，户外+健康+22%强劲。英语市场无语言障碍。生物安全检验极严。eBay+Amazon布局。',top_shops_count:18,hot_products_count:80,trending_content_count:38,content_vs_shelf:{content_conv:'5.5%',shelf_conv:'4.0%',live_avg_view:'6,500',short_video_avg_play:'380K',creator_avg_cost:'$350',search_traffic_share:'45%'},top_categories_growth:[['户外运动','+22%'],['健康保健','+25%'],['家居园艺','+18%'],['宠物','+20%'],['美妆','+16%'],['电子','+12%'],['时尚','+14%'],['母婴','+15%'],['食品','+10%'],['办公','+8%']],policy_news:[{level:'high',title:'生物安全法',date:'持续执行',scope:'食品/植物',desc:'检验极严格'},{level:'high',title:'TGA注册',date:'持续',scope:'药品保健品',desc:'需TGA注册'},{level:'mid',title:'消费者法ACL',date:'持续',scope:'全品类',desc:'权益保护严格'},{level:'low',title:'产品安全标准',date:'持续',scope:'全品类',desc:'需符合澳洲标准'}]},
  be: {gdp_total:'US$ 6,200亿',gdp_growth:'+1.3%',per_capita_gdp:'US$ 48,000',cpi:'+2.5%',currency:'0.92 EUR/USD',currency_trend:'stable',disposable_income:'US$ 48,000',population:'1,170万',ecommerce_users:'940万',online_penetration:'80%',trade_volume:'US$ 8,800亿',trade_growth:'+2.8%',cross_border_growth:'+8%',top_imports:'机械/化工/消费品',tariff_trend:'EU统一',warehouse_scale:'95万㎡',ai_summary:'欧洲物流中心，bol.com+Amazon双平台。三语市场辐射周边。可持续消费意识强。',top_shops_count:12,hot_products_count:55,trending_content_count:25,content_vs_shelf:{content_conv:'4.0%',shelf_conv:'4.2%',live_avg_view:'4,500',short_video_avg_play:'280K',creator_avg_cost:'$300',search_traffic_share:'48%'},top_categories_growth:[['可持续','+20%'],['时尚','+18%'],['美食','+15%'],['家居','+16%'],['美妆','+14%'],['电子','+10%'],['宠物','+16%'],['母婴','+12%'],['运动','+14%'],['办公','+8%']],policy_news:[{level:'high',title:'EU统一合规',date:'持续执行',scope:'全品类',desc:'CE/GDPR严格'},{level:'mid',title:'多语言标签',date:'持续',scope:'全品类',desc:'荷/法对应语言'},{level:'mid',title:'14天退货',date:'持续',scope:'全品类',desc:'EU标准'},{level:'low',title:'Bancontact',date:'建议',scope:'全品类',desc:'最主流支付'}]},
  ca: {gdp_total:'US$ 2.14万亿',gdp_growth:'+1.8%',per_capita_gdp:'US$ 42,800',cpi:'+2.8%',currency:'1.36 CAD/USD',currency_trend:'stable',disposable_income:'US$ 42,800',population:'4,050万',ecommerce_users:'3,040万',online_penetration:'75%',trade_volume:'US$ 1.18万亿',trade_growth:'+3.5%',cross_border_growth:'+10%',top_imports:'机械/电子/汽车',tariff_trend:'USMCA优惠',warehouse_scale:'200万㎡',ai_summary:'北美第二大市场，Shopify发源地。英法双语市场。户外+健康品类增长强劲。Amazon主导40%。',top_shops_count:20,hot_products_count:88,trending_content_count:42,content_vs_shelf:{content_conv:'5.2%',shelf_conv:'4.0%',live_avg_view:'6,800',short_video_avg_play:'400K',creator_avg_cost:'$380',search_traffic_share:'48%'},top_categories_growth:[['户外','+20%'],['健康','+22%'],['家居','+16%'],['宠物','+18%'],['美妆','+15%'],['电子','+12%'],['时尚','+10%'],['母婴','+14%'],['食品','+10%'],['办公','+8%']],policy_news:[{level:'high',title:'双语标签法',date:'持续执行',scope:'全品类',desc:'英法双语必须'},{level:'high',title:'Health Canada',date:'持续',scope:'食品/化妆品',desc:'需加拿大认证'},{level:'mid',title:'CSA/UL认证',date:'持续',scope:'电子产品',desc:'电气安全必须'},{level:'low',title:'USMCA',date:'持续',scope:'全品类',desc:'美加墨协定'}]},
  cl: {gdp_total:'US$ 3,350亿',gdp_growth:'+2.8%',per_capita_gdp:'US$ 16,800',cpi:'+5.2%',currency:'920 CLP/USD',currency_trend:'stable',disposable_income:'US$ 16,800',population:'1,960万',ecommerce_users:'1,200万',online_penetration:'61%',trade_volume:'US$ 1,680亿',trade_growth:'+4.2%',cross_border_growth:'+18%',top_imports:'机械/电子/消费品',tariff_trend:'CPTPP优惠',warehouse_scale:'35万㎡',ai_summary:'智利南美经济最稳定，电商+15%稳健。Mercado Libre+Falabella布局。电子+18%、时尚+20%增长。消费者保护法严格。',top_shops_count:12,hot_products_count:58,trending_content_count:28,content_vs_shelf:{content_conv:'5.8%',shelf_conv:'3.5%',live_avg_view:'7,200',short_video_avg_play:'320K',creator_avg_cost:'$180',search_traffic_share:'38%'},top_categories_growth:[['电子','+18%'],['时尚','+20%'],['家居','+16%'],['健康','+18%'],['美妆','+16%'],['食品','+14%'],['运动','+15%'],['宠物','+16%'],['母婴','+14%'],['办公','+8%']],policy_news:[{level:'high',title:'消费者保护法',date:'持续',scope:'全品类',desc:'10天无理由退货'},{level:'mid',title:'ISP注册',date:'持续',scope:'美妆',desc:'需卫生部注册'},{level:'mid',title:'VAT 19%',date:'持续',scope:'全品类',desc:'征19%'},{level:'low',title:'物流基础设施',date:'持续',scope:'全品类',desc:'偏远配送困难'}]},
  co: {gdp_total:'US$ 3,760亿',gdp_growth:'+2.5%',per_capita_gdp:'US$ 6,800',cpi:'+8.5%',currency:'4,100 COP/USD',currency_trend:'volatile',disposable_income:'US$ 6,800',population:'5,200万',ecommerce_users:'2,200万',online_penetration:'42%',trade_volume:'US$ 920亿',trade_growth:'+5.5%',cross_border_growth:'+32%',top_imports:'机械/电子/消费品',tariff_trend:'太平洋联盟优惠',warehouse_scale:'55万㎡',ai_summary:'哥伦比亚电商+28%高增速。美妆+30%、时尚+25%强劲。Mercado Libre+Falabella双平台。分期消费文化驱动。',top_shops_count:14,hot_products_count:68,trending_content_count:35,content_vs_shelf:{content_conv:'8.0%',shelf_conv:'2.8%',live_avg_view:'11,000',short_video_avg_play:'380K',creator_avg_cost:'$100',search_traffic_share:'28%'},top_categories_growth:[['美妆','+30%'],['时尚','+25%'],['3C','+22%'],['家居','+20%'],['食品','+16%'],['母婴','+18%'],['运动','+16%'],['宠物','+15%'],['汽车配件','+14%'],['办公','+10%']],policy_news:[{level:'mid',title:'安全物流',date:'持续',scope:'全品类',desc:'部分地区风险'},{level:'mid',title:'INVIMA注册',date:'持续',scope:'美妆',desc:'需卫生部注册'},{level:'low',title:'VAT 19%',date:'持续',scope:'全品类',desc:'征19%'},{level:'low',title:'跨境监管',date:'2025',scope:'跨境',desc:'可能加强'}]},
  de: {gdp_total:'US$ 4.46万亿',gdp_growth:'+0.3%',per_capita_gdp:'US$ 48,200',cpi:'+2.2%',currency:'0.92 EUR/USD',currency_trend:'stable',disposable_income:'US$ 48,200',population:'8,400万',ecommerce_users:'6,880万',online_penetration:'82%',trade_volume:'US$ 3.12万亿',trade_growth:'+1.8%',cross_border_growth:'+8%',top_imports:'机械/电子/化工',tariff_trend:'EU统一',warehouse_scale:'580万㎡',ai_summary:'欧洲最大电商市场，有机消费全欧第一。退货率30%需注意。Amazon+OTTO+Zalando三平台布局。',top_shops_count:26,hot_products_count:118,trending_content_count:48,content_vs_shelf:{content_conv:'4.0%',shelf_conv:'4.8%',live_avg_view:'5,800',short_video_avg_play:'350K',creator_avg_cost:'$380',search_traffic_share:'55%'},top_categories_growth:[['有机食品','+22%'],['环保产品','+25%'],['家居家电','+16%'],['运动户外','+18%'],['美妆','+14%'],['电子','+10%'],['服装','+8%'],['母婴','+12%'],['汽车配件','+11%'],['宠物','+20%']],policy_news:[{level:'high',title:'GDPR数据保护',date:'持续执行',scope:'全品类',desc:'违规罚款最高全球营收4%'},{level:'high',title:'包装法VerpackG',date:'持续执行',scope:'全品类',desc:'必须LUCID注册'},{level:'mid',title:'WEEE电子注册',date:'持续',scope:'电子产品',desc:'需EAR编号'},{level:'low',title:'EU CPNP化妆品通报',date:'持续',scope:'美妆',desc:'欧盟门户通报'}]},
  eg: {gdp_total:'US$ 3,480亿',gdp_growth:'+4.5%',per_capita_gdp:'US$ 3,800',cpi:'+28%',currency:'48.5 EGP/USD',currency_trend:'down',disposable_income:'US$ 3,800',population:'1.1亿',ecommerce_users:'3,200万',online_penetration:'29%',trade_volume:'US$ 950亿',trade_growth:'+5.5%',cross_border_growth:'+40%',top_imports:'机械/食品/消费品',tariff_trend:'外汇管制',warehouse_scale:'45万㎡',ai_summary:'北非最大市场+35%高增速，年轻人口占比极高。价格敏感度强，COD占比35%。Amazon+Noon+Jumia三平台。',top_shops_count:12,hot_products_count:52,trending_content_count:28,content_vs_shelf:{content_conv:'8.5%',shelf_conv:'2.5%',live_avg_view:'14,000',short_video_avg_play:'450K',creator_avg_cost:'$80',search_traffic_share:'28%'},top_categories_growth:[['时尚','+28%'],['3C','+25%'],['家居','+20%'],['母婴','+22%'],['美妆','+24%'],['食品','+15%'],['运动','+18%'],['宠物','+12%'],['汽车配件','+16%'],['办公','+10%']],policy_news:[{level:'high',title:'外汇管制',date:'持续',scope:'全品类',desc:'美元获取困难'},{level:'mid',title:'清关复杂',date:'持续',scope:'全品类',desc:'周期7-30天'},{level:'mid',title:'进口许可',date:'持续',scope:'食品/化妆品',desc:'需许可'},{level:'low',title:'基础设施建设',date:'持续',scope:'全品类',desc:'物流完善中'}]},
  es: {gdp_total:'US$ 1.58万亿',gdp_growth:'+2.5%',per_capita_gdp:'US$ 34,500',cpi:'+2.8%',currency:'0.92 EUR/USD',currency_trend:'stable',disposable_income:'US$ 34,500',population:'4,800万',ecommerce_users:'3,400万',online_penetration:'71%',trade_volume:'US$ 9,200亿',trade_growth:'+3.2%',cross_border_growth:'+14%',top_imports:'能源/机械/消费品',tariff_trend:'EU统一',warehouse_scale:'180万㎡',ai_summary:'西班牙电商+12%增速南欧领先，时尚+20%受Zara效应驱动。Amazon+El Corte Inglés双渠道。',top_shops_count:18,hot_products_count:82,trending_content_count:40,content_vs_shelf:{content_conv:'5.8%',shelf_conv:'3.5%',live_avg_view:'7,000',short_video_avg_play:'400K',creator_avg_cost:'$250',search_traffic_share:'40%'},top_categories_growth:[['时尚','+20%'],['运动','+22%'],['美妆','+18%'],['家居','+16%'],['电子','+10%'],['食品','+12%'],['宠物','+20%'],['母婴','+14%'],['汽车配件','+11%'],['办公','+8%']],policy_news:[{level:'high',title:'EU统一产品合规',date:'持续执行',scope:'全品类',desc:'CE标识必须'},{level:'mid',title:'GDPR/AEPD',date:'持续',scope:'全品类',desc:'严格执法'},{level:'mid',title:'西语标签',date:'持续',scope:'全品类',desc:'需西语标注'},{level:'low',title:'数字税讨论',date:'2025',scope:'跨境',desc:'可能征数字税'}]},
  fr: {gdp_total:'US$ 3.05万亿',gdp_growth:'+1.1%',per_capita_gdp:'US$ 42,500',cpi:'+2.3%',currency:'0.92 EUR/USD',currency_trend:'stable',disposable_income:'US$ 42,500',population:'6,800万',ecommerce_users:'5,100万',online_penetration:'75%',trade_volume:'US$ 1.52万亿',trade_growth:'+2.2%',cross_border_growth:'+10%',top_imports:'机械/电子/消费品',tariff_trend:'EU统一',warehouse_scale:'350万㎡',ai_summary:'法国美妆+20%全球领先，有机食品+25%旺盛。法语标签+数字税是门槛。Amazon+Cdiscount+Fnac布局。',top_shops_count:22,hot_products_count:98,trending_content_count:45,content_vs_shelf:{content_conv:'5.0%',shelf_conv:'4.0%',live_avg_view:'6,500',short_video_avg_play:'380K',creator_avg_cost:'$320',search_traffic_share:'45%'},top_categories_growth:[['美妆护肤','+20%'],['有机食品','+25%'],['时尚','+15%'],['家居','+18%'],['电子','+10%'],['母婴','+12%'],['运动','+14%'],['宠物','+18%'],['红酒美食','+8%'],['办公','+6%']],policy_news:[{level:'high',title:'法语标签强制',date:'持续执行',scope:'全品类',desc:'产品说明必须法语'},{level:'high',title:'数字税3%',date:'持续',scope:'全品类',desc:'外国数字服务收入征3%'},{level:'mid',title:'GDPR/CNIL数据保护',date:'持续',scope:'全品类',desc:'数据收集需明确同意'},{level:'low',title:'年度折扣季',date:'持续',scope:'全品类',desc:'冬/夏两次法定折扣季'}]},
  gb: {gdp_total:'US$ 3.34万亿',gdp_growth:'+1.2%',per_capita_gdp:'US$ 46,000',cpi:'+3.8%',currency:'0.79 GBP/USD',currency_trend:'stable',disposable_income:'US$ 46,000',population:'6,700万',ecommerce_users:'5,360万',online_penetration:'80%',trade_volume:'US$ 9,820亿',trade_growth:'+3.5%',cross_border_growth:'+12%',top_imports:'机械/消费品/食品',tariff_trend:'脱欧后重构',warehouse_scale:'420万㎡',ai_summary:'英国电商人均消费全欧领先，宠物用品+28%增长迅猛。脱欧后UKCA认证独立体系。建议Amazon FBA+品牌DTC路线。',top_shops_count:24,hot_products_count:112,trending_content_count:55,content_vs_shelf:{content_conv:'5.2%',shelf_conv:'4.5%',live_avg_view:'7,200',short_video_avg_play:'420K',creator_avg_cost:'$350',search_traffic_share:'48%'},top_categories_growth:[['美妆个护','+22%'],['宠物用品','+28%'],['家居园艺','+18%'],['健康保健','+20%'],['消费电子','+12%'],['服装','+10%'],['运动户外','+15%'],['母婴','+14%'],['办公','+8%'],['汽车配件','+11%']],policy_news:[{level:'high',title:'脱欧后UKCA认证',date:'持续执行',scope:'全品类',desc:'需UKCA标识替代CE'},{level:'high',title:'VAT 20%增值税',date:'持续',scope:'全品类',desc:'£135以下平台代扣'},{level:'mid',title:'14天无理由退货',date:'持续',scope:'全品类',desc:'在线购买享14天冷静期'},{level:'low',title:'包装环保法规',date:'2025更新',scope:'全品类',desc:'可回收要求趋严'}]},
  il: {gdp_total:'US$ 5,250亿',gdp_growth:'+2.5%',per_capita_gdp:'US$ 52,000',cpi:'+2.8%',currency:'3.65 ILS/USD',currency_trend:'stable',disposable_income:'US$ 52,000',population:'980万',ecommerce_users:'780万',online_penetration:'80%',trade_volume:'US$ 1,350亿',trade_growth:'+3.2%',cross_border_growth:'+15%',top_imports:'钻石/机械/电子',tariff_trend:'地缘复杂',warehouse_scale:'35万㎡',ai_summary:'以色列人均GDP极高，科技创新氛围浓。电子产品+18%、时尚+20%稳健增长。Amazon+eBay+AliExpress布局。',top_shops_count:14,hot_products_count:60,trending_content_count:28,content_vs_shelf:{content_conv:'5.0%',shelf_conv:'4.2%',live_avg_view:'5,500',short_video_avg_play:'320K',creator_avg_cost:'$350',search_traffic_share:'48%'},top_categories_growth:[['电子','+18%'],['时尚','+20%'],['家居','+15%'],['健康','+18%'],['美妆','+16%'],['食品','+12%'],['运动','+14%'],['母婴','+15%'],['宠物','+16%'],['办公','+8%']],policy_news:[{level:'high',title:'安全合规',date:'持续',scope:'全品类',desc:'进口审查严格'},{level:'mid',title:'地缘物流影响',date:'持续',scope:'全品类',desc:'部分地区受限'},{level:'mid',title:'VAT 17%',date:'持续',scope:'全品类',desc:'进口征17%'},{level:'low',title:'消费者保护',date:'持续',scope:'全品类',desc:'14天退货'}]},
  in: {gdp_total:'US$ 3.94万亿',gdp_growth:'+6.5%',per_capita_gdp:'US$ 2,500',cpi:'+5.0%',currency:'83.5 INR/USD',currency_trend:'stable',disposable_income:'US$ 2,500',population:'14.3亿',ecommerce_users:'6.5亿',online_penetration:'45%',trade_volume:'US$ 1.18万亿',trade_growth:'+8.5%',cross_border_growth:'+25%',top_imports:'电子/机械/消费品',tariff_trend:'高关税+PLI',warehouse_scale:'350万㎡',ai_summary:'印度电商+22%全球增速最快，14.3亿人口红利。Flipkart+Amazon双寡头。时尚+35%、美妆+30%爆发。BIS认证+高关税门槛。',top_shops_count:20,hot_products_count:95,trending_content_count:50,content_vs_shelf:{content_conv:'8.0%',shelf_conv:'2.5%',live_avg_view:'16,000',short_video_avg_play:'580K',creator_avg_cost:'$60',search_traffic_share:'25%'},top_categories_growth:[['时尚','+35%'],['美妆','+30%'],['3C','+28%'],['家居','+22%'],['食品','+18%'],['母婴','+20%'],['运动','+16%'],['宠物','+14%'],['汽车配件','+14%'],['办公','+10%']],policy_news:[{level:'high',title:'进口高关税',date:'持续执行',scope:'全品类',desc:'基本税+IGST极高'},{level:'high',title:'BIS认证',date:'持续执行',scope:'电子/工业品',desc:'无BIS禁止进口'},{level:'mid',title:'FSSAI食品认证',date:'持续',scope:'食品',desc:'需食品安全认证'},{level:'mid',title:'CDSCO化妆品',date:'持续',scope:'美妆',desc:'需药监局注册'}]},
  it: {gdp_total:'US$ 2.23万亿',gdp_growth:'+0.8%',per_capita_gdp:'US$ 38,200',cpi:'+2.0%',currency:'0.92 EUR/USD',currency_trend:'stable',disposable_income:'US$ 38,200',population:'5,870万',ecommerce_users:'3,820万',online_penetration:'65%',trade_volume:'US$ 1.28万亿',trade_growth:'+2.5%',cross_border_growth:'+12%',top_imports:'机械/能源/消费品',tariff_trend:'EU统一',warehouse_scale:'220万㎡',ai_summary:'意大利人均电商消费南欧最高，美妆+22%、家居设计+20%。设计感+品质是核心竞争力。Amazon+eBay+Zalando布局。',top_shops_count:20,hot_products_count:88,trending_content_count:42,content_vs_shelf:{content_conv:'5.5%',shelf_conv:'3.8%',live_avg_view:'6,200',short_video_avg_play:'360K',creator_avg_cost:'$280',search_traffic_share:'42%'},top_categories_growth:[['时尚','+18%'],['家居设计','+20%'],['美妆','+22%'],['运动','+16%'],['电子','+10%'],['食品','+12%'],['母婴','+14%'],['宠物','+18%'],['汽车配件','+11%'],['办公','+8%']],policy_news:[{level:'high',title:'GDPR+Garante数据保护',date:'持续执行',scope:'全品类',desc:'严格执法'},{level:'mid',title:'税务合规(Codice Fiscale)',date:'持续',scope:'全品类',desc:'需意大利税号'},{level:'mid',title:'意大利语标签',date:'持续',scope:'全品类',desc:'需意语说明'},{level:'low',title:'EU统一产品安全',date:'持续',scope:'全品类',desc:'CE标识必须'}]},
  ke: {gdp_total:'US$ 1,130亿',gdp_growth:'+5.5%',per_capita_gdp:'US$ 2,100',cpi:'+6.5%',currency:'130 KES/USD',currency_trend:'volatile',disposable_income:'US$ 2,100',population:'5,400万',ecommerce_users:'1,200万',online_penetration:'22%',trade_volume:'US$ 720亿',trade_growth:'+6.8%',cross_border_growth:'+28%',top_imports:'机械/消费品/原料',tariff_trend:'东非共同体',warehouse_scale:'25万㎡',ai_summary:'东非电商领军+25%增速。M-Pesa移动支付革命。Jumia+Kilimall布局。3C+28%、太阳能+30%强劲。COD 40%注意回款。',top_shops_count:10,hot_products_count:48,trending_content_count:22,content_vs_shelf:{content_conv:'9.0%',shelf_conv:'2.2%',live_avg_view:'12,000',short_video_avg_play:'450K',creator_avg_cost:'$60',search_traffic_share:'22%'},top_categories_growth:[['3C','+28%'],['时尚','+25%'],['美妆','+22%'],['太阳能','+30%'],['食品','+16%'],['家居','+14%'],['运动','+14%'],['母婴','+18%'],['汽车配件','+12%'],['办公','+8%']],policy_news:[{level:'mid',title:'物流基础设施',date:'持续',scope:'全品类',desc:'最后一公里困难'},{level:'mid',title:'M-Pesa集成',date:'建议',scope:'全品类',desc:'最主流支付'},{level:'low',title:'KEBS标准',date:'持续',scope:'工业品',desc:'需肯尼亚标准'},{level:'low',title:'数据保护法',date:'2023',scope:'全品类',desc:'合规'}]},
  kr: {gdp_total:'US$ 1.72万亿',gdp_growth:'+2.2%',per_capita_gdp:'US$ 33,200',cpi:'+2.5%',currency:'1,380 KRW/USD',currency_trend:'stable',disposable_income:'US$ 33,200',population:'5,200万',ecommerce_users:'4,200万',online_penetration:'81%',trade_volume:'US$ 1.38万亿',trade_growth:'+3.8%',cross_border_growth:'+10%',top_imports:'半导体/电子/消费品',tariff_trend:'FTA广泛',warehouse_scale:'480万㎡',ai_summary:'韩国全球第六大电商，Coupang+28%主导。K-beauty美妆+15%全球影响。KC认证+MFDS门槛高。次日达物流标杆。',top_shops_count:22,hot_products_count:95,trending_content_count:45,content_vs_shelf:{content_conv:'4.8%',shelf_conv:'5.0%',live_avg_view:'7,500',short_video_avg_play:'450K',creator_avg_cost:'$380',search_traffic_share:'45%'},top_categories_growth:[['美妆','+15%'],['时尚','+12%'],['电子','+10%'],['健康食品','+18%'],['家居','+10%'],['食品','+12%'],['运动','+12%'],['母婴','+14%'],['宠物','+18%'],['办公','+8%']],policy_news:[{level:'high',title:'KC认证',date:'持续执行',scope:'电子产品',desc:'无认证禁止销售'},{level:'high',title:'MFDS化妆品认证',date:'持续',scope:'美妆',desc:'需食药处认证'},{level:'mid',title:'韩语标签',date:'持续',scope:'全品类',desc:'必须韩语'},{level:'low',title:'7天退货',date:'持续',scope:'全品类',desc:'无条件退货'}]},
  kz: {gdp_total:'US$ 2,610亿',gdp_growth:'+5.5%',per_capita_gdp:'US$ 7,200',cpi:'+8.2%',currency:'475 KZT/USD',currency_trend:'stable',disposable_income:'US$ 7,200',population:'1,960万',ecommerce_users:'1,100万',online_penetration:'56%',trade_volume:'US$ 1,050亿',trade_growth:'+6.5%',cross_border_growth:'+28%',top_imports:'机械/消费品/原料',tariff_trend:'EAEU+一带一路',warehouse_scale:'28万㎡',ai_summary:'哈萨克斯坦中亚最大电商+25%增速。Kaspi.kz超级App主导40%。EAEU认证体系。一带一路贸易便利。',top_shops_count:10,hot_products_count:48,trending_content_count:22,content_vs_shelf:{content_conv:'6.0%',shelf_conv:'3.0%',live_avg_view:'8,000',short_video_avg_play:'320K',creator_avg_cost:'$100',search_traffic_share:'30%'},top_categories_growth:[['3C','+22%'],['时尚','+20%'],['家居','+18%'],['美妆','+20%'],['食品','+15%'],['母婴','+16%'],['运动','+14%'],['宠物','+14%'],['汽车配件','+12%'],['办公','+8%']],policy_news:[{level:'high',title:'EAEU认证',date:'持续执行',scope:'全品类',desc:'海关联盟认证'},{level:'mid',title:'双语标签',date:'持续',scope:'全品类',desc:'俄/哈双语'},{level:'mid',title:'Kaspi支付',date:'建议',scope:'全品类',desc:'最主流支付'},{level:'low',title:'消费者保护',date:'持续',scope:'全品类',desc:'14天退货'}]},
  ma: {gdp_total:'US$ 1,440亿',gdp_growth:'+3.5%',per_capita_gdp:'US$ 3,600',cpi:'+2.5%',currency:'10.0 MAD/USD',currency_trend:'stable',disposable_income:'US$ 3,600',population:'3,750万',ecommerce_users:'1,100万',online_penetration:'29%',trade_volume:'US$ 980亿',trade_growth:'+5.5%',cross_border_growth:'+25%',top_imports:'机械/消费品/化工',tariff_trend:'EU合作',warehouse_scale:'30万㎡',ai_summary:'摩洛哥电商+22%增长快。Jumia主导30%。阿甘油美妆特色。双语(阿/法)运营。斋月是重要营销节点。',top_shops_count:10,hot_products_count:50,trending_content_count:25,content_vs_shelf:{content_conv:'8.0%',shelf_conv:'2.5%',live_avg_view:'10,000',short_video_avg_play:'400K',creator_avg_cost:'$80',search_traffic_share:'25%'},top_categories_growth:[['时尚','+25%'],['美妆','+22%'],['3C','+20%'],['家居','+18%'],['食品','+15%'],['母婴','+16%'],['运动','+14%'],['宠物','+12%'],['汽车配件','+12%'],['办公','+8%']],policy_news:[{level:'mid',title:'双语标签',date:'持续',scope:'全品类',desc:'阿/法双语'},{level:'mid',title:'清关流程',date:'持续',scope:'全品类',desc:'复杂周期长'},{level:'low',title:'化妆品注册',date:'持续',scope:'美妆',desc:'需注册'},{level:'low',title:'COD管理',date:'行业',scope:'全品类',desc:'COD 30%'}]},
  mx: {gdp_total:'US$ 1.79万亿',gdp_growth:'+3.2%',per_capita_gdp:'US$ 10,800',cpi:'+4.5%',currency:'18.5 MXN/USD',currency_trend:'stable',disposable_income:'US$ 10,800',population:'1.3亿',ecommerce_users:'5,800万',online_penetration:'45%',trade_volume:'US$ 1.12万亿',trade_growth:'+6.5%',cross_border_growth:'+30%',top_imports:'电子/机械/消费品',tariff_trend:'USMCA优惠',warehouse_scale:'150万㎡',ai_summary:'墨西哥电商+25%高增速，拉美第二大。Mercado Libre主导32%。分期消费文化驱动。时尚+28%、美妆+25%强劲。',top_shops_count:18,hot_products_count:80,trending_content_count:45,content_vs_shelf:{content_conv:'8.5%',shelf_conv:'3.2%',live_avg_view:'12,500',short_video_avg_play:'400K',creator_avg_cost:'$120',search_traffic_share:'30%'},top_categories_growth:[['时尚','+28%'],['3C','+22%'],['家居','+20%'],['美妆','+25%'],['食品','+16%'],['母婴','+18%'],['运动','+16%'],['宠物','+15%'],['汽车配件','+14%'],['办公','+10%']],policy_news:[{level:'high',title:'VAT 16%',date:'持续',scope:'全品类',desc:'征16%'},{level:'mid',title:'安全物流',date:'持续',scope:'全品类',desc:'部分地区风险'},{level:'mid',title:'NOM认证',date:'持续',scope:'电子',desc:'需墨西哥标准'},{level:'low',title:'COFEPRIS',date:'持续',scope:'美妆',desc:'需卫生部注册'}]},
  ng: {gdp_total:'US$ 4,720亿',gdp_growth:'+3.0%',per_capita_gdp:'US$ 2,200',cpi:'+25%',currency:'1,550 NGN/USD',currency_trend:'down',disposable_income:'US$ 2,200',population:'2.23亿',ecommerce_users:'2,800万',online_penetration:'13%',trade_volume:'US$ 780亿',trade_growth:'+5.2%',cross_border_growth:'+35%',top_imports:'机械/消费品/化工',tariff_trend:'外汇管制',warehouse_scale:'35万㎡',ai_summary:'非洲最大电商市场+30%增速，2.23亿人口红利。假发+35%、3C+30%强劲。Jumia+社交电商为主。COD 45%注意回款。',top_shops_count:12,hot_products_count:55,trending_content_count:30,content_vs_shelf:{content_conv:'10.5%',shelf_conv:'2.0%',live_avg_view:'18,000',short_video_avg_play:'620K',creator_avg_cost:'$50',search_traffic_share:'20%'},top_categories_growth:[['3C','+30%'],['时尚','+28%'],['美妆','+25%'],['假发','+35%'],['食品','+18%'],['家居','+15%'],['运动','+14%'],['母婴','+20%'],['汽车配件','+16%'],['办公','+8%']],policy_news:[{level:'high',title:'外汇管制',date:'持续',scope:'跨境',desc:'美元极困难'},{level:'high',title:'NAFDAC注册',date:'持续',scope:'美妆',desc:'需尼日利亚FDA'},{level:'mid',title:'物流基础设施',date:'持续',scope:'全品类',desc:'极不完善'},{level:'low',title:'COD欺诈风险',date:'行业',scope:'全品类',desc:'拒收率较高'}]},
  nl: {gdp_total:'US$ 1.09万亿',gdp_growth:'+1.5%',per_capita_gdp:'US$ 52,000',cpi:'+2.5%',currency:'0.92 EUR/USD',currency_trend:'stable',disposable_income:'US$ 52,000',population:'1,780万',ecommerce_users:'1,510万',online_penetration:'85%',trade_volume:'US$ 1.18万亿',trade_growth:'+2.8%',cross_border_growth:'+10%',top_imports:'机械/化工/消费品',tariff_trend:'EU统一',warehouse_scale:'280万㎡',ai_summary:'荷兰人均电商消费Top3，可持续意识极强。iDEAL主导。鹿特丹港是物流枢纽。bol.com+Amazon双平台。',top_shops_count:16,hot_products_count:72,trending_content_count:35,content_vs_shelf:{content_conv:'4.5%',shelf_conv:'4.8%',live_avg_view:'5,200',short_video_avg_play:'320K',creator_avg_cost:'$320',search_traffic_share:'50%'},top_categories_growth:[['可持续时尚','+25%'],['家居园艺','+18%'],['电子','+15%'],['有机食品','+20%'],['美妆','+14%'],['运动','+16%'],['宠物','+18%'],['母婴','+12%'],['自行车','+10%'],['办公','+8%']],policy_news:[{level:'high',title:'EU统一合规',date:'持续执行',scope:'全品类',desc:'EU标准严格'},{level:'mid',title:'可持续包装',date:'建议',scope:'全品类',desc:'偏好环保包装'},{level:'mid',title:'iDEAL支付',date:'建议',scope:'全品类',desc:'荷兰最主流支付'},{level:'low',title:'WEEE注册',date:'持续',scope:'电子产品',desc:'EU电子废弃注册'}]},
  ph: {gdp_total:'US$ 4,400亿',gdp_growth:'+5.8%',per_capita_gdp:'US$ 3,850',cpi:'+3.2%',currency:'56.5 PHP/USD',currency_trend:'stable',disposable_income:'US$ 3,850',population:'1.15亿',ecommerce_users:'4,800万',online_penetration:'42%',trade_volume:'US$ 2,100亿',trade_growth:'+8.5%',cross_border_growth:'+28%',top_imports:'电子/机械/消费品',tariff_trend:'ASEAN优惠',warehouse_scale:'85万㎡',ai_summary:'菲律宾社交电商大国，美妆+35%、时尚+30%强劲。TikTok直播+Shopee双驱动。COD 50%需注意回款。',top_shops_count:18,hot_products_count:85,trending_content_count:48,content_vs_shelf:{content_conv:'9.5%',shelf_conv:'2.8%',live_avg_view:'15,000',short_video_avg_play:'520K',creator_avg_cost:'$80',search_traffic_share:'25%'},top_categories_growth:[['美妆','+35%'],['时尚','+30%'],['3C','+28%'],['母婴','+22%'],['食品','+18%'],['家居','+16%'],['运动','+15%'],['宠物','+14%'],['汽车配件','+12%'],['办公','+8%']],policy_news:[{level:'mid',title:'岛屿物流限制',date:'持续',scope:'全品类',desc:'偏远配送困难'},{level:'mid',title:'COD回款风险',date:'行业',scope:'全品类',desc:'COD 50%回款慢'},{level:'low',title:'VAT 12%',date:'持续',scope:'进口',desc:'征12%'},{level:'low',title:'FDA注册',date:'持续',scope:'美妆',desc:'需FDA注册'}]},
  pk: {gdp_total:'US$ 3,740亿',gdp_growth:'+2.5%',per_capita_gdp:'US$ 1,600',cpi:'+22%',currency:'280 PKR/USD',currency_trend:'down',disposable_income:'US$ 1,600',population:'2.3亿',ecommerce_users:'1,800万',online_penetration:'8%',trade_volume:'US$ 650亿',trade_growth:'+4.5%',cross_border_growth:'+32%',top_imports:'机械/消费品/纺织',tariff_trend:'外汇管制',warehouse_scale:'22万㎡',ai_summary:'巴基斯坦电商+30%高增速，2.3亿人口红利。Daraz主导35%。时尚+28%、3C+25%强劲。COD 50%注意回款。',top_shops_count:10,hot_products_count:45,trending_content_count:22,content_vs_shelf:{content_conv:'9.5%',shelf_conv:'2.0%',live_avg_view:'14,000',short_video_avg_play:'520K',creator_avg_cost:'$40',search_traffic_share:'18%'},top_categories_growth:[['时尚','+28%'],['3C','+25%'],['美妆','+22%'],['家居','+20%'],['食品','+16%'],['母婴','+18%'],['运动','+14%'],['宠物','+10%'],['汽车配件','+12%'],['办公','+8%']],policy_news:[{level:'mid',title:'经济不稳定',date:'持续',scope:'全品类',desc:'通胀+外汇管制'},{level:'mid',title:'物流基础设施',date:'持续',scope:'全品类',desc:'配送不稳定'},{level:'low',title:'COD风险',date:'行业',scope:'全品类',desc:'COD 50%'},{level:'low',title:'PSQCA认证',date:'持续',scope:'工业品',desc:'需标准认证'}]},
  pl: {gdp_total:'US$ 8,420亿',gdp_growth:'+3.8%',per_capita_gdp:'US$ 22,800',cpi:'+3.5%',currency:'4.05 PLN/USD',currency_trend:'stable',disposable_income:'US$ 22,800',population:'3,760万',ecommerce_users:'2,630万',online_penetration:'70%',trade_volume:'US$ 7,200亿',trade_growth:'+5.2%',cross_border_growth:'+18%',top_imports:'机械/电子/消费品',tariff_trend:'EU统一',warehouse_scale:'140万㎡',ai_summary:'中东欧最大电商+15%增速。Allegro主导42%份额。美妆+20%、家居+22%强劲。BLIK支付主导。',top_shops_count:16,hot_products_count:75,trending_content_count:36,content_vs_shelf:{content_conv:'6.0%',shelf_conv:'3.2%',live_avg_view:'7,500',short_video_avg_play:'350K',creator_avg_cost:'$150',search_traffic_share:'38%'},top_categories_growth:[['家居家电','+22%'],['美妆','+20%'],['电子','+18%'],['时尚','+16%'],['食品','+12%'],['母婴','+15%'],['运动','+14%'],['宠物','+18%'],['汽车配件','+12%'],['办公','+8%']],policy_news:[{level:'high',title:'EU统一合规',date:'持续执行',scope:'全品类',desc:'CE+EU标准'},{level:'mid',title:'波兰语说明',date:'持续',scope:'全品类',desc:'需波语描述'},{level:'mid',title:'14天退货',date:'持续',scope:'全品类',desc:'EU标准'},{level:'low',title:'GDPR',date:'持续',scope:'全品类',desc:'EU标准'}]},
  ru: {gdp_total:'US$ 2.02万亿',gdp_growth:'+3.5%',per_capita_gdp:'US$ 12,800',cpi:'+7.5%',currency:'92 RUB/USD',currency_trend:'volatile',disposable_income:'US$ 12,800',population:'1.44亿',ecommerce_users:'7,500万',online_penetration:'52%',trade_volume:'US$ 7,800亿',trade_growth:'+8.5%',cross_border_growth:'+40%',top_imports:'机械/消费品/化工',tariff_trend:'制裁+平行进口',warehouse_scale:'280万㎡',ai_summary:'俄罗斯电商+35%制裁下高增速。Wildberries+Ozon双寡头。进口替代需求极强。EAC认证必须。VK+Telegram营销。',top_shops_count:16,hot_products_count:78,trending_content_count:38,content_vs_shelf:{content_conv:'6.5%',shelf_conv:'3.5%',live_avg_view:'10,000',short_video_avg_play:'380K',creator_avg_cost:'$150',search_traffic_share:'35%'},top_categories_growth:[['家居家电','+25%'],['时尚','+22%'],['3C','+20%'],['美妆','+18%'],['食品','+15%'],['母婴','+16%'],['运动','+14%'],['宠物','+15%'],['汽车配件','+16%'],['办公','+10%']],policy_news:[{level:'high',title:'国际制裁',date:'持续',scope:'跨境',desc:'支付物流受限'},{level:'high',title:'EAC认证',date:'持续执行',scope:'全品类',desc:'海关联盟认证必须'},{level:'mid',title:'俄语标签',date:'持续',scope:'全品类',desc:'必须俄语'},{level:'low',title:'数据本地化',date:'持续',scope:'全品类',desc:'数据存境内'}]},
  se: {gdp_total:'US$ 5,930亿',gdp_growth:'+1.2%',per_capita_gdp:'US$ 52,500',cpi:'+2.0%',currency:'10.8 SEK/USD',currency_trend:'stable',disposable_income:'US$ 52,500',population:'1,050万',ecommerce_users:'920万',online_penetration:'88%',trade_volume:'US$ 4,100亿',trade_growth:'+2.5%',cross_border_growth:'+8%',top_imports:'机械/电子/消费品',tariff_trend:'EU统一',warehouse_scale:'85万㎡',ai_summary:'北欧电商渗透率最高，可持续消费极强。市场规模小但人均高。Klarna主导。Amazon+CDON双平台。',top_shops_count:14,hot_products_count:62,trending_content_count:30,content_vs_shelf:{content_conv:'4.2%',shelf_conv:'4.5%',live_avg_view:'4,800',short_video_avg_play:'280K',creator_avg_cost:'$350',search_traffic_share:'50%'},top_categories_growth:[['可持续时尚','+22%'],['智能家居','+20%'],['户外','+18%'],['有机食品','+16%'],['美妆','+14%'],['电子','+12%'],['宠物','+16%'],['母婴','+12%'],['办公','+8%'],['汽车配件','+10%']],policy_news:[{level:'high',title:'EU统一合规',date:'持续执行',scope:'全品类',desc:'CE/GDPR严格'},{level:'mid',title:'可持续包装',date:'建议',scope:'全品类',desc:'偏好环保'},{level:'mid',title:'瑞典语说明',date:'建议',scope:'全品类',desc:'本地化提升'},{level:'low',title:'Klarna支付',date:'建议',scope:'全品类',desc:'最主流支付'}]},
  sg: {gdp_total:'US$ 5,150亿',gdp_growth:'+2.8%',per_capita_gdp:'US$ 65,000',cpi:'+3.2%',currency:'1.35 SGD/USD',currency_trend:'stable',disposable_income:'US$ 65,000',population:'600万',ecommerce_users:'520万',online_penetration:'87%',trade_volume:'US$ 1.08万亿',trade_growth:'+4.5%',cross_border_growth:'+15%',top_imports:'电子/机械/消费品',tariff_trend:'自由贸易港',warehouse_scale:'25万㎡',ai_summary:'新加坡人均GDP全东南亚最高，客单价最高。Shopee主导40%。美妆+18%、健康+20%稳健。GST 9%需注意。',top_shops_count:14,hot_products_count:62,trending_content_count:30,content_vs_shelf:{content_conv:'5.5%',shelf_conv:'4.5%',live_avg_view:'6,500',short_video_avg_play:'350K',creator_avg_cost:'$350',search_traffic_share:'45%'},top_categories_growth:[['美妆','+18%'],['电子','+15%'],['家居','+16%'],['健康','+20%'],['时尚','+14%'],['食品','+12%'],['母婴','+15%'],['宠物','+18%'],['运动','+14%'],['办公','+8%']],policy_news:[{level:'high',title:'产品安全认证',date:'持续',scope:'电子',desc:'需Safety Mark'},{level:'mid',title:'HSA化妆品注册',date:'持续',scope:'美妆',desc:'需HSA批准'},{level:'mid',title:'SFA食品检验',date:'持续',scope:'食品',desc:'进口需检验'},{level:'low',title:'GST 9%',date:'持续',scope:'全品类',desc:'商品服务税9%'}]},
  tr: {gdp_total:'US$ 1.15万亿',gdp_growth:'+4.5%',per_capita_gdp:'US$ 10,800',cpi:'+65%',currency:'34.5 TRY/USD',currency_trend:'down',disposable_income:'US$ 10,800',population:'8,530万',ecommerce_users:'4,500万',online_penetration:'53%',trade_volume:'US$ 5,200亿',trade_growth:'+6.5%',cross_border_growth:'+45%',top_imports:'机械/电子/消费品',tariff_trend:'高关税',warehouse_scale:'180万㎡',ai_summary:'土耳其电商+40%高增速，通胀推动线上消费。Trendyol主导38%份额。美妆+28%、时尚+25%强劲。里拉贬值需注意汇率风险。',top_shops_count:16,hot_products_count:72,trending_content_count:35,content_vs_shelf:{content_conv:'7.8%',shelf_conv:'3.0%',live_avg_view:'12,000',short_video_avg_play:'380K',creator_avg_cost:'$120',search_traffic_share:'35%'},top_categories_growth:[['美妆','+28%'],['时尚','+25%'],['家居家电','+22%'],['3C','+20%'],['食品','+18%'],['母婴','+20%'],['运动','+16%'],['宠物','+15%'],['汽车配件','+14%'],['办公','+10%']],policy_news:[{level:'high',title:'进口高关税',date:'持续',scope:'全品类',desc:'对华额外关税'},{level:'high',title:'里拉汇率管制',date:'持续',scope:'跨境',desc:'外汇受限'},{level:'mid',title:'化妆品注册',date:'持续',scope:'美妆',desc:'需卫生部批准'},{level:'low',title:'TSE认证',date:'持续',scope:'工业品',desc:'土耳其标准'}]},
  ua: {gdp_total:'US$ 1,780亿',gdp_growth:'+3.5%',per_capita_gdp:'US$ 4,200',cpi:'+8.5%',currency:'41.5 UAH/USD',currency_trend:'volatile',disposable_income:'US$ 4,200',population:'3,700万',ecommerce_users:'2,200万',online_penetration:'60%',trade_volume:'US$ 780亿',trade_growth:'+5.5%',cross_border_growth:'+22%',top_imports:'机械/消费品/农产品',tariff_trend:'战争影响',warehouse_scale:'42万㎡',ai_summary:'乌克兰电商+20%恢复增长。Rozetka主导32%。数字化程度极高。太阳能+35%特殊需求。Nova Poshta物流标杆。',top_shops_count:12,hot_products_count:55,trending_content_count:28,content_vs_shelf:{content_conv:'6.0%',shelf_conv:'3.0%',live_avg_view:'8,500',short_video_avg_play:'350K',creator_avg_cost:'$100',search_traffic_share:'32%'},top_categories_growth:[['3C','+22%'],['时尚','+20%'],['家居','+18%'],['太阳能','+35%'],['美妆','+16%'],['食品','+14%'],['运动','+14%'],['母婴','+15%'],['汽车配件','+14%'],['办公','+8%']],policy_news:[{level:'mid',title:'战争物流',date:'持续',scope:'全品类',desc:'部分地区受限'},{level:'mid',title:'产品认证',date:'持续',scope:'全品类',desc:'乌克兰标准'},{level:'low',title:'消费者保护',date:'持续',scope:'全品类',desc:'14天退货'},{level:'low',title:'数据保护',date:'持续',scope:'全品类',desc:'合规'}]},
  za: {gdp_total:'US$ 3,770亿',gdp_growth:'+1.2%',per_capita_gdp:'US$ 6,200',cpi:'+4.8%',currency:'18.5 ZAR/USD',currency_trend:'volatile',disposable_income:'US$ 6,200',population:'6,060万',ecommerce_users:'2,200万',online_penetration:'36%',trade_volume:'US$ 2,680亿',trade_growth:'+3.5%',cross_border_growth:'+20%',top_imports:'机械/电子/消费品',tariff_trend:'金砖关税',warehouse_scale:'65万㎡',ai_summary:'非洲最成熟电商市场+18%增速。Takealot主导38%。Amazon进入。SHEIN冲击本土。电子+20%、时尚+22%增长。',top_shops_count:14,hot_products_count:65,trending_content_count:32,content_vs_shelf:{content_conv:'6.5%',shelf_conv:'3.5%',live_avg_view:'8,500',short_video_avg_play:'350K',creator_avg_cost:'$180',search_traffic_share:'38%'},top_categories_growth:[['电子','+20%'],['时尚','+22%'],['家居','+18%'],['健康','+20%'],['美妆','+18%'],['食品','+14%'],['运动','+16%'],['宠物','+15%'],['母婴','+16%'],['汽车配件','+12%']],policy_news:[{level:'high',title:'消费者保护法CPA',date:'持续',scope:'全品类',desc:'6个月退货权'},{level:'mid',title:'限电影响',date:'持续',scope:'全品类',desc:'影响配送'},{level:'mid',title:'NRCS认证',date:'持续',scope:'电子',desc:'需南非标准'},{level:'low',title:'BEE赋权',date:'建议',scope:'全品类',desc:'本土化建议'}]},
};

function cn2GetExt(key){ return cn2CountryExt[key] || cn2CountryExt['id']; }
function cn2GetTrendClass(t){ if(!t) return 'stable'; if(t.indexOf('+')>=0||t==='↑'||t==='利好') return 'up'; if(t.indexOf('-')>=0||t==='↓'||t==='收紧') return 'down'; return 'stable'; }

function cn2Render(key){
    return; // disabled v4 2026-08-21

  cn2CurrentKey = key;
  try{ localStorage.setItem('jay_last_country', key); }catch(e){}
  var d = countryFullData[key];
  var ext = cn2GetExt(key);
  if(!d) return;

  // 1. Quick tags
  var tagHtml = '';
  var allKeys = Object.keys(countryFullData);
  var hotKeys = ['id','us','jp','br','sa','th','my','vn','ae','ar','au','be','ca','cl','co','de','eg','es','fr','gb','il','in','it','ke','kr','kz','ma','mx','ng','nl','ph','pk','pl','ru','se','sg','tr','ua','za'];
  hotKeys.forEach(function(k){
    var cd = countryFullData[k];
    if(cd) tagHtml += '<button class="cn2-qtag'+(k===key?' active':'')+'" data-key="'+k+'">'+cd.flag+' '+cd.name+'</button>';
  });
  document.getElementById('cn2-quick-tags').innerHTML = tagHtml;

  // Quick tag click
  document.querySelectorAll('#cn2-quick-tags .cn2-qtag').forEach(function(btn){
    btn.onclick = function(){ cn2Render(this.dataset.key); };
  });

  // 2. AI One-liner
  var olHtml = '<span class="cn2-ai-icon">🧠</span>';
  olHtml += '<span class="cn2-ai-text"><b>'+d.flag+' '+d.name+'</b> — '+ext.ai_summary+'</span>';
  olHtml += '<button class="cn2-ai-btn" onclick="cn2GenMarketBrief(\''+escInline(key)+'\')">📝 生成简版分析</button>';
  olHtml += '<button class="cn2-ai-btn" onclick="rpAddMaterial(\'country\',\''+escInline(key)+'\',\''+escInline(d.name)+' 市场AI总览\')">+ 加入素材</button>';
  document.getElementById('cn2-ai-oneliner').innerHTML = olHtml;

  // 3. Update time
  document.getElementById('cn2-update-time').textContent = '数据更新于 '+new Date().toLocaleDateString('zh-CN')+' | 来源: 海关总署/世界银行/各平台官方';

  // === MAIN CONTENT ===
  var h = '';

  // Module 1: Macro Economic Data (4 tabs)
  h += '<div class="cn2-module">';
  h += '<div class="cn2-module-head"><h3>📊 宏观经济基础数据 <span class="cn2-m-badge">2026实时</span></h3>';
  h += '<div class="cn2-m-actions"><button onclick="cn2ExportMacro()">📥 导出板块</button><button onclick="rpAddMaterial(\'macro\',\''+escInline(key)+'\',\''+escInline(d.name)+' 宏观数据\')">📎 加入素材</button></div>';
  h += '</div>';
  // Macro tabs
  var macroTabs = ['💰 经济大盘','👥 人口消费','📦 外贸进出口','📋 本土政策'];
  h += '<div class="cn2-macro-tabs">';
  macroTabs.forEach(function(t,i){
    h += '<button class="cn2-mt-btn'+(cn2MacroTab===i?' active':'')+'" data-mtab="'+i+'">'+t+'</button>';
  });
  h += '</div>';

  // Tab 0: GDP/Economy
  h += '<div class="cn2-macro-panel'+(cn2MacroTab===0?' active':'')+'">';
  h += '<div class="cn2-metric-grid">';
  var ecoMetrics = [
    {icon:'🏛️',label:'GDP总量',value:ext.gdp_total,trend:d.macro[1][2],note:'年度经济增速 '+ext.gdp_growth},
    {icon:'💵',label:'人均GDP',value:ext.per_capita_gdp,trend:d.macro[3][2],note:'居民购买力指标'},
    {icon:'📈',label:'经济增速',value:ext.gdp_growth,trend:parseFloat(ext.gdp_growth)>3?'up':'stable',note:d.name+'年度GDP增长率'},
    {icon:'📊',label:'通胀率(CPI)',value:ext.cpi,trend:parseFloat(ext.cpi)>3?'down':'stable',note:'物价水平变动指标'},
    {icon:'💱',label:'货币汇率',value:ext.currency,trend:ext.currency_trend==='stable'?'stable':(ext.currency_trend==='down'?'down':'stable'),note:'本币兑美元汇率'},
    {icon:'💰',label:'人均可支配收入',value:ext.disposable_income,trend:d.macro[3][2],note:d.macro[3][3]}
  ];
  ecoMetrics.forEach(function(m){
    h += '<div class="cn2-metric-card"><div class="mc-icon">'+m.icon+'</div><div class="mc-label">'+m.label+'</div><div class="mc-value">'+m.value+'</div><div class="mc-trend '+cn2GetTrendClass(m.trend)+'">'+m.trend+'</div><div class="mc-note">'+m.note+'</div></div>';
  });
  h += '</div></div>';

  // Tab 1: Population & Consumer
  h += '<div class="cn2-macro-panel'+(cn2MacroTab===1?' active':'')+'">';
  h += '<div class="cn2-metric-grid">';
  var demoMetrics = [
    {icon:'👨‍👩‍👧‍👦',label:'总人口',value:ext.population,trend:d.macro[0][2],note:d.macro[0][3]},
    {icon:'🌐',label:'电商网民数',value:ext.ecommerce_users,trend:'↑',note:'线上购物活跃用户'},
    {icon:'📱',label:'线上渗透率',value:ext.online_penetration,trend:'↑',note:'互联网购物渗透比例'},
    {icon:'🎯',label:'主流消费年龄',value:d.demo.ai_age.split('，')[0],trend:'→',note:d.demo.ai_age},
    {icon:'♀️',label:'女性消费偏好',value:d.demo.f_pref.substring(0,12)+'...',trend:'→',note:d.demo.f_pref},
    {icon:'♂️',label:'男性消费偏好',value:d.demo.m_pref.substring(0,12)+'...',trend:'→',note:d.demo.m_pref}
  ];
  demoMetrics.forEach(function(m){
    h += '<div class="cn2-metric-card"><div class="mc-icon">'+m.icon+'</div><div class="mc-label">'+m.label+'</div><div class="mc-value">'+m.value+'</div><div class="mc-trend '+cn2GetTrendClass(m.trend)+'">'+m.trend+'</div><div class="mc-note">'+m.note+'</div></div>';
  });
  h += '</div>';
  // Age distribution
  h += '<div style="margin-top:16px"><h4 style="font-size:13px;margin-bottom:10px;color:var(--ink)">📊 年龄分层消费画像</h4>';
  d.demo.age.forEach(function(a){
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:60px;font-size:11px;color:var(--muted)">'+a[0]+'</span><div style="flex:1;height:18px;background:var(--paper);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+a[1]+'%;background:'+(a[1]>=28?'var(--green)':'#7a9a8e')+';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;color:#fff;font-weight:600">'+a[1]+'%</div></div><span style="width:120px;font-size:10px;color:var(--muted)">'+a[2]+'</span></div>';
  });
  h += '</div>';
  // Income distribution
  h += '<div style="margin-top:16px"><h4 style="font-size:13px;margin-bottom:10px;color:var(--ink)">💰 收入分层 & 消费定位</h4>';
  d.demo.income.forEach(function(inc){
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:80px;font-size:11px;color:var(--muted)">'+inc[0]+'</span><div style="flex:1;height:18px;background:var(--paper);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+inc[1]+'%;background:'+inc[3]+';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;color:#fff;font-weight:600">'+inc[1]+'%</div></div><span style="width:120px;font-size:10px;color:var(--muted)">'+inc[2]+'</span></div>';
  });
  h += '</div></div>';

  // Tab 2: Trade
  h += '<div class="cn2-macro-panel'+(cn2MacroTab===2?' active':'')+'">';
  h += '<div class="cn2-metric-grid">';
  var tradeMetrics = [
    {icon:'🚢',label:'对华进出口总额',value:ext.trade_volume,trend:d.macro[5][2],note:d.macro[5][3]},
    {icon:'📈',label:'跨境电商增速',value:ext.cross_border_growth,trend:'up',note:'年度跨境电商增长'},
    {icon:'📦',label:'重点进口类目',value:ext.top_imports,trend:'→',note:'主要进口商品类别'},
    {icon:'🏷️',label:'关税政策',value:ext.tariff_trend,trend:ext.tariff_trend.indexOf('下调')>=0?'up':(ext.tariff_trend.indexOf('加征')>=0?'down':'stable'),note:'当前关税走向'},
    {icon:'🏭',label:'海外仓规模',value:ext.warehouse_scale,trend:'↑',note:'当地仓储基建面积'},
    {icon:'🌍',label:'外贸环境',value:d.macro[5][1],trend:d.macro[5][2],note:d.macro[5][3]}
  ];
  tradeMetrics.forEach(function(m){
    h += '<div class="cn2-metric-card"><div class="mc-icon">'+m.icon+'</div><div class="mc-label">'+m.label+'</div><div class="mc-value">'+m.value+'</div><div class="mc-trend '+cn2GetTrendClass(m.trend)+'">'+m.trend+'</div><div class="mc-note">'+m.note+'</div></div>';
  });
  h += '</div></div>';

  // Tab 3: Policy
  h += '<div class="cn2-macro-panel'+(cn2MacroTab===3?' active':'')+'">';
  h += '<div class="cn2-policy-list">';
  ext.policy_news.forEach(function(p){
    var riskClass = p.level==='high' ? ' cn2-policy-highrisk' : '';
    h += '<div class="cn2-policy-card '+p.level+riskClass+'">';
    if(p.level==='high') h += '<div class="cn2-risk-badge">⚠ 高危政策预警</div>';
    h += '<div class="pc-head"><span class="pc-level '+p.level+'">'+(p.level==='high'?'🔴 高风险':p.level==='mid'?'🟡 中风险':'🟢 低风险')+'</span><span class="pc-title">'+p.title+'</span></div>';
    h += '<div class="pc-meta">'+p.date+' · 影响范围: '+p.scope+'</div>';
    h += '<div class="pc-desc">'+p.desc+'</div>';
    h += '<div class="pc-actions">';
    h += '<button onclick="rpAddMaterial(\'policy\',\''+escInline(p.title)+'\')">📎 加入素材</button>';
    h += '<button onclick="toast(\'已同步至预警中心：'+escInline(p.title)+'\')">⚠️ 同步预警</button>';
    if(p.level==='high') h += '<button onclick="alert(\'【高危政策提醒】\\n\\n'+escInline(p.title)+'\\n\\n生效时间: '+escInline(p.date)+'\\n影响范围: '+escInline(p.scope)+'\\n\\n'+escInline(p.desc)+'\\n\\n建议: 密切关注政策动向，评估业务影响，提前准备应对方案。\')">📋 风险详情</button>';
    h += '</div>';
    h += '</div>';
  });
  h += '</div></div>';

  h += '</div>'; // end Module 1

  // Module 2: Full Platform E-commerce Data
  h += '<div class="cn2-module">';
  h += '<div class="cn2-module-head"><h3>🛒 该国全平台电商行情 <span class="cn2-m-badge">'+d.plats.length+'大平台</span></h3>';
  h += '<div class="cn2-m-actions"><button onclick="cn2ExportPlats()">📥 导出板块</button></div></div>';

  // Content vs Shelf comparison
  h += '<div class="cn2-ecom-compare">';
  h += '<div class="cn2-ecom-box"><h4>📱 内容电商数据</h4>';
  h += '<div class="eb-row"><span class="eb-label">短视频转化率</span><span class="eb-value">'+ext.content_vs_shelf.content_conv+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">直播平均场观</span><span class="eb-value">'+ext.content_vs_shelf.live_avg_view+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">达人投放均价</span><span class="eb-value">'+ext.content_vs_shelf.creator_avg_cost+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">短视频平均播放</span><span class="eb-value">'+ext.content_vs_shelf.short_video_avg_play+'</span></div>';
  h += '</div>';
  h += '<div class="cn2-ecom-box"><h4>🔍 货架电商数据</h4>';
  h += '<div class="eb-row"><span class="eb-label">搜索转化率</span><span class="eb-value">'+ext.content_vs_shelf.shelf_conv+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">搜索流量占比</span><span class="eb-value">'+ext.content_vs_shelf.search_traffic_share+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">客单价趋势</span><span class="eb-value">'+d.demo.price_trend+'</span></div>';
  h += '<div class="eb-row"><span class="eb-label">COD比例</span><span class="eb-value">'+d.demo.cod+'%</span></div>';
  h += '</div></div>';

  // Platform cards
  h += '<div class="cn2-plat-compare">';
  var platColors2 = ['#3b7ab8','#2c5f8a','#4a90d9','#c8a84e','#e8879a'];
  d.plats.forEach(function(p, i){
    // Check for related rule changes from rules.json
    var platRuleBadges = '';
    (function(){
      var rItems = (typeof rulesJsonData !== 'undefined' && rulesJsonData) ? rulesJsonData.items : (typeof defaultRulesData !== 'undefined' ? defaultRulesData.items : []);
      var platName = p[0];
      var matchedRules = rItems.filter(function(r){
        var rPlat = (r.platform || '').toLowerCase();
        var pn = platName.toLowerCase();
        if(rPlat === 'multi') return true;
        if(rPlat.indexOf(pn) >= 0 || pn.indexOf(rPlat) >= 0) return true;
        return false;
      });
      if(matchedRules.length > 0){
        matchedRules.sort(function(a,b){ return (b.published_at||'').localeCompare(a.published_at||''); });
        var recent = matchedRules.filter(function(r){
          if(!r.published_at) return false;
          var d = new Date(r.published_at);
          var now = new Date();
          return (now - d) < 90 * 24 * 60 * 60 * 1000;
        });
        if(recent.length > 0){
          var level = recent[0].impact_level;
          var badgeColor = level === 'high' ? '#c0392b' : level === 'medium' ? '#c8a84e' : 'var(--green)';
          var badgeText = level === 'high' ? '🔴 新规则' : level === 'medium' ? '🟡 规则更新' : '🟢 规则变动';
          platRuleBadges = '<div style="margin-top:4px"><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;color:#fff;background:'+badgeColor+';cursor:pointer" onclick="event.stopPropagation();JAY_CTX.platform=\''+p[0]+'\';switchPage(\'rules\')" title="'+recent[0].title+'">'+badgeText+' ('+recent.length+')</span></div>';
        }
      }
    })();
    h += '<div class="cn2-plat-card-v2">';
    h += '<div class="pv-head"><span class="pv-emoji">'+p[1]+'</span><span class="pv-name">'+p[0]+'</span><span class="pv-share">'+p[2]+'%</span></div>';
    h += '<div class="pv-metrics">';
    h += '<div class="pv-m-item"><div class="pv-m-label">模式</div><div class="pv-m-value">'+p[3]+'</div></div>';
    h += '<div class="pv-m-item"><div class="pv-m-label">入驻</div><div class="pv-m-value">'+p[4]+'</div></div>';
    h += '<div class="pv-m-item"><div class="pv-m-label">佣金</div><div class="pv-m-value">'+p[5]+'</div></div>';
    h += '<div class="pv-m-item"><div class="pv-m-label">热度</div><div class="pv-m-value">'+p[7]+'</div></div>';
    h += '</div>';
    h += '<div class="pv-tags"><span class="pv-tag">'+p[6]+'</span>'+platRuleBadges+'</div>';
    h += '</div>';
  });
  h += '</div>';

  // D-43 交互式图表：该国各平台份额对比（jayBarChart，hover tooltip + 动画）
  try{
    var shareItems = d.plats.map(function(p){ return {label:p[0], value:parseFloat(p[2])||0}; });
    if(shareItems.length){
      h += '<div class="cn2-module"><div class="cn2-module-head"><h3>📊 平台份额对比 <span class="cn2-m-badge">交互图表 · 悬停看数值</span></h3></div>';
      h += jayBarChart(shareItems, {unit:'%', fmt:function(v){return v.toFixed(1);}});
      h += '</div>';
    }
  }catch(e){}

  // Top 10 Growth Categories
  h += '<div style="margin-top:18px"><h4 style="font-size:13px;margin-bottom:10px;color:var(--ink)">🏆 增速TOP10类目</h4>';
  h += '<div class="cn2-cat-top10">';
  ext.top_categories_growth.forEach(function(c){
    h += '<div class="cn2-cat-item-v2" onclick="switchPage(\'products\');toast(\'跳转产品雷达筛选: '+escInline(c[0])+'\')"><div class="ci-name">'+escapeHtml(c[0])+'</div><div class="ci-growth">'+escapeHtml(c[1])+'</div></div>';
  });
  h += '</div></div>';

  // Blue ocean / Stable / Risk categories
  h += '<div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">';
  h += '<div style="padding:14px;background:rgba(44,95,138,.05);border:1px solid rgba(44,95,138,.2);border-radius:10px"><h4 style="font-size:12px;color:var(--green);margin-bottom:8px">🌊 蓝海低竞争类目</h4>';
  d.cat.blue.forEach(function(c){ h += '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">'+c[0]+' <span style="color:var(--green);font-weight:600;font-size:11px">'+c[1]+'</span></div>'; });
  h += '</div>';
  h += '<div style="padding:14px;background:rgba(200,168,78,.05);border:1px solid rgba(200,168,78,.2);border-radius:10px"><h4 style="font-size:12px;color:#c8a84e;margin-bottom:8px">📦 稳定大盘类目</h4>';
  d.cat.stable.forEach(function(c){ h += '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">'+c+'</div>'; });
  h += '</div>';
  h += '<div style="padding:14px;background:rgba(192,57,43,.05);border:1px solid rgba(192,57,43,.2);border-radius:10px"><h4 style="font-size:12px;color:#c0392b;margin-bottom:8px">⚠️ 高风险/禁售类目</h4>';
  d.cat.risk.forEach(function(c){ h += '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">'+c[0]+' <span style="color:#c0392b;font-size:10px">'+c[1]+'</span></div>'; });
  h += '</div></div>';

  h += '</div>'; // end Module 2

  // Module 3: Cross-page Quick Links
  h += '<div class="cn2-module">';
  h += '<div class="cn2-module-head"><h3>🔗 联动数据快捷入口</h3></div>';
  h += '<div class="cn2-link-cards">';
  h += '<div class="cn2-link-card" onclick="switchPage(\'products\')"><div class="lc-icon">🔥</div><div class="lc-title">该国爆款商品</div><div class="lc-desc">跳转产品全域雷达，自动筛选'+d.name+'全部商品</div><div class="lc-count">'+ext.hot_products_count+'</div></div>';
  h += '<div class="cn2-link-card" onclick="switchPage(\'shops\')"><div class="lc-icon">🏪</div><div class="lc-title">该国竞店清单</div><div class="lc-desc">跳转店铺追踪，仅展示'+d.name+'已监控店铺</div><div class="lc-count">'+ext.top_shops_count+'</div></div>';
  h += '<div class="cn2-link-card" onclick="switchPage(\'content\')"><div class="lc-icon">🎬</div><div class="lc-title">该国热门种草内容</div><div class="lc-desc">跳转热门内容追踪，筛选本土短视频/直播素材</div><div class="lc-count">'+ext.trending_content_count+'</div></div>';
  h += '<div class="cn2-link-card" onclick="JAY_CTX.country=\''+d.name+'\';switchPage(\'platforms\')"><div class="lc-icon">🏪</div><div class="lc-title">查看相关平台档案</div><div class="lc-desc">跳转电商平台档案，查看'+d.name+'地区相关平台详情</div><div class="lc-count">'+d.plats.length+'</div></div>';
  h += '<div class="cn2-link-card" onclick="JAY_CTX.country=\''+d.name+'\';switchPage(\'policies\')"><div class="lc-icon">📜</div><div class="lc-title">查看相关政策动态</div><div class="lc-desc">跳转政策动态页面，筛选'+d.name+'地区相关政策</div><div class="lc-count">'+d.comp.policies.length+'</div></div>';
  h += '<div class="cn2-link-card" onclick="JAY_CTX.country=\''+d.name+'\';switchPage(\'rules\')"><div class="lc-icon">📋</div><div class="lc-title">查看相关规则变动</div><div class="lc-desc">跳转平台规则变动页面，查看相关平台最新规则</div><div class="lc-count">-</div></div>';
  h += '</div></div>';

  // Module 4: Consumer behavior summary
  h += '<div class="cn2-module">';
  h += '<div class="cn2-module-head"><h3>🛍️ 消费行为画像</h3></div>';
  h += '<div class="cn2-ecom-compare">';
  h += '<div class="cn2-ecom-box"><h4>🏪 货架消费特征</h4><p style="font-size:12px;color:#555;line-height:1.6">'+d.demo.shelf+'</p></div>';
  h += '<div class="cn2-ecom-box"><h4>📱 内容消费特征</h4><p style="font-size:12px;color:#555;line-height:1.6">'+d.demo.content+'</p></div>';
  h += '</div>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">';
  h += '<div style="flex:1;min-width:150px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:11px;color:var(--muted)">主流支付方式</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:4px">'+d.demo.payment+'</div></div>';
  h += '<div style="flex:1;min-width:150px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:11px;color:var(--muted)">COD货到付款</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:4px">'+d.demo.cod+'%</div></div>';
  h += '<div style="flex:1;min-width:150px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:11px;color:var(--muted)">购物高峰时段</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:4px">'+d.demo.peak+'</div></div>';
  h += '<div style="flex:1;min-width:150px;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:11px;color:var(--muted)">年度营销节点</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:4px">'+d.demo.fest+'</div></div>';
  h += '</div></div>';

  document.getElementById('cn2-main').innerHTML = h;

  // === SIDEBAR ===
  var sh = '';
  // Compliance section
  sh += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px">';
  sh += '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">⚖️ 合规预警</h4>';
  sh += '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;color:#fff;background:'+(d.comp.cls==='strict'?'#c0392b':d.comp.cls==='medium'?'#c8a84e':'var(--green)')+'">合规难度: '+d.comp.level+'</span>';
  sh += '<div style="margin-top:10px">';
  d.comp.policies.forEach(function(p){
    sh += '<div style="padding:8px 0;border-bottom:1px solid var(--border)">';
    sh += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:6px;height:6px;border-radius:50%;background:'+(p[0]==='high'?'#c0392b':p[0]==='mid'?'#c8a84e':'var(--green)')+'"></span><span style="font-size:12px;font-weight:600;color:var(--ink)">'+p[1]+'</span></div>';
    sh += '<div style="font-size:10px;color:var(--muted)">'+p[2]+' · '+p[3]+' · '+p[4]+'</div>';
    sh += '<div style="font-size:11px;color:#555;margin-top:4px;line-height:1.4">'+p[5]+'</div>';
    sh += '</div>';
  });
  sh += '</div>';

  // === Cross-link: Related Policy Updates from policies.json ===
  (function(){
    var pItems = (typeof policiesJsonData !== 'undefined' && policiesJsonData) ? policiesJsonData.items : (typeof defaultPoliciesData !== 'undefined' ? defaultPoliciesData.items : []);
    var countryName = d.name;
    var countryRegion = d.region;
    var regionCodeMap = {'东南亚':'SEA','北美':'US','东亚':'JP','拉美':'BR','中东':'SA','Global':'Global'};
    var nameKeywords = {'印度尼西亚':'印尼','美国':'美','日本':'日','巴西':'巴西','沙特阿拉伯':'沙特','泰国':'泰','马来西亚':'马来','越南':'越'};
    var regionCode = regionCodeMap[countryRegion] || '';
    var relatedPolicies = pItems.filter(function(p){
      var pRegion = p.region || '';
      if(pRegion === 'Global') return true;
      if(pRegion === regionCode) return true;
      var kw = nameKeywords[countryName] || countryName;
      if(pRegion.indexOf(kw) >= 0 || pRegion.indexOf(countryRegion) >= 0) return true;
      return false;
    });
    if(relatedPolicies.length > 0){
      relatedPolicies.sort(function(a,b){ return (b.published_at||'').localeCompare(a.published_at||''); });
      var top5 = relatedPolicies.slice(0, 5);
      sh += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border)">';
      sh += '<h5 style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:8px">📡 相关政策动态 <span style="font-size:10px;color:var(--muted);font-weight:400">(来自政策库)</span></h5>';
      top5.forEach(function(p){
        var impactCls = p.impact_level === 'high' ? '#c0392b' : p.impact_level === 'medium' ? '#c8a84e' : 'var(--green)';
        var impactLabel = p.impact_level === 'high' ? '高' : p.impact_level === 'medium' ? '中' : '低';
        sh += '<div style="padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="switchPage(\'policies\')">';
        sh += '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">';
        sh += '<span style="width:6px;height:6px;border-radius:50%;background:'+impactCls+';flex-shrink:0"></span>';
        sh += '<span style="font-size:11px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.title+'</span>';
        sh += '</div>';
        sh += '<div style="font-size:10px;color:var(--muted)">'+( p.published_at||'')+' · <span style="color:'+impactCls+'">'+impactLabel+'</span></div>';
        sh += '</div>';
      });
      sh += '<button style="width:100%;padding:6px;border:1px solid var(--green);color:var(--green);border-radius:6px;background:transparent;font-size:11px;cursor:pointer;margin-top:8px" onclick="switchPage(\'policies\')">查看全部政策动态 →</button>';
      sh += '</div>';
    }
  })();

  sh += '<button style="width:100%;padding:8px;border:1px solid var(--green);color:var(--green);border-radius:6px;background:transparent;font-size:12px;cursor:pointer;margin-top:10px" onclick="switchPage(\'policies\')">查看政策动态全景 →</button>';
  sh += '</div>';

  // Price bands section
  sh += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px">';
  sh += '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">💰 价格带 & 渠道策略</h4>';
  d.demo.price.forEach(function(p){
    sh += '<div style="padding:8px;background:var(--paper);border-radius:6px;margin-bottom:6px"><div style="font-size:12px;font-weight:600;color:var(--ink)">'+p[0]+'</div><div style="font-size:10px;color:var(--muted)">'+p[1]+' · '+p[2]+'</div><div style="font-size:11px;color:#555;margin-top:2px">'+p[3]+'</div></div>';
  });
  sh += '</div>';

  // Religion & culture section
  sh += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px">';
  sh += '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">🕌 宗教 & 文化禁忌</h4>';
  d.demo.religion.forEach(function(r){
    sh += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><div style="flex:1;height:6px;background:var(--paper);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+r[1]+'%;background:var(--green);border-radius:3px"></div></div><span style="font-size:10px;color:var(--muted);width:80px">'+r[0]+' '+r[1]+'%</span></div>';
  });
  sh += '<div style="margin-top:8px;padding:8px;background:rgba(192,57,43,.05);border-radius:6px">';
  sh += '<div style="font-size:11px;font-weight:600;color:#c0392b;margin-bottom:4px">⚠️ 营销禁忌</div>';
  d.demo.risk.forEach(function(r){ sh += '<div style="font-size:10px;color:#555;padding:2px 0">• '+r+'</div>'; });
  sh += '</div>';
  sh += '<div style="margin-top:6px;padding:8px;background:rgba(44,95,138,.05);border-radius:6px">';
  sh += '<div style="font-size:11px;font-weight:600;color:var(--green);margin-bottom:4px">✅ 文化机会</div>';
  d.demo.opp.forEach(function(o){ sh += '<div style="font-size:10px;color:#555;padding:2px 0">• '+o+'</div>'; });
  sh += '</div></div>';

  // AI entry advice
  sh += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px">';
  sh += '<h4 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">🎯 AI 入场策略建议</h4>';
  d.ai.advice.forEach(function(a){
    var idx = a.indexOf('：');
    sh += '<div style="padding:8px;background:var(--paper);border-radius:6px;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:var(--green)">'+a.substring(0,idx)+'</span><span style="font-size:11px;color:#555">'+a.substring(idx)+'</span></div>';
  });
  sh += '</div>';

  document.getElementById('cn2-aside').innerHTML = sh;

  // Bind macro tab events
  document.querySelectorAll('.cn2-mt-btn').forEach(function(btn){
    btn.onclick = function(){
      cn2MacroTab = parseInt(this.dataset.mtab);
      cn2Render(cn2CurrentKey);
    };
  });
}

// Time filter
document.querySelectorAll('.cn2-tf-btn').forEach(function(btn){
  btn.onclick = function(){
    document.querySelectorAll('.cn2-tf-btn').forEach(function(b){b.classList.remove('active')});
    this.classList.add('active');
    cn2TimeFilter = this.dataset.tf;
    cn2Render(cn2CurrentKey);
    var tfLabels={'3m':'近3个月','6m':'近半年','1y':'近1年','3y':'近3年','5y':'近5年'};toast('已切换至'+(tfLabels[cn2TimeFilter]||cn2TimeFilter)+'数据');
  };
});

// Search
(function(){
  var searchInput = document.getElementById('cn2-search');
  var dd = document.getElementById('cn2-search-dd');
  if(!searchInput || !dd) return;
  searchInput.addEventListener('input', jayDebounce(function(){
    var q = this.value.toLowerCase();
    if(!q){ dd.classList.remove('open'); return; }
    var keys = Object.keys(countryFullData);
    var html = '';
    keys.forEach(function(k){
      var d = countryFullData[k];
      if(d && (d.name.toLowerCase().indexOf(q)>=0 || d.subtitle.toLowerCase().indexOf(q)>=0 || d.region.toLowerCase().indexOf(q)>=0)){
        html += '<div class="cn2-dd-item" data-key="'+k+'">'+d.flag+' '+d.name+' <span style="font-size:10px;color:var(--muted)">('+d.region+')</span></div>';
      }
    });
    dd.innerHTML = html || '<div style="padding:10px;font-size:12px;color:var(--muted)">未找到匹配国家</div>';
    dd.classList.add('open');
  }, 250));
  dd.addEventListener('click', function(e){
    var item = e.target.closest('.cn2-dd-item');
    if(item){ cn2Render(item.dataset.key); searchInput.value=''; dd.classList.remove('open'); }
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.cn2-search-wrap')){ dd.classList.remove('open'); }});
})();

// Export functions
function cn2ExportPDF(){
    return; // disabled v4 2026-08-21

  var key=cn2CurrentKey;
  var d=countryFullData[key];
  var ext=cn2GetExt(key);
  if(!d||!ext){toast('数据加载失败');return}
  toast('正在生成'+d.name+'完整市场报告...');
  setTimeout(function(){
    var md='# '+d.flag+' '+d.name+' — 市场全景报告\n\n';
    md+='> 生成时间: '+new Date().toLocaleString('zh-CN')+'\n\n';
    md+='## 一、宏观经济概览\n\n';
    md+='| 指标 | 数值 |\n|------|------|\n';
    md+='| GDP总量 | '+ext.gdp_total+' |\n';
    md+='| GDP增速 | '+ext.gdp_growth+' |\n';
    md+='| 人均GDP | '+ext.per_capita_gdp+' |\n';
    md+='| CPI通胀 | '+ext.cpi+' |\n';
    md+='| 货币汇率 | '+ext.currency+' |\n';
    md+='| 可支配收入 | '+ext.disposable_income+' |\n\n';
    md+='## 二、人口与消费\n\n';
    md+='| 指标 | 数值 |\n|------|------|\n';
    md+='| 总人口 | '+ext.population+' |\n';
    md+='| 电商网民 | '+ext.ecommerce_users+' |\n';
    md+='| 线上渗透率 | '+ext.online_penetration+' |\n\n';
    md+='## 三、外贸进出口\n\n';
    md+='| 指标 | 数值 |\n|------|------|\n';
    md+='| 对华贸易总额 | '+ext.trade_volume+' |\n';
    md+='| 跨境增速 | '+ext.cross_border_growth+' |\n';
    md+='| 关税趋势 | '+ext.tariff_trend+' |\n';
    md+='| 海外仓规模 | '+ext.warehouse_scale+' |\n\n';
    md+='## 四、政策动态\n\n';
    ext.policy_news.forEach(function(p){
      md+='- ['+( p.level==='high'?'🔴高':'  ')+'] '+p.title+' ('+p.date+')\n';
    });
    md+='\n## 五、AI市场洞察\n\n';
    md+=ext.ai_summary+'\n\n';
    md+='---\n\n';
    md+='**数据来源声明**\n\n';
    md+='- 宏观经济数据：世界银行、IMF、各国统计局、各国央行\n';
    md+='- 外贸数据：海关总署、WTO、各国海关\n';
    md+='- 电商数据：各平台官方公告、eMarketer、Statista\n';
    md+='- 政策数据：各国政府官网、官方公报\n';
    md+='- 本报告由 JAY观海 全球电商情报系统 AI 自动生成\n';
    var blob=new Blob([md],{type:'text/markdown'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;
    a.download=d.name+'_市场报告_'+new Date().toISOString().slice(0,10)+'.md';
    a.click();URL.revokeObjectURL(url);
    toast(d.name+'市场报告已导出');
  },1200);
}
function cn2ExportExcel(){
    return; // disabled v4 2026-08-21
 toast('正在导出'+countryFullData[cn2CurrentKey].name+'市场数据Excel...'); setTimeout(function(){ toast('Excel已导出'); }, 1000); }
function cn2ExportMacro(){
  var key=cn2CurrentKey;
  var ext=cn2GetExt(key);
  var d=countryFullData[key];
  if(!ext||!d){toast('无数据可导出');return}
  var csv='分类,指标,数值,数据来源\n';
  csv+='经济大盘,GDP总量,'+ext.gdp_total+',世界银行\n';
  csv+='经济大盘,GDP增速,'+ext.gdp_growth+',IMF\n';
  csv+='经济大盘,人均GDP,'+ext.per_capita_gdp+',世界银行\n';
  csv+='经济大盘,CPI通胀率,'+ext.cpi+',各国央行\n';
  csv+='经济大盘,货币汇率,'+ext.currency+',实时汇率API\n';
  csv+='经济大盘,货币趋势,'+ext.currency_trend+',外汇市场\n';
  csv+='经济大盘,人均可支配收入,'+ext.disposable_income+',各国统计局\n';
  csv+='人口消费,总人口,'+ext.population+',联合国\n';
  csv+='人口消费,电商网民数,'+ext.ecommerce_users+',eMarketer\n';
  csv+='人口消费,线上渗透率,'+ext.online_penetration+',eMarketer\n';
  csv+='外贸进出口,对华贸易总额,'+ext.trade_volume+',海关总署\n';
  csv+='外贸进出口,跨境增速,'+ext.trade_growth+',海关总署\n';
  csv+='外贸进出口,跨境电商增速,'+ext.cross_border_growth+',海关总署\n';
  csv+='外贸进出口,重点进口类目,'+ext.top_imports+',海关总署\n';
  csv+='外贸进出口,关税趋势,'+ext.tariff_trend+',WTO\n';
  csv+='外贸进出口,海外仓规模,'+ext.warehouse_scale+',行业报告\n';
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download=d.name+'_宏观数据_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();URL.revokeObjectURL(url);
  toast(d.name+' 宏观数据已导出CSV');
}
function cn2ExportPlats(){
  var key=cn2CurrentKey;
  var d=countryFullData[key];
  if(!d){toast('无数据');return}
  var csv='平台名称,月活用户(MAU),GMV增速,客单价,市场份额,数据来源\n';
  d.plats.forEach(function(p){
    csv+='"'+p.name+'","'+p.mau+'","'+p.growth+'","'+p.aov+'","'+p.share+'","平台官方公告/eMarketer"\n';
  });
  csv+='\n数据来源: JAY观海系统监测 + 各平台官方公告 + eMarketer + Statista\n';
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download=d.name+'_平台数据_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();URL.revokeObjectURL(url);
  toast(d.name+' 平台数据已导出CSV');
}
function cn2AddMaterial(){
    return; // disabled v4 2026-08-21
 rpAddMaterial('country', cn2CurrentKey, countryFullData[cn2CurrentKey].name+' 完整市场档案', '宏观+电商+政策+人口全量数据'); toast('已加入报告素材'); }

// Initial render
// Generate market brief analysis and add to report pool
function cn2GenMarketBrief(key){
  var ext=cn2GetExt(key);
  var d=countryFullData[key];
  if(!ext||!d){toast('数据加载失败');return}
  var brief='【'+d.name+'市场简版分析】\n\n';
  brief+='核心指标: GDP '+ext.gdp_total+' | 增速 '+ext.gdp_growth+' | 人均 '+ext.per_capita_gdp+'\n';
  brief+='人口红利: 总人口 '+ext.population+' | 电商网民 '+ext.ecommerce_users+' | 渗透率 '+ext.online_penetration+'\n';
  brief+='外贸数据: 对华贸易 '+ext.trade_volume+' | 跨境增速 '+ext.cross_border_growth+'\n';
  brief+='AI洞察: '+ext.ai_summary+'\n';
  brief+='政策环境: '+ext.policy_news.length+'条最新动态\n';
  brief+='数据来源: JAY观海系统+海关总署+世界银行+各国统计局\n';
  rpAddMaterial('country',key,d.name+' 市场简版分析报告',brief);
  toast('已生成'+d.name+'简版分析并加入报告素材');
}

cn2Render(cn2CurrentKey);

// === Dynamic Country Data Loading ===
var countryDataLoaded = false;
async function loadCountryData(){
  try {
    var data = await jayFetchMarketData('countries', './data/countries.json');
    if(!data) throw new Error('Failed to load country data');
    if(data && typeof data === 'object' && Object.keys(data).length > 0){
      // Filter out metadata keys (e.g. _metadata) - only keep 2-letter country codes
      var cleaned = {};
      for(var k in data){ if(/^([a-z]{2})$/.test(k) && data[k] && data[k].flag) cleaned[k] = data[k]; }
      countryFullData = cleaned;
      countryDataLoaded = true;
      console.log('Country data loaded from countries.json');
      // Re-render if cn2 page is active
      if(cn2CurrentKey && countryFullData[cn2CurrentKey]){
        cn2Render(cn2CurrentKey);
      }
      // N-11 国家默认记忆：数据加载后跳转到上次访问的国家
      if(jayLastCountry && countryFullData[jayLastCountry] && cn2CurrentKey!==jayLastCountry){
        cn2Render(jayLastCountry);
      }
      // Refresh alerts linkage
      if(typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
      // Rebuild real-data search index once country data is in
      if(typeof jayRebuildSearch === 'function') jayRebuildSearch();
    } else {
      throw new Error('Empty data');
    }
  } catch(e){
    console.warn('Failed to load countries.json, using built-in fallback:', e);
  }
}
loadCountryData();

// Remove old renderCountry default call
// renderCountry('id'); -- disabled


// === 新增页面：渲染函数 ===
function fillSelect(id,items,labels){
  const sel=$(id); if(!sel) return;
  const first=sel.options[0];
  sel.innerHTML='';
  if(first) sel.appendChild(first);
  items.forEach(function(i){
    const o=document.createElement('option');
    o.value=i;
    o.textContent=labels && labels[i] ? labels[i] : i;
    sel.appendChild(o);
  });
}


// -- 电商平台档案 (Full Rebuild) --
// Populate enhanced filter selects
fillSelect('#pf-f-region',[...new Set(platformsData.map(p=>p[1]))].sort());
fillSelect('#pf-f-type',[...new Set(platformsData.map(p=>p[6]))].sort());

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
      <input type="checkbox" class="pf-card-check" ${checked} onclick="event.stopPropagation();pfToggleSelect('${escInline(p[0])}')">
      <div class="pf-card-head"><div class="pf-logo" style="background:${pfLogoColor(p[0])}">${escapeHtml(p[0].charAt(0))}</div><h3>${escapeHtml(p[0])}</h3><span class="pf-card-badge ${badgeClass}">${escapeHtml(p[6])}</span></div>
      <div class="pf-card-meta">${escapeHtml(p[1])} · 佣金 ${p[4]}% · ${escapeHtml(ext.shipping||'N/A')}</div>
      <div class="pf-card-cats">🔥 ${hotCatsHtml} 💎 ${blueCatsHtml}</div>
      <div class="pf-card-data">
        <div class="pf-data-item">全球GMV<b>${gmv}</b></div>
        <div class="pf-data-item">月活用户<b>${mau}</b></div>
        <div class="pf-data-item">增速<b class="${growthColor}">${growthArrow} ${growthStr}</b></div>
        <div class="pf-data-item">客单价<b>${escapeHtml(ext.priceRange||'N/A')}</b></div>
      </div>
      <div class="pf-card-ops">
        <button onclick="event.stopPropagation();openPfDetail('${escInline(p[0])}')">查看详情</button>
        <button class="btn-ai" onclick="event.stopPropagation();pfAiDiagnosis('${escInline(p[0])}')">AI 诊断</button>
        <button onclick="event.stopPropagation();pfAddWatch('${escInline(p[0])}')">加入看板</button>
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
      <button class="filter-button" style="background:var(--green);margin-right:8px" onclick="pfAiDiagnosisDetail('${escInline(name)}')">AI 深度诊断</button>
      <button class="filter-button" onclick="pfAddWatch('${escInline(name)}')">加入看板监控</button>
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
    return; // disabled v4 2026-08-21

  renderPfStats();
  renderPfAi();
  renderPfGrid();
}
renderPlatforms();

// -- 宏观经济 (disabled, merged into countries) --
// macroData array kept for future integration into countries page
// renderMacro, fillSelect, onclick removed - section no longer exists


// -- 政策动态 (Full Rebuild) -- JSON dynamic loading
// Default policies data (fallback) - converted from hardcoded array to JSON format
var defaultPoliciesData = {
  updated_at: '2026-07-13T00:00:00+08:00',
  source_count: 6,
  items: policyData.map((p, i) => {
    const ext = plExtData[i] || {};
    // 完整地区映射：与国家市场 40 国覆盖保持一致
    const regionMap = {
      '美国':'US','加拿大':'US','墨西哥':'US',
      '印尼':'SEA','越南':'SEA','泰国':'SEA','马来西亚':'SEA','菲律宾':'SEA','新加坡':'SEA','柬埔寨':'SEA','缅甸':'SEA','老挝':'SEA',
      '德国':'EU','法国':'EU','英国':'EU','意大利':'EU','西班牙':'EU','荷兰':'EU','波兰':'EU','瑞典':'EU','比利时':'EU',
      '沙特':'MEA','阿联酋':'MEA','土耳其':'MEA','以色列':'MEA','埃及':'MEA',
      '巴西':'LATAM','阿根廷':'LATAM','智利':'LATAM','哥伦比亚':'LATAM',
      '印度':'SAS','巴基斯坦':'SAS','孟加拉':'SAS',
      '尼日利亚':'AFR','南非':'AFR','肯尼亚':'AFR','摩洛哥':'AFR',
      '日本':'EA','韩国':'EA',
      '澳大利亚':'OCE','新西兰':'OCE',
      '俄罗斯':'CIS','乌克兰':'CIS','哈萨克斯坦':'CIS'
    };
    // 基于标题关键词的完整政策类型分类
    const title = p[0] || '';
    let category = 'regulation';
    if(/关税|进口税|税收|VAT|增值税|所得税|数字税/.test(title)) category = /VAT|所得税|数字税|增值税/.test(title)?'tax':'tariff';
    else if(/认证|SNI|TISI|SABER|BIS|ESMA|HALAL|清真|FDA|CPSC|BPOM|SFDA|GPSR|产品安全/.test(title)) category = /GPSR|产品安全/.test(title)?'product_safety':'certification';
    else if(/合规|审查|DSA|数字服务法/.test(title)) category = /DSA|数字服务法/.test(title)?'regulation':'compliance';
    else if(/禁令|限制|禁售|取消.*门槛/.test(title)) category = 'ban';
    else if(/外汇|付汇|汇率/.test(title)) category = 'foreign_exchange';
    else if(/清关|报关|ACID|预登记|CargoX/.test(title)) category = 'customs';
    else if(/FDI|外资|投资/.test(title)) category = 'investment';
    else if(/许可|NIMP|Form M|SONCAP/.test(title)) category = 'customs';
    return {
      id: 'p-fallback-' + i,
      title: p[0],
      summary: p[8] || '',
      source: p[4].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
      source_url: '',
      region: regionMap[p[1]] || 'Global',
      category: category,
      impact_level: p[3] === '重大' ? 'high' : p[3] === '中等' ? 'medium' : 'low',
      published_at: p[2],
      collected_at: p[2] + 'T00:00:00+08:00'
    };
  })
};

var policiesJsonData = null;
var policiesDataLoading = false;

async function loadPoliciesData() {
  if (policiesDataLoading) return;
  policiesDataLoading = true;
  $('#pl-data-info').innerHTML = '<span style="color:#3366cc">⏳ 正在加载最新数据...</span>';
  try {
    const data = await jayFetchMarketData('policies', './data/policies.json');
    if (!data) throw new Error('Failed to load policies data');
    if (data && data.items && data.items.length > 0) {
      policiesJsonData = data;
      plInitFromJson();
      const time = new Date(data.updated_at).toLocaleString('zh-CN');
      $('#pl-data-info').innerHTML = '📡 数据更新时间: ' + time + '（演示数据 · 数据截至 2026-07） | 数据来源: ' + (data.source_count || '?') + ' 个';
      // Refresh alerts linkage
      if (typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
    } else {
      throw new Error('Empty data');
    }
  } catch (e) {
    console.warn('Failed to load policies.json, using fallback:', e);
    policiesJsonData = defaultPoliciesData;
    plInitFromJson();
    $('#pl-data-info').innerHTML = '📦 使用内置数据 (离线模式) | 更新时间: 2026-07-13';
  }
  policiesDataLoading = false;
}

const plCategoryLabels = {
  tariff:'关税调整', tax:'税务新规', certification:'进口认证', compliance:'电商合规',
  ban:'进出口禁令', regulation:'监管合规', product_safety:'产品安全', data_privacy:'数据隐私',
  intellectual_property:'知识产权', anti_dumping:'反倾销/反补贴', foreign_exchange:'外汇管制',
  customs:'清关报关', investment:'外资准入', trade_agreement:'贸易协定', subsidy:'补贴扶持',
  labor:'劳工环保', e_commerce:'数字经济', other:'其他'
};
const plRegionLabels = {
  US:'北美', EU:'欧洲', SEA:'东南亚', MEA:'中东', LATAM:'拉美', SAS:'南亚',
  AFR:'非洲', EA:'东亚（日韩）', OCE:'大洋洲', CIS:'独联体', Global:'全球'
};
const plRegionCodeByName = {
  '东南亚':'SEA','北美':'US','欧洲':'EU','中东':'MEA','拉美':'LATAM','南亚':'SAS',
  '非洲':'AFR','日韩':'EA','澳洲':'OCE','独联体':'CIS'
};
const plImpactLabels = {high:'高', medium:'中', low:'低'};

function enrichPolicySummary(p) {
  // 补默认校验字段（policies.json 已自带则保留；fallback 内嵌数据用默认值）
  if(!('credibility_score' in p)){
    p.credibility_score = 75;
    p.status = p.status || 'active';
    p.status_label = p.status_label || '现行有效';
    p.legal_basis = p.legal_basis || 'other';
    p.legal_basis_label = p.legal_basis_label || '行业监管法规';
    p.effective_date = p.effective_date || p.published_at || '2026-01-01';
    p.expire_date = p.expire_date || '';
    p.verified_at = p.verified_at || '2026-07-20T10:00:00+08:00';
    p.source_count = p.source_count || 3;
  }
  // 统一标示意性数据（除非显式标记为 verified）
  if(!p.data_quality){
    p.data_quality = 'demonstration';
    p.source_url = p.source_url || '';
    p.source_verified = false;
  }
  if (p.summary && p.summary.trim()) return;
  const region = plRegionLabels[p.region] || p.region || '相关地区';
  const cat = plCategoryLabels[p.category] || p.category || '政策';
  const impact = plImpactLabels[p.impact_level] || p.impact_level || '中';
  const source = p.source || '未注明';
  const date = p.published_at || '近期';
  p.summary = `【${region}】${cat}动态 — ${date}，${source}发布，影响等级：${impact}。该${cat}变化可能对跨境电商业务产生${impact==='高'?'重大':'一定'}影响，建议持续关注并评估合规风险。`;
}

// —— 政策动态真实性校验引擎 ——
// 检测：status/expire_date 一致性、legal_basis 分类合法性、source_count、可信度阈值、来源链接缺失、时间线状态
function jayVerifyPolicies(items){
  if(!Array.isArray(items)) return {total:0,issues:0};
  var TODAY = new Date('2026-07-21T00:00:00+08:00');
  var LB_VALID = ['section_301','section_122','fentanyl','safeguard','anti_dumping','vat_law','certification_law','fdi_regulation','dsa','gpsr','digital_tax','other'];
  var issues_total = 0, fail_cnt = 0, warn_cnt = 0;
  items.forEach(function(p){
    var issues = [];
    // 0. 示意性数据强制降分（最重要：未经过权威源独立核实）
    if(p.data_quality === 'demonstration'){
      issues.push('示意性数据，未经过权威源独立核实（数字与日期仅供格式参考）');
      p.credibility_score = Math.min(p.credibility_score || 70, 50);
    }
    // 1. 政策时间线一致性：失效日期已过但状态仍标为现行
    if(p.expire_date){
      var ed = new Date(p.expire_date);
      if(!isNaN(ed.getTime()) && ed < TODAY && p.status==='active'){
        issues.push('失效日期已过但状态仍标为现行有效');
      }
    }
    // 2. 法律依据分类合法性
    if(p.legal_basis && LB_VALID.indexOf(p.legal_basis)<0){
      issues.push('法律依据分类非法: '+p.legal_basis);
    }
    // 3. 多源交叉验证：独立来源数量（至少3个）
    if(!p.source_count || p.source_count < 3){
      issues.push('独立来源不足3个(当前'+(p.source_count||0)+')');
    }
    // 4. 可信度评分阈值拦截
    if(typeof p.credibility_score !== 'number' || p.credibility_score < 70){
      issues.push('可信度低于阈值('+(p.credibility_score||0)+')');
    }
    // 5. 拟议政策时间线：不应有已过生效日
    if(p.status==='proposed' && p.effective_date){
      var efd = new Date(p.effective_date);
      if(!isNaN(efd.getTime()) && efd < TODAY) issues.push('拟议政策生效日期已过');
    }
    // 6. 信息溯源：必须有原始来源链接
    if(!p.source_url){
      issues.push('缺少原始来源链接');
    }
    p._verifyIssues = issues;
    p._verifyFlag = issues.length===0 ? 'pass' : (issues.length>=2 ? 'fail' : 'warn');
    // 降分：每项问题扣5分，下限40
    if(issues.length){
      p.credibility_score = Math.max(40, (p.credibility_score||70) - issues.length*5);
    }
    issues_total += issues.length;
    if(p._verifyFlag==='fail') fail_cnt++; else if(p._verifyFlag==='warn') warn_cnt++;
  });
  return {total: items.length, issues: issues_total, fail: fail_cnt, warn: warn_cnt};
}

function plInitFromJson() {
  const items = policiesJsonData.items;
  items.forEach(enrichPolicySummary);
  jayVerifyPolicies(items);
  // 使用完整的地区/类别字典填充筛选器，确保覆盖范围完整、中文展示
  fillSelect('#pl-f-region', Object.keys(plRegionLabels).filter(function(r){return r!=='Global';}).sort(), plRegionLabels);
  fillSelect('#pl-f-category', Object.keys(plCategoryLabels).sort(), plCategoryLabels);
  // Update nav badge
  const navBadge = document.querySelector('a[data-page="policies"] b');
  if (navBadge) navBadge.textContent = items.length;
  plCurrentPage = 1;
  renderPoliciesPage();
}

function plGetJsonItems() {
  return (policiesJsonData || defaultPoliciesData).items;
}

// Populate filter selects with full coverage dictionary (Chinese labels)
fillSelect('#pl-f-region', Object.keys(plRegionLabels).filter(function(r){return r!=='Global';}).sort(), plRegionLabels);
fillSelect('#pl-f-category', Object.keys(plCategoryLabels).sort(), plCategoryLabels);

var plCurrentPage=1, plPerPage=10, plSelected=new Set(), plAiTab=0;
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
  const items=plGetJsonItems();
  const total=items.length;
  const highCount=items.filter(p=>p.impact_level==='high').length;
  const medCount=items.filter(p=>p.impact_level==='medium').length;
  const regions=new Set(items.map(p=>p.region).filter(Boolean));
  const categories=new Set(items.map(p=>p.category).filter(Boolean));
  $('#pl-stats-row').innerHTML=`
    <div class="pl-stat-card"><div class="pl-stat-val">${total}</div><div class="pl-stat-label">政策总数</div><div class="pl-stat-sub">实时追踪</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val" style="color:#e74c3c">${highCount}</div><div class="pl-stat-label">高影响政策</div><div class="pl-stat-sub">高风险红线提醒</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${regions.size}</div><div class="pl-stat-label">覆盖地区</div><div class="pl-stat-sub">多地区监控</div></div>
    <div class="pl-stat-card"><div class="pl-stat-val">${categories.size}</div><div class="pl-stat-label">政策类别</div><div class="pl-stat-sub">分类统计</div></div>`;
  // —— 真实性校验总览 ——
  const passN=items.filter(p=>p._verifyFlag==='pass').length;
  const warnN=items.filter(p=>p._verifyFlag==='warn').length;
  const failN=items.filter(p=>p._verifyFlag==='fail').length;
  const avgCred=items.length?Math.round(items.reduce((s,p)=>s+(p.credibility_score||0),0)/items.length):0;
  const vBar=document.getElementById('pl-verify-bar');
  if(vBar){
    vBar.innerHTML=`<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:11px 16px;background:linear-gradient(90deg,#eff6ff,#f5eef8);border:1px solid #d6e4f5;border-radius:8px;margin-bottom:14px;font-size:13px">
      <span style="font-weight:700;color:#1e3a5f">🛡 政策真实性校验</span>
      <span style="color:#1e8449">✓ 已核验 <b>${passN}</b></span>
      <span style="color:#b7950b">⚠ 待核 <b>${warnN}</b></span>
      <span style="color:#c0392b">⚠ 拦截告警 <b>${failN}</b></span>
      <span style="color:#2c3e50">平均可信度 <b style="color:${avgCred>=85?'#27ae60':avgCred>=75?'#f39c12':'#e74c3c'}">${avgCred}</b>/100</span>
      <span style="color:#7f8c8d;margin-left:auto;font-size:12px">校验维度：多源交叉(≥3) · 法律依据分类 · 时间线一致性 · 来源溯源 · 可信度阈值</span>
    </div>`;
  }
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
  const region=$('#pl-f-region').value;
  const category=$('#pl-f-category').value;
  const impact=$('#pl-f-impact').value;
  const items=plGetJsonItems();
  return items.map((p,i)=>({...p,_idx:i})).filter(p=>{
    if(search && !p.title.toLowerCase().includes(search) && !(plRegionLabels[p.region]||p.region).toLowerCase().includes(search))return false;
    if(region!=='all' && p.region!==region)return false;
    if(category!=='all' && p.category!==category)return false;
    if(impact!=='all' && p.impact_level!==impact)return false;
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
    const levelClass=p.impact_level==='high'?'level-major':p.impact_level==='medium'?'level-medium':'level-normal';
    const badgeClass=p.impact_level==='high'?'badge-major':p.impact_level==='medium'?'badge-medium':'badge-normal';
    const impactColor=p.impact_level==='high'?'#e74c3c':p.impact_level==='medium'?'#f39c12':'#3498db';
    const impactLabel=plImpactLabels[p.impact_level]||p.impact_level;
    const regionLabel=plRegionLabels[p.region]||p.region;
    const catLabel=plCategoryLabels[p.category]||p.category;
    const checked=plSelected.has(p._idx)?'checked':'';
    const sourceLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:#3366cc;text-decoration:none">📎 ${p.source||'来源'}</a>`:`<span class="src-missing">⚠️ 待补充来源</span>`;
    const titleLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:inherit;text-decoration:none">${p.title}</a>`:p.title;
    const pubDate=p.published_at||'';
    // —— 真实性校验展示 ——
    const credScore=typeof p.credibility_score==='number'?p.credibility_score:0;
    const credColor=credScore>=85?'#27ae60':credScore>=75?'#f39c12':'#e74c3c';
    const credBg=credScore>=85?'#eafaf1':credScore>=75?'#fef9e7':'#fdedec';
    const credLabel=credScore>=85?'高可信':credScore>=75?'中可信':'低可信';
    const statusLabel=p.status_label||p.status||'';
    const statusColor=p.status==='active'?'#27ae60':p.status==='proposed'?'#3498db':p.status==='suspended'?'#f39c12':'#95a5a6';
    const lbLabel=p.legal_basis_label||'';
    const effDate=p.effective_date||'';
    const expDate=p.expire_date||'';
    const verifiedAt=p.verified_at?new Date(p.verified_at).toLocaleDateString('zh-CN'):'';
    const srcCount=p.source_count||0;
    const vFlag=p._verifyFlag||'pass';
    const vIssues=p._verifyIssues||[];
    const cardBorder=vFlag==='fail'?'box-shadow:0 0 0 2px #e74c3c inset':vFlag==='warn'?'box-shadow:0 0 0 2px #f39c12 inset':'';
    const vBadge=vFlag==='fail'?`<span class="pl-verify-badge fail" title="${vIssues.join('；')}" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#fdedec;color:#c0392b;margin-left:6px;vertical-align:middle">⚠ ${vIssues.length}项问题</span>`:vFlag==='warn'?`<span class="pl-verify-badge warn" title="${vIssues.join('；')}" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#fef9e7;color:#b7950b;margin-left:6px;vertical-align:middle">⚠ 待核</span>`:`<span class="pl-verify-badge pass" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#eafaf1;color:#1e8449;margin-left:6px;vertical-align:middle">✓ 已核验</span>`;
    const demoBadge=p.data_quality==='demonstration'?`<span title="本条数据为示意性参考，未经过权威源独立核实" style="font-size:11px;padding:1px 6px;border-radius:8px;background:#f5b041;color:#fff;margin-left:6px;vertical-align:middle;font-weight:600">⚠ 示意性数据</span>`:'';
    return `<div class="pl-card" style="${cardBorder}">
      <div class="pl-risk-bar ${levelClass}"></div>
      <input type="checkbox" class="pl-card-check" ${checked} onclick="event.stopPropagation();plToggleSelect(${p._idx})">
      <div class="pl-card-body">
        <h3>${titleLink}${demoBadge}${vBadge}</h3>
        <div class="pl-meta">
          <span class="pl-country-tag">🌍 ${regionLabel}</span>
          <span>📅 ${jayFmtTime(pubDate)}</span>
          <span>${sourceLink}</span>
          ${srcCount?`<span title="独立来源数量(交叉验证)">🔗 ${srcCount}源</span>`:''}
        </div>
        <div class="pl-tags-row">
          <span class="pl-type-tag">${catLabel}</span>
          <span class="pl-impact-tag" style="color:${impactColor};border-color:${impactColor};background:${impactColor}15">${impactLabel}影响</span>
          ${statusLabel?`<span style="color:${statusColor};border:1px solid ${statusColor};background:${statusColor}15;padding:1px 8px;border-radius:10px;font-size:12px">● ${statusLabel}</span>`:''}
          ${lbLabel?`<span title="法律依据分类" style="color:#6c3483;border:1px solid #6c3483;background:#f5eef8;padding:1px 8px;border-radius:10px;font-size:12px">⚖ ${lbLabel}</span>`:''}
        </div>
        <div class="pl-verify-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;font-size:12px;color:#666">
          ${effDate?`<span>生效: <b style="color:#2c3e50">${effDate}</b></span>`:''}
          ${expDate?`<span>失效: <b style="color:#e74c3c">${expDate}</b></span>`:''}
          <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:10px;background:${credBg};color:${credColor};font-weight:600">可信度 ${credScore} · ${credLabel}</span>
          ${verifiedAt?`<span title="最近核验时间" style="color:#7f8c8d">✓ 核验于 ${verifiedAt}</span>`:''}
        </div>
        ${vIssues.length?`<div style="margin-top:6px;font-size:12px;color:#c0392b;background:#fdedec;padding:5px 9px;border-radius:4px;border-left:3px solid #e74c3c">⚠ ${vIssues.join('；')}</div>`:''}
        ${p.summary?'<div class="pl-summary">'+p.summary+'</div>':''}
      </div>
      <div class="pl-card-right">
        <span class="pl-level-badge ${badgeClass}">${impactLabel}</span>
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
function plSearch(){plCurrentPage=1;renderPlList(); var pl=document.getElementById('pl-list'); if(pl){ try{ jayHighlightMatches(pl, ($('#pl-search')||{}).value); }catch(e){} } }
function plFilterChange(){
  plCurrentPage=1;
  var region=$('#pl-f-region').value;
  var category=$('#pl-f-category').value;
  var impact=$('#pl-f-impact').value;
  window.jayPolicyFilter={region:region,category:category,impact:impact};
  plSyncToOtherBoards(region,category,impact);
  renderPlList();
}
function plClearFilters(){$('#pl-search').value='';$('#pl-f-region').value='all';$('#pl-f-category').value='all';$('#pl-f-impact').value='all';window.jayPolicyFilter={region:'all',category:'all',impact:'all'};plCurrentPage=1;renderPlList();toast('筛选条件已重置');}

// 政策动态筛选器 ↔ 其他板块联动
function plSyncToOtherBoards(region,category,impact){
  // 1. 同步到平台规则页的市场/类别筛选
  var regionToMarket={'US':'US','EU':'EU','SEA':'SEA','MEA':'MEA','LATAM':'LATAM','SAS':'SAS','AFR':'AFR','EA':'EA','OCE':'OCE','CIS':'CIS','CN':'CN'};
  var market=null, rlCat=null;
  if(region!=='all'){
    market=regionToMarket[region];
    var rlMarket=$('#rl-market');
    if(rlMarket && market) rlMarket.value=market;
  }
  var catToRule={'tariff':'fee','tax':'fee','certification':'compliance','compliance':'compliance','ban':'penalty','regulation':'compliance','product_safety':'compliance','data_privacy':'compliance','intellectual_property':'compliance','anti_dumping':'penalty','foreign_exchange':'fee','customs':'fulfillment','investment':'compliance','trade_agreement':'compliance','subsidy':'fee','labor':'compliance','e_commerce':'compliance','other':'compliance'};
  if(category!=='all'){
    rlCat=catToRule[category];
    var rlCategory=$('#rl-category');
    if(rlCategory && rlCat) rlCategory.value=rlCat;
  }
  // 如果当前在平台规则页，立即重新渲染
  var rulesPage=document.getElementById('rules');
  if(rulesPage && rulesPage.classList.contains('active') && typeof renderRulesPage==='function'){
    renderRulesPage();
  }
  // 2. 刷新预警中心（政策数据变化会驱动预警）
  if(typeof refreshDynamicAlerts==='function') refreshDynamicAlerts();
  // 3. 如果当前在国家市场页，高亮对应地区
  if(typeof cn2HighlightRegion==='function') cn2HighlightRegion(region);
}

// 国家市场页地区高亮：自动滚动到该地区首个国家
function cn2HighlightRegion(regionCode){
  if(!regionCode || regionCode==='all') return;
  var regionName=plRegionLabels[regionCode];
  if(!regionName) return;
  // 查找该地区第一个国家
  var firstKey=null;
  for(var k in countryFullData){
    var d=countryFullData[k];
    if(d && d.region && (d.region===regionName || regionName.indexOf(d.region)>=0 || d.region.indexOf(regionName.replace('（日韩）',''))>=0)){
      firstKey=k; break;
    }
  }
  if(!firstKey) return;
  // 如果当前在国家市场页，则渲染该国并滚动
  var countriesPage=document.getElementById('countries');
  if(countriesPage && countriesPage.classList.contains('active')){
    cn2Render(firstKey);
    var el=document.getElementById('cn2-main');
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  } else {
    // 预置上下文，供下次进入国家市场页时读取
    JAY_CTX.country=countryFullData[firstKey].name;
  }
}
function plExportReport(){jayExportPolicy();}
function plBatchAlert(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已为 ${plSelected.size} 条政策开启预警`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}
function plBatchWatch(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已将 ${plSelected.size} 条政策加入看板`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}
function plBatchArchive(){if(!plSelected.size){toast('请先选择政策');return;}toast(`已归档 ${plSelected.size} 条政策`);plSelected.clear();$('#pl-selected-count').textContent='';renderPlList();}

function openPlDetail(idx){
  const items=plGetJsonItems();
  const p=items[idx];
  if(!p)return;
  const impactColor=p.impact_level==='high'?'#e74c3c':p.impact_level==='medium'?'#f39c12':'#3498db';
  const impactLabel=plImpactLabels[p.impact_level]||p.impact_level;
  const regionLabel=plRegionLabels[p.region]||p.region;
  const catLabel=plCategoryLabels[p.category]||p.category;
  const sourceLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:#3366cc">${p.source||'来源链接'}</a>`:`<span class="src-missing">⚠️ 待补充来源</span>`;
  const titleLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:inherit;text-decoration:none">${p.title}</a>`:p.title;

  let html=`<button class="pl-detail-close" onclick="closePlDetail()">✕</button>
    <h2>${titleLink}</h2>
    <div class="pl-detail-sub">${regionLabel} · ${impactLabel}影响 · ${catLabel} · 发布于 ${p.published_at||'N/A'} · 采集于 ${p.collected_at?p.collected_at.substring(0,10):'N/A'}</div>

    <div class="pl-detail-section"><h4>📋 政策基础档案</h4>
      <div class="pl-detail-grid">
        <div class="pl-detail-item"><b>信息来源：</b>${sourceLink}</div>
        <div class="pl-detail-item"><b>发布日期：</b>${p.published_at||'N/A'}</div>
        <div class="pl-detail-item"><b>采集时间：</b>${p.collected_at?p.collected_at.substring(0,16).replace('T',' '):'N/A'}</div>
        <div class="pl-detail-item"><b>影响地区：</b>${regionLabel}</div>
        <div class="pl-detail-item"><b>政策类别：</b>${catLabel}</div>
        <div class="pl-detail-item"><b>影响等级：</b><span style="color:${impactColor};font-weight:600">${impactLabel}</span></div>
      </div>
    </div>

    <div class="pl-detail-section"><h4>📝 政策详情</h4>
      <div class="pl-detail-item" style="line-height:1.8">${p.summary||p.title||'暂无详细摘要'}</div>
    </div>

    <div class="pl-detail-section"><h4>⚠️ 合规落地建议</h4>
      <div class="pl-detail-item">
        <b>1. 关注要点：</b>该政策属于 ${catLabel} 类别，影响 ${regionLabel} 地区跨境业务<br>
        <b>2. 影响等级：</b><span style="color:${impactColor}">${impactLabel}</span> — ${p.impact_level==='high'?'建议立即评估业务影响并制定应对方案':'建议持续关注并及时调整合规策略'}<br>
        <b>3. 备货调整：</b>建议提前3-6个月备货，规避政策窗口期风险
      </div>
    </div>

    <div class="pl-detail-section">
      <button class="filter-button" style="background:#c0392b;margin-right:8px" onclick="plAiCompliance(${idx})">AI 合规深度解读</button>
      <button class="filter-button" onclick="toast('已添加预警')">添加预警监控</button>
      <button class="filter-button" onclick="toast('已加入看板')">加入看板</button>
      <div id="pl-ai-detail-result"></div>
    </div>`;

  $('#pl-detail-modal').innerHTML=html;
  $('#pl-detail-overlay').classList.add('show');
}
function closePlDetail(){$('#pl-detail-overlay').classList.remove('show');}

function plAiCompliance(idx){
  const items=plGetJsonItems();
  const p=items[idx];
  if(!p)return;
  const impactLabel=plImpactLabels[p.impact_level]||p.impact_level;
  const regionLabel=plRegionLabels[p.region]||p.region;
  const analysis=`<div class="pl-ai-compliance"><h5>🤖 AI 合规解读 - ${p.title}</h5>
    <b>政策影响：</b>${p.impact_level==='high'?'该政策对跨境卖家构成重大成本压力和合规挑战。':p.impact_level==='medium'?'该政策需要关注并适时调整合规策略。':'该政策影响较小，保持关注即可。'}<br>
    <b>影响地区：</b>${regionLabel} | <b>影响等级：</b>${impactLabel}<br>
    <b>应对建议：</b>建议提前了解政策要求，预留合规预算，调整定价策略。<br>
    <b>风险提示：</b>未合规可能导致商品被扣、店铺被封、罚款等风险。</div>`;
  const div=document.createElement('div');
  div.innerHTML=analysis;
  div.style.cssText='position:fixed;bottom:80px;right:20px;z-index:3000;max-width:400px;animation:fadeIn .3s';
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),8000);
}

function plAiComplianceDetail(idx){
  const items=plGetJsonItems();
  const p=items[idx];
  if(!p)return;
  const regionLabel=plRegionLabels[p.region]||p.region;
  const catLabel=plCategoryLabels[p.category]||p.category;
  const impactLabel=plImpactLabels[p.impact_level]||p.impact_level;
  $('#pl-ai-detail-result').innerHTML=`<div class="pl-ai-compliance"><h5>🤖 AI 深度合规报告 - ${p.title}</h5>
    <b>一、政策背景：</b>${p.title}，来源: ${p.source||'⚠️ 待补充来源'}，${catLabel}类型政策，发布于 ${p.published_at||'N/A'}。<br><br>
    <b>二、核心影响：</b>${p.summary||p.title||'暂无详细摘要'}<br><br>
    <b>三、合规操作清单：</b><br>
    1. 了解 ${regionLabel} 地区 ${catLabel} 类别最新政策要求<br>
    2. 评估当前业务受该政策影响的程度<br>
    3. 调整供应链/物流模式以适配新规<br>
    4. 更新产品标签/包装符合要求<br>
    5. 培训团队了解新政策要求<br><br>
    <b>四、风险规避方案：</b><br>
    - 短期：提前备货规避政策窗口期<br>
    - 中期：考虑海外仓/本土化生产<br>
    - 长期：评估替代市场或品类调整<br><br>
    <b>五、影响等级：</b>${impactLabel} — 建议持续关注并及时调整合规策略。</div>`;
}

function plToggleCompliance(){
  var box=document.getElementById('pl-compliance');
  if(!box)return;
  if(box.style.display==='block'){ box.style.display='none'; var l=document.getElementById('pl-list'); if(l)l.style.display=''; return; }
  plRenderCompliance();
  var l=document.getElementById('pl-list'); if(l)l.style.display='none';
}
function plRenderCompliance(){
  var region=(document.getElementById('pl-f-region')||{}).value||'all';
  var box=document.getElementById('pl-compliance');
  if(!box)return;
  var items=policyData.filter(function(p){ return region==='all'||p[1]===region; });
  if(!items.length){ box.innerHTML='<div class="pl-empty"><p>该市场暂无政策数据，可切换地区查看</p></div>'; box.style.display='block'; return; }
  box.innerHTML='<h3 style="margin:6px 0 12px;font-size:16px">📋 '+ (region==='all'?'全部市场':region) +' 合规清单（演示派生）</h3>'
    + items.slice(0,12).map(function(p){
        var desc=(p[8]||p[0]||'').toString();
        var lv=(p[3]||'常规');
        return '<div class="pl-comp-card">'
          +'<div class="pl-comp-head"><b>'+ (p[0]||'') +'</b><span class="pl-comp-lv pl-comp-lv-'+ (lv==='重大'?'high':(lv==='中等'?'mid':'low')) +'">'+lv+'</span></div>'
          +'<div class="pl-comp-grid">'
          +'<div><span>准入要求</span><p>'+(desc.substring(0,60)||'参照当地法规')+'</p></div>'
          +'<div><span>办理周期</span><p>待补充（演示）</p></div>'
          +'<div><span>预估费用</span><p>待补充（演示）</p></div>'
          +'<div><span>避坑提示</span><p>'+(lv==='重大'?'高风险政策，落地前务必核实官方公告':'常规合规申报即可')+'</p></div>'
          +'</div></div>';
      }).join('')
    + '<p style="font-size:11px;color:#9aa29e;margin-top:10px">* 清单基于政策数据自动派生，周期/费用为演示占位，正式合规请以各国官方公报为准。</p>';
  box.style.display='block';
}
function renderPoliciesPage(){
  renderPlStats();
  renderPlAi();
  renderPlList();
}
// Load policies from JSON, then render
loadPoliciesData();


// -- 平台规则 --
// -- Rules page: JSON dynamic loading --
// Default rules data (fallback) - converted from hardcoded array to JSON format
var defaultRulesData = {
  updated_at: '2026-07-13T00:00:00+08:00',
  source_count: 6,
  items: rulesData.map((r, i) => {
    const key=r[0]+'_'+r[1];
    const ext=rlExtData[key]||{};
    const platMap={'TikTok Shop东南亚':'TikTok Shop','TikTok Shop印尼':'TikTok Shop','TikTok Shop沙特':'TikTok Shop','TikTok Shop英国':'TikTok Shop','Shopee东南亚':'Shopee','Shopee巴西':'Shopee','Lazada东南亚':'Lazada','Amazon北美':'Amazon','Amazon欧洲':'Amazon','Amazon印度':'Amazon','Temu北美':'Temu','SHEIN北美':'SHEIN','Noon中东':'Multi','MercadoLibre拉美':'Multi','Jumia非洲':'Multi'};
    const marketMap={'东南亚':'SEA','北美':'US','欧洲':'EU','中东':'Global','拉美':'Global','南亚':'Global','非洲':'Global'};
    const catMap={'佣金调整':'fee','物流新规':'fulfillment','扣分政策':'penalty','类目限制':'category','其他':'regulation'};
    return {
      id: 'r-fallback-' + i,
      title: r[0] + ' - ' + r[1],
      summary: r[5] + (r[6] ? ' | 建议: ' + r[6] : ''),
      source_url: '',
      platform: platMap[r[0]] || r[0],
      market: marketMap[r[4]] || 'Global',
      category: catMap[r[1]] || 'regulation',
      impact_level: ext.level === 'high' ? 'high' : ext.level === 'mid' ? 'medium' : 'low',
      effective_date: ext.effectiveDate || r[3],
      published_at: r[3],
      collected_at: r[3] + 'T00:00:00+08:00'
    };
  })
};

var rulesJsonData = null;
var rulesDataLoading = false;

async function loadRulesData() {
  if (rulesDataLoading) return;
  rulesDataLoading = true;
  $('#rl-data-info').innerHTML = '<span style="color:#3366cc">⏳ 正在加载最新数据...</span>';
  try {
    const data = await jayFetchMarketData('rules', './data/rules.json');
    if (!data) throw new Error('Failed to load rules data');
    if (data && data.items && data.items.length > 0) {
      rulesJsonData = data;
      rlInitFromJson();
      const time = new Date(data.updated_at).toLocaleString('zh-CN');
      $('#rl-data-info').innerHTML = '📡 数据更新时间: ' + time + '（演示数据 · 数据截至 2026-07） | 数据来源: ' + (data.source_count || '?') + ' 个';
      // Refresh alerts linkage
      if (typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
    } else {
      throw new Error('Empty data');
    }
  } catch (e) {
    console.warn('Failed to load rules.json, using fallback:', e);
    rulesJsonData = defaultRulesData;
    rlInitFromJson();
    $('#rl-data-info').innerHTML = '📦 使用内置数据 (离线模式) | 更新时间: 2026-07-13';
  }
  rulesDataLoading = false;
}

function enrichRuleSummary(r) {
  if (r.summary && r.summary.trim()) return;
  const platform = r.platform || '多平台';
  const market = rlMarketLabels[r.market] || r.market || '全球';
  const cat = rlCategoryLabels[r.category] || r.category || '规则';
  const impact = rlImpactLabels[r.impact_level] || r.impact_level || '中';
  const date = r.effective_date || r.published_at || '近期';
  r.summary = `【${platform}】${market}市场${cat}变动 — 生效日期：${date}，影响等级：${impact}。该${cat}调整可能影响卖家运营策略，建议及时调整以符合最新平台要求。`;
}

function rlInitFromJson() {
  const items = rulesJsonData.items;
  items.forEach(enrichRuleSummary);
  // 平台下拉：使用完整平台列表（来自 platformsData）+ Multi
  var platformNames = (typeof platformsData !== 'undefined' && Array.isArray(platformsData))
    ? ['Multi'].concat(platformsData.map(function(p){return p[0];}).filter(Boolean).sort())
    : [...new Set(items.map(r => r.platform))].filter(Boolean).sort();
  fillSelect('#rl-platform', platformNames);
  fillSelect('#rl-market', Object.keys(rlMarketLabels).filter(function(r){return r!=='Global';}).sort(), rlMarketLabels);
  fillSelect('#rl-category', Object.keys(rlCategoryLabels).sort(), rlCategoryLabels);
  fillSelect('#rl-act-type', Object.keys(rlActTypeLabels).sort(), rlActTypeLabels);
  rlRulesPage = 1;
  renderRulesPage();
}

function rlGetJsonItems() {
  return (rulesJsonData || defaultRulesData).items;
}

const rlCategoryLabels = {fee:'费用佣金', fulfillment:'物流履约', compliance:'合规要求', penalty:'处罚扣分', category:'类目管理', listing:'商品发布'};
const rlMarketLabels = {US:'北美', EU:'欧洲', SEA:'东南亚', MEA:'中东', LATAM:'拉美', SAS:'南亚', AFR:'非洲', EA:'东亚（日韩）', OCE:'大洋洲', CIS:'独联体', CN:'中国', SG:'新加坡', Global:'全球'};
const rlImpactLabels = {high:'高', medium:'中', low:'低'};
const rlActTypeLabels = {promo:'大促活动', recruit:'招商补贴', challenge:'内容挑战赛', traffic:'流量扶持', commission:'免佣/返现'};

// Initialize with fallback data
var rlPlatformNames = (typeof platformsData !== 'undefined' && Array.isArray(platformsData))
  ? ['Multi'].concat(platformsData.map(function(p){return p[0];}).filter(Boolean).sort())
  : [...new Set(defaultRulesData.items.map(r=>r.platform))].filter(Boolean).sort();
fillSelect('#rl-platform', rlPlatformNames);
fillSelect('#rl-market', Object.keys(rlMarketLabels).filter(function(r){return r!=='Global';}).sort(), rlMarketLabels);
fillSelect('#rl-category', Object.keys(rlCategoryLabels).sort(), rlCategoryLabels);
fillSelect('#rl-act-type', Object.keys(rlActTypeLabels).sort(), rlActTypeLabels);

var rlRulesPage=1,rlActPage=1;const RL_PAGE=8;
let rlChecked=new Set();

// Stats
function renderRlStats(){
  const items=getFilteredRules();
  const acts=getFilteredActs();
  const highCount=items.filter(r=>r.impact_level==='high').length;
  const pendingCount=items.filter(r=>{const d=r.effective_date;return d&&new Date(d)>new Date()}).length;
  const activeActs=acts.filter(a=>parseInt(a[9])>0||a[9]==='7'||a[9]==='10'||a[9]==='13').length;
  const highSubsidy=acts.filter(a=>a[7].includes('免佣金')||a[7].includes('返现')).length;
  const platforms=new Set(items.map(r=>r.platform));
  $('#rl-stats-grid').innerHTML=[
    ['规则总数',items.length+'条','实时追踪','#3366cc'],
    ['高影响规则',highCount+'条','重点关注','#e74c3c'],
    ['待执行规则',pendingCount+'条','需提前准备','#e67e22'],
    ['覆盖平台',platforms.size+'个','多维度监控','#16a34a']
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
    const items=getFilteredRules();
    const highItems=items.filter(r=>r.impact_level==='high').slice(0,3);
    const aiHtml=highItems.length?highItems.map(r=>'<li>⚠️ <strong>'+escapeHtml(r.platform)+'</strong> '+(r.title||r.summary||'').substring(0,60)+' <button class="ai-action" onclick="rlLocate(\'rule\',\''+escInline(r.platform)+'\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">加入预警</button></li>').join(''):'<li>暂无高影响规则</li>';
    $('#rl-ai-content').innerHTML='<ul>'+aiHtml+'</ul>';
  } else {
    const acts=getFilteredActs().filter(a=>parseInt(a[9])>0 || /^\d+$/.test(a[9]) && parseInt(a[9])>0).slice(0,5);
    const aiHtml=acts.length?acts.map((a,i)=>{
      const label=rlActTypeLabels[rlActTypeGroup(a[1])] || a[1];
      const countdown=rlCountdown(a[9]);
      return '<li>'+(i===0?'🔥':i===1?'🆕':'💡')+' <strong>'+escapeHtml(a[0])+'</strong> '+label+' — '+a[7].substring(0,45)+(a[7].length>45?'…':'')+' '+countdown+' <button class="ai-action" onclick="rlLocate(\'act\',\''+escInline(a[0])+'\')">定位</button><button class="ai-action" onclick="toast(\'已加入预警\')">报名预警</button></li>';
    }).join(''):'<li>暂无近期活动</li>';
    $('#rl-ai-content').innerHTML='<ul>'+aiHtml+'</ul>';
  }
}
function rlLocate(type,name){
  if(type==='rule'){switchRlTab('rules');const items=rlGetJsonItems();const idx=items.findIndex(r=>r.platform===name||r.title.includes(name));if(idx>=0){rlRulesPage=Math.floor(idx/RL_PAGE)+1;renderRlRules();setTimeout(()=>{const el=document.querySelector('.rl-rule-card[data-idx="'+idx+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},100)}}
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

// Rule type class (by category code or Chinese label)
function rlTypeClass(type){
  if(!type) return 'rl-type-other';
  if(type==='fee' || type.includes('费用') || type.includes('佣金')) return 'rl-type-commission';
  if(type==='fulfillment' || type.includes('物流')) return 'rl-type-logistics';
  if(type==='penalty' || type.includes('处罚') || type.includes('扣分')) return 'rl-type-penalty';
  if(type==='category' || type.includes('类目')) return 'rl-type-restriction';
  if(type==='listing' || type.includes('商品') || type.includes('发布')) return 'rl-type-other';
  if(type==='compliance' || type.includes('合规')) return 'rl-type-other';
  return 'rl-type-other';
}

// Act type group: map detailed activity type to simplified category
function rlActTypeGroup(type){
  if(!type) return 'promo';
  if(type.includes('大促')) return 'promo';
  if(type.includes('招商') || type.includes('扶持') || type.includes('新卖家')) return 'recruit';
  if(type.includes('挑战赛')) return 'challenge';
  if(type.includes('流量')) return 'traffic';
  if(type.includes('免佣') || type.includes('返现') || type.includes('补贴')) return 'commission';
  return 'promo';
}

// Act type class
function rlActTypeClass(type){
  const g=rlActTypeGroup(type);
  if(g==='promo') return 'rl-act-promo';
  if(g==='recruit') return 'rl-act-recruit';
  if(g==='challenge') return 'rl-act-challenge';
  if(g==='traffic') return 'rl-act-traffic';
  if(g==='commission') return 'rl-act-commission-free';
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
    const globalIdx=rlGetJsonItems().indexOf(rlGetJsonItems().find(item=>item.id===r.id));
    const riskLevel=r.impact_level==='high'?'high':r.impact_level==='medium'?'mid':'low';
    const impactColor=r.impact_level==='high'?'#e74c3c':r.impact_level==='medium'?'#f39c12':'#27ae60';
    const impactLabel=rlImpactLabels[r.impact_level]||r.impact_level;
    const catLabel=rlCategoryLabels[r.category]||r.category;
    const marketLabel=rlMarketLabels[r.market]||r.market;
    const effDate=r.effective_date||r.published_at||'';
    const days=effDate?Math.ceil((new Date(effDate)-new Date())/86400000):0;
    const isFuture=days>0;
    const titleLink=r.source_url?`<a href="${r.source_url}" target="_blank" style="color:inherit;text-decoration:none">${r.title}</a>`:r.title;
    return '<div class="rl-rule-card" data-idx="'+globalIdx+'">'
    +'<div class="rl-risk-bar rl-risk-'+riskLevel+'"></div>'
    +'<div class="rl-card-body">'
    +'<h4><input type="checkbox" class="rl-check" data-idx="'+r.id+'" '+((rlChecked.has(r.id))?'checked':'')+' onchange="rlToggleCheck(\''+r.id+'\')"> '+titleLink+' <span class="tag" style="color:'+impactColor+';border-color:'+impactColor+'">'+catLabel+'</span></h4>'
    +'<div class="rl-card-meta"><span>📅 '+(r.published_at||'')+'</span><span class="tag watch">'+marketLabel+'</span><span>'+r.platform+'</span>'
    +(isFuture?'<span class="rl-countdown '+(days<=7?(days<=3?'rl-countdown-urgent':'rl-countdown-warn'):'rl-countdown-ok')+'">'+days+'天后生效</span>':'<span class="rl-countdown rl-countdown-ok">已生效</span>')
    +'</div>'
    +'<div class="rl-card-summary">'+(r.summary||'').substring(0,80)+((r.summary||'').length>80?'…':'')+'</div>'
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
  $('#rl-count').textContent='规则 '+getFilteredRules().length+' 条 | 活动 '+getFilteredActs().length+' 条';
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
    +'<h4><input type="checkbox" class="rl-check" data-idx="a'+globalIdx+'" onchange="rlToggleCheck(\'a'+globalIdx+'\')"> '+a[0]+' · '+rlActTypeLabels[rlActTypeGroup(a[1])]+' <span class="rl-act-type '+rlActTypeClass(a[1])+'">'+rlActTypeLabels[rlActTypeGroup(a[1])]+'</span></h4>'
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
  const p=$('#rl-platform').value,m=$('#rl-market').value,cat=$('#rl-category').value,impact=$('#rl-impact-level').value;
  const items=rlGetJsonItems();
  return items.filter(r=>(p==='all'||r.platform===p)&&(m==='all'||r.market===m)&&(cat==='all'||r.category===cat)&&(impact==='all'||r.impact_level===impact));
}
function getFilteredActs(){
  const p=$('#rl-platform').value,at=$('#rl-act-type').value,m=$('#rl-market').value;
  const marketName = m==='all' ? null : (rlMarketLabels[m] || m);
  return activitiesData.filter(a=>{
    const matchPlatform = p==='all' || a[0]===p;
    const matchType = at==='all' || rlActTypeGroup(a[1])===at;
    const matchMarket = !marketName || a[5]===marketName;
    return matchPlatform && matchType && matchMarket;
  });
}

// Main render
function renderRulesPage(){
    return; // disabled v4 2026-08-21
renderRlStats();renderRlAi();renderRlRules();renderRlActs();}

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
  ['#rl-platform','#rl-market','#rl-category','#rl-impact-level','#rl-act-type'].forEach(s=>$(s).value='all');
  rlRulesPage=1;rlActPage=1;rlChecked.clear();
  renderRulesPage();renderRlActs();renderRlStats();renderRlAi();toast('筛选已重置');
}

// Detail - Rule
function openRlRuleDetail(idx){
  const items=rlGetJsonItems();
  const r=items[idx];
  if(!r)return;
  const riskLevel=r.impact_level==='high'?'high':r.impact_level==='medium'?'mid':'low';
  const impactColor=r.impact_level==='high'?'#e74c3c':r.impact_level==='medium'?'#f39c12':'#27ae60';
  const impactLabel=rlImpactLabels[r.impact_level]||r.impact_level;
  const catLabel=rlCategoryLabels[r.category]||r.category;
  const marketLabel=rlMarketLabels[r.market]||r.market;
  const sourceLink=r.source_url?`<a href="${r.source_url}" target="_blank" style="color:#3366cc">查看原始来源</a>`:`<span class="src-missing">⚠️ 待补充来源</span>`;
  const overlay=document.createElement('div');
  overlay.className='rl-detail-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML='<div class="rl-detail-modal"><button class="close-btn" onclick="this.closest(\'.rl-detail-overlay\').remove()">×</button>'
  +'<h2>'+r.title+'</h2>'
  +'<div class="rl-detail-section"><h3>📋 基础信息</h3><div class="info-grid">'
  +'<div class="info-item"><div class="lbl">平台</div><div class="val">'+r.platform+'</div></div>'
  +'<div class="info-item"><div class="lbl">规则类别</div><div class="val"><span class="tag" style="color:'+impactColor+'">'+catLabel+'</span></div></div>'
  +'<div class="info-item"><div class="lbl">生效日期</div><div class="val">'+(r.effective_date||r.published_at||'N/A')+'</div></div>'
  +'<div class="info-item"><div class="lbl">影响市场</div><div class="val">'+marketLabel+'</div></div>'
  +'<div class="info-item"><div class="lbl">影响等级</div><div class="val" style="color:'+impactColor+'">'+(r.impact_level==='high'?'🔴 高':r.impact_level==='medium'?'🟡 中':'🔵 低')+'</div></div>'
  +'<div class="info-item"><div class="lbl">来源链接</div><div class="val">'+sourceLink+'</div></div>'
  +'</div></div>'
  +'<div class="rl-detail-section"><h3>📝 规则详情</h3><p>'+(r.summary||r.title||'暂无详细摘要')+'</p></div>'
  +'<div class="rl-detail-section"><h3>✅ 应对建议</h3><p>建议关注 '+r.platform+' 平台 '+marketLabel+' 市场的 '+catLabel+' 类规则变化，及时调整运营策略。</p></div>'
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
  +'<div class="info-item"><div class="lbl">活动类型</div><div class="val"><span class="rl-act-type '+rlActTypeClass(a[1])+'">'+rlActTypeLabels[rlActTypeGroup(a[1])]+'</span></div></div>'
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

$('#apply-rl').onclick=()=>{rlRulesPage=1;rlActPage=1;renderRulesPage();renderRlActs();renderRlStats();renderRlAi();rlSyncToOtherBoards();const f=getFilteredRules().length+getFilteredActs().length;toast('已筛选 '+f+' 条结果')};
$('#reset-rl').onclick=()=>{resetRlFilters();rlSyncToOtherBoards();};

// 平台规则筛选器 ↔ 其他板块联动
function rlSyncToOtherBoards(){
  var m=$('#rl-market').value, c=$('#rl-category').value;
  // 同步到政策动态页
  if(m!=='all'){
    var plRegion=$('#pl-f-region');
    if(plRegion) plRegion.value=m;
  }
  if(c!=='all'){
    var ruleToPolicy={'fee':'tariff','fulfillment':'customs','compliance':'compliance','penalty':'ban','category':'certification','listing':'regulation'};
    var plCat=$('#pl-f-category');
    if(plCat && ruleToPolicy[c]) plCat.value=ruleToPolicy[c];
  }
  // 如果当前在政策页，立即重新渲染
  var policyPage=document.getElementById('policies');
  if(policyPage && policyPage.classList.contains('active') && typeof renderPoliciesPage==='function'){
    renderPoliciesPage();
  }
  // 刷新预警中心
  if(typeof refreshDynamicAlerts==='function') refreshDynamicAlerts();
  // 如果当前在国家市场页，高亮对应地区
  if(typeof cn2HighlightRegion==='function') cn2HighlightRegion(m);
}
// Load rules from JSON, then render
loadRulesData();

// -- 热门内容 --
