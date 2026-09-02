"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  FlowDefinition,
  FlowEventSubmission,
  FlowHookCredentials,
  FlowRun,
  FlowVersionSnapshot,
} from "@/types";

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
  return useMutation<
    FlowDefinition & { hook?: FlowHookCredentials },
    Error,
    { flowId: string; enabled: boolean }
  >({
    mutationFn: ({ flowId, enabled }) =>
      api.post<FlowDefinition & { hook?: FlowHookCredentials }>(
        `/flows/${encodeURIComponent(flowId)}/${enabled ? "enable" : "disable"}`,
        {}
      ),
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

export function useDuplicateFlow() {
  const qc = useQueryClient();
  return useMutation<FlowDefinition, Error, string>({
    mutationFn: (flowId) =>
      api.post<FlowDefinition>(`/flows/${encodeURIComponent(flowId)}/duplicate`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["flows"] }),
  });
}

export function usePublishFlow(flowId: string) {
  const qc = useQueryClient();
  return useMutation<FlowDefinition, Error, void>({
    mutationFn: () =>
      api.post<FlowDefinition>(`/flows/${encodeURIComponent(flowId)}/publish`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flows"] });
      void qc.invalidateQueries({ queryKey: ["flows", flowId] });
      void qc.invalidateQueries({ queryKey: ["flows", flowId, "versions"] });
    },
  });
}

export function useFlowVersions(flowId: string, enabled = true) {
  return useQuery<FlowVersionSnapshot[]>({
    queryKey: ["flows", flowId, "versions"],
    queryFn: () =>
      api.get<FlowVersionSnapshot[]>(`/flows/${encodeURIComponent(flowId)}/versions`),
    enabled: !!flowId && enabled,
  });
}

export function useRestoreFlowVersion(flowId: string) {
  const qc = useQueryClient();
  return useMutation<FlowDefinition, Error, number>({
    mutationFn: (version) =>
      api.post<FlowDefinition>(
        `/flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(String(version))}/restore`,
        {}
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flows"] });
      void qc.invalidateQueries({ queryKey: ["flows", flowId] });
    },
  });
}

export function useFlowHook(flowId: string, enabled = true) {
  return useQuery<{
    configured: boolean;
    hookKey?: string;
    webhookUrl?: string;
    enabled?: boolean;
  }>({
    queryKey: ["flows", flowId, "hook"],
    queryFn: () => api.get(`/flows/${encodeURIComponent(flowId)}/hook`),
    enabled: !!flowId && enabled,
  });
}

export function useRotateFlowHook(flowId: string) {
  const qc = useQueryClient();
  return useMutation<FlowHookCredentials, Error, void>({
    mutationFn: () =>
      api.post<FlowHookCredentials>(`/flows/${encodeURIComponent(flowId)}/hook/rotate`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flows", flowId, "hook"] });
    },
  });
}

export function useValidateFlow(flowId: string) {
  return useMutation<{ issues: Array<{ code: string; message: string; nodeId?: string }> }, Error, Partial<FlowDefinition>>({
    mutationFn: (body) =>
      api.post(`/flows/${encodeURIComponent(flowId)}/validate`, body),
  });
}

export function useFlowRuns(flowId: string, enabled = true) {
  return useQuery<FlowRun[]>({
    queryKey: ["flows", flowId, "runs"],
    queryFn: () => api.get<FlowRun[]>(`/flows/${encodeURIComponent(flowId)}/runs`),
    enabled: !!flowId && enabled,
  });
}

export function useFlowEvents(flowId: string, enabled = true) {
  return useQuery<FlowEventSubmission[]>({
    queryKey: ["flows", flowId, "events"],
    queryFn: () => api.get<FlowEventSubmission[]>(`/flows/${encodeURIComponent(flowId)}/events`),
    enabled: !!flowId && enabled,
  });
}

export function useCreateTaxiVoiceFlow() {
  const qc = useQueryClient();
  return useMutation<FlowDefinition, Error, { botId: string }>({
    mutationFn: (body) =>
      api.post<FlowDefinition>("/flows/templates/taxi-355-satelital", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["flows"] }),
  });
}

export function useFlowSecrets(flowId: string, enabled = true) {
  return useQuery<{ secrets: Array<{ name: string; configured: boolean }> }>({
    queryKey: ["flows", flowId, "secrets"],
    queryFn: () => api.get(`/flows/${encodeURIComponent(flowId)}/secrets`),
    enabled: !!flowId && enabled,
  });
}

export function useSaveFlowSecret(flowId: string) {
  const qc = useQueryClient();
  return useMutation<{ name: string; configured: boolean }, Error, { name: string; value: string }>({
    mutationFn: (body) =>
      api.put(`/flows/${encodeURIComponent(flowId)}/secrets`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["flows", flowId, "secrets"] });
    },
  });
}
