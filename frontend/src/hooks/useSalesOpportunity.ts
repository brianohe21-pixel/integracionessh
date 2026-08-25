"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Company,
  CompaniesListResponse,
  Opportunity,
  OpportunityDetail,
  OpportunityTimelineResponse,
  SequenceEnrollment,
} from "@/types";

export function useOpportunity(opportunityId?: string) {
  return useQuery({
    queryKey: ["sales", "opportunity", opportunityId],
    queryFn: () => api.get<Opportunity>(`/sales/opportunities/${opportunityId}`),
    enabled: !!opportunityId,
  });
}

export function useOpportunityDetail(opportunityId?: string) {
  return useQuery({
    queryKey: ["sales", "opportunity", opportunityId, "detail"],
    queryFn: () => api.get<OpportunityDetail>(`/sales/opportunities/${opportunityId}/detail`),
    enabled: !!opportunityId,
  });
}

export function useOpportunityTimeline(opportunityId?: string) {
  return useQuery({
    queryKey: ["sales", "opportunity", opportunityId, "timeline"],
    queryFn: () =>
      api.get<OpportunityTimelineResponse>(`/sales/opportunities/${opportunityId}/timeline`),
    enabled: !!opportunityId,
  });
}

export function useOpportunityEnrollments(opportunityId?: string) {
  return useQuery({
    queryKey: ["sales", "opportunity", opportunityId, "enrollments"],
    queryFn: () =>
      api.get<{ items: SequenceEnrollment[] }>(
        `/sales/opportunities/${opportunityId}/enrollments`
      ),
    enabled: !!opportunityId,
  });
}

export function useCompanies(options?: { q?: string }) {
  const params = new URLSearchParams();
  if (options?.q) params.set("q", options.q);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return useQuery({
    queryKey: ["sales", "companies", options],
    queryFn: () => api.get<CompaniesListResponse>(`/sales/companies${qs}`),
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      email?: string;
      phone?: string;
      website?: string;
      industry?: string;
      notes?: string;
    }) => api.post<Company>("/sales/companies", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "companies"] }),
  });
}

export function useDeleteOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opportunityId: string) =>
      api.delete(`/sales/opportunities/${opportunityId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "opportunities"] });
      qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
    },
  });
}

export function usePauseEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) =>
      api.post<SequenceEnrollment>(`/sales/enrollments/${enrollmentId}/pause`, {}),
    onSuccess: (_, enrollmentId) => {
      qc.invalidateQueries({ queryKey: ["sales", "opportunity"] });
      void enrollmentId;
    },
  });
}

export function useResumeEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) =>
      api.post<SequenceEnrollment>(`/sales/enrollments/${enrollmentId}/resume`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "opportunity"] }),
  });
}

export function useCancelEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) =>
      api.post<SequenceEnrollment>(`/sales/enrollments/${enrollmentId}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "opportunity"] }),
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sequenceId,
      ...body
    }: {
      sequenceId: string;
      name?: string;
      enabled?: boolean;
      trigger?: string;
      triggerStageId?: string;
      pipelineId?: string;
      steps?: unknown[];
    }) => api.patch(`/sales/sequences/${sequenceId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "sequences"] }),
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sequenceId: string) => api.delete(`/sales/sequences/${sequenceId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "sequences"] }),
  });
}

export function useOpportunityByConversation(conversationId?: string) {
  return useQuery({
    queryKey: ["sales", "conversation-opportunity", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const data = await api.get<{ items: Opportunity[] }>(
        `/sales/opportunities?conversationId=${encodeURIComponent(conversationId)}&limit=10`
      );
      const open = data.items.filter((item) => !item.closedAt);
      return open[0] ?? data.items[0] ?? null;
    },
    enabled: !!conversationId,
  });
}
