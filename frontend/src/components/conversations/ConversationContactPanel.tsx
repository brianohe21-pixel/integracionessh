"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, History, Headphones, Lock, Mail, Phone, StickyNote, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelAvatar } from "@/components/conversations/conversation-ui";
import { ConversationOpportunityPanel } from "@/components/conversations/ConversationOpportunityPanel";
import { ConversationLeadPanel } from "@/components/conversations/ConversationLeadPanel";
import { useOpportunityByConversation } from "@/hooks/useSalesOpportunity";
import { WhatsAppRiskBadge } from "@/components/whatsapp/WhatsAppRiskBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ContentCardSection } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Input";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useClickToCall } from "@/hooks/useContactCenter";
import { useUpdateConversationCategory, useUpdateConversationNote } from "@/hooks/useConversations";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { interactionCategoryLabelKey } from "@/lib/interaction-categories";
import { resolveWhatsAppRisk, type WhatsAppRiskResponse } from "@/hooks/useWhatsAppRisk";
import { INTERACTION_CATEGORIES, type Channel, Conversation, InteractionCategory, Lead } from "@/types";

type PanelTab = "contact" | "sales" | "details";

type Props = {
  conversation: Conversation;
  activeLead?: Lead | null;
  onAssignAdvisor: () => void;
  channelLabel: (channel?: Channel) => string;
  locale: string;
  onCreateQuotation?: () => void;
  onCreateBooking?: () => void;
  showBooking?: boolean;
  whatsappRisk?: WhatsAppRiskResponse;
};

