import type { TelephonyCallDirection } from "../../types/index.js";
import { getTelnyxSecrets } from "./secrets.js";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

export interface TelnyxDialParams {
  environment: string;
  tenantId: string;
  to: string;
  from: string;
  clientState?: string;
}

export interface TelnyxDialResult {
  callControlId: string;
  callLegId: string;
  callSessionId: string;
}

export interface TelnyxAnswerParams {
  environment: string;
  tenantId: string;
  callControlId: string;
  streamUrl: string;
  clientState?: string;
}

export type TelnyxStreamParams = TelnyxAnswerParams;

export function isTelnyxCallEndedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('"code":"90018"') ||
    error.message.includes("Call has already ended") ||
    error.message.includes("no longer active")
  );
}

async function telnyxRequest<T>(
  environment: string,
  path: string,
  init: RequestInit,
  tenantId?: string
): Promise<T> {
  const { apiKey } = await getTelnyxSecrets(environment, tenantId);
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
      telnyxStatus: response.status,
      telnyxErrors:
        typeof data === "object" && data && "errors" in data
          ? (data as { errors: unknown }).errors
          : undefined,
    });
  }

  return data as T;
}

function streamPayload(streamUrl: string, clientState?: string) {
  return {
    stream_url: streamUrl,
    stream_track: "inbound_track",
    stream_bidirectional_mode: "rtp",
    stream_bidirectional_codec: "PCMU",
    stream_bidirectional_sampling_rate: 8000,
    ...(clientState ? { client_state: clientState } : {}),
  };
}

export async function dialOutboundCall(params: TelnyxDialParams): Promise<TelnyxDialResult> {
  const { connectionId } = await getTelnyxSecrets(params.environment, params.tenantId);
  const data = await telnyxRequest<{ data: Record<string, string> }>(
    params.environment,
    "/calls",
    {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        to: params.to,
        from: params.from,
        answering_machine_detection: "premium",
        answering_machine_detection_config: {
          total_analysis_time_millis: 5000,
        },
        ...(params.clientState ? { client_state: params.clientState } : {}),
      }),
    },
    params.tenantId
  );

  return {
    callControlId: data.data.call_control_id,
    callLegId: data.data.call_leg_id,
    callSessionId: data.data.call_session_id,
  };
}

export async function answerInboundCall(params: TelnyxAnswerParams): Promise<void> {
  await telnyxRequest(
    params.environment,
    `/calls/${encodeURIComponent(params.callControlId)}/actions/answer`,
    {
      method: "POST",
      body: JSON.stringify(streamPayload(params.streamUrl, params.clientState)),
    },
    params.tenantId
  );
}

export async function startCallStreaming(params: TelnyxStreamParams): Promise<void> {
  await telnyxRequest(
    params.environment,
    `/calls/${encodeURIComponent(params.callControlId)}/actions/streaming_start`,
    {
      method: "POST",
      body: JSON.stringify(streamPayload(params.streamUrl, params.clientState)),
    },
    params.tenantId
  );
}

export async function hangupCall(
  environment: string,
  callControlId: string,
  tenantId?: string
): Promise<void> {
  try {
    await telnyxRequest(
      environment,
      `/calls/${encodeURIComponent(callControlId)}/actions/hangup`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      tenantId
    );
  } catch (error) {
    if (isTelnyxCallEndedError(error)) return;
    throw error;
  }
}

export async function startCallRecording(
  environment: string,
  callControlId: string,
  tenantId: string,
  options?: { playBeep?: boolean }
): Promise<void> {
  try {
    await telnyxRequest(
      environment,
      `/calls/${encodeURIComponent(callControlId)}/actions/record_start`,
      {
        method: "POST",
        body: JSON.stringify({
          format: "mp3",
          channels: "dual",
          play_beep: options?.playBeep ?? false,
        }),
      },
      tenantId
    );
  } catch (error) {
    if (isTelnyxCallEndedError(error)) return;
    throw error;
  }
}

export interface TelnyxDetailRecord {
  id: string;
  cost?: string;
  currency?: string;
  callControlId?: string;
  durationSecs?: number;
}

export function buildTelnyxDetailRecordsPath(callControlId: string): string {
  return `/detail_records?filter[record_type]=call-control&filter[call_control_id]=${encodeURIComponent(callControlId)}&page[size]=10`;
}

export async function searchTelnyxDetailRecords(
  environment: string,
  callControlId: string,
  tenantId: string
): Promise<TelnyxDetailRecord[]> {
  const data = await telnyxRequest<{
    data: Array<{
      id: string;
      cost?: string;
      currency?: string;
      call_control_id?: string;
      duration_secs?: number;
    }>;
  }>(
    environment,
    buildTelnyxDetailRecordsPath(callControlId),
    { method: "GET" },
    tenantId
  );

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
  assignedBotId?: string;
  assignedBotName?: string;
}

