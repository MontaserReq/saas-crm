const fs = require('fs');
const path = require('path');

const code = fs.readFileSync('./src/lib/i18n/translations.ts', 'utf8');
const transpiled = code
  .replace(/export type [^;]+;/g, '')
  .replace(/export const translations = /g, 'module.exports = ')
  .replace(/export /g, '');

const m = { exports: {} };
const fn = new Function('module', 'exports', transpiled);
fn(m, m.exports);
const translations = m.exports;

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const k in obj) {
    const fullKey = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = new Set(getKeys(translations.en));
const arKeys = new Set(getKeys(translations.ar));

function getAllFiles(dir, exts) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(full, exts));
    } else if (exts.some(e => full.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = getAllFiles('./src', ['.tsx', '.ts']);
const usedKeys = new Set();
const keyUsage = {};

for (const file of allFiles) {
  if (file.includes('translations.ts')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g);
  for (const match of matches) {
    const key = match[1];
    usedKeys.add(key);
    if (!keyUsage[key]) keyUsage[key] = [];
    keyUsage[key].push(file);
  }
}

const missingFromEn = [];
const missingFromAr = [];

for (const key of usedKeys) {
  if (!enKeys.has(key)) missingFromEn.push({ key, files: keyUsage[key] });
  if (!arKeys.has(key)) missingFromAr.push({ key, files: keyUsage[key] });
}

console.log('=== MISSING FROM EN ===');
console.log(JSON.stringify(missingFromEn, null, 2));

console.log('=== MISSING FROM AR ===');
console.log(JSON.stringify(missingFromAr, null, 2));
