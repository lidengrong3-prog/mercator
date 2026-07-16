#!/usr/bin/env python3
"""Rebuild sidebar: grouped navigation, remove macro, add report center."""

import re

with open('index.html', 'r', encoding='utf-8') as f:
    data = f.read()

original_len = len(data)
print(f'Original size: {original_len}')

# ========== 1. CSS: Add nav group styles before </style> ==========
css_addition = """
.nav-group-label{font:600 9px 'DM Mono';letter-spacing:1.2px;color:#6b7f78;text-transform:uppercase;padding:18px 12px 6px;margin:0}
.nav-group-label:first-child{padding-top:0}
nav .nav-group-label+.nav-item{margin-top:0}
.rp-header{margin-bottom:24px}
.rp-desc{color:var(--muted);font-size:13px;margin:8px 0 0}
.rp-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
.rp-stat-card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:18px 20px;text-align:center}
.rp-stat-card.rp-stat-accent{background:var(--green);border-color:var(--green)}
.rp-stat-card.rp-stat-accent .rp-stat-num,.rp-stat-card.rp-stat-accent .rp-stat-label{color:#fff}
.rp-stat-num{font:bold 28px 'Playfair Display';color:var(--ink);margin:0 0 4px}
.rp-stat-label{font:11px 'Noto Sans SC';color:var(--muted);margin:0}
.rp-main-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:20px}
.rp-left-panel,.rp-right-panel{background:#fff;border:1px solid var(--line);border-radius:8px;padding:22px 24px}
.rp-section-title{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}
.rp-section-title h3{font-size:15px;margin:0}
.rp-hint{font:11px 'DM Mono';color:#a0aba6}
.rp-material-pool{min-height:100px;border:1px dashed #d5d3cc;border-radius:6px;display:flex;align-items:center;justify-content:center}
.rp-empty-state{text-align:center;padding:28px 20px;color:var(--muted)}
.rp-empty-icon{font-size:32px;display:block;margin-bottom:10px;color:#c5c0b8}
.rp-empty-state p{margin:4px 0;font-size:13px;color:var(--ink)}
.rp-empty-state small{font-size:11px;color:#a0aba6;display:block;margin-top:4px;line-height:1.6}
.rp-templates{display:grid;gap:10px}
.rp-tpl-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:6px;transition:.15s}
.rp-tpl-card:hover{border-color:var(--green);background:#f8faf8}
.rp-tpl-icon{font-size:22px;width:40px;height:40px;display:grid;place-items:center;background:var(--sage);border-radius:8px;color:var(--green);flex-shrink:0}
.rp-tpl-info{flex:1;min-width:0}
.rp-tpl-info strong{display:block;font-size:13px;margin-bottom:2px}
.rp-tpl-info span{font:11px 'Noto Sans SC';color:var(--muted)}
.rp-tpl-btn{border:1px solid var(--green);background:#fff;color:var(--green);padding:6px 14px;border-radius:4px;font-size:11px;cursor:pointer;white-space:nowrap;transition:.15s}
.rp-tpl-btn:hover{background:var(--green);color:#fff}
.rp-preview-area{min-height:180px;border:1px dashed #d5d3cc;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.rp-export-actions{display:flex;gap:10px}
.rp-generating,.rp-gen-done{text-align:center;padding:30px}
.rp-gen-spinner{width:32px;height:32px;border:3px solid var(--line);border-top-color:var(--green);border-radius:50%;animation:rp-spin .8s linear infinite;margin:0 auto 12px}
@keyframes rp-spin{to{transform:rotate(360deg)}}
.rp-done-icon{font-size:28px;color:var(--green);display:block;margin-bottom:8px}
.rp-gen-done p,.rp-generating p{font-size:14px;margin:4px 0}
.rp-gen-done small,.rp-generating small{font-size:11px;color:#a0aba6}
@media(max-width:1000px){.rp-stats-row{grid-template-columns:repeat(2,1fr)}.rp-main-grid{grid-template-columns:1fr}}
@media(max-width:700px){.nav-group-label{display:none}.rp-stats-row{grid-template-columns:1fr 1fr}}
"""
style_close = data.find('</style>')
data = data[:style_close] + css_addition + data[style_close:]
print(f'After CSS insert: {len(data)}')

