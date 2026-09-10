const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const acceptanceModuleUrl = pathToFileURL(path.join(
  root,
  'supabase',
  'functions',
  '_shared',
  'production-acceptance.mjs',
)).href;

test('production fault proof is short-lived and bound to user, scenario and request', async () => {
  const acceptance = await import(acceptanceModuleUrl);
  const serviceKey = 'service-role-test-key';
  const userId = '00000000-0000-4000-8000-000000000001';
  const scenario = 'provider_timeout';
  const requestId = 'acceptance-provider-timeout-1';
  const issuedAt = 1_780_000_000;
  const signature = createHmac('sha256', serviceKey)
    .update(acceptance.productionAcceptanceMessage(issuedAt, userId, scenario, requestId))
    .digest('hex');
  assert.equal(signature, '0645baa68854f6dfaaf2b9da7f874ae1488b09197cfbf29c7e3549eb07bfcf84');
  const headers = new Headers({
    'X-JAY-Acceptance-Scenario': scenario,
    'X-JAY-Acceptance': `${issuedAt}.${signature}`,
  });
  const options = { serviceKey, userId, requestId, nowMs: issuedAt * 1000 };

  assert.deepEqual(await acceptance.verifyProductionAcceptanceFault(headers, options), {
    requested: true,
    scenario,
    error: null,
  });
  assert.equal((await acceptance.verifyProductionAcceptanceFault(headers, {
    ...options,
    requestId: 'different-request',
  })).error, 'ACCEPTANCE_SIGNATURE_INVALID');
  assert.equal((await acceptance.verifyProductionAcceptanceFault(headers, {
    ...options,
    nowMs: (issuedAt + 301) * 1000,
  })).error, 'ACCEPTANCE_SIGNATURE_INVALID');
  assert.equal((await acceptance.verifyProductionAcceptanceFault(new Headers({
    'X-JAY-Acceptance-Scenario': 'unknown',
    'X-JAY-Acceptance': `${issuedAt}.${signature}`,
  }), options)).error, 'ACCEPTANCE_SIGNATURE_INVALID');
  assert.deepEqual(await acceptance.verifyProductionAcceptanceFault(new Headers(), options), {
    requested: false,
    scenario: null,
    error: null,
  });
});
