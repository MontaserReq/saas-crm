import { z } from 'zod';
import { UniversalAiGateway } from './gateway';

const smartSearchResultSchema = z.object({
  results: z.array(z.object({
    url: z.string().trim().min(8).max(2000),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(3000).nullable().optional().default(null),
  })).max(100),
});

export type SmartLeadSearchResult = z.infer<typeof smartSearchResultSchema>['results'][number];

/**
 * Searches the public web through the configured AI provider's native search
 * capability. This keeps lead discovery as one smart-research flow instead of
 * requiring a second, separately configured search-provider catalog.
 */
export async function searchSmartLeads(input: {
  query: string;
  maxResults: number;
  organizationId: string;
  userId: string;
}) {
  const response = await UniversalAiGateway.generateStructured<unknown>({
    purpose: 'smart-lead-discovery',
    requiredCapabilities: ['text', 'structured-json'],
    webSearch: true,
    organizationId: input.organizationId,
    userId: input.userId,
    maxOutputTokens: Math.min(7000, Math.max(1800, input.maxResults * 180)),
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: 'You are a web research engine for CRM lead discovery. Use the provider native web search before answering. Return only JSON in this exact shape: {"results":[{"url":"https://...","title":"...","description":"..."}]}. Include only real public pages relevant to the query, prefer official business websites and contact pages, never invent URLs or businesses, and keep descriptions short.',
      },
      {
        role: 'user',
        content: `Search query: ${input.query}\nReturn at most ${input.maxResults} relevant results.`,
      },
    ],
  });

  return {
    providerId: response.providerId,
    results: smartSearchResultSchema.parse(response.data).results.slice(0, input.maxResults),
  };
}
