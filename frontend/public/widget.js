(function () {
  var script = document.currentScript;
  if (!script) return;

  var apiUrl = script.getAttribute("data-api-url");
  var botId = script.getAttribute("data-bot-id");
  var widgetKey = script.getAttribute("data-widget-key");
  if (!apiUrl || !botId || !widgetKey) return;

  var sessionToken = null;
  var sessionId = null;
  var pollTimer = null;
  var lastSeen = "";
  var seenCallInvites = {};
  var callBundleLoading = false;
  var activeCallDisconnect = null;

  var root = document.createElement("div");
  root.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:99999;font-family:system-ui,sans-serif;";
  document.body.appendChild(root);

  var panel = document.createElement("div");
  panel.style.cssText =
    "display:none;width:320px;height:420px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.15);flex-direction:column;overflow:hidden;";
  root.appendChild(panel);

  var header = document.createElement("div");
  header.textContent = "Chat";
  header.style.cssText =
    "background:#4f46e5;color:#fff;padding:12px 14px;font-weight:600;font-size:14px;";
  panel.appendChild(header);

  var messages = document.createElement("div");
  messages.style.cssText = "flex:1;overflow-y:auto;padding:12px;background:#f9fafb;";
  panel.appendChild(messages);

  var callBanner = document.createElement("div");
  callBanner.style.cssText = "display:none;padding:10px 12px;background:#ecfdf5;border-top:1px solid #a7f3d0;";
  panel.appendChild(callBanner);

  var form = document.createElement("form");
  form.style.cssText = "display:flex;border-top:1px solid #e5e7eb;padding:8px;gap:8px;";
  var input = document.createElement("input");
  input.placeholder = "Escribe un mensaje...";
  input.style.cssText =
    "flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:14px;";
  var send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Enviar";
  send.style.cssText =
    "background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;";
  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(form);

  var toggle = document.createElement("button");
  toggle.textContent = "Chat";
  toggle.style.cssText =
    "margin-top:8px;background:#4f46e5;color:#fff;border:none;border-radius:999px;padding:12px 18px;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(79,70,229,.4);";
  root.appendChild(toggle);

  function renderMessage(role, content) {
    var bubble = document.createElement("div");
    bubble.textContent = content;
    bubble.style.cssText =
      "max-width:85%;margin:6px 0;padding:8px 10px;border-radius:10px;font-size:13px;line-height:1.4;" +
      (role === "user"
        ? "margin-left:auto;background:#4f46e5;color:#fff;"
        : "background:#fff;border:1px solid #e5e7eb;color:#111;");
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function apiFetch(path, options) {
    return fetch(apiUrl.replace(/\/$/, "") + path, options).then(function (res) {
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    });
  }

  function ensureSession() {
    if (sessionToken) return Promise.resolve();
    return apiFetch("/webchat/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Widget-Key": widgetKey,
      },
      body: JSON.stringify({ botId: botId }),
    }).then(function (data) {
      sessionToken = data.sessionToken;
      sessionId = data.sessionId;
    });
  }

  function widgetOrigin() {
    try {
      return new URL(script.src).origin;
    } catch (e) {
      return window.location.origin;
    }
  }

  function loadCallBundle() {
    if (window.WebchatCall) return Promise.resolve();
    if (callBundleLoading) {
      return new Promise(function (resolve) {
        var check = setInterval(function () {
          if (window.WebchatCall) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }
    callBundleLoading = true;
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = widgetOrigin() + "/widget-call.bundle.js";
      s.onload = function () {
        callBundleLoading = false;
        resolve();
      };
      s.onerror = function () {
        callBundleLoading = false;
        reject(new Error("Failed to load call bundle"));
      };
      document.head.appendChild(s);
    });
  }

  function showCallInvite(callId, videoEnabled) {
    if (seenCallInvites[callId]) return;
    seenCallInvites[callId] = true;

    callBanner.style.display = "block";
    callBanner.innerHTML = "";
    var label = document.createElement("p");
    label.textContent = "Llamada entrante del asesor";
    label.style.cssText = "font-size:13px;margin:0 0 8px;color:#065f46;font-weight:600;";
    callBanner.appendChild(label);

    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;";

    var acceptBtn = document.createElement("button");
    acceptBtn.textContent = "Aceptar";
    acceptBtn.style.cssText =
      "flex:1;background:#059669;color:#fff;border:none;border-radius:8px;padding:8px;font-size:13px;cursor:pointer;";
    var declineBtn = document.createElement("button");
    declineBtn.textContent = "Rechazar";
    declineBtn.style.cssText =
      "flex:1;background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:8px;font-size:13px;cursor:pointer;";

    actions.appendChild(acceptBtn);
    actions.appendChild(declineBtn);
    callBanner.appendChild(actions);

    panel.style.display = "flex";

    acceptBtn.addEventListener("click", function () {
      acceptBtn.disabled = true;
      declineBtn.disabled = true;
      loadCallBundle()
        .then(function () {
          return window.WebchatCall.join({
            apiUrl: apiUrl,
            sessionToken: sessionToken,
            sessionId: sessionId,
            callId: callId,
            videoEnabled: Boolean(videoEnabled),
            onEnded: function () {
              callBanner.style.display = "none";
              activeCallDisconnect = null;
            },
          });
        })
        .then(function (disconnect) {
          activeCallDisconnect = disconnect;
          label.textContent = "En llamada";
          actions.remove();
        })
        .catch(function () {
          label.textContent = "No se pudo conectar la llamada";
          acceptBtn.disabled = false;
          declineBtn.disabled = false;
        });
    });

    declineBtn.addEventListener("click", function () {
      loadCallBundle()
        .then(function () {
          return window.WebchatCall.decline({
            apiUrl: apiUrl,
            sessionToken: sessionToken,
            sessionId: sessionId,
            callId: callId,
          });
        })
        .then(function () {
          callBanner.style.display = "none";
        });
    });
  }

  function poll() {
    if (!sessionToken || !sessionId) return;
    apiFetch("/webchat/sessions/" + encodeURIComponent(sessionId) + "/messages", {
      headers: { Authorization: "Bearer " + sessionToken },
    }).then(function (data) {
      (data.items || []).forEach(function (msg) {
        var key = msg.messageId + msg.timestamp;
        if (key === lastSeen) return;
        if (msg.messageType === "call_invite" && msg.metadata && msg.metadata.callId) {
          showCallInvite(msg.metadata.callId, msg.metadata.videoEnabled);
        } else if (msg.messageType === "call_ended") {
          callBanner.style.display = "none";
          if (activeCallDisconnect) {
            activeCallDisconnect().catch(function () {});
            activeCallDisconnect = null;
          }
        } else if (msg.role !== "user") {
          renderMessage(msg.role, msg.content);
        }
      });
      var last = (data.items || [])[data.items.length - 1];
      if (last) lastSeen = last.messageId + last.timestamp;
    });
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(poll, 3000);
    poll();
  }

  toggle.addEventListener("click", function () {
    var open = panel.style.display === "flex";
    panel.style.display = open ? "none" : "flex";
    if (!open) {
      ensureSession().then(startPolling);
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    ensureSession()
      .then(function () {
        renderMessage("user", text);
        input.value = "";
        return apiFetch(
          "/webchat/sessions/" + encodeURIComponent(sessionId) + "/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + sessionToken,
            },
            body: JSON.stringify({ content: text }),
          }
        );
      })
      .then(poll);
  });
})();
