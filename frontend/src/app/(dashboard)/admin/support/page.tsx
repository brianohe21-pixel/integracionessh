"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useAdminSupportTickets, useAdminUpdateTicket } from "@/hooks/useAdminSupport";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { SupportTicket } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AdminSupportPage() {
  const t = useT();
  const { data: tickets, isLoading } = useAdminSupportTickets();
  const updateTicket = useAdminUpdateTicket();
  const { formatDate } = useFormatters();
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  async function handleClose(ticket: SupportTicket) {
    await updateTicket.mutateAsync({
      tenantId: ticket.tenantId,
      ticketId: ticket.ticketId,
      status: "closed",
      adminReply: replyDraft[ticket.ticketId] || ticket.adminReply,
    });
  }

  async function handleReply(ticket: SupportTicket) {
    const adminReply = replyDraft[ticket.ticketId]?.trim();
    if (!adminReply) return;
    await updateTicket.mutateAsync({
      tenantId: ticket.tenantId,
      ticketId: ticket.ticketId,
      adminReply,
    });
  }

  return (
    <DashboardPage maxWidth="5xl">
      <PageHeader
        title={t("admin.support.title")}
        subtitle={t("admin.support.subtitle")}
      />

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : !tickets?.length ? (
        <p className="text-sm text-gray-500">{t("admin.support.empty")}</p>
      ) : (
        <ul className="space-y-4">
          {tickets.map((ticket) => (
            <li key={`${ticket.tenantId}-${ticket.ticketId}`} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-medium text-gray-900">{ticket.subject}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {ticket.email} · {ticket.tenantId.slice(0, 8)}… · {formatDate(ticket.createdAt)}
                  </p>
                </div>
                <Badge variant={ticket.status === "open" ? "info" : "default"}>
                  {t(`support.status.${ticket.status}`)}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3">{ticket.message}</p>
              {ticket.adminReply && (
                <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg p-3 mb-3">
                  {ticket.adminReply}
                </p>
              )}
              <textarea
                value={replyDraft[ticket.ticketId] ?? ""}
                onChange={(e) =>
                  setReplyDraft((prev) => ({ ...prev, [ticket.ticketId]: e.target.value }))
                }
                placeholder={t("admin.support.replyPlaceholder")}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-2"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleReply(ticket)}
                  disabled={updateTicket.isPending}
                  className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {t("admin.support.saveReply")}
                </button>
                {ticket.status === "open" && (
                  <button
                    type="button"
                    onClick={() => handleClose(ticket)}
                    disabled={updateTicket.isPending}
                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t("admin.support.close")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardPage>
  );
}
