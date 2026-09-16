import { verifyProductionAcceptanceFault } from '../_shared/production-acceptance.mjs';
import { enforceRateLimit, rateLimitResponse, requestId as securityRequestId } from '../_shared/security.ts';
import {
  providerConfig,
  providerEndpoint,
  providerErrorCode,
  providerRequestBody,
  parseProviderResult,
  providerTaskAllowed,
} from '../_shared/ai-gateway.ts';
import type { GatewayProvider } from '../_shared/ai-gateway.ts';

const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:4174', 'http://127.0.0.1:4174',
];

function allowedOrigins(): string[] {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  return configured ? configured.split(',').map((value) => value.trim()).filter(Boolean) : defaultOrigins;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Retry-After, X-JAY-Release',
    Vary: 'Origin',
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned', ...extra },
  });
}

function uuid(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
}

function estimateCost(inputTokens: number, outputTokens: number, provider = ''): number {
  const prefix = provider ? provider.toUpperCase().replace(/[^A-Z0-9]/g, '_') : '';
  const inputPerMillion = Math.max(0, Number(Deno.env.get(prefix ? `${prefix}_INPUT_COST_PER_MILLION_USD` : '') || Deno.env.get('AI_INPUT_COST_PER_MILLION_USD') || 0));
  const outputPerMillion = Math.max(0, Number(Deno.env.get(prefix ? `${prefix}_OUTPUT_COST_PER_MILLION_USD` : '') || Deno.env.get('AI_OUTPUT_COST_PER_MILLION_USD') || 0));
  return Number(((inputTokens * inputPerMillion + outputTokens * outputPerMillion) / 1_000_000).toFixed(8));
}

const ERROR_SUGGESTIONS: Record<string, string> = {
  AUTH_REQUIRED: '请重新登录后重试',
  AI_SERVICE_NOT_CONFIGURED: '请联系管理员完成 AI 服务配置',
  AI_PROVIDER_NOT_CONFIGURED: '请切换到已配置的 AI 供应商，或联系管理员接入该供应商',
  AI_RATE_LIMITED: '请稍后重试，或降低请求频率',
  AI_QUOTA_EXCEEDED: '请升级套餐或等待本月额度重置',
  AI_PROVIDER_TIMEOUT: '请稍后重试；如果持续发生，请检查供应商状态',
  AI_PROVIDER_UNREACHABLE: '请检查网络连接后重试',
  AI_PROVIDER_ERROR: '请稍后重试；如持续失败可切换供应商',
  AI_PROVIDER_UNAVAILABLE: '当前供应商暂时不可用，系统将按策略尝试备用供应商',
  AI_PROVIDER_AUTH_FAILED: 'AI 供应商密钥无效，请联系管理员检查配置',
  AI_PROVIDER_FORBIDDEN: '当前 AI 供应商拒绝了请求，请检查账号权限或切换供应商',
  AI_AGENT_DISABLED: '当前智能体已被管理员停用，请选择其他智能体',
  AI_AGENT_TASK_NOT_ALLOWED: '当前智能体不支持此任务类型，请选择匹配的智能体',
  AI_SEARCH_UNSUPPORTED: '当前供应商不支持联网检索，已回退到正式数据回答',
  AI_PROVIDER_INVALID_RESPONSE: '请稍后重试；供应商返回了无法解析的结果',
  AI_EMPTY_RESPONSE: '请重试，或换一种更具体的问题描述',
  NETWORK_ERROR: '请检查网络连接后重试',
  WORKSPACE_REQUIRED: '请先选择一个工作区后重试',
  WORKSPACE_FORBIDDEN: '你已不在该工作区，刷新页面后重新选择工作区',
  COURSE_REQUIRED: '请先打开一门课程，再使用课程问答',
  COURSE_FORBIDDEN: '当前账号没有这门课程的访问权限',
  COURSE_CONTENT_EMPTY: '课程内容尚未发布，暂时无法回答',
};

function normalizedRequestId(value: unknown): string {
  const candidate = String(value || '').slice(0, 240);
  return /^[A-Za-z0-9._:-]{8,240}$/.test(candidate) ? candidate : crypto.randomUUID();
}

function gatewayErrorBody(code: string, requestId: string, provider: string | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const retryable = ['AI_RATE_LIMITED', 'AI_PROVIDER_TIMEOUT', 'AI_PROVIDER_UNREACHABLE', 'AI_PROVIDER_UNAVAILABLE', 'AI_PROVIDER_ERROR', 'AI_PROVIDER_INVALID_RESPONSE', 'AI_EMPTY_RESPONSE', 'NETWORK_ERROR'].includes(code);
  const message = ERROR_SUGGESTIONS[code] || 'AI 服务请求失败，请稍后重试';
  return {
    error: code,
    code,
    request_id: requestId,
    provider,
    retryable,
    suggestion: message,
    ai_error: { code, message, request_id: requestId, provider, retryable, suggestion: message },
    ...extra,
  };
}

function isSearchUnsupportedStatus(status: number): boolean {
  return [400, 403, 422].includes(status);
}

async function responseRejectsSearch(response: Response): Promise<boolean> {
  if (!isSearchUnsupportedStatus(response.status)) return false;
  const probe = await response.clone().text().catch(() => '');
  return /web[_ -]?search|plugin|search|unsupported|not support/i.test(probe);
}

type FormalCitation = {
  citation_id: string;
  source_id: string;
  source_record_id: string;
  title: string;
  source_name: string;
  source_key: string;
  source_url: string | null;
  history_url: string;
  published_at: string | null;
  collected_at: string | null;
  verification_level: string;
  excerpt: string;
};

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const candidate = value.find((item) => typeof item === 'string' && item.trim());
    return typeof candidate === 'string' ? candidate.trim() : null;
  }
  return null;
}

