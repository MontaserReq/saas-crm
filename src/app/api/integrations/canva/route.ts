import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { CanvaService } from '@/server/services/CanvaService';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await CanvaService.canManage(user))) return NextResponse.json({ error: 'Canva integration is not available.' }, { status: 403 });
  try { return NextResponse.json(await CanvaService.getConnection(user)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to read Canva connection.' }, { status: 400 }); }
}

export async function DELETE(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await CanvaService.canManage(user))) return NextResponse.json({ error: 'Canva integration is not available.' }, { status: 403 });
  try { await CanvaService.disconnect(user); return NextResponse.json({ success: true }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to disconnect Canva.' }, { status: 400 }); }
}
