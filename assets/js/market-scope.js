(function initJayMarketScope(global) {
  'use strict';

  var country = Object.freeze({
    code: 'US',
    key: 'us',
    name: '美国',
    label: '美国市场',
  });
  var platforms = Object.freeze([
    Object.freeze({ key: 'amazon', name: 'Amazon' }),
    Object.freeze({ key: 'tiktok-shop', name: 'TikTok Shop' }),
    Object.freeze({ key: 'aliexpress', name: 'AliExpress' }),
    Object.freeze({ key: 'ebay', name: 'eBay' }),
  ]);
  var platformNames = Object.freeze(platforms.map(function (platform) {
    return platform.name;
  }));

  function normalizePlatform(value) {
    var raw = String(value || '').trim();
    var lower = raw.toLowerCase();
    if (!raw) return '';
    if (lower.indexOf('tiktok') >= 0 && lower.indexOf('shop') >= 0) return 'TikTok Shop';
    if (lower.indexOf('aliexpress') >= 0 || lower.indexOf('速卖通') >= 0) return 'AliExpress';
    if (lower.indexOf('ebay') >= 0) return 'eBay';
    if (lower === 'amazon' || lower.indexOf('amazon（美国') >= 0 || lower.indexOf('amazon (us') >= 0) return 'Amazon';
    return raw;
  }

  function isAllowedPlatform(value) {
    return platformNames.indexOf(normalizePlatform(value)) >= 0;
  }

  function filterPlatforms(items, getName) {
    var list = Array.isArray(items) ? items : [];
    var accessor = typeof getName === 'function' ? getName : function (item) {
      return item && (item.name || item.platform || item[0]);
    };
    var best = {};
    function score(item, canonical) {
      var raw = String(accessor(item) || '').trim();
      var lower = raw.toLowerCase();
      var region = String(item && (item.market || item.region || '')).toLowerCase();
      var value = 0;
      if (raw.toLowerCase() === canonical.toLowerCase()) value += 100;
      if (region.indexOf('美国') >= 0 || region.indexOf('us') >= 0 || region.indexOf('北美') >= 0) value += 40;
      if (lower.indexOf('美国') >= 0 || lower.indexOf('(us') >= 0 || lower.indexOf('（us') >= 0) value += 20;
      if (canonical === 'Amazon' && lower.indexOf('中东') >= 0) value -= 50;
      return value;
    }
    list.forEach(function (item) {
      var canonical = normalizePlatform(accessor(item));
      if (platformNames.indexOf(canonical) < 0) return;
      var candidate = { item: item, score: score(item, canonical) };
      if (!best[canonical] || candidate.score > best[canonical].score) best[canonical] = candidate;
    });
    return platformNames.map(function (name) { return best[name] && best[name].item; }).filter(Boolean);
  }

  function isUsPolicy(item) {
    return !!item && String(item.region || '').toUpperCase() === country.code;
  }

  function isUsAlert(item) {
    var itemCountry = Array.isArray(item) ? item[4] : item && (item.country || item.region || item.market);
    return itemCountry === country.name || String(itemCountry || '').toUpperCase() === country.code;
  }

  function isApplicableRule(item) {
    if (!item || !isAllowedPlatform(item.platform)) return false;
    var market = String(item.market || '').toUpperCase();
    return market === country.code || market === 'GLOBAL';
  }

  var scope = Object.freeze({
    country: country,
    countries: Object.freeze([country]),
    countryCount: 1,
    platforms: platforms,
    platformNames: platformNames,
    platformCount: platformNames.length,
    applicableRuleMarkets: Object.freeze(['US', 'Global']),
  });
  var api = Object.freeze({
    normalizePlatform: normalizePlatform,
    isAllowedPlatform: isAllowedPlatform,
    filterPlatforms: filterPlatforms,
    isUsPolicy: isUsPolicy,
    isUsAlert: isUsAlert,
    isApplicableRule: isApplicableRule,
  });

  global.JAY_MARKET_SCOPE = scope;
  global.JAY_MARKET_SCOPE_API = api;
  global.JAY_PLATFORM_COUNT = scope.platformCount;
})(window);
