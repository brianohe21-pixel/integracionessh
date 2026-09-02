"use client";

import { CheckCheck } from "lucide-react";
import { EmailMessageBubble } from "@/components/conversations/EmailMessageBubble";
import { ConversationDateDivider } from "@/components/conversations/conversation-ui";
import { useFormatters } from "@/hooks/useFormatters";
import { useLocale, useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { Channel, Conversation, CrossChannelMessage, Message } from "@/types";

function messageListKey(msg: Message, index: number): string {
  return `${msg.messageId}::${msg.timestamp}::${index}`;
}

type Props = {
  messages?: Message[];
  crossChannelMessages?: CrossChannelMessage[];
  conversation: Conversation;
  loading: boolean;
  loadingLabel: string;
  channelLabel: (channel?: Channel) => string;
};

function renderMessageBubble(params: {
  msg: Message;
  listKey: string;
  conversation: Conversation;
  formatMessageTime: (iso: string) => string;
  channelBadge?: string;
}) {
  const { msg, listKey, conversation, formatMessageTime, channelBadge } = params;
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

  return (
    <div
      className={cn("flex py-1", isInbound ? "justify-start" : "justify-end")}
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
        {channelBadge ? (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            {channelBadge}
          </p>
        ) : null}
        {conversation.channel === "email" && isInbound && !channelBadge ? (
          <EmailMessageBubble message={msg} botId={conversation.botId} />
        ) : msg.channel === "email" && isInbound ? (
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
  );
}

export function ConversationMessageThread({
  messages,
  crossChannelMessages,
  conversation,
  loading,
  loadingLabel,
  channelLabel,
}: Props) {
  const locale = useLocale();
  const t = useT();
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

  function renderWithDividers(items: Message[], withChannelBadge: boolean) {
    return items.map((msg, index) => {
      const listKey = messageListKey(msg, index);
      const isSystem = msg.role === "system";
      const dateKey = new Date(msg.timestamp).toDateString();
      const showDateDivider = !isSystem && dateKey !== lastDateKey;
      if (!isSystem) lastDateKey = dateKey;

      const crossMsg = withChannelBadge
        ? (msg as CrossChannelMessage)
        : undefined;

      return (
        <div key={listKey}>
          {showDateDivider ? (
            <ConversationDateDivider label={formatDate(msg.timestamp)} />
          ) : null}
          {renderMessageBubble({
            msg,
            listKey,
            conversation,
            formatMessageTime,
            channelBadge: crossMsg
              ? channelLabel(crossMsg.originChannel)
              : undefined,
          })}
        </div>
      );
    });
  }

  const hasCrossChannel = (crossChannelMessages?.length ?? 0) > 0;

  return (
    <div className="relative flex min-h-0 flex-1 overflow-y-auto overscroll-contain conversations-pane-scroll">
      <div className="relative z-0 space-y-1 px-4 py-4 sm:px-6">
        {loading && <p className="text-sm text-secondary">{loadingLabel}</p>}

        {hasCrossChannel ? (
          <>
            <p className="py-2 text-center text-xs font-medium text-secondary">
              {t("conversations.crossChannelHistory")}
            </p>
            {renderWithDividers(crossChannelMessages ?? [], true)}
            <p className="py-3 text-center text-xs font-medium text-secondary">
              {t("conversations.currentChannelHistory", {
                channel: channelLabel(conversation.channel),
              })}
            </p>
          </>
        ) : null}

        {messages?.length
          ? renderWithDividers(messages, false)
          : !loading && !hasCrossChannel ? (
              <p className="py-6 text-center text-sm text-muted">
                {t("conversations.noMessages")}
              </p>
            ) : null}
      </div>
    </div>
  );
}
