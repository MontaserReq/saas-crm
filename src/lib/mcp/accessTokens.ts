import { createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { getAuthSecret } from '@/lib/auth/config';
import { getUserSessionForOrganization } from '@/lib/auth/session';
import type { UserSession } from '@/types';

export const MCP_TOKEN_PREFIX = 'sat_mcp_';
export const MCP_SCOPES = ['crm.read'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

const tokenNameSchema = z.string().trim().min(1).max(80);
const tokenSecretSchema = z.string().min(40).max(256);

export type McpTokenRecord = {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  scopes: McpScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type AuthenticatedMcpToken = {
  token: McpTokenRecord;
  user: UserSession;
};

function tokenDigest(rawToken: string): string {
  return createHmac('sha256', getAuthSecret()).update(rawToken).digest('hex');
}

export function parseMcpScopes(value: unknown): McpScope[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((scope): scope is McpScope => typeof scope === 'string' && (MCP_SCOPES as readonly string[]).includes(scope))));
}

function decodeStoredScopes(value: string): McpScope[] {
  try {
    return parseMcpScopes(JSON.parse(value));
  } catch {
    return [];
  }
}

function toTokenRecord(row: {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  scopes: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): McpTokenRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: decodeStoredScopes(row.scopes),
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export function validateMcpTokenName(value: unknown): string {
  return tokenNameSchema.parse(value);
}

export function validateMcpTokenSecret(value: string): boolean {
  return value.startsWith(MCP_TOKEN_PREFIX) && tokenSecretSchema.safeParse(value).success;
}

export async function createMcpAccessToken(input: {
  organizationId: string;
  userId: string;
  name: string;
  scopes?: unknown;
  expiresAt?: Date | null;
}): Promise<{ rawToken: string; token: McpTokenRecord }> {
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: input.organizationId, userId: input.userId, status: 'ACTIVE', organization: { isActive: true }, user: { isActive: true } },
    select: { id: true },
  });
  if (!membership) throw new Error('Active organization membership is required');

  const name = validateMcpTokenName(input.name);
  const scopes = parseMcpScopes(input.scopes ?? ['crm.read']);
  if (!scopes.length) throw new Error('At least one supported MCP scope is required');

  const now = new Date();
  if (input.expiresAt && input.expiresAt <= now) throw new Error('MCP token expiry must be in the future');
  const maxExpiry = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
  if (input.expiresAt && input.expiresAt > maxExpiry) throw new Error('MCP token expiry cannot exceed one year');

  const rawToken = `${MCP_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const row = await prisma.mcpAccessToken.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      name,
      tokenPrefix: rawToken.slice(0, 20),
      tokenHash: tokenDigest(rawToken),
      scopes: JSON.stringify(scopes),
      expiresAt: input.expiresAt ?? null,
    },
  });

  return { rawToken, token: toTokenRecord(row) };
}

export async function authenticateMcpAccessToken(rawToken: string): Promise<AuthenticatedMcpToken | null> {
  if (!validateMcpTokenSecret(rawToken)) return null;

  const row = await prisma.mcpAccessToken.findUnique({ where: { tokenHash: tokenDigest(rawToken) } });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= new Date())) return null;

  const scopes = decodeStoredScopes(row.scopes);
  if (!scopes.length) return null;

  const user = await getUserSessionForOrganization(row.userId, row.organizationId);
  if (!user) return null;

  // Usage metadata is intentionally best-effort; it must never turn a valid
  // authenticated request into a failure or expose token details in logs.
  void prisma.mcpAccessToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

  return { token: toTokenRecord({ ...row, scopes: JSON.stringify(scopes) }), user };
}

export async function listMcpAccessTokens(organizationId: string, userId: string): Promise<McpTokenRecord[]> {
  const rows = await prisma.mcpAccessToken.findMany({
    where: { organizationId, userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toTokenRecord);
}

export async function revokeMcpAccessToken(organizationId: string, userId: string, id: string): Promise<boolean> {
  const result = await prisma.mcpAccessToken.updateMany({
    where: { id, organizationId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count === 1;
}
