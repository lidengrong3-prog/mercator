# -*- coding: utf-8 -*-
import io, sys

PATH = r"D:\AI工具\mercator-main\index.html"
with io.open(PATH, encoding="utf-8") as f:
    s = f.read()

def apply_count(label, old, new):
    global s
    n = s.count(old)
    if n != 1:
        print('!! EXPECTED 1 but found', n, 'for:', label)
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('OK ', label)

# ---------------- R1: Module 1 system prompt ----------------
OLD_SYS1 = (
    "  var system = '你是资深跨境电商市场研究分析师，输出结构化、数据驱动、可落地的市场调研报告。"
    "使用中文；涉及具体数据时标注来源，明确区分\"事实\"与\"推断/示意\"，不得编造精确数字。';"
)
NEW_SYS1 = (
    "  var system = [\n"
    "    '你是资深跨境电商市场研究分析师与报告结构专家，输出结构化、数据驱动、可落地的市场调研报告，使用简体中文。',\n"
    "    '格式要求（Markdown）：',\n"
    "    '1) 用 ## 二级标题分章节、### 三级标题分小节；',\n"
    "    '2) 关键数据必须用表格呈现（| 列1 | 列2 |），整篇至少 2 张表（如市场规模、竞争格局）；',\n"
    "    '3) 核心结论/机会/风险用引用块给出：行首 \" > \" ，含 ✅ 表示机会或建议，含 ⚠ 表示风险或注意；',\n"
    "    '4) 明确区分事实与推断：具体数字必须标注来源，估算值标注\"约/估算\"，不得编造精确数字；',\n"
    "    '5) 不要用代码块包裹整篇报告。'\n"
    "  ].join('\\n');"
)
apply_count('R1 Module1 system', OLD_SYS1, NEW_SYS1)

# ---------------- R2: Module 1 structure requirements ----------------
OLD_STRUCT1 = (
    "  user += '报告建议包含：一、执行摘要；二、市场规模与增长趋势；三、竞争格局与主要玩家；"
    "四、目标用户画像；五、行业痛点与机会；六、风险与合规；七、数据来源说明。';"
)
NEW_STRUCT1 = (
    "  user += '【报告结构要求】\\n';\n"
    "  user += '## 一、执行摘要（3-5 条要点，用 > ✅ 引用块呈现核心结论）\\n';\n"
    "  user += '## 二、市场规模与增长趋势（表格：年份 | 市场规模 | 同比增速 | 来源；说明驱动因素）\\n';\n"
    "  user += '## 三、竞争格局与主要玩家（表格：玩家 | 定位 | 份额估算 | 核心优势 | 来源）\\n';\n"
    "  user += '## 四、目标用户画像（人群特征、消费偏好、购买决策因素）\\n';\n"
    "  user += '## 五、行业痛点与机会（> ⚠ 列风险，> ✅ 列机会）\\n';\n"
    "  user += '## 六、进入与运营策略建议（按受众给出可执行动作）\\n';\n"
    "  user += '## 七、风险与合规（政策、平台规则、知识产权）\\n';\n"
    "  user += '## 八、数据来源与方法说明（列出参考维度与口径，标注估算部分）\\n';\n"
    "  if(audienceLabel==='决策层'){ user += '【受众适配】结论先行、精简，突出市场规模与机会。\\n'; }\n"
    "  else if(audienceLabel==='运营团队'){ user += '【受众适配】突出可拆解动作清单与时间线。\\n'; }\n"
    "  else if(audienceLabel==='外部客户'){ user += '【受众适配】专业详实、数据充分、措辞严谨。\\n'; }\n"
    "  if(formatLabel==='执行摘要'){ user += '【格式适配】只输出精简版：执行摘要 + 机会/风险引用块 + 一张核心数据表。\\n'; }\n"
    "  else if(formatLabel==='演示文稿大纲'){ user += '【格式适配】输出幻灯片大纲：每页一个 ## 标题 + 3-5 条要点。\\n'; }"
)
apply_count('R2 Module1 structure', OLD_STRUCT1, NEW_STRUCT1)

