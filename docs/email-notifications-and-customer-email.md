# SatrCRM email notifications and customer email

## Supported capabilities

SatrCRM keeps two email paths separate:

- System and security email uses the platform's configured SMTP sender. It is available to every plan and is independent from the customer-email entitlement.
- Customer email is sent from an organization's connected Google Workspace/Gmail or Microsoft 365 identity. It is available only to Scale and Enterprise and is enforced on the server with the `email_customer_send` entitlement.

Customer email is currently single-recipient and record-based. The composer uses the verified email stored on a client, contact, or lead; it does not trust a browser-supplied organization or recipient. Inbox synchronization, reply threading, bulk campaigns, open tracking, and delivery webhooks are intentionally out of scope.

## System notification email mapping

Notifications created through `NotificationService.create` can be delivered in-app and by email when the user has email notifications enabled. The current supported categories are:

- `TICKET_ASSIGNED`
- `TICKET_TRANSFERRED`
- `NEW_MESSAGE`
- `MENTION`
- `WORKFLOW`
- `SCHOOL_APPROVAL_REQUESTED`

Authentication and account-security emails remain on their existing dedicated flows and are not disabled by ordinary notification preferences. Existing code paths that create an in-app notification directly through Prisma remain in-app only until they are migrated to the notification service; this is deliberate so unsupported events do not unexpectedly email users.

## Delivery and retry behavior

`NotificationDelivery` is a durable per-notification/channel outbox record. A delivery is deduplicated by `(notificationId, channel)`, attempts are capped at three, transient failures receive a short retry delay, and permanent failures are recorded without an infinite retry loop. Delivery failures are isolated from the CRM transaction.

The current deployment has no separate worker or queue process. Pending notification email deliveries are processed opportunistically when the user's notifications are read. This is safe and durable for the existing single-app deployment, but a dedicated worker should be introduced before high-volume notification delivery.

## Organization email connection

The settings page starts the existing official OAuth flow for Google or Microsoft. Access and refresh tokens are encrypted at rest with `INTEGRATION_ENCRYPTION_KEY`; tokens and provider errors are never returned to the browser. The production callback is:

`https://app.satrcrm.com/api/integrations/oauth/callback`

The provider application must allow the callback and request the minimum email-send scopes used by the implementation.

## Required production configuration

Configure these server-side values in `/opt/satrcrm/.env`:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME` for system email.
- `INTEGRATION_ENCRYPTION_KEY` for encrypted OAuth credentials.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google OAuth, when enabled.
- `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` for Microsoft OAuth, when enabled.
- `APP_URL`, `APP_ORIGIN`, and `NEXT_PUBLIC_APP_URL` must use the canonical application origin `https://app.satrcrm.com`.

No provider secret belongs in source control or a browser-visible environment variable. Live customer-email testing requires a connected test organization and a controlled test recipient.
