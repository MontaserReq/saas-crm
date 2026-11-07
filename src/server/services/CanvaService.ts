import prisma from '@/lib/db/prisma';
import { decryptSecret, encryptSecret } from '@/lib/integrations/oauth';
import {
  CANVA_API_BASE,
  CANVA_OAUTH_REVOKE_URL,
  CANVA_OAUTH_TOKEN_URL,
  CANVA_PROVIDER,
  canvaScopesString,
  getCanvaCredentials,
  getCanvaRedirectUri,
} from '@/lib/integrations/canva';
import { canManageIntegrations, requireCurrentIntegrationAuthorization } from '@/lib/integrations/authorization';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import type { UserSession } from '@/types';
import { IntegrationEntitlementService } from './IntegrationEntitlementService';

export type CanvaExportFormat = 'pdf' | 'jpg' | 'png' | 'pptx' | 'gif' | 'mp4' | 'html_bundle' | 'html_standalone' | 'csv';
export type CanvaDesignOwnership = 'any' | 'owned' | 'shared';

type CanvaIntegration = {
  id: string;
  organizationId: string;
  accountEmail: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  metadata: string | null;
};

export type CanvaDesign = {
  id: string;
  title?: string;
  thumbnail?: { url?: string; width?: number; height?: number };
  urls?: { edit_url?: string; view_url?: string };
  updated_at?: number;
  created_at?: number;
  page_count?: number;
  design_types?: string[];
};

async function canManageCanva(user: UserSession) {
  return Boolean(
    user.organizationId &&
    hasPlanFeature(user, 'integrations') &&
    canManageIntegrations(user) &&
    await IntegrationEntitlementService.isEnabledForUser(user, 'CANVA'),
  );
}

async function requireCanvaAccess(user: UserSession) {
  if (!(await canManageCanva(user))) throw new Error('Canva integration is not available for this account.');
  return user.organizationId!;
}

function parseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const value = payload as { code?: unknown; message?: unknown; error?: { code?: unknown; message?: unknown } };
    const message = typeof value.message === 'string' ? value.message : typeof value.error?.message === 'string' ? value.error.message : null;
    const code = typeof value.code === 'string' ? value.code : typeof value.error?.code === 'string' ? value.error.code : null;
    if (message) return `${code ? `[${code}] ` : ''}${message}`.slice(0, 400);
  }
  return fallback;
}

async function readJson(response: Response) {
  return response.json().catch(() => null) as Promise<any>;
}

function expiresAt(expiresIn: unknown) {
  const seconds = typeof expiresIn === 'number' ? expiresIn : typeof expiresIn === 'string' ? Number(expiresIn) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000) : null;
}

export class CanvaService {
  private static readonly refreshLocks = new Map<string, Promise<{ token: string; integration: CanvaIntegration }>>();

  static async canManage(user: UserSession) {
    return canManageCanva(user);
  }

