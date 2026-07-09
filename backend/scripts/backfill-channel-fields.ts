import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { conversationLookupGsi1pk } from "../src/lib/channels/keys.js";

const TABLE_NAME = process.env.TABLE_NAME ?? "chatbot-platform-dev";
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function main(): Promise<void> {
  let lastKey: Record<string, unknown> | undefined;
  let updated = 0;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":sk": "CONV#" },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );

    for (const item of result.Items ?? []) {
      if (item.channel && item.participantId) continue;
      const phoneNumber = item.phoneNumber as string | undefined;
      if (!phoneNumber) continue;

      const tenantId = item.tenantId as string;
      const botId = item.botId as string;
      const gsi1pk = conversationLookupGsi1pk(tenantId, botId, "whatsapp", phoneNumber);

      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK, SK: item.SK },
          UpdateExpression:
            "SET #channel = :channel, participantId = :participantId, GSI1PK = :gsi1pk",
          ExpressionAttributeNames: { "#channel": "channel" },
          ExpressionAttributeValues: {
            ":channel": "whatsapp",
            ":participantId": phoneNumber,
            ":gsi1pk": gsi1pk,
          },
        })
      );
      updated += 1;
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Backfilled ${updated} conversations`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
