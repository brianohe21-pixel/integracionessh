"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Headphones, Lock, Mail, Phone, User } from "lucide-react";
import { ChannelAvatar } from "@/components/conversations/conversation-ui";
import { ConversationOpportunityPanel } from "@/components/conversations/ConversationOpportunityPanel";
import { useOpportunityByConversation } from "@/hooks/useSalesOpportunity";
import { WhatsAppRiskBadge } from "@/components/whatsapp/WhatsAppRiskBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ContentCardSection } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useClickToCall } from "@/hooks/useContactCenter";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { resolveWhatsAppRisk, type WhatsAppRiskResponse } from "@/hooks/useWhatsAppRisk";
import type { Channel, Conversation, Lead } from "@/types";

type PanelTab = "contact" | "sales" | "details";

type Props = {
  conversation: Conversation;
  activeLead?: Lead | null;
  onAssignAdvisor: () => void;
  channelLabel: (channel?: Channel) => string;
  locale: string;
  onCreateQuotation?: () => void;
  whatsappRisk?: WhatsAppRiskResponse;
};

export function ConversationContactPanel({
  conversation,
  activeLead,
  onAssignAdvisor,
  channelLabel,
  locale,
  onCreateQuotation,
  whatsappRisk,
}: Props) {
  const t = useT();
  const { formatDate, formatRelativeTime } = useFormatters();
  const { data: advisors } = useAdvisors();
  const { data: opportunity } = useOpportunityByConversation(conversation.conversationId);
  const clickToCall = useClickToCall();
  const [panelTab, setPanelTab] = useState<PanelTab>("sales");

  useEffect(() => {
    setPanelTab(opportunity ? "sales" : "contact");
  }, [conversation.conversationId, opportunity?.opportunityId]);
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
    <aside className="conversations-sidebar-bg hidden w-80 flex-shrink-0 flex-col border-l border-default xl:flex">
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

      <div className="conversations-sidebar-header border-b border-default p-5 text-center">
        <div className="relative mx-auto mb-4">
          <ChannelAvatar channel={conversation.channel} size="lg" className="mx-auto" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-primary">{displayName}</h2>
        {phone ? (
          <p className="mt-1 text-sm text-secondary">{phone}</p>
        ) : null}
        {phone ? (
          <Button
            size="sm"
            className="mt-2"
            onClick={() =>
              void clickToCall.mutateAsync({ botId: conversation.botId, to: phone })
            }
            disabled={clickToCall.isPending}
          >
            <Phone className="h-4 w-4" />
            {t("contactCenter.clickToCall")}
          </Button>
        ) : null}
        <p className="mt-0.5 text-xs text-muted">{channelLabel(conversation.channel)}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <Badge variant={isHuman ? "warning" : "default"}>
            {isHuman ? t("conversations.modeHuman") : t("conversations.modeBot")}
          </Badge>
          {conversation.locale ? (
            <Badge variant="default" className="uppercase">{conversation.locale}</Badge>
          ) : null}
        </div>
      </div>

      <div className="sidebar-scroll flex-1 space-y-4 overflow-y-auto p-4">
        {panelTab === "sales" ? (
          <ConversationOpportunityPanel
            conversation={conversation}
            activeLead={activeLead}
            locale={locale}
            onCreateQuotation={onCreateQuotation}
          />
        ) : panelTab === "contact" ? (
          <>
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

            {isWhatsApp ? (
              <ContentCardSection title={t("whatsapp.riskTitle")}>
                <WhatsAppRiskBadge risk={botWhatsAppRisk} />
                <p className="mt-2 text-xs text-secondary">{t("whatsapp.riskHint")}</p>
              </ContentCardSection>
            ) : null}

            {activeLead ? (
              <ContentCardSection title={t("leads.leadStatus")}>
                <Badge variant="accent">{t(`leads.status_${activeLead.status}`)}</Badge>
              </ContentCardSection>
            ) : null}

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

            {conversation.internalNote ? (
              <section className="conversations-internal-note p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <Lock className="h-3.5 w-3.5" />
                  {t("conversations.internalNote")}
                </div>
                <p className="text-sm leading-relaxed">{conversation.internalNote}</p>
              </section>
            ) : null}
          </>
        ) : (
          <>
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
