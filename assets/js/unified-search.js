(function (global) {
  'use strict';

  var SEARCH_STATE_KEY = 'jay_unified_search_state_v1';
  var PAGE_SIZE = 20;
  var searchRecords = [];
  var searchState = defaultState();
  var initialized = false;
  var serverPageCursors = { 1: null };
  var serverSnapshotAt = '';
  var serverQuerySignature = '';
  var serverRenderSequence = 0;
  var activeServerRecords = [];

  var TYPE_META = {
    all: { label: '全部结果' },
    country: { label: '国家', page: 'countries' },
    platform: { label: '平台', page: 'platforms' },
    policy: { label: '政策', page: 'policies' },
    rule: { label: '规则', page: 'rules' },
    product: { label: '商品', page: 'products' },
    shop: { label: '店铺', page: 'shops' },
    content: { label: '内容', page: 'content' }
  };
  var TYPE_ORDER = ['country', 'platform', 'policy', 'rule', 'product', 'shop', 'content'];
  var TYPE_ALIASES = {
    country: ['国家', '市场', 'country', 'market', 'guojia', 'guo jia', 'shichang', 'shi chang'],
    platform: ['平台', '电商平台', 'platform', 'marketplace', 'pingtai', 'ping tai'],
    policy: ['政策', '法规', '监管', 'policy', 'regulation', 'zhengce', 'zheng ce', 'fagui', 'fa gui'],
    rule: ['规则', '平台规则', 'rule', 'rules', 'guize', 'gui ze'],
    product: ['商品', '产品', '单品', 'product', 'goods', 'shangpin', 'shang pin', 'chanpin', 'chan pin'],
    shop: ['店铺', '商家', '店家', 'shop', 'store', 'dianpu', 'dian pu'],
    content: ['内容', '资讯', '达人', '视频', 'content', 'article', 'video', 'neirong', 'nei rong']
  };
  var TERM_GROUPS = [
    ['美国', '美区', 'US', 'USA', 'United States', 'America', 'meiguo', 'mei guo'],
    ['印度尼西亚', '印尼', 'ID', 'Indonesia', 'yindunixiya', 'yin du ni xi ya', 'yinni', 'yin ni'],
    ['Amazon', '亚马逊', 'amazon.com', 'yamaxun', 'ya ma xun'],
    ['TikTok Shop', 'TikTok小店', 'TikTok 商店', 'tiktokshop', 'tiktok-shop', '抖音海外电商'],
    ['AliExpress', '速卖通', '全球速卖通', 'sumaitong', 'su mai tong'],
    ['eBay', '易贝', 'yibei', 'yi bei'],
    ['Shopee', '虾皮', 'xiapi', 'xia pi'],
    ['Lazada', '来赞达', 'lazada']
  ];

  function text(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  function list(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return value === undefined || value === null || value === '' ? [] : [value];
  }

  function unique(values) {
    var seen = {};
    return values.filter(function (value) {
      var key = text(value);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function normalize(value) {
    var result = text(value).toLowerCase();
    try { result = result.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return result.replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function compact(value) {
    return normalize(value).replace(/\s+/g, '');
  }

  function tokens(value) {
    var normalized = normalize(value);
    var result = normalized.match(/[a-z0-9]+/g) || [];
    (normalized.match(/[\u3400-\u9fff]+/g) || []).forEach(function (part) {
      result.push(part);
      if (part.length === 1) return;
      for (var i = 0; i < part.length - 1; i += 1) result.push(part.slice(i, i + 2));
    });
    return unique(result);
  }

  function expandedAliases(values) {
    var aliases = unique(list(values).map(text));
    var aliasKeys = aliases.map(compact).filter(Boolean);
    TERM_GROUPS.forEach(function (group) {
      var matched = group.some(function (variant) {
        var key = compact(variant);
        return key && aliasKeys.some(function (alias) {
          return alias === key || (key.length >= 4 && alias.indexOf(key) >= 0);
        });
      });
      if (matched) aliases = unique(aliases.concat(group));
    });
    return aliases;
  }

  function validDate(value) {
    var raw = text(value);
    if (!raw) return '';
    var date = new Date(raw.replace(/\//g, '-'));
    return isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function formatDate(value) {
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function scopeApi() {
    return global.JAY_MARKET_SCOPE_API || null;
  }

  function config() {
    var api = scopeApi();
    return api && api.getConfig ? api.getConfig() : { markets: [], platforms: [], marketPlatforms: [] };
  }

  function configuredMarkets() {
    return (config().markets || []).filter(function (market) { return market && market.status !== 'disabled'; });
  }

  function marketCode(value) {
    var api = scopeApi();
    return api && api.normalizeMarketCode ? api.normalizeMarketCode(value) : text(value).toUpperCase();
  }

  function platformKey(value) {
    var api = scopeApi();
    return api && api.normalizePlatformKey ? api.normalizePlatformKey(value) : text(value).toLowerCase();
  }

  function marketFor(code) {
    var api = scopeApi();
    return api && api.getMarket ? api.getMarket(code) : null;
  }

  function platformFor(key) {
    var api = scopeApi();
    return api && api.getPlatform ? api.getPlatform(key) : null;
  }

  function marketName(code) {
    var market = marketFor(code);
    return market ? (market.name || market.label || market.code) : code;
  }

  function platformName(key) {
    var platform = platformFor(key);
    return platform ? (platform.name || platform.key) : key;
  }

  function configuredMarketCodes() {
    return configuredMarkets().map(function (market) { return market.code; });
  }

  function relationExists(code, key) {
    return (config().marketPlatforms || []).some(function (relation) {
      return text(relation.marketCode || relation.market_code).toUpperCase() === code
        && platformKey(relation.platformKey || relation.platform_key) === key
        && relation.status !== 'disabled';
    });
  }

  function makeRecord(input) {
    var type = input.type;
    var aliases = expandedAliases([input.title, input.subtitle, input.description]
      .concat(input.aliases || [], TYPE_ALIASES[type] || []));
    var record = {
      id: text(input.id) || type + ':' + Math.random().toString(36).slice(2),
      type: type,
      title: text(input.title),
      subtitle: text(input.subtitle),
      description: text(input.description),
      marketCodes: unique(list(input.marketCodes).map(marketCode)),
      platformKeys: unique(list(input.platformKeys).map(platformKey)),
      aliases: aliases,
      updatedAt: validDate(input.updatedAt),
      page: input.page || (TYPE_META[type] && TYPE_META[type].page) || 'overview',
      targetId: text(input.targetId),
      targetIndex: Number.isInteger(input.targetIndex) ? input.targetIndex : -1,
      sourceLabel: text(input.sourceLabel),
      verificationLabel: text(input.verificationLabel),
      verificationStatus: text(input.verificationStatus),
      verificationLevel: text(input.verificationLevel),
      categoryCode: text(input.categoryCode),
      sourceKey: text(input.sourceKey),
      sourceRecordId: text(input.sourceRecordId),
      sourceUrl: text(input.sourceUrl),
      historyUrl: text(input.historyUrl),
      publicationId: text(input.publicationId),
      versionLabel: text(input.versionLabel),
      isServerRecord: input.isServerRecord === true
    };
    record._title = normalize(record.title);
    record._titleCompact = compact(record.title);
    record._aliases = aliases.map(normalize);
    record._aliasesCompact = aliases.map(compact);
    record._tokens = tokens([record.title, record.subtitle, record.description].concat(aliases).join(' '));
    return record.title ? record : null;
  }

  function addRecord(records, input) {
    var record = makeRecord(input);
    if (record) records.push(record);
  }

  function buildCountryRecords(records) {
    configuredMarkets().forEach(function (market) {
      addRecord(records, {
        id: 'country:' + market.code,
        type: 'country',
        title: (market.flag ? market.flag + ' ' : '') + (market.name || market.label || market.code),
        subtitle: (market.regionName || market.region_name || '已配置市场') + ' · ' + market.code,
        description: market.dataStatus === 'schema_only' || market.data_status === 'schema_only' ? '数据框架已配置，业务数据尚未接入' : '查看市场档案与当前数据状态',
        aliases: [market.name, market.label, market.code].concat(market.aliases || []),
        marketCodes: [market.code],
        verificationLabel: market.dataStatus === 'schema_only' || market.data_status === 'schema_only' ? '尚未接入' : '已配置'
      });
    });
  }

  function buildPlatformRecords(records) {
    var cfg = config();
    (cfg.marketPlatforms || []).forEach(function (relation) {
      if (!relation || relation.status === 'disabled') return;
      var code = text(relation.marketCode || relation.market_code).toUpperCase();
      var key = platformKey(relation.platformKey || relation.platform_key);
      var market = marketFor(code);
      var platform = platformFor(key);
      if (!market || !platform) return;
      addRecord(records, {
        id: 'platform:' + code + ':' + key,
        type: 'platform',
        title: platform.name || key,
        subtitle: (market.name || code) + ' · ' + (relation.label || '平台档案'),
        description: relation.dataStatus === 'schema_only' || relation.data_status === 'schema_only' ? '平台关系已配置，规则数据尚未接入' : '查看该市场的平台档案与规则',
        aliases: [platform.key, platform.name, market.name, market.code].concat(platform.aliases || [], market.aliases || []),
        marketCodes: [code],
        platformKeys: [key],
        verificationLabel: relation.dataStatus === 'schema_only' || relation.data_status === 'schema_only' ? '尚未接入' : '已配置'
      });
    });
  }

  function recordSourceLabel(item) {
    var category = text(item.source_category || item.sourceCategory).toLowerCase();
    var categoryLabels = {
      official_policy: '官方政策/监管记录',
      official_statistics: '官方统计数据',
      platform_announcement: '平台官方公告',
      industry_media: '行业媒体/协会资讯',
      third_party_provider: '第三方数据服务商',
      user_upload: '工作区上传资料',
      derived: '系统派生数据',
      internal: '系统运行数据',
      demo: '演示数据'
    };
    if (categoryLabels[category]) return categoryLabels[category];
    var kind = text(item.source_kind || item.sourceKind);
    if (kind === 'official') return '官方来源';
    if (kind === 'uploaded') return '人工上传';
    if (kind === 'traceable') return '可追溯来源';
    return text(item.source || item.source_type || item.sourceType || '已接入来源');
  }

  function recordVerificationLabel(item) {
    var status = text(item.verification_status || item.verificationStatus || item.verification).toLowerCase();
    if (status === 'verified') return '已验证';
    if (status === 'uploaded') return '人工上传';
    if (status === 'pending') return '待核验';
    return '来源已接入';
  }

  function isPublishableRecord(item, domain) {
    if (!item || typeof item !== 'object') return false;
    var api = scopeApi();
    if (api && api.getRecordQuality) return api.getRecordQuality(item, { domain: domain }).formal;
    var kind = text(item.source_kind || item.sourceKind).toLowerCase();
    var status = text(item.verification_status || item.verificationStatus).toLowerCase();
    return kind !== 'demo' && ['verified', 'uploaded'].indexOf(status) >= 0;
  }

  function buildPolicyRecords(records) {
    var items = global.policiesJsonData && Array.isArray(global.policiesJsonData.items) ? global.policiesJsonData.items : [];
    var allowedMarkets = configuredMarketCodes();
    items.forEach(function (item, index) {
      if (!isPublishableRecord(item, 'policy')) return;
      var code = marketCode(item.market_code || item.marketCode || item.market || item.region);
      if (allowedMarkets.indexOf(code) < 0) return;
      var title = text(item.title_zh || item.titleZh);
      if (!title) return;
      var key = platformKey(item.platform);
      var platforms = platformFor(key) && relationExists(code, key) ? [key] : [];
      addRecord(records, {
        id: 'policy:' + text(item.id || item.source_record_id || index),
        type: 'policy',
        title: title,
        subtitle: marketName(code) + ' · 政策法规 · ' + recordSourceLabel(item),
        description: text(item.summary_zh || item.summaryZh).slice(0, 220),
        aliases: [item.title, item.category, item.source, item.source_record_id],
        marketCodes: [code],
        platformKeys: platforms,
        updatedAt: item.published_at || item.effective_from || item.collected_at,
        targetId: item.id || item.source_record_id,
        categoryCode: item.category,
        sourceKey: item.source_key,
        sourceLabel: recordSourceLabel(item),
        verificationLabel: recordVerificationLabel(item),
        verificationStatus: item.verification_status || item.verificationStatus
      });
    });
  }

  function buildRuleRecords(records) {
    var items = global.rulesJsonData && Array.isArray(global.rulesJsonData.items) ? global.rulesJsonData.items : [];
    var allowedMarkets = configuredMarketCodes();
    items.forEach(function (item, index) {
      if (!isPublishableRecord(item, 'rule')) return;
      var code = marketCode(item.market_code || item.marketCode || item.market || item.region);
      var key = platformKey(item.platform);
      if (allowedMarkets.indexOf(code) < 0 || !platformFor(key) || !relationExists(code, key)) return;
      addRecord(records, {
        id: 'rule:' + text(item.id || item.source_record_id || index),
        type: 'rule',
        title: item.title_zh || item.title,
        subtitle: marketName(code) + ' · ' + platformName(key) + ' · 平台规则',
        description: text(item.summary_zh || item.summary).slice(0, 220),
        aliases: [item.title, item.category, item.rule_key, item.source],
        marketCodes: [code],
        platformKeys: [key],
        updatedAt: item.published_at || item.effective_date || item.collected_at,
        targetId: item.id || item.source_record_id,
        categoryCode: item.topic || item.category,
        sourceKey: item.source_key,
        sourceLabel: recordSourceLabel(item),
        verificationLabel: recordVerificationLabel(item),
        verificationStatus: item.verification_status || item.verificationStatus
      });
    });
  }

  function buildProductRecords(records) {
    var rows = typeof products !== 'undefined' && Array.isArray(products) ? products : [];
    rows.forEach(function (row, index) {
      if (!Array.isArray(row) || !text(row[1]) || text(row._source).toLowerCase().indexOf('演示') >= 0) return;
      var code = marketCode(row[2]);
      var key = platformKey(row[3]);
      addRecord(records, {
        id: 'product:' + index + ':' + text(row[1]),
        type: 'product',
        title: row[1],
        subtitle: [marketName(code), platformName(key), row[4]].filter(Boolean).join(' · '),
        description: [row[5], row[11], row[10]].filter(Boolean).join(' · '),
        aliases: [row[4], row[5], row[11]],
        marketCodes: [code],
        platformKeys: [key],
        updatedAt: row[13],
        targetIndex: index,
        categoryCode: row[4],
        sourceLabel: text(row._source || '用户上传'),
        verificationLabel: '人工上传',
        verificationStatus: 'uploaded'
      });
    });
  }

  function buildShopRecords(records) {
    var rows = typeof shops !== 'undefined' && Array.isArray(shops) ? shops : [];
    rows.forEach(function (row, index) {
      if (!Array.isArray(row) || !text(row[0]) || text(row._source).toLowerCase().indexOf('演示') >= 0) return;
      var code = marketCode(row[2]);
      var key = platformKey(row[1]);
      addRecord(records, {
        id: 'shop:' + index + ':' + text(row[0]),
        type: 'shop',
        title: row[0],
        subtitle: [marketName(code), platformName(key), row[6]].filter(Boolean).join(' · '),
        description: [row[5], row[9]].filter(Boolean).join(' · '),
        aliases: [row[6], row[9]],
        marketCodes: [code],
        platformKeys: [key],
        updatedAt: row[12],
        targetIndex: index,
        categoryCode: row[6],
        sourceLabel: text(row._source || '用户上传'),
        verificationLabel: '人工上传',
        verificationStatus: 'uploaded'
      });
    });
  }

  function isPublishedContent(row) {
    if (!Array.isArray(row)) return false;
    var meta = typeof global.ctRecordMeta === 'function' ? global.ctRecordMeta(row) : row;
    var kind = text(meta.source_kind || meta.sourceKind || meta.provenance).toLowerCase();
    var status = text(meta.verification_status || meta.verificationStatus || meta.verification).toLowerCase();
    var evidence = meta.source_url || meta.sourceUrl || meta.source_record_id || meta.sourceRecordId || meta.source_file || meta.sourceFile || row[15];
    var code = marketCode(row[2]);
    var key = platformKey(row[1]);
    return kind !== 'demo' && kind !== 'mock' && ['verified', 'uploaded'].indexOf(status) >= 0
      && !!evidence && configuredMarketCodes().indexOf(code) >= 0 && relationExists(code, key);
  }

  function buildContentRecords(records) {
    var rows = typeof contentData !== 'undefined' && Array.isArray(contentData) ? contentData : [];
    rows.forEach(function (row, index) {
      if (!isPublishedContent(row)) return;
      var meta = typeof global.ctRecordMeta === 'function' ? global.ctRecordMeta(row) : row;
      var code = marketCode(row[2]);
      var key = platformKey(row[1]);
      addRecord(records, {
        id: 'content:' + index + ':' + text(row[0]),
        type: 'content',
        title: row[0] || row[8],
        subtitle: [marketName(code), platformName(key), row[3], row[10]].filter(Boolean).join(' · '),
        description: [row[7], row[8], row[13]].filter(Boolean).join(' · '),
        aliases: [row[7], row[8], row[10], row[13]],
        marketCodes: [code],
        platformKeys: [key],
        updatedAt: row[6] || meta.collected_at || meta.collectedAt,
        targetIndex: index,
        categoryCode: row[10],
        sourceKey: meta.source_key || meta.sourceKey,
        sourceLabel: recordSourceLabel(meta),
        verificationLabel: recordVerificationLabel(meta),
        verificationStatus: meta.verification_status || meta.verificationStatus || meta.verification
      });
    });
  }

  function buildIndex() {
    var records = [];
    buildCountryRecords(records);
    buildPlatformRecords(records);
    buildPolicyRecords(records);
    buildRuleRecords(records);
    buildProductRecords(records);
    buildShopRecords(records);
    buildContentRecords(records);
    var ids = {};
    return records.filter(function (record) {
      if (!record || ids[record.id]) return false;
      ids[record.id] = true;
      return true;
    });
  }

  function scoreRecord(record, query) {
    var normalizedQuery = normalize(query);
    var compactQuery = compact(query);
    if (!normalizedQuery) return 1;
    var score = 0;
    if (record._titleCompact === compactQuery) score += 140;
    else if (compactQuery && record._titleCompact.indexOf(compactQuery) >= 0) score += 90;
    if (record._aliasesCompact.indexOf(compactQuery) >= 0) score += 120;
    else if (compactQuery && record._aliasesCompact.some(function (alias) { return alias.indexOf(compactQuery) >= 0; })) score += 70;

    var queryTokens = tokens(normalizedQuery).filter(function (token) { return compact(token).length >= 2; });
    var matched = 0;
    queryTokens.forEach(function (queryToken) {
      var queryKey = compact(queryToken);
      var hit = record._tokens.some(function (recordToken) {
        var recordKey = compact(recordToken);
        return recordKey === queryKey || recordKey.indexOf(queryKey) >= 0 || queryKey.indexOf(recordKey) >= 0;
      });
      if (hit) matched += 1;
    });
    if (queryTokens.length) {
      score += Math.round((matched / queryTokens.length) * 50);
      if (matched === queryTokens.length) score += 25;
    }
    return score;
  }

  function defaultState() {
    return {
      q: '', type: 'all', market: '', platform: '', category: '', year: '', source: '',
      verification: '', time: 'all', from: '', to: '', sort: 'relevance', page: 1, record: ''
    };
  }

  function sanitizeState(input) {
    var state = Object.assign(defaultState(), input || {});
    if (!TYPE_META[state.type]) state.type = 'all';
    if (['all', '7d', '30d', '1y', 'custom'].indexOf(state.time) < 0) state.time = 'all';
    if (['relevance', 'newest', 'oldest', 'title'].indexOf(state.sort) < 0) state.sort = 'relevance';
    state.market = text(state.market).toUpperCase();
    state.platform = platformKey(state.platform);
    state.category = text(state.category).toLowerCase().slice(0, 120);
    state.year = /^\d{4}$/.test(text(state.year)) ? text(state.year) : '';
    state.source = text(state.source).toLowerCase().slice(0, 120);
    state.verification = ['verified', 'uploaded'].indexOf(text(state.verification).toLowerCase()) >= 0 ? text(state.verification).toLowerCase() : '';
    state.from = /^\d{4}-\d{2}-\d{2}$/.test(text(state.from)) ? text(state.from) : '';
    state.to = /^\d{4}-\d{2}-\d{2}$/.test(text(state.to)) ? text(state.to) : '';
    state.page = Math.max(1, parseInt(state.page, 10) || 1);
    state.q = text(state.q).slice(0, 200);
    state.record = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(state.record)) ? text(state.record) : '';
    return state;
  }

  function stateFromHash() {
    var raw = global.location.hash.replace(/^#/, '');
    if (raw.split('?')[0] !== 'search') return null;
    var params = new URLSearchParams(raw.indexOf('?') >= 0 ? raw.slice(raw.indexOf('?') + 1) : '');
    var input = {};
    ['q', 'type', 'market', 'platform', 'category', 'year', 'source', 'verification', 'time', 'from', 'to', 'sort', 'page', 'record'].forEach(function (key) {
      if (params.has(key)) input[key] = params.get(key);
    });
    return sanitizeState(input);
  }

  function stateHash(state) {
    var params = new URLSearchParams();
    ['q', 'type', 'market', 'platform', 'category', 'year', 'source', 'verification', 'time', 'from', 'to', 'sort', 'record'].forEach(function (key) {
      if (state[key] && !(key === 'type' && state[key] === 'all') && !(key === 'time' && state[key] === 'all') && !(key === 'sort' && state[key] === 'relevance')) params.set(key, state[key]);
    });
    if (state.page > 1) params.set('page', String(state.page));
    var query = params.toString();
    return '#search' + (query ? '?' + query : '');
  }

  function persistState() {
    try { global.sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(searchState)); } catch (e) {}
  }

  function writeState(mode) {
    var hash = stateHash(searchState);
    if (global.location.hash === hash) return;
    try {
      if (mode === 'push') global.history.pushState(null, '', hash);
      else global.history.replaceState(null, '', hash);
    } catch (e) { global.location.hash = hash; }
  }

  function matchesTime(record, state) {
    if (state.time === 'all') return true;
    if (!record.updatedAt) return false;
    var timestamp = new Date(record.updatedAt).getTime();
    if (!isFinite(timestamp)) return false;
    var now = Date.now();
    if (state.time === '7d') return timestamp >= now - 7 * 86400000 && timestamp <= now;
    if (state.time === '30d') return timestamp >= now - 30 * 86400000 && timestamp <= now;
    if (state.time === '1y') return timestamp >= now - 365 * 86400000 && timestamp <= now;
    var start = state.from ? new Date(state.from + 'T00:00:00').getTime() : -Infinity;
    var end = state.to ? new Date(state.to + 'T23:59:59.999').getTime() : Infinity;
    return timestamp >= start && timestamp <= end;
  }

  function runSearch(state) {
    var scored = searchRecords.map(function (record) { return { record: record, score: scoreRecord(record, state.q) }; })
      .filter(function (item) { return item.score > 0; })
      .filter(function (item) { return !state.market || item.record.marketCodes.indexOf(state.market) >= 0; })
      .filter(function (item) { return !state.platform || item.record.platformKeys.indexOf(state.platform) >= 0; })
      .filter(function (item) { return !state.category || normalize(item.record.categoryCode) === normalize(state.category); })
      .filter(function (item) { return !state.source || item.record.sourceKey === state.source; })
      .filter(function (item) { return !state.verification || item.record.verificationStatus === state.verification; })
      .filter(function (item) { return !state.year || (item.record.updatedAt && String(new Date(item.record.updatedAt).getFullYear()) === state.year); })
      .filter(function (item) { return matchesTime(item.record, state); });
    var counts = { all: scored.length };
    TYPE_ORDER.forEach(function (type) { counts[type] = scored.filter(function (item) { return item.record.type === type; }).length; });
    if (state.type !== 'all') scored = scored.filter(function (item) { return item.record.type === state.type; });
    scored.sort(function (a, b) {
      if (state.sort === 'newest') return (new Date(b.record.updatedAt || 0).getTime() || 0) - (new Date(a.record.updatedAt || 0).getTime() || 0) || b.score - a.score;
      if (state.sort === 'oldest') return (new Date(a.record.updatedAt || '9999-12-31').getTime() || Infinity) - (new Date(b.record.updatedAt || '9999-12-31').getTime() || Infinity) || b.score - a.score;
      if (state.sort === 'title') return a.record.title.localeCompare(b.record.title, 'zh-CN');
      return b.score - a.score || (new Date(b.record.updatedAt || 0).getTime() || 0) - (new Date(a.record.updatedAt || 0).getTime() || 0) || a.record.title.localeCompare(b.record.title, 'zh-CN');
    });
    return { items: scored, counts: counts };
  }

  function serverSearchAvailable() {
    return typeof global.jayFunctionRequest === 'function'
      && typeof global.jayCanUseUserDb === 'function'
      && global.jayCanUseUserDb();
  }

  function resetServerPaging() {
    serverPageCursors = { 1: null };
    serverSnapshotAt = '';
    serverQuerySignature = '';
  }

  function serverDateRange(state) {
    var now = new Date();
    var from = state.time === 'custom' ? state.from : '';
    var to = state.time === 'custom' ? state.to : '';
    if (state.time === '7d') from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    if (state.time === '30d') from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    if (state.time === '1y') from = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
    if (state.time !== 'all') to = to || now.toISOString().slice(0, 10);
    return { from: from || null, to: to || null };
  }

  function serverStateSignature(state) {
    return JSON.stringify({
      q: state.q, type: state.type, market: state.market, platform: state.platform,
      category: state.category, year: state.year, source: state.source,
      verification: state.verification, time: state.time, from: state.from,
      to: state.to, sort: state.sort, record: state.record
    });
  }

  function serverRecord(item) {
    var type = TYPE_META[text(item.type)] ? text(item.type) : 'content';
    var code = marketCode(item.market_code);
    var key = platformKey(item.platform_key);
    var verificationLabels = { verified: '已验证', uploaded: '人工上传' };
    var levelLabels = { high: '高可信', medium: '中可信', low: '低可信', workspace: '工作区资料' };
    var version = item.version_label || (item.version_number ? 'v' + item.version_number : '');
    return makeRecord({
      id: 'history:' + text(item.id),
      type: type,
      title: item.title || item.record_key || item.source_record_id,
      subtitle: [code ? marketName(code) : '', key ? platformName(key) : '', item.category_code, version].filter(Boolean).join(' · '),
      description: item.summary || item.content_excerpt,
      aliases: [item.record_key, item.source_record_id, item.source_name, item.source_key],
      marketCodes: code ? [code] : [],
      platformKeys: key ? [key] : [],
      updatedAt: item.published_at || item.effective_from || item.collected_at,
      sourceLabel: item.source_name || item.source_key,
      verificationLabel: verificationLabels[item.verification_status] || item.verification_status,
      verificationLevel: levelLabels[item.verification_level] || item.verification_level,
      categoryCode: item.category_code,
      sourceKey: item.source_key,
      sourceRecordId: item.source_record_id,
      sourceUrl: item.source_url,
      historyUrl: item.history_url,
      publicationId: item.id,
      targetId: item.source_record_id,
      isServerRecord: true
    });
  }

  async function runServerSearch(state) {
    var signature = serverStateSignature(state);
    if (signature !== serverQuerySignature) {
      serverPageCursors = { 1: null };
      serverSnapshotAt = '';
      serverQuerySignature = signature;
    }
    if (state.page > 1 && !serverPageCursors[state.page]) {
      state.page = 1;
      writeState('replace');
    }
    var range = serverDateRange(state);
    var requestId = 'history-search:' + Date.now() + ':' + Math.random().toString(36).slice(2, 9);
    var response = await global.jayFunctionRequest('history-search', {
      query: state.q,
      type: state.type === 'all' ? null : state.type,
      market_code: state.market || null,
      platform_key: state.platform || null,
      category_code: state.category || null,
      year: state.year ? Number(state.year) : null,
      source_key: state.source || null,
      verification_status: state.verification || null,
      from: range.from,
      to: range.to,
      sort: state.sort,
      cursor: serverPageCursors[state.page] || null,
      snapshot_at: serverSnapshotAt || null,
      page_size: PAGE_SIZE,
      record_id: state.record || null
    }, { timeout: 30000, retryOnNetwork: true, requestId: requestId });
    serverSnapshotAt = text(response.query_snapshot_at) || serverSnapshotAt;
    if (response.has_more && response.next_cursor) serverPageCursors[state.page + 1] = response.next_cursor;
    else delete serverPageCursors[state.page + 1];
    var items = list(response.items).map(serverRecord).filter(Boolean).map(function (record) {
      return { record: record, score: 1 };
    });
    return {
      items: items,
      counts: response.counts || { all: Number(response.total || 0) },
      total: Number(response.total || 0),
      facets: response.facets || {},
      hasMore: response.has_more === true,
      nextCursor: response.next_cursor || null,
      requestId: response.request_id || requestId,
      elapsedMs: Number(response.elapsed_ms || 0),
      server: true
    };
  }

  function renderSearchLoading() {
    var container = document.getElementById('unified-search-results');
    var total = document.getElementById('unified-search-total');
    var description = document.getElementById('unified-search-description');
    if (total) total.textContent = '正在检索';
    if (description) description.textContent = '正在查询服务端历史情报库...';
    if (!container) return;
    container.replaceChildren();
    var loading = document.createElement('div');
    loading.className = 'unified-search-empty';
    var heading = document.createElement('h3');
    heading.textContent = '正在查询历史记录';
    var message = document.createElement('p');
    message.textContent = '政策、规则、商品和店铺记录将由服务端筛选并分页返回。';
    loading.append(heading, message);
    container.appendChild(loading);
  }

  function renderSearchError(error) {
    var container = document.getElementById('unified-search-results');
    var total = document.getElementById('unified-search-total');
    var description = document.getElementById('unified-search-description');
    var code = text(error && error.code || 'SEARCH_UNAVAILABLE');
    var requestId = text(error && error.requestId || error && error.details && error.details.request_id);
    if (total) total.textContent = '检索失败';
    if (description) description.textContent = '服务端历史搜索未返回结果，本页没有回退为浏览器少量缓存。';
    if (!container) return;
    container.replaceChildren();
    var panel = document.createElement('div');
    panel.className = 'unified-search-empty unified-search-error';
    var heading = document.createElement('h3');
    heading.textContent = '历史搜索暂时不可用';
    var message = document.createElement('p');
    message.textContent = '错误类型：' + code + (requestId ? ' · 请求编号：' + requestId : '') + '。请稍后重试。';
    var retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'unified-search-open';
    retry.textContent = '重新检索';
    retry.addEventListener('click', function () { renderPage({ fromHash: false }); });
    panel.append(heading, message, retry);
    container.appendChild(panel);
    renderPagination(0, 1, { server: true, hasMore: false });
  }

  function option(select, value, label) {
    var node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    select.appendChild(node);
  }

  function renderFilterOptions(facets) {
    var marketSelect = document.getElementById('unified-search-market');
    var platformSelect = document.getElementById('unified-search-platform');
    if (!marketSelect || !platformSelect) return;
    marketSelect.replaceChildren();
    option(marketSelect, '', '全部已配置市场');
    configuredMarkets().forEach(function (market) { option(marketSelect, market.code, (market.flag ? market.flag + ' ' : '') + (market.name || market.code)); });
    marketSelect.value = searchState.market;

    platformSelect.replaceChildren();
    option(platformSelect, '', '全部平台');
    var cfg = config();
    (cfg.platforms || []).forEach(function (platform) {
      var key = platformKey(platform.key);
      if (searchState.market && !relationExists(searchState.market, key)) return;
      option(platformSelect, key, platform.name || key);
    });
    if ([].some.call(platformSelect.options, function (item) { return item.value === searchState.platform; })) platformSelect.value = searchState.platform;
    else searchState.platform = '';

    facets = facets || {};
    var categorySelect = document.getElementById('unified-search-category');
    var yearSelect = document.getElementById('unified-search-year');
    var sourceSelect = document.getElementById('unified-search-source');
    var verificationSelect = document.getElementById('unified-search-verification');
    function refill(select, emptyLabel, values, selected, valueFor, labelFor) {
      if (!select) return;
      select.replaceChildren();
      option(select, '', emptyLabel);
      list(values).forEach(function (value) {
        var key = text(valueFor ? valueFor(value) : value);
        if (key) option(select, key, text(labelFor ? labelFor(value) : value) || key);
      });
      if (selected && ![].some.call(select.options, function (item) { return item.value === selected; })) option(select, selected, selected);
      select.value = selected || '';
    }
    refill(categorySelect, '全部品类', facets.categories, searchState.category);
    refill(yearSelect, '全部年份', facets.years, searchState.year);
    refill(sourceSelect, '全部来源', facets.sources, searchState.source, function (item) { return item && item.key; }, function (item) { return item && (item.name || item.key); });
    refill(verificationSelect, '全部核验状态', facets.verification_statuses || ['verified', 'uploaded'], searchState.verification, null, function (value) {
      return ({ verified: '已验证', uploaded: '人工上传' })[value] || value;
    });
  }

  function localFacets() {
    var years = unique(searchRecords.map(function (record) {
      return record.updatedAt ? String(new Date(record.updatedAt).getFullYear()) : '';
    }).filter(Boolean)).sort().reverse();
    var categories = unique(searchRecords.map(function (record) { return record.categoryCode; }).filter(Boolean)).sort();
    var sourceMap = {};
    searchRecords.forEach(function (record) {
      if (record.sourceKey) sourceMap[record.sourceKey] = record.sourceLabel || record.sourceKey;
    });
    return {
      years: years,
      categories: categories,
      sources: Object.keys(sourceMap).sort().map(function (key) { return { key: key, name: sourceMap[key] }; }),
      verification_statuses: ['verified', 'uploaded']
    };
  }

  function renderTypeTabs(counts) {
    var container = document.getElementById('unified-search-types');
    if (!container) return;
    container.replaceChildren();
    ['all'].concat(TYPE_ORDER).forEach(function (type) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'unified-search-type' + (searchState.type === type ? ' active' : '');
      button.dataset.type = type;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', searchState.type === type ? 'true' : 'false');
      var label = document.createElement('span');
      label.textContent = TYPE_META[type].label;
      var count = document.createElement('b');
      count.textContent = String(counts[type] || 0);
      button.append(label, count);
      container.appendChild(button);
    });
  }

  function resultMeta(record) {
    var parts = [];
    if (record.updatedAt) parts.push(formatDate(record.updatedAt));
    if (record.sourceLabel) parts.push(record.sourceLabel);
    if (record.verificationLabel) parts.push(record.verificationLabel);
    if (record.verificationLevel) parts.push(record.verificationLevel);
    if (record.sourceRecordId) parts.push('来源 ID ' + record.sourceRecordId);
    return unique(parts).join(' · ');
  }

  function renderResults(result) {
    var container = document.getElementById('unified-search-results');
    var total = document.getElementById('unified-search-total');
    var description = document.getElementById('unified-search-description');
    if (!container || !total || !description) return;
    var totalItems = result.server ? Number(result.total || 0) : result.items.length;
    var pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (!result.server && searchState.page > pageCount) searchState.page = pageCount;
    var start = result.server ? 0 : (searchState.page - 1) * PAGE_SIZE;
    var pageItems = result.server ? result.items : result.items.slice(start, start + PAGE_SIZE);
    total.textContent = totalItems + ' 条结果';
    if (result.server) {
      description.textContent = searchState.record
        ? '已定位正式历史记录 · 来源和核验信息来自服务端'
        : (searchState.q ? '服务端历史库中关键词“' + searchState.q + '”的筛选结果' : '显示服务端正式历史投影中的可检索记录');
    } else {
      description.textContent = searchState.q ? '关键词“' + searchState.q + '”的本地演示筛选结果' : '只读演示使用浏览器内的有限公开记录';
    }
    container.replaceChildren();

    if (!pageItems.length) {
      var empty = document.createElement('div');
      empty.className = 'unified-search-empty';
      var heading = document.createElement('h3');
      heading.textContent = '没有匹配结果';
      var message = document.createElement('p');
      if (['product', 'shop', 'content'].indexOf(searchState.type) >= 0) message.textContent = '当前账号尚未接入这类数据，或现有上传记录不符合筛选条件。系统不会使用演示数据补充结果。';
      else message.textContent = '请调整关键词、市场、平台或时间范围后重试。';
      empty.append(heading, message);
      container.appendChild(empty);
    }

    pageItems.forEach(function (item) {
      var record = item.record;
      var article = document.createElement('article');
      article.className = 'unified-search-result';
      article.dataset.recordId = record.id;
      var type = document.createElement('span');
      type.className = 'unified-search-result-type type-' + record.type;
      type.textContent = TYPE_META[record.type].label;
      var body = document.createElement('div');
      body.className = 'unified-search-result-body';
      var heading = document.createElement('h3');
      heading.textContent = record.title;
      var subtitle = document.createElement('p');
      subtitle.className = 'unified-search-result-subtitle';
      subtitle.textContent = record.subtitle;
      body.append(heading, subtitle);
      if (record.description) {
        var detail = document.createElement('p');
        detail.className = 'unified-search-result-description';
        detail.textContent = record.description;
        body.appendChild(detail);
      }
      var meta = document.createElement('small');
      meta.textContent = resultMeta(record);
      if (meta.textContent) body.appendChild(meta);
      var actions = document.createElement('div');
      actions.className = 'unified-search-result-actions';
      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'unified-search-open';
      open.dataset.recordId = record.id;
      open.setAttribute('aria-label', '打开' + record.title);
      open.title = record.isServerRecord ? '定位历史记录' : '打开结果';
      open.textContent = record.isServerRecord ? '历史记录' : '查看';
      actions.appendChild(open);
      var safeSourceUrl = typeof global.jaySafeHttpsUrl === 'function' ? global.jaySafeHttpsUrl(record.sourceUrl) : '';
      if (safeSourceUrl) {
        var sourceLink = document.createElement('a');
        sourceLink.className = 'unified-search-source-link';
        sourceLink.href = safeSourceUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        sourceLink.textContent = '原始来源';
        actions.appendChild(sourceLink);
      }
      article.append(type, body, actions);
      container.appendChild(article);
    });

    renderPagination(totalItems, pageCount, result);
  }

  function renderPagination(totalItems, pageCount, result) {
    var container = document.getElementById('unified-search-pagination');
    if (!container) return;
    container.replaceChildren();
    result = result || {};
    if (result.server) {
      if (searchState.page === 1 && !result.hasMore) return;
      function cursorButton(label, page, disabled, direction) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.page = String(page);
        button.dataset.direction = direction;
        button.disabled = !!disabled;
        container.appendChild(button);
      }
      cursorButton('上一页', searchState.page - 1, searchState.page === 1, 'previous');
      var status = document.createElement('span');
      status.className = 'unified-search-page-status';
      status.textContent = '第 ' + searchState.page + ' 页 · 共 ' + totalItems + ' 条';
      container.appendChild(status);
      cursorButton('下一页', searchState.page + 1, !result.hasMore, 'next');
      return;
    }
    if (totalItems <= PAGE_SIZE) return;
    function pageButton(label, page, disabled, active) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.page = String(page);
      button.disabled = !!disabled;
      if (active) button.className = 'active';
      container.appendChild(button);
    }
    pageButton('上一页', searchState.page - 1, searchState.page === 1, false);
    var first = Math.max(1, searchState.page - 2);
    var last = Math.min(pageCount, first + 4);
    first = Math.max(1, last - 4);
    for (var page = first; page <= last; page += 1) pageButton(String(page), page, false, page === searchState.page);
    pageButton('下一页', searchState.page + 1, searchState.page === pageCount, false);
  }

  async function renderPage(options) {
    options = options || {};
    if (!document.getElementById('unified-search-results')) return;
    var hashState = options.fromHash === false ? null : stateFromHash();
    if (hashState) searchState = hashState;
    searchRecords = buildIndex();
    global.searchIndex = searchRecords;
    renderFilterOptions();
    var input = document.getElementById('unified-search-input');
    var time = document.getElementById('unified-search-time');
    var sort = document.getElementById('unified-search-sort');
    var from = document.getElementById('unified-search-from');
    var to = document.getElementById('unified-search-to');
    if (input) input.value = searchState.q;
    var globalInput = document.getElementById('global-search');
    if (globalInput) globalInput.value = searchState.q;
    if (time) time.value = searchState.time;
    if (sort) sort.value = searchState.sort;
    if (from) from.value = searchState.from;
    if (to) to.value = searchState.to;
    var custom = document.getElementById('unified-search-custom-time');
    if (custom) custom.hidden = searchState.time !== 'custom';
    var scope = document.getElementById('unified-search-scope');
    if (scope) scope.textContent = serverSearchAvailable()
      ? (searchState.market ? marketName(searchState.market) + ' · 服务端历史库' : '服务端历史情报库')
      : (searchState.market ? marketName(searchState.market) + ' · 本地演示' : '本地只读演示');
    var result;
    if (serverSearchAvailable()) {
      var sequence = ++serverRenderSequence;
      renderSearchLoading();
      try {
        result = await runServerSearch(searchState);
      } catch (error) {
        if (sequence !== serverRenderSequence) return;
        renderSearchError(error);
        persistState();
        return;
      }
      if (sequence !== serverRenderSequence) return;
      activeServerRecords = result.items.map(function (item) { return item.record; });
      renderFilterOptions(result.facets);
    } else {
      activeServerRecords = [];
      result = runSearch(searchState);
      renderFilterOptions(localFacets());
    }
    renderTypeTabs(result.counts);
    renderResults(result);
    persistState();
    if (global.lucide && global.lucide.createIcons) global.lucide.createIcons();
  }

  function commitState(patch, mode) {
    var affectsQuery = Object.keys(patch || {}).some(function (key) { return key !== 'page'; });
    if (affectsQuery) resetServerPaging();
    searchState = sanitizeState(Object.assign({}, searchState, patch || {}));
    writeState(mode || 'replace');
    renderPage({ fromHash: false });
  }

  function findRecord(id) {
    return activeServerRecords.find(function (record) { return record.id === id; })
      || searchRecords.find(function (record) { return record.id === id; }) || null;
  }

  function activateRecord(record) {
    if (!record) return;
    persistState();
    if (record.isServerRecord && record.publicationId) {
      resetServerPaging();
      searchState = sanitizeState(Object.assign(defaultState(), { record: record.publicationId, page: 1 }));
      writeState('push');
      if (typeof global.switchPage === 'function') global.switchPage('search', { fromHash: true });
      renderPage({ fromHash: false });
      return;
    }
    var api = scopeApi();
    var code = record.marketCodes[0] || '';
    var key = record.platformKeys[0] || '';
    if (api && code && api.setActiveMarket) api.setActiveMarket(code);
    if (api && api.setActivePlatforms) api.setActivePlatforms(key ? [key] : null);
    if (typeof global.switchPage === 'function') global.switchPage(record.page);

    global.setTimeout(function () {
      if (record.type === 'country') {
        var selector = document.getElementById('country-profile-selector');
        if (selector && code) { selector.value = code; selector.dispatchEvent(new Event('change', { bubbles: true })); }
      } else if (record.type === 'platform') {
        var card = document.querySelector('#platforms .platform-card[data-platform="' + CSS.escape(platformName(key)) + '"]');
        if (card) { card.focus(); card.scrollIntoView({ block: 'center' }); }
      } else if (record.type === 'policy') {
        var policySearch = document.getElementById('pl-search');
        if (policySearch) policySearch.value = record.title;
        if (typeof global.plSearch === 'function') global.plSearch();
      } else if (record.type === 'rule') {
        var platformSelect = document.getElementById('rl-platform');
        if (platformSelect) platformSelect.value = platformName(key);
        if (typeof global.renderRulesPage === 'function') global.renderRulesPage();
        if (record.targetId && typeof global.rlGetJsonItems === 'function' && typeof global.openRlRuleDetail === 'function') {
          var index = global.rlGetJsonItems().findIndex(function (item) { return text(item.id || item.source_record_id) === record.targetId; });
          if (index >= 0) global.openRlRuleDetail(index);
        }
      } else if (record.type === 'product') {
        if (typeof global.prSwitchTab === 'function') global.prSwitchTab('competitor');
        var productSearch = document.getElementById('pr-f-keyword');
        if (productSearch) productSearch.value = record.title;
        if (typeof global.prApplyFilters === 'function') global.prApplyFilters();
        if (record.targetIndex >= 0 && typeof global.prShowDetail === 'function') global.prShowDetail(record.targetIndex);
      } else if (record.type === 'shop') {
        var shopSearch = document.getElementById('sh-f-keyword');
        if (shopSearch) shopSearch.value = record.title;
        if (typeof global.shApplyFilters === 'function') global.shApplyFilters();
        if (record.targetIndex >= 0 && typeof global.shShowDetail === 'function') global.shShowDetail(record.targetIndex);
      } else if (record.type === 'content' && document.getElementById('ct-modal-overlay') && record.targetIndex >= 0 && typeof global.ctShowDetail === 'function') {
        global.ctShowDetail(record.targetIndex);
      }
    }, 80);
  }

  function openUnifiedSearch(query, patch) {
    if (typeof global.prApplyImportedPayload !== 'function' && typeof global.jayEnsurePageAssets === 'function') {
      return global.jayEnsurePageAssets('products').then(function () { return openUnifiedSearch(query, patch); });
    }
    resetServerPaging();
    searchState = sanitizeState(Object.assign(defaultState(), patch || {}, { q: text(query), page: 1 }));
    searchRecords = buildIndex();
    global.searchIndex = searchRecords;
    writeState('push');
    if (typeof global.switchPage === 'function') global.switchPage('search', { fromHash: true });
    renderPage({ fromHash: false });
    var dropdown = document.getElementById('search-results');
    if (dropdown) dropdown.classList.remove('show');
  }

  function positionDropdown(dropdown, input) {
    var rect = input.getBoundingClientRect();
    dropdown.style.left = Math.max(12, rect.left) + 'px';
    dropdown.style.right = 'auto';
    dropdown.style.top = Math.round(rect.bottom + 8) + 'px';
    dropdown.style.width = Math.min(Math.max(rect.width, 340), global.innerWidth - 24) + 'px';
  }

  function renderQuickResults(query) {
    var dropdown = document.getElementById('search-results');
    var input = document.getElementById('global-search');
    if (!dropdown || !input) return;
    var q = text(query);
    if (!q) { dropdown.classList.remove('show'); return; }
    searchRecords = buildIndex();
    global.searchIndex = searchRecords;
    var hits = searchRecords.map(function (record) { return { record: record, score: scoreRecord(record, q) }; })
      .filter(function (item) { return item.score > 0; })
      .sort(function (a, b) { return b.score - a.score || a.record.title.localeCompare(b.record.title, 'zh-CN'); })
      .slice(0, 8);
    dropdown.replaceChildren();
    hits.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'result';
      button.dataset.recordId = item.record.id;
      var title = document.createElement('b');
      title.textContent = item.record.title;
      var meta = document.createElement('small');
      meta.textContent = TYPE_META[item.record.type].label + ' · ' + item.record.subtitle;
      button.append(title, meta);
      dropdown.appendChild(button);
    });
    if (!hits.length) {
      var empty = document.createElement('p');
      empty.className = 'search-results-empty';
      empty.textContent = '未找到快捷结果，可在完整搜索页调整筛选条件。';
      dropdown.appendChild(empty);
    }
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'search-results-all';
    all.textContent = '查看全部搜索结果';
    dropdown.appendChild(all);
    positionDropdown(dropdown, input);
    dropdown.classList.add('show');
  }

  function bindPage() {
    var form = document.getElementById('unified-search-form');
    var input = document.getElementById('unified-search-input');
    var market = document.getElementById('unified-search-market');
    var platform = document.getElementById('unified-search-platform');
    var category = document.getElementById('unified-search-category');
    var year = document.getElementById('unified-search-year');
    var source = document.getElementById('unified-search-source');
    var verification = document.getElementById('unified-search-verification');
    var time = document.getElementById('unified-search-time');
    var sort = document.getElementById('unified-search-sort');
    var from = document.getElementById('unified-search-from');
    var to = document.getElementById('unified-search-to');
    var reset = document.getElementById('unified-search-reset');
    var types = document.getElementById('unified-search-types');
    var results = document.getElementById('unified-search-results');
    var pagination = document.getElementById('unified-search-pagination');
    if (form) form.addEventListener('submit', function (event) { event.preventDefault(); commitState({ q: input.value, record: '', page: 1 }, 'push'); });
    if (market) market.addEventListener('change', function () { commitState({ market: market.value, platform: '', page: 1 }, 'replace'); });
    if (platform) platform.addEventListener('change', function () { commitState({ platform: platform.value, page: 1 }, 'replace'); });
    if (category) category.addEventListener('change', function () { commitState({ category: category.value, page: 1 }, 'replace'); });
    if (year) year.addEventListener('change', function () { commitState({ year: year.value, page: 1 }, 'replace'); });
    if (source) source.addEventListener('change', function () { commitState({ source: source.value, page: 1 }, 'replace'); });
    if (verification) verification.addEventListener('change', function () { commitState({ verification: verification.value, page: 1 }, 'replace'); });
    if (time) time.addEventListener('change', function () { commitState({ time: time.value, page: 1 }, 'replace'); });
    if (sort) sort.addEventListener('change', function () { commitState({ sort: sort.value, page: 1 }, 'replace'); });
    if (from) from.addEventListener('change', function () { commitState({ from: from.value, page: 1 }, 'replace'); });
    if (to) to.addEventListener('change', function () { commitState({ to: to.value, page: 1 }, 'replace'); });
    if (reset) reset.addEventListener('click', function () { resetServerPaging(); searchState = defaultState(); writeState('replace'); renderPage({ fromHash: false }); });
    if (types) types.addEventListener('click', function (event) {
      var button = event.target.closest('[data-type]');
      if (button) commitState({ type: button.dataset.type, page: 1 }, 'replace');
    });
    if (results) results.addEventListener('click', function (event) {
      var button = event.target.closest('[data-record-id]');
      if (button) activateRecord(findRecord(button.dataset.recordId));
    });
    if (pagination) pagination.addEventListener('click', function (event) {
      var button = event.target.closest('[data-page]');
      if (button && !button.disabled) commitState({ page: Number(button.dataset.page) }, 'push');
    });
  }

  function bindGlobalSearch() {
    var input = document.getElementById('global-search');
    var dropdown = document.getElementById('search-results');
    if (!input || !dropdown) return;
    input.oninput = function () {
      var query = input.value;
      if (typeof global.prApplyImportedPayload === 'function') {
        renderQuickResults(query);
      } else if (typeof global.jayEnsurePageAssets === 'function') {
        global.jayEnsurePageAssets('products').then(function () { renderQuickResults(query); });
      } else renderQuickResults(query);
    };
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof global.jayAddSearchHistory === 'function' && text(input.value)) global.jayAddSearchHistory(input.value);
        openUnifiedSearch(input.value);
      } else if (event.key === 'Escape') dropdown.classList.remove('show');
    });
    input.addEventListener('focus', function () { if (text(input.value)) renderQuickResults(input.value); });
    dropdown.onclick = function (event) {
      var recordButton = event.target.closest('[data-record-id]');
      if (recordButton) { activateRecord(findRecord(recordButton.dataset.recordId)); dropdown.classList.remove('show'); return; }
      if (event.target.closest('.search-results-all')) openUnifiedSearch(input.value);
    };
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.topbar-search') && !event.target.closest('#search-results')) dropdown.classList.remove('show');
    });
    global.addEventListener('resize', function () { if (dropdown.classList.contains('show')) positionDropdown(dropdown, input); });
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    bindPage();
    bindGlobalSearch();
    searchState = stateFromHash() || defaultState();
    searchRecords = buildIndex();
    global.searchIndex = searchRecords;
    if (global.location.hash.replace(/^#/, '').split('?')[0] === 'search') renderPage();
  }

  global.jayBuildSearchIndex = buildIndex;
  global.jayRebuildSearch = function () {
    searchRecords = buildIndex();
    global.searchIndex = searchRecords;
    if (document.getElementById('search') && document.getElementById('search').classList.contains('active')) renderPage({ fromHash: false });
    return searchRecords;
  };
  global.jayRenderUnifiedSearch = renderPage;
  global.jayOpenUnifiedSearch = openUnifiedSearch;
  global.jayActivateSearchResult = function (id) { activateRecord(findRecord(id)); };
  global.jayGetUnifiedSearchState = function () { return Object.assign({}, searchState); };
  global.jayRunUnifiedSearch = function (state) {
    searchRecords = buildIndex();
    global.searchIndex = searchRecords;
    return runSearch(sanitizeState(state));
  };
  global.JAY_SEARCH_TYPE_ORDER = TYPE_ORDER.slice();

  global.addEventListener('jay:market-scope-change', function () {
    searchRecords = buildIndex();
    global.searchIndex = searchRecords;
    if (document.getElementById('search') && document.getElementById('search').classList.contains('active')) renderPage({ fromHash: false });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})(window);
