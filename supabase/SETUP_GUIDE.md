# JAY观海 Supabase 上线指南

本指南对应当前生产架构：Supabase Auth、用户业务数据、市场数据和 `ai-proxy` Edge Function。

## 1. 初始化数据库

数据库只有一个结构来源：按文件名排序的 `supabase/migrations/*.sql`。不要再在 SQL Editor 中预先执行 `schema.sql`、`phase2_schema.sql`、`monitored_shops.sql` 或 `add_indexes.sql`；这些旧入口的对象已经由 `20260824000000_database_foundation.sql` 和后续迁移覆盖。

本地新库执行：

```bash
python scripts/validate_migration_chain.py
npx supabase start
npx supabase db reset
```

### 隔离数据库重建与升级演练

生产库禁止用于 `db reset`。仓库的 `Production readiness and staged rollout`
工作流提供 `migration-rehearsal` 手动操作，在 GitHub Runner 的临时 Supabase
数据库中执行以下检查：

1. 从空库依次应用当前全部 62 个迁移，并校验迁移账本、关键表、视图、函数、
   扩展、RLS、Storage 私有桶和授权。
2. 重建至第 61 个迁移，写入不含生产数据的代表性旧记录，再升级至第 62 个迁移。
3. 验证旧记录保留、Worker 心跳可写以及第二次迁移检查不存在待应用版本。

演练数据库随 Runner 销毁，结果以不含连接信息的
`database-rehearsal-result.json` Artifact 保存 30 天。新增迁移时必须同步更新脚本和
工作流中的 `EXPECTED_MIGRATION_COUNT`，防止未审查的迁移绕过演练。

`db reset` 会清空本地 Supabase 数据库并从完整迁移链重建，不能对生产库使用。已有远端项目通过正式发布工作流运行 `supabase db push --linked --include-all`；基础迁移可重复执行，会保留旧表和数据，并把原先手工创建的对象纳入迁移历史。工作区迁移会为现有 profile 补齐默认工作区。

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
- `workspace_subscriptions`
- `workspace_usage_monthly`
- `workspace_member_usage_minute`
- `ai_provider_catalog`
- `ai_agent_catalog`
- `ai_routing_policies`
- `ai_provider_attempt_logs`
- `ai_provider_usage_daily`

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
- `data_source_access_policies`
- `private_data_artifacts`
- `private_sync_runs`

这些表均已启用 RLS。用户业务表只允许登录用户访问自己的 `user_id`；市场目录和已核验适用性记录是公开只读数据。`raw_data_records`、来源授权策略、私有对象索引和同步日志对 `anon`/`authenticated` 全部撤权，只允许 service role 访问。写入仍应通过受保护的数据发布任务完成。

同时确认 `profiles` 已包含 `phone` 和 `job_title` 字段，用于账号资料页的联系电话和岗位信息。Storage 中应存在 `reports` 与 `private-raw-data` 两个私有 bucket；后者不得创建面向匿名或普通登录用户的 `storage.objects` 策略。

如接入 TikHub，只在 GitHub `production` Environment 或 Supabase Secret 中配置 `TIKHUB_API_KEY`。仓库、Pages、Actions 工件和浏览器配置中不得出现该值。TikHub 原始响应只能写入 `private-raw-data`，默认保留 30 天且禁止进入公共投影。

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

在 Supabase 项目中配置（DeepSeek 是生产基线；其他供应商按需配置）：

```text
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
ALLOWED_ORIGINS
AI_PROVIDER_TIMEOUT_MS
AI_REQUESTS_PER_MINUTE
AI_MONTHLY_TOKEN_LIMIT
AI_INPUT_COST_PER_MILLION_USD
AI_OUTPUT_COST_PER_MILLION_USD
# Coze 主生成（市场分析、报告、课程问答）
COZE_API_URL=https://api.coze.cn
COZE_API_TOKEN
COZE_BOT_ID_MARKET_QA
COZE_BOT_ID_REPORT
COZE_BOT_ID_COURSE
COZE_POLL_INTERVAL_MS=500
COZE_POLL_MAX_ATTEMPTS=100
# 可选：豆包/火山方舟
DOUBAO_API_KEY
DOUBAO_MODEL
# 可选：OpenAI Responses API
OPENAI_API_KEY
OPENAI_MODEL
# 可选：Codex，仅限 code/automation/system_maintenance 任务
CODEX_API_KEY
CODEX_MODEL
AI_FALLBACK_PROVIDERS
AI_GATEWAY_TIMEOUT_MS
# 发布前真实多 AI 验收（主供应商固定 DeepSeek，备用三选一）
AI_LIVE_ACCEPTANCE_PRIMARY_PROVIDER=deepseek
AI_LIVE_ACCEPTANCE_FALLBACK_PROVIDER=coze
```

随后部署 `supabase/functions/ai-proxy`、`supabase/functions/report-export`、`supabase/functions/report-docx` 和 `supabase/functions/admin-summary`。函数需要服务端专用的 `SUPABASE_SERVICE_ROLE_KEY`，不得暴露到浏览器。`ALLOWED_ORIGINS` 应至少包含正式 GitHub Pages 域名；生产环境不要使用通配符。未配置密钥的可选供应商会保持 `pending_config`，不会被当作可用供应商；WorkBuddy 在正式 API、Webhook 或 MCP 契约确认前保持 `disabled`。

