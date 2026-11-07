import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { CanvaService } from '@/server/services/CanvaService';

const createSchema = z.object({ title: z.string().trim().min(1).max(200), designType: z.enum(['doc', 'email', 'presentation', 'whiteboard']) });
const listSchema = z.object({ query: z.string().trim().max(255).optional(), continuation: z.string().trim().max(500).optional(), ownership: z.enum(['any', 'owned', 'shared']).default('any') });

async function authorized() {
  const user = await getCurrentUser();
  return user && (await CanvaService.canManage(user)) ? user : null;
}

export async function GET(request: NextRequest) {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: 'Canva integration is not available.' }, { status: 403 });
  try {
    const parsed = listSchema.parse({
      query: request.nextUrl.searchParams.get('query') || undefined,
      continuation: request.nextUrl.searchParams.get('continuation') || undefined,
      ownership: request.nextUrl.searchParams.get('ownership') || 'any',
    });
    return NextResponse.json(await CanvaService.listDesigns(user, parsed));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load Canva designs.' }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: 'Canva integration is not available.' }, { status: 403 });
  try { const input = createSchema.parse(await request.json()); return NextResponse.json({ design: await CanvaService.createDesign(user, input) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create Canva design.' }, { status: 400 }); }
}
