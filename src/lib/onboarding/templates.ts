import { z } from 'zod';

export const industryIds = ['services', 'real_estate', 'education', 'technology', 'commerce', 'agencies', 'other'] as const;
export const goalIds = ['customers', 'leads', 'pipelines', 'tasks', 'support', 'operations', 'other'] as const;
export const setupModuleIds = ['dashboard', 'clients', 'contacts', 'leads', 'deals', 'pipelines', 'tasks', 'calendar', 'tickets', 'proposals', 'activities', 'reports'] as const;
export type SetupModule = typeof setupModuleIds[number];
const unique = (values: string[]) => new Set(values).size === values.length;
export const pipelineNamesSchema = z.array(z.string().trim().min(1).max(80)).min(1).max(8)
  .refine(values => unique(values.map(value => value.toLocaleLowerCase())), 'Stage names must be distinct');
export const answersSchema = z.object({
  workspace: z.string().trim().min(2).max(120),
  industry: z.enum(industryIds).default('other'),
  teamSize: z.enum(['1', '2-5', '6-15', '16+']).default('2-5'),
  priority: z.enum(['sales', 'relationships', 'delivery']).default('sales'),
  tracking: z.enum(['none', 'spreadsheet', 'another_tool']).default('none'),
  language: z.enum(['en', 'ar']).default('en'),
  description: z.string().trim().max(500).default(''),
  // Absent goals retain the priority-based behavior of saved version-one drafts.
  goals: z.array(z.enum(goalIds)).max(goalIds.length).refine(unique).optional(),
  modules: z.array(z.enum(setupModuleIds)).min(1).max(setupModuleIds.length).refine(unique)
    .refine(values => values.includes('dashboard'), 'Overview is required')
    .refine(values => values.includes('deals') === values.includes('pipelines'), 'Sales opportunities and pipelines belong together').optional(),
  pipelineStages: pipelineNamesSchema.optional(),
}).strict();
export type SetupAnswers = z.infer<typeof answersSchema>;
export type Localized = { en: string; ar: string };
const label = (en: string, ar: string): Localized => ({ en, ar });
export const industries: Record<SetupAnswers['industry'], { title: Localized; question: Localized; stages: Localized[]; field: { key: string; label: Localized }; note?: Localized }> = {
  services: { title: label('Professional services', 'الخدمات والاستشارات'), question: label('What would you like to organize first?', 'ما الذي تود تنظيمه أولاً؟'), stages: [label('New inquiry', 'استفسار جديد'), label('Discovery', 'فهم الاحتياجات'), label('Proposal', 'عرض الخدمة'), label('Agreement', 'الاتفاق')], field: { key: 'service_interest', label: label('Service of interest', 'الخدمة المطلوبة') } },
  real_estate: { title: label('Real estate', 'العقارات'), question: label('What matters most for your buyers and sellers?', 'ما أولويتك مع المشترين والبائعين؟'), stages: [label('New inquiry', 'استفسار جديد'), label('Needs confirmed', 'تحديد الاحتياجات'), label('Viewing', 'المعاينة'), label('Offer', 'العرض')], field: { key: 'property_interest', label: label('Property of interest', 'العقار المطلوب') }, note: label('Track property interests on leads and viewings in Calendar. A property inventory module is not available.', 'تابع العقار المطلوب ضمن العملاء المحتملين والمعاينات في التقويم. إدارة مخزون العقارات غير متاحة.') },
  education: { title: label('Education and training', 'التعليم والتدريب'), question: label('What would help you follow up with learners?', 'ما الذي يساعدك في متابعة المهتمين بالتدريب؟'), stages: [label('New inquiry', 'استفسار جديد'), label('Course interest', 'تحديد الدورة'), label('Consultation', 'الاستشارة'), label('Registration offer', 'عرض التسجيل')], field: { key: 'course_interest', label: label('Course of interest', 'الدورة المطلوبة') }, note: label('Track course interests and follow-ups with leads and tasks. Course catalogs and enrollment records are not available.', 'تابع الدورات المطلوبة والمتابعات عبر العملاء المحتملين والمهام. كتالوج الدورات وسجلات التسجيل غير متاحة.') },
  technology: { title: label('Software and technology', 'البرمجيات والتكنولوجيا'), question: label('What would help your customer team first?', 'ما أول ما تحتاجه لخدمة عملائك؟'), stages: [label('New inquiry', 'استفسار جديد'), label('Qualified', 'مؤهل'), label('Demo', 'العرض التجريبي'), label('Proposal', 'العرض التجاري')], field: { key: 'solution_interest', label: label('Solution of interest', 'الحل المطلوب') } },
  commerce: { title: label('Sales and commerce', 'المبيعات والتجارة'), question: label('What would help you manage customer requests?', 'ما الذي يساعدك في تنظيم طلبات العملاء؟'), stages: [label('New inquiry', 'استفسار جديد'), label('Qualified', 'مؤهل'), label('Quote', 'عرض السعر'), label('Negotiation', 'التفاوض')], field: { key: 'product_interest', label: label('Product of interest', 'المنتج المطلوب') } },
  agencies: { title: label('Agencies and consulting', 'الوكالات والاستشارات'), question: label('What would help your client work?', 'ما الذي يساعدك في إدارة أعمال العملاء؟'), stages: [label('New brief', 'طلب جديد'), label('Discovery', 'فهم الاحتياجات'), label('Proposal', 'العرض'), label('Agreement', 'الاتفاق')], field: { key: 'engagement_interest', label: label('Engagement of interest', 'الخدمة الاستشارية المطلوبة') } },
  other: { title: label('Other / general business', 'أخرى / أعمال عامة'), question: label('What would you like to organize first?', 'ما الذي تود تنظيمه أولاً؟'), stages: [label('New', 'جديد'), label('Qualified', 'مؤهل'), label('Meeting', 'اجتماع'), label('Proposal', 'عرض')], field: { key: 'customer_interest', label: label('Customer interest', 'اهتمام العميل') } },
};
export const moduleLabels: Record<string, Localized> = {
  dashboard: label('Overview', 'نظرة عامة'), clients: label('Customers and companies', 'العملاء والشركات'), contacts: label('Contacts', 'جهات الاتصال'), leads: label('Potential customers', 'العملاء المحتملون'), deals: label('Sales opportunities', 'فرص البيع'), pipelines: label('Sales stages', 'مراحل البيع'), tasks: label('Follow-up tasks', 'مهام المتابعة'), calendar: label('Appointments', 'المواعيد'), tickets: label('Customer requests', 'طلبات العملاء'), proposals: label('Proposals', 'العروض'), activities: label('Activity', 'النشاط'), reports: label('Reports', 'التقارير'),
};
export const goalLabels: Record<typeof goalIds[number], Localized> = {
  customers: label('Customers and companies', 'العملاء والشركات'), leads: label('Leads and opportunities', 'العملاء المحتملون وفرص البيع'),
  pipelines: label('Sales pipelines', 'مسارات المبيعات'), tasks: label('Tasks and follow-ups', 'المهام والمتابعات'),
  support: label('Customer support and tickets', 'دعم العملاء والتذاكر'), operations: label('Internal tasks and appointments', 'المهام والمواعيد الداخلية'),
  other: label('Other business processes', 'عمليات أعمال أخرى'),
};
export function selectedGoals(answers: SetupAnswers): Array<typeof goalIds[number]> {
  if (answers.goals?.length) return answers.goals;
  return answers.priority === 'relationships' ? ['customers'] : answers.priority === 'delivery' ? ['customers', 'tasks', 'support'] : ['customers', 'leads', 'pipelines', 'tasks'];
}

