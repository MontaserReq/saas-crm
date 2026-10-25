import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getAuthSecret } from '@/lib/auth/config';

export type EmailProvider = 'google' | 'microsoft';
export type EmailScope = 'email' | 'contacts' | 'calendar';

export const EMAIL_SCOPES: Record<EmailProvider, Record<EmailScope, string>> = {
  google: { email: 'https://www.googleapis.com/auth/gmail.send', contacts: 'https://www.googleapis.com/auth/contacts.readonly', calendar: 'https://www.googleapis.com/auth/calendar.events' },
  microsoft: { email: 'Mail.Send', contacts: 'Contacts.Read', calendar: 'Calendars.ReadWrite' },
};

export function isEmailProvider(value: string | null | undefined): value is EmailProvider { return value === 'google' || value === 'microsoft'; }
export function getAppUrl() { return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, ''); }
export function getRedirectUri() { return `${getAppUrl()}/api/integrations/oauth/callback`; }
export function getProviderCredentials(provider: EmailProvider) { return provider === 'google' ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } : { clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET }; }

export function requestedScopes(provider: EmailProvider, requested: string[]) {
  const map = EMAIL_SCOPES[provider];
  const selected = (['email', 'contacts', 'calendar'] as EmailScope[]).filter((item) => requested.includes(item));
  const safeSelection = selected.length ? selected : (['email', 'calendar'] as EmailScope[]);
  const scopes = provider === 'google' ? ['openid', 'email', 'profile', ...safeSelection.map((item) => map[item])] : ['openid', 'profile', 'email', 'offline_access', ...safeSelection.map((item) => map[item])];
  return { selected: safeSelection, scopes: [...new Set(scopes)] };
}

function integrationSecret() { return process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || getAuthSecret(); }
function encryptionKey() { return createHash('sha256').update(integrationSecret()).digest(); }
export function encryptSecret(value: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`; }
export function decryptSecret(value: string) { const [ivValue, tagValue, encryptedValue] = value.split('.'); const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url')); decipher.setAuthTag(Buffer.from(tagValue, 'base64url')); return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8'); }

export type OAuthState = { state: string; provider: EmailProvider; selected: EmailScope[]; userId: string; organizationId: string; issuedAt: number };

export function encodeOAuthState(value: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = createHmac('sha256', integrationSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function decodeOAuthState(value: string | null | undefined, now = Date.now()): OAuthState | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', integrationSecret()).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<OAuthState>;
    if (!isEmailProvider(parsed.provider) || typeof parsed.state !== 'string' || typeof parsed.userId !== 'string' || typeof parsed.organizationId !== 'string' || typeof parsed.issuedAt !== 'number' || !Array.isArray(parsed.selected)) return null;
    if (parsed.issuedAt > now || now - parsed.issuedAt > 10 * 60 * 1000) return null;
    const selected = parsed.selected.filter((scope): scope is EmailScope => scope === 'email' || scope === 'contacts' || scope === 'calendar');
    if (selected.length !== parsed.selected.length) return null;
    return { state: parsed.state, provider: parsed.provider, selected, userId: parsed.userId, organizationId: parsed.organizationId, issuedAt: parsed.issuedAt };
  } catch { return null; }
}
