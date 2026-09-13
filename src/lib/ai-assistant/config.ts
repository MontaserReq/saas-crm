// Config for the read-only AI Knowledge Assistant. Deliberately separate
// from src/lib/ai/config.ts (AI School Research) even though both read the
// same GROQ_API_KEY/GEMINI_API_KEY — the assistant uses different, cheaper
// plain chat-completion models (no web-search/compound tools), so mixing
// the two configs would blur an intentionally separate feature boundary.
export interface AiAssistantConfig {
  groqApiKey: string | null;
  groqModel: string;
  geminiApiKey: string | null;
  geminiModel: string;
}

export function getAiAssistantConfig(): AiAssistantConfig {
  return {
    groqApiKey: process.env.GROQ_API_KEY || null,
    groqModel: process.env.GROQ_ASSISTANT_MODEL || 'llama-3.1-8b-instant',
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiModel: process.env.GEMINI_ASSISTANT_MODEL || 'gemini-2.0-flash-lite',
  };
}
