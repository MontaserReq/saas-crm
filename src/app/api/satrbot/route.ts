import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { hasPermission } from '@/lib/permissions';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { checkRateLimit, RATE_LIMIT_POLICY_CONFIG } from '@/lib/security/rateLimiter';
import { formatSatrBotAnswer, retrieveSatrBotTopic, SATRBOT_TOPICS } from '@/lib/satrbot/knowledge';

const inputSchema = z.object({
  message: z.string().trim().min(1).max(500),
  language: z.enum(['ar', 'en']).default('ar'),
});

function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  const user = await requireAuth();
  const limited = await checkRateLimit({
    policy: 'chatbot',
    identity: `satrbot:${user.id}:${clientIp(request)}`,
    ...RATE_LIMIT_POLICY_CONFIG.chatbot,
  });
  if (!limited.allowed) return NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });

  let input: z.infer<typeof inputSchema>;
  try {
    input = inputSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_INPUT' }, { status: 400 });
  }

  const visibleTopics = SATRBOT_TOPICS.filter((topic) => !topic.permission || hasPermission(user, topic.permission));
  const topic = retrieveSatrBotTopic(input.message, input.language, visibleTopics);
  if (!topic) {
    return NextResponse.json({
      success: true,
      needsSupport: true,
      reply: input.language === 'ar'
        ? 'ما قدرت أحدد إجابة موثوقة من دليل SatrCRM لهذا السؤال. ابعث طلبك من مركز الدعم، وسيرد عليك فريق الدعم خلال 24 ساعة.'
        : "I couldn't find a reliable answer in the SatrCRM guide for this question. Send it through the Support Center and our support team will reply within 24 hours.",
    });
  }

  return NextResponse.json({ success: true, needsSupport: false, topic: topic.key, reply: formatSatrBotAnswer(topic, input.language) });
}
