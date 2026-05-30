import { createHash, timingSafeEqual } from "crypto";

const WOMPI_CHECKOUT_URL =
  process.env.WOMPI_CHECKOUT_URL ?? "https://checkout.wompi.co/p/";

const WOMPI_API_BASE =
  process.env.WOMPI_API_BASE ?? "https://production.wompi.co/v1";

export function isWompiConfigured(): boolean {
  return Boolean(
    process.env.WOMPI_PUBLIC_KEY &&
      process.env.WOMPI_INTEGRITY_SECRET &&
      process.env.WOMPI_EVENTS_SECRET
  );
}

export function amountInCentsForPlan(plan: "pro" | "enterprise"): number {
  const raw =
    plan === "pro"
      ? process.env.WOMPI_AMOUNT_PRO_CENTS
      : process.env.WOMPI_AMOUNT_ENTERPRISE_CENTS;
  const parsed = Number(raw);
  if (!parsed || parsed < 100000) {
    return plan === "pro" ? 9_900_000 : 29_900_000;
  }
  return parsed;
}

export function buildIntegritySignature(
  reference: string,
  amountInCents: number,
  currency = "COP"
): string {
  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) throw new Error("WOMPI_INTEGRITY_SECRET is not configured");
  const payload = `${reference}${amountInCents}${currency}${secret}`;
  return createHash("sha256").update(payload).digest("hex");
}

export function buildCheckoutUrl(input: {
  reference: string;
  amountInCents: number;
  redirectUrl: string;
  customerEmail: string;
}): string {
  const publicKey = process.env.WOMPI_PUBLIC_KEY;
  if (!publicKey) throw new Error("WOMPI_PUBLIC_KEY is not configured");

  const signature = buildIntegritySignature(input.reference, input.amountInCents);
  const params = new URLSearchParams({
    "public-key": publicKey,
    currency: "COP",
    "amount-in-cents": String(input.amountInCents),
    reference: input.reference,
    "signature:integrity": signature,
    "redirect-url": input.redirectUrl,
    "customer-data:email": input.customerEmail,
  });

  return `${WOMPI_CHECKOUT_URL}?${params.toString()}`;
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

export function verifyWompiEvent(event: WompiWebhookEvent): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return false;

  let chain = "";
  for (const prop of event.signature.properties) {
    chain += getNestedValue(event.data, prop);
  }
  chain += String(event.timestamp);
  chain += secret;

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
  transactionId: string
): Promise<WompiTransaction | null> {
  const privateKey = process.env.WOMPI_PRIVATE_KEY;
  if (!privateKey) throw new Error("WOMPI_PRIVATE_KEY is not configured");

  const response = await fetch(`${WOMPI_API_BASE}/transactions/${transactionId}`, {
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
