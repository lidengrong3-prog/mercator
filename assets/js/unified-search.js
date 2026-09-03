(function (global) {
  'use strict';

  var SEARCH_STATE_KEY = 'jay_unified_search_state_v1';
  var PAGE_SIZE = 20;
  var searchRecords = [];
  var searchState = defaultState();
  var initialized = false;

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
      verificationLabel: text(input.verificationLabel)
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
        sourceLabel: recordSourceLabel(item),
        verificationLabel: recordVerificationLabel(item)
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
        sourceLabel: recordSourceLabel(item),
        verificationLabel: recordVerificationLabel(item)
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
        sourceLabel: text(row._source || '用户上传'),
        verificationLabel: '人工上传'
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
        sourceLabel: text(row._source || '用户上传'),
        verificationLabel: '人工上传'
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
        sourceLabel: recordSourceLabel(meta),
        verificationLabel: recordVerificationLabel(meta)
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
    return { q: '', type: 'all', market: '', platform: '', time: 'all', from: '', to: '', sort: 'relevance', page: 1 };
  }

  function sanitizeState(input) {
    var state = Object.assign(defaultState(), input || {});
    if (!TYPE_META[state.type]) state.type = 'all';
    if (['all', '7d', '30d', '1y', 'custom'].indexOf(state.time) < 0) state.time = 'all';
    if (['relevance', 'newest', 'oldest', 'title'].indexOf(state.sort) < 0) state.sort = 'relevance';
    state.market = text(state.market).toUpperCase();
    state.platform = platformKey(state.platform);
    state.from = /^\d{4}-\d{2}-\d{2}$/.test(text(state.from)) ? text(state.from) : '';
    state.to = /^\d{4}-\d{2}-\d{2}$/.test(text(state.to)) ? text(state.to) : '';
    state.page = Math.max(1, parseInt(state.page, 10) || 1);
    state.q = text(state.q).slice(0, 200);
    return state;
  }

  function stateFromHash() {
    var raw = global.location.hash.replace(/^#/, '');
    if (raw.split('?')[0] !== 'search') return null;
    var params = new URLSearchParams(raw.indexOf('?') >= 0 ? raw.slice(raw.indexOf('?') + 1) : '');
    var input = {};
    ['q', 'type', 'market', 'platform', 'time', 'from', 'to', 'sort', 'page'].forEach(function (key) {
      if (params.has(key)) input[key] = params.get(key);
    });
    return sanitizeState(input);
  }

  function stateHash(state) {
    var params = new URLSearchParams();
    ['q', 'type', 'market', 'platform', 'time', 'from', 'to', 'sort'].forEach(function (key) {
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

  function option(select, value, label) {
    var node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    select.appendChild(node);
  }

  function renderFilterOptions() {
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
    return unique(parts).join(' · ');
  }

  function renderResults(result) {
    var container = document.getElementById('unified-search-results');
    var total = document.getElementById('unified-search-total');
    var description = document.getElementById('unified-search-description');
    if (!container || !total || !description) return;
    var totalItems = result.items.length;
    var pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (searchState.page > pageCount) searchState.page = pageCount;
    var start = (searchState.page - 1) * PAGE_SIZE;
    var pageItems = result.items.slice(start, start + PAGE_SIZE);
    total.textContent = totalItems + ' 条结果';
    description.textContent = searchState.q ? '关键词“' + searchState.q + '”的当前筛选结果' : '显示当前可检索的真实记录与配置项';
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
      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'unified-search-open';
      open.dataset.recordId = record.id;
      open.setAttribute('aria-label', '打开' + record.title);
      open.title = '打开结果';
      open.textContent = '查看';
      article.append(type, body, open);
      container.appendChild(article);
    });

    renderPagination(totalItems, pageCount);
  }

  function renderPagination(totalItems, pageCount) {
    var container = document.getElementById('unified-search-pagination');
    if (!container) return;
    container.replaceChildren();
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

  function renderPage(options) {
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
    if (scope) scope.textContent = searchState.market ? marketName(searchState.market) : '全部已配置市场';
    var result = runSearch(searchState);
    renderTypeTabs(result.counts);
    renderResults(result);
    persistState();
    if (global.lucide && global.lucide.createIcons) global.lucide.createIcons();
  }

  function commitState(patch, mode) {
    searchState = sanitizeState(Object.assign({}, searchState, patch || {}));
    writeState(mode || 'replace');
    renderPage({ fromHash: false });
  }

  function findRecord(id) {
    return searchRecords.find(function (record) { return record.id === id; }) || null;
  }

  function activateRecord(record) {
    if (!record) return;
    persistState();
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
    var time = document.getElementById('unified-search-time');
    var sort = document.getElementById('unified-search-sort');
    var from = document.getElementById('unified-search-from');
    var to = document.getElementById('unified-search-to');
    var reset = document.getElementById('unified-search-reset');
    var types = document.getElementById('unified-search-types');
    var results = document.getElementById('unified-search-results');
    var pagination = document.getElementById('unified-search-pagination');
    if (form) form.addEventListener('submit', function (event) { event.preventDefault(); commitState({ q: input.value, page: 1 }, 'push'); });
    if (market) market.addEventListener('change', function () { commitState({ market: market.value, platform: '', page: 1 }, 'replace'); });
    if (platform) platform.addEventListener('change', function () { commitState({ platform: platform.value, page: 1 }, 'replace'); });
    if (time) time.addEventListener('change', function () { commitState({ time: time.value, page: 1 }, 'replace'); });
    if (sort) sort.addEventListener('change', function () { commitState({ sort: sort.value, page: 1 }, 'replace'); });
    if (from) from.addEventListener('change', function () { commitState({ from: from.value, page: 1 }, 'replace'); });
    if (to) to.addEventListener('change', function () { commitState({ to: to.value, page: 1 }, 'replace'); });
    if (reset) reset.addEventListener('click', function () { searchState = defaultState(); writeState('replace'); renderPage({ fromHash: false }); });
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
    input.oninput = function () { renderQuickResults(input.value); };
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
    global.JAY_RAG_CORPUS = null;
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
