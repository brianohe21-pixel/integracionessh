import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { ContactCenterQueue } from "../../types/index.js";

function keys(tenantId: string, queueId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `CCQUEUE#${queueId}`,
  };
}

export async function getContactCenterQueue(
  tenantId: string,
  queueId: string
): Promise<ContactCenterQueue | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: keys(tenantId, queueId) })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  void PK;
  void SK;
  return rest as ContactCenterQueue;
}

export async function listContactCenterQueues(
  tenantId: string,
  botId?: string
): Promise<ContactCenterQueue[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "CCQUEUE#",
      },
    })
  );
  const items = (result.Items ?? []).map(({ PK, SK, ...rest }) => {
    void PK;
    void SK;
    return rest as ContactCenterQueue;
  });
  if (!botId) return items;
  return items.filter((queue) => queue.botId === botId);
}

export async function putContactCenterQueue(queue: ContactCenterQueue): Promise<ContactCenterQueue> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...keys(queue.tenantId, queue.queueId), ...queue },
    })
  );
  return queue;
}

export async function deleteContactCenterQueue(tenantId: string, queueId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: keys(tenantId, queueId) })
  );
}
