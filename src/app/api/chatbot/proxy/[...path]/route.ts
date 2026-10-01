import { clientIp, tooManyRequests } from '@/lib/security/api';
import { checkRateLimit, RATE_LIMIT_POLICY_CONFIG } from '@/lib/security/rateLimiter';

const WIDGET_ORIGIN = process.env.CHATBOT_UPSTREAM_ORIGIN;
const MAX_BODY_BYTES = 256 * 1024;
const TIMEOUT_MS = 10_000;

class PayloadTooLargeError extends Error {}

function allowedPaths() {
  return new Set((process.env.CHATBOT_PROXY_ALLOWED_PATHS || '').split(',').map((value) => value.trim()).filter(Boolean));
}

async function readBoundedBody(request: Request): Promise<Uint8Array | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD' || !request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw new PayloadTooLargeError();
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function forward(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  if (!WIDGET_ORIGIN) return new Response('Not Found', { status: 404 });
  const path = `/${params.path.join('/')}`;
  if (!allowedPaths().has(path)) return new Response('Not Found', { status: 404 });
  if (!['GET', 'POST'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
  const policy = RATE_LIMIT_POLICY_CONFIG.chatbot;
  const limited = await checkRateLimit({ policy: 'chatbot', identity: `chatbot-proxy-ip:${clientIp(request)}`, ...policy });
  if (!limited.allowed) {
    return tooManyRequests(limited.retryAfterSeconds ?? policy.windowSeconds, {
      limit: policy.limit,
      remaining: limited.remaining ?? 0,
      resetAt: limited.resetAt?.getTime(),
    });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return new Response('Payload too large', { status: 413 });
  const target = `${WIDGET_ORIGIN.replace(/\/$/, '')}${path}${new URL(request.url).search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  let body: Uint8Array | undefined;
  try {
    body = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return new Response('Payload too large', { status: 413 });
    return new Response('Unable to read request body', { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(target, { method: request.method, headers, body: body as unknown as BodyInit, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return new Response('Chatbot service unavailable', { status: 502 });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: { path: string[] } },
) {
  return forward(request, context);
}

export async function POST(
  request: Request,
  context: { params: { path: string[] } },
) {
  return forward(request, context);
}

export async function PUT() { return new Response('Method Not Allowed', { status: 405 }); }
export async function PATCH() { return new Response('Method Not Allowed', { status: 405 }); }
export async function DELETE() { return new Response('Method Not Allowed', { status: 405 }); }
