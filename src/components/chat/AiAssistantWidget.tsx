'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, Send, X, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { askAssistantAction } from '@/server/actions/ai-assistant';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

function deriveContext(pathname: string): { entityType?: string; entityId?: string } | null {
  const schoolMatch = pathname.match(/^\/schools\/([^/]+)/);
  if (schoolMatch) return { entityType: 'school', entityId: schoolMatch[1] };
  const ticketMatch = pathname.match(/^\/tickets\/([^/]+)/);
  if (ticketMatch) return { entityType: 'ticket', entityId: ticketMatch[1] };
  return null;
}

/**
 * Read-only AI Knowledge Assistant — same fixed-launcher/compact-panel shell
 * as ChatWidget, mounted at the opposite corner so the two stay visually
 * distinct (peer chat vs. AI help). Conversation state is ephemeral
 * (component state only — see plan) and bounded (last few turns + last
 * result summary sent per request, never full history).
 */
export function AiAssistantWidget() {
  const { t, language } = useI18n();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResultSummary, setLastResultSummary] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => deriveContext(pathname || ''), [pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [isOpen]);

  const suggestions = useMemo(() => {
    const base = [t('aiAssistant.suggestion1'), t('aiAssistant.suggestion2'), t('aiAssistant.suggestion3'), t('aiAssistant.suggestion4')];
    if (context?.entityType === 'school') return [t('aiAssistant.suggestionSchoolActivity'), ...base.slice(0, 3)];
    if (context?.entityType === 'ticket') return [t('aiAssistant.suggestionTicketHelp'), ...base.slice(0, 3)];
    return base;
  }, [context, t]);

  const ask = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setTurns((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    const res = await askAssistantAction({
      message: trimmed,
      language,
      context,
      recentTurns: turns.slice(-4),
      lastResultSummary,
    });

    setLoading(false);
    if (!res.success) {
      setTurns((prev) => [...prev, { role: 'assistant', content: t('aiAssistant.errorGeneric') }]);
      return;
    }
    setTurns((prev) => [...prev, { role: 'assistant', content: res.reply || t('aiAssistant.errorGeneric') }]);
    setLastResultSummary(res.resultSummary ?? null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const clearConversation = () => {
    setTurns([]);
    setLastResultSummary(null);
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={t('aiAssistant.launcherLabel')}
          className="fixed bottom-4 start-4 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-brand-700 to-brand-500 hover:from-brand-600 hover:to-brand-400 text-white shadow-lg shadow-brand-500/30 transition-all active:scale-95"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <>
          <div className="sm:hidden fixed inset-0 bg-slate-900/50 z-40" aria-hidden="true" />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('aiAssistant.title')}
            className="fixed inset-x-0 bottom-0 z-50 w-full h-[85vh] max-h-[720px] rounded-t-2xl sm:inset-auto sm:bottom-4 sm:start-4 sm:w-[360px] sm:h-[520px] sm:max-h-[calc(100vh-6rem)] sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="font-bold text-sm truncate">{t('aiAssistant.title')}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {turns.length > 0 && (
                  <button
                    type="button"
                    onClick={clearConversation}
                    aria-label={t('aiAssistant.clearLabel')}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label={t('aiAssistant.closeLabel')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
              {turns.length === 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-400">{t('aiAssistant.subtitle')}</p>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('aiAssistant.suggestedTitle')}</span>
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => ask(s)}
                        className="w-full text-start px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {turns.map((turn, idx) => (
                <div
                  key={idx}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs whitespace-pre-wrap break-words ${
                    turn.role === 'user' ? 'ml-auto bg-brand-600 text-white' : 'mr-auto bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {turn.content}
                </div>
              ))}
              {loading && (
                <div className="mr-auto max-w-[85%] rounded-2xl px-3.5 py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 italic">
                  {t('aiAssistant.thinking')}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={submit} className="p-2.5 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                placeholder={t('aiAssistant.placeholder')}
                disabled={loading}
                className="min-w-0 flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-xs outline-none disabled:opacity-60"
              />
              <button
                disabled={loading || !input.trim()}
                aria-label={t('aiAssistant.sendLabel')}
                className="rounded-xl bg-brand-600 text-white px-3.5 disabled:opacity-50 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
