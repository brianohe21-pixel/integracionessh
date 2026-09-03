"use client";

import { useState } from "react";
import { MessageSquare, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Tabs } from "@/components/ui/Tabs";
import { ConversationListItem } from "@/components/conversations/ConversationListItem";
import { resolveWhatsAppRisk } from "@/hooks/useWhatsAppRisk";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { Bot, Advisor, Channel, Conversation, InboxSlaStatus, WorkflowStatus, InteractionCategory } from "@/types";
import { INTERACTION_CATEGORIES } from "@/types";
import { interactionCategoryLabelKey } from "@/lib/interaction-categories";
import type { WhatsAppRiskResponse } from "@/hooks/useWhatsAppRisk";

type ListTab = "all" | "unread" | "mine" | "sla_breached" | "queue";

type Props = {
  advisorMode: boolean;
  listTab: ListTab;
  onListTabChange: (tab: ListTab) => void;
  unreadCount: number;
  slaBreachedCount: number;
  slaEnabled: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  botFilter: string;
  onBotFilterChange: (v: string) => void;
  channelFilter: "" | Channel;
  onChannelFilterChange: (v: "" | Channel) => void;
  whatsappChannelFilter: string;
  onWhatsappChannelFilterChange: (v: string) => void;
  handoffFilter: "" | "human" | "bot";
  onHandoffFilterChange: (v: "" | "human" | "bot") => void;
  workflowFilter: "" | WorkflowStatus;
  onWorkflowFilterChange: (v: "" | WorkflowStatus) => void;
  categoryFilter: "" | InteractionCategory;
  onCategoryFilterChange: (v: "" | InteractionCategory) => void;
  categoryLabel: (category?: InteractionCategory) => string;
  advisorFilter: string;
  onAdvisorFilterChange: (v: string) => void;
  assignmentFilter: "" | "unassigned";
  onAssignmentFilterChange: (v: "" | "unassigned") => void;
  bots?: Bot[];
  advisors?: Advisor[];
  conversations: Conversation[];
  filteredConversations: Conversation[];
  conversationSlaStatuses: Map<string, InboxSlaStatus>;
  selectedId: string | null;
  onSelectId: (id: string) => void;
  selectedConversationIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleSelectAll: () => void;
  onBulkReassign: () => void;
  onBulkDelete: () => void;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  listScrollRef: React.RefObject<HTMLDivElement | null>;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  formatRelativeTime: (date: string) => string;
  contactDisplay: (conv: Conversation) => string | undefined;
  channelLabel: (channel?: Channel) => string;
  workflowLabel: (status?: WorkflowStatus) => string;
  slaLabel: (status: InboxSlaStatus) => string | null;
  formatElapsed: (seconds: number) => string;
  getElapsedSeconds: (handoffAt: string) => number | null;
  onClaimFromQueue: (conv: Conversation) => Promise<void>;
  claimPending: boolean;
  showOnMobile: boolean;
  whatsappRisk?: WhatsAppRiskResponse;
};

