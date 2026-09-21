import { EXPORT_EMPTY_VALUE, formatExportDateTime } from '@/lib/export';

/**
 * Column definition consumed by the shared export writers (Excel / printable
 * view). `accessor` receives the row index so exports can carry a stable "#".
 */
export interface SchoolExportColumn {
  header: string;
  accessor: (school: any, index: number) => string | number;
}

/** Localized labels injected by the caller so this module stays i18n agnostic. */
export interface SchoolExportLabels {
  index: string;
  schoolName: string;
  classification: string;
  schoolType: string;
  city: string;
  area: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  status: string;
  responsibleEmployee: string;
  ticketsCount: string;
  notes: string;
  addedBy: string;
  addedAt: string;
  lastUpdatedAt: string;
  unassignedEmployee: string;
  /** Localizes a school type code (PRIVATE / GOVERNMENT / ...). */
  schoolTypeLabel: (value?: string | null) => string;
  /** Localizes a school status code (ACTIVE / ASSIGNED / ...). */
  statusLabel: (value?: string | null) => string;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return EXPORT_EMPTY_VALUE;
  const normalized = String(value).trim();
  return normalized === '' ? EXPORT_EMPTY_VALUE : normalized;
}

/**
 * Builds the ordered export columns of the Schools Registry. The order mirrors
 * the registry workflow: identity, classification, location, contact channels,
 * ownership and timestamps - so the exported sheet reads like the registry page.
 */
export function buildSchoolExportColumns(labels: SchoolExportLabels): SchoolExportColumn[] {
  return [
    { header: labels.index, accessor: (_school, index) => index + 1 },
    { header: labels.schoolName, accessor: (school) => text(school?.name) },
    { header: labels.classification, accessor: (school) => text(school?.classification) },
    { header: labels.schoolType, accessor: (school) => text(labels.schoolTypeLabel(school?.schoolType)) },
    { header: labels.city, accessor: (school) => text(school?.city) },
    { header: labels.area, accessor: (school) => text(school?.area) },
    { header: labels.contactPerson, accessor: (school) => text(school?.contactPerson) },
    { header: labels.phone, accessor: (school) => text(school?.phone) },
    { header: labels.whatsapp, accessor: (school) => text(school?.whatsapp) },
    { header: labels.email, accessor: (school) => text(school?.email) },
    { header: labels.status, accessor: (school) => text(labels.statusLabel(school?.status)) },
    {
      header: labels.responsibleEmployee,
      accessor: (school) => text(school?.responsibleEmployee?.name || labels.unassignedEmployee),
    },
    {
      header: labels.ticketsCount,
      accessor: (school) => (typeof school?._count?.tickets === 'number' ? school._count.tickets : 0),
    },
    { header: labels.notes, accessor: (school) => text(school?.notes) },
    { header: labels.addedBy, accessor: (school) => text(school?.createdBy?.name) },
    { header: labels.addedAt, accessor: (school) => formatExportDateTime(school?.createdAt) },
    { header: labels.lastUpdatedAt, accessor: (school) => formatExportDateTime(school?.updatedAt) },
  ];
}

/**
 * Maps schools to export rows using the prepared columns. Kept pure so the
 * registry export shape can be unit tested without a UI.
 */
export function buildSchoolExportRows(
  schools: any[],
  columns: SchoolExportColumn[]
): Record<string, string | number>[] {
  return (schools || []).map((school, index) => {
    const row: Record<string, string | number> = {};
    for (const column of columns) {
      row[column.header] = column.accessor(school, index) ?? EXPORT_EMPTY_VALUE;
    }
    return row;
  });
}
