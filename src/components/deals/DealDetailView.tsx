"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ChevronDown,
  GitBranch,
  Handshake,
  ListTodo,
  Target,
  UserRound,
  UsersRound,
} from "lucide-react";
import { deleteDealAction, updateDealAction } from "@/server/actions/sales";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { useDialog } from "@/lib/dialog/context";
import { useI18n } from "@/lib/i18n/context";

function DetailRow({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p dir={dir} className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
          {value}
        </p>
      </div>
    </div>
  );
}

export function DealDetailView({
  deal,
  timeline,
  canUpdate = false,
  canDelete = false,
}: {
  deal: any;
  timeline: any[];
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const stageOptions = (deal.pipeline?.stages || [])
    .filter((stage: any) => stage.isActive && stage.id !== deal.stageId)
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const [targetStageId, setTargetStageId] = useState(stageOptions[0]?.id || "");
  const [moveBusy, setMoveBusy] = useState(false);
  const router = useRouter();
  const { confirm } = useDialog();
  const { language, getStatusLabel, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const DirectionArrow = ar ? ArrowLeft : ArrowRight;
  const statusLabel = getStatusLabel(deal.status);
  const contactName = deal.primaryContact
    ? `${deal.primaryContact.firstName || ""} ${deal.primaryContact.lastName || ""}`.trim()
    : "—";
  const ownerName = deal.owner?.name || "—";
  const value = deal.value
    ? `${deal.value} ${deal.currency || ""}`.trim()
    : "—";

  const moveDeal = async () => {
    if (!targetStageId || moveBusy) return;
    setMoveBusy(true);
    const result = await updateDealAction(deal.id, { stageId: targetStageId });
    setMoveBusy(false);

    if (result.success && !result.pendingApproval) router.refresh();
    else if (result.success)
      alert(
        text(
          "The stage change was sent for approval.",
          "تم إرسال تغيير المرحلة للموافقة.",
        ),
      );
    else alert(errorMessage(result.error));
  };

  const remove = async () => {
    if (
      !(await confirm({
        title: text("Archive deal", "أرشفة الصفقة"),
        message: text(`Archive ${deal.title}?`, `هل تريد أرشفة ${deal.title}؟`),
        isDestructive: true,
      }))
    )
      return;
    const result = await deleteDealAction(deal.id);
    if (result.success && !result.pendingApproval) router.push("/deals");
    else if (result.success)
      alert(
        text(
          "Deal archive request sent for approval.",
          "تم إرسال طلب أرشفة الصفقة للموافقة.",
        ),
      );
    else alert(errorMessage(result.error));
  };

  const cardClass =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none";

  return (
    <main dir={ar ? "rtl" : "ltr"} className="space-y-5 pb-8">
      <header className="relative overflow-hidden rounded-[26px] border border-slate-800 bg-slate-950 text-white shadow-xl shadow-slate-900/10">
        <div className="pointer-events-none absolute -end-24 -top-28 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -start-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-brand-200 sm:flex">
              <BriefcaseBusiness className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                <span>{text("Deal", "صفقة")}</span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium tracking-normal text-emerald-200">
                  {statusLabel}
                </span>
              </div>
              <h1 className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {deal.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-brand-300" />
                  {deal.client?.name || text("No customer", "لا يوجد عميل")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4 text-brand-300" />
                  {deal.pipeline?.name || text("No pipeline", "لا يوجد مسار")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            {canUpdate && stageOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <span className="sr-only">
                    {text("Destination stage", "المرحلة المستهدفة")}
                  </span>
                  <select
                    value={targetStageId}
                    onChange={(event) => setTargetStageId(event.target.value)}
                    disabled={moveBusy}
                    className="min-h-10 appearance-none rounded-xl border border-white/15 bg-white/10 px-3 pe-9 text-sm font-bold text-white outline-none transition hover:bg-white/15 focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {stageOptions.map((stage: any) => (
                      <option
                        key={stage.id}
                        value={stage.id}
                        className="bg-slate-900 text-white"
                      >
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                </label>
                <button
                  type="button"
                  onClick={moveDeal}
                  disabled={moveBusy || !targetStageId}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-950/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <DirectionArrow className="h-4 w-4" />
                  {moveBusy
                    ? text("Moving…", "جارٍ النقل…")
                    : text("Move", "نقل")}
                </button>
              </div>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={remove}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
              >
                <Archive className="h-4 w-4" />
                {text("Archive", "أرشفة")}
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: text("Deal value", "قيمة الصفقة"),
            value,
            icon: CircleDollarSign,
            tone: "text-brand-600 bg-brand-50 dark:bg-brand-950/40",
          },
          {
            label: text("Probability", "الاحتمالية"),
            value: `${deal.probability ?? 0}%`,
            icon: Target,
            tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
          },
          {
            label: text("Current stage", "المرحلة الحالية"),
            value: deal.stage?.name || "—",
            icon: CheckCircle2,
            tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
          },
          {
            label: text("Tasks", "المهام"),
            value: String(deal.tasks?.length || 0),
            icon: ListTodo,
            tone: "text-violet-600 bg-violet-50 dark:bg-violet-950/30",
          },
        ].map(({ label, value: statValue, icon: Icon, tone }) => (
          <div key={label} className={cardClass + " flex items-center gap-3 p-4"}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 truncate text-lg font-bold text-slate-950 dark:text-white">{statValue}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className={cardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
                {text("Overview", "نظرة عامة")}
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                {text("Deal details", "بيانات الصفقة")}
              </h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
              <Handshake className="h-5 w-5" />
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow icon={Building2} label={text("Customer", "العميل")} value={deal.client?.name || "—"} />
            <DetailRow icon={UserRound} label={text("Contact", "جهة الاتصال")} value={contactName} />
            <DetailRow icon={GitBranch} label={text("Sales pipeline", "مسار المبيعات")} value={deal.pipeline?.name || "—"} />
            <DetailRow icon={CheckCircle2} label={text("Stage", "المرحلة")} value={deal.stage?.name || "—"} />
            <DetailRow icon={UserRound} label={text("Owner", "المسؤول")} value={ownerName} />
            <DetailRow icon={UsersRound} label={text("Team", "الفريق")} value={deal.team?.name || "—"} />
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
                {text("History", "المتابعة")}
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                {text("Activities and stage history", "النشاطات وسجل المراحل")}
              </h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
              <Activity className="h-5 w-5" />
            </span>
          </div>
          <ActivityTimeline
            events={timeline}
            empty={text("No activity recorded for this deal yet.", "لا توجد نشاطات مسجلة لهذه الصفقة بعد.")}
          />
        </section>
      </div>
    </main>
  );
}
