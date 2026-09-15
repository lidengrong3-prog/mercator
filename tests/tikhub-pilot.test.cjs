const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('TikHub pilot is private, traceable and explicitly scoped', () => {
  const collector = read('scripts', 'collect_tikhub_pilot.py');
  const migration = read('supabase', 'migrations', '20260923000000_tikhub_pilot.sql');
  const worker = read('scripts', 'collection_worker.py');
  const enqueue = read('scripts', 'enqueue_collection_tasks.py');
  for (const fragment of [
    'TIKHUB_API_KEY', 'TIKHUB_COOKIE_SECRET', 'source_kind', 'traceable',
    'third_party_provider', 'private_data_artifacts', 'upload_private_bytes',
    'request_parameters_hash', 'response_hash', 'public_display_allowed',
    'product_search', 'product_detail', 'seller_profile', 'shop_analytics',
    'MAX_REQUESTS_PER_RUN', 'TIKHUB_PILOT_ENABLED',
  ]) assert.match(collector, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const fragment of [
    'tikhub_pilot_configs', 'tikhub_endpoint_catalog', 'tikhub_field_mappings',
    'tikhub_pilot_runs', 'tikhub_fetch_events', 'tikhub_pilot_reports',
    "source_category = 'third_party_provider'", "authorization_status = 'pending'",
    "publication_status", "public_display_allowed BOOLEAN NOT NULL DEFAULT FALSE",
    'UNIQUE (pilot_key, run_date)', 'TIKHUB_API_KEY',
  ]) assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(worker, /"tikhub_pilot":\s*"collect_tikhub_pilot\.py"/);
  assert.match(enqueue, /"tikhub_pilot":\s*\{/);
  assert.match(enqueue, /"request_count": 80/);
});

test('TikHub pilot never accepts an API key or arbitrary shell command as a task argument', () => {
  const worker = read('scripts', 'collection_worker.py');
  const collector = read('scripts', 'collect_tikhub_pilot.py');
  assert.doesNotMatch(worker, /parameters.*api-key|--api-key/);
  assert.doesNotMatch(collector, /add_argument\(["']--api-key/);
  assert.match(worker, /fixture must be a relative path without/);
});

test('TikHub content snapshots remain private until an explicit publication gate', () => {
  const collector = read('scripts', 'collect_tikhub_pilot.py');
  const worker = read('scripts', 'collection_worker.py');
  const enqueue = read('scripts', 'enqueue_collection_tasks.py');
  const gate = read('supabase', 'migrations', '20260924030000_tikhub_publication_gate.sql');
  for (const fragment of ['video_search', 'video_detail', 'creator_profile', 'video_product_relation',
    'platform_content_id', 'content_snapshots', 'content_trend_count']) {
    assert.match(collector, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(worker, /"tikhub_content":\s*"collect_tikhub_pilot\.py"/);
  assert.match(enqueue, /"tikhub_content":\s*\{/);
  assert.match(gate, /promote_tikhub_formal_publications/);
  assert.match(gate, /verification_status = 'verified'/);
  assert.match(gate, /source_is_publishable\('tikhub'\)/);
});
