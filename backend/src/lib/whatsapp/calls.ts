import { throwGraphApiError } from "./client.js";
import type { WhatsAppCallSession } from "../../types/index.js";

const GRAPH_API_URL = "https://graph.facebook.com/v25.0";

export interface InitiateCallOptions {
  phoneNumberId: string;
  to: string;
  session: WhatsAppCallSession;
  accessToken: string;
  bizOpaqueCallbackData?: string;
}

export interface CallActionOptions {
  phoneNumberId: string;
  callId: string;
  action: "pre_accept" | "accept" | "reject" | "terminate";
  accessToken: string;
  session?: WhatsAppCallSession;
}

export interface InitiateCallResponse {
  messaging_product: string;
  calls: Array<{ id: string }>;
}

export interface CallActionResponse {
  success: boolean;
}

export interface WhatsAppCallingSettings {
  calling?: {
    status?: "ENABLED" | "DISABLED";
    call_icon_visibility?: string;
    callback_permission_status?: string;
    call_hours?: Record<string, unknown>;
    sip?: Record<string, unknown>;
  };
}

export async function initiateCall(
  options: InitiateCallOptions
): Promise<InitiateCallResponse> {
  const { phoneNumberId, to, session, accessToken, bizOpaqueCallbackData } = options;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    action: "connect",
    session,
  };

  if (bizOpaqueCallbackData) {
    body.biz_opaque_callback_data = bizOpaqueCallbackData;
  }

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throwGraphApiError(response.status, await response.text());
  }

  return response.json() as Promise<InitiateCallResponse>;
}

export async function performCallAction(
  options: CallActionOptions
): Promise<CallActionResponse> {
  const { phoneNumberId, callId, action, accessToken, session } = options;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    call_id: callId,
    action,
  };

  if (session) {
    body.session = session;
  }

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throwGraphApiError(response.status, await response.text());
  }

  return response.json() as Promise<CallActionResponse>;
}

export async function getCallSettings(
  phoneNumberId: string,
  accessToken: string
): Promise<WhatsAppCallingSettings> {
  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/settings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throwGraphApiError(response.status, await response.text());
  }

  return response.json() as Promise<WhatsAppCallingSettings>;
}

export async function updateCallSettings(
  phoneNumberId: string,
  accessToken: string,
  settings: WhatsAppCallingSettings
): Promise<WhatsAppCallingSettings> {
  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/settings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throwGraphApiError(response.status, await response.text());
  }

  return response.json() as Promise<WhatsAppCallingSettings>;
}

export async function sendCallPermissionRequest(options: {
  phoneNumberId: string;
  to: string;
  accessToken: string;
  bodyText?: string;
}): Promise<{ messages: Array<{ id: string }> }> {
  const response = await fetch(`${GRAPH_API_URL}/${options.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to,
      type: "interactive",
      interactive: {
        type: "call_permission_request",
        body: {
          text: options.bodyText ?? "Would you like to receive a call from us on WhatsApp?",
        },
      },
    }),
  });

  if (!response.ok) {
    throwGraphApiError(response.status, await response.text());
  }

  return response.json() as Promise<{ messages: Array<{ id: string }> }>;
}

export async function getCallPermissionStatus(
  phoneNumberId: string,
  userWaId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ user_wa_id: userWaId });
  const response = await fetch(
    `${GRAPH_API_URL}/${phoneNumberId}/call_permissions?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throwGraphApiError(response.status, await response.text());
  }

  return response.json() as Promise<Record<string, unknown>>;
}
