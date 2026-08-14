import { getOpenAIApiKey } from "../ai/providers/openai.js";
import { getCallRecord } from "../dynamodb/call.repository.js";
import { listCallEvents } from "../dynamodb/call-event.repository.js";
import { getConversation, getConversationMessages, updateConversation } from "../dynamodb/conversation.repository.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function generateCallCopilotSummary(params: {
  tenantId: string;
  callId: string;
}): Promise<{ summary: string }> {
  const call = await getCallRecord(params.tenantId, params.callId);
  if (!call) throw Object.assign(new Error("Call not found"), { statusCode: 404 });

  const events = await listCallEvents(params.tenantId, params.callId);
  const timeline = events
    .map((event) => `${event.type}${event.message ? `: ${event.message}` : ""}`)
    .join("\n");

  let transcript = "";
  if (call.conversationId) {
    const conversation = await getConversation(params.tenantId, call.botId, call.conversationId);
    if (conversation) {
      const messages = await getConversationMessages(params.tenantId, call.conversationId, 50);
      transcript = messages
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n");
    }
  }

  const apiKey = await getOpenAIApiKey(params.tenantId, ENVIRONMENT);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Summarize this contact center call for the advisor wrap-up. Include reason, outcome, and next steps. Reply in the customer's language.",
        },
        {
          role: "user",
          content: `Disposition: ${call.disposition ?? "none"}\nFrom: ${call.phoneNumber}\nEvents:\n${timeline}\nTranscript:\n${transcript || "(none)"}`,
        },
      ],
    }),
  });
  if (!response.ok) {
    throw Object.assign(new Error("Failed to generate copilot summary"), { statusCode: 502 });
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const summary = data.choices?.[0]?.message?.content?.trim() || "";
  if (call.conversationId) {
    await updateConversation(params.tenantId, call.botId, call.conversationId, {
      copilotSummary: summary,
      copilotGeneratedAt: new Date().toISOString(),
    });
  }
  return { summary };
}
