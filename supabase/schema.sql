-- ============================================================
-- Mercator SaaS - Supabase Database Schema
-- 在 Supabase SQL Editor 中执行此脚本即可创建所有表
-- ============================================================

-- 1. 用户档案表（扩展 auth.users）
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  company TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  avatar_url TEXT,
  watchlist JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用户查询历史记录
CREATE TABLE public.query_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  query_type TEXT NOT NULL,  -- 'country', 'product', 'platform', 'policy'
  query_text TEXT,
  result_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 自定义收藏/关注
CREATE TABLE public.watchlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL,  -- 'country', 'product', 'platform', 'category'
  item_id TEXT NOT NULL,
  item_name TEXT,
  item_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

-- 4. 报告生成记录
CREATE TABLE public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL,  -- 'country', 'product', 'market'
  title TEXT NOT NULL,
  content JSONB,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 反馈/工单
CREATE TABLE public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) 策略
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- profiles: 用户只能看自己的
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- query_history: 用户只能操作自己的
CREATE POLICY "qh_select_own" ON public.query_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "qh_insert_own" ON public.query_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- watchlist_items
CREATE POLICY "wl_select_own" ON public.watchlist_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wl_insert_own" ON public.watchlist_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wl_delete_own" ON public.watchlist_items
  FOR DELETE USING (auth.uid() = user_id);

-- reports
CREATE POLICY "rpt_select_own" ON public.reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rpt_insert_own" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- feedback
CREATE POLICY "fb_select_own" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fb_insert_own" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 自动创建 profile 的触发器
-- 新用户注册时自动生成一条 profile 记录
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 更新 updated_at 触发器
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
