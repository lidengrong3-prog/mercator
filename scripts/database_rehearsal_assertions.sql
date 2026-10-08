\set ON_ERROR_STOP on

DO $$
DECLARE
  missing_objects TEXT[];
BEGIN
  SELECT array_agg(object_name ORDER BY object_name)
    INTO missing_objects
    FROM (VALUES
      ('public.profiles'),
      ('public.workspaces'),
      ('public.workspace_members'),
      ('public.generated_reports'),
      ('public.report_exports'),
      ('public.workspace_subscriptions'),
      ('public.data_source_registry'),
      ('public.source_fetch_runs'),
      ('public.raw_source_records'),
      ('public.policy_documents'),
      ('public.policy_versions'),
      ('public.platform_rules'),
      ('public.platform_rule_versions'),
      ('public.product_entities'),
      ('public.product_snapshots'),
      ('public.shop_entities'),
      ('public.shop_snapshots'),
      ('public.content_entities'),
      ('public.content_snapshots'),
      ('public.formal_publications'),
      ('public.collection_tasks'),
      ('public.collection_worker_instances'),
      ('public.collection_worker_heartbeat_samples'),
      ('public.resource_items'),
      ('public.courses'),
      ('public.notification_channel_configs'),
      ('public.stripe_live_acceptance_runs'),
      ('public.production_rollout_state')
    ) AS required(object_name)
   WHERE to_regclass(object_name) IS NULL;

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION 'required relations are missing: %', missing_objects;
  END IF;

  IF to_regclass('public.platform_rule_change_history') IS NULL
     OR to_regclass('public.history_source_coverage_overview') IS NULL
     OR to_regclass('public.product_price_trends') IS NULL THEN
    RAISE EXCEPTION 'required history views are missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RAISE EXCEPTION 'required extensions are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'heartbeat_collection_worker'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_collection_worker_health'
   ) OR NOT EXISTS (
     SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_collection_worker_runtime_evidence'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'search_formal_publications'
  ) THEN
    RAISE EXCEPTION 'required service functions are missing';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (VALUES
        ('profiles'), ('workspaces'), ('workspace_members'),
        ('generated_reports'), ('formal_publications'),
        ('collection_tasks'), ('collection_worker_instances'), ('collection_worker_heartbeat_samples'),
        ('resource_items'), ('courses')
      ) AS required(table_name)
      LEFT JOIN pg_class c
        ON c.relname = required.table_name
       AND c.relnamespace = 'public'::regnamespace
     WHERE c.oid IS NULL OR NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'required public tables do not all have RLS enabled';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (VALUES ('reports'), ('private-raw-data'), ('resources'), ('academy-media'))
        AS required(bucket_id)
      LEFT JOIN storage.buckets b ON b.id = required.bucket_id
     WHERE b.id IS NULL OR b.public
  ) THEN
    RAISE EXCEPTION 'required private Storage buckets are missing or public';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.get_collection_worker_health()',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.get_collection_worker_health()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'collection Worker function grants are incorrect';
  END IF;
END;
$$;

-- R08 authorization matrix is executed below and rolled back.
BEGIN;
SET LOCAL session_replication_role = replica;

INSERT INTO public.profiles (id, email, display_name) VALUES
  ('81000000-0000-4000-8000-000000000001', 'r08-owner@example.test', 'R08 Owner'),
  ('81000000-0000-4000-8000-000000000002', 'r08-admin@example.test', 'R08 Admin'),
  ('81000000-0000-4000-8000-000000000003', 'r08-editor@example.test', 'R08 Editor'),
  ('81000000-0000-4000-8000-000000000004', 'r08-viewer@example.test', 'R08 Viewer'),
  ('81000000-0000-4000-8000-000000000005', 'r08-outsider@example.test', 'R08 Outsider');

INSERT INTO public.workspaces (id, name, owner_id) VALUES
  ('82000000-0000-4000-8000-000000000001', 'R08 Matrix Workspace', '81000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000002', 'R08 Editor Personal Workspace', '81000000-0000-4000-8000-000000000003');

