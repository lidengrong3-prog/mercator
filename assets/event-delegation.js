(function () {
  'use strict';

  var ACTION_ATTRIBUTES = {
    click: 'data-action',
    change: 'data-change-action',
    input: 'data-input-action',
    submit: 'data-submit-action'
  };

  function splitStatements(source) {
    var result = [];
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
      } else if (char === '(' || char === '[') {
        depth += 1;
      } else if (char === ')' || char === ']') {
        depth -= 1;
      } else if (char === ';' && depth === 0) {
        result.push(source.slice(start, i));
        start = i + 1;
      }
    }
    result.push(source.slice(start));
    return result.map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function splitArguments(source) {
    var result = [];
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
      } else if (char === '(' || char === '[') {
        depth += 1;
      } else if (char === ')' || char === ']') {
        depth -= 1;
      } else if (char === ',' && depth === 0) {
        result.push(source.slice(start, i).trim());
        start = i + 1;
      }
    }
    if (source.trim()) result.push(source.slice(start).trim());
    return result;
  }

  function unquote(value) {
    var quote = value[0];
    var body = value.slice(1, -1);
    return body.replace(/\\([\\'"nrt])/g, function (_, escaped) {
      return ({ n: '\n', r: '\r', t: '\t' })[escaped] || escaped;
    }).replace(new RegExp('&#39;', 'g'), "'");
  }

  function readPath(root, path) {
    return path.split('.').reduce(function (value, key) {
      return value == null ? undefined : value[key];
    }, root);
  }

  function valueOf(source, element, event) {
    var value = source.trim();
    if (!value) return undefined;
    if ((value[0] === "'" && value[value.length - 1] === "'") ||
        (value[0] === '"' && value[value.length - 1] === '"')) return unquote(value);
    if (value === 'this') return element;
    if (value === 'event') return event;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
    var decode = value.match(/^decodeURIComponent\((.*)\)$/);
    if (decode) return decodeURIComponent(String(valueOf(decode[1], element, event) || ''));
    var pathMatch = value.match(/^(this|event(?:\.target|\.currentTarget)?)(?:\.[A-Za-z_$][\w$]*)+$/);
    if (pathMatch) {
      var root = pathMatch[1] === 'this' ? element : (pathMatch[1] === 'event.target' ? event.target : (pathMatch[1] === 'event.currentTarget' ? event.currentTarget : event));
      return readPath(root, value.slice(pathMatch[1].length + 1));
    }
    var global = value.match(/^([A-Za-z_$][\w$]*)$/);
    if (global) return window[global[1]];
    return undefined;
  }

  function invokeCall(source, element, event) {
    var match = source.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
    if (!match) return false;
    var fn = window[match[1]];
    if (typeof fn !== 'function') return false;
    fn.apply(window, splitArguments(match[2]).map(function (arg) {
      return valueOf(arg, element, event);
    }));
    return true;
  }

  function execute(source, element, event) {
    splitStatements(source).forEach(function (statement) {
      var conditional = statement.match(/^if\s*\(event\.target\s*===\s*this\)(.*)$/);
      if (conditional) {
        if (event.target === element) execute(conditional[1], element, event);
        return;
      }
      if (statement === 'event.stopPropagation()') {
        event.stopPropagation();
        return;
      }
      if (statement === 'event.preventDefault()') {
        event.preventDefault();
        return;
      }
      var closestRemove = statement.match(/^this\.closest\((['"])(.*?)\1\)\.remove\(\)$/);
      if (closestRemove) {
        var closest = element.closest(closestRemove[2]);
        if (closest) closest.remove();
        return;
      }
      if (statement === 'this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'') {
        var sibling = element.nextElementSibling;
        if (sibling) sibling.style.display = sibling.style.display === 'none' ? 'block' : 'none';
        return;
      }
      var assignment = statement.match(/^([A-Za-z_$][\w$]*)\s*=\s*(-?\d+)$/);
      if (assignment) {
        window[assignment[1]] = Number(assignment[2]);
        return;
      }
      invokeCall(statement, element, event);
    });
  }

  function handle(event) {
    var attribute = ACTION_ATTRIBUTES[event.type];
    if (!attribute) return;
    var element = event.target && event.target.closest ? event.target.closest('[' + attribute + ']') : null;
    if (!element) return;
    var source = element.getAttribute(attribute);
    if (!source) return;
    if (event.type === 'submit') event.preventDefault();
    execute(source, element, event);
  }

  document.addEventListener('click', handle);
  document.addEventListener('change', handle);
  document.addEventListener('input', handle);
  document.addEventListener('submit', handle);
})();
