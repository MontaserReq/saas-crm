import { normalizeEmail, normalizeInternationalPhone } from '@/lib/validation/contactInfo';

export const IMPORT_DESTINATIONS = ['CLIENT', 'LEAD', 'CONTACT', 'DEAL', 'TASK'] as const;
export type ImportDestination = typeof IMPORT_DESTINATIONS[number];
export type ImportMode = 'CREATE' | 'SKIP_DUPLICATES' | 'UPDATE' | 'UPSERT';
export type InferredType = 'TEXT' | 'NUMBER' | 'CURRENCY' | 'BOOLEAN' | 'DATE' | 'EMAIL' | 'PHONE' | 'URL';
export type ImportField = {
  key: string;
  label: string;
  labelAr: string;
  type: InferredType | 'TEXTAREA' | 'DATETIME' | 'SELECT' | 'MULTI_SELECT' | 'RELATION';
  required?: boolean;
  aliases: string[];
  options?: string[];
  matchable?: boolean;
};
export type ColumnSuggestion = {
  source: string;
  inferredType: InferredType;
  samples: string[];
  suggestedField: string | null;
  confidence: number;
  explanation: string;
};
export type DestinationSuggestion = { destination: ImportDestination | null; ambiguous: boolean; scores: Record<ImportDestination, number>; explanation: string };
export type ColumnMapping = { source: string; action: 'FIELD' | 'CUSTOM' | 'IGNORE'; target?: string; customLabel?: string; customType?: string; customOptions?: string[]; required?: boolean; searchable?: boolean };

const common = {
  email: ['email', 'email address', 'e mail', 'البريد الالكتروني', 'البريد الإلكتروني', 'ايميل'],
  phone: ['phone', 'phone number', 'telephone', 'mobile', 'رقم الهاتف', 'الهاتف', 'رقم الجوال', 'الجوال'],
  status: ['status', 'الحالة'],
  notes: ['notes', 'note', 'remarks', 'ملاحظات', 'الملاحظات'],
};

