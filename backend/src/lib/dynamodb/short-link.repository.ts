import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "./client.js";
import type { ShortLink, ShortLinkClick } from "../../types/index.js";

const linkKeys = (tenantId: string, linkId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `SHORTLINK#${linkId}`,
});

const linkGsi1 = (tenantId: string, updatedAt: string, linkId: string) => ({
  GSI1PK: `TENANT#${tenantId}#SHORTLINKS`,
  GSI1SK: `UPDATED#${updatedAt}#${linkId}`,
});

const slugLookup = (slug: string) => ({
  PK: `LOOKUP#SHORTLINK#${slug.toLowerCase()}`,
  SK: "META",
});

const clickKeys = (tenantId: string, linkId: string, clickedAt: string, clickId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `SHORTLINKCLICK#${linkId}#${clickedAt}#${clickId}`,
});

function stripLink(item: Record<string, unknown>): ShortLink {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as ShortLink;
}

function stripClick(item: Record<string, unknown>): ShortLinkClick {
  const { PK, SK, ...rest } = item;
  void PK;
  void SK;
  return rest as unknown as ShortLinkClick;
}

export function makeShortLinkId(): string {
  return randomUUID();
}

export function makeShortLinkClickId(): string {
  return randomUUID();
}

export async function createShortLink(link: ShortLink): Promise<ShortLink> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...linkKeys(link.tenantId, link.linkId),
        ...linkGsi1(link.tenantId, link.updatedAt, link.linkId),
        ...link,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  await putShortLinkSlugLookup(link.slug, link.tenantId, link.linkId);
  return link;
}

export async function getShortLink(
  tenantId: string,
  linkId: string
): Promise<ShortLink | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: linkKeys(tenantId, linkId),
    })
  );
  if (!result.Item) return null;
  return stripLink(result.Item);
}

export async function listShortLinks(tenantId: string): Promise<ShortLink[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "SHORTLINK#",
      },
    })
  );
  return (result.Items ?? [])
    .map((item) => stripLink(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function updateShortLink(
  tenantId: string,
  linkId: string,
  updates: Partial<ShortLink>
): Promise<ShortLink | null> {
  const existing = await getShortLink(tenantId, linkId);
  if (!existing) return null;

  const merged: ShortLink = {
    ...existing,
    ...updates,
    linkId: existing.linkId,
    tenantId: existing.tenantId,
    slug: updates.slug ?? existing.slug,
    updatedAt: new Date().toISOString(),
  };

  if (updates.slug && updates.slug.toLowerCase() !== existing.slug.toLowerCase()) {
    await deleteShortLinkSlugLookup(existing.slug);
    await putShortLinkSlugLookup(merged.slug, tenantId, linkId);
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...linkKeys(tenantId, linkId),
        ...linkGsi1(tenantId, merged.updatedAt, linkId),
        ...merged,
      },
    })
  );
  return merged;
}

export async function deleteShortLink(tenantId: string, linkId: string): Promise<boolean> {
  const existing = await getShortLink(tenantId, linkId);
  if (!existing) return false;
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: linkKeys(tenantId, linkId),
    })
  );
  await deleteShortLinkSlugLookup(existing.slug);
  return true;
}

export async function putShortLinkSlugLookup(
  slug: string,
  tenantId: string,
  linkId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...slugLookup(slug),
        tenantId,
        linkId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteShortLinkSlugLookup(slug: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: slugLookup(slug),
    })
  );
}

export async function getShortLinkBySlug(
  slug: string
): Promise<{ tenantId: string; linkId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: slugLookup(slug),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    linkId: result.Item.linkId as string,
  };
}

export async function recordShortLinkClick(params: {
  link: ShortLink;
  userAgent?: string;
  referer?: string;
  ip?: string;
}): Promise<ShortLinkClick> {
  const clickedAt = new Date().toISOString();
  const click: ShortLinkClick = {
    clickId: makeShortLinkClickId(),
    linkId: params.link.linkId,
    tenantId: params.link.tenantId,
    slug: params.link.slug,
    clickedAt,
    ...(params.userAgent ? { userAgent: params.userAgent } : {}),
    ...(params.referer ? { referer: params.referer } : {}),
    ...(params.ip ? { ip: params.ip } : {}),
  };

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: linkKeys(params.link.tenantId, params.link.linkId),
      UpdateExpression: "ADD clickCount :one SET lastClickedAt = :clickedAt, updatedAt = :clickedAt",
      ExpressionAttributeValues: {
        ":one": 1,
        ":clickedAt": clickedAt,
      },
    })
  );

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...clickKeys(params.link.tenantId, params.link.linkId, clickedAt, click.clickId),
        ...click,
      },
    })
  );

  return click;
}

export async function listShortLinkClicks(
  tenantId: string,
  linkId: string,
  limit = 50
): Promise<ShortLinkClick[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": `SHORTLINKCLICK#${linkId}#`,
      },
      ScanIndexForward: false,
      Limit: Math.min(Math.max(limit, 1), 100),
    })
  );
  return (result.Items ?? []).map((item) => stripClick(item));
}
