import { getAiResearchPlatformSettings } from './researchSettings';
import type { AiResearchProviderConfig } from './researchSettings';
import { AiExtractionError, AiNotConfiguredError } from './types';

export type AiGatewayRole = 'system' | 'user' | 'assistant';
export type AiGatewayMessage = { role: AiGatewayRole; content: string };

export type AiGatewayRequest = {
  messages: AiGatewayMessage[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  providerId?: string;
  purpose?: string;
};

export type AiGatewayResponse = {
  content: string;
  providerId: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
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

function selectProvider(settings: Awaited<ReturnType<typeof getAiResearchPlatformSettings>>, providerId?: string): AiResearchProviderConfig {
  const provider = settings.providers.find((candidate) => candidate.id === providerId) || settings.activeProvider;
  if (!provider || !provider.enabled || !provider.apiKey) throw new AiNotConfiguredError('No enabled AI provider with an API key is configured.');
  if (!provider.model) throw new AiNotConfiguredError(`Provider "${provider.name}" has no model configured.`);
  return provider;
}

async function generateForProvider(provider: AiResearchProviderConfig, request: AiGatewayRequest) {
  if (provider.kind === 'gemini') return generateGemini(provider, request);
  if (provider.kind === 'anthropic') return generateAnthropic(provider, request);
  if (provider.kind === 'openai-responses') return generateResponses(provider, request);
  return generateOpenAICompatible(provider, request);
}

export class UniversalAiGateway {
  static async generate(request: AiGatewayRequest): Promise<AiGatewayResponse> {
    const startedAt = performance.now();
    const settings = await getAiResearchPlatformSettings();
    const requestedProviderId = request.providerId || (request.purpose ? settings.featureProviderIds[request.purpose] : undefined);
    const primary = selectProvider(settings, requestedProviderId);
    const candidates = requestedProviderId
      ? [primary]
      : [primary, ...settings.providers.filter((candidate) => candidate.id !== primary.id && candidate.enabled && candidate.apiKey)];
    let provider = primary;
    let generated: { content: string; usage: any } | null = null;
    let lastError: unknown;
    for (const candidate of candidates) {
      try { provider = candidate; generated = await generateForProvider(candidate, request); break; }
      catch (error) { lastError = error; }
    }
    if (!generated) throw lastError instanceof Error ? lastError : new AiExtractionError('All configured AI providers failed.');
    const usage = generated.usage;
    const inputTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : typeof usage?.input_tokens === 'number' ? usage.input_tokens : typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : null;
    const outputTokens = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : typeof usage?.output_tokens === 'number' ? usage.output_tokens : typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : null;
    const totalTokens = typeof usage?.total_tokens === 'number' ? usage.total_tokens : typeof usage?.totalTokenCount === 'number' ? usage.totalTokenCount : inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;
    return { content: generated.content, providerId: provider.id, model: request.model || provider.model, inputTokens, outputTokens, totalTokens, durationMs: Math.round(performance.now() - startedAt), status: 'SUCCESS' };
  }

  static async generateStructured<T>(request: AiGatewayRequest): Promise<AiGatewayStructuredResponse<T>> {
    const response = await this.generate(request);
    return { ...response, data: parseJson<T>(response.content) };
  }
}
