import { createHmac } from "crypto";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

export interface SendTextMessageOptions {
  phoneNumberId: string;
  to: string;
  text: string;
  accessToken: string;
  replyToMessageId?: string;
}

export interface SendTextMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export async function sendTextMessage(
  options: SendTextMessageOptions
): Promise<SendTextMessageResponse> {
  const { phoneNumberId, to, text, accessToken, replyToMessageId } = options;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text },
  };

  if (replyToMessageId) {
    body.context = { message_id: replyToMessageId };
  }

  const response = await fetch(
    `${GRAPH_API_URL}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error ${response.status}: ${error}`);
  }

  return response.json() as Promise<SendTextMessageResponse>;
}

export async function markMessageAsRead(
  phoneNumberId: string,
  messageId: string,
  accessToken: string
): Promise<void> {
  await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

export function validateWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  const expectedSignature = createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  const receivedSignature = signature.replace("sha256=", "");

  if (expectedSignature.length !== receivedSignature.length) return false;

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(receivedSignature, "hex");

  return expectedBuffer.every((byte, i) => byte === receivedBuffer[i]);
}

export async function getWhatsAppAccessToken(
  tenantId: string,
  environment: string
): Promise<string> {
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    "@aws-sdk/client-secrets-manager"
  );

  const client = new SecretsManagerClient({});
  const command = new GetSecretValueCommand({
    SecretId: `/${environment}/tenants/${tenantId}/whatsapp`,
  });

  const response = await client.send(command);
  const secret = JSON.parse(response.SecretString ?? "{}") as {
    accessToken: string;
    appSecret: string;
  };

  return secret.accessToken;
}

export async function getWhatsAppSecrets(
  tenantId: string,
  environment: string
): Promise<{ accessToken: string; appSecret: string }> {
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    "@aws-sdk/client-secrets-manager"
  );

  const client = new SecretsManagerClient({});
  const command = new GetSecretValueCommand({
    SecretId: `/${environment}/tenants/${tenantId}/whatsapp`,
  });

  const response = await client.send(command);
  return JSON.parse(response.SecretString ?? "{}") as {
    accessToken: string;
    appSecret: string;
  };
}
