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
      'src/app/api/schools/import/route.ts',
    ];
    for (const route of routes) {
      const text = source(route);
      expect(text).toMatch(/parseBoundedMultipart/);
      expect(text).not.toMatch(/request\.formData\(\)/);
    }
  });

  it('retains the Next Server Action request ceiling for attachment actions', () => {
    expect(source('next.config.mjs')).toMatch(/bodySizeLimit:\s*["']10mb["']/);
    expect(source('src/server/actions/messages.ts')).toMatch(/validateAttachmentBatch/);
    expect(source('src/server/actions/tickets.ts')).toMatch(/validateAttachmentBatch/);
  });
});
