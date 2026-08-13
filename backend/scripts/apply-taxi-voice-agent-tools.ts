import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../src/lib/dynamodb/client.js";
import type { Bot } from "../src/types/index.js";
import { applyTaxi355VoiceAgentTools } from "../src/lib/voicebot/apply-taxi-voice-agent-tools.js";

async function findBotById(botId: string): Promise<Bot | null> {
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": `BOT#${botId}` },
        ExclusiveStartKey: lastKey,
        Limit: 25,
      })
    );
    const item = result.Items?.[0];
    if (item) {
      const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
      return rest as Bot;
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return null;
}

async function main() {
  const botId = process.argv[2];
  const tenantIdArg = process.argv[3];

  if (!botId) {
    console.error(
      "Usage: TABLE_NAME=... ENVIRONMENT=dev npx tsx scripts/apply-taxi-voice-agent-tools.ts <botId> [tenantId]"
    );
    process.exit(1);
  }

  let tenantId = tenantIdArg;
  if (!tenantId) {
    const bot = await findBotById(botId);
    if (!bot) {
      console.error("Bot not found. Provide tenantId as second argument.");
      process.exit(1);
    }
    tenantId = bot.tenantId;
  }

  const result = await applyTaxi355VoiceAgentTools({
    tenantId,
    botId,
    updateSystemPrompt: true,
  });

  console.log(
    JSON.stringify(
      {
        tenantId,
        botId,
        ...result,
        secretNames: ["FYRAGO_API_KEY", "COMPANY_ID", "DEFAULT_CUSTOMER_ID"],
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
