import { createHmac, timingSafeEqual } from "crypto";
import { promises as dns } from "dns";

const TIMEOUT_MS = 30_000;
const MAX_REPLY_LENGTH = 1_024;
const MAX_RESPONSE_BYTES = 64 * 1024;

const PRIVATE_RANGES: Array<[number, number, number]> = [
  [10, 0, 8],
  [172, 16, 12],
  [192, 168, 16],
  [127, 0, 8],
  [169, 254, 16],
  [0, 0, 8],
  [100, 64, 10],
  [198, 18, 15],
  [240, 0, 4],
];

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const int = ipToInt(ip);
  return PRIVATE_RANGES.some(([base, , bits]) => {
    const mask = bits === 32 ? 0xffffffff : ~(0xffffffff >>> bits);
    return (int & mask) >>> 0 === ipToInt(`${base}.0.0.0`) >>> 0;
  }) || ip === "255.255.255.255";
}

function isPrivateIpv6(ip: string): boolean {
  return (
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80") ||
    ip === "::"
  );
}

export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid webhook URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }

  const hostname = parsed.hostname;

  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Webhook URL hostname is not allowed");
  }

  let address: string;
  try {
    const result = await dns.lookup(hostname, { verbatim: false });
    address = result.address;
    const family = result.family;

    if (family === 4 && isPrivateIpv4(address)) {
      throw new Error("Webhook URL resolves to a private IP address");
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new Error("Webhook URL resolves to a private IP address");
    }
  } catch (err) {
    if ((err as Error).message.includes("private IP")) throw err;
    throw new Error(`Webhook URL hostname could not be resolved: ${hostname}`);
  }
}

export function buildSignature(secret: string, body: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

export function verifyWebhookSignature(secret: string, body: string, signature: string): boolean {
  const expected = buildSignature(secret, body);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

import type { WebhookCallResult } from "../../types/index.js";

export interface WebhookPayload {
  message: string;
  from: string;
  conversationId: string;
  botId: string;
  contact: { name: string };
}

export async function callCustomWebhook(
  webhookUrl: string,
  secret: string | undefined,
  payload: WebhookPayload
): Promise<WebhookCallResult> {
  await assertSafeUrl(webhookUrl);

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ChatBotPlatform/1.0",
  };

  if (secret) {
    headers["X-Webhook-Signature"] = buildSignature(secret, body);
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned HTTP ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new Error("Webhook response exceeds maximum allowed size");
  }

  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("Webhook response exceeds maximum allowed size");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Webhook response is not valid JSON");
  }

  if (
    typeof json !== "object" ||
    json === null ||
    !("reply" in json) ||
    typeof (json as Record<string, unknown>).reply !== "string"
  ) {
    throw new Error('Webhook response must contain a "reply" string field');
  }

  const record = json as { reply: string; handoff?: boolean; reason?: string };
  const reply = record.reply;
  if (reply.length > MAX_REPLY_LENGTH) {
    throw new Error(`Webhook reply exceeds ${MAX_REPLY_LENGTH} characters`);
  }

  return {
    reply,
    handoff: record.handoff === true,
    ...(typeof record.reason === "string" ? { handoffReason: record.reason } : {}),
  };
}
