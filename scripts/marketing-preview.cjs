// Isolated development output prevents visual QA from sharing the build cache.
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--port', process.env.MARKETING_PORT || '3001'], {
  stdio: 'inherit', env: { ...process.env, NEXT_DIST_DIR: '.next-marketing-qa' },
});
child.on('exit', code => { process.exitCode = code || 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
