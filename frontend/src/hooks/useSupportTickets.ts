"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SupportTicket, SupportTicketCategory } from "@/types";

export interface CreateSupportTicketInput {
  category: SupportTicketCategory;
  subject: string;
  message: string;
}

export function useSupportTicketList() {
  return useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => api.get<SupportTicket[]>("/support/tickets"),
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) =>
      api.post<SupportTicket>("/support/tickets", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}
