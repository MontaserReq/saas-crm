export type ResearchJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export const JOB_STATUS_TRANSITIONS: Record<ResearchJobStatus, ResearchJobStatus[]> = {
  PENDING: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isValidJobTransition(from: ResearchJobStatus, to: ResearchJobStatus): boolean {
  if (from === to) return true;
  return (JOB_STATUS_TRANSITIONS[from] || []).includes(to);
}

export type ResearchCandidateStatus = 'NEW' | 'NEEDS_REVIEW' | 'DUPLICATE' | 'APPROVED' | 'REJECTED' | 'IMPORTED';

export const CANDIDATE_STATUS_TRANSITIONS: Record<ResearchCandidateStatus, ResearchCandidateStatus[]> = {
  NEW: ['NEEDS_REVIEW', 'DUPLICATE', 'APPROVED', 'REJECTED'],
  NEEDS_REVIEW: ['DUPLICATE', 'APPROVED', 'REJECTED'],
  // "Keep as Separate" on a flagged duplicate sends it back for normal review/approval, never a direct auto-approve.
  DUPLICATE: ['NEEDS_REVIEW', 'REJECTED'],
  APPROVED: ['IMPORTED'],
  REJECTED: [],
  IMPORTED: [],
};

export function isValidCandidateTransition(from: ResearchCandidateStatus, to: ResearchCandidateStatus): boolean {
  if (from === to) return true;
  return (CANDIDATE_STATUS_TRANSITIONS[from] || []).includes(to);
}
