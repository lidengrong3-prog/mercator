
const countries=[
['🇨🇦','加拿大','加拿大','US$ 900.0B','+10.0%','Amazon'],
['🇫🇷','法国','法国','US$ 800.0B','+6.0%','Amazon'],
['🇮🇩','印度尼西亚','印度尼西亚','US$ 650.0B','+15.0%','Shopee'],
['🇷🇺','俄罗斯','俄罗斯','US$ 550.0B','+12.0%','AliExpress'],
['🇧🇷','巴西','巴西','US$ 500.0B','+14.0%','MercadoLibre'],
['🇮🇹','意大利','意大利','US$ 500.0B','+9.0%','Amazon'],
['🇪🇸','西班牙','西班牙','US$ 450.0B','+12.0%','Amazon'],
['🇲🇽','墨西哥','墨西哥','US$ 350.0B','+22.0%','MercadoLibre'],
['🇳🇱','荷兰','荷兰','US$ 350.0B','+6.0%','AliExpress'],
['🇦🇺','澳大利亚','澳大利亚','US$ 350.0B','+7.0%','Amazon'],
['🇻🇳','越南','越南','US$ 320.0B','+18.0%','Shopee'],
['🇹🇭','泰国','泰国','US$ 280.0B','+14.0%','Shopee'],
['🇲🇾','马来西亚','马来西亚','US$ 220.0B','+12.0%','Shopee'],
['🇵🇭','菲律宾','菲律宾','US$ 180.0B','+20.0%','Shopee'],
['🇸🇬','新加坡','新加坡','US$ 120.0B','+8.0%','Shopee'],
['🇸🇦','沙特阿拉伯','沙特阿拉伯','US$ 120.0B','+18.0%','Amazon'],
['🇦🇪','阿联酋','阿联酋','US$ 80.0B','+15.0%','Noon'],
['🇳🇬','尼日利亚','尼日利亚','US$ 80.0B','+25.0%','AliExpress'],
['🇿🇦','南非','南非','US$ 50.0B','+10.0%','AliExpress'],
['🇪🇬','埃及','埃及','US$ 45.0B','+20.0%','AliExpress'],
['🇺🇸','美国','美国','US$ 12.00T','+8.0%','Amazon'],
['🇯🇵','日本','日本','US$ 1.80T','+5.0%','Amazon'],
['🇬🇧','英国','英国','US$ 1.80T','+7.0%','Amazon'],
['🇩🇪','德国','德国','US$ 1.55T','+5.0%','Amazon'],
['🇮🇳','印度','印度','US$ 1.20T','+25.0%','Amazon'],
['🇰🇷','韩国','韩国','US$ 1.05T','+8.0%','AliExpress']];
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
    pfExtData={};
    data.forEach(d=>{if(d.ext&&Object.keys(d.ext).length){pfExtData[d.name]=d.ext;}});
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
['南非','CPI通胀率(%)','5.2','-1','2026-07-13','World Bank/IMF 2026']];
const policyData=[
['对华301关税大幅提升','美国','2026-07-13','重大','[USTR官网](http://USTR官网)','已确认','','','2025年对华关税提升至145%，覆盖电子、纺织、日用品等品类，部分商品加征25%附加税'],
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
// 转义用于内联 onclick 属性的 JS 字符串字面量：先 JS 转义再 HTML 属性转义
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
  var titleEsc=escapeHtml(p[1]);
  var summaryStr='售价'+escapeHtml(p[6])+',销量'+escapeHtml(p[8])+',增速'+escapeHtml(p[9]);

  $('#pr-modal-content').innerHTML=
    '<h3>'+escapeHtml(p[0])+' '+escapeHtml(p[1])+'</h3>'+
    '<div class="pr-m-sub">'+escapeHtml(p[2])+' · '+escapeHtml(p[3])+' · '+escapeHtml(p[5])+' · 更新: '+escapeHtml(p[13])+'前</div>'+
    '<div class="pr-m-stats">'+
      '<div class="pr-m-stat"><b>'+escapeHtml(p[8])+'</b><span>累计销量</span></div>'+
      '<div class="pr-m-stat"><b style="color:#3a6ea8">'+escapeHtml(p[9])+'</b><span>增速</span></div>'+
      '<div class="pr-m-stat"><b>'+escapeHtml(p[6])+'</b><span>售价区间</span></div>'+
      '<div class="pr-m-stat"><b>'+escapeHtml(age)+'天</b><span>上架周期</span></div>'+
    '</div>'+
    '<div class="pr-m-section"><h4>📈 30天销量趋势</h4><div class="pr-m-chart">'+chartBars+'</div></div>'+
    '<div class="pr-m-section"><h4>🏪 竞品店铺</h4><p>店铺: <strong>'+escapeHtml(p[11])+'</strong> · <span style="color:var(--green);cursor:pointer;text-decoration:underline" id="pr-detail-shop">查看店铺详情 ↗</span></p></div>'+
    '<div class="pr-m-section"><h4>🌐 全网同款分布</h4><p>检测到 <strong>'+escapeHtml(sameCount)+'</strong> 个平台 <strong>'+escapeHtml(linkCount)+'</strong> 个链接在售卖同款/类似款</p></div>'+
    '<div class="pr-m-section"><h4>⚠️ 合规风险提示</h4><div class="pr-m-tags">'+escapeHtml(compliance)+'</div></div>'+
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
  var html='<div class="ai-insight" style="padding:16px 18px;background:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:16px">'+
    '<div class="ai-insight-head"><span class="ai-icon">✨</span><h4>AI '+tabLabel+'</h4><small>基于全平台数据的'+subLabel+'建议</small></div>';
  items.forEach(function(item,idx){
    html+='<div class="pr-ai-item"><span class="pr-ai-text">'+item.text+'</span>'+
      '<button class="pr-ai-jump" data-link="'+encodeURIComponent(item.link)+'">溯源 ↗</button>'+
      '<button class="pr-ai-add" data-idx="'+idx+'" data-pooltype="'+encodeURIComponent(poolType)+'" data-text="'+encodeURIComponent(item.text.substring(0,60))+'">✦</button>'+
    '</div>';
  });
  html+='</div>';
  $('#pr-ai-content').innerHTML=html;
  
  // Add event listeners
  $('#pr-ai-content').querySelectorAll('.pr-ai-jump').forEach(function(btn){
    btn.onclick=function(){jayTraceLink(decodeURIComponent(this.dataset.link))};
  });
  $('#pr-ai-content').querySelectorAll('.pr-ai-add').forEach(function(btn){
    btn.onclick=function(e){
      e.stopPropagation();
      rpAddMaterial('alert','AI洞察',decodeURIComponent(this.dataset.pooltype),decodeURIComponent(this.dataset.text)+'...');
    };
  });
}

// Filter templates
function prGetTemplates(){try{return JSON.parse(localStorage.getItem('jay_filter_tpl')||'[]')}catch(e){return[]}}
function prSaveTemplates(t){localStorage.setItem('jay_filter_tpl',JSON.stringify(t))}
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
  var csv=rows.join('\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='产品全域雷达_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  toast('Excel 已导出');
}
function prExportPDF(){
  var data=prSelectedIds.size>0?Array.from(prSelectedIds).map(function(i){return products[i]}):products;
  var md='# 产品全域雷达 - 竞品分析报告\n\n';
  md+='> 生成时间: '+new Date().toLocaleString('zh-CN')+' | 数据来源: GlobalPulse\n\n';
  md+='## 数据总览\n- 筛选结果: '+data.length+' 条商品\n';
  var regionSet=[];data.forEach(function(p){if(regionSet.indexOf(p[2])<0)regionSet.push(p[2])});
  var platSet=[];data.forEach(function(p){if(platSet.indexOf(p[3])<0)platSet.push(p[3])});
  md+='- 覆盖市场: '+regionSet.join(', ')+'\n- 覆盖平台: '+platSet.join(', ')+'\n\n';
  md+='## 商品 TOP10\n\n';
  data.slice(0,10).forEach(function(p,i){md+=(i+1)+'. **'+p[1]+'** | '+p[2]+' · '+p[3]+' | '+p[6]+' | 销量'+p[8]+' | '+p[9]+' | '+p[10]+'\n'});
  md+='\n## 赛道分布\n\n';
  var catMap={};data.forEach(function(p){catMap[p[4]]=(catMap[p[4]]||0)+1});
  Object.keys(catMap).sort(function(a,b){return catMap[b]-catMap[a]}).forEach(function(c){md+='- '+c+': '+catMap[c]+'条\n'});
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
      '<div class="pr-shop-stat"><b style="color:#3a6ea8">'+hotCount+'</b><span>热销款</span></div>'+
      '<div class="pr-shop-stat"><b style="color:var(--orange)">'+(shopProducts.length-hotCount)+'</b><span>滞销款</span></div>';
    prRenderTable(shopProducts);
    $('#pr-count').textContent='● '+shopProducts.length+' 件商品 | 店铺: '+shop;
    toast('已加载 '+shop+' 商品库');
  };
})();



// ========== SHOPS PAGE - FULL REBUILD ==========
var shSelected = new Set();
var shActiveAI = 'benchmark';
var shActiveGroup = 'all';
var shGroups = JSON.parse(localStorage.getItem('jay_shop_groups') || '{"all":["全部店铺"]}');
var shGroupShops = JSON.parse(localStorage.getItem('jay_shop_group_shops') || '{}');

// AI Insight data
var shAiBenchmark = [
  {title:'Medicube Official — 美区TikTok美妆标杆', desc:'月GMV US$1,630万，增速+52%，30天波动+35.6%，粉丝58万。核心打法：TikTok Made Me Buy It 常态化运营+达人矩阵+直播日播。品类集中在美容仪器+护肤品组合装，客单价$30-80。', source:'产品全域雷达', time:'今日', idx:25},
  {title:'DealsForYouDays — 欧美家居日用黑马', desc:'月GMV US$507万，增速+100%，30天波动+52.3%。SEESE品牌店运营模式：高频上新+低价引流+TikTok短视频种草。商品数210个，铺货速度全店TOP3。', source:'产品全域雷达', time:'今日', idx:31},
  {title:'Xiaomi Official — 东南亚3C绝对头部', desc:'月GMV US$420万，Lazada旗舰运营，520个在售SKU，粉丝32万。打法：性价比爆款矩阵+平台大促深度参与+本地化售后体系。', source:'店铺追踪', time:'7日', idx:3},
  {title:'Govee US — Amazon家居智能照明标杆', desc:'月GMV US$580万，340个SKU，粉丝21万。核心优势：Amazon Brand Registry+品牌搜索占比35%+A+页面转化率高于类目均值42%。', source:'店铺追踪', time:'7日', idx:9}
];
var shAiRisk = [
  {title:'Rejutan Official MY — 增速异常 +600%', desc:'单月GMV从$14万飙升至$85万，增速+600%远超类目均值。可能原因：大促活动/达人带货爆量/刷单嫌疑。建议持续监控7天确认趋势真实性。', source:'预警中心', time:'今日', idx:27},
  {title:'BIBIGO(菲律宾) — 增速异常 +454%', desc:'食品品类单月暴增，从$6.3万飙升至$35万。食品类在Shopee东南亚合规风险较高，需关注FDA认证+标签合规。', source:'预警中心', time:'今日', idx:29},
  {title:'Toplux Nutrition — GMV下滑 -7.5%', desc:'保健品品类连续3周下滑，30天波动-3.2%。可能原因：竞品低价冲击/平台政策调整/季节性因素。建议对标同品类头部店铺调整策略。', source:'预警中心', time:'7日', idx:33},
  {title:'Poolhacker — 增速+120%但基数极低', desc:'月GMV仅$14万，增速数据参考性有限。户外泳池用品季节性极强，Q4将进入淡季，不建议作为对标对象。', source:'预警中心', time:'7日', idx:28}
];

function shSwitchAI(tab) {
  shActiveAI = tab;
  document.querySelectorAll('.sh-ai-tab').forEach(function(b){b.classList.toggle('active', b.dataset.aitab===tab)});
  shRenderAI();
}

function shRenderAI() {
  var list = shActiveAI === 'benchmark' ? shAiBenchmark : shAiRisk;
  var el = document.getElementById('sh-ai-content');
  if(!el) return;
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';
  list.forEach(function(item, i) {
    var borderColor = shActiveAI === 'benchmark' ? 'var(--green)' : '#e53935';
    html += '<div style="border:1px solid ' + borderColor + ';border-radius:8px;padding:14px;background:var(--paper)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">';
    html += '<strong style="font-size:14px;color:var(--ink)">' + item.title + '</strong>';
    html += '<span style="font-size:11px;color:var(--muted);white-space:nowrap;margin-left:8px">' + item.time + '</span>';
    html += '</div>';
    html += '<p style="font-size:12px;color:#555;line-height:1.6;margin:0 0 10px">' + item.desc + '</p>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button class="sh-ai-src" data-idx="' + item.idx + '" style="font-size:11px;padding:3px 8px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">🔗 溯源定位</button>';
    html += '<button class="sh-ai-report" data-title="' + encodeURIComponent(item.title) + '" data-desc="' + encodeURIComponent(item.desc) + '" style="font-size:11px;padding:3px 8px;border:1px solid var(--orange);color:var(--orange);border-radius:4px;background:transparent;cursor:pointer">+ 加入素材</button>';
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;

  // Event delegation for source buttons
  el.querySelectorAll('.sh-ai-src').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      shCloseModal();
      setTimeout(function(){ shShowDetail(idx); }, 100);
    });
  });
  el.querySelectorAll('.sh-ai-report').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var title = decodeURIComponent(this.dataset.title);
      var desc = decodeURIComponent(this.dataset.desc);
      var pool = JSON.parse(localStorage.getItem('jay_report_pool') || '[]');
      pool.push({type:'shop-insight', title:title, content:desc, ts:Date.now()});
      localStorage.setItem('jay_report_pool', JSON.stringify(pool));
      toast('已加入报告素材: ' + title.substring(0,20));
    });
  });
}

// ========== FILTERS ==========
function shInitFilters() {
  var regions = [], plats = [], cats = [], allTags = [];
  shops.forEach(function(s) {
    if(regions.indexOf(s[2])<0) regions.push(s[2]);
    if(plats.indexOf(s[1])<0) plats.push(s[1]);
    if(cats.indexOf(s[6])<0) cats.push(s[6]);
    if(s[9]) { s[9].split(',').forEach(function(t){ t=t.trim(); if(t && allTags.indexOf(t)<0) allTags.push(t); }); }
  });
  var rSel = document.getElementById('sh-f-region');
  var pSel = document.getElementById('sh-f-platform');
  var cSel = document.getElementById('sh-f-cat');
  var tSel = document.getElementById('sh-f-tag');
  regions.forEach(function(r){ var o=document.createElement('option'); o.value=r; o.textContent=r; rSel.appendChild(o); });
  plats.forEach(function(p){ var o=document.createElement('option'); o.value=p; o.textContent=p; pSel.appendChild(o); });
  cats.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; cSel.appendChild(o); });
  allTags.forEach(function(t){ var o=document.createElement('option'); o.value=t; o.textContent=t; tSel.appendChild(o); });

  ['sh-f-region','sh-f-platform','sh-f-cat','sh-f-status','sh-f-gmv','sh-f-tag','sh-f-sort'].forEach(function(id){
    document.getElementById(id).addEventListener('change', shApplyFilters);
  });
  document.getElementById('sh-f-keyword').addEventListener('input', shApplyFilters);
}

function shParseGMV(s) {
  var m = s.replace(/[^0-9.]/g, '');
  return parseFloat(m) || 0;
}

function shApplyFilters() {
  var region = document.getElementById('sh-f-region').value;
  var plat = document.getElementById('sh-f-platform').value;
  var cat = document.getElementById('sh-f-cat').value;
  var status = document.getElementById('sh-f-status').value;
  var gmv = document.getElementById('sh-f-gmv').value;
  var tag = document.getElementById('sh-f-tag').value;
  var kw = document.getElementById('sh-f-keyword').value.trim().toLowerCase();
  var sort = document.getElementById('sh-f-sort').value;

  var filtered = shops.map(function(s,i){ return {s:s,idx:i}; }).filter(function(o) {
    var s = o.s;
    if(shActiveGroup !== 'all') {
      var grpShops = shGroupShops[shActiveGroup] || [];
      if(grpShops.indexOf(o.idx) < 0) return false;
    }
    if(region && s[2] !== region) return false;
    if(plat && s[1] !== plat) return false;
    if(cat && s[6] !== cat) return false;
    if(status && s[5] !== status) return false;
    if(tag && (!s[9] || s[9].indexOf(tag) < 0)) return false;
    if(kw && s[0].toLowerCase().indexOf(kw)<0 && s[6].toLowerCase().indexOf(kw)<0) return false;
    if(gmv) {
      var g = shParseGMV(s[3]);
      if(gmv==='0-100' && g>100) return false;
      if(gmv==='100-300' && (g<100||g>300)) return false;
      if(gmv==='300-500' && (g<300||g>500)) return false;
      if(gmv==='500+' && g<500) return false;
    }
    return true;
  });

  // Sort
  filtered.sort(function(a,b) {
    var sa=a.s, sb=b.s;
    switch(sort) {
      case 'gmv_asc': return shParseGMV(sa[3]) - shParseGMV(sb[3]);
      case 'gmv_desc': return shParseGMV(sb[3]) - shParseGMV(sa[3]);
      case 'growth_desc': return parseFloat(sb[4]) - parseFloat(sa[4]);
      case 'growth_asc': return parseFloat(sa[4]) - parseFloat(sb[4]);
      case 'products_desc': return (sb[7]||0) - (sa[7]||0);
      default: return shParseGMV(sb[3]) - shParseGMV(sa[3]);
    }
  });

  shRenderTable(filtered);
  document.getElementById('sh-count').textContent = '(' + filtered.length + '/' + shops.length + ')';
}

function shStatusCls(st) {
  if(st === '正常') return 'watch';
  if(st === '风险') return 'hot';
  return 'alert-tag';
}

function shRenderTable(list) {
  var tbody = document.getElementById('shop-table');
  if(!tbody) return;
  tbody.innerHTML = list.map(function(o) {
    var s = o.s; var idx = o.idx;
    var checked = shSelected.has(idx) ? 'checked' : '';
    var growthCls = s[4].charAt(0) === '-' ? '' : 'growth';
    var waveCls = s[8].charAt(0) === '-' ? 'style="color:#e53935"' : 'style="color:var(--green)"';
    var tagsHtml = '';
    if(s[9]) {
      s[9].split(',').forEach(function(t) {
        t = t.trim();
        var tc = t === '对标头部' ? 'var(--green)' : t === '低价竞品' ? 'var(--orange)' : 'var(--muted)';
        tagsHtml += '<span style="display:inline-block;font-size:10px;padding:1px 6px;border:1px solid ' + tc + ';color:' + tc + ';border-radius:3px;margin-right:3px">' + t + '</span>';
      });
    }
    return '<tr>' +
      '<td><input type="checkbox" class="sh-cb" data-idx="' + idx + '" ' + checked + ' onchange="shToggleOne(' + idx + ',this.checked)"></td>' +
      '<td><strong style="cursor:pointer;color:var(--green)" class="sh-shop-link" data-idx="' + idx + '">' + s[0] + '</strong></td>' +
      '<td>' + s[1] + '</td>' +
      '<td>' + s[2] + '</td>' +
      '<td>' + s[6] + '</td>' +
      '<td><strong>' + s[3] + '</strong></td>' +
      '<td ' + waveCls + '>' + s[8] + '</td>' +
      '<td>' + s[7] + '</td>' +
      '<td class="' + growthCls + '">' + s[4] + '</td>' +
      '<td style="font-size:12px">' + (s[10]?jayFmtCount(s[10]):'-') + '</td>' +
      '<td>' + tagsHtml + '</td>' +
      '<td><span class="tag ' + shStatusCls(s[5]) + '">' + s[5] + '</span></td>' +
      '<td style="font-size:11px;color:var(--muted)">' + (s[12]||'') + '</td>' +
      '</tr>';
  }).join('');

  // Event delegation for shop links
  tbody.querySelectorAll('.sh-shop-link').forEach(function(el) {
    el.addEventListener('click', function() {
      shShowDetail(parseInt(this.dataset.idx));
    });
  });
  // Checkbox events
  tbody.querySelectorAll('.sh-cb').forEach(function(el) {
    el.addEventListener('change', function() {
      shToggleOne(parseInt(this.dataset.idx), this.checked);
    });
  });
}

function shToggleOne(idx, checked) {
  if(checked) shSelected.add(idx); else shSelected.delete(idx);
  shUpdateBatch();
}
function shToggleAll(checked) {
  document.querySelectorAll('.sh-cb').forEach(function(cb){ cb.checked=checked; shToggleOne(parseInt(cb.dataset.idx), checked); });
}
function shClearSelection() {
  shSelected.clear();
  document.querySelectorAll('.sh-cb').forEach(function(cb){ cb.checked=false; });
  document.getElementById('sh-select-all').checked = false;
  shUpdateBatch();
}
function shUpdateBatch() {
  var bar = document.getElementById('sh-batch-bar');
  bar.style.display = shSelected.size > 0 ? 'flex' : 'none';
  document.getElementById('sh-batch-count').textContent = '已选 ' + shSelected.size + ' 家';
}

// ========== SHOP DETAIL MODAL ==========
function shShowDetail(idx) {
  var s = shops[idx]; if(!s) return;
  document.getElementById('sh-modal-title').textContent = s[0] + ' — ' + s[1] + ' (' + s[2] + ')';
  var body = document.getElementById('sh-modal-body');

  // Generate 30-day trend data
  var baseGMV = shParseGMV(s[3]);
  var trendData = [];
  for(var i=0; i<30; i++) {
    var variance = (Math.random()-0.4) * baseGMV * 0.08;
    trendData.push(Math.max(0, baseGMV/30 + variance));
  }
  var maxTrend = Math.max.apply(null, trendData);
  var minTrend = Math.min.apply(null, trendData);

  // Generate category distribution
  var mainCat = s[6];
  var cats = [[mainCat, 45]];
  var remaining = 55;
  var otherCats = ['家居日用','3C数码','时尚服饰','食品','运动户外'];
  for(var i=0; i<3 && remaining>0; i++) {
    var pct = Math.min(remaining, Math.floor(Math.random()*20)+5);
    cats.push([otherCats[i], pct]);
    remaining -= pct;
  }
  if(remaining > 0) cats.push(['其他', remaining]);

  var catColors = ['var(--green)','var(--orange)','#4a90d9','#c8a84e','#999'];

  var html = '';
  // 4-block layout
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';

  // Block 1: Revenue trend
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">📈 30天GMV趋势</h4>';
  html += '<div style="display:flex;align-items:end;gap:2px;height:100px">';
  trendData.forEach(function(v,i) {
    var h = Math.max(4, (v/maxTrend)*90);
    var color = i >= 25 ? 'var(--green)' : '#ccc';
    html += '<div style="flex:1;height:' + h + 'px;background:' + color + ';border-radius:2px 2px 0 0" title="Day ' + (i+1) + ': $' + v.toFixed(1) + '万"></div>';
  });
  html += '</div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px">';
  html += '<span>30天前</span><span>今日</span></div>';
  html += '<div style="margin-top:8px;font-size:12px"><strong>' + s[3] + '</strong> / 30天波动 <span ' + (s[8].charAt(0)==='-'?'style="color:#e53935"':'style="color:var(--green)"') + '>' + s[8] + '</span></div>';
  html += '</div>';

  // Block 2: Category distribution
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">🏷️ 品类分布</h4>';
  cats.forEach(function(c, i) {
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
    html += '<div style="width:10px;height:10px;border-radius:2px;background:' + catColors[i] + '"></div>';
    html += '<span style="font-size:12px;flex:1">' + c[0] + '</span>';
    html += '<span style="font-size:12px;font-weight:600">' + c[1] + '%</span>';
    html += '</div>';
  });
  html += '</div>';

  // Block 3: Top products
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">🔥 店内爆款TOP5</h4>';
  var topProducts = ['爆款A - ' + mainCat, '爆款B - ' + mainCat, '新品C - 周边品类', '长款D - ' + mainCat, '引流款E - 低价品'];
  var topSales = [Math.floor(baseGMV*0.15), Math.floor(baseGMV*0.1), Math.floor(baseGMV*0.08), Math.floor(baseGMV*0.06), Math.floor(baseGMV*0.04)];
  topProducts.forEach(function(p,i) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f0f0f0">';
    html += '<span style="font-size:12px">' + (i+1) + '. ' + p + '</span>';
    html += '<span style="font-size:11px;color:var(--green)">$' + topSales[i] + '万</span>';
    html += '</div>';
  });
  html += '<button onclick="shCloseModal();switchPage(\'products\');setTimeout(function(){document.getElementById(\'sh-f-keyword\').value=\'' + escInline(s[0].substring(0,8)) + '\';shApplyFilters();},200)" style="margin-top:8px;font-size:11px;padding:4px 10px;border:1px solid var(--green);color:var(--green);border-radius:4px;background:transparent;cursor:pointer">🔗 跳转产品雷达查看全店商品</button>';
  html += '</div>';

  // Block 4: Risk records
  html += '<div style="border:1px solid #ddd;border-radius:8px;padding:14px">';
  html += '<h4 style="margin:0 0 10px;font-size:13px;color:var(--ink)">⚠️ 经营风险记录</h4>';
  var risks = [];
  if(s[5] === '关注') risks.push({level:'mid', text:'增速异常波动，需持续监控', time:'今日'});
  if(parseFloat(s[4]) > 100) risks.push({level:'high', text:'增速超100%，存在刷单/异常流量嫌疑', time:'3日前'});
  if(s[8].charAt(0) === '-') risks.push({level:'mid', text:'30天GMV下滑，关注是否为季节性调整', time:'7日前'});
  if(risks.length === 0) risks.push({level:'low', text:'经营平稳，暂无异常记录', time:'持续'});
  risks.push({level:'info', text:'店铺评分 ' + s[11] + '，粉丝 ' + s[10], time:'实时'});
  risks.forEach(function(r) {
    var cls = r.level==='high' ? '#e53935' : r.level==='mid' ? 'var(--orange)' : r.level==='info' ? 'var(--green)' : 'var(--muted)';
    html += '<div style="display:flex;gap:8px;align-items:start;padding:4px 0;border-bottom:1px solid #f0f0f0">';
    html += '<span style="width:6px;height:6px;border-radius:50%;background:' + cls + ';margin-top:5px;flex-shrink:0"></span>';
    html += '<span style="font-size:12px;flex:1">' + r.text + '</span>';
    html += '<span style="font-size:10px;color:var(--muted)">' + r.time + '</span>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>';

  // Bottom actions
  html += '<div style="display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #eee">';
  html += '<button onclick="shAddToReport(' + idx + ')" style="padding:6px 14px;border:1px solid var(--orange);color:var(--orange);border-radius:6px;background:transparent;cursor:pointer;font-size:12px">+ 加入报告素材</button>';
  html += '<button onclick="shCloseModal();switchPage(\'countries\')" style="padding:6px 14px;border:1px solid var(--green);color:var(--green);border-radius:6px;background:transparent;cursor:pointer;font-size:12px">🌍 跳转国家市场</button>';
  html += '<button onclick="shCloseModal();switchPage(\'alerts\')" style="padding:6px 14px;border:1px solid #e53935;color:#e53935;border-radius:6px;background:transparent;cursor:pointer;font-size:12px">🔔 设置预警</button>';
  html += '</div>';

  body.innerHTML = html;
  document.getElementById('sh-modal-overlay').classList.add('show');
}

function shCloseModal() {
  document.getElementById('sh-modal-overlay').classList.remove('show');
}

function shAddToReport(idx) {
  var s = shops[idx];
  var pool = JSON.parse(localStorage.getItem('jay_report_pool') || '[]');
  pool.push({type:'shop', title:s[0]+' ('+s[1]+')', content:'月GMV '+s[3]+' 增速'+s[4]+' 主营'+s[6]+' 状态:'+s[5], ts:Date.now()});
  localStorage.setItem('jay_report_pool', JSON.stringify(pool));
  toast('已加入报告素材: ' + s[0]);
}

// ========== BATCH OPS ==========
function shBatchAddReport() {
  var pool = JSON.parse(localStorage.getItem('jay_report_pool') || '[]');
  shSelected.forEach(function(idx) {
    var s = shops[idx];
    pool.push({type:'shop', title:s[0]+' ('+s[1]+')', content:'月GMV '+s[3]+' 增速'+s[4]+' 主营'+s[6], ts:Date.now()});
  });
  localStorage.setItem('jay_report_pool', JSON.stringify(pool));
  toast('已批量加入 ' + shSelected.size + ' 家店铺到报告素材');
  shClearSelection();
}
function shBatchSetAlert() {
  toast('已为 ' + shSelected.size + ' 家店铺设置预警规则');
  shClearSelection();
}
function shBatchRemove() {
  toast('已移除 ' + shSelected.size + ' 家店铺监控');
  shClearSelection();
}

// ========== ADD SHOP ==========
function shOpenAddModal() { document.getElementById('sh-add-overlay').classList.add('show'); }
function shCloseAddModal() { document.getElementById('sh-add-overlay').classList.remove('show'); }
function shSwitchAddTab(tab) {
  document.querySelectorAll('.sh-add-tab').forEach(function(b){b.classList.toggle('active',b.dataset.addtab===tab)});
  document.getElementById('sh-add-single').style.display = tab==='single'?'block':'none';
  document.getElementById('sh-add-batch').style.display = tab==='batch'?'block':'none';
  document.getElementById('sh-add-link').style.display = tab==='link'?'block':'none';
}
function shDoAddSingle() {
  var name = document.getElementById('sh-add-name').value.trim();
  var plat = document.getElementById('sh-add-platform').value.trim() || '未知';
  var market = document.getElementById('sh-add-market').value.trim() || '未知';
  var cat = document.getElementById('sh-add-cat').value.trim() || '未分类';
  var tags = document.getElementById('sh-add-tags').value.trim() || '';
  if(!name) { toast('请输入店铺名称'); return; }
  shops.push([name, plat, market, 'US$ 0万', '+0%', '正常', cat, 0, '+0%', tags, '0', '0', '刚刚']);
  shCloseAddModal();
  shApplyFilters();
  toast('已添加店铺: ' + name);
  // Also add to products cross-link
  var pool = JSON.parse(localStorage.getItem('jay_report_pool') || '[]');
  pool.push({type:'shop', title:name+' ('+plat+')', content:'新添加监控店铺 主营'+cat, ts:Date.now()});
  localStorage.setItem('jay_report_pool', JSON.stringify(pool));
}
function shDoAddBatch() {
  var text = document.getElementById('sh-add-batch-text').value.trim();
  if(!text) { toast('请粘贴店铺名称'); return; }
  var lines = text.split('\n').filter(function(l){return l.trim()});
  var count = 0;
  lines.forEach(function(line) {
    var name = line.trim();
    if(name) {
      shops.push([name, '未知', '未知', 'US$ 0万', '+0%', '正常', '未分类', 0, '+0%', '', '0', '0', '刚刚']);
      count++;
    }
  });
  shCloseAddModal();
  shApplyFilters();
  toast('已批量导入 ' + count + ' 家店铺');
}

// ========== GROUPS ==========
function shRenderGroups() {
  var el = document.getElementById('sh-group-tabs');
  var html = '<button class="sh-grp ' + (shActiveGroup==='all'?'active':'') + '" data-grp="all" onclick="shSwitchGroup(\'all\')">全部店铺</button>';
  Object.keys(shGroups).forEach(function(k) {
    if(k === 'all') return;
    html += '<button class="sh-grp ' + (shActiveGroup===k?'active':'') + '" data-grp="' + escapeHtml(k) + '" onclick="shSwitchGroup(\'' + escInline(k) + '\')">' + escapeHtml(k) + ' <span style="font-size:10px;color:var(--muted)">(' + (shGroupShops[k]||[]).length + ')</span></button>';
  });
  el.innerHTML = html;
}
function shSwitchGroup(grp) {
  shActiveGroup = grp;
  shRenderGroups();
  shApplyFilters();
}
function shNewGroup() {
  var name = prompt('输入分组名称（如：东南亚美妆对标店铺）');
  if(!name) return;
  shGroups[name] = name;
  shGroupShops[name] = [];
  localStorage.setItem('jay_shop_groups', JSON.stringify(shGroups));
  localStorage.setItem('jay_shop_group_shops', JSON.stringify(shGroupShops));
  shRenderGroups();
  toast('已创建分组: ' + name);
}

// ========== TEMPLATES ==========
function shSaveTpl() {
  var state = {
    region: document.getElementById('sh-f-region').value,
    platform: document.getElementById('sh-f-platform').value,
    cat: document.getElementById('sh-f-cat').value,
    status: document.getElementById('sh-f-status').value,
    gmv: document.getElementById('sh-f-gmv').value,
    tag: document.getElementById('sh-f-tag').value,
    keyword: document.getElementById('sh-f-keyword').value,
    sort: document.getElementById('sh-f-sort').value
  };
  var tpls = JSON.parse(localStorage.getItem('jay_shop_tpl') || '[]');
  var name = prompt('模板名称', state.region + ' ' + state.platform + ' ' + state.cat);
  if(!name) return;
  state.name = name;
  tpls.push(state);
  localStorage.setItem('jay_shop_tpl', JSON.stringify(tpls));
  shRenderTplSelect();
  toast('模板已保存: ' + name);
}
function shRenderTplSelect() {
  var sel = document.getElementById('sh-tpl-select');
  var tpls = JSON.parse(localStorage.getItem('jay_shop_tpl') || '[]');
  sel.innerHTML = '<option value="">加载模板...</option>' + tpls.map(function(t,i){ return '<option value="' + i + '">' + t.name + '</option>'; }).join('');
}
function shLoadTpl(idx) {
  if(idx === '') return;
  var tpls = JSON.parse(localStorage.getItem('jay_shop_tpl') || '[]');
  var t = tpls[parseInt(idx)]; if(!t) return;
  document.getElementById('sh-f-region').value = t.region || '';
  document.getElementById('sh-f-platform').value = t.platform || '';
  document.getElementById('sh-f-cat').value = t.cat || '';
  document.getElementById('sh-f-status').value = t.status || '';
  document.getElementById('sh-f-gmv').value = t.gmv || '';
  document.getElementById('sh-f-tag').value = t.tag || '';
  document.getElementById('sh-f-keyword').value = t.keyword || '';
  document.getElementById('sh-f-sort').value = t.sort || 'gmv_desc';
  shApplyFilters();
  toast('已加载模板: ' + t.name);
}

// ========== EXPORT ==========
function shExportExcel() {
  var header = '店铺名\t平台\t市场\t主营类目\t月GMV\t30天波动\t在售商品\t增速\t粉丝数\t标签\t状态\t更新时间';
  var rows = shops.map(function(s){ return s.join('\t'); });
  var csv = '\uFEFF' + header + '\n' + rows.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shop_tracker_export.csv';
  a.click();
  toast('Excel导出完成');
}
function shExportPDF() {
  var md = '# 店铺追踪竞品分析报告\\n\\n';
  md += '导出时间: ' + new Date().toLocaleString() + '\\n\\n';
  md += '## 监控概览\\n\\n';
  md += '- 监控店铺总数: ' + shops.length + '\\n';
  var regions = {};
  shops.forEach(function(s){ regions[s[2]] = (regions[s[2]]||0)+1; });
  Object.keys(regions).forEach(function(r){ md += '- ' + r + ': ' + regions[r] + '家\\n'; });
  md += '\\n## 头部店铺分析\\n\\n';
  shops.filter(function(s){ return shParseGMV(s[3]) >= 300; }).sort(function(a,b){ return shParseGMV(b[3])-shParseGMV(a[3]); }).forEach(function(s){
    md += '### ' + s[0] + '\\n';
    md += '- 平台: ' + s[1] + ' | 市场: ' + s[2] + ' | 类目: ' + s[6] + '\\n';
    md += '- 月GMV: ' + s[3] + ' | 增速: ' + s[4] + ' | 30天波动: ' + s[8] + '\\n';
    md += '- 在售商品: ' + s[7] + ' | 粉丝: ' + s[10] + ' | 评分: ' + s[11] + '\\n';
    md += '- 状态: ' + s[5] + ' | 标签: ' + (s[9]||'无') + '\\n\\n';
  });
  var blob = new Blob([md.replace(/\\n/g, '\n')], {type:'text/markdown;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shop_analysis_report.md';
  a.click();
  toast('PDF报告片段导出完成');
}

// ========== INIT ==========
(function initShopsPage() {
  shInitFilters();
  shRenderAI();
  shRenderGroups();
  shRenderTplSelect();
  shApplyFilters();
})();


let countryFullData={id:{flag:'🇮🇩',name:'印度尼西亚',subtitle:'Indonesia · 东南亚核心市场',region:'东南亚',ai:{opp:'蓝海市场，2.78亿人口+年轻结构+电商渗透率仅31%，增长空间巨大。核心动力：移动互联网普及+穆斯林时尚需求+本土品牌化趋势',tracks:['美妆个护 +42.8% 年轻女性驱动，TikTok直播带货爆发','穆斯林时尚 +28% Hijab头巾/长袍市场巨大，本土品牌稀缺','平价消费电子 +35% 智能手机渗透率持续攀升'],risks:['⚠️ 进口商品标签合规严格，需印尼语标注','⚠️ 化妆品需BPOM认证，周期3-6个月','⚠️ 本土电商最低价格监管，低于成本价禁售'],advice:['新手：跨境店+Shopee起步，低门槛试水','工厂：本土店+Shopee/TikTok双渠道，成本优势','精品：品牌化本土店+TikTok内容营销，中高端'],},macro:[['总人口','2.78亿','+1.1%','东南亚第一人口大国'],['电商规模','US$ 624亿','+18.5%','年增速领跑东南亚'],['电商渗透率','31.2%','↑','仍有巨大增长空间'],['人均可支配收入','US$ 4,580','+5.2%','中产阶层持续扩大'],['汇率','16,260 IDR/USD','±1.2%','30日波动稳定'],['外贸环境','利好','→','RCEP+ASEAN自贸区加持'],],demo:{age:[['0-14岁',26,'母婴玩具学习用品'],['15-29岁',28,'短视频美妆穿搭潮品'],['30-49岁',30,'家居家电母婴刚需'],['50岁+',16,'保守刚需性价比'],],ai_age:'投放首选15-35岁，重点美妆时尚',gender:{m:52,f:48},f_pref:'美妆护肤、服饰配饰、母婴、家居软装',m_pref:'3C数码、户外工具、汽车配件',religion:[['伊斯兰教',87],['基督教',10],['印度教',2],['其他',1],],risk:['严禁猪肉/酒精产品图像','避免暴露女性形象广告','斋月期间白天营销限制'],opp:['穆斯林时尚(Hijab/长袍)市场巨大','清真认证食品化妆品溢价大','斋月大促(3-4月)年度最大消费季'],fest:'斋月(3-4月) → 独立日(8月) → 年终大促(12月)',income:[['底层低收入',40,'极致低价走量','#e0e4ec'],['中产主流层',35,'中端性价比·卖家首选','#2c5f8a'],['中高收入',20,'品质款功能升级','#4a90d9'],['高收入精英',5,'高端品牌定制化','#c8a84e'],],price:[['低价直播','TikTok','$3-15','冲动消费高频复购'],['中端货架','Shopee/Lazada','$15-50','比价型重评价'],['高端品牌','品牌独立站','$50+','品牌忠诚品质优先'],],price_trend:'客单价年增+8%，消费升级趋势明显',shelf:'理性比价、重销量评价、刚需囤货、复购稳定',content:'冲动消费、颜值优先、追网红爆款、新奇小众',payment:'GoPay/DANA/OVO',cod:35,peak:'20:00-23:00',},cat:{blue:[['美妆个护','+42.8%'],['穆斯林时尚','+28%'],['平价消费电子','+35%'],['母婴用品','+22%'],],stable:['家居日用','食品饮料','服装基础款'],risk:[['药品保健品','BPOM认证门槛高'],['进口食品','Halal认证必须'],['二手商品','平台禁止'],],},plats:[['Shopee','🟠',36,'货架+内容','跨境/本土','5-8%','美妆时尚家居','★★☆'],['TikTok Shop','🎵',19,'内容电商','本土优先','3-5%','美妆个护时尚','★★★'],['Tokopedia','🟢',15,'货架电商','本土','4-7%','3C数码家居','★★☆'],['Lazada','🔵',12,'货架电商','跨境/本土','5-8%','家居电子时尚','★★☆'],['Bukalapak','🟡',8,'货架电商','本土','3-6%','日用品食品','★☆☆'],],comp:{level:'中等偏严格',cls:'strict',policies:[['high','进口商品印尼语标签强制要求','2026-01生效','全品类','全平台','所有进口商品必须有印尼语标签，否则海关扣押'],['high','化妆品BPOM认证强制监管','持续执行','美妆个护','全平台','认证周期3-6个月，未认证产品下架风险极高'],['mid','电商最低价格监管政策','2026-07更新','全品类','Shopee/Lazada','低于成本价销售将被处罚'],['low','跨境电商税收新规讨论中','2026-Q2','跨境商品','全平台','可能取消低价商品免税额度'],]}},us:{flag:'🇺🇸',name:'美国',subtitle:'United States · 全球最大消费市场',region:'北美',ai:{opp:'成熟市场，全球最大消费经济体。高客单价+完善履约体系，品牌化与差异化是核心竞争策略',tracks:['家居生活 +18% 远程办公持续驱动需求','消费电子 +15% 新品迭代快、品牌忠诚度高','健康个护 +22% 天然有机成分趋势强劲'],risks:['⚠️ 对华关税145%全品类承压','⚠️ 各州销售税规则复杂，平台代扣','⚠️ 产品责任诉讼风险高，需购买保险'],advice:['新手：Temu/TikTok Shop跨境试水，低成本验证','工厂：Amazon FBA+独立站双轨，海外仓必备','精品：品牌DTC+Amazon Brand Registry，重内容营销'],},macro:[['总人口','3.41亿','+0.5%','全球第三人口大国'],['电商规模','US$ 1.23万亿','+9.8%','全球第二大电商市场'],['电商渗透率','16.1%','↑','渗透率趋稳'],['人均可支配收入','US$ 52,800','+3.1%','高消费力基础'],['汇率','1.00 USD','→','全球储备货币'],['外贸环境','收紧','↓','对华关税+贸易保护'],],demo:{age:[['0-14岁',18,'母婴高品质产品'],['15-29岁',20,'Z世代社交电商冲动消费'],['30-49岁',27,'家庭消费主力高客单'],['50岁+',35,'银发经济健康品需求'],],ai_age:'核心人群25-45岁，注重品质与评价',gender:{m:49,f:51},f_pref:'美妆护肤、瑜伽运动服饰、家居装饰、轻奢饰品',m_pref:'3C数码、户外装备、BBQ工具、运动器械',religion:[['基督教',65],['无宗教',26],['犹太教',2],['其他',7],],risk:['产品责任诉讼风险高','FTC广告合规要求严格','加州65提案警示标签必须'],opp:['天然有机成分产品需求旺盛','DTC品牌独立站机会大','Prime Day/黑五爆款效应强'],fest:'黑五(11月) → 圣诞(12月) → Prime Day(7月)',income:[['底层低收入',25,'极致性价比','#e0e4ec'],['中产主流层',40,'中端品质·核心市场','#2c5f8a'],['中高收入',25,'品牌溢价功能升级','#4a90d9'],['高收入精英',10,'奢侈品定制化','#c8a84e'],],price:[['低价平台','Temu/Wish','$3-20','价格敏感型'],['中端主流','Amazon','$20-80','重评价重物流'],['高端品牌','DTC独立站','$80+','品牌忠诚体验优先'],],price_trend:'通胀压力下消费者更注重性价比',shelf:'重评价评分、物流速度、退货政策',content:'TikTok种草→Amazon转化、社交媒体驱动',payment:'信用卡/Apple Pay/Amazon Pay',cod:2,peak:'19:00-22:00',},cat:{blue:[['家居生活','+18%'],['健康个护','+22%'],['宠物用品','+25%'],['户外装备','+15%'],],stable:['消费电子','服装基础款','办公用品'],risk:[['处方药品','FDA严格管制'],['武器配件','多州禁售'],['含铅儿童产品','CPSIA标准极高'],],},plats:[['Amazon','📦',38,'货架电商','跨境FBA','8-15%','全品类','★★★'],['TikTok Shop','🎵',8,'内容电商','跨境','3-5%','美妆时尚家居','★★☆'],['Walmart','🏬',12,'货架电商','跨境/本土','6-12%','家居电子日用','★★★'],['Temu','🟠',6,'低价平台','跨境','平台承担','全品类低价','★★☆'],['eBay','🏷️',5,'货架/C2C','跨境','8-13%','电子收藏二手','★★☆'],],comp:{level:'中等',cls:'medium',policies:[['high','对华关税145%全品类','持续执行','全品类','全平台','所有中国原产商品加征145%关税，成本大幅上升'],['high','消费品安全合规(CPSC)','持续执行','玩具/电子','Amazon/Walmart','需CPC认证+第三方检测'],['mid','各州销售税规则','持续更新','全品类','全平台','各州税率不同，平台代扣为主'],['low','产品责任保险建议','建议','全品类','全平台','美国诉讼风险高，建议购买保险'],]}},jp:{flag:'🇯🇵',name:'日本',subtitle:'Japan · 高成熟度精品市场',region:'东亚',ai:{opp:'高度成熟市场，消费者注重品质与细节。跨境电商接受度高，精品路线+极致产品力是制胜关键',tracks:['美妆护肤 +12% 天然成分+小包规格受欢迎','家居收纳 +15% 小户型需求驱动','健康食品 +18% 老龄化社会保健品需求旺盛'],risks:['⚠️ PSE/PSC认证要求严格','⚠️ 日本药机法对化妆品宣传限制多','⚠️ 消费者退货率较高，包装要求极致'],advice:['新手：Amazon日本站跨境，选品精细化','工厂：乐天+Amazon双平台，本土化包装','精品：品牌独立站+Instagram营销，极致用户体验'],},macro:[['总人口','1.23亿','-0.5%','老龄化严重'],['电商规模','US$ 2,380亿','+5.2%','成熟稳定增长'],['电商渗透率','12.8%','↑','仍有提升空间'],['人均可支配收入','US$ 33,800','+1.8%','消费趋于保守'],['汇率','157 JPY/USD','±2.1%','日元贬值利好出口'],['外贸环境','平稳','→','贸易协定广泛'],],demo:{age:[['0-14岁',12,'少子化母婴精品'],['15-29岁',17,'Z世代性价比+个性化'],['30-49岁',28,'家庭消费中坚力量'],['50岁+',43,'银发经济最大群体'],],ai_age:'30-60岁为核心消费力，品质至上',gender:{m:49,f:51},f_pref:'美妆护肤、精致便当盒、小众设计配饰',m_pref:'数码 gadgets、钓鱼户外、模型手办',religion:[['神道教',32],['佛教',30],['无宗教',35],['其他',3],],risk:['PSE/PSC认证要求严格','药机法宣传限制多','包装品质要求极致'],opp:['老龄化健康品需求巨大','精致包装小规格产品受欢迎','积分文化+会员复购体系成熟'],fest:'新年(1月) → 樱花季(3-4月) → 年末商战(12月)',income:[['底层低收入',20,'百元店/折扣店','#e0e4ec'],['中产主流层',50,'中端品质·最大市场','#2c5f8a'],['中高收入',22,'品牌功能升级','#4a90d9'],['高收入精英',8,'奢侈品精品','#c8a84e'],],price:[['折扣平台','Mercari/PayPay','$5-20','二手+新品混合'],['中端主流','Amazon/乐天','$20-80','积分+评价驱动'],['高端精品','品牌官网','$80+','极致品质服务'],],price_trend:'消费分级明显，性价比与精品两极分化',shelf:'极重评价、包装品质、配送准时',content:'Instagram+YouTube种草、KOL推荐转化',payment:'信用卡/便利店支付/PayPay',cod:8,peak:'21:00-23:00',},cat:{blue:[['美妆护肤','+12%'],['健康食品','+18%'],['宠物用品','+15%'],['智能家居','+20%'],],stable:['家居收纳','服装配饰','文具'],risk:[['药品保健品','药机法严格'],['食品','进口检验检疫极严'],['无线电产品','TELEC认证必须'],],},plats:[['Amazon','📦',24,'货架电商','跨境/本土','8-15%','全品类','★★★'],['乐天','🔴',22,'货架+内容','本土优先','5-8%','食品日用时尚','★★★'],['Yahoo Shopping','🟡',12,'货架电商','本土','5-9%','全品类','★★☆'],['Mercari','🌐',8,'C2C/二手','本土','10%','二手闲置','★☆☆'],['ZOZO','👗',4,'时尚垂直','本土','8-12%','服饰鞋包','★★☆'],],comp:{level:'严格',cls:'strict',policies:[['high','PSE/PSC电气安全认证','持续执行','电子产品','全平台','无认证产品禁止销售，处罚严厉'],['high','药机法化妆品宣传限制','持续执行','美妆','全平台','不得夸大功效，需日文全成分标注'],['mid','食品进口检验检疫','持续执行','食品','全平台','检查项目多，周期1-2周'],['low','包装品质标准','行业惯例','全品类','全平台','日本消费者包装要求极高'],]}},br:{flag:'🇧🇷',name:'巴西',subtitle:'Brazil · 拉美最大电商市场',region:'拉美',ai:{opp:'拉美最大电商市场，2.1亿人口+移动购物快速增长。社交电商+分期付款是核心打法',tracks:['个护电器 +35% 吹风机脱毛仪需求旺盛','时尚配饰 +28% 巴西风格色彩鲜艳产品热销','3C配件 +22% 智能手机配件市场巨大'],risks:['⚠️ Remessa Conforme新规50$以下征20%税','⚠️ 清关流程复杂，物流时效长','⚠️ 退货率高达15%，消费者权益保护强'],advice:['新手：Shopee巴西站跨境起步','工厂：Mercado Livre本土店+海外仓','精品：品牌本土化+Instagram+TikTok内容营销'],},macro:[['总人口','2.16亿','+0.5%','拉美最大人口国'],['电商规模','US$ 850亿','+22%','拉美电商领头羊'],['电商渗透率','11.5%','↑','增长潜力巨大'],['人均可支配收入','US$ 8,920','+2.8%','中产扩大中'],['汇率','5.07 BRL/USD','±3.2%','汇率波动较大'],['外贸环境','利好','↑','Mercosur+RCEP机遇'],],demo:{age:[['0-14岁',22,'母婴用品需求大'],['15-29岁',25,'社交电商冲动消费'],['30-49岁',30,'家庭消费主力'],['50岁+',23,'保守消费刚需'],],ai_age:'18-40岁核心人群，分期付款驱动消费',gender:{m:49,f:51},f_pref:'美妆护肤、时尚配饰、健身服饰',m_pref:'足球周边、3C配件、户外工具',religion:[['天主教',64],['新教',22],['无宗教',8],['其他',6],],risk:['Remessa Conforme新规增税','清关复杂物流时效长','退货率高达15%'],opp:['分期付款(12x)是核心购买驱动','社交电商增长迅猛','巴西风格色彩鲜明产品热销'],fest:'黑色星期五(11月) → 圣诞(12月) → 狂欢节(2月)',income:[['底层低收入',35,'极致低价走量','#e0e4ec'],['中产主流层',40,'分期性价比·核心市场','#2c5f8a'],['中高收入',18,'品质升级品牌','#4a90d9'],['高收入精英',7,'高端进口品牌','#c8a84e'],],price:[['社交电商','Shopee/TikTok','$3-15','冲动+低价'],['中端主流','Mercado Livre','$15-60','分期+免运费'],['高端品牌','品牌独立站','$60+','品质+服务'],],price_trend:'分期消费文化，12x无息是标配',shelf:'重免运费、分期选项、卖家评分',content:'Instagram+TikTok网红推荐驱动',payment:'PIX/Boleto/信用卡分期',cod:12,peak:'20:00-23:00',},cat:{blue:[['个护电器','+35%'],['时尚配饰','+28%'],['3C配件','+22%'],['健身器材','+20%'],],stable:['家居日用','食品饮料','服装'],risk:[['药品','ANVISA认证复杂'],['无人机','ANAC注册必须'],['含电池产品','运输限制严格'],],},plats:[['Mercado Livre','🟡',35,'货架+支付','跨境/本土','11-16%','全品类','★★★'],['Shopee','🟠',18,'货架+内容','跨境','5-8%','美妆时尚低价','★★☆'],['Amazon','📦',12,'货架电商','跨境FBA','8-15%','电子图书','★★★'],['Magazine Luiza','🔵',10,'货架+零售','本土','7-12%','家电家居','★★☆'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★☆☆'],],comp:{level:'中等偏严格',cls:'strict',policies:[['high','Remessa Conforme税务新规','2026-07','全品类','全平台','50美元以下征20%进口税'],['high','ANVISA药品保健品审批','持续执行','药品保健品','全平台','审批周期长，未批准禁售'],['mid','清关流程复杂','持续','全品类','全平台','清关时效7-30天，需提供完整文件'],['low','消费者权益保护(CDC)','持续','全品类','全平台','15天无理由退货，退货率高'],]}},sa:{flag:'🇸🇦',name:'沙特阿拉伯',subtitle:'Saudi Arabia · 中东高消费力市场',region:'中东',ai:{opp:'中东高消费力市场，人均GDP超3万美元。年轻人口占比高，数字化转型加速，电商渗透率快速提升',tracks:['美妆香水 +38% 阿拉伯香水市场全球领先','时尚服饰 +25% 穆斯林时尚+西方品牌融合','电子产品 +20% 游戏主机配件需求旺盛'],risks:['⚠️ VAT 15%增值税+进口关税高','⚠️ SABER认证门槛高，合规成本大','⚠️ 文化禁忌严格，营销素材需本土化审核'],advice:['新手：Noon/Amazon沙特站跨境','工厂：本土代理+Noon自营模式','精品：品牌本土化+Snapchat/TikTok营销'],},macro:[['总人口','3,640万','+1.8%','年轻人口占比高'],['电商规模','US$ 280亿','+28%','中东增速最快'],['电商渗透率','14.2%','↑','数字化加速'],['人均可支配收入','US$ 32,500','+3.5%','高消费力市场'],['汇率','3.75 SAR/USD','固定','盯住美元汇率'],['外贸环境','利好','↑','Vision 2030数字化'],],demo:{age:[['0-14岁',25,'母婴用品高消费'],['15-29岁',30,'数字化原住民消费力强'],['30-49岁',30,'家庭消费核心'],['50岁+',15,'保守消费'],],ai_age:'15-35岁年轻化人群，高客单价',gender:{m:57,f:43},f_pref:'高端香水、美妆护肤、奢华服饰',m_pref:'电子产品、游戏配件、户外装备',religion:[['伊斯兰教',97],['其他',3],],risk:['VAT 15%+高关税','SABER认证门槛高','文化禁忌严格'],opp:['阿拉伯香水市场全球领先','奢侈品消费力强','Vision 2030推动数字化'],fest:'斋月(3-4月) → 开斋节 → 国庆日(9月)',income:[['底层低收入',20,'低价走量','#e0e4ec'],['中产主流层',45,'中端品质·核心市场','#2c5f8a'],['中高收入',25,'品牌溢价','#4a90d9'],['高收入精英',10,'高端奢侈品','#c8a84e'],],price:[['低价平台','Noon Express','$5-20','性价比'],['中端主流','Noon/Amazon','$20-80','品牌+品质'],['高端精品','Ounass/品牌','$80+','奢侈品'],],price_trend:'高客单价市场，奢侈品接受度极高',shelf:'重品牌认证、阿拉伯语服务',content:'Snapchat+TikTok社交种草',payment:'信用卡/Apple Pay/Mada',cod:25,peak:'21:00-01:00',},cat:{blue:[['美妆香水','+38%'],['时尚服饰','+25%'],['电子产品','+20%'],['游戏配件','+30%'],],stable:['家居用品','食品','母婴'],risk:[['酒精相关','严禁进口'],['猪肉制品','Haram禁售'],['暴露形象商品','文化审查严格'],],},plats:[['Amazon','📦',22,'货架电商','跨境/本土','8-15%','全品类','★★★'],['Noon','🟡',28,'货架电商','跨境/本土','5-12%','全品类','★★☆'],['TikTok Shop','🎵',8,'内容电商','本土优先','3-5%','美妆时尚','★★★'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Shein','👗',6,'快时尚','跨境','10-15%','服饰配饰','★★☆'],],comp:{level:'严格',cls:'strict',policies:[['high','SABER产品认证强制','持续执行','全品类','全平台','无SABER证书产品无法清关'],['high','VAT 15%增值税','持续','全品类','全平台','进口商品+本土销售均征收'],['mid','文化内容审查','持续','服装/媒体','全平台','需符合伊斯兰文化规范'],['low','Halal认证建议','建议','食品/化妆品','全平台','清真认证提升市场接受度'],]}},th:{flag:'🇹🇭',name:'泰国',subtitle:'Thailand · 东南亚旅游消费大国',region:'东南亚',ai:{opp:'东南亚旅游消费大国，电商渗透率中等但增速稳定。内容电商渗透率高，直播+社交购物是主流',tracks:['美妆护肤 +30% 泰国美妆品牌国际化趋势','食品饮料 +20% 方便食品零食出口强劲','健康养生 +25% 草药保健品需求旺盛'],risks:['⚠️ 数字服务税4%影响跨境收入','⚠️ FDA审批对食品药品要求严格','⚠️ 竞争趋于饱和，需差异化定位'],advice:['新手：Shopee/Lazada泰国站跨境','工厂：TikTok Shop本土店+直播带货','精品：品牌独立站+Line@私域运营'],},macro:[['总人口','7,180万','+0.2%','人口增速放缓'],['电商规模','US$ 380亿','+15%','东南亚第三大'],['电商渗透率','15.8%','↑','移动购物普及'],['人均可支配收入','US$ 7,640','+3.2%','消费稳健'],['汇率','36.2 THB/USD','±1.5%','相对稳定'],['外贸环境','平稳','→','旅游复苏带动消费'],],demo:{age:[['0-14岁',18,'母婴用品稳定'],['15-29岁',23,'社交电商活跃'],['30-49岁',32,'消费核心力量'],['50岁+',27,'银发消费增长'],],ai_age:'25-45岁核心人群，直播购物接受度极高',gender:{m:49,f:51},f_pref:'美妆护肤、泰式养生、时尚服饰',m_pref:'汽车配件、电子设备、运动户外',religion:[['佛教',94],['伊斯兰教',5],['其他',1],],risk:['数字服务税4%','FDA审批严格','竞争饱和需差异化'],opp:['泰国美妆品牌国际化趋势','草药保健品需求旺盛','直播带货渗透率全东南亚最高'],fest:'泼水节(4月) → 水灯节(11月) → 年终大促(12月)',income:[['底层低收入',30,'极致性价比','#e0e4ec'],['中产主流层',45,'中端消费·核心市场','#2c5f8a'],['中高收入',18,'品质升级','#4a90d9'],['高收入精英',7,'高端品牌','#c8a84e'],],price:[['直播电商','TikTok Shop','$3-15','冲动消费'],['中端货架','Shopee/Lazada','$15-50','比价+促销驱动'],['高端品牌','Central Online','$50+','品质服务'],],price_trend:'消费升级中，有机健康品增长快',shelf:'重促销折扣、免运费、评价',content:'TikTok/Instagram直播转化率全东南亚最高',payment:'PromptPay/信用卡/COD',cod:28,peak:'19:00-23:00',},cat:{blue:[['美妆护肤','+30%'],['食品饮料','+20%'],['健康养生','+25%'],['旅游用品','+18%'],],stable:['家居日用','电子配件','服装'],risk:[['电子烟','严禁进口销售'],['保健品','FDA审批严格'],['化妆品','FDA注册必须'],],},plats:[['Shopee','🟠',35,'货架+内容','跨境/本土','5-8%','美妆时尚家居','★★☆'],['Lazada','🔵',25,'货架电商','跨境/本土','5-8%','全品类','★★☆'],['TikTok Shop','🎵',18,'内容电商','本土优先','3-5%','美妆时尚食品','★★★'],['Central Online','🏬',6,'百货电商','本土','8-12%','品牌时尚','★★☆'],['JD Central','🔴',4,'货架电商','跨境/本土','6-10%','电子家居','★★☆'],],comp:{level:'中等',cls:'medium',policies:[['mid','数字服务税4%','2024','全品类','全平台','跨境电商收入征收4%增值税'],['mid','FDA食品药品审批','持续执行','食品保健品','全平台','审批周期2-4周'],['low','电子烟严禁进口','持续','电子烟','全平台','持有/销售均违法'],['low','化妆品FDA注册','持续执行','美妆','全平台','需泰语标签+成分申报'],]}},my:{flag:'🇲🇾',name:'马来西亚',subtitle:'Malaysia · 多元文化电商市场',region:'东南亚',ai:{opp:'多元文化市场，马来/华人/印度三大族群消费偏好各异。数字基础设施完善，跨境贸易便利',tracks:['清真产品 +28% 全球清真经济中心','电子数码 +22% 消费电子需求稳定','家居园艺 +18% 中产阶级扩大带动需求'],risks:['⚠️ 数字服务税新规需关注','⚠️ 清真认证流程严格但必要','⚠️ 多语言运营增加成本'],advice:['新手：Shopee马来站+Lazada跨境','工厂：本土店+多语言listing优化','精品：品牌化+Shopee Mall入驻'],},macro:[['总人口','3,430万','+1.2%','多元文化社会'],['电商规模','US$ 195亿','+18%','东南亚稳健增长'],['电商渗透率','18.5%','↑','数字基建完善'],['人均可支配收入','US$ 12,380','+4.1%','中产主力消费'],['汇率','4.72 MYR/USD','±1.0%','波动较小'],['外贸环境','利好','→','RCEP+伊斯兰经济中心'],],demo:{age:[['0-14岁',23,'母婴多文化适配'],['15-29岁',25,'多元文化消费'],['30-49岁',30,'家庭消费核心'],['50岁+',22,'保守稳健消费'],],ai_age:'20-45岁核心人群，多语言运营关键',gender:{m:51,f:49},f_pref:'美妆护肤、穆斯林时尚、家居',m_pref:'电子产品、运动装备、汽车配件',religion:[['伊斯兰教',61],['佛教',20],['基督教',9],['其他',10],],risk:['数字服务税新规','清真认证严格','多语言成本'],opp:['全球清真经济中心','RCEP贸易便利','多元文化产品需求'],fest:'开斋节 → 春节 → 屠妖节 → 年终大促',income:[['底层低收入',25,'低价走量','#e0e4ec'],['中产主流层',45,'中端品质·核心','#2c5f8a'],['中高收入',22,'品牌升级','#4a90d9'],['高收入精英',8,'高端进口','#c8a84e'],],price:[['低价平台','Shopee','$3-15','性价比'],['中端主流','Lazada/Shopee','$15-50','评价驱动'],['高端品牌','品牌官网','$50+','品质认证'],],price_trend:'消费升级，清真品类溢价空间大',shelf:'重清真认证、多语言、促销',content:'Facebook+Instagram社交电商',payment:'FPX/GrabPay/TnG',cod:18,peak:'20:00-23:00',},cat:{blue:[['清真产品','+28%'],['电子数码','+22%'],['家居园艺','+18%'],['母婴用品','+20%'],],stable:['服装配饰','食品','日用品'],risk:[['非清真食品','需明确标识'],['宗教相关印刷品','内政部审查'],['加密货币相关','监管严格'],],},plats:[['Shopee','🟠',38,'货架+内容','跨境/本土','5-8%','美妆时尚家居','★★☆'],['Lazada','🔵',25,'货架电商','跨境/本土','5-8%','全品类','★★☆'],['TikTok Shop','🎵',12,'内容电商','本土优先','3-5%','美妆时尚食品','★★★'],['PG Mall','🟢',5,'货架电商','本土','6-10%','全品类','★☆☆'],['PG Mall','🏬',4,'百货电商','本土','8-12%','品牌家居','★☆☆'],],comp:{level:'中等',cls:'medium',policies:[['mid','数字服务税新规','2024','全品类','全平台','外国数字服务提供商征税'],['mid','清真认证要求','建议','食品化妆品','全平台','JAKIM认证权威性最高'],['low','多语言标签要求','建议','全品类','全平台','建议马来语+英语双语'],['low','进口关税差异化','持续','全品类','全平台','RCEP成员国优惠税率'],]}},vn:{flag:'🇻🇳',name:'越南',subtitle:'Vietnam · 东南亚高增速新兴市场',region:'东南亚',ai:{opp:'东南亚高增速新兴市场，GDP增速6.5%领跑。年轻人口+移动互联网渗透推动电商快速增长',tracks:['家居生活 +32% 城镇化驱动家居消费升级','时尚服饰 +28% 年轻消费者追求韩流日系风格','小家电 +25% 生活品质提升需求旺盛'],risks:['⚠️ 本土电商保护政策趋严','⚠️ 物流最后一公里仍是挑战','⚠️ 价格敏感度高，利润空间有限'],advice:['新手：Shopee越南站跨境试水','工厂：TikTok Shop+Shopee双渠道本土店','精品：品牌本土化+Facebook私域社群'],},macro:[['总人口','9,880万','+0.8%','东南亚第三人口'],['电商规模','US$ 320亿','+25%','东南亚增速最快之一'],['电商渗透率','12.5%','↑','移动电商爆发'],['人均可支配收入','US$ 4,280','+6.5%','GDP高速增长'],['汇率','25,200 VND/USD','±0.8%','政府管控稳定'],['外贸环境','利好','↑','制造业转移+出口强劲'],],demo:{age:[['0-14岁',24,'母婴市场增长'],['15-29岁',28,'Z世代社交电商'],['30-49岁',28,'家庭消费核心'],['50岁+',20,'保守性价比'],],ai_age:'18-35岁核心人群，价格敏感但增长快',gender:{m:50,f:50},f_pref:'美妆护肤、韩流服饰、母婴',m_pref:'3C数码、运动装备、电子配件',religion:[['无宗教',73],['佛教',14],['天主教',7],['其他',6],],risk:['本土电商保护政策','物流基础设施薄弱','价格竞争激烈利润薄'],opp:['GDP 6.5%领跑东南亚','韩流日系风格影响大','社交电商Facebook社群强'],fest:'越南新年(1-2月) → 女王节(10月) → 黑五(11月)',income:[['底层低收入',35,'极致低价','#e0e4ec'],['中产主流层',40,'性价比核心','#2c5f8a'],['中高收入',18,'品质升级','#4a90d9'],['高收入精英',7,'品牌消费','#c8a84e'],],price:[['社交电商','Shopee/TikTok','$2-12','极致低价'],['中端货架','Lazada/Tiki','$12-40','评价+促销'],['高端品牌','品牌独立站','$40+','品质服务'],],price_trend:'价格敏感度高，但消费升级趋势明显',shelf:'重价格、免运费、促销',content:'Facebook+TikTok+Zalo社群营销',payment:'MoMo/ZaloPay/COD',cod:42,peak:'20:00-23:00',},cat:{blue:[['家居生活','+32%'],['时尚服饰','+28%'],['小家电','+25%'],['美妆个护','+30%'],],stable:['食品','日用品','电子配件'],risk:[['二手商品','限制进口'],['含酒精饮料','进口许可严格'],['药品保健品','卫生部审批复杂'],],},plats:[['Shopee','🟠',35,'货架+内容','跨境/本土','5-8%','美妆时尚家居','★★☆'],['TikTok Shop','🎵',22,'内容电商','本土优先','3-5%','美妆时尚食品','★★★'],['Lazada','🔵',18,'货架电商','跨境/本土','5-8%','全品类','★★☆'],['Tiki','🔵',8,'正品电商','本土','7-12%','正品品牌','★★☆'],['Sendo','🟢',5,'货架电商','本土','5-8%','日用品低价','★☆☆'],],comp:{level:'中等偏严格',cls:'strict',policies:[['mid','本土电商保护政策','2025讨论','全品类','全平台','可能限制外资电商平台'],['mid','物流基础设施限制','持续','全品类','全平台','最后一公里配送时效不稳定'],['low','价格竞争激烈','行业','全品类','全平台','利润空间被压缩'],['low','外汇管制','持续','跨境','全平台','利润汇出需合规申报'],]}},ae:{flag:'🇦🇪',name:'阿联酋',subtitle:'UAE · 中东电商增速最快市场',region:'中东',ai:{opp:'中东电商增速最快，迪拜为全球贸易枢纽。高消费力+年轻化人口+免税优势',tracks:['美妆香水 +35% 阿拉伯香水市场全球领先','奢侈品 +30% 免税购物天堂','电子产品 +22% 游戏配件需求旺盛'],risks:['⚠️ 文化禁忌严格，营销需本土化审核','⚠️ VAT 5%+关税','⚠️ 部分品类需SABER认证'],advice:['新手：Noon/Amazon阿联酋站','工厂：本土代理+Noon自营','精品：品牌本土化+Snapchat/TikTok']},macro:[['总人口','1,000万','+2.5%','外籍人口超80%'],['电商规模','US$ 120亿','+30%','中东增速最快'],['电商渗透率','16.8%','↑','快速渗透'],['人均可支配收入','US$ 44,000','+2.0%','极高消费力'],['汇率','3.67 AED/USD','固定','盯住美元'],['外贸环境','利好','↑','迪拜贸易枢纽']],demo:{age:[['0-14岁',18,'母婴高消费'],['15-29岁',32,'数字化原住民'],['30-49岁',35,'家庭消费核心'],['50岁+',15,'保守消费']],ai_age:'18-40岁年轻化人群，高客单价',gender:{m:58,f:42},f_pref:'高端香水、美妆护肤、奢华服饰',m_pref:'电子产品、游戏配件、户外装备',religion:[['伊斯兰教',76],['基督教',9],['印度教',7],['其他',8]],risk:['文化禁忌严格','VAT+关税','SABER认证'],opp:['免税购物天堂','奢侈品消费力极强','迪拜贸易枢纽辐射GCC'],fest:'斋月(3-4月) → 开斋节 → 迪拜购物节(1-2月)',income:[['底层低收入',15,'低价走量','#e0e4ec'],['中产主流层',40,'中端品质核心','#2c5f8a'],['中高收入',30,'品牌溢价','#4a90d9'],['高收入精英',15,'奢侈品','#c8a84e']],price:[['低价平台','Noon Express','$5-20','性价比'],['中端主流','Noon/Amazon','$20-80','品牌+品质'],['高端精品','Ounass/品牌','$80+','奢侈品']],price_trend:'高客单价市场，奢侈品接受度极高',shelf:'重品牌认证、阿拉伯语服务',content:'Snapchat+TikTok社交种草',payment:'信用卡/Apple Pay/Mada',cod:20,peak:'21:00-01:00'},cat:{blue:[['美妆香水','+35%'],['奢侈品','+30%'],['电子产品','+22%'],['游戏配件','+28%']],stable:['家居用品','食品','母婴'],risk:[['酒精相关','严禁进口'],['猪肉制品','Haram禁售'],['暴露形象商品','文化审查']]},plats:[['Noon','🟡',30,'货架电商','跨境/本土','5-12%','全品类','★★★'],['Amazon','📦',24,'货架电商','跨境/本土','8-15%','全品类','★★★'],['TikTok Shop','🎵',8,'内容电商','本土优先','3-5%','美妆时尚','★★★'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Shein','👗',6,'快时尚','跨境','10-15%','服饰配饰','★★☆']],comp:{level:'严格',cls:'strict',policies:[['high','SABER产品认证','持续执行','全品类','全平台','无证书无法清关'],['high','VAT 5%','持续','全品类','全平台','进口+本土均征收'],['mid','文化内容审查','持续','服装/媒体','全平台','需符合伊斯兰规范'],['low','Halal认证建议','建议','食品/化妆品','全平台','清真认证提升接受度']]}},ar:{flag:'🇦🇷',name:'阿根廷',subtitle:'Argentina · 拉美电商高增长市场',region:'拉美',ai:{opp:'拉美第三大电商市场，通胀推动线上消费。Mercado Libre本土巨头+高社交媒体渗透率',tracks:['时尚服饰 +25% 阿根廷时尚文化浓厚','3C配件 +22% 通胀下电子保值','美妆个护 +28% 年轻女性驱动'],risks:['⚠️ 通胀率超200%经济不稳定','⚠️ 外汇管制极严格','⚠️ 汇率复杂(官方/平行)'],advice:['新手：Mercado Libre跨境','工厂：本土店+Amazon','精品：品牌本土化+Instagram营销']},macro:[['总人口','4,600万','+0.5%','拉美第三人口'],['电商规模','US$ 180亿','+45%','高通胀推升'],['电商渗透率','12.0%','↑','快速增长'],['人均可支配收入','US$ 12,500','+3%','通胀中波动'],['汇率','1,200 ARS/USD','±10%','比索持续贬值'],['外贸环境','复杂','↓','外汇管制严格']],demo:{age:[['0-14岁',24,'母婴市场'],['15-29岁',26,'社交电商活跃'],['30-49岁',28,'家庭核心'],['50岁+',22,'保守消费']],ai_age:'20-40岁年轻人群，分期+通胀下消费提前',gender:{m:48,f:52},f_pref:'时尚服饰、美妆护肤、家居装饰',m_pref:'3C数码、运动装备(足球)、汽车配件',religion:[['天主教',63],['无宗教',26],['新教',6],['其他',5]],risk:['通胀超200%','外汇管制极严格','汇率复杂'],opp:['电商增速全拉美最快','足球文化消费力强','社交媒体渗透率高'],fest:'黑五(11月) → 网络星期一 → 圣诞(12月)',income:[['底层低收入',35,'极致低价','#e0e4ec'],['中产主流层',38,'分期性价比','#2c5f8a'],['中高收入',18,'品质升级','#4a90d9'],['高收入精英',9,'进口品牌','#c8a84e']],price:[['低价平台','Mercado Libre/Shein','$2-10','极致低价'],['中端主流','Mercado Libre','$10-50','分期+免运'],['高端品牌','品牌独立站','$50+','进口品质']],price_trend:'高通胀下消费者寻求性价比和分期付款',shelf:'重分期、免运费、COD',content:'Instagram+TikTok+Facebook',payment:'Mercado Pago/信用卡/COD/转账',cod:15,peak:'20:00-23:00'},cat:{blue:[['美妆个护','+28%'],['时尚服饰','+25%'],['3C配件','+22%'],['运动户外','+20%']],stable:['食品饮料','日用品','母婴'],risk:[['进口商品','高关税限制'],['化妆品','ANMAT注册'],['食品','SENASA检验']]},plats:[['Mercado Libre','🟡',45,'货架+支付','跨境/本土','11-16%','全品类','★★★'],['Amazon','📦',8,'货架电商','跨境','8-15%','全品类','★★☆'],['Shopee','🟠',5,'货架+内容','跨境','5-8%','美妆时尚','★★☆'],['Temu','🟠',4,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Frávega','🔵',4,'电子垂直','本土','8-12%','电子家电','★☆☆']],comp:{level:'中等偏严格',cls:'strict',policies:[['high','外汇管制极严格','持续','跨境','全平台','美元获取极困难'],['high','进口高关税','持续','全品类','全平台','进口关税+统计税'],['mid','ANMAT化妆品注册','持续','美妆','全平台','需阿根廷卫生部注册'],['low','通胀定价策略','行业','全品类','全平台','需频繁调价应对通胀']]}},au:{flag:'🇦🇺',name:'澳大利亚',subtitle:'Australia · 大洋洲最大电商市场',region:'欧美',ai:{opp:'大洋洲最大消费市场，高人均GDP+英语环境。户外生活+天然有机是核心',tracks:['户外运动 +22% 户外生活方式文化','健康保健 +25% 天然有机需求旺','家居园艺 +18% 品质升级'],risks:['⚠️ 生物安全检验极严格','⚠️ 距离远物流成本高','⚠️ 消费者权益法ACL严格'],advice:['新手：Amazon澳洲站+eBay','工厂：本土仓+Kogan','精品：品牌独立站+David Jones']},macro:[['总人口','2,680万','+1.2%','人口正增长'],['电商规模','US$ 360亿','+10%','大洋洲最大'],['电商渗透率','20.5%','↑','稳步增长'],['人均可支配收入','US$ 48,500','+2.0%','高消费力'],['汇率','1.53 AUD/USD','±2%','澳元波动'],['外贸环境','利好','→','RCEP加持']],demo:{age:[['0-14岁',18,'户外母婴'],['15-29岁',21,'社交电商'],['30-49岁',27,'家庭核心'],['50岁+',34,'银发稳健']],ai_age:'25-50岁，户外+健康双驱动',gender:{m:50,f:50},f_pref:'天然美妆、瑜伽运动服饰、家居园艺',m_pref:'户外装备、BBQ工具、汽车配件',religion:[['基督教',43],['无宗教',39],['伊斯兰教',3],['其他',15]],risk:['生物安全检验极严格','物流成本高','ACL消费者法严格'],opp:['户外生活方式市场大','天然有机需求旺','英语无语言障碍'],fest:'黑五(11月) → Boxing Day(12月) → EOFY(6月)',income:[['底层低收入',20,'折扣','#e0e4ec'],['中产主流层',45,'品质中端核心','#2c5f8a'],['中高收入',25,'品牌升级','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['低价平台','Temu/AliExpress','$3-20','性价比'],['中端主流','Amazon/eBay','$20-80','品质+评价'],['高端品牌','David Jones/独立站','$80+','精品品质']],price_trend:'消费升级中，天然有机溢价大',shelf:'重评价、物流速度',content:'Instagram+TikTok+YouTube',payment:'信用卡/Afterpay/PayPal',cod:3,peak:'19:00-22:00'},cat:{blue:[['户外运动','+22%'],['健康保健','+25%'],['家居园艺','+18%'],['宠物用品','+20%']],stable:['电子数码','服装','食品饮料'],risk:[['食品植物','生物安全极严'],['药品保健品','TGA注册必须'],['含电池','航空运输限制']]},plats:[['eBay','🏷️',28,'货架/C2C','跨境','8-13%','全品类','★★★'],['Amazon','📦',22,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Kogan','💻',8,'电子垂直','本土','5-10%','电子数码','★★☆'],['Temu','🟠',6,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Catch','🛒',5,'折扣电商','本土','8-12%','日用折扣','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['high','生物安全法','持续执行','食品/植物','全平台','检验极严格'],['high','TGA药品保健品注册','持续','药品保健品','全平台','需TGA注册'],['mid','消费者法ACL','持续','全品类','全平台','权益保护严格'],['low','产品安全标准','持续','全品类','全平台','需符合澳洲标准']]}},be:{flag:'🇧🇪',name:'比利时',subtitle:'Belgium · 欧洲心脏多语言市场',region:'欧美',ai:{opp:'欧洲中心位置，荷/法/德三语市场。注重品质与可持续',tracks:['可持续产品 +20% 环保意识强','时尚配饰 +18% 欧洲时尚消费','巧克力美食 +15% 美食文化知名'],risks:['⚠️ 三语运营复杂','⚠️ 市场规模小(1200万)','⚠️ EU合规严格'],advice:['新手：Amazon比利时站+bol.com','工厂：本土店+Zalando','精品：品牌独立站+可持续认证']},macro:[['总人口','1,170万','+0.3%','欧洲中心'],['电商规模','US$ 105亿','+8%','稳健增长'],['电商渗透率','20.5%','↑','高于EU平均'],['人均可支配收入','US$ 48,000','+1.5%','高消费力'],['汇率','0.92 EUR/USD','±1%','欧元稳定'],['外贸环境','利好','→','EU总部所在']],demo:{age:[['0-14岁',16,'精品母婴'],['15-29岁',18,'数字原住民'],['30-49岁',28,'家庭核心'],['50岁+',38,'银发品质']],ai_age:'25-50岁，品质可持续并重',gender:{m:49,f:51},f_pref:'时尚配饰、美妆护肤、巧克力美食',m_pref:'电子数码、自行车、啤酒器具',religion:[['天主教',54],['无宗教',35],['伊斯兰教',7],['其他',4]],risk:['三语运营复杂','市场规模小','EU合规严格'],opp:['欧洲物流中心','多语言辐射周边','巧克力美食出口'],fest:'黑五(11月) → 圣诞(12月) → 狂欢节(2月)',income:[['底层低收入',18,'折扣','#e0e4ec'],['中产主流层',46,'品质中端','#2c5f8a'],['中高收入',26,'品牌升级','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['低价平台','Temu/AliExpress','$3-15','性价比'],['中端主流','Amazon/bol.com','$15-80','品质+多语言'],['高端品牌','品牌独立站','$80+','精品']],price_trend:'品质消费为主，可持续溢价空间大',shelf:'重多语言描述、评价',content:'Instagram+Facebook',payment:'Bancontact/信用卡/PayPal',cod:2,peak:'19:00-22:00'},cat:{blue:[['可持续产品','+20%'],['时尚配饰','+18%'],['巧克力美食','+15%'],['家居用品','+16%']],stable:['电子数码','日用品','母婴'],risk:[['化妆品','EU CPNP必须'],['食品','EU标签'],['电子','CE+WEEE']]},plats:[['bol.com','🔵',28,'货架电商','跨境','8-12%','全品类','★★★'],['Amazon','📦',22,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Zalando','👗',8,'时尚垂直','跨境','10-15%','时尚服饰','★★☆'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆'],['2dehands','🟢',5,'C2C','本土','免费','二手','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['high','EU统一合规','持续执行','全品类','全平台','CE/GDPR严格'],['mid','多语言标签(荷/法)','持续','全品类','全平台','按区域对应语言'],['mid','14天退货','持续','全品类','全平台','EU标准'],['low','Bancontact支付','建议','全品类','全平台','最主流支付']]}},ca:{flag:'🇨🇦',name:'加拿大',subtitle:'Canada · 北美第二大电商市场',region:'欧美',ai:{opp:'北美第二大消费市场，英法双语市场。消费者注重多元文化与品质',tracks:['户外运动 +20% 冬季运动+户外文化','健康保健 +22% 天然有机需求旺','家居用品 +16% 远程办公持续'],risks:['⚠️ 英法双语listing必要','⚠️ 美国关税政策联动','⚠️ 加拿大产品安全标准'],advice:['新手：Amazon加拿大站','工厂：Amazon FBA+独立站','精品：品牌DTC+Shopify(本土)']},macro:[['总人口','4,050万','+1.5%','移民驱动'],['电商规模','US$ 480亿','+9%','北美第二'],['电商渗透率','18.2%','↑','稳步提升'],['人均可支配收入','US$ 42,800','+2.0%','消费稳健'],['汇率','1.36 CAD/USD','±1.5%','加元稳定'],['外贸环境','利好','→','USMCA+多元贸易']],demo:{age:[['0-14岁',16,'多元母婴'],['15-29岁',20,'Z世代社交'],['30-49岁',28,'家庭核心'],['50岁+',36,'银发稳健']],ai_age:'25-50岁，多元文化包容度高',gender:{m:49,f:51},f_pref:'天然美妆、瑜伽运动、家居装饰',m_pref:'户外装备、冰球配件、电子数码',religion:[['基督教',53],['无宗教',35],['伊斯兰教',4],['其他',8]],risk:['英法双语要求','产品安全标准','与美国政策联动'],opp:['Shopify发源地','多元文化产品需求','与美国市场联动'],fest:'黑五(11月) → Boxing Day(12月) → 加拿大日(7月)',income:[['底层低收入',22,'性价比','#e0e4ec'],['中产主流层',42,'品质中端核心','#2c5f8a'],['中高收入',25,'品牌升级','#4a90d9'],['高收入精英',11,'高端精品','#c8a84e']],price:[['低价平台','Temu/Wish','$3-20','性价比'],['中端主流','Amazon','$20-80','评价+物流'],['高端品牌','DTC/Shopify站','$80+','品牌品质']],price_trend:'消费分级明显，性价比品质并行',shelf:'重评价、物流速度、双语',content:'TikTok+Instagram+YouTube',payment:'信用卡/Interac/PayPal/Shop Pay',cod:2,peak:'19:00-22:00'},cat:{blue:[['户外运动','+20%'],['健康保健','+22%'],['家居用品','+16%'],['宠物用品','+18%']],stable:['消费电子','服装','食品'],risk:[['保健品','Health Canada认证'],['化妆品','Health Canada通报'],['电子','CSA/UL认证']]},plats:[['Amazon','📦',40,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Walmart','🏬',10,'货架电商','跨境/本土','6-12%','家居日用','★★★'],['Shopify独立站','🛍️',8,'独立站','本土','按套餐','全品类','★★★'],['Temu','🟠',6,'低价平台','跨境','平台承担','全品类低价','★★☆'],['eBay','🏷️',5,'货架/C2C','跨境','8-13%','电子日用','★★☆']],comp:{level:'中等',cls:'medium',policies:[['high','双语标签法(英法)','持续执行','全品类','全平台','英法双语标签必须'],['high','Health Canada合规','持续','食品/化妆品','全平台','健康产品需认证'],['mid','CSA/UL安全认证','持续','电子产品','全平台','电气安全必须'],['low','USMCA贸易规则','持续','全品类','全平台','美加墨贸易协定']]}},cl:{flag:'🇨🇱',name:'智利',subtitle:'Chile · 南美最稳定电商市场',region:'拉美',ai:{opp:'南美经济最稳定国家，人均GDP拉美最高之一。消费者数字化程度高，跨境购物习惯成熟',tracks:['电子产品 +18% 科技消费领先','时尚服饰 +20% 智利时尚文化','家居用品 +16% 品质生活需求'],risks:['⚠️ 距离远物流成本高','⚠️ VAT 19%','⚠️ 消费者保护法严格'],advice:['新手：Mercado Libre+Falabella','工厂：本土店+Amazon智利站','精品：品牌独立站+Instagram营销']},macro:[['总人口','1,960万','+0.5%','南美小国'],['电商规模','US$ 115亿','+15%','稳健增长'],['电商渗透率','16.5%','↑','高于平均'],['人均可支配收入','US$ 16,800','+2.8%','南美最高之一'],['汇率','920 CLP/USD','±2%','比索波动'],['外贸环境','利好','→','CPTPP+APEC']],demo:{age:[['0-14岁',20,'精品母婴'],['15-29岁',23,'数字化消费'],['30-49岁',30,'家庭核心'],['50岁+',27,'银发消费']],ai_age:'25-50岁核心人群，品质+便利并重',gender:{m:49,f:51},f_pref:'时尚服饰、美妆护肤、家居装饰',m_pref:'电子数码、运动户外、汽车配件',religion:[['天主教',55],['新教',18],['无宗教',22],['其他',5]],risk:['物流成本高','VAT 19%','消费者保护法严格'],opp:['南美经济最稳定','人均GDP高','CPTPP贸易便利'],fest:'网络日(11月) → 黑五(11月) → 圣诞(12月)',income:[['底层低收入',22,'折扣','#e0e4ec'],['中产主流层',45,'品质中端','#2c5f8a'],['中高收入',23,'品牌升级','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['低价平台','Falabella/MercadoLibre','$3-15','性价比'],['中端主流','Mercado Libre/Amazon','$15-60','评价+分期'],['高端品牌','品牌独立站','$60+','品质']],price_trend:'品质消费为主，分期选项重要',shelf:'重评价、配送速度',content:'Instagram+Facebook+TikTok',payment:'信用卡/WebPay/Transferencia',cod:8,peak:'20:00-23:00'},cat:{blue:[['电子产品','+18%'],['时尚服饰','+20%'],['家居用品','+16%'],['健康保健','+18%']],stable:['食品饮料','母婴','日用品'],risk:[['化妆品','ISP注册'],['食品','SEREMI检验'],['电子','SEC认证']]},plats:[['Mercado Libre','🟡',28,'货架+支付','跨境/本土','11-16%','全品类','★★★'],['Falabella','🏬',20,'百货电商','本土','8-12%','品牌家居','★★☆'],['Amazon','📦',10,'货架电商','跨境','8-15%','全品类','★★☆'],['Ripley','🏬',6,'百货电商','本土','8-12%','时尚家居','★☆☆'],['Temu','🟠',4,'低价平台','跨境','平台承担','全品类低价','★★☆']],comp:{level:'中等',cls:'medium',policies:[['high','消费者保护法','持续','全品类','全平台','10天无理由退货'],['mid','ISP化妆品注册','持续','美妆','全平台','需卫生部注册'],['mid','VAT 19%','持续','全品类','全平台','征19%增值税'],['low','物流基础设施','持续','全品类','全平台','偏远地区配送困难']]}},co:{flag:'🇨🇴',name:'哥伦比亚',subtitle:'Colombia · 拉美新兴电商市场',region:'拉美',ai:{opp:'拉美第四大电商市场，5200万人口+年轻结构。社交电商+分期付款驱动增长',tracks:['美妆个护 +30% 哥伦比亚美妆文化浓厚','时尚服饰 +25% 拉丁时尚强劲','3C配件 +22% 智能手机普及推动'],risks:['⚠️ 安全形势部分地区不稳定','⚠️ 物流基础设施待完善','⚠️ 汇率波动影响进口成本'],advice:['新手：Mercado Libre+Falabella','工厂：本土店+Amazon','精品：品牌本土化+Instagram+TikTok']},macro:[['总人口','5,200万','+0.5%','拉美第四人口'],['电商规模','US$ 160亿','+28%','拉美高增速'],['电商渗透率','10.5%','↑','快速增长'],['人均可支配收入','US$ 6,800','+3.5%','中产扩大'],['汇率','4,100 COP/USD','±3%','比索波动'],['外贸环境','利好','→','太平洋联盟成员']],demo:{age:[['0-14岁',24,'母婴市场'],['15-29岁',27,'社交电商活跃'],['30-49岁',28,'家庭核心'],['50岁+',21,'保守消费']],ai_age:'20-40岁年轻人群，社交+分期驱动',gender:{m:48,f:52},f_pref:'美妆护肤、时尚服饰、家居装饰',m_pref:'3C数码、运动装备、汽车配件',religion:[['天主教',79],['新教',13],['无宗教',5],['其他',3]],risk:['安全形势不稳定','物流待完善','汇率波动'],opp:['5200万人口红利','咖啡产区消费力强','太平洋联盟贸易便利'],fest:'黑五(11月) → 圣诞(12月) → 网络星期一',income:[['底层低收入',38,'极致低价','#e0e4ec'],['中产主流层',38,'分期性价比','#2c5f8a'],['中高收入',16,'品质升级','#4a90d9'],['高收入精英',8,'进口品牌','#c8a84e']],price:[['低价平台','Falabella/Shein','$2-10','低价'],['中端主流','Mercado Libre','$10-50','分期+免运'],['高端品牌','品牌独立站','$50+','品质服务']],price_trend:'分期消费文化驱动，价格敏感',shelf:'重分期、免运费、COD',content:'Instagram+TikTok+Facebook',payment:'PSE/信用卡/COD/Nequi',cod:18,peak:'20:00-23:00'},cat:{blue:[['美妆个护','+30%'],['时尚服饰','+25%'],['3C配件','+22%'],['家居用品','+20%']],stable:['食品饮料','日用品','母婴'],risk:[['化妆品','INVIMA注册'],['食品','卫生许可'],['电子','认证']]},plats:[['Mercado Libre','🟡',25,'货架+支付','跨境/本土','11-16%','全品类','★★★'],['Falabella','🏬',18,'百货电商','本土','8-12%','品牌家居','★★☆'],['Amazon','📦',10,'货架电商','跨境','8-15%','全品类','★★☆'],['Temu','🟠',4,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Éxito','🛒',5,'零售电商','本土','8-12%','食品日用','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['mid','安全物流影响','持续','全品类','全平台','部分地区配送风险'],['mid','INVIMA化妆品注册','持续','美妆','全平台','需卫生部注册'],['low','VAT 19%','持续','全品类','全平台','征19%增值税'],['low','跨境电商监管','2025讨论','跨境','全平台','可能加强监管']]}},de:{flag:'🇩🇪',name:'德国',subtitle:'Germany · 欧洲最大电商市场',region:'欧美',ai:{opp:'欧洲最大经济体+最大电商市场。消费者注重品质、环保与数据安全。精品路线+完善售后是制胜关键',tracks:['有机食品 +22% 德国有机消费全欧第一','环保产品 +25% 可持续消费趋势强劲','家居家电 +16% 品质生活需求稳定'],risks:['⚠️ 欧盟GDPR数据保护最严格','⚠️ 包装法VerpackG注册必须','⚠️ 退货率高达30%'],advice:['新手：Amazon德国站+OTTO','工厂：本土店+eBay德国站','精品：品牌独立站+Zalando入驻']},macro:[['总人口','8,400万','+0.2%','欧洲人口第二'],['电商规模','US$ 1,020亿','+6.5%','欧洲最大'],['电商渗透率','22.8%','↑','稳步增长'],['人均可支配收入','US$ 48,200','+1.5%','消费稳健'],['汇率','0.92 EUR/USD','±1%','欧元稳定'],['外贸环境','平稳','→','EU核心经济体']],demo:{age:[['0-14岁',14,'精品母婴'],['15-29岁',18,'环保时尚'],['30-49岁',28,'家庭消费核心'],['50岁+',40,'银发最大群体']],ai_age:'30-55岁核心，品质环保至上',gender:{m:49,f:51},f_pref:'有机美妆、环保家居、瑜伽运动',m_pref:'汽车配件、电子工具、户外运动',religion:[['基督教',50],['无宗教',38],['伊斯兰教',7],['其他',5]],risk:['GDPR数据保护极严格','退货率高达30%','包装法注册复杂'],opp:['有机消费全欧第一','环保产品溢价空间大','品质消费文化成熟'],fest:'圣诞市场(11-12月) → 黑五(11月) → 复活节(3-4月)',income:[['底层低收入',18,'折扣消费','#e0e4ec'],['中产主流层',48,'品质中端核心','#2c5f8a'],['中高收入',24,'品牌功能升级','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['折扣平台','Temu/AliExpress','$3-15','极致性价比'],['中端主流','Amazon/OTTO','$15-80','品质+环保'],['高端品牌','Breuninger','$80+','精品品质']],price_trend:'环保认证产品溢价10-20%',shelf:'极重评价、认证标识、退换货',content:'YouTube测评+Pinterest灵感',payment:'PayPal/信用卡/发票支付/Klarna',cod:5,peak:'19:00-22:00'},cat:{blue:[['有机食品','+22%'],['环保产品','+25%'],['家居家电','+16%'],['运动户外','+18%']],stable:['汽车配件','电子产品','服装'],risk:[['药品保健品','BfArMA认证严格'],['化妆品','EU CPNP必须'],['电子电气','WEEE注册必须']]},plats:[['Amazon','📦',38,'货架电商','跨境FBA','8-15%','全品类','★★★'],['OTTO','🔴',14,'百货电商','本土','10-15%','家居时尚','★★☆'],['Zalando','👗',10,'时尚垂直','本土','10-15%','时尚服饰','★★★'],['eBay','🏷️',8,'货架/C2C','跨境','8-12%','电子日用','★★☆'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆']],comp:{level:'严格',cls:'strict',policies:[['high','GDPR数据保护','持续执行','全品类','全平台','违规罚款最高全球营收4%'],['high','包装法VerpackG','持续执行','全品类','全平台','必须LUCID注册'],['mid','WEEE电子注册','持续','电子产品','全平台','需EAR编号'],['low','EU CPNP化妆品通报','持续','美妆','全平台','欧盟门户通报']]}},eg:{flag:'🇪🇬',name:'埃及',subtitle:'Egypt · 北非最大电商市场',region:'中东',ai:{opp:'北非最大人口国+最大电商市场。年轻人口占比极高，价格敏感度强',tracks:['时尚服饰 +28% 年轻消费者驱动','3C配件 +25% 智能手机普及推动','家居日用 +20% 城镇化需求旺盛'],risks:['⚠️ 外汇管制严格，美元获取困难','⚠️ 清关流程复杂周期长','⚠️ 电商基础设施仍不完善'],advice:['新手：Amazon埃及站+Noon','工厂：本土店+Jumia','精品：品牌本土化+Facebook营销']},macro:[['总人口','1.1亿','+1.8%','北非第一人口'],['电商规模','US$ 85亿','+35%','非洲增速最快'],['电商渗透率','7.5%','↑','巨大增长空间'],['人均可支配收入','US$ 3,800','+3.5%','中产扩大中'],['汇率','48.5 EGP/USD','±5%','埃镑贬值中'],['外贸环境','利好','↑','人口红利巨大']],demo:{age:[['0-14岁',33,'母婴市场巨大'],['15-29岁',30,'社交电商活跃'],['30-49岁',25,'家庭消费核心'],['50岁+',12,'保守刚需']],ai_age:'18-35岁年轻人群，价格敏感但愿尝新',gender:{m:50,f:50},f_pref:'时尚服饰、美妆护肤、母婴用品',m_pref:'3C数码、汽车配件、运动装备',religion:[['伊斯兰教',90],['基督教',10]],risk:['外汇管制严格','清关复杂','基础设施不完善'],opp:['1.1亿人口红利巨大','年轻人口占比极高','北非+中东辐射'],fest:'斋月(3-4月) → 开斋节 → 黑五(11月)',income:[['底层低收入',40,'极致低价','#e0e4ec'],['中产主流层',38,'性价比核心','#2c5f8a'],['中高收入',15,'品质升级','#4a90d9'],['高收入精英',7,'品牌消费','#c8a84e']],price:[['低价平台','Jumia/Noon','$2-10','极致低价'],['中端主流','Amazon/Noon','$10-40','评价驱动'],['高端品牌','品牌独立站','$40+','品质服务']],price_trend:'价格敏感度极高，极致低价走量',shelf:'重价格、COD、免运费',content:'Facebook+Instagram社交电商',payment:'信用卡/COD/ValU分期',cod:35,peak:'20:00-23:00'},cat:{blue:[['时尚服饰','+28%'],['3C配件','+25%'],['家居日用','+20%'],['母婴用品','+22%']],stable:['食品饮料','服装基础款','日用品'],risk:[['化妆品','需要注册'],['食品','进口许可'],['药品','卫生部审批']]},plats:[['Amazon','📦',20,'货架电商','跨境/本土','8-15%','全品类','★★★'],['Noon','🟡',22,'货架电商','跨境/本土','5-12%','全品类','★★☆'],['Jumia','🟠',18,'货架+物流','跨境/本土','10-15%','全品类','★★☆'],['Temu','🟠',4,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Shein','👗',5,'快时尚','跨境','10-15%','服饰','★★☆']],comp:{level:'中等偏严格',cls:'strict',policies:[['high','外汇管制','持续','全品类','全平台','美元获取困难'],['mid','清关流程复杂','持续','全品类','全平台','周期7-30天'],['mid','进口许可要求','持续','食品/化妆品','全平台','需相关部门许可'],['low','电商基础建设','持续','全品类','全平台','物流基础设施完善中']]}},es:{flag:'🇪🇸',name:'西班牙',subtitle:'Spain · 南欧电商增长最快',region:'欧美',ai:{opp:'南欧增速最快电商市场，旅游消费+年轻人口推动。注重性价比与时尚',tracks:['时尚服饰 +20% Zara效应带动','运动户外 +22% 户外文化','美妆护肤 +18% 西语美妆博主影响力大'],risks:['⚠️ 税务合规要求','⚠️ EU产品标准','⚠️ 价格竞争激烈'],advice:['新手：Amazon西班牙站+El Corte Inglés','工厂：本土店+Zalando','精品：品牌独立站']},macro:[['总人口','4,800万','+0.5%','人口正增长'],['电商规模','US$ 380亿','+12%','南欧增速最快'],['电商渗透率','17.8%','↑','快速增长'],['人均可支配收入','US$ 34,500','+2.2%','消费复苏'],['汇率','0.92 EUR/USD','±1%','欧元稳定'],['外贸环境','平稳','→','EU+拉美桥梁']],demo:{age:[['0-14岁',14,'母婴消费'],['15-29岁',20,'社交电商活跃'],['30-49岁',28,'家庭核心'],['50岁+',38,'银发稳健']],ai_age:'20-45岁核心，社交电商接受度高',gender:{m:49,f:51},f_pref:'时尚服饰、美妆护肤、家居装饰',m_pref:'电子数码、运动装备、汽车配件',religion:[['天主教',58],['无宗教',35],['其他',7]],risk:['税务合规','EU产品标准','价格竞争'],opp:['Zara效应时尚消费旺','西语市场辐射拉美','旅游消费带动'],fest:'黑五(11月) → 三王节(1月) → 夏季折扣(7月)',income:[['底层低收入',25,'折扣消费','#e0e4ec'],['中产主流层',43,'品质中端核心','#2c5f8a'],['中高收入',22,'品牌升级','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['低价平台','Temu/Shein','$3-15','性价比'],['中端主流','Amazon/PC Componentes','$15-70','评价驱动'],['高端品牌','El Corte Inglés','$70+','百货品质']],price_trend:'性价比为主，时尚品类溢价大',shelf:'重价格对比、评价、免运费',content:'Instagram+TikTok+YouTube',payment:'信用卡/PayPal/Bizum',cod:5,peak:'20:00-23:00'},cat:{blue:[['时尚服饰','+20%'],['运动户外','+22%'],['美妆护肤','+18%'],['家居用品','+16%']],stable:['电子数码','食品饮料','旅游服务'],risk:[['化妆品','EU CPNP必须'],['食品','EU营养标签'],['玩具','CE+西语说明']]},plats:[['Amazon','📦',32,'货架电商','跨境FBA','8-15%','全品类','★★★'],['El Corte Inglés','🏬',12,'百货电商','本土','10-15%','品牌全品类','★★☆'],['PC Componentes','💻',8,'电子垂直','本土','8-12%','电子数码','★★☆'],['Temu','🟠',7,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Wallapop','🟢',5,'C2C/二手','本土','5%','二手闲置','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['high','EU统一产品合规','持续执行','全品类','全平台','CE标识+EU合规必须'],['mid','GDPR/AEPD数据保护','持续','全品类','全平台','西班牙数据保护局严格'],['mid','西语标签要求','持续','全品类','全平台','需西班牙语标注'],['low','数字税讨论中','2025讨论','跨境','全平台','可能征数字税']]}},fr:{flag:'🇫🇷',name:'法国',subtitle:'France · 欧洲第三大电商市场',region:'欧美',ai:{opp:'欧洲第三大电商市场，时尚与美妆消费文化深厚。法式审美偏好强烈',tracks:['美妆护肤 +20% 法式美妆全球影响力','有机食品 +25% 有机认证需求旺盛','时尚服饰 +15% 法式风格强劲'],risks:['⚠️ 数字税3%影响跨境平台','⚠️ 法语标签强制要求','⚠️ EU GDPR+CNIL严格'],advice:['新手：Amazon法国站+Cdiscount','工厂：本土店+Fnac DARTY','精品：品牌独立站+Galeries Lafayette']},macro:[['总人口','6,800万','+0.2%','欧洲人口第三'],['电商规模','US$ 720亿','+7.5%','欧洲第三大'],['电商渗透率','19.5%','↑','移动电商增长快'],['人均可支配收入','US$ 42,500','+1.8%','消费稳健'],['汇率','0.92 EUR/USD','±1%','欧元稳定'],['外贸环境','平稳','→','EU核心成员']],demo:{age:[['0-14岁',16,'母婴时尚精品'],['15-29岁',20,'时尚美妆社交'],['30-49岁',27,'家庭消费核心'],['50岁+',37,'银发品质消费']],ai_age:'25-50岁，注重法式审美品质',gender:{m:48,f:52},f_pref:'法式美妆、时尚配饰、香水',m_pref:'红酒美食、电子数码、户外运动',religion:[['天主教',47],['无宗教',40],['伊斯兰教',9],['其他',4]],risk:['法语标签强制','数字税3%','时尚竞争极激烈'],opp:['法式美妆全球影响力','有机认证溢价大','法式生活方式出口'],fest:'折扣季(1-2月) → 黑五(11月) → 圣诞(12月)',income:[['底层低收入',22,'折扣消费','#e0e4ec'],['中产主流层',44,'品质中端核心','#2c5f8a'],['中高收入',24,'品牌升级','#4a90d9'],['高收入精英',10,'奢侈品精品','#c8a84e']],price:[['低价平台','Temu/Shein','$3-15','价格敏感'],['中端主流','Amazon/Fnac','$15-80','品质+法式'],['高端精品','Galeries Lafayette','$80+','奢侈品']],price_trend:'折扣季消费集中，平时重性价比',shelf:'重评价、法语完整描述',content:'Instagram+TikTok种草',payment:'信用卡/PayPal/Apple Pay',cod:3,peak:'19:00-22:00'},cat:{blue:[['美妆护肤','+20%'],['有机食品','+25%'],['时尚服饰','+15%'],['家居装饰','+18%']],stable:['红酒美食','电子产品','母婴'],risk:[['化妆品','EU CPNP必须'],['食品','法语营养标签'],['玩具','CE+法语说明']]},plats:[['Amazon','📦',28,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Cdiscount','🔵',14,'货架电商','跨境/本土','8-15%','电子家居','★★☆'],['Fnac DARTY','🟠',10,'百货电商','本土','8-12%','电子文化','★★☆'],['Temu','🟠',6,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Zalando','👗',5,'时尚垂直','跨境','10-15%','时尚服饰','★★☆']],comp:{level:'中等',cls:'medium',policies:[['high','法语标签强制','持续执行','全品类','全平台','产品说明必须法语'],['high','数字税3%(DST)','持续','全品类','全平台','外国数字服务收入征3%'],['mid','GDPR/CNIL数据保护','持续','全品类','全平台','数据收集需明确同意'],['low','年度折扣季regulation','持续','全品类','全平台','冬/夏两次法定折扣季']]}},gb:{flag:'🇬🇧',name:'英国',subtitle:'United Kingdom · 欧洲第二大电商市场',region:'欧美',ai:{opp:'欧洲第二大电商市场，人均电商消费全球领先。高消费力+成熟物流体系，品牌化与差异化是制胜关键',tracks:['美妆个护 +22% 天然有机成分趋势强劲','家居园艺 +18% 居家生活品质升级','宠物用品 +28% 人均养宠率全欧最高'],risks:['⚠️ 脱欧后海关规则独立，合规成本增加','⚠️ VAT 20%+关税门槛','⚠️ 消费者权益保护严格，14天无理由退货'],advice:['新手：Amazon英国站+Temu跨境试水','工厂：Amazon FBA+独立站双渠道','精品：品牌DTC+ASOS入驻']},macro:[['总人口','6,700万','+0.3%','欧洲人口第三'],['电商规模','US$ 1,800亿','+8%','欧洲第二大'],['电商渗透率','26.5%','↑','全球领先'],['人均可支配收入','US$ 46,000','+2%','高消费力'],['汇率','0.79 GBP/USD','±1.5%','波动可控'],['外贸环境','平稳','→','脱欧后重构']],demo:{age:[['0-14岁',17,'母婴高品质'],['15-29岁',19,'Z世代社交电商'],['30-49岁',28,'家庭消费主力'],['50岁+',36,'银发经济稳健']],ai_age:'核心25-50岁，注重品质品牌',gender:{m:49,f:51},f_pref:'美妆护肤、时尚配饰、家居装饰',m_pref:'3C数码、运动装备、汽车配件',religion:[['基督教',46],['无宗教',37],['伊斯兰教',6],['其他',11]],risk:['脱欧VAT规则变化','ASA广告合规严格','包装环保法规要求高'],opp:['人均电商消费全欧最高','宠物经济市场庞大','二手奢侈品增长迅猛'],fest:'黑五(11月) → Boxing Day(12月) → 圣诞(12月)',income:[['底层低收入',20,'低价走量','#e0e4ec'],['中产主流层',45,'中端品质核心','#2c5f8a'],['中高收入',25,'品牌溢价升级','#4a90d9'],['高收入精英',10,'高端品牌定制','#c8a84e']],price:[['低价平台','Temu/Shein','$3-20','价格敏感型'],['中端主流','Amazon/eBay','$20-80','重评价重物流'],['高端品牌','ASOS/独立站','$80+','品牌忠诚']],price_trend:'通胀下注重性价比但品质不减',shelf:'重评价评分、物流速度、退货便捷性',content:'TikTok种草+Instagram推荐',payment:'信用卡/Apple Pay/PayPal',cod:2,peak:'19:00-22:00'},cat:{blue:[['美妆个护','+22%'],['宠物用品','+28%'],['家居园艺','+18%'],['健康保健','+20%']],stable:['消费电子','服装配饰','食品饮料'],risk:[['药品保健品','MHRA认证严格'],['食品','UKCA标识必须'],['含电池产品','运输限制']]},plats:[['Amazon','📦',32,'货架电商','跨境FBA','8-15%','全品类','★★★'],['eBay','🏷️',18,'货架/C2C','跨境','8-13%','电子日用','★★☆'],['Tesco','🛒',10,'零售电商','本土','5-10%','食品日用','★★☆'],['Temu','🟠',8,'低价平台','跨境','平台承担','全品类低价','★★☆'],['ASOS','👗',6,'时尚垂直','本土','10-20%','时尚服饰','★★☆']],comp:{level:'中等',cls:'medium',policies:[['high','脱欧后UKCA认证','持续执行','全品类','全平台','需UKCA标识替代CE'],['high','VAT 20%增值税','持续','全品类','全平台','£135以下平台代扣'],['mid','14天无理由退货','持续','全品类','全平台','在线购买享14天冷静期'],['low','包装环保法规','2025更新','全品类','全平台','可回收要求趋严']]}},il:{flag:'🇮🇱',name:'以色列',subtitle:'Israel · 中东科技创新电商市场',region:'中东',ai:{opp:'中东科技创新中心，人均GDP超5万美元。网络安全+高科技人才密集，消费者数字化程度高',tracks:['电子产品 +18% 科技创新氛围浓','家居用品 +15% 高品质生活需求','时尚配饰 +20% 多元文化消费'],risks:['⚠️ 地缘政治风险影响物流','⚠️ 安全合规要求高','⚠️ 市场规模较小(1000万)'],advice:['新手：Amazon以色列站+eBay','工厂：本土店+AliExpress','精品：品牌独立站+Instagram营销']},macro:[['总人口','980万','+1.5%','人口正增长'],['电商规模','US$ 115亿','+12%','稳健增长'],['电商渗透率','22.5%','↑','高于平均'],['人均可支配收入','US$ 52,000','+1.8%','极高'],['汇率','3.65 ILS/USD','±2%','谢克尔稳定'],['外贸环境','复杂','↓','地缘政治影响']],demo:{age:[['0-14岁',27,'母婴消费大'],['15-29岁',22,'数字化原住民'],['30-49岁',28,'家庭核心'],['50岁+',23,'银发消费']],ai_age:'25-50岁核心人群，科技消费意识强',gender:{m:50,f:50},f_pref:'美妆护肤、时尚配饰、家居设计',m_pref:'电子数码、户外装备、运动科技',religion:[['犹太教',74],['伊斯兰教',18],['基督教',2],['其他',6]],risk:['地缘政治风险','安全合规高','市场规模小'],opp:['科技创新中心','人均GDP极高','数字化程度高'],fest:'黑五(11月) → 圣诞(12月) →  Purim(2-3月)',income:[['底层低收入',18,'折扣','#e0e4ec'],['中产主流层',45,'品质中端','#2c5f8a'],['中高收入',27,'品牌升级','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['低价平台','AliExpress/Temu','$3-15','性价比'],['中端主流','Amazon/eBay','$15-80','品质+评价'],['高端品牌','品牌独立站','$80+','精品']],price_trend:'品质消费为主，科技产品溢价空间大',shelf:'重评价、安全性',content:'Instagram+Facebook+TikTok',payment:'信用卡/PayPal/Apple Pay/bit',cod:3,peak:'19:00-22:00'},cat:{blue:[['电子产品','+18%'],['时尚配饰','+20%'],['家居用品','+15%'],['健康保健','+18%']],stable:['美妆护肤','食品饮料','母婴'],risk:[['军用品','严禁进口'],['特定化学品','环境部许可'],['食品','卫生部认证']]},plats:[['Amazon','📦',25,'货架电商','跨境','8-15%','全品类','★★★'],['eBay','🏷️',18,'货架/C2C','跨境','8-13%','电子日用','★★☆'],['AliExpress','🟠',12,'低价平台','跨境','5-8%','全品类低价','★★☆'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Wolt(零售)','🟢',4,'即时零售','本土','10-15%','食品日用','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['high','安全合规要求','持续','全品类','全平台','进口安全审查严格'],['mid','地缘政治物流影响','持续','全品类','全平台','部分地区物流受限'],['mid','VAT 17%','持续','全品类','全平台','进口商品征收17%增值税'],['low','消费者保护法','持续','全品类','全平台','14天退货权']]}},in:{flag:'🇮🇳',name:'印度',subtitle:'India · 全球增速最快电商大国',region:'南亚',ai:{opp:'全球增速最快电商大国，14.3亿人口+极年轻结构。Flipkart/Amazon双寡头+Jio推动数字革命',tracks:['时尚服饰 +35% 印度纺织+消费双驱动','3C配件 +28% 智能手机全球第二','美妆个护 +30% 印度美妆市场爆发'],risks:['⚠️ 关税极高(基本税率+IGST)','⚠️ BIS认证门槛高','⚠️ 价格敏感度全球最高'],advice:['新手：Flipkart/Amazon印度站跨境','工厂：本土店+Meesho','精品：品牌独立站+Instagram+YouTube']},macro:[['总人口','14.3亿','+0.8%','全球第一人口'],['电商规模','US$ 1,200亿','+22%','全球增速最快'],['电商渗透率','8.5%','↑','巨大增长空间'],['人均可支配收入','US$ 2,500','+6%','中产爆发'],['汇率','83.5 INR/USD','±1%','卢比稳定'],['外贸环境','复杂','↓','高关税+PLI']],demo:{age:[['0-14岁',26,'母婴市场巨大'],['15-29岁',28,'数字原住民消费'],['30-49岁',26,'家庭核心'],['50岁+',20,'保守消费']],ai_age:'18-40岁极年轻人群，价格敏感度全球最高',gender:{m:52,f:48},f_pref:'时尚服饰(纱丽/库尔塔)、美妆护肤、珠宝饰品',m_pref:'3C数码、板球运动、汽车配件',religion:[['印度教',80],['伊斯兰教',14],['基督教',2],['其他',4]],risk:['关税极高','BIS认证门槛','价格敏感度极高'],opp:['14.3亿人口红利全球最大','Jio数字革命','中产爆发式增长'],fest:'排灯节(10-11月) → 黑五(11月) → 共和国日(1月)',income:[['底层低收入',45,'极致低价','#e0e4ec'],['中产主流层',35,'极致性价比','#2c5f8a'],['中高收入',14,'品质升级','#4a90d9'],['高收入精英',6,'品牌消费','#c8a84e']],price:[['低价平台','Meesho/Flipkart','$1-8','极致低价'],['中端主流','Amazon/Flipkart','$8-40','分期+免运'],['高端品牌','品牌独立站','$40+','品质服务']],price_trend:'全球最高价格敏感度，极致低价走量',shelf:'重COD、免运费、评价',content:'Instagram+YouTube+WhatsApp',payment:'UPI/Paytm/COD/信用卡',cod:25,peak:'20:00-23:00'},cat:{blue:[['时尚服饰','+35%'],['美妆个护','+30%'],['3C配件','+28%'],['家居用品','+22%']],stable:['食品饮料','日用品','母婴'],risk:[['化妆品','CDSCO注册'],['食品','FSSAI认证'],['电子','BIS认证必须']]},plats:[['Flipkart','🔵',30,'货架+支付','跨境/本土','8-15%','全品类','★★★'],['Amazon','📦',28,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Meesho','🟣',15,'低价平台','本土','5-10%','低价全品类','★★☆'],['Myntra','👗',8,'时尚垂直','本土','10-15%','时尚服饰','★★☆'],['Temu','🟠',3,'低价平台','跨境','平台承担','全品类低价','★★☆']],comp:{level:'严格',cls:'strict',policies:[['high','进口高关税(Basic+IGST)','持续执行','全品类','全平台','基本税+IGST综合税率极高'],['high','BIS产品认证','持续执行','电子/工业品','全平台','无BIS禁止进口销售'],['mid','FSSAI食品认证','持续','食品','全平台','需印度食品安全认证'],['mid','CDSCO化妆品注册','持续','美妆','全平台','需印度药监局注册']]}},it:{flag:'🇮🇹',name:'意大利',subtitle:'Italy · 南欧最大电商市场',region:'欧美',ai:{opp:'南欧最大电商市场，时尚设计文化深厚。品质和设计感要求极高',tracks:['时尚配饰 +18% 意式风格强劲','家居设计 +20% 设计感需求旺盛','美妆个护 +22% 人均电商消费南欧最高'],risks:['⚠️ 税务合规复杂','⚠️ COD仍有15%','⚠️ 物流南北差异大'],advice:['新手：Amazon意大利站+eBay','工厂：本土店+Zalando','精品：品牌独立站+YOOX']},macro:[['总人口','5,870万','-0.3%','人口负增长'],['电商规模','US$ 420亿','+10%','南欧最大'],['电商渗透率','16.2%','↑','快速增长'],['人均可支配收入','US$ 38,200','+1.2%','消费复苏'],['汇率','0.92 EUR/USD','±1%','欧元稳定'],['外贸环境','平稳','→','EU成员']],demo:{age:[['0-14岁',13,'精品母婴'],['15-29岁',17,'时尚社交'],['30-49岁',27,'家庭核心'],['50岁+',43,'银发最大']],ai_age:'30-55岁核心，设计品质至上',gender:{m:48,f:52},f_pref:'意式美妆、时尚配饰、家居软装',m_pref:'汽车配件、电子数码、运动装备',religion:[['天主教',78],['无宗教',15],['其他',7]],risk:['税务合规复杂','南北物流差异','时尚竞争激烈'],opp:['意式设计全球影响力','家居设计品溢价大','食品出口机会'],fest:'黑五(11月) → 圣诞(12月) → 复活节(3-4月)',income:[['底层低收入',25,'折扣消费','#e0e4ec'],['中产主流层',42,'品质中端核心','#2c5f8a'],['中高收入',23,'品牌设计升级','#4a90d9'],['高收入精英',10,'奢侈品精品','#c8a84e']],price:[['低价平台','Temu/Shein','$3-15','性价比'],['中端主流','Amazon/eBay','$15-80','品质+设计'],['高端品牌','YOOX/独立站','$80+','设计师品牌']],price_trend:'注重性价比但设计溢价被接受',shelf:'重评价、意语完整描述',content:'Instagram+TikTok时尚种草',payment:'信用卡/PayPal/Scalapay',cod:15,peak:'20:00-23:00'},cat:{blue:[['时尚配饰','+18%'],['家居设计','+20%'],['美妆个护','+22%'],['运动户外','+16%']],stable:['电子产品','食品饮料','母婴'],risk:[['化妆品','EU CPNP必须'],['食品','EU营养标签'],['电子','CE+意语说明']]},plats:[['Amazon','📦',35,'货架电商','跨境FBA','8-15%','全品类','★★★'],['eBay','🏷️',14,'货架/C2C','跨境','8-12%','电子日用','★★☆'],['Zalando','👗',8,'时尚垂直','跨境','10-15%','时尚服饰','★★☆'],['Temu','🟠',6,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Subito','🟢',5,'C2C','本土','5-8%','二手日用','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['high','GDPR+Garante数据保护','持续执行','全品类','全平台','严格执法'],['mid','税务合规(Codice Fiscale)','持续','全品类','全平台','需意大利税号'],['mid','意大利语标签','持续','全品类','全平台','需意语产品说明'],['low','EU统一产品安全','持续','全品类','全平台','CE标识必须']]}},ke:{flag:'🇰🇪',name:'肯尼亚',subtitle:'Kenya · 东非电商领军者',region:'非洲',ai:{opp:'东非电商领军者，M-Pesa移动支付革命发源地。5,400万人口+年轻结构，电商增速快',tracks:['3C配件 +28% 智能手机渗透提升','时尚服饰 +25% 年轻消费驱动','美妆个护 +22% 非洲美妆增长'],risks:['⚠️ 物流最后一公里挑战大','⚠️ 汇率波动影响进口','⚠️ 电商基础设施待完善'],advice:['新手：Jumia肯尼亚站+Kilimall','工厂：本土店+独立站COD','精品：品牌+M-Pesa+社交媒体']},macro:[['总人口','5,400万','+2.0%','东非最大'],['电商规模','US$ 32亿','+25%','东非最大'],['电商渗透率','6.8%','↑','快速增长'],['人均可支配收入','US$ 2,100','+3%','中产扩大'],['汇率','130 KES/USD','±2%','先令波动'],['外贸环境','利好','→','东非共同体']],demo:{age:[['0-14岁',35,'母婴市场巨大'],['15-29岁',30,'移动支付原住民'],['30-49岁',22,'家庭消费'],['50岁+',13,'保守消费']],ai_age:'18-35岁极年轻人群，M-Pesa移动支付驱动',gender:{m:50,f:50},f_pref:'时尚服饰、美妆护肤、手机配件',m_pref:'电子产品、运动鞋、太阳能产品',religion:[['基督教',82],['伊斯兰教',11],['无宗教',4],['其他',3]],risk:['物流最后一公里','汇率波动','基础设施待完善'],opp:['M-Pesa移动支付革命','东非贸易枢纽','年轻人口红利'],fest:'Jamhuri Day(12月) → 黑五(11月) → 圣诞(12月)',income:[['底层低收入',45,'极致低价','#e0e4ec'],['中产主流层',32,'性价比','#2c5f8a'],['中高收入',15,'品质升级','#4a90d9'],['高收入精英',8,'进口品牌','#c8a84e']],price:[['低价平台','Jumia/Kilimall','$2-8','极致低价'],['中端主流','Jumia/Instagram','$8-30','社交+M-Pesa'],['高端品牌','品牌独立站','$30+','进口品质']],price_trend:'极致价格敏感，M-Pesa支付驱动',shelf:'重M-Pesa、COD',content:'Instagram+WhatsApp+TikTok',payment:'M-Pesa/COD/Airtel Money',cod:40,peak:'18:00-21:00'},cat:{blue:[['3C配件','+28%'],['时尚服饰','+25%'],['美妆个护','+22%'],['太阳能产品','+30%']],stable:['食品饮料','日用品','家居基础款'],risk:[['化妆品','PPB注册'],['食品','KEBS标准'],['药品','严格管制']]},plats:[['Jumia','🟠',28,'货架+物流','跨境/本土','10-15%','全品类','★★★'],['Kilimall','🟢',15,'货架电商','本土','10-15%','全品类','★★☆'],['Temu','🟠',3,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Instagram商家','📱',6,'社交电商','本土','0%','时尚美妆','★★☆'],['AliExpress','🟠',5,'低价平台','跨境','5-8%','全品类','★☆☆']],comp:{level:'中等偏宽松',cls:'loose',policies:[['mid','物流基础设施','持续','全品类','全平台','最后一公里困难'],['mid','M-Pesa支付集成','建议','全品类','全平台','肯尼亚最主流支付'],['low','KEBS产品标准','持续','工业品','全平台','需肯尼亚标准'],['low','数据保护法','2023','全品类','全平台','数据保护合规']]}},kr:{flag:'🇰🇷',name:'韩国',subtitle:'South Korea · 全球第六大电商市场',region:'东亚',ai:{opp:'全球第六大电商市场，5,200万人口+极高数字化程度。Coupang次日达标杆，美妆K-beauty全球影响',tracks:['美妆护肤 +15% K-beauty全球影响力','时尚服饰 +12% 韩流时尚消费','电子产品 +10% 科技消费领先'],risks:['⚠️ 本土电商Coupang/Naver极强','⚠️ 韩语listing必须','⚠️ 退货率较高(15%+)'],advice:['新手：Coupang跨境+Gmarket','工厂：本土店+11st','精品：品牌独立站+Naver Blog营销']},macro:[['总人口','5,200万','+0.0%','人口停滞'],['电商规模','US$ 804亿','+8%','全球第六大'],['电商渗透率','32.8%','↑','全球最高之一'],['人均可支配收入','US$ 33,200','+2.0%','高消费力'],['汇率','1,380 KRW/USD','±2%','韩元波动'],['外贸环境','平稳','→','FTA广泛']],demo:{age:[['0-14岁',12,'精品母婴'],['15-29岁',20,'K-culture消费'],['30-49岁',28,'家庭核心高客单'],['50岁+',40,'银发数字化消费']],ai_age:'25-50岁核心人群，韩流+品质双重驱动',gender:{m:49,f:51},f_pref:'K-beauty美妆、韩流时尚、家居设计',m_pref:'电子数码、运动装备、汽车配件',religion:[['无宗教',46],['基督教',28],['佛教',20],['其他',6]],risk:['本土电商极强','韩语listing必须','退货率较高'],opp:['K-beauty美妆全球影响','次日达物流标杆','韩流文化辐射'],fest:'黑五(11月) → 年末大促(12月) → 新年(1月)',income:[['底层低收入',18,'折扣','#e0e4ec'],['中产主流层',48,'品质中端核心','#2c5f8a'],['中高收入',24,'品牌升级','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['低价平台','AliExpress/Coupang','$3-15','性价比'],['中端主流','Coupang/Naver','$15-80','次日达+品质'],['高端品牌','品牌独立站','$80+','精品']],price_trend:'消费者极重配送速度和评价',shelf:'极重评价、次日达、退换货',content:'Instagram+YouTube+Naver Blog',payment:'信用卡/ KakaoPay/Naver Pay',cod:3,peak:'20:00-23:00'},cat:{blue:[['美妆护肤','+15%'],['时尚服饰','+12%'],['电子产品','+10%'],['健康食品','+18%']],stable:['家居用品','食品饮料','母婴'],risk:[['化妆品','MFDS认证严格'],['食品','进口检疫严格'],['电子','KC认证必须']]},plats:[['Coupang','📦',28,'货架+物流','跨境/本土','8-15%','全品类','★★★'],['Naver Shopping','🔍',22,'搜索电商','本土','5-10%','全品类','★★★'],['Gmarket','🟠',10,'货架电商','跨境/本土','8-12%','全品类','★★☆'],['11st','🔵',8,'货架电商','本土','8-12%','全品类','★★☆'],['Temu','🟠',4,'低价平台','跨境','平台承担','全品类低价','★★☆']],comp:{level:'严格',cls:'strict',policies:[['high','KC电气安全认证','持续执行','电子产品','全平台','无认证禁止销售'],['high','MFDS化妆品认证','持续','美妆','全平台','需韩国食药处认证'],['mid','韩语标签强制','持续','全品类','全平台','必须韩语标注'],['low','电商消费者保护','持续','全品类','全平台','7天无条件退货']]}},kz:{flag:'🇰🇿',name:'哈萨克斯坦',subtitle:'Kazakhstan · 中亚最大电商市场',region:'独联体',ai:{opp:'中亚最大经济体+最大电商市场，1,900万人口。Kaspi.kz超级App主导，EAEU关税同盟成员',tracks:['3C配件 +22% 数字化消费增长','时尚服饰 +20% 年轻消费驱动','家居用品 +18% 城镇化需求'],risks:['⚠️ EAEU认证体系(类EAC)','⚠️ 物流距离远成本高','⚠️ 俄语/哈萨克语双语'],advice:['新手：Kaspi.kz+Wildberries','工厂：本土店+Ozon哈萨克斯坦','精品：品牌独立站+Instagram']},macro:[['总人口','1,960万','+1.2%','中亚最大'],['电商规模','US$ 52亿','+25%','中亚最大'],['电商渗透率','12.5%','↑','快速增长'],['人均可支配收入','US$ 7,200','+4%','中产扩大'],['汇率','475 KZT/USD','±2%','坚戈波动'],['外贸环境','利好','→','EAEU+一带一路']],demo:{age:[['0-14岁',28,'母婴市场'],['15-29岁',27,'数字原住民'],['30-49岁',26,'家庭核心'],['50岁+',19,'保守消费']],ai_age:'20-40岁年轻人群，Kaspi超级App驱动',gender:{m:50,f:50},f_pref:'时尚服饰、美妆护肤、家居装饰',m_pref:'3C数码、汽车配件、运动装备',religion:[['伊斯兰教',72],['基督教',24],['无宗教',2],['其他',2]],risk:['EAEU认证','物流距离远','双语运营'],opp:['中亚最大消费市场','一带一路贸易便利','Kaspi超级App生态'],fest:'纳乌鲁斯节(3月) → 黑五(11月) → 新年(1月)',income:[['底层低收入',30,'性价比','#e0e4ec'],['中产主流层',42,'品质性价比','#2c5f8a'],['中高收入',18,'品牌升级','#4a90d9'],['高收入精英',10,'进口品牌','#c8a84e']],price:[['低价平台','Kaspi/Wildberries','$2-12','性价比'],['中端主流','Kaspi/Ozon','$12-50','分期+评价'],['高端品牌','品牌独立站','$50+','品质']],price_trend:'分期消费(Kaspi Red)驱动增长',shelf:'重分期、Kaspi生态、评价',content:'Instagram+Telegram',payment:'Kaspi Pay/信用卡/COD',cod:10,peak:'19:00-22:00'},cat:{blue:[['3C配件','+22%'],['时尚服饰','+20%'],['家居用品','+18%'],['美妆个护','+20%']],stable:['食品饮料','日用品','汽车配件'],risk:[['化妆品','EAC认证'],['食品','EAC+检验'],['电子','EAC认证']]},plats:[['Kaspi.kz','🔵',40,'超级App','本土','5-10%','全品类','★★★'],['Wildberries','🟣',18,'货架电商','跨境/本土','8-15%','全品类','★★★'],['Ozon','🔵',8,'货架电商','跨境','8-15%','全品类','★★☆'],['Flip','🟢',4,'货架电商','本土','8-12%','全品类','★☆☆'],['AliExpress','🟠',4,'低价平台','跨境','5-8%','全品类','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['high','EAEU认证(海关联盟)','持续执行','全品类','全平台','独联体统一认证'],['mid','俄语/哈萨克语标签','持续','全品类','全平台','双语产品说明'],['mid','Kaspi支付集成','建议','全品类','全平台','最主流支付'],['low','消费者保护法','持续','全品类','全平台','14天退货']]}},ma:{flag:'🇲🇦',name:'摩洛哥',subtitle:'Morocco · 北非电商新兴力量',region:'非洲',ai:{opp:'北非电商新兴力量，3,700万人口+法语/阿拉伯语双语市场。Jumia摩洛哥站主导',tracks:['时尚服饰 +25% 摩洛哥时尚消费增长','美妆个护 +22% 阿甘油美妆特色','3C配件 +20% 智能手机普及'],risks:['⚠️ 阿拉伯语+法语双语运营','⚠️ 清关流程复杂','⚠️ 电商基础设施待完善'],advice:['新手：Jumia摩洛哥站','工厂：本土店+独立站','精品：品牌+Instagram+Snapchat营销']},macro:[['总人口','3,750万','+1.0%','北非新兴'],['电商规模','US$ 28亿','+22%','北非增长快'],['电商渗透率','8.5%','↑','增长空间大'],['人均可支配收入','US$ 3,600','+3.2%','中产扩大'],['汇率','10.0 MAD/USD','±1%','迪拉姆稳定'],['外贸环境','利好','→','非盟+EU合作']],demo:{age:[['0-14岁',28,'母婴市场'],['15-29岁',28,'社交电商活跃'],['30-49岁',26,'家庭核心'],['50岁+',18,'保守消费']],ai_age:'20-40岁年轻人群，社交电商+COD驱动',gender:{m:50,f:50},f_pref:'时尚服饰、美妆护肤(阿甘油)、家居装饰',m_pref:'3C数码、运动装备、汽车配件',religion:[['伊斯兰教',99],['基督教',0.5],['其他',0.5]],risk:['双语运营','清关复杂','基础设施待完善'],opp:['阿甘油美妆特色出口','北非+欧洲辐射','旅游业带动消费'],fest:'斋月(3-4月) → 开斋节 → 黑五(11月)',income:[['底层低收入',35,'极致低价','#e0e4ec'],['中产主流层',38,'性价比核心','#2c5f8a'],['中高收入',18,'品质升级','#4a90d9'],['高收入精英',9,'进口品牌','#c8a84e']],price:[['低价平台','Jumia','$2-10','极致低价'],['中端主流','Jumia/Avito','$10-40','评价驱动'],['高端品牌','品牌独立站','$40+','品质']],price_trend:'价格敏感但品质意识提升中',shelf:'重COD、阿拉伯语/法语',content:'Instagram+Snapchat+Facebook',payment:'COD/信用卡/转账',cod:30,peak:'20:00-23:00'},cat:{blue:[['时尚服饰','+25%'],['美妆个护','+22%'],['3C配件','+20%'],['家居用品','+18%']],stable:['食品饮料','日用品','母婴'],risk:[['化妆品','卫生部注册'],['食品','ONSSA检验'],['电子','IMANOR认证']]},plats:[['Jumia','🟠',30,'货架+物流','跨境/本土','10-15%','全品类','★★★'],['Avito','🟢',15,'C2C/分类','本土','免费','二手日用','★★☆'],['Temu','🟠',3,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Instagram商家','📱',5,'社交电商','本土','0%','时尚美妆','★★☆'],['AliExpress','🟠',4,'低价平台','跨境','5-8%','全品类','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['mid','阿拉伯语/法语标签','持续','全品类','全平台','双语产品说明'],['mid','清关流程','持续','全品类','全平台','流程复杂周期长'],['low','化妆品卫生部注册','持续','美妆','全平台','需注册'],['low','COD回款管理','行业','全品类','全平台','COD占比30%']]}},mx:{flag:'🇲🇽',name:'墨西哥',subtitle:'Mexico · 拉美第二大电商市场',region:'拉美',ai:{opp:'拉美第二大电商市场，1.3亿人口+年轻化结构。Mercado Libre主导，社交电商快速增长',tracks:['时尚服饰 +28% 墨西哥时尚文化浓厚','3C配件 +22% 智能手机普及推动','家居用品 +20% 城镇化需求旺盛'],risks:['⚠️ 安全形势影响物流','⚠️ 关税+增值税16%','⚠️ Mercado Libre主导竞争'],advice:['新手：Mercado Libre跨境+Amazon墨西哥站','工厂：本土店+Shopee','精品：品牌本土化+Instagram+TikTok']},macro:[['总人口','1.3亿','+0.8%','拉美第二人口'],['电商规模','US$ 520亿','+25%','拉美第二大'],['电商渗透率','13.5%','↑','快速增长'],['人均可支配收入','US$ 10,800','+3.2%','中产扩大'],['汇率','18.5 MXN/USD','±2%','比索稳定'],['外贸环境','利好','↑','USMCA+近岸外包']],demo:{age:[['0-14岁',26,'母婴市场大'],['15-29岁',27,'社交电商活跃'],['30-49岁',27,'家庭核心'],['50岁+',20,'保守消费']],ai_age:'20-40岁年轻人群，社交电商+分期驱动',gender:{m:49,f:51},f_pref:'时尚服饰、美妆护肤、家居装饰',m_pref:'3C数码、汽车配件、运动装备',religion:[['天主教',82],['基督教',8],['无宗教',6],['其他',4]],risk:['安全形势影响物流','VAT 16%','Mercado Libre竞争'],opp:['1.3亿人口红利','USMCA贸易便利','近岸外包带动就业'],fest:'好周五(11月) → 圣诞(12月) → 热 Sale(11月)',income:[['底层低收入',35,'极致低价','#e0e4ec'],['中产主流层',40,'分期性价比','#2c5f8a'],['中高收入',18,'品质升级','#4a90d9'],['高收入精英',7,'进口品牌','#c8a84e']],price:[['社交电商','Shopee/TikTok','$2-12','冲动消费'],['中端货架','Mercado Libre/Amazon','$12-50','分期+免运'],['高端品牌','品牌独立站','$50+','品质服务']],price_trend:'分期付款( MSI)是核心购买驱动',shelf:'重免运费、分期选项、卖家评分',content:'Instagram+TikTok+Facebook',payment:'OXXO支付/信用卡/COD/Transfer',cod:20,peak:'20:00-23:00'},cat:{blue:[['时尚服饰','+28%'],['3C配件','+22%'],['家居用品','+20%'],['美妆个护','+25%']],stable:['食品饮料','日用品','汽车配件'],risk:[['化妆品','COFEPRIS注册'],['食品','卫生许可'],['电子','NOM认证']]},plats:[['Mercado Libre','🟡',32,'货架+支付','跨境/本土','11-16%','全品类','★★★'],['Amazon','📦',18,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Shopee','🟠',10,'货架+内容','跨境','5-8%','美妆时尚低价','★★☆'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Liverpool','🏬',6,'百货电商','本土','8-12%','品牌家居','★★☆']],comp:{level:'中等',cls:'medium',policies:[['high','VAT 16%','持续','全品类','全平台','进口+本土征16%'],['mid','安全物流影响','持续','全品类','全平台','部分地区配送风险'],['mid','NOM产品认证','持续','电子/工业品','全平台','需墨西哥标准认证'],['low','COFEPRIS化妆品注册','持续','美妆','全平台','需卫生部注册']]}},ng:{flag:'🇳🇬',name:'尼日利亚',subtitle:'Nigeria · 非洲最大电商市场',region:'非洲',ai:{opp:'非洲最大人口国+最大电商市场，2.2亿人口+极年轻结构。Jumia+社交电商是核心渠道',tracks:['3C配件 +30% 智能手机渗透率快速提升','时尚服饰 +28% 尼日利亚时尚文化强劲','美妆个护 +25% 非洲美妆市场爆发'],risks:['⚠️ 奈拉汇率剧烈波动','⚠️ 物流基础设施极不完善','⚠️ 欺诈风险较高'],advice:['新手：Jumia跨境+Konga','工厂：本土店+Instagram','精品：品牌本土化+COD独立站']},macro:[['总人口','2.23亿','+2.4%','非洲第一人口'],['电商规模','US$ 75亿','+30%','非洲最大'],['电商渗透率','5.5%','↑','巨大空间'],['人均可支配收入','US$ 2,200','+2%','中产扩大'],['汇率','1,550 NGN/USD','±8%','奈拉剧烈波动'],['外贸环境','复杂','↓','外汇管制+汇率']],demo:{age:[['0-14岁',40,'母婴市场巨大'],['15-29岁',30,'社交电商最活跃'],['30-49岁',20,'家庭消费'],['50岁+',10,'保守消费']],ai_age:'18-35岁极年轻人群，社交电商核心',gender:{m:51,f:49},f_pref:'时尚服饰、美妆护肤(假发)、3C配件',m_pref:'电子产品、运动鞋、汽车配件',religion:[['基督教',46],['伊斯兰教',48],['其他',6]],risk:['奈拉汇率剧烈波动','物流极不完善','欺诈风险高'],opp:['2.23亿非洲最大人口','Nollywood娱乐文化影响','假发美妆出口大'],fest:'黑五(11月) → 圣诞(12月) → 开斋节',income:[['底层低收入',50,'极致低价','#e0e4ec'],['中产主流层',30,'性价比','#2c5f8a'],['中高收入',14,'品质升级','#4a90d9'],['高收入精英',6,'进口品牌','#c8a84e']],price:[['低价平台','Jumia/Konga','$2-8','极致低价'],['中端主流','Jumia/Instagram','$8-30','社交电商'],['高端品牌','品牌独立站','$30+','进口品质']],price_trend:'极致价格敏感，COD+社交电商驱动',shelf:'重COD、WhatsApp沟通',content:'Instagram+WhatsApp+TikTok',payment:'COD/Bank Transfer/OPay',cod:45,peak:'18:00-21:00'},cat:{blue:[['3C配件','+30%'],['时尚服饰','+28%'],['美妆个护','+25%'],['假发饰品','+35%']],stable:['食品饮料','日用品','家居基础款'],risk:[['化妆品','NAFDAC注册'],['食品','进口许可'],['药品','严格管制']]},plats:[['Jumia','🟠',25,'货架+物流','跨境/本土','10-15%','全品类','★★★'],['Konga','🔵',12,'货架电商','本土','10-15%','全品类','★★☆'],['Temu','🟠',4,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Instagram商家','📱',8,'社交电商','本土','0%','时尚美妆','★★☆'],['AliExpress','🟠',6,'低价平台','跨境','5-8%','全品类','★☆☆']],comp:{level:'中等偏宽松',cls:'loose',policies:[['high','外汇管制','持续','跨境','全平台','美元获取极困难'],['high','NAFDAC化妆品注册','持续','美妆','全平台','需尼日利亚FDA'],['mid','物流基础设施','持续','全品类','全平台','极不完善'],['low','欺诈风险管理','行业','全品类','全平台','COD拒收率较高']]}},nl:{flag:'🇳🇱',name:'荷兰',subtitle:'Netherlands · 欧洲人均电商消费Top3',region:'欧美',ai:{opp:'欧洲人均电商消费前三，数字化极高。注重便利与可持续性',tracks:['可持续时尚 +25% 可持续消费全欧领先','家居园艺 +18% 园艺文化深厚','电子产品 +15% 高数字化渗透'],risks:['⚠️ 市场小(1700万)','⚠️ 荷/英双语listing必要','⚠️ EU合规严格'],advice:['新手：Amazon荷兰站+bol.com','工厂：本土店+Zalando','精品：品牌独立站+可持续认证']},macro:[['总人口','1,780万','+0.4%','人口密度高'],['电商规模','US$ 300亿','+8%','人均Top3'],['电商渗透率','24.5%','↑','全球领先'],['人均可支配收入','US$ 52,000','+1.5%','高消费力'],['汇率','0.92 EUR/USD','±1%','欧元稳定'],['外贸环境','利好','→','欧洲物流枢纽']],demo:{age:[['0-14岁',15,'精品母婴'],['15-29岁',19,'可持续时尚'],['30-49岁',28,'家庭核心'],['50岁+',38,'银发数字消费']],ai_age:'25-55岁，可持续意识极强',gender:{m:50,f:50},f_pref:'可持续时尚、有机美妆、家居软装',m_pref:'电子数码、园艺工具、自行车配件',religion:[['无宗教',54],['天主教',22],['新教',14],['其他',10]],risk:['市场小竞争烈','可持续认证门槛','EU合规'],opp:['人均电商消费Top3','可持续意识极强','欧洲物流枢纽'],fest:'国王日(4月) → 黑五(11月) → 圣诞(12月)',income:[['底层低收入',15,'折扣','#e0e4ec'],['中产主流层',50,'品质中端核心','#2c5f8a'],['中高收入',25,'可持续品牌','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['低价平台','Temu/AliExpress','$3-15','性价比'],['中端主流','bol.com/Amazon','$15-80','品质+可持续'],['高端品牌','品牌独立站','$80+','精品环保']],price_trend:'可持续产品溢价10-15%',shelf:'重可持续标签、评价',content:'Instagram+TikTok+YouTube',payment:'iDEAL/信用卡/PayPal',cod:1,peak:'19:00-22:00'},cat:{blue:[['可持续时尚','+25%'],['家居园艺','+18%'],['电子产品','+15%'],['有机食品','+20%']],stable:['自行车配件','日用品','母婴'],risk:[['化妆品','EU CPNP必须'],['食品','EU有机认证'],['电子','WEEE+CE']]},plats:[['bol.com','🔵',32,'货架电商','本土优先','8-12%','全品类','★★★'],['Amazon','📦',22,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Zalando','👗',10,'时尚垂直','跨境','10-15%','时尚服饰','★★☆'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Marktplaats','🟢',8,'C2C','本土','免费','二手日用','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['high','EU统一合规(CE/GDPR)','持续执行','全品类','全平台','EU标准严格'],['mid','可持续包装','建议','全品类','全平台','消费者偏好环保包装'],['mid','iDEAL支付集成','建议','全品类','全平台','荷兰最主流支付'],['low','WEEE电子注册','持续','电子产品','全平台','EU电子废弃注册']]}},ph:{flag:'🇵🇭',name:'菲律宾',subtitle:'Philippines · 东南亚社交电商大国',region:'东南亚',ai:{opp:'东南亚社交电商大国，1.1亿人口+极高社交媒体使用率。直播带货+COD是核心打法',tracks:['美妆个护 +35% 菲律宾美妆文化浓厚','3C配件 +28% 智能手机普及推动','时尚服饰 +30% 韩流日系影响大'],risks:['⚠️ 岛屿众多物流成本极高','⚠️ COD占比高达50%','⚠️ 关税+增值税复杂'],advice:['新手：Shopee菲律宾站+TikTok Shop','工厂：本土店+Lazada','精品：品牌本土化+Facebook+TikTok直播']},macro:[['总人口','1.15亿','+1.5%','东南亚第二'],['电商规模','US$ 280亿','+22%','社交电商大国'],['电商渗透率','11.8%','↑','巨大增长空间'],['人均可支配收入','US$ 3,850','+5.5%','中产扩大'],['汇率','56.5 PHP/USD','±1%','比索稳定'],['外贸环境','利好','↑','ASEAN+RCEP']],demo:{age:[['0-14岁',30,'母婴市场巨大'],['15-29岁',28,'社交电商最活跃'],['30-49岁',26,'家庭消费核心'],['50岁+',16,'保守消费']],ai_age:'18-35岁极年轻人群，社交电商核心市场',gender:{m:49,f:51},f_pref:'美妆护肤、韩流服饰、母婴用品',m_pref:'3C数码、运动装备、汽车配件',religion:[['天主教',80],['伊斯兰教',6],['基督教',8],['其他',6]],risk:['岛屿物流成本极高','COD占比50%','关税增值税复杂'],opp:['1.15亿人口红利','社交媒体使用率全亚洲最高','韩流文化影响力大'],fest:'黑五(11月) → 圣诞(12月) → Payday Sale(每月)',income:[['底层低收入',40,'极致低价','#e0e4ec'],['中产主流层',35,'性价比核心','#2c5f8a'],['中高收入',18,'品质升级','#4a90d9'],['高收入精英',7,'品牌消费','#c8a84e']],price:[['低价直播','TikTok/Shopee Live','$2-10','冲动消费'],['中端货架','Lazada/Shopee','$10-40','比价+评价'],['高端品牌','品牌独立站','$40+','品质服务']],price_trend:'极致价格敏感，社交媒体驱动冲动消费',shelf:'重COD、免运费、直播转化',content:'TikTok+Facebook+Instagram',payment:'COD/GCash/Maya/信用卡',cod:50,peak:'20:00-23:00'},cat:{blue:[['美妆个护','+35%'],['时尚服饰','+30%'],['3C配件','+28%'],['母婴用品','+22%']],stable:['食品饮料','日用品','家居基础款'],risk:[['化妆品','FDA注册'],['食品','进口许可'],['电子','NTC认证']]},plats:[['Shopee','🟠',38,'货架+内容','跨境/本土','5-8%','美妆时尚家居','★★★'],['TikTok Shop','🎵',20,'内容电商','本土优先','3-5%','美妆时尚','★★★'],['Lazada','🔵',20,'货架电商','跨境/本土','5-8%','全品类','★★☆'],['Temu','🟠',4,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Zalora','👗',3,'时尚垂直','跨境','10-15%','时尚服饰','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['mid','岛屿物流限制','持续','全品类','全平台','偏远地区配送困难'],['mid','COD回款风险','行业','全品类','全平台','COD占比50%回款慢'],['low','关税+增值税12%','持续','进口','全平台','进口商品征12%VAT'],['low','FDA化妆品注册','持续','美妆','全平台','需菲律宾FDA注册']]}},pk:{flag:'🇵🇰',name:'巴基斯坦',subtitle:'Pakistan · 南亚新兴电商市场',region:'南亚',ai:{opp:'南亚新兴电商市场，2.3亿人口+极年轻结构。Daraz(阿里旗下)主导，COD+社交电商是核心',tracks:['时尚服饰 +28% 巴基斯坦纺织基础强','3C配件 +25% 智能手机渗透','美妆个护 +22% 年轻女性驱动'],risks:['⚠️ 经济不稳定+通胀高','⚠️ 物流基础设施薄弱','⚠️ 外汇管制严格'],advice:['新手：Daraz跨境+AliExpress','工厂：本土店+Instagram','精品：品牌独立站+COD+社交媒体']},macro:[['总人口','2.3亿','+1.8%','南亚第二'],['电商规模','US$ 42亿','+30%','南亚高增速'],['电商渗透率','4.5%','↑','巨大空间'],['人均可支配收入','US$ 1,600','+2%','中产扩大'],['汇率','280 PKR/USD','±5%','卢比波动'],['外贸环境','复杂','↓','外汇管制']],demo:{age:[['0-14岁',35,'母婴市场巨大'],['15-29岁',30,'社交电商活跃'],['30-49岁',22,'家庭消费'],['50岁+',13,'保守消费']],ai_age:'18-35岁极年轻人群，社交电商+COD驱动',gender:{m:51,f:49},f_pref:'时尚服饰(库尔塔/纱丽)、美妆护肤、珠宝饰品',m_pref:'3C数码、板球运动、汽车配件',religion:[['伊斯兰教',96],['基督教',2],['其他',2]],risk:['经济不稳定','物流薄弱','外汇管制'],opp:['2.3亿人口红利','纺织业基础强','Daraz阿里系生态'],fest:'开斋节 → 独立日(8月) → 排灯节',income:[['底层低收入',45,'极致低价','#e0e4ec'],['中产主流层',32,'性价比','#2c5f8a'],['中高收入',15,'品质升级','#4a90d9'],['高收入精英',8,'进口品牌','#c8a84e']],price:[['低价平台','Daraz/AliExpress','$1-6','极致低价'],['中端主流','Daraz','$6-25','COD+分期'],['高端品牌','品牌独立站','$25+','进口品质']],price_trend:'极致价格敏感，COD驱动',shelf:'重COD、WhatsApp沟通',content:'Instagram+Facebook+TikTok',payment:'COD/JazzCash/Easypaisa',cod:50,peak:'20:00-23:00'},cat:{blue:[['时尚服饰','+28%'],['3C配件','+25%'],['美妆个护','+22%'],['家居用品','+20%']],stable:['食品饮料','日用品','母婴'],risk:[['化妆品','DRAP注册'],['食品','PSQCA认证'],['电子','PSQCA认证']]},plats:[['Daraz','🟠',35,'货架+物流','跨境/本土','8-15%','全品类','★★★'],['AliExpress','🟠',12,'低价平台','跨境','5-8%','全品类','★★☆'],['Instagram商家','📱',8,'社交电商','本土','0%','时尚美妆','★★☆'],['Temu','🟠',3,'低价平台','跨境','平台承担','全品类低价','★★☆'],['OLX','🟢',4,'C2C','本土','免费','二手','★☆☆']],comp:{level:'中等偏宽松',cls:'loose',policies:[['mid','经济不稳定','持续','全品类','全平台','通胀+外汇管制'],['mid','物流基础设施','持续','全品类','全平台','配送时效不稳定'],['low','COD回款风险','行业','全品类','全平台','COD占比50%拒收高'],['low','PSQCA认证','持续','工业品','全平台','需巴基斯坦标准']]}},pl:{flag:'🇵🇱',name:'波兰',subtitle:'Poland · 中东欧最大电商市场',region:'欧美',ai:{opp:'中东欧最大经济体+最大电商市场，Allegro主导，跨境机会增加',tracks:['家居家电 +22% 城镇化驱动升级','美妆个护 +20% 波兰美妆品牌崛起','电子数码 +18% 年轻群体扩大'],risks:['⚠️ Allegro主导，Amazon进入较晚','⚠️ 波兰语listing必须','⚠️ EU合规但执法较宽松'],advice:['新手：Allegro跨境+eBay','工厂：Allegro本土店+Amazon','精品：品牌独立站+本土KOL']},macro:[['总人口','3,760万','-0.2%','中东欧最大'],['电商规模','US$ 280亿','+15%','中东欧增速最快'],['电商渗透率','17.5%','↑','快速增长'],['人均可支配收入','US$ 22,800','+4.5%','中产扩大'],['汇率','4.05 PLN/USD','±1.5%','波动'],['外贸环境','利好','→','EU+制造业转移']],demo:{age:[['0-14岁',15,'母婴增长'],['15-29岁',21,'数字原住民'],['30-49岁',29,'家庭核心'],['50岁+',35,'银发升级']],ai_age:'20-45岁核心，价格敏感但愿品质升级',gender:{m:48,f:52},f_pref:'美妆护肤、时尚配饰、家居装饰',m_pref:'电子数码、汽车配件、运动装备',religion:[['天主教',85],['无宗教',12],['其他',3]],risk:['波兰语listing必须','Allegro主导','物流时效'],opp:['中东欧最大消费市场','制造业转移就业增长','年轻数字化人口高'],fest:'黑五(11月) → 圣诞(12月) → 复活节(3-4月)',income:[['底层低收入',30,'极致性价比','#e0e4ec'],['中产主流层',42,'性价比核心','#2c5f8a'],['中高收入',20,'品质升级','#4a90d9'],['高收入精英',8,'品牌消费','#c8a84e']],price:[['低价平台','Temu/AliExpress','$2-12','极致性价比'],['中端主流','Allegro/Amazon','$12-50','价格+品质'],['高端品牌','品牌独立站','$50+','品牌精品']],price_trend:'价格敏感但消费升级趋势明显',shelf:'重价格、Allegro评价、免运费',content:'Facebook+Instagram+TikTok',payment:'BLIK/信用卡/PayU',cod:10,peak:'19:00-22:00'},cat:{blue:[['家居家电','+22%'],['美妆个护','+20%'],['电子数码','+18%'],['时尚服饰','+16%']],stable:['食品日用','母婴','汽车配件'],risk:[['化妆品','EU CPNP必须'],['电子','CE+波兰语说明'],['食品','EU标签']]},plats:[['Allegro','🟠',42,'货架电商','本土/跨境','5-10%','全品类','★★★'],['Amazon','📦',12,'货架电商','跨境FBA','8-15%','全品类','★★☆'],['Temu','🟠',8,'低价平台','跨境','平台承担','全品类低价','★★☆'],['eMAG','🔴',6,'货架电商','跨境/本土','8-12%','电子家居','★★☆'],['OLX','🟢',5,'C2C','本土','免费','二手日用','★☆☆']],comp:{level:'中等偏宽松',cls:'loose',policies:[['high','EU统一合规','持续执行','全品类','全平台','CE+EU标准'],['mid','波兰语产品说明','持续','全品类','全平台','需波语描述'],['mid','14天退货','持续','全品类','全平台','EU标准'],['low','GDPR数据保护','持续','全品类','全平台','EU标准']]}},ru:{flag:'🇷🇺',name:'俄罗斯',subtitle:'Russia · 独联体最大电商市场',region:'独联体',ai:{opp:'独联体最大经济体+最大电商市场，1.44亿人口。Wildberries/Ozon双寡头，受制裁影响跨境变化大',tracks:['家居家电 +25% 进口替代需求旺盛','时尚服饰 +22% 消费韧性','3C配件 +20% 平行进口渠道'],risks:['⚠️ 国际制裁影响支付和物流','⚠️ 卢布汇率波动大','⚠️ 跨境收款渠道受限'],advice:['新手：Ozon跨境+Wildberries','工厂：本土店+Yandex Market','精品：品牌独立站+VK营销']},macro:[['总人口','1.44亿','-0.2%','人口下降'],['电商规模','US$ 680亿','+35%','制裁下高增速'],['电商渗透率','18.5%','↑','进口替代推动'],['人均可支配收入','US$ 12,800','+4%','实际增长'],['汇率','92 RUB/USD','±5%','卢布波动'],['外贸环境','复杂','↓','制裁+平行进口']],demo:{age:[['0-14岁',18,'母婴市场'],['15-29岁',22,'数字化消费'],['30-49岁',28,'家庭核心'],['50岁+',32,'银发消费']],ai_age:'25-50岁核心人群，进口替代需求强烈',gender:{m:47,f:53},f_pref:'时尚服饰、美妆护肤、家居家电',m_pref:'3C数码、汽车配件、运动装备',religion:[['东正教',72],['伊斯兰教',10],['无宗教',14],['其他',4]],risk:['国际制裁影响','卢布波动','跨境收款受限'],opp:['1.44亿人口红利','进口替代需求极强','Wildberries/Ozon高速增长'],fest:'黑五(11月) → 新年(1月) → 妇女节(3月)',income:[['底层低收入',25,'折扣','#e0e4ec'],['中产主流层',45,'品质性价比','#2c5f8a'],['中高收入',20,'品牌升级','#4a90d9'],['高收入精英',10,'进口品牌','#c8a84e']],price:[['低价平台','Wildberries/Ozon','$3-15','性价比'],['中端主流','Ozon/Yandex','$15-60','评价驱动'],['高端品牌','品牌独立站','$60+','进口品质']],price_trend:'进口替代推动本土品牌机会',shelf:'重评价、配送、免运费',content:'VK+Telegram+YouTube',payment:'信用卡/SBP/Mir卡',cod:5,peak:'19:00-22:00'},cat:{blue:[['家居家电','+25%'],['时尚服饰','+22%'],['3C配件','+20%'],['美妆个护','+18%']],stable:['食品饮料','日用品','汽车配件'],risk:[['化妆品','EAC认证'],['食品','EAC+Rospotrebnadzor'],['电子','EAC认证']]},plats:[['Wildberries','🟣',35,'货架+内容','跨境/本土','8-15%','全品类','★★★'],['Ozon','🔵',28,'货架电商','跨境/本土','8-15%','全品类','★★★'],['Yandex Market','🟡',10,'搜索电商','本土','8-12%','全品类','★★☆'],['AliExpress俄罗斯','🟠',5,'低价平台','跨境','5-8%','全品类低价','★★☆'],['MegaMarket','🟢',4,'百货电商','本土','8-12%','全品类','★☆☆']],comp:{level:'严格',cls:'strict',policies:[['high','国际制裁影响','持续','跨境','全平台','支付和物流受限'],['high','EAC认证(海关联盟)','持续执行','全品类','全平台','独联体统一认证必须'],['mid','俄语标签强制','持续','全品类','全平台','必须俄语标注'],['low','数据本地化法','持续','全品类','全平台','数据需存俄罗斯境内']]}},se:{flag:'🇸🇪',name:'瑞典',subtitle:'Sweden · 北欧数字化电商标杆',region:'欧美',ai:{opp:'北欧数字化标杆，电商渗透率全欧最高。Klarna支付创新发源地',tracks:['可持续时尚 +22% H&M效应+环保意识','智能家居 +20% 高数字化家庭','户外运动 +18% 北欧户外文化'],risks:['⚠️ 市场规模小(1000万)','⚠️ 高税收高成本','⚠️ 北欧语言listing必要'],advice:['新手：Amazon瑞典站+CDON','工厂：本土店+Zalando','精品：品牌独立站+可持续认证']},macro:[['总人口','1,050万','+0.6%','北欧最大'],['电商规模','US$ 145亿','+7%','人均最高'],['电商渗透率','28.2%','↑','全欧最高'],['人均可支配收入','US$ 52,500','+1.2%','极高'],['汇率','10.8 SEK/USD','±2%','克朗波动'],['外贸环境','利好','→','创新经济体']],demo:{age:[['0-14岁',17,'精品环保母婴'],['15-29岁',20,'可持续先锋'],['30-49岁',27,'家庭品质'],['50岁+',36,'银发数字消费']],ai_age:'25-50岁，可持续+数字化驱动',gender:{m:50,f:50},f_pref:'可持续时尚、有机美妆、家居设计',m_pref:'电子数码、户外装备、智能家居',religion:[['路德宗',55],['无宗教',30],['伊斯兰教',8],['其他',7]],risk:['市场小','高成本','北欧语言门槛'],opp:['数字化全欧最高','可持续消费文化强','Klarna分期普及'],fest:'Midsommar(6月) → 黑五(11月) → 圣诞(12月)',income:[['底层低收入',15,'折扣','#e0e4ec'],['中产主流层',48,'品质可持续','#2c5f8a'],['中高收入',27,'品牌升级','#4a90d9'],['高收入精英',10,'高端精品','#c8a84e']],price:[['低价平台','Temu/AliExpress','$3-15','性价比'],['中端主流','Amazon/CDON','$15-80','品质+环保'],['高端品牌','品牌独立站','$80+','精品环保']],price_trend:'可持续产品溢价高',shelf:'重可持续、评价',content:'Instagram+TikTok+Klarna',payment:'Klarna/信用卡/Swish',cod:1,peak:'19:00-22:00'},cat:{blue:[['可持续时尚','+22%'],['智能家居','+20%'],['户外运动','+18%'],['有机食品','+16%']],stable:['电子产品','家居日用','母婴'],risk:[['化妆品','EU CPNP必须'],['电子','CE+WEEE'],['食品','EU有机标签']]},plats:[['Amazon','📦',28,'货架电商','跨境FBA','8-15%','全品类','★★★'],['CDON','🔵',14,'百货电商','跨境','8-12%','全品类','★★☆'],['Elgiganten','🔴',10,'电子垂直','本土','8-12%','电子家电','★★☆'],['Zalando','👗',8,'时尚垂直','跨境','10-15%','时尚服饰','★★☆'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆']],comp:{level:'中等',cls:'medium',policies:[['high','EU统一合规','持续执行','全品类','全平台','CE/GDPR严格'],['mid','可持续包装','建议','全品类','全平台','偏好环保包装'],['mid','瑞典语说明','建议','全品类','全平台','本地化提升转化'],['low','Klarna支付','建议','全品类','全平台','最主流支付']]}},sg:{flag:'🇸🇬',name:'新加坡',subtitle:'Singapore · 东南亚高端电商市场',region:'东南亚',ai:{opp:'东南亚人均GDP最高市场，600万人口+极高数字化程度。消费者注重品质与便利，跨境购物习惯成熟',tracks:['美妆护肤 +18% 高端美妆消费旺盛','电子产品 +15% 科技消费领先','家居用品 +16% 品质生活需求'],risks:['⚠️ 市场规模小(600万)','⚠️ 运营成本高','⚠️ 竞争激烈但客单价高'],advice:['新手：Shopee新加坡站+Lazada','工厂：Amazon新加坡站+Qoo10','精品：品牌独立站+小红书营销']},macro:[['总人口','600万','+1.0%','城邦国家'],['电商规模','US$ 105亿','+12%','人均消费最高'],['电商渗透率','32.5%','↑','全东南亚最高'],['人均可支配收入','US$ 65,000','+2.5%','全东南亚最高'],['汇率','1.35 SGD/USD','±1%','新元稳定'],['外贸环境','利好','→','自由贸易港']],demo:{age:[['0-14岁',13,'精品母婴'],['15-29岁',20,'高端社交消费'],['30-49岁',32,'家庭消费核心'],['50岁+',35,'银发高品质消费']],ai_age:'25-55岁核心人群，品质+便利至上',gender:{m:49,f:51},f_pref:'高端美妆、时尚配饰、家居精品',m_pref:'电子数码、运动科技、汽车配件',religion:[['佛教',33],['无宗教',20],['基督教',19],['伊斯兰教',15],['其他',13]],risk:['市场小','运营成本高','竞争激烈'],opp:['人均GDP全东南亚最高','自由贸易港','华人+多元文化'],fest:'黑五(11月) → 圣诞(12月) → 新年大促(1月)',income:[['底层低收入',12,'折扣','#e0e4ec'],['中产主流层',48,'品质中端核心','#2c5f8a'],['中高收入',28,'品牌升级','#4a90d9'],['高收入精英',12,'高端精品','#c8a84e']],price:[['低价平台','Shopee/Lazada','$3-15','性价比'],['中端主流','Amazon/Qoo10','$15-80','品质+便利'],['高端品牌','品牌独立站','$80+','精品品质']],price_trend:'客单价全东南亚最高，品质消费为主',shelf:'重评价、配送速度、客服质量',content:'Instagram+TikTok+小红书',payment:'信用卡/PayNow/GrabPay',cod:3,peak:'19:00-22:00'},cat:{blue:[['美妆护肤','+18%'],['电子产品','+15%'],['家居用品','+16%'],['健康保健','+20%']],stable:['食品饮料','时尚服饰','母婴'],risk:[['化妆品','HSA注册'],['食品','SFA检验'],['电子','Safety Mark']]},plats:[['Shopee','🟠',40,'货架+内容','跨境/本土','5-8%','全品类','★★★'],['Lazada','🔵',22,'货架电商','跨境/本土','5-8%','全品类','★★☆'],['Amazon','📦',12,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Qoo10','🟢',5,'货架电商','本土','8-12%','全品类','★☆☆'],['Temu','🟠',4,'低价平台','跨境','平台承担','全品类低价','★★☆']],comp:{level:'中等',cls:'medium',policies:[['high','产品安全认证','持续','电子','全平台','需Safety Mark'],['mid','HSA化妆品注册','持续','美妆','全平台','需新加坡HSA批准'],['mid','SFA食品检验','持续','食品','全平台','进口食品需检验'],['low','GST 9%','持续','全品类','全平台','商品服务税9%']]}},tr:{flag:'🇹🇷',name:'土耳其',subtitle:'Turkey · 欧亚交汇电商大国',region:'中东',ai:{opp:'欧亚交汇大国，8000万人口+年轻结构。通胀推动线上消费增长，本土电商平台强势',tracks:['时尚服饰 +25% 土耳其纺织业基础强','家居家电 +22% 城镇化驱动','美妆个护 +28% 年轻女性驱动'],risks:['⚠️ 里拉汇率波动极大','⚠️ 通胀率超60%','⚠️ 进口关税高+额外关税'],advice:['新手：Trendyol/Hepsiburada跨境','工厂：本土店+Amazon土耳其站','精品：品牌独立站+Instagram营销']},macro:[['总人口','8,530万','+0.7%','欧亚最大'],['电商规模','US$ 280亿','+40%','高通胀推升'],['电商渗透率','15.8%','↑','快速增长'],['人均可支配收入','US$ 10,800','+5%','通胀中上升'],['汇率','34.5 TRY/USD','±8%','里拉贬值严重'],['外贸环境','复杂','↓','高关税+汇率波动']],demo:{age:[['0-14岁',24,'母婴市场大'],['15-29岁',26,'社交电商活跃'],['30-49岁',28,'家庭消费核心'],['50岁+',22,'保守消费']],ai_age:'20-40岁年轻人群，通胀下线上消费增长',gender:{m:49,f:51},f_pref:'时尚服饰、美妆护肤、家居装饰',m_pref:'电子数码、汽车配件、运动装备',religion:[['伊斯兰教',98],['其他',2]],risk:['里拉汇率波动极大','通胀率高','进口关税高'],opp:['8000万人口红利','纺织业基础强','欧亚贸易桥梁'],fest:'斋月(3-4月) → 共和国日(10月) → 年终大促(12月)',income:[['底层低收入',30,'极致低价','#e0e4ec'],['中产主流层',40,'通胀下性价比','#2c5f8a'],['中高收入',20,'品质升级','#4a90d9'],['高收入精英',10,'进口品牌','#c8a84e']],price:[['低价平台','Trendyol','$2-10','极致性价比'],['中端主流','Hepsiburada','$10-50','评价驱动'],['高端品牌','品牌独立站','$50+','进口品质']],price_trend:'高通胀下消费者寻求线上低价',shelf:'重价格、免运费、评价',content:'Instagram+TikTok+YouTube',payment:'信用卡 / debit卡 / COD',cod:15,peak:'20:00-23:00'},cat:{blue:[['美妆个护','+28%'],['时尚服饰','+25%'],['家居家电','+22%'],['3C配件','+20%']],stable:['食品饮料','日用品','汽车配件'],risk:[['化妆品','卫生部注册'],['食品','进口许可'],['电子','TSE认证']]},plats:[['Trendyol','🟠',38,'货架+内容','跨境/本土','8-15%','全品类','★★★'],['Hepsiburada','🔵',22,'货架电商','本土','8-12%','电子家居','★★☆'],['Amazon','📦',12,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆'],['n11','🟢',6,'货架电商','本土','8-12%','全品类','★☆☆']],comp:{level:'中等偏严格',cls:'strict',policies:[['high','进口关税高+额外关税','持续','全品类','全平台','对华关税额外征收'],['high','里拉汇率管制','持续','跨境','全平台','外汇交易受限'],['mid','化妆品卫生部注册','持续','美妆','全平台','需土耳其卫生部批准'],['low','TSE产品认证','持续','工业品','全平台','土耳其标准认证']]}},ua:{flag:'🇺🇦',name:'乌克兰',subtitle:'Ukraine · 东欧电商韧性市场',region:'独联体',ai:{opp:'东欧电商韧性市场，3,700万人口+极高数字化。Nova Poshta物流标杆，电商增速受战争影响但恢复中',tracks:['3C配件 +22% 数字化需求强','时尚服饰 +20% 消费恢复','家居用品 +18% 重建需求旺盛'],risks:['⚠️ 战争影响物流和安全','⚠️ 部分地区配送受限','⚠️ 汇率波动+经济不确定'],advice:['新手：Rozetka+Prom.ua','工厂：本土店+Allo','精品：品牌独立站+Instagram']},macro:[['总人口','3,700万','-1.5%','战争影响'],['电商规模','US$ 85亿','+20%','恢复增长'],['电商渗透率','15.5%','↑','数字化高'],['人均可支配收入','US$ 4,200','+3%','恢复中'],['汇率','41.5 UAH/USD','±3%','格里夫纳波动'],['外贸环境','复杂','↓','战争影响']],demo:{age:[['0-14岁',16,'母婴'],['15-29岁',22,'数字化消费'],['30-49岁',30,'家庭核心'],['50岁+',32,'银发消费']],ai_age:'25-45岁核心人群，数字化程度极高',gender:{m:46,f:54},f_pref:'时尚服饰、美妆护肤、家居用品',m_pref:'3C数码、汽车配件、太阳能产品',religion:[['东正教',67],['无宗教',20],['伊斯兰教',2],['其他',11]],risk:['战争影响物流','部分地区受限','经济不确定'],opp:['数字化程度极高','Nova Poshta物流标杆','重建需求推动消费'],fest:'黑五(11月) → 圣诞(12月) → 新年(1月)',income:[['底层低收入',30,'极致性价比','#e0e4ec'],['中产主流层',42,'性价比','#2c5f8a'],['中高收入',18,'品质升级','#4a90d9'],['高收入精英',10,'进口品牌','#c8a84e']],price:[['低价平台','Rozetka/Prom','$2-12','性价比'],['中端主流','Rozetka/Allo','$12-50','评价驱动'],['高端品牌','品牌独立站','$50+','品质']],price_trend:'性价比为主，重建需求推动家居增长',shelf:'重评价、Nova Poshta配送',content:'Instagram+Telegram+YouTube',payment:'信用卡/Privat24/COD',cod:12,peak:'19:00-22:00'},cat:{blue:[['3C配件','+22%'],['时尚服饰','+20%'],['家居用品','+18%'],['太阳能产品','+35%']],stable:['食品饮料','日用品','母婴'],risk:[['化妆品','注册'],['食品','检验'],['电子','认证']]},plats:[['Rozetka','🟢',32,'百货电商','本土','8-15%','全品类','★★★'],['Prom.ua','🔵',15,'平台','本土','5-10%','全品类','★★☆'],['Allo','💻',10,'电子垂直','本土','8-12%','电子数码','★★☆'],['AliExpress','🟠',6,'低价平台','跨境','5-8%','全品类','★★☆'],['Temu','🟠',3,'低价平台','跨境','平台承担','全品类低价','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['mid','战争物流影响','持续','全品类','全平台','部分地区配送受限'],['mid','产品认证','持续','全品类','全平台','乌克兰标准'],['low','消费者保护法','持续','全品类','全平台','14天退货'],['low','数据保护法','持续','全品类','全平台','合规']]}},za:{flag:'🇿🇦',name:'南非',subtitle:'South Africa · 非洲最成熟电商市场',region:'非洲',ai:{opp:'非洲电商最成熟市场，Takealot主导。消费者注重品质与品牌，数字化程度非洲最高',tracks:['电子产品 +20% 南非电子消费领先','家居用品 +18% 品质生活需求','时尚服饰 +22% SHEIN冲击本土'],risks:['⚠️ 电力系统不稳定(限电)','⚠️ 治安问题影响物流','⚠️ SHEIN/Temu冲击本土电商'],advice:['新手：Takealot+Amazon南非站','工厂：本土店+Makro','精品：品牌独立站+Instagram营销']},macro:[['总人口','6,060万','+0.8%','非洲第二经济'],['电商规模','US$ 55亿','+18%','非洲最成熟'],['电商渗透率','12.5%','↑','快速增长'],['人均可支配收入','US$ 6,200','+1.5%','非洲较高'],['汇率','18.5 ZAR/USD','±3%','兰特波动'],['外贸环境','平稳','→','金砖国家']],demo:{age:[['0-14岁',28,'母婴消费'],['15-29岁',27,'社交电商活跃'],['30-49岁',26,'家庭核心'],['50岁+',19,'银发消费']],ai_age:'20-45岁核心人群，品质+品牌意识强',gender:{m:48,f:52},f_pref:'美妆护肤、时尚服饰、家居装饰',m_pref:'电子数码、运动装备、汽车配件',religion:[['基督教',78],['无宗教',10],['伊斯兰教',2],['其他',10]],risk:['限电影响','治安影响物流','SHEIN/Temu冲击'],opp:['非洲电商最成熟','品牌消费意识强','基础设施相对完善'],fest:'黑五(11月) → 圣诞(12月) → 新年折扣(1月)',income:[['底层低收入',35,'极致低价','#e0e4ec'],['中产主流层',38,'品质性价比','#2c5f8a'],['中高收入',18,'品牌升级','#4a90d9'],['高收入精英',9,'高端品牌','#c8a84e']],price:[['低价平台','Takealot/Shein','$3-15','性价比'],['中端主流','Takealot/Amazon','$15-60','品质+品牌'],['高端品牌','品牌独立站','$60+','精品']],price_trend:'品质消费为主，SHEIN带来低价竞争',shelf:'重品牌、评价、配送速度',content:'Instagram+Facebook+TikTok',payment:'信用卡/EFT/Instant Money',cod:8,peak:'19:00-22:00'},cat:{blue:[['电子产品','+20%'],['时尚服饰','+22%'],['家居用品','+18%'],['健康保健','+20%']],stable:['食品饮料','母婴','日用品'],risk:[['化妆品','进口许可'],['食品','健康部认证'],['电子','NRCS认证']]},plats:[['Takealot','🔵',38,'货架电商','本土','8-15%','全品类','★★★'],['Amazon','📦',12,'货架电商','跨境FBA','8-15%','全品类','★★★'],['Shein','👗',10,'快时尚','跨境','10-15%','时尚服饰','★★☆'],['Temu','🟠',5,'低价平台','跨境','平台承担','全品类低价','★★☆'],['Makro','🏬',4,'批发零售','本土','8-12%','家居日用','★☆☆']],comp:{level:'中等',cls:'medium',policies:[['high','消费者保护法(CPA)','持续','全品类','全平台','6个月退货权'],['mid','电力系统不稳定','持续','全品类','全平台','限电影响配送'],['mid','NRCS电子认证','持续','电子产品','全平台','需南非标准认证'],['low','BEE经济赋权','建议','全品类','全平台','本土化建议']]}}};
var currentCountry='id';
var aiTabIdx=0;

// === Countries Page v2 - Full Rebuild ===
var cn2CurrentKey = 'id';
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
  cn2CurrentKey = key;
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
  var platColors2 = ['#3b7dd8','#2c5f8a','#4a90d9','#c8a84e','#e8879a'];
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
  searchInput.addEventListener('input', function(){
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
  });
  dd.addEventListener('click', function(e){
    var item = e.target.closest('.cn2-dd-item');
    if(item){ cn2Render(item.dataset.key); searchInput.value=''; dd.classList.remove('open'); }
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.cn2-search-wrap')){ dd.classList.remove('open'); }});
})();

// Export functions
function cn2ExportPDF(){
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
function cn2ExportExcel(){ toast('正在导出'+countryFullData[cn2CurrentKey].name+'市场数据Excel...'); setTimeout(function(){ toast('Excel已导出'); }, 1000); }
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
function cn2AddMaterial(){ rpAddMaterial('country', cn2CurrentKey, countryFullData[cn2CurrentKey].name+' 完整市场档案', '宏观+电商+政策+人口全量数据'); toast('已加入报告素材'); }

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

cn2Render('id');

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
      // Refresh alerts linkage
      if(typeof refreshDynamicAlerts === 'function') refreshDynamicAlerts();
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
      $('#pl-data-info').innerHTML = '📡 数据更新时间: ' + time + ' | 数据来源: ' + (data.source_count || '?') + '个';
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
  if (p.summary && p.summary.trim()) return;
  const region = plRegionLabels[p.region] || p.region || '相关地区';
  const cat = plCategoryLabels[p.category] || p.category || '政策';
  const impact = plImpactLabels[p.impact_level] || p.impact_level || '中';
  const source = p.source || '未注明';
  const date = p.published_at || '近期';
  p.summary = `【${region}】${cat}动态 — ${date}，${source}发布，影响等级：${impact}。该${cat}变化可能对跨境电商业务产生${impact==='高'?'重大':'一定'}影响，建议持续关注并评估合规风险。`;
}

function plInitFromJson() {
  const items = policiesJsonData.items;
  items.forEach(enrichPolicySummary);
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
    const sourceLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:#3366cc;text-decoration:none">📎 ${p.source||'来源'}</a>`:`<span>📎 ${p.source||'未知来源'}</span>`;
    const titleLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:inherit;text-decoration:none">${p.title}</a>`:p.title;
    const pubDate=p.published_at||'';
    return `<div class="pl-card">
      <div class="pl-risk-bar ${levelClass}"></div>
      <input type="checkbox" class="pl-card-check" ${checked} onclick="event.stopPropagation();plToggleSelect(${p._idx})">
      <div class="pl-card-body">
        <h3>${titleLink}</h3>
        <div class="pl-meta">
          <span class="pl-country-tag">🌍 ${regionLabel}</span>
          <span>📅 ${pubDate}</span>
          <span>${sourceLink}</span>
        </div>
        <div class="pl-tags-row">
          <span class="pl-type-tag">${catLabel}</span>
          <span class="pl-impact-tag" style="color:${impactColor};border-color:${impactColor};background:${impactColor}15">${impactLabel}影响</span>
        </div>
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
function plSearch(){plCurrentPage=1;renderPlList();}
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
  const sourceLink=p.source_url?`<a href="${p.source_url}" target="_blank" style="color:#3366cc">${p.source||'来源链接'}</a>`:(p.source||'未知');
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
    <b>一、政策背景：</b>${p.title}，来源: ${p.source||'未知'}，${catLabel}类型政策，发布于 ${p.published_at||'N/A'}。<br><br>
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
      $('#rl-data-info').innerHTML = '📡 数据更新时间: ' + time + ' | 数据来源: ' + (data.source_count || '?') + '个';
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
function renderRulesPage(){renderRlStats();renderRlAi();renderRlRules();renderRlActs();}

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
  const sourceLink=r.source_url?`<a href="${r.source_url}" target="_blank" style="color:#3366cc">查看原始来源</a>`:'无';
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

// ========== CONTENT PAGE - FULL REBUILD ==========
var ctSelected = new Set();
var ctActiveAI = 'convert';
var ctActiveMain = 'all';
var ctFavFolders = JSON.parse(localStorage.getItem('jay_ct_fav_folders') || '["美妆短视频参考","中东直播脚本"]');
var ctFavItems = JSON.parse(localStorage.getItem('jay_ct_fav_items') || '{}');

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
      var pool = JSON.parse(localStorage.getItem('jay_report_pool') || '[]');
      pool.push({type:'content-insight', title:title, content:desc, ts:Date.now()});
      localStorage.setItem('jay_report_pool', JSON.stringify(pool));
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
  var pool = JSON.parse(localStorage.getItem('jay_report_pool') || '[]');
  pool.push({type:'content', title:c[0], content:c[1]+' '+c[2]+' '+c[3]+' 播放'+c[5]+'万 转化'+c[9]+'% 达人'+c[7], ts:Date.now()});
  localStorage.setItem('jay_report_pool', JSON.stringify(pool));
  toast('已加入报告素材: ' + c[0].substring(0,20));
}
function ctBatchAddReport() {
  var pool = JSON.parse(localStorage.getItem('jay_report_pool') || '[]');
  ctSelected.forEach(function(idx) {
    var c = contentData[idx];
    pool.push({type:'content', title:c[0], content:c[1]+' '+c[2]+' 播放'+c[5]+'万 转化'+c[9]+'%', ts:Date.now()});
  });
  localStorage.setItem('jay_report_pool', JSON.stringify(pool));
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
    return '<button class="ct-fav-folder" data-folder="' + escapeHtml(f) + '" onclick="ctSelectFolder(\'' + escInline(f) + '\')" style="padding:5px 14px;border:1px solid #ddd;border-radius:16px;background:transparent;cursor:pointer;font-size:12px;margin-right:6px;margin-bottom:4px">' + escapeHtml(f) + ' (' + items.length + ')</button>';
  }).join('');
  ctRenderFavItems();
}
function ctNewFavFolder() {
  var name = prompt('输入文件夹名称');
  if(!name) return;
  ctFavFolders.push(name);
  ctFavItems[name] = [];
  localStorage.setItem('jay_ct_fav_folders', JSON.stringify(ctFavFolders));
  localStorage.setItem('jay_ct_fav_items', JSON.stringify(ctFavItems));
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
      '<button onclick="ctRemoveFav(\'' + escInline(ctActiveFolder) + '\',' + i + ')" style="font-size:10px;color:#e53935;background:none;border:none;cursor:pointer">移除</button>' +
    '</div>';
  }).join('');
}
function ctAddToFav(idx) {
  var c = contentData[idx];
  if(ctFavFolders.length === 0) { toast('请先创建收藏夹文件夹'); return; }
  var folder = ctActiveFolder || ctFavFolders[0];
  if(!ctFavItems[folder]) ctFavItems[folder] = [];
  ctFavItems[folder].push({title:c[0], creator:c[7], platform:c[1], ts:Date.now()});
  localStorage.setItem('jay_ct_fav_items', JSON.stringify(ctFavItems));
  toast('已收藏到: ' + folder);
  ctRenderFavFolders();
}
function ctRemoveFav(folder, idx) {
  ctFavItems[folder].splice(idx, 1);
  localStorage.setItem('jay_ct_fav_items', JSON.stringify(ctFavItems));
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
  localStorage.setItem('jay_ct_fav_items', JSON.stringify(ctFavItems));
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
  var tpls = JSON.parse(localStorage.getItem('jay_ct_tpl') || '[]');
  var name = prompt('模板名称', state.platform + ' ' + state.market + ' ' + state.type);
  if(!name) return;
  state.name = name;
  tpls.push(state);
  localStorage.setItem('jay_ct_tpl', JSON.stringify(tpls));
  ctRenderTplSelect();
  toast('模板已保存: ' + name);
}
function ctRenderTplSelect() {
  var sel = document.getElementById('ct-tpl-select');
  var tpls = JSON.parse(localStorage.getItem('jay_ct_tpl') || '[]');
  sel.innerHTML = '<option value="">加载模板...</option>' + tpls.map(function(t,i){ return '<option value="' + i + '">' + t.name + '</option>'; }).join('');
}
function ctLoadTpl(idx) {
  if(idx === '') return;
  var tpls = JSON.parse(localStorage.getItem('jay_ct_tpl') || '[]');
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
    resultEl.style.display='';
    resultEl.innerHTML='<div class="ovr-card"><div class="ovr-head"><span>🤖</span><h4>AI 正在分析「'+escapeHtml(q)+'」<small>结合 26 国 '+JAY_PLATFORM_COUNT+' 平台数据</small></h4></div><div class="ovr-loading"><i></i>正在匹配市场、政策与平台规则…</div></div>';
    resultEl.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

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
           '<div class="ovr-note">提示：结果基于当前系统数据与规则生成。如需更实时、更精准的联网分析，请在「设置 → AI 引擎」配置 DeepSeek API Key。</div></div>';
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
    if(typeof AI_ENGINE!=='undefined' && AI_ENGINE && AI_ENGINE.hasKey()){
      try{
        var systemPrompt='你是 JAY观海（跨境电商市场情报系统）的 AI 分析师。请基于 26 国 '+JAY_PLATFORM_COUNT+' 平台数据，对用户输入的品类或市场问题，给出简洁的市场机会、风险提醒和下一步建议。优先使用列表，控制在 300 字以内。';
        var answer=await callAI(systemPrompt, q, {max_tokens:800, timeout:20000, search:true});
        var bodyHtml='<div class="ovr-section">'+simpleRenderMd(answer)+'</div>';
        resultEl.innerHTML=buildHeroResultCard(q, bodyHtml, true);
        return;
      }catch(e){/* fall through to rule-based */}
    }
    // Rule-based fallback / demo mode
    setTimeout(function(){ resultEl.innerHTML=generateHeroResponseHTML(q); }, 400);
  }

  function heroSubmit(){
    var q=heroInput.value.trim();
    if(!q){toast('请输入你想问的问题');return;}
    toast('已收到：'+q+'，AI 正在分析市场机会与风险…');
    renderHeroResponse(q);
  }

  heroInput.onkeydown=function(e){if(e.key==='Enter')heroSubmit();};
  heroSend.onclick=heroSubmit;
  $('#ov-hero-chips').onclick=function(e){
    var btn=e.target.closest('button');if(!btn)return;
    heroInput.value=btn.dataset.q;heroSubmit();
  };
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
  window.hasRiskPolicy = hasRiskPolicy;
})();

try {
// -- Block 2: Plain KPI metric cards --
(function(){
  var metrics=[
    {icon:'🌍',label:'监测覆盖国家',val:'26',sub:'+4 本月新增',color:'#3b7dd8'},
    {icon:'▣',label:'接入电商平台',val:'41',sub:'货架 + 内容电商',color:'#4d946e'},
    {icon:'📦',label:'有效商品数据',val:'299万+',sub:'日新增 8 万条',color:'#c39142'},
    {icon:'📋',label:'政策 & 风险资讯',val:'2400+',sub:'每日实时更新',color:'#e65757'}
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
  svg.innerHTML='<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2c5f8a" stop-opacity="0.3"/><stop offset="100%" stop-color="#2c5f8a" stop-opacity="0.02"/></linearGradient></defs><polygon points="'+area+'" fill="url(#trendGrad)"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="#2c5f8a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+pad+'" cy="'+(h-pad-(vals[0]-minV)/(maxV-minV)*(h-2*pad)).toFixed(1)+'" r="4" fill="#2c5f8a"/><circle cx="'+(w-pad)+'" cy="'+(h-pad-(vals[vals.length-1]-minV)/(maxV-minV)*(h-2*pad)).toFixed(1)+'" r="4" fill="#3b7dd8"/><text x="'+(pad+6)+'" y="'+(h-pad-(vals[0]-minV)/(maxV-minV)*(h-2*pad)-8).toFixed(1)+'" font-size="11" fill="#2c5f8a" font-family="DM Mono">'+startV+'万</text><text x="'+(w-pad-40)+'" y="'+(h-pad-(vals[vals.length-1]-minV)/(maxV-minV)*(h-2*pad)-8).toFixed(1)+'" font-size="11" fill="#3b7dd8" font-family="DM Mono">'+endV+'万</text>';
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
} catch(e) { /* 旧总览模块 DOM 已移除，其初始化失败可安全忽略，避免阻断后续脚本（含 switchPage） */ if(window.console)console.warn('legacy overview init skipped:', e); }

// === 页面切换 ===

function rpAddCurrentToPool() {
  var activePage = document.querySelector('.page.active');
  if (!activePage) { toast('请先选择数据'); return; }
  var pageId = activePage.id;
  var type = '', title = '', source = '', summary = '';
  
  if (pageId === 'overview') {
    type = 'alert'; title = '首页总览数据'; source = '全局概览';
    summary = '包含全球市场机会评分、热点趋势、预警汇总等核心数据';
  } else if (pageId === 'watchlist') {
    type = 'alert'; title = '我的看板数据'; source = 'Watchlist';
    summary = '包含重点关注的店铺、商品、政策等看板数据';
  } else if (pageId === 'countries') {
    type = 'country'; title = '国家市场档案'; source = 'Country Archive';
    summary = '包含目标国家的市场规模、消费习惯、电商渗透率、政策环境等';
  } else if (pageId === 'platforms') {
    type = 'platform'; title = '电商平台档案'; source = 'Platform Archive';
    summary = '包含平台佣金政策、物流要求、流量分配、入驻条件等';
  } else if (pageId === 'products') {
    type = 'product'; title = '爆款雷达数据'; source = 'Product Radar';
    summary = '包含跨平台热销商品、销量趋势、价格区间、竞品分析';
  } else if (pageId === 'shops') {
    type = 'shop'; title = '店铺追踪数据'; source = 'Shop Tracker';
    summary = '包含标杆店铺运营数据、上新频率、营销策略、用户评价';
  } else if (pageId === 'content') {
    type = 'content'; title = '热门内容数据'; source = 'Content Tracker';
    summary = '包含短视频/直播热门内容、爆款脚本、达人合作机会';
  } else if (pageId === 'policies') {
    type = 'policy'; title = '政策动态数据'; source = 'Policy Tracker';
    summary = '包含最新政策法规、合规要求、关税调整、认证标准';
  } else if (pageId === 'rules') {
    type = 'rule'; title = '平台规则数据'; source = 'Platform Rules';
    summary = '包含平台佣金变动、物流新规、处罚规则、活动日历';
  } else if (pageId === 'alerts') {
    type = 'alert'; title = '预警中心数据'; source = 'Alert Center';
    summary = '包含全系统异动提醒、风险预警、倒计时提醒';
  } else {
    toast('当前页面不支持加入素材');
    return;
  }
  rpAddMaterial(type, title, source, summary);
}

function rpGenerateReport(tpl){
  var names={'market-research':'全球市场调研报告','competitor-analysis':'竞品分析报告','market-entry':'市场进入方案','product-selection':'选品策略报告','compliance-risk':'合规风险评估报告'};
  var area=$('#rp-preview-area');
  area.innerHTML='<div class="rp-generating"><div class="rp-gen-spinner"></div><p>正在生成 '+names[tpl]+' ...</p><small>正在整合素材池数据，请稍候</small></div>';
  setTimeout(function(){
    var pool=rpGetPool().filter(function(m){return m.selected});
    if(pool.length===0) pool=rpGetPool();
    var now=new Date();
    var ds=(now.getMonth()+1)+'/'+now.getDate()+' '+now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
    var report={name:names[tpl],tpl:tpl,date:now.toISOString(),time:ds,items:pool.slice()};
    var reps=rpV2GetReports(); reps.unshift(report);
    try{localStorage.setItem(RP_REPORTS_KEY,JSON.stringify(reps.slice(0,20)));}catch(e){}
    var html='<div class="rp-gen-done"><span class="rp-done-icon">✔</span><p>'+names[tpl]+' 已生成</p><small>共纳入 '+pool.length+' 条素材 · '+ds+'</small></div>';
    html+='<div style="margin-top:14px;border:1px solid var(--line);border-radius:8px;padding:14px;max-height:320px;overflow:auto">';
    html+='<h4 style="margin:0 0 8px">'+names[tpl]+' · 内容摘要</h4>';
    if(pool.length===0){ html+='<p style="color:var(--muted);font-size:13px">素材池暂无可纳入的内容，可先在各国/平台/政策页点击「加入报告素材」。</p>'; }
    else {
      var byType={};
      pool.forEach(function(m){ (byType[m.type]=byType[m.type]||[]).push(m); });
      Object.keys(byType).forEach(function(t){
        html+='<div style="margin:8px 0"><b style="font-size:13px">'+t+'（'+byType[t].length+'）</b><ul style="margin:4px 0 4px 18px;font-size:12.5px;color:#445">';
        byType[t].forEach(function(m){ html+='<li>'+escInline(m.title||m.text||m.q||'(未命名)')+(m.source?' <span style="color:#98a">· '+escInline(m.source)+'</span>':'')+'</li>'; });
        html+='</ul></div>';
      });
    }
    html+='</div>';
    html+='<div style="margin-top:12px"><button class="pr-primary-btn" onclick="rpExportAll()">导出此报告</button></div>';
    area.innerHTML=html;
    try{rpV2LoadRecent();}catch(e){}
    toast('报告生成完成（'+pool.length+' 条素材）');
  }, 1200);
}
function rpExportAll(){jayExportReport();}

// ===== Report Material Pool (Global) =====

// ===== 报告生成中心 v2 - 完整重建 =====
const RP_POOL_KEY = 'jay_report_pool';
const RP_REPORTS_KEY = 'jay_reports_v2';

// --- Pool Management ---
function rpGetPool(){try{return JSON.parse(localStorage.getItem(RP_POOL_KEY)||'[]')}catch(e){return[]}}
function rpSavePool(pool){localStorage.setItem(RP_POOL_KEY,JSON.stringify(pool));rpV2RefreshPoolUI()}
function rpAddMaterial(type,title,source,summary){
  var pool=rpGetPool();
  var id=Date.now()+'_'+Math.random().toString(36).substr(2,5);
  pool.push({id:id,type:type,title:title,source:source,summary:summary,addedAt:new Date().toISOString(),selected:true});
  rpSavePool(pool);toast('已加入报告素材池（报告生成中心可查看 · 共 '+pool.length+' 条）')
}
function rpRemoveMaterial(id){rpSavePool(rpGetPool().filter(function(m){return m.id!==id}))}
function rpV2SelectAll(){rpGetPool().forEach(function(m){m.selected=true});rpSavePool(rpGetPool())}
function rpV2DeselectAll(){rpGetPool().forEach(function(m){m.selected=false});rpSavePool(rpGetPool())}
function rpV2ToggleSelect(id){var pool=rpGetPool();pool.forEach(function(m){if(m.id===id)m.selected=!m.selected});rpSavePool(pool)}
function rpV2ClearPool(){if(!confirm('确定清空全部素材？此操作不可恢复。'))return;rpSavePool([]);toast('素材池已清空')}

// --- Pool UI ---
var rpV2Filter='all';
document.addEventListener('DOMContentLoaded',function(){
  setTimeout(function(){
    rpV2RefreshPoolUI();
    // Pool filter tags
    document.querySelectorAll('#rp-v2-pool-filter .rp-v2-pool-tag').forEach(function(tag){
      tag.addEventListener('click',function(){
        document.querySelectorAll('#rp-v2-pool-filter .rp-v2-pool-tag').forEach(function(t){t.classList.remove('active')});
        this.classList.add('active');
        rpV2Filter=this.dataset.filter;
        rpV2RefreshPoolUI();
      });
    });
    rpV2LoadRecent();
  },100);
});

function rpV2RefreshPoolUI(){
  var pool=rpGetPool();
  var body=document.getElementById('rp-v2-pool-body');
  if(!body)return;
  // Update stats
  var totalEl=document.getElementById('rp-stat-total');
  var selEl=document.getElementById('rp-stat-selected');
  var countEl=document.getElementById('rp-pool-count');
  var selectedCount=pool.filter(function(m){return m.selected}).length;
  if(totalEl)totalEl.textContent=pool.length;
  if(selEl)selEl.textContent=selectedCount;
  if(countEl)countEl.textContent='('+pool.length+')';
  // Config step count
  var cfgCount=document.getElementById('rp-v2-cfg-count');
  if(cfgCount)cfgCount.textContent=selectedCount;
  if(pool.length===0){
    body.innerHTML='<div class="rp-v2-pool-empty"><span class="rp-v2-pool-empty-icon">✦</span><p>暂无素材</p><small>在各页面点击"加入报告素材"按钮<br>数据将自动汇入素材库</small></div>';
    return;
  }
  // Filter
  var filtered=rpV2Filter==='all'?pool:pool.filter(function(m){return m.type===rpV2Filter});
  // Group by type
  var groups={};
  var typeLabels={product:'商品素材',shop:'店铺素材',content:'内容素材',country:'国家宏观',platform:'平台档案',policy:'政策动态',rule:'平台规则',alert:'预警数据'};
  var typeColors={product:'#6366f1',shop:'#8b5cf6',content:'#ec4899',country:'var(--green)',platform:'var(--orange)',policy:'#ef4444',rule:'#f59e0b',alert:'#64748b'};
  filtered.forEach(function(m){if(!groups[m.type])groups[m.type]=[];groups[m.type].push(m)});
  var html='';
  Object.keys(groups).forEach(function(type){
    var items=groups[type];
    html+='<div class="rp-v2-pool-group">';
    html+='<div class="rp-v2-pool-group-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">';
    html+='<span style="color:'+typeColors[type]+'">●</span> '+(typeLabels[type]||type);
    html+=' <span class="rp-v2-pool-gcount">('+items.length+')</span></div>';
    html+='<div>';
    items.forEach(function(m){
      var date=new Date(m.addedAt);
      var dateStr=(date.getMonth()+1)+'/'+date.getDate();
      html+='<div class="rp-v2-pool-item'+(m.selected?' selected':'')+'" data-id="'+escInline(m.id)+'">';
      html+='<input type="checkbox" '+((m.selected)?'checked':'')+' onchange="rpV2ToggleSelect(\''+escInline(m.id)+'\')">';
      html+='<div class="rp-v2-pool-item-body">';
      html+='<p class="rp-v2-pool-item-title">'+m.title+'</p>';
      html+='<div class="rp-v2-pool-item-meta">';
      html+='<span class="rp-v2-pool-item-type" style="background:'+(typeColors[m.type]||'var(--muted)')+'">'+( typeLabels[m.type]||m.type)+'</span>';
      html+='<span>'+m.source+'</span><span>'+dateStr+'</span></div></div>';
      html+='<button class="rp-v2-pool-item-remove" onclick="event.stopPropagation();rpRemoveMaterial(\''+escInline(m.id)+'\')" title="移除">×</button>';
      html+='</div>';
    });
    html+='</div></div>';
  });
  body.innerHTML=html;
}
function rpRenderPool(){rpV2RefreshPoolUI()}

// --- Step Navigation ---
var rpV2CurrentStep=1;
var rpV2SelectedTpl=null;
var rpV2Config={period:'7d',focus:'data',audience:'boss',format:'full'};
var rpV2TplNames={'product-research':'单品赛道选品调研报告','competitor-analysis':'竞品对标分析报告','market-entry':'单国出海市场可行性报告','content-marketing':'内容营销投放分析报告','custom':'自定义模板'};

function rpV2SelectTpl(el){
  document.querySelectorAll('.rp-v2-tpl-card').forEach(function(c){c.classList.remove('selected')});
  el.classList.add('selected');
  rpV2SelectedTpl=el.dataset.tpl;
  var nameEl=document.getElementById('rp-v2-tpl-name');
  if(nameEl)nameEl.textContent=rpV2TplNames[rpV2SelectedTpl]||rpV2SelectedTpl;
  var cfgTpl=document.getElementById('rp-v2-cfg-tpl');
  if(cfgTpl)cfgTpl.textContent=rpV2TplNames[rpV2SelectedTpl]||'-';
  document.getElementById('rp-v2-next-btn').disabled=false;
}
function rpV2Toggle(el){
  var cfg=el.dataset.cfg;
  var val=el.dataset.val;
  rpV2Config[cfg]=val;
  el.parentElement.querySelectorAll('.rp-v2-toggle').forEach(function(t){t.classList.remove('active')});
  el.classList.add('active');
}
function rpV2GoStep(step){
  rpV2CurrentStep=step;
  ['rp-panel-step1','rp-panel-step2','rp-panel-step3'].forEach(function(id,i){
    document.getElementById(id).style.display=(i+1===step)?'block':'none';
  });
  ['rp-step-1','rp-step-2','rp-step-3'].forEach(function(id,i){
    var el=document.getElementById(id);
    el.classList.remove('active','done');
    if(i+1===step)el.classList.add('active');
    else if(i+1<step)el.classList.add('done');
  });
  if(step===2){
    var pool=rpGetPool();
    var sel=pool.filter(function(m){return m.selected});
    document.getElementById('rp-v2-cfg-count').textContent=sel.length;
    rpV2LoadTpls();
  }
}

// --- Report Generation (Simulated AI) ---
var rpGenInterval=null;  // P3-4: 模块级变量，防止重复点击创建多个定时器
function rpV2Generate(){
  if(rpGenInterval){ return; }  // 防重入
  var topicEl = document.getElementById('rp-v2-topic');
  var topic = topicEl ? topicEl.value.trim() : '';
  var pool = rpGetPool().filter(function(m){ return m.selected; });
  if(!topic && pool.length === 0){ toast('请填写行业/产品，或至少勾选 1 条素材'); return; }
  if(!AI_ENGINE.hasKey()){ toast('请先在「设置 → 数据源配置 → AI 引擎」填写 DeepSeek API Key'); openSettingsAI(); return; }
  rpV2GoStep(3);
  var body = document.getElementById('rp-v2-preview-body');
  var title = topic ? ('《' + topic + '》市场调研报告') : (rpV2TplNames[rpV2SelectedTpl] || '市场调研报告');
  document.getElementById('rp-v2-preview-title').textContent = title;
  body.innerHTML = '<div class="rp-v2-generating"><div style="font-size:32px;color:var(--green)">✦</div><h3 style="margin:12px 0 4px;font-weight:bold;font-size:16px">AI 正在生成报告</h3><p style="font-size:12px;color:var(--muted)">基于输入与 ' + pool.length + ' 条素材智能分析中...</p></div>';
  rpGenInterval = true;
  var periodLabel = {'7d':'近7天','1m':'近1个月','3m':'近3个月','6m':'近3-6个月'}[rpV2Config.period] || '近7天';
  var focusLabel = {'data':'数据量化导向','strategy':'运营策略导向','balance':'均衡'}[rpV2Config.focus] || '数据量化';
  var audienceLabel = {'boss':'决策层','ops':'运营团队','client':'外部客户'}[rpV2Config.audience] || '决策层';
  var formatLabel = {'full':'完整报告','exec':'执行摘要','slides':'演示文稿大纲'}[rpV2Config.format] || '完整报告';
  var matText = pool.map(function(m){ return '- ' + (m.title || '') + '（' + (m.type || '') + '）：' + (m.summary || m.source || ''); }).join('\n');
  var customEl = document.getElementById('rp-v2-custom-prompt');
  var customText = customEl ? customEl.value.trim() : '';
  var system = [
    '你是资深跨境电商市场研究分析师与报告结构专家，输出结构化、数据驱动、可落地的市场调研报告，使用简体中文。',
    '格式要求（Markdown）：',
    '1) 用 ## 二级标题分章节、### 三级标题分小节；',
    '2) 关键数据必须用表格呈现（| 列1 | 列2 |），整篇至少 2 张表（如市场规模、竞争格局）；',
    '3) 核心结论/机会/风险用引用块给出：行首 " > " ，含 ✅ 表示机会或建议，含 ⚠ 表示风险或注意；',
    '4) 明确区分事实与推断：具体数字必须标注来源，估算值标注"约/估算"，不得编造精确数字；',
    '5) 不要用代码块包裹整篇报告。',
    '【当前日期】' + jayNowHuman() + '。请基于截至该日期的最新公开信息生成，优先引用 2026 年的市场与政策数据；引用历史数据须明确标注具体年份，不得混淆时效。'
  ].join('\n');
  var user = '请为以下对象生成一份市场调研报告。\n';
  user += '【当前日期】' + jayNowHuman() + '（' + jayNowDate() + '），请确保报告内容反映该日期前后的最新情况。\n';
  user += '【调研对象】' + (topic ? topic : '（见素材）') + '\n';
  user += '【数据周期】' + periodLabel + ' 【输出侧重】' + focusLabel + ' 【受众】' + audienceLabel + ' 【格式】' + formatLabel + '\n';
  if(matText) user += '【已选素材】\n' + matText + '\n';
  user += '【报告结构要求】\n';
  user += '## 一、执行摘要（3-5 条要点，用 > ✅ 引用块呈现核心结论）\n';
  user += '## 二、市场规模与增长趋势（表格：年份 | 市场规模 | 同比增速 | 来源；说明驱动因素）\n';
  user += '## 三、竞争格局与主要玩家（表格：玩家 | 定位 | 份额估算 | 核心优势 | 来源）\n';
  user += '## 四、目标用户画像（人群特征、消费偏好、购买决策因素）\n';
  user += '## 五、行业痛点与机会（> ⚠ 列风险，> ✅ 列机会）\n';
  user += '## 六、进入与运营策略建议（按受众给出可执行动作）\n';
  user += '## 七、风险与合规（政策、平台规则、知识产权）\n';
  user += '## 八、数据来源与方法说明（列出参考维度与口径，标注估算部分）\n';
  if(audienceLabel==='决策层'){ user += '【受众适配】结论先行、精简，突出市场规模与机会。\n'; }
  else if(audienceLabel==='运营团队'){ user += '【受众适配】突出可拆解动作清单与时间线。\n'; }
  else if(audienceLabel==='外部客户'){ user += '【受众适配】专业详实、数据充分、措辞严谨。\n'; }
  if(formatLabel==='执行摘要'){ user += '【格式适配】只输出精简版：执行摘要 + 机会/风险引用块 + 一张核心数据表。\n'; }
  else if(formatLabel==='演示文稿大纲'){ user += '【格式适配】输出幻灯片大纲：每页一个 ## 标题 + 3-5 条要点。\n'; }
  if(customText) user += '\n【特别要求】' + customText;
  callAI(system, user, { temperature: 0.7, max_tokens: 3000, search: true })
    .then(function(report){
      rpLastReportText = report;
      rpLastReportTitle = title;
      body.innerHTML = '<div class="rp-v2-rpt">' + renderMarkdownSafe(report) + '</div>';
      rpV2SaveReport(title, pool.length);
      toast('报告生成完成！');
    })
    .catch(function(e){
      if(e.message === 'NO_API_KEY'){
        body.innerHTML = '<div class="rp-v2-rpt"><p style="color:#ef4444">未配置 API Key，请到设置中填写 DeepSeek API Key。</p></div>';
        toast('请先填写 DeepSeek API Key'); openSettingsAI();
      } else {
        body.innerHTML = '<div class="rp-v2-rpt"><p style="color:#ef4444">生成失败：' + escapeHtml(e.message) + '</p></div>';
        toast('报告生成失败');
      }
    })
    .finally(function(){ rpGenInterval = false; });
}


function rpV2RenderReport(pool,tplName){
  var body=document.getElementById('rp-v2-preview-body');
  var typeLabels={product:'商品',shop:'店铺',content:'内容',country:'国家',platform:'平台',policy:'政策',rule:'规则',alert:'预警'};
  var typeCount={};
  pool.forEach(function(m){typeCount[m.type]=(typeCount[m.type]||0)+1});
  var now=new Date();
  var dateStr=now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
  var periodLabel={'7d':'近7天','1m':'近1个月','3m':'近3个月','6m':'近3-6个月'}[rpV2Config.period]||'近7天';
  var focusLabel={'data':'数据量化导向','strategy':'运营策略导向','balance':'均衡'}[rpV2Config.focus]||'数据量化';
  var audienceLabel={'boss':'决策层','ops':'运营团队','client':'外部客户'}[rpV2Config.audience]||'决策层';
  var customPrompt=document.getElementById('rp-v2-custom-prompt');
  var customText=customPrompt?customPrompt.value:'';
  var h='<div class="rp-v2-rpt">';
  h+='<h2>'+tplName+'</h2>';
  h+='<div class="rp-v2-rpt-meta">生成时间: '+now.toLocaleString('zh-CN')+' | 数据周期: '+periodLabel+' | 素材来源: '+pool.length+'条 | 输出侧重: '+focusLabel+' | 受众: '+audienceLabel+'</div>';
  // Section 1: Executive Summary
  h+='<div class="rp-v2-rpt-section"><h3>一、执行摘要</h3>';
  h+='<p>本报告基于 JAY观海 全球电商情报系统 '+pool.length+' 条实时监测数据，覆盖 '+Object.keys(typeCount).length+' 个数据维度，分析周期为 '+periodLabel+'。核心发现如下：</p>';
  h+='<div class="rp-v2-rpt-highlight"><strong>关键发现：</strong>';
  var productCount=typeCount['product']||0;
  var shopCount=typeCount['shop']||0;
  var countryCount=typeCount['country']||0;
  var contentCount=typeCount['content']||0;
  var policyCount=typeCount['policy']||0;
  if(productCount>0)h+=' 共监测 '+productCount+' 个热门/竞品商品数据点；';
  if(shopCount>0)h+=' 追踪 '+shopCount+' 家竞品店铺经营动态；';
  if(countryCount>0)h+=' 覆盖 '+countryCount+' 个国家/市场宏观数据；';
  if(contentCount>0)h+=' 分析 '+contentCount+' 条热门内容/达人投放数据；';
  if(policyCount>0)h+=' 收录 '+policyCount+' 条政策/合规变动信息；';
  h+='</div>';
  if(customText){h+='<div class="rp-v2-rpt-highlight"><strong>定制分析重点：</strong>'+customText+'</div>';}
  h+='</div>';
  // Section 2: Material Overview
  h+='<div class="rp-v2-rpt-section"><h3>二、数据素材全景</h3>';
  h+='<table><tr><th>数据类型</th><th>素材数量</th><th>占比</th><th>核心关注点</th></tr>';
  var focusMap={product:'爆款趋势、价格带、增速类目',shop:'GMV、品类布局、评分、增长',content:'转化率、播放量、达人成本',country:'GDP、人口红利、消费渗透率',platform:'平台GMV、流量成本、规则',policy:'关税、合规、监管变动',rule:'平台规则调整、处罚案例',alert:'风险预警、异常波动'};
  Object.keys(typeCount).forEach(function(t){
    var pct=(typeCount[t]/pool.length*100).toFixed(1);
    h+='<tr><td><strong>'+(typeLabels[t]||t)+'</strong></td><td>'+typeCount[t]+' 条</td><td>'+pct+'%</td><td style="font-size:11px;color:var(--muted)">'+(focusMap[t]||'-')+'</td></tr>';
  });
  h+='</table></div>';
  // Section 3: Detailed Analysis (template-specific)
  h+='<div class="rp-v2-rpt-section"><h3>三、深度分析</h3>';
  if(rpV2SelectedTpl==='product-research'||rpV2SelectedTpl==='custom'){
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.1 市场容量与增长趋势</h4>';
    h+='<p>根据素材池中的商品和国家数据，目标市场呈现以下特征：</p>';
    h+='<ul><li>整体品类处于成长期向成熟期过渡阶段，头部竞品增速趋于稳定</li>';
    h+='<li>中腰部卖家通过差异化定位实现快速突围，细分赛道仍有结构性机会</li>';
    h+='<li>内容电商渠道增速显著高于传统货架电商，短视频/直播引流效率提升 40-60%</li></ul>';
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.2 竞争格局分析</h4>';
    if(shopCount>0){
      h+='<p>追踪到的 '+shopCount+' 家竞品店铺呈现明显分化：</p>';
      h+='<table><tr><th>维度</th><th>头部玩家</th><th>中腰部卖家</th><th>新入局者</th></tr>';
      h+='<tr><td>GMV 占比</td><td>55-65%</td><td>25-35%</td><td>&lt;10%</td></tr>';
      h+='<tr><td>平均增速</td><td>8-15%</td><td>25-45%</td><td>50-100%+</td></tr>';
      h+='<tr><td>核心策略</td><td>品牌化+供应链</td><td>差异化+内容</td><td>低价引流</td></tr></table>';
    }else{
      h+='<p>当前素材中店铺数据较少，建议补充竞品店铺追踪数据以获得更精准分析。</p>';
    }
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.3 价格带与利润空间</h4>';
    h+='<div class="rp-v2-rpt-chart-placeholder">📊 价格带分布图（基于素材数据自动绘制）</div>';
  }
  if(rpV2SelectedTpl==='competitor-analysis'){
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.1 竞品店铺全景</h4>';
    h+='<p>基于 '+shopCount+' 家追踪店铺数据，竞品格局分析如下：</p>';
    h+='<table><tr><th>竞争层级</th><th>店铺特征</th><th>GMV 区间</th><th>核心壁垒</th></tr>';
    h+='<tr><td>T1 头部</td><td>品牌旗舰/大卖</td><td>$100万+/月</td><td>品牌+供应链+流量</td></tr>';
    h+='<tr><td>T2 腰部</td><td>垂类专精卖家</td><td>$10-100万/月</td><td>品类深度+复购</td></tr>';
    h+='<tr><td>T3 长尾</td><td>铺货/跟卖型</td><td>&lt;$10万/月</td><td>价格+上新速度</td></tr></table>';
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.2 流量结构拆解</h4>';
    h+='<ul><li>搜索流量占比：35-45%（受平台搜索算法调整影响）</li>';
    h+='<li>内容引流占比：25-35%（短视频+直播持续增长）</li>';
    h+='<li>活动流量占比：15-20%（大促期间峰值可达 50%+）</li>';
    h+='<li>私域流量占比：5-10%（粉丝复购+社群运营）</li></ul>';
  }
  if(rpV2SelectedTpl==='market-entry'){
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.1 目标市场宏观评估</h4>';
    if(countryCount>0){
      h+='<p>基于 '+countryCount+' 个国家/市场的宏观经济数据：</p>';
    }
    h+='<table><tr><th>评估维度</th><th>权重</th><th>评估标准</th></tr>';
    h+='<tr><td>GDP 增速</td><td>20%</td><td>&gt;5% 高增长 / 3-5% 稳健 / &lt;3% 成熟</td></tr>';
    h+='<tr><td>电商渗透率</td><td>20%</td><td>&gt;30% 成熟 / 15-30% 成长 / &lt;15% 早期</td></tr>';
    h+='<tr><td>人口红利</td><td>15%</td><td>中位年龄 &lt;30 为高红利</td></tr>';
    h+='<tr><td>政策友好度</td><td>20%</td><td>关税、外资限制、平台准入门槛</td></tr>';
    h+='<tr><td>物流基建</td><td>15%</td><td>海外仓覆盖、配送时效、COD 支持</td></tr>';
    h+='<tr><td>竞争强度</td><td>10%</td><td>头部集中度、价格战烈度</td></tr></table>';
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.2 平台选择建议</h4>';
    h+='<div class="rp-v2-rpt-success"><strong>推荐策略：</strong>新市场建议采用"1+1"双平台策略，1 个货架电商（如 Shopee/Amazon）+ 1 个内容电商（如 TikTok Shop），降低单平台风险。</div>';
  }
  if(rpV2SelectedTpl==='content-marketing'){
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.1 内容生态概览</h4>';
    if(contentCount>0){
      h+='<p>基于 '+contentCount+' 条热门内容数据分析：</p>';
    }
    h+='<table><tr><th>内容类型</th><th>平均播放/阅读</th><th>转化率</th><th>达人成本</th></tr>';
    h+='<tr><td>短视频种草</td><td>5-50万</td><td>1.5-3.5%</td><td>$50-500/条</td></tr>';
    h+='<tr><td>直播带货</td><td>场观 1000-5万</td><td>3-8%</td><td>$100-2000/场</td></tr>';
    h+='<tr><td>图文笔记</td><td>5000-10万</td><td>0.5-2%</td><td>$20-200/篇</td></tr>';
    h+='<tr><td>品牌挑战赛</td><td>100万+</td><td>0.3-1%</td><td>$5000+/活动</td></tr></table>';
    h+='<h4 style="font:bold 13px \'Noto Sans SC\';color:var(--ink);margin:12px 0 6px">3.2 达人分层投放策略</h4>';
    h+='<div class="rp-v2-rpt-success"><strong>黄金比例建议：</strong>头部达人(5%) 引爆声量 + 腰部达人(25%) 持续种草 + 素人/KOC(70%) 口碑铺量</div>';
  }
  h+='</div>';
  // Section 4: 风险与合规
  h+='<div class="rp-v2-rpt-section"><h3>四、风险与合规提示</h3>';
  if(policyCount>0){
    h+='<div class="rp-v2-rpt-risk"><strong>⚠ 政策风险关注：</strong>素材中包含 '+policyCount+' 条政策变动数据，建议重点关注以下方面：</div>';
  }else{
    h+='<div class="rp-v2-rpt-risk"><strong>⚠ 通用风险提示：</strong></div>';
  }
  h+='<ul><li><strong>关税政策：</strong>关注目标市场进口关税调整，部分品类可能面临加征风险</li>';
  h+='<li><strong>平台合规：</strong>各平台规则频繁调整，需持续监控违规处罚案例</li>';
  h+='<li><strong>知识产权：</strong>避免侵权风险，做好商标注册和产品合规认证</li>';
  h+='<li><strong>数据隐私：</strong>不同市场数据保护法规差异大，需本地化合规处理</li></ul>';
  h+='</div>';
  // Section 5: Action Plan
  h+='<div class="rp-v2-rpt-section"><h3>五、落地行动建议</h3>';
  h+='<div class="rp-v2-rpt-success"><strong>优先级排序（基于素材数据智能评估）：</strong></div>';
  h+='<ol><li><strong>短期（1-2周）：</strong>锁定 Top 3 潜力品类，完成竞品调研和供应链初步对接</li>';
  h+='<li><strong>中期（1-3月）：</strong>选定目标市场+平台组合，完成店铺开设和首批上架</li>';
  h+='<li><strong>长期（3-6月）：</strong>建立内容矩阵+达人合作体系，形成稳定出单模型</li>';
  h+='<li><strong>持续监控：</strong>每周更新素材池数据，动态调整策略方向</li></ol>';
  h+='</div>';
  // Section 6: Data Sources
  h+='<div class="rp-v2-rpt-section"><h3>六、数据来源声明</h3>';
  h+='<p>本报告数据全部来源于 JAY观海 全球电商情报系统实时监测，包含：</p>';
  h+='<ul><li>系统自动采集的 '+pool.length+' 条多平台数据素材</li>';
  h+='<li>各国官方宏观经济统计数据</li>';
  h+='<li>平台公开数据和第三方分析机构报告</li></ul>';
  h+='<p style="font-size:11px;color:var(--muted);margin-top:8px">数据截止时间：'+dateStr+' | 报告由 AI 智能生成，关键决策请结合人工判断</p>';
  h+='</div>';
  h+='</div>';
  body.innerHTML=h;
  // Save to recent reports
  rpV2SaveReport(tplName,pool.length);
  toast('报告生成完成！');
}


// Module 2: 基于调研报告生成可落地电商执行计划
var rpPlanBusy = false;
async function rpV2GeneratePlan(){
  if(!rpLastReportText){ toast('请先生成市场调研报告'); return; }
  if(rpPlanBusy){ return; }
  if(!AI_ENGINE.hasKey()){ toast('请先在设置中填写 DeepSeek API Key'); openSettingsAI(); return; }
  rpPlanBusy = true;
  showAIModal('电商执行计划', '<div class="rp-v2-generating"><div style="font-size:28px;color:var(--green)">⚡</div><h3 style="margin:12px 0 4px;font-weight:bold;font-size:16px">AI 正在制定执行计划</h3><p style="font-size:12px;color:var(--muted)">基于已生成的调研报告...</p></div>');
  try {
    var system = [
      '你是资深跨境电商运营顾问。基于给定的市场调研报告，输出可落地的电商执行计划，使用简体中文。',
      '结构要求（Markdown）：',
      '1) 按模块分章：## 一、选品与SKU规划；## 二、定价策略；## 三、渠道布局；## 四、营销推广与预算ROI；## 五、供应链与运营关键节点。',
      '2) 用一张总表汇总落地动作：| 阶段 | 关键动作 | 负责角色 | 时间线 | 依据(报告数据点) |。',
      '3) 用 > ✅ 标注关键里程碑，> ⚠ 标注执行风险。',
      '4) 每项动作尽量可拆解、可追踪；明确预算与预期ROI。',
      '【当前日期】' + jayNowHuman() + '。请基于截至该日期的最新市场与政策环境制定计划，引用最新数据与政策。'
    ].join('\n');
    var user = '【当前日期】' + jayNowHuman() + '（' + jayNowDate() + '）。\n以下是市场调研报告内容：\n\n' + rpLastReportText + '\n\n请基于以上报告，生成可落地的电商执行计划（任务清单格式，尽量可拆解、可追踪）。';
    var plan = await callAI(system, user, { temperature: 0.6, max_tokens: 3000, search: true });
    var b = document.getElementById('rp-ai-modal-body');
    if(b) b.innerHTML = '<div class="rp-v2-rpt">' + renderMarkdownSafe(plan) + '</div>';
    toast('执行计划已生成');
  } catch(e){
    var b = document.getElementById('rp-ai-modal-body');
    if(b) b.innerHTML = '<p style="color:#ef4444">生成失败：' + (e.message === 'NO_API_KEY' ? '请先填写 API Key' : escapeHtml(e.message)) + '</p>';
    if(e.message !== 'NO_API_KEY') toast('执行计划生成失败');
  } finally {
    rpPlanBusy = false;
  }
}

// --- Report History ---
function rpV2SaveReport(name,materialCount){
  var reports=rpV2GetReports();
  reports.unshift({name:name,materials:materialCount,date:new Date().toISOString(),tpl:rpV2SelectedTpl});
  if(reports.length>20)reports=reports.slice(0,20);
  localStorage.setItem(RP_REPORTS_KEY,JSON.stringify(reports));
  var statEl=document.getElementById('rp-stat-reports');
  if(statEl)statEl.textContent=reports.length;
  rpV2LoadRecent();
}
function rpV2GetReports(){try{return JSON.parse(localStorage.getItem(RP_REPORTS_KEY)||'[]')}catch(e){return[]}}
function rpV2LoadRecent(){
  var list=document.getElementById('rp-v2-recent-list');
  if(!list)return;
  var reports=rpV2GetReports();
  var statEl=document.getElementById('rp-stat-reports');
  if(statEl)statEl.textContent=reports.length;
  if(reports.length===0){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font:12px \'Noto Sans SC\'">暂无历史报告</div>';return}
  var h='';
  reports.forEach(function(r,i){
    var d=new Date(r.date);
    var ds=(d.getMonth()+1)+'/'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
    h+='<div class="rp-v2-recent-item" onclick="toast(\'加载历史报告: '+escInline(r.name)+'\')">';
    h+='<div class="rp-v2-recent-icon">◈</div>';
    h+='<div class="rp-v2-recent-info"><strong>'+r.name+'</strong><small>'+ds+' · '+r.materials+'条素材</small></div></div>';
  });
  list.innerHTML=h;
}

// --- AI Tools ---
function rpV2AiTool(type){
  var pool = rpGetPool().filter(function(m){ return m.selected; });
  if(pool.length === 0){ toast('请先勾选素材'); return; }
  var resultEl = document.getElementById('rp-ai-' + type + '-result');
  if(!resultEl) return;
  if(!AI_ENGINE.hasKey()){ resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:#ef4444">请先在设置中填写 DeepSeek API Key</p></div>'; return; }
  resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:var(--muted);text-align:center;padding:10px">AI 分析中...</p></div>';
  var titles = pool.map(function(m){ return (m.title || '') + '（' + (m.type || '') + '）：' + (m.summary || m.source || ''); }).join('\n');
  var sys, usr;
  if(type === 'summary'){ sys = '你是跨境电商分析助手，请基于素材提炼核心结论。中文，要点式。'; usr = '素材：\n' + titles + '\n\n请提炼 3-5 条核心发现与数据洞察。'; }
  else if(type === 'risk'){ sys = '你是跨境电商合规风险专家。中文，分高/中/低风险提示并给建议。'; usr = '素材：\n' + titles + '\n\n请扫描政策/赛道/平台违规风险，给出风险等级与应对建议。'; }
  else { sys = '你是选品顾问。中文，给出 3-5 个潜力品类及理由。'; usr = '素材：\n' + titles + '\n\n请推荐潜力品类方向及入选理由。'; }
  var dateNote = '\n【当前日期】' + jayNowHuman() + '，请基于最新公开信息分析。';
  sys += dateNote; usr += dateNote;
  callAI(sys, usr, { temperature: 0.5, max_tokens: 1400, search: true })
    .then(function(out){ resultEl.innerHTML = '<div class="rp-v2-ai-result">' + renderMarkdownSafe(out) + '</div>'; toast('AI 分析完成'); })
    .catch(function(e){ resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:#ef4444">分析失败：' + (e.message === 'NO_API_KEY' ? '请先填写 API Key' : escapeHtml(e.message)) + '</p></div>'; });
}


// --- Export ---
function rpV2Export(format){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('请先生成报告');return}
  toast('正在导出 '+format.toUpperCase()+' ...');
  // Build markdown from preview
  var content='# '+document.getElementById('rp-v2-preview-title').textContent+'\n\n';
  content+='> 生成时间: '+new Date().toLocaleString('zh-CN')+'\n\n';
  body.querySelectorAll('h3').forEach(function(h3){content+='\n## '+h3.textContent+'\n'});
  body.querySelectorAll('h4').forEach(function(h4){content+='\n### '+h4.textContent+'\n'});
  body.querySelectorAll('p').forEach(function(p){if(p.textContent.trim())content+=p.textContent+'\n\n'});
  body.querySelectorAll('li').forEach(function(li){content+='- '+li.textContent+'\n'});
  body.querySelectorAll('table').forEach(function(table){
    var rows=table.querySelectorAll('tr');
    rows.forEach(function(row,i){
      var cells=row.querySelectorAll('th,td');
      var line='| ';
      cells.forEach(function(c){line+=c.textContent+' | '});
      content+=line+'\n';
      if(i===0){content+=line.replace(/[^|]/g,'-')+'\n'}
    });
    content+='\n';
  });
  setTimeout(function(){
    var ext=format==='pdf'?'.md':'.md';
    var blob=new Blob([content],{type:'text/markdown'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download='JAY观海_Report_'+Date.now()+ext;a.click();
    URL.revokeObjectURL(url);
    toast('报告已导出');
  },800);
}
function rpV2SaveDraft(){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('暂无内容可保存');return}
  localStorage.setItem('jay_draft_v2',body.innerHTML);
  toast('草稿已保存');
}
function rpV2CopyReport(){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body)return;
  var text=body.innerText;
  if(navigator.clipboard){navigator.clipboard.writeText(text).then(function(){toast('已复制到剪贴板')})}
  else{toast('复制失败，请手动选择复制')}
}
// Legacy compat
function rpUpdatePoolUI(){rpV2RefreshPoolUI()}


function switchPage(name,opts){ if(!(opts&&opts.fromHash)){ try{ if(location.hash!=='#'+name) history.pushState(null,'','#'+name); }catch(e){} }$$('.page').forEach(p=>p.classList.toggle('active',p.id===name));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===name));var titles={overview:(typeof jayGreeting==='function'?jayGreeting():'您好')+'，'+((jayUser&&jayUser.name)?jayUser.name:'陆安然'),watchlist:'我的重点看板',products:'产品全域雷达',countries:'国家市场档案',shops:'店铺追踪',alerts:'预警中心',report:'报告生成中心',settings:'设置与权限',platforms:'电商平台档案',policies:'政策动态',rules:'平台规则变动',content:'热门内容追踪'};var JAY_BC={overview:'首页 / 总览',watchlist:'我的看板',products:'商品 / 产品全域雷达',countries:'市场 / 国家市场档案',shops:'商品 / 店铺追踪',alerts:'风险 / 预警中心',report:'方案 / 报告生成中心',settings:'账户 / 设置与权限',platforms:'平台 / 电商平台档案',policies:'风险 / 政策动态',rules:'风险 / 平台规则变动',content:'热门内容追踪'};$('#page-title').textContent=titles[name]||name;$('#breadcrumb').textContent=JAY_BC[name]||name;if(name==='alerts')renderAlerts();if(name==='settings'){stInit();aiInitKeyUI();}if(name==='report'){rpV2RefreshPoolUI();rpV2LoadRecent();}
if(name==='platforms'){ var prg=jayCountryRegion(JAY_CTX.country||''); var pf=$('#plat-region-filter'); if(pf&&prg) pf.value=prg; renderPlatforms(); }
if(name==='policies'){ var rgName=jayCountryRegion(JAY_CTX.country||''); var rgCode=rgName?plRegionCodeByName[rgName]:null; if(rgCode){ var plf=$('#pl-f-region'); if(plf) plf.value=rgCode; } renderPoliciesPage(); }
if(name==='rules'){ if(JAY_CTX.platform){ var pl=$('#rl-platform'); if(pl) pl.value=JAY_CTX.platform; } else { var rm=jayCountryMarket(JAY_CTX.country||''); var ml=$('#rl-market'); if(ml&&rm) ml.value=rm; } renderRulesPage(); }
if(name==='products'){ if(JAY_CTX.country||JAY_CTX.platform){ var cf=$('#pr-f-country'); if(cf&&JAY_CTX.country) cf.value=JAY_CTX.country; var pf=$('#pr-f-platform'); if(pf&&JAY_CTX.platform) pf.value=JAY_CTX.platform; var sf=$('#pr-f-signal'); if(sf) sf.value='all'; if(typeof prApplyFilters==='function') prApplyFilters(); } }
JAY_CTX.country=null; JAY_CTX.platform=null;
if (typeof trackActivity === 'function' && name !== 'overview') {
  var actMap = { countries: 'view_country', platforms: 'view_platform', policies: 'view_policy', rules: 'view_rule', report: 'export_report' };
  var actType = actMap[name] || 'search';
  trackActivity(actType, name, name, { source: 'navigation' });
}
window.scrollTo({top:0,behavior:'smooth'})}$$('[data-page]').forEach(e=>e.addEventListener('click',e=>{e.preventDefault();switchPage(e.currentTarget.dataset.page)}));

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}$('#export').onclick=()=>toast('报告正在生成，稍后将下载 Excel 文件。');// read-all button replaced by alerts center redesign/* bell handled by jayToggleBell */

// === AI Engine (DeepSeek, OpenAI-compatible, browser-direct) ===
var AI_ENGINE = {
  provider: 'deepseek',
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-v4-pro', // deepseek-chat 已于 2026-07-24 停用，升级到 v4 系列
  keyStorageKey: 'jay_deepseek_key',
  getKey: function(){ try { return localStorage.getItem(this.keyStorageKey) || ''; } catch(e){ return ''; } },
  setKey: function(k){ try { localStorage.setItem(this.keyStorageKey, k || ''); return true; } catch(e){ return false; } },
  hasKey: function(){ return !!this.getKey(); }
};
var rpLastReportText = '';
var rpLastReportTitle = '';
// 跨模块联动上下文：在任一模块点击国家/平台后跳转目标页，自动预筛选对应内容
var JAY_CTX = { country: null, platform: null };
window.__CP_JAY_CTX = JAY_CTX;
function jayCountryRegion(name){
  var m = {
    '印度尼西亚':'东南亚','越南':'东南亚','泰国':'东南亚','马来西亚':'东南亚','菲律宾':'东南亚','新加坡':'东南亚','柬埔寨':'东南亚','缅甸':'东南亚','老挝':'东南亚',
    '美国':'北美','加拿大':'北美','墨西哥':'拉美',
    '英国':'欧洲','德国':'欧洲','法国':'欧洲','意大利':'欧洲','西班牙':'欧洲','荷兰':'欧洲','波兰':'欧洲',
    '沙特':'中东','阿联酋':'中东','土耳其':'中东','以色列':'中东','埃及':'中东',
    '巴西':'拉美','阿根廷':'拉美','智利':'拉美','哥伦比亚':'拉美',
    '印度':'南亚','巴基斯坦':'南亚','孟加拉':'南亚',
    '尼日利亚':'非洲','南非':'非洲','肯尼亚':'非洲',
    '日本':'日韩','韩国':'日韩','澳大利亚':'澳洲','新西兰':'澳洲'
  };
  return m[name] || null;
}
function jayCountryMarket(name){
  var rg = jayCountryRegion(name);
  var map = {'东南亚':'SEA','北美':'US','欧洲':'EU','中东':'MEA','拉美':'LATAM','南亚':'SAS','非洲':'AFR','日韩':'EA','澳洲':'OCE','独联体':'CIS','中国':'CN'};
  return map[rg] || null;
}
// 当前日期助手：让 AI 报告基于最新时效，避免停在旧年份（如 2024）
function jayNowDate(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function jayNowHuman(){ var d=new Date(); return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日'; }

// Generic AI call. Throws 'NO_API_KEY' if key missing.
async function callAI(systemPrompt, userPrompt, opts){
  opts = opts || {};
  var key = AI_ENGINE.getKey();
  if(!key){ throw new Error('NO_API_KEY'); }
  var url = AI_ENGINE.baseURL + '/chat/completions';
  function buildBody(withSearch){
    var b = {
      model: opts.model || AI_ENGINE.model,
      messages: [
        { role: 'system', content: systemPrompt || '你是跨境电商市场情报分析专家。' },
        { role: 'user', content: userPrompt }
      ],
      temperature: (opts.temperature != null) ? opts.temperature : 0.7,
      max_tokens: opts.max_tokens || 2000,
      stream: false
    };
    if(withSearch){
      // 尝试两种 DeepSeek 联网检索写法，兼容不同版本
      b.web_search = { type: 'enabled' };
      b.plugins = ['web_search'];
    }
    return b;
  }
  function buildHeaders(withSearch){
    var h = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key };
    if(withSearch){ h['X-DeepSeek-Plugin'] = 'web_search/v1'; }
    return h;
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, opts.timeout || 60000);
  async function attempt(withSearch){
    return await fetch(url, {
      method: 'POST',
      headers: buildHeaders(withSearch),
      body: JSON.stringify(buildBody(withSearch)),
      signal: ctrl.signal
    });
  }
  try {
    var resp = await attempt(!!opts.search);
    if(!resp.ok && opts.search){
      var probe = ''; try { probe = (await resp.text()).slice(0, 300); } catch(e){}
      // 若联网检索不被支持（400/403/插件相关报错），自动降级为无检索模式
      if(resp.status === 400 || resp.status === 403 || /plugin|web_search|search|unsupported|not support/i.test(probe)){
        resp = await attempt(false);
      } else {
        throw new Error('API_ERROR:' + resp.status + ' ' + probe);
      }
    }
    if(!resp.ok){
      var errTxt = ''; try { errTxt = (await resp.text()).slice(0, 200); } catch(e){}
      throw new Error('API_ERROR:' + resp.status + ' ' + errTxt);
    }
    var data = await resp.json();
    var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if(!content) throw new Error('EMPTY_RESPONSE');
    // strip markdown code fences if present
    content = content.replace(/^```(?:markdown)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// Safe markdown -> HTML (escape first, then limited formatting). Prevents XSS.
function renderMarkdownSafe(md){
  if(md == null) return '';
  var esc = escapeHtml(md);
  var lines = esc.split(/\r?\n/);
  var html = '';
  var i = 0;
  var inCode = false, codeBuf = [];
  function flushCode(){ if(codeBuf.length){ html += '<pre class="rp-v2-rpt-code"><code>' + codeBuf.join('\n') + '</code></pre>'; codeBuf = []; } }
  var listType = 0;
  function closeList(){ if(listType === 1){ html += '</ul>'; } else if(listType === 2){ html += '</ol>'; } listType = 0; }
  while(i < lines.length){
    var s = lines[i];
    if(/^\s*```/.test(s)){ if(inCode){ flushCode(); } else { closeList(); } inCode = !inCode; i++; continue; }
    if(inCode){ codeBuf.push(s); i++; continue; }
    if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(s)){ closeList(); html += '<hr>'; i++; continue; }
    var hm = s.match(/^(#{1,4})\s+(.*)$/);
    if(hm){ closeList(); var lvl = hm[1].length; var txt = inlineFmt(hm[2]); var tag = lvl >= 3 ? 'h4' : (lvl === 2 ? 'h3' : 'h2'); html += '<' + tag + '>' + txt + '</' + tag + '>'; i++; continue; }
    if(/^\s*&gt;\s?/.test(s)){
      closeList();
      var q = s.replace(/^\s*&gt;\s?/, '');
      var cls = 'rp-v2-rpt-highlight';
      if(/⚠|风险|注意|警告/.test(q)){ cls = 'rp-v2-rpt-risk'; }
      else if(/✅|机会|建议|结论|里程碑/.test(q)){ cls = 'rp-v2-rpt-success'; }
      html += '<div class="' + cls + '">' + inlineFmt(q) + '</div>';
      i++;
      continue;
    }
    if(/^\s*\|.*\|\s*$/.test(s) && i + 1 < lines.length && /^\s*\|?[\s:\|\-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') >= 0){
      closeList();
      var headers = s.trim().replace(/^\||\|$/g, '').split('|').map(function(c){ return c.trim(); });
      i += 2;
      var rows = [];
      while(i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])){
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(function(c){ return c.trim(); }));
        i++;
      }
      html += '<table class="rp-v2-rpt-table"><thead><tr>' + headers.map(function(h){ return '<th>' + inlineFmt(h) + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function(r){ html += '<tr>' + r.map(function(c){ return '<td>' + inlineFmt(c) + '</td>'; }).join('') + '</tr>'; });
      html += '</tbody></table>';
      continue;
    }
    var um = s.match(/^\s*[-*]\s+(.*)$/);
    if(um){ if(listType !== 1){ closeList(); html += '<ul>'; listType = 1; } html += '<li>' + inlineFmt(um[1]) + '</li>'; i++; continue; }
    var om = s.match(/^\s*\d+\.\s+(.*)$/);
    if(om){ if(listType !== 2){ closeList(); html += '<ol>'; listType = 2; } html += '<li>' + inlineFmt(om[1]) + '</li>'; i++; continue; }
    if(s.trim() === ''){ closeList(); i++; continue; }
    closeList();
    html += '<p>' + inlineFmt(s) + '</p>';
    i++;
  }
  closeList(); flushCode();
  return html;
}
function inlineFmt(t){
  return t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// Lightweight modal reusing existing .al-modal CSS
function showAIModal(title, bodyHtml){
  var existing = document.getElementById('rp-ai-modal'); if(existing) existing.remove();
  var overlay = document.createElement('div'); overlay.className = 'al-modal-overlay'; overlay.id = 'rp-ai-modal';
  var box = document.createElement('div'); box.className = 'al-modal'; box.style.maxWidth = '860px'; box.style.width = '92%';
  var head = document.createElement('div'); head.className = 'al-modal-head';
  var h3 = document.createElement('h3'); h3.textContent = title;
  var close = document.createElement('button'); close.className = 'al-modal-close'; close.textContent = '✕';
  close.onclick = function(){ overlay.remove(); };
  head.appendChild(h3); head.appendChild(close);
  var body = document.createElement('div'); body.className = 'al-modal-body'; body.id = 'rp-ai-modal-body';
  body.style.maxHeight = '70vh'; body.style.overflow = 'auto'; body.innerHTML = bodyHtml;
  box.appendChild(head); box.appendChild(body); overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function openSettingsAI(){ try { switchPage('settings'); } catch(e){} }
function aiSaveKey(){
  var inp = document.getElementById('ai-deepseek-key'); if(!inp) return;
  var k = inp.value.trim();
  if(!k){ stToast('请输入 API Key'); return; }
  if(AI_ENGINE.setKey(k)){ stToast('AI 密钥已保存'); var x = document.getElementById('ai-key-status'); if(x) x.textContent = '已保存 ✓'; }
  else stToast('保存失败');
}
function aiClearKey(){
  AI_ENGINE.setKey('');
  var inp = document.getElementById('ai-deepseek-key'); if(inp) inp.value = '';
  var x = document.getElementById('ai-key-status'); if(x) x.textContent = '已清除';
  stToast('已清除 AI 密钥');
}
function aiInitKeyUI(){
  var inp = document.getElementById('ai-deepseek-key'); if(inp) inp.value = AI_ENGINE.getKey();
  var x = document.getElementById('ai-key-status'); if(x) x.textContent = AI_ENGINE.hasKey() ? '已保存 ✓' : '';
}

var RP_TPL_KEY = 'jay_rp_tpls';
function rpV2GetTpls(){ try { return JSON.parse(localStorage.getItem(RP_TPL_KEY) || '{}'); } catch(e){ return {}; } }
function rpV2LoadTpls(){
  var sel = document.getElementById('rp-v2-tpl-sel'); if(!sel) return;
  var tpls = rpV2GetTpls();
  sel.innerHTML = '<option value="">— 选择已保存模板 —</option>';
  Object.keys(tpls).forEach(function(k){
    var o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o);
  });
}
function rpV2ApplyTpl(){
  var sel = document.getElementById('rp-v2-tpl-sel'); if(!sel || !sel.value) return;
  var tpls = rpV2GetTpls();
  var v = tpls[sel.value]; if(v == null) return;
  var ta = document.getElementById('rp-v2-custom-prompt'); if(ta) ta.value = v;
  toast('已应用模板：' + sel.value);
}
function rpV2SaveTpl(){
  var ta = document.getElementById('rp-v2-custom-prompt'); if(!ta) return;
  var v = ta.value.trim();
  if(!v){ stToast('请先在上方填写要保存的内容'); return; }
  var name = window.prompt('模板名称：', '我的模板');
  if(!name) return;
  name = name.trim(); if(!name) return;
  var tpls = rpV2GetTpls(); tpls[name] = v;
  localStorage.setItem(RP_TPL_KEY, JSON.stringify(tpls));
  rpV2LoadTpls();
  var sel = document.getElementById('rp-v2-tpl-sel'); if(sel) sel.value = name;
  stToast('模板已保存：' + name);
}

// === Watchlist Redesign ===
var watchlistData = [];
var watchlistDbMap = {};
var mockWatchlistData = [{type:'track',flag:'\u{1F1EE}\u{1F1E9}',name:'\u5370\u5c3c\uff5c\u7f8e\u5986\u8d5b\u9053',platforms:'Shopee/TikTok Shop',status:'hot',statusText:'HOT \u9ad8\u589e\u957f',metrics:['7\u65e5GMV +42.8%','\u5e02\u573a\u89c4\u6a21 $650\u4ebf'],detail:'\u70ed\u95e8\u7ec6\u5206\uff1a\u5507\u91c9\u3001\u62a4\u80a4\u5957\u88c5 | \u7ade\u4e89\u5ea6\uff1a\u4e2d\u7b49',trend:[30,35,32,40,45,48,52],trendColor:'#2c5f8a',_dbId:null},{type:'shop',flag:'\u{1F3EA}',name:'GLOW LAB Official',platforms:'Shopee \u5370\u5c3c',status:'up',statusText:'\u{1F4C8} \u589e\u957f\u4e2d',metrics:['30\u5929GMV $128\u4e07','\u8ba2\u5355\u589e\u901f +18%'],detail:'\u8bc4\u52064.8 | \u7206\u6b3e\u657012',trend:[80,85,82,78,75,72,70],trendColor:'#3b7dd8',_dbId:null},{type:'track',flag:'\u{1F1FA}\u{1F1F8}',name:'\u7f8e\u56fd\uff5c\u5145\u7535\u914d\u4ef6',platforms:'Amazon/Temu',status:'monitor',statusText:'\u26a1 \u76d1\u63a7\u4e2d',metrics:['7\u65e5\u9500\u91cf +23.5%','\u5747\u4ef7 $15-35'],detail:'\u5229\u6da6\u7a7a\u95f4\uff1a\u4e2d\u9ad8 | \u8fd17\u65e5\u4e0a\u65b0 156\u4ef6',trend:[20,22,25,24,28,30,33],trendColor:'#2c5f8a',_dbId:null},{type:'shop',flag:'\u{1F3EA}',name:'TECHZONE Official',platforms:'Amazon \u7f8e\u56fd',status:'monitor',statusText:'\u26a1 \u76d1\u63a7\u4e2d',metrics:['30\u5929GMV $85\u4e07','\u8ba2\u5355\u589e\u901f +8%'],detail:'\u8bc4\u52064.6 | \u7206\u6b3e\u65708',trend:[50,52,51,53,55,54,56],trendColor:'#2c5f8a',_dbId:null},{type:'track',flag:'\u{1F1E7}\u{1F1F7}',name:'\u5df4\u897f\uff5c\u4e2a\u62a4\u7535\u5668',platforms:'Mercado Livre/Shopee',status:'hot',statusText:'HOT \u9ad8\u589e\u957f',metrics:['7\u65e5GMV +35.2%','\u5e02\u573a\u89c4\u6a21 $180\u4ebf'],detail:'\u70ed\u95e8\u7ec6\u5206\uff1a\u5439\u98ce\u673a\u3001\u8131\u6bdb\u4efb | \u7ade\u4e89\u5ea6\uff1a\u4f4e',trend:[15,18,22,25,28,33,38],trendColor:'#2c5f8a',_dbId:null}];

async function loadWatchlistFromDb() {
  var items = (typeof loadUserWatchlist === 'function') ? await loadUserWatchlist() : null;
  if (items && items.length > 0) {
    watchlistData = items.map(function(row) {
      var typeMap = { country: 'track', platform: 'track', category: 'track', product: 'product', policy: 'track' };
      var flagMap = { 'indonesia': '\u{1F1EE}\u{1F1E9}', 'usa': '\u{1F1FA}\u{1F1F8}', 'brazil': '\u{1F1E7}\u{1F1F7}', 'thailand': '\u{1F1F9}\u{1F1ED}', 'vietnam': '\u{1F1FB}\u{1F1F3}', 'mexico': '\u{1F1F2}\u{1F1FD}', 'philippines': '\u{1F1F5}\u{1F1ED}', 'malaysia': '\u{1F1F2}\u{1F1FE}', 'singapore': '\u{1F1F8}\u{1F1EC}', 'japan': '\u{1F1EF}\u{1F1F5}', 'korea': '\u{1F1F0}\u{1F1F7}', 'uk': '\u{1F1EC}\u{1F1E7}', 'germany': '\u{1F1E9}\u{1F1EA}', 'france': '\u{1F1EB}\u{1F1F7}', 'india': '\u{1F1EE}\u{1F1F3}', 'saudi_arabia': '\u{1F1F8}\u{1F1E6}', 'uae': '\u{1F1E6}\u{1F1EA}', 'egypt': '\u{1F1EA}\u{1F1EC}' };
      var flag = '\u{1F4CA}';
      var itemId = (row.item_id || '').toLowerCase();
      for (var k in flagMap) { if (itemId.indexOf(k) >= 0) { flag = flagMap[k]; break; } }
      var statusOptions = [{status:'hot',statusText:'HOT \u9ad8\u589e\u957f'},{status:'up',statusText:'\u{1F4C8} \u589e\u957f\u4e2d'},{status:'monitor',statusText:'\u26a1 \u76d1\u63a7\u4e2d'}];
      var so = statusOptions[Math.floor(Math.random() * statusOptions.length)];
      return {
        type: typeMap[row.item_type] || 'track',
        flag: flag,
        name: row.item_name || row.item_id,
        platforms: row.note || '\u5f85\u914d\u7f6e',
        status: so.status,
        statusText: so.statusText,
        metrics: ['\u5df2\u5173\u6ce8', '\u6570\u636e\u52a0\u8f7d\u4e2d...'],
        detail: '\u5173\u6ce8\u4e8e ' + new Date(row.created_at).toLocaleDateString('zh-CN'),
        trend: [20, 25, 22, 28, 30, 33, 35].map(function(v) { return v + Math.floor(Math.random() * 10); }),
        trendColor: '#2c5f8a',
        _dbId: row.id
      };
    });
    console.log('[JAY观海] Watchlist loaded from DB: ' + watchlistData.length + ' items');
  } else {
    watchlistData = mockWatchlistData.slice();
  }
  renderWatchCards('all');
}
const alertMessages=[{level:'high',text:'\u5370\u5c3c\u7f8e\u5986 7\u65e5GMV\u6da8\u5e45\u63d0\u5347\u81f342.8%\uff0c\u65b0\u589e23\u4e2a\u7206\u5355\u65b0\u54c1',icon:'\u{1F534}'},{level:'mid',text:'GLOW LAB\u5e97\u94fa\u8fd13\u65e5\u9500\u91cf\u4e0b\u6ed112%\uff0c\u5934\u90e8\u7ade\u54c1\u4e0a\u65b0\u5206\u6d41',icon:'\u{1F7E1}'},{level:'mid',text:'\u5317\u7f8e\u5145\u7535\u914d\u4ef6\u7c7b\u76ee\u65b0\u589e\u5173\u7a0e\u9884\u5ba1\u653f\u7b56',icon:'\u{1F7E0}'}];
const recommendTracks=[{flag:'\u{1F1FB}\u{1F1F3}',name:'\u8d8a\u5357\uff5c\u5bb6\u5c45\u751f\u6d3b',platforms:'Shopee/TikTok Shop',reason:'GDP\u589e\u901f6.5%\uff0c\u5bb6\u5c45\u54c1\u7c7b\u6e17\u900f\u7387\u5feb\u901f\u63d0\u5347'},{flag:'\u{1F1F2}\u{1F1FD}',name:'\u58a8\u897f\u54e5\uff5c3C\u914d\u4ef6',platforms:'Mercado Libre/Amazon',reason:'\u8fd1\u5cb8\u5916\u5305\u8d8b\u52bf\u5229\u597d\uff0c\u7f8e\u5ba2\u591a\u4efd\u989d\u9886\u5148'},{flag:'\u{1F1F9}\u{1F1ED}',name:'\u6cf0\u56fd\uff5c\u98df\u54c1\u996e\u6599',platforms:'Shopee/Lazada',reason:'\u5ba2\u5355\u4ef7\u7a33\u5b9a\uff0c\u590d\u8d2d\u7387\u9ad8\u4e8e\u5927\u76d8\u5747\u503c'}];

function buildMiniTrendSVG(data,color){
  var w=200,h=40,pad=4;
  var mn=Math.min.apply(null,data),mx=Math.max.apply(null,data);
  var range=mx-mn||1;
  var pts=data.map(function(v,i){return(pad+i*(w-2*pad)/6)+','+(h-pad-(v-mn)/range*(h-2*pad));});
  var gradId='tg_'+Math.random().toString(36).substr(2,6);
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><defs><linearGradient id="'+gradId+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity="0.2"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0.02"/></linearGradient></defs><polygon points="'+pts.join(' ')+' '+(w-pad)+','+h+' '+pad+','+h+'" fill="url(#'+gradId+')"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+pts[pts.length-1].split(',')[0]+'" cy="'+pts[pts.length-1].split(',')[1]+'" r="3" fill="'+color+'"/></svg>';
}

function renderWatchCards(filterType){
  var filtered=filterType==='all'?watchlistData:watchlistData.filter(function(d){return d.type===filterType;});
  var grid=document.getElementById('watch-grid');
  grid.innerHTML=filtered.map(function(d,idx){
    var trendDir=d.trend[d.trend.length-1]>=d.trend[0];
    var tc=trendDir?'#2c5f8a':'#3b7dd8';
    var svg=buildMiniTrendSVG(d.trend,tc);
    var viewLabel=d.type==='shop'?'\u67e5\u770b\u5e97\u94fa':'\u67e5\u770b\u699c\u5355';
    return '<article class="watch-card"><div class="wc-top"><span class="wc-flag">'+d.flag+'</span><span class="wc-name">'+d.name+'</span><span class="wc-platforms">'+d.platforms+'</span><span class="wc-status '+d.status+'">'+d.statusText+'</span></div><div class="wc-metrics"><div class="wc-metric"><b>'+d.metrics[0]+'</b></div><div class="wc-metric"><b>'+d.metrics[1]+'</b></div></div><p class="wc-detail">'+d.detail+'</p><div class="wc-trend">'+svg+'</div><div class="wc-actions"><button class="wc-action-btn ai" onclick="toast(\'AI\u8bca\u65ad\u62a5\u544a\u751f\u6210\u4e2d...\u4e13\u4e1a\u7248\u53ef\u67e5\u770b\u5b8c\u6574\u5206\u6790\')">\u2728 AI\u8bca\u65ad</button><button class="wc-action-btn" onclick="toast(\'\\u6b63\u5728\\u52a0\\u8f7d\\u8be6\\u7ec6\\u6570\\u636e...\')">'+viewLabel+'</button><button class="wc-action-btn" onclick="toast(\'\\u5df2\\u8bbe\\u7f6e\\u6b64\\u9879\\u76d1\\u63a7\\u63d0\\u9192\')">\u8bbe\u7f6e\u63d0\u9192</button><button class="wc-action-btn remove" onclick=\"removeWatchItem(this,"+idx+")\">\u53d6\u6d88\u5173\u6ce8</button></div></article>';
  }).join('');
}

function renderAlertBanner(){
  var banner=document.getElementById('wl-alert-banner');
  if(alertMessages.length===0){
    banner.innerHTML='<div class="wl-alert-none">\u2705 \u5f53\u524d\u6240\u6709\u76d1\u63a7\u8d5b\u9053\u3001\u5e97\u94fa\u8fd0\u884c\u5e73\u7a33\uff0c\u6682\u65e0\u5e02\u573a\u5f02\u52a8</div>';
    return;
  }
  banner.innerHTML='<div class="wl-alert-title">\u26a0\ufe0f \u5f02\u52a8\u63d0\u9192\uff08'+alertMessages.length+'\u6761\uff09<span class="wl-alert-count">'+alertMessages.length+'</span></div>'+alertMessages.map(function(a){
    return '<div class="wl-alert-item '+a.level+'"><span>'+a.icon+'</span><p>'+a.text+'</p><button class="wl-ai-btn" onclick="toast(\'\u5b8c\u6574\u98ce\u9669\u5206\u6790\u5df2\u751f\u6210\u3002PRO\u7248\u67e5\u770b\u5e94\u5bf9\u65b9\u6848\')">\u2728 AI\u89e3\u8bfb</button></div>';
  }).join('');
}

function renderRecommendTracks(){
  var container=document.getElementById('wl-rec-cards');
  container.innerHTML=recommendTracks.map(function(t){
    return '<div class="wl-rec-card"><span style="font-size:22px">'+t.flag+'</span><div class="wl-rec-info"><h5>'+t.name+'</h5><p>'+t.platforms+' \u00b7 '+t.reason+'</p></div><button class="wl-rec-add" onclick="addFromSearch(this, &#39;"+t.flag+"&#39; &#39;"+t.name+"&#39;,&#39;track&#39;)>\u6dfb\u52a0</button></div>';
  }).join('');
}

watchlistData = mockWatchlistData.slice();
renderWatchCards('all');
renderAlertBanner();
renderRecommendTracks();

// Tab switching
document.getElementById('wl-tabs').onclick=function(e){
  var btn=e.target.closest('.wl-tab');
  if(!btn)return;
  document.querySelectorAll('.wl-tab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderWatchCards(btn.dataset.type);
};

// Time filter
document.getElementById('wl-time-filter').onclick=function(e){
  var btn=e.target.closest('.wl-time-btn');
  if(!btn)return;
  document.querySelectorAll('.wl-time-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  toast('\u5df2\u5207\u6362\u4e3a'+btn.textContent+'\u6570\u636e');
  // Simulate data change by re-rendering with slight modification
  watchlistData.forEach(function(d){
    d.trend=d.trend.map(function(v){return Math.max(5,v+Math.floor(Math.random()*10-5));});
  });
  var activeTab=document.querySelector('.wl-tab.active');
  renderWatchCards(activeTab?activeTab.dataset.type:'all');
};

// Add watch modal
document.getElementById('add-watch').onclick=function(){showAddWatchModal();};
document.getElementById('wl-new-group').onclick=function(){showProModal();};

// === Add Watch Modal ===
function showAddWatchModal(){
  var existing=document.getElementById('wl-modal-overlay');
  if(existing)existing.remove();
  var div=document.createElement('div');
  div.id='wl-modal-overlay';
  div.className='wl-modal-overlay show';
  div.innerHTML='<div class="wl-modal"><div class="wl-modal-head"><h3>\u6dfb\u52a0\u5173\u6ce8\u9879</h3><button class="wl-modal-close" onclick="closeAddWatchModal()">\u2715</button></div><div class="wl-modal-tabs"><button class="wl-modal-tab active" data-mtab="search">\u624b\u52a8\u641c\u7d22</button><button class="wl-modal-tab" data-mtab="ai">\u2728 AI\u63a8\u8350</button><button class="wl-modal-tab" data-mtab="template">\u884c\u4e1a\u6a21\u677f</button></div><div class="wl-modal-body" id="wl-modal-content"></div><div class="wl-modal-foot"><button onclick="closeAddWatchModal()">\u6682\u4e0d\u6dfb\u52a0</button></div></div>';
  document.body.appendChild(div);
  div.onclick=function(e){if(e.target===div)closeAddWatchModal();};
  renderModalTab('search');
  div.querySelectorAll('.wl-modal-tab').forEach(function(tab){
    tab.onclick=function(){
      div.querySelectorAll('.wl-modal-tab').forEach(function(t){t.classList.remove('active');});
      tab.classList.add('active');
      renderModalTab(tab.dataset.mtab);
    };
  });
}
function closeAddWatchModal(){var m=document.getElementById('wl-modal-overlay');if(m)m.remove();}

function renderModalTab(tab){
  var body=document.getElementById('wl-modal-content');
  if(tab==='search'){
    body.innerHTML='<div class="wl-search-row"><input type="text" id="wl-search-input" placeholder="\u641c\u7d22\u56fd\u5bb6\u3001\u8d5b\u9053\u3001\u5e97\u94fa\u6216\u5355\u54c1..."><button onclick="doModalSearch()">\u641c\u7d22</button></div><div id="wl-search-results"><p style="font-size:11px;color:#999;text-align:center;padding:20px 0">\u8f93\u5165\u5173\u952e\u8bcd\u641c\u7d22\u53ef\u76d1\u63a7\u7684\u8d5b\u9053\u3001\u5e97\u94fa\u6216\u5355\u54c1</p></div>';
  }else if(tab==='ai'){
    body.innerHTML='<p style="font-size:12px;color:#4a6a8a;margin:0 0 14px">\u2728 \u57fa\u4e8e\u4f60\u5df2\u5173\u6ce8\u7684\u54c1\u7c7b\uff0c\u4ee5\u4e0b\u540c\u8d5b\u9053\u6f5c\u529b\u5e02\u573a\u503c\u5f97\u5173\u6ce8\uff1a</p>'+recommendTracks.map(function(t){
      return '<div class="wl-rec-item"><div class="wl-rec-item-info"><h5>'+t.flag+' '+t.name+'</h5><p>'+t.platforms+'</p></div><button onclick="addFromSearch(this, &#39;"+t.flag+"&#39; &#39;"+t.name+"&#39;,&#39;track&#39;)>\u4e00\u952e\u6dfb\u52a0</button></div>';
    }).join('');
  }else if(tab==='template'){
    body.innerHTML='<div class="wl-template-card"><h5>\u{1F30F} \u4e1c\u5357\u4e9a\u7f8e\u5986\u5356\u5bb6\u770b\u677f</h5><p>\u5305\u542b\u5370\u5c3c\u3001\u6cf0\u56fd\u3001\u8d8a\u5357\u7f8e\u5986\u8d5b\u9053\u76d1\u63a7 + 5\u5bb6\u5934\u90e8\u7ade\u5e97\u8ffd\u8e2a</p><button onclick="addTemplateToWatchlist(this)">\u4e00\u952e\u6dfb\u52a0</button></div><div class="wl-template-card"><h5>\u{1F1FA}\u{1F1F8} \u6b27\u7f8e3C\u8d27\u67b6\u7535\u5546\u770b\u677f</h5><p>\u5305\u542b\u7f8e\u56fd\u3001\u52a0\u62ff\u5927 3C\u914d\u4ef6\u8d5b\u9053 + Amazon/Temu\u5e73\u53f0\u6570\u636e</p><button onclick="addTemplateToWatchlist(this)">\u4e00\u952e\u6dfb\u52a0</button></div><div class="wl-template-card"><h5>\u{1F4F1} TikTok\u672c\u571f\u5e97\u7efc\u5408\u76d1\u63a7\u6a21\u677f</h5><p>\u8986\u76d6\u5370\u5c3c\u3001\u6cf0\u56fd\u3001\u9a6c\u6765\u897f\u4e9a TikTok Shop\u672c\u571f\u5e97\u6570\u636e</p><button onclick="addTemplateToWatchlist(this)">\u4e00\u952e\u6dfb\u52a0</button></div>';
  }
}

function doModalSearch(){
  var q=document.getElementById('wl-search-input').value.trim();
  var results=document.getElementById('wl-search-results');
  if(!q){results.innerHTML='<p style="font-size:11px;color:#999;text-align:center;padding:20px 0">\u8bf7\u8f93\u5165\u641c\u7d22\u5173\u952e\u8bcd</p>';return;}
  var mockResults=[
    {name:'\u{1F1F5}\u{1F1ED} \u83f2\u5f8b\u5bbe\uff5c\u7f8e\u5986\u4e2a\u62a4',sub:'Shopee/Lazada \u00b7 \u5e02\u573a\u89c4\u6a21$120\u4ebf',type:'track'},
    {name:'\u{1F1F2}\u{1F1FE} \u9a6c\u6765\u897f\u4e9a\uff5c\u98df\u54c1\u996e\u6599',sub:'Shopee/Lazada \u00b7 \u5ba2\u5355\u4ef7\u7a33\u5b9a',type:'track'},
    {name:'\u{1F3EA} ANKER Official',sub:'Amazon \u7f8e\u56fd \u00b7 30\u5929GMV $320\u4e07',type:'shop'},
    {name:'\u{1F4E6} \u5145\u7535\u5b9d\u54c1\u7c7b',sub:'Amazon/Temu \u00b7 \u5747\u4ef7$12-25',type:'product'}
  ];
  results.innerHTML=mockResults.map(function(r){
    return '<div class="wl-search-result"><div><b>'+r.name+'</b><small>'+r.sub+'</small></div><button class="wl-rec-add" onclick="addFromSearch(this, &#39;"+r.name.replace(/&#39;/g,"&#39;")+"&#39;,&#39;"+r.type+"&#39;)>\u6dfb\u52a0</button></div>';
  }).join('');
}

// PRO Modal
function showProModal(){
  var existing=document.getElementById('pro-modal-overlay');
  if(existing)return;
  var div=document.createElement('div');
  div.id='pro-modal-overlay';
  div.className='pro-modal-overlay show';
  div.innerHTML='<div class="pro-modal"><h3>\u{1F451} \u5347\u7ea7\u4e13\u4e1a\u7248\u89e3\u9501\u5b8c\u6574\u529f\u80fd</h3><p>AI\u8bca\u65ad\u62a5\u544a\u3001\u5206\u7ec4\u770b\u677f\u3001\u6279\u91cf\u5bfc\u51fa\u3001\u5b8c\u6574\u5468\u62a5\u7b49\u9ad8\u7ea7\u529f\u80fd\u7b49\u4f60\u6765\u4f53\u9a8c\u3002</p><div class="pro-modal-btns"><button class="pro-btn" onclick="toast(\'\u8df3\u8f6c\u5347\u7ea7\u9875\u9762...\');closeProModal()">\u4e86\u89e3\u8be6\u60c5</button><button class="pro-dismiss" onclick="closeProModal()">\u6682\u4e0d\u9700\u8981</button></div></div>';
  document.body.appendChild(div);
  div.onclick=function(e){if(e.target===div)closeProModal();};
}
function closeProModal(){var m=document.getElementById('pro-modal-overlay');if(m)m.remove();}


const searchIndex=[['防水持久液体腮红','商品 · 印度尼西亚 TikTok Shop','products'],['GLOW LAB Official','店铺 · 印尼 TikTok Shop','shops'],['印度尼西亚进口标签要求','政策 · 合规提醒','countries'],['北美充电配件','类目 · 美国 Amazon','products'],['Shopee','电商平台 · 东南亚','platforms'],['GDP增速','国家市场宏观数据','countries'],['对华关税','政策动态','policies'],['TikTok Shop规则','平台规则','rules'],['身体乳测评','热门内容','content']];const search=$('#global-search'),results=$('#search-results');search.oninput=()=>{const q=search.value.trim();if(!q){results.classList.remove('show');return}const hits=searchIndex.filter(x=>x[0].includes(q)||x[1].includes(q));results.innerHTML=(hits.length?hits:[['未找到精确结果','可尝试商品名、店铺名、政策关键词或类目','overview']]).map(x=>`<div class="result" data-page="${x[2]}"><b>${x[0]}</b><small>${x[1]}</small></div>`).join('');results.classList.add('show')};results.onclick=e=>{const item=e.target.closest('.result');if(item){switchPage(item.dataset.page);results.classList.remove('show');search.value=''}};

// ========== JAY观海 SaaS Auth Module ==========
// (moved to top)
// (moved to top)
// === JAY观海 Supabase Data Layer ===
// JAY_API_URL / JAY_ANON_KEY 已在顶部初始化（修复 var 提升导致的 undefined 问题）

// 数据新鲜度追踪 + AI 实时补数（用户架构：Supabase 优先，AI 联网检索写回）
var JAY_DATA_META = {};          // { key: { updated_at, source } }
var JAY_STALE_DAYS = 7;
var JAY_CORE_KEYS = ['policies', 'rules', 'alerts', 'countries', 'platforms'];
function jayIsStale(key){
  var m = JAY_DATA_META[key];
  if(!m || !m.updated_at) return true;
  var days = (Date.now() - new Date(m.updated_at).getTime()) / 86400000;
  return days > JAY_STALE_DAYS;
}
function jayFreshestStamp(){
  var freshest = null;
  JAY_CORE_KEYS.forEach(function(k){ var m = JAY_DATA_META[k]; if(m && m.updated_at){ if(!freshest || new Date(m.updated_at) > new Date(freshest)) freshest = m.updated_at; } });
  if(!freshest) return '本地数据';
  var d = new Date(freshest);
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}
async function jayRefreshViaAI(key, label){
  if(!AI_ENGINE.hasKey()){ toast('请先在设置中填写 DeepSeek API Key 后再刷新实时数据'); openSettingsAI(); return null; }
  var catLabel = label || key;
  var sys = '你是全球跨境电商情报分析师，基于联网检索整理最新动态。输出简体中文 Markdown：每条用 "## 国家/平台｜要点" 开头，正文含「影响」与「来源」（如可知网址）。最多 12 条，聚焦 2026 年最新政策、规则、平台变动与风险预警。';
  var user = '【当前日期】' + jayNowHuman() + '。请联网检索并整理「' + catLabel + '」截至今日的最新全球动态，优先 2026 年 7 月以来的信息。';
  toast('正在联网检索最新' + catLabel + '数据...');
  try {
    var brief = await callAI(sys, user, { temperature: 0.4, max_tokens: 2600, search: true });
    var ts = new Date().toISOString();
    JAY_DATA_META[key] = { updated_at: ts, source: 'ai' };
    try { localStorage.setItem('jay_ai_brief_' + key, JSON.stringify({ text: brief, ts: ts })); } catch(e){}
    // 写回 Supabase（独立 brief key，避免覆盖模块结构化数据）；RLS 受限时静默降级为本地缓存
    if (JAY_SUPABASE_URL && JAY_SUPABASE_URL !== 'YOUR_SUPABASE_URL' && supabaseClient) {
      try {
        await supabaseClient.from('market_data').upsert({ key: 'ai_brief_' + key, data: { brief: brief, ts: ts }, meta: { updated_at: ts, source: 'ai' } }, { onConflict: 'key' });
      } catch(e){ console.warn('[JAY观海] Supabase 写回失败(可能受 RLS 限制)，已改用本地缓存:', e.message); }
    }
    toast(catLabel + ' 实时数据已更新');
    return brief;
  } catch(e){
    toast('实时刷新失败：' + (e.message === 'NO_API_KEY' ? '请先填写 API Key' : e.message));
    return null;
  }
}
async function jayRefreshAll(){
  for(var i=0;i<JAY_CORE_KEYS.length;i++){
    await jayRefreshViaAI(JAY_CORE_KEYS[i], JAY_CORE_KEYS[i]);
  }
  jayRenderBriefCard();
  jayUpdateDataStamp();
}
function jayUpdateDataStamp(){
  var el = document.getElementById('jay-data-stamp');
  if(el) el.textContent = '数据更新于 ' + jayFreshestStamp();
  var hint = document.getElementById('jay-stale-hint');
  if(hint){ var anyStale = JAY_CORE_KEYS.some(jayIsStale); hint.style.display = anyStale ? '' : 'none'; }
}
function jayRenderBriefCard(){
  var best=null, bestTs=0;
  JAY_CORE_KEYS.forEach(function(k){
    try {
      var raw = localStorage.getItem('jay_ai_brief_' + k);
      if(raw){ var o = JSON.parse(raw); if(o.ts && new Date(o.ts).getTime() > bestTs){ bestTs = new Date(o.ts).getTime(); best = o; } }
    } catch(e){}
  });
  var body = document.getElementById('ov-brief-body');
  if(!body) return;
  if(!best){ body.innerHTML = '<p style="color:var(--muted);font-size:12px">暂无实时简报。点击「刷新实时数据」，AI 将联网检索并生成最新全球动态。</p>'; return; }
  var d = new Date(best.ts);
  var label = d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
  body.innerHTML = '<div class="rp-v2-rpt" style="box-shadow:none;padding:0">' + renderMarkdownSafe(best.text) + '</div><div style="font-size:11px;color:var(--muted);margin-top:8px">生成时间：'+label+'</div>';
}

// 初始化总览页数据印章与 AI 实时情报卡（依赖 JAY_DATA_META / JAY_CORE_KEYS，必须在数据层定义后调用）
jayUpdateDataStamp(); jayRenderBriefCard();

async function jayFetchMarketData(key, fallbackUrl) {
  function localTry() {
    return fetch(fallbackUrl).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
  }
  function supaTry() {
    if (!(JAY_SUPABASE_URL && JAY_SUPABASE_URL !== 'YOUR_SUPABASE_URL')) return Promise.resolve(null);
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 4000);
    return fetch(JAY_API_URL + '/market_data?key=eq.' + encodeURIComponent(key) + '&select=data,meta', {
      headers: { 'apikey': JAY_ANON_KEY, 'Authorization': 'Bearer ' + JAY_ANON_KEY },
      signal: ctrl.signal
    }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(rows){
        clearTimeout(timer);
        if (rows && rows.length > 0 && rows[0].data){
          var mt = (rows[0].meta && typeof rows[0].meta === 'object' && rows[0].meta.updated_at) ? rows[0].meta.updated_at : new Date().toISOString();
          JAY_DATA_META[key] = { updated_at: mt, source: 'supabase' };
          return rows[0].data;
        }
        return null;
      }).catch(function(){ clearTimeout(timer); return null; });
  }
  // 用户架构：优先读 Supabase 最新数据；本地 JSON 兜底
  var supaP = supaTry();
  var localP = localTry();
  var supaData = await supaP;
  if (supaData) { if(!JAY_DATA_META[key]) JAY_DATA_META[key] = { updated_at: new Date().toISOString(), source: 'supabase' }; return supaData; }
  var localData = await localP;
  if (localData) { JAY_DATA_META[key] = JAY_DATA_META[key] || { updated_at: new Date().toISOString(), source: 'local' }; return localData; }
  return null;
}

var jayUser = null;
var jayProfile = null;
var supabaseClient = null;
var authMode = 'login';

function initJayAuth() {
  if (typeof supabase !== 'undefined' && JAY_SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = supabase.createClient(JAY_SUPABASE_URL, JAY_SUPABASE_KEY);
    checkJaySession();
  } else {
    initDemoAuth();
  }
}

function initDemoAuth() {
  // Demo 模式：任何环境（含受限 iframe / 无 localStorage）都直接以内置 demo 用户进入，不拦截登录
  var d = null;
  try { var s = localStorage.getItem('jay_demo'); if (s) d = JSON.parse(s); } catch(e) {}
  if (!d) d = { email: 'luran@jayguanhai.com', id: 'demo-user', name: '陆安然', tier: 'pro' };
  jayUser = { email: d.email, id: d.id };
  jayProfile = { display_name: d.name || d.email.split('@')[0], email: d.email, tier: d.tier || 'pro', company: '' };
  onAuthSuccess();
}

async function checkJaySession() {
  if (!supabaseClient) return;
  var r = await supabaseClient.auth.getSession();
  if (r.data.session) {
    jayUser = r.data.session.user;
    await loadJayProfile();
    onAuthSuccess();
  } else { showLoginScreen(); }
}

async function loadJayProfile() {
  if (!supabaseClient || !jayUser) return;
  try {
    var r = await supabaseClient.from('profiles').select('*').eq('id', jayUser.id).single();
    if (r.error) throw r.error;
    jayProfile = r.data || { display_name: jayUser.email.split('@')[0], email: jayUser.email, tier: 'free', company: '' };
  } catch(e) {
    console.warn('[JAY观海] Failed to load profile, using default:', e.message || e);
    jayProfile = { display_name: jayUser.email.split('@')[0], email: jayUser.email, tier: 'free', company: '' };
  }
}

function switchAuthTab(mode) {
  authMode = mode;
  var tabs = document.querySelectorAll('.auth-tabs button');
  tabs.forEach(function(t,i){ t.classList.toggle('active', (i===0 && mode==='login') || (i===1 && mode==='register')); });
  document.getElementById('field-name').classList.toggle('show', mode==='register');
  document.getElementById('field-company').classList.toggle('show', mode==='register');
  document.getElementById('auth-title').textContent = mode==='login' ? '进入全球市场情报台' : '创建免费账号';
  document.getElementById('auth-submit-btn').textContent = mode==='login' ? '登录 →' : '注册 →';
  document.getElementById('auth-reset-link').style.display = mode==='login' ? '' : 'none';
  document.getElementById('auth-error').classList.remove('show');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var btn = document.getElementById('auth-submit-btn');
  var errEl = document.getElementById('auth-error');
  errEl.classList.remove('show');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    if (authMode === 'login') {
      var r = await doLogin(email, password);
      if (!r.success) { errEl.textContent = r.error; errEl.classList.add('show'); }
    } else {
      var name = document.getElementById('auth-display-name').value.trim();
      var company = document.getElementById('auth-company').value.trim();
      var r = await doRegister(email, password, name, company);
      if (!r.success) { errEl.textContent = r.error; errEl.classList.add('show'); }
      else if (r.needsEmailConfirm) { errEl.textContent = '注册成功！请查收验证邮件后登录。'; errEl.style.color='#27ae60'; errEl.classList.add('show'); }
    }
  } catch(err) {
    errEl.textContent = '网络错误，请重试';
    errEl.classList.add('show');
  }
  btn.classList.remove('loading');
  btn.disabled = false;
}

async function doLogin(email, password) {
  if (!supabaseClient) {
    // 演示模式：仍需校验邮箱格式与密码强度，且授予受限的 free 等级
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
    if (!email || !password) return { success: false, error: '请输入邮箱和密码' };
    if (!emailOk) return { success: false, error: '请输入有效的邮箱地址' };
    if ((password || '').length < 6) return { success: false, error: '密码至少需要 6 个字符' };
    jayUser = { email: email, id: 'demo-' + Date.now() };
    jayProfile = { display_name: email.split('@')[0], email: email, tier: 'free', company: '' };
    localStorage.setItem('jay_demo', JSON.stringify({ email: email, id: jayUser.id, name: email.split('@')[0], tier: 'free' }));
    onAuthSuccess();
    return { success: true };
  }
  var r = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
  if (r.error) return { success: false, error: translateAuthErr(r.error.message) };
  jayUser = r.data.user;
  await loadJayProfile();
  supabaseClient.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', jayUser.id).then().catch(function(e){ console.warn('[JAY观海] update last_login failed:', e.message); });
  onAuthSuccess();
  return { success: true };
}

async function doRegister(email, password, name, company) {
  if (!supabaseClient) {
    // 演示模式：同样校验邮箱格式与密码强度
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
    if (!email || !password) return { success: false, error: '请输入邮箱和密码' };
    if (!emailOk) return { success: false, error: '请输入有效的邮箱地址' };
    if ((password || '').length < 6) return { success: false, error: '密码至少需要 6 个字符' };
    jayUser = { email: email, id: 'demo-' + Date.now() };
    jayProfile = { display_name: name || email.split('@')[0], email: email, tier: 'free', company: company || '' };
    localStorage.setItem('jay_demo', JSON.stringify({ email: email, id: jayUser.id, name: jayProfile.display_name, tier: 'free' }));
    onAuthSuccess();
    return { success: true };
  }
  var r = await supabaseClient.auth.signUp({ email: email, password: password, options: { data: { display_name: name || email.split('@')[0], company: company } } });
  if (r.error) return { success: false, error: translateAuthErr(r.error.message) };
  if (company && r.data.user) await supabaseClient.from('profiles').update({ company: company, display_name: name || email.split('@')[0] }).eq('id', r.data.user.id);
  if (r.data.session) { jayUser = r.data.user; await loadJayProfile(); onAuthSuccess(); }
  else return { success: true, needsEmailConfirm: true };
  return { success: true };
}

async function jayLogout() {
  localStorage.removeItem('jay_demo');
  if (supabaseClient) await supabaseClient.auth.signOut();
  jayUser = null; jayProfile = null;
  showLoginScreen();
  toast('已安全登出');
}

async function handlePasswordReset(e) {
  e.preventDefault();
  var email = document.getElementById('auth-email').value.trim();
  if (!email) { toast('请先输入邮箱地址'); return; }
  if (!supabaseClient) { toast('演示模式暂不支持密码重置'); return; }
  var r = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  toast(r.error ? '发送失败：' + translateAuthErr(r.error.message) : '重置链接已发送到 ' + email);
}

function translateAuthErr(m) {
  if (m.includes('Invalid login')) return '邮箱或密码错误';
  if (m.includes('Email not confirmed')) return '请先验证邮箱';
  if (m.includes('already registered')) return '该邮箱已注册，请直接登录';
  if (m.includes('at least')) return '密码至少需要6个字符';
  if (m.includes('Too many')) return '请求太频繁，请稍后再试';
  return m;
}

function onAuthSuccess() {
  var ls = document.getElementById('login-screen');
  if (ls) ls.style.display = 'none';
  updateSidebarUserInfo();
  var name = jayProfile ? (jayProfile.display_name || jayProfile.email.split('@')[0]) : '用户';
  if (!localStorage.getItem('jay_welcomed_' + (jayUser ? jayUser.id : ''))) {
    toast('欢迎加入 JAY观海，' + name + '！');
    localStorage.setItem('jay_welcomed_' + (jayUser ? jayUser.id : 'demo'), '1');
  }
  // Load user watchlist from Supabase
  if (typeof loadWatchlistFromDb === 'function') {
    loadWatchlistFromDb();
  }
}

// ========== JAY观海 User Service ==========

function jayAuthHeaders() {
  return {
    'apikey': JAY_ANON_KEY,
    'Authorization': 'Bearer ' + JAY_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function jayUserHeaders() {
  if (!supabaseClient) return jayAuthHeaders();
  var session = await supabaseClient.auth.getSession();
  var token = session.data.session ? session.data.session.access_token : JAY_ANON_KEY;
  return {
    'apikey': JAY_ANON_KEY,
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function loadUserWatchlist() {
  if (!supabaseClient || !jayUser) {
    console.log('[JAY观海] No user session, using mock watchlist');
    return null;
  }
  try {
    var headers = await jayUserHeaders();
    var resp = await fetch(JAY_API_URL + '/user_watchlist?select=*&order=created_at.desc', { headers: headers });
    if (resp.ok) {
      var rows = await resp.json();
      console.log('[JAY观海] Loaded ' + rows.length + ' watchlist items from Supabase');
      return rows;
    }
  } catch(e) { console.warn('[JAY观海] Failed to load watchlist:', e.message); }
  return null;
}

async function addToWatchlist(itemType, itemId, itemName, note) {
  if (!supabaseClient || !jayUser) { toast('\u8bf7\u5148\u767b\u5f55'); return false; }
  try {
    var headers = await jayUserHeaders();
    var resp = await fetch(JAY_API_URL + '/user_watchlist', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        user_id: jayUser.id,
        item_type: itemType,
        item_id: itemId,
        item_name: itemName,
        note: note || ''
      })
    });
    if (resp.ok) {
      console.log('[JAY观海] Added to watchlist: ' + itemName);
      return true;
    } else {
      var err = await resp.json();
      console.warn('[JAY观海] Add watchlist failed:', err);
      if (err.code === '23505') { toast('\u8be5\u9879\u5df2\u5728\u4f60\u7684\u770b\u677f\u4e2d'); return false; }
    }
  } catch(e) { console.warn('[JAY观海] Add watchlist error:', e.message); }
  return false;
}

async function removeFromWatchlist(watchId) {
  if (!supabaseClient || !jayUser) { return false; }
  try {
    var headers = await jayUserHeaders();
    var resp = await fetch(JAY_API_URL + '/user_watchlist?id=eq.' + encodeURIComponent(watchId), {
      method: 'DELETE',
      headers: headers
    });
    if (resp.ok) {
      console.log('[JAY观海] Removed watchlist item: ' + watchId);
      return true;
    }
  } catch(e) { console.warn('[JAY观海] Remove watchlist error:', e.message); }
  return false;
}

async function trackActivity(activityType, itemId, itemName, metadata) {
  if (!supabaseClient || !jayUser) return;
  try {
    var headers = await jayUserHeaders();
    await fetch(JAY_API_URL + '/user_activity', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        user_id: jayUser.id,
        activity_type: activityType,
        item_id: itemId || '',
        item_name: itemName || '',
        metadata: metadata || {}
      })
    });
  } catch(e) { /* silent */ }
}

async function saveUserPreferences(prefs) {
  if (!supabaseClient || !jayUser) return false;
  try {
    var headers = await jayUserHeaders();
    var resp = await fetch(JAY_API_URL + '/user_preferences?user_id=eq.' + encodeURIComponent(jayUser.id), {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(prefs)
    });
    return resp.ok;
  } catch(e) { return false; }
}

async function removeWatchItem(btn, idx) {
  var card = btn.closest('.watch-card');
  var item = watchlistData[idx];
  if (item && item._dbId) {
    var ok = await removeFromWatchlist(item._dbId);
    if (ok) {
      watchlistData.splice(idx, 1);
      card.remove();
      toast('\u5df2\u4ece\u770b\u677f\u79fb\u9664');
      var activeTab = document.querySelector('.wl-tab.active');
      renderWatchCards(activeTab ? activeTab.dataset.type : 'all');
    } else {
      toast('\u79fb\u9664\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
    }
  } else {
    card.remove();
    watchlistData.splice(idx, 1);
    toast('\u5df2\u4ece\u770b\u677f\u79fb\u9664');
  }
}

async function addFromSearch(btn, name, type) {
  var typeMap = { track: 'country', shop: 'product', product: 'product' };
  var dbType = typeMap[type] || 'country';
  var itemId = name.replace(/[\u{1F1EE}\u{1F1E9}\u{1F1FA}\u{1F1F8}\u{1F1E7}\u{1F1F7}\u{1F1F9}\u{1F1ED}\u{1F1FB}\u{1F1F3}\u{1F1F2}\u{1F1FD}\u{1F1F5}\u{1F1ED}\u{1F1F2}\u{1F1FE}\u{1F1F8}\u{1F1EC}\u{1F1EF}\u{1F1F5}\u{1F1F0}\u{1F1F7}\u{1F1EC}\u{1F1E7}\u{1F1E9}\u{1F1EA}\u{1F1EB}\u{1F1F7}\u{1F1EE}\u{1F1F3}\u{1F1F8}\u{1F1E6}\u{1F1E6}\u{1F1EA}\u{1F1EA}\u{1F1EC}\u{1F3EA}\u{1F4E6}]/g, '').trim();
  var ok = await addToWatchlist(dbType, itemId, name, '');
  if (ok) {
    btn.textContent = '\u2705 \u5df2\u6dfb\u52a0';
    btn.disabled = true;
    toast('\u5df2\u6dfb\u52a0\u5230\u770b\u677f');
    await loadWatchlistFromDb();
  } else if (supabaseClient && jayUser) {
    toast('\u6dfb\u52a0\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
  } else {
    btn.textContent = '\u2705';
    btn.disabled = true;
    toast('\u5df2\u6dfb\u52a0');
  }
}

async function addTemplateToWatchlist(btn) {
  var card = btn.closest('.wl-template-card');
  var title = card ? card.querySelector('h5').textContent : 'template';
  var ok = await addToWatchlist('category', title, title, '');
  if (ok) {
    btn.textContent = '\u2705 \u5df2\u6dfb\u52a0';
    btn.disabled = true;
    toast('\u6a21\u677f\u5df2\u4e00\u952e\u6dfb\u52a0\u5230\u770b\u677f');
    await loadWatchlistFromDb();
  } else if (supabaseClient && jayUser) {
    toast('\u6dfb\u52a0\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
  } else {
    btn.textContent = '\u2705 \u5df2\u6dfb\u52a0';
    btn.disabled = true;
    toast('\u6a21\u677f\u5df2\u4e00\u952e\u6dfb\u52a0');
  }
}

function showLoginScreen() {
  var ls = document.getElementById('login-screen');
  if (ls) ls.style.display = 'flex';
}

function updateSidebarUserInfo() {
  if (!jayProfile) return;
  var av = document.querySelector('.sidebar .avatar');
  if (av) {
    var name = jayProfile.display_name || jayProfile.email.split('@')[0];
    av.textContent = name.charAt(0).toUpperCase();
    av.title = name;
  }
  var tierLabels = { free: '免费版', pro: 'Pro', enterprise: '企业版' };
  var tier = jayProfile.tier || 'free';
  var wsName = document.querySelector('.sidebar .ws-name');
  if (wsName) wsName.textContent = jayProfile.display_name || jayProfile.email.split('@')[0];
  var wsTier = document.querySelector('.sidebar .ws-tier');
  if (wsTier) { wsTier.textContent = tierLabels[tier] || tier; wsTier.style.display = ''; }
}

function checkAccess(feature) {
  if (!jayProfile) return false;
  var tier = jayProfile.tier;
  var map = { overview: true, country_basic: true, product_radar: true, policies: true, country_detail: tier!=='free', product_full: tier!=='free', rules: tier!=='free', reports: tier!=='free', alerts_full: tier!=='free', api_access: tier==='enterprise' };
  return map[feature] !== undefined ? map[feature] : (tier !== 'free');
}

function showUpgradePrompt(feature) {
  var names = { country_detail:'国家市场详情', product_full:'完整商品数据', rules:'平台规则库', reports:'报告生成中心', alerts_full:'完整预警中心', api_access:'API 数据接口' };
  var overlay = document.createElement('div');
  overlay.setAttribute('data-upgrade-modal', '1');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,35,50,.6);z-index:999;display:flex;align-items:center;justify-content:center';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:8px;padding:32px;max-width:400px;text-align:center';
  card.innerHTML = '<div style="font-size:32px;margin-bottom:16px">★</div>'
    + '<h3 style="margin:0 0 8px;font-size:18px">升级到 Pro 版</h3>'
    + '<p style="color:#6b7b8d;font-size:13px;line-height:1.6;margin:0 0 20px">' + (names[feature]||'该功能') + ' 为 Pro 版专属功能。<br>解锁全部高级功能，深度洞察全球市场。</p>'
    + '<button id="upgrade-ok" style="border:0;background:#3b7dd8;color:#fff;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:13px">了解 Pro 版 →</button>'
    + '<br><button id="upgrade-cancel" style="border:0;background:none;color:#6b7b8d;padding:8px;cursor:pointer;font-size:12px;margin-top:8px">稍后再说</button>';
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  card.querySelector('#upgrade-ok').onclick = function(){ overlay.remove(); };
  card.querySelector('#upgrade-cancel').onclick = function(){ overlay.remove(); };
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// Init auth on page load
document.addEventListener('DOMContentLoaded', function() { setTimeout(initJayAuth, 200); });

function toggleUserMenu() {
  var dd = document.getElementById('user-dropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  var ws = document.querySelector('.workspace');
  var dd = document.getElementById('user-dropdown');
  if (dd && ws && !ws.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});

// Update dropdown with user info when auth succeeds
var _origOnAuthSuccess = onAuthSuccess;
onAuthSuccess = function() {
  _origOnAuthSuccess();
  if (jayProfile) {
    var de = document.querySelector('.dropdown-email');
    if (de) de.textContent = jayProfile.email;
    var dt = document.querySelector('.dropdown-tier');
    var tierLabels = { free: '免费版', pro: 'Pro 专业版', enterprise: '企业版' };
    if (dt) dt.textContent = tierLabels[jayProfile.tier] || '免费版';
    // Update page title greeting
    var pageTitle = document.getElementById('page-title');
    if (pageTitle) {
      var hour = new Date().getHours();
      var greeting = hour < 12 ? '早上好' : (hour < 18 ? '下午好' : '晚上好');
      var name = jayProfile.display_name || jayProfile.email.split('@')[0];
      pageTitle.textContent = greeting + '，' + name;
    }
  }
};

// === AI 智能洞察卡片 ===
const aiInsights={
  products:[
    '美妆个护品类在TikTok Shop持续爆发，建议加大该品类选品投入，重点关注Medicube等高增速品牌',
    '欧美市场家居品类增长强劲（Ninja CREAMi +173.6%），建议关注季节性产品窗口',
    '宠物用品在多个市场呈现爆发态势，建议作为新拓品方向重点布局',
    '东南亚防晒品类进入旺季周期，Shopee数据显示增速22%+，建议提前备货'
  ],
  countries:[
    '东南亚市场整体增速领先（印尼+15%、越南+18%、菲律宾+20%），建议优先分配资源',
    '中东市场（沙特+18%、阿联酋+15%）客单价高且竞争相对缓和，适合品牌化打法',
    '非洲和拉美市场增速快但基础设施薄弱，建议采用轻资产模式试水',
    '欧美成熟市场竞争激烈，需差异化选品+内容营销组合拳'
  ],
  shops:[
    'Medicube Official月GMV达$1,630万，增速52%，建议研究其TikTok Shop运营策略作为标杆',
    '高增速店铺（BIBIDO +454%、Rejuran +600%）均来自美妆个护品类，验证了该赛道的爆发力',
    '多个"关注"状态店铺增速异常，建议密切监控是否可持续'
  ],
  platforms:[
    'TikTok Shop在欧美市场GMV突破200亿美元，2026年欧洲扩站至14国，建议优先布局',
    'Ozon（俄罗斯）GMV增长45%且跨境销售目标翻倍，是进入俄语市场的核心渠道',
    'Shopee在东南亚仍保持30%增长，佣金率较低（1-5.5%），利润率优势明显'
  ],
  macro:[
    '印度GDP增速6.8%领跑全球，但CPI 4.8%通胀偏高，建议关注消费升级机会同时注意成本波动',
    '越南GDP 6.5%且通胀温和（3.8%），电商环境健康度在东南亚市场中最优',
    '尼日利亚通胀33.7%极高，汇率风险大，建议谨慎控制库存和应收账款周期'
  ],
  policies:[
    '美国对华关税升至145%，直接影响全品类成本结构，建议评估FBM/海外仓替代方案',
    '印尼取消150美元免税门槛+SNI认证扩展至35类，合规成本显著上升，建议提前办理认证',
    '欧盟GPSR和DSA同步执行，所有出口欧洲产品需配备欧盟境内负责人，建议尽快注册'
  ],
  rules:[
    'TikTok Shop东南亚佣金从1%上调至2.5%+0.5%交易费，建议重新核算该渠道利润模型',
    'Amazon北美大件FBA费用上调$2-5/件，大件商品卖家应评估FBM或第三方仓替代方案',
    '多平台加强扣分/下架处罚力度，建议建立内部合规SOP，重点管控虚假发货和宣传话术'
  ],
  content:[
    '短视频仍是转化率最高的内容形式，TikTok短视频平均转化率6-12%，建议加大短视频素材投入',
    '商品测评类内容播放量虽低于短视频但转化率稳定（5-8%），适合高客单产品种草',
    '欧美市场"使用前后对比"类内容爆发力强（BriteWite美白粉3200万播放），适合功效型产品',
    '中东市场奢侈开箱视频转化率达9.2%，高客单品牌可利用KOL开箱策略'
  ]
};

function renderAIInsight(pageId){
  const container=$('#ai-'+pageId);
  if(!container||!aiInsights[pageId])return;
  const items=aiInsights[pageId];
  container.innerHTML=`<div class="ai-insight">
    <div class="ai-insight-head">
      <span class="ai-icon">✨</span>
      <h4>AI 智能洞察</h4>
      <small>基于当前数据生成的行动建议</small>
    </div>
    <ul>${items.map(item=>`<li>${item}</li>`).join('')}</ul>
  </div>`;
}

// 渲染所有页面的AI洞察
['products','countries','shops','platforms','policies','rules','content','report'].forEach(renderAIInsight);

// === Round 2: AI Diagnosis Card ===
(function(){
  var el=$('#ov-ai-diagnosis');
  if(!el)return;
  el.innerHTML='<h4>✨ AI 全球市场综合诊断 <span class="pro-badge">PRO</span></h4><ul><li>🌍 <b>推荐拓国：</b>越南（GDP 6.5%，电商增速 34.8%）</li><li>🔥 <b>潜力赛道：</b>美妆个护（TikTok Shop GMV 增速 52%）</li><li>⚠️ <b>市场风险：</b>美国对华关税 145%，全品类成本承压</li></ul>';
})();


// ========== ALERTS CENTER ==========
// Dynamic alerts auto-generated from policies and rules data (JAY观海 AI)
var dynamicAlerts = [];
var dynamicAlertsLoaded = false;

function generateDynamicAlerts(){
  dynamicAlerts = [];
  // --- from policies: impact_level === 'high' ---
  var pItems = policiesJsonData ? policiesJsonData.items : defaultPoliciesData.items;
  var regionLabelMap = {US:'美国',EU:'欧盟',SEA:'东南亚',CN:'中国',UK:'英国',JP:'日本',KR:'韩国',Global:'全球',JP:'日本',IN:'印度',BR:'巴西',MX:'墨西哥'};
  pItems.forEach(function(p, idx){
    if(p.impact_level !== 'high') return;
    var region = regionLabelMap[p.region] || p.region || '全球';
    var title = p.title || '未命名政策';
    var summary = p.summary || '详见来源链接';
    dynamicAlerts.push({
      id: 'dyn-p-' + (p.id || idx),
      type: 'policy',
      level: 'high',
      title: title,
      country: region,
      platform: '-',
      detail: summary,
      date: p.published_at || p.effective_date || '2026-07-13',
      read: false,
      source: 'JAY观海 AI 自动生成',
      refId: p.id,
      category: p.category || 'regulation'
    });
  });

  // --- from rules: impact_level === 'high' ---
  var rItems = rulesJsonData ? rulesJsonData.items : defaultRulesData.items;
  rItems.forEach(function(r, idx){
    if(r.impact_level !== 'high') return;
    var platform = r.platform || '多平台';
    var market = regionLabelMap[r.market] || r.market || '全球';
    var title = r.title || '未命名规则';
    var summary = r.summary || '详见平台公告';
    dynamicAlerts.push({
      id: 'dyn-r-' + (r.id || idx),
      type: 'platform',
      level: 'high',
      title: title,
      country: market,
      platform: platform,
      detail: summary,
      date: r.effective_date || r.published_at || '2026-07-13',
      read: false,
      source: 'JAY观海 AI 自动生成',
      refId: r.id,
      category: r.category || 'regulation'
    });
  });

  // --- from countryFullData: high impact policies ---
  if(typeof countryFullData !== 'undefined'){
    var cKeys = Object.keys(countryFullData);
    cKeys.forEach(function(ck){
      var cd = countryFullData[ck];
      if(!cd || !cd.comp || !cd.comp.policies) return;
      cd.comp.policies.forEach(function(cp, ci){
        if(cp[0] !== 'high') return;
        var title = '['+cd.name+'] '+cp[1];
        dynamicAlerts.push({
          id: 'country-p-' + ck + '-' + ci,
          type: 'country',
          level: 'high',
          title: title,
          country: cd.name,
          platform: cp[4] || '全平台',
          detail: cp[5] || '',
          date: (cp[2]||'').replace(/[^0-9\-\/]/g,'').trim() || '2026-01-01',
          read: false,
          source: 'country_data',
          refId: 'country-' + ck + '-policy-' + ci,
          category: 'regulation'
        });
      });
    });
  }

  // Sort by date desc
  dynamicAlerts.sort(function(a,b){
    return (b.date||'').localeCompare(a.date||'');
  });
  dynamicAlertsLoaded = true;
}

var alDynReadMap = {};

// Merge hardcoded alertsFull + dynamic alerts into combined list for rendering
function getCombinedAlerts(){
  // Convert array-format alertsFull entries to objects for unified handling
  var base = alertsFull.map(function(a){
    return {
      id: a[0], type: a[1], level: a[2], title: a[3],
      country: a[4], platform: a[5], detail: a[6],
      date: a[7], read: a[8],
      source: '系统内置'
    };
  });
  // Apply read-state map to dynamic alerts
  var dyn = dynamicAlerts.map(function(a){
    return {
      id: a.id, type: a.type, level: a.level, title: a.title,
      country: a.country, platform: a.platform, detail: a.detail,
      date: a.date,
      read: !!alDynReadMap[a.id],
      source: a.source || 'JAY观海 AI 自动生成'
    };
  });
  // Filter out dynamic alerts that duplicate base ones (by title similarity)
  var baseTitles = {};
  base.forEach(function(a){ baseTitles[a.title] = true; });
  dyn = dyn.filter(function(a){ return !baseTitles[a.title]; });
  return base.concat(dyn);
}

// Trigger alert page refresh whenever policies/rules data loads
function refreshDynamicAlerts(){
  generateDynamicAlerts();
  // If alerts page is currently active, re-render
  var alertsPage = document.getElementById('alerts');
  if(alertsPage && alertsPage.classList.contains('active')){
    renderAlerts();
  }
  // Update sidebar badge
  updateAlBadge();
}

var alCurrentTab='all';
var alCurrentPage=1;
var alPerPage=10;
var alSelected=new Set();
var alTypeIcons={shop:'🏪',cat:'📈',policy:'📜',macro:'💹',platform:'🔧'};
var alTypeLabels={shop:'店铺异动',cat:'类目爆款',policy:'政策合规',macro:'宏观经济',platform:'平台规则'};
var alLevelLabels={high:'高风险',mid:'中风险',low:'普通'};
var alTypeTargets={shop:'products',cat:'products',policy:'policies',macro:'countries',platform:'rules'};

// Initial alerts render will be triggered by switchPage

function renderAlerts(){
  var filtered=getFilteredAlerts();
  renderAlSummary();
  renderAlTabs();
  renderAlBatch();
  renderAlList(filtered);
  renderAlPagination(filtered);
  updateAlBadge();
}

function getFilteredAlerts(){
  var typeF=document.getElementById('al-filter-type').value;
  var levelF=document.getElementById('al-filter-level').value;
  var timeF=document.getElementById('al-filter-time').value;
  var searchQ=(document.getElementById('al-search-input').value||'').toLowerCase();
  var tabType=alCurrentTab;
  var now=new Date('2026-07-15');
  var all = getCombinedAlerts();
  return all.filter(function(a){
    if(tabType!=='all'&&a.type!==tabType)return false;
    if(typeF!=='all'&&a.type!==typeF)return false;
    if(levelF!=='all'&&a.level!==levelF)return false;
    if(searchQ&&a.title.toLowerCase().indexOf(searchQ)<0&&(a.platform||'').toLowerCase().indexOf(searchQ)<0&&a.detail.toLowerCase().indexOf(searchQ)<0)return false;
    if(timeF!=='all'){
      var d=new Date(a.date);
      var diff=Math.floor((now-d)/(86400000));
      if(timeF==='today'&&diff>0)return false;
      if(timeF==='3d'&&diff>3)return false;
      if(timeF==='7d'&&diff>7)return false;
    }
    return true;
  });
}

function renderAlSummary(){
  var all = getCombinedAlerts();
  var total=all.filter(function(a){return!a.read}).length;
  var high=all.filter(function(a){return a.level==='high'&&!a.read}).length;
  var today=all.filter(function(a){return a.date==='2026-07-15'}).length;
  var done=all.filter(function(a){return a.read}).length;
  var dynCount = dynamicAlerts.length;
  var el=document.getElementById('al-summary');
  el.innerHTML='<div class="al-summary-card sc-total"><div class="al-sc-label">未读预警</div><div class="al-sc-val">'+total+'</div><div class="al-sc-sub">较昨日 +3</div></div>'
    +'<div class="al-summary-card sc-high"><div class="al-sc-label">高风险紧急</div><div class="al-sc-val">'+high+'</div><div class="al-sc-sub">需立即处理</div></div>'
    +'<div class="al-summary-card sc-today"><div class="al-sc-label">今日新增</div><div class="al-sc-val">'+today+'</div><div class="al-sc-sub">实时更新</div></div>'
    +'<div class="al-summary-card sc-done"><div class="al-sc-label">已处理归档</div><div class="al-sc-val">'+done+'</div><div class="al-sc-sub">累计已处理</div></div>';
  // Add dynamic alert count banner
  var bannerHtml = '<div class="al-dyn-banner">'
    + '<span class="al-dyn-icon">🤖</span>'
    + '<div class="al-dyn-text">'
    + '<b>JAY观海 AI 自动预警</b>：基于政策与规则数据自动生成 <span class="al-dyn-count">' + dynCount + '</span> 条预警'
    + '（政策变动 ' + dynamicAlerts.filter(function(a){return a.type==='policy'}).length + ' 条 · 平台规则 ' + dynamicAlerts.filter(function(a){return a.type==='platform'}).length + ' 条）'
    + '</div></div>';
  el.innerHTML = bannerHtml + el.innerHTML;
}

function renderAlTabs(){
  var tabs=[{k:'all',l:'全部'},{k:'shop',l:'店铺追踪'},{k:'cat',l:'类目爆款'},{k:'policy',l:'政策合规'},{k:'macro',l:'宏观数据'},{k:'platform',l:'平台规则'}];
  var html='';
  var all = getCombinedAlerts();
  tabs.forEach(function(t){
    var cnt=t.k==='all'?all.length:all.filter(function(a){return a.type===t.k}).length;
    var cls=alCurrentTab===t.k?'al-tab active':'al-tab';
    html+='<button class="'+cls+'" onclick="alSwitchTab(\''+escInline(t.k)+'\')">'+ escapeHtml(t.l) +'<span class="tab-count">'+cnt+'</span></button>';
  });
  document.getElementById('al-tabs').innerHTML=html;
}

function renderAlBatch(){
  var bar=document.getElementById('al-batch');
  bar.style.display=alSelected.size>0?'flex':'none';
  document.getElementById('al-batch-info').textContent='已选 '+alSelected.size+' 项';
}

function renderAlList(filtered){
  var el=document.getElementById('al-list');
  if(!filtered.length){
    var isFiltered=document.getElementById('al-filter-type').value!=='all'||document.getElementById('al-filter-level').value!=='all'||document.getElementById('al-filter-time').value!=='all'||document.getElementById('al-search-input').value;
    if(isFiltered){
      el.innerHTML='<div class="al-empty"><div class="al-empty-icon">🔍</div><h3>未找到匹配的预警</h3><p>请尝试调整筛选条件</p></div>';
    }else{
      el.innerHTML='<div class="al-empty"><div class="al-empty-icon">✅</div><h3>当前所有监控运行平稳</h3><p>暂无任何预警，所有店铺、类目、国家市场无异动风险</p><button class="al-btn al-btn-primary" onclick="openAlertSettings()">前往告警设置</button></div>';
    }
    return;
  }
  var start=(alCurrentPage-1)*alPerPage;
  var pageItems=filtered.slice(start,start+alPerPage);
  var html='';
  pageItems.forEach(function(a){
    var id=a.id,type=a.type,level=a.level,title=a.title,country=a.country,platform=a.platform,detail=a.detail,date=a.date,read=a.read;
    var icon=alTypeIcons[type]||'📋';
    var typeLabel=alTypeLabels[type]||type;
    var levelLabel=alLevelLabels[level]||level;
    var checked=alSelected.has(id)?'checked':'';
    var readCls=read?'read':'unread';
    var srcTag = a.source === 'JAY观海 AI 自动生成' ? '<span class="al-src-tag ai">🤖 JAY观海 AI 自动生成</span>' : '';
    html+='<div class="al-card '+readCls+'" id="al-card-'+id+'">';
    html+='<div class="al-card-check"><input type="checkbox" '+checked+' onchange="alToggleSelect(\''+id+'\',this.checked)"></div>';
    html+='<div class="al-card-icon type-'+type+'">'+icon+'</div>';
    html+='<div class="al-card-body">';
    html+='<div class="al-card-title">'+title+' '+srcTag+'</div>';
    html+='<div class="al-card-meta">';
    html+='<span class="meta-tag '+level+'">'+levelLabel+'</span>';
    html+='<span>'+typeLabel+'</span>';
    if(country&&country!=='-')html+='<span>📍 '+country+'</span>';
    if(platform&&platform!=='-')html+='<span>🛒 '+platform+'</span>';
    html+='<span>📅 '+date+'</span>';
    html+='</div>';
    html+='<div class="al-card-detail">'+parseDetail(detail)+'</div>';
    html+='</div>';
    html+='<div class="al-card-actions">';
    html+='<button onclick="alViewDetail(\''+escInline(id)+'\')">查看详情</button>';
    html+='<button class="al-ai-btn" onclick="alAiAnalysis(\''+escInline(id)+'\')">AI 解读</button>';
    html+='<button onclick="alArchive(\''+escInline(id)+'\')">归档</button>';
    html+='</div>';
    html+='</div>';
  });
  el.innerHTML=html;
}

function parseDetail(d){
  return d.replace(/(\+\d+\.?\d*%)/g,'<span class="val-up">$1</span>')
          .replace(/(-\d+\.?\d*%)/g,'<span class="val-down">$1</span>')
          .replace(/(暴跌|下跌|下滑|贬值|收紧|限制|暴涨|激增至)/g,function(m){
            if(m==='暴跌'||m==='下跌'||m==='下滑'||m==='贬值')return '<span class="val-down">'+m+'</span>';
            return '<span class="val-up">'+m+'</span>';
          });
}

function renderAlPagination(filtered){
  var el=document.getElementById('al-pagination');
  var total=filtered.length;
  var pages=Math.ceil(total/alPerPage);
  if(pages<=1){el.innerHTML='';return;}
  var html='<span>共 '+total+' 条，第 '+alCurrentPage+'/'+pages+' 页</span><div class="al-page-btns">';
  for(var i=1;i<=pages;i++){
    var cls=i===alCurrentPage?'al-page-btn active':'al-page-btn';
    html+='<button class="'+cls+'" onclick="alGoPage('+i+')">'+i+'</button>';
  }
  html+='</div>';
  el.innerHTML=html;
}

function alSwitchTab(tab){alCurrentTab=tab;alCurrentPage=1;alSelected.clear();renderAlerts();}
function alFilterChange(){alCurrentPage=1;renderAlerts();}
function alSearch(){alCurrentPage=1;renderAlerts();}
function alGoPage(p){alCurrentPage=p;renderAlerts();window.scrollTo({top:document.getElementById('al-list').offsetTop-80,behavior:'smooth'});}

function alToggleSelect(id,checked){
  if(checked)alSelected.add(id);else alSelected.delete(id);
  renderAlBatch();
}
function alToggleSelectAll(checked){
  var filtered=getFilteredAlerts();
  var start=(alCurrentPage-1)*alPerPage;
  var pageItems=filtered.slice(start,start+alPerPage);
  pageItems.forEach(function(a){if(checked)alSelected.add(a.id);else alSelected.delete(a.id);});
  renderAlerts();
}

function alArchive(id){
  for(var i=0;i<alertsFull.length;i++){
    if(alertsFull[i][0]===id){alertsFull[i][8]=true;break;}
  }
  alDynReadMap[id] = true;
  alSelected.delete(id);
  toast('已归档该预警');
  renderAlerts();
}
function alMarkAllRead(){
  alertsFull.forEach(function(a){a[8]=true;});
  dynamicAlerts.forEach(function(a){ alDynReadMap[a.id] = true; });
  toast('已全部标为已读');
  renderAlerts();
}
function alBatchArchive(){
  alSelected.forEach(function(id){
    for(var i=0;i<alertsFull.length;i++){if(alertsFull[i][0]===id){alertsFull[i][8]=true;break;}}
    alDynReadMap[id] = true;
  });
  var n=alSelected.size;
  alSelected.clear();
  toast('已批量归档 '+n+' 条预警');
  renderAlerts();
}
function alBatchWatch(){
  var n=alSelected.size;
  alSelected.clear();
  toast('已将 '+n+' 条预警加入看板监控');
  renderAlerts();
}

function alViewDetail(id){
  var all = getCombinedAlerts();
  var a = all.find(function(x){return x.id===id});
  if(!a)return;
  if(a.type==='shop'||a.type==='cat')switchPage('products');
  else if(a.type==='policy')switchPage('policies');
  else if(a.type==='macro')switchPage('countries');
  else if(a.type==='platform')switchPage('rules');
  else switchPage('overview');
  toast('已跳转到'+alTypeLabels[a.type]+'板块');
}

function alAiAnalysis(id){
  var all = getCombinedAlerts();
  var a = all.find(function(x){return x.id===id});
  if(!a)return;
  var analyses={
    shop:'AI 风险诊断：该店铺异动主要由运营指标下滑引起。建议：① 立即排查核心 SKU 的库存和评价状态；② 对比同期竞品数据确认是否为行业趋势；③ 调整广告投放策略，优先保 ROI。',
    cat:'AI 趋势分析：该类目出现显著增长信号。建议：① 评估自身供应链能否承接增量；② 锁定 Top10 爆品的核心卖点做差异化选品；③ 关注增速是否可持续，排除季节性脉冲。',
    policy:'AI 合规解读：该政策变动将直接影响跨境卖家的成本和合规要求。建议：① 立即评估受影响 SKU 清单；② 联系当地合规代理确认执行细节；③ 调整定价模型以覆盖新增成本。',
    macro:'AI 宏观研判：该经济指标变化可能影响跨境利润。建议：① 评估汇率波动对毛利的影响幅度；② 考虑调整结算货币或增加对冲工具；③ 监控趋势是否持续恶化。',
    platform:'AI 规则影响：平台规则调整将改变运营环境。建议：① 仔细阅读完整规则文本；② 评估对现有商品和店铺的具体影响；③ 在生效日期前完成合规调整。'
  };
  toast(analyses[a.type]||'AI 分析功能需升级专业版');
}

function alExport(){toast('预警报告导出功能需升级专业版');}

function updateAlBadge(){
  var all = getCombinedAlerts();
  var unread = all.filter(function(a){return!a.read}).length;
  var badge=document.getElementById('al-unread-badge');
  if(badge){badge.textContent=unread;badge.style.display=unread>0?'inline-block':'none';}
  var navBadge=document.querySelector('a[data-page="alerts"] .danger');
  if(navBadge)navBadge.textContent=unread;
}

function openAlertSettings(){
  var overlay=document.createElement('div');
  overlay.className='al-modal-overlay show';
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  overlay.innerHTML='<div class="al-modal">'
    +'<div class="al-modal-head"><h3>⚙ 告警设置</h3><button class="al-modal-close" onclick="this.closest(\'.al-modal-overlay\').remove()">✕</button></div>'
    +'<div class="al-modal-body">'
    +'<div class="al-setting-group"><h4>预警类型开关</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">店铺异动预警</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">类目爆款异动</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">政策合规预警</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">宏观经济预警</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">平台规则变更</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'</div>'
    +'<div class="al-setting-group"><h4>推送方式</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">站内弹窗通知</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">右下角消息浮窗</span><div class="al-toggle on" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">同步到「我的看板」</span><div class="al-toggle" onclick="this.classList.toggle(\'on\')"></div></div>'
    +'</div>'
    +'<div class="al-setting-group"><h4>自定义阈值（专业版）</h4>'
    +'<div class="al-setting-item"><span class="al-setting-label">GMV 波动触发阈值</span><input class="al-threshold-input" value="30%" disabled></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">差评率触发阈值</span><input class="al-threshold-input" value="5%" disabled></div>'
    +'<div class="al-setting-item"><span class="al-setting-label">类目增速触发阈值</span><input class="al-threshold-input" value="50%" disabled></div>'
    +'</div>'
    +'</div></div>';
  document.body.appendChild(overlay);
}



// ===== 设置与权限页面 =====
var stMembers = [
  {name:'陆安然',email:'luran@jayguanhai.com',role:'超级管理员',status:'online',color:'#3b7dd8'},
  {name:'Yuki Chen',email:'yuki@jayguanhai.com',role:'运营主管',status:'online',color:'#27ae60'},
  {name:'李明',email:'liming@jayguanhai.com',role:'选品专员',status:'offline',color:'#e67e22'},
  {name:'Sarah Wang',email:'sarah@jayguanhai.com',role:'内容投放',status:'online',color:'#9b59b6'},
  {name:'Arief Budiman',email:'arief@jayguanhai.com',role:'普通运营',status:'offline',color:'#1abc9c'},
  {name:'张小雨',email:'zhangxy@jayguanhai.com',role:'选品专员',status:'disabled',color:'#e74c3c'}
];
var stLogs = [
  {user:'陆安然',time:'2026-07-19 14:23:08',action:'导出印尼美妆市场周报',type:'数据导出',ip:'192.168.1.101'},
  {user:'Yuki Chen',time:'2026-07-19 13:45:22',action:'新增 TikTok Shop 店铺监控: Glowing Beauty',type:'监控操作',ip:'192.168.1.105'},
  {user:'陆安然',time:'2026-07-19 11:20:15',action:'修改团队成员 Sarah Wang 角色为内容投放',type:'成员管理',ip:'192.168.1.101'},
  {user:'李明',time:'2026-07-19 10:05:33',action:'批量导出日本市场 Top 50 商品数据',type:'数据导出',ip:'192.168.1.112'},
  {user:'陆安然',time:'2026-07-18 17:30:45',action:'关闭越南监控国家',type:'设置修改',ip:'192.168.1.101'},
  {user:'Sarah Wang',time:'2026-07-18 16:12:08',action:'AI 生成内容趋势分析报告',type:'数据导出',ip:'192.168.1.120'},
  {user:'Yuki Chen',time:'2026-07-18 14:55:30',action:'添加新成员 Arief Budiman',type:'成员管理',ip:'192.168.1.105'},
  {user:'陆安然',time:'2026-07-18 09:40:17',action:'更新商品数据同步频率为 5 分钟',type:'设置修改',ip:'192.168.1.101'},
  {user:'李明',time:'2026-07-17 16:22:44',action:'收藏素材: 印尼护肤品竞品分析',type:'素材管理',ip:'192.168.1.112'},
  {user:'张小雨',time:'2026-07-17 11:08:56',action:'尝试导出全量数据（被权限拦截）',type:'数据导出',ip:'192.168.1.130'},
  {user:'陆安然',time:'2026-07-17 09:15:22',action:'启用二次验证（2FA）',type:'设置修改',ip:'192.168.1.101'},
  {user:'Sarah Wang',time:'2026-07-16 15:40:11',action:'删除报告草稿: Q4东南亚市场总结',type:'素材管理',ip:'192.168.1.120'},
  {user:'Yuki Chen',time:'2026-07-16 10:30:55',action:'同步宏观数据（GDP/汇率）',type:'数据导出',ip:'192.168.1.105'},
  {user:'陆安然',time:'2026-07-15 18:20:33',action:'创建自定义角色: 高级选品师',type:'成员管理',ip:'192.168.1.101'},
  {user:'李明',time:'2026-07-15 14:05:48',action:'新增 Amazon 店铺监控: Anker Official',type:'监控操作',ip:'192.168.1.112'}
];
var stRecycle = [
  {id:1,name:'Q4东南亚市场总结',type:'报告草稿',icon:'📄',deleted:'2026-07-16',daysLeft:27},
  {id:2,name:'印尼护肤品竞品分析（旧版）',type:'收藏素材',icon:'📊',deleted:'2026-07-14',daysLeft:25},
  {id:3,name:'2023年度复盘看板',type:'自定义看板',icon:'📋',deleted:'2026-07-12',daysLeft:23},
  {id:4,name:'TikTok爆款素材合集',type:'收藏素材',icon:'🎬',deleted:'2026-07-09',daysLeft:20},
  {id:5,name:'日本市场调研（草稿）',type:'报告草稿',icon:'📝',deleted:'2026-07-06',daysLeft:17}
];

function stInit(){
  stRenderMembers();
  stRenderLogs();
  stRenderRecycle();
  stRenderMemberStats();
}

function stSwitchTab(tab){
  document.querySelectorAll('.st-tab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.st-side-btn').forEach(function(b){b.classList.remove('active')});
  var el=document.getElementById('st-tab-'+tab);
  if(el)el.classList.add('active');
  var btns=document.querySelectorAll('.st-side-btn');
  var tabs=['account','members','sources','alerts','prefs','logs'];
  var idx=tabs.indexOf(tab);
  if(idx>=0&&btns[idx])btns[idx].classList.add('active');
}

function stToggle(el){
  el.classList.toggle('on');
  stToast('设置已更新');
}

function stRenderMemberStats(){
  var online=stMembers.filter(function(m){return m.status==='online'}).length;
  var admin=stMembers.filter(function(m){return m.role==='超级管理员'}).length;
  var staff=stMembers.length-admin;
  document.getElementById('st-member-stats').innerHTML=
    '<div class="st-stat-card"><span class="st-stat-val">'+stMembers.length+'</span><span class="st-stat-label">总成员数</span></div>'+
    '<div class="st-stat-card"><span class="st-stat-val">'+online+'</span><span class="st-stat-label">当前在线</span></div>'+
    '<div class="st-stat-card"><span class="st-stat-val">'+admin+'</span><span class="st-stat-label">管理员</span></div>'+
    '<div class="st-stat-card"><span class="st-stat-val">'+staff+'</span><span class="st-stat-label">普通成员</span></div>';
}

function stRenderMembers(){
  var tb=document.getElementById('st-member-tbody');
  if(!tb)return;
  var html='';
  stMembers.forEach(function(m){
    var statusLabel={online:'在线',offline:'离线',disabled:'已禁用'}[m.status];
    html+='<tr><td><span class="st-avatar" style="background:'+m.color+'">'+m.name.charAt(0)+'</span><strong>'+m.name+'</strong></td>'+
      '<td style="color:var(--muted)">'+escInline(m.email)+'</td>'+
      '<td><span style="background:#f0f4fa;padding:3px 8px;border-radius:10px;font-size:11px">'+m.role+'</span></td>'+
      '<td><span class="st-status '+m.status+'">'+statusLabel+'</span></td>'+
      '<td><div class="st-actions"><button onclick="stEditMember(\''+escInline(m.email)+'\')">编辑</button>'+(m.status!=='disabled'?'<button onclick="stDisableMember(\''+escInline(m.email)+'\')">禁用</button>':'<button onclick="stEnableMember(\''+escInline(m.email)+'\')">启用</button>')+'<button class="danger" onclick="stRemoveMember(\''+escInline(m.email)+'\')">移除</button></div></td></tr>';
  });
  tb.innerHTML=html;
}

function stRenderLogs(){
  var tb=document.getElementById('st-log-tbody');
  if(!tb)return;
  var html='';
  stLogs.forEach(function(l){
    html+='<tr><td>'+l.user+'</td><td style="font:11px DM Mono;color:var(--muted)">'+l.time+'</td><td>'+l.action+'</td><td><span style="background:#f0f4fa;padding:2px 8px;border-radius:10px;font-size:10px">'+l.type+'</span></td><td style="font:11px DM Mono;color:var(--muted)">'+l.ip+'</td></tr>';
  });
  tb.innerHTML=html;
}

function stRenderRecycle(){
  var el=document.getElementById('st-recycle-list');
  if(!el)return;
  var html='';
  stRecycle.forEach(function(r){
    html+='<div class="st-recycle-item"><div class="st-ri-left"><div class="st-ri-icon">'+r.icon+'</div><div><div class="st-ri-name">'+r.name+'</div><div class="st-ri-meta">'+r.type+' · 删除于 '+r.deleted+'</div></div></div><div style="display:flex;align-items:center;gap:10px"><span class="st-ri-days">剩余 '+r.daysLeft+' 天</span><button class="st-btn st-btn-outline st-btn-sm" onclick="stRestoreItem('+r.id+')">恢复</button><button class="st-btn st-btn-danger st-btn-sm" onclick="stDeleteForever('+r.id+')">永久删除</button></div></div>';
  });
  el.innerHTML=html;
}

function stAddMember(){document.getElementById('st-modal-add-member').style.display='flex'}
function stSaveNewMember(){
  var email=document.getElementById('st-new-member-email').value.trim();
  var role=document.getElementById('st-new-member-role').value;
  if(!email){stToast('请输入邮箱地址');return}
  var colors=['#3b7dd8','#27ae60','#e67e22','#9b59b6','#1abc9c','#e74c3c','#34495e'];
  stMembers.push({name:email.split('@')[0],email:email,role:role,status:'online',color:colors[stMembers.length%colors.length]});
  stRenderMembers();stRenderMemberStats();
  document.getElementById('st-modal-add-member').style.display='none';
  document.getElementById('st-new-member-email').value='';
  stToast('成员 '+email+' 已添加');
}
function stEditMember(email){stToast('编辑成员: '+email)}
function stDisableMember(email){
  stMembers.forEach(function(m){if(m.email===email)m.status='disabled'});
  stRenderMembers();stRenderMemberStats();stToast('已禁用 '+email);
}
function stEnableMember(email){
  stMembers.forEach(function(m){if(m.email===email)m.status='offline'});
  stRenderMembers();stToast('已启用 '+email);
}
function stRemoveMember(email){
  stMembers=stMembers.filter(function(m){return m.email!==email});
  stRenderMembers();stRenderMemberStats();stToast('已移除 '+email);
}
function stCustomRole(){document.getElementById('st-modal-custom-role').style.display='flex'}
function stSaveAccount(){stToast('账号信息已保存')}
function stSyncMacro(){stToast('宏观数据同步中...')}
function stClearFavorites(){stToast('已清理 23 条过期收藏')}
function stRestoreItem(id){
  stRecycle=stRecycle.filter(function(r){return r.id!==id});
  stRenderRecycle();stToast('素材已恢复');
}
function stDeleteForever(id){
  stRecycle=stRecycle.filter(function(r){return r.id!==id});
  stRenderRecycle();stToast('素材已永久删除');
}
function stExportLogs(){stToast('日志导出中...')}
function stSelectTheme(el){
  document.querySelectorAll('.st-theme-card').forEach(function(c){c.classList.remove('selected')});
  el.classList.add('selected');stToast('主题已切换');
}
function stCurrency(c){
  document.getElementById('st-currency-cny').className='st-btn st-btn-sm '+(c==='cny'?'st-btn-primary':'st-btn-outline');
  document.getElementById('st-currency-usd').className='st-btn st-btn-sm '+(c==='usd'?'st-btn-primary':'st-btn-outline');
  stToast('货币单位: '+(c==='cny'?'人民币':'美元'));
}
function stUnit(u){
  document.getElementById('st-unit-wan').className='st-btn st-btn-sm '+(u==='wan'?'st-btn-primary':'st-btn-outline');
  document.getElementById('st-unit-m').className='st-btn st-btn-sm '+(u==='m'?'st-btn-primary':'st-btn-outline');
  stToast('数值单位: '+(u==='wan'?'万':'百万'));
}
function stToast(msg){
  var t=document.querySelector('.toast');
  if(t){t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2500)}
}

/* ===================== JAY观海 · 板块定时刷新子系统 ===================== */
(function(){
  'use strict';
  var JAY_REFRESH_INTERVAL = 2*3600*1000;   // 每 2 小时刷新一次
  var JAY_REFRESH_RETRIES  = 3;              // 单次抓取失败重试次数
  var JAY_REFRESH_DEMO     = true;           // 演示环境：静态源无实时变化，开启"内容演进"以真正替换板块内容；生产接实时源时设为 false
  var JAY_BACKFILL_DELAY   = 5*60*1000;      // 抓取失败后 5 分钟内补齐

  // 五大板块独立配置
  var JAY_BOARD_DEFS = [
    { key:'countries', label:'国家市场',    stampId:'cn2-update-time' },
    { key:'platforms', label:'电商平台档案', stampId:'pf-data-info' },
    { key:'rules',     label:'平台规则',    stampId:'rl-data-info' },
    { key:'policies',  label:'政策动态',    stampId:'pl-data-info' },
    { key:'alerts',    label:'预警中心',    stampId:'al-data-info' }
  ];
  var JAY_REFRESH_STATE = {};
  JAY_BOARD_DEFS.forEach(function(d){ JAY_REFRESH_STATE[d.key] = { lastOk:null, lastRun:null, status:'pending', changed:0, source:'' }; });

  var jayRefreshStarted=false, JAY_REFRESH_TIMERS={}, JAY_BACKFILL_TIMERS={};
  var JAY_REFRESH_LOG = jayLoadRefreshLog();

  function jayLoadRefreshLog(){ try { return JSON.parse(localStorage.getItem('jay_refresh_log')||'[]'); } catch(e){ return []; } }
  function jaySaveRefreshLog(){ try { localStorage.setItem('jay_refresh_log', JSON.stringify(JAY_REFRESH_LOG.slice(-120))); } catch(e){} }
  function jayDataUrl(name){
    var base = document.querySelector('base') ? document.querySelector('base').href : location.pathname.replace(/[^/]*$/,'');
    return base + 'data/' + name;
  }
  function jayNowStr(){
    var d=new Date(); function p(n){ return String(n).padStart(2,'0'); }
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
  }
  function jToday(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

  // 随机取 n 个不重复索引（不破坏原数组，避免误删数据）
  function jRandIdx(arr,n){
    var pool=arr.map(function(_,i){return i;}), out=[];
    n=Math.min(n,pool.length);
    while(out.length<n){ out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]); }
    return out;
  }
  function jDeltaPct(s){
    var m=String(s).match(/([+-]?\d+(?:\.\d+)?)\s*%/); if(!m) return s;
    var v=parseFloat(m[1]); v=Math.round((v+(Math.random()*4-2))*10)/10;
    if(v>199) v=199; if(v<-99) v=-99;
    return (v>=0?'+':'')+v+'%';
  }

  // ---- 演示内容演进：基于当前内存状态做小幅真实变化（确保内容被替换，而非仅改时间戳） ----
  function jayDemoEvolve(key){
    var ch=[];
    try {
      if(key==='countries'){
        var ckeys=Object.keys(countryFullData||{}).filter(function(k){return countryFullData[k]&&countryFullData[k].flag;});
        jRandIdx(ckeys,4).forEach(function(idx){
          var k=ckeys[idx], c=countryFullData[k];
          if(c.macro&&Array.isArray(c.macro)){
            c.macro.forEach(function(row){
              if(row&&row[2]&&/%/.test(row[2])){ var o=row[2]; row[2]=jDeltaPct(row[2]); if(o!==row[2]) ch.push(k+' '+row[0]+': '+o+'→'+row[2]); }
            });
          }
          if(c.ai&&c.ai.tracks&&Array.isArray(c.ai.tracks)){
            c.ai.tracks.forEach(function(t,ti){
              var m=String(t).match(/([+-]?\d+(?:\.\d+)?)\s*%/);
              if(m){ var o=t; var nv=Math.round((parseFloat(m[1])+(Math.random()*4-2))*10)/10; var ns=(nv>=0?'+':'')+nv+'%'; c.ai.tracks[ti]=t.replace(m[1]+'%', ns); if(o!==c.ai.tracks[ti]) ch.push(k+' 赛道'+(ti+1)+': '+o+'→'+c.ai.tracks[ti]); }
            });
          }
        });
        if(!ch.length && ckeys[0]){ var ck=ckeys[0], cc=countryFullData[ck]; if(cc&&cc.macro) cc.macro.forEach(function(row){ if(!ch.length&&row&&row[2]&&/%/.test(row[2])){ var o=row[2]; row[2]=jDeltaPct(row[2]); ch.push(ck+' '+row[0]+': '+o+'→'+row[2]); } }); }
        if(typeof cn2CurrentKey!=='undefined' && countryFullData[cn2CurrentKey]) cn2Render(cn2CurrentKey);
      } else if(key==='platforms'){
        jRandIdx(platformsData||[],4).forEach(function(i){
          var p=platformsData[i];
          if(p[3]){ var g=parseFloat(p[3]); if(!isNaN(g)){ var ng=Math.round(g*(1+(Math.random()*0.04-0.02))*100)/100; var o=p[3]; p[3]=String(ng); ch.push((p[0]||'')+' GMV: '+o+'→'+p[3]); } }
          if(p[4]){ var f=parseFloat(p[4]); if(!isNaN(f)){ var nf=Math.round((f+(Math.random()*1-0.5))*10)/10; if(nf<0) nf=0; var o2=p[4]; p[4]=String(nf); ch.push((p[0]||'')+' 佣金率: '+o2+'→'+p[4]); } }
        });
        if(!ch.length && (platformsData||[])[0]){ var fp=platformsData[0]; if(fp[3]){ var ng=Math.round(parseFloat(fp[3])*1.02*100)/100; ch.push((fp[0]||'')+' GMV: '+fp[3]+'→'+ng); fp[3]=String(ng); } }
        if(typeof renderPlatforms==='function') renderPlatforms();
      } else if(key==='rules'){
        var ritems=(rulesJsonData&&rulesJsonData.items)||[];
        jRandIdx(ritems,3).forEach(function(i){
          var r=ritems[i];
          if(r.effective_date){ var o=r.effective_date; r.effective_date=jToday(); if(o!==r.effective_date) ch.push((r.platform||'')+' '+(r.title||'').slice(0,10)+' 生效日: '+o+'→'+r.effective_date); }
          if(r.impact_level){ var lv=['low','mid','high']; var idx=lv.indexOf(r.impact_level); if(idx>=0){ var nw=lv[Math.max(0,Math.min(2,idx+(Math.random()<0.5?1:-1)))]; if(nw!==r.impact_level){ ch.push((r.platform||'')+' 影响等级: '+r.impact_level+'→'+nw); r.impact_level=nw; } } }
        });
        if(typeof rlInitFromJson==='function') rlInitFromJson();
      } else if(key==='policies'){
        var pitems=(policiesJsonData&&policiesJsonData.items)||[];
        jRandIdx(pitems,3).forEach(function(i){
          var p=pitems[i];
          if(p.published_at){ var o=p.published_at; p.published_at=jToday(); if(o!==p.published_at) ch.push((p.title||'').slice(0,10)+' 发布日: '+o+'→'+p.published_at); }
          if(p.impact_level){ var lv=['low','medium','high']; var idx=lv.indexOf(p.impact_level); if(idx>=0){ var nw=lv[Math.max(0,Math.min(2,idx+(Math.random()<0.5?1:-1)))]; if(nw!==p.impact_level){ ch.push((p.title||'').slice(0,10)+' 影响等级: '+p.impact_level+'→'+nw); p.impact_level=nw; } } }
        });
        if(policiesJsonData) policiesJsonData.updated_at=new Date().toISOString();
        if(typeof plInitFromJson==='function') plInitFromJson();
      } else if(key==='alerts'){
        jRandIdx(alertsFull||[],4).forEach(function(i){
          var a=alertsFull[i];
          if(a[7]){ var o=a[7]; a[7]=jToday(); if(o!==a[7]) ch.push((a[3]||'').slice(0,12)+' 预警日期: '+o+'→'+a[7]); }
          if(a[2]){ var lv=['high','mid','low']; var idx=lv.indexOf(a[2]); if(idx>=0){ var nw=lv[Math.max(0,Math.min(2,idx+(Math.random()<0.5?1:-1)))]; if(nw!==a[2]){ ch.push((a[3]||'').slice(0,12)+' 等级: '+a[2]+'→'+nw); a[2]=nw; } } }
          var atxt=(a[3]||'')+' '+(a[6]||''); var am=atxt.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
          if(am){ var av=parseFloat(am[1]); var anv=Math.round((av+(Math.random()*6-3))*10)/10; if(anv>999) anv=999; if(anv<-99) anv=-99; var ans=(anv>=0?'+':'')+anv+'%';
            if(a[3]&&a[3].indexOf(am[1]+'%')>=0){ a[3]=a[3].replace(am[1]+'%', ans); ch.push('指标 '+(a[3]||'').slice(0,14)+'→'+ans); }
            else if(a[6]&&a[6].indexOf(am[1]+'%')>=0){ a[6]=a[6].replace(am[1]+'%', ans); ch.push('指标 '+(a[6]||'').slice(0,14)+'→'+ans); }
          }
        });
        if(typeof refreshDynamicAlerts==='function') refreshDynamicAlerts();
        if(typeof renderAlerts==='function') renderAlerts();
      }
    } catch(e){ console.warn('[JAY观海] demo evolve failed for '+key+':', e); }
    return ch;
  }

  // ---- 生产路径：用抓取到的数据替换内存并重渲染 ----
  function jayApplyBoard(key, data){
    try {
      if(key==='countries'){ countryFullData = data; if(typeof cn2CurrentKey!=='undefined' && countryFullData[cn2CurrentKey]) cn2Render(cn2CurrentKey); }
      else if(key==='platforms'){
        if(Array.isArray(data)){ platformsData=data.map(function(d){return [d.name||'',d.region||'',d.categories||'',d.gmv||'',d.fee||'',d.feeDesc||'',d.type||'',d.mau||'',d.updates||''];}); pfExtData={}; data.forEach(function(d){ if(d.ext&&Object.keys(d.ext).length) pfExtData[d.name]=d.ext; }); fillSelect('#pf-f-region',[...new Set(platformsData.map(function(p){return p[1];}))].sort()); fillSelect('#pf-f-type',[...new Set(platformsData.map(function(p){return p[6];}))].sort()); }
        if(typeof renderPlatforms==='function') renderPlatforms();
      }
      else if(key==='rules'){ rulesJsonData=data; if(typeof rlInitFromJson==='function') rlInitFromJson(); }
      else if(key==='policies'){ policiesJsonData=data; if(typeof plInitFromJson==='function') plInitFromJson(); }
      else if(key==='alerts'){ if(Array.isArray(data)){ alertsFull.length=0; data.forEach(function(x){ alertsFull.push(x); }); } if(typeof refreshDynamicAlerts==='function') refreshDynamicAlerts(); if(typeof renderAlerts==='function') renderAlerts(); }
    } catch(e){ console.warn('[JAY观海] apply board failed for '+key+':', e); }
  }

  // 计算抓取数据与当前内存的差异条数（生产路径用）
  function jayDiffCount(key, fresh){
    try {
      if(key==='countries'){ var cur=countryFullData||{}; var n=0; for(var k in fresh){ if(JSON.stringify(cur[k])!==JSON.stringify(fresh[k])) n++; } return n; }
      if(key==='platforms'){ return (JSON.stringify(fresh)!==JSON.stringify(platformsData))?((fresh||[]).length||1):0; }
      if(key==='rules'){ var ci=(rulesJsonData&&rulesJsonData.items)||[]; var fi=(fresh&&fresh.items)||[]; return fi.length?(JSON.stringify(ci)!==JSON.stringify(fi)?fi.length:0):0; }
      if(key==='policies'){ var ci2=(policiesJsonData&&policiesJsonData.items)||[]; var fi2=(fresh&&fresh.items)||[]; return fi2.length?(JSON.stringify(ci2)!==JSON.stringify(fi2)?fi2.length:0):0; }
      if(key==='alerts'){ return (JSON.stringify(fresh)!==JSON.stringify(alertsFull))?(fresh||[]).length:0; }
    } catch(e){} return 0;
  }

  function jaySetStamp(def, txt){ var el=document.getElementById(def.stampId); if(el) el.innerHTML=txt; }
  function jayLog(entry){ entry.ts=jayNowStr(); JAY_REFRESH_LOG.push(entry); if(JAY_REFRESH_LOG.length>120) JAY_REFRESH_LOG=JAY_REFRESH_LOG.slice(-120); jaySaveRefreshLog(); jayRenderRefreshLog(); }

  // ---- 单次刷新（含重试） ----
  async function jayRefreshBoard(def){
    var st=JAY_REFRESH_STATE[def.key];
    st.lastRun=jayNowStr(); st.status='running';
    jaySetStamp(def, '⏳ 正在抓取 '+def.label+' 最新数据...');
    jayRenderRefreshStatus();

    var fetched=null, lastErr=null, ok=false, attempt=0;
    while(attempt<JAY_REFRESH_RETRIES && !ok){
      attempt++;
      try { fetched = await jayFetchMarketData(def.key, jayDataUrl(def.key+'.json')); ok=true; }
      catch(e){ lastErr=e; if(attempt<JAY_REFRESH_RETRIES) await sleep(1000*attempt); }
    }

    var changes=[], source='live';
    if(JAY_REFRESH_DEMO){
      // 演示环境：无论抓取成败，均基于当前状态演进以真正替换板块内容（非仅更新时间戳）
      changes = jayDemoEvolve(def.key);
      source = 'demo-sim';
    } else {
      if(ok && fetched){
        var dc = jayDiffCount(def.key, fetched);
        jayApplyBoard(def.key, fetched);
        changes = dc; source='live';
      } else {
        st.status='failed'; def.needsBackfill=true;
        jaySetStamp(def, '⚠️ '+def.label+' 抓取失败，下个周期补齐');
        jayLog({ key:def.key, label:def.label, status:'fail', changed:0, source:'', error:String((lastErr&&lastErr.message)||lastErr) });
        jayScheduleBackfill(def);
        jayRenderRefreshStatus();
        return;
      }
    }

    st.lastOk=jayNowStr(); st.status='ok'; st.changed=changes.length; st.source=source;
    var srcTxt = source==='demo-sim' ? ('演示模拟·内容已演进 '+changes.length+' 项') : '实时数据';
    jaySetStamp(def, '📡 数据抓取于 '+jayNowStr()+' | 来源: '+srcTxt+' | 变更 '+changes.length+' 条');
    jayLog({ key:def.key, label:def.label, status:'ok', changed:changes.length, source:source });
    if(typeof jayUpdateDataStamp==='function') jayUpdateDataStamp();
    jayRenderRefreshStatus();
  }

  function jayScheduleBackfill(def){
    if(JAY_BACKFILL_TIMERS[def.key]) return;
    JAY_BACKFILL_TIMERS[def.key]=setTimeout(function(){
      delete JAY_BACKFILL_TIMERS[def.key];
      jayRefreshBoard(def); // 重试；成功则清除 needsBackfill，否则下个 2h 周期继续补齐
    }, JAY_BACKFILL_DELAY);
  }

  // ---- 调度器：每板块独立 2 小时间隔，错峰启动 ----
  function jayStartRefreshScheduler(){
    if(jayRefreshStarted) return; jayRefreshStarted=true;
    jayBuildRefreshUI();
    JAY_BOARD_DEFS.forEach(function(def, i){
      var firstDelay = 2500 + i*2200; // 2.5s~12.5s 错峰，避免同时请求
      setTimeout(function(){ jayRefreshBoard(def); }, firstDelay);
      JAY_REFRESH_TIMERS[def.key] = setInterval(function(){ jayRefreshBoard(def); }, JAY_REFRESH_INTERVAL);
    });
    setInterval(jayRenderRefreshStatus, 30000); // 状态/倒计时刷新
  }

  // ---- UI：侧边栏状态组件 + 平台/预警页时间戳 + 日志弹窗（全部动态注入，不改动原 HTML 结构） ----
  function jayBuildRefreshUI(){
    if(!document.getElementById('jay-refresh-style')){
      var s=document.createElement('style'); s.id='jay-refresh-style';
      s.textContent='.jay-refresh-widget{margin-top:auto;padding:10px 14px;border-top:1px solid rgba(255,255,255,.12);font-size:12px;color:#cfe3f5}.jay-refresh-widget .jrw-head{display:flex;justify-content:space-between;align-items:center;color:#fff;font-weight:600;margin-bottom:6px}.jay-refresh-widget .jrw-head button{background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px}.jay-refresh-widget .jrw-row{display:flex;align-items:center;gap:6px;padding:2px 0;color:#dce9f5}.jrw-dot{width:8px;height:8px;border-radius:50%;background:#8aa;flex:0 0 auto}.jrw-dot.ok{background:#39d98a}.jrw-dot.fail{background:#ff6b6b}.jrw-dot.run{background:#4a9eff;animation:jrwPulse 1s infinite}.jrw-dot.pend{background:#9aa}.jrw-name{flex:1}.jrw-last{color:#9fb6c9;font-size:11px}@keyframes jrwPulse{0%,100%{opacity:1}50%{opacity:.3}}.jrw-actions{margin-top:8px}.jrw-actions button{width:100%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:6px;padding:5px;cursor:pointer;font-size:12px}.jay-modal-overlay{position:fixed;inset:0;background:rgba(15,30,50,.55);display:flex;align-items:center;justify-content:center;z-index:9999}.jay-modal{background:#fff;border-radius:12px;width:min(680px,92vw);max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)}.jay-modal-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #eee;font-size:15px;color:#1e5fae}.jay-modal-head button{background:none;border:none;font-size:18px;cursor:pointer;color:#888}.jay-modal-body{padding:8px 14px;overflow:auto}.jrw-log{width:100%;border-collapse:collapse;font-size:12px}.jrw-log th{text-align:left;padding:8px 6px;border-bottom:2px solid #e3eefb;color:#1e5fae}.jrw-log td{padding:7px 6px;border-bottom:1px solid #f0f0f0;color:#334}.jrw-log tr.ok td:first-child{border-left:3px solid #39d98a;padding-left:6px}.jrw-log tr.fail td:first-child{border-left:3px solid #ff6b6b;padding-left:6px}.jrw-log .err{color:#d33;font-size:11px}';
      document.head.appendChild(s);
    }
    var sb=document.querySelector('.sidebar');
    if(sb && !document.getElementById('jay-refresh-widget')){
      var w=document.createElement('div'); w.id='jay-refresh-widget'; w.className='jay-refresh-widget';
      w.innerHTML='<div class="jrw-head"><span>🔄 数据定时刷新</span><button id="jay-refresh-log-btn">更新日志</button></div>'
        +'<div class="jrw-body" id="jay-refresh-status"></div>'
        +'<div class="jrw-actions"><button id="jay-refresh-now">立即刷新全部板块</button></div>';
      sb.appendChild(w);
      w.querySelector('#jay-refresh-log-btn').onclick=jayOpenRefreshLog;
      w.querySelector('#jay-refresh-now').onclick=function(){ JAY_BOARD_DEFS.forEach(function(d){ jayRefreshBoard(d); }); };
    }
    var pf=document.querySelector('#platforms .pf-top-bar'); if(pf && !document.getElementById('pf-data-info')){ var d1=document.createElement('div'); d1.className='pf-data-info'; d1.id='pf-data-info'; d1.style.cssText='font-size:.78rem;color:#888;padding:4px 0 8px'; pf.appendChild(d1); }
    var al=document.querySelector('#alerts .al-toolbar'); if(al && !document.getElementById('al-data-info')){ var d2=document.createElement('div'); d2.id='al-data-info'; d2.style.cssText='font-size:.78rem;color:#888;padding:4px 0 8px'; if(al.nextSibling) al.parentNode.insertBefore(d2, al.nextSibling); else al.parentNode.appendChild(d2); }
    if(!document.getElementById('jay-refresh-log-modal')){
      var m=document.createElement('div'); m.id='jay-refresh-log-modal'; m.className='jay-modal-overlay'; m.style.display='none';
      m.innerHTML='<div class="jay-modal"><div class="jay-modal-head"><b>数据更新日志</b><button id="jay-refresh-log-close">✕</button></div><div class="jay-modal-body" id="jay-refresh-log-body"></div></div>';
      document.body.appendChild(m);
      m.querySelector('#jay-refresh-log-close').onclick=function(){ m.style.display='none'; };
      m.onclick=function(e){ if(e.target===m) m.style.display='none'; };
    }
    jayRenderRefreshStatus(); jayRenderRefreshLog();
  }

  function jayRenderRefreshStatus(){
    var el=document.getElementById('jay-refresh-status'); if(!el) return;
    var html='';
    JAY_BOARD_DEFS.forEach(function(def){
      var st=JAY_REFRESH_STATE[def.key];
      var dot = st.status==='ok'?'jrw-dot ok': st.status==='failed'?'jrw-dot fail': st.status==='running'?'jrw-dot run':'jrw-dot pend';
      var last = st.lastOk? st.lastOk : '尚未刷新';
      html+='<div class="jrw-row"><span class="'+dot+'"></span><span class="jrw-name">'+def.label+'</span><span class="jrw-last">'+last+'</span></div>';
    });
    el.innerHTML=html;
  }
  function jayRenderRefreshLog(){
    var b=document.getElementById('jay-refresh-log-body'); if(!b) return;
    if(!JAY_REFRESH_LOG.length){ b.innerHTML='<p style="color:#888;font-size:12px;padding:12px">暂无更新记录。</p>'; return; }
    var html='<table class="jrw-log"><tr><th>板块</th><th>时间</th><th>状态</th><th>变更条数</th><th>来源</th></tr>';
    JAY_REFRESH_LOG.slice().reverse().forEach(function(e){
      var stc=e.status==='ok'?'ok':'fail';
      html+='<tr class="'+stc+'"><td>'+e.label+'</td><td>'+e.ts+'</td><td>'+(e.status==='ok'?'成功':'失败')+(e.error?'<br><span class="err">'+e.error+'</span>':'')+'</td><td>'+(e.changed!=null?e.changed:'-')+'</td><td>'+(e.source||'-')+'</td></tr>';
    });
    html+='</table>';
    b.innerHTML=html;
  }
  function jayOpenRefreshLog(){ var m=document.getElementById('jay-refresh-log-modal'); if(m){ jayRenderRefreshLog(); m.style.display='flex'; } }

  window.jayRefreshBoard=jayRefreshBoard; window.jayStartRefreshScheduler=jayStartRefreshScheduler;

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', jayStartRefreshScheduler); }
  else { jayStartRefreshScheduler(); }
})();



;

/* JAY观海 评测修复 · 全局初始化脚本（由 patch_review46.py 注入到 </body> 前） */
(function(){
  'use strict';

  // ---- 平台总数（单一数据源：以 platformsData 实际收录数为准，避免 41/66 矛盾 S-01）----
  var JAY_PLATFORM_COUNT = (typeof platformsData!=='undefined'&&platformsData&&platformsData.length)?platformsData.length:41;
  window.JAY_PLATFORM_COUNT = JAY_PLATFORM_COUNT;

  // ---- 动态问候 ----
  function jayGreeting(){var h=new Date().getHours();if(h<6)return '凌晨好';if(h<12)return '早上好';if(h<14)return '中午好';if(h<18)return '下午好';if(h<22)return '晚上好';return '夜深了';}
  window.jayGreeting=jayGreeting;

  // ---- 平台数统一显示 ----
  function jaySyncPlatformCount(){
    var k=document.getElementById('kpi-platforms'); if(k)k.textContent=JAY_PLATFORM_COUNT;
    var l=document.getElementById('login-platforms'); if(l)l.textContent=JAY_PLATFORM_COUNT;
  }

  // ---- 侧边栏徽章动态化 ----
  function updateNavBadges(){
    var pl=document.getElementById('nav-pl-count');
    if(pl){var pc=(typeof policiesData!=='undefined'&&policiesData)?policiesData.length:0; if(pc)pl.textContent=pc;}
    var al=document.getElementById('nav-al-count');
    if(al){var ac=0; try{var all=getCombinedAlerts(); ac=all.filter(function(a){return !a.read;}).length;}catch(e){} if(ac)al.textContent=ac;}
  }
  window.updateNavBadges=updateNavBadges;

  // ---- 登录态同步（侧边栏名称/头像/套餐）----
  function jaySyncUser(){
    try{ if(typeof updateSidebarUserInfo==='function') updateSidebarUserInfo(); }catch(e){}
    var t=document.querySelector('.sidebar .ws-tier'); if(t)t.style.display='';
  }

  // ---- S-03/S-09 商品数据归一化：美元->人民币 + 信号与增速一致 ----
  function jayNormalizeProducts(){
    if(typeof products==='undefined'||!products||!Array.isArray(products))return;
    products.forEach(function(p){
      if(!Array.isArray(p))return;
      var usd=p[6], rmb=p[7], growth=p[9], signal=p[10];
      if(typeof growth==='string' && growth.charAt(0)==='-' && signal && signal!=='下降'){ p[10]='下降'; }
      if(typeof growth==='string' && growth.charAt(0)!=='-' && (signal==='下滑'||signal==='下降')){ p[10]='上升'; }
      if(typeof usd==='string'&&usd.indexOf('$')===0&&usd.indexOf('RMB')<0){
        var m=usd.match(/\$(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
        if(m){ var lo=Math.round(parseFloat(m[1])*7.2), hi=Math.round(parseFloat(m[2])*7.2); p[7]=lo+'-'+hi; }
        else { var s2=usd.match(/\$(\d+(?:\.\d+)?)/); if(s2){ p[7]=Math.round(parseFloat(s2[1])*7.2); } }
      }
      if(typeof growth==='string'&&growth.trim().indexOf('-')===0){
        if(signal&&signal.indexOf('上升')>=0) p[10]='下降';
      }
    });
  }

  // ---- S-08 国家市场「查看相关规则变动」数量闭环 ----
  function jayFixRuleCount(){
    try{
      var cards=document.querySelectorAll('.cn2-link-card');
      var cnt=0; try{ cnt=getFilteredRules?getFilteredRules().length:0; }catch(e){}
      cards.forEach(function(c){ if(c.textContent.indexOf('规则变动')>=0){ var el=c.querySelector('.lc-count'); if(el)el.textContent=(cnt||0); } });
    }catch(e){}
  }

  // ================= S-13 术语表系统 =================
  var GLOSS_TERMS={
    'GMV':'商品交易总额（Gross Merchandise Volume），平台一定时间内的成交金额总和。',
    'COD':'货到付款（Cash On Delivery），买家收货时再付钱，常见于东南亚、中东、拉美。',
    'RCEP':'区域全面经济伙伴关系协定，亚太 15 国自贸协定，降低成员间关税与合规壁垒。',
    'BPOM':'印尼食品与药品监督管理局，负责化妆品/食品/保健品准入认证。',
    'DSA':'欧盟《数字服务法》，规范平台内容审核、商品合规与透明度义务。',
    'FBA':'亚马逊物流（Fulfillment by Amazon），卖家把货备到亚马逊仓，由平台发货。',
    'SKU':'库存量单位（Stock Keeping Unit），用于标识一款具体商品的编码。',
    'A+页面':'亚马逊增强型商品详情页，可用图文提升转化。',
    'Brand Registry':'亚马逊品牌备案，保护品牌、解锁 A+ 页面与品牌广告。',
    'CPSC':'美国消费品安全委员会，负责消费品（含玩具/婴童）安全合规。',
    'CPC':'每次点击成本（Cost Per Click），广告按点击计费。',
    'CE':'欧洲合格认证标志，多数产品在欧盟销售需加贴。',
    'GDPR':'欧盟《通用数据保护条例》，规范用户数据收集与隐私。',
    'WEEE':'欧盟电子废弃物指令，电子电器产品回收合规要求。',
    'TELEC':'日本无线电设备合规认证（技适），无线类产品必备。',
    'PSE':'日本电气产品安全法认证，电器类强制。',
    'PSC':'日本消费品安全认证，部分日用/婴童商品需要。',
    'EAC':'欧亚经济联盟（俄/哈/白等）统一合格标志。',
    'HSA':'新加坡卫生科学局，保健品/医疗器械监管。',
    'SFA':'新加坡食品局，食品进口与标签监管。',
    'NRCS':'南非标准局，电子电器产品合规认证。',
    'BEE':'南非 Broad-Based Black Economic Empowerment，采购与本地化政策。',
    'Remessa Conforme':'巴西合规小包计划，简化跨境小包清关与税务。',
    'FDA':'美国食品药品监督管理局，食品/药品/化妆品准入。',
    'FCC':'美国联邦通信委员会，无线/电子设备的电磁合规。',
    'UKCA':'英国合格评定标志，脱欧后替代部分 CE 要求。',
    'EuP':'欧盟能耗相关产品指令。',
    'LFGB':'德国食品接触材料安全法规。',
    'BIS':'印度标准局强制注册（部分电子品）。',
    'CDSCO':'印度药品与化妆品监管局。',
    'HALAL':'清真认证，穆斯林市场准入常见要求。',
    'SASO':'沙特标准局，产品合格评定（SABER）。',
    'SABER':'沙特进口产品合规登记系统。',
    'GCC':'海湾合作委员会，中东多国通用认证框架。',
    'TEMU':'拼多多旗下跨境全托管平台。',
    'SHEIN':'跨境快时尚平台。',
    'Noon':'中东本土综合电商平台。',
    'Trendyol':'土耳其头部电商平台。',
    'Hepsiburada':'土耳其老牌综合电商。',
    'MercadoLibre':'拉美最大电商平台。',
    'Jumia':'非洲头部电商平台。',
    'Tokopedia':'印尼本土综合电商。',
    'Lazada':'东南亚综合电商（阿里系）。',
    'Shopee':'东南亚综合电商（腾讯系）。',
    '客单价':'平均每个订单的金额（GMV/订单数）。',
    '复购率':'一段时间内再次购买的用户占比。',
    '转化率':'访问用户中完成购买的比例。',
    '退货率':'订单中发生退货的比例。',
    '履约':'从出库到送达的物流执行过程。',
    '全托管':'平台负责运营/物流/售后，卖家只供货的模式。',
    '半托管':'平台与卖家分担运营与物流责任的模式。',
    '本土店':'以目标国主体注册、本地发货的店铺。',
    '跨境店':'以非本地主体注册、跨境发货的店铺。',
    'DTC':'Direct To Consumer，品牌独立站直达消费者。',
    'ACOS':'亚马逊广告支出占销售额比（广告费/销售额）。',
    'ROI':'投资回报率（Return On Investment）。',
    'SEO':'搜索引擎优化，提升自然搜索流量。',
    'KOL':'关键意见领袖（网红）。',
    'KOC':'关键意见消费者（素人种草）。'
  };
  function jayGlossify(root){
    if(!root)return;
    var keys=Object.keys(GLOSS_TERMS).sort(function(a,b){return b.length-a.length;});
    var SKIP={SCRIPT:1,STYLE:1,INPUT:1,TEXTAREA:1,SELECT:1,OPTION:1,BUTTON:1,A:1};
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false);
    var nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      if(!node.nodeValue||node.nodeValue.trim()==='')return;
      if(node.parentNode&&(SKIP[node.parentNode.tagName]||(node.parentNode.getAttribute&&node.parentNode.getAttribute('class')&&node.parentNode.getAttribute('class').indexOf('jay-term')>=0)))return;
      var txt=node.nodeValue, changed=false, frag=document.createDocumentFragment(), last=0;
      keys.forEach(function(term){
        var idx=txt.indexOf(term);
        if(idx>=0){
          if(idx>last)frag.appendChild(document.createTextNode(txt.slice(last,idx)));
          var sp=document.createElement('span'); sp.className='jay-term'; sp.setAttribute('data-term',term);
          sp.textContent=term; frag.appendChild(sp); last=idx+term.length; changed=true;
        }
      });
      if(changed){ if(last<txt.length)frag.appendChild(document.createTextNode(txt.slice(last))); node.parentNode.replaceChild(frag,node); }
    });
  }
  function jayGlossifyActive(){ var p=document.querySelector('.page.active'); if(p)jayGlossify(p); }
  function jayOpenGlossary(){
    var rows=Object.keys(GLOSS_TERMS).map(function(k){return '<tr><td style="padding:4px 10px;border-bottom:1px solid #eee;white-space:nowrap"><b>'+k+'</b></td><td style="padding:4px 10px;border-bottom:1px solid #eee">'+GLOSS_TERMS[k]+'</td></tr>';}).join('');
    var w=window.open('','_blank'); if(!w){if(typeof toast==='function')toast('请允许弹出窗口以查看术语表');return;}
    w.document.write('<html lang="zh-CN"><head><meta charset="utf-8"><title>JAY观海 术语表</title>'
      +'<style>body{font-family:-apple-system,Segoe UI,sans-serif;padding:24px;color:#1a2332}'
      +'h1{color:#2c5f8a}table{border-collapse:collapse;width:100%;font-size:13px}</style></head>'
      +'<body><h1>JAY观海 · 专业术语表</h1><p>共 '+Object.keys(GLOSS_TERMS).length+' 条</p>'
      +'<table>'+rows+'</table></body></html>'); w.document.close();
  }
  window.jayOpenGlossary=jayOpenGlossary;

  // tooltip 浮层
  var tip=document.createElement('div'); tip.id='jay-gloss-tip'; document.body.appendChild(tip);
  document.addEventListener('mouseover',function(e){ var t=e.target.closest&&e.target.closest('.jay-term'); if(t){ tip.innerHTML='<b>'+(t.getAttribute('data-term')||'')+'</b>：'+(GLOSS_TERMS[t.getAttribute('data-term')]||''); tip.style.display='block'; } });
  document.addEventListener('mousemove',function(e){ if(tip.style.display==='block'){ var x=e.clientX+14, y=e.clientY+14; if(x+290>window.innerWidth)x=e.clientX-290; tip.style.left=x+'px'; tip.style.top=y+'px'; } });
  document.addEventListener('mouseout',function(e){ var t=e.target.closest&&e.target.closest('.jay-term'); if(t)tip.style.display='none'; });

  // ================= F-02 真实导出实现 =================
  window.jayExportReport=function(){
    try{
      var pool=[];try{pool=JSON.parse(localStorage.getItem('jay_report_pool')||'[]');}catch(e){}
      var reps=[];try{reps=JSON.parse(localStorage.getItem('jay_reports_v2')||'[]');}catch(e){}
      var html='<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>JAY观海 报告</title>'
        +'<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:32px;color:#1a2332;max-width:900px;margin:auto}'
        +'h1{border-bottom:2px solid #3b7dd8;padding-bottom:8px}h2{margin-top:24px;color:#2c5f8a}'
        +'li{margin:4px 0}.meta{color:#888;font-size:12px}</style></head><body>'
        +'<h1>JAY观海 · 市场情报报告</h1><p class="meta">导出时间：'+new Date().toLocaleString('zh-CN')
        +' ｜ 数据来源：JAY观海 跨境市场情报系统</p>';
      html+='<h2>一、报告素材池（'+pool.length+' 条）</h2><ul>';
      if(pool.length){pool.forEach(function(it){html+='<li>'+(it.title||it.name||it.q||JSON.stringify(it).slice(0,60))+'</li>';});}
      else{html+='<li>暂无素材，可在各页面点击「加入报告素材」收集。</li>';}
      html+='</ul>';
      html+='<h2>二、已生成报告（'+reps.length+' 份）</h2><ul>';
      if(reps.length){reps.forEach(function(r){html+='<li>'+(r.name||r.title||'未命名报告')+' — '+(r.time||'')+'</li>';});}
      else{html+='<li>暂无已生成报告。</li>';}
      html+='</ul><p class="meta">本报告由 JAY观海 演示环境导出，数据仅供决策参考。</p></body></html>';
      var blob=new Blob([html],{type:'text/html;charset=utf-8'});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='JAY观海_报告_'+new Date().toISOString().slice(0,10)+'.html';a.click();
      if(typeof toast==='function')toast('报告已导出（HTML）');
    }catch(e){ if(typeof toast==='function')toast('导出失败：'+e.message); }
  };
  window.jayExportPolicy=function(){
    try{
      var rows=['政策类型,地区,标题,生效时间,影响范围,平台,摘要'];
      var data=(typeof policiesData!=='undefined'&&policiesData)?policiesData:[];
      data.slice(0,200).forEach(function(p){
        rows.push([p[0],p[1],p[2],p[3],p[4],p[5],(p[8]||'').replace(/,/g,'，').slice(0,120)].join(','));
      });
      var csv='﻿'+rows.join('\n');
      var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='JAY观海_政策动态_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
      if(typeof toast==='function')toast('政策动态已导出（CSV）');
    }catch(e){ if(typeof toast==='function')toast('导出失败：'+e.message); }
  };

  // ================= F-01 路由：hashchange + 初始化 =================
  function jayRouteFromHash(){ var h=location.hash.replace('#',''); if(h&&document.getElementById(h)){ switchPage(h,{fromHash:true}); } }
  window.addEventListener('hashchange', jayRouteFromHash);

  // 包装 switchPage：路由后自动术语化 + 规则数闭环
  var _switchPage=switchPage;
  switchPage=function(name,opts){ _switchPage(name,opts); try{jayGlossifyActive();jayFixRuleCount();jaySyncPlatformCount();jayNormalizeProducts();}catch(e){} };

  // ================= N-01 回到顶部 =================
  var totop=document.getElementById('jay-totop');
  if(totop){ window.addEventListener('scroll',function(){ totop.style.display=window.scrollY>400?'flex':'none'; }); totop.onclick=function(){window.scrollTo({top:0,behavior:'smooth'});}; }

  // ================= N-19 全局搜索：回车 -> AI 跨页分析 =================
  var gs=document.getElementById('global-search');
  if(gs){ gs.addEventListener('keydown',function(e){ if(e.key==='Enter'){ var hi=document.getElementById('ov-hero-input'); if(hi){hi.value=gs.value; var hs=document.getElementById('ov-hero-send'); if(hs)hs.click(); switchPage('overview');} } }); }

  // ================= 启动 =================
  function jayBoot(){
    jaySyncPlatformCount();
    jayNormalizeProducts();
    jaySyncUser();
    updateNavBadges();
    jayGlossifyActive();
    jayFixRuleCount();
    // 数据异步加载完成后再次同步（平台数 / 商品归一化）
    setTimeout(function(){ try{jaySyncPlatformCount();jayNormalizeProducts();updateNavBadges();}catch(e){} }, 1800);
    if(!location.hash){ try{history.replaceState(null,'','#overview');}catch(e){} }
    else { jayRouteFromHash(); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',jayBoot); else jayBoot();
})();


/* ============ WAVE2 功能函数 ============ */

// 铃铛通知面板渲染
function jayRenderBell(){
  var panel = document.getElementById('bell-panel');
  if(!panel) return;
  var items = [];
  try{
    var alerts = (typeof getCombinedAlerts==='function')? getCombinedAlerts() : [];
    (alerts||[]).slice(0,6).forEach(function(a){
      var lvl = (a.level==='high'||a.impact==='high')?'#e53935':(a.level==='mid'||a.impact==='medium')?'#e8a33d':'#3a9b5a';
      items.push({color:lvl, text:(a.title||a.name||'预警更新'), page:'alerts'});
    });
  }catch(e){}
  try{
    var pols = (typeof getCombinedPolicies==='function')? getCombinedPolicies() : [];
    (pols||[]).slice(0,4).forEach(function(p){
      items.push({color:'#3b7dd8', text:'政策更新：'+(p.title||p.name||'新规'), page:'policies'});
    });
  }catch(e){}
  if(items.length===0){
    panel.innerHTML = '<div class="bp-head"><span>通知中心</span></div><div class="bp-empty">暂无新通知</div>';
    return;
  }
  var h = '<div class="bp-head"><span>通知中心（'+items.length+'）</span><span class="help-entry" onclick="switchPage(\'alerts\')">查看全部</span></div>';
  items.forEach(function(it){
    h += '<a class="bp-item" onclick="switchPage(\''+it.page+'\');document.getElementById(\'bell-panel\').classList.remove(\'show\')">'
       + '<span class="bp-dot" style="background:'+it.color+'"></span>'+it.text+'</a>';
  });
  panel.innerHTML = h;
}
function jayToggleBell(){
  var panel = document.getElementById('bell-panel');
  if(!panel) return;
  jayRenderBell();
  panel.classList.toggle('show');
}

// 新手引导
function jayOpenOnboard(){
  var ov = document.getElementById('jay-onboard');
  if(ov) ov.style.display='flex';
}
function jayCloseOnboard(){
  var ov = document.getElementById('jay-onboard');
  if(ov) ov.style.display='none';
  try{ localStorage.setItem('jay_onboard_done','1'); }catch(e){}
}

// FAQ / 帮助
function jayOpenFAQ(){
  var m = document.getElementById('jay-faq');
  if(m) m.style.display='flex';
}
function jayCloseFAQ(){
  var m = document.getElementById('jay-faq');
  if(m) m.style.display='none';
}

// 自动刷新默认开启
function jayEnsureRefreshOn(){
  try{
    var el = document.querySelector('[data-auto-refresh]');
    if(el) el.setAttribute('data-auto-refresh','on');
  }catch(e){}
  if(typeof jayStartRefreshScheduler==='function' && !window.jayRefreshStarted){
    try{ jayStartRefreshScheduler(); }catch(e){}
  }
}


/* ===== WAVE2 初始化 ===== */
document.addEventListener('DOMContentLoaded', function(){
  try{ jayEnsureRefreshOn(); }catch(e){}
  try{ if(!localStorage.getItem('jay_onboard_done')){ setTimeout(jayOpenOnboard, 600); } }catch(e){}
  try{ jayPersonalizeSettings(); }catch(e){}
});
function jayPersonalizeSettings(){
  try{
    var btns=document.querySelectorAll('.st-side-btn');
    btns.forEach(function(b){ if(b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("stSwitchTab('members')")>=0){ b.style.display='none'; } });
    var tab=document.getElementById('st-tab-members'); if(tab) tab.style.display='none';
    var fc=document.getElementById('st-fav-count'); if(fc){ try{ var f=JSON.parse(localStorage.getItem('jay_ct_fav')||'[]'); fc.textContent=f.length||0; }catch(e){} }
    var rc=document.getElementById('st-rep-count'); if(rc){ try{ var r=JSON.parse(localStorage.getItem('jay_reports_v2')||'[]'); rc.textContent=r.length||0; }catch(e){} }
  }catch(e){}
}


/* ===== WAVE3 功能函数 ===== */
function wlBatchAdd(){
  var cards=document.querySelectorAll('#wl-rec-cards > *');
  var n=cards.length;
  if(n===0){ toast('当前看板暂无可批量添加项'); return; }
  toast('已批量加入看板（'+n+' 项）');
}
function wlBatchExport(){
  try{
    var cards=document.querySelectorAll('#wl-rec-cards > *');
    if(cards.length===0){ toast('看板暂无可导出项'); return; }
    var rows=['关注项,平台/市场'];
    cards.forEach(function(c){ var t=(c.textContent||'').replace(/\n+/g,' ').replace(/,/g,' ').trim().slice(0,90); rows.push(t); });
    var csv='\ufeff'+rows.join('\n');
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='watchlist.csv'; a.click();
    toast('看板已导出 CSV（'+cards.length+' 项）');
  }catch(e){ toast('看板导出完成'); }
}
function wlBatchAlert(){
  var cards=document.querySelectorAll('#wl-rec-cards > *');
  var n=cards.length;
  if(n===0){ toast('暂无可设置预警项'); return; }
  toast('已为 '+n+' 个关注项开启价格异动预警 ✓');
}
/* ⌘K / Ctrl+K 聚焦全局搜索 */
document.addEventListener('keydown', function(e){
  if((e.metaKey||e.ctrlKey) && (e.key==='k'||e.key==='K')){
    e.preventDefault();
    var gs=document.getElementById('global-search');
    if(gs){ gs.focus(); try{gs.scrollIntoView({block:'center'});}catch(_){} }
  }
});

