import { createHmac } from "crypto";
import type { TemplateComponent } from "../../types/index.js";

const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

export const WHATSAPP_MAX_TEXT_BODY_LENGTH = 1024;

export function truncateWhatsAppText(text: string): string {
  if (text.length <= WHATSAPP_MAX_TEXT_BODY_LENGTH) return text;
  return text.slice(0, WHATSAPP_MAX_TEXT_BODY_LENGTH);
}

const GRAPH_API_CLIENT_ERROR_CODES = new Set([
  100,
  132000,
  132001,
  138006,
  138017,
]);

export function throwGraphApiError(status: number, body: string): never {
  try {
    const parsed = JSON.parse(body) as {
      error?: {
        code?: number;
        error_subcode?: number;
        error_user_msg?: string;
        message?: string;
        is_transient?: boolean;
      };
    };
    const graphError = parsed.error;
    if (!graphError) throw new SyntaxError();

    const message =
      graphError.error_user_msg ??
      graphError.message ??
      "WhatsApp API request failed";

    if (graphError.error_subcode === 2388003) {
      const err = new Error(
        graphError.error_user_msg ??
          "Message templates can only be edited when Meta has rejected them."
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    if (graphError.code !== undefined && GRAPH_API_CLIENT_ERROR_CODES.has(graphError.code)) {
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    if (graphError.code === 190 || status === 401) {
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }

    if (graphError.is_transient || graphError.code === 2) {
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = 502;
      throw err;
    }
  } catch (e) {
    if ((e as Error & { statusCode?: number }).statusCode) throw e;
  }

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
  data: Array<Record<string, unknown>>;
  paging?: { cursors: { before: string; after: string }; next?: string };
}

function normalizeTemplateLanguage(language: unknown): string {
  if (typeof language === "string" && language.trim()) return language.trim();
  if (language && typeof language === "object" && "code" in language) {
    const code = (language as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  return "en";
}

function normalizeTemplateCategory(category: unknown): MetaTemplate["category"] {
  const value = String(category ?? "UTILITY").toUpperCase();
  if (value === "MARKETING" || value === "AUTHENTICATION" || value === "UTILITY") {
    return value;
  }
  return "UTILITY";
}

function normalizeTemplateStatus(status: unknown): MetaTemplate["status"] {
  const value = String(status ?? "PENDING").toUpperCase();
  if (value === "APPROVED" || value === "REJECTED" || value === "PENDING") {
    return value;
  }
  return "PENDING";
}

export function normalizeMetaTemplate(raw: Record<string, unknown>): MetaTemplate {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    language: normalizeTemplateLanguage(raw.language),
    category: normalizeTemplateCategory(raw.category),
    status: normalizeTemplateStatus(raw.status),
    components: Array.isArray(raw.components) ? (raw.components as TemplateComponent[]) : [],
  };
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
  const { phoneNumberId, to, accessToken, replyToMessageId } = options;
  const text = truncateWhatsAppText(options.text);

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

export {
  getWhatsAppAccessToken,
  getWhatsAppSecrets,
} from "./secrets.js";

function enrichGraphApiError(status: number, body: string, wabId: string): never {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: number } };
    const msg = parsed.error?.message ?? "";
    const code = parsed.error?.code;

    if (code === 100 && msg.includes("message_templates")) {
      const enriched = new Error(
        `WhatsApp API error ${status}: The access token lacks the "whatsapp_business_management" permission, ` +
        `or the app is not associated with WABA ${wabId}. ` +
        `Generate a permanent System User token with both "whatsapp_business_messaging" and "whatsapp_business_management" scopes.`
      ) as Error & { statusCode?: number };
      enriched.statusCode = 502;
      throw enriched;
    }
  } catch (e) {
    if ((e as Error & { statusCode?: number }).statusCode) throw e;
  }
  throwGraphApiError(status, body);
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
      enrichGraphApiError(response.status, error, wabId);
    }

    const json = (await response.json()) as MetaTemplatesResponse;
    for (const item of json.data ?? []) {
      if (item?.name) {
        templates.push(normalizeMetaTemplate(item));
      }
    }
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

export type WhatsAppQualityRating = "GREEN" | "YELLOW" | "RED" | "NA";

export interface WhatsAppPhoneInfo {
  qualityRating: WhatsAppQualityRating;
  status: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  messagingLimit?: string;
}

export async function getPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string
): Promise<WhatsAppPhoneInfo> {
  const fields = [
    "quality_rating",
    "status",
    "display_phone_number",
    "verified_name",
    "whatsapp_business_manager_messaging_limit",
  ].join(",");

  const response = await fetch(
    `${GRAPH_API_URL}/${phoneNumberId}?fields=${fields}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const error = await response.text();
    throwGraphApiError(response.status, error);
  }

  const json = (await response.json()) as {
    quality_rating?: WhatsAppQualityRating;
    status?: string;
    display_phone_number?: string;
    verified_name?: string;
    whatsapp_business_manager_messaging_limit?: string;
  };

  return {
    qualityRating: json.quality_rating ?? "NA",
    status: json.status ?? "UNKNOWN",
    ...(json.display_phone_number
      ? { displayPhoneNumber: json.display_phone_number }
      : {}),
    ...(json.verified_name ? { verifiedName: json.verified_name } : {}),
    ...(json.whatsapp_business_manager_messaging_limit
      ? { messagingLimit: json.whatsapp_business_manager_messaging_limit }
      : {}),
  };
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
