BEGIN;

-- Academy content is relational and versionable. Binary media stays in the
-- private academy-media bucket; only signed playback URLs leave the server.
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_item_id UUID UNIQUE REFERENCES public.resource_items(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_resource_file_id UUID REFERENCES public.resource_files(id) ON DELETE SET NULL,
  instructor TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'public' CHECK (access_level IN ('public', 'workspace', 'plan', 'purchase', 'manual')),
  required_plan TEXT NOT NULL DEFAULT 'free' CHECK (required_plan IN ('free', 'pro', 'enterprise')),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version_no INTEGER NOT NULL DEFAULT 1 CHECK (version_no > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT courses_workspace_access_check CHECK (access_level <> 'workspace' OR workspace_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  lesson_type TEXT NOT NULL DEFAULT 'article' CHECK (lesson_type IN ('video', 'article', 'live', 'resource')),
  body TEXT NOT NULL DEFAULT '',
  content_resource_item_id UUID REFERENCES public.resource_items(id) ON DELETE SET NULL,
  video_bucket TEXT NOT NULL DEFAULT 'academy-media',
  video_storage_path TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  allow_download BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  version_no INTEGER NOT NULL DEFAULT 1 CHECK (version_no > 0),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_id, sort_order),
  CONSTRAINT course_lesson_video_path_check CHECK (video_storage_path IS NULL OR (video_bucket = 'academy-media' AND video_storage_path !~ '\.\.' AND video_storage_path <> ''))
);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'public' CHECK (source IN ('public', 'workspace', 'plan', 'purchase', 'manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, user_id, workspace_id)
);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  last_position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lesson_id, user_id, workspace_id)
);

