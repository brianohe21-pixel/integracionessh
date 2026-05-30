import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return secret;
}

export function priceIdForPlan(plan: "pro" | "enterprise"): string {
  const id =
    plan === "pro"
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_ENTERPRISE;
  if (!id) throw new Error(`Stripe price not configured for plan ${plan}`);
  return id;
}

export function planFromPriceId(priceId: string): "pro" | "enterprise" | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return null;
}

export const FRONTEND_URL = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
