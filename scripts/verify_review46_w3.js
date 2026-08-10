const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const origErr = console.error;
console.error = (...a) => { errors.push(a.join(' ')); };

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  beforeParse(w) {
    w.scrollTo = () => {};
    w.alert = () => {};
    w.addEventListener('error', e => { errors.push('win-error: ' + (e.error ? e.error.message : e.message)); });
  }
});
const w = dom.window;

function done() {
  console.error = origErr;
  const has = n => typeof w[n] === 'function';

  // ---- Wave2 function presence ----
  const w2 = {
    'jayToggleBell': has('jayToggleBell'),
    'jayOpenOnboard': has('jayOpenOnboard'),
    'jayOpenFAQ': has('jayOpenFAQ'),
    'jayFmtCount': has('jayFmtCount'),
    'rpGenerateReport': has('rpGenerateReport'),
    'jayTraceLink': has('jayTraceLink'),
    'jayEnsureRefreshOn': has('jayEnsureRefreshOn'),
  };
  // ---- Wave3 function presence ----
  const w3 = {
    'pfLogoColor': has('pfLogoColor'),
    'wlBatchExport': has('wlBatchExport'),
    'wlBatchAdd': has('wlBatchAdd'),
    'wlBatchAlert': has('wlBatchAlert'),
    'jayPersonalizeSettings': has('jayPersonalizeSettings'),
  };
  console.log('WAVE2 FUNCS:', JSON.stringify(w2));
  console.log('WAVE3 FUNCS:', JSON.stringify(w3));

  // ---- S-11 coverage at runtime ----
  let cov = 'ERR';
  try {
    cov = w.eval(`(function(){var miss=platformsData.filter(function(p){return !pfExtData[p[0]];});return platformsData.length+'/'+platformsData.length+' missing='+miss.length+(miss.length?' ['+miss.map(function(m){return m[0];}).join(', ')+']':'');})()`);
  } catch(e){ cov = 'ERR:'+e.message; }
  console.log('S-11 COVERAGE:', cov);

  // ---- Toplux signal normalization ----
  let toplux = 'NA';
  try { toplux = w.eval("var t=products.find(function(p){return p[1]&&p[1].indexOf('Toplux')>=0;}); t?t[10]:'none';"); } catch(e){ toplux='ERR'; }
  console.log('Toplux signal:', toplux, '(expect 下降)');

  // ---- jayFmtCount ----
  console.log('jayFmtCount(580000):', w.eval('jayFmtCount(580000)'));
  console.log('jayFmtCount(3660000):', w.eval('jayFmtCount(3660000)'));

  // ---- Wave2 DOM elements ----
  console.log('bell-panel el:', !!w.document.getElementById('bell-panel'));
  console.log('onboard el:', !!w.document.getElementById('jay-onboard'));
  console.log('faq el:', !!w.document.getElementById('jay-faq'));
  console.log('st-fav-count el:', !!w.document.getElementById('st-fav-count'));

  // ---- Wave3 DOM: sidebar icons emoji, platform logo container class ----
  const sidebarHtml = (w.document.querySelector('.sidebar') || {innerHTML:''}).innerHTML || '';
  console.log('sidebar uses emoji icons:', /🏠|⭐|🌍|🛒|📊|🏬|🎬|📋|🔔|📝/.test(sidebarHtml));
  console.log('platform card logo class present:', /pf-logo/.test(html));

  // ---- ⌘K keydown handler attached (check global search exists) ----
  console.log('global-search input:', !!w.document.getElementById('global-search'));

  // ---- pfExtData total keys ----
  let pfk = 'ERR';
  try { pfk = w.eval('Object.keys(pfExtData).length'); } catch(e){ pfk='ERR:'+e.message; }
  console.log('pfExtData keys total:', pfk);

  const real = errors.filter(e => !/scrollTo|Not implemented|Could not load|css/i.test(e));
  console.log('REAL ERRORS:', real.length);
  real.slice(0,20).forEach(e => console.log('  ERR:', e.slice(0,200)));
  process.exit(0);
}

setTimeout(done, 5000);
setTimeout(() => { console.log('TIMEOUT fallback'); done(); }, 15000);
