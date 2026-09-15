import {
  corsHeaders,
  enforceRateLimit,
  jsonResponse,
  originAllowed,
  rateLimitResponse,
  requestId,
} from '../_shared/security.ts';

type UploadKind = 'resource' | 'course_material' | 'course_video' | 'workspace_data';

const dangerousExtensions = new Set([
  'exe', 'dll', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'sh', 'js', 'mjs', 'cjs',
  'html', 'htm', 'svg', 'php', 'jar', 'apk', 'app', 'dmg', 'iso',
]);
const allowedByKind: Record<UploadKind, Set<string>> = {
  resource: new Set(['pdf', 'docx', 'xlsx', 'csv', 'md', 'txt', 'zip', 'png', 'jpg', 'jpeg', 'webp']),
  course_material: new Set(['pdf', 'docx', 'xlsx', 'csv', 'md', 'txt', 'zip']),
  course_video: new Set(['mp4', 'webm', 'mov']),
  workspace_data: new Set(['csv', 'xlsx', 'json', 'pdf', 'png', 'jpg', 'jpeg', 'webp']),
};
const mimeByExtension: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  csv: ['text/csv', 'application/csv', 'text/plain'], md: ['text/markdown', 'text/plain'], txt: ['text/plain'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  png: ['image/png'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], webp: ['image/webp'],
  json: ['application/json', 'text/json', 'text/plain'],
  mp4: ['video/mp4'], webm: ['video/webm'], mov: ['video/quicktime'],
};

function uploadError(payload: Record<string, unknown>): { error: string; status: number } | null {
  if (!payload.file || typeof payload.file !== 'object') return null;
  const file = payload.file as Record<string, unknown>;
  const kind = String(file.kind || 'workspace_data').toLowerCase() as UploadKind;
  if (!allowedByKind[kind]) return { error: 'UPLOAD_KIND_NOT_ALLOWED', status: 400 };
  const name = String(file.name || '').trim();
  const parts = name.toLowerCase().split('.').filter(Boolean);
  const extension = parts.length > 1 ? parts[parts.length - 1] : '';
  const size = Number(file.size_bytes);
  const mime = String(file.mime_type || '').toLowerCase().split(';')[0].trim();
  const maxBytes = kind === 'course_video' ? 1_073_741_824 : 52_428_800;
  if (!name || !Number.isSafeInteger(size) || size < 0) return { error: 'UPLOAD_METADATA_INVALID', status: 400 };
  if (size > maxBytes) return { error: 'UPLOAD_TOO_LARGE', status: 413 };
  if (!extension || dangerousExtensions.has(extension) || parts.slice(0, -1).some((part) => dangerousExtensions.has(part))) {
    return { error: 'UPLOAD_FILE_TYPE_BLOCKED', status: 415 };
  }
  if (!allowedByKind[kind].has(extension)) return { error: 'UPLOAD_FILE_TYPE_NOT_ALLOWED', status: 415 };
  if (!mime || !(mimeByExtension[extension] || []).includes(mime)) return { error: 'UPLOAD_MIME_MISMATCH', status: 415 };
  const encoded = String(file.head_base64 || '');
  let head = new Uint8Array();
  if (encoded) {
    try {
      const binary = atob(encoded.slice(0, 256));
      head = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch {
      return { error: 'UPLOAD_SIGNATURE_INVALID', status: 415 };
    }
  }
  const ascii = new TextDecoder().decode(head).trimStart().toLowerCase();
  if (ascii.startsWith('<!doctype html') || ascii.startsWith('<html') || ascii.startsWith('<script') || ascii.startsWith('<?php')) {
    return { error: 'UPLOAD_ACTIVE_CONTENT_BLOCKED', status: 415 };
  }
  const starts = (...bytes: number[]) => bytes.every((byte, index) => head[index] === byte);
  const signatureMatches = !head.length || (
    (extension === 'pdf' && starts(0x25, 0x50, 0x44, 0x46))
    || (['docx', 'xlsx', 'zip'].includes(extension) && starts(0x50, 0x4b))
    || (extension === 'png' && starts(0x89, 0x50, 0x4e, 0x47))
    || (['jpg', 'jpeg'].includes(extension) && starts(0xff, 0xd8, 0xff))
    || (extension === 'webp' && starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50)
    || (extension === 'mp4' && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70)
    || (extension === 'webm' && starts(0x1a, 0x45, 0xdf, 0xa3))
    || extension === 'mov' || ['csv', 'md', 'txt', 'json'].includes(extension)
  );
  return signatureMatches ? null : { error: 'UPLOAD_SIGNATURE_MISMATCH', status: 415 };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (!originAllowed(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const url = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const requestIdValue = requestId(request);
  if (!url || !anonKey || !serviceKey) return jsonResponse({ error: 'SECURITY_GATE_NOT_CONFIGURED', request_id: requestIdValue }, 503, origin);
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return jsonResponse({ error: 'AUTH_REQUIRED', request_id: requestIdValue }, 401, origin);
  const identity = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  if (!identity.ok) return jsonResponse({ error: 'AUTH_REQUIRED', request_id: requestIdValue }, 401, origin);
  const user = await identity.json();
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON', request_id: requestIdValue }, 400, origin); }
  const scope = String(payload.scope || '').toLowerCase();
  if (!['search', 'upload'].includes(scope)) return jsonResponse({ error: 'SECURITY_SCOPE_NOT_ALLOWED', request_id: requestIdValue }, 400, origin);
  try {
    const result = await enforceRateLimit({ supabaseUrl: url, serviceKey, request, scope, userId: String(user.id || '') });
    if (!result.allowed) return rateLimitResponse(result, requestIdValue, origin);
    if (scope === 'upload') {
      const rejected = uploadError(payload);
      if (rejected) return jsonResponse({ error: rejected.error, request_id: requestIdValue }, rejected.status, origin);
    }
    return jsonResponse({ allowed: true, scope, request_id: requestIdValue }, 200, origin, { 'X-Request-Id': requestIdValue });
  } catch (error) {
    console.error('security gate unavailable', error);
    return jsonResponse({ error: 'RATE_LIMIT_UNAVAILABLE', request_id: requestIdValue }, 503, origin);
  }
});
