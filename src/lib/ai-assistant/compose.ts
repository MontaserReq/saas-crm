import { formatDate } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { callGeminiChat } from './llmClient';
import type { ToolResult } from '@/server/services/AiAssistantToolService';
import type { ToolName } from './tools';

type Lang = 'ar' | 'en';

export interface ComposeInput {
  tool: ToolName;
  result: ToolResult | null;
  language: Lang;
  originalMessage: string;
  unclearReason?: string;
}

export interface ComposeOutput {
  reply: string;
  /** Small text fed back as classification context for follow-up questions ("who's responsible for the second one?"). */
  resultSummary: string | null;
}

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  PENDING: { en: 'Pending', ar: 'قيد الانتظار' },
  SEEN: { en: 'Seen', ar: 'تمت المشاهدة' },
  ACCEPTED: { en: 'Accepted', ar: 'مقبولة' },
  REJECTED: { en: 'Rejected', ar: 'مرفوضة' },
  IN_PROGRESS: { en: 'In Progress', ar: 'قيد التنفيذ' },
  TRANSFERRED: { en: 'Transferred', ar: 'محوّلة' },
  UNREACHABLE: { en: 'Unreachable', ar: 'تعذر التواصل' },
  COMPLETED: { en: 'Completed', ar: 'مكتملة' },
  CLOSED: { en: 'Closed', ar: 'مغلقة' },
};
const statusLabel = (code: string | null | undefined, lang: Lang) => (code && STATUS_LABELS[code] ? STATUS_LABELS[code][lang] : code || '');

function clarificationMessage(lang: Lang): string {
  return lang === 'ar'
    ? 'مش واضح إلي شو المعلومة اللي بدك إياها، ممكن توضح أكثر؟'
    : "I'm not sure what you're asking — could you clarify a bit more?";
}

function refusalMessage(lang: Lang): string {
  return lang === 'ar'
    ? 'أنا مساعد للقراءة والمساعدة فقط، ما بقدر أنفذ أو أعدل أي شيء بالنظام. بس أقدر أشرحلك كيف تعمل هذا بنفسك.'
    : "I'm a read-only assistant — I can't create, update, or delete anything in the CRM. I can explain how to do it yourself, though.";
}

function permissionDeniedMessage(lang: Lang): string {
  return lang === 'ar' ? 'ما عندك صلاحية للوصول لهذه المعلومات.' : "You don't have permission to access this information.";
}

function notFoundMessage(lang: Lang): string {
  return lang === 'ar' ? 'ما لقيت نتائج مطابقة.' : "I couldn't find any matching results.";
}

function unknownFeatureMessage(lang: Lang): string {
  return lang === 'ar'
    ? 'حسب الوظائف المتاحة حاليًا بالنظام، ما في خيار بهذا الاسم.'
    : "Based on what's currently available in the CRM, there's no such feature.";
}

function genericErrorMessage(lang: Lang): string {
  return lang === 'ar' ? 'صار في مشكلة بسيطة وأنا بجاوب، جرّب مرة ثانية.' : 'Something went wrong while answering — please try again.';
}

export async function composeAnswer(input: ComposeInput): Promise<ComposeOutput> {
  const { tool, result, language } = input;

  if (tool === 'none' || !result) {
    const reason = input.unclearReason;
    if (reason === 'refused_action') return { reply: refusalMessage(language), resultSummary: null };
    return { reply: clarificationMessage(language), resultSummary: null };
  }

  if (!result.ok) {
    return { reply: permissionDeniedMessage(language), resultSummary: null };
  }

  if (tool === 'help') {
    if (!result.data) return { reply: unknownFeatureMessage(language), resultSummary: null };
    const topic = result.data;
    const content = language === 'ar' ? topic.ar : topic.en;
    const reply = [`**${content.title}**`, ...content.steps.map((s: string, i: number) => `${i + 1}. ${s}`)].join('\n');
    return { reply, resultSummary: `help topic: ${topic.key}` };
  }

  const data = result.data;
  if (data == null) return { reply: notFoundMessage(language), resultSummary: null };

  try {
    if (tool === 'getSchoolActivity') {
      // The only tool routed through Gemini: narrative summarization of
      // several tickets, not a plain list — everything else below is
      // deterministically templated (cheaper, and zero hallucination risk
      // since the phrasing never touches the underlying facts).
      const reply = await summarizeSchoolActivity(data, language);
      return { reply, resultSummary: `activity for ${data.schoolName}: ${data.recentTickets.length} recent tickets` };
    }

    const templated = templateAnswer(tool, data, language);
    return { reply: templated, resultSummary: JSON.stringify(data).slice(0, 400) };
  } catch {
    return { reply: genericErrorMessage(language), resultSummary: null };
  }
}

