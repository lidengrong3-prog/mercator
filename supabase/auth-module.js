/* ============================================================
 * Mercator SaaS - 认证模块 (Supabase Auth)
 * 集成到 index.html 的 <script> 标签中
 * ============================================================ */

// ========== 配置 ==========
// TODO: 替换为你的 Supabase 项目 URL 和 anon key
var MERCATOR_SUPABASE_URL = 'YOUR_SUPABASE_URL';
var MERCATOR_SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

// ========== 全局状态 ==========
var mercatorUser = null;      // 当前登录用户
var mercatorProfile = null;   // 用户档案

// ========== Supabase 客户端初始化 ==========
var supabaseClient = null;

function initMercatorAuth() {
  if (typeof supabase === 'undefined') {
    console.warn('[Mercator Auth] Supabase SDK not loaded');
    // SDK 未加载，降级为演示模式
    initDemoMode();
    return;
  }

  if (MERCATOR_SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.warn('[Mercator Auth] Using demo mode - configure Supabase credentials');
    initDemoMode();
    return;
  }

  supabaseClient = supabase.createClient(MERCATOR_SUPABASE_URL, MERCATOR_SUPABASE_KEY);
  checkSession();
}

// ========== 演示模式（未配置 Supabase 时） ==========
function initDemoMode() {
  // 检查 localStorage 中的演示会话
  var demoSession = localStorage.getItem('mercator_demo_session');
  if (demoSession) {
    try {
      mercatorUser = JSON.parse(demoSession);
      mercatorProfile = {
        display_name: mercatorUser.email.split('@')[0],
        email: mercatorUser.email,
        tier: 'pro',
        company: ''
      };
      onAuthSuccess();
    } catch(e) {
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
}

// ========== 会话检查 ==========
async function checkSession() {
  if (!supabaseClient) return;

  var result = await supabaseClient.auth.getSession();
  var session = result.data.session;

  if (session) {
    mercatorUser = session.user;
    await loadProfile();
    onAuthSuccess();
  } else {
    showLoginScreen();
  }
}

// ========== 加载用户档案 ==========
async function loadProfile() {
  if (!supabaseClient || !mercatorUser) return;

  var result = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', mercatorUser.id)
    .single();

  if (result.data) {
    mercatorProfile = result.data;
  } else {
    // Profile 不存在，使用默认值
    mercatorProfile = {
      display_name: mercatorUser.email.split('@')[0],
      email: mercatorUser.email,
      tier: 'free',
      company: ''
    };
  }
}

// ========== 登录 ==========
async function mercatorLogin(email, password) {
  // 演示模式
  if (!supabaseClient) {
    if (email && password) {
      mercatorUser = { email: email, id: 'demo-' + Date.now() };
      mercatorProfile = {
        display_name: email.split('@')[0],
        email: email,
        tier: 'pro',
        company: ''
      };
      localStorage.setItem('mercator_demo_session', JSON.stringify(mercatorUser));
      onAuthSuccess();
      return { success: true };
    }
    return { success: false, error: '请输入邮箱和密码' };
  }

  // Supabase 模式
  var result = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (result.error) {
    return { success: false, error: translateAuthError(result.error.message) };
  }

  mercatorUser = result.data.user;
  await loadProfile();

  // 更新最后登录时间
  supabaseClient.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', mercatorUser.id);

  onAuthSuccess();
  return { success: true };
}

// ========== 注册 ==========
async function mercatorRegister(email, password, displayName, company) {
  // 演示模式
  if (!supabaseClient) {
    if (email && password) {
      mercatorUser = { email: email, id: 'demo-' + Date.now() };
      mercatorProfile = {
        display_name: displayName || email.split('@')[0],
        email: email,
        tier: 'free',
        company: company || ''
      };
      localStorage.setItem('mercator_demo_session', JSON.stringify(mercatorUser));
      onAuthSuccess();
      return { success: true };
    }
    return { success: false, error: '请输入邮箱和密码' };
  }

  // Supabase 模式
  var result = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        display_name: displayName || email.split('@')[0],
        company: company || ''
      }
    }
  });

  if (result.error) {
    return { success: false, error: translateAuthError(result.error.message) };
  }

  // 更新 profile 中的公司信息
  if (company && result.data.user) {
    await supabaseClient.from('profiles').update({ company: company }).eq('id', result.data.user.id);
  }

  if (result.data.session) {
    mercatorUser = result.data.user;
    await loadProfile();
    onAuthSuccess();
  } else {
    // 需要邮箱验证
    return { success: true, needsEmailConfirm: true };
  }

  return { success: true };
}

// ========== 登出 ==========
async function mercatorLogout() {
  localStorage.removeItem('mercator_demo_session');

  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  mercatorUser = null;
  mercatorProfile = null;
  showLoginScreen();
  toast('已安全登出');
}

// ========== 密码重置 ==========
async function mercatorResetPassword(email) {
  if (!supabaseClient) {
    return { success: false, error: '演示模式暂不支持密码重置' };
  }

  var result = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (result.error) {
    return { success: false, error: translateAuthError(result.error.message) };
  }

  return { success: true };
}

// ========== 认证成功回调 ==========
function onAuthSuccess() {
  var loginScreen = document.getElementById('login-screen');
  if (loginScreen) loginScreen.style.display = 'none';

  // 更新侧边栏用户信息
  updateSidebarUser();

  // 记录用户首次登录
  if (!localStorage.getItem('mercator_welcomed_' + mercatorUser.id)) {
    toast('欢迎加入 Mercator，' + (mercatorProfile.display_name || mercatorUser.email.split('@')[0]) + '！');
    localStorage.setItem('mercator_welcomed_' + mercatorUser.id, '1');
  }
}

