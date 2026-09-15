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
- 独立 `collection_worker.py` 负责高频采集、历史回填和第三方 API 调用；GitHub Actions 只负责测试、部署、低频健康检查和紧急入队。原始/付费输出写入私有数据层，公开仓库只保留白名单正式投影。
- Supabase stores market data, authenticated user data, and profiles.
- `data/market_scope.json` is the publishable local catalog manifest; the browser hydrates it first and then replaces metadata with the active Supabase catalog when available.
- Authenticated workspace assets such as comparison schemes, filter templates, report templates, groups, collections, and drafts are stored in `saved_workspace_items`.
- Enterprise-service requests are stored in `sales_leads`; profile contact fields live in `profiles.phone` and `profiles.job_title`.
- Reports, report materials, watchlists and saved workspace assets carry `workspace_id`. Active members can read shared data, owners/admins/editors can write, viewers are read-only, and cross-workspace reads remain blocked by RLS. `workspace-invite` sends a real seven-day invitation through Resend and records provider delivery state.
- Notification events are stored in `notification_events`. Enabled email, 企业微信 and 飞书 channels are queued in `notification_deliveries`, sent by `notification-dispatch`, and retried by the five-minute worker. Robot Webhooks are AES-GCM encrypted and never returned to the browser.
- Public notification delivery stays disabled until the 15-item live gate in `docs/NOTIFICATION_LIVE_ACCEPTANCE.md` passes. Registration and release access advance through internal, invite beta, public beta and general stages under `docs/STAGED_PUBLIC_ROLLOUT.md`.
- Formal report saving uses the JWT-protected `report-save` Edge Function, which rechecks quality, scope, coverage and citations before writing `generated_reports`. PDF/DOCX export uses the same server validation through `report-export`/`report-docx` and the private `reports` Storage bucket; local print is an explicit fallback only.
- Report generation and AI operations are traced through `report_runs` and `ai_request_logs`; prompts and report bodies are not copied into the operational ledger. Export jobs use per-user idempotency keys.
- Parsed product/category uploads are stored as the authenticated `product_catalog_import` workspace asset and use an account-scoped browser cache. Signing out clears the in-memory copy before another account can hydrate.
- Supabase Edge Function `ai-proxy` calls the AI provider; provider credentials never enter the browser.
- Static JSON remains a visible fallback when Supabase is unavailable. The fallback is a current-scope formal projection: only the 11 files listed in `public-data-manifest.json` are published, and pending, rejected, demo, quarantine, baseline, raw collector and sync-log data stays private.
- `scripts/collect_data.py` reads `data/market_scope.json` and only runs collectors for active markets and market-platform links whose `data_status` is `configured`. Query parameters are UTF-8 encoded instead of being interpolated into URLs.
- The ephemeral `data/collection_run.json` records every attempted source's scope, success/failure state, request counts, duration and record counts. After validation it is stored only in the private data layer; Actions retains the compact `quality_report.json` summary. A failed core source blocks every Supabase write. Queue, lease, retry, circuit-breaker and TikHub budget behavior is documented in [docs/COLLECTION_WORKER.md](docs/COLLECTION_WORKER.md).
- `data/us_market/*.json` keeps `content_updated_at`, `last_attempted_at`, `last_checked_at`, and `collection_status` separate. A Federal Register outage may reuse the last cache, but cannot advance `generated_at`/`as_of`; a partial response is marked `degraded`, and a total failure is rejected by the quality gate.
- `data/quality_report.json` drives the product's healthy, degraded, not-connected, stale, and failed data states. Empty tax/access datasets are explicitly `not_connected`; they are not treated as healthy and cannot support deterministic conclusions.
- Every factual record uses the provenance envelope: `source_kind` (`official`, `traceable`, `uploaded`, `derived`, `demo`), `source_type`, `source_url`/`source_record_id`, collection/publication/effective timestamps, `verification_status`, verification notes, and an evidence hash. The data trust center reports both the raw file count and the current-scope/formal-publication count; demo, pending, rejected, and out-of-scope records remain auditable but cannot enter formal pages or reports. Legacy files may show a compatibility-inference warning until they are explicitly re-collected or reviewed; the warning is not treated as manual verification.
- Supabase migrations `20260830010000_data_provenance.sql`, `20260915000000_private_data_boundaries.sql` and `20260917000000_source_governance.sql` add the raw evidence layer, source registration and authorization ledger, per-source price/rate/retention/field policies, private artifact index and private Storage bucket. `market_data_applicability` remains the normalized projection and carries a service-only raw-record link.
- The provenance operating contract and review flow are documented in [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md); source onboarding, expiry and quarantine rules are documented in [docs/SOURCE_GOVERNANCE.md](docs/SOURCE_GOVERNANCE.md).
- The public/private repository boundary, CI checks, retention policy and historical scan procedure are documented in [docs/REPOSITORY_PRIVACY.md](docs/REPOSITORY_PRIVACY.md).
- CPSC recalls come from the official SaferProducts API and retain the original CPSC recall URL, manufacturer country, product, and hazard fields.

