import prisma from '@/lib/db/prisma';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { platformSupportRequestInput } from '@/lib/platform/validation';
import type { UserSession } from '@/types';

export const PlatformSupportService = {
  async list(user: UserSession) {
    const context = await requireOrganizationContext(user);
    const cases = await prisma.platformSupportCase.findMany({
      where: { organizationId: context.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        resolution: true,
        contactEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      organization: { id: context.id, name: context.name },
      cases: cases.map(item => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  },

  async create(user: UserSession, raw: unknown) {
    const input = platformSupportRequestInput.parse(raw);
    const context = await requireOrganizationContext(user);

    return prisma.$transaction(async tx => {
      const supportCase = await tx.platformSupportCase.create({
        data: {
          organizationId: context.id,
          subject: input.subject,
          description: input.description,
          contactEmail: user.email,
          status: 'OPEN',
          priority: input.priority,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: context.id,
          actorId: user.id,
          action: 'PLATFORM_SUPPORT_REQUESTED',
          entityType: 'PlatformSupportCase',
          entityId: supportCase.id,
          metadata: JSON.stringify({ priority: input.priority }),
        },
      });

      return { id: supportCase.id };
    });
  },
};
