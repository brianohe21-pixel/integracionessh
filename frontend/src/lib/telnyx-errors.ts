export function formatTelnyxConnectError(
  message: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (message.includes("Invalid Telnyx API key")) {
    return t("telephony.invalidTelnyxApiKey");
  }
  if (message.includes("Telnyx apiKey is required")) {
    return t("telephony.telnyxApiKeyRequired");
  }
  if (message.includes("Phone number is already assigned to agent")) {
    const match = message.match(/agent (.+)$/);
    return t("telephony.phoneNumberAssignedToAgent", { name: match?.[1] ?? "" });
  }
  if (message.includes("Phone number is already assigned to another agent")) {
    return t("telephony.phoneNumberAssignedElsewhere");
  }
  if (message.includes("Telnyx API error")) {
    return message.replace(/^Telnyx API error \(\d+\): /, "").trim() || t("settings.providerSaveError");
  }
  return message;
}

export function formatTelephonyError(
  message: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  return formatTelnyxConnectError(message, t);
}
