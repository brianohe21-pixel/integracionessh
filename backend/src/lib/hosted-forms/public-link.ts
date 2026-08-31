import { randomBytes } from "crypto";

export function generateFormPublicKey(): string {
  return `frm_${randomBytes(24).toString("base64url")}`;
}

export function buildPublicFormUrl(publicKey: string): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/f/${publicKey}`;
}

export function buildFormEmbedSnippet(publicKey: string): string {
  const url = buildPublicFormUrl(publicKey);
  return `<iframe src="${url}?embed=1" title="Form" width="100%" height="720" frameborder="0" style="border:0;min-height:480px;"></iframe>`;
}
