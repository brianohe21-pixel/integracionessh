"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  OrganizationTeam,
  OrganizationTeamsResponse,
  TenantMemberInviteResponse,
  TenantMembersResponse,
} from "@/types";

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
      role: "member" | "supervisor" | "advisor";
      phoneNumber?: string;
      teamIds?: string[];
      customRoleId?: string | null;
    }) => api.post<TenantMemberInviteResponse>("/tenants/me/members", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-members"] });
      qc.invalidateQueries({ queryKey: ["advisors"] });
      qc.invalidateQueries({ queryKey: ["organization-teams"] });
    },
  });
}

export function useUpdateTenantMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: string;
      body: {
        name?: string;
        role?: "member" | "supervisor" | "advisor";
        enabled?: boolean;
        teamIds?: string[];
        phoneNumber?: string;
        customRoleId?: string | null;
      };
    }) =>
      api.patch(`/tenants/me/members/${encodeURIComponent(userId)}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-members"] });
      qc.invalidateQueries({ queryKey: ["advisors"] });
      qc.invalidateQueries({ queryKey: ["organization-teams"] });
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
      qc.invalidateQueries({ queryKey: ["organization-teams"] });
    },
  });
}

export function useOrganizationTeams() {
  return useQuery({
    queryKey: ["organization-teams"],
    queryFn: () => api.get<OrganizationTeamsResponse>("/tenants/me/teams"),
  });
}

export function useCreateOrganizationTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      supervisorUserIds?: string[];
      memberUserIds?: string[];
    }) => api.post<OrganizationTeam>("/tenants/me/teams", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organization-teams"] });
      qc.invalidateQueries({ queryKey: ["tenant-members"] });
    },
  });
}

export function useUpdateOrganizationTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      body,
    }: {
      teamId: string;
      body: {
        name?: string;
        description?: string;
        status?: "active" | "inactive";
        supervisorUserIds?: string[];
        memberUserIds?: string[];
      };
    }) => api.patch(`/tenants/me/teams/${encodeURIComponent(teamId)}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organization-teams"] });
      qc.invalidateQueries({ queryKey: ["tenant-members"] });
    },
  });
}

export function useDeleteOrganizationTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) =>
      api.delete(`/tenants/me/teams/${encodeURIComponent(teamId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organization-teams"] });
      qc.invalidateQueries({ queryKey: ["tenant-members"] });
    },
  });
}