INSERT INTO public.workspace_subscriptions (
  workspace_id, plan, status, provider, current_period_end, seat_limit, created_by
) VALUES
  ('82000000-0000-4000-8000-000000000001', 'enterprise', 'active', 'manual', NOW() + INTERVAL '30 days', 4, '81000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000002', 'free', 'active', 'internal', NULL, 1, '81000000-0000-4000-8000-000000000003');

INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'admin', 'active'),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000003', 'editor', 'active'),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000004', 'viewer', 'active'),
  ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000003', 'owner', 'active');

SET LOCAL session_replication_role = origin;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);

DO $$
DECLARE decision JSONB;
BEGIN
  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'manage_billing', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000001');
  IF decision->>'role' <> 'owner' OR (decision->>'allowed')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'R08 owner boundary failed: %', decision; END IF;

  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'manage_members', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000002');
  IF decision->>'role' <> 'admin' OR (decision->>'allowed')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'R08 admin boundary failed: %', decision; END IF;

  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'write', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000003');
  IF decision->>'role' <> 'editor' OR (decision->>'allowed')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'R08 editor write boundary failed: %', decision; END IF;
  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'manage_members', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000003');
  IF (decision->>'allowed')::BOOLEAN IS TRUE OR decision->>'code' <> 'WORKSPACE_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'R08 editor management boundary failed: %', decision; END IF;

  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'read', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000004');
  IF decision->>'role' <> 'viewer' OR (decision->>'allowed')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'R08 viewer read boundary failed: %', decision; END IF;
  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'write', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000004');
  IF (decision->>'allowed')::BOOLEAN IS TRUE OR decision->>'code' <> 'WORKSPACE_READ_ONLY' THEN RAISE EXCEPTION 'R08 viewer write boundary failed: %', decision; END IF;

  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'read', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000005');
  IF (decision->>'allowed')::BOOLEAN IS TRUE OR decision->>'code' <> 'WORKSPACE_FORBIDDEN' THEN RAISE EXCEPTION 'R08 cross-account boundary failed: %', decision; END IF;

  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'read', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000003');
  IF decision->>'workspace_id' <> '82000000-0000-4000-8000-000000000001' OR decision->>'role' <> 'editor' THEN RAISE EXCEPTION 'R08 explicit workspace switch failed: %', decision; END IF;
END;
$$;

DELETE FROM public.workspace_members
WHERE workspace_id = '82000000-0000-4000-8000-000000000001'
  AND user_id = '81000000-0000-4000-8000-000000000004';

DO $$
DECLARE decision JSONB;
BEGIN
  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'read', 'rehearsal', NULL, NULL, '81000000-0000-4000-8000-000000000004');
  IF (decision->>'allowed')::BOOLEAN IS TRUE OR decision->>'code' <> 'WORKSPACE_FORBIDDEN' THEN RAISE EXCEPTION 'R08 removed member retained access: %', decision; END IF;
END;
$$;

UPDATE public.workspace_subscriptions
SET plan = 'pro', status = 'active', current_period_end = NOW() - INTERVAL '1 minute', seat_limit = 5
WHERE workspace_id = '82000000-0000-4000-8000-000000000001';

DO $$
DECLARE decision JSONB;
BEGIN
  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'course_read', 'course', 'pro', NULL, '81000000-0000-4000-8000-000000000003');
  IF (decision->>'allowed')::BOOLEAN IS TRUE OR decision->>'code' <> 'SUBSCRIPTION_EXPIRED' OR decision->'subscription'->>'effective_plan' <> 'free' THEN RAISE EXCEPTION 'R08 expired subscription boundary failed: %', decision; END IF;

  decision := public.resolve_workspace_authorization('82000000-0000-4000-8000-000000000001', 'invite', 'workspace_invite', NULL, 'new-seat@example.test', '81000000-0000-4000-8000-000000000001');
  IF (decision->>'allowed')::BOOLEAN IS TRUE OR decision->>'code' <> 'WORKSPACE_SEAT_LIMIT_REACHED' THEN RAISE EXCEPTION 'R08 exhausted seat boundary failed: %', decision; END IF;
END;
$$;

ROLLBACK;

-- R10 queue concurrency, lease fencing, circuit probing and budget idempotency.
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);

