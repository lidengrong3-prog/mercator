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
2. `assets/js/catalog.js`: base catalog data and shared helpers.
3. `assets/js/products-shops.js`: product radar and shop tracking.
4. `assets/js/markets-policies.js`: countries, platforms, policies, and rules.
5. `assets/js/content-overview.js`: content intelligence and overview rendering.
6. `assets/js/reports-decisions.js`: reports, watchlist, tools, comparisons, pricing, and AI request entry points.
7. `assets/js/auth-data.js`: Supabase Auth, quality state, canonical user-data access, and workspace hydration.
8. `assets/js/alerts-settings.js`: alerts, settings, and refresh scheduling.
9. `assets/js/product-enhancements.js`: routing, feedback, role view, final initialization, and small UI enhancements.

Do not reorder these files without checking their global dependencies. New cross-module data writes should use the canonical helpers in `auth-data.js`, and browser-visible provider secrets remain prohibited.

## Verification

`npm test` checks every local script referenced by `index.html`, verifies the resource order, and rejects a return to inline script/style bundles. `npm run test:browser` covers the complete desktop and mobile workflow.
