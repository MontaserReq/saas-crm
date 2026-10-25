import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('upload body boundary wiring', () => {
  it('uses bounded streaming multipart parsing for every route-handler upload surface', () => {
    const routes = [
      'src/app/api/proposals/templates/route.ts',
      'src/app/api/proposals/templates/[id]/route.ts',
      'src/app/api/proposals/[id]/logo/route.ts',
      'src/app/api/schools/[id]/logo/route.ts',
      'src/app/api/organization/logo/route.ts',
      'src/app/api/schools/import/route.ts',
    ];
    for (const route of routes) {
      const text = source(route);
      expect(text).toMatch(/parseBoundedMultipart/);
      expect(text).not.toMatch(/request\.formData\(\)/);
    }
  });

  it('keeps the Next Server Action ceiling above the validated aggregate attachment limit', () => {
    expect(source('next.config.mjs')).toMatch(/bodySizeLimit:\s*["']30mb["']/);
    expect(source('src/server/actions/messages.ts')).toMatch(/validateAttachmentBatch/);
    expect(source('src/server/actions/tickets.ts')).toMatch(/validateAttachmentBatch/);
  });

  it('does not advertise legacy attachment formats in file inputs', () => {
    for (const component of ['src/components/messages/ComposeMessageModal.tsx', 'src/components/tickets/NoteStream.tsx']) {
      const text = source(component);
      expect(text).not.toMatch(/accept=[^\n]*(?:\.doc,|\.xls,|\.ppt,|image\/\*)/);
      expect(text).toMatch(/\.docx/);
      expect(text).toMatch(/\.xlsx/);
    }
    expect(source('src/components/schools/SchoolImportModal.tsx')).not.toMatch(/application\/vnd\.ms-excel/);
  });
});