function templateAnswer(tool: ToolName, data: any, lang: Lang): string {
  const ar = lang === 'ar';
  switch (tool) {
    case 'searchSchools': {
      if (!data.schools.length) return notFoundMessage(lang);
      const lines = data.schools.map((s: any) => `- ${s.name} — ${s.city} (${statusLabel(s.status, lang)})`);
      const header = ar ? `لقيت ${formatNumber(data.totalMatching, lang)} مدرسة:` : `Found ${formatNumber(data.totalMatching, lang)} school(s):`;
      return [header, ...lines].join('\n');
    }
    case 'getSchool': {
      if (!data) return notFoundMessage(lang);
      const lines = [
        ar ? `**${data.name}**` : `**${data.name}**`,
        `${ar ? 'المدينة' : 'City'}: ${data.city}${data.area ? ` (${data.area})` : ''}`,
        `${ar ? 'الحالة' : 'Status'}: ${statusLabel(data.status, lang)}`,
        `${ar ? 'المسؤول' : 'Responsible'}: ${data.responsibleEmployee || (ar ? 'غير محدد' : 'Unassigned')}`,
        `${ar ? 'التذاكر المفتوحة' : 'Open tickets'}: ${formatNumber(data.openTicketCount, lang)} / ${formatNumber(data.totalTicketCount, lang)}`,
      ];
      if (data.phone) lines.push(`${ar ? 'الهاتف' : 'Phone'}: ${data.phone}`);
      return lines.join('\n');
    }
    case 'getSchoolFollowUps': {
      if (!data.items.length) return ar ? 'ما في مدارس محتاجة متابعة حاليًا.' : 'No schools currently need follow-up.';
      const lines = data.items.map((i: any) => `- ${i.school} (${i.city}) — ${i.ticketNumber}, ${ar ? 'تاريخ المتابعة' : 'follow-up'}: ${formatDate(i.followUpAt, lang)}`);
      const header = ar ? `في ${formatNumber(data.count, lang)} تذكرة محتاجة متابعة:` : `${formatNumber(data.count, lang)} ticket(s) need follow-up:`;
      return [header, ...lines].join('\n');
    }
    case 'getTickets':
    case 'getMyTickets': {
      if (!data.tickets.length) return notFoundMessage(lang);
      const lines = data.tickets.map(
        (t: any) => `- ${t.ticketNumber}${t.isMeeting ? ' 📅' : ''}: ${t.subject} — ${statusLabel(t.status, lang)}${t.assignee ? ` (${t.assignee})` : ''}`
      );
      const header = ar ? `لقيت ${formatNumber(data.totalMatching, lang)} تذكرة:` : `Found ${formatNumber(data.totalMatching, lang)} ticket(s):`;
      return [header, ...lines].join('\n');
    }
    case 'getMeetings': {
      if (!data.meetings.length) return notFoundMessage(lang);
      const lines = data.meetings.map(
        (m: any) => `- ${m.ticketNumber}: ${m.subject} — ${formatDate(m.meetingDate, lang)} ${m.meetingTime || ''} (${statusLabel(m.status, lang)})`
      );
      const header = ar ? `لقيت ${formatNumber(data.totalMatching, lang)} اجتماع:` : `Found ${formatNumber(data.totalMatching, lang)} meeting(s):`;
      return [header, ...lines].join('\n');
    }
    case 'getMeetingMinutes': {
      if (!data) return notFoundMessage(lang);
      const lines = [
        `**${data.subject}**`,
        `${ar ? 'التاريخ' : 'Date'}: ${formatDate(data.meetingDate, lang)} ${data.meetingTime || ''}`,
        `${ar ? 'المشاركون' : 'Participants'}: ${data.participants.join(', ') || '-'}`,
      ];
      if (data.actionItems.length) lines.push(`${ar ? 'مهام العمل' : 'Action items'}: ${data.actionItems.join(', ')}`);
      return lines.join('\n');
    }
    case 'getMyTasks': {
      if (!data.items.length) return ar ? 'ما عندك مهام حاليًا.' : 'You have no tasks right now.';
      const lines = data.items.map((t: any) => `- ${t.isCompleted ? '✅' : '⬜'} ${t.title}${t.dueDate ? ` (${formatDate(t.dueDate, lang)})` : ''}`);
      return [ar ? `عندك ${formatNumber(data.count, lang)} مهمة:` : `You have ${formatNumber(data.count, lang)} task(s):`, ...lines].join('\n');
    }
    case 'getDashboardStats': {
      const m = data.metrics;
      return ar
        ? `عندك ${formatNumber(m.total, lang)} تذكرة إجمالًا: ${formatNumber(m.pending, lang)} قيد الانتظار، ${formatNumber(m.inProgress, lang)} قيد التنفيذ، ${formatNumber(m.completed, lang)} مكتملة، ${formatNumber(m.closed, lang)} مغلقة. عدد المدارس: ${formatNumber(m.totalSchools, lang)}.`
        : `You have ${formatNumber(m.total, lang)} ticket(s) total: ${formatNumber(m.pending, lang)} pending, ${formatNumber(m.inProgress, lang)} in progress, ${formatNumber(m.completed, lang)} completed, ${formatNumber(m.closed, lang)} closed. Schools: ${formatNumber(m.totalSchools, lang)}.`;
    }
    case 'getMostOpenAssignees': {
      if (!data.items.length) return notFoundMessage(lang);
      const lines = data.items.map((i: any, idx: number) => `${idx + 1}. ${i.name} — ${formatNumber(i.openCount, lang)} ${ar ? 'تذكرة مفتوحة' : 'open ticket(s)'}`);
      return lines.join('\n');
    }
    case 'getCurrentUserPermissions': {
      return ar
        ? `دورك: ${data.role} (${data.department}). عدد الصلاحيات المباشرة: ${formatNumber(data.permissions.length, lang)}.`
        : `Your role: ${data.role} (${data.department}). Direct permission grants: ${formatNumber(data.permissions.length, lang)}.`;
    }
    default:
      return notFoundMessage(lang);
  }
}

