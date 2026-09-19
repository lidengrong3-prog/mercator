const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const baseUrl = process.env.JAY_PLAYWRIGHT_BASE_URL || process.env.PRODUCTION_SITE_URL || '';
const credentials = {
  a: { email: process.env.PROD_TEST_USER_A_EMAIL || '', password: process.env.PROD_TEST_USER_A_PASSWORD || '' },
  b: { email: process.env.PROD_TEST_USER_B_EMAIL || '', password: process.env.PROD_TEST_USER_B_PASSWORD || '' },
};
const enabled = process.env.RUN_PRODUCTION_ACCEPTANCE === '1';
const ready = enabled && baseUrl && Object.values(credentials).every((account) => account.email && account.password);
const acceptanceRunId = process.env.ACCEPTANCE_RUN_ID || `local-browser-${Date.now()}`;
const acceptanceWorkspaceA = process.env.ACCEPTANCE_API_WORKSPACE_ID || '';
const acceptanceWorkspaceB = process.env.ACCEPTANCE_BROWSER_WORKSPACE_ID || '';
const platformDisplayNames = {
  amazon: 'Amazon',
  'tiktok-shop': 'TikTok Shop',
  aliexpress: 'AliExpress',
  ebay: 'eBay',
};
const platformRuleDimensions = ['fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty'];

