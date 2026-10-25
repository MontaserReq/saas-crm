const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

function localDatabaseUrl() {
  const fromEnvironment = process.env.DATABASE_URL;
  if (fromEnvironment) return fromEnvironment;
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((entry) => entry.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is missing');
  return line.slice('DATABASE_URL='.length).trim().replace(/^(["'])(.*)\1$/, '$2');
}

async function main() {
  const source = new URL(localDatabaseUrl());
  if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
    throw new Error('Clean migration verification requires a loopback PostgreSQL server');
  }

  const databaseName = `codeline_prelaunch_test_${randomBytes(6).toString('hex')}`;
  if (!/^codeline_prelaunch_test_[0-9a-f]{12}$/.test(databaseName)) throw new Error('Unsafe temporary database name');
  const adminUrl = new URL(source);
  adminUrl.pathname = '/postgres';
  const temporaryUrl = new URL(source);
  temporaryUrl.pathname = `/${databaseName}`;
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  const prismaCli = require.resolve('prisma/build/index.js');
  const withTests = process.argv.includes('--with-tests');
  const testFile = process.argv.find((value) => value.startsWith('--test-file='))?.slice('--test-file='.length);
  const run = (command, args, env) => {
    const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${args.join(' ')} failed`);
  };

  console.log(`Creating isolated database ${databaseName}`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  try {
    for (const args of [['migrate', 'deploy'], ['migrate', 'status']]) {
      run(process.execPath, [prismaCli, ...args], { ...process.env, DATABASE_URL: temporaryUrl.toString() });
    }
    if (withTests) {
      const npmCli = process.env.npm_execpath;
      if (!npmCli) throw new Error('npm executable path is unavailable');
      const testEnvironment = {
        ...process.env,
        DATABASE_URL: temporaryUrl.toString(),
        NODE_ENV: 'test',
        AUTH_SECRET: 'local-disposable-test-secret-longer-than-thirty-two-characters',
        APP_ORIGIN: 'http://localhost:3000',
        APP_URL: 'http://localhost:3000',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        SEED_TARGET: 'disposable-local',
        SEED_DATABASE_LABEL: 'disposable',
        SEED_CONFIRM: 'ERASE_DISPOSABLE_DATABASE',
        SEED_DEFAULT_PASSWORD: `local-${randomBytes(16).toString('hex')}`,
        RUN_AUTH_MEMBERSHIP_DB: '1',
        RUN_SMART_IMPORT_DB: '1',
        RUN_PLAN_UPGRADES_DB: '1',
        RUN_SMART_SETUP_DB: '1',
        RUN_TICKET_MUTATION_DB: '1',
        RUN_WORKFLOW_DB: '1',
        CONFIRM_DISPOSABLE_WORKFLOW_DB: '1',
        RUN_PLATFORM_ADMIN_BOUNDARY_DB: '1',
        RUN_RATE_LIMITER_DB: '1',
        RUN_TENANT_CRUD_DB: '1',
        RUN_RESOURCE_GUARD_DB: '1',
      };
      run(process.execPath, [npmCli, 'run', 'db:seed'], testEnvironment);
      run(process.execPath, [npmCli, 'test', '--', ...(testFile ? [testFile] : []), '--maxWorkers=1', '--no-file-parallelism'], testEnvironment);
    }
  } finally {
    if (!/^codeline_prelaunch_test_[0-9a-f]{12}$/.test(databaseName)) throw new Error('Refusing unsafe database cleanup');
    await admin.$executeRawUnsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`);
    await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    await admin.$disconnect();
    console.log(`Dropped isolated database ${databaseName}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Clean migration verification failed');
  process.exitCode = 1;
});
