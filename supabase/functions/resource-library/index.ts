import { enforceRateLimit, rateLimitResponse, requestId as securityRequestId } from '../_shared/security.ts';

const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:4174', 'http://127.0.0.1:4174',
];
const resourceTypes = new Set([
  'annual_report', 'monthly_report', 'whitepaper', 'policy_guide', 'data_summary',
  'ai_agent', 'external_tool', 'course', 'lesson', 'course_material',
]);
const accessLevels = new Set(['public', 'workspace', 'restricted']);
const fileMimes: Record<string, string[]> = {
  pdf: ['application/pdf'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  csv: ['text/csv', 'application/csv', 'text/plain'], md: ['text/markdown', 'text/plain'], txt: ['text/plain'],
  zip: ['application/zip', 'application/x-zip-compressed'], json: ['application/json', 'text/json', 'text/plain'],
  mp4: ['video/mp4'], webm: ['video/webm'], mov: ['video/quicktime'], m4v: ['video/x-m4v', 'video/mp4'],
};

function origins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') || defaultOrigins.join(','))
    .split(',').map((value) => value.trim()).filter(Boolean);
}
function cors(origin: string | null): Record<string, string> {
  const allowed = origin && origins().includes(origin) ? origin : origins()[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Retry-After, X-JAY-Release',
    Vary: 'Origin',
  };
}
function json(body: Record<string, unknown>, status: number, origin: string | null, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned', ...extra },
  });
}
function uuid(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
}
function safeText(value: unknown, max: number, fallback = ''): string {
  return String(value ?? fallback).trim().slice(0, max);
}
function safeHttps(value: unknown): string | null {
  const candidate = safeText(value, 1000);
  return candidate && /^https:\/\//i.test(candidate) ? candidate : null;
}
function errorResponse(code: string, requestId: string, origin: string | null, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ error: code, code, request_id: requestId, ...extra }, status, origin);
}
function registeredFileError(payload: Record<string, unknown>, storagePath: string, allowed: RegExp, maxBytes: number): string | null {
  const format = safeText(payload.file_format, 12).toLowerCase();
  const mime = safeText(payload.mime_type, 120).toLowerCase().split(';')[0].trim();
  const size = Number(payload.size_bytes);
  const pathExtension = storagePath.toLowerCase().split('.').pop() || '';
  if (!allowed.test(format) || format !== pathExtension) return 'RESOURCE_FILE_FORMAT_INVALID';
  if (!Number.isSafeInteger(size) || size < 1) return 'RESOURCE_FILE_SIZE_INVALID';
  if (size > maxBytes) return 'RESOURCE_FILE_TOO_LARGE';
  if (!(fileMimes[format] || []).includes(mime)) return 'RESOURCE_FILE_MIME_INVALID';
  return null;
}
function encodedPath(path: string): string {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}
async function authenticatedUser(request: Request, supabaseUrl: string, anonKey: string): Promise<{ id: string; email?: string } | null> {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  if (!response.ok) return null;
  return await response.json();
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const requestId = String(request.headers.get('X-Request-Id') || securityRequestId(request)).slice(0, 240);
  if (origin && !origins().includes(origin)) return errorResponse('ORIGIN_NOT_ALLOWED', requestId, origin, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', requestId, origin, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return errorResponse('RESOURCE_SERVICE_NOT_CONFIGURED', requestId, origin, 503);
  const user = await authenticatedUser(request, supabaseUrl, anonKey);
  if (!user?.id) return errorResponse('AUTH_REQUIRED', requestId, origin, 401);
  const userId = user.id;

  const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  try {
    const rate = await enforceRateLimit({ supabaseUrl, serviceKey, request, scope: 'resources', userId });
    if (!rate.allowed) return rateLimitResponse(rate, requestId, origin);
  } catch (error) {
    console.error('resource library rate limiter unavailable', error);
    return errorResponse('RATE_LIMIT_UNAVAILABLE', requestId, origin, 503);
  }

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return errorResponse('INVALID_JSON', requestId, origin); }
  const action = safeText(payload.action || 'list', 40).toLowerCase();
  const adminResponse = await fetch(`${supabaseUrl}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(userId)}&select=role&limit=1`, { headers: serviceHeaders });
  const adminRows = adminResponse.ok ? await adminResponse.json() : [];
  const isAdmin = Array.isArray(adminRows) && adminRows.length > 0;
  const requestedWorkspaceId = uuid(payload.workspace_id);
  let workspaceMember = false;
  if (requestedWorkspaceId) {
    const membershipResponse = await fetch(`${supabaseUrl}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=role&limit=1`, { headers: serviceHeaders });
    workspaceMember = membershipResponse.ok && (await membershipResponse.json()).length > 0;
    if (!workspaceMember && !isAdmin) return errorResponse('WORKSPACE_FORBIDDEN', requestId, origin, 403);
  }

  async function rows(table: string, query: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers: serviceHeaders });
    if (!response.ok) return [];
    const value = await response.json().catch(() => []);
    return Array.isArray(value) ? value as Record<string, unknown>[] : [];
  }
  async function insert(table: string, value: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST', headers: { ...serviceHeaders, Prefer: 'return=representation' }, body: JSON.stringify(value),
    });
    if (!response.ok) return null;
    const valueRows = await response.json().catch(() => []);
    return Array.isArray(valueRows) ? valueRows[0] || null : null;
  }
  async function patch(table: string, id: string, value: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { ...serviceHeaders, Prefer: 'return=representation' }, body: JSON.stringify(value),
    });
    if (!response.ok) return null;
    const valueRows = await response.json().catch(() => []);
    return Array.isArray(valueRows) ? valueRows[0] || null : null;
  }
  async function remove(table: string, query: string): Promise<boolean> {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { method: 'DELETE', headers: serviceHeaders });
    return response.ok;
  }
  function visible(item: Record<string, unknown>): boolean {
    if (item.status !== 'published') return isAdmin;
    const level = String(item.access_level || 'public');
    if (level === 'public') return true;
    if (level === 'workspace') return !!requestedWorkspaceId && (workspaceMember || (isAdmin && String(item.workspace_id || '') === requestedWorkspaceId));
    return isAdmin;
  }
  function publicItem(item: Record<string, unknown>): Record<string, unknown> {
    return {
      id: item.id, slug: item.slug, title: item.title, summary: item.summary,
      resource_type: item.resource_type, market_code: item.market_code, platform_key: item.platform_key,
      category_code: item.category_code, resource_year: item.resource_year, status: item.status,
      access_level: item.access_level, source_kind: item.source_kind, source_url: item.source_url,
      metadata: item.metadata || {}, published_at: item.published_at, created_at: item.created_at, updated_at: item.updated_at,
      workspace_id: item.access_level === 'workspace' ? item.workspace_id : null,
    };
  }
  async function courseById(courseId: string): Promise<Record<string, unknown> | null> {
    return (await rows('courses', `select=id,resource_item_id,slug,title,description,cover_resource_file_id,instructor,access_level,required_plan,workspace_id,status,version_no,sort_order,published_at,updated_at&id=eq.${encodeURIComponent(courseId)}&limit=1`))[0] || null;
  }
  async function canAccessCourse(course: Record<string, unknown> | null): Promise<boolean> {
    if (!course || course.status !== 'published') return isAdmin;
    if (isAdmin || course.access_level === 'public') return true;
    if (course.access_level === 'workspace') return !!requestedWorkspaceId && workspaceMember && String(course.workspace_id || '') === requestedWorkspaceId;
    if (course.access_level === 'plan') {
      if (!requestedWorkspaceId || !workspaceMember) return false;
      const subscriptions = await rows('workspace_subscriptions', `select=plan,status&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}&limit=1`);
      const subscription = subscriptions[0] || {};
      const planRank: Record<string, number> = { free: 1, pro: 2, enterprise: 3 };
      return ['trialing', 'active'].includes(String(subscription.status || '')) && (planRank[String(subscription.plan || 'free')] || 0) >= (planRank[String(course.required_plan || 'free')] || 1);
    }
    const workspaceFilter = requestedWorkspaceId ? `&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}` : '&workspace_id=is.null';
    const enrollments = await rows('course_enrollments', `select=status,expires_at&course_id=eq.${encodeURIComponent(String(course.id))}&user_id=eq.${encodeURIComponent(userId)}${workspaceFilter}&limit=10`);
    return enrollments.some((entry) => entry.status === 'active' && (!entry.expires_at || new Date(String(entry.expires_at)).getTime() > Date.now()));
  }
  async function courseStructure(course: Record<string, unknown>): Promise<Record<string, unknown>> {
    const modules = await rows('course_modules', `select=id,course_id,title,summary,sort_order,status&course_id=eq.${encodeURIComponent(String(course.id))}&status=eq.published&order=sort_order.asc&limit=200`);
    const moduleIds = modules.map((module) => String(module.id));
    const lessons = moduleIds.length ? await rows('course_lessons', `select=id,module_id,title,summary,lesson_type,duration_seconds,allow_download,content_resource_item_id,sort_order,status&module_id=in.(${moduleIds.map(encodeURIComponent).join(',')})&status=eq.published&order=sort_order.asc&limit=1000`) : [];
    const lessonIds = lessons.map((lesson) => String(lesson.id));
    const relations = lessonIds.length ? await rows('course_lesson_resources', `select=lesson_id,resource_file_id,sort_order&lesson_id=in.(${lessonIds.map(encodeURIComponent).join(',')})&order=sort_order.asc&limit=2000`) : [];
    const fileIds = Array.from(new Set(relations.map((entry) => String(entry.resource_file_id || '')).filter(Boolean)));
    const files = fileIds.length ? await rows('resource_files', `select=id,file_format,mime_type,size_bytes,access_level&id=in.(${fileIds.map(encodeURIComponent).join(',')})&limit=2000`) : [];
    const fileById = new Map(files.map((file) => [String(file.id), file]));
    const resourcesByLesson = new Map<string, Record<string, unknown>[]>();
    relations.forEach((relation) => { const file = fileById.get(String(relation.resource_file_id)); if (!file) return; const list = resourcesByLesson.get(String(relation.lesson_id)) || []; list.push(file); resourcesByLesson.set(String(relation.lesson_id), list); });
    const workspaceFilter = requestedWorkspaceId ? `&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}` : '&workspace_id=is.null';
    const progress = lessons.length ? await rows('lesson_progress', `select=lesson_id,watched_seconds,progress_percent,last_position_seconds,status,completed_at,updated_at&user_id=eq.${encodeURIComponent(userId)}${workspaceFilter}&lesson_id=in.(${lessons.map((lesson) => encodeURIComponent(String(lesson.id))).join(',')})&limit=1000`) : [];
    const progressByLesson = new Map(progress.map((entry) => [String(entry.lesson_id), entry]));
    const lessonsByModule = new Map<string, Record<string, unknown>[]>();
    lessons.forEach((lesson) => {
      const value = { ...lesson, resources: resourcesByLesson.get(String(lesson.id)) || [], progress: progressByLesson.get(String(lesson.id)) || { progress_percent: 0, status: 'not_started', last_position_seconds: 0 } };
      const list = lessonsByModule.get(String(lesson.module_id)) || []; list.push(value); lessonsByModule.set(String(lesson.module_id), list);
    });
    const favoriteFilter = requestedWorkspaceId ? `&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}` : '&workspace_id=is.null';
    const favorite = (await rows('course_favorites', `select=id&course_id=eq.${encodeURIComponent(String(course.id))}&user_id=eq.${encodeURIComponent(userId)}${favoriteFilter}&limit=1`)).length > 0;
    const enrolled = (await rows('course_enrollments', `select=id,status,expires_at&course_id=eq.${encodeURIComponent(String(course.id))}&user_id=eq.${encodeURIComponent(userId)}${favoriteFilter}&limit=10`)).some((entry) => entry.status === 'active' && (!entry.expires_at || new Date(String(entry.expires_at)).getTime() > Date.now()));
    return {
      course: { id: course.id, resource_item_id: course.resource_item_id, slug: course.slug, title: course.title, description: course.description, instructor: course.instructor, access_level: course.access_level, required_plan: course.required_plan, version_no: course.version_no, sort_order: course.sort_order, published_at: course.published_at, favorite, enrolled },
      modules: modules.map((module) => ({ id: module.id, title: module.title, summary: module.summary, sort_order: module.sort_order, lessons: lessonsByModule.get(String(module.id)) || [] })),
    };
  }
  async function logAccess(itemId: string, fileId: string | null, actionName: string) {
    await fetch(`${supabaseUrl}/rest/v1/resource_access_logs`, {
      method: 'POST', headers: serviceHeaders,
      body: JSON.stringify({ resource_item_id: itemId, resource_file_id: fileId, user_id: userId, workspace_id: requestedWorkspaceId, action: actionName, metadata: { request_id: requestId } }),
    }).catch((error) => console.error('resource access log failed', error));
  }

  if (action === 'list') {
    const allItems = await rows('resource_items', 'select=id,slug,title,summary,resource_type,market_code,platform_key,category_code,resource_year,status,access_level,workspace_id,source_kind,source_url,metadata,published_at,created_at,updated_at&order=updated_at.desc&limit=500');
    const query = safeText(payload.query, 160).toLowerCase();
    const type = safeText(payload.resource_type, 40);
    const market = safeText(payload.market_code, 30).toUpperCase();
    const platform = safeText(payload.platform_key, 80).toLowerCase();
    const year = Number(payload.year || 0);
    const filtered = allItems.filter((item) => visible(item)
      && (!query || `${item.title || ''} ${item.summary || ''} ${item.slug || ''} ${JSON.stringify(item.metadata || {})}`.toLowerCase().includes(query))
      && (!type || item.resource_type === type)
      && (!market || String(item.market_code || '').toUpperCase() === market)
      && (!platform || String(item.platform_key || '').toLowerCase() === platform)
      && (!year || Number(item.resource_year) === year));
    const offset = Math.max(0, Math.min(10000, Number(payload.offset || 0) || 0));
    const limit = Math.max(1, Math.min(100, Number(payload.limit || 50) || 50));
    const page = filtered.slice(offset, offset + limit).map(publicItem);
    await Promise.all(page.map((item) => logAccess(String(item.id), null, String(item.resource_type).startsWith('ai_') ? 'open_agent' : 'view')));
    return json({ items: page, total: filtered.length, offset, limit, is_admin: isAdmin, request_id: requestId }, 200, origin);
  }

  if (action === 'detail') {
    const itemId = uuid(payload.resource_item_id || payload.id);
    if (!itemId) return errorResponse('RESOURCE_ID_REQUIRED', requestId, origin);
    const item = (await rows('resource_items', `select=*&id=eq.${encodeURIComponent(itemId)}&limit=1`))[0];
    if (!item || !visible(item)) return errorResponse('RESOURCE_NOT_FOUND', requestId, origin, 404);
    const [versions, files, tags] = await Promise.all([
      rows('resource_versions', `select=id,resource_item_id,version_no,title,summary,source_url,source_record_id,published_at,change_note,created_at&resource_item_id=eq.${encodeURIComponent(itemId)}&order=version_no.desc`),
      rows('resource_files', `select=id,resource_item_id,resource_version_id,file_format,mime_type,size_bytes,checksum,access_level,created_at&resource_item_id=eq.${encodeURIComponent(itemId)}&order=created_at.desc`),
      rows('resource_item_tags', `select=tag_id,resource_tags:tag_id(tag_key,display_name)&resource_item_id=eq.${encodeURIComponent(itemId)}`),
    ]);
    await logAccess(itemId, null, 'view');
    return json({ item: publicItem(item), versions, files, tags, is_admin: isAdmin, request_id: requestId }, 200, origin);
  }

  if (action === 'download') {
    const fileId = uuid(payload.resource_file_id || payload.file_id);
    if (!fileId) return errorResponse('RESOURCE_FILE_ID_REQUIRED', requestId, origin);
    const file = (await rows('resource_files', `select=id,resource_item_id,storage_bucket,storage_path,file_format,mime_type,size_bytes,access_level&id=eq.${encodeURIComponent(fileId)}&limit=1`))[0];
    if (!file) return errorResponse('RESOURCE_FILE_NOT_FOUND', requestId, origin, 404);
    const item = (await rows('resource_items', `select=*&id=eq.${encodeURIComponent(String(file.resource_item_id))}&limit=1`))[0];
    if (!item || !visible(item) || (file.access_level === 'restricted' && !isAdmin)) return errorResponse('RESOURCE_FILE_FORBIDDEN', requestId, origin, 403);
    const bucket = String(file.storage_bucket || 'resources');
    if (bucket !== 'resources' || !String(file.storage_path || '').trim() || String(file.storage_path).includes('..')) return errorResponse('RESOURCE_FILE_INVALID_PATH', requestId, origin, 400);
    const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath(String(file.storage_path))}`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ expiresIn: 3600 }) });
    if (!signed.ok) return errorResponse('RESOURCE_SIGNED_URL_FAILED', requestId, origin, 502);
    const signedBody = await signed.json().catch(() => ({}));
    const rawUrl = signedBody.signedURL || signedBody.signedUrl;
    if (!rawUrl) return errorResponse('RESOURCE_SIGNED_URL_MISSING', requestId, origin, 502);
    await logAccess(String(item.id), fileId, 'download');
    const fileUrl = String(rawUrl).startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl}`;
    return json({ file_url: fileUrl, expires_in: 3600, resource_id: item.id, file_id: fileId, request_id: requestId }, 200, origin);
  }

  if (action === 'progress_list') {
    const workspaceFilter = requestedWorkspaceId ? `&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}` : '&workspace_id=is.null';
    const progress = await rows('resource_learning_progress', `select=resource_item_id,status,progress_percent,last_lesson,completed_at,updated_at&user_id=eq.${encodeURIComponent(userId)}${workspaceFilter}&order=updated_at.desc&limit=500`);
    return json({ progress: progress.map((entry) => ({
      resource_item_id: entry.resource_item_id,
      status: entry.status,
      progress_percent: entry.progress_percent,
      last_lesson: entry.last_lesson,
      completed_at: entry.completed_at,
      updated_at: entry.updated_at,
    })), request_id: requestId }, 200, origin);
  }

  if (action === 'progress_update') {
    const itemId = uuid(payload.resource_item_id || payload.id);
    if (!itemId) return errorResponse('RESOURCE_ID_REQUIRED', requestId, origin);
    const item = (await rows('resource_items', `select=*&id=eq.${encodeURIComponent(itemId)}&limit=1`))[0];
    if (!item || !visible(item) || !['course', 'lesson', 'course_material'].includes(String(item.resource_type))) return errorResponse('RESOURCE_NOT_FOUND', requestId, origin, 404);
    const requestedStatus = safeText(payload.status || 'in_progress', 20);
    if (!['not_started', 'in_progress', 'completed'].includes(requestedStatus)) return errorResponse('RESOURCE_PROGRESS_INVALID', requestId, origin);
    const progressPercent = Math.max(0, Math.min(100, Number(payload.progress_percent ?? (requestedStatus === 'completed' ? 100 : 0)) || 0));
    const status = requestedStatus === 'completed' || progressPercent >= 100 ? 'completed' : (progressPercent > 0 ? 'in_progress' : 'not_started');
    const progressBody = {
      resource_item_id: itemId, user_id: userId, workspace_id: requestedWorkspaceId,
      status, progress_percent: status === 'completed' ? 100 : progressPercent,
      last_lesson: safeText(payload.last_lesson, 240) || null,
      completed_at: status === 'completed' ? (payload.completed_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };
    const workspaceFilter = requestedWorkspaceId ? `&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}` : '&workspace_id=is.null';
    const existing = (await rows('resource_learning_progress', `select=id&resource_item_id=eq.${encodeURIComponent(itemId)}&user_id=eq.${encodeURIComponent(userId)}${workspaceFilter}&limit=1`))[0];
    const saved = existing?.id ? await patch('resource_learning_progress', String(existing.id), progressBody) : await insert('resource_learning_progress', progressBody);
    if (!saved) return errorResponse('RESOURCE_PROGRESS_SAVE_FAILED', requestId, origin, 409);
    return json({ progress: { resource_item_id: itemId, status: saved.status, progress_percent: saved.progress_percent, last_lesson: saved.last_lesson, completed_at: saved.completed_at, updated_at: saved.updated_at }, request_id: requestId }, 200, origin);
  }

  if (action === 'academy_detail') {
    let courseId = uuid(payload.course_id);
    const resourceItemId = uuid(payload.resource_item_id);
    if (!courseId && resourceItemId) courseId = String((await rows('courses', `select=id&resource_item_id=eq.${encodeURIComponent(resourceItemId)}&limit=1`))[0]?.id || '');
    if (!courseId) return errorResponse('COURSE_ID_REQUIRED', requestId, origin);
    const course = await courseById(courseId);
    if (!(await canAccessCourse(course))) return errorResponse('COURSE_FORBIDDEN', requestId, origin, 403);
    return json({ ...(await courseStructure(course as Record<string, unknown>)), request_id: requestId }, 200, origin);
  }

  if (action === 'enroll_course') {
    const courseId = uuid(payload.course_id);
    if (!courseId) return errorResponse('COURSE_ID_REQUIRED', requestId, origin);
    const course = await courseById(courseId);
    if (!course || course.status !== 'published') return errorResponse('COURSE_NOT_FOUND', requestId, origin, 404);
    if (course.access_level === 'workspace' && !(requestedWorkspaceId && workspaceMember && String(course.workspace_id || '') === requestedWorkspaceId)) return errorResponse('COURSE_FORBIDDEN', requestId, origin, 403);
    if (course.access_level === 'plan' && !(await canAccessCourse(course))) return errorResponse('COURSE_PLAN_REQUIRED', requestId, origin, 402, { required_plan: course.required_plan });
    if (['purchase', 'manual'].includes(String(course.access_level)) && !isAdmin) return errorResponse('COURSE_ENROLLMENT_REQUIRED', requestId, origin, 402);
    const workspaceFilter = requestedWorkspaceId ? `&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}` : '&workspace_id=is.null';
    const existing = (await rows('course_enrollments', `select=id&course_id=eq.${encodeURIComponent(courseId)}&user_id=eq.${encodeURIComponent(userId)}${workspaceFilter}&limit=1`))[0];
    const enrollmentSource = ['workspace', 'plan'].includes(String(course.access_level)) ? String(course.access_level) : 'public';
    const enrollmentBody = { course_id: courseId, user_id: userId, workspace_id: requestedWorkspaceId, source: enrollmentSource, status: 'active', enrolled_at: new Date().toISOString(), expires_at: null, updated_at: new Date().toISOString() };
    const enrollment = existing?.id ? await patch('course_enrollments', String(existing.id), enrollmentBody) : await insert('course_enrollments', enrollmentBody);
    if (!enrollment) return errorResponse('COURSE_ENROLLMENT_FAILED', requestId, origin, 409);
    return json({ enrollment: { id: enrollment.id, course_id: courseId, status: enrollment.status, expires_at: enrollment.expires_at }, request_id: requestId }, 200, origin);
  }

  if (action === 'academy_favorite') {
    const courseId = uuid(payload.course_id);
    if (!courseId) return errorResponse('COURSE_ID_REQUIRED', requestId, origin);
    const course = await courseById(courseId);
    if (!(await canAccessCourse(course))) return errorResponse('COURSE_FORBIDDEN', requestId, origin, 403);
    const workspaceFilter = requestedWorkspaceId ? `&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}` : '&workspace_id=is.null';
    const favoriteQuery = `course_id=eq.${encodeURIComponent(courseId)}&user_id=eq.${encodeURIComponent(userId)}${workspaceFilter}`;
    const existing = (await rows('course_favorites', `select=id&${favoriteQuery}&limit=1`))[0];
    if (String(payload.mode || 'toggle') === 'remove' || existing?.id) {
      if (existing?.id && (String(payload.mode || 'toggle') === 'remove' || existing.id)) await remove('course_favorites', `id=eq.${encodeURIComponent(String(existing.id))}`);
      return json({ favorite: false, request_id: requestId }, 200, origin);
    }
    const favorite = await insert('course_favorites', { course_id: courseId, user_id: userId, workspace_id: requestedWorkspaceId });
    if (!favorite) return errorResponse('COURSE_FAVORITE_FAILED', requestId, origin, 409);
    return json({ favorite: true, request_id: requestId }, 200, origin);
  }

  if (action === 'lesson_progress_update') {
    const lessonId = uuid(payload.lesson_id);
    if (!lessonId) return errorResponse('LESSON_ID_REQUIRED', requestId, origin);
    const lesson = (await rows('course_lessons', `select=id,module_id&id=eq.${encodeURIComponent(lessonId)}&limit=1`))[0];
    const module = lesson?.module_id ? (await rows('course_modules', `select=id,course_id&id=eq.${encodeURIComponent(String(lesson.module_id))}&limit=1`))[0] : null;
    const course = module?.course_id ? await courseById(String(module.course_id)) : null;
    if (!lesson || !module || !(await canAccessCourse(course))) return errorResponse('LESSON_FORBIDDEN', requestId, origin, 403);
    const requestedStatus = safeText(payload.status || 'in_progress', 20);
    if (!['not_started', 'in_progress', 'completed'].includes(requestedStatus)) return errorResponse('LESSON_PROGRESS_INVALID', requestId, origin);
    const percent = Math.max(0, Math.min(100, Number(payload.progress_percent ?? (requestedStatus === 'completed' ? 100 : 0)) || 0));
    const status = requestedStatus === 'completed' || percent >= 100 ? 'completed' : (percent > 0 ? 'in_progress' : 'not_started');
    const workspaceFilter = requestedWorkspaceId ? `&workspace_id=eq.${encodeURIComponent(requestedWorkspaceId)}` : '&workspace_id=is.null';
    const existing = (await rows('lesson_progress', `select=id&lesson_id=eq.${encodeURIComponent(lessonId)}&user_id=eq.${encodeURIComponent(userId)}${workspaceFilter}&limit=1`))[0];
    const progressBody = { lesson_id: lessonId, user_id: userId, workspace_id: requestedWorkspaceId, watched_seconds: Math.max(0, Number(payload.watched_seconds || 0) || 0), progress_percent: status === 'completed' ? 100 : percent, last_position_seconds: Math.max(0, Number(payload.last_position_seconds || 0) || 0), status, completed_at: status === 'completed' ? (payload.completed_at || new Date().toISOString()) : null, updated_at: new Date().toISOString() };
    const saved = existing?.id ? await patch('lesson_progress', String(existing.id), progressBody) : await insert('lesson_progress', progressBody);
    if (!saved) return errorResponse('LESSON_PROGRESS_SAVE_FAILED', requestId, origin, 409);
    return json({ progress: { lesson_id: lessonId, watched_seconds: saved.watched_seconds, progress_percent: saved.progress_percent, last_position_seconds: saved.last_position_seconds, status: saved.status, completed_at: saved.completed_at, updated_at: saved.updated_at }, request_id: requestId }, 200, origin);
  }

  if (action === 'lesson_playback') {
    const lessonId = uuid(payload.lesson_id);
    if (!lessonId) return errorResponse('LESSON_ID_REQUIRED', requestId, origin);
    const lesson = (await rows('course_lessons', `select=id,module_id,lesson_type,video_bucket,video_storage_path&id=eq.${encodeURIComponent(lessonId)}&limit=1`))[0];
    const module = lesson?.module_id ? (await rows('course_modules', `select=id,course_id&id=eq.${encodeURIComponent(String(lesson.module_id))}&limit=1`))[0] : null;
    const course = module?.course_id ? await courseById(String(module.course_id)) : null;
    if (!lesson || !module || !(await canAccessCourse(course))) return errorResponse('LESSON_FORBIDDEN', requestId, origin, 403);
    if (lesson.lesson_type !== 'video') return errorResponse('LESSON_NOT_VIDEO', requestId, origin, 409);
    const bucket = String(lesson.video_bucket || 'academy-media');
    const storagePath = String(lesson.video_storage_path || '');
    if (bucket !== 'academy-media' || !storagePath || storagePath.includes('..') || !storagePath.startsWith(`${String(course?.id)}/`)) return errorResponse('LESSON_MEDIA_NOT_READY', requestId, origin, 409);
    const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath(storagePath)}`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ expiresIn: 900 }) });
    if (!signed.ok) return errorResponse('LESSON_PLAYBACK_FAILED', requestId, origin, 502);
    const signedBody = await signed.json().catch(() => ({}));
    const rawUrl = signedBody.signedURL || signedBody.signedUrl;
    if (!rawUrl) return errorResponse('LESSON_PLAYBACK_URL_MISSING', requestId, origin, 502);
    return json({ playback_url: String(rawUrl).startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl}`, expires_in: 900, lesson_id: lessonId, request_id: requestId }, 200, origin);
  }

  if (action === 'lesson_resource_download') {
    const lessonId = uuid(payload.lesson_id);
    const fileId = uuid(payload.resource_file_id || payload.file_id);
    if (!lessonId || !fileId) return errorResponse('LESSON_RESOURCE_ID_REQUIRED', requestId, origin);
    const relation = (await rows('course_lesson_resources', `select=lesson_id,resource_file_id&lesson_id=eq.${encodeURIComponent(lessonId)}&resource_file_id=eq.${encodeURIComponent(fileId)}&limit=1`))[0];
    const lesson = relation ? (await rows('course_lessons', `select=id,module_id&id=eq.${encodeURIComponent(lessonId)}&limit=1`))[0] : null;
    const module = lesson?.module_id ? (await rows('course_modules', `select=id,course_id&id=eq.${encodeURIComponent(String(lesson.module_id))}&limit=1`))[0] : null;
    const course = module?.course_id ? await courseById(String(module.course_id)) : null;
    if (!relation || !lesson || !module || !(await canAccessCourse(course))) return errorResponse('LESSON_RESOURCE_FORBIDDEN', requestId, origin, 403);
    const file = (await rows('resource_files', `select=id,storage_bucket,storage_path,file_format,mime_type,size_bytes&id=eq.${encodeURIComponent(fileId)}&limit=1`))[0];
    const bucket = String(file?.storage_bucket || 'resources'), storagePath = String(file?.storage_path || '');
    if (!file || bucket !== 'resources' || !storagePath || storagePath.includes('..')) return errorResponse('LESSON_RESOURCE_NOT_FOUND', requestId, origin, 404);
    const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath(storagePath)}`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ expiresIn: 900 }) });
    if (!signed.ok) return errorResponse('LESSON_RESOURCE_SIGN_FAILED', requestId, origin, 502);
    const signedBody = await signed.json().catch(() => ({}));
    const rawUrl = signedBody.signedURL || signedBody.signedUrl;
    if (!rawUrl) return errorResponse('LESSON_RESOURCE_URL_MISSING', requestId, origin, 502);
    return json({ file_url: String(rawUrl).startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl}`, expires_in: 900, lesson_id: lessonId, file_id: fileId, request_id: requestId }, 200, origin);
  }

  if (!isAdmin) return errorResponse('ADMIN_FORBIDDEN', requestId, origin, 403);

  if (action === 'academy_reorder') {
    const modules = Array.isArray(payload.modules) ? payload.modules.slice(0, 200) : [];
    const lessons = Array.isArray(payload.lessons) ? payload.lessons.slice(0, 1000) : [];
    const reorder = async (table: string, entries: unknown[]) => {
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index] && typeof entries[index] === 'object' ? entries[index] as Record<string, unknown> : {};
        const id = uuid(entry.id);
        if (!id) return false;
        if (!await patch(table, id, { sort_order: -(index + 1) })) return false;
      }
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index] as Record<string, unknown>;
        const id = uuid(entry.id);
        if (!id || !await patch(table, id, { sort_order: (index + 1) * 10 })) return false;
      }
      return true;
    };
    if (!(await reorder('course_modules', modules)) || !(await reorder('course_lessons', lessons))) return errorResponse('ACADEMY_REORDER_FAILED', requestId, origin, 409);
    return json({ reordered: true, request_id: requestId }, 200, origin);
  }

  if (action === 'prepare_video_upload') {
    const courseId = uuid(payload.course_id);
    const lessonId = uuid(payload.lesson_id);
    if (!courseId || !lessonId) return errorResponse('ACADEMY_ID_REQUIRED', requestId, origin);
    const lesson = (await rows('course_lessons', `select=id,module_id&id=eq.${encodeURIComponent(lessonId)}&limit=1`))[0];
    const module = lesson?.module_id ? (await rows('course_modules', `select=id,course_id&id=eq.${encodeURIComponent(String(lesson.module_id))}&limit=1`))[0] : null;
    if (!lesson || !module || String(module.course_id) !== courseId) return errorResponse('LESSON_NOT_FOUND', requestId, origin, 404);
    const ext = safeText(payload.file_format || 'mp4', 8).toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    if (!/^(mp4|webm|mov|m4v)$/.test(ext)) return errorResponse('VIDEO_FORMAT_INVALID', requestId, origin);
    const storagePath = `${courseId}/${lessonId}/${crypto.randomUUID()}.${ext}`;
    return json({ bucket: 'academy-media', storage_path: storagePath, max_size_bytes: 1073741824, request_id: requestId }, 200, origin);
  }

  if (action === 'register_video') {
    const courseId = uuid(payload.course_id);
    const lessonId = uuid(payload.lesson_id);
    const storagePath = safeText(payload.storage_path, 500);
    if (!courseId || !lessonId || !storagePath || storagePath.includes('..') || !storagePath.startsWith(`${courseId}/${lessonId}/`)) return errorResponse('VIDEO_PATH_INVALID', requestId, origin);
    const videoError = registeredFileError(payload, storagePath, /^(mp4|webm|mov|m4v)$/, 1073741824);
    if (videoError) return errorResponse(videoError, requestId, origin, videoError === 'RESOURCE_FILE_TOO_LARGE' ? 413 : 415);
    const lesson = (await rows('course_lessons', `select=id,module_id&id=eq.${encodeURIComponent(lessonId)}&limit=1`))[0];
    const module = lesson?.module_id ? (await rows('course_modules', `select=id,course_id&id=eq.${encodeURIComponent(String(lesson.module_id))}&limit=1`))[0] : null;
    if (!lesson || !module || String(module.course_id) !== courseId) return errorResponse('LESSON_NOT_FOUND', requestId, origin, 404);
    const saved = await patch('course_lessons', lessonId, { video_bucket: 'academy-media', video_storage_path: storagePath, updated_by: userId, updated_at: new Date().toISOString() });
    if (!saved) return errorResponse('VIDEO_REGISTER_FAILED', requestId, origin, 409);
    return json({ lesson: { id: lessonId, lesson_type: saved.lesson_type, duration_seconds: saved.duration_seconds }, request_id: requestId }, 200, origin);
  }

  if (action === 'prepare_lesson_resource_upload') {
    const courseId = uuid(payload.course_id), lessonId = uuid(payload.lesson_id);
    if (!courseId || !lessonId) return errorResponse('ACADEMY_ID_REQUIRED', requestId, origin);
    const lesson = (await rows('course_lessons', `select=id,module_id&id=eq.${encodeURIComponent(lessonId)}&limit=1`))[0];
    const module = lesson?.module_id ? (await rows('course_modules', `select=id,course_id&id=eq.${encodeURIComponent(String(lesson.module_id))}&limit=1`))[0] : null;
    if (!lesson || !module || String(module.course_id) !== courseId) return errorResponse('LESSON_NOT_FOUND', requestId, origin, 404);
    const ext = safeText(payload.file_format || 'bin', 12).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    if (!/^(pdf|docx|xlsx|csv|md|txt|zip)$/.test(ext)) return errorResponse('RESOURCE_FILE_FORMAT_INVALID', requestId, origin);
    return json({ bucket: 'resources', storage_path: `academy/${courseId}/${lessonId}/${crypto.randomUUID()}.${ext}`, max_size_bytes: 52428800, request_id: requestId }, 200, origin);
  }

  if (action === 'register_lesson_resource') {
    const courseId = uuid(payload.course_id), lessonId = uuid(payload.lesson_id), storagePath = safeText(payload.storage_path, 500);
    if (!courseId || !lessonId || !storagePath || storagePath.includes('..') || !storagePath.startsWith(`academy/${courseId}/${lessonId}/`)) return errorResponse('LESSON_RESOURCE_PATH_INVALID', requestId, origin);
    const lessonFileError = registeredFileError(payload, storagePath, /^(pdf|docx|xlsx|csv|md|txt|zip)$/, 52428800);
    if (lessonFileError) return errorResponse(lessonFileError, requestId, origin, lessonFileError === 'RESOURCE_FILE_TOO_LARGE' ? 413 : 415);
    const lesson = (await rows('course_lessons', `select=id,module_id,content_resource_item_id&id=eq.${encodeURIComponent(lessonId)}&limit=1`))[0];
    const module = lesson?.module_id ? (await rows('course_modules', `select=id,course_id&id=eq.${encodeURIComponent(String(lesson.module_id))}&limit=1`))[0] : null;
    const course = module?.course_id ? await courseById(String(module.course_id)) : null;
    if (!lesson || !module || !course || String(course.id) !== courseId || !uuid(course.resource_item_id)) return errorResponse('LESSON_NOT_FOUND', requestId, origin, 404);
    const file = await insert('resource_files', { resource_item_id: course.resource_item_id, storage_bucket: 'resources', storage_path: storagePath, file_format: safeText(payload.file_format || 'bin', 12).toLowerCase(), mime_type: safeText(payload.mime_type || 'application/octet-stream', 120), size_bytes: Math.max(0, Number(payload.size_bytes || 0) || 0), access_level: 'inherit', created_by: userId });
    if (!file?.id) return errorResponse('LESSON_RESOURCE_REGISTER_FAILED', requestId, origin, 409);
    const relation = await insert('course_lesson_resources', { lesson_id: lessonId, resource_file_id: file.id, sort_order: Math.max(0, Number(payload.sort_order || 0) || 0) });
    if (!relation) return errorResponse('LESSON_RESOURCE_LINK_FAILED', requestId, origin, 409);
    return json({ file: { id: file.id, file_format: file.file_format, mime_type: file.mime_type, size_bytes: file.size_bytes }, request_id: requestId }, 200, origin);
  }

  if (action === 'academy_publish_version') {
    let courseId = uuid(payload.course_id);
    const resourceItemId = uuid(payload.resource_item_id);
    if (!courseId && resourceItemId) courseId = String((await rows('courses', `select=id&resource_item_id=eq.${encodeURIComponent(resourceItemId)}&limit=1`))[0]?.id || '');
    if (!courseId) return errorResponse('COURSE_ID_REQUIRED', requestId, origin);
    const course = await courseById(courseId);
    if (!course) return errorResponse('COURSE_NOT_FOUND', requestId, origin, 404);
    const nextVersion = Math.max(Number(course.version_no || 0) + 1, Number(payload.version_no || 0) || 0, 1);
    const saved = await patch('courses', courseId, { version_no: nextVersion, status: 'published', published_at: new Date().toISOString(), updated_by: userId, updated_at: new Date().toISOString() });
    if (!saved) return errorResponse('COURSE_VERSION_PUBLISH_FAILED', requestId, origin, 409);
    return json({ course: { id: courseId, version_no: saved.version_no, status: saved.status, published_at: saved.published_at }, request_id: requestId }, 200, origin);
  }

  if (action === 'save_item') {
    const itemId = uuid(payload.resource_item_id || payload.id);
    const title = safeText(payload.title, 240);
    const resourceType = safeText(payload.resource_type, 40);
    const accessLevel = safeText(payload.access_level || 'public', 20);
    const slug = safeText(payload.slug, 120).toLowerCase();
    if (!title || !resourceTypes.has(resourceType) || !accessLevels.has(accessLevel) || !/^[a-z0-9][a-z0-9-]{1,118}$/.test(slug)) return errorResponse('RESOURCE_ITEM_INVALID', requestId, origin);
    if (accessLevel === 'workspace' && !uuid(payload.workspace_id)) return errorResponse('RESOURCE_WORKSPACE_REQUIRED', requestId, origin);
    const status = ['draft', 'published', 'archived'].includes(String(payload.status)) ? String(payload.status) : 'draft';
    const body = {
      slug, title, summary: safeText(payload.summary, 4000), resource_type: resourceType,
      market_code: safeText(payload.market_code, 30).toUpperCase() || null,
      platform_key: safeText(payload.platform_key, 80).toLowerCase() || null,
      category_code: safeText(payload.category_code, 80) || null,
      resource_year: Number(payload.resource_year || 0) || null, status, access_level: accessLevel,
      workspace_id: accessLevel === 'workspace' ? uuid(payload.workspace_id) : null,
      source_kind: ['official', 'licensed', 'internal', 'user_upload', 'third_party'].includes(String(payload.source_kind)) ? String(payload.source_kind) : 'internal',
      source_url: safeHttps(payload.source_url), metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
      updated_by: userId, published_at: status === 'published' ? (payload.published_at || new Date().toISOString()) : null,
    };
    const saved = itemId ? await patch('resource_items', itemId, body) : await insert('resource_items', { ...body, created_by: userId });
    if (!saved) return errorResponse('RESOURCE_ITEM_SAVE_FAILED', requestId, origin, 409);
    await logAccess(String(saved.id), null, 'view');
    return json({ item: publicItem(saved), request_id: requestId }, 200, origin);
  }

  if (action === 'archive_item' || action === 'publish_item') {
    const itemId = uuid(payload.resource_item_id || payload.id);
    if (!itemId) return errorResponse('RESOURCE_ID_REQUIRED', requestId, origin);
    const status = action === 'publish_item' ? 'published' : 'archived';
    const saved = await patch('resource_items', itemId, { status, updated_by: userId, published_at: status === 'published' ? new Date().toISOString() : null });
    if (!saved) return errorResponse('RESOURCE_ITEM_UPDATE_FAILED', requestId, origin, 409);
    return json({ item: publicItem(saved), request_id: requestId }, 200, origin);
  }

  if (action === 'create_version') {
    const itemId = uuid(payload.resource_item_id || payload.id);
    if (!itemId || !(await rows('resource_items', `select=id&id=eq.${encodeURIComponent(itemId)}&limit=1`))[0]) return errorResponse('RESOURCE_NOT_FOUND', requestId, origin, 404);
    const latest = (await rows('resource_versions', `select=version_no&resource_item_id=eq.${encodeURIComponent(itemId)}&order=version_no.desc&limit=1`))[0];
    const versionNo = Math.max(1, Number(payload.version_no || Number(latest?.version_no || 0) + 1));
    const version = await insert('resource_versions', {
      resource_item_id: itemId, version_no: versionNo, title: safeText(payload.title, 240), summary: safeText(payload.summary, 4000),
      source_url: safeHttps(payload.source_url), source_record_id: safeText(payload.source_record_id, 240) || null,
      published_at: payload.published_at || new Date().toISOString(), change_note: safeText(payload.change_note, 2000), created_by: userId,
    });
    if (!version) return errorResponse('RESOURCE_VERSION_SAVE_FAILED', requestId, origin, 409);
    return json({ version, request_id: requestId }, 200, origin);
  }

  if (action === 'prepare_upload') {
    const itemId = uuid(payload.resource_item_id || payload.id);
    if (!itemId) return errorResponse('RESOURCE_ID_REQUIRED', requestId, origin);
    const item = (await rows('resource_items', `select=id&id=eq.${encodeURIComponent(itemId)}&limit=1`))[0];
    if (!item) return errorResponse('RESOURCE_NOT_FOUND', requestId, origin, 404);
    const ext = safeText(payload.file_format || payload.extension || 'bin', 12).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    if (!/^(pdf|docx|xlsx|csv|md|txt|zip|json|bin)$/.test(ext)) return errorResponse('RESOURCE_FILE_FORMAT_INVALID', requestId, origin);
    const versionId = uuid(payload.resource_version_id);
    const prefix = versionId ? `${itemId}/${versionId}` : String(itemId);
    const storagePath = `${prefix}/${crypto.randomUUID()}.${ext}`;
    return json({ bucket: 'resources', storage_path: storagePath, max_size_bytes: 52428800, request_id: requestId }, 200, origin);
  }

  if (action === 'register_file') {
    const itemId = uuid(payload.resource_item_id || payload.id);
    const fileId = uuid(payload.resource_file_id);
    const storagePath = safeText(payload.storage_path, 500);
    if (!itemId || !storagePath || storagePath.includes('..') || !storagePath.startsWith(`${itemId}/`)) return errorResponse('RESOURCE_FILE_INVALID', requestId, origin);
    const resourceFileError = registeredFileError(payload, storagePath, /^(pdf|docx|xlsx|csv|md|txt|zip|json)$/, 52428800);
    if (resourceFileError) return errorResponse(resourceFileError, requestId, origin, resourceFileError === 'RESOURCE_FILE_TOO_LARGE' ? 413 : 415);
    const versionId = uuid(payload.resource_version_id);
    const fileBody = {
      resource_item_id: itemId, resource_version_id: versionId, storage_bucket: 'resources', storage_path: storagePath,
      file_format: safeText(payload.file_format || 'bin', 12).toLowerCase(), mime_type: safeText(payload.mime_type || 'application/octet-stream', 120),
      size_bytes: Math.max(0, Number(payload.size_bytes || 0) || 0), checksum: safeText(payload.checksum, 128) || null,
      access_level: payload.access_level === 'restricted' ? 'restricted' : 'inherit', created_by: userId,
    };
    const saved = fileId ? await patch('resource_files', fileId, fileBody) : await insert('resource_files', fileBody);
    if (!saved) return errorResponse('RESOURCE_FILE_REGISTER_FAILED', requestId, origin, 409);
    return json({ file: { ...saved, storage_path: undefined }, request_id: requestId }, 200, origin);
  }

  return errorResponse('RESOURCE_ACTION_NOT_SUPPORTED', requestId, origin, 400);
});
