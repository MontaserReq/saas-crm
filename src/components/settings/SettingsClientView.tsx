"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  FileText,
  FolderOpen,
  Globe,
  ImageIcon,
  Link2,
  Mail,
  MapPin,
  Moon,
  Palette,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  Settings,
  Sun,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import {
  archiveCustomFieldAction,
  createCustomFieldAction,
  updateOrganizationConfigurationAction,
  updateOrganizationListsAction,
} from "@/server/actions/configuration";
import { DEFAULT_BRAND_COLOR } from "@/lib/branding";

type Props = {
  config: any;
  fields: any[];
  customFieldEntities: string[];
  canUseCustomFields: boolean;
  canConfigureClients: boolean;
  canConfigureLeads: boolean;
  canManageApprovals: boolean;
};

const colors = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#334155",
];
const timezones = [
  ["Asia/Amman", "عمّان"],
  ["Asia/Riyadh", "الرياض"],
  ["Asia/Dubai", "دبي"],
  ["Asia/Qatar", "الدوحة"],
  ["Asia/Kuwait", "الكويت"],
  ["Asia/Beirut", "بيروت"],
  ["Asia/Baghdad", "بغداد"],
  ["Africa/Cairo", "القاهرة"],
  ["Europe/London", "لندن"],
  ["Europe/Paris", "باريس"],
  ["America/New_York", "نيويورك"],
  ["UTC", "التوقيت العالمي"],
] as const;
const currencies = [
  ["JOD", "دينار أردني"],
  ["SAR", "ريال سعودي"],
  ["AED", "درهم إماراتي"],
  ["USD", "دولار أمريكي"],
  ["EUR", "يورو"],
  ["GBP", "جنيه إسترليني"],
  ["QAR", "ريال قطري"],
  ["KWD", "دينار كويتي"],
  ["EGP", "جنيه مصري"],
] as const;
const dateFormats = [
  ["dd/MM/yyyy", "31/12/2026"],
  ["yyyy-MM-dd", "2026-12-31"],
  ["MM/dd/yyyy", "12/31/2026"],
  ["dd MMM yyyy", "31 ديسمبر 2026"],
] as const;
const entityLabels: Record<string, [string, string]> = {
  CLIENT: ["العملاء", "Clients"],
  LEAD: ["العملاء المحتملون", "Leads"],
  CONTACT: ["جهات الاتصال", "Contacts"],
  DEAL: ["الصفقات", "Deals"],
  TICKET: ["التذاكر", "Tickets"],
  TASK: ["المهام", "Tasks"],
};
const fieldTypeLabels: Record<string, [string, string]> = {
  TEXT: ["نص قصير", "Short text"],
  TEXTAREA: ["نص طويل", "Long text"],
  NUMBER: ["رقم", "Number"],
  CURRENCY: ["مبلغ مالي", "Currency"],
  BOOLEAN: ["نعم / لا", "Yes / No"],
  DATE: ["تاريخ", "Date"],
  DATETIME: ["تاريخ ووقت", "Date and time"],
  EMAIL: ["بريد إلكتروني", "Email"],
  PHONE: ["رقم هاتف", "Phone"],
  URL: ["رابط", "URL"],
  SELECT: ["قائمة اختيار", "Single select"],
  MULTI_SELECT: ["اختيارات متعددة", "Multi-select"],
};
const valueLabels: Record<string, [string, string]> = {
  SCHOOL: ["عميل", "Customer"],
  COMPANY: ["شركة", "Company"],
  NGO: ["منظمة غير ربحية", "NGO"],
  UNIVERSITY: ["جامعة", "University"],
  GOVERNMENT: ["جهة حكومية", "Government"],
  INDIVIDUAL: ["فرد", "Individual"],
  OTHER: ["أخرى", "Other"],
  NEW: ["جديد", "New"],
  CONTACTED: ["تم التواصل", "Contacted"],
  QUALIFIED: ["مؤهل", "Qualified"],
  UNQUALIFIED: ["غير مؤهل", "Unqualified"],
  CONVERTED: ["تم التحويل", "Converted"],
  LOST: ["مفقود", "Lost"],
};

const clientTypeOptions = [
  "SCHOOL",
  "COMPANY",
  "NGO",
  "UNIVERSITY",
  "GOVERNMENT",
  "INDIVIDUAL",
  "OTHER",
];
const leadStatusOptions = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "UNQUALIFIED",
  "CONVERTED",
  "LOST",
];

