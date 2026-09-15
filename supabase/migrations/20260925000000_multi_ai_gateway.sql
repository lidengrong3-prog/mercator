BEGIN;

-- Provider configuration is metadata only. API keys stay in Edge Function
-- secrets and are intentionally never stored in Postgres.
CREATE TABLE IF NOT EXISTS public.ai_provider_catalog (
  provider_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  api_style TEXT NOT NULL CHECK (api_style IN ('openai_chat', 'openai_responses', 'coze_chat', 'disabled')),
  base_url TEXT,
  secret_env TEXT,
  default_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending_config' CHECK (status IN ('active', 'pending_config', 'disabled')),
  supports_web_search BOOLEAN NOT NULL DEFAULT FALSE,
  supports_streaming BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_task_types TEXT[] NOT NULL DEFAULT ARRAY['market_qa', 'report', 'analysis']::TEXT[],
  cost_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ai_provider_catalog
  (provider_key, display_name, api_style, base_url, secret_env, default_model, status, supports_web_search, allowed_task_types, metadata)
VALUES
  ('deepseek', 'DeepSeek', 'openai_chat', 'https://api.deepseek.com', 'DEEPSEEK_API_KEY', 'deepseek-chat', 'active', FALSE, ARRAY['market_qa','report','analysis','translation','alerts'], '{"role":"通用分析和报告生成"}'),
  ('coze', 'Coze', 'coze_chat', 'https://api.coze.cn', 'COZE_API_TOKEN', NULL, 'pending_config', FALSE, ARRAY['agent','course_qa','market_qa'], '{"role":"专用 Bot/Workflow 智能体"}'),
  ('doubao', '豆包', 'openai_chat', 'https://ark.cn-beijing.volces.com/api/v3', 'DOUBAO_API_KEY', NULL, 'pending_config', FALSE, ARRAY['market_qa','report','analysis','translation'], '{"role":"中文分析模型；火山方舟"}'),
  ('openai', 'OpenAI', 'openai_responses', 'https://api.openai.com/v1', 'OPENAI_API_KEY', 'gpt-4.1-mini', 'pending_config', FALSE, ARRAY['market_qa','report','analysis','translation','course_qa'], '{"role":"通用推理"}'),
  ('codex', 'Codex', 'openai_responses', NULL, 'CODEX_API_KEY', NULL, 'pending_config', FALSE, ARRAY['code','automation','system_maintenance'], '{"role":"代码、自动化和系统维护；不作为普通市场入口"}'),
  ('workbuddy', 'WorkBuddy', 'disabled', NULL, NULL, NULL, 'disabled', FALSE, ARRAY[]::TEXT[], '{"role":"待确认正式 API、Webhook 或 MCP"}')
ON CONFLICT (provider_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  api_style = EXCLUDED.api_style,
  base_url = EXCLUDED.base_url,
  secret_env = EXCLUDED.secret_env,
  default_model = EXCLUDED.default_model,
  supports_web_search = EXCLUDED.supports_web_search,
  allowed_task_types = EXCLUDED.allowed_task_types,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
ALTER TABLE public.ai_provider_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_provider_catalog_select_active ON public.ai_provider_catalog;
CREATE POLICY ai_provider_catalog_select_active ON public.ai_provider_catalog
  FOR SELECT TO authenticated USING (status <> 'disabled');
REVOKE ALL ON public.ai_provider_catalog FROM anon, authenticated;
GRANT SELECT ON public.ai_provider_catalog TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_agent_catalog (
  agent_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  primary_provider TEXT NOT NULL REFERENCES public.ai_provider_catalog(provider_key),
  fallback_providers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  allowed_data_scope JSONB NOT NULL DEFAULT '{"formal_publications":true}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  manually_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  third_party_disclosure_required BOOLEAN NOT NULL DEFAULT TRUE,
  cost_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_agent_catalog_key_check CHECK (agent_key ~ '^[a-z][a-z0-9_-]*$')
);

INSERT INTO public.ai_agent_catalog
  (agent_key, display_name, task_type, description, primary_provider, fallback_providers, allowed_data_scope, third_party_disclosure_required)
VALUES
  ('market_analyst', '市场分析助手', 'market_qa', '基于正式历史投影回答市场问题', 'deepseek', ARRAY['openai','doubao'], '{"formal_publications":true,"workspace_materials":true}', TRUE),
  ('report_generator', '报告生成助手', 'report', '生成可引用的市场和政策报告', 'deepseek', ARRAY['openai','doubao'], '{"formal_publications":true,"workspace_materials":true,"report_context":true}', TRUE),
  ('translator', '跨境翻译助手', 'translation', '翻译商品、政策和运营内容', 'doubao', ARRAY['openai','deepseek'], '{"formal_publications":true,"workspace_materials":true}', TRUE),
  ('course_assistant', '观海学院助手', 'course_qa', '回答课程和学习资料问题', 'coze', ARRAY['deepseek'], '{"course_materials":true,"formal_publications":false}', TRUE),
  ('code_maintainer', '系统维护助手', 'code', '仅用于代码、自动化和系统维护', 'codex', ARRAY['openai'], '{"system_metadata":true,"workspace_business_data":false}', FALSE)
ON CONFLICT (agent_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  task_type = EXCLUDED.task_type,
  description = EXCLUDED.description,
  primary_provider = EXCLUDED.primary_provider,
  fallback_providers = EXCLUDED.fallback_providers,
  allowed_data_scope = EXCLUDED.allowed_data_scope,
  third_party_disclosure_required = EXCLUDED.third_party_disclosure_required,
  updated_at = NOW();
ALTER TABLE public.ai_agent_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_agent_catalog_select_enabled ON public.ai_agent_catalog;
CREATE POLICY ai_agent_catalog_select_enabled ON public.ai_agent_catalog
  FOR SELECT TO authenticated USING (enabled = TRUE AND manually_disabled = FALSE);
REVOKE ALL ON public.ai_agent_catalog FROM anon, authenticated;
GRANT SELECT ON public.ai_agent_catalog TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_routing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  agent_key TEXT REFERENCES public.ai_agent_catalog(agent_key) ON DELETE SET NULL,
  primary_provider TEXT NOT NULL REFERENCES public.ai_provider_catalog(provider_key),
  fallback_providers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  manually_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PostgreSQL treats NULLs as distinct in a regular UNIQUE constraint; the
-- expression keeps the single global policy for each task idempotent too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_routing_policies_scope_priority
  ON public.ai_routing_policies ((COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)), task_type, priority);

-- An expression index cannot be inferred by a targetless ON CONFLICT DO
-- UPDATE. Update existing global routes first, then insert any missing rows.
WITH route_seeds (task_type, agent_key, primary_provider, fallback_providers, priority) AS (
  VALUES
    ('market_qa', 'market_analyst', 'deepseek', ARRAY['openai','doubao']::TEXT[], 100),
    ('report', 'report_generator', 'deepseek', ARRAY['openai','doubao']::TEXT[], 100),
    ('translation', 'translator', 'doubao', ARRAY['openai','deepseek']::TEXT[], 100),
    ('course_qa', 'course_assistant', 'coze', ARRAY['deepseek']::TEXT[], 100),
    ('code', 'code_maintainer', 'codex', ARRAY['openai']::TEXT[], 100),
    ('automation', 'code_maintainer', 'codex', ARRAY['openai']::TEXT[], 100)
)
UPDATE public.ai_routing_policies AS route
SET
  agent_key = seed.agent_key,
  primary_provider = seed.primary_provider,
  fallback_providers = seed.fallback_providers,
  updated_at = NOW()
FROM route_seeds AS seed
WHERE route.workspace_id IS NULL
  AND route.task_type = seed.task_type
  AND route.priority = seed.priority;

INSERT INTO public.ai_routing_policies (workspace_id, task_type, agent_key, primary_provider, fallback_providers, priority)
VALUES
  (NULL, 'market_qa', 'market_analyst', 'deepseek', ARRAY['openai','doubao'], 100),
  (NULL, 'report', 'report_generator', 'deepseek', ARRAY['openai','doubao'], 100),
  (NULL, 'translation', 'translator', 'doubao', ARRAY['openai','deepseek'], 100),
  (NULL, 'course_qa', 'course_assistant', 'coze', ARRAY['deepseek'], 100),
  (NULL, 'code', 'code_maintainer', 'codex', ARRAY['openai'], 100),
  (NULL, 'automation', 'code_maintainer', 'codex', ARRAY['openai'], 100)
ON CONFLICT DO NOTHING;
ALTER TABLE public.ai_routing_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_routing_policies_select_workspace ON public.ai_routing_policies;
CREATE POLICY ai_routing_policies_select_workspace ON public.ai_routing_policies
  FOR SELECT TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id));
