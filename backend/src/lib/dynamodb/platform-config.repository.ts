import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type {
  MaxMessagesPerMonthByPlan,
  ResellerPlanDefaults,
  PlatformBillingConfig,
} from "../../types/index.js";

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

export const DEFAULT_MAX_MESSAGES_PER_MONTH_BY_PLAN: MaxMessagesPerMonthByPlan = {
  free: 250,
  starter: 2_000,
  pro: 10_000,
  reseller: 50_000,
};

export const DEFAULT_PLATFORM_BILLING_CONFIG: PlatformBillingConfig = {
  pricePerMessageCents: 0,
  currency: "COP",
  maxMessagesPerMonthByPlan: { ...DEFAULT_MAX_MESSAGES_PER_MONTH_BY_PLAN },
};

function normalizeMaxMessagesByPlan(
  value: unknown
): MaxMessagesPerMonthByPlan {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const pick = (key: keyof MaxMessagesPerMonthByPlan): number => {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      return Math.floor(raw);
    }
    return DEFAULT_MAX_MESSAGES_PER_MONTH_BY_PLAN[key];
  };
  return {
    free: pick("free"),
    starter: pick("starter"),
    pro: pick("pro"),
    reseller: pick("reseller"),
  };
}

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

  if (!result.Item) return { ...DEFAULT_PLATFORM_BILLING_CONFIG, maxMessagesPerMonthByPlan: { ...DEFAULT_MAX_MESSAGES_PER_MONTH_BY_PLAN } };

  const { PK, SK, updatedAt, maxMessagesPerMonthByPlan, ...rest } = result.Item;
  return {
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    ...(rest as Omit<PlatformBillingConfig, "maxMessagesPerMonthByPlan" | "updatedAt">),
    maxMessagesPerMonthByPlan: normalizeMaxMessagesByPlan(maxMessagesPerMonthByPlan),
    ...(typeof updatedAt === "string" ? { updatedAt } : {}),
  };
}

export async function putPlatformBillingConfig(
  config: PlatformBillingConfig
): Promise<PlatformBillingConfig> {
  const updatedAt = new Date().toISOString();
  const maxMessagesPerMonthByPlan = normalizeMaxMessagesByPlan(
    config.maxMessagesPerMonthByPlan
  );
  const item = {
    ...BILLING_KEYS,
    pricePerMessageCents: config.pricePerMessageCents,
    currency: "COP" as const,
    maxMessagesPerMonthByPlan,
    updatedAt,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return {
    pricePerMessageCents: config.pricePerMessageCents,
    currency: "COP",
    maxMessagesPerMonthByPlan,
    updatedAt,
  };
}
