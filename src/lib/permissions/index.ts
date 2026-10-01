import { UserSession, RoleName, TicketStatus } from '@/types';
import prisma from '@/lib/db/prisma';
import { requireOrganizationId as requireTenantOrganizationId } from '@/lib/auth/organization';

export const PERMISSIONS = {
  // Users & Roles
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DISABLE: 'users.disable',
  USERS_ENABLE: 'users.enable',
  USERS_MANAGE_PERMISSIONS: 'users.manage_permissions',
  USERS_MANAGE_ROLES: 'users.manage_roles',
  USERS_VIEW_SECURITY: 'users.view_security',
  USERS_VIEW_SESSIONS: 'users.view_sessions',
  USERS_MANAGE_ACCESS_RESTRICTIONS: 'users.manage_access_restrictions',
  USERS_INVALIDATE_SESSIONS: 'users.invalidate_sessions',
  USERS_TRANSFER_WORK: 'users.transfer_work',
  USERS_MANAGE_REPORTING: 'users.manage_reporting',
  ROLES_VIEW: 'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',
  ROLES_ASSIGN: 'roles.assign',

  // Departments & Task Types
  DEPARTMENTS_MANAGE: 'departments.manage',
  DEPARTMENTS_VIEW: 'departments.view',
  TASK_TYPES_MANAGE: 'task_types.manage',

  // Schools
  SCHOOLS_VIEW: 'schools.view',
  SCHOOLS_CREATE: 'schools.create',
  SCHOOLS_IMPORT: 'schools.import',
  SCHOOLS_UPDATE: 'schools.update',
  SCHOOLS_APPROVE_EDIT: 'schools.approve_edit',
  SCHOOLS_APPROVE_DELETE: 'schools.approve_delete',
  SCHOOLS_ASSIGN: 'schools.assign',
  SCHOOLS_EXPORT: 'schools.export',
  SCHOOLS_DELETE: 'schools.delete',
  SCHOOLS_VIEW_ALL: 'schools.view_all',

  // Approval Requests
  APPROVAL_REQUESTS_VIEW: 'approval_requests.view',
  APPROVAL_REQUESTS_DECIDE: 'approval_requests.decide',

  // Tickets
  TICKETS_VIEW_ASSIGNED: 'tickets.view_assigned',
  TICKETS_VIEW_ALL: 'tickets.view_all',
  TICKETS_CREATE: 'tickets.create',
  TICKETS_MARK_SEEN: 'tickets.mark_seen',
  TICKETS_ACCEPT: 'tickets.accept',
  TICKETS_REJECT: 'tickets.reject',
  TICKETS_ADD_NOTE: 'tickets.add_note',
  TICKETS_TRANSFER: 'tickets.transfer',
  TICKETS_COMPLETE: 'tickets.complete',
  TICKETS_CLOSE: 'tickets.close',
  TICKETS_DELETE: 'tickets.delete',
  TICKETS_CONTACT_ATTEMPT: 'tickets.contact_attempt',
  TICKETS_RESUBMIT: 'tickets.resubmit',
  TICKETS_CORRECTION_REQUEST: 'tickets.correction_request',
  TICKETS_RESUBMIT_REQUEST: 'tickets.resubmit_request',
  TICKETS_CORRECTION_APPROVE: 'tickets.correction_approve',
  TICKETS_RESUBMIT_APPROVE: 'tickets.resubmit_approve',
  TICKETS_VIEW_HISTORY: 'tickets.view_history',
  TICKETS_VIEW_ACTIVITY: 'tickets.view_activity',
  TICKETS_ASSIGN: 'tickets.assign',

  // Attachments & Communication
  ATTACHMENTS_UPLOAD: 'attachments.upload',
  ATTACHMENTS_VIEW: 'attachments.view',
  ATTACHMENTS_DOWNLOAD: 'attachments.download',
  ATTACHMENTS_DELETE: 'attachments.delete',
  COMMUNICATIONS_LOG: 'communications.log',

  // Analytics & Audit
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_VIEW_USERS: 'analytics.view_users',
  ANALYTICS_VIEW_TICKETS: 'analytics.view_tickets',
  ANALYTICS_VIEW_SCHOOLS: 'analytics.view_schools',
  ANALYTICS_VIEW_TIME_SPENT: 'analytics.view_time_spent',
  AUDIT_LOGS_VIEW: 'audit_logs.view',
  AUDIT_LOGS_EXPORT: 'audit_logs.export',

  ACTIVITY_VIEW: 'activity.view',
  ACTIVITY_VIEW_ALL: 'activity.view_all',
  ACTIVITY_VIEW_TICKET: 'activity.view_ticket',
  ACTIVITY_VIEW_SCHOOL: 'activity.view_school',

  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MARK_READ: 'notifications.mark_read',
  NOTIFICATIONS_MARK_ALL_READ: 'notifications.mark_all_read',

  MESSAGES_VIEW: 'messages.view',
  MESSAGES_SEND: 'messages.send',
  MESSAGES_ATTACHMENTS: 'messages.attachments',
  MESSAGES_DELETE: 'messages.delete',
  MESSAGES_VIEW_ALL: 'messages.view_all',

  CHAT_VIEW: 'chat.view',
  CHAT_SEND: 'chat.send',
  CHAT_ATTACHMENTS: 'chat.attachments',

  CALENDAR_VIEW: 'calendar.view',
  CALENDAR_CREATE: 'calendar.create',
  CALENDAR_UPDATE: 'calendar.update',
  CALENDAR_DELETE: 'calendar.delete',
  CALENDAR_VIEW_ALL: 'calendar.view_all',

  // To-Do
  TODO_MANAGE_OWN: 'todo.manage_own',
  TODO_VIEW: 'todo.view',
  TODO_CREATE: 'todo.create',
  TODO_UPDATE: 'todo.update',
  TODO_DELETE: 'todo.delete',
  SEARCH_VIEW: 'search.view',

  REPORTS_VIEW: 'reports.view',
  REPORTS_GENERATE: 'reports.generate',
  REPORTS_EXPORT_PDF: 'reports.export_pdf',

  // AI School Research
  AI_RESEARCH_VIEW: 'ai_research.view',
  AI_RESEARCH_CREATE: 'ai_research.create',
  AI_RESEARCH_RUN: 'ai_research.run',
  AI_RESEARCH_APPROVE: 'ai_research.approve',
  AI_RESEARCH_REJECT: 'ai_research.reject',
  AI_RESEARCH_ENRICH: 'ai_research.enrich',

  // AI Knowledge Assistant (read-only chatbot)
  AI_ASSISTANT_VIEW: 'ai_assistant.view',

  // Proposals
  PROPOSALS_VIEW: 'proposals.view',
  PROPOSALS_CREATE: 'proposals.create',
  PROPOSALS_UPDATE: 'proposals.update',
  PROPOSALS_DELETE: 'proposals.delete',
  PROPOSALS_GENERATE: 'proposals.generate',
  PROPOSALS_TEMPLATE_VIEW: 'proposals.template.view',
  PROPOSALS_TEMPLATE_CREATE: 'proposals.template.create',
  PROPOSALS_TEMPLATE_UPDATE: 'proposals.template.update',
  PROPOSALS_TEMPLATE_DELETE: 'proposals.template.delete',
  DEALS_VIEW: 'deals.view',
  DEALS_CREATE: 'deals.create',
  DEALS_UPDATE: 'deals.update',
  DEALS_DELETE: 'deals.delete',
  PIPELINES_VIEW: 'pipelines.view',
  PIPELINES_MANAGE: 'pipelines.manage',
  TASKS_VIEW: 'tasks.view',
  TASKS_CREATE: 'tasks.create',
  TASKS_UPDATE: 'tasks.update',
  TASKS_DELETE: 'tasks.delete',
  CUSTOM_FIELDS_VIEW: 'custom_fields.view',
  CUSTOM_FIELDS_CREATE: 'custom_fields.create',
  CUSTOM_FIELDS_UPDATE: 'custom_fields.update',
  CUSTOM_FIELDS_DELETE: 'custom_fields.delete',
  ORGANIZATION_SETTINGS_VIEW: 'organization_settings.view',
  ORGANIZATION_SETTINGS_MANAGE: 'organization_settings.manage',
  WORKFLOWS_VIEW: 'workflows.view',
  WORKFLOWS_CREATE: 'workflows.create',
  WORKFLOWS_UPDATE: 'workflows.update',
  WORKFLOWS_ACTIVATE: 'workflows.activate',
  WORKFLOWS_EXECUTE: 'workflows.execute',
  WORKFLOWS_ARCHIVE: 'workflows.archive',
  WORKFLOW_EXECUTIONS_VIEW: 'workflows.executions.view',
} as const;

