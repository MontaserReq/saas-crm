import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProposalTemplateService } from '@/server/services/ProposalTemplateService';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { parseBoundedMultipart, uploadErrorResponse, UPLOAD_LIMITS } from '@/lib/security/multipart';

export async function POST(request: NextRequest) {
  try {
    const originError = rejectUntrustedMutation(request);
    if (originError) return originError;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const parts = await parseBoundedMultipart(request, UPLOAD_LIMITS.template);
    const field = (name: string) => parts.find((part) => part.name === name && part.filename === undefined)?.data.toString('utf8');
    const filePart = parts.find((part) => part.name === 'file' && part.filename !== undefined);
    const name = field('name') || '';
    const description = field('description') || null;
    const configRaw = field('config') || null;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Template name is required' }, { status: 400 });
    }

    if (!filePart) {
      return NextResponse.json({ success: false, error: 'PDF template file is required' }, { status: 400 });
    }

    let config = null;
    if (configRaw) {
      try {
        config = JSON.parse(configRaw);
      } catch {}
    }

    const template = await ProposalTemplateService.createTemplate(user, {
      name: name.trim(),
      description,
      pdfBuffer: filePart.data,
      originalFileName: filePart.filename || 'template.pdf',
      config,
    });

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    const resourceError = uploadErrorResponse(err);
    if (resourceError) return resourceError;
    console.error('Template upload error:', err);
    return NextResponse.json({ success: false, error: 'Unable to upload template' }, { status: 500 });
  }
}
