export const DISPOSABLE_SEED_TARGET = 'disposable-local';
export const DISPOSABLE_SEED_LABEL = 'disposable';
export const DISPOSABLE_SEED_CONFIRMATION = 'ERASE_DISPOSABLE_DATABASE';

type Environment = Record<string, string | undefined>;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SAFE_DATABASE_NAME = /(?:^|[_-])(local|test|disposable)(?:$|[_-])/i;
const PRODUCTION_LIKE_NAME = /(?:^|[_-])(prod|production|stage|staging|live)(?:$|[_-])/i;

export type DisposableSeedTarget = {
  databaseName: string;
  hostname: string;
};

/** Pure validation: this function never creates a database client or connection. */
export function validateDisposableSeedTarget(env: Environment): DisposableSeedTarget {
  if (!['development', 'test'].includes(env.NODE_ENV || '')) {
    throw new Error('Seed refused: NODE_ENV must explicitly identify development or test');
  }
  if (env.SEED_TARGET !== DISPOSABLE_SEED_TARGET || env.SEED_DATABASE_LABEL !== DISPOSABLE_SEED_LABEL) {
    throw new Error('Seed refused: disposable target metadata is missing or invalid');
  }
  if (env.SEED_CONFIRM !== DISPOSABLE_SEED_CONFIRMATION) {
    throw new Error('Seed refused: deliberate erase confirmation is missing or invalid');
  }

  let url: URL;
  try {
    url = new URL(env.DATABASE_URL || '');
  } catch {
    throw new Error('Seed refused: database target is missing or invalid');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Seed refused: only a PostgreSQL disposable target is supported');
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('Seed refused: database target must be loopback-only');
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, '')).trim();
  if (!databaseName || PRODUCTION_LIKE_NAME.test(databaseName) || !SAFE_DATABASE_NAME.test(databaseName)) {
    throw new Error('Seed refused: database name is ambiguous or production-like');
  }

  return { databaseName, hostname: url.hostname };
}

export function assertDisposableSeedTarget(env: Environment = process.env): DisposableSeedTarget {
  return validateDisposableSeedTarget(env);
}
