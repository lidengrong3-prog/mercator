const { test, expect } = require('@playwright/test');

test('untrusted search, upload, template, and source values stay inert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  const result = await page.evaluate(() => {
    const attack = '<img src=x onerror=alert(1)><script>window.__xss=1</script>';

    const ensure = (id, tag = 'div') => {
      let node = document.getElementById(id);
      if (!node) {
        node = document.createElement(tag);
        node.id = id;
        document.body.appendChild(node);
      }
      return node;
    };
    const similarInput = ensure('ct-similar-input', 'input');
    const similarResults = ensure('ct-similar-results');
    similarInput.value = attack;
    window.ctSearchSimilar();

    window.prImportPayload({
      products: [{
        商品名: attack,
        '国家/市场': '美国',
        平台: 'Amazon',
        类目: attack,
        店铺: attack,
      }],
      shops: [],
    }, 'xss.json');
    window.jayGetWorkspaceAsset = () => [{ name: attack }];
    window.prRenderTemplates();

    window.searchIndex = [[attack, attack, 'overview']];
    const search = document.getElementById('global-search');
    search.value = 'img';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    window.rulesJsonData = {
      items: [{
        id: 'xss-rule', title: attack, summary: '规则摘要', platform: 'Amazon', market: 'US',
        source_url: 'https://example.test/rule', source_kind: 'official', source_type: 'platform', source_record_id: 'xss-rule',
        verification_status: 'verified', verified_at: '2026-09-01T00:00:00Z', evidence_hash: 'a'.repeat(64),
        published_at: '2026-09-01', collected_at: '2026-09-01T00:00:00Z',
      }, {
        id: 'blocked-rule', title: '不应显示', summary: '无效来源', platform: 'Amazon', market: 'US',
        source_url: 'javascript:alert(1)', source_kind: 'official', source_type: 'platform', source_record_id: 'blocked-rule',
        verification_status: 'verified', verified_at: '2026-09-01T00:00:00Z', evidence_hash: 'b'.repeat(64),
        published_at: '2026-09-01', collected_at: '2026-09-01T00:00:00Z',
    }],
    };
    window.rlInitFromJson();
    window.openRlRuleDetail(0);
    const validRuleDetail = document.querySelector('.rl-detail-overlay:last-of-type');
    const validRuleDetailHtml = validRuleDetail ? validRuleDetail.innerHTML : '';
    if (validRuleDetail) validRuleDetail.remove();
    window.openRlRuleDetail(1);
    const invalidRuleDetail = document.querySelector('.rl-detail-overlay:last-of-type');
    const invalidRuleDetailHtml = invalidRuleDetail ? invalidRuleDetail.innerHTML : '';

    return {
      similarHtml: similarResults.innerHTML,
      optionHtml: Array.from(document.querySelectorAll('#pr-f-category option, #pr-shop-select option')).map((o) => o.outerHTML).join(''),
      templateHtml: document.getElementById('pr-tpl-list').innerHTML,
      searchHtml: document.getElementById('search-results').innerHTML,
      ruleHtml: document.getElementById('rl-rules-list').innerHTML,
      validRuleDetailHtml,
      invalidRuleDetailHtml,
      imageCount: document.querySelectorAll('img[src="x"]').length,
      scriptCount: document.querySelectorAll('script').length,
      links: Array.from(document.querySelectorAll('#rl-rules-list a')).map((a) => a.getAttribute('href')),
    };
  });

  expect(result.similarHtml).toContain('&lt;img');
  expect(result.optionHtml).toContain('&lt;img');
  expect(result.templateHtml).not.toContain('<img');
  expect(result.searchHtml).toContain('&lt;img');
  expect(result.ruleHtml).toContain('&lt;img');
  expect(result.ruleHtml).not.toContain('不应显示');
  expect(result.validRuleDetailHtml).toContain('&lt;img');
  expect(result.validRuleDetailHtml).not.toContain('<img');
  expect(result.invalidRuleDetailHtml).not.toContain('href="javascript:');
  expect(result.imageCount).toBe(0);
  expect(result.links).toEqual(['https://example.test/rule']);
  expect(result.scriptCount).toBeGreaterThan(0); // the app's own scripts remain, no injected script is added
  expect(pageErrors).toEqual([]);
});

test('HTTPS source links are rendered and non-HTTPS sources are omitted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  const result = await page.evaluate(() => ({
    https: window.jaySafeHttpsUrl('https://example.test/rule?a=1&b=2'),
    http: window.jaySafeHttpsUrl('http://example.test/rule'),
    javascript: window.jaySafeHttpsUrl('javascript:alert(1)'),
    data: window.jaySafeHttpsUrl('data:text/html,<script>alert(1)</script>'),
  }));

  expect(result.https).toBe('https://example.test/rule?a=1&b=2');
  expect(result.http).toBe('');
  expect(result.javascript).toBe('');
  expect(result.data).toBe('');
});
