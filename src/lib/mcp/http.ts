import { NextResponse } from 'next/server';
import { trustsSingleHopProxy } from '@/lib/security/runtimeConfig';

export function extractBearerToken(request: Request): string | null {
  const value = request.headers.get('authorization') || '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1] || null;
}

function configuredOrigins(): Set<string> {
  return new Set((process.env.MCP_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean));
}

export function mcpOriginAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return configuredOrigins().has(origin);
}

export function mcpResponseHeaders(request: Request, headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set('Cache-Control', 'no-store');
  result.set('X-Content-Type-Options', 'nosniff');
  result.set('X-Frame-Options', 'DENY');
  result.set('Referrer-Policy', 'no-referrer');
  result.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (new URL(request.url).protocol === 'https:' || (trustsSingleHopProxy() && request.headers.get('x-forwarded-proto')?.trim().toLowerCase() === 'https')) {
    result.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  result.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, Last-Event-ID');
  result.set('Vary', 'Origin');

  const origin = request.headers.get('origin');
  if (origin && configuredOrigins().has(origin)) {
    result.set('Access-Control-Allow-Origin', origin);
    result.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID');
    result.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  }
  return result;
}

export function mcpError(request: Request, status: number, message: string, extraHeaders?: Record<string, string>): NextResponse {
  const headers = mcpResponseHeaders(request, { 'Content-Type': 'application/json', ...extraHeaders });
  return NextResponse.json({ error: message }, { status, headers });
}
