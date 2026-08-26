// Validate every local browser script referenced by index.html, plus inline code.
const fs = require('fs');
const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0, failures = 0;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1];
  const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
  if (srcMatch && /^(?:https?:)?\/\//i.test(srcMatch[1])) continue;
  const sourcePath = srcMatch ? srcMatch[1].split(/[?#]/)[0] : null;
  const body = sourcePath ? fs.readFileSync(sourcePath, 'utf8') : m[2];
  if (!body.trim()) continue;
  idx++;
  const tmp = path.join(os.tmpdir(), 'merc_script_' + idx + '.js');
  fs.writeFileSync(tmp, body, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('  [OK]   ' + (sourcePath || ('inline script #' + idx)) + ' (' + body.length + ' chars)');
  } catch (e) {
    failures++;
    console.log('  [FAIL] ' + (sourcePath || ('inline script #' + idx)));
    console.log('         ' + (e.stderr ? e.stderr.toString().split('\n')[0] : e.message));
  }
  fs.unlinkSync(tmp);
}
console.log('\nLocal scripts checked: ' + idx + '   failures: ' + failures);
process.exit(failures === 0 ? 0 : 1);
