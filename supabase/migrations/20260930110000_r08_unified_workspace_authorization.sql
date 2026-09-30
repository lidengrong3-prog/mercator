-- R08: one server-side authorization decision for workspace roles, billing,
-- seats and workspace-scoped resource access.

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_workspace_authorization(
  p_workspace_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT 'read',
  p_resource_type TEXT DEFAULT 'workspace',
  p_required_plan TEXT DEFAULT NULL,
  p_target_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_role TEXT := COALESCE(auth.role(), '');
  effective_user_id UUID;
  effective_workspace_id UUID := p_workspace_id;
  normalized_action TEXT := lower(COALESCE(NULLIF(trim(p_action), ''), 'read'));
  normalized_resource_type TEXT := lower(COALESCE(NULLIF(trim(p_resource_type), ''), 'workspace'));
  normalized_required_plan TEXT := lower(NULLIF(trim(p_required_plan), ''));
  membership public.workspace_members%ROWTYPE;
  subscription public.workspace_subscriptions%ROWTYPE;
  entitlement public.billing_plan_entitlements%ROWTYPE;
  free_entitlement public.billing_plan_entitlements%ROWTYPE;
  effective_plan TEXT := 'free';
  subscription_valid BOOLEAN := FALSE;
  subscription_found BOOLEAN := FALSE;
  access_state TEXT := 'missing';
  effective_seat_limit INTEGER := 1;
  active_seats INTEGER := 0;
  pending_seats INTEGER := 0;
  target_is_member BOOLEAN := FALSE;
  seat_available BOOLEAN := FALSE;
  required_plan_satisfied BOOLEAN := TRUE;
  can_read BOOLEAN := FALSE;
  can_write BOOLEAN := FALSE;
  can_manage_members BOOLEAN := FALSE;
  can_manage_billing BOOLEAN := FALSE;
  allowed BOOLEAN := FALSE;
  decision_code TEXT := 'WORKSPACE_FORBIDDEN';
  entitlement_json JSONB;
BEGIN
  -- Authenticated callers can only authorize their JWT identity. The explicit
  -- user parameter exists for trusted Edge Functions using the service role.
  effective_user_id := CASE
    WHEN request_role = 'service_role' THEN p_user_id
    ELSE auth.uid()
  END;

  IF effective_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'code', 'AUTH_REQUIRED',
      'workspace_id', effective_workspace_id,
      'user_id', NULL,
      'action', normalized_action,
      'resource_type', normalized_resource_type
    );
  END IF;

  -- A missing workspace is resolved server-side for legacy callers. Explicit
  -- workspace IDs are always treated only as targets, never as permission.
  IF effective_workspace_id IS NULL THEN
    SELECT member.workspace_id
    INTO effective_workspace_id
    FROM public.workspace_members AS member
    WHERE member.user_id = effective_user_id
      AND member.status = 'active'
    ORDER BY (member.role = 'owner') DESC, member.joined_at ASC
    LIMIT 1;
  END IF;

  IF effective_workspace_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'code', 'WORKSPACE_REQUIRED',
      'workspace_id', NULL,
      'user_id', effective_user_id,
      'action', normalized_action,
      'resource_type', normalized_resource_type
    );
  END IF;

  SELECT member.*
  INTO membership
  FROM public.workspace_members AS member
  WHERE member.workspace_id = effective_workspace_id
    AND member.user_id = effective_user_id
    AND member.status = 'active'
  LIMIT 1;

  IF membership.id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'code', 'WORKSPACE_FORBIDDEN',
      'workspace_id', effective_workspace_id,
      'user_id', effective_user_id,
      'membership_active', FALSE,
      'role', NULL,
      'action', normalized_action,
      'resource_type', normalized_resource_type
    );
  END IF;

  can_read := TRUE;
  can_write := membership.role IN ('owner', 'admin', 'editor');
  can_manage_members := membership.role IN ('owner', 'admin');
  can_manage_billing := membership.role IN ('owner', 'admin');

  SELECT plan.* INTO free_entitlement
  FROM public.billing_plan_entitlements AS plan
  WHERE plan.plan = 'free' AND plan.active = TRUE
  LIMIT 1;

  SELECT workspace_subscription.*
  INTO subscription
  FROM public.workspace_subscriptions AS workspace_subscription
  WHERE workspace_subscription.workspace_id = effective_workspace_id
  LIMIT 1;

  subscription_found := subscription.id IS NOT NULL;
  IF subscription_found THEN
    subscription_valid := subscription.status IN ('active', 'trialing')
      AND subscription.entitlement_revoked_at IS NULL
      AND COALESCE(subscription.refund_status, '') <> 'full'
      AND (subscription.ended_at IS NULL OR subscription.ended_at > NOW())
      AND (subscription.current_period_end IS NULL OR subscription.current_period_end > NOW());

    access_state := CASE
      WHEN subscription.entitlement_revoked_at IS NOT NULL THEN 'revoked'
      WHEN subscription.refund_status = 'full' THEN 'refunded'
      WHEN subscription.ended_at IS NOT NULL AND subscription.ended_at <= NOW() THEN 'ended'
      WHEN subscription.current_period_end IS NOT NULL AND subscription.current_period_end <= NOW() THEN 'expired'
      ELSE subscription.status
    END;
  END IF;

  effective_plan := CASE WHEN subscription_valid THEN subscription.plan ELSE 'free' END;
  SELECT plan.* INTO entitlement
  FROM public.billing_plan_entitlements AS plan
  WHERE plan.plan = effective_plan AND plan.active = TRUE
  LIMIT 1;

  IF entitlement.plan IS NULL THEN
    entitlement := free_entitlement;
    effective_plan := COALESCE(free_entitlement.plan, 'free');
  END IF;

  effective_seat_limit := CASE
    WHEN subscription_valid THEN GREATEST(1, COALESCE(subscription.seat_limit, entitlement.seat_limit, 1))
    ELSE GREATEST(1, COALESCE(entitlement.seat_limit, free_entitlement.seat_limit, 1))
  END;

  SELECT COUNT(*)::INTEGER INTO active_seats
  FROM public.workspace_members AS member
  WHERE member.workspace_id = effective_workspace_id
    AND member.status = 'active';

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    JOIN public.workspace_members AS member
      ON member.user_id = profile.id
     AND member.workspace_id = effective_workspace_id
     AND member.status = 'active'
    WHERE p_target_email IS NOT NULL
      AND lower(profile.email) = lower(p_target_email)
  ) INTO target_is_member;

  SELECT COUNT(*)::INTEGER INTO pending_seats
  FROM public.workspace_invites AS invite
  WHERE invite.workspace_id = effective_workspace_id
    AND invite.status = 'pending'
    AND invite.expires_at > NOW()
    AND (p_target_email IS NULL OR lower(invite.email) <> lower(p_target_email))
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      JOIN public.workspace_members AS member
        ON member.user_id = profile.id
       AND member.workspace_id = invite.workspace_id
       AND member.status = 'active'
      WHERE lower(profile.email) = lower(invite.email)
    );

  seat_available := target_is_member
    OR active_seats + pending_seats + 1 <= effective_seat_limit;

  IF normalized_required_plan IS NOT NULL THEN
    required_plan_satisfied := CASE effective_plan
      WHEN 'enterprise' THEN 3
      WHEN 'pro' THEN 2
      ELSE 1
    END >= CASE normalized_required_plan
      WHEN 'enterprise' THEN 3
      WHEN 'pro' THEN 2
      ELSE 1
    END;
  END IF;

  allowed := CASE normalized_action
    WHEN 'read' THEN can_read AND required_plan_satisfied
    WHEN 'resource_read' THEN can_read AND required_plan_satisfied
    WHEN 'course_read' THEN can_read AND required_plan_satisfied
    WHEN 'write' THEN can_write AND required_plan_satisfied
    WHEN 'report_write' THEN can_write AND required_plan_satisfied
    WHEN 'export' THEN can_write AND required_plan_satisfied
    WHEN 'manage_members' THEN can_manage_members
    WHEN 'invite' THEN can_manage_members AND seat_available
    WHEN 'manage_billing' THEN can_manage_billing
    ELSE FALSE
  END;

  decision_code := CASE
    WHEN allowed THEN 'OK'
    WHEN normalized_action IN ('invite', 'manage_members') AND NOT can_manage_members THEN 'WORKSPACE_ADMIN_REQUIRED'
    WHEN normalized_action = 'manage_billing' AND NOT can_manage_billing THEN 'WORKSPACE_BILLING_ADMIN_REQUIRED'
    WHEN normalized_action = 'invite' AND NOT seat_available THEN 'WORKSPACE_SEAT_LIMIT_REACHED'
    WHEN normalized_action IN ('write', 'report_write', 'export') AND NOT can_write THEN 'WORKSPACE_READ_ONLY'
    WHEN NOT required_plan_satisfied AND NOT subscription_valid AND normalized_required_plan <> 'free' THEN 'SUBSCRIPTION_EXPIRED'
    WHEN NOT required_plan_satisfied THEN 'PLAN_REQUIRED'
    ELSE 'WORKSPACE_FORBIDDEN'
  END;

  entitlement_json := jsonb_build_object(
    'workspace_id', effective_workspace_id,
    'plan', effective_plan,
    'currency', entitlement.currency,
    'monthly_price_minor', entitlement.monthly_price_minor,
    'seat_limit', effective_seat_limit,
    'monthly_ai_token_limit', CASE WHEN subscription_valid THEN COALESCE(subscription.monthly_ai_token_limit_override, entitlement.monthly_ai_token_limit) ELSE entitlement.monthly_ai_token_limit END,
    'ai_requests_per_minute', CASE WHEN subscription_valid THEN COALESCE(subscription.ai_requests_per_minute_override, entitlement.ai_requests_per_minute) ELSE entitlement.ai_requests_per_minute END,
    'monthly_report_limit', CASE WHEN subscription_valid THEN COALESCE(subscription.monthly_report_limit_override, entitlement.monthly_report_limit) ELSE entitlement.monthly_report_limit END,
    'monthly_export_limit', CASE WHEN subscription_valid THEN COALESCE(subscription.monthly_export_limit_override, entitlement.monthly_export_limit) ELSE entitlement.monthly_export_limit END,
    'features', COALESCE(entitlement.features, '{}'::jsonb),
    'provider', COALESCE(subscription.provider, 'internal')
  );

  RETURN jsonb_build_object(
    'allowed', allowed,
    'code', decision_code,
    'workspace_id', effective_workspace_id,
    'user_id', effective_user_id,
    'membership_active', TRUE,
    'role', membership.role,
    'action', normalized_action,
    'resource_type', normalized_resource_type,
    'can_read', can_read,
    'can_write', can_write,
    'can_manage_members', can_manage_members,
    'can_manage_billing', can_manage_billing,
    'subscription', jsonb_build_object(
      'found', subscription_found,
      'valid', subscription_valid,
      'plan', COALESCE(subscription.plan, 'free'),
      'effective_plan', effective_plan,
      'status', COALESCE(subscription.status, 'missing'),
      'access_state', access_state,
      'provider', COALESCE(subscription.provider, 'internal'),
      'current_period_end', subscription.current_period_end,
      'entitlement_revoked_at', subscription.entitlement_revoked_at
    ),
    'required_plan', normalized_required_plan,
    'required_plan_satisfied', required_plan_satisfied,
    'seats', jsonb_build_object(
      'limit', effective_seat_limit,
      'active', active_seats,
      'pending', pending_seats,
      'in_use', active_seats + pending_seats,
      'available', seat_available
    ),
    'entitlement', entitlement_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_workspace_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_workspace_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.workspace_authorization_allows(
  p_workspace_id UUID,
  p_action TEXT DEFAULT 'read',
  p_required_plan TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.resolve_workspace_authorization(
    p_workspace_id,
    p_action,
    'workspace',
    p_required_plan,
    NULL,
    p_user_id
  )->>'allowed')::BOOLEAN, FALSE);
