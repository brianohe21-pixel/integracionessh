import { randomUUID } from "crypto";
import { PutCommand, QueryCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { listTenants } from "./tenant.repository.js";
import type { SupportTicket, SupportTicketCategory, SupportTicketStatus } from "../../types/index.js";

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

async function listTicketsForTenant(tenantId: string, limit = 50): Promise<SupportTicket[]> {
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

  return (result.Items ?? []).map(
    ({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as SupportTicket
  );
}

export async function listTicketsByUser(
  tenantId: string,
  userId: string,
  limit = 50
): Promise<SupportTicket[]> {
  const tickets = await listTicketsForTenant(tenantId, limit);
  return tickets
    .filter((t) => t.createdBy === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllTickets(limit = 100): Promise<SupportTicket[]> {
  const tenants = await listTenants();
  const all: SupportTicket[] = [];

  for (const tenant of tenants) {
    const tickets = await listTicketsForTenant(tenant.tenantId, 20);
    all.push(...tickets);
  }

  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function getTicket(
  tenantId: string,
  ticketId: string
): Promise<SupportTicket | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `TICKET#${ticketId}` },
    })
  );

  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as SupportTicket;
}

export async function updateTicketAdmin(
  tenantId: string,
  ticketId: string,
  updates: {
    status?: SupportTicketStatus;
    adminReply?: string;
  }
): Promise<SupportTicket | null> {
  const existing = await getTicket(tenantId, ticketId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const status = updates.status ?? existing.status;
  const closedAt =
    status === "closed" ? now : existing.closedAt;

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `TICKET#${ticketId}` },
      UpdateExpression:
        "SET #status = :status, updatedAt = :now, adminReply = :adminReply, closedAt = :closedAt",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":now": now,
        ":adminReply": updates.adminReply ?? existing.adminReply ?? null,
        ":closedAt": closedAt ?? null,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Attributes ?? {};
  return rest as SupportTicket;
}
