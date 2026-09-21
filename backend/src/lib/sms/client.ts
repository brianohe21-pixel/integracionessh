import { getTelcoredAuthorizationHeader } from "./secrets.js";

const TELCORED_MESSAGE_URL = "https://omnicanal.telcoredsas.com/Api/rest/message";
const REQUEST_TIMEOUT_MS = 15_000;

export function normalizeTelcoredSender(value: string): string {
  return value.trim();
}

export function isValidTelcoredSender(value: string): boolean {
  const sender = normalizeTelcoredSender(value);
  if (!sender) return false;
  if (/^\d{1,15}$/.test(sender)) return true;
  if (/^[a-zA-Z0-9]{1,11}$/.test(sender)) return true;
  return false;
}

function looksLikeInboundSmsNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10;
}

export function shouldRegisterSmsInboundLookup(value: string): boolean {
  return looksLikeInboundSmsNumber(value);
}

export async function sendSmsTextMessage(params: {
  phoneNumber: string;
  text: string;
  from: string;
  environment?: string;
  dlrUrl?: string;
  part?: boolean;
}): Promise<{ messageId: string }> {
  const environment = params.environment ?? process.env.ENVIRONMENT ?? "dev";
  const authorization = await getTelcoredAuthorizationHeader(environment);
  const to = params.phoneNumber.replace(/\D/g, "");
  const from = normalizeTelcoredSender(params.from);

  if (!to) {
    throw Object.assign(new Error("SMS recipient phone number is required"), { statusCode: 400 });
  }
  if (!params.text.trim()) {
    throw Object.assign(new Error("SMS message text is required"), { statusCode: 400 });
  }
  if (!isValidTelcoredSender(from)) {
    throw Object.assign(new Error("Invalid Telcored SMS sender label"), { statusCode: 400 });
  }

  const enableMultipart = params.part ?? true;

  const response = await fetch(TELCORED_MESSAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({
      to: [to],
      text: params.text,
      from,
      ...(enableMultipart ? { part: true } : {}),
      ...(params.dlrUrl ? { "dlr-url": params.dlrUrl } : {}),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw Object.assign(
      new Error(`Telcored API error ${response.status}: ${rawBody}`),
      { statusCode: 502 }
    );
  }

  let messageId = `sms-${Date.now()}`;
  if (rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody) as {
        messageId?: string;
        id?: string;
        messages?: Array<{ id?: string; messageId?: string }>;
      };
      messageId =
        parsed.messageId ??
        parsed.id ??
        parsed.messages?.[0]?.messageId ??
        parsed.messages?.[0]?.id ??
        messageId;
    } catch {
      messageId = `sms-${Date.now()}`;
    }
  }

  return { messageId };
}
