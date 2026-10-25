# Platform Admin page access review

The Platform Admin area uses lifecycle-based access instead of generic CRUD.
The UI and server-action boundary both use `src/lib/platform/access.ts`.

| Page/data | Access | Rationale |
| --- | --- | --- |
| Platform overview | Read only | Aggregated status and navigation |
| Companies | Limited update | Company identity and suspension may change; creation belongs to registration and records are retained |
| Signups & onboarding | Read only | Operational monitoring of registration progress |
| Users & access | Read only | Tenant-owned; each company administrator manages its own team |
| Shared roles & permissions | Update | Platform Admin maintains the shared role templates; company admins cannot alter the Platform Admin role |
| Plan catalog | Create and update | Platform-owned commercial catalog; unpublish instead of delete |
| Subscriptions | Read only | Financial history; activation/payment changes use the reviewed payment workflow |
| Plan upgrade requests | Workflow actions | Confirm payment, reject, or activate only when the request state allows it |
| Integrations | Read only | Tenant-owned credentials; company settings/OAuth flows own connection changes |
| Support cases | Limited update | Original request stays immutable; only status, priority, and resolution change |
| Audit log | Read only | Immutable security history; Platform Admin sees all companies |
| Platform health | Read only | Monitoring signals |
| Platform analytics | Read only | Aggregated reporting |
| Global settings | Limited update | Only approved values change; keys cannot be created or deleted |

Hard deletion is intentionally absent from the generic Platform Admin pages.
Tenant data, financial records, support requests and configuration history must
remain auditable. Status fields such as `isActive` are the reversible lifecycle
control where applicable.
