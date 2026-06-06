"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FlowResponse, MetaFlow } from "@/types";

export function useMetaFlows(botId: string, sync = false) {
  return useQuery<MetaFlow[]>({
    queryKey: ["meta-flows", botId, sync],
    queryFn: () =>
      api.get<MetaFlow[]>(
        `/bots/${encodeURIComponent(botId)}/meta-flows${sync ? "?sync=true" : ""}`
      ),
    enabled: !!botId,
  });
}

export function useMetaFlow(botId: string, flowId: string) {
  return useQuery<MetaFlow>({
    queryKey: ["meta-flows", botId, flowId],
    queryFn: () =>
      api.get<MetaFlow>(`/bots/${encodeURIComponent(botId)}/meta-flows/${encodeURIComponent(flowId)}`),
    enabled: !!botId && !!flowId,
  });
}

export function useMetaFlowResponses(botId: string) {
  return useQuery<FlowResponse[]>({
    queryKey: ["meta-flow-responses", botId],
    queryFn: () =>
      api.get<FlowResponse[]>(`/bots/${encodeURIComponent(botId)}/meta-flows/responses`),
    enabled: !!botId,
  });
}

export function useCreateMetaFlow(botId: string) {
  const qc = useQueryClient();
  return useMutation<
    MetaFlow,
    Error,
    { name: string; categories?: string[]; template?: string; jsonDefinition?: Record<string, unknown> }
  >({
    mutationFn: (body) =>
      api.post<MetaFlow>(`/bots/${encodeURIComponent(botId)}/meta-flows`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["meta-flows", botId] }),
  });
}

export function useUpdateMetaFlow(botId: string, flowId: string) {
  const qc = useQueryClient();
  return useMutation<MetaFlow, Error, { name?: string; jsonDefinition: Record<string, unknown> }>({
    mutationFn: (body) =>
      api.put<MetaFlow>(
        `/bots/${encodeURIComponent(botId)}/meta-flows/${encodeURIComponent(flowId)}`,
        body
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta-flows", botId] });
      void qc.invalidateQueries({ queryKey: ["meta-flows", botId, flowId] });
    },
  });
}

export function usePublishMetaFlow(botId: string) {
  const qc = useQueryClient();
  return useMutation<MetaFlow, Error, string>({
    mutationFn: (flowId) =>
      api.post<MetaFlow>(
        `/bots/${encodeURIComponent(botId)}/meta-flows/${encodeURIComponent(flowId)}/publish`,
        {}
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["meta-flows", botId] }),
  });
}

export function useDeprecateMetaFlow(botId: string) {
  const qc = useQueryClient();
  return useMutation<MetaFlow, Error, string>({
    mutationFn: (flowId) =>
      api.post<MetaFlow>(
        `/bots/${encodeURIComponent(botId)}/meta-flows/${encodeURIComponent(flowId)}/deprecate`,
        {}
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["meta-flows", botId] }),
  });
}

export function useTestSendMetaFlow(botId: string) {
  return useMutation<void, Error, { flowId: string; to: string; flowCta?: string }>({
    mutationFn: ({ flowId, to, flowCta }) =>
      api.post(
        `/bots/${encodeURIComponent(botId)}/meta-flows/${encodeURIComponent(flowId)}/test-send`,
        { to, flowCta }
      ),
  });
}

export function useDeleteMetaFlow(botId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (flowId) =>
      api.delete(`/bots/${encodeURIComponent(botId)}/meta-flows/${encodeURIComponent(flowId)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["meta-flows", botId] }),
  });
}
