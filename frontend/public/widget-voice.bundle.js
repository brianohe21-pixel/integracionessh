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
  function randomId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
  function getVisitorId() {
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
  function getSessionId() {
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
  function trackPageview(params) {
    void fetch(`${apiBase(params.apiUrl)}/webchat/analytics/pageview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Widget-Key": params.widgetKey
      },
      body: JSON.stringify({
        path: typeof location !== "undefined" ? `${location.pathname}${location.search}` : "/",
        referrer: typeof document !== "undefined" ? document.referrer || void 0 : void 0,
        visitorId: getVisitorId(),
        sessionId: getSessionId()
      })
    }).catch(() => void 0);
  }
  function loadGoogleAnalytics(measurementId) {
    if (typeof window === "undefined" || !measurementId) return;
    const loadedKey = "__wbGaLoaded";
    const win = window;
    if (win.__wbGaLoaded === measurementId) return;
    win.__wbGaLoaded = measurementId;
    win.dataLayer = win.dataLayer ?? [];
    function gtag(...args) {
      win.dataLayer?.push(args);
    }
    win.gtag = gtag;
    gtag("js", /* @__PURE__ */ new Date());
    gtag("config", measurementId, { send_page_view: true });
    const gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(gaScript);
  }
  async function loadAnalyticsIntegrations(params) {
    try {
      const res = await fetch(`${apiBase(params.apiUrl)}/webchat/analytics/config`, {
        headers: { "X-Widget-Key": params.widgetKey }
      });
      if (!res.ok) return;
      const data = await res.json();
      const ga = data.googleAnalytics;
      if (ga?.enabled && ga.measurementId) {
        loadGoogleAnalytics(ga.measurementId);
      }
    } catch {
      return;
    }
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
    const script = document.currentScript;
    if (script) {
      const apiUrl = script.getAttribute("data-api-url");
      const widgetKey = script.getAttribute("data-widget-key");
      if (apiUrl && widgetKey) {
        trackPageview({ apiUrl, widgetKey });
        void loadAnalyticsIntegrations({ apiUrl, widgetKey });
      }
    }
  }
  return __toCommonJS(widget_voice_entry_exports);
})();
