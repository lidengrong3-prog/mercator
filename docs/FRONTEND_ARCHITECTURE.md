# Frontend Architecture

The production frontend remains a static application assembled by `scripts/build_public_site.py`. `index.html` owns document structure; CSS and JavaScript are external resources. The build selects one of `config/environments/{development,test,production}.json`, generates `JAY_APP_CONFIG`, injects the matching CSP connect origin, and gives every local asset a content-hashed filename.

Legal document versions live in `config/legal-versions.json` and are injected into the same runtime configuration. Authentication requires explicit acceptance of those exact versions. Supabase stores one append-only `user_legal_consents` row per user/version pair with both the acceptance time and database receipt time; authenticated users can read and insert only their own records and cannot update or delete consent history.

## Styles

Styles load from broad legacy rules to product-shell overrides:

1. `assets/styles/legacy-foundation.css`: original page and module foundations.
2. `assets/styles/legacy-theme.css`: later historical theme rules retained for compatibility.
3. `assets/app-shell.css`: current product shell and final design overrides.
4. `assets/styles/workspaces.css`: report, settings, data, tools, and responsive workspaces; loaded only when one of those pages opens.

Responsive layout uses only two shared boundaries: phone (`<= 640px`), tablet (`641-1024px`), and desktop (`>= 1025px`). `assets/responsive.js` exposes the same contract to JavaScript and writes the active mode to `html[data-viewport]`.

## Runtime order

Browser scripts are classic deferred scripts because the existing modules intentionally share global functions and state. Their order is a runtime contract:

1. `assets/app-shell.js`: icons, search focus, and mobile-shell hooks.
2. `assets/js/market-scope.js`: canonical market/platform/category scope and metadata-only catalog registry.
3. `assets/js/catalog.js`: sourced data loading, remote catalog hydration, and shared data helpers.
4. `assets/js/report-quality.js`: shared report evidence checks, citation rules, and publishability gates.
5. `assets/js/report-engine.js`: deterministic report assembly, source attribution, and report quality evaluation.
6. `assets/js/markets-policies.js`: countries, platforms, policies, and rules.
7. `assets/js/content-overview.js`: content intelligence and overview rendering.
8. `assets/js/reports-decisions.js`: report UI, watchlist, tools, comparisons, pricing, and AI request entry points.
9. `assets/js/auth-data.js`: Supabase Auth, quality state, canonical user-data access, and workspace hydration.
10. `assets/js/unified-search.js`: the top-bar search index and result page; kept in the initial shell because search is a global entry point.
11. `assets/js/product-enhancements.js`: routing, feedback, role view, final initialization, and small UI enhancements.
12. `assets/page-loader.js`: loads products/shops, alerts/settings, resource center, and workspace styles on first navigation only.

The report path must keep `report-quality.js` before `report-engine.js`, and both must load before the report UI in `reports-decisions.js`. Unified search must load after `auth-data.js`, so its index can consume authenticated canonical records, and before `product-enhancements.js`, which performs final routing and initialization.

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

`npm test` checks every local script referenced by `index.html`, verifies the resource order, environment isolation, hashed production artifact, and performance budgets. `npm run test:browser` covers desktop, tablet, small-phone, large-phone, and page-level lazy loading workflows.
