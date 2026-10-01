import { rateLimit, tooManyRequests } from '@/lib/security/api';

const WIDGET_ORIGIN = process.env.CHATBOT_UPSTREAM_ORIGIN;
const MAX_BODY_BYTES = 256 * 1024;
const TIMEOUT_MS = 10_000;

function allowedPaths() {
  return new Set((process.env.CHATBOT_PROXY_ALLOWED_PATHS || '').split(',').map((value) => value.trim()).filter(Boolean));
}

async function forward(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  if (!WIDGET_ORIGIN) return new Response('Not Found', { status: 404 });
  const path = `/${params.path.join('/')}`;
  if (!allowedPaths().has(path)) return new Response('Not Found', { status: 404 });
  if (!['GET', 'POST'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
  const limited = rateLimit(request, 'chatbot-proxy', 60, 60_000);
  if (!limited.allowed) return tooManyRequests(limited.retryAfter);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return new Response('Payload too large', { status: 413 });
  const target = `${WIDGET_ORIGIN.replace(/\/$/, '')}${path}${new URL(request.url).search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > MAX_BODY_BYTES) return new Response('Payload too large', { status: 413 });

  const response = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

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
