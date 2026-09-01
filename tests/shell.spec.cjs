const { test, expect } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');

test('authenticated entry and read-only demo shell work on desktop', async ({ page }) => {
  const pageErrors = [];
  const userTableRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (/\/(user_watchlist|user_activity|generated_reports|user_preferences|report_materials|user_feedback|saved_workspace_items|sales_leads)(\?|$)/.test(request.url())) {
      userTableRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '进入美国市场情报台' })).toBeVisible();
  await expect(page.locator('#mainApp')).not.toHaveClass(/active/);

  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await expect(page.locator('#mainApp')).toHaveClass(/active/);
  await expect(page.locator('#ov-workspace-title')).toHaveText('美国市场决策工作台');
  await expect(page.locator('aside.sidebar')).toHaveCSS('width', '248px');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.rpAddMaterial('country', 'demo item', 'test', 'test'));
  expect(await page.evaluate(() => window.rpGetPool().length)).toBe(0);
  expect(userTableRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-guanhai-desktop.png'), fullPage: true });
});

test('mobile shell uses a drawer without horizontal overflow', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await expect(page.locator('#ov-workspace-title')).toHaveText('美国市场决策工作台');
  await expect(page.locator('#jay-hamburger')).toBeVisible();
  await page.locator('#jay-hamburger').click();
  await expect(page.locator('aside.sidebar')).toHaveClass(/open/);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
  await page.mouse.click(360, 420);
  await expect(page.locator('aside.sidebar')).not.toHaveClass(/open/);
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-guanhai-mobile.png'), fullPage: true });
});

test('core product pages stay in the workspace and render above the fold', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  const routes = [
    'overview', 'watchlist', 'alerts', 'countries', 'products',
    'platforms', 'policies', 'rules', 'shops', 'report',
    'tools', 'content', 'data', 'pricing', 'settings',
  ];

  for (const route of routes) {
    await page.evaluate((name) => window.switchPage(name), route);
    const layout = await page.locator(`#${route}`).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        parent: element.parentElement && element.parentElement.tagName,
        top: rect.top,
        width: rect.width,
      };
    });

    expect(layout.parent).toBe('MAIN');
    expect(layout.top).toBeLessThan(240);
    expect(layout.width).toBeGreaterThan(700);
  }

  await page.evaluate(() => window.switchPage('countries'));
  await expect(page.locator('#countries .country-scope-summary')).toContainText('美国');
  await expect(page.locator('#country-profile-selector')).toHaveValue('US');
  await expect(page.locator('#country-commerce-title')).toHaveText('美国电商市场环境');
  await expect(page.locator('#country-commerce-count')).toHaveText('8 项已接入');
  await expect(page.locator('#country-commerce-content .country-commerce-metric')).toHaveCount(11);
  await expect(page.locator('#country-commerce-content .country-commerce-metric.has-data')).toHaveCount(8);
  await expect(page.locator('#country-commerce-content .country-commerce-metric.is-missing')).toHaveCount(3);
  await expect(page.locator('#country-commerce-status')).toHaveAttribute('data-data-status', 'ready');
  await expect(page.locator('#country-commerce-content .country-commerce-metric.is-missing').first()).toHaveAttribute('data-data-status', 'not-connected');
  await expect(page.locator('#country-commerce-content .country-commerce-metric.is-missing').first()).toContainText('尚未接入');
  await expect(page.locator('#country-commerce-content .country-commerce-metric.has-data a')).toHaveCount(8);
  await expect(page.locator('#country-commerce-content')).toContainText('电商零售总额');
  await expect(page.locator('#country-commerce-content')).toContainText('电商渗透率');
  await expect(page.locator('#country-commerce-content')).not.toContainText(/国债|房贷|房价|非农/);
  await expect(page.locator('#country-commerce-content .country-commerce-metric.has-data').first().locator('a')).toHaveAttribute('href', /^https:\/\//);
  await expect(page.locator('#country-commerce-category')).toHaveValue('');
  await expect(page.locator('[data-commerce-section="category"]')).toContainText('请选择具体品类');

  await page.locator('#country-commerce-category').selectOption('apparel');
  await expect(page.locator('[data-commerce-section="category"] .country-commerce-metric.has-data')).toHaveCount(1);
  await expect(page.locator('[data-commerce-section="category"]')).toContainText('服装及配饰门店零售');
  await expect(page.locator('#country-commerce-count')).toHaveText('9 项已接入');
  await page.locator('#country-commerce-category').selectOption('');
  await expect(page.locator('#countries .chart-placeholder')).toHaveCount(0);
  await expect(page.locator('#countries .alert-sidebar .alert-item')).toHaveCount(0);

  await page.evaluate(() => window.switchPage('overview'));
  await expect(page.locator('#ov-country-grid .ov-ccard-metrics')).toContainText('8 项');

  await page.evaluate(() => window.switchPage('tools'));
  await expect(page.locator('#pf-res')).toContainText('单件净利润');
  await expect(page.locator('#sc-res')).toContainText('综合评分');
  await expect(page.locator('#st-res')).toContainText('建议备货量');

  await page.evaluate(() => window.switchPage('report'));
  await expect(page.locator('#report .rp-v2-tpl-card.selected')).toHaveAttribute('data-tpl', 'product-research');
  await expect(page.locator('#rp-v2-pool-body')).toContainText('暂无素材');
  await expect(page.locator('#rp-v2-next-btn')).toBeEnabled();
  await page.locator('#rp-v2-next-btn').click();
  await expect(page.locator('#rp-v2-topic')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-report-workspace.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#rp-v2-topic')).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-report-workspace-mobile.png'), fullPage: true });
});

