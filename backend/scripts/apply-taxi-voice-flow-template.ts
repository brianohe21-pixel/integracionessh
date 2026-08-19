import { buildTaxi355SatelitalVoiceFlow } from "../src/lib/flow/voice-flow-template.js";
import { getFlowDefinition, updateFlowDefinition } from "../src/lib/dynamodb/flow.repository.js";
import { updateBot } from "../src/lib/dynamodb/bot.repository.js";

async function main() {
  const flowId = process.argv[2];
  const tenantId = process.argv[3];
  const botId = process.argv[4];

  if (!flowId || !tenantId || !botId) {
    console.error(
      "Usage: TABLE_NAME=... ENVIRONMENT=dev npx tsx scripts/apply-taxi-voice-flow-template.ts <flowId> <tenantId> <botId>"
    );
    process.exit(1);
  }

  const existing = await getFlowDefinition(tenantId, flowId);
  if (!existing) {
    console.error("Flow not found");
    process.exit(1);
  }

  const existingVariables =
    existing.nodes.find((node) => node.type === "trigger")?.data.flowVariables ?? {};
  const template = buildTaxi355SatelitalVoiceFlow({
    flowId,
    tenantId,
    botId,
    companyId: existingVariables.company_id ?? "",
    now: existing.createdAt,
  });

  const triggerNode = template.nodes.find((node) => node.type === "trigger");
  if (triggerNode?.data) {
    triggerNode.data.flowVariables = {
      ...triggerNode.data.flowVariables,
      ...existingVariables,
      default_city: existingVariables.default_city ?? "Lima",
      default_country: existingVariables.default_country ?? "Perú",
      default_currency: existingVariables.default_currency ?? "PEN",
      default_customer_id: existingVariables.default_customer_id ?? "demo-customer-001",
    };
  }

  const updated = await updateFlowDefinition(tenantId, flowId, {
    ...template,
    name: existing.name?.trim() || template.name,
    enabled: existing.enabled,
    createdAt: existing.createdAt,
    version: (existing.version ?? 0) + 1,
  });

  await updateBot(tenantId, botId, { telephonyVoiceFlowId: flowId });

  console.log(
    JSON.stringify(
      {
        flowId: updated?.flowId,
        name: updated?.name,
        nodeCount: updated?.nodes.length,
        edgeCount: updated?.edges.length,
        botId,
        telephonyVoiceFlowId: flowId,
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
