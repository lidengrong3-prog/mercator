const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('notification migration protects credentials and atomically claims retryable deliveries', () => {
  const migration = read('supabase', 'migrations', '20260908000000_notification_channels.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.notification_channel_configs/);
  assert.match(migration, /secret_ciphertext TEXT/);
  assert.match(migration, /REVOKE ALL ON public\.notification_channel_configs FROM anon, authenticated/);
  assert.match(migration, /GRANT ALL ON public\.notification_channel_configs TO service_role/);
  assert.match(migration, /source_record_id TEXT/);
  assert.match(migration, /idx_notification_events_source_dedup/);
  assert.match(migration, /request\.jwt\.claims[\s\S]*service_role/);
  assert.match(migration, /notification_events_insert_own[\s\S]*source_record_id IS NULL/);
  assert.match(migration, /NEW\.payload \? 'channel_test'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.claim_notification_deliveries/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /delivery\.attempt_count < 5/);
  assert.match(migration, /DELIVERY_CLAIM_TIMED_OUT/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_notification_deliveries[\s\S]*authenticated/);
});

test('notification dispatcher validates scope, encrypts webhooks and records provider truth', () => {
  const edge = read('supabase', 'functions', 'notification-dispatch', 'index.ts');
  assert.match(edge, /AES-GCM/);
  assert.match(edge, /NOTIFICATION_CONFIG_ENCRYPTION_KEY/);
  assert.match(edge, /qyapi\.weixin\.qq\.com/);
  assert.match(edge, /open\.feishu\.cn/);
  assert.match(edge, /open\.larksuite\.com/);
  assert.match(edge, /parsed\.protocol !== 'https:'/);
  assert.match(edge, /api\.resend\.com\/emails/);
  assert.match(edge, /'Idempotency-Key': `notification-\$\{deliveryId\}`/);
  assert.match(edge, /workspace_id=eq\.\$\{encodeURIComponent\(workspaceId\)\}/);
  assert.match(edge, /workspace_members\?user_id=eq/);
  assert.match(edge, /status: 'sent'[\s\S]*provider_message_id/);
  assert.match(edge, /status: cancelled \? 'cancelled' : 'failed'/);
  assert.match(edge, /next_attempt_at: exhausted \|\| cancelled \? null/);
  assert.match(edge, /ENTERPRISE_PROVIDER_UNREACHABLE/);
  assert.match(edge, /Network errors can contain the requested URL/);
  assert.match(edge, /secureEqual\(authorization, `Bearer \$\{service\.serviceKey\}`\)/);
  assert.match(edge, /has_secret: Boolean\(row\?\.secret_ciphertext\)/);
  assert.doesNotMatch(edge, /secret_ciphertext:\s*row\?\.secret_ciphertext/);
});

test('verified alerts are fanned out only to saved scope and deduplicated before delivery', () => {
  const edge = read('supabase', 'functions', 'notification-dispatch', 'index.ts');
  assert.match(edge, /function alertMatchesPreferences/);
  assert.match(edge, /subscriptions_configured !== true/);
  assert.match(edge, /verification !== 'verified'/);
  assert.match(edge, /safeHttpsUrl/);
  assert.match(edge, /marketCodes\.includes\(alert\.marketCode\.toUpperCase\(\)\)/);
  assert.match(edge, /platformKeys\.includes\(alert\.platformKey\.toLowerCase\(\)\)/);
  assert.match(edge, /categoryCodes\.includes\(code\)/);
  assert.match(edge, /resolution=ignore-duplicates,return=representation/);
  assert.match(edge, /on_conflict=user_id,workspace_id,event_type,source_record_id/);
  assert.match(edge, /const eventsCreated = await syncSubscribedAlerts\(service\)/);

  const settings = read('assets', 'js', 'reports-decisions.js');
  assert.match(settings, /subscriptions_configured:true/);
  assert.match(settings, /alert_scope:\{/);
  assert.match(settings, /market_codes:Array\.isArray\(context\.marketCodes\)/);
  assert.match(settings, /platform_keys:Array\.isArray\(context\.platformKeys\)/);
  assert.match(settings, /category_codes:Array\.isArray\(context\.categoryCodes\)/);
});

test('production deploy and retry worker include the notification service', () => {
  const deploy = read('.github', 'workflows', 'deploy-production.yml');
  const retry = read('.github', 'workflows', 'notification-delivery.yml');
  const releaseCheck = read('scripts', 'production_release_check.py');
  const config = read('supabase', 'config.toml');
  for (const name of [
    'NOTIFICATION_CHANNELS_ENABLED', 'NOTIFICATION_CONFIG_ENCRYPTION_KEY',
    'RESEND_API_KEY', 'NOTIFICATION_FROM_EMAIL', 'NOTIFICATION_ALERT_MAX_AGE_DAYS',
  ]) assert.match(deploy, new RegExp(name));
  assert.match(deploy, /functions deploy notification-dispatch[\s\S]*--no-verify-jwt/);
  assert.match(retry, /cron: '\*\/5 \* \* \* \*'/);
  assert.match(retry, /"action":"process_pending","limit":25/);
  assert.match(retry, /Authorization: Bearer \$SUPABASE_SERVICE_KEY/);
  assert.match(retry, /python scripts\/resolve_supabase_service_key\.py/);
  assert.match(retry, /SUPABASE_URL: \$\{\{ format\('https:\/\/\{0\}\.supabase\.co', secrets\.SUPABASE_PROJECT_ID\) \}\}/);
  assert.doesNotMatch(retry, /SUPABASE_SERVICE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_KEY/);
  assert.match(releaseCheck, /notification channel status probe/);
  assert.match(releaseCheck, /notification-dispatch/);
  assert.match(config, /\[functions\.notification-dispatch\][\s\S]*verify_jwt = false/);
});

test('browser notification settings never persist webhook credentials locally', () => {
  const auth = read('assets', 'js', 'auth-data.js');
  const settings = read('assets', 'js', 'alerts-settings.js');
  const markup = read('assets', 'js', 'product-enhancements.js');
  assert.match(auth, /jayLoadNotificationChannelStatus/);
  assert.match(auth, /jayConfigureNotificationChannel/);
  assert.match(auth, /jayTestNotificationChannel/);
  assert.match(auth, /jayDispatchNotification/);
  const createNotification = auth.match(/async function jayCreateNotification[\s\S]*?\n}\n\nasync function jayMarkNotificationRead/)?.[0] || '';
  assert.doesNotMatch(createNotification, /jayDispatchNotification/);
  assert.match(settings, /webhook\.value=''/);
  assert.match(markup, /type="password" autocomplete="new-password"/);
  assert.match(markup, /企业微信/);
  assert.match(markup, /飞书/);
  assert.doesNotMatch(`${auth}\n${settings}`, /localStorage\.setItem\([^\n]*(?:webhook|secret_ciphertext)/i);
  assert.doesNotMatch(markup, /外部渠道尚未发送|邮件与企业通知尚未接入/);
});
