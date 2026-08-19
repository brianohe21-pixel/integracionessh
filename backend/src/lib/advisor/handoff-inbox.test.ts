import { performInboxHandoff } from "./handoff.js";
import { pickAdvisor } from "./pick.js";
import {
  addMessage,
  getConversation,
  updateConversation,
} from "../dynamodb/conversation.repository.js";
import { publishRealtimeEventSafe } from "../realtime/publish.js";

jest.mock("./pick.js");
jest.mock("../dynamodb/conversation.repository.js");
jest.mock("../dynamodb/advisor.repository.js", () => ({
  touchAdvisorAssignment: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../integrations/emit.js", () => ({
  emitIntegrationEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../realtime/publish.js");

const pickAdvisorMock = pickAdvisor as jest.MockedFunction<typeof pickAdvisor>;
const getConversationMock = getConversation as jest.MockedFunction<typeof getConversation>;
const updateConversationMock = updateConversation as jest.MockedFunction<typeof updateConversation>;
const addMessageMock = addMessage as jest.MockedFunction<typeof addMessage>;

describe("performInboxHandoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("assigns an advisor when one is available", async () => {
    pickAdvisorMock.mockResolvedValue({ advisorId: "adv-1" } as never);
    getConversationMock.mockResolvedValue({
      conversationId: "conv-1",
      phoneNumber: "+573001112233",
    } as never);
    updateConversationMock.mockResolvedValue({
      conversationId: "conv-1",
      handoffMode: "human",
      assignedAdvisorId: "adv-1",
    } as never);

    const result = await performInboxHandoff({
      tenantId: "tenant-1",
      botId: "bot-1",
      conversationId: "conv-1",
      reason: "no_ai",
    });

    expect(updateConversationMock).toHaveBeenCalledWith(
      "tenant-1",
      "bot-1",
      "conv-1",
      expect.objectContaining({
        handoffMode: "human",
        assignedAdvisorId: "adv-1",
        handoffReason: "no_ai",
      })
    );
    expect(addMessageMock).toHaveBeenCalled();
    expect(publishRealtimeEventSafe).toHaveBeenCalled();
    expect(result?.assignedAdvisorId).toBe("adv-1");
  });

  it("keeps the conversation in human inbox without assignment when no advisor is available", async () => {
    pickAdvisorMock.mockResolvedValue(null);
    getConversationMock.mockResolvedValue({
      conversationId: "conv-1",
      phoneNumber: "+573001112233",
    } as never);
    updateConversationMock.mockResolvedValue({
      conversationId: "conv-1",
      handoffMode: "human",
      assignedAdvisorId: undefined,
    } as never);

    const result = await performInboxHandoff({
      tenantId: "tenant-1",
      botId: "bot-1",
      conversationId: "conv-1",
      reason: "no_ai",
    });

    expect(updateConversationMock).toHaveBeenCalledWith(
      "tenant-1",
      "bot-1",
      "conv-1",
      expect.objectContaining({
        handoffMode: "human",
        handoffReason: "no_ai",
      })
    );
    expect(updateConversationMock.mock.calls[0]?.[3]).not.toHaveProperty("assignedAdvisorId");
    expect(result?.assignedAdvisorId).toBeUndefined();
  });
});