# ---------------- R3: Module 2 (execution plan) system prompt ----------------
OLD_SYS2 = (
    "    var system = '你是资深跨境电商运营顾问。基于给定的市场调研报告，输出可落地的电商执行计划。"
    "要求分模块：1)选品与SKU规划 2)定价策略 3)渠道布局 4)营销推广与预算ROI 5)供应链与运营关键节点。"
    "每项给出具体动作、时间线，并标注其依据的报告中数据点。使用中文、结构化、markdown 格式，输出为可拆解任务清单。';"
)
NEW_SYS2 = (
    "    var system = [\n"
    "      '你是资深跨境电商运营顾问。基于给定的市场调研报告，输出可落地的电商执行计划，使用简体中文。',\n"
    "      '结构要求（Markdown）：',\n"
    "      '1) 按模块分章：## 一、选品与SKU规划；## 二、定价策略；## 三、渠道布局；## 四、营销推广与预算ROI；## 五、供应链与运营关键节点。',\n"
    "      '2) 用一张总表汇总落地动作：| 阶段 | 关键动作 | 负责角色 | 时间线 | 依据(报告数据点) |。',\n"
    "      '3) 用 > ✅ 标注关键里程碑，> ⚠ 标注执行风险。',\n"
    "      '4) 每项动作尽量可拆解、可追踪；明确预算与预期ROI。'\n"
    "    ].join('\\n');"
)
apply_count('R3 Module2 system', OLD_SYS2, NEW_SYS2)

