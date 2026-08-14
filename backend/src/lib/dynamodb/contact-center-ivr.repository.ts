import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { ContactCenterIvrFlow } from "../../types/index.js";

function keys(tenantId: string, ivrFlowId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `CCIVR#${ivrFlowId}`,
  };
}

export async function getContactCenterIvrFlow(
  tenantId: string,
  ivrFlowId: string
): Promise<ContactCenterIvrFlow | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: keys(tenantId, ivrFlowId) })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  void PK;
  void SK;
  return rest as ContactCenterIvrFlow;
}

export async function listContactCenterIvrFlows(
  tenantId: string,
  botId?: string
): Promise<ContactCenterIvrFlow[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "CCIVR#",
      },
    })
  );
  const items = (result.Items ?? []).map(({ PK, SK, ...rest }) => {
    void PK;
    void SK;
    return rest as ContactCenterIvrFlow;
  });
  if (!botId) return items;
  return items.filter((flow) => flow.botId === botId);
}

export async function putContactCenterIvrFlow(
  flow: ContactCenterIvrFlow
): Promise<ContactCenterIvrFlow> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...keys(flow.tenantId, flow.ivrFlowId), ...flow },
    })
  );
  return flow;
}

export async function deleteContactCenterIvrFlow(
  tenantId: string,
  ivrFlowId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: keys(tenantId, ivrFlowId) })
  );
}
