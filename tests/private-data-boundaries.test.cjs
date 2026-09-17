const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('private data migration isolates raw artifacts and links formal records', () => {
  const migration = read('supabase', 'migrations', '20260915000000_private_data_boundaries.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.data_source_access_policies/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.private_data_artifacts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.private_sync_runs/);
  assert.match(migration, /REVOKE ALL ON public\.private_data_artifacts FROM anon, authenticated/);
  assert.match(migration, /'tikhub', 'commercial', 'service_private', FALSE, 30, 'TIKHUB_API_KEY'/);

  const registrySeed = migration.slice(
    migration.indexOf('INSERT INTO public.data_source_registry'),
    migration.indexOf('CREATE TABLE IF NOT EXISTS public.data_source_access_policies'),
  );
  for (const sourceKey of [
    'federal-register', 'ustr', 'cpsc', 'fred', 'bls', 'platform-official',
    'official-source', 'traceable-feed', 'user-upload', 'derived', 'demo',
    'tikhub', 'internal-system',
  ]) {
    assert.match(registrySeed, new RegExp(`'${sourceKey}'`), `${sourceKey} access policy must have a registry seed`);
  }
  assert.match(migration, /'private-raw-data'[\s\S]*FALSE/);
  assert.match(migration, /CREATE TRIGGER trg_link_market_data_raw_record/);
  assert.match(migration, /formal\.source_record_id = raw\.source_record_id/);
});

test('workflows publish only summaries and enforce the repository privacy gate', () => {
  const update = read('.github', 'workflows', 'data-update.yml');
  const deploy = read('.github', 'workflows', 'deploy-production.yml');
  const operations = read('.github', 'workflows', 'operations.yml');
  const quality = read('.github', 'workflows', 'quality.yml');

  assert.doesNotMatch(update, /path:\s*\|[\s\S]{0,120}data\/collection_run\.json/);
  assert.doesNotMatch(update, /git add data\//);
  assert.match(update, /prepare_public_repository_data\.py/);
  assert.match(update, /git add --[\s\S]*data\/us_market\/macro_indicators\.json/);
  assert.ok(
    update.indexOf('prepare_public_repository_data.py') < update.indexOf('repository_privacy_check.py'),
    'collector outputs must be reduced before the repository privacy gate runs',
  );
  assert.ok(
    update.indexOf('repository_privacy_check.py') < update.indexOf('Publish fresh public projections'),
    'the repository privacy gate must pass before public projections are committed',
  );
  assert.doesNotMatch(deploy, /path:\s*test-results\//);
  assert.match(deploy, /summarize_test_diagnostics\.py/);
  assert.doesNotMatch(operations, /path:\s*\|[\s\S]{0,100}jay-guanhai\.dump\.enc/);
  assert.match(operations, /private_artifact_store\.py[\s\S]*encrypted_backup/);
  assert.match(operations, /purge_private_data\.py/);
  for (const workflow of [update, deploy, operations, quality]) {
    assert.match(workflow, /repository_privacy_check\.py/);
  }
});

test('sync logs and paid source responses are never written into tracked data', () => {
  const sync = read('scripts', 'sync_to_supabase.py');
  const ignore = read('.gitignore');
  assert.doesNotMatch(sync, /os\.makedirs\(log_dir/);
  assert.match(sync, /private_sync_runs/);
  assert.match(sync, /data\/providers\/tikhub\/\*\*\/\*/);
  assert.match(ignore, /data\/providers\//);
  assert.match(ignore, /data\/_sync_logs\//);
  assert.match(ignore, /data\/us_market\/\*\.json/);
});
