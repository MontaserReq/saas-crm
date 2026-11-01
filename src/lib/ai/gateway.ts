import { getAiResearchPlatformSettings } from './researchSettings';
import type { AiResearchProviderConfig } from './researchSettings';
import { AiExtractionError, AiNotConfiguredError } from './types';
import prisma from '@/lib/db/prisma';
import { sanitizeErrorMessage } from './usage';

export type AiGatewayRole = 'system' | 'user' | 'assistant';
export type AiGatewayMessage = { role: AiGatewayRole; content: string };

export type AiGatewayRequest = {
  messages: AiGatewayMessage[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  providerId?: string;
  purpose?: string;
  requiredCapabilities?: string[];
  organizationId?: string;
  userId?: string;
};

export type AiGatewayResponse = {
  content: string;
  providerId: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
  estimatedCostUsd: number | null;
  status: 'SUCCESS';
};

export type AiGatewayStructuredResponse<T> = AiGatewayResponse & { data: T };

function timeoutFor(provider: AiResearchProviderConfig): number {
  return Math.min(120_000, Math.max(5_000, provider.timeoutMs || 45_000));
}

function providerBaseUrl(provider: AiResearchProviderConfig): string {
  if (provider.baseUrl) return provider.baseUrl.replace(/\/+$/, '');
  if (provider.kind === 'groq') return 'https://api.groq.com/openai/v1';
  if (provider.kind === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta/models';
  if (provider.kind === 'anthropic') return 'https://api.anthropic.com';
  return '';
}

function parseJson<T>(content: string): T {
  const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(trimmed) as T; } catch (error) { throw new AiExtractionError('AI gateway returned invalid JSON', error); }
}

function providerMessages(messages: AiGatewayMessage[]): AiGatewayMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function estimateCost(provider: AiResearchProviderConfig, inputTokens: number | null, outputTokens: number | null): number | null {
  const inputRate = provider.inputCostPerMillionUsd;
  const outputRate = provider.outputCostPerMillionUsd;
  if (inputRate == null && outputRate == null) return null;
  if (inputTokens == null && outputTokens == null) return null;
  const inputCost = inputTokens != null && inputRate != null ? inputTokens / 1_000_000 * inputRate : 0;
  const outputCost = outputTokens != null && outputRate != null ? outputTokens / 1_000_000 * outputRate : 0;
  return Number((inputCost + outputCost).toFixed(8));
}

async function recordUsage(request: AiGatewayRequest, provider: AiResearchProviderConfig, data: { status: string; model: string; inputTokens?: number | null; outputTokens?: number | null; durationMs: number; errorMessage?: string | null; httpStatus?: number | null }) {
  if (!request.organizationId) return;
  try {
    await prisma.aiGatewayUsageLog.create({ data: {
      organizationId: request.organizationId,
      userId: request.userId || null,
      providerId: provider.id,
      model: data.model,
      purpose: request.purpose || null,
      status: data.status,
      inputTokens: data.inputTokens ?? null,
      outputTokens: data.outputTokens ?? null,
      totalTokens: data.inputTokens != null && data.outputTokens != null ? data.inputTokens + data.outputTokens : null,
      estimatedCostUsd: estimateCost(provider, data.inputTokens ?? null, data.outputTokens ?? null),
      durationMs: data.durationMs,
      httpStatus: data.httpStatus ?? null,
      errorMessage: sanitizeErrorMessage(data.errorMessage),
    } });
  } catch {
    // Telemetry must never break the customer-facing AI request.
  }
}

function readPath(value: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  return path.split('.').filter(Boolean).reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) return (current as Record<string, unknown>)[segment];
    return undefined;
  }, value);
}

async function requestWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' }); }
  finally { clearTimeout(timer); }
}

