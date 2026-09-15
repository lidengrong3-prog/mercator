BEGIN;

-- Resource metadata is public only through the authenticated resource-library
-- function. Files remain in a private Storage bucket and are signed per access.
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = p_user_id
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.resource_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'annual_report', 'monthly_report', 'whitepaper', 'policy_guide', 'data_summary',
    'ai_agent', 'external_tool', 'course', 'lesson', 'course_material'
  )),
  market_code TEXT,
  platform_key TEXT,
  category_code TEXT,
  resource_year INTEGER CHECK (resource_year IS NULL OR resource_year BETWEEN 1900 AND 2200),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  access_level TEXT NOT NULL DEFAULT 'public' CHECK (access_level IN ('public', 'workspace', 'restricted')),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL DEFAULT 'internal' CHECK (source_kind IN ('official', 'licensed', 'internal', 'user_upload', 'third_party')),
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT resource_items_workspace_access_check CHECK (access_level <> 'workspace' OR workspace_id IS NOT NULL),
  CONSTRAINT resource_items_source_url_check CHECK (source_url IS NULL OR source_url ~* '^https://')
);

CREATE INDEX IF NOT EXISTS idx_resource_items_browse
  ON public.resource_items(status, resource_type, resource_year DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_items_scope
  ON public.resource_items(market_code, platform_key, category_code, resource_year DESC);
CREATE INDEX IF NOT EXISTS idx_resource_items_search
  ON public.resource_items USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '')));

CREATE TABLE IF NOT EXISTS public.resource_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_item_id UUID NOT NULL REFERENCES public.resource_items(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  source_record_id TEXT,
  published_at TIMESTAMPTZ,
  change_note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource_item_id, version_no),
  CONSTRAINT resource_versions_source_url_check CHECK (source_url IS NULL OR source_url ~* '^https://')
);
CREATE INDEX IF NOT EXISTS idx_resource_versions_item
  ON public.resource_versions(resource_item_id, version_no DESC);

CREATE TABLE IF NOT EXISTS public.resource_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_item_id UUID NOT NULL REFERENCES public.resource_items(id) ON DELETE CASCADE,
  resource_version_id UUID REFERENCES public.resource_versions(id) ON DELETE SET NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'resources',
  storage_path TEXT NOT NULL,
  file_format TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  checksum TEXT,
  access_level TEXT NOT NULL DEFAULT 'inherit' CHECK (access_level IN ('inherit', 'restricted')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(storage_bucket, storage_path)
);
CREATE INDEX IF NOT EXISTS idx_resource_files_item
  ON public.resource_files(resource_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.resource_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resource_item_tags (
  resource_item_id UUID NOT NULL REFERENCES public.resource_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.resource_tags(id) ON DELETE CASCADE,
  PRIMARY KEY(resource_item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.resource_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_item_id UUID NOT NULL REFERENCES public.resource_items(id) ON DELETE CASCADE,
  resource_file_id UUID REFERENCES public.resource_files(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'open_agent', 'open_tool')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resource_access_logs_item
  ON public.resource_access_logs(resource_item_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_access_logs_user
  ON public.resource_access_logs(user_id, created_at DESC);

-- A private bucket is required even for resources whose metadata is public.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources', 'resources', FALSE, 52428800,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/markdown',
        'text/plain', 'application/zip', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.resource_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_items_select_accessible ON public.resource_items;
CREATE POLICY resource_items_select_accessible ON public.resource_items
  FOR SELECT TO authenticated USING (
    status = 'published' AND (
      access_level = 'public'
      OR (access_level = 'workspace' AND public.is_workspace_member(workspace_id))
      OR (access_level = 'restricted' AND public.is_platform_admin())
    )
  );
DROP POLICY IF EXISTS resource_items_admin_manage ON public.resource_items;
CREATE POLICY resource_items_admin_manage ON public.resource_items
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS resource_versions_select_accessible ON public.resource_versions;
CREATE POLICY resource_versions_select_accessible ON public.resource_versions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.resource_items item
      WHERE item.id = resource_item_id
        AND item.status = 'published'
        AND (
          item.access_level = 'public'
          OR (item.access_level = 'workspace' AND public.is_workspace_member(item.workspace_id))
          OR (item.access_level = 'restricted' AND public.is_platform_admin())
        )
    )
  );
DROP POLICY IF EXISTS resource_versions_admin_manage ON public.resource_versions;
CREATE POLICY resource_versions_admin_manage ON public.resource_versions
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS resource_files_select_accessible ON public.resource_files;
CREATE POLICY resource_files_select_accessible ON public.resource_files
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.resource_items item
      WHERE item.id = resource_item_id
        AND item.status = 'published'
        AND (
          item.access_level = 'public'
          OR (item.access_level = 'workspace' AND public.is_workspace_member(item.workspace_id))
          OR (item.access_level = 'restricted' AND public.is_platform_admin())
        )
    )
  );
