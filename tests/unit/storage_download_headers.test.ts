import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signed: vi.fn(), commandInput: null as any }));
vi.mock('@aws-sdk/client-s3', () => {
  class Command { input: any; constructor(input: any) { this.input = input; mocks.commandInput = input; } }
  return { S3Client: class {}, GetObjectCommand: Command, PutObjectCommand: Command, DeleteObjectCommand: Command, HeadBucketCommand: Command };
});
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.signed }));

import { getStorageProvider, safeContentDisposition } from '@/lib/storage';

const original = { endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, access: process.env.S3_ACCESS_KEY, secret: process.env.S3_SECRET_KEY, bucket: process.env.S3_BUCKET };

describe('storage download safety', () => {
  beforeEach(() => {
    process.env.S3_ENDPOINT = 'https://storage.example.test';
    process.env.S3_REGION = 'test-1';
    process.env.S3_ACCESS_KEY = 'synthetic-access';
    process.env.S3_SECRET_KEY = 'synthetic-secret';
    process.env.S3_BUCKET = 'synthetic-bucket';
    mocks.signed.mockResolvedValue('https://storage.example.test/signed');
  });
  afterEach(() => {
    for (const [key, value] of Object.entries({ S3_ENDPOINT: original.endpoint, S3_REGION: original.region, S3_ACCESS_KEY: original.access, S3_SECRET_KEY: original.secret, S3_BUCKET: original.bucket })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    vi.clearAllMocks();
  });

  it('signs S3 response header overrides for a safe forced download', async () => {
    const storage = getStorageProvider('s3');
    await expect(storage.getDownloadUrl('org-a/tickets/random-key', 300, { originalName: 'quarterly report.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', disposition: 'attachment' })).resolves.toBe('https://storage.example.test/signed');
    expect(mocks.commandInput).toMatchObject({
      Bucket: 'synthetic-bucket',
      Key: 'org-a/tickets/random-key',
      ResponseContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(mocks.commandInput.ResponseContentDisposition).toMatch(/^attachment; filename="quarterly-report\.xlsx"; filename\*=UTF-8''/);
  });

  it('removes path and control characters from download filenames', () => {
    const disposition = safeContentDisposition('../unsafe\r\nname.pdf');
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(disposition).not.toContain('../');
    expect(disposition).toContain('filename="unsafename.pdf"');
  });

  it('rejects local storage traversal keys before filesystem access', async () => {
    await expect(getStorageProvider('local').download('../outside.txt')).rejects.toThrow(/invalid storage key/i);
  });
});