Run the publication gate locally with:

```bash
# Private collection Worker: validate raw inputs, then publish to Supabase.
python scripts/backfill_provenance.py  # only when upgrading an existing evidence cache
python scripts/validate_data.py
python scripts/sync_to_supabase.py --dry-run

# Public repository/Pages checkout: read-only projection audit; no private inputs required.
python scripts/validate_data.py --public-projection
python scripts/repository_privacy_check.py
```

A failed or stale critical dataset returns a non-zero exit code and blocks automated publication. Warnings remain publishable but are shown as a degraded state in the product. `--public-projection` never rewrites `data/quality_report.json`; it requires the Worker's existing report to be publishable and verifies that every checked-in public file matches its `formal_records` count and provenance contract. GitHub code deployment does not run `sync_to_supabase.py`; collection publication belongs to the independent Worker.

## Deployment checklist

1. Run `python scripts/validate_migration_chain.py` to verify ordering, dependencies and legacy bootstrap coverage.
2. Start a local Supabase stack and run `npx supabase db reset`; a fresh database is built solely from the ordered files in `supabase/migrations/`.
3. For production, run `npx supabase db push --linked --include-all`. The foundation migration is idempotent, so existing projects keep their data while recording the formerly manual schema objects in migration history.
4. Configure `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, and `ALLOWED_ORIGINS` as Supabase secrets.
5. Deploy the functions listed in `supabase/config.toml`. `notification-dispatch` and `billing-webhook` disable Supabase gateway JWT checks because they perform application-level service/JWT or Stripe-signature validation; other browser functions require JWT. Configure `SUPABASE_SERVICE_ROLE_KEY` only as an Edge Function secret.
6. Deploy the independent Worker from `Dockerfile.worker` with a persistent `/app/data` volume and service-only provider secrets. During migration, `data-update.yml` keeps the old four-hour collector as a fallback; it switches to queue-only scheduling only when `COLLECTION_WORKER_CUTOVER=true` and a Worker heartbeat is fresh, and falls back automatically if the Worker disappears. Regulatory translation and publication remain gated in the Worker pipeline; only set `SUPABASE_SYNC_LEGACY_TABLES=1` for a separately provisioned legacy fan-out schema.
7. Run both quality workflows successfully before merging to `main`.

The production release workflow enforces `main + clean worktree -> quality -> migrations -> secrets -> Edge Functions -> two-account API exception acceptance -> GitHub Pages -> browser disconnect recovery -> production consistency smoke`. The gate verifies real 401/403 responses, signed request-scoped 429/quota/provider-timeout paths, concurrent report/export idempotency and network recovery before completing a release. Configure the `production` environment and switch GitHub Pages source to GitHub Actions before enabling releases. `ALLOWED_ORIGINS` must contain only the formal site origin in production. See [docs/PRODUCTION_ACCEPTANCE.md](docs/PRODUCTION_ACCEPTANCE.md).

Team invitations are fail-closed: production requires `RESEND_API_KEY`, `APP_PUBLIC_URL` and a verified `WORKSPACE_INVITE_FROM_EMAIL`; the UI only reports success after Resend returns a message ID. See [docs/WORKSPACES.md](docs/WORKSPACES.md).

Formal charging is fail-closed. Keep `BILLING_ENABLED=false` until the live Stripe key, final Pro price ID and webhook signing secret are configured, and the dedicated workspace has passed all ten live acceptance scenarios. The UI only enables checkout after `billing-status` confirms the server configuration; signed webhook events update `workspace_subscriptions` and the idempotent `billing_events` ledger. The production workflow rejects public billing unless the accepted live Price ID still matches the configured Price. Effective access is calculated server-side from subscription status, period expiry and full-refund revocation. See [docs/STRIPE_LIVE_BILLING.md](docs/STRIPE_LIVE_BILLING.md).

External notification delivery is also fail-closed. Keep `NOTIFICATION_CHANNELS_ENABLED=false` until `NOTIFICATION_CONFIG_ENCRYPTION_KEY`, `RESEND_API_KEY` and a verified `NOTIFICATION_FROM_EMAIL` are configured. Enabling a channel saves the user's alert types plus current market/platform/category scope; the worker only publishes recent verified alerts with HTTPS evidence and deduplicates them by source record ID. Browser-created events remain in-app only; external deliveries are queued only for server-created verified alerts and controlled channel tests.

The public-service security, encrypted daily backups, monthly isolated restore drill, operational alerts, data export/deletion flow and production-domain checklist are documented in [docs/SECURITY_OPERATIONS.md](docs/SECURITY_OPERATIONS.md).

Never commit a service-role key, payment secret, or AI provider key. `.env.example` contains names and placeholders only.
