// Fail closed when an HTML event-handler attribute is present in the shell or
// in a dynamic HTML template. JavaScript property assignments such as
// element.onclick = fn are intentionally allowed; they do not use CSP inline
// event handlers and remain covered by the normal script source policy.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  path.join(root, 'index.html'),
  ...fs.readdirSync(path.join(root, 'assets', 'js'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(root, 'assets', 'js', name)),
];
const pattern = /(^|[^A-Za-z0-9_.])on(?:click|change|input|submit)\s*=/g;
const findings = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const line = source.slice(0, match.index).split('\n').length;
    findings.push(`${path.relative(root, file)}:${line}`);
  }
}

console.log(`Scanned ${files.length} frontend sources; inline event attributes: ${findings.length}.`);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
