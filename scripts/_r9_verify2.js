// Round 9 module regression: switchPage each module, then measure rendered content
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    window.Supabase = undefined;
  }
});
const { window } = dom;
const { document } = window;
scripts.forEach(code => { try { window.eval(code); } catch (e) {} });

async function main() {
  const mods = ['countries', 'platforms', 'rules', 'policies', 'alerts'];
  const result = {};
  for (const m of mods) {
    try { window.switchPage(m); } catch (e) {}
    // allow async render to flush
    await new Promise(r => setTimeout(r, 30));
    const el = document.querySelector('#' + m + '-page');
    result[m] = el ? el.textContent.trim().length : 0;
  }
  console.log('MODULE_TEXT_LEN=' + JSON.stringify(result));
  const ok = Object.values(result).every(v => v > 1000);
  console.log('REGRESSION_CLEAN=' + ok);
}
main().then(() => process.exit(0));
