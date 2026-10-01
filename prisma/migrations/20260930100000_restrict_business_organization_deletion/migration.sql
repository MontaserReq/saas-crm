-- Organization-owned business rows must not become unowned when an organization
-- is deleted. Keep deletion explicit and blocked while legacy ownership remains
-- nullable for the transition.
DO $$
DECLARE
  table_name text;
  constraint_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Department','School','SchoolResearchJob','SchoolApprovalRequest',
    'TicketApprovalRequest','ChatConversation','SchoolAssignment','TaskType',
    'Ticket','Attachment','Notification','AuditLog','ActivityEvent','Todo',
    'Message','MessageAttachment','CalendarEvent','MessageTemplate',
    'ProposalTemplate','Proposal'
  ] LOOP
    constraint_name := table_name || '_organizationId_fkey';
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', table_name, constraint_name);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
      table_name, constraint_name
    );
  END LOOP;
END $$;
