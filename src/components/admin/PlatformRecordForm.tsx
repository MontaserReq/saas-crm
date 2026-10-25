"use client";

import { useState } from "react";
import { MessageSquareReply, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { Modal } from "@/components/ui/Modal";
import { savePlatformRecordAction } from "@/server/actions/platform";
import { planFeatureIds, planFeatureLabels } from "@/lib/platform/entitlements";
import { settingKeys } from "@/lib/platform/validation";
import type {
  PlatformResource,
  PlatformRecord,
  PlatformSectionData,
} from "@/lib/platform/types";

type Field = {
  key: string;
  en: string;
  ar: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "password"
    | "number"
    | "checkbox"
    | "textarea"
    | "datetime-local"
    | "select"
    | "multi-select";
  options?: string[];
  source?: keyof PlatformSectionData["options"];
  required?: boolean;
  nullable?: boolean;
  value?: string | number | boolean;
  immutable?: boolean;
};
type SettingPresentation = {
  en: string;
  ar: string;
  helpEn: string;
  helpAr: string;
  type?: Field["type"];
  options?: string[];
};
const settingPresentation: Record<string, SettingPresentation> = {
  signup_enabled: {
    en: "Allow new company registration",
    ar: "السماح بتسجيل شركات جديدة",
    helpEn: "Controls whether the public registration flow accepts new companies.",
    helpAr: "يحدد ما إذا كان التسجيل العام يقبل شركات جديدة.",
    type: "select",
    options: ["true", "false"],
  },
  signup_default_plan_slug: {
    en: "Default plan for new companies",
    ar: "الخطة الافتراضية للشركات الجديدة",
    helpEn: "Enter the plan code assigned during registration.",
    helpAr: "أدخل رمز الخطة التي تُعيّن عند التسجيل.",
  },
  support_email: {
    en: "Platform support email",
    ar: "بريد دعم المنصة",
    helpEn: "The address shown for platform support contact.",
    helpAr: "عنوان البريد الظاهر للتواصل مع دعم المنصة.",
    type: "email",
  },
  platform_name: {
    en: "Platform name",
    ar: "اسم المنصة",
    helpEn: "The public name used by the platform administration area.",
    helpAr: "الاسم العام المستخدم في منطقة إدارة المنصة.",
  },
  default_language: {
    en: "Default language",
    ar: "اللغة الافتراضية",
    helpEn: "The initial language for newly registered companies.",
    helpAr: "اللغة الأولية للشركات المسجلة حديثاً.",
    type: "select",
    options: ["ar", "en"],
  },
  default_timezone: {
    en: "Default timezone",
    ar: "المنطقة الزمنية الافتراضية",
    helpEn: "The initial timezone for newly registered companies.",
    helpAr: "المنطقة الزمنية الأولية للشركات المسجلة حديثاً.",
  },
  paid_subscription_start_policy: {
    en: "Paid subscription starts",
    ar: "موعد بدء الاشتراك المدفوع",
    helpEn: "Subscriptions start only after payment is confirmed. This safety policy is fixed.",
    helpAr: "يبدأ الاشتراك فقط بعد تأكيد الدفع. سياسة الأمان هذه ثابتة.",
  },
  paid_subscription_monthly_months: {
    en: "Monthly subscription duration (months)",
    ar: "مدة الاشتراك الشهري (بالأشهر)",
    helpEn: "Number of access months granted after a confirmed monthly payment.",
    helpAr: "عدد أشهر الوصول الممنوحة بعد تأكيد الدفعة الشهرية.",
    type: "number",
  },
  paid_subscription_annual_months: {
    en: "Annual subscription duration (months)",
    ar: "مدة الاشتراك السنوي (بالأشهر)",
    helpEn: "Number of access months granted after a confirmed annual payment.",
    helpAr: "عدد أشهر الوصول الممنوحة بعد تأكيد الدفعة السنوية.",
    type: "number",
  },
};
const fields: Record<PlatformResource, Field[]> = {
  organizations: [
    { key: "name", en: "Workspace name", ar: "اسم الشركة", required: true },
    { key: "slug", en: "Workspace slug", ar: "رمز الشركة", required: true, immutable: true },
    {
      key: "language",
      en: "Language",
      ar: "اللغة",
      type: "select",
      options: ["en", "ar"],
      value: "en",
    },
    {
      key: "timezone",
      en: "Timezone",
      ar: "المنطقة الزمنية",
      value: "Asia/Riyadh",
      required: true,
    },
    {
      key: "currency",
      en: "Currency",
      ar: "العملة",
      value: "USD",
      required: true,
    },
    {
      key: "isActive",
      en: "Active workspace",
      ar: "شركة نشطة",
      type: "checkbox",
      value: true,
    },
    {
      key: "featureEnable",
      en: "Extra features for this company",
      ar: "ميزات إضافية لهذه الشركة",
      type: "multi-select",
      options: planFeatureIds.filter((feature) => feature !== "dashboard"),
    },
    {
      key: "featureDisable",
      en: "Features disabled for this company",
      ar: "ميزات موقوفة لهذه الشركة",
      type: "multi-select",
      options: planFeatureIds.filter((feature) => feature !== "dashboard"),
    },
  ],
  users: [
    { key: "name", en: "Full name", ar: "الاسم الكامل", required: true },
    {
      key: "email",
      en: "Email",
      ar: "البريد الإلكتروني",
      type: "email",
      required: true,
    },
    {
      key: "phone",
      en: "Phone (international format)",
      ar: "الهاتف (بصيغة دولية)",
      type: "tel",
    },
    {
      key: "organizationId",
      en: "Workspace",
      ar: "الشركة",
      type: "select",
      source: "organizations",
      required: true,
      immutable: true,
    },
    {
      key: "departmentId",
      en: "Department (automatic if empty)",
      ar: "القسم (تلقائي عند تركه فارغًا)",
      type: "select",
      source: "departments",
    },
    {
      key: "roleId",
      en: "Role",
      ar: "الدور",
      type: "select",
      source: "roles",
      required: true,
    },
    {
      key: "password",
      en: "Password (leave empty to keep existing)",
      ar: "كلمة المرور (اتركها فارغة للإبقاء عليها)",
      type: "password",
    },
    {
      key: "isActive",
      en: "Active user",
      ar: "مستخدم نشط",
      type: "checkbox",
      value: true,
    },
  ],
  plans: [
    { key: "name", en: "Plan name", ar: "اسم الخطة", required: true },
    { key: "slug", en: "Plan slug", ar: "رمز الخطة", required: true, immutable: true },
    {
      key: "monthlyPrice",
      en: "Monthly price (empty = custom)",
      ar: "السعر الشهري (فارغ = مخصص)",
      type: "number",
      nullable: true,
    },
    {
      key: "annualPrice",
      en: "Annual price (exact total)",
      ar: "السعر السنوي (الإجمالي الدقيق)",
      type: "number",
      nullable: true,
    },
    {
      key: "currency",
      en: "Pricing currency",
      ar: "عملة التسعير",
      value: "JOD",
      required: true,
    },
    {
      key: "userLimit",
      en: "User allowance (empty = unlimited)",
      ar: "عدد المستخدمين (فارغ = غير محدود)",
      type: "number",
      nullable: true,
    },
    {
      key: "descriptionEn",
      en: "English description",
      ar: "الوصف بالإنجليزية",
      type: "textarea",
    },
    {
      key: "descriptionAr",
      en: "Arabic description",
      ar: "الوصف بالعربية",
      type: "textarea",
    },
    {
      key: "features",
      en: "Features (comma separated)",
      ar: "المزايا (افصل بفاصلة)",
    },
    {
      key: "availability",
      en: "Availability",
      ar: "نوع الاشتراك",
      type: "select",
      options: ["self_serve", "contact_sales"],
      value: "self_serve",
    },
    {
      key: "recommended",
      en: "Recommended plan",
      ar: "خطة موصى بها",
      type: "checkbox",
      value: false,
    },
    {
      key: "isActive",
      en: "Published plan",
      ar: "خطة منشورة",
      type: "checkbox",
      value: true,
    },
  ],
  subscriptions: [
    {
      key: "organizationId",
      en: "Workspace",
      ar: "الشركة",
      type: "select",
      source: "organizations",
      required: true,
    },
    {
      key: "planId",
      en: "Plan",
      ar: "الخطة",
      type: "select",
      source: "plans",
      required: true,
    },
    {
      key: "status",
      en: "Status",
      ar: "الحالة",
      type: "select",
      options: ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"],
      value: "TRIAL",
    },
    {
      key: "billingInterval",
      en: "Billing interval",
      ar: "دورة الفوترة",
      type: "select",
      options: ["monthly", "annual"],
      value: "monthly",
    },
    {
      key: "startsAt",
      en: "Starts at",
      ar: "تاريخ البداية",
      type: "datetime-local",
      required: true,
    },
    {
      key: "endsAt",
      en: "Ends at (optional)",
      ar: "تاريخ النهاية (اختياري)",
      type: "datetime-local",
    },
    { key: "notes", en: "Notes", ar: "ملاحظات", type: "textarea" },
  ],
  integrations: [
    {
      key: "organizationId",
      en: "Workspace",
      ar: "الشركة",
      type: "select",
      source: "organizations",
      required: true,
      immutable: true,
    },
    {
      key: "provider",
      en: "Provider",
      ar: "مزود الخدمة",
      type: "select",
      options: ["GOOGLE", "MICROSOFT", "SMTP"],
      value: "GOOGLE",
    },
    {
      key: "accountEmail",
      en: "Account email",
      ar: "بريد الحساب",
      type: "email",
    },
    {
      key: "accessToken",
      en: "Access token / SMTP password",
      ar: "رمز الوصول / كلمة مرور SMTP",
      type: "password",
    },
    {
      key: "refreshToken",
      en: "Refresh token (optional)",
      ar: "رمز التجديد (اختياري)",
      type: "password",
    },
    {
      key: "tokenExpiresAt",
      en: "Token expiry (optional)",
      ar: "انتهاء الرمز (اختياري)",
      type: "datetime-local",
    },
    {
      key: "scopes",
      en: "Scopes (comma separated)",
      ar: "الصلاحيات (افصل بفاصلة)",
    },
    { key: "host", en: "SMTP host", ar: "خادم SMTP" },
    {
      key: "port",
      en: "SMTP port",
      ar: "منفذ SMTP",
      type: "number",
      value: 587,
    },
    {
      key: "useTls",
      en: "SMTP TLS",
      ar: "تشفير SMTP",
      type: "checkbox",
      value: true,
    },
  ],
  support: [
    {
      key: "organizationId",
      en: "Workspace (optional)",
      ar: "الشركة (اختياري)",
      type: "select",
      source: "organizations",
      immutable: true,
    },
    { key: "subject", en: "Subject", ar: "العنوان", required: true, immutable: true },
    {
      key: "contactEmail",
      en: "Contact email",
      ar: "بريد التواصل",
      type: "email",
      immutable: true,
    },
    { key: "description", en: "Description", ar: "الوصف", type: "textarea", immutable: true },
    {
      key: "status",
      en: "Status",
      ar: "الحالة",
      type: "select",
      options: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      value: "OPEN",
    },
    {
      key: "priority",
      en: "Priority",
      ar: "الأولوية",
      type: "select",
      options: ["LOW", "NORMAL", "HIGH", "URGENT"],
      value: "NORMAL",
    },
    { key: "resolution", en: "Resolution", ar: "الحل", type: "textarea" },
  ],
  settings: [
    {
      key: "key",
      en: "Setting",
      ar: "الإعداد",
      type: "select",
      options: [...settingKeys],
      value: "signup_enabled",
      immutable: true,
    },
    { key: "value", en: "Value", ar: "القيمة", required: true, value: "true" },
  ],
};

function localDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function PlatformRecordForm({
  resource,
  record,
  options,
  defaults,
  onClose,
  onSaved,
}: {
  resource: PlatformResource;
  record: PlatformRecord | null;
  options: PlatformSectionData["options"];
  defaults: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      fields[resource].map((field) => {
        let value =
          field.type === "password"
            ? ""
            : (record?.[field.key] ??
              field.value ??
              (field.key === "startsAt"
                ? localDate(new Date().toISOString())
                : ""));
        if (!record && resource === "organizations")
          value =
            (field.key === "language"
              ? defaults.default_language
              : field.key === "timezone"
                ? defaults.default_timezone
                : undefined) ?? value;
        if (
          field.type === "datetime-local" &&
          typeof value === "string" &&
          value
        )
          value = localDate(value);
        return [
          field.key,
          field.type === "checkbox" ? Boolean(value) : String(value),
        ];
      }),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedSetting =
    resource === "settings"
      ? settingPresentation[String(values.key)]
      : undefined;
  const close = () => {
    if (!busy) onClose();
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const input = Object.fromEntries(
      fields[resource].map((field) => {
        const value = values[field.key];
        const monetary =
          resource === "plans" &&
          ["monthlyPrice", "annualPrice"].includes(field.key);
        return [
          field.key,
          field.type === "number"
            ? value === "" && field.nullable
              ? null
              : monetary
                ? String(value)
                : Number(value)
            : field.type === "datetime-local"
              ? value
                ? new Date(String(value)).toISOString()
                : ""
              : value,
        ];
      }),
    );
    try {
      const result = await savePlatformRecordAction(
        resource,
        record?.id ?? null,
        input,
      );
      if (result.success) onSaved();
      else
        setError(
          errorMessage(
            result.error,
            ar
              ? "تعذر حفظ السجل. حاول مجدداً."
              : "Unable to save this record. Please try again.",
          ),
        );
    } catch {
      setError(
        ar
          ? "تعذر حفظ السجل. حاول مجدداً."
          : "Unable to save this record. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white disabled:opacity-60";
  return (
    <Modal
      isOpen
      onClose={close}
      title={
        resource === "support"
          ? ar
            ? "الرد على طلب الدعم"
            : "Reply to support request"
          : record
          ? ar
            ? "تعديل السجل"
            : "Edit record"
          : ar
            ? "إضافة سجل"
            : "Add record"
      }
      closeLabel={ar ? "إغلاق" : "Close"}
      maxWidth="2xl"
    >
      <form onSubmit={submit} className="space-y-5" dir={ar ? "rtl" : "ltr"}>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </p>
        )}
        {resource === "integrations" && (
          <p className="text-sm text-slate-500">
            {ar
              ? "تُحفظ بيانات الاتصال مشفرة. اترك الرمز فارغاً عند التعديل للإبقاء عليه."
              : "Credentials are encrypted. Leave token fields empty when editing to keep existing credentials."}
          </p>
        )}
        {resource === "settings" && (
          <div className="rounded-xl bg-violet-500/10 p-4">
            <p className="font-bold text-violet-800 dark:text-violet-200">
              {selectedSetting?.[ar ? "ar" : "en"] ??
                (ar ? "إعداد المنصة" : "Platform setting")}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {selectedSetting?.[ar ? "helpAr" : "helpEn"]}
            </p>
          </div>
        )}
        {resource === "support" && (
          <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                <MessageSquareReply className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-violet-900 dark:text-violet-100">
                  {ar ? "معالجة الطلب وإرسال رد رسمي" : "Process the request and send an official reply"}
                </p>
                <p className="mt-1 text-sm leading-6 text-violet-800/80 dark:text-violet-200/80">
                  {ar
                    ? "بيانات الطلب الأصلي للقراءة فقط. اكتب الرد في خانة الحل، ثم حدّث الحالة لتعرف الشركة أين وصل طلبها."
                    : "The original request is read-only. Write the response in the resolution field, then update the status so the company knows what happened."}
                </p>
              </div>
            </div>
          </div>
        )}
        {resource === "organizations" && (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100">
            <p className="font-bold">
              {ar ? "تحكم دقيق بميزات الشركة" : "Fine-grained company feature control"}
            </p>
            <p className="mt-1 leading-6 text-teal-800/80 dark:text-teal-200/80">
              {ar
                ? "تُضاف الميزات إلى ما تمنحه الباقة، بينما تُوقف الميزات المحددة حتى لو كانت موجودة في الباقة. هذه الاستثناءات تخص هذه الشركة فقط."
                : "Enabled features are added to the plan, while disabled features are removed even if the plan includes them. These overrides apply only to this company."}
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields[resource]
            .filter(
              (field) =>
                !(resource === "settings" && field.key === "key") &&
                (resource !== "integrations" ||
                  !["host", "port", "useTls"].includes(field.key) ||
                  values.provider === "SMTP"),
            )
            .map((field) => {
              const presentedField =
                resource === "settings" && field.key === "value" && selectedSetting
                  ? {
                      ...field,
                      en: selectedSetting.en,
                      ar: selectedSetting.ar,
                      type: selectedSetting.type ?? field.type,
                      options: selectedSetting.options ?? field.options,
                    }
                  : field;
              const label =
                resource === "support" && field.key === "resolution"
                  ? ar
                    ? "الرد والحل المقدم"
                    : "Response and resolution"
                  : resource === "support" && field.key === "status"
                    ? ar
                      ? "حالة الطلب"
                      : "Request status"
                    : ar
                      ? presentedField.ar
                      : presentedField.en;
              const disabled = busy || Boolean(record && field.immutable);
              const change = (value: string | boolean) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: value,
                  ...(field.key === "organizationId" && resource === "users"
                    ? { departmentId: "" }
                    : {}),
                }));
              if (presentedField.type === "checkbox")
                return (
                  <label
                    key={field.key}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800"
                  >
                    <input
                      name={field.key}
                      type="checkbox"
                      checked={Boolean(values[field.key])}
                      disabled={disabled}
                      onChange={(event) => change(event.target.checked)}
                      className="h-4 w-4 accent-violet-600"
                    />
                    {label}
                  </label>
                );
               let choices = presentedField.source
                 ? options[presentedField.source]
                 : (presentedField.options ?? []).map((option) => ({
                    id: option,
                     name:
                       resource === "settings" && field.key === "value"
                         ? option === "true"
                           ? ar
                             ? "مفعّل"
                             : "Enabled"
                           : option === "false"
                             ? ar
                               ? "موقوف"
                               : "Disabled"
                             : option === "ar"
                               ? ar
                                 ? "العربية"
                                 : "Arabic"
                               : option === "en"
                                 ? ar
                                   ? "الإنجليزية"
                                   : "English"
                                 : option
                         : option,
                  }));
              if (field.source === "departments")
                choices = options.departments.filter(
                  (option) => option.organizationId === values.organizationId,
                );
              const featureChoices =
                resource === "organizations" &&
                ["featureEnable", "featureDisable"].includes(field.key)
                  ? choices.map((option) => ({
                      ...option,
                      name:
                        planFeatureLabels[
                          option.id as keyof typeof planFeatureLabels
                        ]?.[ar ? "ar" : "en"] ?? option.name,
                    }))
                  : choices;
              return (
                <label
                  key={field.key}
                    className={`block text-sm font-semibold ${presentedField.type === "textarea" ? "sm:col-span-2" : ""}`}
                >
                  {label}
                  {presentedField.type === "select" ? (
                    <select
                      name={field.key}
                      required={field.required}
                      value={String(values[field.key])}
                      disabled={disabled}
                      onChange={(event) => change(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">{ar ? "اختر" : "Select"}</option>
                      {choices.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  ) : presentedField.type === "multi-select" ? (
                    <select
                      name={field.key}
                      multiple
                      size={6}
                      disabled={disabled}
                      value={String(values[field.key] || "")
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)}
                      onChange={(event) =>
                        change(
                          Array.from(event.target.selectedOptions)
                            .map((option) => option.value)
                            .join(", "),
                        )
                      }
                      className={inputClass + " min-h-40"}
                    >
                      {featureChoices.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  ) : presentedField.type === "textarea" ? (
                    <textarea
                      name={field.key}
                      rows={3}
                      value={String(values[field.key])}
                      disabled={disabled}
                      onChange={(event) => change(event.target.value)}
                      className={inputClass}
                    />
                  ) : (
                    <input
                      name={field.key}
                       type={presentedField.type ?? "text"}
                      required={
                        field.required || (!record && field.key === "password")
                      }
                       min={presentedField.type === "number" ? 0 : undefined}
                      step={
                         presentedField.type === "number"
                          ? ["monthlyPrice", "annualPrice"].includes(field.key)
                            ? "0.01"
                            : "1"
                          : undefined
                      }
                      minLength={
                         presentedField.type === "password" && field.key === "password"
                          ? 8
                          : undefined
                      }
                       inputMode={presentedField.type === "tel" ? "tel" : undefined}
                      dir={
                         presentedField.type === "tel" || presentedField.type === "email"
                          ? "ltr"
                          : undefined
                      }
                      placeholder={
                         presentedField.type === "tel" ? "+962790000000" : undefined
                      }
                      autoComplete={
                         presentedField.type === "password"
                          ? "new-password"
                           : presentedField.type === "tel"
                            ? "tel"
                            : undefined
                      }
                      value={String(values[field.key])}
                      disabled={disabled}
                      onChange={(event) => change(event.target.value)}
                      className={inputClass}
                    />
                  )}
                </label>
              );
            })}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            disabled={busy}
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? (
              ar ? "جارٍ إرسال الرد…" : "Sending reply…"
            ) : resource === "support" ? (
              <span className="inline-flex items-center gap-2">
                <Send className="h-4 w-4" />
                {ar ? "إرسال الرد وتحديث الطلب" : "Send reply and update"}
              </span>
            ) : ar ? "حفظ" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
