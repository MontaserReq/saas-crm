import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getStorageProvider } from '@/lib/storage';
import { AuditService } from './AuditService';
import { ProposalTemplateService, TemplateConfig } from './ProposalTemplateService';
import { applyProposalOverlay } from '@/lib/pdf/proposalOverlay';
import { formatProposalCode } from '@/lib/proposals/proposalUtils';
import { requireOrganizationContext } from '@/lib/auth/organization';

export interface ProposalServiceItem {
  id?: string;
  title: string;
  description?: string;
  price?: string;
}

export interface ProposalInput {
  title: string;
  clientName: string;
  contactPerson?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  schoolId?: string | null;
  clientId?: string | null;
  templateId?: string | null;
  status?: 'DRAFT' | 'GENERATED' | 'SENT';
  services?: ProposalServiceItem[];
  terms?: string | null;
  notes?: string | null;
}

const proposalInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  template: {
    select: {
      id: true,
      name: true,
      originalFileName: true,
      config: true,
      isActive: true,
    },
  },
  school: {
    select: {
      id: true,
      name: true,
      city: true,
      logoKey: true,
      logoProvider: true,
      responsibleEmployeeId: true,
    },
  },
  client: { select: { id: true, name: true, type: true, status: true, logoKey: true, logoProvider: true } },
} as const;

