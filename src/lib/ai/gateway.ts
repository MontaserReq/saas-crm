import { getAiResearchPlatformSettings } from './researchSettings';
import type { AiResearchProviderConfig } from './researchSettings';
import { AiExtractionError, AiNotConfiguredError } from './types';
import prisma from '@/lib/db/prisma';
import { sanitizeErrorMessage } from './usage';

export type AiGatewayRole = 'system' | 'user' | 'assistant';
export type AiGatewayMessage = { role: AiGatewayRole; content: string };
export type AiGatewayTool = { name: string; description?: string; parameters: Record<string, unknown> };
export type AiGatewayToolCall = { id: string; name: string; arguments: string };

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
  tools?: AiGatewayTool[];
  toolChoice?: 'auto' | 'none' | 'required';
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
  toolCalls?: AiGatewayToolCall[];
  status: 'SUCCESS';
};

export type AiGatewayStructuredResponse<T> = AiGatewayResponse & { data: T };
export type AiGatewayStreamChunk = { content: string; providerId: string; model: string; done: boolean };
export type AiEmbeddingRequest = { input: string | string[]; model?: string; providerId?: string; purpose?: string; organizationId?: string; userId?: string };
export type AiEmbeddingResponse = { embeddings: number[][]; providerId: string; model: string; inputTokens: number | null; durationMs: number; estimatedCostUsd: number | null; status: 'SUCCESS' };

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

function normalizedToolCalls(value: unknown): AiGatewayToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: any, index) => {
    const name = item?.function?.name || item?.name;
    if (typeof name !== 'string' || !name) return [];
    const args = item?.function?.arguments ?? item?.arguments ?? item?.input ?? {};
    return [{ id: String(item?.id || `tool-${index + 1}`), name, arguments: typeof args === 'string' ? args : JSON.stringify(args) }];
  });
}

function openAiTools(request: AiGatewayRequest) {
  return request.tools?.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
}

function responsesTools(request: AiGatewayRequest) {
  return request.tools?.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters }));
}

function anthropicTools(request: AiGatewayRequest) {
  return request.tools?.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters }));
}

function geminiTools(request: AiGatewayRequest) {
  return request.tools?.length ? [{ functionDeclarations: request.tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }] : undefined;
}

async function generateOpenAICompatible(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any; toolCalls?: AiGatewayToolCall[] }> {
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
      ...(request.tools?.length ? { tools: openAiTools(request), tool_choice: request.toolChoice || 'auto' } : {}),
    }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const content = typeof payload?.choices?.[0]?.message?.content === 'string' ? payload.choices[0].message.content : '';
  const toolCalls = normalizedToolCalls(payload?.choices?.[0]?.message?.tool_calls);
  if (!content.trim() && !toolCalls.length) throw new AiExtractionError(`${provider.name} returned an empty response`);
  return { content, usage: payload?.usage, toolCalls };
}

async function generateResponses(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any; toolCalls?: AiGatewayToolCall[] }> {
  const response = await requestWithTimeout(`${providerBaseUrl(provider)}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}`, ...(provider.customHeaders || {}) },
    body: JSON.stringify({ model: request.model || provider.model, input: providerMessages(request.messages), temperature: request.temperature ?? provider.temperature ?? 0.2, max_output_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096, ...(request.tools?.length ? { tools: responsesTools(request) } : {}) }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const content = typeof payload?.output_text === 'string'
    ? payload.output_text
    : Array.isArray(payload?.output) ? payload.output.flatMap((item: any) => item?.content || []).map((item: any) => item?.text || '').join('') : '';
  const toolCalls = normalizedToolCalls(Array.isArray(payload?.output) ? payload.output.filter((item: any) => item?.type === 'function_call') : []);
  if (!content.trim() && !toolCalls.length) throw new AiExtractionError(`${provider.name} returned an empty response`);
  return { content, usage: payload?.usage, toolCalls };
}

async function generateAnthropic(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any; toolCalls?: AiGatewayToolCall[] }> {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n');
  const messages = request.messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role, content: message.content }));
  const response = await requestWithTimeout(`${providerBaseUrl(provider)}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey || '', 'anthropic-version': '2023-06-01', ...(provider.customHeaders || {}) },
    body: JSON.stringify({ model: request.model || provider.model, max_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096, temperature: request.temperature ?? provider.temperature ?? 0.2, ...(system ? { system } : {}), messages, ...(request.tools?.length ? { tools: anthropicTools(request), tool_choice: request.toolChoice === 'required' ? { type: 'any' } : request.toolChoice === 'auto' ? { type: 'auto' } : undefined } : {}) }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const content = Array.isArray(payload?.content) ? payload.content.map((item: any) => item?.type === 'text' ? item.text || '' : '').join('') : '';
  const toolCalls = normalizedToolCalls(Array.isArray(payload?.content) ? payload.content.filter((item: any) => item?.type === 'tool_use') : []);
  if (!content.trim() && !toolCalls.length) throw new AiExtractionError(`${provider.name} returned an empty response`);
  return { content, usage: payload?.usage, toolCalls };
}

async function generateGemini(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any; toolCalls?: AiGatewayToolCall[] }> {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n');
  const contents = request.messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
  const base = providerBaseUrl(provider);
  const response = await requestWithTimeout(`${base}/${encodeURIComponent(request.model || provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey || '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(provider.customHeaders || {}) },
    body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents, ...(geminiTools(request) ? { tools: geminiTools(request) } : {}), generationConfig: { temperature: request.temperature ?? provider.temperature ?? 0.2, maxOutputTokens: request.maxOutputTokens || provider.maxOutputTokens || 4096 } }),
  }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const content = parts.map((part: any) => part?.text || '').join('');
  const toolCalls = normalizedToolCalls(parts.filter((part: any) => part?.functionCall).map((part: any) => ({ id: part.functionCall.name, name: part.functionCall.name, arguments: part.functionCall.args })));
  if (!content.trim() && !toolCalls.length) throw new AiExtractionError(`${provider.name} returned an empty response`);
  return { content, usage: payload?.usageMetadata, toolCalls };
}

