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
