"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Mail,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  activateConfirmedPlanAction,
  confirmPlanPaymentAction,
  reviewPlanUpgradeAction,
} from "@/server/actions/plan-upgrades";
import type { PlanUpgradeService } from "@/server/services/PlanUpgradeService";
import {
  planButton,
  planError,
  planField,
  planStatus,
} from "@/components/settings/SubscriptionView";
import { usePlanSubmission } from "@/components/settings/usePlanSubmission";

type Request = Awaited<ReturnType<typeof PlanUpgradeService.requests>>["requests"][number];
type RequestStatus = "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "ACTIVATED" | "REJECTED" | "CANCELLED";
type FilterStatus = "ALL" | RequestStatus;

const statuses: FilterStatus[] = [
  "ALL",
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "ACTIVATED",
  "REJECTED",
  "CANCELLED",
];

function whatsappHref(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

function statusIcon(status: FilterStatus) {
  if (status === "ALL") return ReceiptText;
  if (status === "PENDING_PAYMENT") return Clock3;
  if (status === "PAYMENT_CONFIRMED") return BadgeCheck;
  if (status === "ACTIVATED") return CheckCircle2;
  return XCircle;
}

function statusTone(status: FilterStatus) {
  if (status === "PENDING_PAYMENT") return "amber";
  if (status === "PAYMENT_CONFIRMED") return "blue";
  if (status === "ACTIVATED") return "emerald";
  if (status === "REJECTED") return "rose";
  if (status === "CANCELLED") return "slate";
  return "violet";
}

function toneClasses(tone: string) {
  const tones: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
    rose: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
    violet: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200",
  };
  return tones[tone] ?? tones.violet;
}

