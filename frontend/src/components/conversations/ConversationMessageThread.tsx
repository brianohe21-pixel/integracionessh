"use client";

import { useEffect, useRef } from "react";
import { CheckCheck } from "lucide-react";
import { EmailMessageBubble } from "@/components/conversations/EmailMessageBubble";
import { AttachmentMessageBubble } from "@/components/conversations/AttachmentMessageBubble";
import { MessageReactions } from "@/components/conversations/MessageReactions";
import { ConversationDateDivider } from "@/components/conversations/conversation-ui";
import { useFormatters } from "@/hooks/useFormatters";
import { useLocale, useT } from "@/i18n/context";
import { isDocumentMessage } from "@/lib/conversations/document-messages";
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
      <p key={listKey} className="py-3 text-center text-xs text-muted">
        {msg.content}
      </p>
    );
  }

  return (
    <div
      className={cn("flex w-full", isInbound ? "justify-start pr-2 sm:pr-4" : "justify-end pl-2 sm:pl-4")}
    >
      <div className={cn("max-w-[min(82%,30rem)] sm:max-w-[min(76%,34rem)]", isInbound ? "" : "flex flex-col items-end")}>
        <div
          className={cn(
            "px-3.5 py-2 text-sm leading-snug",
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
          ) : isDocumentMessage(msg) ? (
            <AttachmentMessageBubble
              message={msg}
              conversationId={conversation.conversationId}
              botId={conversation.botId}
            />
          ) : (
            <p className="emoji-text whitespace-pre-wrap break-words">{msg.content}</p>
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
        <MessageReactions
          reactions={msg.reactions}
          align={isInbound ? "left" : "right"}
        />
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    function handleScroll() {
      if (!container) return;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 96;
    }

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [conversation.conversationId]);

  useEffect(() => {
    stickToBottomRef.current = true;
    const frame = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
    return () => cancelAnimationFrame(frame);
  }, [conversation.conversationId]);

  useEffect(() => {
    if (loading) return;

    const lastMessage = messages?.[messages.length - 1];
    const isOutgoing =
      lastMessage?.role === "advisor" || lastMessage?.role === "assistant";

    if (!stickToBottomRef.current && !isOutgoing) return;

    const frame = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        block: "end",
        behavior: isOutgoing ? "smooth" : "auto",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [messages, crossChannelMessages, loading]);

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
        <div key={listKey} className="py-1.5">
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
    <div
      ref={scrollContainerRef}
      className="relative flex min-h-0 flex-1 overflow-y-auto overscroll-contain conversations-pane-scroll"
    >
      <div className="conversations-thread relative z-0 w-full space-y-0">
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
        <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
      </div>
    </div>
  );
}