export class ProposalService {
  static async listProposals(
    user: UserSession,
    filter?: { search?: string; status?: string; schoolId?: string; clientId?: string; templateId?: string }
  ) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_VIEW)) {
      throw new Error('Forbidden: proposals.view permission required');
    }
    const organizationId = (await requireOrganizationContext(user)).id;

    const where: any = { organizationId };

    if (filter?.status && filter.status !== 'ALL') {
      where.status = filter.status;
    }

    if (filter?.schoolId && filter.schoolId !== 'ALL') {
      where.schoolId = filter.schoolId;
    }
    if (filter?.clientId && filter.clientId !== 'ALL') where.clientId = filter.clientId;

    if (filter?.templateId && filter.templateId !== 'ALL') {
      where.templateId = filter.templateId;
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { clientName: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.proposal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: proposalInclude,
    });
  }

  static async getProposal(user: UserSession, id: string) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_VIEW)) {
      throw new Error('Forbidden: proposals.view permission required');
    }

    const organizationId = (await requireOrganizationContext(user)).id;
    const proposal = await prisma.proposal.findFirst({
      where: { id, organizationId },
      include: proposalInclude,
    });

    if (!proposal) throw new Error('Proposal not found');
    return proposal;
  }

  static async createProposal(user: UserSession, input: ProposalInput) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_CREATE)) {
      throw new Error('Forbidden: proposals.create permission required');
    }
    const organizationId = (await requireOrganizationContext(user)).id;

    if (!input.title || input.title.trim().length < 2) {
      throw new Error('Proposal title is required (minimum 2 characters)');
    }
    if (!input.clientName || input.clientName.trim().length < 2) {
      throw new Error('Client or school name is required');
    }

    if (input.schoolId) {
      const school = await prisma.school.findFirst({ where: { id: input.schoolId, organizationId }, select: { id: true } });
      if (!school) throw new Error('Selected school does not belong to the active organization');
    }
    if (input.clientId) {
      const client = await prisma.client.findFirst({ where: { id: input.clientId, organizationId, deletedAt: null }, select: { id: true } });
      if (!client) throw new Error('Selected client does not belong to the active organization');
    }
    if (input.templateId) {
      const template = await prisma.proposalTemplate.findFirst({ where: { id: input.templateId, organizationId, isActive: true }, select: { id: true } });
      if (!template) throw new Error('Selected proposal template does not belong to the active organization');
    }

    // Resolve School logo snapshot:
    // If a schoolId is chosen and has an existing logo, take a snapshot of it for this proposal.
    let initialLogoKey: string | null = null;
    let initialLogoProvider = 'local';

    if (input.schoolId) {
      const school = await prisma.school.findFirst({
        where: { id: input.schoolId, organizationId },
        select: { logoKey: true, logoProvider: true },
      });
      if (school?.logoKey) {
        initialLogoKey = school.logoKey;
        initialLogoProvider = school.logoProvider || 'local';
      }
    }

    const contentJson = JSON.stringify({
      services: input.services || [],
      terms: input.terms || '',
      notes: input.notes || '',
    });

    const proposal = await prisma.proposal.create({
      data: {
        title: input.title.trim(),
        clientName: input.clientName.trim(),
        contactPerson: input.contactPerson?.trim() || null,
        clientEmail: input.clientEmail?.trim() || null,
        clientPhone: input.clientPhone?.trim() || null,
        schoolId: input.schoolId || null,
        clientId: input.clientId || input.schoolId || null,
        templateId: input.templateId || null,
        logoKey: initialLogoKey,
        logoProvider: initialLogoProvider,
        status: input.status || 'DRAFT',
        content: contentJson,
        createdById: user.id,
        organizationId,
      },
      include: proposalInclude,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROPOSAL_CREATED',
      entityType: 'Proposal',
      entityId: proposal.id,
      metadata: { title: proposal.title, clientName: proposal.clientName, templateId: proposal.templateId },
    });

    return proposal;
  }

  static async updateProposal(user: UserSession, id: string, input: Partial<ProposalInput>) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_UPDATE)) {
      throw new Error('Forbidden: proposals.update permission required');
    }
    const organizationId = (await requireOrganizationContext(user)).id;

    const existing = await prisma.proposal.findFirst({ where: { id, organizationId } });
    if (!existing) throw new Error('Proposal not found');

    if (input.schoolId) {
      const school = await prisma.school.findFirst({ where: { id: input.schoolId, organizationId }, select: { id: true } });
      if (!school) throw new Error('Selected school does not belong to the active organization');
    }
    if (input.clientId) {
      const client = await prisma.client.findFirst({ where: { id: input.clientId, organizationId, deletedAt: null }, select: { id: true } });
      if (!client) throw new Error('Selected client does not belong to the active organization');
    }
    if (input.templateId) {
      const template = await prisma.proposalTemplate.findFirst({ where: { id: input.templateId, organizationId, isActive: true }, select: { id: true } });
      if (!template) throw new Error('Selected proposal template does not belong to the active organization');
    }

    const data: any = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.clientName !== undefined) data.clientName = input.clientName.trim();
    if (input.contactPerson !== undefined) data.contactPerson = input.contactPerson?.trim() || null;
    if (input.clientEmail !== undefined) data.clientEmail = input.clientEmail?.trim() || null;
    if (input.clientPhone !== undefined) data.clientPhone = input.clientPhone?.trim() || null;
    if (input.schoolId !== undefined) data.schoolId = input.schoolId || null;
    if (input.clientId !== undefined) data.clientId = input.clientId || null;
    if (input.templateId !== undefined) data.templateId = input.templateId || null;
    if (input.status !== undefined) data.status = input.status;

    if (input.services !== undefined || input.terms !== undefined || input.notes !== undefined) {
      let currentContent: any = {};
      try {
        if (existing.content) currentContent = JSON.parse(existing.content);
      } catch {}

      data.content = JSON.stringify({
        services: input.services !== undefined ? input.services : currentContent.services || [],
        terms: input.terms !== undefined ? input.terms : currentContent.terms || '',
        notes: input.notes !== undefined ? input.notes : currentContent.notes || '',
      });
    }

    const updated = await prisma.proposal.update({
      where: { id },
      data,
      include: proposalInclude,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROPOSAL_UPDATED',
      entityType: 'Proposal',
      entityId: id,
      metadata: { title: updated.title },
    });

    return updated;
  }

  static async deleteProposal(user: UserSession, id: string) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_DELETE)) {
      throw new Error('Forbidden: proposals.delete permission required');
    }
    const organizationId = (await requireOrganizationContext(user)).id;

    const existing = await prisma.proposal.findFirst({ where: { id, organizationId } });
    if (!existing) throw new Error('Proposal not found');

    // Delete generated PDF if stored
    if (existing.generatedPdfKey) {
      try {
        const storage = getStorageProvider(existing.generatedPdfProvider as any);
        await storage.delete(existing.generatedPdfKey);
      } catch (e) {
        console.warn('Failed to delete proposal generated pdf:', e);
      }
    }

    await prisma.proposal.delete({ where: { id } });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROPOSAL_DELETED',
      entityType: 'Proposal',
      entityId: id,
      metadata: { title: existing.title },
    });

    return { success: true };
  }

  /**
   * Uploads or updates a School Logo.
   * Also updates the proposal's snapshot if proposalId is provided.
   */
  static async uploadSchoolLogo(
    user: UserSession,
    schoolId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    proposalId?: string
  ) {
    if (
      !hasPermission(user, PERMISSIONS.SCHOOLS_UPDATE) &&
      !hasPermission(user, PERMISSIONS.PROPOSALS_UPDATE) &&
      !hasPermission(user, PERMISSIONS.PROPOSALS_CREATE)
    ) {
      throw new Error('Forbidden: Insufficient permissions to upload school logo');
    }
    const organizationId = (await requireOrganizationContext(user)).id;

    const school = await prisma.school.findFirst({ where: { id: schoolId, organizationId } });
    if (!school) throw new Error('School not found');

    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimes.includes(mimeType.toLowerCase())) {
      throw new Error('Invalid file type. Allowed formats: PNG, JPG, WebP');
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (fileBuffer.length > MAX_SIZE) {
      throw new Error('File size exceeds 5MB limit');
    }

    const storage = getStorageProvider();

    // Delete old school logo if exists
    if (school.logoKey) {
      try {
        const oldStorage = getStorageProvider(school.logoProvider as any);
        await oldStorage.delete(school.logoKey);
      } catch {}
    }

    const uploadRes = await storage.upload(fileBuffer, originalName, mimeType, {
      keyPrefix: `${organizationId}/schools/logos`,
    });

    // Update School record
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        logoKey: uploadRes.storageKey,
        logoProvider: storage.providerId,
      },
    });

    // If linked to a proposal, update the proposal snapshot
    if (proposalId) {
      const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, organizationId }, select: { id: true } });
      if (!proposal) throw new Error('Proposal not found');
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          logoKey: uploadRes.storageKey,
          logoProvider: storage.providerId,
        },
      });
    }

    return { storageKey: uploadRes.storageKey, provider: storage.providerId };
  }

  /**
   * Direct logo upload for a proposal snapshot.
   */
  static async uploadLogo(
    user: UserSession,
    proposalId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string
  ) {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_UPDATE)) {
      throw new Error('Forbidden: proposals.update permission required');
    }
    const organizationId = (await requireOrganizationContext(user)).id;

    const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, organizationId } });
    if (!proposal) throw new Error('Proposal not found');

    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimes.includes(mimeType.toLowerCase())) {
      throw new Error('Invalid file type. Allowed formats: PNG, JPG, WebP');
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (fileBuffer.length > MAX_SIZE) {
      throw new Error('File size exceeds 5MB limit');
    }

    const storage = getStorageProvider();

    if (proposal.logoKey) {
      try {
        const oldStorage = getStorageProvider(proposal.logoProvider as any);
        await oldStorage.delete(proposal.logoKey);
      } catch {}
    }

    const uploadRes = await storage.upload(fileBuffer, originalName, mimeType, {
      keyPrefix: `${organizationId}/proposals/logos`,
    });

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        logoKey: uploadRes.storageKey,
        logoProvider: storage.providerId,
      },
      include: proposalInclude,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROPOSAL_UPDATED',
      entityType: 'Proposal',
      entityId: proposalId,
      metadata: { action: 'logo_uploaded', fileName: originalName },
    });

    return updated;
  }

  /**
   * Generates the final PDF via PDF Overlay on top of the reusable Template.
   */
  static async generateProposal(user: UserSession, proposalId: string): Promise<Buffer> {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_GENERATE)) {
      throw new Error('Forbidden: proposals.generate permission required');
    }
    const organizationId = (await requireOrganizationContext(user)).id;

    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, organizationId },
      include: proposalInclude,
    });

    if (!proposal) throw new Error('Proposal not found');

    let finalPdfBuffer: Buffer;

    if (proposal.template) {
      // 1. Fetch template PDF
      const basePdfBuffer = await ProposalTemplateService.getTemplatePdfBuffer(user, proposal.template.id);

      // 2. Parse template configuration
      let templateConfig: TemplateConfig = {};
      if (proposal.template.config) {
        try {
          templateConfig = JSON.parse(proposal.template.config);
        } catch {}
      }

      // 3. Fetch school logo snapshot buffer (if present)
      let schoolLogoBuffer: Buffer | null = null;
      let schoolLogoMime = 'image/png';
      if (proposal.logoKey) {
        try {
          const logoStorage = getStorageProvider(proposal.logoProvider as any);
          schoolLogoBuffer = await logoStorage.download(proposal.logoKey);
          if (proposal.logoKey.endsWith('.jpg') || proposal.logoKey.endsWith('.jpeg')) {
            schoolLogoMime = 'image/jpeg';
          } else if (proposal.logoKey.endsWith('.webp')) {
            schoolLogoMime = 'image/webp';
          }
        } catch (err) {
          console.warn('Could not load logo snapshot for proposal:', err);
        }
      }

      // 4. Apply PDF Overlay (without changing original template)
      finalPdfBuffer = await applyProposalOverlay({
        basePdfBuffer,
        templateConfig,
        schoolLogoBuffer,
        schoolLogoMimeType: schoolLogoMime,
        dynamicValues: {
          clientName: proposal.clientName,
          contactPerson: proposal.contactPerson || undefined,
          date: new Date(proposal.createdAt).toLocaleDateString('en-US'),
          proposalNumber: formatProposalCode(proposal),
          title: proposal.title,
        },
      });
    } else {
      // If no template is linked, throw clear error prompting template selection
      throw new Error('A Proposal Template must be selected to generate this proposal.');
    }

    const proposalCode = formatProposalCode(proposal);
    // 5. Store generated PDF on storage
    const storage = getStorageProvider();
    const fileName = `Proposal_${proposalCode}_${proposal.title.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]+/g, '_')}.pdf`;
    const uploadRes = await storage.upload(finalPdfBuffer, fileName, 'application/pdf', {
      keyPrefix: `${organizationId}/proposals/generated`,
    });

    // 6. Update Proposal status and pdf reference
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: 'GENERATED',
        generatedPdfKey: uploadRes.storageKey,
        generatedPdfProvider: storage.providerId,
        generatedAt: new Date(),
      },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROPOSAL_GENERATED',
      entityType: 'Proposal',
      entityId: proposalId,
      metadata: { title: proposal.title, templateId: proposal.templateId, fileSize: finalPdfBuffer.length },
    });

    return finalPdfBuffer;
  }

  /**
   * Retrieves the generated PDF buffer for download or preview.
   */
  static async getGeneratedPdfBuffer(user: UserSession, proposalId: string): Promise<{ buffer: Buffer; fileName: string }> {
    if (!hasPermission(user, PERMISSIONS.PROPOSALS_VIEW)) {
      throw new Error('Forbidden: proposals.view permission required');
    }
    const organizationId = (await requireOrganizationContext(user)).id;

    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, organizationId },
      select: {
        id: true,
        title: true,
        clientName: true,
        createdAt: true,
        generatedPdfKey: true,
        generatedPdfProvider: true,
      },
    });

    if (!proposal) throw new Error('Proposal not found');

    const proposalCode = formatProposalCode(proposal);
    const fileName = `Proposal_${proposalCode}_${proposal.title.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]+/g, '_')}.pdf`;

    if (proposal.generatedPdfKey) {
      const storage = getStorageProvider(proposal.generatedPdfProvider as any);
      const buffer = await storage.download(proposal.generatedPdfKey);
      if (buffer) return { buffer, fileName };
    }

    // If not generated yet or file missing, generate on demand
    const buffer = await ProposalService.generateProposal(user, proposalId);
    return { buffer, fileName };
  }
}
