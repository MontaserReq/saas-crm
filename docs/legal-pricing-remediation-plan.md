# CodeLine CRM — Annual Pricing Reconciliation Plan

Status: **Proposal only — separate implementation approval required**  
Prepared: 2026-10-20  
No runtime price, Prisma schema, migration, `PlatformPlan` record, stored request, or database value was changed.

## Commercially approved targets

| Plan | Monthly | Annual | Approval status |
| --- | ---: | ---: | --- |
| Starter | JOD 39 | JOD 375 | Commercial target confirmed |
| Growth | JOD 99 | JOD 950 | Commercial target confirmed |
| Scale | JOD 199 | JOD 1,910 | Commercial target confirmed |
| Enterprise | Contact sales | Contact sales | Commercial target confirmed |

Approval of these targets does not yet authorize operational or database changes or public price publication.

## Current price paths

### 1. Public marketing catalog

- `src/app/page.tsx` and `src/app/pricing/page.tsx` load active `PlatformPlan` rows through `getPublishedPlatformPlans()`.
- `src/server/services/PlatformCatalogService.ts` maps `monthlyPrice` and `annualDiscountPercent` from `PlatformPlan` into `PlanConfig`.
- `src/components/landing/PricingSection.tsx` currently hides all numeric monthly and annual amounts and renders “To be approved / قيد الاعتماد”. Therefore the public marketing site does not currently publish any of the conflicting annual totals.
- `src/lib/plans.ts` contains fallback catalog values and helper functions. `getAnnualMonthlyEquivalent()` rounds the discounted monthly equivalent to a whole dinar before `getAnnualTotal()` multiplies by 12. This produces JOD 384 / 984 / 1,980.
- Those helper totals are currently exercised by tests but are not rendered by `PricingSection`.

### 2. Workspace subscription display

- `PlanUpgradeService.workspace()` reads active `PlatformPlan` rows from the database.
- `annualCatalogPrice()` in `src/lib/platform/upgrades.ts` applies the stored 17% discount directly to 12 monthly payments and rounds to two decimals.
- `src/components/settings/SubscriptionView.tsx` and `src/components/settings/TrialExpiredView.tsx` display that computed value.
- This produces JOD 388.44 / 986.04 / 1,982.04.

### 3. Financial snapshot stored on activation requests

- `PlanUpgradeService.request()` calls its private `priceFor()` function.
- For annual requests, `priceFor()` uses Prisma Decimal arithmetic: `monthlyPrice × 12 × (100 − annualDiscountPercent) ÷ 100`, rounded to two decimal places.
- The result is stored as `PlanUpgradeRequest.priceSnapshot`, with `currencySnapshot` stored beside it.
- Payment confirmation must exactly match the stored amount and currency before activation. Therefore the snapshot is financially operative and must not be rewritten silently.
- This also produces JOD 388.44 / 986.04 / 1,982.04 for the current catalog values.

## Cause of each discrepancy

There is no tax, sales-tax, surcharge, payment-provider fee, or other fee calculation in any of the audited price paths.

1. The approved annual totals are explicit commercial amounts. They do not equal a uniform 17% reduction from twelve monthly payments.
2. The workspace display and request snapshot both derive annual price from the stored 17% discount, so they disagree with the explicit targets.
3. The fallback public helper rounds the discounted monthly equivalent before multiplying by twelve, so it also disagrees with the exact 17% calculation.
4. The three approved totals imply slightly different effective discounts (about 19.87%, 20.03%, and 20.02%). A single integer percentage cannot represent them exactly.

## Recommended source of truth

Add an explicit nullable annual amount to the plan catalog and treat it as authoritative for annual billing. Keep `annualDiscountPercent` only as a derived display value or retire it after compatibility review; do not use it to create financial amounts.

Recommended invariant:

- `monthlyPrice` is the authoritative monthly amount.
- `annualPrice` is the authoritative annual amount.
- Enterprise keeps both amounts null and remains `contact_sales`.
- A request snapshot copies the selected authoritative amount exactly at request creation.
- All UI paths receive the same amount from one server-side pricing mapper.
- Displayed savings or discount percentages are derived from the two amounts and are never used to calculate a charge.

This requires a Prisma/schema proposal and a migration, so implementation must wait for explicit approval.

## Proposed implementation files

### Schema and catalog (approval required before editing)

