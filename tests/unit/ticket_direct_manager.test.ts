import { describe, it, expect } from 'vitest';

/**
 * These tests validate the conceptual contract of the ticket creation flow
 * after the Direct Manager (User.reportsToUserId) refactor:
 *
 *   - The frontend must NOT be able to choose a different assignee.
 *   - The server must derive the assignee strictly from currentUser.reportsToUserId.
 *   - The server must reject creation when reportsToUserId is missing.
 *   - The server must reject creation when the direct manager is disabled.
 *
 * The actual createTicket service requires a live Prisma client, so this
 * test suite focuses on the input contract enforced at the action layer:
 * the createTicketAction signature must NOT accept an assignee field.
 */

import * as fs from 'fs';
import * as path from 'path';

const serverActionPath = path.resolve(
  __dirname,
  '../../src/server/actions/tickets.ts'
);
const ticketServicePath = path.resolve(
  __dirname,
  '../../src/server/services/TicketService.ts'
);
const ticketModalPath = path.resolve(
  __dirname,
  '../../src/components/tickets/TicketFormModal.tsx'
);

function readFileSafe(p: string): string {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

describe('Ticket creation: Direct Manager assignment contract', () => {
  const actionSource = readFileSafe(serverActionPath);
  const serviceSource = readFileSafe(ticketServicePath);
  const modalSource = readFileSafe(ticketModalPath);

  it('createTicketAction does NOT accept assignedToUserId from the client', () => {
    // The public input type must no longer carry an assignee field.
    expect(actionSource).not.toMatch(/assignedToUserId\?:\s*string/);
  });

  it('createTicketAction forwards an empty object (no assignee) to TicketService.createTicket', () => {
    // The action body must build a payload WITHOUT an assignedToUserId key.
    expect(actionSource).not.toMatch(/assignedToUserId\s*:/);
  });

  it('TicketService.createTicket ignores any input.assigneeId (signature removed)', () => {
    // The service signature must no longer include assigneeId / assignedToUserId.
    expect(serviceSource).not.toMatch(/assigneeId\?:\s*string/);
    expect(serviceSource).not.toMatch(/assignedToUserId\?:\s*string/);
  });

  it('TicketService.createTicket uses user.reportsToUserId as the only assignment source', () => {
    expect(serviceSource).toMatch(/targetAssigneeId\s*=\s*user\.reportsToUserId/);
    expect(serviceSource).toMatch(/SERVER-SIDE ASSIGNMENT SOURCE OF TRUTH/);
  });

  it('TicketService.createTicket rejects missing direct manager', () => {
    expect(serviceSource).toMatch(/cannot create a ticket because your direct manager is not assigned/i);
  });

  it('TicketService.createTicket rejects disabled direct manager', () => {
    expect(serviceSource).toMatch(/your assigned direct manager is disabled/i);
  });

  it('TicketFormModal does not expose an employee selection', () => {
    // The modal must not contain any select that lets the user pick an assignee.
    // We forbid the legacy hard-coded English "Select eligible team member" label.
    expect(modalSource).not.toMatch(/Select eligible team member/);
    // And the modal must not send an assignee identifier to the action.
    expect(modalSource).not.toMatch(/assign[a-z]+To[a-z]+User[a-z]+Id/);
    expect(modalSource).not.toMatch(/assignee[a-z]*Id/);
    expect(modalSource).not.toMatch(/assignee[a-z]*Id/);
  });

  it('TicketFormModal renders a Direct Manager section', () => {
    expect(modalSource).toMatch(/directManager/);
    expect(modalSource).toMatch(/UserCheck/);
  });

  it('TicketFormModal disables submission when no direct manager is configured', () => {
    expect(modalSource).toMatch(/status\.kind\s*!==\s*"ready"/);
    expect(modalSource).toMatch(/disabled=\{loading \|\| blocked\}/);
  });

  it('Audit metadata records that the assignment came from reportsToUserId', () => {
    expect(serviceSource).toMatch(/assignmentSource.*reportsToUserId/);
  });
});