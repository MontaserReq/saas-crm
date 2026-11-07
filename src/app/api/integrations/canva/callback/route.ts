import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { decodeCanvaOAuthState } from '@/lib/integrations/canva';
import { CanvaService } from '@/server/services/CanvaService';

function redirectToSettings(query: string) {
  return NextResponse.redirect(new URL(`/settings/integrations?${query}`, process.env.APP_URL || 'http://localhost:3000'));
}

export async function GET(request: NextRequest) {
  const responseCookie = request.cookies.get('codeline_canva_oauth_state')?.value;
  const returnedState = request.nextUrl.searchParams.get('state');
  // The signed state contains the PKCE verifier and tenant binding. Prefer
  // the fresh value returned by Canva; use the short-lived httpOnly cookie as
  // a fallback when a browser drops the returned value during a local redirect.
  // The authenticated user and organization checks below still remain
  // mandatory, so this does not turn the callback into a sessionless flow.
  const returnedStateData = decodeCanvaOAuthState(returnedState);
  const state = returnedStateData || decodeCanvaOAuthState(responseCookie);
  const user = await getCurrentUser();
  const code = request.nextUrl.searchParams.get('code');
  if (!state || !user || (returnedState && !returnedStateData) || state.userId !== user.id || state.organizationId !== user.organizationId) {
    return redirectToSettings('canva=failed&reason=invalid-state');
  }
  if (request.nextUrl.searchParams.get('error')) return redirectToSettings('canva=cancelled');
  if (!code) return redirectToSettings('canva=failed&reason=missing-code');
  try {
    await CanvaService.connect(user, { code, codeVerifier: state.codeVerifier });
    const response = redirectToSettings('canva=connected');
    response.cookies.delete('codeline_canva_oauth_state');
    return response;
  } catch (error) {
    const reason = encodeURIComponent(error instanceof Error ? error.message.slice(0, 160) : 'connection-failed');
    const response = redirectToSettings(`canva=failed&reason=${reason}`);
    response.cookies.delete('codeline_canva_oauth_state');
    return response;
  }
}
