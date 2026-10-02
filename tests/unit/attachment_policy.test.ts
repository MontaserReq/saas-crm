import { describe, expect, it } from 'vitest';
import {
  MAX_ATTACHMENT_BYTES_PER_REQUEST,
  MAX_ATTACHMENTS_PER_REQUEST,
  validateAttachmentBatch,
  validateAttachmentFile,
} from '@/lib/storage/attachmentPolicy';

const file = (size: number, name = 'document.pdf', type = 'application/pdf') => ({ name, type, size });

describe('attachment resource policy', () => {
  it('accepts exactly ten attachments and rejects eleven', () => {
    expect(validateAttachmentBatch(Array.from({ length: MAX_ATTACHMENTS_PER_REQUEST }, () => file(1)))).toBeNull();
    expect(validateAttachmentBatch(Array.from({ length: MAX_ATTACHMENTS_PER_REQUEST + 1 }, () => file(1)))).toMatch(/maximum/i);
  });

  it('accepts a combined request at 25 MB and rejects one byte over', () => {
    expect(validateAttachmentBatch([file(MAX_ATTACHMENT_BYTES_PER_REQUEST)])).toBeNull();
    expect(validateAttachmentBatch([file(MAX_ATTACHMENT_BYTES_PER_REQUEST + 1)])).toMatch(/combined/i);
  });

  it('preserves per-file size, MIME, and extension validation', () => {
    expect(validateAttachmentFile(file(10 * 1024 * 1024 + 1))).toMatch(/10MB/i);
    expect(validateAttachmentFile(file(1, 'payload.exe', 'application/octet-stream'))).toMatch(/not allowed/i);
    expect(validateAttachmentFile(file(1, 'payload.csv', 'application/octet-stream'))).toBeNull();
  });
});
