import { NextRequest, NextResponse } from 'next/server';
import { zipSync } from 'fflate';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { CanvaService } from '@/server/services/CanvaService';

const querySchema = z.object({
  designId: z.string().trim().min(1).max(200),
  format: z.enum(['png', 'jpg', 'pdf', 'gif', 'pptx', 'mp4', 'html_bundle', 'html_standalone', 'csv']).default('png'),
  filename: z.string().trim().max(160).optional(),
  size: z.enum(['a4', 'a3', 'letter', 'legal']).optional(),
});

const fileTypes = {
  png: { mime: 'image/png', extension: 'png' },
  jpg: { mime: 'image/jpeg', extension: 'jpg' },
  pdf: { mime: 'application/pdf', extension: 'pdf' },
  gif: { mime: 'image/gif', extension: 'gif' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx' },
  mp4: { mime: 'video/mp4', extension: 'mp4' },
  html_bundle: { mime: 'application/zip', extension: 'zip' },
  html_standalone: { mime: 'text/html; charset=utf-8', extension: 'html' },
  csv: { mime: 'text/csv; charset=utf-8', extension: 'csv' },
} as const;

const allowedHosts = new Set(['export-download.canva.com', 'document-export.canva.com']);

function safeName(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || fallback;
}

async function download(urlValue: string) {
  const url = new URL(urlValue);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) throw new Error('Canva returned an unexpected export URL.');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to download the Canva export.');
  return new Uint8Array(await response.arrayBuffer());
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await CanvaService.canManage(user))) return NextResponse.json({ error: 'Canva integration is not available.' }, { status: 403 });
  const parsed = querySchema.safeParse({
    designId: request.nextUrl.searchParams.get('designId') || '',
    format: request.nextUrl.searchParams.get('format') || 'png',
    filename: request.nextUrl.searchParams.get('filename') || undefined,
    size: request.nextUrl.searchParams.get('size') || undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'A valid design and export format are required.' }, { status: 400 });
  try {
    const result = await CanvaService.exportDesign(user, parsed.data);
    const type = fileTypes[parsed.data.format];
    const name = safeName(parsed.data.filename, `canva-design-${parsed.data.designId}`);
    let body: Uint8Array;
    let mime = type.mime;
    let extension = type.extension;
    if (result.urls.length === 1) {
      body = await download(result.urls[0]);
    } else {
      const files: Record<string, Uint8Array> = {};
      for (let index = 0; index < result.urls.length; index += 1) files[`page-${String(index + 1).padStart(3, '0')}.${type.extension}`] = await download(result.urls[index]);
      body = zipSync(files);
      mime = 'application/zip';
      extension = 'zip';
    }
    const responseBody = new ArrayBuffer(body.byteLength);
    new Uint8Array(responseBody).set(body);
    return new NextResponse(responseBody, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${name}.${extension}"`,
        'Cache-Control': 'private, no-store',
        'X-Canva-Export-Id': result.exportId,
      },
    });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to export Canva design.' }, { status: 400 }); }
}