export function ConversationContactPanel({
  conversation,
  activeLead,
  onAssignAdvisor,
  channelLabel,
  locale,
  onCreateQuotation,
  onCreateBooking,
  showBooking = false,
  whatsappRisk,
}: Props) {
  const t = useT();
  const { formatDate, formatRelativeTime } = useFormatters();
  const { data: advisors } = useAdvisors();
  const { data: opportunity } = useOpportunityByConversation(conversation.conversationId);
  const clickToCall = useClickToCall();
  const updateNote = useUpdateConversationNote();
  const updateCategory = useUpdateConversationCategory();
  const [panelTab, setPanelTab] = useState<PanelTab>("sales");
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [internalNote, setInternalNote] = useState(conversation.internalNote ?? "");
  const [interactionCategory, setInteractionCategory] = useState<InteractionCategory | "">(
    conversation.interactionCategory ?? ""
  );

  useEffect(() => {
    setPanelTab(opportunity ? "sales" : "contact");
    setInternalNote(conversation.internalNote ?? "");
    setNoteExpanded(!(conversation.internalNote ?? "").trim());
  }, [conversation.conversationId, conversation.internalNote, opportunity]);

  useEffect(() => {
    setInternalNote(conversation.internalNote ?? "");
    setInteractionCategory(conversation.interactionCategory ?? "");
  }, [conversation.internalNote, conversation.interactionCategory]);

  const noteDirty = internalNote.trim() !== (conversation.internalNote ?? "").trim();

  async function handleSaveNote() {
    const nextNote = internalNote.trim();
    if (!nextNote && !(conversation.internalNote ?? "").trim()) return;
    await updateNote.mutateAsync({
      conversationId: conversation.conversationId,
      botId: conversation.botId,
      internalNote: nextNote,
    });
    setInternalNote(nextNote);
  }

  async function handleCategoryChange(value: InteractionCategory | "") {
    setInteractionCategory(value);
    if (!value || value === conversation.interactionCategory) return;
    await updateCategory.mutateAsync({
      conversationId: conversation.conversationId,
      botId: conversation.botId,
      interactionCategory: value,
    });
  }
  const assignedAdvisor = advisors?.find((a) => a.advisorId === conversation.assignedAdvisorId);
  const displayName =
    conversation.contactName ??
    ((conversation.channel ?? "whatsapp") === "whatsapp" ||
    conversation.channel === "sms" ||
    conversation.channel === "phone"
      ? conversation.phoneNumber || conversation.participantId
      : conversation.participantId ?? conversation.phoneNumber);

  const tags = activeLead?.tags ?? [];
  const isHuman = (conversation.handoffMode ?? "bot") === "human";
  const phone =
    (conversation.channel ?? "whatsapp") === "whatsapp" ||
    conversation.channel === "sms" ||
    conversation.channel === "phone"
      ? conversation.phoneNumber || conversation.participantId
      : null;
  const email =
    conversation.channel === "email"
      ? conversation.participantId
      : activeLead?.email;
  const isWhatsApp = (conversation.channel ?? "whatsapp") === "whatsapp";
  const botWhatsAppRisk = isWhatsApp
    ? resolveWhatsAppRisk(whatsappRisk, conversation.botId)
    : null;

  return (
    <aside className="conversations-sidebar-bg hidden w-80 min-h-0 flex-shrink-0 flex-col overflow-hidden border-l border-default xl:flex">
      <div className="border-b border-default px-4 pt-4">
        <Tabs<PanelTab>
          items={[
            { id: "sales", label: t("conversations.tabSales") },
            { id: "contact", label: t("conversations.tabContact") },
            { id: "details", label: t("conversations.tabDetails") },
          ]}
          value={panelTab}
          onChange={setPanelTab}
          className="w-full"
        />
      </div>

      <div className="conversations-sidebar-header border-b border-default px-4 py-4">
        <div className="flex items-start gap-3">
          <ChannelAvatar channel={conversation.channel} size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold tracking-tight text-primary">
              {displayName}
            </h2>
            {phone ? <p className="mt-0.5 truncate text-sm text-secondary">{phone}</p> : null}
            <p className="mt-0.5 text-xs text-muted">{channelLabel(conversation.channel)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={isHuman ? "warning" : "default"}>
                {isHuman ? t("conversations.modeHuman") : t("conversations.modeBot")}
              </Badge>
              {conversation.locale ? (
                <Badge variant="default" className="uppercase">
                  {conversation.locale}
                </Badge>
              ) : null}
              {isWhatsApp ? <WhatsAppRiskBadge risk={botWhatsAppRisk} iconOnly /> : null}
            </div>
            {phone ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2.5"
                onClick={() =>
                  void clickToCall.mutateAsync({ botId: conversation.botId, to: phone })
                }
                disabled={clickToCall.isPending}
              >
                <Phone className="h-3.5 w-3.5" />
                {t("contactCenter.clickToCall")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="conversations-pane-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        {panelTab === "sales" ? (
          <ConversationOpportunityPanel
            conversation={conversation}
            activeLead={activeLead}
            locale={locale}
            onCreateQuotation={onCreateQuotation}
            onCreateBooking={onCreateBooking}
            showBooking={showBooking}
          />
        ) : panelTab === "contact" ? (
          <>
            <ConversationLeadPanel conversation={conversation} activeLead={activeLead} />
            <ContentCardSection title={t("conversations.contactInfo")}>
              <div className="space-y-2.5 text-sm">
                {phone ? (
                  <div className="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5 text-secondary">
                    <Phone className="h-4 w-4 flex-shrink-0 text-muted" />
                    <span className="truncate">{phone}</span>
                  </div>
                ) : null}
                {email ? (
                  <div className="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5 text-secondary">
                    <Mail className="h-4 w-4 flex-shrink-0 text-muted" />
                    <span className="truncate">{email}</span>
                  </div>
                ) : null}
                {conversation.locale ? (
                  <div className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2.5">
                    <span className="text-muted">{t("conversations.language")}</span>
                    <span className="font-medium uppercase text-primary">{conversation.locale}</span>
                  </div>
                ) : null}
              </div>
            </ContentCardSection>

            {tags.length > 0 ? (
              <ContentCardSection title={t("conversations.tags")}>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="default">{tag}</Badge>
                  ))}
                </div>
              </ContentCardSection>
            ) : null}

            {assignedAdvisor ? (
              <ContentCardSection title={t("conversations.assignedAdvisor")}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted">
                    <User className="h-4 w-4 text-muted" />
                  </div>
                  <p className="text-sm font-medium text-primary">{assignedAdvisor.name}</p>
                </div>
              </ContentCardSection>
            ) : null}
          </>
        ) : (
          <>
            <section
              className={cn(
                "conversations-internal-note p-3.5",
                noteExpanded ? "space-y-3" : "space-y-0"
              )}
            >
              <button
                type="button"
                onClick={() => setNoteExpanded((open) => !open)}
                aria-expanded={noteExpanded}
                className="conversations-internal-note-header w-full text-left"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="conversations-internal-note-icon">
                    <StickyNote className="h-3.5 w-3.5" />
                  </span>
                  <span className="block text-sm font-semibold tracking-tight">
                    {t("conversations.internalNote")}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="conversations-internal-note-badge">
                    <Lock className="h-3 w-3" />
                    {noteDirty
                      ? t("conversations.noteUnsaved")
                      : internalNote.trim()
                        ? t("conversations.noteSaved")
                        : t("conversations.internalNoteEmpty")}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 opacity-70 transition-transform duration-200",
                      noteExpanded && "rotate-180"
                    )}
                  />
                </div>
              </button>

              {!noteExpanded && internalNote.trim() ? (
                <p className="conversations-internal-note-preview mt-2.5">
                  {internalNote.trim()}
                </p>
              ) : null}

              {noteExpanded ? (
                <>
                  <Textarea
                    id="contact-internal-note"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={3}
                    placeholder={t("conversations.internalNotePlaceholder")}
                    className="conversations-internal-note-textarea border-none bg-transparent shadow-none focus:ring-0"
                  />
                  <div className="conversations-internal-note-footer">
                    <p className="flex items-center gap-1.5 text-[11px] opacity-70">
                      <Lock className="h-3 w-3 shrink-0" />
                      {t("conversations.internalNoteHint")}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveNote}
                      disabled={updateNote.isPending || !noteDirty}
                      className="conversations-internal-note-save shrink-0"
                    >
                      {noteDirty || updateNote.isPending ? (
                        t("conversations.saveNote")
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          {t("conversations.noteSaved")}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : null}
            </section>

            <ContentCardSection title={t("conversations.categoryLabel")}>
              <Select
                value={interactionCategory}
                onChange={(e) => void handleCategoryChange(e.target.value as InteractionCategory | "")}
                disabled={updateCategory.isPending}
              >
                <option value="">{t("conversations.categorySelectPlaceholder")}</option>
                {INTERACTION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(interactionCategoryLabelKey(category))}
                  </option>
                ))}
              </Select>
            </ContentCardSection>

            <ContentCardSection title={t("conversations.history")}>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-secondary">{t("conversations.messageCount", { count: conversation.messageCount })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">{t("conversations.firstContact")}</span>
                  <span className="font-medium text-primary">{formatDate(conversation.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">{t("conversations.lastActivity")}</span>
                  <span className="font-medium text-primary">{formatRelativeTime(conversation.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">{t("conversations.source")}</span>
                  <span className="font-medium text-primary">{channelLabel(conversation.channel)}</span>
                </div>
              </div>
            </ContentCardSection>
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-default p-4">
        {!isHuman ? (
          <Button type="button" className="w-full" onClick={onAssignAdvisor}>
            <Headphones className="h-4 w-4" />
            {t("conversations.assignAdvisor")}
          </Button>
        ) : null}
        <Link href="/leads" className="block">
          <Button type="button" variant="secondary" className="w-full">
            <History className="h-4 w-4" />
            {t("conversations.viewFullHistory")}
          </Button>
        </Link>
      </div>
    </aside>
  );
}
