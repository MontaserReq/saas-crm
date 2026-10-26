import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { WORKSPACE_OWNER_PERMISSIONS } from '../src/lib/onboarding/permissions';
import { assertDisposableSeedTarget } from '../src/lib/security/seedTarget';

let prisma: PrismaClient;

const permissionCodes = [...WORKSPACE_OWNER_PERMISSIONS,
  'users.view', 'users.create', 'users.update', 'users.update_department', 'users.change_password', 'users.delete', 'users.disable', 'roles.view', 'roles.create', 'roles.update', 'departments.view', 'departments.manage', 'task_types.manage',
  'schools.view', 'schools.create', 'schools.import', 'schools.update', 'schools.approve_edit', 'schools.approve_delete', 'schools.assign',
  'approval_requests.view', 'approval_requests.decide',
  'tickets.view_assigned', 'tickets.view_all', 'tickets.create', 'tickets.mark_seen', 'tickets.accept', 'tickets.reject', 'tickets.add_note', 'tickets.transfer', 'tickets.complete', 'tickets.close', 'tickets.delete',
  'attachments.upload', 'attachments.download', 'communications.log', 'analytics.view', 'analytics.view_users', 'analytics.view_tickets', 'analytics.view_time_spent', 'audit_logs.view', 'todo.manage_own', 'users.enable', 'users.manage_permissions', 'users.manage_roles', 'users.view_security', 'users.view_sessions', 'users.manage_access_restrictions', 'users.invalidate_sessions', 'users.transfer_work', 'users.manage_reporting',
  'roles.delete', 'roles.assign', 'schools.delete', 'schools.export', 'tickets.contact_attempt', 'tickets.resubmit', 'tickets.correction_request', 'tickets.resubmit_request', 'tickets.correction_approve', 'tickets.resubmit_approve', 'tickets.view_history', 'tickets.view_activity', 'tickets.assign', 'attachments.delete', 'attachments.view', 'audit_logs.export',
  'activity.view', 'activity.view_all', 'activity.view_ticket', 'activity.view_school', 'notifications.view', 'notifications.mark_read', 'notifications.mark_all_read', 'messages.view', 'messages.send', 'messages.attachments', 'messages.delete', 'messages.view_all', 'messages.groups.view', 'messages.groups.create', 'messages.groups.update', 'messages.groups.delete', 'chat.view', 'chat.send', 'chat.attachments',
  'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete', 'calendar.view_all', 'todo.view', 'todo.create', 'todo.update', 'todo.delete', 'search.view', 'reports.view', 'reports.generate', 'reports.export_pdf', 'notification_preferences.view', 'notification_preferences.manage', 'email_integrations.view', 'email_integrations.manage', 'customer_email.view', 'customer_email.send',
  'ai_research.view', 'ai_research.create', 'ai_research.run', 'ai_research.approve', 'ai_research.reject', 'ai_research.enrich', 'ai_assistant.view',
  'workflows.view', 'workflows.create', 'workflows.update', 'workflows.activate', 'workflows.execute', 'workflows.archive', 'workflows.executions.view',
] as const;

const adminCodes = [...WORKSPACE_OWNER_PERMISSIONS, 'workflows.view', 'workflows.create', 'workflows.update', 'workflows.activate', 'workflows.execute', 'workflows.archive', 'workflows.executions.view', 'users.view', 'roles.view', 'departments.manage', 'task_types.manage', 'schools.view', 'schools.create', 'schools.import', 'schools.update', 'schools.assign', 'schools.approve_edit', 'schools.approve_delete', 'approval_requests.view', 'approval_requests.decide', 'tickets.view_all', 'tickets.view_assigned', 'tickets.create', 'tickets.mark_seen', 'tickets.accept', 'tickets.reject', 'tickets.add_note', 'tickets.transfer', 'tickets.complete', 'tickets.close', 'attachments.upload', 'attachments.download', 'communications.log', 'analytics.view', 'audit_logs.view', 'todo.manage_own', 'users.enable', 'users.view_security', 'users.view_sessions', 'users.transfer_work', 'users.manage_reporting', 'schools.delete', 'schools.export', 'tickets.contact_attempt', 'tickets.resubmit', 'tickets.correction_request', 'tickets.resubmit_request', 'tickets.correction_approve', 'tickets.resubmit_approve', 'tickets.view_history', 'tickets.view_activity', 'tickets.assign', 'attachments.delete', 'activity.view', 'activity.view_all', 'activity.view_ticket', 'activity.view_school', 'notifications.view', 'notifications.mark_read', 'notifications.mark_all_read', 'messages.view', 'messages.send', 'messages.attachments', 'messages.delete', 'messages.groups.view', 'chat.view', 'chat.send', 'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete', 'calendar.view_all', 'todo.view', 'todo.create', 'todo.update', 'todo.delete', 'search.view', 'ai_research.view', 'ai_research.create', 'ai_research.run', 'ai_research.approve', 'ai_research.reject', 'ai_research.enrich', 'ai_assistant.view'] as const;
const managerCodes = ['workflows.view', 'workflows.create', 'workflows.update', 'workflows.activate', 'workflows.execute', 'workflows.archive', 'workflows.executions.view', 'schools.view', 'schools.create', 'schools.import', 'schools.update', 'schools.assign', 'tickets.view_assigned', 'tickets.view_all', 'tickets.mark_seen', 'tickets.accept', 'tickets.reject', 'tickets.add_note', 'tickets.transfer', 'attachments.upload', 'attachments.download', 'communications.log', 'todo.manage_own', 'tickets.contact_attempt', 'tickets.resubmit', 'tickets.view_history', 'tickets.view_activity', 'attachments.delete', 'activity.view', 'activity.view_ticket', 'notifications.view', 'notifications.mark_read', 'messages.view', 'messages.send', 'messages.attachments', 'messages.groups.view', 'chat.view', 'chat.send', 'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete', 'todo.view', 'todo.create', 'todo.update', 'todo.delete', 'search.view', 'ai_research.view', 'ai_research.create', 'ai_research.run', 'ai_research.reject', 'ai_research.enrich', 'ai_assistant.view'] as const;
const memberCodes = ['schools.view', 'tickets.view_assigned', 'tickets.mark_seen', 'tickets.accept', 'tickets.reject', 'tickets.add_note', 'tickets.transfer', 'tickets.complete', 'attachments.upload', 'attachments.download', 'communications.log', 'todo.manage_own', 'tickets.contact_attempt', 'tickets.resubmit', 'tickets.view_history', 'tickets.view_activity', 'activity.view', 'activity.view_ticket', 'notifications.view', 'notifications.mark_read', 'messages.view', 'messages.send', 'messages.attachments', 'messages.groups.view', 'chat.view', 'chat.send', 'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete', 'todo.view', 'todo.create', 'todo.update', 'todo.delete', 'search.view', 'ai_assistant.view'] as const;

