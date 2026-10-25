# CodeLine CRM — Proposed Policy Versioning and Acceptance Architecture

Status: **Design proposal only — explicit schema approval required**  
Prepared: 2026-10-20

No Prisma schema, migration, database row, acceptance flow or consent control has been created. The public policy pages remain non-effective review drafts and collect no acceptance.

## Objectives

- Stable identifiers for each policy.
- Immutable, addressable versions with publication and effective dates.
- Exact content/hash linkage for the version shown and accepted.
- Server-authoritative acceptance records tied to the authenticated user and organization context.
- Separate contractual acceptance from optional consent.
- Prospective re-acceptance for material changes without fabricating historical records.

## Proposed models

The names and fields below are for review, not an applied Prisma patch.

```prisma
model LegalPolicy {
  id          String               @id // stable key, e.g. "terms-of-service"
  slug        String               @unique
  isRequired  Boolean              @default(false)
  versions    LegalPolicyVersion[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
}

model LegalPolicyVersion {
  id             String                 @id @default(cuid())
  policyId       String
  policy         LegalPolicy            @relation(fields: [policyId], references: [id], onDelete: Restrict)
  version        String
  status         String                 @default("DRAFT") // DRAFT | PUBLISHED | SUPERSEDED
  publishedAt    DateTime?
  effectiveAt    DateTime?
  supersededAt   DateTime?
  contentHash    String                 // SHA-256 of canonical bilingual artifact
  artifactRef    String                 // immutable artifact/version route
  changeSummary  String                 @default("")
  materialChange Boolean                @default(false)
  acceptances    PolicyAcceptance[]
  createdAt      DateTime               @default(now())

  @@unique([policyId, version])
  @@index([policyId, status, effectiveAt])
}

model PolicyAcceptance {
  id             String             @id @default(cuid())
  policyVersionId String
  policyVersion  LegalPolicyVersion @relation(fields: [policyVersionId], references: [id], onDelete: Restrict)
  userId         String
  user           User               @relation(fields: [userId], references: [id], onDelete: Restrict)
  organizationId String?
  organization   Organization?      @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  flow           String             // SIGNUP | LOGIN_REACCEPTANCE | CHECKOUT | ADMIN_ACCEPTANCE
  acceptedAt     DateTime           @default(now())
  evidence       String             @default("") // minimized JSON; no raw secrets

  @@unique([policyVersionId, userId, organizationId, flow])
  @@index([userId, acceptedAt])
  @@index([organizationId, acceptedAt])
}

model ConsentDecision {
  id             String        @id @default(cuid())
  userId         String
  user           User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  purpose        String        // distinct optional purpose, e.g. MARKETING_EMAIL
  noticeVersion  String
  granted        Boolean
  decidedAt      DateTime      @default(now())
  withdrawnAt    DateTime?
  evidence       String        @default("")

  @@index([userId, purpose, decidedAt])
  @@index([organizationId, purpose, decidedAt])
}
```

## Publication and immutability rules

1. Only drafts can be edited.
2. Publishing computes and stores a SHA-256 hash of a canonical bilingual artifact and fixes an immutable version route.
3. Published content, identifier, hash and effective date cannot be updated in place. A correction creates a new version.
4. Superseding a version changes lifecycle metadata only and does not remove the old artifact.
5. Acceptance refers to `LegalPolicyVersion.id`, never merely to a policy slug or “current terms”.
6. Draft versions cannot be accepted.
7. No record is created unless a user performs the designated acceptance action; no backfill or retroactive acceptance is allowed.

These invariants should be enforced in service code and, where practical, database constraints or restricted database privileges. The final enforcement mechanism requires database review.

## Acceptance and consent flow

- The server selects required published versions and returns their immutable identifiers and links.
- The UI displays unchecked required acceptance controls with clear labels. Submission is blocked only for required contractual documents.
- Optional marketing or similar consent is displayed separately, remains unchecked, and never gates account/service access unless a lawful, purpose-specific exception is approved.
- The server derives `userId` and `organizationId` from the authenticated context and rejects browser-supplied authority fields.
- Re-acceptance is requested prospectively only when a newly published version is marked material and legal review says re-acceptance is required.
- Withdrawal applies to optional consent records and does not falsify or delete historical contractual acceptance evidence.

## Security and privacy implications

- Acceptance is security-sensitive evidence: writes must be authenticated, rate-limited, idempotent and audited.
- The accepted version must be published and effective (or explicitly scheduled for the flow) at the server-authoritative time.
- Evidence should be minimized. Raw IP addresses or full user-agent strings should not be stored unless counsel establishes need, retention and access controls; a purpose-bound keyed hash may be preferable.
- Tenant administrators must not read acceptance records for other organizations.
- Platform administrators should receive only the minimum search/export capability required for compliance.
- Content hashes protect linkage but do not by themselves prove identity or informed acceptance.
- Retention and deletion rules for acceptance and consent evidence require counsel approval.

## Proposed migration plan

1. Add the new tables and relations in an additive migration.
2. Do not create any policy, version, acceptance or consent rows in the migration.
3. Add service APIs and tests behind a disabled feature flag.
4. Add a reviewed publication command/workflow that creates the first immutable versions only after legal approval.
5. Enable read-only exact-version routes.
6. Enable acceptance only through a separate launch approval after reviewed documents are published.

## Rollback plan

- Disable the feature flag and acceptance gate first.
- Keep additive tables and any legitimate evidence intact; do not drop them during operational rollback.
- Roll back application reads/writes while preserving immutable records.
- Any later destructive schema rollback requires a separate evidence-retention decision, verified export and explicit approval.

## Proposed files (not yet changed)

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_legal_policy_versions_and_acceptance/migration.sql`
- `src/server/services/LegalPolicyService.ts`
- `src/server/actions/legal.ts`
- `src/lib/legal/acceptance.ts`
- `src/app/legal/[slug]/versions/[version]/page.tsx`
- Signup/login/checkout acceptance UI components after legal publication approval
- Unit, security and database integration tests for immutability, tenant isolation, idempotency, optional consent separation and re-acceptance

## Approval gate

Explicit approval is required before editing Prisma or adding a migration. Separate authorization is required before applying any migration, writing policy/version rows, publishing a version, or enabling mandatory acceptance.