async function summarizeSchoolActivity(data: { schoolName: string; recentTickets: any[] }, lang: Lang): Promise<string> {
  if (!data.recentTickets.length) {
    return lang === 'ar' ? `ما في نشاط مسجل لمدرسة ${data.schoolName}.` : `No recorded activity for ${data.schoolName}.`;
  }

  const system =
    lang === 'ar'
      ? 'أنت مساعد يلخص نشاط مدرسة بناءً على بيانات مرفقة فقط. لا تخترع أي معلومة غير موجودة بالبيانات. أجب بالعربية باختصار (3-4 أسطر).'
      : 'You summarize a school\'s recent ticket activity using ONLY the data provided. Never invent information not present in the data. Answer in English, concisely (3-4 lines).';

  try {
    const reply = await callGeminiChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: `School: ${data.schoolName}\nRecent tickets (JSON): ${JSON.stringify(data.recentTickets)}` },
      ],
      400
    );
    return reply.trim();
  } catch {
    // Graceful, honest fallback if Gemini is unavailable — still no fabricated data.
    const lines = data.recentTickets.map(
      (t: any) => `- ${t.ticketNumber}: ${t.subject} — ${statusLabel(t.status, lang)} (${formatDate(t.createdAt, lang)})`
    );
    return [lang === 'ar' ? `آخر نشاط لمدرسة ${data.schoolName}:` : `Recent activity for ${data.schoolName}:`, ...lines].join('\n');
  }
}
