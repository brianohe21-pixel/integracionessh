import { randomUUID } from "crypto";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { SupportTicket, SupportTicketCategory } from "../../types/index.js";

function ticketKeys(tenantId: string, ticketId: string, createdAt: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `TICKET#${ticketId}`,
    GSI1PK: `TENANT#${tenantId}#TICKETS`,
    GSI1SK: `${createdAt}#${ticketId}`,
  };
}

export async function createTicket(input: {
  tenantId: string;
  createdBy: string;
  email: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
}): Promise<SupportTicket> {
  const now = new Date().toISOString();
  const ticketId = randomUUID();

  const ticket: SupportTicket = {
    ticketId,
    tenantId: input.tenantId,
    createdBy: input.createdBy,
    email: input.email,
    category: input.category,
    subject: input.subject,
    message: input.message,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...ticketKeys(input.tenantId, ticketId, now), ...ticket },
    })
  );

  return ticket;
}

export async function listTicketsByUser(
  tenantId: string,
  userId: string,
  limit = 50
): Promise<SupportTicket[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "TICKET#",
      },
      Limit: limit,
    })
  );

  const tickets = (result.Items ?? []).map(
    ({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as SupportTicket
  );

  return tickets
    .filter((t) => t.createdBy === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
