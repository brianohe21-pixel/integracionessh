import type { TelephonyCallDirection } from "../../types/index.js";
import { getTelnyxSecrets } from "./secrets.js";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

export interface TelnyxDialParams {
  environment: string;
  to: string;
  from: string;
  streamUrl: string;
  clientState?: string;
}

export interface TelnyxDialResult {
  callControlId: string;
  callLegId: string;
  callSessionId: string;
}

export interface TelnyxAnswerParams {
  environment: string;
  callControlId: string;
  streamUrl: string;
  clientState?: string;
}

async function telnyxRequest<T>(
  environment: string,
  path: string,
  init: RequestInit
): Promise<T> {
  const { apiKey } = await getTelnyxSecrets(environment);
  const response = await fetch(`${TELNYX_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" && data && "errors" in data
        ? JSON.stringify((data as { errors: unknown }).errors)
        : text;
    throw Object.assign(new Error(`Telnyx API error (${response.status}): ${detail}`), {
      statusCode: response.status >= 500 ? 502 : 400,
    });
  }

  return data as T;
}

function streamPayload(streamUrl: string, clientState?: string) {
  return {
    stream_url: streamUrl,
    stream_track: "both_tracks",
    stream_bidirectional_mode: "rtp",
    stream_bidirectional_codec: "PCMU",
    ...(clientState ? { client_state: clientState } : {}),
  };
}

export async function dialOutboundCall(params: TelnyxDialParams): Promise<TelnyxDialResult> {
  const { connectionId } = await getTelnyxSecrets(params.environment);
  const data = await telnyxRequest<{ data: Record<string, string> }>(params.environment, "/calls", {
    method: "POST",
    body: JSON.stringify({
      connection_id: connectionId,
      to: params.to,
      from: params.from,
      ...streamPayload(params.streamUrl, params.clientState),
    }),
  });

  return {
    callControlId: data.data.call_control_id,
    callLegId: data.data.call_leg_id,
    callSessionId: data.data.call_session_id,
  };
}

export async function answerInboundCall(params: TelnyxAnswerParams): Promise<void> {
  await telnyxRequest(params.environment, `/calls/${encodeURIComponent(params.callControlId)}/actions/answer`, {
    method: "POST",
    body: JSON.stringify(streamPayload(params.streamUrl, params.clientState)),
  });
}

export async function hangupCall(environment: string, callControlId: string): Promise<void> {
  await telnyxRequest(environment, `/calls/${encodeURIComponent(callControlId)}/actions/hangup`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function startCallRecording(
  environment: string,
  callControlId: string
): Promise<void> {
  await telnyxRequest(
    environment,
    `/calls/${encodeURIComponent(callControlId)}/actions/record_start`,
    {
      method: "POST",
      body: JSON.stringify({
        format: "mp3",
        channels: "dual",
        play_beep: false,
      }),
    }
  );
}

export interface TelnyxDetailRecord {
  id: string;
  cost?: string;
  currency?: string;
  callControlId?: string;
  durationSecs?: number;
}

export async function searchTelnyxDetailRecords(
  environment: string,
  callControlId: string
): Promise<TelnyxDetailRecord[]> {
  const data = await telnyxRequest<{
    data: Array<{
      id: string;
      cost?: string;
      currency?: string;
      call_control_id?: string;
      duration_secs?: number;
    }>;
  }>(environment, "/detail_records?filter[record_type]=call-control&page[size]=10", {
    method: "GET",
  });

  return (data.data ?? [])
    .filter((item) => item.call_control_id === callControlId)
    .map((item) => ({
      id: item.id,
      ...(item.cost ? { cost: item.cost } : {}),
      ...(item.currency ? { currency: item.currency } : {}),
      ...(item.call_control_id ? { callControlId: item.call_control_id } : {}),
      ...(item.duration_secs !== undefined ? { durationSecs: item.duration_secs } : {}),
    }));
}

export interface TelnyxPhoneNumber {
  id: string;
  phoneNumber: string;
  status: string;
}

export async function listOwnedPhoneNumbers(environment: string): Promise<TelnyxPhoneNumber[]> {
  const data = await telnyxRequest<{
    data: Array<{ id: string; phone_number: string; status: string }>;
  }>(environment, "/phone_numbers?page[size]=100", { method: "GET" });

  return (data.data ?? []).map((item) => ({
    id: item.id,
    phoneNumber: item.phone_number,
    status: item.status,
  }));
}

export function directionToWhatsApp(
  direction: TelephonyCallDirection
): "USER_INITIATED" | "BUSINESS_INITIATED" {
  return direction === "inbound" ? "USER_INITIATED" : "BUSINESS_INITIATED";
}
