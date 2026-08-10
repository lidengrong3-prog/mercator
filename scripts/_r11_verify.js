const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'https://5cd8f877342041f5b6940719bc34ccf4.app.codebuddy.work/',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true
});
const errors = [];
dom.window.addEventListener('error', e => errors.push(e.message));
dom.window.console.error = (...a) => errors.push(a.join(' '));

let printed = false;
function print(out) {
  if (printed) return; printed = true;
  console.log(out);
  console.log('ERRORS=' + errors.length);
  process.exit(0);
}
process.on('unhandledRejection', (e) => {
  // page's own async path may reject in jsdom (e.g. fetch); capture, don't crash
  errors.push('unhandledRejection: ' + (e && e.message ? e.message : e));
});

setTimeout(() => {
  const win = dom.window, doc = win.document;
  try {
    win.switchPage('overview');
    const input = doc.getElementById('ov-hero-input');
    const send = doc.getElementById('ov-hero-send');
    const resultEl = doc.getElementById('ov-hero-result');
    input.value = '水晶饰品 东南亚';
    send.dispatchEvent(new win.Event('click'));
  } catch (e) { errors.push('trigger: ' + e.message); }

  setTimeout(() => {
    let ai = {};
    try {
      const resultEl = doc.getElementById('ov-hero-result');
      ai.hasSteps = !!resultEl.querySelector('.ovr-steps');
      ai.stepsCount = resultEl.querySelectorAll('.ovr-step').length;
      ai.hasBar = !!resultEl.querySelector('.ovr-progress-bar');
      const act = resultEl.querySelector('.ovr-step.active');
      ai.activeStep = act ? act.getAttribute('data-step') : null;
    } catch (e) { ai.err = e.message; }

    try {
      win.switchPage('report');
    } catch (e) { errors.push('switchReport: ' + e.message); }

    setTimeout(() => {
      let rep = {};
      try {
        const dateEl = doc.getElementById('rp-hero-date');
        rep.date = dateEl ? dateEl.textContent : '(missing)';
        rep.hero = !!doc.querySelector('.rp-v2-header.rp-hero');
        const meta = doc.querySelector('.rp-hero-meta');
        rep.meta = meta ? meta.textContent.trim() : '(missing)';
      } catch (e) { rep.err = e.message; }
      print(
        'AI_STEPS_PRESENT=' + ai.hasSteps + '\n' +
        'AI_STEPS_COUNT=' + ai.stepsCount + '\n' +
        'AI_PROGRESS_BAR=' + ai.hasBar + '\n' +
        'AI_ACTIVE_STEP=' + ai.activeStep + '\n' +
        'REPORT_HERO_CLASS=' + rep.hero + '\n' +
        'REPORT_HERO_DATE=' + rep.date + '\n' +
        'REPORT_HERO_META=' + rep.meta + '\n' +
        (ai.err ? 'AI_ERR=' + ai.err + '\n' : '') +
        (rep.err ? 'REP_ERR=' + rep.err + '\n' : '')
      );
    }, 500);
  }, 250);
}, 6000);
