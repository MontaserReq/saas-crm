import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const permissionCodes = [
  'users.view', 'users.create', 'users.update', 'users.disable', 'roles.view', 'roles.create', 'roles.update', 'departments.manage', 'task_types.manage',
  'schools.view', 'schools.create', 'schools.import', 'schools.update', 'schools.approve_edit', 'schools.approve_delete', 'schools.assign',
  'tickets.view_assigned', 'tickets.view_all', 'tickets.create', 'tickets.mark_seen', 'tickets.accept', 'tickets.reject', 'tickets.add_note', 'tickets.transfer', 'tickets.complete', 'tickets.close',
  'attachments.upload', 'attachments.download', 'communications.log', 'analytics.view', 'audit_logs.view', 'todo.manage_own', 'users.enable', 'users.manage_permissions', 'users.manage_roles', 'users.view_security', 'users.view_sessions', 'users.manage_access_restrictions', 'users.invalidate_sessions', 'users.transfer_work', 'users.manage_reporting',
  'roles.delete', 'roles.assign', 'schools.delete', 'schools.export', 'tickets.contact_attempt', 'tickets.resubmit', 'tickets.view_history', 'tickets.view_activity', 'tickets.assign', 'attachments.delete', 'attachments.view', 'audit_logs.export',
  'activity.view', 'activity.view_all', 'activity.view_ticket', 'activity.view_school', 'notifications.view', 'notifications.mark_read', 'notifications.mark_all_read', 'messages.view', 'messages.send', 'messages.attachments', 'messages.delete', 'chat.view', 'chat.send',
  'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete', 'calendar.view_all', 'todo.view', 'todo.create', 'todo.update', 'todo.delete', 'search.view', 'reports.view', 'reports.generate', 'reports.export_pdf',
  'ai_research.view', 'ai_research.create', 'ai_research.run', 'ai_research.approve', 'ai_research.reject', 'ai_research.enrich', 'ai_assistant.view',
] as const;

const adminCodes = ['users.view', 'roles.view', 'departments.manage', 'task_types.manage', 'schools.view', 'schools.create', 'schools.import', 'schools.update', 'schools.assign', 'schools.approve_edit', 'schools.approve_delete', 'tickets.view_all', 'tickets.view_assigned', 'tickets.create', 'tickets.mark_seen', 'tickets.accept', 'tickets.reject', 'tickets.add_note', 'tickets.transfer', 'tickets.complete', 'tickets.close', 'attachments.upload', 'attachments.download', 'communications.log', 'analytics.view', 'audit_logs.view', 'todo.manage_own', 'users.enable', 'users.view_security', 'users.view_sessions', 'users.transfer_work', 'users.manage_reporting', 'schools.delete', 'schools.export', 'tickets.contact_attempt', 'tickets.resubmit', 'tickets.view_history', 'tickets.view_activity', 'tickets.assign', 'attachments.delete', 'activity.view', 'activity.view_all', 'activity.view_ticket', 'activity.view_school', 'notifications.view', 'notifications.mark_read', 'notifications.mark_all_read', 'messages.view', 'messages.send', 'messages.attachments', 'messages.delete', 'chat.view', 'chat.send', 'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete', 'calendar.view_all', 'todo.view', 'todo.create', 'todo.update', 'todo.delete', 'search.view', 'ai_research.view', 'ai_research.create', 'ai_research.run', 'ai_research.approve', 'ai_research.reject', 'ai_research.enrich', 'ai_assistant.view'] as const;
const managerCodes = ['schools.view', 'schools.create', 'schools.import', 'schools.update', 'schools.assign', 'tickets.view_assigned', 'tickets.mark_seen', 'tickets.accept', 'tickets.reject', 'tickets.add_note', 'tickets.transfer', 'attachments.upload', 'attachments.download', 'communications.log', 'todo.manage_own', 'tickets.contact_attempt', 'tickets.resubmit', 'tickets.view_history', 'tickets.view_activity', 'attachments.delete', 'activity.view', 'activity.view_ticket', 'notifications.view', 'notifications.mark_read', 'messages.view', 'messages.send', 'messages.attachments', 'chat.view', 'chat.send', 'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete', 'todo.view', 'todo.create', 'todo.update', 'todo.delete', 'search.view', 'ai_research.view', 'ai_research.create', 'ai_research.run', 'ai_research.reject', 'ai_research.enrich', 'ai_assistant.view'] as const;
const memberCodes = ['schools.view', 'tickets.view_assigned', 'tickets.mark_seen', 'tickets.accept', 'tickets.reject', 'tickets.add_note', 'tickets.transfer', 'tickets.complete', 'attachments.upload', 'attachments.download', 'communications.log', 'todo.manage_own', 'tickets.contact_attempt', 'tickets.resubmit', 'tickets.view_history', 'tickets.view_activity', 'activity.view', 'activity.view_ticket', 'notifications.view', 'notifications.mark_read', 'messages.view', 'messages.send', 'messages.attachments', 'chat.view', 'chat.send', 'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete', 'todo.view', 'todo.create', 'todo.update', 'todo.delete', 'search.view', 'ai_assistant.view'] as const;

