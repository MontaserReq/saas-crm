"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  TrendingUp,
  Trophy,
  CircleX,
  Columns3,
  List,
  Plus,
  Layers3,
  Pencil,
  Percent,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/formatters";
import { createDealAction, updateDealAction } from "@/server/actions/sales";
import {
  PipelineKanban,
  dealMoney,
  type BoardDeal,
  type BoardPipeline,
} from "./PipelineKanban";
import { Modal } from "@/components/ui/Modal";
import {
  WorkspaceHeader,
  WorkspaceStats,
  WorkspaceSearch,
  WorkspaceEmpty,
  WorkspaceNotice,
  StatusPill,
  SubmitWorkspaceButton,
  WorkspaceArrow,
  workspaceInput,
  workspaceSecondary,
  workspaceButton,
} from "@/components/crm/WorkspaceUI";

export function DealsView({
  deals,
  pipelines,
  members,
  initialSearch,
  canCreate = false,
  canUpdate = false,
  currentUserId,
  initialClient = null,
  openCreate = false,
}: {
  deals: BoardDeal[];
  pipelines: BoardPipeline[];
  members: Array<{ id: string; name: string }>;
  initialSearch: string;
  canCreate?: boolean;
  canUpdate?: boolean;
  currentUserId?: string;
  initialClient?: { id: string; name: string } | null;
  openCreate?: boolean;
}) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const router = useRouter();
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const activePipelines = pipelines.filter((pipeline) => pipeline.isActive);
  const defaultPipeline =
    activePipelines.find((pipeline) => pipeline.isDefault) ||
    activePipelines[0];
  const [pipelineId, setPipelineId] = useState(
    initialSearch ? "" : defaultPipeline?.id || "",
  );
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState("all");
  const [view, setView] = useState(initialSearch ? "table" : "board");
  const [open, setOpen] = useState(openCreate && canCreate);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ message: "", error: false });
  const [editingDeal, setEditingDeal] = useState<BoardDeal | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editDraft, setEditDraft] = useState({
    pipelineId: "",
    stageId: "",
    ownerId: "",
    value: "",
    probability: "",
    expectedCloseDate: "",
  });
  const firstStage = (pipeline?: BoardPipeline) =>
    pipeline?.stages
      .filter((stage) => stage.isActive)
      .sort((a, b) => a.order - b.order)
      .find((stage) => stage.type === "OPEN") ||
    pipeline?.stages.find((stage) => stage.isActive);
  const [draft, setDraft] = useState({
    title: "",
    value: "",
    pipelineId: defaultPipeline?.id || "",
    stageId: firstStage(defaultPipeline)?.id || "",
    ownerId:
      members.find((member) => member.id === currentUserId)?.id ||
      members[0]?.id ||
      "",
    expectedCloseDate: "",
    clientId: initialClient?.id || "",
  });
  const selected = activePipelines.find(
    (pipeline) => pipeline.id === pipelineId,
  );
  const formPipeline = activePipelines.find(
    (pipeline) => pipeline.id === draft.pipelineId,
  );
  const editPipeline = activePipelines.find(
    (pipeline) => pipeline.id === editDraft.pipelineId,
  );
  const shown = deals.filter(
    (deal) =>
      (!pipelineId || deal.pipelineId === pipelineId) &&
      (status === "all" || deal.status === status),
  );
  const canProvisionDeal =
    !!defaultPipeline && !!firstStage(defaultPipeline) && members.length > 0;
  const statuses: Record<string, string> = {
    OPEN: text("Open", "مفتوحة"),
    WON: text("Won", "ناجحة"),
    LOST: text("Lost", "غير ناجحة"),
  };
  function changeView(next: string) {
    setView(next);
    if (next === "board" && !pipelineId)
      setPipelineId(defaultPipeline?.id || "");
  }
  function add() {
    setNotice({ message: "", error: false });
    const pipeline = selected || defaultPipeline;
    setDraft((current) => ({
      ...current,
      pipelineId: pipeline?.id || "",
      stageId: firstStage(pipeline)?.id || "",
    }));
    setOpen(true);
  }

  function showError(error: unknown) {
    setNotice({ message: errorMessage(error as string), error: true });
  }

  function dateInputValue(value: string | Date | null | undefined) {
    if (!value) return "";
    if (typeof value === "string") return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
  }

  function edit(deal: BoardDeal) {
    setNotice({ message: "", error: false });
    setEditingDeal(deal);
    setEditDraft({
      pipelineId: deal.pipelineId,
      stageId: deal.stageId,
      ownerId: deal.owner?.id || currentUserId || members[0]?.id || "",
      value: deal.value === null || deal.value === undefined ? "" : String(deal.value),
      probability: deal.probability === null || deal.probability === undefined ? "" : String(deal.probability),
      expectedCloseDate: dateInputValue(deal.expectedCloseDate),
    });
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingDeal || editBusy) return;
    setEditBusy(true);
    setNotice({ message: "", error: false });
    try {
      const result = await updateDealAction(editingDeal.id, {
        pipelineId: editDraft.pipelineId,
        stageId: editDraft.stageId,
        ownerId: editDraft.ownerId,
        value: editDraft.value ? Number(editDraft.value) : null,
        probability: editDraft.probability ? Number(editDraft.probability) : null,
        expectedCloseDate: editDraft.expectedCloseDate || null,
      });
      if (!result.success) {
        showError(result.error);
        return;
      }
      setEditingDeal(null);
      setNotice({
        message: result.pendingApproval
          ? text("The deal update was sent for approval.", "تم إرسال تعديل الصفقة للموافقة.")
          : text("Deal updated successfully.", "تم تحديث الصفقة بنجاح."),
        error: false,
      });
      router.refresh();
    } catch (error) {
      showError(error);
    } finally {
      setEditBusy(false);
    }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice({ message: "", error: false });
    try {
      const result = await createDealAction({
        title: draft.title.trim(),
        pipelineId: draft.pipelineId,
        stageId: draft.stageId,
        ownerId: draft.ownerId,
        value: draft.value ? Number(draft.value) : undefined,
        expectedCloseDate: draft.expectedCloseDate || undefined,
        clientId: draft.clientId || undefined,
      });
      if (!result.success) {
        setNotice({
          message: text(
            "Could not add the deal. Check its stage and owner, then try again.",
            "تعذرت إضافة الصفقة. تحقق من المرحلة والمسؤول وحاول مجدداً.",
          ),
          error: true,
        });
        return;
      }
      if (result.pendingApproval) {
        setOpen(false);
        setNotice({ message: text("Deal request sent for approval.", "تم إرسال طلب الصفقة للموافقة."), error: false });
        return;
      }
      setDraft((current) => ({
        ...current,
        title: "",
        value: "",
        expectedCloseDate: "",
      }));
      setPipelineId(draft.pipelineId);
      setStatus("all");
      setOpen(false);
      setNotice({
        message: text("Deal added successfully.", "تمت إضافة الصفقة بنجاح."),
        error: false,
      });
      router.refresh();
    } catch {
      setNotice({
        message: text(
          "Connection interrupted. Check your deals before retrying.",
          "انقطع الاتصال. تحقق من قائمة الصفقات قبل إعادة المحاولة.",
        ),
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  function badge(deal: BoardDeal) {
    return (
      <StatusPill
        label={statuses[deal.status] || deal.status}
        tone={
          deal.status === "WON"
            ? "green"
            : deal.status === "LOST"
              ? "red"
              : "purple"
        }
      />
    );
  }
  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <WorkspaceHeader
        icon={BriefcaseBusiness}
        eyebrow={text("SALES, WITH A CLEAR NEXT STEP", "مبيعات بخطوات واضحة")}
        title={text("Deals", "الصفقات")}
        subtitle={text(
          "See every opportunity, from the first conversation to the final agreement.",
          "تابع كل فرصة من أول تواصل حتى الاتفاق، بخطوات واضحة لفريقك.",
        )}
        action={canCreate ? add : undefined}
        actionLabel={text("Add deal", "إضافة صفقة")}
      />
      <WorkspaceStats
        items={[
          {
            label: text(
              initialSearch ? "Deals in search" : "All deals",
              initialSearch ? "الصفقات في نتائج البحث" : "إجمالي الصفقات",
            ),
            value: formatNumber(deals.length, language),
            icon: BriefcaseBusiness,
          },
          {
            label: text("Open opportunities", "الفرص المفتوحة"),
            value: formatNumber(
              deals.filter((deal) => deal.status === "OPEN").length,
              language,
            ),
            icon: TrendingUp,
            tone: "purple",
          },
          {
            label: text("Won deals", "الصفقات الناجحة"),
            value: formatNumber(
              deals.filter((deal) => deal.status === "WON").length,
              language,
            ),
            icon: Trophy,
            tone: "green",
          },
          {
            label: text("Lost deals", "الصفقات غير الناجحة"),
            value: formatNumber(
              deals.filter((deal) => deal.status === "LOST").length,
              language,
            ),
            icon: CircleX,
            tone: "burgundy",
          },
        ]}
      />
      {!open && <WorkspaceNotice {...notice} />}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <form action="/deals" className="flex min-w-0 flex-1 gap-2">
              <WorkspaceSearch
                name="search"
                label={text("Search deals", "البحث عن الصفقات")}
                value={search}
                onChange={setSearch}
                placeholder={text(
                  "Find a deal or customer…",
                  "ابحث عن صفقة أو عميل…",
                )}
              />
              <button className={workspaceSecondary}>
                {text("Search", "بحث")}
              </button>
              {initialSearch && (
                <Link href="/deals" className={workspaceSecondary}>
                  {text("Clear", "مسح")}
                </Link>
              )}
            </form>
            <div
              role="group"
              aria-label={text("Display style", "طريقة العرض")}
              className="flex gap-1 self-start rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
            >
              {[
                {
                  id: "board",
                  Icon: Columns3,
                  label: text("Board", "لوحة المراحل"),
                },
                { id: "table", Icon: List, label: text("Table", "الجدول") },
              ].map(({ id, Icon, label }) => (
                <button
                  type="button"
                  aria-pressed={view === id}
                  key={id}
                  onClick={() => changeView(id)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${view === id ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200" : "text-slate-500 dark:text-slate-400"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <label className="sm:w-56">
                <span className="sr-only">
                  {text("Sales pipeline", "مسار المبيعات")}
                </span>
                <select
                  value={pipelineId}
                  onChange={(event) => setPipelineId(event.target.value)}
                  className={`${workspaceInput} !py-2.5`}
                >
                  {view === "table" && (
                    <option value="">
                      {text("All pipelines", "جميع المسارات")}
                    </option>
                  )}
                  {activePipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:w-40">
                <span className="sr-only">
                  {text("Deal status", "حالة الصفقة")}
                </span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={`${workspaceInput} !py-2.5`}
                >
                  <option value="all">
                    {text("All statuses", "جميع الحالات")}
                  </option>
                  {Object.entries(statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {formatNumber(shown.length, language)}{" "}
              {text("deals shown", "صفقة معروضة")}
            </p>
          </div>
        </div>
        {!activePipelines.length ? (
          <WorkspaceEmpty
            icon={Layers3}
            title={text(
              "Give your sales a starting point",
              "حدّد نقطة بداية لمبيعاتك",
            )}
            description={text(
              "An active sales pipeline is needed before adding a deal.",
              "تحتاج إلى مسار مبيعات نشط قبل إضافة الصفقات.",
            )}
            action={
              <Link href="/pipelines" className={workspaceSecondary}>
                {text("Sales pipelines", "مسارات المبيعات")}
              </Link>
            }
          />
        ) : view === "board" ? (
          <div className="p-4 sm:p-5">
            <PipelineKanban
              deals={shown}
              pipeline={selected}
              canMove={canUpdate}
            />
          </div>
        ) : !shown.length ? (
          <WorkspaceEmpty
            icon={BriefcaseBusiness}
            title={
              deals.length || initialSearch
                ? text("No matching deals", "لا توجد صفقات مطابقة")
                : text(
                    "Your next opportunity starts here",
                    "فرصتك القادمة تبدأ من هنا",
                  )
            }
            description={
              deals.length || initialSearch
                ? text(
                    "Try another search, pipeline, or status.",
                    "جرّب بحثاً آخر أو غيّر المسار أو الحالة.",
                  )
                : text(
                    "Add a deal and give your team a clear path to follow.",
                    "أضف صفقة وحدّد لفريقك خطوات واضحة لمتابعتها.",
                  )
            }
            action={
              canCreate ? (
                <button onClick={add} className={workspaceButton}>
                  <Plus className="h-4 w-4" />
                  {text("Add deal", "إضافة صفقة")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {shown.map((deal) => (
                <article
                  key={deal.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    {badge(deal)}
                    <span className="text-sm font-bold text-brand-700 dark:text-brand-300">
                      {dealMoney(deal, language)}
                    </span>
                  </div>
                  <Link
                    href={`/deals/${deal.id}`}
                    className="mt-3 flex items-center justify-between gap-2 font-bold text-slate-900 dark:text-white"
                  >
                    <span className="min-w-0 break-words">{deal.title}</span>
                    <WorkspaceArrow />
                  </Link>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {deal.client?.name ||
                      text("Customer not linked", "لم يُربط بعميل")}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span>{deal.stage?.name || "—"}</span>
                    <span>{deal.owner?.name || "—"}</span>
                    <button
                      type="button"
                      onClick={() => edit(deal)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 font-bold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {text("Edit", "تعديل")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-xs text-slate-500 dark:text-slate-400 dark:bg-slate-800/40">
                  <tr>
                    {[
                      text("Deal", "الصفقة"),
                      text("Value", "القيمة"),
                      text("Stage", "المرحلة"),
                      text("Status", "الحالة"),
                      text("Owner", "المسؤول"),
                      text("Actions", "الإجراءات"),
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-5 py-3.5 text-start font-semibold"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {shown.map((deal) => (
                    <tr
                      key={deal.id}
                      className="transition hover:bg-brand-50/30 dark:hover:bg-brand-950/20"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="font-semibold text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                        >
                          {deal.title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {deal.client?.name ||
                            text("Customer not linked", "لم يُربط بعميل")}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                        {dealMoney(deal, language)}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <p className="font-semibold text-slate-600 dark:text-slate-300">
                          {deal.stage?.name || "—"}
                        </p>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          {deal.pipeline?.name}
                        </p>
                      </td>
                      <td className="px-5 py-4">{badge(deal)}</td>
                      <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {deal.owner?.name || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => edit(deal)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100 dark:border-brand-900/70 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-950/70"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {text("Edit", "تعديل")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={text("Add a new deal", "إضافة صفقة جديدة")}
        description={text(
          "Choose the opportunity, its next stage, and who will follow up.",
          "حدّد الفرصة ومرحلتها والمسؤول عن متابعتها.",
        )}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="lg"
      >
        {!canProvisionDeal ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {text(
                "Add an active pipeline with a stage and an active teammate first.",
                "أضف مساراً نشطاً يحتوي على مرحلة، وتأكد من وجود عضو نشط في الفريق أولاً.",
              )}
            </p>
            <Link href="/pipelines" className={workspaceSecondary}>
              {text("Open pipelines", "فتح مسارات المبيعات")}
            </Link>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-5">
            <fieldset disabled={busy} className="space-y-4">
              <label className="block text-sm font-semibold">
                {text("Deal title", "عنوان الصفقة")}
                <input
                  required
                  maxLength={180}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  className={`${workspaceInput} mt-2`}
                  placeholder={text(
                    "e.g. Annual service agreement",
                    "مثال: اتفاقية خدمات سنوية",
                  )}
                />
              </label>
              {initialClient && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm dark:border-brand-900 dark:bg-brand-950/30">
                  <span className="text-slate-500 dark:text-slate-400">
                    {text("Linked customer", "العميل المرتبط")}: {" "}
                  </span>
                  <Link
                    href={`/clients/${initialClient.id}`}
                    className="font-bold text-brand-700 dark:text-brand-300"
                  >
                    {initialClient.name}
                  </Link>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  {text("Sales pipeline", "مسار المبيعات")}
                  <select
                    required
                    value={draft.pipelineId}
                    onChange={(event) => {
                      const pipeline = activePipelines.find(
                        (item) => item.id === event.target.value,
                      );
                      setDraft({
                        ...draft,
                        pipelineId: event.target.value,
                        stageId: firstStage(pipeline)?.id || "",
                      });
                    }}
                    className={`${workspaceInput} mt-2`}
                  >
                    {activePipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  {text("Starting stage", "مرحلة البداية")}
                  <select
                    required
                    value={draft.stageId}
                    onChange={(event) =>
                      setDraft({ ...draft, stageId: event.target.value })
                    }
                    className={`${workspaceInput} mt-2`}
                  >
                    {formPipeline?.stages
                      .filter((stage) => stage.isActive)
                      .map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  {text("Value (optional)", "القيمة (اختياري)")}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.value}
                    onChange={(event) =>
                      setDraft({ ...draft, value: event.target.value })
                    }
                    className={`${workspaceInput} mt-2`}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  {text(
                    "Expected close (optional)",
                    "الإغلاق المتوقع (اختياري)",
                  )}
                  <input
                    type="date"
                    value={draft.expectedCloseDate}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        expectedCloseDate: event.target.value,
                      })
                    }
                    className={`${workspaceInput} mt-2`}
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold">
                {text("Deal owner", "المسؤول عن الصفقة")}
                <select
                  required
                  value={draft.ownerId}
                  onChange={(event) =>
                    setDraft({ ...draft, ownerId: event.target.value })
                  }
                  className={`${workspaceInput} mt-2`}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <WorkspaceNotice {...notice} />
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className={workspaceSecondary}
              >
                {text("Cancel", "إلغاء")}
              </button>
              <SubmitWorkspaceButton
                busy={busy}
                label={text("Save deal", "حفظ الصفقة")}
                saving={text("Saving…", "جارٍ الحفظ…")}
              />
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(editingDeal)}
        onClose={() => {
          if (!editBusy) setEditingDeal(null);
        }}
        title={text("Edit deal", "تعديل الصفقة")}
        description={text(
          "Update the stage, owner, value, and follow-up details from the table.",
          "عدّل المرحلة والمسؤول والقيمة وتفاصيل المتابعة من الجدول.",
        )}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="lg"
      >
        <form onSubmit={saveEdit} className="space-y-5" dir={ar ? "rtl" : "ltr"}>
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3 dark:border-brand-900/60 dark:bg-brand-950/30">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
              {text("Deal", "الصفقة")}
            </p>
            <p className="mt-1 font-bold text-slate-900 dark:text-white">
              {editingDeal?.title}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              {text("Sales pipeline", "مسار المبيعات")}
              <select
                required
                disabled={editBusy}
                value={editDraft.pipelineId}
                onChange={(event) => {
                  const pipeline = activePipelines.find((item) => item.id === event.target.value);
                  const selectedStage = pipeline?.stages
                    .filter((stage) => stage.isActive)
                    .sort((a, b) => a.order - b.order)[0];
                  setEditDraft({
                    ...editDraft,
                    pipelineId: event.target.value,
                    stageId: selectedStage?.id || "",
                  });
                }}
                className={`${workspaceInput} mt-2`}
              >
                {activePipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {text("Stage", "المرحلة")}
              <select
                required
                disabled={editBusy}
                value={editDraft.stageId}
                onChange={(event) => setEditDraft({ ...editDraft, stageId: event.target.value })}
                className={`${workspaceInput} mt-2`}
              >
                {editPipeline?.stages
                  .filter((stage) => stage.isActive || stage.id === editDraft.stageId)
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                {text("The status follows the selected stage.", "الحالة تتحدد تلقائياً حسب المرحلة المختارة.")}
              </span>
            </label>
            <label className="block text-sm font-semibold">
              {text("Deal owner", "المسؤول عن الصفقة")}
              <select
                required
                disabled={editBusy}
                value={editDraft.ownerId}
                onChange={(event) => setEditDraft({ ...editDraft, ownerId: event.target.value })}
                className={`${workspaceInput} mt-2`}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {text("Value", "القيمة")}
              <span className="relative mt-2 block">
                <CircleDollarSign className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={editBusy}
                  value={editDraft.value}
                  onChange={(event) => setEditDraft({ ...editDraft, value: event.target.value })}
                  className={`${workspaceInput} !ps-9`}
                />
              </span>
            </label>
            <label className="block text-sm font-semibold">
              {text("Probability", "الاحتمالية")}
              <span className="relative mt-2 block">
                <Percent className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  disabled={editBusy}
                  value={editDraft.probability}
                  onChange={(event) => setEditDraft({ ...editDraft, probability: event.target.value })}
                  className={`${workspaceInput} !ps-9`}
                />
              </span>
            </label>
            <label className="block text-sm font-semibold">
              {text("Expected close", "الإغلاق المتوقع")}
              <span className="relative mt-2 block">
                <CalendarDays className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  disabled={editBusy}
                  value={editDraft.expectedCloseDate}
                  onChange={(event) => setEditDraft({ ...editDraft, expectedCloseDate: event.target.value })}
                  className={`${workspaceInput} !ps-9`}
                />
              </span>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={editBusy}
              onClick={() => setEditingDeal(null)}
              className={workspaceSecondary}
            >
              {text("Cancel", "إلغاء")}
            </button>
            <button
              type="submit"
              disabled={editBusy || !editDraft.stageId || !editDraft.ownerId}
              className={`${workspaceButton} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <UserRound className="h-4 w-4" />
              {editBusy ? text("Saving…", "جارٍ الحفظ…") : text("Save changes", "حفظ التعديلات")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