test('alert center renders scoped source data with real pagination and filters', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => window.switchPage('alerts'));

  await expect(page.locator('#al-list .al-card')).toHaveCount(10, { timeout: 15_000 });
  await expect(page.locator('#al-data-info')).toContainText('来源:', { timeout: 15_000 });
  await page.waitForFunction(() => window.policiesJsonData && window.rulesJsonData);
  const initial = await page.evaluate(() => ({
    total: window.getCombinedAlerts().length,
    filtered: window.getFilteredAlerts().length,
    countries: [...new Set(window.getCombinedAlerts().map((item) => item.country))],
    unread: window.getCombinedAlerts().filter((item) => !item.read).length,
    badge: Number(document.querySelector('#al-unread-badge').textContent || 0),
  }));
  expect(initial.total).toBeGreaterThan(10);
  expect(initial.filtered).toBe(initial.total);
  expect(initial.countries).toEqual(['美国']);
  expect(initial.badge).toBe(initial.filtered);
  await expect(page.locator('#al-pagination .al-page-btn')).toHaveCount(Math.ceil(initial.total / 10));

  const dynamicState = await page.evaluate(() => ({
    actual: window.dynamicAlerts.length,
    expected: window.plGetVerifiedPolicies(true).filter((item) => item.impact_level === 'high').length
      + window.rlGetJsonItems().filter((item) => item.impact_level === 'high').length,
    countries: [...new Set(window.dynamicAlerts.map((item) => item.country))],
    hasLegacyCountryData: window.dynamicAlerts.some((item) => item.source === 'country_data'),
    calendar: {
      today: window.alCalendarDayDiff('2026-08-28', new Date(2026, 7, 28, 12)),
      previous: window.alCalendarDayDiff('2026-08-25', new Date(2026, 7, 28, 12)),
      future: window.alCalendarDayDiff('2026-08-29', new Date(2026, 7, 28, 12)),
      slashDate: window.alCalendarDayDiff('2026/08/27', new Date(2026, 7, 28, 12)),
    },
    timeRanges: {
      todayIncludesToday: window.alMatchesTimeFilter('2026-08-28', 'today', new Date(2026, 7, 28, 12)),
      todayExcludesYesterday: window.alMatchesTimeFilter('2026-08-27', 'today', new Date(2026, 7, 28, 12)),
      threeDaysIncludesBoundary: window.alMatchesTimeFilter('2026-08-26', '3d', new Date(2026, 7, 28, 12)),
      threeDaysExcludesOlder: window.alMatchesTimeFilter('2026-08-25', '3d', new Date(2026, 7, 28, 12)),
      sevenDaysIncludesBoundary: window.alMatchesTimeFilter('2026-08-22', '7d', new Date(2026, 7, 28, 12)),
      sevenDaysExcludesOlder: window.alMatchesTimeFilter('2026-08-21', '7d', new Date(2026, 7, 28, 12)),
      excludesFuture: window.alMatchesTimeFilter('2026-08-29', '7d', new Date(2026, 7, 28, 12)),
      customIncludesStart: window.alMatchesTimeFilter('2026-08-26', 'custom', new Date(2026, 7, 28, 12), '2026-08-26', '2026-08-28'),
      customIncludesEnd: window.alMatchesTimeFilter('2026-08-28', 'custom', new Date(2026, 7, 28, 12), '2026-08-26', '2026-08-28'),
      customExcludesOutside: window.alMatchesTimeFilter('2026-08-25', 'custom', new Date(2026, 7, 28, 12), '2026-08-26', '2026-08-28'),
      customRejectsFuture: window.alMatchesTimeFilter('2026-08-29', 'custom', new Date(2026, 7, 28, 12), '2026-08-26', '2026-08-29'),
    },
  }));
  expect(dynamicState.actual).toBe(dynamicState.expected);
  expect(dynamicState.countries).toEqual(['美国']);
  expect(dynamicState.hasLegacyCountryData).toBe(false);
  expect(dynamicState.calendar).toEqual({ today: 0, previous: 3, future: -1, slashDate: 1 });
  expect(dynamicState.timeRanges).toEqual({
    todayIncludesToday: true,
    todayExcludesYesterday: false,
    threeDaysIncludesBoundary: true,
    threeDaysExcludesOlder: false,
    sevenDaysIncludesBoundary: true,
    sevenDaysExcludesOlder: false,
    excludesFuture: false,
    customIncludesStart: true,
    customIncludesEnd: true,
    customExcludesOutside: false,
    customRejectsFuture: false,
  });

  const firstTitle = await page.locator('#al-list .al-card-title').first().innerText();
  await page.locator('#al-pagination .al-page-btn').nth(1).click();
  await expect(page.locator('#al-list .al-card')).toHaveCount(Math.min(10, initial.total - 10));
  await expect(page.locator('#al-list .al-card-title').first()).not.toHaveText(firstTitle);

  await page.locator('#al-search-input').fill('CPSC');
  const searchTotal = await page.evaluate(() => window.getFilteredAlerts().length);
  expect(searchTotal).toBeGreaterThan(0);
  await expect(page.locator('#al-unread-badge')).toHaveText(String(searchTotal));
  await expect(page.locator('#al-list .al-card')).toHaveCount(Math.min(10, searchTotal));
  await expect(page.locator('#al-list')).toContainText('CPSC');

  await page.locator('#al-search-input').fill('');
  await page.locator('#al-filter-type').selectOption('policy');
  const policyState = await page.evaluate(() => ({
    filtered: window.getFilteredAlerts().length,
    types: [...new Set(window.getFilteredAlerts().map((item) => item.type))],
    countries: [...new Set(window.getFilteredAlerts().map((item) => item.country))],
  }));
  expect(policyState.filtered).toBeGreaterThan(0);
  expect(policyState.types).toEqual(['policy']);
  expect(policyState.countries).toEqual(['美国']);
  await expect(page.locator('#al-list .al-card')).toHaveCount(Math.min(10, policyState.filtered));
  await expect(page.locator('#al-unread-badge')).toHaveText(String(policyState.filtered));

  await expect(page.locator('#al-filter-type option')).toHaveText([
    '全部类型', '政策动态', '税收费用', '市场准入', '市场变化', '平台规则',
    '店铺异动（导入数据）', '类目变化（导入数据）',
  ]);
  expect(await page.evaluate(() => window.alertIsInConfiguredScope({ market_code: 'US', platform: '-' }))).toBe(true);
  expect(await page.evaluate(() => window.alertIsInConfiguredScope({ market_code: 'DE', platform: '-' }))).toBe(false);

  await page.locator('#al-filter-type').selectOption('all');
  await page.locator('#al-filter-time').selectOption('custom');
  await expect(page.locator('#al-custom-range')).toBeVisible();
  await page.locator('#al-date-start').fill('2026-08-01');
  await page.locator('#al-date-end').fill('2026-09-01');
  const customTotal = await page.evaluate(() => window.getFilteredAlerts().length);
  expect(customTotal).toBeGreaterThan(0);
  await expect(page.locator('#al-unread-badge')).toHaveText(String(customTotal));

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#al-search-input')).toBeVisible();
  await expect(page.locator('#al-pagination')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('decision overview is constrained to the configured US market scope', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  const metrics = page.locator('#ov-metrics .ov-metric-card');
  await expect(metrics).toHaveCount(4);
  await expect(metrics.nth(0).locator('.ov-metric-val')).toHaveText('1');
  await expect(metrics.nth(1).locator('.ov-metric-val')).toHaveText('4');
  await expect(metrics.nth(2).locator('.ov-metric-val')).not.toHaveText('—', { timeout: 15_000 });
  await expect(metrics.nth(3).locator('.ov-metric-val')).not.toHaveText('—', { timeout: 15_000 });
  const dynamicCounts = await page.evaluate(() => ({
    policies: window.plGetVerifiedPolicies(true).length,
    alerts: window.getCombinedAlerts().length,
  }));
  await expect(page.locator('#ov-metrics [data-metric="policy-count"] .ov-metric-val')).toHaveText(String(dynamicCounts.policies));
  await expect(page.locator('#ov-metrics [data-metric="alert-count"] .ov-metric-val')).toHaveText(String(dynamicCounts.alerts));
  await expect(page.locator('#ov-product-upload')).toBeVisible();
  await expect(page.locator('#ov-signal-product-title')).toContainText('尚未导入');
  await expect(page.locator('#overview')).not.toContainText('高增长类目进入观察窗口');
  await expect(page.locator('#ov-scope-summary')).toContainText('美国');
  await expect(page.locator('#ov-scope-summary')).toContainText('4 个平台');

  const countries = page.locator('#ov-country-grid .ov-ccard');
  await expect(countries).toHaveCount(1);
  await expect(countries.first()).toContainText('美国');
  await expect(countries.first()).not.toContainText(/印度尼西亚|德国|英国|日本|巴西/);

  await expect(page.locator('#ov-country-filters')).toBeHidden();
  await expect(page.locator('#ov-country-filters .ov-region-btn')).toHaveCount(0);
  expect(await page.evaluate(() => ({
    countryCount: window.JAY_MARKET_SCOPE.countryCount,
    platformCount: window.JAY_MARKET_SCOPE.platformCount,
    countries: [...document.querySelectorAll('#ov-country-grid .ov-ccard h3')].map((el) => el.textContent.trim()),
  }))).toEqual({ countryCount: 1, platformCount: 4, countries: ['美国'] });
});

