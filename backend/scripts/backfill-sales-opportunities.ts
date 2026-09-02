import { randomUUID } from "crypto";
import {
  listAllOpportunities,
  updateOpportunity,
  appendStageHistory,
  listStageHistory,
} from "../src/lib/dynamodb/opportunity.repository.js";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../src/lib/dynamodb/client.js";

const tenantId = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!tenantId) {
  console.error("Usage: npx tsx scripts/backfill-sales-opportunities.ts <tenantId> [--dry-run]");
  process.exit(1);
}

async function backfillEnrollments(tenantId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": `TENANT#${tenantId}#SEQRUN` },
    })
  );

  let count = 0;
  for (const item of result.Items ?? []) {
    if (!String(item.SK ?? "").startsWith("ENROLLMENT#")) continue;
    const enrollmentId = String(item.enrollmentId ?? "");
    const opportunityId = String(item.opportunityId ?? "");
    if (!enrollmentId || !opportunityId) continue;

    const relKey = {
      PK: `TENANT#${tenantId}`,
      SK: `OPPENR#${opportunityId}#${enrollmentId}`,
    };

    const exists = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        ExpressionAttributeValues: { ":pk": relKey.PK, ":sk": relKey.SK },
      })
    );
    if (exists.Items?.length) continue;

    if (!dryRun) {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            ...relKey,
            tenantId,
            opportunityId,
            enrollmentId,
            createdAt: String(item.createdAt ?? new Date().toISOString()),
          },
        })
      );
    }
    count++;
  }
  return count;
}

async function main() {
  const opportunities = await listAllOpportunities(tenantId);
  let updated = 0;
  let historyCreated = 0;

  for (const opp of opportunities) {
    const patch: Parameters<typeof updateOpportunity>[2] = {};
    if (!opp.stageEnteredAt) patch.stageEnteredAt = opp.createdAt;
    if (!opp.lastActivityAt) patch.lastActivityAt = opp.updatedAt ?? opp.createdAt;

    const history = await listStageHistory(tenantId, opp.opportunityId);
    if (history.length === 0) {
      if (!dryRun) {
        await appendStageHistory({
          historyId: randomUUID(),
          opportunityId: opp.opportunityId,
          tenantId,
          toStageId: opp.stageId,
          toStageKey: opp.stage,
          changedAt: opp.createdAt,
        });
      }
      historyCreated++;
    }

    if (Object.keys(patch).length > 0) {
      if (!dryRun) {
        await updateOpportunity(tenantId, opp.opportunityId, patch);
      }
      updated++;
    }
  }

  const enrollmentLinks = await backfillEnrollments(tenantId);

  console.log(
    JSON.stringify({
      tenantId,
      dryRun,
      opportunities: opportunities.length,
      timestampsUpdated: updated,
      initialHistoryCreated: historyCreated,
      enrollmentLinksCreated: enrollmentLinks,
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
