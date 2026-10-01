import prisma from '@/lib/db/prisma';
import { schoolSchema } from '@/lib/validation';
import { AuditService } from './AuditService';
import { SchoolService } from './SchoolService';
import { isValidCandidateTransition, ResearchCandidateStatus } from '@/lib/ai-school-research/stateMachine';

export class SchoolResearchCandidateService {
  private static async organizationForActor(actorId: string): Promise<string> {
    const membership = prisma.organizationMember?.findFirst ? await prisma.organizationMember.findFirst({ where: { userId: actorId, status: 'ACTIVE', organization: { isActive: true } }, orderBy: { createdAt: 'asc' }, select: { organizationId: true } }) : null;
    return membership?.organizationId || 'org_codeline_legacy';
  }
  /**
   * Approves a candidate into the official School Registry.
   *
   * Double-import safety: the candidate is first "claimed" with a
   * conditional update (status must still be NEW/NEEDS_REVIEW and
   * importedSchoolId must still be null) — if the row count is 0, someone
   * already approved/imported it (or it's in a non-approvable state), so we
   * fail fast instead of racing. School creation reuses SchoolService.createSchool
   * directly rather than a second creation implementation; if it fails, the
   * claim is rolled back so the candidate isn't left stuck.
   */
  static async approve(candidateId: string, actorId: string) {
    const organizationId = await this.organizationForActor(actorId);
    const candidate = prisma.schoolResearchCandidate.findFirst ? await prisma.schoolResearchCandidate.findFirst({ where: { id: candidateId, researchJob: { organizationId } } }) : await prisma.schoolResearchCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidate not found');
    if (candidate.importedSchoolId) throw new Error('This candidate has already been imported');
    if (!isValidCandidateTransition(candidate.status as ResearchCandidateStatus, 'APPROVED')) {
      throw new Error(`Candidate cannot be approved from its current status (${candidate.status})`);
    }

    const claim = await prisma.schoolResearchCandidate.updateMany({
      where: { id: candidateId, status: candidate.status, importedSchoolId: null, researchJob: { organizationId } },
      data: { status: 'APPROVED', decidedById: actorId, decidedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new Error('Candidate was already decided by someone else. Please refresh and try again.');
    }

    try {
      const payload = schoolSchema.parse({
        name: candidate.name,
        contactPerson: candidate.contactPerson,
        phone: candidate.phone,
        email: candidate.email,
        city: candidate.city || 'Amman',
        area: candidate.area,
        classification: 'C',
        schoolType: candidate.schoolType || 'PRIVATE',
        notes: `Discovered via AI School Research (candidate confidence ${candidate.confidence}%). Website (not stored on School): ${candidate.website || 'N/A'}.`,
        status: 'ACTIVE',
      });

      const school = await SchoolService.createSchool(payload, actorId);

      await prisma.schoolResearchCandidate.update({
        where: { id: candidateId },
        data: { status: 'IMPORTED', importedSchoolId: school.id },
      });

      await AuditService.logAudit({
        actorId,
        action: 'AI_RESEARCH_CANDIDATE_IMPORTED',
        entityType: 'SchoolResearchCandidate',
        entityId: candidateId,
        metadata: { schoolId: school.id, name: candidate.name },
      });

      return school;
    } catch (err: any) {
      // Roll back the claim so the candidate isn't left stuck in APPROVED with no imported school.
      await prisma.schoolResearchCandidate.updateMany({
        where: { id: candidateId, status: 'APPROVED', importedSchoolId: null },
        data: { status: candidate.status, decidedById: null, decidedAt: null },
      });
      throw new Error(err.message || 'Failed to import candidate into the School Registry');
    }
  }

  static async bulkApprove(candidateIds: string[], actorId: string) {
    const results: { candidateId: string; success: boolean; schoolId?: string; error?: string }[] = [];
    for (const candidateId of candidateIds) {
      try {
        const school = await this.approve(candidateId, actorId);
        results.push({ candidateId, success: true, schoolId: school.id });
      } catch (err: any) {
        results.push({ candidateId, success: false, error: err.message || 'Failed to approve candidate' });
      }
    }
    await AuditService.logAudit({
      actorId,
      action: 'AI_RESEARCH_CANDIDATES_BULK_APPROVED',
      entityType: 'SchoolResearchCandidate',
      metadata: { total: candidateIds.length, succeeded: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length },
    });
    return results;
  }

  static async reject(candidateId: string, actorId: string, reason?: string | null) {
    const organizationId = await this.organizationForActor(actorId);
    const candidate = prisma.schoolResearchCandidate.findFirst ? await prisma.schoolResearchCandidate.findFirst({ where: { id: candidateId, researchJob: { organizationId } } }) : await prisma.schoolResearchCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidate not found');
    if (!isValidCandidateTransition(candidate.status as ResearchCandidateStatus, 'REJECTED')) {
      throw new Error(`Candidate cannot be rejected from its current status (${candidate.status})`);
    }

    const updated = await prisma.schoolResearchCandidate.update({
      where: { id: candidateId },
      data: { status: 'REJECTED', rejectionReason: reason || null, decidedById: actorId, decidedAt: new Date() },
    });

    await AuditService.logAudit({
      actorId,
      action: 'AI_RESEARCH_CANDIDATE_REJECTED',
      entityType: 'SchoolResearchCandidate',
      entityId: candidateId,
      metadata: { name: candidate.name, reason },
    });

    return updated;
  }

  /** "Keep as Separate" on a flagged duplicate — sends it back to normal review instead of auto-approving. */
  static async keepAsSeparate(candidateId: string, actorId: string) {
    const organizationId = await this.organizationForActor(actorId);
    const candidate = prisma.schoolResearchCandidate.findFirst ? await prisma.schoolResearchCandidate.findFirst({ where: { id: candidateId, researchJob: { organizationId } } }) : await prisma.schoolResearchCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidate not found');
    if (!isValidCandidateTransition(candidate.status as ResearchCandidateStatus, 'NEEDS_REVIEW')) {
      throw new Error(`Candidate cannot be moved out of duplicate status from its current status (${candidate.status})`);
    }

    const updated = await prisma.schoolResearchCandidate.update({
      where: { id: candidateId },
      data: { status: 'NEEDS_REVIEW', matchedSchoolId: null },
    });

    await AuditService.logAudit({
      actorId,
      action: 'AI_RESEARCH_CANDIDATE_KEPT_SEPARATE',
      entityType: 'SchoolResearchCandidate',
      entityId: candidateId,
      metadata: { name: candidate.name },
    });

    return updated;
  }
}
