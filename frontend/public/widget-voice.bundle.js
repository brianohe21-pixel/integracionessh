"use strict";
var VoicebotWidgetBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // public/widget-voice.entry.ts
  var widget_voice_entry_exports = {};
  __export(widget_voice_entry_exports, {
    startVoicebot: () => startVoicebot,
    stopVoicebot: () => stopVoicebot
  });
  var active = null;
  function apiBase(apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }
  async function createSession(params, sdpOffer) {
    const res = await fetch(`${apiBase(params.apiUrl)}/voicebot/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Widget-Key": params.widgetKey
      },
      body: JSON.stringify({
        botId: params.botId,
        sdpOffer,
        ...params.visitorName ? { visitorName: params.visitorName } : {}
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to start voicebot session");
    }
    return res.json();
  }
  async function endSession(apiUrl, widgetKey, sessionId, durationSeconds) {
    await fetch(`${apiBase(apiUrl)}/voicebot/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Widget-Key": widgetKey
      },
      body: JSON.stringify({ durationSeconds })
    });
  }
  function cleanupSession(current) {
    current.localStream.getTracks().forEach((track) => track.stop());
    current.pc.close();
    current.remoteAudio.remove();
    return Math.max(1, Math.ceil((Date.now() - current.startedAt) / 1e3));
  }
  async function startVoicebot(params) {
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
      onStatus: params.onStatus
    };
    params.onStatus?.("in_call");
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        void stopVoicebot();
      }
    };
  }
  async function stopVoicebot() {
    const current = active;
    if (!current) return;
    active = null;
    const durationSeconds = cleanupSession(current);
    current.onStatus?.("ended");
    await endSession(current.apiUrl, current.widgetKey, current.sessionId, durationSeconds);
  }
  if (typeof window !== "undefined") {
    window.VoicebotWidget = {
      start: startVoicebot,
      stop: stopVoicebot
    };
  }
  return __toCommonJS(widget_voice_entry_exports);
})();
