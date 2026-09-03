const { test, expect } = require('@playwright/test');

const baseUrl = process.env.JAY_PLAYWRIGHT_BASE_URL || process.env.PRODUCTION_SITE_URL || '';
const credentials = {
  a: { email: process.env.PROD_TEST_USER_A_EMAIL || '', password: process.env.PROD_TEST_USER_A_PASSWORD || '' },
  b: { email: process.env.PROD_TEST_USER_B_EMAIL || '', password: process.env.PROD_TEST_USER_B_PASSWORD || '' },
};
const enabled = process.env.RUN_PRODUCTION_ACCEPTANCE === '1';
const ready = enabled && baseUrl && Object.values(credentials).every((account) => account.email && account.password);

test.describe('production authenticated browser acceptance', () => {
  test.skip(!ready, 'set RUN_PRODUCTION_ACCEPTANCE=1 and two production test accounts to run this suite');
  // The report engine generates one request per chapter. Keep enough room for
  // all sequential production AI calls, exports and account-isolation checks.
  test.setTimeout(600_000);

  async function login(page, account) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loginPage')).toBeVisible({ timeout: 30_000 });
    await page.locator('#auth-email').fill(account.email);
    await page.locator('#auth-password').fill(account.password);
    await page.locator('#auth-submit-btn').click();
    await expect(page.locator('#mainApp')).toHaveClass(/active/, { timeout: 30_000 });
    await page.waitForFunction(() => window.jayUser && !window.jayIsDemo, null, { timeout: 30_000 });
    await page.waitForFunction(() => !window.jayWorkspaceHydration && window.jayHydratedUserId === window.jayUser.id, null, { timeout: 30_000 });
  }

  async function signOut(page) {
    await page.evaluate(async () => {
      if (typeof window.jayLogout === 'function') await window.jayLogout();
    });
    await expect(page.locator('#loginPage')).toBeVisible({ timeout: 30_000 });
  }

  async function rows(page, table, filters = {}) {
    return page.evaluate(async ({ tableName, filterValues }) => {
      if (!window.supabaseClient) throw new Error('Supabase client is unavailable');
      let query = window.supabaseClient.from(tableName).select('*');
      Object.entries(filterValues).forEach(([key, value]) => { query = query.eq(key, value); });
      const result = await query;
      if (result.error) throw new Error(result.error.message);
      return result.data || [];
    }, { tableName: table, filterValues: filters });
  }

  async function waitForRow(page, table, filters, predicate = () => true, timeout = 30_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = await rows(page, table, filters);
      const match = result.find(predicate);
      if (match) return match;
      await page.waitForTimeout(500);
    }
    throw new Error(`timed out waiting for ${table}`);
  }

  async function waitForReportPreview(page, timeout = 480_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => {
        const preview = document.querySelector('#rp-v2-preview-body');
        const dataCheck = document.querySelector('#rp-v2-data-check');
        const publishStatus = document.querySelector('#rp-v2-publish-status');
        const generationActive = window.rpGenInterval === true;
        const generating = !!preview?.querySelector('.rp-v2-generating');
        return {
          ready: !!preview
            && !preview.classList.contains('rp-empty-preview')
            && !generating
            && !generationActive
            && publishStatus?.classList.contains('is-publishable'),
          generationActive,
          generating,
          previewClass: preview?.className || '',
          publishStatusClass: publishStatus?.className || '',
          publishStatusText: publishStatus?.textContent?.trim() || '',
          saveStatusText: document.querySelector('#rp-v2-save-status')?.textContent?.trim() || '',
          citationAudit: window.rpLastReportModel?.citationAudit || null,
          reconciliation: window.rpLastReportModel?.reconciliation || null,
          scopeCheck: window.rpLastReportModel?.scopeCheck || null,
          dataCheckClass: dataCheck?.className || '',
          dataCheckText: dataCheck?.textContent?.trim() || '',
          toasts: Array.isArray(window.__productionAcceptanceToasts)
            ? window.__productionAcceptanceToasts.slice(-5) : [],
        };
      });
      if (state.ready) return;
      const terminalToast = state.toasts.find((message) => /停止生成|无法创建报告运行记录|请先登录|额度|相同报告/.test(message));
      const terminalReportState = !state.generationActive
        && (/is-blocked/.test(state.publishStatusClass) || /生成失败/.test(state.publishStatusText));
      if (/is-blocked/.test(state.dataCheckClass) || terminalReportState || terminalToast) {
        const runs = await rows(page, 'report_runs', {});
        throw new Error(`report generation stopped before preview: ${JSON.stringify({ ...state, latestRun: runs[0] || null })}`);
      }
      await page.waitForTimeout(500);
    }
    const runs = await rows(page, 'report_runs', {});
    const state = await page.evaluate(() => ({
      generationActive: window.rpGenInterval === true,
      generating: !!document.querySelector('#rp-v2-preview-body .rp-v2-generating'),
      publishStatusClass: document.querySelector('#rp-v2-publish-status')?.className || '',
      publishStatusText: document.querySelector('#rp-v2-publish-status')?.textContent?.trim() || '',
      saveStatusText: document.querySelector('#rp-v2-save-status')?.textContent?.trim() || '',
      citationAudit: window.rpLastReportModel?.citationAudit || null,
      reconciliation: window.rpLastReportModel?.reconciliation || null,
      scopeCheck: window.rpLastReportModel?.scopeCheck || null,
      dataCheckClass: document.querySelector('#rp-v2-data-check')?.className || '',
      dataCheckText: document.querySelector('#rp-v2-data-check')?.textContent?.trim() || '',
      toasts: window.__productionAcceptanceToasts || [],
    }));
    throw new Error(`timed out waiting for report preview: ${JSON.stringify({ ...state, latestRun: runs[0] || null })}`);
  }

  test('real login, upload, report recovery, exports and account isolation', async ({ browser }) => {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const runId = Date.now();
    const uploadedFileName = `production-browser-acceptance-${runId}.json`;
    const importedProductTitle = `生产浏览验收商品-${runId}`;
    const browserTopic = `生产浏览器验收宠物用品-${runId}`;
    const browserReportTitle = `《${browserTopic}》美国市场调研报告`;
    page.on('popup', (popup) => popup.close().catch(() => {}));

    await login(page, credentials.a);

    await page.evaluate(() => {
      window.__productionAcceptanceToasts = [];
      const originalToast = window.toast;
      window.toast = function productionAcceptanceToast(message) {
        window.__productionAcceptanceToasts.push(String(message || ''));
        return originalToast.apply(this, arguments);
      };
    });

    // Upload through the actual category page. The application stores the
    // parsed payload in an account-scoped workspace asset.
    await page.evaluate(() => window.switchPage('products'));
    await page.locator('#pr-file-input').setInputFiles({
      name: uploadedFileName,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        products: [{
          商品名: importedProductTitle,
          '国家/市场': '美国',
          电商平台: 'Amazon',
          商品类目: '通用',
          售价: '39.90',
          销量: '12',
          信号: '上升',
          店铺: '生产验收店铺',
          更新时间: '2026-09-02',
        }],
      }, null, 2)),
    });
    await expect(page.locator('#pr-data-status')).toContainText('已导入 1 条商品', { timeout: 15_000 });
    const importRow = await waitForRow(page, 'saved_workspace_items', { item_type: 'product_catalog_import', client_id: 'default' }, (row) => row.content?.meta?.fileName === uploadedFileName);
    expect(importRow.content.meta.fileName).toBe(uploadedFileName);

    // Select the uploaded row and use the visible "加入报告素材" action.
    await page.locator('#pr-table-body .pr-chk').first().check();
    await page.locator('#pr-batch-add').click();
    await waitForRow(page, 'report_materials', {}, (row) => row.title === importedProductTitle);

    // Generate a report through the actual three-step UI. The market-research
    // template is intentional: the uploaded product proves the material path,
    // while this template can run without inventing missing unit economics.
    await page.evaluate(() => window.switchPage('report'));
    await page.waitForFunction(() => (
      window.policiesDataState === 'ready'
      && Array.isArray(window.policiesJsonData?.items) && window.policiesJsonData.items.length > 0
      && Array.isArray(window.rulesJsonData?.items) && window.rulesJsonData.items.length > 0
      && window.jayGetCountryCommerceState?.('US')?.status === 'ready'
    ), null, { timeout: 30_000 });
    await page.locator('.rp-v2-tpl-card[data-tpl="market-research"]').click();
    await expect(page.locator('#rp-v2-next-btn')).toBeEnabled();
    await page.locator('#rp-v2-next-btn').click();
    await page.locator('#rp-v2-topic').fill(browserTopic);
    await page.locator('#rp-panel-step2 button[onclick="rpV2Questionnaire()"]')
      .click();
    await expect(page.locator('#rp-questionnaire')).toHaveClass(/show/);
    await page.locator('#rp-q-category').fill('宠物用品');
    await page.locator('#rp-questionnaire .rp-q-go').click();
    await waitForReportPreview(page);
    await expect(page.locator('#rp-v2-save-status')).toContainText('已保存到云端', { timeout: 60_000 });

    const reportRow = await waitForRow(page, 'generated_reports', { title: browserReportTitle }, (row) => row.save_status === 'saved');
    expect(reportRow.generation_status).toBe('completed');
    expect(reportRow.user_id).toBe(await page.evaluate(() => window.jayUser.id));
    const reportId = reportRow.id;
    const reportItem = page.locator('#rp-v2-recent-list .rp-v2-recent-item').filter({ hasText: browserReportTitle }).first();
    await expect(reportItem).toBeVisible({ timeout: 30_000 });
    await reportItem.click();
    await expect(page.locator('#rp-v2-preview-body')).not.toHaveClass(/rp-empty-preview/);
    await expect(page.locator('#rp-v2-save-status')).toContainText('已保存到云端');

    // Trigger both authenticated server exports from the report toolbar and
    // wait for their cloud history rows, rather than trusting a pre-seeded row.
    await page.locator('#rp-panel-step3 button[onclick="rpV2Export(\'pdf\')"]').click();
    const pdfExport = await waitForRow(page, 'report_exports', { report_id: reportId, format: 'pdf' }, (row) => row.status === 'completed', 90_000);
    expect(pdfExport.file_path).toBeTruthy();
    await page.locator('#rp-panel-step3 button[onclick="rpV2Export(\'docx\')"]').click();
    const docxExport = await waitForRow(page, 'report_exports', { report_id: reportId, format: 'docx' }, (row) => row.status === 'completed', 90_000);
    expect(docxExport.file_path).toBeTruthy();
    await expect(page.locator('#rp-v2-export-history')).toContainText('PDF', { timeout: 30_000 });
    await expect(page.locator('#rp-v2-export-history')).toContainText('DOCX', { timeout: 30_000 });

    // A full reload must hydrate the same account from Supabase, not memory.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.jayUser && !window.jayIsDemo, null, { timeout: 30_000 });
    await page.waitForFunction(() => !window.jayWorkspaceHydration && window.jayHydratedUserId === window.jayUser.id, null, { timeout: 30_000 });
    await page.evaluate(() => window.switchPage('report'));
    await expect(page.locator('#rp-v2-recent-list')).toContainText(browserReportTitle, { timeout: 30_000 });
    await page.locator('#rp-v2-recent-list .rp-v2-recent-item').filter({ hasText: browserReportTitle }).first().click();
    await expect(page.locator('#rp-v2-save-status')).toContainText('已保存到云端');

    // A new authenticated browser session must be able to reopen the same
    // report after an explicit logout, not only after an in-place reload.
    await signOut(page);
    await login(page, credentials.a);
    await page.evaluate(() => window.switchPage('report'));
    await expect(page.locator('#rp-v2-recent-list')).toContainText(browserReportTitle, { timeout: 30_000 });
    await page.locator('#rp-v2-recent-list .rp-v2-recent-item').filter({ hasText: browserReportTitle }).first().click();
    await expect(page.locator('#rp-v2-save-status')).toContainText('已保存到云端');

    await signOut(page);
    await login(page, credentials.b);

    // Account B may have its own data, but A's uploaded material/report/export
    // must never appear in either the UI or authenticated table queries.
    await page.evaluate(() => window.switchPage('products'));
    const bImports = await rows(page, 'saved_workspace_items', { item_type: 'product_catalog_import', client_id: 'default' });
    expect(bImports.some((row) => row.content?.meta?.fileName === uploadedFileName)).toBe(false);
    await expect(page.locator('#pr-table-body')).not.toContainText(importedProductTitle);

    await page.evaluate(() => window.switchPage('report'));
    await expect(page.locator('#rp-v2-recent-list')).not.toContainText(browserReportTitle);
    expect(await rows(page, 'report_materials', { title: importedProductTitle })).toEqual([]);
    expect(await rows(page, 'generated_reports', { id: reportId })).toEqual([]);
    expect(await rows(page, 'report_exports', { report_id: reportId })).toEqual([]);

    await context.close();
  });
});
