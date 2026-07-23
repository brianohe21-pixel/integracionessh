import type { Conversation } from "../../types/index.js";
import {
  DEFAULT_INBOX_SLA,
  formatElapsedDuration,
  getConversationSlaStatus,
  getElapsedSecondsSinceHandoff,
  resolveInboxSlaSettings,
} from "./inbox-sla.js";

const enabledSla = { enabled: true, firstResponseMinutes: 5 };

function conversation(
  overrides: Partial<Conversation> = {}
): Pick<
  Conversation,
  "handoffMode" | "handoffAt" | "firstHumanResponseAt" | "workflowStatus"
> {
  return {
    handoffMode: "human",
    handoffAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("resolveInboxSlaSettings", () => {
  it("returns defaults when settings are missing", () => {
    expect(resolveInboxSlaSettings()).toEqual(DEFAULT_INBOX_SLA);
  });

  it("merges partial settings", () => {
    expect(resolveInboxSlaSettings({ enabled: true, firstResponseMinutes: 10 })).toEqual({
      enabled: true,
      firstResponseMinutes: 10,
    });
  });
});

describe("getConversationSlaStatus", () => {
  const handoffAt = "2026-01-01T12:00:00.000Z";

  it("returns disabled when SLA is off", () => {
    expect(
      getConversationSlaStatus(conversation(), { enabled: false, firstResponseMinutes: 5 })
    ).toBe("disabled");
  });

  it("returns disabled without handoffAt", () => {
    expect(
      getConversationSlaStatus(
        { handoffMode: "human", workflowStatus: "new" },
        enabledSla,
        Date.parse(handoffAt)
      )
    ).toBe("disabled");
  });

  it("returns met when first response is within SLA", () => {
    expect(
      getConversationSlaStatus(
        conversation({ firstHumanResponseAt: "2026-01-01T12:04:00.000Z" }),
        enabledSla
      )
    ).toBe("met");
  });

  it("returns missed when first response exceeds SLA", () => {
    expect(
      getConversationSlaStatus(
        conversation({ firstHumanResponseAt: "2026-01-01T12:06:00.000Z" }),
        enabledSla
      )
    ).toBe("missed");
  });

  it("returns at_risk before SLA breach", () => {
    const now = Date.parse("2026-01-01T12:04:30.000Z");
    expect(getConversationSlaStatus(conversation(), enabledSla, now)).toBe("at_risk");
  });

  it("returns breached when open past SLA", () => {
    const now = Date.parse("2026-01-01T12:05:01.000Z");
    expect(getConversationSlaStatus(conversation(), enabledSla, now)).toBe("breached");
  });

  it("returns ok when within safe window", () => {
    const now = Date.parse("2026-01-01T12:02:00.000Z");
    expect(getConversationSlaStatus(conversation(), enabledSla, now)).toBe("ok");
  });

  it("returns disabled for resolved conversations without response", () => {
    expect(
      getConversationSlaStatus(
        conversation({ workflowStatus: "resolved" }),
        enabledSla,
        Date.parse("2026-01-01T12:10:00.000Z")
      )
    ).toBe("disabled");
  });
});

describe("elapsed helpers", () => {
  it("computes elapsed seconds since handoff", () => {
    const now = Date.parse("2026-01-01T12:03:30.000Z");
    expect(getElapsedSecondsSinceHandoff("2026-01-01T12:00:00.000Z", now)).toBe(210);
  });

  it("formats elapsed duration", () => {
    expect(formatElapsedDuration(45)).toBe("45s");
    expect(formatElapsedDuration(125)).toBe("2m 5s");
    expect(formatElapsedDuration(3600)).toBe("1h");
  });
});