const departmentsData = [
  { name: 'Management', code: 'MANAGEMENT', description: 'Executive leadership and team oversight' },
  { name: 'Public Relations (PR)', code: 'PR', description: 'PR strategy, media, partnerships and school outreach' },
  { name: 'School Outreach', code: 'SCHOOL_OUTREACH', description: 'Direct school relations and coordinator networking' },
] as const;

const usersData = [
  { name: '\u062d\u0645\u0632\u0629 \u0627\u0644\u0646\u062c\u0627\u0631', email: 'hamzaalnajjar382@gmail.com', role: 'MEMBER', department: 'SCHOOL_OUTREACH' },
  { name: '\u062d\u0644\u0627 \u0639\u0628\u062f\u0627\u0644\u0644\u0647', email: 'hallaabdallah03@gmail.com', role: 'SCHOOL_MANAGER', department: 'SCHOOL_OUTREACH' },
  { name: '\u0633\u0627\u0631\u0647 \u0627\u0644\u0642\u0632\u0642\u064a', email: 'Zujsara@gmail.com', role: 'MEMBER', department: 'SCHOOL_OUTREACH' },
  { name: '\u0634\u0630\u0649 \u0627\u0644\u0643\u0633\u062c\u064a', email: 'shathakasaji042@gmail.com', role: 'MEMBER', department: 'PR' },
  { name: '\u0645\u062d\u0645\u062f \u0639\u064a\u0633\u0627\u0648\u064a', email: 'i.mohammedmortadha@gmail.com', role: 'MEMBER', department: 'PR' },
  { name: '\u0648\u0633\u064a\u0645 \u0627\u0644\u0646\u0639\u0644\u0627\u0648\u064a', email: 'wasemnalawe@gmail.com', role: 'MEMBER', department: 'PR' },
  { name: 'Omar Haifawi', email: 'Omarhaifawi02@gmail.com', role: 'MEMBER', department: 'PR' },
  { name: 'Maher qatramiz', email: 'Maher.qat@gmail.com', role: 'MEMBER', department: 'PR' },
  { name: '\u0645\u064a\u0633\u0645 \u0627\u0644\u062f\u0627\u064a\u0645', email: 'hishammaysam@gmail.com', role: 'ADMIN', department: 'PR' },
  { name: 'Montaser', email: 'montaserreq@gmail.com', role: 'SUPER_ADMIN', department: 'MANAGEMENT' },
] as const;

const label = (code: string) => code.split('.').map((part) => part.replace(/_/g, ' ')).join(' ');

async function clearDatabase() {
  await prisma.calendarEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.schoolApprovalRequest.deleteMany();
  await prisma.communicationAttempt.deleteMany();
  await prisma.messageAttachment.deleteMany();
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
  for (const code of codes) await prisma.rolePermission.create({ data: { roleId, permissionId: permissions.get(code)! } });
}

async function main() {
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword) throw new Error('SEED_DEFAULT_PASSWORD must be set before running the seed');
  await clearDatabase();
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const permissions = new Map<string, string>();
  for (const code of permissionCodes) {
    const permission = await prisma.permission.create({ data: { code, name: label(code), module: code.split('.')[0], description: label(code) } });
    permissions.set(code, permission.id);
  }
  const roles = new Map<string, string>();
  const definitions = [
    ['SUPER_ADMIN', 'Super Administrator', permissionCodes], ['ADMIN', 'Administrator', adminCodes], ['SCHOOL_MANAGER', 'School Operations Manager', managerCodes], ['MEMBER', 'Team Member', memberCodes],
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
    const user = await prisma.user.create({ data: { name: data.name, email: data.email.toLowerCase(), passwordHash, roleId: roles.get(data.role)!, departmentId: departments.get(data.department)! } });
    users.set(user.email, user.id);
  }
  for (const email of ['hamzaalnajjar382@gmail.com', 'zujsara@gmail.com']) for (const code of ['schools.view', 'schools.create', 'schools.import']) await prisma.userPermission.create({ data: { userId: users.get(email)!, permissionId: permissions.get(code)! } });
  console.log('Clean account/RBAC seed completed', { users: await prisma.user.count(), roles: await prisma.role.count(), permissions: await prisma.permission.count(), departments: await prisma.department.count(), taskTypes: await prisma.taskType.count(), schools: await prisma.school.count(), tickets: await prisma.ticket.count(), todos: await prisma.todo.count(), notifications: await prisma.notification.count() });
}

main().catch((error) => { console.error('Seed failed:', error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
