const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

function execute(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: options.env || process.env,
    encoding: options.capture ? 'utf8' : undefined,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout || ''}` : '';
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${detail}`);
  }
  return options.capture ? String(result.stdout).trim() : '';
}

async function waitForPostgres(container) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', 'codeline_backup_test_source'], { stdio: 'ignore' });
    if (result.status === 0) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Disposable PostgreSQL container did not become healthy');
}

async function counts(url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [migrations, users, organizations, roles, permissions, plans, subscriptions] = await Promise.all([
      prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "_prisma_migrations"'),
      prisma.user.count(),
      prisma.organization.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.platformPlan.count(),
      prisma.platformSubscription.count(),
    ]);
    await prisma.$queryRawUnsafe('SELECT 1 AS connectivity');
    return { migrations: Number(migrations[0].count), users, organizations, roles, permissions, plans, subscriptions };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const startedAt = Date.now();
  const token = randomBytes(6).toString('hex');
  const container = `codeline-backup-rehearsal-${token}`;
  if (!/^codeline-backup-rehearsal-[0-9a-f]{12}$/.test(container)) throw new Error('Unsafe rehearsal container name');
  const password = `backup-${randomBytes(18).toString('hex')}`;
  const prismaCli = require.resolve('prisma/build/index.js');
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('npm executable path is unavailable; run this script through npm');
  let created = false;
  try {
    execute('docker', [
      'run', '--detach', '--rm', '--name', container,
      '-e', `POSTGRES_PASSWORD=${password}`,
      '-e', 'POSTGRES_USER=postgres',
      '-e', 'POSTGRES_DB=codeline_backup_test_source',
      '-p', '127.0.0.1::5432',
      'postgres:16-alpine',
    ]);
    created = true;
    await waitForPostgres(container);
    const portOutput = execute('docker', ['port', container, '5432/tcp'], { capture: true });
    const port = portOutput.match(/:(\d+)\s*$/)?.[1];
    if (!port) throw new Error(`Unable to identify disposable PostgreSQL port: ${portOutput}`);
    const sourceUrl = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/codeline_backup_test_source`;
    const restoreUrl = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/codeline_backup_test_restore`;
    const environment = {
      ...process.env,
      DATABASE_URL: sourceUrl,
      NODE_ENV: 'test',
      SEED_TARGET: 'disposable-local',
      SEED_DATABASE_LABEL: 'disposable',
      SEED_CONFIRM: 'ERASE_DISPOSABLE_DATABASE',
      SEED_DEFAULT_PASSWORD: `backup-only-${randomBytes(16).toString('hex')}`,
    };
    execute(process.execPath, [prismaCli, 'migrate', 'deploy'], { env: environment });
    execute(process.execPath, [npmCli, 'run', 'db:seed'], { env: environment });
    const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
    try {
      await source.organization.create({ data: { name: 'Synthetic restore marker', slug: `backup-marker-${token}` } });
    } finally {
      await source.$disconnect();
    }
    const before = await counts(sourceUrl);

    execute('docker', ['exec', container, 'pg_dump', '-U', 'postgres', '-d', 'codeline_backup_test_source', '-Fc', '-f', '/tmp/codeline.dump']);
    const checksum = execute('docker', ['exec', container, 'sha256sum', '/tmp/codeline.dump'], { capture: true }).split(/\s+/)[0];
    const bytes = Number(execute('docker', ['exec', container, 'stat', '-c', '%s', '/tmp/codeline.dump'], { capture: true }));
    execute('docker', ['exec', container, 'createdb', '-U', 'postgres', 'codeline_backup_test_restore']);
    execute('docker', ['exec', container, 'pg_restore', '-U', 'postgres', '-d', 'codeline_backup_test_restore', '--exit-on-error', '/tmp/codeline.dump']);
    execute(process.execPath, [prismaCli, 'migrate', 'status'], { env: { ...environment, DATABASE_URL: restoreUrl } });
    const after = await counts(restoreUrl);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(`Restored counts differ: ${JSON.stringify({ before, after })}`);
    }
    console.log(JSON.stringify({
      result: 'passed',
      engine: 'PostgreSQL 16 Alpine',
      format: 'pg_dump custom',
      checksumSha256: checksum,
      backupBytes: bytes,
      sourceCounts: before,
      restoredCounts: after,
      migrationStatus: 'up to date',
      connectivity: 'verified',
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    }, null, 2));
  } finally {
    if (created) {
      if (!/^codeline-backup-rehearsal-[0-9a-f]{12}$/.test(container)) throw new Error('Refusing unsafe container cleanup');
      spawnSync('docker', ['stop', '--time', '10', container], { stdio: 'ignore' });
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
