/*
 * Report engine
 *
 * The report page is an orchestration surface. This module owns the report
 * contract so a new market, platform, category or report purpose does not
 * require another hard-coded prompt. It deliberately uses plain objects and
 * pure helpers so the same checks can run before an AI request and during
 * export/acceptance tests.
 */
(function (root) {
  'use strict';

  var ENGINE_VERSION = '3.1';
  var SECTION_USER_PROMPT_LIMIT = 24000;
  var SECTION_CUSTOM_PROMPT_LIMIT = 2000;
  var SECTION_RECORD_LIMIT = 80;
  var CORE_SECTIONS = [
    { id: 'executive_summary', title: '执行摘要', domain: 'summary', required: true },
    { id: 'methodology', title: '研究方法与范围', domain: 'method', required: true },
    { id: 'scope', title: '适用范围与边界', domain: 'scope', required: true },
    { id: 'risk_recommendations', title: '风险与行动建议', domain: 'risk', required: true },
    { id: 'actions', title: '行动清单', domain: 'action', required: true },
    { id: 'sources', title: '来源与核验说明', domain: 'source', required: true }
  ];
  var MODULES = {
    market_environment: { title: '目标市场环境', domain: 'market' },
    market_comparison: { title: '市场比较矩阵', domain: 'market' },
    competitor_research: { title: '竞品与竞争格局', domain: 'competitor' },
    consumer_needs: { title: '消费者需求与痛点', domain: 'consumer' },
    consumer_profile: { title: '消费者画像', domain: 'consumer' },
    platform_research: { title: '平台与渠道分析', domain: 'platform' },
    product_fit: { title: '产品适配性分析', domain: 'product' },
    category_overview: { title: '品类机会概览', domain: 'category' },
    price_band: { title: '价格带与定价', domain: 'financial' },
    unit_economics: { title: '单位经济模型', domain: 'financial' },
    access_requirements: { title: '准入、认证与标签', domain: 'access' },
    logistics: { title: '物流与履约', domain: 'logistics' },
    seasonality: { title: '季节性与营销节点', domain: 'consumer' },
    risk_recommendations: { title: '风险与行动建议', domain: 'risk' }
  };
  var PURPOSE_MODULES = {
    'market-entry': ['market_environment', 'market_comparison', 'platform_research', 'access_requirements', 'logistics', 'risk_recommendations'],
    'market-research': ['market_environment', 'market_comparison', 'competitor_research', 'consumer_needs', 'platform_research', 'product_fit', 'risk_recommendations'],
    'product-research': ['category_overview', 'market_environment', 'consumer_needs', 'platform_research', 'price_band', 'unit_economics', 'access_requirements', 'risk_recommendations'],
    'competitor-analysis': ['competitor_research', 'consumer_needs', 'platform_research', 'price_band', 'risk_recommendations'],
    'content-marketing': ['consumer_profile', 'competitor_research', 'platform_research', 'price_band', 'risk_recommendations']
  };
  var PURPOSE_REQUIRED_DOMAINS = {
    'product-research': ['market', 'policy', 'platform', 'rule', 'product', 'financial'],
    'competitor-analysis': ['market', 'platform', 'rule', 'competitor'],
    'content-marketing': ['market', 'platform', 'content'],
    'market-entry': ['market', 'policy', 'platform', 'rule', 'access', 'logistics'],
    'market-research': ['market', 'policy', 'platform', 'rule']
  };

  function list(value) { return Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]); }
  function uniq(values) { return list(values).filter(function (value, index, arr) { return value != null && value !== '' && arr.indexOf(value) === index; }); }
  function text(value) { return value == null ? '' : String(value); }
  function lower(value) { return text(value).trim().toLowerCase(); }
  function number(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null;
    var raw = text(value).replace(/[,￥¥$€£%\s]/g, '');
    if (!raw || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
    var parsed = Number(raw);
    return isFinite(parsed) ? parsed : null;
  }
  function isoNow() { return new Date().toISOString(); }
  function api() { return root.JAY_MARKET_SCOPE_API || {}; }
  function activeContext(context) {
    context = context || (api().getActiveContext ? api().getActiveContext() : root.JAY_MARKET_SCOPE || {});
    var markets = list(context.marketCodes || context.market_codes || context.markets || context.market).map(function (item) {
      return api().normalizeMarketCode ? api().normalizeMarketCode(item && item.code || item) : text(item && item.code || item).toUpperCase();
    }).filter(Boolean);
    var marketNames = list(context.marketNames || context.market_names).filter(Boolean);
    if (!markets.length && api().getActiveMarkets) markets = api().getActiveMarkets().map(function (item) { return item.code; });
    if (!marketNames.length && api().getActiveMarkets) marketNames = api().getActiveMarkets().map(function (item) { return item.name || item.label || item.code; });
    var platforms = list(context.platformKeys || context.platform_keys || context.platforms).map(function (item) {
      return api().normalizePlatformKey ? api().normalizePlatformKey(item && item.key || item) : lower(item && item.key || item);
    }).filter(Boolean);
    if (!platforms.length && api().getActivePlatforms) platforms = api().getActivePlatforms().map(function (item) { return item.key; });
    var platformNames = list(context.platformNames || context.platform_names).filter(Boolean);
    if (!platformNames.length && api().getActivePlatforms) platformNames = api().getActivePlatforms().map(function (item) { return item.name || item.key; });
    var categories = list(context.categoryCodes || context.category_codes || context.categories).map(function (item) {
      return api().normalizeCategoryCode ? api().normalizeCategoryCode(item && item.code || item) : lower(item && item.code || item);
    }).filter(Boolean);
    return {
      marketCodes: uniq(markets), marketNames: uniq(marketNames), platformKeys: uniq(platforms), platformNames: uniq(platformNames), categoryCodes: uniq(categories),
      scopeVersion: context.scopeVersion || context.scope_version || api().configVersion || ''
    };
  }
  function domainForType(type) {
    return ({ country: 'market', macro: 'market', policy: 'policy', tax: 'tax', access: 'access', platform: 'platform', rule: 'rule', alert: 'alert', product: 'product', shop: 'competitor', content: 'content', category: 'category' })[lower(type)] || 'other';
  }
  function formal(record, domain, context) {
    if (!record || typeof record !== 'object') return false;
    var quality = api().getRecordQuality ? api().getRecordQuality(record, { domain: domain, requireScope: false }) : null;
    if (quality) return quality.formal;
    var status = lower(record.verification_status || record.verificationStatus || record.status);
    return ['verified', 'uploaded'].indexOf(status) >= 0 && !!(record.source_url || record.sourceUrl || record.source_record_id || record.sourceRecordId || record.source_file || record.sourceFile);
  }
  function recordScopeCategories(record, domain) {
    var explicit = record && (record.category_codes || record.categoryCodes || record.categories || record.category_code || record.categoryCode);
    // Policy/rule/tax/access `category` values describe the record type (for
    // example regulation, fee or labeling), not the selected product category.
    // Product-like material records still use their legacy category fields.
    if (explicit != null && explicit !== '') return list(explicit);
    if (['product', 'competitor', 'content', 'category', 'other'].indexOf(domain) >= 0) {
      return list(record && (record.category || record.subcategory || record.snapshot_category));
    }
    return [];
  }
  function matches(record, context, domain) {
    if (!record) return false;
    if (api().recordMatchesContext) return api().recordMatchesContext(record, context, { allowGlobal: false });
    var markets = list(record.market_codes || record.marketCodes || record.market_code || record.market || record.region || record.snapshot_market).map(function (item) { return upperCode(item && item.code || item); });
    if (markets.length && !markets.some(function (item) { return context.marketCodes.indexOf(item) >= 0; })) return false;
    var platforms = list(record.platform_keys || record.platformKeys || record.platform_key || record.platform || record.snapshot_platform).map(function (item) { return api().normalizePlatformKey ? api().normalizePlatformKey(item && item.key || item) : lower(item && item.key || item); }).filter(Boolean);
    if (platforms.length && context.platformKeys.length && !platforms.some(function (item) { return context.platformKeys.indexOf(item) >= 0; })) return false;
    var categories = recordScopeCategories(record, domain).map(function (item) { return api().normalizeCategoryCode ? api().normalizeCategoryCode(item && item.code || item) : lower(item && item.code || item); }).filter(Boolean);
    if (categories.length && context.categoryCodes.length && !categories.some(function (item) { return context.categoryCodes.indexOf(item) >= 0; })) return false;
    return true;
  }
  function upperCode(value) { return text(value).trim().toUpperCase(); }

  function getTemplate(context, selected) {
    var current = activeContext(context);
    var selectedTemplate = selected || context && (context.templateId || context.template_id || context.template);
    var template = api().getReportTemplate && selectedTemplate ? api().getReportTemplate(selectedTemplate, { categoryCodes: current.categoryCodes }) : null;
    if (!template && api().getReportTemplates) {
      var candidates = api().getReportTemplates({ categoryCodes: current.categoryCodes });
      template = candidates.find(function (item) { return item.code === selectedTemplate; }) || candidates.find(function (item) { return item.code === 'market-research'; }) || candidates[0];
    }
    template = template || { id: selectedTemplate || 'market-research-v1', code: selectedTemplate || 'market-research', version: 1, name: '市场调研报告', modules: PURPOSE_MODULES['market-research'], requiredDomains: ['market', 'policy', 'platform', 'rule'], categoryCodes: [] };
    var normalizedModules = uniq(template.modules || template.sections || PURPOSE_MODULES[template.code] || PURPOSE_MODULES['market-research']);
    return Object.assign({}, template, {
      id: template.id || template.code,
      code: template.code || template.id,
      version: Number(template.version || 1),
      modules: normalizedModules,
      sections: normalizedModules,
      requiredDomains: uniq(template.requiredDomains || template.required_domains || [])
    });
  }

  function buildPlan(context, selected, purpose) {
    var scope = activeContext(context);
    var template = getTemplate(context || {}, selected);
    var templateMarkets = list(template.marketCodes || template.market_codes).map(function (value) { return api().normalizeMarketCode ? api().normalizeMarketCode(value) : upperCode(value); }).filter(Boolean);
    var templatePlatforms = list(template.platformKeys || template.platform_keys).map(function (value) { return api().normalizePlatformKey ? api().normalizePlatformKey(value) : lower(value); }).filter(Boolean);
    if (templateMarkets.length) {
      var marketPairs = scope.marketCodes.map(function (code, index) { return { code: code, name: scope.marketNames[index] || code }; }).filter(function (pair) { return templateMarkets.indexOf(pair.code) >= 0; });
      scope.marketCodes = marketPairs.map(function (pair) { return pair.code; });
      scope.marketNames = marketPairs.map(function (pair) { return pair.name; });
    }
    if (templatePlatforms.length) scope.platformKeys = scope.platformKeys.filter(function (key) { return templatePlatforms.indexOf(key) >= 0; });
    var modules = (purpose && PURPOSE_MODULES[purpose]) || PURPOSE_MODULES[template.code] || template.modules || PURPOSE_MODULES['market-research'];
    modules = uniq(modules);
    // The template controls ordering, while the shared core is always present.
    var sections = CORE_SECTIONS.filter(function (section) { return section.id !== 'risk_recommendations' || modules.indexOf('risk_recommendations') < 0; }).concat(modules.map(function (id) {
      var definition = MODULES[id] || { title: id, domain: id };
      return { id: id, title: definition.title, domain: definition.domain, required: true };
    }));
    var seenSections = {};
    sections = sections.filter(function (section) { if (seenSections[section.id]) return false; seenSections[section.id] = true; return true; });
    if (scope.marketCodes.length > 1 && sections.every(function (section) { return section.id !== 'market_comparison'; })) sections.splice(2, 0, { id: 'market_comparison', title: '市场比较矩阵', domain: 'market', required: true });
    if (scope.marketCodes.length < 2) sections = sections.filter(function (section) { return section.id !== 'market_comparison'; });
    if (scope.marketCodes.length > 1) scope.marketCodes.forEach(function (code) {
      var market = api().getMarket && api().getMarket(code);
      sections.push({ id: 'market_' + code.toLowerCase(), title: (market && (market.name || market.label) || code) + '市场分析', domain: 'market', marketCode: code, required: true });
    });
    // Platform and category chapters are data-driven from the active scope.
    // A chapter is still rendered when its records are empty so the report
    // says "待补充" for that platform/category instead of borrowing another.
    scope.platformKeys.forEach(function (key) {
      var platform = api().getPlatform && api().getPlatform(key);
      sections.push({ id: 'platform_' + key, title: (platform && (platform.name || platform.label) || key) + '平台分析', domain: 'platform', platformKey: key, required: false });
    });
    scope.categoryCodes.forEach(function (code) {
      var category = api().getCategoryProfile && api().getCategoryProfile(code);
      sections.push({ id: 'category_' + code, title: (category && (category.name || category.label) || code) + '品类分析', domain: 'category', categoryCode: code, required: false });
    });
    var selectedPurpose = purpose || template.code;
    var requiredDomains = PURPOSE_REQUIRED_DOMAINS[selectedPurpose] || template.requiredDomains;
    return { engineVersion: ENGINE_VERSION, template: template, purpose: selectedPurpose, scope: scope, sections: sections, requiredDomains: uniq(requiredDomains) };
  }

  function sourceFrom(record, fallback) {
    var source = record && (record.source || record.source_name || record.sourceName || record.snapshot_source) || fallback || '';
    var url = record && (record.source_url || record.sourceUrl || record.url) || '';
    var date = record && (record.published_at || record.publishedAt || record.effective_date || record.effectiveDate || record.snapshot_at || record.snapshotAt || record.collected_at || record.collectedAt) || '';
    var status = record && (record.verification_status || record.verificationStatus || record.status) || 'pending';
    var kind = record && (record.source_kind || record.sourceKind || record.source_type || record.sourceType) || '';
    return {
      source: text(source), url: text(url), date: text(date), verificationStatus: text(status), sourceKind: text(kind),
      sourceType: text(record && (record.source_type || record.sourceType || '')),
      verifiedAt: text(record && (record.verified_at || record.verifiedAt || '')),
      collectedAt: text(record && (record.collected_at || record.collectedAt || '')),
      publishedAt: text(record && (record.published_at || record.publishedAt || '')),
      evidenceHash: text(record && (record.evidence_hash || record.evidenceHash || '')),
      recordId: text(record && (record.source_record_id || record.sourceRecordId || record.id || '')),
      snapshotId: text(record && (record.snapshot_id || record.snapshotId || record.source_record_id || record.sourceRecordId || record.id || '')),
      snapshotAt: text(record && (record.snapshot_at || record.snapshotAt || record.collected_at || record.collectedAt || ''))
    };
  }
  function compactRecord(record) {
    record = record || {};
    var allowed = ['id', 'record_key', 'title', 'title_zh', 'name', 'summary', 'summary_zh', 'value', 'unit', 'date', 'published_at', 'effective_date', 'market', 'market_code', 'market_codes', 'platform', 'platform_key', 'platform_keys', 'category', 'category_code', 'category_codes', 'fee', 'feeDesc', 'fee_desc', 'requirement_type', 'tax_type', 'impact_level', 'snapshot_type'];
    var copy = {};
    allowed.forEach(function (key) { if (record[key] != null && record[key] !== '') copy[key] = typeof record[key] === 'string' && record[key].length > 480 ? record[key].slice(0, 480) + '…' : record[key]; });
    // Reports are generated in Chinese. Avoid sending the source-language
    // duplicate when a verified Chinese title or summary is already present.
    if (copy.title_zh) delete copy.title;
    if (copy.summary_zh) delete copy.summary;
    return copy;
  }
  function addRecord(bucket, domain, record, origin) {
    if (!bucket[domain]) bucket[domain] = [];
    bucket[domain].push({ domain: domain, record: record, source: sourceFrom(record, origin), origin: origin || '' });
  }

  function collectFacts(context, materials) {
    var scope = activeContext(context);
    var records = {};
    var sources = [];
    list(materials).forEach(function (material) {
      var domain = domainForType(material.type || material.item_type);
      if (!formal(material, domain, scope) || !matches(material, scope, domain)) return;
      addRecord(records, domain, material, '素材池');
    });
    // Country commerce data is already filtered and provenance-checked by the
    // country page. It is retained as structured facts, never as prose.
    if (root.jayGetCountryCommerceState) {
      scope.marketCodes.forEach(function (code) {
        var state = root.jayGetCountryCommerceState(code) || {};
        list(state.rows).forEach(function (row) { if (formal(row, 'market', scope)) addRecord(records, 'market', Object.assign({}, row, { market_code: code, source_url: row.sourceUrl || row.source_url, verification_status: row.verificationStatus || 'verified' }), '电商市场环境'); });
      });
    }
    var policyItems = root.policiesJsonData && root.policiesJsonData.items;
    if (Array.isArray(policyItems)) policyItems.forEach(function (item) {
      var relevant = typeof root.plIsCrossBorderPolicy !== 'function' || root.plIsCrossBorderPolicy(item);
      if (relevant && formal(item, 'policy', scope) && matches(item, scope, 'policy')) addRecord(records, 'policy', item, '政策数据集');
    });
    var taxItems = root.taxesJsonData && root.taxesJsonData.items;
    if (Array.isArray(taxItems)) taxItems.forEach(function (item) { if (formal(item, 'tax', scope) && matches(item, scope, 'tax')) addRecord(records, 'tax', item, '税收数据集'); });
    var accessItems = root.accessRequirementsJsonData && root.accessRequirementsJsonData.items;
    if (Array.isArray(accessItems)) accessItems.forEach(function (item) { if (formal(item, 'access', scope) && matches(item, scope, 'access')) addRecord(records, 'access', item, '准入数据集'); });
    var ruleItems = root.rulesJsonData && root.rulesJsonData.items;
    if (Array.isArray(ruleItems)) ruleItems.forEach(function (item) {
      if (!formal(item, 'rule', scope) || !matches(item, scope, 'rule')) return;
      addRecord(records, 'rule', item, '平台规则数据集');
      // A platform chapter may use a verified rule record as evidence for the
      // platform offering itself. It never invents fees or traffic metrics.
      var rulePlatform = api().normalizePlatformKey ? api().normalizePlatformKey(item.platform || item.platform_key) : lower(item.platform || item.platform_key);
      if (rulePlatform && scope.platformKeys.indexOf(rulePlatform) >= 0) addRecord(records, 'platform', Object.assign({}, item, { platform_key: rulePlatform }), '平台规则数据集');
    });
    var financial = financialFromFacts({ records: records });
    if (financial.status === 'complete') addRecord(records, 'financial', financial, '程序化财务计算');
    Object.keys(records).forEach(function (domain) { records[domain].forEach(function (entry) { sources.push(Object.assign({ domain: domain }, entry.source)); }); });
    return { scope: scope, records: records, sources: sources, collectedAt: isoNow() };
  }

  function checkData(plan, facts) {
    plan = plan || {}; facts = facts || { records: {} };
    var records = facts.records || {};
    var missing = [];
    var warnings = [];
    var blockedDomains = [];
    uniq(plan.requiredDomains || []).forEach(function (domain) {
      if (!list(records[domain]).length) missing.push({ domain: domain, label: (MODULES[domain] && MODULES[domain].title) || domain, reason: '当前范围没有已核验记录' });
    });
    ['tax', 'access'].forEach(function (domain) {
      if (!list(records[domain]).length) {
        blockedDomains.push(domain);
        warnings.push({ domain: domain, label: (domain === 'tax' ? '税收与关税' : '准入、认证与标签'), reason: '数据尚未接入；禁止生成确定性税率、费用或准入结论' });
      }
    });
    var scope = facts.scope || {};
    if (!list(scope.marketCodes).length) missing.push({ domain: 'scope', label: '市场范围', reason: '未选择目标市场' });
    if (!list(scope.platformKeys).length) warnings.push({ domain: 'scope', label: '平台范围', reason: '未配置可用平台' });
    Object.keys(records).forEach(function (domain) {
      records[domain].forEach(function (entry) {
        if (!entry.source || !entry.source.url && !entry.source.recordId) warnings.push({ domain: domain, label: domain, reason: '存在记录但缺少可追溯来源' });
      });
    });
    var total = Object.keys(records).reduce(function (sum, domain) { return sum + records[domain].length; }, 0);
    return { ok: missing.length === 0, missing: missing, warnings: warnings, blockedDomains: blockedDomains, recordCount: total, requiredCount: uniq(plan.requiredDomains || []).length, checkedAt: isoNow() };
  }

  function calculateFinancialModel(input) {
    input = input || {};
    var sellingPrice = number(input.sellingPrice != null ? input.sellingPrice : input.selling_price);
    var productCost = number(input.productCost != null ? input.productCost : input.product_cost);
    var logisticsCost = number(input.logisticsCost != null ? input.logisticsCost : input.logistics_cost);
    var platformFeeRate = number(input.platformFeeRate != null ? input.platformFeeRate : input.platform_fee_rate);
    var platformFee = number(input.platformFee != null ? input.platformFee : input.platform_fee);
    var taxRate = number(input.taxRate != null ? input.taxRate : input.tax_rate);
    var tax = number(input.tax);
    var adCost = number(input.adCost != null ? input.adCost : input.ad_cost);
    var otherCost = number(input.otherCost != null ? input.otherCost : input.other_cost) || 0;
    var units = number(input.monthlyUnits != null ? input.monthlyUnits : input.monthly_units);
    var initialInvestment = number(input.initialInvestment != null ? input.initialInvestment : input.initial_investment);
    var missing = [];
    if (sellingPrice == null) missing.push('sellingPrice');
    if (productCost == null) missing.push('productCost');
    if (logisticsCost == null) missing.push('logisticsCost');
    if (platformFee == null && platformFeeRate == null) missing.push('platformFeeRate');
    if (tax == null && taxRate != null && sellingPrice != null) tax = sellingPrice * taxRate / 100;
    if (tax == null) tax = 0;
    if (platformFee == null && platformFeeRate != null && sellingPrice != null) platformFee = sellingPrice * platformFeeRate / 100;
    if (platformFee == null) platformFee = 0;
    if (adCost == null) adCost = 0;
    if (missing.length) return { status: 'incomplete', missing: missing, currency: input.currency || 'USD' };
    var totalCost = productCost + logisticsCost + platformFee + tax + adCost + otherCost;
    var unitProfit = sellingPrice - totalCost;
    var margin = sellingPrice ? unitProfit / sellingPrice * 100 : null;
    var monthlyProfit = units == null ? null : unitProfit * units;
    var paybackMonths = monthlyProfit && initialInvestment != null ? initialInvestment / monthlyProfit : null;
    function scenario(multiplier) { var price = sellingPrice * multiplier; var fee = platformFeeRate != null ? price * platformFeeRate / 100 : platformFee; var t = taxRate != null ? price * taxRate / 100 : tax; var profit = price - productCost - logisticsCost - fee - t - adCost - otherCost; return { multiplier: multiplier, sellingPrice: price, unitProfit: profit, margin: price ? profit / price * 100 : null }; }
    return { status: 'complete', currency: input.currency || 'USD', sellingPrice: sellingPrice, productCost: productCost, logisticsCost: logisticsCost, platformFee: platformFee, platformFeeRate: platformFeeRate, tax: tax, taxRate: taxRate, adCost: adCost, otherCost: otherCost, totalCost: totalCost, unitProfit: unitProfit, margin: margin, monthlyUnits: units, monthlyProfit: monthlyProfit, initialInvestment: initialInvestment, paybackMonths: paybackMonths, sensitivity: [scenario(0.9), scenario(1), scenario(1.1)] };
  }

  function materialFinancialInput(record) {
    var input = Object.assign({}, record || {});
    var snapshot = record && (record.snapshot_data || record.snapshotData);
    var raw = snapshot && snapshot.raw && typeof snapshot.raw === 'object' ? snapshot.raw : (record && record.raw && typeof record.raw === 'object' ? record.raw : {});
    Object.keys(raw).forEach(function (key) { if (input[key] == null || input[key] === '') input[key] = raw[key]; });
    var row = snapshot && Array.isArray(snapshot.row) ? snapshot.row : null;
    if (input.sellingPrice == null && input.selling_price == null && row) input.sellingPrice = row[6];
    if (input.productCost == null && input.product_cost == null) input.productCost = raw['产品成本'] || raw['成本'] || raw.cost || raw.product_cost;
    if (input.monthlyUnits == null && input.monthly_units == null) input.monthlyUnits = raw.monthlyUnits || raw.monthly_units || raw.sales;
    return input;
  }

  function financialFromFacts(facts) {
    var candidates = [];
    list((facts && facts.records && facts.records.product) || []).forEach(function (entry) { candidates.push(materialFinancialInput(entry.record)); });
    var input = candidates.find(function (record) { return calculateFinancialModel(record).status === 'complete'; });
    return input ? calculateFinancialModel(input) : { status: 'not_available', missing: ['sellingPrice', 'productCost', 'logisticsCost', 'platformFeeRate'] };
  }

  function sourceKey(source) {
    source = source || {};
    return [source.domain, source.url, source.recordId, source.source].map(text).join('|');
  }

  function buildSourceAppendix(facts) {
    var seen = {};
    return list(facts && facts.sources).filter(function (source) {
      var key = sourceKey(source);
      if (seen[key]) return false; seen[key] = true; return !!(source.url || source.recordId || source.source);
    }).map(function (source, index) {
      return Object.assign({
        index: index + 1,
        citation: 'S' + String(index + 1).padStart(3, '0'),
        dataSnapshotAt: source.snapshotAt || facts && facts.collectedAt || '',
        originalUrl: source.url || ''
      }, source);
    });
  }

  function citationForSource(source, appendix) {
    var key = sourceKey(source);
    var match = list(appendix).find(function (item) { return sourceKey(item) === key; });
    return match && match.citation || '';
  }

  function auditCitations(sections, appendix) {
    var valid = list(appendix).map(function (source) { return source.citation; }).filter(Boolean);
    var used = [];
    var invalid = [];
    var missingNumericCitations = [];
    list(sections).forEach(function (section) {
      var sectionId = section && section.id || '';
      var exempt = ['methodology', 'scope', 'sources'].indexOf(sectionId) >= 0;
      text(section && section.text).split(/\r?\n/).forEach(function (line) {
        var citations = [];
        line.replace(/\[(S\d{3})\]/g, function (_, citation) { citations.push(citation); return _; });
        citations.forEach(function (citation) {
          if (valid.indexOf(citation) < 0) invalid.push({ section: sectionId, citation: citation });
          else used.push(citation);
        });
        if (exempt || !line.trim() || /^\s*(?:#{1,4}\s+|\|?\s*:?-{2,})/.test(line)) return;
        var auditLine = line;
        var dateOnlyTableLead = /(?:数据|指标|统计).*(?:如下|见下)[：:]?\s*$/.test(auditLine);
        if (/数据快照(?:时间)?|数据截至|数据时间|生成日期|当前日期|本快照时间|截至\s*[（(]?\d{4}/.test(auditLine) || dateOnlyTableLead) {
          auditLine = auditLine
            .replace(/\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日(?:\s*\d{1,2}(?::\d{2}){0,2}\s*(?:UTC)?)?)?/gi, '')
            .replace(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?/gi, '');
        }
        var factualNumber = /(?:[$￥¥€£]\s*\d|\d+(?:[,.]\d+)*(?:\s*(?:%|％|美元|美金|元|万|亿|百万|件|单|人|天|月|年|个|家|项|倍|bps|USD|CNY))|\d+\.\d+)/i.test(auditLine);
        if (factualNumber && !citations.some(function (citation) { return valid.indexOf(citation) >= 0; })) {
          missingNumericCitations.push({ section: sectionId, text: line.trim().slice(0, 240) });
        }
      });
    });
    used = uniq(used);
    return {
      ok: invalid.length === 0 && missingNumericCitations.length === 0,
      validCitations: valid,
      usedCitations: used,
      invalidCitations: invalid,
      missingNumericCitations: missingNumericCitations,
      coverage: valid.length ? Math.round(used.length / valid.length * 100) : 100,
      checkedAt: isoNow()
    };
  }

  function repairSectionCitations(sectionText, citationFacts, appendix) {
    var terms = ['amazon', '亚马逊', 'tiktok shop', 'tiktok', 'aliexpress', '速卖通', 'ebay', 'fba', 'sipp', 'cpsc', 'cpc', 'gcc', 'smart promotion', 'fb t', 'fbt', 'policy', 'policies', '政策', '法规', 'regulation', 'tariff', '关税', 'medium', 'high', 'low'];
    var genericTerms = ['policy', 'policies', '政策', '法规', 'regulation', 'tariff', '关税', 'medium', 'high', 'low'];
    function matchTerms(value) {
      var raw = lower(value);
      var matched = terms.filter(function (term) { return raw.indexOf(term) >= 0; });
      var specific = matched.filter(function (term) { return genericTerms.indexOf(term) < 0; });
      return specific.length ? specific : matched;
    }
    function matchNumbers(value) {
      var raw = text(value).replace(/^\s*(?:\*{1,2}|#{1,6}\s*)?\d+[.)、]\s*/, '');
      var dates = [];
      function addDate(year, month, day) {
        var yearValue = String(Number(year));
        var monthValue = String(Number(month));
        dates.push(yearValue);
        dates.push(yearValue + '-' + monthValue);
        if (day) dates.push(yearValue + '-' + monthValue + '-' + String(Number(day)));
        return ' ';
      }
      raw = raw.replace(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(?:至|到|[-—–~])\s*(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日/g, function (_match, startYear, startMonth, startDay, endYear, endMonth, endDay) {
        addDate(startYear, startMonth, startDay);
        return addDate(endYear || startYear, endMonth, endDay);
      });
      raw = raw.replace(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(?:至|到|[-—–~])\s*(\d{1,2})\s*月/g, function (_match, year, startMonth, endMonth) {
        addDate(year, startMonth);
        return addDate(year, endMonth);
      });
      raw = raw.replace(/(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/g, function (_match, year, month, day) {
        return addDate(year, month, day);
      });
      raw = raw.replace(/\b(\d{4})-(\d{1,2})(?:-(\d{1,2}))?\b/g, function (_match, year, month, day) {
        return addDate(year, month, day);
      });
      return uniq(dates.concat((raw.match(/\d+(?:[.,-]\d+)*/g) || []).map(function (item) {
        return item.split(/([.,-])/).map(function (part) { return /^\d+$/.test(part) ? String(Number(part)) : part; }).join('');
      })));
    }
    var valid = list(appendix).map(function (source) { return source.citation; }).filter(Boolean);
    var facts = list(citationFacts).filter(function (entry) { return entry && entry.source && valid.indexOf(entry.source.citation) >= 0; });
    var repairedCount = 0;
    var lines = text(sectionText).split(/\r?\n/).map(function (line) {
      var lineAudit = auditCitations([{ id: 'citation-repair', text: line }], appendix);
      if (!lineAudit.missingNumericCitations.length || lineAudit.invalidCitations.length) return line;
      var lineTerms = matchTerms(line);
      var lineNumbers = matchNumbers(line);
      if (!lineTerms.length || !lineNumbers.length) return line;
      var candidates = facts.map(function (entry) {
        var factText = JSON.stringify(entry.record || {}) + (entry.domain === 'policy' ? ' policy 政策' : ' ' + text(entry.domain));
        var factTerms = matchTerms(factText);
        var factNumbers = matchNumbers(factText);
        var sharedTerms = lineTerms.filter(function (term) { return factTerms.indexOf(term) >= 0; });
        var sharedNumbers = lineNumbers.filter(function (numberValue) { return factNumbers.indexOf(numberValue) >= 0; });
        return { citation: entry.source.citation, terms: sharedTerms, numbers: sharedNumbers };
      }).filter(function (entry) { return entry.terms.length && entry.numbers.length; });
      var missingTerms = lineTerms.slice();
      var missingNumbers = lineNumbers.slice();
      var selected = [];
      while ((missingTerms.length || missingNumbers.length) && selected.length < 3) {
        var ranked = candidates.filter(function (entry) { return selected.indexOf(entry) < 0; }).map(function (entry) {
          var newTerms = entry.terms.filter(function (term) { return missingTerms.indexOf(term) >= 0; });
          var newNumbers = entry.numbers.filter(function (numberValue) { return missingNumbers.indexOf(numberValue) >= 0; });
          return { entry: entry, gain: newTerms.length + newNumbers.length, numberGain: newNumbers.length };
        }).filter(function (entry) { return entry.gain > 0; }).sort(function (a, b) {
          return b.gain - a.gain || b.numberGain - a.numberGain;
        });
        if (!ranked.length) break;
        var chosen = ranked[0].entry;
        selected.push(chosen);
        missingTerms = missingTerms.filter(function (term) { return chosen.terms.indexOf(term) < 0; });
        missingNumbers = missingNumbers.filter(function (numberValue) { return chosen.numbers.indexOf(numberValue) < 0; });
      }
      if (missingTerms.length || missingNumbers.length) return line;
      var citations = uniq(selected.map(function (entry) { return entry.citation; }));
      repairedCount++;
      return line.replace(/\s+$/, '') + ' ' + citations.map(function (citation) { return '[' + citation + ']'; }).join('');
    });
    var repairedText = lines.join('\n');
    return { text: repairedText, repairedCount: repairedCount, audit: auditCitations([{ id: 'citation-repair', text: repairedText }], appendix) };
  }

  function scoreCompleteness(plan, check, appendix, facts) {
    plan = plan || {}; check = check || {}; appendix = appendix || [];
    var sections = list(plan.sections);
    var factRecords = (facts && facts.records) || {};
    var completedSections = sections.filter(function (section) { return section.required && !list(factRecords[section.domain]).length && ['summary', 'method', 'scope', 'source', 'risk', 'action'].indexOf(section.domain) < 0 ? false : true; }).length;
    var chapter = sections.length ? Math.round(completedSections / sections.length * 100) : 0;
    var required = Math.max(1, Number(check.requiredCount || list(plan.requiredDomains).length));
    var data = Math.round(Math.max(0, required - list(check.missing).length) / required * 100);
    var source = data ? Math.round(Math.min(100, appendix.length / Math.max(1, Number(check.recordCount || appendix.length)) * 100)) : 0;
    return { chapterCompletion: chapter, dataCoverage: data, sourceCoverage: source, overall: Math.round((chapter + data + source) / 3), missing: list(check.missing).map(function (item) { return item.label || item.domain; }) };
  }

  function checkScope(textValue, scope) {
    var raw = lower(textValue);
    scope = scope || activeContext();
    var violations = [];
    var marketNames = list(scope.marketNames).map(lower);
    var platformNames = list(scope.platformNames).map(lower);
    var knownMarkets = ['全球', 'global', '东南亚', '北美', '欧洲', '中东', '拉美', '日韩', '印尼', '印度尼西亚', '越南', '泰国', '马来西亚', '菲律宾', '新加坡', '日本', '韩国', '巴西', '墨西哥', '英国', '法国', '德国'];
    knownMarkets.forEach(function (value) { if (raw.indexOf(value) >= 0 && marketNames.indexOf(value) < 0) violations.push(value); });
    ['shopee', 'lazada', 'temu', 'walmart', 'shein', 'noon', 'mercado libre'].forEach(function (value) { if (raw.indexOf(value) >= 0 && platformNames.indexOf(value) < 0) violations.push(value); });
    return { ok: violations.length === 0, violations: uniq(violations) };
  }

  function reconcile(sections, facts, financial) {
    var values = [];
    var known = [];
    function numericTokens(value) {
      return text(value).match(/\d+(?:[,.]\d+)*(?:%|万|亿|百万|亿美元|美元|USD|\$|€|£)?/g) || [];
    }
    function normalizeNumeric(value) { return text(value).replace(/,/g, '').replace(/(USD|美元|\$|€|£|%|万|亿|百万)$/i, ''); }
    list(sections).forEach(function (section) { list(section.claims).forEach(function (fact) { if (fact && fact.value != null) known.push(text(fact.value)); }); });
    Object.keys((facts && facts.records) || {}).forEach(function (domain) {
      list(facts.records[domain]).forEach(function (entry) {
        numericTokens(JSON.stringify(entry && entry.record || {})).forEach(function (token) { known.push(token); });
      });
    });
    if (financial && financial.status === 'complete') ['sellingPrice', 'totalCost', 'unitProfit', 'margin', 'monthlyProfit', 'paybackMonths'].forEach(function (key) { if (financial[key] != null) known.push(String(Math.round(financial[key] * 100) / 100)); });
    var mismatches = [];
    list(sections).forEach(function (section) { list(section.claims).forEach(function (claim) {
      if (claim && claim.value != null && !known.some(function (value) { return value === text(claim.value); })) values.push({ section: section.id, value: claim.value });
    });
      numericTokens(section.text).forEach(function (token) {
        var normalized = normalizeNumeric(token);
        // Ignore single-digit list numbering and common Markdown bullets. Any
        // material metric, rate, date or currency figure must have a source.
        if (!normalized || (/^\d$/.test(normalized) && !/%|万|亿|美元|USD|\$|€|£/i.test(token))) return;
        var found = known.some(function (value) {
          var candidate = normalizeNumeric(value);
          return candidate === normalized || candidate.indexOf(normalized) >= 0 || normalized.indexOf(candidate) >= 0;
        });
        if (!found) values.push({ section: section.id, value: token });
      });
    });
    values.forEach(function (item) { mismatches.push({ section: item.section, value: item.value, reason: '未在结构化事实或程序化财务中找到依据' }); });
    return { ok: mismatches.length === 0, mismatches: mismatches, checkedAt: isoNow() };
  }

  function buildSectionPrompt(plan, section, facts, financial, custom) {
    var appendix = buildSourceAppendix(facts);
    var records = (facts && facts.records && facts.records[section.domain]) || [];
    if (['summary', 'risk', 'action'].indexOf(section.domain) >= 0) {
      var recordMap = (facts && facts.records) || {};
      var domains = ['market', 'policy', 'platform', 'rule', 'tax', 'access', 'logistics', 'category', 'product', 'competitor', 'content', 'alert', 'financial']
        .filter(function (domain) { return list(recordMap[domain]).length; });
      Object.keys(recordMap).forEach(function (domain) { if (domains.indexOf(domain) < 0 && list(recordMap[domain]).length) domains.push(domain); });
      records = [];
      for (var rowIndex = 0; records.length < SECTION_RECORD_LIMIT; rowIndex++) {
        var added = false;
        domains.forEach(function (domain) {
          if (records.length >= SECTION_RECORD_LIMIT) return;
          var entry = list(recordMap[domain])[rowIndex];
          if (entry) { records.push(entry); added = true; }
        });
        if (!added) break;
      }
    }
    if (section.domain === 'financial') records = records.concat((facts && facts.records && facts.records.product) || []);
    records = records.filter(function (entry) {
      var record = entry && entry.record || {};
      if (section.marketCode) {
        var markets = list(record.market_codes || record.marketCodes || record.market_code || record.market || record.region).map(upperCode);
        if (markets.length && markets.indexOf(upperCode(section.marketCode)) < 0) return false;
      }
      if (section.platformKey) {
        var platforms = list(record.platform_keys || record.platformKeys || record.platform_key || record.platform).map(function (value) { return api().normalizePlatformKey ? api().normalizePlatformKey(value) : lower(value); });
        if (platforms.length && platforms.indexOf(section.platformKey) < 0) return false;
      }
      if (section.categoryCode) {
        var categories = list(record.category_codes || record.categoryCodes || record.category_code || record.category).map(function (value) { return api().normalizeCategoryCode ? api().normalizeCategoryCode(value) : lower(value); });
        if (categories.length && categories.indexOf(section.categoryCode) < 0) return false;
      }
      return true;
    });
    var candidates = records.slice(0, SECTION_RECORD_LIMIT).map(function (entry) {
      var source = Object.assign({ domain: entry.domain || section.domain }, entry.source || {});
      source.citation = citationForSource(source, appendix);
      source.dataSnapshotAt = source.snapshotAt || facts && facts.collectedAt || '';
      source.originalUrl = source.url || '';
      return {
        domain: entry.domain || section.domain,
        record: compactRecord(entry.record),
        source: { citation: source.citation, dataSnapshotAt: source.dataSnapshotAt }
      };
    });
    function compactCitation(source) {
      return {
        citation: source.citation,
        source: source.source,
        url: source.url,
        date: source.date,
        verificationStatus: source.verificationStatus,
        sourceKind: source.sourceKind,
        sourceType: source.sourceType,
        recordId: source.recordId,
        dataSnapshotAt: source.dataSnapshotAt
      };
    }
    var payload = [];
    var citationCatalog = [];
    var citationSet = {};
    var customText = text(custom).slice(0, SECTION_CUSTOM_PROMPT_LIMIT);
    function promptBody(nextFacts, nextCatalog) {
      return {
        section: { id: section.id, title: section.title, domain: section.domain },
        scope: facts && facts.scope,
        dataSnapshotAt: facts && facts.collectedAt || '',
        citationCatalog: nextCatalog,
        facts: nextFacts,
        financial: section.domain === 'financial' ? financial : undefined,
        custom: customText
      };
    }
    candidates.forEach(function (candidate) {
      var nextCatalog = citationCatalog;
      var citation = candidate.source.citation;
      if (citation && !citationSet[citation]) {
        var appendixSource = appendix.find(function (source) { return source.citation === citation; });
        if (appendixSource) nextCatalog = citationCatalog.concat([compactCitation(appendixSource)]);
      }
      var nextPayload = payload.concat([candidate]);
      if (JSON.stringify(promptBody(nextPayload, nextCatalog)).length > SECTION_USER_PROMPT_LIMIT) return;
      payload = nextPayload;
      if (nextCatalog !== citationCatalog) {
        citationCatalog = nextCatalog;
        citationSet[citation] = true;
      }
    });
    var instruction = '你是报告章节分析员，只能根据结构化事实和来源写作。禁止补写未提供的税率、销量、市场规模、价格、利润、排名或平台规则。没有事实时必须写“待补充”，不得使用其他国家、平台或全球排名。税收或准入事实缺失时，只能说明“尚未接入/待补充”，禁止输出确定性税率、费用、认证或合规结论。每个来源已分配唯一编号；所有基于事实的句子及每个关键数字必须在句末保留一个或多个原始编号，例如 [S001]。任何包含阿拉伯数字的业务事实、行动阈值、日期和表格数据行都必须带 citationCatalog 中的原始编号；Markdown 表格必须增加“来源”列并逐行填写 [Sxxx]。无法找到准确来源时，删除该数字或写“待补充”，不得换算、四舍五入或派生新阈值。只能使用 citationCatalog 中存在的编号，不得改写、猜测或创建引用编号。程序化财务结果必须引用其输入数据对应的来源编号。';
    var user = JSON.stringify(promptBody(payload, citationCatalog));
    return { system: instruction, user: user, sourceAppendix: citationCatalog, citationFacts: payload };
  }

  function assemble(plan, results, facts, check, financial) {
    var appendix = buildSourceAppendix(facts).map(function (source) {
      var chapterDomains = [source.domain];
      if (['policy', 'tax', 'access', 'rule', 'alert'].indexOf(source.domain) >= 0) chapterDomains = chapterDomains.concat(['risk', 'summary', 'action']);
      return Object.assign({}, source, { chapters: list(results).filter(function (section) { return chapterDomains.indexOf(section.domain) >= 0; }).map(function (section) { return section.id; }) });
    });
    var completeness = scoreCompleteness(plan, check, appendix, facts);
    var reconciliation = reconcile(results, facts, financial);
    var citationAudit = auditCitations(results, appendix);
    var scopeCheck = results.reduce(function (state, section) { var current = checkScope(section.text, facts.scope); state.violations = state.violations.concat(current.violations); return state; }, { violations: [] });
    scopeCheck.violations = uniq(scopeCheck.violations); scopeCheck.ok = scopeCheck.violations.length === 0;
    var textParts = results.map(function (section) { return '## ' + section.title + '\n\n' + text(section.text).trim(); });
    textParts.push('## 来源与核验附录\n\n' + (appendix.length ? appendix.map(function (source) { return '- [' + source.citation + '] ' + (source.source || '未命名来源') + ' · ' + (source.date || '日期未提供') + ' · ' + (source.verificationStatus || '待核验') + (source.recordId ? ' · 原始记录：' + source.recordId : '') + (source.dataSnapshotAt ? ' · 数据快照：' + source.dataSnapshotAt : '') + (source.url ? ' · ' + source.url : '') + (source.chapters && source.chapters.length ? ' · 引用章节：' + source.chapters.join('、') : ''); }).join('\n') : '暂无可发布来源记录。'));
    var sourceRecordIds = uniq(appendix.map(function (source) { return source.recordId; }).filter(Boolean));
    var scopeSnapshot = Object.assign({}, facts && facts.scope || {}, { capturedAt: isoNow() });
    return {
      text: textParts.join('\n\n'), sections: results, facts: facts, financial: financial,
      sourceAppendix: appendix, sourceRecordIds: sourceRecordIds,
      dataSnapshotAt: facts && facts.collectedAt || isoNow(), scopeSnapshot: scopeSnapshot,
      completeness: completeness, reconciliation: reconciliation, scopeCheck: scopeCheck, citationAudit: citationAudit,
      publishable: !!check.ok && scopeCheck.ok && reconciliation.ok && citationAudit.ok, generatedAt: isoNow()
    };
  }

  function createVersion(report, previous, action) {
    var prior = previous || {};
    var seriesId = prior.seriesId || prior.series_id || report.seriesId || report.id || 'report-' + Date.now();
    var revision = Number(prior.revision || prior.version || 0) + 1;
    return Object.assign({}, report, { engineVersion: ENGINE_VERSION, seriesId: seriesId, revision: revision, version: revision, parentId: prior.id || prior.parentId || null, action: action || 'generate', versionCreatedAt: isoNow() });
  }

  root.JAY_REPORT_ENGINE = { version: ENGINE_VERSION, coreSections: CORE_SECTIONS, modules: MODULES, purposes: PURPOSE_MODULES, getTemplate: getTemplate, buildPlan: buildPlan, collectFacts: collectFacts, checkData: checkData, calculateFinancialModel: calculateFinancialModel, financialFromFacts: financialFromFacts, buildSectionPrompt: buildSectionPrompt, buildSourceAppendix: buildSourceAppendix, auditCitations: auditCitations, repairSectionCitations: repairSectionCitations, scoreCompleteness: scoreCompleteness, checkScope: checkScope, reconcile: reconcile, assemble: assemble, createVersion: createVersion };
  root.rpBuildReportPlan = buildPlan;
  root.rpCollectReportFacts = collectFacts;
  root.rpCheckReportData = checkData;
  root.rpCalculateFinancialModel = calculateFinancialModel;
  root.rpBuildSourceAppendix = buildSourceAppendix;
  root.rpScoreReportCompleteness = scoreCompleteness;
  root.rpCheckReportScope = checkScope;
  root.rpReconcileReport = reconcile;
  root.rpCreateReportVersion = createVersion;
}(window));
