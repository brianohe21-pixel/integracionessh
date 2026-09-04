"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WhatsAppChannel } from "@/types";

function whatsAppChannelsQueryKey(botId: string) {
  return ["bots", botId, "whatsapp-channels"] as const;
}

export function useWhatsAppChannels(botId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: whatsAppChannelsQueryKey(botId),
    queryFn: async () => {
      const response = await api.get<{ channels: WhatsAppChannel[] }>(
        `/bots/${encodeURIComponent(botId)}/whatsapp-channels`
      );
      return response.channels ?? [];
    },
    enabled: Boolean(botId) && (options?.enabled ?? true),
  });
}

export function useUpdateWhatsAppChannel(botId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      channelId: string;
      label?: string;
      isDefault?: boolean;
    }) =>
      api.patch<{ channel: WhatsAppChannel }>(
        `/bots/${encodeURIComponent(botId)}/whatsapp-channels/${encodeURIComponent(input.channelId)}`,
        {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: whatsAppChannelsQueryKey(botId) });
      await queryClient.invalidateQueries({ queryKey: ["bots", "detail", botId] });
      await queryClient.invalidateQueries({ queryKey: ["bots", "list"] });
    },
  });
}

export function useDeleteWhatsAppChannel(botId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) =>
      api.delete(
        `/bots/${encodeURIComponent(botId)}/whatsapp-channels/${encodeURIComponent(channelId)}`
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: whatsAppChannelsQueryKey(botId) });
      await queryClient.invalidateQueries({ queryKey: ["bots", "detail", botId] });
      await queryClient.invalidateQueries({ queryKey: ["bots", "list"] });
    },
  });
}

export function useRegisterWhatsAppChannel(botId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { channelId: string; pin: string }) =>
      api.post<{ registered: boolean; channelId: string }>(
        `/bots/${encodeURIComponent(botId)}/whatsapp-channels/${encodeURIComponent(input.channelId)}/register`,
        { pin: input.pin }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: whatsAppChannelsQueryKey(botId) });
      await queryClient.invalidateQueries({ queryKey: ["bots", "detail", botId] });
    },
  });
}

export function useClearWhatsAppEnforcement(botId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) =>
      api.post<{ channel: WhatsAppChannel }>(
        `/bots/${encodeURIComponent(botId)}/whatsapp-channels/${encodeURIComponent(channelId)}/clear-enforcement`,
        {}
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: whatsAppChannelsQueryKey(botId) });
      await queryClient.invalidateQueries({ queryKey: ["bots", "detail", botId] });
      await queryClient.invalidateQueries({ queryKey: ["bots", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-risk"] });
    },
  });
}

export interface WhatsAppTestSendInput {
  channelId?: string;
  to: string;
  templateName?: string;
  language?: string;
  phoneNumberId?: string;
}

export interface WhatsAppTestSendResponse {
  messageId: string | null;
  status: string;
  to: string;
  phoneNumberId: string;
  templateName: string;
  language: string;
  curl: string;
}

export function useWhatsAppTestSend(botId: string) {
  return useMutation({
    mutationFn: (input: WhatsAppTestSendInput) => {
      const path = input.channelId
        ? `/bots/${encodeURIComponent(botId)}/whatsapp-channels/${encodeURIComponent(input.channelId)}/test-send`
        : `/bots/${encodeURIComponent(botId)}/whatsapp-channels/test-send`;
      return api.post<WhatsAppTestSendResponse>(path, {
        to: input.to,
        ...(input.templateName ? { templateName: input.templateName } : {}),
        ...(input.language ? { language: input.language } : {}),
        ...(input.phoneNumberId ? { phoneNumberId: input.phoneNumberId } : {}),
      });
    },
  });
}
