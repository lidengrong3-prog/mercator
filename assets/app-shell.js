(function () {
  'use strict';

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
    }
  }

  function focusGlobalSearch(event) {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    var target = event.target;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    var search = document.getElementById('global-search');
    if (!search) return;
    event.preventDefault();
    search.focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderIcons();
    document.addEventListener('keydown', focusGlobalSearch);

    document.querySelectorAll('.sidebar [data-page]').forEach(function (item) {
      item.addEventListener('click', function () {
        if (window.innerWidth <= 900 && typeof window.closeSidebar === 'function') {
          window.closeSidebar();
        }
      });
    });
  });

  window.addEventListener('pageshow', renderIcons);
})();
