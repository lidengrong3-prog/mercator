-- Market analysis is the only validated Coze workload in this release. Keep
-- report and course tasks on DeepSeek until each dedicated Coze Bot is
-- configured and accepted separately.
BEGIN;

UPDATE public.ai_provider_catalog
SET
  allowed_task_types = ARRAY['agent','market_qa']::TEXT[],
  updated_at = NOW()
WHERE provider_key = 'coze';

UPDATE public.ai_provider_catalog
SET
  allowed_task_types = CASE
    WHEN 'course_qa' = ANY(allowed_task_types) THEN allowed_task_types
    ELSE array_append(allowed_task_types, 'course_qa')
  END,
  updated_at = NOW()
WHERE provider_key = 'deepseek';

UPDATE public.ai_agent_catalog
SET primary_provider = 'deepseek',
    fallback_providers = ARRAY['openai','doubao']::TEXT[],
    updated_at = NOW()
WHERE agent_key = 'report_generator';

UPDATE public.ai_routing_policies
SET primary_provider = 'deepseek',
    fallback_providers = ARRAY['openai','doubao']::TEXT[],
    updated_at = NOW()
WHERE workspace_id IS NULL
  AND task_type = 'report';

UPDATE public.ai_agent_catalog
SET primary_provider = 'deepseek',
    fallback_providers = ARRAY[]::TEXT[],
    updated_at = NOW()
WHERE agent_key = 'course_assistant';

UPDATE public.ai_routing_policies
SET primary_provider = 'deepseek',
    fallback_providers = ARRAY[]::TEXT[],
    updated_at = NOW()
WHERE workspace_id IS NULL
  AND task_type = 'course_qa';

COMMIT;
