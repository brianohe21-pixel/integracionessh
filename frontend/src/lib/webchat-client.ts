export interface WebchatBranding {
  brandName: string;
  primaryColor: string;
  logoUrl?: string;
}

export interface WebchatSession {
  sessionId: string;
  sessionToken: string;
  conversationId: string;
  sessionStatus?: "active" | "ended";
  branding?: WebchatBranding;
}

export interface WebchatMessage {
  messageId: string;
  role: string;
  content: string;
  timestamp: string;
  messageType?: string;
  metadata?: Record<string, unknown>;
}

function apiBase(): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  return base;
}

async function webchatRequest<T>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    const message =
      typeof error === "object" && error && "error" in error
        ? String((error as { error: string }).error)
        : "Request failed";
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function createWebchatSession(params: {
  botId: string;
  widgetKey: string;
  visitorName?: string;
}): Promise<WebchatSession> {
  return webchatRequest<WebchatSession>("/webchat/sessions", {
    method: "POST",
    headers: { "X-Widget-Key": params.widgetKey },
    body: JSON.stringify({
      botId: params.botId,
      ...(params.visitorName ? { visitorName: params.visitorName } : {}),
    }),
  });
}

export async function sendWebchatMessage(params: {
  sessionId: string;
  sessionToken: string;
  content: string;
}): Promise<void> {
  await webchatRequest(`/webchat/sessions/${encodeURIComponent(params.sessionId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.sessionToken}` },
    body: JSON.stringify({ content: params.content }),
  });
}

export async function pollWebchatMessages(params: {
  sessionId: string;
  sessionToken: string;
}): Promise<{ items: WebchatMessage[]; sessionStatus?: "active" | "ended" }> {
  const data = await webchatRequest<{ items: WebchatMessage[]; sessionStatus?: "active" | "ended" }>(
    `/webchat/sessions/${encodeURIComponent(params.sessionId)}/messages`,
    {
      headers: { Authorization: `Bearer ${params.sessionToken}` },
    }
  );
  return {
    items: data.items ?? [],
    sessionStatus: data.sessionStatus,
  };
}

export async function endWebchatSession(params: {
  sessionId: string;
  sessionToken: string;
}): Promise<{ sessionStatus: "ended"; farewellMessage?: string }> {
  return webchatRequest(`/webchat/sessions/${encodeURIComponent(params.sessionId)}/end`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.sessionToken}` },
  });
}

export async function requestWebchatHandoff(params: {
  sessionId: string;
  sessionToken: string;
}): Promise<{ message: string; handoffMode: "bot" | "human"; sessionStatus?: "active" | "ended" }> {
  return webchatRequest(`/webchat/sessions/${encodeURIComponent(params.sessionId)}/handoff`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.sessionToken}` },
  });
}
