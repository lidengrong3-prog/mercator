import {
  allowedOrigins,
  corsHeaders,
  jsonResponse,
  serviceHeaders,
  supabaseServiceConfig,
  userFromJwt,
} from '../_shared/billing.ts';

type Channel = 'email' | 'wecom' | 'feishu';
type Json = Record<string, unknown>;

interface ChannelConfig {
  id: string;
  user_id: string;
  workspace_id: string;
  channel: Channel;
  enabled: boolean;
  target_hint?: string | null;
  secret_ciphertext?: string | null;
  last_test_status?: string | null;
  last_test_error?: string | null;
  last_test_at?: string | null;
}

interface Delivery {
  id: string;
  event_id: string;
  user_id: string;
  channel: Channel;
  status: string;
  attempt_count: number;
}

interface NotificationEvent {
  id: string;
  user_id: string;
  workspace_id: string;
  event_type: string;
  severity: string;
  title: string;
  body: string;
  payload: Json;
  created_at: string;
}

interface AlertRecord {
  id: string;
  type: string;
  level: string;
  title: string;
  detail: string;
  date: string;
  marketCode: string;
  platformKey: string;
  categoryCodes: string[];
  source: string;
  sourceUrl: string;
}

class HttpError extends Error {
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.status = status;
  }
}

const channels: Channel[] = ['email', 'wecom', 'feishu'];

function notificationEnabled(): boolean {
  return Deno.env.get('NOTIFICATION_CHANNELS_ENABLED') === 'true';
}

function uuid(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
}

function asChannel(value: unknown): Channel | null {
  const candidate = String(value || '').toLowerCase() as Channel;
  return channels.includes(candidate) ? candidate : null;
}

function values(value: unknown): string[] {
  const source = Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value];
  return [...new Set(source.map((item) => String(item || '').trim()).filter(Boolean))];
}

function token(value: unknown): string {
  return String(value || '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, '');
}

function safeHttpsUrl(value: unknown): string {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function cleanError(value: unknown): string {
  return String(value instanceof Error ? value.message : value || 'DELIVERY_FAILED').replace(/[\r\n]+/g, ' ').slice(0, 500);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutCode: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new HttpError(timeoutCode, 504);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function html(value: unknown): string {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  return local && domain ? `${local.slice(0, 1)}***@${domain}` : '登录邮箱';
}

function validateWebhook(channel: Channel, value: unknown): URL {
  let parsed: URL;
  try { parsed = new URL(String(value || '').trim()); } catch { throw new HttpError('INVALID_WEBHOOK_URL', 400); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new HttpError('INVALID_WEBHOOK_URL', 400);
  const host = parsed.hostname.toLowerCase();
  if (channel === 'wecom') {
    if (host !== 'qyapi.weixin.qq.com' || parsed.pathname !== '/cgi-bin/webhook/send' || !parsed.searchParams.get('key')) {
      throw new HttpError('INVALID_WECOM_WEBHOOK_URL', 400);
    }
  } else if (channel === 'feishu') {
    if (!['open.feishu.cn', 'open.larksuite.com'].includes(host) || !/^\/open-apis\/bot\/v2\/hook\/[A-Za-z0-9_-]+$/.test(parsed.pathname)) {
      throw new HttpError('INVALID_FEISHU_WEBHOOK_URL', 400);
    }
  } else {
    throw new HttpError('WEBHOOK_CHANNEL_REQUIRED', 400);
  }
  return parsed;
}

function maskWebhook(value: URL): string {
  return `${value.hostname}/...`;
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('NOTIFICATION_CONFIG_ENCRYPTION_KEY') || '';
  if (secret.length < 24) throw new HttpError('NOTIFICATION_ENCRYPTION_NOT_CONFIGURED', 503);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(value: Uint8Array): string {
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptSecret(value: string): Promise<string> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value)));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv); packed.set(encrypted, iv.length);
  return `v1.${toBase64(packed)}`;
}

async function decryptSecret(value: string): Promise<string> {
  if (!value.startsWith('v1.')) throw new HttpError('NOTIFICATION_CONFIG_VERSION_UNSUPPORTED', 503);
  const packed = fromBase64(value.slice(3));
  if (packed.length < 29) throw new HttpError('NOTIFICATION_CONFIG_INVALID', 503);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(0, 12) }, await encryptionKey(), packed.slice(12));
  return new TextDecoder().decode(decrypted);
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const av = new Uint8Array(a); const bv = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < av.length; index += 1) difference |= av[index] ^ bv[index];
  return difference === 0 && left.length === right.length;
}

