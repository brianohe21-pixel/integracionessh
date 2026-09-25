"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTenantRole } from "@/hooks/useTenantRole";
import type { Permission } from "@/lib/permissions";

export interface CustomRole {
  roleId: string;
  tenantId: string;
  name: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionsResponse {
  permissions: Permission[];
  catalog: Permission[];
  presets: {
    member: Permission[];
    supervisor: Permission[];
    advisor: Permission[];
  };
}

export interface AuditEvent {
  eventId: string;
  actorUserId: string;
  actorEmail: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export function usePermissions() {
  const { isAdmin, loading: roleLoading } = useTenantRole();
  const query = useQuery({
    queryKey: ["tenant-permissions"],
    queryFn: async () => {
      try {
        return await api.get<PermissionsResponse>("/tenants/me/permissions");
      } catch {
        return {
          permissions: [] as Permission[],
          catalog: [] as Permission[],
          presets: { member: [], supervisor: [], advisor: [] },
        } satisfies PermissionsResponse;
      }
    },
    enabled: !roleLoading && !isAdmin,
  });

  const granted = useMemo(
    () => new Set(query.data?.permissions ?? []),
    [query.data?.permissions]
  );

  return {
    loading: roleLoading || (!isAdmin && query.isLoading),
    permissions: query.data?.permissions ?? [],
    catalog: query.data?.catalog ?? [],
    presets: query.data?.presets,
    can: (permission: Permission) => !isAdmin && granted.has(permission),
  };
}

export function useCustomRoles(enabled = true) {
  return useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      try {
        return await api.get<{ roles: CustomRole[] }>("/tenants/me/roles");
      } catch (error) {
        return {
          roles: [] as CustomRole[],
          error: error instanceof Error ? error.message : "Forbidden",
        };
      }
    },
    enabled,
    retry: false,
  });
}

export function useCreateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; permissions: string[] }) =>
      api.post<CustomRole>("/tenants/me/roles", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
    },
  });
}

export function useUpdateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      body,
    }: {
      roleId: string;
      body: { name: string; permissions: string[] };
    }) => api.patch<CustomRole>(`/tenants/me/roles/${encodeURIComponent(roleId)}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      qc.invalidateQueries({ queryKey: ["tenant-permissions"] });
    },
  });
}

export function useDeleteCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      api.delete(`/tenants/me/roles/${encodeURIComponent(roleId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
    },
  });
}

export function useAuditEvents(module?: string) {
  return useQuery({
    queryKey: ["audit-events", module ?? "all"],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (module) params.set("module", module);
      return api.get<{ items: AuditEvent[]; nextCursor?: string }>(
        `/tenants/me/audit?${params.toString()}`
      );
    },
  });
}
