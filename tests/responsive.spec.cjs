const { test, expect } = require('@playwright/test');

const cases = [
  { name: 'small phone', width: 360, height: 800, mode: 'phone', drawer: true },
  { name: 'large phone', width: 640, height: 900, mode: 'phone', drawer: true },
  { name: 'tablet', width: 768, height: 1024, mode: 'tablet', drawer: true },
  { name: 'large tablet', width: 1024, height: 768, mode: 'tablet', drawer: true },
  { name: 'desktop', width: 1280, height: 800, mode: 'desktop', drawer: false },
];

for (const viewport of cases) {
  test(`${viewport.name} follows the shared responsive contract`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.getByRole('button', { name: '浏览只读演示' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-viewport', viewport.mode);
    await expect(page.locator('#mainApp')).toHaveClass(/active/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const sidebarTransform = await page.locator('aside.sidebar').evaluate((element) => getComputedStyle(element).transform);
    if (viewport.drawer) {
      await expect(page.locator('#jay-hamburger')).toBeVisible();
      expect(sidebarTransform).not.toBe('none');
    } else {
      expect(sidebarTransform).toBe('none');
      await expect(page.locator('aside.sidebar')).toHaveCSS('width', '248px');
    }
    expect(pageErrors).toEqual([]);
  });
}

test('page assets load on demand and remain deduplicated', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  const loaded = () => page.evaluate(() => (
    [...document.querySelectorAll('[data-page-asset]')]
      .map((node) => node.dataset.pageAsset)
  ));
  await page.waitForFunction(() => typeof window.alertsDataState === 'string');
  expect(await loaded()).toEqual(['assets/js/alerts-settings.js']);

  await page.evaluate(() => window.switchPage('products'));
  await expect(page.locator('#products')).toHaveClass(/active/);
  expect(await loaded()).toEqual([
    'assets/js/alerts-settings.js',
    'assets/styles/workspaces.css',
    'assets/js/products-shops.js',
  ]);

  await page.evaluate(() => window.switchPage('settings'));
  await expect(page.locator('#settings')).toHaveClass(/active/);
  expect(await loaded()).toEqual([
    'assets/js/alerts-settings.js',
    'assets/styles/workspaces.css',
    'assets/js/products-shops.js',
  ]);

  await page.evaluate(() => window.switchPage('products'));
  expect((await loaded()).filter((path) => path === 'assets/js/products-shops.js')).toHaveLength(1);
});
