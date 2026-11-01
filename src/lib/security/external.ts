const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;

/** Read an untrusted upstream response without allowing an unbounded body. */
export async function readLimitedResponseText(response: Response, maxBytes = DEFAULT_MAX_RESPONSE_BYTES): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') || '');
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error('External response is too large.');
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('External response is too large.');
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value as Uint8Array;
      size += chunk.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('External response is too large.');
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decoder.decode(bytes);
}

export async function readLimitedJson<T>(response: Response, maxBytes = DEFAULT_MAX_RESPONSE_BYTES): Promise<T> {
  const text = await readLimitedResponseText(response, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('External response was not valid JSON.');
  }
}

/**
 * Convert untrusted HTML-ish content into bounded plain text before it is
 * placed in an AI prompt or retained as discovery evidence.
 */
export function sanitizeExternalContent(value: string, maxChars = 500_000): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}