# ---------------- R4: renderMarkdownSafe full replacement ----------------
OLD_RENDER = (
    "function renderMarkdownSafe(md){\n"
    "  if(md == null) return '';\n"
    "  var esc = escapeHtml(md);\n"
    "  var lines = esc.split(/\\r?\\n/);\n"
    "  var html = '';\n"
    "  var inUl = false, inOl = false;\n"
    "  function closeLists(){ if(inUl){ html += '</ul>'; inUl = false; } if(inOl){ html += '</ol>'; inOl = false; } }\n"
    "  lines.forEach(function(line){\n"
    "    var s = line;\n"
    "    var hm = s.match(/^(#{1,4})\\s+(.*)$/);\n"
    "    if(hm){ closeLists(); var lvl = hm[1].length; var txt = inlineFmt(hm[2]);\n"
    "      var tag = lvl >= 3 ? 'h4' : (lvl === 2 ? 'h3' : 'h2');\n"
    "      html += '<' + tag + '>' + txt + '</' + tag + '>'; return; }\n"
    "    var um = s.match(/^\\s*[-*]\\s+(.*)$/);\n"
    "    if(um){ if(inOl){ html += '</ol>'; inOl = false; } if(!inUl){ html += '<ul>'; inUl = true; }\n"
    "      html += '<li>' + inlineFmt(um[1]) + '</li>'; return; }\n"
    "    var om = s.match(/^\\s*\\d+\\.\\s+(.*)$/);\n"
    "    if(om){ if(inUl){ html += '</ul>'; inUl = false; } if(!inOl){ html += '<ol>'; inOl = true; }\n"
    "      html += '<li>' + inlineFmt(om[1]) + '</li>'; return; }\n"
    "    var tm = s.match(/^\\s*\\|(.+)\\|\\s*$/);\n"
    "    if(tm){ closeLists();\n"
    "      var cells = tm[1].split('|').map(function(c){ return c.trim(); });\n"
    "      html += '<div class=\"rp-md-row\"><span>' + cells.map(inlineFmt).join('</span><span>') + '</span></div>'; return; }\n"
    "    if(s.trim() === ''){ closeLists(); return; }\n"
    "    closeLists(); html += '<p>' + inlineFmt(s) + '</p>';\n"
    "  });\n"
    "  closeLists();\n"
    "  return html;\n"
    "}"
)
NEW_RENDER = (
    "function renderMarkdownSafe(md){\n"
    "  if(md == null) return '';\n"
    "  var esc = escapeHtml(md);\n"
    "  var lines = esc.split(/\\r?\\n/);\n"
    "  var html = '';\n"
    "  var i = 0;\n"
    "  var inCode = false, codeBuf = [];\n"
    "  function flushCode(){ if(codeBuf.length){ html += '<pre class=\"rp-v2-rpt-code\"><code>' + codeBuf.join('\\n') + '</code></pre>'; codeBuf = []; } }\n"
    "  var listType = 0;\n"
    "  function closeList(){ if(listType === 1){ html += '</ul>'; } else if(listType === 2){ html += '</ol>'; } listType = 0; }\n"
    "  while(i < lines.length){\n"
    "    var s = lines[i];\n"
    "    if(/^\\s*```/.test(s)){ if(inCode){ flushCode(); } else { closeList(); } inCode = !inCode; i++; continue; }\n"
    "    if(inCode){ codeBuf.push(s); i++; continue; }\n"
    "    if(/^\\s*([-*_])(\\s*\\1){2,}\\s*$/.test(s)){ closeList(); html += '<hr>'; i++; continue; }\n"
    "    var hm = s.match(/^(#{1,4})\\s+(.*)$/);\n"
    "    if(hm){ closeList(); var lvl = hm[1].length; var txt = inlineFmt(hm[2]); var tag = lvl >= 3 ? 'h4' : (lvl === 2 ? 'h3' : 'h2'); html += '<' + tag + '>' + txt + '</' + tag + '>'; i++; continue; }\n"
    "    if(/^\\s*&gt;\\s?/.test(s)){\n"
    "      closeList();\n"
    "      var qbuf = [];\n"
    "      while(i < lines.length && /^\\s*&gt;\\s?/.test(lines[i])){ qbuf.push(lines[i].replace(/^\\s*&gt;\\s?/, '')); i++; }\n"
    "      var qjoin = qbuf.join(' ');\n"
    "      var cls = 'rp-v2-rpt-highlight';\n"
    "      if(/⚠|风险|注意|警告/.test(qjoin)){ cls = 'rp-v2-rpt-risk'; }\n"
    "      else if(/✅|机会|建议|结论|里程碑/.test(qjoin)){ cls = 'rp-v2-rpt-success'; }\n"
    "      html += '<div class=\"' + cls + '\">' + inlineFmt(qjoin) + '</div>';\n"
    "      continue;\n"
    "    }\n"
    "    if(/^\\s*\\|.*\\|\\s*$/.test(s) && i + 1 < lines.length && /^\\s*\\|?[\\s:\\|\\-]+\\|?\\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') >= 0){\n"
    "      closeList();\n"
    "      var headers = s.trim().replace(/^\\||\\|$/g, '').split('|').map(function(c){ return c.trim(); });\n"
    "      i += 2;\n"
    "      var rows = [];\n"
    "      while(i < lines.length && /^\\s*\\|.*\\|\\s*$/.test(lines[i])){\n"
    "        rows.push(lines[i].trim().replace(/^\\||\\|$/g, '').split('|').map(function(c){ return c.trim(); }));\n"
    "        i++;\n"
    "      }\n"
    "      html += '<table class=\"rp-v2-rpt-table\"><thead><tr>' + headers.map(function(h){ return '<th>' + inlineFmt(h) + '</th>'; }).join('') + '</tr></thead><tbody>';\n"
    "      rows.forEach(function(r){ html += '<tr>' + r.map(function(c){ return '<td>' + inlineFmt(c) + '</td>'; }).join('') + '</tr>'; });\n"
    "      html += '</tbody></table>';\n"
    "      continue;\n"
    "    }\n"
    "    var um = s.match(/^\\s*[-*]\\s+(.*)$/);\n"
    "    if(um){ if(listType !== 1){ closeList(); html += '<ul>'; listType = 1; } html += '<li>' + inlineFmt(um[1]) + '</li>'; i++; continue; }\n"
    "    var om = s.match(/^\\s*\\d+\\.\\s+(.*)$/);\n"
    "    if(om){ if(listType !== 2){ closeList(); html += '<ol>'; listType = 2; } html += '<li>' + inlineFmt(om[1]) + '</li>'; i++; continue; }\n"
    "    if(s.trim() === ''){ closeList(); i++; continue; }\n"
    "    closeList();\n"
    "    html += '<p>' + inlineFmt(s) + '</p>';\n"
    "    i++;\n"
    "  }\n"
    "  closeList(); flushCode();\n"
    "  return html;\n"
    "}"
)
if s.count(OLD_RENDER) != 1:
    print('!! EXPECTED 1 but found', s.count(OLD_RENDER), 'for: R4 renderMarkdownSafe')
    sys.exit(1)
