const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('multi-provider gateway migration has governed providers, agents, routes and cost audit', () => {
  const sql = read('supabase', 'migrations', '20260925000000_multi_ai_gateway.sql');
  for (const table of ['ai_provider_catalog', 'ai_agent_catalog', 'ai_routing_policies', 'ai_provider_attempt_logs', 'ai_provider_usage_daily']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
  for (const provider of ['deepseek', 'coze', 'doubao', 'openai', 'codex', 'workbuddy']) assert.match(sql, new RegExp(`'${provider}'`));
  assert.match(sql, /record_ai_provider_attempt/);
  assert.match(sql, /UNIQUE \(request_id, attempt_no\)/);
  assert.match(sql, /third_party_disclosure_required/);
  assert.match(sql, /WITH route_seeds/);
  assert.match(sql, /UPDATE public\.ai_routing_policies AS route/);
  assert.doesNotMatch(sql, /ON CONFLICT\s+DO UPDATE/i);
  assert.doesNotMatch(sql, /API_KEY\s*TEXT/i);
});

test('provider adapters cover DeepSeek, Coze, Doubao, OpenAI Responses and Codex policy', () => {
  const adapter = read('supabase', 'functions', '_shared', 'ai-gateway.ts');
  assert.match(adapter, /api\.deepseek\.com/);
  assert.match(adapter, /open_api\/v3\/chat/);
  assert.match(adapter, /ark\.cn-beijing\.volces\.com\/api\/v3/);
  assert.match(adapter, /api\.openai\.com\/v1/);
  assert.match(adapter, /max_output_tokens/);
  assert.match(adapter, /output_text/);
  assert.match(adapter, /providerTaskAllowed/);
  assert.match(adapter, /system_maintenance/);
});

test('gateway routes one logical request through ordered fallbacks and reserves quota once', () => {
  const edge = read('supabase', 'functions', 'ai-proxy', 'index.ts');
  assert.match(edge, /ai_routing_policies/);
  assert.match(edge, /providerCandidates/);
  assert.match(edge, /for \(let candidateIndex/);
  assert.match(edge, /provider_attempt_logs/);
  assert.equal((edge.match(/reserve_workspace_ai_token_quota/g) || []).length, 1);
  assert.equal((edge.match(/finalize_workspace_ai_token_reservation/g) || []).length, 1);
  assert.match(edge, /data_disclosure/);
  assert.match(edge, /fallback_used/);
});

test('unconfigured optional fallbacks preserve the last configured provider failure', () => {
  const edge = read('supabase', 'functions', 'ai-proxy', 'index.ts');
  assert.match(edge, /let configuredProviderAttempted = false/);
  assert.match(edge, /const unavailableProviderError = 'AI_PROVIDER_NOT_CONFIGURED'/);
  assert.match(edge, /if \(!configuredProviderAttempted\) \{[\s\S]*lastErrorCode = unavailableProviderError;[\s\S]*lastErrorStatus = 503;/);
  assert.match(edge, /logProviderAttempt\(\{[^\n]+error_code: unavailableProviderError/);
  assert.match(edge, /configuredProviderAttempted = true;[\s\S]*const searchVariants/);
});

test('workspace routing and disclosure metadata are server-owned', () => {
  const edge = read('supabase', 'functions', 'ai-proxy', 'index.ts');
  assert.match(edge, /selectedPolicy = policyRows\.find\(\(row\) => String\(row\.workspace_id \|\| ''\) === workspaceId\)/);
  assert.match(edge, /!selectedPolicy && agentPrimary/);
  assert.match(edge, /disclosureAllowlist/);
  assert.match(edge, /formal_publications.*workspace_materials.*report_context/);
  assert.match(edge, /AI_AGENT_DISABLED/);
});

test('frontend sends task and disclosure metadata and renders selected gateway', () => {
  const client = read('assets', 'js', 'reports-decisions.js');
  const overview = read('assets', 'js', 'content-overview.js');
  assert.match(client, /task_type: taskType/);
  assert.match(client, /agent_key: agentKey/);
  assert.match(client, /data_disclosure:/);
  assert.match(client, /JAY_AI_GATEWAY_BY_REQUEST/);
  assert.match(overview, /发送给第三方 AI 的数据范围/);
});

test('production workflow exposes optional provider secrets without replacing absent values', () => {
  const workflow = read('.github', 'workflows', 'deploy-production.yml');
  for (const name of ['COZE_API_TOKEN', 'COZE_BOT_ID', 'DOUBAO_API_KEY', 'OPENAI_API_KEY', 'CODEX_API_KEY']) assert.match(workflow, new RegExp(name));
  assert.match(workflow, /for optional_name in COZE_API_URL/);
  assert.match(workflow, /functions deploy "\$function_name"/);
});

test('admin observability exposes provider catalog and attempt aggregates', () => {
  const edge = read('supabase', 'functions', 'admin-summary', 'index.ts');
  const browser = read('assets', 'js', 'alerts-settings.js');
  assert.match(edge, /ai_provider_catalog/);
  assert.match(edge, /ai_provider_usage_daily/);
  assert.match(edge, /ai_provider_attempt_logs/);
  assert.match(browser, /adminRenderProviderRows/);
});
