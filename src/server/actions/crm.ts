"use server";

import { requireAuth } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { ClientService, ClientInput } from "@/server/services/ClientService";
import { LeadService, LeadInput } from "@/server/services/LeadService";
import { ContactService, ContactInput } from "@/server/services/ContactService";
import { revalidatePath } from "next/cache";
import {
  hasPlanFeature,
  type PlanFeatureId,
} from "@/lib/platform/entitlements";
import { OperationApprovalService } from "@/server/services/OperationApprovalService";

function allowed(
  user: Awaited<ReturnType<typeof requireAuth>>,
  permission: string,
  feature: PlanFeatureId,
) {
  // Existing tenant deployments have school permissions but not yet separate
  // client permissions. Keep that capability mapping explicit and server-side.
  const fallback: Record<string, string> = {
    view: PERMISSIONS.SCHOOLS_VIEW,
    create: PERMISSIONS.SCHOOLS_CREATE,
    update: PERMISSIONS.SCHOOLS_UPDATE,
    delete: PERMISSIONS.SCHOOLS_DELETE,
  };
  if (
    !hasPlanFeature(user, feature) ||
    (!hasPermission(user, permission) &&
      !hasPermission(user, fallback[permission]))
  )
    throw new Error("Forbidden");
}

function revalidateCrmList(path: "/leads" | "/contacts", id?: string) {
  revalidatePath(path);
  if (id) revalidatePath(`${path}/${id}`);
}

export async function listClientsAction(
  filter?: Parameters<typeof ClientService.list>[1],
) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_VIEW, "clients");
    return { success: true, clients: await ClientService.list(user, filter) };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list clients" };
  }
}
export async function getClientAction(id: string) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_VIEW, "clients");
    return { success: true, client: await ClientService.get(user, id) };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load client" };
  }
}
export async function createClientAction(input: ClientInput) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_CREATE, "clients");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "CLIENT",
      "CREATE",
      { input },
      { entityLabel: input.name },
    );
    if (approval)
      return { success: true, pendingApproval: true, requestId: approval.id };
    const client = await ClientService.create(user, input);
    revalidatePath("/clients");
    return { success: true, client };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create client" };
  }
}
export async function updateClientAction(
  id: string,
  input: Partial<ClientInput>,
) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_UPDATE, "clients");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "CLIENT",
      "UPDATE",
      { id, input },
      { entityId: id, entityLabel: input.name },
    );
    if (approval)
      return { success: true, pendingApproval: true, requestId: approval.id };
    const client = await ClientService.update(user, id, input);
    revalidatePath("/clients");
    return { success: true, client };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update client" };
  }
}
export async function deleteClientAction(id: string) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_DELETE, "clients");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "CLIENT",
      "DELETE",
      { id },
      { entityId: id },
    );
    if (approval)
      return { success: true, pendingApproval: true, requestId: approval.id };
    await ClientService.delete(user, id);
    revalidatePath("/clients");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to archive client" };
  }
}

export async function listLeadsAction(
  filter?: Parameters<typeof LeadService.list>[1],
) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_VIEW, "leads");
    return { success: true, leads: await LeadService.list(user, filter) };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list leads" };
  }
}
export async function createLeadAction(input: LeadInput) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_CREATE, "leads");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "LEAD",
      "CREATE",
      { input },
      { entityLabel: input.name },
    );
    if (approval) {
      revalidateCrmList("/leads");
      return { success: true, pendingApproval: true, requestId: approval.id };
    }
    const lead = await LeadService.create(user, input);
    revalidateCrmList("/leads", lead.id);
    return { success: true, lead };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create lead" };
  }
}
export async function updateLeadAction(id: string, input: Partial<LeadInput>) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_UPDATE, "leads");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "LEAD",
      "UPDATE",
      { id, input },
      { entityId: id, entityLabel: input.name },
    );
    if (approval) {
      revalidateCrmList("/leads", id);
      return { success: true, pendingApproval: true, requestId: approval.id };
    }
    const lead = await LeadService.update(user, id, input);
    revalidateCrmList("/leads", id);
    return { success: true, lead };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update lead" };
  }
}
export async function deleteLeadAction(id: string) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_DELETE, "leads");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "LEAD",
      "DELETE",
      { id },
      { entityId: id },
    );
    if (approval) {
      revalidateCrmList("/leads", id);
      return { success: true, pendingApproval: true, requestId: approval.id };
    }
    const lead = await LeadService.delete(user, id);
    revalidateCrmList("/leads", id);
    return { success: true, lead };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete lead" };
  }
}

export async function listContactsAction(
  filter?: Parameters<typeof ContactService.list>[1],
) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_VIEW, "contacts");
    return { success: true, contacts: await ContactService.list(user, filter) };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list contacts" };
  }
}
export async function createContactAction(input: ContactInput) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_CREATE, "contacts");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "CONTACT",
      "CREATE",
      { input },
      { entityLabel: `${input.firstName} ${input.lastName || ""}`.trim() },
    );
    if (approval) {
      revalidateCrmList("/contacts");
      return { success: true, pendingApproval: true, requestId: approval.id };
    }
    const contact = await ContactService.create(user, input);
    revalidateCrmList("/contacts", contact.id);
    return { success: true, contact };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create contact" };
  }
}
export async function updateContactAction(
  id: string,
  input: Partial<ContactInput>,
) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_UPDATE, "contacts");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "CONTACT",
      "UPDATE",
      { id, input },
      { entityId: id, entityLabel: input.firstName },
    );
    if (approval) {
      revalidateCrmList("/contacts", id);
      return { success: true, pendingApproval: true, requestId: approval.id };
    }
    const contact = await ContactService.update(user, id, input);
    revalidateCrmList("/contacts", id);
    return {
      success: true,
      contact,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update contact" };
  }
}
export async function deleteContactAction(id: string) {
  try {
    const user = await requireAuth();
    allowed(user, PERMISSIONS.SCHOOLS_DELETE, "contacts");
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "CONTACT",
      "DELETE",
      { id },
      { entityId: id },
    );
    if (approval) {
      revalidateCrmList("/contacts", id);
      return { success: true, pendingApproval: true, requestId: approval.id };
    }
    const contact = await ContactService.delete(user, id);
    revalidateCrmList("/contacts", id);
    return { success: true, contact };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete contact" };
  }
}
