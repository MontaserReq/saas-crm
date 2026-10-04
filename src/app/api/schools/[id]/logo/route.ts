import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import prisma from '@/lib/db/prisma';
import { getStorageProvider } from '@/lib/storage';
import { ProposalService } from '@/server/services/ProposalService';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { parseBoundedMultipart, uploadErrorResponse, UPLOAD_LIMITS } from '@/lib/security/multipart';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!user.organizationId) return new NextResponse('Organization context required', { status: 403 });
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return new NextResponse('Forbidden', { status: 403 });

    const school = await prisma.school.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
      select: { logoKey: true, logoProvider: true },
    });

    if (!school || !school.logoKey) {
      return new NextResponse('Logo Not Found', { status: 404 });
    }

    const storage = getStorageProvider(school.logoProvider as any);
    if (/\.svg$/i.test(school.logoKey)) return new NextResponse('Unsupported image format', { status: 415 });
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
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
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
    const originError = rejectUntrustedMutation(request);
    if (originError) return originError;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.organizationId) return NextResponse.json({ success: false, error: 'Organization context required' }, { status: 403 });

    const parts = await parseBoundedMultipart(request, UPLOAD_LIMITS.logo);
    const filePart = parts.find((part) => part.name === 'logo' && part.filename !== undefined);
    const proposalId = parts.find((part) => part.name === 'proposalId' && part.filename === undefined)?.data.toString('utf8') || undefined;

    if (!filePart) {
      return NextResponse.json({ success: false, error: 'No logo file provided' }, { status: 400 });
    }

    const result = await ProposalService.uploadSchoolLogo(
      user,
      params.id,
      filePart.data,
      filePart.filename || 'logo',
      filePart.contentType || 'image/png',
      proposalId
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    const resourceError = uploadErrorResponse(err);
    if (resourceError) return resourceError;
    console.error('School logo upload error:', err);
    return NextResponse.json({ success: false, error: 'Unable to upload logo' }, { status: 500 });
  }
}
