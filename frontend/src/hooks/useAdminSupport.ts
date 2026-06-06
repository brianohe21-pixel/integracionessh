"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SupportTicket, SupportTicketStatus } from "@/types";

export function useAdminSupportTickets() {
  return useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: () => api.get<SupportTicket[]>("/admin/support/tickets"),
  });
}

export function useAdminUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      tenantId: string;
      ticketId: string;
      status?: SupportTicketStatus;
      adminReply?: string;
    }) =>
      api.patch<SupportTicket>(`/admin/support/tickets/${input.ticketId}`, {
        tenantId: input.tenantId,
        status: input.status,
        adminReply: input.adminReply,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
  });
}
