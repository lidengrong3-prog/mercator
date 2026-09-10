# Report export deployment

This JWT-protected Edge Function converts the persisted report into a
server-generated PDF, stores it in the private `reports` bucket, records the
export state in `report_exports`, and returns a one-hour signed URL. The PDF
keeps Markdown heading levels and tables, renders validated `chart` fences as
vector charts, uses a Chinese CID font, writes page numbers, and turns HTTPS
`[S001]` citations into clickable source annotations.

Formal export still requires the saved report to pass the current quality gate,
server-side scope/coverage/citation validation, ownership checks and the
`publication_status = formal` contract.

Apply `supabase/migrations/20260826030000_report_exports.sql` and
`supabase/migrations/20260901000000_report_output_lifecycle.sql`, followed by
`supabase/migrations/20260901010000_production_hardening.sql`, then
configure server-only secrets and deploy. The request must include the UUID of
the caller's `generated_reports` row; the function rejects unlinked reports.
Repeated requests reuse the per-user idempotent job and issue a new signed URL
for an existing completed file.

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... ALLOWED_ORIGINS=https://lidengrong3-prog.github.io
supabase functions deploy report-export
supabase functions deploy report-docx
```

`SUPABASE_SERVICE_ROLE_KEY` must never be copied into browser JavaScript or GitHub Pages variables.
