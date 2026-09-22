const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('history search payload accepts all supported filters and clamps the page size', async () => {
  const contract = await import(pathToFileURL(path.join(
    root, 'supabase', 'functions', '_shared', 'history-search-contract.mjs'
  )).href);
  const normalized = contract.normalizeHistorySearchPayload({
    query: '  Amazon commission history  ', type: 'rule', market_code: 'us',
    platform_key: 'Amazon', category_code: 'Home', year: 2024,
    source_key: 'platform-official', verification_status: 'verified',
    from: '2024-01-01', to: '2024-12-31', sort: 'newest', page_size: 500,
    cursor: {
      publication_id: '10000000-0000-4000-8000-000000000001', result_type: 'rule',
      sort_time: '2024-12-01T00:00:00Z',
    },
  });
  assert.equal(normalized.query, 'Amazon commission history');
  assert.equal(normalized.type, 'rule');
  assert.equal(normalized.marketCode, 'US');
  assert.equal(normalized.platformKey, 'amazon');
  assert.equal(normalized.categoryCode, 'home');
  assert.equal(normalized.year, 2024);
  assert.equal(normalized.sourceKey, 'platform-official');
  assert.equal(normalized.verificationStatus, 'verified');
  assert.equal(normalized.pageSize, 100);
  assert.equal(normalized.cursor.result_type, 'rule');
  assert.equal(contract.historySearchRpcPayload(normalized).p_year, 2024);
});

test('history search rejects malformed cursors and ranges', async () => {
  const contract = await import(pathToFileURL(path.join(
    root, 'supabase', 'functions', '_shared', 'history-search-contract.mjs'
  )).href);
  assert.throws(() => contract.normalizeHistorySearchPayload({
    sort: 'newest', cursor: { publication_id: 'bad', result_type: 'rule' },
  }), /INVALID_CURSOR/);
  assert.throws(() => contract.normalizeHistorySearchPayload({
    from: '2025-01-01', to: '2024-01-01',
  }), /INVALID_DATE_RANGE/);
  assert.equal(contract.normalizeHistorySearchPayload({ from: '2024-02-31' }).from, null);
});

test('migration provides FTS, trigram filters, totals and deterministic cursor pagination', () => {
  const sql = read('supabase', 'migrations', '20260922000000_server_history_search.sql');
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pg_trgm/);
  assert.match(sql, /search_document TSVECTOR GENERATED ALWAYS AS/);
  assert.match(sql, /publication_year SMALLINT GENERATED ALWAYS AS/);
  assert.match(sql, /USING GIN \(search_document\)/);
  assert.match(sql, /gin_trgm_ops/);
  assert.match(sql, /idx_formal_publications_year_cursor/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.search_formal_publications/);
  for (const filter of [
    'p_market_code', 'p_platform_key', 'p_category_code', 'p_year',
    'p_source_key', 'p_verification_status', 'p_from', 'p_to',
  ]) assert.match(sql, new RegExp(filter));
  assert.match(sql, /publication\.status = 'active'/);
  assert.match(sql, /public\.source_is_publishable\(publication\.source_key\)/);
  assert.match(sql, /raw\.publication_status = 'eligible'/);
  assert.match(sql, /raw\.verification_status IN \('verified', 'uploaded'\)/);
  assert.match(sql, /base AS MATERIALIZED/);
  assert.match(sql, /statistics AS \([\s\S]*count\(\*\) FILTER \(WHERE result_type = 'policy'\)/);
  assert.match(sql, /OR publication\.publication_year = parameters\.result_year/);
  assert.doesNotMatch(sql, /lower\(registry\.name\) LIKE/);
  assert.match(sql, /publication_id ASC/);
  assert.match(sql, /'next_cursor'/);
  assert.match(sql, /'total', \(SELECT count\(\*\) FROM scoped\)/);
  assert.match(sql, /'year', publication_year/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.search_formal_publications[\s\S]*authenticated/);
});

test('edge function authenticates and rate limits before calling the formal search RPC', () => {
  const edge = read('supabase', 'functions', 'history-search', 'index.ts');
  assert.match(edge, /\/auth\/v1\/user/);
  assert.match(edge, /enforceRateLimit/);
  assert.match(edge, /scope: 'search'/);
  assert.match(edge, /SEARCH_BACKEND_TIMEOUT/);
  assert.match(edge, /AUTH_SERVICE_UNAVAILABLE/);
  assert.match(edge, /rpc\/search_formal_publications/);
  assert.doesNotMatch(edge, /raw_source_records/);
  assert.match(read('supabase', 'config.toml'), /\[functions\.history-search\][\s\S]*verify_jwt = true/);
  assert.match(read('.github', 'workflows', 'deploy-production.yml'), /functions\/history-search\/index\.ts/);
  assert.match(read('.github', 'workflows', 'deploy-production.yml'), /ai-proxy history-search resource-library report-save/);
});

test('browser search and AI gateway share formal history identifiers', () => {
  const search = read('assets', 'js', 'unified-search.js');
  const overview = read('assets', 'js', 'content-overview.js');
  const ai = read('supabase', 'functions', 'ai-proxy', 'index.ts');
  assert.match(search, /jayFunctionRequest\('history-search'/);
  for (const id of [
    'unified-search-category', 'unified-search-year', 'unified-search-source',
    'unified-search-verification',
  ]) assert.match(read('index.html'), new RegExp(`id="${id}"`));
  assert.match(ai, /rpc\/search_formal_publications/);
  assert.match(ai, /citation_id: `H\$\{String\(index \+ 1\)\.padStart\(3, '0'\)\}`/);
  assert.match(ai, /history_url/);
  assert.match(ai, /result\.jay_retrieval/);
  assert.match(overview, /#search\\\?record=/);
  assert.match(overview, /ovr-history-citation/);
  assert.doesNotMatch(overview, /jayRagContextBlock/);
  assert.doesNotMatch(read('assets', 'js', 'reports-decisions.js'), /function jayRagBuildCorpus/);
});

test('category market questions receive macro context and an explicit evidence gap', () => {
  const ai = read('supabase', 'functions', 'ai-proxy', 'index.ts');
  const overview = read('assets', 'js', 'content-overview.js');
  assert.match(ai, /p_source_key: sourceKey/);
  assert.match(ai, /function isMacroRow/);
  assert.match(ai, /美国整体电商和零售宏观指标只能作为背景/);
  assert.match(ai, /function marketEvidenceGapSupplement/);
  assert.match(ai, /珠宝专属销售额、销量、消费者画像、平台竞争或价格带记录/);
  assert.match(ai, /categoryEvidenceMissing/);
  assert.match(overview, /无正式记录时正常回答/);
});

test('a 100k-row SQL performance and pagination acceptance fixture is available', () => {
  const benchmark = read('scripts', 'history_search_benchmark.sql');
  assert.match(benchmark, /generate_series\(1, 100000\)/);
  assert.match(benchmark, /EXPLAIN \(ANALYZE, BUFFERS, FORMAT JSON\)/);
  assert.match(benchmark, /search_formal_publications/);
  assert.match(benchmark, /duplicate or missing rows/i);
  assert.match(benchmark, /ROLLBACK/);
});
