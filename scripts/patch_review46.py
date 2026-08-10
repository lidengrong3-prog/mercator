# -*- coding: utf-8 -*-
"""JAY观海 深度评测 46 项问题修复补丁（第一波）。
小替换 + 注入片段文件（避免大段内联字符串的引号转义问题）。
"""
import os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(BASE, 'index.html')
SNIP = os.path.join(BASE, 'scripts', 'snippets')

src = open(PATH, encoding='utf-8').read()
orig_len = len(src)

def read(name):
    return open(os.path.join(SNIP, name), encoding='utf-8').read()

reps = []  # (old, new, expect_count, label)

def add(old, new, n=1, label=''):
    reps.append((old, new, n, label))

# ---------- F-01 路由：switchPage 写入 hash ----------
add('function switchPage(name){',
    "function switchPage(name,opts){ if(!(opts&&opts.fromHash)){ try{ if(location.hash!=='#'+name) history.pushState(null,'','#'+name); }catch(e){} }",
    1, 'F-01 switchPage')

# ---------- N-15 侧边栏分组中文化 ----------
add('Global Overview', '全局概览', 1, 'N-15 分组1')
add('Market Selection', '市场选择', 1, 'N-15 分组2')
add('Platform Channels', '平台渠道', 1, 'N-15 分组3')
add('Product & Operations', '商品与运营', 1, 'N-15 分组4')
add('Risk & Compliance', '风险与合规', 1, 'N-15 分组5')
add('Solution Output', '方案输出', 1, 'N-15 分组6')

# ---------- N-10 中文面包屑 + N-20 动态问候 ----------
old_titles = ("const titles={overview:'早上好，陆安然',watchlist:'我的重点看板',products:'产品全域雷达',"
             "countries:'国家市场档案',shops:'店铺追踪',alerts:'预警中心',report:'报告生成中心',"
             "settings:'设置与权限',platforms:'电商平台档案',policies:'政策动态',rules:'平台规则变动',"
             "content:'热门内容追踪'};$('#page-title').textContent=titles[name]||name;"
             "$('#breadcrumb').textContent='GLOBAL / '+name.toUpperCase();")
new_titles = ("var titles={overview:(typeof jayGreeting==='function'?jayGreeting():'您好')+'，'+((jayUser&&jayUser.name)?jayUser.name:'陆安然'),"
             "watchlist:'我的重点看板',products:'产品全域雷达',countries:'国家市场档案',shops:'店铺追踪',"
             "alerts:'预警中心',report:'报告生成中心',settings:'设置与权限',platforms:'电商平台档案',"
             "policies:'政策动态',rules:'平台规则变动',content:'热门内容追踪'};"
             "var JAY_BC={overview:'首页 / 总览',watchlist:'我的看板',products:'商品 / 产品全域雷达',"
             "countries:'市场 / 国家市场档案',shops:'商品 / 店铺追踪',alerts:'风险 / 预警中心',"
             "report:'方案 / 报告生成中心',settings:'账户 / 设置与权限',platforms:'平台 / 电商平台档案',"
             "policies:'风险 / 政策动态',rules:'风险 / 平台规则变动',content:'热门内容追踪'};"
             "$('#page-title').textContent=titles[name]||name;"
             "$('#breadcrumb').textContent=JAY_BC[name]||name;")
add(old_titles, new_titles, 1, 'N-10/N-20 面包屑+问候')

# ---------- S-06 徽章加 id ----------
add('<span>§</span>政策动态 <b>24</b>', '<span>§</span>政策动态 <b id="nav-pl-count">24</b>', 1, 'S-06 政策徽章')
add('<span>◉</span>预警中心 <b class="danger">14</b>', '<span>◉</span>预警中心 <b class="danger" id="nav-al-count">14</b>', 1, 'S-06 预警徽章')

# ---------- L-02 品牌释义 ----------
add('<div class="brand">',
    '<div class="brand" title="JAY = 际安云（JAY Cloud）；观海 = 监测全球跨境数据海洋。JAY观海意为「监测全球跨境市场的云端情报系统」，帮助中国产业带工厂低门槛洞察出海机会与风险。">',
    1, 'L-02 品牌')

# ---------- L-07 土耳其空格 ----------
add('信用卡/ debit卡/COD', '信用卡 / debit卡 / COD', 1, 'L-07 土耳其')

# ---------- S-01 平台数统一 ----------
add('<div class="ov-kpi-val">41</div>', '<div class="ov-kpi-val" id="kpi-platforms">41</div>', 1, 'S-01 KPI')
add('✓ 66个电商平台实时监控', '✓ <span id="login-platforms">66</span>个电商平台实时监控', 1, 'S-01 登录页')
add("'<small>结合 26 国 41 平台数据</small>'", "'<small>结合 26 国 '+JAY_PLATFORM_COUNT+' 平台数据</small>'", 1, 'S-01 Hero1')
add("'基于 26 国 41 平台数据'", "'基于 26 国 '+JAY_PLATFORM_COUNT+' 平台数据'", 1, 'S-01 Hero2')

# ---------- S-10 AI 就绪释义 ----------
add('<div class="ov-hero-score"><span>AI 就绪</span><b>58.78</b><small>↑</small></div>',
    '<div class="ov-hero-score" title="AI 就绪指数（0–100）：衡量目标市场/品类的 AI 可运营成熟度，分值越高代表越适合用 AI 做选品、投放与客服。当前 58.78 为中等偏上。">'
    '<span>AI 就绪</span><b>58.78</b><small>↑</small></div>',
    1, 'S-10 AI就绪')

# ---------- F-02 真实导出：替换占位函数为调用 ----------
add("function rpExportAll(){toast('报告导出功能将在下一版本上线')}",
    "function rpExportAll(){jayExportReport();}", 1, 'F-02 rpExportAll')
add("function plExportReport(){toast('政策动态报告导出功能（企业版）');}",
    "function plExportReport(){jayExportPolicy();}", 1, 'F-02 plExportReport')

# ============ 执行替换 ============
for old, new, n, label in reps:
    cnt = src.count(old)
    if cnt != n:
        print('[WARN] %s : 期望 %d 次, 实际 %d 次' % (label, n, cnt))
        if cnt == 0:
            print('   -> 跳过（未找到，可能已修复或非唯一）')
            continue
    src = src.replace(old, new, n)

# ============ S-02 店铺去重 ============
med_re = re.compile(r"\['medicube Official','TikTok Shop','欧美','US\$ 487万'[^\]]*\]")
src, mcnt = med_re.subn('', src)
print('[INFO] Medicube 重复行移除:', mcnt)
daz_re = re.compile(r"\['Dazzle Me Official','TikTok Shop','东南亚','US\$ 85万'[^\]]*\]")
src, dazcnt = daz_re.subn('', src)
print('[INFO] Dazzle Me 重复行移除:', dazcnt)

# ============ 注入 CSS ============
css = read('review46.css')
assert src.count('</style>') >= 1, 'style anchor missing'
src = src.replace('</style>', css + '</style>', 1)

# ============ 注入 FOOTER + INIT（在 </body> 前）===========
footer = read('review46_footer.html')
init = '<script>\n' + read('init_review46.js') + '\n</script>\n'
assert src.count('</body>') == 1, 'body anchor not unique'
src = src.replace('</body>', footer + init + '</body>', 1)

open(PATH, 'w', encoding='utf-8').write(src)
print('DONE. bytes:', len(src), '(was', orig_len, ')')
