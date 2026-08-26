-- ============================================================
-- JAY观海 · 用户监控店铺落库表（Supabase Auth 用户维度）
-- 用途：把「店铺追踪」页面里用户添加的竞品店铺持久化到 Supabase，
--       实现跨设备/换机不丢失，并由 RLS 保证用户只能访问自己的记录。
-- 适用：已存在 profiles 等表的存量项目，单独执行本文件即可。
-- 幂等：可重复执行（IF NOT EXISTS / DROP POLICY IF EXISTS）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monitored_shops (
  id          TEXT PRIMARY KEY,                         -- user_id || ':' || hash(name|platform|market)
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id   TEXT NOT NULL,
  shop_name   TEXT NOT NULL,
  platform    TEXT,
  market      TEXT,
  category    TEXT,
  tags        TEXT,
  status      TEXT,
  gmv         TEXT,
  growth      TEXT,
  source      TEXT DEFAULT 'app',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.monitored_shops
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_monitored_shops_device
  ON public.monitored_shops(device_id);
CREATE INDEX IF NOT EXISTS idx_monitored_shops_user
  ON public.monitored_shops(user_id);

-- ============================================================
-- RLS: authenticated users can only access their own rows.
-- ============================================================
ALTER TABLE public.monitored_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ms_anon_all" ON public.monitored_shops;
DROP POLICY IF EXISTS "ms_user_select" ON public.monitored_shops;
DROP POLICY IF EXISTS "ms_user_insert" ON public.monitored_shops;
DROP POLICY IF EXISTS "ms_user_update" ON public.monitored_shops;
DROP POLICY IF EXISTS "ms_user_delete" ON public.monitored_shops;

CREATE POLICY "ms_user_select" ON public.monitored_shops
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ms_user_insert" ON public.monitored_shops
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ms_user_update" ON public.monitored_shops
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ms_user_delete" ON public.monitored_shops
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.monitored_shops FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitored_shops TO authenticated;

-- updated_at 自动刷新
CREATE OR REPLACE FUNCTION public.update_monitored_shops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS monitored_shops_updated_at ON public.monitored_shops;
CREATE TRIGGER monitored_shops_updated_at
  BEFORE UPDATE ON public.monitored_shops
  FOR EACH ROW EXECUTE FUNCTION public.update_monitored_shops_updated_at();
