export type LegalLanguage = 'ar' | 'en';
export type LocalizedText = Record<LegalLanguage, string>;

export type PolicySection = {
  id: string;
  title: LocalizedText;
  paragraphs: LocalizedText[];
  bullets?: LocalizedText[];
};

export type LegalPolicy = {
  id: string;
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  purpose: LocalizedText;
  scope: LocalizedText;
  version: string;
  lastUpdated: string;
  effectiveDate: LocalizedText;
  related: string[];
  sections: PolicySection[];
};

const text = (en: string, ar: string): LocalizedText => ({ en, ar });
const section = (id: string, title: LocalizedText, paragraphs: LocalizedText[], bullets?: LocalizedText[]): PolicySection => ({ id, title, paragraphs, bullets });

const draftDate = text('Not effective — draft for company and legal review', 'غير نافذة — مسودة لمراجعة الشركة والمستشار القانوني');
const reviewed = '2026-10-20';

export const legalSources = [
  {
    title: text('Jordan Personal Data Protection Law No. 24 of 2023', 'قانون حماية البيانات الشخصية الأردني رقم 24 لسنة 2023'),
    href: 'https://www.modee.gov.jo/ebv4.0/root_storage/ar/eb_list_page/%D9%82%D8%A7%D9%86%D9%88%D9%86_%D8%AD%D9%85%D8%A7%D9%8A%D8%A9_%D8%A7%D9%84%D8%A8%D9%8A%D8%A7%D9%86%D8%A7%D8%AA_%D8%A7%D9%84%D8%B4%D8%AE%D8%B5%D9%8A%D8%A9_%D8%A7%D9%84%D8%A7%D8%B1%D8%AF%D9%86%D9%8A.pdf',
  },
  {
    title: text('Official law, regulations and instructions portal', 'البوابة الرسمية للقانون والأنظمة والتعليمات الصادرة بمقتضاه'),
    href: 'https://www.modee.gov.jo/AR/List/%D8%A7%D9%84%D9%82%D9%88%D8%A7%D9%86%D9%8A%D9%86_%D9%88%D8%A7%D9%84%D8%A3%D9%86%D8%B8%D9%85%D8%A9_%D9%88_%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85%D8%A7%D8%AA_%D8%A7%D9%84%D8%B5%D8%A7%D8%AF%D8%B1%D8%A9_%D8%A8%D9%85%D9%82%D8%AA%D8%B6%D8%A7%D9%87',
  },
  {
    title: text('Official privacy-policy preparation guide', 'الدليل الرسمي لإعداد سياسة الخصوصية'),
    href: 'https://www.modee.gov.jo/ebv4.0/root_storage/ar/eb_list_page/%D8%A7%D9%84%D8%AF%D9%84%D9%8A%D9%84_%D8%A7%D9%84%D8%A5%D8%B1%D8%B4%D8%A7%D8%AF%D9%8A_%D9%84%D8%A5%D8%B9%D8%AF%D8%A7%D8%AF_%D8%B3%D9%8A%D8%A7%D8%B3%D8%A9_%D8%A7%D9%84%D8%AE%D8%B5%D9%88%D8%B5%D9%8A%D8%A9.pdf',
  },
  {
    title: text('Jordan Consumer Protection Law No. 7 of 2017 — Ministry list', 'قانون حماية المستهلك رقم 7 لسنة 2017 — قائمة الوزارة'),
    href: 'https://www.mit.gov.jo/Ar/List/%D8%A7%D9%84%D9%82%D9%88%D8%A7%D9%86%D9%8A%D9%86',
  },
  {
    title: text('Electronic Transactions Law No. 15 of 2015 — Official Gazette', 'قانون المعاملات الإلكترونية رقم 15 لسنة 2015 — الجريدة الرسمية'),
    href: 'https://pm.gov.jo/Ar/Pages/NewsPaperDetails/5341',
  },
  {
    title: text('Electronic Transactions amending law No. 1 of 2026 — Official Gazette', 'القانون المعدل لقانون المعاملات الإلكترونية رقم 1 لسنة 2026 — الجريدة الرسمية'),
    href: 'https://www.pm.gov.jo/Ar/Pages/NewsPaperDetails/6038',
  },
] as const;

