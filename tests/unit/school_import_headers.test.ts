import { describe, expect, it } from 'vitest';
import { mapSchoolImportRow, matchImportEmployee, normalizeImportPhone, resolveImportHeaders } from '@/lib/schools/import';

const status = 'حالة المدرسة';
const contactResult = 'نتيجة آخر تواصل / تفاصيل المكالمات';

describe('school Excel import', () => {
  it('maps by header rather than position and ignores blank columns', () => {
    const headers = ['School Name', 'Responsible Employee', 'Area / City', '__EMPTY', 'School Classification', 'Phone', 'Email', contactResult, status];
    const resolved = resolveImportHeaders(headers);
    const row = mapSchoolImportRow(Object.fromEntries(headers.map((h) => [h, h === 'School Name' ? 'Ayla School' : h === 'Responsible Employee' ? 'Hela' : h === 'Area / City' ? 'Tabarbour' : h === 'School Classification' ? 'b' : h === 'Phone' ? '0799631111 arbitrary text' : h === 'Email' ? ' Info@aya.edu.jo ' : 'INVALID STATUS'])), resolved);
    expect(row).toEqual({ name: 'Ayla School', contactPerson: 'Hela', city: 'Tabarbour', classification: 'B', phone: '0799631111', email: 'Info@aya.edu.jo' });
    expect(resolved.mapped.size).toBe(6);
    expect(resolved.ignored.get(status)?.ignored).toBe(true);
    expect(resolved.ignored.get(contactResult)?.ignored).toBe(true);
  });

  it.each([
    ['0799631111 رقم الاستقبال', '0799631111'], ['(06) 553 5190', '065535190'], ['07 7042 4100', '0770424100'],
    ['+962780728761', '0780728761'], ['962790203683', '0790203683'], ['هاتف 065343991', '065343991'], ['962795311464//065058666', '0795311464'],
  ])('normalizes phone %s', (input, expected) => expect(normalizeImportPhone(input)).toBe(expected));

  it.each([
    ['A', 'A'],
    ['b', 'B'],
    [' C ', 'C'],
    ['أ', 'A'],
    ['ب', 'B'],
    ['ج', 'C'],
    ['فئة أ', 'A'],
    ['فئة ب', 'B'],
    ['فئة ج', 'C'],
    ['Class A', 'A'],
    ['', ''],
    ['غير محدد', ''],
  ])('normalizes classification %s to %s', (value, expected) => {
    expect(mapSchoolImportRow({ 'School Name': 'School', 'School Classification': value }).classification).toBe(expected);
  });

  it('handles placeholders for responsible employee as null', () => {
    expect(mapSchoolImportRow({ 'School Name': 'School', 'Responsible Employee': 'لا يوجد' }).contactPerson).toBeNull();
    expect(mapSchoolImportRow({ 'School Name': 'School', 'Responsible Employee': '-' }).contactPerson).toBeNull();
    expect(mapSchoolImportRow({ 'School Name': 'School', 'Responsible Employee': '—' }).contactPerson).toBeNull();
    expect(mapSchoolImportRow({ 'School Name': 'School', 'Responsible Employee': 'بدون' }).contactPerson).toBeNull();
    expect(mapSchoolImportRow({ 'School Name': 'School', 'Responsible Employee': '  ' }).contactPerson).toBeNull();
  });

  it('only requires name header and makes classification optional', () => {
    const resolved = resolveImportHeaders(['School Name', 'Phone']);
    expect(resolved.missingRequired).toEqual([]);
    expect(resolved.missingOptional).toContain('classification');
    expect(resolved.missingOptional).toContain('contactPerson');
  });

  it('matches unique employee short names without guessing ambiguous matches', () => {
    const employees = [{ id: '1', name: 'حلا عبدالله', email: 'hala@example.com' }, { id: '2', name: 'حمزة النجار', email: 'hamza@example.com' }];
    expect(matchImportEmployee('حلا', employees)?.name).toBe('حلا عبدالله');
    expect(matchImportEmployee('حمزة', employees)?.name).toBe('حمزة النجار');
    expect(matchImportEmployee('غير موجود', employees)).toBeUndefined();
    expect(matchImportEmployee('لا يوجد', employees)).toBeUndefined();
    expect(matchImportEmployee('-', employees)).toBeUndefined();
  });

  it('does not assign a responsible employee when a short name is ambiguous', () => {
    const employees = [
      { id: '1', name: 'Hala Abdullah', email: 'hala.a@example.com' },
      { id: '2', name: 'Hala Ahmad', email: 'hala.b@example.com' },
    ];
    expect(matchImportEmployee('Hala', employees)).toBeUndefined();
  });

  it('does not expose status, notes, or contact-result fields', () => {
    const row = mapSchoolImportRow({ 'School Name': 'School', 'School Classification': 'A', [status]: 'مؤجل', [contactResult]: 'anything' });
    expect(row).not.toHaveProperty('status');
    expect(row).not.toHaveProperty('notes');
    expect(row).not.toHaveProperty('lastContact');
  });

  it('treats missing optional fields as null and keeps required cells empty', () => {
    expect(mapSchoolImportRow({ 'School Name': '', 'School Classification': '' })).toMatchObject({ name: '', classification: '', phone: null, email: null });
  });
});
