import { afterEach, describe, expect, it, vi } from 'vitest';
import { BraveSearchProvider, CustomSearchProvider, ExaSearchProvider } from '@/lib/search/providers';

const config = (kind: 'exa' | 'brave' | 'custom') => ({ id: kind, name: kind, kind, baseUrl: kind === 'exa' ? 'https://api.exa.ai' : kind === 'brave' ? 'https://api.search.brave.com/res/v1' : 'https://search.example.com/search', apiKey: 'secret', enabled: true, maxResults: 10 });

describe('independent search provider adapters', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes Exa search results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ title: 'Acme', url: 'https://acme.example', highlights: ['About Acme'] }] }), { status: 200 })));
    const results = await new ExaSearchProvider(config('exa')).search({ query: 'acme', maxResults: 1 });
    expect(results[0]).toMatchObject({ title: 'Acme', url: 'https://acme.example', providerId: 'exa' });
  });

  it('normalizes Brave and custom result envelopes', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ web: { results: [{ title: 'Brave Co', url: 'https://brave.example', description: 'desc' }] } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ title: 'Custom Co', url: 'https://custom.example', snippet: 'snippet' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect((await new BraveSearchProvider(config('brave')).search({ query: 'brave' }))[0].title).toBe('Brave Co');
    expect((await new CustomSearchProvider(config('custom')).search({ query: 'custom' }))[0].description).toBe('snippet');
  });
});