UPDATE public.collection_source_policies
SET enabled = TRUE,
    max_concurrency = 1,
    circuit_state = 'closed',
    circuit_opened_at = NULL,
    circuit_probe_task_id = NULL,
    circuit_probe_lease_token = NULL,
    circuit_half_opened_at = NULL,
    consecutive_failures = 0,
    last_failure_at = NULL,
    daily_request_limit = 100000,
    daily_cost_limit_usd = 100000
WHERE source_key = 'cpsc';

INSERT INTO public.collection_tasks(
  id, task_key, source_key, collector_key, domain, status, max_attempts
) VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'r10-rehearsal-fencing', 'cpsc', 'collect_cpsc', 'alert', 'queued', 3
);

DO $$
DECLARE
  first_claim public.collection_tasks%ROWTYPE;
  duplicate_claim public.collection_tasks%ROWTYPE;
  recovered_claim public.collection_tasks%ROWTYPE;
  stale_result JSONB;
BEGIN
  SELECT * INTO first_claim
    FROM public.claim_collection_task_v2('r10-worker-a', 'r10-boot-a', 30);
  IF first_claim.id IS NULL OR first_claim.lease_token IS NULL THEN
    RAISE EXCEPTION 'R10 first claim did not issue a fencing token';
  END IF;

  SELECT * INTO duplicate_claim
    FROM public.claim_collection_task_v2('r10-worker-b', 'r10-boot-b', 30);
  IF duplicate_claim.id IS NOT NULL THEN
    RAISE EXCEPTION 'R10 duplicate claim was not excluded: %', duplicate_claim.id;
  END IF;

  UPDATE public.collection_tasks
     SET lease_expires_at = NOW() - INTERVAL '1 second'
   WHERE id = first_claim.id;
  SELECT * INTO recovered_claim
    FROM public.claim_collection_task_v2('r10-worker-b', 'r10-boot-b', 30);
  IF recovered_claim.id <> first_claim.id
     OR recovered_claim.lease_token = first_claim.lease_token THEN
    RAISE EXCEPTION 'R10 expired lease was not recovered with a new token';
  END IF;

  stale_result := public.complete_collection_task_v2(
    first_claim.id, 'r10-worker-a', 'r10-boot-a', first_claim.lease_token,
    '{"status":"succeeded"}'::jsonb
  );
  IF COALESCE((stale_result->>'applied')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'R10 stale Worker completed a reassigned lease';
  END IF;
END;
$$;

DO $$
DECLARE
  before_requests INTEGER;
  after_requests INTEGER;
  first_reservation JSONB;
  repeated_reservation JSONB;
BEGIN
  SELECT COALESCE(request_count, 0) INTO before_requests
    FROM public.collection_usage_daily
   WHERE usage_date = (NOW() AT TIME ZONE 'UTC')::DATE AND source_key = 'cpsc';
  before_requests := COALESCE(before_requests, 0);

  first_reservation := public.reserve_collection_budget(
    'cpsc', 'r10-rehearsal-budget-idempotency', 3, 1
  );
  repeated_reservation := public.reserve_collection_budget(
    'cpsc', 'r10-rehearsal-budget-idempotency', 3, 1
  );
  SELECT COALESCE(request_count, 0) INTO after_requests
    FROM public.collection_usage_daily
   WHERE usage_date = (NOW() AT TIME ZONE 'UTC')::DATE AND source_key = 'cpsc';
  IF (first_reservation->>'allowed')::BOOLEAN IS NOT TRUE
     OR (repeated_reservation->>'idempotent')::BOOLEAN IS NOT TRUE
     OR after_requests - before_requests <> 3 THEN
    RAISE EXCEPTION 'R10 budget reservation was not idempotent: %, %, % -> %',
      first_reservation, repeated_reservation, before_requests, after_requests;
  END IF;
END;
$$;

UPDATE public.collection_tasks
SET status = 'cancelled', lease_owner = NULL, lease_boot_id = NULL,
    lease_token = NULL, lease_expires_at = NULL
WHERE task_key = 'r10-rehearsal-fencing';

UPDATE public.collection_source_policies
SET circuit_state = 'open',
    circuit_opened_at = NOW() - make_interval(secs => circuit_cooldown_seconds + 1),
    circuit_probe_task_id = NULL,
    circuit_probe_lease_token = NULL,
    circuit_half_opened_at = NULL
WHERE source_key = 'cpsc';

INSERT INTO public.collection_tasks(
  id, task_key, source_key, collector_key, domain, status, max_attempts
) VALUES
  ('a1000000-0000-4000-8000-000000000002', 'r10-rehearsal-probe-a', 'cpsc', 'collect_cpsc', 'alert', 'queued', 3),
  ('a1000000-0000-4000-8000-000000000003', 'r10-rehearsal-probe-b', 'cpsc', 'collect_cpsc', 'alert', 'queued', 3);

DO $$
DECLARE
  probe public.collection_tasks%ROWTYPE;
  second_probe public.collection_tasks%ROWTYPE;
  outcome JSONB;
  state_after TEXT;
BEGIN
  SELECT * INTO probe
    FROM public.claim_collection_task_v2('r10-worker-c', 'r10-boot-c', 30);
  SELECT * INTO second_probe
    FROM public.claim_collection_task_v2('r10-worker-d', 'r10-boot-d', 30);
  IF probe.id IS NULL OR second_probe.id IS NOT NULL THEN
    RAISE EXCEPTION 'R10 half-open circuit did not allow exactly one probe';
  END IF;
  SELECT circuit_state INTO state_after
    FROM public.collection_source_policies WHERE source_key = 'cpsc';
  IF state_after <> 'half_open' THEN
    RAISE EXCEPTION 'R10 circuit did not enter half_open: %', state_after;
  END IF;

  outcome := public.finalize_collection_task_v2(
    probe.id, 'r10-worker-c', 'r10-boot-c', probe.lease_token,
    jsonb_build_object(
      'attempt_number', probe.attempt_count,
      'request_id', 'r10-rehearsal-probe-attempt',
      'status', 'failed',
      'error_code', 'REHEARSAL_SOURCE_FAILURE',
      'error_message', 'rehearsal source failure',
      'estimated_cost_usd', 0,
      'started_at', NOW(),
      'completed_at', NOW(),
      'diagnostics', '{}'::jsonb
    ),
    'cpsc', TRUE, FALSE, 'REHEARSAL_SOURCE_FAILURE',
    '{"status":"failed"}'::jsonb, FALSE, 1, TRUE
  );
  IF (outcome->>'applied')::BOOLEAN IS NOT TRUE
     OR outcome->'source_outcome'->>'circuit_state' <> 'open' THEN
    RAISE EXCEPTION 'R10 failed probe did not reopen circuit: %', outcome;
  END IF;
  IF (
    SELECT budget_request_id IS NOT NULL
      FROM public.collection_tasks WHERE id = probe.id
  ) THEN
    RAISE EXCEPTION 'R10 confirmed provider retry did not rotate its budget key';
  END IF;
END;
$$;

DO $$
DECLARE
  current_requests INTEGER;
  blocked JSONB;
BEGIN
  SELECT request_count INTO current_requests
    FROM public.collection_usage_daily
   WHERE usage_date = (NOW() AT TIME ZONE 'UTC')::DATE AND source_key = 'cpsc';
  UPDATE public.collection_source_policies
     SET daily_request_limit = GREATEST(1, current_requests)
   WHERE source_key = 'cpsc';
  blocked := public.reserve_collection_budget(
    'cpsc', 'r10-rehearsal-budget-blocked', 1, 0
  );
  IF (blocked->>'allowed')::BOOLEAN IS TRUE
     OR blocked->>'reason' <> 'DAILY_REQUEST_LIMIT' THEN
    RAISE EXCEPTION 'R10 request budget did not stop paid collection: %', blocked;
  END IF;
  IF (
    SELECT COUNT(*) FROM public.collection_budget_alerts
     WHERE usage_date = (NOW() AT TIME ZONE 'UTC')::DATE
       AND source_key = 'cpsc' AND code = 'daily_request_limit'
  ) <> 1 THEN
    RAISE EXCEPTION 'R10 budget alert was not unique';
  END IF;
END;
$$;

ROLLBACK;