export function hasPermission(user: UserSession | null | undefined, permissionCode: string): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return user.permissions.includes(permissionCode);
}

export function hasRole(user: UserSession | null | undefined, allowedRoles: RoleName[]): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return allowedRoles.includes(user.role);
}

export function requirePermission(user: UserSession | null | undefined, permissionCode: string): void {
  if (!hasPermission(user, permissionCode)) throw new Error(`Forbidden: Missing permission ${permissionCode}`);
}

/**
 * Validates whether a user is authorized to access / view a specific ticket.
 * Rules:
 * - SUPER_ADMIN: Always allowed
 * - Users with TICKETS_VIEW_ALL (e.g. ADMIN): Allowed
 * - Creator of the ticket: Allowed
 * - Current or past assignee / viewer: Allowed (retained viewer access)
 */
export async function canAccessTicket(user: UserSession, ticketId: string): Promise<boolean> {
  if (!user) return false;
  const organizationId = requireTenantOrganizationId(user);
  if (user.role === 'SUPER_ADMIN') return true;
  if (hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) return true;

  // Check if ticket creator
  const ticket = typeof prisma.ticket.findFirst === 'function'
    ? await prisma.ticket.findFirst({ where: { id: ticketId, organizationId }, select: { createdById: true, organizationId: true } })
    : await prisma.ticket.findUnique({ where: { id: ticketId }, select: { createdById: true, organizationId: true } });
  if (ticket?.organizationId && ticket.organizationId !== organizationId) return false;
  if (ticket && ticket.createdById === user.id) return true;

  // Check if current or past assignee / viewer
  const assigneeRecord = await prisma.ticketAssignee.findFirst({
    where: {
      ticketId,
      userId: user.id,
      ticket: { organizationId },
    },
  });

  return !!assigneeRecord;
}

