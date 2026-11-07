import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { NextResponse } from 'next/server';
import { authenticateMcpAccessToken } from '@/lib/mcp/accessTokens';
import { createMcpServer } from '@/lib/mcp/server';
import { extractBearerToken, mcpError, mcpOriginAllowed, mcpResponseHeaders } from '@/lib/mcp/http';
import { clientIp } from '@/lib/security/api';
import { consumeRateLimit } from '@/lib/security/rateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 512 * 1024;

function rateLimitResponse(request: Request, retryAfterSeconds: number | null, limit: number, remaining: number | null, resetAt: Date | null) {
  return mcpError(request, 429, 'Too many MCP requests', {
    'Retry-After': String(Math.max(1, retryAfterSeconds || 60)),
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining ?? 0)),
    ...(resetAt ? { 'X-RateLimit-Reset': String(Math.floor(resetAt.getTime() / 1000)) } : {}),
  });
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (!mcpOriginAllowed(request)) return mcpError(request, 403, 'Origin is not allowed for MCP access');

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: mcpResponseHeaders(request) });
  }

  const ip = clientIp(request);
  const ipLimit = await consumeRateLimit({ policy: 'mcp', identity: `ip:${ip}`, limit: 240, windowSeconds: 60, failureMode: 'closed' });
  if (!ipLimit.allowed) return rateLimitResponse(request, ipLimit.retryAfterSeconds, ipLimit.limit, ipLimit.remaining, ipLimit.resetAt);

  if (request.method === 'POST') {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return mcpError(request, 413, 'MCP request body is too large');
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) return mcpError(request, 415, 'MCP POST requests must use application/json');
  }

  const rawToken = extractBearerToken(request);
  if (!rawToken) return mcpError(request, 401, 'Bearer MCP access token required', { 'WWW-Authenticate': 'Bearer' });

  const authenticated = await authenticateMcpAccessToken(rawToken);
  if (!authenticated) return mcpError(request, 401, 'Invalid, expired, or revoked MCP access token', { 'WWW-Authenticate': 'Bearer' });

  const tokenLimit = await consumeRateLimit({ policy: 'mcp', identity: `token:${authenticated.token.id}`, limit: 120, windowSeconds: 60, failureMode: 'closed' });
  if (!tokenLimit.allowed) return rateLimitResponse(request, tokenLimit.retryAfterSeconds, tokenLimit.limit, tokenLimit.remaining, tokenLimit.resetAt);

  const server = createMcpServer({ user: authenticated.user, scopes: authenticated.token.scopes });
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless mode is intentional: it works behind load balancers and does
    // not keep an in-memory session map that could cross tenant boundaries.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    // JSON response mode is bounded by MAX_BODY_BYTES and lets us close the
    // per-request transport deterministically instead of retaining a server
    // listener after a stateless request has completed.
    const body = await response.arrayBuffer();
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: mcpResponseHeaders(request, response.headers),
    });
  } catch {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    return mcpError(request, 500, 'MCP request failed');
  }
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS(request: Request) {
  return handleMcpRequest(request);
}
