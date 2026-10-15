import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { TagAction, TagDefinition } from "../../types/index.js";

const tagKeys = (tenantId: string, tagId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `TAG#${tagId}`,
});

function gsi1Keys(tenantId: string, normalizedName: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#TAGS`,
    GSI1SK: `NAME#${normalizedName}`,
  };
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

function stripTag(item: Record<string, unknown>): TagDefinition {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as TagDefinition;
}

function sortTags(tags: TagDefinition[]): TagDefinition[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listTags(tenantId: string): Promise<TagDefinition[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "TAG#",
      },
    })
  );

  return sortTags((result.Items ?? []).map(stripTag));
}

export async function getTagById(
  tenantId: string,
  tagId: string
): Promise<TagDefinition | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: tagKeys(tenantId, tagId),
    })
  );

  if (!result.Item) return null;
  return stripTag(result.Item);
}

export async function getTagByName(
  tenantId: string,
  name: string
): Promise<TagDefinition | null> {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#TAGS`,
        ":gsi1sk": `NAME#${normalized}`,
      },
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (!item) return null;
  return stripTag(item);
}

export async function createTag(tag: TagDefinition): Promise<TagDefinition> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...tagKeys(tag.tenantId, tag.tagId),
        ...gsi1Keys(tag.tenantId, normalizeTagName(tag.name)),
        ...tag,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  return tag;
}

export async function updateTag(
  tenantId: string,
  tagId: string,
  updates: {
    name?: string;
    color?: string | null;
    description?: string | null;
    onApply?: TagAction[];
  }
): Promise<TagDefinition | null> {
  const existing = await getTagById(tenantId, tagId);
  if (!existing) return null;

  const merged: TagDefinition = {
    ...existing,
    updatedAt: new Date().toISOString(),
  };

  if (updates.name !== undefined) merged.name = updates.name;
  if (updates.onApply !== undefined) merged.onApply = updates.onApply;
  if (updates.color !== undefined) {
    if (updates.color) merged.color = updates.color;
    else delete merged.color;
  }
  if (updates.description !== undefined) {
    if (updates.description) merged.description = updates.description;
    else delete merged.description;
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...tagKeys(tenantId, tagId),
        ...gsi1Keys(tenantId, normalizeTagName(merged.name)),
        ...merged,
      },
    })
  );

  return merged;
}

export async function deleteTag(tenantId: string, tagId: string): Promise<boolean> {
  const existing = await getTagById(tenantId, tagId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: tagKeys(tenantId, tagId),
    })
  );

  return true;
}