async function retrieveFormalHistory(options: {
  supabaseUrl: string;
  serviceHeaders: Record<string, string>;
  payload: Record<string, unknown>;
  messages: unknown[];
  retrieval: Record<string, unknown>;
}): Promise<{ citations: FormalCitation[]; prompt: string; error: string | null }> {
  const context = options.payload.context && typeof options.payload.context === 'object'
    ? options.payload.context as Record<string, unknown>
    : {};
  const lastUserMessage = [...options.messages].reverse().find((message) => (
    message && typeof message === 'object' && String((message as Record<string, unknown>).role) === 'user'
  )) as Record<string, unknown> | undefined;
  const query = String(options.retrieval.query || lastUserMessage?.content || '').trim().slice(0, 200);
  if (!query) return { citations: [], prompt: '', error: null };
  const yearValue = Number(options.retrieval.year || context.year || 0);
  const rpcResponse = await fetch(`${options.supabaseUrl}/rest/v1/rpc/search_formal_publications`, {
    method: 'POST',
    headers: options.serviceHeaders,
    body: JSON.stringify({
      p_query: query,
      p_type: firstString(options.retrieval.type),
      p_market_code: firstString(options.retrieval.market_code || context.market_codes),
      p_platform_key: firstString(options.retrieval.platform_key || context.platform_keys),
      p_category_code: firstString(options.retrieval.category_code || context.category_codes),
      p_year: Number.isInteger(yearValue) && yearValue >= 1900 && yearValue <= 2200 ? yearValue : null,
      p_source_key: firstString(options.retrieval.source_key),
      p_verification_status: null,
      p_from: firstString(options.retrieval.from),
      p_to: firstString(options.retrieval.to),
      p_sort: 'relevance',
      p_cursor: null,
      p_snapshot_at: null,
      p_limit: Math.max(1, Math.min(8, Number(options.retrieval.limit || 6))),
      p_record_id: null,
    }),
  });
  if (!rpcResponse.ok) return { citations: [], prompt: '', error: `RAG_RPC_${rpcResponse.status}` };
  let result: Record<string, unknown>;
  try {
    result = await rpcResponse.json();
  } catch {
    return { citations: [], prompt: '', error: 'RAG_INVALID_RESPONSE' };
  }
  const rows = Array.isArray(result?.items) ? result.items : [];
  const citations = rows.slice(0, 8).map((item, index) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const sourceId = String(row.source_id || row.id || '');
    return {
      citation_id: `H${String(index + 1).padStart(3, '0')}`,
      source_id: sourceId,
      source_record_id: String(row.source_record_id || ''),
      title: String(row.title || row.record_key || '').slice(0, 300),
      source_name: String(row.source_name || row.source_key || '').slice(0, 200),
      source_key: String(row.source_key || '').slice(0, 120),
      source_url: /^https:\/\//i.test(String(row.source_url || '')) ? String(row.source_url) : null,
      history_url: /^#[a-z]+\?record=[0-9a-f-]{36}$/i.test(String(row.history_url || ''))
        ? String(row.history_url)
        : `#search?record=${sourceId}`,
      published_at: row.published_at ? String(row.published_at) : null,
      collected_at: row.collected_at ? String(row.collected_at) : null,
      verification_level: String(row.verification_level || row.verification_status || ''),
      excerpt: String(row.content_excerpt || row.summary || '').replace(/\s+/g, ' ').slice(0, 1200),
    };
  }).filter((item) => /^[0-9a-f-]{36}$/i.test(item.source_id) && item.title);
  if (!citations.length) return { citations: [], prompt: '', error: null };
  const lines = citations.map((citation) => (
    `[${citation.citation_id}] ${citation.title}; 来源=${citation.source_name}; ` +
    `时间=${citation.published_at || citation.collected_at || '未提供'}; 来源ID=${citation.source_id}; ` +
    `内容=${citation.excerpt || '无摘要'}`
  ));
  return {
    citations,
    prompt: '【JAY观海正式历史投影】\n' + lines.join('\n') +
      '\n回答中的事实只能引用上述正式记录；使用事实时保留对应的 [Hxxx] 编号。不得把未列出的本地缓存或原始响应当作知识库来源。',
    error: null,
  };
}

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse(gatewayErrorBody('ORIGIN_NOT_ALLOWED', normalizedRequestId(request.headers.get('X-Request-Id')), null), 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return jsonResponse(gatewayErrorBody('INVALID_JSON', normalizedRequestId(request.headers.get('X-Request-Id')), null), 400, origin); }
  const requestId = normalizedRequestId(payload.request_id || request.headers.get('X-Request-Id'));
  const requestedProvider = String(payload.provider || 'auto').toLowerCase();
  let provider = (requestedProvider === 'auto' ? 'deepseek' : requestedProvider) as GatewayProvider;

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return jsonResponse(gatewayErrorBody('AUTH_REQUIRED', requestId, provider), 401, origin);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse(gatewayErrorBody('AI_SERVICE_NOT_CONFIGURED', requestId, provider), 503, origin);

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  if (!userResponse.ok) return jsonResponse(gatewayErrorBody('AUTH_REQUIRED', requestId, provider), 401, origin);
  const user = await userResponse.json();
  try {
    const rate = await enforceRateLimit({ supabaseUrl, serviceKey, request, scope: 'ai', userId: String(user.id || '') });
    if (!rate.allowed) return rateLimitResponse(rate, requestId || securityRequestId(request), origin);
  } catch (error) {
    console.error('AI rate limiter unavailable', error);
    return jsonResponse(gatewayErrorBody('RATE_LIMIT_UNAVAILABLE', requestId, provider), 503, origin);
  }
  const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  const operation = String(payload.operation || 'analysis').slice(0, 120);
  const fallbackEntryPoint = operation.startsWith('overview') ? 'overview.decision' : operation.startsWith('report') ? 'report.generation' : 'other';
  const entryPointCandidate = String(payload.entry_point || fallbackEntryPoint).toLowerCase().slice(0, 120);
  const entryPoint = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)?$/.test(entryPointCandidate) ? entryPointCandidate : fallbackEntryPoint;
  const dataVersion = payload.data_version ? String(payload.data_version).slice(0, 240) : null;

  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) return jsonResponse(gatewayErrorBody('INVALID_MESSAGES', requestId, provider), 400, origin);
  let totalLength = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') return jsonResponse(gatewayErrorBody('INVALID_MESSAGES', requestId, provider), 400, origin);
    const role = (message as Record<string, unknown>).role;
    const content = (message as Record<string, unknown>).content;
    if (!['system', 'user', 'assistant'].includes(String(role)) || typeof content !== 'string') return jsonResponse(gatewayErrorBody('INVALID_MESSAGES', requestId, provider), 400, origin);
    totalLength += content.length;
  }
  if (totalLength > 30_000) return jsonResponse(gatewayErrorBody('PROMPT_TOO_LARGE', requestId, provider), 413, origin);

  const acceptance = await verifyProductionAcceptanceFault(request.headers, {
    serviceKey: Deno.env.get('ACCEPTANCE_HMAC_SECRET') || serviceKey,
    userId: String(user.id || ''),
    requestId,
  });
  if (acceptance.error) return jsonResponse(gatewayErrorBody(acceptance.error, requestId, provider), 403, origin);
  const acceptanceScenario = acceptance.scenario;
  const acceptanceRunId = typeof payload.acceptance_run_id === 'string'
    ? payload.acceptance_run_id.trim().slice(0, 160)
    : null;

  const requestedWorkspaceId = uuid(payload.workspace_id);
  const resource = async (table: 'report_runs' | 'generated_reports', value: unknown): Promise<{ id: string; workspace_id: string; user_id: string } | null> => {
    const id = uuid(value);
    if (!id) return null;
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id,workspace_id,user_id&limit=1`, { headers: serviceHeaders });
    const rows = response.ok ? await response.json() : [];
    const row = rows?.[0];
    return row?.id && uuid(row.workspace_id) ? { id: row.id, workspace_id: row.workspace_id, user_id: String(row.user_id || '') } : null;
  };
  const [reportRunResource, reportResource] = await Promise.all([
    resource('report_runs', payload.report_run_id),
    resource('generated_reports', payload.report_id),
  ]);
  const resourceWorkspaceIds = [reportRunResource?.workspace_id, reportResource?.workspace_id].filter(Boolean) as string[];
  const workspaceId = requestedWorkspaceId || resourceWorkspaceIds[0] || null;
  if (!workspaceId || resourceWorkspaceIds.some((id) => id !== workspaceId)) {
    return jsonResponse(gatewayErrorBody(workspaceId ? 'WORKSPACE_FORBIDDEN' : 'WORKSPACE_REQUIRED', requestId, provider), workspaceId ? 403 : 400, origin);
  }
  const membershipResponse = await fetch(`${supabaseUrl}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=role&limit=1`, { headers: serviceHeaders });
  if (!membershipResponse.ok) return jsonResponse(gatewayErrorBody('WORKSPACE_FORBIDDEN', requestId, provider), 403, origin);
  const memberships = await membershipResponse.json();
  if (!memberships?.length) return jsonResponse(gatewayErrorBody('WORKSPACE_FORBIDDEN', requestId, provider), 403, origin);
  if (!['owner', 'admin', 'editor'].includes(String(memberships[0]?.role || ''))) return jsonResponse(gatewayErrorBody('WORKSPACE_READ_ONLY', requestId, provider), 403, origin);

  // Resolve one agent and an ordered provider route. Explicit provider choices
  // are honored, while `auto` uses the workspace policy and then the global
  // policy. A route is never broadcast to every configured supplier.
  const knownProviders: GatewayProvider[] = ['deepseek', 'coze', 'doubao', 'openai', 'codex', 'workbuddy'];
  const asProvider = (value: unknown): GatewayProvider | null => {
    const candidate = String(value || '').toLowerCase() as GatewayProvider;
    return knownProviders.includes(candidate) ? candidate : null;
  };
  const inferredTaskType = operation.startsWith('report') ? 'report'
    : operation.startsWith('translation') ? 'translation'
      : (entryPoint.startsWith('code') || entryPoint.startsWith('system')) ? 'code'
        : operation.startsWith('course') ? 'course_qa' : 'market_qa';
  const taskType = String(payload.task_type || inferredTaskType).toLowerCase().slice(0, 60);
  const requestedAgentKey = String(payload.agent_key || '').toLowerCase().slice(0, 80);
  const readRows = async (path: string): Promise<Record<string, unknown>[]> => {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: serviceHeaders });
    if (!response.ok) return [];
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
  };
  let agentKey = requestedAgentKey || null;
  let routePrimary: GatewayProvider | null = asProvider(requestedProvider);
  let routeFallbacks: GatewayProvider[] = [];
  let routeSource = requestedProvider === 'auto' ? 'default' : 'explicit';
  let selectedPolicy: Record<string, unknown> | null = null;
  if (requestedProvider !== 'auto' && !routePrimary) {
    return jsonResponse(gatewayErrorBody('AI_PROVIDER_NOT_CONFIGURED', requestId, provider), 400, origin);
  }
  let agent: Record<string, unknown> | null = null;
  if (requestedAgentKey) {
    const rows = await readRows(`ai_agent_catalog?agent_key=eq.${encodeURIComponent(requestedAgentKey)}&limit=1`);
    agent = rows[0] || null;
    if (!agent || agent.enabled !== true || agent.manually_disabled === true) {
      return jsonResponse(gatewayErrorBody('AI_AGENT_DISABLED', requestId, provider), 403, origin);
    }
    if (String(agent.task_type || '') !== taskType) {
      return jsonResponse(gatewayErrorBody('AI_AGENT_TASK_NOT_ALLOWED', requestId, provider), 400, origin);
    }
  }
  if (requestedProvider === 'auto') {
    const policyRows = await readRows(`ai_routing_policies?task_type=eq.${encodeURIComponent(taskType)}&enabled=eq.true&manually_disabled=eq.false&order=priority.asc&limit=30`);
    // Workspace policy always wins over the global policy, regardless of the
    // priority number assigned to either scope. Priority only orders policies
    // within the same scope.
    selectedPolicy = policyRows.find((row) => String(row.workspace_id || '') === workspaceId)
      || policyRows.find((row) => !row.workspace_id)
      || null;
    if (!agent && selectedPolicy?.agent_key) {
      agentKey = String(selectedPolicy.agent_key);
      const rows = await readRows(`ai_agent_catalog?agent_key=eq.${encodeURIComponent(agentKey)}&limit=1`);
      agent = rows[0] || null;
      if (!agent || agent.enabled !== true || agent.manually_disabled === true) {
        return jsonResponse(gatewayErrorBody('AI_AGENT_DISABLED', requestId, provider, {
          agent_key: agentKey,
          task_type: taskType,
        }), 403, origin);
      }
      if (String(agent.task_type || '') !== taskType) {
        return jsonResponse(gatewayErrorBody('AI_AGENT_TASK_NOT_ALLOWED', requestId, provider, {
          agent_key: agentKey,
          task_type: taskType,
        }), 400, origin);
      }
    }
    const policyPrimary = asProvider(selectedPolicy?.primary_provider);
    if (policyPrimary) {
      routePrimary = policyPrimary;
      routeFallbacks = Array.isArray(selectedPolicy?.fallback_providers)
        ? (selectedPolicy?.fallback_providers as unknown[]).map(asProvider).filter(Boolean) as GatewayProvider[] : [];
      routeSource = selectedPolicy?.workspace_id ? 'workspace_policy' : 'global_policy';
    } else if (agent) {
      routePrimary = asProvider(agent.primary_provider);
      routeFallbacks = Array.isArray(agent.fallback_providers)
        ? (agent.fallback_providers as unknown[]).map(asProvider).filter(Boolean) as GatewayProvider[] : [];
      routeSource = 'agent_catalog';
    } else {
      routePrimary = 'deepseek';
      const configuredFallbacks = String(Deno.env.get('AI_FALLBACK_PROVIDERS') || '').split(',').map((item) => asProvider(item)).filter(Boolean) as GatewayProvider[];
      routeFallbacks = configuredFallbacks;
    }
  } else {
    const requestedFallbacks = Array.isArray(payload.fallback_providers)
      ? (payload.fallback_providers as unknown[]).map(asProvider).filter(Boolean) as GatewayProvider[] : [];
    routeFallbacks = requestedFallbacks;
  }
  if (agent) {
    const agentPrimary = asProvider(agent.primary_provider);
    // A persisted workspace/global policy owns the route. The agent catalog
    // supplies a route only when no policy exists, so an agent's defaults
    // cannot silently override an administrator's workspace choice.
    if (requestedProvider === 'auto' && !selectedPolicy && agentPrimary) routePrimary = agentPrimary;
    if (requestedProvider === 'auto' && !selectedPolicy && Array.isArray(agent.fallback_providers)) {
      routeFallbacks = (agent.fallback_providers as unknown[]).map(asProvider).filter(Boolean) as GatewayProvider[];
    }
  }
  const providerCandidates = Array.from(new Set([routePrimary, ...routeFallbacks].filter(Boolean))) as GatewayProvider[];
  if (!providerCandidates.length) return jsonResponse(gatewayErrorBody('AI_PROVIDER_NOT_CONFIGURED', requestId, provider), 503, origin);
  provider = providerCandidates[0];
  if (providerCandidates.some((candidate) => !providerTaskAllowed(candidate, taskType))) {
    const allowed = providerCandidates.filter((candidate) => providerTaskAllowed(candidate, taskType));
    if (!allowed.length) return jsonResponse(gatewayErrorBody('AI_PROVIDER_FORBIDDEN', requestId, provider), 403, origin);
  }
  const providerCatalogRows = await readRows(`ai_provider_catalog?provider_key=in.(${providerCandidates.join(',')})&limit=20`);
  const disabledProviders = new Set(providerCatalogRows.filter((row) => row.status === 'disabled').map((row) => String(row.provider_key)));
  const enabledCandidates = providerCandidates.filter((candidate) => !disabledProviders.has(candidate) && providerTaskAllowed(candidate, taskType));
  if (!enabledCandidates.length) return jsonResponse(gatewayErrorBody('AI_PROVIDER_FORBIDDEN', requestId, provider), 403, origin);
  provider = enabledCandidates[0];
  const requestedModel = payload.model ? String(payload.model).slice(0, 120) : null;
  const dataDisclosureInput = payload.data_disclosure && typeof payload.data_disclosure === 'object'
    ? payload.data_disclosure as Record<string, unknown> : {};
  const disclosureAllowlist = new Set([
    'formal_publications', 'workspace_materials', 'report_context', 'course_materials',
    'request_context', 'system_metadata', 'user_uploads', 'third_party_snapshots',
  ]);
  const requestedDisclosureScope = Array.isArray(dataDisclosureInput.scope)
    ? dataDisclosureInput.scope.map((item) => String(item).slice(0, 80)).filter((item) => disclosureAllowlist.has(item))
    : [];
  const dataDisclosure = {
    third_party_provider: true,
    consent: dataDisclosureInput.consent === true,
    workspace_id: workspaceId,
    // Always disclose the current request context. Client supplied scope is
    // an additive hint and is filtered through the server allowlist below.
    scope: Array.from(new Set(['request_context', ...requestedDisclosureScope])).slice(0, 20),
    agent_key: agentKey,
  };

  const retrieval = payload.retrieval && typeof payload.retrieval === 'object'
    ? payload.retrieval as Record<string, unknown>
    : {};
  const searchRequested = Boolean(
    taskType !== 'course_qa'
    && (payload.web_search === true || (payload.web_search && typeof payload.web_search === 'object')
      || (Array.isArray(payload.plugins) && payload.plugins.length > 0)
      || retrieval.allow_web_search === true)
    && !['formal_only', 'disabled', 'none'].includes(String(retrieval.mode || '').toLowerCase()),
  );

  const retrievalMode = String(retrieval.mode || 'disabled').toLowerCase();
  let formalRetrieval: { citations: FormalCitation[]; prompt: string; error: string | null } = {
    citations: [], prompt: '', error: null,
  };
  if (taskType !== 'course_qa' && !['disabled', 'none', 'off'].includes(retrievalMode)) {
    try {
      formalRetrieval = await retrieveFormalHistory({
        supabaseUrl, serviceHeaders, payload, messages, retrieval,
      });
    } catch (error) {
      console.error('formal history retrieval failed', error);
      formalRetrieval.error = 'RAG_UNAVAILABLE';
    }
  }
  const providerMessages = messages.map((message) => ({ ...(message as Record<string, unknown>) }));
  let courseContext: { course_id: string | null; lesson_ids: string[]; prompt: string } = { course_id: null, lesson_ids: [], prompt: '' };
  if (taskType === 'course_qa') {
    const context = payload.context && typeof payload.context === 'object' ? payload.context as Record<string, unknown> : {};
    const courseId = uuid(context.course_id || payload.course_id);
    if (!courseId) return jsonResponse(gatewayErrorBody('COURSE_REQUIRED', requestId, provider), 400, origin);
    const courseRows = await readRows(`courses?id=eq.${encodeURIComponent(courseId)}&select=id,title,description,access_level,required_plan,workspace_id,status&limit=1`);
    const course = courseRows[0] || null;
    let courseAllowed = Boolean(course && course.status === 'published' && course.access_level === 'public');
    if (course && course.status === 'published' && course.access_level === 'workspace') courseAllowed = String(course.workspace_id || '') === workspaceId;
    if (course && course.status === 'published' && course.access_level === 'plan') {
      const subscriptions = await readRows(`workspace_subscriptions?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=plan,status&limit=1`);
      const subscription = subscriptions[0] || {};
      const planRank: Record<string, number> = { free: 1, pro: 2, enterprise: 3 };
      courseAllowed = ['trialing', 'active'].includes(String(subscription.status || '')) && (planRank[String(subscription.plan || 'free')] || 0) >= (planRank[String(course.required_plan || 'free')] || 1);
    }
    if (course && course.status === 'published' && ['purchase', 'manual'].includes(String(course.access_level))) {
      const enrollments = await readRows(`course_enrollments?course_id=eq.${encodeURIComponent(courseId)}&user_id=eq.${encodeURIComponent(String(user.id))}&status=eq.active&select=id,workspace_id,expires_at&limit=10`);
      courseAllowed = enrollments.some((entry) => (!entry.workspace_id || String(entry.workspace_id) === workspaceId) && (!entry.expires_at || new Date(String(entry.expires_at)).getTime() > Date.now()));
    }
    if (!courseAllowed) return jsonResponse(gatewayErrorBody('COURSE_FORBIDDEN', requestId, provider), 403, origin);
    const modules = await readRows(`course_modules?course_id=eq.${encodeURIComponent(courseId)}&status=eq.published&select=id,title,summary,sort_order&order=sort_order.asc&limit=200`);
    const moduleIds = modules.map((item) => String(item.id));
    const lessons = moduleIds.length ? await readRows(`course_lessons?module_id=in.(${moduleIds.map(encodeURIComponent).join(',')})&status=eq.published&select=id,module_id,title,summary,body,lesson_type,sort_order&order=sort_order.asc&limit=1000`) : [];
    const moduleById = new Map(modules.map((item) => [String(item.id), item]));
    const lines = lessons.map((lesson, index) => {
      const module = moduleById.get(String(lesson.module_id)) || {};
      return `[C${String(index + 1).padStart(3, '0')}] 课程=${String(course.title || '')}; 章节=${String(module.title || '')}; 课时=${String(lesson.title || '')}; 内容=${String(lesson.body || lesson.summary || '').replace(/\s+/g, ' ').slice(0, 1800)}`;
    });
    if (!lines.length) return jsonResponse(gatewayErrorBody('COURSE_CONTENT_EMPTY', requestId, provider), 409, origin);
    courseContext = {
      course_id: courseId,
      lesson_ids: lessons.map((lesson) => String(lesson.id)),
      prompt: '【已授权课程内容】\n' + lines.join('\n') + '\n仅根据上述课程内容回答；引用课程事实时保留对应 [Cxxx]，不要使用其他课程、正式历史库或联网信息。',
    };
    const systemIndex = providerMessages.findIndex((message) => message.role === 'system');
    if (systemIndex >= 0) providerMessages[systemIndex].content = String(providerMessages[systemIndex].content || '') + '\n\n' + courseContext.prompt;
    else providerMessages.unshift({ role: 'system', content: courseContext.prompt });
    totalLength += courseContext.prompt.length;
  }
  if (formalRetrieval.prompt) {
    const systemIndex = providerMessages.findIndex((message) => message.role === 'system');
    if (systemIndex >= 0) {
      providerMessages[systemIndex].content = String(providerMessages[systemIndex].content || '') + '\n\n' + formalRetrieval.prompt;
    } else if (providerMessages.length < 20) {
      providerMessages.unshift({ role: 'system', content: formalRetrieval.prompt });
    } else {
      providerMessages[0].content = formalRetrieval.prompt + '\n\n' + String(providerMessages[0].content || '');
    }
    totalLength += formalRetrieval.prompt.length;
  }
  if (totalLength > 30_000) return jsonResponse(gatewayErrorBody('PROMPT_TOO_LARGE', requestId, provider), 413, origin);

  const temperature = Math.max(0, Math.min(1.5, Number(payload.temperature ?? 0.5)));
  const maxTokens = Math.max(128, Math.min(3_000, Number(payload.max_tokens ?? 1_500)));

  const reportRunId = reportRunResource?.id || null;
  const reportId = reportResource?.id || null;
  const inferredDisclosureScope = new Set(dataDisclosure.scope);
  if (formalRetrieval.citations.length) inferredDisclosureScope.add('formal_publications');
  if (reportRunId || reportId) inferredDisclosureScope.add('report_context');
  if (taskType === 'course_qa') inferredDisclosureScope.add('course_materials');
  if (taskType === 'code' || taskType === 'automation' || taskType === 'system_maintenance') inferredDisclosureScope.add('system_metadata');
  dataDisclosure.scope = Array.from(inferredDisclosureScope).slice(0, 20);
  let activeModel = requestedModel || '';
  const providerAttempts: Array<Record<string, unknown>> = [];
  let fallbackUsed = false;

  const logRequest = async (values: Record<string, unknown>) => {
    const valueMetadata = values.metadata && typeof values.metadata === 'object' ? values.metadata as Record<string, unknown> : {};
    const logValues: Record<string, unknown> = { ...values };
    delete logValues.metadata;
    await fetch(`${supabaseUrl}/rest/v1/ai_request_logs`, {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        user_id: user.id, workspace_id: workspaceId, report_run_id: reportRunId, report_id: reportId, request_id: requestId,
        acceptance_run_id: acceptanceRunId,
        operation, entry_point: entryPoint, task_type: taskType, agent_key: agentKey,
        requested_provider: requestedProvider, provider, model: String(values.model || activeModel || ''), data_version: dataVersion,
        provider_attempts: providerAttempts, fallback_used: fallbackUsed,
        retry_count: Math.max(0, providerAttempts.length - 1), data_disclosure: dataDisclosure,
        search_enabled: Boolean(values.search_enabled == null ? searchRequested : values.search_enabled),
        duration_ms: Date.now() - startedAt, metadata: {
          client_report_id: String(payload.client_report_id || '').slice(0, 180),
          acceptance_scenario: acceptanceScenario,
          retrieval_mode: retrievalMode,
          retrieval_count: formalRetrieval.citations.length,
          retrieval_source_ids: formalRetrieval.citations.map((item) => item.source_id),
          retrieval_error: formalRetrieval.error,
          course_id: courseContext.course_id,
          course_lesson_ids: courseContext.lesson_ids,
          ...valueMetadata,
        },
        ...logValues,
      }),
    });
  };
  const logProviderAttempt = async (attempt: Record<string, unknown>) => {
    providerAttempts.push({
      provider: String(attempt.provider || ''), model: String(attempt.model || ''),
      status: String(attempt.status || 'failed'), http_status: Number(attempt.http_status || 0) || null,
      error_code: attempt.error_code ? String(attempt.error_code) : null,
      duration_ms: Math.max(0, Number(attempt.duration_ms || 0)),
      fallback_reason: attempt.fallback_reason ? String(attempt.fallback_reason).slice(0, 160) : null,
    });
    await fetch(`${supabaseUrl}/rest/v1/ai_provider_attempt_logs`, {
      method: 'POST', headers: { ...serviceHeaders, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        request_id: requestId, attempt_no: providerAttempts.length, user_id: user.id, workspace_id: workspaceId,
        task_type: taskType, agent_key: agentKey, provider: attempt.provider, model: attempt.model || '',
        status: attempt.status || 'failed', http_status: attempt.http_status || null,
        input_tokens: Math.max(0, Number(attempt.input_tokens || 0)), output_tokens: Math.max(0, Number(attempt.output_tokens || 0)),
        total_tokens: Math.max(0, Number(attempt.total_tokens || 0)), estimated_cost_usd: Math.max(0, Number(attempt.estimated_cost_usd || 0)),
        error_code: attempt.error_code || null, duration_ms: Math.max(0, Number(attempt.duration_ms || 0)),
        fallback_reason: attempt.fallback_reason || null,
      }),
    }).catch((error) => console.error('AI provider attempt log failed', error));
  };

  // Legacy contract referenced billing_plan_entitlements and
  // reserve_ai_token_quota/finalize_ai_token_reservation; workspace RPCs below
  // keep those names available as compatibility wrappers in the migration.
  const effectivePlanResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/workspace_effective_entitlement`, {
    method: 'POST', headers: serviceHeaders, body: JSON.stringify({ p_workspace_id: workspaceId, p_user_id: user.id }),
  });
  if (!effectivePlanResponse.ok) return jsonResponse(gatewayErrorBody('BILLING_ENTITLEMENTS_UNAVAILABLE', requestId, provider), 503, origin);
  const entitlement = await effectivePlanResponse.json();
  const effectivePlan = String(entitlement?.plan || 'free');
  if (!entitlement) return jsonResponse(gatewayErrorBody('BILLING_ENTITLEMENTS_UNAVAILABLE', requestId, provider), 503, origin);

  const configuredMinuteCap = Math.max(0, Number(Deno.env.get('AI_REQUESTS_PER_MINUTE') || 0));
  const planMinuteLimit = Math.max(1, Number(entitlement.ai_requests_per_minute || 1));
  const perMinuteLimit = configuredMinuteCap > 0 ? Math.min(planMinuteLimit, configuredMinuteCap) : planMinuteLimit;
  const configuredMonthlyCap = Math.max(0, Number(Deno.env.get('AI_MONTHLY_TOKEN_LIMIT') || 0));

  const minuteStart = new Date(Date.now() - 60_000).toISOString();
  const rateResponse = await fetch(`${supabaseUrl}/rest/v1/ai_request_logs?user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(minuteStart)}&select=id`, {
    method: 'HEAD', headers: { ...serviceHeaders, Prefer: 'count=exact' },
  });
  if (!rateResponse.ok) return jsonResponse(gatewayErrorBody('AI_RATE_LIMIT_CHECK_FAILED', requestId, provider), 503, origin);
  const recentCount = Number((rateResponse.headers.get('content-range') || '0/0').split('/')[1] || 0);
  if (acceptanceScenario === 'rate_limit' || recentCount >= perMinuteLimit) {
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: 429, error_code: 'AI_RATE_LIMITED' });
    return jsonResponse(gatewayErrorBody('AI_RATE_LIMITED', requestId, provider, { plan: effectivePlan, limit: perMinuteLimit, retry_after: 60 }), 429, origin, { 'Retry-After': '60' });
  }

  const estimatedInputTokens = Math.max(1, totalLength);
  const requestedTokens = estimatedInputTokens + maxTokens;
  const reservationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_workspace_ai_token_quota`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      p_workspace_id: workspaceId,
      p_user_id: user.id,
      p_request_id: requestId,
      p_requested_tokens: requestedTokens,
      p_limit_override: acceptanceScenario === 'quota' ? 1 : (configuredMonthlyCap > 0 ? configuredMonthlyCap : null),
      p_acceptance_run_id: acceptanceRunId,
    }),
  });
  if (!reservationResponse.ok) return jsonResponse(gatewayErrorBody('BILLING_USAGE_UNAVAILABLE', requestId, provider), 503, origin);
  const reservation = await reservationResponse.json();
  if (reservation?.allowed === true && acceptanceRunId) {
    await fetch(`${supabaseUrl}/rest/v1/ai_token_reservations?workspace_id=eq.${encodeURIComponent(workspaceId)}&request_id=eq.${encodeURIComponent(requestId)}`, {
      method: 'PATCH', headers: { ...serviceHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ acceptance_run_id: acceptanceRunId }),
    });
  }
  if (reservation?.allowed !== true) {
    const reservationError = String(reservation?.error || 'AI_QUOTA_EXCEEDED');
    if (reservationError === 'AI_REQUEST_IN_PROGRESS' || reservationError === 'AI_REQUEST_ALREADY_COMPLETED') {
      return jsonResponse(gatewayErrorBody(reservationError, requestId, provider, { conflict: true }), 409, origin);
    }
    if (reservationError === 'AI_RATE_LIMITED') {
      await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: 429, error_code: 'AI_RATE_LIMITED' });
      const retryAfter = Math.max(1, Math.min(60, Number(reservation?.retry_after || 60)));
      return jsonResponse(gatewayErrorBody('AI_RATE_LIMITED', requestId, provider, {
        plan: effectivePlan,
        limit: Number(reservation?.limit || perMinuteLimit),
        used_requests: Number(reservation?.used_requests || 0),
        retry_after: retryAfter,
      }), 429, origin, { 'Retry-After': String(retryAfter) });
    }
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: 402, error_code: 'AI_QUOTA_EXCEEDED' });
    return jsonResponse(gatewayErrorBody('AI_QUOTA_EXCEEDED', requestId, provider, { plan: effectivePlan,
      used_tokens: Number(reservation?.used_tokens || 0),
      reserved_tokens: Number(reservation?.reserved_tokens || 0),
      limit: Number(reservation?.limit || 0),
      remaining_tokens: Number(reservation?.remaining_tokens || 0),
      reset_at: String(reservation?.reset_at || ''),
    }), 402, origin);
  }

  const finalizeWorkspaceReservation = async (status: 'completed' | 'released', actualTokens = 0) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/finalize_workspace_ai_token_reservation`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        p_workspace_id: workspaceId,
        p_user_id: user.id,
        p_request_id: requestId,
        p_status: status,
        p_actual_tokens: Math.max(0, Math.floor(actualTokens)),
      }),
    });
    return response.ok;
  };
  const rolloutReservationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_rollout_ai_daily_quota`, {
    method: 'POST', headers: serviceHeaders,
    body: JSON.stringify({ p_user_id: user.id, p_request_id: requestId, p_requested_tokens: requestedTokens }),
  });
  if (!rolloutReservationResponse.ok) {
    await finalizeWorkspaceReservation('released');
    return jsonResponse(gatewayErrorBody('ROLLOUT_QUOTA_UNAVAILABLE', requestId, provider), 503, origin);
  }
  const rolloutReservation = await rolloutReservationResponse.json();
  if (rolloutReservation?.allowed !== true) {
    await finalizeWorkspaceReservation('released');
    const duplicate = rolloutReservation?.idempotent === true;
    const errorCode = duplicate ? 'AI_REQUEST_ALREADY_COMPLETED' : 'AI_DAILY_LIMIT_REACHED';
    const status = duplicate ? 409 : 429;
    const retryAfter = duplicate ? undefined : Math.max(1, Math.floor((Date.UTC(
      new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1,
    ) - Date.now()) / 1000));
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0,
      estimated_cost_usd: 0, http_status: status, error_code: errorCode });
    return jsonResponse(gatewayErrorBody(errorCode, requestId, provider, {
      limit: Number(rolloutReservation?.limit || 0),
      used_tokens: Number(rolloutReservation?.used_tokens || 0),
      reserved_tokens: Number(rolloutReservation?.reserved_tokens || 0),
      retry_after: retryAfter,
    }), status, origin, retryAfter ? { 'Retry-After': String(retryAfter) } : {});
  }
  const rolloutQuotaEnforced = rolloutReservation?.enforced === true;
  const finalizeReservation = async (status: 'completed' | 'released', actualTokens = 0) => {
    const workspaceFinalized = await finalizeWorkspaceReservation(status, actualTokens);
    if (!rolloutQuotaEnforced) return workspaceFinalized;
    const rolloutResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/finalize_rollout_ai_daily_quota`, {
      method: 'POST', headers: serviceHeaders,
      body: JSON.stringify({
        p_user_id: user.id, p_request_id: requestId, p_status: status,
        p_actual_tokens: Math.max(0, Math.floor(actualTokens)),
      }),
    });
    if (!rolloutResponse.ok) return false;
    return workspaceFinalized && await rolloutResponse.json() === true;
  };
  // The gateway deadline covers the whole route, while each provider gets a
  // bounded slice so a slow primary leaves time for its configured fallback.
  const providerTimeout = acceptanceScenario === 'provider_timeout'
    ? 1
    : Math.max(5_000, Math.min(30_000, Number(Deno.env.get('AI_PROVIDER_TIMEOUT_MS') || 25_000)));
  const providerDeadline = Date.now() + (acceptanceScenario === 'provider_timeout'
    ? 1 : Math.max(providerTimeout, Math.min(60_000, Number(Deno.env.get('AI_GATEWAY_TIMEOUT_MS') || 55_000))));
  async function invokeProvider(config: NonNullable<ReturnType<typeof providerConfig>>, withSearch: boolean): Promise<Response> {
    const remaining = providerDeadline - Date.now();
    if (remaining <= 0) throw new DOMException('The AI provider request timed out', 'AbortError');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(providerTimeout, remaining)));
    try {
      return await fetch(providerEndpoint(config), {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(providerRequestBody(config, providerMessages as Array<{ role: string; content: string }>, {
          maxTokens, temperature, withSearch, userId: String(user.id),
        })),
        signal: controller.signal,
      });
    } finally { clearTimeout(timer); }
  }

  let usedSearch = searchRequested;
  let successfulResult: Record<string, unknown> | null = null;
  let parsedResult: ReturnType<typeof parseProviderResult> | null = null;
  let lastErrorCode = 'AI_PROVIDER_ERROR';
  let lastErrorStatus = 502;
  let configuredProviderAttempted = false;
  let retryAfter = '60';
  for (let candidateIndex = 0; candidateIndex < enabledCandidates.length && !successfulResult; candidateIndex += 1) {
    const candidate = enabledCandidates[candidateIndex];
    const config = providerConfig(candidate);
    activeModel = requestedModel || config?.model || '';
    if (candidateIndex > 0) fallbackUsed = true;
    if (!config) {
      const unavailableProviderError = 'AI_PROVIDER_NOT_CONFIGURED';
      // An unavailable fallback must not hide the actionable error returned by
      // a configured provider that was actually attempted (for example, a
      // DeepSeek timeout followed by optional OpenAI/Doubao fallbacks).
      if (!configuredProviderAttempted) {
        lastErrorCode = unavailableProviderError;
        lastErrorStatus = 503;
      }
      await logProviderAttempt({ provider: candidate, model: activeModel, status: 'failed', http_status: 503, error_code: unavailableProviderError, fallback_reason: candidateIndex ? 'primary_provider_failed' : 'provider_not_configured' });
      continue;
    }
    configuredProviderAttempted = true;
    const searchVariants = searchRequested && candidate === 'deepseek' ? [true, false] : [searchRequested && candidate === 'openai'];
    let providerFinished = false;
    for (let variantIndex = 0; variantIndex < searchVariants.length && !providerFinished && !successfulResult; variantIndex += 1) {
      const withSearch = Boolean(searchVariants[variantIndex]);
      usedSearch = withSearch;
      const attemptStarted = Date.now();
      let upstream: Response;
      try {
        upstream = await invokeProvider(config, withSearch);
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError';
        lastErrorCode = aborted ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNREACHABLE';
        lastErrorStatus = aborted ? 504 : 502;
        await logProviderAttempt({ provider: candidate, model: activeModel, status: 'failed', http_status: lastErrorStatus, error_code: lastErrorCode, duration_ms: Date.now() - attemptStarted, fallback_reason: candidateIndex ? 'primary_provider_failed' : null });
        providerFinished = true;
        continue;
      }
      if (!upstream.ok) {
        if (withSearch && await responseRejectsSearch(upstream)) {
          fallbackUsed = true;
          await logProviderAttempt({ provider: candidate, model: activeModel, status: 'failed', http_status: upstream.status, error_code: 'AI_SEARCH_UNSUPPORTED', duration_ms: Date.now() - attemptStarted, fallback_reason: 'retry_without_web_search' });
          continue;
        }
        lastErrorCode = providerErrorCode(upstream.status);
        lastErrorStatus = lastErrorCode === 'AI_RATE_LIMITED' ? 429 : (lastErrorCode === 'AI_QUOTA_EXCEEDED' ? 402 : (lastErrorCode === 'AI_PROVIDER_AUTH_FAILED' || lastErrorCode === 'AI_PROVIDER_FORBIDDEN' ? 502 : (lastErrorCode === 'AI_PROVIDER_UNAVAILABLE' ? 502 : 400)));
        retryAfter = upstream.headers.get('retry-after') || '60';
        await logProviderAttempt({ provider: candidate, model: activeModel, status: 'failed', http_status: upstream.status, error_code: lastErrorCode, duration_ms: Date.now() - attemptStarted, fallback_reason: candidateIndex ? 'fallback_provider' : null });
        providerFinished = true;
        continue;
      }
      let rawResult: Record<string, unknown>;
      try {
        rawResult = await upstream.json();
      } catch {
        lastErrorCode = 'AI_PROVIDER_INVALID_RESPONSE';
        lastErrorStatus = 502;
        await logProviderAttempt({ provider: candidate, model: activeModel, status: 'failed', http_status: 502, error_code: lastErrorCode, duration_ms: Date.now() - attemptStarted, fallback_reason: candidateIndex ? 'fallback_provider' : null });
        providerFinished = true;
        continue;
      }
      if (candidate === 'coze' && Number(rawResult.code || 0) !== 0) {
        lastErrorCode = Number(rawResult.code) === 429 ? 'AI_RATE_LIMITED' : 'AI_PROVIDER_ERROR';
        lastErrorStatus = Number(rawResult.code) === 429 ? 429 : 502;
        await logProviderAttempt({ provider: candidate, model: activeModel, status: 'failed', http_status: lastErrorStatus, error_code: lastErrorCode, duration_ms: Date.now() - attemptStarted, fallback_reason: candidateIndex ? 'fallback_provider' : null });
        providerFinished = true;
        continue;
      }
      const parsed = parseProviderResult(config, rawResult);
      if (!parsed.content) {
        lastErrorCode = 'AI_EMPTY_RESPONSE';
        lastErrorStatus = 502;
        await logProviderAttempt({ provider: candidate, model: activeModel, status: 'failed', http_status: 502, error_code: lastErrorCode, duration_ms: Date.now() - attemptStarted, fallback_reason: candidateIndex ? 'fallback_provider' : null });
        providerFinished = true;
        continue;
      }
      provider = candidate;
      successfulResult = rawResult;
      parsedResult = parsed;
      await logProviderAttempt({ provider: candidate, model: activeModel, status: 'completed', http_status: 200, input_tokens: parsed.inputTokens, output_tokens: parsed.outputTokens, total_tokens: parsed.totalTokens, estimated_cost_usd: estimateCost(parsed.inputTokens, parsed.outputTokens, candidate), duration_ms: Date.now() - attemptStarted, fallback_reason: candidateIndex ? 'fallback_provider' : null });
      providerFinished = true;
    }
  }
  if (!successfulResult || !parsedResult) {
    await logRequest({ status: 'failed', model: activeModel, input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: lastErrorStatus, error_code: lastErrorCode, search_enabled: usedSearch, metadata: { route_source: routeSource, fallback_used: fallbackUsed, agent_key: agentKey } });
    await finalizeReservation('released');
    return jsonResponse(gatewayErrorBody(lastErrorCode, requestId, provider, {
      provider_status: lastErrorStatus, entry_point: entryPoint, operation, task_type: taskType,
      agent_key: agentKey, route_source: routeSource, fallback_used: fallbackUsed,
      attempts: providerAttempts.map((item) => ({ provider: item.provider, status: item.status, error_code: item.error_code })),
    }), lastErrorStatus, origin, lastErrorStatus === 429 ? { 'Retry-After': retryAfter } : {});
  }

  const content = parsedResult.content;
  const inputTokens = parsedResult.inputTokens;
  const outputTokens = parsedResult.outputTokens;
  const totalTokens = Math.max(1, parsedResult.totalTokens, inputTokens + outputTokens, estimatedInputTokens);
  if (!await finalizeReservation('completed', totalTokens)) {
    await logRequest({ status: 'failed', input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens, estimated_cost_usd: estimateCost(inputTokens, outputTokens), http_status: 503, error_code: 'AI_USAGE_FINALIZATION_FAILED' });
    return jsonResponse(gatewayErrorBody('AI_USAGE_FINALIZATION_FAILED', requestId, provider, { entry_point: entryPoint, operation }), 503, origin);
  }
  await logRequest({ status: 'completed', model: activeModel, input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens, estimated_cost_usd: estimateCost(inputTokens, outputTokens, provider), http_status: 200, error_code: null, search_enabled: usedSearch, metadata: { fallback_used: fallbackUsed, route_source: routeSource } });
  const result: Record<string, unknown> = {
    id: String(successfulResult.id || `jay-${requestId}`),
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: totalTokens },
  };
  if (result && typeof result === 'object') {
    const quotaLimit = Math.max(0, Number(reservation?.limit || 0));
    const usedAfter = Math.max(0, Number(reservation?.used_tokens || 0)) + totalTokens;
    const otherReserved = Math.max(0, Number(reservation?.reserved_tokens || 0) - requestedTokens);
    result.jay_quota = {
      plan: effectivePlan,
      used_tokens: usedAfter,
      reserved_tokens: otherReserved,
      limit: quotaLimit,
      remaining_tokens: Math.max(0, quotaLimit - usedAfter - otherReserved),
      reset_at: String(reservation?.reset_at || ''),
    };
    result.jay_gateway = {
      request_id: requestId,
      entry_point: entryPoint,
      operation,
      provider,
      model: activeModel,
      task_type: taskType,
      agent_key: agentKey,
      route_source: routeSource,
      search_used: usedSearch,
      fallback_used: fallbackUsed,
      providers_attempted: providerAttempts.map((item) => item.provider),
      data_disclosure: dataDisclosure,
      retrieval_count: formalRetrieval.citations.length,
    };
    result.jay_retrieval = {
      mode: 'formal_publications',
      source_ids: formalRetrieval.citations.map((item) => item.source_id),
      citations: formalRetrieval.citations,
      error: formalRetrieval.error,
    };
  }
  return jsonResponse(result, 200, origin);
});
