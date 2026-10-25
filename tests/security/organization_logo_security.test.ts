import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSession } from '@/types';

const mocks = vi.hoisted(() => ({
  user: null as UserSession | null,
  canManage: false,
  organization: null as null | { logoKey: string | null; logoProvider: string },
  findUnique: vi.fn(),
  download: vi.fn(),
  parse: vi.fn(),
  uploadLogo: vi.fn(),
  removeLogo: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({ getCurrentUser: async () => mocks.user }));
vi.mock('@/lib/db/prisma', () => ({ default: { organization: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/permissions', () => ({
  PERMISSIONS: { ORGANIZATION_SETTINGS_MANAGE: 'organization_settings.manage' },
  hasPermission: () => mocks.canManage,
}));
vi.mock('@/lib/security/web', () => ({ rejectUntrustedMutation: () => null }));
vi.mock('@/lib/security/multipart', () => ({
  UPLOAD_LIMITS: { logo: { requestBytes: 6, fileBytes: 5, totalFileBytes: 5 } },
  parseBoundedMultipart: mocks.parse,
  uploadErrorResponse: () => null,
}));
vi.mock('@/lib/storage', () => ({
  getStorageProvider: () => ({ download: mocks.download, getDownloadUrl: vi.fn() }),
}));
vi.mock('@/server/services/OrganizationConfigService', () => ({
  OrganizationConfigService: { uploadLogo: mocks.uploadLogo, removeLogo: mocks.removeLogo },
}));

import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '@/app/api/organization/logo/route';

const actor: UserSession = {
  id: 'user-a', name: 'User A', email: 'a@example.test', role: 'SUPER_ADMIN', roleDisplayName: 'Company Super Admin',
  departmentId: 'dept-a', departmentName: 'Management', organizationId: 'org-a', permissions: ['organization_settings.manage'],
};

describe('organization logo boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = actor;
    mocks.canManage = true;
    mocks.organization = { logoKey: 'org-a/organization/logo/logo.png', logoProvider: 'local' };
    mocks.findUnique.mockImplementation(async () => mocks.organization);
    mocks.download.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    mocks.parse.mockResolvedValue([{ name: 'logo', filename: 'logo.png', contentType: 'image/png', data: Buffer.from('png') }]);
    mocks.uploadLogo.mockResolvedValue({ logoKey: 'key', logoProvider: 'local' });
  });

  it('loads only the signed-in organization logo', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 'org-a' }, select: { logoKey: true, logoProvider: true } });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects uploads before parsing when organization settings permission is missing', async () => {
    mocks.canManage = false;
    const response = await POST(new NextRequest('https://crm.example.test/api/organization/logo', { method: 'POST' }));
    expect(response.status).toBe(403);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.uploadLogo).not.toHaveBeenCalled();
  });

  it('passes a bounded uploaded file to the organization-scoped service', async () => {
    const response = await POST(new NextRequest('https://crm.example.test/api/organization/logo', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(mocks.parse).toHaveBeenCalledOnce();
    expect(mocks.uploadLogo).toHaveBeenCalledWith(actor, Buffer.from('png'), 'logo.png', 'image/png');
  });

  it('requires the same permission when removing a logo', async () => {
    mocks.canManage = false;
    const response = await DELETE(new NextRequest('https://crm.example.test/api/organization/logo', { method: 'DELETE' }));
    expect(response.status).toBe(403);
    expect(mocks.removeLogo).not.toHaveBeenCalled();
  });
});
