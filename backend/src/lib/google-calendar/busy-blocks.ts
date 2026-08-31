import type { CalendarConfig } from "../../types/index.js";
import { queryGoogleFreeBusy } from "./client.js";
import { resolveGoogleCalendarAccessToken } from "./token.js";

export interface ExternalTimeBlock {
  startAt: string;
  endAt: string;
}

export function isGoogleCalendarBlockingEnabled(config: CalendarConfig): boolean {
  return (
    config.provider === "google" &&
    config.googleStatus === "active" &&
    Boolean(config.googleCalendarId) &&
    config.blockExternalEvents !== false
  );
}

export async function fetchGoogleBusyBlocks(params: {
  tenantId: string;
  botId: string;
  config: CalendarConfig;
  from: string;
  to: string;
  environment?: string;
}): Promise<ExternalTimeBlock[]> {
  const { config } = params;
  if (!isGoogleCalendarBlockingEnabled(config) || !config.googleCalendarId) {
    return [];
  }

  const environment = params.environment ?? process.env.ENVIRONMENT ?? "dev";
  const accessToken = await resolveGoogleCalendarAccessToken(
    params.tenantId,
    params.botId,
    environment
  );
  return queryGoogleFreeBusy(accessToken, config.googleCalendarId, params.from, params.to);
}
