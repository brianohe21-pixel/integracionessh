"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Opportunity,
  OpportunitiesListResponse,
  SalesFunnelMetrics,
  SalesPipeline,
  SalesSequence,
  SalesSequenceStep,
  SalesTask,
  SalesTasksListResponse,
  SequenceEnrollment,
} from "@/types";

export function useSalesPipelines() {
  return useQuery({
    queryKey: ["sales", "pipelines"],
    queryFn: () => api.get<{ items: SalesPipeline[] }>("/sales/pipelines"),
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pipelineId,
      ...body
    }: {
      pipelineId: string;
      name?: string;
      stages?: Array<{
        stageId?: string;
        key: string;
        label: string;
        sortOrder: number;
        probability?: number;
        isClosed?: boolean;
        outcome?: "won" | "lost";
      }>;
    }) => api.patch<SalesPipeline>(`/sales/pipelines/${pipelineId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "pipelines"] });
      qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
      qc.invalidateQueries({ queryKey: ["sales", "opportunities"] });
    },
  });
}

export function useSalesMetrics(pipelineId?: string) {
  const qs = pipelineId ? `?pipelineId=${pipelineId}` : "";
  return useQuery({
    queryKey: ["sales", "metrics", pipelineId],
    queryFn: () => api.get<SalesFunnelMetrics>(`/sales/metrics${qs}`),
    enabled: pipelineId !== "",
  });
}

export function useOpportunities(options?: {
  pipelineId?: string;
  stageId?: string;
  q?: string;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (options?.pipelineId) params.set("pipelineId", options.pipelineId);
  if (options?.stageId) params.set("stageId", options.stageId);
  if (options?.q) params.set("q", options.q);
  if (options?.cursor) params.set("cursor", options.cursor);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["sales", "opportunities", options],
    queryFn: () => api.get<OpportunitiesListResponse>(`/sales/opportunities${qs}`),
    enabled: !!options?.pipelineId,
  });
}

export function useSalesSequences() {
  return useQuery({
    queryKey: ["sales", "sequences"],
    queryFn: () => api.get<{ items: SalesSequence[] }>("/sales/sequences"),
  });
}

export function useSalesTasks(options?: {
  status?: SalesTask["status"];
  advisorId?: string;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.advisorId) params.set("advisorId", options.advisorId);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["sales", "tasks", options],
    queryFn: () => api.get<SalesTasksListResponse>(`/sales/tasks${qs}`),
  });
}

export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      pipelineId?: string;
      title: string;
      amount?: number;
      currency?: string;
      phone?: string;
      name?: string;
      email?: string;
      description?: string;
      assignedAdvisorId?: string;
    }) => api.post<Opportunity>("/sales/opportunities", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "opportunities"] });
      qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
    },
  });
}

export function useUpdateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      opportunityId,
      ...body
    }: {
      opportunityId: string;
      title?: string;
      amount?: number;
      phone?: string;
      name?: string;
      email?: string;
      description?: string;
      assignedAdvisorId?: string;
    }) => api.patch<Opportunity>(`/sales/opportunities/${opportunityId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "opportunities"] });
      qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
    },
  });
}

export function useMoveOpportunityStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      opportunityId,
      stageId,
      closeReason,
    }: {
      opportunityId: string;
      stageId: string;
      closeReason?: string;
    }) =>
      api.post<Opportunity>(`/sales/opportunities/${opportunityId}/stage`, {
        stageId,
        ...(closeReason ? { closeReason } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "opportunities"] });
      qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
    },
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      enabled?: boolean;
      trigger?: SalesSequence["trigger"];
      steps: SalesSequenceStep[];
    }) => api.post<SalesSequence>("/sales/sequences", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "sequences"] });
    },
  });
}

export function useEnrollOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      opportunityId,
      sequenceId,
      botId,
      assignedAdvisorId,
    }: {
      opportunityId: string;
      sequenceId: string;
      botId?: string;
      assignedAdvisorId?: string;
    }) =>
      api.post<SequenceEnrollment>(`/sales/opportunities/${opportunityId}/enroll/${sequenceId}`, {
        ...(botId ? { botId } : {}),
        ...(assignedAdvisorId ? { assignedAdvisorId } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "opportunities"] });
    },
  });
}

export function useUpdateSalesTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      ...body
    }: {
      taskId: string;
      status?: SalesTask["status"];
      title?: string;
      description?: string;
    }) => api.patch<SalesTask>(`/sales/tasks/${taskId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "tasks"] });
    },
  });
}

export function useCreateSalesTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description?: string;
      opportunityId?: string;
      advisorId?: string;
      dueAt?: string;
    }) => api.post<SalesTask>("/sales/tasks", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "tasks"] });
    },
  });
}
