// Extract every <script> block from index.html and run `node --check` on each
// to confirm there are no syntax errors after edits.
const fs = require('fs');
const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m, idx = 0, failures = 0;
while ((m = re.exec(html)) !== null) {
  const body = m[1];
  if (!body.trim()) continue;
  idx++;
  const tmp = path.join(os.tmpdir(), 'merc_script_' + idx + '.js');
  fs.writeFileSync(tmp, body, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('  [OK]   script block #' + idx + ' (' + body.length + ' chars)');
  } catch (e) {
    failures++;
    console.log('  [FAIL] script block #' + idx);
    console.log('         ' + (e.stderr ? e.stderr.toString().split('\n')[0] : e.message));
  }
  fs.unlinkSync(tmp);
}
console.log('\nScript blocks checked: ' + idx + '   failures: ' + failures);
process.exit(failures === 0 ? 0 : 1);
