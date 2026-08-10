// Heuristic scan: find onclick="..." attributes that concatenate a dynamic
// variable WITHOUT passing it through escInline()/escapeHtml(). Catches any
// injection sink the manual review may have missed.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Match onclick="..." (handle escaped quotes inside by scanning for closing ").
const re = /onclick="((?:[^"\\]|\\.)*)"/g;
let m, flagged = 0, checked = 0;
while ((m = re.exec(html)) !== null) {
  const attr = m[1];
  if (attr.indexOf('+') === -1) continue; // static handler, skip
  checked++;
  // Tokens that look like dynamic data being concatenated.
  // We flag if a bare variable appears in a '+' concatenation and is not
  // wrapped by escInline(...)/escapeHtml(...).
  const risky = /(^|[\s(+\-])[a-zA-Z_$][\w$]*(\[\d*\]|\.[a-zA-Z_$][\w$]*|\([^)]*\))?\s*\+/;
  // Strip safe wrappers entirely; what remains before a '+' must be a raw value.
  const stripped = attr
    .replace(/escInline\([^)]*\)/g, '')
    .replace(/escapeHtml\([^)]*\)/g, '');
  // Numeric identifiers are injection-safe (a number cannot break the attribute).
  const numericSafe = /^(idx|i|globalIdx|r\.id|pfAiTab|plAiTab|ctActiveFolder|items\.length|cnt|cls)$/;
  if (risky.test(stripped)) {
    const m2 = stripped.match(risky);
    const tok = (m2 ? m2[0] : '').replace(/[\s(+\-]/g, '').replace(/\+$/, '');
    if (numericSafe.test(tok)) continue; // safe: numeric index
    flagged++;
    console.log('  [REVIEW] onclick concatenation with possible RAW STRING var: ' + tok);
    console.log('           ' + attr.slice(0, 140));
  }
}
console.log('\nScanned ' + checked + ' dynamic onclick handlers, ' +
  flagged + ' need manual review.');
process.exit(0);
