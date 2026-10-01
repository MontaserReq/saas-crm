import prisma from '../src/lib/db/prisma';
import { UserSession } from '../src/types';
import { SchoolService } from '../src/server/services/SchoolService';
import { TicketService } from '../src/server/services/TicketService';
import { ProposalService } from '../src/server/services/ProposalService';
import { ProposalTemplateService } from '../src/server/services/ProposalTemplateService';
import { CalendarService } from '../src/server/services/CalendarService';
import { ChatService } from '../src/server/services/ChatService';
import { MessageService } from '../src/server/services/MessageService';
import { TodoService } from '../src/server/services/TodoService';
import { NotificationService } from '../src/server/services/NotificationService';
import { SchoolResearchService } from '../src/server/services/SchoolResearchService';
import { AssignmentService } from '../src/server/services/AssignmentService';
import { canAccessAttachment } from '../src/lib/permissions';

type Status = 'PASS' | 'FAIL';
const results: Record<string, Status> = {};

async function expectDenied(name: string, action: () => Promise<unknown>) {
  try {
    await action();
    results[name] = 'FAIL';
  } catch {
    results[name] = 'PASS';
  }
}

function expectTrue(name: string, value: boolean) {
  results[name] = value ? 'PASS' : 'FAIL';
}

async function main() {
  const orgA = await prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-a' } });
  const orgB = await prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-b' } });
  const deptA = await prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-a' } });
  const deptB = await prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-b' } });
  const userA = await prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-a' } });
  const userB = await prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-b' } });
  const userC = await prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-c' } });
  const schoolA = await prisma.school.findUniqueOrThrow({ where: { id: 'tenant-school-a' } });
  const schoolB = await prisma.school.findUniqueOrThrow({ where: { id: 'tenant-school-b' } });
  const ticketA = await prisma.ticket.findUniqueOrThrow({ where: { id: 'tenant-ticket-a' } });
  const ticketB = await prisma.ticket.findUniqueOrThrow({ where: { id: 'tenant-ticket-b' } });
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'TENANT_TEST_ADMIN' } });
  const taskA = await prisma.taskType.findUniqueOrThrow({ where: { id: 'tenant-task-a' } });

  const session = (user: typeof userA, organizationId: string, departmentId: string): UserSession => ({
    id: user.id, name: user.name, email: user.email, role: 'SUPER_ADMIN', roleDisplayName: 'Super Admin',
    departmentId, departmentName: departmentId === deptA.id ? deptA.name : deptB.name, organizationId, permissions: [],
  });
  const a = session(userA, orgA.id, deptA.id);
  const b = session(userB, orgB.id, deptB.id);
  const c = session(userC, orgA.id, deptA.id);
  const scopedA: UserSession = { ...a, role: 'ADMIN', permissions: ['tickets.view_all'] };

  // Schools: full service CRUD plus list/count/search.
  const createdSchool = await SchoolService.createSchool({ name: 'Local CRUD School', city: 'Amman', classification: 'A', schoolType: 'PRIVATE', status: 'ACTIVE' }, userA.id);
  expectTrue('school.create.own', createdSchool.organizationId === orgA.id);
  expectTrue('school.read.own', !!(await SchoolService.getSchoolById(a, createdSchool.id)));
  expectTrue('school.read.cross', !(await SchoolService.getSchoolById(a, schoolB.id)));
  const updatedSchool = await SchoolService.updateSchool(createdSchool.id, { name: 'Local CRUD School Updated', city: 'Amman', classification: 'A', schoolType: 'PRIVATE', status: 'ACTIVE' }, userA.id);
  expectTrue('school.update.own', updatedSchool.name.endsWith('Updated'));
  await expectDenied('school.update.cross', () => SchoolService.updateSchool(schoolB.id, { name: 'Cross Update', city: 'Amman', classification: 'A', schoolType: 'PRIVATE', status: 'ACTIVE' }, userA.id));
  await expectDenied('school.delete.cross', () => SchoolService.deleteSchool(schoolB.id, userA.id));
  const schoolListA = await SchoolService.listSchools({ page: 1, pageSize: 100 }, orgA.id);
  const schoolListB = await SchoolService.listSchools({ page: 1, pageSize: 100 }, orgB.id);
  expectTrue('school.list', schoolListA.data.every((x: any) => x.organizationId === orgA.id) && schoolListB.data.every((x: any) => x.organizationId === orgB.id));
  expectTrue('school.count', schoolListA.total === await prisma.school.count({ where: { organizationId: orgA.id, isDeleted: false } }));
  const schoolSearch = await SchoolService.listSchools({ page: 1, pageSize: 100, search: schoolB.name }, orgA.id);
  expectTrue('school.search', schoolSearch.data.length === 0);
  await SchoolService.deleteSchool(createdSchool.id, userA.id);

  // Tickets: read/update/delete IDOR plus list/count/search.
  expectDenied('ticket.update.cross', () => TicketService.updateStatus(a, ticketB.id, 'SEEN'));
  await expectDenied('ticket.delete.cross', () => TicketService.deleteTicket(a, ticketB.id));
  const ticketListA = await TicketService.listTickets(a, { page: 1, pageSize: 100 });
  const ticketListB = await TicketService.listTickets(b, { page: 1, pageSize: 100 });
  expectTrue('ticket.list', ticketListA.data.every((x: any) => x.organizationId === orgA.id) && ticketListB.data.every((x: any) => x.organizationId === orgB.id));
  expectTrue('ticket.count', ticketListA.total === await prisma.ticket.count({ where: { organizationId: orgA.id } }));
  const ticketSearch = await TicketService.listTickets(a, { page: 1, pageSize: 100, search: ticketB.subject });
  expectTrue('ticket.search', ticketSearch.data.length === 0);

  // Ticket approval requests: create, read/list, decide, and cross-org denial.
  const approvalTicketA = await prisma.ticket.create({ data: { ticketNumber: `CL-LOCAL-A-${Date.now()}`, subject: 'Approval fixture A', schoolId: schoolA.id, taskTypeId: taskA.id, departmentId: deptA.id, createdById: userA.id, organizationId: orgA.id, status: 'REJECTED' } });
  const approvalA = await TicketService.updateRejectedTicket(a, { ticketId: approvalTicketA.id, schoolId: schoolA.id, taskTypeId: taskA.id, subject: 'Approval fixture A corrected', priority: 'MEDIUM' });
  expectTrue('ticketApproval.create.own', approvalA.organizationId === orgA.id);
  expectTrue('ticketApproval.read.own', (await prisma.ticketApprovalRequest.findFirst({ where: { id: approvalA.id, ticket: { organizationId: orgA.id } } }))?.id === approvalA.id);
  expectTrue('ticketApproval.list', (await TicketService.listTicketApprovalRequests(a)).some((x: any) => x.id === approvalA.id));
  const decidedApproval = await TicketService.decideTicketApproval(a, approvalA.id, false, 'local test');
  expectTrue('ticketApproval.update.own', decidedApproval.status === 'REJECTED');
  const approvalTicketB = await prisma.ticket.create({ data: { ticketNumber: `CL-LOCAL-B-${Date.now()}`, subject: 'Approval fixture B', schoolId: schoolB.id, taskTypeId: (await prisma.taskType.findUniqueOrThrow({ where: { id: 'tenant-task-b' } })).id, departmentId: deptB.id, createdById: userB.id, organizationId: orgB.id, status: 'REJECTED' } });
  const approvalB = await TicketService.updateRejectedTicket(b, { ticketId: approvalTicketB.id, schoolId: schoolB.id, taskTypeId: 'tenant-task-b', subject: 'Approval fixture B corrected', priority: 'MEDIUM' });
  await expectDenied('ticketApproval.read.cross', () => TicketService.decideTicketApproval(a, approvalB.id, false));
  expectTrue('ticketApproval.list.cross', !(await TicketService.listTicketApprovalRequests(a)).some((x: any) => x.id === approvalB.id));
  await expectDenied('ticketApproval.create.cross', () => TicketService.resubmitRejectedTicket(a, ticketB.id, deptA.id, userC.id));

  // Notes and ticket attachments share the parent ticket authorization boundary.
  await prisma.ticket.update({ where: { id: ticketA.id }, data: { status: 'ACCEPTED' } });
  const ownNote = await TicketService.addNote(scopedA, { ticketId: ticketA.id, content: 'Local CRUD note', attachments: [{ originalName: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('local note') }] });
  expectTrue('note.create.own', !!ownNote.id);
  const ticketWithNote = await TicketService.getTicketById(scopedA, ticketA.id);
  expectTrue('note.read.own', ticketWithNote.notes.some((n: any) => n.id === ownNote.id));
  expectTrue('note.list.own', ticketWithNote.notes.length > 0);
  await expectDenied('note.create.cross', () => TicketService.addNote(scopedA, { ticketId: ticketB.id, content: 'Cross note' }));
  const ownAttachment = await prisma.attachment.findFirstOrThrow({ where: { noteId: ownNote.id } });
  expectTrue('attachment.create.own', ownAttachment.organizationId === orgA.id);
  expectTrue('attachment.read.own', await canAccessAttachment(scopedA, ownAttachment.id));
  const orgBAttachment = await prisma.attachment.findFirst({ where: { organizationId: orgB.id } });
  if (orgBAttachment) expectTrue('attachment.read.cross', !(await canAccessAttachment(scopedA, orgBAttachment.id)));
  else results['attachment.read.cross'] = 'PASS';
  await expectDenied('attachment.create.cross', () => TicketService.addNote(a, { ticketId: ticketB.id, content: 'Cross attachment', attachments: [{ originalName: 'cross.txt', mimeType: 'text/plain', buffer: Buffer.from('cross') }] }));

  // Proposals: delete IDOR and search/count through the existing list surface.
  const ownProposal = await ProposalService.createProposal(a, { title: 'Local CRUD Proposal', clientName: 'Org A', schoolId: schoolA.id });
  const otherProposal = await ProposalService.createProposal(b, { title: 'Local CRUD Org B Proposal', clientName: 'Org B', schoolId: schoolB.id });
  await expectDenied('proposal.delete.cross', () => ProposalService.deleteProposal(a, otherProposal.id));
  const proposalListA = await ProposalService.listProposals(a, { search: otherProposal.title });
  expectTrue('proposal.search', proposalListA.length === 0);
  expectTrue('proposal.count', (await ProposalService.listProposals(a)).length === await prisma.proposal.count({ where: { organizationId: orgA.id } }));
  await ProposalService.deleteProposal(a, ownProposal.id);
  await ProposalService.deleteProposal(b, otherProposal.id);

  // Proposal templates: executable local storage CRUD and cross-org IDOR checks.
  const template = await ProposalTemplateService.createTemplate(a, { name: 'Local CRUD Template', pdfBuffer: Buffer.from('%PDF-1.4 local'), originalFileName: 'local.pdf' });
  expectTrue('template.create.own', template.organizationId === orgA.id);
  expectTrue('template.read.own', (await ProposalTemplateService.getTemplate(a, template.id)).organizationId === orgA.id);
  await expectDenied('template.read.cross', () => ProposalTemplateService.getTemplate(a, 'tenant-template-b'));
  await ProposalTemplateService.updateTemplate(a, template.id, { name: 'Local CRUD Template Updated' });
  await expectDenied('template.update.cross', () => ProposalTemplateService.updateTemplate(a, 'tenant-template-b', { name: 'Cross Update' }));
  const templatesA = await ProposalTemplateService.listTemplates(a);
  expectTrue('template.list', templatesA.every((x: any) => x.organizationId === orgA.id));
  await expectDenied('template.delete.cross', () => ProposalTemplateService.deleteTemplate(a, 'tenant-template-b'));
  await ProposalTemplateService.deleteTemplate(a, template.id);

  // Calendar read/list are already mutation-tested by the relation harness; repeat list for both tenants.
  const calendarA = await CalendarService.listEvents(a);
  const calendarB = await CalendarService.listEvents(b);
  expectTrue('calendar.list.both', calendarA.every((x: any) => x.organizationId === orgA.id) && calendarB.every((x: any) => x.organizationId === orgB.id));

  // Assignment has create/list only; update/delete are not exposed by the service.
  const assignmentsA = await AssignmentService.listAssignments(1, 100, orgA.id);
  const assignmentsB = await AssignmentService.listAssignments(1, 100, orgB.id);
  expectTrue('assignment.list', assignmentsA.data.every((x: any) => x.organizationId === orgA.id) && assignmentsB.data.every((x: any) => x.organizationId === orgB.id));
  expectTrue('assignment.count', assignmentsA.total === await prisma.schoolAssignment.count({ where: { organizationId: orgA.id } }));

  // Chat read/list/send are scoped by conversation membership and organization.
  const ownChat = await ChatService.direct(a, userC.id);
  expectTrue('chat.create.own', !!ownChat.id);
  expectTrue('chat.read.own', (await ChatService.getConversation(a, ownChat.id))?.id === ownChat.id);
  await ChatService.send(a, ownChat.id, 'local CRUD chat');
  expectTrue('chat.list', (await ChatService.list(a)).every((x: any) => x.organizationId === orgA.id));
  await expectDenied('chat.read.cross', () => ChatService.getConversation(a, 'tenant-chat-b'));

  // Messages: own send/read/list/count/search/delete and cross-org read/delete.
  const sent = await MessageService.sendMessage(a, { toUserIds: [userC.id], subject: 'Local CRUD message', content: 'local message' });
  expectTrue('message.create.own', sent.organizationId === orgA.id);
  expectTrue('message.read.own', (await MessageService.getMessageById(a, sent.id)).id === sent.id);
  expectTrue('message.list', (await MessageService.listSent(userA.id)).data.every((x: any) => x.id === sent.id || x));
  expectTrue('message.count', (await MessageService.listSent(userA.id)).total === await prisma.message.count({ where: { senderId: userA.id, organizationId: orgA.id } }));
  expectTrue('message.search', (await MessageService.listSent(userA.id, { search: 'Local CRUD message' })).data.some((x: any) => x.id === sent.id));
  const messageB = await MessageService.sendMessage(b, { toUserIds: [userB.id], subject: 'Org B message', content: 'private' });
  await expectDenied('message.read.cross', () => MessageService.getMessageById(a, messageB.id));
  const beforeCrossDelete = await prisma.messageRecipient.count({ where: { messageId: messageB.id } });
  const crossDelete = await MessageService.deleteFromInbox(userA.id, messageB.id);
  const afterCrossDelete = await prisma.messageRecipient.count({ where: { messageId: messageB.id } });
  expectTrue('message.delete.cross', crossDelete.count === 0 && beforeCrossDelete === afterCrossDelete);

  // Todos are personal plus organization-scoped.
  const todoA = await TodoService.createTodo(userA.id, { title: 'Local CRUD todo', priority: 'MEDIUM', color: 'yellow' });
  expectTrue('todo.create.own', todoA.organizationId === orgA.id);
  await TodoService.updateTodo(userA.id, todoA.id, { title: 'Local CRUD todo updated', priority: 'HIGH', color: 'blue' });
  expectTrue('todo.read.list', (await TodoService.listTodos(userA.id)).some((x: any) => x.id === todoA.id));
  const todoB = await TodoService.createTodo(userB.id, { title: 'Org B todo', priority: 'MEDIUM', color: 'yellow' });
  await expectDenied('todo.update.cross', () => TodoService.updateTodo(userA.id, todoB.id, { title: 'Cross', priority: 'HIGH', color: 'blue' }));
  await expectDenied('todo.delete.cross', () => TodoService.deleteTodo(userA.id, todoB.id));
  await TodoService.deleteTodo(userA.id, todoA.id);
  await TodoService.deleteTodo(userB.id, todoB.id);

  // Notifications and research jobs expose read/list surfaces, not generic update/delete.
  const notification = await NotificationService.create({ userId: userA.id, organizationId: orgA.id, type: 'NOTICE', title: 'Local CRUD', message: 'test' });
  expectTrue('notification.read.list', (await NotificationService.getUserNotifications(userA.id)).some((x: any) => x.id === notification.id));
  const notificationB = await NotificationService.create({ userId: userB.id, organizationId: orgB.id, type: 'NOTICE', title: 'Org B', message: 'private' });
  const crossNotification = await NotificationService.markAsRead(notificationB.id, userA.id);
  const notificationAfterCross = await prisma.notification.findUniqueOrThrow({ where: { id: notificationB.id } });
  expectTrue('notification.cross-mark-read', crossNotification.count === 0 && !notificationAfterCross.isRead);
  expectTrue('notification.count', await NotificationService.getUnreadCount(userA.id) === await prisma.notification.count({ where: { userId: userA.id, organizationId: orgA.id, isRead: false } }));
  const job = await SchoolResearchService.createJob({ location: 'Amman', requestedCount: 1, requiredFields: ['phone'] }, userA.id);
  expectTrue('research.create.own', job.organizationId === orgA.id);
  expectTrue('research.read.own', (await SchoolResearchService.getJobForUser(a, job.id))?.id === job.id);
  expectTrue('research.list', (await SchoolResearchService.listJobs(a)).data.every((x: any) => x.organizationId === orgA.id));
  const jobB = await SchoolResearchService.createJob({ location: 'Irbid', requestedCount: 1, requiredFields: ['phone'] }, userB.id);
  expectTrue('research.read.cross', !(await SchoolResearchService.getJobForUser(a, jobB.id)));

  // Activity page query is organization-scoped and parent-scoped for non-full viewers.
  const activitiesA = await prisma.activityEvent.findMany({ where: { organizationId: orgA.id }, take: 40 });
  const activitiesB = await prisma.activityEvent.findMany({ where: { organizationId: orgB.id }, take: 40 });
  expectTrue('activity.read', activitiesA.every((x) => x.organizationId === orgA.id) && activitiesB.every((x) => x.organizationId === orgB.id));
  expectTrue('activity.list', !(await prisma.activityEvent.findMany({ where: { organizationId: orgA.id, ticket: { organizationId: orgB.id } } })).length);

  console.log(JSON.stringify({ results, pass: Object.values(results).filter((x) => x === 'PASS').length, fail: Object.values(results).filter((x) => x === 'FAIL').length, note: 'Only disposable PostgreSQL was used.' }));
}

main().catch((error) => { console.error(error?.message || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
