"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TenantMemberInviteResponse, TenantMembersResponse } from "@/types";

export function useTenantMembers() {
  return useQuery({
    queryKey: ["tenant-members"],
    queryFn: () => api.get<TenantMembersResponse>("/tenants/me/members"),
  });
}

export function useInviteTenantMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      role: "member" | "advisor";
      phoneNumber?: string;
    }) => api.post<TenantMemberInviteResponse>("/tenants/me/members", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-members"] });
      qc.invalidateQueries({ queryKey: ["advisors"] });
    },
  });
}

export function useRemoveTenantMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/tenants/me/members/${encodeURIComponent(userId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-members"] });
      qc.invalidateQueries({ queryKey: ["advisors"] });
    },
  });
}
