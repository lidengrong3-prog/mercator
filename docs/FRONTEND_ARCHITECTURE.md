# Frontend Architecture

The production frontend remains a zero-build static application so GitHub Pages can serve the repository directly. `index.html` owns document structure; CSS and JavaScript are external resources.

## Styles

Styles load from broad legacy rules to product-shell overrides:

1. `assets/styles/legacy-foundation.css`: original page and module foundations.
2. `assets/styles/workspaces.css`: report, settings, data, tools, and responsive workspaces.
3. `assets/styles/legacy-theme.css`: later historical theme rules retained for compatibility.
4. `assets/app-shell.css`: current product shell and final design overrides.

## Runtime order

Browser scripts are classic deferred scripts because the existing modules intentionally share global functions and state. Their order is a runtime contract:

1. `assets/app-shell.js`: icons, search focus, and mobile-shell hooks.
2. `assets/js/market-scope.js`: canonical market/platform/category scope and metadata-only catalog registry.
3. `assets/js/catalog.js`: sourced data loading, remote catalog hydration, and shared data helpers.
4. `assets/js/products-shops.js`: product radar and shop tracking.
5. `assets/js/markets-policies.js`: countries, platforms, policies, and rules.
6. `assets/js/content-overview.js`: content intelligence and overview rendering.
7. `assets/js/reports-decisions.js`: reports, watchlist, tools, comparisons, pricing, and AI request entry points.
8. `assets/js/auth-data.js`: Supabase Auth, quality state, canonical user-data access, and workspace hydration.
9. `assets/js/alerts-settings.js`: alerts, settings, and refresh scheduling.
10. `assets/js/product-enhancements.js`: routing, feedback, role view, final initialization, and small UI enhancements.

`market-scope.js` must execute before every module that filters or renders market
data. It exposes one immutable-shaped snapshot (`window.JAY_MARKET_SCOPE`) and
one API (`window.JAY_MARKET_SCOPE_API`); pages must not define their own market
or platform lists. The snapshot records effective market/platform/category
selection, while catalog rows additionally carry source and verification
metadata. `normalizeDataRecord`, `getRecordQuality`, and
`filterFormalRecords` provide the single browser-side provenance boundary. A
report or formal page is only allowed to consume records that match the
snapshot and have `verified` or `uploaded` status; `demo`, `pending`,
`rejected`, and unscoped records remain raw/auditable only.

`data/market_scope.json` is the local catalog manifest used by static hosting
and CI validation. Supabase's `market_catalog`, `platform_catalog`,
`market_platforms`, `jurisdiction_catalog`, `category_profiles`, and
`report_template_catalog` are the authoritative runtime metadata when present;
the local manifest remains a metadata-only fallback and never supplies market
facts or policy conclusions.

Raw source payloads are retained separately in Supabase
`raw_data_records`, keyed by `data_source_registry` and linked to normalized
`market_data_applicability` rows by source record ID/evidence hash. The data
trust center exposes raw, current-scope, formal, and excluded counts so a
report consumer can see exactly what was filtered out.

Do not reorder these files without checking their global dependencies. New cross-module data writes should use the canonical helpers in `auth-data.js`, and browser-visible provider secrets remain prohibited.

## Verification

`npm test` checks every local script referenced by `index.html`, verifies the resource order, and rejects a return to inline script/style bundles. `npm run test:browser` covers the complete desktop and mobile workflow.
