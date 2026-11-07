import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { getAuthSecret } from '@/lib/auth/config';
import { decryptSecret, encryptSecret, getAppUrl } from '@/lib/integrations/oauth';

export const SLACK_PROVIDER = 'SLACK';
const SLACK_API_ORIGIN = 'https://slack.com/api/';
const SLACK_OAUTH_TTL_MS = 10 * 60 * 1000;
const SLACK_EVENT_TOLERANCE_SECONDS = 5 * 60;

export type SlackConnectionMetadata = {
  teamId: string;
  teamName: string;
  botUserId: string | null;
  defaultChannelId: string | null;
  defaultChannelName: string | null;
};

export type SlackOAuthState = {
  state: string;
  userId: string;
  organizationId: string;
  issuedAt: number;
};

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  warning?: string;
  [key: string]: unknown;
};

type SlackOAuthResponse = SlackApiResponse & {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  bot_user_id?: string;
  team?: { id?: string; name?: string };
  authed_user?: { id?: string };
  scope?: string;
};

function integrationSecret() {
  return process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || getAuthSecret();
}

function slackCredentials() {
  return {
    clientId: process.env.SLACK_CLIENT_ID?.trim() || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET?.trim() || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET?.trim() || '',
  };
}

export function isSlackConfigured() {
  const credentials = slackCredentials();
  return Boolean(credentials.clientId && credentials.clientSecret && credentials.signingSecret);
}

export function getSlackRedirectUri(baseUrl?: string) {
  return `${getAppUrl(baseUrl)}/api/integrations/slack/callback`;
}

export function buildSlackInstallUrl(baseUrl?: string) {
  const { clientId } = slackCredentials();
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getSlackRedirectUri(baseUrl),
    scope: ['chat:write', 'channels:read', 'groups:read'].join(','),
  }).toString();
  return url;
}

export function encodeSlackOAuthState(value: SlackOAuthState) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = createHmac('sha256', integrationSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function decodeSlackOAuthState(value: string | null | undefined, now = Date.now()): SlackOAuthState | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;

  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  const expected = createHmac('sha256', integrationSecret()).update(payload).digest();
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SlackOAuthState>;
    if (typeof parsed.state !== 'string' || parsed.state.length < 32 || typeof parsed.userId !== 'string' || typeof parsed.organizationId !== 'string' || typeof parsed.issuedAt !== 'number') return null;
    if (parsed.issuedAt > now || now - parsed.issuedAt > SLACK_OAUTH_TTL_MS) return null;
    return { state: parsed.state, userId: parsed.userId, organizationId: parsed.organizationId, issuedAt: parsed.issuedAt };
  } catch {
    return null;
  }
}

export function parseSlackMetadata(value: string | null | undefined): SlackConnectionMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SlackConnectionMetadata>;
    if (typeof parsed.teamId !== 'string' || typeof parsed.teamName !== 'string') return null;
    return {
      teamId: parsed.teamId,
      teamName: parsed.teamName,
      botUserId: typeof parsed.botUserId === 'string' ? parsed.botUserId : null,
      defaultChannelId: typeof parsed.defaultChannelId === 'string' ? parsed.defaultChannelId : null,
      defaultChannelName: typeof parsed.defaultChannelName === 'string' ? parsed.defaultChannelName : null,
    };
  } catch {
    return null;
  }
}

export function serializeSlackMetadata(value: SlackConnectionMetadata) {
  return JSON.stringify(value);
}

