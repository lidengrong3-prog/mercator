-- R09 follow-up: permit owner membership removal only during workspace FK cascade.
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
BEGIN
  SELECT owner_id INTO workspace_owner
  FROM public.workspaces
  WHERE id = COALESCE(NEW.workspace_id, OLD.workspace_id);

  target_user := COALESCE(NEW.user_id, OLD.user_id);
  target_role := CASE WHEN TG_OP = 'DELETE' THEN OLD.role ELSE NEW.role END;
  target_status := CASE WHEN TG_OP = 'DELETE' THEN OLD.status ELSE NEW.status END;

  IF TG_OP = 'DELETE' AND workspace_owner IS NULL THEN
    RETURN OLD;
  END IF;

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

COMMENT ON FUNCTION public.guard_workspace_member_role() IS
  'Protects active owner membership; allows deletion only after the parent workspace is removed by cascade.';

COMMIT;
