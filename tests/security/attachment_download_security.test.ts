import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSession } from '@/types';

const mocks = vi.hoisted(() => ({
  user: null as UserSession | null,
  allowed: false,
  attachment: null as any,
  download: vi.fn(),
  getDownloadUrl: vi.fn(),
}));
vi.mock('@/lib/auth/session', () => ({ getCurrentUser: async () => mocks.user }));
vi.mock('@/lib/permissions', () => ({ canAccessAttachment: async () => mocks.allowed }));
vi.mock('@/lib/db/prisma', () => ({ default: { attachment: { findFirst: async () => mocks.attachment } } }));
vi.mock('@/lib/storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/storage')>();
  return { ...original, getStorageProvider: () => ({ download: mocks.download, getDownloadUrl: mocks.getDownloadUrl }) };
});

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/attachments/[id]/route';

const actor: UserSession = { id: 'user-a', name: 'User A', email: 'a@example.test', role: 'MEMBER', roleDisplayName: 'Member', departmentId: 'dept-a', departmentName: 'Dept', organizationId: 'org-a', permissions: [] };

describe('attachment download boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = actor;
    mocks.allowed = true;
    mocks.attachment = { id: 'attachment-a', organizationId: 'org-a', storageProvider: 'local', storageKey: 'org-a/tickets/random.pdf', originalName: 'report.pdf', mimeType: 'application/pdf', size: 14 };
    mocks.download.mockResolvedValue(Buffer.from('%PDF-synthetic'));
    mocks.getDownloadUrl.mockResolvedValue('https://storage.example.test/signed');
  });

  it('denies a cross-tenant or otherwise unauthorized attachment before lookup', async () => {
    mocks.allowed = false;
    const response = await GET(new NextRequest('https://crm.example.test/api/attachments/foreign'), { params: Promise.resolve({ id: 'foreign' }) });
    expect(response.status).toBe(403);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('returns local downloads with safe content headers', async () => {
    mocks.attachment.originalName = '../unsafe\r\nreport.pdf';
    const response = await GET(new NextRequest('https://crm.example.test/api/attachments/attachment-a'), { params: Promise.resolve({ id: 'attachment-a' }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="unsafereport\.pdf"/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('passes safe response overrides into S3 signed downloads', async () => {
    mocks.attachment.storageProvider = 's3';
    const response = await GET(new NextRequest('https://crm.example.test/api/attachments/attachment-a'), { params: Promise.resolve({ id: 'attachment-a' }) });
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(mocks.getDownloadUrl).toHaveBeenCalledWith('org-a/tickets/random.pdf', 300, { originalName: 'report.pdf', mimeType: 'application/pdf', disposition: 'attachment' });
  });
});
