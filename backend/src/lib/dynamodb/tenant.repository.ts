import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { normalizeEmail } from "../auth/normalize-email.js";
import { docClient, TABLE_NAME } from "./client.js";
import type { Tenant } from "../../types/index.js";
import { notifyAdminsOfNewRegistration } from "../email/registration-admin-notify.js";
import { sendWelcomeEmail } from "../email/welcome.js";

const keys = (tenantId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: "METADATA",
});

function stripKeys(item: Record<string, unknown>): Tenant {
  const {
    PK: _pk,
    SK: _sk,
    GSI1PK: _g1pk,
    GSI1SK: _g1sk,
    ...rest
  } = item;
  return rest as unknown as Tenant;
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function tenantEmailLookupKey(email: string) {
  return {
    PK: `LOOKUP#TENANT_EMAIL#${normalizeEmail(email)}`,
    SK: "META",
  };
}

function duplicateTenantEmailError(): Error {
  return Object.assign(new Error("An account with this email already exists"), {
    statusCode: 409,
  });
}

export async function getTenantIdByRegistrationEmail(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: tenantEmailLookupKey(normalized),
    })
  );

  const tenantId = String(result.Item?.tenantId ?? "").trim();
  return tenantId || null;
}

async function putTenantEmailLookup(email: string, tenantId: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...tenantEmailLookupKey(normalized),
          email: normalized,
          tenantId,
          updatedAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(PK) OR tenantId = :tenantId",
        ExpressionAttributeValues: {
          ":tenantId": tenantId,
        },
      })
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw duplicateTenantEmailError();
    }
    throw error;
  }
}

async function deleteTenantEmailLookup(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: tenantEmailLookupKey(normalized),
    })
  );
}

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId),
    })
  );

  if (!result.Item) return null;
  return stripKeys(result.Item);
}

export async function createTenant(tenant: Tenant): Promise<void> {
  const existingTenantId = await getTenantIdByRegistrationEmail(tenant.email);
  if (existingTenantId && existingTenantId !== tenant.tenantId) {
    throw duplicateTenantEmailError();
  }

  const item: Record<string, unknown> = {
    ...keys(tenant.tenantId),
    GSI1PK: "TENANT",
    GSI1SK: `STATUS#${tenant.status}#${tenant.tenantId}`,
    ...tenant,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  await putTenantEmailLookup(tenant.email, tenant.tenantId);

  if (tenant.parentTenantId) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `PARENT#${tenant.parentTenantId}`,
          SK: `SUBACCOUNT#${tenant.tenantId}`,
          tenantId: tenant.tenantId,
          parentTenantId: tenant.parentTenantId,
          createdAt: tenant.createdAt,
        },
      })
    );
  }

  const domain = tenant.resellerConfig?.customDomain;
  if (domain) {
    await putDomainMapping(normalizeDomain(domain), tenant.tenantId);
  }
}

export async function updateTenant(
  tenantId: string,
  updates: Partial<Omit<Tenant, "tenantId" | "createdAt">>
): Promise<Tenant> {
  const existing = await getTenant(tenantId);
  const updateExpression: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  Object.entries({ ...updates, updatedAt: new Date().toISOString() }).forEach(
    ([key, value]) => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  );

  if (updates.status !== undefined) {
    updateExpression.push("#GSI1SK = :GSI1SK");
    expressionAttributeNames["#GSI1SK"] = "GSI1SK";
    expressionAttributeValues[":GSI1SK"] = `STATUS#${updates.status}#${tenantId}`;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId),
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  const updated = stripKeys(result.Attributes ?? {});

  if (updates.email !== undefined && existing?.email) {
    const previousEmail = normalizeEmail(existing.email);
    const nextEmail = normalizeEmail(updated.email);
    if (previousEmail && nextEmail && previousEmail !== nextEmail) {
      await deleteTenantEmailLookup(previousEmail);
      await putTenantEmailLookup(nextEmail, tenantId);
    }
  }

  const oldDomain = existing?.resellerConfig?.customDomain
    ? normalizeDomain(existing.resellerConfig.customDomain)
    : undefined;
  const newDomain = updated.resellerConfig?.customDomain
    ? normalizeDomain(updated.resellerConfig.customDomain)
    : undefined;

  if (newDomain) {
    await putDomainMapping(newDomain, tenantId);
  }
  if (oldDomain && oldDomain !== newDomain) {
    await deleteDomainMapping(oldDomain);
  }

  return updated;
}

