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
    const oe = w.onerror;
    w.addEventListener('error', e => { errors.push('win-error: ' + (e.error ? e.error.message : e.message)); });
  }
});
const w = dom.window;

function done() {
  console.error = origErr;
  const has = n => typeof w[n] === 'function';
  const checks = {
    'switchPage': has('switchPage'),
    'jayToggleBell': has('jayToggleBell'),
    'jayOpenOnboard': has('jayOpenOnboard'),
    'jayOpenFAQ': has('jayOpenFAQ'),
    'jayFmtCount': has('jayFmtCount'),
    'rpGenerateReport': has('rpGenerateReport'),
    'jayTraceLink': has('jayTraceLink'),
    'jayEnsureRefreshOn': has('jayEnsureRefreshOn'),
  };
  // pfExtData new keys (must be global; pfExtData is declared with let -> accessible via w.eval)
  let pfNew = 0;
  try { pfNew = w.eval("Object.keys(pfExtData).length"); } catch(e){ pfNew = 'ERR:'+e.message; }
  // Toplux signal
  let topluxSignal = 'NA';
  try { topluxSignal = w.eval("var t=products.find(function(p){return p[1]&&p[1].indexOf('Toplux')>=0;}); t?t[10]:'none';"); } catch(e){ topluxSignal='ERR'; }

  console.log('FUNCS:', JSON.stringify(checks, null, 0));
  console.log('pfExtData keys:', pfNew);
  console.log('Toplux signal:', topluxSignal);
  console.log('jayFmtCount(580000):', w.eval('jayFmtCount(580000)'));
  console.log('jayFmtCount(3660000):', w.eval('jayFmtCount(3660000)'));
  // bell panel element present
  console.log('bell-panel el:', !!w.document.getElementById('bell-panel'));
  console.log('onboard el:', !!w.document.getElementById('jay-onboard'));
  console.log('faq el:', !!w.document.getElementById('jay-faq'));
  // Count relevant errors (ignore scrollTo)
  const real = errors.filter(e => !/scrollTo|Not implemented/i.test(e));
  console.log('REAL ERRORS:', real.length);
  real.slice(0,15).forEach(e => console.log('  ERR:', e.slice(0,160)));
  process.exit(0);
}

setTimeout(done, 4000);
setTimeout(() => { console.log('TIMEOUT fallback'); done(); }, 12000);
