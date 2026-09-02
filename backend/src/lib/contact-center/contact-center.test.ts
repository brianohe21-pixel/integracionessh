import { isWithinBusinessHours } from "./hours.js";
import { pickAgentForQueue, agentMatchesQueue, queuePosition } from "./acd.js";
import { resolveBotRoutingMode, resolveIvrDigit, findIvrNode } from "./routing.js";
import { buildTelnyxCredentialConnectionName } from "../telnyx/provision.js";
import type { AgentPresence, Bot, ContactCenterIvrFlow, ContactCenterQueue } from "../../types/index.js";

describe("contact center hours", () => {
  it("treats missing hours as always open", () => {
    expect(isWithinBusinessHours(undefined, new Date("2026-08-14T15:00:00Z"))).toBe(true);
  });

  it("respects a weekday window in UTC", () => {
    const hours = {
      timezone: "UTC",
      days: {
        fri: { start: "08:00", end: "18:00" },
        sat: null,
      },
    };
    expect(isWithinBusinessHours(hours, new Date("2026-08-14T12:00:00Z"))).toBe(true);
    expect(isWithinBusinessHours(hours, new Date("2026-08-14T20:00:00Z"))).toBe(false);
    expect(isWithinBusinessHours(hours, new Date("2026-08-15T12:00:00Z"))).toBe(false);
  });
});

describe("contact center routing", () => {
  it("defaults bots to AI routing", () => {
    expect(resolveBotRoutingMode({ telephonyRoutingMode: undefined } as unknown as Bot)).toBe("ai");
    expect(resolveBotRoutingMode({ telephonyRoutingMode: "queue" } as unknown as Bot)).toBe("queue");
  });

  it("resolves IVR digits", () => {
    const flow: ContactCenterIvrFlow = {
      ivrFlowId: "ivr-1",
      tenantId: "t1",
      botId: "b1",
      name: "Main",
      entryNodeId: "menu",
      nodes: [
        {
          nodeId: "menu",
          type: "menu",
          options: [
            { digit: "1", targetType: "queue", targetId: "q1" },
            { digit: "2", targetType: "ai" },
          ],
        },
      ],
      createdAt: "",
      updatedAt: "",
    };
    const node = findIvrNode(flow);
    expect(resolveIvrDigit(node!, "1")).toEqual({ targetType: "queue", targetId: "q1" });
    expect(resolveIvrDigit(node!, "9")).toBeNull();
  });
});

describe("contact center ACD", () => {
  const queue: ContactCenterQueue = {
    queueId: "q1",
    tenantId: "t1",
    botId: "b1",
    name: "Support",
    strategy: "longest_idle",
    skills: ["es"],
    slaSeconds: 20,
    afterHoursAction: "ai",
    createdAt: "",
    updatedAt: "",
  };

  function agent(overrides: Partial<AgentPresence>): AgentPresence {
    return {
      advisorId: "a1",
      tenantId: "t1",
      state: "available",
      skills: ["es"],
      queueIds: ["q1"],
      webrtcConnected: true,
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("requires available webrtc agents with matching skills", () => {
    expect(agentMatchesQueue(agent({ webrtcConnected: false }), queue)).toBe(false);
    expect(agentMatchesQueue(agent({ skills: [] }), queue)).toBe(false);
    expect(agentMatchesQueue(agent({}), queue)).toBe(true);
  });

  it("picks the longest idle agent", () => {
    const picked = pickAgentForQueue(
      [
        agent({ advisorId: "new", lastCallAt: "2026-08-14T12:00:00Z" }),
        agent({ advisorId: "old", lastCallAt: "2026-08-14T10:00:00Z" }),
      ],
      queue
    );
    expect(picked?.advisorId).toBe("old");
  });

  it("computes queue position", () => {
    expect(queuePosition("b", ["a", "b", "c"])).toBe(2);
  });
});

describe("contact center queue fallback actions", () => {
  it("defaults overflow action to hangup on queue fixture", () => {
    const queue: ContactCenterQueue = {
      queueId: "q1",
      tenantId: "t1",
      botId: "b1",
      name: "Support",
      strategy: "longest_idle",
      skills: [],
      slaSeconds: 30,
      afterHoursAction: "callback",
      overflowAction: "voicemail",
      createdAt: "",
      updatedAt: "",
    };
    expect(queue.afterHoursAction).toBe("callback");
    expect(queue.overflowAction).toBe("voicemail");
  });
});

describe("telnyx webrtc provisioning names", () => {
  it("builds a tenant credential connection name", () => {
    expect(buildTelnyxCredentialConnectionName("tenant-1")).toBe(
      "integracionessh-tenant-1-webrtc"
    );
  });
});
