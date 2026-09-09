import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { NotificationService } from "@/server/services/NotificationService";
import prisma from "@/lib/db/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [notifications, schools, taskTypes, users, manager] = await Promise.all([
    hasPermission(user, PERMISSIONS.NOTIFICATIONS_VIEW) ? NotificationService.getUserNotifications(user.id, 10) : Promise.resolve([]),
    hasPermission(user, PERMISSIONS.SCHOOLS_VIEW) ? prisma.school.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }) : Promise.resolve([]),
    hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED) || hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL) ? prisma.taskType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }) : Promise.resolve([]),
    hasPermission(user, PERMISSIONS.CHAT_VIEW) || hasPermission(user, PERMISSIONS.MESSAGES_SEND) ? prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, reportsToUserId: true, department: { select: { name: true } } },
      orderBy: { name: "asc" },
    }) : Promise.resolve([]),
    user.reportsToUserId ? prisma.user.findUnique({ where: { id: user.reportsToUserId }, select: { id: true, name: true, isActive: true } }) : Promise.resolve(null),
  ]);

  return (
    <MobileLayout user={user} directManager={manager ?? null}>
      <div className="min-h-screen flex bg-background dark:bg-slate-950">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden lg:block shrink-0">
          <Sidebar user={user} schools={schools} taskTypes={taskTypes} users={users} directManager={manager ?? null} />
        </div>
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar user={user} notifications={notifications as any} />
          <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </MobileLayout>
  );
}