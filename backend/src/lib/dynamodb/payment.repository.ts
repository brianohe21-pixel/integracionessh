import { PutCommand, GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { TenantPlan } from "../../types/index.js";

export type PaymentStatus = "pending" | "approved" | "declined";

export interface PaymentIntent {
  reference: string;
  tenantId: string;
  plan: TenantPlan;
  amountInCents: number;
  status: PaymentStatus;
  wompiTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

function paymentKeys(tenantId: string, reference: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `PAYMENT#${reference}`,
  };
}

export async function createPaymentIntent(
  intent: Omit<PaymentIntent, "status" | "createdAt" | "updatedAt"> & {
    status?: PaymentStatus;
  }
): Promise<PaymentIntent> {
  const now = new Date().toISOString();
  const record: PaymentIntent = {
    status: "pending",
    ...intent,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...paymentKeys(intent.tenantId, intent.reference), ...record },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  return record;
}

export async function getPaymentByReference(
  tenantId: string,
  reference: string
): Promise<PaymentIntent | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: paymentKeys(tenantId, reference),
    })
  );

  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as PaymentIntent;
}

export async function getPaymentByReferenceOnly(
  reference: string,
  tenantId: string
): Promise<PaymentIntent | null> {
  return getPaymentByReference(tenantId, reference);
}

export async function updatePaymentIntent(
  tenantId: string,
  reference: string,
  updates: Partial<Pick<PaymentIntent, "status" | "wompiTransactionId">>
): Promise<PaymentIntent | null> {
  const existing = await getPaymentByReference(tenantId, reference);
  if (!existing) return null;

  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: paymentKeys(tenantId, reference),
      UpdateExpression:
        "SET #status = :status, updatedAt = :now, wompiTransactionId = :txId",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": updates.status ?? existing.status,
        ":now": now,
        ":txId": updates.wompiTransactionId ?? existing.wompiTransactionId ?? null,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  const { PK, SK, ...rest } = result.Attributes ?? {};
  return rest as PaymentIntent;
}

export async function listAllPayments(): Promise<PaymentIntent[]> {
  const items: PaymentIntent[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":sk": "PAYMENT#" },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const { PK, SK, ...rest } = item;
      const pk = String(PK ?? "");
      const tenantFromPk = pk.startsWith("TENANT#") ? pk.slice(7) : "";
      items.push({
        ...(rest as PaymentIntent),
        tenantId: (rest as PaymentIntent).tenantId || tenantFromPk,
      });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
