const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf-8');
const dom = new JSDOM(html, {
  url: 'https://5cd8f877342041f5b6940719bc34ccf4.app.codebuddy.work/',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true
});

const errors = [];
dom.window.addEventListener('error', (e) => { errors.push(e.message); });
dom.window.console.error = (...a) => { errors.push(a.join(' ')); };

function measureModule(win, doc, name) {
  const sel = {
    countries: ['#cn2-main', '#cn2-aside', '#cn2-quick-tags', '#cn2-ai-oneliner'],
    alerts: ['#al-list', '#al-summary', '#al-tabs'],
    platforms: ['#pf-grid', '#pf-stats-row'],
    rules: ['#rl-rules-list', '#rl-activities-list'],
    policies: ['#pl-list', '#pl-stats-row']
  };
  let total = 0;
  (sel[name] || []).forEach(id => {
    const el = doc.querySelector(id);
    if (el) total += el.innerHTML.length;
  });
  return total;
}

setTimeout(() => {
  const win = dom.window, doc = win.document;
  const result = {};
  const mods = ['countries', 'platforms', 'rules', 'policies', 'alerts'];
  mods.forEach(m => {
    try { win.switchPage(m); } catch (e) {}
    // measure after switch
    result[m] = measureModule(win, doc, m);
  });
  console.log('MODULE_RENDER_LEN=' + JSON.stringify(result, null, 2));
  console.log('ERRORS=' + errors.length);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  const clean = Object.values(result).every(v => v > 2000);
  console.log('REGRESSION_CLEAN=' + clean);
  process.exit(0);
}, 6000);
