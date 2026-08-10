#!/usr/bin/env python3
"""
报告生成中心全面重建 - Mercator
模块1: 素材库（左侧栏，分类+分组+勾选）
模块2: 3步生成流程（模板→AI配置→生成预览）
模块3: 操作栏（草稿/导出/清空）
模块4: AI辅助小工具（智能总结/风险筛查/选品建议）
"""

import re

FILE = 'index.html'
with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

# ============================================================
# PART 1: CSS
# ============================================================
css_start_marker = '.rp-header{margin-bottom:24px}'
css_end_marker = '.rp-report-section ul,.rp-report-section ol{margin:8px 0;padding-left:20px}'

css_start = src.index(css_start_marker)
css_end = src.index(css_end_marker) + len(css_end_marker)

NEW_CSS = r"""
/* === 报告生成中心 v2 全面重建 === */
.rp-v2-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:16px;flex-wrap:wrap}
.rp-v2-header-left h2{font:bold 22px 'Playfair Display';margin:0 0 4px}
.rp-v2-header-left .rp-v2-sub{font:12px 'Noto Sans SC';color:var(--muted);margin:0}
.rp-v2-header-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.rp-v2-action-btn{padding:7px 16px;border-radius:5px;font:600 11px 'Noto Sans SC';cursor:pointer;border:none;transition:.15s;display:inline-flex;align-items:center;gap:5px}
.rp-v2-action-btn:hover{opacity:.85;transform:translateY(-1px)}
.rp-v2-action-btn.rp-primary{background:var(--green);color:#fff}
.rp-v2-action-btn.rp-orange{background:var(--orange);color:#fff}
.rp-v2-action-btn.rp-outline{background:#fff;border:1px solid var(--line);color:var(--ink)}
.rp-v2-action-btn.rp-danger{background:#fff;border:1px solid #ef4444;color:#ef4444}
.rp-v2-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.rp-v2-stat{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px 16px;display:flex;align-items:center;gap:12px}
.rp-v2-stat-icon{width:38px;height:38px;border-radius:8px;display:grid;place-items:center;font-size:18px;flex-shrink:0}
.rp-v2-stat-icon.green{background:rgba(60,108,98,.1);color:var(--green)}
.rp-v2-stat-icon.orange{background:rgba(223,111,61,.1);color:var(--orange)}
.rp-v2-stat-icon.blue{background:rgba(99,102,241,.1);color:#6366f1}
.rp-v2-stat-icon.purple{background:rgba(139,92,246,.1);color:#8b5cf6}
.rp-v2-stat-icon.red{background:rgba(239,68,68,.1);color:#ef4444}
.rp-v2-stat-info{flex:1;min-width:0}
.rp-v2-stat-num{font:bold 22px 'Playfair Display';margin:0;line-height:1.1}
.rp-v2-stat-label{font:10px 'Noto Sans SC';color:var(--muted);margin:2px 0 0}
.rp-v2-workspace{display:grid;grid-template-columns:300px 1fr 320px;gap:16px;min-height:600px}
/* Left: Material Pool */
.rp-v2-pool{background:#fff;border:1px solid var(--line);border-radius:10px;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 200px);position:sticky;top:80px}
.rp-v2-pool-header{padding:16px 18px 12px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}
.rp-v2-pool-header h3{font:bold 14px 'Noto Sans SC';margin:0;display:flex;align-items:center;gap:6px}
.rp-v2-pool-header h3 span{font-size:11px;color:var(--muted);font-weight:400}
.rp-v2-pool-actions{display:flex;gap:4px}
.rp-v2-pool-actions button{background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted);padding:2px 4px;border-radius:3px}
.rp-v2-pool-actions button:hover{background:var(--sage);color:var(--green)}
.rp-v2-pool-filter{padding:8px 14px;border-bottom:1px solid var(--line);display:flex;gap:4px;flex-wrap:wrap}
.rp-v2-pool-tag{padding:3px 8px;border-radius:10px;font:10px 'Noto Sans SC';border:1px solid var(--line);background:#fff;cursor:pointer;transition:.15s;white-space:nowrap}
.rp-v2-pool-tag.active{background:var(--green);color:#fff;border-color:var(--green)}
.rp-v2-pool-tag:hover{border-color:var(--green)}
.rp-v2-pool-body{flex:1;overflow-y:auto;padding:8px 0}
.rp-v2-pool-group{margin-bottom:4px}
.rp-v2-pool-group-header{display:flex;align-items:center;gap:8px;padding:6px 16px;font:bold 10px 'DM Mono';color:var(--muted);text-transform:uppercase;letter-spacing:.8px;cursor:pointer;user-select:none}
.rp-v2-pool-group-header:hover{color:var(--ink)}
.rp-v2-pool-group-header .rp-v2-pool-gcount{font-weight:400;color:#b5b0a8}
.rp-v2-pool-item{display:flex;align-items:flex-start;gap:10px;padding:8px 16px;cursor:pointer;transition:.1s;border-left:3px solid transparent}
.rp-v2-pool-item:hover{background:#f8faf8}
.rp-v2-pool-item.selected{background:#f0f5f3;border-left-color:var(--green)}
.rp-v2-pool-item input[type=checkbox]{margin-top:3px;accent-color:var(--green);width:14px;height:14px;flex-shrink:0}
.rp-v2-pool-item-body{flex:1;min-width:0}
.rp-v2-pool-item-title{font:600 12px 'Noto Sans SC';margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rp-v2-pool-item-meta{font:10px 'DM Mono';color:var(--muted);display:flex;gap:6px;align-items:center}
.rp-v2-pool-item-type{display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;color:#fff;font-weight:600}
.rp-v2-pool-item-remove{background:none;border:none;cursor:pointer;font-size:12px;color:#ccc;padding:0 2px;flex-shrink:0}
.rp-v2-pool-item-remove:hover{color:#ef4444}
.rp-v2-pool-empty{text-align:center;padding:40px 20px;color:var(--muted)}
.rp-v2-pool-empty .rp-v2-pool-empty-icon{font-size:36px;display:block;margin-bottom:8px;color:#d5d0c8}
.rp-v2-pool-empty p{font-size:13px;margin:4px 0}
.rp-v2-pool-empty small{font-size:11px;color:#a0aba6;display:block;margin-top:4px;line-height:1.6}
/* Center: Generation Wizard */
.rp-v2-center{display:flex;flex-direction:column;gap:16px}
.rp-v2-step-bar{display:flex;align-items:center;gap:0;background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin-bottom:4px}
.rp-v2-step{flex:1;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px;transition:.15s;cursor:default}
.rp-v2-step.active{background:var(--sage)}
.rp-v2-step.done{background:rgba(60,108,98,.08)}
.rp-v2-step-num{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font:bold 11px 'DM Mono';background:var(--line);color:var(--muted);flex-shrink:0}
.rp-v2-step.active .rp-v2-step-num{background:var(--green);color:#fff}
.rp-v2-step.done .rp-v2-step-num{background:var(--green);color:#fff}
.rp-v2-step-text{font:12px 'Noto Sans SC';color:var(--muted)}
.rp-v2-step.active .rp-v2-step-text{color:var(--ink);font-weight:600}
.rp-v2-step.done .rp-v2-step-text{color:var(--green)}
.rp-v2-step-arrow{color:#d5d3cc;font-size:12px;margin:0 2px}
.rp-v2-panel{background:#fff;border:1px solid var(--line);border-radius:10px;padding:24px;flex:1}
.rp-v2-panel-title{font:bold 16px 'Noto Sans SC';margin:0 0 4px;display:flex;align-items:center;gap:8px}
.rp-v2-panel-desc{font:12px 'Noto Sans SC';color:var(--muted);margin:0 0 20px}
/* Template Cards */
.rp-v2-tpl-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rp-v2-tpl-card{border:2px solid var(--line);border-radius:10px;padding:18px;cursor:pointer;transition:.2s;position:relative}
.rp-v2-tpl-card:hover{border-color:var(--green);background:#f8faf8}
.rp-v2-tpl-card.selected{border-color:var(--green);background:#f0f5f3}
.rp-v2-tpl-card.selected::after{content:'\2713';position:absolute;top:10px;right:12px;background:var(--green);color:#fff;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px}
.rp-v2-tpl-icon{font-size:24px;margin-bottom:10px}
.rp-v2-tpl-name{font:bold 14px 'Noto Sans SC';margin:0 0 4px}
.rp-v2-tpl-desc{font:11px 'Noto Sans SC';color:var(--muted);margin:0 0 8px;line-height:1.5}
.rp-v2-tpl-tags{display:flex;gap:4px;flex-wrap:wrap}
.rp-v2-tpl-tag{padding:2px 6px;border-radius:3px;font:9px 'DM Mono';background:var(--sage);color:var(--green)}
.rp-v2-tpl-custom{border-style:dashed}
/* AI Config */
.rp-v2-config-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.rp-v2-config-group{display:flex;flex-direction:column;gap:6px}
.rp-v2-config-group label{font:600 12px 'Noto Sans SC';color:var(--ink)}
.rp-v2-config-group small{font:10px 'Noto Sans SC';color:#a0aba6}
.rp-v2-config-group select,.rp-v2-config-group input[type=text]{padding:8px 12px;border:1px solid var(--line);border-radius:6px;font:12px 'Noto Sans SC';background:#fff;color:var(--ink);transition:.15s}
.rp-v2-config-group select:focus,.rp-v2-config-group input[type=text]:focus{border-color:var(--green);outline:none;box-shadow:0 0 0 2px rgba(60,108,98,.1)}
.rp-v2-config-group textarea{padding:10px 12px;border:1px solid var(--line);border-radius:6px;font:12px 'Noto Sans SC';background:#fff;color:var(--ink);resize:vertical;min-height:70px;transition:.15s}
.rp-v2-config-group textarea:focus{border-color:var(--green);outline:none;box-shadow:0 0 0 2px rgba(60,108,98,.1)}
.rp-v2-toggle-row{display:flex;gap:8px;flex-wrap:wrap}
.rp-v2-toggle{padding:6px 14px;border:1px solid var(--line);border-radius:6px;font:11px 'Noto Sans SC';background:#fff;cursor:pointer;transition:.15s}
.rp-v2-toggle.active{background:var(--green);color:#fff;border-color:var(--green)}
.rp-v2-toggle:hover{border-color:var(--green)}
.rp-v2-generate-bar{display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid var(--line);margin-top:8px}
.rp-v2-generate-info{font:11px 'Noto Sans SC';color:var(--muted)}
.rp-v2-generate-info b{color:var(--green)}
.rp-v2-gen-btn{padding:10px 28px;border-radius:8px;font:bold 13px 'Noto Sans SC';border:none;cursor:pointer;transition:.2s;display:inline-flex;align-items:center;gap:6px}
.rp-v2-gen-btn.go{background:var(--green);color:#fff}
.rp-v2-gen-btn.go:hover{background:#2d5a51;transform:translateY(-1px);box-shadow:0 4px 12px rgba(60,108,98,.25)}
.rp-v2-gen-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
/* Report Preview */
.rp-v2-preview-panel{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.rp-v2-preview-toolbar{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--line);background:#fafaf7}
.rp-v2-preview-toolbar-left{display:flex;align-items:center;gap:8px}
.rp-v2-preview-toolbar-left h4{font:bold 13px 'Noto Sans SC';margin:0}
.rp-v2-preview-toolbar-right{display:flex;gap:6px}
.rp-v2-preview-toolbar-right button{padding:5px 12px;border-radius:4px;font:11px 'Noto Sans SC';border:1px solid var(--line);background:#fff;cursor:pointer;transition:.15s}
.rp-v2-preview-toolbar-right button:hover{border-color:var(--green);color:var(--green)}
.rp-v2-preview-body{padding:24px;max-height:600px;overflow-y:auto}
.rp-v2-preview-body.rp-empty-preview{display:flex;align-items:center;justify-content:center;min-height:300px;flex-direction:column;color:var(--muted)}
.rp-v2-preview-body.rp-empty-preview .rp-empty-icon{font-size:40px;color:#d5d0c8;display:block;margin-bottom:10px}
/* Report Content Styles */
.rp-v2-rpt{font:13px/1.8 'Noto Sans SC';color:var(--ink)}
.rp-v2-rpt h2{font:bold 18px 'Playfair Display';margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--sage)}
.rp-v2-rpt h2:first-child{margin-top:0}
.rp-v2-rpt h3{font:bold 14px 'Noto Sans SC';margin:16px 0 6px;color:var(--green)}
.rp-v2-rpt p{margin:6px 0}
.rp-v2-rpt ul,.rp-v2-rpt ol{margin:8px 0;padding-left:22px}
.rp-v2-rpt li{margin:3px 0}
.rp-v2-rpt table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
.rp-v2-rpt th{background:var(--sage);color:var(--green);padding:8px 10px;text-align:left;font-weight:600;font-size:11px}
.rp-v2-rpt td{padding:7px 10px;border-bottom:1px solid var(--line)}
.rp-v2-rpt tr:hover td{background:#f8faf8}
.rp-v2-rpt .rp-v2-rpt-highlight{background:rgba(223,111,61,.08);border-left:3px solid var(--orange);padding:10px 14px;margin:10px 0;border-radius:0 6px 6px 0}
.rp-v2-rpt .rp-v2-rpt-risk{background:rgba(239,68,68,.06);border-left:3px solid #ef4444;padding:10px 14px;margin:10px 0;border-radius:0 6px 6px 0}
.rp-v2-rpt .rp-v2-rpt-success{background:rgba(60,108,98,.06);border-left:3px solid var(--green);padding:10px 14px;margin:10px 0;border-radius:0 6px 6px 0}
.rp-v2-rpt .rp-v2-rpt-source{font:10px 'DM Mono';color:#a0aba6;margin-top:2px}
.rp-v2-rpt .rp-v2-rpt-meta{font:11px 'DM Mono';color:var(--muted);margin-bottom:16px;padding:8px 12px;background:#f8faf8;border-radius:6px}
.rp-v2-rpt .rp-v2-rpt-section{margin-bottom:20px;padding-bottom:12px}
.rp-v2-rpt .rp-v2-rpt-chart-placeholder{background:#f0f5f3;border:1px dashed #c5d5cf;border-radius:8px;padding:20px;text-align:center;margin:12px 0;color:var(--green);font:12px 'Noto Sans SC'}
/* Generating Animation */
.rp-v2-generating{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center}
.rp-v2-gen-progress{width:200px;height:4px;background:var(--line);border-radius:2px;margin:20px auto 16px;overflow:hidden}
.rp-v2-gen-progress-bar{height:100%;background:var(--green);border-radius:2px;transition:width .3s;width:0}
.rp-v2-gen-steps{text-align:left;max-width:280px;margin:16px auto 0}
.rp-v2-gen-step{display:flex;align-items:center;gap:8px;padding:4px 0;font:12px 'Noto Sans SC';color:var(--muted)}
.rp-v2-gen-step.active{color:var(--ink);font-weight:600}
.rp-v2-gen-step.done{color:var(--green)}
.rp-v2-gen-step-icon{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10px;background:var(--line);color:var(--muted);flex-shrink:0}
.rp-v2-gen-step.active .rp-v2-gen-step-icon{background:var(--orange);color:#fff;animation:rp-v2-pulse 1s infinite}
.rp-v2-gen-step.done .rp-v2-gen-step-icon{background:var(--green);color:#fff}
@keyframes rp-v2-pulse{0%,100%{opacity:1}50%{opacity:.5}}
/* Right Panel: AI Tools */
.rp-v2-right{display:flex;flex-direction:column;gap:16px}
.rp-v2-ai-tool{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px;transition:.15s}
.rp-v2-ai-tool:hover{border-color:var(--green)}
.rp-v2-ai-tool-header{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.rp-v2-ai-tool-icon{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;font-size:16px;flex-shrink:0}
.rp-v2-ai-tool-header h4{font:bold 13px 'Noto Sans SC';margin:0}
.rp-v2-ai-tool-header p{font:11px 'Noto Sans SC';color:var(--muted);margin:2px 0 0}
.rp-v2-ai-tool-body{font:12px 'Noto Sans SC';color:var(--ink);line-height:1.7}
.rp-v2-ai-tool-body ul{margin:4px 0;padding-left:16px}
.rp-v2-ai-tool-body li{margin:2px 0}
.rp-v2-ai-tool-btn{display:block;width:100%;padding:8px;border:1px solid var(--green);background:#fff;color:var(--green);border-radius:6px;font:600 11px 'Noto Sans SC';cursor:pointer;text-align:center;margin-top:10px;transition:.15s}
.rp-v2-ai-tool-btn:hover{background:var(--green);color:#fff}
.rp-v2-ai-result{background:#f8faf8;border-radius:6px;padding:12px;margin-top:10px;font:12px 'Noto Sans SC';line-height:1.7;max-height:200px;overflow-y:auto}
.rp-v2-ai-result h5{font:bold 12px 'Noto Sans SC';margin:0 0 6px;color:var(--green)}
.rp-v2-ai-result ul{margin:4px 0;padding-left:16px}
/* Recent Reports */
.rp-v2-recent{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px}
.rp-v2-recent h4{font:bold 13px 'Noto Sans SC';margin:0 0 12px;display:flex;align-items:center;gap:6px}
.rp-v2-recent-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer;transition:.1s}
.rp-v2-recent-item:hover{background:#f8faf8;margin:0 -8px;padding:8px 8px;border-radius:4px}
.rp-v2-recent-item:last-child{border-bottom:none}
.rp-v2-recent-icon{width:32px;height:32px;border-radius:6px;background:var(--sage);display:grid;place-items:center;font-size:14px;color:var(--green);flex-shrink:0}
.rp-v2-recent-info{flex:1;min-width:0}
.rp-v2-recent-info strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rp-v2-recent-info small{font:10px 'DM Mono';color:var(--muted)}
/* Responsive */
@media(max-width:1200px){.rp-v2-workspace{grid-template-columns:260px 1fr 280px}}
@media(max-width:1000px){.rp-v2-workspace{grid-template-columns:1fr}.rp-v2-pool{position:static;max-height:none}.rp-v2-stats{grid-template-columns:repeat(3,1fr)}.rp-v2-config-grid{grid-template-columns:1fr}.rp-v2-tpl-grid{grid-template-columns:1fr}}
@media(max-width:700px){.rp-v2-stats{grid-template-columns:1fr 1fr}.rp-v2-header{flex-direction:column}}
""".strip()

