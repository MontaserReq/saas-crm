'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Circle, MessageCircle, Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { getChatConversationAction, getChatDataAction, markChatReadAction, sendChatMessageAction, startChatAction } from '@/server/actions/chat';

export function ChatClient({ currentUserId, compact = false }: { currentUserId: string; compact?: boolean }) {
  const { language, direction } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [mobilePane, setMobilePane] = useState<'list' | 'thread'>('list');

  const load = async () => { const data = await getChatDataAction(); setUsers(data.users); setConversations(data.conversations); };
  useEffect(() => { load(); const stream = new EventSource('/api/chat/stream'); stream.onmessage = event => setConversations(JSON.parse(event.data)); return () => stream.close(); }, []);
  useEffect(() => { if (!selected) return; getChatConversationAction(selected.id).then(data => setMessages(data?.messages || [])); markChatReadAction(selected.id); }, [selected]);
  const others = useMemo(() => users.filter(user => user.id !== currentUserId), [users, currentUserId]);
  const start = async (otherUserId: string) => { setSelectedUserId(otherUserId); const conversation = await startChatAction(otherUserId); await load(); setSelected(conversation); setMobilePane('thread'); };
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!selected || !text.trim()) return; const message = await sendChatMessageAction(selected.id, text); setMessages(previous => [...previous, message]); setText(''); await load(); };

  return <div className={`${compact ? 'h-[min(42rem,calc(100vh-1.5rem))] min-h-0' : 'h-[calc(100vh-7rem)] min-h-[500px]'} grid grid-cols-1 md:grid-cols-[18rem_1fr] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden`}>
    <aside className={`${mobilePane === 'thread' ? 'hidden' : 'block'} md:block border-b md:border-b-0 md:border-e border-slate-200 dark:border-slate-800 overflow-y-auto`}><div className="p-4 font-bold flex items-center gap-2"><MessageCircle className="text-brand-600" />{language === 'ar' ? 'المحادثة الفورية' : 'Live Chat'}</div><div className="px-3 space-y-1">{others.map(user => { const isSelected = selectedUserId === user.id; return <button key={user.id} onClick={() => start(user.id)} aria-pressed={isSelected} className={`w-full text-start p-3 rounded-xl flex items-center gap-3 border transition-colors ${isSelected ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700 shadow-sm' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}><span className={`relative w-9 h-9 rounded-full flex items-center justify-center font-bold ${isSelected ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'}`}>{user.name[0]}<Circle className="absolute -bottom-0.5 -end-0.5 w-3 h-3 fill-emerald-500 text-white" /></span><span className="min-w-0 flex-1"><b className={`block text-sm truncate ${isSelected ? 'text-brand-700 dark:text-brand-300' : ''}`}>{user.name}</b><small className="text-slate-400 truncate block">{user.email}</small></span>{isSelected && <Check className="w-4 h-4 text-brand-600 shrink-0" aria-label={language === 'ar' ? 'تم الاختيار' : 'Selected'} />}</button>; })}</div></aside>
    <section className={`${mobilePane === 'list' ? 'hidden' : 'flex'} md:flex min-w-0 flex-col`}><div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold flex items-center gap-2"><button type="button" onClick={() => setMobilePane('list')} aria-label={language === 'ar' ? 'رجوع' : 'Back'} className={`md:hidden p-2.5 -ms-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${direction === 'rtl' ? 'rotate-180' : ''}`}><ArrowRight className="w-4 h-4" /></button><span className="truncate">{selected ? (selected.participants?.find((participant: any) => participant.userId !== currentUserId)?.user?.name || 'Conversation') : (language === 'ar' ? 'اختر عضوًا لبدء المحادثة' : 'Select a teammate to start')}</span></div><div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">{messages.map(message => <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${message.senderId === currentUserId ? 'ms-auto bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}><div>{message.content}</div><time className="text-[10px] opacity-70">{new Date(message.createdAt).toLocaleString(language === 'ar' ? 'ar-JO' : 'en-US')}</time></div>)}</div><form onSubmit={send} className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2"><input value={text} onChange={event => setText(event.target.value)} maxLength={4000} disabled={!selected} placeholder={language === 'ar' ? 'اكتب رسالة...' : 'Type a message...'} className="min-w-0 flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm outline-none" /><button disabled={!selected || !text.trim()} className="rounded-xl bg-brand-600 text-white px-4 disabled:opacity-50"><Send className="w-4 h-4" /></button></form></section>
  </div>;
}
