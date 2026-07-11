import { throwGraphApiError } from "../whatsapp/client.js";

const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

export interface SendCommerceMessageOptions {
  phoneNumberId: string;
  to: string;
  accessToken: string;
}

export async function sendCatalogMessage(
  options: SendCommerceMessageOptions & {
    bodyText: string;
    catalogId: string;
    thumbnailProductRetailerId: string;
    footerText?: string;
  }
): Promise<{ messageId: string }> {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: options.to,
    type: "interactive",
    interactive: {
      type: "catalog_message",
      body: { text: options.bodyText },
      action: {
        name: "catalog_message",
        parameters: {
          thumbnail_product_retailer_id: options.thumbnailProductRetailerId,
        },
      },
      ...(options.footerText ? { footer: { text: options.footerText } } : {}),
    },
  };

  const response = await fetch(`${GRAPH_API_URL}/${options.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throwGraphApiError(response.status, text);
  }

  const json = (await response.json()) as { messages?: Array<{ id: string }> };
  return { messageId: json.messages?.[0]?.id ?? "" };
}

export async function sendSingleProductMessage(
  options: SendCommerceMessageOptions & {
    bodyText: string;
    catalogId: string;
    productRetailerId: string;
    footerText?: string;
  }
): Promise<{ messageId: string }> {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: options.to,
    type: "interactive",
    interactive: {
      type: "product",
      body: { text: options.bodyText },
      action: {
        catalog_id: options.catalogId,
        product_retailer_id: options.productRetailerId,
      },
      ...(options.footerText ? { footer: { text: options.footerText } } : {}),
    },
  };

  const response = await fetch(`${GRAPH_API_URL}/${options.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throwGraphApiError(response.status, text);
  }

  const json = (await response.json()) as { messages?: Array<{ id: string }> };
  return { messageId: json.messages?.[0]?.id ?? "" };
}

export async function sendMultiProductMessage(
  options: SendCommerceMessageOptions & {
    headerText: string;
    bodyText: string;
    catalogId: string;
    sectionTitle: string;
    productRetailerIds: string[];
    footerText?: string;
  }
): Promise<{ messageId: string }> {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: options.to,
    type: "interactive",
    interactive: {
      type: "product_list",
      header: { type: "text", text: options.headerText },
      body: { text: options.bodyText },
      action: {
        catalog_id: options.catalogId,
        sections: [
          {
            title: options.sectionTitle,
            product_items: options.productRetailerIds.map((id) => ({
              product_retailer_id: id,
            })),
          },
        ],
      },
      ...(options.footerText ? { footer: { text: options.footerText } } : {}),
    },
  };

  const response = await fetch(`${GRAPH_API_URL}/${options.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throwGraphApiError(response.status, text);
  }

  const json = (await response.json()) as { messages?: Array<{ id: string }> };
  return { messageId: json.messages?.[0]?.id ?? "" };
}
