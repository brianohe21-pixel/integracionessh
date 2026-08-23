import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { TenantEmailDomainStatus, TenantEmailSettings } from "../../types/index.js";

const configKey = (tenantId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: "APP#email",
});

function strip(item: Record<string, unknown>): TenantEmailSettings {
  const { PK, SK, GSI1PK, GSI1SK, ttl, entityType, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  void ttl;
  void entityType;
  return rest as TenantEmailSettings;
}

export async function getTenantEmailSettings(tenantId: string): Promise<TenantEmailSettings | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: configKey(tenantId) })
  );
  return result.Item ? strip(result.Item) : null;
}

export async function saveTenantEmailSettings(
  tenantId: string,
  data: Partial<
    Pick<TenantEmailSettings, "enabled" | "domain" | "domainStatus" | "fromEmail" | "fromName">
  >
): Promise<TenantEmailSettings> {
  const existing = await getTenantEmailSettings(tenantId);
  const now = new Date().toISOString();
  const settings: TenantEmailSettings = {
    tenantId,
    enabled: data.enabled ?? existing?.enabled ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(data.domain !== undefined ? { domain: data.domain } : existing?.domain ? { domain: existing.domain } : {}),
    ...(data.domainStatus !== undefined
      ? { domainStatus: data.domainStatus }
      : existing?.domainStatus
        ? { domainStatus: existing.domainStatus }
        : {}),
    ...(data.fromEmail !== undefined
      ? { fromEmail: data.fromEmail }
      : existing?.fromEmail
        ? { fromEmail: existing.fromEmail }
        : {}),
    ...(data.fromName !== undefined
      ? { fromName: data.fromName }
      : existing?.fromName
        ? { fromName: existing.fromName }
        : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...configKey(tenantId), entityType: "tenant_email_settings", ...settings },
    })
  );
  return settings;
}

export async function clearTenantEmailDomain(tenantId: string): Promise<TenantEmailSettings> {
  const existing = await getTenantEmailSettings(tenantId);
  const now = new Date().toISOString();
  const settings: TenantEmailSettings = {
    tenantId,
    enabled: existing?.enabled ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(existing?.fromEmail ? { fromEmail: existing.fromEmail } : {}),
    ...(existing?.fromName ? { fromName: existing.fromName } : {}),
    domainStatus: "none",
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...configKey(tenantId), entityType: "tenant_email_settings", ...settings },
    })
  );
  return settings;
}

export function defaultTenantEmailSettings(tenantId: string): TenantEmailSettings {
  const now = new Date().toISOString();
  return {
    tenantId,
    enabled: false,
    domainStatus: "none",
    createdAt: now,
    updatedAt: now,
  };
}

export function mapSesVerificationStatus(
  status: string | undefined
): TenantEmailDomainStatus {
  if (status === "Success") return "verified";
  if (status === "Failed" || status === "TemporaryFailure") return "failed";
  if (status === "Pending" || status === "NotStarted") return "pending";
  return "none";
}
