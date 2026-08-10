#!/usr/bin/env python3
"""Rebuild the Mercator settings page with 6 enterprise-level tabs."""

import re

FILE = '/app/data/所有对话/主对话/mercator_rework/index.html'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# PART A: CSS
# ============================================================
NEW_CSS = r"""
/* === 设置与权限 === */
.st-wrap{display:flex;gap:0;min-height:80vh}
.st-side{width:200px;flex-shrink:0;background:#fff;border:1px solid var(--line);border-radius:8px 0 0 8px;padding:16px 0;display:flex;flex-direction:column;gap:2px}
.st-side-btn{display:flex;align-items:center;gap:10px;padding:11px 20px;border:0;background:none;cursor:pointer;font:13px 'Noto Sans SC';color:var(--muted);text-align:left;width:100%;border-left:3px solid transparent;transition:.15s}
.st-side-btn:hover{background:#f0f4fa;color:var(--ink)}
.st-side-btn.active{background:#e8f0fc;color:var(--orange);font-weight:600;border-left-color:var(--orange)}
.st-side-btn span{font-size:16px;width:20px;text-align:center}
.st-main{flex:1;background:#fff;border:1px solid var(--line);border-left:0;border-radius:0 8px 8px 0;padding:28px 32px;overflow-y:auto;max-height:85vh}
.st-tab{display:none}
.st-tab.active{display:block}
.st-section{margin-bottom:28px}
.st-section-title{font-size:15px;font-weight:600;margin:0 0 4px}
.st-section-desc{font-size:12px;color:var(--muted);margin:0 0 16px}
.st-divider{border:0;border-top:1px solid var(--line);margin:24px 0}
.st-form-row{display:flex;gap:16px;margin-bottom:14px}
.st-form-group{flex:1;display:flex;flex-direction:column;gap:5px}
.st-form-group label{font-size:11px;color:var(--muted);font-weight:500}
.st-input{border:1px solid var(--line);border-radius:4px;padding:9px 12px;font:13px 'Noto Sans SC';outline:none;transition:.15s;background:#fff}
.st-input:focus{border-color:var(--orange);box-shadow:0 0 0 3px rgba(59,125,216,.1)}
.st-select{border:1px solid var(--line);border-radius:4px;padding:9px 12px;font:13px 'Noto Sans SC';outline:none;background:#fff;cursor:pointer}
.st-select:focus{border-color:var(--orange)}
.st-btn{border:0;border-radius:4px;padding:9px 18px;font:13px 'Noto Sans SC';cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px}
.st-btn-primary{background:var(--orange);color:#fff}
.st-btn-primary:hover{background:#2a6bc6}
.st-btn-outline{background:#fff;border:1px solid var(--line);color:var(--ink)}
.st-btn-outline:hover{border-color:var(--orange);color:var(--orange)}
.st-btn-danger{background:#fff;border:1px solid #e8c4c4;color:#c0392b}
.st-btn-danger:hover{background:#fdf0ef}
.st-btn-sm{padding:6px 12px;font-size:11px}
.st-toggle-wrap{display:flex;align-items:center;gap:10px}
.st-toggle{position:relative;width:40px;height:22px;background:#d5dbe3;border-radius:11px;cursor:pointer;transition:.2s;flex-shrink:0}
.st-toggle.on{background:var(--orange)}
.st-toggle::after{content:'';position:absolute;width:18px;height:18px;background:#fff;border-radius:50%;top:2px;left:2px;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.15)}
.st-toggle.on::after{left:20px}
.st-toggle-label{font-size:13px;color:var(--ink)}
.st-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.st-stat-card{background:#f8fafd;border:1px solid var(--line);border-radius:8px;padding:16px;text-align:center}
.st-stat-card .st-stat-val{font:24px 'DM Mono';color:var(--orange);display:block}
.st-stat-card .st-stat-label{font-size:11px;color:var(--muted);margin-top:4px;display:block}
.st-role-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.st-role-card{background:#f8fafd;border:1px solid var(--line);border-radius:6px;padding:14px;cursor:pointer;transition:.15s}
.st-role-card:hover{border-color:var(--orange);background:#f0f4fa}
.st-role-card h4{font-size:13px;margin:0 0 6px}
.st-role-card p{font-size:11px;color:var(--muted);margin:0;line-height:1.5}
.st-role-badge{display:inline-block;padding:2px 8px;border-radius:10px;font:10px 'DM Mono';margin-bottom:6px}
.st-role-badge.admin{background:#e8f0fc;color:#2a5a8a}
.st-role-badge.manager{background:#e8f6ee;color:#2a7a4a}
.st-role-badge.staff{background:#fef6e8;color:#8a6a2a}
.st-table-wrap{overflow-x:auto}
.st-table{width:100%;border-collapse:collapse}
.st-table th{font:600 11px 'DM Mono';color:var(--muted);text-align:left;padding:10px 12px;border-bottom:2px solid var(--line);letter-spacing:.3px;white-space:nowrap}
.st-table td{padding:10px 12px;border-bottom:1px solid #f0f2f6;font-size:12px;vertical-align:middle}
.st-table tr:hover td{background:#f8fafd}
.st-table .st-avatar{width:28px;height:28px;border-radius:50%;display:inline-grid;place-items:center;color:#fff;font:11px 'DM Mono';margin-right:8px;vertical-align:middle}
.st-status{display:inline-flex;align-items:center;gap:4px;font-size:11px}
.st-status::before{content:'';width:6px;height:6px;border-radius:50%}
.st-status.online::before{background:#27ae60}
.st-status.offline::before{background:#bdc3c7}
.st-status.disabled::before{background:#e74c3c}
.st-actions{display:flex;gap:6px}
.st-actions button{border:1px solid var(--line);background:#fff;border-radius:3px;padding:4px 10px;font-size:11px;cursor:pointer;transition:.15s}
.st-actions button:hover{border-color:var(--orange);color:var(--orange)}
.st-actions button.danger:hover{border-color:#e74c3c;color:#e74c3c}
.st-perm-table{width:100%;border-collapse:collapse;font-size:12px}
.st-perm-table th{font:600 10px 'DM Mono';color:var(--muted);padding:8px;text-align:center;background:#f8fafd;border-bottom:1px solid var(--line)}
.st-perm-table th:first-child{text-align:left}
.st-perm-table td{padding:8px;text-align:center;border-bottom:1px solid #f0f2f6}
.st-perm-table td:first-child{text-align:left;font-weight:500}
.st-perm-table input[type=checkbox]{width:16px;height:16px;accent-color:var(--orange);cursor:pointer}
.st-country-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.st-country-card{background:#f8fafd;border:1px solid var(--line);border-radius:6px;padding:14px;display:flex;align-items:center;justify-content:space-between}
.st-country-card .st-cc-left{display:flex;align-items:center;gap:10px}
.st-country-card .st-flag{font-size:22px}
.st-country-card .st-cc-name{font-size:13px;font-weight:500}
.st-country-card .st-cc-time{font-size:10px;color:var(--muted)}
.st-platform-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:20px}
.st-platform-card{background:#f8fafd;border:1px solid var(--line);border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:space-between}
.st-platform-card .st-pc-info{display:flex;align-items:center;gap:10px}
.st-platform-card .st-pc-icon{width:32px;height:32px;border-radius:6px;display:grid;place-items:center;font-size:16px;color:#fff}
.st-platform-card .st-pc-name{font-size:13px;font-weight:500}
.st-alert-checks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.st-alert-check{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafd;border:1px solid var(--line);border-radius:4px;cursor:pointer;font-size:12px}
.st-alert-check input{accent-color:var(--orange);width:15px;height:15px}
.st-theme-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
.st-theme-card{border:2px solid var(--line);border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:.15s}
.st-theme-card:hover{border-color:#a8b8d0}
.st-theme-card.selected{border-color:var(--orange);background:#f0f4fa}
.st-theme-card .st-theme-preview{width:100%;height:60px;border-radius:4px;margin-bottom:10px}
.st-theme-card h4{font-size:13px;margin:0}
.st-log-filters{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.st-log-filters select,.st-log-filters input{border:1px solid var(--line);border-radius:4px;padding:7px 10px;font:12px 'Noto Sans SC';outline:none}
.st-recycle-item{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid var(--line);border-radius:6px;margin-bottom:8px;background:#f8fafd}
.st-recycle-item .st-ri-left{display:flex;align-items:center;gap:12px}
.st-recycle-item .st-ri-icon{width:32px;height:32px;border-radius:4px;background:#e8f0fc;display:grid;place-items:center;font-size:15px}
.st-recycle-item .st-ri-name{font-size:13px;font-weight:500}
.st-recycle-item .st-ri-meta{font-size:10px;color:var(--muted)}
.st-recycle-item .st-ri-days{font-size:11px;color:#c0392b}
.st-avatar-upload{display:flex;align-items:center;gap:20px;margin-bottom:20px}
.st-avatar-big{width:64px;height:64px;border-radius:50%;background:var(--orange);display:grid;place-items:center;font:24px 'Playfair Display';color:#fff}
.st-device-list{display:flex;flex-direction:column;gap:8px}
.st-device-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:4px;font-size:12px}
.st-device-item .st-dev-info{display:flex;align-items:center;gap:10px}
.st-device-item .st-dev-icon{font-size:18px}
.st-modal-overlay{position:fixed;inset:0;background:rgba(26,35,50,.5);z-index:100;display:flex;align-items:center;justify-content:center}
.st-modal{background:#fff;border-radius:8px;width:480px;max-width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.st-modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--line)}
.st-modal-header h3{font-size:16px;margin:0}
.st-modal-close{border:0;background:none;font-size:20px;cursor:pointer;color:var(--muted);padding:4px}
.st-modal-body{padding:20px 24px}
.st-modal-footer{padding:14px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px}
.st-fav-summary{display:flex;gap:20px;margin-bottom:14px}
.st-fav-stat{font-size:12px;color:var(--muted)}
.st-fav-stat b{color:var(--orange);font:16px 'DM Mono';margin-right:4px}
.st-macro-area{background:#f8fafd;border:1px solid var(--line);border-radius:6px;padding:16px;margin-bottom:16px}
.st-macro-area .st-macro-row{display:flex;align-items:center;justify-content:space-between}
.st-api-grid{display:grid;gap:12px}
.st-api-row{display:flex;align-items:center;gap:12px}
.st-api-row label{width:120px;font-size:12px;font-weight:500;flex-shrink:0}
.st-api-row input{flex:1}
.st-admin-section{background:#fef9f0;border:1px solid #f0dfa0;border-radius:6px;padding:16px;margin-top:20px}
.st-admin-section h4{font-size:13px;color:#8a6a2a;margin:0 0 12px}
.st-freq-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.st-freq-item{display:flex;flex-direction:column;gap:6px}
.st-freq-item label{font-size:11px;color:var(--muted)}
.st-empty{text-align:center;padding:40px;color:var(--muted);font-size:13px}
@media(max-width:700px){
.st-wrap{flex-direction:column}
.st-side{width:100%;flex-direction:row;overflow-x:auto;border-radius:8px 8px 0 0;padding:0}
.st-side-btn{white-space:nowrap;border-left:0;border-bottom:3px solid transparent;padding:12px 16px;justify-content:center}
.st-side-btn.active{border-left:0;border-bottom-color:var(--orange)}
.st-main{border-radius:0 0 8px 8px;border-left:1px solid var(--line);border-top:0;padding:18px}
.st-stats-row{grid-template-columns:1fr 1fr}
.st-form-row{flex-direction:column}
.st-country-grid{grid-template-columns:1fr}
.st-theme-cards{grid-template-columns:1fr}
.st-role-grid{grid-template-columns:1fr}
.st-alert-checks{grid-template-columns:1fr}
.st-freq-grid{grid-template-columns:1fr}
}
"""

