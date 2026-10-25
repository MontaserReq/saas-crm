import { describe, expect, it, vi } from 'vitest';
import {
  DISPOSABLE_SEED_CONFIRMATION,
  DISPOSABLE_SEED_LABEL,
  DISPOSABLE_SEED_TARGET,
  validateDisposableSeedTarget,
} from '@/lib/security/seedTarget';

const authorized = {
  NODE_ENV: 'test',
  SEED_TARGET: DISPOSABLE_SEED_TARGET,
  SEED_DATABASE_LABEL: DISPOSABLE_SEED_LABEL,
  SEED_CONFIRM: DISPOSABLE_SEED_CONFIRMATION,
  DATABASE_URL: 'postgresql://placeholder:placeholder@127.0.0.1:5432/codeline_disposable_test',
};

describe('destructive seed target guard', () => {
  it('accepts only a positively labelled, confirmed, loopback disposable target', () => {
    expect(validateDisposableSeedTarget(authorized)).toEqual({
      databaseName: 'codeline_disposable_test',
      hostname: '127.0.0.1',
    });
  });

  it.each([
    ['production environment', { NODE_ENV: 'production' }],
    ['remote target', { DATABASE_URL: 'postgresql://placeholder:placeholder@db.example.test:5432/codeline_disposable_test' }],
    ['missing label', { SEED_DATABASE_LABEL: undefined }],
    ['missing target metadata', { SEED_TARGET: undefined }],
    ['missing deliberate confirmation', { SEED_CONFIRM: undefined }],
    ['production-like database name', { DATABASE_URL: 'postgresql://placeholder:placeholder@127.0.0.1:5432/codeline_production' }],
    ['ambiguous database name', { DATABASE_URL: 'postgresql://placeholder:placeholder@127.0.0.1:5432/codeline' }],
  ])('rejects %s before a database operation can be invoked', (_label, override) => {
    const databaseOperation = vi.fn();
    expect(() => {
      validateDisposableSeedTarget({ ...authorized, ...override });
      databaseOperation();
    }).toThrow('Seed refused');
    expect(databaseOperation).not.toHaveBeenCalled();
  });
});
