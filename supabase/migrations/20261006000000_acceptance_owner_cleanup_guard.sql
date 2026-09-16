BEGIN;

CREATE OR REPLACE FUNCTION public.guard_workspace_member_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  workspace_owner UUID;
  target_user UUID;
  target_role TEXT;
  target_status TEXT;
  service_role_request BOOLEAN := COALESCE(
    NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'role', ''
  ) = 'service_role';
BEGIN
  -- Cascading parent deletion can make the workspace row unavailable to this
  -- child trigger. The run marker on the membership remains available and is
  -- the narrow service-only bypass for temporary acceptance data.
  IF service_role_request THEN
    IF TG_OP = 'DELETE' AND OLD.acceptance_run_id IS NOT NULL THEN
      RETURN OLD;
    ELSIF TG_OP <> 'DELETE' AND NEW.acceptance_run_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT owner_id INTO workspace_owner
  FROM public.workspaces
  WHERE id = COALESCE(NEW.workspace_id, OLD.workspace_id);

  target_user := COALESCE(NEW.user_id, OLD.user_id);
  target_role := CASE WHEN TG_OP = 'DELETE' THEN OLD.role ELSE NEW.role END;
  target_status := CASE WHEN TG_OP = 'DELETE' THEN OLD.status ELSE NEW.status END;
  IF target_user = workspace_owner THEN
    IF TG_OP = 'DELETE' OR target_role <> 'owner' OR target_status <> 'active' THEN
      RAISE EXCEPTION 'workspace owner membership cannot be removed or downgraded';
    END IF;
  ELSIF target_role = 'owner' THEN
    RAISE EXCEPTION 'workspace ownership transfer is not enabled';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
