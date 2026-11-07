import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { CanvaService } from '@/server/services/CanvaService';

const querySchema = z.object({ designId: z.string().trim().min(1).max(200) });

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await CanvaService.canManage(user))) return NextResponse.json({ error: 'Canva integration is not available.' }, { status: 403 });
  const parsed = querySchema.safeParse({ designId: request.nextUrl.searchParams.get('designId') || '' });
  if (!parsed.success) return NextResponse.json({ error: 'A valid design is required.' }, { status: 400 });
  try {
    return NextResponse.json({ formats: await CanvaService.getExportFormats(user, parsed.data.designId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to read Canva export formats.' }, { status: 400 }); }
}
