import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, tableName } from "./dynamo.js";
import type { TelephonySession } from "./types.js";

export async function getSessionByStreamToken(
  streamToken: string
): Promise<TelephonySession | null> {
  const index = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `TELEPHONY_STREAM#${streamToken}`,
        SK: "META",
      },
    })
  );
  const sessionId = index.Item?.sessionId as string | undefined;
  if (!sessionId) return null;

  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `TELEPHONY_SESSION#${sessionId}`,
        SK: "META",
      },
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  void PK;
  void SK;
  return rest as TelephonySession;
}
