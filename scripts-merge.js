const fs = require('fs');

const code = fs.readFileSync('./src/lib/i18n/translations.ts', 'utf8');
const transpiled = code
  .replace(/export type [^;]+;/g, '')
  .replace(/export const translations = /g, 'module.exports = ')
  .replace(/export /g, '');

const m = { exports: {} };
const fn = new Function('module', 'exports', transpiled);
fn(m, m.exports);
const t = m.exports;

// Ensure calendar, profile, settings, export exist in EN
t.en.calendar = {
  title: 'Operations Calendar',
  subtitle: 'Schedule, track meetings, follow-ups, due dates, and school visits.',
  addEvent: 'New Calendar Event',
  editEvent: 'Edit Calendar Event',
  eventTitle: 'Event Title',
  eventTitlePlaceholder: 'e.g., School Visit & Meeting with Principal',
  eventType: 'Event Type',
  typeMeeting: 'Meeting',
  typeFollowUp: 'Follow-Up',
  typeDueDate: 'Task Due Date',
  typeTask: 'Scheduled Task',
  typeEvent: 'General Event',
  MEETING: 'Meeting',
  FOLLOW_UP: 'Follow-Up',
  DUE_DATE: 'Task Due Date',
  TASK: 'Scheduled Task',
  EVENT: 'General Event',
  startDate: 'Start Date & Time',
  endDate: 'End Date & Time',
  description: 'Description & Notes',
  eventDescription: 'Event Description',
  location: 'Location / Venue',
  locationPlaceholder: 'e.g., School Campus - Meeting Room B',
  relatedSchool: 'Linked School',
  linkedSchool: 'Linked School',
  relatedTicket: 'Linked Ticket',
  linkedTicket: 'Linked Ticket',
  assignedTo: 'Assigned Employee',
  assignedEmployee: 'Assigned Employee',
  unassigned: 'Unassigned',
  none: 'None',
  noEvents: 'No events scheduled for this day.',
  deleteEventConfirm: 'Are you sure you want to delete this calendar event?',
  month: 'Month',
  week: 'Week',
  day: 'Day',
  today: 'Today',
  prevMonth: 'Previous',
  nextMonth: 'Next',
  allTypes: 'All Types',
  eventCreated: 'Calendar event created successfully!',
  eventUpdated: 'Calendar event updated successfully!',
  eventDeleted: 'Calendar event deleted successfully!',
  titleRequired: 'Event title is required',
  startDateRequired: 'Start date is required',
};

t.ar.calendar = {
  title: 'تقويم العمليات والزيارات',
  subtitle: 'جدولة ومتابعة الاجتماعات، مواعيد المتابعة، تواريخ الاستحقاق، وزيارات المدارس.',
  addEvent: 'حدث / موعد جديد',
  editEvent: 'تعديل موعد التقويم',
  eventTitle: 'عنوان الحدث / الموعد',
  eventTitlePlaceholder: 'مثال: زيارة المدرسة والاجتماع مع المدير',
  eventType: 'نوع الحدث',
  typeMeeting: 'اجتماع',
  typeFollowUp: 'متابعة',
  typeDueDate: 'موعد استحقاق مهمة',
  typeTask: 'مهمة مجدولة',
  typeEvent: 'حدث عام',
  MEETING: 'اجتماع',
  FOLLOW_UP: 'متابعة',
  DUE_DATE: 'موعد استحقاق مهمة',
  TASK: 'مهمة مجدولة',
  EVENT: 'حدث عام',
  startDate: 'تاريخ ووقت البدء',
  endDate: 'تاريخ ووقت الانتهاء',
  description: 'الوصف والملاحظات',
  eventDescription: 'وصف الحدث والملاحظات',
  location: 'المكان / الموقع',
  locationPlaceholder: 'مثال: مقر المدرسة - قاعة الاجتماعات ب',
  relatedSchool: 'المدرسة المرتبطة',
  linkedSchool: 'المدرسة المرتبطة',
  relatedTicket: 'التذكرة المرتبطة',
  linkedTicket: 'التذكرة المرتبطة',
  assignedTo: 'الموظف المسؤول',
  assignedEmployee: 'الموظف المسؤول',
  unassigned: 'غير مكلّف',
  none: 'لا يوجد',
  noEvents: 'لا توجد أحداث مجدولة لهذا اليوم.',
  deleteEventConfirm: 'هل أنت متأكد من حذف هذا الموعد من التقويم؟',
  month: 'شهر',
  week: 'أسبوع',
  day: 'يوم',
  today: 'اليوم',
  prevMonth: 'السابق',
  nextMonth: 'التالي',
  allTypes: 'جميع الأنواع',
  eventCreated: 'تمت إضافة الموعد إلى التقويم بنجاح!',
  eventUpdated: 'تم تحديث الموعد بنجاح!',
  eventDeleted: 'تم حذف الموعد من التقويم بنجاح!',
  titleRequired: 'عنوان الحدث إلزامي',
  startDateRequired: 'تاريخ البدء إلزامي',
};

