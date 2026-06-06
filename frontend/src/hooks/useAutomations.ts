"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AutomationRule } from "@/types";

export function useAutomations(botId?: string) {
  return useQuery<{ rules: AutomationRule[] }>({
    queryKey: ["automations", botId],
    queryFn: () =>
      api.get<{ rules: AutomationRule[] }>(
        botId ? `/automations?botId=${encodeURIComponent(botId)}` : "/automations"
      ),
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  return useMutation<AutomationRule, Error, Partial<AutomationRule>>({
    mutationFn: (payload) => api.post<AutomationRule>("/automations", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  return useMutation<AutomationRule, Error, { ruleId: string; data: Partial<AutomationRule> }>({
    mutationFn: ({ ruleId, data }) => api.put<AutomationRule>(`/automations/${ruleId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (ruleId) => api.delete(`/automations/${ruleId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });
}

export function useToggleAutomation() {
  const queryClient = useQueryClient();
  return useMutation<AutomationRule, Error, { ruleId: string; enabled: boolean }>({
    mutationFn: ({ ruleId, enabled }) =>
      api.post<AutomationRule>(`/automations/${ruleId}/${enabled ? "enable" : "disable"}`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });
}
