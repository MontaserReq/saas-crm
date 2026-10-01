import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';

export class ChatService {
  static async list(user: UserSession) {
    const organizationId = user.organizationId || 'org_codeline_legacy';
    const rows = await prisma.chatConversation.findMany({ where: { organizationId, participants: { some: { userId: user.id } } }, orderBy: { updatedAt: 'desc' }, include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    return rows.map((c) => ({ ...c, unreadCount: c.messages.length && c.messages[0].senderId !== user.id && c.participants.find((p) => p.userId === user.id)?.lastReadAt && c.messages[0].createdAt > (c.participants.find((p) => p.userId === user.id)?.lastReadAt as Date) ? 1 : 0 }));
  }

  static async getConversation(user: UserSession, conversationId: string) {
    const organizationId = user.organizationId || 'org_codeline_legacy';
    const member = await prisma.chatParticipant.findFirst({ where: { conversationId, userId: user.id, conversation: { organizationId } } });
    if (!member) throw new Error('Unauthorized chat access');
    const where = user.organizationId ? { id: conversationId, organizationId } : { id: conversationId };
    if (!user.organizationId) {
      return prisma.chatConversation.findUnique({ where: { id: conversationId }, include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } } } }, messages: { orderBy: { createdAt: 'asc' }, take: 100, include: { sender: { select: { id: true, name: true, avatar: true } } } } } });
    }
    const conversation = await prisma.chatConversation.findFirst({ where, include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } } } }, messages: { orderBy: { createdAt: 'asc' }, take: 100, include: { sender: { select: { id: true, name: true, avatar: true } } } } } });
    return conversation;
  }

  static async direct(user: UserSession, otherUserId: string) {
    if (user.id === otherUserId) throw new Error('Cannot chat with yourself');
    const organizationId = user.organizationId || 'org_codeline_legacy';
    const other = await prisma.user.findFirst({ where: { id: otherUserId, isActive: true, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
    if (!other) throw new Error('User not found');
    const existing = await prisma.chatConversation.findFirst({ where: { organizationId, participants: { every: { userId: { in: [user.id, otherUserId] } } }, AND: [{ participants: { some: { userId: user.id } } }, { participants: { some: { userId: otherUserId } } }] } });
    if (existing) return existing;
    return prisma.chatConversation.create({ data: { organizationId, participants: { create: [{ userId: user.id }, { userId: otherUserId }] } } });
  }

  static async send(user: UserSession, conversationId: string, content: string) {
    const clean = content.trim();
    if (!clean || clean.length > 4000) throw new Error('Message must be between 1 and 4000 characters');
    const organizationId = user.organizationId || 'org_codeline_legacy';
    const member = await prisma.chatParticipant.findFirst({ where: { conversationId, userId: user.id, conversation: { organizationId } } });
    if (!member) throw new Error('Unauthorized chat access');
    return prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({ data: { conversationId, senderId: user.id, content: clean }, include: { sender: { select: { id: true, name: true, avatar: true } } } });
      await tx.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return message;
    });
  }

  static async markRead(user: UserSession, conversationId: string) {
    const where = user.organizationId ? { conversationId, userId: user.id, conversation: { organizationId: user.organizationId } } : { conversationId, userId: user.id };
    return prisma.chatParticipant.updateMany({ where, data: { lastReadAt: new Date() } });
  }
}
