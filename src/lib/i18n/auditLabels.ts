import type { Language } from "./translations";

const ACTIONS_AR: Record<string, string> = {
  CLIENT_CREATED: "تم إنشاء عميل",
  CLIENT_UPDATED: "تم تحديث عميل",
  CLIENT_DELETED: "تم حذف عميل",
  LEAD_CREATED: "تم إنشاء عميل محتمل",
  LEAD_UPDATED: "تم تحديث عميل محتمل",
  LEAD_CONVERTED: "تم تحويل عميل محتمل",
  CONTACT_CREATED: "تم إنشاء جهة اتصال",
  CONTACT_UPDATED: "تم تحديث جهة اتصال",
  DEAL_CREATED: "تم إنشاء صفقة",
  DEAL_UPDATED: "تم تحديث صفقة",
  TASK_CREATED: "تم إنشاء مهمة",
  TASK_UPDATED: "تم تحديث مهمة",
  TICKET_CREATED: "تم إنشاء تذكرة",
  TICKET_UPDATED: "تم تحديث تذكرة",
  USER_CREATED: "تم إنشاء مستخدم",
  USER_UPDATED: "تم تحديث مستخدم",
  USER_DISABLED: "تم تعطيل مستخدم",
  USER_ENABLED: "تم تفعيل مستخدم",
  RECORD_CREATED: "تم إنشاء سجل",
  RECORD_UPDATED: "تم تحديث سجل",
  LOGIN_SUCCESS: "تم تسجيل الدخول",
  LOGIN_FAILED: "فشلت محاولة تسجيل الدخول",
};

const ENTITIES_AR: Record<string, string> = {
  CLIENT: "عميل",
  LEAD: "عميل محتمل",
  CONTACT: "جهة اتصال",
  DEAL: "صفقة",
  TASK: "مهمة",
  TICKET: "تذكرة",
  USER: "مستخدم",
  ORGANIZATION: "شركة",
  WORKFLOW: "سير عمل",
  PROPOSAL: "عرض سعر",
};

export function getAuditActionLabel(
  action: string,
  language: Language,
): string {
  if (language === "ar") return ACTIONS_AR[action] ?? "تم تسجيل نشاط في النظام";
  return action.replaceAll("_", " ").toLowerCase();
}

export function getEntityTypeLabel(entity: string, language: Language): string {
  if (language === "ar") return ENTITIES_AR[entity] ?? "سجل";
  return entity.replaceAll("_", " ").toLowerCase();
}
