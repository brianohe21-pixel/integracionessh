import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DEFAULT_API_KEY_SCOPES, hasAllDefaultScopes } from "../src/lib/api-keys/scopes.js";

const TABLE_NAME = process.env.TABLE_NAME ?? "chatbot-platform-dev";
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function main(): Promise<void> {
  let lastKey: Record<string, unknown> | undefined;
  let updated = 0;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
        ExpressionAttributeValues: {
          ":pk": "APIKEY#",
          ":sk": "METADATA",
        },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );

    for (const item of result.Items ?? []) {
      const scopes = item.scopes as string[] | undefined;
      if (!scopes || hasAllDefaultScopes(scopes)) continue;

      const mergedScopes = [...new Set([...scopes, ...DEFAULT_API_KEY_SCOPES])];
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK, SK: item.SK },
          UpdateExpression: "SET scopes = :scopes, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":scopes": mergedScopes,
            ":updatedAt": new Date().toISOString(),
          },
        })
      );
      updated += 1;
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Backfilled scopes on ${updated} API keys`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
