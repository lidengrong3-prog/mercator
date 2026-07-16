# Mercator SaaS 上线指南

## ✅ 已完成

Phase 1 用户系统已集成到 Mercator，包括：
- 登录/注册界面（支持邮箱+密码）
- 侧边栏用户信息（动态显示用户名+等级标签）
- 用户下拉菜单（账户设置 / 退出登录）
- 访问权限控制（免费版/Pro/企业版三级）
- 升级提示弹窗（付费功能锁定+升级引导）
- 演示模式降级（未配 Supabase 时自动可用）

## 🔧 你需要做的（5分钟）

### Step 1：创建 Supabase 项目

1. 打开 https://supabase.com → 注册/登录（用 GitHub 登录最快）
2. 点击 **New Project**
   - Name: `mercator-saas`
   - Database Password: 设一个密码（记下来）
   - Region: 选 `Southeast Asia (Singapore)` 或 `Northeast Asia (Tokyo)`
3. 等 1-2 分钟，项目创建完成

### Step 2：运行数据库初始化脚本

1. 进入 Supabase 控制台 → 左侧菜单点 **SQL Editor**
2. 点击 **New Query**
3. 复制 `supabase/schema.sql` 的内容粘贴进去
4. 点 **Run**（或 Ctrl+Enter）执行
5. 看到 "Success" 表示表已创建完成

### Step 3：获取项目凭证

1. 进入 **Project Settings** → **API**（左侧菜单底部）
2. 找到 **Project URL**，复制完整地址（如 `https://xxxxx.supabase.co`）
3. 找到 **Project API keys** → **anon** `public`，复制 key 值

### Step 4：配置到 Mercator

打开 GitHub 仓库的 `index.html`，找到以下两行：

```javascript
var MERCATOR_SUPABASE_URL = 'YOUR_SUPABASE_URL';
var MERCATOR_SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

替换为你的真实值：

```javascript
var MERCATOR_SUPABASE_URL = 'https://你的项目.supabase.co';
var MERCATOR_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
```

保存 → GitHub Pages 自动重新部署。

### Step 5：测试

1. 打开 https://lidengrong3-prog.github.io/mercator/
2. 你应该看到登录界面（不是直接看到仪表盘了）
3. 点 **免费注册** → 输入邮箱和密码 → 注册
4. 注册成功后自动进入仪表盘，侧边栏显示你的名字

## 📊 功能权限说明

| 功能 | 免费版 | Pro 版 | 企业版 |
|------|:------:|:------:|:------:|
| 全球总览 | ✓ | ✓ | ✓ |
| 国家市场概览 | ✓ | ✓ | ✓ |
| 国家市场详情 | ✗ | ✓ | ✓ |
| 产品全域雷达（基础） | ✓ | ✓ | ✓ |
| 产品全域雷达（完整） | ✗ | ✓ | ✓ |
| 平台规则库 | ✗ | ✓ | ✓ |
| 报告生成中心 | ✗ | ✓ | ✓ |
| 完整预警中心 | ✗ | ✓ | ✓ |
| API 数据接口 | ✗ | ✗ | ✓ |

## 🎯 下一步

配好 Supabase 后告诉我，我来帮你：
1. 测试完整登录流程
2. 设置用户等级（把你的账号改为 Pro）
3. 添加付费集成（LemonSqueezy / Stripe）
4. 配置自定义域名