/**
 * Validates whether a user is authorized to perform state-changing actions or add notes on a ticket.
 * Rules:
 * - SUPER_ADMIN: Allowed (unless ticket is closed/rejected, or admin override)
 * - Users with TICKETS_VIEW_ALL: Allowed
 * - Regular users: Allowed ONLY if currently active current assignee (not past viewer) and ticket is NOT closed or rejected.
 */
export async function canPerformTicketAction(user: UserSession, ticketId: string): Promise<boolean> {
  if (!user) return false;
  const organizationId = requireTenantOrganizationId(user);
  if (user.role === 'SUPER_ADMIN') return true;
  if (hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) return true;

  const ticket = typeof prisma.ticket.findFirst === 'function'
    ? await prisma.ticket.findFirst({ where: { id: ticketId, organizationId }, select: { status: true, organizationId: true } })
    : await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true, organizationId: true } });
  if (ticket?.organizationId && ticket.organizationId !== organizationId) return false;

  if (!ticket) return false;
  if (ticket.status === 'CLOSED' || ticket.status === 'REJECTED') {
    return false;
  }

  const activeAssignee = await prisma.ticketAssignee.findFirst({
    where: {
      ticketId,
      userId: user.id,
      ticket: { organizationId },
      isCurrent: true,
      role: { not: 'VIEWER' },
    },
  });

  return !!activeAssignee;
}

