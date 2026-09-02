const GRAPH_API_VERSION = "v25.0";
export const WHATSAPP_CLOUD_API_TOKEN_PLACEHOLDER = "<ACCESS_TOKEN>";

export function normalizeWhatsAppRecipientPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function buildWhatsAppCloudApiTemplateCurl(params: {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  accessToken?: string;
}): string {
  const to = normalizeWhatsAppRecipientPhone(params.to);
  const token = params.accessToken?.trim() || WHATSAPP_CLOUD_API_TOKEN_PLACEHOLDER;
  const payload = JSON.stringify(
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: params.templateName,
        language: { code: params.language },
      },
    },
    null,
    2
  );

  return [
    `curl -i -X POST "https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}/messages" \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${payload.replace(/'/g, "'\\''")}'`,
  ].join("\n");
}

export interface ParsedWhatsAppCloudApiCurl {
  phoneNumberId?: string;
  to?: string;
  templateName?: string;
  language?: string;
}

function extractCurlJsonBody(curl: string): string | null {
  const flagMatch = curl.match(/(?:-d|--data(?:-raw)?)\s+(['"`])([\s\S]*?)\1/m);
  if (flagMatch?.[2]) return flagMatch[2].replace(/\\'/g, "'").trim();

  const bareMatch = curl.match(/(?:-d|--data(?:-raw)?)\s+(\{[\s\S]*\})/m);
  return bareMatch?.[1]?.trim() ?? null;
}

export function parseWhatsAppCloudApiTemplateCurl(curl: string): ParsedWhatsAppCloudApiCurl {
  const result: ParsedWhatsAppCloudApiCurl = {};

  const phoneMatch = curl.match(/graph\.facebook\.com\/v[\d.]+\/(\d+)\/messages/i);
  if (phoneMatch?.[1]) result.phoneNumberId = phoneMatch[1];

  const jsonBody = extractCurlJsonBody(curl);
  if (!jsonBody) return result;

  try {
    const payload = JSON.parse(jsonBody) as {
      to?: string;
      template?: { name?: string; language?: { code?: string } };
    };
    if (payload.to) result.to = normalizeWhatsAppRecipientPhone(payload.to);
    if (payload.template?.name) result.templateName = payload.template.name;
    if (payload.template?.language?.code) result.language = payload.template.language.code;
  } catch {
    return result;
  }

  return result;
}
