import { containsOfficeMacros, inspectZipArchive } from '@/lib/security/zip';

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_REQUEST = 10;
export const MAX_ATTACHMENT_BYTES_PER_REQUEST = 25 * 1024 * 1024;

const formats = {
  jpg: { mime: 'image/jpeg', kind: 'jpeg' }, jpeg: { mime: 'image/jpeg', kind: 'jpeg' },
  png: { mime: 'image/png', kind: 'png' }, webp: { mime: 'image/webp', kind: 'webp' }, gif: { mime: 'image/gif', kind: 'gif' },
  pdf: { mime: 'application/pdf', kind: 'pdf' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'docx' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'xlsx' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'pptx' },
  txt: { mime: 'text/plain', kind: 'text' }, csv: { mime: 'text/csv', kind: 'text' },
} as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = Object.keys(formats);
export const ALLOWED_ATTACHMENT_MIME_TYPES = [...new Set(Object.values(formats).map((format) => format.mime))];
type FileMetadata = { name: string; type: string; size: number };

function extensionOf(name: string) { return name.split('.').pop()?.toLowerCase() || ''; }

export function validateAttachmentFile(file: FileMetadata): string | null {
  if (file.size <= 0) return `File "${file.name}" is empty`;
  if (file.size > MAX_ATTACHMENT_SIZE) return `File "${file.name}" exceeds maximum allowed size of 10MB`;
  const extension = extensionOf(file.name);
  const format = formats[extension as keyof typeof formats];
  if (!format) return `File type "${file.type || extension || 'unknown'}" is not allowed. Supported formats: Images, PDF, DOCX, XLSX, PPTX, Text, CSV`;
  if (file.type && file.type !== 'application/octet-stream' && file.type !== format.mime) return `File "${file.name}" has a content type that does not match its extension`;
  return null;
}

function startsWith(buffer: Buffer, bytes: number[]) { return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte); }

export function validateAttachmentContent(file: FileMetadata, buffer: Buffer): { error: string | null; mimeType: string } {
  const metadataError = validateAttachmentFile(file);
  const extension = extensionOf(file.name) as keyof typeof formats;
  const format = formats[extension];
  if (metadataError || !format) return { error: metadataError || 'Unsupported file type', mimeType: 'application/octet-stream' };
  if (buffer.length !== file.size) return { error: `File "${file.name}" size changed while it was being processed`, mimeType: format.mime };
  let valid = false;
  if (format.kind === 'jpeg') valid = startsWith(buffer, [0xff, 0xd8, 0xff]);
  else if (format.kind === 'png') valid = startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  else if (format.kind === 'gif') valid = buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
  else if (format.kind === 'webp') valid = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  else if (format.kind === 'pdf') valid = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  else if (format.kind === 'text') {
    try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); valid = !buffer.includes(0); } catch { valid = false; }
  } else {
    try {
      const archive = inspectZipArchive(buffer, { maxEntries: 10_000, maxUncompressedBytes: 100 * 1024 * 1024 });
      if (containsOfficeMacros(archive.entries)) return { error: 'Macro-enabled Office documents are not allowed', mimeType: format.mime };
      valid = format.kind === 'docx' ? archive.entries.includes('word/document.xml')
        : format.kind === 'xlsx' ? archive.entries.includes('xl/workbook.xml')
          : archive.entries.includes('ppt/presentation.xml');
    } catch { valid = false; }
  }
  return { error: valid ? null : `File "${file.name}" content does not match its extension`, mimeType: format.mime };
}

export function validateAttachmentBatch(files: FileMetadata[]): string | null {
  const active = files.filter((file) => file && file.size > 0);
  if (active.length > MAX_ATTACHMENTS_PER_REQUEST) return `A maximum of ${MAX_ATTACHMENTS_PER_REQUEST} attachments is allowed per request`;
  if (active.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_BYTES_PER_REQUEST) return 'Attachments exceed the maximum combined request size of 25MB';
  return null;
}
