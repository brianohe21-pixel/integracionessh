import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { TenantMember } from "../../types/index.js";

const memberKeys = (tenantId: string, userId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `MEMBER#${userId}`,
});

export async function getMember(
  tenantId: string,
  userId: string
): Promise<TenantMember | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: memberKeys(tenantId, userId),
    })
  );

  if (!result.Item) return null;

  const { PK, SK, ...rest } = result.Item;
  return rest as TenantMember;
}

export async function listMembers(tenantId: string): Promise<TenantMember[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "MEMBER#",
      },
    })
  );

  return (result.Items ?? []).map(({ PK, SK, ...rest }) => rest as TenantMember);
}

export async function putMember(member: TenantMember, tenantId: string): Promise<TenantMember> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...memberKeys(tenantId, member.userId),
        ...member,
      },
    })
  );

  return member;
}

export async function deleteMember(tenantId: string, userId: string): Promise<boolean> {
  const existing = await getMember(tenantId, userId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: memberKeys(tenantId, userId),
    })
  );

  return true;
}

export async function touchMemberLastLogin(
  tenantId: string,
  userId: string
): Promise<void> {
  const existing = await getMember(tenantId, userId);
  if (!existing) return;

  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: memberKeys(tenantId, userId),
      UpdateExpression: "SET lastLoginAt = :now",
      ExpressionAttributeValues: { ":now": now },
    })
  );
}

export async function countMembersByRole(
  tenantId: string,
  role: TenantMember["role"]
): Promise<number> {
  const members = await listMembers(tenantId);
  return members.filter((m) => m.role === role && m.enabled).length;
}

export async function updateMember(
  tenantId: string,
  userId: string,
  updates: Partial<
    Pick<TenantMember, "name" | "role" | "enabled" | "teamIds" | "advisorId" | "profilePhotoS3Key">
  > & { customRoleId?: string | null }
): Promise<TenantMember | null> {
  const existing = await getMember(tenantId, userId);
  if (!existing) return null;

  const { customRoleId, ...rest } = updates;
  const merged: TenantMember = {
    ...existing,
    ...rest,
  };
  if (customRoleId === null) {
    delete merged.customRoleId;
  } else if (typeof customRoleId === "string") {
    merged.customRoleId = customRoleId;
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...memberKeys(tenantId, userId),
        ...merged,
      },
    })
  );

  return merged;
}
