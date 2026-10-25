"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Circle, MessageCircle, Send, UsersRound } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  getChatConversationAction,
  getChatDataAction,
  markChatReadAction,
  sendChatMessageAction,
  startGroupChatAction,
  startChatAction,
} from "@/server/actions/chat";

export function ChatClient({
  currentUserId,
  compact = false,
}: {
  currentUserId: string;
  compact?: boolean;
}) {
  const { language, direction } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [text, setText] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");
  const [openingGroupId, setOpeningGroupId] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");

  const load = async () => {
    const data = await getChatDataAction();
    setUsers(data.users);
    setConversations(data.conversations);
    setGroups(data.groups || []);
  };
  useEffect(() => {
    load();
    const stream = new EventSource("/api/chat/stream");
    stream.onmessage = (event) => setConversations(JSON.parse(event.data));
    return () => stream.close();
  }, []);
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    let active = true;
    setMessagesLoading(true);
    getChatConversationAction(selected.id)
      .then((data) => {
        if (active) setMessages(data?.messages || []);
      })
      .finally(() => {
        if (active) setMessagesLoading(false);
      });
    void markChatReadAction(selected.id);

    return () => {
      active = false;
    };
  }, [selected]);
  const others = useMemo(
    () => users.filter((user) => user.id !== currentUserId),
    [users, currentUserId],
  );
  const start = async (otherUserId: string) => {
    setSelectedUserId(otherUserId);
    const conversation = await startChatAction(otherUserId);
    await load();
    setSelected(conversation);
    setMobilePane("thread");
  };
  const startGroup = async (groupId: string) => {
    if (openingGroupId) return;
    setOpeningGroupId(groupId);
    setSendError("");
    try {
      const conversation = await startGroupChatAction(groupId);
      setSelectedUserId(null);
      setSelected(conversation);
      setMessages([]);
      setMobilePane("thread");
      void load();
    } catch (error: any) {
      setSendError(error?.message || (language === "ar" ? "تعذر فتح المجموعة." : "Could not open the group."));
    } finally {
      setOpeningGroupId(null);
    }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !text.trim()) return;
    setSendError("");
    try {
      const message = await sendChatMessageAction(selected.id, text);
      setMessages((previous) => [...previous, message]);
      setText("");
      await load();
    } catch (error: any) {
      setSendError(error?.message || (language === "ar" ? "تعذر إرسال الرسالة." : "Could not send the message."));
    }
  };

  const canSendToSelected = !selected?.messageGroup
    || selected.messageGroup.canMembersSend
    || selected.messageGroup.createdById === currentUserId;

  return (
    <div
      className={`${compact ? "h-[min(42rem,calc(100vh-1.5rem))] min-h-0" : "h-[calc(100vh-7rem)] min-h-[500px]"} grid grid-cols-1 md:grid-cols-[18rem_1fr] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden`}
    >
      <aside
        className={`${mobilePane === "thread" ? "hidden" : "block"} md:block border-b md:border-b-0 md:border-e border-slate-200 dark:border-slate-800 overflow-y-auto`}
      >
        <div className="p-4 font-bold flex items-center gap-2">
          <MessageCircle className="text-brand-600" />
          {language === "ar" ? "المحادثة الفورية" : "Live Chat"}
        </div>
        {groups.length > 0 && (
          <section className="px-3 pb-3">
            <div className="flex items-center gap-2 px-2 pb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <UsersRound className="w-4 h-4 text-brand-600" />
              <span>{language === "ar" ? "مجموعات الفريق" : "Team groups"}</span>
              <span className="ms-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">{groups.length}</span>
            </div>
            <div className="space-y-1">
              {groups.map((group: any) => (
                <button type="button" key={group.id} disabled={openingGroupId !== null} onClick={() => void startGroup(group.id)} className="w-full rounded-xl border border-brand-100 bg-brand-50/50 p-3 text-start transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70 dark:border-brand-900/50 dark:bg-brand-950/20 dark:hover:border-brand-700 dark:hover:bg-brand-950/40">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200">
                      <UsersRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <b className="block truncate text-sm text-slate-800 dark:text-slate-100">{group.name}</b>
                      <small className="block truncate text-slate-400">
                        {group.members?.length || 0} {language === "ar" ? "أعضاء" : "members"}
                        {group.members?.length ? ` · ${group.members.slice(0, 3).map((member: any) => member.user?.name).filter(Boolean).join(", ")}` : ""}
                      </small>
                      <small className="mt-1 block text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                        {group.canMembersSend ? (language === "ar" ? "الأعضاء يستطيعون الإرسال" : "Members can send") : (language === "ar" ? "للقراءة فقط" : "Read-only")}
                      </small>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="border-t border-slate-100 px-3 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2 px-2 pb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <MessageCircle className="w-4 h-4 text-brand-600" />
            <span>{language === "ar" ? "المحادثات الفردية" : "Individual conversations"}</span>
            <span className="ms-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{others.length}</span>
          </div>
          <div className="space-y-1">
          {others.map((user) => {
            const isSelected = selectedUserId === user.id;
            return (
              <button
                key={user.id}
                onClick={() => start(user.id)}
                aria-pressed={isSelected}
                className={`w-full text-start p-3 rounded-xl flex items-center gap-3 border transition-colors ${isSelected ? "bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700 shadow-sm" : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              >
                <span
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center font-bold ${isSelected ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700"}`}
                >
                  {user.name[0]}
                  <Circle className="absolute -bottom-0.5 -end-0.5 w-3 h-3 fill-emerald-500 text-white" />
                </span>
                <span className="min-w-0 flex-1">
                  <b
                    className={`block text-sm truncate ${isSelected ? "text-brand-700 dark:text-brand-300" : ""}`}
                  >
                    {user.name}
                  </b>
                  <small className="text-slate-400 truncate block">
                    {user.email}
                  </small>
                </span>
                {isSelected && (
                  <Check
                    className="w-4 h-4 text-brand-600 shrink-0"
                    aria-label={language === "ar" ? "تم الاختيار" : "Selected"}
                  />
                )}
              </button>
            );
          })}
          </div>
        </div>
      </aside>
      <section
        className={`${mobilePane === "list" ? "hidden" : "flex"} md:flex min-w-0 flex-col`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobilePane("list")}
            aria-label={language === "ar" ? "رجوع" : "Back"}
            className={`md:hidden p-2.5 -ms-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${direction === "rtl" ? "rotate-180" : ""}`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <span className="truncate">
            {selected?.messageGroup
              ? selected.messageGroup.name
              : selected
              ? selected.participants?.find(
                  (participant: any) => participant.userId !== currentUserId,
                )?.user?.name
                  || users.find((user) => user.id === selectedUserId)?.name
                  || (language === "ar" ? "محادثة" : "Conversation")
              : language === "ar"
                ? "اختر عضوًا لبدء المحادثة"
                : "Select a teammate to start"}
          </span>
          {selected?.messageGroup && !selected.messageGroup.canMembersSend && (
            <span className="ms-auto shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {language === "ar" ? "للقراءة فقط" : "Read-only"}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {sendError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{sendError}</p>}
          {!selected ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <MessageCircle className="h-6 w-6" />
              </span>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {language === "ar" ? "اختر محادثة لعرضها" : "Select a conversation"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {language === "ar" ? "اختر مجموعة أو عضوًا من القائمة لفتح المحادثة." : "Choose a group or teammate from the list to open a chat."}
              </p>
            </div>
          ) : messagesLoading ? (
            <div className="flex h-full min-h-40 items-center justify-center text-sm text-slate-400">
              {language === "ar" ? "جاري تحميل المحادثة..." : "Loading conversation..."}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                <MessageCircle className="h-6 w-6" />
              </span>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {language === "ar" ? "لا توجد رسائل بعد" : "No messages yet"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {language === "ar" ? "ابدأ المحادثة بإرسال أول رسالة." : "Start the conversation by sending the first message."}
              </p>
            </div>
          ) : messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${message.senderId === currentUserId ? "ms-auto bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
              >
                {selected?.messageGroup && <div className="mb-1 text-[11px] font-bold opacity-75">{message.sender?.name || (language === "ar" ? "عضو الفريق" : "Team member")}</div>}
                <div>{message.content}</div>
                <time className="text-[10px] opacity-70">
                  {new Date(message.createdAt).toLocaleString(
                    language === "ar" ? "ar-JO" : "en-US",
                  )}
                </time>
              </div>
            ))}
        </div>
        <form
          onSubmit={send}
          className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2"
        >
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={4000}
            disabled={!selected || !canSendToSelected}
            placeholder={
              !canSendToSelected ? (language === "ar" ? "هذه المجموعة للقراءة فقط" : "This group is read-only") : language === "ar" ? "اكتب رسالة..." : "Type a message..."
            }
            className="min-w-0 flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm outline-none"
          />
          <button
            disabled={!selected || !canSendToSelected || !text.trim()}
            className="rounded-xl bg-brand-600 text-white px-4 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
