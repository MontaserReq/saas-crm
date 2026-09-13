import { describe, it, expect } from 'vitest';
import { findHelpTopic, HELP_TOPICS } from '@/lib/ai-assistant/helpKnowledgeBase';
import { AiAssistantToolService } from '@/server/services/AiAssistantToolService';
import { UserSession } from '@/types';

function makeUser(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'user@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Member',
    departmentId: 'dept-1',
    departmentName: 'Dept',
    permissions: [],
    ...overrides,
  };
}

describe('Help knowledge base — grounded in real UI, never invented', () => {
  it('every topic has non-empty EN and AR titles and at least one step', () => {
    for (const topic of HELP_TOPICS) {
      expect(topic.key).toBeTruthy();
      expect(topic.en.title.length).toBeGreaterThan(0);
      expect(topic.ar.title.length).toBeGreaterThan(0);
      expect(topic.en.steps.length).toBeGreaterThan(0);
      expect(topic.ar.steps.length).toBeGreaterThan(0);
    }
  });

  it('topic keys are unique', () => {
    const keys = HELP_TOPICS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('findHelpTopic resolves a known key', () => {
    expect(findHelpTopic('createTicket')?.key).toBe('createTicket');
  });

  it('findHelpTopic returns null for an unknown key rather than inventing a feature', () => {
    expect(findHelpTopic('deleteEverythingWizard')).toBeNull();
    expect(findHelpTopic('')).toBeNull();
  });
});

describe('AiAssistantToolService.help — permission-filtered topics', () => {
  it('returns the topic content when the user holds the required permission', () => {
    const user = makeUser({ permissions: ['tickets.create'] });
    const result = AiAssistantToolService.help(user, { topic: 'createTicket' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.key).toBe('createTicket');
  });

  it('returns forbidden (not the content) when the user lacks the topic\'s required permission', () => {
    const user = makeUser({ permissions: [] });
    const result = AiAssistantToolService.help(user, { topic: 'createTicket' });
    expect(result).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('SUPER_ADMIN can see every help topic regardless of direct permission grants', () => {
    const user = makeUser({ role: 'SUPER_ADMIN', permissions: [] });
    for (const topic of HELP_TOPICS) {
      const result = AiAssistantToolService.help(user, { topic: topic.key });
      expect(result.ok).toBe(true);
    }
  });

  it('returns null data (not an error, not invented content) for an unrecognized topic key', () => {
    const user = makeUser({ permissions: [] });
    const result = AiAssistantToolService.help(user, { topic: 'notARealFeature' });
    expect(result).toEqual({ ok: true, data: null });
  });

  it('returns null data when no topic is given at all', () => {
    const user = makeUser({ permissions: [] });
    const result = AiAssistantToolService.help(user, {});
    expect(result).toEqual({ ok: true, data: null });
  });
});
