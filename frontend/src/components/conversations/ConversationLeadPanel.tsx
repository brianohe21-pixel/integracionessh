"use client";

import Link from "next/link";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useDialog } from "@/components/ui/DialogProvider";
import { useCreateLead, useConvertLead } from "@/hooks/useLeads";
import { useT } from "@/i18n/context";
import type { Conversation, Lead } from "@/types";

type Props = {
  conversation: Conversation;
  activeLead?: Lead | null;
};

function conversationPhone(conversation: Conversation): string | undefined {
  if (conversation.channel === "email") {
    return conversation.phoneNumber || undefined;
  }
  if (
    (conversation.channel ?? "whatsapp") === "whatsapp" ||
    conversation.channel === "sms" ||
    conversation.channel === "phone"
  ) {
    return conversation.phoneNumber || conversation.participantId;
  }
  return conversation.phoneNumber || conversation.participantId || undefined;
}

function conversationEmail(conversation: Conversation): string | undefined {
  if (conversation.channel === "email") return conversation.participantId;
  return undefined;
}

export function ConversationLeadPanel({ conversation, activeLead }: Props) {
  const t = useT();
  const { alert } = useDialog();
  const createLead = useCreateLead();
  const convertLead = useConvertLead();
  const phone = conversationPhone(conversation);
  const canCreate = Boolean(phone);

  async function handleCreate() {
    if (!phone) return;
    try {
      await createLead.mutateAsync({
        botId: conversation.botId,
        conversationId: conversation.conversationId,
        ...(conversation.contactName ? { name: conversation.contactName } : {}),
        ...(conversationEmail(conversation) ? { email: conversationEmail(conversation) } : {}),
      });
      await alert({
        title: t("leads.title"),
        message: t("leads.createdFromInbox"),
        tone: "success",
      });
    } catch (err) {
      await alert({
        title: t("leads.title"),
        message: (err as Error).message || t("leads.createFromInboxError"),
        tone: "danger",
      });
    }
  }

  if (activeLead) {
    return (
      <section className="content-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <UserPlus className="h-3.5 w-3.5" />
          {t("leads.title")}
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="accent">{t(`leads.status_${activeLead.status}`)}</Badge>
          <div className="flex flex-wrap gap-2">
            <Link href="/leads" className="text-xs font-medium text-accent hover:text-accent">
              {t("leads.viewLead")}
            </Link>
            {activeLead.status !== "converted" && activeLead.status !== "lost" ? (
              <button
                type="button"
                onClick={() => convertLead.mutate({ leadId: activeLead.leadId })}
                disabled={convertLead.isPending}
                className="text-xs font-medium text-accent hover:text-accent"
              >
                {t("leads.convert")}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="content-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <UserPlus className="h-3.5 w-3.5" />
        {t("leads.title")}
      </h3>
      <p className="mb-3 text-sm text-secondary">{t("leads.noLeadForConversation")}</p>
      <Button
        type="button"
        size="sm"
        className="w-full"
        onClick={() => void handleCreate()}
        disabled={!canCreate || createLead.isPending}
      >
        <CheckCircle2 className="h-4 w-4" />
        {t("leads.createFromInbox")}
      </Button>
      {!canCreate ? (
        <p className="mt-2 text-xs text-muted">{t("leads.createFromInboxPhoneRequired")}</p>
      ) : null}
    </section>
  );
}
