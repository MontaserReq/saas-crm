// Static how-to knowledge base for the AI Knowledge Assistant.
//
// Every entry below was written by reading the actual component that
// implements the flow (file path noted per entry) — never guessed. If the
// UI changes, update the entry alongside the component change; do not let
// this drift into inventing buttons/pages that don't exist.
export interface HelpTopic {
  key: string;
  /** Permission required to see this feature at all; omit if available to everyone. */
  permission?: string;
  keywords: string[];
  en: { title: string; steps: string[] };
  ar: { title: string; steps: string[] };
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    key: 'createTicket',
    permission: 'tickets.create',
    keywords: ['create ticket', 'new ticket', 'add ticket', 'عمل تذكرة', 'انشاء تذكرة', 'اضافة تذكرة'],
    en: {
      title: 'Create a Ticket',
      steps: [
        "Open the Tickets section from the sidebar.",
        'Click the "+ Create Ticket" button.',
        'Enter the Subject (required), and optionally the School and Task Type.',
        'Choose the Priority and an optional Due Date.',
        'Optionally add an Initial Note.',
        'Click "Create & Assign Ticket" — it is automatically assigned to your direct manager, you cannot pick a different assignee.',
      ],
    },
    ar: {
      title: 'إنشاء تذكرة',
      steps: [
        'افتح قسم "Tickets" من القائمة الجانبية.',
        'اضغط زر "+ Create Ticket".',
        'أدخل الموضوع (إلزامي)، ويمكنك اختيار المدرسة ونوع المهمة اختياريًا.',
        'حدد الأولوية وتاريخ الاستحقاق إن أردت.',
        'يمكنك إضافة ملاحظة أولية.',
        'اضغط "Create & Assign Ticket" — يتم تعيينها تلقائيًا لمديرك المباشر، لا يمكنك اختيار موظف آخر.',
      ],
    },
  },
  {
    key: 'addMeeting',
    permission: 'tickets.create',
    keywords: ['add meeting', 'create meeting', 'meeting minutes', 'اضافة اجتماع', 'عمل اجتماع', 'محضر اجتماع'],
    en: {
      title: 'Add a Meeting',
      steps: [
        'Open the Tickets section from the sidebar.',
        'Click the "New Meeting" button (next to "Create Ticket").',
        'Enter the meeting title, date, and time (all required).',
        'Add participants — pick an existing teammate from the list, or type an external name and click Add.',
        'Optionally add action items and assign each one to a teammate.',
        'Optionally write meeting notes/minutes.',
        'Click "Create & Assign Meeting". You can attach files (PDF, Word, Excel, PowerPoint, images) afterwards from the meeting\'s ticket page.',
      ],
    },
    ar: {
      title: 'إضافة اجتماع',
      steps: [
        'افتح قسم "Tickets" من القائمة الجانبية.',
        'اضغط زر "New Meeting" (بجانب زر إنشاء التذكرة).',
        'أدخل عنوان الاجتماع، التاريخ، والوقت (إلزامية).',
        'أضف المشاركين — اختر زميلًا من القائمة أو اكتب اسم مشارك خارجي واضغط إضافة.',
        'يمكنك إضافة مهام عمل وتعيين كل مهمة لأحد الزملاء.',
        'يمكنك كتابة ملاحظات/محضر الاجتماع.',
        'اضغط "Create & Assign Meeting". يمكنك إرفاق الملفات (PDF، وورد، إكسل، بوربوينت، صور) لاحقًا من صفحة تذكرة الاجتماع.',
      ],
    },
  },
  {
    key: 'uploadAttachment',
    permission: 'attachments.upload',
    keywords: ['upload file', 'attach file', 'attachment', 'رفع ملف', 'ارفاق ملف', 'مرفق'],
    en: {
      title: 'Upload a File / Attachment',
      steps: [
        'Open the ticket (or meeting) you want to attach a file to.',
        'Scroll to the "Add Note" form at the bottom of the page.',
        'Click "Attach File" and pick one or more files (PDF, Word, Excel, PowerPoint, images, or text).',
        'Write the note text, then submit — the files are uploaded together with the note and appear inside it.',
        'Files are private: only people with access to that ticket can download them.',
      ],
    },
    ar: {
      title: 'رفع ملف / مرفق',
      steps: [
        'افتح التذكرة (أو الاجتماع) الذي تريد إرفاق ملف به.',
        'انزل إلى نموذج "Add Note" أسفل الصفحة.',
        'اضغط "Attach File" واختر ملفًا أو أكثر (PDF، وورد، إكسل، بوربوينت، صور، أو نص).',
        'اكتب نص الملاحظة ثم أرسل — يتم رفع الملفات مع الملاحظة وتظهر بداخلها.',
        'الملفات خاصة: فقط الأشخاص الذين لديهم صلاحية على هذه التذكرة يستطيعون تنزيلها.',
      ],
    },
  },
  {
    key: 'addNote',
    permission: 'tickets.add_note',
    keywords: ['add note', 'post note', 'اضافة ملاحظة', 'كتابة ملاحظة'],
    en: {
      title: 'Add a Note to a Ticket',
      steps: [
        'Open the ticket.',
        'Write your update in the "Add Note" box at the bottom of the page.',
        'Optionally toggle "Post Note & Transfer Ticket" to hand the ticket to someone else in another department at the same time.',
        'Click "Add Note". Notes are permanent once posted — they cannot be edited or deleted afterwards.',
      ],
    },
    ar: {
      title: 'إضافة ملاحظة على تذكرة',
      steps: [
        'افتح التذكرة.',
        'اكتب التحديث في مربع "Add Note" أسفل الصفحة.',
        'يمكنك تفعيل خيار "Post Note & Transfer Ticket" لتحويل التذكرة لشخص آخر في قسم مختلف بنفس الوقت.',
        'اضغط "Add Note". الملاحظات دائمة بعد إرسالها — لا يمكن تعديلها أو حذفها لاحقًا.',
      ],
    },
  },
  {
    key: 'addSchool',
    permission: 'schools.create',
    keywords: ['add school', 'new school', 'اضافة مدرسة', 'مدرسة جديدة'],
    en: {
      title: 'Add a School',
      steps: [
        'Open the Schools section from the sidebar.',
        'Click "Add School".',
        'Enter the School Name, Classification (A/B/C), and City (required).',
        'Optionally add Contact Person, Phone, WhatsApp, Email, Area, and a Responsible Employee.',
        'Click Save.',
      ],
    },
    ar: {
      title: 'إضافة مدرسة',
      steps: [
        'افتح قسم "Schools" من القائمة الجانبية.',
        'اضغط "Add School".',
        'أدخل اسم المدرسة، التصنيف (A/B/C)، والمدينة (إلزامية).',
        'يمكنك إضافة جهة الاتصال، الهاتف، واتساب، البريد الإلكتروني، المنطقة، والموظف المسؤول.',
        'اضغط حفظ.',
      ],
    },
  },
  {
    key: 'editSchoolResponsible',
    permission: 'schools.update',
    keywords: ['change responsible', 'school responsible', 'مسؤول المدرسة', 'تغيير المسؤول'],
    en: {
      title: 'Change a School\'s Responsible Employee',
      steps: [
        'Open the Schools section and find the school (use the search box if needed).',
        'Click the edit (pencil) icon on that school\'s row.',
        'Change the "Responsible Employee" dropdown.',
        'Click Save.',
      ],
    },
    ar: {
      title: 'تغيير الموظف المسؤول عن مدرسة',
      steps: [
        'افتح قسم "Schools" وابحث عن المدرسة (استخدم مربع البحث إن أردت).',
        'اضغط أيقونة التعديل (القلم) بجانب المدرسة.',
        'غيّر القائمة المنسدلة "Responsible Employee".',
        'اضغط حفظ.',
      ],
    },
  },
  {
    key: 'searchSchool',
    permission: 'schools.view',
    keywords: ['search school', 'find school', 'بحث عن مدرسة', 'ايجاد مدرسة'],
    en: {
      title: 'Search for a School',
      steps: [
        'Open the Schools section from the sidebar.',
        'Use the search box — it matches by school name, city, contact person, or phone number.',
        'You can also ask me directly, e.g. "find school X" or "which schools are in Amman?".',
      ],
    },
    ar: {
      title: 'البحث عن مدرسة',
      steps: [
        'افتح قسم "Schools" من القائمة الجانبية.',
        'استخدم مربع البحث — يبحث حسب اسم المدرسة، المدينة، جهة الاتصال، أو رقم الهاتف.',
        'يمكنك أيضًا سؤالي مباشرة، مثل "دورني على مدرسة X" أو "شو المدارس في عمان؟".',
      ],
    },
  },
  {
    key: 'viewOpenTickets',
    permission: 'tickets.view_assigned',
    keywords: ['open tickets', 'my tickets', 'تذاكر مفتوحة', 'تذاكري'],
    en: {
      title: 'View Open Tickets',
      steps: [
        'Open the Tickets section from the sidebar — it shows your assigned tickets by default.',
        'Use the Status filter (e.g. Pending, Accepted) and Priority filter to narrow the list.',
        'Use the search box to find a ticket by number, school, or subject.',
        'You can also just ask me, e.g. "what are my open tickets?".',
      ],
    },
    ar: {
      title: 'عرض التذاكر المفتوحة',
      steps: [
        'افتح قسم "Tickets" من القائمة الجانبية — يعرض تذاكرك المكلف بها افتراضيًا.',
        'استخدم فلتر الحالة (مثل Pending أو Accepted) وفلتر الأولوية لتضييق القائمة.',
        'استخدم مربع البحث لإيجاد تذكرة برقمها أو المدرسة أو الموضوع.',
        'يمكنك أيضًا سؤالي مباشرة، مثل "شو تذاكري المفتوحة؟".',
      ],
    },
  },
  {
    key: 'useCalendar',
    permission: 'calendar.view',
    keywords: ['calendar', 'كالندر', 'التقويم'],
    en: {
      title: 'Use the Calendar',
      steps: [
        'Open the Calendar section from the sidebar.',
        'Filter by event type: Meeting, Follow-up, Due Date, Task, or Event.',
        'Click "Add Event" to create a new calendar entry, or "Today" to jump to the current date.',
      ],
    },
    ar: {
      title: 'استخدام التقويم (Calendar)',
      steps: [
        'افتح قسم "Calendar" من القائمة الجانبية.',
        'صفِّ الأحداث حسب النوع: اجتماع، متابعة، تاريخ استحقاق، مهمة، أو حدث.',
        'اضغط "Add Event" لإضافة حدث جديد، أو "Today" للانتقال إلى التاريخ الحالي.',
      ],
    },
  },
  {
    key: 'findSchoolsNeedingFollowUp',
    permission: 'schools.view',
    keywords: ['needs follow-up', 'not contacted', 'follow up', 'متابعة', 'لم يتم التواصل'],
    en: {
      title: 'Find Schools That Need Follow-up',
      steps: [
        'There isn\'t a dedicated page for this yet — ask me directly, e.g. "which schools need follow-up?", and I\'ll check ticket follow-up dates for you.',
      ],
    },
    ar: {
      title: 'إيجاد المدارس التي تحتاج متابعة',
      steps: [
        'لا توجد صفحة مخصصة لهذا حاليًا — اسألني مباشرة، مثل "شو المدارس اللي بدها متابعة؟"، وسأتحقق من تواريخ المتابعة في التذاكر نيابة عنك.',
      ],
    },
  },
  {
    key: 'liveChat',
    permission: 'chat.view',
    keywords: ['live chat', 'message teammate', 'محادثة', 'دردشة'],
    en: {
      title: 'Message a Teammate (Live Chat)',
      steps: [
        'Click the chat bubble icon fixed at the bottom corner of the screen (available on every page).',
        'Search for or select a teammate from the list.',
        'Type your message and send.',
      ],
    },
    ar: {
      title: 'مراسلة زميل (المحادثة المباشرة)',
      steps: [
        'اضغط أيقونة المحادثة الثابتة في زاوية الشاشة (متاحة في كل صفحة).',
        'ابحث عن زميل أو اخترْه من القائمة.',
        'اكتب رسالتك وأرسلها.',
      ],
    },
  },
];

export function findHelpTopic(key: string): HelpTopic | null {
  return HELP_TOPICS.find((topic) => topic.key === key) || null;
}

export const HELP_TOPIC_KEYS = HELP_TOPICS.map((t) => t.key);
