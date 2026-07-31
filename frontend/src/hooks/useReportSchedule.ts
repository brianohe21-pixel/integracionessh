"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsReportSchedule } from "@/types";

async function fetchReportSchedule(): Promise<MetricsReportSchedule> {
  return api.get<MetricsReportSchedule>("/tenants/me/report-schedule");
}

export function useReportSchedule() {
  return useQuery({
    queryKey: ["report-schedule"],
    queryFn: fetchReportSchedule,
  });
}

export function useSaveReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: MetricsReportSchedule) =>
      api.put<MetricsReportSchedule>("/tenants/me/report-schedule", schedule),
    onSuccess: (data) => {
      queryClient.setQueryData(["report-schedule"], data);
    },
  });
}

export function useSendReportNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MetricsReportSchedule>("/tenants/me/report-schedule/send-now", {}),
    onSuccess: (data) => {
      queryClient.setQueryData(["report-schedule"], data);
    },
  });
}
