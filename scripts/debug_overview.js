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
const warns = [];
dom.window.addEventListener('error', (e) => {
  errors.push({ type: 'error', message: e.message });
  console.log('ERROR:', e.message);
});
dom.window.console.error = (...args) => {
  errors.push({ type: 'console.error', message: args.join(' ') });
  console.log('CONSOLE.ERROR:', args.join(' '));
};
dom.window.console.warn = (...args) => {
  warns.push(args.join(' '));
  console.log('CONSOLE.WARN:', args.join(' '));
};

setTimeout(() => {
  const doc = dom.window.document;
  console.log('\n=== OVERVIEW COUNTRY CHECK ===');
  const ids = ['#ov-country-filters', '#ov-tag-filters', '#ov-country-grid'];
  ids.forEach(id => {
    const el = doc.querySelector(id);
    console.log(id, el ? ('len=' + el.innerHTML.length + ' text=' + el.textContent.slice(0,80).replace(/\s+/g,' ')) : 'MISSING');
  });
  
  console.log('\n=== WARNINGS ===');
  warns.forEach(w => console.log(w));
  
  console.log('\n=== ERRORS ===');
  console.log(JSON.stringify(errors, null, 2));
  process.exit(0);
}, 5000);
