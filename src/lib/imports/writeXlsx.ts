import { strToU8, zipSync } from 'fflate';

export type XlsxCell = string | number | boolean | null | undefined;
export type XlsxSheet = {
  name: string;
  rows: XlsxCell[][];
  widths?: number[];
  autoFilter?: boolean;
  rtl?: boolean;
};

function xml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function safeSheetName(name: string, fallback: string) {
  return (String(name || '').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim() || fallback).slice(0, 31);
}

function cellXml(value: XlsxCell, row: number, column: number) {
  if (value === null || value === undefined) return '';
  const reference = `${columnName(column)}${row + 1}`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`;
  if (typeof value === 'boolean') return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  // Inline strings prevent user-controlled values beginning with =, +, -, or @
  // from becoming executable spreadsheet formulas.
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function worksheetXml(sheet: XlsxSheet) {
  const rows = sheet.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => cellXml(value, rowIndex, columnIndex)).join('')}</row>`).join('');
  const columns = sheet.widths?.length
    ? `<cols>${sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(Math.max(width, 1), 255)}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const maxColumns = sheet.rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  const autoFilter = sheet.autoFilter && sheet.rows.length > 0 && maxColumns > 0
    ? `<autoFilter ref="A1:${columnName(maxColumns - 1)}${sheet.rows.length}"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${sheet.rtl ? ' rightToLeft="1"' : ''}/></sheetViews>${columns}<sheetData>${rows}</sheetData>${autoFilter}</worksheet>`;
}

/** Creates a standards-based, macro-free XLSX archive without parsing input. */
export function createXlsx(sheets: XlsxSheet[]): Uint8Array {
  if (!sheets.length) throw new Error('At least one worksheet is required');
  const normalized = sheets.map((sheet, index) => ({ ...sheet, name: safeSheetName(sheet.name, `Sheet${index + 1}`) }));
  if (new Set(normalized.map((sheet) => sheet.name.toLowerCase())).size !== normalized.length) throw new Error('Worksheet names must be unique');

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${normalized.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${normalized.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalized.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${normalized.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>'),
  };
  normalized.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet)); });
  return zipSync(files, { level: 6 });
}

export function downloadXlsx(filename: string, sheets: XlsxSheet[]) {
  const bytes = createXlsx(sheets);
  const payload = new Uint8Array(bytes.length);
  payload.set(bytes);
  const blob = new Blob([payload.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
