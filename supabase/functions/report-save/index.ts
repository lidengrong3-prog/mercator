import { fetchCurrentQualityGate } from '../_shared/report-quality.ts';
import {
  canonicalizeFormalReportContent,
  REPORT_VALIDATION_VERSION,
  validateFormalReportWithServerData,
} from '../_shared/report-validation.ts';
import { enforceRateLimit, rateLimitResponse, requestId as securityRequestId } from '../_shared/security.ts';

const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
];
const reportTypes = new Set(['country', 'product', 'market', 'comparison', 'custom']);

type Row = Record<string, unknown>;

function object(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

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
    Vary: 'Origin',
  };
}

function jsonResponse(body: Row, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned',
    },
  });
}

async function authenticatedUser(request: Request, supabaseUrl: string, anonKey: string): Promise<{ id: string } | null> {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  return response.ok ? await response.json() : null;
}

function cleanStrings(value: unknown): string[] {
  return Array.from(new Set(array(value).map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 5000);
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function uuid(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized) ? normalized : null;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method === 'GET' && new URL(request.url).searchParams.has('validation_probe')) return jsonResponse({ status: 'ok', report_validation_version: REPORT_VALIDATION_VERSION }, 200, origin);
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'REPORT_SERVICE_NOT_CONFIGURED' }, 503, origin);
  const user = await authenticatedUser(request, supabaseUrl, anonKey);
  if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
  const securityRequest = securityRequestId(request);
  try {
    const rate = await enforceRateLimit({ supabaseUrl, serviceKey, request, scope: 'report', userId: user.id });
    if (!rate.allowed) return rateLimitResponse(rate, securityRequest, origin);
  } catch (error) {
    console.error('report save rate limiter unavailable', error);
    return jsonResponse({ error: 'RATE_LIMIT_UNAVAILABLE', request_id: securityRequest }, 503, origin);
  }

  let payload: Row;
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, origin); }
  const submitted = object(payload.report);
  const submittedContent = object(submitted?.content);
  if (!submitted || !submittedContent) return jsonResponse({ error: 'REPORT_PAYLOAD_REQUIRED' }, 400, origin);
  if (JSON.stringify(submittedContent).length > 2_000_000) return jsonResponse({ error: 'REPORT_TOO_LARGE' }, 413, origin);
  // The structured sections and appendix are the source of truth. Rebuild the
  // formal body server-side so harmless renderer drift cannot reject a report,
  // and unstructured client additions can never enter the saved publication.
  const content = canonicalizeFormalReportContent(submittedContent);
  const textNormalized = String(submittedContent.text || '').trim() !== String(content.text || '').trim();

  const clientId = String(submitted.client_id || '').trim().slice(0, 240);
  const title = String(submitted.title || '').trim().slice(0, 160);
  if (!clientId || !title) return jsonResponse({ error: 'REPORT_IDENTITY_REQUIRED' }, 400, origin);
  const workspaceId = uuid(submitted.workspace_id);
  if (!workspaceId) return jsonResponse({ error: 'WORKSPACE_REQUIRED' }, 400, origin);

  const serviceHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };
  const membershipResponse = await fetch(
    `${supabaseUrl}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=role&limit=1`,
    { headers: serviceHeaders },
  );
  const memberships = membershipResponse.ok ? await membershipResponse.json() : [];
  const role = String(memberships?.[0]?.role || '');
  if (!role) return jsonResponse({ error: 'WORKSPACE_FORBIDDEN' }, 403, origin);
  if (!['owner', 'admin', 'editor'].includes(role)) return jsonResponse({ error: 'WORKSPACE_READ_ONLY' }, 403, origin);

  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/generated_reports?workspace_id=eq.${encodeURIComponent(workspaceId)}&client_id=eq.${encodeURIComponent(clientId)}&select=id,user_id&limit=1`,
    { headers: serviceHeaders },
  );
  const existingRows = existingResponse.ok ? await existingResponse.json() : [];
  const creatorId = uuid(existingRows?.[0]?.user_id) || user.id;
  const currentQuality = await fetchCurrentQualityGate(supabaseUrl, serviceHeaders);
  if (!currentQuality.snapshot) return jsonResponse({ error: 'REPORT_QUALITY_STATUS_UNAVAILABLE', reasons: currentQuality.reasons }, 503, origin);
  if (!currentQuality.ok) return jsonResponse({ error: 'REPORT_QUALITY_GATE_BLOCKED', reasons: currentQuality.reasons }, 409, origin);

  const validation = await validateFormalReportWithServerData(
    supabaseUrl,
    serviceHeaders,
    workspaceId,
    content,
    currentQuality,
    { requireCurrentQualityVersion: true },
  );
  if (!validation.ok) {
    return jsonResponse({
      error: validation.unavailable ? 'REPORT_VALIDATION_UNAVAILABLE' : 'REPORT_SERVER_VALIDATION_FAILED',
      validation,
    }, validation.unavailable ? 503 : 409, origin);
  }

  const now = new Date().toISOString();
  const acceptanceRunId = typeof payload.acceptance_run_id === 'string'
    ? payload.acceptance_run_id.trim().slice(0, 160)
    : null;
  const appendix = array(content.source_appendix || object(content.model)?.sourceAppendix).map(object).filter((item): item is Row => !!item);
  const sourceRecordIds = cleanStrings(appendix.map((source) => source.recordId || source.source_record_id));
  const materialSnapshotIds = cleanStrings(appendix.filter((source) => String(source.verificationStatus || source.verification_status).toLowerCase() === 'uploaded').map((source) => source.snapshotId || source.recordId || source.source_record_id));
  const serverContent: Row = {
    ...content,
    publishable: true,
    save_status: 'saved',
    saved_at: now,
    quality_report_version: validation.quality_report_version,
    source_record_ids: sourceRecordIds,
    material_snapshot_ids: materialSnapshotIds,
    scope_snapshot: {
      marketCodes: validation.scope.market_codes,
      platformKeys: validation.scope.platform_keys,
      categoryCodes: validation.scope.category_codes,
      capturedAt: now,
    },
    server_validation: validation,
    content_quality: validation.content_quality,
    text_normalized_by_server: textNormalized,
    publication_status: 'formal',
  };
  const reportType = String(submitted.report_type || 'custom');
  const reportRunId = typeof submitted.report_run_id === 'string' && /^[0-9a-f-]{36}$/i.test(submitted.report_run_id) ? submitted.report_run_id : null;
  const row: Row = {
    user_id: creatorId,
    workspace_id: workspaceId,
    acceptance_run_id: acceptanceRunId,
    client_id: clientId,
    report_type: reportTypes.has(reportType) ? reportType : 'custom',
    title,
    content: serverContent,
    status: 'completed',
    generation_status: 'completed',
    save_status: 'saved',
    saved_at: now,
    template_version: String(content.template_version || submitted.template_version || ''),
    data_version: String(content.data_version || submitted.data_version || ''),
    quality_report_version: validation.quality_report_version,
    data_snapshot_at: isoOrNull(content.data_snapshot_at || submitted.data_snapshot_at),
    material_snapshot_ids: materialSnapshotIds,
    source_record_ids: sourceRecordIds,
    scope_snapshot: serverContent.scope_snapshot,
    report_run_id: reportRunId,
    publication_status: 'formal',
    server_validation_version: REPORT_VALIDATION_VERSION,
    server_validated_at: validation.validated_at,
    server_validation: validation,
    content_quality: validation.content_quality,
  };

  const saveResponse = await fetch(
    `${supabaseUrl}/rest/v1/generated_reports?on_conflict=workspace_id,client_id&select=*`,
    {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row),
    },
  );
  if (!saveResponse.ok) {
    console.error('report-save persistence failed', saveResponse.status, (await saveResponse.text()).slice(0, 500));
    return jsonResponse({ error: 'REPORT_SAVE_FAILED' }, 502, origin);
  }
  const rows = await saveResponse.json();
  const saved = rows?.[0];
  if (!saved) return jsonResponse({ error: 'REPORT_SAVE_FAILED' }, 502, origin);
  return jsonResponse({ report: saved, validation, text_normalized: textNormalized }, 200, origin);
});
