"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Macro } from "@/types";

export function useMacros(botId: string) {
  return useQuery({
    queryKey: ["macros", botId],
    queryFn: () => api.get<{ macros: Macro[] }>(`/bots/${botId}/macros`),
    enabled: !!botId,
    select: (data) => data.macros,
  });
}

export function useCreateMacro(botId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      content: string;
      shortcut?: string;
      sortOrder?: number;
    }) => api.post<Macro>(`/bots/${botId}/macros`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["macros", botId] }),
  });
}

export function useUpdateMacro(botId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      macroId,
      ...body
    }: {
      macroId: string;
      title?: string;
      content?: string;
      shortcut?: string | null;
      sortOrder?: number;
    }) => api.put<Macro>(`/bots/${botId}/macros/${encodeURIComponent(macroId)}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["macros", botId] }),
  });
}

export function useDeleteMacro(botId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (macroId: string) =>
      api.delete(`/bots/${botId}/macros/${encodeURIComponent(macroId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["macros", botId] }),
  });
}
