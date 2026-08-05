import { createHash, randomBytes } from "crypto";

const HOOK_KEY_PREFIX = "fhk_";
const HOOK_SECRET_PREFIX = "fhs_";

export function generateFlowHookKey(): string {
  return `${HOOK_KEY_PREFIX}${randomBytes(16).toString("hex")}`;
}

export function generateFlowHookSecret(): string {
  return `${HOOK_SECRET_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function hashFlowHookSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function buildFlowHookUrl(hookKey: string): string {
  const base =
    process.env.API_BASE_URL ??
    process.env.API_PUBLIC_URL ??
    process.env.PUBLIC_API_URL ??
    "";
  return `${base.replace(/\/$/, "")}/public/flow-hooks/${hookKey}`;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
