"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
  Globe2,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { AiResearchStatus } from "@/lib/ai/researchSettings";
import {
  cancelLeadDiscoveryJobAction,
  createLeadDiscoveryJobAction,
  getLeadDiscoveryJobAction,
  importLeadDiscoveryResultsAction,
  retryLeadDiscoveryJobAction,
} from "@/server/actions/lead-discovery";

type Job = {
  id: string;
  prompt: string;
  status: string;
  stage: string;
  requestedCount: number;
  createdAt: string;
  _count?: { results: number };
};
type Result = {
  id: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  address?: string | null;
  phone: string | null;
  email: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  companySize?: string | null;
  businessDescription?: string | null;
  leadRelevanceScore: number;
  dataCompleteness: number;
  qualificationReason: string | null;
  verificationStatus: string;
  importedLeadId: string | null;
  sources: Array<{
    id: string;
    url: string;
    title?: string | null;
    snippet: string | null;
    sourceType?: string;
    query?: string | null;
  }>;
};

const stages = [
  "UNDERSTANDING",
  "GENERATING_QUERIES",
  "SEARCHING_WEB",
  "ENRICHING_WEBSITES",
  "EXTRACTING",
  "VALIDATING",
  "DEDUPLICATING",
  "SCORING",
  "READY",
];
const requiredFieldOptions = [
  "website",
  "email",
  "phone",
  "address",
  "linkedin",
];
const stageLabels = {
  ar: {
    UNDERSTANDING: "فهم الطلب",
    GENERATING_QUERIES: "تجهيز الاستعلامات",
    SEARCHING_WEB: "البحث على الويب",
    ENRICHING_WEBSITES: "إثراء المواقع",
    EXTRACTING: "استخراج البيانات",
    VALIDATING: "التحقق",
    DEDUPLICATING: "إزالة التكرار",
    SCORING: "التقييم",
    READY: "جاهز",
  },
  en: {
    UNDERSTANDING: "Understanding",
    GENERATING_QUERIES: "Generating queries",
    SEARCHING_WEB: "Web search",
    ENRICHING_WEBSITES: "Enriching websites",
    EXTRACTING: "Extracting data",
    VALIDATING: "Validating",
    DEDUPLICATING: "Deduplicating",
    SCORING: "Scoring",
    READY: "Ready",
  },
} as const;
const requiredFieldLabels = {
  ar: {
    website: "الموقع الإلكتروني",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    address: "العنوان",
    linkedin: "LinkedIn",
  },
  en: {
    website: "Website",
    email: "Email",
    phone: "Phone",
    address: "Address",
    linkedin: "LinkedIn",
  },
} as const;

