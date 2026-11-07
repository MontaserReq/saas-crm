import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireOrganizationId } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS, requirePermission } from '@/lib/permissions';
import { UserSession } from '@/types';

export const EMPTY_DOCUMENT_CONTENT = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

const documentInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().min(1).max(1_000_000),
});

const shareInputSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['VIEWER', 'EDITOR']),
});

export function validateDocumentContent(content: string): string {
  if (content.length > 1_000_000) throw new Error('Document content is too large.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Document content is invalid.');
  }
  let nodes = 0;
  const allowedNodes = new Set(['doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'hardBreak', 'horizontalRule']);
  const allowedMarks = new Set(['bold', 'italic', 'strike', 'underline', 'code', 'link', 'textStyle']);
  const isSafeUrl = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\//i.test(value) && !/[\u0000-\u001f\u007f]/.test(value);
  const isSafeColor = (value: unknown): value is string => typeof value === 'string'
    && value.length <= 64
    && (/^#[0-9a-f]{3,8}$/i.test(value) || /^(?:rgb|rgba|hsl|hsla)\([^<>;{}]{1,56}\)$/i.test(value) || /^[a-z]+$/i.test(value));
  const isSafeFontFamily = (value: unknown): value is string => typeof value === 'string'
    && value.length <= 120
    && /^[a-z0-9\s,'"()_-]+$/i.test(value);
  const isSafeFontSize = (value: unknown): value is string => typeof value === 'string'
    && /^(?:0|[1-9]\d{0,2}(?:\.\d+)?)(?:px|pt|em|rem|%)$/.test(value);
  const validateTextStyle = (attrs: unknown): void => {
    if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) throw new Error('Document content is invalid.');
    const style = attrs as Record<string, unknown>;
    const allowedAttributes = new Set(['color', 'fontFamily', 'fontSize']);
    for (const key of Object.keys(style)) {
      if (!allowedAttributes.has(key)) throw new Error('Document content contains an unsupported format.');
    }
    if (style.color !== undefined && style.color !== null && !isSafeColor(style.color)) throw new Error('Document text color is invalid.');
    if (style.fontFamily !== undefined && style.fontFamily !== null && !isSafeFontFamily(style.fontFamily)) throw new Error('Document font family is invalid.');
    if (style.fontSize !== undefined && style.fontSize !== null && !isSafeFontSize(style.fontSize)) throw new Error('Document font size is invalid.');
  };
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Document content is invalid.');
    if (depth > 80 || ++nodes > 20_000) throw new Error('Document content is too complex.');
    const node = value as Record<string, unknown>;
    if (typeof node.type !== 'string' || node.type.length > 64 || !allowedNodes.has(node.type)) throw new Error('Document content contains an unsupported block.');
    if (typeof node.text === 'string' && node.text.length > 100_000) throw new Error('A text block is too large.');
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > 20) throw new Error('Document content is invalid.');
      for (const markValue of node.marks) {
        if (!markValue || typeof markValue !== 'object' || Array.isArray(markValue)) throw new Error('Document content is invalid.');
        const mark = markValue as Record<string, unknown>;
        if (typeof mark.type !== 'string' || !allowedMarks.has(mark.type)) throw new Error('Document content contains an unsupported format.');
        const attrs = mark.attrs;
        if (mark.type === 'link' && (!attrs || typeof attrs !== 'object' || Array.isArray(attrs) || !isSafeUrl((attrs as Record<string, unknown>).href))) throw new Error('Only safe web links are allowed.');
        if (mark.type === 'textStyle') validateTextStyle(attrs);
      }
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) throw new Error('Document content is invalid.');
      node.content.forEach(child => visit(child, depth + 1));
    }
  };
  visit(parsed, 0);
  if ((parsed as { type?: string }).type !== 'doc') throw new Error('Document root is invalid.');
  return content;
}

function canEditDocument(user: UserSession, document: { createdById: string; permissions: Array<{ userId: string; role: string }> }): boolean {
  return document.createdById === user.id
    || hasPermission(user, PERMISSIONS.DOCUMENTS_UPDATE)
    || document.permissions.some(permission => permission.userId === user.id && permission.role === 'EDITOR');
}

function canManageSharing(user: UserSession, document: { createdById: string }): boolean {
  return document.createdById === user.id || hasPermission(user, PERMISSIONS.DOCUMENTS_SHARE);
}

