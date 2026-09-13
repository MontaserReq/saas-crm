import { AiExtractionError, AiTruncatedResponseError, SchoolExtractionInput, SchoolExtractionResult, schoolExtractionResultSchema } from './types';

/**
 * Prompt and JSON-parsing logic shared by every provider (Gemini, Groq, ...).
 * Keeping this in one place means every provider is held to the exact same
 * anti-fabrication rules and output schema instructions.
 */
export const FIELD_LABELS: Record<string, string> = {
  phone: 'phone number',
  email: 'email address',
  website: 'official website URL',
  address: 'physical address',
  contactPerson: 'a publicly listed contact person (only if clearly and reliably associated with the school)',
  schoolType: 'school type (PRIVATE, GOVERNMENT, INTERNATIONAL, COMMUNITY, or OTHER)',
};

export function buildExtractionPrompt(input: SchoolExtractionInput): string {
  const fields = (input.requiredFields.length ? input.requiredFields : Object.keys(FIELD_LABELS))
    .map((field) => FIELD_LABELS[field] || field)
    .join(', ');
  const excludeLine = input.excludeNames?.length
    ? `\nDo not repeat these schools already found in this research job: ${input.excludeNames.join(', ')}.`
    : '';

  return `You are a research assistant helping find REAL, publicly verifiable schools using web search.

Task: Find up to ${input.requestedCount} schools located in "${input.location}"${input.area ? `, area/neighborhood "${input.area}"` : ''}${input.schoolType ? `, of type "${input.schoolType}"` : ''}.

For each school, try to determine: name, city, area, and the following requested data: ${fields}.${excludeLine}

STRICT RULES (do not violate):
- Only include schools you can find genuine evidence for via search. NEVER invent a school, phone number, email, website, address, or contact person.
- If a field cannot be verified, set it to null. Do not guess or fabricate.
- For a "contact person", only include one if a specific person is publicly and reliably listed as associated with the school (e.g. on its official website). Otherwise set it to null.
- Prefer, in order: the school's official website, then Google Maps/business listings, then official public social profiles, then other reputable public sources.
- Keep the output compact: add AT MOST 2 short "evidence" entries per school (combine multiple fields under one entry when they came from the same source/page). Each evidence entry needs only a short source label (e.g. "Official Website") and its URL if available. Do not write long descriptions, explanations, or repeat page content.
- Output ONLY a single raw JSON object matching this exact shape, with no markdown code fences, no commentary, and no extra text before or after it:

{
  "schools": [
    {
      "name": string,
      "city": string | null,
      "area": string | null,
      "phone": string | null,
      "email": string | null,
      "website": string | null,
      "schoolType": string | null,
      "address": string | null,
      "contactPerson": string | null,
      "evidence": [ { "field": string, "source": string, "sourceUrl": string | null } ]
    }
  ]
}`;
}

/**
 * Appended to the prompt on a bounded retry after a truncated response, to
 * push the model toward a shorter, fully-closed completion.
 */
export function buildCompactRetryInstruction(): string {
  return '\n\nIMPORTANT — your previous response was cut off before it finished. Return ONLY the required JSON object. Do not include explanations, markdown, reasoning, or additional text. Keep all string values concise. Do not omit required fields. Ensure the JSON is completely closed (every "{", "[" has a matching "}", "]") before finishing.';
}

/**
 * Strips markdown code fences and extracts the first balanced JSON object/array
 * from raw model text. Tracks whether scanning is inside a JSON string literal
 * so a brace/bracket character inside a value (e.g. an address) is never
 * mistaken for structural JSON — this only reads structure, it never invents
 * or repairs missing content.
 */
export function extractJsonPayload(raw: string): unknown {
  const withoutFences = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = withoutFences.search(/[[{]/);
  if (start === -1) throw new AiExtractionError('AI response did not contain JSON');

  const openChar = withoutFences[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;

  for (let i = start; i < withoutFences.length; i++) {
    const char = withoutFences[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === openChar) depth++;
    else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    // The scan reached the end of the text without the opening bracket ever
    // closing — the response was cut off mid-structure (or mid-string),
    // almost always because an output token limit was hit.
    throw new AiTruncatedResponseError();
  }

  const jsonSlice = withoutFences.slice(start, end + 1);
  try {
    return JSON.parse(jsonSlice);
  } catch (err) {
    throw new AiExtractionError('AI response was not valid JSON', err);
  }
}

/** Parses raw model text into a schema-validated extraction result, or throws AiExtractionError. */
export function parseExtractionResponseText(text: string | undefined | null): SchoolExtractionResult {
  if (!text || !text.trim()) {
    throw new AiExtractionError('AI provider returned an empty response');
  }

  const parsedJson = extractJsonPayload(text);
  const normalized = Array.isArray(parsedJson) ? { schools: parsedJson } : parsedJson;
  const result = schoolExtractionResultSchema.safeParse(normalized);
  if (!result.success) {
    throw new AiExtractionError(`AI response failed schema validation: ${result.error.issues.map((i) => i.message).join('; ')}`);
  }

  return result.data;
}
