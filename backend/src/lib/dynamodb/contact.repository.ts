import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Contact, ContactSource, MarketingConsent, ConsentSource } from "../../types/index.js";

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

const contactKeys = (tenantId: string, phone: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `CONTACT#${phone}`,
});

function gsi1Keys(tenantId: string, phone: string, updatedAt: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#CONTACTS`,
    GSI1SK: `UPDATED#${updatedAt}#CONTACT#${phone}`,
  };
}

export interface ListContactsOptions {
  limit?: number;
  cursor?: string;
  tag?: string;
  consent?: MarketingConsent;
  suppressed?: boolean;
  q?: string;
}

export interface ListContactsResult {
  items: Contact[];
  nextCursor?: string;
}

function stripItem(item: Record<string, unknown>): Contact {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as Contact;
}

export async function getContactByPhone(
  tenantId: string,
  phone: string
): Promise<Contact | null> {
  const normalized = normalizePhone(phone);
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: contactKeys(tenantId, normalized),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function getContactsByPhones(
  tenantId: string,
  phones: string[]
): Promise<Map<string, Contact>> {
  const map = new Map<string, Contact>();
  const unique = [...new Set(phones.map(normalizePhone))];
  await Promise.all(
    unique.map(async (phone) => {
      const contact = await getContactByPhone(tenantId, phone);
      if (contact) map.set(phone, contact);
    })
  );
  return map;
}

function matchesFilters(contact: Contact, options: ListContactsOptions): boolean {
  if (options.tag && !contact.tags.includes(options.tag)) return false;
  if (options.consent && contact.marketingConsent !== options.consent) return false;
  if (options.suppressed !== undefined && contact.suppressed !== options.suppressed) return false;
  if (options.q) {
    const q = options.q.toLowerCase();
    const inPhone = contact.phoneNumber.includes(q);
    const inName = (contact.displayName ?? "").toLowerCase().includes(q);
    if (!inPhone && !inName) return false;
  }
  return true;
}

export async function listContacts(
  tenantId: string,
  options: ListContactsOptions = {}
): Promise<ListContactsResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const items: Contact[] = [];
  let lastKey: Record<string, unknown> | undefined;

  if (options.cursor) {
    try {
      lastKey = JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      lastKey = undefined;
    }
  }

  while (items.length < limit) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: { ":gsi1pk": `TENANT#${tenantId}#CONTACTS` },
        ScanIndexForward: false,
        Limit: limit * 3,
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const contact = stripItem(item);
      if (matchesFilters(contact, options)) {
        items.push(contact);
        if (items.length >= limit) break;
      }
    }

    lastKey = result.LastEvaluatedKey;
    if (!lastKey || items.length >= limit) break;
  }

  const nextCursor =
    lastKey && items.length >= limit
      ? Buffer.from(JSON.stringify(lastKey)).toString("base64url")
      : undefined;

  return { items: items.slice(0, limit), ...(nextCursor ? { nextCursor } : {}) };
}

export async function listContactsByTags(
  tenantId: string,
  tags: string[]
): Promise<Contact[]> {
  if (!tags.length) return [];
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  const matched: Contact[] = [];
  let cursor: string | undefined;

  do {
    const page = await listContacts(tenantId, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const contact of page.items) {
      const hasTag = contact.tags.some((t) => tagSet.has(t.toLowerCase()));
      if (hasTag && contact.marketingConsent === "opt_in" && !contact.suppressed) {
        matched.push(contact);
      }
    }
    cursor = page.nextCursor;
  } while (cursor);

  return matched;
}

export async function countContacts(tenantId: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await listContacts(tenantId, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    count += page.items.length;
    cursor = page.nextCursor;
  } while (cursor);
  return count;
}

