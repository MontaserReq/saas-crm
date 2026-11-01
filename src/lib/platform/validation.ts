import { z } from 'zod';
import { emailSchema, optionalEmailSchema, optionalInternationalPhoneSchema } from '@/lib/validation/contactInfo';
import { safeProviderEndpoint } from '@/lib/security/url';

const text = z.string().trim();
const aiProviderCapabilities = ['text', 'streaming', 'structured-json', 'tools', 'vision', 'embeddings', 'reasoning'] as const;
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
export const trialActivationInput = z.object({ organizationId: text.min(1), planId: text.min(1), durationDays: z.number().int().min(1).max(3650) }).strict();
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

export const aiResearchSettingsInput = z.object({
  status: z.enum(['OFF', 'BETA', 'ON']),
  activeProviderId: text.max(80).default('').transform(value => value || null),
  featureProviderIds: z.record(z.string().max(80)).default({}),
  fallbackProviderIds: z.array(z.string().max(80)).max(5).default([]),
  providers: z.array(z.object({
    id: text.min(2).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'Use letters, numbers, hyphens or underscores for provider id'),
    name: text.min(2).max(120),
    kind: z.enum(['gemini', 'groq', 'openai-compatible', 'openai-responses', 'anthropic', 'custom-http']),
    baseUrl: text.max(500).default(''),
    model: text.min(1).max(160),
    timeoutMs: z.number().int().min(5000).max(120000).default(45000),
    maxOutputTokens: z.number().int().min(1).max(32768).default(4096),
    temperature: z.number().min(0).max(2).default(0.2),
    responsePath: text.max(200).default(''),
    capabilities: z.array(z.enum(aiProviderCapabilities)).max(20).default([]),
    customHeadersJson: z.string().trim().max(12000).default(''),
    clearCustomHeaders: z.boolean().default(false),
    inputCostPerMillionUsd: z.number().min(0).max(10000).nullable().default(null),
    outputCostPerMillionUsd: z.number().min(0).max(10000).nullable().default(null),
    apiKey: z.string().trim().max(2000).default(''),
    clearApiKey: z.boolean().default(false),
    enabled: z.boolean().default(true),
  }).strict()).min(1).max(25),
}).strict().superRefine((value, context) => {
  const ids = value.providers.map(provider => provider.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['providers'], message: 'Provider ids must be unique' });
  if (value.activeProviderId && !ids.includes(value.activeProviderId)) context.addIssue({ code: 'custom', path: ['activeProviderId'], message: 'Select an existing provider' });
  for (const [feature, providerId] of Object.entries(value.featureProviderIds)) if (providerId && !ids.includes(providerId)) context.addIssue({ code: 'custom', path: ['featureProviderIds', feature], message: 'Select an existing provider' });
  for (const providerId of value.fallbackProviderIds) if (!ids.includes(providerId)) context.addIssue({ code: 'custom', path: ['fallbackProviderIds'], message: 'Select existing fallback providers' });
  for (const [index, provider] of value.providers.entries()) {
    if (['openai-compatible', 'openai-responses', 'anthropic', 'custom-http'].includes(provider.kind) && !provider.baseUrl) context.addIssue({ code: 'custom', path: ['providers', index, 'baseUrl'], message: 'Base URL is required for this provider adapter' });
    if (provider.baseUrl && !safeProviderEndpoint(provider.baseUrl)) context.addIssue({ code: 'custom', path: ['providers', index, 'baseUrl'], message: 'Provider endpoints must be public http(s) URLs' });
  }
});

export const searchProviderSettingsInput = z.object({
  activeProviderId: text.max(80).default('').transform(value => value || null),
  fallbackProviderIds: z.array(z.string().max(80)).max(10).default([]),
  providers: z.array(z.object({
    id: text.min(2).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
    name: text.min(2).max(120),
    kind: z.enum(['exa', 'brave', 'custom']),
    baseUrl: text.min(1).max(500),
    apiKey: z.string().trim().max(2000).default(''),
    clearApiKey: z.boolean().default(false),
    enabled: z.boolean().default(true),
    maxResults: z.number().int().min(1).max(100).default(25),
    estimatedCostPerRequestUsd: z.number().min(0).max(10000).nullable().default(null),
  }).strict()).min(1).max(15),
}).strict().superRefine((value, context) => {
  const ids = value.providers.map(provider => provider.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['providers'], message: 'Provider ids must be unique' });
  if (value.activeProviderId && !ids.includes(value.activeProviderId)) context.addIssue({ code: 'custom', path: ['activeProviderId'], message: 'Select an existing provider' });
  for (const providerId of value.fallbackProviderIds) if (!ids.includes(providerId)) context.addIssue({ code: 'custom', path: ['fallbackProviderIds'], message: 'Select existing fallback providers' });
  value.providers.forEach((provider, index) => { if (!safeProviderEndpoint(provider.baseUrl)) context.addIssue({ code: 'custom', path: ['providers', index, 'baseUrl'], message: 'Search endpoints must be public http(s) URLs' }); });
});

export const organizationAiProviderInput = z.object({
  id: text.max(100).default('').transform(value => value || null),
  name: text.min(2).max(120),
  kind: z.enum(['gemini', 'groq', 'openai-compatible', 'openai-responses', 'anthropic', 'custom-http']),
  baseUrl: text.max(500).default(''),
  model: text.min(1).max(160),
  organizationRef: text.max(200).default(''),
  timeoutMs: z.number().int().min(5000).max(120000).default(45000),
  maxOutputTokens: z.number().int().min(1).max(32768).default(4096),
  temperature: z.number().min(0).max(2).default(0.2),
  capabilities: z.array(z.enum(aiProviderCapabilities)).max(20).default([]),
  featureKeys: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  apiKey: z.string().trim().max(2000).default(''),
  clearApiKey: z.boolean().default(false),
  customHeadersJson: z.string().trim().max(12000).default(''),
  clearCustomHeaders: z.boolean().default(false),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (['openai-compatible', 'openai-responses', 'anthropic', 'custom-http'].includes(value.kind) && !value.baseUrl) context.addIssue({ code: 'custom', path: ['baseUrl'], message: 'Base URL is required for this provider adapter' });
  if (value.baseUrl && !safeProviderEndpoint(value.baseUrl)) context.addIssue({ code: 'custom', path: ['baseUrl'], message: 'Provider endpoints must be public http(s) URLs' });
});

export const organizationAiUsagePolicyInput = z.object({
  monthlyRequestLimit: z.number().int().min(1).max(1000000).nullable(),
  monthlyCostLimitUsd: z.number().min(0).max(1000000).nullable(),
  monthlySearchRequestLimit: z.number().int().min(1).max(1000000).nullable(),
  monthlySearchCostLimitUsd: z.number().min(0).max(1000000).nullable(),
  maxConcurrentDiscoveries: z.number().int().min(1).max(100).default(2),
  allowPlatformProviders: z.boolean().default(true),
  allowOrganizationProviders: z.boolean().default(true),
}).strict();
