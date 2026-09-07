import { describe, it, expect } from 'vitest';
import { AssignmentService } from '@/server/services/AssignmentService';

describe('Bulk School Assignment Equal Distribution Algorithm', () => {
  it('Evenly splits 50 schools across 3 team members (17, 17, 16)', () => {
    const schoolIds = Array.from({ length: 50 }, (_, i) => `school-${i + 1}`);
    const assigneeIds = ['user-ahmad', 'user-hala', 'user-noor'];

    const distribution = AssignmentService.distributeSchoolsEqually(schoolIds, assigneeIds);

    const ahmadCount = distribution.get('user-ahmad')?.length;
    const halaCount = distribution.get('user-hala')?.length;
    const noorCount = distribution.get('user-noor')?.length;

    expect(ahmadCount).toBe(17);
    expect(halaCount).toBe(17);
    expect(noorCount).toBe(16);

    const totalDistributed = (ahmadCount || 0) + (halaCount || 0) + (noorCount || 0);
    expect(totalDistributed).toBe(50);
  });

  it('Evenly splits 10 schools across 2 members (5, 5)', () => {
    const schoolIds = Array.from({ length: 10 }, (_, i) => `school-${i + 1}`);
    const assigneeIds = ['user-1', 'user-2'];

    const distribution = AssignmentService.distributeSchoolsEqually(schoolIds, assigneeIds);

    expect(distribution.get('user-1')?.length).toBe(5);
    expect(distribution.get('user-2')?.length).toBe(5);
  });

  it('No duplicate schools are assigned across different members', () => {
    const schoolIds = ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6'];
    const assigneeIds = ['user-1', 'user-2', 'user-3'];

    const distribution = AssignmentService.distributeSchoolsEqually(schoolIds, assigneeIds);

    const allAssigned: string[] = [];
    for (const schools of distribution.values()) {
      allAssigned.push(...schools);
    }

    const uniqueAssigned = new Set(allAssigned);
    expect(uniqueAssigned.size).toBe(schoolIds.length);
  });
});