export const LEGAL_POLICIES: LegalPolicy[] = [
  {
    id: 'terms-of-service', slug: 'terms', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Terms of Service', 'شروط الخدمة'),
    summary: text('Rules for accounts, workspaces, customer content, permitted use, suspension and termination.', 'قواعد الحسابات ومساحات العمل ومحتوى العملاء والاستخدام المسموح والتعليق والإنهاء.'),
    purpose: text('To describe the proposed contractual framework for using CodeLine CRM without displacing mandatory legal rights.', 'بيان الإطار التعاقدي المقترح لاستخدام CodeLine CRM دون الانتقاص من الحقوق القانونية الآمرة.'),
    scope: text('Visitors, account holders and organizations using or evaluating the service.', 'الزوار وأصحاب الحسابات والمؤسسات التي تستخدم الخدمة أو تقيّمها.'),
    related: ['privacy', 'subscription-billing', 'acceptable-use', 'availability-support', 'legal-notices'],
    sections: [
      section('service', text('1. Service and contracting party', '1. الخدمة والطرف المتعاقد'), [
        text('CodeLine CRM provides tenant-based customer relationship and operations tools. The registered legal entity, registration number and registered address have not yet been verified; they must be inserted and approved before these terms become effective.', 'توفر CodeLine CRM أدوات لإدارة علاقات العملاء والعمليات ضمن مساحات عمل منفصلة. لم يتم بعد التحقق من اسم الكيان القانوني المسجل ورقم تسجيله وعنوانه، ويجب إدراجها واعتمادها قبل نفاذ هذه الشروط.'),
        text('These pages are review drafts. Creating an account does not currently record acceptance of this draft or make it binding.', 'هذه الصفحات مسودات للمراجعة. لا يسجل إنشاء الحساب حاليًا قبول هذه المسودة ولا يجعلها ملزمة.'),
      ]),
      section('accounts', text('2. Accounts and organization authority', '2. الحسابات وصلاحية المؤسسة'), [
        text('Users must provide accurate account information, protect credentials and use only accounts they are authorized to access. Workspace administrators control invitations, roles and permissions for their organization.', 'يجب على المستخدمين تقديم بيانات حساب صحيحة وحماية بيانات الدخول واستخدام الحسابات المصرح لهم بها فقط. ويتحكم مسؤولو مساحة العمل في الدعوات والأدوار والصلاحيات داخل مؤسستهم.'),
        text('The person creating or administering a workspace must have authority to act for the organization and to instruct CodeLine regarding organization-controlled data.', 'يجب أن يكون منشئ مساحة العمل أو مديرها مخولًا بالتصرف باسم المؤسسة وبإعطاء CodeLine التعليمات المتعلقة بالبيانات التي تتحكم بها المؤسسة.'),
      ]),
      section('customer-data', text('3. Customer data and responsibilities', '3. بيانات العميل ومسؤولياته'), [
        text('Customers retain their rights in CRM records, files and other content they submit. They grant only the permissions reasonably needed to host, process, transmit and support that content for the service.', 'يحتفظ العملاء بحقوقهم في سجلات CRM والملفات والمحتوى الذي يقدمونه، ويمنحون فقط الصلاحيات اللازمة بصورة معقولة لاستضافة ذلك المحتوى ومعالجته ونقله ودعمه لتقديم الخدمة.'),
      ], [
        text('Collect and upload personal data lawfully and provide required notices.', 'جمع البيانات الشخصية ورفعها بصورة مشروعة وتقديم الإشعارات المطلوبة.'),
        text('Configure roles and permissions appropriately and promptly remove access that is no longer needed.', 'ضبط الأدوار والصلاحيات بصورة مناسبة وإزالة الوصول الذي لم يعد مطلوبًا دون تأخير.'),
        text('Review exports, messages, proposals and AI-assisted results before relying on or sending them.', 'مراجعة الصادرات والرسائل والعروض والنتائج المدعومة بالذكاء الاصطناعي قبل الاعتماد عليها أو إرسالها.'),
      ]),
      section('changes', text('4. Changes, suspension and termination', '4. التغييرات والتعليق والإنهاء'), [
        text('CodeLine may restrict access when reasonably necessary to protect the service, users or third parties; address unlawful or prohibited use; respond to security risk; or apply subscription status. Material contractual changes should be notified and, where required, accepted prospectively.', 'يجوز لـ CodeLine تقييد الوصول عند الضرورة المعقولة لحماية الخدمة أو المستخدمين أو الغير، أو لمعالجة استخدام غير مشروع أو محظور، أو للاستجابة لمخاطر أمنية، أو لتطبيق حالة الاشتراك. وينبغي الإخطار بالتغييرات التعاقدية الجوهرية والحصول على قبول مستقبلي لها حيث يلزم.'),
        text('Termination consequences, liability limitations, indemnities, governing law and jurisdiction remain subject to Jordan-qualified legal review and are not stated as final terms in this draft.', 'تظل آثار الإنهاء وحدود المسؤولية والتعويضات والقانون الواجب التطبيق والاختصاص القضائي خاضعة لمراجعة محامٍ مؤهل في الأردن، ولا ترد في هذه المسودة باعتبارها شروطًا نهائية.'),
      ]),
    ],
  },
  {
    id: 'privacy-policy', slug: 'privacy', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Privacy Policy', 'سياسة الخصوصية'),
    summary: text('How account, service-operation and customer-controlled personal data is handled.', 'كيفية التعامل مع بيانات الحساب وتشغيل الخدمة والبيانات الشخصية التي يتحكم بها العميل.'),
    purpose: text('To explain processing transparently and distinguish CodeLine’s own purposes from customer instructions.', 'شرح المعالجة بشفافية والتمييز بين أغراض CodeLine الخاصة وتعليمات العملاء.'),
    scope: text('Public-site visitors, users, customer contacts whose data is placed in the CRM, and support correspondents.', 'زوار الموقع والمستخدمون وجهات اتصال العملاء الذين توضع بياناتهم في CRM ومراسلو الدعم.'),
    related: ['data-processing', 'retention-deletion', 'cookies', 'security', 'ai-third-parties'],
    sections: [
      section('roles', text('1. Processing roles', '1. أدوار المعالجة'), [
        text('For account registration, billing coordination, authentication, security, audit and service administration, CodeLine generally determines why and how data is processed and may act as a controller under applicable law.', 'بالنسبة لتسجيل الحساب وتنسيق الفوترة والمصادقة والأمن والتدقيق وإدارة الخدمة، تحدد CodeLine عمومًا أغراض المعالجة ووسائلها وقد تعمل بصفتها مسؤولًا عن المعالجة وفق القانون المطبق.'),
        text('For CRM records and files entered by a business customer, the customer generally determines the purpose and CodeLine processes data to provide the service on documented instructions. Exact role allocation must be confirmed in the DPA for each use case.', 'بالنسبة لسجلات CRM والملفات التي يدخلها عميل تجاري، تحدد المؤسسة العميلة الغرض عمومًا وتعالج CodeLine البيانات لتقديم الخدمة وفق تعليمات موثقة. ويجب تأكيد توزيع الأدوار بدقة في اتفاقية معالجة البيانات لكل حالة استخدام.'),
      ]),
      section('categories', text('2. Data categories and sources', '2. فئات البيانات ومصادرها'), [
        text('Verified categories include names, email addresses, password hashes, organization and role information, session and device metadata, audit events, subscription/payment-coordination records, support requests and feature configuration.', 'تشمل الفئات المتحقق منها الأسماء وعناوين البريد الإلكتروني وتجزئات كلمات المرور وبيانات المؤسسة والدور وبيانات الجلسة والجهاز وأحداث التدقيق وسجلات تنسيق الاشتراك والدفع وطلبات الدعم وإعدادات الميزات.'),
        text('Customer-controlled content may include clients, contacts, leads, customer records, deals, tasks, tickets, messages, calendar events, proposals, attachments, custom fields, imports, exports and AI prompts or research inputs. Customers decide what they place in these fields and must avoid unnecessary or unlawfully collected data.', 'قد يشمل المحتوى الذي يتحكم به العميل بيانات العملاء وجهات الاتصال والعملاء المحتملين وسجلات العملاء والصفقات والمهام والتذاكر والرسائل وأحداث التقويم والعروض والمرفقات والحقول المخصصة وعمليات الاستيراد والتصدير ومدخلات الذكاء الاصطناعي أو البحث. ويقرر العملاء ما يضعونه في هذه الحقول وعليهم تجنب البيانات غير اللازمة أو المجموعة بصورة غير مشروعة.'),
      ]),
      section('purposes', text('3. Purposes and legal grounds', '3. الأغراض والأسس القانونية'), [
        text('Processing supports account and workspace delivery, authentication, tenant isolation, permissions, customer-requested features, security monitoring, troubleshooting, support, payment coordination and compliance.', 'تدعم المعالجة تقديم الحساب ومساحة العمل والمصادقة وعزل المؤسسات والصلاحيات والميزات المطلوبة من العميل ومراقبة الأمن واستكشاف الأعطال والدعم وتنسيق الدفع والامتثال.'),
        text('The applicable legal ground may depend on the relationship and purpose, including consent, steps requested before or under a contract, legal obligations or other grounds permitted by Jordanian law. A final purpose-by-purpose legal-basis register requires company and counsel confirmation.', 'قد يختلف الأساس القانوني بحسب العلاقة والغرض، بما في ذلك الموافقة أو الخطوات المطلوبة قبل العقد أو بموجبه أو الالتزامات القانونية أو أسس أخرى يسمح بها القانون الأردني. ويتطلب سجل نهائي للأساس القانوني لكل غرض تأكيد الشركة والمستشار القانوني.'),
      ]),
      section('sharing', text('4. Recipients and international transfers', '4. المستلمون والنقل الدولي'), [
        text('The code supports database and object-storage providers, email delivery, Google and Microsoft OAuth, SMTP, Groq-backed AI research and a configurable hosted assistant proxy. Production providers, hosting regions, enabled integrations and transfer safeguards remain unverified and must be published before adoption.', 'يدعم الكود مزودي قاعدة البيانات وتخزين الكائنات وإرسال البريد وOAuth من Google وMicrosoft وSMTP وبحثًا بالذكاء الاصطناعي مدعومًا من Groq ووكيلًا قابلًا للضبط لمساعد مستضاف. ولا يزال مزودو الإنتاج ومناطق الاستضافة والتكاملات المفعلة وضمانات النقل غير متحقق منها ويجب نشرها قبل الاعتماد.'),
        text('CodeLine should not sell customer CRM data. Whether any provider independently uses submitted data is governed by its contract and active configuration and must not be represented until verified.', 'ينبغي ألا تبيع CodeLine بيانات CRM الخاصة بالعملاء. أما استخدام أي مزود للبيانات المقدمة لأغراضه فيحكمه عقده والإعداد الفعلي، ولا يجوز تقديم أي تأكيد بهذا الشأن قبل التحقق.'),
      ]),
      section('rights', text('5. Retention, security and individual rights', '5. الاحتفاظ والأمن وحقوق الأفراد'), [
        text('No general production retention or backup-deletion schedule has been verified. Expiry does not automatically delete workspace data. Details are maintained as open items in the retention policy.', 'لم يتم التحقق من جدول عام للاحتفاظ في الإنتاج أو حذف النسخ الاحتياطية. ولا يؤدي انتهاء الاشتراك إلى حذف بيانات مساحة العمل تلقائيًا. وترد التفاصيل كبنود مفتوحة في سياسة الاحتفاظ.'),
        text('Subject to applicable law and identity verification, individuals may have rights to information and access, withdrawal of consent, correction, restriction, erasure or anonymization, objection and portability. Requests involving customer-controlled CRM data may need to be directed to the customer organization as controller.', 'وفق القانون المطبق والتحقق من الهوية، قد تكون للأفراد حقوق في العلم والوصول وسحب الموافقة والتصحيح والتقييد والمحو أو إخفاء الهوية والاعتراض ونقل البيانات. وقد يلزم توجيه الطلبات المتعلقة ببيانات CRM التي يتحكم بها العميل إلى المؤسسة العميلة بصفتها المسؤول عن المعالجة.'),
        text('The current published general contact is info@codeline.jo. Its approval as the privacy and data-rights contact, and the identity of any required data protection officer, remain to be confirmed.', 'جهة الاتصال العامة المنشورة حاليًا هي info@codeline.jo. ولا يزال اعتمادها كجهة اتصال للخصوصية وحقوق البيانات وتحديد أي مراقب حماية بيانات مطلوب بحاجة إلى تأكيد.'),
      ]),
    ],
  },
  {
    id: 'subscription-terms', slug: 'subscription-billing', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Subscription, Pricing, Billing and Renewal Terms', 'شروط الاشتراك والتسعير والفوترة والتجديد'),
    summary: text('Trial, manual payment, activation, expiry and access-state rules.', 'قواعد التجربة والدفع اليدوي والتفعيل والانتهاء وحالات الوصول.'),
    purpose: text('To document verified subscription behavior while operational annual pricing remains under a separate change gate.', 'توثيق سلوك الاشتراك المتحقق منه مع بقاء التسعير السنوي التشغيلي خاضعًا لبوابة تغيير مستقلة.'),
    scope: text('Organizations evaluating or purchasing a CodeLine CRM subscription.', 'المؤسسات التي تقيّم اشتراك CodeLine CRM أو تشتريه.'),
    related: ['terms', 'cancellation-refunds', 'availability-support', 'retention-deletion'],
    sections: [
      section('pricing-status', text('1. Pricing status', '1. حالة التسعير'), [
        text('Commercial annual targets have been approved internally, but the current product calculations and stored request snapshots are not yet aligned. This draft intentionally does not publish a binding price table or change any operational amount.', 'تم اعتماد الأسعار السنوية المستهدفة تجاريًا داخليًا، لكن حسابات المنتج الحالية ولقطات الطلبات المحفوظة لم توحّد بعد. ولذلك لا تنشر هذه المسودة جدول أسعار ملزمًا ولا تغيّر أي مبلغ تشغيلي.'),
        text('Before public publication, the catalog, workspace display and new-request snapshot path must use one approved source of truth. Historical snapshots will not be silently rewritten.', 'قبل النشر العام، يجب أن يستخدم الكتالوج وعرض مساحة العمل ومسار لقطة الطلب الجديد مصدرًا واحدًا معتمدًا. ولن يعاد كتابة اللقطات التاريخية بصمت.'),
      ]),
      section('trial', text('2. Trial and expiry', '2. الفترة التجريبية والانتهاء'), [
        text('Where offered, a new workspace receives a seven-day trial based on authoritative stored timestamps. During the final 24 hours, the interface may display an expiry warning.', 'عند إتاحتها، تحصل مساحة العمل الجديدة على فترة تجريبية مدتها سبعة أيام استنادًا إلى طوابع زمنية مخزنة وموثوقة. وقد تعرض الواجهة تنبيهًا خلال آخر 24 ساعة.'),
        text('After trial or paid-subscription expiry, the current implementation provides exactly 72 elapsed hours of read-only access. Write operations are blocked. After that period, the workspace remains expired and read-only; it is not automatically deleted.', 'بعد انتهاء التجربة أو الاشتراك المدفوع، يوفر التنفيذ الحالي 72 ساعة منقضية بالضبط من الوصول للقراءة فقط، مع حظر عمليات الكتابة. وبعدها تظل مساحة العمل منتهية وبوضع القراءة فقط ولا تحذف تلقائيًا.'),
      ]),
      section('payment', text('3. Payment and activation', '3. الدفع والتفعيل'), [
        text('The audited flow coordinates payment manually, including bank-transfer verification by an authorized platform administrator. Submitting an activation request is not payment confirmation and does not activate the subscription.', 'ينسق المسار المدقق الدفع يدويًا، بما في ذلك التحقق من التحويل البنكي بواسطة مدير منصة مخول. ولا يعد تقديم طلب التفعيل تأكيدًا للدفع ولا يفعّل الاشتراك.'),
        text('Activation requires the confirmed amount and currency to match the immutable request snapshot. Paid periods currently begin at the recorded payment-confirmation timestamp and run for one or twelve UTC calendar months according to the selected interval and configured policy.', 'يتطلب التفعيل تطابق المبلغ والعملة المؤكدين مع لقطة الطلب غير القابلة للتغيير. وتبدأ الفترات المدفوعة حاليًا من طابع وقت تأكيد الدفع المسجل وتمتد شهرًا تقويميًا واحدًا أو اثني عشر شهرًا بتوقيت UTC بحسب الفترة المختارة والسياسة المضبوطة.'),
      ]),
      section('renewal', text('4. Renewal, failures and changes', '4. التجديد والإخفاقات والتغييرات'), [
        text('No automatic card charging or automatic renewal was found. Renewal and payment-failure procedures are manual and require company confirmation before final wording.', 'لم يُعثر على شحن تلقائي للبطاقات أو تجديد تلقائي. وإجراءات التجديد وإخفاق الدفع يدوية وتحتاج إلى تأكيد الشركة قبل الصياغة النهائية.'),
        text('Taxes, invoicing requirements, whether quoted prices include tax, upgrade timing and downgrade treatment remain unverified. No current calculation was found that adds tax or fees to the annual amount.', 'لا تزال الضرائب ومتطلبات الفوترة وما إذا كانت الأسعار تشمل الضريبة وتوقيت الترقية ومعالجة التخفيض غير متحقق منها. ولم يوجد في الحساب الحالي ما يضيف ضريبة أو رسومًا إلى المبلغ السنوي.'),
      ]),
    ],
  },
  {
    id: 'data-processing-agreement', slug: 'data-processing', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Data Processing Agreement', 'اتفاقية معالجة البيانات'),
    summary: text('Proposed controller–processor terms for business-customer CRM data.', 'شروط مقترحة لعلاقة المسؤول والمعالج لبيانات CRM الخاصة بعملاء الأعمال.'),
    purpose: text('To define processing instructions, confidentiality, security, assistance and end-of-service handling.', 'تحديد تعليمات المعالجة والسرية والأمن والمساعدة والتعامل عند انتهاء الخدمة.'),
    scope: text('Business customers where CodeLine processes personal data on their documented instructions.', 'عملاء الأعمال عندما تعالج CodeLine البيانات الشخصية وفق تعليماتهم الموثقة.'),
    related: ['privacy', 'security', 'retention-deletion', 'ai-third-parties'],
    sections: [
      section('roles', text('1. Roles and instructions', '1. الأدوار والتعليمات'), [
        text('The customer generally acts as controller for personal data it places in CRM records; CodeLine acts as processor only to the extent it handles that data to provide and support the service. Processing outside documented instructions requires a lawful basis and notice where legally permitted.', 'تعمل المؤسسة العميلة عمومًا بصفتها المسؤول عن البيانات الشخصية التي تضعها في سجلات CRM، وتعمل CodeLine كمعالج فقط بقدر تعاملها مع تلك البيانات لتقديم الخدمة ودعمها. وتتطلب المعالجة خارج التعليمات الموثقة أساسًا قانونيًا وإخطارًا حيث يسمح القانون.'),
      ]),
      section('details', text('2. Processing details', '2. تفاصيل المعالجة'), [
        text('Subject matter: hosted CRM and operations services. Duration: the service relationship plus an approved retention/deletion period. Data and subjects vary with customer configuration and may include customer contacts, staff, prospects, suppliers, learners or support correspondents.', 'موضوع المعالجة: خدمات CRM والعمليات المستضافة. المدة: مدة علاقة الخدمة مضافًا إليها فترة احتفاظ/حذف معتمدة. وتختلف البيانات والأشخاص بحسب إعداد العميل وقد تشمل جهات اتصال العملاء والموظفين والعملاء المحتملين والموردين والمتعلمين أو مراسلي الدعم.'),
        text('A final annex must identify production locations, categories, sensitive-data restrictions, approved subprocessors and retention periods; those items are not yet verified.', 'يجب أن يحدد الملحق النهائي مواقع الإنتاج والفئات وقيود البيانات الحساسة والمعالجين الفرعيين المعتمدين وفترات الاحتفاظ، وهذه البنود لم يتم التحقق منها بعد.'),
      ]),
      section('duties', text('3. Processor commitments', '3. التزامات المعالج'), [
        text('The proposed commitments include confidentiality for authorized personnel, appropriate technical and organizational measures, controlled subprocessing, assistance with data-subject requests and impact assessments, incident cooperation, return/export and deletion according to approved instructions.', 'تشمل الالتزامات المقترحة سرية الأشخاص المخولين وتدابير تقنية وتنظيمية مناسبة وضبط المعالجة الفرعية والمساعدة في طلبات أصحاب البيانات وتقييمات الأثر والتعاون في الحوادث وإرجاع/تصدير البيانات وحذفها وفق تعليمات معتمدة.'),
        text('This draft does not claim a certification, fixed incident-notification deadline, specific encryption standard, backup guarantee or audit certification that has not been verified.', 'لا تدعي هذه المسودة وجود شهادة أو مهلة ثابتة للإخطار بالحوادث أو معيار تشفير محدد أو ضمان نسخ احتياطي أو شهادة تدقيق لم يتم التحقق منها.'),
      ]),
      section('transfers', text('4. Subprocessors, transfers and audits', '4. المعالجون الفرعيون والنقل والتدقيق'), [
        text('CodeLine should maintain a current subprocessor list, provide an appropriate change mechanism and use required transfer safeguards before personal data is processed outside Jordan. The production list and transfer mechanism remain company-confirmation items.', 'ينبغي لـ CodeLine الاحتفاظ بقائمة محدثة للمعالجين الفرعيين وتوفير آلية مناسبة للتغييرات واستخدام ضمانات النقل المطلوبة قبل معالجة البيانات الشخصية خارج الأردن. وتظل قائمة الإنتاج وآلية النقل بحاجة إلى تأكيد الشركة.'),
        text('Reasonable compliance information and audits should be addressed without compromising other customers, security or confidentiality. Audit scope, frequency and cost allocation require legal and commercial review.', 'ينبغي توفير معلومات امتثال وعمليات تدقيق معقولة دون المساس بعملاء آخرين أو الأمن أو السرية. ويتطلب نطاق التدقيق وتكراره وتوزيع كلفته مراجعة قانونية وتجارية.'),
      ]),
    ],
  },
  {
    id: 'acceptable-use-policy', slug: 'acceptable-use', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Acceptable Use Policy', 'سياسة الاستخدام المقبول'),
    summary: text('Prohibited conduct designed to protect users, third parties and the service.', 'السلوك المحظور لحماية المستخدمين والغير والخدمة.'),
    purpose: text('To set clear, proportionate service-use boundaries.', 'وضع حدود واضحة ومتناسبة لاستخدام الخدمة.'),
    scope: text('All visitors, users, integrations, uploads and automated access.', 'جميع الزوار والمستخدمين والتكاملات والملفات المرفوعة والوصول الآلي.'),
    related: ['terms', 'security', 'ai-third-parties', 'intellectual-property'],
    sections: [
      section('prohibited', text('1. Prohibited activity', '1. الأنشطة المحظورة'), [text('Users must not use the service to violate law, rights, confidentiality or contractual duties, or to facilitate harm.', 'يحظر استخدام الخدمة لمخالفة القانون أو الحقوق أو السرية أو الالتزامات التعاقدية أو لتسهيل الضرر.')], [
        text('Unauthorized access, credential sharing, probing, malware, denial-of-service or bypassing limits.', 'الوصول غير المصرح ومشاركة بيانات الدخول والفحص الأمني والبرمجيات الضارة وحجب الخدمة أو تجاوز الحدود.'),
        text('Unlawful surveillance, harassment, discrimination, fraud, spam or deceptive communications.', 'المراقبة غير المشروعة أو المضايقة أو التمييز أو الاحتيال أو الرسائل المزعجة أو الاتصالات المضللة.'),
        text('Uploading content without required rights, notices or lawful grounds.', 'رفع محتوى دون الحقوق أو الإشعارات أو الأسس القانونية المطلوبة.'),
        text('Using AI features for fully automated high-impact decisions without appropriate authority and human review.', 'استخدام ميزات الذكاء الاصطناعي لاتخاذ قرارات مؤثرة مؤتمتة بالكامل دون سلطة ومراجعة بشرية مناسبة.'),
      ]),
      section('resources', text('2. Resource and integration use', '2. استخدام الموارد والتكاملات'), [
        text('Customers must respect upload, rate, concurrency and storage controls and must not interfere with other tenants. OAuth, email and third-party connections may be used only with authority over the connected account.', 'يجب احترام ضوابط الرفع والمعدل والتزامن والتخزين وعدم التأثير في المؤسسات الأخرى. ولا تستخدم اتصالات OAuth والبريد والخدمات الخارجية إلا بتفويض على الحساب المتصل.'),
      ]),
      section('response', text('3. Response to violations', '3. الاستجابة للمخالفات'), [
        text('CodeLine may investigate, limit a feature, preserve relevant evidence, suspend access or terminate service where proportionate. Notice and an opportunity to respond should be provided when reasonably possible and lawful.', 'يجوز لـ CodeLine التحقيق أو تقييد ميزة أو حفظ الأدلة ذات الصلة أو تعليق الوصول أو إنهاء الخدمة بصورة متناسبة. وينبغي تقديم إخطار وفرصة للرد متى كان ذلك ممكنًا بصورة معقولة ومشروعة.'),
      ]),
    ],
  },
  {
    id: 'cancellation-refund-dispute', slug: 'cancellation-refunds', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Cancellation, Refund and Payment Dispute Policy', 'سياسة الإلغاء والاسترداد ونزاعات الدفع'),
    summary: text('Proposed process for stopping service, disputed transfers and refund review.', 'العملية المقترحة لإيقاف الخدمة والتحويلات المتنازع عليها ومراجعة الاسترداد.'),
    purpose: text('To provide a fair process without promising unimplemented automatic refunds.', 'توفير عملية عادلة دون الوعد باستردادات تلقائية غير منفذة.'),
    scope: text('Trials, manual activation requests and paid subscriptions.', 'الفترات التجريبية وطلبات التفعيل اليدوية والاشتراكات المدفوعة.'),
    related: ['subscription-billing', 'terms', 'legal-notices', 'retention-deletion'],
    sections: [
      section('cancel', text('1. Cancellation requests', '1. طلبات الإلغاء'), [
        text('The audited product has an administrative cancellation state for pending activation requests but no verified customer self-service cancellation workflow. Customers should use the published support contact until a formal channel is confirmed.', 'يحتوي المنتج المدقق على حالة إلغاء إدارية لطلبات التفعيل المعلقة، لكنه لا يتضمن مسار إلغاء ذاتي متحققًا منه للعميل. وعلى العملاء استخدام جهة الدعم المنشورة إلى أن تعتمد قناة رسمية.'),
        text('Cancellation timing, notice periods and whether service continues through a paid period require company confirmation. Cancellation does not by itself mean immediate deletion of workspace data.', 'تحتاج مهلة الإلغاء وفترة الإشعار وما إذا كانت الخدمة تستمر حتى نهاية الفترة المدفوعة إلى تأكيد الشركة. ولا يعني الإلغاء بحد ذاته حذف بيانات مساحة العمل فورًا.'),
      ]),
      section('refunds', text('2. Refund review', '2. مراجعة الاسترداد'), [
        text('No automatic refund or prorated-refund mechanism was found. This draft neither promises nor excludes a refund. Requests should be reviewed against the confirmed commercial policy, the transaction facts, applicable consumer protections and any mandatory legal rights.', 'لم يُعثر على آلية استرداد تلقائي أو نسبي. ولا تعد هذه المسودة بالاسترداد ولا تستبعده. وينبغي مراجعة الطلبات وفق السياسة التجارية المؤكدة ووقائع المعاملة وحماية المستهلك المطبقة وأي حقوق قانونية آمرة.'),
      ]),
      section('disputes', text('3. Payment disputes', '3. نزاعات الدفع'), [
        text('A customer disputing a bank-transfer amount, duplicate payment or activation status should provide the request identifier, transfer reference, date, amount and non-sensitive supporting evidence. CodeLine should preserve the original request snapshot and audit trail while investigating.', 'على العميل الذي ينازع في مبلغ تحويل بنكي أو دفع مكرر أو حالة تفعيل أن يقدم معرف الطلب ومرجع التحويل والتاريخ والمبلغ وأدلة مؤيدة غير حساسة. وينبغي لـ CodeLine الحفاظ على لقطة الطلب الأصلية ومسار التدقيق أثناء التحقيق.'),
      ]),
    ],
  },
  {
    id: 'information-security', slug: 'security', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Information Security and Incident Response Policy', 'سياسة أمن المعلومات والاستجابة للحوادث'),
    summary: text('Verified application controls, shared responsibilities and a cautious incident process.', 'ضوابط التطبيق المتحققة والمسؤوليات المشتركة وعملية حذرة للحوادث.'),
    purpose: text('To describe current control categories without claiming unverified certifications or guarantees.', 'وصف فئات الضوابط الحالية دون ادعاء شهادات أو ضمانات غير متحققة.'),
    scope: text('The CodeLine application, accounts, customer workspaces, integrations and stored service data.', 'تطبيق CodeLine والحسابات ومساحات العملاء والتكاملات وبيانات الخدمة المخزنة.'),
    related: ['privacy', 'data-processing', 'acceptable-use', 'availability-support'],
    sections: [
      section('controls', text('1. Verified control categories', '1. فئات الضوابط المتحققة'), [
        text('The source includes server-side authentication and session checks, organization-scoped data access, roles and permissions, read-only enforcement after expiry, password hashing, audit events, rate/resource limits, upload validation and restricted attachment retrieval.', 'يتضمن المصدر فحوص المصادقة والجلسات على الخادم والوصول المقيد بالمؤسسة والأدوار والصلاحيات وفرض القراءة فقط بعد الانتهاء وتجزئة كلمات المرور وأحداث التدقيق وحدود المعدل والموارد والتحقق من الملفات المرفوعة وتقييد تنزيلها.'),
        text('OAuth credentials are stored through an application encryption helper when configured. This statement does not establish a particular production encryption standard, key-management regime or certification.', 'تخزن بيانات اعتماد OAuth عبر أداة تشفير في التطبيق عند ضبطها. ولا يثبت ذلك معيار تشفير إنتاجيًا محددًا أو نظام إدارة مفاتيح أو شهادة.'),
      ]),
      section('responsibility', text('2. Shared responsibility', '2. المسؤولية المشتركة'), [
        text('CodeLine is responsible for operating the service controls it manages. Customers are responsible for authorized users, role assignment, endpoint security, lawful integrations, credential protection, exports and the content they upload.', 'تتحمل CodeLine مسؤولية تشغيل ضوابط الخدمة التي تديرها. ويتحمل العملاء مسؤولية المستخدمين المخولين وتعيين الأدوار وأمن الأجهزة والتكاملات المشروعة وحماية بيانات الدخول والصادرات والمحتوى الذي يرفعونه.'),
      ]),
      section('incident', text('3. Incident response', '3. الاستجابة للحوادث'), [
        text('The proposed process is to validate reports, contain the event, preserve evidence, assess affected systems and data, remediate, recover and document lessons learned. Notifications should be made as required by applicable law and contracts after sufficient facts are available.', 'تتضمن العملية المقترحة التحقق من البلاغ واحتواء الحدث وحفظ الأدلة وتقييم الأنظمة والبيانات المتأثرة والمعالجة والاستعادة وتوثيق الدروس. وينبغي تقديم الإخطارات وفق ما يتطلبه القانون والعقود بعد توفر حقائق كافية.'),
        text('No fixed breach-notification period, uptime guarantee, recovery objective, penetration-test cadence, certification or backup-restoration commitment has been verified and none is promised here.', 'لم يتم التحقق من مهلة ثابتة للإخطار بالخرق أو ضمان إتاحة أو هدف استعادة أو وتيرة اختبار اختراق أو شهادة أو التزام باستعادة النسخ الاحتياطية، ولا تعد بها هذه المسودة.'),
      ]),
      section('reporting', text('4. Reporting concerns', '4. الإبلاغ عن المخاوف'), [
        text('Security reports may currently be sent to info@codeline.jo without including passwords, access tokens or unnecessary personal data. A dedicated security contact and escalation schedule remain to be confirmed.', 'يمكن حاليًا إرسال البلاغات الأمنية إلى info@codeline.jo دون تضمين كلمات المرور أو رموز الوصول أو بيانات شخصية غير لازمة. ولا تزال جهة اتصال أمنية مخصصة وجدول التصعيد بحاجة إلى تأكيد.'),
      ]),
    ],
  },
  {
    id: 'retention-export-deletion', slug: 'retention-deletion', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Data Retention, Export and Deletion Policy', 'سياسة الاحتفاظ بالبيانات وتصديرها وحذفها'),
    summary: text('What is currently exportable, what expiry does, and which retention periods remain unknown.', 'ما يمكن تصديره حاليًا وأثر الانتهاء وفترات الاحتفاظ التي لا تزال مجهولة.'),
    purpose: text('To avoid misleading deletion promises and establish the decisions needed for a complete lifecycle.', 'تجنب وعود حذف مضللة وتحديد القرارات اللازمة لدورة حياة مكتملة.'),
    scope: text('Account, workspace, CRM, file, import, audit, support and subscription records.', 'سجلات الحساب ومساحة العمل وCRM والملفات والاستيراد والتدقيق والدعم والاشتراك.'),
    related: ['privacy', 'data-processing', 'subscription-billing', 'security'],
    sections: [
      section('current', text('1. Current behavior', '1. السلوك الحالي'), [
        text('Subscription expiry triggers 72 elapsed hours of read-only access and then an expired read-only state. The application does not automatically delete the workspace at either point.', 'يؤدي انتهاء الاشتراك إلى 72 ساعة منقضية من الوصول للقراءة فقط ثم حالة منتهية للقراءة فقط. ولا يحذف التطبيق مساحة العمل تلقائيًا في أي من المرحلتين.'),
        text('Some supported screens and import jobs provide export or failure-file functions. This is not yet a verified full-workspace portability export.', 'توفر بعض الشاشات المدعومة وعمليات الاستيراد وظائف تصدير أو ملفات إخفاقات، ولا يشكل ذلك حتى الآن تصديرًا متحققًا منه وقابلًا للنقل لكامل مساحة العمل.'),
      ]),
      section('schedule', text('2. Retention schedule awaiting approval', '2. جدول الاحتفاظ بانتظار الاعتماد'), [
        text('The company must approve periods for account profiles, customer CRM data, deleted records, attachments, audit logs, login sessions, payment records, support cases, staged imports and backups. Until then, no fixed period should be promised publicly.', 'يجب على الشركة اعتماد فترات ملفات الحساب وبيانات CRM وسجلات الحذف والمرفقات وسجلات التدقيق وجلسات الدخول وسجلات الدفع وحالات الدعم وبيانات الاستيراد المرحلية والنسخ الاحتياطية. وحتى ذلك الحين لا يجوز الوعد علنًا بفترة ثابتة.'),
      ]),
      section('requests', text('3. Export and deletion requests', '3. طلبات التصدير والحذف'), [
        text('Workspace administrators should be able to request an available export before termination. Identity, authority and tenant scope must be verified before release.', 'ينبغي تمكين مسؤولي مساحة العمل من طلب تصدير متاح قبل الإنهاء، مع التحقق من الهوية والصلاحية ونطاق المؤسسة قبل التسليم.'),
        text('Deletion requests must account for customer instructions, legal obligations, disputes, security evidence, audit integrity and backup lifecycle. Data may need to be restricted or anonymized rather than immediately erased where law permits or requires.', 'يجب أن تراعي طلبات الحذف تعليمات العميل والالتزامات القانونية والنزاعات وأدلة الأمن وسلامة التدقيق ودورة النسخ الاحتياطية. وقد يلزم تقييد البيانات أو إخفاء هويتها بدل محوها فورًا حيث يسمح القانون أو يتطلب.'),
      ]),
    ],
  },
  {
    id: 'cookie-policy', slug: 'cookies', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Cookie and Local Storage Policy', 'سياسة ملفات الارتباط والتخزين المحلي'),
    summary: text('Essential session/OAuth cookies and browser preferences found in the application.', 'ملفات الجلسة وOAuth الضرورية وتفضيلات المتصفح الموجودة في التطبيق.'),
    purpose: text('To explain browser storage and when consent controls would be required.', 'شرح تخزين المتصفح ومتى تصبح ضوابط الموافقة مطلوبة.'),
    scope: text('Public pages, login, onboarding and authenticated use.', 'الصفحات العامة وتسجيل الدخول والتهيئة والاستخدام بعد المصادقة.'),
    related: ['privacy', 'ai-third-parties'],
    sections: [
      section('used', text('1. Storage currently identified', '1. التخزين المحدد حاليًا'), [
        text('The application uses an authentication session cookie, a short-lived OAuth state cookie during Google/Microsoft connection, and browser local storage for language and theme preferences. Signup-flow and integration handoff state may also be stored for functional continuity.', 'يستخدم التطبيق ملف ارتباط لجلسة المصادقة وملف حالة OAuth قصير العمر أثناء ربط Google/Microsoft وتخزين المتصفح المحلي لتفضيلات اللغة والمظهر. وقد تخزن أيضًا حالة مسار التسجيل وتسليم التكامل لاستمرارية الوظيفة.'),
      ]),
      section('optional', text('2. Optional tracking', '2. التتبع الاختياري'), [
        text('No advertising or analytics cookie implementation was verified in the audited source. Accordingly, no optional-cookie toggle or banner has been added merely for appearance.', 'لم يتم التحقق من وجود ملفات ارتباط إعلانية أو تحليلية في المصدر المدقق. لذلك لم تتم إضافة زر أو لافتة لموافقة اختيارية لمجرد الشكل.'),
        text('If optional analytics, advertising or similar technology is introduced, it should be documented and blocked until the required choice is made, with no preselected consent and an accessible withdrawal control.', 'إذا أضيفت تحليلات اختيارية أو إعلانات أو تقنية مشابهة، فيجب توثيقها وحجبها حتى إجراء الاختيار المطلوب دون موافقة محددة مسبقًا ومع وسيلة سهلة لسحب الموافقة.'),
      ]),
      section('controls', text('3. User controls', '3. ضوابط المستخدم'), [
        text('Users can change language and theme in the interface and can clear browser storage through browser settings. Blocking essential cookies may prevent login, OAuth completion or security functions.', 'يمكن للمستخدم تغيير اللغة والمظهر في الواجهة ومسح تخزين المتصفح من إعداداته. وقد يؤدي حجب الملفات الضرورية إلى منع الدخول أو إكمال OAuth أو وظائف الأمان.'),
      ]),
    ],
  },
  {
    id: 'ai-third-party-terms', slug: 'ai-third-parties', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('AI and Third-Party Services Terms', 'شروط الذكاء الاصطناعي وخدمات الأطراف الثالثة'),
    summary: text('Limitations and responsibilities for AI research, assistants, OAuth, email and external providers.', 'القيود والمسؤوليات المتعلقة بالبحث والمساعدات الذكية وOAuth والبريد والمزودين الخارجيين.'),
    purpose: text('To promote informed, human-reviewed use of provider-dependent features.', 'تعزيز الاستخدام الواعي والخاضع لمراجعة بشرية للميزات المعتمدة على مزودين.'),
    scope: text('AI assistant/research, hosted assistant proxy, Google, Microsoft, SMTP and configured external services.', 'المساعد والبحث الذكي ووكيل المساعد المستضاف وGoogle وMicrosoft وSMTP والخدمات الخارجية المضبوطة.'),
    related: ['privacy', 'data-processing', 'acceptable-use', 'intellectual-property'],
    sections: [
      section('features', text('1. Implemented service categories', '1. فئات الخدمات المنفذة'), [
        text('The audited code contains an AI assistant, Groq-backed customer research with web-search verification logic, a configurable hosted chatbot proxy, Google/Microsoft OAuth connection scaffolding and SMTP configuration.', 'يتضمن الكود المدقق مساعدًا ذكيًا وبحثًا ذكيًا عن العملاء مدعومًا من Groq مع منطق للتحقق عبر بحث الويب ووكيل دردشة مستضاف قابلًا للضبط وربط OAuth من Google/Microsoft وإعداد SMTP.'),
        text('Availability depends on configuration and provider status. A feature present in source may not be enabled in production.', 'يعتمد التوفر على الإعداد وحالة المزود، وقد لا تكون الميزة الموجودة في المصدر مفعلة في الإنتاج.'),
      ]),
      section('inputs', text('2. Inputs, sharing and permissions', '2. المدخلات والمشاركة والصلاحيات'), [
        text('Users must not submit data they are not authorized to share. Depending on the feature, prompts, selected records, search terms, email metadata or OAuth scopes may be transmitted to the relevant provider.', 'يحظر تقديم بيانات غير مخول للمستخدم مشاركتها. وبحسب الميزة، قد ترسل المطالبات أو السجلات المختارة أو عبارات البحث أو بيانات البريد أو نطاقات OAuth إلى المزود المعني.'),
        text('Production provider contracts, data-use settings, retention and hosting locations have not been verified. No promise is made that providers never retain or use submitted data until those terms and configurations are confirmed.', 'لم يتم التحقق من عقود مزودي الإنتاج وإعدادات استخدام البيانات والاحتفاظ ومواقع الاستضافة. ولا يوجد وعد بأن المزودين لا يحتفظون بالبيانات المقدمة أو يستخدمونها إلى أن يتم تأكيد الشروط والإعدادات.'),
      ]),
      section('outputs', text('3. Output limitations and human review', '3. قيود المخرجات والمراجعة البشرية'), [
        text('AI and research outputs may be incomplete, outdated, biased or incorrect even when sources are sought. Users must verify material facts, rights, contact details and proposed actions before using outputs.', 'قد تكون مخرجات الذكاء الاصطناعي والبحث ناقصة أو قديمة أو متحيزة أو خاطئة حتى عند البحث عن مصادر. ويجب التحقق من الحقائق الجوهرية والحقوق وبيانات الاتصال والإجراءات المقترحة قبل الاستخدام.'),
        text('Outputs must not be treated as legal, medical, financial or other professional advice, or as the sole basis for employment, education, credit, eligibility or similarly significant decisions.', 'لا يجوز اعتبار المخرجات استشارة قانونية أو طبية أو مالية أو مهنية أخرى، ولا جعلها الأساس الوحيد لقرارات التوظيف أو التعليم أو الائتمان أو الأهلية أو القرارات المهمة المشابهة.'),
      ]),
    ],
  },
  {
    id: 'intellectual-property', slug: 'intellectual-property', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Intellectual Property Policy', 'سياسة الملكية الفكرية'),
    summary: text('Ownership boundaries for the platform, customer content, feedback and third-party material.', 'حدود الملكية للمنصة ومحتوى العميل والملاحظات ومواد الأطراف الثالثة.'),
    purpose: text('To preserve customer ownership while protecting platform and third-party rights.', 'الحفاظ على ملكية العميل مع حماية حقوق المنصة والغير.'),
    scope: text('Software, branding, documentation, CRM content, uploads, outputs and feedback.', 'البرمجيات والعلامات والتوثيق ومحتوى CRM والملفات والمخرجات والملاحظات.'),
    related: ['terms', 'acceptable-use', 'ai-third-parties'],
    sections: [
      section('platform', text('1. Platform materials', '1. مواد المنصة'), [
        text('Subject to verified ownership and third-party licenses, CodeLine retains rights in its software, interfaces, documentation, branding and service improvements. A subscription grants a limited right to use the service, not ownership of the platform.', 'مع مراعاة الملكية المتحققة وتراخيص الغير، تحتفظ CodeLine بحقوق برمجياتها وواجهاتها ووثائقها وعلاماتها وتحسينات الخدمة. ويمنح الاشتراك حقًا محدودًا في استخدام الخدمة لا ملكية المنصة.'),
      ]),
      section('customer', text('2. Customer content', '2. محتوى العميل'), [
        text('Customers retain their rights in content they provide. They are responsible for obtaining permissions needed to store, process, reproduce, export and communicate it through the service.', 'يحتفظ العملاء بحقوقهم في المحتوى الذي يقدمونه، ويتحملون مسؤولية الحصول على الأذونات اللازمة لتخزينه ومعالجته واستنساخه وتصديره وإرساله عبر الخدمة.'),
      ]),
      section('outputs', text('3. AI and third-party material', '3. مخرجات الذكاء الاصطناعي ومواد الغير'), [
        text('AI output may resemble existing material and may not qualify for exclusive protection. Search results, external content, open-source software and provider materials remain subject to their own rights and licenses.', 'قد تشبه مخرجات الذكاء الاصطناعي مواد قائمة وقد لا تستحق حماية حصرية. وتظل نتائج البحث والمحتوى الخارجي والبرمجيات مفتوحة المصدر ومواد المزودين خاضعة لحقوقها وتراخيصها.'),
      ]),
      section('notices', text('4. Rights notices', '4. بلاغات الحقوق'), [
        text('A rights holder should identify the protected work, the disputed material and location, contact details, authority and a good-faith explanation. A formal notice-and-counter-notice process and designated legal contact require counsel approval.', 'على صاحب الحق تحديد العمل المحمي والمادة محل النزاع وموقعها وبيانات الاتصال والصفة وشرح حسن النية. وتحتاج عملية رسمية للإخطار والرد وتعيين جهة قانونية إلى اعتماد المستشار القانوني.'),
      ]),
    ],
  },
  {
    id: 'availability-maintenance-support', slug: 'availability-support', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Service Availability, Maintenance and Support Policy', 'سياسة إتاحة الخدمة والصيانة والدعم'),
    summary: text('A transparent service framework without an unverified uptime or response-time promise.', 'إطار شفاف للخدمة دون وعد غير متحقق به للإتاحة أو زمن الاستجابة.'),
    purpose: text('To explain dependencies, maintenance and support boundaries.', 'شرح الاعتماديات وحدود الصيانة والدعم.'),
    scope: text('Hosted application access, planned work, incidents and customer support.', 'الوصول إلى التطبيق المستضاف والأعمال المخططة والحوادث ودعم العملاء.'),
    related: ['terms', 'subscription-billing', 'security', 'legal-notices'],
    sections: [
      section('availability', text('1. Availability', '1. الإتاحة'), [
        text('The service depends on hosting, database, storage, network, email, OAuth and AI providers. No verified uptime percentage, service credit or guaranteed recovery time currently applies.', 'تعتمد الخدمة على مزودي الاستضافة وقاعدة البيانات والتخزين والشبكة والبريد وOAuth والذكاء الاصطناعي. ولا توجد حاليًا نسبة إتاحة أو رصيد خدمة أو زمن استعادة مضمون تم التحقق منه.'),
      ]),
      section('maintenance', text('2. Maintenance and changes', '2. الصيانة والتغييرات'), [
        text('CodeLine may perform planned or emergency maintenance and should provide reasonable notice for material planned interruption when practical. A formal maintenance window and notice period remain to be approved.', 'يجوز لـ CodeLine إجراء صيانة مخططة أو طارئة، وينبغي تقديم إشعار معقول عند الانقطاع المخطط الجوهري متى كان ذلك عمليًا. ولا تزال نافذة الصيانة الرسمية وفترة الإشعار بحاجة إلى اعتماد.'),
      ]),
      section('support', text('3. Support', '3. الدعم'), [
        text('The application can create support requests and the public site lists info@codeline.jo. Confirmed support hours, severity definitions, response targets, escalation routes and plan-specific support entitlements are not yet documented.', 'يمكن للتطبيق إنشاء طلبات دعم ويعرض الموقع العام info@codeline.jo. ولم توثق بعد ساعات الدعم المعتمدة وتعريفات الشدة وأهداف الاستجابة ومسارات التصعيد واستحقاقات الدعم لكل خطة.'),
      ]),
      section('customer-readiness', text('4. Customer readiness', '4. جاهزية العميل'), [
        text('Customers should maintain appropriate internal access records, export important information when available, keep authorized contacts current and report incidents with sufficient non-sensitive detail.', 'ينبغي للعملاء الاحتفاظ بسجلات وصول داخلية مناسبة وتصدير المعلومات المهمة عند توفر ذلك وتحديث جهات الاتصال المخولة والإبلاغ عن الحوادث بتفاصيل كافية غير حساسة.'),
      ]),
    ],
  },
  {
    id: 'complaints-disputes-notices', slug: 'legal-notices', version: 'draft-0.1', lastUpdated: reviewed, effectiveDate: draftDate,
    title: text('Complaints, Dispute Resolution and Legal Notices', 'الشكاوى وتسوية النزاعات والإشعارات القانونية'),
    summary: text('A proposed escalation path while legal entity and jurisdiction details await confirmation.', 'مسار تصعيد مقترح إلى حين تأكيد تفاصيل الكيان القانوني والاختصاص.'),
    purpose: text('To make complaints traceable and preserve mandatory legal protections.', 'جعل الشكاوى قابلة للتتبع والحفاظ على الحماية القانونية الآمرة.'),
    scope: text('Service, privacy, security, billing, content and contractual complaints.', 'الشكاوى المتعلقة بالخدمة والخصوصية والأمن والفوترة والمحتوى والعقود.'),
    related: ['terms', 'privacy', 'cancellation-refunds', 'availability-support'],
    sections: [
      section('contact', text('1. Submitting a complaint', '1. تقديم الشكوى'), [
        text('Until a dedicated channel is approved, complaints may be sent to the currently published general address, info@codeline.jo. Include the organization, account email, issue category, relevant dates and requested outcome; do not send passwords or secret tokens.', 'إلى أن تعتمد قناة مخصصة، يمكن إرسال الشكاوى إلى العنوان العام المنشور حاليًا info@codeline.jo. يرجى تضمين المؤسسة وبريد الحساب وفئة المشكلة والتواريخ والنتيجة المطلوبة، وعدم إرسال كلمات المرور أو الرموز السرية.'),
      ]),
      section('process', text('2. Review and escalation', '2. المراجعة والتصعيد'), [
        text('CodeLine should acknowledge, classify, investigate and provide a reasoned response, escalating privacy, security and payment matters to authorized personnel. Response times and escalation owners remain to be approved.', 'ينبغي لـ CodeLine تأكيد الاستلام وتصنيف الشكوى والتحقيق وتقديم رد مسبب مع تصعيد مسائل الخصوصية والأمن والدفع إلى المخولين. ولا تزال أزمنة الرد ومسؤولو التصعيد بحاجة إلى اعتماد.'),
      ]),
      section('rights', text('3. External rights', '3. الحقوق الخارجية'), [
        text('Nothing in this draft removes a person’s right to approach a competent regulator, consumer-protection authority or court where available. The appropriate authority depends on the issue and applicable law.', 'لا تلغي هذه المسودة حق أي شخص في اللجوء إلى جهة رقابية مختصة أو جهة حماية المستهلك أو المحكمة حيث يتاح ذلك. وتعتمد الجهة المناسبة على موضوع الشكوى والقانون المطبق.'),
      ]),
      section('legal', text('4. Governing law, jurisdiction and notices', '4. القانون والاختصاص والإشعارات'), [
        text('Jordanian law is the priority legal framework for review, but no final governing-law, court, arbitration, venue or service-of-notice clause is adopted here. Those clauses require the verified legal entity and review by Jordan-qualified counsel.', 'يمثل القانون الأردني الإطار القانوني ذي الأولوية للمراجعة، لكن لم يعتمد هنا شرط نهائي للقانون الواجب التطبيق أو المحكمة أو التحكيم أو المكان أو تبليغ الإشعارات. وتتطلب تلك الشروط تحديد الكيان القانوني ومراجعة محامٍ مؤهل في الأردن.'),
      ]),
    ],
  },
];

export const policyBySlug = new Map(LEGAL_POLICIES.map(policy => [policy.slug, policy]));

