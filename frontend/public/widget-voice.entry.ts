type StartParams = {
  apiUrl: string;
  botId: string;
  widgetKey: string;
  visitorName?: string;
  onStatus?: (status: string) => void;
};

type ActiveSession = {
  sessionId: string;
  widgetKey: string;
  apiUrl: string;
  startedAt: number;
  pc: RTCPeerConnection;
  remoteAudio: HTMLAudioElement;
  localStream: MediaStream;
  onStatus?: (status: string) => void;
};

let active: ActiveSession | null = null;

function apiBase(apiUrl: string): string {
  return apiUrl.replace(/\/$/, "");
}

async function createSession(params: StartParams, sdpOffer: string) {
  const res = await fetch(`${apiBase(params.apiUrl)}/voicebot/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": params.widgetKey,
    },
    body: JSON.stringify({
      botId: params.botId,
      sdpOffer,
      ...(params.visitorName ? { visitorName: params.visitorName } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to start voicebot session");
  }
  return res.json() as Promise<{
    sessionId: string;
    sdpAnswer: string;
    conversationId: string;
  }>;
}

async function endSession(apiUrl: string, widgetKey: string, sessionId: string, durationSeconds: number) {
  await fetch(`${apiBase(apiUrl)}/voicebot/sessions/${encodeURIComponent(sessionId)}/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": widgetKey,
    },
    body: JSON.stringify({ durationSeconds }),
  });
}

function cleanupSession(current: ActiveSession): number {
  current.localStream.getTracks().forEach((track) => track.stop());
  current.pc.close();
  current.remoteAudio.remove();
  return Math.max(1, Math.ceil((Date.now() - current.startedAt) / 1000));
}

export async function startVoicebot(params: StartParams): Promise<void> {
  if (active) {
    await stopVoicebot();
  }

  params.onStatus?.("connecting");

  const pc = new RTCPeerConnection();
  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");
  document.body.appendChild(remoteAudio);

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) remoteAudio.srcObject = stream;
  };

  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const session = await createSession(params, offer.sdp ?? "");
  await pc.setRemoteDescription({ type: "answer", sdp: session.sdpAnswer });

  active = {
    sessionId: session.sessionId,
    widgetKey: params.widgetKey,
    apiUrl: params.apiUrl,
    startedAt: Date.now(),
    pc,
    remoteAudio,
    localStream,
    onStatus: params.onStatus,
  };

  params.onStatus?.("in_call");

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      void stopVoicebot();
    }
  };
}

export async function stopVoicebot(): Promise<void> {
  const current = active;
  if (!current) return;
  active = null;
  const durationSeconds = cleanupSession(current);
  current.onStatus?.("ended");
  await endSession(current.apiUrl, current.widgetKey, current.sessionId, durationSeconds);
}

declare global {
  interface Window {
    VoicebotWidget?: {
      start: (params: StartParams) => Promise<void>;
      stop: () => Promise<void>;
    };
  }
}

if (typeof window !== "undefined") {
  window.VoicebotWidget = {
    start: startVoicebot,
    stop: stopVoicebot,
  };
}
