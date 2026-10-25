import { NextResponse } from 'next/server';

export const UPLOAD_LIMITS = {
  template: { requestBytes: 11 * 1024 * 1024, fileBytes: 10 * 1024 * 1024, totalFileBytes: 10 * 1024 * 1024 },
  logo: { requestBytes: 6 * 1024 * 1024, fileBytes: 5 * 1024 * 1024, totalFileBytes: 5 * 1024 * 1024 },
  import: { requestBytes: 6 * 1024 * 1024, fileBytes: 5 * 1024 * 1024, totalFileBytes: 5 * 1024 * 1024 },
  parts: 16,
  fields: 12,
  fieldBytes: 128 * 1024,
  filenameBytes: 512,
} as const;

export type MultipartPart = {
  name: string;
  filename?: string;
  contentType: string;
  data: Buffer;
};

export class MultipartResourceError extends Error {
  constructor(public readonly code: 'REQUEST_TOO_LARGE' | 'FILE_TOO_LARGE' | 'AGGREGATE_TOO_LARGE' | 'TOO_MANY_PARTS' | 'TOO_MANY_FIELDS' | 'FIELD_TOO_LARGE' | 'FILENAME_TOO_LARGE' | 'MALFORMED') {
    super(code);
    this.name = 'MultipartResourceError';
  }
}

function dispositionValue(value: string, key: string): string | undefined {
  const match = value.match(new RegExp(`(?:^|;)\\s*${key}="([^"]*)"`, 'i'));
  return match?.[1] ?? value.match(new RegExp(`(?:^|;)\\s*${key}=([^;\\s]+)`, 'i'))?.[1];
}

function parseBoundary(contentType: string): string {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!match?.[1] && !match?.[2]) throw new MultipartResourceError('MALFORMED');
  const boundary = match[1] || match[2];
  if (boundary.length > 200) throw new MultipartResourceError('MALFORMED');
  return boundary;
}

function resourceErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof MultipartResourceError)) return null;
  const status = error.code === 'MALFORMED' ? 400 : error.code === 'REQUEST_TOO_LARGE' || error.code === 'FILE_TOO_LARGE' || error.code === 'AGGREGATE_TOO_LARGE' || error.code === 'FIELD_TOO_LARGE' || error.code === 'FILENAME_TOO_LARGE' ? 413 : 400;
  return NextResponse.json({ success: false, error: 'Upload request exceeds the allowed resource limits' }, { status });
}

export function uploadErrorResponse(error: unknown): NextResponse | null {
  return resourceErrorResponse(error);
}