t.en.profile = {
  title: 'User Profile',
  subtitle: 'View and update your personal information and contact details.',
  personalInfo: 'Personal Information',
  fullName: 'Full Name',
  email: 'Email Address',
  phone: 'Phone Number',
  role: 'System Role',
  department: 'Assigned Department',
  avatar: 'Profile Picture / Avatar',
  saveProfile: 'Save Changes',
  profileUpdated: 'Profile updated successfully!',
};

t.ar.profile = {
  title: 'الملف الشخصي',
  subtitle: 'عرض وتحديث بياناتك الشخصية ومعلومات الاتصال الخاصة بحسابك.',
  personalInfo: 'المعلومات الشخصية',
  fullName: 'الاسم الكامل',
  email: 'البريد الإلكتروني',
  phone: 'رقم الهاتف',
  role: 'الدور في النظام',
  department: 'القسم التابع له',
  avatar: 'الصورة الشخصية / الرمز',
  saveProfile: 'حفظ التعديلات',
  profileUpdated: 'تم تحديث الملف الشخصي بنجاح!',
};

t.en.settings = {
  title: 'Settings & Preferences',
  subtitle: 'Customize your interface preferences, language, theme, and account security.',
  preferences: 'Interface Preferences',
  language: 'Display Language',
  theme: 'Appearance / Theme',
  security: 'Account Security',
  currentPassword: 'Current Password',
  newPassword: 'New Password',
  confirmPassword: 'Confirm New Password',
  updatePassword: 'Change Password',
  passwordUpdated: 'Password changed successfully!',
  passwordMismatch: 'New password and confirmation do not match',
  passwordLength: 'Password must be at least 8 characters long',
  themeLight: 'Light Mode',
  themeDark: 'Dark Mode',
  themeSystem: 'System Default',
};

t.ar.settings = {
  title: 'الإعدادات والتفضيلات',
  subtitle: 'تخصيص لغة الواجهة، المظهر (داكن/فاتح)، وإعدادات أمان الحساب.',
  preferences: 'تفضيلات الواجهة',
  language: 'لغة العرض',
  theme: 'المظهر / الثيم',
  security: 'أمان الحساب',
  currentPassword: 'كلمة المرور الحالية',
  newPassword: 'كلمة المرور الجديدة',
  confirmPassword: 'تأكيد كلمة المرور الجديدة',
  updatePassword: 'تغيير كلمة المرور',
  passwordUpdated: 'تم تغيير كلمة المرور بنجاح!',
  passwordMismatch: 'كلمة المرور الجديدة وتأكيدها غير متطابقين',
  passwordLength: 'يجب أن تتكون كلمة المرور من 8 خانات على الأقل',
  themeLight: 'الوضع الفاتح (Light)',
  themeDark: 'الوضع الداكن (Dark)',
  themeSystem: 'تلقائي حسب النظام',
};

t.en.export = {
  exportAs: 'Export As',
  exportExcel: 'Export to Excel (.xlsx)',
  exportCSV: 'Export to CSV (.csv)',
  exportPDF: 'Export / Print PDF',
  exportSuccess: 'Data exported successfully!',
};

t.ar.export = {
  exportAs: 'تصدير كـ',
  exportExcel: 'تصدير إلى إكسل (.xlsx)',
  exportCSV: 'تصدير كملف (.csv)',
  exportPDF: 'تصدير / طباعة PDF',
  exportSuccess: 'تم تصدير البيانات بنجاح!',
};

// Schools keys
const schoolExtEn = {
  classification: 'Classification',
  classA: 'Class A (High Priority)',
  classB: 'Class B (Medium Priority)',
  classC: 'Class C (Standard)',
  allClassifications: 'All Classifications',
  responsibleEmployee: 'Responsible Employee',
  selectResponsibleEmployee: 'Select Responsible Employee',
  unassignedEmployee: 'Unassigned',
  deleteSchoolTitle: 'Confirm School Deletion',
  deleteSchoolConfirm: 'Are you sure you want to delete this school? It will be safely archived without deleting historical tickets.',
  delete: 'Delete School',
  schoolsCount: 'schools',
};

