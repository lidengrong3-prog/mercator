BEGIN;

-- Supabase installs pgcrypto in the trusted extensions schema. The rate-limit
-- function calls digest(), so its SECURITY DEFINER search path must include it.
DO $$
BEGIN
  IF to_regprocedure('public.consume_security_rate_limit(text,text,integer,integer,uuid)') IS NULL THEN
    RAISE EXCEPTION 'consume_security_rate_limit is missing';
  END IF;
END;
$$;

ALTER FUNCTION public.consume_security_rate_limit(TEXT, TEXT, INTEGER, INTEGER, UUID)
  SET search_path = public, extensions;

COMMIT;