test('decision overview supports multi-market scope and keeps market entry filters aligned', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  await page.evaluate(() => {
    const api = window.JAY_MARKET_SCOPE_API;
    api.registerPlatform({ key: 'otto', name: 'Otto', aliases: ['otto'], kind: 'marketplace' });
    api.registerMarket({
      code: 'DE', key: 'de', name: '德国', label: '德国市场', flag: '🇩🇪', aliases: ['de', '德国'],
      regionCode: 'EU', regionName: '欧洲', jurisdictionCodes: ['DE'],
      platformKeys: ['otto'], categoryKeys: [], dataStatus: 'configured',
    }, [{ marketCode: 'DE', platformKey: 'otto', status: 'active', dataStatus: 'configured', label: '德国站' }]);
  });

  await page.locator('#ov-market-scope-toggle').click();
  await expect(page.locator('#ov-market-scope-options input')).toHaveCount(3);
  expect(await page.locator('#ov-market-scope-options input').evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual(['US', 'ID', 'DE']);
  await page.locator('#ov-market-scope-options input[value="DE"]').check();
  await page.locator('#ov-market-scope-apply').click();

  await expect(page.locator('#ov-market-scope-toggle')).toContainText('2 个市场');
  await expect(page.locator('label[for="jay-market-selector"] span')).toHaveText('主市场');
  await expect(page.locator('#ov-metrics [data-metric="country-count"] .ov-metric-val')).toHaveText('2');
  await expect(page.locator('#ov-metrics [data-metric="platform-count"] .ov-metric-val')).toHaveText('5');
  await expect(page.locator('#ov-scope-summary')).toContainText('美国、德国');
  await expect(page.locator('#jay-platform-selector option')).toHaveText(['全部平台', 'Amazon', 'TikTok Shop', 'AliExpress', 'eBay', 'Otto']);
  await expect(page.locator('#ov-country-grid .ov-ccard')).toHaveCount(2);

  await expect(page.locator('#ov-metrics [data-metric="policy-count"] .ov-metric-val')).not.toHaveText('—', { timeout: 15_000 });
  const policyCount = await page.locator('#ov-metrics [data-metric="policy-count"] .ov-metric-val').textContent();
  await page.locator('#ov-metrics [data-metric="policy-count"]').click();
  await expect(page.locator('#pl-f-region')).toHaveValue('all');
  await expect(page.locator('#pl-f-scope')).toHaveValue('cross-border');
  await expect(page.locator('#pl-filter-count')).toContainText(`${policyCount} 条政策`);

  const resetMultiScope = async () => page.evaluate(() => {
    window.JAY_MARKET_SCOPE_API.setActiveMarkets(['US', 'DE']);
    window.switchPage('overview');
  });
  await resetMultiScope();
  await page.locator('#ov-country-grid .ov-ccard[data-market-code="DE"] [data-destination="tax"]').click();
  await expect(page.locator('#policies')).toHaveClass(/active/);
  await expect(page.locator('#pl-f-region')).toHaveValue('DE');
  await expect(page.locator('#pl-f-category')).toHaveValue('all');
  expect(await page.evaluate(() => window.plActiveDomain)).toBe('tax');

  await resetMultiScope();
  await page.locator('#ov-country-grid .ov-ccard[data-market-code="DE"] [data-destination="access"]').click();
  await expect(page.locator('#policies')).toHaveClass(/active/);
  await expect(page.locator('#pl-f-region')).toHaveValue('DE');
  expect(await page.evaluate(() => window.plActiveDomain)).toBe('access');

  await resetMultiScope();
  await page.locator('#ov-country-grid .ov-ccard[data-market-code="DE"] [data-destination="rules"]').click();
  await expect(page.locator('#rules')).toHaveClass(/active/);
  await expect(page.locator('#rl-market')).toHaveValue('DE');
  await expect(page.locator('#rl-platform')).toHaveValue('all');

  await resetMultiScope();
  await page.locator('#ov-country-grid .ov-ccard[data-market-code="DE"] [data-destination="report"]').click();
  await expect(page.locator('#report')).toHaveClass(/active/);
  expect(await page.evaluate(() => window.JAY_MARKET_SCOPE.marketCodes)).toEqual(['DE']);
  await expect(page.locator('label[for="jay-market-selector"] span')).toHaveText('当前市场');
  expect(pageErrors).toEqual([]);
});

test('platform archive and watchlist do not expose retired global records', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  await page.evaluate(() => window.switchPage('platforms'));
  await expect(page.locator('#platforms .platform-card[data-platform]')).toHaveCount(4);
  await expect(page.locator('#platforms')).not.toContainText(/Walmart|SHEIN|Temu|Shopee|Lazada|Noon/);
  expect(await page.locator('#platforms .platform-card[data-platform]').evaluateAll((cards) => cards.map((card) => card.dataset.platform))).toEqual([
    'Amazon', 'AliExpress', 'TikTok Shop', 'eBay',
  ]);
  await expect(page.locator('#platforms .platform-source-note')).toContainText('统一市场配置');
  await expect(page.locator('#platforms .platform-rule-status')).toHaveCount(4);
  await expect(page.locator('#platforms .platform-rule-status b').first()).toHaveText(/条|暂无已验证数据/, { timeout: 15_000 });

  await page.evaluate(() => window.switchPage('content'));
  await expect(page.locator('#content-resource-empty')).toContainText('暂无已接入资源');

  await page.evaluate(() => window.switchPage('watchlist'));
  await expect(page.locator('#watch-grid')).toContainText('暂无已保存的关注项');
  await expect(page.locator('#wl-alert-banner')).toContainText('当前所有监控赛道、店铺运行平稳');
  await expect(page.locator('#wl-rec-cards')).toContainText('暂无经过验证的推荐关注项');
  await expect(page.locator('#watchlist')).not.toContainText(/印尼|巴西|越南|GLOW LAB|TECHZONE/);
  await expect(page.locator('#watchlist .wl-sum-num')).toHaveText(['0', '0', '0', '—']);
  await expect(page.locator('#wl-group-sel option')).toHaveText(['美国市场（当前范围）']);
  await expect(page.locator('#wl-group-sel')).toHaveValue('us-market');

  await page.locator('#add-watch').click();
  await expect(page.locator('#wl-modal-overlay')).toBeVisible();
  await page.locator('#wl-modal-overlay .wl-modal-tab[data-mtab="template"]').click();
  await expect(page.locator('#wl-modal-content')).toContainText('当前工作区没有已验证的看板模板');
  await expect(page.locator('#wl-modal-content')).not.toContainText(/东南亚|Temu|菲律宾|马来西亚/);
  await page.locator('#wl-modal-overlay .wl-modal-tab[data-mtab="search"]').click();
  await page.locator('#wl-search-input').fill('Amazon');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('#wl-search-results')).toContainText('未找到已验证的美国市场记录');
  await expect(page.locator('#wl-search-results')).not.toContainText(/ANKER|Temu|菲律宾/);
});

test('report and operating tools stay within the configured US scope', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  await page.evaluate(() => window.switchPage('tools'));
  await expect(page.locator('#sc-market option')).toHaveText(['美国']);
  await expect(page.locator('#sc-market')).toHaveValue('US');
  await expect(page.locator('#sc-res')).toContainText('综合评分');
  await expect(page.locator('#tools')).not.toContainText(/东南亚|北美|欧洲|中东|拉美|日韩/);

  await page.evaluate(() => window.switchPage('report'));
  await page.locator('#rp-v2-next-btn').click();
  await expect(page.locator('#rp-v2-topic')).toHaveAttribute('placeholder', /美国/);
  await page.locator('#rp-v2-topic').fill('宠物用品');
  await page.getByRole('button', { name: '生成报告', exact: true }).click();
  await expect(page.locator('#rp-questionnaire')).toHaveClass(/show/);
  await expect(page.locator('#rp-q-market option')).toHaveText(['美国']);
  await expect(page.locator('#rp-q-market')).toHaveValue('US');
  await expect(page.locator('#rp-panel-step3 button[onclick*="docx"]')).toHaveCount(1);
  await expect(page.locator('#rp-v2-export-history')).toContainText('暂无导出记录');
  await expect(page.locator('#report')).not.toContainText(/东南亚|北美|欧洲|中东|拉美|日韩|印尼/);

  expect(await page.evaluate(() => ({
    usCountry: window.wlIsConfiguredScopeRow({ item_type: 'country', item_id: 'usa', item_name: '美国' }),
    usPlatform: window.wlIsConfiguredScopeRow({ item_type: 'platform', item_id: 'amazon', item_name: 'Amazon' }),
    retiredCountry: window.wlIsConfiguredScopeRow({ item_type: 'country', item_id: 'indonesia', item_name: '印度尼西亚' }),
    retiredPlatform: window.wlIsConfiguredScopeRow({ item_type: 'platform', item_id: 'shopee', item_name: 'Shopee' }),
    globalReport: window.rpReportInConfiguredScope({ name: '全球市场调研报告', text: '' }),
    usReport: window.rpReportInConfiguredScope({ name: '美国市场调研报告', market: 'US', text: '' }),
  }))).toEqual({
    usCountry: true,
    usPlatform: true,
    retiredCountry: false,
    retiredPlatform: false,
    globalReport: false,
    usReport: true,
  });
});

