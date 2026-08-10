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
dom.window.addEventListener('error', (e) => {
  errors.push({ type: 'error', message: e.message });
  console.log('ERROR:', e.message);
});
dom.window.console.error = (...args) => {
  errors.push({ type: 'console.error', message: args.join(' ') });
  console.log('CONSOLE.ERROR:', args.join(' '));
};

setTimeout(() => {
  const win = dom.window;
  const doc = win.document;
  console.log('\n=== BEFORE switchPage ===');
  
  function checkPage(name) {
    console.log('\n--- ' + name + ' ---');
    const selectors = {
      'countries': ['#cn2-main', '#cn2-aside', '#cn2-quick-tags', '#cn2-ai-oneliner'],
      'alerts': ['#al-list', '#al-summary', '#al-tabs'],
      'platforms': ['#pf-grid', '#pf-stats-row'],
      'rules': ['#rl-rules-list', '#rl-activities-list'],
      'policies': ['#pl-list', '#pl-stats-row']
    };
    (selectors[name] || []).forEach(id => {
      const el = doc.querySelector(id);
      console.log(id, el ? ('len=' + el.innerHTML.length + ' text=' + el.textContent.slice(0,60).replace(/\s+/g,' ')) : 'MISSING');
    });
  }
  
  checkPage('countries');
  checkPage('alerts');
  checkPage('platforms');
  checkPage('rules');
  checkPage('policies');
  
  console.log('\n=== SWITCH to countries ===');
  try {
    win.switchPage('countries');
  } catch(e) { console.log('switchPage countries error:', e.message); }
  checkPage('countries');
  
  console.log('\n=== SWITCH to alerts ===');
  try {
    win.switchPage('alerts');
  } catch(e) { console.log('switchPage alerts error:', e.message); }
  checkPage('alerts');
  
  console.log('\n=== ERRORS ===');
  console.log(JSON.stringify(errors, null, 2));
  process.exit(0);
}, 5000);
