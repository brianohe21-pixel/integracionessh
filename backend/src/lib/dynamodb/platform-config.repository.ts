import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { ResellerPlanDefaults, PlatformBillingConfig } from "../../types/index.js";

const RESELLER_KEYS = {
  PK: "PLATFORM#CONFIG",
  SK: "RESELLER_PLAN_DEFAULTS",
};

const BILLING_KEYS = {
  PK: "PLATFORM#CONFIG",
  SK: "BILLING_CONFIG",
};

export const DEFAULT_RESELLER_PLAN_DEFAULTS: ResellerPlanDefaults = {
  maxSubaccounts: 25,
  defaultSubaccountPlan: "pro",
  allowSubaccountBranding: false,
};

export const DEFAULT_PLATFORM_BILLING_CONFIG: PlatformBillingConfig = {
  pricePerMessageCents: 0,
  currency: "COP",
};

export async function getResellerPlanDefaults(): Promise<ResellerPlanDefaults> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: RESELLER_KEYS,
    })
  );

  if (!result.Item) return { ...DEFAULT_RESELLER_PLAN_DEFAULTS };

  const { PK, SK, ...rest } = result.Item;
  return {
    ...DEFAULT_RESELLER_PLAN_DEFAULTS,
    ...(rest as ResellerPlanDefaults),
  };
}

export async function putResellerPlanDefaults(
  defaults: ResellerPlanDefaults
): Promise<ResellerPlanDefaults> {
  const item = {
    ...RESELLER_KEYS,
    ...defaults,
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return defaults;
}

export async function getPlatformBillingConfig(): Promise<PlatformBillingConfig> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: BILLING_KEYS,
    })
  );

  if (!result.Item) return { ...DEFAULT_PLATFORM_BILLING_CONFIG };

  const { PK, SK, updatedAt, ...rest } = result.Item;
  return {
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    ...(rest as PlatformBillingConfig),
    ...(typeof updatedAt === "string" ? { updatedAt } : {}),
  };
}

export async function putPlatformBillingConfig(
  config: PlatformBillingConfig
): Promise<PlatformBillingConfig> {
  const updatedAt = new Date().toISOString();
  const item = {
    ...BILLING_KEYS,
    pricePerMessageCents: config.pricePerMessageCents,
    currency: "COP" as const,
    updatedAt,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return { ...config, currency: "COP", updatedAt };
}
