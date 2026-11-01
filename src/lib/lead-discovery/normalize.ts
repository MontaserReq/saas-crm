import { safeExternalUrl } from '@/lib/security/url';

export function normalizeName(value: string): string { return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
export function normalizeDomain(value: string | null | undefined): string | null {
  const url = safeExternalUrl(value);
  if (!url) return null;
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}
export function normalizeEmail(value: string | null | undefined): string | null { const normalized = value?.trim().toLowerCase() || ''; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null; }
export function normalizePhone(value: string | null | undefined): string | null { const digits = (value || '').replace(/\D/g, ''); return digits.length >= 7 ? digits : null; }
export function safeUrl(value: string | null | undefined): string | null { return safeExternalUrl(value); }

export function completeness(fields: Array<string | null | undefined>): number { return Math.round((fields.filter(Boolean).length / fields.length) * 100); }

export function scoreLead(input: { prompt: string; companyName: string; industry?: string | null; city?: string | null; country?: string | null; website?: string | null; email?: string | null; phone?: string | null; sourceCount: number }): { score: number; reason: string } {
  const prompt = input.prompt.toLowerCase();
  let score = 25;
  const reasons: string[] = [];
  if (input.industry && prompt.includes(input.industry.toLowerCase())) { score += 20; reasons.push('industry matches request'); }
  if (input.city && prompt.includes(input.city.toLowerCase())) { score += 15; reasons.push('location matches request'); }
  if (input.country && prompt.includes(input.country.toLowerCase())) { score += 10; reasons.push('country matches request'); }
  if (input.website) { score += 10; reasons.push('official website found'); }
  if (input.email || input.phone) { score += 10; reasons.push('public contact detail found'); }
  if (input.sourceCount > 1) { score += 10; reasons.push('multiple sources found'); }
  return { score: Math.min(100, score), reason: reasons.length ? reasons.join('; ') : 'Potential match based on available public evidence' };
}