function TagEditor({
  values,
  onChange,
  label,
  choices,
  arabic,
  allowCustom = false,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
  choices: string[];
  arabic: boolean;
  allowCustom?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const remaining = choices.filter((value) => !values.includes(value));
  const addCustom = () => {
    const value = draft.trim().replace(/\s+/g, " ");
    if (
      value &&
      !values.some(
        (item) => item.toLocaleLowerCase() === value.toLocaleLowerCase(),
      )
    )
      onChange([...values, value]);
    setDraft("");
  };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200"
          >
            {valueLabels[value]?.[arabic ? 0 : 1] || value.replaceAll("_", " ")}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`${arabic ? "حذف" : "Remove"} ${value}`}
              className="rounded-full p-0.5 hover:bg-black/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      {remaining.length > 0 && (
        <select
          value=""
          onChange={(event) =>
            event.target.value && onChange([...values, event.target.value])
          }
          className="w-full rounded-xl border bg-transparent p-2.5 text-sm"
        >
          <option value="">
            {arabic ? "اختر عنصراً لإضافته" : "Choose an item to add"}
          </option>
          {remaining.map((value) => (
            <option key={value} value={value}>
              {valueLabels[value]?.[arabic ? 0 : 1] || value}
            </option>
          ))}
        </select>
      )}
      {allowCustom && (
        <div className="flex gap-2">
          <input
            value={draft}
            maxLength={40}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder={
              arabic ? "اكتب نوع عميل مخصص" : "Add a custom client type"
            }
            className="min-w-0 flex-1 rounded-xl border bg-transparent p-2.5 text-sm"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!draft.trim()}
            className="rounded-xl border px-3 text-sm font-bold disabled:opacity-50"
          >
            {arabic ? "إضافة" : "Add"}
          </button>
        </div>
      )}
    </fieldset>
  );
}

function OptionEditor({
  values,
  onChange,
  arabic,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  arabic: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (value && !values.includes(value)) onChange([...values, value]);
    setDraft("");
  };
  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="text-sm font-bold">
        {arabic ? "خيارات القائمة" : "List options"}
      </label>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs dark:bg-slate-800"
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={
            arabic ? "اكتب خياراً ثم اضغط إضافة" : "Type an option, then add"
          }
          className="min-w-0 flex-1 rounded-xl border bg-transparent p-2.5 text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-xl border px-3 text-sm font-bold"
        >
          {arabic ? "إضافة" : "Add"}
        </button>
      </div>
    </div>
  );
}

