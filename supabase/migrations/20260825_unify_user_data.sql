-- Canonical authenticated-user data layer for JAY Guanhai.
-- This migration is idempotent and keeps the legacy tables for compatibility.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT,
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL,
  item_id TEXT,
  item_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id TEXT,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  default_view TEXT DEFAULT 'dashboard',
  favorite_countries TEXT[] DEFAULT '{}',
  favorite_platforms TEXT[] DEFAULT '{}',
  notification_prefs JSONB DEFAULT '{"email": true, "frequency": "daily", "subscriptions": []}'::jsonb,
  ui_prefs JSONB DEFAULT '{"theme": "default", "language": "zh"}'::jsonb,
  workspace_prefs JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.report_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id TEXT NOT NULL,
  material_type TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT,
  summary TEXT,
  selected BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, client_id)
);

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  page_key TEXT NOT NULL,
  vote SMALLINT NOT NULL,
  comment TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, page_key)
);

CREATE TABLE IF NOT EXISTS public.saved_workspace_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL,
  client_id TEXT NOT NULL DEFAULT 'default',
  name TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, item_type, client_id)
);

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company TEXT,
  contact_name TEXT,
  contact TEXT NOT NULL,
  need TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.generated_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.generated_reports ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS workspace_prefs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title TEXT;

ALTER TABLE public.user_watchlist DROP CONSTRAINT IF EXISTS user_watchlist_item_type_check;
ALTER TABLE public.user_watchlist
  ADD CONSTRAINT user_watchlist_item_type_check
  CHECK (item_type IN ('country', 'platform', 'category', 'product', 'policy'));

ALTER TABLE public.user_activity DROP CONSTRAINT IF EXISTS user_activity_activity_type_check;
ALTER TABLE public.user_activity
  ADD CONSTRAINT user_activity_activity_type_check
  CHECK (activity_type IN ('view_country', 'view_platform', 'search', 'view_policy', 'view_rule', 'export_report'));

ALTER TABLE public.generated_reports DROP CONSTRAINT IF EXISTS generated_reports_report_type_check;
ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_report_type_check
  CHECK (report_type IN ('country', 'product', 'market', 'comparison', 'custom'));
ALTER TABLE public.generated_reports DROP CONSTRAINT IF EXISTS generated_reports_status_check;
ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_status_check
  CHECK (status IN ('pending', 'completed', 'failed'));

ALTER TABLE public.report_materials DROP CONSTRAINT IF EXISTS report_materials_material_type_check;
ALTER TABLE public.report_materials
  ADD CONSTRAINT report_materials_material_type_check
  CHECK (material_type IN ('country', 'platform', 'product', 'policy', 'rule', 'alert', 'macro', 'shop', 'custom'));

ALTER TABLE public.user_feedback DROP CONSTRAINT IF EXISTS user_feedback_vote_check;
ALTER TABLE public.user_feedback
  ADD CONSTRAINT user_feedback_vote_check CHECK (vote IN (-1, 1));

ALTER TABLE public.saved_workspace_items DROP CONSTRAINT IF EXISTS saved_workspace_items_item_type_check;
ALTER TABLE public.saved_workspace_items
  ADD CONSTRAINT saved_workspace_items_item_type_check
  CHECK (item_type IN (
    'comparison_schemes', 'product_filter_templates', 'shop_filter_templates',
    'content_filter_templates', 'report_templates', 'shop_groups',
    'content_collections', 'report_draft'
  ));

ALTER TABLE public.sales_leads DROP CONSTRAINT IF EXISTS sales_leads_status_check;
ALTER TABLE public.sales_leads
  ADD CONSTRAINT sales_leads_status_check
  CHECK (status IN ('submitted', 'in_progress', 'closed'));

CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_created
  ON public.user_watchlist (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_created
  ON public.user_activity (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_user_created
  ON public.generated_reports (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_reports_user_client
  ON public.generated_reports (user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_report_materials_user_created
  ON public.report_materials (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_updated
  ON public.user_feedback (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_workspace_items_user_type
  ON public.saved_workspace_items (user_id, item_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_leads_user_created
  ON public.sales_leads (user_id, created_at DESC);

-- Copy legacy data without removing the old compatibility tables.
DO $$
BEGIN
  IF to_regclass('public.watchlist_items') IS NOT NULL THEN
    INSERT INTO public.user_watchlist
      (id, user_id, item_type, item_id, item_name, note, created_at)
    SELECT
      id,
      user_id,
      item_type,
      item_id,
      item_name,
      COALESCE(item_data->>'note', ''),
      created_at
    FROM public.watchlist_items
    WHERE item_type IN ('country', 'platform', 'category', 'product', 'policy')
    ON CONFLICT (user_id, item_type, item_id) DO NOTHING;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.reports') IS NOT NULL THEN
    INSERT INTO public.generated_reports
      (id, user_id, report_type, title, content, file_url, status, created_at, updated_at)
    SELECT
      id,
      user_id,
      CASE
        WHEN report_type IN ('country', 'product', 'market', 'comparison', 'custom') THEN report_type
        ELSE 'custom'
      END,
      title,
      COALESCE(content, '{}'::jsonb),
      file_url,
      'completed',
      created_at,
      created_at
    FROM public.reports
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

INSERT INTO public.user_preferences (user_id, workspace_prefs)
SELECT id, COALESCE(preferences, '{}'::jsonb)
FROM public.profiles
ON CONFLICT (user_id) DO UPDATE
  SET workspace_prefs = EXCLUDED.workspace_prefs
    || COALESCE(public.user_preferences.workspace_prefs, '{}'::jsonb);

ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_workspace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watchlist_select_own" ON public.user_watchlist;
DROP POLICY IF EXISTS "watchlist_insert_own" ON public.user_watchlist;
DROP POLICY IF EXISTS "watchlist_update_own" ON public.user_watchlist;
DROP POLICY IF EXISTS "watchlist_delete_own" ON public.user_watchlist;
DROP POLICY IF EXISTS "user_watchlist_select_own" ON public.user_watchlist;
DROP POLICY IF EXISTS "user_watchlist_insert_own" ON public.user_watchlist;
DROP POLICY IF EXISTS "user_watchlist_update_own" ON public.user_watchlist;
DROP POLICY IF EXISTS "user_watchlist_delete_own" ON public.user_watchlist;
CREATE POLICY "user_watchlist_select_own" ON public.user_watchlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_watchlist_insert_own" ON public.user_watchlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_watchlist_update_own" ON public.user_watchlist
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_watchlist_delete_own" ON public.user_watchlist
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "activity_select_own" ON public.user_activity;
DROP POLICY IF EXISTS "activity_insert_own" ON public.user_activity;
DROP POLICY IF EXISTS "user_activity_select_own" ON public.user_activity;
DROP POLICY IF EXISTS "user_activity_insert_own" ON public.user_activity;
CREATE POLICY "user_activity_select_own" ON public.user_activity
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_activity_insert_own" ON public.user_activity
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports_select_own" ON public.generated_reports;
DROP POLICY IF EXISTS "reports_insert_own" ON public.generated_reports;
DROP POLICY IF EXISTS "reports_update_own" ON public.generated_reports;
DROP POLICY IF EXISTS "reports_delete_own" ON public.generated_reports;
DROP POLICY IF EXISTS "generated_reports_select_own" ON public.generated_reports;
DROP POLICY IF EXISTS "generated_reports_insert_own" ON public.generated_reports;
DROP POLICY IF EXISTS "generated_reports_update_own" ON public.generated_reports;
DROP POLICY IF EXISTS "generated_reports_delete_own" ON public.generated_reports;
CREATE POLICY "generated_reports_select_own" ON public.generated_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "generated_reports_insert_own" ON public.generated_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "generated_reports_update_own" ON public.generated_reports
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "generated_reports_delete_own" ON public.generated_reports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "prefs_select_own" ON public.user_preferences;
DROP POLICY IF EXISTS "prefs_insert_own" ON public.user_preferences;
DROP POLICY IF EXISTS "prefs_update_own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own" ON public.user_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON public.user_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "report_materials_select_own" ON public.report_materials;
DROP POLICY IF EXISTS "report_materials_insert_own" ON public.report_materials;
DROP POLICY IF EXISTS "report_materials_update_own" ON public.report_materials;
DROP POLICY IF EXISTS "report_materials_delete_own" ON public.report_materials;
CREATE POLICY "report_materials_select_own" ON public.report_materials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "report_materials_insert_own" ON public.report_materials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "report_materials_update_own" ON public.report_materials
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "report_materials_delete_own" ON public.report_materials
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_feedback_select_own" ON public.user_feedback;
DROP POLICY IF EXISTS "user_feedback_insert_own" ON public.user_feedback;
DROP POLICY IF EXISTS "user_feedback_update_own" ON public.user_feedback;
DROP POLICY IF EXISTS "user_feedback_delete_own" ON public.user_feedback;
CREATE POLICY "user_feedback_select_own" ON public.user_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_feedback_insert_own" ON public.user_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_feedback_update_own" ON public.user_feedback
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_feedback_delete_own" ON public.user_feedback
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_workspace_items_select_own" ON public.saved_workspace_items;
DROP POLICY IF EXISTS "saved_workspace_items_insert_own" ON public.saved_workspace_items;
DROP POLICY IF EXISTS "saved_workspace_items_update_own" ON public.saved_workspace_items;
DROP POLICY IF EXISTS "saved_workspace_items_delete_own" ON public.saved_workspace_items;
CREATE POLICY "saved_workspace_items_select_own" ON public.saved_workspace_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "saved_workspace_items_insert_own" ON public.saved_workspace_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_workspace_items_update_own" ON public.saved_workspace_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_workspace_items_delete_own" ON public.saved_workspace_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sales_leads_select_own" ON public.sales_leads;
DROP POLICY IF EXISTS "sales_leads_insert_own" ON public.sales_leads;
CREATE POLICY "sales_leads_select_own" ON public.sales_leads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sales_leads_insert_own" ON public.sales_leads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.user_watchlist, public.user_activity, public.generated_reports,
  public.user_preferences, public.report_materials, public.user_feedback,
  public.saved_workspace_items, public.sales_leads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_watchlist TO authenticated;
GRANT SELECT, INSERT ON public.user_activity TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_workspace_items TO authenticated;
GRANT SELECT, INSERT ON public.sales_leads TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generated_reports_updated_at ON public.generated_reports;
CREATE TRIGGER generated_reports_updated_at
  BEFORE UPDATE ON public.generated_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS user_prefs_updated_at ON public.user_preferences;
CREATE TRIGGER user_prefs_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS report_materials_updated_at ON public.report_materials;
CREATE TRIGGER report_materials_updated_at
  BEFORE UPDATE ON public.report_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS user_feedback_updated_at ON public.user_feedback;
CREATE TRIGGER user_feedback_updated_at
  BEFORE UPDATE ON public.user_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS saved_workspace_items_updated_at ON public.saved_workspace_items;
CREATE TRIGGER saved_workspace_items_updated_at
  BEFORE UPDATE ON public.saved_workspace_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user_prefs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_profile_created_prefs ON public.profiles;
CREATE TRIGGER on_profile_created_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_prefs();

COMMIT;
