# 生产发布与验收

## 发布顺序

`.github/workflows/deploy-production.yml` 是正式发布入口，顺序固定为：

1. 代码、数据质量、桌面端和移动端测试。
2. Supabase 数据库迁移。
3. Edge Function Secrets 与函数部署。
4. 两个真实测试账号的端到端验收。
5. GitHub Pages 前端部署。
6. 正式站和 Supabase API 冒烟检查。

任何步骤失败都会阻止后续步骤。GitHub Pages 的 Source 必须设置为 GitHub Actions，不能继续使用绕过该工作流的分支自动发布。

## Production Environment

在 GitHub `production` Environment 中配置：

- Secrets：`SUPABASE_ACCESS_TOKEN`、`SUPABASE_PROJECT_ID`、`SUPABASE_DB_PASSWORD`、`SUPABASE_URL`、`SUPABASE_ANON_KEY`。
- AI Secrets：`DEEPSEEK_API_URL`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`ALLOWED_ORIGINS`。
- 限流与成本：`AI_REQUESTS_PER_MINUTE`、`AI_MONTHLY_TOKEN_LIMIT`、`AI_INPUT_COST_PER_MILLION_USD`、`AI_OUTPUT_COST_PER_MILLION_USD`。
- 双账号验收：`PROD_TEST_USER_A_EMAIL`、`PROD_TEST_USER_A_PASSWORD`、`PROD_TEST_USER_B_EMAIL`、`PROD_TEST_USER_B_PASSWORD`。
- Variable：`PRODUCTION_SITE_URL`，例如 `https://lidengrong3-prog.github.io/mercator/`。

两个测试账号必须是不同的专用账号，不得使用管理员或真实客户账号。测试记录使用稳定客户端 ID 和幂等键，不会在每次发布时无限创建重复报告或导出任务。

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

## 可观测性口径

- `report_runs`：用户、报告 ID、市场/平台/品类范围、数据版本、章节数、总耗时和失败章节。
- `ai_request_logs`：运行 ID、模型、输入/输出 Token、估算成本、耗时、HTTP 状态和错误码。
- `report_exports`：报告 ID、格式、幂等键、耗时、状态和失败原因。

日志不保存 Prompt、报告正文或原始上传文件。AI 成本只有在配置供应商每百万 Token 单价后才具有财务意义；未配置时为 `0`，不能当作免费调用结论。
