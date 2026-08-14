import { listAgentPresence, effectivePresenceState } from "../dynamodb/agent-presence.repository.js";
import { listContactCenterQueues } from "../dynamodb/contact-center-queue.repository.js";
import { listQueueMemberships } from "../dynamodb/queue-membership.repository.js";
import { listAllCallsForTenant } from "../dynamodb/call.repository.js";
import { listAdvisors } from "../dynamodb/advisor.repository.js";
import type { ContactCenterWallboard } from "../../types/index.js";

export async function buildWallboard(tenantId: string): Promise<ContactCenterWallboard> {
  const [agents, queues, advisors, calls] = await Promise.all([
    listAgentPresence(tenantId),
    listContactCenterQueues(tenantId),
    listAdvisors(tenantId),
    listAllCallsForTenant(tenantId),
  ]);
  const advisorNames = new Map(advisors.map((advisor) => [advisor.advisorId, advisor.name]));
  const now = Date.now();

  const waitingByQueue = await Promise.all(
    queues.map(async (queue) => ({
      queue,
      waiting: await listQueueMemberships(tenantId, queue.queueId),
    }))
  );

  const liveCalls = calls.filter(
    (call) =>
      call.provider === "telnyx" &&
      (call.status === "accepted" || call.status === "ringing") &&
      call.contactCenterMode === "agent"
  );

  const recent = calls.filter((call) => call.provider === "telnyx" && call.contactCenterMode);
  const abandoned = recent.filter((call) => !call.advisorId && call.status === "completed").length;
  const answered = recent.filter((call) => Boolean(call.advisorId)).length;
  const waitSamples = recent
    .map((call) => call.waitSeconds)
    .filter((value): value is number => typeof value === "number");
  const averageSpeedOfAnswerSeconds =
    waitSamples.length > 0
      ? Math.round(waitSamples.reduce((sum, value) => sum + value, 0) / waitSamples.length)
      : 0;

  return {
    agents: agents
      .filter((agent) => agent.kind !== "member")
      .map((agent) => {
        const currentCallId = liveCalls.find((call) => call.advisorId === agent.advisorId)?.callId;
        return {
          advisorId: agent.advisorId,
          name: advisorNames.get(agent.advisorId) ?? agent.advisorId,
          state: effectivePresenceState(agent, now),
          queueIds: agent.queueIds,
          webrtcConnected: agent.webrtcConnected,
          callsHandled: agent.callsHandled ?? 0,
          ...(currentCallId ? { currentCallId } : {}),
        };
      }),
    queues: waitingByQueue.map(({ queue, waiting }) => {
      const longest = waiting.reduce((max, item) => {
        const wait = Math.max(0, Math.round((now - Date.parse(item.queuedAt)) / 1000));
        return Math.max(max, wait);
      }, 0);
      return {
        queueId: queue.queueId,
        name: queue.name,
        waiting: waiting.length,
        longestWaitSeconds: longest,
        slaSeconds: queue.slaSeconds,
      };
    }),
    liveCalls: liveCalls.map((call) => ({
      callId: call.callId,
      ...(call.queueId ? { queueId: call.queueId } : {}),
      ...(call.advisorId ? { advisorId: call.advisorId } : {}),
      fromNumber: call.phoneNumber,
      ...(call.conferenceId ? { conferenceId: call.conferenceId } : {}),
      ...(call.startedAt ? { startedAt: call.startedAt } : {}),
      ...(call.waitSeconds !== undefined ? { waitSeconds: call.waitSeconds } : {}),
    })),
    metrics: {
      availableAgents: agents.filter(
        (agent) => agent.kind !== "member" && effectivePresenceState(agent, now) === "available"
      ).length,
      callsInQueue: waitingByQueue.reduce((sum, item) => sum + item.waiting.length, 0),
      callsLive: liveCalls.length,
      abandonRate: recent.length === 0 ? 0 : abandoned / Math.max(1, abandoned + answered),
      averageSpeedOfAnswerSeconds,
    },
  };
}
