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
  var seenMessageKeys = {};
  var seenCallInvites = {};
  var callBundleLoading = false;
  var activeCallDisconnect = null;
  var conversationEnded = false;
  var menuOpen = false;
  var confirmEndOpen = false;
  var actionPending = false;
  var widgetBranding = {
    brandName: "Chat",
    primaryColor: "#4f46e5",
    logoUrl: null,
  };

  var copy = {
    inputPlaceholder: "Escribe un mensaje...",
    send: "Enviar",
    incomingCall: "Llamada entrante del asesor",
    acceptCall: "Aceptar",
    declineCall: "Rechazar",
    inCall: "En llamada",
    callFailed: "No se pudo conectar la llamada",
    talkToAdvisor: "Hablar con un asesor",
    endConversation: "Terminar conversación",
    endConfirmTitle: "¿Terminar conversación?",
    endConfirmBody: "No podrás enviar más mensajes en esta sesión.",
    endConfirmYes: "Terminar",
    endConfirmNo: "Cancelar",
    conversationEnded: "Conversación finalizada",
    startNewConversation: "Iniciar nueva conversación",
    minimize: "Minimizar",
    menu: "Opciones",
    actionError: "No se pudo completar la acción. Intenta de nuevo.",
  };

  if (typeof navigator !== "undefined" && navigator.language && navigator.language.toLowerCase().startsWith("en")) {
    copy = {
      inputPlaceholder: "Write a message...",
      send: "Send",
      incomingCall: "Incoming call from advisor",
      acceptCall: "Accept",
      declineCall: "Decline",
      inCall: "On call",
      callFailed: "Could not connect the call",
      talkToAdvisor: "Talk to an advisor",
      endConversation: "End conversation",
      endConfirmTitle: "End conversation?",
      endConfirmBody: "You will not be able to send more messages in this session.",
      endConfirmYes: "End",
      endConfirmNo: "Cancel",
      conversationEnded: "Conversation ended",
      startNewConversation: "Start new conversation",
      minimize: "Minimize",
      menu: "Options",
      actionError: "Could not complete the action. Please try again.",
    };
  }

  var root = document.createElement("div");
  root.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:99999;font-family:system-ui,sans-serif;";
  document.body.appendChild(root);

  var panel = document.createElement("div");
  panel.style.cssText =
    "display:none;width:320px;height:420px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.15);flex-direction:column;overflow:hidden;position:relative;";
  root.appendChild(panel);

  var header = document.createElement("div");
  header.style.cssText =
    "background:#4f46e5;color:#fff;padding:10px 12px;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;position:relative;";
  panel.appendChild(header);

  var headerLogo = document.createElement("img");
  headerLogo.style.cssText = "display:none;width:24px;height:24px;border-radius:6px;object-fit:cover;flex-shrink:0;";
  header.appendChild(headerLogo);

  var headerTitle = document.createElement("span");
  headerTitle.textContent = "Chat";
  headerTitle.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  header.appendChild(headerTitle);

  var headerActions = document.createElement("div");
  headerActions.style.cssText = "display:flex;align-items:center;gap:4px;flex-shrink:0;";
  header.appendChild(headerActions);

  var minimizeBtn = document.createElement("button");
  minimizeBtn.type = "button";
  minimizeBtn.textContent = "—";
  minimizeBtn.title = copy.minimize;
  minimizeBtn.style.cssText =
    "background:transparent;border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:16px;line-height:1;";
  headerActions.appendChild(minimizeBtn);

  var menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.textContent = "⋮";
  menuBtn.title = copy.menu;
  menuBtn.style.cssText =
    "background:transparent;border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:18px;line-height:1;";
  headerActions.appendChild(menuBtn);

  var menu = document.createElement("div");
  menu.style.cssText =
    "display:none;position:absolute;top:44px;right:10px;min-width:190px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden;z-index:2;";
  panel.appendChild(menu);

  var menuHandoffBtn = document.createElement("button");
  menuHandoffBtn.type = "button";
  menuHandoffBtn.textContent = copy.talkToAdvisor;
  menuHandoffBtn.style.cssText =
    "display:block;width:100%;border:none;background:#fff;color:#111827;padding:10px 12px;text-align:left;font-size:13px;cursor:pointer;";
  menu.appendChild(menuHandoffBtn);

  var menuEndBtn = document.createElement("button");
  menuEndBtn.type = "button";
  menuEndBtn.textContent = copy.endConversation;
  menuEndBtn.style.cssText =
    "display:block;width:100%;border:none;background:#fff;color:#b91c1c;padding:10px 12px;text-align:left;font-size:13px;cursor:pointer;border-top:1px solid #f3f4f6;";
  menu.appendChild(menuEndBtn);

  var confirmOverlay = document.createElement("div");
  confirmOverlay.style.cssText =
    "display:none;position:absolute;inset:0;background:rgba(17,24,39,.45);align-items:center;justify-content:center;padding:16px;z-index:3;";
  panel.appendChild(confirmOverlay);

  var confirmCard = document.createElement("div");
  confirmCard.style.cssText =
    "width:100%;max-width:260px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.18);";
  confirmOverlay.appendChild(confirmCard);

  var confirmTitle = document.createElement("p");
  confirmTitle.textContent = copy.endConfirmTitle;
  confirmTitle.style.cssText = "margin:0 0 8px;font-size:15px;font-weight:600;color:#111827;";
  confirmCard.appendChild(confirmTitle);

  var confirmBody = document.createElement("p");
  confirmBody.textContent = copy.endConfirmBody;
  confirmBody.style.cssText = "margin:0 0 14px;font-size:13px;line-height:1.45;color:#4b5563;";
  confirmCard.appendChild(confirmBody);

  var confirmActions = document.createElement("div");
  confirmActions.style.cssText = "display:flex;justify-content:flex-end;gap:8px;";
  confirmCard.appendChild(confirmActions);

  var confirmCancelBtn = document.createElement("button");
  confirmCancelBtn.type = "button";
  confirmCancelBtn.textContent = copy.endConfirmNo;
  confirmCancelBtn.style.cssText =
    "border:1px solid #e5e7eb;background:#fff;color:#374151;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;";
  confirmActions.appendChild(confirmCancelBtn);

  var confirmYesBtn = document.createElement("button");
  confirmYesBtn.type = "button";
  confirmYesBtn.textContent = copy.endConfirmYes;
  confirmYesBtn.style.cssText =
    "border:none;background:#b91c1c;color:#fff;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;";
  confirmActions.appendChild(confirmYesBtn);

  var messages = document.createElement("div");
  messages.style.cssText = "flex:1;overflow-y:auto;padding:12px;background:#f9fafb;";
  panel.appendChild(messages);

  var endedBanner = document.createElement("div");
  endedBanner.style.cssText =
    "display:none;padding:12px 14px;background:#f3f4f6;border-top:1px solid #e5e7eb;text-align:center;";
  panel.appendChild(endedBanner);

  var endedLabel = document.createElement("p");
  endedLabel.textContent = copy.conversationEnded;
  endedLabel.style.cssText = "margin:0 0 10px;font-size:13px;color:#374151;font-weight:600;";
  endedBanner.appendChild(endedLabel);

  var newConversationBtn = document.createElement("button");
  newConversationBtn.type = "button";
  newConversationBtn.textContent = copy.startNewConversation;
  newConversationBtn.style.cssText =
    "border:none;background:#4f46e5;color:#fff;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;";
  endedBanner.appendChild(newConversationBtn);

  var callBanner = document.createElement("div");
  callBanner.style.cssText = "display:none;padding:10px 12px;background:#ecfdf5;border-top:1px solid #a7f3d0;";
  panel.appendChild(callBanner);

  var form = document.createElement("form");
  form.style.cssText = "display:flex;border-top:1px solid #e5e7eb;padding:8px;gap:8px;";
  var input = document.createElement("input");
  input.placeholder = copy.inputPlaceholder;
  input.style.cssText =
    "flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:14px;";
  var send = document.createElement("button");
  send.type = "submit";
  send.textContent = copy.send;
  send.style.cssText =
    "background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;";
  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(form);

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Chat");
  toggle.innerHTML =
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/></svg>";
  toggle.style.cssText =
    "margin-top:8px;background:#4f46e5;color:#fff;border:none;border-radius:999px;width:56px;height:56px;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(79,70,229,.4);";
  root.appendChild(toggle);

  function applyWidgetBranding() {
    var color = widgetBranding.primaryColor || "#4f46e5";
    header.style.background = color;
    send.style.background = color;
    toggle.style.background = color;
    newConversationBtn.style.background = color;
    toggle.style.boxShadow = "0 4px 14px " + color + "66";
    headerTitle.textContent = widgetBranding.brandName || "Chat";
    toggle.setAttribute("aria-label", widgetBranding.brandName || "Chat");
    if (widgetBranding.logoUrl) {
      headerLogo.src = widgetBranding.logoUrl;
      headerLogo.style.display = "block";
    } else {
      headerLogo.style.display = "none";
    }
  }

  function renderMessage(role, content) {
    var bubble = document.createElement("div");
    bubble.textContent = content;
    var userColor = widgetBranding.primaryColor || "#4f46e5";
    bubble.style.cssText =
      "max-width:85%;margin:6px 0;padding:8px 10px;border-radius:10px;font-size:13px;line-height:1.4;" +
      (role === "user"
        ? "margin-left:auto;background:" + userColor + ";color:#fff;"
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

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function closeMenu() {
    menuOpen = false;
    menu.style.display = "none";
  }

  function closeConfirmEnd() {
    confirmEndOpen = false;
    confirmOverlay.style.display = "none";
  }

  function setMenuEnabled(enabled) {
    menuBtn.disabled = !enabled;
    menuHandoffBtn.disabled = !enabled || actionPending;
    menuEndBtn.disabled = !enabled || actionPending;
    menuBtn.style.opacity = enabled ? "1" : "0.5";
    menuBtn.style.cursor = enabled ? "pointer" : "not-allowed";
  }

  function setConversationEndedState(ended) {
    conversationEnded = ended;
    form.style.display = ended ? "none" : "flex";
    endedBanner.style.display = ended ? "block" : "none";
    input.disabled = ended;
    send.disabled = ended;
    setMenuEnabled(!ended);
    if (ended) {
      closeMenu();
      closeConfirmEnd();
      stopPolling();
    }
  }

  function resetSessionState() {
    stopPolling();
    sessionToken = null;
    sessionId = null;
    seenMessageKeys = {};
    seenCallInvites = {};
    conversationEnded = false;
    actionPending = false;
    messages.innerHTML = "";
    callBanner.style.display = "none";
    closeMenu();
    closeConfirmEnd();
    setConversationEndedState(false);
  }

  function ensureSession() {
    if (sessionToken && sessionId && !conversationEnded) return Promise.resolve();
    resetSessionState();
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
      if (data.branding) {
        widgetBranding.brandName = data.branding.brandName || widgetBranding.brandName;
        widgetBranding.primaryColor = data.branding.primaryColor || widgetBranding.primaryColor;
        widgetBranding.logoUrl = data.branding.logoUrl || null;
        applyWidgetBranding();
      }
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
    label.textContent = copy.incomingCall;
    label.style.cssText = "font-size:13px;margin:0 0 8px;color:#065f46;font-weight:600;";
    callBanner.appendChild(label);

    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;";

    var acceptBtn = document.createElement("button");
    acceptBtn.textContent = copy.acceptCall;
    acceptBtn.style.cssText =
      "flex:1;background:#059669;color:#fff;border:none;border-radius:8px;padding:8px;font-size:13px;cursor:pointer;";
    var declineBtn = document.createElement("button");
    declineBtn.textContent = copy.declineCall;
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
          label.textContent = copy.inCall;
          actions.remove();
        })
        .catch(function () {
          label.textContent = copy.callFailed;
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
    if (!sessionToken || !sessionId || conversationEnded) return;
    apiFetch("/webchat/sessions/" + encodeURIComponent(sessionId) + "/messages", {
      headers: { Authorization: "Bearer " + sessionToken },
    })
      .then(function (data) {
        if (data.sessionStatus === "ended") {
          setConversationEndedState(true);
        }
        (data.items || []).forEach(function (msg) {
          var key = msg.messageId + msg.timestamp;
          if (seenMessageKeys[key]) return;
          seenMessageKeys[key] = true;
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
      })
      .catch(function () {});
  }

  function startPolling() {
    if (pollTimer || conversationEnded) return;
    pollTimer = setInterval(poll, 3000);
    poll();
  }

  function endConversation() {
    if (!sessionToken || !sessionId || conversationEnded || actionPending) return;
    actionPending = true;
    setMenuEnabled(false);
    apiFetch("/webchat/sessions/" + encodeURIComponent(sessionId) + "/end", {
      method: "POST",
      headers: { Authorization: "Bearer " + sessionToken },
    })
      .then(function (data) {
        if (data.farewellMessage) {
          renderMessage("assistant", data.farewellMessage);
        }
        setConversationEndedState(true);
      })
      .catch(function () {
        renderMessage("assistant", copy.actionError);
        actionPending = false;
        setMenuEnabled(true);
      });
  }

  function requestHandoff() {
    if (!sessionToken || !sessionId || conversationEnded || actionPending) return;
    closeMenu();
    actionPending = true;
    setMenuEnabled(false);
    apiFetch("/webchat/sessions/" + encodeURIComponent(sessionId) + "/handoff", {
      method: "POST",
      headers: { Authorization: "Bearer " + sessionToken },
    })
      .then(function (data) {
        if (data.message) {
          renderMessage("assistant", data.message);
        }
      })
      .catch(function () {
        renderMessage("assistant", copy.actionError);
      })
      .finally(function () {
        actionPending = false;
        setMenuEnabled(true);
        poll();
      });
  }

  minimizeBtn.addEventListener("click", function () {
    closeMenu();
    closeConfirmEnd();
    panel.style.display = "none";
  });

  menuBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    if (conversationEnded || menuBtn.disabled) return;
    menuOpen = !menuOpen;
    menu.style.display = menuOpen ? "block" : "none";
  });

  menuHandoffBtn.addEventListener("click", function () {
    closeMenu();
    requestHandoff();
  });

  menuEndBtn.addEventListener("click", function () {
    closeMenu();
    confirmEndOpen = true;
    confirmOverlay.style.display = "flex";
  });

  confirmCancelBtn.addEventListener("click", function () {
    closeConfirmEnd();
  });

  confirmYesBtn.addEventListener("click", function () {
    closeConfirmEnd();
    endConversation();
  });

  newConversationBtn.addEventListener("click", function () {
    resetSessionState();
    ensureSession()
      .then(startPolling)
      .catch(function () {
        renderMessage("assistant", copy.actionError);
      });
  });

  document.addEventListener("click", function (event) {
    if (!menuOpen) return;
    if (menu.contains(event.target) || menuBtn.contains(event.target)) return;
    closeMenu();
  });

  toggle.addEventListener("click", function () {
    var open = panel.style.display === "flex";
    panel.style.display = open ? "none" : "flex";
    if (!open) {
      ensureSession().then(startPolling);
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (conversationEnded) return;
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
      .then(poll)
      .catch(function () {
        renderMessage("assistant", copy.actionError);
      });
  });

  applyWidgetBranding();
})();
