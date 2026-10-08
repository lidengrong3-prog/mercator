const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('R11 deploys one artifact to EdgeOne and GitHub Pages before browser acceptance', () => {
  const workflow = read('.github', 'workflows', 'deploy-production.yml');
  const buildAt = workflow.indexOf('build-frontend:');
  const pagesAt = workflow.indexOf('deploy-frontend:');
  const edgeOneAt = workflow.indexOf('deploy-edgeone:');
  const dualAt = workflow.indexOf('dual-release-consistency:');
  const browserAt = workflow.indexOf('browser-authenticated-acceptance:');
  assert.ok(buildAt > 0);
  assert.ok(pagesAt > buildAt);
  assert.ok(edgeOneAt > pagesAt);
  assert.ok(dualAt > edgeOneAt);
  assert.ok(browserAt > dualAt);
  assert.ok(workflow.includes('production-site-${{ github.run_id }}'));
  assert.match(workflow, /TencentEdgeOne\/edgeone-pages-action@025b878b4c30de49cf26d147b64190c76c292037/);
  assert.match(workflow, /needs: dual-release-consistency/);
  assert.match(workflow, /verify_dual_release\.py/);
  assert.match(workflow, /DUAL_RELEASE_RESULT_FILE/);
});

test('R11 release evidence owns EdgeOne rules and rejects mock or fallback success', () => {
  const builder = read('scripts', 'build_release_bundle.py');
  const verifier = read('scripts', 'verify_dual_release.py');
  const releaseCheck = read('scripts', 'production_release_check.py');
  const edgeone = read('edgeone.json');
  assert.match(builder, /release-integrity\.json/);
  assert.match(builder, /asset_manifest_sha256/);
  assert.match(verifier, /evidence_source.*live_http/s);
  assert.match(verifier, /mock_used.*False/s);
  assert.match(verifier, /fallback_used.*False/s);
  assert.match(releaseCheck, /repository-build-artifact/);
  assert.match(edgeone, /X-JAY-EdgeOne-Rules-Source/);
  assert.match(edgeone, /no-store, max-age=0/);
});

test('R11 production browser acceptance requires full closure for both accounts', () => {
  const browser = read('tests', 'production-auth.spec.cjs');
  const releaseCheck = read('scripts', 'production_release_check.py');
  assert.match(browser, /runSecondAccountFormalClosure/);
  assert.match(browser, /R11 account A report was not publishable/);
  assert.match(browser, /R11 account B report was not publishable/);
  assert.match(browser, /accounts:\s*\{[\s\S]*a:\s*\{[\s\S]*b:\s*\{/);
  for (const key of ['upload_persisted', 'report_saved', 'pdf_exported', 'docx_exported', 'logout_relogin', 'ai_logs_present']) {
    assert.ok(browser.includes(`${key}: true`));
    assert.match(releaseCheck, new RegExp(`"${key}"`));
  }
  assert.match(browser, /ai_request_logs/);
  assert.match(browser, /release_fallback_used: false/);
});
