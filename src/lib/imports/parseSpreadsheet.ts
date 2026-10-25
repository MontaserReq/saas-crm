import 'server-only';
import Papa from 'papaparse';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { containsOfficeMacros, inspectZipArchive } from '@/lib/security/zip';

export const SMART_IMPORT_LIMITS = {
  maxFileBytes: Number(process.env.CRM_IMPORT_MAX_FILE_BYTES) || 5 * 1024 * 1024,
  maxRows: Number(process.env.CRM_IMPORT_MAX_ROWS) || 2_000,
  maxColumns: Number(process.env.CRM_IMPORT_MAX_COLUMNS) || 80,
  maxCells: Number(process.env.CRM_IMPORT_MAX_CELLS) || 100_000,
  maxCellCharacters: 10_000,
  maxProcessingMs: 10_000,
  draftRetentionHours: 24,
  resultRetentionDays: 30,
} as const;

const spreadsheetMimeTypes = {
  xlsx: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  csv: new Set(['text/csv', 'application/csv', 'text/plain']),
};

export type ParsedSpreadsheet = {
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rows: Record<string, string | number | boolean | null>[];
};

function cleanCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).replace(/\u0000/g, '').trim();
  if (text.length > SMART_IMPORT_LIMITS.maxCellCharacters) throw new Error('A cell exceeds the maximum supported length');
  return text;
}

type ParsedXlsxSheet = { sheet: string; data: unknown[][] };

function readXlsxInWorker(buffer: Buffer, timeoutMs: number): Promise<ParsedXlsxSheet[]> {
  // A real file is required here. Webpack can turn require.resolve() into a
  // numeric module id, which a native Node worker cannot resolve.
  const workerPath = path.join(process.cwd(), 'src', 'lib', 'imports', 'xlsxParserWorker.cjs');
  return new Promise((resolve, reject) => {
    const workerDeadline = Date.now() + timeoutMs;
    const worker = new Worker(workerPath, {
      workerData: { buffer },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (operation: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      operation();
    };
    const parsingFailure = () => new Error(Date.now() >= workerDeadline
      ? 'Spreadsheet processing exceeded the safe time limit'
      : 'The spreadsheet is malformed or cannot be parsed safely');
    const timer = setTimeout(() => finish(() => reject(new Error('Spreadsheet processing exceeded the safe time limit'))), timeoutMs);
    worker.once('message', (message: { ok?: boolean; sheets?: ParsedXlsxSheet[] }) => {
      if (!message?.ok || !Array.isArray(message.sheets)) return finish(() => reject(parsingFailure()));
      finish(() => resolve(message.sheets!));
    });
    worker.once('error', () => finish(() => reject(parsingFailure())));
    worker.once('exit', (code) => {
      if (!settled && code !== 0) finish(() => reject(parsingFailure()));
    });
  });
}

export async function parseSpreadsheet(input: { buffer: Buffer; filename: string; mimeType?: string | null; sheetName?: string | null; processingTimeoutMs?: number }): Promise<ParsedSpreadsheet> {
  const processingTimeoutMs = Math.max(1, Math.min(input.processingTimeoutMs ?? SMART_IMPORT_LIMITS.maxProcessingMs, SMART_IMPORT_LIMITS.maxProcessingMs));
  const deadline = Date.now() + processingTimeoutMs;
  const ensureWithinDeadline = () => { if (Date.now() > deadline) throw new Error('Spreadsheet processing exceeded the safe time limit'); };
  const { buffer, filename } = input;
  if (!buffer.length) throw new Error('The selected file is empty');
  if (buffer.length > SMART_IMPORT_LIMITS.maxFileBytes) throw new Error(`The maximum file size is ${Math.floor(SMART_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB`);
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension || !['xlsx', 'csv'].includes(extension)) throw new Error('Unsupported file type. Use .xlsx or .csv. Legacy .xls files must be saved as .xlsx or .csv before import.');
  if (input.mimeType && input.mimeType !== 'application/octet-stream' && !spreadsheetMimeTypes[extension as 'xlsx' | 'csv'].has(input.mimeType)) throw new Error('The file content type does not match its extension');
  if (extension === 'xlsx') {
    if (buffer.length < 4 || buffer.subarray(0, 2).toString() !== 'PK') throw new Error('The XLSX file signature is invalid');
    const archive = inspectZipArchive(buffer, { maxEntries: 5_000, maxUncompressedBytes: 50 * 1024 * 1024 });
    if (!archive.entries.includes('xl/workbook.xml')) throw new Error('The XLSX workbook structure is invalid');
    if (containsOfficeMacros(archive.entries)) throw new Error('Macro-enabled workbooks are not supported');
  }
  ensureWithinDeadline();
  let sheetNames: string[];
  let selectedSheet: string;
  let matrix: unknown[][];
  if (extension === 'csv') {
    const parsed = Papa.parse<string[]>(buffer.toString('utf8').replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
    const fatalError = parsed.errors.find((error) => error.code !== 'UndetectableDelimiter');
    if (fatalError) throw new Error(`The CSV file is malformed near row ${fatalError.row !== undefined ? fatalError.row + 1 : 1}`);
    sheetNames = ['CSV'];
    selectedSheet = 'CSV';
    if (input.sheetName && input.sheetName !== selectedSheet) throw new Error('The selected worksheet does not exist');
    matrix = parsed.data;
  } else {
    let sheets;
    try {
      // This maintained reader extracts cell values only. Formulas, VBA,
      // embedded objects, hyperlinks, HTML, and workbook code are not run.
      sheets = await readXlsxInWorker(buffer, Math.max(1, deadline - Date.now()));
    } catch (error) {
      if (error instanceof Error && error.message.includes('safe time limit')) throw error;
      throw new Error('The spreadsheet is malformed or cannot be parsed safely');
    }
    sheetNames = sheets.map((sheet) => sheet.sheet);
    if (!sheetNames.length) throw new Error('The workbook has no worksheets');
    selectedSheet = input.sheetName || sheetNames[0];
    const sheet = sheets.find((item) => item.sheet === selectedSheet);
    if (!sheet) throw new Error('The selected worksheet does not exist');
    matrix = sheet.data;
  }
  ensureWithinDeadline();
  if (!matrix.length || !Array.isArray(matrix[0])) throw new Error('The worksheet has no header row');
  const rawHeaders = matrix[0];
  if (!rawHeaders.length || rawHeaders.every((header) => !String(header ?? '').trim())) throw new Error('The worksheet has no named columns');
  if (rawHeaders.length > SMART_IMPORT_LIMITS.maxColumns) throw new Error(`The worksheet exceeds ${SMART_IMPORT_LIMITS.maxColumns} columns`);
  if (matrix.length - 1 > SMART_IMPORT_LIMITS.maxRows || matrix.length * rawHeaders.length > SMART_IMPORT_LIMITS.maxCells) throw new Error(`The worksheet exceeds the supported limit of ${SMART_IMPORT_LIMITS.maxRows} data rows`);

  const seen = new Map<string, number>();
  const headers = rawHeaders.map((header, index) => {
    const base = String(header ?? '').replace(/\u0000/g, '').trim().slice(0, 200) || `Unnamed column ${index + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
  const rows = matrix.slice(1)
    .filter((row) => Array.isArray(row) && row.some((value) => value !== '' && value !== null && value !== undefined))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, cleanCell(Array.isArray(row) ? row[index] : null)])));
  ensureWithinDeadline();
  if (!rows.length) throw new Error('The worksheet contains headers but no data rows');
  return { sheetNames, selectedSheet, headers, rows };
}
