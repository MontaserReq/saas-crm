import type { Language } from "./translations";

const ARABIC_ERRORS: Array<[RegExp, string]> = [
  [
    /untrusted request origin/i,
    "عنوان الصفحة غير متطابق مع عنوان الخادم. أعد تحميل الصفحة ثم حاول رفع الشعار مرة أخرى.",
  ],
  [
    /invalid logo|allowed formats|logo must|no logo file|upload request exceeds/i,
    "ارفع شعارًا بصيغة PNG أو JPG أو WebP وبحجم لا يتجاوز 5MB.",
  ],
  [
    /forbidden|not authorized|permission/i,
    "ليس لديك صلاحية لتنفيذ هذه العملية.",
  ],
  [/invalid email|email address/i, "أدخل بريدًا إلكترونيًا صالحًا."],
  [
    /international phone|country code|phone number/i,
    "أدخل رقم هاتف دوليًا صالحًا متضمنًا رمز الدولة، مثل +962790000000.",
  ],
  [/required/i, "يرجى تعبئة الحقول المطلوبة."],
  [/not found/i, "السجل المطلوب غير موجود أو لم يعد متاحًا."],
  [/already exists|duplicate/i, "يوجد سجل مطابق مسبقًا."],
  [/approval/i, "تعذر معالجة طلب الموافقة. حاول مرة أخرى."],
  [
    /read-only|immutable|retained for history|owning workflow|policy is fixed/i,
    "هذه البيانات للقراءة فقط أو محفوظة كسجل تاريخي، ولا يمكن تعديلها من هذه الصفحة.",
  ],
  [/network|connection|fetch/i, "تعذر الاتصال بالخادم. حاول مرة أخرى."],
];

const ENGLISH_ERRORS: Array<[RegExp, string]> = [
  [
    /ليس لديك صلاحية|غير مصرح/,
    "You do not have permission to perform this action.",
  ],
  [/بريد.*صالح/, "Enter a valid email address."],
  [
    /رقم هاتف|رمز الدولة/,
    "Enter a valid international phone number including the country code.",
  ],
  [/الحقول المطلوبة|مطلوب/, "Complete the required fields."],
  [
    /غير موجود|لم يعد متاح/,
    "The requested record was not found or is no longer available.",
  ],
  [/موجود.*مسبق|مطابق/, "A matching record already exists."],
  [
    /للقراءة فقط|سجل تاريخي|لا يمكن تعديلها|ثابتة/,
    "This data is read-only or retained as history and cannot be changed from this page.",
  ],
  [/الاتصال|الخادم/, "Unable to connect to the server. Try again."],
];

const hasArabic = (value: string) => /[\u0600-\u06ff]/.test(value);
const hasLatin = (value: string) => /[A-Za-z]/.test(value);

/**
 * Converts server/service errors into one-language UI text. Unknown technical
 * messages deliberately fall back to a safe localized message rather than
 * leaking a different language (or implementation detail) into the screen.
 */
export function localizeErrorMessage(
  error: unknown,
  language: Language,
  fallback?: string,
): string {
  const raw = typeof error === "string" ? error.trim() : "";
  const rules = language === "ar" ? ARABIC_ERRORS : ENGLISH_ERRORS;
  const translated = rules.find(([pattern]) => pattern.test(raw))?.[1];
  if (translated) return translated;

  if (raw && (language === "ar" ? !hasLatin(raw) : !hasArabic(raw))) return raw;
  if (fallback) return fallback;
  return language === "ar"
    ? "تعذر إتمام العملية. تحقق من البيانات وحاول مرة أخرى."
    : "Unable to complete the operation. Check the details and try again.";
}
