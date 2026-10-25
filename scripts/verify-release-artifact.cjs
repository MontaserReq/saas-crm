'use strict';

const fs = require('node:fs');
const path = require('node:path');

const artifactRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.statSync(artifactRoot, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('Usage: node scripts/verify-release-artifact.cjs <standalone-artifact-directory>');
  process.exit(2);
}

// Keep this list exact and empty unless a reviewed release requirement proves
// that a specifically named file is safe and necessary.
const reviewedSafeAllowlist = new Set([]);
const prohibitedNames = [
  { reason: 'environment file', test: (name) => /^\.env(?:\.|$)/i.test(name) },
  { reason: 'package-manager credentials', test: (name) => /^(?:\.npmrc|\.yarnrc|\.pypirc|\.netrc)$/i.test(name) },
  { reason: 'private key or key store', test: (name) => /(?:^id_(?:rsa|dsa|ecdsa|ed25519)$|\.(?:pem|key|p12|pfx|jks|keystore)$)/i.test(name) },
  { reason: 'credential or secret manifest', test: (name) => /^(?:credentials?|secrets?|service[-_]?account)(?:[._-].*)?\.(?:json|ya?ml|toml)$/i.test(name) },
];
const privateKeyMarker = /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/;
const findings = [];
let filesScanned = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(artifactRoot, absolute).split(path.sep).join('/');
    if (entry.isSymbolicLink()) {
      findings.push({ relative, reason: 'symbolic link in release artifact' });
      continue;
    }
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    filesScanned += 1;
    if (reviewedSafeAllowlist.has(relative)) continue;
    for (const rule of prohibitedNames) {
      if (rule.test(entry.name)) findings.push({ relative, reason: rule.reason });
    }
    const size = fs.statSync(absolute).size;
    if (size <= 5 * 1024 * 1024) {
      const content = fs.readFileSync(absolute);
      if (privateKeyMarker.test(content.toString('utf8'))) findings.push({ relative, reason: 'embedded private key material' });
    }
  }
}

walk(artifactRoot);
if (findings.length) {
  console.error(`Release artifact verification failed: ${findings.length} prohibited item(s) found.`);
  for (const finding of findings) console.error(`- ${finding.relative}: ${finding.reason}`);
  process.exit(1);
}
console.log(`Release artifact verification passed: ${filesScanned} files scanned; no prohibited secret-bearing files found.`);
