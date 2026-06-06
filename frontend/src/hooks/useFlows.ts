"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FlowDefinition } from "@/types";

export function useFlows(botId?: string) {
  return useQuery<FlowDefinition[]>({
    queryKey: ["flows", botId],
    queryFn: () =>
      api.get<FlowDefinition[]>(
        botId ? `/flows?botId=${encodeURIComponent(botId)}` : "/flows"
      ),
  });
}

export function useFlow(flowId: string) {
  return useQuery<FlowDefinition>({
    queryKey: ["flows", flowId],
    queryFn: () => api.get<FlowDefinition>(`/flows/${encodeURIComponent(flowId)}`),
    enabled: !!flowId,
  });
}

export function useCreateFlow() {
  const qc = useQueryClient();
  return useMutation<FlowDefinition, Error, Partial<FlowDefinition>>({
    mutationFn: (body) => api.post<FlowDefinition>("/flows", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["flows"] }),
  });
}

export function useUpdateFlow(flowId: string) {
  const qc = useQueryClient();
  return useMutation<FlowDefinition, Error, Partial<FlowDefinition>>({
    mutationFn: (body) => api.put<FlowDefinition>(`/flows/${encodeURIComponent(flowId)}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flows"] });
      void qc.invalidateQueries({ queryKey: ["flows", flowId] });
    },
  });
}

export function useToggleFlow() {
  const qc = useQueryClient();
  return useMutation<FlowDefinition, Error, { flowId: string; enabled: boolean }>({
    mutationFn: ({ flowId, enabled }) =>
      api.post<FlowDefinition>(`/flows/${encodeURIComponent(flowId)}/${enabled ? "enable" : "disable"}`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["flows"] }),
  });
}

export function useDeleteFlow() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (flowId) => api.delete(`/flows/${encodeURIComponent(flowId)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["flows"] }),
  });
}
