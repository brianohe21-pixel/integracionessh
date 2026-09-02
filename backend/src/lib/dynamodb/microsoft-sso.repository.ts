import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export type MicrosoftSsoProtocol = "oidc" | "saml";
export type MicrosoftSsoStatus = "pending" | "active" | "error";

export interface MicrosoftSsoConfig {
  tenantId: string;
  protocol: MicrosoftSsoProtocol;
  enabled: boolean;
  status: MicrosoftSsoStatus;
  cognitoProviderName: string;
  entraTenantId?: string;
  clientId?: string;
  metadataUrl?: string;
  allowedDomains?: string[];
  enforceSso?: boolean;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "failed";
  lastTestMessage?: string;
  createdAt: string;
  updatedAt: string;
}

function configKeys(tenantId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: "SSO#MICROSOFT",
  };
}

function providerLookupKeys(providerName: string) {
  return {
    PK: `SSO_PROVIDER#${providerName}`,
    SK: "METADATA",
  };
}

export function buildMicrosoftProviderName(tenantId: string): string {
  const compact = tenantId.replace(/-/g, "").slice(0, 20);
  return `entra-${compact}`;
}

export async function getMicrosoftSsoConfig(
  tenantId: string
): Promise<MicrosoftSsoConfig | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as MicrosoftSsoConfig;
}

export async function putMicrosoftSsoConfig(config: MicrosoftSsoConfig): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...configKeys(config.tenantId),
        ...config,
      },
    })
  );
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...providerLookupKeys(config.cognitoProviderName),
        tenantId: config.tenantId,
        updatedAt: config.updatedAt,
      },
    })
  );
}

export async function deleteMicrosoftSsoConfig(
  tenantId: string,
  providerName?: string
): Promise<void> {
  const existing = await getMicrosoftSsoConfig(tenantId);
  const resolvedProvider = providerName ?? existing?.cognitoProviderName;
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId),
    })
  );
  if (resolvedProvider) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: providerLookupKeys(resolvedProvider),
      })
    );
  }
}

export async function getTenantIdBySsoProvider(
  providerName: string
): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: providerLookupKeys(providerName),
    })
  );
  const tenantId = result.Item?.tenantId;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
}
