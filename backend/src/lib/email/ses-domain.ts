import {
  GetIdentityDkimAttributesCommand,
  GetIdentityVerificationAttributesCommand,
  SESClient,
  VerifyDomainDkimCommand,
  VerifyDomainIdentityCommand,
} from "@aws-sdk/client-ses";
import type { TenantEmailDnsRecord } from "../../types/index.js";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export function normalizeEmailDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return normalizeEmailDomain(trimmed.slice(at + 1));
}

export function isEmailOnDomain(email: string, domain: string): boolean {
  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) return false;
  const normalized = normalizeEmailDomain(domain);
  return emailDomain === normalized || emailDomain.endsWith(`.${normalized}`);
}

export async function startSesDomainVerification(domain: string): Promise<{
  verificationToken: string;
  dkimTokens: string[];
}> {
  const normalized = normalizeEmailDomain(domain);
  const identity = await ses.send(new VerifyDomainIdentityCommand({ Domain: normalized }));
  const dkim = await ses.send(new VerifyDomainDkimCommand({ Domain: normalized }));
  return {
    verificationToken: identity.VerificationToken ?? "",
    dkimTokens: dkim.DkimTokens ?? [],
  };
}

export async function getSesDomainStatus(domain: string): Promise<{
  verificationStatus: string | undefined;
  dkimTokens: string[];
}> {
  const normalized = normalizeEmailDomain(domain);
  const verification = await ses.send(
    new GetIdentityVerificationAttributesCommand({ Identities: [normalized] })
  );
  const dkim = await ses.send(new GetIdentityDkimAttributesCommand({ Identities: [normalized] }));
  const attrs = verification.VerificationAttributes?.[normalized];
  const dkimAttrs = dkim.DkimAttributes?.[normalized];
  return {
    verificationStatus: attrs?.VerificationStatus,
    dkimTokens: dkimAttrs?.DkimTokens ?? [],
  };
}

export function buildSesDnsRecords(
  domain: string,
  verificationToken: string,
  dkimTokens: string[]
): TenantEmailDnsRecord[] {
  const normalized = normalizeEmailDomain(domain);
  const records: TenantEmailDnsRecord[] = [
    {
      type: "TXT",
      name: `_amazonses.${normalized}`,
      value: verificationToken,
      purpose: "verification",
    },
  ];
  for (const token of dkimTokens) {
    records.push({
      type: "CNAME",
      name: `${token}._domainkey.${normalized}`,
      value: `${token}.dkim.amazonses.com`,
      purpose: "dkim",
    });
  }
  return records;
}

export function formatEmailFromAddress(fromEmail: string, fromName?: string): string {
  const email = fromEmail.trim();
  const name = fromName?.trim();
  if (!name) return email;
  const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${email}>`;
}
