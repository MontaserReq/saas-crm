import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getAiProvider, getAiResearchConfig } from '@/lib/ai';
import { GeminiProvider } from '@/lib/ai/GeminiProvider';
import { GroqProvider } from '@/lib/ai/GroqProvider';
import { FallbackAiProvider } from '@/lib/ai/FallbackAiProvider';
import { AiExtractionError, AiNotConfiguredError } from '@/lib/ai/types';

describe('AI School Research: Groq completion-token budget config', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults GROQ_MAX_COMPLETION_TOKENS to a value safely below a small account\'s observed 8000 TPM ceiling — regression guard for the 413 Request Entity Too Large bug', () => {
    delete process.env.GROQ_MAX_COMPLETION_TOKENS;
    const config = getAiResearchConfig();
    expect(config.groqMaxCompletionTokens).toBeLessThanOrEqual(6000);
    expect(config.groqMaxCompletionTokens).toBeGreaterThan(0);
  });

  it('respects an explicit GROQ_MAX_COMPLETION_TOKENS override', () => {
    process.env.GROQ_MAX_COMPLETION_TOKENS = '1500';
    expect(getAiResearchConfig().groqMaxCompletionTokens).toBe(1500);
  });

  it('falls back to the default for an invalid GROQ_MAX_COMPLETION_TOKENS value', () => {
    process.env.GROQ_MAX_COMPLETION_TOKENS = 'not-a-number';
    expect(getAiResearchConfig().groqMaxCompletionTokens).toBeGreaterThan(0);
  });
});

describe('AI School Research: provider selection (AI_PROVIDER env var)', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to Gemini only when AI_PROVIDER is unset', () => {
    delete process.env.AI_PROVIDER;
    const provider = getAiProvider();
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('defaults to Gemini only for any unrecognized AI_PROVIDER value', () => {
    process.env.AI_PROVIDER = 'openai';
    const provider = getAiProvider();
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('wraps Groq with a Gemini fallback when AI_PROVIDER=groq', () => {
    process.env.AI_PROVIDER = 'groq';
    const provider = getAiProvider();
    expect(provider).toBeInstanceOf(FallbackAiProvider);
  });

  it('is case-insensitive for AI_PROVIDER=GROQ', () => {
    process.env.AI_PROVIDER = 'GROQ';
    const provider = getAiProvider();
    expect(provider).toBeInstanceOf(FallbackAiProvider);
  });
});

describe('AI School Research: FallbackAiProvider (Groq -> Gemini)', () => {
  const input = { location: 'Amman', requestedCount: 5, requiredFields: ['phone'] };

  it('returns the primary result directly when the primary succeeds (fallback never called)', async () => {
    const primary = { name: 'groq', extractSchools: vi.fn().mockResolvedValue({ schools: [{ name: 'Primary School' }] }) } as any;
    const fallback = { name: 'gemini', extractSchools: vi.fn() } as any;
    const provider = new FallbackAiProvider(primary, fallback);

    const result = await provider.extractSchools(input);
    expect(result.schools[0].name).toBe('Primary School');
    expect(fallback.extractSchools).not.toHaveBeenCalled();
  });

  it('falls back to Gemini when Groq is unconfigured', async () => {
    const primary = { name: 'groq', extractSchools: vi.fn().mockRejectedValue(new AiNotConfiguredError('Groq not configured')) } as any;
    const fallback = { name: 'gemini', extractSchools: vi.fn().mockResolvedValue({ schools: [{ name: 'Fallback School' }] }) } as any;
    const provider = new FallbackAiProvider(primary, fallback);

    const result = await provider.extractSchools(input);
    expect(result.schools[0].name).toBe('Fallback School');
    expect(fallback.extractSchools).toHaveBeenCalledWith(input);
  });

  it('falls back to Gemini when Groq fails (rate limit / provider error / invalid output)', async () => {
    const primary = { name: 'groq', extractSchools: vi.fn().mockRejectedValue(new AiExtractionError('Groq returned status 429')) } as any;
    const fallback = { name: 'gemini', extractSchools: vi.fn().mockResolvedValue({ schools: [{ name: 'Fallback School' }] }) } as any;
    const provider = new FallbackAiProvider(primary, fallback);

    const result = await provider.extractSchools(input);
    expect(result.schools[0].name).toBe('Fallback School');
  });

  it('throws AiNotConfiguredError (never fabricates data) when both providers are unconfigured', async () => {
    const primary = { name: 'groq', extractSchools: vi.fn().mockRejectedValue(new AiNotConfiguredError()) } as any;
    const fallback = { name: 'gemini', extractSchools: vi.fn().mockRejectedValue(new AiNotConfiguredError()) } as any;
    const provider = new FallbackAiProvider(primary, fallback);

    await expect(provider.extractSchools(input)).rejects.toThrow(AiNotConfiguredError);
  });

  it('throws a combined AiExtractionError (never fabricates data) when both providers fail', async () => {
    const primary = { name: 'groq', extractSchools: vi.fn().mockRejectedValue(new AiExtractionError('groq boom')) } as any;
    const fallback = { name: 'gemini', extractSchools: vi.fn().mockRejectedValue(new AiExtractionError('gemini boom')) } as any;
    const provider = new FallbackAiProvider(primary, fallback);

    await expect(provider.extractSchools(input)).rejects.toThrow(AiExtractionError);
    await expect(provider.extractSchools(input)).rejects.toThrow(/groq boom/);
    await expect(provider.extractSchools(input)).rejects.toThrow(/gemini boom/);
  });

  it('does not swallow an unexpected (non-provider) error from the primary by falling back silently', async () => {
    const boom = new TypeError('unexpected bug');
    const primary = { name: 'groq', extractSchools: vi.fn().mockRejectedValue(boom) } as any;
    const fallback = { name: 'gemini', extractSchools: vi.fn() } as any;
    const provider = new FallbackAiProvider(primary, fallback);

    await expect(provider.extractSchools(input)).rejects.toThrow(TypeError);
    expect(fallback.extractSchools).not.toHaveBeenCalled();
  });
});
