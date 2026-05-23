import { createHmac } from "crypto";
import type { TemplateComponent } from "../../types/index.js";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

function throwGraphApiError(status: number, body: string): never {
  const err = new Error(`WhatsApp API error ${status}: ${body}`) as Error & { statusCode?: number };
  err.statusCode = 502;
  throw err;
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "APPROVED" | "PENDING" | "REJECTED";
  components: TemplateComponent[];
}

export interface MetaTemplatesResponse {
  data: MetaTemplate[];
  paging?: { cursors: { before: string; after: string }; next?: string };
}

export interface CreateTemplatePayload {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: TemplateComponent[];
}

export interface SendTemplateOptions {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  components?: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string; image?: { link: string } }>;
  }>;
  accessToken: string;
}

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
    throwGraphApiError(response.status, error);
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

export async function listMetaTemplates(
  wabId: string,
  accessToken: string
): Promise<MetaTemplate[]> {
  const templates: MetaTemplate[] = [];
  let url: string | null = `${GRAPH_API_URL}/${wabId}/message_templates?limit=100`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throwGraphApiError(response.status, error);
    }

    const json = (await response.json()) as MetaTemplatesResponse;
    templates.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }

  return templates;
}

export async function createMetaTemplate(
  wabId: string,
  accessToken: string,
  payload: CreateTemplatePayload
): Promise<{ id: string; status: string }> {
  const response = await fetch(
    `${GRAPH_API_URL}/${wabId}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throwGraphApiError(response.status, error);
  }

  return response.json() as Promise<{ id: string; status: string }>;
}

export async function editMetaTemplate(
  metaTemplateId: string,
  accessToken: string,
  payload: { components: TemplateComponent[] }
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${GRAPH_API_URL}/${metaTemplateId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throwGraphApiError(response.status, error);
  }

  return response.json() as Promise<{ success: boolean }>;
}

export async function deleteMetaTemplate(
  wabId: string,
  name: string,
  accessToken: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${GRAPH_API_URL}/${wabId}/message_templates?name=${encodeURIComponent(name)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throwGraphApiError(response.status, error);
  }

  return response.json() as Promise<{ success: boolean }>;
}

export async function sendTemplateMessage(
  options: SendTemplateOptions
): Promise<SendTextMessageResponse> {
  const { phoneNumberId, to, templateName, language, components, accessToken } = options;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(components?.length ? { components } : {}),
    },
  };

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
    throwGraphApiError(response.status, error);
  }

  return response.json() as Promise<SendTextMessageResponse>;
}