- `prisma/schema.prisma`: propose `annualPrice Decimal? @db.Decimal(12, 2)` on `PlatformPlan`, with validation rules enforced in service input and migration constraints.
- New Prisma migration: add the nullable column, backfill only the three known plan slugs with approved values, leave Enterprise null, and add an invariant appropriate to `self_serve` versus `contact_sales` plans.
- `prisma/seed.ts` and catalog seed strategy: set explicit annual amounts for new environments without overwriting administrator-edited production records silently.
- `src/lib/platform/validation.ts`: accept and validate an explicit annual amount in platform administration.
- `src/components/admin/PlatformRecordForm.tsx`: label both monthly and annual prices as JOD (the current form incorrectly says USD) and stop presenting a percentage as the financial source of truth.

### Runtime pricing

- `src/lib/plans.ts`: add `annualPrice` to `PlanConfig`; make annual equivalent/savings helpers derive display data from the explicit amount.
- `src/server/services/PlatformCatalogService.ts`: map the persisted annual amount.
- `src/lib/platform/upgrades.ts`: replace `annualCatalogPrice(monthly, discount)` with a selector that receives explicit monthly/annual amounts and rejects unavailable values.
- `src/server/services/PlanUpgradeService.ts`: remove the duplicate private annual formula; use the shared authoritative selector for both workspace display and new `priceSnapshot` values.
- `src/components/settings/SubscriptionView.tsx` and `src/components/settings/TrialExpiredView.tsx`: continue rendering server-supplied values, with a currency/interval label and no client-side calculation.
- `src/components/landing/PricingSection.tsx`: publish the approved amounts only after separate publication approval and after the runtime/catalog change is deployed and verified.

### Tests

- `tests/unit/pricing.test.ts`: assert all three explicit annual targets, derived savings, and Enterprise null behavior.
- Add unit tests for the shared price selector, decimal precision, unavailable annual prices, and absence of percentage-based charging.
- Extend `tests/security/plan-upgrades.test.ts`: assert request inputs cannot supply or override price/currency and legacy snapshots remain immutable.
- Extend database integration tests: verify new annual requests snapshot the explicit catalog amount atomically, payment confirmation requires exact snapshot/currency equality, and monthly behavior is unchanged.
- Add UI tests for subscription and trial-expired displays in Arabic and English.
- Add regression tests proving the public pricing page remains non-numeric until publication is separately authorized.

## Historical and open request handling

`PlanUpgradeRequest.priceSnapshot` is historical financial evidence and must remain immutable.

- `ACTIVATED`, `REJECTED`, and `CANCELLED`: never rewrite the snapshot.
- `PAYMENT_CONFIRMED`: never rewrite; complete or unwind only through a documented, authorized operational decision.
- `PENDING_PAYMENT`: do not mass-update. Recommended cutover behavior is to mark it as a legacy snapshot in administrative UI, prevent silent amount substitution, and require an authorized administrator to either honor it or cancel it with a reason so the customer can create a new request at the approved amount.
- Requests created after the cutover snapshot the explicit annual amount.
- Audit events should identify legacy-request decisions without exposing payment notes or unnecessary personal data.

No historical record should be “corrected” merely to match the new catalog. If the company decides not to honor legacy pending amounts, counsel should review customer notice and consumer-protection implications before cancellation.

## Migration and rollback plan (proposal)

1. Add a nullable column without changing current calculation behavior.
2. Backfill approved values for the three known slugs using an idempotent migration; do not touch request snapshots.
3. Deploy code that reads explicit annual values and fails closed for self-serve annual selection if the value is missing.
4. Reconcile every open request through an administrative report before enabling public annual-price display.
5. After verification, separately enable public display.

Rollback should restore the prior application version while leaving the additive nullable column in place. Do not drop the column during emergency rollback. Because new snapshots may contain explicit target prices, reverting to percentage-based calculations after cutover requires disabling new annual requests first to avoid inconsistent new records.

## Security and accounting implications

- Price selection must remain server-authoritative; browsers must submit only plan and interval.
- Currency must come from the organization context, not request input.
- Decimal arithmetic and snapshot immutability must be retained.
- Platform-plan editing remains privileged and auditable.
- Open legacy requests require explicit decisions; no batch mutation should erase the original financial record.
- Tax treatment, invoicing, and whether displayed prices include any applicable taxes remain unverified and require company/accounting confirmation. No current code evidence shows tax or fees being added.

## Approval gate

Before implementation, approval is required for:

1. The explicit `annualPrice` data model and migration/backfill approach.
2. Treatment of each open legacy request category.
3. Whether annual prices include or exclude any applicable tax.
4. The date and conditions for public price publication.
5. Exact files and tests listed above.
