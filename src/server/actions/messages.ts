'use server';

import { requireAuth } from '@/lib/auth/session';
import { MessageService, SendMessageAttachmentInput } from '@/server/services/MessageService';
import prisma from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { validateAttachmentFile } from '@/lib/storage/attachmentPolicy';

export async function sendMessageAction(formData: FormData) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.MESSAGES_SEND)) return { success: false, error: 'Forbidden' };

    const subject = (formData.get('subject') as string)?.trim() || '';
    const content = (formData.get('content') as string)?.trim() || '';

    // Handle toUserIds
    let toUserIds: string[] = [];
    const rawTo = formData.get('toUserIds');
    if (typeof rawTo === 'string') {
      try {
        toUserIds = JSON.parse(rawTo);
      } catch {
        toUserIds = rawTo.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else {
      toUserIds = formData.getAll('toUserIds') as string[];
    }

    // Handle ccUserIds
    let ccUserIds: string[] = [];
    const rawCc = formData.get('ccUserIds');
    if (typeof rawCc === 'string' && rawCc.trim()) {
      try {
        ccUserIds = JSON.parse(rawCc);
      } catch {
        ccUserIds = rawCc.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else {
      ccUserIds = (formData.getAll('ccUserIds') as string[]).filter(Boolean);
    }

    if (!subject) {
      return { success: false, error: 'Subject is required' };
    }
    if (!content) {
      return { success: false, error: 'Message content is required' };
    }
    if (!toUserIds || toUserIds.length === 0) {
      return { success: false, error: 'Please select at least one recipient (To)' };
    }

    // Process file attachments
    const attachments: SendMessageAttachmentInput[] = [];
    const files = formData.getAll('attachments') as File[];
    if (files.some((file) => file instanceof File && file.size > 0) && !hasPermission(user, PERMISSIONS.MESSAGES_ATTACHMENTS)) return { success: false, error: 'Forbidden: message attachment permission required' };

    for (const file of files) {
      if (!file || !(file instanceof File) || file.size === 0) continue;

      const validationError = validateAttachmentFile(file);
      if (validationError) {
        return { success: false, error: validationError };
      }

      const arrayBuffer = await file.arrayBuffer();
      attachments.push({
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        buffer: Buffer.from(arrayBuffer),
      });
    }

    const message = await MessageService.sendMessage(user, {
      toUserIds,
      ccUserIds,
      subject,
      content,
      attachments,
    });

    revalidatePath('/messages');
    return { success: true, messageId: message.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send message' };
  }
}

export async function deleteMessageFromInboxAction(messageId: string) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.MESSAGES_DELETE)) return { success: false, error: 'Forbidden' };
    await MessageService.deleteFromInbox(user.id, messageId);
    revalidatePath('/messages');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete message' };
  }
}

export async function getTeamMembersForMessaging() {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.MESSAGES_SEND)) return { success: false, error: 'Forbidden' };
    // Return all active team members except maybe current user or including everyone
    const users = await prisma.user.findMany({
      where: { isActive: true, organizationMemberships: { some: { organizationId: user.organizationId || 'org_codeline_legacy', status: 'ACTIVE' } } },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        role: {
          select: {
            displayName: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { success: true, users };
  } catch (err: any) {
    return { success: false, error: err.message, users: [] };
  }
}

export async function getMessageTemplatesAction() {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.MESSAGES_SEND)) return { success: false, error: 'Forbidden', templates: [] };
    const templates = await prisma.messageTemplate.findMany({
      where: { isActive: true, organizationId: user.organizationId || 'org_codeline_legacy' },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, templates };
  } catch (err: any) {
    return { success: false, error: err.message, templates: [] };
  }
}
