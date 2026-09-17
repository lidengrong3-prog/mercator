const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(
  root, 'supabase', 'migrations', '20260921000000_platform_rule_coverage.sql'
), 'utf8');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'data', 'rules.json'), 'utf8'));

test('platform coverage is derived from verified evidence, not catalog configuration', () => {
  assert.match(migration, /CREATE OR REPLACE VIEW public\.platform_rule_coverage/);
  assert.match(migration, /publication_status = 'eligible'/);
  assert.match(migration, /verification_status = 'verified'/);
  assert.match(migration, /raw\.source_url ~ '\^https:\/\/\[\^\/\]\+\/\.\+'/);
  assert.match(migration, /last_verified_at < NOW\(\) - INTERVAL '45 days'/);
  assert.match(migration, /cardinality\(covered_topics\) < 7/);
  assert.match(migration, /ARRAY\['amazon', 'tiktok-shop', 'aliexpress', 'ebay'\]/);
});

test('public rule projection reports honest status and traceable records', () => {
  assert.deepEqual(Object.keys(rules.platform_coverage), [
    'amazon', 'tiktok-shop', 'aliexpress', 'ebay',
  ]);
  assert.equal(rules.platform_coverage.amazon.status, 'not_connected');
  assert.equal(rules.platform_coverage['tiktok-shop'].status, 'partial');
  assert.equal(rules.platform_coverage.aliexpress.status, 'not_connected');
  assert.equal(rules.platform_coverage.ebay.status, 'partial');
  const coveredRuleCount = Object.values(rules.platform_coverage)
    .reduce((total, platform) => total + Number(platform.rule_count || 0), 0);
  assert.ok(rules.items.length > 0);
  assert.equal(rules.items.length, coveredRuleCount);
  for (const rule of rules.items) {
    assert.match(rule.source_url, /^https:\/\/[^/]+\/.+/);
    assert.ok(!Number.isNaN(Date.parse(rule.verified_at)));
    assert.ok(rule.rule_key);
    assert.ok(rule.source_record_id);
    assert.equal(rule.source_id_is_official, true);
    assert.ok(['url_query', 'url_path', 'api_field'].includes(rule.source_id_method));
    assert.equal(rule.rule_key, rule.source_record_id);
    assert.ok(String(rule.rule_version || '').trim());
    assert.ok(['fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty', 'other'].includes(rule.topic));
  }
  for (const platform of Object.values(rules.platform_coverage)) {
    assert.deepEqual(Object.keys(platform.dimensions), [
      'fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty',
    ]);
    for (const dimension of Object.values(platform.dimensions)) {
      assert.ok(['connected', 'partial', 'not_connected'].includes(dimension.status));
      assert.ok(Array.isArray(dimension.source_record_ids));
    }
  }
});
