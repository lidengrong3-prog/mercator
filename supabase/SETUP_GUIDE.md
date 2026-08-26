# JAY观海 Supabase 上线指南

本指南对应当前生产架构：Supabase Auth、用户业务数据、市场数据和 `ai-proxy` Edge Function。

## 1. 初始化数据库

新项目按以下顺序在 Supabase SQL Editor 中各执行一次：

1. `supabase/schema.sql`
2. `supabase/phase2_schema.sql`
3. `supabase/monitored_shops.sql`
4. `supabase/migrations/20260825_unify_user_data.sql`
5. `supabase/migrations/20260826_workspaces.sql`
6. `supabase/migrations/20260826_notifications.sql`
7. `supabase/migrations/20260826_report_exports.sql`

已有项目只需执行尚未应用的脚本。上述迁移均可重复执行；统一迁移会保留旧表并迁移已有收藏、报告和偏好，不会删除兼容数据。工作区迁移会为现有 profile 补齐默认工作区。

执行后在 Table Editor 中确认以下正式用户表存在：

- `user_watchlist`
- `user_activity`
- `generated_reports`
- `user_preferences`
- `report_materials`
- `user_feedback`
- `saved_workspace_items`
- `sales_leads`
- `monitored_shops`
- `workspaces`
- `workspace_members`
- `workspace_invites`
- `notification_events`
- `notification_deliveries`
- `report_exports`

这些表均已启用 RLS，只允许登录用户访问自己的 `user_id`。其中 `sales_leads` 仅允许用户提交和读取自己的需求，其余业务表按产品需要开放对应的增删改查权限；`anon` 角色没有用户表权限。

同时确认 `profiles` 已包含 `phone` 和 `job_title` 字段，用于账号资料页的联系电话和岗位信息。Storage 中应存在名为 `reports` 的私有 bucket。

## 2. 配置认证

在 Authentication 设置中：

1. 启用 Email 登录。
2. 将正式站地址加入 Site URL 和 Redirect URLs。
3. 正式环境建议启用邮箱验证。
4. 注册一个测试账号，确认 `profiles` 和 `user_preferences` 会自动创建对应记录。

## 3. 配置前端连接

前端使用 `index.html` 中的以下公开配置：

```javascript
var JAY_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
var JAY_SUPABASE_KEY = 'YOUR_PUBLISHABLE_OR_ANON_KEY';
```

publishable/anon key 可以出现在浏览器中，安全边界由 RLS 保证。不得把 service role key、数据库密码、AI 供应商密钥或支付密钥写入前端或 Git 仓库。

## 4. 部署 AI 服务

在 Supabase 项目中配置：

```text
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
ALLOWED_ORIGINS
```

随后部署 `supabase/functions/ai-proxy` 和 `supabase/functions/report-export`。`report-export` 还需要配置服务端专用的 `SUPABASE_SERVICE_ROLE_KEY`，不得暴露到浏览器。`ALLOWED_ORIGINS` 应至少包含正式 GitHub Pages 域名；生产环境不要使用通配符。

## 5. 配置 GitHub Actions

仓库 Secrets 需要：

```text
SUPABASE_URL
SUPABASE_SERVICE_KEY
FRED_API_KEY
CENSUS_API_KEY
```

`SUPABASE_SERVICE_KEY` 只用于服务端数据发布任务。数据工作流会先执行质量校验，失败或关键数据过期时不会写入 Supabase。

## 6. 上线验收

本地先运行：

```bash
npm test
npm run test:browser
python scripts/validate_data.py
python -m compileall -q scripts tests data supabase
```

正式环境至少验收：

1. 注册、登录、退出和 token 自动续期正常。
2. 两个不同账号无法互相读取收藏、报告、偏好和反馈。
3. 素材、报告、订阅和角色设置刷新页面后仍存在，并可跨设备读取。
4. 只读演示不会请求任何用户表，也不会显示保存成功。
5. AI 请求只进入 `functions/v1/ai-proxy`，浏览器网络请求中没有供应商密钥。
6. 数据底座显示最新质量报告，校验失败时发布工作流被阻断。
7. 团队权限：所有者不能被删除或降级，非管理员无法创建邀请；受邀邮箱只能由匹配邮箱的登录用户接受。
8. PDF：登录用户调用服务端生成函数并收到私有签名 URL；函数未配置时页面明确降级为本地打印。

数据库迁移应先于前端发布，避免新版前端请求尚未创建的用户表。
