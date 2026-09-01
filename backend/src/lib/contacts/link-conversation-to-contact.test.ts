import { linkConversationToContact } from "./link-conversation-to-contact.js";
import { getConversation, updateConversation } from "../dynamodb/conversation.repository.js";
import { resolveContactId } from "./resolve-contact-id.js";
import { indexContactConversation } from "./contact-conversation-index.js";
import { updateWebChatSessionIdentity } from "../webchat/session.repository.js";

jest.mock("../dynamodb/conversation.repository.js");
jest.mock("./resolve-contact-id.js");
jest.mock("./contact-conversation-index.js");
jest.mock("../webchat/session.repository.js", () => ({
  updateWebChatSessionIdentity: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../voicebot/session.repository.js", () => ({
  updateVoicebotSessionIdentity: jest.fn().mockResolvedValue(undefined),
}));

const getConversationMock = getConversation as jest.MockedFunction<typeof getConversation>;
const updateConversationMock = updateConversation as jest.MockedFunction<typeof updateConversation>;
const resolveContactIdMock = resolveContactId as jest.MockedFunction<typeof resolveContactId>;
const indexContactConversationMock = indexContactConversation as jest.MockedFunction<
  typeof indexContactConversation
>;
const updateWebChatSessionIdentityMock = updateWebChatSessionIdentity as jest.MockedFunction<
  typeof updateWebChatSessionIdentity
>;

describe("linkConversationToContact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("links a webchat session conversation to a phone contact", async () => {
    getConversationMock.mockResolvedValue({
      conversationId: "conv-web",
      tenantId: "tenant-1",
      botId: "bot-1",
      channel: "webchat",
      participantId: "session-abc",
      phoneNumber: "",
      status: "active",
      messageCount: 1,
      lastMessageAt: "2026-01-01T12:00:00.000Z",
      createdAt: "2026-01-01T12:00:00.000Z",
    });
    resolveContactIdMock.mockResolvedValue("phone:573001112233");
    updateConversationMock.mockResolvedValue({
      conversationId: "conv-web",
      contactId: "phone:573001112233",
      phoneNumber: "573001112233",
    } as never);

    const result = await linkConversationToContact({
      tenantId: "tenant-1",
      botId: "bot-1",
      conversationId: "conv-web",
      phone: "+57 300 111 2233",
      displayName: "Ana",
    });

    expect(updateConversationMock).toHaveBeenCalledWith(
      "tenant-1",
      "bot-1",
      "conv-web",
      expect.objectContaining({
        phoneNumber: "573001112233",
        contactId: "phone:573001112233",
        contactName: "Ana",
      })
    );
    expect(indexContactConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "phone:573001112233",
        conversationId: "conv-web",
        channel: "webchat",
      })
    );
    expect(updateWebChatSessionIdentityMock).toHaveBeenCalledWith("session-abc", {
      visitorPhone: "573001112233",
      visitorName: "Ana",
    });
    expect(result?.contactId).toBe("phone:573001112233");
  });

  it("returns conversation unchanged when no identity fields are provided", async () => {
    const conversation = {
      conversationId: "conv-web",
      tenantId: "tenant-1",
      botId: "bot-1",
      channel: "webchat" as const,
      participantId: "session-abc",
      phoneNumber: "",
      status: "active" as const,
      messageCount: 1,
      lastMessageAt: "2026-01-01T12:00:00.000Z",
      createdAt: "2026-01-01T12:00:00.000Z",
    };
    getConversationMock.mockResolvedValue(conversation);

    const result = await linkConversationToContact({
      tenantId: "tenant-1",
      botId: "bot-1",
      conversationId: "conv-web",
    });

    expect(result).toEqual(conversation);
    expect(updateConversationMock).not.toHaveBeenCalled();
  });
});
