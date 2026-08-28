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

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function getVisitorId(): string {
  const key = "wb_visitor_id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return randomId();
  }
}

function getSessionId(): string {
  const key = "wb_session_id";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = randomId();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return randomId();
  }
}

function trackPageview(params: { apiUrl: string; widgetKey: string }): void {
  void fetch(`${apiBase(params.apiUrl)}/webchat/analytics/pageview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": params.widgetKey,
    },
    body: JSON.stringify({
      path:
        typeof location !== "undefined" ? `${location.pathname}${location.search}` : "/",
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
    }),
  }).catch(() => undefined);
}

function loadGoogleAnalytics(measurementId: string): void {
  if (typeof window === "undefined" || !measurementId) return;
  const loadedKey = "__wbGaLoaded";
  const win = window as Window & {
    __wbGaLoaded?: string;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  if (win.__wbGaLoaded === measurementId) return;
  win.__wbGaLoaded = measurementId;
  win.dataLayer = win.dataLayer ?? [];
  function gtag(...args: unknown[]) {
    win.dataLayer?.push(args);
  }
  win.gtag = gtag;
  gtag("js", new Date());
  gtag("config", measurementId, { send_page_view: true });
  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(gaScript);
}

async function loadAnalyticsIntegrations(params: {
  apiUrl: string;
  widgetKey: string;
}): Promise<void> {
  try {
    const res = await fetch(`${apiBase(params.apiUrl)}/webchat/analytics/config`, {
      headers: { "X-Widget-Key": params.widgetKey },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      googleAnalytics?: { enabled?: boolean; measurementId?: string };
    };
    const ga = data.googleAnalytics;
    if (ga?.enabled && ga.measurementId) {
      loadGoogleAnalytics(ga.measurementId);
    }
  } catch {
    return;
  }
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

  const script = document.currentScript as HTMLScriptElement | null;
  if (script) {
    const apiUrl = script.getAttribute("data-api-url");
    const widgetKey = script.getAttribute("data-widget-key");
    if (apiUrl && widgetKey) {
      trackPageview({ apiUrl, widgetKey });
      void loadAnalyticsIntegrations({ apiUrl, widgetKey });
    }
  }
}
