import { afterEach, describe, expect, it, vi } from 'vitest';

const headerState = { forwarded: null as string | null, realIp: null as string | null };

vi.mock('next/headers', () => ({
  headers: () => ({
    get(name: string) {
      const key = name.toLowerCase();
      if (key === 'x-forwarded-for') return headerState.forwarded;
      if (key === 'x-real-ip') return headerState.realIp;
      if (key === 'user-agent') return 'vitest-agent';
      return null;
    },
  }),
}));

import { getRequestContext } from '@/lib/security/request';

afterEach(() => {
  delete process.env.TRUST_PROXY;
  headerState.forwarded = null;
  headerState.realIp = null;
});

describe('request context client IP trust', () => {
  it('ignores forwarded headers when the proxy is untrusted', () => {
    headerState.forwarded = '198.51.100.10';
    headerState.realIp = '198.51.100.11';
    expect(getRequestContext('203.0.113.10').ipAddress).toBe('203.0.113.10');
  });

  it('uses the first forwarded address only behind a trusted proxy', () => {
    process.env.TRUST_PROXY = 'true';
    headerState.forwarded = '198.51.100.10, 10.0.0.1';
    expect(getRequestContext('203.0.113.10').ipAddress).toBe('198.51.100.10');
  });

  it('uses the trusted real IP fallback and anonymous behavior when runtime IP is unavailable', () => {
    process.env.TRUST_PROXY = 'true';
    headerState.realIp = '198.51.100.12';
    expect(getRequestContext().ipAddress).toBe('198.51.100.12');
    delete process.env.TRUST_PROXY;
    headerState.realIp = '198.51.100.13';
    expect(getRequestContext().ipAddress).toBe('anonymous');
  });
});