test('platform rules are filtered to the US market and supported platforms', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => window.switchPage('rules'));
  const initialAiText = await page.locator('#ai-rules').innerText();
  expect(initialAiText).toContain('规则变动洞察');
  expect(initialAiText).not.toMatch(/东南亚|北美|欧洲|全球/);
  await expect(page.locator('#rl-data-info')).toContainText('美国市场规则');

  await expect(page.locator('#rl-platform option')).toHaveCount(5);
  await expect(page.locator('#rl-platform option')).toHaveText([
    '全部平台', 'Amazon', 'TikTok Shop', 'AliExpress', 'eBay',
  ]);
  await expect(page.locator('#rl-market option')).toHaveText(['当前范围全部市场', '美国']);
  await expect(page.locator('#rl-market')).toHaveValue('US');

  const rules = page.locator('#rl-rules-list .rl-rule-card');
  await expect(rules).toHaveCount(5);
  const ruleRows = await rules.evaluateAll((cards) => cards.map((card) => ({
    text: card.textContent,
    platform: card.querySelector('.rl-card-meta span:nth-child(3)')?.textContent.trim(),
  })));
  expect(ruleRows.every((row) => row.text.includes('美国'))).toBe(true);
  expect(ruleRows.every((row) => ['Amazon', 'TikTok Shop', 'AliExpress', 'eBay'].includes(row.platform))).toBe(true);
  expect(await page.locator('#rl-rules-list').innerText()).not.toContain('全球');

  await page.locator('#rl-platform').selectOption('Amazon');
  await page.locator('#apply-rl').click();
  await expect(page.locator('#rl-rules-list .rl-rule-card')).toHaveCount(2);
  await expect(page.locator('#rl-count')).toContainText('规则 2 条');
  await expect(page.locator('#rl-rules-list')).not.toContainText('TikTok Shop');

  await page.locator('#rl-rules-list .rl-rule-card').first().getByRole('button', { name: '查看详情' }).click();
  const ruleDetail = page.locator('.rl-detail-overlay').last();
  await expect(ruleDetail.locator('[data-rule-field]')).toHaveCount(7);
  await expect(ruleDetail).toContainText('费用');
  await expect(ruleDetail).toContainText('佣金');
  await expect(ruleDetail).toContainText('保证金');
  await expect(ruleDetail).toContainText('履约');
  await expect(ruleDetail).toContainText('禁售');
  await expect(ruleDetail).toContainText('结算');
  await expect(ruleDetail).toContainText('处罚');
  await expect(ruleDetail).toContainText('版本与历史变化');
  await expect(ruleDetail).toContainText('暂无已验证历史版本记录');
  await ruleDetail.locator('.close-btn').click();
});

test('policy dynamics are constrained to the configured US market', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => window.switchPage('policies'));

  await expect(page.locator('#pl-data-info')).toContainText('美国市场');
  await expect(page.locator('#pl-f-region option')).toHaveCount(2);
  await expect(page.locator('#pl-f-region option')).toHaveText(['全部地区', '美国']);
  await expect(page.locator('#pl-f-region')).toHaveValue('US');
  await expect(page.locator('#pl-f-scope')).toHaveValue('cross-border');

  const policyCards = page.locator('#pl-list .pl-card');
  await expect(policyCards).toHaveCount(10);
  const policyTotal = await page.evaluate(() => window.plGetJsonItems().length);
  expect(policyTotal).toBeGreaterThan(10);
  await expect(page.locator('#pl-filter-count')).toContainText(`${policyTotal} 条政策`);
  await expect(page.locator('#pl-stats-row')).toContainText('跨境经营相关');
  await expect(page.locator('#pl-list')).toContainText('美国');
  expect(await page.locator('#pl-list .pl-country-tag').allTextContents()).toEqual(
    Array(10).fill('美国'),
  );
  await expect(page.locator('#pl-list')).not.toContainText('Loan Performance Categories');
  await expect(page.locator('#pl-list')).not.toContainText('Bangor-Pacific Hydro Associates');
  await expect(page.locator('#pl-list')).not.toContainText('FLSA Claims and Compliance');
  await expect(page.locator('#pl-list')).not.toContainText('Qualification and Certification of Locomotive Engineers');
  await expect(page.locator('#pl-list')).not.toContainText('Application(s) for Duty-Free Entry of Scientific Instruments');
  await expect(page.locator('#pl-list')).not.toContainText('示意性数据');
  await expect(page.locator('#pl-list')).not.toContainText('40 · 低可信');
  await expect(page.locator('#pl-list .pl-verify-badge.pass').first()).toBeVisible();
  await expect(page.locator('#pl-list .pl-translation-badge')).toHaveCount(10);
  await expect(page.locator('#pl-list .pl-relevance-tag').first()).toContainText(/跨境|贸易/);
  await expect(page.locator('#pl-list .pl-relevance-tag').first()).toHaveAttribute('title', /相关性判断/);
  await expect(page.locator('#pl-list .pl-meta a')).toHaveCount(10);
  await expect(page.locator('#pl-verify-bar')).toContainText('依据：记录链接 + 验证状态 + 日期');
  await expect(page.locator('#pl-verify-bar small')).toHaveAttribute('title', /官方或已复核可追溯记录/);
  expect(await page.locator('#pl-verify-bar').evaluate((node) => node.getBoundingClientRect().height)).toBeLessThan(70);

  const policyState = await page.evaluate(() => ({
    sourceCount: window.plGetJsonItems().length,
    regions: [...new Set(window.plGetJsonItems().map((item) => item.region))],
    scores: [...new Set(window.plGetJsonItems().slice(0, 20).map((item) => item.credibility_score))],
    verifyIssues: [...new Set(window.plGetJsonItems().slice(0, 20).map((item) => (item._verifyIssues || []).length))],
    chineseReady: window.plGetJsonItems().every((item) => /[\u3400-\u9fff]/.test(item.title_zh || '')
      && ['source_zh', 'translated', 'reviewed'].includes((item.translation || {}).status)),
    homepageEvidence: window.plAssessEvidence({
      title: '首页来源不应核验', source_url: 'https://ustr.gov/',
      published_at: '2026-08-27', collected_at: '2026-08-27T09:00:00+08:00',
    }),
    specificEvidence: window.plAssessEvidence({
      title: '具体记录应可核验', source_url: 'https://www.federalregister.gov/documents/2026/08/26/2026-17437/international-trademark-classification-changes',
      published_at: '2026-08-26', collected_at: '2026-08-27T09:00:00+08:00',
    }),
    spoofedDomainEvidence: window.plAssessEvidence({
      title: '伪造官方域名不应核验', source_url: 'https://agency.gov.attacker.com/documents/policy',
      published_at: '2026-08-26', collected_at: '2026-08-27T09:00:00+08:00',
    }),
    duplicateEvidence: window.plAssessEvidenceForSet({
      title: '重复来源一', source_url: 'https://www.federalregister.gov/documents/2026/08/26/2026-17437/international-trademark-classification-changes',
      published_at: '2026-08-26', collected_at: '2026-08-27T09:00:00+08:00',
    }, [
      { source_url: 'https://www.federalregister.gov/documents/2026/08/26/2026-17437/international-trademark-classification-changes' },
      { source_url: 'https://www.federalregister.gov/documents/2026/08/26/2026-17437/international-trademark-classification-changes' },
    ]),
    relevance: {
      direct: window.plAssessPolicyRelevance({ title: 'US CPSC consumer product safety filing' }).flag,
      productCertification: window.plAssessPolicyRelevance({ title: 'Product Certification and Safety Standards for Imported Goods' }).flag,
      industry: window.plAssessPolicyRelevance({ title: 'List of approved nuclear fuel storage casks' }).flag,
      unrelated: window.plAssessPolicyRelevance({ title: 'Loan Performance Categories and Financial Reporting' }).flag,
      genericCompliance: window.plAssessPolicyRelevance({ title: 'FLSA Claims and Compliance' }).flag,
      genericCertification: window.plAssessPolicyRelevance({ title: 'Water Quality Certification Application' }).flag,
      genericRailCertification: window.plAssessPolicyRelevance({ title: 'Qualification and Certification of Locomotive Engineers' }).flag,
    },
  }));
  expect(policyState.sourceCount).toBe(policyTotal);
  expect(policyState.regions).toEqual(['US']);
  expect(policyState.scores).toEqual([100]);
  expect(policyState.verifyIssues).toEqual([0]);
  expect(policyState.chineseReady).toBe(true);
  expect(policyState.homepageEvidence.flag).not.toBe('pass');
  expect(policyState.homepageEvidence.issues).toContain('来源链接指向官网首页，无法定位具体政策记录');
  expect(policyState.specificEvidence.flag).toBe('pass');
  expect(policyState.spoofedDomainEvidence.flag).not.toBe('pass');
  expect(policyState.spoofedDomainEvidence.issues).toContain('来源未满足官方或已复核可追溯条件');
  expect(policyState.duplicateEvidence.flag).not.toBe('pass');
  expect(policyState.relevance).toEqual({
    direct: 'direct',
    productCertification: 'direct',
    industry: 'industry',
    unrelated: 'industry',
    genericCompliance: 'industry',
    genericCertification: 'industry',
    genericRailCertification: 'industry',
  });

  await page.locator('#pl-f-scope').selectOption('all-us');
  const allUsTotal = await page.evaluate(() => window.plGetJsonItems().length);
  expect(allUsTotal).toBeGreaterThan(policyTotal);
  await expect(page.locator('#pl-filter-count')).toContainText(`${allUsTotal} 条政策`);
  await expect(page.locator('#pl-stats-row')).toContainText('当前市场已核验');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#pl-f-scope').selectOption('cross-border');
  await expect(page.locator('#pl-list .pl-card').first()).toBeVisible();
  expect(await page.locator('#pl-verify-bar').evaluate((node) => node.getBoundingClientRect().height)).toBeLessThan(70);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test('third-party industry news is visible as traceable reference only', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => window.switchPage('policies'));
  await page.waitForFunction(() => window.policiesJsonData && window.policiesJsonData.items && window.policiesJsonData.items.length > 0);
  await expect(page.locator('#pl-f-scope')).toHaveValue('cross-border');
  await page.locator('#pl-f-scope').selectOption('industry');

  const state = await page.evaluate(() => {
    const records = window.plGetIndustryPolicyRecords();
    const formal = window.plGetVerifiedPolicies(true);
    return {
      count: records.length,
      records: records.map((item) => ({
        source: item.source,
        title: item.title_zh,
        market: item._display_market_code,
        advisory: item._advisory === true,
        evidence: item._evidence && item._evidence.label,
        normalized: window.JAY_MARKET_SCOPE_API.normalizeDataRecord(item, 'policy'),
      })),
      formalHasAdvisory: formal.some((item) => window.plIsIndustryAdvisory(item)),
    };
  });
  expect(state.count).toBeGreaterThan(0);
  expect(state.records.every((item) => item.advisory && item.market === 'US')).toBe(true);
  expect(state.records.every((item) => ['雨果网', 'AMZ123'].includes(item.source))).toBe(true);
  expect(state.records.every((item) => item.evidence === '可追溯参考 · 非官方核验')).toBe(true);
  expect(state.records.every((item) => item.normalized.source_kind === 'traceable')).toBe(true);
  expect(state.records.every((item) => item.normalized.verification_status !== 'verified')).toBe(true);
  expect(state.formalHasAdvisory).toBe(false);
  await expect(page.locator('#pl-list .pl-card')).toHaveCount(Math.min(10, state.count));
  await expect(page.locator('#pl-list')).toContainText('可追溯参考');
  await expect(page.locator('#pl-list')).toContainText('第三方行业资讯');
  await expect(page.locator('#pl-list')).not.toContainText('40 · 低可信');
  await expect(page.locator('#pl-stats-row')).toContainText('可追溯参考，不纳入正式政策统计');
  expect(pageErrors).toEqual([]);
});