function formatDate(value: string, ar: boolean) {
  return new Intl.DateTimeFormat(ar ? "ar-JO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function RequestCard({ request, ar }: { request: Request; ar: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(request.priceSnapshot ?? "");
  const [error, setError] = useState("");
  const [showActions, setShowActions] = useState(request.status === "PENDING_PAYMENT");
  const [pending, startTransition] = usePlanSubmission(() => setError(planError("RETRY", ar)));
  const whatsapp = whatsappHref(request.phone);
  const tone = statusTone(request.status as RequestStatus);
  const StatusIcon = statusIcon(request.status as RequestStatus);
  const interval = request.billingInterval === "annual" ? (ar ? "سنوي" : "Annual") : ar ? "شهري" : "Monthly";

  const run = (work: () => Promise<{ success: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await work();
      if (result.success) {
        setError("");
        router.refresh();
      } else {
        setError(planError(result.error ?? "RETRY", ar));
      }
    });

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/platform/organizations/${request.organizationId}`}
                  className="truncate text-lg font-black text-slate-950 hover:text-violet-700 hover:underline dark:text-white dark:hover:text-violet-300"
                >
                  {request.organization}
                </Link>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneClasses(tone)}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {planStatus(request.status, ar)}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {request.plan} <span className="text-slate-300">·</span> {interval}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl bg-slate-50 px-4 py-3 text-start dark:bg-slate-800/70 lg:min-w-[150px]">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{ar ? "قيمة الطلب" : "Request value"}</p>
            <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {request.priceSnapshot ?? "—"} <span className="text-xs font-bold text-slate-500">{request.currencySnapshot ?? ""}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-[11px] font-semibold text-slate-500">{ar ? "مقدم الطلب" : "Requested by"}</p>
            <p className="mt-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{request.requester}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{request.email}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-[11px] font-semibold text-slate-500">{ar ? "تاريخ الطلب" : "Requested on"}</p>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{formatDate(request.createdAt, ar)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-[11px] font-semibold text-slate-500">{ar ? "إصدار التسعير" : "Pricing version"}</p>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{request.pricingVersionSnapshot ? `v${request.pricingVersionSnapshot}` : "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-[11px] font-semibold text-slate-500">{ar ? "التواصل" : "Contact"}</p>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">
                <MessageCircle className="h-3.5 w-3.5" />
                {ar ? "واتساب" : "WhatsApp"}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <a href={`mailto:${request.email}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-violet-700 hover:underline dark:text-violet-300">
                <Mail className="h-3.5 w-3.5" />
                {ar ? "البريد الإلكتروني" : "Email"}
              </a>
            )}
          </div>
        </div>

        {request.reason && (
          <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 dark:border-violet-900/40 dark:bg-violet-950/20">
            <p className="text-[11px] font-bold text-violet-700 dark:text-violet-300">{ar ? "ملاحظة الشركة" : "Company note"}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{request.reason}</p>
          </div>
        )}

        {request.status === "PENDING_PAYMENT" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200"><CreditCard className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-sm font-black text-amber-950 dark:text-amber-100">{ar ? "مراجعة الدفع اليدوي" : "Manual payment review"}</h3>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80">{ar ? "تحقق من التحويل قبل تسجيل الدفعة." : "Verify the transfer before recording payment."}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowActions(value => !value)} className="text-xs font-bold text-amber-800 hover:underline dark:text-amber-200">
                {showActions ? (ar ? "إخفاء الحقول" : "Hide fields") : ar ? "فتح المراجعة" : "Open review"}
              </button>
            </div>
            {showActions && <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {ar ? "المبلغ المؤكد" : "Confirmed amount"}
                  <input className={`${planField} mt-2 bg-white dark:bg-slate-900`} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {ar ? "مرجع التحويل (اختياري)" : "Transfer reference (optional)"}
                  <input className={`${planField} mt-2 bg-white dark:bg-slate-900`} maxLength={200} value={reference} onChange={event => setReference(event.target.value)} />
                </label>
              </div>
              <label className="mt-3 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                {ar ? "ملاحظة داخلية" : "Internal note"}
                <textarea className={`${planField} mt-2 min-h-24 resize-y bg-white dark:bg-slate-900`} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} />
              </label>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button type="button" disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:bg-slate-900 dark:text-rose-300" onClick={() => run(() => reviewPlanUpgradeAction({ id: request.id, decision: "REJECTED", reviewNote: note }))}>
                  <XCircle className="h-4 w-4" />
                  {ar ? "رفض الطلب" : "Reject request"}
                </button>
                <button type="button" disabled={pending || !request.currencySnapshot} className={`${planButton} inline-flex items-center gap-2`} onClick={() => run(() => confirmPlanPaymentAction({ id: request.id, amount, currency: request.currencySnapshot, reference, note }))}>
                  <Check className="h-4 w-4" />
                  {pending ? (ar ? "جارٍ الحفظ…" : "Saving…") : ar ? "تأكيد استلام الدفعة" : "Confirm payment"}
                </button>
              </div>
            </>}
          </div>
        )}

        {request.status === "PAYMENT_CONFIRMED" && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"><ShieldCheck className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-sm font-black text-blue-950 dark:text-blue-100">{ar ? "الدفعة مؤكدة وتنتظر التفعيل" : "Payment confirmed — activation pending"}</h3>
                  <p className="mt-1 text-xs leading-5 text-blue-900/75 dark:text-blue-200/75">{ar ? "تأكد من اعتماد سياسة مدة الاشتراك قبل التفعيل." : "Make sure the subscription-period policy is approved before activation."}</p>
                  <p className="mt-2 text-xs font-bold text-blue-900 dark:text-blue-100">{request.confirmedAmount ?? request.priceSnapshot ?? "—"} {request.confirmedCurrency ?? request.currencySnapshot ?? ""}{request.paymentReference ? ` · ${request.paymentReference}` : ""}</p>
                </div>
              </div>
              <button type="button" disabled={pending} className={`${planButton} inline-flex items-center gap-2`} onClick={() => run(() => activateConfirmedPlanAction({ id: request.id }))}>
                <CheckCircle2 className="h-4 w-4" />
                {pending ? (ar ? "جارٍ التفعيل…" : "Activating…") : ar ? "تفعيل الاشتراك" : "Activate subscription"}
              </button>
            </div>
          </div>
        )}

        {request.status !== "PENDING_PAYMENT" && request.status !== "PAYMENT_CONFIRMED" && request.reviewNote && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses(tone)}`}>
            <p className="text-[11px] font-bold">{ar ? "ملاحظة المعالجة" : "Processing note"}</p>
            <p className="mt-1 whitespace-pre-wrap leading-6">{request.reviewNote}</p>
          </div>
        )}

        {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      </div>
    </article>
  );
}

export function PlanUpgradeRequestsView({ data, page }: { data: Awaited<ReturnType<typeof PlanUpgradeService.requests>>; page: number }) {
  const { language } = useI18n();
  const ar = language === "ar";
  const counts = data.counts;
  const queueCount = counts.PENDING_PAYMENT + counts.PAYMENT_CONFIRMED;
  const totalPages = Math.max(1, Math.ceil(data.total / 20));
  const Arrow = ar ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-6 pb-10" dir={ar ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/platform/billing" className="inline-flex items-center gap-2 text-sm font-bold text-violet-700 hover:underline dark:text-violet-300">
          {ar ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          {ar ? "العودة إلى الخطط والفوترة" : "Back to plans & billing"}
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {ar ? "مركز مراجعة الدفع" : "Payment review center"}
        </span>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -bottom-28 right-10 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold tracking-[.22em] text-cyan-300">{ar ? "إدارة الفوترة على مستوى المنصة" : "PLATFORM BILLING OPERATIONS"}</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{ar ? "طلبات التفعيل والدفع اليدوي" : "Activation requests & manual payments"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{ar ? "راجع طلبات الشركات، تحقّق من التحويلات، ثم فعّل الاشتراك من مكان واحد مع سجل واضح لكل حالة." : "Review company requests, verify transfers, and activate subscriptions from one focused workspace."}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200"><Clock3 className="h-5 w-5" /></span>
            <span><span className="block text-lg font-black">{queueCount}</span><span className="text-xs text-slate-300">{ar ? "طلبات تحتاج متابعة" : "requests need attention"}</span></span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statuses.map(status => {
          const Icon = statusIcon(status);
          const count = status === "ALL" ? data.total : counts[status];
          const active = data.status === status;
          return <Link key={status} href={status === "ALL" ? "?status=ALL" : `?status=${status}`} className={`group rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-violet-500 bg-violet-600 text-white" : "border-slate-200/80 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"}`}>
            <div className="flex items-center justify-between gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-white/15" : "bg-violet-500/10 text-violet-700 dark:text-violet-300"}`}><Icon className="h-4 w-4" /></span><span className={`text-2xl font-black ${active ? "text-white" : "text-slate-950 dark:text-white"}`}>{count}</span></div>
            <p className={`mt-3 text-xs font-bold ${active ? "text-violet-100" : "text-slate-500 dark:text-slate-400"}`}>{status === "ALL" ? (ar ? "كل الطلبات" : "All requests") : planStatus(status, ar)}</p>
          </Link>;
        })}
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">{data.status === "ALL" ? (ar ? "كل طلبات التفعيل" : "All activation requests") : planStatus(data.status, ar)}</h2>
          <p className="mt-1 text-sm text-slate-500">{data.total} {ar ? "طلبًا" : data.total === 1 ? "request" : "requests"}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><FileCheck2 className="h-4 w-4 text-violet-500" />{ar ? "تُعرض الأقدم أولًا للمراجعة" : "Oldest requests are shown first"}</div>
      </div>

      <div className="space-y-4">
        {data.requests.map(request => <RequestCard key={request.id} request={request} ar={ar} />)}
        {!data.requests.length && <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><ReceiptText className="h-6 w-6" /></span><h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">{ar ? "لا توجد طلبات بهذه الحالة" : "No requests in this status"}</h3><p className="mt-1 text-sm text-slate-500">{ar ? "ستظهر الطلبات الجديدة هنا عندما ترسلها الشركات." : "New company requests will appear here when submitted."}</p></div>}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        {page > 1 ? <Link className="inline-flex items-center gap-2 font-bold text-violet-700 hover:underline dark:text-violet-300" href={`?status=${data.status}&page=${page - 1}`}>{ar ? "السابق" : "Previous"}</Link> : <span />}
        <span className="font-bold text-slate-500">{page} / {totalPages}</span>
        {page < totalPages ? <Link className="inline-flex items-center gap-2 font-bold text-violet-700 hover:underline dark:text-violet-300" href={`?status=${data.status}&page=${page + 1}`}>{ar ? "التالي" : "Next"} <Arrow className="h-4 w-4" /></Link> : <span />}
      </div>
    </div>
  );
}
