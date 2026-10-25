import { afterEach, describe, expect, it, vi } from 'vitest';

const headerState = { forwarded: null as string | null, realIp: null as string | null };

vi.mock('next/headers', () => ({
  headers: async () => ({
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
  it('ignores forwarded headers when the proxy is untrusted', async () => {
    headerState.forwarded = '198.51.100.10';
    headerState.realIp = '198.51.100.11';
    expect((await getRequestContext('203.0.113.10')).ipAddress).toBe('203.0.113.10');
  });

  it('uses a single forwarded address only behind the configured single-hop proxy', async () => {
    process.env.TRUST_PROXY = 'single-hop';
    headerState.forwarded = '198.51.100.10';
    expect((await getRequestContext('203.0.113.10')).ipAddress).toBe('198.51.100.10');
  });

  it('rejects ambiguous forwarded chains in single-hop mode', async () => {
    process.env.TRUST_PROXY = 'single-hop';
    headerState.forwarded = '198.51.100.10, 10.0.0.1';
    expect((await getRequestContext('203.0.113.10')).ipAddress).toBe('anonymous');
  });

  it('uses the trusted real IP fallback and anonymous behavior when runtime IP is unavailable', async () => {
    process.env.TRUST_PROXY = 'single-hop';
    headerState.realIp = '198.51.100.12';
    expect((await getRequestContext()).ipAddress).toBe('198.51.100.12');
    delete process.env.TRUST_PROXY;
    headerState.realIp = '198.51.100.13';
    expect((await getRequestContext()).ipAddress).toBe('anonymous');
  });
});
