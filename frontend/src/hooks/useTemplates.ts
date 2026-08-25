"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  WhatsAppTemplate,
  SmsTemplate,
  MessageTemplate,
  TemplateComponent,
  OutreachChannel,
} from "@/types";

export function useTemplates(botId?: string, channel: OutreachChannel = "whatsapp") {
  return useQuery({
    queryKey: ["templates", { botId, channel }],
    queryFn: () => {
      const params = new URLSearchParams({ channel });
      if (botId) params.set("botId", botId);
      return api.get<MessageTemplate[]>(`/templates?${params.toString()}`);
    },
  });
}

export function useCreateTemplate(channel: OutreachChannel = "whatsapp") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      botId: string;
      name: string;
      language: string;
      category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
      components?: TemplateComponent[];
      body?: string;
    }) =>
      api.post<MessageTemplate>("/templates", {
        ...data,
        channel,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate(channel: OutreachChannel = "whatsapp") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      botId: string;
      language: string;
      components?: TemplateComponent[];
      body?: string;
    }) =>
      api.put<MessageTemplate>(
        `/templates/${data.name}?language=${data.language}&channel=${channel}`,
        channel === "sms"
          ? { channel: "sms", botId: data.botId, body: data.body ?? "" }
          : { botId: data.botId, components: data.components ?? [] }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate(channel: OutreachChannel = "whatsapp") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; botId: string; language?: string }) =>
      api.delete(
        `/templates/${data.name}?botId=${data.botId}${
          data.language ? `&language=${data.language}` : ""
        }&channel=${channel}`
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useSendTemplate(channel: OutreachChannel = "whatsapp") {
  return useMutation({
    mutationFn: (data: {
      name: string;
      botId: string;
      to: string;
      language: string;
      requestDlr?: boolean;
      components?: Array<{
        type: string;
        parameters?: Array<{ type: string; text?: string; image?: { link: string } }>;
      }>;
    }) =>
      api.post(`/templates/${data.name}/send`, {
        botId: data.botId,
        to: data.to,
        language: data.language,
        channel,
        ...(data.requestDlr ? { requestDlr: true } : {}),
        components: data.components,
      }),
  });
}

export type { WhatsAppTemplate, SmsTemplate, MessageTemplate };
