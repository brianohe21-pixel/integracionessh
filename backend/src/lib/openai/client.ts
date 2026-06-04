import OpenAI from "openai";
import type { Bot, ChatCompletionResult, Message } from "../../types/index.js";
import { messageRequestsHandoff } from "../advisor/keywords.js";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient || openaiClient.apiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export async function getOpenAIApiKey(
  tenantId: string,
  environment: string
): Promise<string> {
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    "@aws-sdk/client-secrets-manager"
  );

  const client = new SecretsManagerClient({});

  try {
    const command = new GetSecretValueCommand({
      SecretId: `/${environment}/tenants/${tenantId}/openai`,
    });
    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString ?? "{}") as { apiKey: string };
    if (secret.apiKey) return secret.apiKey;
  } catch {
    // Fall through to platform key
  }

  const platformKey = process.env.OPENAI_API_KEY;
  if (!platformKey) throw new Error("No OpenAI API key configured");
  return platformKey;
}

function mapHistoryRole(msg: Message): "user" | "assistant" | null {
  if (msg.role === "user") return "user";
  if (msg.role === "assistant" || msg.role === "advisor") return "assistant";
  return null;
}

export async function generateChatResponse(
  bot: Bot,
  conversationHistory: Message[],
  userMessage: string,
  apiKey: string
): Promise<ChatCompletionResult> {
  if (messageRequestsHandoff(userMessage)) {
    return { reply: null, handoff: true, handoffReason: "El cliente solicitó un asesor" };
  }

  const client = getOpenAIClient(apiKey);

  const systemPrompt =
    (bot.systemPrompt ?? "") +
    "\n\nSi el cliente necesita hablar con un asesor, usa la herramienta transfer_to_human.";
  const model = bot.model ?? "gpt-4o";
  const temperature = bot.temperature ?? 0.7;
  const maxTokens = bot.maxTokens ?? 1024;

  const historyMessages: OpenAI.ChatCompletionMessageParam[] = [];
  for (const msg of conversationHistory.slice(-20)) {
    const role = mapHistoryRole(msg);
    if (!role) continue;
    historyMessages.push({ role, content: msg.content });
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userMessage },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    tools: [
      {
        type: "function",
        function: {
          name: "transfer_to_human",
          description: "Transfiere la conversación a un asesor",
          parameters: {
            type: "object",
            properties: {
              reason: { type: "string", description: "Por qué el cliente necesita un asesor" },
            },
            required: ["reason"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });

  const choice = completion.choices[0]?.message;
  const toolCall = choice?.tool_calls?.[0];

  if (toolCall?.type === "function" && toolCall.function.name === "transfer_to_human") {
    let reason = "El cliente solicitó un asesor";
    try {
      const parsed = JSON.parse(toolCall.function.arguments) as { reason?: string };
      if (parsed.reason?.trim()) reason = parsed.reason.trim();
    } catch {
      // use default reason
    }
    return { reply: null, handoff: true, handoffReason: reason };
  }

  const content = choice?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return { reply: content, handoff: false };
}
