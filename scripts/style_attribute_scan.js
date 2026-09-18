// Fail closed when an HTML style attribute is present in the shell or a
// dynamic HTML template. CSSOM assignments remain covered by the CSP and the
// strict style adapter's property/value allowlist.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  path.join(root, 'index.html'),
  ...fs.readdirSync(path.join(root, 'assets', 'js'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(root, 'assets', 'js', name)),
];
const pattern = /(^|[^A-Za-z0-9_.-])style\s*=/g;
const findings = [];
let migrated = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  migrated += (source.match(/data-ui-style\s*=/g) || []).length;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const line = source.slice(0, match.index).split('\n').length;
    findings.push(`${path.relative(root, file)}:${line}`);
  }
}

console.log(`Scanned ${files.length} frontend sources; inline style attributes: ${findings.length}; migrated UI styles: ${migrated}.`);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