test('tax and market-access domains stay independent and honest when empty', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => window.switchPage('policies'));

  await page.locator('#policies .pl-domain-tab[data-domain="tax"]').click();
  expect(await page.evaluate(() => window.plActiveDomain)).toBe('tax');
  await expect(page.locator('#pl-f-category option')).toHaveText(['全部类别', '关税', '进口费用', '平台代扣税', '销售税', '增值税']);
  await expect(page.locator('#pl-f-scope')).toBeDisabled();
  await expect(page.locator('#pl-list .pl-card')).toHaveCount(0);
  await expect(page.locator('#pl-empty')).toContainText('税收数据尚未接入');

  await page.locator('#policies .pl-domain-tab[data-domain="access"]').click();
  expect(await page.evaluate(() => window.plActiveDomain)).toBe('access');
  await expect(page.locator('#pl-f-category option')).toHaveText(['全部类别', '认证', '进口要求', '知识产权', '标签', '包装', '注册']);
  await expect(page.locator('#pl-list .pl-card')).toHaveCount(0);
  await expect(page.locator('#pl-empty')).toContainText('准入条件尚未接入');
});

test('cross-page entries preserve the configured market and platform filters', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  const routeFromMetric = async (metric, pageId) => {
    await page.evaluate(() => window.switchPage('overview'));
    await page.locator(`#ov-metrics [data-metric="${metric}"]`).click();
    await expect(page.locator(`#${pageId}`)).toHaveClass(/active/);
  };
  await routeFromMetric('country-count', 'countries');
  await routeFromMetric('platform-count', 'platforms');
  await routeFromMetric('alert-count', 'alerts');
  await expect(page.locator('#al-filter-type')).toHaveValue('all');
  await expect(page.locator('#al-filter-level')).toHaveValue('all');
  await expect(page.locator('#al-filter-time')).toHaveValue('all');
  await routeFromMetric('policy-count', 'policies');
  await expect(page.locator('#pl-f-region')).toHaveValue('US');
  await expect(page.locator('#pl-f-scope')).toHaveValue('cross-border');

  await page.evaluate(() => window.switchPage('overview'));
  await page.locator('#ov-country-grid .ov-ccard-btn[data-destination="policies"]').click();
  await expect(page.locator('#policies')).toHaveClass(/active/);
  await expect(page.locator('#pl-f-region')).toHaveValue('US');
  await expect(page.locator('#pl-f-scope')).toHaveValue('cross-border');

  await page.evaluate(() => window.switchPage('platforms'));
  await page.locator('#platforms .platform-card[data-platform="Amazon"]').click();
  await expect(page.locator('#rules')).toHaveClass(/active/);
  await expect(page.locator('#rl-platform')).toHaveValue('Amazon');
  await expect(page.locator('#rl-market')).toHaveValue('US');
  await expect(page.locator('#rl-rules-list .rl-rule-card')).toHaveCount(2);

  await page.evaluate(() => window.switchPage('countries'));
  await page.evaluate(() => window.switchPage('rules'));
  await expect(page.locator('#rl-platform')).toHaveValue('Amazon');
  await expect(page.locator('#rl-market')).toHaveValue('US');
  await expect(page.locator('#rl-rules-list .rl-rule-card')).toHaveCount(2);

  await page.evaluate(() => window.jayOpenPolicyFilter({
    region: 'US', category: 'tariff', impact: 'high', scope: 'all-us',
  }));
  await expect(page.locator('#pl-f-region')).toHaveValue('US');
  await expect(page.locator('#pl-f-category')).toHaveValue('tariff');
  await expect(page.locator('#pl-f-impact')).toHaveValue('high');
  await expect(page.locator('#pl-f-scope')).toHaveValue('all-us');
  await page.evaluate(() => window.switchPage('platforms'));
  await page.evaluate(() => window.switchPage('policies'));
  await expect(page.locator('#pl-f-region')).toHaveValue('US');
  await expect(page.locator('#pl-f-category')).toHaveValue('tariff');
  await expect(page.locator('#pl-f-impact')).toHaveValue('high');
  await expect(page.locator('#pl-f-scope')).toHaveValue('all-us');

  await page.getByRole('button', { name: '重置' }).click();
  await page.evaluate(() => window.switchPage('countries'));
  await page.evaluate(() => window.switchPage('policies'));
  await expect(page.locator('#pl-f-region')).toHaveValue('US');
  await expect(page.locator('#pl-f-category')).toHaveValue('all');
  await expect(page.locator('#pl-f-impact')).toHaveValue('all');
  await expect(page.locator('#pl-f-scope')).toHaveValue('cross-border');
  expect(pageErrors).toEqual([]);
});

