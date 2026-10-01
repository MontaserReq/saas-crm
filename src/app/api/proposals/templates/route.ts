import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProposalTemplateService } from '@/server/services/ProposalTemplateService';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = (formData.get('description') as string) || null;
    const file = formData.get('file') as File | null;
    const configRaw = formData.get('config') as string | null;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Template name is required' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'PDF template file is required' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(bytes);

    let config = null;
    if (configRaw) {
      try {
        config = JSON.parse(configRaw);
      } catch {}
    }

    const template = await ProposalTemplateService.createTemplate(user, {
      name: name.trim(),
      description,
      pdfBuffer,
      originalFileName: file.name,
      config,
    });

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    console.error('Template upload error:', err);
    return NextResponse.json({ success: false, error: 'Unable to upload template' }, { status: 500 });
  }
}
