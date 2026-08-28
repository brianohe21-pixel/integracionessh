import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export type GoogleBusinessStatus = "pending" | "active" | "error";

export interface GoogleBusinessLocation {
  id: string;
  name: string;
  address?: string;
}

export interface GoogleBusinessConfig {
  tenantId: string;
  enabled: boolean;
  status: GoogleBusinessStatus;
  googleAccountEmail?: string;
  googleAccountId?: string;
  selectedLocationIds: string[];
  locations?: GoogleBusinessLocation[];
  connectedAt?: string;
  updatedAt: string;
}

export interface OAuthStateRecord {
  tenantId: string;
  expiresAt: number;
}

function configKeys(tenantId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: "INTEGRATION#GOOGLE_BUSINESS",
  };
}

function oauthStateKeys(state: string) {
  return {
    PK: `OAUTH_STATE#${state}`,
    SK: "METADATA",
  };
}

export async function getGoogleBusinessConfig(
  tenantId: string
): Promise<GoogleBusinessConfig | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as GoogleBusinessConfig;
}

export async function putGoogleBusinessConfig(config: GoogleBusinessConfig): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...configKeys(config.tenantId),
        ...config,
      },
    })
  );
}

export async function deleteGoogleBusinessConfig(tenantId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId),
    })
  );
}

export async function putOAuthState(state: string, tenantId: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...oauthStateKeys(state),
        tenantId,
        expiresAt,
        ttl: expiresAt,
      },
    })
  );
}

export async function consumeOAuthState(state: string): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: oauthStateKeys(state),
    })
  );
  if (!result.Item) return null;
  const tenantId = result.Item.tenantId;
  const expiresAt = Number(result.Item.expiresAt ?? 0);
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: oauthStateKeys(state),
    })
  );
  if (!tenantId || typeof tenantId !== "string") return null;
  if (expiresAt > 0 && expiresAt < Math.floor(Date.now() / 1000)) return null;
  return tenantId;
}
