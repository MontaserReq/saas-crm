import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { AiAssistantWidget } from "@/components/chat/AiAssistantWidget";
import { NotificationService } from "@/server/services/NotificationService";
import prisma from "@/lib/db/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { OnboardingService } from "@/server/services/OnboardingService";
import { navigationModulesForFeatures } from "@/lib/platform/entitlements";
import { PlanRouteGuard } from "@/components/layout/PlanRouteGuard";
import { TrialAccessBanner } from "@/components/settings/TrialAccessBanner";
import { getBrandThemeCss } from "@/lib/branding";
import { OrganizationIdentity } from "@/components/layout/OrganizationIdentity";
import { DashboardBreadcrumbs } from "@/components/layout/DashboardBreadcrumbs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  const setup = await OnboardingService.get(user);
  if (setup.state?.status === "PENDING" && setup.state.ownerId === user.id)
    redirect("/onboarding");
  const enabledModules =
    user.planFeatures === null || user.planFeatures === undefined
      ? setup.state?.status === "COMPLETE"
        ? setup.modules
        : undefined
      : navigationModulesForFeatures(user.planFeatures);

  const [notifications, schools, taskTypes, users, manager, organization] =
    await Promise.all([
      hasPermission(user, PERMISSIONS.NOTIFICATIONS_VIEW)
        ? NotificationService.getUserNotifications(user.id, 10)
        : Promise.resolve([]),
      hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)
        ? prisma.school.findMany({
            where: { isDeleted: false, organizationId: user.organizationId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED) ||
      hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)
        ? prisma.taskType.findMany({
            where: { isActive: true, organizationId: user.organizationId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      hasPermission(user, PERMISSIONS.CHAT_VIEW) ||
      hasPermission(user, PERMISSIONS.MESSAGES_SEND) ||
      hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)
        ? prisma.user.findMany({
            where: {
              isActive: true,
              organizationMemberships: {
                some: { organizationId: user.organizationId, status: "ACTIVE" },
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
              reportsToUserId: true,
              department: { select: { name: true } },
            },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      user.reportsToUserId
        ? prisma.user.findFirst({
            where: {
              id: user.reportsToUserId,
              organizationMemberships: {
                some: { organizationId: user.organizationId, status: "ACTIVE" },
              },
            },
            select: { id: true, name: true, isActive: true },
          })
        : Promise.resolve(null),
      prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: {
          name: true,
          primaryColor: true,
          logoKey: true,
          updatedAt: true,
        },
      }),
    ]);
  const organizationBrand = organization
    ? {
        name: organization.name,
        logoUrl: organization.logoKey
          ? `/api/organization/logo?v=${organization.updatedAt.getTime()}`
          : null,
      }
    : undefined;

  return (
    <>
      <style
        data-organization-brand
        dangerouslySetInnerHTML={{
          __html: getBrandThemeCss(organization?.primaryColor),
        }}
      />
      {organization?.name && <OrganizationIdentity name={organization.name} />}
      <MobileLayout
        user={user}
        users={users}
        directManager={manager ?? null}
        enabledModules={enabledModules}
        organizationBrand={organizationBrand}
      >
        <div className="min-h-screen flex bg-background dark:bg-slate-950">
          {/* Desktop Sidebar - hidden on mobile */}
          <div className="hidden lg:block shrink-0">
            <Sidebar
              user={user}
              schools={schools}
              taskTypes={taskTypes}
              users={users}
              directManager={manager ?? null}
              enabledModules={enabledModules}
              organizationBrand={organizationBrand}
            />
          </div>
          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Navbar user={user} notifications={notifications as any} />
            <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
              <DashboardBreadcrumbs />
              {user.role === "SUPER_ADMIN" && <TrialAccessBanner
                state={user.workspaceAccessState}
                endsAt={user.subscriptionEndsAt}
              />}
              <PlanRouteGuard
                features={user.planFeatures ?? null}
                bypassPlanGuard={user.isPlatformAdmin}
              >
                {children}
              </PlanRouteGuard>
            </main>
          </div>
        </div>
        {/* Always-accessible chat launcher — mounted once so it survives route
            changes and never requires opening the mobile nav drawer. */}
        {hasPermission(user, PERMISSIONS.CHAT_VIEW) && <ChatWidget currentUserId={user.id} />}
        {/* Read-only AI Knowledge Assistant — opposite corner from Live Chat. */}
        {hasPermission(user, PERMISSIONS.AI_ASSISTANT_VIEW) && (
          <AiAssistantWidget />
        )}
      </MobileLayout>
    </>
  );
}
