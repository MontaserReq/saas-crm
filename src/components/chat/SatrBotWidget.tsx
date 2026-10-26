'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Headphones, Send, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';

type BotMessage = { id: string; role: 'bot' | 'user'; content: string; needsSupport?: boolean };

export function SatrBotWidget() {
  const { language } = useI18n();
  const router = useRouter();
  const ar = language === 'ar';
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const welcome = ar ? 'أنا SatrBot، كيف بقدر أساعدك؟' : 'I’m SatrBot. How can I help you?';
  const suggestions = ar
    ? ['كيف أضيف عميل؟', 'كيف أعدل الصلاحيات؟', 'كيف أربط البريد؟']
    : ['How do I add a customer?', 'How do I manage permissions?', 'How do I connect email?'];

  useEffect(() => {
    if (!open) return;
    setMessages((current) => current.length ? current : [{ id: 'welcome', role: 'bot', content: welcome }]);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [open, welcome]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const openBot = () => setOpen(true);
    window.addEventListener('satrbot:open', openBot);
    window.addEventListener('codeline:open-hosted-assistant', openBot);
    return () => {
      window.removeEventListener('satrbot:open', openBot);
      window.removeEventListener('codeline:open-hosted-assistant', openBot);
    };
  }, []);

  async function ask(value = message) {
    const text = value.trim();
    if (!text || busy) return;
    setMessage('');
    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: 'user', content: text }]);
    setBusy(true);
    try {
      const response = await fetch('/api/satrbot', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: text, language }),
      });
      const result = await response.json().catch(() => null) as { reply?: string; needsSupport?: boolean } | null;
      const reply = result?.reply || (ar ? 'تعذر الحصول على إجابة الآن. افتح مركز الدعم وسنساعدك.' : 'I could not answer right now. Open the Support Center and we will help you.');
      setMessages((current) => [...current, { id: `${Date.now()}-bot`, role: 'bot', content: reply, needsSupport: result?.needsSupport }]);
    } catch {
      setMessages((current) => [...current, { id: `${Date.now()}-bot`, role: 'bot', content: ar ? 'تعذر الاتصال الآن. ابعث طلبك من مركز الدعم وسنرد عليك خلال 24 ساعة.' : 'I could not connect right now. Send a request through the Support Center and we will reply within 24 hours.', needsSupport: true }]);
    } finally {
      setBusy(false);
    }
  }

  return <>
    {open && <>
      <div className="fixed inset-0 z-40 bg-slate-950/10 sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
      <section dir={ar ? 'rtl' : 'ltr'} aria-label="SatrBot" className="fixed inset-x-3 bottom-20 z-50 flex h-[min(620px,calc(100vh-7rem))] flex-col overflow-hidden rounded-[1.75rem] border border-violet-200/70 bg-white shadow-2xl shadow-violet-950/20 dark:border-violet-900/60 dark:bg-slate-900 sm:inset-x-auto sm:start-4 sm:bottom-20 sm:w-[390px]">
        <header className="relative overflow-hidden bg-gradient-to-br from-violet-800 via-violet-700 to-indigo-700 px-5 py-4 text-white">
          <div className="absolute -end-8 -top-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Bot className="h-7 w-7" /><span className="absolute bottom-2 start-3 h-1 w-1 rounded-full bg-amber-300" /><span className="absolute bottom-2 end-3 h-1 w-1 rounded-full bg-amber-300" /></span>
            <div className="min-w-0 flex-1"><p className="text-lg font-black">SatrBot</p><p className="text-xs text-violet-100">{ar ? 'مساعد معرفة SatrCRM' : 'SatrCRM knowledge assistant'}</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label={ar ? 'إغلاق SatrBot' : 'Close SatrBot'} className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative mt-3 flex items-center gap-2 text-[11px] text-violet-100"><Sparkles className="h-3.5 w-3.5 text-amber-300" />{ar ? 'إجابات من دليل النظام، وتحويل للدعم عند الحاجة' : 'Answers from the system guide, with support when needed'}</div>
        </header>

        <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950/40">
          {messages.map((item) => <div key={item.id} className={item.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-6 shadow-sm ${item.role === 'user' ? 'rounded-br-md bg-violet-700 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'}`}>
              {item.role === 'bot' && <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black text-violet-700 dark:text-violet-300"><Bot className="h-3.5 w-3.5" />SatrBot</div>}
              <p className="whitespace-pre-line">{item.content}</p>
              {item.needsSupport && <button type="button" onClick={() => router.push('/support')} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-800"><Headphones className="h-3.5 w-3.5" />{ar ? 'فتح مركز الدعم' : 'Open Support Center'}</button>}
            </div>
          </div>)}
          {busy && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900"><span className="inline-flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:240ms]" /></span></div></div>}
          {messages.length <= 1 && !busy && <div className="flex flex-wrap gap-2 pt-1">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => ask(suggestion)} className="rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 transition hover:border-violet-400 hover:bg-violet-50 dark:border-violet-900/60 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-950/30">{suggestion}</button>)}</div>}
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="flex gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <input ref={inputRef} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} disabled={busy} placeholder={ar ? 'اكتب سؤالك عن SatrCRM…' : 'Ask about SatrCRM…'} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          <button type="submit" disabled={busy || !message.trim()} aria-label={ar ? 'إرسال السؤال' : 'Send question'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </form>
      </section>
    </>}

    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={ar ? 'فتح SatrBot للمساعدة' : 'Open SatrBot help'} aria-expanded={open} className="fixed bottom-4 start-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-violet-800 to-violet-500 text-white shadow-lg shadow-violet-500/30 transition hover:scale-105 hover:from-violet-700 hover:to-indigo-500 active:scale-95">
      <Bot className="h-7 w-7" />
      <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-amber-400 px-1 text-[9px] font-black text-violet-950 dark:border-slate-950">?</span>
    </button>
  </>;
}
