const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
];

type Json = Record<string, unknown>;

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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

function jsonResponse(body: Json, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned',
    },
  });
}

function html(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
}

function uuid(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized) ? normalized : null;
}

function email(value: unknown): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.length <= 254 ? normalized : null;
}

function appUrl(): string | null {
  const value = String(Deno.env.get('APP_PUBLIC_URL') || '').trim().replace(/\/$/, '');
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

async function authenticatedUser(request: Request, url: string, anonKey: string): Promise<{ id: string; email?: string } | null> {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  return response.ok ? await response.json() : null;
}

async function db(url: string, headers: Record<string, string>, path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!response.ok) throw new HttpError(`DATABASE_${response.status}`, response.status >= 500 ? 502 : response.status);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function markDelivery(
  url: string,
  headers: Record<string, string>,
  inviteId: string,
  values: Json,
): Promise<void> {
  await db(url, headers, `workspace_invites?id=eq.${encodeURIComponent(inviteId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(values),
  });
}

export async function handleWorkspaceInvite(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'INVITE_SERVICE_NOT_CONFIGURED' }, 503, origin);
  const user = await authenticatedUser(request, supabaseUrl, anonKey);
  if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);

  let payload: Json;
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, origin); }
  const workspaceId = uuid(payload.workspace_id);
  const inviteEmail = email(payload.email);
  const role = ['admin', 'editor', 'viewer'].includes(String(payload.role || '')) ? String(payload.role) : 'viewer';
  if (!workspaceId) return jsonResponse({ error: 'WORKSPACE_REQUIRED' }, 400, origin);
  if (!inviteEmail) return jsonResponse({ error: 'INVITE_EMAIL_INVALID' }, 400, origin);
  if (inviteEmail === String(user.email || '').toLowerCase()) return jsonResponse({ error: 'INVITE_SELF_NOT_ALLOWED' }, 409, origin);

  const serviceHeaders = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' };
  try {
    const memberships = await db(
      supabaseUrl,
      serviceHeaders,
      `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&role=in.(owner,admin)&select=id&limit=1`,
    ) as Json[];
    if (!memberships?.length) throw new HttpError('WORKSPACE_FORBIDDEN', 403);

    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    const fromEmail = Deno.env.get('WORKSPACE_INVITE_FROM_EMAIL') || Deno.env.get('NOTIFICATION_FROM_EMAIL') || '';
    const publicUrl = appUrl();
    if (!resendKey || !fromEmail || !publicUrl) throw new HttpError('INVITE_MAIL_NOT_CONFIGURED', 503);

    const workspaceRows = await db(
      supabaseUrl,
      serviceHeaders,
      `workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=id,name&limit=1`,
    ) as Json[];
    const workspace = workspaceRows?.[0];
    if (!workspace) throw new HttpError('WORKSPACE_NOT_FOUND', 404);

    const existingMembers = await db(
      supabaseUrl,
      serviceHeaders,
      `profiles?email=eq.${encodeURIComponent(inviteEmail)}&select=id,email&limit=1`,
    ) as Json[];
    if (existingMembers?.[0]?.id) {
      const joined = await db(
        supabaseUrl,
        serviceHeaders,
        `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(String(existingMembers[0].id))}&status=eq.active&select=id&limit=1`,
      ) as Json[];
      if (joined?.length) throw new HttpError('INVITE_ALREADY_MEMBER', 409);
    }

    const pending = await db(
      supabaseUrl,
      serviceHeaders,
      `workspace_invites?workspace_id=eq.${encodeURIComponent(workspaceId)}&email=eq.${encodeURIComponent(inviteEmail)}&status=eq.pending&select=id,delivery_attempts&limit=1`,
    ) as Json[];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    let invitation: Json;
    if (pending?.[0]?.id) {
      const updated = await db(
        supabaseUrl,
        serviceHeaders,
        `workspace_invites?id=eq.${encodeURIComponent(String(pending[0].id))}&select=*`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            role,
            expires_at: expiresAt,
            delivery_status: 'sending',
            delivery_error: null,
            delivery_attempts: Number(pending[0].delivery_attempts || 0) + 1,
            last_delivery_at: now.toISOString(),
          }),
        },
      ) as Json[];
      invitation = updated[0];
    } else {
      const inserted = await db(supabaseUrl, serviceHeaders, 'workspace_invites?select=*', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          email: inviteEmail,
          role,
          invited_by: user.id,
          status: 'pending',
          expires_at: expiresAt,
          delivery_status: 'sending',
          delivery_provider: 'resend',
          delivery_attempts: 1,
          last_delivery_at: now.toISOString(),
        }),
      }) as Json[];
      invitation = inserted[0];
    }
    const inviteId = uuid(invitation?.id);
    if (!inviteId) throw new HttpError('INVITE_PERSIST_FAILED', 502);

    const separator = publicUrl.includes('?') ? '&' : '?';
    const inviteUrl = `${publicUrl}${separator}workspace_invite=${encodeURIComponent(inviteId)}#settings`;
    const workspaceName = String(workspace.name || 'JAY观海工作区');
    const roleLabel = ({ admin: '管理员', editor: '编辑者', viewer: '查看者' } as Record<string, string>)[role];
    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [inviteEmail],
        subject: `邀请你加入 ${workspaceName}`,
        text: `你被邀请以${roleLabel}身份加入“${workspaceName}”。请在 7 天内登录并接受邀请：${inviteUrl}`,
        html: `<div style="font-family:Arial,'Microsoft YaHei',sans-serif;color:#1f2d3d;line-height:1.7"><h2>${html(workspaceName)}</h2><p>你被邀请以“${html(roleLabel)}”身份加入 JAY观海工作区。</p><p><a href="${html(inviteUrl)}" style="display:inline-block;padding:10px 18px;background:#1e5fae;color:#fff;text-decoration:none;border-radius:6px">接受邀请</a></p><p style="color:#6b7c8f;font-size:13px">邀请 7 天内有效。请使用 ${html(inviteEmail)} 登录。</p></div>`,
      }),
    });
    const mailBody = await mail.json().catch(() => ({})) as Json;
    if (!mail.ok || !mailBody.id) {
      await markDelivery(supabaseUrl, serviceHeaders, inviteId, {
        delivery_status: 'failed',
        delivery_provider: 'resend',
        delivery_error: String(mailBody.message || `HTTP_${mail.status}`).slice(0, 500),
      });
      return jsonResponse({ error: 'INVITE_DELIVERY_FAILED', invite_id: inviteId }, 502, origin);
    }

    const sentAt = new Date().toISOString();
    await markDelivery(supabaseUrl, serviceHeaders, inviteId, {
      delivery_status: 'sent',
      delivery_provider: 'resend',
      delivery_message_id: String(mailBody.id).slice(0, 240),
      delivery_error: null,
      sent_at: sentAt,
      last_delivery_at: sentAt,
    });
    return jsonResponse({
      invitation: {
        id: inviteId,
        workspace_id: workspaceId,
        email: inviteEmail,
        role,
        status: 'pending',
        delivery_status: 'sent',
        sent_at: sentAt,
        expires_at: expiresAt,
      },
    }, 200, origin);
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status, origin);
    console.error('workspace invitation failed', error);
    return jsonResponse({ error: 'INVITE_SERVICE_FAILED' }, 500, origin);
  }
}

if (import.meta.main) Deno.serve(handleWorkspaceInvite);
