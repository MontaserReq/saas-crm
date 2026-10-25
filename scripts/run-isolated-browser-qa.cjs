const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

function localDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find(entry => entry.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is missing');
  return line.slice('DATABASE_URL='.length).trim().replace(/^(["'])(.*)\1$/, '$2');
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${args.join(' ')} failed with exit code ${result.status}`);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited before becoming healthy (${child.exitCode})`);
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for the isolated application health endpoint');
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 10_000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

async function main() {
  const startedAt = Date.now();
  const source = new URL(localDatabaseUrl());
  if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
    throw new Error('Browser acceptance requires a loopback PostgreSQL server');
  }
  const databaseName = `codeline_browser_test_${randomBytes(6).toString('hex')}`;
  if (!/^codeline_browser_test_[0-9a-f]{12}$/.test(databaseName)) throw new Error('Unsafe temporary database name');
  const adminUrl = new URL(source);
  adminUrl.pathname = '/postgres';
  const temporaryUrl = new URL(source);
  temporaryUrl.pathname = `/${databaseName}`;
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  const prismaCli = require.resolve('prisma/build/index.js');
  const playwrightCli = require.resolve('@playwright/test/cli');
  const nextCli = require.resolve('next/dist/bin/next');
  const output = await mkdtemp(path.join(tmpdir(), 'codeline-browser-qa-'));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const distDirectory = '.next-e2e';
  const environment = {
    ...process.env,
    DATABASE_URL: temporaryUrl.toString(),
    // Next.js treats non-standard NODE_ENV values as a production-like mode in
    // parts of the runtime. Development keeps loopback HTTP session cookies
    // intentionally non-Secure while the disposable browser server is local.
    NODE_ENV: 'development',
    AUTH_SECRET: `browser-only-${randomBytes(32).toString('hex')}`,
    APP_ORIGIN: origin,
    APP_URL: origin,
    NEXT_PUBLIC_APP_URL: origin,
    NEXT_DIST_DIR: distDirectory,
    SEED_TARGET: 'disposable-local',
    SEED_DATABASE_LABEL: 'disposable',
    SEED_CONFIRM: 'ERASE_DISPOSABLE_DATABASE',
    SEED_DEFAULT_PASSWORD: `browser-only-${randomBytes(16).toString('hex')}`,
    PLAYWRIGHT_BASE_URL: origin,
    MARKETING_QA_URL: origin,
    MARKETING_QA_OUTPUT: output,
  };
  let app;
  console.log(`Creating isolated browser database ${databaseName}`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  try {
    run(process.execPath, [prismaCli, 'migrate', 'deploy'], environment);
    run(process.execPath, [prismaCli, 'migrate', 'status'], environment);
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error('npm executable path is unavailable; run this script through npm');
    run(process.execPath, [npmCli, 'run', 'db:seed'], environment);
    app = spawn(process.execPath, [nextCli, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: process.cwd(), env: environment, stdio: 'inherit',
    });
    await waitForHealth(origin, app);
    const playwrightArguments = process.argv.slice(2);
    run(process.execPath, [playwrightCli, 'test', ...playwrightArguments], environment);
    if (!playwrightArguments.length) run(process.execPath, [path.join(process.cwd(), 'scripts', 'marketing-qa.cjs')], environment);
    console.log(JSON.stringify({
      result: 'passed',
      database: databaseName,
      browserSuite: 'Playwright Chromium + axe-core',
      marketingMatrix: playwrightArguments.length ? 0 : 12,
      artifacts: output,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    }, null, 2));
  } finally {
    await stopChild(app);
    if (!/^codeline_browser_test_[0-9a-f]{12}$/.test(databaseName)) throw new Error('Refusing unsafe database cleanup');
    await admin.$executeRawUnsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`);
    await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    await admin.$disconnect();
    if (distDirectory === '.next-e2e') {
      await rm(path.join(process.cwd(), distDirectory), { recursive: true, force: true });
    }
    console.log(`Dropped isolated browser database ${databaseName}`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
