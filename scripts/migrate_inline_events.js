#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  path.join(root, 'index.html'),
  ...fs.readdirSync(path.join(root, 'assets', 'js'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(root, 'assets', 'js', name)),
];

const replacements = [
  ['onclick', 'data-action'],
  ['onchange', 'data-change-action'],
  ['oninput', 'data-input-action'],
  ['onsubmit', 'data-submit-action'],
];

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = original;
  if (file.endsWith('.js')) {
    for (const [name, replacement] of replacements) {
      updated = updated.replace(new RegExp(`([^A-Za-z0-9_.])${name}\\s*=`, 'g'), `$1${replacement}=`);
    }
  } else {
    for (const [name, replacement] of replacements) updated = updated.replace(new RegExp(`\\b${name}\\s*=`, 'g'), `${replacement}=`);
  }
  if (updated !== original) fs.writeFileSync(file, updated, 'utf8');
}
