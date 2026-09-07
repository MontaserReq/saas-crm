import { describe, it, expect, vi } from 'vitest';
import { createMessageSchema } from '@/lib/validation';
import { canAccessMessage, canAccessMessageAttachment } from '@/lib/permissions';
import { UserSession } from '@/types';
import prisma from '@/lib/db/prisma';

vi.mock('@/lib/db/prisma', () => ({
  default: {
    message: {
      findUnique: vi.fn(),
    },
    messageAttachment: {
      findUnique: vi.fn(),
    },
    messageRecipient: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Internal Messaging System - Unit & Security Tests', () => {
  const user1: UserSession = {
    id: 'user-1',
    name: 'Tariq PR',
    email: 'tariq@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'PR Officer',
    departmentId: 'dept-pr',
    departmentName: 'PR',
    permissions: [],
  };

  const user2: UserSession = {
    id: 'user-2',
    name: 'Sarah Outreach',
    email: 'sarah@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Outreach Officer',
    departmentId: 'dept-outreach',
    departmentName: 'School Outreach',
    permissions: [],
  };

  const user3: UserSession = {
    id: 'user-3',
    name: 'Third Party',
    email: 'third@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Data Collector',
    departmentId: 'dept-data',
    departmentName: 'Data Collection',
    permissions: [],
  };

  describe('Validation (createMessageSchema)', () => {
    it('passes validation with valid fields', () => {
      const input = {
        toUserIds: ['user-2', 'user-3'],
        ccUserIds: ['user-4'],
        subject: 'Weekly PR Campaign Update',
        content: 'Hi Team,\nPlease find the agenda attached.',
      };

      const parsed = createMessageSchema.parse(input);
      expect(parsed.toUserIds).toHaveLength(2);
      expect(parsed.ccUserIds).toHaveLength(1);
      expect(parsed.subject).toBe('Weekly PR Campaign Update');
    });

    it('rejects message with empty toUserIds array', () => {
      const input = {
        toUserIds: [],
        subject: 'Hello',
        content: 'Content',
      };

      expect(() => createMessageSchema.parse(input)).toThrow();
    });

    it('rejects message with empty subject or empty content', () => {
      expect(() =>
        createMessageSchema.parse({
          toUserIds: ['user-2'],
          subject: '',
          content: 'Some message',
        })
      ).toThrow();

      expect(() =>
        createMessageSchema.parse({
          toUserIds: ['user-2'],
          subject: 'Valid Subject',
          content: '',
        })
      ).toThrow();
    });
  });

  describe('Message Security & Scoped Access (canAccessMessage)', () => {
    it('allows sender to view the message', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-100',
        senderId: 'user-1',
        recipients: [
          { id: 'recip-1', userId: 'user-2' },
        ],
      });

      const canAccess = await canAccessMessage(user1, 'msg-100');
      expect(canAccess).toBe(true);
    });

    it('allows recipient to view the message', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-100',
        senderId: 'user-1',
        recipients: [
          { id: 'recip-1', userId: 'user-2' },
        ],
      });

      const canAccess = await canAccessMessage(user2, 'msg-100');
      expect(canAccess).toBe(true);
    });

    it('denies non-sender and non-recipient from viewing private message', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-100',
        senderId: 'user-1',
        recipients: [], // user3 not in recipients
      });

      const canAccess = await canAccessMessage(user3, 'msg-100');
      expect(canAccess).toBe(false);
    });
  });

  describe('Message Attachment Security (canAccessMessageAttachment)', () => {
    it('allows attachment access if user can access the message', async () => {
      (prisma.messageAttachment.findUnique as any).mockResolvedValue({
        id: 'att-1',
        messageId: 'msg-100',
      });

      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-100',
        senderId: 'user-1',
        recipients: [{ id: 'recip-1', userId: 'user-2' }],
      });

      const canAccess = await canAccessMessageAttachment(user2, 'att-1');
      expect(canAccess).toBe(true);
    });

    it('denies attachment access if user is not a participant of the message', async () => {
      (prisma.messageAttachment.findUnique as any).mockResolvedValue({
        id: 'att-1',
        messageId: 'msg-100',
      });

      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-100',
        senderId: 'user-1',
        recipients: [],
      });

      const canAccess = await canAccessMessageAttachment(user3, 'att-1');
      expect(canAccess).toBe(false);
    });
  });
});
