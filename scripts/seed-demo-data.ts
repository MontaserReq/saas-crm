import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PLATFORM_EMAIL = 'montaserreq@gmail.com';
const DEMO_PASSWORD = 'Demo@2026!';

type Sector = {
  slug: string;
  name: string;
  industry: string;
  color: string;
  clientName: string;
  clientType: string;
  contactName: [string, string];
  ticketSubjects: string[];
};

const sectors: Sector[] = [
  { slug: 'amanah-properties', name: 'أمانة العقارية', industry: 'العقارات', color: '#6d3cc9', clientName: 'شركة الواجهة للاستثمار العقاري', clientType: 'COMPANY', contactName: ['ليان', 'الحداد'], ticketSubjects: ['متابعة عميل مهتم بفيلا في عبدون', 'طلب معاينة شقة في دابوق', 'تجديد عقد إدارة مبنى سكني'] },
  { slug: 'shifa-medical-clinic', name: 'عيادة شفاء الطبية', industry: 'الرعاية الصحية', color: '#0f9f8f', clientName: 'مركز الحياة الطبي', clientType: 'COMPANY', contactName: ['رنا', 'العمري'], ticketSubjects: ['تأكيد موعد مراجعة القلب', 'متابعة موافقة التأمين على العلاج', 'طلب نتائج فحوصات مخبرية'] },
  { slug: 'nexus-software-solutions', name: 'Nexus Software Solutions', industry: 'البرمجيات والتكنولوجيا', color: '#2563eb', clientName: 'شركة المدار للتقنية', clientType: 'COMPANY', contactName: ['كريم', 'منصور'], ticketSubjects: ['خطأ 504 في واجهة API', 'تهيئة مساحة عمل العميل الجديد', 'مراجعة خطة إطلاق الإصدار القادم'] },
  { slug: 'jadara-ecommerce', name: 'جدارة للتجارة الإلكترونية', industry: 'التجارة الإلكترونية', color: '#e08a16', clientName: 'متجر بيتنا الإلكتروني', clientType: 'COMPANY', contactName: ['سلمى', 'خطيب'], ticketSubjects: ['تأخر شحنة الطلب #4821', 'تحديث عنوان تسليم العميل', 'مشكلة في كود الخصم الموسمي'] },
  { slug: 'atlas-logistics', name: 'Atlas Logistics', industry: 'الخدمات اللوجستية', color: '#0b7285', clientName: 'مصنع النخبة للمواد الغذائية', clientType: 'COMPANY', contactName: ['عمر', 'الزهراني'], ticketSubjects: ['تنسيق موعد استلام الشحنة', 'طلب تقرير تتبع الأسطول', 'تعديل نقطة التسليم للطلب'] },
  { slug: 'edubridge-training', name: 'EduBridge للتدريب', industry: 'التعليم والتدريب', color: '#7c3aed', clientName: 'أكاديمية المستقبل', clientType: 'UNIVERSITY', contactName: ['نور', 'عوض'], ticketSubjects: ['تسجيل مجموعة جديدة في دورة المبيعات', 'مشكلة دخول متدرب إلى المنصة', 'جدولة جلسة تعريفية للمدربين'] },
  { slug: 'binaa-contracting', name: 'بناء للمقاولات', industry: 'الإنشاءات والمقاولات', color: '#b45309', clientName: 'مشروع حدائق الياسمين', clientType: 'COMPANY', contactName: ['مازن', 'سعد'], ticketSubjects: ['اعتماد مخطط الأعمال الكهربائية', 'تأخير توريد مواد التشطيب', 'تنسيق زيارة الموقع مع الاستشاري'] },
  { slug: 'kayan-marketing-studio', name: 'Kayan Marketing Studio', industry: 'التسويق والإعلام', color: '#db2777', clientName: 'مجموعة آفاق التجارية', clientType: 'COMPANY', contactName: ['هدى', 'قاسم'], ticketSubjects: ['اعتماد النسخة النهائية للحملة', 'طلب تقرير أداء الإعلانات', 'تحديث قائمة محتوى الشهر القادم'] },
];