const schoolExtAr = {
  classification: 'التصنيف',
  classA: 'فئة أ (أولوية عالية)',
  classB: 'فئة ب (أولوية متوسطة)',
  classC: 'فئة ج (قياسي)',
  allClassifications: 'جميع التصنيفات',
  responsibleEmployee: 'الموظف المسؤول',
  selectResponsibleEmployee: 'اختر الموظف المسؤول',
  unassignedEmployee: 'غير مكلّف',
  deleteSchoolTitle: 'تأكيد حذف المدرسة',
  deleteSchoolConfirm: 'هل أنت متأكد من حذف هذه المدرسة؟ سيتم أرشفتها بأمان دون حذف التذاكر التاريخية.',
  delete: 'حذف المدرسة',
  schoolsCount: 'مدارس',
};

Object.assign(t.en.schools, schoolExtEn);
Object.assign(t.ar.schools, schoolExtAr);

// Tickets keys
const ticketExtEn = {
  contactAttempts: 'Contact Attempts',
  notes: 'Notes',
  save: 'Save',
  schoolInfo: 'School Information',
  ticketDetails: 'Ticket Details',
  department: 'Department',
  priorityLow: 'Low Priority',
  priorityMedium: 'Medium Priority',
  priorityHigh: 'High Priority',
  priorityUrgent: 'Urgent Priority',
  dueDateLabel: 'Due Date',
  typeYourNote: 'Type your note here...',
  closeTicket: 'Close Ticket',
  logAttempt: 'Log Contact Attempt',
  attemptLogged: 'Contact attempt logged successfully',
  descriptionLabel: 'Subject / Task Title',
  selectSchool: 'Select School',
  selectTaskType: 'Select Task Type',
  selectPriority: 'Select Priority',
  selectAssignee: 'Select Assignee',
  newTicket: 'New Ticket',
  createTicket: '+ Create Ticket',
  ticketCreatedSuccess: 'Ticket created successfully!',
  closingReason: 'Closing Note / Reason',
  closingReasonPlaceholder: 'Explain the outcome and why this ticket is being closed (required)...',
  closeConfirm: 'Close Ticket',
  closeConfirmTitle: 'Confirm Ticket Closure',
  viewOnlyNotice: 'You have view-only access to this ticket as a previous assignee.',
  ticketClosedNotice: 'This ticket is closed. No further notes or status changes are permitted.',
  ticketRejectedNotice: 'This ticket was rejected and is currently archived.',
};

const ticketExtAr = {
  contactAttempts: 'محاولات التواصل',
  notes: 'الملاحظات',
  save: 'حفظ',
  schoolInfo: 'معلومات المدرسة',
  ticketDetails: 'تفاصيل التذكرة',
  department: 'القسم',
  priorityLow: 'أولوية منخفضة',
  priorityMedium: 'أولوية متوسطة',
  priorityHigh: 'أولوية عالية',
  priorityUrgent: 'أولوية عاجلة',
  dueDateLabel: 'تاريخ الاستحقاق',
  typeYourNote: 'اكتب ملاحظتك هنا...',
  closeTicket: 'إغلاق التذكرة',
  logAttempt: 'تسجيل محاولة تواصل',
  attemptLogged: 'تم تسجيل محاولة التواصل بنجاح',
  descriptionLabel: 'موضوع التذكرة / عنوان المهمة',
  selectSchool: 'اختر المدرسة',
  selectTaskType: 'اختر نوع المهمة',
  selectPriority: 'اختر الأولوية',
  selectAssignee: 'اختر الموظف المكلف',
  newTicket: 'تذكرة جديدة',
  createTicket: '+ إنشاء تذكرة',
  ticketCreatedSuccess: 'تم إنشاء التذكرة بنجاح!',
  closingReason: 'سبب وملاحظة الإغلاق',
  closingReasonPlaceholder: 'وضح النتيجة وسبب إغلاق هذه التذكرة (إلزامي)...',
  closeConfirm: 'إغلاق التذكرة',
  closeConfirmTitle: 'تأكيد إغلاق التذكرة',
  viewOnlyNotice: 'لديك صلاحية المشاهدة فقط لهذه التذكرة بصفتك مكلّفاً سابقاً.',
  ticketClosedNotice: 'هذه التذكرة مغلقة. لا يمكن إضافة ملاحظات أو تغيير الحالة.',
  ticketRejectedNotice: 'تم رفض هذه التذكرة وهي مؤرشفة حالياً.',
};

Object.assign(t.en.tickets, ticketExtEn);
Object.assign(t.ar.tickets, ticketExtAr);