$$;

REVOKE ALL ON FUNCTION public.workspace_authorization_allows(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_authorization_allows(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_edit_workspace(
  p_workspace_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.workspace_authorization_allows(p_workspace_id, 'write', NULL, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(
  p_workspace_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.workspace_authorization_allows(p_workspace_id, 'manage_members', NULL, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.workspace_effective_entitlement(
  p_workspace_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE authorization JSONB;
BEGIN
  authorization := public.resolve_workspace_authorization(
    p_workspace_id, 'read', 'billing', NULL, NULL, p_user_id
  );
  IF COALESCE((authorization->>'membership_active')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'WORKSPACE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF authorization->'entitlement' IS NULL THEN
    RAISE EXCEPTION 'BILLING_ENTITLEMENTS_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN authorization->'entitlement';
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_seat_available(
  p_workspace_id UUID,
  p_requested_count INTEGER DEFAULT 1,
  p_exclude_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  authorization JSONB;
  seats JSONB;
BEGIN
  IF p_requested_count IS NULL OR p_requested_count < 0 THEN RETURN FALSE; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':seat', 0));
  authorization := public.resolve_workspace_authorization(
    p_workspace_id, 'manage_members', 'workspace_member', NULL, p_exclude_email, p_user_id
  );
  IF COALESCE((authorization->>'allowed')::BOOLEAN, FALSE) IS NOT TRUE THEN RETURN FALSE; END IF;
  seats := authorization->'seats';
  RETURN COALESCE((seats->>'in_use')::INTEGER, 0) + p_requested_count
    <= COALESCE((seats->>'limit')::INTEGER, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_workspace_seat_available(
  p_workspace_id UUID,
  p_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE authorization JSONB;
BEGIN
  authorization := public.resolve_workspace_authorization(
    p_workspace_id, 'invite', 'workspace_invite', NULL, p_email, p_user_id
  );
  IF authorization->>'code' = 'WORKSPACE_SEAT_LIMIT_REACHED' THEN
    RAISE EXCEPTION 'WORKSPACE_SEAT_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE((authorization->>'allowed')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(authorization->>'code', 'WORKSPACE_FORBIDDEN') USING ERRCODE = '42501';
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_course(
  p_course_id UUID,
  p_user_id UUID DEFAULT auth.uid(),
  p_workspace_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses AS course
    WHERE course.id = p_course_id
      AND course.status = 'published'
      AND (
        course.access_level = 'public'
        OR (
          course.access_level = 'workspace'
          AND p_workspace_id IS NOT NULL
          AND course.workspace_id = p_workspace_id
          AND public.workspace_authorization_allows(p_workspace_id, 'course_read', NULL, p_user_id)
        )
        OR (
          course.access_level = 'plan'
          AND p_workspace_id IS NOT NULL
          AND public.workspace_authorization_allows(p_workspace_id, 'course_read', course.required_plan, p_user_id)
        )
        OR (
          course.access_level IN ('purchase', 'manual')
          AND EXISTS (
            SELECT 1
            FROM public.course_enrollments AS enrollment
            WHERE enrollment.course_id = course.id
              AND enrollment.user_id = CASE WHEN auth.role() = 'service_role' THEN p_user_id ELSE auth.uid() END
              AND enrollment.status = 'active'
              AND (enrollment.expires_at IS NULL OR enrollment.expires_at > NOW())
              AND (enrollment.workspace_id IS NULL OR enrollment.workspace_id = p_workspace_id)
          )
        )
      )
  );
$$;

-- Reports and exports now share the same role decision.
DROP POLICY IF EXISTS generated_reports_select_workspace ON public.generated_reports;
CREATE POLICY generated_reports_select_workspace ON public.generated_reports
  FOR SELECT TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'read'));
DROP POLICY IF EXISTS generated_reports_insert_workspace_draft ON public.generated_reports;
CREATE POLICY generated_reports_insert_workspace_draft ON public.generated_reports
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND public.workspace_authorization_allows(workspace_id, 'report_write')
    AND publication_status = 'draft' AND save_status <> 'saved'
    AND server_validation_version IS NULL AND server_validated_at IS NULL AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  );
DROP POLICY IF EXISTS generated_reports_update_workspace_draft ON public.generated_reports;
CREATE POLICY generated_reports_update_workspace_draft ON public.generated_reports
  FOR UPDATE TO authenticated
  USING (
    public.workspace_authorization_allows(workspace_id, 'report_write')
    AND publication_status = 'draft' AND save_status <> 'saved'
    AND server_validation_version IS NULL AND server_validated_at IS NULL AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  )
  WITH CHECK (
    public.workspace_authorization_allows(workspace_id, 'report_write')
    AND publication_status = 'draft' AND save_status <> 'saved'
    AND server_validation_version IS NULL AND server_validated_at IS NULL AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  );
DROP POLICY IF EXISTS generated_reports_delete_workspace ON public.generated_reports;
CREATE POLICY generated_reports_delete_workspace ON public.generated_reports
  FOR DELETE TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'report_write'));

DROP POLICY IF EXISTS report_materials_select_workspace ON public.report_materials;
CREATE POLICY report_materials_select_workspace ON public.report_materials
  FOR SELECT TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'read'));
DROP POLICY IF EXISTS report_materials_insert_workspace ON public.report_materials;
CREATE POLICY report_materials_insert_workspace ON public.report_materials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.workspace_authorization_allows(workspace_id, 'write'));
DROP POLICY IF EXISTS report_materials_update_workspace ON public.report_materials;
CREATE POLICY report_materials_update_workspace ON public.report_materials
  FOR UPDATE TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'write'))
  WITH CHECK (public.workspace_authorization_allows(workspace_id, 'write'));