  static async getConnection(user: UserSession) {
    const organizationId = await requireCanvaAccess(user);
    const row = await prisma.canvaConnection.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      select: { id: true, accountEmail: true, tokenExpiresAt: true, metadata: true, updatedAt: true },
    });
    return row
      ? { connected: true, accountEmail: row.accountEmail, tokenExpiresAt: row.tokenExpiresAt?.toISOString() || null, metadata: row.metadata, updatedAt: row.updatedAt.toISOString() }
      : { connected: false, accountEmail: null, tokenExpiresAt: null, metadata: null, updatedAt: null };
  }

  static buildAuthorizationUrl(input: { state: string; codeChallenge: string }) {
    const { clientId, clientSecret } = getCanvaCredentials();
    if (!clientId || !clientSecret) throw new Error('Canva is not configured. Add CANVA_CLIENT_ID and CANVA_CLIENT_SECRET first.');
    const url = new URL('https://www.canva.com/api/oauth/authorize');
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('scope', canvaScopesString());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('state', input.state);
    url.searchParams.set('redirect_uri', getCanvaRedirectUri());
    // Ask Canva to let the user choose the account instead of silently
    // reusing a different Canva session in the same browser.
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  static async connect(user: UserSession, input: { code: string; codeVerifier: string }) {
    const organizationId = await requireCanvaAccess(user);
    const { clientId, clientSecret } = getCanvaCredentials();
    if (!clientId || !clientSecret) throw new Error('Canva is not configured. Add CANVA_CLIENT_ID and CANVA_CLIENT_SECRET first.');
    const body = new URLSearchParams({ grant_type: 'authorization_code', code: input.code, code_verifier: input.codeVerifier, redirect_uri: getCanvaRedirectUri() });
    const tokenResponse = await fetch(CANVA_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    const token = await readJson(tokenResponse);
    if (!tokenResponse.ok || typeof token?.access_token !== 'string') throw new Error(parseError(token, 'Canva authorization failed.'));

    let accountEmail: string | null = null;
    let profileName: string | null = null;
    try {
      const profileResponse = await fetch(`${CANVA_API_BASE}/users/me/profile`, { headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store' });
      const profile = await readJson(profileResponse);
      profileName = typeof profile?.profile?.display_name === 'string' ? profile.profile.display_name : null;
      accountEmail = typeof profile?.profile?.email === 'string' ? profile.profile.email : null;
    } catch { /* Profile is optional; the token is still usable. */ }

    await prisma.$transaction(async (tx) => {
      await requireCurrentIntegrationAuthorization(tx, user.id, organizationId);
      await tx.canvaConnection.upsert({
        where: { organizationId_userId: { organizationId, userId: user.id } },
        create: {
          organizationId,
          userId: user.id,
          accountEmail,
          accessTokenEncrypted: encryptSecret(token.access_token),
          refreshTokenEncrypted: typeof token.refresh_token === 'string' ? encryptSecret(token.refresh_token) : null,
          tokenExpiresAt: expiresAt(token.expires_in),
          scopes: JSON.stringify(typeof token.scope === 'string' ? token.scope.split(' ').filter(Boolean) : []),
          metadata: JSON.stringify({ profileName }),
        },
        update: {
          accountEmail,
          accessTokenEncrypted: encryptSecret(token.access_token),
          ...(typeof token.refresh_token === 'string' ? { refreshTokenEncrypted: encryptSecret(token.refresh_token) } : {}),
          tokenExpiresAt: expiresAt(token.expires_in),
          scopes: JSON.stringify(typeof token.scope === 'string' ? token.scope.split(' ').filter(Boolean) : []),
          metadata: JSON.stringify({ profileName }),
        },
      });
    }, { maxWait: 10000, timeout: 20000 });
  }

  static async disconnect(user: UserSession) {
    const organizationId = await requireCanvaAccess(user);
    const row = await prisma.canvaConnection.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } });
    if (row) {
      const { clientId, clientSecret } = getCanvaCredentials();
      const token = row.refreshTokenEncrypted || row.accessTokenEncrypted;
      if (clientId && clientSecret && token) {
        try {
          const response = await fetch(CANVA_OAUTH_REVOKE_URL, {
            method: 'POST',
            headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: decryptSecret(token) }),
            cache: 'no-store',
          });
          if (!response.ok) console.warn('[canva] remote token revocation failed; removing local connection anyway');
        } catch { console.warn('[canva] remote token revocation was unreachable; removing local connection anyway'); }
      }
    }
    await prisma.$transaction(async (tx) => {
      await requireCurrentIntegrationAuthorization(tx, user.id, organizationId);
      await tx.canvaConnection.deleteMany({ where: { organizationId, userId: user.id } });
    }, { maxWait: 10000, timeout: 20000 });
  }

  private static async integration(user: UserSession): Promise<CanvaIntegration> {
    const organizationId = await requireCanvaAccess(user);
    const row = await prisma.canvaConnection.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } });
    if (!row) throw new Error('Connect Canva before using Canva designs.');
    return row;
  }

  private static async refreshAccessToken(_user: UserSession, integration: CanvaIntegration) {
    if (!integration.refreshTokenEncrypted) throw new Error('The Canva connection expired. Please reconnect Canva.');
    const { clientId, clientSecret } = getCanvaCredentials();
    if (!clientId || !clientSecret) throw new Error('Canva is not configured. Add CANVA_CLIENT_ID and CANVA_CLIENT_SECRET first.');
    const response = await fetch(CANVA_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decryptSecret(integration.refreshTokenEncrypted) }),
      cache: 'no-store',
    });
    const token = await readJson(response);
    if (!response.ok || typeof token?.access_token !== 'string') throw new Error(parseError(token, 'Canva token refresh failed. Please reconnect Canva.'));
    const updated = await prisma.externalIntegration.update({
      where: { id: integration.id },
      data: {
        accessTokenEncrypted: encryptSecret(token.access_token),
        ...(typeof token.refresh_token === 'string' ? { refreshTokenEncrypted: encryptSecret(token.refresh_token) } : {}),
        tokenExpiresAt: expiresAt(token.expires_in),
      },
    });
    return { token: token.access_token, integration: updated };
  }

  private static async accessToken(user: UserSession, row?: CanvaIntegration) {
    const integration = row || await this.integration(user);
    if (integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() > Date.now() + 60_000) return { token: decryptSecret(integration.accessTokenEncrypted), integration };
    const pending = this.refreshLocks.get(integration.id);
    if (pending) return pending;
    const refresh = this.refreshAccessToken(user, integration).finally(() => this.refreshLocks.delete(integration.id));
    this.refreshLocks.set(integration.id, refresh);
    return refresh;
  }

  private static async request<T>(user: UserSession, path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const { token, integration } = await this.accessToken(user);
    const response = await fetch(`${CANVA_API_BASE}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}), Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (response.status === 401 && retry && integration.refreshTokenEncrypted) {
      await this.accessToken(user, { ...integration, tokenExpiresAt: new Date(0) });
      return this.request<T>(user, path, init, false);
    }
    const payload = await readJson(response);
    if (!response.ok) throw new Error(parseError(payload, `Canva request failed with HTTP ${response.status}.`));
    return payload as T;
  }

  static async listDesigns(user: UserSession, input: { query?: string; continuation?: string; ownership?: CanvaDesignOwnership } = {}) {
    const params = new URLSearchParams({ limit: '50', sort_by: 'modified_descending', ownership: input.ownership || 'any' });
    if (input.query?.trim()) params.set('query', input.query.trim().slice(0, 255));
    if (input.continuation?.trim()) params.set('continuation', input.continuation.trim().slice(0, 500));
    const payload = await this.request<{ items?: CanvaDesign[]; continuation?: string }>(user, `/designs?${params.toString()}`);
    return { items: payload.items || [], continuation: payload.continuation || null };
  }

  static async createDesign(user: UserSession, input: { title: string; designType: 'doc' | 'email' | 'presentation' | 'whiteboard' }) {
    const payload = await this.request<{ design?: CanvaDesign }>(user, '/designs', {
      method: 'POST',
      body: JSON.stringify({ type: 'type_and_asset', design_type: { type: 'preset', name: input.designType }, title: input.title.trim().slice(0, 200) }),
    });
    if (!payload.design) throw new Error('Canva did not return the new design.');
    return payload.design;
  }

  static async getExportFormats(user: UserSession, designId: string) {
    const payload = await this.request<{ formats?: Record<string, { page_numbers?: number[] }> }>(user, `/designs/${encodeURIComponent(designId)}/export-formats`);
    return payload.formats || {};
  }

  static async exportDesign(user: UserSession, input: { designId: string; format: CanvaExportFormat; quality?: number; size?: 'a4' | 'a3' | 'letter' | 'legal'; pages?: number[] }) {
    const format: Record<string, unknown> = { type: input.format };
    if (input.format === 'jpg' && input.quality) format.quality = input.quality;
    if (input.format === 'pdf' && input.size) format.size = input.size;
    if (input.pages?.length) format.pages = input.pages;
    const created = await this.request<{ job?: { id?: string } }>(user, '/exports', { method: 'POST', body: JSON.stringify({ design_id: input.designId, format }) });
    const exportId = created.job?.id;
    if (!exportId) throw new Error('Canva did not return an export job.');
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      const result = await this.request<{ job?: { status?: string; urls?: string[]; error?: { code?: string; message?: string } } }>(user, `/exports/${encodeURIComponent(exportId)}`);
      if (result.job?.status === 'success' && result.job.urls?.length) return { urls: result.job.urls, exportId };
      if (result.job?.status === 'failed') throw new Error(parseError(result.job.error, 'Canva export failed.'));
    }
    throw new Error('Canva export is still processing. Please try again shortly.');
  }
}