export async function upsertFromConversation(params: {
  tenantId: string;
  phoneNumber: string;
  displayName?: string;
  botId?: string;
  source?: ContactSource;
}): Promise<Contact> {
  const phone = normalizePhone(params.phoneNumber);
  const now = new Date().toISOString();
  const existing = await getContactByPhone(params.tenantId, phone);

  if (existing) {
    const updates: Partial<Contact> = {
      lastSeenAt: now,
      ...(params.botId ? { lastBotId: params.botId } : {}),
    };
    if (params.displayName && params.displayName !== existing.displayName) {
      updates.displayName = params.displayName;
    }
    return (await updateContact(params.tenantId, phone, updates)) ?? existing;
  }

  const contact: Contact = {
    phoneNumber: phone,
    tenantId: params.tenantId,
    tags: [],
    marketingConsent: "unknown",
    suppressed: false,
    firstSeenAt: now,
    lastSeenAt: now,
    source: params.source ?? "sync",
    createdAt: now,
    updatedAt: now,
    ...(params.displayName ? { displayName: params.displayName } : {}),
    ...(params.botId ? { lastBotId: params.botId } : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...contactKeys(params.tenantId, phone),
        ...gsi1Keys(params.tenantId, phone, now),
        ...contact,
      },
    })
  );

  return contact;
}

export async function createContact(contact: Contact): Promise<Contact> {
  const phone = normalizePhone(contact.phoneNumber);
  const now = contact.createdAt ?? new Date().toISOString();
  const item: Contact = {
    ...contact,
    phoneNumber: phone,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...contactKeys(contact.tenantId, phone),
        ...gsi1Keys(contact.tenantId, phone, now),
        ...item,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  return item;
}

export async function updateContact(
  tenantId: string,
  phone: string,
  updates: Partial<
    Pick<
      Contact,
      | "displayName"
      | "tags"
      | "marketingConsent"
      | "consentAt"
      | "consentSource"
      | "suppressed"
      | "lastSeenAt"
      | "lastBotId"
      | "messageCount"
    >
  >
): Promise<Contact | null> {
  const normalized = normalizePhone(phone);
  const existing = await getContactByPhone(tenantId, normalized);
  if (!existing) return null;

  const now = new Date().toISOString();
  const merged: Contact = { ...existing, ...updates, updatedAt: now };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...contactKeys(tenantId, normalized),
        ...gsi1Keys(tenantId, normalized, now),
        ...merged,
      },
    })
  );

  return merged;
}

export async function importContactsBatch(
  tenantId: string,
  rows: Array<{
    phone: string;
    name?: string;
    tags?: string[];
    marketingConsent?: MarketingConsent;
  }>,
  consentSource: ConsentSource = "import"
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const phone = normalizePhone(row.phone);
    if (phone.length < 10) continue;

    const existing = await getContactByPhone(tenantId, phone);
    const now = new Date().toISOString();

    if (existing) {
      const patch: Parameters<typeof updateContact>[2] = {};
      if (row.name) patch.displayName = row.name;
      if (row.tags?.length) {
        patch.tags = [...new Set([...existing.tags, ...row.tags])];
      }
      if (row.marketingConsent) {
        patch.marketingConsent = row.marketingConsent;
        patch.consentAt = now;
        patch.consentSource = consentSource;
      }
      if (Object.keys(patch).length) {
        await updateContact(tenantId, phone, patch);
        updated++;
      }
    } else {
      await createContact({
        phoneNumber: phone,
        tenantId,
        tags: row.tags ?? [],
        marketingConsent: row.marketingConsent ?? "unknown",
        suppressed: false,
        firstSeenAt: now,
        lastSeenAt: now,
        source: "import",
        createdAt: now,
        updatedAt: now,
        ...(row.name ? { displayName: row.name } : {}),
        ...(row.marketingConsent
          ? { consentAt: now, consentSource }
          : {}),
      });
      created++;
    }
  }

  return { created, updated };
}

export async function suppressContact(tenantId: string, phone: string): Promise<Contact | null> {
  const now = new Date().toISOString();
  return updateContact(tenantId, phone, {
    suppressed: true,
    marketingConsent: "opt_out",
    consentAt: now,
    consentSource: "panel",
  });
}

export async function listContactsForExport(
  tenantId: string,
  type: "suppressed" | "opt_out" | "all"
): Promise<Contact[]> {
  const all: Contact[] = [];
  let cursor: string | undefined;

  do {
    const page = await listContacts(tenantId, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const c of page.items) {
      if (type === "suppressed" && c.suppressed) all.push(c);
      else if (type === "opt_out" && c.marketingConsent === "opt_out") all.push(c);
      else if (type === "all") all.push(c);
    }
    cursor = page.nextCursor;
  } while (cursor);

  return all;
}