function assertWritable(user: UserSession): void {
  if (user.workspaceReadOnly) throw new Error('This workspace is read-only.');
}

export class DocumentService {
  static async list(user: UserSession, search?: string) {
    const organizationId = requireOrganizationId(user);
    requirePermission(user, PERMISSIONS.DOCUMENTS_VIEW);
    const query = search?.trim().slice(0, 100);
    return prisma.document.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { versions: true } },
      },
    });
  }

  static async get(user: UserSession, documentId: string) {
    const organizationId = requireOrganizationId(user);
    requirePermission(user, PERMISSIONS.DOCUMENTS_VIEW);
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId, status: 'ACTIVE' },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        permissions: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        _count: { select: { versions: true } },
      },
    });
    if (!document) throw new Error('Document not found.');
    return document;
  }

  static async create(user: UserSession, input: unknown) {
    const organizationId = requireOrganizationId(user);
    requirePermission(user, PERMISSIONS.DOCUMENTS_CREATE);
    const data = documentInputSchema.parse(input);
    const content = validateDocumentContent(data.content);
    return prisma.$transaction(async tx => {
      const document = await tx.document.create({
        data: { organizationId, title: data.title, content, createdById: user.id, updatedById: user.id },
        select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
      });
      await tx.documentVersion.create({
        data: { documentId: document.id, organizationId, title: document.title, content: document.content, createdById: user.id },
      });
      return document;
    });
  }

  static async update(user: UserSession, documentId: string, input: unknown, createVersion = false) {
    const organizationId = requireOrganizationId(user);
    assertWritable(user);
    const data = documentInputSchema.parse(input);
    const content = validateDocumentContent(data.content);
    const current = await prisma.document.findFirst({
      where: { id: documentId, organizationId, status: 'ACTIVE' },
      include: { permissions: { select: { userId: true, role: true } } },
    });
    if (!current) throw new Error('Document not found.');
    if (!canEditDocument(user, current)) throw new Error('Forbidden: you cannot edit this document.');
    return prisma.$transaction(async tx => {
      const document = await tx.document.update({
        where: { id: current.id },
        data: { title: data.title, content, updatedById: user.id },
        select: { id: true, title: true, content: true, updatedAt: true },
      });
      if (createVersion && (current.title !== data.title || current.content !== content)) {
        await tx.documentVersion.create({
          data: { documentId: document.id, organizationId, title: document.title, content: document.content, createdById: user.id },
        });
      }
      return document;
    });
  }

  static async archive(user: UserSession, documentId: string) {
    const organizationId = requireOrganizationId(user);
    assertWritable(user);
    const current = await prisma.document.findFirst({ where: { id: documentId, organizationId, status: 'ACTIVE' }, select: { id: true, createdById: true } });
    if (!current) throw new Error('Document not found.');
    requirePermission(user, PERMISSIONS.DOCUMENTS_DELETE);
    await prisma.document.update({ where: { id: current.id }, data: { status: 'ARCHIVED', updatedById: user.id } });
  }

  static async share(user: UserSession, documentId: string, input: unknown) {
    const organizationId = requireOrganizationId(user);
    assertWritable(user);
    const data = shareInputSchema.parse(input);
    const document = await prisma.document.findFirst({ where: { id: documentId, organizationId, status: 'ACTIVE' }, select: { id: true, createdById: true } });
    if (!document) throw new Error('Document not found.');
    if (!canManageSharing(user, document)) throw new Error('Forbidden: you cannot share this document.');
    const member = await prisma.organizationMember.findFirst({ where: { organizationId, userId: data.userId, status: 'ACTIVE', organization: { isActive: true } }, select: { userId: true } });
    if (!member) throw new Error('The selected user is not an active member of this workspace.');
    if (data.userId === document.createdById) throw new Error('The document owner already has full access.');
    return prisma.documentPermission.upsert({
      where: { documentId_userId: { documentId: document.id, userId: data.userId } },
      create: { documentId: document.id, organizationId, userId: data.userId, role: data.role },
      update: { role: data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  static async listWorkspaceMembers(user: UserSession) {
    const organizationId = requireOrganizationId(user);
    requirePermission(user, PERMISSIONS.DOCUMENTS_VIEW);
    return prisma.user.findMany({
      where: { isActive: true, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }
}
