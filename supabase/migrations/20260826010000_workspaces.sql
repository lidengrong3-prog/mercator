-- JAY观海 workspace and team permission foundation.
-- Idempotent: safe to apply after 20260825000000_unify_user_data.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL CHECK (position('@' IN email) > 1),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_status
  ON public.workspace_members (user_id, status, joined_at);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_role
  ON public.workspace_members (workspace_id, role, status);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_status
  ON public.workspace_invites (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_status
  ON public.workspace_invites (lower(email), status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invites_one_pending
  ON public.workspace_invites (workspace_id, lower(email))
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wm.role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = p_user_id
    AND wm.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.workspace_role(p_workspace_id, p_user_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(p_workspace_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.workspace_role(p_workspace_id, p_user_id) IN ('owner', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.shares_workspace(p_user_id UUID, p_peer_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members mine
    JOIN public.workspace_members peer ON peer.workspace_id = mine.workspace_id
    WHERE mine.user_id = p_peer_id
      AND mine.status = 'active'
      AND peer.user_id = p_user_id
      AND peer.status = 'active'
  );
$$;

-- Create the first workspace for every existing profile. New profiles are handled by the trigger below.
DO $$
DECLARE
  profile_row RECORD;
  v_workspace_id UUID;
BEGIN
  FOR profile_row IN SELECT id, COALESCE(NULLIF(trim(company), ''), '我的工作区') AS workspace_name FROM public.profiles LOOP
    SELECT wm.workspace_id INTO v_workspace_id
    FROM public.workspace_members wm
    WHERE wm.user_id = profile_row.id AND wm.status = 'active'
    ORDER BY wm.joined_at
    LIMIT 1;

    IF v_workspace_id IS NULL THEN
      INSERT INTO public.workspaces (name, owner_id)
      VALUES (profile_row.workspace_name, profile_row.id)
      RETURNING id INTO v_workspace_id;

      INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
      VALUES (v_workspace_id, profile_row.id, 'owner', 'active')
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner', status = 'active';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_profile_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT wm.workspace_id INTO v_workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = NEW.id AND wm.status = 'active'
  ORDER BY wm.joined_at
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (COALESCE(NULLIF(trim(NEW.company), ''), '我的工作区'), NEW.id)
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
    VALUES (v_workspace_id, NEW.id, 'owner', 'active')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_workspace ON public.profiles;
CREATE TRIGGER on_profile_created_workspace
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_workspace();

CREATE OR REPLACE FUNCTION public.guard_workspace_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'workspace owner transfer is not enabled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_workspace_owner_change ON public.workspaces;
CREATE TRIGGER guard_workspace_owner_change
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_owner_change();

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

DROP TRIGGER IF EXISTS guard_workspace_member_role ON public.workspace_members;
CREATE TRIGGER guard_workspace_member_role
  BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_member_role();

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.workspace_invites%ROWTYPE;
  current_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  current_email := lower(COALESCE(auth.jwt() ->> 'email', ''));

  SELECT * INTO invite_row
  FROM public.workspace_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF invite_row.id IS NULL OR invite_row.status <> 'pending' THEN
    RAISE EXCEPTION 'invite is no longer available';
  END IF;
  IF invite_row.expires_at <= NOW() THEN
    UPDATE public.workspace_invites SET status = 'expired' WHERE id = p_invite_id;
    RAISE EXCEPTION 'invite has expired';
  END IF;
  IF current_email = '' OR lower(invite_row.email) <> current_email THEN
    RAISE EXCEPTION 'invite email does not match the signed-in user';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status, invited_by)
  VALUES (invite_row.workspace_id, auth.uid(), invite_row.role, 'active', invite_row.invited_by)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active', invited_by = EXCLUDED.invited_by, updated_at = NOW();

  UPDATE public.workspace_invites
  SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
  WHERE id = p_invite_id;

  RETURN invite_row.workspace_id;
END;
$$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspaces_select_member ON public.workspaces;
CREATE POLICY workspaces_select_member ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS workspaces_insert_owner ON public.workspaces;
CREATE POLICY workspaces_insert_owner ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workspaces_update_manager ON public.workspaces;
CREATE POLICY workspaces_update_manager ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(id))
  WITH CHECK (public.can_manage_workspace(id));

DROP POLICY IF EXISTS workspaces_delete_owner ON public.workspaces;
CREATE POLICY workspaces_delete_owner ON public.workspaces
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS workspace_members_select_member ON public.workspace_members;
CREATE POLICY workspace_members_select_member ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS workspace_members_insert_manager ON public.workspace_members;
CREATE POLICY workspace_members_insert_manager ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_workspace(workspace_id));

DROP POLICY IF EXISTS workspace_members_update_manager ON public.workspace_members;
CREATE POLICY workspace_members_update_manager ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(workspace_id))
  WITH CHECK (public.can_manage_workspace(workspace_id));

DROP POLICY IF EXISTS workspace_members_delete_manager ON public.workspace_members;
CREATE POLICY workspace_members_delete_manager ON public.workspace_members
  FOR DELETE TO authenticated
  USING (public.can_manage_workspace(workspace_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS workspace_invites_select_member ON public.workspace_invites;
CREATE POLICY workspace_invites_select_member ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(workspace_id)
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS workspace_invites_insert_manager ON public.workspace_invites;
CREATE POLICY workspace_invites_insert_manager ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_workspace(workspace_id) AND invited_by = auth.uid());

DROP POLICY IF EXISTS workspace_invites_update_manager ON public.workspace_invites;
CREATE POLICY workspace_invites_update_manager ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(workspace_id))
  WITH CHECK (public.can_manage_workspace(workspace_id));

DROP POLICY IF EXISTS workspace_invites_delete_manager ON public.workspace_invites;
CREATE POLICY workspace_invites_delete_manager ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (public.can_manage_workspace(workspace_id));

REVOKE ALL ON public.workspaces, public.workspace_members, public.workspace_invites FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites TO authenticated;

DROP POLICY IF EXISTS profiles_select_workspace_peer ON public.profiles;
CREATE POLICY profiles_select_workspace_peer ON public.profiles
  FOR SELECT TO authenticated
  USING (public.shares_workspace(id));

REVOKE ALL ON FUNCTION public.workspace_role(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_workspace(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_workspace(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_workspace_invite(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_workspace(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(UUID) TO authenticated;

DROP TRIGGER IF EXISTS workspaces_updated_at ON public.workspaces;
CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS workspace_members_updated_at ON public.workspace_members;
CREATE TRIGGER workspace_members_updated_at
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS workspace_invites_updated_at ON public.workspace_invites;
CREATE TRIGGER workspace_invites_updated_at
  BEFORE UPDATE ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;