const departmentsData = [
  { name: 'Management', code: 'MANAGEMENT', description: 'Executive leadership and team oversight' },
  { name: 'Public Relations (PR)', code: 'PR', description: 'PR strategy, media, partnerships and school outreach' },
  { name: 'School Outreach', code: 'SCHOOL_OUTREACH', description: 'Direct school relations and coordinator networking' },
] as const;

const usersData = [
  { name: 'Montaser', email: 'montaserreq@gmail.com', role: 'PLATFORM_ADMIN', department: 'MANAGEMENT' },
] as const;

const label = (code: string) => code.split('.').map((part) => part.replace(/_/g, ' ')).join(' ');

async function clearDatabase() {
  await prisma.calendarEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.schoolApprovalRequest.deleteMany();
  await prisma.ticketApprovalRequest.deleteMany();
  await prisma.communicationAttempt.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.messageGroupMember.deleteMany();
  await prisma.messageGroup.deleteMany();
  await prisma.messageRecipient.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatParticipant.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.note.deleteMany();
  await prisma.assignmentHistory.deleteMany();
  await prisma.ticketAssignee.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.schoolAssignment.deleteMany();
  await prisma.todo.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.loginSession.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.proposalTemplate.deleteMany();
  await prisma.departmentManager.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.department.deleteMany();
  await prisma.taskType.deleteMany();
  await prisma.messageTemplate.deleteMany();
}

async function grant(roleId: string, codes: readonly string[], permissions: Map<string, string>) {
  for (const code of new Set(codes)) await prisma.rolePermission.create({ data: { roleId, permissionId: permissions.get(code)! } });
}

async function main() {
  // This guard must remain before PrismaClient construction and every query.
  assertDisposableSeedTarget();
  prisma = new PrismaClient();
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword) throw new Error('SEED_DEFAULT_PASSWORD must be set before running the seed');
  await clearDatabase();
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const permissions = new Map<string, string>();
  for (const code of new Set(permissionCodes)) {
    const permission = await prisma.permission.create({ data: { code, name: label(code), module: code.split('.')[0], description: label(code) } });
    permissions.set(code, permission.id);
  }
  const roles = new Map<string, string>();
  const definitions = [
    ['PLATFORM_ADMIN', 'Platform Admin', permissionCodes], ['SUPER_ADMIN', 'Company Super Admin', permissionCodes], ['ADMIN', 'Administrator', adminCodes], ['SCHOOL_MANAGER', 'Operations Manager', [...managerCodes, 'tickets.correction_request', 'tickets.resubmit_request']], ['MEMBER', 'Team Member', [...memberCodes, 'tickets.correction_request', 'tickets.resubmit_request']],
  ] as const;
  for (const [name, displayName, codes] of definitions) {
    const role = await prisma.role.create({ data: { name, displayName, description: displayName, isSystem: true } });
    roles.set(name, role.id);
    await grant(role.id, codes, permissions);
  }
  const departments = new Map<string, string>();
  for (const department of departmentsData) departments.set(department.code, (await prisma.department.create({ data: department })).id);
  const users = new Map<string, string>();
  for (const data of usersData) {
    const user = await prisma.user.create({ data: { name: data.name, email: data.email.toLowerCase(), passwordHash, roleId: roles.get(data.role)!, departmentId: departments.get(data.department)!, isPlatformAdmin: data.role === 'PLATFORM_ADMIN' } });
    users.set(user.email, user.id);
  }
  const organization = await prisma.organization.upsert({
    where: { slug: 'codeline-local' },
    update: { name: 'CodeLine Local', isActive: true },
    create: { name: 'CodeLine Local', slug: 'codeline-local' },
  });
  await prisma.organizationMember.createMany({
    data: usersData.map((data) => ({
      organizationId: organization.id,
      userId: users.get(data.email.toLowerCase())!,
      roleId: roles.get(data.role)!,
      status: 'ACTIVE',
    })),
  });
  console.log('Clean account/RBAC seed completed', { users: await prisma.user.count(), roles: await prisma.role.count(), permissions: await prisma.permission.count(), departments: await prisma.department.count(), taskTypes: await prisma.taskType.count(), schools: await prisma.school.count(), tickets: await prisma.ticket.count(), todos: await prisma.todo.count(), notifications: await prisma.notification.count() });
}

main().catch((error) => { console.error('Seed failed:', error); process.exitCode = 1; }).finally(async () => { if (prisma) await prisma.$disconnect(); });
