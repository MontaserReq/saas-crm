import type { PlatformResource, PlatformSection } from "./types";

export type PlatformResourceAccess = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  mode: "read-only" | "limited" | "catalog";
};

/**
 * Platform data does not all have the same lifecycle.  This table is the
 * single source of truth for the generic Platform Admin screens and actions.
 * Historical, tenant-owned and workflow-owned records intentionally remain
 * view-only here.
 */
const resourceAccess: Record<PlatformResource, PlatformResourceAccess> = {
  organizations: {
    canCreate: false,
    canUpdate: true,
    canDelete: false,
    mode: "limited",
  },
  users: {
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    mode: "read-only",
  },
  plans: {
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    mode: "catalog",
  },
  subscriptions: {
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    mode: "read-only",
  },
  integrations: {
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    mode: "read-only",
  },
  support: {
    canCreate: false,
    canUpdate: true,
    canDelete: false,
    mode: "limited",
  },
  settings: {
    canCreate: false,
    canUpdate: true,
    canDelete: false,
    mode: "limited",
  },
};

const readOnlySections = new Set<PlatformSection>([
  "signups",
  "health",
  "analytics",
]);

export function getPlatformResourceAccess(
  resource: PlatformResource,
  section?: PlatformSection,
): PlatformResourceAccess {
  if (section && readOnlySections.has(section)) {
    return {
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      mode: "read-only",
    };
  }
  return resourceAccess[resource];
}

export function assertPlatformResourceMutationAllowed(
  resource: PlatformResource,
  operation: "create" | "update" | "delete",
) {
  const access = getPlatformResourceAccess(resource);
  const allowed =
    operation === "create"
      ? access.canCreate
      : operation === "update"
        ? access.canUpdate
        : access.canDelete;
  if (!allowed) {
    throw new Error(
      operation === "delete"
        ? "This record is retained for history and cannot be deleted"
        : "This data is read-only here. Use its owning workflow to change it",
    );
  }
}