// ========== 显示登录界面 ==========
function showLoginScreen() {
  var loginScreen = document.getElementById('login-screen');
  if (loginScreen) {
    loginScreen.style.display = 'flex';
  }
}

// ========== 更新侧边栏用户信息 ==========
function updateSidebarUser() {
  // 更新侧边栏头像和用户名
  var avatarEl = document.querySelector('.sidebar .avatar');
  if (avatarEl && mercatorProfile) {
    var name = mercatorProfile.display_name || mercatorProfile.email.split('@')[0];
    avatarEl.textContent = name.charAt(0).toUpperCase();
    avatarEl.title = name + ' (' + getTierLabel(mercatorProfile.tier) + ')';
  }

  // 更新 workspace 区域
  var wsName = document.querySelector('.workspace .ws-name');
  if (wsName && mercatorProfile) {
    wsName.textContent = mercatorProfile.display_name || mercatorProfile.email.split('@')[0];
  }
}

// ========== 权限检查 ==========
function checkAccess(feature) {
  if (!mercatorProfile) return false;

  var tier = mercatorProfile.tier;
  var accessMap = {
    'overview': true,                          // 所有用户可看
    'country_basic': true,                     // 所有用户可看国家概览
    'country_detail': tier !== 'free',         // 付费用户可看详情
    'product_radar': true,                     // 所有用户可看（有限制）
    'product_full': tier !== 'free',           // 付费用户完整数据
    'policies': true,                          // 所有用户可看
    'rules': tier !== 'free',                  // 付费用户
    'reports': tier !== 'free',                // 付费用户
    'alerts_full': tier !== 'free',            // 付费用户
    'api_access': tier === 'enterprise',       // 企业版才有 API
    'white_label': tier === 'enterprise'       // 企业版白标
  };

  return accessMap[feature] !== undefined ? accessMap[feature] : (tier !== 'free');
}

// ========== 显示升级提示 ==========
function showUpgradePrompt(feature) {
  var tierLabels = { 'pro': '专业版', 'enterprise': '企业版' };
  var featureNames = {
    'country_detail': '国家市场详情',
    'product_full': '完整商品数据',
    'rules': '平台规则库',
    'reports': '报告生成中心',
    'alerts_full': '完整预警中心',
    'api_access': 'API 数据接口'
  };

  var msg = (featureNames[feature] || '该功能') + '为 Pro 版专属功能。';

  // 创建模态框
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,35,50,0.6);z-index:999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = '<div style="background:#fff;border-radius:8px;padding:32px;max-width:400px;text-align:center">' +
    '<div style="font-size:32px;margin-bottom:16px">★</div>' +
    '<h3 style="margin:0 0 8px;font-size:18px">升级到 Pro 版</h3>' +
    '<p style="color:#6b7b8d;font-size:13px;line-height:1.6;margin:0 0 20px">' + msg + '<br>解锁全部 ' + Object.keys(featureNames).length + ' 项高级功能</p>' +
    '<button onclick="this.closest(\'div[style]\').remove()" style="border:0;background:#3b7dd8;color:#fff;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:13px">了解 Pro 版 →</button>' +
    '<br><button onclick="this.closest(\'div[style]\').remove()" style="border:0;background:none;color:#6b7b8d;padding:8px;cursor:pointer;font-size:12px;margin-top:8px">稍后再说</button>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// ========== 辅助函数 ==========
function getTierLabel(tier) {
  var labels = { 'free': '免费版', 'pro': 'Pro', 'enterprise': '企业版' };
  return labels[tier] || tier;
}

function translateAuthError(msg) {
  if (msg.includes('Invalid login credentials')) return '邮箱或密码错误';
  if (msg.includes('Email not confirmed')) return '请先验证邮箱';
  if (msg.includes('User already registered')) return '该邮箱已注册';
  if (msg.includes('Password should be at least')) return '密码至少需要6个字符';
  if (msg.includes('Too many requests')) return '请求太频繁，请稍后再试';
  return msg;
}

// ========== 记录查询历史 ==========
async function recordQuery(queryType, queryText, resultSummary) {
  if (!supabaseClient || !mercatorUser) return;

  await supabaseClient.from('query_history').insert({
    user_id: mercatorUser.id,
    query_type: queryType,
    query_text: queryText,
    result_summary: resultSummary
  });
}

// ========== 收藏管理 ==========
async function addWatchlistItem(itemType, itemId, itemName, itemData) {
  if (!supabaseClient || !mercatorUser) {
    toast('请先登录');
    return { success: false };
  }

  var result = await supabaseClient.from('watchlist_items').insert({
    user_id: mercatorUser.id,
    item_type: itemType,
    item_id: itemId,
    item_name: itemName,
    item_data: itemData || {}
  });

  if (result.error) {
    toast('收藏失败：' + result.error.message);
    return { success: false };
  }

  toast('已添加到关注列表');
  return { success: true };
}

async function removeWatchlistItem(itemType, itemId) {
  if (!supabaseClient || !mercatorUser) return;

  await supabaseClient.from('watchlist_items')
    .delete()
    .eq('user_id', mercatorUser.id)
    .eq('item_type', itemType)
    .eq('item_id', itemId);

  toast('已取消关注');
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
  // 等待 Supabase SDK 加载
  setTimeout(initMercatorAuth, 100);
});
