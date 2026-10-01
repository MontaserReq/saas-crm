import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSession } from '@/types';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    school: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    schoolResearchJob: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    schoolResearchCandidate: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
    schoolResearchSource: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  };
  prismaMock.$transaction = vi.fn(async (fn: any) => fn(prismaMock));
  return { prismaMock };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let currentUser: UserSession | null = null;
vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => {
    if (!currentUser) throw new Error('Unauthorized');
    return currentUser;
  },
}));

import {
  createResearchJobAction,
  getResearchJobAction,
  getCandidateDetailAction,
  approveCandidateAction,
  rejectCandidateAction,
} from '@/server/actions/ai-school-research';
import { SchoolResearchService } from '@/server/services/SchoolResearchService';

function makeUser(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'user@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Member',
    departmentId: 'dept-1',
    departmentName: 'Dept',
    permissions: [],
    ...overrides,
  };
}

const OWNER_ID = 'owner-user';
const OTHER_USER_ID = 'attacker-user';

function baseJob(overrides: Partial<any> = {}) {
  return {
    id: 'job-1',
    createdById: OWNER_ID,
    status: 'COMPLETED',
    location: 'Amman',
    area: null,
    schoolType: null,
    requestedCount: 10,
    requiredFields: '["phone"]',
    error: null,
    startedAt: new Date(),
    completedAt: new Date(),
    createdAt: new Date(),
    createdBy: { id: OWNER_ID, name: 'Owner' },
    ...overrides,
  };
}

function baseCandidate(overrides: Partial<any> = {}) {
  return {
    id: 'candidate-1',
    researchJobId: 'job-1',
    name: 'XYZ International School',
    normalizedName: 'xyz international school',
    city: 'Amman',
    area: 'Khalda',
    phone: '0799631111',
    email: 'info@xyz.edu.jo',
    website: 'https://xyz.edu.jo',
    contactPerson: null,
    schoolType: 'PRIVATE',
    address: null,
    confidence: 80,
    status: 'NEW',
    matchedSchoolId: null,
    matchedSchool: null,
    rejectionReason: null,
    importedSchoolId: null,
    decidedById: null,
    decidedAt: null,
    sources: [],
    researchJob: { id: 'job-1', createdById: OWNER_ID, location: 'Amman', area: null },
    ...overrides,
  };
}

