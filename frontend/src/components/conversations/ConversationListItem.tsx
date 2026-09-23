"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConversationAvatar } from "@/components/conversations/conversation-ui";
import { useUnreadMessages } from "@/components/notifications/UnreadMessagesProvider";
import { WhatsAppRiskBadge } from "@/components/whatsapp/WhatsAppRiskBadge";
import { cn } from "@/lib/utils";
import { conversationHasMetaAdsAttribution } from "@/lib/meta-ads";
import { useT } from "@/i18n/context";
import type { Conversation, InboxSlaStatus, TenantWhatsAppRiskSummary } from "@/types";

type Props = {
  conversation: Conversation;
  selected: boolean;
  slaStatus: InboxSlaStatus;
  slaText: string | null;
  elapsedSeconds: number | null;
  elapsedLabel?: string;
  contactName: string;
  channelLabel: string;
  workflowLabel: string;
  categoryLabel?: string;
  relativeTime: string;
  advisorMode: boolean;
  showQueueClaim: boolean;
  showCheckbox: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  onSelect: () => void;
  onClaim: () => void;
  claimPending: boolean;
  modeHumanLabel: string;
  modeBotLabel: string;
  takeConversationLabel: string;
  whatsappRisk?: TenantWhatsAppRiskSummary | null;
};

export function ConversationListItem({
  conversation,
  selected,
  slaStatus,
  slaText,
  elapsedSeconds,
  elapsedLabel,
  contactName,
  channelLabel,
  workflowLabel,
  categoryLabel,
  relativeTime,
  advisorMode,
  showQueueClaim,
  showCheckbox,
  checked,
  onToggleCheck,
  onSelect,
  onClaim,
  claimPending,
  modeHumanLabel,
  modeBotLabel,
  takeConversationLabel,
  whatsappRisk,
}: Props) {
  const t = useT();
  const { getUnreadCount } = useUnreadMessages();
  const isHuman = (conversation.handoffMode ?? "bot") === "human";
  const hasMetaAdsAttribution = conversationHasMetaAdsAttribution(conversation);
  const unreadMessages = getUnreadCount(conversation.conversationId);
  const isUnread = unreadMessages > 0 || conversation.workflowStatus === "new";

  const previewParts = [
    channelLabel,
    conversation.channel === "whatsapp" && conversation.whatsappDisplayNumber
      ? conversation.whatsappDisplayNumber
      : null,
    isHuman ? modeHumanLabel : modeBotLabel,
    isHuman ? workflowLabel : null,
    conversation.interactionCategory ? categoryLabel : null,
    conversation.emailSubject,
    slaText,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "conversations-list-item flex items-stretch",
        selected && "conversations-list-selected",
        slaStatus === "breached" && !selected && "bg-danger/5",
        slaStatus === "at_risk" && !selected && "bg-warning/5"
      )}
    >
      {showCheckbox ? (
        <div className="flex items-center pl-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleCheck}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-default text-accent focus:ring-accent"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 px-3 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <ConversationAvatar
            contactName={conversation.contactName}
            phoneNumber={conversation.phoneNumber}
            participantId={conversation.participantId}
            channel={conversation.channel}
            unread={isUnread}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <p
                className={cn(
                  "truncate text-sm",
                  isUnread ? "font-semibold text-primary" : "font-medium text-primary"
                )}
              >
                {contactName}
              </p>
              <span
                className={cn(
                  "flex-shrink-0 text-[11px]",
                  isUnread ? "font-semibold text-accent" : "text-muted"
                )}
              >
                {relativeTime}
              </span>
            </div>
            <p className="truncate text-xs text-secondary">
              {previewParts.join(" · ")}
            </p>
            {hasMetaAdsAttribution ? (
              <div className="mt-1">
                <Badge variant="warning" className="text-[10px]">
                  {conversation.attribution?.source === "meta_ctwa"
                    ? t("ads.badgeCtwa")
                    : t("ads.badge")}
                </Badge>
              </div>
            ) : null}
            {conversation.interactionCategory && categoryLabel ? (
              <div className="mt-1">
                <Badge variant="info" className="text-[10px]">
                  {categoryLabel}
                </Badge>
              </div>
            ) : null}
            {whatsappRisk && whatsappRisk.risk !== "none" && whatsappRisk.risk !== "ok" ? (
              <div className="mt-1">
                <WhatsAppRiskBadge risk={whatsappRisk} compact />
              </div>
            ) : null}
            {elapsedSeconds !== null && elapsedLabel ? (
              <p className="mt-0.5 truncate text-[11px] font-medium text-warning">
                {elapsedLabel}
              </p>
            ) : null}
          </div>
          {isUnread ? (
            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
              {unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : 1}
            </span>
          ) : null}
        </div>
      </button>

      {advisorMode && showQueueClaim ? (
        <div className="flex items-center pr-3">
          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClaim();
            }}
            disabled={claimPending}
          >
            {takeConversationLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
