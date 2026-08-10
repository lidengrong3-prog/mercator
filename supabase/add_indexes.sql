-- ============================================================
-- Mercator 性能优化：补齐高频查询索引
-- 修复审查问题 P1-3：user_watchlist / user_activity / query_history
--           / reports / feedback 等表缺失索引导致用户量增长后
--           查询性能急剧下降。
-- 在 Supabase SQL Editor 中执行此脚本（可重复执行，幂等）。
-- ============================================================

-- 1. user_watchlist：按用户查询 + 组合查询（用户+类型）
CREATE INDEX IF NOT EXISTS idx_watchlist_user        ON public.user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_type   ON public.user_watchlist(user_id, item_type);

-- 2. user_activity：按用户查询（按时间倒序是高频访问模式）
CREATE INDEX IF NOT EXISTS idx_activity_user         ON public.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_time    ON public.user_activity(user_id, created_at DESC);

-- 3. query_history（schema.sql 中定义）：按用户倒序查询
--    注意：若该项目使用 user_activity 则忽略；此处兼容两个命名
CREATE INDEX IF NOT EXISTS idx_query_history_user    ON public.query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_query_history_user_time ON public.query_history(user_id, created_at DESC);

-- 4. generated_reports：按用户倒序查询报告
CREATE INDEX IF NOT EXISTS idx_reports_user_time     ON public.generated_reports(user_id, created_at DESC);

-- 5. feedback：按状态筛选（运营后台高频）
CREATE INDEX IF NOT EXISTS idx_feedback_status       ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user         ON public.feedback(user_id);

-- 6. watchlist_items / profiles：补强（若使用这些表）
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user  ON public.watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_type ON public.watchlist_items(user_id, item_type);

-- 7. market_data：加速按 key 点查（已 PRIMARY KEY，无需额外索引，保留注释）
-- market_data(key) 已是 PRIMARY KEY，PostgREST 的 ?key=eq.x 走主键索引，无需处理。

-- ============================================================
-- 验证：执行后可运行以下查询确认索引已建立
-- SELECT indexname FROM pg_indexes WHERE tablename IN
--   ('user_watchlist','user_activity','query_history','generated_reports','feedback');
-- ============================================================
