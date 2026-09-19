(function (global) {
  'use strict';

  var configured = (global.JAY_APP_CONFIG && global.JAY_APP_CONFIG.breakpoints) || {};
  var breakpoints = Object.freeze({
    phoneMax: Number(configured.phoneMax) || 640,
    tabletMax: Number(configured.tabletMax) || 1024
  });

  function viewportMode(width) {
    if (width <= breakpoints.phoneMax) return 'phone';
    if (width <= breakpoints.tabletMax) return 'tablet';
    return 'desktop';
  }

  function syncViewportMode() {
    document.documentElement.dataset.viewport = viewportMode(global.innerWidth);
  }

  global.JAY_BREAKPOINTS = breakpoints;
  global.jayViewportMode = viewportMode;
  syncViewportMode();
  global.addEventListener('resize', syncViewportMode, { passive: true });
})(window);
