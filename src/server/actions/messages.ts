'use server';

import { requireAuth } from '@/lib/auth/session';
import { MessageService, SendMessageAttachmentInput } from '@/server/services/MessageService';
import prisma from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { validateAttachmentBatch, validateAttachmentContent, validateAttachmentFile } from '@/lib/storage/attachmentPolicy';
import { requireOrganizationId } from '@/lib/auth/organization';
import { sendTransactionalEmail } from '@/lib/email';

export async function sendMessageAction(formData: FormData) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.MESSAGES_SEND) && !hasPermission(user, PERMISSIONS.CHAT_VIEW)) return { success: false, error: 'Forbidden' };

    const subject = (formData.get('subject') as string)?.trim() || '';
    const content = (formData.get('content') as string)?.trim() || '';
    const sendEmail = formData.get('sendEmail') === 'true';

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

    let groupIds: string[] = [];
    const rawGroups = formData.get('groupIds');
    if (typeof rawGroups === 'string' && rawGroups.trim()) {
      try {
        const parsed = JSON.parse(rawGroups);
        groupIds = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
      } catch {
        groupIds = rawGroups.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    if (!subject) {
      return { success: false, error: 'Subject is required' };
    }
    if (!content) {
      return { success: false, error: 'Message content is required' };
    }
    if ((!toUserIds || toUserIds.length === 0) && groupIds.length === 0) {
      return { success: false, error: 'Please select at least one recipient (To)' };
    }

    // Process file attachments
    const attachments: SendMessageAttachmentInput[] = [];
    const files = formData.getAll('attachments') as File[];
    const batchError = validateAttachmentBatch(files);
    if (batchError) return { success: false, error: batchError };
    if (files.some((file) => file instanceof File && file.size > 0) && !hasPermission(user, PERMISSIONS.MESSAGES_ATTACHMENTS)) return { success: false, error: 'Forbidden: message attachment permission required' };

    for (const file of files) {
      if (!file || !(file instanceof File) || file.size === 0) continue;

      const validationError = validateAttachmentFile(file);
      if (validationError) {
        return { success: false, error: validationError };
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentValidation = validateAttachmentContent(file, buffer);
      if (contentValidation.error) return { success: false, error: contentValidation.error };
      attachments.push({
        originalName: file.name,
        mimeType: contentValidation.mimeType,
        buffer,
      });
    }

    const message = await MessageService.sendMessage(user, {
      toUserIds,
      ccUserIds,
      groupIds,
      subject,
      content,
      attachments,
    });

    let emailWarning: string | undefined;
    if (sendEmail) {
      const groupUserIds = await MessageService.resolveGroupMemberIds(user, groupIds);
      const allToUserIds = [...new Set([...toUserIds, ...groupUserIds])];
      const recipients = await prisma.user.findMany({
        where: {
          id: { in: allToUserIds },
          isActive: true,
          organizationMemberships: { some: { organizationId: requireOrganizationId(user), status: 'ACTIVE' } },
        },
        select: { email: true },
      });

      try {
        for (const recipient of recipients) {
          await sendTransactionalEmail({
            to: recipient.email,
            subject,
            text: content,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.7;white-space:pre-wrap">${content.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] || char))}</div>`,
          });
        }
      } catch {
        console.warn('Internal message saved, but team email delivery failed');
        emailWarning = 'EMAIL_DELIVERY_FAILED';
      }
    }

    revalidatePath('/messages');
    revalidatePath('/chat');
    return { success: true, messageId: message.id, emailWarning };
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
    if (!hasPermission(user, PERMISSIONS.MESSAGES_SEND) && !hasPermission(user, PERMISSIONS.CHAT_VIEW)) return { success: false, error: 'Forbidden' };
    // Return all active team members except maybe current user or including everyone
    const users = await prisma.user.findMany({
      where: { isActive: true, organizationMemberships: { some: { organizationId: requireOrganizationId(user), status: 'ACTIVE' } } },
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

    const groups = await MessageService.listGroups(user);
    return { success: true, users, groups };
  } catch (err: any) {
    return { success: false, error: err.message, users: [], groups: [] };
  }
}

// Recipient lookup is intentionally separate from group lookup. The compose
// modal only needs active users, and should not wait for the heavier groups
// query used by the team-chat management panel.
export async function getMessagingRecipientsAction() {
  try {
    const user = await requireAuth();
    if (
      !hasPermission(user, PERMISSIONS.MESSAGES_SEND) &&
      !hasPermission(user, PERMISSIONS.CHAT_VIEW)
    ) {
      return { success: false as const, error: "Forbidden", users: [] };
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationMemberships: {
          some: {
            organizationId: requireOrganizationId(user),
            status: "ACTIVE",
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        role: {
          select: { displayName: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return { success: true as const, users };
  } catch (err: any) {
    return { success: false as const, error: err.message, users: [] };
  }
}

export async function createMessageGroupAction(input: { name: string; description?: string; memberIds: string[]; canMembersSend?: boolean }) {
  try {
    const user = await requireAuth();
    const group = await MessageService.createGroup(user, input);
    revalidatePath('/messages');
    revalidatePath('/chat');
    return { success: true as const, group };
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create message group' };
  }
}

export async function getMessageTemplatesAction() {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.MESSAGES_SEND)) return { success: false, error: 'Forbidden', templates: [] };
    const templates = await prisma.messageTemplate.findMany({
      where: { isActive: true, organizationId: requireOrganizationId(user) },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, templates };
  } catch (err: any) {
    return { success: false, error: err.message, templates: [] };
  }
}
