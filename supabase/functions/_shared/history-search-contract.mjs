const TYPES = new Set(['policy', 'rule', 'product', 'shop', 'content', 'country', 'platform']);
const SORTS = new Set(['relevance', 'newest', 'oldest', 'title']);
const VERIFICATION_STATUSES = new Set(['verified', 'uploaded']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanDate(value) {
  const candidate = cleanText(value, 10);
  if (!candidate || !DATE_PATTERN.test(candidate)) return null;
  const parsed = new Date(candidate + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) return null;
  return candidate;
}

function cleanSnapshot(value) {
  const candidate = cleanText(value, 40);
  if (!candidate || Number.isNaN(Date.parse(candidate))) return null;
  const date = new Date(candidate);
  return date.getTime() <= Date.now() + 60_000 ? date.toISOString() : null;
}

function cleanCursor(value, sort) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const publicationId = cleanText(value.publication_id, 36);
  const resultType = cleanText(value.result_type, 24);
  const sortTime = cleanText(value.sort_time, 40);
  if (!UUID_PATTERN.test(publicationId) || !TYPES.has(resultType)) throw new Error('INVALID_CURSOR');
  if (sort !== 'title' && Number.isNaN(Date.parse(sortTime))) throw new Error('INVALID_CURSOR');
  const cursor = { publication_id: publicationId, result_type: resultType };
  if (sort !== 'title') cursor.sort_time = new Date(sortTime).toISOString();
  if (sort === 'relevance') {
    const relevance = Number(value.relevance);
    if (!Number.isFinite(relevance)) throw new Error('INVALID_CURSOR');
    cursor.relevance = relevance;
  }
  if (sort === 'title') cursor.title_sort = cleanText(value.title_sort, 500);
  return cursor;
}

export function normalizeHistorySearchPayload(payload) {
  const input = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const query = cleanText(input.query, 200);
  const requestedType = cleanText(input.type, 24).toLowerCase();
  const type = TYPES.has(requestedType) ? requestedType : null;
  const marketCode = cleanText(input.market_code, 16).toUpperCase();
  const platformKey = cleanText(input.platform_key, 80).toLowerCase();
  const categoryCode = cleanText(input.category_code, 120).toLowerCase();
  const sourceKey = cleanText(input.source_key, 120).toLowerCase();
  const verificationCandidate = cleanText(input.verification_status, 24).toLowerCase();
  const verificationStatus = VERIFICATION_STATUSES.has(verificationCandidate) ? verificationCandidate : null;
  const sortCandidate = cleanText(input.sort, 24).toLowerCase();
  const sort = SORTS.has(sortCandidate) ? sortCandidate : 'relevance';
  const parsedYear = Number(input.year);
  const year = Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 2200 ? parsedYear : null;
  const recordId = cleanText(input.record_id, 36);
  if (recordId && !UUID_PATTERN.test(recordId)) throw new Error('INVALID_RECORD_ID');
  if (marketCode && !/^[A-Z0-9_-]+$/.test(marketCode)) throw new Error('INVALID_MARKET');
  if (platformKey && !/^[a-z0-9._:-]+$/.test(platformKey)) throw new Error('INVALID_PLATFORM');
  if (sourceKey && !/^[a-z0-9._:-]+$/.test(sourceKey)) throw new Error('INVALID_SOURCE');
  const from = cleanDate(input.from);
  const to = cleanDate(input.to);
  if (from && to && from > to) throw new Error('INVALID_DATE_RANGE');
  const pageSizeValue = Number(input.page_size);
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(pageSizeValue) ? Math.floor(pageSizeValue) : 20));
  return {
    query,
    type,
    marketCode: marketCode || null,
    platformKey: platformKey || null,
    categoryCode: categoryCode || null,
    year,
    sourceKey: sourceKey || null,
    verificationStatus,
    from,
    to,
    sort,
    cursor: cleanCursor(input.cursor, sort),
    snapshotAt: cleanSnapshot(input.snapshot_at),
    pageSize,
    recordId: recordId || null,
  };
}

export function historySearchRpcPayload(value) {
  return {
    p_query: value.query,
    p_type: value.type,
    p_market_code: value.marketCode,
    p_platform_key: value.platformKey,
    p_category_code: value.categoryCode,
    p_year: value.year,
    p_source_key: value.sourceKey,
    p_verification_status: value.verificationStatus,
    p_from: value.from,
    p_to: value.to,
    p_sort: value.sort,
    p_cursor: value.cursor,
    p_snapshot_at: value.snapshotAt,
    p_limit: value.pageSize,
    p_record_id: value.recordId,
  };
}