// The registry emits only implemented modules and supported CustomFieldDefinition types.
// The same deterministic function powers the preview and trusted server provisioning.
export function recommendWorkspace(input: unknown, standard = false) {
  const answers = answersSchema.parse(input);
  const template = industries[standard ? 'other' : answers.industry];
  let modules: SetupModule[] = ['dashboard', 'clients', 'contacts', 'leads', 'tasks'];
  if (standard || answers.priority === 'sales') modules.push('deals', 'pipelines');
  if (!standard && (answers.priority === 'delivery' || answers.industry === 'real_estate' || answers.industry === 'education')) modules.push('calendar');
  if (!standard && answers.priority === 'delivery') modules.push('tickets');
  if (!standard && answers.priority === 'sales' && ['services', 'technology', 'agencies'].includes(answers.industry)) modules.push('proposals');
  if (!standard && answers.goals !== undefined) {
    const goalModules: Record<typeof goalIds[number], SetupModule[]> = {
      customers: ['clients', 'contacts'], leads: ['leads', 'contacts', 'deals', 'pipelines'], pipelines: ['leads', 'deals', 'pipelines'],
      tasks: ['tasks', 'calendar'], support: ['clients', 'contacts', 'tickets', 'tasks'], operations: ['tasks', 'calendar'], other: ['clients', 'contacts', 'tasks'],
    };
    modules = [...new Set<SetupModule>(['dashboard', ...selectedGoals(answers).flatMap(goal => goalModules[goal])])];
    if (modules.includes('deals') && ['services', 'technology', 'agencies'].includes(answers.industry)) modules.push('proposals');
  }
  if (!standard && answers.modules) modules = answers.modules;
  const openStages = !standard && answers.pipelineStages ? answers.pipelineStages.map(name => label(name, name)) : template.stages;
  return {
    version: 1, templateId: standard ? 'standard' : answers.industry, modules,
    stages: modules.includes('deals') ? [...openStages.map((name, order) => ({ name, order, type: 'OPEN', probability: Math.round(10 + order * 70 / Math.max(1, openStages.length - 1)) })), { name: label('Won', 'ناجحة'), order: openStages.length, type: 'WON', probability: 100 }, { name: label('Lost', 'غير ناجحة'), order: openStages.length + 1, type: 'LOST', probability: 0 }] : [],
    fields: standard || !modules.includes('leads') ? [] : [{ ...template.field, entityType: 'LEAD' as const, fieldType: 'TEXT' as const }],
    builtInFields: [label('Name', 'الاسم'), label('Email', 'البريد الإلكتروني'), label('Phone', 'الهاتف'), label('Company', 'الشركة')],
    note: standard ? undefined : template.note,
    firstRoute: modules.includes('leads') ? '/leads' : modules.includes('clients') ? '/clients' : modules.includes('tasks') ? '/tasks' : '/dashboard',
    customized: !standard && (answers.modules !== undefined || answers.pipelineStages !== undefined),
  };
}

