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
  await expect(page.getByRole('heading', { name: '进入全球市场情报台' })).toBeVisible();
  await expect(page.locator('#mainApp')).not.toHaveClass(/active/);

  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await expect(page.locator('#mainApp')).toHaveClass(/active/);
  await expect(page.getByRole('heading', { name: '今天从哪个市场机会开始？' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: '今天从哪个市场机会开始？' })).toBeVisible();
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
  const alertTitle = page.locator('#countries .alert-sidebar .alert-item-title').first();
  await expect(alertTitle).toBeVisible();
  expect((await alertTitle.boundingBox()).width).toBeGreaterThan(120);
  await expect(page.locator('#countries .alert-sidebar .alert-item-title').nth(1)).toHaveText('CPSC 锂电池产品安全新规');

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
  await expect(page.locator('#st-system-quality')).toContainText(/数据(实时|过期|部分降级|校验失败|读取中)/);
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

  await expect(page.locator('#data-quality-badge')).toContainText(/数据(实时|过期|部分降级|校验失败|读取中)/);
  await expect(page.locator('#data-quality-rows tr')).toHaveCount(8);
  await expect(page.locator('#shell-data-status')).toContainText(/数据(实时|过期|部分降级|校验失败|读取中)/);
  await expect(page.locator('#dq-errors')).toHaveText('0');
  await expect(page.locator('#dq-warnings')).toHaveText('0');
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
