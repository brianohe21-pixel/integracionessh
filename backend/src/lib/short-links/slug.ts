import { randomBytes } from "crypto";

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const SLUG_PATTERN = /^[a-zA-Z0-9-]{3,32}$/;

export function generateShortLinkSlug(length = 8): string {
  const bytes = randomBytes(length);
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += SLUG_ALPHABET[bytes[i]! % SLUG_ALPHABET.length];
  }
  return slug;
}

export function buildShortLinkUrl(slug: string): string {
  const base = (
    process.env.API_PUBLIC_URL ??
    process.env.FRONTEND_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/l/${slug}`;
}
