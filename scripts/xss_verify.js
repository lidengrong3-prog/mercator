// XSS runtime verification for Mercator index.html security helpers.
// Robustly extracts escapeHtml() and escInline() by line (the functions have
// no nested braces, so the first standalone '}' line after the signature is the
// close). Avoids fragile brace/string parsing that chokes on /"/g regex literals.

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');
const lines = html.split('\n');

function findLine(substr) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(substr) !== -1) return i;
  }
  throw new Error('Marker not found: ' + substr);
}

function extractByLine(startMarker) {
  const start = findLine(startMarker);
  // first standalone '}' line after the signature closes the (brace-free) body
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '}') { end = i; break; }
  }
  if (end === -1) throw new Error('No closing brace for ' + startMarker);
  return lines.slice(start, end + 1).join('\n');
}

const escapeHtmlSrc = extractByLine('function escapeHtml(s){');
const escInlineSrc = extractByLine('function escInline(s){');

// Sanity: extraction should be small (these are ~10-line helpers).
if (escapeHtmlSrc.length > 400 || escInlineSrc.length > 400) {
  throw new Error('Extraction suspiciously large: ' +
    escapeHtmlSrc.length + '/' + escInlineSrc.length);
}

const factory = new Function(
  escapeHtmlSrc + '\n' + escInlineSrc +
  '\nreturn { escapeHtml: escapeHtml, escInline: escInline };'
);
const { escapeHtml, escInline } = factory();

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) {
    pass++;
    console.log('  [OK]   ' + label);
  } else {
    fail++;
    console.log('  [FAIL] ' + label);
    console.log('         expected: ' + JSON.stringify(expected));
    console.log('         actual:   ' + JSON.stringify(actual));
  }
}

console.log('=== escapeHtml() assertions ===');
check('null -> empty', escapeHtml(null), '');
check('undefined -> empty', escapeHtml(undefined), '');
check('ampersand escaped', escapeHtml('a & b'), 'a &amp; b');
check('less-than escaped', escapeHtml('<script>'), '&lt;script&gt;');
check('greater-than escaped', escapeHtml('a > b'), 'a &gt; b');
check('double-quote escaped', escapeHtml('a"b'), 'a&quot;b');
check('single-quote escaped', escapeHtml("a'b"), 'a&#39;b');
check('script tag neutralized',
  escapeHtml('<script>alert(1)</script>'),
  '&lt;script&gt;alert(1)&lt;/script&gt;');
check('img onerror neutralized',
  escapeHtml('<img src=x onerror=alert(1)>'),
  '&lt;img src=x onerror=alert(1)&gt;');
check('attribute breakout neutralized',
  escapeHtml('"><svg onload=alert(1)>'),
  '&quot;&gt;&lt;svg onload=alert(1)&gt;');

console.log('=== escInline() assertions ===');
// escInline = JS-escape THEN HTML-escape, for safe use inside onclick="..."
check('inline null safe', escInline(null), '');
check('inline undefined safe', escInline(undefined), '');
check('inline script tag fully escaped',
  /[<>]/.test(escInline("<script>alert('x')</script>")), false);
check('inline handles single quote', escInline("O'Brien"), 'O\\&#39;Brien');
check('inline handles backslash', escInline('a\\b'), 'a\\\\b');
check('inline collapses newline', escInline('a\nb'), 'a b');
check('inline collapses tab', escInline('a\tb'), 'a b');

// Full onclick-attribute construction with a malicious policy title.
const evilTitle = 'Policy"></button><script>alert("pwned")</script><button title="';
const attr = 'openPolicy("' + escInline(evilTitle) + '")';
const safeHtml = '<a href="#" onclick="' + attr + '">open</a>';
check('onclick attr has no raw <script>', /<script>/i.test(safeHtml), false);
check('onclick attr escaped < present', safeHtml.indexOf('&lt;') !== -1, true);
check('onclick attr escaped " present', safeHtml.indexOf('&quot;') !== -1, true);

console.log('\n=== RESULT ===');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
