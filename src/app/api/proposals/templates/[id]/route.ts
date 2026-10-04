import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProposalTemplateService } from '@/server/services/ProposalTemplateService';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { parseBoundedMultipart, uploadErrorResponse, UPLOAD_LIMITS } from '@/lib/security/multipart';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const template = await ProposalTemplateService.getTemplate(user, params.id);
    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Template not found' },
      { status: 404 }
    );
  }
}

export async function PUT(
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

    const contentType = request.headers.get('content-type') || '';
    let updateInput: any = {};

    if (contentType.includes('multipart/form-data')) {
      const parts = await parseBoundedMultipart(request, UPLOAD_LIMITS.template);
      const field = (name: string) => parts.find((part) => part.name === name && part.filename === undefined)?.data.toString('utf8');
      const filePart = parts.find((part) => part.name === 'file' && part.filename !== undefined);
      const name = field('name') ?? null;
      const description = field('description') ?? null;
      const isActiveRaw = field('isActive') ?? null;
      const configRaw = field('config') ?? null;

      if (name !== null) updateInput.name = name;
      if (description !== null) updateInput.description = description;
      if (isActiveRaw !== null) updateInput.isActive = isActiveRaw === 'true';

      if (configRaw) {
        try {
          updateInput.config = JSON.parse(configRaw);
        } catch {}
      }

      if (filePart && filePart.data.length > 0) {
        updateInput.pdfBuffer = filePart.data;
        updateInput.originalFileName = filePart.filename;
      }
    } else {
      const body = await request.json();
      updateInput = body;
    }

    const updated = await ProposalTemplateService.updateTemplate(user, params.id, updateInput);
    return NextResponse.json({ success: true, template: updated });
  } catch (err: any) {
    const resourceError = uploadErrorResponse(err);
    if (resourceError) return resourceError;
    console.error('Template update error:', err);
    return NextResponse.json(
      { success: false, error: 'Unable to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await ProposalTemplateService.deleteTemplate(user, params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Unable to delete template' },
      { status: 500 }
    );
  }
}
