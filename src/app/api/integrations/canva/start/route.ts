import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createCanvaPkce, encodeCanvaOAuthState } from '@/lib/integrations/canva';
import { CanvaService } from '@/server/services/CanvaService';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await CanvaService.canManage(user))) return NextResponse.redirect(new URL('/settings/integrations?canva=forbidden', process.env.APP_URL || 'http://localhost:3000'));
  try {
    const { codeVerifier, codeChallenge } = createCanvaPkce();
    const state = encodeCanvaOAuthState({ state: crypto.randomUUID(), codeVerifier, userId: user.id, organizationId: user.organizationId!, issuedAt: Date.now() });
    const response = NextResponse.redirect(CanvaService.buildAuthorizationUrl({ state, codeChallenge }));
    response.cookies.set('codeline_canva_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 10 * 60, path: '/' });
    return response;
  } catch (error) {
    const reason = error instanceof Error ? encodeURIComponent(error.message.slice(0, 160)) : 'not-configured';
    return NextResponse.redirect(new URL(`/settings/integrations?canva=failed&reason=${reason}`, process.env.APP_URL || 'http://localhost:3000'));
  }
}