REVOKE ALL ON public.ai_routing_policies FROM anon, authenticated;
GRANT SELECT ON public.ai_routing_policies TO authenticated;

-- One request may try several providers. These rows are operational metadata,
-- never prompts, response bodies, or workspace content.
CREATE TABLE IF NOT EXISTS public.ai_provider_attempt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'analysis',
  agent_key TEXT,
  provider TEXT NOT NULL REFERENCES public.ai_provider_catalog(provider_key),
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  http_status INTEGER,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  estimated_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  error_code TEXT,
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  fallback_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, attempt_no)
);
CREATE INDEX IF NOT EXISTS idx_ai_provider_attempt_logs_workspace
  ON public.ai_provider_attempt_logs(workspace_id, provider, task_type, created_at DESC);
ALTER TABLE public.ai_provider_attempt_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_provider_attempt_logs_select_workspace ON public.ai_provider_attempt_logs;
CREATE POLICY ai_provider_attempt_logs_select_workspace ON public.ai_provider_attempt_logs
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.ai_provider_attempt_logs FROM anon, authenticated;
GRANT SELECT ON public.ai_provider_attempt_logs TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_provider_usage_daily (
  usage_date DATE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL REFERENCES public.ai_provider_catalog(provider_key),
  task_type TEXT NOT NULL DEFAULT 'analysis',
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  estimated_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usage_date, workspace_id, provider, task_type)
);
ALTER TABLE public.ai_provider_usage_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_provider_usage_daily_select_workspace ON public.ai_provider_usage_daily;
CREATE POLICY ai_provider_usage_daily_select_workspace ON public.ai_provider_usage_daily
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.ai_provider_usage_daily FROM anon, authenticated;
GRANT SELECT ON public.ai_provider_usage_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.record_ai_provider_attempt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ai_provider_usage_daily
    (usage_date, workspace_id, provider, task_type, request_count, failure_count, total_tokens, estimated_cost_usd)
  VALUES
    (NEW.created_at::date, NEW.workspace_id, NEW.provider, NEW.task_type, 1,
     CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END, NEW.total_tokens, NEW.estimated_cost_usd)
  ON CONFLICT (usage_date, workspace_id, provider, task_type) DO UPDATE SET
    request_count = ai_provider_usage_daily.request_count + 1,
    failure_count = ai_provider_usage_daily.failure_count + EXCLUDED.failure_count,
    total_tokens = ai_provider_usage_daily.total_tokens + EXCLUDED.total_tokens,
    estimated_cost_usd = ai_provider_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
    updated_at = NOW();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_ai_provider_attempt() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ai_provider_attempt_usage_rollup ON public.ai_provider_attempt_logs;
