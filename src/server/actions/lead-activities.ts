"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { LeadActivityService } from "@/server/services/LeadActivityService";
import { revalidatePath } from "next/cache";

const schema = z.object({ type: z.enum(["NOTE", "CALL", "EMAIL", "WHATSAPP", "STATUS_CHANGE", "ASSIGNMENT"]), content: z.string().trim().max(5000).nullable().optional(), outcome: z.string().trim().max(200).nullable().optional(), metadata: z.record(z.string(), z.unknown()).optional() }).strict();

function allowed(user: Awaited<ReturnType<typeof requireAuth>>) {
  if (!hasPermission(user, PERMISSIONS.SCHOOLS_UPDATE) && !hasPermission(user, PERMISSIONS.AI_RESEARCH_APPROVE)) throw new Error("Forbidden");
}

export async function listLeadActivitiesAction(leadId: string) {
  try { const user = await requireAuth(); allowed(user); return { success: true as const, activities: await LeadActivityService.list(user, z.string().min(1).max(100).parse(leadId)) }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Unable to load lead activity" }; }
}

export async function createLeadActivityAction(leadId: string, raw: unknown) {
  try { const user = await requireAuth(); allowed(user); const activity = await LeadActivityService.create(user, z.string().min(1).max(100).parse(leadId), schema.parse(raw)); revalidatePath(`/leads/${leadId}`); return { success: true as const, activity }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Unable to record lead activity" }; }
}
