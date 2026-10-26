"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/context";
import type {
  ColumnMapping,
  ImportDestination,
} from "@/lib/imports/smartImport";

type Analysis = {
  importId: string;
  filename: string;
  sheetNames: string[];
  selectedSheet: string;
  rowCount: number;
  headers: string[];
  detection: {
    destination: ImportDestination | null;
    ambiguous: boolean;
    explanation: string;
    scores: Record<ImportDestination, number>;
  };
  limits?: { maxRows: number; maxFileBytes: number; maxColumns?: number; maxCells?: number };
  destination: ImportDestination | null;
  fields: Record<
    ImportDestination,
    Array<{
      key: string;
      label: string;
      labelAr: string;
      type: string;
      required?: boolean;
      matchable?: boolean;
    }>
  >;
  customFields: Record<
    ImportDestination,
    Array<{ key: string; label: string; fieldType: string; required: boolean }>
  >;
  suggestions: Record<
    ImportDestination,
    Array<{
      source: string;
      inferredType: string;
      samples: string[];
      suggestedField: string | null;
      confidence: number;
      explanation: string;
    }>
  >;
  canCreateCustomFields: boolean;
};
type Preview = {
  summary: {
    total: number;
    create: number;
    update: number;
    skip: number;
    reject: number;
    existingMatches: number;
    duplicateRows: number;
    ignoredColumns: string[];
    proposedCustomFields: Array<{
      key: string;
      label: string;
      fieldType: string;
      required: boolean;
      searchable: boolean;
    }>;
  };
  rows: Array<{
    row: number;
    values: Record<string, unknown>;
    issues: string[];
    duplicate: boolean;
    action: string;
  }>;
};
type HistoryItem = {
  id: string;
  destination: string | null;
  originalFilename: string;
  sheetName: string;
  status: string;
  mode: string;
  totalRows: number;
  processedRows: number;
  importedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  createdAt: string;
  completedAt: string | null;
  initiatedBy: { name: string };
};

const destinations: ImportDestination[] = [
  "CLIENT",
  "LEAD",
  "CONTACT",
  "DEAL",
  "TASK",
];
const customTypes = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "CURRENCY",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "EMAIL",
  "PHONE",
  "URL",
  "SELECT",
  "MULTI_SELECT",
];

function formatMegabytes(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return Number.isInteger(megabytes) ? String(megabytes) : megabytes.toFixed(1);
}