# ========== 2. Sidebar HTML: Replace <nav>...</nav> ==========
nav_start = data.find('<nav>')
nav_end = data.find('</nav>') + len('</nav>')
old_nav = data[nav_start:nav_end]
print(f'Old nav: {len(old_nav)} chars, from {nav_start} to {nav_end}')

new_nav = """<nav>
      <div class="nav-group-label">Global Overview</div>
      <a class="nav-item active" href="#overview" data-page="overview"><span>\u25c8</span>\u603b\u89c8</a>
      <a class="nav-item" href="#watchlist" data-page="watchlist"><span>\u2606</span>\u6211\u7684\u770b\u677f</a>
      <div class="nav-group-label">Market Selection</div>
      <a class="nav-item" href="#countries" data-page="countries"><span>\u25ce</span>\u56fd\u5bb6\u5e02\u573a</a>
      <div class="nav-group-label">Platform Channels</div>
      <a class="nav-item" href="#platforms" data-page="platforms"><span>\u25c6</span>\u7535\u5546\u5e73\u53f0\u6863\u6848</a>
      <a class="nav-item" href="#rules" data-page="rules"><span>\u26a1</span>\u5e73\u53f0\u89c4\u5219</a>
      <div class="nav-group-label">Product &amp; Operations</div>
      <a class="nav-item" href="#products" data-page="products"><span>\u25c7</span>\u7206\u6b3e\u96f7\u8fbe <b>44</b></a>
      <a class="nav-item" href="#shops" data-page="shops"><span>\u25a3</span>\u5e97\u94fa\u8ffd\u8e2a</a>
      <a class="nav-item" href="#content" data-page="content"><span>\u2666</span>\u70ed\u95e8\u5185\u5bb9</a>
      <div class="nav-group-label">Risk &amp; Compliance</div>
      <a class="nav-item" href="#policies" data-page="policies"><span>\u00a7</span>\u653f\u7b56\u52a8\u6001 <b>24</b></a>
      <a class="nav-item" href="#alerts" data-page="alerts"><span>\u25c9</span>\u9884\u8b66\u4e2d\u5fc3 <b class="danger">14</b></a>
      <div class="nav-group-label">Solution Output</div>
      <a class="nav-item" href="#report" data-page="report"><span>\u2726</span>\u62a5\u544a\u751f\u6210\u4e2d\u5fc3</a>
    </nav>"""

data = data[:nav_start] + new_nav + data[nav_end:]
print(f'After nav replace: {len(data)}')

# ========== 3. Remove macro section ==========
macro_start = data.find('<section id="macro"')
macro_end = data.find('</section>', macro_start) + len('</section>')
old_macro = data[macro_start:macro_end]
print(f'Removing macro section: {len(old_macro)} chars')
data = data[:macro_start] + data[macro_end:]
print(f'After macro remove: {len(data)}')

# ========== 4. Add report section before settings section ==========
settings_pos = data.find('<section id="settings"')