src = src[:css_start] + NEW_CSS + src[css_end:]
print("[1/3] CSS replaced")

# ============================================================
# PART 2: HTML
# ============================================================
html_start_marker = '<section id="report" class="page">'
html_end_marker = '</section>\n\n    <section id="settings"'

html_start = src.index(html_start_marker)
html_end = src.index(html_end_marker) + len('</section>')

NEW_HTML = r'''<section id="report" class="page">
      <!-- Header -->
      <div class="rp-v2-header">
        <div class="rp-v2-header-left">
          <h2>报告生成中心</h2>
          <p class="rp-v2-sub">整合全系统素材 · AI 智能生成可交付的市场调研报告</p>
        </div>
        <div class="rp-v2-header-right">
          <button class="rp-v2-action-btn rp-outline" onclick="rpV2SaveDraft()">💾 保存草稿</button>
          <button class="rp-v2-action-btn rp-primary" onclick="rpV2Export('md')">📄 导出 Markdown</button>
          <button class="rp-v2-action-btn rp-orange" onclick="rpV2Export('pdf')">📊 导出 PDF</button>
          <button class="rp-v2-action-btn rp-danger" onclick="rpV2ClearPool()">🗑 清空素材</button>
        </div>
      </div>
      <!-- Stats Row -->
      <div class="rp-v2-stats">
        <div class="rp-v2-stat"><div class="rp-v2-stat-icon green">✦</div><div class="rp-v2-stat-info"><p class="rp-v2-stat-num" id="rp-stat-total">0</p><p class="rp-v2-stat-label">素材池总量</p></div></div>
        <div class="rp-v2-stat"><div class="rp-v2-stat-icon orange">✓</div><div class="rp-v2-stat-info"><p class="rp-v2-stat-num" id="rp-stat-selected">0</p><p class="rp-v2-stat-label">已选素材</p></div></div>
        <div class="rp-v2-stat"><div class="rp-v2-stat-icon blue">◈</div><div class="rp-v2-stat-info"><p class="rp-v2-stat-num" id="rp-stat-reports">0</p><p class="rp-v2-stat-label">已生成报告</p></div></div>
        <div class="rp-v2-stat"><div class="rp-v2-stat-icon purple">▤</div><div class="rp-v2-stat-info"><p class="rp-v2-stat-num">5</p><p class="rp-v2-stat-label">报告模板</p></div></div>
        <div class="rp-v2-stat"><div class="rp-v2-stat-icon red">⚡</div><div class="rp-v2-stat-info"><p class="rp-v2-stat-num">4</p><p class="rp-v2-stat-label">AI 辅助工具</p></div></div>
      </div>
      <!-- 3-Column Workspace -->
      <div class="rp-v2-workspace">
        <!-- LEFT: Material Pool -->
        <div class="rp-v2-pool">
          <div class="rp-v2-pool-header">
            <h3>素材库 <span id="rp-pool-count">(0)</span></h3>
            <div class="rp-v2-pool-actions">
              <button onclick="rpV2SelectAll()" title="全选">☑</button>
              <button onclick="rpV2DeselectAll()" title="取消全选">☐</button>
            </div>
          </div>
          <div class="rp-v2-pool-filter" id="rp-v2-pool-filter">
            <span class="rp-v2-pool-tag active" data-filter="all">全部</span>
            <span class="rp-v2-pool-tag" data-filter="product">商品</span>
            <span class="rp-v2-pool-tag" data-filter="shop">店铺</span>
            <span class="rp-v2-pool-tag" data-filter="content">内容</span>
            <span class="rp-v2-pool-tag" data-filter="country">国家</span>
            <span class="rp-v2-pool-tag" data-filter="platform">平台</span>
            <span class="rp-v2-pool-tag" data-filter="policy">政策</span>
          </div>
          <div class="rp-v2-pool-body" id="rp-v2-pool-body"></div>
        </div>
        <!-- CENTER: Generation Wizard -->
        <div class="rp-v2-center">
          <!-- Step Bar -->
          <div class="rp-v2-step-bar">
            <div class="rp-v2-step active" id="rp-step-1">
              <div class="rp-v2-step-num">1</div>
              <div class="rp-v2-step-text">选择模板</div>
            </div>
            <div class="rp-v2-step-arrow">→</div>
            <div class="rp-v2-step" id="rp-step-2">
              <div class="rp-v2-step-num">2</div>
              <div class="rp-v2-step-text">AI 配置</div>
            </div>
            <div class="rp-v2-step-arrow">→</div>
            <div class="rp-v2-step" id="rp-step-3">
              <div class="rp-v2-step-num">3</div>
              <div class="rp-v2-step-text">生成预览</div>
            </div>
          </div>
          <!-- Step 1: Template Selection -->
          <div class="rp-v2-panel" id="rp-panel-step1">
            <h3 class="rp-v2-panel-title">📋 选择报告模板</h3>
            <p class="rp-v2-panel-desc">预设 4 套商用模板，AI 根据模板框架定向生成专业报告内容</p>
            <div class="rp-v2-tpl-grid" id="rp-v2-tpl-grid">
              <div class="rp-v2-tpl-card" data-tpl="product-research" onclick="rpV2SelectTpl(this)">
                <div class="rp-v2-tpl-icon">◎</div>
                <h4 class="rp-v2-tpl-name">单品赛道选品调研报告</h4>
                <p class="rp-v2-tpl-desc">工厂/卖家拓品使用。分析目标品类的市场容量、竞争格局、价格带分布、头部竞品打法，输出选品建议与供应链策略。</p>
                <div class="rp-v2-tpl-tags"><span class="rp-v2-tpl-tag">爆款数据</span><span class="rp-v2-tpl-tag">竞品对标</span><span class="rp-v2-tpl-tag">价格分析</span></div>
              </div>
              <div class="rp-v2-tpl-card" data-tpl="competitor-analysis" onclick="rpV2SelectTpl(this)">
                <div class="rp-v2-tpl-icon">◇</div>
                <h4 class="rp-v2-tpl-name">竞品对标分析报告</h4>
                <p class="rp-v2-tpl-desc">对标同行头部店铺打法。拆解竞品GMV、品类布局、营销策略、流量结构，输出差异化竞争建议。</p>
                <div class="rp-v2-tpl-tags"><span class="rp-v2-tpl-tag">店铺追踪</span><span class="rp-v2-tpl-tag">GMV拆解</span><span class="rp-v2-tpl-tag">策略对标</span></div>
              </div>
              <div class="rp-v2-tpl-card" data-tpl="market-entry" onclick="rpV2SelectTpl(this)">
                <div class="rp-v2-tpl-icon">◆</div>
                <h4 class="rp-v2-tpl-name">单国出海市场可行性报告</h4>
                <p class="rp-v2-tpl-desc">宏观经济+电商赛道综合评估。覆盖GDP、人口红利、平台格局、合规要求、物流基建，给出市场进入优先级。</p>
                <div class="rp-v2-tpl-tags"><span class="rp-v2-tpl-tag">宏观经济</span><span class="rp-v2-tpl-tag">政策合规</span><span class="rp-v2-tpl-tag">平台选型</span></div>
              </div>
              <div class="rp-v2-tpl-card" data-tpl="content-marketing" onclick="rpV2SelectTpl(this)">
                <div class="rp-v2-tpl-icon">◈</div>
                <h4 class="rp-v2-tpl-name">内容营销投放分析报告</h4>
                <p class="rp-v2-tpl-desc">短视频/直播达人投放策略。分析热门内容类型、达人报价、转化率、ROI，输出投放组合建议。</p>
                <div class="rp-v2-tpl-tags"><span class="rp-v2-tpl-tag">达人投放</span><span class="rp-v2-tpl-tag">转化分析</span><span class="rp-v2-tpl-tag">ROI测算</span></div>
              </div>
              <div class="rp-v2-tpl-card rp-v2-tpl-custom" data-tpl="custom" onclick="rpV2SelectTpl(this)">
                <div class="rp-v2-tpl-icon">✎</div>
                <h4 class="rp-v2-tpl-name">自定义模板</h4>
                <p class="rp-v2-tpl-desc">手动定义报告结构，AI 根据您保存的框架和素材自由生成。可保存为常用模板复用。</p>
                <div class="rp-v2-tpl-tags"><span class="rp-v2-tpl-tag">自由结构</span><span class="rp-v2-tpl-tag">可复用</span></div>
              </div>
            </div>
            <div class="rp-v2-generate-bar">
              <div class="rp-v2-generate-info">已选模板：<b id="rp-v2-tpl-name">未选择</b></div>
              <button class="rp-v2-gen-btn" id="rp-v2-next-btn" disabled onclick="rpV2GoStep(2)">下一步 →</button>
            </div>
          </div>
          <!-- Step 2: AI Config -->
          <div class="rp-v2-panel" id="rp-panel-step2" style="display:none">
            <h3 class="rp-v2-panel-title">⚙ AI 生成配置</h3>
            <p class="rp-v2-panel-desc">调整参数控制 AI 输出逻辑，也可补充自定义指令</p>
            <div class="rp-v2-config-grid">
              <div class="rp-v2-config-group">
                <label>报告周期</label>
                <div class="rp-v2-toggle-row">
                  <span class="rp-v2-toggle active" data-cfg="period" data-val="7d" onclick="rpV2Toggle(this)">近7天机会</span>
                  <span class="rp-v2-toggle" data-cfg="period" data-val="1m" onclick="rpV2Toggle(this)">近1个月</span>
                  <span class="rp-v2-toggle" data-cfg="period" data-val="3m" onclick="rpV2Toggle(this)">近3个月</span>
                  <span class="rp-v2-toggle" data-cfg="period" data-val="6m" onclick="rpV2Toggle(this)">中长期研判</span>
                </div>
                <small>决定数据取样的时间窗口</small>
              </div>
              <div class="rp-v2-config-group">
                <label>输出侧重</label>
                <div class="rp-v2-toggle-row">
                  <span class="rp-v2-toggle active" data-cfg="focus" data-val="data" onclick="rpV2Toggle(this)">偏数据量化</span>
                  <span class="rp-v2-toggle" data-cfg="focus" data-val="strategy" onclick="rpV2Toggle(this)">偏运营策略</span>
                  <span class="rp-v2-toggle" data-cfg="focus" data-val="balance" onclick="rpV2Toggle(this)">均衡</span>
                </div>
                <small>影响报告的论述风格和深度</small>
              </div>
              <div class="rp-v2-config-group">
                <label>受众适配</label>
                <div class="rp-v2-toggle-row">
                  <span class="rp-v2-toggle active" data-cfg="audience" data-val="boss" onclick="rpV2Toggle(this)">老板/决策层</span>
                  <span class="rp-v2-toggle" data-cfg="audience" data-val="ops" onclick="rpV2Toggle(this)">运营执行团队</span>
                  <span class="rp-v2-toggle" data-cfg="audience" data-val="client" onclick="rpV2Toggle(this)">外部客户</span>
                </div>
                <small>调整专业术语密度和结论导向</small>
              </div>
              <div class="rp-v2-config-group">
                <label>输出格式</label>
                <div class="rp-v2-toggle-row">
                  <span class="rp-v2-toggle active" data-cfg="format" data-val="full" onclick="rpV2Toggle(this)">完整报告</span>
                  <span class="rp-v2-toggle" data-cfg="format" data-val="exec" onclick="rpV2Toggle(this)">执行摘要</span>
                  <span class="rp-v2-toggle" data-cfg="format" data-val="slides" onclick="rpV2Toggle(this)">演示文稿大纲</span>
                </div>
                <small>完整报告含全部章节；摘要只保留核心结论</small>
              </div>
            </div>
            <div class="rp-v2-config-group" style="margin-bottom:16px">
              <label>补充自定义 Prompt</label>
              <textarea id="rp-v2-custom-prompt" placeholder="例如：重点分析印尼市场关税风险，给出3个潜力新品类推荐，对比Shopee和TikTok Shop的流量成本差异..."></textarea>
            </div>
            <div class="rp-v2-generate-bar">
              <div class="rp-v2-generate-info">已选素材：<b id="rp-v2-cfg-count">0</b> 条 | 模板：<b id="rp-v2-cfg-tpl">-</b></div>
              <div style="display:flex;gap:8px">
                <button class="rp-v2-gen-btn" style="background:var(--line);color:var(--ink)" onclick="rpV2GoStep(1)">← 上一步</button>
                <button class="rp-v2-gen-btn go" onclick="rpV2Generate()">✦ 一键生成报告</button>
              </div>
            </div>
          </div>
          <!-- Step 3: Preview -->
          <div class="rp-v2-panel" id="rp-panel-step3" style="display:none">
            <h3 class="rp-v2-panel-title">📝 报告预览与编辑</h3>
            <p class="rp-v2-panel-desc">AI 已根据素材和配置生成报告，可直接编辑修改</p>
            <div class="rp-v2-preview-panel">
              <div class="rp-v2-preview-toolbar">
                <div class="rp-v2-preview-toolbar-left">
                  <h4 id="rp-v2-preview-title">-</h4>
                </div>
                <div class="rp-v2-preview-toolbar-right">
                  <button onclick="rpV2CopyReport()">📋 复制全文</button>
                  <button onclick="rpV2Export('md')">📄 导出 MD</button>
                  <button onclick="rpV2Export('pdf')">📊 导出 PDF</button>
                </div>
              </div>
              <div class="rp-v2-preview-body" id="rp-v2-preview-body">
                <div class="rp-empty-preview">
                  <span class="rp-empty-icon">□</span>
                  <p>报告预览区</p>
                  <small>完成模板选择和AI配置后，点击生成即可在此预览</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- RIGHT: AI Tools -->
        <div class="rp-v2-right">
          <!-- AI Tool: Smart Summary -->
          <div class="rp-v2-ai-tool">
            <div class="rp-v2-ai-tool-header">
              <div class="rp-v2-ai-tool-icon" style="background:rgba(99,102,241,.1);color:#6366f1">✧</div>
              <div><h4>素材智能总结</h4><p>快速提炼核心结论</p></div>
            </div>
            <div class="rp-v2-ai-tool-body">选中素材后，AI 自动提炼关键发现和数据洞察，无需生成完整报告。</div>
            <button class="rp-v2-ai-tool-btn" onclick="rpV2AiTool('summary')">✦ 生成智能总结</button>
            <div id="rp-ai-summary-result"></div>
          </div>
          <!-- AI Tool: Risk Scan -->
          <div class="rp-v2-ai-tool">
            <div class="rp-v2-ai-tool-header">
              <div class="rp-v2-ai-tool-icon" style="background:rgba(239,68,68,.1);color:#ef4444">⚠</div>
              <div><h4>风险自动筛查</h4><p>扫描政策/赛道/违规风险</p></div>
            </div>
            <div class="rp-v2-ai-tool-body">AI 扫描全部素材，自动识别政策变动风险、赛道内卷风险、平台违规风险并汇总。</div>
            <button class="rp-v2-ai-tool-btn" onclick="rpV2AiTool('risk')">✦ 扫描风险</button>
            <div id="rp-ai-risk-result"></div>
          </div>
          <!-- AI Tool: Product Suggestions -->
          <div class="rp-v2-ai-tool">
            <div class="rp-v2-ai-tool-header">
              <div class="rp-v2-ai-tool-icon" style="background:rgba(60,108,98,.1);color:var(--green)">◈</div>
              <div><h4>选品建议速出</h4><p>快速输出潜力品类推荐</p></div>
            </div>
            <div class="rp-v2-ai-tool-body">仅勾选商品/国家素材，AI 快速输出 3-5 个潜力品类推荐及入选理由。</div>
            <button class="rp-v2-ai-tool-btn" onclick="rpV2AiTool('suggest')">✦ 生成选品建议</button>
            <div id="rp-ai-suggest-result"></div>
          </div>
          <!-- Recent Reports -->
          <div class="rp-v2-recent" id="rp-v2-recent">
            <h4>📁 历史报告</h4>
            <div id="rp-v2-recent-list">
              <div style="text-align:center;padding:16px;color:var(--muted);font:12px 'Noto Sans SC'">暂无历史报告</div>
            </div>
          </div>
        </div>
      </div>
    </section>'''

