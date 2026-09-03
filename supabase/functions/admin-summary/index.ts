const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:4174', 'http://127.0.0.1:4174',
];
function origins(): string[] { return (Deno.env.get('ALLOWED_ORIGINS') || defaultOrigins.join(',')).split(',').map((v) => v.trim()).filter(Boolean); }
function cors(origin: string | null): Record<string, string> { const allowed = origin && origins().includes(origin) ? origin : origins()[0]; return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function json(body: Record<string, unknown>, status: number, origin: string | null): Response { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned' } }); }

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !origins().includes(origin)) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') || '';
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'ADMIN_SERVICE_NOT_CONFIGURED' }, 503, origin);
  if (!authorization.startsWith('Bearer ')) return json({ error: 'AUTH_REQUIRED' }, 401, origin);
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  if (!userResponse.ok) return json({ error: 'AUTH_REQUIRED' }, 401, origin);
  const user = await userResponse.json();
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const adminResponse = await fetch(`${supabaseUrl}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, { headers });
  const adminRows = adminResponse.ok ? await adminResponse.json() : [];
  if (!adminRows.length) return json({ error: 'ADMIN_FORBIDDEN' }, 403, origin);

  async function count(table: string, query = ''): Promise<number | null> {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id${query ? `&${query}` : ''}`, { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' } });
    const range = response.headers.get('content-range') || '';
    const total = range.split('/')[1];
    return response.ok && total && total !== '*' ? Number(total) : null;
  }
  async function rows(table: string, query: string): Promise<unknown[]> {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers });
    return response.ok ? await response.json() : [];
  }

  const [users, subscriptions, workspaces, openIncidents, pendingDeliveries, incidents, backups, reportRuns, aiRequests, exportJobs] = await Promise.all([
    count('profiles'), count('user_subscriptions', 'status=in.(active,trialing)'), count('workspaces'),
    count('system_incidents', 'status=neq.resolved'), count('notification_deliveries', 'status=in.(pending,failed)'),
    rows('system_incidents', 'select=id,service,severity,status,title,started_at,resolved_at&order=started_at.desc&limit=10'),
    rows('backup_runs', 'select=id,backup_type,status,location,size_bytes,started_at,completed_at,error_message&order=created_at.desc&limit=10'),
    rows('report_runs', 'select=id,user_id,report_id,client_report_id,purpose,status,market_codes,platform_keys,category_codes,data_version,model,section_count,duration_ms,failed_section,error_code,error_message,started_at,completed_at,created_at&order=created_at.desc&limit=100'),
    rows('ai_request_logs', 'select=id,user_id,report_run_id,report_id,request_id,operation,status,provider,model,input_tokens,output_tokens,total_tokens,estimated_cost_usd,duration_ms,http_status,error_code,data_version,created_at&order=created_at.desc&limit=500'),
    rows('report_exports', 'select=id,user_id,report_id,format,status,request_id,duration_ms,error_message,created_at,completed_at&order=created_at.desc&limit=100'),
  ]);
  const completedRuns = reportRuns.filter((row: any) => row.status === 'completed');
  const failedRuns = reportRuns.filter((row: any) => row.status === 'failed');
  const measuredRuns = reportRuns.filter((row: any) => Number.isFinite(Number(row.duration_ms)));
  const aiFailures = aiRequests.filter((row: any) => row.status === 'failed');
  const totalTokens = aiRequests.reduce((sum: number, row: any) => sum + Number(row.total_tokens || 0), 0);
  const totalCost = aiRequests.reduce((sum: number, row: any) => sum + Number(row.estimated_cost_usd || 0), 0);
  const metrics = {
    report_runs: reportRuns.length,
    completed_reports: completedRuns.length,
    failed_reports: failedRuns.length,
    report_failure_rate: reportRuns.length ? Number((failedRuns.length / reportRuns.length).toFixed(4)) : 0,
    average_report_duration_ms: measuredRuns.length ? Math.round(measuredRuns.reduce((sum: number, row: any) => sum + Number(row.duration_ms || 0), 0) / measuredRuns.length) : 0,
    ai_requests: aiRequests.length,
    ai_failure_rate: aiRequests.length ? Number((aiFailures.length / aiRequests.length).toFixed(4)) : 0,
    total_tokens: totalTokens,
    estimated_ai_cost_usd: Number(totalCost.toFixed(6)),
    export_jobs: exportJobs.length,
    failed_exports: exportJobs.filter((row: any) => row.status === 'failed').length,
  };
  await fetch(`${supabaseUrl}/rest/v1/admin_audit_log`, { method: 'POST', headers, body: JSON.stringify({ actor_id: user.id, action: 'admin.dashboard.view', target_type: 'system', metadata: { origin } }) });
  return json({ role: adminRows[0].role, counts: { users, subscriptions, workspaces, open_incidents: openIncidents, pending_deliveries: pendingDeliveries }, metrics, report_runs: reportRuns.slice(0, 30), ai_requests: aiRequests.slice(0, 50), export_jobs: exportJobs.slice(0, 30), incidents, backups, generated_at: new Date().toISOString() }, 200, origin);
});
