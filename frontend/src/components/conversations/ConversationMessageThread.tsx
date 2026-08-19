"use client";

import { CheckCheck } from "lucide-react";
import { EmailMessageBubble } from "@/components/conversations/EmailMessageBubble";
import { ConversationDateDivider } from "@/components/conversations/conversation-ui";
import { useFormatters } from "@/hooks/useFormatters";
import { useLocale } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { Conversation, Message } from "@/types";

function messageListKey(msg: Message, index: number): string {
  return `${msg.messageId}::${msg.timestamp}::${index}`;
}

type Props = {
  messages?: Message[];
  conversation: Conversation;
  loading: boolean;
  loadingLabel: string;
};

export function ConversationMessageThread({
  messages,
  conversation,
  loading,
  loadingLabel,
}: Props) {
  const locale = useLocale();
  const { formatDate } = useFormatters();
  const intlLocale = locale === "en" ? "en-US" : "es-ES";

  function formatMessageTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(intlLocale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  let lastDateKey = "";

  return (
    <div className="relative flex-1 overflow-y-auto sidebar-scroll">
      <div className="conversations-chat-bg absolute inset-0" aria-hidden />
      <div className="relative z-0 space-y-1 px-4 py-4 sm:px-6">
        {loading && <p className="text-sm text-secondary">{loadingLabel}</p>}

        {messages?.map((msg, index) => {
          const listKey = messageListKey(msg, index);
          const isInbound = msg.role === "user";
          const isSystem = msg.role === "system";
          const isAdvisor = msg.role === "advisor";
          const isOutbound = !isInbound && !isSystem;

          if (isSystem) {
            return (
              <p key={listKey} className="py-2 text-center text-xs text-muted">
                {msg.content}
              </p>
            );
          }

          const dateKey = new Date(msg.timestamp).toDateString();
          const showDateDivider = dateKey !== lastDateKey;
          lastDateKey = dateKey;

          return (
            <div key={listKey}>
              {showDateDivider ? (
                <ConversationDateDivider label={formatDate(msg.timestamp)} />
              ) : null}
              <div
                className={cn(
                  "flex py-1",
                  isInbound ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={cn(
                    "max-w-[min(85%,28rem)] px-3 py-2 text-sm leading-relaxed sm:max-w-md",
                    isInbound
                      ? "conversations-wa-bubble-in text-primary"
                      : isAdvisor
                        ? "conversations-wa-bubble-out conversations-wa-bubble-advisor"
                        : "conversations-wa-bubble-out text-primary"
                  )}
                >
                  {conversation.channel === "email" && isInbound ? (
                    <EmailMessageBubble message={msg} botId={conversation.botId} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  <div
                    className={cn(
                      "mt-1 flex items-center gap-1",
                      isInbound ? "justify-start" : "justify-end"
                    )}
                  >
                    <p
                      className={cn(
                        "text-[10px] leading-none",
                        isInbound ? "text-muted" : "text-secondary"
                      )}
                    >
                      {formatMessageTime(msg.timestamp)}
                    </p>
                    {isOutbound ? (
                      <CheckCheck className="h-3 w-3 text-accent" aria-hidden />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
