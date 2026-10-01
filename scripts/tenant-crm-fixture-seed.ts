import prisma from '../src/lib/db/prisma';
async function main() {
  const [a, b] = await Promise.all([prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-a' } }), prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-b' } })]);
  const [ua, ub] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-a' } }), prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-b' } })]);
  await prisma.client.upsert({ where: { id: 'tenant-client-a' }, update: {}, create: { id: 'tenant-client-a', organizationId: a.id, name: 'Tenant Client A', type: 'COMPANY', createdById: ua.id } });
  await prisma.client.upsert({ where: { id: 'tenant-client-b' }, update: {}, create: { id: 'tenant-client-b', organizationId: b.id, name: 'Tenant Client B', type: 'COMPANY', createdById: ub.id } });
  await prisma.client.upsert({ where: { id: 'tenant-school-a' }, update: {}, create: { id: 'tenant-school-a', organizationId: a.id, name: 'School A', type: 'SCHOOL', createdById: ua.id } });
  await prisma.client.upsert({ where: { id: 'tenant-school-b' }, update: {}, create: { id: 'tenant-school-b', organizationId: b.id, name: 'School B', type: 'SCHOOL', createdById: ub.id } });
  const schools = await prisma.school.findMany({ where: { organizationId: { in: [a.id, b.id] } }, select: { id: true, organizationId: true, name: true, createdById: true } });
  for (const school of schools) await prisma.client.upsert({ where: { id: school.id }, update: { organizationId: school.organizationId!, name: school.name, type: 'SCHOOL' }, create: { id: school.id, organizationId: school.organizationId!, name: school.name, type: 'SCHOOL', createdById: school.createdById || (school.organizationId === a.id ? ua.id : ub.id) } });
  console.log(JSON.stringify({ seeded: ['tenant-client-a', 'tenant-client-b'] }));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
