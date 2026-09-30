-- R08 follow-up: preserve seat enforcement while allowing the registered
-- workspace owner to become the first active member of a new workspace.

BEGIN;

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
    IF NOT public.workspace_seat_available(target_workspace_id, 1, email, NEW.invited_by) THEN
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

    IF NOT public.workspace_seat_available(
      target_workspace_id,
      1,
      email,
      workspace_owner_id
    ) THEN
      RAISE EXCEPTION 'WORKSPACE_SEAT_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_workspace_seat_limit()
  IS 'Enforces workspace seat limits while allowing only the registered owner bootstrap membership for an empty workspace.';

COMMIT;
