BEGIN;

-- Learning progress is user/workspace data, while course content remains in
-- the governed resource catalog. A member can update only their own progress.
CREATE TABLE IF NOT EXISTS public.resource_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_item_id UUID NOT NULL REFERENCES public.resource_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  last_lesson TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource_item_id, user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_learning_user
  ON public.resource_learning_progress(user_id, workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_learning_item
  ON public.resource_learning_progress(resource_item_id, updated_at DESC);

ALTER TABLE public.resource_learning_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_learning_select_own ON public.resource_learning_progress;
CREATE POLICY resource_learning_select_own ON public.resource_learning_progress
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.resource_items item
      WHERE item.id = resource_item_id
        AND item.resource_type IN ('course', 'lesson', 'course_material')
        AND item.status = 'published'
        AND (
          item.access_level = 'public'
          OR (item.access_level = 'workspace' AND public.is_workspace_member(item.workspace_id))
          OR (item.access_level = 'restricted' AND public.is_platform_admin())
        )
    )
  );
DROP POLICY IF EXISTS resource_learning_insert_own ON public.resource_learning_progress;
CREATE POLICY resource_learning_insert_own ON public.resource_learning_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS resource_learning_update_own ON public.resource_learning_progress;
CREATE POLICY resource_learning_update_own ON public.resource_learning_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.resource_learning_progress FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.resource_learning_progress TO authenticated;

-- Provide a small, editable academy outline. Administrators can replace these
-- records with the full course tree without changing the client contract.
INSERT INTO public.resource_items
  (slug, title, summary, resource_type, status, access_level, source_kind, metadata)
VALUES
  ('academy-course-cross-border-foundation', '跨境经营基础课', '从市场选择、平台规则到数据验证的入门课程。', 'course', 'published', 'public', 'internal',
   '{"academy_key":"cross_border_foundation","sort_order":10}'::jsonb),
  ('academy-lesson-market-scope', '第 1 课：建立市场范围', '学习如何按国家、平台和品类建立可验证的经营范围。', 'lesson', 'published', 'public', 'internal',
   '{"academy_key":"cross_border_foundation","sort_order":20,"duration_minutes":25}'::jsonb),
  ('academy-material-research-checklist', '市场调研检查清单', '可下载和复用的市场调研步骤与证据核验清单。', 'course_material', 'published', 'public', 'internal',
   '{"academy_key":"cross_border_foundation","sort_order":30}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  resource_type = EXCLUDED.resource_type,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO public.resource_item_tags (resource_item_id, tag_id)
SELECT item.id, tag.id
FROM public.resource_items item
JOIN public.resource_tags tag ON tag.tag_key = 'academy'
WHERE item.slug IN ('academy-course-cross-border-foundation', 'academy-lesson-market-scope', 'academy-material-research-checklist')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.resource_learning_progress IS 'Per-user academy progress scoped to an optional workspace.';

COMMIT;
