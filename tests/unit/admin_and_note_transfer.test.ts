import { describe, it, expect } from 'vitest';
import { departmentSchema, taskTypeSchema, createNoteSchema } from '@/lib/validation';

describe('Department & Task Type Schemas and Note Transfer Validation', () => {
  it('Validates department schema creation and uppercase code requirement', () => {
    const valid = departmentSchema.parse({
      name: 'Media Operations',
      code: 'media',
      description: 'Handling social media coverage',
      isActive: true,
    });
    expect(valid.code).toBe('MEDIA');
    expect(valid.name).toBe('Media Operations');

    expect(() =>
      departmentSchema.parse({
        name: 'A',
        code: 'A',
      })
    ).toThrow();
  });

  it('Validates task type schema creation without a legacy code field', () => {
    const valid = taskTypeSchema.parse({
      name: 'Sponsorship Outreach',
      departmentId: 'department-1',
      members: [{ userId: 'user-1', responsibility: 'Outreach' }],
      description: 'Engaging sponsors',
      isActive: true,
    });
    expect(valid.name).toBe('Sponsorship Outreach');
    expect(valid.members[0].responsibility).toBe('Outreach');
  });

  it('Validates createNoteSchema with optional transferToUserId', () => {
    const noteWithoutTransfer = createNoteSchema.parse({
      ticketId: 'ticket-123',
      content: 'Called coordinator, meeting set for Monday.',
    });
    expect(noteWithoutTransfer.transferToUserId).toBeUndefined();

    const noteWithTransfer = createNoteSchema.parse({
      ticketId: 'ticket-123',
      content: 'I spoke with the principal. Handing over for in-person visit.',
      transferToUserId: 'user-hala-id',
    });
    expect(noteWithTransfer.transferToUserId).toBe('user-hala-id');
    expect(noteWithTransfer.ticketId).toBe('ticket-123');
  });
});
