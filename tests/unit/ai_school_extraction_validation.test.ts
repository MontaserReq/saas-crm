import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider, extractJsonPayload } from '@/lib/ai/GeminiProvider';
import { AiExtractionError, AiNotConfiguredError, AiTruncatedResponseError } from '@/lib/ai/types';

function makeProvider(apiKey: string | null = 'test-key') {
  return new GeminiProvider({
    aiProvider: 'gemini',
    geminiApiKey: apiKey,
    geminiModel: 'gemini-2.0-flash',
    groqApiKey: null,
    groqModel: 'groq/compound-mini',
    groqMaxCompletionTokens: 4096,
    groqBatchSize: 100,
    maxSchoolsPerJob: 100,
    maxSourceRequestsPerSchool: 3,
  });
}

function mockGeminiText(text: string, ok = true, status = 200) {
  (global as any).fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => text,
  });
}

describe('AI School Research: extraction JSON parsing', () => {
  it('extracts a bare JSON object with no markdown fences', () => {
    expect(extractJsonPayload('{"schools": []}')).toEqual({ schools: [] });
  });

  it('strips markdown code fences before parsing', () => {
    expect(extractJsonPayload('```json\n{"schools": []}\n```')).toEqual({ schools: [] });
  });

  it('extracts JSON even with commentary before/after it', () => {
    expect(extractJsonPayload('Sure, here you go:\n{"schools": []}\nHope that helps!')).toEqual({ schools: [] });
  });

  it('throws AiExtractionError when no JSON is present at all', () => {
    expect(() => extractJsonPayload('I could not find any schools.')).toThrow(AiExtractionError);
  });

  it('throws AiExtractionError for an unterminated/truncated JSON payload', () => {
    expect(() => extractJsonPayload('{"schools": [ { "name": "Cut off school"')).toThrow(AiExtractionError);
  });

  it('throws the more specific AiTruncatedResponseError for a truncated payload, so a provider can decide to retry', () => {
    expect(() => extractJsonPayload('{"schools": [ { "name": "Cut off school"')).toThrow(AiTruncatedResponseError);
  });

  it('does not mistake a brace/bracket inside a string value for JSON structure', () => {
    const raw = JSON.stringify({ schools: [{ name: 'School', address: 'Building { A }, Street [12]' }] });
    expect(extractJsonPayload(raw)).toEqual(JSON.parse(raw));
  });

  it('does not mistake an escaped quote inside a string for the end of that string', () => {
    const raw = '{"schools": [{"name": "The \\"Best\\" School", "city": "Amman"}]}';
    expect(extractJsonPayload(raw)).toEqual({ schools: [{ name: 'The "Best" School', city: 'Amman' }] });
  });
});

describe('AI School Research: GeminiProvider.extractSchools', () => {
  const originalFetch = global.fetch;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws AiNotConfiguredError and never calls the network when no API key is set', async () => {
    const fetchSpy = vi.fn();
    (global as any).fetch = fetchSpy;
    const provider = makeProvider(null);
    await expect(provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiNotConfiguredError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validates well-formed schools through the Zod schema', async () => {
    mockGeminiText(JSON.stringify({ schools: [{ name: 'XYZ School', city: 'Amman', phone: '0799631111', evidence: [{ field: 'phone', source: 'Official Website', sourceUrl: 'https://xyz.edu.jo' }] }] }));
    const result = await makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });
    expect(result.schools).toHaveLength(1);
    expect(result.schools[0].name).toBe('XYZ School');
  });

  it('rejects a hallucinated response missing the required "name" field for each school', async () => {
    mockGeminiText(JSON.stringify({ schools: [{ city: 'Amman', phone: '0799631111' }] }));
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
  });

  it('rejects malformed (non-JSON) model output instead of crashing the caller with a raw parse error', async () => {
    mockGeminiText('<html>this is not json</html>');
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
  });

  it('treats an empty model response as a failed extraction, not zero real results silently accepted as success', async () => {
    mockGeminiText('');
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
  });

  it('surfaces a non-2xx provider response as AiExtractionError', async () => {
    mockGeminiText('rate limited', false, 429);
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
  });

  it('surfaces a network failure as AiExtractionError', async () => {
    (global as any).fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
  });

  it('accepts an empty schools array as a valid (if unhelpful) result rather than throwing', async () => {
    mockGeminiText(JSON.stringify({ schools: [] }));
    const result = await makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });
    expect(result.schools).toEqual([]);
  });
});