export function SettingsClientView({
  config,
  fields,
  customFieldEntities,
  canUseCustomFields,
  canConfigureClients,
  canConfigureLeads,
  canManageApprovals,
}: Props) {
  const router = useRouter();
  const { language, setLanguage, errorMessage } = useI18n();
  const { theme, setTheme } = useTheme();
  const arabic = language === "ar";
  const [label, setLabel] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [entityType, setEntityType] = useState(
    customFieldEntities[0] || "CLIENT",
  );
  const [fieldType, setFieldType] = useState("TEXT");
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<string[]>(config.settings.clientTypes);
  const [statuses, setStatuses] = useState<string[]>(
    config.settings.leadStatuses,
  );
  const [approvalRules, setApprovalRules] = useState<
    Record<string, Record<string, boolean>>
  >(config.settings.approvalRules || {});
  const [primaryColor, setPrimaryColor] = useState(
    config.organization.primaryColor || DEFAULT_BRAND_COLOR,
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(
    config.organization.logoKey
      ? `/api/organization/logo?v=${encodeURIComponent(String(config.organization.updatedAt))}`
      : null,
  );
  const [logoBusy, setLogoBusy] = useState(false);
  const [invoiceShowLogo, setInvoiceShowLogo] = useState(
    config.organization.invoiceShowLogo !== false,
  );
  const [invoiceShowCompanyDetails, setInvoiceShowCompanyDetails] = useState(
    config.organization.invoiceShowCompanyDetails !== false,
  );
  const [invoiceShowTaxNumber, setInvoiceShowTaxNumber] = useState(
    config.organization.invoiceShowTaxNumber !== false,
  );
  const [invoiceLegalName, setInvoiceLegalName] = useState(
    config.organization.legalName || config.organization.name,
  );
  const [invoicePrefix, setInvoicePrefix] = useState(
    config.organization.invoicePrefix || "INV",
  );
  const [invoiceTaxNumber, setInvoiceTaxNumber] = useState(
    config.organization.taxNumber || "",
  );
  const copy = (ar: string, en: string) => (arabic ? ar : en);
  const control =
    "mt-1.5 w-full rounded-xl border bg-white p-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 dark:bg-slate-950";

  const showResult = (
    success: boolean,
    successText: string,
    error?: string,
  ) => {
    setMessageError(!success);
    setMessage(
      success
        ? successText
        : errorMessage(
            error,
            copy(
              "تعذّر حفظ التغييرات. تحقق من البيانات وحاول مرة أخرى.",
              "Unable to save changes.",
            ),
          ),
    );
  };

  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );

  function chooseLogo(file: File | null) {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setLogoFile(null);
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      showResult(
        false,
        "",
        copy(
          "نوع الصورة غير مدعوم. استخدم PNG أو JPG أو WebP.",
          "Unsupported image type. Use PNG, JPG, or WebP.",
        ),
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showResult(
        false,
        "",
        copy("حجم الشعار يجب ألا يتجاوز 5MB.", "The logo must not exceed 5MB."),
      );
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo() {
    if (!logoFile || logoBusy) return;
    setLogoBusy(true);
    try {
      const body = new FormData();
      body.append("logo", logoFile);
      const response = await fetch("/api/organization/logo", {
        method: "POST",
        body,
      });
      const result = await response.json().catch(() => ({
        success: false,
        error: copy("تعذر رفع الشعار.", "Unable to upload logo."),
      }));
      showResult(
        Boolean(response.ok && result.success),
        copy("تم تحديث شعار الشركة.", "Company logo updated."),
        result.error,
      );
      if (response.ok && result.success) {
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoFile(null);
        setLogoPreview(null);
        setLogoUrl(`/api/organization/logo?v=${Date.now()}`);
        router.refresh();
      }
    } catch {
      showResult(false, "", copy("تعذر رفع الشعار.", "Unable to upload logo."));
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    if (!logoUrl || logoBusy) return;
    setLogoBusy(true);
    try {
      const response = await fetch("/api/organization/logo", {
        method: "DELETE",
      });
      const result = await response.json().catch(() => ({
        success: false,
        error: copy("تعذر حذف الشعار.", "Unable to remove logo."),
      }));
      showResult(
        Boolean(response.ok && result.success),
        copy("تم حذف شعار الشركة.", "Company logo removed."),
        result.error,
      );
      if (response.ok && result.success) {
        setLogoUrl(null);
        router.refresh();
      }
    } catch {
      showResult(false, "", copy("تعذر حذف الشعار.", "Unable to remove logo."));
    } finally {
      setLogoBusy(false);
    }
  }

  async function addField(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const generatedKey = `field_${Date.now().toString(36)}`;
    const result = await createCustomFieldAction({
      entityType: entityType as any,
      fieldType: fieldType as any,
      label,
      key: generatedKey,
      options,
    });
    showResult(
      result.success,
      copy("تمت إضافة الحقل المخصص.", "Custom field added."),
      result.error,
    );
    if (result.success) {
      setLabel("");
      setOptions([]);
      router.refresh();
    }
    setSaving(false);
  }

  async function saveLists() {
    setSaving(true);
    const result = await updateOrganizationListsAction({
      ...(canConfigureClients ? { clientTypes: types } : {}),
      ...(canConfigureLeads ? { leadStatuses: statuses } : {}),
    });
    showResult(
      result.success,
      copy("تم حفظ قوائم إدارة العملاء.", "CRM lists saved."),
      result.error,
    );
    setSaving(false);
  }

  async function saveApprovalRules() {
    setSaving(true);
    const result = await updateOrganizationListsAction({
      approvalRules: approvalRules as any,
    });
    showResult(
      result.success,
      copy("تم حفظ قواعد الموافقات.", "Approval rules saved."),
      result.error,
    );
    setSaving(false);
  }

  async function saveOrg(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const result = await updateOrganizationConfigurationAction({
      name: String(data.name),
      primaryColor,
      timezone: String(data.timezone),
      currency: String(data.currency),
      dateFormat: String(data.dateFormat),
      language: String(data.language),
    });
    showResult(
      result.success,
      copy("تم حفظ إعدادات المؤسسة.", "Organization settings saved."),
      result.error,
    );
    if (result.success) router.refresh();
    setSaving(false);
  }

  async function saveInvoiceIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await updateOrganizationConfigurationAction({
      legalName: String(data.legalName || ""),
      taxNumber: String(data.taxNumber || ""),
      invoicePrefix: String(data.invoicePrefix || "INV"),
      invoiceFooter: String(data.invoiceFooter || ""),
      paymentInstructions: String(data.paymentInstructions || ""),
      invoiceShowLogo,
      invoiceShowCompanyDetails,
      invoiceShowTaxNumber,
    });
    showResult(
      result.success,
      copy("تم حفظ هوية الفواتير والعروض.", "Invoice and proposal identity saved."),
      result.error,
    );
    if (result.success) router.refresh();
    setSaving(false);
  }

  async function saveContactInfo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await updateOrganizationConfigurationAction({
      contactEmail: String(data.contactEmail || ""),
      contactPhone: String(data.contactPhone || ""),
      website: String(data.website || ""),
      address: String(data.address || ""),
    });
    showResult(
      result.success,
      copy("تم حفظ بيانات التواصل.", "Contact details saved."),
      result.error,
    );
    if (result.success) router.refresh();
    setSaving(false);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6" dir={arabic ? "rtl" : "ltr"}>
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Settings className="h-6 w-6 text-brand-600" />
          {copy("الإعدادات والتفضيلات", "Settings & preferences")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {copy(
            "خصّص بيانات مؤسستك وطريقة ظهور النظام لفريقك.",
            "Customize your organization details and how the system appears to your team.",
          )}
        </p>
      </header>

      {message && (
        <div
          role="status"
          className={`rounded-xl p-3 text-sm ${messageError ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"}`}
        >
          {message}
        </div>
      )}

      <form
        onSubmit={saveOrg}
        className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6"
      >
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Building2 className="h-5 w-5 text-brand-600" />
            {copy("إعدادات المؤسسة", "Organization settings")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {copy(
              "البيانات الأساسية التي تظهر في مساحة العمل.",
              "Core details used across your workspace.",
            )}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">
            {copy("اسم المؤسسة", "Organization name")}
            <input
              name="name"
              required
              defaultValue={config.organization.name}
              className={control}
            />
          </label>
          <label className="text-sm font-bold">
            {copy("اللغة الافتراضية", "Default language")}
            <select
              name="language"
              defaultValue={config.organization.language}
              className={control}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            {copy("المنطقة الزمنية", "Time zone")}
            <select
              name="timezone"
              defaultValue={config.organization.timezone}
              className={control}
            >
              {!timezones.some(
                ([value]) => value === config.organization.timezone,
              ) && (
                <option value={config.organization.timezone}>
                  {config.organization.timezone}
                </option>
              )}
              {timezones.map(([value, city]) => (
                <option key={value} value={value}>
                  {arabic ? city : `${city} — ${value}`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            {copy("العملة", "Currency")}
            <select
              name="currency"
              defaultValue={config.organization.currency}
              className={control}
            >
              {!currencies.some(
                ([value]) => value === config.organization.currency,
              ) && (
                <option value={config.organization.currency}>
                  {config.organization.currency}
                </option>
              )}
              {currencies.map(([value, name]) => (
                <option key={value} value={value}>
                  {arabic ? `${name} (${value})` : value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-brand-600" />
              {copy("تنسيق التاريخ", "Date format")}
            </span>
            <select
              name="dateFormat"
              defaultValue={config.settings.dateFormat}
              className={control}
            >
              {!dateFormats.some(
                ([value]) => value === config.settings.dateFormat,
              ) && (
                <option value={config.settings.dateFormat}>
                  {config.settings.dateFormat}
                </option>
              )}
              {dateFormats.map(([value, sample]) => (
                <option key={value} value={value}>
                  {sample}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="flex items-center gap-1.5 text-sm font-bold">
              <Palette className="h-4 w-4 text-brand-600" />
              {copy("لون الهوية", "Brand color")}
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className="relative flex h-10 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-xl border"
                style={{ backgroundColor: primaryColor }}
                title={copy("اختيار لون مخصص", "Choose a custom color")}
              >
                <input
                  name="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="sr-only">
                  {copy("اختيار لون مخصص", "Choose a custom color")}
                </span>
              </label>
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setPrimaryColor(color)}
                  aria-label={`${copy("اختيار اللون", "Choose color")} ${color}`}
                  className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${primaryColor === color ? "border-slate-900 ring-2 ring-brand-300 dark:border-white" : "border-white dark:border-slate-700"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-3 rounded-2xl border p-4 sm:col-span-2">
            <legend className="flex items-center gap-1.5 px-2 text-sm font-bold">
              <ImageIcon className="h-4 w-4 text-brand-600" />
              {copy("شعار الشركة", "Company logo")}
            </legend>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-slate-50 dark:bg-slate-950">
                {logoPreview || logoUrl ? (
                  <Image
                    src={logoPreview || logoUrl!}
                    alt={copy("معاينة شعار الشركة", "Company logo preview")}
                    width={160}
                    height={96}
                    unoptimized
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <ImageIcon className="h-7 w-7" />
                    <span className="text-xs">
                      {copy("لا يوجد شعار", "No logo")}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={(event) =>
                    chooseLogo(event.target.files?.[0] || null)
                  }
                  className="block w-full text-sm file:me-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:font-bold file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-950/50 dark:file:text-brand-200"
                />
                <p className="text-xs text-slate-500">
                  {copy(
                    "اختر PNG أو JPG أو WebP من جهازك، بحد أقصى 5MB.",
                    "Choose a PNG, JPG, or WebP image from your device, up to 5MB.",
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!logoFile || logoBusy}
                    onClick={uploadLogo}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {logoBusy
                      ? copy("جاري الحفظ...", "Saving...")
                      : copy("رفع الشعار", "Upload logo")}
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      disabled={logoBusy}
                      onClick={removeLogo}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 disabled:opacity-50 dark:border-rose-900"
                    >
                      <Trash2 className="h-4 w-4" />
                      {copy("حذف الشعار", "Remove logo")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </fieldset>
        </div>
        <button
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving
            ? copy("جاري الحفظ...", "Saving...")
            : copy("حفظ إعدادات المؤسسة", "Save organization settings")}
        </button>
      </form>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-slate-900">
        <div className="border-b bg-gradient-to-l from-brand-50 via-white to-white p-5 dark:border-slate-800 dark:from-brand-950/30 dark:via-slate-900 dark:to-slate-900 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-200">
              <ReceiptText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">
                {copy("هوية الفواتير والعروض", "Invoice & proposal identity")}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                {copy(
                  "حدد كيف تظهر شركتك عند إنشاء الفواتير والعروض، مع معاينة واضحة قبل الحفظ.",
                  "Control how your company appears on invoices and proposals, with a clear preview before saving.",
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form onSubmit={saveInvoiceIdentity} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                {copy("الاسم الظاهر على المستند", "Document display name")}
                <input
                  name="legalName"
                  value={invoiceLegalName}
                  onChange={(event) => setInvoiceLegalName(event.target.value)}
                  placeholder={config.organization.name}
                  className={control}
                />
              </label>
              <label className="text-sm font-bold">
                {copy("الرقم الضريبي", "Tax number")}
                <input
                  name="taxNumber"
                  value={invoiceTaxNumber}
                  onChange={(event) => setInvoiceTaxNumber(event.target.value)}
                  placeholder={copy("مثال: ٣٠٠٠١٢٣٤٥", "e.g. 300012345")}
                  className={control}
                />
              </label>
              <label className="text-sm font-bold sm:max-w-[220px]">
                {copy("بادئة رقم الفاتورة", "Invoice number prefix")}
                <input
                  name="invoicePrefix"
                  required
                  maxLength={10}
                  value={invoicePrefix}
                  onChange={(event) => setInvoicePrefix(event.target.value.toUpperCase())}
                  className={`${control} uppercase`}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {copy("مثال: INV-0001", "Example: INV-0001")}
                </span>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                {copy("ملاحظة أسفل الفاتورة", "Invoice footer note")}
                <textarea
                  name="invoiceFooter"
                  defaultValue={config.organization.invoiceFooter || ""}
                  rows={3}
                  maxLength={500}
                  placeholder={copy("شكرًا لتعاملكم معنا.", "Thank you for your business.")}
                  className={control}
                />
              </label>
              <label className="text-sm font-bold">
                {copy("تعليمات الدفع", "Payment instructions")}
                <textarea
                  name="paymentInstructions"
                  defaultValue={config.organization.paymentInstructions || ""}
                  rows={3}
                  maxLength={1000}
                  placeholder={copy("تحول الدفعات إلى الحساب البنكي الموضح.", "Please use the bank details provided for payment.")}
                  className={control}
                />
              </label>
            </div>
            <div className="grid gap-2 rounded-2xl border bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-3">
              {[
                [invoiceShowLogo, setInvoiceShowLogo, copy("إظهار الشعار", "Show logo")],
                [invoiceShowCompanyDetails, setInvoiceShowCompanyDetails, copy("إظهار بيانات الشركة", "Show company details")],
                [invoiceShowTaxNumber, setInvoiceShowTaxNumber, copy("إظهار الرقم الضريبي", "Show tax number")],
              ].map(([checked, setter, labelText]) => (
                <label key={String(labelText)} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-white dark:hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    onChange={(event) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {labelText as string}
                </label>
              ))}
            </div>
            <button
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? copy("جاري الحفظ...", "Saving...") : copy("حفظ هوية المستندات", "Save document identity")}
            </button>
          </form>

          <div className="rounded-2xl border bg-slate-100/80 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <span>{copy("معاينة", "Preview")}</span>
              <span>{invoicePrefix || "INV"}-0001</span>
            </div>
            <div className="min-h-[292px] rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3 border-b pb-4 dark:border-slate-700">
                {invoiceShowLogo && (logoPreview || logoUrl) ? (
                  <Image src={logoPreview || logoUrl!} alt="" width={92} height={42} unoptimized className="h-9 w-20 object-contain object-start" />
                ) : (
                  <div className="h-9 w-20 rounded-lg" style={{ backgroundColor: primaryColor }} />
                )}
                <div className="text-end">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy("فاتورة", "Invoice")}</p>
                  <p className="mt-1 text-xs font-black" style={{ color: primaryColor }}>{invoicePrefix || "INV"}-0001</p>
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-sm font-black">{invoiceLegalName || config.organization.name}</p>
                {invoiceShowTaxNumber && invoiceTaxNumber && <p className="text-[10px] text-slate-500">{copy("الرقم الضريبي", "Tax number")}: {invoiceTaxNumber}</p>}
                {invoiceShowCompanyDetails && <p className="text-[10px] text-slate-500">{config.organization.contactEmail || config.organization.contactPhone || copy("بيانات التواصل", "Contact details")}</p>}
              </div>
              <div className="mt-5 space-y-2">
                {["استشارة وتخطيط", "تنفيذ المشروع"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between border-b border-dashed py-1.5 text-[10px] dark:border-slate-700">
                    <span className="text-slate-500">{arabic ? item : index === 0 ? "Consulting & planning" : "Project delivery"}</span>
                    <span className="font-bold">{index === 0 ? "150.00" : "850.00"} {config.organization.currency}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-black text-white" style={{ backgroundColor: primaryColor }}>
                <span>{copy("الإجمالي", "Total")}</span><span>1,000.00 {config.organization.currency}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <form onSubmit={saveContactInfo} className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Building2 className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-bold">{copy("بيانات التواصل والشركة", "Company & contact details")}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{copy("تظهر هذه البيانات في الفواتير ومراسلات العملاء.", "These details appear on invoices and customer communications.")}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold"><span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-brand-600" />{copy("البريد الإلكتروني", "Email")}</span><input name="contactEmail" type="email" defaultValue={config.organization.contactEmail || ""} className={control} /></label>
            <label className="text-sm font-bold"><span className="flex items-center gap-1.5"><WalletCards className="h-4 w-4 text-brand-600" />{copy("رقم الهاتف", "Phone")}</span><input name="contactPhone" defaultValue={config.organization.contactPhone || ""} className={control} /></label>
            <label className="text-sm font-bold sm:col-span-2"><span className="flex items-center gap-1.5"><Link2 className="h-4 w-4 text-brand-600" />{copy("الموقع الإلكتروني", "Website")}</span><input name="website" type="url" placeholder="https://" defaultValue={config.organization.website || ""} className={control} /></label>
            <label className="text-sm font-bold sm:col-span-2"><span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand-600" />{copy("العنوان", "Address")}</span><textarea name="address" rows={2} defaultValue={config.organization.address || ""} className={control} /></label>
          </div>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? copy("جاري الحفظ...", "Saving...") : copy("حفظ بيانات التواصل", "Save contact details")}</button>
        </form>

        <section className="rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"><FolderOpen className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-bold">{copy("الملفات والمستندات", "Files & documents")}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{copy("نظّم ملفات الشركة وقوالب العروض من مكان واحد.", "Keep company files and proposal templates organized in one place.")}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <Link href="/documents" className="group flex items-center justify-between rounded-2xl border p-4 transition hover:border-brand-300 hover:bg-brand-50/60 dark:hover:border-brand-700 dark:hover:bg-brand-950/20">
              <span className="flex items-center gap-3"><span className="rounded-xl bg-brand-50 p-2.5 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200"><FileText className="h-4 w-4" /></span><span><b className="block text-sm">{copy("مستندات مساحة العمل", "Workspace documents")}</b><small className="mt-0.5 block text-xs text-slate-500">{copy("ملاحظات وإجراءات وملفات الفريق", "Notes, playbooks, and team files")}</small></span></span><ChevronLeft className="h-4 w-4 text-slate-400 transition group-hover:-translate-x-1" />
            </Link>
            <Link href="/proposals" className="group flex items-center justify-between rounded-2xl border p-4 transition hover:border-brand-300 hover:bg-brand-50/60 dark:hover:border-brand-700 dark:hover:bg-brand-950/20">
              <span className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-2.5 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200"><ReceiptText className="h-4 w-4" /></span><span><b className="block text-sm">{copy("قوالب العروض", "Proposal templates")}</b><small className="mt-0.5 block text-xs text-slate-500">{copy("ملفات PDF جاهزة بهوية الشركة", "PDF templates with your company identity")}</small></span></span><ChevronLeft className="h-4 w-4 text-slate-400 transition group-hover:-translate-x-1" />
            </Link>
          </div>
        </section>
      </div>

      <section className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Globe className="h-5 w-5 text-brand-600" />
          {copy("تفضيلات الواجهة", "Interface preferences")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-2xl border p-4">
            <p className="text-sm font-bold">
              {copy("لغة عرض الواجهة", "Display language")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLanguage("ar")}
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${language === "ar" ? "bg-brand-600 text-white" : "border"}`}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${language === "en" ? "bg-brand-600 text-white" : "border"}`}
              >
                English
              </button>
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border p-4">
            <p className="text-sm font-bold">{copy("المظهر", "Appearance")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2 text-sm font-bold ${theme === "light" ? "border-brand-500 bg-brand-50 dark:bg-brand-950/40" : ""}`}
              >
                <Sun className="h-4 w-4" />
                {copy("فاتح", "Light")}
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2 text-sm font-bold ${theme === "dark" ? "border-brand-500 bg-brand-50 dark:bg-brand-950/40" : ""}`}
              >
                <Moon className="h-4 w-4" />
                {copy("داكن", "Dark")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {(canUseCustomFields || canConfigureClients || canConfigureLeads) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {canUseCustomFields && (
            <form
              onSubmit={addField}
              className="space-y-4 rounded-3xl border bg-white p-5 dark:bg-slate-900 sm:p-6"
            >
              <div>
                <h2 className="text-lg font-bold">
                  {copy("الحقول المخصصة", "Custom fields")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {copy(
                    "أضف بيانات تناسب طريقة عمل مؤسستك.",
                    "Add data fields that match your workflow.",
                  )}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold sm:col-span-2">
                  {copy("اسم الحقل", "Field label")}
                  <input
                    required
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={copy(
                      "مثال: مصدر العميل",
                      "Example: Lead source",
                    )}
                    className={control}
                  />
                </label>
                <label className="text-sm font-bold">
                  {copy("يظهر في", "Record type")}
                  <select
                    value={entityType}
                    onChange={(event) => setEntityType(event.target.value)}
                    className={control}
                  >
                    {customFieldEntities.map((value) => (
                      <option key={value} value={value}>
                        {entityLabels[value]?.[arabic ? 0 : 1] || value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold">
                  {copy("نوع الحقل", "Field type")}
                  <select
                    value={fieldType}
                    onChange={(event) => {
                      setFieldType(event.target.value);
                      setOptions([]);
                    }}
                    className={control}
                  >
                    {Object.entries(fieldTypeLabels).map(([value, names]) => (
                      <option key={value} value={value}>
                        {names[arabic ? 0 : 1]}
                      </option>
                    ))}
                  </select>
                </label>
                {["SELECT", "MULTI_SELECT"].includes(fieldType) && (
                  <OptionEditor
                    values={options}
                    onChange={setOptions}
                    arabic={arabic}
                  />
                )}
              </div>
              <button
                disabled={
                  saving ||
                  (["SELECT", "MULTI_SELECT"].includes(fieldType) &&
                    !options.length)
                }
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {copy("إضافة الحقل", "Add field")}
              </button>
              <div className="space-y-2">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                  >
                    <span className="min-w-0">
                      <b className="block truncate">{field.label}</b>
                      <span className="text-xs text-slate-500">
                        {entityLabels[field.entityType]?.[arabic ? 0 : 1] ||
                          field.entityType}{" "}
                        ·{" "}
                        {fieldTypeLabels[field.fieldType]?.[arabic ? 0 : 1] ||
                          field.fieldType}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const result = await archiveCustomFieldAction(field.id);
                        showResult(
                          result.success,
                          copy("تمت أرشفة الحقل.", "Field archived."),
                          result.error,
                        );
                        if (result.success) router.refresh();
                      }}
                      className="shrink-0 text-xs font-bold text-red-600"
                    >
                      {copy("أرشفة", "Archive")}
                    </button>
                  </div>
                ))}
              </div>
            </form>
          )}
          {(canConfigureClients || canConfigureLeads) && (
            <section className="space-y-5 rounded-3xl border bg-white p-5 dark:bg-slate-900 sm:p-6">
              <div>
                <h2 className="text-lg font-bold">
                  {copy("قوائم إدارة العملاء", "CRM lists")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {copy(
                    "أضف العناصر أو احذفها مباشرة.",
                    "Add or remove list items directly.",
                  )}
                </p>
              </div>
              {canConfigureClients && (
                <TagEditor
                  values={types}
                  onChange={setTypes}
                  label={copy("أنواع العملاء", "Client types")}
                  choices={clientTypeOptions}
                  arabic={arabic}
                  allowCustom
                />
              )}
              {canConfigureLeads && (
                <TagEditor
                  values={statuses}
                  onChange={setStatuses}
                  label={copy("حالات العملاء المحتملين", "Lead statuses")}
                  choices={leadStatusOptions}
                  arabic={arabic}
                />
              )}
              <button
                type="button"
                disabled={saving}
                onClick={saveLists}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {copy("حفظ القوائم", "Save lists")}
              </button>
            </section>
          )}
        </div>
      )}
      {canManageApprovals && (
        <section className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              {copy("قواعد الموافقات", "Approval rules")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {copy(
                "فعّل الموافقة قبل الإنشاء أو التعديل أو الحذف. مسؤول الشركة الأعلى ينفّذ مباشرة ويعتمد طلبات الفريق.",
                "Require approval before create, update, or delete. Company super admins act directly and decide team requests.",
              )}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="p-3 text-start">{copy("السجل", "Record")}</th>
                  {[
                    ["CREATE", "إنشاء", "Create"],
                    ["UPDATE", "تعديل", "Update"],
                    ["DELETE", "حذف", "Delete"],
                  ].map(([operation, ar, en]) => (
                    <th key={operation} className="p-3 text-center">
                      {copy(ar, en)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {[
                  ["CLIENT", "العملاء", "Clients"],
                  ["LEAD", "العملاء المحتملون", "Leads"],
                  ["CONTACT", "جهات الاتصال", "Contacts"],
                  ["DEAL", "الصفقات", "Deals"],
                  ["TASK", "المهام", "Tasks"],
                  ["CALENDAR_EVENT", "التقويم", "Calendar"],
                  ["DEPARTMENT", "الأقسام", "Departments"],
                ].map(([resource, ar, en]) => (
                  <tr key={resource}>
                    <td className="p-3 font-semibold">{copy(ar, en)}</td>
                    {["CREATE", "UPDATE", "DELETE"].map((operation) => (
                      <td key={operation} className="p-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${resource} ${operation}`}
                          checked={Boolean(
                            approvalRules[resource]?.[operation],
                          )}
                          onChange={(event) =>
                            setApprovalRules((current) => ({
                              ...current,
                              [resource]: {
                                ...current[resource],
                                [operation]: event.target.checked,
                              },
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={saveApprovalRules}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {copy("حفظ قواعد الموافقات", "Save approval rules")}
          </button>
        </section>
      )}
    </main>
  );
}
