import { createHash, timingSafeEqual } from "crypto";
import {
  WOMPI_AMOUNT_ENTERPRISE_CENTS_DEFAULT,
  WOMPI_AMOUNT_PRO_CENTS_DEFAULT,
} from "./plan-config.js";

const DEFAULT_CHECKOUT_URL = "https://checkout.wompi.co/p/";
const DEFAULT_API_BASE = "https://production.wompi.co/v1";

export interface WompiCredentials {
  publicKey: string;
  privateKey?: string;
  integritySecret: string;
  eventsSecret: string;
  apiBase?: string;
  checkoutUrl?: string;
}

export function getPlatformWompiCredentials(): WompiCredentials | null {
  const publicKey = process.env.WOMPI_PUBLIC_KEY;
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  if (!publicKey || !integritySecret || !eventsSecret) return null;
  return {
    publicKey,
    integritySecret,
    eventsSecret,
    apiBase: process.env.WOMPI_API_BASE ?? DEFAULT_API_BASE,
    checkoutUrl: process.env.WOMPI_CHECKOUT_URL ?? DEFAULT_CHECKOUT_URL,
    ...(process.env.WOMPI_PRIVATE_KEY ? { privateKey: process.env.WOMPI_PRIVATE_KEY } : {}),
  };
}

export function isWompiConfigured(): boolean {
  return getPlatformWompiCredentials() !== null;
}

export function amountInCentsForPlan(plan: "pro" | "enterprise"): number {
  const raw =
    plan === "pro"
      ? process.env.WOMPI_AMOUNT_PRO_CENTS
      : process.env.WOMPI_AMOUNT_ENTERPRISE_CENTS;
  const parsed = Number(raw);
  if (!parsed || parsed < 100000) {
    return plan === "pro"
      ? WOMPI_AMOUNT_PRO_CENTS_DEFAULT
      : WOMPI_AMOUNT_ENTERPRISE_CENTS_DEFAULT;
  }
  return parsed;
}

export function buildIntegritySignature(
  creds: Pick<WompiCredentials, "integritySecret">,
  reference: string,
  amountInCents: number,
  currency = "COP"
): string {
  const payload = `${reference}${amountInCents}${currency}${creds.integritySecret}`;
  return createHash("sha256").update(payload).digest("hex");
}

export function buildCheckoutUrl(
  creds: Pick<WompiCredentials, "publicKey" | "integritySecret" | "checkoutUrl">,
  input: {
    reference: string;
    amountInCents: number;
    redirectUrl: string;
    customerEmail: string;
    currency?: string;
  }
): string {
  const currency = input.currency ?? "COP";
  const signature = buildIntegritySignature(creds, input.reference, input.amountInCents, currency);
  const checkoutUrl = creds.checkoutUrl ?? DEFAULT_CHECKOUT_URL;
  const params = new URLSearchParams({
    "public-key": creds.publicKey,
    currency,
    "amount-in-cents": String(input.amountInCents),
    reference: input.reference,
    "signature:integrity": signature,
    "redirect-url": input.redirectUrl,
    "customer-data:email": input.customerEmail,
  });

  return `${checkoutUrl}?${params.toString()}`;
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  return current == null ? "" : String(current);
}

export interface WompiWebhookEvent {
  event: string;
  data: Record<string, unknown>;
  environment: string;
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
  sent_at: string;
}

export function verifyWompiEvent(
  creds: Pick<WompiCredentials, "eventsSecret">,
  event: WompiWebhookEvent
): boolean {
  let chain = "";
  for (const prop of event.signature.properties) {
    chain += getNestedValue(event.data, prop);
  }
  chain += String(event.timestamp);
  chain += creds.eventsSecret;

  const calculated = createHash("sha256").update(chain).digest("hex").toUpperCase();
  const expected = event.signature.checksum.toUpperCase();

  try {
    return timingSafeEqual(Buffer.from(calculated), Buffer.from(expected));
  } catch {
    return calculated === expected;
  }
}

export interface WompiTransaction {
  id: string;
  status: string;
  reference: string;
  amount_in_cents: number;
  customer_email?: string;
}

export async function fetchWompiTransaction(
  creds: Pick<WompiCredentials, "privateKey" | "apiBase">,
  transactionId: string
): Promise<WompiTransaction | null> {
  const privateKey = creds.privateKey;
  if (!privateKey) throw new Error("Wompi private key is not configured");

  const apiBase = creds.apiBase ?? DEFAULT_API_BASE;
  const response = await fetch(`${apiBase}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${privateKey}` },
  });

  if (!response.ok) return null;
  const json = (await response.json()) as { data?: WompiTransaction };
  return json.data ?? null;
}

export function buildPaymentReference(
  tenantId: string,
  plan: "pro" | "enterprise"
): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `wompi|${tenantId}|${plan}|${rand}`;
}

export function parsePaymentReference(
  reference: string
): { tenantId: string; plan: "pro" | "enterprise" } | null {
  const parts = reference.split("|");
  if (parts.length < 4 || parts[0] !== "wompi") return null;
  const tenantId = parts[1] ?? "";
  const plan = parts[2];
  if (plan !== "pro" && plan !== "enterprise") return null;
  if (!tenantId) return null;
  return { tenantId, plan };
}

export const FRONTEND_URL = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
