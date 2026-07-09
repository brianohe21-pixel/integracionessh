import { Room, RoomEvent, Track } from "livekit-client";

type JoinParams = {
  apiUrl: string;
  sessionToken: string;
  sessionId: string;
  callId: string;
  videoEnabled: boolean;
  onEnded: () => void;
};

type DeclineParams = {
  apiUrl: string;
  sessionToken: string;
  sessionId: string;
  callId: string;
};

function apiBase(apiUrl: string): string {
  return apiUrl.replace(/\/$/, "");
}

async function fetchToken(params: JoinParams): Promise<{ token: string; url: string }> {
  const res = await fetch(
    `${apiBase(params.apiUrl)}/webchat/sessions/${encodeURIComponent(params.sessionId)}/calls/${encodeURIComponent(params.callId)}/accept`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.sessionToken}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to get call token");
  return res.json();
}

export async function joinCall(params: JoinParams): Promise<() => Promise<void>> {
  const tokenData = await fetchToken(params);
  const room = new Room({ adaptiveStream: true });

  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");
  document.body.appendChild(remoteAudio);

  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) track.attach(remoteAudio);
  });

  room.on(RoomEvent.Disconnected, () => {
    remoteAudio.remove();
    params.onEnded();
  });

  await room.connect(tokenData.url, tokenData.token);
  await room.localParticipant.setMicrophoneEnabled(true);
  if (params.videoEnabled) {
    await room.localParticipant.setCameraEnabled(true);
  }

  return async () => {
    await room.disconnect();
    remoteAudio.remove();
  };
}

export async function declineCall(params: DeclineParams): Promise<void> {
  const res = await fetch(
    `${apiBase(params.apiUrl)}/webchat/sessions/${encodeURIComponent(params.sessionId)}/calls/${encodeURIComponent(params.callId)}/decline`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.sessionToken}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to decline call");
}

declare global {
  interface Window {
    WebchatCall?: {
      join: (params: JoinParams) => Promise<() => Promise<void>>;
      decline: (params: DeclineParams) => Promise<void>;
    };
  }
}

if (typeof window !== "undefined") {
  window.WebchatCall = { join: joinCall, decline: declineCall };
}