AI 路由会先匹配当前工作区策略，再匹配全局任务策略；每条策略可指定一个主供应商和有序备用供应商。主供应商失败时只切换到下一候选，不会向所有供应商群发同一请求。部署后应在独立测试工作区逐一验证主备切换、请求编号一致、额度只结算一次，以及管理员后台的供应商尝试日志和成本统计。

正式发布工作流会自动执行第 31 项真实验收：先验证 DeepSeek 真实返回，再注入一次主供应商故障并验证 Coze、豆包或 OpenAI 的真实返回。必须配置 `AI_LIVE_ACCEPTANCE_FALLBACK_PROVIDER` 及对应供应商密钥；缺失时发布直接失败，不能用模拟数据绕过。验收工件仅包含不含密钥的配置指纹和运行元数据，验收工作区、请求、供应商尝试和额度预占会按 `acceptance_run_id` 清理。

Coze 三 Bot 的创建、提示词、Token 最小权限、GitHub/Supabase 配置和真实验收步骤见
[Coze 正式接入手册](../docs/COZE_INTEGRATION.md)。

工作区套餐迁移 `20260914000000_workspace_billing.sql` 会为每个工作区建立一条
`workspace_subscriptions`，并以 `workspace_usage_monthly` 原子记录 AI Token、报告和
导出用量。Stripe 正式结账必须传入 `workspace_id`，且只有工作区 owner/admin 可以购买
或打开账单门户；两个 editor 共享同一个工作区套餐，另一个工作区不会继承权益。
内测人工套餐只能由 service role 调用 `configure_workspace_manual_subscription(...)`，
每次变更都会写入 `admin_audit_log`。

Stripe 正式收费分成隔离验收和公众开启两个阶段。先保持 `BILLING_ENABLED=false`，设置
`BILLING_LIVE_ACCEPTANCE_MODE=true` 和唯一的 `BILLING_ACCEPTANCE_WORKSPACE_ID`，部署后
由负责人完成 live 购买、续费、失败恢复、取消、退款、webhook 重放及四端一致性核对。
全部证据通过后关闭验收模式，设置 `BILLING_ACCEPTANCE_RUN_ID`，最后才能设置
`BILLING_ENABLED=true`。详细命令、事件口径和回滚条件见
[Stripe 正式收费上线手册](../docs/STRIPE_LIVE_BILLING.md)。

外部通知同样分成隔离验收与公众开启。使用独立的
`NOTIFICATION_FROM_EMAIL` 和 `WORKSPACE_INVITE_FROM_EMAIL`，并配置
`NOTIFICATION_CONFIG_ENCRYPTION_KEY`、`RESEND_API_KEY`。验收时保持
`NOTIFICATION_CHANNELS_ENABLED=false`，只对
`NOTIFICATION_ACCEPTANCE_WORKSPACE_ID` / `NOTIFICATION_ACCEPTANCE_RUN_ID` 开启
`NOTIFICATION_LIVE_ACCEPTANCE_MODE=true`。邮件、企业微信、飞书的发送、失败、重试、
停用及系统去重/隔离共 15 项证据通过后，关闭验收模式再启用公众通知。详见
[外部通知正式验收](../docs/NOTIFICATION_LIVE_ACCEPTANCE.md)。

迁移 `20261001000000_staged_public_rollout.sql` 默认把开放阶段设为 `internal`。
管理员只能通过 readiness run 逐级进入 `invite_beta`、`public_beta` 和 `general`；
公开测试阶段的注册人数和每用户每日 AI Token 在数据库原子限制，正式发布还要求
14 天稳定窗口与收费、通知、客服、值班证据。详见
[分阶段开放与容量验收](../docs/STAGED_PUBLIC_ROLLOUT.md)。

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

`SUPABASE_SERVICE_KEY` 只用于独立采集 Worker 和服务端数据发布任务。Worker 负责高频采集、历史回填、租约续期、退避和来源预算；GitHub Actions 的 `data-update.yml` 仅用于紧急入队，`collection-health.yml` 仅做低频健康检查。质量校验失败或关键数据过期时不会写入 Supabase。同步默认只写前端读取的 `market_data` KV 表；旧版分类表 fan-out 只有在显式设置 `SUPABASE_SYNC_LEGACY_TABLES=1` 且对应 schema 已准备好时才启用。

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
9. 真实请求验证 401、403、429、AI 供应商超时和 Token 额度不足；失败日志与额度预占释放状态一致。
10. 浏览器首次请求断网后只重试一次，并以第二次真实生产响应恢复。
11. 两次并发生成或 PDF/DOCX 导出只创建一条运行或导出记录，并返回同一任务 ID。
12. 管理后台能按用户、报告 ID 和数据版本查询报告耗时、模型、Token、成本及失败原因。

使用 `.github/workflows/deploy-production.yml` 发布，确保数据库迁移、函数和双账号验收先于前端。完整配置见 `docs/PRODUCTION_ACCEPTANCE.md`。