async function dbJson(config: NonNullable<ReturnType<typeof supabaseServiceConfig>>, path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetchWithTimeout(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(config.serviceKey), ...(init.headers || {}) },
  }, 15_000, 'NOTIFICATION_DATABASE_TIMEOUT');
  if (!response.ok) throw new HttpError(`NOTIFICATION_DATABASE_${response.status}`, 502);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

async function activeWorkspace(config: NonNullable<ReturnType<typeof supabaseServiceConfig>>, userId: string, requested: unknown): Promise<string> {
  const requestedId = uuid(requested);
  if (requested !== undefined && requested !== null && requested !== '' && !requestedId) {
    throw new HttpError('INVALID_WORKSPACE_ID', 400);
  }
  const filter = requestedId ? `&workspace_id=eq.${encodeURIComponent(requestedId)}` : '&order=joined_at.asc';
  const rows = await dbJson(config, `workspace_members?user_id=eq.${encodeURIComponent(userId)}&status=eq.active${filter}&select=workspace_id&limit=1`);
  if (!rows?.[0]?.workspace_id) throw new HttpError('WORKSPACE_FORBIDDEN', 403);
  return String(rows[0].workspace_id);
}

async function channelConfigs(config: NonNullable<ReturnType<typeof supabaseServiceConfig>>, userId: string, workspaceId: string): Promise<ChannelConfig[]> {
  return await dbJson(config, `notification_channel_configs?user_id=eq.${encodeURIComponent(userId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,user_id,workspace_id,channel,enabled,target_hint,secret_ciphertext,last_test_status,last_test_error,last_test_at&order=channel.asc`) || [];
}

function catalogMap(rows: Json[], keyField: string): Map<string, string> {
  const result = new Map<string, string>();
  (rows || []).forEach((row) => {
    const canonical = String(row[keyField] || '').trim();
    if (!canonical) return;
    [row[keyField], row.key, row.name, row.label, ...values(row.aliases)].forEach((alias) => {
      const normalized = token(alias);
      if (normalized) result.set(normalized, canonical);
    });
  });
  return result;
}

function alertRecord(
  raw: unknown,
  marketMap: Map<string, string>,
  platformMap: Map<string, string>,
  maxAgeDays: number,
): AlertRecord | null {
  const array = Array.isArray(raw) ? raw : null;
  const object = !array && raw && typeof raw === 'object' ? raw as Json : {};
  const metadata = array && array[9] && typeof array[9] === 'object' ? array[9] as Json
    : object.metadata && typeof object.metadata === 'object' ? object.metadata as Json : object;
  const id = String(array ? array[0] : object.id || object.source_record_id || '').trim().slice(0, 240);
  const type = String(array ? array[1] : object.type || object.category || 'policy').trim().toLowerCase();
  const level = String(array ? array[2] : object.level || object.impact_level || 'mid').trim().toLowerCase();
  const title = String(array ? array[3] : object.title_zh || object.title || '').trim().slice(0, 160);
  const marketValue = array ? array[4] : object.market_code || object.market || object.country || object.region;
  const platformValue = array ? array[5] : object.platform_key || object.platform;
  const detail = String(array ? array[6] : object.detail || object.summary_zh || object.summary || '').trim().slice(0, 4000);
  const date = String(array ? array[7] : object.date || object.published_at || object.effective_date || '').trim();
  const verification = String(metadata.verification_status || object.verification_status || '').toLowerCase();
  const sourceUrl = safeHttpsUrl(metadata.source_url || object.source_url || object.url);
  const parsedDate = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date);
  const oldest = Date.now() - maxAgeDays * 86_400_000;
  if (!id || !title || !detail || verification !== 'verified' || !sourceUrl || !Number.isFinite(parsedDate) || parsedDate < oldest) return null;
  return {
    id, type, level, title, detail, date,
    marketCode: marketMap.get(token(metadata.market_code || object.market_code || marketValue)) || '',
    platformKey: platformMap.get(token(metadata.platform_key || object.platform_key || platformValue)) || '',
    categoryCodes: values(metadata.category_codes || object.category_codes).map((value) => value.toLowerCase()),
    source: String(metadata.source || object.source || '').trim().slice(0, 240),
    sourceUrl,
  };
}

