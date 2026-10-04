import { describe, expect, it } from 'vitest';
import { MultipartResourceError, parseBoundedMultipart } from '@/lib/security/multipart';

const limits = { requestBytes: 1024, fileBytes: 128, totalFileBytes: 128 };

function multipart(parts: Array<{ name: string; value: string; filename?: string }>, boundary = 'test-boundary') {
  const body = parts.map((part) => {
    const disposition = `Content-Disposition: form-data; name="${part.name}"${part.filename ? `; filename="${part.filename}"` : ''}`;
    return `--${boundary}\r\n${disposition}\r\n${part.filename ? 'Content-Type: application/octet-stream\r\n' : ''}\r\n${part.value}\r\n`;
  }).join('') + `--${boundary}--\r\n`;
  return new Request('http://localhost/upload', {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

describe('bounded multipart resource protection', () => {
  it('accepts a bounded multipart request without using FormData parsing', async () => {
    const parts = await parseBoundedMultipart(multipart([{ name: 'name', value: 'template' }, { name: 'file', value: 'PDF', filename: 'template.pdf' }]), limits);
    expect(parts).toHaveLength(2);
    expect(parts[1].data.toString()).toBe('PDF');
  });

  it('rejects a streamed request above the request ceiling', async () => {
    const boundary = 'streamed';
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`--${boundary}\r\n\r\n${'x'.repeat(1500)}`)); controller.close(); } }),
      duplex: 'half',
    } as RequestInit);
    await expect(parseBoundedMultipart(request, limits)).rejects.toMatchObject({ code: 'REQUEST_TOO_LARGE' });
  });

  it('rejects an oversized file before the terminating boundary arrives', async () => {
    await expect(parseBoundedMultipart(multipart([{ name: 'file', value: 'x'.repeat(129), filename: 'large.bin' }]), limits)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('rejects excessive fields and filenames', async () => {
    const manyFields = Array.from({ length: 13 }, (_, index) => ({ name: `field${index}`, value: 'x' }));
    await expect(parseBoundedMultipart(multipart(manyFields), limits)).rejects.toMatchObject({ code: 'TOO_MANY_FIELDS' });
    await expect(parseBoundedMultipart(multipart([{ name: 'file', value: 'x', filename: 'a'.repeat(513) }]), limits)).rejects.toMatchObject({ code: 'FILENAME_TOO_LARGE' });
  });

  it('rejects malformed multipart safely', async () => {
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=broken' },
      body: '--wrong--',
    });
    await expect(parseBoundedMultipart(request, limits)).rejects.toBeInstanceOf(MultipartResourceError);
  });
});
