import { getAiAssistantConfig } from './config';

const REQUEST_TIMEOUT_MS = 20_000;

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Thrown when the requested provider has no API key configured. */
export class AiAssistantUnavailableError extends Error {
  constructor(message = 'AI Assistant is not configured.') {
    super(message);
    this.name = 'AiAssistantUnavailableError';
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Plain Groq chat-completion call (no web-search/compound tools — the
 * assistant only ever reasons over CRM data the server already fetched).
 * Used for cheap/fast intent classification.
 */
export async function callGroqChat(messages: ChatMessage[], maxTokens = 500): Promise<string> {
  const config = getAiAssistantConfig();
  if (!config.groqApiKey) throw new AiAssistantUnavailableError('Groq is not configured.');

  const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.groqApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.groqModel,
      messages,
      temperature: 0.1,
      max_completion_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Groq returned an empty response');
  return content;
}

/**
 * Plain Gemini chat-completion call (no google_search grounding tool).
 * Used only when a tool result needs natural-language summarization.
 */
export async function callGeminiChat(messages: ChatMessage[], maxTokens = 700): Promise<string> {
  const config = getAiAssistantConfig();
  if (!config.geminiApiKey) throw new AiAssistantUnavailableError('Gemini is not configured.');

  // Gemini has no 'system' role — fold any system message into the first turn.
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const turns = messages.filter((m) => m.role !== 'system');
  const contents = turns.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === 0 && systemText ? `${systemText}\n\n${m.content}` : m.content }],
  }));

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens } }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('');
  if (typeof content !== 'string' || !content.trim()) throw new Error('Gemini returned an empty response');
  return content;
}
