const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('collaborative business tables use a workspace boundary and role-aware RLS', () => {
  const migration = read('supabase', 'migrations', '20260909010000_workspace_collaboration.sql');
  for (const table of ['generated_reports', 'report_materials', 'user_watchlist', 'saved_workspace_items']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table}[\\s\\S]*ADD COLUMN IF NOT EXISTS workspace_id`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ALTER COLUMN workspace_id SET NOT NULL`));
    assert.match(migration, new RegExp(`CREATE POLICY ${table}_[a-z_]*select_workspace[\\s\\S]*is_workspace_member\\(workspace_id\\)`));
  }
  assert.match(migration, /workspace_role\(p_workspace_id, p_user_id\) IN \('owner', 'admin', 'editor'\)/);
  assert.match(migration, /idx_generated_reports_workspace_client[\s\S]*workspace_id, client_id/);
  assert.match(migration, /idx_report_materials_workspace_client[\s\S]*workspace_id, client_id/);
  assert.match(migration, /idx_user_watchlist_workspace_item[\s\S]*workspace_id, item_type, item_id/);
  assert.match(migration, /guard_workspace_business_identity/);
  assert.match(migration, /NEW\.user_id IS DISTINCT FROM OLD\.user_id/);
});

test('browser workspace synchronization preserves creators and does not delete unseen peer data', () => {
  const source = read('assets', 'js', 'auth-data.js');
  assert.match(source, /user_id: item\.created_by \|\| jayUser\.id/);
  assert.match(source, /jayReportMaterialKnownIds\[row\.client_id\] && !keep\[row\.client_id\]/);
  assert.match(source, /jayWorkspaceAssetCreators\[type\] \|\| jayUser\.id/);
  assert.match(source, /report_materials', 'select=\*&workspace_id=eq\./);
  assert.match(source, /saved_workspace_items', 'select=\*&workspace_id=eq\./);
  assert.match(source, /user_watchlist', 'select=\*&workspace_id=eq\./);
  assert.match(source, /if \(!jayWorkspaceCanEdit\(\)\) \{ toast\('当前工作区为只读权限'\)/);
});

test('formal report save and export authorize through the report workspace', () => {
  const save = read('supabase', 'functions', 'report-save', 'index.ts');
  const validation = read('supabase', 'functions', '_shared', 'report-validation.ts');
  const pdf = read('supabase', 'functions', 'report-export', 'index.ts');
  const docx = read('supabase', 'functions', 'report-docx', 'index.ts');
  assert.match(save, /const workspaceId = uuid\(submitted\.workspace_id\)/);
  assert.match(save, /workspace_members\?workspace_id=eq\./);
  assert.match(save, /\['owner', 'admin', 'editor'\]\.includes\(role\)/);
  assert.match(save, /user_id: creatorId/);
  assert.match(save, /workspace_id: workspaceId/);
  assert.match(save, /on_conflict=workspace_id,client_id/);
  assert.match(validation, /report_materials\?select=[^`]*workspace_id=eq\.\$\{encodeURIComponent\(workspaceId\)\}/);
  for (const source of [pdf, docx]) {
    assert.match(source, /select=id,workspace_id,title,content/);
    assert.match(source, /workspace_members\?workspace_id=eq\./);
    assert.doesNotMatch(source, /generated_reports\?id=eq\.\$\{encodeURIComponent\(reportId\)\}&user_id=eq\./);
    assert.match(source, /validateFormalReportWithServerData\([^\n]+workspaceId/);
  }
});

test('real invitation delivery is registered in production deployment', () => {
  const edge = read('supabase', 'functions', 'workspace-invite', 'index.ts');
  const config = read('supabase', 'config.toml');
  const workflow = read('.github', 'workflows', 'deploy-production.yml');
  const settings = read('assets', 'js', 'product-enhancements.js') + read('assets', 'js', 'alerts-settings.js');
  assert.match(edge, /https:\/\/api\.resend\.com\/emails/);
  assert.match(edge, /delivery_status: 'sent'/);
  assert.match(edge, /delivery_status: 'failed'/);
  assert.match(edge, /INVITE_MAIL_NOT_CONFIGURED/);
  assert.match(config, /\[functions\.workspace-invite\][\s\S]*verify_jwt = true/);
  assert.match(workflow, /functions\/workspace-invite\/index\.ts/);
  assert.match(workflow, /for function_name in[^\n]*workspace-invite/);
  assert.match(workflow, /APP_PUBLIC_URL=\$APP_PUBLIC_URL/);
  assert.match(workflow, /WORKSPACE_INVITE_FROM_EMAIL=\$WORKSPACE_INVITE_FROM_EMAIL/);
  assert.match(settings, /id="st-workspace-select"/);
  assert.match(settings, /邀请邮件已发送/);
  assert.doesNotMatch(settings, /邮件尚未发送/);
});

test('workspace roles expose independent capabilities and shared report metadata', () => {
  const auth = read('assets', 'js', 'auth-data.js');
  const reports = read('assets', 'js', 'reports-decisions.js');
  const settings = read('assets', 'js', 'product-enhancements.js') + read('assets', 'js', 'alerts-settings.js');
  const invite = read('supabase', 'functions', 'workspace-invite', 'index.ts');
  const exportPdf = read('supabase', 'functions', 'report-export', 'index.ts');
  const exportDocx = read('supabase', 'functions', 'report-docx', 'index.ts');
  const exportMigration = read('supabase', 'migrations', '20260913000000_workspace_report_exports.sql');

  for (const role of ['owner', 'admin', 'editor', 'viewer']) assert.match(auth, new RegExp(`['"]${role}['"]`));
  assert.match(auth, /function jayWorkspaceCapabilities\(\)/);
  assert.match(auth, /canManageMembers:[\s\S]*\['owner', 'admin'\]/);
  assert.match(auth, /canEdit:[\s\S]*\['owner', 'admin', 'editor'\]/);
  assert.match(auth, /async function jayHydrateUserWorkspace\(force\)/);
  assert.match(auth, /if \(force \|\| !knownWorkspaceId\) await jayLoadWorkspaceContext/);
  assert.match(auth, /workspace_id=eq\.\' \+ encodeURIComponent\(workspaceId\)/);
  assert.match(reports, /创建人：/);
  assert.match(reports, /工作区：/);
  assert.match(reports, /可执行：/);
  assert.match(reports, /查看者只能打开共享报告/);
  assert.match(settings, /请选择角色/);
  assert.match(settings, /INVITE_ROLE_REQUIRED/);
  assert.match(invite, /INVITE_ROLE_REQUIRED/);
  for (const source of [exportPdf, exportDocx]) {
    assert.match(source, /select=role/);
    assert.match(source, /WORKSPACE_READ_ONLY/);
    assert.match(source, /workspace_id: workspaceId/);
  }
  assert.match(exportMigration, /ALTER TABLE public\.report_exports[\s\S]*ADD COLUMN IF NOT EXISTS workspace_id/);
  assert.match(exportMigration, /CREATE POLICY report_exports_select_workspace/);
  assert.match(exportMigration, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(exportMigration, /CREATE POLICY report_exports_insert_workspace[\s\S]*public\.can_edit_workspace\(workspace_id\)/);
});
