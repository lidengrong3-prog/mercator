# DOCX report export

This JWT-protected Edge Function creates a real, editable OOXML `.docx`
package, stores it in the private `reports` bucket, and records the job in
`report_exports` with `format = 'docx'`. It accepts the same `report_id`
contract as the PDF export and reads title, text and source metadata only from
the authenticated user's persisted report.

The document includes Word heading styles, editable tables, rendered SVG charts
with an editable data table, Chinese font styles, page-number fields and HTTPS
hyperlinks for `[S001]` citations. Formal export is blocked unless the report
passes the current quality gate and server-side report validation.

Deploy after applying `20260826030000_report_exports.sql` and
`20260901000000_report_output_lifecycle.sql`, followed by
`20260901010000_production_hardening.sql`. Repeated requests reuse the same
per-user idempotent export job and private file.

```bash
supabase functions deploy report-docx
```
