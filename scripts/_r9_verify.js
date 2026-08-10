// Round 9 verification: service cards=4, 2col equal width, hero 60vh, no module regression
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');

// Extract script blocks
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

// Inject scripts manually
function runScript(code) {
  try { window.eval(code); } catch (e) { /* ignore init order noise */ }
}
scripts.forEach(runScript);

// Force re-render of overview + modules by calling known init funcs if present
['jayInitOverview', 'jayInitCountries', 'jayInitPlatforms', 'jayInitRules', 'jayInitPolicies', 'jayInitAlerts']
  .forEach(fn => { try { window[fn] && window[fn](); } catch (e) {} });

const report = {};

// 1. Service cards
const cards = [...document.querySelectorAll('.ov-service-card')];
report.service_card_count = cards.length;
report.service_card_titles = cards.map(c => {
  const t = c.querySelector('.ov-service-title');
  return t ? t.textContent.trim() : (c.textContent.trim().slice(0, 20));
});

// 2. ov-2col equal width
const twocol = document.querySelector('.ov-2col');
report.ov_2col_exists = !!twocol;
report.ov_2col_inline = twocol ? twocol.getAttribute('style') : null;
const cssMatch = html.match(/\.ov-2col\{display:grid;grid-template-columns:([^;]+);/);
report.ov_2col_css_cols = cssMatch ? cssMatch[1].trim() : 'NOT FOUND';

// 3. Hero min-height
const heroMatch = html.match(/\.ov-hero-ai\{min-height:([^;]+);/);
report.hero_min_height = heroMatch ? heroMatch[1].trim() : 'NOT FOUND';

// 4. Module regression — check rendered content lengths
function moduleLen(sel) {
  const el = document.querySelector(sel);
  return el ? el.textContent.trim().length : 0;
}
report.module_counts = {
  countries: document.querySelectorAll('#countries-page .country-item, #countries-page [class*="country"], #countries-page tbody tr').length,
  platforms: document.querySelectorAll('#platforms-page tbody tr, #platforms-page .platform-item').length,
  rules: document.querySelectorAll('#rules-page tbody tr, #rules-page .rule-item').length,
  policies: document.querySelectorAll('#policies-page tbody tr, #policies-page .policy-item').length,
  alerts: document.querySelectorAll('#alerts-page tbody tr, #alerts-page .alert-item').length
};
report.module_text_len = {
  countries: moduleLen('#countries-page'),
  platforms: moduleLen('#platforms-page'),
  rules: moduleLen('#rules-page'),
  policies: moduleLen('#policies-page'),
  alerts: moduleLen('#alerts-page')
};

console.log(JSON.stringify(report, null, 2));
