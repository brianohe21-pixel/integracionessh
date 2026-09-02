import { BatchWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../src/lib/dynamodb/client.js";
import { deleteBot } from "../src/lib/dynamodb/bot.repository.js";
import { deleteFlowDefinition } from "../src/lib/dynamodb/flow.repository.js";
import { deleteConversation } from "../src/lib/dynamodb/conversation.repository.js";
import { assertDemoSeedEnvironment } from "../src/lib/demo/environment.js";
import {
  DEMO_BOT_IDS,
  DEMO_FLOW_IDS,
  DEMO_TENANT_ID,
} from "../src/lib/demo/constants.js";

async function queryAllKeys(pk: string, skPrefix?: string): Promise<Array<{ PK: string; SK: string }>> {
  const keys: Array<{ PK: string; SK: string }> = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: skPrefix
          ? "PK = :pk AND begins_with(SK, :sk)"
          : "PK = :pk",
        ExpressionAttributeValues: skPrefix
          ? { ":pk": pk, ":sk": skPrefix }
          : { ":pk": pk },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );

    for (const item of result.Items ?? []) {
      const pkValue = String(item.PK ?? "");
      const skValue = String(item.SK ?? "");
      if (pkValue && skValue) {
        keys.push({ PK: pkValue, SK: skValue });
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return keys;
}

async function batchDelete(keys: Array<{ PK: string; SK: string }>): Promise<void> {
  for (let index = 0; index < keys.length; index += 25) {
    const chunk = keys.slice(index, index + 25);
    if (!chunk.length) continue;
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map((key) => ({
            DeleteRequest: { Key: key },
          })),
        },
      })
    );
  }
}

export async function wipeDemoTenant(): Promise<void> {
  assertDemoSeedEnvironment();

  for (const botId of DEMO_BOT_IDS) {
    const conversations = await queryAllKeys(`TENANT#${DEMO_TENANT_ID}#BOT#${botId}`, "CONV#");
    for (const item of conversations) {
      const conversationId = item.SK.replace("CONV#", "");
      await deleteConversation(DEMO_TENANT_ID, botId, conversationId).catch(() => undefined);
      const messageKeys = await queryAllKeys(
        `TENANT#${DEMO_TENANT_ID}#CONV#${conversationId}`,
        "MSG#"
      );
      await batchDelete(messageKeys);
    }

    const botPartitionKeys = await queryAllKeys(`TENANT#${DEMO_TENANT_ID}#BOT#${botId}`);
    await batchDelete(botPartitionKeys);
    await deleteBot(DEMO_TENANT_ID, botId).catch(() => undefined);
  }

  for (const flowId of DEMO_FLOW_IDS) {
    await deleteFlowDefinition(DEMO_TENANT_ID, flowId).catch(() => undefined);
  }

  const tenantKeys = await queryAllKeys(`TENANT#${DEMO_TENANT_ID}`);
  await batchDelete(tenantKeys);
}

const isCli = process.argv[1]?.includes("wipe-demo-tenant");
if (isCli) {
  wipeDemoTenant()
    .then(() => {
      console.log(`Wiped demo tenant ${DEMO_TENANT_ID}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
