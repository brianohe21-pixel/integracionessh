import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface GoogleDriveOAuthStateRecord {
  tenantId: string;
  codeVerifier: string;
  expiresAt: number;
}

function oauthStateKeys(state: string) {
  return {
    PK: `OAUTH_STATE#GOOGLE_DRIVE#${state}`,
    SK: "METADATA",
  };
}

export async function putGoogleDriveOAuthState(
  state: string,
  record: Omit<GoogleDriveOAuthStateRecord, "expiresAt">
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

export async function consumeGoogleDriveOAuthState(
  state: string
): Promise<GoogleDriveOAuthStateRecord | null> {
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
  const codeVerifier = result.Item.codeVerifier;
  const expiresAt = Number(result.Item.expiresAt ?? 0);
  if (!tenantId || typeof tenantId !== "string") return null;
  if (!codeVerifier || typeof codeVerifier !== "string") return null;
  if (expiresAt > 0 && expiresAt < Math.floor(Date.now() / 1000)) return null;

  return { tenantId, codeVerifier, expiresAt };
}
