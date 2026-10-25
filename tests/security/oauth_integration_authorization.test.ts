import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSession } from '@/types';

const { auth } = vi.hoisted(() => ({ auth: { user: null as UserSession | null } }));
const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    externalIntegration: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  prismaMock.$queryRaw = vi.fn();
  prismaMock.$transaction = vi.fn(async (operation: any) => operation(prismaMock));
  return { prismaMock };
});
vi.mock('@/lib/auth/session', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));

import { GET as startOAuth } from '@/app/api/integrations/oauth/start/route';
import { GET as finishOAuth } from '@/app/api/integrations/oauth/callback/route';
import { DELETE as disconnectOAuth } from '@/app/api/integrations/[provider]/route';
import { decodeOAuthState, encodeOAuthState, type OAuthState } from '@/lib/integrations/oauth';

const secret = 'oauth-test-secret-that-is-at-least-thirty-two-characters';
const oldEnvironment = { auth: process.env.AUTH_SECRET, origin: process.env.APP_ORIGIN, googleId: process.env.GOOGLE_CLIENT_ID, googleSecret: process.env.GOOGLE_CLIENT_SECRET };
const actor = (overrides: Partial<UserSession> = {}): UserSession => ({ id: 'admin-a', name: 'Admin', email: 'admin@example.test', role: 'ADMIN', roleDisplayName: 'Admin', departmentId: 'dept-a', departmentName: 'Management', organizationId: 'org-a', permissions: ['organization_settings.manage'], planFeatures: ['dashboard', 'integrations'], ...overrides });

