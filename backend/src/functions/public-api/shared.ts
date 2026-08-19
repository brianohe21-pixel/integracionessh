import type { ApiKey } from "../../types/index.js";
import type { checkAndIncrement } from "../../lib/rate-limiter/index.js";

export interface PublicApiAuth {
  apiKey: ApiKey;
  hashedKey: string;
  rateResult: Awaited<ReturnType<typeof checkAndIncrement>>;
  successHeaders: (
    apiKey: ApiKey,
    rateResult: Awaited<ReturnType<typeof checkAndIncrement>>
  ) => Record<string, string>;
  logUsage: (params: {
    apiKey: ApiKey;
    hashedKey: string;
    endpoint: string;
    method: string;
    statusCode: number;
    durationMs: number;
    messageId?: string;
    callId?: string;
    maskedPhone?: string;
    errorMessage?: string;
    errorStack?: string;
  }) => Promise<void>;
  maskPhone: (phone: string) => string;
}
