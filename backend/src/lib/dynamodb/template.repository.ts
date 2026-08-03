import {
  QueryCommand,
  PutCommand,
  DeleteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { WhatsAppTemplate, SmsTemplate } from "../../types/index.js";

const templateKeys = (tenantId: string, botId: string, name: string, language: string) => ({
  PK: `TENANT#${tenantId}#BOT#${botId}`,
  SK: `TMPL#${name}#${language}`,
});

const smsTemplateKeys = (tenantId: string, botId: string, name: string, language: string) => ({
  PK: `TENANT#${tenantId}#BOT#${botId}`,
  SK: `SMSTMPL#${name}#${language}`,
});

const gsi1Keys = (tenantId: string, status: string, name: string) => ({
  GSI1PK: `TENANT#${tenantId}#TMPL`,
  GSI1SK: `STATUS#${status}#${name}`,
});

export async function listCachedTemplates(
  tenantId: string,
  botId: string
): Promise<WhatsAppTemplate[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":sk": "TMPL#",
      },
    })
  );

  return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as WhatsAppTemplate);
}

export async function getCachedTemplate(
  tenantId: string,
  botId: string,
  name: string,
  language: string
): Promise<WhatsAppTemplate | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":sk": `TMPL#${name}#${language}`,
      },
      Limit: 1,
    })
  );

  if (!result.Items?.length) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Items[0];
  return rest as WhatsAppTemplate;
}

export async function upsertCachedTemplate(
  tenantId: string,
  botId: string,
  template: WhatsAppTemplate
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...templateKeys(tenantId, botId, template.name, template.language),
        ...gsi1Keys(tenantId, template.status, template.name),
        ...template,
      },
    })
  );
}

export async function deleteCachedTemplate(
  tenantId: string,
  botId: string,
  name: string,
  language: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: templateKeys(tenantId, botId, name, language),
    })
  );
}

function dedupeTemplates(templates: WhatsAppTemplate[]): WhatsAppTemplate[] {
  const byKey = new Map<string, WhatsAppTemplate>();
  for (const template of templates) {
    byKey.set(`${template.name}#${template.language}`, template);
  }
  return Array.from(byKey.values());
}

export async function syncTemplates(
  tenantId: string,
  botId: string,
  templates: WhatsAppTemplate[]
): Promise<WhatsAppTemplate[]> {
  const uniqueTemplates = dedupeTemplates(templates);
  const existing = await listCachedTemplates(tenantId, botId);
  const existingByKey = new Map(existing.map((t) => [`${t.name}#${t.language}`, t]));
  const incomingKeys = new Set(uniqueTemplates.map((t) => `${t.name}#${t.language}`));

  const newlyApproved = uniqueTemplates.filter((template) => {
    if (template.status !== "APPROVED") return false;
    const previous = existingByKey.get(`${template.name}#${template.language}`);
    return previous != null && previous.status !== "APPROVED";
  });

  const toDelete = existing.filter((t) => !incomingKeys.has(`${t.name}#${t.language}`));

  const batches: Array<Record<string, unknown>[]> = [];
  const allOps: Array<Record<string, unknown>> = [];

  for (const template of uniqueTemplates) {
    const previous = existingByKey.get(`${template.name}#${template.language}`);
    allOps.push({
      PutRequest: {
        Item: {
          ...templateKeys(tenantId, botId, template.name, template.language),
          ...gsi1Keys(tenantId, template.status, template.name),
          ...template,
          createdAt: previous?.createdAt ?? template.createdAt,
        },
      },
    });
  }

  for (const t of toDelete) {
    allOps.push({
      DeleteRequest: {
        Key: templateKeys(tenantId, botId, t.name, t.language),
      },
    });
  }

  for (let i = 0; i < allOps.length; i += 25) {
    batches.push(allOps.slice(i, i + 25));
  }

  for (const batch of batches) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: batch },
      })
    );
  }

  return newlyApproved;
}

export async function listSmsTemplates(
  tenantId: string,
  botId: string
): Promise<SmsTemplate[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":sk": "SMSTMPL#",
      },
    })
  );

  return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as SmsTemplate);
}

export async function getSmsTemplate(
  tenantId: string,
  botId: string,
  name: string,
  language: string
): Promise<SmsTemplate | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":sk": `SMSTMPL#${name}#${language}`,
      },
      Limit: 1,
    })
  );

  if (!result.Items?.length) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Items[0];
  return rest as SmsTemplate;
}

export async function upsertSmsTemplate(
  tenantId: string,
  botId: string,
  template: SmsTemplate
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...smsTemplateKeys(tenantId, botId, template.name, template.language),
        ...gsi1Keys(tenantId, "APPROVED", template.name),
        ...template,
      },
    })
  );
}

export async function deleteSmsTemplate(
  tenantId: string,
  botId: string,
  name: string,
  language: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: smsTemplateKeys(tenantId, botId, name, language),
    })
  );
}
