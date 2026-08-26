var jayWorkspaceAssetCache = {};

function jayGetWorkspaceAsset(type, fallback) {
  if (!jayWorkspaceAssetCache) jayWorkspaceAssetCache = {};
  return Object.prototype.hasOwnProperty.call(jayWorkspaceAssetCache, type)
    ? jayWorkspaceAssetCache[type]
    : fallback;
}

function jayFmtTime(input) {
  if(!input) return '';
  var d = new Date(input);
  if(isNaN(d.getTime())) return String(input);
  var diff = (Date.now() - d.getTime()) / 1000;
  if(diff < 0) diff = 0;
  if(diff < 60) return '刚刚';
  if(diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if(diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if(diff < 86400 * 30) return Math.floor(diff / 86400) + '天前';
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + month + '-' + day;
}

function toast(message) {
  var element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  setTimeout(function(){ element.classList.remove('show'); }, 2400);
}

const countries=[
['🇨🇦','加拿大','加拿大','US$ 40.0B','+10.0%','Amazon'],
['🇫🇷','法国','法国','US$ 60.0B','+6.0%','Amazon'],
['🇮🇩','印度尼西亚','印度尼西亚','US$ 65.0B','+15.0%','Shopee'],
['🇷🇺','俄罗斯','俄罗斯','US$ 550.0B','+12.0%','AliExpress'],
['🇧🇷','巴西','巴西','US$ 50.0B','+14.0%','MercadoLibre'],
['🇮🇹','意大利','意大利','US$ 30.0B','+9.0%','Amazon'],
['🇪🇸','西班牙','西班牙','US$ 30.0B','+12.0%','Amazon'],
['🇲🇽','墨西哥','墨西哥','US$ 25.0B','+22.0%','MercadoLibre'],
['🇳🇱','荷兰','荷兰','US$ 25.0B','+6.0%','AliExpress'],
['🇦🇺','澳大利亚','澳大利亚','US$ 25.0B','+7.0%','Amazon'],
['🇻🇳','越南','越南','US$ 20.0B','+18.0%','Shopee'],
['🇹🇭','泰国','泰国','US$ 280.0B','+14.0%','Shopee'],
['🇲🇾','马来西亚','马来西亚','US$ 220.0B','+12.0%','Shopee'],
['🇵🇭','菲律宾','菲律宾','US$ 180.0B','+20.0%','Shopee'],
['🇸🇬','新加坡','新加坡','US$ 120.0B','+8.0%','Shopee'],
['🇸🇦','沙特阿拉伯','沙特阿拉伯','US$ 120.0B','+18.0%','Amazon'],
['🇦🇪','阿联酋','阿联酋','US$ 80.0B','+15.0%','Noon'],
['🇳🇬','尼日利亚','尼日利亚','US$ 80.0B','+25.0%','AliExpress'],
['🇿🇦','南非','南非','US$ 50.0B','+10.0%','AliExpress'],
['🇪🇬','埃及','埃及','US$ 45.0B','+20.0%','AliExpress'],
['🇺🇸','美国','美国','US$ 1.10T','+8.0%','Amazon'],
['🇯🇵','日本','日本','US$ 180.0B','+5.0%','Amazon'],
['🇬🇧','英国','英国','US$ 180.0B','+7.0%','Amazon'],
['🇩🇪','德国','德国','US$ 100.0B','+5.0%','Amazon'],
['🇮🇳','印度','印度','US$ 75.0B','+25.0%','Amazon'],
['🇰🇷','韩国','韩国','US$ 70.0B','+8.0%','AliExpress']];
const alerts=[
['#4a85d9','美国','对华301关税大幅提升','2026-07-13'],
['#4a85d9','美国','TikTok Shop合规审查','2026-07-13'],
['#4a85d9','印尼','进口商品免税门槛取消','2026-07-13'],
['#4a85d9','印尼','SNI强制认证扩展','2026-07-13'],
['#4a85d9','越南','跨境电商税务新规','2026-07-13'],
['#c39142','越南','电子发票强制要求','2026-07-13'],
['#c39142','泰国','VAT电商免税门槛调整','2026-07-13'],
['#c39142','泰国','进口商品TISI认证加强','2026-07-13'],
['#c39142','马来西亚','跨境电商所得税新规','2026-07-13'],
['#c39142','沙特','VAT 15%实施','2026-07-13'],
['#4a85d9','沙特','SABER认证强制实施','2026-07-13'],
['#c39142','阿联酋','VAT 5%及电商监管加强','2026-07-13'],
['#c39142','阿联酋','进口商品ESMA标准加强','2026-07-13'],
['#4a85d9','巴西','Remessa Conforme进口税计划','2026-07-13'],
['#c39142','巴西','电商数字税征收','2026-07-13'],
['#4a85d9','德国','数字服务法DSA全面执行','2026-07-13'],
['#4a85d9','法国','GPSR通用产品安全法规','2026-07-13'],
['#c39142','法国','数字服务法DSA法国执行','2026-07-13'],
['#4a85d9','印度','FDI外资限制加强','2026-07-13'],
['#4a85d9','印度','BIS强制认证扩展','2026-07-13'],
['#4a85d9','尼日利亚','进口许可与NIMP合规','2026-07-13'],
['#4a85d9','尼日利亚','外汇管制与进口付汇限制','2026-07-13'],
['#4a85d9','埃及','ACID预登记系统升级','2026-07-13'],
['#c39142','南非','进口关税调整与本地化要求','2026-07-13']];

const alertsFull=[
// id,type,level,title,country,platform,detail,date,read
['a1','shop','high','TikTok Shop 印尼美妆店 GMV 7日暴跌 42%','印尼','TikTok Shop','GMV 从 Rp2.3亿 降至 Rp1.3亿，转化率从 4.2% 跌至 2.1%','2026-07-15',false],
['a2','shop','high','Shopee 巴西 3C 店铺因物流违规被扣 12 分','巴西','Shopee','累计扣分达限流阈值，7日内未申诉将降权','2026-07-15',false],
['a3','shop','mid','Lazada 泰国服装店差评率激增至 8.7%','泰国','Lazada','近7日差评 47 条，主要集中在尺码偏差和色差问题','2026-07-14',false],
['a4','shop','mid','TikTok Shop 美国家居店广告投放 ROI 跌至 1.2','美国','TikTok Shop','广告花费 $1,840 但 GMV 仅 $2,208，远低于盈亏线','2026-07-14',false],
['a5','shop','mid','Shopee 越南家居店 3 款主力品断货超 48 小时','越南','Shopee','断货导致店铺权重下降，自然流量减少 31%','2026-07-13',true],
['a6','shop','low','TikTok Shop 马来站宠物用品店上新 12 款同类竞品','马来西亚','TikTok Shop','同赛道新店铺密集入场，价格带下移 15%','2026-07-12',true],
['a7','cat','high','泰国美妆类目 7 日增速 +212%，新爆品涌现','泰国','TikTok Shop','防晒品类主导增长，3 款新品 7 日销量破 5 万','2026-07-15',false],
['a8','cat','high','印尼清真食品类目斋月前爆发 +186%','印尼','Shopee','预计持续至斋月结束，建议提前备货','2026-07-15',false],
['a9','cat','mid','日本 3C 配件类目价格战加剧，均价下跌 23%','日本','Amazon','Top20 产品中 14 款在 30 天内降价，利润空间压缩','2026-07-14',false],
['a10','cat','mid','巴西泳装类目季节性爆发 +154%','巴西','Shopee','世界杯季节效应，男士泳裤增速领先','2026-07-14',false],
['a11','cat','mid','美国智能家居类目 30 日增速 +89%','美国','TikTok Shop','智能灯具和安防摄像头主导增长','2026-07-13',true],
['a12','cat','low','越南母婴用品类目流量连续 14 天下滑','越南','Shopee','流量下降 18%，疑似受本土品牌促销冲击','2026-07-12',true],
['a13','policy','high','美国对华 301 关税提升至 145%，全品类影响','美国','-','7月15日起执行，覆盖所有中国原产地商品','2026-07-15',false],
['a14','policy','high','印尼取消进口商品免税门槛，全面征收进口税','印尼','-','所有跨境包裹均需缴纳关税+VAT，成本上升 20-30%','2026-07-15',false],
['a15','policy','high','越南跨境电商须缴纳与本土企业相同税率','越南','-','新税法要求外资电商企业税率从 5% 提升至 10%','2026-07-14',false],
['a16','policy','high','沙特 SABER 认证强制实施，未认证商品禁止清关','沙特','-','涉及电子电器、玩具、建材等 12 大品类','2026-07-13',false],
['a17','policy','high','巴西 Remessa Conforme 进口税计划正式执行','巴西','-','跨境包裹征收 20% 进口税 + 17% ICMS','2026-07-13',true],
['a18','policy','mid','德国数字服务法 DSA 全面执行','德国','-','平台需加强商品安全审核，违规商品 48h 内下架','2026-07-14',false],
['a19','policy','mid','印度 FDI 外资限制加强，电商平台合规要求升级','印度','-','外商独资电商平台需重新注册，库存模式受限','2026-07-13',true],
['a20','policy','mid','尼日利亚外汇管制收紧，进口付汇周期延长','尼日利亚','-','外汇审批从 5 个工作日延长至 15-20 个工作日','2026-07-13',true],
['a21','policy','mid','法国 GPSR 通用产品安全法规执行','法国','-','所有在法销售商品须有欧盟境内负责人','2026-07-12',true],
['a22','macro','high','土耳其里拉单日暴跌 5.2%，汇率风险极高','土耳其','-','美元/里拉突破 38.5，跨境电商定价需紧急调整','2026-07-15',false],
['a23','macro','mid','越南盾 6 个月内累计贬值 3.2%','越南','-','利润空间压缩，建议调整定价策略','2026-07-14',false],
['a24','macro','mid','印尼卢比兑美元跌破 16,500，进口成本上升','印尼','-','进口商品成本增加约 4%，影响 3C/美妆品类利润','2026-07-13',true],
['a25','macro','low','沙特里亚尔锚定美元，汇率稳定','沙特','-','汇率波动 <0.1%，对跨境电商影响极小','2026-07-12',true],
['a26','macro','low','巴西雷亚尔近 30 日升值 2.1%','巴西','-','有利于进口采购，但出口竞争力微降','2026-07-11',true],
['a27','platform','high','TikTok Shop 印尼佣金从 1% 上调至 5%','印尼','TikTok Shop','7月20日生效，美妆/食品类目额外加收 1%','2026-07-15',false],
['a28','platform','high','Shopee 美国站实施店铺分级新规','美国','Shopee','低于 3.5 星店铺将被限流，需关注服务质量','2026-07-14',false],
['a29','platform','mid','Lazada 泰国发货时效从 3 天缩至 2 天','泰国','Lazada','8月1日起执行，超时自动取消订单并扣分','2026-07-14',false],
['a30','platform','mid','TikTok Shop 马来西亚保证金上调至 RM5,000','马来西亚','TikTok Shop','新卖家入驻成本增加，现有卖家不受影响','2026-07-13',true],
['a31','platform','mid','Amazon 美国站广告竞价上涨 18%','美国','Amazon','Q3 旺季竞争加剧，CPC 均价从 $0.85 升至 $1.00','2026-07-13',true],
['a32','platform','low','Shopee 越南物流费率微调 +3%','越南','Shopee','影响范围：标准快递和經濟快递','2026-07-12',true],
['a33','platform','low','Lazada 菲律宾佣金从 2% 调至 2.5%','菲律宾','Lazada','7月25日生效，美妆类目维持 2% 不变','2026-07-11',true],
['a34','shop','high','菲律宾母婴店因发货超时被封店 7 天','菲律宾','Shopee','需提交申诉材料，预计 3 个工作日恢复','2026-07-14',false],
['a35','cat','high','美国运动户外类目世界杯前暴涨 +127%','美国','TikTok Shop','球迷围巾、便携音箱、投影仪增速领先','2026-07-14',false],
['a36','policy','mid','阿联酋 ESMA 标准升级，电子产品需重新认证','阿联酋','-','现有认证有效期延至 2026 年底，届时需更换','2026-07-12',true],
['a37','macro','mid','埃及镑官方汇率与黑市价差扩大至 40%','埃及','-','外汇结算风险增大，建议缩短回款周期','2026-07-12',true],
['a38','platform','mid','TikTok Shop 美国站商品审核周期延长至 72 小时','美国','TikTok Shop','因合规审查升级，新上架商品审核变慢','2026-07-12',true],
['a39','shop','mid','印尼美妆店铺差评激增导致转化率下跌 35%','印尼','TikTok Shop','主要投诉：产品与描述不符、包装破损','2026-07-13',true]
];

const products=[
['🏠','Ninja CREAMi XL Deluxe 11合1冰淇淋机','欧美','TikTok Shop','家居家装','冰淇淋机/制冷小家电','1699-1899RMB','1699-1899','2,920','+173.6%','爆发','HomeGadgets US','45','2h'],
['⚽','Poolhacker泳池双头喷泉支架','欧美','TikTok Shop','运动户外','泳池配件/户外装备','$35-40','252-288','140','+88.0%','爆发','PoolFun Store','22','2h'],
['💄','Tarte睫毛膏(Manaster Mascara)','欧美','Amazon','美妆个护','眼部化妆品/睫毛膏','$27-29','194-209','5,200','+71.0%','爆发','Tarte Cosmetics','90','4h'],
['📦','宠物冰垫','欧美','Amazon','宠物用品','宠物用品/夏季降温','59-129RMB','59-129','7,000','+65.0%','爆发','PetCool Life','18','2h'],
['📦','汽车遮阳帘','中东','Noon','汽车配件','车载配件/遮阳防晒','39-109RMB','39-109','6,000','+55.0%','爆发','AutoShield ME','35','6h'],
['💄','Native椰子香草洗发护发套装','欧美','Amazon','美妆个护','洗发护发/沐浴护体','$10-15','72-108','6,500','+55.0%','爆发','Native Organics','120','4h'],
['👗','防晒冰丝袖套(UPF50+)','东南亚','Shopee','服饰鞋包','防晒用品/户外配饰','9-22RMB','9-22','3,200','+50.0%','爆发','SunGuard ID','28','2h'],
['💄','Medicule胶原蛋白眼膜','欧美','TikTok Shop','美妆个护','面部护理/眼部护理','$25-37','180-266','8,500','+45.2%','爆发','Medicule Official','60','2h'],
['📱','太阳能充电板','非洲','AliExpress','3C数码','充电设备/户外电源','79-219RMB','79-219','2,000','+45.0%','爆发','SolarTech CN','50','8h'],
['📦','宠物自动喂食器','东南亚','TikTok Shop','宠物用品','宠物智能设备/喂食器','109-219RMB','109-219','3,000','+42.0%','爆发','PetSmart Asia','40','2h'],
['📱','智能手表','中东','TikTok Shop','3C数码','智能穿戴/手表','109-289RMB','109-289','4,000','+38.0%','爆发','WatchTech ME','75','4h'],
['💄','美白身体乳','东南亚','TikTok Shop','美妆个护','身体护理/美白产品','45-89RMB','45-89','12,000','+35.0%','爆发','GlowWhite TH','55','2h'],
['🏠','空气炸锅配件','日韩','Amazon','家居家装','厨房用品/小家电配件','39-89RMB','39-89','4,500','+35.0%','爆发','KitchenPro KR','30','6h'],
['💄','Sol de Janeiro Cheirosa 62香水','欧美','Amazon','美妆个护','香水香体/身体喷雾','$32-68','230-490','3,800','+35.0%','上升','Sol de Janeiro','200','4h'],
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
['💄','ANLAN 8合1面部EMS美容仪','东南亚','Shopee','美妆个护','美容仪器/面部护理','$20-30','144-216','175','+22.0%','上升','ANLAN Beauty','20','2h'],
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
['💄','Dazzle Me定妆喷雾','东南亚','Shopee','美妆个护','化妆品/定妆喷雾','$3-8','22-58','12,000','+15.0%','上升','DazzleBeauty VN','200','2h'],
['🏠','陶瓷花盆Bat Trang装饰套装','东南亚','Shopee','家居家装','家居装饰/花盆花架','$5-10','36-72','44,000','+12.5%','上升','Ceramic VN','220','2h'],
['👗','男士Polo衫','南亚','Amazon','服饰鞋包','男装/休闲Polo衫','39-89RMB','39-89','5,000','+12.0%','关注','MenStyle IN','190','6h'],
['📱','手机壳潮款','拉美','Shopee','3C数码','手机配件/手机壳','15-39RMB','15-39','12,000','+10.0%','关注','CaseArt BR','250','4h'],
['🏠','SEESE Cordless Pressure Washer','欧美','TikTok Shop','家居家装','清洁工具/高压水枪','189-259RMB','189-259','3,480','+5.3%','爆发','SEESE US','42','2h'],
['📦','婴儿湿巾','东南亚','Shopee','母婴用品','母婴护理/婴儿湿巾','9-25RMB','9-25','20,000','+5.0%','关注','BabySoft ID','300','2h'],
['📦','Toplux Magnesium Complex 8','欧美','TikTok Shop','健康保健','保健品/矿物质补充','149-219RMB','149-219','3,320','-7.5%','下降','Toplux Health','365','4h']
];
const shops=[
['Somethingspeaking','TikTok Shop','东南亚','US$ 280万','+15.0%','正常','美妆个护',156,'+8.2%','对标头部',42500,'4.8','2h'],
['Eiger Official','Shopee','东南亚','US$ 180万','+8.0%','正常','户外运动',230,'+3.5%','头部对标',88000,'4.7','4h'],
['MS Glow','TikTok Shop','东南亚','US$ 350万','+22.0%','正常','美妆个护',189,'+12.1%','对标头部',156000,'4.6','1h'],
['Xiaomi Official','Lazada','东南亚','US$ 420万','+12.0%','正常','3C数码',520,'+5.8%','头部对标',320000,'4.9','3h'],
['Mamaway','Shopee','东南亚','US$ 95万','+6.0%','关注','母婴用品',98,'-2.3%','潜在对手',35000,'4.5','6h'],
['Kopi Kenangan','Tokopedia','东南亚','US$ 120万','+18.0%','正常','食品饮料',45,'+9.0%','潜在对手',72000,'4.7','5h'],
['GlamAR Beauty','Noon','中东','US$ 85万','+25.0%','正常','美妆个护',112,'+15.3%','低价竞品',28000,'4.6','3h'],
['Carrefour UAE','Noon','中东','US$ 200万','+10.0%','正常','日用百货',1200,'+4.2%','头部对标',95000,'4.5','8h'],
['AutoPro Accessories','TikTok Shop','中东','US$ 65万','+45.0%','关注','汽车配件',78,'+28.5%','潜在对手',18000,'4.3','2h'],
['Govee US','Amazon','欧美','US$ 580万','+18.0%','正常','家居家装',340,'+7.6%','对标头部',210000,'4.7','1h'],
['CIDER','SHEIN','欧美','US$ 320万','+12.0%','正常','时尚服饰',680,'+6.1%','低价竞品',185000,'4.4','4h'],
['EcoFlow','Amazon','欧美','US$ 420万','+22.0%','正常','3C数码',86,'+11.2%','对标头部',145000,'4.8','2h'],
['Bissell','Amazon','欧美','US$ 280万','+8.0%','正常','家居家电',195,'+2.1%','头部对标',120000,'4.6','6h'],
['BARBERX','TikTok Shop','欧美','US$ 150万','+35.0%','关注','美妆个护',67,'+22.0%','潜在对手',56000,'4.5','3h'],
['Beauty Store BR','Shopee','拉美','US$ 95万','+15.0%','正常','美妆个护',210,'+8.7%','低价竞品',42000,'4.4','5h'],
['TechZone MX','MercadoLibre','拉美','US$ 180万','+10.0%','正常','3C数码',340,'+5.2%','潜在对手',65000,'4.6','7h'],
['Moda Latina','Shopee','拉美','US$ 75万','+8.0%','关注','时尚服饰',450,'-1.8%','低价竞品',28000,'4.2','4h'],
['COSME Kitchen','TikTok Shop','日韩','US$ 220万','+20.0%','正常','美妆个护',175,'+10.5%','对标头部',98000,'4.8','2h'],
['Kitchen Korea','TikTok Shop','日韩','US$ 120万','+30.0%','关注','家居厨房',230,'+18.3%','潜在对手',52000,'4.6','3h'],
['Hair Pin Studio','TikTok Shop','日韩','US$ 85万','+15.0%','正常','饰品配件',320,'+7.8%','低价竞品',38000,'4.5','5h'],
['MensStyle India','Amazon','南亚','US$ 65万','+8.0%','正常','时尚服饰',280,'+3.2%','潜在对手',22000,'4.3','8h'],
['FastCharge Tech','Amazon','南亚','US$ 95万','+15.0%','关注','3C数码',150,'+9.6%','低价竞品',35000,'4.4','6h'],
['AfroHair Queen','AliExpress','非洲','US$ 55万','+18.0%','正常','美妆个护',190,'+10.2%','潜在对手',28000,'4.5','4h'],
['SolarTech Africa','AliExpress','非洲','US$ 40万','+42.0%','关注','家居家电',65,'+25.8%','潜在对手',12000,'4.2','3h'],
['Pet Paradise','TikTok Shop','东南亚','US$ 48万','+55.0%','关注','宠物用品',120,'+32.1%','潜在对手',25000,'4.6','1h'],
['Medicube Official','TikTok Shop','欧美','US$ 1,630万','+52.0%','关注','美妆个护',95,'+35.6%','对标头部',580000,'4.9','1h'],
['Dazzle Me Official','Shopee','东南亚','US$ 120万','+18.5%','关注','美妆个护',145,'+11.2%','低价竞品',68000,'4.5','2h'],
['Rejuran Official MY','Shopee','东南亚','US$ 85万','+600.0%','关注','美妆个护',38,'+45.2%','对标头部',42000,'4.7','1h'],
['Poolhacker','TikTok Shop','欧美','US$ 14万','+120.0%','关注','户外运动',22,'+88.5%','潜在对手',8500,'4.3','2h'],
['BIBIGO(菲律宾)','Shopee','东南亚','US$ 35万','+454.0%','关注','食品饮料',56,'+38.0%','潜在对手',18000,'4.6','3h'],
,
['DealsForYouDays(SEESE品牌店)','TikTok Shop','欧美','US$ 507万','+100.0%','正常','家居日用',210,'+52.3%','对标头部',195000,'4.7','2h'],
,
['Toplux Nutrition Official','TikTok Shop','欧美','US$ 291万','-7.5%','正常','保健品',78,'-3.2%','潜在对手',85000,'4.6','4h']
];
let platformsData=[
['Walmart Marketplace','欧美','日用品,食品饮料,家居家电,服装,电子产品','420','10','佣金6%-15%按品类，WFS仓储费$0.75/立方英尺/月，无月费或入驻费','货架电商','50000','1. WFS履约中心扩至47个，88%美国人口两日达\n2. 推出AI listing优化工具beta版\n3. 搜索算法Q1更新加大销售速度权重'],
['SOUQ / Amazon中东站','中东','电子产品,图书,家居家电,美妆个护,时尚服饰','175','10','佣金抽成5-15%因品类而异 + FBA物流费 + 广告推广费','货架电商','4200','2026年推出FBA新卖家头程返现计划及新品激励计划(NSP)，降低卖家物流成本；Prime会员在中东持续增长，亚马逊Fresh生鲜配送业务扩展中；市场份额约35%稳居中东第一大电商'],
['Namshi','中东','时尚服饰,鞋履,美妆,配饰,运动装','5','15','混合模式(自营+第三方品牌入驻)，佣金12-18%','货架电商','1100','2025年推出斋月专属界面，阿拉伯语支持率达95%；整合Tabby和Tamara本地BNPL支付方式；月均访问量超1100万，70%以上来自移动端，被Noon集团收购后保持独立运营'],
['Wayfair','欧美','家具,家居装饰,家纺,卫浴,家电','125','0','供应商批发模式+广告推广费，无传统佣金','货架电商','10000','1. FY2025营收125亿美元同比增5.1%，退出德国聚焦美英加\n2. 与Google合作开发UCP协议实现AI购物闭环\n3. CastleGate物流扩展多渠道服务'],
['Jumia','非洲','电子产品,时尚服饰,家居用品,美妆个护,母婴','8.19','12','佣金抽成+广告费+物流费(Jumia Logistics)；佣金率因品类而异','货架电商','540','2025年全年GMV达8.186亿美元同比增14%，营收1.889亿美元同比增13%；在义乌设立办事处强化供应链，国际卖家销量增长82%；尼日利亚市场GMV同比大涨50%，目标2026Q4实现EBITDA盈亏平衡、2027年全年盈利'],
['Takealot','非洲','电子产品,家居园艺,小家电,时尚,运动户外','25','13','佣金8-18%因品类而异 + 月租约400南非兰特(约170元人民币)；新店前4个月免月租','货架电商','480','2026财年首次实现全年盈利，营收177亿兰特(约10亿美元)同比增18%；2026年4月重新开放中国卖家入驻通道，禁止跟卖形式；TFS物流商业化服务收入增长93.5%，活跃用户达620万'],
['Etsy','欧美','手工制品,复古物品,珠宝首饰,家居装饰,个性化定制品','119','16.5','上架费$0.20/件+交易佣金6.5%+支付处理费3%+$0.25+Etsy Ads可选','货架电商','8660','1. 出售Reverb业务(2025.6)，拟以12亿美元出售Depop给eBay\n2. 推出$29店铺开设费提升卖家质量\n3. 与OpenAI合作推出Agentic Commerce Protocol即时结账'],
['Kilimall','非洲','手机,电子产品,时尚服饰,家电,美妆个护','0.5','10','佣金抽成+物流费；无月租，中国卖家占比超40%','货架电商','720','2026年注册用户突破1000万，服务8000多家企业开通1.2万家网店；2026年重点扶持海外仓+本地配送模式；自建物流体系实现内罗毕当日达、主要城市次日达，库存准确率超99.9%'],
['Linio','拉美','电子产品,时尚服饰,家居用品,美妆,运动','10','11','无月租，佣金7-15%；支持7种以上线上线下支付方式','货架电商','9500','2025年被Falabella集团收购整合后继续运营；墨西哥站贡献约41%的GMV，全站月流量过亿；通过线下实体店Tienda Linio构建O2O生态；只接受公司资质入驻'],
['Cdiscount','欧美','消费电子,家用电器,家居园艺,时尚服饰,母婴玩具','47','11.5','月订阅费€39.99+品类佣金5%-20%(二手+2%)','货架电商','2400','1. 月流量超1700万，年销售额26亿欧元\n2. 2025年进军中国市场推动全球化\n3. 启动黑色十一月大促，全品类需提供5%折扣'],
['Fnac Darty','欧美','消费电子,家用电器,图书,游戏,玩具文具','24','12','Marketplace佣金+服务费，按品类不同','货架电商','3000','1. FY2025营收103亿欧元，线上销售占比21%同比增近6%\n2. 收购Unieuro拓展意大利市场，发布Beyond Everyday 2030战略\n3. EP集团发起收购要约，Click\u0026Collect占比近50%'],
['Zalando','欧美','时尚服饰,运动鞋服,美妆护肤,儿童家庭,设计师品牌','192','15','Marketplace佣金+物流配送费+广告费，按品类不同','货架电商','6200','1. FY2025 GMV 175.6亿欧元同比增14.7%，营收123亿欧元增16.8%\n2. 收购ABOUT YOU后活跃用户达6200万创新高\n3. Plus会员1680万贡献Q4近半GMV，推出AI发现信息流'],
['Blibli','东南亚','数码家电,时尚服饰,美妆个护,家居百货,食品生鲜','17','8.5','佣金抽成为主(8.5% Take Rate)，广告费，物流费','货架电商','1430','2025财年营收22.36万亿印尼盾(+34%)，TPV达83.3万亿印尼盾，亏损收窄；市场份额从4%降至3%；完成全渠道会员体系打通(Blibli/tiket.com/Ranch Market/Dekoruma)，线下门店扩至265家'],
['Tiki','东南亚','3C数码,日用百货,图书文具,美妆个护,母婴用品','2','7.5','佣金抽成5-10%，广告费','货架电商','65','2025上半年销售额同比暴跌63%，市场份额降至不足1%；在Shopee/TikTok Shop双寡头格局下生存空间被严重挤压；越南电商市场整体增长34.8%但Tiki逆势下滑，面临严峻转型压力'],
['Coupang','日韩','全品类,生鲜食品,家电数码,美妆个护,日用百货','500','10','佣金抽成8-12%，广告费，会员费(Coupang Wow)，物流费','货架电商','3312','2025年韩国电商市场份额33%稳居第一，MAU超3300万；2026年Q1信任危机后MAU迅速恢复至3345万；面临Naver SmartStore(+22.8% YoY)的结构性竞争'],
['Gmarket/Auction','日韩','时尚服饰,美妆个护,数码家电,食品百货,家居用品','140','10','佣金抽成8-12%，广告费，年投入5000亿韩元卖家补贴','货架电商','3500','2025年9月与阿里国际成立合资公司，通过Lazada向东南亚5国出口韩品；2026上半年GMV 4年来首次同比正增长(+14%)；反向海淘爆发，1.7万卖家参与，3000万商品接入东南亚'],
['Qoo10','日韩','美妆护肤,时尚服饰,健康食品,K-Beauty,生活杂货','30','10','佣金抽成约10%，广告费','货架电商','3500','2025年日本线上美妆市占率超30%，成K-Beauty入日核心渠道；Mega Debut项目一年孵化200个品牌，累计销售约35亿日元；2026年将在东京开设美妆旗舰店，直播购物Q3观看量增4倍'],
['Rakuten 乐天','日韩','综合百货,食品家电,时尚美妆,旅游服务,数字内容','420','4','佣金抽成2-6%+月额固定费65000日元起，广告费(RPP)，会员费(积分体系)','货架电商','4400','2025财年集团营收2.4966万亿日元(+9.5%)连续29年创新高，电商GMV 6.35万亿日元(+3.9%)；2026年推出千店出海计划开放中国品牌入驻；与YouTube合作实现视频直接跳转购买'],
['Yahoo! Shopping','日韩','综合百货,时尚家电,食品日用品,ふるさと納税,LOHACO','300','5.5','佣金抽成3-8%，广告费；2026年9月起新增月费1万日元+LINE购物2-4%推荐费','货架电商','6000','2025年GMV同比+8%，PayPayポイント限定化推动复购超预期；2026年9月13年来首次向卖家收月费1万日元+2.5%佣金；LINE应用新增购物标签页，上线AI购物助手和EC Pilot卖家顾问'],
['Mercari 煤炉','日韩, 欧美','二手服饰,数码家电,动漫周边,玩具手办,美妆个护','75','10','佣金抽成10%(卖家承担)，无月租费','货架电商','2300','FY2025 GMV 1.12万亿日元，娱乐/动漫品类GMV同比+32%，跨境GMV超900亿日元(3年增长15倍)；Mercari Hallo用户破1200万；Fintechメルカード发卡突破500万张，金融科技收入+25.2%'],
['Ozon','东南亚, 欧美','全品类,数码3C,服饰美妆,家居百货,食品日百','550','11.5','佣金抽成8-15%，广告费，物流费(FBP半托管)','货架电商','4300','2025年GMV 4.16万亿卢布(+45%)，交付24.8亿单(+69%)，2017-2025年CAGR 91%；2026年目标GMV翻倍，跨境销售增100%，百亿补贴持续加码；自建物流500万㎡仓储，8.4万自提点，旺季时效+30%'],
['Wildberries','东南亚, 欧美','时尚服饰,家居用品,美妆鞋靴,母婴用品,数码家电','800','12','佣金抽成+物流费+仓储费(具体费率按品类浮动)','货架电商','5000','2025年GMV 6.1万亿卢布(+49%)，俄罗斯市场份额51.8%稳居第一；与Ozon合计占俄电商87%，双寡头格局稳固；持续扩展独联体国家物流网络，强化时尚品类优势'],
['Joom','欧美','电子配件,家居日用,服饰鞋靴,美妆健康,玩具母婴','5','10','佣金抽成+广告费+Joom Logistics物流费','货架电商','700','2025年持续深耕俄罗斯/独联体市场；拓展越南等新兴市场，JoomShopping独立站方案在俄/乌/德等国有3700+活跃店铺；面临Temu/SHEIN等中国跨境平台竞争压力加大'],
['Rozetka','欧美','消费电子,家用电器,时尚服饰,美妆个护,家居日用','7.6','7.5','佣金抽成5-10%，广告费，物流费，RozetkaPay支付服务费','货架电商','1800','2025年1-9月营收302亿格里夫纳，占乌克兰十大电商总营收76%，稳居第一；2025年9月与Unex Bank合作推出RozetkaPay支付卡；2026年6月基辅门店遭俄导弹袭击仍坚持运营'],
['ASOS','欧美','女装,男装,鞋靴,配饰,美妆','45','18','Marketplace佣金15-25%+广告费+物流费','货架电商','7000','1. FY2025营收约35亿英镑，恢复盈利\n2. 聚焦核心年轻客群，优化库存与退货管理\n3. 与OpenAI合作推出AI购物助手，强化移动应用体验'],
['Carrefour线上商城','欧美, 拉美','食品生鲜,日用百货,家电,服装,母婴','65','10','Marketplace佣金8-15%+物流费+零售媒体广告费','货架电商','5000','1. 电商GMV同比增长18%，目标2026年达100亿欧元\n2. 投资30亿欧元数字化，与Google合作AI商务\n3. 整合Cora/Match门店，Unlimitail零售媒体平台扩展'],
['Target','欧美','日用百货,服装,电子,家居,食品','110','10','Marketplace佣金5-15%+广告费+物流费','货架电商','15000','1. 线上销售约1100亿美元，同店数字销售持续增长\n2. Target Circle会员体系超1亿会员\n3. 扩展同日配送覆盖，Target+精选卖家计划推进'],
['Best Buy','欧美','消费电子,电脑,手机,家电,游戏','135','8','Marketplace佣金+Best Buy Ads广告费','货架电商','10000','1. FY26营收约417亿美元，线上占比约32%\n2. 2025年推出Best Buy Marketplace第三方平台，已有1000+卖家\n3. Best Buy Ads零售媒体网络已实现高盈利'],
['Instagram Shop / Facebook Shop','欧美, 东南亚','服装时尚、美妆个护、家居装饰、食品饮料、电子产品','184','5','平台费5%/单，主要通过广告变现（无直接佣金），Facebook Shops免入驻费','社交电商','210000','2025-2026年Meta持续强化AI推荐购物功能；Instagram Live Shopping年GMV达$8.2B；Meta Shops年GMV $2.4B；整合Shopify商品同步；推出AI驱动的商品发现与个性化推荐；创作者合作工具升级'],
['YouTube Shopping','欧美, 东南亚, 日韩, 南亚','电子产品、时尚服饰、美妆护肤、家居生活、食品','150','5','创作者佣金3-8%，平台抽成约2-3%（通过Google Shopping），无入驻费','社交电商','285000','2025-2026年直播购物GMV同比增长212%；东南亚购物视频达600万+；商品页转化率3.8%；与Shopify深度集成商品目录同步；200万+商家关联商品目录；AI智能商品标签自动识别；东南亚推出Commerce Media Suite与Shopee合作'],
['Pinterest Shop','欧美','家居装饰、时尚穿搭、美食食谱、美妆护肤、DIY手工','42','0','无佣金，通过广告变现（CPC约$0.83），Product Pins免费添加','社交电商','53700','2025-2026年广告收入达$42亿；85%用户基于Pin内容做出购买决策；IDEA广告格式升级支持多商品轮播；与Shopify/BigCommerce集成商品同步；Shuffles拼贴购物功能优化；AI视觉搜索增强商品发现能力'],
['TikTok Shop','东南亚, 欧美','美妆个护,服饰鞋包,3C数码,家居日用,食品饮料','350','6.5','佣金5-8%+交易服务费2%','内容电商','150000','2025年美区GMV突破200亿美元;2026年欧洲扩站至14国;全托管模式持续扩张'],
['Shopee','东南亚, 拉美','美妆个护,服饰鞋包,家居日用,3C数码,母婴','900','4.5','佣金1-5.5%+交易费2%','货架电商','60000','2025年GMV同比增长30%达900亿美元;拉美持续扩张;强化直播电商'],
['Lazada','东南亚','3C数码,美妆个护,家居家电,服饰,母婴','200','3.5','佣金1-4%+支付手续费1-2%','货架电商','15000','阿里持续注资物流升级;强化LazMall品牌商城'],
['Amazon','欧美, 日韩, 中东','3C数码,家居家电,服饰鞋包,图书,美妆','7000','12','品类佣金8-15%+FBA仓储费+广告费','货架电商','300000','Prime会员超2.5亿;FBA费用上涨;AI购物助手Rufus上线;广告收入破500亿美元'],
['Temu','欧美, 日韩','服饰鞋包,家居日用,美妆个护,3C配件,户外','500','0','全托管平台统一定价','跨境专供','20000','全球扩张至80+国家;半托管模式铺开;面临欧盟DSA合规审查'],
['SHEIN Marketplace','欧美, 东南亚, 中东, 拉美','女装快时尚,美妆个护,配饰,家居,男装','450','15','第三方佣金10-20%+物流费','货架电商','15000','Marketplace第三方卖家超5万;伦敦IPO筹备中;供应链本土化转移'],
['AliExpress 速卖通','欧美, 中东, 拉美','3C数码,服饰鞋包,家居家装,汽配,美妆','400','7','品类佣金5-8%+交易服务费5%','跨境专供','20000','全面推Choice全托管+半托管双模式;韩国市场增长迅猛;欧洲仓本土化加速'],
['eBay','欧美','汽配,二手商品,电子数码,收藏品,服饰','750','14','成交价佣金约13-15%','货架电商','13000','聚焦汽配和翻新电子品类;拍卖弱化固定价占比超85%;卖家费用优化'],
['Tokopedia','东南亚','家电,家居,美妆个护,服饰,食品','250','1','佣金0-1%+支付手续费0.5-1%','货架电商','10000','与TikTok Shop印尼合并运营;GoTo集团与Gojek生态整合;本土商家保护加强'],
['MercadoLibre 美客多','拉美','3C数码,家居家电,服饰,汽配,美妆','200','14.5','品类佣金12-17%+支付+物流费','货架电商','30000','GMV同比增长35%;Mercado Pago成拉美最大金融科技;自有物流覆盖18国']];
let pfExtData={
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
'Kwai Shop/拉美':{growth:'+125.6%',risk:'high',shipping:'跨境直邮+本土仓',entry:'跨境/本土均可',priceRange:'$3-25',hotCats:['美妆','时尚配饰','3C'],blueCats:['小家电','运动'],founded:'2022',users:'3500万/月',payments:'PIX/Boleto/COD/信用卡',events:'Kwai 大促, Carnival Sale'},
'Namshi':{growth:'+21.4%',risk:'low',shipping:'Noon物流+自营',entry:'需中东公司/代理',priceRange:'$15-90',hotCats:['时尚女装','鞋履','美妆'],blueCats:['运动装','配饰'],founded:'2011',users:'1100万/月',payments:'Tabby/Tamara BNPL/信用卡',events:'斋月大促, White Friday'},
'Wayfair':{growth:'+5.1%',risk:'low',shipping:'自有仓储+第三方',entry:'供应商入驻',priceRange:'$20-400',hotCats:['家具','家居装饰','家纺'],blueCats:['智能家具','仓储收纳'],founded:'2002',users:'1.1亿/月',payments:'信用卡/PayPal/Affirm',events:'Way Day, Black Friday'},
'Takealot':{growth:'+18.0%',risk:'low',shipping:'自建物流+第三方',entry:'需南非公司',priceRange:'$5-120',hotCats:['电子','家居','时尚'],blueCats:['小家电','美妆'],founded:'2011',users:'620万/月',payments:'EFT/信用卡/COD',events:'Black Friday, Cyber Monday'},
'Etsy':{growth:'+8.5%',risk:'low',shipping:'商家自发',entry:'全球卖家可入驻',priceRange:'$5-80',hotCats:['手工制品','复古','珠宝'],blueCats:['个性化定制','数字商品'],founded:'2005',users:'8660万/月',payments:'Etsy Payments/PayPal',events:'Etsy Gift Mode, Holiday'},
'Linio':{growth:'+9.3%',risk:'mid',shipping:'Falabella物流',entry:'需公司资质',priceRange:'$5-120',hotCats:['电子','时尚','家居'],blueCats:['美妆','运动'],founded:'2012',users:'9500万/月',payments:'信用卡/分期/COD',events:'Hot Sale, 年中大促'},
'Cdiscount':{growth:'+6.7%',risk:'low',shipping:'自有仓+第三方',entry:'月订阅€39.99',priceRange:'€10-300',hotCats:['电子','家居','时尚'],blueCats:['母婴','玩具'],founded:'1999',users:'2400万/月',payments:'信用卡/ PayPal',events:'French Days, Black Friday'},
'Fnac Darty':{growth:'+4.2%',risk:'low',shipping:'自建物流',entry:'需欧盟公司',priceRange:'€10-600',hotCats:['电子','家电','文化'],blueCats:['智能家电','数码'],founded:'2016(合并)',users:'1500万/月',payments:'信用卡/分期',events:'French Days, Noël'},
'Zalando':{growth:'+11.8%',risk:'low',shipping:'自建物流',entry:'品牌/经销商入驻',priceRange:'€15-200',hotCats:['时尚服饰','鞋履','美妆'],blueCats:['运动休闲','设计师'],founded:'2008',users:'5200万/月',payments:'Klarna/信用卡',events:'Mid Season, Black Friday'},
'Blibli':{growth:'+24.6%',risk:'low',shipping:'自建仓+第三方',entry:'需本土公司',priceRange:'$3-60',hotCats:['电子','家居','时尚'],blueCats:['美妆','母婴'],founded:'2011',users:'4000万/月',payments:'GoPay/银行转账/COD',events:'Harbolnas, Ramadan'},
'Tiki':{growth:'+29.1%',risk:'low',shipping:'自建物流',entry:'需本土公司',priceRange:'$3-80',hotCats:['电子','美妆','家居'],blueCats:['母婴','图书'],founded:'2010',users:'3000万/月',payments:'ZaloPay/银行转账/COD',events:'Tiki Sale, 9.9'},
'Gmarket/Auction':{growth:'+8.3%',risk:'low',shipping:'韩国本土配送',entry:'需韩国公司',priceRange:'$15-100',hotCats:['电子','时尚','美妆'],blueCats:['设计师品牌','健康食品'],founded:'2000',users:'1800万/月',payments:'信用卡/银行转账/SmilePay',events:'Super Sale, 年中/年末大促'},
'Qoo10':{growth:'+7.6%',risk:'low',shipping:'新加坡本土配送',entry:'需新加坡公司',priceRange:'$5-120',hotCats:['时尚','美妆','家居'],blueCats:['母婴','电子'],founded:'2008(新加坡)',users:'1200万/月',payments:'信用卡/PayPal/银行转账',events:'Qoo10 Sale, 双11'},
'Rakuten 乐天':{growth:'+6.9%',risk:'low',shipping:'日本本土配送',entry:'需日本公司',priceRange:'¥1000-20000',hotCats:['美妆','时尚','食品'],blueCats:['宠物','健康'],founded:'1997',users:'4800万/月',payments:'信用卡/便利店/银行',events:'超级点券祭, 年末'},
'Yahoo! Shopping':{growth:'+3.4%',risk:'low',shipping:'日本本土配送',entry:'需日本公司',priceRange:'¥1000-15000',hotCats:['时尚','家居','电子'],blueCats:['二手','复古'],founded:'1999',users:'2000万/月',payments:'信用卡/便利店/银行',events:'年末大促'},
'Mercari 煤炉':{growth:'+12.7%',risk:'mid',shipping:'Mercari物流',entry:'个人/公司均可',priceRange:'¥500-30000',hotCats:['二手时尚','电子','收藏'],blueCats:['古着','潮玩'],founded:'2013',users:'2000万/月',payments:'信用卡/银行/便利店',events:'Mercari Fest'},
'Joom':{growth:'+15.2%',risk:'mid',shipping:'跨境直邮+海外仓',entry:'跨境卖家申请',priceRange:'$2-40',hotCats:['家居小商品','服饰','配饰'],blueCats:['汽配','工具'],founded:'2016',users:'3000万/月',payments:'银行卡/电子钱包',events:'Joom Sale, 黑五'},
'Rozetka':{growth:'+17.4%',risk:'low',shipping:'自建物流',entry:'需乌克兰公司',priceRange:'$5-300',hotCats:['电子','家电','家居'],blueCats:['智能设备','工具'],founded:'2005',users:'1500万/月',payments:'银行卡/电子钱包/COD',events:'Rozetka Days, Black Friday'},
'ASOS':{growth:'+9.8%',risk:'low',shipping:'自建物流',entry:'品牌/经销商入驻',priceRange:'£10-120',hotCats:['时尚服饰','鞋履','配饰'],blueCats:['大码','设计师'],founded:'2000',users:'2400万/月',payments:'信用卡/PayPal/Klarna',events:'ASOS Sale, 黑五'},
'Carrefour线上商城':{growth:'+13.5%',risk:'low',shipping:'门店自提+第三方',entry:'需本地公司',priceRange:'€5-200',hotCats:['食品','家居','电子'],blueCats:['生鲜','母婴'],founded:'1958(线上2009)',users:'3000万/月',payments:'信用卡/银行卡/COD',events:'Carrefour Days, Noël'},
'Target':{growth:'+7.9%',risk:'low',shipping:'自建物流',entry:'品牌入驻',priceRange:'$5-200',hotCats:['家居','服饰','电子'],blueCats:['母婴','宠物'],founded:'1962',users:'1.8亿/月',payments:'信用卡/Target RedCard/Apple Pay',events:'Target Deal Days, Black Friday'},
'Best Buy':{growth:'+6.1%',risk:'low',shipping:'自建物流',entry:'品牌入驻',priceRange:'$10-1500',hotCats:['电子','家电','游戏'],blueCats:['智能家居','配件'],founded:'1966',users:'1.2亿/月',payments:'信用卡/PayPal/分期',events:'Black Friday, Member Deals'},
'Instagram Shop / Facebook Shop':{growth:'+33.4%',risk:'mid',shipping:'商家自发+平台履约',entry:'无门槛(绑定主页)',priceRange:'$3-80',hotCats:['时尚','美妆','家居'],blueCats:['内容电商','达人'],founded:'2020(购物)',users:'20亿+触达',payments:'Meta Pay/信用卡',events:'社交大促, 节日季'},
'YouTube Shopping':{growth:'+41.2%',risk:'mid',shipping:'商家自发',entry:'需入驻 Shopping',priceRange:'$5-120',hotCats:['电子','美妆','服饰'],blueCats:['视频种草','测评'],founded:'2022(购物)',users:'25亿+触达',payments:'Google Pay/信用卡',events:'YouTube Sale'},
'Pinterest Shop':{growth:'+28.9%',risk:'low',shipping:'商家自发',entry:'需商家账号',priceRange:'$5-100',hotCats:['家居','婚嫁','时尚'],blueCats:['DIY','灵感'],founded:'2021(购物)',users:'4.5亿/月',payments:'信用卡/Pinterest Pay',events:'Pinterest PD, 节日季'},
'TikTok Shop':{growth:'+65.2%',risk:'mid',shipping:'跨境直邮+本土仓',entry:'跨境店可入驻',priceRange:'$3-30',hotCats:['美妆个护','服饰'],blueCats:['小家电','户外运动'],founded:'2021',users:'3.25亿/月',payments:'COD/电子钱包/信用卡',events:'9.9/11.11/12.12大促'},
'Amazon':{growth:'+9.5%',risk:'low',shipping:'FBA+FBM',entry:'跨境店可入驻',priceRange:'$10-100',hotCats:['电子','家居','美妆'],blueCats:['宠物','户外','健康'],founded:'1994',users:'3.1亿/月',payments:'信用卡/Amazon Pay/Afterpay',events:'Prime Day, Black Friday, Cyber Monday'},
'SHEIN Marketplace':{growth:'+42.6%',risk:'mid',shipping:'跨境直邮+海外仓',entry:'供应商/卖家入驻',priceRange:'$3-20',hotCats:['快时尚女装','配饰'],blueCats:['大码女装','家居装饰'],founded:'2008',users:'1.5亿/月',payments:'信用卡/PayPal/Afterpay',events:'SHEIN Sale, 黑五'},
'AliExpress 速卖通':{growth:'+14.7%',risk:'mid',shipping:'跨境直邮+海外仓',entry:'跨境卖家申请',priceRange:'$1-60',hotCats:['电子配件','服饰','家居'],blueCats:['汽配','工具'],founded:'2010',users:'2亿/月',payments:'信用卡/支付宝/PayPal',events:'828大促, 双11'},
'eBay':{growth:'+5.3%',risk:'low',shipping:'商家自发',entry:'全球卖家可入驻',priceRange:'$2-500',hotCats:['二手电子','收藏','时尚'],blueCats:['古着','汽配'],founded:'1995',users:'1.3亿/月',payments:'PayPal/信用卡/托管',events:'eBay Promo, Black Friday'},
'MercadoLibre 美客多':{growth:'+34.8%',risk:'low',shipping:'Mercado Envios物流',entry:'跨境店可入驻',priceRange:'$10-80',hotCats:['电子','家居','时尚'],blueCats:['汽摩配件','工具'],founded:'1999',users:'6500万/月',payments:'Mercado Pago/信用卡/COD',events:'Hot Sale, Cyber Monday拉美'},


};

// -- 动态加载平台数据 --
var JAY_SUPABASE_URL = 'https://ftlzofrnosgvdvwajhuz.supabase.co';
var JAY_SUPABASE_KEY = 'sb_publishable_y2zfDKmuW9Lj4gUqIYKpxw_COuX1JQQ';
// 提前初始化数据层基址，避免顶层 loadXxx() 调用时 JAY_API_URL 仍为 undefined（var 提升 bug 导致 Supabase 主路径失效，每次启动白费 4 次废请求）
var JAY_API_URL = JAY_SUPABASE_URL + '/rest/v1';
var JAY_ANON_KEY = JAY_SUPABASE_KEY;

async function loadPlatformData(){
  try{
    const base=document.querySelector('base')?document.querySelector('base').href:location.pathname.replace(/[^/]*$/,'');
    const url=base+'data/platforms.json';
    const data=await jayFetchMarketData('platforms', url);
    if(!data)throw new Error('Failed to load platform data');
    if(!Array.isArray(data)||!data.length)return;
    // Rebuild platformsData from JSON
    platformsData=data.map(d=>[d.name||'',d.region||'',d.categories||'',d.gmv||'',d.fee||'',d.feeDesc||'',d.type||'',d.mau||'',d.updates||'']);
    // Rebuild pfExtData from JSON
    var _pfStatic=pfExtData; pfExtData={}; Object.keys(_pfStatic||{}).forEach(function(k){ pfExtData[k]=_pfStatic[k]; });
    data.forEach(d=>{if(d.ext&&Object.keys(d.ext).length){pfExtData[d.name]=Object.assign({}, pfExtData[d.name]||{}, d.ext);}});
    // Repopulate filter selects
    fillSelect('#pf-f-region',[...new Set(platformsData.map(p=>p[1]))].sort());
    fillSelect('#pf-f-type',[...new Set(platformsData.map(p=>p[6]))].sort());
    // Re-render
    renderPlatforms();
    console.log('[JAY观海] Platform data loaded dynamically:',data.length,'platforms');
  }catch(e){
    console.log('[JAY观海] Using built-in platform data (dynamic load failed):',e.message);
  }
}
loadPlatformData();

const macroData=[
['全球','GDP增速(%)','3.2','0.1','2026-07-13','World Bank/IMF 2026'],
['全球','CPI通胀率(%)','4.5','-0.8','2026-07-13','World Bank/IMF 2026'],
['美国','GDP增速(%)','2.8','-0.3','2026-07-13','World Bank/IMF 2026'],
['美国','CPI通胀率(%)','3.2','-0.5','2026-07-13','World Bank/IMF 2026'],
['中国','GDP增速(%)','5','-0.2','2026-07-13','World Bank/IMF 2026'],
['中国','CPI通胀率(%)','0.3','-0.1','2026-07-13','World Bank/IMF 2026'],
['印尼','GDP增速(%)','5.1','0','2026-07-13','World Bank/IMF 2026'],
['印尼','CPI通胀率(%)','2.5','-0.5','2026-07-13','World Bank/IMF 2026'],
['泰国','GDP增速(%)','2.8','0.3','2026-07-13','World Bank/IMF 2026'],
['泰国','CPI通胀率(%)','1.2','-0.3','2026-07-13','World Bank/IMF 2026'],
['越南','GDP增速(%)','6.5','0.5','2026-07-13','World Bank/IMF 2026'],
['越南','CPI通胀率(%)','3.8','-0.2','2026-07-13','World Bank/IMF 2026'],
['马来西亚','GDP增速(%)','4.8','-0.2','2026-07-13','World Bank/IMF 2026'],
['马来西亚','CPI通胀率(%)','1.8','-0.7','2026-07-13','World Bank/IMF 2026'],
['菲律宾','GDP增速(%)','5.8','-0.2','2026-07-13','World Bank/IMF 2026'],
['菲律宾','CPI通胀率(%)','3.5','-1','2026-07-13','World Bank/IMF 2026'],
['沙特','GDP增速(%)','3.1','0.6','2026-07-13','World Bank/IMF 2026'],
['沙特','CPI通胀率(%)','2','-0.3','2026-07-13','World Bank/IMF 2026'],
['阿联酋','GDP增速(%)','3.8','0.3','2026-07-13','World Bank/IMF 2026'],
['阿联酋','CPI通胀率(%)','2.5','-0.2','2026-07-13','World Bank/IMF 2026'],
['巴西','GDP增速(%)','2.5','-0.3','2026-07-13','World Bank/IMF 2026'],
['巴西','CPI通胀率(%)','4.2','-0.8','2026-07-13','World Bank/IMF 2026'],
['墨西哥','GDP增速(%)','2.2','-0.3','2026-07-13','World Bank/IMF 2026'],
['墨西哥','CPI通胀率(%)','4.5','-1','2026-07-13','World Bank/IMF 2026'],
['日本','GDP增速(%)','1','-0.2','2026-07-13','World Bank/IMF 2026'],
['日本','CPI通胀率(%)','2.8','0.3','2026-07-13','World Bank/IMF 2026'],
['韩国','GDP增速(%)','2.2','0','2026-07-13','World Bank/IMF 2026'],
['韩国','CPI通胀率(%)','2.5','-0.5','2026-07-13','World Bank/IMF 2026'],
['德国','GDP增速(%)','0.2','0.1','2026-07-13','World Bank/IMF 2026'],
['德国','CPI通胀率(%)','2.3','-0.7','2026-07-13','World Bank/IMF 2026'],
['英国','GDP增速(%)','1.3','-0.2','2026-07-13','World Bank/IMF 2026'],
['英国','CPI通胀率(%)','3.5','-1','2026-07-13','World Bank/IMF 2026'],
['法国','GDP增速(%)','0.9','0','2026-07-13','World Bank/IMF 2026'],
['法国','CPI通胀率(%)','2.2','-0.5','2026-07-13','World Bank/IMF 2026'],
['印度','GDP增速(%)','6.8','-0.2','2026-07-13','World Bank/IMF 2026'],
['印度','CPI通胀率(%)','4.8','-0.4','2026-07-13','World Bank/IMF 2026'],
['尼日利亚','GDP增速(%)','3','0.2','2026-07-13','World Bank/IMF 2026'],
['尼日利亚','CPI通胀率(%)','33.7','-3.3','2026-07-13','World Bank/IMF 2026'],
['埃及','GDP增速(%)','4.2','0.5','2026-07-13','World Bank/IMF 2026'],
['埃及','CPI通胀率(%)','25','-7','2026-07-13','World Bank/IMF 2026'],
['南非','GDP增速(%)','1','0.2','2026-07-13','World Bank/IMF 2026'],
['南非','CPI通胀率(%)','5.2','-1','2026-07-13','World Bank/IMF 2026'],
['加拿大','GDP增速(%)','1.2','0.2','2026-07-13','World Bank/IMF 2026'],
['加拿大','CPI通胀率(%)','3.4','-0.5','2026-07-13','World Bank/IMF 2026'],
['俄罗斯','GDP增速(%)','1.8','0.3','2026-07-13','World Bank/IMF 2026'],
['俄罗斯','CPI通胀率(%)','7.8','-1.2','2026-07-13','World Bank/IMF 2026'],
['意大利','GDP增速(%)','0.7','0.1','2026-07-13','World Bank/IMF 2026'],
['意大利','CPI通胀率(%)','1.1','-0.2','2026-07-13','World Bank/IMF 2026'],
['西班牙','GDP增速(%)','2.5','0.4','2026-07-13','World Bank/IMF 2026'],
['西班牙','CPI通胀率(%)','3.2','-0.6','2026-07-13','World Bank/IMF 2026'],
['荷兰','GDP增速(%)','1.0','0.2','2026-07-13','World Bank/IMF 2026'],
['荷兰','CPI通胀率(%)','3.3','-0.4','2026-07-13','World Bank/IMF 2026'],
['澳大利亚','GDP增速(%)','1.8','0.3','2026-07-13','World Bank/IMF 2026'],
['澳大利亚','CPI通胀率(%)','3.5','-0.7','2026-07-13','World Bank/IMF 2026'],
['新加坡','GDP增速(%)','2.5','0.3','2026-07-13','World Bank/IMF 2026'],
['新加坡','CPI通胀率(%)','2.8','-0.3','2026-07-13','World Bank/IMF 2026']];
const policyData=[
['对华301关税大幅提升','美国','2026-07-13','重大','[USTR官网](http://USTR官网)','已确认','','','2026年对华关税提升至145%，覆盖电子、纺织、日用品等品类，部分商品加征25%附加税'],
['TikTok Shop合规审查','美国','2026-07-13','重大','[CPSC/USTR](http://CPSC/USTR)','已确认','','','加强跨境电商平台商品安全审查，要求提供CPSC认证、FDA注册等合规文件'],
['进口商品免税门槛取消','印尼','2026-07-13','重大','[印尼财政部](http://印尼财政部)','已确认','','','取消150美元以下进口商品免税政策，所有跨境电商商品均需缴纳进口税'],
['SNI强制认证扩展','印尼','2026-07-13','重大','[BSN印尼标准局](http://BSN印尼标准局)','已确认','','','扩大SNI强制认证品类至家电、玩具、建材等35类产品，未获认证不得进口'],
['跨境电商税务新规','越南','2026-07-13','重大','[越南税务总局](http://越南税务总局)','已确认','','','外国电商平台需在越南注册并缴纳增值税，税率10%，平台代扣代缴'],
['电子发票强制要求','越南','2026-07-13','中等','[越南财政部](http://越南财政部)','已确认','','','所有电商交易必须开具电子发票(e-invoice)，与税务系统实时对接'],
['VAT电商免税门槛调整','泰国','2026-07-13','中等','[泰国税务局](http://泰国税务局)','已确认','','','调整VAT 7%低税率适用范围，跨境电商平台年收入超180万泰铢须强制注册VAT'],
['进口商品TISI认证加强','泰国','2026-07-13','中等','[TISI泰国工业标准局](http://TISI泰国工业标准局)','已确认','','','扩展TISI强制认证品类，电子产品、建材、日用品需取得泰国工业标准认证'],
['跨境电商所得税新规','马来西亚','2026-07-13','中等','[马来西亚税务局](http://马来西亚税务局)','已确认','','','外国数字服务商须就马来西亚数字服务收入缴纳所得税，税率6%'],
['VAT 15%实施','沙特','2026-07-13','中等','[ZATCA沙特税务局](http://ZATCA沙特税务局)','已确认','','','维持15%增值税率，跨境电商平台须代扣代缴VAT，注册阈值降低'],
['SABER认证强制实施','沙特','2026-07-13','重大','[SASO沙特标准局](http://SASO沙特标准局)','已确认','','','所有进口消费品须通过SABER平台注册并获得产品合规证书(PCoC)'],
['VAT 5%及电商监管加强','阿联酋','2026-07-13','中等','[FTA阿联酋联邦税务局](http://FTA阿联酋联邦税务局)','已确认','','','维持5%增值税率，加强跨境电商税务合规监管，平台代扣代缴义务扩大'],
['进口商品ESMA标准加强','阿联酋','2026-07-13','中等','[ESMA阿联酋标准局](http://ESMA阿联酋标准局)','已确认','','','扩大ESMA强制标准品类，消费电子产品、化妆品须符合阿联酋合格评定'],
['Remessa Conforme进口税计划','巴西','2026-07-13','重大','[巴西联邦税务局](http://巴西联邦税务局)','已确认','','','50美元以下进口商品征收20%进口税，50美元以上征收60%进口税+ICMS税'],
['电商数字税征收','巴西','2026-07-13','中等','[巴西联邦税务局](http://巴西联邦税务局)','已确认','','','对跨境电商服务征收数字税，外国平台需在巴西注册税务代表'],
['数字服务法DSA全面执行','德国','2026-07-13','重大','[欧盟委员会](http://欧盟委员会)','已确认','','','欧盟DSA全面适用于在线平台和搜索引擎，要求内容审核透明度、算法可解释性'],
['GPSR通用产品安全法规','法国','2026-07-13','重大','[欧盟官方公报](http://欧盟官方公报)','已确认','','','欧盟GPSR新规要求所有消费品须有欧盟境内负责人、产品安全风险评估及召回机制'],
['数字服务法DSA法国执行','法国','2026-07-13','中等','[法国ARCOM](http://法国ARCOM)','已确认','','','法国落实DSA法规，要求平台建立非法内容通知机制、年度透明度报告'],
['FDI外资限制加强','印度','2026-07-13','重大','[印度DPIIT](http://印度DPIIT)','已确认','','','限制邻国资本投资电商企业，要求外资电商不得持有库存、须走平台模式'],
['BIS强制认证扩展','印度','2026-07-13','重大','[BIS印度标准局](http://BIS印度标准局)','已确认','','','扩展BIS强制注册品类至IT设备、LED灯具、电池等电子产品，未认证禁止进口'],
['进口许可与NIMP合规','尼日利亚','2026-07-13','重大','[SON尼日利亚标准局](http://SON尼日利亚标准局)','已确认','','','实施新的进口许可制度，所有进口商品须取得SON产品认证、Form M进口许可'],
['外汇管制与进口付汇限制','尼日利亚','2026-07-13','重大','[CBN尼日利亚央行](http://CBN尼日利亚央行)','已确认','','','加强外汇管制，进口付汇需通过官方渠道、限制并行汇率交易'],
['ACID预登记系统升级','埃及','2026-07-13','重大','[埃及贸易监管总局](http://埃及贸易监管总局)','已确认','','','升级Advance Cargo Information Declaration(ACID)系统，所有进口货物须提前在CargoX平台注册'],
['进口关税调整与本地化要求','南非','2026-07-13','中等','[SARS南非税务局](http://SARS南非税务局)','已确认','','','调整部分消费品进口关税，提高纺织品、电子配件关税，鼓励本地化生产']];
const plExtData=[
{type:'关税调整',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'电子,纺织,日用品',platforms:'全平台',countdown:0,affectedShops:'跨境店',costImpact:'+25-145%关税',detail:'美国贸易代表办公室(USTR)宣布对华301关税大幅提升，覆盖电子、纺织、日用品等品类，部分商品加征25%附加税。跨境卖家需重新核算成本，考虑提价或转移供应链。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-07-01',impact:'negative',categories:'全品类',platforms:'TikTok Shop/Amazon',countdown:0,affectedShops:'跨境店+本土店',costImpact:'合规成本+$5,000-20,000',detail:'CPSC和USTR加强跨境电商商品安全审查，要求提供CPS认证、FDA注册等合规文件。卖家需提前准备产品检测报告和认证资质。'},
{type:'关税调整',status:'已生效',effectiveDate:'2026-04-01',impact:'negative',categories:'全品类',platforms:'TikTok Shop/Shopee/全平台',countdown:0,affectedShops:'跨境店',costImpact:'+10-20%税费',detail:'印尼财政部取消150美元以下进口商品免税政策，所有跨境电商商品均需缴纳进口税。直接冲击低价商品利润空间。'},
{type:'进口认证',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'家电,玩具,建材',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'认证费$3,000-10,000/SKU',detail:'BSN扩大SNI强制认证品类至35类，未获认证不得进口。卖家需提前6个月申请认证，预留充足时间。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'全品类',platforms:'TikTok Shop/Shopee/Tokopedia',countdown:0,affectedShops:'跨境店',costImpact:'资质审核+合规成本',detail:'印尼贸易部要求所有外国电商卖家必须注册本地PT公司，持有NITPPK许可证。未合规卖家将被封店。'},
{type:'进出口禁令',status:'已生效',effectiveDate:'2026-06-01',impact:'negative',categories:'美妆,食品,药品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'BPOM认证费+$2,000-8,000',detail:'BPOM加强进口化妆品和食品审查，要求全成分披露和本地测试报告。审批周期延长至3-6个月。'},
{type:'税务新规',status:'已生效',effectiveDate:'2026-04-01',impact:'negative',categories:'全品类',platforms:'TikTok Shop/全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'11% VAT',detail:'印尼对所有数字产品和服务征收11%增值税，跨境电商平台需代扣代缴。卖家需将税费计入定价。'},
{type:'进口认证',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'食品,保健品,化妆品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'认证费$2,000-5,000',detail:'JAKIM更新清真认证标准，进口食品和化妆品必须持有有效清真证书。审批周期2-4个月。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-04-01',impact:'negative',categories:'服饰,美妆,电子',platforms:'TikTok Shop/Shopee/Lazada',countdown:0,affectedShops:'跨境店',costImpact:'需本土仓+本地公司',detail:'泰国要求跨境电商平台对进口商品承担连带责任，低价商品需缴纳7%增值税。跨境卖家需设立本地实体。'},
{type:'进出口禁令',status:'已生效',effectiveDate:'2026-05-01',impact:'negative',categories:'低于$3商品',platforms:'全平台',countdown:0,affectedShops:'跨境店',costImpact:'低价商品利润清零',detail:'东南亚多国禁止进口低价免税商品（低于$3），直接打击极低价跨境包裹模式。卖家需提价或转本土仓。'},
{type:'关税调整',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'电子,汽车,奢侈品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'+10-30%关税',detail:'越南调整进口关税结构，对电子产品和汽车零配件加征高额关税。同时更新海关估价方法。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-07-01',impact:'negative',categories:'服饰,美妆,电子',platforms:'Shopee/TikTok Shop',countdown:0,affectedShops:'跨境店',costImpact:'需本土公司注册',detail:'越南要求外国电商卖家必须在当地注册公司或通过本地代理运营，加强对外国卖家的监管。'},
{type:'进出口禁令',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'电子废弃物,塑料制品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'合规成本+$1,000-3,000',detail:'越南环保部禁止进口电子废弃物和一次性塑料制品，加强进口商品环保合规审查。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'全品类',platforms:'Amazon/Mercado Libre/Shopee',countdown:0,affectedShops:'跨境店+本土店',costImpact:'RFC税号+合规成本',detail:'墨西哥要求所有跨境电商卖家必须注册RFC税号，平台代扣16%IVA增值税。未注册卖家将被限制销售。'},
{type:'关税调整',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'纺织,鞋类,玩具',platforms:'全平台',countdown:0,affectedShops:'跨境店',costImpact:'+16-35%关税',detail:'巴西对部分进口商品加征关税，纺织和鞋类产品关税高达35%。跨境卖家需评估成本承受能力。'},
{type:'进口认证',status:'已生效',effectiveDate:'2026-06-01',impact:'negative',categories:'电子,家电,医疗器械',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'认证费$5,000-15,000',detail:'沙特SASO加强进口产品安全认证，电子和家电产品需通过IECEE认证和能效标签。审批周期1-3个月。'},
{type:'进口认证',status:'已生效',effectiveDate:'2026-06-01',impact:'negative',categories:'食品,化妆品,药品',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'认证费$3,000-8,000',detail:'沙特SFDA加强进口食品和化妆品审查，要求阿拉伯语标签和本地检测报告。审批周期3-6个月。'},
{type:'税务新规',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'全品类',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'15%最低税',detail:'中东六国实施15%最低企业税率，跨境电商平台需按新标准缴税。卖家需重新规划税务结构。'},
{type:'关税调整',status:'已生效',effectiveDate:'2026-07-01',impact:'negative',categories:'纺织,皮革,化工',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'+10-25%关税',detail:'土耳其对进口纺织品加征额外关税，保护本土纺织产业。跨境卖家需考虑本土化生产或寻找替代市场。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'全品类',platforms:'Trendyol/Hepsiburada/全平台',countdown:0,affectedShops:'跨境店',costImpact:'需土耳其公司',detail:'土耳其要求外国电商卖家必须通过本地公司运营，平台需代扣预提税。未合规卖家将被清退。'},
{type:'进口认证',status:'已生效',effectiveDate:'2026-04-01',impact:'negative',categories:'电子,玩具,建材',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'EAC认证费$2,000-6,000',detail:'俄罗斯/独联体扩大EAC强制认证品类，电子和玩具产品必须通过EAC认证方可进口。'},
{type:'关税调整',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'奢侈品,电子,汽车',platforms:'全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'+5-15%关税',detail:'欧盟对部分进口商品调整关税结构，加强对低价包裹的关税征收。同时推进碳边境调节机制。'},
{type:'电商合规',status:'已生效',effectiveDate:'2026-01-01',impact:'negative',categories:'全品类',platforms:'Amazon/eBay/全平台',countdown:0,affectedShops:'跨境店+本土店',costImpact:'GPSR合规成本',detail:'欧盟通用产品安全法规(GPSR)生效，要求所有产品在欧盟境内有指定负责人。跨境卖家需指定欧盟授权代表。'},
{type:'进出口禁令',status:'征求意见稿',effectiveDate:'2026-10-01',impact:'negative',categories:'全品类',platforms:'全平台',countdown:78,affectedShops:'跨境店',costImpact:'低价商品受限',detail:'欧盟拟取消150欧元以下包裹免税政策，所有进口商品均需缴纳关税。预计10月生效，跨境低价模式将受重大冲击。'}
];

const rulesData=[
['TikTok Shop东南亚','佣金调整','其他','2026-01-01','东南亚','佣金从1%上调至2.5%，同时收取交易手续费0.5%','建议调整定价模型消化成本'],
['TikTok Shop东南亚','物流新规','其他','2026-03-01','东南亚','强制使用平台物流TikTok Shipping，72小时内必须发出','对接平台物流或更换服务商'],
['Shopee东南亚','佣金调整','美妆个护','2026-02-15','东南亚','美妆品类佣金从3%调至4.5%','优化SKU组合，减少低毛利产品'],
['Shopee东南亚','类目限制','3C数码','2026-04-01','东南亚','电子产品需提交SIR证书','提前办理认证'],
['Lazada东南亚','扣分政策','其他','2026-01-15','东南亚','虚假发货扣分从3分调至6分','确保真实物流单号'],
['TikTok Shop印尼','类目限制','食品饮料','2026-02-01','东南亚','要求BPOM注册证和本地生产许可','寻找本地代工厂合作'],
['Noon中东','佣金调整','美妆个护','2026-01-01','中东','美妆品类佣金上调至15%','提升客单价弥补成本'],
['TikTok Shop沙特','物流新规','其他','2026-03-15','中东','强制使用平台指定物流，COD必须对接平台回款','切换至平台物流方案'],
['Noon中东','类目限制','母婴用品','2026-05-01','中东','需提交SFDA注册和GCC认证','提前准备认证材料'],
['Amazon北美','佣金调整','服饰鞋包','2026-02-01','北美','服装品类佣金从15%调至17%','优化FBA库存降低仓储成本'],
['Temu北美','其他','其他','2026-04-01','北美','半托管模式升级，卖家需承担尾程物流','评估自建物流成本'],
['SHEIN北美','扣分政策','其他','2026-01-01','北美','质量投诉率超3%触发下架处罚','加强质检流程'],
['Amazon北美','物流新规','家居家装','2026-06-01','北美','大件商品FBA费用上调$2-5/件','考虑FBM或第三方仓'],
['Amazon欧洲','其他','其他','2026-01-01','欧洲','GPSR新规要求所有产品提供欧盟授权代表信息','尽快注册欧盟负责人'],
['TikTok Shop英国','佣金调整','美妆个护','2026-03-01','欧洲','佣金从5%上调至7.5%','调整定价策略'],
['MercadoLibre拉美','佣金调整','3C数码','2026-02-01','拉美','电子产品佣金从11%调至13.5%','提升配件搭售率'],
['Shopee巴西','物流新规','其他','2026-04-15','拉美','强制使用MercadoEnvios物流','对接平台物流系统'],
['Amazon印度','类目限制','食品饮料','2026-01-01','南亚','FSSAI许可要求提高','确保食品资质完备'],
['Jumia非洲','佣金调整','其他','2026-03-01','非洲','平台佣金统一上调1.5个百分点','优化运营成本'],
['TikTok Shop东南亚','扣分政策','美妆个护','2026-05-01','东南亚','虚假宣传扣分翻倍（3→6分）','严格审核产品描述'],
['Shopee东南亚','其他','其他','2026-06-01','东南亚','大促期间强制参加平台满减活动','提前规划促销预算'],
['Lazada东南亚','物流新规','其他','2026-07-01','东南亚','跨境商品需通过LGS仓质检','备货时预留质检时间'],
['TikTok Shop中东','其他','其他','2026-06-15','中东','阿拉伯语产品描述强制要求','补充阿语翻译'],
['Amazon北美','其他','其他','2026-05-15','北美','品牌注册要求提高，需美国商标或EUIPO','提前注册商标'],
['Noon中东','物流新规','其他','2026-07-01','中东','48小时发货时效从全品类扩展到电子产品','确保库存充足']];

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

const contentData=[
['这个身体乳让我白了一个度！','TikTok','东南亚','短视频','185','2800','2026-07-13','@BeautyVibe_TH','美白身体乳','8.5','美妆个护','前后对比','125万','GLOW LAB Official','爆发'],
['夏日防晒不踩雷 TOP5','TikTok','东南亚','商品测评','92','1500','2026-07-13','@SkincareGuru_ID','防晒喷雾套装','6.2','美妆个护','开箱测评','82万','Eiger Official','平稳'],
['10万印尼盾搞定全身穿搭','Shopee Video','东南亚','短视频','55','850','2026-07-13','@FashionHacks_PH','冰丝T恤+短裤套装','12','时尚服饰','场景使用','45万','Beauty Store BR','平稳'],
['蓝牙耳机横评 谁才是性价比之王','YouTube','东南亚','商品测评','18','320','2026-07-13','@TechReview_VN','无线蓝牙耳机','4.5','3C数码','开箱测评','28万','Xiaomi Official','衰退'],
['直播开箱宠物神器','TikTok','东南亚','直播','38','500','2026-07-13','@PetLover_MY','宠物自动喂食器','15','宠物用品','场景使用','65万','Pet Paradise','爆发'],
['迪拜贵妇同款香水开箱','TikTok','中东','开箱视频','120','1800','2026-07-13','@LuxuryDubai','香水套装礼盒','9.2','美妆个护','开箱测评','380万','GlamAR Beauty','爆发'],
['斋月穿搭灵感30套','Instagram','中东','短视频','68','950','2026-07-13','@ModestFashion_SA','阿拉伯连衣裙','5.8','时尚服饰','场景使用','210万','Carrefour UAE','平稳'],
['夏季车载好物推荐','TikTok','中东','短视频','150','2200','2026-07-13','@CarTips_AE','汽车遮阳帘','11','汽车配件','前后对比','95万','AutoPro Accessories','爆发'],
['智能手表深度测评','YouTube','中东','商品测评','25','480','2026-07-13','@GadgetReview_SA','智能手表','3.8','3C数码','开箱测评','52万','TechZone MX','衰退'],
['LED灯带改造出租屋','TikTok','欧美','短视频','280','3500','2026-07-13','@HomeMakeover_US','LED智能灯带','7.5','家居家装','前后对比','520万','Govee US','爆发'],
['瑜伽裤真的值这个价吗？','YouTube','欧美','商品测评','42','680','2026-07-13','@FitnessReview_UK','瑜伽裤套装','5.2','运动户外','开箱测评','38万','Bissell','平稳'],
['露营装备开箱 性价比爆表','TikTok','欧美','开箱视频','85','1200','2026-07-13','@OutdoorLife_US','露营折叠椅','6.8','运动户外','开箱测评','180万','Poolhacker','平稳'],
['男士理发器 在家也能剪出理发店效果','TikTok','欧美','短视频','135','2000','2026-07-13','@BarberLife_US','男士理发器','9.8','美妆个护','场景使用','290万','BARBERX','爆发'],
['我的宠物度过了最凉爽的夏天','Instagram','欧美','短视频','62','900','2026-07-13','@PetParent_UK','宠物冰垫','7.2','宠物用品','场景使用','75万','Pet Paradise','平稳'],
['假睫毛教程 新手也能学会','TikTok','拉美','短视频','110','1600','2026-07-13','@BeautyBR','假睫毛套装','12.5','美妆个护','剧情种草','160万','Beauty Store BR','爆发'],
['蓝牙音箱音质实测','YouTube','拉美','商品测评','22','380','2026-07-13','@TechReview_MX','蓝牙音箱','4','3C数码','开箱测评','32万','TechZone MX','衰退'],
['手机壳合集 每月换新不心疼','TikTok','拉美','短视频','48','750','2026-07-13','@PhoneStyle_BR','手机壳潮款','8.5','3C数码','场景使用','58万','Moda Latina','平稳'],
['7天美白挑战 面膜实测','TikTok','日韩','短视频','170','2500','2026-07-13','@BeautyJP','美白面膜','6.5','美妆个护','前后对比','420万','COSME Kitchen','爆发'],
['空气炸锅必买配件','Instagram','日韩','短视频','45','680','2026-07-13','@KitchenLife_KR','空气炸锅配件','9','家居厨房','场景使用','88万','Kitchen Korea','平稳'],
['韩系发饰 一秒变甜妹','TikTok','日韩','短视频','98','1500','2026-07-13','@HairStyle_KR','韩系发饰套装','7.8','饰品配件','场景使用','135万','Hair Pin Studio','平稳'],
['夏季男装穿搭指南','Instagram','南亚','短视频','28','420','2026-07-13','@MensStyle_IN','男士Polo衫','5.5','时尚服饰','场景使用','42万','MensStyle India','衰退'],
['手机快充头横评 10分钟充满','YouTube','南亚','商品测评','35','580','2026-07-13','@TechIndia','手机快充头','4.8','3C数码','开箱测评','55万','FastCharge Tech','平稳'],
['停电不愁 太阳能充电板实测','TikTok','非洲','短视频','22','350','2026-07-13','@TechNaija','太阳能充电板','10','家居家电','场景使用','28万','SolarTech Africa','爆发'],
['假发合集 每天不重样','TikTok','非洲','短视频','82','1200','2026-07-13','@HairQueen_NG','假发套装','8','美妆个护','场景使用','92万','AfroHair Queen','平稳'],
['直播间秒杀 50元好物合集','Shopee Video','东南亚','直播','18','280','2026-07-13','@LiveDeals_TH','多品类好物','18','日用百货','剧情种草','35万','Dazzle Me Official','平稳'],
['Medicube胶原蛋白眼膜7天使用对比','TikTok','欧美','商品测评','186','2850','2026-07-13','@BeautyGuru_Maya','Medicube胶原蛋白眼膜','8.5','美妆个护','前后对比','680万','Medicube Official','爆发'],
['Amazon Prime Day美妆必买清单2026','YouTube','欧美','短视频','92','1520','2026-07-12','@SkincareWithLisa','Tarte睫毛膏/Sol de Janeiro香水','5.2','美妆个护','场景使用','245万','medicube Official','爆发'],
['Shopee印尼平价定妆喷雾横评TOP5','Shopee Video','东南亚','商品测评','45','860','2026-07-11','@KBeauty_ID','Dazzle Me/Pramy/Sea Makeup定妆喷雾','12.3','美妆个护','开箱测评','78万','Dazzle Me Official','爆发'],
['Poolhacker泳池喷泉安装前后对比','TikTok','欧美','短视频','38','520','2026-07-10','@SummerVibes2026','Poolhacker泳池双头喷泉支架','6.8','运动户外','前后对比','15万','Poolhacker','爆发'],
['Gen Z大花朵胸针DIY穿搭教程','Instagram','欧美','短视频','52','340','2026-07-10','@FashionForward_Zoe','Tory Burch花朵背心/Aje花胸针','3.1','时尚服饰','剧情种草','92万','CIDER','平稳'],
['EMS美容仪30天挑战效果记录','TikTok','东南亚','商品测评','41','680','2026-07-09','@ThaiBeautyReview','ANLAN 8合1面部EMS美容仪','7.5','美妆个护','前后对比','56万','MS Glow','平稳'],
['Kendall Jenner同款Anua护肤开箱','Instagram','欧美','开箱视频','68','420','2026-07-11','@KstyleDaily','Anua精华液','4.8','美妆个护','开箱测评','185万','Toplux Nutrition Official','平稳']
];


// === 安全工具函数（XSS 防护） ===
// 转义纯文本用于插入 innerHTML（防御 <script>、<img onerror> 等）
function escapeHtml(s){
  if(s===null||s===undefined)return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
// ============ 前端健壮性基础工具 ============
// 防抖：避免输入时高频重渲染
function jayDebounce(fn,wait){
  var t;
  return function(){
    var ctx=this, args=arguments;
    if(t)clearTimeout(t);
    t=setTimeout(function(){ fn.apply(ctx,args); }, wait||250);
  };
}
var _jayDebCache={};
function jayDeb(name){
  if(!_jayDebCache[name]){
    _jayDebCache[name]=jayDebounce(function(){ if(typeof window[name]==='function') window[name](); },250);
  }
  return _jayDebCache[name];
}
// 轻量 HTML 净化：仅允许基础内联标签，剥离 script/style/iframe/事件属性/javascript: 协议
function jaySanitize(html){
  if(typeof html!=='string')return '';
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\s*\1\s*>/gi,'')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi,'')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi,'$1="#"');
}
// 去重绑定：同一元素同类型事件只绑一次，防止重复绑定泄漏
var _jayBound={};
function jayOn(el,type,handler,key){
  if(!el||!el.addEventListener)return;
  var k=key||(type+'>'+(el.id||el.className||''));
  if(_jayBound[k])return;
  _jayBound[k]=true;
  el.addEventListener(type,handler);
}
// ============ 转义用于内联 onclick 属性的 JS 字符串字面量：先 JS 转义再 HTML 属性转义
// 防止动态数据（政策标题/店铺名/品类名）突破属性边界执行注入脚本
function escInline(s){
  if(s===null||s===undefined)return '';
  var js = String(s)
    .replace(/\\/g,'\\\\')
    .replace(/'/g,"\\'")
    .replace(/"/g,'\\"')
    .replace(/[\n\r\t]/g,' ');
  return escapeHtml(js);
}

// === 工具函数 ===
const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);

// Wave2/Wave3 所需函数前置定义（避免在 IIFE 后续渲染中引用未定义）
function jayFmtCount(n){
  n = parseFloat(String(n).replace(/[^0-9.]/g,''));
  if(!isFinite(n)) return '-';
  if(n >= 10000){
    var wan = n/10000;
    return (wan>=100? Math.round(wan) : (Math.round(wan*10)/10)) + '万';
  }
  return String(Math.round(n));
}
function pfLogoColor(name){
  var colors=['#ee4d2d','#f60','#ff6a00','#167ee6','#00b388','#a435f0','#ff1900','#5b8def','#ff5a5f','#00a699','#e21b70','#ffb400','#111'];
  var h=0; for(var i=0;i<name.length;i++){h=(h*31+name.charCodeAt(i))>>>0;}
  return colors[h%colors.length];
}
function jayTraceLink(link){
  if(!link) return;
  var l = String(link);
  if(l.indexOf('赛道')>=0 || l.indexOf('分析')>=0){ switchPage('products'); return; }
  if(l.indexOf('Shopee')>=0||l.indexOf('TikTok')>=0||l.indexOf('Lazada')>=0||l.indexOf('Amazon')>=0||l.indexOf('Official')>=0){ switchPage('shops'); return; }
  toast('正在跳转到: '+l);
}

// === 原有渲染 ===
// [Overview rework: country grid moved to new renderer below]

function alertMarkup(full=false){return alerts.map(a=>`<div class="alert-item"><i class="alert-dot" style="background:${a[0]}"></i><div><p><b>${a[1]}</b> · ${a[2]}</p><small>${full?'已由政策与市场监测引擎确认':'实时信号'}</small></div><time>${a[3]}</time></div>`).join('')};// [Overview rework: alert-list removed, alerts-full kept]$('#alerts-full').innerHTML=`<article class="panel">${alertMarkup(true)}</article>`;
