# JAY观海

JAY观海是面向中国工厂、跨境卖家和服务团队的市场决策情报产品。核心工作流是：

`产品或类目输入 -> 国家与平台判断 -> 证据、风险和利润 -> 看板与预警 -> AI 报告 -> 团队执行`

## Product modules

- 决策工作台：今日信号、类目机会、行动队列和重点市场。
- 国家市场：宏观、电商、消费、政策和进入建议。
- 类目与平台：商品增长、平台费用、入驻门槛与规则。
- 政策与预警：政策生效、召回、合规和平台规则变化。
- 店铺与看板：登录用户的个人监控对象和跨设备同步。
- AI 报告：使用系统证据库生成市场判断与执行计划。

## Local development

本机查找代码、数据、后端和部署文件时，先查看 [本地文件地图](docs/本地文件地图.md)。

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. The public demo is read-only; real login uses Supabase Auth.

```bash
npm test
npm run test:browser
python -m compileall -q scripts data supabase
```

## Production architecture

- GitHub Pages hosts the static application.
- `index.html` contains semantic page structure only; browser code and styles live under `assets/js` and `assets/styles`.
- Classic deferred scripts load in the explicit order documented in `docs/FRONTEND_ARCHITECTURE.md`. Production Pages artifacts are assembled by `scripts/build_public_site.py` so source data is never deployed as a directory copy.
- GitHub Actions collects and commits data every four hours.
- Supabase stores market data, authenticated user data, and profiles.
- `data/market_scope.json` is the publishable local catalog manifest; the browser hydrates it first and then replaces metadata with the active Supabase catalog when available.
- Authenticated workspace assets such as comparison schemes, filter templates, report templates, groups, collections, and drafts are stored in `saved_workspace_items`.
- Enterprise-service requests are stored in `sales_leads`; profile contact fields live in `profiles.phone` and `profiles.job_title`.
- Reports, report materials, watchlists and saved workspace assets carry `workspace_id`. Active members can read shared data, owners/admins/editors can write, viewers are read-only, and cross-workspace reads remain blocked by RLS. `workspace-invite` sends a real seven-day invitation through Resend and records provider delivery state.
- Notification events are stored in `notification_events`. Enabled email, 企业微信 and 飞书 channels are queued in `notification_deliveries`, sent by `notification-dispatch`, and retried by the five-minute worker. Robot Webhooks are AES-GCM encrypted and never returned to the browser.
- Formal report saving uses the JWT-protected `report-save` Edge Function, which rechecks quality, scope, coverage and citations before writing `generated_reports`. PDF/DOCX export uses the same server validation through `report-export`/`report-docx` and the private `reports` Storage bucket; local print is an explicit fallback only.
- Report generation and AI operations are traced through `report_runs` and `ai_request_logs`; prompts and report bodies are not copied into the operational ledger. Export jobs use per-user idempotency keys.
- Parsed product/category uploads are stored as the authenticated `product_catalog_import` workspace asset and use an account-scoped browser cache. Signing out clears the in-memory copy before another account can hydrate.
- Supabase Edge Function `ai-proxy` calls the AI provider; provider credentials never enter the browser.
- Static JSON remains a visible fallback when Supabase is unavailable. The fallback is a current-scope formal projection: only the 10 files listed in `public-data-manifest.json` are published, and pending, rejected, demo, industry-advisory, quarantine, baseline, raw collector and sync-log data stays private.
- `scripts/collect_data.py` reads `data/market_scope.json` and only runs collectors for active markets and market-platform links whose `data_status` is `configured`. Query parameters are UTF-8 encoded instead of being interpolated into URLs.
- `data/collection_run.json` records every attempted source's scope, success/failure state, request counts, duration and record counts. The scheduled policy/rule collector, US category collector, CPSC collector and FRED/BLS collector append to the same ledger; `scripts/validate_data.py` checks it together with structure, minimum counts, unique IDs, sources, URLs, dates, and freshness. A failed core source blocks every Supabase write.
- `data/us_market/*.json` keeps `content_updated_at`, `last_attempted_at`, `last_checked_at`, and `collection_status` separate. A Federal Register outage may reuse the last cache, but cannot advance `generated_at`/`as_of`; a partial response is marked `degraded`, and a total failure is rejected by the quality gate.
- `data/quality_report.json` drives the product's healthy, degraded, not-connected, stale, and failed data states. Empty tax/access datasets are explicitly `not_connected`; they are not treated as healthy and cannot support deterministic conclusions.
- Every factual record uses the provenance envelope: `source_kind` (`official`, `traceable`, `uploaded`, `derived`, `demo`), `source_type`, `source_url`/`source_record_id`, collection/publication/effective timestamps, `verification_status`, verification notes, and an evidence hash. The data trust center reports both the raw file count and the current-scope/formal-publication count; demo, pending, rejected, and out-of-scope records remain auditable but cannot enter formal pages or reports. Legacy files may show a compatibility-inference warning until they are explicitly re-collected or reviewed; the warning is not treated as manual verification.
- Supabase migration `20260830010000_data_provenance.sql` adds `data_source_registry` and `raw_data_records`. Raw evidence is retained for audit/reprocessing, while `market_data_applicability` is the normalized scope-filtered projection exposed to the browser.
- The provenance operating contract and review flow are documented in [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).
- CPSC recalls come from the official SaferProducts API and retain the original CPSC recall URL, manufacturer country, product, and hazard fields.

