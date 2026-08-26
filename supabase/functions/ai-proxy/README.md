# AI proxy deployment

The browser calls this authenticated Supabase Edge Function. Provider credentials stay in Supabase secrets.

```bash
supabase secrets set DEEPSEEK_API_KEY=... DEEPSEEK_MODEL=deepseek-chat
supabase secrets set ALLOWED_ORIGINS=https://lidengrong3-prog.github.io
supabase functions deploy ai-proxy
```

`verify_jwt = true` is configured in `supabase/config.toml`, so anonymous demo sessions cannot call the provider.