export const IMPORT_FIELDS: Record<ImportDestination, ImportField[]> = {
  CLIENT: [
    { key: 'name', label: 'Client name', labelAr: 'اسم العميل', type: 'TEXT', required: true, aliases: ['client name', 'customer name', 'customer', 'client', 'company', 'company name', 'اسم العميل', 'اسم الشركة', 'العميل', 'الشركة'] },
    { key: 'type', label: 'Type', labelAr: 'النوع', type: 'SELECT', aliases: ['client type', 'customer type', 'type', 'نوع العميل', 'النوع'], options: ['SCHOOL', 'COMPANY', 'NGO', 'UNIVERSITY', 'GOVERNMENT', 'INDIVIDUAL', 'OTHER'] },
    { key: 'status', label: 'Status', labelAr: 'الحالة', type: 'SELECT', aliases: ['client status', ...common.status], options: ['ACTIVE', 'INACTIVE', 'PROSPECT', 'ARCHIVED'] },
    { key: 'email', label: 'Email', labelAr: 'البريد الإلكتروني', type: 'EMAIL', aliases: common.email, matchable: true },
    { key: 'phone', label: 'Phone', labelAr: 'الهاتف', type: 'PHONE', aliases: common.phone, matchable: true },
    { key: 'website', label: 'Website', labelAr: 'الموقع الإلكتروني', type: 'URL', aliases: ['website', 'web site', 'url', 'الموقع', 'الموقع الالكتروني', 'الموقع الإلكتروني'] },
    { key: 'category', label: 'Category', labelAr: 'التصنيف', type: 'TEXT', aliases: ['category', 'segment', 'classification', 'التصنيف', 'الفئة', 'شريحة العميل'] },
    { key: 'address', label: 'Address', labelAr: 'العنوان', type: 'TEXT', aliases: ['address', 'location', 'العنوان', 'الموقع الجغرافي'] },
    { key: 'description', label: 'Description', labelAr: 'الوصف', type: 'TEXT', aliases: ['description', 'details', 'الوصف', 'التفاصيل'] },
  ],
  LEAD: [
    { key: 'name', label: 'Lead name', labelAr: 'اسم العميل المحتمل', type: 'TEXT', required: true, aliases: ['lead name', 'contact name', 'name', 'اسم العميل المحتمل', 'اسم جهة الاتصال', 'الاسم'] },
    { key: 'companyName', label: 'Company name', labelAr: 'اسم الشركة', type: 'TEXT', aliases: ['company', 'company name', 'business', 'اسم الشركة', 'الشركة'] },
    { key: 'email', label: 'Email', labelAr: 'البريد الإلكتروني', type: 'EMAIL', aliases: common.email, matchable: true },
    { key: 'phone', label: 'Phone', labelAr: 'الهاتف', type: 'PHONE', aliases: common.phone, matchable: true },
    { key: 'source', label: 'Lead source', labelAr: 'مصدر العميل المحتمل', type: 'TEXT', aliases: ['lead source', 'source', 'campaign', 'مصدر العميل', 'المصدر', 'الحملة'] },
    { key: 'status', label: 'Status', labelAr: 'الحالة', type: 'SELECT', aliases: ['lead status', ...common.status], options: ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'] },
    { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'TEXT', aliases: common.notes },
    { key: 'clientId', label: 'Client (ID or exact name)', labelAr: 'العميل (المعرف أو الاسم المطابق)', type: 'RELATION', aliases: ['client id', 'customer id', 'existing client', 'customer', 'العميل الحالي', 'معرف العميل'] },
  ],
  CONTACT: [
    { key: 'firstName', label: 'First name', labelAr: 'الاسم الأول', type: 'TEXT', required: true, aliases: ['first name', 'contact name', 'name', 'الاسم الأول', 'اسم جهة الاتصال', 'الاسم'] },
    { key: 'lastName', label: 'Last name', labelAr: 'اسم العائلة', type: 'TEXT', aliases: ['last name', 'surname', 'family name', 'اسم العائلة', 'الكنية'] },
    { key: 'jobTitle', label: 'Job title', labelAr: 'المسمى الوظيفي', type: 'TEXT', aliases: ['job title', 'title', 'position', 'role', 'المسمى الوظيفي', 'المنصب'] },
    { key: 'email', label: 'Email', labelAr: 'البريد الإلكتروني', type: 'EMAIL', aliases: common.email, matchable: true },
    { key: 'phone', label: 'Phone', labelAr: 'الهاتف', type: 'PHONE', aliases: ['phone', 'telephone', 'رقم الهاتف', 'الهاتف'], matchable: true },
    { key: 'mobile', label: 'Mobile', labelAr: 'الجوال', type: 'PHONE', aliases: ['mobile', 'cell', 'cell phone', 'رقم الجوال', 'الجوال'], matchable: true },
    { key: 'isPrimary', label: 'Primary contact', labelAr: 'جهة اتصال رئيسية', type: 'BOOLEAN', aliases: ['primary', 'primary contact', 'is primary', 'جهة اتصال رئيسية', 'رئيسي'] },
    { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'TEXT', aliases: common.notes },
    { key: 'clientId', label: 'Client (ID or exact name)', labelAr: 'العميل (المعرف أو الاسم المطابق)', type: 'RELATION', aliases: ['client id', 'customer id', 'company id', 'company', 'client', 'الشركة', 'العميل', 'معرف العميل', 'معرف الشركة'] },
  ],
  DEAL: [
    { key: 'title', label: 'Deal name', labelAr: 'اسم الصفقة', type: 'TEXT', required: true, aliases: ['deal name', 'deal title', 'opportunity', 'opportunity name', 'اسم الصفقة', 'الصفقة', 'الفرصة'] },
    { key: 'value', label: 'Amount', labelAr: 'القيمة', type: 'CURRENCY', aliases: ['amount', 'value', 'deal value', 'revenue', 'المبلغ', 'القيمة', 'قيمة الصفقة'] },
    { key: 'currency', label: 'Currency', labelAr: 'العملة', type: 'TEXT', aliases: ['currency', 'currency code', 'العملة'] },
    { key: 'probability', label: 'Probability', labelAr: 'الاحتمالية', type: 'NUMBER', aliases: ['probability', 'chance', 'win probability', 'الاحتمالية', 'نسبة النجاح'] },
    { key: 'expectedCloseDate', label: 'Expected close date', labelAr: 'تاريخ الإغلاق المتوقع', type: 'DATE', aliases: ['expected close date', 'close date', 'closing date', 'تاريخ الإغلاق المتوقع', 'تاريخ الاغلاق'] },
    { key: 'description', label: 'Description', labelAr: 'الوصف', type: 'TEXT', aliases: ['description', 'details', 'الوصف', 'التفاصيل'] },
    { key: 'pipelineId', label: 'Pipeline (ID or exact name)', labelAr: 'المسار (المعرف أو الاسم المطابق)', type: 'RELATION', required: true, aliases: ['pipeline', 'sales pipeline', 'pipeline id', 'المسار', 'مسار المبيعات', 'معرف المسار'] },
    { key: 'stageId', label: 'Stage (ID or exact name)', labelAr: 'المرحلة (المعرف أو الاسم المطابق)', type: 'RELATION', required: true, aliases: ['stage', 'deal stage', 'stage id', 'المرحلة', 'مرحلة الصفقة', 'معرف المرحلة'] },
    { key: 'ownerId', label: 'Owner (ID, email, or exact name)', labelAr: 'المالك (المعرف أو البريد أو الاسم المطابق)', type: 'RELATION', required: true, aliases: ['owner', 'deal owner', 'assignee', 'owner id', 'المالك', 'مسؤول الصفقة', 'معرف المالك'] },
    { key: 'clientId', label: 'Client (ID or exact name)', labelAr: 'العميل (المعرف أو الاسم المطابق)', type: 'RELATION', aliases: ['client', 'customer', 'company', 'client id', 'customer id', 'العميل', 'الشركة', 'معرف العميل'] },
    { key: 'primaryContactId', label: 'Contact (ID or email)', labelAr: 'جهة الاتصال (المعرف أو البريد)', type: 'RELATION', aliases: ['contact', 'primary contact', 'contact id', 'جهة الاتصال', 'معرف جهة الاتصال'] },
    { key: 'leadId', label: 'Lead (ID or exact name)', labelAr: 'العميل المحتمل (المعرف أو الاسم المطابق)', type: 'RELATION', aliases: ['lead', 'lead id', 'العميل المحتمل', 'معرف العميل المحتمل'] },
  ],
  TASK: [
    { key: 'title', label: 'Task title', labelAr: 'عنوان المهمة', type: 'TEXT', required: true, aliases: ['task title', 'task name', 'title', 'subject', 'عنوان المهمة', 'اسم المهمة', 'الموضوع'] },
    { key: 'description', label: 'Description', labelAr: 'الوصف', type: 'TEXT', aliases: ['description', 'details', 'الوصف', 'التفاصيل'] },
    { key: 'status', label: 'Status', labelAr: 'الحالة', type: 'SELECT', aliases: ['task status', ...common.status], options: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
    { key: 'priority', label: 'Priority', labelAr: 'الأولوية', type: 'SELECT', aliases: ['priority', 'task priority', 'الأولوية'], options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
    { key: 'dueDate', label: 'Due date', labelAr: 'تاريخ الاستحقاق', type: 'DATE', aliases: ['due date', 'deadline', 'تاريخ الاستحقاق', 'الموعد النهائي'] },
    { key: 'ownerId', label: 'Owner (ID, email, or exact name)', labelAr: 'المالك (المعرف أو البريد أو الاسم المطابق)', type: 'RELATION', aliases: ['owner', 'owner id', 'المالك', 'معرف المالك'] },
    { key: 'assignedUserId', label: 'Assignee (ID, email, or exact name)', labelAr: 'المكلف (المعرف أو البريد أو الاسم المطابق)', type: 'RELATION', aliases: ['assignee', 'assigned to', 'assignee id', 'assigned user id', 'المكلف', 'مسند إلى', 'معرف المكلف'] },
    { key: 'clientId', label: 'Client (ID or exact name)', labelAr: 'العميل (المعرف أو الاسم المطابق)', type: 'RELATION', aliases: ['client', 'customer', 'client id', 'customer id', 'العميل', 'معرف العميل'] },
    { key: 'leadId', label: 'Lead (ID or exact name)', labelAr: 'العميل المحتمل (المعرف أو الاسم المطابق)', type: 'RELATION', aliases: ['lead', 'lead id', 'العميل المحتمل', 'معرف العميل المحتمل'] },
    { key: 'contactId', label: 'Contact (ID or email)', labelAr: 'جهة الاتصال (المعرف أو البريد)', type: 'RELATION', aliases: ['contact', 'contact id', 'جهة الاتصال', 'معرف جهة الاتصال'] },
    { key: 'dealId', label: 'Deal (ID or exact title)', labelAr: 'الصفقة (المعرف أو العنوان المطابق)', type: 'RELATION', aliases: ['deal', 'deal id', 'الصفقة', 'معرف الصفقة'] },
  ],
};

export function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .toLowerCase()
    .replace(/[\u0640]/g, '')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const empty = (value: unknown) => value === null || value === undefined || String(value).trim() === '';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlPattern = /^https?:\/\/[^\s]+$/i;
const phonePattern = /^\+?[\d\s().-]{7,}$/;
const numericPattern = /^(?:[A-Z]{3}|[$€£﷼])?\s*[-+]?\s*(?:\d{1,3}(?:[, ]\d{3})+|\d+)(?:\.\d+)?\s*(?:[A-Z]{3}|[$€£﷼])?$/i;

export function inferColumnType(values: unknown[]): InferredType {
  const sample = values.filter((value) => !empty(value)).slice(0, 50);
  if (!sample.length) return 'TEXT';
  const strings = sample.map((value) => String(value).trim());
  const ratio = (predicate: (value: string, original: unknown) => boolean) => strings.filter((value, index) => predicate(value, sample[index])).length / strings.length;
  if (ratio((value) => emailPattern.test(value)) >= .8) return 'EMAIL';
  if (ratio((value) => urlPattern.test(value)) >= .8) return 'URL';
  if (ratio((value) => ['true', 'false', 'yes', 'no', '1', '0', 'نعم', 'لا'].includes(normalizeHeader(value))) >= .8) return 'BOOLEAN';
  if (ratio((value, original) => original instanceof Date || (/[-/]\d/.test(value) && !Number.isNaN(Date.parse(value)))) >= .8) return 'DATE';
  if (ratio((value) => phonePattern.test(value)) >= .8 && strings.some((value) => /[+()\s-]/.test(value))) return 'PHONE';
  if (ratio((value) => numericPattern.test(value)) >= .8) return strings.some((value) => /[$€£﷼]|\b[A-Z]{3}\b/i.test(value)) ? 'CURRENCY' : 'NUMBER';
  return 'TEXT';
}

function headerScore(header: string, field: ImportField) {
  const normalized = normalizeHeader(header);
  const aliases = [field.key, field.label, field.labelAr, ...field.aliases].map(normalizeHeader);
  if (aliases.includes(normalized)) return 1;
  const headerTokens = new Set(normalized.split(' ').filter(Boolean));
  let best = 0;
  for (const alias of aliases) {
    const tokens = alias.split(' ').filter(Boolean);
    if (!tokens.length) continue;
    const overlap = tokens.filter((token) => headerTokens.has(token)).length / Math.max(tokens.length, headerTokens.size);
    best = Math.max(best, overlap * .74);
  }
  return best;
}

export function suggestColumns(headers: string[], rows: Record<string, unknown>[], destination: ImportDestination): ColumnSuggestion[] {
  const used = new Set<string>();
  return headers.map((source) => {
    const inferredType = inferColumnType(rows.map((row) => row[source]));
    const ranked = IMPORT_FIELDS[destination]
      .map((field) => ({ field, score: headerScore(source, field) + (field.type === inferredType ? .08 : 0) }))
      .sort((a, b) => b.score - a.score);
    const winner = ranked[0];
    const confident = winner && winner.score >= .58 && !used.has(winner.field.key);
    if (confident) used.add(winner.field.key);
    const samples = rows.map((row) => row[source]).filter((value) => !empty(value)).slice(0, 3).map(String);
    return {
      source,
      inferredType,
      samples,
      suggestedField: confident ? winner.field.key : null,
      confidence: confident ? Math.min(1, Math.round(winner.score * 100) / 100) : 0,
      explanation: confident ? (winner.score >= 1 ? 'Exact or synonym match' : 'Similar header and compatible sample values') : 'No reliable field match; review or create a custom field',
    };
  });
}

export function detectDestination(headers: string[]): DestinationSuggestion {
  const scores = Object.fromEntries(IMPORT_DESTINATIONS.map((destination) => {
    const fields = IMPORT_FIELDS[destination];
    const fieldScores = fields.map((field) => Math.max(...headers.map((header) => headerScore(header, field)), 0));
    const distinctive = fieldScores.filter((score) => score >= .58).reduce((sum, score) => sum + score, 0);
    const required = fields.filter((field) => field.required);
    const requiredHits = required.filter((field) => headers.some((header) => headerScore(header, field) >= .58)).length;
    return [destination, (distinctive + requiredHits * .8) / Math.max(2, fields.length * .45)];
  })) as Record<ImportDestination, number>;
  const ranked = IMPORT_DESTINATIONS.map((destination) => ({ destination, score: scores[destination] })).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const ambiguous = !top || top.score < .35 || top.score - ranked[1].score < .16;
  return {
    destination: ambiguous ? null : top.destination,
    ambiguous,
    scores,
    explanation: ambiguous ? 'The columns could describe more than one CRM module. Select the destination before continuing.' : `The strongest field pattern matches ${top.destination.toLowerCase()} records.`,
  };
}

export function inferCustomFieldType(type: InferredType) {
  return type === 'CURRENCY' ? 'CURRENCY' : type;
}

export function parseTypedValue(value: unknown, field: ImportField): { value: unknown; error?: string } {
  if (empty(value)) return { value: null, ...(field.required ? { error: `${field.label} is required` } : {}) };
  const text = String(value).trim();
  if (field.type === 'EMAIL') {
    const email = normalizeEmail(text);
    return email ? { value: email } : { value: text, error: `${field.label} must be a valid email` };
  }
  if (field.type === 'PHONE') {
    const phone = normalizeInternationalPhone(text);
    return phone ? { value: phone } : { value: text, error: `${field.label} must be a valid international number including the country code (for example +962790000000)` };
  }
  if (field.type === 'URL' && !urlPattern.test(text)) return { value: text, error: `${field.label} must be a valid http(s) URL` };
  if (field.type === 'NUMBER' || field.type === 'CURRENCY') {
    const numeric = Number(text.replace(/[^\d.+-]/g, ''));
    if (!Number.isFinite(numeric)) return { value: text, error: `${field.label} must be a valid number` };
    if (field.key === 'probability' && (numeric < 0 || numeric > 100)) return { value: numeric, error: 'Probability must be between 0 and 100' };
    return { value: numeric };
  }
  if (field.type === 'BOOLEAN') {
    const normalized = normalizeHeader(text);
    if (['true', 'yes', '1', 'نعم'].includes(normalized)) return { value: true };
    if (['false', 'no', '0', 'لا'].includes(normalized)) return { value: false };
    return { value: text, error: `${field.label} must be yes/no or true/false` };
  }
  if (field.type === 'DATE' || field.type === 'DATETIME') {
    const date = value instanceof Date ? value : new Date(text);
    if (Number.isNaN(date.getTime())) return { value: text, error: `${field.label} must be a valid date` };
    return { value: date.toISOString() };
  }
  if (field.type === 'SELECT') {
    if (!field.options?.length) return { value: text };
    const selected = field.options.find((option) => normalizeHeader(option) === normalizeHeader(text));
    if (!selected) return { value: text, error: `${field.label} must be one of: ${field.options.join(', ')}` };
    return { value: selected };
  }
  if (field.type === 'MULTI_SELECT') {
    const requested = text.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
    const selected = requested.map((item) => field.options?.find((option) => normalizeHeader(option) === normalizeHeader(item)) || item);
    const invalid = field.options?.length ? selected.filter((item) => !field.options!.includes(item)) : [];
    if (invalid.length) return { value: selected, error: `${field.label} contains unsupported options: ${invalid.join(', ')}` };
    return { value: selected };
  }
  return { value: text };
}

export function safeCsvCell(value: unknown) {
  const text = String(value ?? '');
  const protectedText = /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

export function slugifyFieldKey(label: string, fallbackIndex = 1) {
  const normalized = normalizeHeader(label).replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const safe = /^[a-z]/.test(normalized) ? normalized : `import_field_${fallbackIndex}`;
  return safe.slice(0, 64).replace(/_+$/g, '') || `import_field_${fallbackIndex}`;
}

