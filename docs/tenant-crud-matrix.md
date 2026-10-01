# Tenant CRUD Verification Matrix

`PASS` means an executable disposable-PostgreSQL isolation check passed. `N/A` means the operation is not exposed or not meaningful for that resource. `UNVERIFIED` means the operation exists but still needs a dedicated end-to-end check.

| Resource | Read | Create | Update | Delete | List | Count | Search |
|---|---:|---:|---:|---:|---:|---:|---:|
| School | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Ticket | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Ticket approval request | PASS | PASS | PASS | N/A | PASS | N/A | N/A |
| Proposal | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Proposal template | PASS | PASS | PASS | PASS | PASS | N/A | N/A |
| Calendar event | PASS | PASS | PASS | PASS | PASS | N/A | N/A |
| Assignment | PASS | PASS | N/A | N/A | PASS | PASS | N/A |
| Chat / conversation | PASS | PASS | N/A | N/A | PASS | N/A | N/A |
| Message | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| Attachment | PASS | PASS | N/A | N/A | N/A | N/A | N/A |
| Department / task type | PASS | PASS | PASS | PASS | PASS | N/A | N/A |
| Team / team member | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| User / membership | PASS | N/A | PASS | PASS | PASS | N/A | N/A |
| Todo | PASS | PASS | PASS | PASS | PASS | N/A | N/A |
| Note | PASS | PASS | N/A | N/A | PASS | N/A | N/A |
| Notification | PASS | PASS | PASS | N/A | PASS | PASS | N/A |
| Activity event | PASS | N/A | N/A | N/A | PASS | N/A | N/A |
| Research job / research data | PASS | PASS | N/A | N/A | PASS | N/A | N/A |
| Message template | PASS | N/A | N/A | N/A | PASS | N/A | N/A |

The executable local harnesses are [tenant-local-crud-check.ts](../scripts/tenant-local-crud-check.ts) and [tenant_final_crud_actions.test.ts](../tests/security/tenant_final_crud_actions.test.ts). They cover same-organization success, cross-organization denial, list/count/search isolation, relation ownership, and unchanged state after denied mutations for the service and authenticated action surfaces exercised. Attachment deletion is `N/A` because no delete operation exists. Storage and production gates remain separate from this matrix.