const defaultModules = ['dashboard', 'clients', 'contacts', 'leads', 'deals', 'pipelines', 'tasks', 'calendar', 'tickets', 'proposals', 'activities', 'reports'];
const defaultClientTypes = ['SCHOOL', 'COMPANY', 'NGO', 'UNIVERSITY', 'GOVERNMENT', 'INDIVIDUAL', 'OTHER'];
const defaultTicketPriorities = [
  { key: 'LOW', label: 'Normal', labelAr: 'عادية', active: true },
  { key: 'MEDIUM', label: 'Important', labelAr: 'مهمة', active: true },
  { key: 'HIGH', label: 'Very important', labelAr: 'مهمة جداً', active: true },
  { key: 'URGENT', label: 'Urgent', labelAr: 'عاجلة جداً', active: true },
];

function code(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function resetNonPlatformData(platformUserId: string, platformDepartmentId: string) {
  await prisma.department.updateMany({ data: { organizationId: null } });

  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    "SELECT tablename AS table_name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const keep = new Set(['_prisma_migrations', 'User', 'Role', 'Permission', 'RolePermission', 'Department', 'Organization', 'PlatformPlan', 'PlatformSetting']);
  const tablesToTruncate = tables.map((row) => row.table_name).filter((name) => !keep.has(name));
  if (!tablesToTruncate.length) throw new Error('No application tables were found for the guarded reset');
  const quoted = tablesToTruncate.map((name) => `"${name.replace(/"/g, '""')}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${quoted} RESTART IDENTITY`);
  await prisma.organization.deleteMany();

  await prisma.user.update({ where: { id: platformUserId }, data: { reportsToUserId: null } });
  await prisma.user.deleteMany({ where: { email: { not: PLATFORM_EMAIL } } });
  await prisma.department.deleteMany({ where: { id: { not: platformDepartmentId } } });
}

async function createOrganizationSettings(organizationId: string, ownerId: string, workspace: string) {
  const now = new Date().toISOString();
  const onboardingState = {
    version: 1,
    ownerId,
    status: 'COMPLETE',
    step: 4,
    answers: {
      workspace,
      industry: 'other',
      teamSize: '2-5',
      priority: 'sales',
      tracking: 'another_tool',
      language: 'ar',
      description: `بيانات تجريبية لشركة ${workspace}`,
      goals: ['customers', 'leads', 'pipelines', 'tasks', 'support', 'operations'],
      modules: defaultModules,
      pipelineStages: ['جديد', 'مؤهل', 'اجتماع', 'عرض'],
    },
    startedAt: now,
    signupStartedAt: now,
    completedAt: now,
    standard: false,
  };

  await prisma.organizationSettings.create({
    data: {
      organizationId,
      enabledModules: JSON.stringify(defaultModules),
      clientTypes: JSON.stringify(defaultClientTypes),
      leadStatuses: JSON.stringify(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST']),
      ticketStatuses: JSON.stringify(['PENDING', 'SEEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']),
      ticketPriorities: JSON.stringify(defaultTicketPriorities),
      approvalRules: JSON.stringify({}),
      notificationPreferences: JSON.stringify({}),
      onboardingState: JSON.stringify(onboardingState),
    },
  });
}

async function main() {
  if (process.env.ALLOW_DEMO_RESET !== 'yes') {
    throw new Error('This guarded demo reset requires ALLOW_DEMO_RESET=yes');
  }

  const platform = await prisma.user.findUnique({
    where: { email: PLATFORM_EMAIL },
    include: { role: true, department: true },
  });
  if (!platform || !platform.isPlatformAdmin || platform.role.name !== 'PLATFORM_ADMIN') {
    throw new Error(`Refusing to continue: ${PLATFORM_EMAIL} was not found as the expected platform admin`);
  }

  const roles = await prisma.role.findMany({ where: { name: { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'SCHOOL_MANAGER', 'MEMBER'] } } });
  const roleIds = new Map(roles.map((role) => [role.name, role.id]));
  for (const required of ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'SCHOOL_MANAGER', 'MEMBER']) {
    if (!roleIds.has(required)) throw new Error(`Required system role is missing: ${required}`);
  }
  const growthPlan = await prisma.platformPlan.findUnique({ where: { slug: 'growth' } });
  if (!growthPlan) throw new Error('The Growth platform plan is missing');

  await resetNonPlatformData(platform.id, platform.departmentId);

  const platformOrganization = await prisma.organization.create({
    data: { name: 'CodeLine Local', slug: 'codeline-local', timezone: 'Asia/Amman', currency: 'JOD', language: 'en', primaryColor: '#6d3cc9' },
  });
  await prisma.organizationMember.create({ data: { organizationId: platformOrganization.id, userId: platform.id, roleId: roleIds.get('PLATFORM_ADMIN'), status: 'ACTIVE' } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const credentials: Array<{ organization: string; role: string; name: string; email: string; password: string }> = [];
  const now = new Date();

  for (const [index, sector] of sectors.entries()) {
    const organization = await prisma.organization.create({
      data: {
        name: sector.name,
        slug: `demo-${sector.slug}`,
        timezone: 'Asia/Amman',
        currency: 'JOD',
        language: 'ar',
        primaryColor: sector.color,
      },
    });

    const departments = await Promise.all([
      prisma.department.create({ data: { organizationId: organization.id, name: 'الإدارة', code: 'MANAGEMENT', description: `الإدارة العليا في ${sector.name}` } }),
      prisma.department.create({ data: { organizationId: organization.id, name: 'العمليات', code: 'OPERATIONS', description: 'تنفيذ ومتابعة الأعمال اليومية' } }),
      prisma.department.create({ data: { organizationId: organization.id, name: 'خدمة العملاء', code: 'CUSTOMER_SUCCESS', description: 'متابعة العملاء والطلبات والتذاكر' } }),
    ]);

    const prefix = sector.slug.replace(/-/g, '.');
    const userSpecs = [
      { role: 'SUPER_ADMIN', name: `مدير ${sector.name}`, local: `${prefix}.owner`, departmentId: departments[0].id },
      { role: 'ADMIN', name: `مسؤول العمليات - ${sector.name}`, local: `${prefix}.admin`, departmentId: departments[0].id },
      { role: 'SCHOOL_MANAGER', name: `مدير فريق ${sector.industry}`, local: `${prefix}.manager`, departmentId: departments[1].id },
      { role: 'MEMBER', name: `منسق العملاء - ${sector.name}`, local: `${prefix}.member`, departmentId: departments[2].id },
    ] as const;
    const users: Record<string, { id: string; email: string; name: string }> = {};
    for (const spec of userSpecs) {
      const email = `${spec.local}@demo.satrcrm.local`;
      const user = await prisma.user.create({ data: { name: spec.name, email, passwordHash, roleId: roleIds.get(spec.role)!, departmentId: spec.departmentId } });
      users[spec.role] = { id: user.id, email, name: user.name };
      credentials.push({ organization: sector.name, role: spec.role, name: user.name, email, password: DEMO_PASSWORD });
      await prisma.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, roleId: roleIds.get(spec.role), status: 'ACTIVE' } });
    }
    await prisma.user.update({ where: { id: users.ADMIN.id }, data: { reportsToUserId: users.SUPER_ADMIN.id } });
    await prisma.user.update({ where: { id: users.SCHOOL_MANAGER.id }, data: { reportsToUserId: users.ADMIN.id } });
    await prisma.user.update({ where: { id: users.MEMBER.id }, data: { reportsToUserId: users.SCHOOL_MANAGER.id } });

    await prisma.departmentManager.createMany({ data: [
      { departmentId: departments[0].id, userId: users.SUPER_ADMIN.id },
      { departmentId: departments[1].id, userId: users.SCHOOL_MANAGER.id },
      { departmentId: departments[2].id, userId: users.MEMBER.id },
    ] });

    await createOrganizationSettings(organization.id, users.SUPER_ADMIN.id, sector.name);
    await prisma.platformSubscription.create({
      data: {
        organizationId: organization.id,
        planId: growthPlan.id,
        status: 'TRIAL',
        billingInterval: 'monthly',
        startsAt: now,
        endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        trialStartedAt: now,
        trialEndsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        notes: 'Demo workspace seeded for product testing',
      },
    });

    const teams = await Promise.all([
      prisma.team.create({ data: { organizationId: organization.id, name: `${sector.industry} - الفريق الأساسي`, description: 'فريق العمل الأساسي لمتابعة العملاء والطلبات' } }),
      prisma.team.create({ data: { organizationId: organization.id, name: 'خدمة العملاء والدعم', description: 'فريق مخصص للتذاكر والمتابعة اليومية' } }),
    ]);
    await prisma.teamMember.createMany({ data: [
      { teamId: teams[0].id, userId: users.SUPER_ADMIN.id, role: 'OWNER' },
      { teamId: teams[0].id, userId: users.SCHOOL_MANAGER.id, role: 'MEMBER' },
      { teamId: teams[0].id, userId: users.MEMBER.id, role: 'MEMBER' },
      { teamId: teams[1].id, userId: users.ADMIN.id, role: 'OWNER' },
      { teamId: teams[1].id, userId: users.MEMBER.id, role: 'MEMBER' },
    ] });

    const client = await prisma.client.create({
      data: { organizationId: organization.id, name: sector.clientName, type: sector.clientType, status: 'ACTIVE', category: sector.industry, email: `contact@${sector.slug}.example`, phone: '+962 7 9000 0000', createdById: users.SUPER_ADMIN.id, updatedById: users.SUPER_ADMIN.id },
    });
    const contact = await prisma.contact.create({
      data: { organizationId: organization.id, clientId: client.id, firstName: sector.contactName[0], lastName: sector.contactName[1], jobTitle: 'مسؤول مشتريات', email: `contact.person@${sector.slug}.example`, phone: '+962 7 9111 1111', isPrimary: true, assignedUserId: users.MEMBER.id },
    });
    const lead = await prisma.lead.create({
      data: { organizationId: organization.id, name: `${sector.contactName[0]} ${sector.contactName[1]}`, companyName: sector.clientName, email: contact.email, phone: contact.phone, source: 'WEBSITE', status: 'QUALIFIED', notes: `عميل محتمل تجريبي لقطاع ${sector.industry}`, assignedUserId: users.MEMBER.id, assignedTeamId: teams[0].id },
    });
    const pipeline = await prisma.pipeline.create({ data: { organizationId: organization.id, name: 'مسار المبيعات الرئيسي', description: `مسار تجريبي لقطاع ${sector.industry}`, isDefault: true } });
    const stageNames = ['جديد', 'مؤهل', 'اجتماع', 'عرض', 'ناجحة', 'غير ناجحة'];
    const stages = await Promise.all(stageNames.map((name, order) => prisma.pipelineStage.create({ data: { organizationId: organization.id, pipelineId: pipeline.id, name, order, type: order === 4 ? 'WON' : order === 5 ? 'LOST' : 'OPEN', probability: order === 4 ? 100 : order === 5 ? 0 : order * 20 } })));
    const deal = await prisma.deal.create({
      data: { organizationId: organization.id, title: `فرصة ${sector.clientName}`, description: `فرصة مبيعات تجريبية في قطاع ${sector.industry}`, clientId: client.id, primaryContactId: contact.id, leadId: lead.id, pipelineId: pipeline.id, stageId: stages[2].id, status: 'OPEN', value: 12500 + index * 1500, currency: 'JOD', probability: 60, expectedCloseDate: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000), ownerId: users.SCHOOL_MANAGER.id, teamId: teams[0].id, createdById: users.SUPER_ADMIN.id },
    });
    await prisma.dealAssignee.create({ data: { dealId: deal.id, userId: users.MEMBER.id } });

    const createdTickets = [];
    for (const [ticketIndex, subject] of sector.ticketSubjects.entries()) {
      const ticket = await prisma.ticket.create({
        data: { organizationId: organization.id, ticketNumber: `DEMO-${String(index + 1).padStart(2, '0')}-${String(ticketIndex + 1).padStart(3, '0')}`, clientId: client.id, departmentId: departments[ticketIndex % departments.length].id, subject, priority: ticketIndex === 1 ? 'HIGH' : ticketIndex === 2 ? 'URGENT' : 'MEDIUM', status: ticketIndex === 0 ? 'IN_PROGRESS' : ticketIndex === 1 ? 'SEEN' : 'PENDING', createdById: users.SUPER_ADMIN.id, dueDate: new Date(now.getTime() + (ticketIndex + 1) * 24 * 60 * 60 * 1000), followUpAt: new Date(now.getTime() + (ticketIndex + 1) * 12 * 60 * 60 * 1000) },
      });
      const assignee = ticketIndex === 0 ? users.SCHOOL_MANAGER : ticketIndex === 1 ? users.MEMBER : users.ADMIN;
      await prisma.ticketAssignee.create({ data: { ticketId: ticket.id, userId: assignee.id, isCurrent: true, role: 'ASSIGNEE' } });
      if (ticketIndex === 0) await prisma.ticketAssignee.create({ data: { ticketId: ticket.id, userId: users.MEMBER.id, isCurrent: true, role: 'CC' } });
      createdTickets.push(ticket);
    }
    await prisma.crmTask.create({ data: { organizationId: organization.id, title: `متابعة ${sector.clientName}`, description: 'مهمة تجريبية مرتبطة بفرصة بيع وتذكرة دعم', status: 'TODO', priority: 'HIGH', dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), ownerId: users.SCHOOL_MANAGER.id, assignedUserId: users.MEMBER.id, assignedTeamId: teams[1].id, departmentId: departments[2].id, createdById: users.SUPER_ADMIN.id, clientId: client.id, contactId: contact.id, dealId: deal.id, ticketId: createdTickets[0].id } });
    await prisma.calendarEvent.create({ data: { organizationId: organization.id, title: `اجتماع متابعة - ${sector.clientName}`, description: 'موعد تجريبي لمراجعة حالة العميل والفرصة', type: 'MEETING', startDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), location: 'قاعة الاجتماعات / اجتماع فيديو', userId: users.SCHOOL_MANAGER.id, createdById: users.SUPER_ADMIN.id, clientId: client.id, departmentId: departments[1].id, ticketId: createdTickets[0].id } });

    const group = await prisma.messageGroup.create({ data: { organizationId: organization.id, name: `فريق ${sector.industry}`, description: `محادثة الفريق التجريبية لشركة ${sector.name}`, createdById: users.SUPER_ADMIN.id } });
    await prisma.messageGroupMember.createMany({ data: Object.values(users).map((user) => ({ groupId: group.id, userId: user.id })) });
    const conversation = await prisma.chatConversation.create({ data: { organizationId: organization.id, messageGroupId: group.id, participants: { create: Object.values(users).map((user) => ({ userId: user.id })) } } });
    await prisma.chatMessage.createMany({ data: [
      { conversationId: conversation.id, senderId: users.SUPER_ADMIN.id, content: `أهلاً بالفريق، هذه محادثة تجريبية لشركة ${sector.name}.` },
      { conversationId: conversation.id, senderId: users.SCHOOL_MANAGER.id, content: 'تم استلام التذاكر وتوزيعها على الزملاء المسؤولين.' },
    ] });
  }

  console.log(JSON.stringify({
    preservedPlatformAdmin: PLATFORM_EMAIL,
    demoPassword: DEMO_PASSWORD,
    organizations: sectors.length,
    demoUsers: credentials.length,
    credentials,
  }, null, 2));
}

main().catch((error) => { console.error('Demo data seed failed:', error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
