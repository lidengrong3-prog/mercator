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

test('persisted watchlist names and notes remain text in cards and search results', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  const result = await page.evaluate(async () => {
    window.__storedXss = 0;
    const storedName = '美国 <img src=x onerror="window.__storedXss=1">';
    const storedNote = 'Amazon <svg onload="window.__storedXss=2"></svg></option><script>window.__storedXss=3</script>';
    window.loadUserWatchlist = async () => [{
      id: 'persisted-xss',
      item_type: 'country',
      item_id: 'US',
      item_name: storedName,
      note: storedNote,
      created_at: '2026-09-09T00:00:00Z',
    }];

    await window.loadWatchlistFromDb();
    window.showAddWatchModal();
    document.getElementById('wl-search-input').value = '美国';
    window.doModalSearch();

    const watchGrid = document.getElementById('watch-grid');
    const searchResults = document.getElementById('wl-search-results');
    return {
      cardHtml: watchGrid.innerHTML,
      cardText: watchGrid.textContent,
      searchHtml: searchResults.innerHTML,
      searchText: searchResults.textContent,
      injectedElements: document.querySelectorAll(
        '#watch-grid img[src="x"], #watch-grid svg[onload], #watch-grid script, ' +
        '#wl-search-results img[src="x"], #wl-search-results svg[onload], #wl-search-results script'
      ).length,
      executed: window.__storedXss,
    };
  });

  expect(result.cardText).toContain('<img src=x onerror="window.__storedXss=1">');
  expect(result.cardText).toContain('<svg onload="window.__storedXss=2">');
  expect(result.searchText).toContain('<img src=x onerror="window.__storedXss=1">');
  expect(result.searchText).toContain('<svg onload="window.__storedXss=2">');
  expect(result.cardHtml).toContain('&lt;img');
  expect(result.searchHtml).toContain('&lt;img');
  expect(result.injectedElements).toBe(0);
  expect(result.executed).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('persisted reports, collections, schemes, imports, content, alerts, and notifications remain inert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '浏览只读演示' }).click();

  const result = await page.evaluate(async () => {
    window.__storedXss = 0;
    const attack = '<img src=x onerror="window.__storedXss=1"><svg onload="window.__storedXss=2"></svg></option><script>window.__storedXss=3</script>';
    const folderAttack = '收藏夹 ' + attack;
    const schemeAttack = '对比方案 ' + attack;
    const ensure = (id, tag = 'div') => {
      let node = document.getElementById(id);
      if (!node) {
        node = document.createElement(tag);
        node.id = id;
        document.body.appendChild(node);
      }
      return node;
    };
    const favoritePanel = ensure('ct-fav-panel');
    const favoriteFolders = ensure('ct-fav-folders');
    const favoriteItems = ensure('ct-fav-items');
    favoritePanel.replaceChildren(favoriteFolders, favoriteItems);
    ['cmp-picker', 'cmp-selected', 'cmp-schemes-list', 'cmp-result', 'ct-card-grid', 'ct-modal-title',
      'ct-modal-body', 'ct-modal-overlay', 'ct-live-grid'].forEach((id) => ensure(id));
    ['ct-cr-platform', 'ct-cr-market', 'ct-cr-cat'].forEach((id) => ensure(id, 'select'));
    ensure('ct-creator-table', 'tbody');

    window.jayReportsCache = [{
      id: 'stored-report-xss', name: '报告 ' + attack, market_codes: ['US'],
      date: '2026-09-09T00:00:00Z', revision: 1, publishable: false,
      saveStatus: 'blocked', cloudSaved: false, text: '# 安全正文',
    }];
    window.rpV2LoadRecent();

    window.ctFavFolders = [folderAttack];
    window.ctFavItems = { [folderAttack]: [{ title: '收藏内容 ' + attack }] };
    window.ctActiveFolder = folderAttack;
    window.ctRenderFavFolders();

    window.jayWorkspaceAssetCache.comparison_schemes = {
      [schemeAttack]: { mode: 'product', sel: ['商品 ' + attack, '安全商品'], ts: Date.now() },
    };
    window.cmpRenderSchemes();

    window.prImportPayload({
      products: [{
        商品名: '商品 ' + attack, 市场: '美国', 平台: 'Amazon', 类目: '宠物用品',
        店铺: '店铺 ' + attack, 售价: '$19.99', 销量: '10', 更新时间: '2026-09-09',
      }],
      shops: [{
        店铺名: '店铺 ' + attack, 市场: '美国', 平台: 'Amazon', 主营类目: '品类 ' + attack,
        标签: '标签 ' + attack, 更新时间: '2026-09-09',
      }],
    }, 'stored-xss.json');
    window.prRenderTable(window.prScopedProducts());
    window.prShowDetail(0);
    const productDetailHtml = document.getElementById('pr-modal-content').innerHTML;
    window.shShowDetail(0);
    const shopDetailHtml = document.getElementById('sh-modal-body').innerHTML;
    window.shRenderCompareTab();
    const compareOptionsHtml = document.getElementById('sh-compare-panel').innerHTML;
    window.cmpSwitch('product');
    window.cmpState.sel = ['商品 ' + attack, '安全商品'];
    window.cmpRenderSelected();

    const content = ['内容 ' + attack, 'Amazon', '美国', '短视频', '1', '10', '2026-09-09',
      '创作者 ' + attack, '带货 ' + attack, '2', '宠物用品', '测评 ' + attack, '5', '店铺 ' + attack, '上升'];
    content.source_kind = 'uploaded';
    content.source_type = 'user_upload';
    content.verification_status = 'uploaded';
    content.source_record_id = 'stored-content-xss';
    window.jaySetContentRecords([content]);
    window.ctRenderCards([{ c: content, idx: 0 }]);
    window.ctShowDetail(0);
    window.ctRenderCreator();
    window.ctLiveData = [{
      title: '直播 ' + attack, creator: '主播 ' + attack, platform: 'Amazon', market: '美国',
      duration: attack, style: attack, peakViewers: attack, totalViews: attack, gmv: attack,
      products: attack, date: attack, verification_status: 'uploaded', source_file: 'live.csv',
    }];
    window.ctRenderLive();

    window.replaceScopedAlertData([{
      id: 'stored-alert-xss', type: 'policy" onmouseover="window.__storedXss=5', level: 'high" onmouseover="window.__storedXss=6', title: '数据库预警 ' + attack,
      market_code: 'US', country: '美国', platform: '-', detail: '数据库摘要 ' + attack, date: attack,
      source: '来源 ' + attack, source_url: 'javascript:alert(1)', source_kind: 'derived',
      source_type: 'derived', source_record_id: 'stored-alert-source', verification_status: 'verified',
      verified_at: '2026-09-09T00:00:00Z', published_at: '2026-09-09',
      collected_at: '2026-09-09T00:00:00Z', evidence_hash: 'a'.repeat(64),
    }]);
    window.dynamicAlerts.splice(0, window.dynamicAlerts.length);
    window.alCurrentTab = 'all';
    window.renderAlerts();

    window.jayNotificationsCache = [{
      id: "notification');window.__storedXss=4;//", event_type: 'policy', severity: 'critical',
      title: '数据库通知 ' + attack, read_at: null,
    }];
    window.jayRenderBell();

    // Render the persisted structures a second time to simulate hydration after a refresh.
    window.rpV2LoadRecent();
    window.ctRenderFavFolders();
    window.cmpRenderSchemes();
    window.jayRenderBell();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const roots = [
      '#rp-v2-recent-list', '#ct-fav-panel', '#cmp-schemes-list', '#cmp-picker', '#cmp-selected',
      '#pr-table-body', '#pr-modal-content', '#shop-table', '#sh-modal-body', '#sh-compare-panel',
      '#ct-card-grid', '#ct-modal-body', '#ct-creator-table', '#ct-live-grid', '#al-summary', '#al-list', '#bell-panel',
    ];
    const selector = roots.map((root) => `${root} img[src="x"], ${root} svg[onload], ${root} script`).join(', ');
    return {
      executed: window.__storedXss,
      injectedElements: document.querySelectorAll(selector).length,
      reportText: document.getElementById('rp-v2-recent-list').textContent,
      favoriteText: document.getElementById('ct-fav-panel').textContent,
      schemeText: document.getElementById('cmp-schemes-list').textContent,
      productDetailHtml,
      shopDetailHtml,
      compareOptionsHtml,
      contentText: document.getElementById('ct-card-grid').textContent + document.getElementById('ct-modal-body').textContent,
      alertText: document.getElementById('al-list').textContent,
      alertLinks: Array.from(document.querySelectorAll('#al-list a')).map((link) => link.getAttribute('href')),
      notificationText: document.getElementById('bell-panel').textContent,
    };
  });

  expect(result.executed).toBe(0);
  expect(result.injectedElements).toBe(0);
  expect(result.reportText).toContain('<img src=x');
  expect(result.favoriteText).toContain('<img src=x');
  expect(result.schemeText).toContain('<img src=x');
  expect(result.productDetailHtml).toContain('&lt;img');
  expect(result.shopDetailHtml).toContain('&lt;img');
  expect(result.compareOptionsHtml).toContain('&lt;img');
  expect(result.contentText).toContain('<img src=x');
  expect(result.alertText).toContain('<img src=x');
  expect(result.alertLinks).not.toContain('javascript:alert(1)');
  expect(result.notificationText).toContain('<img src=x');
  expect(pageErrors).toEqual([]);
});

test('persisted attack text stays inert after a real page reload', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  const attack = '<img src=x onerror="window.__storedXss=1"><svg onload="window.__storedXss=2"></svg>';
  await page.evaluate((value) => {
    localStorage.setItem('jay_search_history', JSON.stringify([value]));
  }, attack);

  await page.reload();
  await page.getByRole('button', { name: '浏览只读演示' }).click();
  const result = await page.evaluate(async () => {
    window.__storedXss = 0;
    let box = document.getElementById('search-history');
    if (!box) {
      box = document.createElement('div');
      box.id = 'search-history';
      document.body.appendChild(box);
    }
    window.jayRenderSearchHistory();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      text: box.textContent,
      html: box.innerHTML,
      injectedElements: box.querySelectorAll('img[src="x"], svg[onload], script').length,
      executed: window.__storedXss,
    };
  });

  expect(result.text).toContain('<img src=x');
  expect(result.html).toContain('&lt;img');
  expect(result.injectedElements).toBe(0);
  expect(result.executed).toBe(0);
  expect(pageErrors).toEqual([]);
});
