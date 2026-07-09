import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { api } from "@/lib/api";

export type LiveKitCallState = "idle" | "ringing" | "connecting" | "in_call" | "ended";

export interface ActiveLiveKitCall {
  callId: string;
  roomName: string;
  status: string;
  videoEnabled?: boolean;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
  roomName: string;
  videoEnabled: boolean;
}

export function useLiveKitCall(params: {
  conversationId: string;
  botId: string;
  enabled: boolean;
}) {
  const { conversationId, botId, enabled } = params;
  const qc = useQueryClient();
  const roomRef = useRef<Room | null>(null);
  const [callState, setCallState] = useState<LiveKitCallState>("idle");
  const [activeCall, setActiveCall] = useState<ActiveLiveKitCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [allowVideo, setAllowVideo] = useState(false);

  const { data: serverActiveCall } = useQuery({
    queryKey: ["livekit-call", conversationId],
    queryFn: () =>
      api.get<ActiveLiveKitCall | null>(
        `/conversations/${encodeURIComponent(conversationId)}/calls/active`
      ),
    enabled: enabled && Boolean(conversationId),
    refetchInterval: callState === "ringing" ? 3000 : false,
  });

  useEffect(() => {
    if (serverActiveCall && callState === "idle") {
      setActiveCall(serverActiveCall);
      if (serverActiveCall.status === "ringing" || serverActiveCall.status === "active") {
        setCallState(serverActiveCall.status === "active" ? "in_call" : "ringing");
      }
    }
  }, [serverActiveCall, callState]);

  const disconnectRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      await room.disconnect();
    }
  }, []);

  useEffect(() => {
    return () => {
      void disconnectRoom();
    };
  }, [disconnectRoom]);

  const connectWithToken = useCallback(
    async (tokenData: LiveKitTokenResponse) => {
      setCallState("connecting");
      setError(null);
      await disconnectRoom();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        setCallState("ended");
        roomRef.current = null;
      });

      await room.connect(tokenData.url, tokenData.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (tokenData.videoEnabled) {
        await room.localParticipant.setCameraEnabled(true);
        setCameraOn(true);
        setAllowVideo(true);
      } else {
        setAllowVideo(false);
      }

      setCallState("in_call");
    },
    [disconnectRoom]
  );

  const startCall = useMutation({
    mutationFn: async () => {
      const created = await api.post<ActiveLiveKitCall>(
        `/conversations/${encodeURIComponent(conversationId)}/calls`,
        {}
      );
      setActiveCall(created);
      setCallState("ringing");

      const tokenData = await api.post<LiveKitTokenResponse>(
        `/conversations/${encodeURIComponent(conversationId)}/calls/${encodeURIComponent(created.callId)}/token`,
        {}
      );
      await connectWithToken(tokenData);
      return created;
    },
    onError: (err: Error) => {
      setError(err.message);
      setCallState("idle");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["livekit-call", conversationId] });
      void qc.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
    },
  });

  const joinCall = useMutation({
    mutationFn: async (call: ActiveLiveKitCall) => {
      const tokenData = await api.post<LiveKitTokenResponse>(
        `/conversations/${encodeURIComponent(conversationId)}/calls/${encodeURIComponent(call.callId)}/token`,
        {}
      );
      setActiveCall(call);
      await connectWithToken(tokenData);
    },
    onError: (err: Error) => {
      setError(err.message);
      setCallState("idle");
    },
  });

  const endCall = useMutation({
    mutationFn: async () => {
      if (!activeCall) return;
      await api.post(
        `/conversations/${encodeURIComponent(conversationId)}/calls/${encodeURIComponent(activeCall.callId)}/end`,
        {}
      );
    },
    onSettled: async () => {
      await disconnectRoom();
      setCallState("ended");
      setActiveCall(null);
      void qc.invalidateQueries({ queryKey: ["livekit-call", conversationId] });
      void qc.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
      setTimeout(() => setCallState("idle"), 1500);
    },
  });

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [muted]);

  const toggleVideo = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !allowVideo) return;
    const next = !cameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
  }, [cameraOn, allowVideo]);

  const attachRemoteAudio = useCallback((el: HTMLAudioElement | null) => {
    const room = roomRef.current;
    if (!room || !el) return;

    const attachTracks = () => {
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((pub) => {
          if (pub.track) pub.track.attach(el);
        });
      });
    };

    attachTracks();
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) track.attach(el);
    });
  }, []);

  return {
    callState,
    activeCall,
    error,
    muted,
    cameraOn,
    allowVideo,
    botId,
    startCall,
    joinCall,
    endCall,
    toggleMute,
    toggleVideo,
    attachRemoteAudio,
    room: roomRef.current,
  };
}
