import { HELP_TOPICS, type HelpTopic } from '@/lib/ai-assistant/helpKnowledgeBase';

export type SatrBotLanguage = 'ar' | 'en';

const EXTRA_TOPICS: HelpTopic[] = [
  {
    key: 'dashboardOverview',
    keywords: ['dashboard', 'home', 'overview', 'لوحة التحكم', 'الرئيسية', 'نظرة عامة'],
    en: { title: 'Dashboard and Workspace Overview', steps: ['Open Dashboard from the sidebar to see the main workspace indicators and recent work.', 'Use the quick links to open customers, tickets, tasks, sales pipelines, calendar, or support.', 'The information shown is limited to the modules and records your role and plan allow.'] },
    ar: { title: 'لوحة التحكم ونظرة عامة على مساحة العمل', steps: ['افتح "لوحة التحكم" من القائمة لرؤية مؤشرات مساحة العمل وآخر الأعمال.', 'استخدم الاختصارات لفتح العملاء أو التذاكر أو المهام أو مسارات المبيعات أو التقويم أو الدعم.', 'المعلومات الظاهرة تعتمد على الأقسام والصلاحيات المتاحة لدورك وباقة الشركة.'] },
  },
  {
    key: 'contactsAndLeads',
    keywords: ['contacts', 'leads', 'prospects', 'جهات الاتصال', 'العملاء المحتملون', 'عميل محتمل'],
    en: { title: 'Contacts and Leads', steps: ['Open Contacts or Leads from the sidebar.', 'Use search and filters to find records, then open a record for its details and activity.', 'Use the available create or edit actions only if your role has the required permission.'] },
    ar: { title: 'جهات الاتصال والعملاء المحتملون', steps: ['افتح "جهات الاتصال" أو "العملاء المحتملون" من القائمة الجانبية.', 'استخدم البحث والفلاتر للوصول إلى السجل ثم افتحه لرؤية التفاصيل والنشاط.', 'تظهر أزرار الإنشاء والتعديل فقط إذا كان دورك يملك الصلاحية المطلوبة.'] },
  },
  {
    key: 'dealsAndPipelines',
    keywords: ['deals', 'opportunities', 'pipeline', 'sales', 'صفقات', 'مسار مبيعات', 'المبيعات'],
    en: { title: 'Deals and Sales Pipelines', steps: ['Open Sales Pipelines to view stages and move work through the sales process.', 'Open Deals to create, review, and track opportunities connected to customers or contacts.', 'Your available actions depend on your role permissions and the company plan.'] },
    ar: { title: 'الصفقات ومسارات المبيعات', steps: ['افتح "مسارات المبيعات" لرؤية المراحل ومتابعة العمل ضمن عملية البيع.', 'افتح "الصفقات" لإنشاء ومراجعة ومتابعة الفرص المرتبطة بالعملاء أو جهات الاتصال.', 'الإجراءات المتاحة تعتمد على صلاحيات دورك وباقة الشركة.'] },
  },
  {
    key: 'tasksAndTodos',
    keywords: ['tasks', 'todo', 'my tasks', 'المهام', 'مهامي', 'ملاحظاتي', 'مذكرة', 'sticky notes'],
    en: { title: 'Tasks and My Notes', steps: ['Open Tasks for assigned operational work and due dates.', 'Open My To-do / My Notes for your private follow-up items and personal notes.', 'Use the Calendar to see task due dates and meetings together when the relevant module is enabled.'] },
    ar: { title: 'المهام وملاحظاتي الخاصة', steps: ['افتح "المهام" لمتابعة الأعمال المسندة إليك وتواريخ الاستحقاق.', 'افتح "ملاحظاتي" أو To-do لإدارة عناصر المتابعة والملاحظات الخاصة بك.', 'استخدم "التقويم" لرؤية مواعيد المهام والاجتماعات معًا عند تفعيل القسم.'] },
  },
  {
    key: 'rolesAndPermissions',
    keywords: ['roles', 'permissions', 'access', 'role matrix', 'الأدوار', 'الصلاحيات', 'مصفوفة الأدوار', 'صلاحية'],
    en: { title: 'Roles and Permissions', steps: ['The company administrator manages role access from Settings or Roles and Permissions.', 'Permissions control visibility and actions separately, such as view, create, edit, delete, send, and manage.', 'A user can only see plan-enabled modules that are also granted to their role or direct permissions.'] },
    ar: { title: 'الأدوار ومصفوفة الصلاحيات', steps: ['مدير الشركة يدير وصول الأدوار من الإعدادات أو صفحة الأدوار والصلاحيات.', 'يمكن ضبط الظهور والإجراءات بشكل منفصل مثل العرض والإنشاء والتعديل والحذف والإرسال والإدارة.', 'لا يظهر للمستخدم إلا القسم المتاح ضمن خطة الشركة والممنوح أيضًا لدوره أو لصلاحياته المباشرة.'] },
  },
  {
    key: 'companySuperAdmin',
    keywords: ['company super admin', 'super admin', 'administrator', 'مدير الشركة', 'company admin', 'سوبر أدمن'],
    en: { title: 'Company Super Admin', steps: ['The Company Super Admin controls the company workspace, users, roles, permissions, enabled modules, and organization settings.', 'The admin can grant each user only the modules and actions included in the company plan.', 'Platform-level settings remain separate from company administration and are managed by the platform administrator.'] },
    ar: { title: 'مدير الشركة الأعلى', steps: ['مدير الشركة الأعلى يتحكم بمساحة الشركة والمستخدمين والأدوار والصلاحيات والأقسام المفعلة وإعدادات المؤسسة.', 'يمكنه منح كل مستخدم الأقسام والإجراءات الموجودة ضمن خطة الشركة.', 'إعدادات مستوى المنصة منفصلة عن إدارة الشركة وتبقى لدى مدير المنصة.'] },
  },
  {
    key: 'organizationSettings',
    keywords: ['organization settings', 'company settings', 'language', 'theme', 'timezone', 'إعدادات المؤسسة', 'إعدادات الشركة', 'اللغة', 'الثيم', 'المنطقة الزمنية'],
    en: { title: 'Organization Settings, Language, and Theme', steps: ['Open Settings to update organization details, default language, timezone, currency, date format, and brand color.', 'Language and theme preferences are stored per user and do not change other users’ preferences.', 'Only users with organization settings permission can change company-wide settings.'] },
    ar: { title: 'إعدادات المؤسسة واللغة والثيم', steps: ['افتح "الإعدادات" لتعديل بيانات المؤسسة واللغة الافتراضية والمنطقة الزمنية والعملة وتنسيق التاريخ واللون.', 'تفضيلات اللغة والثيم محفوظة لكل مستخدم بشكل مستقل ولا تغيّر إعدادات المستخدمين الآخرين.', 'تعديل إعدادات الشركة يحتاج إلى صلاحية إدارة إعدادات المؤسسة.'] },
  },
  {
    key: 'emailIntegrations',
    keywords: ['email integration', 'google workspace', 'microsoft 365', 'send email', 'ربط البريد', 'جوجل', 'مايكروسوفت', 'إرسال بريد'],
    en: { title: 'Google Workspace and Microsoft 365 Email', steps: ['Open Settings → Organization email sending.', 'Connect the organization’s Google Workspace or Microsoft 365 sender and approve only the requested sending permission.', 'Customer emails are sent through the connected organization account; if a provider is under review, use the available alternative or contact Support.'] },
    ar: { title: 'ربط Google Workspace وMicrosoft 365', steps: ['افتح الإعدادات ← إرسال البريد باسم المؤسسة.', 'اربط حساب Google Workspace أو Microsoft 365 ووافق فقط على صلاحية الإرسال المطلوبة.', 'رسائل العملاء تُرسل من حساب المؤسسة المتصل؛ إذا كان أحد المزودين قيد المراجعة استخدم البديل المتاح أو تواصل مع الدعم.'] },
  },
  {
    key: 'analyticsAndConsent',
    keywords: ['google analytics', 'analytics', 'statistics', 'consent', 'تحليلات', 'إحصائيات', 'جوجل أناليتكس', 'الموافقة'],
    en: { title: 'Analytics and Privacy Consent', steps: ['Analytics runs only after the user chooses to allow analytics in the consent banner.', 'Rejecting analytics keeps non-essential tracking disabled; essential login and security functions continue to work.', 'Analytics and language/theme preferences are isolated to the current browser/user and do not change other users.'] },
    ar: { title: 'التحليلات وموافقة الخصوصية', steps: ['تعمل التحليلات فقط بعد اختيار المستخدم السماح بالتحليلات من شريط الموافقة.', 'عند الرفض يبقى التتبع غير الضروري متوقفًا، وتستمر وظائف الدخول والأمان الأساسية بالعمل.', 'التحليلات وتفضيلات اللغة والثيم مرتبطة بالمتصفح والمستخدم الحالي ولا تؤثر على المستخدمين الآخرين.'] },
  },
  {
    key: 'notifications',
    keywords: ['notifications', 'alerts', 'notification preferences', 'الإشعارات', 'التنبيهات', 'تفضيلات الإشعارات'],
    en: { title: 'Notifications', steps: ['Open the notifications bell to review updates assigned to you.', 'Use notification preferences to control supported notification categories for your own account.', 'Notification visibility follows your role and the records you are allowed to access.'] },
    ar: { title: 'الإشعارات', steps: ['افتح جرس الإشعارات لمراجعة التحديثات المرتبطة بك.', 'استخدم تفضيلات الإشعارات للتحكم بالفئات المتاحة لحسابك أنت.', 'ظهور الإشعارات يتبع دورك والسجلات التي تملك صلاحية الوصول إليها.'] },
  },
  {
    key: 'importExport',
    keywords: ['import', 'export', 'excel', 'csv', 'استيراد', 'تصدير', 'إكسل', 'ملف csv'],
    en: { title: 'Import and Export', steps: ['Open Import data to upload a supported spreadsheet and review the preview before committing records.', 'Fix validation issues shown in the preview before confirming the import.', 'Export options appear only for modules and roles that support export.'] },
    ar: { title: 'استيراد وتصدير البيانات', steps: ['افتح "استيراد البيانات" لرفع ملف مدعوم ومراجعة المعاينة قبل حفظ السجلات.', 'عالج أخطاء التحقق التي تظهر في المعاينة قبل تأكيد الاستيراد.', 'تظهر خيارات التصدير فقط للأقسام والأدوار التي تملك صلاحية التصدير.'] },
  },
  {
    key: 'supportCenter',
    keywords: ['support', 'help center', 'issue', 'ticket support', 'الدعم', 'مركز الدعم', 'مشكلة', 'طلب مساعدة'],
    en: { title: 'Contact the Support Center', steps: ['Open Support from the sidebar or use the Support Center button below when SatrBot cannot answer.', 'Write a clear subject and description and choose a priority.', 'Your request is saved for the platform team, and the support team will respond within 24 hours.'] },
    ar: { title: 'التواصل مع مركز الدعم', steps: ['افتح "الدعم" من القائمة أو استخدم زر مركز الدعم عندما لا يستطيع SatrBot الإجابة.', 'اكتب عنوانًا ووصفًا واضحين وحدد الأولوية.', 'يُحفظ الطلب لفريق المنصة، وسيرد فريق الدعم خلال 24 ساعة.'] },
  },
  {
    key: 'logoutAndSecurity',
    keywords: ['logout', 'sign out', 'password', 'security', 'تسجيل الخروج', 'الخروج', 'كلمة المرور', 'الأمان'],
    en: { title: 'Account and Security', steps: ['Use the account menu to sign out of the current workspace.', 'Use Profile or Settings to manage the available personal account options.', 'Never share passwords, OAuth client secrets, or access tokens with other users.'] },
    ar: { title: 'الحساب والأمان', steps: ['استخدم قائمة الحساب لتسجيل الخروج من مساحة العمل الحالية.', 'افتح الملف الشخصي أو الإعدادات لإدارة خيارات الحساب الشخصية المتاحة.', 'لا تشارك كلمات المرور أو مفاتيح OAuth أو رموز الوصول مع أي مستخدم آخر.'] },
  },
];

