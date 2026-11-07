import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodeSlackOAuthState, encodeSlackOAuthState, verifySlackRequestSignature } from '@/lib/integrations/slack';

describe('Slack integration security', () => {
  it('round-trips signed OAuth state and rejects stale state', () => {
    const now = Date.now();
    const encoded = encodeSlackOAuthState({ state: 'a'.repeat(64), userId: 'user_1', organizationId: 'org_1', issuedAt: now });
    expect(decodeSlackOAuthState(encoded, now)).toMatchObject({ state: 'a'.repeat(64), userId: 'user_1', organizationId: 'org_1' });
    expect(decodeSlackOAuthState(encoded, now + 10 * 60 * 1000 + 1)).toBeNull();
  });

  it('accepts only a fresh Slack signature for the exact raw body', () => {
    const previous = process.env.SLACK_SIGNING_SECRET;
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
    const body = JSON.stringify({ type: 'event_callback', team_id: 'T123' });
    const timestamp = '1700000000';
    const signature = `v0=${createHmac('sha256', process.env.SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${body}`).digest('hex')}`;
    expect(verifySlackRequestSignature(body, timestamp, signature, 1700000000)).toBe(true);
    expect(verifySlackRequestSignature(`${body} `, timestamp, signature, 1700000000)).toBe(false);
    expect(verifySlackRequestSignature(body, timestamp, signature, 1700000601)).toBe(false);
    if (previous === undefined) delete process.env.SLACK_SIGNING_SECRET;
    else process.env.SLACK_SIGNING_SECRET = previous;
  });
});

