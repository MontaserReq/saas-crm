import { UniversalAiGateway } from '@/lib/ai/gateway';
import { AiNotConfiguredError } from '@/lib/ai/types';

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

/**
 * Plain Groq chat-completion call (no web-search/compound tools — the
 * assistant only ever reasons over CRM data the server already fetched).
 * Used for cheap/fast intent classification.
 */
export async function callGroqChat(messages: ChatMessage[], maxTokens = 500): Promise<string> {
  try {
    return (await UniversalAiGateway.generate({ messages, maxOutputTokens: maxTokens, temperature: 0.1, purpose: 'assistant' })).content;
  } catch (error) {
    if (error instanceof AiNotConfiguredError) throw new AiAssistantUnavailableError(error.message);
    throw error;
  }
}

/**
 * Plain Gemini chat-completion call (no google_search grounding tool).
 * Used only when a tool result needs natural-language summarization.
 */
export async function callGeminiChat(messages: ChatMessage[], maxTokens = 700): Promise<string> {
  try {
    return (await UniversalAiGateway.generate({ messages, maxOutputTokens: maxTokens, temperature: 0.2, purpose: 'assistant' })).content;
  } catch (error) {
    if (error instanceof AiNotConfiguredError) throw new AiAssistantUnavailableError(error.message);
    throw error;
  }
}
