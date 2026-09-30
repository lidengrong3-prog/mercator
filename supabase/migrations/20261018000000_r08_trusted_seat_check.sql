-- R08 follow-up: invitation acceptance runs inside a trusted trigger while the
-- JWT still belongs to the invitee. Keep external authorization JWT-bound, but
-- let the trigger verify the workspace manager and seat state directly.

BEGIN;

CREATE OR REPLACE FUNCTION public.workspace_seat_available_trusted(
  p_workspace_id UUID,
  p_requested_count INTEGER DEFAULT 1,
  p_exclude_email TEXT DEFAULT NULL,
  p_manager_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_role TEXT;
  subscription public.workspace_subscriptions%ROWTYPE;
  subscription_valid BOOLEAN := FALSE;
  effective_plan TEXT := 'free';
  plan_seat_limit INTEGER := 1;
  effective_seat_limit INTEGER := 1;
  active_seats INTEGER := 0;
  pending_seats INTEGER := 0;
  target_is_member BOOLEAN := FALSE;
BEGIN
  IF p_workspace_id IS NULL OR p_manager_id IS NULL
    OR p_requested_count IS NULL OR p_requested_count < 0 THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':seat', 0));

  SELECT member.role INTO manager_role
  FROM public.workspace_members AS member
  WHERE member.workspace_id = p_workspace_id
    AND member.user_id = p_manager_id
    AND member.status = 'active'
  LIMIT 1;

  IF manager_role NOT IN ('owner', 'admin') THEN RETURN FALSE; END IF;

  SELECT workspace_subscription.* INTO subscription
  FROM public.workspace_subscriptions AS workspace_subscription
  WHERE workspace_subscription.workspace_id = p_workspace_id
  LIMIT 1;

  IF subscription.id IS NOT NULL THEN
    subscription_valid := subscription.status IN ('active', 'trialing')
      AND subscription.entitlement_revoked_at IS NULL
      AND COALESCE(subscription.refund_status, '') <> 'full'
      AND (subscription.ended_at IS NULL OR subscription.ended_at > NOW())
      AND (subscription.current_period_end IS NULL OR subscription.current_period_end > NOW());
  END IF;

  effective_plan := CASE WHEN subscription_valid THEN subscription.plan ELSE 'free' END;
  SELECT entitlement.seat_limit INTO plan_seat_limit
  FROM public.billing_plan_entitlements AS entitlement
  WHERE entitlement.plan = effective_plan AND entitlement.active = TRUE
  LIMIT 1;

  effective_seat_limit := CASE
    WHEN subscription_valid THEN GREATEST(1, COALESCE(subscription.seat_limit, plan_seat_limit, 1))
    ELSE GREATEST(1, COALESCE(plan_seat_limit, 1))
  END;

  SELECT COUNT(*)::INTEGER INTO active_seats
  FROM public.workspace_members AS member
  WHERE member.workspace_id = p_workspace_id AND member.status = 'active';

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    JOIN public.workspace_members AS member
      ON member.user_id = profile.id
     AND member.workspace_id = p_workspace_id
     AND member.status = 'active'
    WHERE p_exclude_email IS NOT NULL
      AND lower(profile.email) = lower(p_exclude_email)
  ) INTO target_is_member;

  SELECT COUNT(*)::INTEGER INTO pending_seats
  FROM public.workspace_invites AS invite
  WHERE invite.workspace_id = p_workspace_id
    AND invite.status = 'pending'
    AND invite.expires_at > NOW()
    AND (p_exclude_email IS NULL OR lower(invite.email) <> lower(p_exclude_email))
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      JOIN public.workspace_members AS member
        ON member.user_id = profile.id
       AND member.workspace_id = invite.workspace_id
       AND member.status = 'active'
      WHERE lower(profile.email) = lower(invite.email)
    );

  RETURN target_is_member
    OR active_seats + pending_seats + p_requested_count <= effective_seat_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_workspace_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_workspace_id UUID := COALESCE(NEW.workspace_id, OLD.workspace_id);
  workspace_owner_id UUID;
  has_active_member BOOLEAN := FALSE;
  email TEXT := NULL;
BEGIN
  IF TG_TABLE_NAME = 'workspace_invites' AND NEW.status = 'pending' THEN
    email := NEW.email;
    IF NOT public.workspace_seat_available_trusted(
      target_workspace_id, 1, email, NEW.invited_by
    ) THEN
      RAISE EXCEPTION 'WORKSPACE_SEAT_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'workspace_members' AND NEW.status = 'active'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT workspace.owner_id, EXISTS (
      SELECT 1
      FROM public.workspace_members AS member
      WHERE member.workspace_id = target_workspace_id
        AND member.status = 'active'
    )
    INTO workspace_owner_id, has_active_member
    FROM public.workspaces AS workspace
    WHERE workspace.id = target_workspace_id;

    IF NEW.role = 'owner'
      AND NEW.user_id = workspace_owner_id
      AND has_active_member IS FALSE THEN
      RETURN NEW;
    END IF;

    SELECT profile.email INTO email
    FROM public.profiles AS profile
    WHERE profile.id = NEW.user_id;

    IF NOT public.workspace_seat_available_trusted(
      target_workspace_id, 1, email, workspace_owner_id
    ) THEN
      RAISE EXCEPTION 'WORKSPACE_SEAT_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_seat_available_trusted(UUID, INTEGER, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_seat_available_trusted(UUID, INTEGER, TEXT, UUID)
  TO service_role;

COMMENT ON FUNCTION public.workspace_seat_available_trusted(UUID, INTEGER, TEXT, UUID)
  IS 'Trusted R08 seat check for triggers: verifies the stored manager identity without trusting invitee JWT parameters.';
COMMENT ON FUNCTION public.guard_workspace_seat_limit()
  IS 'Enforces R08 seat limits for invites and memberships with a trusted manager check, including invite acceptance by a non-member.';

COMMIT;
