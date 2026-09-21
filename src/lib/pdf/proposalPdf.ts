import jsPDF from 'jspdf';

export interface ProposalPdfData {
  id: string;
  title: string;
  clientName: string;
  contactPerson?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  createdAt: string | Date;
  status: string;
  services: Array<{
    title: string;
    description?: string;
    price?: string;
  }>;
  terms?: string | null;
  notes?: string | null;
  schoolLogoUrl?: string | null;
}

export async function generateProposalPdf(data: ProposalPdfData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Primary CodeLine Brand Palette
  const brandDark = [88, 28, 135]; // #581c87 (deep purple)
  const brandPrimary = [124, 58, 237]; // #7c3aed (brand purple)
  const textDark = [30, 41, 59]; // #1e293b
  const textMuted = [100, 116, 139]; // #64748b
  const bgLight = [248, 250, 252]; // #f8fafc
  const borderColor = [226, 232, 240]; // #e2e8f0

  // Pre-load school logo if present
  let schoolLogoImg: HTMLImageElement | null = null;
  if (data.schoolLogoUrl) {
    try {
      schoolLogoImg = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = data.schoolLogoUrl!;
      });
    } catch {
      schoolLogoImg = null;
    }
  }

  let yPos = 20;

  const drawHeader = (pageNumber: number) => {
    // Header decorative top bar
    doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.rect(0, 0, pageWidth, 5, 'F');

    // CodeLine Logo / Branding (Left)
    doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.roundedRect(margin, 12, 10, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('CL', margin + 2.5, 18.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.setFontSize(13);
    doc.text('CODELINE', margin + 13, 17);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFontSize(7.5);
    doc.text('Educational Systems & Operations Platform', margin + 13, 21);

    // School Logo or Client Name (Right side of Header)
    if (schoolLogoImg) {
      try {
        const logoMaxW = 28;
        const logoMaxH = 14;
        const aspect = schoolLogoImg.width / schoolLogoImg.height;
        let drawW = logoMaxW;
        let drawH = drawW / aspect;
        if (drawH > logoMaxH) {
          drawH = logoMaxH;
          drawW = drawH * aspect;
        }
        doc.addImage(schoolLogoImg, 'PNG', pageWidth - margin - drawW, 10, drawW, drawH);
      } catch {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
        doc.text(data.clientName, pageWidth - margin, 18, { align: 'right' });
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
      doc.text(data.clientName, pageWidth - margin, 17, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Official Partner Proposal', pageWidth - margin, 21, { align: 'right' });
    }

    // Divider line under header
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.4);
    doc.line(margin, 26, pageWidth - margin, 26);
  };

  const drawFooter = (pageNumber: number, totalPages: number) => {
    const footY = pageHeight - 14;
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footY - 3, pageWidth - margin, footY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('CodeLine Operations Platform | Amman, Jordan | info@codeline.jo', margin, footY + 2);
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, footY + 2, { align: 'right' });
  };

  // Draw Page 1 Header
  drawHeader(1);
  yPos = 34;

  // Proposal Title Banner Box
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, yPos, contentWidth, 22, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text(data.title, margin + 5, yPos + 8);

  const dateStr = new Date(data.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Ref: PR-${data.id.slice(-6).toUpperCase()}  |  Date: ${dateStr}  |  Status: ${data.status}`, margin + 5, yPos + 15);

  yPos += 28;

  // Two Column Client & Company Meta Block
  const colW = (contentWidth - 6) / 2;

  // Left Box: Client / School
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, colW, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
  doc.text('PREPARED FOR (CLIENT)', margin + 4, yPos + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(data.clientName, margin + 4, yPos + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  let clientContact = '';
  if (data.contactPerson) clientContact += `Attn: ${data.contactPerson}  `;
  if (data.clientPhone) clientContact += `| Tel: ${data.clientPhone}  `;
  if (data.clientEmail) clientContact += `| Email: ${data.clientEmail}`;
  doc.text(clientContact || 'School Partner Administration', margin + 4, yPos + 18);

  // Right Box: Provider Details
  doc.roundedRect(margin + colW + 6, yPos, colW, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
  doc.text('ISSUED BY', margin + colW + 10, yPos + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('CodeLine Jordan Technology', margin + colW + 10, yPos + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Operations & Institutional Outreach Department', margin + colW + 10, yPos + 18);

  yPos += 32;

  // Executive Notes / Introduction (if any)
  if (data.notes && data.notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text('Executive Summary & Scope Overview', margin, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const splitNotes = doc.splitTextToSize(data.notes.trim(), contentWidth);
    doc.text(splitNotes, margin, yPos);
    yPos += splitNotes.length * 4 + 5;
  }

  // Services / Scope Section Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text('Services, Deliverables & Pricing Scope', margin, yPos);
  yPos += 5;

  // Table Header
  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.rect(margin, yPos, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('#', margin + 3, yPos + 5);
  doc.text('Deliverable / Service Item', margin + 12, yPos + 5);
  doc.text('Investment / Price', pageWidth - margin - 4, yPos + 5, { align: 'right' });
  yPos += 7;

  // Table Rows
  const services = data.services && data.services.length > 0
    ? data.services
    : [{ title: 'Full System Implementation & Setup', description: 'Core operational platform setup and configuration.', price: 'Included' }];

  services.forEach((srv, idx) => {
    // Check if new page is needed
    if (yPos > pageHeight - 35) {
      doc.addPage();
      drawHeader(doc.getNumberOfPages());
      yPos = 34;
    }

    const isEven = idx % 2 === 0;
    const rowStartY = yPos;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`${idx + 1}.`, margin + 3, yPos + 5);
    doc.text(srv.title, margin + 12, yPos + 5);

    if (srv.price) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
      doc.text(srv.price, pageWidth - margin - 4, yPos + 5, { align: 'right' });
    }

    yPos += 7;

    if (srv.description && srv.description.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      const splitDesc = doc.splitTextToSize(srv.description.trim(), contentWidth - 20);
      doc.text(splitDesc, margin + 12, yPos);
      yPos += splitDesc.length * 3.5 + 2;
    } else {
      yPos += 2;
    }

    // Row divider
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 2;
  });

  yPos += 5;

  // Terms & Conditions (if provided)
  if (data.terms && data.terms.trim()) {
    if (yPos > pageHeight - 45) {
      doc.addPage();
      drawHeader(doc.getNumberOfPages());
      yPos = 34;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text('Terms, Validity & Conditions', margin, yPos);
    yPos += 4;

    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const splitTerms = doc.splitTextToSize(data.terms.trim(), contentWidth - 8);
    const boxH = Math.max(14, splitTerms.length * 3.5 + 6);

    doc.roundedRect(margin, yPos, contentWidth, boxH, 2, 2, 'FD');
    doc.text(splitTerms, margin + 4, yPos + 4);
    yPos += boxH + 6;
  }

  // Signature / Approval Block
  if (yPos > pageHeight - 35) {
    doc.addPage();
    drawHeader(doc.getNumberOfPages());
    yPos = 34;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text('Authorized Signature & Acceptance', margin, yPos);
  yPos += 6;

  const sigW = (contentWidth - 10) / 2;
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.line(margin, yPos + 12, margin + sigW, yPos + 12);
  doc.line(margin + sigW + 10, yPos + 12, pageWidth - margin, yPos + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('For CodeLine Operations Platform', margin, yPos + 16);
  doc.text(`For ${data.clientName}`, margin + sigW + 10, yPos + 16);

  // Apply footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  // Save PDF to browser
  const filename = `Proposal_${data.clientName.replace(/[^a-zA-Z0-9_-]+/g, '_')}_${data.id.slice(-6)}.pdf`;
  doc.save(filename);
}