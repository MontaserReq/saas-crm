import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { authRedirect, middleware } from '@/middleware';

const originalOrigin = process.env.APP_ORIGIN;

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = originalOrigin;
});

function request(url = 'http://attacker.example/dashboard', headers?: Record<string, string>) {
  return new NextRequest(url, { headers });
}

describe('authentication redirect origin safety', () => {
  it('uses a validated APP_ORIGIN for configured redirects', () => {
    process.env.APP_ORIGIN = 'https://crm.example.com';
    expect(authRedirect('/login', request()).headers.get('location')).toBe('https://crm.example.com/login');
  });

  it('uses a relative redirect when APP_ORIGIN is missing', () => {
    process.env.APP_ORIGIN = '';
    const response = middleware(request(undefined, { host: 'attacker.example.com' }));
    expect(response.headers.get('location')).toBe('/login');
    expect(response.headers.get('location')).not.toContain('attacker.example.com');
  });

  it('uses a relative redirect for malformed or malicious APP_ORIGIN values', () => {
    for (const value of ['https://', 'https://user:pass@example.com', 'https://example.com/path', 'javascript://evil']) {
      process.env.APP_ORIGIN = value;
      const response = middleware(request(undefined, { host: 'attacker.example.com', 'x-forwarded-host': 'attacker.example.com' }));
      expect(response.headers.get('location')).toBe('/login');
      expect(response.headers.get('location')).not.toContain('attacker.example.com');
    }
  });

  it('never uses forwarded host data when APP_ORIGIN is unavailable', () => {
    delete process.env.APP_ORIGIN;
    const response = middleware(request(undefined, { host: 'attacker.example.com', 'x-forwarded-host': 'attacker.example.com' }));
    expect(response.headers.get('location')).toBe('/login');
    expect(response.headers.get('location')).not.toContain('attacker.example.com');
  });
});
