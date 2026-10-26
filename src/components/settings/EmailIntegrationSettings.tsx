"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, LockKeyhole, Mail, RefreshCw, Unplug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

type Integration = { provider: string; accountEmail: string | null; scopes: string[]; tokenExpiresAt: string | null };

export function EmailIntegrationSettings({ integrations, canManage, googleApprovalPending = false }: { integrations: Integration[]; canManage: boolean; googleApprovalPending?: boolean }) {
  const { language } = useI18n();
  const searchParams = useSearchParams();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const connected = (provider: string) => integrations.find((item) => item.provider === provider);
  const integrationNotice = (() => {
    const status = searchParams.get("integration");
    const reason = searchParams.get("reason");
    if (status === "not-configured") return text("Google/Microsoft OAuth is not configured on the server yet. Add the provider client ID and client secret, then try again.", "لم يتم إعداد Google أو Microsoft OAuth على السيرفر بعد. أضف Client ID وClient Secret الخاصين بالمزود ثم حاول مرة أخرى.");
    if (status === "cancelled") return text("The provider authorization was cancelled. No credentials were saved.", "تم إلغاء التفويض من مزود البريد. لم يتم حفظ أي بيانات.");
    if (status === "connected") return text("The email provider was connected successfully.", "تم ربط مزود البريد بنجاح.");
    if (status === "google-review-pending") return text("Google email sending is locked until Google completes the app review.", "تم قفل إرسال البريد عبر Google حتى تُكمل Google مراجعة التطبيق.");
    if (status === "failed") return reason === "forbidden"
      ? text("You are not authorized to manage this organization email connection.", "ليس لديك صلاحية لإدارة اتصال بريد هذه المؤسسة.")
      : text("The provider connection could not be completed. No credentials were saved.", "تعذر إكمال ربط مزود البريد. لم يتم حفظ أي بيانات.");
    return "";
  })();
  async function disconnect(provider: string) {
    setBusy(provider); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/integrations/${provider}`, { method: "DELETE", credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json().catch(() => null) as { disconnected?: boolean } | null;
      if (!response.ok || result?.disconnected !== true) { setError(text("Unable to disconnect this provider. Please try again.", "تعذر فصل مزود البريد. حاول مرة أخرى.")); return; }
      setMessage(text("The connection was removed. Refreshing…", "تم فصل الاتصال. جارٍ التحديث…"));
      window.location.reload();
    } catch {
      setError(text("Unable to disconnect this provider. Please try again.", "تعذر فصل مزود البريد. حاول مرة أخرى."));
    } finally {
      setBusy("");
    }
  }
  function connect(provider: string) {
    setBusy(provider);
    window.location.assign(`/api/integrations/oauth/start?provider=${provider}&scopes=email`);
  }

  return (
    <section className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Mail className="h-5 w-5 text-brand-600" />{text("Organization email sending", "إرسال البريد باسم المؤسسة")}</h2>
          <p className="mt-1 text-xs text-slate-500">{text("Connect the organization’s Google Workspace or Microsoft 365 sender. Customer emails never use SatrCRM’s platform sender.", "اربط حساب Google Workspace أو Microsoft 365 الخاص بالمؤسسة. رسائل العملاء لا تُرسل من بريد منصة SatrCRM.")}</p>
        </div>
        <ExternalLink className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
      {integrationNotice && <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{integrationNotice}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(["google", "microsoft"] as const).map((provider) => {
          const item = connected(provider);
          const approvalPending = provider === "google" && googleApprovalPending;
          return <div key={provider} className="rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">{provider === "google" ? "Google Workspace" : "Microsoft 365"}</h3>
                {item ? <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{item.accountEmail || text("Connected sender", "مرسل متصل")}</p> : <p className="mt-1 text-xs text-slate-500">{text("Not connected", "غير متصل")}</p>}
              </div>
              {item && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{text("Connected", "متصل")}</span>}
            </div>
            {approvalPending && <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />{text("Google email sending is temporarily locked while Google reviews the app. You can still disconnect the current account.", "تم قفل إرسال البريد عبر Google مؤقتًا أثناء مراجعة التطبيق من Google. يمكنك فصل الحساب الحالي.")}</p>}
            {canManage && <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy) || approvalPending} onClick={() => connect(provider)} title={approvalPending ? text("Waiting for Google verification", "بانتظار موافقة Google") : undefined} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{approvalPending ? <LockKeyhole className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}{approvalPending ? text("Waiting for approval", "بانتظار الموافقة") : item ? text("Reauthorize", "إعادة التفويض") : text("Connect", "ربط")}</button>
              {item && <button type="button" disabled={Boolean(busy)} onClick={() => disconnect(provider)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50"><Unplug className="h-3.5 w-3.5" />{text("Disconnect", "فصل")}</button>}
            </div>}
          </div>;
        })}
      </div>
    </section>
  );
}