report_section = """<section id="report" class="page">
      <div class="rp-header">
        <p class="eyebrow">REPORT GENERATION CENTER</p>
        <h2>\u62a5\u544a\u751f\u6210\u4e2d\u5fc3</h2>
        <p class="rp-desc">\u6574\u5408\u5168\u5e73\u53f0\u6570\u636e\uff0c\u4e00\u952e\u751f\u6210\u53ef\u4ea4\u4ed8\u5ba2\u6237\u7684\u5e02\u573a\u8c03\u7814\u4e0e\u843d\u5730\u6267\u884c\u65b9\u6848</p>
      </div>
      <div class="rp-stats-row">
        <div class="rp-stat-card"><p class="rp-stat-num">0</p><p class="rp-stat-label">\u7d20\u6750\u6c60\u6570\u636e\u70b9</p></div>
        <div class="rp-stat-card"><p class="rp-stat-num">0</p><p class="rp-stat-label">\u5df2\u9009\u7d20\u6750</p></div>
        <div class="rp-stat-card rp-stat-accent"><p class="rp-stat-num">0</p><p class="rp-stat-label">\u5df2\u751f\u6210\u62a5\u544a</p></div>
        <div class="rp-stat-card"><p class="rp-stat-num">5</p><p class="rp-stat-label">\u53ef\u7528\u62a5\u544a\u6a21\u677f</p></div>
      </div>
      <div class="rp-main-grid">
        <div class="rp-left-panel">
          <div class="rp-section-title">
            <h3>\u7d20\u6750\u6c60</h3>
            <span class="rp-hint">\u4ece\u5404\u9875\u9762\u6536\u85cf\u7684\u6570\u636e\u5c06\u81ea\u52a8\u6c47\u5165\u6b64\u5904</span>
          </div>
          <div class="rp-material-pool" id="rp-material-pool">
            <div class="rp-empty-state">
              <span class="rp-empty-icon">\u2726</span>
              <p>\u5c1a\u65e0\u7d20\u6750</p>
              <small>\u5728\u56fd\u5bb6\u5e02\u573a\u3001\u5e73\u53f0\u6863\u6848\u3001\u7206\u6b3e\u96f7\u8fbe\u7b49\u9875\u9762\u70b9\u51fb\u201c\u52a0\u5165\u62a5\u544a\u7d20\u6750\u201d\u6309\u94ae\uff0c\u6570\u636e\u5c06\u81ea\u52a8\u6c47\u5165\u7d20\u6750\u6c60</p>
            </div>
          </div>
          <div class="rp-section-title" style="margin-top:24px">
            <h3>\u62a5\u544a\u6a21\u677f</h3>
          </div>
          <div class="rp-templates">
            <div class="rp-tpl-card" data-tpl="market-research">
              <div class="rp-tpl-icon">\u25ce</div>
              <div class="rp-tpl-info">
                <strong>\u5168\u7403\u5e02\u573a\u8c03\u7814\u62a5\u544a</strong>
                <span>\u8986\u76d6\u56fd\u5bb6\u5e02\u573a + \u5e73\u53f0\u6e20\u9053 + \u653f\u7b56\u73af\u5883\uff0c\u9002\u5408\u54c1\u724c\u51fa\u6d77\u524d\u671f\u8c03\u7814</span>
              </div>
              <button class="rp-tpl-btn" onclick="rpGenerateReport('market-research')">\u751f\u6210\u62a5\u544a</button>
            </div>
            <div class="rp-tpl-card" data-tpl="competitor-analysis">
              <div class="rp-tpl-icon">\u25c7</div>
              <div class="rp-tpl-info">
                <strong>\u7ade\u54c1\u5206\u6790\u62a5\u544a</strong>
                <span>\u62c6\u89e3\u7ade\u54c1\u5e97\u94fa\u3001\u7206\u6b3e\u5546\u54c1\u3001\u8425\u9500\u7b56\u7565\uff0c\u8f93\u51fa\u5dee\u5f02\u5316\u6253\u6cd5</span>
              </div>
              <button class="rp-tpl-btn" onclick="rpGenerateReport('competitor-analysis')">\u751f\u6210\u62a5\u544a</button>
            </div>
            <div class="rp-tpl-card" data-tpl="market-entry">
              <div class="rp-tpl-icon">\u25c6</div>
              <div class="rp-tpl-info">
                <strong>\u5e02\u573a\u8fdb\u5165\u65b9\u6848</strong>
                <span>\u76ee\u6807\u56fd\u5bb6 + \u5e73\u53f0\u9009\u62e9 + \u5408\u89c4\u8981\u6c42 + \u8425\u8fd0\u89c4\u5212\uff0c\u4e00\u7ad9\u5f0f\u843d\u5730\u6307\u5357</span>
              </div>
              <button class="rp-tpl-btn" onclick="rpGenerateReport('market-entry')">\u751f\u6210\u62a5\u544a</button>
            </div>
            <div class="rp-tpl-card" data-tpl="product-selection">
              <div class="rp-tpl-icon">\u25c8</div>
              <div class="rp-tpl-info">
                <strong>\u9009\u54c1\u7b56\u7565\u62a5\u544a</strong>
                <span>\u7ed3\u5408\u7206\u6b3e\u8d8b\u52bf\u3001\u5e97\u94fa\u52a8\u6001\u3001\u5185\u5bb9\u70ed\u70b9\uff0c\u8f93\u51fa\u9009\u54c1\u65b9\u5411\u4e0e\u4f9b\u5e94\u94fe\u5efa\u8bae</span>
              </div>
              <button class="rp-tpl-btn" onclick="rpGenerateReport('product-selection')">\u751f\u6210\u62a5\u544a</button>
            </div>
            <div class="rp-tpl-card" data-tpl="compliance-risk">
              <div class="rp-tpl-icon">\u00a7</div>
              <div class="rp-tpl-info">
                <strong>\u5408\u89c4\u98ce\u9669\u8bc4\u4f30\u62a5\u544a</strong>
                <span>\u6574\u5408\u653f\u7b56\u52a8\u6001 + \u5e73\u53f0\u89c4\u5219 + \u5b8f\u89c2\u6307\u6807\uff0c\u8bc4\u4f30\u76ee\u6807\u5e02\u573a\u5408\u89c4\u98ce\u9669</span>
              </div>
              <button class="rp-tpl-btn" onclick="rpGenerateReport('compliance-risk')">\u751f\u6210\u62a5\u544a</button>
            </div>
          </div>
        </div>
        <div class="rp-right-panel">
          <div class="rp-section-title">
            <h3>\u62a5\u544a\u9884\u89c8\u4e0e\u5bfc\u51fa</h3>
          </div>
          <div class="rp-preview-area" id="rp-preview-area">
            <div class="rp-empty-state">
              <span class="rp-empty-icon">\u25a1</span>
              <p>\u62a5\u544a\u9884\u89c8\u533a</p>
              <small>\u9009\u62e9\u6a21\u677f\u5e76\u70b9\u51fb\u201c\u751f\u6210\u62a5\u544a\u201d\u540e\uff0c\u62a5\u544a\u5185\u5bb9\u5c06\u5728\u8fd9\u91cc\u9884\u89c8</small>
            </div>
          </div>
          <div class="rp-export-actions">
            <button class="filter-button" onclick="rpExportAll()" style="background:var(--green)">\u5bfc\u51fa\u5168\u90e8\u62a5\u544a (Word)</button>
            <button class="filter-button" onclick="rpExportAll()" style="background:var(--orange)">\u5bfc\u51fa PDF</button>
          </div>
        </div>
      </div>
    </section>

    """

