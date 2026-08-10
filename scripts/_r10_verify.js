const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
const dom = new JSDOM(html, {
  url: 'https://5cd8f877342041f5b6940719bc34ccf4.app.codebuddy.work/',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true
});

const errors = [];
dom.window.addEventListener('error', (e) => { errors.push(e.message); });
dom.window.console.error = (...a) => { errors.push(a.join(' ')); };

setTimeout(() => {
  const doc = dom.window.document;
  const win = dom.window;
  const r = {};

  const wrap = doc.querySelector('.ov-hero-input-wrap');
  const result = doc.querySelector('#ov-hero-result');
  const title = doc.querySelector('.ov-hero-title');

  r.result_inside_wrap = !!(result && wrap && wrap.contains(result) && result.parentElement === wrap);
  r.result_has_sibling_input_box = !!(result && result.previousElementSibling && result.previousElementSibling.classList.contains('ov-hero-input-box'));
  r.no_duplicate_result = doc.querySelectorAll('#ov-hero-result').length === 1;

  // computed style checks
  const cs = result ? win.getComputedStyle(result) : {};
  r.result_max_height = cs.maxHeight;
  r.result_overflow_y = cs.overflowY;

  // JS function exists
  r.sync_fn_exists = typeof win.syncHeroInputWidth === 'function';

  // width sync should have run
  r.input_wrap_width_px = wrap ? wrap.style.width : null;
  r.title_offset_width = title ? title.offsetWidth : null;

  console.log(JSON.stringify(r, null, 2));
  console.log('ERRORS=' + errors.length);
  if (errors.length) console.log(errors.slice(0, 3).join('\n'));
  process.exit(0);
}, 3000);
