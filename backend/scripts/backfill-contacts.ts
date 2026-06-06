import { listBots } from "../src/lib/dynamodb/bot.repository.js";
import { listAllConversationsForBot } from "../src/lib/dynamodb/metrics.repository.js";
import { upsertFromConversation } from "../src/lib/dynamodb/contact.repository.js";

const tenantId = process.argv[2];

if (!tenantId) {
  console.error("Usage: npx tsx scripts/backfill-contacts.ts <tenantId>");
  process.exit(1);
}

async function main() {
  const bots = await listBots(tenantId);
  let count = 0;

  for (const bot of bots) {
    const conversations = await listAllConversationsForBot(tenantId, bot.botId);
    for (const conv of conversations) {
      await upsertFromConversation({
        tenantId,
        phoneNumber: conv.phoneNumber,
        displayName: conv.contactName,
        botId: bot.botId,
        source: "sync",
      });
      count++;
    }
  }

  console.log(`Backfilled ${count} contacts for tenant ${tenantId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
