import { describe, expect, it } from "vitest";
import {
  assertPlatformResourceMutationAllowed,
  getPlatformResourceAccess,
} from "@/lib/platform/access";

describe("platform resource access", () => {
  it("keeps tenant-owned and historical records read-only", () => {
    for (const resource of ["users", "subscriptions", "integrations"] as const) {
      expect(getPlatformResourceAccess(resource)).toEqual({
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        mode: "read-only",
      });
    }
  });

  it("allows only the lifecycle operations owned by platform administration", () => {
    expect(getPlatformResourceAccess("organizations")).toMatchObject({
      canCreate: false,
      canUpdate: true,
      canDelete: false,
    });
    expect(getPlatformResourceAccess("plans")).toMatchObject({
      canCreate: true,
      canUpdate: true,
      canDelete: false,
    });
    expect(getPlatformResourceAccess("support")).toMatchObject({
      canCreate: false,
      canUpdate: true,
      canDelete: false,
    });
    expect(getPlatformResourceAccess("settings")).toMatchObject({
      canCreate: false,
      canUpdate: true,
      canDelete: false,
    });
  });

  it("makes monitoring and onboarding views read-only even when they reuse organization data", () => {
    expect(getPlatformResourceAccess("organizations", "signups").mode).toBe(
      "read-only",
    );
    expect(getPlatformResourceAccess("organizations", "analytics").canUpdate).toBe(
      false,
    );
  });

  it("rejects generic mutations for read-only or retained data", () => {
    expect(() =>
      assertPlatformResourceMutationAllowed("users", "update"),
    ).toThrow(/read-only/i);
    expect(() =>
      assertPlatformResourceMutationAllowed("subscriptions", "create"),
    ).toThrow(/read-only/i);
    expect(() =>
      assertPlatformResourceMutationAllowed("plans", "delete"),
    ).toThrow(/retained/i);
    expect(() =>
      assertPlatformResourceMutationAllowed("plans", "update"),
    ).not.toThrow();
  });
});
