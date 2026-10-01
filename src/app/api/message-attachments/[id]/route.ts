import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessMessageAttachment } from '@/lib/permissions';
import prisma from '@/lib/db/prisma';
import { getStorageProvider } from '@/lib/storage';

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

    const attachmentId = params.id;
    const isAllowed = await canAccessMessageAttachment(user, attachmentId);
    if (!isAllowed) {
      return new NextResponse('Forbidden: Access to this message attachment is restricted', { status: 403 });
    }

    const attachment = await prisma.messageAttachment.findFirst({
      where: { id: attachmentId, organizationId: user.organizationId },
    });

    if (!attachment) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const storage = attachment.storageProvider === 'local' ? getStorageProvider('local') : getStorageProvider();
    if (attachment.storageProvider === 's3') {
      return NextResponse.redirect(await storage.getDownloadUrl(attachment.storageKey, 300));
    }
    const fileBuffer = await storage.download(attachment.storageKey);

    if (!fileBuffer) {
      return new NextResponse('File content not found on storage provider', { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isInline = searchParams.get('inline') === 'true' || attachment.mimeType.startsWith('image/');
    const dispositionType = isInline ? 'inline' : 'attachment';

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Disposition': `${dispositionType}; filename="${encodeURIComponent(attachment.originalName)}"`,
        'Content-Length': attachment.size.toString(),
      },
    });
  } catch (err: any) {
    console.error('Message attachment download error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
