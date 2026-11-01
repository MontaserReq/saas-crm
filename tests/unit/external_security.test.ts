import { describe, expect, it } from 'vitest';
import { readLimitedResponseText, sanitizeExternalContent } from '@/lib/security/external';
import { safeProviderEndpoint } from '@/lib/security/url';

describe('external content and provider endpoint safety', () => {
  it('removes executable markup and bounds untrusted content', () => {
    expect(sanitizeExternalContent('<script>ignore()</script><main>Acme&nbsp;&amp; Co</main>')).toBe('Acme & Co');
    expect(sanitizeExternalContent('abcdefgh', 4)).toBe('abcd');
  });

  it('rejects local provider endpoints', () => {
    expect(safeProviderEndpoint('http://127.0.0.1:8000')).toBeNull();
    expect(safeProviderEndpoint('http://[::1]:8000')).toBeNull();
    expect(safeProviderEndpoint('https://api.example.com')).toBe('https://api.example.com/');
  });

  it('rejects oversized upstream responses', async () => {
    await expect(readLimitedResponseText(new Response('x'.repeat(101)), 100)).rejects.toThrow('too large');
  });
});
