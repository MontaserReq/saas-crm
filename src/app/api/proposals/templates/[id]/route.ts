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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let updateInput: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const name = formData.get('name') as string | null;
      const description = formData.get('description') as string | null;
      const isActiveRaw = formData.get('isActive') as string | null;
      const configRaw = formData.get('config') as string | null;
      const file = formData.get('file') as File | null;

      if (name !== null) updateInput.name = name;
      if (description !== null) updateInput.description = description;
      if (isActiveRaw !== null) updateInput.isActive = isActiveRaw === 'true';

      if (configRaw) {
        try {
          updateInput.config = JSON.parse(configRaw);
        } catch {}
      }

      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        updateInput.pdfBuffer = Buffer.from(bytes);
        updateInput.originalFileName = file.name;
      }
    } else {
      const body = await request.json();
      updateInput = body;
    }

    const updated = await ProposalTemplateService.updateTemplate(user, params.id, updateInput);
    return NextResponse.json({ success: true, template: updated });
  } catch (err: any) {
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
