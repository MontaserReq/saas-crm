export type SchoolImportField = 'name' | 'contactPerson' | 'city' | 'classification' | 'phone' | 'email';
export type ResolvedImportColumn = { header: string; index: number };
export type IgnoredImportColumn = ResolvedImportColumn & { ignored: true };

export const SCHOOL_IMPORT_FIELDS: SchoolImportField[] = ['name', 'contactPerson', 'city', 'classification', 'phone', 'email'];
export const REQUIRED_SCHOOL_IMPORT_FIELDS: SchoolImportField[] = ['name'];
export const IGNORED_SCHOOL_IMPORT_ALIASES = ['نتيجة آخر تواصل / تفاصيل المكالمات', 'نتيجة آخر تواصل', 'تفاصيل المكالمات', 'Last Contact Result / Call Details', 'Last Contact Result', 'Last Contact Details', 'Call Details', 'Contact Result', 'Contact Details', 'حالة المدرسة', 'الحالة', 'School Status', 'Status'];
export const SCHOOL_IMPORT_ALIASES: Record<SchoolImportField, string[]> = {
  name: ['اسم المدرسة', 'اسم المدرسة الرسمي', 'School Name', 'School'],
  contactPerson: ['اسم المتابع', 'الموظف المسؤول', 'المسؤول', 'Contact Person', 'Responsible Employee', 'Employee', 'Assigned Employee'],
  city: ['المنطقة / المدينة', 'المنطقة/المدينة', 'المنطقة', 'المدينة', 'Area / City', 'Area/City', 'Area', 'City'],
  classification: ['فئة المدرسة', 'تصنيف المدرسة', 'School Classification', 'Classification', 'School Class'],
  phone: ['رقم الهاتف', 'الهاتف', 'Phone', 'Phone Number', 'Telephone'],
  email: ['البريد الإلكتروني', 'البريد الالكتروني', 'الإيميل', 'Email', 'E-mail', 'Email Address'],
};

export function normalizeImportHeader(value: unknown): string {
  return String(value ?? '').replace(/^\uFEFF/, '').normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
}
const normalizedAliases = Object.fromEntries(SCHOOL_IMPORT_FIELDS.map((field) => [field, new Set(SCHOOL_IMPORT_ALIASES[field].map(normalizeImportHeader))])) as Record<SchoolImportField, Set<string>>;
const normalizedIgnoredAliases = new Set(IGNORED_SCHOOL_IMPORT_ALIASES.map(normalizeImportHeader));

export function resolveImportHeaders(headers: string[]) {
  const mapped = new Map<SchoolImportField, ResolvedImportColumn>();
  const ignored = new Map<string, IgnoredImportColumn>();
  const duplicates: string[] = [];
  headers.forEach((header, index) => {
    const normalized = normalizeImportHeader(header);
    if (normalizedIgnoredAliases.has(normalized)) { ignored.set(header, { header, index, ignored: true }); return; }
    const field = SCHOOL_IMPORT_FIELDS.find((candidate) => normalizedAliases[candidate].has(normalized));
    if (!field) return;
    if (mapped.has(field)) duplicates.push(header); else mapped.set(field, { header, index });
  });
  return { mapped, ignored, duplicates, missingRequired: REQUIRED_SCHOOL_IMPORT_FIELDS.filter((field) => !mapped.has(field)), missingOptional: SCHOOL_IMPORT_FIELDS.filter((field) => !REQUIRED_SCHOOL_IMPORT_FIELDS.includes(field) && !mapped.has(field)) };
}

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
function toEnglishDigits(value: string) { return value.replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit))); }
function canonicalizeJordanPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('00962')) return canonicalizeJordanPhone(digits.slice(2));
  if (digits.startsWith('962')) return digits.length >= 11 ? `0${digits.slice(3)}` : digits;
  return digits;
}
export function normalizeImportPhone(value: unknown): string {
  if (value === undefined || value === null) return '';
  const raw = toEnglishDigits(String(value)).replace(/[\u200B-\u200D\uFEFF]/g, '');
  return raw.split(/\/+/).map((part) => canonicalizeJordanPhone(part)).find((part) => /^\d{7,12}$/.test(part)) || '';
}

const UNASSIGNED_PLACEHOLDERS = new Set(['', '-', '—', 'لا يوجد', 'بدون', 'غير محدد', 'لايوجد', 'none', 'n/a', 'na', 'null', 'undefined']);

export function matchImportEmployee<T extends { name: string; email?: string | null }>(input: string | null, employees: T[]) {
  if (!input) return undefined;
  const normalize = (value: string) => value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
  const normalizedInput = normalize(input);
  if (UNASSIGNED_PLACEHOLDERS.has(normalizedInput)) return undefined;
  const exact = employees.filter((candidate) => normalize(candidate.name) === normalizedInput || (candidate.email ? normalize(candidate.email) === normalizedInput : false));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const firstNameMatches = employees.filter((candidate) => normalize(candidate.name).split(' ')[0] === normalizedInput);
  if (firstNameMatches.length === 1) return firstNameMatches[0];
  const tokenMatches = employees.filter((candidate) => normalize(candidate.name).split(' ').includes(normalizedInput));
  return tokenMatches.length === 1 ? tokenMatches[0] : undefined;
}

export function mapSchoolImportRow(row: Record<string, unknown>, resolved = resolveImportHeaders(Object.keys(row))) {
  const value = (field: SchoolImportField) => { const column = resolved.mapped.get(field); return column ? row[column.header] : undefined; };
  const text = (field: SchoolImportField) => { const item = value(field); return item === undefined || item === null ? '' : String(item).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/gu, ' ').trim(); };

  const rawClassification = text('classification').toLocaleUpperCase().replace(/^(?:CLASS|الفئة|فئة)\s*/u, '').trim();
  let normalizedClassification = '';
  if (['A', 'B', 'C'].includes(rawClassification)) {
    normalizedClassification = rawClassification;
  } else if (rawClassification === 'أ') {
    normalizedClassification = 'A';
  } else if (rawClassification === 'ب') {
    normalizedClassification = 'B';
  } else if (rawClassification === 'ج') {
    normalizedClassification = 'C';
  }

  const rawContact = text('contactPerson');
  const normalizedContact = (rawContact && !UNASSIGNED_PLACEHOLDERS.has(rawContact.trim().toLowerCase())) ? rawContact : null;

  return {
    name: text('name'),
    contactPerson: normalizedContact,
    city: text('city') || null,
    classification: normalizedClassification,
    phone: normalizeImportPhone(value('phone')) || null,
    email: text('email') || null,
  };
}
