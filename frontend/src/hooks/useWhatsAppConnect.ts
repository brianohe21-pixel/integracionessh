"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";

export type WhatsAppConnectStatus = "idle" | "connecting" | "connected" | "error";

export interface WhatsAppConnectResult {
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
}

export function useWhatsAppConnect() {
  const [status, setStatus] = useState<WhatsAppConnectStatus>("idle");
  const [error, setError] = useState("");

  const connect = useCallback(async (payload: WhatsAppConnectResult & { code: string }) => {
    setStatus("connecting");
    setError("");

    try {
      const result = await api.post<{
        connected: boolean;
        phoneNumberId: string;
        whatsappBusinessAccountId: string;
      }>("/whatsapp/connect", {
        code: payload.code,
        wabaId: payload.whatsappBusinessAccountId,
        phoneNumberId: payload.phoneNumberId,
      });

      setStatus("connected");
      return result;
    } catch (err) {
      setStatus("error");
      const message = (err as Error).message ?? "Connection failed";
      setError(message);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
  }, []);

  return { status, error, connect, reset, setStatus };
}
