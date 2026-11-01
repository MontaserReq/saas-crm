import type { SearchProvider, SearchRequest, SearchResult } from './types';
import type { SearchProviderConfig } from './settings';
import { fetchPublicContent } from './http';

export class ExaSearchProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly config: SearchProviderConfig) { this.id = config.id; }
  async search(request: SearchRequest): Promise<SearchResult[]> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/search`, {
      method: 'POST',
      headers: { 'x-api-key': this.config.apiKey || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: request.query,
        type: 'auto',
        numResults: Math.min(this.config.maxResults, request.maxResults || this.config.maxResults),
        ...(request.includeContent === false ? {} : { contents: { highlights: true, text: { maxCharacters: 6000 } } }),
      }),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Exa returned HTTP ${response.status}`);
    const payload: any = await response.json();
    return (Array.isArray(payload?.results) ? payload.results : []).flatMap((item: any) => typeof item?.url === 'string' ? [{ title: String(item.title || item.url), url: item.url, description: item.summary || item.highlights?.join(' ') || null, content: item.text || null, publishedAt: item.publishedDate || null, providerId: this.id, metadata: { id: item.id || null, score: item.score || null } }] : []);
  }
  async fetchContent(url: string) { return fetchPublicContent(url); }
}

export class BraveSearchProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly config: SearchProviderConfig) { this.id = config.id; }
  async search(request: SearchRequest): Promise<SearchResult[]> {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    const url = new URL(`${base}/web/search`);
    url.searchParams.set('q', request.query);
    url.searchParams.set('count', String(Math.min(this.config.maxResults, request.maxResults || this.config.maxResults)));
    const response = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': this.config.apiKey || '' }, signal: AbortSignal.timeout(30_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Brave Search returned HTTP ${response.status}`);
    const payload: any = await response.json();
    return (Array.isArray(payload?.web?.results) ? payload.web.results : []).flatMap((item: any) => typeof item?.url === 'string' ? [{ title: String(item.title || item.url), url: item.url, description: item.description || null, content: null, publishedAt: null, providerId: this.id, metadata: { language: item.language || null } }] : []);
  }
  async fetchContent(url: string) { return fetchPublicContent(url); }
}

export class CustomSearchProvider implements SearchProvider {
  readonly id: string;
  constructor(private readonly config: SearchProviderConfig) { this.id = config.id; }
  async search(request: SearchRequest): Promise<SearchResult[]> {
    const url = new URL(this.config.baseUrl);
    url.searchParams.set('q', request.query);
    url.searchParams.set('count', String(Math.min(this.config.maxResults, request.maxResults || this.config.maxResults)));
    const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${this.config.apiKey || ''}` }, signal: AbortSignal.timeout(30_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Custom search provider returned HTTP ${response.status}`);
    const payload: any = await response.json();
    const items = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.web?.results) ? payload.web.results : [];
    return items.flatMap((item: any) => typeof item?.url === 'string' ? [{ title: String(item.title || item.url), url: item.url, description: item.description || item.snippet || null, content: item.content || item.text || null, publishedAt: item.publishedAt || null, providerId: this.id, metadata: {} }] : []);
  }
  async fetchContent(url: string) { return fetchPublicContent(url); }
}

export function createSearchProvider(config: SearchProviderConfig): SearchProvider {
  if (config.kind === 'exa') return new ExaSearchProvider(config);
  if (config.kind === 'brave') return new BraveSearchProvider(config);
  return new CustomSearchProvider(config);
}
