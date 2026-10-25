"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  GitBranch,
  Layers3,
  Pencil,
  Plus,
  Power,
  Rows3,
  Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  createPipelineAction,
  createPipelineStageAction,
  updatePipelineAction,
  updatePipelineStageAction,
  deactivatePipelineStageAction,
} from "@/server/actions/sales";
import { formatNumber } from "@/lib/formatters";
import { Modal } from "@/components/ui/Modal";
import {
  StatusPill,
  SubmitWorkspaceButton,
  WorkspaceEmpty,
  WorkspaceHeader,
  WorkspaceNotice,
  WorkspaceStats,
  workspaceInput,
  workspaceSecondary,
} from "@/components/crm/WorkspaceUI";

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  type: string;
  isActive: boolean;
}

interface PipelineItem {
  id: string;
  name: string;
  isActive: boolean;
  isDefault?: boolean;
  stages: PipelineStage[];
  _count?: { deals: number };
}

export function PipelinesView({ pipelines }: { pipelines: PipelineItem[] }) {
  const { language, errorMessage } = useI18n();
  const router = useRouter();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ message: "", error: false });
  const [renameDialog, setRenameDialog] = useState<{
    kind: "pipeline" | "stage";
    id: string;
    name: string;
  } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const activePipelines = pipelines.filter((pipeline) => pipeline.isActive);
  const totalStages = pipelines.reduce(
    (total, pipeline) => total + pipeline.stages.length,
    0,
  );
  const totalDeals = pipelines.reduce(
    (total, pipeline) => total + (pipeline._count?.deals || 0),
    0,
  );

  function showError(error: unknown) {
    setNotice({ message: errorMessage(error as string), error: true });
  }

  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setNotice({ message: "", error: false });
    try {
      const result = await createPipelineAction({ name: name.trim() });
      if (!result.success) {
        showError(result.error);
        return;
      }
      setName("");
      setNotice({
        message: text("Pipeline created.", "تم إنشاء مسار المبيعات."),
        error: false,
      });
      router.refresh();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function addStage(id: string) {
    setNotice({ message: "", error: false });
    const result = await createPipelineStageAction(id, {
      name: text("New stage", "مرحلة جديدة"),
    });
    if (result.success) router.refresh();
    else showError(result.error);
  }

  async function renameStage(stage: PipelineStage) {
    setRenameDialog({ kind: "stage", id: stage.id, name: stage.name });
    setRenameName(stage.name);
  }

  async function renamePipeline(pipeline: PipelineItem) {
    setRenameDialog({ kind: "pipeline", id: pipeline.id, name: pipeline.name });
    setRenameName(pipeline.name);
  }

  async function saveRename(event: FormEvent) {
    event.preventDefault();
    if (!renameDialog || renameBusy) return;
    const next = renameName.trim();
    if (!next || next === renameDialog.name) {
      setRenameDialog(null);
      return;
    }
    setRenameBusy(true);
    const result = renameDialog.kind === "stage"
      ? await updatePipelineStageAction(renameDialog.id, { name: next })
      : await updatePipelineAction(renameDialog.id, { name: next });
    setRenameBusy(false);
    if (result.success) {
      setRenameDialog(null);
      router.refresh();
    } else {
      showError(result.error);
    }
  }

  async function togglePipeline(pipeline: PipelineItem) {
    const result = await updatePipelineAction(pipeline.id, {
      isActive: !pipeline.isActive,
    });
    if (result.success) router.refresh();
    else showError(result.error);
  }

  async function deactivateStage(stage: PipelineStage) {
    const result = await deactivatePipelineStageAction(stage.id);
    if (result.success) router.refresh();
    else showError(result.error);
  }

  async function activateStage(stage: PipelineStage) {
    const result = await updatePipelineStageAction(stage.id, { isActive: true });
    if (result.success) router.refresh();
    else showError(result.error);
  }

  const stageType = (value: string) =>
    ({
      OPEN: text("Open", "مفتوحة"),
      WON: text("Won", "ناجحة"),
      LOST: text("Lost", "غير ناجحة"),
    })[value] || value;

  const stageTone = (value: string) =>
    value === "WON" ? "green" : value === "LOST" ? "red" : "purple";

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <WorkspaceHeader
        icon={GitBranch}
        eyebrow={text("SALES, WITH A CLEAR NEXT STEP", "مبيعات بخطوات واضحة")}
        title={text("Sales pipelines", "مسارات المبيعات")}
        subtitle={text(
          "Configure the stages your team uses to move opportunities forward.",
          "خصص مسارات ومراحل المبيعات الخاصة بشركتك، وتابع انتقال الفرص بوضوح.",
        )}
      />

      <WorkspaceStats
        items={[
          {
            label: text("All pipelines", "إجمالي المسارات"),
            value: formatNumber(pipelines.length, language),
            icon: GitBranch,
          },
          {
            label: text("Active pipelines", "المسارات النشطة"),
            value: formatNumber(activePipelines.length, language),
            icon: CheckCircle2,
            tone: "green",
          },
          {
            label: text("Sales stages", "مراحل المبيعات"),
            value: formatNumber(totalStages, language),
            icon: Layers3,
            tone: "amber",
          },
          {
            label: text("Linked deals", "الصفقات المرتبطة"),
            value: formatNumber(totalDeals, language),
            icon: Users,
            tone: "burgundy",
          },
        ]}
      />

      <WorkspaceNotice {...notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                <Plus className="h-4 w-4" />
              </span>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {text("Create a pipeline", "إنشاء مسار مبيعات")}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {text(
                "Start with a clear path for your team's opportunities.",
                "ابدأ بمسار واضح لتنظيم فرص فريقك ومراحلها.",
              )}
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
            className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl"
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={text(
                "New pipeline name",
                "اسم مسار المبيعات الجديد",
              )}
              className={workspaceInput}
            />
            <SubmitWorkspaceButton
              busy={busy}
              label={text("Create pipeline", "إنشاء المسار")}
              saving={text("Creating...", "جارٍ الإنشاء...")}
            />
          </form>
        </div>
      </section>

      {pipelines.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <WorkspaceEmpty
            icon={GitBranch}
            title={text("No pipelines yet", "لا توجد مسارات مبيعات بعد")}
            description={text(
              "Create your first pipeline to give the team a shared sales process.",
              "أنشئ أول مسار مبيعات ليحصل الفريق على طريقة موحدة لمتابعة الفرص.",
            )}
          />
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pipelines.map((pipeline) => (
            <section
              key={pipeline.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                      <GitBranch className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-extrabold text-slate-900 dark:text-white">
                          {pipeline.name}
                        </h2>
                        {pipeline.isDefault && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            {text("Default", "افتراضي")}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusPill
                          label={pipeline.isActive ? text("Active", "نشط") : text("Inactive", "غير نشط")}
                          tone={pipeline.isActive ? "green" : "neutral"}
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatNumber(pipeline._count?.deals || 0, language)} {text("deals", "صفقة")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => void renamePipeline(pipeline)}
                      className={workspaceSecondary}
                    >
                      <Pencil className="h-4 w-4" />
                      {text("Edit", "تعديل")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void togglePipeline(pipeline)}
                      className={workspaceSecondary}
                    >
                      <Power className="h-4 w-4" />
                      {pipeline.isActive ? text("Deactivate", "تعطيل") : text("Activate", "تفعيل")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Rows3 className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {text("Pipeline stages", "مراحل المسار")}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatNumber(pipeline.stages.length, language)} {text("stages", "مراحل")}
                  </span>
                </div>

                {pipeline.stages.length > 0 ? (
                  <ol className="space-y-2">
                    {pipeline.stages.map((stage) => (
                      <li
                        key={stage.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-extrabold text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300">
                            {stage.order + 1}
                          </span>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-bold ${stage.isActive ? "text-slate-800 dark:text-slate-100" : "text-slate-400 line-through"}`}>
                              {stage.name}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <StatusPill label={stageType(stage.type)} tone={stageTone(stage.type) as "green" | "red" | "purple"} />
                              {!stage.isActive && (
                                <span className="text-[11px] text-slate-400">{text("Inactive", "غير نشطة")}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => void renameStage(stage)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {text("Rename", "إعادة التسمية")}
                          </button>
                          {stage.isActive ? (
                            <button
                              type="button"
                              onClick={() => void deactivateStage(stage)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                              <Power className="h-3.5 w-3.5" />
                              {text("Deactivate", "تعطيل")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void activateStage(stage)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {text("Activate", "تفعيل")}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {text("No stages added yet.", "لم تتم إضافة مراحل بعد.")}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void addStage(pipeline.id)}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-900/70 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-950/70"
                >
                  <Plus className="h-4 w-4" />
                  {text("Add stage", "إضافة مرحلة")}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(renameDialog)}
        onClose={() => {
          if (!renameBusy) setRenameDialog(null);
        }}
        title={text(
          renameDialog?.kind === "stage" ? "Rename stage" : "Rename pipeline",
          renameDialog?.kind === "stage" ? "إعادة تسمية المرحلة" : "إعادة تسمية المسار",
        )}
        description={text(
          "Use a clear name so the team can understand the sales process.",
          "استخدم اسماً واضحاً ليسهل على الفريق فهم مسار المبيعات.",
        )}
        maxWidth="md"
        closeLabel={text("Close", "إغلاق")}
      >
        <form onSubmit={saveRename} className="space-y-5" dir={ar ? "rtl" : "ltr"}>
          <label className="block">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {renameDialog?.kind === "stage" ? text("Stage name", "اسم المرحلة") : text("Pipeline name", "اسم المسار")}
            </span>
            <input
              autoFocus
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              className={`${workspaceInput} mt-2`}
              maxLength={120}
              required
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="submit"
              disabled={renameBusy || !renameName.trim()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {renameBusy ? text("Saving...", "جارٍ الحفظ...") : text("Save changes", "حفظ التعديل")}
            </button>
            <button
              type="button"
              disabled={renameBusy}
              onClick={() => setRenameDialog(null)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {text("Cancel", "إلغاء")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
