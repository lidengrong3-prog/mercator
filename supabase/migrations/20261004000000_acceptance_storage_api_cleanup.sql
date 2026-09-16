BEGIN;

-- Storage protects its internal tables from direct SQL deletion. Acceptance
-- objects are removed through the Storage API by the service-side cleanup
-- command before this function removes the corresponding database rows.
CREATE OR REPLACE FUNCTION public.cleanup_production_acceptance_run(p_acceptance_run_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.production_acceptance_runs%ROWTYPE;
  removed JSONB := '{}'::jsonb;
  object_count INTEGER := 0;
  table_count INTEGER := 0;
  workspace_ids UUID[] := '{}'::uuid[];
BEGIN
  PERFORM public.assert_production_acceptance_service_role();
  IF NULLIF(trim(p_acceptance_run_id), '') IS NULL THEN
    RAISE EXCEPTION 'acceptance_run_id is required';
  END IF;
  SELECT * INTO run_row FROM public.production_acceptance_runs
    WHERE acceptance_run_id = trim(p_acceptance_run_id) FOR UPDATE;
  IF run_row.id IS NULL THEN
    RETURN jsonb_build_object('acceptance_run_id', p_acceptance_run_id, 'status', 'not_found');
  END IF;
  IF run_row.status = 'cleaned' THEN
    RETURN jsonb_build_object(
      'acceptance_run_id', trim(p_acceptance_run_id),
      'status', 'cleaned',
      'removed', COALESCE(run_row.cleanup_summary, '{}'::jsonb),
      'duplicate', TRUE
    );
  END IF;

  SELECT COALESCE(array_agg(workspace.id), '{}'::uuid[]) INTO workspace_ids
  FROM public.workspaces AS workspace
  WHERE workspace.acceptance_run_id = trim(p_acceptance_run_id)
    AND workspace.owner_id IN (run_row.api_owner_id, run_row.browser_owner_id);

  UPDATE public.production_acceptance_runs
  SET status = 'cleaning', cleanup_started_at = NOW(), updated_at = NOW(),
      error_summary = CASE WHEN run_row.status = 'running'
        THEN COALESCE(error_summary, '{}'::jsonb) || jsonb_build_object('terminal_status', 'timed_out')
        ELSE error_summary END
  WHERE id = run_row.id;

  BEGIN
    SELECT COUNT(*) INTO object_count
    FROM public.report_exports
    WHERE acceptance_run_id = trim(p_acceptance_run_id)
      AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id)
      AND file_path IS NOT NULL;

    DELETE FROM public.report_exports
    WHERE acceptance_run_id = trim(p_acceptance_run_id)
      AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object(
      'report_exports', table_count,
      'storage_paths_delegated', object_count
    );
    DELETE FROM public.generated_reports WHERE acceptance_run_id = trim(p_acceptance_run_id) AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('generated_reports', table_count);
    DELETE FROM public.report_runs WHERE acceptance_run_id = trim(p_acceptance_run_id) AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('report_runs', table_count);
    DELETE FROM public.report_materials WHERE acceptance_run_id = trim(p_acceptance_run_id) AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('report_materials', table_count);
    DELETE FROM public.saved_workspace_items WHERE acceptance_run_id = trim(p_acceptance_run_id) AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('saved_workspace_items', table_count);
    DELETE FROM public.user_watchlist WHERE acceptance_run_id = trim(p_acceptance_run_id) AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('user_watchlist', table_count);
    DELETE FROM public.monitored_shops WHERE acceptance_run_id = trim(p_acceptance_run_id) AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('monitored_shops', table_count);
    DELETE FROM public.ai_request_logs WHERE acceptance_run_id = trim(p_acceptance_run_id) AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('ai_request_logs', table_count);
    DELETE FROM public.ai_token_reservations WHERE acceptance_run_id = trim(p_acceptance_run_id) AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('ai_token_reservations', table_count);
    DELETE FROM public.user_activity WHERE acceptance_run_id = trim(p_acceptance_run_id) AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('user_activity', table_count);
    DELETE FROM public.workspace_invites WHERE acceptance_run_id = trim(p_acceptance_run_id) AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('workspace_invites', table_count);
    DELETE FROM public.workspaces WHERE id = ANY(workspace_ids) AND acceptance_run_id = trim(p_acceptance_run_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('workspaces', table_count);

    UPDATE public.production_acceptance_runs
    SET status = 'cleaned', cleanup_finished_at = NOW(), updated_at = NOW(), cleanup_summary = removed
    WHERE id = run_row.id;
    RETURN jsonb_build_object('acceptance_run_id', trim(p_acceptance_run_id), 'status', 'cleaned', 'removed', removed);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.production_acceptance_runs
    SET status = 'cleanup_failed', cleanup_finished_at = NOW(), updated_at = NOW(),
        error_summary = jsonb_build_object('code', SQLSTATE, 'message', left(SQLERRM, 500)),
        cleanup_summary = removed
    WHERE id = run_row.id;
    RETURN jsonb_build_object('acceptance_run_id', trim(p_acceptance_run_id), 'status', 'cleanup_failed', 'error_code', SQLSTATE);
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_production_acceptance_run(
  p_acceptance_run_id TEXT,
  p_status TEXT,
  p_result_summary JSONB DEFAULT NULL,
  p_error_summary JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_status TEXT := lower(trim(p_status));
  existing_status TEXT;
BEGIN
  PERFORM public.assert_production_acceptance_service_role();
  IF normalized_status NOT IN ('running', 'passed', 'failed', 'timed_out') THEN
    RAISE EXCEPTION 'invalid acceptance status';
  END IF;
  UPDATE public.production_acceptance_runs
  SET status = normalized_status, finished_at = CASE WHEN normalized_status = 'running' THEN NULL ELSE NOW() END,
      result_summary = COALESCE(p_result_summary, result_summary), error_summary = COALESCE(p_error_summary, error_summary),
      updated_at = NOW()
  WHERE acceptance_run_id = trim(p_acceptance_run_id)
    AND status <> 'cleaned'
  RETURNING status INTO existing_status;
  IF FOUND THEN
    RETURN jsonb_build_object('acceptance_run_id', trim(p_acceptance_run_id), 'status', existing_status);
  END IF;
  SELECT status INTO existing_status FROM public.production_acceptance_runs
  WHERE acceptance_run_id = trim(p_acceptance_run_id);
  RETURN jsonb_build_object(
    'acceptance_run_id', trim(p_acceptance_run_id),
    'status', COALESCE(existing_status, 'not_found'),
    'duplicate', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_production_acceptance_run(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_production_acceptance_run(TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_production_acceptance_run(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_production_acceptance_run(TEXT, TEXT, JSONB, JSONB) TO service_role;

COMMIT;
