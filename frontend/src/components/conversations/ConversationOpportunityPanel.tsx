"use client";

import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/context";
import { useCreateOpportunity } from "@/hooks/useSales";
import { useOpportunityByConversation } from "@/hooks/useSalesOpportunity";
import { formatSalesMoney } from "@/components/sales/sales-ui";
import type { Conversation, Lead } from "@/types";

type Props = {
  conversation: Conversation;
  activeLead?: Lead | null;
  locale: string;
  onOpenOpportunity: (opportunityId: string) => void;
};

function contactPhone(conversation: Conversation): string | undefined {
  if (
    (conversation.channel ?? "whatsapp") === "whatsapp" ||
    conversation.channel === "sms" ||
    conversation.channel === "phone"
  ) {
    return conversation.phoneNumber || conversation.participantId;
  }
  return conversation.phoneNumber || undefined;
}

function contactEmail(conversation: Conversation, activeLead?: Lead | null): string | undefined {
  if (conversation.channel === "email") return conversation.participantId;
  return activeLead?.email;
}

export function ConversationOpportunityPanel({
  conversation,
  activeLead,
  locale,
  onOpenOpportunity,
}: Props) {
  const t = useT();
  const { data: opportunity, isLoading } = useOpportunityByConversation(conversation.conversationId);
  const createOpportunity = useCreateOpportunity();

  const phone = contactPhone(conversation);
  const email = contactEmail(conversation, activeLead);
  const defaultTitle =
    conversation.contactName?.trim() ||
    phone ||
    conversation.participantId ||
    t("sales.newOpportunity");

  async function handleCreate() {
    const created = await createOpportunity.mutateAsync({
      title: defaultTitle,
      conversationId: conversation.conversationId,
      botId: conversation.botId,
      ...(phone ? { phone } : {}),
      ...(conversation.contactName ? { name: conversation.contactName } : {}),
      ...(email ? { email } : {}),
      ...(activeLead?.leadId ? { leadId: activeLead.leadId } : {}),
      ...(conversation.assignedAdvisorId
        ? { assignedAdvisorId: conversation.assignedAdvisorId }
        : {}),
    });
    onOpenOpportunity(created.opportunityId);
  }

  return (
    <section className="content-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <TrendingUp className="h-3.5 w-3.5" />
        {t("sales.title")}
      </h3>

      {isLoading ? (
        <p className="text-sm text-secondary">{t("common.loading")}</p>
      ) : opportunity ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-primary">{opportunity.title}</p>
            {opportunity.amount !== undefined ? (
              <p className="mt-1 text-sm font-semibold text-accent">
                {formatSalesMoney(opportunity.amount, opportunity.currency, locale)}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="info">{opportunity.stage}</Badge>
              {opportunity.closedAt ? (
                <Badge variant="default">{t("sales.closedLabel")}</Badge>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => onOpenOpportunity(opportunity.opportunityId)}
          >
            {t("sales.openOpportunity")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-secondary">{t("sales.noOpportunityForConversation")}</p>
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => void handleCreate()}
            disabled={createOpportunity.isPending}
          >
            {t("sales.createFromConversation")}
          </Button>
        </div>
      )}
    </section>
  );
}
