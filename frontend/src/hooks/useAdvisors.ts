"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Advisor, AdvisorInviteResponse } from "@/types";

export function useAdvisors() {
  return useQuery({
    queryKey: ["advisors"],
    queryFn: () => api.get<Advisor[]>("/advisors"),
  });
}

export function useCreateAdvisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      phoneNumber: string;
      botIds?: string[];
      inviteEmail?: string;
    }) => api.post<AdvisorInviteResponse>("/advisors", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisors"] }),
  });
}

export function useUpdateAdvisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      advisorId,
      ...body
    }: {
      advisorId: string;
      name?: string;
      phoneNumber?: string;
      botIds?: string[];
      status?: "active" | "inactive";
    }) => api.put<Advisor>(`/advisors/${encodeURIComponent(advisorId)}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisors"] }),
  });
}

export function useDeleteAdvisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (advisorId: string) =>
      api.delete(`/advisors/${encodeURIComponent(advisorId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisors"] }),
  });
}
