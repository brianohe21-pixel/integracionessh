import { listBots } from "../src/lib/dynamodb/bot.repository.js";
import { listFlowResponses } from "../src/lib/dynamodb/meta-flow.repository.js";
import { createLeadFromFlowResponse, isLeadCaptureResponse } from "../src/lib/leads/convert.js";
import { getLeadByFlowResponseId } from "../src/lib/dynamodb/lead.repository.js";

const tenantId = process.argv[2];

if (!tenantId) {
  console.error("Usage: npx tsx scripts/backfill-leads.ts <tenantId>");
  process.exit(1);
}

async function main() {
  const bots = await listBots(tenantId);
  let created = 0;
  let skipped = 0;

  for (const bot of bots) {
    const responses = await listFlowResponses(tenantId, bot.botId, 500);
    for (const response of responses) {
      if (!isLeadCaptureResponse(response.responseJson)) {
        skipped++;
        continue;
      }

      const existing = await getLeadByFlowResponseId(tenantId, response.responseId);
      if (existing) {
        skipped++;
        continue;
      }

      const lead = await createLeadFromFlowResponse({
        tenantId,
        botId: response.botId,
        conversationId: response.conversationId,
        phone: response.phone,
        metaFlowId: response.metaFlowId,
        flowResponseId: response.responseId,
        responseJson: response.responseJson,
        createdAt: response.createdAt,
      });

      if (lead) {
        created++;
        console.log(`Created lead ${lead.leadId} for ${response.phone}`);
      } else {
        skipped++;
      }
    }
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