s = s.replace(OLD_RENDER, NEW_RENDER, 1)
print('OK  R4 renderMarkdownSafe')

# ---------------- R5: CSS additions ----------------
OLD_CSS = (
    ".rp-v2-rpt .rp-v2-rpt-chart-placeholder{background:#f0f5f3;border:1px dashed #c5d5cf;border-radius:8px;padding:20px;text-align:center;margin:12px 0;color:var(--green);font:12px 'Noto Sans SC'}"
)
NEW_CSS = (
    OLD_CSS + "\n"
    ".rp-v2-rpt pre.rp-v2-rpt-code{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:8px;overflow:auto;font:12px 'DM Mono','SFMono-Regular',Consolas,monospace;margin:12px 0;white-space:pre}\n"
    ".rp-v2-rpt pre.rp-v2-rpt-code code{background:none;color:inherit;padding:0;font:inherit}\n"
    ".rp-v2-rpt code{background:#eef2f6;color:#2c5f8a;padding:1px 6px;border-radius:4px;font:11px 'DM Mono',monospace}\n"
    ".rp-v2-rpt hr{border:none;border-top:1px solid var(--line);margin:20px 0}\n"
    ".rp-v2-rpt .rp-v2-rpt-highlight,.rp-v2-rpt .rp-v2-rpt-risk,.rp-v2-rpt .rp-v2-rpt-success{border-radius:0 8px 8px 0}\n"
    ".rp-v2-rpt table.rp-v2-rpt-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px;box-shadow:0 1px 3px rgba(15,23,42,.06)}\n"
    ".rp-v2-rpt table.rp-v2-rpt-table th{background:var(--sage);color:var(--green);padding:9px 11px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid var(--green)}\n"
    ".rp-v2-rpt table.rp-v2-rpt-table td{padding:8px 11px;border-bottom:1px solid var(--line);vertical-align:top}\n"
    ".rp-v2-rpt table.rp-v2-rpt-table tr:nth-child(even) td{background:#f8fafc}\n"
    ".rp-v2-rpt table.rp-v2-rpt-table tr:hover td{background:#eef5f1}\n"
    ".rp-v2-tpl-sel{flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font:12px 'Noto Sans SC';background:#fff;color:var(--ink)}\n"
    ".rp-v2-tpl-btn{padding:8px 12px;border:1px solid var(--green);color:var(--green);background:transparent;border-radius:6px;cursor:pointer;font:12px 'Noto Sans SC';white-space:nowrap}\n"
    ".rp-v2-tpl-btn:hover{background:rgba(44,95,138,.08)}"
)
apply_count('R5 report CSS', OLD_CSS, NEW_CSS)