describe('organization OAuth authorization', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = secret;
    process.env.APP_ORIGIN = 'https://crm.example.test';
    process.env.GOOGLE_CLIENT_ID = 'synthetic-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'synthetic-client-secret';
    auth.user = null;
    vi.clearAllMocks();
    prismaMock.externalIntegration.findUnique.mockResolvedValue(null);
    prismaMock.externalIntegration.upsert.mockResolvedValue({ id: 'integration-a' });
    prismaMock.externalIntegration.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'org-a' }]);
    prismaMock.organizationMember.findFirst.mockResolvedValue({
      role: { name: 'ADMIN', rolePermissions: [{ permission: { code: 'organization_settings.manage' } }] },
      organization: {
        platformSubscription: {
          status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000), endsAt: null,
          plan: { features: JSON.stringify(['dashboard', 'integrations']), isActive: true },
        },
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      isActive: true,
      isPlatformAdmin: false,
      role: { name: 'ADMIN', rolePermissions: [{ permission: { code: 'organization_settings.manage' } }] },
      userPermissions: [],
    });
  });
  afterEach(() => {
    auth.user = null;
    if (oldEnvironment.auth === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = oldEnvironment.auth;
    if (oldEnvironment.origin === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = oldEnvironment.origin;
    if (oldEnvironment.googleId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = oldEnvironment.googleId;
    if (oldEnvironment.googleSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = oldEnvironment.googleSecret;
    vi.restoreAllMocks();
  });

  it('allows an entitled organization administrator to initiate a signed flow', async () => {
    auth.user = actor();
    const response = await startOAuth(new Request('https://crm.example.test/api/integrations/oauth/start?provider=google&scopes=email'));
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toContain('accounts.google.com');
    expect(response.headers.get('set-cookie')).toContain('codeline_oauth_state=');
  });

  it('rejects ordinary members and plans without integrations before redirecting to a provider', async () => {
    auth.user = actor({ permissions: [] });
    expect((await startOAuth(new Request('https://crm.example.test/api/integrations/oauth/start?provider=google'))).status).toBe(403);
    auth.user = actor({ planFeatures: ['dashboard'] });
    expect((await startOAuth(new Request('https://crm.example.test/api/integrations/oauth/start?provider=google'))).status).toBe(403);
  });

  it('rejects tampered and stale state while preserving user and tenant binding', () => {
    const state: OAuthState = { state: 'random-state', provider: 'google', selected: ['email'], userId: 'admin-a', organizationId: 'org-a', issuedAt: Date.now() };
    const encoded = encodeOAuthState(state);
    expect(decodeOAuthState(encoded)).toEqual(state);
    const [payload, signature] = encoded.split('.');
    const corruptedSignature = Buffer.from(signature, 'base64url');
    corruptedSignature[0] ^= 0x01;
    expect(decodeOAuthState(`${payload}.${corruptedSignature.toString('base64url')}`)).toBeNull();
    const corruptedPayload = Buffer.from(JSON.stringify({ ...state, organizationId: 'org-b' })).toString('base64url');
    expect(decodeOAuthState(`${corruptedPayload}.${signature}`)).toBeNull();
    expect(decodeOAuthState(encodeOAuthState({ ...state, issuedAt: Date.now() - 11 * 60 * 1000 }))).toBeNull();
    expect(decodeOAuthState(encoded)?.organizationId).toBe('org-a');
    expect(decodeOAuthState(encoded)?.userId).toBe('admin-a');
  });

  it('rejects stale, unauthorized, and cross-tenant callbacks before exchanging a code', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not exchange'));
    const state = { state: 'callback-state', provider: 'google' as const, selected: ['email' as const], userId: 'admin-a', organizationId: 'org-a', issuedAt: Date.now() };
    const request = (cookie: string, returnedState = state.state) => new Request(`https://crm.example.test/api/integrations/oauth/callback?code=synthetic-code&state=${returnedState}`, { headers: { cookie: `codeline_oauth_state=${cookie}` } });
    auth.user = null;
    expect((await finishOAuth(request(encodeOAuthState(state)))).headers.get('location')).toContain('/login');
    auth.user = actor({ permissions: [] });
    expect((await finishOAuth(request(encodeOAuthState(state)))).headers.get('location')).toContain('reason=forbidden');
    auth.user = actor({ id: 'admin-b' });
    expect((await finishOAuth(request(encodeOAuthState(state)))).headers.get('location')).toContain('reason=state-user-mismatch');
    auth.user = actor();
    expect((await finishOAuth(request(encodeOAuthState({ ...state, organizationId: 'org-b' })))).headers.get('location')).toContain('reason=organization-mismatch');
    expect((await finishOAuth(request(encodeOAuthState(state), 'different-state'))).headers.get('location')).toContain('reason=invalid-state');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('stores authorized credentials tenant-locally and audits connect or replacement without plaintext tokens', async () => {
    auth.user = actor();
    const state: OAuthState = { state: 'callback-state', provider: 'google', selected: ['email'], userId: 'admin-a', organizationId: 'org-a', issuedAt: Date.now() };
    const callbackRequest = () => new Request(`https://crm.example.test/api/integrations/oauth/callback?code=synthetic-code&state=${state.state}`, { headers: { cookie: `codeline_oauth_state=${encodeOAuthState(state)}` } });
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'plain-access-token', refresh_token: 'plain-refresh-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'admin@example.test' }), { status: 200 }));
    expect((await finishOAuth(callbackRequest())).headers.get('location')).toContain('integration=connected');
    const firstWrite = prismaMock.externalIntegration.upsert.mock.calls[0][0];
    expect(firstWrite.where.organizationId_provider).toEqual({ organizationId: 'org-a', provider: 'GOOGLE' });
    expect(firstWrite.create.accessTokenEncrypted).not.toContain('plain-access-token');
    expect(JSON.stringify(prismaMock.auditLog.create.mock.calls)).not.toContain('plain-access-token');
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'INTEGRATION_CONNECTED', organizationId: 'org-a' }) }));

    fetchSpy.mockRestore();
    prismaMock.externalIntegration.findUnique.mockResolvedValue({ id: 'integration-a' });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'replacement-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await finishOAuth(callbackRequest());
    expect(prismaMock.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'INTEGRATION_REPLACED', organizationId: 'org-a' }) }));
  });

  it('does not modify credentials when provider authorization fails', async () => {
    auth.user = actor();
    const state: OAuthState = { state: 'callback-state', provider: 'google', selected: ['email'], userId: 'admin-a', organizationId: 'org-a', issuedAt: Date.now() };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
    const response = await finishOAuth(new Request(`https://crm.example.test/api/integrations/oauth/callback?code=bad-code&state=${state.state}`, { headers: { cookie: `codeline_oauth_state=${encodeOAuthState(state)}` } }));
    expect(response.headers.get('location')).toContain('reason=token-exchange');
    expect(prismaMock.externalIntegration.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['revoked membership', () => prismaMock.organizationMember.findFirst.mockResolvedValue(null)],
    ['revoked integration permission', () => {
      prismaMock.organizationMember.findFirst.mockResolvedValue({
        role: { name: 'MEMBER', rolePermissions: [] },
        organization: {
          platformSubscription: {
            status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000), endsAt: null,
            plan: { features: JSON.stringify(['dashboard', 'integrations']), isActive: true },
          },
        },
      });
      prismaMock.user.findUnique.mockResolvedValue({ isActive: true, isPlatformAdmin: false, role: { name: 'MEMBER', rolePermissions: [] }, userPermissions: [] });
    }],
    ['lost integrations entitlement', () => {
      prismaMock.organizationMember.findFirst.mockResolvedValue({
        role: { name: 'ADMIN', rolePermissions: [{ permission: { code: 'organization_settings.manage' } }] },
        organization: {
          platformSubscription: {
            status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000), endsAt: null,
            plan: { features: JSON.stringify(['dashboard']), isActive: true },
          },
        },
      });
    }],
  ])('revalidates %s after token exchange and preserves existing credentials', async (_label, revoke) => {
    auth.user = actor();
    revoke();
    const state: OAuthState = { state: 'callback-state', provider: 'google', selected: ['email'], userId: 'admin-a', organizationId: 'org-a', issuedAt: Date.now() };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'unpersisted-access-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const response = await finishOAuth(new Request(`https://crm.example.test/api/integrations/oauth/callback?code=synthetic-code&state=${state.state}`, { headers: { cookie: `codeline_oauth_state=${encodeOAuthState(state)}` } }));
    expect(response.headers.get('location')).toContain('reason=forbidden');
    expect(prismaMock.externalIntegration.upsert).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('disconnects only the authenticated organization credential and audits the event', async () => {
    auth.user = actor();
    prismaMock.externalIntegration.findUnique.mockResolvedValue({ id: 'integration-a' });
    const response = await disconnectOAuth(new Request('https://crm.example.test/api/integrations/google', { method: 'DELETE', headers: { origin: 'https://crm.example.test' } }), { params: Promise.resolve({ provider: 'google' }) });
    expect(response.status).toBe(200);
    expect(prismaMock.externalIntegration.deleteMany).toHaveBeenCalledWith({ where: { id: 'integration-a', organizationId: 'org-a' } });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'INTEGRATION_DISCONNECTED', organizationId: 'org-a' }) }));
  });
});
