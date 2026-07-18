"use client";

import Link from "next/link";
import { User, Phone, Mail, Headphones, History } from "lucide-react";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAdvisors } from "@/hooks/useAdvisors";
import type { Conversation, Lead } from "@/types";
import type { Channel } from "@/types";

type Props = {
  conversation: Conversation;
  activeLead?: Lead | null;
  onAssignAdvisor: () => void;
  channelLabel: (channel?: Channel) => string;
};

export function ConversationContactPanel({
  conversation,
  activeLead,
  onAssignAdvisor,
  channelLabel,
}: Props) {
  const t = useT();
  const { data: advisors } = useAdvisors();
  const assignedAdvisor = advisors?.find((a) => a.advisorId === conversation.assignedAdvisorId);
  const displayName =
    conversation.contactName ??
    ((conversation.channel ?? "whatsapp") === "whatsapp"
      ? conversation.phoneNumber
      : conversation.participantId ?? conversation.phoneNumber);

  const tags = activeLead?.tags ?? [];

  return (
    <aside className="hidden w-80 flex-shrink-0 flex-col border-l border-default bg-surface-elevated xl:flex">
      <div className="border-b border-default p-6 text-center">
        <div className="relative mx-auto mb-4 h-20 w-20">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-surface-muted">
            <User className="h-8 w-8 text-muted" />
          </div>
          <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
            {(conversation.channel ?? "whatsapp").charAt(0).toUpperCase()}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-primary">{displayName}</h2>
        <p className="mt-1 text-sm text-secondary">{channelLabel(conversation.channel)}</p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("conversations.contactInfo")}
          </h3>
          <div className="space-y-2 text-sm">
            {(conversation.channel ?? "whatsapp") === "whatsapp" && (
              <div className="flex items-center gap-2 text-secondary">
                <Phone className="h-4 w-4 text-muted" />
                <span>{conversation.phoneNumber}</span>
              </div>
            )}
            {activeLead?.email && (
              <div className="flex items-center gap-2 text-secondary">
                <Mail className="h-4 w-4 text-muted" />
                <span>{activeLead.email}</span>
              </div>
            )}
          </div>
        </section>

        {activeLead && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("leads.leadStatus")}
            </h3>
            <Badge variant="accent">{t(`leads.status_${activeLead.status}`)}</Badge>
          </section>
        )}

        {tags.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("conversations.tags")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="default">
                  {tag}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {assignedAdvisor && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("conversations.assignedAdvisor")}
            </h3>
            <p className="text-sm text-secondary">{assignedAdvisor.name}</p>
          </section>
        )}
      </div>

      <div className="space-y-2 border-t border-default p-4">
        {(conversation.handoffMode ?? "bot") !== "human" && (
          <Button type="button" className="w-full" onClick={onAssignAdvisor}>
            <Headphones className="h-4 w-4" />
            {t("conversations.assignAdvisor")}
          </Button>
        )}
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
