import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { createMcpAccessToken, listMcpAccessTokens, parseMcpScopes } from '@/lib/mcp/accessTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
}).strict();

function requireMcpManagement(user: Awaited<ReturnType<typeof requireAuth>>) {
  if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) throw new Error('Forbidden');
}

export async function GET() {
  try {
    const user = await requireAuth();
    requireMcpManagement(user);
    const organization = await requireOrganizationContext(user);
    const tokens = await listMcpAccessTokens(organization.id, user.id);
    return NextResponse.json({ tokens: tokens.map((token) => ({
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      scopes: token.scopes,
      expiresAt: token.expiresAt?.toISOString() || null,
      lastUsedAt: token.lastUsedAt?.toISOString() || null,
      revokedAt: token.revokedAt?.toISOString() || null,
      createdAt: token.createdAt.toISOString(),
    })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Forbidden' ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Unauthorized' }, { status });
  }
}

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  try {
    const user = await requireAuth();
    requireMcpManagement(user);
    const organization = await requireOrganizationContext(user);
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 32 * 1024) return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid MCP token request' }, { status: 400 });

    const expiresAt = parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const requestedScopes = parseMcpScopes(parsed.data.scopes || ['crm.read']);
    if (!requestedScopes.length || requestedScopes.length !== (parsed.data.scopes || ['crm.read']).length) {
      return NextResponse.json({ error: 'Unsupported MCP scope requested' }, { status: 400 });
    }

    const created = await createMcpAccessToken({ organizationId: organization.id, userId: user.id, name: parsed.data.name, scopes: requestedScopes, expiresAt });
    return NextResponse.json({
      token: created.rawToken,
      warning: 'Store this token now. It will not be shown again.',
      access: {
        id: created.token.id,
        name: created.token.name,
        tokenPrefix: created.token.tokenPrefix,
        scopes: created.token.scopes,
        expiresAt: created.token.expiresAt?.toISOString() || null,
      },
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'Forbidden' ? 403 : message.includes('expiry') || message.includes('scope') ? 400 : 401;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : status === 400 ? message : 'Unauthorized' }, { status });
  }
}
