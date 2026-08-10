# -*- coding: utf-8 -*-
import io, sys, os, re

SRC = 'index.html'
s = io.open(SRC, encoding='utf-8').read()

def rep(old, new, label, n=1, allow_more=False):
    global s
    c = s.count(old)
    if c == 0:
        print('  [WARN] not found:', label)
        return False
    if c != n and not allow_more:
        print('  [WARN] expected %d got %d for: %s' % (n, c, label))
    s = s.replace(old, new, (c if allow_more else n))
    return True

print('== WAVE2 patch start, len', len(s))

# ---------- 1. S-11: 补全缺失平台的 pfExtData（消除 N/A） ----------
pf_ext = r"""'Namshi':{growth:'+21.4%',risk:'low',shipping:'Noon物流+自营',entry:'需中东公司/代理',priceRange:'$15-90',hotCats:['时尚女装','鞋履','美妆'],blueCats:['运动装','配饰'],founded:'2011',users:'1100万/月',payments:'Tabby/Tamara BNPL/信用卡',events:'斋月大促, White Friday'},
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
"""

anchor = "events:'Kwai 大促, Carnival Sale'}"
rep(anchor, anchor + "\n" + pf_ext + "\n", 'pfExtData additions')

# ---------- 2. S-09: Toplux 信号修正（负增长不应为"上升"） ----------
rep("'-7.5%','上升','Toplux Health'", "'-7.5%','下降','Toplux Health'", 'Toplux signal')

# ---------- 3. N-14 / D-22: 店铺粉丝数友好格式化 ----------
rep("(s[10]||'-')", "(s[10]?jayFmtCount(s[10]):'-')", 'shop fan format')

# ---------- 4. D-05: 自动刷新默认开启（在 jayNormalizeProducts 末尾加信号归一化 + 刷新确保） ----------
# 在 jayNormalizeProducts 末尾追加 signal 归一化
norm_anchor = "      if(typeof usd==='string'&&usd.indexOf('$')===0&&usd.indexOf('RMB')<0){"
# 替换为：先放信号归一化（在整个 forEach 内、price 修正之后）
# 我们在函数体最后（forEach 结束大括号前）插入。用函数结尾特征：
norm_tail = "    products.forEach(function(p){\n      if(!Array.isArray(p))return;\n      var usd=p[6], rmb=p[7], growth=p[9], signal=p[10];"
# 改为在同一条内部增加 signal 修正：替换 signal 行
rep("      var usd=p[6], rmb=p[7], growth=p[9], signal=p[10];",
    "      var usd=p[6], rmb=p[7], growth=p[9], signal=p[10];\n      if(typeof growth==='string' && growth.charAt(0)==='-' && signal && signal!=='下降'){ p[10]='下降'; }\n      if(typeof growth==='string' && growth.charAt(0)!=='-' && (signal==='下滑'||signal==='下降')){ p[10]='上升'; }",
    'signal normalize in normalize')

# ---------- 5. L-06: 登录页免费版文案调整 ----------
rep("注册即同意服务条款 · 免费版永久可用基础功能",
    "注册即同意服务条款 · 免费版可浏览全部数据，专业版解锁批量与企业协同",
    'login copy')

# ---------- 6. N-08: 溯源按钮路由到真实页面 ----------
rep("toast('正在跳转到: '+decodeURIComponent(this.dataset.link))",
    "jayTraceLink(decodeURIComponent(this.dataset.link))",
    'trace link route', allow_more=True)

# ---------- 7. N-13: 页脚数据源列出 12 个具体来源 ----------
new_src_line = "数据来源：26国宏观库·平台规则库·政策库·预警库·爆款库·店铺库·内容库·关税库·认证库·物流库·汇率库·行业研报（演示数据）"
rep("数据来源：26 国宏观库 · 平台规则库 · 政策库 · 预警库 · 爆款库（演示数据）", new_src_line, 'footer sources')

# ---------- 8. D-57: 收藏/报告数动态化（替换硬编码 128 / 47） ----------
rep("128</b>条收藏素材", "<span id='st-fav-count'>128</span></b>条收藏素材", 'fav count id')
rep("47</b>份报告草稿", "<span id='st-rep-count'>47</span></b>份报告草稿", 'rep count id')

# ---------- 9. 铃铛面板 HTML + 按钮改写 ----------
bell_old = '<button class="icon-btn" id="bell">♧<i></i></button><button class="export" id="export">导出'
bell_new = '<button class="icon-btn" id="bell" onclick="jayToggleBell()">🔔<i></i></button><div id="bell-panel"></div><button class="export" id="export">导出'
# 注意：原 onclick 在 JS 里另设，这里同时改写 HTML 并移除 JS 中的 switchPage
rep(bell_old, bell_new, 'bell html')
rep("$('#bell').onclick=()=>switchPage('alerts');", "/* bell handled by jayToggleBell */", 'bell onclick remove')

# ---------- 10. N-18: 报告生成真实化（rpGenerateReport 重写） ----------
rp_old_start = "function rpGenerateReport(tpl){"
rp_i = s.find(rp_old_start)
rp_j = s.find("function rpExportAll(){", rp_i)
rp_body = s[rp_i:rp_j]
rp_new = """function rpGenerateReport(tpl){
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
"""
s = s[:rp_i] + rp_new + s[rp_j:]
print('  rpGenerateReport rewritten')

# ---------- 11. 注入 w2.css（主样式块结束前） ----------
css = io.open('scripts/snippets/review46_w2.css', encoding='utf-8').read()
first_style_end = s.find('</style>')
s = s[:first_style_end] + "\n" + css + "\n" + s[first_style_end:]
print('  w2.css injected')

# ---------- 12. 注入 w2.js + 初始化（主脚本结束前） ----------
js = io.open('scripts/snippets/review46_w2.js', encoding='utf-8').read()
final_script = s.rfind('</script>')
init_extra = """
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
"""
s = s[:final_script] + "\n" + js + "\n" + init_extra + "\n" + s[final_script:]
print('  w2.js injected')

# ---------- 13. 注入 w2.html（铃铛面板 + 引导 + FAQ，</body> 前） ----------
html = io.open('scripts/snippets/review46_w2.html', encoding='utf-8').read()
body_end = s.rfind('</body>')
s = s[:body_end] + "\n" + html + "\n" + s[body_end:]
print('  w2.html injected')

io.open(SRC, 'w', encoding='utf-8').write(s)
print('== WAVE2 patch done, new len', len(s))