function subscriptionType(type: string): string {
  if (['policy', 'tax', 'access', 'platform', 'rule', 'compliance'].includes(type)) return 'policy';
  if (['shop', 'store'].includes(type)) return 'shop';
  if (['cat', 'category', 'competition'].includes(type)) return 'competition';
  if (['fx', 'currency'].includes(type)) return 'fx';
  return 'product';
}

function alertMatchesPreferences(alert: AlertRecord, preferences: Json): boolean {
  if (preferences.subscriptions_configured !== true) return false;
  const subscriptions = values(preferences.subscriptions).map((value) => value.toLowerCase());
  if (!subscriptions.includes(subscriptionType(alert.type))) return false;
  const scope = preferences.alert_scope && typeof preferences.alert_scope === 'object' ? preferences.alert_scope as Json : {};
  const marketCodes = values(scope.market_codes).map((value) => value.toUpperCase());
  const platformKeys = values(scope.platform_keys).map((value) => value.toLowerCase());
  const categoryCodes = values(scope.category_codes).map((value) => value.toLowerCase());
  if (!marketCodes.length || !alert.marketCode || !marketCodes.includes(alert.marketCode.toUpperCase())) return false;
  if (alert.platformKey && platformKeys.length && !platformKeys.includes(alert.platformKey.toLowerCase())) return false;
  if (alert.categoryCodes.length && categoryCodes.length && !alert.categoryCodes.some((code) => categoryCodes.includes(code))) return false;
  return true;
}

async function syncSubscribedAlerts(
  service: NonNullable<ReturnType<typeof supabaseServiceConfig>>,
): Promise<number> {
  const configuredAge = Number(Deno.env.get('NOTIFICATION_ALERT_MAX_AGE_DAYS') || 7);
  const maxAgeDays = Math.min(30, Math.max(1, Number.isFinite(configuredAge) ? configuredAge : 7));
  const [bundles, markets, platforms, configs, memberships, preferenceRows] = await Promise.all([
    dbJson(service, 'market_data?key=eq.alerts&select=data&limit=1'),
    dbJson(service, 'market_catalog?status=eq.active&select=code,key,name,label,aliases'),
    dbJson(service, 'platform_catalog?status=eq.active&select=key,name,aliases'),
    dbJson(service, 'notification_channel_configs?enabled=eq.true&select=user_id,workspace_id'),
    dbJson(service, 'workspace_members?status=eq.active&select=user_id,workspace_id'),
    dbJson(service, 'user_preferences?select=user_id,notification_prefs'),
  ]);
  const configuredPairs = new Set((configs || []).map((row: Json) => `${row.user_id}:${row.workspace_id}`));
  const preferences = new Map<string, Json>((preferenceRows || []).map((row: Json) => [
    String(row.user_id), row.notification_prefs && typeof row.notification_prefs === 'object' ? row.notification_prefs as Json : {},
  ]));
  const marketMap = catalogMap(markets || [], 'code');
  const platformMap = catalogMap(platforms || [], 'key');
  const rawAlerts = Array.isArray(bundles?.[0]?.data) ? bundles[0].data : [];
  const alerts = rawAlerts.map((raw: unknown) => alertRecord(raw, marketMap, platformMap, maxAgeDays)).filter(Boolean) as AlertRecord[];
  const rows: Json[] = [];
  (memberships || []).forEach((membership: Json) => {
    const userId = String(membership.user_id || '');
    const workspaceId = String(membership.workspace_id || '');
    if (!configuredPairs.has(`${userId}:${workspaceId}`)) return;
    const userPreferences = preferences.get(userId) || {};
    alerts.filter((alert) => alertMatchesPreferences(alert, userPreferences)).forEach((alert) => {
      rows.push({
        user_id: userId,
        workspace_id: workspaceId,
        event_type: 'alert',
        severity: ['high', 'critical'].includes(alert.level) ? 'critical' : alert.level === 'low' ? 'info' : 'warning',
        title: alert.title,
        body: alert.detail,
        source_record_id: alert.id,
        payload: {
          alert_id: alert.id,
          alert_type: alert.type,
          market_code: alert.marketCode,
          platform_key: alert.platformKey || null,
          category_codes: alert.categoryCodes,
          source: alert.source,
          source_url: alert.sourceUrl,
          published_at: alert.date,
          verification_status: 'verified',
        },
      });
    });
  });
  let created = 0;
  for (let offset = 0; offset < rows.length; offset += 100) {
    const inserted = await dbJson(service, 'notification_events?on_conflict=user_id,workspace_id,event_type,source_record_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(rows.slice(offset, offset + 100)),
    });
    created += Array.isArray(inserted) ? inserted.length : 0;
  }
  return created;
}

