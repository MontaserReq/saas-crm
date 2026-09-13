import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSession } from '@/types';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    chatConversation: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    chatParticipant: { findFirst: vi.fn(), updateMany: vi.fn() },
    chatMessage: { create: vi.fn() },
    user: { findFirst: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (fn: any) => fn(prismaMock));
  return { prismaMock };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));

let currentUser: UserSession | null = null;
vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => {
    if (!currentUser) throw new Error('Unauthorized');
    return currentUser;
  },
}));

import {
  getChatConversationAction,
  sendChatMessageAction,
  markChatReadAction,
  startChatAction,
} from '@/server/actions/chat';

function makeUser(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'user@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Member',
    departmentId: 'dept-1',
    departmentName: 'Dept',
    permissions: ['chat.view', 'chat.send'],
    ...overrides,
  };
}

const CONVERSATION_ID = 'conversation-1';
const ATTACKER_ID = 'attacker-user';

describe('Chat — access control (IDOR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
  });

  it('rejects an unauthenticated caller from reading a conversation', async () => {
    const res: any = await getChatConversationAction(CONVERSATION_ID).catch((e) => ({ error: e.message }));
    expect(res).toEqual({ error: 'Unauthorized' });
    expect(prismaMock.chatConversation.findUnique).not.toHaveBeenCalled();
  });

  it('a user who is not a participant cannot read the conversation by guessing its ID', async () => {
    currentUser = makeUser({ id: ATTACKER_ID });
    // Not a member — ChatService.getConversation throws before ever loading the conversation.
    prismaMock.chatParticipant.findFirst.mockResolvedValue(null);

    await expect(getChatConversationAction(CONVERSATION_ID)).rejects.toThrow(/unauthorized/i);
    expect(prismaMock.chatConversation.findUnique).not.toHaveBeenCalled();
  });

  it('a participant can read the conversation', async () => {
    currentUser = makeUser({ id: 'participant-1' });
    prismaMock.chatParticipant.findFirst.mockResolvedValue({ id: 'p1', conversationId: CONVERSATION_ID, userId: 'participant-1' });
    prismaMock.chatConversation.findUnique.mockResolvedValue({ id: CONVERSATION_ID, participants: [], messages: [] });

    const result = await getChatConversationAction(CONVERSATION_ID);
    expect(result).toBeTruthy();
    expect(prismaMock.chatConversation.findUnique).toHaveBeenCalled();
  });

  it('a user cannot send a message into a conversation they do not belong to', async () => {
    currentUser = makeUser({ id: ATTACKER_ID });
    prismaMock.chatParticipant.findFirst.mockResolvedValue(null);

    await expect(sendChatMessageAction(CONVERSATION_ID, 'Pretending to be a member')).rejects.toThrow(/unauthorized/i);
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });

  it('sendChatMessageAction requires chat.send permission even for an authenticated participant', async () => {
    currentUser = makeUser({ permissions: ['chat.view'] }); // no chat.send
    await expect(sendChatMessageAction(CONVERSATION_ID, 'hi')).rejects.toThrow(/forbidden/i);
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });

  it('markChatReadAction only marks read for conversations the caller actually participates in (scoped by userId+conversationId, not conversationId alone)', async () => {
    currentUser = makeUser({ id: 'participant-1' });
    await markChatReadAction(CONVERSATION_ID);
    expect(prismaMock.chatParticipant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId: CONVERSATION_ID, userId: 'participant-1' } })
    );
  });

  it('startChatAction requires chat.view permission', async () => {
    currentUser = makeUser({ permissions: [] });
    await expect(startChatAction('some-other-user')).rejects.toThrow(/forbidden/i);
    expect(prismaMock.chatConversation.create).not.toHaveBeenCalled();
  });
});
