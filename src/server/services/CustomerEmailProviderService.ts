import prisma from '@/lib/db/prisma';
import { decryptSecret, encryptSecret, getProviderCredentials, isGoogleIntegrationPendingReview, type EmailProvider } from '@/lib/integrations/oauth';

export class CustomerEmailProviderError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false) {
    super(message);
    this.name = 'CustomerEmailProviderError';
  }
}

type Integration = {
  id: string;
  organizationId: string;
  provider: string;
  accountEmail: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  scopes: string;
};

function providerName(value: string): EmailProvider {
  const normalized = value.toLowerCase();
  if (normalized === 'google' || normalized === 'microsoft') return normalized;
  throw new CustomerEmailProviderError('UNSUPPORTED_PROVIDER', 'This email provider is not supported.');
}

function header(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function buildMimeMessage(to: string, subject: string, bodyText: string) {
  return [
    `To: ${to}`,
    `Subject: ${header(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    bodyText,
  ].join('\r\n');
}

async function readProviderError(response: Response) {
  try {
    const payload = await response.json() as { error?: { code?: string; message?: string }; error_description?: string };
    return payload.error?.code || payload.error_description || payload.error?.message || `HTTP_${response.status}`;
  } catch {
    return `HTTP_${response.status}`;
  }
}

export class CustomerEmailProviderService {
  static async getIntegration(organizationId: string, provider?: string) {
    const integrations = await prisma.externalIntegration.findMany({
      where: { organizationId, ...(provider ? { provider: provider.toUpperCase() } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    const integration = integrations.find((item) => item.scopes.includes('email'));
    if (!integration) throw new CustomerEmailProviderError('EMAIL_PROVIDER_NOT_CONNECTED', 'Connect Google or Microsoft email before sending.');
    return integration as Integration;
  }

  private static async accessToken(integration: Integration) {
    const provider = providerName(integration.provider);
    const stillValid = integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() > Date.now() + 60_000;
    if (stillValid) return decryptSecret(integration.accessTokenEncrypted);
    if (!integration.refreshTokenEncrypted) throw new CustomerEmailProviderError('EMAIL_PROVIDER_REAUTH_REQUIRED', 'The email connection has expired. Reauthorize it before sending.');
    const credentials = getProviderCredentials(provider);
    if (!credentials.clientId || !credentials.clientSecret) throw new CustomerEmailProviderError('EMAIL_PROVIDER_NOT_CONFIGURED', 'The email provider is not configured on this server.');
    const tokenUrl = provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: decryptSecret(integration.refreshTokenEncrypted),
      grant_type: 'refresh_token',
    });
    let response: Response;
    try {
      response = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    } catch {
      throw new CustomerEmailProviderError('EMAIL_PROVIDER_UNAVAILABLE', 'The email provider could not be reached.', true);
    }
    if (!response.ok) {
      const code = await readProviderError(response);
      throw new CustomerEmailProviderError(code === 'invalid_grant' ? 'EMAIL_PROVIDER_REAUTH_REQUIRED' : 'EMAIL_PROVIDER_AUTH_FAILED', 'The email connection is no longer valid. Reauthorize it before sending.');
    }
    const token = await response.json() as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new CustomerEmailProviderError('EMAIL_PROVIDER_AUTH_FAILED', 'The email provider did not return an access token.');
    await prisma.externalIntegration.update({
      where: { id: integration.id },
      data: { accessTokenEncrypted: encryptSecret(token.access_token), tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null },
    });
    return token.access_token;
  }

  static async send(input: { integration: Integration; to: string; subject: string; bodyText: string }) {
    const provider = providerName(input.integration.provider);
    if (provider === 'google' && isGoogleIntegrationPendingReview()) {
      throw new CustomerEmailProviderError('GOOGLE_REVIEW_PENDING', 'Google email sending is temporarily unavailable while the app is under Google review.');
    }
    const accessToken = await this.accessToken(input.integration);
    const endpoint = provider === 'google'
      ? 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
      : 'https://graph.microsoft.com/v1.0/me/sendMail';
    const payload = provider === 'google'
      ? { raw: Buffer.from(buildMimeMessage(input.to, input.subject, input.bodyText), 'utf8').toString('base64url') }
      : {
          message: {
            subject: input.subject,
            body: { contentType: 'Text', content: input.bodyText },
            toRecipients: [{ emailAddress: { address: input.to } }],
          },
          saveToSentItems: true,
        };
    let response: Response;
    try {
      response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch {
      throw new CustomerEmailProviderError('EMAIL_PROVIDER_UNAVAILABLE', 'The email provider could not be reached.', true);
    }
    if (!response.ok) {
      const providerCode = await readProviderError(response);
      const invalidRecipient = /recipient|address|invalid.*mail|mailbox/i.test(providerCode);
      throw new CustomerEmailProviderError(invalidRecipient ? 'INVALID_RECIPIENT' : 'EMAIL_PROVIDER_REJECTED', 'The email provider rejected this message.', !invalidRecipient && response.status >= 500);
    }
    let providerMessageId: string | null = null;
    if (provider === 'google') {
      try { providerMessageId = ((await response.json()) as { id?: string }).id || null; } catch { providerMessageId = null; }
    }
    return { provider, providerMessageId };
  }
}
