import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getAppUrl } from './oauth';

export const CANVA_PROVIDER = 'canva';
export const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
export const CANVA_OAUTH_AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize';
export const CANVA_OAUTH_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
export const CANVA_OAUTH_REVOKE_URL = 'https://api.canva.com/rest/v1/oauth/revoke';
export const CANVA_SCOPES = [
  'profile:read',
  'design:meta:read',
  'design:content:read',
  'design:content:write',
] as const;

export type CanvaOAuthState = {
  state: string;
  codeVerifier: string;
  userId: string;
  organizationId: string;
  issuedAt: number;
};

function integrationSecret() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || process.env.AUTH_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && !secret) throw new Error('INTEGRATION_ENCRYPTION_KEY or AUTH_SECRET is required for Canva in production.');
  return secret || 'development-only-integration-secret';
}

function encode(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = createHmac('sha256', integrationSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function encodeCanvaOAuthState(value: CanvaOAuthState) {
  return encode(value);
}

export function decodeCanvaOAuthState(value: string | null | undefined, now = Date.now()): CanvaOAuthState | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', integrationSecret()).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<CanvaOAuthState>;
    if (typeof parsed.state !== 'string' || typeof parsed.codeVerifier !== 'string' || typeof parsed.userId !== 'string' || typeof parsed.organizationId !== 'string' || typeof parsed.issuedAt !== 'number') return null;
    if (parsed.issuedAt > now || now - parsed.issuedAt > 10 * 60 * 1000) return null;
    return parsed as CanvaOAuthState;
  } catch { return null; }
}

export function getCanvaCredentials() {
  return { clientId: process.env.CANVA_CLIENT_ID?.trim() || '', clientSecret: process.env.CANVA_CLIENT_SECRET?.trim() || '' };
}

export function getCanvaRedirectUri() {
  return process.env.CANVA_REDIRECT_URI?.trim() || `${getAppUrl()}/api/integrations/canva/callback`;
}

export function createCanvaPkce() {
  const codeVerifier = randomBytes(96).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function canvaScopesString() {
  return CANVA_SCOPES.join(' ');
}
