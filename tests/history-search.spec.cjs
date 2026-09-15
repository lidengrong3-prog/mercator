const { test, expect } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');

test('authenticated history search uses server filters, stable cursors and safe DOM', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => {
    const firstId = '10000000-0000-4000-8000-000000000001';
    const secondId = '10000000-0000-4000-8000-000000000002';
    const cursor = {
      relevance: 2, sort_time: '2024-06-01T00:00:00.000Z',
      title_sort: 'first', result_type: 'rule', publication_id: firstId,
    };
    window.__historySearchCalls = [];
    window.jayCanUseUserDb = () => true;
    window.jayFunctionRequest = async (name, payload) => {
      if (name !== 'history-search') throw new Error('unexpected function ' + name);
      window.__historySearchCalls.push(JSON.parse(JSON.stringify(payload)));
      const secondPage = Boolean(payload.cursor);
      const recordId = payload.record_id;
      const row = {
        id: recordId || (secondPage ? secondId : firstId),
        source_id: recordId || (secondPage ? secondId : firstId),
        source_record_id: secondPage ? 'rule-002' : 'rule-001',
        type: 'rule', record_key: secondPage ? 'rule-002' : 'rule-001',
        title: secondPage ? 'Second historical rule' : '<img src=x onerror=window.__historyXss=1> First historical rule',
        summary: secondPage ? 'Second page result' : 'First page result',
        market_code: 'US', platform_key: 'amazon', category_code: 'home',
        source_key: 'platform-official', source_name: 'Amazon official',
        source_category: 'platform_announcement', trust_level: 'high',
        verification_status: 'verified', verification_level: 'high',
        source_url: 'https://example.com/rule',
        history_url: '#search?record=' + (recordId || (secondPage ? secondId : firstId)),
        published_at: '2024-06-01T00:00:00Z', collected_at: '2024-06-02T00:00:00Z',
        version_number: 2,
      };
      return {
        query_snapshot_at: '2026-09-13T00:00:00.000Z', total: recordId ? 1 : 2,
        counts: { all: recordId ? 1 : 2, rule: recordId ? 1 : 2 },
        facets: {
          years: [2024], categories: ['home'],
          sources: [{ key: 'platform-official', name: 'Amazon official' }],
          verification_statuses: ['verified'],
        },
        has_more: !recordId && !secondPage,
        next_cursor: !recordId && !secondPage ? cursor : null,
        items: [row], request_id: 'history-test-request', elapsed_ms: 12,
      };
    };
    window.switchPage('search');
  });

  await expect(page.locator('#unified-search-results')).toContainText('First historical rule');
  await expect(page.locator('#unified-search-results img')).toHaveCount(0);
  await expect(page.locator('#unified-search-source')).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-history-search-desktop.png'), fullPage: true });
  await page.locator('#unified-search-category').selectOption('home');
  await expect.poll(() => page.evaluate(() => window.__historySearchCalls.at(-1).category_code)).toBe('home');
  await page.locator('#unified-search-category').selectOption('');
  await expect(page.locator('#unified-search-pagination [data-direction="next"]')).toBeEnabled();
  await page.locator('#unified-search-pagination [data-direction="next"]').click();
  await expect(page.locator('#unified-search-results')).toContainText('Second historical rule');
  await expect(page.locator('#unified-search-results')).not.toContainText('First historical rule');
  expect(await page.evaluate(() => window.__historySearchCalls.at(-1).cursor.publication_id))
    .toBe('10000000-0000-4000-8000-000000000001');
  await page.locator('#unified-search-pagination [data-direction="previous"]').click();
  await expect(page.locator('#unified-search-results')).toContainText('First historical rule');

  await page.locator('#unified-search-results .unified-search-open').click();
  await expect(page).toHaveURL(/#search\?record=10000000-0000-4000-8000-000000000001/);
  await expect.poll(() => page.evaluate(() => window.__historySearchCalls.at(-1).record_id))
    .toBe('10000000-0000-4000-8000-000000000001');
  expect(await page.evaluate(() => window.__historyXss || 0)).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-history-search-mobile.png'), fullPage: true });
});

test('AI history citations open the matching formal record', async ({ page }) => {
  const recordId = '10000000-0000-4000-8000-000000000099';
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate((id) => {
    window.AI_ENGINE.hasKey = () => true;
    window.jayCanUseUserDb = () => true;
    window.jayFunctionRequest = async (name) => {
      if (name === 'ai-proxy') {
        return {
          choices: [{ message: { content: '该规则已有正式历史依据 [H001]。' } }],
          jay_retrieval: {
            mode: 'formal_publications', source_ids: [id], error: null,
            citations: [{
              citation_id: 'H001', source_id: id, source_record_id: 'rule-099',
              title: 'Historical rule cited by AI', source_name: 'Amazon official',
              source_key: 'platform-official', source_url: 'https://example.com/rule-099',
              history_url: '#search?record=' + id, published_at: '2024-06-01T00:00:00Z',
              collected_at: '2024-06-02T00:00:00Z', verification_level: 'high',
            }],
          },
        };
      }
      if (name === 'history-search') {
        return {
          query_snapshot_at: '2026-09-13T00:00:00.000Z', total: 1,
          counts: { all: 1, rule: 1 }, facets: { years: [2024], categories: [], sources: [], verification_statuses: ['verified'] },
          has_more: false, next_cursor: null,
          items: [{
            id, source_id: id, source_record_id: 'rule-099', type: 'rule', record_key: 'rule-099',
            title: 'Historical rule cited by AI', summary: 'Formal projection returned by history search',
            market_code: 'US', platform_key: 'amazon', source_key: 'platform-official',
            source_name: 'Amazon official', source_category: 'platform_announcement',
            trust_level: 'high', verification_status: 'verified', verification_level: 'high',
            source_url: 'https://example.com/rule-099', history_url: '#search?record=' + id,
            published_at: '2024-06-01T00:00:00Z', collected_at: '2024-06-02T00:00:00Z',
          }],
        };
      }
      throw new Error('unexpected function ' + name);
    };
  }, recordId);

  await page.locator('#ov-hero-input').fill('Amazon 历史规则');
  await page.locator('#ov-hero-send').click();
  const citation = page.locator('#ov-hero-result .ovr-history-citation');
  await expect(citation).toHaveAttribute('href', '#search?record=' + recordId);
  await citation.click();
  await expect(page).toHaveURL(new RegExp('#search\\?record=' + recordId));
  await expect(page.locator('#unified-search-results')).toContainText('Historical rule cited by AI');
});