export const SATRBOT_TOPICS: HelpTopic[] = [...HELP_TOPICS, ...EXTRA_TOPICS];

const STOP_WORDS = new Set([
  'كيف', 'شو', 'ماذا', 'ما', 'هو', 'هي', 'هل', 'انا', 'أنا', 'بدي', 'اريد', 'أريد', 'ممكن', 'وين', 'أين', 'من', 'على', 'في', 'عن', 'the', 'how', 'what', 'where', 'can', 'do', 'i', 'is', 'a', 'an', 'to', 'for', 'my', 'of', 'and', 'or',
]);

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token)));
}

function topicSearchText(topic: HelpTopic, language: SatrBotLanguage) {
  const localized = topic[language];
  return normalize([topic.key, ...topic.keywords, localized.title, ...localized.steps].join(' '));
}

export function retrieveSatrBotTopic(query: string, language: SatrBotLanguage, visibleTopics = SATRBOT_TOPICS) {
  const cleanQuery = normalize(query);
  const queryTokens = tokens(query);
  if (!cleanQuery || queryTokens.size === 0) return null;

  const ranked = visibleTopics.map((topic) => {
    const searchText = topicSearchText(topic, language);
    const keywordText = normalize(topic.keywords.join(' '));
    let score = 0;
    if (searchText.includes(cleanQuery)) score += 8;
    if (keywordText.includes(cleanQuery)) score += 7;
    for (const token of queryTokens) {
      if (keywordText.split(' ').includes(token)) score += 4;
      else if (searchText.split(' ').includes(token)) score += 1;
    }
    return { topic, score };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return best && best.score >= 4 ? best.topic : null;
}

export function formatSatrBotAnswer(topic: HelpTopic, language: SatrBotLanguage) {
  const localized = topic[language];
  return [`${localized.title}`, ...localized.steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
}
