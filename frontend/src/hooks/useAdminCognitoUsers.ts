"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CognitoUsersPage } from "@/types";

function cognitoUsersQueryKey(role?: "admin" | "member") {
  return role ? (["admin-cognito-users", role] as const) : (["admin-cognito-users"] as const);
}

function fetchCognitoUsersPage(pageParam: string | undefined, role?: "admin" | "member") {
  const params = new URLSearchParams({ limit: "25" });
  if (pageParam) params.set("paginationToken", pageParam);
  if (role) params.set("role", role);
  return api.get<CognitoUsersPage>(`/admin/cognito/users?${params.toString()}`);
}

export function useAdminCognitoUsers() {
  return useInfiniteQuery({
    queryKey: cognitoUsersQueryKey(),
    queryFn: ({ pageParam }) => fetchCognitoUsersPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.paginationToken,
  });
}

export function useAdminPlatformAdmins() {
  return useInfiniteQuery({
    queryKey: cognitoUsersQueryKey("admin"),
    queryFn: ({ pageParam }) => fetchCognitoUsersPage(pageParam, "admin"),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.paginationToken,
  });
}

export function useAdminUpdateCognitoUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      username: string;
      enabled?: boolean;
      tenantId?: string;
      role?: "admin" | "member";
    }) =>
      api.patch<{ updated: boolean }>(
        `/admin/cognito/users/${encodeURIComponent(input.username)}`,
        {
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cognito-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cognito-users", "admin"] });
    },
  });
}
