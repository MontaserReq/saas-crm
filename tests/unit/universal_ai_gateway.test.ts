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
      .mockResolvedValueOnce(new Response('upstream still down', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'fallback result' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const result = await UniversalAiGateway.generate({ messages: [{ role: 'user', content: 'hello' }] });

    expect(result.providerId).toBe('fallback');
    expect(result.content).toBe('fallback result');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('discovers model ids from an OpenAI-compatible models endpoint', async () => {
    vi.mocked(getAiResearchPlatformSettings).mockResolvedValue(settings([provider({ id: 'openai', kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1' })]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }), { status: 200 })));

    await expect(UniversalAiGateway.listModels('openai')).resolves.toEqual(['model-a', 'model-b']);
  });

  it('normalizes OpenAI-compatible tool calls', async () => {
    vi.mocked(getAiResearchPlatformSettings).mockResolvedValue(settings([provider({ id: 'tools', kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1' })]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '', tool_calls: [{ id: 'call-1', function: { name: 'lookup', arguments: '{"q":"acme"}' } }] } }] }), { status: 200 })));

    const result = await UniversalAiGateway.executeWithTools({ messages: [{ role: 'user', content: 'lookup acme' }], tools: [{ name: 'lookup', parameters: { type: 'object' } }] });

    expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'lookup', arguments: '{"q":"acme"}' }]);
  });

  it('streams normalized text chunks from an SSE provider', async () => {
    vi.mocked(getAiResearchPlatformSettings).mockResolvedValue(settings([provider({ id: 'stream', kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1', capabilities: ['text', 'streaming'] })]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } })));

    const chunks: string[] = [];
    for await (const chunk of UniversalAiGateway.stream({ messages: [{ role: 'user', content: 'hello' }] })) if (!chunk.done) chunks.push(chunk.content);

    expect(chunks.join('')).toBe('hello world');
  });

  it('normalizes embeddings from an OpenAI-compatible provider', async () => {
    vi.mocked(getAiResearchPlatformSettings).mockResolvedValue(settings([provider({ id: 'embed', kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1', capabilities: ['embeddings'] })]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2] }], usage: { prompt_tokens: 4 } }), { status: 200 })));

    await expect(UniversalAiGateway.getEmbeddings({ input: 'acme' })).resolves.toMatchObject({ providerId: 'embed', embeddings: [[0.1, 0.2]], inputTokens: 4 });
  });

  it('blocks feature requests when platform AI status is OFF', async () => {
    vi.mocked(getAiResearchPlatformSettings).mockResolvedValue({ ...settings([provider()]), status: 'OFF' });
    vi.stubGlobal('fetch', vi.fn());
    await expect(UniversalAiGateway.generate({ messages: [{ role: 'user', content: 'hello' }] })).rejects.toThrow('disabled by the platform administrator');
    expect(fetch).not.toHaveBeenCalled();
  });
});
