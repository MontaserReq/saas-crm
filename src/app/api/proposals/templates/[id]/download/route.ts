import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProposalTemplateService } from '@/server/services/ProposalTemplateService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const templateId = (await params).id;
    const template = await ProposalTemplateService.getTemplate(user, templateId);
    const buffer = await ProposalTemplateService.getTemplatePdfBuffer(user, templateId);

    const filename = template.originalFileName || `${template.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    console.error('Template download error:', err);
    return new NextResponse('Not Found or Forbidden', { status: 404 });
  }
}
