import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationId } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export class ChatService {
  static async list(user: UserSession) {
    const organizationId = requireOrganizationId(user);
    const rows = await prisma.chatConversation.findMany({ where: { organizationId, participants: { some: { userId: user.id } } }, orderBy: { updatedAt: 'desc' }, include: { messageGroup: { select: { id: true, name: true, description: true, canMembersSend: true, createdById: true } }, participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    return rows.map((c) => ({ ...c, unreadCount: c.messages.length && c.messages[0].senderId !== user.id && c.participants.find((p) => p.userId === user.id)?.lastReadAt && c.messages[0].createdAt > (c.participants.find((p) => p.userId === user.id)?.lastReadAt as Date) ? 1 : 0 }));
  }

  static async getConversation(user: UserSession, conversationId: string) {
    const organizationId = requireOrganizationId(user);
    const member = await prisma.chatParticipant.findFirst({ where: { conversationId, userId: user.id, conversation: { organizationId } } });
    if (!member) throw new Error('Unauthorized chat access');
    const conversation = await prisma.chatConversation.findFirst({ where: { id: conversationId, organizationId }, include: { messageGroup: { select: { id: true, name: true, description: true, canMembersSend: true, createdById: true } }, participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } } } }, messages: { orderBy: { createdAt: 'asc' }, take: 100, include: { sender: { select: { id: true, name: true, avatar: true } } } } } });
    return conversation;
  }

  static async direct(user: UserSession, otherUserId: string) {
    if (user.id === otherUserId) throw new Error('Cannot chat with yourself');
    const organizationId = requireOrganizationId(user);
    const other = await prisma.user.findFirst({ where: { id: otherUserId, isActive: true, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
    if (!other) throw new Error('User not found');
    const existing = await prisma.chatConversation.findFirst({ where: { organizationId, participants: { every: { userId: { in: [user.id, otherUserId] } } }, AND: [{ participants: { some: { userId: user.id } } }, { participants: { some: { userId: otherUserId } } }] } });
    if (existing) return existing;
    return prisma.chatConversation.create({ data: { organizationId, participants: { create: [{ userId: user.id }, { userId: otherUserId }] } } });
  }

  static async group(user: UserSession, groupId: string) {
    if (!hasPermission(user, PERMISSIONS.MESSAGES_GROUPS_VIEW)) throw new Error('Forbidden: message group view permission required');
    const organizationId = requireOrganizationId(user);
    const canManageAllGroups = hasPermission(user, PERMISSIONS.MESSAGES_GROUPS_UPDATE)
      || hasPermission(user, PERMISSIONS.MESSAGES_GROUPS_DELETE);
    const group = await prisma.messageGroup.findFirst({
      where: { id: groupId, organizationId, ...(canManageAllGroups ? {} : { members: { some: { userId: user.id } } }) },
      include: { members: { select: { userId: true } } },
    });
    if (!group) throw new Error('Unauthorized team group access');

    const include = {
      messageGroup: { select: { id: true, name: true, description: true, canMembersSend: true, createdById: true } },
      participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } } } },
    } as const;
    const existing = await prisma.chatConversation.findUnique({ where: { messageGroupId: groupId }, include });
    if (existing) {
      if (canManageAllGroups && !existing.participants.some((participant) => participant.userId === user.id)) {
        await prisma.chatParticipant.create({ data: { conversationId: existing.id, userId: user.id } });
        return prisma.chatConversation.findUniqueOrThrow({ where: { id: existing.id }, include });
      }
      return existing;
    }

    const participantIds = [
      ...new Set([
        ...group.members.map((member) => member.userId),
        ...(canManageAllGroups ? [user.id] : []),
      ]),
    ];

    try {
      return await prisma.chatConversation.create({
        data: {
          organizationId,
          messageGroupId: groupId,
          participants: { create: participantIds.map((userId) => ({ userId })) },
        },
        include,
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const concurrent = await prisma.chatConversation.findUnique({ where: { messageGroupId: groupId }, include });
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  static async send(user: UserSession, conversationId: string, content: string) {
    const clean = content.trim();
    if (!clean || clean.length > 4000) throw new Error('Message must be between 1 and 4000 characters');
    const organizationId = requireOrganizationId(user);
    const member = await prisma.chatParticipant.findFirst({ where: { conversationId, userId: user.id, conversation: { organizationId } }, include: { conversation: { select: { messageGroup: { select: { createdById: true, canMembersSend: true } } } } } });
    if (!member) throw new Error('Unauthorized chat access');
    const group = member.conversation.messageGroup;
    if (group && !group.canMembersSend && group.createdById !== user.id) throw new Error('Only the group creator can send messages in this group');
    return prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({ data: { conversationId, senderId: user.id, content: clean }, include: { sender: { select: { id: true, name: true, avatar: true } } } });
      await tx.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return message;
    });
  }

  static async markRead(user: UserSession, conversationId: string) {
    const where = { conversationId, userId: user.id, conversation: { organizationId: requireOrganizationId(user) } };
    return prisma.chatParticipant.updateMany({ where, data: { lastReadAt: new Date() } });
  }
}
