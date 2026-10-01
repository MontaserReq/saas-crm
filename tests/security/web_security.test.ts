import { afterEach, describe, expect, it } from 'vitest';
import { applySecurityHeaders, rejectUntrustedMutation, validateMutationOrigin } from '@/lib/security/web';
import { safeExternalUrl } from '@/lib/security/url';

const oldOrigin = process.env.APP_ORIGIN;
const oldProxy = process.env.TRUST_PROXY;

afterEach(() => {
  if (oldOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = oldOrigin;
  if (oldProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = oldProxy;
});

describe('web security controls', () => {
  it('applies baseline headers and HTTPS-only HSTS', () => {
    process.env.APP_ORIGIN = 'https://crm.example.com';
    const response = applySecurityHeaders(new Response('ok'), new Request('https://crm.example.com/'));
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('permissions-policy')).toContain('camera=()');
    expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');

    const local = applySecurityHeaders(new Response('ok'), new Request('http://localhost/'));
    expect(local.headers.get('strict-transport-security')).toBeNull();
  });

  it('requires exact trusted Origin or Referer for mutations', () => {
    process.env.APP_ORIGIN = 'https://crm.example.com';
    expect(validateMutationOrigin(new Request('https://crm.example.com/api/x', { method: 'POST', headers: { origin: 'https://crm.example.com' } })).ok).toBe(true);
    expect(validateMutationOrigin(new Request('https://crm.example.com/api/x', { method: 'POST', headers: { origin: 'https://attacker.example' } })).ok).toBe(false);
    expect(validateMutationOrigin(new Request('https://crm.example.com/api/x', { method: 'POST', headers: { origin: 'https://crm.example.com.attacker.example' } })).ok).toBe(false);
    expect(validateMutationOrigin(new Request('https://crm.example.com/api/x', { method: 'POST', headers: { referer: 'https://crm.example.com/form' } })).ok).toBe(true);
    expect(validateMutationOrigin(new Request('https://crm.example.com/api/x', { method: 'POST' })).ok).toBe(false);
    expect(validateMutationOrigin(new Request('https://crm.example.com/api/x', { method: 'GET', headers: { origin: 'https://attacker.example' } })).ok).toBe(true);
    const rejected = rejectUntrustedMutation(new Request('https://crm.example.com/api/x', { method: 'POST', headers: { origin: 'https://attacker.example' } }));
    expect(rejected?.status).toBe(403);
  });

  it('allows only HTTP and HTTPS external URLs', () => {
    expect(safeExternalUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com/');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,payload')).toBeNull();
    expect(safeExternalUrl('not a url')).toBeNull();
  });
});
