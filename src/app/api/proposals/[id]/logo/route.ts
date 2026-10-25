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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!user.organizationId) return new NextResponse('Organization context required', { status: 403 });

    if (!hasPermission(user, PERMISSIONS.PROPOSALS_VIEW)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const proposal = await prisma.proposal.findFirst({
      where: { id: (await params).id, organizationId: user.organizationId },
      select: { logoKey: true, logoProvider: true },
    });

    if (!proposal || !proposal.logoKey) {
      return new NextResponse('Logo Not Found', { status: 404 });
    }

    const storage = getStorageProvider(proposal.logoProvider as any);
    if (/\.svg$/i.test(proposal.logoKey)) return new NextResponse('Unsupported image format', { status: 415 });
    if (proposal.logoProvider === 's3') {
      return NextResponse.redirect(await storage.getDownloadUrl(proposal.logoKey, 300));
    }

    const buffer = await storage.download(proposal.logoKey);
    if (!buffer) {
      return new NextResponse('File content not found', { status: 404 });
    }

    let contentType = 'image/png';
    if (proposal.logoKey.endsWith('.jpg') || proposal.logoKey.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (proposal.logoKey.endsWith('.webp')) {
      contentType = 'image/webp';
    } else if (proposal.logoKey.endsWith('.svg')) {
      contentType = 'image/svg+xml';
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    console.error('Proposal logo fetch error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    if (!filePart) {
      return NextResponse.json({ success: false, error: 'No logo file provided' }, { status: 400 });
    }

    const updated = await ProposalService.uploadLogo(
      user,
      (await params).id,
      filePart.data,
      filePart.filename || 'logo',
      filePart.contentType || 'image/png'
    );

    return NextResponse.json({ success: true, proposal: updated });
  } catch (err: any) {
    const resourceError = uploadErrorResponse(err);
    if (resourceError) return resourceError;
    console.error('Proposal logo upload error:', err);
    return NextResponse.json({ success: false, error: 'Unable to upload logo' }, { status: 500 });
  }
}
