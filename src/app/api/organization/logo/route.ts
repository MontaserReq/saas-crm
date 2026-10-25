import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { getStorageProvider } from '@/lib/storage';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { parseBoundedMultipart, uploadErrorResponse, UPLOAD_LIMITS } from '@/lib/security/multipart';
import { OrganizationConfigService } from '@/server/services/OrganizationConfigService';

function contentTypeFor(key: string) {
  if (/\.jpe?g$/i.test(key)) return 'image/jpeg';
  if (/\.webp$/i.test(key)) return 'image/webp';
  return 'image/png';
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return new NextResponse('Unauthorized', { status: 401 });
    if (!user.organizationId) return new NextResponse('Organization context required', { status: 403 });

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { logoKey: true, logoProvider: true },
    });
    if (!organization?.logoKey) return new NextResponse('Logo not found', { status: 404 });
    if (/\.svg$/i.test(organization.logoKey)) return new NextResponse('Unsupported image format', { status: 415 });

    const storage = getStorageProvider(organization.logoProvider as 'local' | 's3');
    if (organization.logoProvider === 's3') {
      return NextResponse.redirect(await storage.getDownloadUrl(organization.logoKey, 300));
    }
    const buffer = await storage.download(organization.logoKey);
    if (!buffer) return new NextResponse('Logo not found', { status: 404 });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentTypeFor(organization.logoKey),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Organization logo fetch error:', error);
    return new NextResponse('Unable to load logo', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const originError = rejectUntrustedMutation(request);
    if (originError) return originError;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const parts = await parseBoundedMultipart(request, UPLOAD_LIMITS.logo);
    const logo = parts.find(part => part.name === 'logo' && part.filename !== undefined);
    if (!logo) return NextResponse.json({ success: false, error: 'No logo file provided' }, { status: 400 });
    await OrganizationConfigService.uploadLogo(user, logo.data, logo.filename || 'logo.png', logo.contentType || 'application/octet-stream');
    return NextResponse.json({ success: true });
  } catch (error) {
    const resourceError = uploadErrorResponse(error);
    if (resourceError) return resourceError;
    const message = error instanceof Error && !error.message.toLowerCase().includes('prisma') ? error.message : 'Unable to upload logo';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const originError = rejectUntrustedMutation(request);
    if (originError) return originError;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    await OrganizationConfigService.removeLogo(user);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error && !error.message.toLowerCase().includes('prisma') ? error.message : 'Unable to remove logo';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
