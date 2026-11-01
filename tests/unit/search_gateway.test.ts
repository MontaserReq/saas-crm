import { afterEach, describe, expect, it, vi } from 'vitest';

const dnsMock = vi.hoisted(() => ({ lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34' }]) }));
vi.mock('node:dns/promises', () => ({ default: dnsMock }));

const prismaMock = vi.hoisted(() => ({
  searchResultCache: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  searchContentCache: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  searchProviderUsageLog: { create: vi.fn(), groupBy: vi.fn() },
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/search/settings', () => ({
  getSearchProviderSettings: vi.fn(),
}));

import { getSearchProviderSettings } from '@/lib/search/settings';
import { SearchGateway } from '@/lib/search';

const config = { id: 'custom', name: 'Custom', kind: 'custom' as const, baseUrl: 'https://search.example.test/search', apiKey: 'secret', enabled: true, maxResults: 10 };

describe('SearchGateway', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('caches normalized provider results and records cached usage', async () => {
    vi.mocked(getSearchProviderSettings).mockResolvedValue({ providers: [config], activeProviderId: 'custom', fallbackProviderIds: [], activeProvider: config });
    prismaMock.searchResultCache.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'cache-1', expiresAt: new Date(Date.now() + 60_000), payload: JSON.stringify([{ title: 'Acme', url: 'https://acme.example', description: 'desc', content: null, publishedAt: null, providerId: 'custom', metadata: {} }]) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ title: 'Acme', url: 'https://acme.example', snippet: 'desc' }] }), { status: 200 })));

    const first = await SearchGateway.search({ query: 'acme', maxResults: 1, organizationId: 'org-1', userId: 'user-1', purpose: 'smart-lead-discovery' });
    const second = await SearchGateway.search({ query: 'acme', maxResults: 1, organizationId: 'org-1', userId: 'user-1', purpose: 'smart-lead-discovery' });

    expect(first.results[0].title).toBe('Acme');
    expect(second.results[0].title).toBe('Acme');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(prismaMock.searchResultCache.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.searchProviderUsageLog.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.searchProviderUsageLog.create.mock.calls[1][0].data.status).toBe('CACHED');
  });

  it('falls back to the next enabled search provider after a provider failure', async () => {
    const fallback = { ...config, id: 'fallback', name: 'Fallback' };
    vi.mocked(getSearchProviderSettings).mockResolvedValue({ providers: [config, fallback], activeProviderId: 'custom', fallbackProviderIds: ['fallback'], activeProvider: config });
    prismaMock.searchResultCache.findUnique.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(new Response('still down', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ title: 'Fallback Co', url: 'https://fallback.example' }] }), { status: 200 })));

    const result = await SearchGateway.search({ query: 'fallback test' });
    expect(result.providerId).toBe('fallback');
    expect(result.results[0].title).toBe('Fallback Co');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(prismaMock.searchProviderUsageLog.create.mock.calls[0][0].data.status).toBe('FAILED');
    expect(prismaMock.searchProviderUsageLog.create.mock.calls[1][0].data.status).toBe('SUCCESS');
  });

  it('caches sanitized public website content by URL', async () => {
    prismaMock.searchContentCache.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'content-1', url: 'https://acme.example/', expiresAt: new Date(Date.now() + 60_000), content: 'Acme public contact details' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html><script>alert(1)</script><main>Acme <strong>public</strong> contact details</main></html>', { status: 200, headers: { 'content-type': 'text/html' } })));

    const first = await SearchGateway.fetchContent('https://acme.example/');
    const second = await SearchGateway.fetchContent('https://acme.example/');

    expect(first.content).toBe('Acme public contact details');
    expect(second.content).toBe('Acme public contact details');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(prismaMock.searchContentCache.upsert).toHaveBeenCalledTimes(1);
  });
});
