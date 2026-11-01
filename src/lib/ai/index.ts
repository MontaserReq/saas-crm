import { AiNotConfiguredError, AiProvider } from './types';
import { GeminiProvider } from './GeminiProvider';
import { GroqProvider } from './GroqProvider';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { UniversalResearchProvider } from './UniversalResearchProvider';
import { createFallbackProvider } from './FallbackAiProvider';
import { getAiResearchConfig, getAiResearchConfigFromPlatform } from './config';
import type { AiResearchConfig } from './config';
import { OnAttemptCallback } from './usage';

export * from './types';
export { getAiResearchConfig } from './config';
export { getAiResearchConfigFromPlatform } from './config';
export type { AiProviderName, AiResearchConfig } from './config';
export { GeminiProvider } from './GeminiProvider';
export { GroqProvider } from './GroqProvider';
export { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
export { UniversalResearchProvider } from './UniversalResearchProvider';
export { FallbackAiProvider, createFallbackProvider } from './FallbackAiProvider';
export type { ResearchUsage, ResearchAttemptStatus, ResearchProvider, OnAttemptCallback, JobUsageSummary } from './usage';
export { sanitizeErrorMessage } from './usage';
export { UniversalAiGateway } from './gateway';
export type { AiGatewayMessage, AiGatewayRequest, AiGatewayResponse, AiGatewayStructuredResponse, AiGatewayStreamChunk, AiGatewayTool, AiGatewayToolCall, AiEmbeddingRequest, AiEmbeddingResponse } from './gateway';

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
export function getAiProvider(onAttempt?: OnAttemptCallback, overrideConfig?: AiResearchConfig): AiProvider {
  const config = overrideConfig || getAiResearchConfig();

  if (config.activeProvider && !config.activeProvider.enabled) {
    throw new AiNotConfiguredError(`Provider "${config.activeProvider.name}" is disabled.`);
  }

  if (config.activeProvider?.kind === 'openai-compatible') {
    return new OpenAICompatibleProvider(config.activeProvider, onAttempt);
  }

  if (config.activeProvider && ['openai-responses', 'anthropic', 'custom-http'].includes(config.activeProvider.kind)) {
    return new UniversalResearchProvider(config.activeProvider.id, onAttempt);
  }

  if (config.activeProvider?.kind === 'groq') {
    const groq = new GroqProvider(config, undefined, onAttempt);
    const configuredGemini = config.providers?.find((provider) => provider.kind === 'gemini' && provider.enabled && provider.apiKey);
    if (config.providers && !configuredGemini) return groq;
    return createFallbackProvider(groq, configuredGemini ? { ...config, geminiApiKey: configuredGemini.apiKey, geminiModel: configuredGemini.model } : config, onAttempt);
  }

  if (config.activeProvider?.kind === 'gemini') {
    return new GeminiProvider(config, onAttempt, false);
  }

  if (config.aiProvider === 'groq') {
    const groq = new GroqProvider(config, undefined, onAttempt);
    // createFallbackProvider builds Gemini with isFallback=true
    return createFallbackProvider(groq, config, onAttempt);
  }

  return new GeminiProvider(config, onAttempt, false);
}

export async function getAiProviderFromPlatform(onAttempt?: OnAttemptCallback): Promise<AiProvider> {
  return getAiProvider(onAttempt, await getAiResearchConfigFromPlatform());
}
