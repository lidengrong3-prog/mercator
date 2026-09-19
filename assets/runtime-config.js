(function (global) {
  'use strict';

  // The production build replaces this development-safe default with a
  // generated, environment-specific configuration asset.
  global.JAY_APP_CONFIG = Object.freeze({
    environment: 'development',
    supabase: Object.freeze({ url: '', anonKey: '' }),
    legal: Object.freeze({ privacyPolicy: '2026-08-26', termsOfService: '2026-08-26' }),
    assets: Object.freeze({}),
    breakpoints: Object.freeze({ phoneMax: 640, tabletMax: 1024 })
  });
})(window);
