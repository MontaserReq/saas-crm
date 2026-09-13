import { describe, expect, it } from 'vitest';
import { isValidJobTransition, isValidCandidateTransition } from '@/lib/ai-school-research/stateMachine';

describe('AI School Research: job state machine', () => {
  it('allows the normal happy path', () => {
    expect(isValidJobTransition('PENDING', 'RUNNING')).toBe(true);
    expect(isValidJobTransition('RUNNING', 'COMPLETED')).toBe(true);
  });

  it('allows a job to fail while running', () => {
    expect(isValidJobTransition('RUNNING', 'FAILED')).toBe(true);
  });

  it('rejects re-running a completed job', () => {
    expect(isValidJobTransition('COMPLETED', 'RUNNING')).toBe(false);
  });

  it('rejects re-running a failed or cancelled job', () => {
    expect(isValidJobTransition('FAILED', 'RUNNING')).toBe(false);
    expect(isValidJobTransition('CANCELLED', 'RUNNING')).toBe(false);
  });

  it('treats a no-op transition as valid', () => {
    expect(isValidJobTransition('RUNNING', 'RUNNING')).toBe(true);
  });
});

describe('AI School Research: candidate state machine', () => {
  it('allows approving a new or needs-review candidate', () => {
    expect(isValidCandidateTransition('NEW', 'APPROVED')).toBe(true);
    expect(isValidCandidateTransition('NEEDS_REVIEW', 'APPROVED')).toBe(true);
  });

  it('allows approved -> imported but nothing else after import', () => {
    expect(isValidCandidateTransition('APPROVED', 'IMPORTED')).toBe(true);
    expect(isValidCandidateTransition('IMPORTED', 'APPROVED')).toBe(false);
    expect(isValidCandidateTransition('IMPORTED', 'REJECTED')).toBe(false);
  });

  it('rejects approving a duplicate directly — it must go through NEEDS_REVIEW first ("keep as separate")', () => {
    expect(isValidCandidateTransition('DUPLICATE', 'APPROVED')).toBe(false);
    expect(isValidCandidateTransition('DUPLICATE', 'NEEDS_REVIEW')).toBe(true);
  });

  it('rejects re-rejecting an already rejected candidate as a new transition, but no-ops are fine', () => {
    expect(isValidCandidateTransition('REJECTED', 'REJECTED')).toBe(true);
    expect(isValidCandidateTransition('REJECTED', 'APPROVED')).toBe(false);
  });

  it('allows rejecting from NEW or NEEDS_REVIEW', () => {
    expect(isValidCandidateTransition('NEW', 'REJECTED')).toBe(true);
    expect(isValidCandidateTransition('NEEDS_REVIEW', 'REJECTED')).toBe(true);
  });
});