DROP POLICY IF EXISTS report_materials_delete_workspace ON public.report_materials;
CREATE POLICY report_materials_delete_workspace ON public.report_materials
  FOR DELETE TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'write'));

DROP POLICY IF EXISTS report_runs_select_workspace ON public.report_runs;
CREATE POLICY report_runs_select_workspace ON public.report_runs
  FOR SELECT TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'read'));
DROP POLICY IF EXISTS report_runs_insert_workspace ON public.report_runs;
CREATE POLICY report_runs_insert_workspace ON public.report_runs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.workspace_authorization_allows(workspace_id, 'report_write'));
DROP POLICY IF EXISTS report_runs_update_workspace ON public.report_runs;
CREATE POLICY report_runs_update_workspace ON public.report_runs
  FOR UPDATE TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'report_write'))
  WITH CHECK (public.workspace_authorization_allows(workspace_id, 'report_write'));

DROP POLICY IF EXISTS report_exports_select_workspace ON public.report_exports;
CREATE POLICY report_exports_select_workspace ON public.report_exports
  FOR SELECT TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'read'));
DROP POLICY IF EXISTS report_exports_insert_workspace ON public.report_exports;
CREATE POLICY report_exports_insert_workspace ON public.report_exports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.workspace_authorization_allows(workspace_id, 'export'));

