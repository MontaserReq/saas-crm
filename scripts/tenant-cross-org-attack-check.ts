import prisma from '../src/lib/db/prisma';
import { UserSession } from '../src/types';
import { TicketService } from '../src/server/services/TicketService';
import { ProposalService } from '../src/server/services/ProposalService';
import { CalendarService } from '../src/server/services/CalendarService';
import { AssignmentService } from '../src/server/services/AssignmentService';
import { MessageService } from '../src/server/services/MessageService';
import { ChatService } from '../src/server/services/ChatService';
import { SchoolService } from '../src/server/services/SchoolService';

const results: Record<string, string> = {};

async function rejected(name: string, action: () => Promise<unknown>) {
  try {
    await action();
    results[name] = 'UNEXPECTEDLY_ALLOWED';
  } catch {
    results[name] = 'DENIED';
  }
}

async function main() {
  const orgA = await prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-a' } });
  const orgB = await prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-b' } });
  const deptA = await prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-a' } });
  const deptB = await prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-b' } });
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'TENANT_TEST_ADMIN' } });
  const userA = await prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-a' } });
  const userB = await prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-b' } });
  const userC = await prisma.user.upsert({ where: { id: 'tenant-user-c' }, update: { isActive: true, departmentId: deptA.id }, create: { id: 'tenant-user-c', name: 'User C', email: 'tenant-c@example.test', passwordHash: 'test-only', roleId: role.id, departmentId: deptA.id } });
  await prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId: orgA.id, userId: userC.id } }, update: { status: 'ACTIVE' }, create: { organizationId: orgA.id, userId: userC.id, roleId: role.id, status: 'ACTIVE' } });
  const taskA = await prisma.taskType.upsert({ where: { id: 'tenant-task-a' }, update: {}, create: { id: 'tenant-task-a', organizationId: orgA.id, name: 'Task A', code: 'TENANT_TASK_A', departmentId: deptA.id, createdById: userA.id } });
  const taskB = await prisma.taskType.upsert({ where: { id: 'tenant-task-b' }, update: {}, create: { id: 'tenant-task-b', organizationId: orgB.id, name: 'Task B', code: 'TENANT_TASK_B', departmentId: deptB.id, createdById: userB.id } });
  const schoolA = await prisma.school.findUniqueOrThrow({ where: { id: 'tenant-school-a' } });
  const schoolB = await prisma.school.findUniqueOrThrow({ where: { id: 'tenant-school-b' } });
  const ticketB = await prisma.ticket.findUniqueOrThrow({ where: { id: 'tenant-ticket-b' } });
  const templateB = await prisma.proposalTemplate.upsert({ where: { id: 'tenant-template-b' }, update: {}, create: { id: 'tenant-template-b', organizationId: orgB.id, name: 'Template B', pdfStorageKey: 'tenant-org-b/proposals/templates/template.pdf', originalFileName: 'template.pdf', createdById: userB.id } });

  const userAContext: UserSession = { id: userA.id, name: userA.name, email: userA.email, role: 'SUPER_ADMIN', roleDisplayName: 'Super Admin', departmentId: deptA.id, departmentName: deptA.name, organizationId: orgA.id, permissions: [] };
  const userBContext: UserSession = { id: userB.id, name: userB.name, email: userB.email, role: 'SUPER_ADMIN', roleDisplayName: 'Super Admin', departmentId: deptB.id, departmentName: deptB.name, organizationId: orgB.id, permissions: [] };

  const ownProposal = await ProposalService.createProposal(userAContext, { title: 'Own Proposal', clientName: 'Org A', schoolId: schoolA.id });
  const orgBProposal = await ProposalService.createProposal(userBContext, { title: 'Org B Proposal', clientName: 'Org B', schoolId: schoolB.id });
  results.proposalOwnCreate = ownProposal.organizationId === orgA.id ? 'ALLOWED' : 'FAILED';
  await rejected('proposalCrossSchoolCreate', () => ProposalService.createProposal(userAContext, { title: 'Cross Proposal', clientName: 'Org A', schoolId: schoolB.id }));
  await rejected('proposalCrossTemplateCreate', () => ProposalService.createProposal(userAContext, { title: 'Cross Template', clientName: 'Org A', templateId: templateB.id }));
  await rejected('proposalCrossTemplateUpdate', () => ProposalService.updateProposal(userAContext, ownProposal.id, { templateId: templateB.id }));
  await rejected('proposalCrossRead', () => ProposalService.getProposal(userAContext, orgBProposal.id));

  const ownEvent = await CalendarService.createEvent(userAContext, { title: 'Own Event', type: 'MEETING', startDate: '2026-09-30T10:00:00Z', schoolId: schoolA.id, assigneeIds: [userC.id] });
  results.calendarOwnCreate = ownEvent.organizationId === orgA.id ? 'ALLOWED' : 'FAILED';
  await rejected('calendarCrossSchoolCreate', () => CalendarService.createEvent(userAContext, { title: 'Cross Event', type: 'MEETING', startDate: '2026-09-30T10:00:00Z', schoolId: schoolB.id }));
  await rejected('calendarCrossAttendeeCreate', () => CalendarService.createEvent(userAContext, { title: 'Cross Attendee', type: 'MEETING', startDate: '2026-09-30T10:00:00Z', assigneeIds: [userB.id] }));
  await rejected('calendarCrossSchoolUpdate', () => CalendarService.updateEvent(userAContext, ownEvent.id, { schoolId: schoolB.id }));
  await rejected('calendarCrossRead', () => CalendarService.deleteEvent(userAContext, 'tenant-event-b'));

  await rejected('ticketCrossSchoolCreate', () => TicketService.createTicket(userAContext, { subject: 'Cross ticket', schoolId: schoolB.id, taskTypeId: taskA.id, departmentId: deptA.id }));
  await rejected('ticketCrossDepartmentCreate', () => TicketService.createTicket(userAContext, { subject: 'Cross department', schoolId: schoolA.id, taskTypeId: taskA.id, departmentId: deptB.id }));
  await rejected('ticketCrossTaskTypeCreate', () => TicketService.createTicket(userAContext, { subject: 'Cross task type', schoolId: schoolA.id, taskTypeId: taskB.id, departmentId: deptA.id }));

  await rejected('assignmentCrossSchoolCreate', () => AssignmentService.executeBulkAssignment({ schoolIds: [schoolB.id], assigneeIds: [userC.id], taskTypeId: taskA.id, departmentId: deptA.id }, userA.id));
  await rejected('messageCrossRecipientCreate', () => MessageService.sendMessage(userAContext, { toUserIds: [userB.id], subject: 'Cross message', content: 'must fail' }));
  await rejected('chatCrossParticipantCreate', () => ChatService.direct(userAContext, userB.id));
  await rejected('approvalCrossSchoolCreate', () => SchoolService.createApprovalRequest(schoolB.id, 'EDIT', userA.id, { name: 'must fail' }));

  const listA = await ProposalService.listProposals(userAContext);
  const listB = await ProposalService.listProposals(userBContext);
  results.proposalListIsolation = listA.every((p: any) => p.organizationId === orgA.id) && listB.every((p: any) => p.organizationId === orgB.id) ? 'PASS' : 'FAIL';
  results.ticketReadIsolation = (await TicketService.getTicketById(userAContext, 'tenant-ticket-b').catch(() => null)) === null ? 'PASS' : 'FAIL';
  results.calendarListIsolation = (await CalendarService.listEvents(userAContext)).every((e: any) => e.organizationId === orgA.id) ? 'PASS' : 'FAIL';

  console.log(JSON.stringify({ results, ownResource: { organizationA: orgA.id, organizationB: orgB.id }, note: 'Only disposable PostgreSQL was used.' }));
}

main().catch((error) => { console.error(error?.message || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