export async function slackApi<T extends SlackApiResponse = SlackApiResponse>(method: string, token: string | null, params: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${SLACK_API_ORIGIN}${method}`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(params),
      signal: controller.signal,
      cache: 'no-store',
    });
    const body = await response.json() as T;
    if (!response.ok || !body.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Slack API request failed');
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export async function exchangeSlackCode(code: string, redirectUri: string) {
  return slackOAuthRequest({ code, redirect_uri: redirectUri });
}

async function slackOAuthRequest(params: Record<string, string>) {
  const credentials = slackCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${SLACK_API_ORIGIN}oauth.v2.access`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams(params),
      signal: controller.signal,
      cache: 'no-store',
    });
    const body = await response.json() as SlackOAuthResponse;
    if (!response.ok || !body.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Slack OAuth exchange failed');
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshSlackAccessToken(refreshToken: string) {
  return slackOAuthRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function getSlackIntegration(organizationId: string) {
  const integration = await prisma.externalIntegration.findUnique({
    where: { organizationId_provider: { organizationId, provider: SLACK_PROVIDER } },
    select: { id: true, organizationId: true, accessTokenEncrypted: true, refreshTokenEncrypted: true, scopes: true, metadata: true, tokenExpiresAt: true, updatedAt: true },
  });
  if (!integration) return null;
  const metadata = parseSlackMetadata(integration.metadata);
  if (!metadata) return null;
  try {
    const accessToken = decryptSecret(integration.accessTokenEncrypted);
    const refreshToken = integration.refreshTokenEncrypted ? decryptSecret(integration.refreshTokenEncrypted) : null;
    if (refreshToken && integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() <= Date.now() + 60_000) {
      try {
        const refreshed = await refreshSlackAccessToken(refreshToken);
        if (typeof refreshed.access_token === 'string' && refreshed.access_token) {
          const nextRefreshToken = typeof refreshed.refresh_token === 'string' && refreshed.refresh_token ? refreshed.refresh_token : refreshToken;
          const nextExpiry = typeof refreshed.expires_in === 'number' && refreshed.expires_in > 0 ? new Date(Date.now() + refreshed.expires_in * 1000) : null;
          await prisma.externalIntegration.update({ where: { id: integration.id, organizationId }, data: { accessTokenEncrypted: encryptSecret(refreshed.access_token), refreshTokenEncrypted: encryptSecret(nextRefreshToken), tokenExpiresAt: nextExpiry } });
          return { ...integration, metadata, accessToken: refreshed.access_token, refreshTokenEncrypted: encryptSecret(nextRefreshToken), tokenExpiresAt: nextExpiry };
        }
      } catch {
        const latest = await prisma.externalIntegration.findUnique({ where: { id: integration.id }, select: { accessTokenEncrypted: true, refreshTokenEncrypted: true, tokenExpiresAt: true, updatedAt: true } });
        if (latest && latest.updatedAt > integration.updatedAt) return { ...integration, ...latest, metadata, accessToken: decryptSecret(latest.accessTokenEncrypted) };
      }
    }
    return { ...integration, metadata, accessToken };
  } catch {
    return null;
  }
}

export async function listSlackChannels(organizationId: string) {
  const integration = await getSlackIntegration(organizationId);
  if (!integration) throw new Error('Slack is not connected');
  const response = await slackApi<SlackApiResponse & { channels?: Array<{ id?: string; name?: string; is_archived?: boolean; is_private?: boolean; is_member?: boolean }> }>('conversations.list', integration.accessToken, {
    types: 'public_channel,private_channel',
    exclude_archived: 'true',
    limit: '200',
  });
  return (response.channels || [])
    .filter((channel) => typeof channel.id === 'string' && typeof channel.name === 'string' && channel.is_archived !== true)
    .map((channel) => ({ id: channel.id as string, name: channel.name as string, isPrivate: channel.is_private === true, isMember: channel.is_member === true }));
}

function safeText(value: string, max = 800) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export async function postSlackMessage(organizationId: string, text: string, channelId?: string | null) {
  const integration = await getSlackIntegration(organizationId);
  if (!integration) return { sent: false as const, reason: 'not_connected' as const };
  const channel = channelId || integration.metadata.defaultChannelId;
  if (!channel) return { sent: false as const, reason: 'channel_not_configured' as const };
  await slackApi('chat.postMessage', integration.accessToken, { channel, text: safeText(text) });
  return { sent: true as const };
}

export async function saveSlackChannel(organizationId: string, channelId: string) {
  const integration = await getSlackIntegration(organizationId);
  if (!integration) throw new Error('Slack is not connected');
  const channels = await listSlackChannels(organizationId);
  const channel = channels.find((item) => item.id === channelId);
  if (!channel) throw new Error('Slack channel is not available to this app');
  await prisma.externalIntegration.update({
    where: { id: integration.id, organizationId },
    data: { metadata: serializeSlackMetadata({ ...integration.metadata, defaultChannelId: channel.id, defaultChannelName: channel.name }) },
  });
  return channel;
}

export async function sendSlackCrmNotification(input: { organizationId: string; title: string; details?: string; urlPath?: string }) {
  const baseUrl = getAppUrl();
  const link = input.urlPath ? `${baseUrl}${input.urlPath.startsWith('/') ? input.urlPath : `/${input.urlPath}`}` : null;
  const lines = [`*${safeText(input.title, 180)}*`];
  if (input.details) lines.push(safeText(input.details, 500));
  if (link) lines.push(link);
  return postSlackMessage(input.organizationId, lines.join('\n'));
}

export function verifySlackRequestSignature(rawBody: string, timestamp: string | null, signature: string | null, now = Math.floor(Date.now() / 1000)) {
  const signingSecret = slackCredentials().signingSecret;
  if (!signingSecret || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(now - timestampSeconds) > SLACK_EVENT_TOLERANCE_SECONDS) return false;
  const expected = `v0=${createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function encryptedSlackToken(value: string) {
  return encryptSecret(value);
}

