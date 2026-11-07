# Slack integration

SatrCRM connects one Slack workspace to each CRM organization. The connection is scoped to the active `organizationId`, so one organization's token, workspace, channel, and notifications are never reused for another organization. The connection is managed by an organization integration manager and stores the Slack bot token encrypted using `INTEGRATION_ENCRYPTION_KEY` (falling back to `AUTH_SECRET` when the dedicated key is not set).

Each organization can either connect an existing Slack workspace or create a new workspace in Slack first and then return to SatrCRM to install the app there. Slack does not provide an API for SatrCRM to create a workspace on the organization's behalf; workspace creation remains an explicit Slack owner action.

## Slack app setup

Create a Slack app and configure:

- OAuth redirect URL: `${APP_URL}/api/integrations/slack/callback`
- Event Request URL: `${APP_URL}/api/integrations/slack/events`
- Bot Token Scopes: `chat:write`, `channels:read`, `groups:read`
- Enable Events API if you want Slack uninstall events to remove the local connection automatically.

Set these server-only variables:

```env
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
```

The app requests only the scopes needed to list channels and post notifications. The organization administrator chooses the default channel from SatrCRM Settings. The bot must be a member of a private channel before Slack will allow it to post there.

## Current CRM notifications

The integration sends best-effort notifications for:

- new tickets and meeting tickets;
- ticket status changes;
- new deals;
- deal updates.

Slack delivery never blocks or rolls back the CRM operation. SatrCRM remains the source of truth.

## Security

- OAuth state is signed, bound to the authenticated user and organization, and expires after ten minutes.
- Slack access tokens are encrypted at rest and are never returned to the browser after OAuth completion.
- Connect, configure, test, and disconnect require integration-management permission and an active organization entitlement.
- Slack event requests require a valid HMAC signature and a timestamp within five minutes.
- Disconnect removes the local credential even if Slack is unavailable, and attempts provider-side revocation first.