/**
 * Checks if a user is authorized to access an attachment.
 * User must have access to the ticket that the attachment belongs to.
 */
export async function canAccessAttachment(user: UserSession, attachmentId: string): Promise<boolean> {
  if (!user) return false;
  const organizationId = requireTenantOrganizationId(user);
  if (user.role === 'SUPER_ADMIN') return true;

  const attachment = typeof prisma.attachment.findFirst === 'function'
    ? await prisma.attachment.findFirst({ where: { id: attachmentId, organizationId }, include: { note: true } })
    : await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { note: true } });

  if (!attachment) return false;
  if (attachment.organizationId && attachment.organizationId !== organizationId) return false;
  const ticketId = attachment.ticketId || attachment.note?.ticketId;
  if (!ticketId) return false;

  return canAccessTicket(user, ticketId);
}

/**
 * Ticket status transition validator state machine.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'TRANSFERRED', 'SEEN'],
  SEEN: ['ACCEPTED', 'REJECTED', 'TRANSFERRED', 'UNREACHABLE'],
  ACCEPTED: ['CLOSED', 'TRANSFERRED', 'IN_PROGRESS', 'COMPLETED', 'UNREACHABLE'],
  IN_PROGRESS: ['CLOSED', 'COMPLETED', 'TRANSFERRED', 'UNREACHABLE'],
  REJECTED: ['PENDING', 'ACCEPTED', 'TRANSFERRED'], // Correction/resubmission or admin reassignment
  TRANSFERRED: ['ACCEPTED', 'REJECTED', 'CLOSED', 'TRANSFERRED', 'SEEN', 'IN_PROGRESS'],
  UNREACHABLE: ['IN_PROGRESS', 'ACCEPTED', 'TRANSFERRED', 'CLOSED'],
  COMPLETED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [], // Terminal state
};

export function isValidStatusTransition(currentStatus: TicketStatus, nextStatus: TicketStatus): boolean {
  if (currentStatus === nextStatus) return true;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

/**
 * Checks if a user is authorized to access a message.
 * User must be the sender OR a recipient (TO/CC).
 */
export async function canAccessMessage(user: UserSession, messageId: string): Promise<boolean> {
  if (!user) return false;
  const organizationId = requireTenantOrganizationId(user);

  const message = typeof prisma.message.findFirst === 'function'
    ? await prisma.message.findFirst({ where: { id: messageId, organizationId }, select: { senderId: true, organizationId: true, recipients: { where: { userId: user.id }, select: { id: true } } } })
    : await prisma.message.findUnique({ where: { id: messageId }, select: { senderId: true, organizationId: true, recipients: { where: { userId: user.id }, select: { id: true } } } });

  if (!message) return false;
  if (message.organizationId && message.organizationId !== organizationId) return false;
  if (message.senderId === user.id) return true;
  return message.recipients.length > 0;
}

/**
 * Checks if a user is authorized to access a message attachment.
 */
export async function canAccessMessageAttachment(user: UserSession, attachmentId: string): Promise<boolean> {
  if (!user) return false;
  const organizationId = requireTenantOrganizationId(user);

  const attachment = typeof prisma.messageAttachment.findFirst === 'function'
    ? await prisma.messageAttachment.findFirst({ where: { id: attachmentId, organizationId }, select: { messageId: true, organizationId: true } })
    : await prisma.messageAttachment.findUnique({ where: { id: attachmentId }, select: { messageId: true, organizationId: true } });

  if (!attachment) return false;
  if (attachment.organizationId && attachment.organizationId !== organizationId) return false;
  return canAccessMessage(user, attachment.messageId);
}
