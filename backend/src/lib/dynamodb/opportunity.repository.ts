import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Opportunity, OpportunityStage } from "../../types/index.js";

const opportunityKeys = (tenantId: string, opportunityId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `OPPORTUNITY#${opportunityId}`,
});

function gsi1Keys(
  tenantId: string,
  stage: OpportunityStage,
  createdAt: string,
  opportunityId: string
) {
  return {
    GSI1PK: `TENANT#${tenantId}#OPPORTUNITIES`,
    GSI1SK: `STAGE#${stage}#${createdAt}#${opportunityId}`,
  };
}

export async function createOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...opportunityKeys(opportunity.tenantId, opportunity.opportunityId),
        ...gsi1Keys(
          opportunity.tenantId,
          opportunity.stage,
          opportunity.createdAt,
          opportunity.opportunityId
        ),
        ...opportunity,
      },
    })
  );
  return opportunity;
}
