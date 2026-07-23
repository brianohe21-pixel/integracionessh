import type { Conversation } from "../../types/index.js";
import { claimConversation, performBulkHandoff } from "./handoff.js";

jest.mock("../dynamodb/conversation.repository.js", () => ({
  getConversation: jest.fn(),
  claimConversationAssignment: jest.fn(),
  addMessage: jest.fn(),
  updateConversation: jest.fn(),
  clearConversationHandoff: jest.fn(),
  getConversationMessages: jest.fn(),
}));

jest.mock("../dynamodb/advisor.repository.js", () => ({
  getAdvisor: jest.fn(),
  touchAdvisorAssignment: jest.fn(),
}));

jest.mock("../dynamodb/bot.repository.js", () => ({
  getBot: jest.fn(),
}));

jest.mock("../dynamodb/tenant.repository.js", () => ({
  getTenant: jest.fn(),
}));

jest.mock("../billing/assert-plan.js", () => ({
  assertCanUseCopilot: jest.fn(),
}));

jest.mock("../integrations/emit.js", () => ({
  emitIntegrationEvent: jest.fn(),
}));

jest.mock("../realtime/publish.js", () => ({
  publishRealtimeEventSafe: jest.fn(),
}));

jest.mock("./copilot.js", () => ({
  generateCopilotInsights: jest.fn(),
}));

jest.mock("./pick.js", () => ({
  pickAdvisor: jest.fn(),
}));

import { getConversation, claimConversationAssignment, addMessage, updateConversation } from "../dynamodb/conversation.repository.js";
import { getAdvisor, touchAdvisorAssignment } from "../dynamodb/advisor.repository.js";

const mockedGetConversation = getConversation as jest.MockedFunction<typeof getConversation>;
const mockedUpdateConversation = updateConversation as jest.MockedFunction<typeof updateConversation>;
const mockedClaimAssignment = claimConversationAssignment as jest.MockedFunction<
  typeof claimConversationAssignment
>;
const mockedGetAdvisor = getAdvisor as jest.MockedFunction<typeof getAdvisor>;
const mockedTouchAdvisor = touchAdvisorAssignment as jest.MockedFunction<
  typeof touchAdvisorAssignment
>;
const mockedAddMessage = addMessage as jest.MockedFunction<typeof addMessage>;

function baseConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: "c1",
    tenantId: "t1",
    botId: "b1",
    channel: "whatsapp",
    participantId: "p1",
    phoneNumber: "1234567890",
    status: "active",
    handoffMode: "human",
    workflowStatus: "new",
    lastMessageAt: "2026-01-01T12:00:00.000Z",
    messageCount: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("claimConversation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAdvisor.mockResolvedValue({
      advisorId: "a1",
      tenantId: "t1",
      name: "Advisor",
      phoneNumber: "123",
      status: "active",
      botIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockedTouchAdvisor.mockResolvedValue(undefined);
    mockedAddMessage.mockResolvedValue(undefined);
  });

  it("claims an unassigned conversation", async () => {
    const conversation = baseConversation();
    mockedGetConversation.mockResolvedValue(conversation);
    mockedClaimAssignment.mockResolvedValue({
      ...conversation,
      assignedAdvisorId: "a1",
    });

    const result = await claimConversation({
      tenantId: "t1",
      botId: "b1",
      conversationId: "c1",
      advisorId: "a1",
    });

    expect(result.assignedAdvisorId).toBe("a1");
    expect(mockedClaimAssignment).toHaveBeenCalledWith("t1", "b1", "c1", "a1");
  });

  it("is idempotent when already assigned to the same advisor", async () => {
    const conversation = baseConversation({ assignedAdvisorId: "a1" });
    mockedGetConversation.mockResolvedValue(conversation);

    const result = await claimConversation({
      tenantId: "t1",
      botId: "b1",
      conversationId: "c1",
      advisorId: "a1",
    });

    expect(result.assignedAdvisorId).toBe("a1");
    expect(mockedClaimAssignment).not.toHaveBeenCalled();
  });

  it("rejects when conversation is not in human handoff mode", async () => {
    mockedGetConversation.mockResolvedValue(baseConversation({ handoffMode: "bot" }));

    await expect(
      claimConversation({
        tenantId: "t1",
        botId: "b1",
        conversationId: "c1",
        advisorId: "a1",
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("performBulkHandoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAdvisor.mockResolvedValue({
      advisorId: "a1",
      tenantId: "t1",
      name: "Advisor",
      phoneNumber: "123",
      status: "active",
      botIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockedTouchAdvisor.mockResolvedValue(undefined);
    mockedAddMessage.mockResolvedValue(undefined);
  });

  it("aggregates successes and failures", async () => {
    mockedGetConversation
      .mockResolvedValueOnce(baseConversation({ conversationId: "c1" }))
      .mockResolvedValueOnce(baseConversation({ conversationId: "c2" }))
      .mockResolvedValueOnce(null);
    mockedUpdateConversation
      .mockResolvedValueOnce(baseConversation({ conversationId: "c1", assignedAdvisorId: "a1" }))
      .mockRejectedValueOnce(new Error("Advisor unavailable"));

    const result = await performBulkHandoff({
      tenantId: "t1",
      items: [
        { conversationId: "c1", botId: "b1" },
        { conversationId: "c2", botId: "b1" },
        { conversationId: "c3", botId: "b1" },
      ],
      reason: "manual",
      advisorId: "a1",
    });

    expect(result.succeeded.length + result.failed.length).toBe(3);
    expect(result.failed.map((f) => f.conversationId)).toEqual(
      expect.arrayContaining(["c2", "c3"])
    );
  });
});
