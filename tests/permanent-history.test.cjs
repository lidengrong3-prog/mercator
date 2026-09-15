const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260918000000_permanent_history.sql'),
  'utf8',
);
const sync = fs.readFileSync(path.join(root, 'scripts', 'sync_to_supabase.py'), 'utf8');

test('permanent history migration declares all append-only history tables', () => {
  for (const table of [
    'source_fetch_runs', 'raw_source_records', 'policy_documents', 'policy_versions',
    'platform_rules', 'platform_rule_versions', 'product_entities', 'product_snapshots',
    'shop_entities', 'shop_snapshots', 'content_entities', 'content_snapshots',
    'formal_publications',
  ]) {
    assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS public\\.' + table + '\\b'));
  }
  for (const table of [
    'source_fetch_runs', 'raw_source_records', 'policy_versions',
    'platform_rule_versions', 'product_snapshots', 'shop_snapshots', 'content_snapshots',
  ]) {
    assert.match(migration, new RegExp('trg_' + table + '_append_only[\\s\\S]*?ON public\\.' + table));
  }
});

test('version changes are normalized for fee, commission, deposit and operational rule fields', () => {
  assert.match(migration, /jsonb_changed_keys/);
  assert.match(migration, /ARRAY\['fee','commission','deposit','fulfillment','prohibited','settlement','penalty'\]/);
  assert.match(migration, /previous_version_id/);
  assert.match(migration, /changed_fields TEXT\[\]/);
});

test('projection deletion cannot cascade to evidence and source allowlisting is enforced', () => {
  assert.match(migration, /formal_publication_id UUID[\s\S]*ON DELETE SET NULL/);
  assert.match(migration, /raw_source_record_id UUID[\s\S]*ON DELETE RESTRICT/);
  assert.match(migration, /formal publication requires matching eligible verified evidence/);
  assert.match(migration, /public\.allowlisted_jsonb/);
});

test('sync uses deterministic identifiers and insert-ignore for immutable history', () => {
  assert.match(sync, /def history_uuid\(namespace, \*parts\)/);
  assert.match(sync, /def build_history_rows\(/);
  assert.match(sync, /def supabase_insert_ignore\(/);
  assert.match(sync, /resolution=ignore-duplicates/);
});
