# Admin summary deployment

Only users listed in `platform_admins` can access this function. It uses the service role server-side to return aggregate operational counts, recent incidents and backup runs, and appends an `admin_audit_log` row.

Add the first administrator manually in the Supabase SQL Editor, then deploy:

```sql
insert into public.platform_admins (user_id, role) values ('AUTH_USER_UUID', 'owner');
```

```bash
supabase functions deploy admin-summary
```
