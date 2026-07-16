#!/usr/bin/env python3
"""
Mercator 蓝色基调改造 + 侧边栏滚动
1. 所有CSS变量+硬编码颜色从绿/橙/暖灰 → 蓝色系+冷灰
2. 侧边栏nav添加overflow-y:auto滚动
"""
import re

FILE = '/app/data/所有对话/主对话/mercator_rework/index.html'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# === 1. CSS 变量替换 (:root 第一行) ===
# :root{--ink:#1c2b29;--muted:#71807c;--paper:#f6f4ef;--line:#dddcd5;--orange:#df6f3d;--orange-light:#fff0e8;--green:#3c6c62;--sage:#dce4db}
content = content.replace(
    ':root{--ink:#1c2b29;--muted:#71807c;--paper:#f6f4ef;--line:#dddcd5;--orange:#df6f3d;--orange-light:#fff0e8;--green:#3c6c62;--sage:#dce4db}',
    ':root{--ink:#1a2332;--muted:#6b7b8d;--paper:#f4f6fa;--line:#d5dbe3;--orange:#3b7dd8;--orange-light:#e8f0fc;--green:#2c5f8a;--sage:#dce4ef}'
)

# === 2. 硬编码颜色映射 (全局替换) ===
color_map = [
    # 主色调 green → blue
    ('#3c6c62', '#2c5f8a'),
    ('#4d946e', '#4a80c8'),
    ('#478067', '#3a6ea8'),
    ('#39735c', '#2c5f8a'),
    
    # 强调色 orange → blue accent
    ('#df6f3d', '#3b7dd8'),
    ('#dc7140', '#4a85d9'),
    ('#f3a173', '#6aadff'),
    ('#db713f', '#4a8ae6'),
    ('#bc5932', '#2a5a8a'),
    
    # 浅色系 orange/green bg → blue bg
    ('#fff0e8', '#e8f0fc'),
    ('#e8f8f0', '#e8f0fc'),
    ('#f0f7f4', '#f0f4fa'),
    ('#eaf2ed', '#eaf0f8'),
    ('#1a6b3a', '#2a5a8a'),
    
    # 深色 ink → navy
    ('#1c2b29', '#1a2332'),
    ('#29453e', '#253b58'),
    
    # 暖灰 → 冷灰
    ('#71807c', '#6b7b8d'),
    ('#f6f4ef', '#f4f6fa'),
    ('#dddcd5', '#d5dbe3'),
    ('#dce4db', '#dce4ef'),
    ('#aebbb3', '#a8b8d0'),
    ('#d5d0c5', '#c5cdd8'),
    ('#e8e4dd', '#e0e4ec'),
    ('#f0efeb', '#f0f2f6'),
    ('#f9f8f5', '#f5f7fa'),
    ('#f8faf8', '#f8fafc'),
    ('#a0aba6', '#98a5b5'),
    ('#65726d', '#5e6d80'),
    ('#52605b', '#465668'),
    ('#e0ddd4', '#d8dce6'),
    
    # 侧边栏专属色
    ('#eef2eb', '#e8edf4'),
    ('#31423e', '#283850'),
    ('#6b7f78', '#6880a0'),
    ('#91a69b', '#7a9ec5'),
    ('#9eafa9', '#8e9fb5'),
    ('#bec9c2', '#b0bdd0'),
    ('#a9bbb2', '#96a8c0'),
    ('#476158', '#3a5575'),
    ('#40504d', '#354560'),
]

# 先替换长的rgba再替换短的hex（避免部分匹配）
rgba_map = [
    ('rgba(28,43,41', 'rgba(26,35,50'),    # ink
    ('rgba(60,108,98', 'rgba(44,95,138'),   # green
    ('rgba(223,111,61', 'rgba(59,125,216'), # orange
    ('rgba(220,113,64', 'rgba(74,133,217'), # dc7140
    ('rgba(113,131,126', 'rgba(107,123,141'),# muted
]

# 执行 rgba 替换
for old, new in rgba_map:
    content = content.replace(old, new)

# 执行 hex 替换 (按长度降序，避免子串问题 — 都是7字符所以顺序不重要)
for old, new in color_map:
    content = content.replace(old, new)
    content = content.replace(old.upper(), new)

# === 3. Login screen gradient ===
# linear-gradient(124deg,#1c2b29 0%,#29453e 62%,#db713f 180%)
# 已经被上面的替换改过了，但确认一下
# 应该变成了 linear-gradient(124deg,#1a2332 0%,#253b58 62%,#4a8ae6 180%)

# === 4. 侧边栏 nav 添加滚动 ===
# 当前: .sidebar{...display:flex;flex-direction:column;...}
# 当前 nav: nav{display:grid;gap:5px}
# 需要给 nav 添加 overflow-y:auto + max-height + 自定义滚动条

# 替换 nav{display:grid;gap:5px} 为带滚动的版本
content = content.replace(
    'nav{display:grid;gap:5px}',
    'nav{display:grid;gap:5px;overflow-y:auto;max-height:calc(100vh - 280px);padding-right:4px}'
)

# 添加 nav 自定义滚动条样式（在 nav-group-label 的 CSS 前面插入）
scrollbar_css = (
    'nav::-webkit-scrollbar{width:3px}'
    'nav::-webkit-scrollbar-track{background:transparent}'
    'nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}'
    'nav::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.3)}'
)
content = content.replace(
    '.nav-group-label{',
    scrollbar_css + '\n.nav-group-label{'
)

# === 5. 还有一些补充颜色需要处理 ===
# #e8e4dd 已经被替换为 #e0e4ec，但需要确保
# #f5ebe0 这类如果存在也替换
# 检查 #9e513a (danger badge) → 保持为红橙色（danger用途）
# 检查 #c0392b (red) → 保持（danger/red用途）

# === 6. 确保一些特殊场景也被覆盖 ===
# 比如 linear-gradient 里的 #1c2b29 已经在step 2被替换
# brand-mark border 的 #91a69b 也已被替换为 #7a9ec5

# 验证替换结果
new_len = len(content)
print(f"Original: {original_len} chars")
print(f"After: {new_len} chars")
print(f"Delta: {new_len - original_len}")

# 验证关键替换
checks = {
    '#2c5f8a': content.count('#2c5f8a'),
    '#3b7dd8': content.count('#3b7dd8'),
    '#1a2332': content.count('#1a2332'),
    '#f4f6fa': content.count('#f4f6fa'),
    'overflow-y:auto;max-height:calc(100vh - 280px)': content.count('overflow-y:auto;max-height:calc(100vh - 280px)'),
    'nav::-webkit-scrollbar': content.count('nav::-webkit-scrollbar'),
}
print("\nVerification:")
for k, v in checks.items():
    print(f"  {k}: {v}")

# 检查旧颜色残留
old_checks = {
    '#3c6c62': content.count('#3c6c62'),
    '#df6f3d': content.count('#df6f3d'),
    '#1c2b29': content.count('#1c2b29'),
    '#f6f4ef': content.count('#f6f4ef'),
}
print("\nOld color remnants (should be 0 or very few):")
for k, v in old_checks.items():
    print(f"  {k}: {v}")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ Done!")
