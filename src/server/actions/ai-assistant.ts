'use server';

import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { AuditService } from '@/server/services/AuditService';
import { classifyIntent } from '@/lib/ai-assistant/classify';
import { routeTool } from '@/lib/ai-assistant/router';
import { composeAnswer } from '@/lib/ai-assistant/compose';
import { checkRateLimit, RATE_LIMIT_POLICY_CONFIG } from '@/lib/security/rateLimiter';
import { acquireOperation, finishOperation, RESOURCE_LIMITS } from '@/lib/security/resourceGuard';
import { requireOrganizationId } from '@/lib/auth/organization';
import { randomUUID } from 'crypto';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_TURNS = 4;

// Fast, zero-AI-call short-circuit for obvious action/mutation/injection
// requests — pure cost optimization. It is NOT the security boundary: even
// if a cleverly-worded request slips past this regex, the classifier can
// still only ever select a tool from the fixed read-only allow-list in
// src/lib/ai-assistant/tools.ts, so no mutation is ever reachable regardless.
const ACTION_REQUEST_PATTERN =
  /\b(create|update|delete|remove|insert|modify|send (a |an )?(message|email)|change (the )?(status|assignee|responsible)|execute\s*sql|ignore (the |all )?(previous |prior )?instructions?|reveal.*(api key|secret|password)|give me.*(api key|secret|password))\b|انشئ|أنشئ|احذف|إحذف|عدّل|عدل|غيّر|غير|أرسل|ارسل|تجاهل التعليمات|نفذ\s*sql|أعطني.*(مفتاح|كلمة السر|باسورد)/i;

// A "how do I create..."/"كيف أنشئ..." how-to question must never be treated
// as an action request — it's asking for an explanation, not asking the
// assistant to act. Checked first so it always wins over the pattern above.
const HOW_TO_QUESTION_PATTERN = /\b(how (do|can|to) i?|what('?s| is) the (way|process|steps?) to)\b|كيف|شلون|الطريقة/i;

export interface AskAssistantInput {
  message: string;
  language: 'ar' | 'en';
  context?: { entityType?: string; entityId?: string } | null;
  recentTurns?: { role: 'user' | 'assistant'; content: string }[];
  lastResultSummary?: string | null;
}

export interface AskAssistantResult {
  success: boolean;
  reply?: string;
  resultSummary?: string | null;
  error?: string;
}

export async function askAssistantAction(input: AskAssistantInput): Promise<AskAssistantResult> {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.AI_ASSISTANT_VIEW)) {
      return { success: false, error: 'Forbidden' };
    }

    const message = (input.message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!message) return { success: false, error: 'Empty message' };

    const policy = RATE_LIMIT_POLICY_CONFIG.ai;
    const limit = await checkRateLimit({ policy: 'ai', identity: `ai-assistant-user:${user.id}`, ...policy });
    if (!limit.allowed) {
      return {
        success: true,
        reply: input.language === 'ar' ? 'في طلبات كثيرة بوقت قصير، جرّب بعد شوي.' : 'Too many requests in a short time — please try again shortly.',
        resultSummary: null,
      };
    }

    const execution = await acquireOperation({
      organizationId: requireOrganizationId(user),
      userId: user.id,
      operationType: 'AI_ASSISTANT',
      idempotencyKey: randomUUID(),
      limits: RESOURCE_LIMITS.AI_ASSISTANT,
    });
    if (!execution.acquired || !execution.execution) {
      return { success: true, reply: languageForLimit(input.language), resultSummary: null };
    }

    try {
      const language = input.language === 'ar' ? 'ar' : 'en';

    if (ACTION_REQUEST_PATTERN.test(message) && !HOW_TO_QUESTION_PATTERN.test(message)) {
      const reply =
        language === 'ar'
          ? 'أنا مساعد للقراءة والمساعدة فقط، ما بقدر أنفذ أو أعدل أي شيء بالنظام. بس أقدر أشرحلك كيف تعمل هذا بنفسك.'
          : "I'm a read-only assistant — I can't create, update, or delete anything in the CRM. I can explain how to do it yourself, though.";
      await AuditService.logAudit({ actorId: user.id, action: 'AI_ASSISTANT_QUERY', entityType: 'AiAssistant', metadata: { tool: 'none', reason: 'action_request_blocked_precheck' } });
      return { success: true, reply, resultSummary: null };
    }

    const classification = await classifyIntent(message, {
      page: input.context,
      recentTurns: (input.recentTurns || []).slice(-MAX_TURNS),
      lastResultSummary: input.lastResultSummary,
      language,
    });

    const { tool, result } = await routeTool(user, classification.tool, classification.args);

    const composed = await composeAnswer({
      tool,
      result,
      language,
      originalMessage: message,
      unclearReason: classification.args?.reason === 'action_requested' ? 'refused_action' : undefined,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'AI_ASSISTANT_QUERY',
      entityType: 'AiAssistant',
      metadata: { tool, ok: result?.ok ?? null },
    });

      return { success: true, reply: composed.reply, resultSummary: composed.resultSummary };
    } finally {
      await finishOperation(execution.execution.id, execution.execution.ownerToken!, 'SUCCEEDED');
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to answer' };
  }
}

function languageForLimit(language: 'ar' | 'en') {
  return language === 'ar' ? 'طلبات كثيرة في وقت قصير، يرجى المحاولة لاحقاً.' : 'Too many AI requests are currently running. Please try again shortly.';
}
