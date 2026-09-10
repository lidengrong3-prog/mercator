// Runtime checks for the input paths that are allowed to reach HTML output.
// Keep this script independent from a browser so it can run in CI and before
// the static site is assembled.

const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'assets', 'js', 'catalog.js');
const catalog = fs.readFileSync(catalogPath, 'utf8');
const reportsPath = path.join(__dirname, '..', 'assets', 'js', 'reports-decisions.js');
const reports = fs.readFileSync(reportsPath, 'utf8');
const contentPath = path.join(__dirname, '..', 'assets', 'js', 'content-overview.js');
const content = fs.readFileSync(contentPath, 'utf8');
const productsPath = path.join(__dirname, '..', 'assets', 'js', 'products-shops.js');
const products = fs.readFileSync(productsPath, 'utf8');
const alertsPath = path.join(__dirname, '..', 'assets', 'js', 'alerts-settings.js');
const alerts = fs.readFileSync(alertsPath, 'utf8');
const enhancementsPath = path.join(__dirname, '..', 'assets', 'js', 'product-enhancements.js');
const enhancements = fs.readFileSync(enhancementsPath, 'utf8');

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
check('persisted watchlist values use textContent',
  /function wlTextElement[\s\S]*?node\.textContent=wlSafeText\(value\)/.test(reports),
  true);
check('watchlist cards replace DOM children safely',
  /function renderWatchCards[\s\S]*?grid\.replaceChildren\(fragment\)/.test(reports),
  true);
check('watchlist search replaces DOM children safely',
  /function doModalSearch[\s\S]*?results\.replaceChildren\(fragment\)/.test(reports),
  true);
check('stored names are not interpolated into card HTML',
  /class=["']wc-name["'][^\n]*\+d\.name/.test(reports),
  false);
check('stored search names are not interpolated into result HTML',
  /class=["']wl-search-result["'][^\n]*\+r\.name/.test(reports),
  false);
check('persisted report titles are encoded in local print documents',
  /var safeTitle=escapeHtml\(title\)[\s\S]*?<title>'\+safeTitle\+'<\/title>[\s\S]*?<h1>'\+safeTitle\+'<\/h1>/.test(reports),
  true);
check('persisted comparison names use DOM event listeners',
  /function cmpRenderSchemes[\s\S]*?data-scheme-name[\s\S]*?addEventListener\('click'/.test(reports),
  true);
check('persisted favorite item titles are encoded',
  /function ctRenderFavItems[\s\S]*?escapeHtml\(item\.title\)/.test(content),
  true);
check('content cards encode imported record fields',
  /function ctRenderCards[\s\S]*?escapeHtml\(c\[7\]\)[\s\S]*?escapeHtml\(c\[13\]\)/.test(content),
  true);
check('uploaded shop comparison options are encoded',
  /function opts\(o,all\)[^\n]*escapeHtml\(k\)/.test(products),
  true);
check('alert source links pass through HTTPS validation',
  /function renderAlList[\s\S]*?jaySafeHttpsUrl\(a\.sourceUrl\)/.test(alerts),
  true);
check('persisted refresh log fields are encoded',
  /function jayRenderRefreshLog[\s\S]*?escapeHtml\(e\.label\)[\s\S]*?escapeHtml\(e\.error\)/.test(alerts),
  true);
check('database notifications render as text nodes',
  /function jayRenderBell[\s\S]*?document\.createTextNode\(String\(it\.text\|\|''\)\)/.test(enhancements),
  true);
check('server export URLs pass through HTTPS validation',
  /jaySafeHttpsUrl\(result\.file_url\)/.test(reports),
  true);
check('billing redirects pass through HTTPS validation',
  /jaySafeHttpsUrl\(portal\.url\)[\s\S]*?jaySafeHttpsUrl\(result\.url\)/.test(reports),
  true);

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
