import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GroqProvider } from '@/lib/ai/GroqProvider';
import { AiExtractionError, AiNotConfiguredError } from '@/lib/ai/types';

function groqHttpResponse({
  content,
  executedTools = [{ type: 'search', arguments: {} }],
  finishReason = 'stop',
  ok = true,
  status = 200,
  headers,
  bodyText,
}: {
  content: string;
  executedTools?: any[];
  finishReason?: string | null;
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  bodyText?: string;
}) {
  const body = { choices: [{ message: { content, executed_tools: executedTools }, finish_reason: finishReason }] };
  return {
    ok,
    status,
    headers: { get: (name: string) => headers?.[name.toLowerCase()] ?? headers?.[name] ?? null },
    json: async () => body,
    text: async () => bodyText ?? JSON.stringify(body),
  };
}

/** Queues a sequence of distinct HTTP responses across successive fetch calls (for retry tests). */
function mockGroqSequence(responses: ReturnType<typeof groqHttpResponse>[]) {
  const fetchSpy = vi.fn();
  responses.forEach((response) => fetchSpy.mockResolvedValueOnce(response));
  (global as any).fetch = fetchSpy;
  return fetchSpy;
}

function makeProvider(
  apiKey: string | null = 'test-groq-key',
  overrides: Partial<{ groqBatchSize: number }> = {},
  sleep: (ms: number) => Promise<void> = vi.fn().mockResolvedValue(undefined)
) {
  return new GroqProvider(
    {
      aiProvider: 'groq',
      geminiApiKey: null,
      geminiModel: 'gemini-2.0-flash',
      groqApiKey: apiKey,
      groqModel: 'groq/compound-mini',
      groqMaxCompletionTokens: 4096,
      // Large default so requestedCount values used by the non-batching tests
      // below (up to 10) stay within a single batch — batching itself is
      // covered by the dedicated "batching large requests" suite.
      groqBatchSize: 100,
      maxSchoolsPerJob: 100,
      maxSourceRequestsPerSchool: 3,
      ...overrides,
    },
    sleep // never a real timer in tests — the 429 retry tests below assert on sleep's own call args instead
  );
}

