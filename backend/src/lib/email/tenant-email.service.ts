import {
  clearTenantEmailDomain,
  defaultTenantEmailSettings,
  getTenantEmailSettings,
  mapSesVerificationStatus,
  saveTenantEmailSettings,
} from "../dynamodb/tenant-email.repository.js";
import type { TenantEmailDnsRecord, TenantEmailSettings } from "../../types/index.js";
import {
  buildSesDnsRecords,
  formatEmailFromAddress,
  getSesDomainStatus,
  isEmailOnDomain,
  normalizeEmailDomain,
  startSesDomainVerification,
} from "./ses-domain.js";

export interface TenantEmailSettingsResponse {
  settings: TenantEmailSettings;
  dnsRecords?: TenantEmailDnsRecord[];
  canSend: boolean;
}

function canSendWithSettings(settings: TenantEmailSettings): boolean {
  return Boolean(
    settings.enabled &&
      settings.domainStatus === "verified" &&
      settings.fromEmail?.trim() &&
      settings.domain &&
      isEmailOnDomain(settings.fromEmail, settings.domain)
  );
}

async function refreshDomainStatus(settings: TenantEmailSettings): Promise<TenantEmailSettings> {
  if (!settings.domain) return settings;
  const { verificationStatus } = await getSesDomainStatus(settings.domain);
  const domainStatus = mapSesVerificationStatus(verificationStatus);
  if (domainStatus === settings.domainStatus) return settings;
  return saveTenantEmailSettings(settings.tenantId, { domainStatus });
}

async function buildDnsRecords(domain: string): Promise<TenantEmailDnsRecord[]> {
  const ses = await getSesDomainStatus(domain);
  let verificationToken = "";
  if (ses.verificationStatus !== "Success") {
    const started = await startSesDomainVerification(domain);
    verificationToken = started.verificationToken;
  }
  return buildSesDnsRecords(domain, verificationToken, ses.dkimTokens);
}

async function buildResponse(settings: TenantEmailSettings): Promise<TenantEmailSettingsResponse> {
  let dnsRecords: TenantEmailDnsRecord[] | undefined;
  if (settings.domain && settings.domainStatus !== "verified") {
    dnsRecords = await buildDnsRecords(settings.domain);
  }
  return {
    settings,
    ...(dnsRecords ? { dnsRecords } : {}),
    canSend: canSendWithSettings(settings),
  };
}

export async function getTenantEmailSettingsView(tenantId: string): Promise<TenantEmailSettingsResponse> {
  let settings = await getTenantEmailSettings(tenantId);
  if (!settings) settings = defaultTenantEmailSettings(tenantId);
  if (settings.domain && settings.domainStatus === "pending") {
    settings = await refreshDomainStatus(settings);
  }
  return buildResponse(settings);
}

export async function registerTenantEmailDomain(
  tenantId: string,
  domain: string
): Promise<TenantEmailSettingsResponse> {
  const normalized = normalizeEmailDomain(domain);
  if (!normalized || !normalized.includes(".")) {
    throw Object.assign(new Error("Enter a valid domain like example.com"), { statusCode: 400 });
  }

  await startSesDomainVerification(normalized);
  const settings = await saveTenantEmailSettings(tenantId, {
    domain: normalized,
    domainStatus: "pending",
    enabled: true,
  });
  const dnsRecords = await buildDnsRecords(normalized);
  return {
    settings,
    dnsRecords,
    canSend: false,
  };
}

export async function updateTenantEmailSettings(
  tenantId: string,
  data: { enabled?: boolean; fromEmail?: string; fromName?: string }
): Promise<TenantEmailSettingsResponse> {
  const existing = await getTenantEmailSettings(tenantId);
  const fromEmail = data.fromEmail?.trim().toLowerCase();
  if (fromEmail) {
    const domain = existing?.domain;
    if (!domain || existing?.domainStatus !== "verified") {
      throw Object.assign(new Error("Verify your email domain before setting a sender address"), {
        statusCode: 400,
      });
    }
    if (!isEmailOnDomain(fromEmail, domain)) {
      throw Object.assign(new Error(`Sender address must use the verified domain ${domain}`), {
        statusCode: 400,
      });
    }
  }

  const settings = await saveTenantEmailSettings(tenantId, {
    ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
    ...(fromEmail ? { fromEmail } : data.fromEmail !== undefined ? { fromEmail: "" } : {}),
    ...(data.fromName !== undefined ? { fromName: data.fromName.trim() } : {}),
  });
  return buildResponse(settings);
}

export async function verifyTenantEmailDomain(tenantId: string): Promise<TenantEmailSettingsResponse> {
  const existing = await getTenantEmailSettings(tenantId);
  if (!existing?.domain) {
    throw Object.assign(new Error("No domain configured"), { statusCode: 400 });
  }
  const refreshed = await refreshDomainStatus(existing);
  return buildResponse(refreshed);
}

export async function removeTenantEmailDomain(tenantId: string): Promise<TenantEmailSettingsResponse> {
  const settings = await clearTenantEmailDomain(tenantId);
  return {
    settings,
    canSend: false,
  };
}

export async function resolveTenantOutboundFrom(tenantId: string): Promise<string | null> {
  const settings = await getTenantEmailSettings(tenantId);
  if (!settings || !canSendWithSettings(settings)) return null;
  return formatEmailFromAddress(settings.fromEmail!, settings.fromName);
}
