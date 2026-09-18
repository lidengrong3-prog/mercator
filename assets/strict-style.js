(function () {
  'use strict';

  var ATTRIBUTE = 'data-ui-style';
  var ALLOWED_PROPERTIES = new Set([
    '--ct-grad',
    'align-items', 'background', 'border', 'border-bottom', 'border-color',
    'border-radius', 'border-top', 'bottom', 'box-shadow', 'color', 'cursor',
    'display', 'flex', 'flex-direction', 'flex-wrap', 'float', 'font',
    'font-size', 'font-weight', 'gap', 'grid-column', 'grid-template-columns',
    'height', 'inset', 'justify-content', 'left', 'line-height', 'margin',
    'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'max-height',
    'max-width', 'min-height', 'min-width', 'opacity', 'overflow', 'padding',
    'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'position',
    'right', 'text-align', 'text-decoration', 'top', 'transform', 'transition',
    'vertical-align', 'white-space', 'width', 'z-index'
  ]);
  var UNSAFE_VALUE = /(?:url\s*\(|(?:-webkit-)?image-set\s*\(|expression\s*\(|javascript\s*:|@import|[{}<>]|\\0)/i;

  function splitDeclarations(source) {
    var declarations = [];
    var start = 0;
    var quote = '';
    var depth = 0;
    var escaped = false;
    for (var i = 0; i < source.length; i += 1) {
      var char = source[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\' && quote) {
        escaped = true;
        continue;
      }
      if (quote) {
        if (char === quote) quote = '';
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
      } else if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
        if (depth < 0) throw new Error('unbalanced style value');
      } else if (char === ';' && depth === 0) {
        declarations.push(source.slice(start, i));
        start = i + 1;
      }
    }
    if (quote || depth !== 0) throw new Error('unbalanced style value');
    declarations.push(source.slice(start));
    return declarations;
  }

  function colonIndex(declaration) {
    var quote = '';
    var depth = 0;
    for (var i = 0; i < declaration.length; i += 1) {
      var char = declaration[i];
      if (quote) {
        if (char === quote && declaration[i - 1] !== '\\') quote = '';
      } else if (char === "'" || char === '"') {
        quote = char;
      } else if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      } else if (char === ':' && depth === 0) {
        return i;
      }
    }
    return -1;
  }

  function parse(source) {
    if (typeof source !== 'string' || source.length > 4096 || UNSAFE_VALUE.test(source)) {
      throw new Error('unsafe style value');
    }
    return splitDeclarations(source).map(function (item) {
      var declaration = item.trim();
      if (!declaration) return null;
      var separator = colonIndex(declaration);
      if (separator < 1) throw new Error('invalid style declaration');
      var property = declaration.slice(0, separator).trim().toLowerCase();
      var value = declaration.slice(separator + 1).trim();
      if (!ALLOWED_PROPERTIES.has(property) || !value || UNSAFE_VALUE.test(value)) {
        throw new Error('style declaration is not allowed');
      }
      var important = /\s*!important\s*$/i.test(value);
      if (important) value = value.replace(/\s*!important\s*$/i, '').trim();
      return { property: property, value: value, priority: important ? 'important' : '' };
    }).filter(Boolean);
  }

  function apply(element) {
    if (!element || !element.hasAttribute || !element.hasAttribute(ATTRIBUTE)) return true;
    var source = element.getAttribute(ATTRIBUTE) || '';
    element.removeAttribute(ATTRIBUTE);
    try {
      parse(source).forEach(function (declaration) {
        element.style.setProperty(declaration.property, declaration.value, declaration.priority);
      });
      return true;
    } catch (error) {
      console.warn('[strict-style] Rejected UI style.', error.message);
      return false;
    }
  }

  function applyTree(root) {
    if (!root) return;
    if (root.nodeType === 1) apply(root);
    if (root.querySelectorAll) {
      Array.prototype.forEach.call(root.querySelectorAll('[' + ATTRIBUTE + ']'), apply);
    }
  }

  function start() {
    applyTree(document);
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'attributes') {
          apply(mutation.target);
          return;
        }
        Array.prototype.forEach.call(mutation.addedNodes, applyTree);
      });
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [ATTRIBUTE]
    });
  }

  window.JAY_STRICT_STYLE_API = { apply: apply, applyTree: applyTree, parse: parse };
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