function availability(userEmail?: string): Record<Channel, boolean> {
  const master = notificationEnabled();
  const encrypted = String(Deno.env.get('NOTIFICATION_CONFIG_ENCRYPTION_KEY') || '').length >= 24;
  return {
    email: master && Boolean(userEmail && Deno.env.get('RESEND_API_KEY') && Deno.env.get('NOTIFICATION_FROM_EMAIL')),
    wecom: master && encrypted,
    feishu: master && encrypted,
  };
}

async function saveConfig(
  service: NonNullable<ReturnType<typeof supabaseServiceConfig>>,
  user: { id: string; email?: string },
  workspaceId: string,
  payload: Json,
): Promise<ChannelConfig> {
  const channel = asChannel(payload.channel);
  if (!channel) throw new HttpError('INVALID_NOTIFICATION_CHANNEL', 400);
  const enabled = payload.enabled === true;
  const existing = (await channelConfigs(service, user.id, workspaceId)).find((row) => row.channel === channel);
  const available = availability(user.email)[channel];
  if (enabled && !available) throw new HttpError('NOTIFICATION_CHANNEL_NOT_AVAILABLE', 503);

  let ciphertext = existing?.secret_ciphertext || null;
  let targetHint = existing?.target_hint || null;
  if (channel === 'email') {
    if (!user.email) throw new HttpError('EMAIL_ADDRESS_REQUIRED', 400);
    ciphertext = null;
    targetHint = maskEmail(user.email);
  } else if (payload.webhook_url) {
    const webhook = validateWebhook(channel, payload.webhook_url);
    ciphertext = await encryptSecret(webhook.toString());
    targetHint = maskWebhook(webhook);
  } else if (enabled && !ciphertext) {
    throw new HttpError('WEBHOOK_URL_REQUIRED', 400);
  }

  const rows = await dbJson(service, 'notification_channel_configs?on_conflict=user_id,workspace_id,channel', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: user.id, workspace_id: workspaceId, channel, enabled,
      target_hint: targetHint, secret_ciphertext: ciphertext, config_version: 1,
    }),
  });
  if (!rows?.[0]) throw new HttpError('NOTIFICATION_CONFIG_SAVE_FAILED', 502);
  return rows[0];
}

