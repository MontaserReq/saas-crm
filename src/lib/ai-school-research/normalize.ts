import { normalizeImportPhone } from '@/lib/schools/import';

export { normalizeImportPhone as normalizeResearchPhone };

/**
 * Arabic-safe school name normalization used for duplicate comparison only
 * (never shown to users). Trims, collapses whitespace, strips zero-width
 * characters and Arabic tatweel, and normalizes case for Latin text.
 * Modeled on the header/text normalization already used by the school importer.
 */
export function normalizeSchoolName(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '') // zero-width chars
    .replace(/ـ/g, '') // Arabic tatweel
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase();
}

export function normalizeResearchEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return isValid ? trimmed : null;
}

export function extractWebsiteDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}
