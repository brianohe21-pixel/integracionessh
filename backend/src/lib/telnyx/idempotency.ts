import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";

const TTL_SECONDS = 24 * 60 * 60;

function eventKey(eventId: string) {
  return {
    PK: `TELNYX_EVENT#${eventId}`,
    SK: "META",
  };
}

export async function markTelnyxEventProcessed(eventId: string): Promise<boolean> {
  const existing = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: eventKey(eventId),
    })
  );
  if (existing.Item) return false;

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...eventKey(eventId),
        processedAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return true;
}
