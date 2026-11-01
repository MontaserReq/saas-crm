import { getSearchProviderSettings } from './settings';
import { createSearchProvider } from './providers';
import type { SearchRequest, SearchResult } from './types';

export * from './types';
export * from './settings';

export class SearchGateway {
  static async search(request: SearchRequest): Promise<{ providerId: string; results: SearchResult[] }> {
    const settings = await getSearchProviderSettings();
    const candidates = settings.providers.filter((provider) => provider.enabled && provider.apiKey);
    const preferred = candidates.find((provider) => provider.id === settings.activeProviderId);
    const explicitFallbacks = settings.fallbackProviderIds.map((id) => candidates.find((provider) => provider.id === id)).filter((provider): provider is NonNullable<typeof provider> => Boolean(provider && provider.id !== preferred?.id));
    const ordered = [preferred, ...explicitFallbacks, ...candidates.filter((provider) => provider.id !== preferred?.id && !explicitFallbacks.some((fallback) => fallback.id === provider.id))].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider));
    if (!ordered.length) throw new Error('No enabled search provider with an API key is configured.');
    let lastError: unknown;
    for (const config of ordered) {
      try {
        const results = await createSearchProvider(config).search(request);
        return { providerId: config.id, results };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All configured search providers failed.');
  }

  static async testProvider(providerId: string) {
    const settings = await getSearchProviderSettings();
    const provider = settings.providers.find((candidate) => candidate.id === providerId);
    if (!provider || !provider.enabled || !provider.apiKey) throw new Error('Search provider is not enabled or configured.');
    const results = await createSearchProvider(provider).search({ query: 'SatrCRM connection test', maxResults: 1, includeContent: false });
    return { providerId, resultCount: results.length };
  }
}
