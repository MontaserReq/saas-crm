'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Circle, MessageCircle, Search, Send, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { formatDate } from '@/lib/utils';
import { deriveStatus, PresenceStatus } from '@/lib/presence/deriveStatus';
import {
  getChatConversationAction,
  getChatDataAction,
  markChatReadAction,
  sendChatMessageAction,
  startChatAction,
} from '@/server/actions/chat';
import { heartbeatAction } from '@/server/actions/presence';

const HEARTBEAT_INTERVAL_MS = 30_000;

const STATUS_DOT_CLASS: Record<PresenceStatus, string> = {
  online: 'fill-emerald-500 text-white',
  away: 'fill-amber-400 text-white',
  offline: 'fill-slate-300 dark:fill-slate-600 text-white dark:text-slate-950',
};

function formatLastSeen(t: (key: string, params?: Record<string, any>) => string, lastSeenAt: string | undefined): string {
  if (!lastSeenAt) return t('chat.offline');
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (ageMs <= 60_000) return t('chat.lastSeenJustNow');
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return t('chat.lastSeenMinutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('chat.lastSeenHoursAgo', { hours });
  const days = Math.floor(hours / 24);
  return t('chat.lastSeenDaysAgo', { days });
}

/**
 * Fixed, always-accessible Messenger-style chat launcher + compact panel.
 * Mounted once in the dashboard layout (not inside Sidebar), so it survives
 * route changes and never requires opening the mobile nav drawer or
 * scrolling to reach it.
 */
export function ChatWidget({ currentUserId }: { currentUserId: string }) {
  const { t, language, direction } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [pane, setPane] = useState<'list' | 'thread'>('list');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const data = await getChatDataAction();
    setUsers(data.users);
    setConversations(data.conversations);
    setPresence(data.presence || {});
  };

  // Subscribed as long as the widget is mounted (i.e. always), so the unread
  // dot and presence stay live even while the panel is closed.
  useEffect(() => {
    load();
    const stream = new EventSource('/api/chat/stream');
    stream.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setConversations(payload.conversations || []);
      setPresence(payload.presence || {});
    };
    return () => stream.close();
  }, []);

  // Reports this user as active. Paused while the tab is hidden (no writes
  // for a backgrounded/minimized tab), and fires immediately when it
  // becomes visible again rather than waiting for the next tick.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') heartbeatAction();
    };

    const start = () => {
      sendHeartbeat();
      if (!timer) timer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    };

    start();
    document.addEventListener('visibilitychange', sendHeartbeat);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', sendHeartbeat);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    getChatConversationAction(selected.id).then((data) => setMessages(data?.messages || []));
    markChatReadAction(selected.id).then(() => load());
  }, [selected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, pane, isOpen]);

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

  const others = useMemo(() => users.filter((u) => u.id !== currentUserId), [users, currentUserId]);

  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return others
      .map((u) => {
        const convo = conversations.find((c: any) => c.participants?.some((p: any) => p.userId === u.id));
        const lastMessage = convo?.messages?.[0];
        return { ...u, convo, lastMessage, unread: !!convo?.unreadCount };
      })
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => {
        const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bt - at;
      });
  }, [others, conversations, search]);

  const hasUnread = useMemo(() => conversations.some((c: any) => c.unreadCount > 0), [conversations]);

  const start = async (otherUserId: string) => {
    setSelectedUserId(otherUserId);
    const conversation = await startChatAction(otherUserId);
    await load();
    setSelected(conversation);
    setPane('thread');
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !text.trim()) return;
    const message = await sendChatMessageAction(selected.id, text);
    setMessages((prev) => [...prev, message]);
    setText('');
    await load();
  };

  return (
    <>
      {/* Fixed launcher — always accessible, never requires scrolling or opening the nav drawer */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={t('chat.launcherLabel')}
          className="fixed bottom-4 end-4 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/30 transition-all active:scale-95"
        >
          <MessageCircle className="w-6 h-6" />
          {hasUnread && (
            <span
              aria-hidden="true"
              className="absolute top-0 end-0 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white dark:border-slate-950"
            />
          )}
        </button>
      )}

      {isOpen && (
        <>
          {/* Dim backdrop — mobile sheet only; desktop stays fully visible/interactive behind the panel */}
          <div className="sm:hidden fixed inset-0 bg-slate-900/50 z-40" aria-hidden="true" />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('chat.title')}
            className="fixed inset-x-0 bottom-0 z-50 w-full h-[85vh] max-h-[720px] rounded-t-2xl sm:inset-auto sm:bottom-4 sm:end-4 sm:w-[360px] sm:h-[520px] sm:max-h-[calc(100vh-6rem)] sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {pane === 'thread' && (
                  <button
                    type="button"
                    onClick={() => setPane('list')}
                    aria-label={t('chat.backLabel')}
                    className={`p-1.5 -ms-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${direction === 'rtl' ? 'rotate-180' : ''}`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <MessageCircle className="w-4 h-4 text-brand-600 shrink-0" />
                {pane === 'thread' && selected ? (
                  (() => {
                    const other = selected.participants?.find((p: any) => p.userId !== currentUserId)?.user;
                    if (!other) return <span className="font-bold text-sm truncate">{t('chat.title')}</span>;
                    const status = deriveStatus(presence[other.id]);
                    return (
                      <span className="min-w-0">
                        <span className="font-bold text-sm truncate block">{other.name}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Circle className={`w-2 h-2 ${STATUS_DOT_CLASS[status]}`} aria-hidden="true" />
                          {status === 'offline' ? formatLastSeen(t, presence[other.id]) : t(`chat.${status}`)}
                        </span>
                      </span>
                    );
                  })()
                ) : (
                  <span className="font-bold text-sm truncate">{t('chat.title')}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t('chat.closeLabel')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* People / conversations list */}
            {pane === 'list' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="relative">
                    <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('chat.searchPlaceholder')}
                      className="w-full ps-9 pe-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
                  {contacts.length === 0 && (
                    <p className="text-center text-xs text-slate-400 p-6">{t('chat.noConversationsYet')}</p>
                  )}
                  {contacts.map((u: any) => {
                    const isSelected = selectedUserId === u.id;
                    const status = deriveStatus(presence[u.id]);
                    return (
                      <button
                        key={u.id}
                        onClick={() => start(u.id)}
                        aria-pressed={isSelected}
                        className={`w-full text-start p-2.5 rounded-xl flex items-center gap-3 border transition-colors ${
                          isSelected
                            ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700 shadow-sm'
                            : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`relative w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'
                          }`}
                        >
                          {u.name[0]}
                          <Circle
                            aria-label={t(`chat.${status}`)}
                            className={`absolute -bottom-0.5 -end-0.5 w-3 h-3 ${STATUS_DOT_CLASS[status]}`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-1">
                            <b className={`block text-xs truncate ${isSelected ? 'text-brand-700 dark:text-brand-300' : ''}`}>{u.name}</b>
                            {u.lastMessage && (
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {formatDate(u.lastMessage.createdAt, language)}
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate block">
                            {u.lastMessage ? u.lastMessage.content : u.email}
                          </span>
                        </span>
                        {u.unread && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                        {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" aria-label={t('chat.selectedLabel')} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conversation thread */}
            {pane === 'thread' && (
              <div className="flex-1 min-h-0 flex flex-col">
                {!selected ? (
                  <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-slate-400">
                    {t('chat.selectPrompt')}
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs ${
                          message.senderId === currentUserId ? 'ml-auto bg-brand-600 text-white' : 'mr-auto bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{message.content}</div>
                        <time className="text-[10px] opacity-70 block mt-0.5">
                          {new Date(message.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-JO' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
                <form onSubmit={send} className="p-2.5 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={4000}
                    disabled={!selected}
                    placeholder={t('chat.typePlaceholder')}
                    className="min-w-0 flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-xs outline-none"
                  />
                  <button
                    disabled={!selected || !text.trim()}
                    aria-label={t('chat.typePlaceholder')}
                    className="rounded-xl bg-brand-600 text-white px-3.5 disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
