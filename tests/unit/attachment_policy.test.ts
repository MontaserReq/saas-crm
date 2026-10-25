import { describe, expect, it } from 'vitest';
import {
  MAX_ATTACHMENT_BYTES_PER_REQUEST,
  MAX_ATTACHMENTS_PER_REQUEST,
  validateAttachmentBatch,
  validateAttachmentContent,
  validateAttachmentFile,
} from '@/lib/storage/attachmentPolicy';
import { createXlsx } from '@/lib/imports/writeXlsx';
import { strToU8, unzipSync, zipSync } from 'fflate';

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

  it('checks file signatures and rejects MIME or extension spoofing', () => {
    const pdf = Buffer.from('%PDF-1.7\nsynthetic');
    expect(validateAttachmentContent(file(pdf.length, 'document.pdf'), pdf)).toMatchObject({ error: null, mimeType: 'application/pdf' });
    expect(validateAttachmentContent(file(4, 'document.pdf'), Buffer.from('MZ!!')).error).toMatch(/does not match/i);
    expect(validateAttachmentFile(file(4, 'document.csv', 'application/pdf'))).toMatch(/does not match/i);
    expect(validateAttachmentFile(file(4, 'legacy.xls', 'application/vnd.ms-excel'))).toMatch(/not allowed/i);
  });

  it('accepts structurally valid OOXML and rejects another ZIP format renamed as Office', () => {
    const xlsx = Buffer.from(createXlsx([{ name: 'Sheet1', rows: [['Name'], ['Synthetic']] }]));
    expect(validateAttachmentContent(file(xlsx.length, 'data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), xlsx).error).toBeNull();
    expect(validateAttachmentContent(file(xlsx.length, 'data.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), xlsx).error).toMatch(/does not match/i);
  });

  it('rejects macro-enabled Office archives and unsafe ZIP entry paths', () => {
    const xlsx = Buffer.from(createXlsx([{ name: 'Sheet1', rows: [['Name'], ['Synthetic']] }]));
    const entries = unzipSync(xlsx);
    entries['xl/vbaProject.bin'] = strToU8('synthetic macro');
    const macroWorkbook = Buffer.from(zipSync(entries));
    expect(validateAttachmentContent(file(macroWorkbook.length, 'macro.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), macroWorkbook).error).toMatch(/macro-enabled/i);

    entries['../outside.xml'] = strToU8('unsafe');
    const traversalWorkbook = Buffer.from(zipSync(entries));
    expect(validateAttachmentContent(file(traversalWorkbook.length, 'traversal.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), traversalWorkbook).error).toMatch(/does not match/i);
  });
});
