import type { Conversation } from "../../types/index.js";
import { matchesConversationAssignment } from "../dynamodb/conversation.repository.js";

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: "c1",
    tenantId: "t1",
    botId: "b1",
    channel: "whatsapp",
    participantId: "p1",
    phoneNumber: "1234567890",
    status: "active",
    lastMessageAt: "2026-01-01T12:00:00.000Z",
    messageCount: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("matchesConversationAssignment", () => {
  it("returns true when assignment filter is omitted", () => {
    expect(matchesConversationAssignment(conversation(), undefined)).toBe(true);
  });

  it("matches unassigned human conversations", () => {
    expect(
      matchesConversationAssignment(
        conversation({ handoffMode: "human", workflowStatus: "new" }),
        "unassigned"
      )
    ).toBe(true);
  });

  it("excludes bot-mode conversations from unassigned filter", () => {
    expect(matchesConversationAssignment(conversation({ handoffMode: "bot" }), "unassigned")).toBe(
      false
    );
  });

  it("excludes resolved conversations from unassigned filter", () => {
    expect(
      matchesConversationAssignment(
        conversation({ handoffMode: "human", workflowStatus: "resolved" }),
        "unassigned"
      )
    ).toBe(false);
  });

  it("excludes assigned conversations from unassigned filter", () => {
    expect(
      matchesConversationAssignment(
        conversation({
          handoffMode: "human",
          assignedAdvisorId: "a1",
          workflowStatus: "open",
        }),
        "unassigned"
      )
    ).toBe(false);
  });

  it("matches assigned human conversations", () => {
    expect(
      matchesConversationAssignment(
        conversation({
          handoffMode: "human",
          assignedAdvisorId: "a1",
          workflowStatus: "pending",
        }),
        "assigned"
      )
    ).toBe(true);
  });
});
