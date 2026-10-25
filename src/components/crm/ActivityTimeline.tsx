"use client";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { getAuditActionLabel } from "@/lib/i18n/auditLabels";
export function ActivityTimeline({
  events,
  empty,
}: {
  events: any[];
  empty?: string;
}) {
  const { language } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  if (!events.length)
    return (
      <div className="rounded border border-dashed p-6 text-sm text-slate-500">
        {empty || text("No activity yet.", "لا يوجد نشاط بعد.")}
      </div>
    );
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded border p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-sm">
              {getAuditActionLabel(event.action, language)}
            </span>
            <time className="text-xs text-slate-500">
              {formatDate(event.createdAt, language)}
            </time>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {event.actor?.name || text("System", "النظام")}
          </p>
          {event.metadata && !ar && (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {event.metadata}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
