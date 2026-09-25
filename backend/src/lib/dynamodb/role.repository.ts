import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { listMembers } from "./member.repository.js";

export interface CustomRole {
  roleId: string;
  tenantId: string;
  name: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

const roleKeys = (tenantId: string, roleId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `ROLE#${roleId}`,
});

export async function getCustomRole(
  tenantId: string,
  roleId: string
): Promise<CustomRole | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: roleKeys(tenantId, roleId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as CustomRole;
}

export async function listCustomRoles(tenantId: string): Promise<CustomRole[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "ROLE#",
      },
    })
  );

  return (result.Items ?? [])
    .map(({ PK, SK, ...rest }) => rest as CustomRole)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function putCustomRole(role: CustomRole): Promise<CustomRole> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...roleKeys(role.tenantId, role.roleId),
        ...role,
      },
    })
  );
  return role;
}

export async function deleteCustomRole(tenantId: string, roleId: string): Promise<boolean> {
  const existing = await getCustomRole(tenantId, roleId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: roleKeys(tenantId, roleId),
    })
  );
  return true;
}

export async function countMembersWithCustomRole(
  tenantId: string,
  roleId: string
): Promise<number> {
  const members = await listMembers(tenantId);
  return members.filter((member) => member.customRoleId === roleId).length;
}
