'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Hash, LockKeyhole, MessageCircle, RefreshCw, Send, ShieldCheck, Unplug } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { useDialog } from '@/lib/dialog/context';

type Channel = { id: string; name: string; isPrivate: boolean; isMember: boolean };
type Connection = { configured: boolean; connected: boolean; teamName: string | null; defaultChannelId: string | null; defaultChannelName: string | null };

const SLACK_CREATE_WORKSPACE_URL = 'https://slack.com/get-started#/createnew';

export function SlackIntegrationSettings({ organizationName, connection: initialConnection, canManage, available }: { organizationName: string; connection: Connection; canManage: boolean; available: boolean }) {
  const { language } = useI18n();
  const { confirm } = useDialog();
  const searchParams = useSearchParams();
  const ar = language === 'ar';
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const [connection, setConnection] = useState(initialConnection);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState(initialConnection.defaultChannelId || '');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const notice = (() => {
    const status = searchParams.get('slack');
    const reason = searchParams.get('reason');
    if (status === 'connected') return text('Slack workspace connected successfully.', 'تم ربط مساحة Slack بنجاح.');
    if (status === 'cancelled') return text('Slack authorization was cancelled. No credentials were saved.', 'تم إلغاء تفويض Slack. لم يتم حفظ أي بيانات.');
    if (status === 'not-configured') return text('Slack is not configured on the server yet. Add the Slack app credentials first.', 'لم يتم إعداد Slack على السيرفر بعد. أضف بيانات تطبيق Slack أولاً.');
    if (status === 'failed') return reason === 'forbidden' ? text('You are not allowed to manage this Slack connection.', 'ليس لديك صلاحية لإدارة اتصال Slack.') : text('Slack connection could not be completed. No credentials were saved.', 'تعذر إكمال ربط Slack. لم يتم حفظ أي بيانات.');
    return '';
  })();

  async function refreshStatus() {
    const response = await fetch('/api/integrations/slack/status', { cache: 'no-store' });
    if (!response.ok) return;
    const body = await response.json() as { configured: boolean; connected: boolean; connection?: { teamName: string; defaultChannelId: string | null; defaultChannelName: string | null } | null };
    const next = { configured: body.configured, connected: body.connected, teamName: body.connection?.teamName || null, defaultChannelId: body.connection?.defaultChannelId || null, defaultChannelName: body.connection?.defaultChannelName || null };
    setConnection(next); setChannelId(next.defaultChannelId || '');
  }

  const loadChannels = useCallback(async () => {
    setBusy('channels'); setError('');
    try {
      const response = await fetch('/api/integrations/slack/channels', { cache: 'no-store' });
      const body = await response.json() as { channels?: Channel[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Unable to load Slack channels');
      setChannels(body.channels || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? 'تعذر تحميل قنوات Slack.' : 'Unable to load Slack channels.')); }
    finally { setBusy(''); }
  }, [ar]);

  useEffect(() => { if (initialConnection.connected) void loadChannels(); }, [initialConnection.connected, loadChannels]);

  async function saveChannel() {
    if (!channelId) return;
    setBusy('save'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/integrations/slack/channel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId }) });
      const body = await response.json() as { channel?: Channel; error?: string };
      if (!response.ok) throw new Error(body.error || 'Unable to save channel');
      setConnection((current) => ({ ...current, defaultChannelId: body.channel?.id || channelId, defaultChannelName: body.channel?.name || null }));
      setMessage(text('Default channel saved.', 'تم حفظ القناة الافتراضية.'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : text('Unable to save channel.', 'تعذر حفظ القناة.')); }
    finally { setBusy(''); }
  }

  async function testConnection() {
    setBusy('test'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/integrations/slack/test', { method: 'POST', headers: { Accept: 'application/json' } });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Slack test failed');
      setMessage(text('Test message sent to Slack.', 'تم إرسال رسالة اختبار إلى Slack.'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : text('Slack test failed.', 'فشل اختبار Slack.')); }
    finally { setBusy(''); }
  }

  async function disconnect() {
    const approved = await confirm({
      title: text('Disconnect Slack', 'فصل Slack'),
      message: text(
        'Disconnecting will stop CRM notifications from being sent to this Slack workspace.',
        'فصل الاتصال سيوقف إرسال تنبيهات CRM إلى مساحة Slack هذه.'
      ),
      variant: 'confirmation',
      confirmText: text('Disconnect', 'فصل'),
      cancelText: text('Cancel', 'إلغاء'),
      isDestructive: true,
    });
    if (!approved) return;
    setBusy('disconnect'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/integrations/slack', { method: 'DELETE', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Unable to disconnect Slack');
      setChannels([]); setConnection({ ...connection, connected: false, teamName: null, defaultChannelId: null, defaultChannelName: null }); setChannelId('');
      setMessage(text('Slack was disconnected.', 'تم فصل Slack.'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : text('Unable to disconnect Slack.', 'تعذر فصل Slack.')); }
    finally { setBusy(''); }
  }

  return <section dir={ar ? 'rtl' : 'ltr'} className="relative space-y-5 overflow-hidden rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
    {!available && <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 p-4 backdrop-blur-[1px] dark:bg-slate-950/60"><div role="status" className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-white px-5 py-4 text-center shadow-lg dark:border-violet-900/70 dark:bg-slate-900"><LockKeyhole className="h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" /><span className="text-sm font-bold">{text('Slack integration is not included in this plan.', 'تكامل Slack غير متاح ضمن هذه الباقة.')}</span></div></div>}
    <div className={!available ? 'pointer-events-none select-none opacity-50' : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><MessageCircle className="h-5 w-5 text-violet-600" />{text('Slack workspace integration', 'تكامل مساحة Slack')}</h2>
          <p className="mt-1 text-xs text-slate-500">{text(`This connection belongs only to ${organizationName}. Send focused CRM notifications to the channel your team already uses.`, `هذا الاتصال خاص بمؤسسة ${organizationName} فقط. أرسل تنبيهات CRM المهمة إلى القناة التي يستخدمها فريقك.`)}</p>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
      </div>
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!connection.connected ? <div className="rounded-2xl border border-dashed p-5"><p className="text-sm font-semibold">{text('Connect one Slack workspace to this CRM organization. Other organizations keep their own separate connection.', 'اربط مساحة Slack واحدة بهذه المؤسسة في CRM. كل مؤسسة أخرى تحتفظ باتصالها المنفصل.')}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!connection.configured || !canManage || Boolean(busy)} onClick={() => window.location.assign('/api/integrations/slack/start')} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><MessageCircle className="h-4 w-4" />{connection.configured ? text('Connect existing workspace', 'ربط مساحة موجودة') : text('Configure Slack first', 'أعد إعداد Slack أولاً')}</button><a href={SLACK_CREATE_WORKSPACE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/30">{text('Create a new workspace', 'إنشاء مساحة جديدة')}</a></div><p className="mt-3 text-xs text-slate-500">{text('If you create a new Slack workspace, return here and choose Connect existing workspace to install SatrCRM in it.', 'إذا أنشأت مساحة Slack جديدة، ارجع إلى هنا واختر «ربط مساحة موجودة» لتثبيت SatrCRM فيها.' )}</p></div> : <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20"><div><p className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />{connection.teamName}</p><p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{text('Connected workspace', 'مساحة عمل متصلة')}</p></div><button type="button" disabled={!canManage || Boolean(busy)} onClick={() => void disconnect()} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300"><Unplug className="h-3.5 w-3.5" />{text('Disconnect', 'فصل')}</button></div>
        <div className="rounded-2xl border p-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1"><span className="mb-2 flex items-center gap-2 text-xs font-bold"><Hash className="h-3.5 w-3.5" />{text('Default notification channel', 'قناة التنبيهات الافتراضية')}</span><select value={channelId} onChange={(event) => setChannelId(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700"><option value="">{text('Choose a channel', 'اختر قناة')}</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}{channel.isPrivate ? ' · private' : ''}</option>)}</select></label><button type="button" onClick={() => void loadChannels()} disabled={busy !== ''} className="inline-flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy === 'channels' ? 'animate-spin' : ''}`} />{text('Refresh', 'تحديث')}</button><button type="button" onClick={() => void saveChannel()} disabled={!channelId || busy !== '' || !canManage} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-xs font-bold text-white disabled:opacity-50">{text('Save channel', 'حفظ القناة')}</button></div><p className="mt-2 text-xs text-slate-500">{connection.defaultChannelName ? `${text('Current:', 'الحالية:')} #${connection.defaultChannelName}` : text('Choose the channel that should receive CRM alerts.', 'اختر القناة التي ستستقبل تنبيهات CRM.')}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!connection.defaultChannelId || busy !== '' || !canManage} onClick={() => void testConnection()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold disabled:opacity-50"><Send className="h-3.5 w-3.5" />{busy === 'test' ? text('Sending…', 'جارٍ الإرسال…') : text('Send test notification', 'إرسال رسالة اختبار')}</button></div>
      </div>}
    </div>
  </section>;
}

