# DOCX report export

This JWT-protected Edge Function creates a real OOXML `.docx` package, stores it
in the private `reports` bucket, and records the job in `report_exports` with
`format = 'docx'`. It accepts the same `{ title, text, report_id }` contract as
the PDF export and verifies that the report belongs to the authenticated user.

Deploy after applying `20260826030000_report_exports.sql` and
`20260901000000_report_output_lifecycle.sql`, followed by
`20260901010000_production_hardening.sql`. Repeated requests reuse the same
per-user idempotent export job and private file.

```bash
supabase functions deploy report-docx
```
