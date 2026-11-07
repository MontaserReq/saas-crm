import prisma from "@/lib/db/prisma";
import { requireOrganizationContext } from "@/lib/auth/organization";
import type { UserSession } from "@/types";
import { AuditService } from "./AuditService";

export type LeadActivityInput = {
  type: "NOTE" | "CALL" | "EMAIL" | "WHATSAPP" | "STATUS_CHANGE" | "ASSIGNMENT";
  content?: string | null;
  outcome?: string | null;
  metadata?: Record<string, unknown>;
};

export class LeadActivityService {
  static async list(user: UserSession, leadId: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    return prisma.leadActivity.findMany({ where: { organizationId, leadId }, orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, name: true, email: true } } } });
  }

  static async create(user: UserSession, leadId: string, input: LeadActivityInput) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId, deletedAt: null }, select: { id: true } });
    if (!lead) throw new Error("Lead not found");
    if (!input.content?.trim() && input.type !== "ASSIGNMENT" && input.type !== "STATUS_CHANGE") throw new Error("Activity content is required");
    const activity = await prisma.leadActivity.create({ data: { organizationId, leadId, actorId: user.id, type: input.type, content: input.content?.trim() || null, outcome: input.outcome?.trim() || null, metadata: JSON.stringify(input.metadata || {}) }, include: { actor: { select: { id: true, name: true, email: true } } } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: `LEAD_${input.type}_RECORDED`, entityType: "Lead", entityId: leadId, metadata: { activityId: activity.id, outcome: input.outcome || null } });
    return activity;
  }
}
