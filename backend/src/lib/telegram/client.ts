const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramTextMessage(params: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<{ messageId: string }> {
  const response = await fetch(
    `${TELEGRAM_API}/bot${params.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.text,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram send failed: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    result?: { message_id?: number };
  };
  return { messageId: String(data.result?.message_id ?? Date.now()) };
}

export async function setTelegramWebhook(params: {
  botToken: string;
  webhookUrl: string;
  secretToken: string;
}): Promise<void> {
  const response = await fetch(
    `${TELEGRAM_API}/bot${params.botToken}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: params.webhookUrl,
        secret_token: params.secretToken,
        allowed_updates: ["message"],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram setWebhook failed: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(data.description ?? "Telegram setWebhook failed");
  }
}

export async function getTelegramBotInfo(botToken: string): Promise<{ username?: string }> {
  const response = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram getMe failed: ${response.status} ${err}`);
  }
  const data = (await response.json()) as {
    ok: boolean;
    result?: { username?: string };
  };
  return data.result?.username ? { username: data.result.username } : {};
}