async function generateCustomHttp(provider: AiResearchProviderConfig, request: AiGatewayRequest): Promise<{ content: string; usage: any; toolCalls?: AiGatewayToolCall[] }> {
  if (!provider.baseUrl) throw new AiNotConfiguredError(`Provider "${provider.name}" has no endpoint configured.`);
  const response = await requestWithTimeout(provider.baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey || ''}`, ...(provider.customHeaders || {}) },
    body: JSON.stringify({
      model: request.model || provider.model,
      messages: providerMessages(request.messages),
      temperature: request.temperature ?? provider.temperature ?? 0.2,
      max_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096,
      ...(request.tools?.length ? { tools: openAiTools(request), tool_choice: request.toolChoice || 'auto' } : {}),
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
  const toolCalls = normalizedToolCalls(payload?.tool_calls || payload?.choices?.[0]?.message?.tool_calls);
  if ((typeof content !== 'string' || !content.trim()) && !toolCalls.length) throw new AiExtractionError(`${provider.name} returned no text at the configured response path`);
  return { content: typeof content === 'string' ? content : '', usage: payload?.usage, toolCalls };
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

async function* ssePayloads(response: Response): AsyncGenerator<any> {
  if (!response.body) {
    const text = await response.text();
    if (text.trim()) yield JSON.parse(text);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parseEvents = async function* (flush = false): AsyncGenerator<any> {
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = flush ? '' : (parts.pop() || '');
    for (const event of parts) {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
      if (!data || data === '[DONE]') continue;
      try { yield JSON.parse(data); } catch { /* Ignore keep-alive or malformed SSE frames. */ }
    }
  };
  while (true) {
    const next = await reader.read();
    buffer += decoder.decode(next.value || new Uint8Array(), { stream: !next.done });
    for await (const payload of parseEvents(next.done)) yield payload;
    if (next.done) break;
  }
}

function streamText(payload: any, kind: AiResearchProviderConfig['kind']): string {
  if (kind === 'anthropic') return payload?.type === 'content_block_delta' ? String(payload?.delta?.text || '') : '';
  if (kind === 'openai-responses') return payload?.type === 'response.output_text.delta' ? String(payload?.delta || '') : '';
  if (kind === 'gemini') return payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';
  return payload?.choices?.[0]?.delta?.content || '';
}

async function* streamProvider(provider: AiResearchProviderConfig, request: AiGatewayRequest): AsyncGenerator<string> {
  let url = '';
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: Record<string, unknown>;
  if (provider.kind === 'gemini') {
    const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n');
    const contents = request.messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
    url = `${providerBaseUrl(provider)}/${encodeURIComponent(request.model || provider.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey || '')}`;
    headers = { ...headers, ...(provider.customHeaders || {}) };
    body = { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents, generationConfig: { temperature: request.temperature ?? provider.temperature ?? 0.2, maxOutputTokens: request.maxOutputTokens || provider.maxOutputTokens || 4096 } };
  } else if (provider.kind === 'anthropic') {
    const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n');
    url = `${providerBaseUrl(provider)}/v1/messages`;
    headers = { ...headers, 'x-api-key': provider.apiKey || '', 'anthropic-version': '2023-06-01', ...(provider.customHeaders || {}) };
    body = { model: request.model || provider.model, max_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096, temperature: request.temperature ?? provider.temperature ?? 0.2, ...(system ? { system } : {}), messages: request.messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role, content: message.content })), stream: true };
  } else if (provider.kind === 'openai-responses') {
    url = `${providerBaseUrl(provider)}/responses`;
    headers = { ...headers, Authorization: `Bearer ${provider.apiKey || ''}`, ...(provider.customHeaders || {}) };
    body = { model: request.model || provider.model, input: providerMessages(request.messages), temperature: request.temperature ?? provider.temperature ?? 0.2, max_output_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096, stream: true };
  } else {
    url = provider.kind === 'custom-http' ? provider.baseUrl : `${providerBaseUrl(provider)}/chat/completions`;
    headers = { ...headers, Authorization: `Bearer ${provider.apiKey || ''}`, ...(provider.customHeaders || {}) };
    if (provider.organizationId) headers['OpenAI-Organization'] = provider.organizationId;
    body = { model: request.model || provider.model, messages: providerMessages(request.messages), temperature: request.temperature ?? provider.temperature ?? 0.2, max_tokens: request.maxOutputTokens || provider.maxOutputTokens || 4096, stream: true };
  }
  const response = await requestWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  for await (const payload of ssePayloads(response)) {
    const content = streamText(payload, provider.kind);
    if (content) yield content;
  }
}

async function embedForProvider(provider: AiResearchProviderConfig, request: AiEmbeddingRequest): Promise<{ embeddings: number[][]; inputTokens: number | null }> {
  const input = Array.isArray(request.input) ? request.input : [request.input];
  if (provider.kind === 'gemini') {
    const embeddings: number[][] = [];
    for (const value of input) {
      const response = await requestWithTimeout(`${providerBaseUrl(provider)}/${encodeURIComponent(request.model || provider.model)}:embedContent?key=${encodeURIComponent(provider.apiKey || '')}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(provider.customHeaders || {}) }, body: JSON.stringify({ content: { parts: [{ text: value }] } }) }, timeoutFor(provider));
      if (!response.ok) return responseError(response, provider.name);
      const payload: any = await response.json();
      if (!Array.isArray(payload?.embedding?.values)) throw new AiExtractionError(`${provider.name} returned an invalid embedding`);
      embeddings.push(payload.embedding.values.map((value: unknown) => Number(value)));
    }
    return { embeddings, inputTokens: null };
  }
  if (provider.kind === 'anthropic' || provider.kind === 'custom-http') throw new AiExtractionError(`${provider.name} does not expose a supported embeddings adapter.`);
  const response = await requestWithTimeout(`${providerBaseUrl(provider)}/embeddings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey || ''}`, ...(provider.customHeaders || {}) }, body: JSON.stringify({ model: request.model || provider.model, input }) }, timeoutFor(provider));
  if (!response.ok) return responseError(response, provider.name);
  const payload: any = await response.json();
  const embeddings = Array.isArray(payload?.data) ? payload.data.sort((a: any, b: any) => (a.index || 0) - (b.index || 0)).map((item: any) => item.embedding).filter((item: any) => Array.isArray(item)) : [];
  if (!embeddings.length) throw new AiExtractionError(`${provider.name} returned no embeddings`);
  return { embeddings, inputTokens: typeof payload?.usage?.prompt_tokens === 'number' ? payload.usage.prompt_tokens : null };
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
    const requiredCapabilities = [...new Set([...(request.requiredCapabilities || []), ...(request.tools?.length ? ['tools'] : [])])];
    const primary = selectProvider(settings, requestedProviderId, requiredCapabilities);
    const explicitFallbacks = settings.fallbackProviderIds
      .map((id) => settings.providers.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate && candidate.enabled && candidate.apiKey && supportsCapabilities(candidate, requiredCapabilities) && candidate.id !== primary.id));
    const candidates = [primary, ...explicitFallbacks, ...settings.providers.filter((candidate) => candidate.id !== primary.id && !explicitFallbacks.some((fallback) => fallback.id === candidate.id) && candidate.enabled && candidate.apiKey && supportsCapabilities(candidate, requiredCapabilities))];
    let provider = primary;
    let generated: { content: string; usage: any; toolCalls?: AiGatewayToolCall[] } | null = null;
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
    return { content: generated.content, providerId: provider.id, model: request.model || provider.model, inputTokens, outputTokens, totalTokens, durationMs, estimatedCostUsd: estimateCost(provider, inputTokens, outputTokens), ...(generated.toolCalls?.length ? { toolCalls: generated.toolCalls } : {}), status: 'SUCCESS' };
  }

  static async executeWithTools(request: AiGatewayRequest & { tools: AiGatewayTool[] }): Promise<AiGatewayResponse & { toolCalls: AiGatewayToolCall[] }> {
    if (!request.tools.length) throw new AiExtractionError('At least one tool is required.');
    const response = await this.generate({ ...request, requiredCapabilities: [...new Set([...(request.requiredCapabilities || []), 'tools'])] });
    return { ...response, toolCalls: response.toolCalls || [] };
  }

  static async *stream(request: AiGatewayRequest): AsyncGenerator<AiGatewayStreamChunk> {
    const startedAt = performance.now();
    const settings = await getAiResearchPlatformSettings();
    const requestedProviderId = request.providerId || (request.purpose ? settings.featureProviderIds[request.purpose] : undefined);
    const requiredCapabilities = [...new Set([...(request.requiredCapabilities || []), 'streaming'])];
    const primary = selectProvider(settings, requestedProviderId, requiredCapabilities);
    const fallbackCandidates = settings.fallbackProviderIds.map((id) => settings.providers.find((candidate) => candidate.id === id)).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate && candidate.id !== primary.id && candidate.enabled && candidate.apiKey && supportsCapabilities(candidate, requiredCapabilities)));
    const candidates = [primary, ...fallbackCandidates, ...settings.providers.filter((candidate) => candidate.id !== primary.id && !fallbackCandidates.some((fallback) => fallback.id === candidate.id) && candidate.enabled && candidate.apiKey && supportsCapabilities(candidate, requiredCapabilities))];
    let lastError: unknown;
    for (const provider of candidates) {
      let emitted = false;
      try {
        for await (const content of streamProvider(provider, request)) {
          emitted = true;
          yield { content, providerId: provider.id, model: request.model || provider.model, done: false };
        }
        await recordUsage(request, provider, { status: 'SUCCESS', model: request.model || provider.model, durationMs: Math.round(performance.now() - startedAt) });
        yield { content: '', providerId: provider.id, model: request.model || provider.model, done: true };
        return;
      } catch (error) {
        lastError = error;
        await recordUsage(request, provider, { status: 'FAILED', model: request.model || provider.model, durationMs: Math.round(performance.now() - startedAt), errorMessage: error instanceof Error ? error.message : 'AI stream failed' });
        if (emitted) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new AiExtractionError('All configured AI streaming providers failed.');
  }

  static async getEmbeddings(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    const startedAt = performance.now();
    const settings = await getAiResearchPlatformSettings();
    const requestedProviderId = request.providerId || (request.purpose ? settings.featureProviderIds[request.purpose] : undefined);
    const requiredCapabilities = ['embeddings'];
    const primary = selectProvider(settings, requestedProviderId, requiredCapabilities);
    const candidates = [primary, ...settings.fallbackProviderIds.map((id) => settings.providers.find((candidate) => candidate.id === id)).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate && candidate.id !== primary.id && candidate.enabled && candidate.apiKey && supportsCapabilities(candidate, requiredCapabilities)))];
    let lastError: unknown;
    for (const provider of candidates) {
      try {
        const result = await embedForProvider(provider, request);
        const durationMs = Math.round(performance.now() - startedAt);
        const usageRequest: AiGatewayRequest = { messages: [], purpose: request.purpose, organizationId: request.organizationId, userId: request.userId };
        await recordUsage(usageRequest, provider, { status: 'SUCCESS', model: request.model || provider.model, inputTokens: result.inputTokens, outputTokens: null, durationMs });
        return { embeddings: result.embeddings, providerId: provider.id, model: request.model || provider.model, inputTokens: result.inputTokens, durationMs, estimatedCostUsd: estimateCost(provider, result.inputTokens, null), status: 'SUCCESS' };
      } catch (error) {
        lastError = error;
        const usageRequest: AiGatewayRequest = { messages: [], purpose: request.purpose, organizationId: request.organizationId, userId: request.userId };
        await recordUsage(usageRequest, provider, { status: 'FAILED', model: request.model || provider.model, durationMs: Math.round(performance.now() - startedAt), errorMessage: error instanceof Error ? error.message : 'Embedding request failed' });
      }
    }
    throw lastError instanceof Error ? lastError : new AiExtractionError('All configured embedding providers failed.');
  }

  static async generateStructured<T>(request: AiGatewayRequest): Promise<AiGatewayStructuredResponse<T>> {
    const response = await this.generate({ ...request, requiredCapabilities: [...new Set([...(request.requiredCapabilities || []), 'structured-json'])] });
    return { ...response, data: parseJson<T>(response.content) };
  }
}
