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

  const stableWindowStart = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [users, subscriptions, workspaces, openIncidents, pendingDeliveries, incidents, backups, reportRuns, aiRequests, exportJobs, healthSnapshots, restoreDrills, subjectRequests, rateLimitEvents, aiProviders, aiProviderUsage, aiProviderAttempts, stripeAcceptanceRuns, stripeAcceptanceEvidence, notificationAcceptanceRuns, notificationAcceptanceEvidence, notificationAttempts, rolloutStates, readinessRuns, readinessEvidence, loadTests, stabilityIncidents] = await Promise.all([
    count('profiles'), count('workspace_subscriptions', 'status=in.(active,trialing)'), count('workspaces'),
    count('system_incidents', 'status=neq.resolved'), count('notification_deliveries', 'status=in.(pending,failed)'),
    rows('system_incidents', 'select=id,service,severity,incident_priority,explained,status,title,started_at,resolved_at&order=started_at.desc&limit=10'),
    rows('backup_runs', 'select=id,backup_type,status,location,size_bytes,started_at,completed_at,error_message&order=created_at.desc&limit=10'),
    rows('report_runs', 'select=id,workspace_id,user_id,report_id,client_report_id,purpose,status,save_status,publication_status,market_codes,platform_keys,category_codes,data_version,model,section_count,duration_ms,input_tokens,output_tokens,total_tokens,estimated_cost_usd,ai_request_count,failed_request_count,search_request_count,failed_section,error_code,error_message,started_at,completed_at,created_at&order=created_at.desc&limit=100'),
    rows('ai_request_logs', 'select=id,workspace_id,user_id,report_run_id,report_id,request_id,entry_point,operation,task_type,agent_key,requested_provider,provider,provider_attempts,fallback_used,retry_count,data_disclosure,status,model,input_tokens,output_tokens,total_tokens,estimated_cost_usd,duration_ms,http_status,error_code,data_version,search_enabled,created_at&order=created_at.desc&limit=500'),
    rows('report_exports', 'select=id,workspace_id,user_id,report_id,format,status,request_id,duration_ms,error_message,created_at,completed_at&order=created_at.desc&limit=100'),
    rows('service_health_snapshots', 'select=id,service,status,checked_at,release_sha,error_code,error_message,metrics&order=checked_at.desc&limit=50'),
    rows('backup_restore_drills', 'select=id,environment,status,started_at,completed_at,error_code,error_message,checks&order=created_at.desc&limit=12'),
    rows('data_subject_requests', 'select=id,requester_id,workspace_id,request_type,status,requested_at,completed_at,error_code&order=requested_at.desc&limit=50'),
    rows('security_rate_limit_events', 'select=id,scope,allowed,limit_count,request_count,retry_after_seconds,created_at&order=created_at.desc&limit=100'),
    rows('ai_provider_catalog', 'select=provider_key,display_name,api_style,default_model,status,supports_web_search,allowed_task_types,updated_at&order=provider_key.asc'),
    rows('ai_provider_usage_daily', 'select=usage_date,workspace_id,provider,task_type,request_count,failure_count,total_tokens,estimated_cost_usd&order=usage_date.desc&limit=500'),
    rows('ai_provider_attempt_logs', 'select=request_id,attempt_no,workspace_id,task_type,agent_key,provider,model,status,http_status,total_tokens,estimated_cost_usd,error_code,duration_ms,created_at&order=created_at.desc&limit=500'),
    rows('stripe_live_acceptance_runs', 'select=id,workspace_id,status,approval_reference,started_at,expires_at,completed_at,evidence_summary,notes&order=started_at.desc&limit=10'),
    rows('stripe_live_acceptance_evidence', 'select=run_id,scenario,passed,event_type,provider_event_id,provider_object_id,observed_at&order=observed_at.desc&limit=100'),
    rows('notification_live_acceptance_runs', 'select=id,workspace_id,status,approval_reference,started_at,expires_at,completed_at,evidence_summary&order=started_at.desc&limit=10'),
    rows('notification_live_acceptance_evidence', 'select=run_id,channel,scenario,passed,delivery_id,provider_message_id,observed_at&order=observed_at.desc&limit=100'),
    rows('notification_delivery_attempts', 'select=id,delivery_id,workspace_id,channel,attempt_no,status,error_code,created_at&order=created_at.desc&limit=100'),
    rows('production_rollout_state', 'select=stage,stage_started_at,registration_limit,daily_ai_token_limit,invite_only,active_acceptance_run_id,approval_reference,updated_at&singleton=eq.true&limit=1'),
    rows('production_readiness_runs', 'select=id,source_stage,target_stage,status,approval_reference,started_at,expires_at,completed_at,evidence_summary&order=started_at.desc&limit=10'),
    rows('production_readiness_evidence', 'select=run_id,test_key,passed,evidence_source,artifact_digest,metrics,observed_at&order=observed_at.desc&limit=200'),
    rows('production_load_test_runs', 'select=id,readiness_run_id,profile,virtual_users,duration_seconds,total_requests,failed_requests,error_rate,p50_ms,p95_ms,p99_ms,search_p95_ms,passed,release_sha,started_at,completed_at&order=completed_at.desc&limit=20'),
    rows('system_incidents', `select=id,incident_priority,explained,status,title,started_at,resolved_at&incident_priority=in.(P0,P1)&started_at=gte.${encodeURIComponent(stableWindowStart)}&order=started_at.desc&limit=100`),
  ]);
  const completedRuns = reportRuns.filter((row: any) => row.status === 'completed');
  const failedRuns = reportRuns.filter((row: any) => row.status === 'failed');
  const measuredRuns = reportRuns.filter((row: any) => Number.isFinite(Number(row.duration_ms)));
  const aiFailures = aiRequests.filter((row: any) => row.status === 'failed');
  const searchRequests = aiRequests.filter((row: any) => row.search_enabled === true);
  const inputTokens = aiRequests.reduce((sum: number, row: any) => sum + Number(row.input_tokens || 0), 0);
  const outputTokens = aiRequests.reduce((sum: number, row: any) => sum + Number(row.output_tokens || 0), 0);
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
    ai_search_requests: searchRequests.length,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    estimated_ai_cost_usd: Number(totalCost.toFixed(6)),
    export_jobs: exportJobs.length,
    failed_exports: exportJobs.filter((row: any) => row.status === 'failed').length,
    rate_limited_requests: rateLimitEvents.filter((row: any) => row.allowed === false).length,
    data_subject_requests: subjectRequests.length,
    latest_restore_drill: String((restoreDrills[0] as Record<string, unknown> | undefined)?.status || 'not_run'),
    ai_provider_count: aiProviders.length,
    ai_provider_usage_rows: aiProviderUsage.length,
    ai_provider_attempts: aiProviderAttempts.length,
  };
  const latestStripeAcceptance = (stripeAcceptanceRuns[0] || null) as Record<string, unknown> | null;
  const latestStripeEvidence = latestStripeAcceptance
    ? stripeAcceptanceEvidence.filter((row: any) => row.run_id === latestStripeAcceptance.id)
    : [];
  const latestNotificationAcceptance = (notificationAcceptanceRuns[0] || null) as Record<string, unknown> | null;
  const latestNotificationEvidence = latestNotificationAcceptance
    ? notificationAcceptanceEvidence.filter((row: any) => row.run_id === latestNotificationAcceptance.id)
    : [];
  const latestReadinessRun = (readinessRuns[0] || null) as Record<string, unknown> | null;
  const latestReadinessEvidence = latestReadinessRun
    ? readinessEvidence.filter((row: any) => row.run_id === latestReadinessRun.id)
    : [];
  const unexplainedP01 = stabilityIncidents.filter((row: any) => row.status !== 'resolved' || row.explained !== true);
  await fetch(`${supabaseUrl}/rest/v1/admin_audit_log`, { method: 'POST', headers, body: JSON.stringify({ actor_id: user.id, action: 'admin.dashboard.view', target_type: 'system', metadata: { origin } }) });
  return json({ role: adminRows[0].role, observability_version: '2026.10.01.1', counts: { users, subscriptions, workspaces, open_incidents: openIncidents, pending_deliveries: pendingDeliveries, data_subject_requests: subjectRequests.length }, metrics, report_runs: reportRuns.slice(0, 30), ai_requests: aiRequests.slice(0, 50), ai_providers: aiProviders, ai_provider_usage: aiProviderUsage, ai_provider_attempts: aiProviderAttempts.slice(0, 100), stripe_live_acceptance: latestStripeAcceptance ? { run: latestStripeAcceptance, evidence: latestStripeEvidence } : null, notification_live_acceptance: latestNotificationAcceptance ? { run: latestNotificationAcceptance, evidence: latestNotificationEvidence, attempts: notificationAttempts.slice(0, 100) } : null, production_rollout: { state: rolloutStates[0] || null, readiness: latestReadinessRun ? { run: latestReadinessRun, evidence: latestReadinessEvidence } : null, load_tests: loadTests, stability: { window_days: 14, window_started_at: stableWindowStart, unexplained_p0_p1: unexplainedP01 } }, export_jobs: exportJobs.slice(0, 30), incidents, backups, health_snapshots: healthSnapshots, restore_drills: restoreDrills, data_subject_requests: subjectRequests, rate_limit_events: rateLimitEvents, generated_at: new Date().toISOString() }, 200, origin);
});
