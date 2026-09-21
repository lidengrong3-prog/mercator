# 多 AI Gateway

## 统一入口

浏览器只调用 `supabase/functions/v1/ai-proxy`，不会接触任何供应商密钥，也不会拼接供应商 URL。请求至少包含登录会话、`workspace_id`、`messages` 和 `request_id`；推荐同时传入：

- `task_type`：`market_qa`、`report`、`translation`、`course_qa`、`code` 或 `automation`。
- `agent_key`：从 `ai_agent_catalog` 选择的智能体。
- `provider`：`auto` 或明确的供应商键。
- `retrieval`：正式历史投影检索设置；正式投影始终在联网检索之前处理。
- `data_disclosure`：发送范围摘要和用户同意状态。摘要不含工作区原文。

响应统一为 Chat Completions 兼容的 `choices` 形状，并附加 `jay_gateway`：实际供应商、模型、智能体、是否回退、尝试过的供应商和发送范围。失败响应包含稳定的 `request_id`、错误类型、供应商、是否可重试和建议。

## 供应商适配

| 供应商 | 适配方式 | Secrets | 允许任务 |
| --- | --- | --- | --- |
| DeepSeek | OpenAI 兼容 `/chat/completions` | `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` | 市场问答、报告、分析、翻译、预警 |
| Coze | `/v3/chat` + retrieve/message list | `COZE_API_TOKEN`、按任务的 `COZE_BOT_ID_*` | 市场分析、报告、课程问答 |
| 豆包 | 火山方舟 OpenAI 兼容 `/chat/completions` | `DOUBAO_API_KEY`、`DOUBAO_MODEL` | 中文分析、市场问答、报告、翻译 |
| OpenAI | Responses API `/v1/responses` | `OPENAI_API_KEY`、`OPENAI_MODEL` | 通用推理、市场问答、报告、翻译 |
| Codex | Responses API | `CODEX_API_KEY`、`CODEX_MODEL` | 代码、自动化、系统维护 |
| WorkBuddy | 暂停 | 无 | 等确认正式 API、Webhook 或 MCP |

OpenAI Responses 的请求和输出字段以[官方 OpenAI Responses API 文档](https://platform.openai.com/docs/api-reference/responses)为准；网关会把 `output_text` 和 `usage.input_tokens/output_tokens` 归一化。当前环境访问官方文档可能受到 Cloudflare 限制，部署前应由 CI 或管理员确认该页面仍可访问。

## 路由和额度

`ai_routing_policies` 先匹配工作区，再匹配全局任务策略；当前全局策略将 Coze 作为
`market_qa`、`report` 和 `course_qa` 的主生成方，DeepSeek 作为故障回退。不会把同一
问题群发给所有供应商。Codex 只接受代码和维护任务，WorkBuddy 即使被客户端指定也会被拒绝。

一个逻辑请求只使用一个 `request_id`。网关在调用供应商前执行一次 `reserve_workspace_ai_token_quota`，主供应商失败时复用该预留调用备用供应商，最终只执行一次 `finalize_workspace_ai_token_reservation`（成功结算或失败释放）。

`ai_request_logs` 保存请求级结果；`ai_provider_attempt_logs` 保存每一次供应商尝试；触发器将其汇总到 `ai_provider_usage_daily`，可按工作区、供应商、模型和任务统计成本与失败率。三张表都不保存提示词、完整响应或密钥。

## 启停和验证

供应商是否可用由两层共同决定：目录中的 `status` 不能是 `disabled`，且 Edge Function Secret 必须完整。管理员可在 `ai_provider_catalog` 停用供应商，不需要重新发布前端。Coze Chat v3 是异步接口：网关创建 chat、轮询 `/v3/chat/retrieve`，完成后读取 `/v3/chat/message/list`。三个 Bot ID 按任务从 `COZE_BOT_ID_MARKET_QA`、`COZE_BOT_ID_REPORT`、`COZE_BOT_ID_COURSE` 读取，也兼容单一 `COZE_BOT_ID`。

部署后应验证：

1. 主供应商返回 401、403、429、5xx 或超时后，备用供应商使用同一个 `request_id` 成功返回。
2. 主备切换只产生一次工作区额度结算，并在 `ai_provider_attempt_logs` 中留下两次尝试。
3. DeepSeek 拒绝联网参数时，网关自动重试无搜索请求并标记 `fallback_used`。
4. `code` 之外的任务指定 Codex 会得到 `AI_PROVIDER_FORBIDDEN`；WorkBuddy 始终不可用。
5. 前端总览和报告均显示实际供应商、智能体和发送给第三方 AI 的数据范围。

## 第 31 项：多 AI 真实验收

正式发布的 `authenticated-acceptance` 会在隔离工作区执行两次真实请求：第一
次固定由 DeepSeek 成功，第二次只在网关边界故障注入 DeepSeek，然后要求指定的
Coze、豆包或 OpenAI 通过真实供应商 API 成功。备用供应商不能用模拟响应替代。

在 GitHub `production` Environment 中设置：

```text
AI_LIVE_ACCEPTANCE_PRIMARY_PROVIDER=deepseek
AI_LIVE_ACCEPTANCE_FALLBACK_PROVIDER=coze
```

对应供应商密钥仍只放 Supabase Edge Function secrets/GitHub Environment secrets。
验收结果只保留请求 ID、模型、状态、耗时、尝试顺序、错误码、额度结算和不含密钥
的 `sha256:` 配置指纹；提示词、回答、API key 和完整 URL 不写入验收工件。验收流量
带 `acceptance_run_id`，供应商尝试日志在验收结束后随隔离工作区清理，且不会进入
生产每日成本汇总。`production_release_check.py` 会拒绝缺少真实主调用、真实回退、
两条尝试或单次额度结算证据的发布。
