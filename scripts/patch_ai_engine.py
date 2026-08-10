# -*- coding: utf-8 -*-
import io, sys

PATH = r"D:\AI工具\mercator-main\index.html"
with io.open(PATH, encoding="utf-8") as f:
    s = f.read()

# ---------------- AI Engine module (DeepSeek, OpenAI-compatible, browser-direct) ----------------
AI_BLOCK = r'''// === AI Engine (DeepSeek, OpenAI-compatible, browser-direct) ===
var AI_ENGINE = {
  provider: 'deepseek',
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  keyStorageKey: 'mercator_deepseek_key',
  getKey: function(){ try { return localStorage.getItem(this.keyStorageKey) || ''; } catch(e){ return ''; } },
  setKey: function(k){ try { localStorage.setItem(this.keyStorageKey, k || ''); return true; } catch(e){ return false; } },
  hasKey: function(){ return !!this.getKey(); }
};
var rpLastReportText = '';
var rpLastReportTitle = '';

// Generic AI call. Throws 'NO_API_KEY' if key missing.
async function callAI(systemPrompt, userPrompt, opts){
  opts = opts || {};
  var key = AI_ENGINE.getKey();
  if(!key){ throw new Error('NO_API_KEY'); }
  var url = AI_ENGINE.baseURL + '/chat/completions';
  var body = {
    model: opts.model || AI_ENGINE.model,
    messages: [
      { role: 'system', content: systemPrompt || '你是跨境电商市场情报分析专家。' },
      { role: 'user', content: userPrompt }
    ],
    temperature: (opts.temperature != null) ? opts.temperature : 0.7,
    max_tokens: opts.max_tokens || 2000,
    stream: false
  };
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, opts.timeout || 60000);
  try {
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if(!resp.ok){
      var errTxt = '';
      try { errTxt = (await resp.text()).slice(0,200); } catch(e){}
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
  var inUl = false, inOl = false;
  function closeLists(){ if(inUl){ html += '</ul>'; inUl = false; } if(inOl){ html += '</ol>'; inOl = false; } }
  lines.forEach(function(line){
    var s = line;
    var hm = s.match(/^(#{1,4})\s+(.*)$/);
    if(hm){ closeLists(); var lvl = hm[1].length; var txt = inlineFmt(hm[2]);
      var tag = lvl >= 3 ? 'h4' : (lvl === 2 ? 'h3' : 'h2');
      html += '<' + tag + '>' + txt + '</' + tag + '>'; return; }
    var um = s.match(/^\s*[-*]\s+(.*)$/);
    if(um){ if(inOl){ html += '</ol>'; inOl = false; } if(!inUl){ html += '<ul>'; inUl = true; }
      html += '<li>' + inlineFmt(um[1]) + '</li>'; return; }
    var om = s.match(/^\s*\d+\.\s+(.*)$/);
    if(om){ if(inUl){ html += '</ul>'; inUl = false; } if(!inOl){ html += '<ol>'; inOl = true; }
      html += '<li>' + inlineFmt(om[1]) + '</li>'; return; }
    var tm = s.match(/^\s*\|(.+)\|\s*$/);
    if(tm){ closeLists();
      var cells = tm[1].split('|').map(function(c){ return c.trim(); });
      html += '<div class="rp-md-row"><span>' + cells.map(inlineFmt).join('</span><span>') + '</span></div>'; return; }
    if(s.trim() === ''){ closeLists(); return; }
    closeLists(); html += '<p>' + inlineFmt(s) + '</p>';
  });
  closeLists();
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

'''

# ---------------- Module 1: real rpV2Generate ----------------
NEW_RP_GEN = r'''function rpV2Generate(){
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
  var system = '你是资深跨境电商市场研究分析师，输出结构化、数据驱动、可落地的市场调研报告。使用中文；涉及具体数据时标注来源，明确区分"事实"与"推断/示意"，不得编造精确数字。';
  var user = '请为以下对象生成一份市场调研报告。\n';
  user += '【调研对象】' + (topic ? topic : '（见素材）') + '\n';
  user += '【数据周期】' + periodLabel + ' 【输出侧重】' + focusLabel + ' 【受众】' + audienceLabel + ' 【格式】' + formatLabel + '\n';
  if(matText) user += '【已选素材】\n' + matText + '\n';
  user += '报告建议包含：一、执行摘要；二、市场规模与增长趋势；三、竞争格局与主要玩家；四、目标用户画像；五、行业痛点与机会；六、风险与合规；七、数据来源说明。';
  if(customText) user += '\n【特别要求】' + customText;
  callAI(system, user, { temperature: 0.7, max_tokens: 2600 })
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
'''

# ---------------- Module 2: execution plan ----------------
NEW_PLAN = r'''
// Module 2: 基于调研报告生成可落地电商执行计划
var rpPlanBusy = false;
async function rpV2GeneratePlan(){
  if(!rpLastReportText){ toast('请先生成市场调研报告'); return; }
  if(rpPlanBusy){ return; }
  if(!AI_ENGINE.hasKey()){ toast('请先在设置中填写 DeepSeek API Key'); openSettingsAI(); return; }
  rpPlanBusy = true;
  showAIModal('电商执行计划', '<div class="rp-v2-generating"><div style="font-size:28px;color:var(--green)">⚡</div><h3 style="margin:12px 0 4px;font-weight:bold;font-size:16px">AI 正在制定执行计划</h3><p style="font-size:12px;color:var(--muted)">基于已生成的调研报告...</p></div>');
  try {
    var system = '你是资深跨境电商运营顾问。基于给定的市场调研报告，输出可落地的电商执行计划。要求分模块：1)选品与SKU规划 2)定价策略 3)渠道布局 4)营销推广与预算ROI 5)供应链与运营关键节点。每项给出具体动作、时间线，并标注其依据的报告中数据点。使用中文、结构化、markdown 格式，输出为可拆解任务清单。';
    var user = '以下是市场调研报告内容：\n\n' + rpLastReportText + '\n\n请基于以上报告，生成可落地的电商执行计划（任务清单格式，尽量可拆解、可追踪）。';
    var plan = await callAI(system, user, { temperature: 0.6, max_tokens: 2600 });
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
'''

