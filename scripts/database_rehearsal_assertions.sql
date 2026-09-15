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
     WHERE n.nspname = 'public' AND p.proname = 'search_formal_publications'
  ) THEN
    RAISE EXCEPTION 'required service functions are missing';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (VALUES
        ('profiles'), ('workspaces'), ('workspace_members'),
        ('generated_reports'), ('formal_publications'),
        ('collection_tasks'), ('collection_worker_instances'),
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
