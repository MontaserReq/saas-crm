import { describe, expect, it } from 'vitest';
import { isPlatformAdmin } from '@/lib/security/platform';

describe('platform authority boundary', () => {
  it('allows only a marked PLATFORM_ADMIN', () => {
    expect(isPlatformAdmin({ role: 'PLATFORM_ADMIN', isPlatformAdmin: true })).toBe(true);
  });

  it('rejects an unmarked PLATFORM_ADMIN', () => {
    expect(isPlatformAdmin({ role: 'PLATFORM_ADMIN', isPlatformAdmin: false })).toBe(false);
    expect(isPlatformAdmin({ role: 'PLATFORM_ADMIN' })).toBe(false);
  });

  it('never treats a company SUPER_ADMIN as platform authority', () => {
    expect(isPlatformAdmin({ role: 'SUPER_ADMIN', isPlatformAdmin: true })).toBe(false);
    expect(isPlatformAdmin({ role: 'SUPER_ADMIN', isPlatformAdmin: false })).toBe(false);
    expect(isPlatformAdmin({ role: 'ADMIN', isPlatformAdmin: true })).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
  });
});
