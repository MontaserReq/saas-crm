import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { db, getCurrentUser } = vi.hoisted(() => ({
  db: Object.fromEntries(['school', 'client', 'lead', 'contact', 'ticket', 'user', 'deal', 'pipeline', 'crmTask'].map(name => [name, { findMany: vi.fn() }])),
  getCurrentUser: vi.fn(),
}));
vi.mock('@/lib/db/prisma', () => ({ default: db }));
vi.mock('@/lib/auth/session', () => ({ getCurrentUser }));

import { GET } from '@/app/api/global-search/route';

describe('global search navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of Object.values(db)) model.findMany.mockResolvedValue([]);
    getCurrentUser.mockResolvedValue({
      id: 'user-a',
      organizationId: 'org-a',
      role: 'ADMIN',
      permissions: ['search.view', 'schools.view', 'tasks.view'],
      planFeatures: ['dashboard', 'clients', 'leads', 'contacts', 'tasks'],
    });
  });

  it('opens the selected record in its own detail route', async () => {
    db.client.findMany.mockResolvedValue([{ id: 'client-a', name: 'Matching customer', type: 'COMPANY' }]);
    db.lead.findMany.mockResolvedValue([{ id: 'lead-a', name: 'Matching lead', companyName: null }]);
    db.contact.findMany.mockResolvedValue([{ id: 'contact-a', firstName: 'Matching', lastName: 'Contact', email: null }]);
    db.crmTask.findMany.mockResolvedValue([{ id: 'task-a', title: 'Matching task', status: 'TODO' }]);
    const response = await GET(new NextRequest('http://localhost:3000/api/global-search?q=Matching'));
    expect(response.status).toBe(200);
    expect((await response.json()).results.map((result: { href: string }) => result.href)).toEqual(['/clients/client-a', '/leads/lead-a', '/contacts/contact-a', '/tasks/task-a']);
    expect(db.lead.findMany.mock.calls[0][0].where.organizationId).toBe('org-a');
    expect(db.contact.findMany.mock.calls[0][0].where.organizationId).toBe('org-a');
  });
});