async function responseError(response: Response, label: string): Promise<never> {
  const body = await response.text().catch(() => '');
  throw new AiExtractionError(`${label} returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
}

async function generateOpenAICompatible(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any }> {
  const url = `${providerBaseUrl(provider)}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` };
  Object.assign(headers, provider.customHeaders || {});
  if (provider.organizationId) headers['OpenAI-Organization'] = provider.organizationId;
  const response = await requestWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: request.model || provider.model,
      messages: providerMessages(request.messages),
      temperature: request.temperature ?? provider.temperature ?? 0.2,
      max_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096,
    }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AiExtractionError(`${provider.name} returned an empty response`);
  return { content, usage: payload?.usage };
}

async function generateResponses(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any }> {
  const response = await requestWithTimeout(`${providerBaseUrl(provider)}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}`, ...(provider.customHeaders || {}) },
    body: JSON.stringify({ model: request.model || provider.model, input: providerMessages(request.messages), temperature: request.temperature ?? provider.temperature ?? 0.2, max_output_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096 }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const content = typeof payload?.output_text === 'string'
    ? payload.output_text
    : Array.isArray(payload?.output) ? payload.output.flatMap((item: any) => item?.content || []).map((item: any) => item?.text || '').join('') : '';
  if (!content.trim()) throw new AiExtractionError(`${provider.name} returned an empty response`);
  return { content, usage: payload?.usage };
}

async function generateAnthropic(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any }> {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n');
  const messages = request.messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role, content: message.content }));
  const response = await requestWithTimeout(`${providerBaseUrl(provider)}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey || '', 'anthropic-version': '2023-06-01', ...(provider.customHeaders || {}) },
    body: JSON.stringify({ model: request.model || provider.model, max_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096, temperature: request.temperature ?? provider.temperature ?? 0.2, ...(system ? { system } : {}), messages }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const content = Array.isArray(payload?.content) ? payload.content.map((item: any) => item?.text || '').join('') : '';
  if (!content.trim()) throw new AiExtractionError(`${provider.name} returned an empty response`);
  return { content, usage: payload?.usage };
}

