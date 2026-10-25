"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  GripVertical,
  Layers3,
  UserRound,
} from "lucide-react";
import { updateDealAction } from "@/server/actions/sales";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/formatters";
import { WorkspaceNotice, workspaceInput } from "@/components/crm/WorkspaceUI";

export type BoardDeal = {
  id: string;
  title: string;
  pipelineId: string;
  stageId: string;
  status: string;
  value?: string | number | null;
  currency: string;
  probability?: number | null;
  expectedCloseDate?: string | Date | null;
  client?: { name: string } | null;
  pipeline?: { name: string } | null;
  stage?: { name: string; type: string } | null;
  owner?: { id: string; name: string } | null;
};
export type BoardPipeline = {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  stages: Array<{
    id: string;
    name: string;
    isActive: boolean;
    type: string;
    order: number;
    probability: number;
  }>;
};
export function dealMoney(deal: BoardDeal, language: "en" | "ar") {
  if (deal.value === null || deal.value === undefined || deal.value === "")
    return "—";
  const value = Number(deal.value);
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(language === "ar" ? "ar-JO" : "en-US", {
      style: "currency",
      currency: deal.currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${formatNumber(value, language)} ${deal.currency}`;
  }
}
export function PipelineKanban({
  deals,
  pipeline,
  canMove = false,
}: {
  deals: BoardDeal[];
  pipeline?: BoardPipeline;
  canMove?: boolean;
}) {
  const { language } = useI18n();
  const ar = language === "ar";
  const router = useRouter();
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [busyId, setBusyId] = useState("");
  const [overStage, setOverStage] = useState("");
  const [error, setError] = useState("");
  const [moved, setMoved] = useState<Record<string, string>>({});
  if (!pipeline)
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700">
        {text(
          "Select an active sales pipeline to see its stages.",
          "اختر مسار مبيعات نشطاً لعرض مراحله.",
        )}
      </div>
    );
  const stages = pipeline.stages
    .filter((stage) => stage.isActive)
    .sort((a, b) => a.order - b.order);
  const stageOf = (deal: BoardDeal) => moved[deal.id] || deal.stageId;
  async function move(dealId: string, stageId: string) {
    if (!canMove || busyId) return;
    const deal = deals.find((item) => item.id === dealId);
    if (!deal || stageOf(deal) === stageId) return;
    setBusyId(dealId);
    setError("");
    setOverStage("");
    try {
      const result = await updateDealAction(dealId, { stageId });
      if (!result.success) {
        setError(
          text(
            "Could not move this deal. Try again.",
            "تعذر نقل الصفقة. حاول مجدداً.",
          ),
        );
        return;
      }
      setMoved((current) => ({ ...current, [dealId]: stageId }));
      router.refresh();
    } catch {
      setError(
        text(
          "Check your connection and try again.",
          "تحقق من الاتصال وحاول مجدداً.",
        ),
      );
    } finally {
      setBusyId("");
    }
  }
  // Keep RTL stage overflow inside the board rather than enlarging the document.
  return (
    <div className="min-w-0 space-y-3">
      <WorkspaceNotice message={error} error />
      <div
        className="flex w-full min-w-0 max-w-full gap-4 overflow-x-auto overscroll-x-contain pb-4 [contain:layout_paint]"
        aria-label={text("Deals by sales stage", "الصفقات حسب مرحلة البيع")}
      >
        {stages.map((stage) => {
          const items = deals.filter(
            (deal) =>
              deal.pipelineId === pipeline.id && stageOf(deal) === stage.id,
          );
          const tone =
            stage.type === "WON"
              ? "bg-emerald-500"
              : stage.type === "LOST"
                ? "bg-rose-400"
                : "bg-brand-500";
          return (
            <section
              key={stage.id}
              className={`w-[275px] min-w-[min(275px,78vw)] shrink-0 overflow-hidden rounded-2xl border transition-colors sm:w-[290px] ${overStage === stage.id ? "border-brand-400 bg-brand-50 dark:bg-brand-950/40" : "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40"}`}
              onDragOver={(event) => {
                if (
                  canMove &&
                  event.dataTransfer.types.includes(
                    "application/x-codeline-deal",
                  )
                ) {
                  event.preventDefault();
                  setOverStage(stage.id);
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setOverStage("");
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData(
                  "application/x-codeline-deal",
                );
                if (id && canMove) void move(id, stage.id);
              }}
            >
              <div className={`h-1 ${tone}`} />
              <div className="flex items-center justify-between gap-2 p-4">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                  <span className={`h-2 w-2 rounded-full ${tone}`} />
                  {stage.name}
                </h2>
                <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                  {formatNumber(items.length, language)}
                </span>
              </div>
              <div className="min-h-48 space-y-3 px-3 pb-4">
                {!items.length && (
                  <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center dark:border-slate-700">
                    <Layers3 className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {text("No deals here yet", "لا توجد صفقات هنا بعد")}
                    </p>
                  </div>
                )}
                {items.map((deal) => (
                  <article
                    key={deal.id}
                    draggable={canMove && !busyId}
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/x-codeline-deal",
                        deal.id,
                      )
                    }
                    onDragEnd={() => setOverStage("")}
                    aria-busy={busyId === deal.id}
                    className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md hover:shadow-brand-950/5 dark:border-slate-700 dark:bg-slate-900 ${canMove ? "cursor-grab active:cursor-grabbing" : ""} ${busyId === deal.id ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/deals/${deal.id}`}
                        draggable={false}
                        className="min-w-0 break-words text-sm font-bold leading-6 text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                      >
                        {deal.title}
                      </Link>
                      {canMove && (
                        <GripVertical
                          aria-hidden="true"
                          className="mt-1 h-4 w-4 shrink-0 text-slate-300"
                        />
                      )}
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {deal.client?.name ||
                          text("Customer not linked", "لم يُربط بعميل")}
                      </span>
                    </p>
                    <p className="mt-4 text-lg font-extrabold tracking-tight text-brand-800 dark:text-brand-200">
                      {dealMoney(deal, language)}
                    </p>
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <UserRound className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {deal.owner?.name || "—"}
                          </span>
                        </span>
                        {deal.expectedCloseDate && (
                          <span className="flex shrink-0 items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(
                              deal.expectedCloseDate,
                            ).toLocaleDateString(ar ? "ar-JO" : "en-US", {
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            })}
                          </span>
                        )}
                      </div>
                      {canMove && (
                        <label className="block">
                          <span className="sr-only">
                            {text("Move deal", "نقل الصفقة")}: {deal.title}
                          </span>
                          <select
                            aria-label={`${text("Move deal", "نقل الصفقة")}: ${deal.title}`}
                            value={stageOf(deal)}
                            disabled={!!busyId}
                            onChange={(event) =>
                              void move(deal.id, event.target.value)
                            }
                            className={`${workspaceInput} !py-2 !text-xs`}
                          >
                            {stages.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {canMove && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {text(
            "Drag a card or use its stage selector to move a deal.",
            "اسحب البطاقة أو اختر المرحلة داخلها لنقل الصفقة.",
          )}
        </p>
      )}
    </div>
  );
}
