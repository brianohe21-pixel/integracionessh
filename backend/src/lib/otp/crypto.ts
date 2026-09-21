import { createHash, randomInt, timingSafeEqual } from "crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;
export const OTP_DEFAULT_MAX_ATTEMPTS = 3;

export function generateOtpCode(length = OTP_LENGTH): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
}

export function hashOtpCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function generateOtpSalt(): string {
  return createHash("sha256").update(`${Date.now()}:${randomInt(0, 1_000_000_000)}`).digest("hex");
}

export function verifyOtpCodeHash(code: string, salt: string, expectedHash: string): boolean {
  const actual = hashOtpCode(code, salt);
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function normalizeOtpDestination(to: string): string {
  return to.replace(/\D/g, "");
}

export function hashOtpDestination(tenantId: string, to: string): string {
  return createHash("sha256").update(`${tenantId}:${normalizeOtpDestination(to)}`).digest("hex");
}

export function renderOtpMessage(template: string, code: string): string {
  return template.replace(/\{\{code\}\}/g, code);
}