Run the publication gate locally with:

```bash
python scripts/backfill_provenance.py  # only when upgrading an existing evidence cache
python scripts/validate_data.py
python scripts/sync_to_supabase.py --dry-run
```

A failed or stale critical dataset returns a non-zero exit code and blocks automated publication. Warnings remain publishable but are shown as a degraded state in the product.

## Deployment checklist

1. Run `python scripts/validate_migration_chain.py` to verify ordering, dependencies and legacy bootstrap coverage.
2. Start a local Supabase stack and run `npx supabase db reset`; a fresh database is built solely from the ordered files in `supabase/migrations/`.
3. For production, run `npx supabase db push --linked --include-all`. The foundation migration is idempotent, so existing projects keep their data while recording the formerly manual schema objects in migration history.
4. Configure `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, and `ALLOWED_ORIGINS` as Supabase secrets.
5. Deploy the functions listed in `supabase/config.toml`. `notification-dispatch` and `billing-webhook` disable Supabase gateway JWT checks because they perform application-level service/JWT or Stripe-signature validation; other browser functions require JWT. Configure `SUPABASE_SERVICE_ROLE_KEY` only as an Edge Function secret.
6. The scheduled data update uses the GitHub `production` Environment. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` there. Regulatory translation may use dedicated `REGULATORY_TRANSLATION_API_URL`, `REGULATORY_TRANSLATION_API_KEY`, and `REGULATORY_TRANSLATION_MODEL` secrets, or reuse the production `DEEPSEEK_API_URL`, `DEEPSEEK_API_KEY`, and `DEEPSEEK_MODEL` secrets. A configuration preflight runs before collection and does not print the API key. The translation step then fails when a newly collected regulatory record cannot be converted to Simplified Chinese. The sync workflow publishes the frontend's `market_data` bundle by default; only set `SUPABASE_SYNC_LEGACY_TABLES=1` for a separately provisioned legacy fan-out schema.
7. Run both quality workflows successfully before merging to `main`.

The production release workflow enforces `main + clean worktree -> quality -> migrations -> secrets -> Edge Functions -> two-account API exception acceptance -> GitHub Pages -> browser disconnect recovery -> production consistency smoke`. The gate verifies real 401/403 responses, signed request-scoped 429/quota/provider-timeout paths, concurrent report/export idempotency and network recovery before completing a release. Configure the `production` environment and switch GitHub Pages source to GitHub Actions before enabling releases. `ALLOWED_ORIGINS` must contain only the formal site origin in production. See [docs/PRODUCTION_ACCEPTANCE.md](docs/PRODUCTION_ACCEPTANCE.md).

Team invitations are fail-closed: production requires `RESEND_API_KEY`, `APP_PUBLIC_URL` and a verified `WORKSPACE_INVITE_FROM_EMAIL`; the UI only reports success after Resend returns a message ID. See [docs/WORKSPACES.md](docs/WORKSPACES.md).

Formal charging is fail-closed. Keep `BILLING_ENABLED=false` until the live Stripe key, Pro price ID and webhook signing secret are configured, `billing-webhook` is registered in Stripe, and a live-mode end-to-end payment/cancel/refund test has passed. The UI only enables checkout after `billing-status` confirms this server configuration; signed webhook events update `user_subscriptions` and the idempotent `billing_events` ledger. Effective access is calculated server-side from subscription status, period expiry and full-refund revocation. AI Token usage is atomically reserved before provider calls, while report/export quotas and PDF/DOCX entitlements are enforced by database triggers.

External notification delivery is also fail-closed. Keep `NOTIFICATION_CHANNELS_ENABLED=false` until `NOTIFICATION_CONFIG_ENCRYPTION_KEY`, `RESEND_API_KEY` and a verified `NOTIFICATION_FROM_EMAIL` are configured. Enabling a channel saves the user's alert types plus current market/platform/category scope; the worker only publishes recent verified alerts with HTTPS evidence and deduplicates them by source record ID. Browser-created events remain in-app only; external deliveries are queued only for server-created verified alerts and controlled channel tests.

Never commit a service-role key, payment secret, or AI provider key. `.env.example` contains names and placeholders only.
