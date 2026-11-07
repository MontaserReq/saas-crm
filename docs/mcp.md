# SatrCRM MCP access

SatrCRM exposes a standards-based remote MCP endpoint at:

```text
https://<app-origin>/api/mcp
```

The endpoint uses Streamable HTTP in stateless mode so it remains safe behind a load balancer and does not depend on an in-memory session store. Every request must include a bearer access token.

## Security model

- Tokens are created for exactly one active user and one organization.
- Only the keyed digest is stored in PostgreSQL; the raw token is shown once.
- Tokens expire by default after 90 days and cannot be created for longer than one year.
- Tokens can be revoked immediately.
- The initial scope is `crm.read`; no write tools are exposed.
- The MCP tool list is filtered by the authenticated user’s existing CRM permissions.
- Existing service-level tenant and record authorization is re-applied when each tool runs.
- Requests are rate-limited by source IP and token, with a fail-closed database limiter.
- All exposed tools are annotated as read-only and return trimmed payloads.
- No organization id, user id, SQL, or arbitrary service name is accepted from tool arguments.

## Database migration

Run the normal migration flow before using the endpoint:

```bash
npx prisma migrate deploy
npx prisma generate
```

## Create and revoke a token

Token management requires the existing `organization_settings.manage` permission and uses the normal SatrCRM browser session.

```http
POST /api/mcp/tokens
Content-Type: application/json

{
  "name": "Claude CRM read access",
  "scopes": ["crm.read"]
}
```

The response contains `token` exactly once. Store it in the MCP client’s secret/header configuration. The token is not returned by the list endpoint.

```http
GET /api/mcp/tokens
DELETE /api/mcp/tokens/<token-id>
```

## Connect a compatible MCP client

Use the server URL and a bearer header:

```text
Authorization: Bearer sat_mcp_<secret>
```

For ChatGPT and Claude remote connectors, use the public HTTPS URL and configure the bearer credential in the connector’s authentication/request-header settings. For Groq or another API client, pass the URL and `Authorization` header in its remote MCP tool configuration.

## Browser-based MCP clients

Keep `MCP_ALLOWED_ORIGINS` empty for server-to-server clients. If a browser-based client needs to call the endpoint directly, set an explicit comma-separated allowlist, for example:

```env
MCP_ALLOWED_ORIGINS=https://trusted-client.example,https://another-client.example
```

Never use `*` for this setting when bearer authentication is enabled.
