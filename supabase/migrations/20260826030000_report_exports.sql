-- Server-generated report export jobs and private file metadata.

BEGIN;

-- Private bucket for generated PDFs. If storage schema is unavailable in a local SQL test,
-- run this statement in the Supabase dashboard after enabling Storage.
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE TABLE IF NOT EXISTS public.report_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES public.generated_reports(id) ON DELETE SET NULL,
  format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  file_path TEXT,
  file_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_exports_user_created
  ON public.report_exports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_exports_report
  ON public.report_exports (report_id, created_at DESC);

ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_exports_select_own ON public.report_exports;
CREATE POLICY report_exports_select_own ON public.report_exports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.report_exports FROM anon;
GRANT SELECT ON public.report_exports TO authenticated;

DROP POLICY IF EXISTS report_files_select_own ON storage.objects;
CREATE POLICY report_files_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP TRIGGER IF EXISTS report_exports_updated_at ON public.report_exports;
CREATE TRIGGER report_exports_updated_at
  BEFORE UPDATE ON public.report_exports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;
