/**
 * Structured report exports (PDF, printable view and Excel).
 */
export function exportToCSV(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  if (!rows || rows.length === 0) return;

  const cols = headers || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const headerLine = cols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');

  const bodyLines = rows.map((row) =>
    cols
      .map((c) => {
        const val = row[c.key] !== undefined && row[c.key] !== null ? String(row[c.key]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports tabular data as Excel XML spreadsheet.
 */
export function exportToExcel(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  if (!rows || rows.length === 0) return;

  const cols = headers || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  const headerXML = cols.map((c) => `<Cell><Data ss:Type="String">${escapeXML(c.label)}</Data></Cell>`).join('');

  const rowsXML = rows
    .map((row) => {
      const cells = cols
        .map((c) => {
          const val = row[c.key] !== undefined && row[c.key] !== null ? String(row[c.key]) : '';
          const isNum = !isNaN(Number(val)) && val.trim() !== '';
          return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXML(val)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  const excelXML = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Row>${headerXML}</Row>
   ${rowsXML}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([excelXML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers clean print/PDF dialog.
 */
export async function exportToPDF(
  filename: string,
  title: string,
  rows: Record<string, any>[],
  headers?: { key: string; label: string }[],
  filters: Record<string, string | number> = {},
  direction: 'rtl' | 'ltr' = 'ltr'
) {
  if (!rows.length) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const cols = headers || Object.keys(rows[0]).map((key) => ({ key, label: key }));
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / cols.length;
  let y = 48;
  const drawHeader = () => {
    doc.setFillColor(91, 33, 182); doc.rect(margin, y - 18, usableWidth, 26, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9);
    cols.forEach((col, index) => doc.text(String(col.label), margin + index * colWidth + 6, y, { maxWidth: colWidth - 12, align: direction === 'rtl' ? 'right' : 'left' }));
    y += 24; doc.setTextColor(30, 41, 59);
  };
  doc.setTextColor(30, 41, 59); doc.setFontSize(18); doc.text(title, direction === 'rtl' ? pageWidth - margin : margin, y, { align: direction === 'rtl' ? 'right' : 'left' });
  y += 18; doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(new Date().toLocaleString(), direction === 'rtl' ? pageWidth - margin : margin, y, { align: direction === 'rtl' ? 'right' : 'left' });
  const filterText = Object.entries(filters).filter(([, value]) => String(value).trim()).map(([key, value]) => `${key}: ${value}`).join(' | ');
  if (filterText) { y += 14; doc.text(filterText, direction === 'rtl' ? pageWidth - margin : margin, y, { align: direction === 'rtl' ? 'right' : 'left', maxWidth: usableWidth }); }
  y += 24; drawHeader();
  rows.forEach((row, rowIndex) => {
    if (y > pageHeight - 42) { doc.addPage(); y = 48; drawHeader(); }
    if (rowIndex % 2 === 0) { doc.setFillColor(245, 247, 250); doc.rect(margin, y - 13, usableWidth, 20, 'F'); }
    doc.setFontSize(8); cols.forEach((col, index) => doc.text(String(row[col.key] ?? ''), margin + index * colWidth + 6, y, { maxWidth: colWidth - 12, align: direction === 'rtl' ? 'right' : 'left' })); y += 20;
  });
  doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(`Generated ${new Date().toISOString()}`, margin, pageHeight - 18);
  doc.save(`${filename}.pdf`);
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface ExportHeader {
  key: string;
  label: string;
}

export interface StructuredExportMeta {
  /** Worksheet name used by the Excel metadata sheet. */
  sheetName: string;
  generatedAt: string;
  recordsCount: string;
  filters: string;
  allRecords: string;
}

export interface StructuredExportOptions {
  /** Report heading (printable view + Excel metadata sheet). */
  title?: string;
  /** Applied filters surfaced in the export header / metadata sheet. */
  filters?: Record<string, string | number>;
  /** Excel column widths in character units, aligned with the header order. */
  widths?: number[];
  /** Worksheet name for the exported data table. */
  sheetName?: string;
  direction?: 'rtl' | 'ltr';
  /** Localized metadata labels. When omitted the Excel metadata sheet is skipped. */
  meta?: StructuredExportMeta;
}

/** Placeholder used when a registry field has no value. */
export const EXPORT_EMPTY_VALUE = '—';

const EXPORT_SHEET_NAME_MAX = 31;
const PRINT_FRAME_ID = 'codeline-print-frame';

/**
 * Formats a timestamp for exports using a stable, locale independent and
 * sortable shape (YYYY-MM-DD HH:mm) so spreadsheets stay filterable.
 */
export function formatExportDateTime(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sanitizeSheetName(name: string, fallback: string): string {
  const cleaned = String(name || '').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || fallback).slice(0, EXPORT_SHEET_NAME_MAX);
}

function normalizeExportCell(value: any): string | number {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatExportDateTime(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return String(value);
}

function estimateColumnWidth(label: string, rows: Record<string, any>[], key: string): number {
  let longest = String(label ?? '').length;
  const sampleSize = Math.min(rows.length, 250);
  for (let index = 0; index < sampleSize; index += 1) {
    const text = String(rows[index]?.[key] ?? '');
    if (text.length > longest) longest = text.length;
  }
  return Math.min(Math.max(longest + 3, 10), 45);
}

function buildFilterSummary(filters?: Record<string, string | number>): string {
  if (!filters) return '';
  return Object.entries(filters)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ');
}

function buildInfoRows(options: StructuredExportOptions, recordsCount: number): (string | number)[][] {
  const meta = options.meta!;
  const rows: (string | number)[][] = [];
  if (options.title) rows.push([options.title, '']);
  rows.push([meta.generatedAt, formatExportDateTime(new Date())]);
  rows.push([meta.recordsCount, recordsCount]);
  rows.push([meta.filters, buildFilterSummary(options.filters) || meta.allRecords]);
  return rows;
}

/**
 * Exports rows as a tidy Excel workbook:
 * ordered columns, sized columns, a filterable header row, RTL sheet support and
 * an optional metadata sheet describing the applied filters and record count.
 */
export async function exportToXlsx(
  filename: string,
  rows: Record<string, any>[],
  headers?: ExportHeader[],
  options: StructuredExportOptions = {}
) {
  if (!rows || rows.length === 0) return;

  const XLSX = await import('xlsx');
  const cols = headers || Object.keys(rows[0]).map((key) => ({ key, label: key }));

  const table: (string | number)[][] = [
    cols.map((col) => col.label),
    ...rows.map((row) => cols.map((col) => normalizeExportCell(row[col.key]))),
  ];

  const dataSheet = XLSX.utils.aoa_to_sheet(table);
  dataSheet['!cols'] = cols.map((col, index) => ({
    wch: options.widths?.[index] ?? estimateColumnWidth(col.label, rows, col.key),
  }));
  dataSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: Math.max(cols.length - 1, 0) },
    }),
  };

  const workbook = XLSX.utils.book_new();
  if (options.direction === 'rtl') workbook.Workbook = { Views: [{ RTL: true }] };

  if (options.meta) {
    const infoSheet = XLSX.utils.aoa_to_sheet(buildInfoRows(options, rows.length));
    infoSheet['!cols'] = [{ wch: 26 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, infoSheet, sanitizeSheetName(options.meta.sheetName, 'Info'));
  }

  XLSX.utils.book_append_sheet(workbook, dataSheet, sanitizeSheetName(options.sheetName || filename, 'Data'));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export interface PrintableTableOptions extends StructuredExportOptions {
  filename: string;
  title: string;
  rows: Record<string, any>[];
  headers?: ExportHeader[];
}

function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface PrintableHtmlParts {
  filename: string;
  title: string;
  direction: 'rtl' | 'ltr';
  stamp: string;
  filterSummary: string;
  recordCount: number;
  labels: StructuredExportMeta;
  headCells: string;
  bodyRows: string;
}

function buildPrintableHtml(parts: PrintableHtmlParts): string {
  const { filename, title, direction, stamp, filterSummary, recordCount, labels, headCells, bodyRows } = parts;
  return `<!DOCTYPE html>
<html dir="${direction}" lang="${direction === 'rtl' ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(filename)}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 landscape; margin: 10mm; }
  body { margin: 0; padding: 0; color: #1e293b; background: #ffffff;
    font-family: 'Segoe UI', Tahoma, 'Tajawal', 'Noto Naskh Arabic', Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { border-bottom: 2px solid #5b21b6; padding-bottom: 6px; margin-bottom: 10px; }
  .brand { font-size: 10px; font-weight: 700; color: #7c3aed; letter-spacing: 1px; }
  h1 { font-size: 16px; margin: 4px 0 6px; color: #5b21b6; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 10px; color: #64748b; }
  .meta b { color: #334155; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { background: #5b21b6; color: #ffffff; border: 1px solid #4c1d95; padding: 5px 4px;
    text-align: start; font-weight: 700; vertical-align: middle; }
  td { border: 1px solid #dbe2ea; padding: 4px; vertical-align: top; word-break: break-word; }
  tbody tr:nth-child(even) td { background: #f5f7fa; }
  .foot { margin-top: 8px; font-size: 9px; color: #94a3b8; }
</style>
</head>
<body>
  <header class="head">
    <div class="brand">CODELINE</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <span><b>${escapeHtml(labels.generatedAt)}:</b> ${escapeHtml(stamp)}</span>
      <span><b>${escapeHtml(labels.recordsCount)}:</b> ${recordCount}</span>
      <span><b>${escapeHtml(labels.filters)}:</b> ${escapeHtml(filterSummary)}</span>
    </div>
  </header>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="foot">${escapeHtml(title)} — ${escapeHtml(stamp)}</div>
</body>
</html>`;
}

/**
 * Renders the rows as a printable document and triggers the browser print dialog
 * ("Save as PDF"). Compared to the jsPDF path this keeps Arabic text, RTL order
 * and wide tables readable, repeats the header row on every page and never
 * truncates long values.
 */
export function exportToPrintableTable(options: PrintableTableOptions): boolean {
  const { filename, title, rows, headers, filters, direction = 'ltr', meta } = options;
  if (typeof document === 'undefined' || !rows || rows.length === 0) return false;

  const cols = headers || Object.keys(rows[0]).map((key) => ({ key, label: key }));
  const labels = meta || {
    sheetName: 'Info',
    generatedAt: 'Generated at',
    recordsCount: 'Records exported',
    filters: 'Applied filters',
    allRecords: 'All records',
  };
  const filterSummary = buildFilterSummary(filters) || labels.allRecords;
  const stamp = formatExportDateTime(new Date());

  document.getElementById(PRINT_FRAME_ID)?.remove();
  const frame = document.createElement('iframe');
  frame.id = PRINT_FRAME_ID;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.position = 'fixed';
  frame.style.insetInlineEnd = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const targetDocument = frame.contentDocument || frame.contentWindow?.document;
  if (!targetDocument) {
    frame.remove();
    return false;
  }

  const headCells = cols.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${cols.map((col) => `<td>${escapeHtml(row[col.key])}</td>`).join('')}</tr>`)
    .join('');

  targetDocument.open();
  targetDocument.write(buildPrintableHtml({ filename, title, direction, stamp, filterSummary, labels, headCells, bodyRows, recordCount: rows.length }));
  targetDocument.close();

  const printWindow = frame.contentWindow;
  setTimeout(() => {
    try {
      printWindow?.focus();
      printWindow?.print();
    } catch {
      /* printing is best-effort; the frame stays available for manual printing */
    }
    setTimeout(() => frame.remove(), 120000);
  }, 300);

  return true;
}

