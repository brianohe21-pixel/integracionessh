export interface StartRealtimeCallResult {
  sdpAnswer: string;
  callId: string;
  ephemeralKey?: string;
}

function extractCallId(locationHeader: string | null): string | null {
  if (!locationHeader) return null;
  const trimmed = locationHeader.trim();
  const fromPath = trimmed.split("/").pop();
  if (fromPath?.startsWith("rtc_")) return fromPath;
  return trimmed.startsWith("rtc_") ? trimmed : null;
}

export async function startRealtimeCall(params: {
  apiKey: string;
  sdpOffer: string;
  sessionConfig: Record<string, unknown>;
}): Promise<StartRealtimeCallResult> {
  const form = new FormData();
  form.set("sdp", params.sdpOffer);
  form.set("session", JSON.stringify(params.sessionConfig));

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI realtime call failed (${response.status}): ${errorText}`);
  }

  const sdpAnswer = await response.text();
  const callId = extractCallId(response.headers.get("Location"));
  if (!callId) {
    throw new Error("OpenAI realtime call missing call id in Location header");
  }

  const ephemeralKey = response.headers.get("OpenAI-Ephemeral-Key") ?? undefined;

  return {
    sdpAnswer,
    callId,
    ...(ephemeralKey ? { ephemeralKey } : {}),
  };
}
