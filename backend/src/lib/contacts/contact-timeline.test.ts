import { getCrossChannelHistory } from "./contact-timeline.js";
import { listContactConversations } from "./contact-conversation-index.js";
import { getConversationMessages } from "../dynamodb/conversation.repository.js";
import type { Conversation } from "../../types/index.js";

jest.mock("./contact-conversation-index.js");
jest.mock("../dynamodb/conversation.repository.js");

const listContactConversationsMock = listContactConversations as jest.MockedFunction<
  typeof listContactConversations
>;
const getConversationMessagesMock = getConversationMessages as jest.MockedFunction<
  typeof getConversationMessages
>;

const baseConversation: Conversation = {
  conversationId: "conv-wa",
  tenantId: "tenant-1",
  botId: "bot-1",
  channel: "whatsapp",
  participantId: "573001112233",
  phoneNumber: "573001112233",
  contactId: "phone:573001112233",
  status: "active",
  messageCount: 1,
  lastMessageAt: "2026-01-01T12:00:00.000Z",
  createdAt: "2026-01-01T12:00:00.000Z",
};

describe("getCrossChannelHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns messages from other channels sorted chronologically", async () => {
    listContactConversationsMock.mockResolvedValue([
      {
        botId: "bot-1",
        conversationId: "conv-wa",
        channel: "whatsapp",
        lastMessageAt: "2026-01-01T12:00:00.000Z",
      },
      {
        botId: "bot-1",
        conversationId: "conv-email",
        channel: "email",
        lastMessageAt: "2026-01-01T11:00:00.000Z",
      },
    ]);

    getConversationMessagesMock.mockImplementation(async (_tenantId, conversationId) => {
      if (conversationId === "conv-email") {
        return [
          {
            messageId: "m1",
            conversationId: "conv-email",
            tenantId: "tenant-1",
            role: "user",
            content: "Email question",
            timestamp: "2026-01-01T10:00:00.000Z",
          },
        ];
      }
      return [];
    });

    const messages = await getCrossChannelHistory({
      tenantId: "tenant-1",
      conversation: baseConversation,
      limit: 50,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("Email question");
    expect(messages[0]?.originChannel).toBe("email");
    expect(messages[0]?.isCurrentConversation).toBe(false);
    expect(getConversationMessagesMock).not.toHaveBeenCalledWith(
      "tenant-1",
      "conv-wa",
      expect.anything()
    );
  });

  it("returns empty list when contact has only one conversation", async () => {
    listContactConversationsMock.mockResolvedValue([
      {
        botId: "bot-1",
        conversationId: "conv-wa",
        channel: "whatsapp",
        lastMessageAt: "2026-01-01T12:00:00.000Z",
      },
    ]);

    const messages = await getCrossChannelHistory({
      tenantId: "tenant-1",
      conversation: baseConversation,
    });

    expect(messages).toEqual([]);
    expect(getConversationMessagesMock).not.toHaveBeenCalled();
  });
});
