-- R06 sequencing follow-up after the repository's existing 20261016000000
-- migration head. Coze owns all three business AI tasks; DeepSeek remains
-- the real provider fallback. General chat stays on its separate route.
BEGIN;

UPDATE public.ai_provider_catalog
SET
  allowed_task_types = ARRAY['agent','market_qa','report','course_qa']::TEXT[],
  metadata = COALESCE(metadata, '{}'::jsonb)
    || '{"role":"JAY观海主生成 Bot；按任务选择 Bot ID","routing_version":"r06-production"}'::jsonb,
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