DROP POLICY IF EXISTS resource_files_admin_manage ON public.resource_files;
CREATE POLICY resource_files_admin_manage ON public.resource_files
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS resource_tags_select_authenticated ON public.resource_tags;
CREATE POLICY resource_tags_select_authenticated ON public.resource_tags
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS resource_tags_admin_manage ON public.resource_tags;
CREATE POLICY resource_tags_admin_manage ON public.resource_tags
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS resource_item_tags_select_accessible ON public.resource_item_tags;
CREATE POLICY resource_item_tags_select_accessible ON public.resource_item_tags
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.resource_items item WHERE item.id = resource_item_id)
  );
DROP POLICY IF EXISTS resource_item_tags_admin_manage ON public.resource_item_tags;
CREATE POLICY resource_item_tags_admin_manage ON public.resource_item_tags
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

REVOKE ALL ON public.resource_access_logs FROM anon, authenticated;
GRANT SELECT ON public.resource_items, public.resource_versions, public.resource_files,
  public.resource_tags, public.resource_item_tags TO authenticated;

-- Access logs are written only by the resource-library Edge Function.
REVOKE ALL ON public.resource_access_logs FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS resources_storage_admin_insert ON storage.objects;
CREATE POLICY resources_storage_admin_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'resources' AND public.is_platform_admin()
  );
DROP POLICY IF EXISTS resources_storage_admin_update ON storage.objects;
CREATE POLICY resources_storage_admin_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'resources' AND public.is_platform_admin()
  ) WITH CHECK (
    bucket_id = 'resources' AND public.is_platform_admin()
  );
DROP POLICY IF EXISTS resources_storage_admin_delete ON storage.objects;
CREATE POLICY resources_storage_admin_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'resources' AND public.is_platform_admin()
  );

INSERT INTO public.resource_items
  (slug, title, summary, resource_type, status, access_level, source_kind, metadata)
VALUES
  ('ai-market-analyst', '市场分析助手', '基于正式历史投影回答市场、平台和政策问题。', 'ai_agent', 'published', 'public', 'internal',
   '{"agent_key":"market_analyst","task_type":"market_qa","provider":"deepseek"}'::jsonb),
  ('ai-report-generator', '报告生成助手', '按已核验数据和来源附录生成市场决策报告。', 'ai_agent', 'published', 'public', 'internal',
   '{"agent_key":"report_generator","task_type":"report","provider":"deepseek"}'::jsonb),
  ('ai-translator', '跨境翻译助手', '用于商品、政策和运营内容的跨境中文翻译。', 'ai_agent', 'published', 'public', 'internal',
   '{"agent_key":"translator","task_type":"translation","provider":"doubao"}'::jsonb),
  ('internal-profit-calculator', '利润测算工具', '使用当前工作区输入数据进行单件利润、费用和敏感性测算。', 'external_tool', 'published', 'public', 'internal',
   '{"route":"tools","icon":"calculator"}'::jsonb),
  ('guanhai-academy', '观海学院', '跨境经营课程、学习进度和配套资料入口。', 'course', 'published', 'public', 'internal',
   '{"route":"academy","status":"content_pending"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  resource_type = EXCLUDED.resource_type,
  source_kind = EXCLUDED.source_kind,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO public.resource_tags (tag_key, display_name)
VALUES
  ('ai', 'AI 智能体'), ('market', '市场资料'), ('policy', '政策规则'),
  ('tool', '经营工具'), ('academy', '观海学院')
ON CONFLICT (tag_key) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO public.resource_item_tags (resource_item_id, tag_id)
SELECT item.id, tag.id
FROM public.resource_items item
JOIN public.resource_tags tag ON tag.tag_key = CASE
  WHEN item.resource_type = 'ai_agent' THEN 'ai'
  WHEN item.resource_type = 'external_tool' THEN 'tool'
  WHEN item.resource_type IN ('course', 'lesson', 'course_material') THEN 'academy'
  ELSE 'market'
END
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.resource_items IS 'Resource center metadata; publication and access are governed server-side.';
COMMENT ON TABLE public.resource_versions IS 'Immutable resource revisions; replacing a file creates a new version.';
COMMENT ON TABLE public.resource_files IS 'Private Storage object metadata. Never expose storage_path as a public URL.';
COMMENT ON TABLE public.resource_access_logs IS 'View/download audit written by the resource-library Edge Function.';

COMMIT;
