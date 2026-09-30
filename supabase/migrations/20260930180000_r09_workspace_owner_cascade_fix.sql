-- R09 follow-up: owner memberships are protected against direct deletion.
-- Workspace deletion must leave workspace_members to the workspace FK cascade.
BEGIN;

CREATE OR REPLACE FUNCTION public.r09_delete_data_batch(
  p_job_id UUID, p_lease_token UUID, p_step_key TEXT, p_batch_size INTEGER DEFAULT 250)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  job public.data_deletion_jobs%ROWTYPE; step public.data_deletion_job_steps%ROWTYPE;
  target UUID; deleted_count BIGINT := 0; remaining BOOLEAN := FALSE; relation_name TEXT;
BEGIN
  SELECT * INTO job FROM public.data_deletion_jobs
  WHERE id = p_job_id AND status = 'processing' AND lease_token = p_lease_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETION_JOB_LEASE_LOST' USING ERRCODE = '40001'; END IF;
  SELECT * INTO step FROM public.data_deletion_job_steps
  WHERE job_id = p_job_id AND step_key = p_step_key AND operation = 'table' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETION_STEP_INVALID' USING ERRCODE = '22023'; END IF;
  target := CASE WHEN job.job_type = 'delete_account' THEN job.requester_id ELSE job.workspace_id END;

  IF job.job_type = 'delete_workspace' AND step.step_key = 'db_workspace_members' THEN
    RETURN jsonb_build_object(
      'deleted_count', 0,
      'remaining', FALSE,
      'skipped', TRUE,
      'reason', 'workspace_members_removed_by_workspace_cascade'
    );
  END IF;

  relation_name := 'public.' || quote_ident(step.resource_name);
  IF to_regclass(relation_name) IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass(relation_name)
      AND attname = step.filter_column AND NOT attisdropped) THEN
    RETURN jsonb_build_object('deleted_count', 0, 'remaining', FALSE, 'skipped', TRUE);
  END IF;
  EXECUTE format(
    'WITH doomed AS (SELECT ctid FROM %s WHERE %I = $1 LIMIT $2), deleted AS (DELETE FROM %s WHERE ctid IN (SELECT ctid FROM doomed) RETURNING 1) SELECT count(*) FROM deleted',
    relation_name, step.filter_column, relation_name)
  INTO deleted_count USING target, GREATEST(1, LEAST(COALESCE(p_batch_size, 250), 1000));
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', relation_name, step.filter_column)
    INTO remaining USING target;
  RETURN jsonb_build_object('deleted_count', deleted_count, 'remaining', remaining, 'skipped', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.r09_delete_data_batch(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.r09_delete_data_batch(UUID, UUID, TEXT, INTEGER) TO service_role;

COMMIT;
