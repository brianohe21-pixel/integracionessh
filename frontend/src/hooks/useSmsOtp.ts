"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SendSmsOtpInput {
  botId: string;
  to: string;
  message?: string;
  maxAttempts?: number;
}

export interface SendSmsOtpResult {
  destination: string;
  channel: "sms";
  messageId: string;
  expiresAt: string;
  maxAttempts: number;
  traceId?: string;
  timestamp: string;
}

export interface VerifySmsOtpInput {
  to: string;
  code: string;
}

export interface VerifySmsOtpResult {
  verified: boolean;
  reason:
    | "verified"
    | "invalid_code"
    | "expired"
    | "max_attempts"
    | "not_found"
    | "already_verified";
  attemptsRemaining?: number;
  timestamp: string;
}

export function useSendSmsOtp() {
  return useMutation({
    mutationFn: (input: SendSmsOtpInput) =>
      api.post<SendSmsOtpResult>("/metrics/sms/otp/send", input),
  });
}

export function useVerifySmsOtp() {
  return useMutation({
    mutationFn: (input: VerifySmsOtpInput) =>
      api.post<VerifySmsOtpResult>("/metrics/sms/otp/verify", input),
  });
}
