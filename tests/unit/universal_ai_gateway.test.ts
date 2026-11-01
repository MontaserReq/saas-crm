import { afterEach, describe, expect, it, vi } from 'vitest';
import { UniversalAiGateway } from '@/lib/ai/gateway';
import { getAiResearchPlatformSettings } from '@/lib/ai/researchSettings';

vi.mock('@/lib/ai/researchSettings', () => ({
  getAiResearchPlatformSettings: vi.fn(),
}));

const settings = (providers: any[], activeProviderId = providers[0]?.id || null) => ({
  status: 'ON' as const,
  provider: providers[0]?.kind || 'openai-compatible',
  geminiApiKey: null,
  groqApiKey: null,
  geminiModel: 'gemini-test',
  groqModel: 'groq-test',
  providers,
  activeProviderId,
  activeProvider: providers.find((provider) => provider.id === activeProviderId) || null,
  featureProviderIds: {},
  fallbackProviderIds: providers.slice(1).map((provider) => provider.id),
});

const provider = (overrides: Record<string, unknown> = {}) => ({
  id: 'custom', name: 'Custom', kind: 'custom-http', baseUrl: 'https://llm.example.test/generate', model: 'custom-1', apiKey: 'secret', enabled: true, timeoutMs: 5000, maxOutputTokens: 100, temperature: 0.2, ...overrides,
});

describe('Universal AI Gateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('supports custom HTTP response paths without requiring an OpenAI response envelope', async () => {
    vi.mocked(getAiResearchPlatformSettings).mockResolvedValue(settings([provider({ responsePath: 'result.text' })]));
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { text: 'READY' }, usage: { input_tokens: 3, output_tokens: 2 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const result = await UniversalAiGateway.generate({ messages: [{ role: 'user', content: 'hello' }], purpose: 'test' });

    expect(result).toMatchObject({ content: 'READY', providerId: 'custom', inputTokens: 3, outputTokens: 2, totalTokens: 5 });
    expect(fetch).toHaveBeenCalledWith('https://llm.example.test/generate', expect.objectContaining({ method: 'POST' }));
  });

  it('uses the next configured provider when the primary provider fails', async () => {
    const primary = provider({ id: 'primary', name: 'Primary', kind: 'openai-compatible', baseUrl: 'https://primary.example.test/v1', responsePath: undefined });
    const fallback = provider({ id: 'fallback', name: 'Fallback', kind: 'openai-compatible', baseUrl: 'https://fallback.example.test/v1', responsePath: undefined });
    vi.mocked(getAiResearchPlatformSettings).mockResolvedValue(settings([primary, fallback], 'primary'));
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('upstream down', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'fallback result' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const result = await UniversalAiGateway.generate({ messages: [{ role: 'user', content: 'hello' }] });

    expect(result.providerId).toBe('fallback');
    expect(result.content).toBe('fallback result');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('discovers model ids from an OpenAI-compatible models endpoint', async () => {
    vi.mocked(getAiResearchPlatformSettings).mockResolvedValue(settings([provider({ id: 'openai', kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1' })]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }), { status: 200 })));

    await expect(UniversalAiGateway.listModels('openai')).resolves.toEqual(['model-a', 'model-b']);
  });
});