CREATE TRIGGER ai_provider_attempt_usage_rollup
  AFTER INSERT ON public.ai_provider_attempt_logs
  FOR EACH ROW EXECUTE FUNCTION public.record_ai_provider_attempt();

ALTER TABLE public.ai_request_logs
  ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'analysis',
  ADD COLUMN IF NOT EXISTS agent_key TEXT,
  ADD COLUMN IF NOT EXISTS requested_provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  ADD COLUMN IF NOT EXISTS data_disclosure JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_workspace_task_provider
  ON public.ai_request_logs(workspace_id, task_type, provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_agent
  ON public.ai_request_logs(workspace_id, agent_key, created_at DESC);

COMMENT ON TABLE public.ai_provider_catalog IS '供应商适配和人工启停目录；密钥只存 Edge Function secrets。';
COMMENT ON TABLE public.ai_agent_catalog IS '按任务声明能力、数据范围、主供应商和备用供应商的智能体目录。';
COMMENT ON TABLE public.ai_provider_attempt_logs IS '单一逻辑请求的供应商尝试审计；不保存提示词或响应正文。';
COMMENT ON COLUMN public.ai_request_logs.data_disclosure IS '发送给第三方 AI 的数据范围摘要和用户同意状态，不保存原文。';

COMMIT;