test('settings exposes only real account, preference, and service states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => window.switchPage('settings'));

  await expect(page.locator('#settings .st-side-btn')).toHaveCount(5);
  await expect(page.locator('#st-tab-account')).toContainText('Supabase Auth');
  await expect(page.locator('#settings')).not.toContainText('MacBook Pro');
  await expect(page.locator('#settings')).not.toContainText('演示账户体系');
  await page.locator('.st-side-btn[data-st-tab="team"]').click();
  await expect(page.locator('#st-workspace-unavailable')).toContainText('只读演示模式不加载团队数据');
  await page.locator('.st-side-btn[data-st-tab="system"]').click();
  await expect(page.locator('#st-system-quality')).toContainText(/(?:数据)?(?:实时|过期|部分降级|校验失败|读取中)/);
  await expect(page.locator('#st-tab-system .st-status-item')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-settings-real.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#st-tab-system .st-status-item').last()).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-settings-real-mobile.png'), fullPage: true });
});

test('authenticated user data writes use the session token', async ({ page }) => {
  let requestRecord = null;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.route('**/rest/v1/user_preferences*', async (route) => {
    const request = route.request();
    requestRecord = {
      method: request.method(),
      headers: request.headers(),
      body: request.postDataJSON(),
    };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify([{
        user_id: '11111111-1111-4111-8111-111111111111',
        notification_prefs: {},
        ui_prefs: {},
        workspace_prefs: { role: 'ops' },
      }]),
    });
  });

  const saved = await page.evaluate(async () => {
    window.jayIsDemo = false;
    window.jayUser = { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.com' };
    window.supabaseClient = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'test-access-token' } } }),
      },
    };
    return window.saveUserPreferences({ workspace_prefs: { role: 'ops' } });
  });

  expect(saved).toBe(true);
  expect(requestRecord.method).toBe('POST');
  expect(requestRecord.headers.authorization).toBe('Bearer test-access-token');
  expect(requestRecord.body.user_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(requestRecord.body.workspace_prefs).toEqual({ role: 'ops' });
});

test('workspace assets validate payloads, stay read-only in demo, and serialize writes', async ({ page }) => {
  const requests = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.route('**/rest/v1/saved_workspace_items*', async (route) => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    const request = route.request();
    const body = request.postDataJSON();
    requests.push({
      method: request.method(),
      headers: request.headers(),
      body,
    });
    if (requests.length === 1) await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify([{ ...body, id: `asset-${requests.length}` }]),
    });
    activeRequests -= 1;
  });

  expect(await page.evaluate(() => window.jaySaveWorkspaceAsset('product_filter_templates', [{ name: '演示模板' }]))).toBe(false);
  expect(requests).toEqual([]);

  const result = await page.evaluate(async () => {
    window.jayIsDemo = false;
    window.jayUser = { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.com' };
    window.supabaseClient = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'workspace-token' } } }),
      },
    };
    const invalid = await window.jaySaveWorkspaceAsset('product_filter_templates', { name: '错误类型' });
    const first = window.jaySaveWorkspaceAsset('product_filter_templates', [{ name: '第一版' }]);
    const second = window.jaySaveWorkspaceAsset('product_filter_templates', [{ name: '第二版' }]);
    return {
      invalid,
      saved: await Promise.all([first, second]),
      cached: window.jayGetWorkspaceAsset('product_filter_templates', []),
      pending: localStorage.getItem(`jay_workspace_assets_pending_${window.jayUser.id}`),
    };
  });

  expect(result.invalid).toBe(false);
  expect(result.saved).toEqual([true, true]);
  expect(result.cached).toEqual([{ name: '第二版' }]);
  expect(result.pending).toBeNull();
  expect(requests).toHaveLength(2);
  expect(maxActiveRequests).toBe(1);
  expect(requests.map((request) => request.body.content[0].name)).toEqual(['第一版', '第二版']);
  for (const request of requests) {
    expect(request.method).toBe('POST');
    expect(request.headers.authorization).toBe('Bearer workspace-token');
    expect(request.body.user_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(request.body.item_type).toBe('product_filter_templates');
    expect(request.body.client_id).toBe('default');
  }
});

test('data trust center reports the publish gate on desktop and mobile', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => window.switchPage('data'));

  await expect(page.locator('#data-quality-badge')).toContainText(/(?:数据)?(?:实时|过期|部分降级|校验失败|读取中)/);
  const qualityDatasetCount = await page.evaluate(() => Object.keys((window.JAY_QUALITY_REPORT || {}).datasets || {}).length);
  expect(qualityDatasetCount).toBeGreaterThan(0);
  await expect(page.locator('#data-quality-rows tr')).toHaveCount(qualityDatasetCount);
  await expect(page.locator('#shell-data-status')).toContainText(/(?:数据)?(?:实时|过期|部分降级|校验失败|读取中)/);
  const qualitySummary = await page.evaluate(() => {
    const report = window.JAY_QUALITY_REPORT || {};
    return {
      errors: Number(report.summary?.errors || 0),
      warnings: Number(report.summary?.warnings || 0),
    };
  });
  await expect(page.locator('#dq-errors')).toHaveText(String(qualitySummary.errors));
  await expect(page.locator('#dq-warnings')).toHaveText(String(qualitySummary.warnings));
  await expect(page.locator('#dq-raw-records')).toHaveText(/^\d+$/);
  await expect(page.locator('#dq-scoped-records')).toHaveText(/^\d+$/);
  const qualityCounts = await page.evaluate(() => ({
    raw: Number(document.getElementById('dq-raw-records').textContent),
    scoped: Number(document.getElementById('dq-scoped-records').textContent),
  }));
  expect(qualityCounts.raw).toBeGreaterThan(qualityCounts.scoped);
  const countryQualityRow = page.locator('#data-quality-rows tr').filter({ hasText: '国家市场' });
  await expect(countryQualityRow.locator('td').nth(2)).toHaveText(/^\d+$/);
  await expect(countryQualityRow.locator('td').nth(3)).toHaveText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-data-quality-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  expect((await page.locator('aside.sidebar').boundingBox()).x).toBeLessThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#data .data-quality-table-wrap')).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-data-quality-mobile.png'), fullPage: true });
});

