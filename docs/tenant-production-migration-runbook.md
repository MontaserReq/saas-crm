# Tenant production migration runbook

This is an operator procedure. It has not been executed against production.

1. Take and verify a restorable database backup. Freeze destructive administrative changes.
2. Deploy the application version that understands the organization fields and rejects ambiguous active memberships.
3. Run `npx prisma migrate deploy` against the approved production `DATABASE_URL`.
4. Run `npx tsx scripts/tenant-production-inventory.ts` and archive the redacted JSON output.
5. Confirm all required ownership columns have zero NULL rows, all organization foreign keys have zero orphans, and the organization distribution matches the approved backfill plan.
6. Verify legacy storage records using the database-linked storage output and a provider-side read-only object listing. Classify objects as prefixed, legacy, unmapped, database-linked, or orphaned. Never guess an organization for an unmapped object.
7. Run smoke tests for login, organization context, school list/detail, ticket list/detail/update, attachment authorization, proposal/template authorization, calendar, messaging, admin user management, and public search.
8. Run tenant smoke tests with Org A and Org B: same-org read/create/update/delete where permitted, cross-org read/update/delete denied, cross-org relation create/update denied, private public-search records hidden, and same-org files accessible.
9. Monitor authorization errors, database constraint errors, storage access errors, and null/orphan counts after deployment.
10. Recovery: stop the application deployment, restore the verified backup if data integrity is affected, or deploy the previous compatible application version only if its schema compatibility has been reviewed. No automatic destructive rollback is provided by these forward-only migrations.
