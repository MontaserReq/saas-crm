import { createHash } from 'node:crypto';
import { sendTransactionalEmail } from '@/lib/email';

type ReportInput = {
  source: 'server' | 'client';
  message: string;
  stack?: string;
  path?: string;
  method?: string;
  route?: string;
  details?: Record<string, string | number | undefined>;
};

const recentReports = new Map<string, number>();
const REPORT_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_FIELD_LENGTH = 4_000;

function trim(value: unknown, max = MAX_FIELD_LENGTH) {
  return String(value ?? '').slice(0, max);
}

function redact(value: string) {
  return value
    .replace(/(authorization|cookie|password|secret|token)=?[^\s,;]*/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  try { return { message: JSON.stringify(error) }; } catch { return { message: 'Unknown application error' }; }
}

export async function reportApplicationError(input: ReportInput) {
  if (process.env.NODE_ENV === 'test') return;

  const recipient = process.env.ALERT_EMAIL_TO || process.env.MONITOR_ALERT_EMAIL || '';
  if (!recipient) {
    console.error('[monitoring] ALERT_EMAIL_TO is not configured', input.message);
    return;
  }

  const message = redact(trim(input.message));
  const stack = redact(trim(input.stack || ''));
  const path = redact(trim(input.path || ''));
  const key = createHash('sha256').update(`${input.source}|${input.route || ''}|${path}|${message}`).digest('hex');
  const now = Date.now();
  const lastReported = recentReports.get(key);
  if (lastReported && now - lastReported < REPORT_COOLDOWN_MS) return;
  recentReports.set(key, now);
  for (const [reportKey, timestamp] of recentReports) if (now - timestamp > REPORT_COOLDOWN_MS * 2) recentReports.delete(reportKey);

  const details = Object.entries(input.details || {})
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([name, value]) => `${name}: ${redact(trim(value, 500))}`)
    .join('\n');
  const location = [input.method, path, input.route].filter(Boolean).join(' ');
  const subject = `[SatrCRM] ${input.source === 'client' ? 'Browser' : 'Server'} error${path ? `: ${path}` : ''}`;
  const text = [
    'SatrCRM monitoring detected an application error.', '',
    `Source: ${input.source}`, location ? `Location: ${location}` : '',
    `Message: ${message}`, details, stack ? `\nStack:\n${stack}` : '',
  ].filter(Boolean).join('\n');

  try {
    await sendTransactionalEmail({
      to: recipient,
      subject,
      text,
      html: `<h2>SatrCRM application error</h2><p><strong>Source:</strong> ${input.source}</p><p><strong>Location:</strong> ${location || 'n/a'}</p><p><strong>Message:</strong> ${message}</p><pre>${stack || 'No stack trace available.'}</pre>`,
    });
  } catch (error) {
    console.error('[monitoring] failed to send application alert', error);
  }
}

export async function reportApplicationException(error: unknown, input: Omit<ReportInput, 'message' | 'stack'>) {
  const normalized = normalizeError(error);
  return reportApplicationError({ ...input, message: normalized.message, stack: normalized.stack });
}
