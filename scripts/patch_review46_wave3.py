# -*- coding: utf-8 -*-
import io
SRC = 'index.html'
s = io.open(SRC, encoding='utf-8').read()

def rep(old, new, label, n=1, allow_more=False):
    global s
    c = s.count(old)
    if c == 0:
        print('  [WARN] not found:', label); return False
    if c != n and not allow_more:
        print('  [WARN] expected %d got %d: %s' % (n, c, label))
    s = s.replace(old, new, (c if allow_more else n))
    return True

print('== WAVE3 start, len', len(s))

# ---------- L-01: 侧边栏图标统一为 emoji ----------
icons = [
 ('<span>◈</span>', '<span>🏠</span>'),
 ('<span>☆</span>', '<span>⭐</span>'),
 ('<span>◎</span>', '<span>🌍</span>'),
 ('<span>◆</span>', '<span>🛒</span>'),
 ('<span>◇</span>', '<span>📊</span>'),
 ('<span>▣</span>', '<span>🏬</span>'),
 ('<span>♦</span>', '<span>🎬</span>'),
 ('<span>§</span>', '<span>📋</span>'),
 ('<span>◉</span>', '<span>🔔</span>'),
 ('<span>✦</span>', '<span>📝</span>'),
]
for old, new in icons:
    rep(old, new, 'icon '+old)

# ---------- N-07: 平台卡片字母徽标 ----------
rep("<div class=\"pf-card-head\"><h3>${escapeHtml(p[0])}</h3>",
    "<div class=\"pf-card-head\"><div class=\"pf-logo\" style=\"background:${pfLogoColor(p[0])}\">${escapeHtml(p[0].charAt(0))}</div><h3>${escapeHtml(p[0])}</h3>",
    'platform logo badge')

# ---------- S-14: 看板批量操作不再死链接 ----------
rep("toast('批量添加功能需升级专业版')", "wlBatchAdd()", 'wl batch add')
rep("toast('批量导出功能需升级专业版')", "wlBatchExport()", 'wl batch export')
rep("toast('批量设置预警功能需升级专业版')", "wlBatchAlert()", 'wl batch alert')

# ---------- N-09: 加入素材提示更清晰 ----------
rep("toast('已加入报告素材 ('+pool.length+')')",
    "toast('已加入报告素材池（报告生成中心可查看 · 共 '+pool.length+' 条）')",
    'material toast')

# ---------- 页脚：新增 新手引导 / 帮助入口 ----------
rep("  <a href=\"javascript:void(0)\" onclick=\"switchPage('settings')\">设置</a>",
    "  <a href=\"javascript:void(0)\" onclick=\"jayOpenOnboard()\">新手引导</a>\n  <a href=\"javascript:void(0)\" onclick=\"jayOpenFAQ()\">帮助/FAQ</a>\n  <a href=\"javascript:void(0)\" onclick=\"switchPage('settings')\">设置</a>",
    'footer help entries')

# ---------- 注入 w3.css ----------
css = io.open('scripts/snippets/review46_w3.css', encoding='utf-8').read()
first_style_end = s.find('</style>')
s = s[:first_style_end] + "\n" + css + "\n" + s[first_style_end:]
print('  w3.css injected')

# ---------- 注入 w3.js ----------
js = io.open('scripts/snippets/review46_w3.js', encoding='utf-8').read()
final_script = s.rfind('</script>')
s = s[:final_script] + "\n" + js + "\n" + s[final_script:]
print('  w3.js injected')

io.open(SRC, 'w', encoding='utf-8').write(s)
print('== WAVE3 done, new len', len(s))
