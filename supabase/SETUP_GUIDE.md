# JAY观海 Supabase 上线指南

本指南对应当前生产架构：Supabase Auth、用户业务数据、市场数据和 `ai-proxy` Edge Function。

## 1. 初始化数据库

新项目按以下顺序在 Supabase SQL Editor 中各执行一次：

1. `supabase/schema.sql`
2. `supabase/phase2_schema.sql`
3. `supabase/monitored_shops.sql`
4. `supabase/migrations/20260825000000_unify_user_data.sql`
5. `supabase/migrations/20260826010000_workspaces.sql`
6. `supabase/migrations/20260826020000_notifications.sql`
7. `supabase/migrations/20260826030000_report_exports.sql`
8. `supabase/migrations/20260826040000_billing_admin.sql`
9. `supabase/migrations/20260830000000_market_catalog.sql`
10. `supabase/migrations/20260830010000_data_provenance.sql`
11. `supabase/migrations/20260831000000_platform_rule_versions.sql`
12. `supabase/migrations/20260831010000_regulatory_domains.sql`
13. `supabase/migrations/20260831020000_industry_advisory.sql`
14. `supabase/migrations/20260831030000_report_material_snapshots.sql`
15. `supabase/migrations/20260901000000_report_output_lifecycle.sql`
16. `supabase/migrations/20260901010000_production_hardening.sql`

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
- `report_runs`
- `ai_request_logs`

Deploy both `report-export` and `report-docx` Edge Functions. Reports must be
saved first; the browser passes the resulting `generated_reports.id` to each
export function so every PDF/DOCX job remains linked to its source report.
- `market_catalog`
- `platform_catalog`
- `market_platforms`
- `jurisdiction_catalog`
- `category_profiles`
- `report_template_catalog`
- `market_data_applicability`
- `data_source_registry`
- `raw_data_records`

这些表均已启用 RLS。用户业务表只允许登录用户访问自己的 `user_id`；市场目录和已核验适用性记录是公开只读数据，`anon`/`authenticated` 仅能读取 active 且已核验（或用户上传）的记录。`raw_data_records` 保留原始证据供服务端审计和重处理，默认不向匿名浏览器开放。写入仍应通过受保护的数据发布任务完成。

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
AI_PROVIDER_TIMEOUT_MS
AI_REQUESTS_PER_MINUTE
AI_MONTHLY_TOKEN_LIMIT
AI_INPUT_COST_PER_MILLION_USD
AI_OUTPUT_COST_PER_MILLION_USD
```

随后部署 `supabase/functions/ai-proxy`、`supabase/functions/report-export`、`supabase/functions/report-docx` 和 `supabase/functions/admin-summary`。函数需要服务端专用的 `SUPABASE_SERVICE_ROLE_KEY`，不得暴露到浏览器。`ALLOWED_ORIGINS` 应至少包含正式 GitHub Pages 域名；生产环境不要使用通配符。

## 5. 配置 GitHub Actions

仓库 Secrets 需要：

```text
SUPABASE_URL
SUPABASE_SERVICE_KEY
FRED_API_KEY
CENSUS_API_KEY
REGULATORY_TRANSLATION_API_URL
REGULATORY_TRANSLATION_API_KEY
REGULATORY_TRANSLATION_MODEL
```

`SUPABASE_SERVICE_KEY` 只用于服务端数据发布任务。数据工作流会先执行质量校验，失败或关键数据过期时不会写入 Supabase。同步默认只写前端读取的 `market_data` KV 表；旧版分类表 fan-out 只有在显式设置 `SUPABASE_SYNC_LEGACY_TABLES=1` 且对应 schema 已准备好时才启用。

`data/market_scope.json` 中的市场、平台、关系、品类和报告模板元数据会由
`scripts/sync_to_supabase.py` 同步到对应 catalog 表；该步骤只发布目录，不
会把目录元数据当作税率、政策或经营指标。

政策、税收和准入是三个独立数据域，分别来自 `data/policies.json`、
`data/taxes.json` 和 `data/access_requirements.json`。法规记录在发布前需运行
`python scripts/translate_regulatory_data.py`，为外文原文生成带源文本哈希的
`title_zh` / `summary_zh`。翻译服务使用 `REGULATORY_TRANSLATION_API_URL`、
`REGULATORY_TRANSLATION_API_KEY` 和 `REGULATORY_TRANSLATION_MODEL`；未完成中文
转换的正式记录会被质量闸门阻断，不会混入前端统计或报告。

GitHub Actions 使用 `--require-config` 运行翻译步骤。新采集的政策、税收或准入
记录如果没有可用翻译服务，工作流会在发布前失败，不会用英文或猜测内容替代中文。

新增迁移 `supabase/migrations/20260831010000_regulatory_domains.sql` 为税收、
准入分类和政策/税收/准入变更预警提供字段与索引。部署该迁移后再执行同步。

同步任务还会写入 `data_source_registry` 和 `raw_data_records`。`pending`、
`rejected`、`demo` 记录可以留在原始证据表中用于复核，但不会进入
`market_data_applicability` 的公开正式投影。

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
8. PDF/DOCX：登录用户调用服务端生成函数并收到私有签名 URL；另一账号不能读取导出记录或重新签发文件 URL。
9. 重复点击生成或导出不会创建重复运行或导出任务。
10. 管理后台能按用户、报告 ID 和数据版本查询报告耗时、模型、Token、成本及失败原因。

使用 `.github/workflows/deploy-production.yml` 发布，确保数据库迁移、函数和双账号验收先于前端。完整配置见 `docs/PRODUCTION_ACCEPTANCE.md`。
