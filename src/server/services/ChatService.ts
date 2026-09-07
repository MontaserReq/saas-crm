import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';

export class ChatService {
  static async list(userId: string) {
    const rows = await prisma.chatConversation.findMany({ where: { participants: { some: { userId } } }, orderBy: { updatedAt: 'desc' }, include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    return rows.map((c) => ({ ...c, unreadCount: c.messages.length && c.messages[0].senderId !== userId && c.participants.find((p) => p.userId === userId)?.lastReadAt && c.messages[0].createdAt > (c.participants.find((p) => p.userId === userId)?.lastReadAt as Date) ? 1 : 0 }));
  }

  static async getConversation(userId: string, conversationId: string) {
    const member = await prisma.chatParticipant.findFirst({ where: { conversationId, userId } });
    if (!member) throw new Error('Unauthorized chat access');
    return prisma.chatConversation.findUnique({ where: { id: conversationId }, include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } } } }, messages: { orderBy: { createdAt: 'asc' }, take: 100, include: { sender: { select: { id: true, name: true, avatar: true } } } } } });
  }

  static async direct(user: UserSession, otherUserId: string) {
    if (user.id === otherUserId) throw new Error('Cannot chat with yourself');
    const other = await prisma.user.findFirst({ where: { id: otherUserId, isActive: true }, select: { id: true } });
    if (!other) throw new Error('User not found');
    const existing = await prisma.chatConversation.findFirst({ where: { participants: { every: { userId: { in: [user.id, otherUserId] } } }, AND: [{ participants: { some: { userId: user.id } } }, { participants: { some: { userId: otherUserId } } }] } });
    if (existing) return existing;
    return prisma.chatConversation.create({ data: { participants: { create: [{ userId: user.id }, { userId: otherUserId }] } } });
  }

  static async send(user: UserSession, conversationId: string, content: string) {
    const clean = content.trim();
    if (!clean || clean.length > 4000) throw new Error('Message must be between 1 and 4000 characters');
    const member = await prisma.chatParticipant.findFirst({ where: { conversationId, userId: user.id } });
    if (!member) throw new Error('Unauthorized chat access');
    return prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({ data: { conversationId, senderId: user.id, content: clean }, include: { sender: { select: { id: true, name: true, avatar: true } } } });
      await tx.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return message;
    });
  }

  static async markRead(userId: string, conversationId: string) { return prisma.chatParticipant.updateMany({ where: { conversationId, userId }, data: { lastReadAt: new Date() } }); }
}
