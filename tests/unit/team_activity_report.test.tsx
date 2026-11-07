// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/context';
import { TeamActivityReportView } from '@/components/reports/TeamActivityReportView';
import type { TeamActivityReport } from '@/server/services/TeamActivityReportService';

const mocks = vi.hoisted(() => ({ load: vi.fn(), export: vi.fn(), print: vi.fn() }));
vi.mock('@/server/actions/teamActivityReport', () => ({ getTeamActivityReportAction: mocks.load, exportTeamActivityReportAction: mocks.export }));
vi.mock('@/lib/export', () => ({ exportToPrintableTable: mocks.print }));

const operation = (id: string, index: number) => ({ id, kind: 'ticket' as const, label: 'إنشاء تذكرة', occurredAt: `2026-10-29T0${Math.min(index, 9)}:00:00.000Z`, detail: `Ticket detail ${index}`, ticketNumber: `T-${index}`, ticketSubject: `Subject ${index}`, schoolName: 'Al Noor' });
const report: TeamActivityReport = {
  date: '2026-10-29', timezone: 'Asia/Riyadh', employeeId: '', search: '', members: [
    { id: 'active', name: 'Active employee', department: 'Sales', email: 'active@example.test', status: 'WORKED', stats: { ticketsCreated: 12, schoolsAdded: 0, notesAdded: 0, communications: 0, assignments: 0, ticketUpdates: 0, total: 12 }, operations: Array.from({ length: 12 }, (_, index) => operation(`op-${index}`, index)) },
    { id: 'idle', name: 'Idle employee', department: 'Support', email: 'idle@example.test', status: 'NO_ACTIVITY', stats: { ticketsCreated: 0, schoolsAdded: 0, notesAdded: 0, communications: 0, assignments: 0, ticketUpdates: 0, total: 0 }, operations: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks(); localStorage.setItem('codeline_lang', 'en');
  mocks.load.mockResolvedValue({ success: true, report });
  mocks.export.mockResolvedValue({ success: true, report });
  mocks.print.mockReturnValue(true);
});
afterEach(cleanup);

function renderReport() { return render(<I18nProvider initialLanguage="en"><TeamActivityReportView initialReport={report} canExport /></I18nProvider>); }

describe('team activity report', () => {
  it('shows active and idle employees and expands only the extra operations', async () => {
    renderReport();
    expect(screen.getByText('Worked today')).toBeTruthy();
    expect(screen.getAllByText('No activity recorded').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: '+ 4 more operations' })).toBeTruthy();
    expect(screen.getByText(/Ticket detail 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ 4 more operations' }));
    expect(screen.getByRole('button', { name: 'Hide extra operations' })).toBeTruthy();
    expect(screen.getByText(/Ticket detail 11/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide extra operations' }));
    expect(screen.queryByText(/Ticket detail 11/)).toBeNull();
  });

  it('reloads when the date, employee, or search filter changes', async () => {
    renderReport();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-28' } });
    fireEvent.change(screen.getByLabelText('Employee'), { target: { value: 'active' } });
    fireEvent.change(screen.getByLabelText('Search employee or activity details'), { target: { value: 'Al Noor' } });
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith({ date: '2026-10-28', userId: 'active', search: 'Al Noor' }));
  });

  it('authorizes and exports the filtered report as an RTL-safe printable PDF', async () => {
    renderReport();
    fireEvent.change(screen.getByLabelText('Employee'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export report PDF' }));
    await waitFor(() => expect(mocks.export).toHaveBeenCalledWith({ date: '2026-10-29', userId: 'active', search: undefined }));
    expect(mocks.print).toHaveBeenCalledWith(expect.objectContaining({ filename: 'تقرير-نشاط-الفريق-2026-10-29', direction: 'ltr' }));
  });
});
