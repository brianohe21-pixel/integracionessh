import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { VoiceCampaign, VoiceCampaignAttempt } from "../../types/index.js";

function campaignKeys(tenantId: string, campaignId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `VCCAMPAIGN#${campaignId}`,
  };
}

function attemptKeys(tenantId: string, campaignId: string, createdAt: string, attemptId: string) {
  return {
    PK: `TENANT#${tenantId}#VCCAMPAIGN#${campaignId}`,
    SK: `ATTEMPT#${createdAt}#${attemptId}`,
  };
}

export async function getVoiceCampaign(
  tenantId: string,
  campaignId: string
): Promise<VoiceCampaign | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: campaignKeys(tenantId, campaignId) })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  void PK;
  void SK;
  return rest as VoiceCampaign;
}

export async function listVoiceCampaigns(tenantId: string, botId?: string): Promise<VoiceCampaign[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "VCCAMPAIGN#",
      },
    })
  );
  const items = (result.Items ?? []).map(({ PK, SK, ...rest }) => {
    void PK;
    void SK;
    return rest as VoiceCampaign;
  });
  if (!botId) return items;
  return items.filter((campaign) => campaign.botId === botId);
}

export async function putVoiceCampaign(campaign: VoiceCampaign): Promise<VoiceCampaign> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...campaignKeys(campaign.tenantId, campaign.campaignId), ...campaign },
    })
  );
  return campaign;
}

export async function putVoiceCampaignAttempt(
  attempt: VoiceCampaignAttempt
): Promise<VoiceCampaignAttempt> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...attemptKeys(attempt.tenantId, attempt.campaignId, attempt.createdAt, attempt.attemptId),
        ...attempt,
      },
    })
  );
  return attempt;
}

export async function listVoiceCampaignAttempts(
  tenantId: string,
  campaignId: string
): Promise<VoiceCampaignAttempt[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#VCCAMPAIGN#${campaignId}`,
        ":sk": "ATTEMPT#",
      },
    })
  );
  return (result.Items ?? []).map(({ PK, SK, ...rest }) => {
    void PK;
    void SK;
    return rest as VoiceCampaignAttempt;
  });
}

export async function listRunningVoiceCampaigns(tenantId: string): Promise<VoiceCampaign[]> {
  const campaigns = await listVoiceCampaigns(tenantId);
  return campaigns.filter((campaign) => campaign.status === "running");
}