export function LeadDiscoveryView({
  initialJobs,
  canImport,
  canCreate,
  language,
  featureStatus,
  setup,
  usage,
}: {
  initialJobs: Job[];
  canImport: boolean;
  canCreate: boolean;
  language: "ar" | "en";
  featureStatus: AiResearchStatus;
  setup: { aiConfigured: boolean };
  usage: { ai: { requests: number; estimatedCostUsd: number; limit: number | null; costLimitUsd: number | null } } | null;
}) {
  const ar = language === "ar";
  const statusLabel = featureStatus === "ON"
    ? (ar ? "مفعّلة" : "Enabled")
    : featureStatus === "BETA"
      ? (ar ? "نسخة تجريبية" : "Beta")
      : (ar ? "متوقفة" : "Disabled");
  const statusClass = featureStatus === "ON"
    ? "bg-emerald-100 text-emerald-700"
    : featureStatus === "BETA"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600";
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    initialJobs[0]?.id || null,
  );
  const [job, setJob] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(20);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [requiredFields, setRequiredFields] = useState<string[]>([
    "website",
    "email",
    "phone",
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [verification, setVerification] = useState("ALL");
  const [sort, setSort] = useState<"score" | "name" | "completeness">("score");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewImport, setReviewImport] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    if (!selectedJobId) return;
    let cancelled = false;
    const load = async () => {
      const result = await getLeadDiscoveryJobAction(selectedJobId);
      if (!cancelled && result.success) setJob(result.job);
    };
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedJobId]);

  const results: Result[] = useMemo(() => job?.results || [], [job?.results]);
  const running =
    job &&
    !["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(job.status);
  const filteredResults = useMemo(
    () =>
      results
        .filter((item) => {
          const text = [
            item.companyName,
            item.website,
            item.industry,
            item.city,
            item.country,
            item.address,
            item.email,
            item.phone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return (
            (!query.trim() || text.includes(query.trim().toLowerCase())) &&
            (verification === "ALL" || item.verificationStatus === verification)
          );
        })
        .sort((a, b) =>
          sort === "name"
            ? a.companyName.localeCompare(b.companyName)
            : sort === "completeness"
              ? b.dataCompleteness - a.dataCompleteness
              : b.leadRelevanceScore - a.leadRelevanceScore,
        ),
    [results, query, verification, sort],
  );
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const visibleResults = filteredResults.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const selectedResults = useMemo(
    () => results.filter((item) => selected.includes(item.id)),
    [results, selected],
  );
  const visibleSelectable = visibleResults
    .filter((item) => !item.importedLeadId)
    .map((item) => item.id);
  const allVisibleSelected =
    visibleSelectable.length > 0 &&
    visibleSelectable.every((id) => selected.includes(id));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const normalizedIndustry = industry.trim();
    if (!canCreate) {
      setMessage(
        ar
          ? "البحث الذكي غير متاح حاليًا."
          : "Smart research is not available right now.",
      );
      return;
    }
    if (normalizedIndustry.length < 2) {
      setMessage(
        ar
          ? "حدد المجال قبل بدء البحث."
          : "Select an industry before starting the search.",
      );
      return;
    }
    setLoading(true);
    setMessage(null);
    const effectivePrompt =
      prompt.trim() ||
      (ar
        ? `ابحث عن شركات ومؤسسات تعمل في مجال ${normalizedIndustry}`
        : `Find businesses and organizations in the ${normalizedIndustry} industry`);
    const result = await createLeadDiscoveryJobAction({
      prompt: effectivePrompt,
      requestedCount: count,
      country: country || null,
      city: city || null,
      industry: normalizedIndustry,
      requiredFields,
    });
    if (result.success) {
      setPrompt("");
      setSelectedJobId(result.job.id);
      setJobs((current) => [
        {
          id: result.job.id,
          prompt: effectivePrompt,
          status: result.job.status,
          stage: result.job.stage,
          requestedCount: count,
          createdAt: new Date().toISOString(),
          _count: { results: 0 },
        },
        ...current,
      ]);
      setMessage(
        ar
          ? "بدأ البحث. سيتم تحديث النتائج تلقائياً."
          : "Search started. Results will update automatically.",
      );
    } else setMessage(result.error);
    setLoading(false);
    router.refresh();
  }

  async function importSelected() {
    if (!selectedJobId || !selectedResults.length) return;
    setLoading(true);
    setReviewImport(false);
    const result = await importLeadDiscoveryResultsAction(
      selectedJobId,
      selected,
    );
    setMessage(
      result.success
        ? ar
          ? `تمت معالجة ${result.imported.length} نتيجة.`
          : `Processed ${result.imported.length} results.`
        : result.error,
    );
    setLoading(false);
    if (result.success) {
      setSelected([]);
      const next = await getLeadDiscoveryJobAction(selectedJobId);
      if (next.success) setJob(next.job);
      router.refresh();
    }
  }

  async function cancelCurrentJob() {
    if (!selectedJobId) return;
    setLoading(true);
    const result = await cancelLeadDiscoveryJobAction(selectedJobId);
    setMessage(
      result.success
        ? ar
          ? "تم إلغاء البحث."
          : "Discovery cancelled."
        : result.error,
    );
    setLoading(false);
    if (result.success) {
      const next = await getLeadDiscoveryJobAction(selectedJobId);
      if (next.success) setJob(next.job);
    }
  }

  async function retryCurrentJob() {
    if (!selectedJobId) return;
    setLoading(true);
    const result = await retryLeadDiscoveryJobAction(selectedJobId);
    setMessage(
      result.success
        ? ar
          ? "بدأت إعادة المحاولة."
          : "Discovery retry started."
        : result.error,
    );
    setLoading(false);
    if (result.success) {
      const next = await getLeadDiscoveryJobAction(selectedJobId);
      if (next.success) setJob(next.job);
    }
  }

  function toggleField(field: string) {
    setRequiredFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  }
  function togglePageSelection() {
    setSelected((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleSelectable.includes(id))
        : [...new Set([...current, ...visibleSelectable])],
    );
  }
  function exportResults() {
    const rows = selectedResults.length ? selectedResults : filteredResults;
    const header = [
      "Company name",
      "Industry",
      "Country",
      "City",
      "Address",
      "Email",
      "Phone",
      "Website",
      "Score",
      "Verification",
      "Sources",
    ];
    const csv = [
      header,
      ...rows.map((item) => [
        item.companyName,
        item.industry || "",
        item.country || "",
        item.city || "",
        item.address || "",
        item.email || "",
        item.phone || "",
        item.website || "",
        item.leadRelevanceScore,
        item.verificationStatus,
        item.sources.length,
      ]),
    ]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `satrcrm-discovery-${selectedJobId || "results"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-6 text-white shadow-xl sm:p-9">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">
              {ar ? "البحث الذكي" : "SMART RESEARCH"}
            </p>
            <h1 className="mt-2 text-3xl font-black">
              {ar ? "ابحث عن العملاء حسب المجال" : "Find customers by industry"}
            </h1>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
              {ar ? "حالة الميزة:" : "Feature status:"} {statusLabel}
            </span>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {ar
                ? "حدد المجال والموقع والبيانات المطلوبة. سنبحث في الويب، نتحقق من المصادر، ونترك قرار الاستيراد لك."
                : "Set the industry, location, and required data. We search the web, verify sources, and leave the import decision to you."}
            </p>
          </div>
        </div>
      </div>
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold">{ar ? "جاهزية البحث الذكي" : "Smart Research setup"}</h2>
          <p className="mt-1 text-xs text-slate-500">{ar ? "يعمل البحث من خلال مزود الذكاء الاصطناعي المفعّل." : "Search runs through the configured AI provider."}</p>
          <div className="mt-4 grid gap-2 text-xs font-semibold sm:grid-cols-2">
            <span className={`rounded-lg px-3 py-2 ${setup.aiConfigured ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{setup.aiConfigured ? "✓" : "!"} {ar ? "AI Provider جاهز" : "AI Provider ready"}</span>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">2. {ar ? "حدد المجال" : "Choose industry"}</span>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">3. {ar ? "راجع واستورد النتائج" : "Review and import results"}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold">{ar ? "استهلاك هذا الشهر" : "This month usage"}</h2>
          {usage ? <div className="mt-4 grid gap-3 text-xs"><div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p className="text-slate-500">AI</p><p className="mt-1 font-black">{usage.ai.requests} / {usage.ai.limit ?? "∞"}</p><p className="text-slate-500">${usage.ai.estimatedCostUsd.toFixed(4)} / {usage.ai.costLimitUsd == null ? "∞" : `$${usage.ai.costLimitUsd}`}</p></div></div> : <p className="mt-3 text-xs text-slate-500">{ar ? "لا تتوفر بيانات الاستهلاك." : "Usage data is unavailable."}</p>}
        </div>
      </section>
      {message && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
          {message}
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={start} className="space-y-4">
          <label className="block text-sm font-bold">
            {ar ? "المجال المطلوب *" : "Target industry *"}
            <input
              required
              minLength={2}
              maxLength={200}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder={
                ar
                  ? "مثال: شركات التسويق الرقمي، المدارس الخاصة، المطاعم"
                  : "Example: Digital marketing agencies, private schools, restaurants"
              }
            />
          </label>
          <label className="block text-sm font-bold">
            {ar ? "وصف إضافي (اختياري)" : "Additional description (optional)"}
            <textarea
              maxLength={4000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder={
                ar
                  ? "مثال: أريد شركات صغيرة ومتوسطة لديها بيانات اتصال عامة."
                  : "Example: I want small and medium businesses with public contact details."
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold">
              {ar ? "الدولة" : "Country"}
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="text-xs font-bold">
              {ar ? "المدينة" : "City"}
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="text-xs font-bold">
              {ar ? "المجال المحدد" : "Selected industry"}
              <p className="mt-1 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                {industry.trim() ||
                  (ar ? "لم يتم تحديد مجال" : "No industry selected")}
              </p>
            </label>
          </div>
          <div>
            <p className="text-xs font-bold">
              {ar ? "البيانات المطلوبة" : "Required fields"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {requiredFieldOptions.map((field) => (
                <label
                  key={field}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={requiredFields.includes(field)}
                    onChange={() => toggleField(field)}
                  />{" "}
                  <span className="ml-1">
                    {
                      requiredFieldLabels[ar ? "ar" : "en"][
                        field as keyof typeof requiredFieldLabels.ar
                      ]
                    }
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-bold">
              {ar ? "عدد النتائج" : "Result count"}
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) =>
                  setCount(
                    Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                  )
                }
                className="mt-2 block w-32 rounded-xl border border-slate-300 p-3 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <button
              disabled={loading || !canCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {loading
                ? ar
                  ? "جارٍ التشغيل…"
                  : "Starting…"
                : ar
                  ? "ابدأ البحث"
                  : "Start search"}
            </button>
          </div>
        </form>
      </section>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="px-3 py-2 text-sm font-bold">
            {ar ? "سجل البحث" : "Search history"}
          </h2>
          {jobs.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-slate-500">
              {ar ? "لا توجد عمليات بعد." : "No searches yet."}
            </p>
          )}
          {jobs.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedJobId(item.id);
                setPage(1);
                setSelected([]);
              }}
              className={`mb-1 w-full rounded-xl p-3 text-start ${item.id === selectedJobId ? "bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              <p className="line-clamp-2 text-xs font-bold">{item.prompt}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {item.status} · {item._count?.results || 0} results
              </p>
            </button>
          ))}
        </aside>
        <main className="min-w-0 space-y-4">
          {!job ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-slate-500">
              {ar
                ? "اختر عملية بحث أو ابدأ واحدة جديدة."
                : "Choose a search or start a new one."}
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-600">
                      {job.status}
                    </p>
                    <h2 className="mt-1 font-bold">{job.prompt}</h2>
                  </div>
                  {running ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void cancelCurrentJob()}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-40"
                      >
                        {ar ? "إلغاء" : "Cancel"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {["FAILED", "PARTIAL", "CANCELLED"].includes(
                        job.status,
                      ) && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void retryCurrentJob()}
                          className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-700 disabled:opacity-40"
                        >
                          {ar ? "إعادة المحاولة" : "Retry"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-9">
                  {stages.map((stage, index) => (
                    <div
                      key={stage}
                      className={`rounded-lg p-2 text-center text-[10px] font-bold ${stages.indexOf(job.stage) >= index ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}
                    >
                      <span>{index + 1}</span>
                      <p className="mt-1 hidden sm:block">
                        {
                          stageLabels[ar ? "ar" : "en"][
                            stage as keyof typeof stageLabels.ar
                          ]
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
                  <div>
                    <h2 className="font-bold">
                      {ar
                        ? "النتائج المدعومة بالمصادر"
                        : "Evidence-backed results"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {filteredResults.length} / {results.length}{" "}
                      {ar ? "نتيجة" : "results"} ·{" "}
                      {ar ? "راجعها قبل الاستيراد" : "review before importing"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      aria-label={ar ? "بحث في النتائج" : "Search results"}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder={ar ? "بحث…" : "Search…"}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <select
                      value={verification}
                      onChange={(e) => {
                        setVerification(e.target.value);
                        setPage(1);
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="ALL">
                        {ar ? "كل حالات التحقق" : "All verification"}
                      </option>
                      <option value="VERIFIED">
                        {ar ? "موثق" : "Verified"}
                      </option>
                      <option value="PARTIALLY_VERIFIED">
                        {ar ? "موثق جزئيًا" : "Partial"}
                      </option>
                      <option value="UNVERIFIED">
                        {ar ? "غير موثق" : "Unverified"}
                      </option>
                    </select>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as typeof sort)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="score">Sort: score</option>
                      <option value="completeness">Sort: completeness</option>
                      <option value="name">Sort: name</option>
                    </select>
                    {results.length > 0 && (
                      <button
                        type="button"
                        onClick={exportResults}
                        className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {ar ? "تصدير" : "Export"}
                      </button>
                    )}
                    {canImport && (
                      <button
                        type="button"
                        onClick={togglePageSelection}
                        disabled={!visibleSelectable.length}
                        className="rounded-lg border px-3 py-2 text-xs font-bold"
                      >
                        {allVisibleSelected
                          ? ar
                            ? "إلغاء تحديد الصفحة"
                            : "Clear page"
                          : ar
                            ? "تحديد الصفحة"
                            : "Select page"}
                      </button>
                    )}
                    {canImport && (
                      <button
                        type="button"
                        disabled={loading || !selected.length}
                        onClick={() => setReviewImport(true)}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {ar
                          ? `استيراد (${selected.length})`
                          : `Import (${selected.length})`}
                      </button>
                    )}
                  </div>
                </div>
                <div className="divide-y dark:divide-slate-800">
                  {visibleResults.map((item) => (
                    <article key={item.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          disabled={!canImport || Boolean(item.importedLeadId)}
                          checked={selected.includes(item.id)}
                          onChange={(e) =>
                            setSelected((current) =>
                              e.target.checked
                                ? [...current, item.id]
                                : current.filter((id) => id !== item.id),
                            )
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold">{item.companyName}</h3>
                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-700">
                              {item.leadRelevanceScore}/100
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                              {item.verificationStatus}
                            </span>
                            {item.importedLeadId && (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                                IMPORTED
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                            {item.website && (
                              <a
                                href={item.website}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-violet-600"
                              >
                                <Globe2 className="h-3.5 w-3.5" />
                                {item.website}
                              </a>
                            )}
                            {(item.city || item.country) && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {[item.city, item.country]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                            {item.email && <span>{item.email}</span>}
                            {item.phone && <span>{item.phone}</span>}
                          </div>
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            {item.qualificationReason ||
                              (ar
                                ? "لا يوجد تفسير."
                                : "No qualification explanation.")}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(
                                expandedId === item.id ? null : item.id,
                              )
                            }
                            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cyan-700"
                          >
                            {expandedId === item.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            {ar ? "التفاصيل والأدلة" : "Details & evidence"} (
                            {item.sources.length})
                          </button>
                          {expandedId === item.id && (
                            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950">
                              <p>
                                <strong>
                                  {ar ? "اكتمال البيانات" : "Data completeness"}
                                  :
                                </strong>{" "}
                                {item.dataCompleteness}%
                              </p>
                              {item.businessDescription && (
                                <p className="mt-2">
                                  <strong>
                                    {ar ? "الوصف" : "Description"}:
                                  </strong>{" "}
                                  {item.businessDescription}
                                </p>
                              )}
                              {(item.linkedin ||
                                item.instagram ||
                                item.companySize) && (
                                <p className="mt-2">
                                  <strong>
                                    {ar ? "بيانات إضافية" : "Additional"}:
                                  </strong>{" "}
                                  {[
                                    item.companySize,
                                    item.linkedin,
                                    item.instagram,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                              <div className="mt-3 space-y-2">
                                {item.sources.map((source) => (
                                  <div
                                    key={source.id}
                                    className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
                                  >
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="break-all font-semibold text-cyan-700 underline"
                                    >
                                      {source.title || source.url}
                                    </a>
                                    {source.snippet && (
                                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                                        {source.snippet}
                                      </p>
                                    )}
                                    <p className="mt-1 text-[10px] text-slate-500">
                                      {source.sourceType || "PUBLIC_SOURCE"}
                                      {source.query ? ` · ${source.query}` : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                  {!visibleResults.length && (
                    <div className="p-12 text-center text-sm text-slate-500">
                      {running
                        ? ar
                          ? "يتم جمع النتائج والتحقق منها…"
                          : "Collecting and validating results…"
                        : ar
                          ? "لم يتم العثور على نتائج."
                          : "No results found."}
                    </div>
                  )}
                </div>
                {filteredResults.length > pageSize && (
                  <div className="flex items-center justify-between border-t border-slate-200 p-4 text-xs dark:border-slate-800">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => current - 1)}
                      className="rounded-lg border px-3 py-2 disabled:opacity-40"
                    >
                      {ar ? "السابق" : "Previous"}
                    </button>
                    <span>
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                      className="rounded-lg border px-3 py-2 disabled:opacity-40"
                    >
                      {ar ? "التالي" : "Next"}
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      {reviewImport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h2 className="text-lg font-bold">
              {ar ? "مراجعة الاستيراد" : "Review import"}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {ar
                ? "سيتم إنشاء Leads عادية باستخدام الاسم والشركة والبريد والهاتف والملاحظات والمصادر. لن يتم تجاوز كشف التكرار أو صلاحيات CRM."
                : "Selected businesses will be created as normal CRM leads using name, company, email, phone, notes, and source metadata. Existing duplicate checks and CRM permissions still apply."}
            </p>
            <div className="mt-4 max-h-48 space-y-2 overflow-auto">
              {selectedResults.map((item) => (
                <div key={item.id} className="rounded-lg border p-2 text-sm">
                  {item.companyName}
                  <span className="ml-2 text-xs text-slate-500">
                    {item.email ||
                      item.website ||
                      (ar ? "بدون بيانات اتصال" : "no contact data")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewImport(false)}
                className="rounded-xl border px-4 py-2 text-sm font-bold"
              >
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => void importSelected()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
              >
                {ar ? "تأكيد الاستيراد" : "Confirm import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