export interface TelnyxAvailableNumberCost {
  upfrontCost: string;
  monthlyCost: string;
  currency: string;
}

export interface TelnyxAvailableNumber {
  phoneNumber: string;
  phoneNumberType: string;
  quickship: boolean;
  features: string[];
  regionName?: string;
  cost: TelnyxAvailableNumberCost;
}

export interface TelnyxAvailableNumberSearchFilters {
  countryCode: string;
  phoneNumberType?: "local" | "toll_free" | "mobile" | "national";
  locality?: string;
  nationalDestinationCode?: string;
  limit?: number;
}

export type TelnyxNumberOrderStatus = "pending" | "success" | "failure";

export interface TelnyxNumberOrderPhoneNumber {
  phoneNumber: string;
  status: TelnyxNumberOrderStatus;
}

export interface TelnyxNumberOrder {
  id: string;
  status: TelnyxNumberOrderStatus;
  phoneNumbers: TelnyxNumberOrderPhoneNumber[];
}

async function telnyxRequestWithApiKey<T>(
  apiKey: string,
  path: string,
  init: RequestInit
): Promise<T> {
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
      telnyxStatus: response.status,
      telnyxErrors:
        typeof data === "object" && data && "errors" in data
          ? (data as { errors: unknown }).errors
          : undefined,
    });
  }

  return data as T;
}

export function buildAvailablePhoneNumbersPath(filters: TelnyxAvailableNumberSearchFilters): string {
  const params = new URLSearchParams();
  params.set("filter[country_code]", filters.countryCode);
  params.set("filter[features][]", "voice");
  if (filters.phoneNumberType) {
    params.set("filter[phone_number_type]", filters.phoneNumberType);
  }
  if (filters.locality?.trim()) {
    params.set("filter[locality]", filters.locality.trim());
  }
  if (filters.nationalDestinationCode?.trim()) {
    params.set("filter[national_destination_code]", filters.nationalDestinationCode.trim());
  }
  params.set("page[size]", String(Math.min(filters.limit ?? 20, 50)));
  return `/available_phone_numbers?${params.toString()}`;
}

function mapAvailablePhoneNumber(
  item: {
    phone_number: string;
    phone_number_type?: string;
    quickship?: boolean;
    features?: Array<{ name: string }>;
    region_information?: Array<{ region_type: string; region_name: string }>;
    cost_information?: {
      upfront_cost?: string;
      monthly_cost?: string;
      currency?: string;
    };
  }
): TelnyxAvailableNumber {
  const region = item.region_information?.find((entry) => entry.region_type === "location");
  return {
    phoneNumber: item.phone_number,
    phoneNumberType: item.phone_number_type ?? "local",
    quickship: Boolean(item.quickship),
    features: (item.features ?? []).map((feature) => feature.name).filter(Boolean),
    ...(region?.region_name ? { regionName: region.region_name } : {}),
    cost: {
      upfrontCost: item.cost_information?.upfront_cost ?? "0",
      monthlyCost: item.cost_information?.monthly_cost ?? "0",
      currency: item.cost_information?.currency ?? "USD",
    },
  };
}

export async function searchAvailablePhoneNumbers(
  _environment: string,
  _tenantId: string,
  apiKey: string,
  filters: TelnyxAvailableNumberSearchFilters
): Promise<{ numbers: TelnyxAvailableNumber[]; totalResults: number }> {
  const data = await telnyxRequestWithApiKey<{
    data: Array<{
      phone_number: string;
      phone_number_type?: string;
      quickship?: boolean;
      features?: Array<{ name: string }>;
      region_information?: Array<{ region_type: string; region_name: string }>;
      cost_information?: {
        upfront_cost?: string;
        monthly_cost?: string;
        currency?: string;
      };
    }>;
    meta?: { total_results?: number };
    metadata?: { total_results?: number };
  }>(apiKey, buildAvailablePhoneNumbersPath(filters), { method: "GET" });

  const meta = data.meta ?? data.metadata;
  return {
    numbers: (data.data ?? []).map(mapAvailablePhoneNumber),
    totalResults: meta?.total_results ?? data.data?.length ?? 0,
  };
}

