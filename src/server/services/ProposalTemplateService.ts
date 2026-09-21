import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getStorageProvider } from '@/lib/storage';
import { AuditService } from './AuditService';

export interface LogoPositionConfig {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateConfig {
  schoolLogoPosition?: LogoPositionConfig;
  codeLineLogoPosition?: LogoPositionConfig;
  dynamicFields?: Array<{
    name: string;
    label: string;
    page: number;
    x: number;
    y: number;
    fontSize?: number;
  }>;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  pdfBuffer: Buffer;
  originalFileName: string;
  config?: TemplateConfig | null;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  config?: TemplateConfig | null;
  pdfBuffer?: Buffer;
  originalFileName?: string;
}

export class ProposalTemplateService {
  static async listTemplates(user: UserSession, options?: { onlyActive?: boolean }) {
    if (
      !hasPermission(user, PERMISSIONS.PROPOSALS_VIEW) &&
      !hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_VIEW)
    ) {
      throw new Error('Forbidden: proposals.template.view permission required');
    }

    const where: any = {};
    if (options?.onlyActive) {
      where.isActive = true;
    }

    return prisma.proposalTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { proposals: true } },
      },
    });
  }

  static async getTemplate(user: UserSession, id: string) {
    if (
      !hasPermission(user, PERMISSIONS.PROPOSALS_VIEW) &&
      !hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_VIEW)
    ) {
      throw new Error('Forbidden: proposals.template.view permission required');
    }

    const template = await prisma.proposalTemplate.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { proposals: true } },
      },
    });

    if (!template) throw new Error('Proposal template not found');
    return template;
  }

  static async createTemplate(user: UserSession, input: CreateTemplateInput) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_CREATE)) {
      throw new Error('Forbidden: proposals.template.create permission required');
    }

    if (!input.name || input.name.trim().length < 2) {
      throw new Error('Template name is required (minimum 2 characters)');
    }

    if (!input.pdfBuffer || input.pdfBuffer.length === 0) {
      throw new Error('PDF file buffer is required');
    }

    // Verify PDF header (%PDF-)
    const pdfHeader = input.pdfBuffer.slice(0, 5).toString('ascii');
    if (!pdfHeader.startsWith('%PDF-')) {
      throw new Error('Invalid file format. The uploaded file is not a valid PDF.');
    }

    const storage = getStorageProvider();
    const uploadRes = await storage.upload(
      input.pdfBuffer,
      input.originalFileName || `${input.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`,
      'application/pdf',
      { keyPrefix: 'proposals/templates' }
    );

    // Default configuration: top-right area on page 1 for school logo (in standard pt coordinates)
    const defaultConfig: TemplateConfig = {
      schoolLogoPosition: {
        page: 1,
        x: 430,
        y: 35,
        width: 120,
        height: 60,
      },
      codeLineLogoPosition: {
        page: 1,
        x: 45,
        y: 35,
        width: 120,
        height: 60,
      },
    };

    const finalConfig = input.config ? { ...defaultConfig, ...input.config } : defaultConfig;

    const template = await prisma.proposalTemplate.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        pdfStorageKey: uploadRes.storageKey,
        pdfStorageProvider: storage.providerId,
        originalFileName: input.originalFileName,
        fileSize: input.pdfBuffer.length,
        isActive: true,
        config: JSON.stringify(finalConfig),
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROPOSAL_TEMPLATE_CREATED',
      entityType: 'ProposalTemplate',
      entityId: template.id,
      metadata: { name: template.name, fileSize: template.fileSize },
    });

    return template;
  }

  static async updateTemplate(user: UserSession, id: string, input: UpdateTemplateInput) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_UPDATE)) {
      throw new Error('Forbidden: proposals.template.update permission required');
    }

    const existing = await prisma.proposalTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('Proposal template not found');

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.isActive !== undefined) data.isActive = !!input.isActive;
    if (input.config !== undefined) {
      data.config = typeof input.config === 'string' ? input.config : JSON.stringify(input.config);
    }

    if (input.pdfBuffer && input.pdfBuffer.length > 0) {
      const pdfHeader = input.pdfBuffer.slice(0, 5).toString('ascii');
      if (!pdfHeader.startsWith('%PDF-')) {
        throw new Error('Invalid file format. The uploaded file is not a valid PDF.');
      }

      const storage = getStorageProvider();
      if (existing.pdfStorageKey) {
        try {
          const oldStorage = getStorageProvider(existing.pdfStorageProvider as any);
          await oldStorage.delete(existing.pdfStorageKey);
        } catch (err) {
          console.warn('Failed to delete old template PDF:', err);
        }
      }

      const uploadRes = await storage.upload(
        input.pdfBuffer,
        input.originalFileName || `${(input.name || existing.name).replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`,
        'application/pdf',
        { keyPrefix: 'proposals/templates' }
      );

      data.pdfStorageKey = uploadRes.storageKey;
      data.pdfStorageProvider = storage.providerId;
      data.originalFileName = input.originalFileName || existing.originalFileName;
      data.fileSize = input.pdfBuffer.length;
    }

    const updated = await prisma.proposalTemplate.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROPOSAL_TEMPLATE_UPDATED',
      entityType: 'ProposalTemplate',
      entityId: id,
      metadata: { name: updated.name },
    });

    return updated;
  }

  static async deleteTemplate(user: UserSession, id: string) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_DELETE)) {
      throw new Error('Forbidden: proposals.template.delete permission required');
    }

    const existing = await prisma.proposalTemplate.findUnique({
      where: { id },
      include: { _count: { select: { proposals: true } } },
    });
    if (!existing) throw new Error('Proposal template not found');

    // Delete stored original PDF
    if (existing.pdfStorageKey) {
      try {
        const storage = getStorageProvider(existing.pdfStorageProvider as any);
        await storage.delete(existing.pdfStorageKey);
      } catch (err) {
        console.warn('Failed to delete template file on storage:', err);
      }
    }

    await prisma.proposalTemplate.delete({ where: { id } });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROPOSAL_TEMPLATE_DELETED',
      entityType: 'ProposalTemplate',
      entityId: id,
      metadata: { name: existing.name },
    });

    return { success: true };
  }

  static async getTemplatePdfBuffer(user: UserSession, id: string): Promise<Buffer> {
    if (
      !hasPermission(user, PERMISSIONS.PROPOSALS_VIEW) &&
      !hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_VIEW)
    ) {
      throw new Error('Forbidden: proposals.template.view permission required');
    }

    const template = await prisma.proposalTemplate.findUnique({ where: { id } });
    if (!template) throw new Error('Template not found');

    const storage = getStorageProvider(template.pdfStorageProvider as any);
    const buffer = await storage.download(template.pdfStorageKey);
    if (!buffer) {
      throw new Error('Original template PDF content not found on storage');
    }

    return buffer;
  }
}