// Runtime checks for the input paths that are allowed to reach HTML output.
// Keep this script independent from a browser so it can run in CI and before
// the static site is assembled.

const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'assets', 'js', 'catalog.js');
const catalog = fs.readFileSync(catalogPath, 'utf8');

function extractSimpleFunction(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('Marker not found: ' + marker);
  const end = source.indexOf('\n}', start);
  if (end < 0) throw new Error('No closing brace for ' + marker);
  return source.slice(start, end + 2);
}

const securityStart = catalog.indexOf('function escapeHtml(s){');
const securityEnd = catalog.indexOf('// ============ 前端健壮性基础工具', securityStart);
if (securityStart < 0 || securityEnd < 0) throw new Error('Security helper block not found in catalog.js');
const securitySource = catalog.slice(securityStart, securityEnd);
const escInlineSource = extractSimpleFunction(catalog, 'function escInline(s){');

const factory = new Function('document', securitySource + '\n' + escInlineSource +
  '\nreturn { escapeHtml: escapeHtml, jaySafeHttpsUrl: jaySafeHttpsUrl, escInline: escInline };');
const { escapeHtml, jaySafeHttpsUrl, escInline } = factory({ baseURI: 'https://app.example.test/' });

let pass = 0;
let fail = 0;
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

console.log('=== HTML input encoding assertions ===');
check('search input is text-only',
  escapeHtml('<img src=x onerror=alert(1)>'),
  '&lt;img src=x onerror=alert(1)&gt;');
check('uploaded market/platform/category/shop fields are text-only',
  escapeHtml('"><script>alert(1)</script>'),
  '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
check('saved template name is text-only',
  escapeHtml("<svg onload='alert(1)'>"),
  '&lt;svg onload=&#39;alert(1)&#39;&gt;');
check('inline string remains escaped',
  /[<>]/.test(escInline("x');alert(1);//")),
  false);

console.log('=== HTTPS source URL assertions ===');
check('empty source URL rejected', jaySafeHttpsUrl(''), '');
check('javascript URL rejected', jaySafeHttpsUrl('javascript:alert(1)'), '');
check('data URL rejected', jaySafeHttpsUrl('data:text/html,<script>alert(1)</script>'), '');
check('HTTP URL rejected', jaySafeHttpsUrl('http://example.test/rule'), '');
check('protocol-relative URL rejected', jaySafeHttpsUrl('//example.test/rule'), '');
check('HTTPS URL accepted', jaySafeHttpsUrl('https://example.test/rule?id=1'), 'https://example.test/rule?id=1');
check('HTTPS URL attribute encoding',
  escapeHtml(jaySafeHttpsUrl('https://example.test/rule?a=1&b=2')),
  'https://example.test/rule?a=1&amp;b=2');

console.log('\n=== RESULT ===');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
