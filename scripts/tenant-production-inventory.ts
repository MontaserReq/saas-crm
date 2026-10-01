import prisma from '../src/lib/db/prisma';

const tenantTables = [
  'Department', 'School', 'SchoolResearchJob', 'SchoolAssignment', 'TaskType', 'Ticket',
  'TicketApprovalRequest', 'SchoolApprovalRequest', 'ChatConversation', 'Attachment',
  'Notification', 'AuditLog', 'ActivityEvent', 'Todo', 'Message', 'MessageAttachment',
  'CalendarEvent', 'MessageTemplate', 'ProposalTemplate', 'Proposal',
] as const;

async function main() {
  const rows: Record<string, unknown> = {};
  for (const table of tenantTables) {
    const [totals, nulls, distribution] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}"`),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" IS NULL`),
      prisma.$queryRawUnsafe<Array<{ organizationId: string | null; count: bigint }>>(`SELECT "organizationId", COUNT(*)::bigint AS count FROM "${table}" GROUP BY "organizationId" ORDER BY COUNT(*) DESC`),
    ]);
    rows[table] = {
      totalRows: Number(totals[0].count),
      nullOrganizationId: Number(nulls[0].count),
      organizationDistribution: distribution.map((r) => ({ organizationId: r.organizationId, count: Number(r.count) })),
    };
  }

  const storageRows = await prisma.$queryRaw<Array<{ tableName: string; total: bigint; prefixed: bigint; legacy: bigint; unmapped: bigint }>>`
    SELECT 'Attachment' AS "tableName", COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "storageKey" LIKE "organizationId" || '/%')::bigint AS prefixed,
      COUNT(*) FILTER (WHERE "storageKey" NOT LIKE "organizationId" || '/%')::bigint AS legacy,
      COUNT(*) FILTER (WHERE "organizationId" IS NULL)::bigint AS unmapped
    FROM "Attachment"
    UNION ALL
    SELECT 'MessageAttachment', COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE "storageKey" LIKE "organizationId" || '/%')::bigint,
      COUNT(*) FILTER (WHERE "storageKey" NOT LIKE "organizationId" || '/%')::bigint,
      COUNT(*) FILTER (WHERE "organizationId" IS NULL)::bigint
    FROM "MessageAttachment"
  `;

  console.log(JSON.stringify({ tenantTables: rows, databaseLinkedStorage: storageRows.map((r) => ({ ...r, total: Number(r.total), prefixed: Number(r.prefixed), legacy: Number(r.legacy), unmapped: Number(r.unmapped) })) }));
}

main().catch((error) => { console.error(error?.message || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
