import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, tableName } from "./dynamo.js";

export async function persistPhoneMessage(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  callId: string;
  role: "user" | "assistant";
  content: string;
  externalId?: string;
}): Promise<void> {
  const content = params.content.trim();
  if (!content || !tableName) return;

  const messageId = `ph-${params.externalId ?? randomUUID()}`;
  const timestamp = new Date().toISOString();

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: `TENANT#${params.tenantId}#CONV#${params.conversationId}`,
              SK: `MSG#${timestamp}#${messageId}`,
              GSI1PK: `TENANT#${params.tenantId}#CONV#${params.conversationId}`,
              GSI1SK: `MSG#${timestamp}`,
              ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
              messageId,
              conversationId: params.conversationId,
              tenantId: params.tenantId,
              role: params.role,
              content,
              channel: "phone",
              callId: params.callId,
              externalMessageId: params.externalId,
              timestamp,
              ...(params.role === "user" ? { source: "phone_inbound" } : {}),
            },
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: {
              PK: `TENANT#${params.tenantId}#BOT#${params.botId}`,
              SK: `CONV#${params.conversationId}`,
            },
            UpdateExpression: "SET messageCount = messageCount + :inc, lastMessageAt = :now",
            ExpressionAttributeValues: {
              ":inc": 1,
              ":now": timestamp,
            },
          },
        },
      ],
    })
  );
}
