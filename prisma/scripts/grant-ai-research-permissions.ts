import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mirrors prisma/seed.ts's grants for the ai_research.* module without
// touching any other data. Safe to re-run (idempotent).
const PERMISSION_CODES = [
  'ai_research.view',
  'ai_research.create',
  'ai_research.run',
  'ai_research.approve',
  'ai_research.reject',
  'ai_research.enrich',
] as const;

const ROLE_GRANTS: Record<string, readonly string[]> = {
  SUPER_ADMIN: PERMISSION_CODES,
  ADMIN: PERMISSION_CODES,
  SCHOOL_MANAGER: ['ai_research.view', 'ai_research.create', 'ai_research.run', 'ai_research.reject', 'ai_research.enrich'],
};

const label = (code: string) => code.split('.').map((part) => part.replace(/_/g, ' ')).join(' ');

async function main() {
  const permissionIdByCode = new Map<string, string>();

  for (const code of PERMISSION_CODES) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: label(code), module: 'ai_research', description: label(code) },
    });
    permissionIdByCode.set(code, permission.id);
    console.log(`Permission ready: ${code}`);
  }

  for (const [roleName, codes] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.warn(`Role ${roleName} not found — skipping grants for it.`);
      continue;
    }

    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id, permissionId: { in: codes.map((code) => permissionIdByCode.get(code)!) } },
      select: { permissionId: true },
    });
    const existingIds = new Set(existing.map((row) => row.permissionId));

    const toCreate = codes
      .map((code) => permissionIdByCode.get(code)!)
      .filter((permissionId) => !existingIds.has(permissionId))
      .map((permissionId) => ({ roleId: role.id, permissionId }));

    if (toCreate.length) {
      await prisma.rolePermission.createMany({ data: toCreate });
    }
    console.log(`Granted ${codes.length} ai_research permissions to ${roleName} (${toCreate.length} newly added).`);
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
