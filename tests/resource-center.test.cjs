const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('resource center migration has versioned metadata, private files and governed access', () => {
  const sql = read('supabase', 'migrations', '20260926000000_resource_center.sql');
  for (const table of ['resource_items', 'resource_versions', 'resource_files', 'resource_tags', 'resource_access_logs']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
  assert.match(sql, /INSERT INTO storage\.buckets[\s\S]*'resources'[\s\S]*FALSE/);
  assert.match(sql, /resource_items_select_accessible/);
  assert.match(sql, /resource_versions_select_accessible/);
  assert.match(sql, /resource_files_select_accessible/);
  assert.match(sql, /is_platform_admin/);
  assert.match(sql, /source_url.*https/);
  assert.doesNotMatch(sql, /CREATE POLICY .*resources_storage_.* FOR SELECT/);
});

test('academy progress is workspace-scoped and uses the resource catalog', () => {
  const sql = read('supabase', 'migrations', '20260927000000_resource_learning.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.resource_learning_progress/);
  assert.match(sql, /UNIQUE\(resource_item_id, user_id, workspace_id\)/);
  assert.match(sql, /resource_learning_select_own/);
  assert.match(sql, /resource_learning_insert_own/);
  assert.match(sql, /resource_learning_update_own/);
  assert.match(sql, /academy-course-cross-border-foundation/);
});

test('academy content, enrollment and private playback have separate contracts', () => {
  const sql = read('supabase', 'migrations', '20260928000000_academy.sql');
  for (const table of ['courses', 'course_modules', 'course_lessons', 'course_enrollments', 'lesson_progress', 'course_assignments', 'course_quizzes', 'course_favorites']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
  assert.match(sql, /academy-media/);
  assert.match(sql, /can_access_course/);
  assert.match(sql, /video_storage_path/);
  assert.doesNotMatch(sql, /CREATE POLICY .*academy_media_.* FOR SELECT/);
  const edge = read('supabase', 'functions', 'resource-library', 'index.ts');
  for (const action of ['academy_detail', 'enroll_course', 'academy_favorite', 'lesson_progress_update', 'lesson_playback', 'lesson_resource_download', 'prepare_video_upload', 'register_video', 'prepare_lesson_resource_upload', 'register_lesson_resource', 'academy_reorder', 'academy_publish_version']) {
    assert.match(edge, new RegExp(`action === '${action}'`));
  }
  assert.match(edge, /LESSON_MEDIA_NOT_READY/);
  assert.match(edge, /storage\/v1\/object\/sign/);
  assert.doesNotMatch(edge, /playback_url[\s\S]{0,180}video_storage_path/);
});

test('resource library function authenticates, signs downloads and keeps storage paths private', () => {
  const edge = read('supabase', 'functions', 'resource-library', 'index.ts');
  assert.match(edge, /authenticatedUser/);
  assert.match(edge, /enforceRateLimit/);
  assert.match(edge, /action === 'download'/);
  assert.match(edge, /object\/sign/);
  assert.match(edge, /RESOURCE_FILE_FORBIDDEN/);
  assert.match(edge, /action === 'prepare_upload'/);
  assert.match(edge, /action === 'register_file'/);
  assert.match(edge, /storage_path: undefined/);
  assert.match(edge, /resource_access_logs/);
  assert.match(edge, /action === 'progress_list'/);
  assert.match(edge, /action === 'progress_update'/);
  assert.match(edge, /RESOURCE_PROGRESS_SAVE_FAILED/);
});

test('resource center UI exposes market library, AI agents, academy and admin workflow', () => {
  const html = read('index.html');
  const js = read('assets', 'js', 'resource-center.js');
  assert.match(html, /data-resource-tab="market"/);
  assert.match(html, /data-resource-tab="ai"/);
  assert.match(html, /data-resource-tab="academy"/);
  assert.match(html, /resource-admin-form/);
  assert.match(html, /resource-version-form/);
  assert.match(html, /resource-version-no/);
  assert.match(html, /resource-version-change-note/);
  assert.match(html, /resource-platform-filter/);
  assert.match(js, /resource-library/);
  assert.match(js, /resource-card-action/);
  assert.match(js, /create_version/);
  assert.match(js, /resource-version-new/);
  assert.match(js, /resource-progress-toggle/);
  assert.match(js, /progress_update/);
  assert.match(js, /academy-lesson-progress/);
  assert.match(js, /academy-video-upload/);
  assert.match(js, /academy-material-upload/);
  assert.match(js, /prepare_lesson_resource_upload/);
  assert.match(js, /register_lesson_resource/);
  assert.match(js, /lesson_playback/);
  assert.match(js, /last_position_seconds/);
  assert.match(js, /video\.currentTime/);
  assert.match(js, /video\.ontimeupdate/);
  assert.match(js, /video\.onpause/);
  assert.match(js, /video\.onended/);
  assert.match(js, /resourceCenterClosePlayer/);
  assert.match(js, /academy_reorder/);
  assert.match(js, /supabaseClient\.storage\.from\('resources'\)/);
  assert.match(js, /resource-download/);
});

test('course AI is isolated to authorized published course content', () => {
  const edge = read('supabase', 'functions', 'ai-proxy', 'index.ts');
  assert.match(edge, /COURSE_FORBIDDEN/);
  assert.match(edge, /course_lesson_ids/);
  assert.match(edge, /taskType !== 'course_qa'[\s\S]*retrieveFormalHistory/);
  assert.match(edge, /taskType !== 'course_qa'[\s\S]*payload\.web_search/);
  assert.match(edge, /仅根据上述课程内容回答/);
});

test('production deployment includes resource library function and private bucket setup', () => {
  const workflow = read('.github', 'workflows', 'deploy-production.yml');
  const config = read('supabase', 'config.toml');
  assert.match(workflow, /ai-proxy history-search resource-library report-save/);
  assert.match(workflow, /deno check[\s\S]*functions\/resource-library\/index\.ts/);
  assert.match(config, /\[functions\.resource-library\][\s\S]*verify_jwt = true/);
});