async function generateGemini(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any }> {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n');
  const contents = request.messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
  const base = providerBaseUrl(provider);
  const response = await requestWithTimeout(`${base}/${encodeURIComponent(request.model || provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey || '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(provider.customHeaders || {}) },
    body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents, generationConfig: { temperature: request.temperature ?? provider.temperature ?? 0.2, maxOutputTokens: request.maxOutputTokens || provider.maxOutputTokens || 4096 } }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const content = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';
  if (!content.trim()) throw new AiExtractionError(`${provider.name} returned an empty response`);
  return { content, usage: payload?.usageMetadata };
}

async function generateCustomHttp(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any }> {
  if (!provider.baseUrl) throw new AiNotConfiguredError(`Provider "${provider.name}" has no endpoint configured.`);
  const response = await requestWithTimeout(provider.baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey || ''}`, ...(provider.customHeaders || {}) },
    body: JSON.stringify({
      model: request.model || provider.model,
      messages: providerMessages(request.messages),
      temperature: request.temperature ?? provider.temperature ?? 0.2,
      max_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096,
    }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const configuredContent = provider.responsePath ? readPath(payload, provider.responsePath) : undefined;
  const content = typeof configuredContent === 'string'
    ? configuredContent
    : typeof payload?.output_text === 'string'
      ? payload.output_text
      : typeof payload?.content === 'string'
        ? payload.content
        : payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AiExtractionError(`${provider.name} returned no text at the configured response path`);
  return { content, usage: payload?.usage };
}

function supportsCapabilities(provider: AiResearchProviderConfig, required: string[] = []): boolean {
  return !provider.capabilities?.length || required.every((capability) => provider.capabilities?.some((configured) => configured === capability));
}

function selectProvider(settings: Awaited<ReturnType<typeof getAiResearchPlatformSettings>>, providerId?: string, requiredCapabilities: string[] = []): AiResearchProviderConfig {
  const requested = settings.providers.find((candidate) => candidate.id === providerId);
  const candidates = [requested, settings.activeProvider, ...settings.providers].filter((candidate, index, all): candidate is AiResearchProviderConfig => Boolean(candidate && candidate.enabled && candidate.apiKey && supportsCapabilities(candidate, requiredCapabilities) && all.findIndex((item) => item?.id === candidate.id) === index));
  const provider = candidates[0];
  if (!provider) throw new AiNotConfiguredError('No enabled AI provider with an API key is configured.');
  if (!provider.model) throw new AiNotConfiguredError(`Provider "${provider.name}" has no model configured.`);
  return provider;
}

async function generateForProvider(provider: AiResearchProviderConfig, request: AiGatewayRequest) {
  if (provider.kind === 'gemini') return generateGemini(provider, request);
  if (provider.kind === 'anthropic') return generateAnthropic(provider, request);
  if (provider.kind === 'openai-responses') return generateResponses(provider, request);
  if (provider.kind === 'custom-http') return generateCustomHttp(provider, request);
  return generateOpenAICompatible(provider, request);
}

async function listModelsForProvider(provider: AiResearchProviderConfig): Promise<string[]> {
  const base = providerBaseUrl(provider);
  if (provider.kind === 'custom-http') return [];
  const url = provider.kind === 'gemini'
    ? `${base}?key=${encodeURIComponent(provider.apiKey || '')}`
    : `${base}/models`;
  const headers: Record<string, string> = { Accept: 'application/json', ...(provider.customHeaders || {}) };
  if (provider.kind === 'anthropic') {
    headers['x-api-key'] = provider.apiKey || '';
    headers['anthropic-version'] = '2023-06-01';
  } else if (provider.kind !== 'gemini') {
    headers.Authorization = `Bearer ${provider.apiKey || ''}`;
    if (provider.organizationId) headers['OpenAI-Organization'] = provider.organizationId;
  }
  const response = await requestWithTimeout(url, { method: 'GET', headers }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const models = provider.kind === 'gemini'
    ? payload?.models?.filter((model: any) => !Array.isArray(model.supportedGenerationMethods) || model.supportedGenerationMethods.includes('generateContent')).map((model: any) => String(model.name || '').replace(/^models\//, '')).filter(Boolean)
    : payload?.data?.map((model: any) => String(model.id || '')).filter(Boolean);
  return Array.isArray(models) ? [...new Set(models)].slice(0, 100) : [];
}

export class UniversalAiGateway {
  static async listModels(providerId: string): Promise<string[]> {
    const settings = await getAiResearchPlatformSettings();
    const provider = settings.providers.find((candidate) => candidate.id === providerId);
    if (!provider || !provider.enabled || !provider.apiKey) throw new AiNotConfiguredError('This AI provider is not enabled or configured.');
    if (!provider.model && provider.kind !== 'custom-http') throw new AiNotConfiguredError(`Provider "${provider.name}" has no model configured.`);
    return listModelsForProvider(provider);
  }

  static async generate(request: AiGatewayRequest): Promise<AiGatewayResponse> {
    const startedAt = performance.now();
    const settings = await getAiResearchPlatformSettings();
    const requestedProviderId = request.providerId || (request.purpose ? settings.featureProviderIds[request.purpose] : undefined);
    const primary = selectProvider(settings, requestedProviderId, request.requiredCapabilities);
    const explicitFallbacks = settings.fallbackProviderIds
      .map((id) => settings.providers.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate && candidate.enabled && candidate.apiKey && supportsCapabilities(candidate, request.requiredCapabilities) && candidate.id !== primary.id));
    const candidates = [primary, ...explicitFallbacks, ...settings.providers.filter((candidate) => candidate.id !== primary.id && !explicitFallbacks.some((fallback) => fallback.id === candidate.id) && candidate.enabled && candidate.apiKey && supportsCapabilities(candidate, request.requiredCapabilities))];
    let provider = primary;
    let generated: { content: string; usage: any } | null = null;
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        provider = candidate;
        generated = await generateForProvider(candidate, request);
        break;
      } catch (error) {
        lastError = error;
        await recordUsage(request, candidate, { status: 'FAILED', model: request.model || candidate.model, durationMs: Math.round(performance.now() - startedAt), errorMessage: error instanceof Error ? error.message : 'AI provider request failed' });
      }
    }
    if (!generated) throw lastError instanceof Error ? lastError : new AiExtractionError('All configured AI providers failed.');
    const usage = generated.usage;
    const inputTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : typeof usage?.input_tokens === 'number' ? usage.input_tokens : typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : null;
    const outputTokens = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : typeof usage?.output_tokens === 'number' ? usage.output_tokens : typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : null;
    const totalTokens = typeof usage?.total_tokens === 'number' ? usage.total_tokens : typeof usage?.totalTokenCount === 'number' ? usage.totalTokenCount : inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;
    const durationMs = Math.round(performance.now() - startedAt);
    await recordUsage(request, provider, { status: 'SUCCESS', model: request.model || provider.model, inputTokens, outputTokens, durationMs });
    return { content: generated.content, providerId: provider.id, model: request.model || provider.model, inputTokens, outputTokens, totalTokens, durationMs, estimatedCostUsd: estimateCost(provider, inputTokens, outputTokens), status: 'SUCCESS' };
  }

  static async generateStructured<T>(request: AiGatewayRequest): Promise<AiGatewayStructuredResponse<T>> {
    const response = await this.generate(request);
    return { ...response, data: parseJson<T>(response.content) };
  }
}
