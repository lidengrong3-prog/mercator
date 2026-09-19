const PUBLIC_DATA_PATHS = new Set([
  '/data/access_requirements.json',
  '/data/alerts.json',
  '/data/countries.json',
  '/data/industry_advisories.json',
  '/data/market_scope.json',
  '/data/platforms.json',
  '/data/policies.json',
  '/data/quality_report.json',
  '/data/rules.json',
  '/data/taxes.json',
  '/data/us_market/macro_indicators.json',
]);

export function middleware(context) {
  const pathname = context.urlInfo && context.urlInfo.pathname
    ? context.urlInfo.pathname
    : new URL(context.request.url).pathname;
  if (PUBLIC_DATA_PATHS.has(pathname)) return context.next();
  return new Response('Not Found\n', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const config = {
  matcher: [{ source: '/data/:path*' }],
};
