import { z } from 'zod';
import { emailSchema, optionalEmailSchema, optionalInternationalPhoneSchema } from '@/lib/validation/contactInfo';

const text = z.string().trim();
const optionalText = text.max(4000).default('');
const optionalId = text.transform(value => value || null);
const date = text.refine(value => !value || !Number.isNaN(Date.parse(value)), 'Invalid date').transform(value => value ? new Date(value) : null);
const money = z.union([z.string(), z.null()]).transform(value => value === null ? null : value.trim()).refine(value => value === null || /^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value), 'Use a monetary amount with at most two decimal places').refine(value => value === null || Number(value) <= 1000000, 'Price is too large');
const moneyInMinorUnits = (value: string) => { const [whole, fraction = ''] = value.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0')); };
export const organizationInput = z.object({ name: text.min(2).max(120), slug: text.min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens'), language: z.enum(['en', 'ar']), timezone: text.refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Invalid timezone'), currency: text.regex(/^[A-Z]{3}$/, 'Use a three-letter currency code'), isActive: z.boolean(), featureEnable: text.max(4000).default(''), featureDisable: text.max(4000).default('') }).strict();
export const userInput = z.object({ name: text.min(2).max(120), email: emailSchema, phone: optionalInternationalPhoneSchema, organizationId: text.min(1), departmentId: text.default(''), roleId: text.min(1), password: z.string().max(128).refine(value => !value || value.length >= 8, 'Password must contain at least 8 characters').default(''), isActive: z.boolean() }).strict();
export const planInput = z.object({ slug: text.min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: text.min(2).max(100), descriptionEn: optionalText, descriptionAr: optionalText, monthlyPrice: money, annualPrice: money, currency: text.regex(/^[A-Z]{3}$/, 'Use a three-letter currency code'), userLimit: z.number().int().positive().max(1000000).nullable(), features: text.max(4000).default(''), availability: z.enum(['self_serve', 'contact_sales']), recommended: z.boolean(), isActive: z.boolean() }).strict().superRefine((value, context) => {
  if (value.availability === 'self_serve' && (value.monthlyPrice === null || value.annualPrice === null)) context.addIssue({ code: 'custom', path: ['monthlyPrice'], message: 'Self-service plans require explicit monthly and annual prices' });
  if (value.availability === 'contact_sales' && (value.monthlyPrice !== null || value.annualPrice !== null)) context.addIssue({ code: 'custom', path: ['monthlyPrice'], message: 'Contact-sales plans must not publish self-service prices' });
  if (value.monthlyPrice !== null && value.annualPrice !== null && moneyInMinorUnits(value.annualPrice) > moneyInMinorUnits(value.monthlyPrice) * 12) context.addIssue({ code: 'custom', path: ['annualPrice'], message: 'Annual price cannot exceed twelve monthly payments' });
});
export const subscriptionInput = z.object({ organizationId: text.min(1), planId: text.min(1), status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']), billingInterval: z.enum(['monthly', 'annual']), startsAt: date.refine(value => value !== null, 'Start date is required'), endsAt: date, notes: optionalText }).strict().refine(value => !value.endsAt || value.startsAt && value.endsAt >= value.startsAt, 'End date must be after the start date');
export const integrationInput = z.object({ organizationId: text.min(1), provider: z.enum(['GOOGLE', 'MICROSOFT', 'SMTP']), accountEmail: optionalEmailSchema, accessToken: z.string().max(16000).default(''), refreshToken: z.string().max(16000).default(''), tokenExpiresAt: date, scopes: text.max(2000).default(''), host: text.max(255).default(''), port: z.number().int().min(1).max(65535).default(587), useTls: z.boolean().default(true) }).strict().refine(value => value.provider !== 'SMTP' || value.host.length > 0, 'SMTP host is required');
export const supportInput = z.object({ organizationId: optionalId, subject: text.min(3).max(200), description: optionalText, contactEmail: optionalEmailSchema, status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']), priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']), resolution: optionalText }).strict();
export const platformSupportRequestInput = z.object({ subject: text.min(3).max(200), description: text.min(10).max(4000), priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL') }).strict();
export const settingKeys = ['signup_enabled', 'signup_default_plan_slug', 'support_email', 'platform_name', 'default_language', 'default_timezone', 'paid_subscription_start_policy', 'paid_subscription_monthly_months', 'paid_subscription_annual_months'] as const;
export const settingInput = z.object({ key: z.enum(settingKeys), value: text.max(500) }).strict().superRefine(({ key, value }, context) => {
  let valid = true;
  if (key === 'signup_enabled') valid = ['true', 'false'].includes(value);
  if (key === 'signup_default_plan_slug') valid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  if (key === 'support_email') valid = !value || emailSchema.safeParse(value).success;
  if (key === 'platform_name') valid = value.length >= 2;
  if (key === 'default_language') valid = ['en', 'ar'].includes(value);
  if (key === 'default_timezone') { try { new Intl.DateTimeFormat('en', { timeZone: value }); } catch { valid = false; } }
  if (key === 'paid_subscription_start_policy') valid = value === 'payment_confirmation';
  if (key === 'paid_subscription_monthly_months' || key === 'paid_subscription_annual_months') valid = /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 120;
  if (!valid) context.addIssue({ code: 'custom', path: ['value'], message: 'Invalid value for this setting' });
});
