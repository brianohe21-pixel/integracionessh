import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface ShopifyOAuthStateRecord {
  tenantId: string;
  shopDomain: string;
  expiresAt: number;
}

function oauthStateKeys(state: string) {
  return {
    PK: `OAUTH_STATE#SHOPIFY#${state}`,
    SK: "METADATA",
  };
}

export async function putShopifyOAuthState(
  state: string,
  record: Omit<ShopifyOAuthStateRecord, "expiresAt">
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...oauthStateKeys(state),
        ...record,
        expiresAt,
        ttl: expiresAt,
      },
    })
  );
}

export async function consumeShopifyOAuthState(
  state: string
): Promise<ShopifyOAuthStateRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: oauthStateKeys(state),
    })
  );
  if (!result.Item) return null;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: oauthStateKeys(state),
    })
  );

  const tenantId = result.Item.tenantId;
  const shopDomain = result.Item.shopDomain;
  const expiresAt = Number(result.Item.expiresAt ?? 0);
  if (!tenantId || typeof tenantId !== "string") return null;
  if (!shopDomain || typeof shopDomain !== "string") return null;
  if (expiresAt > 0 && expiresAt < Math.floor(Date.now() / 1000)) return null;

  return { tenantId, shopDomain, expiresAt };
}
