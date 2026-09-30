-- R06: governed general-chat routing and request-level fallback audit.
-- Provider secrets, prompts and response bodies remain outside Postgres.
BEGIN;

UPDATE public.ai_provider_catalog
SET allowed_task_types = CASE
      WHEN 'general_chat' = ANY(allowed_task_types) THEN allowed_task_types
      ELSE array_append(allowed_task_types, 'general_chat')
    END,
    updated_at = NOW()
WHERE provider_key IN ('deepseek', 'doubao', 'openai');

UPDATE public.ai_routing_policies
SET agent_key = NULL,
    primary_provider = 'deepseek',
    fallback_providers = ARRAY['openai','doubao']::TEXT[],
    updated_at = NOW()
WHERE workspace_id IS NULL AND task_type = 'general_chat' AND priority = 100;

INSERT INTO public.ai_routing_policies
  (workspace_id, task_type, agent_key, primary_provider, fallback_providers, priority)
VALUES (NULL, 'general_chat', NULL, 'deepseek', ARRAY['openai','doubao'], 100)
ON CONFLICT DO NOTHING;

ALTER TABLE public.ai_request_logs
  ADD COLUMN IF NOT EXISTS final_fallback_reason TEXT;

COMMENT ON COLUMN public.ai_request_logs.final_fallback_reason IS
  'Final provider-switch reason only; never stores prompts, response bodies, or user content.';

COMMIT;
