import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, tableName } from "./dynamo.js";

export async function isCalendarEnabled(tenantId: string, botId: string): Promise<boolean> {
  if (!tableName) return false;
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `APP#calendar#BOT#${botId}`,
      },
    })
  );
  return Boolean((result.Item as { enabled?: boolean } | undefined)?.enabled);
}