css_marker = '/* === 报告生成中心 v2 全面重建 === */'
content = content.replace(css_marker, NEW_CSS + '\n' + css_marker, 1)

# ============================================================
# PART B: HTML - Replace settings section
# ============================================================
old_settings = '''<section id="settings" class="page"><article class="panel settings"><p class="eyebrow">ACCESS CONTROL</p><h2>团队与权限</h2><p>管理成员可访问的国家、数据模块及导出权限。</p><div class="member"><span class="avatar">L</span><div><b>陆安然</b><small>管理员 · 全部权限</small></div><button class="outline">管理</button></div><div class="member"><span class="avatar green">Y</span><div><b>Yuki Chen</b><small>运营 · 市场与榜单查看</small></div><button class="outline">管理</button></div></article></section>'''

new_settings = r'''<section id="settings" class="page">
<div class="st-wrap">
<!-- 左侧 Tab 导航 -->
<div class="st-side">
<button class="st-side-btn active" onclick="stSwitchTab('account')"><span>👤</span>个人账号</button>
<button class="st-side-btn" onclick="stSwitchTab('members')"><span>👥</span>团队与权限</button>
<button class="st-side-btn" onclick="stSwitchTab('sources')"><span>🌐</span>数据源配置</button>
<button class="st-side-btn" onclick="stSwitchTab('alerts')"><span>🔔</span>预警通知</button>
<button class="st-side-btn" onclick="stSwitchTab('prefs')"><span>🎨</span>外观偏好</button>
<button class="st-side-btn" onclick="stSwitchTab('logs')"><span>📋</span>日志与回收站</button>
</div>
<!-- 右侧内容区 -->
<div class="st-main">

<!-- Tab 1: 个人账号 -->
<div class="st-tab active" id="st-tab-account">
<h2 style="margin:0 0 4px;font-size:20px">个人账号设置</h2>
<p class="st-section-desc">管理您的个人信息、安全设置与收藏数据。</p>
<div class="st-section">
<div class="st-avatar-upload">
<div class="st-avatar-big">L</div>
<div><button class="st-btn st-btn-outline st-btn-sm" onclick="stToast('头像上传功能开发中')">更换头像</button><p style="font-size:11px;color:var(--muted);margin:6px 0 0">支持 JPG/PNG，最大 2MB</p></div>
</div>
<div class="st-form-row">
<div class="st-form-group"><label>用户名</label><input class="st-input" id="st-username" value="陆安然"></div>
<div class="st-form-group"><label>岗位</label><select class="st-select" id="st-role"><option>运营总监</option><option>选品专员</option><option>内容运营</option><option>数据分析师</option></select></div>
</div>
<div class="st-form-row">
<div class="st-form-group"><label>邮箱</label><input class="st-input" id="st-email" value="luran@mercator.com"></div>
<div class="st-form-group"><label>手机</label><input class="st-input" id="st-phone" value="+86 138****6789"></div>
</div>
<button class="st-btn st-btn-primary" onclick="stSaveAccount()">保存修改</button>
</div>
<hr class="st-divider">
<div class="st-section">
<h3 class="st-section-title">安全设置</h3>
<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid var(--line);border-radius:6px">
<div><div style="font-size:13px;font-weight:500">登录密码</div><div style="font-size:11px;color:var(--muted)">上次修改于 30 天前</div></div>
<button class="st-btn st-btn-outline st-btn-sm" onclick="stToast('密码修改弹窗开发中')">修改密码</button>
</div>
<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid var(--line);border-radius:6px">
<div><div style="font-size:13px;font-weight:500">二次验证（2FA）</div><div style="font-size:11px;color:var(--muted)">登录时需要额外验证码</div></div>
<div class="st-toggle" onclick="stToggle(this)"></div>
</div>
</div>
<h4 style="font-size:12px;color:var(--muted);margin:0 0 10px">登录设备</h4>
<div class="st-device-list">
<div class="st-device-item"><div class="st-dev-info"><span class="st-dev-icon">💻</span><div><div>MacBook Pro - Chrome</div><div style="font-size:10px;color:var(--muted)">当前设备 · 深圳</div></div></div><span style="font-size:10px;color:#27ae60">活跃</span></div>
<div class="st-device-item"><div class="st-dev-info"><span class="st-dev-icon">📱</span><div><div>iPhone 15 - Safari</div><div style="font-size:10px;color:var(--muted)">2小时前 · 深圳</div></div></div><button class="st-btn st-btn-outline st-btn-sm" onclick="stToast('已登出该设备')">登出</button></div>
<div class="st-device-item"><div class="st-dev-info"><span class="st-dev-icon">🖥️</span><div><div>Windows 11 - Edge</div><div style="font-size:10px;color:var(--muted)">3天前 · 上海</div></div></div><button class="st-btn st-btn-outline st-btn-sm" onclick="stToast('已登出该设备')">登出</button></div>
</div>
</div>
<hr class="st-divider">
<div class="st-section">
<h3 class="st-section-title">收藏夹管理</h3>
<div class="st-fav-summary">
<span class="st-fav-stat"><b>47</b>份报告草稿</span>
<span class="st-fav-stat"><b>128</b>条收藏素材</span>
<span class="st-fav-stat"><b>12</b>个自定义看板</span>
</div>
<button class="st-btn st-btn-outline st-btn-sm" onclick="stClearFavorites()">🗑️ 批量清理过期收藏</button>
</div>
</div>

<!-- Tab 2: 团队与权限 -->
<div class="st-tab" id="st-tab-members">
<h2 style="margin:0 0 4px;font-size:20px">团队成员 & 角色权限</h2>
<p class="st-section-desc">管理团队成员、分配角色及设置模块级操作权限。</p>
<div class="st-stats-row" id="st-member-stats"></div>
<h3 class="st-section-title">预设角色</h3>
<div class="st-role-grid">
<div class="st-role-card"><span class="st-role-badge admin">SUPER</span><h4>超级管理员</h4><p>全部模块完全权限，可管理系统设置与成员</p></div>
<div class="st-role-card"><span class="st-role-badge manager">MANAGER</span><h4>运营主管</h4><p>市场/商品/店铺/输出模块 查看+导出，可分配任务</p></div>
<div class="st-role-card"><span class="st-role-badge staff">STAFF</span><h4>选品专员</h4><p>商品/店铺模块 查看+新增监控，内容模块 查看</p></div>
<div class="st-role-card"><span class="st-role-badge staff">STAFF</span><h4>内容投放</h4><p>内容模块 全部操作，输出模块 查看+AI生成</p></div>
<div class="st-role-card"><span class="st-role-badge staff">VIEWER</span><h4>普通运营</h4><p>所有模块仅查看权限，无导出权限</p></div>
</div>
<div style="display:flex;gap:10px;margin-bottom:16px">
<button class="st-btn st-btn-primary" onclick="stAddMember()">+ 添加成员</button>
<button class="st-btn st-btn-outline" onclick="stCustomRole()">⚙ 自定义角色</button>
</div>
<h3 class="st-section-title">成员列表</h3>
<div class="st-table-wrap"><table class="st-table" id="st-member-table"><thead><tr><th>成员</th><th>邮箱</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody id="st-member-tbody"></tbody></table></div>
<hr class="st-divider">
<h3 class="st-section-title">权限矩阵</h3>
<p class="st-section-desc">定义各模块对不同角色的操作权限。</p>
<div class="st-table-wrap">
<table class="st-perm-table">
<thead><tr><th>模块 / 操作</th><th>查看</th><th>新增监控</th><th>批量导出</th><th>加入素材</th><th>AI 生成</th></tr></thead>
<tbody>
<tr><td>📊 市场分析</td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td></tr>
<tr><td>📦 商品监控</td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td></tr>
<tr><td>🏪 店铺追踪</td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td></tr>
<tr><td>🎬 内容追踪</td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td></tr>
<tr><td>📤 输出报告</td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox" checked></td></tr>
<tr><td>⚠️ 风险预警</td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td></tr>
</tbody>
</table>
</div>
</div>

<!-- Tab 3: 数据源配置 -->
<div class="st-tab" id="st-tab-sources">
<h2 style="margin:0 0 4px;font-size:20px">数据监控源配置</h2>
<p class="st-section-desc">配置监控国家、电商平台数据源及更新频率。</p>
<h3 class="st-section-title">监控国家</h3>
<div class="st-country-grid">
<div class="st-country-card"><div class="st-cc-left"><span class="st-flag">🇮🇩</span><div><div class="st-cc-name">印度尼西亚</div><div class="st-cc-time">更新于 2 分钟前</div></div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-country-card"><div class="st-cc-left"><span class="st-flag">🇺🇸</span><div><div class="st-cc-name">美国</div><div class="st-cc-time">更新于 5 分钟前</div></div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-country-card"><div class="st-cc-left"><span class="st-flag">🇯🇵</span><div><div class="st-cc-name">日本</div><div class="st-cc-time">更新于 3 分钟前</div></div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-country-card"><div class="st-cc-left"><span class="st-flag">🇧🇷</span><div><div class="st-cc-name">巴西</div><div class="st-cc-time">更新于 8 分钟前</div></div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-country-card"><div class="st-cc-left"><span class="st-flag">🇸🇦</span><div><div class="st-cc-name">沙特阿拉伯</div><div class="st-cc-time">更新于 12 分钟前</div></div></div><div class="st-toggle" onclick="stToggle(this)"></div></div>
<div class="st-country-card"><div class="st-cc-left"><span class="st-flag">🇹🇭</span><div><div class="st-cc-name">泰国</div><div class="st-cc-time">更新于 4 分钟前</div></div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-country-card"><div class="st-cc-left"><span class="st-flag">🇲🇾</span><div><div class="st-cc-name">马来西亚</div><div class="st-cc-time">更新于 6 分钟前</div></div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-country-card"><div class="st-cc-left"><span class="st-flag">🇻🇳</span><div><div class="st-cc-name">越南</div><div class="st-cc-time">更新于 7 分钟前</div></div></div><div class="st-toggle" onclick="stToggle(this)"></div></div>
</div>
<hr class="st-divider">
<h3 class="st-section-title">电商平台数据源</h3>
<div class="st-platform-grid">
<div class="st-platform-card"><div class="st-pc-info"><div class="st-pc-icon" style="background:#000">🎵</div><div class="st-pc-name">TikTok Shop</div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-platform-card"><div class="st-pc-info"><div class="st-pc-icon" style="background:#ee4d2d">🛒</div><div class="st-pc-name">Shopee</div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-platform-card"><div class="st-pc-info"><div class="st-pc-icon" style="background:#ff9900">📦</div><div class="st-pc-name">Amazon</div></div><div class="st-toggle on" onclick="stToggle(this)"></div></div>
<div class="st-platform-card"><div class="st-pc-info"><div class="st-pc-icon" style="background:#333">🏬</div><div class="st-pc-name">Tokopedia</div></div><div class="st-toggle" onclick="stToggle(this)"></div></div>
<div class="st-platform-card"><div class="st-pc-info"><div class="st-pc-icon" style="background:#7c3aed">🌙</div><div class="st-pc-name">Noon</div></div><div class="st-toggle" onclick="stToggle(this)"></div></div>
<div class="st-platform-card"><div class="st-pc-info"><div class="st-pc-icon" style="background:#ffe600;color:#333">🌎</div><div class="st-pc-name">Mercado Libre</div></div><div class="st-toggle" onclick="stToggle(this)"></div></div>
</div>
<hr class="st-divider">
<h3 class="st-section-title">数据更新频率</h3>
<div class="st-freq-grid">
<div class="st-freq-item"><label>商品数据</label><select class="st-select"><option>实时</option><option selected>5 分钟</option><option>15 分钟</option><option>1 小时</option><option>每日</option></select></div>
<div class="st-freq-item"><label>店铺数据</label><select class="st-select"><option>实时</option><option>5 分钟</option><option selected>15 分钟</option><option>1 小时</option><option>每日</option></select></div>
<div class="st-freq-item"><label>内容数据</label><select class="st-select"><option>实时</option><option>5 分钟</option><option>15 分钟</option><option selected>1 小时</option><option>每日</option></select></div>
</div>
<hr class="st-divider">
<h3 class="st-section-title">宏观数据同步</h3>
<div class="st-macro-area">
<div class="st-macro-row">
<div><div style="font-size:13px;font-weight:500">GDP / 人口 / 汇率 / 电商渗透率</div><div style="font-size:11px;color:var(--muted)">最后同步：2024-01-15 08:30 UTC+8</div></div>
<button class="st-btn st-btn-outline" onclick="stSyncMacro()">🔄 手动同步</button>
</div>
</div>
<hr class="st-divider">
<h3 class="st-section-title">API 密钥配置</h3>
<div class="st-api-grid">
<div class="st-api-row"><label>TikTok API</label><input class="st-input" placeholder="输入 API Key..."></div>
<div class="st-api-row"><label>Shopee API</label><input class="st-input" placeholder="输入 API Key..."></div>
<div class="st-api-row"><label>Amazon SP-API</label><input class="st-input" placeholder="输入 API Key..."></div>
</div>
</div>

<!-- Tab 4: 预警通知 -->
<div class="st-tab" id="st-tab-alerts">
<h2 style="margin:0 0 4px;font-size:20px">预警通知推送</h2>
<p class="st-section-desc">配置您希望接收的预警类型与推送方式。</p>
<h3 class="st-section-title">个人推送设置</h3>
<div class="st-section">
<h4 style="font-size:12px;color:var(--muted);margin:0 0 10px">预警类型</h4>
<div class="st-alert-checks">
<label class="st-alert-check"><input type="checkbox" checked> 商品异动（价格/销量/评分）</label>
<label class="st-alert-check"><input type="checkbox" checked> 店铺 GMV 异常波动</label>
<label class="st-alert-check"><input type="checkbox" checked> 新品 / 热门内容</label>
<label class="st-alert-check"><input type="checkbox"> 新政 / 合规风险</label>
<label class="st-alert-check"><input type="checkbox" checked> 类目竞争加剧</label>
<label class="st-alert-check"><input type="checkbox"> 汇率大幅波动</label>
</div>
<h4 style="font-size:12px;color:var(--muted);margin:16px 0 10px">推送渠道</h4>
<div style="display:flex;flex-direction:column;gap:10px">
<div class="st-toggle-wrap"><div class="st-toggle on" onclick="stToggle(this)"></div><span class="st-toggle-label">站内消息</span></div>
<div class="st-toggle-wrap"><div class="st-toggle on" onclick="stToggle(this)"></div><span class="st-toggle-label">邮箱推送</span></div>
<div class="st-toggle-wrap"><div class="st-toggle" onclick="stToggle(this)"></div><span class="st-toggle-label">企业微信 / 飞书</span></div>
</div>
</div>
<hr class="st-divider">
<div class="st-admin-section">
<h4>🔒 全局推送设置（仅管理员）</h4>
<p style="font-size:12px;color:#8a6a2a;margin:0 0 14px">以下通知将强制推送给指定范围成员，无法由个人关闭。</p>
<h4 style="font-size:12px;color:var(--muted);margin:0 0 10px;font-weight:normal">强制通知项</h4>
<div class="st-alert-checks">
<label class="st-alert-check"><input type="checkbox" checked> 高危政策预警</label>
<label class="st-alert-check"><input type="checkbox" checked> 平台规则重大变更</label>
<label class="st-alert-check"><input type="checkbox" checked> 行业级波动事件</label>
</div>
<h4 style="font-size:12px;color:var(--muted);margin:12px 0 10px;font-weight:normal">通知范围</h4>
<div style="display:flex;gap:16px">
<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="st-notify-scope" checked style="accent-color:var(--orange)"> 全员推送</label>
<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="st-notify-scope" style="accent-color:var(--orange)"> 仅指定角色</label>
</div>
</div>
</div>

<!-- Tab 5: 外观偏好 -->
<div class="st-tab" id="st-tab-prefs">
<h2 style="margin:0 0 4px;font-size:20px">外观 & 通用偏好</h2>
<p class="st-section-desc">自定义系统外观、显示单位及默认参数。</p>
<h3 class="st-section-title">主题模式</h3>
<div class="st-theme-cards">
<div class="st-theme-card selected" onclick="stSelectTheme(this)"><div class="st-theme-preview" style="background:linear-gradient(135deg,#f4f6fa,#d5dbe3)"></div><h4>☀️ 浅色模式</h4></div>
<div class="st-theme-card" onclick="stSelectTheme(this)"><div class="st-theme-preview" style="background:linear-gradient(135deg,#1a2332,#2c3e57)"></div><h4>🌙 深色模式</h4></div>
</div>
<hr class="st-divider">
<div class="st-section">
<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #f0f2f6">
<div><div style="font-size:13px;font-weight:500">默认筛选记忆</div><div style="font-size:11px;color:var(--muted)">记住上次使用的筛选条件，下次打开自动应用</div></div>
<div class="st-toggle on" onclick="stToggle(this)"></div>
</div>
<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #f0f2f6">
<div><div style="font-size:13px;font-weight:500">货币单位</div><div style="font-size:11px;color:var(--muted)">全局金额显示的默认货币</div></div>
<div style="display:flex;gap:8px"><button class="st-btn st-btn-primary st-btn-sm" id="st-currency-cny" onclick="stCurrency('cny')">¥ 人民币</button><button class="st-btn st-btn-outline st-btn-sm" id="st-currency-usd" onclick="stCurrency('usd')">$ 美元</button></div>
</div>
<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #f0f2f6">
<div><div style="font-size:13px;font-weight:500">数值单位</div><div style="font-size:11px;color:var(--muted)">大数字的显示格式</div></div>
<div style="display:flex;gap:8px"><button class="st-btn st-btn-primary st-btn-sm" id="st-unit-wan" onclick="stUnit('wan')">万</button><button class="st-btn st-btn-outline st-btn-sm" id="st-unit-m" onclick="stUnit('m')">百万 (M)</button></div>
</div>
</div>
<hr class="st-divider">
<h3 class="st-section-title">AI 报告默认参数</h3>
<div class="st-form-row">
<div class="st-form-group"><label>默认模板</label><select class="st-select"><option>市场周报模板</option><option>竞品分析模板</option><option>选品推荐模板</option><option>风险评估模板</option></select></div>
<div class="st-form-group"><label>分析侧重</label><select class="st-select"><option>综合概览</option><option>增长趋势</option><option>风险预警</option><option>竞争格局</option></select></div>
</div>
</div>

<!-- Tab 6: 日志与回收站 -->
<div class="st-tab" id="st-tab-logs">
<h2 style="margin:0 0 4px;font-size:20px">操作日志 & 素材回收站</h2>
<p class="st-section-desc">查看系统操作记录，管理已删除的素材资源。</p>
<h3 class="st-section-title">操作日志</h3>
<div class="st-log-filters">
<input type="date" value="2024-01-08" style="padding:7px 10px;border:1px solid var(--line);border-radius:4px;font-size:12px">
<span style="color:var(--muted)">至</span>
<input type="date" value="2024-01-15" style="padding:7px 10px;border:1px solid var(--line);border-radius:4px;font-size:12px">
<select style="padding:7px 10px;border:1px solid var(--line);border-radius:4px;font-size:12px"><option value="">全部操作人</option><option>陆安然</option><option>Yuki Chen</option><option>李明</option></select>
<select style="padding:7px 10px;border:1px solid var(--line);border-radius:4px;font-size:12px"><option value="">全部类型</option><option>数据导出</option><option>成员管理</option><option>设置修改</option><option>监控操作</option></select>
<button class="st-btn st-btn-outline st-btn-sm" onclick="stExportLogs()">📥 导出日志</button>
</div>
<div class="st-table-wrap"><table class="st-table"><thead><tr><th>操作人</th><th>时间</th><th>操作内容</th><th>数据类型</th><th>IP 地址</th></tr></thead><tbody id="st-log-tbody"></tbody></table></div>
<hr class="st-divider">
<h3 class="st-section-title">素材回收站</h3>
<p class="st-section-desc">已删除的素材将在 30 天后自动清除，期间可恢复。</p>
<div id="st-recycle-list"></div>
</div>

</div><!-- /st-main -->
</div><!-- /st-wrap -->

<!-- 添加成员弹窗 -->
<div class="st-modal-overlay" id="st-modal-add-member" style="display:none" onclick="if(event.target===this)this.style.display='none'">
<div class="st-modal">
<div class="st-modal-header"><h3>添加团队成员</h3><button class="st-modal-close" onclick="document.getElementById('st-modal-add-member').style.display='none'">&times;</button></div>
<div class="st-modal-body">
<div class="st-form-group" style="margin-bottom:14px"><label>邮箱地址</label><input class="st-input" id="st-new-member-email" placeholder="输入成员邮箱..."></div>
<div class="st-form-group"><label>分配角色</label><select class="st-select" id="st-new-member-role"><option value="运营主管">运营主管</option><option value="选品专员">选品专员</option><option value="内容投放">内容投放</option><option value="普通运营">普通运营</option><option value="超级管理员">超级管理员</option></select></div>
</div>
<div class="st-modal-footer"><button class="st-btn st-btn-outline" onclick="document.getElementById('st-modal-add-member').style.display='none'">取消</button><button class="st-btn st-btn-primary" onclick="stSaveNewMember()">确认添加</button></div>
</div>
</div>

<!-- 自定义角色弹窗 -->
<div class="st-modal-overlay" id="st-modal-custom-role" style="display:none" onclick="if(event.target===this)this.style.display='none'">
<div class="st-modal">
<div class="st-modal-header"><h3>自定义角色</h3><button class="st-modal-close" onclick="document.getElementById('st-modal-custom-role').style.display='none'">&times;</button></div>
<div class="st-modal-body">
<div class="st-form-group" style="margin-bottom:14px"><label>角色名称</label><input class="st-input" id="st-new-role-name" placeholder="例如：高级选品师"></div>
<h4 style="font-size:12px;color:var(--muted);margin:0 0 10px">权限配置</h4>
<table class="st-perm-table"><thead><tr><th>模块</th><th>查看</th><th>新增监控</th><th>批量导出</th><th>加入素材</th><th>AI生成</th></tr></thead><tbody>
<tr><td>市场分析</td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td></tr>
<tr><td>商品监控</td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td></tr>
<tr><td>店铺追踪</td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td></tr>
<tr><td>内容追踪</td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox" checked></td><td><input type="checkbox" checked></td></tr>
<tr><td>输出报告</td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td></tr>
<tr><td>风险预警</td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td></tr>
</tbody></table>
</div>
<div class="st-modal-footer"><button class="st-btn st-btn-outline" onclick="document.getElementById('st-modal-custom-role').style.display='none'">取消</button><button class="st-btn st-btn-primary" onclick="stToast('自定义角色已创建');document.getElementById('st-modal-custom-role').style.display='none'">保存角色</button></div>
</div>
</div>
</section>'''

