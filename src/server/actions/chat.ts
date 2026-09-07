'use server';
import { requireAuth } from '@/lib/auth/session';
import { ChatService } from '@/server/services/ChatService';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function getChatDataAction() { const u = await requireAuth(); if (!hasPermission(u, PERMISSIONS.CHAT_VIEW)) throw new Error('Forbidden'); const [users, conversations] = await Promise.all([prismaUsers(), ChatService.list(u.id)]); return { users, conversations }; }
async function prismaUsers() { const prisma = (await import('@/lib/db/prisma')).default; return prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true, avatar: true }, orderBy: { name: 'asc' } }); }
export async function startChatAction(otherUserId: string) { const u = await requireAuth(); if (!hasPermission(u, PERMISSIONS.CHAT_VIEW)) throw new Error('Forbidden'); return ChatService.direct(u, otherUserId); }
export async function getChatConversationAction(id: string) { const u = await requireAuth(); if (!hasPermission(u, PERMISSIONS.CHAT_VIEW)) throw new Error('Forbidden'); return ChatService.getConversation(u.id, id); }
export async function sendChatMessageAction(id: string, content: string) { const u = await requireAuth(); if (!hasPermission(u, PERMISSIONS.CHAT_SEND)) throw new Error('Forbidden'); return ChatService.send(u, id, content); }
export async function markChatReadAction(id: string) { const u = await requireAuth(); if (!hasPermission(u, PERMISSIONS.CHAT_VIEW)) throw new Error('Forbidden'); return ChatService.markRead(u.id, id); }
