import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('smart import security wiring', () => {
  it('streams bounded multipart data and does not trust browser tenant identifiers', () => {
    const route = source('src/app/api/imports/analyze/route.ts');
    expect(route).toMatch(/parseBoundedMultipart/);
    expect(route).not.toMatch(/request\.formData\(\)/);
    expect(route).toMatch(/requireOrganizationId\(user\)/);
    expect(route).not.toMatch(/organizationId\s*=\s*textPart/);
  });

  it('protects every mutation with origin, auth, and import permission checks', () => {
    for (const file of ['src/app/api/imports/analyze/route.ts', 'src/app/api/imports/[id]/preview/route.ts', 'src/app/api/imports/[id]/confirm/route.ts', 'src/app/api/imports/[id]/cancel/route.ts']) {
      const route = source(file);
      expect(route).toMatch(/rejectUntrustedMutation/);
      expect(route).toMatch(/getCurrentUser/);
      expect(route).toMatch(/PERMISSIONS\.SCHOOLS_IMPORT/);
    }
  });

  it('scopes jobs, duplicate checks, relationships, and writes to the authenticated organization', () => {
    const service = source('src/server/services/DataImportService.ts');
    expect(service).toMatch(/requireOrganizationContext\(user\)/);
    expect(service).toMatch(/where:\s*\{\s*id,\s*organizationId/);
    expect(service).toMatch(/organizationMember\.findMany\(\{\s*where:\s*\{[\s\S]*?organizationId/);
    expect(service).toMatch(/organizationId_fieldDefinitionId_entityType_entityId/);
  });

  it('revalidates persisted mappings on confirmation and removes staged source data', () => {
    const service = source('src/server/services/DataImportService.ts');
    expect(service).toMatch(/buildPreview\(user, id/);
    expect(service).toMatch(/sourceRows:\s*Prisma\.DbNull/);
    expect(service).toMatch(/\$transaction/);
    expect(source('src/app/api/imports/[id]/failures/route.ts')).toMatch(/safeCsvCell/);
  });

  it('keeps the wizard bilingual, RTL-aware, plan-gated, and linked from CRM navigation', () => {
    const wizard = source('src/components/imports/SmartImportWizard.tsx');
    expect(wizard).toMatch(/الاستيراد الذكي للبيانات/);
    expect(wizard).toMatch(/dir=\{direction\}/);
    expect(source('src/lib/platform/entitlements.ts')).toMatch(/\['\/imports', 'import_export'\]/);
    expect(source('src/components/layout/Sidebar.tsx')).toMatch(/href:\s*["']\/imports["']/);
  });

  it('does not retain the vulnerable xlsx package or imports', () => {
    const manifest = JSON.parse(source('package.json'));
    expect(manifest.dependencies.xlsx).toBeUndefined();
    expect(source('package-lock.json')).not.toMatch(/node_modules\/xlsx/);
    for (const file of ['src/lib/export.ts', 'src/components/schools/SchoolsClientView.tsx', 'tests/unit/smart_import.test.ts']) {
      expect(source(file)).not.toMatch(/from ['"]xlsx['"]|import\(['"]xlsx['"]\)/);
    }
  });
});
