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
- Classic deferred scripts load in the explicit order documented in `docs/FRONTEND_ARCHITECTURE.md`, preserving direct GitHub Pages deployment without a build step.
- GitHub Actions collects and commits data every four hours.
- Supabase stores market data, authenticated user data, and profiles.
- `data/market_scope.json` is the publishable local catalog manifest; the browser hydrates it first and then replaces metadata with the active Supabase catalog when available.
- Authenticated workspace assets such as comparison schemes, filter templates, report templates, groups, collections, and drafts are stored in `saved_workspace_items`.
- Enterprise-service requests are stored in `sales_leads`; profile contact fields live in `profiles.phone` and `profiles.job_title`.
- Workspace membership and invitations are stored in `workspaces`, `workspace_members`, and `workspace_invites`; the settings page exposes real role/status state with RLS protection.
- In-app notification events are stored in `notification_events`; `notification_deliveries` is a retryable ledger reserved for the future mail/Webhook/企业微信/飞书 worker.
- PDF export uses `report_exports` plus the JWT-protected `report-export` Edge Function and private `reports` Storage bucket; local print is an explicit fallback only.
- Report generation and AI operations are traced through `report_runs` and `ai_request_logs`; prompts and report bodies are not copied into the operational ledger. Export jobs use per-user idempotency keys.
- Parsed product/category uploads are stored as the authenticated `product_catalog_import` workspace asset and use an account-scoped browser cache. Signing out clears the in-memory copy before another account can hydrate.
- Supabase Edge Function `ai-proxy` calls the AI provider; provider credentials never enter the browser.
- Static JSON remains a visible fallback when Supabase is unavailable.
- `scripts/validate_data.py` checks structure, minimum counts, unique IDs, sources, URLs, dates, and freshness before any Supabase write.
- `data/quality_report.json` drives the product's healthy, degraded, stale, and failed data states.
- Every factual record uses the provenance envelope: `source_kind` (`official`, `traceable`, `uploaded`, `derived`, `demo`), `source_type`, `source_url`/`source_record_id`, collection/publication/effective timestamps, `verification_status`, verification notes, and an evidence hash. The data trust center reports both the raw file count and the current-scope/formal-publication count; demo, pending, rejected, and out-of-scope records remain auditable but cannot enter formal pages or reports. Legacy files may show a compatibility-inference warning until they are explicitly re-collected or reviewed; the warning is not treated as manual verification.
- Supabase migration `20260830010000_data_provenance.sql` adds `data_source_registry` and `raw_data_records`. Raw evidence is retained for audit/reprocessing, while `market_data_applicability` is the normalized scope-filtered projection exposed to the browser.
- The provenance operating contract and review flow are documented in [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).
- CPSC recalls come from the official SaferProducts API and retain the original CPSC recall URL, manufacturer country, product, and hazard fields.

Run the publication gate locally with:

```bash
python scripts/validate_data.py
python scripts/sync_to_supabase.py --dry-run
```

A failed or stale critical dataset returns a non-zero exit code and blocks automated publication. Warnings remain publishable but are shown as a degraded state in the product.

## Deployment checklist

1. For a fresh project, apply `supabase/schema.sql`, `supabase/phase2_schema.sql`, and `supabase/monitored_shops.sql` once.
2. Apply `supabase/migrations/20260825000000_unify_user_data.sql`, `supabase/migrations/20260826010000_workspaces.sql`, `supabase/migrations/20260826020000_notifications.sql`, `supabase/migrations/20260826030000_report_exports.sql`, and `supabase/migrations/20260826040000_billing_admin.sql`. They are idempotent; the workspace migration creates a default workspace for existing profiles.
3. Apply `supabase/migrations/20260830000000_market_catalog.sql`, `supabase/migrations/20260830010000_data_provenance.sql`, `supabase/migrations/20260831000000_platform_rule_versions.sql`, `supabase/migrations/20260831010000_regulatory_domains.sql`, `supabase/migrations/20260831020000_industry_advisory.sql`, `supabase/migrations/20260831030000_report_material_snapshots.sql`, `supabase/migrations/20260901000000_report_output_lifecycle.sql`, and `supabase/migrations/20260901010000_production_hardening.sql` for versioned catalogs, report snapshots, user isolation, idempotency, and operational telemetry.
4. Configure `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, and `ALLOWED_ORIGINS` as Supabase secrets.
5. Deploy `supabase/functions/ai-proxy`, `supabase/functions/report-export`, `supabase/functions/report-docx`, and `supabase/functions/admin-summary`; JWT verification is enabled in `supabase/config.toml`. Configure `SUPABASE_SERVICE_ROLE_KEY` only as an Edge Function secret.
6. Confirm GitHub secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FRED_API_KEY`, `CENSUS_API_KEY`, `REGULATORY_TRANSLATION_API_URL`, `REGULATORY_TRANSLATION_API_KEY`, and `REGULATORY_TRANSLATION_MODEL`. The translation step runs before validation and fails when a newly collected regulatory record cannot be converted to Simplified Chinese. The sync workflow publishes the frontend's `market_data` bundle by default; only set `SUPABASE_SYNC_LEGACY_TABLES=1` for a separately provisioned legacy fan-out schema.
7. Run both quality workflows successfully before merging to `main`.

The production release workflow enforces `quality -> migrations -> secrets -> Edge Functions -> two-account authenticated acceptance -> GitHub Pages -> production smoke`. Configure the `production` environment and switch GitHub Pages source to GitHub Actions before enabling releases. See [docs/PRODUCTION_ACCEPTANCE.md](docs/PRODUCTION_ACCEPTANCE.md).

Team invite records are intentionally not reported as emailed until a mail provider or invitation Edge Function is configured. See [docs/WORKSPACES.md](docs/WORKSPACES.md).

`billing-checkout` is a server-controlled Stripe checkout foundation, not a complete production billing system. Keep production charging disabled until a verified Stripe webhook updates `user_subscriptions` and records idempotent `billing_events`.

Never commit a service-role key, payment secret, or AI provider key. `.env.example` contains names and placeholders only.