export async function clearTenantPricePerMessage(tenantId: string): Promise<Tenant> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId),
      UpdateExpression: "REMOVE #pricePerMessageCents SET #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#pricePerMessageCents": "pricePerMessageCents",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return stripKeys(result.Attributes ?? {});
}

export async function clearTenantPlanLimitsOverride(tenantId: string): Promise<Tenant> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId),
      UpdateExpression: "REMOVE #planLimitsOverride SET #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#planLimitsOverride": "planLimitsOverride",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return stripKeys(result.Attributes ?? {});
}

export async function deleteTenant(tenantId: string): Promise<void> {
  const existing = await getTenant(tenantId);
  if (existing?.parentTenantId) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PARENT#${existing.parentTenantId}`,
          SK: `SUBACCOUNT#${tenantId}`,
        },
      })
    );
  }
  if (existing?.resellerConfig?.customDomain) {
    await deleteDomainMapping(normalizeDomain(existing.resellerConfig.customDomain));
  }
  if (existing?.email) {
    await deleteTenantEmailLookup(existing.email);
  }
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId),
    })
  );
}

export async function ensureTenant(
  tenantId: string,
  email: string,
  name?: string
): Promise<Tenant> {
  const normalizedEmail = normalizeEmail(email);
  const existing = await getTenant(tenantId);
  if (existing) {
    const mappedTenantId = await getTenantIdByRegistrationEmail(existing.email);
    if (!mappedTenantId) {
      await putTenantEmailLookup(existing.email, tenantId);
    }
    return existing;
  }

  const existingTenantId = await getTenantIdByRegistrationEmail(normalizedEmail);
  if (existingTenantId && existingTenantId !== tenantId) {
    throw duplicateTenantEmailError();
  }

  const now = new Date().toISOString();
  const tenant: Tenant = {
    tenantId,
    name: name?.trim() || normalizedEmail.split("@")[0] || "Tenant",
    email: normalizedEmail,
    plan: "free",
    tenantKind: "standard",
    status: "active",
    subscriptionStatus: "none",
    createdAt: now,
    updatedAt: now,
  };

  await createTenant(tenant);
  void notifyAdminsOfNewRegistration(tenant).catch((error) => {
    console.error("Failed to notify admins of new registration", {
      tenantId: tenant.tenantId,
      error,
    });
  });
  void sendWelcomeEmail({
    to: email,
    userName: tenant.name,
  }).catch((error) => {
    console.error("Failed to send welcome email", {
      tenantId: tenant.tenantId,
      error,
    });
  });
  return tenant;
}

export async function listTenants(): Promise<Tenant[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": "TENANT" },
    })
  );

  return (result.Items ?? []).map((item) => stripKeys(item));
}

export async function listSubaccounts(parentTenantId: string): Promise<Tenant[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `PARENT#${parentTenantId}`,
        ":sk": "SUBACCOUNT#",
      },
    })
  );

  const ids = (result.Items ?? [])
    .map((item) => String(item.tenantId ?? "").trim())
    .filter(Boolean);

  const tenants: Tenant[] = [];
  for (const id of ids) {
    const tenant = await getTenant(id);
    if (tenant) tenants.push(tenant);
  }
  return tenants;
}

export async function countSubaccounts(parentTenantId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `PARENT#${parentTenantId}`,
        ":sk": "SUBACCOUNT#",
      },
      Select: "COUNT",
    })
  );
  return result.Count ?? 0;
}

export async function putDomainMapping(domain: string, tenantId: string): Promise<void> {
  const normalized = normalizeDomain(domain);
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `DOMAIN#${normalized}`,
          SK: "METADATA",
          domain: normalized,
          tenantId,
          updatedAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(PK) OR tenantId = :tid",
        ExpressionAttributeValues: {
          ":tid": tenantId,
        },
      })
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw Object.assign(new Error("Domain is already registered to another tenant"), {
        statusCode: 400,
      });
    }
    throw error;
  }
}

export async function deleteDomainMapping(domain: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `DOMAIN#${normalizeDomain(domain)}`,
        SK: "METADATA",
      },
    })
  );
}

export async function getTenantIdByDomain(domain: string): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `DOMAIN#${normalizeDomain(domain)}`,
        SK: "METADATA",
      },
    })
  );
  if (!result.Item) return null;
  const tenantId = String(result.Item.tenantId ?? "").trim();
  return tenantId || null;
}

export { normalizeDomain };
