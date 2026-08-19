"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";

export type WhatsAppConnectStatus = "idle" | "connecting" | "connected" | "error";

export interface WhatsAppConnectResult {
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  isOnBizApp?: boolean;
  platformType?: string;
  onboardingMode?: "cloud_api" | "coexistence";
}

export function useWhatsAppConnect() {
  const [status, setStatus] = useState<WhatsAppConnectStatus>("idle");
  const [error, setError] = useState("");

  const connect = useCallback(
    async (payload: WhatsAppConnectResult & { code: string; pin: string }) => {
      setStatus("connecting");
      setError("");

      try {
        const result = await api.post<{
          connected: boolean;
          phoneNumberId: string;
          whatsappBusinessAccountId: string;
          onboardingMode?: "cloud_api" | "coexistence";
        }>("/whatsapp/connect", {
          code: payload.code,
          wabaId: payload.whatsappBusinessAccountId,
          phoneNumberId: payload.phoneNumberId,
          pin: payload.pin,
          onboardingMode: "cloud_api",
        });

        setStatus("connected");
        return {
          phoneNumberId: result.phoneNumberId,
          whatsappBusinessAccountId: result.whatsappBusinessAccountId,
          onboardingMode: result.onboardingMode ?? "cloud_api",
        };
      } catch (err) {
        setStatus("error");
        const message = (err as Error).message ?? "Connection failed";
        setError(message);
        throw err;
      }
    },
    []
  );

  const connectCoexistence = useCallback(
    async (payload: { code: string; wabaId: string; phoneNumberId?: string }) => {
      setStatus("connecting");
      setError("");

      try {
        const result = await api.post<{
          connected: boolean;
          phoneNumberId: string;
          whatsappBusinessAccountId: string;
          isOnBizApp?: boolean;
          platformType?: string;
          onboardingMode?: "coexistence";
        }>("/whatsapp/connect-coexistence", {
          code: payload.code,
          wabaId: payload.wabaId,
          phoneNumberId: payload.phoneNumberId,
        });

        setStatus("connected");
        return {
          phoneNumberId: result.phoneNumberId,
          whatsappBusinessAccountId: result.whatsappBusinessAccountId,
          onboardingMode: "coexistence" as const,
          ...(result.isOnBizApp !== undefined ? { isOnBizApp: result.isOnBizApp } : {}),
          ...(result.platformType ? { platformType: result.platformType } : {}),
        };
      } catch (err) {
        setStatus("error");
        const message = (err as Error).message ?? "Connection failed";
        setError(message);
        throw err;
      }
    },
    []
  );

  const register = useCallback(async (payload: { phoneNumberId: string; pin: string }) => {
    setStatus("connecting");
    setError("");

    try {
      const result = await api.post<{
        registered: boolean;
        phoneNumberId: string;
      }>("/whatsapp/register", payload);

      setStatus("connected");
      return result;
    } catch (err) {
      setStatus("error");
      const message = (err as Error).message ?? "Registration failed";
      setError(message);
      throw err;
    }
  }, []);

  const connectManual = useCallback(
    async (payload: {
      accessToken: string;
      wabaId: string;
      phoneNumberId: string;
      pin: string;
    }) => {
      setStatus("connecting");
      setError("");

      try {
        const result = await api.post<{
          connected: boolean;
          phoneNumberId: string;
          whatsappBusinessAccountId: string;
        }>("/whatsapp/connect-manual", payload);

        setStatus("connected");
        return result;
      } catch (err) {
        setStatus("error");
        const message = (err as Error).message ?? "Connection failed";
        setError(message);
        throw err;
      }
    },
    []
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