export function SmartImportWizard({ history, limits }: { history: HistoryItem[]; limits: { maxRows: number; maxFileBytes: number } }) {
  const { language, direction, errorMessage } = useI18n();
  const ar = language === "ar";
  const copy = ar
    ? {
        title: "الاستيراد الذكي للبيانات",
        subtitle: "ارفع Excel أو CSV، راجع المطابقة، ثم أكّد قبل حفظ أي سجل.",
        upload: "اختر ملفاً",
        drop: "",
        destination: "الوحدة المستهدفة",
        recommend: "اقتراح النظام",
        sheet: "ورقة العمل",
        mapping: "مطابقة الأعمدة",
        preview: "المعاينة والتحقق",
        confirm: "تأكيد الاستيراد",
        history: "سجل الاستيراد",
        ignore: "تجاهل العمود",
        newCustom: "إنشاء حقل مخصص جديد",
        existingCustom: "حقل مخصص",
        required: "مطلوب",
        searchable: "قابل للبحث",
        type: "النوع",
        samples: "قيم نموذجية",
        confidence: "سبب الاقتراح",
        mode: "طريقة معالجة التكرار",
        match: "حقل المطابقة",
        create: "إنشاء سجلات جديدة",
        skip: "تخطي المكرر",
        update: "تحديث الموجود فقط",
        upsert: "إنشاء أو تحديث",
        runPreview: "فحص ومعاينة",
        back: "رجوع",
        rows: "صف",
        unmapped: "أعمدة غير مستخدمة",
        createCount: "سيتم إنشاؤها",
        updateCount: "سيتم تحديثها",
        skipCount: "سيتم تخطيها",
        rejectCount: "مرفوضة",
        issues: "المشكلات",
        action: "الإجراء",
        done: "اكتمل الاستيراد",
        startOver: "استيراد ملف آخر",
        noHistory: "لا توجد عمليات استيراد بعد.",
        download: "تنزيل تقرير الأخطاء",
        ambiguous: "لم نتمكن من تحديد الوحدة بثقة. اختر الوحدة المناسبة.",
        customNotice:
          "لن يُحذف أي عمود دون علمك. اختر تجاهل أو حقل موجود أو حقل مخصص.",
        processing: "جارٍ المعالجة…",
        file: "الملف",
        status: "الحالة",
        result: "النتيجة",
        date: "التاريخ",
        actions: "الإجراءات",
        details: "التفاصيل",
        created: "أُنشئت",
        updated: "حُدّثت",
        skipped: "تخطّيت",
        failed: "أخطاء",
        processed: "تمت معالجة",
        viewImportDetails: "تفاصيل عملية الاستيراد",
        noEditDelete: "عمليات الاستيراد المكتملة غير قابلة للتعديل أو الحذف للحفاظ على سجل التدقيق.",
        fieldName: "اسم الحقل",
        options: "الخيارات (مفصولة بفواصل)",
      }
    : {
        title: "Smart data import",
        subtitle:
          "Upload Excel or CSV, review every mapping, then confirm before any records are written.",
        upload: "Choose a file",
        drop: "",
        destination: "Destination module",
        recommend: "System recommendation",
        sheet: "Worksheet",
        mapping: "Column mapping",
        preview: "Preview & validation",
        confirm: "Confirm import",
        history: "Import history",
        ignore: "Ignore column",
        newCustom: "Create a new custom field",
        existingCustom: "Custom field",
        required: "Required",
        searchable: "Searchable",
        type: "Type",
        samples: "Sample values",
        confidence: "Match explanation",
        mode: "Duplicate behavior",
        match: "Match field",
        create: "Create new records",
        skip: "Skip duplicates",
        update: "Update existing only",
        upsert: "Create or update",
        runPreview: "Validate & preview",
        back: "Back",
        rows: "rows",
        unmapped: "Ignored columns",
        createCount: "To create",
        updateCount: "To update",
        skipCount: "To skip",
        rejectCount: "Rejected",
        issues: "Issues",
        action: "Action",
        done: "Import complete",
        startOver: "Import another file",
        noHistory: "No imports yet.",
        download: "Download failure report",
        ambiguous: "The destination is ambiguous. Choose the correct module.",
        customNotice:
          "No column is discarded silently. Choose ignore, an existing field, or a custom field.",
        processing: "Processing…",
        file: "File",
        status: "Status",
        result: "Result",
        date: "Date",
        actions: "Actions",
        details: "Details",
        created: "Created",
        updated: "Updated",
        skipped: "Skipped",
        failed: "Errors",
        processed: "Processed",
        viewImportDetails: "Import operation details",
        noEditDelete: "Completed imports cannot be edited or deleted so the audit history remains reliable.",
        fieldName: "Field name",
        options: "Options (comma separated)",
      };
  const importDropCopy = ar
    ? `XLSX أو CSV — حتى ${formatMegabytes(limits.maxFileBytes)} ميجابايت و${limits.maxRows.toLocaleString("en-US")} صف حسب باقتك`
    : `XLSX or CSV — up to ${formatMegabytes(limits.maxFileBytes)} MB and ${limits.maxRows.toLocaleString("en-US")} rows on your plan`;
  const labels: Record<ImportDestination, string> = ar
    ? {
        CLIENT: "العملاء",
        LEAD: "العملاء المحتملون",
        CONTACT: "جهات الاتصال",
        DEAL: "الصفقات",
        TASK: "المهام",
      }
    : {
        CLIENT: "Clients",
        LEAD: "Leads",
        CONTACT: "Contacts",
        DEAL: "Deals",
        TASK: "Tasks",
      };
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [destination, setDestination] = useState<ImportDestination | "">("");
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [mode, setMode] = useState("CREATE");
  const [matchField, setMatchField] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    status: string;
  } | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const confirmationKey = useRef("");

  const initializeMappings = (data: Analysis, selected: ImportDestination) => {
    const initialMappings = data.suggestions[selected].map(
      (suggestion): ColumnMapping =>
        suggestion.suggestedField
          ? {
              source: suggestion.source,
              action: "FIELD",
              target: suggestion.suggestedField,
            }
          : { source: suggestion.source, action: "IGNORE" },
    );
    const initialMatchField =
      initialMappings.find(
        (mapping) =>
          mapping.action === "FIELD" &&
          data.fields[selected].find((field) => field.key === mapping.target)
            ?.matchable,
      )?.target || "";
    setMappings(initialMappings);
    setDestination(selected);
    setMode("CREATE");
    setMatchField(initialMatchField);
    setPreview(null);
    setResult(null);
    confirmationKey.current = "";
  };

  const analyze = async (
    selectedFile: File,
    sheetName?: string,
    manualDestination?: ImportDestination | "",
  ) => {
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      if (sheetName) form.append("sheetName", sheetName);
      if (manualDestination) form.append("destination", manualDestination);
      const response = await fetch("/api/imports/analyze", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(
          errorMessage(
            data.error,
            ar ? "تعذر تحليل الملف" : "Unable to analyze file",
          ),
        );
      if (analysis?.importId && analysis.importId !== data.importId)
        void fetch(`/api/imports/${analysis.importId}/cancel`, {
          method: "POST",
        });
      setAnalysis(data);
      setFile(selectedFile);
      const selected = (manualDestination ||
        data.destination ||
        data.detection.destination ||
        "") as ImportDestination | "";
      if (selected) initializeMappings(data, selected);
      else {
        setDestination("");
        setMappings([]);
        setPreview(null);
      }
    } catch (exception) {
      setError(
        errorMessage(
          exception instanceof Error ? exception.message : undefined,
          ar ? "تعذر تحليل الملف" : "Unable to analyze file",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const chooseDestination = (value: ImportDestination) => {
    if (!analysis) return;
    initializeMappings(analysis, value);
  };
  const updateMapping = (index: number, selection: string) =>
    setMappings((current) =>
      current.map((mapping, itemIndex) => {
        if (itemIndex !== index) return mapping;
        if (selection === "IGNORE")
          return { source: mapping.source, action: "IGNORE" };
        if (selection === "CUSTOM_NEW") {
          const suggestion =
            analysis?.suggestions[destination as ImportDestination][index];
          return {
            source: mapping.source,
            action: "CUSTOM",
            customLabel: mapping.source,
            customType:
              suggestion?.inferredType === "CURRENCY"
                ? "CURRENCY"
                : suggestion?.inferredType || "TEXT",
          };
        }
        if (selection.startsWith("CUSTOM:"))
          return {
            source: mapping.source,
            action: "CUSTOM",
            target: selection.slice(7),
          };
        return {
          source: mapping.source,
          action: "FIELD",
          target: selection.slice(6),
        };
      }),
    );
  const patchMapping = (index: number, patch: Partial<ColumnMapping>) =>
    setMappings((current) =>
      current.map((mapping, itemIndex) =>
        itemIndex === index ? { ...mapping, ...patch } : mapping,
      ),
    );
  const mappedMatchFields = useMemo(
    () =>
      destination
        ? mappings
            .filter(
              (mapping) =>
                mapping.action === "FIELD" &&
                analysis?.fields[destination].find(
                  (field) => field.key === mapping.target,
                )?.matchable,
            )
            .map((mapping) => mapping.target!)
        : [],
    [analysis, destination, mappings],
  );

  const runPreview = async () => {
    if (!analysis || !destination) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/imports/${analysis.importId}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination,
            mappings,
            mode,
            matchField: matchField || null,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(
          errorMessage(
            data.error,
            ar ? "تعذرت معاينة الاستيراد" : "Unable to preview import",
          ),
        );
      setPreview(data);
    } catch (exception) {
      setError(
        errorMessage(
          exception instanceof Error ? exception.message : undefined,
          ar ? "تعذرت معاينة الاستيراد" : "Unable to preview import",
        ),
      );
    } finally {
      setLoading(false);
    }
  };
  const confirm = async () => {
    if (!analysis) return;
    setLoading(true);
    setError("");
    try {
      if (!confirmationKey.current)
        confirmationKey.current = crypto.randomUUID().replace(/-/g, "");
      const idempotencyKey = confirmationKey.current;
      const response = await fetch(
        `/api/imports/${analysis.importId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idempotencyKey }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(
          errorMessage(
            data.error,
            ar ? "تعذر إكمال الاستيراد" : "Unable to complete import",
          ),
        );
      setResult(data);
    } catch (exception) {
      setError(
        errorMessage(
          exception instanceof Error ? exception.message : undefined,
          ar ? "تعذر إكمال الاستيراد" : "Unable to complete import",
        ),
      );
    } finally {
      setLoading(false);
    }
  };
  const reset = () => {
    if (analysis && !result)
      void fetch(`/api/imports/${analysis.importId}/cancel`, {
        method: "POST",
      });
    setFile(null);
    setAnalysis(null);
    setDestination("");
    setMappings([]);
    setPreview(null);
    setResult(null);
    setError("");
    confirmationKey.current = "";
    if (fileInput.current) fileInput.current.value = "";
  };
  const selectClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
  const buttonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryClass =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
  const BackIcon = direction === "rtl" ? ArrowRight : ArrowLeft;

  const statusPresentation = (status: string) => {
    if (status === "COMPLETED") {
      return {
        label: ar ? "مكتمل" : "Completed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
      };
    }
    if (status === "PARTIAL") {
      return {
        label: ar ? "مكتمل جزئياً" : "Partially completed",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: AlertTriangle,
      };
    }
    if (status === "FAILED") {
      return {
        label: ar ? "فشل" : "Failed",
        className: "border-rose-200 bg-rose-50 text-rose-700",
        icon: AlertCircle,
      };
    }
    return {
      label: status,
      className: "border-slate-200 bg-slate-50 text-slate-600",
      icon: Loader2,
    };
  };

  const historyMetric = (icon: typeof PlusCircle, label: string, value: number, className: string) => {
    const Icon = icon;
    return (
      <div className={`flex min-w-[92px] items-center gap-1.5 rounded-lg border px-2 py-1.5 ${className}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-semibold">{label}</span>
        <strong className="ms-auto text-sm leading-none">{value}</strong>
      </div>
    );
  };

  return (
    <div className="space-y-8" dir={direction}>
      <div>
        <h1 className="text-2xl font-black text-slate-950 dark:text-white">
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {copy.subtitle}
        </p>
      </div>

      <ol className="grid grid-cols-3 gap-2" aria-label={copy.title}>
        {[copy.upload, copy.mapping, copy.preview].map((label, index) => {
          const active = result ? 3 : preview ? 2 : analysis ? 1 : 0;
          return (
            <li
              key={label}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${index <= active ? "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200" : "border-slate-200 text-slate-400 dark:border-slate-800"}`}
            >
              {index + 1}. {label}
            </li>
          );
        })}
      </ol>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!analysis && (
        <section className="rounded-3xl border-2 border-dashed border-brand-300 bg-gradient-to-br from-brand-50 to-white p-8 text-center dark:border-brand-800 dark:from-brand-950/30 dark:to-slate-950">
          <UploadCloud className="mx-auto h-12 w-12 text-brand-600" />
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            {copy.upload}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{importDropCopy}</p>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) analyze(selected);
            }}
          />
          <button
            className={`${buttonClass} mt-5`}
            onClick={() => fileInput.current?.click()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {copy.upload}
          </button>
        </section>
      )}

      {analysis && !result && (
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <div className="text-xs text-slate-500">{copy.file}</div>
              <div className="mt-1 truncate text-sm font-bold">
                {analysis.filename}
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                {copy.sheet}
              </span>
              <select
                className={selectClass}
                value={analysis.selectedSheet}
                onChange={(event) =>
                  file && analyze(file, event.target.value, destination)
                }
                disabled={loading}
              >
                {analysis.sheetNames.map((sheet) => (
                  <option key={sheet}>{sheet}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                {copy.destination}
              </span>
              <select
                className={selectClass}
                value={destination}
                onChange={(event) =>
                  chooseDestination(event.target.value as ImportDestination)
                }
              >
                <option value="">—</option>
                {destinations.map((item) => (
                  <option key={item} value={item}>
                    {labels[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className={`rounded-xl border p-3 text-sm ${analysis.detection.ambiguous ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200"}`}
          >
            <strong>{copy.recommend}:</strong>{" "}
            {analysis.detection.destination
              ? labels[analysis.detection.destination]
              : copy.ambiguous}{" "}
            · {analysis.rowCount} {copy.rows}
          </div>

          {destination && (
            <>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {copy.mapping}
                </h2>
                <p className="text-sm text-slate-500">{copy.customNotice}</p>
              </div>
              <div className="space-y-3">
                {mappings.map((mapping, index) => {
                  const suggestion = analysis.suggestions[destination][index];
                  const selected =
                    mapping.action === "IGNORE"
                      ? "IGNORE"
                      : mapping.action === "FIELD"
                        ? `FIELD:${mapping.target}`
                        : mapping.target
                          ? `CUSTOM:${mapping.target}`
                          : "CUSTOM_NEW";
                  return (
                    <div
                      key={mapping.source}
                      className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[1.1fr_1fr_1.4fr] dark:border-slate-700"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {mapping.source}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {copy.type}: {suggestion.inferredType}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {suggestion.samples.map((sample) => (
                            <span
                              key={sample}
                              className="max-w-full truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {sample}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        <div className="font-bold text-slate-600 dark:text-slate-300">
                          {copy.confidence}
                        </div>
                        <p className="mt-1">
                          {suggestion.explanation}
                          {suggestion.confidence
                            ? ` (${Math.round(suggestion.confidence * 100)}%)`
                            : ""}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <select
                          aria-label={`${copy.mapping}: ${mapping.source}`}
                          className={selectClass}
                          value={selected}
                          onChange={(event) =>
                            updateMapping(index, event.target.value)
                          }
                        >
                          <option value="IGNORE">{copy.ignore}</option>
                          <optgroup label={copy.destination}>
                            {analysis.fields[destination].map((field) => (
                              <option
                                key={field.key}
                                value={`FIELD:${field.key}`}
                              >
                                {ar ? field.labelAr : field.label}
                                {field.required ? ` — ${copy.required}` : ""}
                              </option>
                            ))}
                          </optgroup>
                          {analysis.customFields[destination].length > 0 && (
                            <optgroup label={copy.existingCustom}>
                              {analysis.customFields[destination].map(
                                (field) => (
                                  <option
                                    key={field.key}
                                    value={`CUSTOM:${field.key}`}
                                  >
                                    {field.label}
                                    {field.required
                                      ? ` — ${copy.required}`
                                      : ""}
                                  </option>
                                ),
                              )}
                            </optgroup>
                          )}
                          {analysis.canCreateCustomFields && (
                            <option value="CUSTOM_NEW">
                              + {copy.newCustom}
                            </option>
                          )}
                        </select>
                        {mapping.action === "CUSTOM" && !mapping.target && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className={selectClass}
                              aria-label={copy.fieldName}
                              value={mapping.customLabel || ""}
                              onChange={(event) =>
                                patchMapping(index, {
                                  customLabel: event.target.value,
                                })
                              }
                            />
                            <select
                              className={selectClass}
                              value={mapping.customType || "TEXT"}
                              onChange={(event) =>
                                patchMapping(index, {
                                  customType: event.target.value,
                                  customOptions: undefined,
                                })
                              }
                            >
                              {customTypes.map((type) => (
                                <option key={type}>{type}</option>
                              ))}
                            </select>
                            {["SELECT", "MULTI_SELECT"].includes(
                              mapping.customType || "",
                            ) && (
                              <input
                                className={`${selectClass} col-span-2`}
                                aria-label={copy.options}
                                placeholder={copy.options}
                                value={(mapping.customOptions || []).join(", ")}
                                onChange={(event) =>
                                  patchMapping(index, {
                                    customOptions: event.target.value
                                      .split(",")
                                      .map((option) => option.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
                            )}
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={!!mapping.required}
                                onChange={(event) =>
                                  patchMapping(index, {
                                    required: event.target.checked,
                                  })
                                }
                              />
                              {copy.required}
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={!!mapping.searchable}
                                onChange={(event) =>
                                  patchMapping(index, {
                                    searchable: event.target.checked,
                                  })
                                }
                              />
                              {copy.searchable}
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2 dark:bg-slate-800/60">
                <label>
                  <span className="mb-1 block text-xs font-bold">
                    {copy.mode}
                  </span>
                  <select
                    className={selectClass}
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                  >
                    <option value="CREATE">{copy.create}</option>
                    <option
                      value="SKIP_DUPLICATES"
                      disabled={!mappedMatchFields.length}
                    >
                      {copy.skip}
                    </option>
                    <option value="UPDATE" disabled={!mappedMatchFields.length}>
                      {copy.update}
                    </option>
                    <option value="UPSERT" disabled={!mappedMatchFields.length}>
                      {copy.upsert}
                    </option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold">
                    {copy.match}
                  </span>
                  <select
                    className={selectClass}
                    value={matchField}
                    onChange={(event) => setMatchField(event.target.value)}
                  >
                    <option value="">—</option>
                    {mappedMatchFields.map((field) => {
                      const metadata = analysis.fields[destination].find(
                        (item) => item.key === field,
                      );
                      return (
                        <option key={field} value={field}>
                          {ar ? metadata?.labelAr : metadata?.label}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <button className={secondaryClass} onClick={reset}>
                  <BackIcon className="h-4 w-4" />
                  {copy.back}
                </button>
                <button
                  className={buttonClass}
                  onClick={runPreview}
                  disabled={loading || (mode !== "CREATE" && !matchField)}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {copy.runPreview}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {preview && !result && (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-black">{copy.preview}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: copy.createCount,
                count: preview.summary.create,
                className:
                  "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
              },
              {
                label: copy.updateCount,
                count: preview.summary.update,
                className:
                  "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30",
              },
              {
                label: copy.skipCount,
                count: preview.summary.skip,
                className:
                  "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
              },
              {
                label: copy.rejectCount,
                count: preview.summary.reject,
                className:
                  "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl border p-3 ${stat.className}`}
              >
                <div className="text-xs text-slate-500">{stat.label}</div>
                <div className="text-2xl font-black">{stat.count}</div>
              </div>
            ))}
          </div>
          {!!preview.summary.ignoredColumns.length && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>{copy.unmapped}:</strong>{" "}
              {preview.summary.ignoredColumns.join(", ")}
            </div>
          )}
          {!!preview.summary.proposedCustomFields.length && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200">
              <strong>{copy.newCustom}:</strong>{" "}
              {preview.summary.proposedCustomFields
                .map((field) => `${field.label} (${field.fieldType})`)
                .join(", ")}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-start">#</th>
                  <th className="px-3 py-2 text-start">{copy.action}</th>
                  <th className="px-3 py-2 text-start">{copy.preview}</th>
                  <th className="px-3 py-2 text-start">{copy.issues}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 30).map((row) => (
                  <tr
                    key={row.row}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-3 py-2">{row.row}</td>
                    <td className="px-3 py-2 font-bold">{row.action}</td>
                    <td className="max-w-md px-3 py-2 text-xs text-slate-500">
                      {Object.entries(row.values)
                        .slice(0, 4)
                        .map(
                          ([key, value]) => `${key}: ${String(value ?? "—")}`,
                        )
                        .join(" · ")}
                    </td>
                    <td className="px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                      {row.issues.join("; ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <button className={secondaryClass} onClick={() => setPreview(null)}>
              <BackIcon className="h-4 w-4" />
              {copy.back}
            </button>
            <button
              className={buttonClass}
              onClick={confirm}
              disabled={
                loading || preview.summary.create + preview.summary.update === 0
              }
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {copy.confirm}
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-3 text-xl font-black text-emerald-900 dark:text-emerald-100">
            {copy.done}
          </h2>
          <div className="mx-auto mt-5 grid max-w-2xl grid-cols-2 gap-2 text-start sm:grid-cols-4">
            {historyMetric(PlusCircle, copy.created, result.imported, "border-emerald-200 bg-white/70 text-emerald-800")}
            {historyMetric(RefreshCw, copy.updated, result.updated, "border-sky-200 bg-white/70 text-sky-800")}
            {historyMetric(MinusCircle, copy.skipped, result.skipped, "border-slate-200 bg-white/70 text-slate-700")}
            {historyMetric(AlertCircle, copy.failed, result.failed, "border-rose-200 bg-white/70 text-rose-800")}
          </div>
          {result.failed > 0 && analysis && (
            <a
              className={`${secondaryClass} mt-4`}
              href={`/api/imports/${analysis.importId}/failures`}
            >
              <Download className="h-4 w-4" />
              {copy.download}
            </a>
          )}
          <div>
            <button className={`${buttonClass} mt-4`} onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              {copy.startOver}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-black">{copy.history}</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{copy.noHistory}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-start">{copy.file}</th>
                  <th className="px-3 py-2 text-start">{copy.destination}</th>
                  <th className="px-3 py-2 text-start">{copy.status}</th>
                  <th className="px-3 py-2 text-start">{copy.result}</th>
                  <th className="px-3 py-2 text-start">{copy.date}</th>
                  <th className="px-3 py-2 text-start">{copy.actions}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const status = statusPresentation(item.status);
                  const StatusIcon = status.icon;
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-slate-100 align-top transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                    <td className="px-3 py-3">
                      <div className="font-semibold">
                        {item.originalFilename}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.sheetName} · {item.initiatedBy.name}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {item.destination
                        ? labels[item.destination as ImportDestination] ||
                          item.destination
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>
                        <StatusIcon className={`h-3.5 w-3.5 ${item.status === "PROCESSING" ? "animate-spin" : ""}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="min-w-[270px] px-3 py-3">
                      <div className="grid grid-cols-2 gap-1.5">
                        {historyMetric(PlusCircle, copy.created, item.importedRows, "border-emerald-100 bg-emerald-50/70 text-emerald-800")}
                        {historyMetric(RefreshCw, copy.updated, item.updatedRows, "border-sky-100 bg-sky-50/70 text-sky-800")}
                        {historyMetric(MinusCircle, copy.skipped, item.skippedRows, "border-slate-200 bg-slate-50 text-slate-700")}
                        {historyMetric(AlertCircle, copy.failed, item.failedRows, "border-rose-100 bg-rose-50/70 text-rose-800")}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{copy.processed}: {item.processedRows} / {item.totalRows}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {new Intl.DateTimeFormat(ar ? "ar-JO" : "en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.createdAt))}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setSelectedHistory(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-200">
                          <Eye className="h-3.5 w-3.5" />
                          {copy.details}
                        </button>
                        {item.failedRows > 0 && (
                          <a className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50" href={`/api/imports/${item.id}/failures`}>
                            <Download className="h-3.5 w-3.5" />
                            {copy.download}
                          </a>
                        )}
                      </div>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        isOpen={!!selectedHistory}
        onClose={() => setSelectedHistory(null)}
        title={copy.viewImportDetails}
        maxWidth="2xl"
      >
        {selectedHistory && (() => {
          const status = statusPresentation(selectedHistory.status);
          const StatusIcon = status.icon;
          return (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800 dark:bg-slate-800/50">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{selectedHistory.originalFilename}</h3>
                  <p className="mt-1 text-xs text-slate-500">{selectedHistory.sheetName} · {selectedHistory.initiatedBy.name}</p>
                </div>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {historyMetric(PlusCircle, copy.created, selectedHistory.importedRows, "border-emerald-100 bg-emerald-50/70 text-emerald-800")}
                {historyMetric(RefreshCw, copy.updated, selectedHistory.updatedRows, "border-sky-100 bg-sky-50/70 text-sky-800")}
                {historyMetric(MinusCircle, copy.skipped, selectedHistory.skippedRows, "border-slate-200 bg-slate-50 text-slate-700")}
                {historyMetric(AlertCircle, copy.failed, selectedHistory.failedRows, "border-rose-100 bg-rose-50/70 text-rose-800")}
              </div>
              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600 sm:grid-cols-2 dark:border-slate-800 dark:text-slate-300">
                <div><span className="text-xs text-slate-500">{copy.destination}</span><p className="mt-1 font-bold">{selectedHistory.destination ? labels[selectedHistory.destination as ImportDestination] || selectedHistory.destination : "—"}</p></div>
                <div><span className="text-xs text-slate-500">{copy.mode}</span><p className="mt-1 font-bold">{selectedHistory.mode}</p></div>
                <div><span className="text-xs text-slate-500">{copy.processed}</span><p className="mt-1 font-bold">{selectedHistory.processedRows} / {selectedHistory.totalRows}</p></div>
                <div><span className="text-xs text-slate-500">{copy.date}</span><p className="mt-1 font-bold">{new Intl.DateTimeFormat(ar ? "ar-JO" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedHistory.createdAt))}</p></div>
              </div>
              {selectedHistory.failedRows > 0 && (
                <a className={`${secondaryClass} w-full sm:w-auto`} href={`/api/imports/${selectedHistory.id}/failures`}>
                  <Download className="h-4 w-4" />
                  {copy.download}
                </a>
              )}
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">{copy.noEditDelete}</p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
