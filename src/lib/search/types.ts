export type SearchProviderKind = 'exa' | 'brave' | 'custom';

export type SearchRequest = {
  query: string;
  maxResults?: number;
  includeContent?: boolean;
};

export type SearchResult = {
  title: string;
  url: string;
  description: string | null;
  content: string | null;
  publishedAt: string | null;
  providerId: string;
  metadata: Record<string, unknown>;
};

export interface SearchProvider {
  readonly id: string;
  search(request: SearchRequest): Promise<SearchResult[]>;
  fetchContent?(url: string): Promise<{ url: string; content: string }>;
}