-- Invitations use the same manager decision. Invite acceptance remains through
-- the dedicated SECURITY DEFINER RPC.
DROP POLICY IF EXISTS workspace_invites_select_member ON public.workspace_invites;
CREATE POLICY workspace_invites_select_member ON public.workspace_invites
  FOR SELECT TO authenticated USING (
    public.workspace_authorization_allows(workspace_id, 'read')
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
DROP POLICY IF EXISTS workspace_invites_insert_manager ON public.workspace_invites;
CREATE POLICY workspace_invites_insert_manager ON public.workspace_invites
  FOR INSERT TO authenticated WITH CHECK (
    invited_by = auth.uid() AND public.workspace_authorization_allows(workspace_id, 'manage_members')
  );
DROP POLICY IF EXISTS workspace_invites_update_manager ON public.workspace_invites;
CREATE POLICY workspace_invites_update_manager ON public.workspace_invites
  FOR UPDATE TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'manage_members'))
  WITH CHECK (public.workspace_authorization_allows(workspace_id, 'manage_members'));
DROP POLICY IF EXISTS workspace_invites_delete_manager ON public.workspace_invites;
CREATE POLICY workspace_invites_delete_manager ON public.workspace_invites
  FOR DELETE TO authenticated USING (public.workspace_authorization_allows(workspace_id, 'manage_members'));

