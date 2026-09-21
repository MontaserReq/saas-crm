import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ProposalService } from '@/server/services/ProposalService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { buffer, fileName } = await ProposalService.getGeneratedPdfBuffer(user, params.id);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('Proposal download error:', err);
    return new NextResponse('Not Found or Forbidden', { status: 404 });
  }
}