export const setupStateSchema = z.object({
  version: z.literal(1), ownerId: z.string(), status: z.enum(['PENDING', 'COMPLETE']), step: z.number().int().min(1).max(4),
  answers: answersSchema, startedAt: z.string().datetime(), signupStartedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(), firstUsefulAt: z.string().datetime().optional(), standard: z.boolean().default(false),
  enteredAt: z.string().datetime().optional(), checklistDismissed: z.boolean().optional(),
  checklistCompleted: z.array(z.enum(['invite', 'pipeline', 'task'])).max(3).refine(unique).optional(),
});
export type SetupState = z.infer<typeof setupStateSchema>;
export function readSetupState(raw: string | null | undefined): SetupState | null {
  if (!raw) return null;
  return setupStateSchema.parse(JSON.parse(raw));
}
export function initialSetup(ownerId: string, workspace: string, language: 'en' | 'ar', signupStartedAt?: string): SetupState {
  const now = new Date().toISOString();
  const start = signupStartedAt && Date.parse(signupStartedAt) <= Date.now() && Date.parse(signupStartedAt) > Date.now() - 86400000 ? signupStartedAt : now;
  return { version: 1, ownerId, status: 'PENDING', step: 1, answers: answersSchema.parse({ workspace, language }), startedAt: now, signupStartedAt: start, standard: false };
}

export function visibleSetupNavigation(href: string, modules?: string[]) {
  if (!modules) return true; // Legacy organizations retain their navigation.
  const route = href.split('?')[0];
  if (['/messages', '/chat', '/todos', '/support'].includes(route)) return true;
  const moduleName = ({ '/dashboard': 'dashboard', '/clients': 'clients', '/contacts': 'contacts', '/leads': 'leads', '/deals': 'deals', '/pipelines': 'pipelines', '/tasks': 'tasks', '/calendar': 'calendar', '/tickets': 'tickets', '/proposals': 'proposals', '/activity': 'activities' } as Record<string, string>)[route];
  return moduleName ? modules.includes(moduleName) : route.startsWith('/admin') || route.startsWith('/settings');
}
