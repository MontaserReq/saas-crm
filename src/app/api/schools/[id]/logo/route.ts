import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import prisma from '@/lib/db/prisma';
import { getStorageProvider } from '@/lib/storage';
import { ProposalService } from '@/server/services/ProposalService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const school = await prisma.school.findUnique({
      where: { id: params.id },
      select: { logoKey: true, logoProvider: true },
    });

    if (!school || !school.logoKey) {
      return new NextResponse('Logo Not Found', { status: 404 });
    }

    const storage = getStorageProvider(school.logoProvider as any);
    if (school.logoProvider === 's3') {
      return NextResponse.redirect(await storage.getDownloadUrl(school.logoKey, 300));
    }

    const buffer = await storage.download(school.logoKey);
    if (!buffer) {
      return new NextResponse('File content not found', { status: 404 });
    }

    let contentType = 'image/png';
    if (school.logoKey.endsWith('.jpg') || school.logoKey.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (school.logoKey.endsWith('.webp')) {
      contentType = 'image/webp';
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('School logo fetch error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    const proposalId = (formData.get('proposalId') as string) || undefined;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No logo file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await ProposalService.uploadSchoolLogo(
      user,
      params.id,
      buffer,
      file.name,
      file.type || 'image/png',
      proposalId
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('School logo upload error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to upload logo' }, { status: 500 });
  }
}