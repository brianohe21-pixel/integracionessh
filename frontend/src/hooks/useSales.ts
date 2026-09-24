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
  SalesTaskComment,
  SalesTaskCommentsListResponse,
  SalesTasksListResponse,
  SequenceEnrollment,
  TaskReminderWhatsAppSettings,
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
  conversationId?: string;
  assignedAdvisorId?: string;
  companyId?: string;
}) {
  const params = new URLSearchParams();
  if (options?.pipelineId) params.set("pipelineId", options.pipelineId);
  if (options?.stageId) params.set("stageId", options.stageId);
  if (options?.q) params.set("q", options.q);
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.conversationId) params.set("conversationId", options.conversationId);
  if (options?.assignedAdvisorId) params.set("assignedAdvisorId", options.assignedAdvisorId);
  if (options?.companyId) params.set("companyId", options.companyId);
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
  opportunityId?: string;
  conversationId?: string;
  from?: string;
  to?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.advisorId) params.set("advisorId", options.advisorId);
  if (options?.opportunityId) params.set("opportunityId", options.opportunityId);
  if (options?.conversationId) params.set("conversationId", options.conversationId);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.q) params.set("q", options.q);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["sales", "tasks", options],
    queryFn: () => api.get<SalesTasksListResponse>(`/sales/tasks${qs}`),
  });
}

export function useTaskReminderWhatsAppSettings(enabled = true) {
  return useQuery({
    queryKey: ["tenants", "task-reminder-whatsapp"],
    queryFn: () =>
      api.get<Required<TaskReminderWhatsAppSettings>>(
        "/tenants/me/task-reminder-whatsapp"
      ),
    enabled,
  });
}

export function useUpdateTaskReminderWhatsAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskReminderWhatsAppSettings) =>
      api.put<Required<TaskReminderWhatsAppSettings>>(
        "/tenants/me/task-reminder-whatsapp",
        body
      ),
    onSuccess: (data) => {
      qc.setQueryData(["tenants", "task-reminder-whatsapp"], data);
      qc.invalidateQueries({ queryKey: ["tenant"] });
    },
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
      conversationId?: string;
      leadId?: string;
      botId?: string;
      companyId?: string;
    }) => api.post<Opportunity>("/sales/opportunities", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "opportunities"] });
      qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
      qc.invalidateQueries({ queryKey: ["sales", "conversation-opportunity"] });
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
      currency?: string;
      phone?: string;
      name?: string;
      email?: string;
      description?: string;
      assignedAdvisorId?: string;
      companyId?: string;
      companyName?: string;
      expectedCloseDate?: string;
      leadId?: string;
      conversationId?: string;
      quotationId?: string;
      paymentId?: string;
      tags?: string[];
    }) => api.patch<Opportunity>(`/sales/opportunities/${opportunityId}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sales", "opportunities"] });
      qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
      qc.invalidateQueries({ queryKey: ["sales", "opportunity", vars.opportunityId] });
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
      lossReason,
    }: {
      opportunityId: string;
      stageId: string;
      closeReason?: string;
      lossReason?: string;
    }) =>
      api.post<Opportunity>(`/sales/opportunities/${opportunityId}/stage`, {
        stageId,
        ...(closeReason ? { closeReason } : {}),
        ...(lossReason ? { lossReason } : {}),
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
      advisorId?: string;
      leadId?: string | null;
      dueAt?: string | null;
      conversationId?: string;
      botId?: string;
      contactPhone?: string;
      contactEmail?: string | null;
      contactName?: string;
      reminderTargets?: SalesTask["reminderTargets"];
      reminderChannels?: SalesTask["reminderChannels"];
      reminderMinutesBefore?: number;
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
      leadId?: string;
      dueAt?: string;
      conversationId?: string;
      botId?: string;
      contactPhone?: string;
      contactEmail?: string;
      contactName?: string;
      reminderTargets?: SalesTask["reminderTargets"];
      reminderChannels?: SalesTask["reminderChannels"];
      reminderMinutesBefore?: number;
    }) => api.post<SalesTask>("/sales/tasks", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "tasks"] });
    },
  });
}

export function useSalesTaskComments(taskId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["sales", "tasks", taskId, "comments"],
    queryFn: () =>
      api.get<SalesTaskCommentsListResponse>(`/sales/tasks/${taskId}/comments`),
    enabled: Boolean(taskId) && enabled,
  });
}

export function useCreateSalesTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: string }) =>
      api.post<SalesTaskComment>(`/sales/tasks/${taskId}/comments`, { body }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sales", "tasks", vars.taskId, "comments"] });
      qc.invalidateQueries({ queryKey: ["sales", "tasks"] });
    },
  });
}

export function useUpdateSalesTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      commentId,
      body,
    }: {
      taskId: string;
      commentId: string;
      body: string;
    }) => api.patch<SalesTaskComment>(`/sales/tasks/${taskId}/comments/${commentId}`, { body }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sales", "tasks", vars.taskId, "comments"] });
      qc.invalidateQueries({ queryKey: ["sales", "tasks"] });
    },
  });
}

export function useDeleteSalesTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      api.delete(`/sales/tasks/${taskId}/comments/${commentId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sales", "tasks", vars.taskId, "comments"] });
      qc.invalidateQueries({ queryKey: ["sales", "tasks"] });
    },
  });
}
