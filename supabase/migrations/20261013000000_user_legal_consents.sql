-- Append-only evidence of the exact legal document versions accepted by a user.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_legal_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  privacy_policy_version TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acceptance_source TEXT NOT NULL DEFAULT 'session-gate',
  CONSTRAINT user_legal_consents_versions_present CHECK (
    char_length(trim(privacy_policy_version)) BETWEEN 1 AND 80
    AND char_length(trim(terms_version)) BETWEEN 1 AND 80
  ),
  CONSTRAINT user_legal_consents_source_present CHECK (
    char_length(trim(acceptance_source)) BETWEEN 1 AND 40
  ),
  CONSTRAINT user_legal_consents_version_unique UNIQUE (
    user_id, privacy_policy_version, terms_version
  )
);

CREATE INDEX IF NOT EXISTS idx_user_legal_consents_user_accepted
  ON public.user_legal_consents(user_id, accepted_at DESC);

ALTER TABLE public.user_legal_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_legal_consents_select_own ON public.user_legal_consents;
DROP POLICY IF EXISTS user_legal_consents_insert_own ON public.user_legal_consents;
CREATE POLICY user_legal_consents_select_own ON public.user_legal_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_legal_consents_insert_own ON public.user_legal_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.user_legal_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.user_legal_consents TO authenticated;
GRANT ALL ON public.user_legal_consents TO service_role;

COMMENT ON TABLE public.user_legal_consents IS
  'Append-only user evidence for accepted privacy-policy and terms-of-service versions.';
COMMENT ON COLUMN public.user_legal_consents.accepted_at IS
  'Client-observed acceptance time; recorded_at is the immutable database receipt time.';

COMMIT;
