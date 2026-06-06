"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WhatsAppTemplate, TemplateComponent } from "@/types";

export function useTemplates(botId?: string) {
  return useQuery({
    queryKey: ["templates", { botId }],
    queryFn: () =>
      api.get<WhatsAppTemplate[]>(`/templates${botId ? `?botId=${botId}` : ""}`),
    enabled: !!botId,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      botId: string;
      name: string;
      language: string;
      category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
      components: TemplateComponent[];
    }) => api.post<WhatsAppTemplate>("/templates", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      botId: string;
      language: string;
      components: TemplateComponent[];
    }) =>
      api.put<WhatsAppTemplate>(
        `/templates/${data.name}?language=${data.language}`,
        { botId: data.botId, components: data.components }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; botId: string }) =>
      api.delete(`/templates/${data.name}?botId=${data.botId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useSendTemplate() {
  return useMutation({
    mutationFn: (data: {
      name: string;
      botId: string;
      to: string;
      language: string;
      components?: Array<{
        type: string;
        parameters?: Array<{ type: string; text?: string; image?: { link: string } }>;
      }>;
    }) =>
      api.post(`/templates/${data.name}/send`, {
        botId: data.botId,
        to: data.to,
        language: data.language,
        components: data.components,
      }),
  });
}