test('category opportunities use only validated user-imported records', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => window.switchPage('products'));

  await expect(page.locator('#pr-data-status')).toHaveText('暂无已导入的类目数据');
  await expect(page.locator('#pr-count')).toContainText('暂无已导入数据');
  await expect(page.locator('#pr-table-body')).toContainText('请先上传 CSV 或 JSON 文件');
  await expect(page.locator('#pr-ai-content')).toContainText('上传 CSV 或 JSON 后才会生成机会判断');
  expect(await page.evaluate(() => ({ products: products.length, shops: shops.length }))).toEqual({ products: 0, shops: 0 });

  await page.evaluate(() => window.switchPage('shops'));
  await expect(page.locator('#sh-count')).toHaveText('(0/0)');
  await expect(page.locator('#shop-table')).toContainText('暂无已导入的店铺数据');
  await expect(page.locator('#sh-ai-content')).toContainText('暂无已导入的店铺数据');
  await expect(page.locator('#shops')).not.toContainText(/Medicube|BIBIDO|Rejuran|HomeGadgets|Xiaomi Official/);
  await page.evaluate(() => window.switchPage('products'));

  const csv = [
    '商品名,国家,平台,类目,三级类目,售价,销量,增速,信号,店铺,上架天数,更新时间',
    '美国合规商品,美国,Amazon,家居,厨房用品,$29.99,120,+12%,上升,US Store,20,2026-08-27',
    '缺字段商品,US,eBay,宠物用品,,,,,,,',
    '非美国商品,英国,Amazon,服饰,上衣,$19.99,80,+8%,上升,UK Store,10,2026-08-27',
    '未接入平台商品,美国,Shopee,美妆,护肤,$9.99,60,+20%,爆发,Other Store,8,2026-08-27',
  ].join('\n');
  await page.locator('#pr-file-input').setInputFiles({ name: 'category-opportunities.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

  await expect(page.locator('#pr-data-status')).toContainText('已导入 2 条商品');
  await expect(page.locator('#pr-data-status')).toContainText('跳过 2 行');
  await page.locator('.pr-tab[data-tab="competitor"]').click();
  await expect(page.locator('#pr-count')).toContainText('2 / 2 条已导入数据');
  await expect(page.locator('#pr-table-body tr')).toHaveCount(2);
  await expect(page.locator('#pr-table-body')).toContainText('美国合规商品');
  await expect(page.locator('#pr-table-body')).toContainText('缺字段商品');
  await expect(page.locator('#pr-table-body')).toContainText('未提供');
  await expect(page.locator('#pr-table-body')).not.toContainText(/非美国商品|未接入平台商品/);
  await expect(page.locator('#pr-ai-content')).toContainText('仅代表导入文件的样本分布，不等同于市场机会');

  const state = await page.evaluate(() => ({
    products: products.map((row) => ({ name: row[1], market: row[2], platform: row[3] })),
    shops: shops.length,
    randomDetailData: products.some((row) => row._samePlatforms || row._links || row._trend),
  }));
  expect(state.products).toEqual([
    { name: '美国合规商品', market: '美国', platform: 'Amazon' },
    { name: '缺字段商品', market: '美国', platform: 'eBay' },
  ]);
  expect(state.shops).toBe(0);
  expect(state.randomDetailData).toBe(false);

  await page.locator('.pr-prod-link', { hasText: '缺字段商品' }).click();
  await expect(page.locator('#pr-modal-content')).toContainText('未提供 30 天销量趋势字段');
  await expect(page.locator('#pr-modal-content')).toContainText('平台数量: 未提供');
  await expect(page.locator('#pr-modal-content')).toContainText('未提供合规字段');
  await page.locator('#pr-modal-close').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-category-import.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#pr-data-import')).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), 'jay-category-import-mobile.png'), fullPage: true });

  await page.locator('#pr-clear-data').click();
  await expect(page.locator('#pr-data-status')).toHaveText('暂无已导入的类目数据');
  await expect(page.locator('#pr-table-body')).toContainText('请先上传 CSV 或 JSON 文件');

  await page.setViewportSize({ width: 1440, height: 900 });
  const shopPayload = JSON.stringify({
    shops: [
      { 店铺名: 'US Honest Store', 国家: '美国', 平台: 'Amazon', 主营类目: '家居' },
      { 店铺名: 'Out Of Scope Store', 国家: '日本', 平台: 'Amazon', 主营类目: '家居' },
    ],
  });
  await page.locator('#pr-file-input').setInputFiles({ name: 'shops.json', mimeType: 'application/json', buffer: Buffer.from(shopPayload) });
  await expect(page.locator('#pr-data-status')).toContainText('1 家店铺');
  await expect(page.locator('#pr-data-status')).toContainText('跳过 1 行');
  await page.evaluate(() => window.switchPage('shops'));
  await expect(page.locator('#shop-table tr')).toHaveCount(1);
  await expect(page.locator('#shop-table')).toContainText('US Honest Store');
  await expect(page.locator('#shop-table')).toContainText('未提供');
  await expect(page.locator('#shop-table')).not.toContainText('Out Of Scope Store');
  await expect(page.locator('#sh-ai-content')).toContainText('当前文件包含 1 家店铺');
  await page.locator('.sh-shop-link').click();
  await expect(page.locator('#sh-modal-body')).toContainText('系统不会估算');
  await expect(page.locator('#sh-modal-body')).toContainText('未提供可验证的时间序列');
  await expect(page.locator('#sh-modal-body')).not.toContainText(/爆款A|客单价|流量结构拆解/);
  await page.evaluate(() => window.switchPage('products'));
  await page.locator('#pr-clear-data').click();
  expect(pageErrors).toEqual([]);
});

test('uploaded catalog cache is account-scoped and service errors are explicit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  const state = await page.evaluate(() => {
    window.jayIsDemo = true;
    window.jayUser = { id: 'account-a', email: 'a@example.com' };
    window.prResetImportedDataForAuthChange();
    window.prImportPayload({ products: [{
      商品名: '账号A商品', 国家: '美国', 平台: 'Amazon', 类目: '家居',
      售价: '$19.99', 销量: '10', 更新时间: '2026-09-01',
    }] }, 'account-a.csv');
    const accountAKey = window.prImportedDataKey();
    const accountAStored = !!localStorage.getItem(accountAKey);

    window.prResetImportedDataForAuthChange();
    window.jayUser = { id: 'account-b', email: 'b@example.com' };
    const accountBRestored = window.prRestoreImportedData();
    const accountBCount = products.length;

    window.jayUser = { id: 'account-a', email: 'a@example.com' };
    const accountARestored = window.prRestoreImportedData();
    const accountAProducts = products.map((row) => row[1]);
    const context = window.rpV2ReportContext('家居');
    const firstIdentity = window.rpV2GenerationIdentity(context, '家居', []);
    const secondIdentity = window.rpV2GenerationIdentity(context, '家居', []);
    window.prPurgeImportedDataForUser('account-a');
    return {
      accountAKey, accountAStored, accountBRestored, accountBCount, accountARestored, accountAProducts,
      retiredKey: localStorage.getItem('jay_product_catalog_import_v1'),
      errors: {
        unauthorized: window.jayServiceErrorText({ status: 401 }),
        forbidden: window.jayServiceErrorText({ status: 403 }),
        limited: window.jayServiceErrorText({ status: 429 }),
        timeout: window.jayServiceErrorText({ code: 'REQUEST_TIMEOUT', status: 408 }),
        quota: window.jayServiceErrorText({ code: 'AI_QUOTA_EXCEEDED', status: 402 }),
        server: window.jayServiceErrorText({ status: 503 }),
      },
      identitiesMatch: firstIdentity.idempotencyKey === secondIdentity.idempotencyKey,
      purgedOnSignOut: localStorage.getItem(accountAKey) === null && products.length === 0,
    };
  });

  expect(state.accountAKey).toBe('jay_product_catalog_import_v2_account-a');
  expect(state.accountAStored).toBe(true);
  expect(state.accountBRestored).toBe(false);
  expect(state.accountBCount).toBe(0);
  expect(state.accountARestored).toBe(true);
  expect(state.accountAProducts).toEqual(['账号A商品']);
  expect(state.retiredKey).toBeNull();
  expect(state.errors.unauthorized).toContain('重新登录');
  expect(state.errors.forbidden).toContain('没有执行此操作的权限');
  expect(state.errors.limited).toContain('请求过于频繁');
  expect(state.errors.timeout).toContain('请求超时');
  expect(state.errors.quota).toContain('额度不足');
  expect(state.errors.server).toContain('服务暂时不可用');
  expect(state.identitiesMatch).toBe(true);
  expect(state.purgedOnSignOut).toBe(true);
});

test('market scope can register and switch to a market-specific platform set', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  const state = await page.evaluate(() => {
    const api = window.JAY_MARKET_SCOPE_API;
    api.registerPlatform({ key: 'otto', name: 'Otto', aliases: ['otto'], kind: 'marketplace' });
    api.registerMarket({
      code: 'DE', key: 'de', name: '德国', label: '德国市场', aliases: ['de', '德国'],
      regionCode: 'EU', regionName: '欧洲', jurisdictionCodes: ['DE'],
      platformKeys: ['otto'], categoryKeys: [], dataStatus: 'configured',
    }, [{ marketCode: 'DE', platformKey: 'otto', status: 'active', dataStatus: 'configured', label: '德国站' }]);
    api.setActiveMarket('DE');
    return {
      markets: api.getActiveMarketNames(),
      platforms: api.getActivePlatformNames(),
      context: api.getActiveContext(),
      scope: window.JAY_MARKET_SCOPE,
    };
  });
  expect(state.markets).toEqual(['德国']);
  expect(state.platforms).toEqual(['Otto']);
  expect(state.context.marketCodes).toEqual(['DE']);
  expect(state.context.platformKeys).toEqual(['otto']);
  expect(state.scope.marketCount).toBe(1);
  expect(state.scope.platformCount).toBe(1);
});

test('market without platform relations shows an explicit platform empty state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(() => {
    const api = window.JAY_MARKET_SCOPE_API;
    api.registerMarket({
      code: 'JP', key: 'jp', name: '日本', label: '日本市场', aliases: ['jp', '日本'],
      regionCode: 'EA', regionName: '东亚', jurisdictionCodes: ['JP'],
      platformKeys: [], categoryKeys: [], dataStatus: 'configured',
    }, []);
    api.setActiveMarket('JP');
    window.switchPage('platforms');
  });
  await expect(page.locator('#platforms .platform-card:visible')).toHaveCount(0);
  await expect(page.locator('#platforms .platform-scope-empty')).toBeVisible();
  await expect(page.locator('#platforms .platform-scope-empty')).toContainText('日本市场暂无已配置平台');
});

