import { normalizeSchoolName, normalizeResearchPhone, extractWebsiteDomain } from './normalize';

export interface DuplicateComparable {
  name: string;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
}

/**
 * Deterministic duplicate signal — database/string matching only, no AI or
 * fuzzy ML similarity. Any match here means "flag for human review", never
 * an automatic merge (see SchoolDuplicateService).
 */
export function isLikelyDuplicate(a: DuplicateComparable, b: DuplicateComparable): boolean {
  const nameA = normalizeSchoolName(a.name);
  const nameB = normalizeSchoolName(b.name);
  if (nameA && nameA === nameB) {
    const cityA = normalizeSchoolName(a.city);
    const cityB = normalizeSchoolName(b.city);
    if (!cityA || !cityB || cityA === cityB) return true;
  }

  const phoneA = a.phone ? normalizeResearchPhone(a.phone) : '';
  const phoneB = b.phone ? normalizeResearchPhone(b.phone) : '';
  if (phoneA && phoneA.length > 5 && phoneA === phoneB) return true;

  const domainA = extractWebsiteDomain(a.website);
  const domainB = extractWebsiteDomain(b.website);
  if (domainA && domainA === domainB) return true;

  return false;
}