# ---------------- R6: custom template UI ----------------
OLD_TXT = (
    '              <textarea id="rp-v2-custom-prompt" placeholder="例如：重点分析印尼市场关税风险，给出3个潜力新品类推荐，对比Shopee和TikTok Shop的流量成本差异..."></textarea>'
)
NEW_TXT = (
    OLD_TXT + "\n"
    "              <div style=\"display:flex;gap:8px;align-items:center;margin-top:8px\">\n"
    "                <select id=\"rp-v2-tpl-sel\" class=\"rp-v2-tpl-sel\" onchange=\"rpV2ApplyTpl()\">\n"
    "                  <option value=\"\">— 选择已保存模板 —</option>\n"
    "                </select>\n"
    "                <button type=\"button\" class=\"rp-v2-tpl-btn\" onclick=\"rpV2SaveTpl()\">保存当前为模板</button>\n"
    "              </div>\n"
    "              <small>把上方内容保存为可复用模板；选择模板会自动填入。</small>"
)
apply_count('R6 template UI', OLD_TXT, NEW_TXT)

# ---------------- R7: custom template JS ----------------
OLD_HOOK = "// === Watchlist Redesign ==="
NEW_HOOK = (
    "var RP_TPL_KEY = 'mercator_rp_tpls';\n"
    "function rpV2GetTpls(){ try { return JSON.parse(localStorage.getItem(RP_TPL_KEY) || '{}'); } catch(e){ return {}; } }\n"
    "function rpV2LoadTpls(){\n"
    "  var sel = document.getElementById('rp-v2-tpl-sel'); if(!sel) return;\n"
    "  var tpls = rpV2GetTpls();\n"
    "  sel.innerHTML = '<option value=\"\">— 选择已保存模板 —</option>';\n"
    "  Object.keys(tpls).forEach(function(k){\n"
    "    var o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o);\n"
    "  });\n"
    "}\n"
    "function rpV2ApplyTpl(){\n"
    "  var sel = document.getElementById('rp-v2-tpl-sel'); if(!sel || !sel.value) return;\n"
    "  var tpls = rpV2GetTpls();\n"
    "  var v = tpls[sel.value]; if(v == null) return;\n"
    "  var ta = document.getElementById('rp-v2-custom-prompt'); if(ta) ta.value = v;\n"
    "  toast('已应用模板：' + sel.value);\n"
    "}\n"
    "function rpV2SaveTpl(){\n"
    "  var ta = document.getElementById('rp-v2-custom-prompt'); if(!ta) return;\n"
    "  var v = ta.value.trim();\n"
    "  if(!v){ stToast('请先在上方填写要保存的内容'); return; }\n"
    "  var name = window.prompt('模板名称：', '我的模板');\n"
    "  if(!name) return;\n"
    "  name = name.trim(); if(!name) return;\n"
    "  var tpls = rpV2GetTpls(); tpls[name] = v;\n"
    "  localStorage.setItem(RP_TPL_KEY, JSON.stringify(tpls));\n"
    "  rpV2LoadTpls();\n"
    "  var sel = document.getElementById('rp-v2-tpl-sel'); if(sel) sel.value = name;\n"
    "  stToast('模板已保存：' + name);\n"
    "}\n\n"
    + OLD_HOOK
)
apply_count('R7 template JS', OLD_HOOK, NEW_HOOK)

# ---------------- R8: hook into rpV2GoStep ----------------
OLD_STEP = (
    "  if(step===2){\n"
    "    var pool=rpGetPool();\n"
    "    var sel=pool.filter(function(m){return m.selected});\n"
    "    document.getElementById('rp-v2-cfg-count').textContent=sel.length;\n"
    "  }"
)
NEW_STEP = (
    "  if(step===2){\n"
    "    var pool=rpGetPool();\n"
    "    var sel=pool.filter(function(m){return m.selected});\n"
    "    document.getElementById('rp-v2-cfg-count').textContent=sel.length;\n"
    "    rpV2LoadTpls();\n"
    "  }"
)
apply_count('R8 step hook', OLD_STEP, NEW_STEP)

with io.open(PATH, 'w', encoding="utf-8") as f:
    f.write(s)
print('DONE: report enhancement applied')
