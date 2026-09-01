(function initJayMarketScope(global) {
  'use strict';

  // Configuration is metadata-only. Market facts, tax rates and requirements
  // belong to verified data feeds, not to this browser registry.
  var CONFIG_VERSION = '2.0';
  var SCOPE_STORAGE_KEY = 'jay_market_scope_v1';
  var SOURCE_KINDS = ['official', 'traceable', 'uploaded', 'derived', 'demo'];
  var VERIFICATION_STATUSES = ['verified', 'uploaded', 'pending', 'rejected'];
  var SOURCE_TYPES = ['government', 'regulator', 'platform', 'official_feed', 'industry_association', 'licensed_provider', 'user_upload', 'derived', 'demo', 'unknown'];
  var MARKET_CONFIG = {
    version: CONFIG_VERSION,
    defaultMarketCodes: ['US'],
    markets: [
      {
        code: 'US', key: 'us', name: '美国', label: '美国市场', flag: '🇺🇸',
        aliases: ['us', 'usa', 'united states', 'unitedstates', '美国', '美区'],
        regionCode: 'NA', regionName: '北美', jurisdictionCodes: ['US'],
        platformKeys: ['amazon', 'tiktok-shop', 'aliexpress', 'ebay'],
        categoryKeys: [], dataStatus: 'verified',
        dataSources: {
          macro: {
            localPath: 'data/us_market/macro_indicators.json',
            sourceKind: 'official',
            sourceType: 'official_feed',
            commerceProfile: {
              indicatorMap: {
                ecommerce_sales: 'ECOMSA', ecommerce_penetration: 'ECOMPCTSA', retail_sales: 'RSAFS',
                disposable_income: 'DSPIC96', consumer_confidence: 'UMCSENT', consumer_spending: 'PCEC96',
                inflation: 'CPIAUCSL', exchange_rate: 'DEXCHUS',
              },
              categoryIndicatorMap: {
                apparel: ['MRTSSM448USS'], electronics: ['MRTSSM443USS'], beauty: [], home: [], 'pet-food': [], 'pet-supplies': [], generic: [],
              },
              backgroundCodes: ['GDP', 'UNRATE', 'INDPRO', 'BOPGSTB'],
            },
          },
        },
      },
      {
        code: 'ID', key: 'id', name: '印度尼西亚', label: '印度尼西亚市场', flag: '🇮🇩',
        aliases: ['id', 'indonesia', '印尼', '印度尼西亚'], regionCode: 'SEA', regionName: '东南亚',
        jurisdictionCodes: ['ID'], platformKeys: ['tiktok-shop', 'shopee', 'lazada'],
        categoryKeys: ['generic', 'electronics', 'beauty', 'apparel', 'home', 'pet-supplies'],
        dataSources: {}, status: 'active', dataStatus: 'schema_only',
      },
    ],
    platforms: [
      { key: 'amazon', name: 'Amazon', aliases: ['amazon', 'amazon.com'], kind: 'marketplace' },
      { key: 'tiktok-shop', name: 'TikTok Shop', aliases: ['tiktok shop', 'tiktok-shop', 'tiktokshop'], kind: 'social-commerce' },
      { key: 'aliexpress', name: 'AliExpress', aliases: ['aliexpress', '速卖通'], kind: 'marketplace' },
      { key: 'ebay', name: 'eBay', aliases: ['ebay'], kind: 'marketplace' },
      { key: 'shopee', name: 'Shopee', aliases: ['shopee', '虾皮'], kind: 'marketplace' },
      { key: 'lazada', name: 'Lazada', aliases: ['lazada'], kind: 'marketplace' },
    ],
    // One record represents one market-specific platform offering. A shared
    // platform therefore gets a separate record for every market it serves.
    marketPlatforms: [
      { marketCode: 'US', platformKey: 'amazon', status: 'active', dataStatus: 'configured', label: '美国站' },
      { marketCode: 'US', platformKey: 'tiktok-shop', status: 'active', dataStatus: 'configured', label: '美国站' },
      { marketCode: 'US', platformKey: 'aliexpress', status: 'active', dataStatus: 'configured', label: '美国站' },
      { marketCode: 'US', platformKey: 'ebay', status: 'active', dataStatus: 'configured', label: '美国站' },
      { marketCode: 'ID', platformKey: 'tiktok-shop', status: 'active', dataStatus: 'schema_only', label: '印度尼西亚站' },
      { marketCode: 'ID', platformKey: 'shopee', status: 'active', dataStatus: 'schema_only', label: '印度尼西亚站' },
      { marketCode: 'ID', platformKey: 'lazada', status: 'active', dataStatus: 'schema_only', label: '印度尼西亚站' },
    ],
    jurisdictions: [
      { code: 'US', name: '美国联邦辖区', type: 'country', parentCode: null },
      { code: 'ID', name: '印度尼西亚共和国辖区', type: 'country', parentCode: null },
    ],
    dataDomains: {
      policy: { key: 'policy', label: '政策法规', displayLocale: 'zh-CN', dimensions: ['market', 'jurisdiction', 'category', 'platform', 'effectiveDate'] },
      tax: { key: 'tax', label: '税收与关税', displayLocale: 'zh-CN', types: ['customs_duty','vat','sales_tax','marketplace_collection','import_fee'], dimensions: ['market', 'jurisdiction', 'category', 'origin', 'hsCode', 'tradeMode', 'fulfillmentMode', 'effectiveDate'] },
      access: { key: 'access', label: '准入与合规', displayLocale: 'zh-CN', types: ['certification','labeling','packaging','registration','intellectual_property','import_requirement'], dimensions: ['market', 'jurisdiction', 'category', 'platform', 'requirementType', 'effectiveDate'] },
      logistics: { key: 'logistics', label: '物流与履约', dimensions: ['market', 'platform', 'category', 'fulfillmentMode'] },
      payment: { key: 'payment', label: '支付与资金', dimensions: ['market', 'platform', 'currency'] },
    },
    // Empty by design: extension points must be populated by verified
    // collectors or user uploads before they affect a report.
    taxRules: [],
    accessRequirements: [],
    reportTemplates: [
      {
        id: 'market-research-v1', code: 'market-research', version: 1,
        name: '市场调研报告', marketCodes: [], platformKeys: [], categoryCodes: ['generic'], requiredDomains: ['market', 'policy', 'platform', 'rule'],
        modules: ['executive_summary', 'market_environment', 'competitor_research', 'consumer_needs', 'platform_research', 'product_fit', 'risk_recommendations'],
        dataStatus: 'schema_only',
      },
      {
        id: 'electronics-market-v1', code: 'electronics-market', version: 1,
        name: '电子产品市场调研报告', marketCodes: [], platformKeys: [], categoryCodes: ['electronics'], requiredDomains: ['market', 'policy', 'tax', 'access', 'logistics', 'platform', 'rule'],
        modules: ['executive_summary', 'market_environment', 'consumer_needs', 'platform_research', 'unit_economics', 'access_requirements', 'logistics', 'risk_recommendations'],
        dataStatus: 'schema_only',
      },
      {
        id: 'beauty-market-v1', code: 'beauty-market', version: 1,
        name: '美妆个护市场调研报告', marketCodes: [], platformKeys: [], categoryCodes: ['beauty'], requiredDomains: ['market', 'policy', 'tax', 'access', 'platform', 'rule'],
        modules: ['executive_summary', 'market_environment', 'consumer_profile', 'platform_research', 'access_requirements', 'price_band', 'risk_recommendations'],
        dataStatus: 'schema_only',
      },
      {
        id: 'apparel-market-v1', code: 'apparel-market', version: 1,
        name: '服装市场调研报告', marketCodes: [], platformKeys: [], categoryCodes: ['apparel'], requiredDomains: ['market', 'policy', 'access', 'platform', 'rule'],
        modules: ['executive_summary', 'market_environment', 'consumer_profile', 'seasonality', 'platform_research', 'price_band', 'risk_recommendations'],
        dataStatus: 'schema_only',
      },
      {
        id: 'pet-food-market-v1', code: 'pet-food-market', version: 1,
        name: '宠物食品市场调研报告', marketCodes: [], platformKeys: [], categoryCodes: ['pet-food'], requiredDomains: ['market', 'policy', 'tax', 'access', 'logistics', 'platform', 'rule'],
        modules: ['executive_summary', 'market_environment', 'consumer_profile', 'platform_research', 'access_requirements', 'unit_economics', 'logistics', 'risk_recommendations'],
        dataStatus: 'schema_only',
      },
    ],
    categoryProfiles: [
      {
        code: 'generic', name: '通用品类', aliases: ['generic', '通用'], dataStatus: 'schema_only',
        requiredFields: ['category', 'market', 'platform'],
        reportModules: ['category_overview', 'price_band', 'competition', 'risk'],
      },
      {
        code: 'electronics', name: '电子产品', aliases: ['electronics', '电子', '3c'], dataStatus: 'schema_only',
        requiredFields: ['category', 'market', 'platform', 'productCost', 'sellingPrice', 'certifications'],
        reportModules: ['category_overview', 'price_band', 'unit_economics', 'access_requirements', 'logistics', 'risk'],
      },
      {
        code: 'beauty', name: '美妆个护', aliases: ['beauty', 'cosmetics', '美妆', '个护'], dataStatus: 'schema_only',
        requiredFields: ['category', 'market', 'platform', 'ingredients', 'claims', 'sellingPrice'],
        reportModules: ['category_overview', 'consumer_profile', 'access_requirements', 'price_band', 'risk'],
      },
      {
        code: 'apparel', name: '服装', aliases: ['apparel', 'fashion', '服装', '服饰'], dataStatus: 'schema_only',
        requiredFields: ['category', 'market', 'platform', 'material', 'sizeSystem', 'sellingPrice'],
        reportModules: ['category_overview', 'consumer_profile', 'seasonality', 'price_band', 'risk'],
      },
      {
        code: 'pet-food', name: '宠物食品', aliases: ['pet-food', 'pet food', '宠物食品', '宠物粮'], dataStatus: 'schema_only',
        requiredFields: ['category', 'market', 'platform', 'ingredients', 'shelfLife', 'certifications'],
        reportModules: ['category_overview', 'consumer_profile', 'access_requirements', 'unit_economics', 'risk'],
      },
      {
        code: 'pet-supplies', name: '宠物用品', aliases: ['pet-supplies', 'pet supplies', '宠物用品', '宠物用具'], dataStatus: 'schema_only',
        requiredFields: ['category', 'market', 'platform', 'material', 'safetyClaims', 'sellingPrice'],
        reportModules: ['category_overview', 'consumer_profile', 'access_requirements', 'price_band', 'risk'],
      },
      {
        code: 'home', name: '家居产品', aliases: ['home', 'home-goods', '家居', '家居产品', '家用产品'], dataStatus: 'schema_only',
        requiredFields: ['category', 'market', 'platform', 'material', 'dimensions', 'sellingPrice'],
        reportModules: ['category_overview', 'consumer_profile', 'platform_research', 'price_band', 'logistics', 'risk'],
      },
    ],
  };

  var state = {
    marketCodes: MARKET_CONFIG.defaultMarketCodes.slice(),
    platformKeys: null,
    categoryCodes: [],
    hydrated: false,
  };

  function readStoredScope() {
    try {
      if (!global.localStorage) return null;
      var raw = global.localStorage.getItem(SCOPE_STORAGE_KEY);
      if (!raw) return null;
      var stored = JSON.parse(raw);
      return stored && typeof stored === 'object' ? stored : null;
    } catch (error) { return null; }
  }

  function writeStoredScope() {
    try {
      if (!global.localStorage) return;
      global.localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify({
        marketCodes: state.marketCodes.slice(),
        platformKeys: state.platformKeys ? state.platformKeys.slice() : null,
        categoryCodes: state.categoryCodes.slice(),
        version: CONFIG_VERSION,
      }));
    } catch (error) {}
  }

  (function restoreStoredScope() {
    var stored = readStoredScope();
    if (!stored) return;
    if (Array.isArray(stored.marketCodes) && stored.marketCodes.length) state.marketCodes = stored.marketCodes.slice();
    if (Array.isArray(stored.platformKeys) && stored.platformKeys.length) state.platformKeys = stored.platformKeys.slice();
    if (Array.isArray(stored.categoryCodes)) state.categoryCodes = stored.categoryCodes.slice();
  }());

  function list(value) {
    if (Array.isArray(value)) return value.slice();
    if (value === undefined || value === null || value === '') return [];
    return [value];
  }

  function text(value) { return String(value === undefined || value === null ? '' : value).trim(); }
  function lower(value) { return text(value).toLowerCase(); }
  function unique(values) {
    var result = [];
    list(values).forEach(function (value) { if (value && result.indexOf(value) < 0) result.push(value); });
    return result;
  }

  function normalizeMarketCode(value) {
    var raw = text(value);
    if (!raw) return '';
    var candidate = raw.toUpperCase();
    var found = MARKET_CONFIG.markets.find(function (market) {
      return market.code.toUpperCase() === candidate || market.key.toLowerCase() === raw.toLowerCase()
        || (market.aliases || []).some(function (alias) { return lower(alias) === lower(raw); });
    });
    return found ? found.code : candidate;
  }

  function normalizePlatformKey(value) {
    var raw = text(value);
    if (!raw) return '';
    var found = MARKET_CONFIG.platforms.find(function (platform) {
      return platform.key.toLowerCase() === raw.toLowerCase()
        || lower(platform.name) === lower(raw)
        || (platform.aliases || []).some(function (alias) { return lower(alias) === lower(raw); });
    });
    return found ? found.key : raw;
  }

  function marketByCode(value) {
    var code = normalizeMarketCode(value);
    return MARKET_CONFIG.markets.find(function (market) { return market.code === code; }) || null;
  }

  function platformByKey(value) {
    var key = normalizePlatformKey(value);
    return MARKET_CONFIG.platforms.find(function (platform) { return platform.key === key; }) || null;
  }

  function normalizePlatform(value) {
    var platform = platformByKey(value);
    return platform ? platform.name : text(value);
  }

  function normalizeCategoryCode(value) {
    var raw = lower(value);
    var profile = MARKET_CONFIG.categoryProfiles.find(function (item) {
      return lower(item.code) === raw || lower(item.name) === raw
        || (item.aliases || []).some(function (alias) { return lower(alias) === raw; });
    });
    return profile ? profile.code : text(value);
  }

  function normalizeCategoryCodes(values) {
    var result = [];
    list(values).forEach(function (value) {
      String(value === undefined || value === null ? '' : value).split(/[;,，、\/|]+/).forEach(function (part) {
        var code = normalizeCategoryCode(part);
        if (code && result.indexOf(code) < 0) result.push(code);
      });
    });
    return result;
  }

  function normalizeSourceKind(value) {
    var raw = lower(value);
    if (raw === 'official' || raw === '官方' || raw === 'government') return 'official';
    if (raw === 'traceable' || raw === '可追溯' || raw === '平台公告') return 'traceable';
    if (raw === 'uploaded' || raw === 'upload' || raw === '人工上传') return 'uploaded';
    if (raw === 'derived' || raw === '计算' || raw === '派生') return 'derived';
    if (raw === 'demo' || raw === '演示' || raw === 'mock') return 'demo';
    return raw && SOURCE_KINDS.indexOf(raw) >= 0 ? raw : '';
  }

  function normalizeVerificationStatus(value, sourceKind) {
    var raw = lower(value);
    if (raw === 'verified' || raw === '已核验' || raw === 'pass' || raw === '通过') return 'verified';
    if (raw === 'uploaded' || raw === '人工上传') return 'uploaded';
    if (raw === 'rejected' || raw === '拒绝' || raw === 'invalid') return 'rejected';
    if (raw === 'pending' || raw === '待核验' || raw === 'unverified') return 'pending';
    if (sourceKind === 'uploaded') return 'uploaded';
    return '';
  }

  function normalizeSourceType(value) {
    var raw = lower(value).replace(/[ -]+/g, '_');
    var aliases = {
      official: 'government', gov: 'government', 政府: 'government',
      监管机构: 'regulator', 平台: 'platform', 平台公告: 'platform',
      官方接口: 'official_feed', 官方数据源: 'official_feed',
      人工上传: 'user_upload', 上传: 'user_upload', 派生: 'derived', 计算: 'derived',
      演示: 'demo', 示意: 'demo'
    };
    var normalized = aliases[raw] || raw;
    return SOURCE_TYPES.indexOf(normalized) >= 0 ? normalized : '';
  }

  function sourceEvidence(record) {
    record = record || {};
    return text(record.source_url || record.sourceUrl || record.url)
      || text(record.source_record_id || record.sourceRecordId || record.source_file || record.sourceFile || record.evidence_hash || record.evidenceHash);
  }

  function hasExplicitProvenance(record) {
    record = record || {};
    return !!(record.source_kind || record.sourceKind || record.verification_status
      || record.verificationStatus || record.verification || record.data_quality);
  }

  // Normalize the metadata envelope shared by policy, tax, access, platform,
  // rule, alert and user-uploaded records. The original payload is retained;
  // consumers can decide whether a record is formal without guessing from
  // the display text.
  function normalizeDataRecord(record, domain) {
    var input = record && typeof record === 'object' ? record : {};
    var sourceKind = normalizeSourceKind(input.source_kind || input.sourceKind || input.provenance);
    var sourceType = normalizeSourceType(input.source_type || input.sourceType);
    if (!sourceKind && sourceType === 'user_upload') sourceKind = 'uploaded';
    if (!sourceKind && sourceEvidence(input)) sourceKind = sourceType === 'government' || sourceType === 'regulator' ? 'official' : 'traceable';
    var verificationStatus = normalizeVerificationStatus(input.verification_status || input.verificationStatus || input.verification, sourceKind);
    var legacyVerified = !verificationStatus && sourceKind !== 'demo' && sourceEvidence(input)
      && input.collected_at && (input.published_at || input.publishedAt || input.effective_date || input.effectiveDate);
    if (!verificationStatus && legacyVerified) verificationStatus = 'verified';
    var markets = recordMarketCodes(input);
    var platforms = recordPlatformKeys(input);
    var categories = recordCategoryCodes(input);
    var normalized = Object.assign({}, input);
    normalized.domain = text(input.domain || domain);
    normalized.market_codes = markets;
    normalized.platform_keys = platforms;
    normalized.category_codes = categories;
    normalized.source_kind = sourceKind || (input.source_url || input.url ? 'traceable' : '');
    normalized.verification_status = verificationStatus || 'pending';
    normalized.source_type = sourceType || (normalized.source_kind === 'uploaded' ? 'user_upload' : normalized.source_kind === 'demo' ? 'demo' : 'unknown');
    normalized.source_url = text(input.source_url || input.sourceUrl || input.url);
    normalized.source_record_id = text(input.source_record_id || input.sourceRecordId);
    normalized.verified_at = input.verified_at || input.verifiedAt || null;
    normalized.verification_notes = text(input.verification_notes || input.verificationNotes);
    normalized.evidence_hash = text(input.evidence_hash || input.evidenceHash);
    normalized.title_zh = text(input.title_zh || input.titleZh);
    normalized.summary_zh = text(input.summary_zh || input.summaryZh);
    normalized.translation = input.translation && typeof input.translation === 'object' ? Object.assign({}, input.translation) : {};
    normalized.data_quality = text(input.data_quality || input.dataQuality);
    normalized.collected_at = input.collected_at || input.collectedAt || input.updated_at || input.updatedAt || null;
    normalized.published_at = input.published_at || input.publishedAt || null;
    normalized.effective_from = input.effective_from || input.effectiveFrom || input.effective_date || input.effectiveDate || null;
    normalized.scope_status = markets.length ? 'scoped' : 'unscoped';
    return normalized;
  }

  function isFormalRecord(record) {
    var options = arguments[1] || {};
    return getRecordQuality(record, options).formal;
  }

  function getRecordQuality(record, options) {
    options = options || {};
    var normalized = normalizeDataRecord(record, options.domain);
    var reasons = [];
    var quality = lower(normalized.data_quality);
    if (normalized.source_kind === 'demo' || ['demo', 'demonstration', 'mock', '演示', '示意'].indexOf(quality) >= 0) reasons.push('demo');
    if (['verified', 'uploaded'].indexOf(normalized.verification_status) < 0) reasons.push('unverified');
    if (!normalized.source_kind) reasons.push('missing_source_kind');
    if (['official', 'traceable', 'derived'].indexOf(normalized.source_kind) >= 0 && !sourceEvidence(normalized)) reasons.push('missing_source');
    if (normalized.source_kind === 'uploaded' && !sourceEvidence(normalized)) reasons.push('missing_upload_reference');
    if (options.requireScope !== false && normalized.scope_status !== 'scoped') reasons.push('out_of_scope');
    if (['policy','tax','access'].indexOf(options.domain) >= 0) {
      var translationStatus = text(normalized.translation && normalized.translation.status);
      if (!/[\u3400-\u9fff]/.test(normalized.title_zh)
          || (text(normalized.summary) && !/[\u3400-\u9fff]/.test(normalized.summary_zh))
          || ['source_zh','translated','reviewed'].indexOf(translationStatus) < 0) reasons.push('missing_chinese_display');
    }
    return { formal: reasons.length === 0, reasons: reasons, source_kind: normalized.source_kind,
      verification_status: normalized.verification_status, source_type: normalized.source_type,
      legacy_inferred: !hasExplicitProvenance(record) };
  }

  function filterFormalRecords(records, context, options) {
    options = options || {};
    var result = [];
    (Array.isArray(records) ? records : []).forEach(function (record) {
      var normalized = normalizeDataRecord(record, options.domain);
      if (!isFormalRecord(normalized, options)) return;
      if (!recordMatchesContext(normalized, context, { allowGlobal: false })) return;
      result.push(normalized);
    });
    return result;
  }

  function getMarkets(codes) {
    var requested = list(codes);
    if (!requested.length) requested = state.marketCodes;
    return unique(requested.map(normalizeMarketCode)).map(marketByCode).filter(Boolean);
  }

  function getMarketPlatforms(marketCode) {
    var code = normalizeMarketCode(marketCode);
    var market = marketByCode(code);
    if (!market) return [];
    var selected = state.platformKeys;
    return market.platformKeys.map(function (key) {
      if (selected && selected.indexOf(key) < 0) return null;
      var platform = platformByKey(key);
      var relation = MARKET_CONFIG.marketPlatforms.find(function (item) {
        return item.marketCode === code && item.platformKey === key;
      });
      if (!platform || !relation || relation.status !== 'active') return null;
      return Object.assign({}, platform, {
        marketCode: code,
        marketName: market.name,
        marketLabel: relation.label || market.label,
        status: relation.status,
        dataStatus: relation.dataStatus || 'unknown',
      });
    }).filter(Boolean);
  }

  function getConfiguredMarketPlatforms(marketCode) {
    var previous = state.platformKeys;
    state.platformKeys = null;
    var result = getMarketPlatforms(marketCode);
    state.platformKeys = previous;
    return result;
  }

  function getActiveMarkets() { return getMarkets(state.marketCodes); }
  function getActivePlatforms() {
    var result = [];
    getActiveMarkets().forEach(function (market) {
      getMarketPlatforms(market.code).forEach(function (platform) {
        if (!result.some(function (item) { return item.key === platform.key; })) result.push(platform);
      });
    });
    return result;
  }

  function getActiveContext() {
    return {
      marketCodes: getActiveMarkets().map(function (market) { return market.code; }),
      platformKeys: getActivePlatforms().map(function (platform) { return platform.key; }),
      categoryCodes: state.categoryCodes.slice(),
      selectedPlatformKeys: state.platformKeys ? state.platformKeys.slice() : null,
      selectedCategoryCodes: state.categoryCodes.slice(),
      configVersion: CONFIG_VERSION,
    };
  }

  function getActiveMarketNames() {
    return getActiveMarkets().map(function (market) { return market.name || market.label || market.code; });
  }

  function getActivePlatformNames() {
    return getActivePlatforms().map(function (platform) { return platform.name || platform.key; });
  }

  function getActiveCategoryProfiles() {
    var requested = state.categoryCodes;
    var profiles = MARKET_CONFIG.categoryProfiles.filter(function (profile) {
      if (!profile || profile.status === 'inactive') return false;
      var availableToMarket = getActiveMarkets().some(function (market) {
        return !Array.isArray(market.categoryKeys) || !market.categoryKeys.length
          || market.categoryKeys.indexOf(profile.code) >= 0;
      });
      return availableToMarket && (!requested.length || requested.indexOf(profile.code) >= 0);
    });
    return profiles;
  }

  function getReportTemplates(context) {
    context = context || {};
    var categories = normalizeCategoryCodes(context.categoryCodes || context.categories || state.categoryCodes);
    var templates = Array.isArray(MARKET_CONFIG.reportTemplates) ? MARKET_CONFIG.reportTemplates : [];
    return templates.filter(function (template) {
      if (!template || template.status === 'inactive') return false;
      var templateCategories = normalizeCategoryCodes(template.categoryCodes || template.category_codes);
      var rawTemplateMarkets = list(template.marketCodes || template.market_codes);
      var templateMarkets = rawTemplateMarkets.map(normalizeMarketCode).filter(Boolean);
      var templatePlatforms = list(template.platformKeys || template.platform_keys).map(normalizePlatformKey).filter(Boolean);
      var marketMatch = rawTemplateMarkets.indexOf('*') >= 0 || !templateMarkets.length || templateMarkets.some(function (code) { return state.marketCodes.indexOf(code) >= 0; });
      var platformMatch = !templatePlatforms.length || templatePlatforms.some(function (key) { return getActivePlatforms().some(function (platform) { return platform.key === key; }); });
      return marketMatch && platformMatch && (!categories.length || !templateCategories.length || templateCategories.some(function (code) { return categories.indexOf(code) >= 0; }));
    });
  }

  function getReportTemplate(value, context) {
    var key = text(value);
    return getReportTemplates(context).find(function (template) {
      return template.id === key || template.code === key;
    }) || null;
  }

  function getMarketScoreBasis(marketCode) {
    var market = marketByCode(marketCode || getPrimaryMarketCode());
    if (!market) return null;
    var metadata = market.metadata && typeof market.metadata === 'object' ? market.metadata : {};
    var basis = market.scoreBasis || market.score_basis || metadata.scoreBasis || metadata.score_basis;
    if (!basis || typeof basis !== 'object') return null;
    var status = lower(basis.verificationStatus || basis.verification_status || market.dataStatus);
    if (['verified', 'uploaded'].indexOf(status) < 0) return null;
    return {
      capacity: Number.isFinite(Number(basis.capacity)) ? Number(basis.capacity) : null,
      competition: Number.isFinite(Number(basis.competition)) ? Number(basis.competition) : null,
      policyRisk: Number.isFinite(Number(basis.policyRisk != null ? basis.policyRisk : basis.policy_risk)) ? Number(basis.policyRisk != null ? basis.policyRisk : basis.policy_risk) : null,
      source: text(basis.source || basis.source_url),
      verifiedAt: basis.verifiedAt || basis.verified_at || null,
    };
  }

  function getPrimaryMarket() {
    return getActiveMarkets()[0] || null;
  }

  function getPrimaryMarketCode() {
    var market = getPrimaryMarket();
    return market ? market.code : '';
  }

  function getPrimaryMarketName() {
    var market = getPrimaryMarket();
    return market ? (market.name || market.label || market.code) : '';
  }

  function getScopeLabel() {
    var markets = getActiveMarketNames();
    var platforms = getActivePlatformNames();
    return markets.join('、') + '市场 · ' + platforms.join('、');
  }

  function contextValue(context, key, fallback) {
    context = context || {};
    if (context[key] !== undefined) return context[key];
    return fallback;
  }

  function contextMarketCodes(context) {
    context = context || {};
    var values = context.marketCodes || context.markets || context.marketCode || context.market
      || context.countryCodes || context.country;
    var codes = list(values).map(function (item) {
      return normalizeMarketCode(item && typeof item === 'object' ? (item.code || item.key || item.name) : item);
    }).filter(Boolean);
    return unique(codes.length ? codes : state.marketCodes);
  }

  function contextPlatformKeys(context) {
    context = context || {};
    var values = context.platformKeys || context.platforms || context.platform;
    if (values === undefined || values === null || values === '' || values === 'all') return null;
    return unique(list(values).map(function (item) {
      return normalizePlatformKey(item && typeof item === 'object' ? (item.key || item.name || item.platform) : item);
    }).filter(Boolean));
  }

  function recordMarketCodes(record) {
    record = record || {};
    var values = record.marketCodes || record.market_codes || record.markets || record.marketCode
      || record.market_code || record.market || record.regionCode || record.region_code || record.region
      || record.countryCode || record.country_code || record.country || record.jurisdictionCode
      || record.jurisdiction_code || record.jurisdiction;
    var codes = list(values).map(function (item) {
      return normalizeMarketCode(item && typeof item === 'object' ? (item.code || item.key || item.name) : item);
    }).filter(Boolean);
    return unique(codes);
  }

  function recordPlatformKeys(record) {
    record = record || {};
    var values = record.platformKeys || record.platform_keys || record.platforms || record.platformKey
      || record.platform_key || record.platform;
    return unique(list(values).map(function (item) {
      return normalizePlatformKey(item && typeof item === 'object' ? (item.key || item.name || item.platform) : item);
    }).filter(Boolean));
  }

  function recordCategoryCodes(record) {
    record = record || {};
    return unique(list(record.categoryCodes || record.category_codes || record.categories || record.category || record.subcategory)
      .map(normalizeCategoryCode).filter(Boolean));
  }

  function recordMatchesContext(record, context, options) {
    options = options || {};
    var markets = contextMarketCodes(context);
    var marketCodes = recordMarketCodes(record);
    var isGlobal = marketCodes.indexOf('GLOBAL') >= 0 || marketCodes.indexOf('ALL') >= 0;
    if (!marketCodes.length || (!isGlobal && !markets.some(function (code) { return marketCodes.indexOf(code) >= 0; }))) return false;
    if (isGlobal && options.allowGlobal === false) return false;

    var platforms = contextPlatformKeys(context);
    var recordPlatforms = recordPlatformKeys(record);
    if (platforms && recordPlatforms.length && !recordPlatforms.some(function (key) { return platforms.indexOf(key) >= 0; })) return false;

    var categories = list(contextValue(context, 'categoryCodes', contextValue(context, 'categories', null)))
      .map(normalizeCategoryCode).filter(Boolean);
    var recordCategories = recordCategoryCodes(record);
    if (categories.length && recordCategories.length && !recordCategories.some(function (key) { return categories.indexOf(key) >= 0; })) return false;
    return true;
  }

  function getApplicableRecords(records, context, options) {
    return (Array.isArray(records) ? records : []).filter(function (record) {
      return recordMatchesContext(record, context, options);
    });
  }

  function isAllowedMarket(value) { return !!marketByCode(value); }
  function isAllowedPlatform(value, marketCode) {
    var key = normalizePlatformKey(value);
    if (!platformByKey(key)) return false;
    if (marketCode) return getMarketPlatforms(marketCode).some(function (item) { return item.key === key; });
    return getActivePlatforms().some(function (item) { return item.key === key; });
  }

  function filterPlatforms(items, getName, marketCode) {
    var listItems = Array.isArray(items) ? items : [];
    var accessor = typeof getName === 'function' ? getName : function (item) {
      return item && (item.name || item.platform || item[0]);
    };
    var allowed = marketCode ? getMarketPlatforms(marketCode) : getActivePlatforms();
    var best = {};
    listItems.forEach(function (item) {
      var key = normalizePlatformKey(accessor(item));
      if (!allowed.some(function (platform) { return platform.key === key; })) return;
      var exact = lower(accessor(item)) === lower((platformByKey(key) || {}).name) ? 100 : 0;
      var itemMarket = normalizeMarketCode(item && (item.marketCode || item.market || item.region));
      var marketScore = marketCode && itemMarket === normalizeMarketCode(marketCode) ? 40 : 0;
      var score = exact + marketScore;
      if (!best[key] || score > best[key].score) best[key] = { item: item, score: score };
    });
    return allowed.map(function (platform) { return best[platform.key] && best[platform.key].item; }).filter(Boolean);
  }

  function isApplicablePolicy(item, context) { return recordMatchesContext(item, context, { allowGlobal: false }); }
  function isApplicableTax(item, context) { return recordMatchesContext(item, context, { allowGlobal: false }); }
  function isApplicableAccess(item, context) { return recordMatchesContext(item, context, { allowGlobal: false }); }
  function isApplicableRule(item, context) {
    if (!item || !isAllowedPlatform(item.platform, null)) return false;
    // Global records remain available to collectors as background context, but
    // formal market rule lists must be explicitly scoped to the active market.
    return recordMatchesContext(item, context, { allowGlobal: false });
  }

  // Backward-compatible helpers used by current US-only page modules.
  function isUsPolicy(item) { return isApplicablePolicy(item, { marketCodes: ['US'] }); }
  function isUsAlert(item) {
    var value = Array.isArray(item) ? item[4] : item && (item.country || item.region || item.market);
    return recordMatchesContext({ market: value }, { marketCodes: ['US'] }, { allowGlobal: false });
  }

  function categoryProfile(value) {
    var code = normalizeCategoryCode(value);
    return MARKET_CONFIG.categoryProfiles.find(function (profile) { return profile.code === code; }) || null;
  }

  function getTaxRules(context) { return getApplicableRecords(MARKET_CONFIG.taxRules, context, { allowGlobal: false }); }
  function getAccessRequirements(context) { return getApplicableRecords(MARKET_CONFIG.accessRequirements, context, { allowGlobal: false }); }

  function makeScopeSnapshot() {
    var markets = getActiveMarkets();
    if (!markets.length) {
      state.marketCodes = MARKET_CONFIG.defaultMarketCodes.slice();
      markets = getActiveMarkets();
    }
    var firstMarket = markets[0] || MARKET_CONFIG.markets[0];
    var platforms = getActivePlatforms();
    var platformNames = platforms.map(function (platform) { return platform.name; });
    return {
      version: CONFIG_VERSION,
      configVersion: CONFIG_VERSION,
      hydrated: state.hydrated,
      country: firstMarket,
      market: firstMarket,
      countries: markets,
      markets: markets,
      countryCount: markets.length,
      marketCount: markets.length,
      platformNames: platformNames,
      platforms: platforms,
      platformCount: platforms.length,
      marketCodes: markets.map(function (market) { return market.code; }),
      platformKeys: platforms.map(function (platform) { return platform.key; }),
      selectedPlatformKeys: state.platformKeys ? state.platformKeys.slice() : null,
      categoryCodes: state.categoryCodes.slice(),
      selectedCategoryCodes: state.categoryCodes.slice(),
      categoryNames: getActiveCategoryProfiles().map(function (profile) { return profile.name || profile.code; }),
      reportTemplateIds: getReportTemplates({ categoryCodes: state.categoryCodes }).map(function (template) { return template.id || template.code; }),
      applicableRuleMarkets: markets.map(function (market) { return market.code; }),
      hasMultipleMarkets: markets.length > 1,
    };
  }

  function scopeMarketLabel(market) {
    return market ? (market.name || market.label || market.code) : '当前市场';
  }

  function scopeMarketNames(scope) {
    return (scope && Array.isArray(scope.markets) ? scope.markets : getActiveMarkets())
      .map(scopeMarketLabel);
  }

  function scopeMarketCodes(scope) {
    return (scope && Array.isArray(scope.marketCodes) ? scope.marketCodes : getActiveMarkets()
      .map(function (market) { return market.code; }));
  }

  function setSelectOptions(select, options, labels, preserveAll) {
    if (!select) return;
    var previous = select.value;
    var first = select.options && select.options[0];
    var firstValue = first && first.value;
    var firstText = first && first.textContent;
    select.innerHTML = '';
    if (preserveAll && first) {
      var all = document.createElement('option');
      all.value = firstValue;
      all.textContent = firstText;
      select.appendChild(all);
    }
    options.forEach(function (option) {
      var item = typeof option === 'string' ? { value: option, label: option } : option;
      var node = document.createElement('option');
      node.value = item.value;
      node.textContent = (labels && labels[item.value]) || item.label || item.value;
      select.appendChild(node);
    });
    var values = options.map(function (option) { return typeof option === 'string' ? option : option.value; });
    select.value = values.indexOf(previous) >= 0 ? previous : (values[0] || (preserveAll ? firstValue : ''));
  }

  // The shell is deliberately updated from the same snapshot used by data
  // filters. This keeps future market registrations from leaving stale US
  // labels in forms, links, and report prompts.
  function applyScopeUi(scope) {
    if (!global.document) return;
    var markets = (scope && scope.markets) || getActiveMarkets();
    var marketCodes = scopeMarketCodes(scope);
    var names = scopeMarketNames(scope);
    var primary = markets[0] || null;
    var primaryName = scopeMarketLabel(primary);
    var primaryCode = primary ? primary.code : '';
    var platformNames = (scope && scope.platformNames) || getActivePlatformNames();
    var marketText = names.join('、');
    var platformText = platformNames.join('、');
    var marketCount = String(markets.length);
    var platformCount = String(platformNames.length);

    var selector = global.document.getElementById('jay-market-selector');
    if (selector) {
      var selectorLabel = selector.parentNode && selector.parentNode.querySelector('span');
      if (selectorLabel) selectorLabel.textContent = markets.length > 1 ? '主市场' : '当前市场';
      var configuredMarkets = MARKET_CONFIG.markets.slice();
      setSelectOptions(selector, configuredMarkets.map(function (market) { return market.code; }), Object.fromEntries(configuredMarkets.map(function (market) {
        return [market.code, market.name || market.label || market.code];
      })), false);
      selector.value = primaryCode;
      if (!selector.__jayScopeBound) {
        selector.__jayScopeBound = true;
        selector.addEventListener('change', function () { setActiveMarkets([selector.value]); });
      }
    }

    var countryProfileSelector = global.document.getElementById('country-profile-selector');
    if (countryProfileSelector) {
      setSelectOptions(countryProfileSelector, configuredMarkets.map(function (market) { return market.code; }), Object.fromEntries(configuredMarkets.map(function (market) {
        return [market.code, (market.flag ? market.flag + ' ' : '') + (market.name || market.label || market.code)];
      })), false);
      countryProfileSelector.value = primaryCode;
      if (!countryProfileSelector.__jayScopeBound) {
        countryProfileSelector.__jayScopeBound = true;
        countryProfileSelector.addEventListener('change', function () {
          setActiveMarkets([countryProfileSelector.value]);
          if (typeof global.switchPage === 'function') global.switchPage('countries');
        });
      }
    }

    var platformSelector = global.document.getElementById('jay-platform-selector');
    if (platformSelector) {
      var configuredPlatformMap = {};
      markets.forEach(function (market) {
        getConfiguredMarketPlatforms(market.code).forEach(function (platform) {
          if (!configuredPlatformMap[platform.key]) configuredPlatformMap[platform.key] = platform;
        });
      });
      var platformOptions = Object.keys(configuredPlatformMap).map(function (key) {
        var platform = configuredPlatformMap[key];
        return { value: platform.key, label: platform.name || platform.key };
      });
      setSelectOptions(platformSelector, platformOptions, null, true);
      platformSelector.value = scope && scope.selectedPlatformKeys && scope.selectedPlatformKeys.length === 1
        ? scope.selectedPlatformKeys[0] : '';
      if (!platformSelector.__jayScopeBound) {
        platformSelector.__jayScopeBound = true;
        platformSelector.addEventListener('change', function () { setActivePlatforms(platformSelector.value || 'all'); });
      }
    }

    var categorySelector = global.document.getElementById('jay-category-selector');
    if (categorySelector) {
      var categoryOptions = MARKET_CONFIG.categoryProfiles.filter(function (profile) {
        if (!profile || profile.status === 'inactive') return false;
        return markets.some(function (market) {
          return !Array.isArray(market.categoryKeys) || !market.categoryKeys.length || market.categoryKeys.indexOf(profile.code) >= 0;
        });
      }).map(function (profile) { return { value: profile.code, label: profile.name || profile.code }; });
      setSelectOptions(categorySelector, categoryOptions, null, true);
      categorySelector.value = scope && scope.selectedCategoryCodes && scope.selectedCategoryCodes.length === 1
        ? scope.selectedCategoryCodes[0] : '';
      if (!categorySelector.__jayScopeBound) {
        categorySelector.__jayScopeBound = true;
        categorySelector.addEventListener('change', function () { setActiveCategories(categorySelector.value || []); });
      }
    }

    var commerceCategorySelector = global.document.getElementById('country-commerce-category');
    if (commerceCategorySelector) {
      var commerceCategoryOptions = MARKET_CONFIG.categoryProfiles.filter(function (profile) {
        if (!profile || profile.status === 'inactive' || profile.code === 'generic') return false;
        return markets.some(function (market) {
          return !Array.isArray(market.categoryKeys) || !market.categoryKeys.length || market.categoryKeys.indexOf(profile.code) >= 0;
        });
      }).map(function (profile) { return { value: profile.code, label: profile.name || profile.code }; });
      setSelectOptions(commerceCategorySelector, commerceCategoryOptions, null, true);
      commerceCategorySelector.value = scope && scope.selectedCategoryCodes && scope.selectedCategoryCodes.length === 1
        ? scope.selectedCategoryCodes[0] : '';
      if (!commerceCategorySelector.__jayScopeBound) {
        commerceCategorySelector.__jayScopeBound = true;
        commerceCategorySelector.addEventListener('change', function () { setActiveCategories(commerceCategorySelector.value || []); });
      }
    }

    global.document.querySelectorAll('.market-switcher').forEach(function (button) {
      var icon = button.querySelector('span');
      var label = button.querySelector('b');
      if (icon) icon.textContent = markets.length > 1 ? '🌐' : ((primary && primary.flag) || '🌐');
      if (label) label.textContent = markets.length > 1 ? markets.length + ' 个市场' : primaryName + '市场';
      button.setAttribute('aria-label', button.id === 'ov-market-scope-toggle' ? '选择总览市场范围' : '打开' + primaryName + '市场档案');
    });

    var textMap = {
      'login-product-title': '从' + (markets.length === 1 ? primaryName + '市场' : '当前市场') + '信号到经营动作，把跨境决策做得更有依据。',
      'login-product-copy': marketText + '、' + platformCount + ' 个已配置平台、政策与预警数据统一进入一个工作台，帮助团队更快完成市场判断、风险筛查和方案输出。',
      'auth-title': '进入' + (markets.length === 1 ? primaryName + '市场' : '市场') + '情报台',
      'ov-signal-market': marketText + '政策与召回动态',
      'ov-market-link': '查看' + (markets.length === 1 ? primaryName : '当前市场'),
      'countries-page-title': marketText + '市场档案',
      'country-page-linkage': '当前市场：' + marketText,
      'al-scope-note': '当前范围：' + marketText + '市场 · 仅展示已接入数据源的预警',
      'dq-scope-note': marketText + '与当前 ' + platformCount + ' 个平台',
      'faq-product-description': 'JAY观海 是轻工业协会专属数字化产业服务工具，面向全国轻工制造企业免费提供跨境市场分析、海外商品机会、跨境合规风险筛查和市场出海规划等一体化数据支撑，是协会落实企业出海扶持、产业数字化升级的标准化服务载体。',
      'faq-free-description': '免费版可浏览当前配置的市场、平台、政策和预警数据，使用 AI 搜索与定时刷新、生成并导出报告。部分批量操作与高级企业协同功能需升级专业版（PRO）。',
    };
    Object.keys(textMap).forEach(function (id) {
      var node = global.document.getElementById(id);
      if (!node) return;
      if (id === 'ov-market-link') {
        var icon = node.querySelector('i');
        node.textContent = textMap[id] + ' ';
        if (icon) node.appendChild(icon);
      } else if (id === 'country-page-linkage') {
        var flag = node.querySelector('.flag');
        node.textContent = '';
        if (flag) { flag.textContent = (primary && primary.flag) || '🌐'; node.appendChild(flag); }
        node.appendChild(global.document.createTextNode('当前市场：' + marketText));
      } else node.textContent = textMap[id];
    });

    var marketCountNode = global.document.getElementById('login-market-count');
    if (marketCountNode) marketCountNode.textContent = marketCount;
    var marketLabelNode = global.document.getElementById('login-market-label');
    if (marketLabelNode) marketLabelNode.textContent = markets.length === 1 ? primaryName : '已配置市场';
    var platformCountNode = global.document.getElementById('login-platform-count');
    if (platformCountNode) platformCountNode.textContent = platformCount;
    var summaryMarketCount = global.document.getElementById('country-scope-market-count');
    if (summaryMarketCount) summaryMarketCount.textContent = marketCount;
    var summaryMarketNames = global.document.getElementById('country-scope-market-names');
    if (summaryMarketNames) summaryMarketNames.textContent = marketText || '当前范围';
    var summaryPlatformCount = global.document.getElementById('country-scope-platform-count');
    if (summaryPlatformCount) summaryPlatformCount.textContent = platformCount;
    var summaryCode = global.document.getElementById('country-scope-market-code');
    if (summaryCode) summaryCode.textContent = marketCodes.join('、') || primaryCode;

    var prompt = global.document.getElementById('ov-hero-input');
    if (prompt) prompt.placeholder = '例如：便携储能电源进入' + marketText + '市场，利润空间、认证门槛和适合的平台分别是什么？';
    global.document.querySelectorAll('#ov-hero-chips [data-q]').forEach(function (chip) {
      if (!chip.dataset.scopeTemplate) chip.dataset.scopeTemplate = chip.getAttribute('data-q') || '';
      var q = chip.dataset.scopeTemplate;
      chip.setAttribute('data-q', q.replace(/当前市场已配置平台/g, marketText + '市场已配置平台').replace(/美国市场|当前市场/g, marketText + '市场'));
    });
    var reportTopic = global.document.getElementById('rp-v2-topic');
    if (reportTopic) reportTopic.placeholder = '例如：便携储能电源 / ' + primaryName + '市场';
    var importNote = global.document.getElementById('pr-data-import-note');
    if (importNote) importNote.textContent = '支持商品字段：商品名、国家/市场、平台、类目、三级类目、售价、销量、增速、信号、店铺、上架天数、更新时间。超出当前' + marketText + '市场或平台范围的行会被跳过。';
    var addMarket = global.document.getElementById('sh-add-market');
    if (addMarket) addMarket.value = primaryName;
    setSelectOptions(global.document.getElementById('sh-add-platform'), platformNames, null, true);
    var scopePolicy = global.document.getElementById('pl-f-scope');
    if (scopePolicy && scopePolicy.options.length > 1) scopePolicy.options[1].textContent = '全部' + marketText + '已核验政策';

    ['sc-market', 'rp-q-market'].forEach(function (id) {
      setSelectOptions(global.document.getElementById(id), marketCodes, Object.fromEntries(markets.map(function (market) {
        return [market.code, market.name || market.label || market.code];
      })), false);
    });
    setSelectOptions(global.document.getElementById('wl-group-sel'), marketCodes.map(function (code) { return code.toLowerCase() + '-market'; }), Object.fromEntries(markets.map(function (market) {
      return [market.code.toLowerCase() + '-market', (market.name || market.label || market.code) + '市场（当前范围）'];
    })), false);
  }

  function publishScopeChange() {
    global.JAY_MARKET_SCOPE = makeScopeSnapshot();
    applyScopeUi(global.JAY_MARKET_SCOPE);
    if (global.dispatchEvent && typeof global.CustomEvent === 'function') {
      global.dispatchEvent(new global.CustomEvent('jay:market-scope-change', { detail: global.JAY_MARKET_SCOPE }));
    }
    return global.JAY_MARKET_SCOPE;
  }

  function setActiveMarkets(values) {
    var codes = unique(list(values).map(function (item) {
      return normalizeMarketCode(item && typeof item === 'object' ? (item.code || item.key || item.name) : item);
    }).filter(isAllowedMarket));
    if (!codes.length) return false;
    state.marketCodes = codes;
    if (state.platformKeys) {
      var allowed = [];
      getActiveMarkets().forEach(function (market) {
        getConfiguredMarketPlatforms(market.code).forEach(function (platform) {
          if (allowed.indexOf(platform.key) < 0) allowed.push(platform.key);
        });
      });
      state.platformKeys = state.platformKeys.filter(function (key) { return allowed.indexOf(key) >= 0; });
      if (!state.platformKeys.length) state.platformKeys = null;
    }
    writeStoredScope();
    publishScopeChange();
    return true;
  }

  function setActivePlatforms(values) {
    if (values === null || values === undefined || values === '' || values === 'all') {
      state.platformKeys = null;
    } else {
      var allowed = [];
      getActiveMarkets().forEach(function (market) {
        getConfiguredMarketPlatforms(market.code).forEach(function (platform) {
          if (allowed.indexOf(platform.key) < 0) allowed.push(platform.key);
        });
      });
      state.platformKeys = unique(list(values).map(normalizePlatformKey).filter(function (key) { return allowed.indexOf(key) >= 0; }));
      if (!state.platformKeys.length) return false;
    }
    writeStoredScope();
    publishScopeChange();
    return true;
  }

  function setActiveCategories(values) {
    state.categoryCodes = normalizeCategoryCodes(values);
    writeStoredScope();
    publishScopeChange();
    return true;
  }

  function registerMarket(market, relations) {
    if (!market || !market.code) return false;
    var code = normalizeMarketCode(market.code);
    if (!code || MARKET_CONFIG.markets.some(function (item) { return item.code === code; })) return false;
    var normalized = Object.assign({ aliases: [], platformKeys: [], categoryKeys: [], jurisdictionCodes: [], dataStatus: 'configured' }, market, {
      code: code,
      key: text(market.key || code.toLowerCase()),
      platformKeys: unique(list(market.platformKeys || market.platform_keys).map(normalizePlatformKey).filter(Boolean)),
      categoryKeys: normalizeCategoryCodes(market.categoryKeys || market.category_keys),
      jurisdictionCodes: unique(list(market.jurisdictionCodes || market.jurisdiction_codes || market.jurisdiction).map(text).filter(Boolean)),
    });
    MARKET_CONFIG.markets.push(normalized);
    list(relations).forEach(function (relation) {
      if (relation && (relation.platformKey || relation.platform_key)) MARKET_CONFIG.marketPlatforms.push(Object.assign({ marketCode: normalized.code, status: 'active', dataStatus: 'unknown' }, relation, {
        marketCode: normalized.code,
        platformKey: normalizePlatformKey(relation.platformKey || relation.platform_key),
      }));
    });
    publishScopeChange();
    return true;
  }

  function registerPlatform(platform) {
    if (!platform || !platform.key) return false;
    var key = text(platform.key).toLowerCase();
    if (!key || MARKET_CONFIG.platforms.some(function (item) { return item.key === key; })) return false;
    MARKET_CONFIG.platforms.push(Object.assign({ aliases: [], kind: 'marketplace', status: 'active', dataStatus: 'configured' }, platform, { key: key }));
    return true;
  }

  function registerCategoryProfile(profile) {
    if (!profile || !profile.code || categoryProfile(profile.code)) return false;
    MARKET_CONFIG.categoryProfiles.push(Object.assign({ aliases: [], requiredFields: [], reportModules: [], status: 'active', dataStatus: 'schema_only' }, profile, { code: text(profile.code).toLowerCase() }));
    return true;
  }

  function hydrateCatalog(payload) {
    payload = payload || {};
    var markets = Array.isArray(payload.markets) ? payload.markets : [];
    var platforms = Array.isArray(payload.platforms) ? payload.platforms : [];
    var relations = Array.isArray(payload.marketPlatforms) ? payload.marketPlatforms : [];
    var jurisdictions = Array.isArray(payload.jurisdictions) ? payload.jurisdictions : [];
    var categories = Array.isArray(payload.categories) ? payload.categories : [];
    var reportTemplates = Array.isArray(payload.reportTemplates) ? payload.reportTemplates : [];
    if (!markets.length || !platforms.length || !relations.length) return false;

    var previousMarkets = MARKET_CONFIG.markets.slice();

    MARKET_CONFIG.markets = markets.map(function (item) {
      var previous = previousMarkets.find(function (market) { return market.code === text(item.code).toUpperCase(); });
      var metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
      var dataSources = item.dataSources || item.data_sources || metadata.dataSources || metadata.data_sources
        || (previous && previous.dataSources) || {};
      return Object.assign({ aliases: [], platformKeys: [], categoryKeys: [], jurisdictionCodes: [], dataStatus: 'configured' }, item, {
        code: text(item.code).toUpperCase(),
        key: text(item.key || item.code).toLowerCase(),
        flag: item.flag || item.emoji || '🌐',
        dataStatus: item.dataStatus || item.data_status || 'configured',
        platformKeys: unique(list(item.platformKeys || item.platform_keys).map(normalizePlatformKey).filter(Boolean)),
        categoryKeys: normalizeCategoryCodes(item.categoryKeys || item.category_keys),
        jurisdictionCodes: Array.isArray(item.jurisdictionCodes) ? item.jurisdictionCodes.slice() : [],
        dataSources: dataSources && typeof dataSources === 'object' ? Object.assign({}, dataSources) : {},
      });
    });
    MARKET_CONFIG.platforms = platforms.map(function (item) {
      return Object.assign({ aliases: [], kind: 'marketplace' }, item, {
        key: text(item.key).toLowerCase(),
        dataStatus: item.dataStatus || item.data_status || 'configured',
      });
    });
    MARKET_CONFIG.marketPlatforms = relations.map(function (item) {
      return Object.assign({}, item, {
        marketCode: text(item.marketCode || item.market_code).toUpperCase(),
        platformKey: normalizePlatformKey(item.platformKey || item.platform_key),
        dataStatus: item.dataStatus || item.data_status || 'unknown',
      });
    });
    MARKET_CONFIG.jurisdictions = jurisdictions.map(function (item) {
      return Object.assign({}, item, { code: item.code, parentCode: item.parentCode || item.parent_code || null });
    });
    if (categories.length) MARKET_CONFIG.categoryProfiles = categories.map(function (item) {
      return Object.assign({ aliases: [], requiredFields: [], reportModules: [], dataStatus: 'schema_only' }, item, {
        dataStatus: item.dataStatus || item.data_status || 'schema_only',
      });
    });
    if (reportTemplates.length) MARKET_CONFIG.reportTemplates = reportTemplates.map(function (item) {
      return Object.assign({ modules: [], requiredDomains: [], categoryCodes: [], dataStatus: 'schema_only' }, item, {
        categoryCodes: normalizeCategoryCodes(item.categoryCodes || item.category_codes),
        requiredDomains: unique(list(item.requiredDomains || item.required_domains).map(text).filter(Boolean)),
      });
    });
    MARKET_CONFIG.markets.forEach(function (market) {
      if (!Array.isArray(market.platformKeys) || !market.platformKeys.length) {
        market.platformKeys = MARKET_CONFIG.marketPlatforms.filter(function (relation) {
          return relation.marketCode === market.code && relation.status === 'active';
        }).map(function (relation) { return relation.platformKey; });
      }
    });
    state.marketCodes = state.marketCodes.filter(isAllowedMarket);
    if (!state.marketCodes.length) state.marketCodes = MARKET_CONFIG.defaultMarketCodes.filter(isAllowedMarket);
    if (!state.marketCodes.length && MARKET_CONFIG.markets.length) state.marketCodes = [MARKET_CONFIG.markets[0].code];
    state.categoryCodes = normalizeCategoryCodes(state.categoryCodes).filter(function (code) {
      return MARKET_CONFIG.categoryProfiles.some(function (profile) { return profile.code === code; });
    });
    if (state.platformKeys) {
      var configuredKeys = [];
      state.marketCodes.forEach(function (code) {
        getConfiguredMarketPlatforms(code).forEach(function (platform) {
          if (configuredKeys.indexOf(platform.key) < 0) configuredKeys.push(platform.key);
        });
      });
      state.platformKeys = state.platformKeys.filter(function (key) { return configuredKeys.indexOf(key) >= 0; });
      if (!state.platformKeys.length) state.platformKeys = null;
    }
    state.hydrated = true;
    writeStoredScope();
    publishScopeChange();
    return true;
  }

  var api = {
    configVersion: CONFIG_VERSION,
    getConfig: function () { return MARKET_CONFIG; },
    getActiveContext: getActiveContext,
    getActiveMarketNames: getActiveMarketNames,
    getActivePlatformNames: getActivePlatformNames,
    getPrimaryMarket: getPrimaryMarket,
    getPrimaryMarketCode: getPrimaryMarketCode,
    getPrimaryMarketName: getPrimaryMarketName,
    getScopeLabel: getScopeLabel,
    getActiveMarkets: getActiveMarkets,
    getActivePlatforms: getActivePlatforms,
    getConfiguredMarketPlatforms: getConfiguredMarketPlatforms,
    getActiveCategoryProfiles: getActiveCategoryProfiles,
    getReportTemplates: getReportTemplates,
    getReportTemplate: getReportTemplate,
    getMarketScoreBasis: getMarketScoreBasis,
    getMarkets: getMarkets,
    getMarket: marketByCode,
    getMarketPlatforms: getMarketPlatforms,
    getPlatform: platformByKey,
    getCategoryProfile: categoryProfile,
    getTaxRules: getTaxRules,
    getAccessRequirements: getAccessRequirements,
    normalizeMarketCode: normalizeMarketCode,
    normalizePlatform: normalizePlatform,
    normalizePlatformKey: normalizePlatformKey,
    normalizeCategoryCode: normalizeCategoryCode,
    normalizeCategoryCodes: normalizeCategoryCodes,
    normalizeSourceKind: normalizeSourceKind,
    normalizeVerificationStatus: normalizeVerificationStatus,
    normalizeSourceType: normalizeSourceType,
    normalizeDataRecord: normalizeDataRecord,
    getRecordQuality: getRecordQuality,
    isFormalRecord: isFormalRecord,
    filterFormalRecords: filterFormalRecords,
    sourceKinds: SOURCE_KINDS.slice(),
    verificationStatuses: VERIFICATION_STATUSES.slice(),
    sourceTypes: SOURCE_TYPES.slice(),
    isAllowedMarket: isAllowedMarket,
    isAllowedPlatform: isAllowedPlatform,
    isApplicablePolicy: isApplicablePolicy,
    isApplicableTax: isApplicableTax,
    isApplicableAccess: isApplicableAccess,
    isApplicableRule: isApplicableRule,
    filterByContext: getApplicableRecords,
    filterPlatforms: filterPlatforms,
    setActiveMarkets: setActiveMarkets,
    setActiveMarket: function (value) { return setActiveMarkets([value]); },
    setActivePlatforms: setActivePlatforms,
    setActiveCategories: setActiveCategories,
    registerMarket: registerMarket,
    registerPlatform: registerPlatform,
    registerCategoryProfile: registerCategoryProfile,
    hydrateCatalog: hydrateCatalog,
    isUsPolicy: isUsPolicy,
    isUsAlert: isUsAlert,
  };

  global.JAY_MARKET_CONFIG = MARKET_CONFIG;
  global.JAY_MARKET_SCOPE_API = api;
  global.JAY_MARKET_SCOPE = makeScopeSnapshot();
  global.JAY_PLATFORM_COUNT = global.JAY_MARKET_SCOPE.platformCount;
  applyScopeUi(global.JAY_MARKET_SCOPE);
  global.JAY_MARKET_SCOPE_READY = Promise.resolve(global.JAY_MARKET_SCOPE);
})(window);
