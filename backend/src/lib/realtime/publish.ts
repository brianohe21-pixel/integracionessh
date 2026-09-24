import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { Conversation } from "../../types/index.js";
import {
  deleteRealtimeConnection,
  listRealtimeConnections,
} from "./connections.repository.js";
import type { RealtimeConnection, RealtimeEvent } from "./types.js";

let managementClient: ApiGatewayManagementApiClient | null = null;

function getManagementClient(): ApiGatewayManagementApiClient | null {
  const endpoint = process.env.WEBSOCKET_API_ENDPOINT ?? "";
  if (!endpoint) return null;
  if (!managementClient) {
    managementClient = new ApiGatewayManagementApiClient({ endpoint });
  }
  return managementClient;
}

export function shouldDeliverToConnection(
  connection: RealtimeConnection,
  conversation: Conversation
): boolean {
  if (connection.role === "member" || connection.role === "supervisor") return true;
  if (connection.role === "advisor") {
    return conversation.assignedAdvisorId === connection.advisorId;
  }
  return false;
}

function shouldDeliverTaskReminder(
  connection: RealtimeConnection,
  advisorId?: string
): boolean {
  if (connection.role === "member" || connection.role === "supervisor") return true;
  if (connection.role === "advisor") {
    if (!advisorId) return false;
    return connection.advisorId === advisorId;
  }
  return false;
}

async function postToConnection(connectionId: string, body: string): Promise<void> {
  const client = getManagementClient();
  if (!client) return;

  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(body),
      })
    );
  } catch (error) {
    if (error instanceof GoneException) {
      return;
    }
    throw error;
  }
}

export async function publishRealtimeEvent(
  tenantId: string,
  event: RealtimeEvent
): Promise<void> {
  const client = getManagementClient();
  if (!client) return;

  const connections = await listRealtimeConnections(tenantId);
  let targets = connections;

  if (
    event.type === "message.created" ||
    event.type === "conversation.updated" ||
    event.type === "conversation.handoff"
  ) {
    targets = connections.filter((connection) =>
      shouldDeliverToConnection(connection, event.conversation)
    );
  } else if (event.type === "task.reminder") {
    targets = connections.filter((connection) =>
      shouldDeliverTaskReminder(connection, event.advisorId)
    );
  }

  if (targets.length === 0) return;

  const body = JSON.stringify(event);

  await Promise.all(
    targets.map(async (connection) => {
      try {
        await postToConnection(connection.connectionId, body);
      } catch (error) {
        if (error instanceof GoneException) {
          await deleteRealtimeConnection(tenantId, connection.connectionId).catch(() => undefined);
          return;
        }
        console.error("Failed to publish realtime event:", error);
      }
    })
  );
}

export function publishRealtimeEventSafe(tenantId: string, event: RealtimeEvent): void {
  void publishRealtimeEvent(tenantId, event).catch((error) => {
    console.error("Failed to publish realtime event:", error);
  });
}