function mockGroqResponse({
  content,
  executedTools = [{ type: 'search', arguments: { query: 'schools in Amman' } }],
  ok = true,
  status = 200,
}: {
  content: string;
  executedTools?: any[] | undefined;
  ok?: boolean;
  status?: number;
}) {
  const body = { choices: [{ message: { content, executed_tools: executedTools } }] };
  (global as any).fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe('AI School Research: GroqProvider', () => {
  const originalFetch = global.fetch;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws AiNotConfiguredError and never calls the network when GROQ_API_KEY is missing', async () => {
    const fetchSpy = vi.fn();
    (global as any).fetch = fetchSpy;
    await expect(makeProvider(null).extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiNotConfiguredError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends an Authorization Bearer header and the configured model — never GEMINI_API_KEY or a client-exposed key', async () => {
    mockGroqResponse({ content: JSON.stringify({ schools: [] }) });
    await makeProvider('secret-groq-key').extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });

    const [, requestInit] = (global.fetch as any).mock.calls[0];
    expect(requestInit.headers.Authorization).toBe('Bearer secret-groq-key');
    const body = JSON.parse(requestInit.body);
    expect(body.model).toBe('groq/compound-mini');
  });

  it('accepts a well-formed, web-search-grounded response', async () => {
    mockGroqResponse({
      content: JSON.stringify({ schools: [{ name: 'XYZ School', city: 'Amman', evidence: [{ field: 'name', source: 'Official Website', sourceUrl: 'https://xyz.edu.jo' }] }] }),
    });
    const result = await makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });
    expect(result.schools).toHaveLength(1);
    expect(result.schools[0].name).toBe('XYZ School');
  });

  it('rejects a response that did not actually perform a web search (no executed_tools)', async () => {
    mockGroqResponse({ content: JSON.stringify({ schools: [{ name: 'Made Up School' }] }), executedTools: [] });
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(/web search/i);
  });

  it('rejects a response whose executed_tools contain no search-type tool (e.g. only code execution)', async () => {
    mockGroqResponse({
      content: JSON.stringify({ schools: [{ name: 'Made Up School' }] }),
      executedTools: [{ type: 'code_execution', arguments: {} }],
    });
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
  });

  it('surfaces a persistent rate-limit (429) as AiExtractionError once its bounded retries are exhausted', async () => {
    mockGroqResponse({ content: '', ok: false, status: 429 });
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
    expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries, then gives up — never unbounded
  });

  it('rejects malformed JSON even when web search was used, instead of accepting garbage', async () => {
    mockGroqResponse({ content: 'not json at all' });
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
  });

  it('surfaces a network failure as AiExtractionError', async () => {
    (global as any).fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(makeProvider().extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
  });

  it('sends the configured max_completion_tokens budget from config (not a hardcoded literal)', async () => {
    mockGroqResponse({ content: JSON.stringify({ schools: [] }) });
    const provider = new (GroqProvider as any)({
      aiProvider: 'groq',
      geminiApiKey: null,
      geminiModel: 'gemini-2.0-flash',
      groqApiKey: 'test-groq-key',
      groqModel: 'groq/compound-mini',
      groqMaxCompletionTokens: 2222,
      groqBatchSize: 100,
      maxSchoolsPerJob: 100,
      maxSourceRequestsPerSchool: 3,
    });
    await provider.extractSchools({ location: 'Amman', requestedCount: 10, requiredFields: ['phone', 'email', 'website'] });

    const [, requestInit] = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.max_completion_tokens).toBe(2222);
  });


  describe('bounded retry on truncation', () => {
    const input = { location: 'Amman', requestedCount: 10, requiredFields: ['phone', 'email', 'website'] };

    it('retries once with a compact prompt after an unterminated (truncated) JSON payload, and succeeds', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: '{"schools": [ { "name": "Cut off mid', finishReason: 'length' }),
        groqHttpResponse({ content: JSON.stringify({ schools: [{ name: 'Complete School', city: 'Amman' }] }), finishReason: 'stop' }),
      ]);

      const result = await makeProvider().extractSchools(input);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.schools[0].name).toBe('Complete School');

      // The retry call's prompt must ask for a more compact/closed response.
      const secondCallBody = JSON.parse(fetchSpy.mock.calls[1][1].body);
      const secondPrompt = secondCallBody.messages[0].content;
      expect(secondPrompt).toMatch(/completely closed/i);
      // The first call's prompt must NOT already contain the retry-only instruction.
      const firstCallBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(firstCallBody.messages[0].content).not.toMatch(/completely closed/i);
    });

    it('retries when the model returns a completely empty completion (its whole token budget was spent on internal reasoning/tool calls, none left for the answer)', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: '', finishReason: 'stop' }),
        groqHttpResponse({ content: JSON.stringify({ schools: [{ name: 'Recovered School', city: 'Amman' }] }), finishReason: 'stop' }),
      ]);

      const result = await makeProvider().extractSchools(input);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.schools[0].name).toBe('Recovered School');
    });

    it('still fails cleanly (bounded) if the completion is empty on every attempt', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: '', finishReason: 'stop' }),
        groqHttpResponse({ content: '', finishReason: 'stop' }),
      ]);

      await expect(makeProvider().extractSchools(input)).rejects.toThrow(AiExtractionError);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('also retries when finish_reason is "length" even if the JSON happened to look parseable-but-incomplete', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: '{"schools": [', finishReason: 'length' }),
        groqHttpResponse({ content: JSON.stringify({ schools: [] }), finishReason: 'stop' }),
      ]);

      const result = await makeProvider().extractSchools(input);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.schools).toEqual([]);
    });

    it('is bounded: fails after exactly one retry (2 total calls) if still truncated, never loops indefinitely', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: '{"schools": [ { "name": "Still cut off', finishReason: 'length' }),
        groqHttpResponse({ content: '{"schools": [ { "name": "Still cut off again', finishReason: 'length' }),
      ]);

      await expect(makeProvider().extractSchools(input)).rejects.toThrow(AiExtractionError);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('does NOT retry when the model simply did not use web search (not a truncation issue)', async () => {
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: JSON.stringify({ schools: [{ name: 'Guess' }] }), executedTools: [] })]);
      await expect(makeProvider().extractSchools(input)).rejects.toThrow(/web search/i);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on a non-truncated malformed response (e.g. no JSON at all)', async () => {
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: 'Sorry, I could not find any schools.', finishReason: 'stop' })]);
      await expect(makeProvider().extractSchools(input)).rejects.toThrow(AiExtractionError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry a 413 (Request Entity Too Large) — it should propagate immediately for the Gemini fallback to take over', async () => {
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: '', ok: false, status: 413 })]);
      await expect(makeProvider().extractSchools(input)).rejects.toThrow(AiExtractionError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry an unrelated 4xx like 400 Bad Request', async () => {
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: '', ok: false, status: 400 })]);
      await expect(makeProvider().extractSchools(input)).rejects.toThrow(AiExtractionError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('bounded 429 rate-limit handling', () => {
    const input = { location: 'Amman', requestedCount: 5, requiredFields: ['phone'] };
    const success = () => groqHttpResponse({ content: JSON.stringify({ schools: [{ name: 'Recovered School' }] }) });

    it('retries transparently and succeeds after a single 429', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: '', ok: false, status: 429 }), success()]);

      const result = await makeProvider('key', {}, sleepSpy).extractSchools(input);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.schools[0].name).toBe('Recovered School');
      expect(sleepSpy).toHaveBeenCalledTimes(1);
    });

    it('retries transparently and succeeds after two consecutive 429s', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: '', ok: false, status: 429 }),
        groqHttpResponse({ content: '', ok: false, status: 429 }),
        success(),
      ]);

      const result = await makeProvider('key', {}, sleepSpy).extractSchools(input);

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result.schools[0].name).toBe('Recovered School');
      expect(sleepSpy).toHaveBeenCalledTimes(2);
    });

    it('gives up after exhausting its bounded retry limit (never an infinite loop)', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: '', ok: false, status: 429 }),
        groqHttpResponse({ content: '', ok: false, status: 429 }),
        groqHttpResponse({ content: '', ok: false, status: 429 }),
        success(), // would succeed on a 4th try, but retries must be bounded — this must never be reached
      ]);

      await expect(makeProvider('key', {}, sleepSpy).extractSchools(input)).rejects.toThrow(AiExtractionError);
      expect(fetchSpy).toHaveBeenCalledTimes(3); // exactly the bound — the 4th (would-succeed) response is never fetched
      expect(sleepSpy).toHaveBeenCalledTimes(2); // waits between attempts 1->2 and 2->3, none after the final failed attempt
    });

    it('respects a numeric Retry-After header instead of the default backoff', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: '', ok: false, status: 429, headers: { 'retry-after': '7' } }), success()]);

      await makeProvider('key', {}, sleepSpy).extractSchools(input);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledWith(7000);
    });

    it('falls back to reading the wait duration from Groq\'s own error message when no header is present', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({
          content: '',
          ok: false,
          status: 429,
          bodyText: '{"error":{"message":"Rate limit reached ... Please try again in 5.5s. Need more tokens?"}}',
        }),
        success(),
      ]);

      await makeProvider('key', {}, sleepSpy).extractSchools(input);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledWith(5500);
    });

    it('falls back to a fixed conservative backoff when no retry-timing information is available at all', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: '', ok: false, status: 429 }), success()]);

      await makeProvider('key', {}, sleepSpy).extractSchools(input);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const waitedMs = sleepSpy.mock.calls[0][0];
      expect(typeof waitedMs).toBe('number');
      expect(waitedMs).toBeGreaterThan(0);
      expect(waitedMs).toBeLessThanOrEqual(60_000);
    });

    it('caps an unreasonably large Retry-After value rather than blocking indefinitely', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: '', ok: false, status: 429, headers: { 'retry-after': '999999' } }), success()]);

      await makeProvider('key', {}, sleepSpy).extractSchools(input);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledWith(60_000);
    });

    it('does not treat 429 as a truncation issue — the compact-retry prompt is not used for rate-limit retries', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: '', ok: false, status: 429 }), success()]);

      await makeProvider('key', {}, sleepSpy).extractSchools(input);

      const retryBody = JSON.parse(fetchSpy.mock.calls[1][1].body);
      expect(retryBody.messages[0].content).not.toMatch(/completely closed/i);
    });
  });

  describe('batching large requests (Groq rejects an oversized single request with 413 Request Entity Too Large)', () => {
    const schoolNamed = (name: string) => JSON.stringify({ schools: [{ name }] });

    it('does not split a request at or below the configured batch size (single call)', async () => {
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: JSON.stringify({ schools: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }) })]);
      const result = await makeProvider('key', { groqBatchSize: 5 }).extractSchools({ location: 'Amman', requestedCount: 3, requiredFields: ['phone'] });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.schools).toHaveLength(3);
    });

    it('transparently splits a request above the batch size into multiple sequential calls and merges the results', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: JSON.stringify({ schools: [{ name: 'School 1' }, { name: 'School 2' }] }) }),
        groqHttpResponse({ content: JSON.stringify({ schools: [{ name: 'School 3' }] }) }),
      ]);

      const result = await makeProvider('key', { groqBatchSize: 2 }).extractSchools({ location: 'Amman', requestedCount: 3, requiredFields: ['phone'] });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.schools.map((s) => s.name)).toEqual(['School 1', 'School 2', 'School 3']);

      // Each sub-batch must ask for no more than the configured batch size.
      const firstBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(firstBody.messages[0].content).toContain('up to 2 schools');
      const secondBody = JSON.parse(fetchSpy.mock.calls[1][1].body);
      expect(secondBody.messages[0].content).toContain('up to 1 schools');
    });

    it('passes already-found names as excludeNames to the next batch to reduce duplicate results', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: schoolNamed('School 1') }),
        groqHttpResponse({ content: schoolNamed('School 2') }),
      ]);

      await makeProvider('key', { groqBatchSize: 1 }).extractSchools({ location: 'Amman', requestedCount: 2, requiredFields: ['phone'] });

      const secondBody = JSON.parse(fetchSpy.mock.calls[1][1].body);
      expect(secondBody.messages[0].content).toContain('School 1');
    });

    it('stops early (without erroring) once a batch returns no new schools', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: schoolNamed('Only School') }),
        groqHttpResponse({ content: JSON.stringify({ schools: [] }) }),
      ]);

      const result = await makeProvider('key', { groqBatchSize: 1 }).extractSchools({ location: 'Amman', requestedCount: 3, requiredFields: ['phone'] });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.schools).toHaveLength(1);
    });

    it('keeps already-found schools instead of discarding them if a later batch fails (non-retryable status)', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: schoolNamed('Found School') }),
        groqHttpResponse({ content: '', ok: false, status: 413 }),
      ]);

      const result = await makeProvider('key', { groqBatchSize: 1 }).extractSchools({ location: 'Amman', requestedCount: 3, requiredFields: ['phone'] });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.schools.map((s) => s.name)).toEqual(['Found School']);
    });

    it('keeps already-found schools if a later batch exhausts its 429 retries', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: schoolNamed('Found School') }),
        groqHttpResponse({ content: '', ok: false, status: 429 }),
        groqHttpResponse({ content: '', ok: false, status: 429 }),
        groqHttpResponse({ content: '', ok: false, status: 429 }),
      ]);

      const result = await makeProvider('key', { groqBatchSize: 1 }).extractSchools({ location: 'Amman', requestedCount: 3, requiredFields: ['phone'] });
      expect(fetchSpy).toHaveBeenCalledTimes(4); // 1 (batch 1 success) + 3 (batch 2: 1 initial + 2 retries, all 429)
      expect(result.schools.map((s) => s.name)).toEqual(['Found School']);
    });

    it('merges ALL results when a later batch\'s 429 succeeds on retry, instead of settling for a partial result', async () => {
      const fetchSpy = mockGroqSequence([
        groqHttpResponse({ content: schoolNamed('School 1') }), // batch 1: succeeds
        groqHttpResponse({ content: '', ok: false, status: 429 }), // batch 2: rate-limited...
        groqHttpResponse({ content: schoolNamed('School 2') }), // ...then succeeds on retry
      ]);

      const result = await makeProvider('key', { groqBatchSize: 1 }).extractSchools({ location: 'Amman', requestedCount: 2, requiredFields: ['phone'] });

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result.schools.map((s) => s.name)).toEqual(['School 1', 'School 2']);
    });

    it('fails the whole extraction if the very first batch fails (nothing found yet to fall back on)', async () => {
      const fetchSpy = mockGroqSequence([groqHttpResponse({ content: '', ok: false, status: 413 })]);
      await expect(makeProvider('key', { groqBatchSize: 1 }).extractSchools({ location: 'Amman', requestedCount: 3, requiredFields: ['phone'] })).rejects.toThrow(AiExtractionError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('is bounded: never issues more than MAX_BATCHES calls even for a very large requestedCount', async () => {
      const fetchSpy = vi.fn().mockImplementation(async () => groqHttpResponse({ content: JSON.stringify({ schools: [] }) }));
      (global as any).fetch = fetchSpy;

      await makeProvider('key', { groqBatchSize: 1 }).extractSchools({ location: 'Amman', requestedCount: 1000, requiredFields: ['phone'] });
      expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(6);
    });

    it('scales beyond 10: reliably assembles a 20-school result from multiple batches', async () => {
      const responses = Array.from({ length: 4 }, (_, i) =>
        groqHttpResponse({ content: JSON.stringify({ schools: Array.from({ length: 5 }, (_, j) => ({ name: `School ${i * 5 + j + 1}` })) }) })
      );
      const fetchSpy = mockGroqSequence(responses);

      const result = await makeProvider('key', { groqBatchSize: 5 }).extractSchools({ location: 'Amman', requestedCount: 20, requiredFields: ['phone'] });
      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(result.schools).toHaveLength(20);
    });
  });
});
