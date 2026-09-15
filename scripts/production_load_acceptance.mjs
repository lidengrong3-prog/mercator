#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

function option(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}
function flag(name) { return process.argv.includes(`--${name}`); }
function percentile(values, ratio) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return Number(ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)].toFixed(2));
}
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

const virtualUsers = Number(option('virtual-users', '100'));
const durationSeconds = Number(option('duration-seconds', '30'));
const siteUrl = option('site-url', process.env.PRODUCTION_SITE_URL || '');
const searchUrl = option('search-url', process.env.HISTORY_SEARCH_URL || '');
const accessToken = option('access-token', process.env.LOAD_TEST_ACCESS_TOKEN || '');
const anonKey = option('anon-key', process.env.SUPABASE_ANON_KEY || '');
const output = option('output', `production-load-${virtualUsers}.json`);
if (![100, 500, 1000].includes(virtualUsers)) throw new Error('virtual users must be exactly 100, 500 or 1000');
if (!Number.isInteger(durationSeconds) || durationSeconds < 10 || durationSeconds > 1800) throw new Error('duration must be between 10 and 1800 seconds');
if (!siteUrl || (!siteUrl.startsWith('https://') && !flag('allow-local'))) throw new Error('site URL must use HTTPS unless --allow-local is explicit');
if (virtualUsers === 1000 && !flag('confirm-production-window')) throw new Error('1000-user test requires --confirm-production-window');
if ((searchUrl && !accessToken) || (searchUrl && !anonKey)) throw new Error('authenticated search requires access token and anon key');

const startedAt = new Date();
const deadline = Date.now() + durationSeconds * 1000;
const latencies = [], searchLatencies = [];
let totalRequests = 0, failedRequests = 0;
const statuses = {};

async function request(workerIndex, sequence) {
  const useSearch = Boolean(searchUrl && sequence % 5 === workerIndex % 5);
  const url = useSearch ? searchUrl : siteUrl;
  const begin = performance.now();
  try {
    const response = await fetch(url, useSearch ? {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'market policy', limit: 20, offset: 0, sort: 'published_at.desc' }),
      signal: AbortSignal.timeout(15_000),
    } : { redirect: 'follow', signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    statuses[response.status] = (statuses[response.status] || 0) + 1;
    if (!response.ok) failedRequests += 1;
    await response.arrayBuffer();
  } catch {
    statuses.network_error = (statuses.network_error || 0) + 1;
    failedRequests += 1;
  } finally {
    const elapsed = performance.now() - begin;
    latencies.push(elapsed);
    if (useSearch) searchLatencies.push(elapsed);
    totalRequests += 1;
  }
}

await Promise.all(Array.from({ length: virtualUsers }, (_, workerIndex) => (async () => {
  let sequence = 0;
  while (Date.now() < deadline) {
    await request(workerIndex, sequence++);
    await sleep(250);
  }
})()));

const errorRate = totalRequests ? failedRequests / totalRequests : 1;
const result = {
  schema_version: 1,
  profile: `read_${virtualUsers}`,
  virtual_users: virtualUsers,
  duration_seconds: durationSeconds,
  total_requests: totalRequests,
  failed_requests: failedRequests,
  error_rate: Number(errorRate.toFixed(6)),
  p50_ms: percentile(latencies, 0.50), p95_ms: percentile(latencies, 0.95), p99_ms: percentile(latencies, 0.99),
  search_p95_ms: percentile(searchLatencies, 0.95),
  statuses,
  thresholds: { error_rate_max: 0.01, p95_ms_max: 3000, search_p95_ms_max: 4000 },
  passed: errorRate <= 0.01 && percentile(latencies, 0.95) <= 3000
    && (!searchLatencies.length || percentile(searchLatencies, 0.95) <= 4000),
  site_origin: new URL(siteUrl).origin,
  search_enabled: Boolean(searchUrl),
  started_at: startedAt.toISOString(), completed_at: new Date().toISOString(),
};
const canonical = JSON.stringify(result);
result.artifact_digest = createHash('sha256').update(canonical).digest('hex');
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output, profile: result.profile, total_requests: totalRequests, error_rate: result.error_rate,
  p95_ms: result.p95_ms, search_p95_ms: result.search_p95_ms, passed: result.passed }, null, 2));
if (!result.passed) process.exitCode = 1;
