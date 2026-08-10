-- ============================================================
-- Mercator Phase 2: Market Data Tables
-- 将静态JSON数据迁移到PostgreSQL，支持实时查询和用户个性化
-- ============================================================

-- 1. 市场数据KV表（存储国家/平台等结构化数据）
CREATE TABLE IF NOT EXISTS public.market_data (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  meta JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用户收藏/关注列表（增强版）
CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('country', 'platform', 'category', 'product', 'policy')),
  item_id TEXT NOT NULL,
  item_name TEXT,
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

-- 3. 用户查询/浏览历史
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('view_country', 'view_platform', 'search', 'view_policy', 'view_rule', 'export_report')),
  item_id TEXT,
  item_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 生成的报告记录
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('country', 'market', 'comparison', 'custom')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  file_url TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 用户偏好设置
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  default_view TEXT DEFAULT 'dashboard',
  favorite_countries TEXT[] DEFAULT '{}',
  favorite_platforms TEXT[] DEFAULT '{}',
  notification_prefs JSONB DEFAULT '{"email": true, "frequency": "daily"}',
  ui_prefs JSONB DEFAULT '{"theme": "dark", "language": "zh"}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS 策略
-- ============================================================

ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- market_data: 所有人可读（公开市场数据）
CREATE POLICY "market_data_select_all" ON public.market_data
  FOR SELECT USING (true);

-- user_watchlist: 用户只能操作自己的
CREATE POLICY "watchlist_select_own" ON public.user_watchlist
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watchlist_insert_own" ON public.user_watchlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watchlist_update_own" ON public.user_watchlist
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "watchlist_delete_own" ON public.user_watchlist
  FOR DELETE USING (auth.uid() = user_id);

-- user_activity: 用户只能操作自己的
CREATE POLICY "activity_select_own" ON public.user_activity
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activity_insert_own" ON public.user_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- generated_reports: 用户只能操作自己的
CREATE POLICY "reports_select_own" ON public.generated_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reports_insert_own" ON public.generated_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports_delete_own" ON public.generated_reports
  FOR DELETE USING (auth.uid() = user_id);

-- user_preferences: 用户只能操作自己的
CREATE POLICY "prefs_select_own" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prefs_insert_own" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs_update_own" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 自动创建偏好记录的触发器
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_prefs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_prefs();

-- ============================================================
-- updated_at 触发器
-- ============================================================
CREATE TRIGGER market_data_updated_at
  BEFORE UPDATE ON public.market_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER user_prefs_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
