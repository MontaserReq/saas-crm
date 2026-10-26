'use server';

import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/auth/session';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { evaluateCurrentOperationAuthorization } from '@/lib/security/operationAuthorization';
import { AuditService } from '@/server/services/AuditService';
import { CustomerEmailProviderError, CustomerEmailProviderService } from '@/server/services/CustomerEmailProviderService';
import prisma from '@/lib/db/prisma';

type CustomerRecordType = 'CLIENT' | 'CONTACT' | 'LEAD';

function normalizeType(value: string): CustomerRecordType | null {
  const normalized = value.trim().toUpperCase();
  return normalized === 'CLIENT' || normalized === 'CONTACT' || normalized === 'LEAD' ? normalized : null;
}

function safeInput(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function sendCustomerEmailAction(input: {
  recordType: string;
  recordId: string;
  recipientEmail?: string;
  subject: string;
  bodyText: string;
  provider?: string;
  idempotencyKey?: string;
}) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.CUSTOMER_EMAIL_SEND)) return { success: false as const, error: 'CUSTOMER_EMAIL_PERMISSION_REQUIRED' };
    const organizationId = (await requireOrganizationContext(user)).id;
    const recordType = normalizeType(input.recordType);
    const recordId = safeInput(input.recordId, 100);
    const subject = safeInput(input.subject, 200);
    const bodyText = typeof input.bodyText === 'string' ? input.bodyText.trim().slice(0, 50_000) : '';
    const idempotencyKey = safeInput(input.idempotencyKey, 100) || randomUUID();
    if (!recordType || !recordId) return { success: false as const, error: 'CUSTOMER_EMAIL_RECORD_REQUIRED' };
    if (!subject) return { success: false as const, error: 'CUSTOMER_EMAIL_SUBJECT_REQUIRED' };
    if (!bodyText) return { success: false as const, error: 'CUSTOMER_EMAIL_BODY_REQUIRED' };

    const prepared = await prisma.$transaction(async (tx) => {
      const authorization = await evaluateCurrentOperationAuthorization(tx, { organizationId, userId: user.id, feature: 'email_customer_send', requiredPermissions: [PERMISSIONS.CUSTOMER_EMAIL_SEND] });
      if (!authorization.allowed) throw new Error(`CUSTOMER_EMAIL_${authorization.reasonCode}`);

      const existing = await tx.customerEmail.findUnique({ where: { idempotencyKey } });
      if (existing) {
        if (existing.organizationId !== organizationId || existing.senderId !== user.id) throw new Error('CUSTOMER_EMAIL_IDEMPOTENCY_CONFLICT');
        return { existing };
      }

      let expectedEmail: string | null = null;
      if (recordType === 'CLIENT') {
        const record = await tx.client.findFirst({ where: { id: recordId, organizationId, deletedAt: null }, select: { email: true } });
        expectedEmail = record?.email || null;
      } else if (recordType === 'CONTACT') {
        const record = await tx.contact.findFirst({ where: { id: recordId, organizationId, deletedAt: null }, select: { email: true } });
        expectedEmail = record?.email || null;
      } else {
        const record = await tx.lead.findFirst({ where: { id: recordId, organizationId, deletedAt: null }, select: { email: true } });
        expectedEmail = record?.email || null;
      }
      if (!expectedEmail) throw new Error('CUSTOMER_EMAIL_RECIPIENT_MISSING');
      const recipientEmail = expectedEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error('CUSTOMER_EMAIL_INVALID_RECIPIENT');

      const integrations = await tx.externalIntegration.findMany({ where: { organizationId }, orderBy: { updatedAt: 'desc' } });
      const requestedProvider = safeInput(input.provider, 30).toUpperCase();
      const integration = integrations.find((item) => (!requestedProvider || item.provider === requestedProvider) && item.scopes.includes('email'));
      if (!integration) throw new Error('CUSTOMER_EMAIL_PROVIDER_NOT_CONNECTED');

      const email = await tx.customerEmail.create({ data: { organizationId, senderId: user.id, integrationId: integration.id, provider: integration.provider, recipientEmail, subject, bodyText, relatedEntityType: recordType, relatedEntityId: recordId, idempotencyKey } });
      return { email, integration };
    }, { maxWait: 10_000, timeout: 20_000 });

    if ('existing' in prepared && prepared.existing) {
      if (prepared.existing.status === 'ACCEPTED') return { success: true as const, emailId: prepared.existing.id, duplicate: true as const };
      return { success: false as const, error: prepared.existing.status === 'PENDING' ? 'CUSTOMER_EMAIL_IN_PROGRESS' : 'CUSTOMER_EMAIL_ALREADY_ATTEMPTED' };
    }

    try {
      const sent = await CustomerEmailProviderService.send({ integration: prepared.integration, to: prepared.email.recipientEmail, subject: prepared.email.subject, bodyText: prepared.email.bodyText });
      await prisma.customerEmail.update({ where: { id: prepared.email.id }, data: { status: 'ACCEPTED', providerMessageId: sent.providerMessageId, sentAt: new Date() } });
      await AuditService.logAudit({ actorId: user.id, organizationId, action: 'CUSTOMER_EMAIL_SENT', entityType: recordType[0] + recordType.slice(1).toLowerCase(), entityId: recordId, metadata: { customerEmailId: prepared.email.id, provider: sent.provider, providerMessageId: sent.providerMessageId, recipientEmail: prepared.email.recipientEmail, subject: prepared.email.subject } });
      return { success: true as const, emailId: prepared.email.id, duplicate: false as const };
    } catch (error) {
      const providerError = error instanceof CustomerEmailProviderError ? error : null;
      await prisma.customerEmail.update({ where: { id: prepared.email.id }, data: { status: providerError?.retryable ? 'UNKNOWN' : 'FAILED', errorCode: providerError?.code || 'EMAIL_PROVIDER_ERROR', errorMessage: providerError?.message || 'Email provider failed' } }).catch(() => undefined);
      return { success: false as const, error: providerError?.code || 'CUSTOMER_EMAIL_SEND_FAILED' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CUSTOMER_EMAIL_SEND_FAILED';
    return { success: false as const, error: message.startsWith('CUSTOMER_EMAIL_') ? message : 'CUSTOMER_EMAIL_SEND_FAILED' };
  }
}
