(function (global) {
  'use strict';

  var PAGE_ASSETS = Object.freeze({
    overview: ['assets/js/alerts-settings.js'],
    products: ['assets/styles/workspaces.css', 'assets/js/products-shops.js'],
    shops: ['assets/styles/workspaces.css', 'assets/js/products-shops.js'],
    myfit: ['assets/styles/workspaces.css', 'assets/js/products-shops.js'],
    alerts: ['assets/js/alerts-settings.js'],
    platforms: ['assets/js/alerts-settings.js'],
    settings: ['assets/styles/workspaces.css', 'assets/js/alerts-settings.js'],
    data: ['assets/styles/workspaces.css', 'assets/js/alerts-settings.js'],
    admin: ['assets/styles/workspaces.css', 'assets/js/alerts-settings.js'],
    content: ['assets/js/resource-center.js'],
    tools: ['assets/styles/workspaces.css', 'assets/js/resource-center.js'],
    report: ['assets/styles/workspaces.css'],
    pricing: ['assets/styles/workspaces.css'],
    search: []
  });
  var loaded = Object.create(null);
  var loading = Object.create(null);
  var assetManifest = (global.JAY_APP_CONFIG && global.JAY_APP_CONFIG.assets) || {};

  function resolvedPath(logicalPath) {
    return assetManifest[logicalPath] || logicalPath;
  }

  function loadAsset(logicalPath) {
    if (loaded[logicalPath]) return Promise.resolve();
    if (loading[logicalPath]) return loading[logicalPath];
    loading[logicalPath] = new Promise(function (resolve, reject) {
      var element;
      if (/\.css$/i.test(logicalPath)) {
        element = document.createElement('link');
        element.rel = 'stylesheet';
        element.href = resolvedPath(logicalPath);
      } else {
        element = document.createElement('script');
        element.src = resolvedPath(logicalPath);
        element.async = false;
      }
      element.dataset.pageAsset = logicalPath;
      element.onload = function () {
        loaded[logicalPath] = true;
        delete loading[logicalPath];
        resolve();
      };
      element.onerror = function () {
        delete loading[logicalPath];
        reject(new Error('Unable to load page asset: ' + logicalPath));
      };
      document.head.appendChild(element);
    });
    return loading[logicalPath];
  }

  function ensurePageAssets(pageName) {
    var paths = PAGE_ASSETS[pageName] || [];
    return paths.reduce(function (promise, path) {
      return promise.then(function () { return loadAsset(path); });
    }, Promise.resolve());
  }

  var baseSwitchPage = global.switchPage;
  if (typeof baseSwitchPage === 'function') {
    global.switchPage = function (pageName, options) {
      var context = this;
      var args = arguments;
      var paths = PAGE_ASSETS[pageName] || [];
      if (paths.every(function (path) { return loaded[path]; })) {
        var immediateResult = baseSwitchPage.apply(context, args);
        global.dispatchEvent(new CustomEvent('jay:page-assets-ready', {
          detail: { page: pageName }
        }));
        return Promise.resolve(immediateResult);
      }
      return ensurePageAssets(pageName).then(function () {
        var result = baseSwitchPage.apply(context, args);
        global.dispatchEvent(new CustomEvent('jay:page-assets-ready', {
          detail: { page: pageName }
        }));
        return result;
      }).catch(function (error) {
        console.error('[JAY观海] Page asset loading failed:', error);
        if (typeof global.toast === 'function') global.toast('页面资源加载失败，请刷新后重试');
        throw error;
      });
    };
  }

  function loadActivePageAssets() {
    var activePage = document.querySelector('.page.active');
    var pageName = activePage ? activePage.id : 'overview';
    return ensurePageAssets(pageName).then(function () {
      global.dispatchEvent(new CustomEvent('jay:page-assets-ready', {
        detail: { page: pageName }
      }));
    }).catch(function (error) {
      console.error('[JAY观海] Initial page asset loading failed:', error);
    });
  }

  global.addEventListener('jay:auth-ready', loadActivePageAssets);
  document.addEventListener('DOMContentLoaded', function () {
    var app = document.getElementById('mainApp');
    if (app && app.classList.contains('active')) loadActivePageAssets();
  });

  global.jayEnsurePageAssets = ensurePageAssets;
  global.JAY_PAGE_ASSETS = PAGE_ASSETS;
})(window);