test('visible scope controls propagate a newly registered market across workspace pages', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  await page.evaluate(() => {
    const api = window.JAY_MARKET_SCOPE_API;
    api.registerPlatform({ key: 'otto', name: 'Otto', aliases: ['otto'], kind: 'marketplace' });
    api.registerMarket({
      code: 'DE', key: 'de', name: '德国', label: '德国市场', flag: '🇩🇪', aliases: ['de', '德国'],
      regionCode: 'EU', regionName: '欧洲', jurisdictionCodes: ['DE'],
      platformKeys: ['otto'], categoryKeys: [], dataStatus: 'configured',
    }, [{ marketCode: 'DE', platformKey: 'otto', status: 'active', dataStatus: 'configured', label: '德国站' }]);
    api.setActiveMarket('DE');
  });

  await expect(page.locator('#jay-market-selector')).toHaveValue('DE');
  await expect(page.locator('#jay-market-selector option')).toHaveText(['美国', '印度尼西亚', '德国']);
  await expect(page.locator('.market-switcher').first()).toContainText('德国市场');
  await expect(page.locator('#ov-metrics .ov-metric-card').nth(0).locator('.ov-metric-val')).toHaveText('1');
  await expect(page.locator('#ov-metrics .ov-metric-card').nth(1).locator('.ov-metric-val')).toHaveText('1');
  await expect(page.locator('#ov-country-grid .ov-ccard')).toHaveCount(1);
  await expect(page.locator('#ov-country-grid')).toContainText('德国');
  await expect(page.locator('#ov-country-grid')).not.toContainText('美国');

  await page.evaluate(() => window.switchPage('countries'));
  await expect(page.locator('#countries-page-title')).toHaveText('德国市场档案');
  await expect(page.locator('#country-scope-market-code')).toHaveText('DE');
  await expect(page.locator('#country-profile-selector')).toHaveValue('DE');
  await expect(page.locator('#country-commerce-title')).toHaveText('德国电商市场环境');
  await expect(page.locator('#country-commerce-count')).toHaveText('0 项已接入');
  await expect(page.locator('#country-commerce-content .country-commerce-metric.has-data')).toHaveCount(0);
  await expect(page.locator('#country-commerce-content .country-commerce-metric.is-missing')).toHaveCount(11);
  await expect(page.locator('#country-commerce-status')).toHaveAttribute('data-data-status', 'not-connected');
  await expect(page.locator('#country-commerce-content .country-commerce-metric.is-missing').first()).toHaveAttribute('data-data-status', 'not-connected');
  await expect(page.locator('#country-commerce-content .country-commerce-metric.is-missing').first()).toContainText('尚未接入');
  await expect(page.locator('#country-commerce-content')).not.toContainText('美国');

  await page.locator('#country-profile-selector').selectOption('US');
  await expect(page.locator('#countries-page-title')).toHaveText('美国市场档案');
  await expect(page.locator('#country-commerce-content .country-commerce-metric.has-data')).toHaveCount(8);
  await page.locator('#country-profile-selector').selectOption('DE');
  await expect(page.locator('#countries-page-title')).toHaveText('德国市场档案');
  await expect(page.locator('#country-commerce-content .country-commerce-metric.has-data')).toHaveCount(0);

  await page.evaluate(() => window.switchPage('platforms'));
  await expect(page.locator('#platforms .platform-card:visible')).toHaveCount(1);
  await expect(page.locator('#platforms .platform-card:visible')).toContainText('Otto');
  await expect(page.locator('#platforms .platform-card:visible')).toContainText('德国站');
  await page.locator('#platforms .platform-card:visible').click();
  await expect(page.locator('#rules')).toHaveClass(/active/);
  await expect(page.locator('#rl-market')).toHaveValue('DE');
  await expect(page.locator('#rl-platform')).toHaveValue('Otto');

  await page.evaluate(() => window.switchPage('policies'));
  await expect(page.locator('#pl-f-region')).toHaveValue('DE');
  await expect(page.locator('#pl-empty')).toBeVisible();
  await expect(page.locator('#pl-list')).not.toContainText('美国');

  await page.evaluate(() => window.switchPage('rules'));
  await expect(page.locator('#rl-market')).toHaveValue('DE');
  await expect(page.locator('#rl-platform option')).toHaveText(['全部平台', 'Otto']);
  await expect(page.locator('#rl-rules-list')).toContainText('暂无匹配规则');

  await page.evaluate(() => window.switchPage('report'));
  await page.locator('#rp-v2-next-btn').click();
  await expect(page.locator('#rp-v2-topic')).toHaveAttribute('placeholder', /德国/);
  await page.locator('#rp-v2-topic').fill('宠物用品');
  await page.getByRole('button', { name: '生成报告', exact: true }).click();
  await expect(page.locator('#rp-q-market')).toHaveValue('DE');

  await page.evaluate(() => window.switchPage('tools'));
  await expect(page.locator('#sc-market')).toHaveValue('DE');
  expect(pageErrors).toEqual([]);
});

test('platform and category selectors update the shared scope without stale selection limits', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  await expect(page.locator('#jay-platform-selector option')).toHaveText(['全部平台', 'Amazon', 'TikTok Shop', 'AliExpress', 'eBay']);
  await page.locator('#jay-platform-selector').selectOption('amazon');
  await expect(page.locator('#jay-platform-selector')).toHaveValue('amazon');
  await page.locator('#jay-platform-selector').selectOption('tiktok-shop');
  await expect(page.locator('#jay-platform-selector')).toHaveValue('tiktok-shop');
  await page.locator('#jay-category-selector').selectOption('electronics');
  await expect(page.locator('#jay-category-selector')).toHaveValue('electronics');

  const context = await page.evaluate(() => window.JAY_MARKET_SCOPE_API.getActiveContext());
  expect(context.marketCodes).toEqual(['US']);
  expect(context.platformKeys).toEqual(['tiktok-shop']);
  expect(context.selectedPlatformKeys).toEqual(['tiktok-shop']);
  expect(context.categoryCodes).toEqual(['electronics']);
  expect(pageErrors).toEqual([]);
});

test('category rules, provenance gates, and report snapshots stay explicit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  const result = await page.evaluate(() => {
    const valid = ['标题', 'TikTok Shop', '美国', '短视频', '100', '1000', '2026-08-31', '达人', '商品', '2.1', '美妆', '测评', '50', 'US Store', '上升'];
    valid.source_kind = 'uploaded';
    valid.source_type = 'user_upload';
    valid.verification_status = 'uploaded';
    valid.source_url = 'https://example.test/content/1';
    const invalid = ['无来源内容', 'TikTok Shop', '美国', '短视频'];
    window.jaySetContentRecords([valid, invalid]);
    const product = window.prNormalizeProduct({
      商品名: '电子产品样本', 国家: '美国', 平台: 'Amazon', 类目: '电子产品',
      售价: '$20', 产品成本: '$8', 认证: 'FCC',
    }).row;
    const snapshot = window.prProductSnapshot(product);
    const materialRow = window.jayMaterialToRow({
      id: 'snapshot-1', type: 'product', title: product[1], source: '用户文件',
      summary: '测试快照', snapshot_type: 'product', snapshot_data: snapshot,
      snapshot_source: product._source, snapshot_at: '2026-08-31T00:00:00.000Z',
      snapshot_market: product[2], snapshot_platform: product[3], snapshot_category: product[4],
    });
    return {
      contentCount: window.ctScopedData().length,
      validContent: window.ctIsValidatedContent(valid),
      invalidContent: window.ctIsValidatedContent(invalid),
      ruleStatus: product._categoryRule.status,
      ruleMissing: product._categoryRule.missingFields,
      snapshotSource: snapshot.source,
      snapshotCategory: materialRow.snapshot_category,
      snapshotPersisted: materialRow.snapshot_data.row[1],
    };
  });
  expect(result.contentCount).toBe(1);
  expect(result.validContent).toBe(true);
  expect(result.invalidContent).toBe(false);
  expect(result.ruleStatus).toBe('complete');
  expect(result.ruleMissing).toEqual([]);
  expect(result.snapshotSource).toBe('用户导入文件');
  expect(result.snapshotCategory).toBe('电子产品');
  expect(result.snapshotPersisted).toBe('电子产品样本');
});
