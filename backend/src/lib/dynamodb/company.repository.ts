import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Company } from "../../types/index.js";

const companyKeys = (tenantId: string, companyId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `COMPANY#${companyId}`,
});

function gsi1Keys(tenantId: string, normalizedName: string, companyId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#COMPANIES`,
    GSI1SK: `NAME#${normalizedName}#COMPANY#${companyId}`,
  };
}

const companyOppKeys = (tenantId: string, companyId: string, opportunityId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `COMOPP#${companyId}#${opportunityId}`,
});

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripCompany(item: Record<string, unknown>): Company {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as Company;
}

export interface ListCompaniesOptions {
  limit?: number;
  cursor?: string;
  q?: string;
}

export interface ListCompaniesResult {
  items: Company[];
  nextCursor?: string;
}

export async function getCompanyById(
  tenantId: string,
  companyId: string
): Promise<Company | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: companyKeys(tenantId, companyId),
    })
  );
  if (!result.Item) return null;
  return stripCompany(result.Item);
}

export async function listCompanies(
  tenantId: string,
  options: ListCompaniesOptions = {}
): Promise<ListCompaniesResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const items: Company[] = [];
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
        ExpressionAttributeValues: {
          ":gsi1pk": `TENANT#${tenantId}#COMPANIES`,
        },
        ScanIndexForward: true,
        Limit: limit * 2,
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      if (!String(item.SK ?? "").startsWith("COMPANY#")) continue;
      const company = stripCompany(item);
      if (options.q) {
        const q = options.q.toLowerCase();
        const inName = company.name.toLowerCase().includes(q);
        const inEmail = (company.email ?? "").toLowerCase().includes(q);
        if (!inName && !inEmail) continue;
      }
      items.push(company);
      if (items.length >= limit) break;
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

export async function createCompany(company: Company): Promise<Company> {
  const normalized = normalizeName(company.name);
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...companyKeys(company.tenantId, company.companyId),
        ...gsi1Keys(company.tenantId, normalized, company.companyId),
        ...company,
      },
    })
  );
  return company;
}

export type CompanyUpdateInput = Partial<
  Pick<Company, "name" | "email" | "phone" | "website" | "industry" | "notes">
>;

export async function updateCompany(
  tenantId: string,
  companyId: string,
  updates: CompanyUpdateInput
): Promise<Company | null> {
  const existing = await getCompanyById(tenantId, companyId);
  if (!existing) return null;

  const merged: Company = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const normalized = normalizeName(merged.name);
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...companyKeys(tenantId, companyId),
        ...gsi1Keys(tenantId, normalized, companyId),
        ...merged,
      },
    })
  );
  return merged;
}

export async function deleteCompany(tenantId: string, companyId: string): Promise<boolean> {
  const existing = await getCompanyById(tenantId, companyId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: companyKeys(tenantId, companyId),
    })
  );
  return true;
}

export async function linkCompanyOpportunity(
  tenantId: string,
  companyId: string,
  opportunityId: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...companyOppKeys(tenantId, companyId, opportunityId),
        tenantId,
        companyId,
        opportunityId,
        createdAt: new Date().toISOString(),
      },
    })
  );
}

export async function unlinkCompanyOpportunity(
  tenantId: string,
  companyId: string,
  opportunityId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: companyOppKeys(tenantId, companyId, opportunityId),
    })
  );
}

export async function listOpportunityIdsByCompany(
  tenantId: string,
  companyId: string
): Promise<string[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":skPrefix": `COMOPP#${companyId}#`,
      },
    })
  );

  return (result.Items ?? []).map((item) => String(item.opportunityId ?? ""));
}