test.describe('production authenticated browser acceptance', () => {
  test.skip(!ready, 'set RUN_PRODUCTION_ACCEPTANCE=1 and two production test accounts to run this suite');
  // The report engine generates one request per chapter. Keep enough room for
  // all sequential production AI calls, exports and account-isolation checks.
  test.setTimeout(600_000);

  async function login(page, account) {
    await page.addInitScript((runId) => { window.__JAY_ACCEPTANCE_RUN_ID = runId; }, acceptanceRunId);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loginPage')).toBeVisible({ timeout: 30_000 });
    await page.locator('#auth-email').fill(account.email);
    await page.locator('#auth-password').fill(account.password);
    await page.locator('#auth-legal-consent').check();
    await page.locator('#auth-submit-btn').click();
    await expect(page.locator('#mainApp')).toHaveClass(/active/, { timeout: 30_000 });
    await page.waitForFunction(() => window.jayUser && !window.jayIsDemo, null, { timeout: 30_000 });
    await page.waitForFunction(() => !window.jayWorkspaceHydration && String(window.jayHydratedUserId || '').startsWith(window.jayUser.id + ':'), null, { timeout: 30_000 });
    const targetWorkspace = account.email.toLowerCase() === credentials.a.email.toLowerCase() ? acceptanceWorkspaceA : acceptanceWorkspaceB;
    if (targetWorkspace) {
      await page.evaluate(async (workspaceId) => {
        if (typeof window.jaySetActiveWorkspace === 'function') await window.jaySetActiveWorkspace(workspaceId);
      }, targetWorkspace);
      await page.waitForFunction((workspaceId) => window.jayActiveWorkspaceId() === workspaceId, targetWorkspace, { timeout: 30_000 });
    }
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

  async function selectReportPlatform(page) {
    const candidates = await page.evaluate(async () => {
      const result = await window.supabaseClient
        .from('market_data_applicability')
        .select('platform_key,category_code,source_url,verification_status,published_at,verified_at,payload')
        .eq('market_code', 'US')
        .eq('domain', 'rule')
        .eq('status', 'active')
        .in('verification_status', ['verified', 'uploaded'])
        .not('platform_key', 'is', null)
        .limit(1000);
      if (result.error) throw new Error(result.error.message);
      return (result.data || []).filter((row) => (
        (!row.category_code || row.category_code === 'generic')
        && (row.verification_status === 'uploaded' || String(row.source_url || '').startsWith('https://'))
      ));
    });
    const coverage = new Map();
    for (const row of candidates) {
      const key = String(row.platform_key || '').trim().toLowerCase();
      if (!key) continue;
      const current = coverage.get(key) || { key, count: 0, latest: '', dimensions: new Set() };
      current.count += 1;
      current.latest = [current.latest, row.published_at || row.verified_at || ''].sort().at(-1);
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      const raw = payload.rule_dimensions && typeof payload.rule_dimensions === 'object'
        ? payload.rule_dimensions : {};
      Object.entries(raw).forEach(([dimension, value]) => {
        const normalized = String(dimension || '').trim().toLowerCase();
        if (platformRuleDimensions.includes(normalized) && value != null && String(value).trim()) {
          current.dimensions.add(normalized);
        }
      });
      const topic = String(payload.rule_topic || payload.topic || '').trim().toLowerCase();
      if (platformRuleDimensions.includes(topic)) current.dimensions.add(topic);
      coverage.set(key, current);
    }
    const selected = [...coverage.values()].sort((left, right) => (
      right.dimensions.size - left.dimensions.size
      || right.count - left.count
      || right.latest.localeCompare(left.latest)
      || left.key.localeCompare(right.key)
    ))[0];
    if (!selected) {
      throw new Error('no active US platform has verified formal rule evidence for production report acceptance');
    }
    return {
      key: selected.key,
      name: platformDisplayNames[selected.key] || selected.key,
      ruleCount: selected.count,
      ruleDimensions: platformRuleDimensions.filter((dimension) => selected.dimensions.has(dimension)),
      missingRuleDimensions: platformRuleDimensions.filter((dimension) => !selected.dimensions.has(dimension)),
      complete: platformRuleDimensions.every((dimension) => selected.dimensions.has(dimension)),
    };
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
            && (publishStatus?.classList.contains('is-publishable') || publishStatus?.classList.contains('is-blocked')),
          generationActive,
          generating,
          previewClass: preview?.className || '',
          publishStatusClass: publishStatus?.className || '',
          publishStatusText: publishStatus?.textContent?.trim() || '',
          saveStatusText: document.querySelector('#rp-v2-save-status')?.textContent?.trim() || '',
          citationAudit: window.rpLastReportModel?.citationAudit || null,
          reconciliation: window.rpLastReportModel?.reconciliation || null,
          scopeCheck: window.rpLastReportModel?.scopeCheck || null,
          publishable: window.rpLastReportModel?.publishable === true,
          publicationBlocks: window.rpLastReportModel?.publicationBlocks || [],
          dataCheckClass: dataCheck?.className || '',
          dataCheckText: dataCheck?.textContent?.trim() || '',
          toasts: Array.isArray(window.__productionAcceptanceToasts)
            ? window.__productionAcceptanceToasts.slice(-5) : [],
        };
      });
      if (state.ready) return state;
      const terminalToast = state.toasts.find((message) => /停止生成|无法创建报告运行记录|请先登录|额度|相同报告/.test(message));
      const terminalReportState = !state.generationActive && /生成失败/.test(state.publishStatusText);
      // Missing coverage is allowed to finish as an unsaved draft. The data
      // check stays blocked while that generation is active, so it is not a
      // terminal condition by itself.
      if (terminalReportState || terminalToast) {
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
    const runId = acceptanceRunId;
    const uploadedFileName = `production-browser-acceptance-${runId}.json`;
    const importedProductTitle = `生产浏览验收商品-${runId}`;
    const browserTopic = `生产浏览器验收通用品类-${runId}`;
    const browserReportTitle = `《${browserTopic}》美国市场调研报告`;
    page.on('popup', (popup) => popup.close().catch(() => {}));

    await login(page, credentials.a);
    const workspaceA = await page.evaluate(() => window.jayActiveWorkspaceId());
    const reportPlatform = await selectReportPlatform(page);

    const recoveryRequestId = `production-browser-network-recovery:${runId}`;
    let recoveryAttempts = 0;
    const recoveryRoute = async (route) => {
      if (route.request().headers()['x-request-id'] !== recoveryRequestId) {
        await route.continue();
        return;
      }
      recoveryAttempts += 1;
      if (recoveryAttempts === 1) {
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    };
    await page.route('**/functions/v1/billing-status', recoveryRoute);
    const recoveredBilling = await page.evaluate((requestId) => window.jayFunctionRequest(
      'billing-status',
      {},
      { timeout: 15_000, retryOnNetwork: true, requestId },
    ), recoveryRequestId);
    await page.unroute('**/functions/v1/billing-status', recoveryRoute);
    expect(recoveryAttempts).toBe(2);
    expect(recoveredBilling).toMatchObject({ billing_enabled: expect.any(Boolean) });

    const forgedClientId = `production-browser-forged-${runId}`;
    const forgedWrite = await page.evaluate(async ({ clientId, workspaceId }) => {
      const userId = window.jayUser.id;
      return window.supabaseClient.from('generated_reports').insert({
        user_id: userId,
        workspace_id: workspaceId,
        client_id: clientId,
        report_type: 'market',
        title: '客户端伪造正式报告',
        content: { text: '不得保存', publishable: true },
        status: 'completed',
        generation_status: 'completed',
        save_status: 'saved',
        publication_status: 'formal',
      }).select('id');
    }, { clientId: forgedClientId, workspaceId: workspaceA });
    expect(forgedWrite.error).toBeTruthy();
    expect(await rows(page, 'generated_reports', { client_id: forgedClientId })).toEqual([]);

    await page.evaluate((platformKey) => {
      window.JAY_MARKET_SCOPE_API.setActiveMarket('US');
      window.JAY_MARKET_SCOPE_API.setActivePlatforms([platformKey]);
      window.JAY_MARKET_SCOPE_API.setActiveCategories(['generic']);
    }, reportPlatform.key);
    const activeReportScope = await page.evaluate(() => window.JAY_MARKET_SCOPE_API.getActiveContext());
    expect(activeReportScope.marketCodes).toEqual(['US']);
    expect(activeReportScope.platformKeys).toEqual([reportPlatform.key]);
    expect(activeReportScope.categoryCodes).toEqual(['generic']);

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
          电商平台: reportPlatform.name,
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
    await page.locator('#rp-panel-step2 button[data-action="rpV2Questionnaire()"]')
      .click();
    await expect(page.locator('#rp-questionnaire')).toHaveClass(/show/);
    await page.locator('#rp-q-category').fill('通用');
    await page.locator('#rp-questionnaire .rp-q-go').click();
    const previewState = await waitForReportPreview(page);
    const formalReady = previewState.publishable === true;
    await page.waitForFunction(() => ['saved', 'failed', 'blocked'].includes(String(window.rpLastSaveState || '')), null, { timeout: 60_000 });
    const cloudSave = await page.evaluate(() => ({ state: window.rpLastSaveState, error: window.rpLastSaveError || null }));
    let reportRow;
    let reportId;
    let pdfExport = null;
    let docxExport = null;
    let reportContentGate;
    if (formalReady) {
      if (cloudSave.state !== 'saved') throw new Error(`report-save did not reach cloud: ${JSON.stringify(cloudSave)}`);
      await expect(page.locator('#rp-v2-save-status')).toContainText('已保存到云端');

      reportRow = await waitForRow(page, 'generated_reports', { title: browserReportTitle }, (row) => row.save_status === 'saved');
      expect(reportRow.generation_status).toBe('completed');
      expect(reportRow.publication_status).toBe('formal');
      expect(reportRow.server_validation_version).toBeTruthy();
      expect(reportRow.server_validation?.ok).toBe(true);
      expect(reportRow.user_id).toBe(await page.evaluate(() => window.jayUser.id));
      reportId = reportRow.id;
      const reportItem = page.locator('#rp-v2-recent-list .rp-v2-recent-item').filter({ hasText: browserReportTitle }).first();
      await expect(reportItem).toBeVisible({ timeout: 30_000 });
      await reportItem.click();
      await expect(page.locator('#rp-v2-preview-body')).not.toHaveClass(/rp-empty-preview/);
      await expect(page.locator('#rp-v2-save-status')).toContainText('已保存到云端');

      // Trigger both authenticated server exports from the report toolbar and
      // wait for their cloud history rows, rather than trusting a pre-seeded row.
      await page.locator('#rp-panel-step3 button[data-action="rpV2Export(\'pdf\')"]').click();
      pdfExport = await waitForRow(page, 'report_exports', { report_id: reportId, format: 'pdf' }, (row) => row.status === 'completed', 90_000);
      expect(pdfExport.file_path).toBeTruthy();
      await page.locator('#rp-panel-step3 button[data-action="rpV2Export(\'docx\')"]').click();
      docxExport = await waitForRow(page, 'report_exports', { report_id: reportId, format: 'docx' }, (row) => row.status === 'completed', 90_000);
      expect(docxExport.file_path).toBeTruthy();
      await expect(page.locator('#rp-v2-export-history')).toContainText('PDF', { timeout: 30_000 });
      await expect(page.locator('#rp-v2-export-history')).toContainText('DOCX', { timeout: 30_000 });

      // A full reload must hydrate the same account from Supabase, not memory.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.jayUser && !window.jayIsDemo, null, { timeout: 30_000 });
      await page.waitForFunction(() => !window.jayWorkspaceHydration && String(window.jayHydratedUserId || '').startsWith(window.jayUser.id + ':'), null, { timeout: 30_000 });
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
      reportContentGate = { mode: 'formal', formal_save: true, formal_exports: true, missing_rule_dimensions: [] };
    } else {
      expect(cloudSave.state).toBe('blocked');
      await expect(page.locator('#rp-v2-save-status')).toContainText('未保存草稿');
      await expect(page.locator('#rp-v2-publish-status')).toHaveClass(/is-blocked/);
      const draftState = await page.evaluate(() => ({
        publishable: window.rpLastReportModel?.publishable === true,
        publicationBlocks: window.rpLastReportModel?.publicationBlocks || [],
        cloudSaved: window.rpLastReportRecord?.cloudSaved === true,
        dbId: window.rpLastReportRecord?.dbId || null,
      }));
      expect(draftState.publishable).toBe(false);
      expect(draftState.cloudSaved).toBe(false);
      expect(draftState.dbId).toBeNull();
      expect(draftState.publicationBlocks.some((item) => (
        item.code === 'QUALITY_PLATFORM_RULE_COVERAGE_MISSING' || item.code === 'QUALITY_REQUIRED_DATA_MISSING'
      ))).toBe(true);
      expect(await rows(page, 'generated_reports', { title: browserReportTitle })).toEqual([]);

      const formalRequests = [];
      const captureFormalRequest = (request) => {
        if (/\/functions\/v1\/(report-export|report-docx)(?:\?|$)/.test(request.url())) formalRequests.push(request.url());
      };
      page.on('request', captureFormalRequest);
      await page.locator('#rp-panel-step3 button[data-action="rpV2Export(\'pdf\')"]').click();
      await page.locator('#rp-panel-step3 button[data-action="rpV2Export(\'docx\')"]').click();
      await expect.poll(() => page.evaluate(() => window.__productionAcceptanceToasts.slice(-6)))
        .toEqual(expect.arrayContaining([
          expect.stringContaining('不能创建正式 PDF'),
          expect.stringContaining('不能创建正式 DOCX'),
        ]));
      page.off('request', captureFormalRequest);
      expect(formalRequests).toEqual([]);

      // Collaboration and RLS checks use an explicitly marked test fixture.
      // The generated report itself remains local and never becomes formal.
      const fixtureTitle = `${browserReportTitle}（协作草稿夹具）`;
      reportRow = await page.evaluate(async ({ workspaceId, title, runId, platformKey }) => {
        const result = await window.supabaseClient.from('generated_reports').insert({
          user_id: window.jayUser.id,
          workspace_id: workspaceId,
          acceptance_run_id: runId,
          client_id: `production-browser-collaboration-draft:${runId}`,
          report_type: 'market',
          title,
          content: { text: '生产浏览器协作权限验收草稿。', publishable: false, test_fixture: true },
          status: 'completed',
          generation_status: 'completed',
          save_status: 'pending',
          publication_status: 'draft',
          scope_snapshot: { marketCodes: ['US'], platformKeys: [platformKey], categoryCodes: ['generic'] },
        }).select('*').single();
        if (result.error) throw new Error(result.error.message);
        return result.data;
      }, { workspaceId: workspaceA, title: fixtureTitle, runId, platformKey: reportPlatform.key });
      expect(reportRow.publication_status).toBe('draft');
      expect(reportRow.save_status).toBe('pending');
      reportId = reportRow.id;
      reportContentGate = {
        mode: 'blocked',
        formal_save: false,
        formal_exports: false,
        reason_codes: [...new Set(draftState.publicationBlocks.map((item) => item.code).filter(Boolean))],
        missing_rule_dimensions: reportPlatform.missingRuleDimensions,
        browser_formal_requests: formalRequests.length,
      };
    }

    const contextB = await browser.newContext({ acceptDownloads: true });
    const pageB = await contextB.newPage();
    await login(pageB, credentials.b);
    const userB = await pageB.evaluate(() => window.jayUser.id);
    const workspaceB = acceptanceWorkspaceB || await pageB.evaluate(() => window.jayActiveWorkspaceId());
    expect(workspaceB).not.toBe(workspaceA);

    // Recover from an interrupted previous run, then prove the two owner
    // workspaces are isolated before creating this run's invitation.
    const cleanup = await page.evaluate(async ({ workspaceId, collaboratorId }) => {
      const found = await window.supabaseClient.from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', collaboratorId);
      if (found.error) return { error: found.error.message };
      for (const member of found.data || []) {
        const removed = await window.supabaseClient.from('workspace_members').delete().eq('id', member.id);
        if (removed.error) return { error: removed.error.message };
      }
      return { removed: (found.data || []).length };
    }, { workspaceId: workspaceA, collaboratorId: userB });
    expect(cleanup.error).toBeFalsy();
    await pageB.reload({ waitUntil: 'domcontentloaded' });
    await pageB.waitForFunction(
      () => window.jayUser
        && !window.jayIsDemo
        && !window.jayWorkspaceHydration
        && String(window.jayHydratedUserId || '').startsWith(window.jayUser.id + ':'),
      null,
      { timeout: 30_000 }
    );

    await pageB.evaluate(() => window.switchPage('products'));
    const bImports = await rows(pageB, 'saved_workspace_items', { item_type: 'product_catalog_import', client_id: 'default' });
    expect(bImports.some((row) => row.content?.meta?.fileName === uploadedFileName)).toBe(false);
    await expect(pageB.locator('#pr-table-body')).not.toContainText(importedProductTitle);

    await pageB.evaluate(() => window.switchPage('report'));
    await expect(pageB.locator('#rp-v2-recent-list')).not.toContainText(browserReportTitle);
    expect(await rows(pageB, 'report_materials', { title: importedProductTitle })).toEqual([]);
    expect(await rows(pageB, 'generated_reports', { id: reportId })).toEqual([]);
    expect(await rows(pageB, 'report_exports', { report_id: reportId })).toEqual([]);

    await page.evaluate(async () => {
      await window.jayLoadWorkspaceContext();
      await window.switchPage('settings');
      window.stSwitchTab('team');
    });
    await page.locator('#st-invite-email').fill(credentials.b.email);
    await page.locator('#st-invite-role').selectOption('editor');
    await page.locator('#st-invite-submit').click();
    await expect(page.locator('#toast')).toContainText('邀请邮件已发送', { timeout: 30_000 });
    const invitation = await waitForRow(page, 'workspace_invites', { workspace_id: workspaceA, email: credentials.b.email.toLowerCase() }, (row) => row.status === 'pending' && row.delivery_status === 'sent');

    await pageB.evaluate(async (inviteId) => {
      window.__productionAcceptanceToasts = [];
      const originalToast = window.toast;
      window.toast = function productionAcceptanceToast(message) {
        window.__productionAcceptanceToasts.push(String(message || ''));
        return originalToast.apply(this, arguments);
      };
      await window.jayAcceptWorkspaceInvite(inviteId);
    }, invitation.id);
    await expect.poll(() => pageB.evaluate(() => window.jayActiveWorkspaceId())).toBe(workspaceA);
    expect((await rows(pageB, 'report_materials', { title: importedProductTitle })).length).toBeGreaterThan(0);
    expect((await rows(pageB, 'generated_reports', { id: reportId })).length).toBe(1);
    await pageB.evaluate(async () => { await window.switchPage('settings'); window.stSwitchTab('team'); });
    await expect(pageB.locator(`#st-workspace-select option[value="${workspaceA}"]`)).toHaveCount(1);
    await expect(pageB.locator(`#st-workspace-select option[value="${workspaceB}"]`)).toHaveCount(1);

    const staleWatchlistCleanup = await pageB.evaluate(async (workspaceId) => {
      const result = await window.supabaseClient
        .from('user_watchlist')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('item_type', 'country')
        .eq('item_id', 'US');
      return result.error ? result.error.message : '';
    }, workspaceA);
    expect(staleWatchlistCleanup).toBe('');
    const editorWrite = await pageB.evaluate(() => window.addToWatchlist('country', 'US', '美国', '美国市场'));
    expect(editorWrite).toBe(true);
    const editorWatchlist = await waitForRow(
      pageB,
      'user_watchlist',
      { workspace_id: workspaceA, item_type: 'country', item_id: 'US' },
      (row) => row.user_id === userB
    );
    expect(editorWatchlist.user_id).toBe(userB);
    const sharedExport = await pageB.evaluate(async (sharedReportId) => {
      try {
        const result = await window.jayFunctionRequest('report-export', {
          report_id: sharedReportId,
          idempotency_key: `production-browser-shared:${sharedReportId}:pdf`,
        }, { timeout: 90_000, requestId: `production-browser-shared:${sharedReportId}` });
        return { ok: true, result };
      } catch (error) {
        return { ok: false, status: error.status, code: error.code };
      }
    }, reportId);
    if (formalReady) {
      expect(sharedExport).toMatchObject({ ok: true, result: { status: 'completed' } });
    } else {
      expect(sharedExport).toEqual({ ok: false, status: 409, code: 'REPORT_NOT_SAVED' });
      expect(await rows(pageB, 'report_exports', { report_id: reportId })).toEqual([]);
    }

    const membership = await waitForRow(page, 'workspace_members', { workspace_id: workspaceA, user_id: userB }, (row) => row.status === 'active');
    await page.evaluate((membershipId) => window.jayUpdateWorkspaceMember(membershipId, 'viewer'), membership.id);
    await pageB.evaluate((workspaceId) => window.jayLoadWorkspaceContext(workspaceId), workspaceA);
    expect(await pageB.evaluate(() => window.jayWorkspaceRole())).toBe('viewer');
    const viewerWrite = await pageB.evaluate(() => window.addToWatchlist('country', 'ID', '印度尼西亚', 'viewer denied'));
    expect(viewerWrite).toBe(false);
    expect(await pageB.evaluate(() => window.__productionAcceptanceToasts.some((message) => message.includes('只读权限')))).toBe(true);

    const watchlistCleanup = await page.evaluate(async (workspaceId) => {
      const result = await window.supabaseClient
        .from('user_watchlist')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('item_type', 'country')
        .eq('item_id', 'US');
      return result.error ? result.error.message : '';
    }, workspaceA);
    expect(watchlistCleanup).toBe('');
    await page.evaluate((membershipId) => window.jayRemoveWorkspaceMember(membershipId), membership.id);
    await pageB.reload({ waitUntil: 'domcontentloaded' });
    await pageB.waitForFunction(
      () => window.jayUser
        && !window.jayIsDemo
        && !window.jayWorkspaceHydration
        && String(window.jayHydratedUserId || '').startsWith(window.jayUser.id + ':'),
      null,
      { timeout: 30_000 }
    );
    expect(await pageB.evaluate(() => window.jayActiveWorkspaceId())).not.toBe(workspaceA);
    const stillHasRemovedWorkspace = await pageB.evaluate((removedWorkspaceId) => (
      window.jayWorkspaceContext.workspaces || []
    ).some((workspace) => workspace.id === removedWorkspaceId), workspaceA);
    expect(stillHasRemovedWorkspace).toBe(false);
    expect(await rows(pageB, 'generated_reports', { id: reportId })).toEqual([]);
    expect(await rows(pageB, 'report_materials', { title: importedProductTitle })).toEqual([]);

    await contextB.close();
    await context.close();

    const outputPath = process.env.PRODUCTION_BROWSER_ACCEPTANCE_OUTPUT || '';
    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify({
        status: 'passed',
        acceptance_run_id: acceptanceRunId,
        api_workspace_id: acceptanceWorkspaceA || workspaceA,
        browser_workspace_id: acceptanceWorkspaceB || workspaceB,
        site: baseUrl,
        network_recovery: {
          function: 'billing-status',
          first_request: 'internetdisconnected',
          attempts: recoveryAttempts,
          recovered_with_production_response: true,
        },
        report_id: reportId,
        invite_id: invitation.id,
        report_content_gate: reportContentGate,
        exports: pdfExport && docxExport ? { pdf: pdfExport.id, docx: docxExport.id } : {},
      }, null, 2));
    }
  });
});
