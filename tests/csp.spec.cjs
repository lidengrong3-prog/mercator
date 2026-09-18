const { test, expect } = require('@playwright/test');

test('strict CSP applies static and dynamic UI styles without violations', async ({ page }) => {
  await page.addInitScript(() => {
    window.__jayCspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__jayCspViolations.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
      });
    });
  });

  await page.goto('/');
  await expect(page.locator('#bell')).toBeHidden();
  await expect(page.locator('#jay-faq')).toHaveCSS('position', 'fixed');
  await expect(page.locator('[data-ui-style]')).toHaveCount(0);

  const dynamic = await page.evaluate(async () => {
    const element = document.createElement('div');
    element.id = 'strict-style-dynamic';
    element.setAttribute('data-ui-style', 'width:37%;display:block;color:#236b52');
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      pending: element.hasAttribute('data-ui-style'),
      width: element.style.width,
      display: element.style.display,
      color: element.style.color,
    };
  });
  expect(dynamic).toEqual({ pending: false, width: '37%', display: 'block', color: 'rgb(35, 107, 82)' });

  await page.getByRole('button', { name: '浏览只读演示' }).click();
  await page.evaluate(async () => {
    for (const pageName of ['products', 'shops', 'policies', 'rules', 'report', 'tools', 'settings']) {
      window.switchPage(pageName);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  await expect(page.locator('[data-ui-style]')).toHaveCount(0);

  const unsafe = await page.evaluate(async () => {
    const element = document.createElement('div');
    element.setAttribute('data-ui-style', 'background:url(https://invalid.example/track)');
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { pending: element.hasAttribute('data-ui-style'), background: element.style.background };
  });
  expect(unsafe).toEqual({ pending: false, background: '' });

  const violations = await page.evaluate(() => window.__jayCspViolations.filter((item) => (
    /^(?:style|script)-src/.test(item.directive)
  )));
  expect(violations).toEqual([]);
});
