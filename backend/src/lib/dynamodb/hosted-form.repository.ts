import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "./client.js";
import type { HostedForm, HostedFormSubmission } from "../../types/index.js";

const formKeys = (tenantId: string, formId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `HOSTEDFORM#${formId}`,
});

const formGsi1 = (tenantId: string, updatedAt: string, formId: string) => ({
  GSI1PK: `TENANT#${tenantId}#HOSTEDFORMS`,
  GSI1SK: `UPDATED#${updatedAt}#${formId}`,
});

const publicKeyLookup = (publicKey: string) => ({
  PK: `LOOKUP#FORM#${publicKey}`,
  SK: "META",
});

const submissionKeys = (tenantId: string, formId: string, createdAt: string, submissionId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `HOSTEDFORMSUB#${formId}#${createdAt}#${submissionId}`,
});

function stripForm(item: Record<string, unknown>): HostedForm {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as HostedForm;
}

function stripSubmission(item: Record<string, unknown>): HostedFormSubmission {
  const { PK, SK, ...rest } = item;
  void PK;
  void SK;
  return rest as unknown as HostedFormSubmission;
}

export function makeHostedFormId(): string {
  return randomUUID();
}

export function makeHostedFormSubmissionId(): string {
  return randomUUID();
}

export async function createHostedForm(form: HostedForm): Promise<HostedForm> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...formKeys(form.tenantId, form.formId),
        ...formGsi1(form.tenantId, form.updatedAt, form.formId),
        ...form,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  await putFormPublicKeyLookup(form.publicKey, form.tenantId, form.formId);
  return form;
}

export async function getHostedForm(
  tenantId: string,
  formId: string
): Promise<HostedForm | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: formKeys(tenantId, formId),
    })
  );
  if (!result.Item) return null;
  return stripForm(result.Item);
}

export async function listHostedForms(tenantId: string): Promise<HostedForm[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "HOSTEDFORM#",
      },
    })
  );
  return (result.Items ?? [])
    .filter((item) => typeof item.SK === "string" && !item.SK.startsWith("HOSTEDFORMSUB#"))
    .map((item) => stripForm(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function countHostedForms(tenantId: string): Promise<number> {
  const forms = await listHostedForms(tenantId);
  return forms.length;
}

export async function updateHostedForm(
  tenantId: string,
  formId: string,
  updates: Partial<HostedForm>
): Promise<HostedForm | null> {
  const existing = await getHostedForm(tenantId, formId);
  if (!existing) return null;
  const merged: HostedForm = {
    ...existing,
    ...updates,
    formId: existing.formId,
    tenantId: existing.tenantId,
    publicKey: updates.publicKey ?? existing.publicKey,
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...formKeys(tenantId, formId),
        ...formGsi1(tenantId, merged.updatedAt, formId),
        ...merged,
      },
    })
  );
  return merged;
}

export async function deleteHostedForm(tenantId: string, formId: string): Promise<boolean> {
  const existing = await getHostedForm(tenantId, formId);
  if (!existing) return false;
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: formKeys(tenantId, formId),
    })
  );
  await deleteFormPublicKeyLookup(existing.publicKey);
  await deleteSubmissionsForForm(tenantId, formId);
  return true;
}

export async function putFormPublicKeyLookup(
  publicKey: string,
  tenantId: string,
  formId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...publicKeyLookup(publicKey),
        tenantId,
        formId,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteFormPublicKeyLookup(publicKey: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: publicKeyLookup(publicKey),
    })
  );
}

export async function getFormByPublicKey(
  publicKey: string
): Promise<{ tenantId: string; formId: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: publicKeyLookup(publicKey),
    })
  );
  if (!result.Item) return null;
  return {
    tenantId: result.Item.tenantId as string,
    formId: result.Item.formId as string,
  };
}

export async function createHostedFormSubmission(
  submission: HostedFormSubmission
): Promise<HostedFormSubmission> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...submissionKeys(
          submission.tenantId,
          submission.formId,
          submission.createdAt,
          submission.submissionId
        ),
        ...submission,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return submission;
}

export async function listHostedFormSubmissions(
  tenantId: string,
  formId: string,
  limit = 50
): Promise<HostedFormSubmission[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": `HOSTEDFORMSUB#${formId}#`,
      },
      ScanIndexForward: false,
      Limit: Math.min(Math.max(limit, 1), 100),
    })
  );
  return (result.Items ?? []).map((item) => stripSubmission(item));
}

async function deleteSubmissionsForForm(tenantId: string, formId: string): Promise<void> {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": `HOSTEDFORMSUB#${formId}#`,
        },
        ProjectionExpression: "PK, SK",
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    const items = result.Items ?? [];
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: chunk.map((item) => ({
              DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
            })),
          },
        })
      );
    }
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
}
