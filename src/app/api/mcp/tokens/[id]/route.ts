import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { revokeMcpAccessToken } from '@/lib/mcp/accessTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const organization = await requireOrganizationContext(user);
    const { id } = await params;
    if (!/^[a-z0-9]{16,64}$/i.test(id)) return NextResponse.json({ error: 'Invalid token id' }, { status: 400 });
    const revoked = await revokeMcpAccessToken(organization.id, user.id, id);
    return revoked ? NextResponse.json({ revoked: true }) : NextResponse.json({ error: 'Token not found or already revoked' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