# ---------------- Real AI tools (summary/risk/suggest) ----------------
NEW_AI_TOOL = r'''function rpV2AiTool(type){
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
  callAI(sys, usr, { temperature: 0.5, max_tokens: 1200 })
    .then(function(out){ resultEl.innerHTML = '<div class="rp-v2-ai-result">' + renderMarkdownSafe(out) + '</div>'; toast('AI 分析完成'); })
    .catch(function(e){ resultEl.innerHTML = '<div class="rp-v2-ai-result"><p style="color:#ef4444">分析失败：' + (e.message === 'NO_API_KEY' ? '请先填写 API Key' : escapeHtml(e.message)) + '</p></div>'; });
}
'''

# ---------------- HTML injections ----------------
TOPIC_INPUT = r'''            <div class="rp-v2-config-group" style="margin-bottom:16px">
              <label>行业 / 产品（必填其一）</label>
              <input id="rp-v2-topic" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg-soft);color:var(--ink);font-size:13px" placeholder="例如：宠物用品 北美 / 3C配件 东南亚 / 瑜伽服 欧洲">
              <small>输入要调研的行业或具体产品，AI 将据此生成结构化市场调研报告</small>
            </div>'''

PLAN_BTN = r'''                  <button onclick="rpV2GeneratePlan()" style="padding:6px 12px;border:1px solid var(--green);color:var(--green);border-radius:6px;background:transparent;cursor:pointer;font-size:12px">🚀 生成执行计划</button>'''

AI_SETTINGS = r'''<hr class="st-divider">
<h3 class="st-section-title">🤖 AI 引擎（DeepSeek）</h3>
<div class="st-api-grid">
  <div class="st-api-row" style="grid-column:1/-1">
    <label>DeepSeek API Key</label>
    <input class="st-input" id="ai-deepseek-key" type="password" placeholder="sk-...（浏览器直连内测用，发布前请改用服务端代理）">
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
      <button class="st-btn st-btn-primary st-btn-sm" onclick="aiSaveKey()">保存密钥</button>
      <button class="st-btn st-btn-outline st-btn-sm" onclick="aiClearKey()">清除</button>
      <span id="ai-key-status" style="font-size:11px;color:var(--muted)"></span>
    </div>
    <p style="font-size:11px;color:var(--muted);margin:8px 0 0">密钥仅保存在你浏览器本地（localStorage）。浏览器直连适合内测；公开发布前请在 Supabase Edge Function 中代理并改用服务端密钥。</p>
  </div>
</div>'''

# ---------------- Apply replacements ----------------
def apply_count(label, old, new):
    global s
    n = s.count(old)
    if n != 1:
        print('!! EXPECTED 1 but found', n, 'for:', label)
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('OK ', label)

# 1) AI engine module before Watchlist Redesign
apply_count('AI engine block',
    '// === Watchlist Redesign ===',
    AI_BLOCK + '// === Watchlist Redesign ===')

# 2) topic input before config-grid
apply_count('topic input',
    '            <div class="rp-v2-config-grid">',
    TOPIC_INPUT + '\n            <div class="rp-v2-config-grid">')

# 3) plan button after copy button
apply_count('plan button',
    '                  <button onclick="rpV2CopyReport()">📋 复制全文</button>',
    '                  <button onclick="rpV2CopyReport()">📋 复制全文</button>\n' + PLAN_BTN)

# 4) replace rpV2Generate
start = s.index('function rpV2Generate(){')
end = s.index('\nfunction rpV2RenderReport(pool,tplName){')
s = s[:start] + NEW_RP_GEN + '\n' + s[end:]
print('OK  rpV2Generate replaced')

# 5) Module 2 plan function: insert after rpV2RenderReport function (before report history)
ins = s.index('// --- Report History ---')
s = s[:ins] + NEW_PLAN + '\n' + s[ins:]
print('OK  Module 2 plan inserted')

# 6) replace rpV2AiTool
start = s.index('function rpV2AiTool(type){')
end = s.index('\n\n// --- Export ---')
s = s[:start] + NEW_AI_TOOL + s[end:]
print('OK  rpV2AiTool replaced')

# 7) DeepSeek key UI in settings
old_api = '<div class="st-api-row"><label>Amazon SP-API</label><input class="st-input" placeholder="输入 API Key..."></div>\n</div>\n</div>'
apply_count('AI settings UI', old_api,
    '<div class="st-api-row"><label>Amazon SP-API</label><input class="st-input" placeholder="输入 API Key..."></div>\n</div>\n' + AI_SETTINGS + '\n</div>')

# 8) init key UI on settings open
apply_count('settings init hook',
    "if(name==='settings'){stInit();}",
    "if(name==='settings'){stInit();aiInitKeyUI();}")

with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(s)
print('DONE: all patches applied')
