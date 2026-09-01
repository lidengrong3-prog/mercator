# AI proxy deployment

The browser calls this authenticated Supabase Edge Function. It validates the
Supabase user again, enforces per-user request and monthly Token limits, applies
an upstream timeout, and writes model/Token/duration/cost/error metadata to
`ai_request_logs`. Prompt and response bodies are never copied into the log.

```bash
supabase secrets set DEEPSEEK_API_KEY=... DEEPSEEK_MODEL=deepseek-chat AI_REQUESTS_PER_MINUTE=20
supabase secrets set ALLOWED_ORIGINS=https://lidengrong3-prog.github.io
supabase functions deploy ai-proxy
```

`verify_jwt = true` is configured in `supabase/config.toml`, so anonymous demo sessions cannot call the provider.
Apply `20260901010000_production_hardening.sql` before deployment. Estimated
cost stays `0` until the actual input/output price secrets are configured.
