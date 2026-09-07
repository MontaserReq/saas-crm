/**
 * Structured report exports. The UI intentionally exposes PDF only.
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
