/**
 * The School model stores schoolType as a free string (see prisma/schema.prisma
 * comment). There is no dedicated SchoolType table in the app yet, so this is
 * the minimal shared list — reused by the AI School Research form/filter
 * instead of hardcoding options in multiple places.
 */
export const SCHOOL_TYPES = ['PRIVATE', 'GOVERNMENT', 'INTERNATIONAL', 'COMMUNITY', 'OTHER'] as const;
export type SchoolTypeValue = (typeof SCHOOL_TYPES)[number];
