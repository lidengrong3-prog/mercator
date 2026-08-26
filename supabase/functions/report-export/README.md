# Report export deployment

This JWT-protected Edge Function converts the report text into a server-generated PDF, stores it in the private `reports` bucket, records the export state in `report_exports`, and returns a one-hour signed URL.

Apply `supabase/migrations/20260826_report_exports.sql` first, then configure server-only secrets and deploy:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... ALLOWED_ORIGINS=https://lidengrong3-prog.github.io
supabase functions deploy report-export
```

`SUPABASE_SERVICE_ROLE_KEY` must never be copied into browser JavaScript or GitHub Pages variables.
