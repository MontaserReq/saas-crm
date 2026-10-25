import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { z } from 'zod';

export const EMAIL_VALIDATION_MESSAGE = 'Invalid email address';
export const PHONE_VALIDATION_MESSAGE = 'Enter a valid international phone number including the country code (for example +962790000000)';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function toAsciiDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(EASTERN_ARABIC_DIGITS.indexOf(digit)));
}

function preparePhone(value: string) {
  const normalized = toAsciiDigits(value.normalize('NFKC'))
    .replace(/[​-‍﻿]/g, '')
    .trim();
  return normalized.startsWith('00') ? `+${normalized.slice(2)}` : normalized;
}

/**
 * Returns a canonical E.164 number, or null when the input is not a valid
 * international number. A country code is deliberately required so the same
 * value has one meaning in every workspace and country.
 */
export function normalizeInternationalPhone(value: unknown, defaultCountry?: CountryCode): string | null {
  if (value === undefined || value === null) return null;
  const prepared = preparePhone(String(value));
  if (!prepared) return null;
  if (!prepared.startsWith('+') && !defaultCountry) return null;
  try {
    const parsed = parsePhoneNumberFromString(prepared, defaultCountry);
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}

export function normalizeInternationalPhoneList(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parts = String(value).split(/[,;\n/]+/).map(part => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const normalized = parts.map(part => normalizeInternationalPhone(part));
  return normalized.every((phone): phone is string => phone !== null)
    ? [...new Set(normalized)].join(', ')
    : null;
}

export function normalizeEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  const result = z.string().email().max(254).safeParse(normalized);
  return result.success ? result.data : null;
}

const emptyToNull = (value: unknown) => value === undefined || value === null || String(value).trim() === '' ? null : value;

export const emailSchema = z.string().trim().toLowerCase().email(EMAIL_VALIDATION_MESSAGE).max(254, EMAIL_VALIDATION_MESSAGE);

export const optionalEmailSchema = z.preprocess(
  emptyToNull,
  emailSchema.nullable(),
);

export const internationalPhoneSchema = z.string()
  .trim()
  .max(80, PHONE_VALIDATION_MESSAGE)
  .refine(value => normalizeInternationalPhone(value) !== null, PHONE_VALIDATION_MESSAGE)
  .transform(value => normalizeInternationalPhone(value)!);

export const optionalInternationalPhoneSchema = z.preprocess(
  emptyToNull,
  internationalPhoneSchema.nullable(),
);

export const internationalPhoneListSchema = z.string()
  .trim()
  .max(255, PHONE_VALIDATION_MESSAGE)
  .refine(value => normalizeInternationalPhoneList(value) !== null, `${PHONE_VALIDATION_MESSAGE}. Separate multiple numbers with commas.`)
  .transform(value => normalizeInternationalPhoneList(value)!);

export const optionalInternationalPhoneListSchema = z.preprocess(
  emptyToNull,
  internationalPhoneListSchema.nullable(),
);

export function parseOptionalEmail(value: unknown) {
  return optionalEmailSchema.parse(value);
}

export function parseOptionalInternationalPhone(value: unknown) {
  return optionalInternationalPhoneSchema.parse(value);
}

export function parseOptionalInternationalPhoneList(value: unknown) {
  return optionalInternationalPhoneListSchema.parse(value);
}