export async function createPhoneNumberOrder(
  _environment: string,
  _tenantId: string,
  apiKey: string,
  params: {
    phoneNumber: string;
    connectionId: string;
    customerReference?: string;
  }
): Promise<TelnyxNumberOrder> {
  const data = await telnyxRequestWithApiKey<{
    data: {
      id: string;
      status: TelnyxNumberOrderStatus;
      phone_numbers?: Array<{ phone_number: string; status: TelnyxNumberOrderStatus }>;
    };
  }>(apiKey, "/number_orders", {
    method: "POST",
    body: JSON.stringify({
      phone_numbers: [{ phone_number: params.phoneNumber }],
      connection_id: params.connectionId,
      ...(params.customerReference ? { customer_reference: params.customerReference } : {}),
    }),
  });

  return {
    id: data.data.id,
    status: data.data.status,
    phoneNumbers: (data.data.phone_numbers ?? []).map((item) => ({
      phoneNumber: item.phone_number,
      status: item.status,
    })),
  };
}

export async function getPhoneNumberOrder(
  _environment: string,
  _tenantId: string,
  apiKey: string,
  orderId: string
): Promise<TelnyxNumberOrder> {
  const data = await telnyxRequestWithApiKey<{
    data: {
      id: string;
      status: TelnyxNumberOrderStatus;
      phone_numbers?: Array<{ phone_number: string; status: TelnyxNumberOrderStatus }>;
    };
  }>(
    apiKey,
    `/number_orders/${encodeURIComponent(orderId)}`,
    { method: "GET" }
  );

  return {
    id: data.data.id,
    status: data.data.status,
    phoneNumbers: (data.data.phone_numbers ?? []).map((item) => ({
      phoneNumber: item.phone_number,
      status: item.status,
    })),
  };
}

export async function listOwnedPhoneNumbers(
  environment: string,
  tenantId: string
): Promise<TelnyxPhoneNumber[]> {
  const data = await telnyxRequest<{
    data: Array<{ id: string; phone_number: string; status: string }>;
  }>(environment, "/phone_numbers?page[size]=100", { method: "GET" }, tenantId);

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

export async function answerCall(params: {
  environment: string;
  tenantId: string;
  callControlId: string;
  clientState?: string;
}): Promise<void> {
  await telnyxRequest(
    params.environment,
    `/calls/${encodeURIComponent(params.callControlId)}/actions/answer`,
    {
      method: "POST",
      body: JSON.stringify(params.clientState ? { client_state: params.clientState } : {}),
    },
    params.tenantId
  );
}

export async function stopCallStreaming(
  environment: string,
  callControlId: string,
  tenantId: string
): Promise<void> {
  try {
    await telnyxRequest(
      environment,
      `/calls/${encodeURIComponent(callControlId)}/actions/streaming_stop`,
      { method: "POST", body: JSON.stringify({}) },
      tenantId
    );
  } catch (error) {
    if (isTelnyxCallEndedError(error)) return;
    throw error;
  }
}

export async function startPlayback(params: {
  environment: string;
  tenantId: string;
  callControlId: string;
  audioUrl: string;
  loop?: boolean;
}): Promise<void> {
  try {
    await telnyxRequest(
      params.environment,
      `/calls/${encodeURIComponent(params.callControlId)}/actions/playback_start`,
      {
        method: "POST",
        body: JSON.stringify({
          audio_url: params.audioUrl,
          loop: params.loop === false ? "1" : "infinity",
        }),
      },
      params.tenantId
    );
  } catch (error) {
    if (isTelnyxCallEndedError(error)) return;
    throw error;
  }
}

export async function stopPlayback(
  environment: string,
  callControlId: string,
  tenantId: string
): Promise<void> {
  try {
    await telnyxRequest(
      environment,
      `/calls/${encodeURIComponent(callControlId)}/actions/playback_stop`,
      { method: "POST", body: JSON.stringify({}) },
      tenantId
    );
  } catch (error) {
    if (isTelnyxCallEndedError(error)) return;
    throw error;
  }
}

export async function speakOnCall(params: {
  environment: string;
  tenantId: string;
  callControlId: string;
  payload: string;
  language?: string;
  voice?: string;
}): Promise<void> {
  try {
    await telnyxRequest(
      params.environment,
      `/calls/${encodeURIComponent(params.callControlId)}/actions/speak`,
      {
        method: "POST",
        body: JSON.stringify({
          payload: params.payload,
          voice: params.voice ?? "female",
          language: params.language ?? "es-ES",
        }),
      },
      params.tenantId
    );
  } catch (error) {
    if (isTelnyxCallEndedError(error)) return;
    throw error;
  }
}

export async function gatherUsingSpeak(params: {
  environment: string;
  tenantId: string;
  callControlId: string;
  payload: string;
  validDigits?: string;
  timeoutMillis?: number;
  language?: string;
  voice?: string;
  minimumDigits?: number;
  maximumDigits?: number;
}): Promise<void> {
  await telnyxRequest(
    params.environment,
    `/calls/${encodeURIComponent(params.callControlId)}/actions/gather_using_speak`,
    {
      method: "POST",
      body: JSON.stringify({
        payload: params.payload,
        voice: params.voice ?? "female",
        language: params.language ?? "es-ES",
        minimum_digits: params.minimumDigits ?? 1,
        maximum_digits: params.maximumDigits ?? 1,
        timeout_millis: params.timeoutMillis ?? 8000,
        valid_digits: params.validDigits ?? "1234567890*#",
      }),
    },
    params.tenantId
  );
}

export async function createConference(params: {
  environment: string;
  tenantId: string;
  callControlId: string;
  name: string;
}): Promise<{ conferenceId: string }> {
  const data = await telnyxRequest<{ data: { id: string } }>(
    params.environment,
    "/conferences",
    {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        call_control_id: params.callControlId,
        beep_enabled: "never",
      }),
    },
    params.tenantId
  );
  return { conferenceId: data.data.id };
}

