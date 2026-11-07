'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/context';

type TokenItem = { id: string; name: string; tokenPrefix: string; scopes: string[]; expiresAt: string | null; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };

const panel = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
const field = 'w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700';
const button = 'inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50';

export function McpTokenSettings() {
  const { language } = useI18n();
  const ar = language === 'ar';
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch('/api/mcp/tokens', { cache: 'no-store' });
    if (response.ok) setTokens((await response.json()).tokens || []);
  }

  useEffect(() => { void load(); }, []);

  async function createToken(event: React.FormEvent) {
    event.preventDefault();
    const submittedName = String(new FormData(event.currentTarget as HTMLFormElement).get('tokenName') || name).trim();
    if (!submittedName) {
      setError(true);
      setMessage(ar ? 'أدخل اسمًا للرمز أولًا.' : 'Enter a token name first.');
      return;
    }
    setPending(true); setMessage(''); setError(false); setNewToken('');
    try {
      const response = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: submittedName, scopes: ['crm.read'] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to create token');
      setNewToken(body.token); setName(''); setMessage(ar ? 'تم إنشاء الرمز. انسخه الآن؛ لن يظهر مرة أخرى.' : 'Token created. Copy it now; it will not be shown again.');
      await load();
    } catch (reason) {
      setError(true); setMessage(reason instanceof Error ? reason.message : (ar ? 'تعذر إنشاء الرمز.' : 'Unable to create token.'));
    } finally { setPending(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm(ar ? 'هل تريد إبطال هذا الرمز؟' : 'Revoke this token?')) return;
    const response = await fetch(`/api/mcp/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) { setMessage(ar ? 'تم إبطال الرمز.' : 'Token revoked.'); await load(); }
    else { setError(true); setMessage(ar ? 'تعذر إبطال الرمز.' : 'Unable to revoke token.'); }
  }

  return <section className={`${panel} space-y-4`} dir={ar ? 'rtl' : 'ltr'}>
    <div>
      <h2 className="text-xl font-bold">{ar ? 'وصول MCP الآمن' : 'Secure MCP access'}</h2>
      <p className="mt-1 text-sm text-slate-500">{ar ? 'أنشئ رمز قراءة لاستخدام CRM من ChatGPT أو Claude أو Groq أو أي عميل MCP.' : 'Create a read-only token for ChatGPT, Claude, Groq, or any MCP-compatible client.'}</p>
    </div>
    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={createToken}>
      <input name="tokenName" className={field} value={name} onInput={event => setName(event.currentTarget.value)} onChange={event => setName(event.target.value)} maxLength={80} required placeholder={ar ? 'اسم الرمز، مثل Claude CRM' : 'Token name, e.g. Claude CRM'} />
      <button className={button} disabled={pending}>{pending ? (ar ? 'جارٍ الإنشاء…' : 'Creating…') : (ar ? 'إنشاء رمز قراءة' : 'Create read-only token')}</button>
    </form>
    {newToken && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30"><p className="text-sm font-bold">{ar ? 'انسخ الرمز الآن' : 'Copy this token now'}</p><code className="mt-2 block break-all text-xs">{newToken}</code><button type="button" className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold dark:border-slate-700" onClick={() => void navigator.clipboard.writeText(newToken)}>{ar ? 'نسخ' : 'Copy'}</button></div>}
    {message && <p role={error ? 'alert' : 'status'} className={error ? 'text-sm text-red-600' : 'text-sm text-emerald-600'}>{message}</p>}
    {tokens.length > 0 && <div className="space-y-2">{tokens.map(token => <div key={token.id} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{token.name} <code className="ml-2 text-xs text-slate-500">{token.tokenPrefix}…</code></p><p className="text-xs text-slate-500">{token.revokedAt ? (ar ? 'مُبطل' : 'Revoked') : `${ar ? 'ينتهي' : 'Expires'} ${token.expiresAt ? new Date(token.expiresAt).toLocaleString(ar ? 'ar-JO' : 'en-US') : '—'}`}</p></div>{!token.revokedAt && <button type="button" className="self-start rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 dark:border-red-800 dark:text-red-300" onClick={() => void revoke(token.id)}>{ar ? 'إبطال' : 'Revoke'}</button>}</div>)}</div>}
  </section>;
}
