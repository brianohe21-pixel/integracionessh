import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { AgentPresence, AgentPresenceState } from "../../types/index.js";

function keys(tenantId: string, advisorId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `CCPRESENCE#${advisorId}`,
  };
}

export async function getAgentPresence(
  tenantId: string,
  advisorId: string
): Promise<AgentPresence | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: keys(tenantId, advisorId) })
  );
  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as AgentPresence;
}

export async function listAgentPresence(tenantId: string): Promise<AgentPresence[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "CCPRESENCE#",
      },
    })
  );
  return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) => {
    void PK;
    void SK;
    void GSI1PK;
    void GSI1SK;
    return rest as AgentPresence;
  });
}

export async function putAgentPresence(presence: AgentPresence): Promise<AgentPresence> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys(presence.tenantId, presence.advisorId),
        GSI1PK: `TENANT#${presence.tenantId}#CCAGENT#${presence.state}`,
        GSI1SK: `IDLE#${presence.lastCallAt ?? presence.updatedAt}`,
        ...presence,
      },
    })
  );
  return presence;
}

export function isPresenceStale(presence: AgentPresence, nowMs = Date.now()): boolean {
  const heartbeat = Date.parse(presence.lastHeartbeatAt);
  if (!Number.isFinite(heartbeat)) return true;
  return nowMs - heartbeat > 45_000;
}

export function effectivePresenceState(
  presence: AgentPresence,
  nowMs = Date.now()
): AgentPresenceState {
  if (isPresenceStale(presence, nowMs)) return "offline";
  if (presence.state === "wrap_up" && presence.wrapUpUntil) {
    const until = Date.parse(presence.wrapUpUntil);
    if (Number.isFinite(until) && until <= nowMs) return "available";
  }
  return presence.state;
}
