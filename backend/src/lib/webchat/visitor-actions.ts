import { performInboxHandoff } from "../advisor/handoff.js";
import { getClientHandoffMessage } from "../advisor/notify.js";
import { resolveConversation } from "../advisor/resolve.js";
import { buildOutboundContext, sendChannelText } from "../channels/router.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getConversation } from "../dynamodb/conversation.repository.js";
import { getBotLocale, getSystemMessage } from "../i18n/index.js";
import {
  endWebChatSession,
  isWebChatSessionEnded,
} from "./session.repository.js";
import type { HandoffMode, WebChatSession } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function endVisitorWebchatSession(session: WebChatSession): Promise<{
  status: "ended";
  farewellMessage?: string;
}> {
  if (isWebChatSessionEnded(session)) {
    return { status: "ended" };
  }

  const bot = await getBot(session.tenantId, session.botId);
  if (!bot) throw new Error("Bot not found");

  const conversation = await getConversation(
    session.tenantId,
    session.botId,
    session.conversationId
  );
  if (!conversation) throw new Error("Conversation not found");

  const locale = getBotLocale(conversation, bot);
  const farewellMessage = getSystemMessage("webchatConversationEnded", locale);

  await resolveConversation({
    tenantId: session.tenantId,
    botId: session.botId,
    conversationId: session.conversationId,
  });

  await sendChannelText(
    buildOutboundContext({
      tenantId: session.tenantId,
      botId: session.botId,
      bot,
      conversation,
      environment: ENVIRONMENT,
    }),
    farewellMessage
  );

  await endWebChatSession(session.sessionId);

  return { status: "ended", farewellMessage };
}

export async function requestVisitorWebchatHandoff(session: WebChatSession): Promise<{
  message: string;
  handoffMode: HandoffMode;
}> {
  if (isWebChatSessionEnded(session)) {
    throw new Error("Session ended");
  }

  const bot = await getBot(session.tenantId, session.botId);
  if (!bot) throw new Error("Bot not found");

  const conversation = await getConversation(
    session.tenantId,
    session.botId,
    session.conversationId
  );
  if (!conversation) throw new Error("Conversation not found");

  const locale = getBotLocale(conversation, bot);

  if ((conversation.handoffMode ?? "bot") === "human") {
    const message = getSystemMessage("webchatAlreadyWithAdvisor", locale);
    return { message, handoffMode: "human" };
  }

  const updated = await performInboxHandoff({
    tenantId: session.tenantId,
    botId: session.botId,
    conversationId: session.conversationId,
    reason: "manual",
  });

  if (!updated) throw new Error("Conversation not found");

  const message =
    (updated.handoffMode ?? "bot") === "human"
      ? getClientHandoffMessage(locale)
      : getSystemMessage("noAdvisorsAvailable", locale);

  await sendChannelText(
    buildOutboundContext({
      tenantId: session.tenantId,
      botId: session.botId,
      bot,
      conversation: updated,
      environment: ENVIRONMENT,
    }),
    message
  );

  return { message, handoffMode: updated.handoffMode ?? "bot" };
}