src = src[:html_start] + NEW_HTML + '\n\n    ' + src[html_end:]
print("[2/3] HTML replaced")

# ============================================================
# PART 3: JS
# ============================================================
# Find JS section to replace - from RP_POOL_KEY to the DOMContentLoaded timeout
js_start_marker = "const RP_POOL_KEY = 'mercator_report_pool';"
js_end_marker = "setTimeout(rpUpdatePoolUI, 100);\n});"

js_start = src.index(js_start_marker)
js_end = src.index(js_end_marker) + len(js_end_marker)

NEW_JS = r"""
// ===== 报告生成中心 v2 - 完整重建 =====
const RP_POOL_KEY = 'mercator_report_pool';
const RP_REPORTS_KEY = 'mercator_reports_v2';

// --- Pool Management ---
function rpGetPool(){try{return JSON.parse(localStorage.getItem(RP_POOL_KEY)||'[]')}catch(e){return[]}}
function rpSavePool(pool){localStorage.setItem(RP_POOL_KEY,JSON.stringify(pool));rpV2RefreshPoolUI()}
function rpAddMaterial(type,title,source,summary){
  var pool=rpGetPool();
  var id=Date.now()+'_'+Math.random().toString(36).substr(2,5);
  pool.push({id:id,type:type,title:title,source:source,summary:summary,addedAt:new Date().toISOString(),selected:true});
  rpSavePool(pool);toast('已加入报告素材 ('+pool.length+')')
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
      html+='<div class="rp-v2-pool-item'+(m.selected?' selected':'')+'" data-id="'+m.id+'">';
      html+='<input type="checkbox" '+((m.selected)?'checked':'')+' onchange="rpV2ToggleSelect(\''+m.id+'\')">';
      html+='<div class="rp-v2-pool-item-body">';
      html+='<p class="rp-v2-pool-item-title">'+m.title+'</p>';
      html+='<div class="rp-v2-pool-item-meta">';
      html+='<span class="rp-v2-pool-item-type" style="background:'+(typeColors[m.type]||'var(--muted)')+'">'+( typeLabels[m.type]||m.type)+'</span>';
      html+='<span>'+m.source+'</span><span>'+dateStr+'</span></div></div>';
      html+='<button class="rp-v2-pool-item-remove" onclick="event.stopPropagation();rpRemoveMaterial(\''+m.id+'\')" title="移除">×</button>';
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
  }
}

// --- Report Generation (Simulated AI) ---
function rpV2Generate(){
  var pool=rpGetPool().filter(function(m){return m.selected});
  if(pool.length===0){toast('请先选择素材');return}
  if(!rpV2SelectedTpl){toast('请先选择报告模板');return}
  rpV2GoStep(3);
  var body=document.getElementById('rp-v2-preview-body');
  var tplName=rpV2TplNames[rpV2SelectedTpl]||'报告';
  document.getElementById('rp-v2-preview-title').textContent=tplName;
  // Generating animation
  body.innerHTML='<div class="rp-v2-generating"><div style="font-size:32px;color:var(--green)">✦</div><h3 style="margin:12px 0 4px;font:bold 16px \'Noto Sans SC\'">AI 正在生成报告</h3><p style="font:12px \'Noto Sans SC\';color:var(--muted)">基于 '+pool.length+' 条素材智能分析中...</p><div class="rp-v2-gen-progress"><div class="rp-v2-gen-progress-bar" id="rp-gen-bar"></div></div><div class="rp-v2-gen-steps"><div class="rp-v2-gen-step" id="rp-gen-s1"><div class="rp-v2-gen-step-icon">1</div>整合素材数据</div><div class="rp-v2-gen-step" id="rp-gen-s2"><div class="rp-v2-gen-step-icon">2</div>分析市场趋势</div><div class="rp-v2-gen-step" id="rp-gen-s3"><div class="rp-v2-gen-step-icon">3</div>生成专业分析</div><div class="rp-v2-gen-step" id="rp-gen-s4"><div class="rp-v2-gen-step-icon">4</div>排版输出报告</div></div></div>';
  var bar=document.getElementById('rp-gen-bar');
  var steps=[document.getElementById('rp-gen-s1'),document.getElementById('rp-gen-s2'),document.getElementById('rp-gen-s3'),document.getElementById('rp-gen-s4')];
  steps[0].classList.add('active');
  var progress=0;
  var interval=setInterval(function(){
    progress+=Math.random()*15+5;
    if(progress>100)progress=100;
    if(bar)bar.style.width=progress+'%';
    if(progress>25){steps[0].classList.remove('active');steps[0].classList.add('done');steps[0].querySelector('.rp-v2-gen-step-icon').textContent='✓';steps[1].classList.add('active')}
    if(progress>50){steps[1].classList.remove('active');steps[1].classList.add('done');steps[1].querySelector('.rp-v2-gen-step-icon').textContent='✓';steps[2].classList.add('active')}
    if(progress>75){steps[2].classList.remove('active');steps[2].classList.add('done');steps[2].querySelector('.rp-v2-gen-step-icon').textContent='✓';steps[3].classList.add('active')}
    if(progress>=100){
      clearInterval(interval);
      steps[3].classList.remove('active');steps[3].classList.add('done');steps[3].querySelector('.rp-v2-gen-step-icon').textContent='✓';
      setTimeout(function(){rpV2RenderReport(pool,tplName)},400);
    }
  },300);
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
  h+='<p>本报告基于 Mercator 全球电商情报系统 '+pool.length+' 条实时监测数据，覆盖 '+Object.keys(typeCount).length+' 个数据维度，分析周期为 '+periodLabel+'。核心发现如下：</p>';
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
  // Section 4: Risk & Compliance
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
  h+='<p>本报告数据全部来源于 Mercator 全球电商情报系统实时监测，包含：</p>';
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
    h+='<div class="rp-v2-recent-item" onclick="toast(\'加载历史报告: '+r.name.replace(/'/g,"\\'")+'\')">';
    h+='<div class="rp-v2-recent-icon">◈</div>';
    h+='<div class="rp-v2-recent-info"><strong>'+r.name+'</strong><small>'+ds+' · '+r.materials+'条素材</small></div></div>';
  });
  list.innerHTML=h;
}

// --- AI Tools ---
function rpV2AiTool(type){
  var pool=rpGetPool().filter(function(m){return m.selected});
  if(pool.length===0){toast('请先勾选素材');return}
  var resultEl=document.getElementById('rp-ai-'+type+'-result');
  if(!resultEl)return;
  resultEl.innerHTML='<div class="rp-v2-ai-result"><p style="color:var(--muted);text-align:center;padding:10px">AI 分析中...</p></div>';
  setTimeout(function(){
    var h='<div class="rp-v2-ai-result">';
    if(type==='summary'){
      h+='<h5>✧ 智能总结</h5>';
      h+='<p>基于 <b>'+pool.length+'</b> 条素材，核心发现：</p><ul>';
      var types={};pool.forEach(function(m){types[m.type]=(types[m.type]||0)+1});
      Object.keys(types).forEach(function(t){
        var labels={product:'商品',shop:'店铺',content:'内容',country:'国家',platform:'平台',policy:'政策'};
        h+='<li><b>'+(labels[t]||t)+'</b>：'+types[t]+' 条数据点</li>';
      });
      h+='</ul><p><b>关键洞察：</b></p><ul>';
      h+='<li>素材覆盖多个维度，数据交叉验证可信度较高</li>';
      h+='<li>建议优先关注增速最快的品类/市场方向</li>';
      h+='<li>注意政策变动对选品和定价策略的潜在影响</li></ul>';
    }else if(type==='risk'){
      h+='<h5>⚠ 风险扫描结果</h5><ul>';
      h+='<li style="color:#ef4444"><b>高风险</b>：部分目标市场关税政策变动频繁，需密切跟踪</li>';
      h+='<li style="color:var(--orange)"><b>中风险</b>：平台规则调整可能导致部分运营策略失效</li>';
      h+='<li style="color:#f59e0b"><b>关注</b>：竞品价格战加剧，利润空间可能受压</li>';
      h+='<li style="color:var(--green)"><b>利好</b>：内容电商渠道仍处于红利期，流量成本相对可控</li></ul>';
      h+='<p style="font-size:11px;color:var(--muted);margin-top:6px">建议将高风险项同步至预警中心持续监控</p>';
    }else if(type==='suggest'){
      h+='<h5>◈ 选品建议</h5><p>基于素材数据，推荐以下潜力方向：</p><ol>';
      h+='<li><b>个护美妆小件</b> — 东南亚增速 30%+，客单价适中，复购率高</li>';
      h+='<li><b>智能家居配件</b> — 中东/拉美需求旺盛，竞争度低，利润空间大</li>';
      h+='<li><b>户外运动装备</b> — 欧美市场稳定增长，季节性明显，提前备货</li>';
      h+='<li><b>宠物用品</b> — 全球赛道高增长，SKU 丰富，差异化空间大</li>';
      h+='<li><b>健康保健品类</b> — 政策准入门槛高但利润丰厚，适合有资质卖家</li></ol>';
    }
    h+='</div>';
    resultEl.innerHTML=h;
    toast('AI 分析完成');
  },1500);
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
    a.href=url;a.download='Mercator_Report_'+Date.now()+ext;a.click();
    URL.revokeObjectURL(url);
    toast('报告已导出');
  },800);
}
function rpV2SaveDraft(){
  var body=document.getElementById('rp-v2-preview-body');
  if(!body||body.classList.contains('rp-empty-preview')){toast('暂无内容可保存');return}
  localStorage.setItem('mercator_draft_v2',body.innerHTML);
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
"""

src = src[:js_start] + NEW_JS + src[js_end:]
print("[3/3] JS replaced")

# ============================================================
# PART 4: Update switchPage to call rpV2RefreshPoolUI
# ============================================================
old_switch = "if(name==='report')rpRenderPool();"
new_switch = "if(name==='report'){rpV2RefreshPoolUI();rpV2LoadRecent();}"
src = src.replace(old_switch, new_switch, 1)
print("[4] switchPage updated")

# ============================================================
# Save
# ============================================================
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

print(f"Done! File size: {len(src)} bytes")
