"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WhatsAppChannel } from "@/types";

export type WhatsAppConnectStatus = "idle" | "connecting" | "connected" | "error";

export interface WhatsAppConnectResult {
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  isOnBizApp?: boolean;
  platformType?: string;
  onboardingMode?: "cloud_api" | "coexistence";
}

export function useWhatsAppConnect(botId?: string) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<WhatsAppConnectStatus>("idle");
  const [error, setError] = useState("");

  const invalidateChannels = useCallback(async () => {
    if (!botId) return;
    await queryClient.invalidateQueries({ queryKey: ["bots", botId, "whatsapp-channels"] });
    await queryClient.invalidateQueries({ queryKey: ["bots", "detail", botId] });
    await queryClient.invalidateQueries({ queryKey: ["bots", "list"] });
  }, [botId, queryClient]);

  const connect = useCallback(
    async (payload: WhatsAppConnectResult & { code: string; pin: string; label?: string }) => {
      setStatus("connecting");
      setError("");

      try {
        const endpoint = botId
          ? `/bots/${encodeURIComponent(botId)}/whatsapp-channels/connect`
          : "/whatsapp/connect";

        const result = await api.post<{
          connected: boolean;
          phoneNumberId: string;
          whatsappBusinessAccountId: string;
          channel?: WhatsAppChannel;
          onboardingMode?: "cloud_api" | "coexistence";
        }>(endpoint, {
          code: payload.code,
          wabaId: payload.whatsappBusinessAccountId,
          phoneNumberId: payload.phoneNumberId,
          pin: payload.pin,
          onboardingMode: "cloud_api",
          ...(payload.label ? { label: payload.label } : {}),
        });

        setStatus("connected");
        await invalidateChannels();
        return {
          phoneNumberId: result.channel?.phoneNumberId ?? result.phoneNumberId,
          whatsappBusinessAccountId:
            result.channel?.whatsappBusinessAccountId ?? result.whatsappBusinessAccountId,
          onboardingMode: result.onboardingMode ?? "cloud_api",
          channel: result.channel,
        };
      } catch (err) {
        setStatus("error");
        const message = (err as Error).message ?? "Connection failed";
        setError(message);
        throw err;
      }
    },
    [botId, invalidateChannels]
  );

  const connectCoexistence = useCallback(
    async (payload: {
      code: string;
      wabaId: string;
      phoneNumberId?: string;
      label?: string;
    }) => {
      setStatus("connecting");
      setError("");

      try {
        const result = await api.post<{
          connected: boolean;
          phoneNumberId: string;
          whatsappBusinessAccountId: string;
          isOnBizApp?: boolean;
          platformType?: string;
          channel?: WhatsAppChannel;
          onboardingMode?: "coexistence";
        }>("/whatsapp/connect-coexistence", {
          code: payload.code,
          wabaId: payload.wabaId,
          ...(payload.phoneNumberId ? { phoneNumberId: payload.phoneNumberId } : {}),
        });

        setStatus("connected");
        await invalidateChannels();
        return {
          phoneNumberId: result.phoneNumberId,
          whatsappBusinessAccountId: result.whatsappBusinessAccountId,
          onboardingMode: "coexistence" as const,
          ...(result.isOnBizApp !== undefined ? { isOnBizApp: result.isOnBizApp } : {}),
          ...(result.platformType ? { platformType: result.platformType } : {}),
          ...(result.channel ? { channel: result.channel } : {}),
        };
      } catch (err) {
        setStatus("error");
        const message = (err as Error).message ?? "Connection failed";
        setError(message);
        throw err;
      }
    },
    [invalidateChannels]
  );

  const connectManual = useCallback(
    async (payload: {
      accessToken: string;
      wabaId: string;
      phoneNumberId: string;
      pin: string;
      label?: string;
    }) => {
      setStatus("connecting");
      setError("");

      try {
        const endpoint = botId
          ? `/bots/${encodeURIComponent(botId)}/whatsapp-channels/connect-manual`
          : "/whatsapp/connect-manual";

        const result = await api.post<{
          connected: boolean;
          phoneNumberId: string;
          whatsappBusinessAccountId: string;
          channel?: WhatsAppChannel;
        }>(endpoint, payload);

        setStatus("connected");
        await invalidateChannels();
        return result;
      } catch (err) {
        setStatus("error");
        const message = (err as Error).message ?? "Connection failed";
        setError(message);
        throw err;
      }
    },
    [botId, invalidateChannels]
  );

  const register = useCallback(
    async (payload: { phoneNumberId: string; pin: string; channelId?: string }) => {
      setStatus("connecting");
      setError("");

      try {
        const endpoint =
          botId && payload.channelId
            ? `/bots/${encodeURIComponent(botId)}/whatsapp-channels/${encodeURIComponent(payload.channelId)}/register`
            : "/whatsapp/register";

        const result = await api.post<{
          registered: boolean;
          phoneNumberId: string;
        }>(endpoint, { pin: payload.pin, phoneNumberId: payload.phoneNumberId });

        setStatus("connected");
        await invalidateChannels();
        return result;
      } catch (err) {
        setStatus("error");
        const message = (err as Error).message ?? "Registration failed";
        setError(message);
        throw err;
      }
    },
    [botId, invalidateChannels]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
  }, []);

  return {
    status,
    error,
    connect,
    connectCoexistence,
    connectManual,
    register,
    reset,
    setStatus,
  };
}
