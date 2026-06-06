"use client";

import { Badge } from "@/components/ui/Badge";
import { useFormatters } from "@/hooks/useFormatters";
import { useSupportTicketList } from "@/hooks/useSupportTickets";
import { useT } from "@/i18n/context";
import type { SupportTicket } from "@/types";

export function SupportTicketList() {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data: tickets, isLoading } = useSupportTicketList();

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!tickets?.length) {
    return <p className="text-sm text-gray-500">{t("support.emptyTickets")}</p>;
  }

  return (
    <ul className="space-y-3">
      {tickets.map((ticket) => (
        <TicketRow key={ticket.ticketId} ticket={ticket} formatDate={formatDate} />
      ))}
    </ul>
  );
}

function TicketRow({
  ticket,
  formatDate,
}: {
  ticket: SupportTicket;
  formatDate: (iso: string) => string;
}) {
  const t = useT();

  return (
    <li className="rounded-lg border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t(`support.categories.${ticket.category}`)} · {formatDate(ticket.createdAt)}
          </p>
        </div>
        <Badge variant={ticket.status === "open" ? "info" : "default"}>
          {t(`support.status.${ticket.status}`)}
        </Badge>
      </div>
      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{ticket.message}</p>
    </li>
  );
}
