const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

function throwGraphApiError(status: number, body: string): never {
  const err = new Error(`WhatsApp Flows API error ${status}: ${body}`) as Error & {
    statusCode?: number;
  };
  err.statusCode = 502;
  throw err;
}

export interface MetaFlowSummary {
  id: string;
  name: string;
  status: string;
  categories?: string[];
}

export async function listMetaFlows(
  wabaId: string,
  accessToken: string
): Promise<MetaFlowSummary[]> {
  const response = await fetch(`${GRAPH_API_URL}/${wabaId}/flows`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throwGraphApiError(response.status, await response.text());
  const data = (await response.json()) as { data?: MetaFlowSummary[] };
  return data.data ?? [];
}

export async function getMetaFlow(
  flowId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetch(`${GRAPH_API_URL}/${flowId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throwGraphApiError(response.status, await response.text());
  return response.json() as Promise<Record<string, unknown>>;
}

export async function createMetaFlow(
  wabaId: string,
  name: string,
  categories: string[],
  accessToken: string
): Promise<{ id: string }> {
  const response = await fetch(`${GRAPH_API_URL}/${wabaId}/flows`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      categories,
    }),
  });
  if (!response.ok) throwGraphApiError(response.status, await response.text());
  return response.json() as Promise<{ id: string }>;
}

export async function uploadFlowJson(
  flowId: string,
  jsonDefinition: Record<string, unknown>,
  accessToken: string
): Promise<void> {
  const formData = new FormData();
  const blob = new Blob([JSON.stringify(jsonDefinition)], { type: "application/json" });
  formData.append("file", blob, "flow.json");
  formData.append("name", "flow.json");
  formData.append("asset_type", "FLOW_JSON");

  const response = await fetch(`${GRAPH_API_URL}/${flowId}/assets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!response.ok) throwGraphApiError(response.status, await response.text());
}

export async function publishMetaFlow(flowId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${GRAPH_API_URL}/${flowId}/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throwGraphApiError(response.status, await response.text());
}

export async function deprecateMetaFlow(flowId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${GRAPH_API_URL}/${flowId}/deprecate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throwGraphApiError(response.status, await response.text());
}

export interface SendFlowMessageOptions {
  phoneNumberId: string;
  to: string;
  accessToken: string;
  flowId: string;
  flowCta: string;
  flowToken: string;
  flowAction?: "navigate";
  screenId?: string;
  replyToMessageId?: string;
}

export async function sendFlowMessage(options: SendFlowMessageOptions): Promise<{ messages: Array<{ id: string }> }> {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: options.to,
    type: "interactive",
    interactive: {
      type: "flow",
      body: { text: options.flowCta },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: options.flowToken,
          flow_id: options.flowId,
          flow_cta: options.flowCta,
          flow_action: options.flowAction ?? "navigate",
          ...(options.screenId ? { flow_action_payload: { screen: options.screenId } } : {}),
        },
      },
    },
  };

  if (options.replyToMessageId) {
    body.context = { message_id: options.replyToMessageId };
  }

  const response = await fetch(`${GRAPH_API_URL}/${options.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throwGraphApiError(response.status, await response.text());
  return response.json() as Promise<{ messages: Array<{ id: string }> }>;
}

export interface SendInteractiveButtonsOptions {
  phoneNumberId: string;
  to: string;
  accessToken: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
  replyToMessageId?: string;
}

export async function sendInteractiveButtons(
  options: SendInteractiveButtonsOptions
): Promise<{ messages: Array<{ id: string }> }> {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: options.to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: options.bodyText.slice(0, 1024) },
      action: {
        buttons: options.buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };

  if (options.replyToMessageId) {
    body.context = { message_id: options.replyToMessageId };
  }

  const response = await fetch(`${GRAPH_API_URL}/${options.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throwGraphApiError(response.status, await response.text());
  return response.json() as Promise<{ messages: Array<{ id: string }> }>;
}
