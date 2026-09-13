import { AiProvider } from './types';
import { GeminiProvider } from './GeminiProvider';
import { GroqProvider } from './GroqProvider';
import { createFallbackProvider } from './FallbackAiProvider';
import { getAiResearchConfig } from './config';
import { OnAttemptCallback } from './usage';

export * from './types';
export { getAiResearchConfig } from './config';
export type { AiProviderName, AiResearchConfig } from './config';
export { GeminiProvider } from './GeminiProvider';
export { GroqProvider } from './GroqProvider';
export { FallbackAiProvider, createFallbackProvider } from './FallbackAiProvider';
export type { ResearchUsage, ResearchAttemptStatus, ResearchProvider, OnAttemptCallback, JobUsageSummary } from './usage';
export { sanitizeErrorMessage } from './usage';

/**
 * Provider factory, environment-driven via AI_PROVIDER.
 * - AI_PROVIDER=groq  -> Groq (web-search compound model) with Gemini as an
 *   automatic fallback if Groq is unconfigured, unavailable, rate-limited,
 *   or fails.
 * - anything else (default) -> Gemini only, unchanged from before.
 *
 * @param onAttempt Optional callback installed on the provider chain. Called
 *   after every individual HTTP request (success or failure) with usage data.
 *   The callback must never throw — any errors it raises are silently swallowed
 *   by the provider to protect research results.
 */
export function getAiProvider(onAttempt?: OnAttemptCallback): AiProvider {
  const config = getAiResearchConfig();

  if (config.aiProvider === 'groq') {
    const groq = new GroqProvider(config, undefined, onAttempt);
    // createFallbackProvider builds Gemini with isFallback=true
    return createFallbackProvider(groq, config, onAttempt);
  }

  return new GeminiProvider(config, onAttempt, false);
}
