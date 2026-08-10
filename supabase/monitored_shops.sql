-- ============================================================
-- JAY观海 · 用户监控店铺落库表（device 维度）
-- 用途：把「店铺追踪」页面里用户添加的竞品店铺持久化到 Supabase，
--       实现跨设备/换机不丢失，并作为后续接入登录(user_id)维度的基础。
-- 适用：已存在 profiles 等表的存量项目，单独执行本文件即可。
-- 幂等：可重复执行（IF NOT EXISTS / DROP POLICY IF EXISTS）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monitored_shops (
  id          TEXT PRIMARY KEY,                         -- device_id || ':' || hash(name|platform|market)
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

CREATE INDEX IF NOT EXISTS idx_monitored_shops_device
  ON public.monitored_shops(device_id);

-- ============================================================
-- RLS：当前产品尚无登录体系，使用「设备维度」隔离。
-- device_id 为前端生成的不可预测随机串，作为弱隔离。
-- 接入登录后改为 user_id 维度并收紧策略（见底部注释）。
-- ============================================================
ALTER TABLE public.monitored_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ms_anon_all" ON public.monitored_shops;
CREATE POLICY "ms_anon_all" ON public.monitored_shops
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

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

-- ============================================================
-- 接入登录后的目标策略（届时替换上面的 ms_anon_all）：
--   ALTER TABLE public.monitored_shops ADD COLUMN user_id UUID REFERENCES auth.users(id);
--   DROP POLICY "ms_anon_all" ON public.monitored_shops;
--   CREATE POLICY "ms_user_own" ON public.monitored_shops
--     FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- ============================================================
