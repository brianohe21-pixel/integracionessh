import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { ResellerPlanDefaults } from "../../types/index.js";

const KEYS = {
  PK: "PLATFORM#CONFIG",
  SK: "RESELLER_PLAN_DEFAULTS",
};

export const DEFAULT_RESELLER_PLAN_DEFAULTS: ResellerPlanDefaults = {
  maxSubaccounts: 25,
  defaultSubaccountPlan: "pro",
  allowSubaccountBranding: false,
};

export async function getResellerPlanDefaults(): Promise<ResellerPlanDefaults> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: KEYS,
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
    ...KEYS,
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
