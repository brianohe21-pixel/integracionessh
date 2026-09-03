import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { OrganizationTeam } from "../../types/index.js";

function keys(tenantId: string, teamId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `TEAM#${teamId}`,
  };
}

export async function getTeam(
  tenantId: string,
  teamId: string
): Promise<OrganizationTeam | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: keys(tenantId, teamId) })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  void PK;
  void SK;
  return rest as OrganizationTeam;
}

export async function listTeams(tenantId: string): Promise<OrganizationTeam[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "TEAM#",
      },
    })
  );
  return (result.Items ?? []).map(({ PK, SK, ...rest }) => {
    void PK;
    void SK;
    return rest as OrganizationTeam;
  });
}

export async function putTeam(team: OrganizationTeam): Promise<OrganizationTeam> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...keys(team.tenantId, team.teamId), ...team },
    })
  );
  return team;
}

export async function deleteTeam(tenantId: string, teamId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: keys(tenantId, teamId) })
  );
}
