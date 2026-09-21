# AI Gateway deployment

The browser calls this authenticated Supabase Edge Function using one
provider-neutral contract. Requests carry `request_id`, `task_type`,
`agent_key`, `provider`, `messages`, `workspace_id`, `retrieval` and a safe
`data_disclosure` summary. Responses preserve a Chat Completions-compatible
`choices` shape and add `jay_gateway` metadata; failures include an error code,
request ID, provider, retryability and a user-facing suggestion. Prompt and
response bodies are never copied into operational logs.

```bash
supabase secrets set DEEPSEEK_API_KEY=... DEEPSEEK_MODEL=deepseek-chat AI_REQUESTS_PER_MINUTE=20 AI_PROVIDER_TIMEOUT_MS=25000 AI_GATEWAY_TIMEOUT_MS=55000
supabase secrets set COZE_API_TOKEN=... COZE_BOT_ID_MARKET_QA=... COZE_POLL_INTERVAL_MS=500 COZE_POLL_MAX_ATTEMPTS=100 DOUBAO_API_KEY=... DOUBAO_MODEL=... OPENAI_API_KEY=... OPENAI_MODEL=...
supabase secrets set ALLOWED_ORIGINS=https://lidengrong3-prog.github.io
supabase functions deploy ai-proxy
```

DeepSeek and Doubao use their OpenAI-compatible Chat Completions endpoints;
OpenAI and Codex use the Responses API; Coze uses asynchronous Chat v3:
`/v3/chat`, `POST /v3/chat/retrieve`, and `GET /v3/chat/message/list`.
Credentials are read only from Edge Function Secrets. WorkBuddy is registered
as disabled until an official API, webhook, or MCP contract is confirmed.

The router selects one agent and an ordered primary/fallback route. It never
broadcasts a question to all providers. A workspace token reservation is made
once per logical `request_id` and finalized once after the route succeeds or
released once after all attempts fail. `ai_provider_attempt_logs` records
provider, model, status, duration, token usage and safe error metadata without
prompts or response bodies.

`verify_jwt = true` is configured in `supabase/config.toml`, so anonymous demo
sessions cannot call a provider. DeepSeek remains the required baseline;
other adapters are enabled only when their credentials exist and the provider
catalog is not manually disabled. Apply
`20260925000000_multi_ai_gateway.sql` after the existing migrations.
Estimated cost stays `0` until the actual input/output price secrets are configured.