-- Workspace-scoped catalog rows use the same read decision. Public and
-- platform-admin access retain their existing explicit paths.
DROP POLICY IF EXISTS resource_items_select_accessible ON public.resource_items;
CREATE POLICY resource_items_select_accessible ON public.resource_items
  FOR SELECT TO authenticated USING (
    public.is_platform_admin()
    OR (status = 'published' AND access_level = 'public')
    OR (status = 'published' AND access_level = 'workspace' AND public.workspace_authorization_allows(workspace_id, 'resource_read'))
  );
DROP POLICY IF EXISTS resource_versions_select_accessible ON public.resource_versions;
CREATE POLICY resource_versions_select_accessible ON public.resource_versions
  FOR SELECT TO authenticated USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.resource_items AS item
      WHERE item.id = resource_item_id
        AND item.status = 'published'
        AND (
          item.access_level = 'public'
          OR (item.access_level = 'workspace' AND public.workspace_authorization_allows(item.workspace_id, 'resource_read'))
        )
    )
  );
DROP POLICY IF EXISTS resource_files_select_accessible ON public.resource_files;
CREATE POLICY resource_files_select_accessible ON public.resource_files
  FOR SELECT TO authenticated USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.resource_items AS item
      WHERE item.id = resource_item_id
        AND item.status = 'published'
        AND (
          item.access_level = 'public'
          OR (item.access_level = 'workspace' AND public.workspace_authorization_allows(item.workspace_id, 'resource_read'))
        )
    )
  );

REVOKE ALL ON FUNCTION public.can_edit_workspace(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_workspace(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_effective_entitlement(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workspace_seat_available(UUID, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_workspace_seat_available(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_course(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_effective_entitlement(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.workspace_seat_available(UUID, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_workspace_seat_available(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_course(UUID, UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.resolve_workspace_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  IS 'R08 authoritative workspace role, subscription, seat and resource authorization decision. Authenticated callers cannot override JWT identity.';

COMMIT;