content = content.replace(old_settings, new_settings, 1)

# ============================================================
# PART C: JavaScript
# ============================================================
NEW_JS = r"""

// ===== 设置与权限页面 =====
var stMembers = [
  {name:'陆安然',email:'luran@mercator.com',role:'超级管理员',status:'online',color:'#3b7dd8'},
  {name:'Yuki Chen',email:'yuki@mercator.com',role:'运营主管',status:'online',color:'#27ae60'},
  {name:'李明',email:'liming@mercator.com',role:'选品专员',status:'offline',color:'#e67e22'},
  {name:'Sarah Wang',email:'sarah@mercator.com',role:'内容投放',status:'online',color:'#9b59b6'},
  {name:'Arief Budiman',email:'arief@mercator.com',role:'普通运营',status:'offline',color:'#1abc9c'},
  {name:'张小雨',email:'zhangxy@mercator.com',role:'选品专员',status:'disabled',color:'#e74c3c'}
];
var stLogs = [
  {user:'陆安然',time:'2024-01-15 14:23:08',action:'导出印尼美妆市场周报',type:'数据导出',ip:'192.168.1.101'},
  {user:'Yuki Chen',time:'2024-01-15 13:45:22',action:'新增 TikTok Shop 店铺监控: Glowing Beauty',type:'监控操作',ip:'192.168.1.105'},
  {user:'陆安然',time:'2024-01-15 11:20:15',action:'修改团队成员 Sarah Wang 角色为内容投放',type:'成员管理',ip:'192.168.1.101'},
  {user:'李明',time:'2024-01-15 10:05:33',action:'批量导出日本市场 Top 50 商品数据',type:'数据导出',ip:'192.168.1.112'},
  {user:'陆安然',time:'2024-01-14 17:30:45',action:'关闭越南监控国家',type:'设置修改',ip:'192.168.1.101'},
  {user:'Sarah Wang',time:'2024-01-14 16:12:08',action:'AI 生成内容趋势分析报告',type:'数据导出',ip:'192.168.1.120'},
  {user:'Yuki Chen',time:'2024-01-14 14:55:30',action:'添加新成员 Arief Budiman',type:'成员管理',ip:'192.168.1.105'},
  {user:'陆安然',time:'2024-01-14 09:40:17',action:'更新商品数据同步频率为 5 分钟',type:'设置修改',ip:'192.168.1.101'},
  {user:'李明',time:'2024-01-13 16:22:44',action:'收藏素材: 印尼护肤品竞品分析',type:'素材管理',ip:'192.168.1.112'},
  {user:'张小雨',time:'2024-01-13 11:08:56',action:'尝试导出全量数据（被权限拦截）',type:'数据导出',ip:'192.168.1.130'},
  {user:'陆安然',time:'2024-01-13 09:15:22',action:'启用二次验证（2FA）',type:'设置修改',ip:'192.168.1.101'},
  {user:'Sarah Wang',time:'2024-01-12 15:40:11',action:'删除报告草稿: Q4东南亚市场总结',type:'素材管理',ip:'192.168.1.120'},
  {user:'Yuki Chen',time:'2024-01-12 10:30:55',action:'同步宏观数据（GDP/汇率）',type:'数据导出',ip:'192.168.1.105'},
  {user:'陆安然',time:'2024-01-11 18:20:33',action:'创建自定义角色: 高级选品师',type:'成员管理',ip:'192.168.1.101'},
  {user:'李明',time:'2024-01-11 14:05:48',action:'新增 Amazon 店铺监控: Anker Official',type:'监控操作',ip:'192.168.1.112'}
];
var stRecycle = [
  {id:1,name:'Q4东南亚市场总结',type:'报告草稿',icon:'📄',deleted:'2024-01-12',daysLeft:27},
  {id:2,name:'印尼护肤品竞品分析（旧版）',type:'收藏素材',icon:'📊',deleted:'2024-01-10',daysLeft:25},
  {id:3,name:'2023年度复盘看板',type:'自定义看板',icon:'📋',deleted:'2024-01-08',daysLeft:23},
  {id:4,name:'TikTok爆款素材合集',type:'收藏素材',icon:'🎬',deleted:'2024-01-05',daysLeft:20},
  {id:5,name:'日本市场调研（草稿）',type:'报告草稿',icon:'📝',deleted:'2024-01-02',daysLeft:17}
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
      '<td style="color:var(--muted)">'+m.email+'</td>'+
      '<td><span style="background:#f0f4fa;padding:3px 8px;border-radius:10px;font-size:11px">'+m.role+'</span></td>'+
      '<td><span class="st-status '+m.status+'">'+statusLabel+'</span></td>'+
      '<td><div class="st-actions"><button onclick="stEditMember(\''+m.email+'\')">编辑</button>'+(m.status!=='disabled'?'<button onclick="stDisableMember(\''+m.email+'\')">禁用</button>':'<button onclick="stEnableMember(\''+m.email+'\')">启用</button>')+'<button class="danger" onclick="stRemoveMember(\''+m.email+'\')">移除</button></div></td></tr>';
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

"""

# Insert JS before </script>
js_marker = '</script>\n</body>'
content = content.replace(js_marker, NEW_JS + '\n' + js_marker, 1)

# ============================================================
# PART D: Hook stInit into the switchPage function
# ============================================================
# Add stInit call when settings page is activated
old_switch = "if(name==='alerts')renderAlerts();"
new_switch = "if(name==='alerts')renderAlerts();if(name==='settings')stInit();"
content = content.replace(old_switch, new_switch, 1)

# Also call stInit on page load if settings is the default page
# Add it after the DOMContentLoaded or at the end of init
# Let's add it right before the closing script tag as well for safety
content = content.replace("if(name==='settings')stInit();", "if(name==='settings'){stInit();}", 1)

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Settings page rebuilt successfully.")
print(f"New file size: {len(content)} bytes")
