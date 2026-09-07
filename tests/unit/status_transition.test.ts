import { describe, it, expect } from 'vitest';
import { isValidStatusTransition } from '@/lib/permissions';
import { TicketStatus } from '@/types';

describe('Ticket Status State Machine Transitions', () => {
  it('Allows valid lifecycle sequence: PENDING -> SEEN -> ACCEPTED -> IN_PROGRESS -> COMPLETED -> CLOSED', () => {
    expect(isValidStatusTransition('PENDING', 'SEEN')).toBe(true);
    expect(isValidStatusTransition('SEEN', 'ACCEPTED')).toBe(true);
    expect(isValidStatusTransition('ACCEPTED', 'IN_PROGRESS')).toBe(true);
    expect(isValidStatusTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(isValidStatusTransition('COMPLETED', 'CLOSED')).toBe(true);
  });

  it('Allows valid rejections from PENDING or SEEN', () => {
    expect(isValidStatusTransition('PENDING', 'REJECTED')).toBe(true);
    expect(isValidStatusTransition('SEEN', 'REJECTED')).toBe(true);
  });

  it('Blocks invalid and out-of-order status jumps', () => {
    // Cannot jump directly from PENDING to COMPLETED
    expect(isValidStatusTransition('PENDING', 'COMPLETED')).toBe(false);
    // Cannot jump directly from PENDING to IN_PROGRESS (must be seen & accepted)
    expect(isValidStatusTransition('PENDING', 'IN_PROGRESS')).toBe(false);
    // Closed tickets cannot transition
    expect(isValidStatusTransition('CLOSED', 'IN_PROGRESS')).toBe(false);
  });

  it('Allows transfers from active states', () => {
    expect(isValidStatusTransition('PENDING', 'TRANSFERRED')).toBe(true);
    expect(isValidStatusTransition('SEEN', 'TRANSFERRED')).toBe(true);
    expect(isValidStatusTransition('ACCEPTED', 'TRANSFERRED')).toBe(true);
    expect(isValidStatusTransition('IN_PROGRESS', 'TRANSFERRED')).toBe(true);
  });
});
