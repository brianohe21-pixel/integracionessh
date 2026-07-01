import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Booking, BookingStatus } from "../../types/index.js";

const bookingKeys = (tenantId: string, bookingId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `BOOKING#${bookingId}`,
});

function gsi1Keys(tenantId: string, botId: string, startAt: string, bookingId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#BOT#${botId}`,
    GSI1SK: `START#${startAt}#${bookingId}`,
  };
}

function stripItem(item: Record<string, unknown>): Booking {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as Booking;
}

export function makeBookingId(): string {
  return randomUUID();
}

export async function getBooking(
  tenantId: string,
  bookingId: string
): Promise<Booking | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: bookingKeys(tenantId, bookingId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function listBookingsForBot(params: {
  tenantId: string;
  botId: string;
  from?: string;
  to?: string;
  status?: BookingStatus;
}): Promise<Booking[]> {
  const expressionValues: Record<string, string> = {
    ":gsi1pk": `TENANT#${params.tenantId}#BOT#${params.botId}`,
  };
  let keyCondition = "GSI1PK = :gsi1pk";
  if (params.from && params.to) {
    keyCondition += " AND GSI1SK BETWEEN :from AND :to";
    expressionValues[":from"] = `START#${params.from}`;
    expressionValues[":to"] = `START#${params.to}\uffff`;
  } else if (params.from) {
    keyCondition += " AND GSI1SK >= :from";
    expressionValues[":from"] = `START#${params.from}`;
  } else if (params.to) {
    keyCondition += " AND GSI1SK <= :to";
    expressionValues[":to"] = `START#${params.to}\uffff`;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
    })
  );
  let items = (result.Items ?? []).map((item) => stripItem(item));
  if (params.status) {
    items = items.filter((b) => b.status === params.status);
  }
  return items.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function createBooking(booking: Booking): Promise<Booking> {
  const item = {
    ...bookingKeys(booking.tenantId, booking.bookingId),
    ...gsi1Keys(booking.tenantId, booking.botId, booking.startAt, booking.bookingId),
    ...booking,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return stripItem(item);
}

export async function updateBooking(
  tenantId: string,
  bookingId: string,
  patch: Partial<Booking>
): Promise<Booking | null> {
  const existing = await getBooking(tenantId, bookingId);
  if (!existing) return null;
  const updated: Booking = {
    ...existing,
    ...patch,
    bookingId: existing.bookingId,
    tenantId: existing.tenantId,
    updatedAt: new Date().toISOString(),
  };
  const item = {
    ...bookingKeys(tenantId, bookingId),
    ...gsi1Keys(updated.tenantId, updated.botId, updated.startAt, updated.bookingId),
    ...updated,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return stripItem(item);
}
