import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { CalendarService } from "@/server/services/CalendarService";
import { CalendarClientView } from "@/components/calendar/CalendarClientView";
import prisma from "@/lib/db/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasPlanFeature } from "@/lib/platform/entitlements";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; create?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (
    !hasPlanFeature(user, "calendar") ||
    !hasPermission(user, PERMISSIONS.CALENDAR_VIEW)
  )
    return null;
  const params = await searchParams;

  const [events, schools, clients, tickets, users, initialClient] = await Promise.all([
    CalendarService.getCalendarEvents(user),
    prisma.school.findMany({
      where: { isDeleted: false, organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.ticket.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, ticketNumber: true, subject: true },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        organizationMemberships: {
          some: { organizationId: user.organizationId, status: "ACTIVE" },
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    params.clientId
      ? prisma.client.findFirst({
          where: { id: params.clientId, organizationId: user.organizationId!, deletedAt: null },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <CalendarClientView
      events={events}
      schools={schools}
      clients={clients}
      tickets={tickets}
      users={users}
      initialClientId={initialClient?.id || ""}
      openCreate={params.create === "1" && !!initialClient && hasPermission(user, PERMISSIONS.CALENDAR_CREATE)}
    />
  );
}
