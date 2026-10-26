import { describe, expect, it, vi } from 'vitest';
import { detectDestination, inferColumnType, normalizeHeader, parseTypedValue, safeCsvCell, suggestColumns } from '@/lib/imports/smartImport';
import { createXlsx } from '@/lib/imports/writeXlsx';

vi.mock('server-only', () => ({}));

describe('smart CRM import mapping', () => {
  it('normalizes Arabic and English headers and recommends a destination only when sufficiently distinct', () => {
    expect(normalizeHeader('  البريد الإلكتروني ')).toBe('البريد الالكتروني');
    expect(detectDestination(['Deal Name', 'Amount', 'Expected Close Date']).destination).toBe('DEAL');
    expect(detectDestination(['Name', 'Email', 'Phone']).ambiguous).toBe(true);
  });

  it('maps Arabic client headers with explanations and sample values', () => {
    const rows = [{ 'اسم العميل': 'شركة الأفق', 'رقم الجوال': '+962 79 123 4567', 'البريد الإلكتروني': 'info@example.com' }];
    const suggestions = suggestColumns(Object.keys(rows[0]), rows, 'CLIENT');
    expect(suggestions.find((item) => item.source === 'اسم العميل')?.suggestedField).toBe('name');
    expect(suggestions.find((item) => item.source === 'رقم الجوال')?.suggestedField).toBe('phone');
    expect(suggestions.find((item) => item.source === 'البريد الإلكتروني')).toMatchObject({ suggestedField: 'email', inferredType: 'EMAIL' });
  });

  it('infers common custom-field types and validates typed values', () => {
    expect(inferColumnType(['2026-01-01', '2026-02-20'])).toBe('DATE');
    expect(inferColumnType(['yes', 'no', 'true'])).toBe('BOOLEAN');
    expect(inferColumnType(['USD 1,200', '$99.50'])).toBe('CURRENCY');
    expect(parseTypedValue('not-an-email', { key: 'email', label: 'Email', labelAr: 'Email', type: 'EMAIL', aliases: [] }).error).toContain('valid email');
    expect(parseTypedValue('125', { key: 'probability', label: 'Probability', labelAr: 'Probability', type: 'NUMBER', aliases: [] }).error).toContain('between 0 and 100');
  });

  it('protects downloadable CSV cells from spreadsheet formula injection', () => {
    expect(safeCsvCell('=HYPERLINK("https://example.test")')).toMatch(/^"'/);
    expect(safeCsvCell('+cmd')).toBe('"\'+cmd"');
    expect(safeCsvCell('ordinary')).toBe('"ordinary"');
  });
});

describe('smart spreadsheet parsing', () => {
  it('resolves safe import capacity by plan', async () => {
    const { resolveSmartImportLimits } = await import('@/lib/imports/parseSpreadsheet');
    const starter = resolveSmartImportLimits('starter');
    const growth = resolveSmartImportLimits('growth');
    const scale = resolveSmartImportLimits('scale');
    const enterprise = resolveSmartImportLimits('enterprise');

    expect(starter.maxFileBytes).toBe(25 * 1024 * 1024);
    expect(starter.maxRows).toBe(10_000);
    expect(growth.maxRows).toBeGreaterThan(starter.maxRows);
    expect(scale.maxRows).toBeGreaterThan(growth.maxRows);
    expect(enterprise.maxRows).toBeGreaterThan(scale.maxRows);
    expect(resolveSmartImportLimits('unknown-plan')).toEqual(starter);
  });

  it('parses standard XLSX and preserves reordered columns', async () => {
    const { parseSpreadsheet } = await import('@/lib/imports/parseSpreadsheet');
    const buffer = Buffer.from(createXlsx([{ name: 'Clients', rows: [['Email', 'Client Name'], ['a@example.com', 'A']] }]));
    const parsed = await parseSpreadsheet({ buffer, filename: 'clients.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(parsed.headers).toEqual(['Email', 'Client Name']);
    expect(parsed.rows[0]).toEqual({ Email: 'a@example.com', 'Client Name': 'A' });
  }, 20_000);

  it('rejects legacy XLS because the maintained parser does not safely support it', async () => {
    const { parseSpreadsheet } = await import('@/lib/imports/parseSpreadsheet');
    const buffer = Buffer.from('synthetic legacy workbook');
    await expect(parseSpreadsheet({ buffer, filename: 'leads.xls', mimeType: 'application/vnd.ms-excel' })).rejects.toThrow(/saved as \.xlsx or \.csv/i);
    await expect(parseSpreadsheet({ buffer: Buffer.from('not-xls'), filename: 'leads.xls' })).rejects.toThrow(/saved as \.xlsx or \.csv/i);
  });

  it('parses CSV with Arabic headers and rejects empty or malformed uploads', async () => {
    const { parseSpreadsheet } = await import('@/lib/imports/parseSpreadsheet');
    const parsed = await parseSpreadsheet({ buffer: Buffer.from('\uFEFFاسم العميل,البريد الإلكتروني\nشركة,info@example.com', 'utf8'), filename: 'clients.csv', mimeType: 'text/csv' });
    expect(parsed.headers).toEqual(['اسم العميل', 'البريد الإلكتروني']);
    expect(parsed.rows).toHaveLength(1);
    await expect(parseSpreadsheet({ buffer: Buffer.alloc(0), filename: 'empty.csv' })).rejects.toThrow(/empty/i);
    await expect(parseSpreadsheet({ buffer: Buffer.from('bad'), filename: 'bad.xlsx' })).rejects.toThrow(/signature/i);
    await expect(parseSpreadsheet({ buffer: Buffer.from('Name\nA'), filename: 'mismatch.csv', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).rejects.toThrow(/does not match/i);
  });

  it('exposes each worksheet instead of combining datasets silently', async () => {
    const { parseSpreadsheet } = await import('@/lib/imports/parseSpreadsheet');
    const buffer = Buffer.from(createXlsx([
      { name: 'Clients', rows: [['Client Name'], ['A']] },
      { name: 'Deals', rows: [['Deal Name'], ['D']] },
    ]));
    const parsed = await parseSpreadsheet({ buffer, filename: 'mixed.xlsx', sheetName: 'Deals' });
    expect(parsed.sheetNames).toEqual(['Clients', 'Deals']);
    expect(parsed.selectedSheet).toBe('Deals');
    expect(parsed.headers).toEqual(['Deal Name']);
  });

  it('rejects a CSV above the supported synchronous row limit', async () => {
    const { parseSpreadsheet, SMART_IMPORT_LIMITS } = await import('@/lib/imports/parseSpreadsheet');
    const csv = ['Name', ...Array.from({ length: SMART_IMPORT_LIMITS.maxRows + 1 }, (_, index) => `Client ${index}`)].join('\n');
    await expect(parseSpreadsheet({ buffer: Buffer.from(csv), filename: 'large.csv', mimeType: 'text/csv' })).rejects.toThrow(/supported limit/i);
  });

  it('rejects a workbook whose declared expansion exceeds the safe processing bound', async () => {
    const { parseSpreadsheet } = await import('@/lib/imports/parseSpreadsheet');
    const buffer = Buffer.from(createXlsx([{ name: 'Data', rows: [['Name'], ['Synthetic']] }]));
    const centralEntry = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(centralEntry).toBeGreaterThanOrEqual(0);
    buffer.writeUInt32LE(60 * 1024 * 1024, centralEntry + 24);
    await expect(parseSpreadsheet({ buffer, filename: 'crafted.xlsx' })).rejects.toThrow(/expands beyond/i);
  });

  it('terminates XLSX parsing when the hard worker deadline is exceeded', async () => {
    const { parseSpreadsheet } = await import('@/lib/imports/parseSpreadsheet');
    const buffer = Buffer.from(createXlsx([{ name: 'Data', rows: [['Name'], ['Synthetic']] }]));
    await expect(parseSpreadsheet({ buffer, filename: 'deadline.xlsx', processingTimeoutMs: 1 })).rejects.toThrow(/safe time limit/i);
  });
});
