import { describe, expect, it } from 'vitest';
import { buildSchoolExportColumns, buildSchoolExportRows } from '@/lib/schools/export';
import { formatExportDateTime } from '@/lib/export';

const labels = {
  index: '#',
  schoolName: 'اسم المدرسة',
  classification: 'التصنيف',
  schoolType: 'نوع المدرسة',
  city: 'المدينة',
  area: 'المنطقة / الحي',
  contactPerson: 'الشخص المسؤول / المنسق',
  phone: 'رقم الهاتف',
  whatsapp: 'الواتساب',
  email: 'البريد الإلكتروني',
  status: 'الحالة',
  responsibleEmployee: 'الموظف المسؤول',
  ticketsCount: 'عدد التذاكر',
  notes: 'ملاحظات',
  addedBy: 'أضيفت بواسطة',
  addedAt: 'تاريخ الإضافة',
  lastUpdatedAt: 'آخر تحديث',
  unassignedEmployee: 'غير مكلف',
  schoolTypeLabel: (value?: string | null) => (value === 'PRIVATE' ? 'خاصة' : value || ''),
  statusLabel: (value?: string | null) => (value === 'ASSIGNED' ? 'موزعة / مكلفة' : value || ''),
};

const headerOrder = [
  '#',
  'اسم المدرسة',
  'التصنيف',
  'نوع المدرسة',
  'المدينة',
  'المنطقة / الحي',
  'الشخص المسؤول / المنسق',
  'رقم الهاتف',
  'الواتساب',
  'البريد الإلكتروني',
  'الحالة',
  'الموظف المسؤول',
  'عدد التذاكر',
  'ملاحظات',
  'أضيفت بواسطة',
  'تاريخ الإضافة',
  'آخر تحديث',
];

describe('schools registry export', () => {
  it('exposes every registry field in a fixed, organized order', () => {
    expect(buildSchoolExportColumns(labels).map((column) => column.header)).toEqual(headerOrder);
  });

  it('maps a complete school record and keeps counts numeric', () => {
    const columns = buildSchoolExportColumns(labels);
    const rows = buildSchoolExportRows(
      [
        {
          name: 'مدرسة الأمل الدولية',
          classification: 'A',
          schoolType: 'PRIVATE',
          city: 'Amman',
          area: 'Khalda',
          contactPerson: 'د. أحمد الخطيب',
          phone: '0790000000',
          whatsapp: '+962 7 9000 0000',
          email: 'info@alamal.edu.jo',
          status: 'ASSIGNED',
          responsibleEmployee: { name: 'حلا عبدالله' },
          _count: { tickets: 3 },
          notes: 'متابعة الأسبوع القادم',
          createdBy: { name: 'Montaser' },
          createdAt: '2026-01-05T08:30:00.000Z',
          updatedAt: '2026-02-01T11:45:00.000Z',
        },
      ],
      columns
    );

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(Object.keys(row)).toEqual(headerOrder);
    expect(row['#']).toBe(1);
    expect(row['نوع المدرسة']).toBe('خاصة');
    expect(row['الحالة']).toBe('موزعة / مكلفة');
    expect(row['الموظف المسؤول']).toBe('حلا عبدالله');
    expect(row['أضيفت بواسطة']).toBe('Montaser');
    expect(row['عدد التذاكر']).toBe(3);
    expect(String(row['تاريخ الإضافة'])).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(String(row['آخر تحديث'])).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('uses placeholders for empty fields and keeps numbering continuous', () => {
    const columns = buildSchoolExportColumns(labels);
    const rows = buildSchoolExportRows(
      [
        { name: 'مدرسة بلا بيانات', city: 'Irbid', classification: 'C', status: 'ACTIVE' },
        { name: 'مدرسة ثانية', city: 'Zarqa', classification: 'B', status: 'ACTIVE', _count: { tickets: 0 } },
      ],
      columns
    );

    expect(rows[0]['المنطقة / الحي']).toBe('—');
    expect(rows[0]['رقم الهاتف']).toBe('—');
    expect(rows[0]['الموظف المسؤول']).toBe('غير مكلف');
    expect(rows[0]['عدد التذاكر']).toBe(0);
    expect(rows[0]['ملاحظات']).toBe('—');
    expect(rows[1]['#']).toBe(2);
  });

  it('formats export timestamps in a stable sortable shape', () => {
    expect(formatExportDateTime(null)).toBe('');
    expect(formatExportDateTime('not-a-date')).toBe('');
    expect(formatExportDateTime(new Date(2026, 0, 9, 7, 5))).toBe('2026-01-09 07:05');
  });
});