export async function joinConference(params: {
  environment: string;
  tenantId: string;
  conferenceId: string;
  callControlId: string;
  supervisorRole?: "none" | "barge" | "whisper" | "monitor";
}): Promise<void> {
  await telnyxRequest(
    params.environment,
    `/conferences/${encodeURIComponent(params.conferenceId)}/actions/join`,
    {
      method: "POST",
      body: JSON.stringify({
        call_control_id: params.callControlId,
        supervisor_role: params.supervisorRole ?? "none",
      }),
    },
    params.tenantId
  );
}

export async function leaveConference(params: {
  environment: string;
  tenantId: string;
  conferenceId: string;
  callControlId: string;
}): Promise<void> {
  try {
    await telnyxRequest(
      params.environment,
      `/conferences/${encodeURIComponent(params.conferenceId)}/actions/leave`,
      {
        method: "POST",
        body: JSON.stringify({ call_control_id: params.callControlId }),
      },
      params.tenantId
    );
  } catch (error) {
    if (isTelnyxCallEndedError(error)) return;
    throw error;
  }
}

export async function holdConferenceParticipant(params: {
  environment: string;
  tenantId: string;
  conferenceId: string;
  callControlId: string;
}): Promise<void> {
  await telnyxRequest(
    params.environment,
    `/conferences/${encodeURIComponent(params.conferenceId)}/actions/hold`,
    {
      method: "POST",
      body: JSON.stringify({ call_control_ids: [params.callControlId] }),
    },
    params.tenantId
  );
}

export async function unholdConferenceParticipant(params: {
  environment: string;
  tenantId: string;
  conferenceId: string;
  callControlId: string;
}): Promise<void> {
  await telnyxRequest(
    params.environment,
    `/conferences/${encodeURIComponent(params.conferenceId)}/actions/unhold`,
    {
      method: "POST",
      body: JSON.stringify({ call_control_ids: [params.callControlId] }),
    },
    params.tenantId
  );
}

export async function dialCall(params: {
  environment: string;
  tenantId: string;
  to: string;
  from: string;
  connectionId?: string;
  clientState?: string;
  answeringMachineDetection?: "disabled" | "premium";
  timeoutSecs?: number;
}): Promise<TelnyxDialResult> {
  const { connectionId } = params.connectionId
    ? { connectionId: params.connectionId }
    : await getTelnyxSecrets(params.environment, params.tenantId);
  const data = await telnyxRequest<{ data: Record<string, string> }>(
    params.environment,
    "/calls",
    {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        to: params.to,
        from: params.from,
        timeout_secs: params.timeoutSecs ?? 30,
        ...(params.answeringMachineDetection && params.answeringMachineDetection !== "disabled"
          ? {
              answering_machine_detection: params.answeringMachineDetection,
              answering_machine_detection_config: { total_analysis_time_millis: 5000 },
            }
          : {}),
        ...(params.clientState ? { client_state: params.clientState } : {}),
      }),
    },
    params.tenantId
  );

  return {
    callControlId: data.data.call_control_id,
    callLegId: data.data.call_leg_id,
    callSessionId: data.data.call_session_id,
  };
}

export async function transferCall(params: {
  environment: string;
  tenantId: string;
  callControlId: string;
  to: string;
}): Promise<void> {
  await telnyxRequest(
    params.environment,
    `/calls/${encodeURIComponent(params.callControlId)}/actions/transfer`,
    {
      method: "POST",
      body: JSON.stringify({ to: params.to }),
    },
    params.tenantId
  );
}