export async function parseBoundedMultipart(request: Request, limits: {
  requestBytes: number;
  fileBytes: number;
  totalFileBytes: number;
}): Promise<MultipartPart[]> {
  const contentType = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new MultipartResourceError('MALFORMED');
  const boundary = parseBoundary(contentType);
  const delimiter = Buffer.from(`\r\n--${boundary}`);
  const firstBoundary = Buffer.from(`--${boundary}`);
  const reader = request.body?.getReader();
  if (!reader) throw new MultipartResourceError('MALFORMED');

  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > limits.requestBytes) {
    throw new MultipartResourceError('REQUEST_TOO_LARGE');
  }

  let received = 0;
  let buffer = Buffer.alloc(0);
  let state: 'first' | 'headers' | 'data' = 'first';
  let current: { name: string; filename?: string; contentType: string; chunks: Buffer[]; bytes: number } | undefined;
  const parts: MultipartPart[] = [];
  let fileBytes = 0;

  const append = (value: Uint8Array) => {
    received += value.byteLength;
    if (received > limits.requestBytes) throw new MultipartResourceError('REQUEST_TOO_LARGE');
    buffer = Buffer.concat([buffer, Buffer.from(value)]);
  };

  const completePart = (data: Buffer) => {
    if (!current) throw new MultipartResourceError('MALFORMED');
    const part = current;
    if (part.filename !== undefined) {
      if (data.length > limits.fileBytes) throw new MultipartResourceError('FILE_TOO_LARGE');
      fileBytes += data.length;
      if (fileBytes > limits.totalFileBytes) throw new MultipartResourceError('AGGREGATE_TOO_LARGE');
    } else if (data.length > UPLOAD_LIMITS.fieldBytes) {
      throw new MultipartResourceError('FIELD_TOO_LARGE');
    }
    parts.push({ name: part.name, filename: part.filename, contentType: part.contentType, data });
  };

  while (true) {
    const next = await reader.read();
    if (!next.done) append(next.value);

    parse: while (true) {
      if (state === 'first') {
        if (buffer.length < firstBoundary.length + 2) break parse;
        if (!buffer.subarray(0, firstBoundary.length).equals(firstBoundary)) throw new MultipartResourceError('MALFORMED');
        buffer = buffer.subarray(firstBoundary.length);
        if (buffer.subarray(0, 2).equals(Buffer.from('--'))) return parts;
        if (!buffer.subarray(0, 2).equals(Buffer.from('\r\n'))) throw new MultipartResourceError('MALFORMED');
        buffer = buffer.subarray(2);
        state = 'headers';
      }

      if (state === 'headers') {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) {
          if (buffer.length > 16 * 1024) throw new MultipartResourceError('MALFORMED');
          break parse;
        }
        const headerText = buffer.subarray(0, end).toString('latin1');
        buffer = buffer.subarray(end + 4);
        const headers = new Map<string, string>();
        for (const line of headerText.split('\r\n')) {
          const separator = line.indexOf(':');
          if (separator <= 0) throw new MultipartResourceError('MALFORMED');
          headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
        }
        const contentDisposition = headers.get('content-disposition');
        const name = contentDisposition && dispositionValue(contentDisposition, 'name');
        if (!name) throw new MultipartResourceError('MALFORMED');
        const filename = contentDisposition ? dispositionValue(contentDisposition, 'filename') : undefined;
        if (filename !== undefined && Buffer.byteLength(filename, 'utf8') > UPLOAD_LIMITS.filenameBytes) throw new MultipartResourceError('FILENAME_TOO_LARGE');
        const partCount = parts.length + 1;
        if (partCount > UPLOAD_LIMITS.parts) throw new MultipartResourceError('TOO_MANY_PARTS');
        if (filename === undefined && parts.filter((part) => part.filename === undefined).length + 1 > UPLOAD_LIMITS.fields) throw new MultipartResourceError('TOO_MANY_FIELDS');
        current = { name, filename, contentType: headers.get('content-type') || 'application/octet-stream', chunks: [], bytes: 0 };
        state = 'data';
      }

      if (state === 'data') {
        const marker = buffer.indexOf(delimiter);
        if (marker < 0) {
          const safeBytes = Math.max(0, buffer.length - delimiter.length);
          if (current?.filename !== undefined && current.bytes + safeBytes > limits.fileBytes) throw new MultipartResourceError('FILE_TOO_LARGE');
          if (current?.filename === undefined && current!.bytes + safeBytes > UPLOAD_LIMITS.fieldBytes) throw new MultipartResourceError('FIELD_TOO_LARGE');
          if (safeBytes > 0) {
            current!.chunks.push(buffer.subarray(0, safeBytes));
            current!.bytes += safeBytes;
            buffer = buffer.subarray(safeBytes);
          }
          break parse;
        }
        const data = Buffer.concat([...current!.chunks, buffer.subarray(0, marker)]);
        completePart(data);
        buffer = buffer.subarray(marker + delimiter.length);
        if (buffer.length < 2) break parse;
        if (buffer.subarray(0, 2).equals(Buffer.from('--'))) return parts;
        if (!buffer.subarray(0, 2).equals(Buffer.from('\r\n'))) throw new MultipartResourceError('MALFORMED');
        buffer = buffer.subarray(2);
        current = undefined;
        state = 'headers';
      }
    }

    if (next.done) break;
  }
  throw new MultipartResourceError('MALFORMED');
}
