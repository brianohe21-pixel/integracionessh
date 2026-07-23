"use client";

import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { useT } from "@/i18n/context";
import { useConversationQuotations } from "@/hooks/useQuotations";
import { Badge } from "@/components/ui/Badge";
import type { Quotation } from "@/types";

type Props = {
  conversationId: string;
  botId: string;
};

function formatCop(cents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statusVariant(status: Quotation["status"]): "default" | "accent" | "success" {
  if (status === "paid") return "success";
  if (status === "sent") return "accent";
  return "default";
}

export function ConversationQuotationsPanel({ conversationId, botId }: Props) {
  const t = useT();
  const { data, isLoading } = useConversationQuotations(conversationId, botId);
  const quotations = data?.quotations ?? [];

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t("quotations.historyTitle")}
        </h3>
        <div className="h-16 animate-pulse rounded-lg bg-surface-muted" />
      </section>
    );
  }

  if (quotations.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {t("quotations.historyTitle")}
      </h3>
      <ul className="space-y-2">
        {quotations.map((quotation) => (
          <li
            key={quotation.quotationId}
            className="rounded-lg border border-default bg-surface p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium text-primary">
                  <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                  {quotation.number}
                </p>
                <p className="mt-0.5 text-secondary">{formatCop(quotation.totalInCents)}</p>
              </div>
              <Badge variant={statusVariant(quotation.status)}>
                {t(`quotations.status.${quotation.status}`)}
              </Badge>
            </div>
            {quotation.pdfDownloadUrl ? (
              <a
                href={quotation.pdfDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t("quotations.downloadPdf")}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      <Link
        href={`/apps/payments/${botId}`}
        className="text-xs text-accent hover:underline"
      >
        {t("quotations.managePayments")}
      </Link>
    </section>
  );
}