data = data[:settings_pos] + report_section + data[settings_pos:]
print(f'After report section insert: {len(data)}')

# ========== 5. JS: Update titles object ==========
# Replace the titles object
old_titles = re.search(r"const titles=\{[^}]+\}", data).group()
new_titles = old_titles.replace("macro:'\u5b8f\u89c2\u7ecf\u6d4e\u6307\u6807',", "")
new_titles = new_titles.replace("settings:'\u8bbe\u7f6e\u4e0e\u6743\u9650'", "report:'\u62a5\u544a\u751f\u6210\u4e2d\u5fc3',settings:'\u8bbe\u7f6e\u4e0e\u6743\u9650'")
data = data.replace(old_titles, new_titles)
print(f'After titles update: {len(data)}')

# ========== 6. JS: Update searchIndex - change macro to countries ==========
old_si = "'GDP\u589e\u901f','\u5b8f\u89c2\u7ecf\u6d4e\u6307\u6807','macro'"
new_si = "'GDP\u589e\u901f','\u56fd\u5bb6\u5e02\u573a\u5b8f\u89c2\u6570\u636e','countries'"
data = data.replace(old_si, new_si)
print(f'After searchIndex update: {len(data)}')

# ========== 7. JS: Update renderAIInsight forEach - remove 'macro' ==========
old_foreach = "'products','countries','shops','platforms','macro','policies','rules','content'"
new_foreach = "'products','countries','shops','platforms','policies','rules','content','report'"
data = data.replace(old_foreach, new_foreach)
print(f'After renderAIInsight update: {len(data)}')

