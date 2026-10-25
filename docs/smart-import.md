# Smart Excel/CSV Import

## Architecture discovered

CodeLine CRM is a Prisma/PostgreSQL, organization-scoped application. The import feature reuses the existing `Client`, `Lead`, `Contact`, `Deal`, and `CrmTask` models and the tenant-scoped `CustomFieldDefinition` / `CustomFieldValue` system. Authentication derives the active organization from one active membership. The existing `schools.import` permission is already tied to the `import_export` plan feature and is reused for import access.

The repository does not have an arbitrary custom-module model or a general background queue. Smart Import therefore supports only the five generic CRM entities above, does not manufacture custom modules, and uses deliberately bounded synchronous transactions.

## Workflow

1. `POST /api/imports/analyze` streams a bounded multipart upload, validates its extension, MIME type, signature, dimensions, and cells, then stores a short-lived tenant-owned draft.
2. Deterministic mapping scores normalized English and Arabic aliases plus sample-value types. Ambiguous destinations require manual selection. AI is not required and no AI response can execute writes.
3. `POST /api/imports/:id/preview` reloads the server-owned rows, validates every mapping, resolves tenant-owned relationships, reports ignored fields, required values, invalid types, file duplicates, existing exact matches, ambiguous matches, and proposed custom fields.
4. `POST /api/imports/:id/confirm` claims the draft with an idempotency key, repeats the full preview, and creates fields, values, records, history, and audit metadata in one transaction. Failed transactions leave no imported records or custom fields. A successful replay returns the stored summary.
5. Completed/cancelled imports discard source rows. Draft rows expire after 24 hours. Sanitized failure reasons expire after 30 days and can be downloaded as formula-safe CSV while retained.

## Mapping and field support

- Destinations: Client, Lead, Contact, Deal, Task.
- New custom fields: text, textarea, number, currency, boolean, date, datetime, email, phone, URL, single-select, and multi-select. Select options are reviewed explicitly.
- Existing custom fields of the same types can be mapped. Required existing fields must be mapped.
- Relationships accept an in-tenant ID or, where appropriate, an exact unique name/email. Ambiguous names are rejected. Deal stages are validated against the selected pipeline.
- New custom fields are organization- and entity-scoped. Spreadsheet columns never become physical database columns.
- Uniqueness is not offered for custom fields because the current custom-field schema has no enforceable unique-value capability.

## Duplicate modes

- `CREATE`: creates valid rows. If an email/phone match field is selected, existing exact matches are shown before confirmation but a single match does not change the requested create behavior.
- `SKIP_DUPLICATES`: skips exact existing matches.
- `UPDATE`: updates only explicitly mapped fields on an exact existing match and skips unmatched rows.
- `UPSERT`: updates exact matches and creates unmatched rows.

Reliable match fields are email/phone for Clients and Leads, and email/phone/mobile for Contacts. Deals and Tasks intentionally do not expose update/upsert because their titles are not reliable identities. Duplicate uploaded identities after the first row are rejected and reported. Multiple existing records sharing an identity are rejected rather than guessed.

## Limits and security

- Default maximum file size: 5 MiB.
- Default maximum data rows: 2,000.
- Maximum columns: 80; maximum parsed cells: 100,000; maximum cell text: 10,000 characters.
- File types: `.xlsx` and `.csv`. Legacy `.xls` is rejected because the maintained parser selected for this feature does not safely support it; users must save it as `.xlsx` or `.csv` first.
- Workbook sheets are selected explicitly and never silently combined.
- Macros/VBA, formulas, HTML, and styles are not loaded or executed.
- Mutation routes enforce origin checks, authentication, the import permission, and server-derived organization scope.
- All client mappings are revalidated. Related IDs/names and update targets are resolved inside the authenticated organization.
- Failure exports prefix formula-like cells and set no-store/nosniff headers.
- Raw database errors and staged record contents are not exposed in confirmation failures.

The limits can be lowered with `CRM_IMPORT_MAX_FILE_BYTES`, `CRM_IMPORT_MAX_ROWS`, `CRM_IMPORT_MAX_COLUMNS`, and `CRM_IMPORT_MAX_CELLS`. Raising them should follow introduction of a real background job/queue and streaming workbook reader.

## Database deployment

Apply `prisma/migrations/20261013193000_smart_data_import/migration.sql` and regenerate Prisma Client. The migration adds only `DataImport`; it does not alter CRM record columns or onboarding state.

## Verification

- `npx tsc --noEmit`
- `npm run lint`
- `npx vitest run tests/unit/smart_import.test.ts tests/security/smart_import_security.test.ts`
- `$env:RUN_SMART_IMPORT_DB='1'; npx vitest run tests/integration/smart_import_database.test.ts`
- `npm test` for the complete repository suite

The focused tests cover XLSX/XLS/CSV parsing, multilingual mapping, ambiguity, type validation, multi-sheet selection, malformed/empty/oversized data, formula-safe reports, mutation guards, plan/permission routing, RTL wiring, tenant isolation, custom-field creation, update-only mapped fields, duplicate rows, transaction persistence, and idempotent replay.

## Known limitations

- No arbitrary custom modules. Supporting inventory/properties/etc. requires a tenant-owned module-definition model, relation metadata, generic record storage, permissions, search/filter integration, and UI rendering.
- AI-assisted suggestions are not enabled. The deterministic engine is the complete fallback and current production path.
- This synchronous design is intentionally capped at 2,000 rows. Larger imports need the queue architecture described above.
- Relationship matching is exact, not fuzzy. This avoids cross-record guesses.
- Bulk imports do not dispatch one workflow event per row; doing that safely needs a post-commit batched event/outbox design.
