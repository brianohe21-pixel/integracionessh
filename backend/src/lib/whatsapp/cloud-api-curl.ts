const GRAPH_API_VERSION = "v25.0";
const ACCESS_TOKEN_PLACEHOLDER = "<ACCESS_TOKEN>";

export function buildWhatsAppCloudApiTemplateCurl(params: {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  accessToken?: string;
}): string {
  const token = params.accessToken?.trim() || ACCESS_TOKEN_PLACEHOLDER;
  const payload = JSON.stringify(
    {
      messaging_product: "whatsapp",
      to: params.to,
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
