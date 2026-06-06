import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "sk_live_";
const KEY_DISPLAY_PREFIX_LENGTH = 12;

export function generateApiKey(): string {
  const secret = randomBytes(32).toString("hex");
  return `${KEY_PREFIX}${secret}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, KEY_DISPLAY_PREFIX_LENGTH);
}
