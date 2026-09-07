'use server';

import { requireAuth } from '@/lib/auth/session';
import { MessageService, SendMessageAttachmentInput } from '@/server/services/MessageService';
import prisma from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

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

      if (file.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File "${file.name}" exceeds maximum allowed size of 10MB`,
        };
      }

      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        // Some browsers or system configurations may leave mime-type blank or generic, check extension as fallback
        const ext = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
        if (!ext || !allowedExtensions.includes(ext)) {
          return {
            success: false,
            error: `File type "${file.type || ext}" is not allowed. Supported formats: Images, PDF, Word, Excel, PowerPoint, Text`,
          };
        }
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
      where: { isActive: true },
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
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, templates };
  } catch (err: any) {
    return { success: false, error: err.message, templates: [] };
  }
}
