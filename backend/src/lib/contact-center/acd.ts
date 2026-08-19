import type { AgentPresence, ContactCenterQueue, QueueStrategy } from "../../types/index.js";
import { effectivePresenceState } from "../dynamodb/agent-presence.repository.js";

export function agentMatchesQueue(agent: AgentPresence, queue: ContactCenterQueue): boolean {
  if (effectivePresenceState(agent) !== "available") return false;
  if (!agent.webrtcConnected) return false;
  if (!agent.queueIds.includes(queue.queueId)) return false;
  if (queue.skills.length === 0) return true;
  return queue.skills.every((skill) => agent.skills.includes(skill));
}

export function pickAgentForQueue(
  agents: AgentPresence[],
  queue: ContactCenterQueue,
  strategy: QueueStrategy = queue.strategy
): AgentPresence | null {
  const eligible = agents.filter((agent) => agentMatchesQueue(agent, queue));
  if (eligible.length === 0) return null;

  if (strategy === "fewest_calls") {
    return [...eligible].sort((a, b) => (a.callsHandled ?? 0) - (b.callsHandled ?? 0))[0];
  }

  if (strategy === "round_robin") {
    return [...eligible].sort((a, b) => (a.lastCallAt ?? "").localeCompare(b.lastCallAt ?? ""))[0];
  }

  return [...eligible].sort((a, b) => (a.lastCallAt ?? "").localeCompare(b.lastCallAt ?? ""))[0];
}

export function queuePosition(queuedAt: string, waitingQueuedAt: string[]): number {
  const ordered = [...waitingQueuedAt].sort();
  return ordered.indexOf(queuedAt) + 1;
}
