import { randomUUID } from "crypto";
import { badGateway, handleError } from "./http.js";

const SAFE_INTEGRATION_MESSAGES = [
  /pin must be exactly 6 digits/i,
  /phone number is already connected/i,
  /create a bot before/i,
  /not configured/i,
  /multiple phone numbers found/i,
  /no phone numbers found/i,
  /bot not found/i,
  /channel not found/i,
  /whatsapp account connected but no phone number/i,
  /not registered for whatsapp business app coexistence/i,
];

function isSafeIntegrationMessage(message: string): boolean {
  return SAFE_INTEGRATION_MESSAGES.some((pattern) => pattern.test(message));
}

function shouldMaskIntegrationError(error: Error & { statusCode?: number }): boolean {
  const message = error.message ?? "";
  if (isSafeIntegrationMessage(message)) return false;
  if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
    return false;
  }
  if (error.statusCode === 401 || error.statusCode === 403) return true;
  if (error.statusCode === 502 || (error.statusCode ?? 500) >= 500) return true;
  return (
    /failed to exchange/i.test(message) ||
    /graph\.facebook/i.test(message) ||
    /oauth/i.test(message) ||
    /subscribed_apps/i.test(message) ||
    /whatsapp api error/i.test(message)
  );
}

export function handleIntegrationError(
  error: unknown,
  integration: string
): ReturnType<typeof handleError> {
  const err = error as Error & { statusCode?: number };
  if (!shouldMaskIntegrationError(err)) {
    return handleError(error);
  }

  const reference = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  console.error(`[integration:${integration}:${reference}]`, err.message, error);
  return badGateway(`Integration error. Reference: INT-${reference}`);
}
