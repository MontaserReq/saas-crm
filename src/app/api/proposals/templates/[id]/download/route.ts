import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProposalTemplateService } from '@/server/services/ProposalTemplateService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const template = await ProposalTemplateService.getTemplate(user, params.id);
    const buffer = await ProposalTemplateService.getTemplatePdfBuffer(user, params.id);

    const filename = template.originalFileName || `${template.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('Template download error:', err);
    return new NextResponse('Not Found or Forbidden', { status: 404 });
  }
}