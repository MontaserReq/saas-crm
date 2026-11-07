const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR || '.next';
const serverPath = path.join(root, distDir, 'standalone', 'server.js');
const standaloneRoot = path.join(root, distDir, 'standalone');
const standaloneDistDir = path.join(standaloneRoot, distDir);
const builtStaticDir = path.join(root, distDir, 'static');
const expectedStaticDir = path.join(standaloneDistDir, 'static');

if (!fs.existsSync(serverPath)) {
  console.error(`Standalone server not found at ${serverPath}. Run "npm run build" first.`);
  process.exit(1);
}

// Next's standalone copier places static assets under standalone/.next even
// when a custom distDir is configured. The generated server, however, reads
// the configured distDir relative to its own directory. Mirror the assets so
// production CSS/JS and images are served when NEXT_DIST_DIR is customized.
if (distDir !== '.next' && fs.existsSync(builtStaticDir)) {
  fs.cpSync(builtStaticDir, expectedStaticDir, { recursive: true, force: true });
}

const child = spawn(process.execPath, [serverPath, ...process.argv.slice(2)], { cwd: root, env: process.env, stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
