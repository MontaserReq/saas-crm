const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR || '.next';
const standaloneDir = path.join(root, distDir, 'standalone');

if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  console.log(`Standalone server not found under ${standaloneDir}; skipping asset copy.`);
  process.exit(0);
}

for (const directory of ['public', path.join(distDir, 'static')]) {
  const source = path.join(root, directory);
  if (!fs.existsSync(source)) continue;
  const target = path.join(standaloneDir, directory === 'public' ? 'public' : '.next', directory === 'public' ? '' : 'static');
  fs.cpSync(source, target, { recursive: true, force: true });
}

console.log(`Prepared standalone assets in ${standaloneDir}.`);