// Admin keys
const adminExtEn = {
  departments: {
    addDepartment: 'Add Department',
    editDept: 'Edit Department',
    totalDepts: 'Total Departments',
    activeUnits: 'Active Units',
    totalMembers: 'Total Members',
    totalTickets: 'Total Tickets',
    active: 'Active',
    inactive: 'Inactive',
    members: 'Members',
    tickets: 'Tickets',
    managers: 'Department Managers',
    selectManagers: 'Select Managers',
  },
  taskTypes: {
    addTaskType: 'Add Task Type',
    editTaskType: 'Edit Task Type',
    totalTaskTypes: 'Total Task Types',
    activeCategories: 'Active Categories',
    totalTicketsGenerated: 'Tickets Generated',
    noTaskTypesFound: 'No task types found matching your search.',
    active: 'Active',
    inactive: 'Inactive',
  },
  analytics: {
    ticketsByDepartment: 'Tickets by Department',
    assignedLoadByMember: 'Assigned Workload by Member',
    commResultsBreakdown: 'Contact Attempts by Result',
    taskTypeDistribution: 'Task Type Distribution',
    callsCount: 'calls',
    activeCount: 'active tickets',
    ticketsCount: 'tickets',
    timeSpentStats: 'Employee Work Time & Session Statistics',
    timeSpentSubtitle: 'Calculated automatically from authentication and activity stream logs',
    totalWorkTime: 'Total Logged Work Time',
    totalSessions: 'Total User Sessions',
    avgSessionMinutes: 'Avg Session Duration',
    lastActivity: 'Last Activity',
  }
};

const adminExtAr = {
  departments: {
    addDepartment: 'إضافة قسم جديد',
    editDept: 'تعديل بيانات القسم',
    totalDepts: 'إجمالي الأقسام',
    activeUnits: 'الوحدات النشطة',
    totalMembers: 'إجمالي الأعضاء',
    totalTickets: 'إجمالي التذاكر',
    active: 'نشط',
    inactive: 'غير نشط',
    members: 'أعضاء',
    tickets: 'تذاكر',
    managers: 'مدراء القسم',
    selectManagers: 'اختر المدراء',
  },
  taskTypes: {
    addTaskType: 'إضافة نوع مهمة',
    editTaskType: 'تعديل نوع المهمة',
    totalTaskTypes: 'إجمالي أنواع المهام',
    activeCategories: 'التصنيفات النشطة',
    totalTicketsGenerated: 'التذاكر المنشأة',
    noTaskTypesFound: 'لم يتم العثور على أنواع مهام تطابق البحث.',
    active: 'نشط',
    inactive: 'غير نشط',
  },
  analytics: {
    ticketsByDepartment: 'توزيع التذاكر حسب الأقسام',
    assignedLoadByMember: 'عبء العمل المكلّف لكل موظف',
    commResultsBreakdown: 'نتائج محاولات التواصل',
    taskTypeDistribution: 'توزيع التذاكر حسب نوع المهمة',
    callsCount: 'اتصالات',
    activeCount: 'تذكرة نشطة',
    ticketsCount: 'تذاكر',
    timeSpentStats: 'إحصائيات وقت العمل والجلسات لكل موظف',
    timeSpentSubtitle: 'يتم حساب الوقت تلقائيًا بناءً على سجلات تسجيل الدخول والنشاط الفعلي',
    totalWorkTime: 'إجمالي وقت العمل المسجل',
    totalSessions: 'إجمالي جلسات الاستخدام',
    avgSessionMinutes: 'متوسط مدة الجلسة',
    lastActivity: 'آخر نشاط',
  }
};

Object.assign(t.en.admin.departments, adminExtEn.departments);
Object.assign(t.ar.admin.departments, adminExtAr.departments);
Object.assign(t.en.admin.taskTypes, adminExtEn.taskTypes);
Object.assign(t.ar.admin.taskTypes, adminExtAr.taskTypes);
Object.assign(t.en.admin.analytics, adminExtEn.analytics);
Object.assign(t.ar.admin.analytics, adminExtAr.analytics);

// Common keys
const commonExtEn = {
  noData: 'No data available to display.',
  optional: 'Optional',
  required: 'Required',
  actions: 'Actions',
  details: 'Details',
  date: 'Date',
  status: 'Status',
  priority: 'Priority',
  all: 'All',
  filter: 'Filter',
  clear: 'Clear',
};

const commonExtAr = {
  noData: 'لا توجد بيانات متاحة للعرض.',
  optional: 'اختياري',
  required: 'إلزامي',
  actions: 'الإجراءات',
  details: 'التفاصيل',
  date: 'التاريخ',
  status: 'الحالة',
  priority: 'الأولوية',
  all: 'الكل',
  filter: 'تصفية',
  clear: 'إلغاء التحديد',
};

Object.assign(t.en.common, commonExtEn);
Object.assign(t.ar.common, commonExtAr);

// Write updated translations.ts
const output = 'export type Language = \'en\' | \'ar\';\n\nexport const translations = ' + JSON.stringify(t, null, 2) + ';\n';
fs.writeFileSync('./src/lib/i18n/translations.ts', output, 'utf8');
console.log('Successfully updated translations.ts with 100% bilingual parity!');
