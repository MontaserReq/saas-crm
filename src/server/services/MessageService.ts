import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { createMessageSchema } from '@/lib/validation';
import { getStorageProvider } from '@/lib/storage';
import { NotificationService } from './NotificationService';
import { AuditService } from './AuditService';
import { requireOrganizationIdForUserId } from '@/lib/auth/organization';

export interface SendMessageAttachmentInput {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface SendMessageInput {
  toUserIds: string[];
  ccUserIds?: string[];
  subject: string;
  content: string;
  attachments?: SendMessageAttachmentInput[];
}

export class MessageService {
  private static async organizationForUser(userId: string): Promise<string> {
    return requireOrganizationIdForUserId(userId);
  }
  /**
   * List inbox messages for a user (messages where user is in TO or CC).
   */
  static async listInbox(
    userId: string,
    filters: { search?: string; unreadOnly?: boolean; page?: number; pageSize?: number } = {}
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const skip = (page - 1) * pageSize;
    const organizationId = await this.organizationForUser(userId);

    const where: any = {
      userId,
      message: { organizationId },
      isDeleted: false,
    };

    if (filters.unreadOnly) {
      where.isRead = false;
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.message = {
        OR: [
          { subject: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
          { sender: { name: { contains: q, mode: 'insensitive' } } },
        ],
      };
    }

    const [total, recipientRecords] = await Promise.all([
      prisma.messageRecipient.count({ where }),
      prisma.messageRecipient.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          message: {
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                  department: { select: { id: true, name: true, code: true } },
                },
              },
              recipients: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              _count: {
                select: { attachments: true },
              },
            },
          },
        },
      }),
    ]);

    const messages = recipientRecords.map((r) => ({
      id: r.message.id,
      recipientId: r.id,
      type: r.type as 'TO' | 'CC',
      isRead: r.isRead,
      readAt: r.readAt,
      subject: r.message.subject,
      content: r.message.content,
      createdAt: r.message.createdAt,
      sender: r.message.sender,
      recipients: r.message.recipients,
      attachmentsCount: r.message._count.attachments,
    }));

    return {
      data: messages,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * List sent messages by a user.
   */
  static async listSent(
    userId: string,
    filters: { search?: string; page?: number; pageSize?: number } = {}
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const skip = (page - 1) * pageSize;
    const organizationId = await this.organizationForUser(userId);

    const where: any = {
      senderId: userId,
      organizationId,
    };

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        {
          recipients: {
            some: {
              user: { name: { contains: q, mode: 'insensitive' } },
            },
          },
        },
      ];
    }

    const [total, messages] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
          recipients: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: { attachments: true },
          },
        },
      }),
    ]);

    const formatted = messages.map((m) => ({
      id: m.id,
      subject: m.subject,
      content: m.content,
      createdAt: m.createdAt,
      sender: m.sender,
      recipients: m.recipients,
      attachmentsCount: m._count.attachments,
    }));

    return {
      data: formatted,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Retrieve a message by ID. Scoped strictly: user must be sender or recipient.
   * If user is a recipient with isRead=false, automatically marks it as read.
   */
  static async getMessageById(user: UserSession, messageId: string) {
    const organizationId = await this.organizationForUser(user.id);
    const message = await prisma.message.findFirst({
      where: { id: messageId, organizationId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                department: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Check authorization: must be sender OR one of the recipients
    const isSender = message.senderId === user.id;
    const recipientRecord = message.recipients.find((r) => r.userId === user.id);

    if (!isSender && !recipientRecord) {
      throw new Error('Unauthorized to view this message');
    }

    // Auto mark as read for current recipient if unread
    if (recipientRecord && !recipientRecord.isRead) {
      await prisma.messageRecipient.update({
        where: { id: recipientRecord.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
      recipientRecord.isRead = true;
      recipientRecord.readAt = new Date();
    }

    return message;
  }

  /**
   * Send a new message to one or more recipients (TO & optional CC).
   */
  static async sendMessage(user: UserSession, input: SendMessageInput) {
    const validated = createMessageSchema.parse({
      toUserIds: input.toUserIds,
      ccUserIds: input.ccUserIds || [],
      subject: input.subject,
      content: input.content,
    });
    const organizationId = await this.organizationForUser(user.id);

    // Deduplicate recipients: ensure TO takes precedence over CC, avoid sending to self multiple times
    const toSet = new Set(validated.toUserIds);
    const ccSet = new Set((validated.ccUserIds || []).filter((id) => !toSet.has(id)));

    const recipientEntries: Array<{ userId: string; type: 'TO' | 'CC' }> = [];
    toSet.forEach((userId) => recipientEntries.push({ userId, type: 'TO' }));
    ccSet.forEach((userId) => recipientEntries.push({ userId, type: 'CC' }));

    if (recipientEntries.length === 0) {
      throw new Error('At least one recipient is required');
    }
    const recipientCount = await prisma.organizationMember.count({ where: { organizationId, userId: { in: recipientEntries.map((r) => r.userId) }, status: 'ACTIVE' } });
    if (recipientCount !== recipientEntries.length) throw new Error('All recipients must belong to the active organization');

    // Process file attachments if any
    const uploadedAttachments: Array<{
      originalName: string;
      mimeType: string;
      size: number;
      storageKey: string;
      storageProvider: string;
      uploadedById: string;
    }> = [];

    if (input.attachments && input.attachments.length > 0) {
      const storage = getStorageProvider();
      try {
        for (const att of input.attachments) {
          const uploadResult = await storage.upload(att.buffer, att.originalName, att.mimeType, { keyPrefix: `${organizationId}/messages` });
          uploadedAttachments.push({
            originalName: uploadResult.originalName,
            mimeType: uploadResult.mimeType,
            size: uploadResult.size,
            storageKey: uploadResult.storageKey,
            storageProvider: storage.providerId,
            uploadedById: user.id,
          });
        }
      } catch (error) {
        await Promise.all(uploadedAttachments.map((attachment) => storage.delete(attachment.storageKey).catch(() => false)));
        throw error;
      }
    }

    // Atomic transaction
    let createdMessage;
    try {
      createdMessage = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          senderId: user.id,
          organizationId,
          subject: validated.subject,
          content: validated.content,
          recipients: {
            create: recipientEntries.map((r) => ({
              userId: r.userId,
              type: r.type,
            })),
          },
          attachments: {
            create: uploadedAttachments.map((attachment) => ({ ...attachment, organizationId })),
          },
        },
        include: {
          recipients: true,
          attachments: true,
        },
      });

      return message;
      });
    } catch (error) {
      const storage = getStorageProvider();
      await Promise.all(uploadedAttachments.map((attachment) => storage.delete(attachment.storageKey).catch(() => false)));
      throw error;
    }

    // Send notifications to all recipients in background / async
    for (const recipient of recipientEntries) {
      // Skip notifying self if sender included themselves
      if (recipient.userId !== user.id) {
        await NotificationService.create({
          userId: recipient.userId,
          type: 'NEW_MESSAGE',
          title: `رسالة داخلية جديدة: ${validated.subject}`,
          message: `${user.name}: ${validated.subject}`,
          entityType: 'message',
          entityId: createdMessage.id,
          organizationId,
        }).catch((err) => console.error('Failed to create notification for message recipient:', err));
      }
    }

    // Audit Log
    await AuditService.logAudit({
      actorId: user.id,
      action: 'MESSAGE_SENT',
      entityType: 'Message',
      entityId: createdMessage.id,
      metadata: {
        toCount: toSet.size,
        ccCount: ccSet.size,
        attachmentCount: uploadedAttachments.length,
        subject: validated.subject,
      },
    });

    return createdMessage;
  }

  /**
   * Get unread messages count for a user.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.messageRecipient.count({
      where: {
        userId,
        message: { organizationId: await this.organizationForUser(userId) },
        isRead: false,
        isDeleted: false,
      },
    });
  }

  /**
   * Soft delete a message from user's inbox.
   */
  static async deleteFromInbox(userId: string, messageId: string) {
    const organizationId = await this.organizationForUser(userId);
    return prisma.messageRecipient.updateMany({
      where: {
        userId,
        messageId,
        message: { organizationId },
      },
      data: {
        isDeleted: true,
      },
    });
  }
}