# ========== 8. JS: Update alert filter tabs - change macro label ==========
old_tab = "k:'macro',l:'\u5b8f\u89c2\u7ecf\u6d4e'"
new_tab = "k:'macro',l:'\u5b8f\u89c2\u6570\u636e'"
data = data.replace(old_tab, new_tab)
print(f'After alert tab update: {len(data)}')

# ========== 9. JS: Update macro alert routing ==========
old_route = "else if(a[1]==='macro')switchPage('countries');"
# Keep it routing to countries - no change needed
print(f'Macro alert route: already routes to countries, no change needed')

# ========== 10. JS: Add report page render function before switchPage ==========
# Find switchPage function
sp_pos = data.find('function switchPage(name)')
report_render = """function rpGenerateReport(tpl){var names={'market-research':'\u5168\u7403\u5e02\u573a\u8c03\u7814\u62a5\u544a','competitor-analysis':'\u7ade\u54c1\u5206\u6790\u62a5\u544a','market-entry':'\u5e02\u573a\u8fdb\u5165\u65b9\u6848','product-selection':'\u9009\u54c1\u7b56\u7565\u62a5\u544a','compliance-risk':'\u5408\u89c4\u98ce\u9669\u8bc4\u4f30\u62a5\u544a'};var area=$('#rp-preview-area');area.innerHTML='<div class=\\"rp-generating\\"><div class=\\"rp-gen-spinner\\"></div><p>\u6b63\u5728\u751f\u6210 '+names[tpl]+' ...</p><small>\u6b63\u5728\u6574\u5408\u7d20\u6750\u6c60\u6570\u636e\uff0c\u8bf7\u7a0d\u5019</small></div>';setTimeout(function(){area.innerHTML='<div class=\\"rp-gen-done\\"><span class=\\"rp-done-icon\\">\u2714</span><p>'+names[tpl]+' \u5df2\u751f\u6210</p><small>\u62a5\u544a\u5df2\u52a0\u5165\u961f\u5217\uff0c\u53ef\u5728\u4e0b\u65b9\u5bfc\u51fa</small></div>';toast('\u62a5\u544a\u751f\u6210\u5b8c\u6210')},2000)}
function rpExportAll(){toast('\u62a5\u544a\u5bfc\u51fa\u529f\u80fd\u5c06\u5728\u4e0b\u4e00\u7248\u672c\u4e0a\u7ebf')}
"""
data = data[:sp_pos] + report_render + data[sp_pos:]
print(f'After report render insert: {len(data)}')

# ========== 11. JS: Update switchPage to handle report ==========
# Add report handling in switchPage
old_sp_render = "if(name==='alerts')renderAlerts();"
new_sp_render = "if(name==='alerts')renderAlerts();"
# No change needed since report page is static HTML, no dynamic render needed

# Also update the macro render code reference
# The macro rendering code still exists but won't be called since no nav item points to 'macro'
# The macroData array and renderMacro function stay for potential future use in countries page

# ========== 12. Remove macro rendering init code ==========
# Find and comment out the macro init code
old_macro_init = "renderMacro(macroData);"
new_macro_init = "// renderMacro(macroData); // disabled - macro merged into countries"
data = data.replace(old_macro_init, new_macro_init)
print(f'After macro init disable: {len(data)}')

# ========== Write output ==========
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(data)

print(f'\nFinal size: {len(data)} (delta: {len(data) - original_len:+d})')
print('Done!')