async function updateDelivery(service: NonNullable<ReturnType<typeof supabaseServiceConfig>>, id: string, values: Json): Promise<void> {
  await dbJson(service, `notification_deliveries?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(values),
  });
}

async function updateTestStatus(
  service: NonNullable<ReturnType<typeof supabaseServiceConfig>>,
  configId: string,
  status: 'sent' | 'failed',
  error?: string,
): Promise<void> {
  await dbJson(service, `notification_channel_configs?id=eq.${encodeURIComponent(configId)}`, {
    method: 'PATCH', body: JSON.stringify({
      last_test_status: status, last_test_error: error || null, last_test_at: new Date().toISOString(),
    }),
  });
}

async function sendEmail(userEmail: string, event: NotificationEvent, deliveryId: string): Promise<string | null> {
  const key = Deno.env.get('RESEND_API_KEY') || '';
  const from = Deno.env.get('NOTIFICATION_FROM_EMAIL') || '';
  if (!key || !from) throw new HttpError('EMAIL_PROVIDER_NOT_CONFIGURED', 503);
  const response = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `notification-${deliveryId}`,
    },
    body: JSON.stringify({
      from, to: [userEmail], subject: `[JAY观海] ${event.title}`.slice(0, 180),
      text: `${event.title}\n\n${event.body}\n\n时间：${event.created_at}`,
      html: `<h2>${html(event.title)}</h2><p>${html(event.body).replace(/\n/g, '<br>')}</p><p style="color:#64748b;font-size:12px">时间：${html(event.created_at)}</p>`,
    }),
  }, 20_000, 'EMAIL_PROVIDER_TIMEOUT');
  const raw = await response.text();
  let body: Json = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
  if (!response.ok) throw new Error(`RESEND_${response.status}_${String(body.message || body.name || 'FAILED')}`);
  return body.id ? String(body.id).slice(0, 240) : null;
}

async function sendEnterprise(channel: Channel, webhookUrl: string, event: NotificationEvent): Promise<string | null> {
  const webhook = validateWebhook(channel, webhookUrl);
  const text = `${event.title}\n${event.body}\n时间：${event.created_at}`.slice(0, 3500);
  const body = channel === 'wecom'
    ? { msgtype: 'markdown', markdown: { content: `**${event.title}**\n> ${event.body.replace(/\n/g, '\n> ')}\n> 时间：${event.created_at}`.slice(0, 3900) } }
    : { msg_type: 'text', content: { text } };
  let response: Response;
  try {
    response = await fetchWithTimeout(webhook.toString(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, 20_000, 'ENTERPRISE_PROVIDER_TIMEOUT');
  } catch (error) {
    if (error instanceof HttpError && error.message === 'ENTERPRISE_PROVIDER_TIMEOUT') throw error;
    // Network errors can contain the requested URL, whose query string is a
    // bearer credential. Never persist or return that provider error text.
    throw new HttpError('ENTERPRISE_PROVIDER_UNREACHABLE', 502);
  }
  const raw = await response.text();
  let result: Json = {}; try { result = raw ? JSON.parse(raw) : {}; } catch { result = {}; }
  const providerCode = channel === 'wecom' ? Number(result.errcode || 0) : Number(result.code || result.StatusCode || 0);
  if (!response.ok || providerCode !== 0) throw new Error(`${channel.toUpperCase()}_${response.status}_${providerCode || 'FAILED'}`);
  return response.headers.get('x-request-id') || response.headers.get('x-tt-logid');
}

async function deliveryContext(
  service: NonNullable<ReturnType<typeof supabaseServiceConfig>>,
  delivery: Delivery,
): Promise<{ event: NotificationEvent; config: ChannelConfig; email: string }> {
  const events = await dbJson(service, `notification_events?id=eq.${encodeURIComponent(delivery.event_id)}&user_id=eq.${encodeURIComponent(delivery.user_id)}&select=id,user_id,workspace_id,event_type,severity,title,body,payload,created_at&limit=1`);
  const event = events?.[0] as NotificationEvent | undefined;
  if (!event) throw new HttpError('NOTIFICATION_EVENT_NOT_FOUND', 404);
  const workspaceId = uuid(event.workspace_id);
  if (!workspaceId) throw new HttpError('NOTIFICATION_EVENT_WORKSPACE_REQUIRED', 409);
  const [configs, memberships, authResponse] = await Promise.all([
    dbJson(service, `notification_channel_configs?user_id=eq.${encodeURIComponent(delivery.user_id)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&channel=eq.${encodeURIComponent(delivery.channel)}&select=id,user_id,workspace_id,channel,enabled,target_hint,secret_ciphertext,last_test_status,last_test_error,last_test_at&limit=1`),
    dbJson(service, `workspace_members?user_id=eq.${encodeURIComponent(delivery.user_id)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&status=eq.active&select=id&limit=1`),
    fetchWithTimeout(`${service.url}/auth/v1/admin/users/${encodeURIComponent(delivery.user_id)}`, {
      headers: serviceHeaders(service.serviceKey),
    }, 15_000, 'NOTIFICATION_AUTH_TIMEOUT'),
  ]);
  if (!memberships?.length) throw new HttpError('NOTIFICATION_WORKSPACE_INACTIVE', 409);
  if (!authResponse.ok) throw new HttpError(`NOTIFICATION_AUTH_${authResponse.status}`, 502);
  const authUser = await authResponse.json();
  const config = configs?.[0] as ChannelConfig | undefined;
  if (!config?.enabled) throw new HttpError('NOTIFICATION_CHANNEL_DISABLED', 409);
  return { event, config, email: String(authUser?.email || '') };
}

async function deliverClaimed(
  service: NonNullable<ReturnType<typeof supabaseServiceConfig>>,
  delivery: Delivery,
): Promise<Json> {
  let context: Awaited<ReturnType<typeof deliveryContext>> | null = null;
  try {
    if (!notificationEnabled()) throw new HttpError('NOTIFICATION_CHANNELS_DISABLED', 503);
    context = await deliveryContext(service, delivery);
    let providerMessageId: string | null = null;
    if (delivery.channel === 'email') {
      if (!context.email) throw new HttpError('EMAIL_ADDRESS_REQUIRED', 400);
      providerMessageId = await sendEmail(context.email, context.event, delivery.id);
    } else {
      if (!context.config.secret_ciphertext) throw new HttpError('WEBHOOK_URL_REQUIRED', 400);
      providerMessageId = await sendEnterprise(delivery.channel, await decryptSecret(context.config.secret_ciphertext), context.event);
    }
    await updateDelivery(service, delivery.id, {
      status: 'sent', provider_message_id: providerMessageId, last_error: null,
      next_attempt_at: null, sent_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    });
    if (context.event.payload?.channel_test === delivery.channel) await updateTestStatus(service, context.config.id, 'sent');
    return { id: delivery.id, channel: delivery.channel, status: 'sent' };
  } catch (error) {
    const message = cleanError(error);
    const exhausted = Number(delivery.attempt_count || 0) >= 5;
    const delaySeconds = Math.min(3600, 60 * (2 ** Math.max(0, Number(delivery.attempt_count || 1) - 1)));
    const cancelled = error instanceof HttpError && [
      'NOTIFICATION_CHANNEL_DISABLED', 'NOTIFICATION_WORKSPACE_INACTIVE',
      'NOTIFICATION_EVENT_NOT_FOUND', 'NOTIFICATION_EVENT_WORKSPACE_REQUIRED',
    ].includes(error.message);
    await updateDelivery(service, delivery.id, {
      status: cancelled ? 'cancelled' : 'failed',
      last_error: message, next_attempt_at: exhausted || cancelled ? null : new Date(Date.now() + delaySeconds * 1000).toISOString(),
      completed_at: new Date().toISOString(),
    });
    if (context?.event.payload?.channel_test === delivery.channel) await updateTestStatus(service, context.config.id, 'failed', message);
    return { id: delivery.id, channel: delivery.channel, status: 'failed', error: message };
  }
}

async function claim(
  service: NonNullable<ReturnType<typeof supabaseServiceConfig>>,
  limit: number,
  deliveryId?: string | null,
): Promise<Delivery[]> {
  return await dbJson(service, 'rpc/claim_notification_deliveries', {
    method: 'POST', body: JSON.stringify({ p_limit: Math.min(100, Math.max(1, limit)), p_delivery_id: deliveryId || null }),
  }) || [];
}

async function deliverClaims(
  service: NonNullable<ReturnType<typeof supabaseServiceConfig>>,
  deliveries: Delivery[],
  concurrency = 5,
): Promise<Json[]> {
  const results: Json[] = [];
  const size = Math.min(10, Math.max(1, concurrency));
  for (let offset = 0; offset < deliveries.length; offset += size) {
    const batch = deliveries.slice(offset, offset + size);
    results.push(...await Promise.all(batch.map((delivery) => deliverClaimed(service, delivery))));
  }
  return results;
}

async function dispatchEvent(
  service: NonNullable<ReturnType<typeof supabaseServiceConfig>>,
  userId: string,
  workspaceId: string,
  eventId: string,
  onlyChannel?: Channel | null,
): Promise<Json[]> {
  const events = await dbJson(service, `notification_events?id=eq.${encodeURIComponent(eventId)}&user_id=eq.${encodeURIComponent(userId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id&limit=1`);
  if (!events?.length) throw new HttpError('NOTIFICATION_EVENT_NOT_FOUND', 404);
  const channelFilter = onlyChannel ? `&channel=eq.${encodeURIComponent(onlyChannel)}` : '&channel=neq.in_app';
  const deliveries = await dbJson(service, `notification_deliveries?event_id=eq.${encodeURIComponent(eventId)}&user_id=eq.${encodeURIComponent(userId)}${channelFilter}&status=in.(pending,failed)&select=id,event_id,user_id,channel,status,attempt_count`);
  const results: Json[] = [];
  for (const queued of deliveries || []) {
    const claimed = await claim(service, 1, queued.id);
    if (claimed[0]) results.push(await deliverClaimed(service, claimed[0]));
  }
  return results;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const service = supabaseServiceConfig();
  if (!service) return jsonResponse({ error: 'NOTIFICATION_SERVICE_NOT_CONFIGURED' }, 503, origin);
  let payload: Json;
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, origin); }
  const action = String(payload.action || 'status');
  const authorization = request.headers.get('Authorization') || '';
  const worker = await secureEqual(authorization, `Bearer ${service.serviceKey}`);

  try {
    if (action === 'process_pending') {
      if (!worker) return jsonResponse({ error: 'WORKER_FORBIDDEN' }, 403, origin);
      if (!notificationEnabled()) return jsonResponse({ error: 'NOTIFICATION_CHANNELS_DISABLED' }, 503, origin);
      const eventsCreated = await syncSubscribedAlerts(service);
      const claimed = await claim(service, Number(payload.limit || 25));
      const results = await deliverClaims(service, claimed);
      return jsonResponse({ status: 'processed', events_created: eventsCreated, claimed: claimed.length, results }, 200, origin);
    }

    const user = worker ? null : await userFromJwt(request, service);
    if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
    const workspaceId = await activeWorkspace(service, user.id, payload.workspace_id);

    if (action === 'status') {
      const configs = await channelConfigs(service, user.id, workspaceId);
      const available = availability(user.email);
      return jsonResponse({
        enabled: notificationEnabled(), workspace_id: workspaceId,
        channels: Object.fromEntries(channels.map((channel) => {
          const row = configs.find((item) => item.channel === channel);
          return [channel, {
            available: available[channel], configured: Boolean(row), enabled: Boolean(row?.enabled),
            has_secret: Boolean(row?.secret_ciphertext), target_hint: row?.target_hint || null,
            last_test_status: row?.last_test_status || null, last_test_error: row?.last_test_error || null,
            last_test_at: row?.last_test_at || null,
          }];
        })),
      }, 200, origin);
    }

    if (action === 'configure') {
      await saveConfig(service, user, workspaceId, payload);
      const configs = await channelConfigs(service, user.id, workspaceId);
      return jsonResponse({ status: 'saved', channel: payload.channel, configured: configs.find((row) => row.channel === payload.channel)?.enabled === true }, 200, origin);
    }

    if (action === 'dispatch') {
      if (!notificationEnabled()) return jsonResponse({ error: 'NOTIFICATION_CHANNELS_DISABLED' }, 503, origin);
      const eventId = uuid(payload.event_id);
      if (!eventId) throw new HttpError('NOTIFICATION_EVENT_ID_REQUIRED', 400);
      const results = await dispatchEvent(service, user.id, workspaceId, eventId);
      return jsonResponse({ status: results.some((item) => item.status === 'failed') ? 'partial' : 'completed', results }, 200, origin);
    }

    if (action === 'test') {
      if (!notificationEnabled()) return jsonResponse({ error: 'NOTIFICATION_CHANNELS_DISABLED' }, 503, origin);
      const channel = asChannel(payload.channel);
      if (!channel) throw new HttpError('INVALID_NOTIFICATION_CHANNEL', 400);
      const config = (await channelConfigs(service, user.id, workspaceId)).find((row) => row.channel === channel);
      if (!config?.enabled) throw new HttpError('NOTIFICATION_CHANNEL_DISABLED', 409);
      const events = await dbJson(service, 'notification_events', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: user.id, workspace_id: workspaceId, event_type: 'test', severity: 'info',
          title: 'JAY观海通知渠道测试', body: `这是一条${channel === 'email' ? '邮件' : channel === 'wecom' ? '企业微信' : '飞书'}测试通知。`,
          payload: { channel_test: channel },
        }),
      });
      const eventId = events?.[0]?.id;
      if (!eventId) throw new HttpError('NOTIFICATION_TEST_EVENT_FAILED', 502);
      const results = await dispatchEvent(service, user.id, workspaceId, eventId, channel);
      if (!results.length) throw new HttpError('NOTIFICATION_DELIVERY_NOT_QUEUED', 502);
      const failed = results.find((item) => item.status === 'failed');
      if (failed) return jsonResponse({ error: failed.error || 'NOTIFICATION_TEST_FAILED', event_id: eventId, results }, 502, origin);
      return jsonResponse({ status: 'sent', event_id: eventId, results }, 200, origin);
    }

    return jsonResponse({ error: 'UNKNOWN_ACTION' }, 400, origin);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: cleanError(error) }, status, origin);
  }
});
