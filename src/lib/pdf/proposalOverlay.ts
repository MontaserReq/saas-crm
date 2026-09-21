import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { LogoPositionConfig, TemplateConfig } from '@/server/services/ProposalTemplateService';

export interface OverlayOptions {
  basePdfBuffer: Buffer;
  templateConfig?: TemplateConfig | null;
  schoolLogoBuffer?: Buffer | null;
  schoolLogoMimeType?: string | null;
  codeLineLogoBuffer?: Buffer | null;
  codeLineLogoMimeType?: string | null;
  dynamicValues?: {
    clientName?: string;
    contactPerson?: string;
    date?: string;
    proposalNumber?: string;
    title?: string;
  };
}

/**
 * Checks image buffer magic bytes to determine if it is PNG or JPEG
 */
function getImageFormat(buffer: Buffer, mime?: string | null): 'png' | 'jpg' | null {
  if (buffer.length >= 4) {
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'png';
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpg';
    }
  }

  if (mime) {
    if (mime.includes('png')) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  }

  return null;
}

/**
 * Applies dynamic logo overlays and text onto a base PDF template without altering the original design.
 */
export async function applyProposalOverlay(options: OverlayOptions): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(options.basePdfBuffer);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('PDF document has no pages');
  }

  const config = options.templateConfig || {};

  // 1. Overlay School Logo
  if (options.schoolLogoBuffer && options.schoolLogoBuffer.length > 0) {
    const format = getImageFormat(options.schoolLogoBuffer, options.schoolLogoMimeType);
    if (format) {
      try {
        const embeddedImg =
          format === 'png'
            ? await pdfDoc.embedPng(options.schoolLogoBuffer)
            : await pdfDoc.embedJpg(options.schoolLogoBuffer);

        const pos: LogoPositionConfig = config.schoolLogoPosition || {
          page: 1,
          x: 430,
          y: 35,
          width: 120,
          height: 60,
        };

        const targetPageIndex = Math.max(0, Math.min(pos.page - 1, pages.length - 1));
        const targetPage = pages[targetPageIndex];
        const pageHeight = targetPage.getHeight();

        // Preserve aspect ratio and center inside bounding box
        const imgAspect = embeddedImg.width / embeddedImg.height;
        const boxAspect = pos.width / pos.height;

        let drawW = pos.width;
        let drawH = pos.height;
        if (imgAspect > boxAspect) {
          drawW = pos.width;
          drawH = pos.width / imgAspect;
        } else {
          drawH = pos.height;
          drawW = pos.height * imgAspect;
        }

        const drawX = pos.x + (pos.width - drawW) / 2;
        // In PDF coordinates, (0,0) is bottom-left
        const drawY = pageHeight - pos.y - (pos.height + drawH) / 2;

        targetPage.drawImage(embeddedImg, {
          x: drawX,
          y: Math.max(0, drawY),
          width: drawW,
          height: drawH,
        });
      } catch (err) {
        console.warn('Failed to embed school logo into PDF overlay:', err);
      }
    }
  }

  // 2. Overlay CodeLine Logo (if custom buffer or position configured)
  if (options.codeLineLogoBuffer && options.codeLineLogoBuffer.length > 0) {
    const format = getImageFormat(options.codeLineLogoBuffer, options.codeLineLogoMimeType);
    if (format) {
      try {
        const embeddedImg =
          format === 'png'
            ? await pdfDoc.embedPng(options.codeLineLogoBuffer)
            : await pdfDoc.embedJpg(options.codeLineLogoBuffer);

        const pos: LogoPositionConfig = config.codeLineLogoPosition || {
          page: 1,
          x: 45,
          y: 35,
          width: 120,
          height: 60,
        };

        const targetPageIndex = Math.max(0, Math.min(pos.page - 1, pages.length - 1));
        const targetPage = pages[targetPageIndex];
        const pageHeight = targetPage.getHeight();

        const imgAspect = embeddedImg.width / embeddedImg.height;
        const boxAspect = pos.width / pos.height;

        let drawW = pos.width;
        let drawH = pos.height;
        if (imgAspect > boxAspect) {
          drawW = pos.width;
          drawH = pos.width / imgAspect;
        } else {
          drawH = pos.height;
          drawW = pos.height * imgAspect;
        }

        const drawX = pos.x + (pos.width - drawW) / 2;
        const drawY = pageHeight - pos.y - (pos.height + drawH) / 2;

        targetPage.drawImage(embeddedImg, {
          x: drawX,
          y: Math.max(0, drawY),
          width: drawW,
          height: drawH,
        });
      } catch (err) {
        console.warn('Failed to embed CodeLine logo into PDF overlay:', err);
      }
    }
  }

  // 3. Dynamic text fields (if configured in template)
  if (config.dynamicFields && config.dynamicFields.length > 0 && options.dynamicValues) {
    try {
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      config.dynamicFields.forEach((field) => {
        const value = (options.dynamicValues as any)[field.name];
        if (value && typeof value === 'string') {
          const targetPageIndex = Math.max(0, Math.min(field.page - 1, pages.length - 1));
          const targetPage = pages[targetPageIndex];
          const pageHeight = targetPage.getHeight();

          targetPage.drawText(value, {
            x: field.x,
            y: pageHeight - field.y,
            size: field.fontSize || 10,
            font,
            color: rgb(0.12, 0.16, 0.23), // #1e293b
          });
        }
      });
    } catch (err) {
      console.warn('Failed to render dynamic fields on PDF overlay:', err);
    }
  }

  const savedBytes = await pdfDoc.save();
  return Buffer.from(savedBytes);
}