describe('AI School Research — security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
    prismaMock.school.findMany.mockResolvedValue([]);
    prismaMock.schoolResearchJob.count.mockResolvedValue(0);
    vi.spyOn(SchoolResearchService, 'runJob').mockResolvedValue(undefined as any);
  });

  describe('Creating and running research jobs', () => {
    it('rejects a user with no ai_research permissions', async () => {
      currentUser = makeUser({ permissions: [] });
      const res = await createResearchJobAction({ location: 'Amman', requestedCount: 10, requiredFields: ['phone'] });
      expect(res.success).toBe(false);
      expect(prismaMock.schoolResearchJob.create).not.toHaveBeenCalled();
    });

    it('rejects a user who has create but not run', async () => {
      currentUser = makeUser({ permissions: ['ai_research.create'] });
      const res = await createResearchJobAction({ location: 'Amman', requestedCount: 10, requiredFields: ['phone'] });
      expect(res.success).toBe(false);
      expect(prismaMock.schoolResearchJob.create).not.toHaveBeenCalled();
    });

    it('allows a user with both create and run, and always derives createdById from the session — never from client input', async () => {
      currentUser = makeUser({ id: 'legit-user', permissions: ['ai_research.create', 'ai_research.run'] });
      prismaMock.schoolResearchJob.create.mockResolvedValue(baseJob({ createdById: 'legit-user' }));

      const res = await createResearchJobAction({
        location: 'Amman',
        requestedCount: 10,
        requiredFields: ['phone'],
        // @ts-expect-error — a malicious client payload trying to spoof ownership
        createdById: 'someone-else',
      });

      expect(res.success).toBe(true);
      expect(prismaMock.schoolResearchJob.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdById: 'legit-user' }) })
      );
    });

    it('does not enforce any daily job limit — a user can create more than 10 jobs in a day without being blocked', async () => {
      currentUser = makeUser({ permissions: ['ai_research.create', 'ai_research.run'] });
      // Simulate a user who has already created far more than the old
      // hard-coded 10/day limit; job creation must still succeed, and the
      // service must not even query a daily count anymore.
      prismaMock.schoolResearchJob.count.mockResolvedValue(500);
      prismaMock.schoolResearchJob.create.mockResolvedValue(baseJob());

      const res = await createResearchJobAction({ location: 'Amman', requestedCount: 10, requiredFields: ['phone'] });

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(prismaMock.schoolResearchJob.create).toHaveBeenCalled();
      expect(prismaMock.schoolResearchJob.count).not.toHaveBeenCalled();
    });
  });

  describe('Cross-user access (IDOR)', () => {
    it('a user without broad visibility cannot view another user\'s research job', async () => {
      currentUser = makeUser({ id: OTHER_USER_ID, permissions: ['ai_research.view'] });
      prismaMock.schoolResearchJob.findUnique.mockResolvedValue(baseJob({ createdById: OWNER_ID }));

      const res = await getResearchJobAction('job-1');
      expect(res.success).toBe(false);
    });

    it('a user with ai_research.approve (broad visibility) can view any job', async () => {
      currentUser = makeUser({ id: OTHER_USER_ID, permissions: ['ai_research.view', 'ai_research.approve'] });
      prismaMock.schoolResearchJob.findUnique.mockResolvedValue(baseJob({ createdById: OWNER_ID }));

      const res = await getResearchJobAction('job-1');
      expect(res.success).toBe(true);
    });

    it('cannot access another user\'s candidate by guessing/changing the candidate ID', async () => {
      currentUser = makeUser({ id: OTHER_USER_ID, permissions: ['ai_research.view'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate({ researchJob: { id: 'job-1', createdById: OWNER_ID, location: 'Amman', area: null } }));

      const res = await getCandidateDetailAction('candidate-1');
      expect(res.success).toBe(false);
    });
  });

  describe('Approval authorization', () => {
    it('rejects approval from a user without ai_research.approve', async () => {
      currentUser = makeUser({ permissions: ['ai_research.view', 'schools.create'] });
      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(false);
      expect(prismaMock.schoolResearchCandidate.updateMany).not.toHaveBeenCalled();
    });

    it('AI Research approval cannot bypass schools.create — ai_research.approve alone is not enough', async () => {
      currentUser = makeUser({ permissions: ['ai_research.view', 'ai_research.approve'] });
      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/schools\.create/);
      expect(prismaMock.schoolResearchCandidate.updateMany).not.toHaveBeenCalled();
    });

    it('a user without ai_research.approve cannot approve a candidate regardless of job ownership', async () => {
      currentUser = makeUser({ id: OTHER_USER_ID, permissions: ['ai_research.view', 'schools.create'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate());
      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(false);
      expect(prismaMock.schoolResearchCandidate.updateMany).not.toHaveBeenCalled();
    });

    it('a user with ai_research.approve may approve a candidate from a job created by someone else (by design: approve is an admin-tier, org-wide capability, mirroring tickets.view_all)', async () => {
      currentUser = makeUser({ id: OTHER_USER_ID, permissions: ['ai_research.view', 'ai_research.approve', 'schools.create'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate());
      prismaMock.schoolResearchCandidate.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.school.create.mockResolvedValue({ id: 'school-new-1', name: 'XYZ International School' });

      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(true);
    });

    it('approves a valid NEW candidate end-to-end when fully authorized', async () => {
      currentUser = makeUser({ id: OWNER_ID, permissions: ['ai_research.view', 'ai_research.approve', 'schools.create'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate());
      prismaMock.schoolResearchCandidate.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.school.create.mockResolvedValue({ id: 'school-new-1', name: 'XYZ International School' });

      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(true);
      expect(prismaMock.school.create).toHaveBeenCalled();
      expect(prismaMock.schoolResearchCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'IMPORTED', importedSchoolId: 'school-new-1' }) })
      );
    });

    it('cannot import the same candidate twice (double-import race protection)', async () => {
      currentUser = makeUser({ id: OWNER_ID, permissions: ['ai_research.view', 'ai_research.approve', 'schools.create'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate());
      // Someone else already claimed it between the read and the write.
      prismaMock.schoolResearchCandidate.updateMany.mockResolvedValue({ count: 0 });

      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(false);
      expect(prismaMock.school.create).not.toHaveBeenCalled();
    });

    it('refuses to approve a candidate that was already imported', async () => {
      currentUser = makeUser({ id: OWNER_ID, permissions: ['ai_research.view', 'ai_research.approve', 'schools.create'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate({ status: 'IMPORTED', importedSchoolId: 'school-existing' }));

      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(false);
      expect(prismaMock.schoolResearchCandidate.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to approve a rejected candidate', async () => {
      currentUser = makeUser({ id: OWNER_ID, permissions: ['ai_research.view', 'ai_research.approve', 'schools.create'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate({ status: 'REJECTED', rejectionReason: 'Not a real school' }));

      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(false);
      expect(prismaMock.schoolResearchCandidate.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to approve a flagged duplicate directly — it must be reviewed ("keep as separate") first', async () => {
      currentUser = makeUser({ id: OWNER_ID, permissions: ['ai_research.view', 'ai_research.approve', 'schools.create'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate({ status: 'DUPLICATE', matchedSchoolId: 'school-existing' }));

      const res = await approveCandidateAction('candidate-1');
      expect(res.success).toBe(false);
      expect(prismaMock.schoolResearchCandidate.updateMany).not.toHaveBeenCalled();
    });

    it('always records the authenticated actor as decidedById — never a client-supplied value', async () => {
      currentUser = makeUser({ id: OWNER_ID, permissions: ['ai_research.view', 'ai_research.approve', 'schools.create'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate());
      prismaMock.schoolResearchCandidate.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.school.create.mockResolvedValue({ id: 'school-new-1', name: 'XYZ International School' });

      await approveCandidateAction('candidate-1');

      expect(prismaMock.schoolResearchCandidate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ decidedById: OWNER_ID }) })
      );
    });
  });

  describe('Rejection authorization', () => {
    it('rejects a rejection attempt from a user without ai_research.reject', async () => {
      currentUser = makeUser({ id: OWNER_ID, permissions: ['ai_research.view'] });
      const res = await rejectCandidateAction('candidate-1', 'not relevant');
      expect(res.success).toBe(false);
      expect(prismaMock.schoolResearchCandidate.update).not.toHaveBeenCalled();
    });

    it('allows a fully authorized user to reject a candidate and preserves history instead of deleting it', async () => {
      currentUser = makeUser({ id: OWNER_ID, permissions: ['ai_research.view', 'ai_research.reject'] });
      prismaMock.schoolResearchCandidate.findUnique.mockResolvedValue(baseCandidate());
      prismaMock.schoolResearchCandidate.update.mockResolvedValue(baseCandidate({ status: 'REJECTED', rejectionReason: 'Duplicate listing' }));

      const res = await rejectCandidateAction('candidate-1', 'Duplicate listing');
      expect(res.success).toBe(true);
      expect(prismaMock.schoolResearchCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) })
      );
    });
  });
});