export function ConversationListSidebar({
  advisorMode,
  listTab,
  onListTabChange,
  unreadCount,
  slaBreachedCount,
  slaEnabled,
  searchQuery,
  onSearchChange,
  botFilter,
  onBotFilterChange,
  channelFilter,
  onChannelFilterChange,
  whatsappChannelFilter,
  onWhatsappChannelFilterChange,
  handoffFilter,
  onHandoffFilterChange,
  workflowFilter,
  onWorkflowFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categoryLabel,
  advisorFilter,
  onAdvisorFilterChange,
  assignmentFilter,
  onAssignmentFilterChange,
  bots,
  advisors,
  filteredConversations,
  conversationSlaStatuses,
  selectedId,
  onSelectId,
  selectedConversationIds,
  onToggleSelection,
  onToggleSelectAll,
  onBulkReassign,
  onBulkDelete,
  isLoading,
  isFetchingNextPage,
  listScrollRef,
  loadMoreRef,
  formatRelativeTime,
  contactDisplay,
  channelLabel,
  workflowLabel,
  slaLabel,
  formatElapsed,
  getElapsedSeconds,
  onClaimFromQueue,
  claimPending,
  showOnMobile,
  whatsappRisk,
}: Props) {
  const t = useT();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const whatsappFilterBotId = botFilter || (bots?.length === 1 ? bots[0]?.botId : "");
  const { data: whatsappChannels = [] } = useWhatsAppChannels(whatsappFilterBotId, {
    enabled: channelFilter === "whatsapp" && Boolean(whatsappFilterBotId),
  });

  const activeFilterCount = [
    botFilter,
    channelFilter,
    whatsappChannelFilter,
    handoffFilter,
    workflowFilter,
    categoryFilter,
    advisorFilter,
    assignmentFilter,
  ].filter(Boolean).length;

  return (
    <div
      className={cn(
        "conversations-sidebar-bg flex w-full min-h-0 flex-col overflow-hidden border-r border-default lg:w-[min(100%,22rem)] lg:flex-shrink-0",
        showOnMobile ? "flex" : "hidden lg:flex"
      )}
    >
      <div className="conversations-sidebar-header border-b border-default px-4 py-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-primary">
              {advisorMode ? t("inbox.title") : t("conversations.title")}
            </h1>
            <p className="mt-0.5 text-xs text-secondary">
              {t("conversations.listCount", { count: filteredConversations.length })}
            </p>
          </div>
          {!advisorMode ? (
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                filtersOpen || activeFilterCount > 0
                  ? "border-accent/30 bg-accent-muted text-accent"
                  : "border-default bg-surface-muted text-secondary hover:bg-surface-elevated hover:text-primary"
              )}
              aria-label={t("conversations.filters")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>

        <SearchInput
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange("")}
          placeholder={t("conversations.searchPlaceholder")}
          className="mb-3 mt-3"
        />

        <Tabs<ListTab>
          variant="vibrant"
          items={[
            { id: "all", label: t("conversations.filterTabAll") },
            { id: "unread", label: t("conversations.filterTabUnread"), count: unreadCount },
            { id: "mine", label: t("conversations.filterTabMine") },
            ...(advisorMode
              ? ([{ id: "queue" as const, label: t("conversations.filterTabQueue") }] as const)
              : []),
            ...(slaEnabled
              ? ([
                  {
                    id: "sla_breached" as const,
                    label: t("conversations.filterTabSlaBreached"),
                    count: slaBreachedCount,
                  },
                ] as const)
              : []),
          ]}
          value={listTab}
          onChange={onListTabChange}
          className="w-full"
        />
      </div>

      {(filtersOpen || advisorMode) && (
        <div className="space-y-2 border-b border-default bg-surface-muted/50 px-4 py-3">
          {!advisorMode && (
            <Select value={botFilter} onChange={(e) => onBotFilterChange(e.target.value)}>
              <option value="">{t("conversations.allBots")}</option>
              {bots?.map((bot) => (
                <option key={bot.botId} value={bot.botId}>{bot.name}</option>
              ))}
            </Select>
          )}
          <Select
            value={channelFilter}
            onChange={(e) => {
              const next = e.target.value as "" | Channel;
              onChannelFilterChange(next);
              if (next !== "whatsapp") {
                onWhatsappChannelFilterChange("");
              }
            }}
          >
            <option value="">{t("conversations.filterChannelAll")}</option>
            <option value="whatsapp">{t("conversations.channelWhatsapp")}</option>
            <option value="instagram">{t("conversations.channelInstagram")}</option>
            <option value="webchat">{t("conversations.channelWebchat")}</option>
            <option value="telegram">{t("conversations.channelTelegram")}</option>
            <option value="messenger">{t("conversations.channelMessenger")}</option>
            <option value="sms">{t("conversations.channelSms")}</option>
            <option value="email">{t("conversations.channelEmail")}</option>
            <option value="voicebot">{t("conversations.channelVoicebot")}</option>
            <option value="phone">{t("conversations.channelPhone")}</option>
          </Select>
          {channelFilter === "whatsapp" && whatsappFilterBotId ? (
            <Select
              value={whatsappChannelFilter}
              onChange={(e) => onWhatsappChannelFilterChange(e.target.value)}
            >
              <option value="">{t("conversations.filterWhatsappNumberAll")}</option>
              {whatsappChannels.map((channel) => (
                <option key={channel.channelId} value={channel.channelId}>
                  {channel.displayPhoneNumber?.trim() || channel.label || channel.phoneNumberId}
                </option>
              ))}
            </Select>
          ) : null}
          {channelFilter === "whatsapp" && !whatsappFilterBotId ? (
            <p className="text-xs text-secondary">{t("conversations.filterWhatsappNumberHint")}</p>
          ) : null}
          <Select
            value={handoffFilter}
            onChange={(e) => onHandoffFilterChange(e.target.value as "" | "human" | "bot")}
          >
            <option value="">{t("conversations.filterAll")}</option>
            <option value="human">{t("conversations.filterHuman")}</option>
            <option value="bot">{t("conversations.filterBot")}</option>
          </Select>
          {handoffFilter === "human" && (
            <Select
              value={workflowFilter}
              onChange={(e) => onWorkflowFilterChange(e.target.value as "" | WorkflowStatus)}
            >
              <option value="">{t("conversations.filterWorkflowAll")}</option>
              <option value="new">{t("conversations.filterWorkflowNew")}</option>
              <option value="open">{t("conversations.filterWorkflowOpen")}</option>
              <option value="pending">{t("conversations.filterWorkflowPending")}</option>
              <option value="resolved">{t("conversations.filterWorkflowResolved")}</option>
            </Select>
          )}
          <Select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value as "" | InteractionCategory)}
          >
            <option value="">{t("conversations.filterCategoryAll")}</option>
            {INTERACTION_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(interactionCategoryLabelKey(category))}
              </option>
            ))}
          </Select>
          {!advisorMode && (
            <Select value={advisorFilter} onChange={(e) => onAdvisorFilterChange(e.target.value)}>
              <option value="">{t("conversations.filterAdvisorAll")}</option>
              {advisors
                ?.filter((a) => a.status === "active")
                .map((a) => (
                  <option key={a.advisorId} value={a.advisorId}>{a.name}</option>
                ))}
            </Select>
          )}
          {!advisorMode && (
            <Select
              value={assignmentFilter}
              onChange={(e) => onAssignmentFilterChange(e.target.value as "" | "unassigned")}
            >
              <option value="">{t("conversations.filterAll")}</option>
              <option value="unassigned">{t("conversations.filterUnassigned")}</option>
            </Select>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onBotFilterChange("");
                onChannelFilterChange("");
                onWhatsappChannelFilterChange("");
                onHandoffFilterChange("");
                onWorkflowFilterChange("");
                onCategoryFilterChange("");
                onAdvisorFilterChange("");
                onAssignmentFilterChange("");
              }}
              className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover"
            >
              <X className="h-3 w-3" />
              {t("conversations.clearFilters")}
            </button>
          )}
          {!advisorMode && filteredConversations.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-secondary">
              <input
                type="checkbox"
                checked={
                  filteredConversations.length > 0 &&
                  selectedConversationIds.size === filteredConversations.length
                }
                onChange={onToggleSelectAll}
                className="rounded border-default"
              />
              {t("conversations.selectAll")}
            </label>
          )}
        </div>
      )}

      {!advisorMode && selectedConversationIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-default bg-accent-muted/50 px-4 py-2.5">
          <Badge variant="accent">
            {t("conversations.bulkSelected", { count: selectedConversationIds.size })}
          </Badge>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onBulkDelete}>
              {t("conversations.bulkDelete")}
            </Button>
            <Button type="button" size="sm" onClick={onBulkReassign}>
              {t("conversations.bulkReassign")}
            </Button>
          </div>
        </div>
      )}

      <div ref={listScrollRef} className="conversations-pane-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
        {isLoading && (
          <div className="flex flex-col gap-2 px-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        )}

        {!isLoading && filteredConversations.length === 0 && (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" />}
            title={t("conversations.emptyTitle")}
            description={t("conversations.emptyDescription")}
            className="m-3 py-12"
          />
        )}

        {filteredConversations.map((conv) => {
          const slaStatus = conversationSlaStatuses.get(conv.conversationId) ?? "disabled";
          const slaText = slaLabel(slaStatus);
          const elapsedSeconds =
            (conv.handoffMode ?? "bot") === "human" && conv.handoffAt && !conv.firstHumanResponseAt
              ? getElapsedSeconds(conv.handoffAt)
              : null;

          return (
            <ConversationListItem
              key={conv.conversationId}
              conversation={conv}
              selected={selectedId === conv.conversationId}
              slaStatus={slaStatus}
              slaText={slaText}
              elapsedSeconds={elapsedSeconds}
              elapsedLabel={
                elapsedSeconds !== null
                  ? t("conversations.slaElapsed", {
                      duration: formatElapsed(elapsedSeconds),
                    })
                  : undefined
              }
              contactName={contactDisplay(conv) ?? conv.phoneNumber}
              channelLabel={channelLabel(conv.channel)}
              workflowLabel={workflowLabel(conv.workflowStatus)}
              categoryLabel={categoryLabel(conv.interactionCategory)}
              relativeTime={formatRelativeTime(conv.lastMessageAt)}
              advisorMode={advisorMode}
              showQueueClaim={listTab === "queue"}
              showCheckbox={!advisorMode}
              checked={selectedConversationIds.has(conv.conversationId)}
              onToggleCheck={() => onToggleSelection(conv.conversationId)}
              onSelect={() => onSelectId(conv.conversationId)}
              onClaim={() => onClaimFromQueue(conv)}
              claimPending={claimPending}
              modeHumanLabel={t("conversations.modeHuman")}
              modeBotLabel={t("conversations.modeBot")}
              takeConversationLabel={t("conversations.takeConversation")}
              whatsappRisk={
                (conv.channel ?? "whatsapp") === "whatsapp"
                  ? resolveWhatsAppRisk(whatsappRisk, conv.botId)
                  : null
              }
            />
          );
        })}

        <div ref={loadMoreRef} className="h-1" />
        {isFetchingNextPage && (
          <p className="p-4 text-center text-sm text-muted">{t("common.loading")}</p>
        )}
      </div>
    </div>
  );
}
