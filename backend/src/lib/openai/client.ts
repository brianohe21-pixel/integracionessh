import OpenAI from "openai";
import type { Bot, Message } from "../../types/index.js";

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

export async function generateChatResponse(
  bot: Bot,
  conversationHistory: Message[],
  userMessage: string,
  apiKey: string
): Promise<string> {
  const client = getOpenAIClient(apiKey);

  const systemPrompt = bot.systemPrompt ?? "";
  const model = bot.model ?? "gpt-4o";
  const temperature = bot.temperature ?? 0.7;
  const maxTokens = bot.maxTokens ?? 1024;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-20).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return content;
}
