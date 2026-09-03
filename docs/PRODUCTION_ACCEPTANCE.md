# 生产发布与验收

## 发布顺序

`.github/workflows/deploy-production.yml` 是正式发布入口，顺序固定为：

1. 代码、数据质量、桌面端和移动端测试。
2. Supabase 数据库迁移。
3. Edge Function Secrets 与函数部署。
4. 两个真实测试账号的端到端验收。
5. GitHub Pages 前端部署。
6. 已部署正式站的真实浏览器账号验收。
7. 正式站和 Supabase API 冒烟检查。

任何步骤失败都会阻止后续步骤。GitHub Pages 的 Source 必须设置为 GitHub Actions，不能继续使用绕过该工作流的分支自动发布。

发布工作流还会在质量门禁阶段拒绝非 `main` 分支和脏工作区，并检查迁移文件名的时间顺序；`db push` 后再次读取远端 migration 列表，要求最新版本在本地和远端一致。生产 `ALLOWED_ORIGINS` 必须严格等于正式站的 `https://域名` origin，不能包含本地地址、路径或通配符。前端部署包会写入 `release.json`，记录触发提交 SHA、迁移头和正式 origin；最后的 smoke 会核对这个清单以及数据库和所有 Edge Function 路由。

## Production Environment

在 GitHub `production` Environment 中配置：

- Secrets：`SUPABASE_ACCESS_TOKEN`、`SUPABASE_PROJECT_ID`、`SUPABASE_DB_PASSWORD`、`SUPABASE_URL`、`SUPABASE_ANON_KEY`。
- AI Secrets：`DEEPSEEK_API_URL`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`ALLOWED_ORIGINS`。
- 限流与成本：`AI_REQUESTS_PER_MINUTE`、`AI_MONTHLY_TOKEN_LIMIT`、`AI_INPUT_COST_PER_MILLION_USD`、`AI_OUTPUT_COST_PER_MILLION_USD`。
- Stripe（正式收费前）：`STRIPE_SECRET_KEY`、`STRIPE_PRICE_PRO_MONTHLY`、`STRIPE_WEBHOOK_SECRET`。
- Variable：`BILLING_ENABLED`，未完成 Stripe live-mode 验收前必须保持 `false`。
- 双账号验收：`PROD_TEST_USER_A_EMAIL`、`PROD_TEST_USER_A_PASSWORD`、`PROD_TEST_USER_B_EMAIL`、`PROD_TEST_USER_B_PASSWORD`。
- Variable：`PRODUCTION_SITE_URL`，例如 `https://lidengrong3-prog.github.io/mercator/`。

Stripe 后台的 webhook URL 必须配置为 `https://<project-ref>.supabase.co/functions/v1/billing-webhook`，并订阅 `checkout.session.completed`、`customer.subscription.*`、`invoice.paid`、`invoice.payment_failed` 和 `charge.refunded`。只有签名验证成功的 live-mode 事件可以更新会员；重复事件按 Stripe event ID 去重，旧事件不得覆盖较新的订阅状态。生产环境不得设置 `STRIPE_ALLOW_TEST_EVENTS=true`。正式打开 `BILLING_ENABLED=true` 前，至少完成一次隔离测试环境验证，并在生产打开后完成受控小额购买、续费模拟、取消、付款失败和退款核对。

两个测试账号必须是不同的专用账号，不得使用管理员或真实客户账号。API 验收记录使用稳定客户端 ID，并在同一 CI 运行内复用幂等键；不同运行使用新的运行标识，避免上一次失败的导出任务阻塞重试。浏览器验收会使用带运行时间的标题创建一份独立 UI 报告，避免误打开旧验收结果，因此专用验收账号应定期清理历史导出文件。

## 验收内容

`python scripts/production_acceptance.py` 会实际验证：

- 两个账号都能真实登录。
- 账号 A 加入报告素材并保存一份上传数据快照。
- 账号 B 不能读取账号 A 的素材和上传数据。
- AI Edge Function 能生成简体中文内容，并写入模型、Token、耗时和成本日志。
- 报告保存成功，重新登录后仍可恢复。
- 账号 B 不能读取或导出账号 A 的报告。
- PDF 和 DOCX 能生成、下载并关联同一报告 ID。
- 账号 B 不能读取导出历史，也不能为账号 A 的 Storage 文件签发 URL。
- 账号 A 同样不能读取或导出账号 B 的报告、素材、上传记录和 Storage 文件。

部署完成后，`RUN_PRODUCTION_ACCEPTANCE=1 npm run test:browser:production` 会在正式站使用新的浏览器上下文验证：

- 账号 A 通过页面上传 CSV/JSON，并确认素材进入云端素材池。
- 账号 A 通过页面完成模板选择、报告生成、云端保存，并从报告页触发 PDF/DOCX 服务端导出。
- 账号 A 刷新页面、重新登录后恢复报告和导出历史。
- 账号 B 通过页面获得独立工作区，且不能读取账号 A 的素材、上传数据、报告或导出历史。

浏览器验收不会在普通本地 `npm run test:browser` 中自动运行，避免误用生产账号；生产工作流在前端部署后显式开启。

## 可观测性口径

- `report_runs`：用户、报告 ID、市场/平台/品类范围、数据版本、章节数、总耗时和失败章节。
- `ai_request_logs`：运行 ID、模型、输入/输出 Token、估算成本、耗时、HTTP 状态和错误码。
- `report_exports`：报告 ID、格式、幂等键、耗时、状态和失败原因。

日志不保存 Prompt、报告正文或原始上传文件。AI 成本只有在配置供应商每百万 Token 单价后才具有财务意义；未配置时为 `0`，不能当作免费调用结论。
