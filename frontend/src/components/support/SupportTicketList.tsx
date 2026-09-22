"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFormatters } from "@/hooks/useFormatters";
import { useDeleteSupportTicket, useSupportTicketList } from "@/hooks/useSupportTickets";
import { useT } from "@/i18n/context";
import type { SupportTicket } from "@/types";

export function SupportTicketList() {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data: tickets, isLoading } = useSupportTicketList();
  const deleteTicket = useDeleteSupportTicket();
  const [pendingDelete, setPendingDelete] = useState<SupportTicket | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleteError("");
    try {
      await deleteTicket.mutateAsync(pendingDelete.ticketId);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("support.deleteError"));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (!tickets?.length) {
    return <p className="text-sm text-secondary">{t("support.emptyTickets")}</p>;
  }

  return (
    <>
      <ul className="space-y-3">
        {tickets.map((ticket) => (
          <TicketRow
            key={ticket.ticketId}
            ticket={ticket}
            formatDate={formatDate}
            onDelete={() => setPendingDelete(ticket)}
            isDeleting={deleteTicket.isPending && pendingDelete?.ticketId === ticket.ticketId}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t("support.deleteConfirmTitle")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={deleteTicket.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError("");
        }}
        description={
          <>
            {t("support.deleteConfirmDescription", {
              subject: pendingDelete?.subject ?? "",
            })}
            {deleteError ? <p className="mt-3 text-sm text-danger">{deleteError}</p> : null}
          </>
        }
      />
    </>
  );
}

function TicketRow({
  ticket,
  formatDate,
  onDelete,
  isDeleting,
}: {
  ticket: SupportTicket;
  formatDate: (iso: string) => string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const t = useT();

  return (
    <li className="rounded-lg border border-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary truncate">{ticket.subject}</p>
          <p className="text-xs text-secondary mt-0.5">
            {t(`support.categories.${ticket.category}`)} · {formatDate(ticket.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ticket.status === "open" ? "info" : "default"}>
            {t(`support.status.${ticket.status}`)}
          </Badge>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-danger disabled:opacity-50"
            aria-label={t("support.deleteTicket")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-secondary mt-2 line-clamp-2">{ticket.message}</p>
      {ticket.adminReply ? (
        <p className="mt-3 rounded-lg bg-accent-muted px-3 py-2 text-sm text-primary">
          {ticket.adminReply}
        </p>
      ) : null}
    </li>
  );
}
