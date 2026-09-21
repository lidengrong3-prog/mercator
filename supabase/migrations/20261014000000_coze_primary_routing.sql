-- Coze is the primary generator for the three user-facing AI tasks. Provider
-- credentials and Bot IDs remain Edge Function secrets; this migration only
-- changes server-owned routing policy.
BEGIN;

UPDATE public.ai_provider_catalog
SET
  allowed_task_types = ARRAY['agent','market_qa','report','course_qa']::TEXT[],
  metadata = COALESCE(metadata, '{}'::jsonb) || '{"role":"JAY观海主生成 Bot；按任务选择 Bot ID"}'::jsonb,
  updated_at = NOW()
WHERE provider_key = 'coze';

UPDATE public.ai_agent_catalog
SET primary_provider = 'coze',
    fallback_providers = ARRAY['deepseek']::TEXT[],
    updated_at = NOW()
WHERE agent_key IN ('market_analyst', 'report_generator', 'course_assistant');

UPDATE public.ai_routing_policies
SET primary_provider = 'coze',
    fallback_providers = ARRAY['deepseek']::TEXT[],
    updated_at = NOW()
WHERE workspace_id IS NULL
  AND task_type IN ('market_qa', 'report', 'course_qa');

COMMIT;
