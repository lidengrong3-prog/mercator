const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('source governance migration contains lifecycle, authorization and field allowlists', () => {
  const migration = read('supabase', 'migrations', '20260917000000_source_governance.sql');
  assert.match(migration, /subject_name TEXT/);
  assert.match(migration, /trust_level TEXT/);
  assert.match(migration, /source_category TEXT/);
  assert.match(migration, /authorization_expires_at TIMESTAMPTZ/);
  assert.match(migration, /api_pricing JSONB/);
  assert.match(migration, /rate_limit_requests INTEGER/);
  assert.match(migration, /allowed_display_fields TEXT\[\]/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.source_is_collectable/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.source_is_publishable/);
  assert.match(migration, /CREATE POLICY market_data_applicability_public_read[\s\S]*source_is_publishable\(source_key\)/);
  assert.match(migration, /CREATE TRIGGER trg_guard_formal_source_governance/);
  assert.match(migration, /'traceable-feed'.*'industry_media'/s);
  assert.match(migration, /'tikhub'.*'third_party_provider'/s);
});

test('public renderers prefer the governed source category', () => {
  const policies = read('assets', 'js', 'markets-policies.js');
  const search = read('assets', 'js', 'unified-search.js');
  const report = read('assets', 'js', 'report-engine.js');
  assert.match(policies, /source_category\|\|record\.source_category/);
  assert.match(policies, /official_policy:'官方政策\/监管记录'/);
  assert.match(policies, /third_party_provider:'第三方数据服务商'/);
  assert.match(search, /item\.source_category \|\| item\.sourceCategory/);
  assert.match(report, /publicationStatus === 'quarantined'/);
  assert.match(report, /\['expired', 'revoked', 'pending'\]\.indexOf\(authorizationStatus\)/);
  assert.match(report, /sourceCategory: text\(record/);
});