CREATE TABLE IF NOT EXISTS public.course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  due_days INTEGER CHECK (due_days IS NULL OR due_days > 0),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.course_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score INTEGER NOT NULL DEFAULT 60 CHECK (passing_score BETWEEN 0 AND 100),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.course_lesson_resources (
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  resource_file_id UUID NOT NULL REFERENCES public.resource_files(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (lesson_id, resource_file_id)
);

CREATE TABLE IF NOT EXISTS public.course_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_courses_catalog ON public.courses(status, access_level, sort_order, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_modules_order ON public.course_modules(course_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_course_lessons_order ON public.course_lessons(module_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON public.course_enrollments(user_id, workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress(user_id, workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_favorites_user ON public.course_favorites(user_id, workspace_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_learning_progress_identity
  ON public.resource_learning_progress(resource_item_id, user_id, (COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_enrollments_identity
  ON public.course_enrollments(course_id, user_id, (COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_progress_identity
  ON public.lesson_progress(lesson_id, user_id, (COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_favorites_identity
  ON public.course_favorites(course_id, user_id, (COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)));

CREATE OR REPLACE FUNCTION public.can_access_course(p_course_id UUID, p_user_id UUID DEFAULT auth.uid(), p_workspace_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = p_course_id AND c.status = 'published'
      AND (
        c.access_level = 'public'
        OR (c.access_level = 'workspace' AND p_workspace_id IS NOT NULL AND c.workspace_id = p_workspace_id AND public.is_workspace_member(c.workspace_id))
        OR (c.access_level = 'plan' AND p_workspace_id IS NOT NULL AND public.is_workspace_member(p_workspace_id) AND EXISTS (
          SELECT 1 FROM public.workspace_subscriptions subscription
          WHERE subscription.workspace_id = p_workspace_id
            AND subscription.status IN ('trialing', 'active')
            AND CASE subscription.plan WHEN 'enterprise' THEN 3 WHEN 'pro' THEN 2 ELSE 1 END
              >= CASE c.required_plan WHEN 'enterprise' THEN 3 WHEN 'pro' THEN 2 ELSE 1 END
        ))
        OR (c.access_level IN ('purchase', 'manual') AND EXISTS (
          SELECT 1 FROM public.course_enrollments e
          WHERE e.course_id = c.id AND e.user_id = p_user_id AND e.status = 'active'
            AND (e.expires_at IS NULL OR e.expires_at > NOW())
            AND (e.workspace_id IS NULL OR e.workspace_id = p_workspace_id)
        ))
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_access_course(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_course(UUID, UUID, UUID) TO authenticated, service_role;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_select_accessible ON public.courses;
CREATE POLICY courses_select_accessible ON public.courses FOR SELECT TO authenticated
  USING (public.can_access_course(id, auth.uid(), workspace_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS courses_admin_manage ON public.courses;
CREATE POLICY courses_admin_manage ON public.courses FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS course_modules_select_accessible ON public.course_modules;
CREATE POLICY course_modules_select_accessible ON public.course_modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (public.can_access_course(c.id, auth.uid(), c.workspace_id) OR public.is_platform_admin())));
DROP POLICY IF EXISTS course_modules_admin_manage ON public.course_modules;
CREATE POLICY course_modules_admin_manage ON public.course_modules FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS course_lessons_select_accessible ON public.course_lessons;
CREATE POLICY course_lessons_select_accessible ON public.course_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_modules m JOIN public.courses c ON c.id = m.course_id WHERE m.id = module_id AND (public.can_access_course(c.id, auth.uid(), c.workspace_id) OR public.is_platform_admin())));
DROP POLICY IF EXISTS course_lessons_admin_manage ON public.course_lessons;
CREATE POLICY course_lessons_admin_manage ON public.course_lessons FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS course_enrollments_select_own ON public.course_enrollments;
CREATE POLICY course_enrollments_select_own ON public.course_enrollments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_platform_admin());
DROP POLICY IF EXISTS course_enrollments_admin_manage ON public.course_enrollments;
CREATE POLICY course_enrollments_admin_manage ON public.course_enrollments FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS lesson_progress_select_own ON public.lesson_progress;
CREATE POLICY lesson_progress_select_own ON public.lesson_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS lesson_progress_insert_own ON public.lesson_progress;
CREATE POLICY lesson_progress_insert_own ON public.lesson_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS lesson_progress_update_own ON public.lesson_progress;
CREATE POLICY lesson_progress_update_own ON public.lesson_progress FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS course_assignments_select_accessible ON public.course_assignments;
CREATE POLICY course_assignments_select_accessible ON public.course_assignments FOR SELECT TO authenticated USING (public.can_access_course(course_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS course_assignments_admin_manage ON public.course_assignments;
CREATE POLICY course_assignments_admin_manage ON public.course_assignments FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS course_quizzes_select_accessible ON public.course_quizzes;
CREATE POLICY course_quizzes_select_accessible ON public.course_quizzes FOR SELECT TO authenticated USING (public.can_access_course(course_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS course_quizzes_admin_manage ON public.course_quizzes;
CREATE POLICY course_quizzes_admin_manage ON public.course_quizzes FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS course_lesson_resources_select_accessible ON public.course_lesson_resources;
CREATE POLICY course_lesson_resources_select_accessible ON public.course_lesson_resources FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_lessons l JOIN public.course_modules m ON m.id = l.module_id WHERE l.id = lesson_id AND (public.can_access_course(m.course_id) OR public.is_platform_admin())));
DROP POLICY IF EXISTS course_lesson_resources_admin_manage ON public.course_lesson_resources;
CREATE POLICY course_lesson_resources_admin_manage ON public.course_lesson_resources FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS course_favorites_own ON public.course_favorites;
CREATE POLICY course_favorites_own ON public.course_favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.courses, public.course_modules, public.course_lessons, public.course_enrollments,
  public.lesson_progress, public.course_assignments, public.course_quizzes, public.course_lesson_resources,
  public.course_favorites FROM anon;
GRANT SELECT ON public.courses, public.course_modules, public.course_enrollments,
  public.course_assignments, public.course_quizzes, public.course_lesson_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lesson_progress TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.course_favorites TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('academy-media', 'academy-media', FALSE, 1073741824)
ON CONFLICT (id) DO UPDATE SET public = FALSE, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS academy_media_admin_insert ON storage.objects;
CREATE POLICY academy_media_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'academy-media' AND public.is_platform_admin());
DROP POLICY IF EXISTS academy_media_admin_update ON storage.objects;
CREATE POLICY academy_media_admin_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'academy-media' AND public.is_platform_admin()) WITH CHECK (bucket_id = 'academy-media' AND public.is_platform_admin());
DROP POLICY IF EXISTS academy_media_admin_delete ON storage.objects;
CREATE POLICY academy_media_admin_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'academy-media' AND public.is_platform_admin());

-- Seed a real course outline. The administrator can add the finished lesson
-- media and replace the outline without changing resource center URLs.
INSERT INTO public.courses (resource_item_id, slug, title, description, instructor, access_level, status, sort_order)
SELECT item.id, 'short-video-operator', '短视频操盘手', '从定位、选题、脚本、拍摄到投放复盘的完整短视频运营课程。', '观海学院', 'public', 'published', 10
FROM public.resource_items item WHERE item.slug = 'guanhai-academy'
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, updated_at = NOW();

INSERT INTO public.course_modules (course_id, title, summary, sort_order)
SELECT c.id, module.title, module.summary, module.sort_order
FROM public.courses c
CROSS JOIN (VALUES
  ('模块一：账号定位与内容策略', '建立目标人群、账号定位和内容支柱。', 10),
  ('模块二：脚本与拍摄执行', '把选题转成可拍摄、可复用的短视频脚本。', 20),
  ('模块三：发布、投放与复盘', '理解分发、投放指标和迭代复盘方法。', 30)
) AS module(title, summary, sort_order)
WHERE c.slug = 'short-video-operator'
ON CONFLICT (course_id, sort_order) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, updated_at = NOW();

INSERT INTO public.course_lessons (module_id, title, summary, lesson_type, duration_seconds, sort_order)
SELECT m.id, lesson.title, lesson.summary, lesson.lesson_type, lesson.duration_seconds, lesson.sort_order
FROM public.course_modules m
JOIN public.courses c ON c.id = m.course_id
JOIN (VALUES
  ('模块一：账号定位与内容策略', '目标用户与账号定位', '明确账号服务对象和内容边界。', 'article', 1200, 10),
  ('模块一：账号定位与内容策略', '内容支柱与选题库', '建立长期可维护的选题和栏目结构。', 'article', 1500, 20),
  ('模块二：脚本与拍摄执行', '短视频脚本拆解', '掌握开场、信息密度和行动引导。', 'video', 1800, 10),
  ('模块二：脚本与拍摄执行', '拍摄与剪辑工作流', '从素材采集到发布前检查的标准流程。', 'video', 2100, 20),
  ('模块三：发布、投放与复盘', '平台发布与合规检查', '发布前确认平台规则、版权和广告标识。', 'article', 1500, 10),
  ('模块三：发布、投放与复盘', '数据复盘与下一轮计划', '用播放、互动和转化指标推动迭代。', 'video', 2400, 20)
) AS lesson(module_title, title, summary, lesson_type, duration_seconds, sort_order)
  ON lesson.module_title = m.title
WHERE c.slug = 'short-video-operator'
ON CONFLICT (module_id, sort_order) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, lesson_type = EXCLUDED.lesson_type, duration_seconds = EXCLUDED.duration_seconds, updated_at = NOW();

COMMIT;
